// Renderer · Stack barras mensuales por grupo de causa

import { $, GCOL, GRUPOS, layoutBase, plotlyCfg, metricaLabel, metricasActivas } from './_helpers.js';
import { gruposDeZona } from '../../../domain/saidi_calculo.js';

// Color por grupo + métrica · en SAIFI usamos tonos más claros para
// diferenciar visualmente sin perder identidad cromática.
const GCOL_SAIFI = {
  'Sobrecarga/Deslastre':  '#F87171',
  'Racionamiento/Deficit': '#A78BFA',
  'Otras causas':          '#E2E8F0',
};

export function renderStack(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;

  const traces = [];
  mets.forEach((m) => {
    const grp = gruposDeZona(dataset, zona, m);
    const palette = m === 'saifi' ? GCOL_SAIFI : GCOL;
    const sufijo = isAmbos ? (m === 'saidi' ? ' · SAIDI_E (h-eq)' : ' · SAIFI_E (int-eq)') : '';
    GRUPOS.forEach(g => {
      traces.push({
        x: dataset.meses, y: grp[g] || [],
        name: g + sufijo,
        type: 'bar', marker: { color: palette[g] },
        offsetgroup: m, legendgroup: m,
      });
    });
  });

  const layout = layoutBase();
  layout.barmode = 'stack';
  if (isAmbos) {
    layout.barmode = 'group';
    layout.bargap = 0.2;
    layout.bargroupgap = 0.08;
    layout.yaxis = { ...layout.yaxis, title: { text: 'SAIDI_E (h-eq) · SAIFI_E (int-eq)', font: { size: 10 } } };
  } else {
    layout.yaxis = { ...layout.yaxis, title: { text: metricaLabel(met), font: { size: 10 } } };
  }
  Plotly.react('chart-stack', traces, layout, plotlyCfg());
  const pill = $('#stack-pill');
  if (pill) pill.textContent = metricaLabel(met);
}
