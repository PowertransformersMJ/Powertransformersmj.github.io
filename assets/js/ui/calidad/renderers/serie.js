// Renderer · Serie temporal SAIDI_E + SAIFI_E

import { COLORS, layoutBase, plotlyCfg } from './_helpers.js';
import { totalSerieDeZona } from '../../../domain/saidi_calculo.js';

export function renderSerie(dataset, zona) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const saidi = totalSerieDeZona(dataset, zona, 'saidi');
  const saifi = totalSerieDeZona(dataset, zona, 'saifi');
  const layout = layoutBase();
  layout.yaxis  = { ...layout.yaxis,  title: { text: 'SAIDI_E (h-eq)',   font: { size: 10, color: '#2563EB' } } };
  layout.yaxis2 = { overlaying: 'y', side: 'right', gridcolor: 'rgba(0,0,0,0)',
                    title: { text: 'SAIFI_E (int-eq)', font: { size: 10, color: '#F59E0B' } } };
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
  ], layout, plotlyCfg());
}
