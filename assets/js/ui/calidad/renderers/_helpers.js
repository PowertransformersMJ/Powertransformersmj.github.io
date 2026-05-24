// ══════════════════════════════════════════════════════════════
// Helpers comunes de los renderers del módulo Indicadores de Calidad
// ══════════════════════════════════════════════════════════════

import { COLORS, GCOL, font, layoutBase, plotlyCfg, categoriaColor, grupoCorto, GRUPOS, metricaNombre, metricaUnidad, metricaTitulo, METRIC_COLOR, colorGrupoMetrica, metKey } from '../../../domain/saidi_config.js';

export const $ = (s) => document.querySelector(s);

// Formateador es-CO (3 decimales por default)
export function fmt(v, d = 3) {
  if (v == null || !Number.isFinite(+v)) return '—';
  return Number(v).toLocaleString('es-CO', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
}

// Etiqueta corta con unidad: ej. "SAIDI_E (h-eq)" o "SAIFI_E (int-eq)"
export function metricaLabel(met) {
  if (met === 'ambos') return 'SAIDI_E (h-eq) · SAIFI_E (int-eq)';
  return `${metricaNombre(met)} (${metricaUnidad(met)})`;
}

// Devuelve un array de métricas concretas a partir del selector global.
// Si met = 'ambos' → ['saidi', 'saifi']; en otro caso → [met].
export function metricasActivas(met) {
  return met === 'ambos' ? ['saidi', 'saifi'] : [met];
}

export { COLORS, GCOL, font, layoutBase, plotlyCfg, categoriaColor, grupoCorto, GRUPOS, metricaNombre, metricaUnidad, metricaTitulo, METRIC_COLOR, colorGrupoMetrica, metKey };
