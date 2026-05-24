// ══════════════════════════════════════════════════════════════
// Renderer · Tendencia U1 vs U2 (Plotly · barras apiladas)
// ══════════════════════════════════════════════════════════════

import { aggTrend } from '../../../domain/scada_violaciones.js';
import { scopedEvents, store } from '../state.js';

export function renderTrend() {
  if (typeof Plotly === 'undefined') return;
  let scope = store.state.trendScope;
  if (scope === 'auto') {
    const datesInScope = new Set(scopedEvents().map(e => e.date));
    scope = datesInScope.size <= 1 ? 'hourly' : 'daily';
  }
  const data = aggTrend(scopedEvents(), scope);
  const xtitle = scope === 'hourly' ? 'Hora del día' : 'Fecha';

  Plotly.newPlot('trend-chart', [
    { x: data.map(d => d.label), y: data.map(d => d.U1), type: 'bar', name: 'U1', marker: { color: '#F59E0B' } },
    { x: data.map(d => d.label), y: data.map(d => d.U2), type: 'bar', name: 'U2', marker: { color: '#DC2626' } },
  ], {
    margin: { t: 10, r: 10, b: 60, l: 50 },
    barmode: 'stack',
    xaxis: { tickangle: -45, tickfont: { size: 9 }, type: 'category', title: { text: xtitle, font: { size: 10 } } },
    yaxis: { title: { text: 'Violaciones', font: { size: 10 } }, tickfont: { size: 9 } },
    legend: { orientation: 'h', y: -0.3, x: 0.5, xanchor: 'center' },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: '-apple-system,sans-serif', size: 10, color: '#334155' },
  }, { displayModeBar: false, responsive: true });
}
