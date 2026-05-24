// Renderer · Participación acumulada por categoría (barras h)

import { LAYOUT_BASE, PLOTLY_CFG, categoriaColor, fmt, metricaNombre } from './_helpers.js';
import { catTotals } from '../../../domain/saidi_calculo.js';

export function renderPart(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const t = catTotals(dataset, zona, met).slice().reverse();
  Plotly.react('chart-part', [{
    x: t.map(d => d.tot), y: t.map(d => d.cat),
    type: 'bar', orientation: 'h',
    marker: { color: t.map(d => categoriaColor(d.cat)) },
    text: t.map(d => fmt(d.tot, 3)), textposition: 'outside', textfont: { size: 9 },
  }], {
    ...LAYOUT_BASE,
    margin: { l: 170, r: 30, t: 6, b: 30 },
    yaxis: { ...LAYOUT_BASE.yaxis, tickfont: { size: 9 }, automargin: true },
    xaxis: { ...LAYOUT_BASE.xaxis, title: { text: metricaNombre(met) + ' acumulado', font: { size: 10 } } },
  }, PLOTLY_CFG);
}
