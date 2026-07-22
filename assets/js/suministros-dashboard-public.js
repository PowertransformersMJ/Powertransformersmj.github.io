// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Public · Dashboard Suministros UNIFICADO
// (consolida F47 stock + F48 ejecutivo en una sola página).
//
// Secciones:
//   1. KPIs operativos (8) + económicos (4)
//   2. Tabla stock por ítem (semáforo 6 estados, F47)
//   3. 4 gráficas Chart.js (ranking, zona, depto)
//   4. Vista cruzada filtrable por zona/depto
// ══════════════════════════════════════════════════════════════

import { suscribirStockGlobal, isReady } from '../js/data/movimientos.js';
import { suscribir as suscribirAccionesRefrig } from '../js/data/acciones_refrigeracion.js';
import { estadoStock, ESTADOS_STOCK } from '../js/domain/schema.js';
import { computarKpisBrigada } from '../js/domain/dashboard_brigada_kpis.js';
import { withContratoFiltro, getContratoActivo } from '../js/ui/contrato-context.js';

const $ = (id) => document.getElementById(id);
const info = $('infoBox');

// KPIs operativos (stock)
const kStockIni     = $('kStockIni');
const kDisponible   = $('kDisponible');
const kConsumido    = $('kConsumido');
const kCriticos     = $('kCriticos');
// KPIs operativos (movimientos)
const kRegistros    = $('kRegistros');
const kUnidades     = $('kUnidades');
const kDescripciones = $('kDescripciones');
const kTxAtendidos  = $('kTxAtendidos');
// KPIs económicos
const kValContrato   = $('kValContrato');
const kValConsumido  = $('kValConsumido');
const kValDisponible = $('kValDisponible');
const kEjecucionPct  = $('kEjecucionPct');

// Tabla stock
const tbody    = $('tbody');
const counter  = $('counter');
const fBusqueda = $('fBusqueda');
const fEstado   = $('fEstado');
// Cruzado
const fxZona    = $('fxZona');
const fxDepto   = $('fxDepto');
const cruzadoCount = $('cruzadoCount');

// Estado
let cacheStockGlobal = [];   // [{...sumDoc, stock: {inicial, ingresado, egresado, actual}}]
let cacheMovs = [];          // G016: llega en el mismo emit de suscribirStockGlobal (sin re-suscribir)
let cacheAccionesBrig = [];  // Microfase 6 · acciones de refrigeración del contrato
let configCache = null;
let unsubStock = null;
let unsubAccionesBrig = null;
let charts = {};

// Helpers
function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function fmtInt(v) {
  if (v == null || isNaN(+v)) return '—';
  return Number(v).toLocaleString('es-CO');
}
function fmtCOP(v) {
  if (v == null || isNaN(+v) || +v === 0) return '$0';
  return '$' + Math.round(+v).toLocaleString('es-CO');
}
function fmtPct(v) {
  if (v == null || isNaN(+v)) return '—';
  return (v * 100).toFixed(1) + ' %';
}
function estadoMeta(key) {
  return ESTADOS_STOCK.find((e) => e.value === key) || { value: key, label: key, prefix: '·' };
}
function nombreSum(codigo) {
  // G016: el nombre ya viene en cacheStockGlobal (mismo doc de suministro con
  // codigo+nombre); antes esto forzaba una 2ª suscripción a 'suministros'.
  const s = cacheStockGlobal.find((x) => x.codigo === codigo);
  return (s && s.nombre) ? `· ${s.nombre.slice(0, 32)}` : '';
}

// Paleta del skill (Tailwind)
const COLOR_BARS = [
  '#0F766E','#0D9488','#16A34A','#22C55E','#EAB308',
  '#F59E0B','#EA580C','#DC2626','#7C3AED','#2563EB'
];
const COLOR_BY_ZONA = { 'BOLIVAR':'#2563EB','ORIENTE':'#EA580C','OCCIDENTE':'#16A34A' };

// Cálculo por suministro (para semáforo y tabla)
function calcularPorItem(rowGlobal) {
  const stock = rowGlobal.stock || {
    inicial: rowGlobal.stock_inicial || 0,
    ingresado: 0, egresado: 0, actual: rowGlobal.stock_inicial || 0
  };
  const opts = configCache || {};
  const est = estadoStock(stock.actual, stock.inicial, {
    umbral_critico_pct: opts.umbral_critico_pct,
    umbral_medio_pct:   opts.umbral_medio_pct
  });
  const pctRest = (stock.inicial > 0) ? (stock.actual / stock.inicial) : null;
  return { stock, est, pctRest };
}

// ── KPIs ──
function actualizarKPIs() {
  // Stock-side
  let stockIni = 0, dispon = 0, consum = 0, criticos = 0;
  let valorContrato = 0, valorConsumido = 0;
  for (const r of cacheStockGlobal) {
    const { stock, est } = r._calc;
    stockIni += stock.inicial;
    dispon   += Math.max(0, stock.actual);
    consum   += stock.egresado;
    if (est === 'CRITICO' || est === 'AGOTADO' || est === 'NEGATIVO') criticos += 1;
    const valU = +r.valor_unitario || 0;
    valorContrato  += stock.inicial * valU;
    valorConsumido += stock.egresado * valU;
  }
  const valorDisponible = Math.max(0, valorContrato - valorConsumido);
  const ejec = valorContrato > 0 ? valorConsumido / valorContrato : 0;
  kStockIni.textContent      = fmtInt(stockIni);
  kDisponible.textContent    = fmtInt(dispon);
  kConsumido.textContent     = fmtInt(consum);
  kCriticos.textContent      = String(criticos);
  kValContrato.textContent   = fmtCOP(valorContrato);
  kValConsumido.textContent  = fmtCOP(valorConsumido);
  kValDisponible.textContent = fmtCOP(valorDisponible);
  kEjecucionPct.textContent  = fmtPct(ejec);

  // Movimiento-side
  const registros = cacheMovs.length;
  const unidades = cacheMovs.reduce((s, m) => s + (+m.cantidad || 0), 0);
  const descs = new Set(cacheMovs.map((m) => m.suministro_id).filter(Boolean));
  const trafos = new Set(cacheMovs.map((m) => m.transformador_id).filter(Boolean));
  kRegistros.textContent     = fmtInt(registros);
  kUnidades.textContent      = fmtInt(unidades);
  kDescripciones.textContent = fmtInt(descs.size);
  kTxAtendidos.textContent   = fmtInt(trafos.size);
}

// ── Tabla stock ──
function aplicarFiltrosTabla() {
  const q = fBusqueda.value.trim().toLowerCase();
  const e = fEstado.value;
  return cacheStockGlobal.filter((r) => {
    if (q) {
      const blob = `${r.codigo} ${r.nombre || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (e && r._calc.est !== e) return false;
    return true;
  });
}
function renderTabla() {
  const rows = aplicarFiltrosTabla();
  counter.textContent = `${rows.length} de ${cacheStockGlobal.length} ítems`;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="td-empty">${
      cacheStockGlobal.length === 0 ? 'Sin suministros sembrados.' : 'Sin coincidencias.'
    }</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r) => {
    const { stock, est, pctRest } = r._calc;
    const meta = estadoMeta(est);
    const valU = +r.valor_unitario || 0;
    const valDisp = Math.max(0, stock.actual) * valU;
    const marcas = (r.marcas_disponibles && r.marcas_disponibles.length)
      ? r.marcas_disponibles.map((m) => `<span class="marca-chip">${escHtml(m)}</span>`).join(' ')
      : '—';
    return `
    <tr>
      <td><code>${escHtml(r.codigo)}</code></td>
      <td>${escHtml(r.nombre)}</td>
      <td>${marcas}</td>
      <td><span class="unidad-pill">${escHtml(r.unidad || 'Und')}</span></td>
      <td style="text-align:right; font-family: var(--font-mono);">${fmtInt(stock.inicial)}</td>
      <td style="text-align:right; font-family: var(--font-mono); color:#16A34A;">+${fmtInt(stock.ingresado)}</td>
      <td style="text-align:right; font-family: var(--font-mono); color:#EA580C;">−${fmtInt(stock.egresado)}</td>
      <td style="text-align:right; font-family: var(--font-mono); font-weight:700;">${fmtInt(stock.actual)}</td>
      <td style="text-align:right; font-family: var(--font-mono);">${pctRest != null ? fmtPct(pctRest) : '—'}</td>
      <td><span class="estado-stock-pill ${meta.value}">${meta.prefix} ${escHtml(meta.label)}</span></td>
      <td style="text-align:right; font-family: var(--font-mono);">${fmtCOP(valDisp)}</td>
    </tr>`;
  }).join('');
  window.sgmRefreshIcons?.();
}

// ── Charts ──
function destroyChart(id) {
  if (charts[id]) try { charts[id].destroy(); } catch (_) {}
  delete charts[id];
}
function chartHorizontalBar(canvasId, dataPairs, label, formatter = fmtInt, colorFn = (i) => COLOR_BARS[i % COLOR_BARS.length]) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  destroyChart(canvasId);
  const labels = dataPairs.map(([k]) => k);
  const data   = dataPairs.map(([, v]) => v);
  const colors = dataPairs.map((_, i) => colorFn(i));
  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${label}: ${formatter(c.parsed.x)}` } }
      },
      scales: {
        x: { ticks: { callback: (v) => formatter(v) }, grid: { color: 'rgba(0,40,90,.06)' } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}
function chartDoughnut(canvasId, dataPairs, label, colorMap = null) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  destroyChart(canvasId);
  const labels = dataPairs.map(([k]) => k);
  const data   = dataPairs.map(([, v]) => v);
  const colors = colorMap
    ? labels.map((l) => colorMap[l] || '#94A3B8')
    : labels.map((_, i) => COLOR_BARS[i % COLOR_BARS.length]);
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtInt(c.parsed)}` } }
      },
      cutout: '55%'
    }
  });
}
function rankingPor(field, valueFn, topN = 10) {
  const acc = new Map();
  for (const m of cacheMovs) {
    if (m.tipo !== 'EGRESO') continue;
    const k = m[field] || '—';
    acc.set(k, (acc.get(k) || 0) + valueFn(m));
  }
  return [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
}
function renderCharts() {
  const rankUni = rankingPor('suministro_id', (m) => +m.cantidad || 0, 10)
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  chartHorizontalBar('chRankUnidades', rankUni, 'Unidades');

  const rankVal = rankingPor('suministro_id', (m) => +m.valor_total || 0, 10)
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  chartHorizontalBar('chRankValor', rankVal, 'COP', fmtCOP, () => '#EA580C');

  const porZona = new Map();
  const porDepto = new Map();
  for (const m of cacheMovs) {
    if (m.tipo !== 'EGRESO') continue;
    const z = m.zona || 'sin zona';
    porZona.set(z, (porZona.get(z) || 0) + 1);
    const d = (m.departamento || 'sin depto').toUpperCase();
    porDepto.set(d, (porDepto.get(d) || 0) + 1);
  }
  chartDoughnut('chZona', [...porZona.entries()], 'registros', COLOR_BY_ZONA);
  chartHorizontalBar('chDepto', [...porDepto.entries()], 'Egresos');
}

function renderCruzado() {
  const z = fxZona.value;
  const d = fxDepto.value;
  const filt = cacheMovs.filter((m) => {
    if (m.tipo !== 'EGRESO') return false;
    if (z && m.zona !== z) return false;
    if (d && m.departamento !== d) return false;
    return true;
  });
  cruzadoCount.textContent = `Mostrando ${filt.length} de ${cacheMovs.length} movimientos`;
  const acc = new Map();
  for (const m of filt) {
    const k = m.suministro_id || '—';
    acc.set(k, (acc.get(k) || 0) + (+m.cantidad || 0));
  }
  const rank = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  if (rank.length === 0) {
    destroyChart('chCruzado');
    const ctx = document.getElementById('chCruzado');
    if (ctx) ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
    return;
  }
  chartHorizontalBar('chCruzado', rank, 'Unidades', fmtInt, () => '#7C3AED');
}

// ── Suscripciones ──
function recomputarTodo() {
  // Pre-calcular estado por ítem para evitar repetir en cada render.
  cacheStockGlobal = cacheStockGlobal.map((r) => ({ ...r, _calc: calcularPorItem(r) }));
  actualizarKPIs();
  renderTabla();
  renderCharts();
  renderCruzado();
  renderWidgetBrigada();
}

/* ─── Microfase 6 · Widget "Consumo por Mantenimiento Brigada" ─── */

function renderWidgetBrigada() {
  const kpi = computarKpisBrigada({
    acciones:    cacheAccionesBrig,
    movimientos: cacheMovs,
    topN:        5
  });
  const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setText('kBrigAccionesEj', fmtInt(kpi.totales.accionesEjecutadas));
  setText('kBrigAccionesPl', fmtInt(kpi.totales.accionesPlanificadas));
  setText('kBrigMovs',       fmtInt(kpi.totales.movimientosGenerados));
  setText('kBrigUnidades',   fmtInt(kpi.totales.unidadesConsumidas));

  const tTop = $('tBrigTopModelos');
  if (tTop) {
    if (!kpi.topModelos.length) {
      tTop.innerHTML = '<tr><td colspan="4" style="padding:8px; color:var(--ink-3); font-style:italic">Sin consumo de brigada registrado aún</td></tr>';
    } else {
      tTop.innerHTML = kpi.topModelos.map((m) =>
        '<tr style="border-bottom:1px solid rgba(0,40,90,.05)">' +
          '<td style="padding:6px 8px; font-family:var(--font-mono); font-size:12px">' + escHtml(m.suministro_id) + '</td>' +
          '<td style="padding:6px 8px">' + escHtml(m.nombre) + '</td>' +
          '<td style="padding:6px 8px; text-align:right; font-weight:600">' + fmtInt(m.unidades) + '</td>' +
          '<td style="padding:6px 8px; text-align:right; color:var(--ink-2)">' + fmtCOP(m.costo) + '</td>' +
        '</tr>'
      ).join('');
    }
  }

  const tAcc = $('tBrigAcciones');
  if (tAcc) {
    if (!kpi.accionesRecientes.length) {
      tAcc.innerHTML = '<tr><td colspan="5" style="padding:8px; color:var(--ink-3); font-style:italic">Sin acciones ejecutadas con egresos automáticos</td></tr>';
    } else {
      tAcc.innerHTML = kpi.accionesRecientes.map((a) =>
        '<tr style="border-bottom:1px solid rgba(0,40,90,.05)">' +
          '<td style="padding:6px 8px; font-family:var(--font-mono); font-size:12px">' + escHtml(a.fecha) + '</td>' +
          '<td style="padding:6px 8px; font-weight:600">' + escHtml(a.matricula || '—') + '</td>' +
          '<td style="padding:6px 8px">' + escHtml(a.subestacion || '—') + '</td>' +
          '<td style="padding:6px 8px; font-family:var(--font-mono); font-size:12px">' + escHtml(a.mixResumen) + '</td>' +
          '<td style="padding:6px 8px; text-align:right; font-weight:700">' + fmtInt(a.totalU) + '</td>' +
        '</tr>'
      ).join('');
    }
  }
}

function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    return;
  }
  if (unsubStock)         try { unsubStock(); }         catch (_) {}
  if (unsubAccionesBrig)  try { unsubAccionesBrig(); }  catch (_) {}

  const filtros = withContratoFiltro();
  // G016: una sola suscripción. suscribirStockGlobal ya lee 'suministros' y
  // 'movimientos' internamente y ahora expone ambos en el emit → tomamos
  // cacheMovs de aquí en vez de re-suscribir esas colecciones (antes se leían
  // 2× cada una por visita). nombreSum saca el nombre de cacheStockGlobal.
  unsubStock = suscribirStockGlobal(filtros, ({ suministros, movimientos, config }) => {
    cacheStockGlobal = suministros;
    cacheMovs = movimientos || [];
    configCache = config || null;
    recomputarTodo();
  }, (err) => {
    console.error(err);
    showInfo('Error realtime stock: ' + (err.message || err), 'err');
  });

  // Microfase 6 · acciones de refrigeración del contrato para los
  // KPIs del widget "Consumo por Brigada".
  // Filtra por contrato_stock_id en cliente porque el data layer
  // de acciones no soporta el filtro server-side todavía.
  unsubAccionesBrig = suscribirAccionesRefrig({}, (rows) => {
    const cidActivo = getContratoActivo();
    cacheAccionesBrig = cidActivo
      ? rows.filter(a => a.contrato_stock_id === cidActivo)
      : rows;
    renderWidgetBrigada();
  }, (err) => console.warn('[brig-acciones]', err));
}

window.addEventListener('beforeunload', () => {
  if (unsubStock)        try { unsubStock(); }        catch (_) {}
  if (unsubAccionesBrig) try { unsubAccionesBrig(); } catch (_) {}
  for (const k of Object.keys(charts)) destroyChart(k);
});

// ── Eventos UI ──
fBusqueda.addEventListener('input', renderTabla);
fEstado.addEventListener('change', renderTabla);
fxZona.addEventListener('change', renderCruzado);
fxDepto.addEventListener('change', renderCruzado);

arrancar();
