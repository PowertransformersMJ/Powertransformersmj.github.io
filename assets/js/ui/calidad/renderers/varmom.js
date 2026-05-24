// Renderer · Variación % mes a mes (chart-var)

import { COLORS, layoutBase, plotlyCfg, metricasActivas } from './_helpers.js';
import { gruposDeZona, varMoM } from '../../../domain/saidi_calculo.js';

export function renderVarMoM(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const layout = layoutBase();
  layout.margin = { l: 44, r: 14, t: 6, b: 36 };
  layout.yaxis = { ...layout.yaxis, title: { text: 'Var % mes a mes', font: { size: 10 } }, ticksuffix: '%' };

  const traces = [];
  mets.forEach(m => {
    const grp = gruposDeZona(dataset, zona, m);
    const sufijo = isAmbos ? (m === 'saidi' ? ' · SAIDI' : ' · SAIFI') : '';
    const dashSob = m === 'saifi' ? 'dash' : 'solid';
    const dashOtras = m === 'saifi' ? 'longdash' : 'dot';
    traces.push({
      x: dataset.meses, y: varMoM(grp['Sobrecarga/Deslastre'] || []),
      name: 'Sobrecarga/Deslastre' + sufijo,
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.RED, width: 2.5, dash: dashSob }, marker: { size: 6 },
    });
    traces.push({
      x: dataset.meses, y: varMoM(grp['Otras causas'] || []),
      name: 'Otras causas' + sufijo,
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.SLATE, width: 2, dash: dashOtras }, marker: { size: 5 },
    });
  });

  Plotly.react('chart-var', traces, layout, plotlyCfg());
}
