// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · curvas (Plotly) · `99 §122`
// ──────────────────────────────────────────────────────────────
// Una gráfica por magnitud (§126), con el zoom compartido entre todas: corriente por fase con la
// ampacidad, cargabilidad con las bandas CRG, tensión de línea, potencias (P y Q del SCADA; S
// calculada) y factor de potencia calculado. Las horas sin dato
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
 * Una gráfica por magnitud, ancha y alta, con su título (§126: «que cada gráfica se vea más grande»):
 * corriente (la más alta: de ella sale la cifra), cargabilidad, tensión, potencias y factor de potencia.
 * Cada una tiene su propio recuadro del cursor (solo sus valores) y el zoom se comparte: acercar una
 * acerca todas al mismo rango de fechas.
 * @param {HTMLElement} div  contenedor (aquí se crean las gráficas)
 * @param {{t: Float64Array, fam: Object<string, Float32Array>, iF: Float32Array, pct: Float32Array|null, S: Float32Array, fp: Float32Array,
 *          A: number|null, bandas: number[], etiqueta: string, ext?, ver?, fases?}} d   series YA filtradas (solo válidas; NaN = hueco)
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
  const PANELES = {
    I: { titulo: 'Corriente por fase', unidad: 'A', alto: 400, eje: { rangemode: 'tozero' } },
    C: { titulo: 'Cargabilidad de la fase más cargada', unidad: '%', alto: 320, eje: { rangemode: 'tozero' } },
    U: { titulo: 'Tensión entre fases', unidad: 'kV', alto: 320, eje: {} },
    PQ: { titulo: 'Potencias: P y Q del SCADA, S calculada', unidad: 'MW · Mvar · MVA', alto: 340, eje: { zeroline: true, zerolinecolor: '#c9d1dd' } },
    FP: { titulo: 'Factor de potencia (calculado)', unidad: 'FP', alto: 240, eje: { range: [0, 1.02] } }
  };
  const trazas = { I: [], C: [], U: [], PQ: [], FP: [] };
  const promDe = { I: [], U: [], PQ: [] }; const extrasDe = { I: [], U: [], PQ: [] };   // para la escala de cada gráfica
  const bandasDe = { I: [], C: [], U: [], PQ: [], FP: [] };   // la franja mín–máx va DEBAJO de las líneas
  const traza = (y, nombre, linea, unidad, extra = {}) => ({
    type: tipo, mode: 'lines', x, y: aNulos(y), name: nombre, connectgaps: false,
    line: { width: 1.6, ...linea }, customdata: cd, hovertemplate: nombre + ': %{y:,.2f} ' + unidad + '<extra></extra>', ...extra
  });
  const fase = (f) => ({ color: FASES[FASE_DE[f]].color, dash: FASES[FASE_DE[f]].trazo });
  // Filtro de la vista (`99 §126`): qué valores de cada hora y qué fases se dibujan. Por defecto, como antes.
  const ver = { prom: true, max: false, min: false, ins: false, ...(d.ver || {}) };
  const fases = { R: true, S: true, T: true, ...(d.fases || {}) };
  const ext = d.ext || {};
  const CURVAS = [
    ['IR', 'I fase R', 'I', fase('IR'), 'A'], ['IS', 'I fase S', 'I', fase('IS'), 'A'], ['IT', 'I fase T', 'I', fase('IT'), 'A'],
    ['URS', 'U R-S', 'U', fase('URS'), 'kV'], ['UST', 'U S-T', 'U', fase('UST'), 'kV'], ['UTR', 'U T-R', 'U', fase('UTR'), 'kV'],
    ['P', 'P (SCADA)', 'PQ', { color: '#0B6E4F' }, 'MW'], ['Q', 'Q (SCADA)', 'PQ', { color: '#B5482A', dash: 'dash' }, 'Mvar']
  ];
  for (const [f, nombre, panel, linea, unidad] of CURVAS) {
    if (FASE_DE[f] && !fases[FASE_DE[f]]) continue;
    const e = ext[f] || {};
    // Una leyenda por curva (legendgroup): al tocarla se apagan juntos su promedio, su franja y sus extras.
    const grupo = { legendgroup: f };
    const franjaSi = ver.max && ver.min && e.max && e.min;
    if (franjaSi) bandasDe[panel].push({ ...franja(x, e.max, e.min, nombre + ' (mín–máx)', linea.color), ...grupo });
    if (ver.prom) { trazas[panel].push(traza(d.fam[f], nombre, linea, unidad, grupo)); promDe[panel].push(d.fam[f]); }
    for (const k of ['max', 'min', 'ins']) if (ver[k] && e[k]) extrasDe[panel].push(e[k]);
    // Máx y mín como líneas finas: sin entrada propia en la leyenda si ya está la franja (la nombra).
    if (ver.max && e.max) trazas[panel].push(traza(e.max, nombre + ' máx', { ...linea, width: 0.9 }, unidad, { opacity: 0.7, ...grupo, showlegend: !franjaSi }));
    if (ver.min && e.min) trazas[panel].push(traza(e.min, nombre + ' mín', { ...linea, width: 0.9 }, unidad, { opacity: 0.7, ...grupo, showlegend: !franjaSi }));
    if (ver.ins && e.ins) {
      trazas[panel].push(traza(e.ins, nombre + ' (inst.)', { color: linea.color }, unidad,
        { mode: 'markers', marker: { size: 4, color: linea.color, opacity: 0.8 }, line: undefined, ...grupo, hovertemplate: nombre + ' ' + NOMBRE_EXTRA.ins.toLowerCase() + ': %{y:,.2f} ' + unidad + '<extra></extra>' }));
    }
  }
  trazas.PQ.push(traza(d.S, 'S calculada', { color: '#1d2b44', dash: 'dot', width: 2 }, 'MVA'));
  promDe.PQ.push(d.S);
  trazas.FP.push(traza(d.fp, 'FP calculado', { color: '#4d6485' }, ''));
  const shapes = { I: [], C: [], U: [], PQ: [], FP: [] };
  const annotations = { I: [], C: [], U: [], PQ: [], FP: [] };
  const linea = (panel, y, color, dash, ancho = 1) => shapes[panel].push({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: y, y1: y, line: { color, width: ancho, dash } });
  if (d.A > 0) {
    trazas.C.push(traza(d.pct, 'Cargabilidad (fase más cargada)', { color: '#1F5FAD', width: 1.8 }, '%'));
    linea('I', d.A, '#c91a14', 'dash', 1.3);
    annotations.I.push({ xref: 'paper', x: 0, yref: 'y', y: d.A, text: 'Ampacidad ' + Math.round(d.A) + ' A', showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { size: 11, color: '#c91a14' } });
    for (const b of d.bandas) linea('C', b, '#8a97ab', 'dot');
    linea('C', CALCULO.sobrecargaPct, '#c91a14', 'dash', 1.3);
  } else {
    annotations.C.push({ xref: 'paper', x: 0.5, yref: 'paper', y: 0.5, text: 'Sin ampacidad del devanado: no se calcula la cargabilidad', showarrow: false, font: { size: 12, color: '#4d6485' } });
  }
  const fuente = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const rango = n ? [x[0], x[n - 1]] : null;
  liberarFigura(div);
  div.textContent = '';
  const graficas = [];
  for (const [clave, p] of Object.entries(PANELES)) {
    const datos = [...bandasDe[clave], ...trazas[clave]];
    const escala = escalaConExtras(promDe[clave], extrasDe[clave], clave === 'I');
    if (escala && escala.fuera) {
      annotations[clave].push({ xref: 'paper', x: 1, xanchor: 'right', yref: 'paper', y: 1, yanchor: 'top', showarrow: false, bgcolor: 'rgba(255,255,255,.85)',
        text: escala.fuera.toLocaleString('es-CO') + (escala.fuera === 1 ? ' pico del máximo o del mínimo queda' : ' picos del máximo o del mínimo quedan') + ' fuera de la escala · «Autoescala» para verlos',
        font: { size: 11, color: '#4d6485' } });
    }
    // Primera traza con recuadro: la fecha del intervalo encabeza el recuadro del cursor.
    const primera = datos.find((t) => t.hoverinfo !== 'skip');
    if (primera) primera.hovertemplate = '%{customdata}<br>' + primera.hovertemplate;
    const lienzo = document.createElement('div');
    lienzo.className = 'cs-graf-lienzo';
    lienzo.setAttribute('role', 'img');
    lienzo.setAttribute('aria-label', p.titulo + ' (' + p.unidad + '), hora por hora');
    const tit = document.createElement('h3');
    tit.className = 'cs-graf-t';
    tit.textContent = p.titulo + ' ';
    const uni = document.createElement('small'); uni.textContent = '(' + p.unidad + ')'; tit.appendChild(uni);
    const caja = document.createElement('section'); caja.className = 'cs-graf'; caja.append(tit, lienzo);
    div.appendChild(caja);
    const layout = {
      height: p.alto, margin: { l: 66, r: 18, t: 30, b: 44 },
      font: { family: fuente, size: 12, color: '#1f3656' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fff',
      hovermode: 'x unified', hoverlabel: { namelength: -1 },
      legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.02, yanchor: 'bottom', font: { size: 11.5 }, bgcolor: 'rgba(255,255,255,0)' },
      // El MISMO rango exacto en todas (si cada una calculara su margen, las fechas no quedarían alineadas).
      xaxis: { type: 'date', hoverformat: '%d-%b-%Y %H:%M', showspikes: true, spikemode: 'across', spikethickness: 1, spikecolor: '#8a97ab', gridcolor: '#eef1f6',
        ...(rango ? { range: rango, autorange: false } : {}) },
      yaxis: { title: { text: p.unidad, font: { size: 12 } }, gridcolor: '#eef1f6', ...p.eje, ...(escala ? { range: escala.rango, autorange: false } : {}) },
      shapes: shapes[clave], annotations: annotations[clave]
    };
    const config = { responsive: true, displaylogo: false, locale: 'es', scrollZoom: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: { filename: 'cargabilidad_scada_' + d.etiqueta.replace(/[^a-z0-9]+/gi, '_') + '_' + clave } };
    await Plotly.react(lienzo, datos, layout, config);
    if (!vigente()) { liberarFigura(div); return; }
    graficas.push(lienzo);
  }
  // Zoom compartido: acercar (o volver a ver todo) en una gráfica lo hace en todas.
  let sincronizando = false;
  for (const g of graficas) {
    g.on('plotly_relayout', (ev) => {
      if (sincronizando || !ev) return;
      let upd = null;
      if (ev['xaxis.autorange']) upd = rango ? { 'xaxis.range': rango } : { 'xaxis.autorange': true };   // «ver todo» = el rango pedido
      else if (ev['xaxis.range[0]'] != null) upd = { 'xaxis.range': [ev['xaxis.range[0]'], ev['xaxis.range[1]']] };
      else if (Array.isArray(ev['xaxis.range'])) upd = { 'xaxis.range': ev['xaxis.range'] };
      if (!upd) return;
      sincronizando = true;
      Promise.all(graficas.filter((o) => o !== g).map((o) => Plotly.relayout(o, upd))).finally(() => { sincronizando = false; });
    });
  }
}

/**
 * Escala vertical cuando se ven máximos, mínimos o instantáneos: se ajusta al GRUESO de los datos (todo
 * el promedio y el 99 % central de los extras), para que unos pocos picos de la hora no aplasten la curva.
 * Devuelve el rango y cuántos valores quedan fuera (se avisa; «Autoescala» los muestra). Sin extras, null.
 */
function escalaConExtras(proms, extras, desdeCero) {
  if (!extras || !extras.length) return null;
  let lo = Infinity; let hi = -Infinity;
  for (const a of proms) for (const v of a) if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const ex = [];
  for (const a of extras) for (const v of a) if (Number.isFinite(v)) ex.push(v);
  if (!ex.length) return null;
  ex.sort((a, b) => a - b);
  const q = (p) => ex[Math.min(ex.length - 1, Math.max(0, Math.floor(p * (ex.length - 1))))];
  lo = Math.min(lo, q(0.005)); hi = Math.max(hi, q(0.995));
  if (desdeCero) lo = Math.min(0, lo);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
  const rango = [desdeCero && lo >= 0 ? 0 : lo - pad, hi + pad];
  let fuera = 0;
  for (const v of ex) if (v < rango[0] || v > rango[1]) fuera++;
  return { rango, fuera };
}

/**
 * Franja entre el mínimo y el máximo de cada hora: un polígono por tramo continuo (máx de ida, mín de
 * vuelta), así los huecos quedan como huecos. Siempre SVG (el relleno de WebGL no respeta los cortes);
 * va debajo de las líneas y no entra en el recuadro del cursor (las líneas máx/mín ya lo dicen).
 */
function franja(x, mx, mn, nombre, color) {
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
    type: 'scatter', mode: 'lines', x: xs, y: ys, name: nombre, fill: 'toself', connectgaps: false,
    fillcolor: hexAlfa(color, 0.16), line: { width: 0, color }, hoverinfo: 'skip'
  };
}
const hexAlfa = (hex, a) => {
  const m = String(hex).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : hex;
};

/** Libera la figura (al salir del detalle o cambiar de nivel). */
export function liberarFigura(div) {
  if (!div || !window.Plotly) return;
  const graficas = div.classList && div.classList.contains('js-plotly-plot') ? [div] : [...div.querySelectorAll('.js-plotly-plot')];
  for (const g of graficas) { try { window.Plotly.purge(g); } catch (_) { /* nada */ } }
}
