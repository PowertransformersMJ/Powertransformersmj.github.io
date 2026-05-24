// ══════════════════════════════════════════════════════════════
// Helpers comunes de los renderers del módulo Indicadores de Calidad
// ══════════════════════════════════════════════════════════════

import { COLORS, GCOL, FONT, LAYOUT_BASE, PLOTLY_CFG, categoriaColor, grupoCorto, GRUPOS, metricaNombre, metKey } from '../../../domain/saidi_config.js';

export const $ = (s) => document.querySelector(s);

// Formateador es-CO (3 decimales por default)
export function fmt(v, d = 3) {
  if (v == null || !Number.isFinite(+v)) return '—';
  return Number(v).toLocaleString('es-CO', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
}

export { COLORS, GCOL, FONT, LAYOUT_BASE, PLOTLY_CFG, categoriaColor, grupoCorto, GRUPOS, metricaNombre, metKey };
