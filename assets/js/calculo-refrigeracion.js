// ═══════════════════════════════════════════════════════════════
// CALCULO DE REFRIGERACIÓN · capa UI (DOM binding)
// ───────────────────────────────────────────────────────────────
// Cablea el dominio puro (assets/js/domain/refrigeracion.js) con
// la maquetación de pages/calculo-refrigeracion.html. Toda la
// matemática vive en el dominio: aquí solo hay efectos de DOM
// (lectura de inputs, escritura en cells, render de Chart.js).
//
// Carga lazy: los datos pesados (TRANSFORMADORES_AFINIA, FAN_DB)
// se importan con dynamic-import al primer uso para minimizar
// el costo del primer paint.
// ═══════════════════════════════════════════════════════════════

import {
  CURVAS_GRAFICO, EJE_X_KVA,
  interpolarPendiente, convertirCaudalACFM, cfmAM3s,
  calcularRefrigeracion, calcularUnidadesRequeridas,
  calcularProteccionElectrica, extraerCorrienteFan,
  evaluarCompatibilidad, mensajeDisposicion, COMPAT_ESTADO,
  deduceOnafDesdeOnanYPct, deducePctDesdeOnanYOnaf,
  calcularYStep, calcularAutoRango,
  formatearNumero, escaparHtml
} from './domain/refrigeracion.js';

const $ = (id) => document.getElementById(id);

/* ─── Estado UI mutable (mínimo) ────────────────────────────── */
const state = {
  fans: [
    { id: 1, desc: 'Opción 1 — ZIEHL-ABEGG FN063-6DL.4I.A7P1 · 50Hz', cfm: 5933 },
    { id: 2, desc: 'Opción 2 — ', cfm: 0 }
  ],
  fanIdCnt: 3,
  cfmReq:    0,
  cfmReqAlt: 0,
  yStep:     20000,
  lock:      false,            // anti-recursión ONAN↔ONAF↔%
  fanDb:     null,             // cargado lazy
  transformers: null,          // cargado lazy
  chart:     null
};

/* ─── Helpers ───────────────────────────────────────────────── */

function getOnan() { return parseFloat($('kva_onan').value) || 60000; }
function getOnaf() { return parseFloat($('kva_onaf').value) || 79800; }
function getPct()  { return parseFloat($('pct').value)      || 133; }
function getAlt()  { return parseFloat($('alt').value)      || 0; }

/**
 * Validación reactiva por input. Lee el atributo min/max declarado
 * en el DOM y marca el campo con .input-error / .input-warn según
 * corresponda. Devuelve `true` si está dentro del rango.
 */
function validarRangoInput(input) {
  if (!input) return true;
  const v   = parseFloat(input.value);
  const min = parseFloat(input.getAttribute('min'));
  const max = parseFloat(input.getAttribute('max'));
  let estado = 'ok';
  if (input.value === '' || Number.isNaN(v)) estado = 'ok';
  else if ((Number.isFinite(min) && v < min) || (Number.isFinite(max) && v > max)) estado = 'error';
  input.classList.toggle('input-error', estado === 'error');
  // Mensaje inline (vive en el siguiente sibling .hint si existe)
  const hint = input.nextElementSibling;
  if (hint && hint.classList.contains('hint')) {
    if (estado === 'error') {
      hint.dataset.original = hint.dataset.original || hint.textContent;
      hint.textContent = `Fuera de rango (${Number.isFinite(min) ? min : '−∞'} – ${Number.isFinite(max) ? max : '+∞'})`;
      hint.classList.add('hint-error');
    } else if (hint.dataset.original) {
      hint.textContent = hint.dataset.original;
      hint.classList.remove('hint-error');
    }
  }
  return estado === 'ok';
}

function getMotorConn() {
  const el = document.querySelector('input[name="motor_conn"]:checked');
  return el ? el.value : 'D';
}

/* ─── Carga lazy de datos pesados ───────────────────────────── */

async function ensureTransformers() {
  if (state.transformers) return state.transformers;
  const mod = await import('./data/refrigeracion-transformadores-afinia.js');
  state.transformers = mod.TRANSFORMADORES_AFINIA;
  return state.transformers;
}

async function ensureFanDb() {
  if (state.fanDb) return state.fanDb;
  const mod = await import('./data/refrigeracion-fan-db.js');
  state.fanDb = mod.FAN_DB;
  return state.fanDb;
}

/* ─── Identificación: matrícula AFINIA ──────────────────────── */

async function initMatSelect() {
  const list = await ensureTransformers();
  const dl = $('mat_list');
  if (!dl) return;
  dl.innerHTML = list.map(t =>
    `<option value="${escaparHtml(t.MATRICULA)}">${escaparHtml(t.MATRICULA)} — ${escaparHtml(t.SUBESTACION)} (${t['POTENCIA (KVA)']} kVA)</option>`
  ).join('');
}

async function onMatChange() {
  const list = await ensureTransformers();
  const val  = $('mat_input').value;
  const t    = list.find(x => x.MATRICULA === val);
  if (!t) return;
  $('t_serie').value  = t.SERIE;
  $('t_sub').value    = t.SUBESTACION;
  $('t_zona').value   = t.ZONA;
  $('t_dept').value   = t.DEPARTAMENTO;
  $('t_grupo').value  = t.GRUPO;
  $('t_kva').value    = parseInt(t['POTENCIA (KVA)']).toLocaleString('es-CO') + ' kVA';
  $('t_refrig').value = t.REFRIGERACION || 'No especificado';
  if (state.lock) return;
  state.lock = true;
  $('kva_onan').value = parseInt(t['POTENCIA (KVA)']);
  $('kva_onaf').value = deduceOnafDesdeOnanYPct(parseInt(t['POTENCIA (KVA)']), getPct());
  state.lock = false;
  upd();
}

/* ─── Selector de ventilador (FAN_DB) ───────────────────────── */

async function onFanSelect() {
  const db  = await ensureFanDb();
  const key = $('fan_db_sel').value;
  const status = $('fan_db_status');
  if (!key) { if (status) status.textContent = ''; return; }
  const d = db[key];
  if (!d) return;
  const fields = [
    'fan_marca', 'fan_modelo', 'fan_nserie', 'fan_tipo_pala', 'fan_diam',
    'fan_aspas', 'fan_rpm', 'fan_montaje', 'fan_peso', 'fan_flow_val',
    'fan_cfm_nom', 'fan_m3s', 'fan_volt', 'fan_kw', 'fan_amp', 'fan_cosphi',
    'fan_aislam', 'fan_protmotor', 'fan_material', 'fan_sentido', 'fan_tmin', 'fan_cert'
  ];
  for (const k of fields) {
    const el = $(k);
    if (el && k in d) el.value = d[k];
  }
  // Selectors
  for (const o of $('fan_hz').options)        if (o.value === d.fan_hz)         { o.selected = true; break; }
  for (const o of $('fan_ip').options)        if (o.value === d.fan_ip || (o.text || '').includes(d.fan_ip || '')) { o.selected = true; break; }
  for (const o of $('fan_flow_unit').options) if (o.value === d.fan_flow_unit)  { o.selected = true; break; }
  syncCfm();
  $('cfm_result_disp').textContent = formatearNumero(d.fan_cfm_nom) + ' CFM';
  if (status) status.textContent = '✓ Datos cargados desde ficha técnica';
  // Sync calculador de fans (fila 1)
  if (state.fans.length > 0) {
    state.fans[0].cfm  = d.fan_cfm_nom || 0;
    state.fans[0].desc = (d.fan_marca || '') + ' ' + (d.fan_modelo || '');
    const desc = $('fd' + state.fans[0].id);
    const cfm  = $('fc' + state.fans[0].id);
    if (desc) desc.value = state.fans[0].desc;
    if (cfm)  cfm.value  = state.fans[0].cfm;
    updateCells();
  }
  checkCompat();
  await calcProtection();
}

/* ─── Conversión de caudal ──────────────────────────────────── */

function syncCfm() {
  const valor  = parseFloat($('fan_flow_val').value);
  const unidad = $('fan_flow_unit').value;
  const cfm = convertirCaudalACFM({ valor, unidad });
  if (cfm !== null) {
    $('fan_cfm_nom').value         = cfm;
    $('fan_m3s').value             = cfmAM3s(cfm).toFixed(3);
    $('cfm_result_disp').textContent = formatearNumero(cfm) + ' CFM';
  } else {
    $('cfm_result_disp').textContent = '—';
  }
}

/* ─── Sincronización ONAN ↔ ONAF ↔ % ───────────────────────── */

function onOnanCh() {
  if (state.lock) return;
  state.lock = true;
  $('kva_onaf').value = deduceOnafDesdeOnanYPct(getOnan(), getPct());
  state.lock = false;
  upd();
}

function onOnafCh() {
  if (state.lock) return;
  state.lock = true;
  const newPct = deducePctDesdeOnanYOnaf(getOnan(), getOnaf());
  if (newPct !== null) $('pct').value = newPct;
  state.lock = false;
  upd();
}

function onPctCh() {
  if (state.lock) return;
  state.lock = true;
  $('kva_onaf').value = deduceOnafDesdeOnanYPct(getOnan(), getPct());
  state.lock = false;
  upd();
}

/* ─── Calculador de ventiladores (tabla) ────────────────────── */

function calcFan(f) {
  return calcularUnidadesRequeridas({ cfm_total: state.cfmReq, cfm_fan: f.cfm });
}

function renderFans() {
  const focId = document.activeElement ? document.activeElement.id : null;
  const tbody = $('fan-tbody');
  tbody.innerHTML = state.fans.map((f, i) => {
    const r = calcFan(f);
    const nT = r.n !== null ? r.n : '—';
    const nC = r.n !== null ? (r.ok ? 'cok' : 'cwrn') : '';
    const covOk = r.cobertura_pct !== null && r.cobertura_pct >= 100;
    return `<tr id="fr${f.id}">
      <td style="color:var(--ink-4);font-size:11px;text-align:center">${i + 1}</td>
      <td><input id="fd${f.id}" type="text" class="ti ti-d" value="${escaparHtml(f.desc)}"
           placeholder="Descripción o modelo" data-fan-desc="${f.id}"></td>
      <td style="white-space:nowrap">
        <input id="fc${f.id}" type="number" class="ti ti-c" value="${f.cfm || ''}"
               placeholder="CFM" min="0" step="1" data-fan-cfm="${f.id}">
        <span style="font-size:9px;color:var(--ink-4)">ft³/min</span>
      </td>
      <td class="nbig ${nC}" id="fn${f.id}">${nT}</td>
      <td class="tr" id="fa${f.id}">${r.n !== null ? formatearNumero(r.cfm_logrado) + ' CFM' : '—'}</td>
      <td class="tr" id="fv${f.id}" style="font-weight:600;color:${covOk ? '#008f4a' : '#c91a14'}">${r.cobertura_pct !== null ? r.cobertura_pct + '%' : '—'}</td>
      <td class="tr" id="fe${f.id}" style="color:${r.n !== null ? (r.ok ? '#008f4a' : '#c91a14') : 'inherit'}">${r.n !== null ? formatearNumero(r.exceso) + ' CFM' : '—'}</td>
      <td class="tc" id="fs${f.id}">${r.n !== null ? `<span class="ico ${r.ok ? 'cok' : 'cerr'}" aria-label="${r.ok ? 'OK' : 'Insuficiente'}">${r.ok ? '✓' : '✗'}</span>` : ''}</td>
      <td class="tc"><button type="button" class="bdel" data-fan-remove="${f.id}" aria-label="Eliminar opción ${i + 1}">✕</button></td>
    </tr>`;
  }).join('');
  updateSum();
  if (focId) { const el = $(focId); if (el) el.focus(); }
}

function updateCells() {
  state.fans.forEach(f => {
    const r = calcFan(f);
    const fn = $('fn' + f.id), fa = $('fa' + f.id), fv = $('fv' + f.id);
    const fe = $('fe' + f.id), fs = $('fs' + f.id);
    if (!fn) return;
    fn.textContent = r.n !== null ? r.n : '—';
    fn.className   = 'nbig ' + (r.n !== null ? (r.ok ? 'cok' : 'cwrn') : '');
    fa.textContent = r.n !== null ? formatearNumero(r.cfm_logrado) + ' CFM' : '—';
    fv.textContent = r.cobertura_pct !== null ? r.cobertura_pct + '%' : '—';
    fv.style.fontWeight = '600';
    fv.style.color      = r.cobertura_pct !== null ? (r.cobertura_pct >= 100 ? '#008f4a' : '#c91a14') : '';
    fe.textContent = r.n !== null ? formatearNumero(r.exceso) + ' CFM' : '—';
    fe.style.color = r.n !== null ? (r.ok ? '#008f4a' : '#c91a14') : '';
    fs.innerHTML   = r.n !== null ? `<span class="ico ${r.ok ? 'cok' : 'cerr'}" aria-label="${r.ok ? 'OK' : 'Insuficiente'}">${r.ok ? '✓' : '✗'}</span>` : '';
  });
  updateSum();
  calcProtection();
}

function updateSum() {
  const valid = state.fans.filter(f => f.cfm > 0 && state.cfmReq > 0);
  const sum = $('fan-sum');
  if (!valid.length) { sum.innerHTML = ''; return; }
  const res  = valid.map(f => Object.assign(calcFan(f), { f }));
  const okList = res.filter(r => r.ok);
  const best = okList.length ? okList.reduce((a, b) => b.n < a.n ? b : a) : null;
  sum.innerHTML = res.map(r => {
    const isBest = r === best;
    const idx = state.fans.indexOf(r.f) + 1;
    return `
      <div class="fs">${escaparHtml(r.f.desc) || 'Opción ' + idx}:
        <span class="fsv"> ${r.n} unid.</span> ×
        <span class="fsv">${formatearNumero(r.f.cfm)} CFM</span> =
        <span style="font-weight:700;color:${r.ok ? '#008f4a' : '#c91a14'}">${formatearNumero(r.cfm_logrado)} CFM</span>
        ${isBest ? '<span style="font-size:10px;background:rgba(28,200,112,.14);color:#008f4a;border-radius:4px;padding:2px 7px;margin-left:6px;font-weight:700">menor cantidad</span>' : ''}
      </div>`;
  }).join('');
}

function addFan() {
  state.fans.push({ id: state.fanIdCnt++, desc: '', cfm: 0 });
  renderFans();
  setTimeout(() => { const el = $('fd' + (state.fanIdCnt - 1)); if (el) el.focus(); }, 30);
}

function removeFan(id) {
  state.fans = state.fans.filter(f => f.id !== id);
  renderFans();
}

/* ─── Compatibilidad mecánica ───────────────────────────────── */

function checkCompat() {
  const A = parseFloat($('rad_A').value);
  const B = parseFloat($('rad_B').value);
  const C = parseFloat($('rad_C').value);
  const diametro_mm  = parseFloat($('fan_diam').value);
  const distancia_mm = parseFloat($('mon_dist').value);
  const disposicion  = $('disposicion').value;

  const infoEl = $('disp-info');
  if (infoEl) infoEl.textContent = mensajeDisposicion(disposicion);

  const r = evaluarCompatibilidad({ A, B, C, diametro_mm, distancia_mm, disposicion });
  pintarComp(r.c1, 'c1-val', 'c1-desc');
  pintarComp(r.c2, 'c2-val', 'c2-desc', 'c2-title');
  pintarComp(r.c3, 'c3-val', 'c3-desc');
  pintarComp(r.c4, 'c4-val', 'c4-desc');

  const sum = $('comp-summary');
  if (sum) {
    const cls = r.resumen.err > 0 ? 'cerr' : r.resumen.warn > 0 ? 'cwrn' : (disposicion ? 'cok' : '');
    sum.innerHTML = `<span class="${cls}" style="font-weight:700">${escaparHtml(r.resumen.mensaje)}</span>`;
  }
}

function pintarComp({ val, desc, estado, title }, idVal, idDesc, idTitle) {
  const ev = $(idVal), ed = $(idDesc);
  if (!ev || !ed) return;
  const card = ev.parentElement;
  card.className = 'comp-card comp-' + estado;
  ev.textContent = val;
  ed.textContent = desc;
  if (idTitle && title) {
    const t = $(idTitle);
    if (t) t.textContent = title;
  }
}

/* ─── Protección eléctrica ──────────────────────────────────── */

async function calcProtection() {
  const conn = getMotorConn();
  const fanKey = $('fan_db_sel') ? $('fan_db_sel').value : '';
  const db = fanKey ? await ensureFanDb() : null;
  const fan = db && fanKey ? db[fanKey] : null;

  const noteEl = $('conn_note');
  if (noteEl) {
    noteEl.textContent = conn === 'D'
      ? 'Δ Delta: tensión de línea completa en cada bobina. Corriente nominal plena. Uso estándar en operación continua de ventiladores.'
      : 'Y Estrella: tensión reducida (V_L/√3) por bobina. Corriente ≈ 1/3 de la corriente Delta. Para arranque suave o motores con bobinado diseñado para estrella.';
  }

  const pf = $('prot-per-fan'), pt = $('prot-total'), ps = $('prot-summary');
  if (!pf || !pt || !ps) return;

  if (!fan) {
    const stub = '<p style="color:var(--ink-4);font-style:italic;padding:10px">Seleccione un ventilador desde la base de datos para calcular la protección eléctrica.</p>';
    pf.innerHTML = stub; pt.innerHTML = stub; ps.innerHTML = '';
    return;
  }

  const iF = extraerCorrienteFan(fan.fan_amp, conn);
  if (iF === null || !Number.isFinite(iF)) {
    pf.innerHTML = '<p class="cwrn" style="padding:8px">No se pudo extraer la corriente del ventilador seleccionado.</p>';
    return;
  }

  const f0    = state.fans && state.fans[0];
  const nFans = (f0 && f0.cfm > 0 && state.cfmReq > 0) ? Math.ceil(state.cfmReq / f0.cfm) : 0;
  const r     = calcularProteccionElectrica({ amps_por_fan: iF, n_fans: nFans });

  pf.innerHTML = renderPerFanCard(fan, conn, iF, r);
  pt.innerHTML = renderTotalCard(r, nFans, iF);
  ps.innerHTML = renderListaMateriales(fan, conn, iF, r);
}

function renderPerFanCard(fan, conn, iF, r) {
  const gm = r.guardamotor;
  const txtConn = conn === 'D' ? 'Δ Delta' : 'Y Estrella';
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:stretch">
      <div class="prot-card prot-card--ok" style="min-width:200px">
        <div class="prot-label">Corriente por ventilador (${txtConn})</div>
        <div class="prot-val">${iF.toFixed(2)} A</div>
        <div class="prot-meta">${escaparHtml(fan.fan_modelo)} · ${conn === 'D' ? 'Δ' : 'Y'} · ${escaparHtml(fan.fan_hz || '?')} Hz</div>
      </div>
      <div class="prot-card prot-card--${gm ? 'ok' : 'err'}" style="min-width:280px">
        <div class="prot-label">Guardamotor sugerido (1 por ventilador)</div>
        ${gm ? `
          <div class="prot-val">ABB ${gm.model}</div>
          <div class="prot-meta">Rango ajuste: ${gm.min}…${gm.max} A · Setting recomendado: <strong>${iF.toFixed(2)} A</strong></div>
          <div class="prot-meta">PID: ${gm.pid} · Ics=50 kA@400 V · Trip class 10A · 45 mm DIN</div>
          <div class="prot-meta">Función desconexión integrada · Comp. temperatura · IEC/EN 60947-4-1</div>
        ` : `<div class="prot-meta">Corriente ${iF.toFixed(2)} A fuera del rango MS116 estándar (0.10…32 A). Consultar catálogo.</div>`}
      </div>
      <div class="prot-card prot-card--info" style="min-width:240px">
        <div class="prot-label">Contacto auxiliar SCADA (1 por guardamotor)</div>
        <div class="prot-val">ABB ${r.aux_guardamotor.model}</div>
        <div class="prot-meta">${r.aux_guardamotor.desc}</div>
        <div class="prot-meta">PID: ${r.aux_guardamotor.pid} · 9 mm · Señalización falla / estado motor al SCADA</div>
      </div>
    </div>`;
}

function renderTotalCard(r, nFans, iF) {
  const brk = r.breaker;
  const n   = nFans || '?';
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:stretch">
      <div class="prot-card prot-card--ok" style="min-width:200px">
        <div class="prot-label">Corriente total del sistema</div>
        <div class="prot-val">${nFans ? r.amps_totales.toFixed(2) + ' A' : '—'}</div>
        <div class="prot-meta">${n} ventiladores × ${iF.toFixed(2)} A</div>
      </div>
      <div class="prot-card prot-card--info" style="min-width:200px">
        <div class="prot-label">Corriente mínima del breaker</div>
        <div class="prot-val">${nFans ? r.amps_min_breaker.toFixed(2) + ' A' : '—'}</div>
        <div class="prot-meta">Factor seguridad NEC 430 (×1.25)</div>
      </div>
      <div class="prot-card prot-card--${brk ? 'ok' : 'err'}" style="min-width:280px">
        <div class="prot-label">Breaker principal sugerido</div>
        ${brk ? `
          <div class="prot-val">ABB ${brk.model}</div>
          <div class="prot-meta">In = ${brk.in} A · 3P · Curva C · 6 kA</div>
          <div class="prot-meta">PID: ${brk.pid} · Pérdidas: ${brk.power_w} W</div>
        ` : `<div class="prot-meta">${nFans ? `Corriente requerida ${r.amps_min_breaker.toFixed(2)} A excede el catálogo S203 (máx. 50 A). Consultar familia superior.` : 'Calcule el sistema para sugerir breaker.'}</div>`}
      </div>
      <div class="prot-card prot-card--info" style="min-width:240px">
        <div class="prot-label">Contacto auxiliar SCADA (1 por breaker)</div>
        <div class="prot-val">ABB ${r.aux_breaker.model}</div>
        <div class="prot-meta">${r.aux_breaker.desc}</div>
        <div class="prot-meta">PID: ${r.aux_breaker.pid}</div>
      </div>
    </div>`;
}

function renderListaMateriales(fan, conn, iF, r) {
  const items = [];
  if (r.guardamotor)     items.push(`${r.n_fans || 1}× <strong>ABB ${r.guardamotor.model}</strong> · PID ${r.guardamotor.pid} · setting ${iF.toFixed(2)} A`);
  if (r.aux_guardamotor) items.push(`${r.n_fans || 1}× <strong>ABB ${r.aux_guardamotor.model}</strong> · PID ${r.aux_guardamotor.pid} · contacto auxiliar SCADA`);
  if (r.breaker)         items.push(`1× <strong>ABB ${r.breaker.model}</strong> · PID ${r.breaker.pid} · breaker principal 3P`);
  if (r.aux_breaker)     items.push(`1× <strong>ABB ${r.aux_breaker.model}</strong> · PID ${r.aux_breaker.pid} · auxiliar S203 SCADA`);
  if (!items.length) return '';
  return `
    <div class="calc-subsect" style="margin-top:18px">Lista de materiales — protección eléctrica</div>
    <ul style="margin:6px 0 0 18px;padding:0;color:var(--ink-2);font-size:13px;line-height:1.7">
      ${items.map(i => `<li>${i}</li>`).join('')}
    </ul>`;
}

/* ─── Zoom y rango del gráfico ──────────────────────────────── */

function applyRange() {
  if (!state.chart) return;
  const xMin = (parseFloat($('x_min').value) || 0)   * 1000;
  const xMax = (parseFloat($('x_max').value) || 100) * 1000;
  const yMin = parseFloat($('y_min').value) || 0;
  const yMax = parseFloat($('y_max').value) || 600000;
  state.chart.options.scales.x.min = xMin;
  state.chart.options.scales.x.max = xMax;
  state.chart.options.scales.y.min = yMin;
  state.chart.options.scales.y.max = yMax;
  const step = calcularYStep(yMax - yMin);
  state.yStep = step;
  state.chart.options.scales.y.ticks.stepSize     = step;
  state.chart.options.scales.y.ticks.maxTicksLimit = Math.min(20, Math.ceil((yMax - yMin) / step) + 1);
  state.chart.update('none');
}

function autoRange() {
  const r = calcularAutoRango(getOnan());
  $('x_min').value = r.xMin / 1000; // MVA
  $('x_max').value = r.xMax / 1000;
  $('y_min').value = r.yMin;
  $('y_max').value = r.yMax;
  state.yStep = r.yStep;
  applyRange();
}

/* ─── Animación de KPIs (count-up con respeto a reduced-motion) ──── */

const _prefersReducedMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
})();

const _kpiAnimState = new Map(); // id → {raf, from}

function setKpi(id, target, suffix) {
  const el = $(id);
  if (!el) return;
  const newText = formatearNumero(target) + suffix;
  if (_prefersReducedMotion) { el.textContent = newText; el.dataset.kpiVal = String(target); return; }
  const prev = parseFloat(el.dataset.kpiVal);
  const from = Number.isFinite(prev) ? prev : target;
  if (Math.abs(from - target) < 1) { el.textContent = newText; el.dataset.kpiVal = String(target); return; }
  // Cancelar anterior si seguía corriendo
  const cur = _kpiAnimState.get(id);
  if (cur) cancelAnimationFrame(cur.raf);
  const start = performance.now();
  const dur   = 480;
  const ease  = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic (iOS feel)
  const tick  = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const v = from + (target - from) * ease(t);
    el.textContent = formatearNumero(v) + suffix;
    if (t < 1) {
      const nextRaf = requestAnimationFrame(tick);
      _kpiAnimState.set(id, { raf: nextRaf, from });
    } else {
      el.dataset.kpiVal = String(target);
      _kpiAnimState.delete(id);
    }
  };
  _kpiAnimState.set(id, { raf: requestAnimationFrame(tick), from });
}

/* ─── Update general (al cambiar parámetros del cálculo) ────── */

function upd() {
  const r = calcularRefrigeracion({ kva_onan: getOnan(), pct: getPct(), alt: getAlt() });
  state.cfmReq    = r.cfm_nivel_mar;
  state.cfmReqAlt = r.cfm_corregido;

  // Tween animado del KPI (skip si reduced-motion)
  setKpi('v1', r.onan,          ' kVA');
  setKpi('v2', r.onaf,          ' kVA');
  setKpi('v3', r.delta,         ' kVA');
  setKpi('v4', r.cfm_nivel_mar, ' CFM');
  setKpi('v5', r.cfm_corregido, ' CFM');
  $('cfm-disp').textContent     = formatearNumero(r.cfm_nivel_mar) + ' CFM';
  $('cfm-alt-disp').textContent = formatearNumero(r.cfm_corregido) + ' CFM';

  updateCells();
  if (!state.chart) return;
  state.chart._interpPct = getPct();
  state.chart._onan      = r.onan;
  state.chart._cfm       = r.cfm_nivel_mar;
  const ii = state.chart.data.datasets.findIndex(d => d.isInterp);
  if (ii >= 0) {
    const slope = interpolarPendiente(getPct());
    state.chart.data.datasets[ii].pct   = getPct();
    state.chart.data.datasets[ii].label = `Curva interpolada (${getPct().toFixed(1)}%)`;
    state.chart.data.datasets[ii].data  = EJE_X_KVA.map(x => ({ x, y: slope * x }));
  }
  const oi = state.chart.data.datasets.findIndex(d => d.pct === 'op');
  if (oi >= 0) {
    state.chart.data.datasets[oi].data  = [{ x: r.onan, y: r.cfm_nivel_mar }];
    state.chart.data.datasets[oi].label = `Punto de operación (${(r.onan / 1000).toFixed(1)} MVA · ${formatearNumero(r.cfm_nivel_mar)} CFM)`;
  }
  state.chart.update('none');
}

/* ─── Datasets + plugin Chart.js ────────────────────────────── */

function buildDatasets() {
  return [
    ...CURVAS_GRAFICO.map(d => ({
      label: d.pct + '%', pct: d.pct, fixed: true,
      data: EJE_X_KVA.map(x => ({ x, y: interpolarPendiente(d.pct) * x })),
      borderColor: d.color, backgroundColor: 'transparent',
      borderWidth: d.w, pointRadius: 0, tension: 0
    })),
    {
      label: 'Curva interpolada (133%)', pct: 133, isInterp: true,
      data:  EJE_X_KVA.map(x => ({ x, y: interpolarPendiente(133) * x })),
      borderColor: '#0d1f38', backgroundColor: 'transparent',
      borderWidth: 3, pointRadius: 0, tension: 0
    },
    {
      label: 'Punto de operación', pct: 'op', type: 'scatter',
      data:  [{ x: 60000, y: interpolarPendiente(133) * 60000 }],
      borderColor: '#c91a14', backgroundColor: '#c91a14',
      pointRadius: 8, pointHoverRadius: 10, pointStyle: 'circle'
    }
  ];
}

const chartPlugin = {
  id: 'sgmCurveLabels',
  afterDraw(chart) {
    const ctx = chart.ctx, xs = chart.scales.x, ys = chart.scales.y;
    const ip   = chart._interpPct || 133;
    const onan = chart._onan;
    const cfm  = chart._cfm;
    const labelKva = (onan && onan >= xs.min && onan <= xs.max)
      ? Math.min(onan * 1.12, xs.max * 0.87)
      : (xs.min + xs.max) * 0.55;

    function drawLabel(slope, color, label, bold) {
      const yKva = slope * labelKva;
      if (labelKva < xs.min || labelKva > xs.max) return;
      if (yKva < ys.min || yKva > ys.max * 0.98) return;
      const px = xs.getPixelForValue(labelKva);
      const py = ys.getPixelForValue(yKva);
      const px2 = xs.getPixelForValue(Math.min(labelKva + 8000, xs.max));
      const py2 = ys.getPixelForValue(slope * Math.min(labelKva + 8000, xs.max));
      const angle = Math.atan2(py2 - py, px2 - px);
      ctx.save();
      ctx.translate(px, py - 9);
      ctx.rotate(angle);
      ctx.font = (bold ? 'bold ' : '') + '10px -apple-system, "SF Pro", Inter, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle  = 'rgba(255,255,255,0.92)';
      ctx.fillRect(-tw / 2 - 4, -12, tw + 8, 13);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 0.8;
      ctx.strokeRect(-tw / 2 - 4, -12, tw + 8, 13);
      ctx.fillStyle  = color;
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, 0, -0.5);
      ctx.restore();
    }

    ctx.save();
    // Etiquetas SOBRE las curvas fijas
    CURVAS_GRAFICO.forEach(d =>
      drawLabel(interpolarPendiente(d.pct), d.color, d.pct + '% OA RATING', d.pct === ip)
    );
    // Etiqueta de la curva interpolada (solo si difiere de las fijas)
    if (!CURVAS_GRAFICO.find(d => d.pct === ip)) {
      drawLabel(interpolarPendiente(ip), '#0d1f38', ip.toFixed(1) + '% OA RATING ◀', true);
    }

    // ── Cruceta roja: líneas dashed desde los ejes hasta el punto de
    //    operación + puntos rojos en las intersecciones + labels MVA/CFM.
    //    Replica fielmente la presentación original (Westinghouse/AFINIA).
    if (onan && cfm && onan >= xs.min && onan <= xs.max && cfm >= ys.min && cfm <= ys.max) {
      const xPx = xs.getPixelForValue(onan);
      const yPx = ys.getPixelForValue(cfm);
      const bot = chart.chartArea.bottom;
      const lft = chart.chartArea.left;

      ctx.strokeStyle = '#C00000';
      ctx.lineWidth   = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(xPx, bot); ctx.lineTo(xPx, yPx); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lft, yPx); ctx.lineTo(xPx, yPx); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#C00000';
      ctx.beginPath(); ctx.arc(xPx, bot, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(lft, yPx, 4, 0, Math.PI * 2); ctx.fill();

      ctx.font = 'bold 10px -apple-system, "SF Pro", Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${(onan / 1000).toFixed(1)} MVA`, xPx + 6, bot - 4);
      ctx.fillText(`${formatearNumero(cfm)} CFM`, lft + 6, yPx - 4);
    }
    ctx.restore();
  }
};

function initChart() {
  const cv = $('cv');
  if (!cv) return;
  if (typeof window.Chart === 'undefined') {
    // Reintenta una vez tras un pequeño delay (CDN puede tardar en parsear).
    setTimeout(() => {
      if (typeof window.Chart !== 'undefined') {
        initChart();
        upd();
      } else {
        const wrap = cv.parentElement;
        if (wrap) wrap.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:var(--ink-3);font-family:var(--font-mono);font-size:12px;text-align:center;padding:24px"><div><div style="font-size:32px;margin-bottom:8px">⚠</div>No se pudo cargar Chart.js desde el CDN.<br>Verifica tu conexión y recarga la página.</div></div>';
      }
    }, 600);
    return;
  }
  state.chart = new window.Chart(cv, {
    type: 'line',
    data: { datasets: buildDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { right: 20, left: 10, top: 20, bottom: 16 } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'linear', min: 0, max: 100000,
          title: { display: true, text: 'Potencia ONAN del transformador (MVA)', font: { size: 11, weight: 'bold' }, color: '#1f3656' },
          ticks: {
            stepSize: 500, autoSkip: true, maxTicksLimit: 60,
            maxRotation: 90, minRotation: 90, font: { size: 8 }, color: '#4d6485',
            callback(v) { return v / 1000; }
          },
          grid: {
            color(c) {
              const v = c.tick.value;
              return v % 20000 === 0 ? 'rgba(13,31,56,0.22)' : v % 10000 === 0 ? 'rgba(13,31,56,0.12)' : v % 5000 === 0 ? 'rgba(13,31,56,0.07)' : 'rgba(13,31,56,0.04)';
            },
            lineWidth(c) {
              const v = c.tick.value;
              return v % 20000 === 0 ? 1.0 : v % 10000 === 0 ? 0.65 : v % 5000 === 0 ? 0.4 : 0.25;
            },
            display: true, drawOnChartArea: true, drawTicks: false
          }
        },
        y: {
          type: 'linear', min: 0, max: 600000,
          title: { display: true, text: 'Flujo de aire requerido (CFM — ft³/min)', font: { size: 11, weight: 'bold' }, color: '#1f3656' },
          ticks: {
            stepSize: 20000, autoSkip: true, maxTicksLimit: 15,
            font: { size: 9 }, color: '#4d6485',
            callback(v) { return formatearNumero(v); }
          },
          grid: {
            color(c) {
              const v = c.tick.value, s = state.yStep || 20000;
              return v % (s * 5) === 0 ? 'rgba(13,31,56,0.22)' : v % (s * 2) === 0 ? 'rgba(13,31,56,0.12)' : 'rgba(13,31,56,0.06)';
            },
            lineWidth(c) {
              const v = c.tick.value, s = state.yStep || 20000;
              return v % (s * 5) === 0 ? 1.0 : v % (s * 2) === 0 ? 0.6 : 0.35;
            },
            display: true, drawOnChartArea: true
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { font: { size: 10, weight: '600' }, color: '#1f3656', boxWidth: 22, padding: 10 }
        },
        tooltip: {
          callbacks: {
            title: (it) => `ONAN: ${(it[0].parsed.x / 1000).toFixed(1)} MVA (${formatearNumero(it[0].parsed.x)} kVA)`,
            label: (it) => it.dataset.pct === 'op'
              ? `Punto de operación: ${formatearNumero(it.parsed.y)} CFM`
              : `${it.dataset.label}: ${formatearNumero(it.parsed.y)} CFM`
          }
        }
      }
    },
    plugins: [chartPlugin]
  });
}

/* ─── Generación del informe técnico AFINIA ─────────────────── */
//
// Replica el formato oficial "Formato Afinia.docx" en HTML/CSS:
//   · Hoja Letter (8.5″ × 11″) con márgenes 0.984″/1.18″/0.984″/1.18″.
//   · Header Afinia + footer banda azul "www.afinia.com.co" en cada
//     página, fijos vía background del .report-page.
//   · Gráfico exportado como base64 PNG (chart.toBase64Image) para que
//     se imprima como imagen única e indivisible — sin riesgo de corte.
//   · Cada bloque grande (gráfico, calculador, protección) en su propia
//     página vía `page-break-before: always` + `break-inside: avoid`.
//
// El usuario obtiene la previsualización nativa del navegador y puede
// elegir "Guardar como PDF" o imprimir físicamente.

function generateReport() {
  try {
    const win = window.open('', '_blank', 'width=1100,height=900');
    if (!win) {
      alert('Activa las ventanas emergentes para generar el informe.');
      return;
    }

    const r = calcularRefrigeracion({ kva_onan: getOnan(), pct: getPct(), alt: getAlt() });
    const proyecto = ($('proyecto')?.value || '').trim() || 'Sin nombre asignado';
    const matricula = ($('mat_input')?.value || '').trim() || '—';
    const t = {
      serie:     $('t_serie')?.value     || '—',
      sub:       $('t_sub')?.value       || '—',
      zona:      $('t_zona')?.value      || '—',
      dept:      $('t_dept')?.value      || '—',
      grupo:     $('t_grupo')?.value     || '—',
      kva:       $('t_kva')?.value       || '—',
      refrig:    $('t_refrig')?.value    || '—'
    };
    const fan = {
      marca:   $('fan_marca')?.value   || '—',
      modelo:  $('fan_modelo')?.value  || '—',
      diam:    $('fan_diam')?.value    || '—',
      rpm:     $('fan_rpm')?.value     || '—',
      cfm_nom: $('fan_cfm_nom')?.value || '—',
      hz:      $('fan_hz')?.value      || '—',
      kw:      $('fan_kw')?.value      || '—',
      amp:     $('fan_amp')?.value     || '—',
      ip:      $('fan_ip')?.value      || '—'
    };
    const rad = {
      A: $('rad_A')?.value    || '—',
      B: $('rad_B')?.value    || '—',
      C: $('rad_C')?.value    || '—',
      D: $('rad_D')?.value    || '—',
      cant:   $('rad_cant')?.value   || '—',
      obleas: $('rad_obleas')?.value || '—'
    };
    const disp = $('disposicion')?.options[$('disposicion').selectedIndex]?.text || '—';
    const conn = getMotorConn() === 'D' ? 'Δ Delta' : 'Y Estrella';
    const fechaIso = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const horaIso  = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // Snapshot del gráfico — convertir a base64 PNG con fondo blanco
    let chartImg = '';
    try {
      if (state.chart) chartImg = state.chart.toBase64Image('image/png', 1);
    } catch (err) {
      console.warn('[informe] chart snapshot failed:', err);
    }

    // Resumen del calculador de ventiladores (todas las opciones)
    const fansRows = state.fans.filter(f => f.cfm > 0).map((f, i) => {
      const c = calcularUnidadesRequeridas({ cfm_total: state.cfmReq, cfm_fan: f.cfm });
      return `<tr>
        <td class="tc">${i + 1}</td>
        <td>${escaparHtml(f.desc) || `Opción ${i + 1}`}</td>
        <td class="tr mono">${formatearNumero(f.cfm)}</td>
        <td class="tc mono"><strong>${c.n ?? '—'}</strong></td>
        <td class="tr mono">${c.n !== null ? formatearNumero(c.cfm_logrado) : '—'}</td>
        <td class="tr mono">${c.cobertura_pct !== null ? c.cobertura_pct + '%' : '—'}</td>
        <td class="tc">${c.ok ? '✓' : (c.n !== null ? '✗' : '—')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="tc" style="font-style:italic;color:#888;padding:14px">Sin opciones registradas</td></tr>';

    // Protección (solo si hay datos de fan + corriente)
    let protBlock = '<p style="font-style:italic;color:#888">Sin ficha de ventilador seleccionada para evaluar la protección.</p>';
    const iF = extraerCorrienteFan(fan.amp, getMotorConn());
    const f0 = state.fans[0];
    const nF = (f0 && f0.cfm > 0 && state.cfmReq > 0) ? Math.ceil(state.cfmReq / f0.cfm) : 0;
    if (iF !== null && Number.isFinite(iF)) {
      const p = calcularProteccionElectrica({ amps_por_fan: iF, n_fans: nF });
      protBlock = `
        <table class="rpt-table">
          <tbody>
            <tr><th>Conexión motor</th><td>${conn}</td></tr>
            <tr><th>Corriente nominal por ventilador</th><td class="mono">${iF.toFixed(2)} A</td></tr>
            <tr><th>Cantidad de ventiladores</th><td class="mono">${nF || '—'} unidades</td></tr>
            <tr><th>Corriente total del sistema</th><td class="mono">${nF ? p.amps_totales.toFixed(2) + ' A' : '—'}</td></tr>
            <tr><th>Corriente mínima del breaker (×1.25 NEC 430)</th><td class="mono">${nF ? p.amps_min_breaker.toFixed(2) + ' A' : '—'}</td></tr>
            <tr><th>Guardamotor sugerido</th><td>${p.guardamotor ? 'ABB ' + p.guardamotor.model + ' · PID ' + p.guardamotor.pid + ' · setting ' + iF.toFixed(2) + ' A' : 'Fuera de catálogo MS116'}</td></tr>
            <tr><th>Breaker principal sugerido</th><td>${p.breaker ? 'ABB ' + p.breaker.model + ' · ' + p.breaker.in + ' A · PID ' + p.breaker.pid : (nF ? 'Excede catálogo S203 (50 A)' : '—')}</td></tr>
            <tr><th>Auxiliar guardamotor (SCADA)</th><td>ABB ${p.aux_guardamotor.model} · PID ${p.aux_guardamotor.pid}</td></tr>
            <tr><th>Auxiliar breaker (SCADA)</th><td>ABB ${p.aux_breaker.model} · PID ${p.aux_breaker.pid}</td></tr>
          </tbody>
        </table>`;
    }

    const cssBase = location.origin + location.pathname.replace(/\/[^\/]*$/, '/');
    const headerImg = '../assets/img/afinia/header.png';
    const footerImg = '../assets/img/afinia/footer.png';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe técnico AFINIA — Selección ONAF — ${escaparHtml(proyecto)}</title>
<base href="${cssBase}">
<style>
  /* ── Hoja Letter conforme Formato Afinia.docx ──────────────── */
  @page { size: letter portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #888; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .report-page {
    box-sizing: border-box;
    width: 8.5in; min-height: 11in;
    margin: 0 auto 24px; background: #fff;
    position: relative; overflow: hidden;
    /* Márgenes exactos del template (twips → in): */
    padding: 1.6in 1.18in 1.4in 1.18in;
    page-break-after: always; break-after: page;
    box-shadow: 0 4px 18px rgba(0,0,0,.18);
  }
  .report-page:last-child { page-break-after: auto; break-after: auto; }
  .report-page::before {
    /* Header: logo Afinia + Grupo·epm */
    content: ""; position: absolute; left: 0; right: 0; top: 0;
    height: 1.5in;
    background: url("${headerImg}") no-repeat center top;
    background-size: 100% auto;
  }
  .report-page::after {
    /* Footer: banda azul + URL */
    content: ""; position: absolute; left: 0; right: 0; bottom: 0.30in;
    height: 0.85in;
    background: url("${footerImg}") no-repeat center bottom;
    background-size: 100% auto;
  }
  .footer-text {
    position: absolute; left: 1.18in; right: 1.18in; bottom: 0.10in;
    font-size: 8pt; color: #555; text-align: center;
  }

  /* ── Tipografía ────────────────────────────────────────────── */
  h1 { font-size: 18pt; margin: 0 0 4pt; color: #0d3a73; letter-spacing: -.01em; }
  h2 { font-size: 13pt; margin: 14pt 0 6pt; color: #0d3a73; padding-bottom: 4pt; border-bottom: 1px solid #5ba4d4; }
  h3 { font-size: 11pt; margin: 10pt 0 4pt; color: #0d3a73; }
  p, td, th { font-size: 10pt; line-height: 1.45; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 4pt; }
  .mono { font-family: "Consolas", "Courier New", monospace; font-variant-numeric: tabular-nums; }
  .tc { text-align: center; }
  .tr { text-align: right; }

  .cover-block {
    margin-top: 12pt;
    padding: 16pt 18pt; border-radius: 6pt;
    background: linear-gradient(135deg, #e3f2fd 0%, #f5fafd 100%);
    border: 1px solid #90caf9;
  }
  .cover-block h1 { color: #0d3a73; }
  .cover-block .proj { font-size: 13pt; font-weight: 600; color: #1258a0; margin-top: 6pt; }
  .cover-block .ref  { font-size: 9pt; color: #555; margin-top: 4pt; line-height: 1.5; }

  /* ── KPIs ──────────────────────────────────────────────────── */
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8pt; margin: 10pt 0; }
  .kpi-card {
    border: 1px solid #b0cce8; border-radius: 5pt;
    padding: 8pt 10pt; background: #f0f7ff;
    border-left: 3pt solid #0d47a1;
  }
  .kpi-card.cfm { background: #f0fafd; border-left-color: #0277bd; }
  .kpi-card.alt { background: #f0fdf6; border-left-color: #1b5e20; }
  .kpi-card .l { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #555; margin-bottom: 4pt; }
  .kpi-card .v { font-size: 13pt; font-weight: 700; color: #0d3a73; }

  /* ── Tablas de datos ───────────────────────────────────────── */
  .rpt-table { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; }
  .rpt-table th, .rpt-table td { padding: 4pt 8pt; border-bottom: 1px solid #d8e3f0; vertical-align: top; }
  .rpt-table th { text-align: left; background: #ddeaf7; color: #0d3a73; font-weight: 600; font-size: 9pt; width: 40%; }
  .rpt-table td { font-size: 10pt; }
  .ft { width: 100%; border-collapse: collapse; margin-top: 6pt; }
  .ft th { background: #0d3a73; color: #fff; padding: 5pt 7pt; text-align: left; font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .ft td { padding: 5pt 7pt; border-bottom: 1px solid #e0e8f3; font-size: 10pt; }
  .ft tr:nth-child(even) td { background: #f8fbff; }

  .info-box {
    margin: 8pt 0; padding: 10pt 14pt; border-radius: 5pt;
    background: #fff8e1; border: 1px solid #ffe082;
    font-size: 9.5pt; color: #5d4037;
  }
  .info-box strong { color: #b85f00; }

  /* ── Página del gráfico (imagen completa, sin corte) ───────── */
  .chart-page-wrap {
    display: flex; align-items: center; justify-content: center;
    min-height: calc(11in - 1.6in - 1.4in);  /* área interior */
  }
  .chart-img {
    width: 100%; max-width: 6.5in; height: auto;
    border: 1px solid #b0cce8; border-radius: 5pt;
    background: #fff;
  }

  /* ── Print ─────────────────────────────────────────────────── */
  @media print {
    html, body { background: #fff; }
    .report-page { margin: 0; box-shadow: none; }
    .no-print { display: none !important; }
  }

  .toolbar {
    position: fixed; top: 12px; right: 12px;
    display: flex; gap: 8px; z-index: 999;
    background: rgba(255,255,255,.95);
    padding: 8px 10px; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,.18);
  }
  .toolbar button {
    padding: 8px 14px; border: 0; border-radius: 6px;
    background: #0d47a1; color: #fff; font: 600 12px Arial, sans-serif; cursor: pointer;
  }
  .toolbar button.sec { background: #fff; color: #0d47a1; border: 1px solid #0d47a1; }
  .toolbar button:hover { opacity: .92; }
</style>
</head>
<body>

<div class="toolbar no-print">
  <button onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
  <button class="sec" onclick="window.close()">Cerrar</button>
</div>

<!-- ══════════ PÁGINA 1 · CARÁTULA + IDENTIFICACIÓN ══════════ -->
<section class="report-page">
  <div class="cover-block">
    <div class="meta">CARIBEMAR DE LA COSTA S.A.S E.S.P · AFINIA Grupo EPM</div>
    <h1>Informe técnico de selección ONAF</h1>
    <div class="proj">${escaparHtml(proyecto)}</div>
    <div class="ref">
      <strong>Generado:</strong> ${fechaIso} · ${horaIso}<br>
      <strong>Normativas:</strong> IEEE C57.12.00-2015 · ANSI C57.12.91 · IEEE C57.91-2011 · Westinghouse T&amp;D Reference
    </div>
  </div>

  <h2>Identificación del transformador</h2>
  <table class="rpt-table">
    <tbody>
      <tr><th>Matrícula</th><td><strong>${escaparHtml(matricula)}</strong></td></tr>
      <tr><th>Serie</th><td>${escaparHtml(t.serie)}</td></tr>
      <tr><th>Subestación</th><td>${escaparHtml(t.sub)}</td></tr>
      <tr><th>Zona</th><td>${escaparHtml(t.zona)}</td></tr>
      <tr><th>Departamento</th><td>${escaparHtml(t.dept)}</td></tr>
      <tr><th>Grupo</th><td>${escaparHtml(t.grupo)}</td></tr>
      <tr><th>Potencia placa</th><td>${escaparHtml(t.kva)}</td></tr>
      <tr><th>Refrigeración actual</th><td>${escaparHtml(t.refrig)}</td></tr>
    </tbody>
  </table>

  <h2>Parámetros del cálculo</h2>
  <table class="rpt-table">
    <tbody>
      <tr><th>Potencia ONAN base</th><td class="mono">${formatearNumero(r.onan)} kVA</td></tr>
      <tr><th>Potencia ONAF objetivo</th><td class="mono">${formatearNumero(r.onaf)} kVA</td></tr>
      <tr><th>Δ Potencia adicional</th><td class="mono">${formatearNumero(r.delta)} kVA</td></tr>
      <tr><th>Factor ONAF/ONAN</th><td class="mono">${getPct().toFixed(1)} %</td></tr>
      <tr><th>Pendiente Westinghouse</th><td class="mono">${r.pendiente.toFixed(3)} CFM/kVA</td></tr>
      <tr><th>Altitud</th><td class="mono">${getAlt()} m s.n.m.</td></tr>
      <tr><th>Factor corrección densidad ISA</th><td class="mono">${r.factor_altitud.toFixed(4)}</td></tr>
    </tbody>
  </table>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="l">ONAN</div><div class="v">${formatearNumero(r.onan)} kVA</div></div>
    <div class="kpi-card"><div class="l">ONAF</div><div class="v">${formatearNumero(r.onaf)} kVA</div></div>
    <div class="kpi-card"><div class="l">Δ Potencia</div><div class="v">${formatearNumero(r.delta)} kVA</div></div>
    <div class="kpi-card cfm"><div class="l">CFM nivel mar</div><div class="v">${formatearNumero(r.cfm_nivel_mar)}</div></div>
    <div class="kpi-card alt"><div class="l">CFM altitud</div><div class="v">${formatearNumero(r.cfm_corregido)}</div></div>
  </div>

  <div class="footer-text">CaribeMar de la Costa S.A.S E.S.P. / Carrera 13B #26 – 78 Edificio Chambacú – Piso 1 / Cartagena.</div>
</section>

<!-- ══════════ PÁGINA 2 · GRÁFICO COMPLETO ══════════ -->
<section class="report-page">
  <h2>Curvas de enfriamiento adicional ONAF — flujo de aire requerido</h2>
  <p class="meta">Punto de operación: <strong class="mono">${(r.onan / 1000).toFixed(1)} MVA · ${formatearNumero(r.cfm_nivel_mar)} CFM</strong> · pendiente Westinghouse <strong class="mono">${r.pendiente.toFixed(3)} CFM/kVA</strong> al ${getPct().toFixed(1)} %.</p>
  <div class="chart-page-wrap">
    ${chartImg
      ? `<img class="chart-img" src="${chartImg}" alt="Curvas de enfriamiento ONAF">`
      : `<div style="padding:40pt;text-align:center;color:#888;font-style:italic">Gráfico no disponible (Chart.js no se cargó). Reintente desde la calculadora con conexión activa.</div>`}
  </div>
  <div class="info-box">
    <strong>Lectura del gráfico:</strong> los segmentos rojos punteados indican la
    proyección del punto de operación sobre los ejes — potencia ONAN y CFM
    requerido al nivel de mar. Las cuatro curvas fijas (115 / 125 / 133 / 166 %)
    son los pares calibrados Westinghouse T&amp;D Reference. La curva oscura es la
    interpolación lineal al porcentaje seleccionado.
  </div>
  <div class="footer-text">CaribeMar de la Costa S.A.S E.S.P. / Carrera 13B #26 – 78 Edificio Chambacú – Piso 1 / Cartagena.</div>
</section>

<!-- ══════════ PÁGINA 3 · DATOS MECÁNICOS Y VENTILADOR ══════════ -->
<section class="report-page">
  <h2>Datos mecánicos del cuerpo de radiador</h2>
  <table class="rpt-table">
    <tbody>
      <tr><th>A — Altura del cuerpo (mm)</th><td class="mono">${escaparHtml(rad.A)}</td></tr>
      <tr><th>B — Distancia oblea inicial–final (mm)</th><td class="mono">${escaparHtml(rad.B)}</td></tr>
      <tr><th>C — Ancho de frente (mm)</th><td class="mono">${escaparHtml(rad.C)}</td></tr>
      <tr><th>D — Distancia entre tornillos del flanche (mm)</th><td class="mono">${escaparHtml(rad.D)}</td></tr>
      <tr><th>Cantidad de radiadores</th><td class="mono">${escaparHtml(rad.cant)}</td></tr>
      <tr><th>Obleas por radiador</th><td class="mono">${escaparHtml(rad.obleas)}</td></tr>
      <tr><th>Disposición mecánica del ventilador</th><td>${escaparHtml(disp)}</td></tr>
    </tbody>
  </table>

  <h2>Datos del motoventilador</h2>
  <table class="rpt-table">
    <tbody>
      <tr><th>Marca</th><td>${escaparHtml(fan.marca)}</td></tr>
      <tr><th>Modelo / Referencia</th><td>${escaparHtml(fan.modelo)}</td></tr>
      <tr><th>Diámetro nominal (mm)</th><td class="mono">${escaparHtml(fan.diam)}</td></tr>
      <tr><th>RPM nominal</th><td class="mono">${escaparHtml(fan.rpm)}</td></tr>
      <tr><th>CFM nominal (ft³/min)</th><td class="mono">${escaparHtml(fan.cfm_nom)}</td></tr>
      <tr><th>Frecuencia</th><td class="mono">${escaparHtml(fan.hz)} Hz</td></tr>
      <tr><th>Potencia absorbida P₁</th><td class="mono">${escaparHtml(fan.kw)} W</td></tr>
      <tr><th>Corriente nominal</th><td class="mono">${escaparHtml(fan.amp)}</td></tr>
      <tr><th>Grado de protección</th><td>${escaparHtml(fan.ip)}</td></tr>
    </tbody>
  </table>

  <div class="footer-text">CaribeMar de la Costa S.A.S E.S.P. / Carrera 13B #26 – 78 Edificio Chambacú – Piso 1 / Cartagena.</div>
</section>

<!-- ══════════ PÁGINA 4 · CALCULADOR DE VENTILADORES ══════════ -->
<section class="report-page">
  <h2>Selección de motoventiladores · N = ⌈ CFM<sub>total</sub> / CFM<sub>fan</sub> ⌉</h2>
  <p class="meta">CFM requerido a nivel del mar: <strong class="mono">${formatearNumero(r.cfm_nivel_mar)} CFM</strong> · CFM corregido por altitud (${getAlt()} m): <strong class="mono">${formatearNumero(r.cfm_corregido)} CFM</strong></p>
  <table class="ft">
    <thead>
      <tr>
        <th class="tc" style="width:30px">#</th>
        <th>Descripción / modelo</th>
        <th class="tr" style="width:90px">CFM/fan</th>
        <th class="tc" style="width:65px">Unidades</th>
        <th class="tr" style="width:90px">CFM logrado</th>
        <th class="tr" style="width:70px">Cobertura</th>
        <th class="tc" style="width:40px">OK</th>
      </tr>
    </thead>
    <tbody>${fansRows}</tbody>
  </table>

  <h2>Protección eléctrica</h2>
  ${protBlock}

  <div class="info-box" style="margin-top:14pt">
    Documento generado automáticamente por SGM · TRANSPOWER. La validación
    final del diseño debe ser revisada por el ingeniero responsable conforme
    a IEEE C57.91 (cargabilidad) y al criterio de operación de la red AFINIA.
  </div>

  <div class="footer-text">CaribeMar de la Costa S.A.S E.S.P. / Carrera 13B #26 – 78 Edificio Chambacú – Piso 1 / Cartagena.</div>
</section>

<script>
  // Auto-print una vez que las imágenes hayan cargado.
  window.addEventListener('load', () => {
    let pending = document.images.length;
    if (pending === 0) { setTimeout(() => window.print(), 250); return; }
    for (const img of document.images) {
      if (img.complete) pending--; else img.addEventListener('load', () => { pending--; if (pending === 0) setTimeout(() => window.print(), 250); }, { once: true });
      img.addEventListener('error', () => { pending--; if (pending === 0) setTimeout(() => window.print(), 250); }, { once: true });
    }
    if (pending === 0) setTimeout(() => window.print(), 250);
  });
</script>

</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (err) {
    console.error('[informe] generación falló:', err);
    alert('No se pudo generar el informe. Detalle: ' + (err && err.message || err));
  }
}

/* ─── Cableado de eventos ───────────────────────────────────── */

function bindEvents() {
  $('mat_input')?.addEventListener('change', onMatChange);

  // Inputs numéricos críticos: validar rango + propagar al cálculo.
  const wrapNumeric = (id, handler) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => { validarRangoInput(el); handler(); });
    el.addEventListener('blur',  () => validarRangoInput(el));
  };
  wrapNumeric('kva_onan', onOnanCh);
  wrapNumeric('kva_onaf', onOnafCh);
  wrapNumeric('pct',      onPctCh);
  wrapNumeric('alt',      upd);

  $('x_min')?.addEventListener('input', applyRange);
  $('x_max')?.addEventListener('input', applyRange);
  $('y_min')?.addEventListener('input', applyRange);
  $('y_max')?.addEventListener('input', applyRange);
  $('btnAutoRange')?.addEventListener('click', autoRange);

  ['rad_A', 'rad_B', 'rad_C', 'rad_D', 'fan_diam', 'mon_dist'].forEach(id =>
    $(id)?.addEventListener('input', checkCompat)
  );
  $('disposicion')?.addEventListener('change', checkCompat);

  $('fan_db_sel')?.addEventListener('change', onFanSelect);
  $('fan_flow_val')?.addEventListener('input', syncCfm);
  $('fan_flow_unit')?.addEventListener('change', syncCfm);

  $('conn_D')?.addEventListener('change', calcProtection);
  $('conn_Y')?.addEventListener('change', calcProtection);

  $('btnAddFan')?.addEventListener('click', addFan);
  $('btnExportReport')?.addEventListener('click', generateReport);
  $('btnPrint')?.addEventListener('click', () => window.print());

  // Delegación para inputs y botones generados dinámicamente en la tabla.
  $('fan-tbody')?.addEventListener('input', (e) => {
    const cfmId  = e.target?.dataset?.fanCfm;
    const descId = e.target?.dataset?.fanDesc;
    if (cfmId) {
      const id = +cfmId;
      const f = state.fans.find(x => x.id === id);
      if (f) { f.cfm = +e.target.value || 0; updateCells(); }
    } else if (descId) {
      const id = +descId;
      const f = state.fans.find(x => x.id === id);
      if (f) f.desc = e.target.value;
    }
  });
  $('fan-tbody')?.addEventListener('click', (e) => {
    const rid = e.target?.closest?.('[data-fan-remove]')?.dataset?.fanRemove;
    if (rid) removeFan(+rid);
  });
}

/* ─── Reveal por scroll ─────────────────────────────────────── */

function bindReveal() {
  if (_prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
    document.querySelectorAll('.calc-section, .mec-sect, .kpis, .cw, .fan-hdr')
      .forEach(el => el.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
  document.querySelectorAll('.calc-section, .mec-sect, .kpis, .cw, .fan-hdr').forEach(el => io.observe(el));
}

/* ─── Bootstrap ─────────────────────────────────────────────── */

async function init() {
  try {
    await initMatSelect();
    bindEvents();
    initChart();
    renderFans();
    upd();
    await calcProtection();
    bindReveal();
  } catch (err) {
    console.error('[calculo-refrigeracion] init error:', err);
    // Mostrar mensaje al usuario sin colgarse
    const root = $('calcRefrigeracionRoot');
    if (root) {
      const banner = document.createElement('div');
      banner.className = 'calc-note';
      banner.style.borderColor = 'rgba(255,59,48,.30)';
      banner.style.background  = 'rgba(255,59,48,.05)';
      banner.innerHTML = `<strong>⚠ Error de inicialización:</strong> ${escaparHtml(err && err.message || String(err))}. Algunas funciones pueden estar limitadas.`;
      root.insertBefore(banner, root.firstElementChild?.nextSibling || null);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
