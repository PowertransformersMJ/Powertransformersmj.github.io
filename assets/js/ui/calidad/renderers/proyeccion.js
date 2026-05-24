// Renderer · Proyección OLS Jun–Dic con IC95% y 3 escenarios

import { $, COLORS, layoutBase, plotlyCfg, fmt } from './_helpers.js';
import { proyeccionDeZona } from '../../../domain/saidi_calculo.js';

export function renderProyeccion(dataset, zona) {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const p = proyeccionDeZona(dataset, zona);
  if (!p) return;
  const M = dataset.meses_full;
  const realIdx = M.slice(0, 5);
  const projIdx = M.slice(4);

  const layout = layoutBase();
  layout.yaxis = { ...layout.yaxis, title: { text: 'SAIDI_E grupo (h-eq)', font: { size: 10 } } };
  layout.shapes = [{ type: 'line', x0: 4, x1: 4, y0: 0, y1: 1, yref: 'paper',
    line: { color: '#CBD5E1', dash: 'dot', width: 1 } }];

  Plotly.react('chart-proj', [
    { x: M, y: p.ci_sup, name: 'IC95% sup', type: 'scatter', mode: 'lines',
      line: { width: 0 }, showlegend: false, hoverinfo: 'skip' },
    { x: M, y: p.ci_inf, name: 'IC 95%', type: 'scatter', mode: 'lines',
      fill: 'tonexty', fillcolor: 'rgba(37,99,235,0.10)', line: { width: 0 } },
    { x: realIdx, y: p.real.slice(0, 5), name: 'Real',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.NAV, width: 3 }, marker: { size: 7 } },
    { x: projIdx, y: p.base.slice(4), name: 'Base',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.BLUE, width: 2, dash: 'dash' }, marker: { size: 5 } },
    { x: projIdx, y: p.opt.slice(4), name: 'Optimista −10%',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.GREEN, width: 1.8, dash: 'dash' },
      marker: { size: 5, symbol: 'triangle-up' } },
    { x: projIdx, y: p.pes.slice(4), name: 'Pesimista +10%',
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.RED, width: 1.8, dash: 'dash' },
      marker: { size: 5, symbol: 'triangle-down' } },
  ], layout, plotlyCfg());

  const accB = p.base.slice(5).reduce((a, b) => a + b, 0);
  const accO = p.opt .slice(5).reduce((a, b) => a + b, 0);
  const accP = p.pes .slice(5).reduce((a, b) => a + b, 0);
  const note = $('#proj-note');
  if (note) {
    note.innerHTML =
      `Método: OLS sobre 5 puntos · pendiente +${fmt(p.slope, 3)}/mes · R²=${fmt(p.r2, 2)} · p=${fmt(p.pval, 3)}. ` +
      `Acumulado Jun–Dic → base <b>${fmt(accB, 2)}</b> · optimista ${fmt(accO, 2)} · pesimista ${fmt(accP, 2)}. ` +
      `Base estadística limitada: referencial, recalcular al cierre mensual.`;
  }
}
