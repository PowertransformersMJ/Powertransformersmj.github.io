// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · «Cada devanado con sus límites de PLACA» (mes a mes y a la fecha) · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedidos del Ingeniero (2026-10-23): «que se vea la cargabilidad de cada devanado con sus límites de potencia y
// ampacidad» · «me gustaría verlos en barras» · «colores por devanado» · «valida las potencias, recuerda que todo es con
// base a la placa; en las gráficas ubica umbrales de potencia ONAN y ONAF».
// Los LÍMITES salen de la placa leída (`placas_caracteristicas`, `domain/placa_etapas.js`): por devanado, sus etapas ONAN y
// ONAF en MVA y su corriente a la tensión de placa de la conexión del equipo (si la placa solo trae ONAN, ese es el límite y
// los textos dicen «% de ONAN»). Si la ampacidad que usa la plataforma no es ese límite, o la tensión de placa no es la de
// la plataforma, se avisa (se corrige aparte, en la revisión equipo por equipo). Sin placa legible para un devanado, su
// límite cae en la ampacidad de la plataforma y se dice cuál.
// Arriba, en barras: por devanado, su límite mayor (barra clara), su ONAN (marca) y su carga a la fecha. En cada bloque, la
// corriente de cada mes y a la fecha (lo que solo se supera el 1 % de las horas, como la lista) con las líneas ONAN y ONAF,
// en amperios y en MVA equivalentes a la tensión de placa (no es la potencia que mide el SCADA con P y Q).
// Sin cálculo propio de la carga: sale de `serieMensualEquipo`. Un color por devanado; lo provisional o con aviso, rayado.
// Archivo NUEVO (L-102): «mes a mes» lo carga con import(); si falla, el bloque se oculta.
// ══════════════════════════════════════════════════════════════

import { el, poner, num } from './dom.js';
import { nombreMes } from '../../domain/scada_carga_fecha.js';
import { kvTexto, ampTexto, mvaTexto, TEXTO_AVISO_DEVANADO } from '../../domain/scada_carga_devanados.js';
import { CRG_CHIP } from '../../domain/scada_carga_config.js';
import { califCRG } from '../../domain/scada_carga_kpis.js';
import { leerPlaca } from '../../data/placas_caracteristicas.js';
import { limitesDePlaca } from '../../domain/placa_etapas.js';
import { umbralesDevanado, motivoSinCifra, estadoDevanados, pctDe } from '../../domain/scada_devanados_mes.js';
import { loadPlotly } from '../../plotly-loader.js';

const CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corto = (mes) => CORTOS[Number(String(mes).slice(5, 7)) - 1] + ' ' + String(mes).slice(2, 4);
const SIN = '#9AA6B8';
// Un color por devanado (el mismo en el resumen y en su bloque).
const COLOR_DEV = { P: '#0072B2', S: '#E69F00', T: '#8E44AD' };
const NOMBRE_COLOR = { P: 'azul', S: 'ámbar', T: 'morado' };
const tinte = (hex, a) => 'rgba(' + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
// Umbrales de placa: ONAN (sin ventiladores) y ONAF (con ventiladores; la mayor etapa).
const C_ONAN = '#B85C00'; const C_ONAF = '#C91A14';
const AVISO_PLACA = new Set(['errata_x10', 'no_cuadra_placa', 'parece_monofasico']);
const MVA_EQ = 'MVA equivalentes';

/** Chip con la regla de la lista (color solo si es firme) y neutro si el devanado tiene aviso de placa o si su ampacidad en
 *  la plataforma no es el límite de la placa: entonces dice la cifra con la ampacidad de la PLATAFORMA (la que usa la cifra
 *  oficial), para que no se lea como la calificación del % de placa que va al lado. */
function chip(pct, firme, umbrales, aviso, difA = false) {
  const crg = califCRG(pct, umbrales);
  if (aviso && AVISO_PLACA.has(aviso)) return el('span', { class: 'chip chip--provisional' }, 'Por revisar placa' + (crg ? ' · CRG ' + crg : ''));
  if (difA) return el('span', { class: 'chip chip--provisional' }, 'Con la ampacidad de la plataforma: ' + num(pct, 1) + ' %' + (crg ? ' · CRG ' + crg : '') + ' · por revisar');
  if (firme && crg) return el('span', { class: 'chip ' + CRG_CHIP[crg].clase }, 'CRG ' + crg + ' · ' + CRG_CHIP[crg].palabra);
  return el('span', { class: 'chip chip--provisional' }, 'Provisional' + (crg ? ' · CRG ' + crg : ''));
}
const de = (lista, d) => (lista || []).find((x) => x.d === d) || null;

// % frente al límite mayor, con su nombre; un terciario de compensación no tiene límite de carga.
const pctTexto = (i, u) => (u.sinLimite ? 'sin límite de carga (compensación)' : num(pctDe(i, u.onaf), 1) + ' % de ' + u.tope);
const pctCorto = (i, lim) => { const v = pctDe(i, lim); return v == null ? '—' : num(v, 1) + ' %'; };
// De dónde sale cada corriente límite: la que GRABA la placa, la calculada con su potencia y su tensión, o la de la plataforma.
const ORIGEN_A = { impresa: 'impresa en la placa', calculada: 'calculada de la placa', plataforma: 'de la plataforma' };
const mvaEq = (u, i) => (i != null && u.f ? mvaTexto(i * u.f) + ' ' + MVA_EQ : 'sin potencia (falta la tensión)');

// La placa leída de cada equipo, una vez por sesión (el panel de placa hace su propia lectura): solo las lecturas buenas.
const placas = new Map();
async function placaDe(idTx) {
  if (placas.has(idTx)) return placas.get(idTx);
  const rp = await leerPlaca(idTx);
  if (rp && !rp.error) { placas.set(idTx, rp); while (placas.size > 20) placas.delete(placas.keys().next().value); }
  return rp;
}

/** Por qué un devanado no tiene cifra A LA FECHA, para el resumen: se mide sin cifra · sin señal en uso · sin lectura. */
const ROTULO_ESTADO = { sinCifra: 'se mide, sin cifra', sinSenal: 'sin señal en uso', sinLectura: 'sin lectura de los meses' };

/** Resumen en barras: por devanado, su límite mayor (barra clara), su ONAN (marca) y su carga a la fecha, en A y en MVA. */
async function dibujarResumen(Plotly, { resA, resM, registrados, U, conCifraEq, fuente, estado }) {
  const nombres = registrados.map((b) => b.nombre + (b.kv ? ' ' + kvTexto(b.kv) + ' kV' : ''));
  const hoy = registrados.map((b) => (conCifraEq ? de(conCifraEq.acumulado.devanados, b.d) : null));
  const firme = !!(conCifraEq && conCifraEq.acumulado.firme);
  const color = (b) => COLOR_DEV[b.d] || SIN;
  const una = async (div, { titulo, unidad, en }) => {
    const lim = registrados.map((b) => en(U[b.d].onaf, U[b.d]));
    const onan = registrados.map((b) => (U[b.d].onan ? en(U[b.d].onan, U[b.d]) : null));
    const val = registrados.map((b, k) => (hoy[k] && hoy[k].pct != null ? en({ A: hoy[k].iP99, mva: U[b.d].f ? hoy[k].iP99 * U[b.d].f : null }, U[b.d]) : null));
    const fmt = (v) => (v == null ? '—' : unidad === 'A' ? ampTexto(v) + ' A' : mvaTexto(v) + ' MVA');
    const fmtCarga = (v) => (v == null ? '—' : unidad === 'A' ? ampTexto(v) + ' A' : mvaTexto(v) + ' MVA eq.');
    const maxY = Math.max(...lim.filter((v) => v != null), ...val.filter((v) => v != null)) * 1.32 || 1;
    const xs = registrados.map((b, k) => nombres[k] + '<br><b>' + (val[k] == null ? ROTULO_ESTADO[estado[b.d]] || 'sin cifra'
      : fmtCarga(val[k]) + ' · ' + pctTexto(hoy[k].iP99, U[b.d])) + '</b>');
    await Plotly.newPlot(div, [
      { type: 'bar', name: 'Límite mayor', x: xs, y: lim, width: 0.62,
        marker: { color: registrados.map((b) => tinte(color(b), 0.14)), line: { color: registrados.map(color), width: 1.8 } },
        // Encima de cada barra, sus límites: ONAN (naranja, si la placa trae ventiladores) y el mayor (rojo).
        text: lim.map((v, k) => (v == null ? '' : (onan[k] != null ? '<span style="color:' + C_ONAN + '">ONAN ' + fmt(onan[k]) + '</span><br>' : '')
          + (U[registrados[k].d].dePlaca ? U[registrados[k].d].tope + ' ' : 'ampacidad ') + fmt(v))), textposition: 'outside', cliponaxis: false,
        textfont: { color: C_ONAF, size: 11 }, textangle: 0, hovertemplate: '%{text}<extra>Límite</extra>' },
      { type: 'bar', name: 'A la fecha', x: xs, y: val, width: 0.34, marker: { color: registrados.map(color),
        pattern: { fillmode: 'overlay', shape: registrados.map((b, k) => (val[k] != null && (!firme || AVISO_PLACA.has(b.aviso) || U[b.d].difA) ? '/' : '')), size: 6, solidity: 0.3 } },
        customdata: val.map((v, k) => (v == null ? ROTULO_ESTADO[estado[registrados[k].d]] || 'sin cifra'
          : fmtCarga(v) + ' · ' + pctTexto(hoy[k].iP99, U[registrados[k].d])
          + (U[registrados[k].d].onan ? ' · ' + num(pctDe(hoy[k].iP99, U[registrados[k].d].onan), 1) + ' % de ONAN' : ''))),
        hovertemplate: '%{customdata}<extra>A la fecha</extra>' },
      // ONAN: una marca horizontal sobre cada barra (su cifra va escrita encima de la barra).
      { type: 'scatter', mode: 'markers', name: 'ONAN (placa)', x: xs, y: onan, cliponaxis: false,
        marker: { symbol: 'line-ew', size: 46, line: { color: C_ONAN, width: 3 } },
        customdata: onan.map((v) => (v == null ? '' : 'ONAN ' + fmt(v))), hovertemplate: '%{customdata}<extra>Sin ventiladores</extra>' }
    ], {
      title: { text: titulo, font: { size: 13 }, x: 0, xanchor: 'left' }, barmode: 'overlay', height: 280, dragmode: false,
      margin: { l: 52, r: 10, t: 34, b: 58 }, font: { family: fuente, size: 12, color: '#1f3656' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fff',
      showlegend: false, xaxis: { type: 'category', fixedrange: true }, yaxis: { title: { text: unidad }, range: [0, maxY], gridcolor: '#eef1f6', fixedrange: true }
    }, { displaylogo: false, responsive: true, locale: 'es', displayModeBar: false });
  };
  const deQue = registrados.every((b) => U[b.d].dePlaca) ? 'sus límites de placa' : 'sus límites (de placa o, sin placa, de la plataforma)';
  await una(resA, { titulo: 'Corriente frente a ' + deQue, unidad: 'A', en: (x) => x.A });
  if (!resM.isConnected) return;
  await una(resM, { titulo: 'Potencia equivalente frente a ' + deQue, unidad: 'MVA', en: (x) => x.mva });
}

/**
 * Pinta un bloque por devanado.
 * @param {HTMLElement} nodo
 * @param {{serie: Array, mat: string, tx: object, umbrales?: object, vigente?: () => boolean}} opts  `serie` = `serieMensualEquipo`
 * @returns {Promise<{completa: boolean}>}
 */
export async function pintarDevanadosMes(nodo, opts) {
  const { serie, mat, tx, umbrales, vigente = () => true } = opts;
  const leido = [...serie].reverse().find((x) => x.cargado && x.leido) || serie[serie.length - 1];
  const registrados = (leido && leido.acumulado.devanados && leido.acumulado.devanados.length ? leido.acumulado.devanados
    : (leido && leido.mensual.devanados)) || [];
  if (!registrados.length) { nodo.hidden = true; return { completa: true }; }
  // Límites de PLACA (lectura de la foto); sin placa, los de la plataforma.
  const rp = tx && tx.id ? await placaDe(tx.id) : { hay: false };
  if (!vigente()) return { completa: true };
  const lp = rp && rp.hay ? limitesDePlaca(rp.placa, tx) : null;
  const U = Object.fromEntries(registrados.map((b) => [b.d, umbralesDevanado(b, lp)]));
  const titulo = el('h4', { class: 'cs-devmes-tit' }, 'Cada devanado: cargabilidad y sus límites de placa (ONAN y ONAF)');
  const enPlataforma = registrados.filter((b) => !U[b.d].dePlaca).map((b) => b.nombre.toLowerCase());
  const origen = rp && rp.error
    ? el('p', { class: 'cs-ayuda' }, (rp.mensaje || 'No se pudo leer la placa.') + ' Mientras tanto, los límites son los de la plataforma. ',
      el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { placas.delete(tx.id); pintarDevanadosMes(nodo, opts); } }, 'Reintentar'))
    : el('p', { class: 'cs-ayuda' }, !lp ? 'Este equipo no tiene placa registrada: los límites son los de la plataforma (ampacidad y su potencia).'
      : 'Límites tomados de la placa característica' + (enPlataforma.length ? '; el ' + enPlataforma.join(' y el ') + ' usa'
        + (enPlataforma.length > 1 ? 'n' : '') + ' la ampacidad de la plataforma' + (lp.nota ? ' (' + lp.nota + ')' : '') : '') + '.'
        + (lp.documento === 'plano' ? ' La lectura es del PLANO de placa del fabricante, no de una foto de la placa instalada.' : '')
        + (lp.futuro ? ' Es la placa de un equipo marcado «futuro»: confirmar en campo que es el que está en servicio.' : ''));
  // Estado de cada devanado A LA FECHA (para el resumen y su bloque).
  const ed = estadoDevanados(serie, registrados);
  const { algunoLeido, conCifraEq } = ed;
  const estado = Object.fromEntries(registrados.map((b) => [b.d, ed.porDevanado[b.d].estado]));
  const resA = el('div', { class: 'cs-devmes-res-graf', role: 'img', 'aria-label': 'Corriente a la fecha de cada devanado de ' + mat + ' frente a sus límites; los bloques de abajo traen las cifras.' });
  const resM = el('div', { class: 'cs-devmes-res-graf', role: 'img', 'aria-label': 'Potencia equivalente a la fecha de cada devanado de ' + mat + ' frente a sus límites; los bloques de abajo traen las cifras.' });
  const resumen = el('div', { class: 'cs-devmes-res' }, resA, resM);
  const bloques = [];
  const graficas = [];
  for (const base of registrados) {
    const d = base.d; const u = U[d];
    const idTit = 'csDevmes' + d;
    const { conNiveles, conCifra, hoy, motivo, niveles } = ed.porDevanado[d];
    const limites = el('p', { class: 'cs-dato' }, el('b', {}, u.dePlaca ? 'Límites de placa: ' : 'Límites (de la plataforma): '),
      u.sinLimite ? 'ninguno (terciario de compensación)' : u.etapas.length
        ? u.etapas.map((e) => e.nombre + ' ' + mvaTexto(e.mva) + ' MVA (' + ampTexto(e.A) + ' A, ' + (ORIGEN_A[e.origen] || 'calculada de la placa') + ')').join(' · ') : '—',
      u.dePlaca && u.kv ? el('span', { class: 'cs-sub' }, ' a ' + kvTexto(u.kv) + ' kV de placa') : null);
    // La ampacidad que usa la plataforma frente a la ONAF de placa: si no cuadran, se avisa (se corrige aparte).
    const difA = u.difA;
    const avisos = [base.aviso && TEXTO_AVISO_DEVANADO[base.aviso],
      difA && 'la ampacidad de la plataforma (' + ampTexto(base.A) + ' A) no es la ' + u.tope + ' de la placa (' + ampTexto(u.onaf.A) + ' A): la cifra oficial usa la de la plataforma hasta que se corrija',
      u.difKv && 'la tensión de placa (' + kvTexto(u.kv) + ' kV) no es la de la plataforma (' + kvTexto(u.kvPlataforma) + ' kV): los límites van a la de placa',
      u.compensa && 'la placa lo da como terciario de compensación o estabilización: no está hecho para llevar carga'].filter(Boolean);
    const tramo = conCifraEq ? (conCifraEq.acumulado.nMeses > 1 ? nombreMes(conCifraEq.acumulado.desde) + ' a ' + nombreMes(conCifraEq.mes) : nombreMes(conCifraEq.mes)) : '';
    const linHoy = hoy && hoy.pct != null
      ? el('p', { class: 'cs-dato' }, el('b', {}, 'A la fecha: '), ampTexto(hoy.iP99) + ' A · ' + mvaEq(u, hoy.iP99) + ' · ' + pctTexto(hoy.iP99, u)
        + (u.onan ? ' · ' + num(pctDe(hoy.iP99, u.onan), 1) + ' % de ONAN' : '') + ' ',
        chip(hoy.pct, conCifraEq.acumulado.firme, umbrales, base.aviso, u.difA),
        el('span', { class: 'cs-sub' }, ' ' + tramo + (hoy.manda ? ' · da la cifra del equipo' : '')))
      : null;
    const cab = el('div', { class: 'cs-devmes-cab' }, el('h5', { id: idTit }, base.nombre + (base.kv ? ' · ' + kvTexto(base.kv) + ' kV' : '')),
      limites, ...avisos.map((t) => el('p', { class: 'cs-devmes-aviso' }, t)), linHoy);
    const sec = (...hijos) => el('section', { class: 'cs-devmes', style: 'border-left: 5px solid ' + (COLOR_DEV[d] || SIN), 'aria-labelledby': idTit }, ...hijos);
    if (!algunoLeido) { bloques.push(sec(cab, el('p', { class: 'cs-ayuda' }, 'No se pudo leer ningún mes: sin cifras por ahora (Reintentar, arriba); se muestran solo sus límites.'))); continue; }
    if (!conNiveles) { bloques.push(sec(cab, el('p', { class: 'cs-ayuda' }, 'Este devanado no tiene señal del SCADA en uso (no se mide, o su señal quedó fuera en la homologación)'
      + (u.sinLimite ? '.' : ': se muestran solo sus límites.')))); continue; }
    if (!conCifra) {
      // El motivo, del último mes CARGADO y LEÍDO en que el devanado se mide (nunca el de un mes hueco): `estadoDevanados`.
      bloques.push(sec(cab, el('p', { class: 'cs-ayuda' }, 'Se mide en ' + niveles.join(' y ') + ', pero no tiene cifra: ' + motivo + '.')));
      continue;
    }
    const graf = el('div', { class: 'cs-devmes-graf', role: 'img',
      'aria-label': base.nombre + ' de ' + mat + ': corriente de cada mes (barras) y a la fecha (línea) frente a sus límites; la tabla trae las mismas cifras.' });
    graficas.push({ graf, base, d });
    const filas = serie.map((x) => {
      const m = de(x.mensual.devanados, d); const a = de(x.acumulado.devanados, d);
      const celdasMes = !m || m.pct == null ? [el('td', { class: 'cs-mensual-nulo', colspan: u.onan ? '4' : '3' }, motivoSinCifra(m, x.mensual))]
        : [el('td', {}, ampTexto(m.iP99) + ' A'), el('td', {}, mvaEq(u, m.iP99)),
          el('td', {}, el('b', {}, pctCorto(m.iP99, u.onaf)), ' ', chip(m.pct, x.mensual.firme, umbrales, base.aviso, u.difA)),
          u.onan ? el('td', {}, pctCorto(m.iP99, u.onan)) : null];
      return el('tr', {}, el('th', { scope: 'row' }, nombreMes(x.mes)), ...celdasMes,
        a && a.pct != null
          ? el('td', {}, ampTexto(a.iP99) + ' A · ' + mvaEq(u, a.iP99) + ' · ', el('b', {}, pctCorto(a.iP99, u.onaf)),
            x.acumulado.firme ? null : el('span', { class: 'cs-sub' }, 'provisional'))
          : el('td', { class: 'cs-mensual-nulo' }, motivoSinCifra(a, x.acumulado)));
    });
    const tabla = el('div', { class: 'cs-tabla-caja cs-mensual-caja' }, el('table', { class: 'cs-tabla cs-mensual-tabla' },
      el('caption', { class: 'cs-mensual-cap' }, base.nombre + ' de ' + mat + ' por mes'),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Mes'), el('th', { scope: 'col' }, 'Corriente del mes'),
        el('th', { scope: 'col' }, 'Potencia equivalente'), el('th', { scope: 'col' }, u.sinLimite ? '% del límite (no tiene)' : '% de ' + u.tope + (!u.dePlaca ? '' : u.onan ? ' (con ventiladores)' : ' (sin ventiladores)')),
        u.onan ? el('th', { scope: 'col' }, '% de ONAN (sin ventiladores)') : null, el('th', { scope: 'col' }, 'Acumulada a la fecha'))),
      el('tbody', {}, filas)));
    bloques.push(sec(cab, graf, tabla));
  }
  const ayuda = el('p', { class: 'cs-ayuda' },
    'Corriente = la de la fase más cargada que solo se supera el 1 % de las horas: del mes, o de todas las horas a la fecha (como máximo los últimos 12 meses). ',
    'ONAN = potencia de placa sin ventiladores; ONAF = con ventiladores (la mayor etapa); si la placa solo trae ONAN, ese es su límite. Su corriente es la de esa potencia a la tensión de placa de la conexión del equipo. ',
    'Cada corriente límite dice de dónde sale: «impresa en la placa» (la graba la placa) o «calculada de la placa» (potencia ÷ (√3 × tensión de placa), cuando la placa no la graba). ',
    'Potencia equivalente (MVA eq.) = la corriente medida a la tensión de placa; no es la potencia que mide el SCADA con P y Q. ',
    'Arriba, en barras: el límite mayor de cada devanado (barra clara), su ONAN (marca naranja) y su carga a la fecha (barra de adentro). Cada devanado tiene su color: '
      + registrados.map((b) => b.nombre.toLowerCase() + ' ' + (NOMBRE_COLOR[b.d] || 'gris')).join(', ') + '; lo provisional o con aviso de placa va rayado.');
  poner(nodo, titulo, origen, resumen, ...bloques, ayuda);
  nodo.hidden = false;

  try {
    const Plotly = await loadPlotly();
    if (!vigente()) return { completa: true };
    const x = serie.map((s) => corto(s.mes));
    const fuente = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    if (resumen.isConnected) await dibujarResumen(Plotly, { resA, resM, registrados, U, conCifraEq, fuente, estado });
    for (const { graf, base, d } of graficas) {
      if (!vigente()) return { completa: true };
      if (!graf.isConnected) return { completa: false };
      const u = U[d]; const f = u.f;
      const dudosa = AVISO_PLACA.has(base.aviso) || u.difA;
      const mes = serie.map((s) => de(s.mensual.devanados, d));
      const acu = serie.map((s) => de(s.acumulado.devanados, d));
      const y = mes.map((v) => (v && v.pct != null ? v.iP99 : null));
      const yA = acu.map((v) => (v && v.pct != null ? v.iP99 : null));
      // Una ampacidad de plataforma más de 2 veces distinta del límite (un ×10) no entra en la escala: se nombra arriba.
      const topes = [u.onaf.A, u.fueraEscala ? null : base.A].filter((v) => v > 0);
      const maxY = Math.max(...topes.map((v) => v * 1.15), ...y.filter((v) => v != null).map((v) => v * 1.12), ...yA.filter((v) => v != null).map((v) => v * 1.12));
      const texto = (v) => (v && v.pct != null ? [ampTexto(v.iP99) + ' A', f ? mvaTexto(v.iP99 * f) + ' ' + MVA_EQ : 'sin potencia', pctTexto(v.iP99, u)] : ['', '', '']);
      const datos = [
        { type: 'bar', name: 'Corriente del mes', x, y, marker: { color: COLOR_DEV[d] || SIN,
          pattern: { fillmode: 'overlay', shape: serie.map((s, k) => (y[k] != null && (dudosa || !s.mensual.firme) ? '/' : '')), size: 6, solidity: 0.3 } },
          text: mes.map((v) => (v && v.pct != null && !u.sinLimite ? pctCorto(v.iP99, u.onaf) : '')), textposition: 'inside', insidetextanchor: 'end',
          insidetextfont: { color: d === 'S' ? '#1d2b44' : '#ffffff' },
          customdata: mes.map(texto), hovertemplate: '%{x}: %{customdata[0]} · %{customdata[1]} · %{customdata[2]}<extra>Del mes</extra>' },
        { type: 'scatter', mode: 'lines+markers', name: 'Acumulada a la fecha', x, y: yA, connectgaps: false,
          line: { color: '#1d2b44', width: 2.2 }, marker: { size: 6, color: '#1d2b44' },
          customdata: acu.map(texto), hovertemplate: '%{x}: %{customdata[0]} · %{customdata[1]} · %{customdata[2]}<extra>A la fecha</extra>' }
      ];
      // Escala de la derecha en MVA equivalentes, alineada con la de amperios: se fija con una traza invisible.
      if (f) datos.push({ type: 'scatter', x: [x[0]], y: [0], yaxis: 'y2', showlegend: false, hoverinfo: 'skip', marker: { opacity: 0 } });
      const lineaH = (yv, c, dash, ancho) => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: yv, y1: yv, line: { color: c, width: ancho, dash } });
      const nota = (yv, c, t, ancla, debajo = false) => ({ xref: 'paper', x: ancla === 'der' ? 1 : 0, xanchor: ancla === 'der' ? 'right' : 'left', yref: 'y', y: yv,
        yanchor: debajo ? 'top' : 'bottom', showarrow: false, text: t, font: { size: 11, color: c }, bgcolor: 'rgba(255,255,255,0.85)' });
      const shapes = []; const annotations = [];
      // La ampacidad de la plataforma se dibuja solo si no es la ONAF de placa. Su rótulo va al lado con la etapa más
      // lejana; si aun así queda muy cerca de una (menos del 8 % de la escala), el de abajo se escribe bajo su línea.
      const conPlataforma = u.difA && !u.fueraEscala;
      const lado = (k) => (k % 2 ? 'der' : 'izq');
      const dist = (l) => Math.min(Infinity, ...u.etapas.filter((e, k) => lado(k) === l).map((e) => Math.abs(e.A - base.A)));
      const ladoPlat = dist('der') > dist('izq') ? 'der' : 'izq';
      const vecina = conPlataforma ? u.etapas.findIndex((e, k) => lado(k) === ladoPlat && Math.abs(e.A - base.A) < 0.08 * maxY) : -1;
      // Umbrales de placa: cada etapa (ONAN naranja punteada; la última, ONAF, roja).
      u.etapas.forEach((e, k) => {
        const ult = k === u.etapas.length - 1;
        shapes.push(lineaH(e.A, ult ? C_ONAF : C_ONAN, ult ? 'dash' : 'dot', ult ? 1.6 : 1.4));
        annotations.push(nota(e.A, ult ? C_ONAF : C_ONAN, (u.dePlaca ? e.nombre + ' ' : 'Ampacidad ') + mvaTexto(e.mva) + ' MVA = ' + ampTexto(e.A) + ' A'
          + (e.origen === 'impresa' ? ' (impresa)' : e.origen === 'calculada' ? ' (calculada)' : ''),
          lado(k), k === vecina && base.A > e.A));
      });
      if (conPlataforma) {
        shapes.push(lineaH(base.A, '#6b7a90', 'longdash', 1.2));
        annotations.push(nota(base.A, '#4d6485', 'Ampacidad en la plataforma ' + ampTexto(base.A) + ' A', ladoPlat,
          vecina >= 0 && base.A < u.etapas[vecina].A));
      } else if (u.difA && u.fueraEscala) {
        annotations.push({ xref: 'paper', yref: 'paper', x: 0, y: 1.02, xanchor: 'left', yanchor: 'bottom', showarrow: false,
          text: 'Ampacidad en la plataforma: ' + ampTexto(base.A) + ' A (fuera de escala)', font: { size: 11, color: '#4d6485' } });
      }
      await Plotly.newPlot(graf, datos, {
        height: 280, margin: { l: 56, r: f ? 64 : 12, t: 26, b: 36 }, bargap: 0.35, dragmode: false,
        font: { family: fuente, size: 12, color: '#1f3656' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fff',
        legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.04, yanchor: 'bottom', font: { size: 11 } },
        xaxis: { type: 'category', gridcolor: '#eef1f6' },
        // Escalas fijas: arrastrar una sola separaría las dos y las líneas dejarían de marcar la potencia.
        yaxis: { title: { text: 'A' }, range: [0, maxY], gridcolor: '#eef1f6', zeroline: false, fixedrange: true },
        ...(f ? { yaxis2: { title: { text: MVA_EQ }, overlaying: 'y', side: 'right', range: [0, maxY * f], showgrid: false, zeroline: false, fixedrange: true } } : {}),
        shapes, annotations
      }, { displaylogo: false, responsive: true, locale: 'es', modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines', 'zoom2d', 'pan2d'] });
    }
  } catch (e) {
    console.warn('[cargabilidad-scada] devanados mes a mes', e);
    for (const { graf } of [...graficas, { graf: resA }, { graf: resM }]) {
      if (window.Plotly && graf.classList.contains('js-plotly-plot')) { try { window.Plotly.purge(graf); } catch (_) { /* nada */ } }
      graf.removeAttribute('role'); graf.removeAttribute('aria-label'); graf.style.minHeight = '0';
      poner(graf, el('p', { class: 'cs-ayuda' }, 'No se pudo dibujar la gráfica; la tabla trae las mismas cifras.'));
    }
  }
  return { completa: true };
}
