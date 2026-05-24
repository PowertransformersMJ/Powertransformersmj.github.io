// Renderer · Serie temporal SAIDI_E + SAIFI_E

import { COLORS, LAYOUT_BASE, PLOTLY_CFG } from './_helpers.js';
import { totalSerieDeZona } from '../../../domain/saidi_calculo.js';

export function renderSerie(dataset, zona) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const saidi = totalSerieDeZona(dataset, zona, 'saidi');
  const saifi = totalSerieDeZona(dataset, zona, 'saifi');
  Plotly.react('chart-serie', [
    {
      x: dataset.meses, y: saidi, name: 'SAIDI_E',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.BLUE, width: 3 }, marker: { size: 7 },
    },
    {
      x: dataset.meses, y: saifi, name: 'SAIFI_E', yaxis: 'y2',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.AMBER, width: 3 }, marker: { size: 7, symbol: 'square' },
    },
  ], {
    ...LAYOUT_BASE,
    yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'SAIDI_E', font: { size: 10 } } },
    yaxis2: { overlaying: 'y', side: 'right', gridcolor: 'rgba(0,0,0,0)', title: { text: 'SAIFI_E', font: { size: 10 } } },
  }, PLOTLY_CFG);
}
