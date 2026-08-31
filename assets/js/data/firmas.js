// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas personales en Storage (ADR-071)
// ──────────────────────────────────────────────────────────────
// Ruta: `firmas/{uid}` — una por persona, la SUYA. Las reglas de
// `storage.rules` solo dejan leer y escribir al dueño del uid, de modo
// que nadie puede descargar la firma de otro ni aunque conozca la ruta.
//
// ⚠️ SE LEE CON `getBytes`, NO CON `getDownloadURL`.
// `getDownloadURL` devuelve una URL con token que funciona SIN sesión: si
// esa URL se filtra (historial, copiar-pegar, caché, un log), la firma
// vuelve a ser descargable por cualquiera y habríamos movido el problema
// en vez de resolverlo. `getBytes` va autenticado en cada lectura y no
// deja ninguna URL pública detrás. Este es el punto entero del cambio —
// no sustituir por getDownloadURL "porque es más cómodo" (ADR-070/071).
// ══════════════════════════════════════════════════════════════

import {
  ref as storageRef, getBytes, uploadBytes, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

import { getStorageSafe, isFirebaseConfigured } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { validarArchivoFirma, TIPO_REQUERIDO } from '../domain/firmas.js';

const PREFIJO = 'firmas';

// Caché en MEMORIA de la sesión (no en disco ni en localStorage): una firma
// escaneada es un dato personal y no tiene por qué sobrevivir al cierre de
// la pestaña. Evita releer Storage en cada documento — el free-tier importa.
// `null` cacheado = "ya se preguntó y NO hay firma", que también se recuerda
// para no repetir la consulta en cada informe.
let _cache;         // undefined = sin consultar · null = no hay · string = dataURL
let _cacheUid = null;

function uidActual() {
  const s = getSession();
  return (s && s.user && s.user.uid) || null;
}

function refDeMiFirma() {
  const st = getStorageSafe();
  const uid = uidActual();
  if (!st || !uid) return null;
  return storageRef(st, `${PREFIJO}/${uid}`);
}

function invalidar() { _cache = undefined; _cacheUid = null; }

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
  return !!(isFirebaseConfigured && getStorageSafe() && uidActual());
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

  const r = refDeMiFirma();
  if (!r) return null;
  try {
    const buf = await getBytes(r, 2 * 1024 * 1024);   // tope defensivo de lectura
    _cache = `data:${TIPO_REQUERIDO};base64,${aBase64(buf)}`;
  } catch (e) {
    // 'storage/object-not-found' es el caso NORMAL de quien aún no subió su
    // firma: no es un error que merezca ruido en consola.
    if (!(e && e.code === 'storage/object-not-found')) {
      console.warn('[firmas] no se pudo leer la firma propia:', e && e.code || e);
    }
    _cache = null;
  }
  _cacheUid = uid;
  return _cache;
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

  try {
    await uploadBytes(r, archivo, { contentType: TIPO_REQUERIDO });
    invalidar();
    return { ok: true, motivo: '' };
  } catch (e) {
    return {
      ok: false,
      motivo: e && e.code === 'storage/unauthorized'
        ? 'El servidor rechazó la firma. Compruebe que es un PNG de menos de 1 MB.'
        : 'No se pudo guardar la firma. Revise su conexión e inténtelo de nuevo.'
    };
  }
}

/** Borra la firma propia. Devuelve `{ ok, motivo }`. */
export async function borrarMiFirma() {
  const r = refDeMiFirma();
  if (!r) return { ok: false, motivo: 'No hay sesión abierta.' };
  try {
    await deleteObject(r);
    invalidar();
    return { ok: true, motivo: '' };
  } catch (e) {
    if (e && e.code === 'storage/object-not-found') { invalidar(); return { ok: true, motivo: '' }; }
    return { ok: false, motivo: 'No se pudo borrar la firma. Inténtelo de nuevo.' };
  }
}

/** Olvida la firma cacheada (al cerrar sesión, para no dejarla en memoria). */
export function olvidarFirmaEnMemoria() { invalidar(); }
