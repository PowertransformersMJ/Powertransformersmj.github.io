// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: transformadores (schema v2)
// ──────────────────────────────────────────────────────────────
// Fase 16: se reemplaza el shape plano v1 por el documento v2
// estructurado en secciones (identificacion, placa, ubicacion,
// electrico, mecanico, refrigeracion, protecciones, fabricacion,
// servicio) más los snapshots derivados (salud_actual, criticidad).
//
// Compat con v1: la API sigue exportando `listar`, `suscribir`,
// `obtener`, `crear`, `actualizar`, `eliminar`, `contarPorEstado`
// con la MISMA firma; internamente normaliza entradas y vuelca
// una proyección v1 al nivel raíz de cada documento para que las
// vistas legacy (Inventario UI, KPIs, Mapa, Alertas) sigan
// funcionando sin tocar código. Las vistas se irán migrando
// progresivamente en F19–F27.
//
// Referencia normativa: MO.00418.DE-GAC-AX.01 Ed. 02.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  getCountFromServer,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { conLimite, LIMITE_TRANSFORMADORES } from '../domain/limites_lectura.js';
import {
  sanitizarTransformador, validarTransformador, proyeccionV1
} from '../domain/transformador_schema.js';
import {
  ESTADOS_SERVICIO, DEPARTAMENTOS,
  estadoServicioLabel, departamentoLabel
} from '../domain/schema.js';
import { auditar, diffSimple, persistirAuditoria } from '../domain/audit.js';

const COL_NAME = 'transformadores';

// Re-export del tope para que las vistas puedan pedirlo explícito y
// compararlo (SSoT del número: domain/limites_lectura.js).
export { LIMITE_TRANSFORMADORES };

// ── Re-exports para compat con llamadores v1 ───────────────────
// Mapeo v1.ESTADOS → v2.ESTADOS_SERVICIO (mismas `value`,
// extiende con 'fallado'). Admin UI antigua seguirá leyendo los 4
// estados que conocía; 'fallado' aparecerá solo en vistas nuevas.
export const ESTADOS = ESTADOS_SERVICIO;
export { DEPARTAMENTOS };
export { estadoServicioLabel as estadoLabel, departamentoLabel };

// ── Helpers internos ───────────────────────────────────────────
function collRef() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, COL_NAME);
}
function docRef(id) {
  return doc(getDbSafe(), COL_NAME, id);
}

function prepararDoc(input, uid) {
  // 1. Sanitiza a la forma v2.
  const docV2 = sanitizarTransformador(input);
  // 2. Valida invariantes duros. Lanza si falla.
  const errs = validarTransformador(docV2);
  if (errs.length > 0) {
    const msg = 'Validación v2 falló:\n  · ' + errs.join('\n  · ');
    throw new Error(msg);
  }
  // 3. Inyecta proyección v1 en el nivel raíz para compat con
  //    vistas legacy. Se sobrescribe en cada write — las vistas
  //    nuevas deben leer desde las secciones (identificacion,
  //    placa, ...), no del nivel raíz.
  const flat = proyeccionV1(docV2);
  // 4. Metadatos de auditoría.
  return {
    ...docV2,
    ...flat,
    createdBy: uid || null
  };
}

// ── API pública ────────────────────────────────────────────────

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

/**
 * Lista transformadores con filtros básicos. La firma se mantiene
 * idéntica a v1 (usa campos aplanados en el nivel raíz por la
 * proyección v1). Las vistas nuevas deben migrar a `listarV2`.
 */
export async function listar(filtrosIn = {}) {
  // Tope por defecto: en Firestore se paga por documento leído, así que
  // ninguna consulta sale sin `limit()` (ver domain/limites_lectura.js).
  const filtros = conLimite(filtrosIn, LIMITE_TRANSFORMADORES);
  const constraints = [];
  if (filtros.departamento) constraints.push(where('departamento', '==', filtros.departamento));
  if (filtros.estado)       constraints.push(where('estado',       '==', filtros.estado));
  constraints.push(orderBy('codigo'));
  constraints.push(limit(filtros.limite));

  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Variante v2 para vistas nuevas. Filtros por sección.
 *   { zona, tipo_activo, grupo, bucket } — subset de filtros v2.
 */
export async function listarV2(filtrosIn = {}) {
  const filtros = conLimite(filtrosIn, LIMITE_TRANSFORMADORES);
  const constraints = [];
  if (filtros.zona)        constraints.push(where('ubicacion.zona',        '==', filtros.zona));
  if (filtros.tipo_activo) constraints.push(where('identificacion.tipo_activo', '==', filtros.tipo_activo));
  if (filtros.grupo)       constraints.push(where('identificacion.grupo',  '==', filtros.grupo));
  if (filtros.bucket)      constraints.push(where('salud_actual.bucket',   '==', filtros.bucket));
  if (filtros.subestacionId) constraints.push(where('ubicacion.subestacionId', '==', filtros.subestacionId));
  constraints.push(orderBy('codigo'));
  constraints.push(limit(filtros.limite));

  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * TODO-09: fuente REAL del dashboard de Salud de Activos
 * (`pages/parque-transformadores.html` vía `window.SGM_DATA_SOURCE`).
 * Una sola lectura one-shot con límite (free-tier); el mapeo a filas
 * del dashboard es dominio puro (`domain/parque_salud.js`, testeado).
 */
export async function listarTransformadoresSalud() {
  const { filasParque } = await import('../domain/parque_salud.js');
  const txs = await listarV2({ limite: 500 });
  return filasParque(txs);
}

/**
 * Suscripción realtime (v1-compat). Mantiene la firma de F15.
 */
export function suscribir(filtrosIn = {}, onData, onError) {
  // Un onSnapshot SIN tope es el peor caso de costo: cada escritura de un
  // solo documento reenvía la colección entera a TODAS las pestañas
  // abiertas. El tope por defecto acota ese reenvío.
  const filtros = conLimite(filtrosIn, LIMITE_TRANSFORMADORES);
  const constraints = [];
  if (filtros.departamento) constraints.push(where('departamento', '==', filtros.departamento));
  if (filtros.estado)       constraints.push(where('estado',       '==', filtros.estado));
  constraints.push(orderBy('codigo'));
  constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[transformadores.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

function auditarSeguro(entry) {
  return persistirAuditoria(
    { db: getDbSafe(), addDoc, collection, serverTimestamp },
    entry
  );
}

export async function crear(data, uid) {
  const payload = prepararDoc(data, uid);
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  const ref = await addDoc(collRef(), payload);
  await auditarSeguro(auditar({
    accion: 'crear', coleccion: 'transformadores', docId: ref.id,
    uid, nota: `Alta de ${payload.codigo || ref.id}`
  }));
  return ref.id;
}

export async function actualizar(id, data, opts = {}) {
  // `actualizar` en v1 era un full replace del sanitizador v1;
  // en v2 hacemos lo mismo: rehidrata el documento canónico y
  // escribe todo. Los callers que quieran updates parciales
  // (p.ej. solo `estado_servicio`) deben usar `actualizarParcial`.
  const prev = opts.prev || (await obtener(id));
  const payload = prepararDoc(data);
  delete payload.createdBy;
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);
  // Audit con diff de campos relevantes (raíz)
  const camposClave = ['codigo','estado','potencia_kva','tension_primaria_kv',
                        'tension_secundaria_kv','marca','modelo','serial',
                        'fecha_fabricacion','fecha_instalacion'];
  const a = {}; const b = {};
  for (const k of camposClave) { if (prev) a[k] = prev[k]; b[k] = payload[k]; }
  await auditarSeguro(auditar({
    accion: 'actualizar', coleccion: 'transformadores', docId: id,
    uid: opts.uid, diff: diffSimple(a, b)
  }));
}

/**
 * Update parcial que respeta el shape v2. Recibe un objeto con
 * rutas dot-notation o secciones completas.
 */
export async function actualizarParcial(id, parches) {
  const payload = { ...parches, updatedAt: serverTimestamp() };
  await updateDoc(docRef(id), payload);
}

export async function eliminar(id, opts = {}) {
  const prev = opts.prev || (await obtener(id));
  await deleteDoc(docRef(id));
  await auditarSeguro(auditar({
    accion: 'eliminar', coleccion: 'transformadores', docId: id,
    uid: opts.uid, nota: prev ? `Codigo eliminado: ${prev.codigo}` : ''
  }));
}

// ── Stats para KPIs (compat v1) ────────────────────────────────
/**
 * Total REAL de transformadores sin traerse los documentos.
 * `getCountFromServer` es una consulta de agregación: cobra ~1 lectura
 * por cada 1000 documentos contados en vez de 1 por documento. Es la
 * alternativa correcta cuando una vista necesita el total y no la lista.
 *
 * @returns {Promise<number>}
 */
export async function contarTotal() {
  const snap = await getCountFromServer(query(collRef()));
  return snap.data().count;
}

export async function contarPorEstado() {
  const items = await listar({});
  const acc = { operativo: 0, mantenimiento: 0, fuera_servicio: 0, retirado: 0, fallado: 0 };
  for (const t of items) { if (acc[t.estado] != null) acc[t.estado] += 1; }
  return { total: items.length, ...acc };
}

// ── Re-exports del dominio para quienes ya trabajan en v2 ──────
export {
  sanitizarTransformador,
  validarTransformador,
  proyeccionV1
};
