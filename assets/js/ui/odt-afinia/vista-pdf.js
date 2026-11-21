// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · ver y LEER un PDF con pdf.js
// ──────────────────────────────────────────────────────────────────────────────
// · pintarPdf: dibuja TODAS las páginas de unos bytes en lienzos (para revisar
//   «las dos páginas» antes de firmar). Los lienzos no se imprimen (CSS
//   @media print): imprimir sería una salida sin registro (L-107).
// · leerParaPublicar: texto de cada página, anotaciones de la última y fracción
//   de tinta de cada casilla (la última página pintada CON anotaciones).
// pdf.js 4.x vacía (transfiere al worker) el búfer que recibe: SIEMPRE se le
// pasa una COPIA (bytes.slice()), nunca el original que luego va a pdf-lib
// (comité W-11, arq «un solo búfer»).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { cargarPdfJs, PDFJS_CMAP_URL, PDFJS_FONTS_URL, PDFJS_OPCIONES_SEGURAS } from '../../pdfjs-loader.js';
import { itemsDePdfjs } from '../../domain/odt_afinia_formato.js';
import { rectTinta, rectAPixeles, fraccionTinta } from '../../domain/odt_afinia_casilla.js';
import { h, vaciar, bloquearCopia } from './comun.js';

/** Abre unos bytes con pdf.js (sobre una COPIA). */
async function abrir(bytes) {
  const lib = await cargarPdfJs();
  const tarea = lib.getDocument({
    data: bytes.slice(),
    cMapUrl: PDFJS_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDFJS_FONTS_URL,
    ...PDFJS_OPCIONES_SEGURAS
  });
  return { lib, pdf: await tarea.promise };
}

/** Lienzo con la página pintada a `escala` (anotaciones incluidas). */
async function pintarPagina(lib, pagina, escala) {
  const vp = pagina.getViewport({ scale: escala });
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.ceil(vp.width); lienzo.height = Math.ceil(vp.height);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const modo = lib.AnnotationMode ? lib.AnnotationMode.ENABLE : undefined;
  await pagina.render({ canvasContext: ctx, viewport: vp, annotationMode: modo }).promise;
  return { lienzo, ctx, vp };
}

/**
 * Pinta todas las páginas en `contenedor`.
 * @param {Uint8Array} bytes
 * @param {HTMLElement} contenedor
 * @param {{titulo?:string, huella?:string}} [op]
 * @returns {Promise<{paginas:number}>}
 */
export async function pintarPdf(bytes, contenedor, { titulo, huella } = {}) {
  vaciar(contenedor);
  const cargando = h('p', { class: 'odt-cargando', text: 'Abriendo el PDF…' });
  contenedor.appendChild(cargando);
  const { lib, pdf } = await abrir(bytes);
  try {
    cargando.remove();
    if (titulo) contenedor.appendChild(h('p', { class: 'odt-vista-titulo', text: titulo }));
    if (huella) contenedor.appendChild(h('p', { class: 'odt-mini odt-mono', title: huella, text: 'Huella SHA-256 de lo que ve: ' + huella }));
    const ancho = Math.min(900, Math.max(320, (contenedor.clientWidth || 800) - 8));
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n);
      const base = p.getViewport({ scale: 1 });
      const escala = Math.min(2, (ancho / base.width) * (globalThis.devicePixelRatio || 1));
      const { lienzo } = await pintarPagina(lib, p, escala);
      lienzo.className = 'odt-lienzo';
      bloquearCopia(lienzo);   // sin «Guardar imagen como…» ni arrastre: la única salida es «Descargar» (L-107)
      lienzo.setAttribute('aria-label', 'Página ' + n + ' de ' + pdf.numPages);
      contenedor.appendChild(h('figure', { class: 'odt-pagina' }, lienzo, h('figcaption', { text: 'Página ' + n + ' de ' + pdf.numPages })));
    }
    return { paginas: pdf.numPages };
  } finally {
    try { await pdf.destroy(); } catch (_) { /* nada */ }
  }
}

/**
 * Lo que el dominio necesita para validar una ODT al publicar.
 * @param {Uint8Array} bytes
 * @returns {Promise<{itemsPorPagina:Array<Array>, anotaciones:Array<{subtype:string, rect:number[]}>,
 *                    medirTintas:(zonas:object, claves:string[])=>Promise<Record<string, number>>, paginas:number}>}
 */
export async function leerParaPublicar(bytes) {
  const { lib, pdf } = await abrir(bytes);
  const itemsPorPagina = [];
  let ultima; let anotaciones;
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n);
      itemsPorPagina.push(itemsDePdfjs(await p.getTextContent()));
    }
    ultima = await pdf.getPage(pdf.numPages);
    anotaciones = (await ultima.getAnnotations({ intent: 'display' }) || [])
      .filter((a) => a && Array.isArray(a.rect))
      .map((a) => ({ subtype: a.subtype || '', rect: a.rect.slice() }));
  } catch (e) {
    // Si falla después de abrir, el documento no queda vivo en el worker de pdf.js.
    try { await pdf.destroy(); } catch (_) { /* nada */ }
    throw e;
  }
  const ESCALA = 2;
  let pintada = null;
  return {
    itemsPorPagina,
    anotaciones,
    paginas: pdf.numPages,
    /** Fracción de tinta de cada casilla (la página se pinta una sola vez). */
    async medirTintas(zonas, claves) {
      if (!pintada) pintada = await pintarPagina(lib, ultima, ESCALA);
      const { lienzo, ctx } = pintada;
      const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
      const altoPagina = ultima.view[3] - ultima.view[1];
      const out = {};
      for (const c of claves) {
        const px = rectAPixeles(rectTinta(zonas, c), { escala: ESCALA, altoPagina, anchoPx: lienzo.width, altoPx: lienzo.height });
        out[c] = fraccionTinta(img.data, lienzo.width, lienzo.height, px);
      }
      return out;
    },
    /** Libera el documento y el lienzo de la medición (se llama al cambiar de archivo, al publicar y al salir). */
    async cerrar() {
      if (pintada) { pintada.lienzo.width = 0; pintada.lienzo.height = 0; pintada = null; }
      try { await pdf.destroy(); } catch (_) { /* nada */ }
    }
  };
}
