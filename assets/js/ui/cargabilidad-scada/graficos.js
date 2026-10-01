// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · curvas (Plotly) · `99 §122`
// ──────────────────────────────────────────────────────────────
// Una figura con paneles apilados y el MISMO eje de tiempo (zoom y desplazamiento juntos):
// corriente por fase con la ampacidad, cargabilidad con las bandas CRG, tensión de línea,
// potencias (P y Q del SCADA; S calculada) y factor de potencia calculado. Las horas sin dato
// válido quedan como HUECO (nunca se unen ni se rellenan). Fases con color Y trazo distintos
// (el color nunca es la única señal). Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { loadPlotly } from '../../plotly-loader.js';
import { FASES, FASE_DE, CALCULO } from '../../domain/scada_carga_config.js';
import { xPlotly, intervaloCO } from '../../domain/scada_carga_fecha.js';

const aNulos = (arr) => Array.from(arr, (v) => (Number.isFinite(v) ? v : null));
const MUCHOS = 2000;
const H_MS = 3600e3;

/**
 * @param {HTMLElement} div
 * @param {{t: Float64Array, fam: Object<string, Float32Array>, iF: Float32Array, pct: Float32Array|null, S: Float32Array, fp: Float32Array,
 *          A: number|null, bandas: number[], etiqueta: string}} d   series YA filtradas (solo válidas; NaN = hueco)
 * @param {() => boolean} [vigente]  false si el usuario ya se fue (otro rango, otro nivel, la lista):
 *        entonces no se dibuja, o se libera lo dibujado (sin fugas de gráficos ni de contextos WebGL)
 */
export async function dibujarFigura(div, d, vigente = () => true) {
  const Plotly = await loadPlotly();
  if (!vigente()) return;
  const n = d.t.length;
  const tipo = n > MUCHOS ? 'scattergl' : 'scatter';
  // Cada valor va en su RÓTULO del SCADA (fin de la hora); el recuadro dice el intervalo.
  const x = Array.from(d.t, (ms) => xPlotly(ms + H_MS));
  const cd = Array.from(d.t, (ms) => intervaloCO(ms));
  // Cada panel lleva su propia leyenda, justo encima (corriente, tensión y potencias).
  const LEYENDA = { y: 'legend', y3: 'legend2', y4: 'legend3' };
  const traza = (y, nombre, eje, linea, unidad, extra = {}) => ({
    type: tipo, mode: 'lines', x, y: aNulos(y), name: nombre, xaxis: 'x', yaxis: eje, connectgaps: false,
    legend: LEYENDA[eje], showlegend: !!LEYENDA[eje],
    line: { width: 1.4, ...linea }, customdata: cd, hovertemplate: nombre + ': %{y:,.2f} ' + unidad + '<extra></extra>', ...extra
  });
  const fase = (f) => ({ color: FASES[FASE_DE[f]].color, dash: FASES[FASE_DE[f]].trazo });
  const datos = [
    traza(d.fam.IR, 'I fase R', 'y', fase('IR'), 'A'),
    traza(d.fam.IS, 'I fase S', 'y', fase('IS'), 'A'),
    traza(d.fam.IT, 'I fase T', 'y', fase('IT'), 'A'),
    traza(d.fam.URS, 'U R-S', 'y3', fase('URS'), 'kV'),
    traza(d.fam.UST, 'U S-T', 'y3', fase('UST'), 'kV'),
    traza(d.fam.UTR, 'U T-R', 'y3', fase('UTR'), 'kV'),
    traza(d.fam.P, 'P (SCADA)', 'y4', { color: '#0B6E4F' }, 'MW'),
    traza(d.fam.Q, 'Q (SCADA)', 'y4', { color: '#B5482A', dash: 'dash' }, 'Mvar'),
    traza(d.S, 'S calculada', 'y4', { color: '#1d2b44', dash: 'dot', width: 1.8 }, 'MVA'),
    traza(d.fp, 'FP calculado', 'y5', { color: '#4d6485' }, '')
  ];
  // Primera traza: la fecha del intervalo encabeza el recuadro del cursor.
  datos[0].hovertemplate = '%{customdata}<br>' + datos[0].hovertemplate;
  const shapes = [];
  const linea = (eje, y, color, dash, ancho = 1) => shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: eje, y0: y, y1: y, line: { color, width: ancho, dash } });
  if (d.A > 0) {
    datos.push(traza(d.pct, 'Cargabilidad (fase más cargada)', 'y2', { color: '#1F5FAD', width: 1.6 }, '%'));
    linea('y', d.A, '#c91a14', 'dash', 1.2);
    for (const b of d.bandas) linea('y2', b, '#8a97ab', 'dot');
    linea('y2', CALCULO.sobrecargaPct, '#c91a14', 'dash', 1.2);
  }
  // Cinco paneles apilados con dominios propios y UN eje de tiempo (abajo).
  const alto = 175; const hueco = 0.065; const h = (1 - 4 * hueco) / 5;
  const dominio = (r) => [1 - (r + 1) * h - r * hueco, 1 - r * h - r * hueco];
  const leyenda = (r) => ({ orientation: 'h', x: 1, xanchor: 'right', y: dominio(r)[1], yanchor: 'bottom', font: { size: 10.5 }, bgcolor: 'rgba(255,255,255,0)' });
  const eje = (r, titulo, extra = {}) => ({ domain: dominio(r), title: { text: titulo, font: { size: 11 } }, gridcolor: '#eef1f6', ...extra });
  const layout = {
    height: alto * 5 + 120, margin: { l: 64, r: 16, t: 34, b: 40 },
    font: { family: getComputedStyle(document.body).fontFamily || 'sans-serif', size: 11.5, color: '#1f3656' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fff',
    hovermode: 'x unified', hoverlabel: { namelength: -1 },
    legend: leyenda(0), legend2: leyenda(2), legend3: leyenda(3),
    xaxis: { type: 'date', anchor: 'y5', hoverformat: '%d-%b-%Y %H:%M', showspikes: true, spikemode: 'across', spikethickness: 1, spikecolor: '#8a97ab', gridcolor: '#eef1f6' },
    yaxis: eje(0, 'Corriente (A)', { rangemode: 'tozero' }),
    yaxis2: eje(1, 'Cargabilidad (%)', { rangemode: 'tozero' }),
    yaxis3: eje(2, 'Tensión (kV)'),
    yaxis4: eje(3, 'MW · Mvar · MVA', { zeroline: true, zerolinecolor: '#c9d1dd' }),
    yaxis5: eje(4, 'FP', { range: [0, 1.02] }),
    shapes,
    annotations: d.A > 0 ? [{ xref: 'paper', x: 0, yref: 'y', y: d.A, text: 'Ampacidad ' + Math.round(d.A) + ' A', showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { size: 10, color: '#c91a14' } }]
      : [{ xref: 'paper', x: 0.5, yref: 'y2 domain', y: 0.5, text: 'Sin ampacidad del devanado: no se calcula la cargabilidad', showarrow: false, font: { size: 11, color: '#4d6485' } }]
  };
  const config = { responsive: true, displaylogo: false, locale: 'es', scrollZoom: false, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
    toImageButtonOptions: { filename: 'cargabilidad_scada_' + d.etiqueta.replace(/[^a-z0-9]+/gi, '_') } };
  await Plotly.react(div, datos, layout, config);
  if (!vigente()) liberarFigura(div);
}

/** Libera la figura (al salir del detalle o cambiar de nivel). */
export function liberarFigura(div) {
  if (div && window.Plotly) { try { window.Plotly.purge(div); } catch (_) { /* nada */ } }
}
