// Renderer · Stack barras mensuales por grupo de causa

import { $, GCOL, GRUPOS, LAYOUT_BASE, PLOTLY_CFG, metricaNombre, metKey } from './_helpers.js';
import { gruposDeZona } from '../../../domain/saidi_calculo.js';

export function renderStack(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const grp = gruposDeZona(dataset, zona, met);
  const traces = GRUPOS.map(g => ({
    x: dataset.meses, y: grp[g] || [], name: g,
    type: 'bar', marker: { color: GCOL[g] },
  }));
  Plotly.react('chart-stack', traces, {
    ...LAYOUT_BASE, barmode: 'stack',
    yaxis: { ...LAYOUT_BASE.yaxis, title: { text: metricaNombre(met), font: { size: 10 } } },
  }, PLOTLY_CFG);
  const pill = $('#stack-pill');
  if (pill) pill.textContent = metricaNombre(met);
}
