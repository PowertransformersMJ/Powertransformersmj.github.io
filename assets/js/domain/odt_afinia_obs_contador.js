// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · «POR SUBSANAR» · el CONTADOR de la pestaña (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del 2026-11-24: el número de la pestaña contaba PUNTOS y solo lo explicaba un `title`, así que se leía como
// número de ODT. Ahora lo dice con palabras (cifras de ejemplo, inventadas):
//   · AZT:            «12 ODT · 40 puntos»        (sus ODT ABIERTAS · los puntos PENDIENTES que le tocan subsanar)
//   · administrador:  «12 ODT · 5 por verificar»  (las ODT ABIERTAS · los puntos SUBSANADOS que le toca verificar)
// Sale de la lista que la pestaña ya lee (el `resumen` de cada obs trae el estado de cada punto): ninguna consulta de más.
// `corto` es solo el número de ODT (para un celular, si no cabe todo) y `etiqueta` la frase completa (aria-label y
// title de la pestaña). Si la lista llegó al tope de la consulta (`tope`: solo se leyeron las más recientes), las
// cifras son un mínimo y lo dicen: «12+ ODT · 40+ puntos», y la frase empieza por «al menos».
// Sin Firebase, sin DOM, sin red. Archivo NUEVO a propósito (L-102): todo lo que exporta es nuevo; a su vecino de
// antes (odt_afinia_obs.js) solo le pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { contar, estaAbierta, esAztDe } from './odt_afinia_obs.js';

const num = (n) => Number(n || 0).toLocaleString('es-CO');

/**
 * El contador de la pestaña «Por subsanar» para la sesión.
 * @param {object[]} lista  las obs que ve la sesión (con su `resumen`)
 * @param {{uid?:string, esAdmin?:boolean}} sesion
 * @param {{tope?:boolean}} [op]  tope: la lista llegó al tope de la consulta (puede haber más obs que no se leyeron)
 * @returns {{odts:number, puntos:number, tope:boolean, texto:string, corto:string, resto:string, etiqueta:string}}
 */
export function contadorPorSubsanar(lista, sesion = {}, op = {}) {
  const admin = !!(sesion && sesion.esAdmin);
  const tope = !!(op && op.tope === true);
  let odts = 0; let puntos = 0;
  for (const o of lista || []) {
    if (!estaAbierta(o)) continue;
    if (admin) { odts++; puntos += contar(o).subsanados; } else if (esAztDe(o, sesion && sesion.uid)) { odts++; puntos += contar(o).pendientes; }
  }
  // Con tope, las cifras son un mínimo: «+» junto a cada una («1+ puntos», en plural) y «al menos» en la frase.
  const mas = tope ? '+' : '';
  const corto = num(odts) + mas + ' ODT';
  const resto = admin ? num(puntos) + mas + ' por verificar' : num(puntos) + mas + (puntos === 1 && !tope ? ' punto' : ' puntos');
  const inicio = 'Por subsanar: ' + (tope ? 'al menos ' : '');
  const fin = tope ? ' (solo se leyeron las más recientes: puede haber más)' : '';
  const etiqueta = admin
    ? inicio + num(odts) + (odts === 1 ? ' ODT abierta' : ' ODT abiertas') + ' y ' + num(puntos) + (puntos === 1 ? ' punto subsanado' : ' puntos subsanados') + ' por verificar' + fin
    : inicio + num(odts) + (odts === 1 ? ' ODT abierta suya' : ' ODT abiertas suyas') + ' con ' + num(puntos) + (puntos === 1 ? ' punto pendiente' : ' puntos pendientes') + ' por subsanar' + fin;
  return { odts, puntos, tope, texto: corto + ' · ' + resto, corto, resto, etiqueta };
}
