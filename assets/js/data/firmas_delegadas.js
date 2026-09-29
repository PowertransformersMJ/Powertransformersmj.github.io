// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas DELEGADAS: lo que usa el DELEGADO en Órdenes E/S (I/O) · `99 §117`
// ──────────────────────────────────────────────────────────────
// Un usuario al que el custodio (el Ingeniero) le dio permiso en
// `firmas_delegados/{uid}` lee, del directorio de ESE custodio, solo las firmas
// de las personas nombradas, y registra cada PDF/Excel que las lleva en
// `ordenes_emisiones` (rama del delegado: custodio = dueño del directorio,
// emisor = quien emite, delegacion = el lote vigente). Las reglas lo exigen de
// nuevo en cada petición: retirar el permiso corta en la siguiente lectura.
// Nunca URL pública; SIN caché: cada emisión relee y verifica la huella.
// Archivo NUEVO (L-102). Se carga con import() dinámico solo si no es custodio.
// ══════════════════════════════════════════════════════════════

import { collection, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { IDS_EQUIPO } from '../domain/firmas_equipo.js';

/** Sesión VIVA, con perfil real y activo (no la de arranque). */
function sesion() {
  const s = getSession();
  const uid = (s && s.user && s.user.uid) || null;
  if (!uid) return null;
  try {
    const auth = getAuthSafe();
    if (auth && (!auth.currentUser || auth.currentUser.uid !== uid)) return null;
  } catch (_) { /* sin Auth manda la sesión publicada */ }
  const p = (s && s.profile) || {};
  if (p.activo === false || p.legacy) return null;
  return { uid, nombre: p.nombre || '' };
}

/** ¿Esta sesión puede preguntar si tiene delegación? */
export function puedeUsarDelegacion() { return !!(getDbSafe() && sesion()); }

/** Huella SHA-256 (hex) de unos bytes. */
export async function huellaDe(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function aBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * La delegación de quien tiene la sesión: {custodio, custodioNombre, personaPropia, personas, lote}
 * · null si no tiene · {error: true} si no se pudo leer.
 */
export async function miDelegacion() {
  const c = sesion();
  if (!c || !getDbSafe()) return null;
  try {
    const snap = await getDoc(doc(getDbSafe(), 'firmas_delegados', c.uid));
    if (!snap.exists()) return null;
    const d = snap.data() || {};
    if (d.alcance !== 'ordenes' || !d.custodio || !Array.isArray(d.personas)) return null;
    return {
      custodio: String(d.custodio), custodioNombre: String(d.custodioNombre || ''),
      personaPropia: String(d.personaPropia || ''), personas: d.personas.filter((p) => IDS_EQUIPO.includes(p)),
      lote: String(d.lote || '')
    };
  } catch (e) {
    if (e && e.code === 'permission-denied') return null;
    console.warn('[firmas-delegadas] delegación:', e && e.code || e);
    return { error: true };
  }
}

/**
 * Una firma del directorio del custodio, recién leída: {dataUrl, huella} · null si NO HAY ·
 * {denegada: true} si el permiso no existe o se retiró · {error: true} si no se pudo leer.
 */
export async function leerFirmaDelegada(custodio, id) {
  if (!sesion() || !getDbSafe() || !IDS_EQUIPO.includes(id) || !custodio) return { error: true };
  try {
    const snap = await getDoc(doc(getDbSafe(), 'firmas_equipo', custodio, 'personas', id));
    if (!snap.exists()) return null;
    const img = snap.data().imagen;
    if (!img || typeof img.toUint8Array !== 'function') return { error: true };
    return { dataUrl: 'data:image/png;base64,' + aBase64(img.toUint8Array()), huella: snap.data().huella || '' };
  } catch (e) {
    if (e && e.code === 'permission-denied') return { denegada: true };
    console.warn('[firmas-delegadas] lectura:', e && e.code || e);
    return { error: true };
  }
}

/** Id nuevo (de Firestore) para la emisión que se va a registrar. */
export function nuevaEmisionId() { return doc(collection(getDbSafe(), 'ordenes_emisiones')).id; }

/** Nombre vigente de QUIEN EMITE: la regla lo compara con su /usuarios/{uid}.nombre. */
async function nombreVigente(c) {
  try {
    const snap = await getDoc(doc(getDbSafe(), 'usuarios', c.uid));
    return (snap.exists() && snap.data().nombre) || c.nombre || '';
  } catch (_) { return c.nombre || ''; }
}

/**
 * Registra una emisión del delegado (lanza si falla).
 * @param {string} id
 * @param {{orden, formato: ('pdf'|'xlsx'), casillas: Array, huellaArchivo: string,
 *          delegacion: {custodio, custodioNombre, lote}}} datos
 */
export async function registrarEmisionDelegada(id, { orden, formato, casillas, huellaArchivo, delegacion }) {
  const c = sesion();
  if (!c) throw new Error('Sin sesión.');
  const o = orden || {};
  await setDoc(doc(getDbSafe(), 'ordenes_emisiones', id), {
    orden: { tipo: String(o.tipo || ''), numero: String(o.numero || ''), zona: String(o.zona || ''), fecha: String(o.fecha || '') },
    documento: 'IT.05801',
    formato,
    casillas: (casillas || []).map((x) => ({
      rol: String(x.rol || ''), persona: String(x.persona || ''), nombre: String(x.nombre || ''), origen: String(x.origen || ''), huella: String(x.huella || '')
    })),
    huellaArchivo,
    custodio: delegacion.custodio,
    custodioNombre: delegacion.custodioNombre,
    emisor: c.uid,
    emisorNombre: await nombreVigente(c),
    delegacion: delegacion.lote,
    en: serverTimestamp()
  });
}
