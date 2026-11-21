// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · lector PROPIO de «Mi firma» (firmas/{uidSesión})
// ──────────────────────────────────────────────────────────────────────────────
// Por qué NO se usa `miFirma()` de data/firmas.js (comité W-11, arq «miFirma() no
// sirve para este flujo»): aquella devuelve solo un dataURL y convierte cualquier
// fallo de red o de permisos en `null` («no hay firma»). Para firmar una ODT hace
// falta lo contrario:
//   · los BYTES exactos de la imagen (la regla del acto exige `imagen ==
//     firmas/{uid}.imagen` byte a byte) y su SHA-256 calculada aquí, de los bytes;
//   · la hora `en` de la firma (la regla exige que sea POSTERIOR a la habilitación);
//   · distinguir «no hay» (devuelve {hay:false}) de «falló» (LANZA ErrorOdt).
// La ruta se arma con el uid de la SESIÓN, nunca con un parámetro: no hay forma
// de pedir la firma de otra persona (y la regla de firmas/{uid} tampoco lo deja).
// Lee DEL SERVIDOR, sin caché. Archivo NUEVO a propósito (L-102: no se agregan
// exportaciones a firmas.js).
// ══════════════════════════════════════════════════════════════════════════════

import { COL } from '../domain/odt_afinia_rutas.js';
import { huella } from '../domain/odt_afinia_partes.js';
import { esPng } from '../domain/odt_afinia_componer.js';
import { ErrorOdt, errorDesdeFirebase, sesionGlobal } from './odt_afinia_lotes.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

/** La huella guardada en firmas/{uid} no es la de sus bytes (la regla del acto la exige igual). */
export const HUELLA_MI_FIRMA_DISTINTA = 'La huella guardada de su firma no coincide con la imagen. Vuelva a subirla en «Mi firma» (puede ser el mismo archivo) y prepare de nuevo.';

/**
 * La firma propia para estampar en una ODT.
 * @param {object} [opciones]  {sdk, db, sesion} inyectables (pruebas)
 * @returns {Promise<{hay:false} | {hay:true, imagen:Uint8Array, huella:string, huellaDeclarada:string, enMs:number|null}>}
 * @throws {ErrorOdt}  si no hay sesión, si la lectura falla (red, permisos) o si lo guardado no es un PNG
 */
export async function miFirmaOdt(opciones = {}) {
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  const s = leerSesion();
  if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
  let snap;
  try {
    const F = opciones.sdk || await import(CDN_FIRESTORE);
    let d = opciones.db || null;
    if (!d) { const fb = await import('../firebase-init.js'); d = fb.getDbSafe(); }
    if (!d) throw new ErrorOdt('red', 'La plataforma no está disponible en este momento (la base no inició).');
    snap = await (F.getDocFromServer || F.getDoc)(F.doc(d, COL.firmaPropia, s.uid));
  } catch (e) {
    throw errorDesdeFirebase(e);
  }
  if (!snap.exists()) return { hay: false };
  const data = snap.data() || {};
  const img = data.imagen;
  const bytes = img instanceof Uint8Array ? img : (img && typeof img.toUint8Array === 'function' ? img.toUint8Array() : null);
  if (!bytes || !esPng(bytes)) {
    throw new ErrorOdt('validacion', 'Su firma guardada no es un PNG válido. Vuelva a subirla en «Mi firma».');
  }
  const t = data.en;
  const enMs = t == null ? null : (typeof t.toMillis === 'function' ? t.toMillis() : (typeof t === 'number' ? t : null));
  const deLosBytes = await huella(bytes);          // de los BYTES, no la que declaró el cliente al subirla
  const huellaDeclarada = typeof data.huella === 'string' ? data.huella : '';
  // La regla del acto exige firmas/{uid}.huella == sha256(imagen): si no coincide, la firma se negaría.
  if (huellaDeclarada !== deLosBytes) throw new ErrorOdt('validacion', HUELLA_MI_FIRMA_DISTINTA);
  return {
    hay: true,
    imagen: bytes.slice(),                         // copia: nadie más comparte este búfer
    huella: deLosBytes,
    huellaDeclarada,
    enMs
  };
}
