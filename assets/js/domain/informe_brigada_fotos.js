// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · FOTOS (reglas puras)
// ──────────────────────────────────────────────────────────────────────────────
// Decisión 5 del Ingeniero: las fotos se guardan con el informe, REDUCIDAS en el
// navegador (≈ 140 KB, lado mayor ≈ 1600 px, JPEG) y SIN metadatos (EXIF ni
// ubicación GPS), respetando la orientación. Aquí, sin lienzo ni red, lo que se
// puede probar con `node --test`: los topes, el plan de escalado, la lectura de
// medidas y la detección de metadatos en los bytes. El lienzo vive en
// `ui/informe-brigada/imagenes.js`.
//
// «~140 KB» y «~1600 px» no siempre caben juntos (medido en 60 fotos reales de
// celular: a 1000 px y calidad 0,80 la mediana ya es 136 KB). Regla: MANDA EL
// PESO. Se prueba a 1600 px bajando la calidad; si no baja del objetivo, se baja
// el lado (1600 → 1280 → 1000). Las constantes están aquí, en un solo sitio.
// ══════════════════════════════════════════════════════════════════════════════

import { clasificarArchivo, tipoPorBytes } from './fichas_adjunto.js';

/** Fotos de las cuadrículas: objetivo 160 KB; tope 700 KB (el de las reglas de Storage). */
export const PARAMS_FOTO = Object.freeze({ escalones: Object.freeze([1600, 1280, 1000]), calidades: Object.freeze([0.82, 0.74, 0.66, 0.58]), objetivo: 160 * 1024, tope: 700 * 1024 });
/** Imagen de anexo (pantallazo de la consignación): PNG si cabe (texto nítido), si no JPEG. */
export const PARAMS_ANEXO = Object.freeze({ escalones: Object.freeze([2200, 1800, 1400]), calidades: Object.freeze([0.86, 0.78, 0.70]), objetivo: 450 * 1024, tope: 700 * 1024, pngSiCabe: true });
/** Ficha técnica de fabricante (imagen): más resolución para que se lea. */
export const PARAMS_FICHA = Object.freeze({ escalones: Object.freeze([2200, 1800]), calidades: Object.freeze([0.86, 0.78, 0.70]), objetivo: 900 * 1024, tope: 2 * 1024 * 1024 });
/** Firma de un tercero: PNG que conserva la transparencia. */
export const PARAMS_FIRMA = Object.freeze({ escalones: Object.freeze([1200, 900]), png: true, tope: 512 * 1024 });
/** Logo de la marca: PNG (transparencia) o JPEG si ya venía así. */
export const PARAMS_LOGO = Object.freeze({ escalones: Object.freeze([1200]), png: true, tope: 1024 * 1024 });

/**
 * Medidas de destino para un lado mayor `ladoMax`; NUNCA agranda.
 * @returns {{ ancho: number, alto: number }} enteros ≥ 1
 */
export function planEscalado(ancho, alto, ladoMax) {
  const w = Math.max(1, Math.round(Number(ancho) || 1));
  const h = Math.max(1, Math.round(Number(alto) || 1));
  const k = Math.min(1, (Number(ladoMax) || Infinity) / Math.max(w, h));
  return { ancho: Math.max(1, Math.round(w * k)), alto: Math.max(1, Math.round(h * k)) };
}

/**
 * Intentos en orden (lado, calidad) para JPEG: primero el lado grande bajando la
 * calidad; luego el lado siguiente. Los lados que no reducen nada se colapsan en uno.
 */
export function intentosJpeg(params, ancho, alto) {
  const out = [];
  const vistos = new Set();
  for (const lado of params.escalones) {
    const m = planEscalado(ancho, alto, lado);
    const clave = `${m.ancho}x${m.alto}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    for (const calidad of (params.calidades || [0.85])) out.push({ ...m, calidad });
  }
  return out;
}

/**
 * Elige el resultado: el primero que quede ≤ objetivo; si ninguno, el más liviano
 * ≤ tope; si ni así, null (la foto no cabe: se avisa en español).
 * @param {{ tamano: number }[]} resultados  en el orden de los intentos
 */
export function elegirResultado(resultados, params) {
  const lista = (resultados || []).filter((r) => r && r.tamano > 0);
  const primero = lista.find((r) => params.objetivo && r.tamano <= params.objetivo);
  if (primero) return primero;
  const caben = lista.filter((r) => r.tamano <= params.tope).sort((a, b) => a.tamano - b.tamano);
  return caben[0] || null;
}

/* ── lectura de bytes ─────────────────────────────────────────────────────── */

const aBytes = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b || []));
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
const esJpeg = (b) => b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
const esPng = (b) => b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;

/** Segmentos de un JPEG hasta el inicio de la imagen (SOS): [{ marcador, inicio, largo }]. */
function segmentosJpeg(b) {
  const out = [];
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xFF) break;
    const m = b[i + 1];
    if (m === 0xFF) { i += 1; continue; }                       // relleno
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    if (m === 0xD9) break;
    const largo = (b[i + 2] << 8) | b[i + 3];
    if (largo < 2) break;
    out.push({ marcador: m, inicio: i + 4, largo: largo - 2 });
    if (m === 0xDA) break;                                      // empieza la imagen
    i += 2 + largo;
  }
  return out;
}

/** ¿El JPEG trae un segmento APP1 «Exif»? (ahí van la ubicación GPS y la orientación) */
export function tieneExif(bytes) {
  const b = aBytes(bytes);
  if (!esJpeg(b)) return false;
  return segmentosJpeg(b).some((s) => s.marcador === 0xE1 && s.largo >= 6 && ascii(b, s.inicio, 6) === 'Exif\u0000\u0000');
}

/**
 * ¿La imagen trae metadatos que puedan delatar ubicación o equipo? JPEG: Exif, XMP
 * (APP1) o IPTC/Photoshop (APP13). PNG: bloques eXIf, tEXt, zTXt o iTXt.
 * @returns {string[]} nombres de lo encontrado ([] = limpia)
 */
export function metadatosEn(bytes) {
  const b = aBytes(bytes);
  const out = [];
  if (esJpeg(b)) {
    for (const s of segmentosJpeg(b)) {
      if (s.marcador === 0xE1 && ascii(b, s.inicio, 6) === 'Exif\u0000\u0000') out.push('Exif');
      else if (s.marcador === 0xE1 && ascii(b, s.inicio, 28) === 'http://ns.adobe.com/xap/1.0/') out.push('XMP');
      else if (s.marcador === 0xED) out.push('IPTC');
    }
  } else if (esPng(b)) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 8;
    while (i + 8 <= b.length) {
      const n = v.getUint32(i);
      const tipo = ascii(b, i + 4, 4);
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(tipo)) out.push(tipo);
      if (tipo === 'IEND') break;
      i += 12 + n;
    }
  }
  return [...new Set(out)];
}

/** Tipo y medidas por los bytes (JPEG: marcador SOFn; PNG: IHDR). */
export function dimensionesImagen(bytes) {
  const b = aBytes(bytes);
  if (esPng(b)) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { tipo: 'png', ancho: v.getUint32(16), alto: v.getUint32(20) };
  }
  if (esJpeg(b)) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      const largo = (b[i + 2] << 8) | b[i + 3];
      const sof = (m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF);
      if (sof) return { tipo: 'jpeg', alto: (b[i + 5] << 8) | b[i + 6], ancho: (b[i + 7] << 8) | b[i + 8] };
      if (m === 0xDA || m === 0xD9) break;
      i += 2 + largo;
    }
  }
  return null;
}

const SOLO_IMAGENES = 'Solo se admiten imágenes (JPG o PNG). Si es un documento, tómele una captura y adjunte la imagen.';

/**
 * ¿Se puede usar este archivo como imagen? (por sus BYTES, nunca por la extensión)
 * Reutiliza la regla de Fichas (`fichas_adjunto.js`): tope 15 MB, HEIC con su mensaje.
 * @returns {{ ok: true, tipo: string } | { ok: false, mensaje: string }}
 */
export function validarEntrada(bytes) {
  const b = aBytes(bytes);
  const r = clasificarArchivo(b);
  if (!r.ok) {
    // De Fichas sirven el de archivo vacío, el de HEIC y el del tope de peso; los que hablan
    // de Excel (tipo desconocido o .xls antiguo) no aplican a una foto del informe.
    const t = b.length ? tipoPorBytes(b) : 'vacio';
    return { ok: false, mensaje: (t === null || t === 'ole') ? SOLO_IMAGENES : r.mensaje };
  }
  if (r.clase !== 'imagen') return { ok: false, mensaje: SOLO_IMAGENES };
  return { ok: true, tipo: r.tipo };
}

/** «138 KB» · «1,2 MB» (para los avisos). */
export function pesoLegible(n) {
  const b = Number(n) || 0;
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;
}
