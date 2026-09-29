// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · ANCHO REAL DE UN TEXTO EN ARIAL (sin DOM)
// ──────────────────────────────────────────────────────────────────────────────
// El dibujo de «Salud y riesgo» elige para cada texto el tamaño más grande que
// cabe en su casilla (el Ingeniero, 2026-09-28: «procede» a agrandar el texto
// pequeño). Con un ancho PROMEDIO por letra (0,53 em; 0,58 en negrita) se
// equivocaba: en negrita sobraba entre 8 y 19 % y «Riesgo tolerable» salía más
// chico que antes; con mayúsculas anchas (M, W) se quedaba corto (revisión
// adversarial 2026-09-28). Aquí van los anchos de cada letra de Arial (los de
// Helvetica, sus mismas medidas), en milésimas del tamaño de la letra.
//
// Función PURA: cero DOM; da lo mismo en el navegador que en las pruebas.
// Archivo NUEVO a propósito (L-102): lo importa solo `salud-riesgo-excel.js`.
// ══════════════════════════════════════════════════════════════════════════════

/** Anchos de «espacio» a «~» (códigos 32 a 126), en milésimas del tamaño. */
const NORMAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,   // espacio ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,   // 0-9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,  // @ A-O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,   // P-Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,   // ` a-o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584         // p-z { | } ~
];
const NEGRITA = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];
/** Signos fuera de ese rango que usa la hoja (los mismos en normal y en negrita). */
const OTROS = {
  '·': 278, '–': 556, '—': 1000, '…': 1000, '×': 584, '≥': 549, '≤': 549, '«': 556, '»': 556,
  '°': 400, '¿': 611, '¡': 333, '↓': 1000, '↑': 1000, '→': 1000, '←': 1000, 'í': 278, 'ì': 278, 'î': 278, 'ï': 278
};
/** Letra desconocida: se cuenta ancha, para que nunca se salga de su casilla. */
const DESCONOCIDA = 1000;
/** Margen por redondeo de cada programa al pintar. */
const HOLGURA = 1.02;

/** Ancho de UNA letra, en milésimas del tamaño. */
function anchoLetra(c, negrita) {
  if (OTROS[c] != null) return OTROS[c];
  let k = c.charCodeAt(0);
  if (k < 32 || k > 126) {
    // Letras con tilde o eñe: el ancho de su letra base (á → a, Ñ → N).
    const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base.length === 1 && base !== c) k = base.charCodeAt(0);
  }
  if (k < 32 || k > 126) return DESCONOCIDA;
  return (negrita ? NEGRITA : NORMAL)[k - 32];
}

/**
 * Ancho en píxeles de `texto` en Arial de `tam` px (negrita si `negrita`).
 * Incluye una holgura de 2 %: puede sobrar un poco, nunca faltar.
 */
export function anchoArial(texto, tam, negrita) {
  let s = 0;
  for (const c of String(texto == null ? '' : texto)) s += anchoLetra(c, !!negrita);
  return s / 1000 * tam * HOLGURA;
}
