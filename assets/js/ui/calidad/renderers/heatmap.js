// Renderer · Heatmap categoría × mes

import { $, COLORS, LAYOUT_BASE, PLOTLY_CFG, metricaNombre } from './_helpers.js';
import { catTotals, categoriasDeZona } from '../../../domain/saidi_calculo.js';

export function renderHeatmap(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const src = categoriasDeZona(dataset, zona, met);
  const cats = catTotals(dataset, zona, met).map(d => d.cat);
  const z = cats.map(c => src[c] || []);
  Plotly.react('chart-heat', [{
    z, x: dataset.meses, y: cats, type: 'heatmap',
    colorscale: [[0, '#F8FAFC'], [0.5, '#FCA5A5'], [1, COLORS.RED]],
    hovertemplate: '%{y}<br>%{x}: %{z}<extra></extra>',
    colorbar: { title: { text: metricaNombre(met), side: 'right', font: { size: 10 } }, thickness: 12 },
  }], {
    ...LAYOUT_BASE,
    margin: { l: 240, r: 10, t: 6, b: 30 },
    yaxis: { tickfont: { size: 9 }, automargin: true },
    xaxis: { side: 'top' },
  }, PLOTLY_CFG);
  const pill = $('#heat-pill');
  if (pill) pill.textContent = metricaNombre(met) + ' absoluto';
}
