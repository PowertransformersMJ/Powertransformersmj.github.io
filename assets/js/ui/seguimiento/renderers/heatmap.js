// ══════════════════════════════════════════════════════════════
// Renderer · Heatmap top 15 subestaciones × parámetro
// ══════════════════════════════════════════════════════════════

import { aggHeatmap } from '../../../domain/scada_violaciones.js';
import { scopedEvents } from '../state.js';

const $ = (sel) => document.querySelector(sel);

export function renderHeatmap() {
  if (typeof Plotly === 'undefined') return;
  const { rows, params } = aggHeatmap(scopedEvents());
  const host = $('#heatmap-chart');
  if (rows.length === 0) {
    if (host) host.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-400)">Sin datos</div>`;
    return;
  }
  const z = rows.map(r => params.map(p => r[p] || 0));
  const subs = rows.map(r => r.sub);
  const text = z.map(row => row.map(v => v === 0 ? '' : String(v)));

  Plotly.newPlot('heatmap-chart', [{
    z, x: params, y: subs, type: 'heatmap',
    colorscale: [
      [0,    '#F8FAFC'], [0.05, '#FEF3C7'], [0.2,  '#FBBF24'],
      [0.5,  '#F59E0B'], [0.8,  '#DC2626'], [1,    '#7F1D1D'],
    ],
    text, texttemplate: '%{text}', textfont: { size: 10, color: '#1E293B' },
    hovertemplate: '<b>%{y}</b><br>%{x}: %{z} violaciones<extra></extra>',
    colorbar: { title: { text: 'violaciones', font: { size: 10 } }, tickfont: { size: 9 }, thickness: 14 },
  }], {
    margin: { t: 10, r: 60, b: 80, l: 90 },
    xaxis: { tickangle: -30, tickfont: { size: 10 } },
    yaxis: { tickfont: { size: 11 }, autorange: 'reversed' },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
  }, { displayModeBar: false, responsive: true });
}
