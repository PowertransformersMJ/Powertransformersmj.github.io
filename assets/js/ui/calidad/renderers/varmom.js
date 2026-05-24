// Renderer · Variación % mes a mes (chart-var)

import { COLORS, LAYOUT_BASE, PLOTLY_CFG } from './_helpers.js';
import { gruposDeZona, varMoM } from '../../../domain/saidi_calculo.js';

export function renderVarMoM(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const grp = gruposDeZona(dataset, zona, met);
  Plotly.react('chart-var', [
    {
      x: dataset.meses, y: varMoM(grp['Sobrecarga/Deslastre'] || []),
      name: 'Sobrecarga/Deslastre', type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.RED, width: 2.5 }, marker: { size: 6 },
    },
    {
      x: dataset.meses, y: varMoM(grp['Otras causas'] || []),
      name: 'Otras causas', type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.SLATE, width: 2, dash: 'dot' }, marker: { size: 5 },
    },
  ], {
    ...LAYOUT_BASE,
    margin: { l: 44, r: 14, t: 6, b: 36 },
    yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'Var %', font: { size: 10 } }, ticksuffix: '%' },
  }, PLOTLY_CFG);
}
