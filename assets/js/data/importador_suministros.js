// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: importador suministros (Fase 42 + polish 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Runner del importador. Conecta SheetJS + Firestore al parser puro
// (domain/importador_suministros.js). Canal único: Excel (.xlsm).
//
// Idempotente por:
//   · /suministros: docId == {contrato_id}_{codigo} (set merge).
//   · /marcas: clave (suministro_id, marca) — skip si ya existe.
//
// El canal JSX (control_suministros-2.jsx) fue retirado en 2026-04-27 PM:
// ya no se sincronizan /transformadores ni /correcciones desde aquí.
// Esos datos viven en Firestore desde imports anteriores; las ediciones
// se hacen ahora desde admin/inventario.html y admin/auditoria.html.
//
// Audit: una sola entrada bulk_import_suministros con metadata granular.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  setDoc, addDoc, getDocs, writeBatch, serverTimestamp, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  parsearCatalogoRows, parsearMarcasRows, prepararPlanImportacion
} from '../domain/importador_suministros.js';
import { composeDocId } from '../domain/contratos.js';

const COL_SUMINISTROS = 'suministros';
const COL_MARCAS      = 'marcas';
const COL_AUDIT       = 'auditoria';
const BATCH_LIMIT     = 450;

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }
function db() { const d = getDbSafe(); if (!d) throw new Error('Firebase no inicializado.'); return d; }

// ── SHA-256 hex (browser crypto.subtle) ────────────────────────
async function sha256Hex(buffer) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  let bytes;
  if (buffer instanceof ArrayBuffer) bytes = buffer;
  else if (typeof buffer === 'string') bytes = new TextEncoder().encode(buffer);
  else return '';
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Lectura de existentes (snapshot del estado actual) ─────────
async function leerExistentes() {
  const d = db();
  const sumSnap = await getDocs(collection(d, COL_SUMINISTROS));
  const suministrosIds = new Set(sumSnap.docs.map((x) => x.id));

  const marSnap = await getDocs(collection(d, COL_MARCAS));
  const marcasKeys = new Set(
    marSnap.docs.map((x) => {
      const data = x.data();
      return `${data.suministro_id}::${data.marca}`;
    })
  );

  return { suministrosIds, marcasKeys };
}

/**
 * Parsea el .xlsm fuente a estructuras de dominio. Usa SheetJS
 * inyectado por el caller (UI hace `loadSheetJS()`).
 */
export async function parsearArchivos({ xlsmBuffer, XLSX }) {
  if (!XLSX) throw new Error('SheetJS (XLSX) no cargado.');
  if (!xlsmBuffer) throw new Error('xlsmBuffer es obligatorio.');

  const wb = XLSX.read(xlsmBuffer, { type: 'array', cellDates: true });
  // El .xlsm fuente tiene un título mergeado en row 1 y los headers
  // reales en row 3. range: 2 le dice a SheetJS que la fila 3
  // (índice 2 zero-based) es el header.
  const rowsCat = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Suministros'] || {}, { range: 2, raw: false, defval: '' });
  const rowsMar = XLSX.utils.sheet_to_json(wb.Sheets['Marcas']               || {}, { range: 2, raw: false, defval: '' });

  const catRes = parsearCatalogoRows(rowsCat);
  const marRes = parsearMarcasRows(rowsMar);

  const xlsmSha = await sha256Hex(xlsmBuffer);

  return {
    parsed: {
      suministros: catRes.suministros,
      marcas:      marRes.marcas
    },
    erroresParseo: {
      catalogo: catRes.errores,
      marcas:   marRes.errores
    },
    hashes: { xlsm: xlsmSha }
  };
}

/**
 * Construye el plan completo (parseo + diff contra Firestore).
 */
export async function planearImportacion({ xlsmBuffer, XLSX }) {
  const { parsed, erroresParseo, hashes } = await parsearArchivos({ xlsmBuffer, XLSX });
  const existentes = await leerExistentes();
  const plan = prepararPlanImportacion(parsed, existentes);
  return { plan, parsed, erroresParseo, hashes };
}

/**
 * Ejecuta la importación. dryRun=true solo reporta cifras.
 *
 * Audit: una sola entrada `bulk_import_suministros` con metadata
 * granular (sha256 de cada fuente, summary, ids creados/actualizados,
 * duración).
 */
export async function ejecutarImportacion({
  plan, parsed, hashes,
  contrato_id = '',
  dryRun = false, uid = null, onProgress = null
}) {
  if (!plan) throw new Error('plan es obligatorio.');
  const d = db();
  const t0 = Date.now();
  const cid = String(contrato_id || '').trim();

  const idsCreados = { suministros: [], marcas: [] };
  const idsActualizados = { suministros: [] };

  let batch = writeBatch(d);
  let count = 0;
  const flush = async () => {
    if (count > 0 && !dryRun) await batch.commit();
    batch = writeBatch(d);
    count = 0;
  };
  const enqueue = async () => {
    if (++count >= BATCH_LIMIT) await flush();
  };

  const reportProgress = (etapa, i, total) => {
    if (onProgress) onProgress({ etapa, i, total });
  };

  // ── 1. /suministros ──────────────────────────────────────────
  // No incluimos marcas_disponibles en el payload aquí: ese campo
  // se mantiene vivo vía arrayUnion en el step 2 (marcas). Si
  // pasáramos marcas_disponibles=[] en cada import, sobrescribiría
  // las marcas previamente sincronizadas (merge reemplaza arrays).
  const limpiarPayloadSuministro = (s) => {
    const { marcas_disponibles, ...rest } = s;
    return rest;
  };
  // docId helper: si hay contrato_id, compone {cid}_{codigo}; si no,
  // mantiene el codigo plano (compat con docs legacy del 4123000081).
  const sumDocId = (codigo) => composeDocId(cid, codigo);
  let i = 0;
  for (const s of plan.suministros.crear) {
    if (!dryRun) {
      batch.set(doc(d, COL_SUMINISTROS, sumDocId(s.codigo)), {
        ...limpiarPayloadSuministro(s),
        contrato_id: cid,
        marcas_disponibles: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid
      });
    }
    idsCreados.suministros.push(sumDocId(s.codigo));
    await enqueue();
    reportProgress('suministros', ++i, plan.suministros.crear.length + plan.suministros.actualizar.length);
  }
  for (const s of plan.suministros.actualizar) {
    if (!dryRun) {
      batch.set(doc(d, COL_SUMINISTROS, sumDocId(s.codigo)), {
        ...limpiarPayloadSuministro(s),
        contrato_id: cid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    idsActualizados.suministros.push(sumDocId(s.codigo));
    await enqueue();
    reportProgress('suministros', ++i, plan.suministros.crear.length + plan.suministros.actualizar.length);
  }
  await flush();

  // ── 2. /marcas + sync marcas_disponibles ─────────────────────
  // Crear las que no existen.
  i = 0;
  for (const m of plan.marcas.crear) {
    if (!dryRun) {
      const ref = doc(collection(d, COL_MARCAS));
      batch.set(ref, {
        ...m,
        contrato_id: cid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid
      });
      idsCreados.marcas.push(ref.id);
    } else {
      idsCreados.marcas.push('(dry-run)');
    }
    await enqueue();
    reportProgress('marcas', ++i, plan.marcas.crear.length);
  }
  // Sync idempotente: reconstruye marcas_disponibles[] de cada
  // suministro afectado uniendo TODAS las marcas parseadas (no
  // solo las nuevas). Así la re-importación garantiza que el array
  // refleja el estado real de /marcas, incluso si en pasadas
  // anteriores quedó wipeado por bugs o ediciones manuales.
  if (!dryRun) {
    const marcasPorSum = new Map();
    for (const m of (parsed && parsed.marcas) || []) {
      if (!m.suministro_id || !m.marca) continue;
      if (!marcasPorSum.has(m.suministro_id)) marcasPorSum.set(m.suministro_id, []);
      marcasPorSum.get(m.suministro_id).push(m.marca);
    }
    for (const [sid, lista] of marcasPorSum) {
      batch.set(
        doc(d, COL_SUMINISTROS, sumDocId(sid)),
        { marcas_disponibles: arrayUnion(...lista), updatedAt: serverTimestamp() },
        { merge: true }
      );
      await enqueue();
    }
  }
  await flush();

  // ── 3. Registrar el contrato en /contratos/{id} ─────────────
  // Crea o actualiza el doc para que pages/contratos.html lo liste
  // automáticamente y la UI de cards muestre con_datos=true.
  if (!dryRun && cid) {
    try {
      await setDoc(
        doc(d, 'contratos', cid),
        {
          schema_version: 1,
          codigo: cid,
          alcance: (parsed && parsed.contrato_nombre) || 'Suministro de Elementos y Accesorios para Transformadores de Potencia',
          aliado: 'OTRO',
          aliado_otro: '',
          fecha_inicio: new Date().toISOString().slice(0, 10),
          monto_total: 0,
          presupuesto_comprometido: 0,
          presupuesto_ejecutado: 0,
          presupuesto_disponible: 0,
          moneda: 'COP',
          zonas_aplica: [],
          tipo_activo_elegible: ['POTENCIA'],
          estado: 'vigente',
          observaciones: '',
          ultima_importacion: serverTimestamp(),
          ultima_importacion_uid: uid || null,
          ultima_importacion_summary: {
            suministros_creados:      idsCreados.suministros.length,
            suministros_actualizados: idsActualizados.suministros.length,
            marcas_creadas:           idsCreados.marcas.length
          },
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[importador.contrato] no se pudo registrar /contratos/' + cid + ':', err);
    }
  }

  // ── 4. Audit entry granular ──────────────────────────────────
  const duracion_ms = Date.now() - t0;
  const summary = {
    suministros: {
      creados: idsCreados.suministros.length,
      actualizados: idsActualizados.suministros.length,
      huerfanos: plan.suministros.huerfanos.length
    },
    marcas: { creadas: idsCreados.marcas.length }
  };
  const auditPayload = {
    accion: 'bulk_import_suministros',
    fuente_xlsm_sha256: hashes && hashes.xlsm || '',
    summary,
    ids_creados: idsCreados,
    ids_actualizados: idsActualizados,
    huerfanos: {
      suministros: plan.suministros.huerfanos
    },
    duracion_ms,
    dryRun,
    uid: uid || null,
    at: serverTimestamp(),
    at_iso: new Date().toISOString()
  };
  let auditId = null;
  if (!dryRun) {
    try {
      const aref = await addDoc(collection(d, COL_AUDIT), auditPayload);
      auditId = aref.id;
    } catch (err) {
      console.warn('[importador_suministros.audit] fallo audit (no bloqueante):', err);
    }
  }

  return { dryRun, summary, idsCreados, idsActualizados, auditId, duracion_ms };
}
