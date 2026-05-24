// Renderer · Serie temporal SAIDI_E + SAIFI_E

import { $, COLORS, layoutBase, plotlyCfg, metricasActivas } from './_helpers.js';
import { totalSerieDeZona } from '../../../domain/saidi_calculo.js';

export function renderSerie(dataset, zona, met = 'saidi') {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const layout = layoutBase();
  const traces = [];

  if (isAmbos) {
    // Doble eje Y: SAIDI a la izquierda (azul), SAIFI a la derecha (ámbar)
    layout.yaxis  = { ...layout.yaxis, title: { text: 'SAIDI_E (h-eq)', font: { size: 10, color: '#2563EB' } } };
    layout.yaxis2 = { overlaying: 'y', side: 'right', gridcolor: 'rgba(0,0,0,0)',
                      title: { text: 'SAIFI_E (int-eq)', font: { size: 10, color: '#F59E0B' } } };
    traces.push({
      x: dataset.meses, y: totalSerieDeZona(dataset, zona, 'saidi'),
      name: 'SAIDI_E (h-eq)',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.BLUE, width: 3 }, marker: { size: 7 },
    });
    traces.push({
      x: dataset.meses, y: totalSerieDeZona(dataset, zona, 'saifi'),
      name: 'SAIFI_E (int-eq)', yaxis: 'y2',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.AMBER, width: 3 }, marker: { size: 7, symbol: 'square' },
    });
  } else {
    // Una sola serie · eje Y único con el label de la métrica activa
    const m = mets[0];
    const isSAIDI = m === 'saidi';
    const color = isSAIDI ? COLORS.BLUE : COLORS.AMBER;
    const label = isSAIDI ? 'SAIDI_E (h-eq)' : 'SAIFI_E (int-eq)';
    layout.yaxis = { ...layout.yaxis, title: { text: label, font: { size: 10, color } } };
    traces.push({
      x: dataset.meses, y: totalSerieDeZona(dataset, zona, m),
      name: label,
      type: 'scatter', mode: 'lines+markers',
      line: { color, width: 3 },
      marker: { size: 7, symbol: isSAIDI ? 'circle' : 'square' },
    });
  }

  Plotly.react('chart-serie', traces, layout, plotlyCfg());

  // Pill del título: refleja qué serie(s) se está(n) mostrando
  const pill = $('#serie-pill');
  if (pill) {
    pill.textContent = isAmbos
      ? 'SAIDI_E (h-eq) + SAIFI_E (int-eq)'
      : (mets[0] === 'saidi' ? 'SAIDI_E (h-eq)' : 'SAIFI_E (int-eq)');
  }
}
