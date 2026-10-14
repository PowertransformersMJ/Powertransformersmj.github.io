// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · IMÁGENES (lienzo)
// ──────────────────────────────────────────────────────────────────────────────
// Decisión 5: cada foto se REDIBUJA en un lienzo antes de subirla. Así:
//   · se reduce (manda el peso: ≈ 160 KB, lado mayor 1600 → 1280 → 1000 px);
//   · se gira según su orientación (la del celular) y queda derecha;
//   · se pierden el EXIF y la ubicación GPS (un lienzo nunca los copia) — y se
//     comprueba en los bytes de salida antes de entregarla.
// Reglas y topes en `domain/informe_brigada_fotos.js` (probados con node).
// Se carga con import() solo al subir una imagen o al armar el Word (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import {
  PARAMS_FOTO, PARAMS_ANEXO, PARAMS_FICHA, PARAMS_FIRMA, PARAMS_LOGO,
  planEscalado, intentosJpeg, elegirResultado, validarEntrada, metadatosEn, pesoLegible
} from '../../domain/informe_brigada_fotos.js';
import { huellaHex } from '../../domain/fichas_adjunto.js';

const ROJO_OVALO = '#EE0000';
const ANCHO_FOTO_PT = 229.8;       // ancho de una foto en la cuadrícula de dos columnas (para el grosor de 1,5 pt)

const bytesDe = async (blob) => new Uint8Array(await blob.arrayBuffer());

/** Decodifica respetando la orientación de la cámara. → { fuente, ancho, alto, cerrar() } */
async function decodificar(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { fuente: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => { try { bmp.close(); } catch (_) { /* nada */ } } };
    } catch (_) { /* algunos Safari no aceptan la opción: se intenta con <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();                               // los navegadores actuales aplican la orientación EXIF a <img>
    return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new Error('El navegador no pudo abrir esta imagen. Guárdela como JPG o PNG e inténtelo de nuevo.');
  }
}

function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  return c;
}
function soltar(c) { c.width = 0; c.height = 0; }      // libera la memoria del lienzo (iPhone tiene poca)

function aBlob(c, tipo, calidad) {
  return new Promise((ok, mal) => {
    c.toBlob((b) => (b ? ok(b) : mal(new Error('El navegador no pudo convertir la imagen.'))), tipo, calidad);
  });
}

/** Dibuja `fuente` escalada en un lienzo nuevo; fondo blanco si va a JPEG (la transparencia no existe en JPEG). */
function dibujar(fuente, ancho, alto, { fondoBlanco }) {
  const c = lienzo(ancho, alto);
  const g = c.getContext('2d');
  if (fondoBlanco) { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, ancho, alto); }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(fuente, 0, 0, ancho, alto);
  return c;
}

async function leerYValidar(archivo) {
  if (!archivo) throw new Error('No se eligió ningún archivo.');
  const bytes = await bytesDe(archivo);
  const v = validarEntrada(bytes);
  if (!v.ok) throw new Error(v.mensaje);
  return bytes;
}

/** Último control: lo que sale del lienzo NO lleva metadatos (si los llevara, no se entrega). */
async function cerrarSalida(blob, mime, ancho, alto, avisos) {
  const bytes = await bytesDe(blob);
  const meta = metadatosEn(bytes);
  if (meta.length) throw new Error(`La imagen conserva metadatos (${meta.join(', ')}); no se sube. Avise a soporte.`);
  return { blob, mime, ancho, alto, tamano: bytes.length, huella: await huellaHex(bytes), avisos };
}

/** Reducción a JPEG con la regla «manda el peso». */
async function aJpeg(dec, params, etiqueta) {
  const resultados = [];
  for (const intento of intentosJpeg(params, dec.ancho, dec.alto)) {
    const ultimo = resultados[resultados.length - 1];
    let c = ultimo && ultimo.ancho === intento.ancho && ultimo.alto === intento.alto ? ultimo.lienzo : null;
    if (!c) {
      if (ultimo && ultimo.lienzo) soltar(ultimo.lienzo);
      c = dibujar(dec.fuente, intento.ancho, intento.alto, { fondoBlanco: true });
    }
    const blob = await aBlob(c, 'image/jpeg', intento.calidad);
    resultados.push({ ...intento, blob, tamano: blob.size, lienzo: c });
    if (blob.size <= params.objetivo) break;
  }
  const ult = resultados[resultados.length - 1];
  if (ult && ult.lienzo) soltar(ult.lienzo);
  const elegido = elegirResultado(resultados, params);
  if (!elegido) throw new Error(`${etiqueta} es demasiado pesada aun reducida (más de ${pesoLegible(params.tope)}). Recórtela o tómela de nuevo.`);
  const avisos = [];
  if (elegido.tamano > params.objetivo) avisos.push(`${etiqueta} quedó en ${pesoLegible(elegido.tamano)} (tiene mucho detalle); se guardó así.`);
  return { blob: elegido.blob, ancho: elegido.ancho, alto: elegido.alto, avisos };
}

async function prepararJpeg(archivo, params, etiqueta, { pngPrimero = false } = {}) {
  await leerYValidar(archivo);
  const dec = await decodificar(archivo);
  try {
    if (pngPrimero) {
      const m = planEscalado(dec.ancho, dec.alto, params.escalones[0]);
      const c = dibujar(dec.fuente, m.ancho, m.alto, { fondoBlanco: true });
      const png = await aBlob(c, 'image/png');
      soltar(c);
      if (png.size <= params.objetivo) return cerrarSalida(png, 'image/png', m.ancho, m.alto, []);
    }
    const r = await aJpeg(dec, params, etiqueta);
    return cerrarSalida(r.blob, 'image/jpeg', r.ancho, r.alto, r.avisos);
  } finally {
    dec.cerrar();
  }
}

/** ¿El dibujo tiene fondo transparente? (muestra una rejilla de puntos: basta con que alguno no sea opaco). */
function tieneTransparencia(c) {
  try {
    const g = c.getContext('2d');
    const { data } = g.getImageData(0, 0, c.width, c.height);
    const paso = Math.max(1, Math.floor(Math.sqrt((c.width * c.height) / 40000)));
    for (let y = 0; y < c.height; y += paso) {
      for (let x = 0; x < c.width; x += paso) if (data[(y * c.width + x) * 4 + 3] < 250) return true;
    }
    return false;
  } catch (_) { return null; }   // no se pudo saber
}

async function prepararPng(archivo, params, etiqueta) {
  await leerYValidar(archivo);
  const dec = await decodificar(archivo);
  try {
    for (const lado of params.escalones) {
      const m = planEscalado(dec.ancho, dec.alto, lado);
      const c = dibujar(dec.fuente, m.ancho, m.alto, { fondoBlanco: false });
      const transparente = tieneTransparencia(c);
      const png = await aBlob(c, 'image/png');
      soltar(c);
      if (png.size <= params.tope) return { ...(await cerrarSalida(png, 'image/png', m.ancho, m.alto, [])), transparente };
    }
    throw new Error(`${etiqueta} es demasiado pesada (más de ${pesoLegible(params.tope)}). Use una imagen más pequeña.`);
  } finally {
    dec.cerrar();
  }
}

/** Foto de una cuadrícula → JPEG ≈ 160 KB, sin EXIF/GPS y derecha. */
export function prepararFoto(archivo) { return prepararJpeg(archivo, PARAMS_FOTO, 'La foto'); }
/** Imagen de anexo (consignación): PNG si cabe (texto nítido), si no JPEG. */
export function prepararImagenAnexo(archivo) { return prepararJpeg(archivo, PARAMS_ANEXO, 'La imagen del anexo', { pngPrimero: true }); }
/** Ficha técnica de fabricante (imagen). */
export function prepararFicha(archivo) { return prepararJpeg(archivo, PARAMS_FICHA, 'La ficha técnica'); }
/** Firma de un tercero: PNG transparente (se estampa solo al EMITIR). */
export function prepararFirma(archivo) { return prepararPng(archivo, PARAMS_FIRMA, 'La firma'); }
/** Logo de la marca: PNG (conserva la transparencia). */
export function prepararLogo(archivo) { return prepararPng(archivo, PARAMS_LOGO, 'El logo'); }

/**
 * Hornea óvalos rojos (#EE0000, 1,5 pt a la escala de la foto en el papel) dentro
 * de una COPIA de la foto, para el Word. La foto guardada no cambia.
 * @param {Blob} blob
 * @param {{x:number, y:number, w:number, h:number}[]} marcas  fracciones 0..1 de la foto
 * @param {number} [anchoPt]  ancho con que se ve la foto en el papel (pt)
 * @returns {Promise<Blob>} JPEG
 */
export async function hornearMarcas(blob, marcas, anchoPt = ANCHO_FOTO_PT) {
  const lista = (Array.isArray(marcas) ? marcas : []).filter((m) => m && m.w > 0 && m.h > 0);
  if (!lista.length) return blob;
  const dec = await decodificar(blob);
  try {
    const c = dibujar(dec.fuente, dec.ancho, dec.alto, { fondoBlanco: true });
    const g = c.getContext('2d');
    g.strokeStyle = ROJO_OVALO;
    g.lineWidth = Math.max(2, dec.ancho * 1.5 / (Number(anchoPt) > 0 ? Number(anchoPt) : ANCHO_FOTO_PT));
    for (const m of lista) {
      const rx = (m.w * dec.ancho) / 2, ry = (m.h * dec.alto) / 2;
      g.beginPath();
      g.ellipse(m.x * dec.ancho + rx, m.y * dec.alto + ry, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      g.stroke();
    }
    const salida = await aBlob(c, 'image/jpeg', 0.9);
    soltar(c);
    return salida;
  } finally {
    dec.cerrar();
  }
}
