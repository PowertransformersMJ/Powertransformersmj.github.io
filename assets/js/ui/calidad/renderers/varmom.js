// Renderer · Variación % mes a mes (chart-var)

import { COLORS, layoutBase, plotlyCfg, metricasActivas } from './_helpers.js';
import { gruposDeZona, varMoM } from '../../../domain/saidi_calculo.js';
import { store } from '../state.js';

// Color por grupo (consistente con stack chart)
const GRP_COLOR = {
  'Sobrecarga/Deslastre':  COLORS.RED,
  'Racionamiento/Deficit': COLORS.PURPLE,
  'Otras causas':          COLORS.SLATE,
};
// Estilo de línea base por grupo
const GRP_DASH_SAIDI = {
  'Sobrecarga/Deslastre':  'solid',
  'Racionamiento/Deficit': 'solid',
  'Otras causas':          'dot',
};
const GRP_DASH_SAIFI = {
  'Sobrecarga/Deslastre':  'dash',
  'Racionamiento/Deficit': 'dash',
  'Otras causas':          'longdash',
};

export function renderVarMoM(dataset, zona, met) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const activos = store.state.gruposActivos;
  const layout = layoutBase();
  layout.margin = { l: 44, r: 14, t: 6, b: 36 };
  layout.yaxis = { ...layout.yaxis, title: { text: 'Var % mes a mes', font: { size: 10 } }, ticksuffix: '%' };

  const traces = [];
  mets.forEach(m => {
    const grp = gruposDeZona(dataset, zona, m);
    const sufijo = isAmbos ? (m === 'saidi' ? ' · SAIDI' : ' · SAIFI') : '';
    const dashMap = m === 'saifi' ? GRP_DASH_SAIFI : GRP_DASH_SAIDI;
    ['Sobrecarga/Deslastre', 'Racionamiento/Deficit', 'Otras causas'].forEach(g => {
      if (!activos.has(g)) return;
      traces.push({
        x: dataset.meses, y: varMoM(grp[g] || []),
        name: g + sufijo,
        type: 'scatter', mode: 'lines+markers',
        line: { color: GRP_COLOR[g], width: g === 'Otras causas' ? 2 : 2.5, dash: dashMap[g] },
        marker: { size: g === 'Otras causas' ? 5 : 6 },
      });
    });
  });

  Plotly.react('chart-var', traces, layout, plotlyCfg());
}
