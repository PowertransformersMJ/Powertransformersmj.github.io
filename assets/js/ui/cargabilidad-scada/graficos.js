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
import { NOMBRE_EXTRA } from '../../domain/scada_carga_extras.js';
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
  // Filtro de la vista (`99 §126`): qué valores de cada hora y qué fases se dibujan. Por defecto, como antes.
  const ver = { prom: true, max: false, min: false, ins: false, ...(d.ver || {}) };
  const fases = { R: true, S: true, T: true, ...(d.fases || {}) };
  const ext = d.ext || {};
  const CURVAS = [
    ['IR', 'I fase R', 'y', fase('IR'), 'A'], ['IS', 'I fase S', 'y', fase('IS'), 'A'], ['IT', 'I fase T', 'y', fase('IT'), 'A'],
    ['URS', 'U R-S', 'y3', fase('URS'), 'kV'], ['UST', 'U S-T', 'y3', fase('UST'), 'kV'], ['UTR', 'U T-R', 'y3', fase('UTR'), 'kV'],
    ['P', 'P (SCADA)', 'y4', { color: '#0B6E4F' }, 'MW'], ['Q', 'Q (SCADA)', 'y4', { color: '#B5482A', dash: 'dash' }, 'Mvar']
  ];
  const datos = [];
  const bandas = [];   // la franja mín–máx va DEBAJO de las líneas (se agrega primero)
  for (const [f, nombre, eje, linea, unidad] of CURVAS) {
    if (FASE_DE[f] && !fases[FASE_DE[f]]) continue;
    const e = ext[f] || {};
    // Una leyenda por curva (legendgroup): al tocarla se apagan juntos su promedio, su franja y sus extras.
    const grupo = { legendgroup: f };
    const franjaSi = ver.max && ver.min && e.max && e.min;
    if (franjaSi) bandas.push({ ...franja(x, e.max, e.min, nombre + ' (mín–máx)', eje, linea.color, LEYENDA[eje]), ...grupo });
    if (ver.prom) datos.push(traza(d.fam[f], nombre, eje, linea, unidad, grupo));
    // Máx y mín como líneas finas: sin entrada propia en la leyenda si ya está la franja (la nombra).
    if (ver.max && e.max) datos.push(traza(e.max, nombre + ' máx', eje, { ...linea, width: 0.8 }, unidad, { opacity: 0.7, ...grupo, showlegend: !franjaSi && !!LEYENDA[eje] }));
    if (ver.min && e.min) datos.push(traza(e.min, nombre + ' mín', eje, { ...linea, width: 0.8 }, unidad, { opacity: 0.7, ...grupo, showlegend: !franjaSi && !!LEYENDA[eje] }));
    if (ver.ins && e.ins) {
      datos.push(traza(e.ins, nombre + ' (inst.)', eje, { color: linea.color }, unidad,
        { mode: 'markers', marker: { size: 3, color: linea.color, opacity: 0.8 }, line: undefined, ...grupo, hovertemplate: nombre + ' ' + NOMBRE_EXTRA.ins.toLowerCase() + ': %{y:,.2f} ' + unidad + '<extra></extra>' }));
    }
  }
  datos.push(traza(d.S, 'S calculada', 'y4', { color: '#1d2b44', dash: 'dot', width: 1.8 }, 'MVA'));
  datos.push(traza(d.fp, 'FP calculado', 'y5', { color: '#4d6485' }, ''));
  datos.unshift(...bandas);
  // Primera traza con recuadro: la fecha del intervalo encabeza el recuadro del cursor.
  const primera = datos.find((t) => t.hoverinfo !== 'skip');
  if (primera) primera.hovertemplate = '%{customdata}<br>' + primera.hovertemplate;
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

/**
 * Franja entre el mínimo y el máximo de cada hora: un polígono por tramo continuo (máx de ida, mín de
 * vuelta), así los huecos quedan como huecos. Siempre SVG (el relleno de WebGL no respeta los cortes);
 * va debajo de las líneas y no entra en el recuadro del cursor (las líneas máx/mín ya lo dicen).
 */
function franja(x, mx, mn, nombre, eje, color, leyenda) {
  const xs = []; const ys = [];
  let i = 0;
  const n = mx.length;
  while (i < n) {
    while (i < n && !(Number.isFinite(mx[i]) && Number.isFinite(mn[i]))) i++;
    const a = i;
    while (i < n && Number.isFinite(mx[i]) && Number.isFinite(mn[i])) i++;
    if (i - a < 1) continue;
    for (let k = a; k < i; k++) { xs.push(x[k]); ys.push(mx[k]); }
    for (let k = i - 1; k >= a; k--) { xs.push(x[k]); ys.push(mn[k]); }
    xs.push(null); ys.push(null);
  }
  return {
    type: 'scatter', mode: 'lines', x: xs, y: ys, name: nombre, xaxis: 'x', yaxis: eje, fill: 'toself', connectgaps: false,
    fillcolor: hexAlfa(color, 0.16), line: { width: 0, color }, hoverinfo: 'skip', legend: leyenda, showlegend: !!leyenda
  };
}
const hexAlfa = (hex, a) => {
  const m = String(hex).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : hex;
};

/** Libera la figura (al salir del detalle o cambiar de nivel). */
export function liberarFigura(div) {
  if (div && window.Plotly) { try { window.Plotly.purge(div); } catch (_) { /* nada */ } }
}
