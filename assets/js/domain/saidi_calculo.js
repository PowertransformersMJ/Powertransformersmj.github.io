// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · CÁLCULOS
// ──────────────────────────────────────────────────────────────
// Agregadores PUROS sobre el dataset del dashboard SAIDI_E/SAIFI_E.
// Sin DOM ni I/O. Cada función recibe el `dataset` completo (con
// shape del baseline JSON) y los selectores (zona, met).
// ══════════════════════════════════════════════════════════════

import { metKey } from './saidi_config.js';

/**
 * @typedef {Object} SaidiDataset
 * @property {string[]} meses           Ene..May (parcial)
 * @property {string[]} meses_full      Ene..Dic
 * @property {string[]} cats_order
 * @property {Object<string,ZonaData>} zonas  TODAS, BOLIVAR, OCCIDENTE, ORIENTE
 * @property {KPISummary} kpi
 * @property {ProjBlock}  proj_global
 *
 * @typedef {Object} ZonaData
 * @property {number[]} total_saidi
 * @property {number[]} total_saifi
 * @property {Object<string, number[]>} grp_saidi   {Sobrecarga, Racion, Otras}
 * @property {Object<string, number[]>} grp_saifi
 * @property {Object<string, number[]>} cat_saidi   por categoría
 * @property {Object<string, number[]>} cat_saifi
 * @property {ProjBlock} proj
 *
 * @typedef {Object} ProjBlock
 * @property {(number|null)[]} real
 * @property {number[]} base, opt, pes, ci_inf, ci_sup
 * @property {number} r2, slope, pval
 */

// ── Suma de una serie (skip null) ─────────────────────────────
export function sumSerie(serie) {
  if (!Array.isArray(serie)) return 0;
  return serie.reduce((s, v) => s + (v == null ? 0 : Number(v) || 0), 0);
}

// ── Promedio de una serie (skip null) ─────────────────────────
export function avgSerie(serie) {
  if (!Array.isArray(serie) || !serie.length) return 0;
  const filtrados = serie.filter(v => v != null && Number.isFinite(+v));
  if (!filtrados.length) return 0;
  return filtrados.reduce((s, v) => s + Number(v), 0) / filtrados.length;
}

// ── Crecimiento % entre primero y último valor ────────────────
// Devuelve null si el primer valor es 0 (división por cero).
export function growthPct(serie) {
  if (!Array.isArray(serie) || serie.length < 2) return null;
  const first = +serie[0];
  const last = +serie[serie.length - 1];
  if (!first || !Number.isFinite(first)) return null;
  if (!Number.isFinite(last)) return null;
  return Math.round((last / first - 1) * 100);
}

// ── Variación % mes a mes (longitud N, primer elemento null) ──
//   varMoM([1, 2, 1.5]) → [null, 100, -25]
export function varMoM(serie) {
  if (!Array.isArray(serie)) return [];
  return serie.map((v, i) => {
    if (i === 0) return null;
    const prev = +serie[i - 1];
    if (!prev || !Number.isFinite(prev)) return null;
    if (!Number.isFinite(+v)) return null;
    return (+v / prev - 1) * 100;
  });
}

// ── Totales acumulados por categoría (ordenados desc) ─────────
// Devuelve [{cat, tot}] solo de categorías con total > 0,
// ordenadas de mayor a menor.
export function catTotals(dataset, zona, met) {
  const z = dataset?.zonas?.[zona];
  if (!z) return [];
  const src = z[metKey('cat', met)] || {};
  const out = [];
  for (const cat of dataset.cats_order || []) {
    const serie = src[cat] || [];
    const tot = sumSerie(serie);
    if (tot > 0) out.push({ cat, tot });
  }
  out.sort((a, b) => b.tot - a.tot);
  return out;
}

// ── Series por grupo de una zona y métrica ────────────────────
// Devuelve un objeto {grupo → serie} con los 3 grupos canónicos.
export function gruposDeZona(dataset, zona, met) {
  const z = dataset?.zonas?.[zona];
  if (!z) return {};
  return z[metKey('grp', met)] || {};
}

// ── Series por categoría de una zona y métrica ────────────────
export function categoriasDeZona(dataset, zona, met) {
  const z = dataset?.zonas?.[zona];
  if (!z) return {};
  return z[metKey('cat', met)] || {};
}

// ── Total del sistema (serie de la zona) ──────────────────────
export function totalSerieDeZona(dataset, zona, met) {
  const z = dataset?.zonas?.[zona];
  if (!z) return [];
  return z[met === 'saifi' ? 'total_saifi' : 'total_saidi'] || [];
}

// ── Serie diaria de la zona para un mes-calendario (0–11) ────
// Devuelve el array de 31 días (índice 0 = día 1) con el total del
// mes para la métrica, o null si el dataset no trae detalle diario
// (solo el path crudo de la hoja DATOS lo produce).
export function serieDiariaDeZona(dataset, zona, met, mesIdx) {
  const d = dataset?.dias?.[zona]?.[mesIdx];
  if (!d) return null;
  const serie = met === 'saifi' ? d.saifi : d.saidi;
  return Array.isArray(serie) ? serie : null;
}

// ── Proyección de la zona ────────────────────────────────────
export function proyeccionDeZona(dataset, zona) {
  return dataset?.zonas?.[zona]?.proj || null;
}

// ── Listado de zonas disponibles ──────────────────────────────
export function listarZonas(dataset) {
  if (!dataset?.zonas) return [];
  return Object.keys(dataset.zonas);
}
