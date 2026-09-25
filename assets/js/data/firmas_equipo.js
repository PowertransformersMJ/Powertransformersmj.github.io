// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas del EQUIPO bajo custodia (I/O) · ADR-099 → ADR-100
// ──────────────────────────────────────────────────────────────
// Firestore `firmas_equipo/{custodio}/personas/{persona}` (solo su custodio,
// admin con perfil): la imagen PNG va DENTRO del documento (`imagen`, bytes)
// con su huella, la autorización declarada y el id de su registro. Y dos
// registros que SOLO se agregan: `firmas_equipo_registro` (alta / reemplazo /
// retiro) y `fichas_emisiones` (cada Excel emitido con firmas del equipo).
// Reglas y pruebas: firestore.rules, tests-rules/firmas_firestore.rules.test.js (+ firmas_equipo).
//
// Por qué Firestore y no Storage (`99 §100`): en producción Storage niega toda
// descarga desde el navegador (503). Y ganamos algo: la firma y su registro se
// escriben en UNA operación atómica (o las dos o ninguna), y la regla exige
// que toda firma lleve su registro. Ya no hay «subir y luego registrar» con
// retirada si el registro falla.
//
// Nunca URL pública: cada lectura va con la sesión. SIN caché: cada emisión
// relee la firma, para que una firma retirada deje de estamparse al instante.
// Este módulo se carga con import() dinámico desde la página, solo para admin.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, setDoc, getDoc, deleteDoc, writeBatch, serverTimestamp, Bytes
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { IDS_EQUIPO, validarAutorizacion } from '../domain/firmas_equipo.js';

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
  return !!(getDbSafe() && custodio());
}

function refDe(id) {
  const c = custodio();
  const db = getDbSafe();
  if (!c || !db || !IDS_EQUIPO.includes(id)) return null;
  return doc(db, 'firmas_equipo', c.uid, 'personas', id);
}

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

/** Lee el documento de la firma: {hay, datos} · {error: true} si no se pudo leer. */
async function leerDoc(id) {
  const r = refDe(id);
  if (!r) return { error: true };
  try {
    const snap = await getDoc(r);
    return snap.exists() ? { hay: true, datos: snap.data() } : { hay: false };
  } catch (e) {
    console.warn('[firmas-equipo] lectura:', e && e.code || e);
    return { error: true };
  }
}

function autorizacionDe(d) {
  const a = (d && d.autorizacion) || {};
  return { fecha: a.fecha || '', medio: a.medio || '' };
}

/** Estado de la firma de una persona: {hay, autorizacion, huella} (o {hay:false, error:true}). */
export async function estadoFirma(id) {
  const l = await leerDoc(id);
  if (l.error) return { hay: false, error: true };
  if (!l.hay) return { hay: false };
  return { hay: true, autorizacion: autorizacionDe(l.datos), huella: l.datos.huella || '' };
}

/**
 * La firma de una persona, recién leída: {dataUrl, huella, autorizacion}; null si
 * NO HAY; {error: true} si no se pudo leer (red, permisos). No es lo mismo «no
 * hay firma» que «no se pudo leer» (revisión de `§99`).
 */
export async function leerFirma(id) {
  const l = await leerDoc(id);
  if (l.error) return { error: true };
  if (!l.hay) return null;
  const img = l.datos.imagen;
  if (!img || typeof img.toUint8Array !== 'function') return { error: true };
  return {
    dataUrl: 'data:image/png;base64,' + aBase64(img.toUint8Array()),
    huella: l.datos.huella || '',
    autorizacion: autorizacionDe(l.datos)
  };
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

/** Datos de un registro nuevo (sin escribirlo). */
async function datosRegistro(c, datos) {
  return { ...datos, custodio: c.uid, custodioNombre: await nombreVigente(c), en: serverTimestamp() };
}

/**
 * Sube (o reemplaza) la firma de una persona con la autorización declarada.
 * La firma y su registro van en UNA escritura atómica: o quedan las dos, o
 * ninguna (y la regla rechaza una firma sin su registro).
 * @param {string} id
 * @param {Uint8Array} png   PNG ya normalizado por la pantalla
 * @param {{fecha: string, medio: string}} autorizacion
 */
export async function subirFirma(id, png, autorizacion) {
  const r = refDe(id);
  const c = custodio();
  if (!r || !c) return { ok: false, motivo: 'Solo un administrador con sesión puede custodiar firmas.' };
  const v = validarAutorizacion(autorizacion);
  if (!v.ok) return v;
  if (!(png instanceof Uint8Array) || png.length > TOPE) return { ok: false, motivo: 'La imagen pesa más de 512 KB.' };
  const previa = await estadoFirma(id);
  if (previa.error) return { ok: false, motivo: 'No se pudo consultar la firma actual (revise la conexión).' };
  const huella = await huellaDe(png);
  const aut = { fecha: String(autorizacion.fecha).trim(), medio: String(autorizacion.medio).trim() };
  const db = getDbSafe();
  const regRef = doc(collection(db, 'firmas_equipo_registro'));
  try {
    const lote = writeBatch(db);
    lote.set(regRef, await datosRegistro(c, { tipo: previa.hay ? 'reemplazo' : 'alta', persona: id, autorizacion: aut, huella }));
    lote.set(r, { imagen: Bytes.fromUint8Array(png), huella, autorizacion: aut, registro: regRef.id, en: serverTimestamp() });
    await lote.commit();
  } catch (e) {
    return { ok: false, motivo: 'No se pudo guardar la firma (' + ((e && e.code) || 'error') + '). No quedó nada a medias: inténtelo de nuevo.' };
  }
  return { ok: true, motivo: '' };
}

/** Retira la firma de una persona (solo afecta a las descargas futuras) y lo registra. */
export async function quitarFirma(id) {
  const r = refDe(id);
  const c = custodio();
  if (!r || !c) return { ok: false, motivo: 'Solo un administrador con sesión puede custodiar firmas.' };
  const db = getDbSafe();
  try {
    const lote = writeBatch(db);
    lote.delete(r);
    lote.set(doc(collection(db, 'firmas_equipo_registro')), await datosRegistro(c, { tipo: 'retiro', persona: id }));
    await lote.commit();
    return { ok: true, motivo: '' };
  } catch (e) {
    // Un custodio al que le quitaron el rol ya no puede dejar el registro, pero
    // SÍ debe poder retirar lo que custodiaba (revisión de ADR-100).
    if (e && e.code === 'permission-denied') {
      try {
        await deleteDoc(r);
        return { ok: true, motivo: 'La firma se retiró, pero no se pudo dejar el registro del retiro.' };
      } catch (_) { /* cae al mensaje de abajo */ }
    }
    return { ok: false, motivo: 'No se pudo retirar la firma (' + ((e && e.code) || 'error') + ').' };
  }
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
