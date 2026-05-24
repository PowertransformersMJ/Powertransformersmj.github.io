// ══════════════════════════════════════════════════════════════
// Renderer · 3 pies (zona / parámetro / U1 vs U2)
// ══════════════════════════════════════════════════════════════

import { aggByZona, aggByParam, aggKPIs } from '../../../domain/scada_violaciones.js';
import { scopedEvents } from '../state.js';

export function renderZonaChart() {
  if (typeof Plotly === 'undefined') return;
  const zd = aggByZona(scopedEvents());
  const total = zd.reduce((s, z) => s + z.violations, 0);
  Plotly.newPlot('zona-chart', [{
    values: zd.map(z => z.violations),
    labels: zd.map(z => z.zona),
    type: 'pie', hole: 0.55,
    marker: { colors: ['#0D9488', '#2563EB', '#F59E0B', '#94A3B8', '#7C3AED'] },
    textinfo: 'label+percent', textposition: 'outside', textfont: { size: 11 },
  }], {
    margin: { t: 10, r: 10, b: 30, l: 10 }, showlegend: false,
    annotations: [{
      text: `<b>${total.toLocaleString()}</b><br><span style="font-size:10px;color:#64748B">violaciones</span>`,
      showarrow: false, font: { size: 14 },
    }],
  }, { displayModeBar: false, responsive: true });
}

export function renderParamChart() {
  if (typeof Plotly === 'undefined') return;
  const pd = aggByParam(scopedEvents());
  Plotly.newPlot('param-chart', [{
    x: pd.map(p => p.violations).reverse(),
    y: pd.map(p => p.parameter).reverse(),
    type: 'bar', orientation: 'h',
    marker: { color: '#7C3AED' },
    text: pd.map(p => p.violations.toLocaleString()).reverse(),
    textposition: 'outside', textfont: { size: 10 },
  }], {
    margin: { t: 10, r: 50, b: 30, l: 100 },
    xaxis: { tickfont: { size: 9 } },
    yaxis: { tickfont: { size: 10 } },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
  }, { displayModeBar: false, responsive: true });
}

export function renderU1U2Chart() {
  if (typeof Plotly === 'undefined') return;
  const k = aggKPIs(scopedEvents());
  Plotly.newPlot('u1u2-chart', [{
    values: [k.u1, k.u2],
    labels: ['U1 (alarma 1)', 'U2 (alarma 2 · severa)'],
    type: 'pie', hole: 0.6,
    marker: { colors: ['#F59E0B', '#DC2626'] },
    textinfo: 'label+value', textposition: 'outside', textfont: { size: 10 },
  }], {
    margin: { t: 10, r: 10, b: 30, l: 10 }, showlegend: false,
    annotations: [{
      text: `<b>${(k.u1 + k.u2).toLocaleString()}</b>`,
      showarrow: false, font: { size: 18 },
    }],
  }, { displayModeBar: false, responsive: true });
}
