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
// Valor del contrato desde el pedido registrado (2026-10-07: «el valor disponible no coincide»).
import { obtener as obtenerContrato } from '../js/data/contratos.js';
import { valoresContrato } from '../js/domain/stock_calculo.js';
// Nexo con Órdenes E/S (2026-10-07): lo entregado a cada transformador por las órdenes firmadas
// descuenta del contrato. Se CALCULA al abrir (no se escriben copias): editar o eliminar una orden
// se refleja solo. Decisiones del Ingeniero → domain/ordenes_contrato_nexo.js.
import { calcularNexo, existenciaConOrdenes, NEXO_CONTRATOS, SIN_TRANSFORMADOR, claveTransformador } from '../js/domain/ordenes_contrato_nexo.js';
import { listar as listarOrdenes } from '../js/data/ordenes_materiales.js';
// Indicadores completos (2026-10-07, `99 §147`): zona y departamento salen del parque para lo que
// todavía no está registrado como movimiento (se lee solo si hay entregas por registrar).
import { listarV2 as listarParque } from '../js/data/transformadores.js';
import { resolverTransformador } from '../js/domain/ordenes_movimientos_registro.js';
// Registro AUTOMÁTICO (2026-10-07, `99 §148`): al abrir el contrato, lo que falta por registrar de las
// órdenes se registra solo en Movimientos (y lo que cambió se corrige). Se carga perezoso.
import { getSession } from '../js/auth/session-guard.js';

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
const kValContratoNota = $('kValContratoNota');   // ausente con el HTML viejo en caché (`30 L-85`)
const kValConsumidoNota = $('kValConsumidoNota'); // ídem (nexo con Órdenes E/S)
const kRegistrosNota = $('kRegistrosNota');       // ídem (entregas por registrar)

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
let contratoDoc = null;      // /contratos/{id}: su monto_total es el «Valor contrato» cuando está registrado
// Nexo con Órdenes E/S: null = apagado o todavía sin leer; { ordenes, truncado } al llegar; { error } si falla.
let ordenesNexo = null;
let nexo = null;
let stockLlego = false;
let parqueNexo = null;       // null = sin leer; [] o lista al llegar (solo si hay entregas por registrar)
let leyendoParque = false;
let parqueFallo = false;
// Registro automático: una vez por visita. null = sin novedad · { texto, tipo } = lo que se muestra.
let sincIntentada = false;
let sincAviso = null;
// Relectura de las órdenes (2026-10-09): se leen al abrir y NO hay escucha en vivo sobre ellas (free-tier),
// pero los movimientos sí llegan en vivo. Si cambia un movimiento ENLAZADO (la orden se editó o eliminó en
// Órdenes E/S y el registro automático lo retiró o lo creó), o la pestaña vuelve a verse tras más de un
// minuto, se vuelven a leer; si no, la orden vieja en memoria inflaba las cifras hasta recargar.
// Reglas en domain/contrato_relectura.js, cargado perezoso (L-102): si falta, el tablero sigue como antes.
let REL = null;               // el módulo, cuando cargue
let relector = null;          // agrupa los pedidos de relectura y nunca lee dos veces a la vez
let lecturaInicial = null;    // promesa de la primera lectura de órdenes de la visita
let leyendoOrdenes = false;
let relecturaEnEspera = false;
let ordenesLeidasMs = null;   // hora de la última lectura buena (sello «Órdenes leídas a las hh:mm»)
let ultimoIntentoMs = null;   // hora del último intento, bueno o no (para «al volver a la pestaña»)
let errorRelectura = '';      // la última RElectura falló: se siguen mostrando las órdenes anteriores
let huellaEnlazados = null;     // huella de los movimientos enlazados del último emit
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
  for (const r of cacheStockGlobal) {
    const { stock, est } = r._calc;
    stockIni += stock.inicial;
    dispon   += Math.max(0, stock.actual);
    consum   += stock.egresado;
    if (est === 'CRITICO' || est === 'AGOTADO' || est === 'NEGATIVO') criticos += 1;
  }
  // Pesos: el valor del contrato es su monto registrado (pedido); sin él, cantidades × precio.
  const v = valoresContrato(cacheStockGlobal.map((r) => ({ valor_unitario: r.valor_unitario, stock: r._calc.stock })),
                            contratoDoc && contratoDoc.monto_total);
  const { valorContrato, valorConsumido, valorDisponible } = v;
  const ejec = v.ejecucion;
  if (kValConsumidoNota) {
    const vMov = cacheStockGlobal.reduce((s, r) => s + (+(r._calc.stock.egresadoMovimientos ?? r._calc.stock.egresado) || 0) * (+r.valor_unitario || 0), 0);
    kValConsumidoNota.textContent = nexo && nexo.activo
      ? `Movimientos ${fmtCOP(vMov)}` + (nexo.totalRegistrado ? ` (de órdenes E/S ${fmtCOP(nexo.totalRegistrado)})` : '') +
        ` · Órdenes por registrar ${fmtCOP(nexo.totalPendiente)}` + (ordenesNexo && ordenesNexo.truncado ? ' · parcial' : '')
      : '';
  }
  if (kValContratoNota) {
    kValContratoNota.textContent = v.fuente === 'contrato'
      ? `Valor registrado del contrato · cantidades × precio: ${fmtCOP(v.valorCantidades)}` +
        (Math.round(v.diferencia) ? ` (${v.diferencia > 0 ? 'sin asignar a unidades' : 'por encima del contrato'}: ${fmtCOP(Math.abs(v.diferencia))})` : '')
      : 'Cantidades × precio (el contrato no tiene valor registrado)';
  }
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
  let trafos;
  if (nexo && nexo.activo) {
    // Con nexo: movimientos y órdenes por la MISMA clave (matrícula|subestación): un trafo atendido
    // por los dos caminos cuenta una vez (transformador_id puede ser el id del documento, no la matrícula).
    trafos = new Set(cacheMovs.map(claveTrafoMov).filter(Boolean));
    nexo.transformadores.forEach((t) => { if (t.matricula !== SIN_TRANSFORMADOR) trafos.add(t.clave); });
  } else {
    trafos = new Set(cacheMovs.map((m) => m.transformador_id).filter(Boolean));
  }
  kRegistros.textContent     = fmtInt(registros);
  if (kRegistrosNota) {
    const pend = nexo && nexo.activo ? (nexo.lineasDetalle || []).filter((l) => l.pendiente > 0).length : 0;
    kRegistrosNota.textContent = pend ? `+${pend} entrega(s) de órdenes por registrar` : '';
  }
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
      <td style="text-align:right; font-family: var(--font-mono); color:#EA580C;">−${fmtInt(stock.egresado)}${stock.entregadoOrdenes
        ? `<div style="font-size:10.5px;color:var(--ink-3);white-space:nowrap">mov. ${fmtInt(stock.egresadoMovimientos)} · órdenes ${fmtInt(stock.entregadoOrdenes)}</div>` : ''}</td>
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
function chartDoughnut(canvasId, dataPairs, label, colorMap = null, formatter = fmtInt) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  destroyChart(canvasId);
  const labels = dataPairs.map(([k]) => k);
  const data   = dataPairs.map(([, v]) => v);
  const colors = colorMap
    ? labels.map((l) => colorMap[l] || colorMap[String(l).split(' · ')[0]] || '#94A3B8')
    : labels.map((_, i) => COLOR_BARS[i % COLOR_BARS.length]);
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${formatter(c.parsed)}` } }
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
/** Ranking por ítem: egresos de movimientos + lo entregado por órdenes E/S (nexo). */
function rankingItems(campo, topN = 10) {
  const acc = new Map(rankingPor('suministro_id', campo === 'cantidad' ? (m) => +m.cantidad || 0 : (m) => +m.valor_total || 0, 1000));
  if (nexo && nexo.activo) {
    // Solo lo PENDIENTE de las órdenes: lo registrado ya viene en los egresos (no se cuenta dos veces).
    for (const i of Object.values(nexo.porItemPendiente || nexo.porItem || {})) acc.set(i.codigo, (acc.get(i.codigo) || 0) + (campo === 'cantidad' ? i.cantidad : i.valor));
  }
  return [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
}
function renderCharts() {
  const rankUni = rankingItems('cantidad')
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  chartHorizontalBar('chRankUnidades', rankUni, 'Unidades');

  const rankVal = rankingItems('valor')
    .map(([k, v]) => [`${k} ${nombreSum(k)}`, v]);
  chartHorizontalBar('chRankValor', rankVal, 'COP', fmtCOP, () => '#EA580C');

  // Pesos entregados + transformadores atendidos (decisión 2026-10-07): un registro de 8 motoventiladores
  // no pesa lo mismo que un relé, y sumar unidades mezclaría kg, m y Und.
  const acc = (clave) => {
    const m = new Map();
    for (const e of egresosCombinados()) {
      const k = clave(e);
      const x = m.get(k) || { valor: 0, trafos: new Set() };
      x.valor += e.valor; if (e.claveTrafo) x.trafos.add(e.claveTrafo);
      m.set(k, x);
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor)
      .map(([k, x]) => [`${k} · ${x.trafos.size} ${x.trafos.size === 1 ? 'trafo' : 'trafos'}`, x.valor]);
  };
  chartDoughnut('chZona', acc((e) => e.zona || 'sin zona'), 'COP', COLOR_BY_ZONA, fmtCOP);
  chartHorizontalBar('chDepto', acc((e) => nombreDepto(e.departamento)), 'COP', fmtCOP, () => '#2563EB');
  const fuente = nexo && nexo.activo ? 'movimientos + órdenes por registrar' : 'movimientos registrados';
  document.querySelectorAll('.rotulo-dist').forEach((x) => {
    x.textContent = x.closest('.section-head') ? `(unidades por accesorio · ${fuente})` : `(pesos entregados · ${fuente})`;
  });
}

const DEPTOS = { bolivar: 'Bolívar', cordoba: 'Córdoba', sucre: 'Sucre', cesar: 'Cesar', magdalena: 'Magdalena' };
function nombreDepto(d) { const k = normTxt(d); return DEPTOS[k] || (k ? k.toUpperCase() : 'sin depto'); }

/**
 * Todo lo entregado a transformadores: los EGRESOS (manuales, de Brigada o de órdenes registradas)
 * y las entregas de órdenes que aún faltan por registrar (con zona y departamento del parque).
 * Lo registrado nunca se suma dos veces: de las órdenes solo entra lo PENDIENTE.
 */
function egresosCombinados() {
  const vu = new Map(cacheStockGlobal.map((s) => [s.codigo, +s.valor_unitario || 0]));
  const out = cacheMovs.filter((m) => m.tipo === 'EGRESO').map((m) => ({
    suministro_id: m.suministro_id, cantidad: +m.cantidad || 0, valor: +m.valor_total || ((+m.cantidad || 0) * (vu.get(m.suministro_id) || 0)),
    zona: String(m.zona || '').toUpperCase(), departamento: m.departamento || '',
    claveTrafo: claveTrafoMov(m)
  }));
  if (nexo && nexo.activo) {
    for (const l of (nexo.lineasDetalle || [])) {
      if (!(l.pendiente > 0)) continue;
      const tr = parqueNexo ? resolverTransformador(parqueNexo, l.matricula, l.subestacion) : { ok: false };
      out.push({ suministro_id: l.codigo, cantidad: l.pendiente, valor: l.pendiente * l.valorUnitario,
        zona: tr.ok ? tr.trafo.zona : (l.zona || ''), departamento: tr.ok ? tr.trafo.departamento : '',
        claveTrafo: l.claveTrafo && l.claveTrafo !== '|' && !l.claveTrafo.startsWith('|#') ? l.claveTrafo : '' });
    }
  }
  return out;
}

function renderCruzado() {
  const z = fxZona.value;
  const d = fxDepto.value;
  const todos = egresosCombinados();
  const filt = todos.filter((m) => {
    if (z && m.zona !== z) return false;
    if (d && normTxt(m.departamento) !== d) return false;
    return true;
  });
  cruzadoCount.textContent = `Mostrando ${filt.length} de ${todos.length} entregas` +
    (nexo && nexo.activo && nexo.totalPendiente ? ' (movimientos + órdenes por registrar)' : '');
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
/** Lectura de órdenes recortada (más de 500): la fecha más antigua leída; lo anterior no se pudo comprobar. */
function corteOrdenes() {
  if (!ordenesNexo || !ordenesNexo.truncado || !ordenesNexo.ordenes || !ordenesNexo.ordenes.length) return '';
  return ordenesNexo.ordenes.map((o) => String(o.fechaISO || '').slice(0, 10)).filter(Boolean).sort()[0] || '';
}
function recomputarTodo() {
  // Nexo: lo entregado por órdenes E/S se descuenta de la existencia de cada ítem. `_stockMov` guarda la
  // existencia SOLO por movimientos, para no descontar dos veces si se recalcula sin un emit nuevo.
  nexo = (ordenesNexo && ordenesNexo.ordenes)
    ? calcularNexo({ ordenes: ordenesNexo.ordenes, catalogo: cacheStockGlobal, contratoId: getContratoActivo(), movimientos: cacheMovs, corte: corteOrdenes() })
    : null;
  cacheStockGlobal = cacheStockGlobal.map((r) => {
    const base = r._stockMov || r.stock || { inicial: r.stock_inicial || 0, ingresado: 0, egresado: 0, actual: r.stock_inicial || 0 };
    const pend = nexo ? (nexo.porItemPendiente || nexo.porItem || {}) : {};    // módulo viejo en caché: todo es pendiente
    const ent = pend[r.codigo] ? pend[r.codigo].cantidad : 0;
    const fila = { ...r, _stockMov: base, stock: existenciaConOrdenes(base, ent) };
    return { ...fila, _calc: calcularPorItem(fila) };
  });
  if (nexo && nexo.activo && (nexo.totalPendiente == null || nexo.totalPendiente > 0 || hayQueRegistrar(nexo)) && parqueNexo === null && !leyendoParque) {
    leyendoParque = true;
    listarParque({}).then((rows) => { parqueNexo = rows || []; }, (err) => { console.warn('[nexo] parque:', err); parqueNexo = []; parqueFallo = true; })
      .then(() => { leyendoParque = false; if (stockLlego) recomputarTodo(); });
  }
  autoRegistrar();
  // Pre-calcular estado por ítem para evitar repetir en cada render.
  actualizarKPIs();
  renderTabla();
  renderCharts();
  renderCruzado();
  renderWidgetBrigada();
  renderNexo();
}

/* ─── Registro automático de las entregas de Órdenes E/S (`99 §148`) ─── */
/** ¿Hay entregas por registrar, desfasadas o movimientos huérfanos? (sin importar módulos nuevos) */
function hayQueRegistrar(n) {
  if (!n || !n.activo) return false;
  const e = n.resumenEstados || {};
  return !!(e.por_registrar || e.desfasado || (n.huerfanos && n.huerfanos.length));
}
/**
 * Una vez por visita, con las órdenes, el catálogo, los movimientos y el parque ya leídos: registra lo
 * pendiente, corrige lo desfasado y retira lo que la orden ya no respalda. Lo hace quien abra el
 * contrato (decisión del Ingeniero: el equipo puede registrar). Los movimientos nuevos llegan solos por
 * la suscripción y el tablero se recalcula. Si falla, todo sigue calculándose como antes.
 */
async function autoRegistrar() {
  if (sincIntentada || !stockLlego || !nexo || !hayQueRegistrar(nexo) || !ordenesNexo || !ordenesNexo.ordenes) return;
  if (parqueNexo === null || parqueFallo) return;              // sin parque no se ubica el transformador
  // Con las órdenes por releer (cambió un movimiento enlazado), no se sincroniza con la orden vieja en memoria:
  // al llegar las nuevas, recomputarTodo vuelve a llamar aquí (2026-10-09).
  if (relecturaEnEspera || leyendoOrdenes) return;
  const cid = getContratoActivo();
  const s = getSession();
  const uid = s && s.user && s.user.uid;
  if (!cid || !uid) return;
  sincIntentada = true;
  sincAviso = { texto: 'Registrando en Movimientos las entregas de las órdenes de entrada…', tipo: 'info' };
  renderNexo();
  try {
    const [SYNC, RM] = await Promise.all([import('./data/contrato_ordenes_sync.js'), import('./domain/ordenes_movimientos_registro.js')]);
    if (typeof SYNC.sincronizarContrato !== 'function' || typeof RM.textoSincronizacion !== 'function') { sincAviso = null; renderNexo(); return; }
    const existencias = Object.fromEntries(cacheStockGlobal.map((r) => [r.codigo, ((r._stockMov || r.stock) || {}).actual]));
    const res = await SYNC.sincronizarContrato({ contratoId: cid, ordenes: ordenesNexo.ordenes, catalogo: cacheStockGlobal,
      movimientos: cacheMovs, parque: parqueNexo, existencias, uid, corte: corteOrdenes() });
    const t = res ? RM.textoSincronizacion(res, cid) : { texto: '' };
    sincAviso = t.texto ? t : null;
  } catch (err) {
    console.warn('[nexo] registro automático:', err);
    sincAviso = { texto: 'No se pudieron registrar ahora las entregas de las órdenes (' + (err.message || err) +
      '). Siguen contando como «por registrar» y se intentará de nuevo la próxima vez que se abra el contrato.', tipo: 'err' };
  }
  renderNexo();
}
function htmlSincAviso() {
  if (!sincAviso) return '';
  const color = { ok: '#16A34A', info: '#2563EB', warn: '#EA580C', err: '#DC2626' }[sincAviso.tipo] || '#2563EB';
  const icono = { ok: '✓', info: '⟳', warn: '⚠', err: '✗' }[sincAviso.tipo] || '';
  return `<div class="info-msg" style="display:block; border-left-color:${color}">${icono} ${escHtml(sincAviso.texto)}</div>`;
}

/* ─── Nexo con Órdenes E/S: entregado por transformador ─── */
/**
 * Clave del transformador de un movimiento. Si viene de una orden, la MISMA clave del nexo (texto de
 * la orden): así un trafo no cuenta doble aunque la orden no traiga «· S/E» y el movimiento sí.
 */
function claveTrafoMov(m) {
  if (m && m.orden_es && String(m.orden_es.transformador || '').trim()) return claveTransformador(m.orden_es.transformador);
  return (m && (m.matricula || m.transformador_id)) ? normTxt(m.matricula || m.transformador_id) + '|' + normTxt(m.subestacion) : '';
}
/** Departamento de un transformador de la sección: del movimiento enlazado o, si falta, del parque. */
function deptoTrafo(t) {
  const m = cacheMovs.find((x) => x.departamento && claveTrafoMov(x) === t.clave);
  if (m) return nombreDepto(m.departamento);
  if (parqueNexo) { const r = resolverTransformador(parqueNexo, t.matricula, t.subestacion); if (r.ok) return nombreDepto(r.trafo.departamento); }
  return '';
}
function normTxt(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function renderNexo() {
  const sec = $('nexoOrdenes');
  if (!sec) return;                       // HTML viejo en caché (`30 L-85`): el tablero sigue como antes
  const cid = getContratoActivo();
  const conNexo = !!(cid && NEXO_CONTRATOS[cid]);
  document.querySelectorAll('.nexo-rotulo').forEach((x) => { x.hidden = !conNexo; });
  if (!conNexo) { sec.hidden = true; return; }
  sec.hidden = false;
  pintarLecturaOrdenes();
  const alc = $('nexoAlcance'), tb = $('nexoTbody'), zonas = $('nexoZonas'), avisos = $('nexoAvisos'), fuera = $('nexoNoCuentan');
  const cfg = NEXO_CONTRATOS[cid];
  if (!ordenesNexo || (!ordenesNexo.error && !nexo)) { alc.textContent = 'Leyendo las órdenes de entrada y salida…'; tb.innerHTML = ''; return; }
  if (ordenesNexo.error) {
    alc.innerHTML = `<b>No se pudieron leer las órdenes de entrada y salida</b> (${escHtml(ordenesNexo.error)}). ` +
      'Las cifras de arriba cuentan solo los movimientos.';
    tb.innerHTML = ''; zonas.innerHTML = ''; avisos.innerHTML = ''; if (fuera) fuera.hidden = true;
    return;
  }
  const n = nexo;
  const nTr = n.transformadores.filter((t) => t.matricula !== SIN_TRANSFORMADOR).length;
  const fecha = (iso) => iso ? iso.split('-').reverse().join('/') : '';
  const est = n.resumenEstados || { registrado: 0, por_registrar: n.lineas || 0, desfasado: 0 };
  alc.innerHTML = `Cuentan las órdenes de <b>ENTRADA</b> (bodega → subestación) del <b>${fecha(cfg.desde)}</b> al <b>${fecha(cfg.hasta)}</b>, ` +
    `con los ítems exactos del contrato: <b>${n.ordenesQueCuentan}</b> ${n.ordenesQueCuentan === 1 ? 'orden' : 'órdenes'}, ` +
    `<b>${nTr}</b> ${nTr === 1 ? 'transformador' : 'transformadores'}, <b>${fmtCOP(n.totalValor)}</b>. ` +
    `Entregas: <b>${est.registrado}</b> registradas en Movimientos · <b>${est.por_registrar}</b> por registrar` +
    (est.desfasado ? ` · <b>${est.desfasado}</b> desfasadas (la orden cambió)` : '') + '. ' +
    'Lo registrado ya es un movimiento (Histórico). Las entregas se registran solas al guardar la orden y al abrir este contrato; ' +
    'mientras tanto, lo que falta por registrar se calcula aquí.' +
    (ordenesNexo.truncado ? ' <b>Parcial:</b> hay más de 500 órdenes en la vigencia y aquí entran las 500 más recientes: lo entregado puede ser mayor.' : '');
  avisos.innerHTML = htmlSincAviso() + n.avisos.map((a) => `<div class="info-msg warn" style="display:block">⚠ ${escHtml(a)}</div>`).join('');
  tb.innerHTML = n.transformadores.length ? n.transformadores.map((t) => `
    <tr>
      <td><code>${escHtml(t.matricula)}</code>${t.subestacion ? `<div style="font-size:11px;color:var(--ink-3)">S/E ${escHtml(t.subestacion)}</div>` : ''}</td>
      <td>${escHtml(t.zona || '—')}${deptoTrafo(t) ? `<div style="font-size:11px;color:var(--ink-3)">${escHtml(deptoTrafo(t))}</div>` : ''}</td>
      <td>${t.items.map((i) => `<div><code>${escHtml(i.codigo)}</code> ${escHtml(i.nombre)} · <b>${fmtInt(i.cantidad)}</b> ${escHtml(i.unidad)} × ${fmtCOP(i.valorUnitario)}</div>`).join('')}</td>
      <td style="text-align:right; font-family: var(--font-mono); font-weight:700;">${fmtCOP(t.valor)}</td>
      <td style="font-size:12px">${t.ordenes.map((o) => `ENTRADA ${escHtml(o.numero)} · ${fecha(o.fecha)}` +
        (o.estado === 'registrado' ? ` · <span style="color:#16A34A">${escHtml((o.movimientos || []).join(', '))}</span>`
          : o.estado === 'desfasado' ? ' · <span style="color:#DC2626">⚠ desfasada</span>'
          : o.estado === 'mixto' ? ' · <span style="color:#EA580C">en parte registrada</span>'
          : ' · <span style="color:#EA580C">por registrar</span>')).join('<br>')}</td>
    </tr>`).join('')
    : '<tr><td colspan="5" class="td-empty">Ninguna orden de entrada trae ítems del contrato en la vigencia del pedido.</td></tr>';
  const porDep = new Map();
  for (const t of n.transformadores) {
    const d = deptoTrafo(t) || 'sin depto';
    const x = porDep.get(d) || { valor: 0, trafos: 0 };
    x.valor += t.valor; if (t.matricula !== SIN_TRANSFORMADOR) x.trafos++;
    porDep.set(d, x);
  }
  zonas.innerHTML = n.zonas.length
    ? 'Por zona: ' + n.zonas.map((z) => `<b>${escHtml(z.zona || 'sin zona')}</b> ${fmtCOP(z.valor)} (${z.transformadores} ${z.transformadores === 1 ? 'trafo' : 'trafos'})`).join(' · ') +
      '<br>Por departamento: ' + [...porDep.entries()].sort((a, b) => b[1].valor - a[1].valor)
        .map(([d, x]) => `<b>${escHtml(d)}</b> ${fmtCOP(x.valor)} (${x.trafos} ${x.trafos === 1 ? 'trafo' : 'trafos'})`).join(' · ')
    : '';
  if (fuera) {
    const o = n.noCuentan.ordenes;
    fuera.hidden = !(n.noCuentan.materiales.length || o.otroTipo || o.sinItems);
    $('nexoNoCuentanCuerpo').innerHTML =
      `<p style="margin:6px 0">${o.sinItems} orden(es) de entrada sin ítems del contrato · ${o.otroTipo} de SALIDA ` +
      '(no tocan el contrato). Solo se leen las órdenes de la vigencia del pedido.</p>' +
      (n.noCuentan.materiales.length ? `<table class="data-table"><thead><tr><th scope="col">Material de la orden</th><th scope="col">Unidad</th>` +
        `<th scope="col" style="text-align:right">Cantidad</th><th scope="col">Por qué no cuenta</th></tr></thead><tbody>` +
        n.noCuentan.materiales.map((m) => `<tr><td>${escHtml(m.descripcion)}</td><td>${escHtml(m.unidad)}</td>` +
          `<td style="text-align:right; font-family: var(--font-mono);">${fmtInt(m.cantidad)}</td><td style="font-size:12px">${escHtml(m.motivo)}</td></tr>`).join('') +
        '</tbody></table>' : '');
  }
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

/* ─── Relectura de las órdenes E/S (2026-10-09) ─── */
/**
 * Lee las órdenes de la vigencia (la MISMA lectura acotada con desde/hasta de siempre) y recalcula.
 * La primera vez, si falla, la sección lo dice como antes; en una RElectura que falla se conservan las
 * órdenes ya leídas y el sello lo avisa.
 */
function leerOrdenesNexo() {
  const cid = getContratoActivo();
  const cfgNexo = cid && NEXO_CONTRATOS[cid];
  if (!cfgNexo) return Promise.resolve();
  leyendoOrdenes = true; relecturaEnEspera = false;
  pintarLecturaOrdenes();
  return listarOrdenes({ desde: cfgNexo.desde, hasta: cfgNexo.hasta })
    .then((r) => { ordenesNexo = { ordenes: r.ordenes || [], truncado: !!r.truncado }; ordenesLeidasMs = Date.now(); errorRelectura = ''; },
          (err) => {
            console.warn('[nexo] no se pudieron leer las órdenes E/S:', err);
            const msg = (err && err.message) || String(err);
            if (ordenesNexo && ordenesNexo.ordenes) errorRelectura = msg;   // se siguen mostrando las anteriores
            else ordenesNexo = { error: msg };
          })
    .then(() => {
      leyendoOrdenes = false; ultimoIntentoMs = Date.now();
      // Sin el stock todavía, solo la sección (si no, la tabla diría «Sin suministros sembrados.» un instante).
      if (stockLlego) recomputarTodo(); else renderNexo();
      pintarLecturaOrdenes();
    });
}
/** Sello «Órdenes leídas a las hh:mm» + botón «Actualizar», junto al rótulo del nexo. */
function pintarLecturaOrdenes() {
  const caja = $('nexoLectura'), txt = $('nexoLecturaTexto'), btn = $('btnActualizarOrdenes');
  if (!caja || !txt) return;                             // HTML viejo en caché (`30 L-85`)
  const cid = getContratoActivo();
  // Oculto sin el módulo, sin nexo o mientras la primera lectura no termina (la sección ya dice «Leyendo…»).
  if (!REL || !(cid && NEXO_CONTRATOS[cid]) || ultimoIntentoMs == null) { caja.hidden = true; return; }
  caja.hidden = false;
  const leyendo = leyendoOrdenes || relecturaEnEspera;
  txt.textContent = REL.textoLectura({ leidasMs: ordenesLeidasMs, leyendo, error: errorRelectura });
  if (btn) btn.disabled = leyendo;
}
/** (a) Cada emit de movimientos: si cambió un movimiento ENLAZADO, se piden las órdenes de nuevo (agrupado). */
function vigilarEnlazados() {
  if (!REL) return;
  const firma = REL.firmaEnlazados(cacheMovs);
  const cambio = REL.cambiaronEnlazados(huellaEnlazados, firma);
  huellaEnlazados = firma;
  if (cambio && relector) {
    relecturaEnEspera = true;
    relector.pedir();
    pintarLecturaOrdenes();
  }
}
/** Carga perezosa de las reglas de relectura; sin ellas todo sigue como antes (una lectura por visita). */
function cargarRelectura() {
  import('./domain/contrato_relectura.js').then((m) => {
    if (typeof m.crearRelector !== 'function' || typeof m.firmaEnlazados !== 'function' || typeof m.textoLectura !== 'function') return;
    REL = m;
    // Nunca se solapa con la primera lectura: la espera y lee después (pudo empezar antes del cambio).
    relector = m.crearRelector({ leer: async () => { try { await lecturaInicial; } catch (_) {} return leerOrdenesNexo(); } });
    if (stockLlego) huellaEnlazados = m.firmaEnlazados(cacheMovs);   // punto de partida
    pintarLecturaOrdenes();
  }, (err) => console.warn('[nexo] relectura de órdenes no disponible:', err));
}
/** (b) Al volver a la pestaña, si la última lectura tiene más de un minuto. */
function alVolverALaPestana() {
  if (!REL || !relector) return;
  if (REL.releerAlVolver({ visible: document.visibilityState === 'visible', ultimaLecturaMs: ultimoIntentoMs,
    ahoraMs: Date.now(), leyendo: leyendoOrdenes || relector.leyendo() || relector.esperando() })) relector.ya();
}

function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    return;
  }
  if (unsubStock)         try { unsubStock(); }         catch (_) {}
  if (unsubAccionesBrig)  try { unsubAccionesBrig(); }  catch (_) {}

  const filtros = withContratoFiltro();
  const cidNexo = getContratoActivo();
  if (cidNexo && NEXO_CONTRATOS[cidNexo]) {
    lecturaInicial = leerOrdenesNexo();
    cargarRelectura();
  }
  // Una sola lectura del contrato por visita (free-tier): trae el monto registrado.
  const cidContrato = getContratoActivo();
  if (cidContrato) {
    obtenerContrato(cidContrato)
      .then((c) => { contratoDoc = c; if (cacheStockGlobal.length) actualizarKPIs(); })
      .catch((err) => console.warn('[dashboard] no se pudo leer /contratos/' + cidContrato + ':', err));
  }
  // G016: una sola suscripción. suscribirStockGlobal ya lee 'suministros' y
  // 'movimientos' internamente y ahora expone ambos en el emit → tomamos
  // cacheMovs de aquí en vez de re-suscribir esas colecciones (antes se leían
  // 2× cada una por visita). nombreSum saca el nombre de cacheStockGlobal.
  unsubStock = suscribirStockGlobal(filtros, ({ suministros, movimientos, config }) => {
    stockLlego = true;
    cacheStockGlobal = suministros;
    cacheMovs = movimientos || [];
    configCache = config || null;
    vigilarEnlazados();
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
  if (relector) try { relector.parar(); } catch (_) {}
  for (const k of Object.keys(charts)) destroyChart(k);
});

// ── Eventos UI ──
fBusqueda.addEventListener('input', renderTabla);
fEstado.addEventListener('change', renderTabla);
fxZona.addEventListener('change', renderCruzado);
fxDepto.addEventListener('change', renderCruzado);
// Relectura de las órdenes: botón «Actualizar» (ausente con el HTML viejo) y vuelta a la pestaña.
$('btnActualizarOrdenes')?.addEventListener('click', () => { if (relector) relector.ya(); });
document.addEventListener('visibilitychange', alVolverALaPestana);

arrancar();
// Si los datos llegan antes que la sesión, el registro automático espera a que la sesión esté lista.
window.addEventListener('sgm:session-ready', () => autoRegistrar(), { once: true });
document.addEventListener('sgm:session-ready', () => autoRegistrar(), { once: true });
