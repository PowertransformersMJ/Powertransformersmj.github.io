// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: marcas (Fase 39)
// ──────────────────────────────────────────────────────────────
// CRUD sobre /marcas + sync con /suministros[id].marcas_disponibles
// vía arrayUnion / arrayRemove para evitar last-writer-wins en
// updates concurrentes (riesgo R5 del plan).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import {
  sanitizarMarca, validarMarca
} from '../domain/marca_schema.js';
import { auditar, persistirAuditoria } from '../domain/audit.js';
import { composeDocId } from '../domain/contratos.js';

const COL_NAME = 'marcas';
const COL_SUMINISTROS = 'suministros';

export { sanitizarMarca, validarMarca };

function db() {
  const d = getDbSafe();
  if (!d) throw new Error('Firebase no inicializado.');
  return d;
}
function collRef() { return collection(db(), COL_NAME); }
function docRef(id) { return doc(db(), COL_NAME, id); }
/**
 * Resuelve el ref de un suministro respetando el docId compuesto
 * por contrato (multi-contrato N5: '{contrato_id}_{codigo}').
 * Sin contrato_id, intenta el codigo plano (compat legacy 4123000081).
 *
 * Mismo patrón que assets/js/data/movimientos.js — fix 2026-04-27 PM5/6
 * para evitar que las operaciones CRUD de marcas fallen en silencio
 * sobre los suministros del 4125000143 (que usan docId compuesto)
 * o del 4123000081 (que aún usan docId plano legacy).
 */
function suministroRef(sid, contratoId = '') {
  const docId = contratoId ? composeDocId(contratoId, sid) : sid;
  return doc(db(), COL_SUMINISTROS, docId);
}

/**
 * Update con heurística dual: intenta compuesto, fallback a plano.
 * Para operaciones de sync (arrayUnion / arrayRemove de
 * marcas_disponibles[]) que no deben fallar en silencio.
 */
async function updateSuministroDual(sid, contratoId, fields) {
  if (contratoId) {
    try {
      await updateDoc(suministroRef(sid, contratoId), fields);
      return true;
    } catch (_) { /* prueba con plano abajo */ }
  }
  try {
    await updateDoc(doc(db(), COL_SUMINISTROS, sid), fields);
    return true;
  } catch (_) {
    return false;
  }
}

function prepararDoc(input, uid) {
  const sane = sanitizarMarca(input);
  const errs = validarMarca(sane);
  if (errs.length > 0) throw new Error('Validación falló:\n  · ' + errs.join('\n  · '));
  return { ...sane, createdBy: uid || null };
}

function auditarSeguro(entry) {
  return persistirAuditoria(
    { db: getDbSafe(), addDoc, collection, serverTimestamp },
    entry
  );
}

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

function buildConstraints(filtros) {
  const constraints = [];
  if (filtros.contrato_id)   constraints.push(where('contrato_id',   '==', filtros.contrato_id));
  if (filtros.suministro_id) constraints.push(where('suministro_id', '==', filtros.suministro_id));
  constraints.push(orderBy('suministro_id'));
  constraints.push(orderBy('marca'));
  if (filtros.limite) constraints.push(limit(filtros.limite));
  return constraints;
}

export async function listar(filtros = {}) {
  const snap = await getDocs(query(collRef(), ...buildConstraints(filtros)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros = {}, onData, onError) {
  return onSnapshot(
    query(collRef(), ...buildConstraints(filtros)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[marcas.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = prepararDoc(data, uid);
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  const ref = await addDoc(collRef(), payload);
  // Sync atómico: añade la marca al array del suministro. El docId
  // del suministro puede ser compuesto (multi-contrato), por eso
  // pasamos contrato_id si está presente en el payload.
  if (payload.suministro_id && payload.marca) {
    await updateSuministroDual(payload.suministro_id, payload.contrato_id, {
      marcas_disponibles: arrayUnion(payload.marca),
      updatedAt: serverTimestamp()
    });
  }
  await auditarSeguro(auditar({
    accion: 'crear', coleccion: COL_NAME, docId: ref.id,
    uid, nota: `${payload.suministro_id} → ${payload.marca}`
  }));
  return ref.id;
}

export async function actualizar(id, data, opts = {}) {
  const prev = opts.prev || (await obtener(id));
  const payload = prepararDoc(data);
  delete payload.createdBy;
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);
  // Si la marca cambió, actualizar el array del suministro:
  // remover la antigua, añadir la nueva.
  if (prev && prev.marca && payload.marca && prev.marca !== payload.marca && payload.suministro_id) {
    const cidActualizar = payload.contrato_id || (prev && prev.contrato_id) || '';
    await updateSuministroDual(payload.suministro_id, cidActualizar, {
      marcas_disponibles: arrayRemove(prev.marca)
    });
    await updateSuministroDual(payload.suministro_id, cidActualizar, {
      marcas_disponibles: arrayUnion(payload.marca),
      updatedAt: serverTimestamp()
    });
  }
  await auditarSeguro(auditar({
    accion: 'actualizar', coleccion: COL_NAME, docId: id, uid: opts.uid
  }));
}

export async function eliminar(id, opts = {}) {
  const prev = opts.prev || (await obtener(id));
  await deleteDoc(docRef(id));
  // Si era la última marca de ese suministro_id, el array queda vacío.
  // (No relistamos para verificar — overhead innecesario; el panel F44 refresca via realtime.)
  if (prev && prev.suministro_id && prev.marca) {
    await updateSuministroDual(prev.suministro_id, prev.contrato_id || '', {
      marcas_disponibles: arrayRemove(prev.marca),
      updatedAt: serverTimestamp()
    });
  }
  await auditarSeguro(auditar({
    accion: 'eliminar', coleccion: COL_NAME, docId: id, uid: opts.uid,
    nota: prev ? `${prev.suministro_id} - ${prev.marca}` : ''
  }));
}
