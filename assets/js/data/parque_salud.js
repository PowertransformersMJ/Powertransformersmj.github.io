// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Parque · Data layer (Firestore realtime)
// ──────────────────────────────────────────────────────────────
// Suscripción onSnapshot a /transformadores que entrega filas
// con el shape plano que el dashboard espera. Si Firestore no
// está configurado o devuelve dataset vacío, cae al baseline
// local (`assets/data/parque-salud-baseline.json`) que contiene
// el extracto fiel del Excel "Salud de Activos 2026.xlsx".
//
// Forma de cada fila entregada (`SaludActivoRow`):
//   {
//     codigo, matricula, serie, subestacion, zona, departamento,
//     municipio, tipo_activo,
//     mva,
//     calif_dga, calif_adfq, calif_fur, calif_crg, calif_pyt,
//     calif_edad, calif_her, calif_c2h2,
//     condicion,                       // valor "raw" 1..5 del doc
//     hi, bucket, condicion_raw,       // derivados via `normalize`
//     usuarios_aguas_abajo,
//     aliado, causante, macroactividad,
//     det,                             // gases, rigidez, etc. (opcional)
//   }
//
// API:
//   - suscribirParqueSalud(onData, onError) → fn unsubscribe
//   - cargarBaselineLocal()                 → Promise<rows>
//   - cargarParqueSalud()                   → Promise<{rows, src}>
// ══════════════════════════════════════════════════════════════

import { isFirebaseConfigured } from '../firebase-config.js';
import { getDbSafe } from '../firebase-init.js';
import {
  collection, query, where, orderBy, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalize } from './parque_salud_excel.js';

const BASELINE_URL = new URL('../../data/parque-salud-baseline.json', import.meta.url).href;

// ── Adapter docV2 → fila plana del dashboard ──────────────────
// El motor F18 escribe `salud_actual.calif_*` + `hi_final`.
// El detalle (gases, rigidez, etc.) puede vivir en
// `salud_actual.detalle` cuando provenga del Excel original.
function docV2ToDashboard(docV2) {
  const id          = docV2.identificacion       || {};
  const ubi         = docV2.ubicacion            || {};
  const elec        = docV2.electrico            || {};
  const salud       = docV2.salud_actual         || {};
  const criticidad  = docV2.criticidad           || {};
  const detalle     = salud.detalle              || docV2.det || null;

  // MVA = potencia_kva / 1000 cuando viene en kVA del schema v2.
  let mva = null;
  if (elec.potencia_kva != null) mva = +elec.potencia_kva / 1000;
  else if (docV2.mva != null) mva = +docV2.mva;
  else if (docV2.potencia != null) mva = +docV2.potencia;

  const codigo = id.codigo || docV2.codigo || docV2.id || '';
  return {
    codigo,
    matricula:   id.matricula || docV2.matricula || codigo || '—',
    serie:       id.serie || docV2.serie || null,
    subestacion: ubi.subestacion || docV2.subestacion || null,
    zona:        ubi.zona || docV2.zona || '',
    departamento: ubi.departamento || docV2.departamento || '',
    municipio:   ubi.municipio || docV2.municipio || null,
    tipo_activo: id.tipo_activo || docV2.tipo_activo || 'TX_Potencia',
    mva,
    calif_dga:  salud.calif_dga  ?? docV2.calif_dga  ?? null,
    calif_adfq: salud.calif_adfq ?? docV2.calif_adfq ?? null,
    calif_fur:  salud.calif_fur  ?? docV2.calif_fur  ?? null,
    calif_crg:  salud.calif_crg  ?? docV2.calif_crg  ?? null,
    calif_pyt:  salud.calif_pyt  ?? docV2.calif_pyt  ?? null,
    calif_edad: salud.calif_edad ?? docV2.calif_edad ?? null,
    calif_her:  salud.calif_her  ?? docV2.calif_her  ?? null,
    calif_c2h2: salud.calif_c2h2 ?? docV2.calif_c2h2 ?? null,
    condicion:  salud.hi_final ?? salud.hi_bruto ?? docV2.condicion ?? null,
    usuarios_aguas_abajo: criticidad.usuarios_aguas_abajo
                       ?? docV2.usuarios_aguas_abajo
                       ?? 0,
    aliado:        docV2.aliado || null,
    causante:      docV2.causante || null,
    macroactividad: docV2.macroactividad || null,
    det: detalle,
  };
}

// ── Cargador del baseline local ───────────────────────────────
export async function cargarBaselineLocal() {
  const res = await fetch(BASELINE_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Baseline local no disponible (HTTP ' + res.status + ')');
  const rows = await res.json();
  return normalize(Array.isArray(rows) ? rows : []);
}

// ── Helper isReady (en línea con otros data layers) ───────────
function firestoreListo() {
  return isFirebaseConfigured && !!getDbSafe();
}

// ── Suscripción realtime ──────────────────────────────────────
// onData(rows, src) se invoca cada vez que cambia la colección.
//   src ∈ { 'firestore', 'baseline', 'empty' }
//
// Mientras carga el primer snapshot (o si Firestore está caído)
// se intenta cargar el baseline local de inmediato para que el
// usuario vea el parque sin esperar. Luego onData se vuelve a
// invocar cuando Firestore entregue datos reales (si los hay).
export function suscribirParqueSalud(onData, onError) {
  let unsubFirestore = null;
  let resuelto = false;

  // Boot inmediato: baseline local (si Firestore aún no respondió)
  cargarBaselineLocal()
    .then(rows => {
      if (!resuelto) onData(rows, 'baseline');
    })
    .catch(err => {
      console.warn('[parque_salud] baseline local no disponible:', err);
      if (!resuelto) onData([], 'empty');
    });

  // Realtime Firestore
  if (firestoreListo()) {
    try {
      const db = getDbSafe();
      const ref = collection(db, 'transformadores');
      // Solo activos en operación o mantenimiento — el dashboard
      // de salud no muestra retirados.
      const q = query(
        ref,
        where('estado_servicio', 'in', ['operativo', 'mantenimiento', 'fuera_servicio']),
        orderBy('identificacion.codigo')
      );
      unsubFirestore = onSnapshot(
        q,
        async (snap) => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (docs.length === 0) {
            // Firestore vacío: mantén el baseline ya entregado.
            // No emitimos otra vez para no parpadear.
            resuelto = true;
            return;
          }
          const rows = normalize(docs.map(docV2ToDashboard));
          resuelto = true;
          onData(rows, 'firestore');
        },
        (err) => {
          console.warn('[parque_salud] onSnapshot error:', err);
          if (onError) onError(err);
        }
      );
    } catch (err) {
      console.warn('[parque_salud] no se pudo abrir suscripción Firestore:', err);
      if (onError) onError(err);
    }
  }

  return function unsubscribe() {
    if (unsubFirestore) {
      try { unsubFirestore(); } catch (_) { /* noop */ }
      unsubFirestore = null;
    }
  };
}

// ── One-shot (legacy): Firestore o baseline ──────────────────
// Compat con el comportamiento original de `loadData()` del
// archivo standalone. Útil para tests / exports.
export async function cargarParqueSalud() {
  if (firestoreListo()) {
    try {
      const db = getDbSafe();
      const snap = await getDocs(query(
        collection(db, 'transformadores'),
        orderBy('identificacion.codigo')
      ));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (docs.length) {
        return { rows: normalize(docs.map(docV2ToDashboard)), src: 'firestore' };
      }
    } catch (err) {
      console.warn('[parque_salud] cargarParqueSalud Firestore falló:', err);
    }
  }
  try {
    const rows = await cargarBaselineLocal();
    return { rows, src: rows.length ? 'baseline' : 'empty' };
  } catch (_) {
    return { rows: [], src: 'empty' };
  }
}

// ── Re-export del adapter (testeable desde tests) ─────────────
export { docV2ToDashboard };
