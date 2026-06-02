// Renderer · Serie temporal SAIDI_E + SAIFI_E

import { $, COLORS, layoutBase, plotlyCfg, metricasActivas } from './_helpers.js';
import { totalSerieDeZona } from '../../../domain/saidi_calculo.js';

// Suma acumulada mes a mes: [a, b, c] → [a, a+b, a+b+c].
function acumular(serie) {
  let s = 0;
  return (serie || []).map(v => (s += (+v || 0)));
}

// Serie de la zona ya transformada según el modo ('mes' | 'acum').
function serieModoZona(dataset, zona, m, modo) {
  const base = totalSerieDeZona(dataset, zona, m);
  return modo === 'acum' ? acumular(base) : base;
}

export function renderSerie(dataset, zona, met = 'saidi', modo = 'mes') {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const acum = modo === 'acum';
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const layout = layoutBase();
  const traces = [];

  // Sufijo del eje y de la leyenda según el modo.
  const sufSAIDI = acum ? 'SAIDI_E acum. (h-eq)'   : 'SAIDI_E (h-eq)';
  const sufSAIFI = acum ? 'SAIFI_E acum. (int-eq)' : 'SAIFI_E (int-eq)';

  if (isAmbos) {
    // Doble eje Y: SAIDI a la izquierda (azul), SAIFI a la derecha (ámbar)
    layout.yaxis  = { ...layout.yaxis, title: { text: sufSAIDI, font: { size: 10, color: '#2563EB' } } };
    layout.yaxis2 = { overlaying: 'y', side: 'right', gridcolor: 'rgba(0,0,0,0)',
                      title: { text: sufSAIFI, font: { size: 10, color: '#F59E0B' } } };
    traces.push({
      x: dataset.meses, y: serieModoZona(dataset, zona, 'saidi', modo),
      name: sufSAIDI,
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.BLUE, width: 3 }, marker: { size: 7 },
    });
    traces.push({
      x: dataset.meses, y: serieModoZona(dataset, zona, 'saifi', modo),
      name: sufSAIFI, yaxis: 'y2',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.AMBER, width: 3 }, marker: { size: 7, symbol: 'square' },
    });
  } else {
    // Una sola serie · eje Y único con el label de la métrica activa
    const m = mets[0];
    const isSAIDI = m === 'saidi';
    const color = isSAIDI ? COLORS.BLUE : COLORS.AMBER;
    const label = isSAIDI ? sufSAIDI : sufSAIFI;
    layout.yaxis = { ...layout.yaxis, title: { text: label, font: { size: 10, color } } };
    traces.push({
      x: dataset.meses, y: serieModoZona(dataset, zona, m, modo),
      name: label,
      type: 'scatter', mode: 'lines+markers',
      line: { color, width: 3 },
      marker: { size: 7, symbol: isSAIDI ? 'circle' : 'square' },
    });
  }

  Plotly.react('chart-serie', traces, layout, plotlyCfg());

  // Pill del título: refleja qué serie(s) se está(n) mostrando + el modo
  const pill = $('#serie-pill');
  if (pill) {
    const metTxt = isAmbos
      ? 'SAIDI_E (h-eq) + SAIFI_E (int-eq)'
      : (mets[0] === 'saidi' ? 'SAIDI_E (h-eq)' : 'SAIFI_E (int-eq)');
    pill.textContent = acum ? `${metTxt} · acumulado` : metTxt;
  }
}
