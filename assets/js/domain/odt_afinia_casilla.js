// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · ¿la casilla ya trae algo? (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Caso que el módulo quiere evitar: la casilla del AZT llega ya firmada desde
// otra herramienta. Adobe Fill&Sign deja la firma como ANOTACIÓN (Ink, Stamp,
// FreeText…) o como trazos/imagen en el contenido, así que se juntan DOS señales
// (comité W-11, arq):
//   1. anotaciones de la página (`page.getAnnotations()` de pdf.js, {subtype, rect})
//      cuyo rectángulo toca la casilla → ocupada;
//   2. fracción de TINTA: la página se pinta con anotaciones y se cuentan los
//      píxeles oscuros dentro de la casilla reducida 2 pt → ocupada si pasa el umbral.
// Aquí no se pinta nada: se reciben las anotaciones y los píxeles (RGBA) ya
// extraídos, para poder probarlo en Node con arreglos sintéticos.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CLAVES_ZONA } from './odt_afinia_zonas.js';

/**
 * Fracción de píxeles oscuros a partir de la cual la casilla está ocupada.
 * CALIBRADO el 2026-11-20 en local con seis ODT reales (cinco vacías: tinta 0 en las
 * cuatro casillas; una firmada con Fill&Sign: la señal más débil, SI, es unas 5 veces
 * este umbral). Lo mismo para CAJA_SI y CAJA_FECHA (a lo largo de toda la raya, sin
 * tocar la raya, el borde ni las etiquetas). En el repo quedan solo los números (P5).
 * Medido con el canvas de Node: falta confirmarlo una vez en el navegador real.
 * La revisión ESTRUCTURAL (odt_afinia_estructura.js) es la segunda señal, sin raster.
 */
export const UMBRAL_TINTA = 0.003;
/** Luminancia (0-255) por debajo de la cual un píxel cuenta como tinta. */
export const LUMA_TINTA = 160;
/** Se mira la casilla reducida este margen por lado (descarta las líneas de la celda). */
export const MARGEN_INTERIOR_PT = 2;
/** Cajas de las casillas de cierre alrededor del punto de escritura (pt). */
export const CAJA_SI = Object.freeze({ izq: 19, abajo: 2.5, ancho: 44, alto: 13.5 });
export const CAJA_FECHA = Object.freeze({ izq: 3.5, abajo: 2.5, ancho: 93.5, alto: 13.5 });

/** Rectángulo {x,y,w,h} desde [x1,y1,x2,y2] en cualquier orden. */
export function rectDeArreglo(r) {
  const [a, b, c, d] = (r || []).map(Number);
  return { x: Math.min(a, c), y: Math.min(b, d), w: Math.abs(c - a), h: Math.abs(d - b) };
}

/** ¿Se tocan? (borde con borde cuenta). */
export function intersecta(a, b) {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/** Rectángulo reducido `m` por lado (nunca negativo). */
export function reducir(r, m) {
  const w = Math.max(0, r.w - 2 * m); const h = Math.max(0, r.h - 2 * m);
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

/** Rectángulo de la casilla `clave` (azt | responsable | si | fecha) en pt. */
export function cajaDe(zonas, clave) {
  const z = zonas && zonas[clave];
  if (!z) throw new TypeError('Zona desconocida: ' + clave);
  if (clave === 'si') return { x: z.x - CAJA_SI.izq, y: z.y - CAJA_SI.abajo, w: CAJA_SI.ancho, h: CAJA_SI.alto };
  if (clave === 'fecha') return { x: z.x - CAJA_FECHA.izq, y: z.y - CAJA_FECHA.abajo, w: CAJA_FECHA.ancho, h: CAJA_FECHA.alto };
  return { x: z.x, y: z.y, w: z.w, h: z.h };
}

/** Rectángulo donde se MIDE la tinta de una casilla: su caja reducida MARGEN_INTERIOR_PT. */
export const rectTinta = (zonas, clave) => reducir(cajaDe(zonas, clave), MARGEN_INTERIOR_PT);

/**
 * Rectángulo en pt (origen abajo) → píxeles del lienzo (origen arriba), enteros
 * y recortados al lienzo si se da su tamaño.
 */
export function rectAPixeles(r, { escala, altoPagina, anchoPx, altoPx } = {}) {
  if (!(escala > 0) || !(altoPagina > 0)) throw new TypeError('Faltan escala y alto de página.');
  let x0 = Math.floor(r.x * escala); let y0 = Math.floor((altoPagina - (r.y + r.h)) * escala);
  let x1 = Math.ceil((r.x + r.w) * escala); let y1 = Math.ceil((altoPagina - r.y) * escala);
  if (anchoPx > 0) { x0 = Math.max(0, x0); x1 = Math.min(anchoPx, x1); }
  if (altoPx > 0) { y0 = Math.max(0, y0); y1 = Math.min(altoPx, y1); }
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/**
 * Fracción (0..1) de píxeles oscuros dentro de `rectPx` de una imagen RGBA.
 * Un píxel transparente cuenta como papel blanco.
 */
export function fraccionTinta(rgba, anchoPx, altoPx, rectPx, { luma = LUMA_TINTA } = {}) {
  const x0 = Math.max(0, rectPx.x); const y0 = Math.max(0, rectPx.y);
  const x1 = Math.min(anchoPx, rectPx.x + rectPx.w); const y1 = Math.min(altoPx, rectPx.y + rectPx.h);
  const total = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  if (!total) return 0;
  let oscuros = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * anchoPx + x) * 4;
      const al = rgba[i + 3] / 255;
      // Sobre papel blanco: lo transparente se ve blanco.
      const r = rgba[i] * al + 255 * (1 - al); const g = rgba[i + 1] * al + 255 * (1 - al); const b = rgba[i + 2] * al + 255 * (1 - al);
      if (0.299 * r + 0.587 * g + 0.114 * b < luma) oscuros++;
    }
  }
  return oscuros / total;
}

/**
 * ¿Ocupada? {ocupada, motivos:['anotacion:Ink', 'tinta:0.034']}.
 * @param {{rect:{x:number,y:number,w:number,h:number}, anotaciones?:Array<{subtype?:string, rect:number[]}>, tinta?:number|null, umbral?:number}} p
 */
export function casillaOcupada({ rect, anotaciones = [], tinta = null, umbral = UMBRAL_TINTA } = {}) {
  const motivos = [];
  for (const a of anotaciones || []) {
    if (!a || !Array.isArray(a.rect)) continue;
    if (intersecta(rectDeArreglo(a.rect), rect)) motivos.push('anotacion:' + (a.subtype || 'desconocida'));
  }
  if (typeof tinta === 'number' && Number.isFinite(tinta) && tinta > umbral) motivos.push('tinta:' + tinta.toFixed(3));
  return { ocupada: motivos.length > 0, motivos };
}

/**
 * Revisa varias casillas de una vez (al publicar: las cuatro; al firmar: la del
 * rol y, para el Responsable, SI y FECHA). `tintas[clave]` es la fracción ya
 * medida en la casilla reducida, o null si no se pudo medir (entonces NO se da
 * por vacía: `sinMedir` la lista y ok es false).
 * @returns {{ok:boolean, ocupadas:Array<{clave:string, motivos:string[]}>, sinMedir:string[]}}
 */
export function revisarCasillas(zonas, { anotaciones = [], tintas = {}, umbral = UMBRAL_TINTA } = {}, claves = CLAVES_ZONA) {
  const ocupadas = []; const sinMedir = [];
  for (const clave of claves) {
    const t = tintas ? tintas[clave] : undefined;
    if (typeof t !== 'number' || !Number.isFinite(t)) sinMedir.push(clave);
    const r = casillaOcupada({ rect: cajaDe(zonas, clave), anotaciones, tinta: t, umbral });
    if (r.ocupada) ocupadas.push({ clave, motivos: r.motivos });
  }
  return { ok: ocupadas.length === 0 && sinMedir.length === 0, ocupadas, sinMedir };
}

/** Casillas que se revisan al firmar cada rol. */
export const CASILLAS_DEL_ROL = Object.freeze({
  azt: Object.freeze(['azt']),
  responsable: Object.freeze(['responsable', 'si', 'fecha'])
});
