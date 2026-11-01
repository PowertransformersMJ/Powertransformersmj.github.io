// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Rastro de actividad del visitante: lectura y borrado (admin) · `99 §199`
// ──────────────────────────────────────────────────────────────
// `actividad_visitante/{uid}/eventos`: solo el administrador lee y borra (firestore.rules). Lo usan el
// panel admin/actividad-visitante.html y la eliminación de una cuenta (data/usuarios.js#eliminar): el
// rastro se conserva mientras la cuenta exista. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { getDbSafe } from '../firebase-init.js';
import { auditar } from '../domain/audit.js';

const FS = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const LOTE = 400;

/**
 * Eventos del visitante, más recientes primero. Con `desdeMs`, solo desde esa fecha (la consulta la
 * filtra el servidor: no se lee lo que no se va a mostrar).
 */
export async function leerEventos(uid, { desdeMs = 0, tope = 2000 } = {}) {
  const { collection, query, where, orderBy, limit, getDocs, Timestamp } = await import(FS);
  const col = collection(getDbSafe(), 'actividad_visitante', uid, 'eventos');
  const partes = [];
  if (desdeMs) partes.push(where('en', '>=', Timestamp.fromMillis(desdeMs)));
  partes.push(orderBy('en', 'desc'), limit(tope));
  const snap = await getDocs(query(col, ...partes));
  return { eventos: snap.docs.map((d) => ({ id: d.id, ...d.data() })), truncado: snap.size >= tope };
}

/** Borra TODO el rastro de un uid (en lotes) y lo anota en Auditoría. Devuelve cuántos borró. */
export async function borrarRastro(uid, { actorUid = null } = {}) {
  if (!uid) return 0;
  const { collection, query, limit, getDocs, writeBatch, addDoc, serverTimestamp } = await import(FS);
  const db = getDbSafe();
  let total = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, 'actividad_visitante', uid, 'eventos'), limit(LOTE)));
    if (snap.empty) break;
    const b = writeBatch(db);
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    total += snap.size;
  }
  if (total) {
    try {
      await addDoc(collection(db, 'auditoria'), { ...auditar({ accion: 'eliminar', coleccion: 'actividad_visitante', docId: uid,
        uid: actorUid, nota: `Rastro de actividad del visitante: ${total} acciones borradas` }), at: serverTimestamp() });
    } catch (_) { /* best-effort, como el resto de la auditoría */ }
  }
  return total;
}
