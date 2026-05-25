// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · SEVERIDAD
// Funciones puras para calcular nivel de severidad y métricas
// derivadas (pct, cmax) sobre un transformador del dataset.
// ══════════════════════════════════════════════════════════════

import { UMBRALES_SEVERIDAD, DEVANADOS, DEV_LABEL } from './cargabilidad_config.js';

/**
 * Clasifica una cargabilidad % en uno de los 5 niveles:
 *   null     → 'nd'
 *   > 100    → 'cri'
 *   >= 95    → 'ale'
 *   >= 80    → 'avi'
 *   otro     → 'ok'
 */
export function sev(pct) {
  if (pct == null) return 'nd';
  if (pct > UMBRALES_SEVERIDAD.CRI) return 'cri';
  if (pct >= UMBRALES_SEVERIDAD.ALE) return 'ale';
  if (pct >= UMBRALES_SEVERIDAD.AVI) return 'avi';
  return 'ok';
}

/**
 * Recalcula `pct` por devanado (car / amp · 100) y `cmax` (máximo
 * de los 3 devanados con dato) en un transformador.
 * También fija el campo `dev` con el nombre del devanado dominante.
 *
 * Muta el objeto in-place — pensado para datasets que se actualizan
 * en simulación tiempo real.
 */
export function recompute(d) {
  if (!d) return d;
  DEVANADOS.forEach(w => {
    const o = d[w];
    if (!o) return;
    o.pct = (o.amp && o.car != null) ? +(o.car / o.amp * 100).toFixed(1) : o.pct;
  });
  const vals = DEVANADOS.map(w => d[w] && d[w].pct).filter(v => v != null);
  d.cmax = vals.length ? Math.max(...vals) : null;
  if (!vals.length) {
    d.dev = null;
  } else if (d.P && d.P.pct === d.cmax) d.dev = DEV_LABEL.P;
  else if   (d.S && d.S.pct === d.cmax) d.dev = DEV_LABEL.S;
  else d.dev = DEV_LABEL.T;
  return d;
}

/**
 * Devuelve el % de cargabilidad según el devanado seleccionado.
 * - devSel === 'all' → usa cmax (el máximo de los 3 devanados)
 * - 'P' | 'S' | 'T' → usa pct de ese devanado específico
 */
export function metricPct(d, devSel = 'all') {
  if (!d) return null;
  if (devSel === 'all') return d.cmax;
  return d[devSel] ? d[devSel].pct : null;
}

/**
 * Aplica recompute a todo un array (mutando in-place) y devuelve
 * el mismo array para encadenar.
 */
export function recomputeAll(rows) {
  if (!Array.isArray(rows)) return rows;
  rows.forEach(recompute);
  return rows;
}
