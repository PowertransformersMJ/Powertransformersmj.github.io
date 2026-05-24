// Renderer · Heatmap categoría × mes

import { $, layoutBase, plotlyCfg, metricaLabel, metricaNombre, metricaUnidad, metricasActivas } from './_helpers.js';
import { catTotals, categoriasDeZona } from '../../../domain/saidi_calculo.js';

// Paleta de calor legible para valores bajos:
//   mint (0%) → amber-50 → amber-200 → amber-400 → orange-500 →
//   red-500 → red-900 (pico crítico).
const HEAT_COLORSCALE = [
  [0.00, '#ECFDF5'],
  [0.05, '#FEF3C7'],
  [0.20, '#FDE68A'],
  [0.40, '#FBBF24'],
  [0.60, '#F97316'],
  [0.80, '#EF4444'],
  [1.00, '#7F1D1D'],
];

// Construye un trace heatmap a partir de una métrica concreta
function buildHeatTrace(dataset, zona, m, opts = {}) {
  const src = categoriasDeZona(dataset, zona, m);
  const cats = catTotals(dataset, zona, m).map(d => d.cat);
  const z = cats.map(c => src[c] || []);
  const text = z.map(row => row.map(v => (v == null || +v < 0.005) ? '' : (+v).toFixed(2)));
  const unidad = metricaUnidad(m);
  return {
    z, x: dataset.meses, y: cats, type: 'heatmap',
    colorscale: HEAT_COLORSCALE,
    text, texttemplate: '%{text}',
    textfont: { size: 10, color: '#1E293B', family: 'Inter, sans-serif' },
    hovertemplate: `<b>%{y}</b><br>%{x}: %{z:.4f} ${unidad}<extra>${metricaNombre(m)}</extra>`,
    xgap: 2, ygap: 2,
    colorbar: {
      title: { text: `${metricaNombre(m)} (${unidad})`, side: 'right', font: { size: 10 } },
      thickness: 14, tickfont: { size: 9 }, outlinewidth: 0,
      ...(opts.colorbar || {}),
    },
    xaxis: opts.xaxis || 'x',
    yaxis: opts.yaxis || 'y',
  };
}

export function renderHeatmap(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const layout = layoutBase();
  const pill = $('#heat-pill');

  if (isAmbos) {
    // Dos heatmaps lado a lado · panel izq SAIDI · panel der SAIFI
    const trSaidi = buildHeatTrace(dataset, zona, 'saidi', {
      xaxis: 'x',  yaxis: 'y',
      colorbar: { x: 0.46, len: 0.95, y: 0.5 },
    });
    const trSaifi = buildHeatTrace(dataset, zona, 'saifi', {
      xaxis: 'x2', yaxis: 'y2',
      colorbar: { x: 1.02, len: 0.95, y: 0.5 },
    });
    layout.margin = { l: 220, r: 90, t: 60, b: 20 };
    layout.grid = { rows: 1, columns: 2, pattern: 'independent', xgap: 0.18 };
    layout.xaxis  = { domain: [0.00, 0.42], side: 'top', tickfont: { size: 11, color: '#0F172A' }, title: { text: 'SAIDI_E (h-eq)', font: { size: 11 }, standoff: 14 } };
    layout.yaxis  = { tickfont: { size: 9 }, automargin: true };
    layout.xaxis2 = { domain: [0.55, 0.97], side: 'top', tickfont: { size: 11, color: '#0F172A' }, title: { text: 'SAIFI_E (int-eq)', font: { size: 11 }, standoff: 14 } };
    layout.yaxis2 = { tickfont: { size: 9 }, automargin: true, anchor: 'x2' };
    Plotly.react('chart-heat', [trSaidi, trSaifi], layout, plotlyCfg());
    if (pill) pill.textContent = 'SAIDI_E (h-eq) + SAIFI_E (int-eq)';
  } else {
    layout.margin = { l: 240, r: 70, t: 50, b: 20 };
    layout.yaxis = { tickfont: { size: 9 }, automargin: true };
    layout.xaxis = { side: 'top', tickfont: { size: 12, color: '#0F172A' }, ticks: 'outside', ticklen: 4, automargin: true };
    Plotly.react('chart-heat', [buildHeatTrace(dataset, zona, met)], layout, plotlyCfg());
    if (pill) pill.textContent = metricaLabel(met) + ' absoluto';
  }
}
