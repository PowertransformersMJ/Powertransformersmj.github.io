// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: órdenes de trabajo (F7 → F23 v2)
// ──────────────────────────────────────────────────────────────
// Firmas v1 preservadas para vistas legacy (kpis, alertas,
// admin-ordenes, ordenes-public). F23 extiende el shape con FKs
// a macroactividades/contratos/causantes y workflow de 11 estados,
// proyectando los estados v1 (planificada/en_curso/cerrada/
// cancelada) en el nivel raíz para que las consultas legacy
// sigan funcionando.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  getCountFromServer,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { conLimite, LIMITE_ORDENES } from '../domain/limites_lectura.js';
import {
  sanitizarOrden, validarOrden, transicionValida,
  ESTADOS_ORDEN_V2, ESTADOS_ORDEN_V1,
  TIPOS_ORDEN as TIPOS_ORDEN_V2, PRIORIDADES as PRIORIDADES_V2
} from '../domain/orden_schema.js';
import { puedeTransicionar, PERMISOS_TRANSICION } from '../domain/workflow.js';
import { auditar, persistirAuditoria } from '../domain/audit.js';

const COL_NAME = 'ordenes';

// Re-export del tope para que las vistas puedan pedirlo explícito y
// compararlo (SSoT del número: domain/limites_lectura.js).
export { LIMITE_ORDENES };

// ── Enumeraciones v1-compat ──
// Para vistas legacy que esperan los 4 estados. La proyección
// v1 se calcula a partir del estado v2 en `proyectarV1`.
// La lista vive ahora en `domain/orden_schema.js` (enumeración de dominio
// puro, legible sin cargar Firebase). Se re-exporta con el mismo nombre para
// no tocar ningún llamador.
export const ESTADOS_ORDEN = ESTADOS_ORDEN_V1;
export const TIPOS_ORDEN  = TIPOS_ORDEN_V2;
export const PRIORIDADES  = PRIORIDADES_V2;

export function estadoOrdenLabel(v) {
  const e = ESTADOS_ORDEN.find((x) => x.value === v);
  if (e) return e.label;
  const e2 = ESTADOS_ORDEN_V2.find((x) => x.value === v);
  return e2 ? e2.label : v || '—';
}
export function tipoLabel(v) {
  const t = TIPOS_ORDEN_V2.find((x) => x.value === v);
  return t ? t.label : v || '—';
}
export function prioridadLabel(v) {
  const p = PRIORIDADES_V2.find((x) => x.value === v);
  return p ? p.label : v || '—';
}

function collRef() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, COL_NAME);
}
function docRef(id) { return doc(getDbSafe(), COL_NAME, id); }
function historialRef(id) { return collection(getDbSafe(), COL_NAME, id, 'historial'); }

// v2 → v1 estado (para que queries legacy sigan funcionando)
function estadoV1Desde(estadoV2) {
  switch (estadoV2) {
    case 'borrador':
    case 'propuesta':
    case 'revisada':
    case 'autorizada':
    case 'programada':
      return 'planificada';
    case 'en_ejecucion':
      return 'en_curso';
    case 'ejecutada':
    case 'verificada':
    case 'cerrada':
      return 'cerrada';
    case 'rechazada':
    case 'cancelada':
    default:
      return 'cancelada';
  }
}

function proyectarV1(docV2) {
  return {
    // Campos v1 compat (aplanados a nivel raíz para queries legacy).
    codigo: docV2.codigo,
    titulo: docV2.titulo,
    descripcion: docV2.descripcion,
    transformadorId: docV2.transformadorId,
    transformadorCodigo: docV2.transformadorCodigo,
    tipo: docV2.tipo,
    prioridad: docV2.prioridad,
    estado: estadoV1Desde(docV2.estado),
    tecnico: docV2.tecnico,
    fecha_programada: docV2.fecha_programada,
    fecha_inicio: docV2.fecha_inicio,
    fecha_cierre: docV2.fecha_cierre,
    duracion_horas: docV2.duracion_horas,
    observaciones: docV2.observaciones
  };
}

function preparar(data) {
  const v2 = sanitizarOrden(data);
  const errs = validarOrden(v2);
  if (errs.length) throw new Error('Validación orden:\n  · ' + errs.join('\n  · '));
  const v1 = proyectarV1(v2);
  return {
    ...v2,
    ...v1,
    // `estado` en nivel raíz = v1 para compat; `estado_v2` lleva el estado real.
    estado: v1.estado,
    estado_v2: v2.estado
  };
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

export async function listar(filtrosIn = {}) {
  // Tope por defecto: las órdenes crecen sin techo con el histórico y en
  // Firestore se paga por documento leído (ver domain/limites_lectura.js).
  const filtros = conLimite(filtrosIn, LIMITE_ORDENES);
  const constraints = [];
  if (filtros.estado)          constraints.push(where('estado',          '==', filtros.estado));
  if (filtros.estado_v2)       constraints.push(where('estado_v2',       '==', filtros.estado_v2));
  if (filtros.tipo)            constraints.push(where('tipo',            '==', filtros.tipo));
  if (filtros.prioridad)       constraints.push(where('prioridad',       '==', filtros.prioridad));
  if (filtros.transformadorId) constraints.push(where('transformadorId', '==', filtros.transformadorId));
  if (filtros.contratoId)      constraints.push(where('contratoId',      '==', filtros.contratoId));
  if (filtros.macroactividadId) constraints.push(where('macroactividadId','==', filtros.macroactividadId));
  constraints.push(orderBy('codigo', 'desc'));
  constraints.push(limit(filtros.limite));
  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtrosIn = {}, onData, onError) {
  // Un onSnapshot SIN tope reenvía la colección entera a cada pestaña
  // abierta en CADA escritura. El tope por defecto acota ese reenvío;
  // el orden es `codigo` descendente, o sea las órdenes más recientes.
  const filtros = conLimite(filtrosIn, LIMITE_ORDENES);
  const constraints = [];
  if (filtros.estado)          constraints.push(where('estado',          '==', filtros.estado));
  if (filtros.tipo)            constraints.push(where('tipo',            '==', filtros.tipo));
  if (filtros.prioridad)       constraints.push(where('prioridad',       '==', filtros.prioridad));
  if (filtros.transformadorId) constraints.push(where('transformadorId', '==', filtros.transformadorId));
  constraints.push(orderBy('codigo', 'desc'));
  constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[ordenes.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/**
 * Total REAL de órdenes sin traerse los documentos.
 * `getCountFromServer` es una consulta de agregación: cobra ~1 lectura
 * por cada 1000 documentos contados. Úsala cuando una vista necesite el
 * total; NUNCA levantes el tope de `listar`/`suscribir` para contar.
 *
 * @param {{estado?: string, tipo?: string}} [filtros]
 * @returns {Promise<number>}
 */
export async function contarTotal(filtros = {}) {
  const constraints = [];
  if (filtros.estado) constraints.push(where('estado', '==', filtros.estado));
  if (filtros.tipo)   constraints.push(where('tipo',   '==', filtros.tipo));
  const snap = await getCountFromServer(query(collRef(), ...constraints));
  return snap.data().count;
}

function auditarSeguro(entry) {
  return persistirAuditoria(
    { db: getDbSafe(), addDoc, collection, serverTimestamp },
    entry
  );
}

export async function crear(data, uid) {
  const payload = preparar(data);
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  payload.createdBy = uid || null;
  const ref = await addDoc(collRef(), payload);
  await registrarEvento(ref.id, {
    tipo_evento: 'creacion',
    estado_nuevo: payload.estado_v2,
    nota: 'Orden creada (schema v2).',
    uid: uid || null
  });
  await auditarSeguro(auditar({
    accion: 'crear', coleccion: 'ordenes', docId: ref.id,
    uid, nota: `Alta de ${payload.codigo} (${payload.tipo}/${payload.prioridad})`
  }));
  return ref.id;
}

export async function actualizar(id, data, uid, rol) {
  const prev = await obtener(id);
  const payload = preparar(data);
  // Validar transición de estado si hubo cambio
  if (prev && prev.estado_v2 && payload.estado_v2 !== prev.estado_v2) {
    if (!transicionValida(prev.estado_v2, payload.estado_v2)) {
      throw new Error(
        `Transición no válida: ${prev.estado_v2} → ${payload.estado_v2}. ` +
        `Permitidas desde '${prev.estado_v2}': ver orden_schema.TRANSICIONES_VALIDAS.`
      );
    }
    // FASE C (G014) — feedback temprano de rol-por-transición. Aditivo y
    // backward-compatible: solo aplica si se pasó `rol` Y la transición tiene
    // política de rol (una transición válida en la máquina sin política NO se
    // bloquea aquí). El enforcement REAL es server-side en firestore.rules
    // (FASE D pendiente); esto es solo feedback en cliente, nunca la única
    // barrera. `admin` está en todas las políticas → nunca se bloquea.
    if (rol && PERMISOS_TRANSICION[`${prev.estado_v2}:${payload.estado_v2}`]) {
      const permiso = puedeTransicionar(prev.estado_v2, payload.estado_v2, rol);
      if (!permiso.ok) throw new Error(permiso.razon);
    }
  }
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);

  if (prev && prev.estado_v2 !== payload.estado_v2) {
    await registrarEvento(id, {
      tipo_evento: 'cambio_estado',
      estado_previo: prev.estado_v2 || prev.estado,
      estado_nuevo:  payload.estado_v2,
      nota: 'Cambio de estado.',
      uid: uid || null
    });
    await auditarSeguro(auditar({
      accion: 'cambiar_estado_orden', coleccion: 'ordenes', docId: id,
      uid,
      diff: { estado_v2: { antes: prev.estado_v2, despues: payload.estado_v2 } }
    }));
  } else {
    await auditarSeguro(auditar({
      accion: 'actualizar', coleccion: 'ordenes', docId: id, uid
    }));
  }
}

export async function eliminar(id, opts = {}) {
  await deleteDoc(docRef(id));
  await auditarSeguro(auditar({
    accion: 'eliminar', coleccion: 'ordenes', docId: id, uid: opts.uid
  }));
}

export async function registrarEvento(ordenId, evento) {
  const payload = {
    tipo_evento:   String(evento.tipo_evento || 'nota'),
    estado_previo: evento.estado_previo || null,
    estado_nuevo:  evento.estado_nuevo  || null,
    nota:          String(evento.nota   || ''),
    uid:           evento.uid || null,
    at:            serverTimestamp()
  };
  await addDoc(historialRef(ordenId), payload);
}

export async function listarHistorial(ordenId) {
  const snap = await getDocs(query(historialRef(ordenId), orderBy('at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function contarPorEstado() {
  const items = await listar({});
  const acc = { planificada: 0, en_curso: 0, cerrada: 0, cancelada: 0 };
  for (const o of items) { if (acc[o.estado] != null) acc[o.estado] += 1; }
  return { total: items.length, ...acc };
}

// Re-exports v2 para quienes ya trabajan en el nuevo schema
export { sanitizarOrden, validarOrden, transicionValida, ESTADOS_ORDEN_V2 };
