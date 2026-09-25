// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas del EQUIPO bajo custodia (I/O) · ADR-099
// ──────────────────────────────────────────────────────────────
// Storage `firmas-equipo/{custodio}/{persona}` (solo su custodio, admin) y
// dos registros de Firestore que SOLO se agregan: `firmas_equipo_registro`
// (alta / reemplazo / retiro) y `fichas_emisiones` (cada Excel emitido con
// firmas del equipo). Reglas y pruebas: storage.rules, firestore.rules,
// tests-rules/firmas_equipo.rules.test.js.
//
// Como en `§71`: se lee con getBytes, NUNCA con getDownloadURL (su URL con
// token funciona sin sesión). Y a diferencia de `§71`, SIN caché: cada emisión
// relee la firma, para que una firma retirada deje de estamparse al instante.
// Este módulo se carga con import() dinámico desde la página, solo para admin.
// ══════════════════════════════════════════════════════════════

import {
  ref as storageRef, getBytes, uploadBytes, deleteObject, getMetadata
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import {
  collection, doc, setDoc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getStorageSafe, getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { IDS_EQUIPO, validarAutorizacion } from '../domain/firmas_equipo.js';

const PREFIJO = 'firmas-equipo';
const TOPE = 512 * 1024;

/** Sesión VIVA (la del guard y la de Auth coinciden) con perfil admin activo. */
function custodio() {
  const s = getSession();
  const uid = (s && s.user && s.user.uid) || null;
  if (!uid) return null;
  try {
    const auth = getAuthSafe();
    if (auth && (!auth.currentUser || auth.currentUser.uid !== uid)) return null;
  } catch (_) { /* sin Auth manda la sesión publicada */ }
  const p = (s && s.profile) || {};
  if (p.rol !== 'admin' || p.activo === false) return null;
  // El admin de ARRANQUE (/admins, perfil sintético `legacy`) no custodia: las
  // reglas exigen perfil real (hasProfile) y sin él no hay registro (§99.11).
  if (p.legacy) return null;
  return { uid, nombre: p.nombre || '' };
}

/** ¿Quien tiene la sesión puede custodiar firmas del equipo? (la regla lo vuelve a exigir) */
export function puedeCustodiar() {
  return !!(getStorageSafe() && getDbSafe() && custodio());
}

function refDe(id) {
  const c = custodio();
  const st = getStorageSafe();
  if (!c || !st || !IDS_EQUIPO.includes(id)) return null;
  return storageRef(st, `${PREFIJO}/${c.uid}/${id}`);
}

/** Huella SHA-256 (hex) de unos bytes. */
export async function huellaDe(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function aBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Estado de la firma de una persona (sin descargar la imagen): {hay, autorizacion, huella}. */
export async function estadoFirma(id) {
  const r = refDe(id);
  if (!r) return { hay: false };
  try {
    const m = await getMetadata(r);
    const cm = m.customMetadata || {};
    return { hay: true, autorizacion: { fecha: cm.autorizacionFecha || '', medio: cm.autorizacionMedio || '' }, huella: cm.huella || '' };
  } catch (e) {
    if (!(e && e.code === 'storage/object-not-found')) console.warn('[firmas-equipo] estado:', e && e.code || e);
    return { hay: false, error: !(e && e.code === 'storage/object-not-found') };
  }
}

/**
 * La firma de una persona, recién leída: {dataUrl, huella, autorizacion}; null si
 * NO HAY; {error: true} si no se pudo leer (red, permisos). No es lo mismo «no
 * hay firma» que «no se pudo leer» (revisión de `§99`).
 */
export async function leerFirma(id) {
  const r = refDe(id);
  if (!r) return { error: true };
  try {
    const [m, buf] = await Promise.all([getMetadata(r), getBytes(r, TOPE)]);
    const cm = m.customMetadata || {};
    return {
      dataUrl: 'data:image/png;base64,' + aBase64(buf),
      huella: cm.huella || '',
      autorizacion: { fecha: cm.autorizacionFecha || '', medio: cm.autorizacionMedio || '' }
    };
  } catch (e) {
    if (e && e.code === 'storage/object-not-found') return null;
    console.warn('[firmas-equipo] lectura:', e && e.code || e);
    return { error: true };
  }
}

/**
 * Nombre del custodio tal como está AHORA en su perfil: la regla lo compara con
 * /usuarios/{uid}.nombre, y el de la sesión puede haber quedado viejo.
 */
async function nombreVigente(c) {
  try {
    const snap = await getDoc(doc(getDbSafe(), 'usuarios', c.uid));
    return (snap.exists() && snap.data().nombre) || c.nombre || '';
  } catch (_) { return c.nombre || ''; }
}

async function registrar(datos) {
  const c = custodio();
  const d = getDbSafe();
  await setDoc(doc(collection(d, 'firmas_equipo_registro')), {
    ...datos, custodio: c.uid, custodioNombre: await nombreVigente(c), en: serverTimestamp()
  });
}

/**
 * Sube (o reemplaza) la firma de una persona con la autorización declarada.
 * Primero la imagen y después el registro. Si el registro falla, un alta se
 * retira y un reemplazo RESTAURA la anterior: no queda una firma sin su rastro
 * ni se pierde la que ya estaba registrada.
 * @param {string} id
 * @param {Uint8Array} png   PNG ya normalizado por la pantalla
 * @param {{fecha: string, medio: string}} autorizacion
 */
export async function subirFirma(id, png, autorizacion) {
  const r = refDe(id);
  if (!r) return { ok: false, motivo: 'Solo un administrador con sesión puede custodiar firmas.' };
  const v = validarAutorizacion(autorizacion);
  if (!v.ok) return v;
  if (!(png instanceof Uint8Array) || png.length > TOPE) return { ok: false, motivo: 'La imagen pesa más de 512 KB.' };
  const previa = await estadoFirma(id);
  if (previa.error) return { ok: false, motivo: 'No se pudo consultar la firma actual (revise la conexión).' };
  // En un REEMPLAZO se guarda antes la firma anterior: si el registro falla, se
  // restaura en vez de perder las dos (revisión de `§99`).
  let anterior = null;
  if (previa.hay) {
    try { anterior = { bytes: new Uint8Array(await getBytes(r, TOPE)), meta: await getMetadata(r) }; }
    catch (_) { return { ok: false, motivo: 'No se pudo leer la firma actual para reemplazarla con seguridad.' }; }
  }
  const huella = await huellaDe(png);
  const aut = { fecha: String(autorizacion.fecha).trim(), medio: String(autorizacion.medio).trim() };
  const meta = (m) => ({ contentType: 'image/png', cacheControl: 'private, no-store', customMetadata: m });
  try {
    await uploadBytes(r, png, meta({ autorizacionFecha: aut.fecha, autorizacionMedio: aut.medio, huella }));
  } catch (e) {
    return { ok: false, motivo: 'No se pudo guardar la firma (' + ((e && e.code) || 'error') + ').' };
  }
  try {
    await registrar({ tipo: previa.hay ? 'reemplazo' : 'alta', persona: id, autorizacion: aut, huella });
  } catch (e) {
    if (anterior) {
      try {
        await uploadBytes(r, anterior.bytes, meta(anterior.meta.customMetadata || {}));
        return { ok: false, motivo: 'No se pudo dejar el registro; se conservó la firma ANTERIOR.' };
      } catch (_) {
        return { ok: false, motivo: 'No se pudo dejar el registro ni restaurar la firma anterior: vuelva a subirla.' };
      }
    }
    try { await deleteObject(r); } catch (_) { /* queda para retirarla a mano */ }
    return { ok: false, motivo: 'No se pudo dejar el registro; la firma no quedó guardada.' };
  }
  return { ok: true, motivo: '' };
}

/** Retira la firma de una persona (solo afecta a las descargas futuras) y lo registra. */
export async function quitarFirma(id) {
  const r = refDe(id);
  if (!r) return { ok: false, motivo: 'Solo un administrador con sesión puede custodiar firmas.' };
  try { await deleteObject(r); } catch (e) {
    if (!(e && e.code === 'storage/object-not-found')) return { ok: false, motivo: 'No se pudo retirar la firma.' };
  }
  try { await registrar({ tipo: 'retiro', persona: id }); } catch (_) {
    return { ok: true, motivo: 'La firma se retiró, pero el registro del retiro falló.' };
  }
  return { ok: true, motivo: '' };
}

/** Id nuevo (de Firestore) para la emisión que se va a registrar. */
export function nuevaEmisionId() {
  const d = getDbSafe();
  return doc(collection(d, 'fichas_emisiones')).id;
}

/**
 * Registra una emisión con firmas del equipo. Si falla, lanza: sin registro no
 * se descarga (la trazabilidad interna es la condición de la emisión).
 */
export async function registrarEmision(id, { equipo, casillas, huellaArchivo }) {
  const c = custodio();
  if (!c) throw new Error('Sin sesión de administrador.');
  await setDoc(doc(getDbSafe(), 'fichas_emisiones', id), {
    equipo: {
      matricula: String((equipo && equipo.matricula) || ''),
      subestacion: String((equipo && equipo.subestacion) || ''),
      serie: String((equipo && equipo.serie) || '')
    },
    documento: 'PE.02081',
    casillas,
    huellaArchivo,
    custodio: c.uid,
    custodioNombre: await nombreVigente(c),
    en: serverTimestamp()
  });
}
