// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · PREPARAR, VERIFICAR, VER y DESCARGAR (sin DOM)
// ──────────────────────────────────────────────────────────────────────────────
// La lógica del flujo de firma que no necesita pantalla (se prueba en Node):
//   · prepararFirma  → al pulsar «Preparar» se arma el PDF compuesto UNA vez y se
//                      CONGELA una copia con uid, nombre, correo, imagen, huellas,
//                      estado y rev (L-112). Lo que se muestra, lo que se firma
//                      (huellaVista) y lo que se sube salen de ESA copia (L-107).
//   · verificarAntesDeFirmar → al pulsar «Firmar»: la cuenta viva sigue siendo la
//                      de la copia, el token renovado es de esa misma cuenta y su
//                      inicio de sesión es posterior a la publicación (y, para el
//                      Responsable, a la firma del AZT): paliativo D5. Las horas que
//                      se comparan son TODAS del servidor (iat, auth_time, publicadoEn,
//                      acto.en), nunca el reloj del equipo.
//   · verificarActoAzt → el Responsable recompone v0 + firma del AZT y exige la
//                      huella que el AZT vio (nadie tocó nada fuera de su casilla).
//   · componerParaVer → lo que se muestra en «Ver la ODT»: verificado contra la
//                      huellaVista de los actos, con su huella a la vista.
//   · prepararDescarga → compone v0 + las dos firmas, huella, y exige que sea la
//                      que vio el Responsable; se registra y se entrega ESE Blob.
// Antes de componer, las zonas guardadas en la ODT se comparan con las del formato
// (±3 pt): la regla solo mira su forma.
// pdf-lib llega INYECTADO. Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ESTADOS, TOPES, PROVEEDOR, esHuella } from '../../domain/odt_afinia_rutas.js';
import { cambioFirma, rolDe } from '../../domain/odt_afinia_estados.js';
import { declaracion, errorFechaCierre, nombreArchivo } from '../../domain/odt_afinia_textos.js';
import { componerConHuella } from '../../domain/odt_afinia_componer.js';
import { errorZonasGuardadas } from '../../domain/odt_afinia_zonas.js';
import { huella } from '../../domain/odt_afinia_partes.js';
import { ErrorOdt } from '../../data/odt_afinia_lotes.js';
import { MSG_IDENTIDAD_CAMBIO, MSG_SESION_ANTES_DE_PUBLICAR, MSG_SESION_ANTES_DEL_AZT } from '../../data/odt_afinia.js';
import { HUELLA_MI_FIRMA_DISTINTA } from '../../data/odt_afinia_mi_firma.js';

const falla = (codigo, mensaje) => { throw new ErrorOdt(codigo, mensaje); };

/** Las zonas guardadas en la ODT deben ser las del formato (±3 pt); si no, no se compone. */
export function exigirZonas(odt) {
  const err = errorZonasGuardadas(odt && odt.zonas);
  if (err) falla('huella', err);
}

/**
 * Comprueba la firma del AZT antes de que firme el Responsable (o de descargar):
 * su acto es del AZT de la ODT, sobre ESTE original, y recomponer v0 + su firma da
 * exactamente la huella que él vio.
 * @returns {Promise<{bytes:Uint8Array, huella:string}>}  lo compuesto con la firma del AZT
 */
export async function verificarActoAzt({ odt, bytesV0, actoAzt, PDFLib }) {
  if (!actoAzt) falla('estado', 'Todavía no está la firma del AZT.');
  exigirZonas(odt);
  if (!odt.firmantes || actoAzt.uid !== odt.firmantes.azt.uid) falla('huella', 'La firma del AZT no es de la persona asignada a esa casilla.');
  if (actoAzt.huellaBase !== odt.huella) falla('huella', 'La firma del AZT se hizo sobre otro original.');
  const r = await componerConHuella(bytesV0, { azt: { imagen: actoAzt.imagen } }, { PDFLib, zonas: odt.zonas });
  if (r.huella !== actoAzt.huellaVista) falla('huella', 'Al recomponer la ODT con la firma del AZT no sale lo que el AZT vio. No se puede firmar: avise al administrador.');
  return r;
}

/**
 * Arma lo que se va a firmar y lo CONGELA.
 * @param {object} p
 * @param {object} p.odt          ODT leída DEL SERVIDOR (con id)
 * @param {Uint8Array} p.bytesV0  el original verificado por huella
 * @param {{azt?:object}} p.actos actos ya leídos (el Responsable necesita el del AZT)
 * @param {{uid:string, nombre:string}} p.sesion
 * @param {string} p.correo       correo de la cuenta (el del token)
 * @param {{hay:boolean, imagen?:Uint8Array, huella?:string, huellaDeclarada?:string, enMs?:number}} p.miFirma  de miFirmaOdt
 * @param {{enMs?:number}|null} p.habilitacion
 * @param {string} [p.fechaCierre] solo el Responsable, 'dd/mm/aaaa'
 * @param {object} p.PDFLib
 * @param {Date} [p.ahora]
 */
export async function prepararFirma({ odt, bytesV0, actos = {}, sesion, correo, miFirma, habilitacion, fechaCierre, PDFLib, ahora = new Date() } = {}) {
  if (!odt || !odt.id) falla('no_existe');
  if (!sesion || !sesion.uid) falla('cuenta');
  const rol = rolDe(odt, sesion.uid);
  if (!rol) falla('sin_permiso', 'Usted no firma esta ODT.');
  const t = cambioFirma(odt, rol, sesion.uid);
  if (!t.ok) falla(t.codigo === 'estado' ? 'estado' : 'sin_permiso', t.mensaje);
  exigirZonas(odt);
  if (!habilitacion) falla('sin_permiso', 'Primero habilítese como firmante (pestaña «Habilitarme»).');
  if (!miFirma || !miFirma.hay) falla('validacion', 'Aún no ha subido su firma en «Mi firma».');
  if (!(miFirma.imagen instanceof Uint8Array) || miFirma.imagen.length > TOPES.imagenFirma) falla('validacion', 'Su firma no se pudo leer o pasa de 900 KB.');
  if (typeof miFirma.huellaDeclarada === 'string' && miFirma.huellaDeclarada !== miFirma.huella) falla('validacion', HUELLA_MI_FIRMA_DISTINTA);
  if (!(Number(miFirma.enMs) > Number(habilitacion.enMs))) {
    falla('validacion', 'Su firma («Mi firma») es anterior a su habilitación. Vuélvala a subir y luego prepare de nuevo.');
  }
  if (typeof correo !== 'string' || !correo) falla('cuenta', 'Su cuenta no tiene correo.');
  if (typeof sesion.nombre !== 'string' || !sesion.nombre.trim()) falla('validacion', 'Su perfil no tiene nombre. Pida al administrador que lo complete.');
  // La regla exige que el acto lleve el nombre y el correo PUBLICADOS en la ODT (copia de la habilitación).
  const pub = odt.firmantes && odt.firmantes[rol];
  if (!pub || pub.nombre !== sesion.nombre || pub.correo !== correo) falla('sin_permiso', MSG_IDENTIDAD_CAMBIO);

  let cierre = null;
  let actosComponer;
  const imagen = miFirma.imagen.slice();
  if (rol === 'azt') {
    actosComponer = { azt: { imagen } };
  } else {
    const err = errorFechaCierre(fechaCierre, { fechaTrabajo: odt.fechaTrabajo, ahora });
    if (err) falla('validacion', err);
    await verificarActoAzt({ odt, bytesV0, actoAzt: actos.azt, PDFLib });
    if (actos.azt.uid === sesion.uid) falla('sin_permiso', 'La misma cuenta no puede firmar las dos casillas.');
    cierre = { si: true, fecha: fechaCierre };
    actosComponer = { azt: { imagen: actos.azt.imagen }, responsable: { imagen, cierre } };
  }
  const compuesto = await componerConHuella(bytesV0, actosComponer, { PDFLib, zonas: odt.zonas });
  const decl = declaracion(rol, { nombre: sesion.nombre, correo, nro: odt.nro, fecha: cierre && cierre.fecha });
  return Object.freeze({
    uid: sesion.uid,
    nombre: sesion.nombre,
    correo,
    rol,
    odtId: odt.id,
    nro: odt.nro,
    firmantes: odt.firmantes,
    estadoPrevio: odt.estado,
    revPrevio: odt.rev,
    cambios: Object.freeze({ ...t.cambios }),
    huellaBase: odt.huella,
    imagen,
    huellaImagen: await huella(imagen),
    cierre: cierre && Object.freeze(cierre),
    bytes: compuesto.bytes,
    huellaVista: compuesto.huella,
    declaracion: Object.freeze(decl),
    // Horas del SERVIDOR para el paliativo D5 (verificarAntesDeFirmar).
    publicadoEnMs: Number.isFinite(odt.publicadoEnMs) ? odt.publicadoEnMs : null,
    aztEnMs: rol === 'responsable' && actos.azt && Number.isFinite(actos.azt.enMs) ? actos.azt.enMs : null,
    preparadoEnMs: ahora.getTime()
  });
}

/**
 * Justo antes de escribir: ¿sigue siendo la misma cuenta y el token es fresco?
 * El tope de 5 minutos se mide con `iat` (emisión del token, hora del SERVIDOR): un
 * reloj del equipo adelantado no bloquea la firma (la regla decide con request.time).
 * @param {object} congelado
 * @param {{uidVivo:string|null, token:object, ahoraMs?:number}} p  ahoraMs solo si el token no trae iat
 * @returns {string|null}  el motivo para abortar, o null
 */
export function verificarAntesDeFirmar(congelado, { uidVivo, token, ahoraMs = Date.now() } = {}) {
  if (!congelado) return 'Primero prepare la firma.';
  if (!uidVivo || uidVivo !== congelado.uid) return 'La sesión de esta pestaña cambió de cuenta. No se firma: recargue la página y entre con su propia cuenta.';
  if (!token || token.uid !== congelado.uid) return 'La contraseña es de otra cuenta. No se firma.';
  if (typeof token.email !== 'string' || !token.email) return 'Su sesión no trae el correo de la cuenta. Recargue la página, entre de nuevo y firme.';
  if (token.email !== congelado.correo) return 'El correo de la cuenta autenticada no coincide con el de la declaración. Vuelva a preparar la firma.';
  if (token.email_verified !== true) return 'Su correo no está verificado. Complete el paso 1 de «Habilitarme».';
  if (token.sign_in_provider !== PROVEEDOR) return 'Debe autenticarse con su correo y contraseña.';
  if (!Number.isInteger(token.auth_time)) return 'No se pudo leer la hora de su autenticación. Escriba de nuevo su contraseña.';
  const referencia = Number.isInteger(token.iat) ? token.iat * 1000 : ahoraMs;
  if (referencia - token.auth_time * 1000 > TOPES.reautenticacionMs) return 'La autenticación venció (más de 5 minutos). Escriba de nuevo su contraseña.';
  const authMs = token.auth_time * 1000;
  if (congelado.publicadoEnMs != null && !(authMs > congelado.publicadoEnMs)) return MSG_SESION_ANTES_DE_PUBLICAR;
  if (congelado.rol === 'responsable' && congelado.aztEnMs != null && !(authMs > congelado.aztEnMs)) return MSG_SESION_ANTES_DEL_AZT;
  if (!esHuella(congelado.huellaVista)) return 'La firma preparada no tiene huella.';
  return null;
}

/**
 * v0 + las firmas que haya, VERIFICADO contra la huellaVista de los actos: con el del AZT,
 * debe salir lo que él vio; con los dos, lo que vio el Responsable. Sin actos, el original
 * (su huella es la publicada). Devuelve {bytes, huella, firmas: 0|1|2}.
 */
export async function componerVerificado({ odt, bytesV0, actos = {}, PDFLib } = {}) {
  exigirZonas(odt);
  const a = actos.azt; const r = actos.responsable;
  if (r && !a) falla('huella', 'Está la firma del Responsable sin la del AZT: no se muestra. Avise al administrador.');
  if (!a) {
    const hx = await huella(bytesV0);
    if (hx !== odt.huella) falla('huella', 'El original no coincide con su huella.');
    return { bytes: bytesV0.slice(), huella: hx, firmas: 0 };
  }
  const conAzt = await verificarActoAzt({ odt, bytesV0, actoAzt: a, PDFLib });
  if (!r) return { ...conAzt, firmas: 1 };
  if (!odt.firmantes || r.uid !== odt.firmantes.responsable.uid) falla('huella', 'La firma del Responsable no es de la persona asignada.');
  const c = await componerConHuella(bytesV0, { azt: { imagen: a.imagen }, responsable: { imagen: r.imagen, cierre: r.cierre } }, { PDFLib, zonas: odt.zonas });
  if (c.huella !== r.huellaVista) falla('huella', 'La ODT recompuesta no coincide con la que firmó el Responsable. Avise al administrador.');
  return { ...c, firmas: 2 };
}

/** «Ver la ODT en pantalla»: lo mismo que componerVerificado (nunca una vista sin comprobar). */
export const componerParaVer = componerVerificado;

/**
 * La ODT firmada para DESCARGAR: se compone UNA vez, se hulla y se exige que sea
 * lo que vio el Responsable. Devuelve {bytes, huella, nombre}.
 */
export async function prepararDescarga({ odt, bytesV0, actos = {}, PDFLib } = {}) {
  if (!odt || odt.estado !== ESTADOS.LISTA) falla('estado', 'Solo se descarga una ODT con las dos firmas (estado «Lista»).');
  if (!actos.azt || !actos.responsable) falla('estado', 'Faltan firmas en la ODT.');
  const c = await componerVerificado({ odt, bytesV0, actos, PDFLib });
  return { bytes: c.bytes, huella: c.huella, nombre: nombreArchivo(odt.nro) };
}

/**
 * Descargar de punta a punta, con las piezas inyectadas: componer → registrar → entregar ESE Blob.
 * Si el registro falla, NO se entrega (la salida sin registro no existe, L-107).
 */
export async function descargarOdt({ odt, bytesV0, actos, PDFLib, registrar, entregar }) {
  const d = await prepararDescarga({ odt, bytesV0, actos, PDFLib });
  await registrar(odt.id, d.huella);
  const blob = entregar(d.bytes, d.nombre);
  return { ...d, blob };
}
