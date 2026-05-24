// Renderer · Participación acumulada por categoría (barras h)

import { layoutBase, plotlyCfg, categoriaColor, fmt, metricaNombre } from './_helpers.js';
import { catTotals } from '../../../domain/saidi_calculo.js';

export function renderPart(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const t = catTotals(dataset, zona, met).slice().reverse();
  const layout = layoutBase();
  layout.margin = { l: 170, r: 30, t: 6, b: 30 };
  layout.yaxis = { ...layout.yaxis, tickfont: { size: 9 }, automargin: true };
  layout.xaxis = { ...layout.xaxis, title: { text: metricaNombre(met) + ' acumulado', font: { size: 10 } } };
  Plotly.react('chart-part', [{
    x: t.map(d => d.tot), y: t.map(d => d.cat),
    type: 'bar', orientation: 'h',
    marker: { color: t.map(d => categoriaColor(d.cat)) },
    text: t.map(d => fmt(d.tot, 3)), textposition: 'outside', textfont: { size: 9 },
  }], layout, plotlyCfg());
}
