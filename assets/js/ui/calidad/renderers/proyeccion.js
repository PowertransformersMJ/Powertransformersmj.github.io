// Renderer · Proyección OLS Jun–Dic con IC95% y 3 escenarios

import { $, COLORS, layoutBase, plotlyCfg, fmt, metricasActivas, metricaNombre, metricaUnidad } from './_helpers.js';
import { gruposDeZona, proyeccionDeZona } from '../../../domain/saidi_calculo.js';
import { calcularProyeccionOLS } from '../../../domain/saidi_proyeccion.js';

// Devuelve el bloque proj (precalculado o recalculado) para una métrica.
// SAIDI usa el `proj` precalculado del baseline (idéntico al backend
// Python). SAIFI se recalcula on-the-fly con calcularProyeccionOLS
// porque el baseline solo trae proj de SAIDI.
function obtenerProj(dataset, zona, met) {
  if (met === 'saidi') {
    return proyeccionDeZona(dataset, zona);
  }
  const grp = gruposDeZona(dataset, zona, met);
  const serieReal = grp['Sobrecarga/Deslastre'] || [];
  if (!serieReal.length) return null;
  return calcularProyeccionOLS(serieReal, dataset.meses_full.length);
}

// Construye los traces de una proyección con un color dado.
function tracesDeProyeccion(p, M, met, colorBase) {
  const realIdx = M.slice(0, 5);
  const projIdx = M.slice(4);
  const label = metricaNombre(met);
  const unidad = metricaUnidad(met);
  return [
    { x: M, y: p.ci_sup, name: `IC95% sup · ${label}`, type: 'scatter', mode: 'lines',
      line: { width: 0 }, showlegend: false, hoverinfo: 'skip' },
    { x: M, y: p.ci_inf, name: `IC 95% · ${label}`, type: 'scatter', mode: 'lines',
      fill: 'tonexty',
      fillcolor: met === 'saifi' ? 'rgba(245,158,11,0.10)' : 'rgba(37,99,235,0.10)',
      line: { width: 0 } },
    { x: realIdx, y: p.real.slice(0, 5), name: `Real · ${label} (${unidad})`,
      type: 'scatter', mode: 'lines+markers',
      line: { color: met === 'saifi' ? '#7C2D12' : COLORS.NAV, width: 3 }, marker: { size: 7 } },
    { x: projIdx, y: p.base.slice(4), name: `Base · ${label}`,
      type: 'scatter', mode: 'lines+markers',
      line: { color: colorBase, width: 2, dash: 'dash' }, marker: { size: 5 } },
    { x: projIdx, y: p.opt.slice(4), name: `Optimista −10% · ${label}`,
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.GREEN, width: 1.8, dash: 'dash' },
      marker: { size: 5, symbol: 'triangle-up' } },
    { x: projIdx, y: p.pes.slice(4), name: `Pesimista +10% · ${label}`,
      type: 'scatter', mode: 'lines+markers',
      line: { color: COLORS.RED, width: 1.8, dash: 'dash' },
      marker: { size: 5, symbol: 'triangle-down' } },
  ];
}

export function renderProyeccion(dataset, zona, met = 'saidi') {
  if (typeof Plotly === 'undefined' || !dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const M = dataset.meses_full;

  const layout = layoutBase();
  layout.shapes = [{ type: 'line', x0: 4, x1: 4, y0: 0, y1: 1, yref: 'paper',
    line: { color: '#CBD5E1', dash: 'dot', width: 1 } }];

  if (isAmbos) {
    // Doble eje Y: SAIDI (h-eq) izquierda · SAIFI (int-eq) derecha
    const pSaidi = obtenerProj(dataset, zona, 'saidi');
    const pSaifi = obtenerProj(dataset, zona, 'saifi');
    const traces = [];
    if (pSaidi) {
      traces.push(...tracesDeProyeccion(pSaidi, M, 'saidi', COLORS.BLUE));
    }
    if (pSaifi) {
      const trS = tracesDeProyeccion(pSaifi, M, 'saifi', COLORS.AMBER);
      trS.forEach(t => { t.yaxis = 'y2'; });
      traces.push(...trS);
    }
    layout.yaxis  = { ...layout.yaxis,  title: { text: 'SAIDI_E grupo (h-eq)',   font: { size: 10, color: '#2563EB' } } };
    layout.yaxis2 = { overlaying: 'y', side: 'right', gridcolor: 'rgba(0,0,0,0)',
                      title: { text: 'SAIFI_E grupo (int-eq)', font: { size: 10, color: '#F59E0B' } } };
    Plotly.react('chart-proj', traces, layout, plotlyCfg());

    // Nota: combinar info de ambas proyecciones
    const accBSaidi = pSaidi ? pSaidi.base.slice(5).reduce((a, b) => a + b, 0) : 0;
    const accBSaifi = pSaifi ? pSaifi.base.slice(5).reduce((a, b) => a + b, 0) : 0;
    const note = $('#proj-note');
    if (note) {
      note.innerHTML =
        `OLS sobre 5 puntos · ` +
        (pSaidi ? `SAIDI: pendiente +${fmt(pSaidi.slope, 3)} h-eq/mes · R²=${fmt(pSaidi.r2, 2)} · p=${fmt(pSaidi.pval, 3)} · acum Jun–Dic ${fmt(accBSaidi, 2)} h-eq · ` : '') +
        (pSaifi ? `SAIFI: pendiente +${fmt(pSaifi.slope, 3)} int-eq/mes · R²=${fmt(pSaifi.r2, 2)} · p=${fmt(pSaifi.pval, 3)} · acum Jun–Dic ${fmt(accBSaifi, 2)} int-eq.` : '');
    }
  } else {
    const m = mets[0];
    const p = obtenerProj(dataset, zona, m);
    if (!p) return;
    const unidad = metricaUnidad(m);
    const label = metricaNombre(m);
    layout.yaxis = { ...layout.yaxis, title: { text: `${label} grupo (${unidad})`, font: { size: 10 } } };
    const colorBase = m === 'saifi' ? COLORS.AMBER : COLORS.BLUE;
    Plotly.react('chart-proj', tracesDeProyeccion(p, M, m, colorBase), layout, plotlyCfg());

    const accB = p.base.slice(5).reduce((a, b) => a + b, 0);
    const accO = p.opt .slice(5).reduce((a, b) => a + b, 0);
    const accP = p.pes .slice(5).reduce((a, b) => a + b, 0);
    const note = $('#proj-note');
    if (note) {
      note.innerHTML =
        `Método: OLS sobre 5 puntos · ${label} grupo Sobrecarga/Deslastre · ` +
        `pendiente +${fmt(p.slope, 3)} ${unidad}/mes · R²=${fmt(p.r2, 2)} · p=${fmt(p.pval, 3)}. ` +
        `Acumulado Jun–Dic → base <b>${fmt(accB, 2)} ${unidad}</b> · ` +
        `optimista ${fmt(accO, 2)} · pesimista ${fmt(accP, 2)}. ` +
        `Base estadística limitada: referencial, recalcular al cierre mensual.`;
    }
  }

  // Actualiza el título dinámico del card
  const titulo = $('#proj-titulo-met');
  if (titulo) {
    titulo.textContent = isAmbos
      ? '(SAIDI_E h-eq + SAIFI_E int-eq)'
      : `(${metricaNombre(mets[0])} ${metricaUnidad(mets[0])})`;
  }
}
