// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas personales en FIRESTORE (ADR-071 → ADR-100)
// ──────────────────────────────────────────────────────────────
// Documento: `firmas/{uid}` — uno por persona, el SUYO, con la imagen PNG
// dentro (`imagen`, tipo bytes) y su huella SHA-256. Las reglas de
// `firestore.rules` solo dejan leer y escribir al dueño del uid, de modo
// que nadie lee la firma de otro ni aunque conozca la ruta.
//
// ⚠️ POR QUÉ FIRESTORE Y NO STORAGE (`99 §100`): en producción Storage
// SUBE bien pero NIEGA toda descarga desde el navegador (`getBytes` →
// 503 y reintentos hasta rendirse; L-29 ya lo había visto). Firestore se
// lee sin problema desde la página. Sigue sin haber URL pública: cada
// lectura va con la sesión (nunca `getDownloadURL`, ADR-070/071).
// ══════════════════════════════════════════════════════════════

import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp, Bytes
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, getAuthSafe, isFirebaseConfigured } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { validarArchivoFirma, esPngPorBytes, TIPO_REQUERIDO } from '../domain/firmas.js';

const COLECCION = 'firmas';

// Caché en MEMORIA de la sesión (no en disco ni en localStorage): una firma
// escaneada es un dato personal y no tiene por qué sobrevivir al cierre de
// la pestaña. Evita releer la base en cada documento — el free-tier importa.
// `null` cacheado = "ya se preguntó y NO hay firma", que también se recuerda
// para no repetir la consulta en cada informe.
let _cache;         // undefined = sin consultar · null = no hay · string = dataURL
let _cacheUid = null;

function uidActual() {
  const s = getSession();
  const uid = (s && s.user && s.user.uid) || null;
  if (!uid) return null;
  // La sesión publicada por el guard no se entera de un cierre de sesión hecho
  // en OTRA pestaña; Firebase Auth sí (sincroniza entre pestañas). Si el usuario
  // vivo ya no es el de la sesión, no hay firma que leer ni estampar (revisión
  // de `99 §98`).
  try {
    const auth = getAuthSafe();
    if (auth && auth.currentUser !== undefined && (!auth.currentUser || auth.currentUser.uid !== uid)) return null;
  } catch (_) { /* sin Auth no se puede comprobar: manda la sesión publicada */ }
  return uid;
}

function refDeMiFirma() {
  const db = getDbSafe();
  const uid = uidActual();
  if (!db || !uid) return null;
  return doc(db, COLECCION, uid);
}

/** SHA-256 (hex) de unos bytes, con la API del navegador. */
async function huellaDe(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Lectura en curso: las llamadas que llegan mientras tanto la comparten, en vez
// de descargar la misma firma dos o tres veces (revisión de `99 §98`).
let _pendiente = null;
let _pendienteUid = null;

function invalidar() { _cache = undefined; _cacheUid = null; _pendiente = null; _pendienteUid = null; }

/** ArrayBuffer → base64 POR TROZOS. `String.fromCharCode(...bytes)` con un
 *  PNG de 1 MB pasa un millón de argumentos y revienta la pila de llamadas:
 *  el fallo aparece justo con las firmas grandes, que son las que más se
 *  parecen a un caso real. Se procesa en bloques de 32 KB. */
function aBase64(buf) {
  const bytes = new Uint8Array(buf);
  const TROZO = 0x8000;
  let s = '';
  for (let i = 0; i < bytes.length; i += TROZO) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + TROZO));
  }
  return btoa(s);
}

/** ¿Está el mecanismo disponible? (Firebase configurado y sesión abierta) */
export function firmasDisponibles() {
  return !!(isFirebaseConfigured && getDbSafe() && uidActual());
}

/**
 * La firma de QUIEN TIENE LA SESIÓN, como dataURL lista para dibujar,
 * o `null` si no ha cargado ninguna. Nunca devuelve la de otra persona:
 * la ruta se construye con el uid de la sesión, no con un parámetro.
 *
 * No lanza: un fallo de red o de permisos se resuelve como "no hay firma",
 * porque un documento sin firma es válido (se firma a mano) y una excepción
 * aquí dejaría al usuario sin poder emitir el documento.
 */
export async function miFirma() {
  const uid = uidActual();
  if (!uid) return null;
  if (_cacheUid === uid && _cache !== undefined) return _cache;
  if (_pendiente && _pendienteUid === uid) return _pendiente;

  const r = refDeMiFirma();
  if (!r) return null;
  _pendienteUid = uid;
  _pendiente = (async () => {
    try {
      const snap = await getDoc(r);
      const img = snap.exists() ? snap.data().imagen : null;
      // Sin documento es el caso NORMAL de quien aún no subió su firma: se
      // recuerda como «no hay». Un fallo (red, permisos) NO se guarda: la
      // próxima lectura lo reintenta (revisión de `99 §98`).
      _cache = img && typeof img.toUint8Array === 'function'
        ? `data:${TIPO_REQUERIDO};base64,${aBase64(img.toUint8Array())}`
        : null;
      _cacheUid = uid;
    } catch (e) {
      console.warn('[firmas] no se pudo leer la firma propia:', e && e.code || e);
    } finally {
      _pendiente = null;
      _pendienteUid = null;
    }
    return _cacheUid === uid ? _cache : null;
  })();
  return _pendiente;
}

/**
 * Guarda (o reemplaza) la firma propia. Devuelve `{ ok, motivo }`.
 * La validación de formato y tamaño vive en el dominio, para que sea
 * testable sin navegador; aquí solo se hace el I/O.
 */
export async function guardarMiFirma(archivo) {
  const v = validarArchivoFirma(archivo);
  if (!v.ok) return v;

  const r = refDeMiFirma();
  if (!r) return { ok: false, motivo: 'No hay sesión abierta para guardar la firma.' };

  let bytes;
  try { bytes = new Uint8Array(await archivo.arrayBuffer()); }
  catch (_) { return { ok: false, motivo: 'No se pudo leer el archivo elegido.' }; }
  // La etiqueta del archivo la pone el sistema operativo; los bytes no mienten.
  if (!esPngPorBytes(bytes)) {
    return { ok: false, motivo: 'El archivo no es un PNG de verdad (aunque su nombre lo diga). Expórtelo de nuevo como PNG.' };
  }
  try {
    await setDoc(r, { imagen: Bytes.fromUint8Array(bytes), huella: await huellaDe(bytes), en: serverTimestamp() });
    invalidar();
    return { ok: true, motivo: '' };
  } catch (e) {
    return {
      ok: false,
      motivo: e && e.code === 'permission-denied'
        ? 'Su cuenta no tiene permiso para guardar la firma: cierre sesión, vuelva a entrar y, si sigue, avise al administrador.'
        : 'No se pudo guardar la firma. Revise su conexión e inténtelo de nuevo.'
    };
  }
}

/** Borra la firma propia. Devuelve `{ ok, motivo }`. */
export async function borrarMiFirma() {
  const r = refDeMiFirma();
  if (!r) return { ok: false, motivo: 'No hay sesión abierta.' };
  try {
    await deleteDoc(r);                        // borrar lo que no existe no es error
    invalidar();
    return { ok: true, motivo: '' };
  } catch (_) {
    return { ok: false, motivo: 'No se pudo borrar la firma. Inténtelo de nuevo.' };
  }
}

/** Olvida la firma cacheada (al cerrar sesión, para no dejarla en memoria). */
export function olvidarFirmaEnMemoria() { invalidar(); }
