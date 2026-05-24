// Renderer · Stack barras mensuales por grupo de causa

import { $, GCOL, GRUPOS, layoutBase, plotlyCfg, metricaNombre } from './_helpers.js';
import { gruposDeZona } from '../../../domain/saidi_calculo.js';

export function renderStack(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const grp = gruposDeZona(dataset, zona, met);
  const traces = GRUPOS.map(g => ({
    x: dataset.meses, y: grp[g] || [], name: g,
    type: 'bar', marker: { color: GCOL[g] },
  }));
  const layout = layoutBase();
  layout.barmode = 'stack';
  layout.yaxis = { ...layout.yaxis, title: { text: metricaNombre(met), font: { size: 10 } } };
  Plotly.react('chart-stack', traces, layout, plotlyCfg());
  const pill = $('#stack-pill');
  if (pill) pill.textContent = metricaNombre(met);
}
