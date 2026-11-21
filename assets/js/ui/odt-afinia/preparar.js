// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · PREPARAR, VERIFICAR, VER y DESCARGAR (sin DOM)
// ──────────────────────────────────────────────────────────────────────────────
// La lógica del flujo de firma que no necesita pantalla (se prueba en Node):
//   · prepararFirma  → al pulsar «Preparar» se arma el PDF compuesto UNA vez y se
//                      CONGELA una copia con uid, nombre, correo, imagen, huellas,
//                      estado y rev (L-112). Lo que se muestra, lo que se firma
//                      (huellaVista) y lo que se sube salen de ESA copia (L-107).
//   · verificarAntesDeFirmar → SOLO compatibilidad (L-102): la firmar.js de antes del
//                      2026-11-21 (contraseña en cada firma) la llama; desde entonces
//                      es la misma verificación que verificarSesionParaFirmar
//                      (data/odt_afinia_sesion.js): cuenta viva = la de la copia, sesión
//                      de esa cuenta y ese correo, con correo y contraseña y correo
//                      verificado. Sin ventana de 5 min ni paliativo D5: la regla ya no
//                      los pide (decisión del Ingeniero del 2026-11-21).
//   · verificarActoAzt → el Responsable recompone v0 + firma del AZT y exige la
//                      huella que el AZT vio (nadie tocó nada fuera de su casilla).
//   · componerParaVer → lo que se muestra en «Ver la ODT»: verificado contra la
//                      huellaVista de los actos, con su huella a la vista.
//   · prepararDescarga → compone v0 + las dos firmas, huella, y exige que sea la
//                      que vio el Responsable; se registra y se entrega ESE Blob
//                      (ODT LISTA o CERRADA en Afinia).
// Antes de componer, las zonas guardadas en la ODT se comparan con las del formato
// (±3 pt): la regla solo mira su forma.
// Pie de cierre (2026-11-21): la FECHA CIERRE es la fecha PREVISTA de la orden
// (odt.fechaTrabajo; no se edita) y el compositor vigente ('odt-afinia@2') estampa además
// el N.º en «ODT GENERADA N°». Al Preparar se compone con el COMPOSITOR vigente y la copia
// lo guarda, con el pie completo en su cierre {si, fecha, generada} (cierreDelResponsable);
// al recomponer (Ver, verificar, Descargar) manda el compositor del acto del Responsable:
// un acto @1 se recompone igual que siempre; uno @2 debe traer generada == N.º de la ODT.
// Si el módulo que compone quedó viejo en la caché (no sabe @2), no se prepara ni se
// verifica una firma @2: se pide recargar.
// pdf-lib llega INYECTADO. Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { TOPES, COMPOSITOR } from '../../domain/odt_afinia_rutas.js';
import { cambioFirma, rolDe } from '../../domain/odt_afinia_estados.js';
import { declaracion, errorFechaCierre, nombreArchivo } from '../../domain/odt_afinia_textos.js';
import { componerConHuella, ESTAMPA } from '../../domain/odt_afinia_componer.js';
import {
  COMPOSITOR_V2, COMPOSITOR_VIGENTE, MSG_RECARGAR, MSG_RECARGAR_FIRMA, fechaCierreDe, cierreDelResponsable, puedeDescargar
} from '../../domain/odt_afinia_cierre.js';
import { errorZonasGuardadas } from '../../domain/odt_afinia_zonas.js';
import { huella } from '../../domain/odt_afinia_partes.js';
import { ErrorOdt } from '../../data/odt_afinia_lotes.js';
import { MSG_IDENTIDAD_CAMBIO } from '../../data/odt_afinia.js';
import { HUELLA_MI_FIRMA_DISTINTA } from '../../data/odt_afinia_mi_firma.js';
// Archivo NUEVO (L-102): la verificación de la sesión para firmar (sin contraseña reciente).
import { verificarSesionParaFirmar } from '../../data/odt_afinia_sesion.js';

const falla = (codigo, mensaje) => { throw new ErrorOdt(codigo, mensaje); };

/** ¿El módulo que compone ya sabe @2? (ESTAMPA.dyGenerada llegó con @2; L-102: caché de 10 min). */
const componerSabeV2 = () => !!ESTAMPA && Number.isFinite(ESTAMPA.dyGenerada);
/** Al preparar una firma NUEVA: el compositor vigente y el módulo que compone, de la MISMA entrega. */
function exigirCompositorAlDia() {
  if (COMPOSITOR !== COMPOSITOR_VIGENTE || !componerSabeV2()) falla('estado', MSG_RECARGAR_FIRMA);
}

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
 * @param {string} [p.fechaCierre] solo el Responsable: la fecha PREVISTA de la orden (odt.fechaTrabajo);
 *                                 si falta, se usa esa; si llega otra, no se prepara
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

  exigirCompositorAlDia();
  let cierre = null;
  let actosComponer;
  const imagen = miFirma.imagen.slice();
  if (rol === 'azt') {
    actosComponer = { azt: { imagen } };
  } else {
    // FECHA CIERRE = la fecha PREVISTA de la orden (no se edita). Si llega otra, se dice en llano.
    const prevista = fechaCierreDe(odt);
    const fecha = fechaCierre == null || fechaCierre === '' ? prevista : fechaCierre;
    const err = errorFechaCierre(fecha, { fechaTrabajo: prevista, ahora });
    if (err) falla('validacion', err);
    await verificarActoAzt({ odt, bytesV0, actoAzt: actos.azt, PDFLib });
    if (actos.azt.uid === sesion.uid) falla('sin_permiso', 'La misma cuenta no puede firmar las dos casillas.');
    // El pie completo queda en la copia y en el acto: {si, fecha (la prevista), generada (el N.º)}.
    cierre = cierreDelResponsable(odt, fecha);
    // Con el compositor vigente (@2): además de la X y la fecha, el N.º en «ODT GENERADA N°».
    actosComponer = { azt: { imagen: actos.azt.imagen }, responsable: { imagen, cierre, compositor: COMPOSITOR_VIGENTE, nro: cierre.generada } };
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
    compositor: COMPOSITOR_VIGENTE,         // con el que se armó lo que ve (y lo que firma el acto)
    bytes: compuesto.bytes,
    huellaVista: compuesto.huella,
    declaracion: Object.freeze(decl),
    preparadoEnMs: ahora.getTime()
  });
}

/**
 * Compatibilidad (L-102): la firmar.js de antes del 2026-11-21 (que pedía la contraseña en cada firma) llama a
 * esta función desde una caché vieja. Desde esa fecha es EXACTAMENTE verificarSesionParaFirmar: la cuenta viva y
 * la sesión son las de la copia; sin ventana de 5 minutos ni paliativo D5 (la regla ya no los pide). La firmar.js
 * nueva llama directo a verificarSesionParaFirmar. Se puede quitar cuando ninguna caché tenga la firmar.js vieja.
 * @param {object} congelado
 * @param {{uidVivo:string|null, token:object}} p
 * @returns {string|null}  el motivo para abortar, o null
 */
export function verificarAntesDeFirmar(congelado, { uidVivo, token } = {}) {
  return verificarSesionParaFirmar(congelado, { uidVivo, token });
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
  // La versión la decide el acto del Responsable: @1 se recompone como siempre; @2 lleva su N.º.
  if (r.compositor === COMPOSITOR_V2 && !componerSabeV2()) falla('estado', MSG_RECARGAR);
  // @2: el N.º estampado es el que dice su cierre (`generada`), y es el de ESTA ODT.
  if (r.compositor === COMPOSITOR_V2 && (r.nro !== odt.nro || !r.cierre || r.cierre.generada !== odt.nro)) {
    falla('huella', 'La firma del Responsable es de otro N.º de ODT. Avise al administrador.');
  }
  const resp = { imagen: r.imagen, cierre: r.cierre, compositor: r.compositor, nro: r.nro };
  const c = await componerConHuella(bytesV0, { azt: { imagen: a.imagen }, responsable: resp }, { PDFLib, zonas: odt.zonas });
  if (c.huella !== r.huellaVista) falla('huella', 'La ODT recompuesta no coincide con la que firmó el Responsable. Avise al administrador.');
  return { ...c, firmas: 2 };
}

/** «Ver la ODT en pantalla»: lo mismo que componerVerificado (nunca una vista sin comprobar). */
export const componerParaVer = componerVerificado;

/**
 * La ODT firmada para DESCARGAR: se compone UNA vez, se hulla y se exige que sea
 * lo que vio el Responsable. Devuelve {bytes, huella, nombre}. Se descarga una ODT LISTA
 * o CERRADA en Afinia (la regla del registro de descargas exige lo mismo).
 */
export async function prepararDescarga({ odt, bytesV0, actos = {}, PDFLib } = {}) {
  if (!puedeDescargar(odt)) falla('estado', 'Solo se descarga una ODT con las dos firmas (estado «Lista» o «Cerrada en Afinia»).');
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
