// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · componer el PDF firmado (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Idea central del diseño (DISENO-FINAL §1): el PDF firmado NO se guarda. Se arma
// SIEMPRE así:  componer(v0, {azt?, responsable?}, {PDFLib, zonas})
//   · v0 = el PDF original publicado (bytes verificados por huella);
//   · cada acto trae la IMAGEN de la firma (bytes PNG de firmas/{uid}, que la
//     regla comparó byte a byte) y el del Responsable su cierre {si, fecha}, su
//     `compositor` y su `nro`;
//   · la VERSIÓN la decide el compositor del acto del Responsable (2026-11-21):
//       'odt-afinia@1' (o sin compositor): X en SI y la FECHA CIERRE, nada más; los
//         bytes son EXACTAMENTE los de siempre (ODT ya firmadas: su huellaVista se
//         sigue recomponiendo igual; prueba de oro en tests/odt_afinia_componer.test.js);
//       'odt-afinia@2': lo mismo y, además, el N.º de la ODT en «ODT GENERADA N°»,
//         16 pt debajo de la FECHA CIERRE (zonas.fecha.y − ESTAMPA.dyGenerada; las
//         etiquetas impresas miden 156,3 y 140,2 pt). La posición se DERIVA de
//         zonas.fecha: la forma de odt.zonas guardada no cambia (la regla pide 4 claves).
//     La etapa del AZT (sin Responsable) es idéntica en @1 y @2;
//   · pdf-lib 1.17.1 llega INYECTADO (el vendorizado en el navegador, el de
//     node_modules en las pruebas): este módulo no importa librerías ni toca el DOM.
// Es DETERMINISTA: mismos bytes de entrada → mismos bytes de salida (misma
// SHA-256). pdf-lib 1.17.1 nombra los recursos con un generador con semilla fija
// por documento y `updateMetadata:false` no escribe fechas ni «Producer». Así
// cualquiera puede recomponer y comparar con `huellaVista` del acto.
// Nadie escribe bytes de PDF después de publicar ⇒ nadie toca la casilla del otro.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { tamanoFirma } from './firmas_tamano.js';
import { TOPES, esNro } from './odt_afinia_rutas.js';
import { versionDeComposicion, COMPOSITOR_V2 } from './odt_afinia_cierre.js';
import { esZonas } from './odt_afinia_zonas.js';
import { esFechaDMA } from './odt_afinia_textos.js';
import { esPdf, huella } from './odt_afinia_partes.js';

/**
 * Medidas del estampado (pt). Firma: misma SUPERFICIE para todas (firmas_tamano.js, `99 §101`).
 * `dyGenerada` (clave AGREGADA con @2, cambio compatible): también sirve de marca para que un
 * consumidor nuevo sepa que este módulo ya sabe componer @2 (L-102: caché de 10 min).
 */
export const ESTAMPA = Object.freeze({
  areaPt2: 2400,      // superficie buscada de la firma
  altoMaxPt: 30,      // alto máximo (la casilla mide 34,5)
  margenPt: 2,        // la firma no toca los bordes de la casilla
  tamX: 8,            // «X» en SI, Helvetica 8
  tamFecha: 7,        // FECHA CIERRE y (@2) el N.º de ODT GENERADA, Helvetica 7
  dyGenerada: 16.0    // @2: el N.º va 16 pt debajo de la FECHA CIERRE (misma x)
});

/** Punto donde @2 escribe el N.º de «ODT GENERADA N°»: derivado de zonas.fecha (redondeado a 0,01 pt). */
const puntoGenerada = (zonas) => ({ x: zonas.fecha.x, y: Math.round((zonas.fecha.y - ESTAMPA.dyGenerada) * 100) / 100 });

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** ¿Bytes de un PNG? */
export function esPng(b) {
  return b instanceof Uint8Array && b.length > 8 && PNG.every((x, i) => b[i] === x);
}

/** Bytes de la imagen de un acto: Uint8Array, ArrayBuffer o Bytes de Firestore (toUint8Array). */
function bytesDeImagen(img) {
  if (img instanceof Uint8Array) return img;
  if (img instanceof ArrayBuffer) return new Uint8Array(img);
  if (img && typeof img.toUint8Array === 'function') return img.toUint8Array();
  return null;
}

/**
 * Rectángulo de la firma dentro de la casilla: tamaño de tamanoFirma con
 * anchoMax/altoMax descontando el margen, CENTRADO.
 * @param {{x:number,y:number,w:number,h:number}} zona
 * @param {number} rel  ancho / alto de la imagen
 * @returns {{x:number, y:number, ancho:number, alto:number}}
 */
export function rectFirma(zona, rel) {
  const m = ESTAMPA.margenPt;
  const { ancho, alto } = tamanoFirma(rel, {
    area: ESTAMPA.areaPt2,
    altoMax: Math.min(ESTAMPA.altoMaxPt, zona.h - 2 * m),
    anchoMax: zona.w - 2 * m
  });
  return { x: zona.x + (zona.w - ancho) / 2, y: zona.y + (zona.h - alto) / 2, ancho, alto };
}

function validarActo(rol, acto) {
  const img = bytesDeImagen(acto && acto.imagen);
  if (!img) throw new TypeError('El acto ' + rol + ' no trae la imagen de la firma.');
  if (!esPng(img)) throw new TypeError('La firma del acto ' + rol + ' no es un PNG.');
  if (img.length > TOPES.imagenFirma) throw new TypeError('La firma del acto ' + rol + ' pasa de 900 KB.');
  return img;
}

/**
 * Arma el PDF firmado.
 * @param {Uint8Array} bytesV0  el PDF original (no se modifica)
 * @param {{azt?:{imagen:Uint8Array}, responsable?:{imagen:Uint8Array, cierre:{si:true, fecha:string}, compositor?:string, nro?:string}}} actos
 *        responsable.compositor: 'odt-afinia@1' (o ausente) o 'odt-afinia@2' (exige responsable.nro de 8 dígitos)
 * @param {{PDFLib:{PDFDocument:any, StandardFonts:any, rgb:Function}, zonas:object}} dep
 * @returns {Promise<Uint8Array>}  sin actos: una COPIA exacta de v0 (lo que se ve es lo publicado)
 */
export async function componer(bytesV0, actos = {}, { PDFLib, zonas } = {}) {
  const v0 = bytesV0 instanceof Uint8Array ? bytesV0 : (bytesV0 instanceof ArrayBuffer ? new Uint8Array(bytesV0) : null);
  if (!v0 || !esPdf(v0)) throw new TypeError('El original no es un PDF.');
  if (!PDFLib || !PDFLib.PDFDocument || !PDFLib.StandardFonts || typeof PDFLib.rgb !== 'function') throw new TypeError('Falta pdf-lib.');
  if (!esZonas(zonas)) throw new TypeError('Faltan las zonas de la ODT.');
  const a = actos || {};
  if (a.responsable && !a.azt) throw new TypeError('La firma del Responsable va después de la del AZT.');
  if (!a.azt && !a.responsable) return v0.slice();

  const imgAzt = a.azt ? validarActo('azt', a.azt) : null;
  const imgResp = a.responsable ? validarActo('responsable', a.responsable) : null;
  const cierre = a.responsable && a.responsable.cierre;
  if (a.responsable && (!cierre || cierre.si !== true || !esFechaDMA(cierre.fecha))) {
    throw new TypeError('El cierre del Responsable necesita SI y una fecha dd/mm/aaaa.');
  }
  // Versión: la del acto del Responsable (sin Responsable no hay pie de cierre que estampar).
  const version = a.responsable ? versionDeComposicion(a.responsable.compositor) : null;
  const nroGenerada = version === COMPOSITOR_V2 ? a.responsable.nro : null;
  if (version === COMPOSITOR_V2 && !esNro(nroGenerada)) {
    throw new TypeError('El compositor ' + COMPOSITOR_V2 + ' necesita el N.º de la ODT (8 dígitos) para «ODT GENERADA N°».');
  }

  // Copia: pdf-lib no debe compartir memoria con el v0 que otro módulo puede pasar a pdf.js.
  const doc = await PDFLib.PDFDocument.load(v0.slice(), { updateMetadata: false });
  if (doc.getPageCount() !== TOPES.paginas) throw new TypeError('La ODT debe tener ' + TOPES.paginas + ' páginas.');
  const pagina = doc.getPage(doc.getPageCount() - 1);

  // Orden FIJO (AZT y luego Responsable): el orden de los objetos decide los bytes.
  for (const [rol, img] of [['azt', imgAzt], ['responsable', imgResp]]) {
    if (!img) continue;
    const png = await doc.embedPng(img);
    const r = rectFirma(zonas[rol], png.width / png.height);
    pagina.drawImage(png, { x: r.x, y: r.y, width: r.ancho, height: r.alto });
  }
  if (imgResp) {
    const fuente = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const negro = PDFLib.rgb(0, 0, 0);
    pagina.drawText('X', { x: zonas.si.x, y: zonas.si.y, size: ESTAMPA.tamX, font: fuente, color: negro });
    pagina.drawText(cierre.fecha, { x: zonas.fecha.x, y: zonas.fecha.y, size: ESTAMPA.tamFecha, font: fuente, color: negro });
    // @2: el N.º de la ODT en «ODT GENERADA N°». Con @1 no se escribe nada más (mismos bytes que siempre).
    if (nroGenerada) {
      const p = puntoGenerada(zonas);
      pagina.drawText(nroGenerada, { x: p.x, y: p.y, size: ESTAMPA.tamFecha, font: fuente, color: negro });
    }
  }
  return await doc.save();
}

/** Arma UNA vez y devuelve los bytes con su huella (L-107: se muestra, se huella y se entrega lo mismo). */
export async function componerConHuella(bytesV0, actos, dep) {
  const bytes = await componer(bytesV0, actos, dep);
  return { bytes, huella: await huella(bytes) };
}
