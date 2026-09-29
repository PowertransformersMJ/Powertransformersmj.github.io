// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «Diagrama Operativo» (I/O) · ADR-112
// ──────────────────────────────────────────────────────────────
// Firestore `fichas_adjuntos/{id}` (meta) + `partes/{0..2}` (la imagen APROBADA,
// en trozos ≤ 900 KB atados por `lote`) + `fichas_adjuntos_registro` (solo se
// agrega: alta / reemplazo / retiro, sin bytes). Un adjunto por transformador;
// el id sale de su identidad persistente (domain/fichas_adjunto.js).
// Reglas y pruebas: firestore.rules, tests-rules/fichas_adjuntos.rules.test.js.
//
// Por qué Firestore y no Storage: en producción Storage niega toda descarga al
// navegador (`99 §100`). Lectura SIEMPRE con la sesión; nunca URL pública.
// «No hay» ≠ «no se pudo leer» (revisión de §99). Caché en memoria por huella:
// la segunda exportación no vuelve a bajar las partes.
// Escribe el administrador o quien tenga el permiso «adjuntar el Diagrama Operativo» en su
// perfil (`99 §118`, solo alta y reemplazo); quitar, solo el administrador.
// Este módulo se carga con import() dinámico desde la página de Fichas.
// ══════════════════════════════════════════════════════════════

import {
  doc, getDoc, writeBatch, serverTimestamp, Bytes
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { puedeAdjuntarOperativo, puedeQuitarOperativo } from '../domain/permiso_operativo.js';
import {
  COLECCION, COLECCION_REGISTRO, PARTES_MAX, partir, unir, huellaHex, loteNuevo, nombreSeguro
} from '../domain/fichas_adjunto.js';

/** Sesión VIVA (la del guard y la de Auth coinciden) cuyo perfil cumple `permite` (la regla lo vuelve a exigir). */
function sesionQue(permite) {
  const s = getSession();
  const uid = (s && s.user && s.user.uid) || null;
  if (!uid) return null;
  try {
    const auth = getAuthSafe();
    if (auth && (!auth.currentUser || auth.currentUser.uid !== uid)) return null;
  } catch (_) { /* sin Auth manda la sesión publicada */ }
  const p = (s && s.profile) || {};
  if (!permite(p)) return null;
  return { uid, nombre: p.nombre || '' };
}
/** Adjunta o reemplaza: el administrador, o quien tenga el permiso en su perfil (`99 §118`). */
const quienAdjunta = () => sesionQue(puedeAdjuntarOperativo);
/** Quita: solo el administrador. */
const administrador = () => sesionQue(puedeQuitarOperativo);

/** ¿Hay base de datos? (para leer basta ser del equipo; la regla lo exige). */
export function disponible() { return !!getDbSafe(); }
/** ¿Quien tiene la sesión puede adjuntar o reemplazar? (admin, o con el permiso, `99 §118`) */
export function puedeEscribir() { return !!(getDbSafe() && quienAdjunta()); }
/** ¿Puede quitarlo? Solo el administrador. */
export function puedeQuitar() { return !!(getDbSafe() && administrador()); }

const refMeta = (db, id) => doc(db, COLECCION, id);
const refParte = (db, id, n) => doc(db, COLECCION, id, 'partes', String(n));

/**
 * La meta del adjunto: {hay:false} · {hay:true, meta} · {error:true}.
 * @param {string} id
 */
export async function leerMeta(id) {
  const db = getDbSafe();
  if (!db || !/^salud_[0-9a-f]{64}$/.test(String(id))) return { error: true };
  try {
    const snap = await getDoc(refMeta(db, id));
    if (!snap.exists()) return { hay: false };
    const m = snap.data();
    const en = m.en && typeof m.en.toDate === 'function' ? m.en.toDate() : null;
    return { hay: true, meta: { ...m, en } };
  } catch (e) {
    console.warn('[fichas-adjuntos] meta:', e && e.code || e);
    if (e && /permission-denied/.test(String(e.code))) return { error: true, mensaje: 'Sin permiso para leer el Diagrama Operativo (la sesión venció o no tiene acceso). Recargue la página.' };
    return { error: true };
  }
}

const cache = new Map();   // id → {huella, bytes}

/**
 * Los bytes de la imagen guardada, verificados (mismo lote y misma huella):
 * {bytes} · {error:true, mensaje}.
 */
export async function leerImagen(id, meta) {
  const c = cache.get(id);
  if (c && c.huella === meta.huella) return { bytes: c.bytes };
  const db = getDbSafe();
  if (!db) return { error: true, mensaje: 'Sin conexión con la base de datos.' };
  try {
    const n = Math.max(1, Math.min(PARTES_MAX, +meta.partes || 1));
    const snaps = await Promise.all(Array.from({ length: n }, (_, i) => getDoc(refParte(db, id, i))));
    const partes = [];
    for (const s of snaps) {
      const d = s.exists() ? s.data() : null;
      if (!d || d.lote !== meta.lote || !d.bytes || typeof d.bytes.toUint8Array !== 'function') {
        return { error: true, mensaje: 'El Diagrama Operativo guardado está incompleto (lo están cambiando o se cortó al guardarlo). Vuelva a intentarlo o adjúntelo de nuevo.' };
      }
      partes.push(d.bytes.toUint8Array());
    }
    const bytes = unir(partes);
    if (await huellaHex(bytes) !== meta.huella) return { error: true, mensaje: 'El Diagrama Operativo guardado no coincide con su huella: adjúntelo de nuevo.' };
    cache.set(id, { huella: meta.huella, bytes });
    return { bytes };
  } catch (e) {
    console.warn('[fichas-adjuntos] partes:', e && e.code || e);
    return { error: true, mensaje: 'No se pudo leer el Diagrama Operativo (revise la conexión).' };
  }
}

/** Nombre vigente del perfil: la regla lo compara con /usuarios/{uid}.nombre. */
async function nombreVigente(db, a) {
  try {
    const snap = await getDoc(doc(db, 'usuarios', a.uid));
    return (snap.exists() && snap.data().nombre) || a.nombre || '';
  } catch (_) { return a.nombre || ''; }
}

/**
 * Guarda (o reemplaza) el adjunto en UNA escritura atómica: meta + los 3
 * espacios de parte (escritos o borrados, sin depender de lo leído) + registro.
 * La regla EXIGE el registro con id fijo `{id}_{lote}` (revisión §112: sin él,
 * un cambio no dejaría rastro).
 * @param {{id, clave, matricula, serie}} ident
 * @param {{tipo:'imagen'|'excel', origen:{nombre, hoja?}, mime, ancho, alto, bytes: Uint8Array}} datos
 * @param {object|null} previo  la meta que había (reemplazo) o null (alta)
 * @returns {Promise<object>} la meta guardada
 */
export async function guardar(ident, datos, previo) {
  const db = getDbSafe(); const a = quienAdjunta();
  if (!db || !a) throw new Error('Solo un administrador, o quien él autorice, puede adjuntar o cambiar el Diagrama Operativo.');
  const partes = partir(datos.bytes);
  const lote = loteNuevo(); const huella = await huellaHex(datos.bytes);
  const autor = { uid: a.uid, nombre: await nombreVigente(db, a) };
  const origen = { nombre: nombreSeguro(datos.origen && datos.origen.nombre) };
  if (datos.origen && datos.origen.hoja) origen.hoja = String(datos.origen.hoja).slice(0, 31);
  const meta = {
    clave: ident.clave, matricula: ident.matricula || '', serie: ident.serie || '', documento: 'salud', tipo: datos.tipo,
    origen, mime: datos.mime, ancho: Math.round(datos.ancho), alto: Math.round(datos.alto), tamano: datos.bytes.length,
    partes: partes.length, huella, lote, subidoPor: autor, en: serverTimestamp()
  };
  const b = writeBatch(db);
  b.set(refMeta(db, ident.id), meta);
  for (let n = 0; n < PARTES_MAX; n++) {
    if (n < partes.length) b.set(refParte(db, ident.id, n), { bytes: Bytes.fromUint8Array(partes[n]), lote });
    else b.delete(refParte(db, ident.id, n));
  }
  b.set(doc(db, COLECCION_REGISTRO, ident.id + '_' + lote), {
    idAdjunto: ident.id, accion: previo ? 'reemplazo' : 'alta', lote, nombre: origen.nombre, huella, tamano: datos.bytes.length,
    subidoPor: autor, en: serverTimestamp()
  });
  await b.commit();
  cache.set(ident.id, { huella, bytes: datos.bytes });
  return { ...meta, en: new Date() };
}

/** Quita el adjunto (meta + partes) y deja la fila «retiro» en el registro. */
export async function quitar(ident, meta) {
  const db = getDbSafe(); const a = administrador();
  if (!db || !a) throw new Error('Solo un administrador puede quitar el Diagrama Operativo.');
  const autor = { uid: a.uid, nombre: await nombreVigente(db, a) };
  const b = writeBatch(db);
  b.delete(refMeta(db, ident.id));
  for (let n = 0; n < PARTES_MAX; n++) b.delete(refParte(db, ident.id, n));
  b.set(doc(db, COLECCION_REGISTRO, ident.id + '_' + meta.lote + '_retiro'), {
    idAdjunto: ident.id, accion: 'retiro', lote: meta.lote, nombre: nombreSeguro(meta && meta.origen && meta.origen.nombre), huella: meta.huella,
    tamano: meta.tamano || 0, subidoPor: autor, en: serverTimestamp()
  });
  await b.commit();
  cache.delete(ident.id);
}
