// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · LISTA del parque · `99 §122`
// ──────────────────────────────────────────────────────────────
// Un transformador por fila con su cargabilidad SCADA del mes elegido. Regla visual: solo la
// cifra FIRME lleva el color de su calificación CRG; la provisional va neutra, con su motivo;
// sin cifra, el porqué. La cifra oficial (Excel de Salud de Activos) va al lado con la
// diferencia: una discrepancia se muestra, no se esconde (L-81). Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, num, descargarCSV, conservarFoco } from './dom.js';
import { filasLista, filtrarFilas, ordenarFilas, mesPorDefecto } from '../../domain/scada_carga_vista.js';
import { CRG_CHIP, CALCULO } from '../../domain/scada_carga_config.js';
import { nombreMes, aInputCO, formatoCO } from '../../domain/scada_carga_fecha.js';
import { ventanaDeMes } from '../../domain/scada_carga_series.js';
import { leerResumenMes, leerSeriesPunto } from '../../data/scada_carga.js';
import { BASELINE_UMBRALES_SALUD } from '../../domain/umbrales_salud_baseline.js';

const PASO = 100;
const ESTADOS = { automatica: 'Automática', confirmada: 'Confirmada', pendiente: 'Por confirmar', excluida: 'Excluida', sin_homologacion: 'Sin homologación' };
// Con «Varios meses» (`99 §159`): carga del periodo, peor mes, mayor corriente, desde cuándo supera y el mes a mes.
const COLUMNAS_PERIODO = [
  { campo: 'matricula', texto: 'Transformador' },
  { campo: 'pct', texto: 'Carga del periodo' },
  { campo: 'peor', texto: 'Peor mes' },
  { campo: 'mayor', texto: 'Mayor corriente' },
  { campo: null, texto: 'Desde cuándo supera su capacidad' },
  { campo: null, texto: 'Mes a mes' },
  { campo: null, texto: 'Medida' },
  { campo: null, texto: '' }
];
const MAX_MESES = 12;   // = MAX_MESES_PERIODO del dominio y TIEMPO.maxMesesRango del detalle
const DEV = { P: 'Primario', S: 'Secundario', T: 'Terciario' };
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corto = (mes) => MESES_CORTOS[Number(String(mes).slice(5, 7)) - 1] || mes;
/** Meses de calendario entre dos 'AAAA-MM' (incluidos). */
function mesesEntre(a, b) {
  const out = []; let [y, m] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number);
  while (y < yb || (y === yb && m <= mb)) { out.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
/** 'AAAA-MM' corrido `k` meses (negativo = hacia atrás). */
function correrMes(mes, k) {
  const [y, m] = mes.split('-').map(Number); const t = y * 12 + (m - 1) + k;
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}
/** El periodo acotado a 12 meses de CALENDARIO (el tope del detalle), contando hacia atrás desde «Hasta». */
function acotarPeriodo(desde, hasta) {
  const minimo = correrMes(hasta, -(MAX_MESES - 1));
  return desde < minimo ? { desde: minimo, hasta, acotado: true } : { desde, hasta, acotado: false };
}
/** '#periodo=AAAA-MM_AAAA-MM' → {desde, hasta} o null. */
function leerPeriodo(t) {
  const m = String(t || '').match(/^(\d{4}-\d{2})_(\d{4}-\d{2})$/);
  return m ? (m[1] <= m[2] ? { desde: m[1], hasta: m[2] } : { desde: m[2], hasta: m[1] }) : null;
}

const COLUMNAS = [
  { campo: 'matricula', texto: 'Transformador' },
  { campo: 'pct', texto: 'Cargabilidad SCADA' },
  { campo: null, texto: 'Devanado' },
  { campo: 'oficial', texto: 'Oficial (Excel)' },
  { campo: 'delta', texto: 'Diferencia (mismo devanado)' },
  { campo: null, texto: 'Medida' },
  { campo: null, texto: '' }
];

/** Bandas CRG vigentes como texto ('60 / 65 / 75 / 90 %'). */
export function textoBandas(umbrales) {
  const c = { ...BASELINE_UMBRALES_SALUD.crg, ...((umbrales && umbrales.crg) || {}) };
  return [c.c2_min_excl, c.c3_min_excl, c.c4_min_excl, c.c5_min_excl].map((x) => num(x, 0)).join(' / ') + ' %';
}

/** Chip de la cifra: color CRG solo si es firme. */
export function chipCifra(x) {
  if (x.pct == null) return el('span', { class: 'chip chip--neutro' }, 'Sin cifra');
  if (x.clase === 'firme' && x.crg) {
    const c = CRG_CHIP[x.crg];
    return el('span', { class: 'chip ' + c.clase }, 'CRG ' + x.crg + ' · ' + c.palabra);
  }
  return el('span', { class: 'chip chip--provisional' }, 'Provisional' + (x.crg ? ' · CRG ' + x.crg : ''));
}

// Un desplegable de varias opciones (zona, CRG) se cierra al hacer clic fuera: UN solo oyente de clic para la página.
let cierreMulti = false;
function cerrarMultiAlClicFuera() {
  if (cierreMulti) return;
  cierreMulti = true;
  document.addEventListener('click', (ev) => {
    for (const d of document.querySelectorAll('.cscada details.cs-multi[open]')) if (!d.contains(ev.target)) d.open = false;
  });
}

export function montarLista(cont, ctx, { alAbrir }) {
  const st = {
    modo: 'mes', periodo: null,   // periodo: {desde, hasta, meses, aviso} con «Varios meses» (`99 §159`)
    mes: null, resumen: null, filas: null, error: null, cargando: false, visibles: PASO,
    filtro: { texto: '', zona: [], estado: '', crg: [], soloFirmes: false, soloSostenida: false },
    orden: { campo: 'pct', dir: 'desc' }
  };
  let tablaCaja = null; let contador = null; let kpiCaja = null;
  let turno = 0;   // descarta la respuesta de un mes que ya no es el elegido
  // Una misma curva pedida dos veces a la vez (la lista verificando y el detalle abriéndose) se lee UNA vez.
  const curvasEnCurso = new Map();
  function leerCurvaUnaVez(cid, mes) {
    const k = cid + '|' + mes;
    if (!curvasEnCurso.has(k)) curvasEnCurso.set(k, leerSeriesPunto(cid, [mes]).finally(() => curvasEnCurso.delete(k)));
    return curvasEnCurso.get(k);
  }

  // El orden elegido en un modo no pasa al otro si esa columna no existe allí (vuelve a la cifra, de mayor a menor).
  function ordenDelModo(cols) {
    if (!cols.some((c) => c.campo && c.campo === st.orden.campo)) st.orden = { campo: 'pct', dir: 'desc' };
  }

  async function cargarMes(mes) {
    const mio = ++turno;
    st.modo = 'mes';
    ordenDelModo(COLUMNAS);
    st.mes = mes; st.cargando = true; st.error = null; st.filas = null;
    dibujar();
    const r = await leerResumenMes(mes);
    if (mio !== turno) return;
    st.cargando = false;
    if (r.estado === 'fallo') { st.error = 'No se pudo leer el resumen de ' + nombreMes(mes) + ' (revise la conexión).'; dibujar(); return; }
    st.resumen = r.estado === 'ok' ? r.datos : null;
    try {
      st.filas = filasLista({ parque: ctx.parque, homologacion: ctx.homologacion, catalogo: ctx.catalogo, resumenMes: st.resumen, umbrales: ctx.umbrales });
    } catch (e) {
      // Un dato inesperado no deja la página en «Calculando…»: se dice y se ofrece reintentar.
      console.warn('[cargabilidad-scada] lista', e);
      st.error = 'No se pudo calcular ' + nombreMes(mes) + '.';
    }
    dibujar();
    if (st.filas) verificarSobrecarga(mio, mes);
  }

  // Un nivel con horas imposibles (> 3 × ampacidad) en el mes: su resumen no dice si hubo sobrecarga (`99 §129`). Se lee la
  // curva del mes de ESE punto (rara vez: 1 fila en 8 meses) y se decide con la serie limpia, como el detalle. El cálculo
  // va en un archivo aparte, cargado solo si hace falta: si falla, la marca queda «por confirmar» y la lista sigue igual.
  async function verificarSobrecarga(mio, mes) {
    const pend = st.filas.filter((x) => x.sobrecargaPorVerificar && x.sobrecargaPorVerificar.length);
    if (!pend.length) return;
    let mod = null;
    try { mod = await import('../../domain/scada_carga_sostenida.js'); } catch (e) { console.warn('[cargabilidad-scada] verificar sobrecarga', e); }
    const porConfirmar = (x) => ({ ...x, sobrecargaPorVerificar: [], verificacion: 'fallo' });
    // En paralelo y con tope por mes (free-tier): lo que pase del tope queda «por confirmar» y se ve en «Ver curvas».
    const tope = mod ? mod.MAX_VERIFICAR_MES : 0;
    const nuevas = await Promise.all(pend.map(async (x, k) => {
      if (!mod || k >= tope) return porConfirmar(x);
      try {
        const doc = (await leerCurvaUnaVez(x.claveId, mes)).porMes[mes];
        return mod.aplicarVerificacion(x, x.sobrecargaPorVerificar.map((n) => mod.sobrecargaDeCurva(doc, mes, n.nivel, n.A)));
      } catch (e) { console.warn('[cargabilidad-scada] verificar sobrecarga', e); return porConfirmar(x); }
    }));
    if (mio !== turno) return;
    // Todas las filas a la vez: indicadores, tabla y CSV nunca quedan a medias entre sí.
    pend.forEach((x, k) => { const i = st.filas.indexOf(x); if (i >= 0) st.filas[i] = nuevas[k]; });
    // Solo se repintan los indicadores y la tabla: la barra de filtros (y lo que se esté escribiendo) no se toca.
    if (kpiCaja && kpiCaja.isConnected) { const nuevo = resumenKpis(st.filas); kpiCaja.replaceWith(nuevo); kpiCaja = nuevo; }
    pintarTabla();
  }

  // ── Varios meses (`99 §159`) ──────────────────────────────────────────────
  const mesesCatalogo = () => Object.keys((ctx.catalogo && ctx.catalogo.meses) || {}).sort();

  /** Las filas de UN mes con la sobrecarga verificada en la curva cuando el mes trae horas imposibles (sin repintar). */
  async function verificarFilas(filas, mes) {
    const pend = filas.filter((x) => x.sobrecargaPorVerificar && x.sobrecargaPorVerificar.length);
    if (!pend.length) return filas;
    let mod = null;
    try { mod = await import('../../domain/scada_carga_sostenida.js'); } catch (e) { console.warn('[cargabilidad-scada] verificar sobrecarga', e); }
    const porConfirmar = (x) => ({ ...x, sobrecargaPorVerificar: [], verificacion: 'fallo' });
    const tope = mod ? mod.MAX_VERIFICAR_MES : 0;
    const nuevas = await Promise.all(pend.map(async (x, k) => {
      if (!mod || k >= tope) return porConfirmar(x);
      try {
        const doc = (await leerCurvaUnaVez(x.claveId, mes)).porMes[mes];
        return mod.aplicarVerificacion(x, x.sobrecargaPorVerificar.map((n) => mod.sobrecargaDeCurva(doc, mes, n.nivel, n.A)));
      } catch (e) { console.warn('[cargabilidad-scada] verificar sobrecarga', e); return porConfirmar(x); }
    }));
    return filas.map((x) => { const k = pend.indexOf(x); return k >= 0 ? nuevas[k] : x; });
  }

  /** El periodo pedido: tope de 12 meses de calendario y extremos en meses CARGADOS (los del selector). */
  function normalizar(desde0, hasta0) {
    const { desde: d, acotado } = acotarPeriodo(desde0, hasta0);
    const dentro = mesesCatalogo().filter((m) => m >= d && m <= hasta0);
    return dentro.length ? { desde: dentro[0], hasta: dentro[dentro.length - 1], acotado } : { desde: d, hasta: hasta0, acotado };
  }

  async function cargarPeriodo(desde0, hasta0) {
    const mio = ++turno;
    const { desde, hasta, acotado } = normalizar(desde0, hasta0);
    const meses = mesesCatalogo().filter((m) => m >= desde && m <= hasta);
    const aviso = acotado ? 'Se toman los últimos ' + MAX_MESES + ' meses de calendario hasta ' + nombreMes(hasta0) + ' (tope por consulta).' : null;
    st.modo = 'periodo'; st.periodo = { desde, hasta, meses, aviso };
    ordenDelModo(COLUMNAS_PERIODO);
    st.cargando = true; st.error = null; st.filas = null;
    dibujar();
    if (!meses.length) { st.cargando = false; st.error = 'No hay meses cargados entre ' + nombreMes(desde) + ' y ' + nombreMes(hasta) + '.'; dibujar(); return; }
    let mod = null;
    try { mod = await import('../../domain/scada_carga_periodo.js'); } catch (e) { console.warn('[cargabilidad-scada] periodo', e); }
    if (mio !== turno) return;
    if (!mod) { st.cargando = false; st.error = 'No se pudo abrir el cálculo del periodo (recargue la página).'; dibujar(); return; }
    const leidas = await Promise.all(meses.map((m) => leerResumenMes(m)));
    if (mio !== turno) return;
    const fallo = meses.filter((m, k) => leidas[k].estado === 'fallo');
    if (fallo.length) { st.cargando = false; st.error = 'No se pudo leer ' + fallo.map(nombreMes).join(', ') + ' (revise la conexión).'; dibujar(); return; }
    try {
      const resumenes = {}; const filasPorMes = {};
      meses.forEach((m, k) => {
        resumenes[m] = leidas[k].estado === 'ok' ? leidas[k].datos : null;
        filasPorMes[m] = filasLista({ parque: ctx.parque, homologacion: ctx.homologacion, catalogo: ctx.catalogo, resumenMes: resumenes[m], umbrales: ctx.umbrales });
      });
      const verificadas = await Promise.all(meses.map((m) => verificarFilas(filasPorMes[m], m)));
      if (mio !== turno) return;
      meses.forEach((m, k) => { filasPorMes[m] = verificadas[k]; });
      st.filas = mod.filasPeriodo({ parque: ctx.parque, homologacion: ctx.homologacion, catalogo: ctx.catalogo, meses, resumenes, filasPorMes, umbrales: ctx.umbrales });
    } catch (e) {
      console.warn('[cargabilidad-scada] periodo', e);
      st.error = 'No se pudo calcular el periodo.';
    }
    st.cargando = false;
    dibujar();
  }

  function irAPeriodo(desde0, hasta0) {
    const { desde, hasta } = normalizar(desde0, hasta0);
    st.visibles = PASO;
    history.replaceState(null, '', '#periodo=' + desde + '_' + hasta);
    cargarPeriodo(desde0, hasta0);
  }
  /** «Varios meses» y «Todo lo cargado»: desde el primer mes cargado, sin pasar de 12 meses de calendario. */
  function irATodoLoCargado() {
    const todos = mesesCatalogo();
    if (!todos.length) return;
    const hasta = todos[todos.length - 1];
    irAPeriodo(todos[0], hasta);   // normalizar() aplica el tope de 12 meses de calendario (y lo avisa)
  }

  function mostrar(mesPedido, periodoPedido) {
    const pedido = leerPeriodo(periodoPedido);
    const per = pedido ? normalizar(pedido.desde, pedido.hasta) : null;
    if (per) {
      if (st.modo !== 'periodo' || !st.periodo || st.periodo.desde !== per.desde || st.periodo.hasta !== per.hasta || (!st.filas && !st.cargando && !st.error)) cargarPeriodo(pedido.desde, pedido.hasta);
      return;
    }
    // Al volver del detalle a una lista que estaba en «Varios meses» sin hash de periodo, se queda como estaba.
    if (!mesPedido && st.modo === 'periodo' && st.periodo) return;
    const meses = Object.keys((ctx.catalogo && ctx.catalogo.meses) || {});
    const mes = mesPedido && meses.includes(mesPedido) ? mesPedido : (st.mes || mesPorDefecto(ctx.catalogo));
    if (!mes) { st.mes = null; dibujar(); return; }
    // Un #mes= explícito saca la lista de «Varios meses» aunque sea el mismo mes de antes.
    if (st.modo !== 'mes' || mes !== st.mes || (!st.filas && !st.cargando && !st.error)) cargarMes(mes);
  }

  function cabeceraOrigen() {
    const meses = Object.entries((ctx.catalogo && ctx.catalogo.meses) || {}).sort((a, b) => b[0].localeCompare(a[0]));
    const rotulo = (m, x) => nombreMes(m) + (x && !x.completo ? ' (incompleto: ' + x.nDias + ' de ' + x.dias.length + ' días)' : '');
    const enPeriodo = st.modo === 'periodo' && st.periodo;
    // Periodo: «Un mes» (como siempre) o «Varios meses» (`99 §159`).
    const boton = (id, texto, activo, alPulsar) => el('button', { type: 'button', id, class: 'cs-seg' + (activo ? ' cs-seg--on' : ''), 'aria-pressed': String(activo), onclick: alPulsar }, texto);
    const todos = mesesCatalogo();
    const seg = el('div', { class: 'cs-seg-grupo', role: 'group', 'aria-label': 'Periodo' },
      boton('csModoMes', 'Un mes', !enPeriodo, () => {
        if (!enPeriodo) return;
        const m = st.mes && todos.includes(st.mes) ? st.mes : mesPorDefecto(ctx.catalogo);
        st.visibles = PASO; history.replaceState(null, '', '#mes=' + m); cargarMes(m);
      }),
      boton('csModoPeriodo', 'Varios meses', !!enPeriodo, () => {
        if (enPeriodo || !todos.length) return;
        irATodoLoCargado();
      }));
    let selectores;
    if (enPeriodo) {
      const opciones = (valor) => todos.map((m) => el('option', { value: m, selected: m === valor }, rotulo(m, ctx.catalogo.meses[m])));
      const sD = el('select', { id: 'csDesdeMes', 'aria-label': 'Desde' }, opciones(st.periodo.desde));
      const sH = el('select', { id: 'csHastaMes', 'aria-label': 'Hasta' }, opciones(st.periodo.hasta));
      const aplicar = () => irAPeriodo(sD.value <= sH.value ? sD.value : sH.value, sD.value <= sH.value ? sH.value : sD.value);
      sD.addEventListener('change', aplicar); sH.addEventListener('change', aplicar);
      selectores = [
        el('label', { for: 'csDesdeMes' }, 'Desde', sD),
        el('label', { for: 'csHastaMes' }, 'Hasta', sH),
        el('div', { class: 'cs-acciones', style: 'align-self:end' }, el('button', { type: 'button', id: 'csTodoCargado', class: 'btn btn--glass btn--sm', onclick: irATodoLoCargado }, 'Todo lo cargado'))
      ];
    } else {
      const sel = el('select', { id: 'csMes', 'aria-label': 'Mes' }, meses.map(([m, x]) => el('option', { value: m, selected: m === st.mes }, rotulo(m, x))));
      sel.addEventListener('change', () => { st.visibles = PASO; history.replaceState(null, '', '#mes=' + sel.value); cargarMes(sel.value); });
      selectores = [el('label', { for: 'csMes' }, 'Mes', sel)];
    }
    // Qué cubre el periodo: meses con datos, meses que el parque no cargó y los incompletos.
    let notaPeriodo = null;
    if (enPeriodo) {
      const cal = mesesEntre(st.periodo.desde, st.periodo.hasta);
      const noCargados = cal.filter((m) => !todos.includes(m));
      const incompletos = st.periodo.meses.filter((m) => ctx.catalogo.meses[m] && !ctx.catalogo.meses[m].completo);
      notaPeriodo = el('span', {}, el('b', {}, 'Periodo: '), nombreMes(st.periodo.desde) + ' a ' + nombreMes(st.periodo.hasta) + ' · ' + st.periodo.meses.length + (st.periodo.meses.length === 1 ? ' mes' : ' meses') + ' con datos'
        + (noCargados.length ? ' · ' + noCargados.map(nombreMes).join(', ') + ' no ' + (noCargados.length === 1 ? 'está cargado' : 'están cargados') : '')
        + (incompletos.length ? ' · ' + incompletos.map((m) => nombreMes(m) + ' incompleto (' + ctx.catalogo.meses[m].nDias + ' de ' + ctx.catalogo.meses[m].dias.length + ' días)').join(', ') : '')
        + (st.periodo.aviso ? ' · ' + st.periodo.aviso : ''));
    }
    return el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-filtros' },
        el('div', { class: 'cs-campo-multi' }, el('span', {}, 'Periodo'), seg),
        selectores,
        el('div', { class: 'cs-origen', style: 'grid-column: 1 / -1' },
          notaPeriodo,
          el('span', {}, el('b', {}, 'Fuente: '), 'SCADA, promedio de cada hora'),
          el('span', {}, el('b', {}, 'Cifra: '), enPeriodo
            ? 'carga del periodo = p99 de TODAS sus horas (fase más cargada ÷ ampacidad del devanado); al lado, su peor mes. Los meses no se promedian.'
            : 'p99 de la fase más cargada ÷ ampacidad del devanado'),
          el('span', {}, el('b', {}, 'Bandas CRG: '), textoBandas(ctx.umbrales) + ' (MO.00418)'))),
      ctx.avisos.length || ctx.truncado ? el('ul', { class: 'cs-avisos' },
        ctx.avisos.map((t) => el('li', {}, t)),
        ctx.truncado ? el('li', {}, 'El parque se leyó hasta 500 equipos: puede faltar alguno.') : null) : null);
  }

  function resumenKpis(filas) {
    const firmes = filas.filter((x) => x.clase === 'firme');
    const prov = filas.filter((x) => x.clase === 'provisional');
    const altos = firmes.filter((x) => x.crg >= 4).length;
    const sost = filas.filter((x) => x.sobrecargaSostenida).length;
    // Solo las FIRMES (la tarjeta cuenta firmes): en revisión, o sin poder leer su curva («por confirmar»).
    const revisando = filas.filter((x) => x.clase === 'firme' && x.sobrecargaPorVerificar && x.sobrecargaPorVerificar.length).length;
    const sinConfirmar = filas.filter((x) => x.clase === 'firme' && x.verificacion === 'fallo').length;
    const kpi = (t, v, n) => el('div', { class: 'cs-kpi' }, el('div', { class: 'cs-kpi-t' }, t), el('div', { class: 'cs-kpi-v' }, v), el('div', { class: 'cs-kpi-n' }, n));
    const per = st.modo === 'periodo';
    return el('div', { class: 'cs-panel cs-principal' },
      kpi(per ? 'Con cifra firme en el periodo' : 'Con cifra firme', String(firmes.length), 'de ' + filas.length + ' transformadores del parque'),
      kpi('Provisionales', String(prov.length), 'medida por confirmar o incompleta'),
      kpi('CRG 4 y 5 (firmes)', String(altos), 'por encima de ' + textoBandas(ctx.umbrales).split(' / ')[2] + ' %' + (per ? ' en el periodo' : '')),
      kpi('Sobrecarga sostenida', String(sost), 'firmes con ≥ ' + CALCULO.sobrecargaMinH + ' h seguidas sobre el ' + CALCULO.sobrecargaPct + ' %' + (per ? ' en algún mes' : '')
        + (revisando ? ' · ' + revisando + ' en revisión' : '') + (sinConfirmar ? ' · ' + sinConfirmar + ' por confirmar' : '')));
  }

  function barraFiltros(filas) {
    const f = st.filtro;
    const zonas = [...new Set(filas.map((x) => x.zona).filter(Boolean))].sort();
    const q = el('input', { type: 'search', id: 'csTexto', value: f.texto, placeholder: 'Matrícula, subestación, zona…', autocomplete: 'off' });
    let t = null;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f.texto = q.value; st.visibles = PASO; pintarTabla(); }, 200); });
    const sel = (id, valor, opciones, alCambiar) => {
      const s = el('select', { id }, opciones.map(([v, txt]) => el('option', { value: v, selected: String(v) === String(valor) }, txt)));
      s.addEventListener('change', () => { alCambiar(s.value); st.visibles = PASO; pintarTabla(); });
      return s;
    };
    // Desplegable de VARIAS opciones (zona, CRG): se ve como los demás filtros; nada marcado = «Todas».
    const multi = (id, valores, opciones, alCambiar) => {
      const elegidos = new Set((Array.isArray(valores) ? valores : (valores ? [valores] : [])).map(String));
      const resumen = () => (!elegidos.size ? 'Todas'
        : (elegidos.size <= 2 ? opciones.filter(([v]) => elegidos.has(String(v))).map(([, t]) => t).join(', ') : elegidos.size + ' elegidas'));
      const sum = el('summary', { id, class: 'cs-multi-sel' }, resumen());
      const aplicar = () => { sum.textContent = resumen(); alCambiar([...elegidos]); st.visibles = PASO; pintarTabla(); };
      const casillas = opciones.map(([v, txt]) => {
        const c = el('input', { type: 'checkbox', id: id + '-' + v, checked: elegidos.has(String(v)) });
        c.addEventListener('change', () => { if (c.checked) elegidos.add(String(v)); else elegidos.delete(String(v)); aplicar(); });
        return el('label', { class: 'cs-check', for: id + '-' + v }, c, ' ' + txt);
      });
      const todas = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => { elegidos.clear(); for (const l of casillas) l.querySelector('input').checked = false; aplicar(); } }, 'Todas');
      cerrarMultiAlClicFuera();
      const d = el('details', { class: 'cs-multi' }, sum, el('div', { class: 'cs-multi-lista', role: 'group', 'aria-labelledby': id }, casillas, todas));
      d.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && d.open) { d.open = false; sum.focus(); } });
      return d;
    };
    const chk = (id, valor, alCambiar) => {
      const c = el('input', { type: 'checkbox', id, checked: valor });
      c.addEventListener('change', () => { alCambiar(c.checked); st.visibles = PASO; pintarTabla(); });
      return c;
    };
    return el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-filtros', role: 'search' },
        el('label', { for: 'csTexto' }, 'Buscar', q),
        el('div', { class: 'cs-campo-multi' }, el('span', {}, 'Zona'), multi('csZona', f.zona, zonas.map((z) => [z, z]), (v) => { f.zona = v; })),
        el('label', { for: 'csEstado' }, 'Medida', sel('csEstado', f.estado, [['', 'Todas'], ...Object.entries(ESTADOS)], (v) => { f.estado = v; })),
        el('div', { class: 'cs-campo-multi' }, el('span', {}, 'Calificación CRG'), multi('csCrg', f.crg, [5, 4, 3, 2, 1].map((n) => [n, n + ' · ' + CRG_CHIP[n].palabra]), (v) => { f.crg = v; })),
        el('label', { class: 'cs-check', for: 'csFirmes' }, chk('csFirmes', f.soloFirmes, (v) => { f.soloFirmes = v; }), ' Solo cifras firmes'),
        el('label', { class: 'cs-check', for: 'csSost' }, chk('csSost', f.soloSostenida, (v) => { f.soloSostenida = v; }), ' Solo sobrecarga sostenida')),
      el('div', { class: 'cs-acciones' },
        contador = el('p', { class: 'cs-contador', role: 'status', 'aria-live': 'polite', style: 'margin:0' }),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: exportar }, 'Descargar lista (CSV)')));
  }

  function celdaCifra(x) {
    const td = el('td', {});
    if (x.pct == null) {
      td.append(el('span', { class: 'cs-num' }, '—'), chipCifra(x), el('span', { class: 'cs-sub' }, x.motivoNulo || ''));
      return td;
    }
    td.append(el('span', { class: 'cs-num' }, num(x.pct, 1) + ' %'), ' ', chipCifra(x));
    if (x.clase !== 'firme' && x.motivos.length) td.append(el('span', { class: 'cs-sub' }, x.motivos.join(' · ')));
    const enMeses = x.periodo ? ' en ' + x.periodo.mesesSostenida + (x.periodo.mesesSostenida === 1 ? ' mes' : ' meses') : '';
    if (x.sobrecargaSostenida) td.append(el('span', { class: 'cs-sub cs-sostenida' }, 'Sobrecarga sostenida (≥ ' + CALCULO.sobrecargaMinH + ' h sobre el ' + CALCULO.sobrecargaPct + ' %)' + enMeses));
    else if (x.sobrecargaProvisional) td.append(el('span', { class: 'cs-sub' }, 'Posible sobrecarga sostenida (cifra provisional)' + enMeses));
    else if (x.sobrecargaPorVerificar && x.sobrecargaPorVerificar.length) td.append(el('span', { class: 'cs-sub' }, 'Revisando la curva del mes (trae horas con valores imposibles)…'));
    else if (x.verificacion === 'fallo') td.append(el('span', { class: 'cs-sub' }, 'Sobrecarga por confirmar: el mes trae horas con valores imposibles y no se pudo leer su curva (véala en «Ver curvas»)'));
    else if (x.picoAislado) td.append(el('span', { class: 'cs-sub cs-pico' }, 'Pico aislado sobre el 100 % (no sostenido)'));
    return td;
  }

  function filaTabla(x) {
    const abrir = (ev) => { ev.preventDefault(); alAbrir(x.matricula, st.mes, x.id); };
    const of = x.oficial && x.oficial.pct != null ? num(x.oficial.pct, 1) + ' %' : '—';
    const ofDev = x.delta != null && x.oficial && x.oficial.porDevanado ? x.oficial.porDevanado[x.devMax] : null;
    return el('tr', { class: x.clase === 'provisional' ? 'cs-fila-prov' : (x.clase === 'nulo' ? 'cs-fila-nulo' : null) },
      el('th', { scope: 'row', style: 'position:static;background:none;font-size:13px' },
        el('a', { href: '#mat=' + encodeURIComponent(x.matricula), id: 'csMat-' + x.id, onclick: abrir }, x.matricula || '(sin matrícula)'),
        el('span', { class: 'cs-sub' }, [x.subestacion, x.zona].filter(Boolean).join(' · '))),
      celdaCifra(x),
      el('td', {}, x.pct != null && x.devMax ? ({ P: 'Primario', S: 'Secundario', T: 'Terciario' })[x.devMax] : '—'),
      el('td', {}, el('span', { class: 'cs-num' }, of), x.oficial && x.oficial.calif ? el('span', { class: 'cs-sub' }, 'CRG ' + x.oficial.calif + ' en Salud de Activos') : null,
        ofDev != null ? el('span', { class: 'cs-sub' }, ({ P: 'Primario', S: 'Secundario', T: 'Terciario' })[x.devMax] + ' ' + num(ofDev, 1) + ' %') : null),
      el('td', {}, x.delta == null ? '—' : el('span', { class: 'cs-num' }, (x.delta > 0 ? '+' : '') + num(x.delta, 1) + ' pts')),
      el('td', {}, ESTADOS[x.estado] || x.estado, x.avisos.length && x.estado === 'pendiente' ? el('span', { class: 'cs-sub' }, x.avisos.length + (x.avisos.length === 1 ? ' aviso' : ' avisos')) : null),
      el('td', {}, x.tienePunto ? el('button', { type: 'button', id: 'csCurvas-' + x.id, class: 'btn btn--glass btn--sm', onclick: abrir, 'aria-label': 'Ver curvas de ' + x.matricula }, 'Ver curvas') : el('span', { class: 'cs-sub' }, 'sin datos SCADA')));
  }

  // ── Fila con «Varios meses» ──────────────────────────────────────────────
  /** Rango de las curvas al abrir el equipo: el periodo recortado a los meses que el punto tiene (≤ 12). */
  function rangoAlAbrir(x) {
    const punto = x.claveId && ctx.catalogo && ctx.catalogo.puntos ? ctx.catalogo.puntos[x.claveId] : null;
    const suyos = st.periodo.meses.filter((m) => punto && (punto.meses || []).includes(m));
    if (!suyos.length) return null;
    const a = ventanaDeMes(suyos[0]); const b = ventanaDeMes(suyos[suyos.length - 1]);
    return { desde: aInputCO(a.desde + 3600e3), hasta: aInputCO(b.hasta) };
  }
  function celdaPeor(p) {
    const m = p.peorMes;
    if (!m) return el('td', {}, '—');
    return el('td', {}, el('span', { class: 'cs-num' }, num(m.pct, 1) + ' %'), ' · ' + nombreMes(m.mes),
      m.clase !== 'firme' ? el('span', { class: 'cs-sub' }, 'mes provisional') : (m.crg ? el('span', { class: 'cs-sub' }, 'CRG ' + m.crg + ' · ' + CRG_CHIP[m.crg].palabra) : null),
      p.mesesCRG45 ? el('span', { class: 'cs-sub' }, p.mesesCRG45 + ' de ' + p.mesesConCifra + ' meses en CRG 4–5') : null);
  }
  function celdaMayor(p) {
    const m = p.mayorCorriente;
    if (!m) return el('td', {}, '—');
    // Meses con horas imposibles (> 3 × ampacidad): su máximo limpio sale de la curva; aquí no se cuentan y se avisa.
    const pend = m.porConfirmar ? el('span', { class: 'cs-sub' }, (m.pct != null ? 'sin contar ' : '') + m.mesesPorConfirmar.map(corto).join(', ')
      + ': valores imposibles del SCADA, por confirmar en «Ver curvas»') : null;
    if (m.pct == null) return el('td', {}, DEV[m.devanado] + ' · por confirmar', pend);
    return el('td', {}, DEV[m.devanado] + ' ', el('span', { class: 'cs-num' }, num(m.max, 1) + ' A'), ' (' + num(m.pct, 0) + ' %)',
      el('span', { class: 'cs-sub' }, m.ms != null ? formatoCO(m.ms) : nombreMes(m.mes)),
      m.clase !== 'firme' ? el('span', { class: 'cs-sub' }, 'mes provisional') : null, pend);
  }
  function celdaDesde(p) {
    const s = p.primeraSostenida; const h = p.primeraHora;
    if (s) {
      return el('td', {}, s.inicioDatos ? 'Desde el inicio de los datos (' + nombreMes(s.mes) + ')'
        : (s.inicioPeriodo ? 'Desde el inicio del periodo (' + nombreMes(s.mes) + ')' : el('b', {}, nombreMes(s.mes))),
        s.clase !== 'firme' ? el('span', { class: 'cs-sub' }, 'mes provisional') : null,
        h && h.mes < s.mes ? el('span', { class: 'cs-sub' }, 'una hora suelta ya en ' + nombreMes(h.mes)) : null,
        el('span', { class: 'cs-sub' }, p.mesesSostenida + ' de ' + p.mesesConCifra + ' meses con sobrecarga sostenida · día y hora en «Ver curvas»'));
    }
    if (h) return el('td', {}, 'Solo horas sueltas sobre el 100 %', el('span', { class: 'cs-sub' }, 'la primera en ' + nombreMes(h.mes)));
    return el('td', {}, el('span', { class: 'cs-sub', style: 'display:inline' }, p.mesesConCifra ? 'No ha superado su capacidad' : '—'));
  }
  function celdaMeses(p) {
    const porMes = new Map(p.porMes.map((m) => [m.mes, m]));
    const todos = new Set(mesesCatalogo());
    const cajas = mesesEntre(st.periodo.desde, st.periodo.hasta).map((mes) => {
      const m = porMes.get(mes);
      if (!todos.has(mes)) return el('i', { class: 'cs-tira-mes cs-tira--vacio', title: nombreMes(mes) + ': no cargado' });
      if (!m || m.pct == null) return el('i', { class: 'cs-tira-mes cs-tira--vacio', title: nombreMes(mes) + ': ' + ((m && m.motivoNulo) || 'sin cifra') });
      const cls = m.clase === 'firme' ? (m.sost ? 'cs-tira--sost' : 'cs-tira--crg' + (m.crg || 0)) : (m.sost ? 'cs-tira--prov cs-tira--sostp' : 'cs-tira--prov');
      return el('i', { class: 'cs-tira-mes ' + cls, title: nombreMes(mes) + ': ' + num(m.pct, 1) + ' %' + (m.crg ? ' · CRG ' + m.crg : '') + (m.clase === 'firme' ? ' firme' : ' provisional') + (m.sost ? ' · sobrecarga sostenida' : (m.pico ? ' · pico aislado' : '')) });
    });
    return el('td', {}, el('div', { class: 'cs-tira', 'aria-label': 'Mes a mes' }, cajas),
      el('span', { class: 'cs-sub' }, corto(st.periodo.desde) + ' → ' + corto(st.periodo.hasta)));
  }
  function filaPeriodo(x) {
    const abrir = (ev) => { ev.preventDefault(); alAbrir(x.matricula, null, x.id, rangoAlAbrir(x)); };
    const p = x.periodo;
    return el('tr', { class: x.clase === 'provisional' ? 'cs-fila-prov' : (x.clase === 'nulo' ? 'cs-fila-nulo' : null) },
      el('th', { scope: 'row', style: 'position:static;background:none;font-size:13px' },
        el('a', { href: '#mat=' + encodeURIComponent(x.matricula), id: 'csMat-' + x.id, onclick: abrir }, x.matricula || '(sin matrícula)'),
        el('span', { class: 'cs-sub' }, [x.subestacion, x.zona].filter(Boolean).join(' · '))),
      celdaCifra(x), celdaPeor(p), celdaMayor(p), celdaDesde(p), celdaMeses(p),
      el('td', {}, ESTADOS[x.estado] || x.estado, x.avisos.length && x.estado === 'pendiente' ? el('span', { class: 'cs-sub' }, x.avisos.length + (x.avisos.length === 1 ? ' aviso' : ' avisos')) : null),
      el('td', {}, x.tienePunto ? el('button', { type: 'button', id: 'csCurvas-' + x.id, class: 'btn btn--glass btn--sm', onclick: abrir, 'aria-label': 'Ver curvas de ' + x.matricula }, 'Ver curvas') : el('span', { class: 'cs-sub' }, 'sin datos SCADA')));
  }

  function filasVisibles() {
    return ordenarFilas(filtrarFilas(st.filas || [], st.filtro), st.orden.campo, st.orden.dir);
  }

  function pintarTabla() { conservarFoco(pintarTablaSinFoco); }
  function pintarTablaSinFoco() {
    if (!tablaCaja) return;
    const todas = filasVisibles();
    const vis = todas.slice(0, st.visibles);
    contador.textContent = todas.length + ' de ' + st.filas.length + ' transformadores';
    if (!todas.length) {
      poner(tablaCaja, el('div', { class: 'cs-estado' }, 'Ningún transformador cumple los filtros.', el('br'),
        el('button', { type: 'button', id: 'csQuitar', class: 'btn btn--glass btn--sm', onclick: () => { st.filtro = { texto: '', zona: [], estado: '', crg: [], soloFirmes: false, soloSostenida: false }; dibujar(); const q = document.getElementById('csTexto'); if (q) q.focus(); } }, 'Quitar filtros')));
      return;
    }
    const th = (c) => {
      if (!c.campo) return el('th', { scope: 'col' }, c.texto);
      const activo = st.orden.campo === c.campo;
      const b = el('button', { type: 'button', id: 'csOrden-' + c.campo }, c.texto + (activo ? (st.orden.dir === 'desc' ? ' ↓' : ' ↑') : ''));
      b.addEventListener('click', () => {
        st.orden = activo ? { campo: c.campo, dir: st.orden.dir === 'desc' ? 'asc' : 'desc' } : { campo: c.campo, dir: c.campo === 'matricula' ? 'asc' : 'desc' };
        pintarTabla();
      });
      return el('th', { scope: 'col', 'aria-sort': activo ? (st.orden.dir === 'desc' ? 'descending' : 'ascending') : 'none' }, b);
    };
    const per = st.modo === 'periodo' && st.periodo;
    const cols = per ? COLUMNAS_PERIODO : COLUMNAS;
    const tabla = el('table', { class: 'cs-tabla' + (per ? ' cs-tabla--periodo' : '') },
      el('caption', {}, 'Cargabilidad SCADA ' + (per ? 'de ' + nombreMes(st.periodo.desde) + ' a ' + nombreMes(st.periodo.hasta) + ': carga del periodo y peor mes de cada transformador' : 'de ' + nombreMes(st.mes))
        + '. Ordenado por ' + ((cols.find((c) => c.campo === st.orden.campo) || COLUMNAS.find((c) => c.campo === st.orden.campo) || {}).texto || '') + '.'),
      el('thead', {}, el('tr', {}, cols.map(th))),
      el('tbody', {}, vis.map(per ? filaPeriodo : filaTabla)));
    poner(tablaCaja, tabla,
      todas.length > vis.length ? el('div', { class: 'cs-acciones', style: 'padding:0 12px 12px' },
        el('button', { type: 'button', id: 'csMas', class: 'btn btn--glass btn--sm', onclick: () => { st.visibles += PASO; pintarTabla(); } }, 'Mostrar ' + Math.min(PASO, todas.length - vis.length) + ' más')) : null);
  }

  function exportar() {
    if (st.modo === 'periodo' && st.periodo) { exportarPeriodo(); return; }
    const filas = filasVisibles();
    const dev = { P: 'Primario', S: 'Secundario', T: 'Terciario' };
    descargarCSV('cargabilidad_scada_' + st.mes + '.csv',
      ['Matricula', 'Subestacion', 'Zona', 'Mes', 'Cargabilidad_SCADA_pct', 'Clase', 'CRG', 'Devanado', 'Oficial_Excel_equipo_pct', 'Oficial_Excel_mismo_devanado_pct', 'Diferencia_mismo_devanado_pts', 'Medida', 'Motivos', 'Sobrecarga_sostenida'],
      filas.map((x) => [x.matricula, x.subestacion, x.zona, st.mes, x.pct, x.clase, x.crg, x.pct != null && x.devMax ? dev[x.devMax] : '', x.oficial ? x.oficial.pct : null,
        x.delta != null && x.oficial && x.oficial.porDevanado ? x.oficial.porDevanado[x.devMax] : null,
        x.delta, ESTADOS[x.estado] || x.estado, x.pct == null ? (x.motivoNulo || '') : x.motivos.join(' | '),
        x.sobrecargaSostenida ? 'si' : (x.clase === 'firme' && ((x.sobrecargaPorVerificar && x.sobrecargaPorVerificar.length) || x.verificacion === 'fallo') ? 'por confirmar' : 'no')]));
  }

  function exportarPeriodo() {
    const filas = filasVisibles(); const { desde, hasta } = st.periodo;
    descargarCSV('cargabilidad_scada_' + desde + '_a_' + hasta + '.csv',
      ['Matricula', 'Subestacion', 'Zona', 'Periodo_desde', 'Periodo_hasta', 'Meses_con_cifra', 'Carga_periodo_pct', 'Clase', 'CRG', 'Peor_mes', 'Peor_mes_pct', 'Peor_mes_clase',
        'Meses_CRG4_5', 'Mayor_corriente_devanado', 'Mayor_corriente_A', 'Mayor_corriente_pct', 'Mayor_corriente_hora_CO', 'Mayor_corriente_por_confirmar',
        'Primer_mes_sobrecarga_sostenida', 'Desde_inicio_de_los_datos', 'Primer_mes_hora_sobre_100', 'Meses_con_sobrecarga_sostenida', 'Medida', 'Motivos'],
      filas.map((x) => { const p = x.periodo; const pm = p.peorMes; const mc = p.mayorCorriente; const ps = p.primeraSostenida; return [
        x.matricula, x.subestacion, x.zona, desde, hasta, p.mesesConCifra, x.pct, x.clase, x.crg, pm ? pm.mes : '', pm ? pm.pct : null, pm ? pm.clase : '',
        p.mesesCRG45, mc ? DEV[mc.devanado] : '', mc ? mc.max : null, mc ? mc.pct : null, mc && mc.ms != null ? formatoCO(mc.ms) : '', mc && mc.porConfirmar ? 'si' : 'no',
        ps ? ps.mes : '', ps ? (ps.inicioDatos ? 'si' : (ps.inicioPeriodo ? 'inicio del periodo' : 'no')) : '', p.primeraHora ? p.primeraHora.mes : '', p.mesesSostenida, ESTADOS[x.estado] || x.estado,
        x.pct == null ? (x.motivoNulo || '') : x.motivos.join(' | ')]; }));
  }

  function dibujar() { conservarFoco(dibujarSinFoco); }
  function dibujarSinFoco() {
    tablaCaja = null;
    if (ctx.errorCatalogo) {
      poner(cont, el('div', { class: 'cs-panel cs-estado', role: 'alert' }, 'No se pudo leer qué meses hay cargados (revise la conexión).', el('br'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => location.reload() }, 'Reintentar')));
      return;
    }
    if (!ctx.catalogo || (!st.mes && !(st.modo === 'periodo' && st.periodo))) {
      // Qué falta, paso por paso: sin esto la página se ve «vacía» sin decir por qué.
      const paso = (listo, texto) => el('li', { class: listo ? 'cs-paso cs-paso--ok' : 'cs-paso' }, el('b', {}, listo ? 'Listo: ' : 'Falta: '), texto);
      poner(cont, cabeceraVacia(), el('div', { class: 'cs-panel cs-estado' },
        el('p', { class: 'cs-estado-titulo' }, 'Todavía no hay mediciones SCADA cargadas.'),
        el('p', {}, 'La lista del parque con la carga de cada transformador aparece aquí cuando estén en la base estos dos pasos:'),
        el('ol', { class: 'cs-pasos' },
          paso(!!ctx.homologacion, 'la homologación (el Excel que une cada transformador con su punto del SCADA);'),
          paso(false, 'al menos un mes de la carpeta «Variables Eléctricas».')),
        ctx.esAdmin
          // Sin homologación, el primer paso es cargarla (la pestaña «Cargar mes» todavía no se puede usar).
          ? el('div', {}, ctx.homologacion
            ? el('a', { class: 'btn btn--primary btn--sm', href: '../admin/scada-datos.html#tab=cargar' }, 'Cargar un mes')
            : el('a', { class: 'btn btn--primary btn--sm', href: '../admin/scada-datos.html' }, 'Cargar la homologación'))
          : el('div', { class: 'cs-ayuda' }, 'Un administrador los carga en «Datos SCADA».')));
      return;
    }
    const per = st.modo === 'periodo' && st.periodo;
    if (st.cargando) { poner(cont, cabeceraOrigen(), el('div', { class: 'cs-panel' }, el('div', { class: 'cs-esqueleto', style: 'width:60%' }), el('div', { class: 'cs-esqueleto', style: 'width:85%;margin-top:10px' }), el('p', { class: 'cs-ayuda', role: 'status' }, 'Calculando ' + (per ? 'el periodo (' + st.periodo.meses.length + ' meses)' : nombreMes(st.mes)) + '…'))); return; }
    if (st.error) {
      poner(cont, cabeceraOrigen(), el('div', { class: 'cs-panel cs-estado', role: 'alert' }, st.error, el('br'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => (per ? cargarPeriodo(st.periodo.desde, st.periodo.hasta) : cargarMes(st.mes)) }, 'Reintentar')));
      return;
    }
    if (!st.filas) return;
    tablaCaja = el('div', { class: 'cs-tabla-caja' });
    kpiCaja = resumenKpis(st.filas);
    poner(cont, cabeceraOrigen(), kpiCaja, barraFiltros(st.filas), tablaCaja);
    pintarTabla();
  }
  function cabeceraVacia() {
    return ctx.avisos.length ? el('div', { class: 'cs-panel' }, el('ul', { class: 'cs-avisos' }, ctx.avisos.map((t) => el('li', {}, t)))) : null;
  }

  return { mostrar };
}
