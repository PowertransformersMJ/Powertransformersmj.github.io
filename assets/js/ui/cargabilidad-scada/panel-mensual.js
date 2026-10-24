// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · «Cargabilidad mes a mes y acumulada» de UN equipo · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-23): ver el transcurso de la cargabilidad mes a mes y acumulada a la fecha, en todos los
// equipos. Barras = la cifra de cada mes (la de la lista en «Un mes»); línea = el acumulado a la fecha (la de «Varios
// meses» desde el primer mes del punto: p99 de TODAS las horas, `99 §159`). Las barras de un mes provisional van rayadas
// (el color nunca es la única señal). Debajo, la misma información en tabla (accesible y para leer cifras exactas).
// `conPromedio` agrega la media simple de las cifras mensuales, SOLO para que el Ingeniero compare en la vista previa.
// Archivo NUEVO (L-102): el detalle lo carga con import(); si falla, su ranura queda oculta.
// ══════════════════════════════════════════════════════════════

import { el, poner, num } from './dom.js';
import { leerResumenMes } from '../../data/scada_carga.js';
import { serieMensualEquipo, mesesDelEquipo } from '../../domain/scada_carga_mensual.js';
import { CRG_CHIP, DEVANADO, CALCULO } from '../../domain/scada_carga_config.js';
import { BASELINE_UMBRALES_SALUD } from '../../domain/umbrales_salud_baseline.js';
import { nombreMes } from '../../domain/scada_carga_fecha.js';
import { loadPlotly } from '../../plotly-loader.js';

const CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corto = (mes) => CORTOS[Number(String(mes).slice(5, 7)) - 1] + ' ' + String(mes).slice(2, 4);
// Colores de la escala CRG (los mismos tonos de los chips): 1 verde · 2 verde azulado · 3 ámbar · 4 naranja · 5 rojo.
const COLOR_CRG = { 1: '#2E8B57', 2: '#2A9D8F', 3: '#D4A017', 4: '#E07B24', 5: '#C62828' };
const SIN = '#9AA6B8';

function cortesCRG(umbrales) {
  const c = { ...BASELINE_UMBRALES_SALUD.crg, ...((umbrales && umbrales.crg) || {}) };
  return [c.c2_min_excl, c.c3_min_excl, c.c4_min_excl, c.c5_min_excl];
}
const pctTexto = (x) => (x == null ? '—' : num(x, 1) + ' %');
/** Chip de la cifra con la MISMA regla de la lista (`chipCifra`, copiada: L-102): color CRG solo si es firme. */
function chip(x) {
  if (x.firme && x.crg) return el('span', { class: 'chip ' + CRG_CHIP[x.crg].clase }, 'CRG ' + x.crg + ' · ' + CRG_CHIP[x.crg].palabra);
  return el('span', { class: 'chip chip--provisional' }, 'Provisional' + (x.crg ? ' · CRG ' + x.crg : ''));
}

/** Una celda: cifra, CRG, firme/provisional y el devanado que la da (o el motivo si no hay cifra). */
function celda(x, { conDevanado }) {
  if (!x || x.pct == null) return el('td', { class: 'cs-mensual-nulo' }, (x && x.motivoNulo) || 'sin cifra');
  return el('td', {},
    el('b', {}, pctTexto(x.pct)), ' ', chip(x),
    conDevanado && x.devMax ? el('span', { class: 'cs-sub' }, 'la da el ' + DEVANADO[x.devMax].toLowerCase()) : null);
}

/**
 * Pinta la sección en su ranura.
 * @param {HTMLElement} nodo  la sección `#csMensual`
 * @param {{a: {tx, fila, punto, cid, mat}, ctx: {homologacion, catalogo, umbrales}, vigente?: () => boolean, conPromedio?: boolean,
 *          alReintentar?: () => void}} opts
 * @returns {Promise<{completa: boolean}>}  completa = false si algún mes no se pudo leer (se rehace al reabrir)
 */
export async function pintarMensual(nodo, { a, ctx, vigente = () => true, conPromedio = false, alReintentar = null }) {
  const titulo = el('h3', { id: 'csMensualTitulo' }, 'Cargabilidad mes a mes y acumulada');
  // Al repintar (Reintentar) se liberan las gráficas anteriores de esta sección (las del equipo y las de sus devanados).
  if (window.Plotly) nodo.querySelectorAll('.js-plotly-plot').forEach((g) => { try { window.Plotly.purge(g); } catch (_) { /* nada */ } });
  nodo.hidden = false;
  poner(nodo, titulo, el('div', { class: 'cs-esqueleto', style: 'height:180px' }), el('p', { class: 'cs-ayuda', role: 'status' }, 'Leyendo los meses…'));
  const meses = mesesDelEquipo(ctx.catalogo, a.punto);
  if (!a.cid || !meses.length) { poner(nodo, titulo, el('p', { class: 'cs-ayuda' }, 'Este equipo no tiene meses del SCADA cargados.')); return { completa: true }; }
  const leidas = await Promise.all(meses.map((m) => leerResumenMes(m)));
  if (!vigente()) return { completa: true };
  // Como la lista: un resumen que no existe es un mes sin datos del exporte (resumen vacío); solo un FALLO de lectura
  // queda sin leer (y deja sin cifra el acumulado que lo contenga).
  const resumenes = Object.fromEntries(meses.map((m, k) => {
    const r = leidas[k];
    return [m, r && r.estado === 'ok' ? r.datos : (r && r.estado === 'no_existe' ? { mes: m, claves: {} } : null)];
  }));
  const serie = serieMensualEquipo({ tx: a.tx, homologacion: ctx.homologacion, catalogo: ctx.catalogo, punto: a.punto, resumenes, umbrales: ctx.umbrales, meses });
  const fallidos = serie.filter((x) => x.cargado && !x.leido).map((x) => nombreMes(x.mes));
  const bandas = cortesCRG(ctx.umbrales);
  const varios = new Set(serie.map((x) => x.mensual.devMax).filter(Boolean)).size > 1 || new Set(serie.map((x) => x.acumulado.devMax).filter(Boolean)).size > 1;
  const ultimo = [...serie].reverse().find((x) => x.acumulado.pct != null);

  const grafica = el('div', { class: 'cs-mensual-graf', role: 'img',
    'aria-label': 'Cargabilidad de ' + a.mat + ' mes a mes (barras) y acumulada a la fecha (línea); la tabla de abajo trae las mismas cifras.' });
  const cab = el('tr', {}, el('th', { scope: 'col' }, 'Mes'), el('th', { scope: 'col' }, 'Cargabilidad del mes'),
    el('th', { scope: 'col' }, 'Acumulada a la fecha'), conPromedio ? el('th', { scope: 'col' }, 'Promedio simple de los meses (referencia)') : null);
  const filas = serie.map((x) => el('tr', {},
    el('th', { scope: 'row' }, nombreMes(x.mes)),
    celda(x.mensual, { conDevanado: varios }),
    x.acumulado.pct == null ? celda(x.acumulado, {}) : el('td', {}, el('b', {}, pctTexto(x.acumulado.pct)), ' ', chip(x.acumulado),
      el('span', { class: 'cs-sub' }, (x.acumulado.nMeses > 1 ? nombreMes(x.acumulado.desde) + ' a ' + nombreMes(x.mes) + ' · ' + x.acumulado.nMeses + ' meses con datos' : 'solo este mes')
        + (varios && x.acumulado.devMax ? ' · la da el ' + DEVANADO[x.acumulado.devMax].toLowerCase() : ''))),
    conPromedio ? el('td', {}, x.promedio.pct == null ? '—' : pctTexto(x.promedio.pct),
      el('span', { class: 'cs-sub' }, x.promedio.nMeses ? x.promedio.nMeses + (x.promedio.nMeses === 1 ? ' mes' : ' meses') + ', cada uno pesa igual' : '')) : null));
  const tabla = el('div', { class: 'cs-tabla-caja cs-mensual-caja' }, el('table', { class: 'cs-tabla cs-mensual-tabla' },
    el('caption', { class: 'cs-mensual-cap' }, 'Cargabilidad de ' + a.mat + ' por mes'), el('thead', {}, cab), el('tbody', {}, filas)));
  const ayuda = el('p', { class: 'cs-ayuda' },
    'Cada mes: la corriente de la fase más cargada que solo se supera el 1 % de las horas, sobre la ampacidad de su devanado (la misma cifra de la lista en «Un mes»). ',
    'Acumulada: lo mismo con TODAS las horas desde el primer mes con datos hasta ese mes, como máximo los últimos 12 meses (la misma cifra de «Varios meses»); no es el promedio de las cifras mensuales. ',
    'Barras grises rayadas = mes provisional (el color de la CRG solo va en lo firme). Líneas grises: cortes CRG ' + bandas.map((v) => num(v, 0)).join(' · ') + ' %; roja: 100 %.',
    fallidos.length ? el('span', { class: 'cs-error' }, ' No se pudieron leer: ' + fallidos.join(', ') + '. ') : null,
    fallidos.length && alReintentar ? el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: (ev) => { ev.currentTarget.disabled = true; alReintentar(); } }, 'Reintentar') : null);
  // «Cada devanado con sus límites de ampacidad y potencia» (2026-10-23): archivo aparte con import(); si falla, se oculta.
  const devNodo = el('div', { class: 'cs-devmes-cont', hidden: true });
  import('./panel-devanados-mes.js')
    .then((m) => (vigente() ? m.pintarDevanadosMes(devNodo, { serie, mat: a.mat, tx: a.tx, umbrales: ctx.umbrales, vigente, fila: a.fila, punto: a.punto }) : null))
    .catch((e) => { console.warn('[cargabilidad-scada] devanados mes a mes', e); devNodo.hidden = true; });
  poner(nodo, titulo,
    ultimo ? el('p', { class: 'cs-dato' }, el('b', {}, 'A la fecha: '), pctTexto(ultimo.acumulado.pct) + ' ', chip(ultimo.acumulado),
      el('span', { class: 'cs-sub' }, ' ' + (ultimo.acumulado.nMeses > 1 ? nombreMes(ultimo.acumulado.desde) + ' a ' + nombreMes(ultimo.mes) : nombreMes(ultimo.mes))
        + (ultimo.acumulado.firme ? '' : ' · provisional'))) : null,
    grafica, tabla, ayuda, devNodo);

  try {
    const Plotly = await loadPlotly();
    if (!vigente()) return { completa: true };
    // Fuera de la página (volvió a la lista antes de terminar) la gráfica saldría con un ancho fijo: se rehace al reabrir.
    if (!grafica.isConnected) return { completa: false };
    const x = serie.map((s) => corto(s.mes));
    const bar = {
      type: 'bar', name: 'Cargabilidad del mes', x, y: serie.map((s) => s.mensual.pct),
      // Color de la CRG solo en lo firme (como la lista); lo provisional va gris y rayado.
      marker: { color: serie.map((s) => (s.mensual.firme && s.mensual.crg ? COLOR_CRG[s.mensual.crg] : SIN)),
        pattern: { fillmode: 'overlay', shape: serie.map((s) => (s.mensual.pct != null && !s.mensual.firme ? '/' : '')), size: 6, solidity: 0.3 } },
      text: serie.map((s) => (s.mensual.pct == null ? '' : num(s.mensual.pct, 1))), textposition: 'outside', cliponaxis: false,
      hovertemplate: '%{x}: %{y:.1f} %<extra>Del mes</extra>'
    };
    const acu = {
      type: 'scatter', mode: 'lines+markers', name: 'Acumulada a la fecha', x, y: serie.map((s) => s.acumulado.pct),
      // Un mes sin cifra corta la línea (no se dibuja una tendencia que no se midió); la tabla dice por qué.
      line: { color: '#1d2b44', width: 2.4 }, marker: { size: 7, color: '#1d2b44' }, connectgaps: false,
      hovertemplate: '%{x}: %{y:.1f} %<extra>Acumulada</extra>'
    };
    const datos = [bar, acu];
    if (conPromedio) datos.push({ type: 'scatter', mode: 'lines', name: 'Promedio de los meses (referencia)', x, y: serie.map((s) => s.promedio.pct),
      line: { color: '#6b7a90', width: 1.6, dash: 'dash' }, connectgaps: false, hovertemplate: '%{x}: %{y:.1f} %<extra>Promedio</extra>' });
    const maxY = Math.max(110, ...serie.flatMap((s) => [s.mensual.pct || 0, s.acumulado.pct || 0]).map((v) => v + 12));
    const lineaH = (y, color, dash) => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { color, width: 1.2, dash } });
    const fuente = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    await Plotly.newPlot(grafica, datos, {
      height: 320, margin: { l: 48, r: 12, t: 28, b: 40 }, bargap: 0.35,
      font: { family: fuente, size: 12, color: '#1f3656' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fff',
      legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.02, yanchor: 'bottom', font: { size: 11.5 } },
      yaxis: { title: { text: '%' }, range: [0, maxY], gridcolor: '#eef1f6', zeroline: false },
      xaxis: { type: 'category', gridcolor: '#eef1f6' },
      shapes: [...bandas.map((v) => lineaH(v, '#8a97ab', 'dot')), lineaH(CALCULO.sobrecargaPct, '#c91a14', 'dash')]
    }, { displaylogo: false, responsive: true, locale: 'es', modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'] });
  } catch (e) {
    console.warn('[cargabilidad-scada] mensual', e);
    grafica.removeAttribute('role'); grafica.removeAttribute('aria-label'); grafica.style.minHeight = '0';
    poner(grafica, el('p', { class: 'cs-ayuda' }, 'No se pudo dibujar la gráfica; la tabla trae las mismas cifras.'));
  }
  // completa = false si algún mes no se pudo leer: el detalle la rehace al reabrir el equipo.
  return { completa: fallidos.length === 0 };
}
