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
//   · Gráfico exportado como base64 PNG (chart.toBase64Image) — se
//     trata como bloque "break-inside: avoid": fluye naturalmente y
//     si no cabe en la hoja actual, se imprime ÍNTEGRO en la siguiente
//     (NO se le dedica una hoja exclusiva).
//   · Resto de bloques (KPIs, tablas, ficha radiador, ficha motor,
//     compatibilidad, montaje, calculador, protección, materiales)
//     llevan también break-inside: avoid · contenido sigue su orden
//     natural sin saltos forzados ni hojas en blanco.
//
// El usuario obtiene la previsualización nativa del navegador y puede
// elegir "Guardar como PDF" o imprimir físicamente.

function _val(id) {
  const el = $(id);
  if (!el) return '';
  if (el.tagName === 'SELECT') {
    const opt = el.options[el.selectedIndex];
    return (opt && opt.text) || el.value || '';
  }
  return el.value || '';
}
function _row(label, value, mono = false) {
  const v = (value === undefined || value === null || value === '') ? '—' : String(value);
  return `<tr><th>${escaparHtml(label)}</th><td${mono ? ' class="mono"' : ''}>${escaparHtml(v)}</td></tr>`;
}

/* SVG con la vista CAD del cuerpo de radiador (frontal + perspectiva)
   con dimensiones A/B/C/D codificadas por color, replicando el modelo
   de referencia AFINIA original. ViewBox extendido en Y negativo para
   que las cotas D (arriba) y B (arriba) no queden recortadas. */
function radiadorDiagramSVG() {
  return `<svg viewBox="0 -30 720 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagrama de referencia del cuerpo de radiador">
    <!-- ── VISTA FRONTAL (cuerpo de obleas) ── -->
    <g transform="translate(20, 20)">
      <!-- Obleas (rectángulos verticales paralelos) -->
      <rect x="0" y="22" width="240" height="220" fill="none" stroke="#222" stroke-width="0.8"/>
      <g stroke="#444" stroke-width="0.55" fill="none">
        ${Array.from({length: 22}, (_, i) => {
          const x = 8 + i * 11;
          return `<line x1="${x}" y1="28" x2="${x}" y2="236"/>`;
        }).join('')}
      </g>
      <!-- Cabezales superior e inferior (codos/flanches) -->
      <rect x="-14" y="6"   width="22" height="24" fill="none" stroke="#222" stroke-width="0.8"/>
      <rect x="-14" y="234" width="22" height="24" fill="none" stroke="#222" stroke-width="0.8"/>
      <rect x="232" y="6"   width="22" height="24" fill="none" stroke="#222" stroke-width="0.8"/>
      <rect x="232" y="234" width="22" height="24" fill="none" stroke="#222" stroke-width="0.8"/>
      <!-- Tubería conectora vertical izquierda y derecha -->
      <line x1="-3" y1="30" x2="-3" y2="234" stroke="#222" stroke-width="0.6"/>
      <line x1="243" y1="30" x2="243" y2="234" stroke="#222" stroke-width="0.6"/>

      <!-- Dim B (verde) — distancia oblea inicial a oblea final, ARRIBA -->
      <g stroke="#2e7d32" stroke-width="1.2" fill="#2e7d32">
        <line x1="8"   y1="-18" x2="8"   y2="22"/>
        <line x1="239" y1="-18" x2="239" y2="22"/>
        <line x1="8"   y1="-12" x2="239" y2="-12"/>
        <polygon points="8,-12 14,-15 14,-9"/>
        <polygon points="239,-12 233,-15 233,-9"/>
      </g>
      <text x="124" y="-22" text-anchor="middle" fill="#2e7d32" font-size="22" font-weight="bold" font-family="Arial">B</text>

      <!-- Dim A (rojo) — altura cuerpo radiador, lado derecho -->
      <g stroke="#c62828" stroke-width="1.2" fill="#c62828">
        <line x1="270" y1="22"  x2="282" y2="22"/>
        <line x1="270" y1="242" x2="282" y2="242"/>
        <line x1="276" y1="22"  x2="276" y2="242"/>
        <polygon points="276,22 273,28 279,28"/>
        <polygon points="276,242 273,236 279,236"/>
      </g>
      <text x="293" y="138" fill="#c62828" font-size="22" font-weight="bold" font-family="Arial">A</text>
    </g>

    <!-- ── VISTA EN PERSPECTIVA (cuerpo + flanche) ── -->
    <g transform="translate(420, 20)">
      <!-- Cuerpo principal en perspectiva isométrica -->
      <polygon points="20,40 130,40 145,28 35,28" fill="#fff" stroke="#222" stroke-width="0.8"/>
      <polygon points="130,40 145,28 145,238 130,250" fill="#f8f8f8" stroke="#222" stroke-width="0.8"/>
      <polygon points="20,40 130,40 130,250 20,250" fill="#fff" stroke="#222" stroke-width="0.8"/>
      <!-- Aletas del frente -->
      <g stroke="#888" stroke-width="0.4" fill="none">
        ${Array.from({length: 20}, (_, i) => {
          const x = 24 + i * 5.5;
          return `<line x1="${x}" y1="44" x2="${x}" y2="248"/>`;
        }).join('')}
      </g>
      <!-- Tornillos del flanche superior + brackets -->
      <rect x="125" y="10" width="36" height="20" fill="none" stroke="#222" stroke-width="0.6"/>
      <circle cx="135" cy="20" r="2.5" fill="#0288d1"/>
      <circle cx="155" cy="20" r="2.5" fill="#0288d1"/>

      <!-- Dim C (rojo) — ancho de frente, lado izquierdo -->
      <g stroke="#c62828" stroke-width="1.2" fill="#c62828">
        <line x1="6"  y1="40"  x2="18" y2="40"/>
        <line x1="6"  y1="250" x2="18" y2="250"/>
        <line x1="12" y1="40"  x2="12" y2="250"/>
        <polygon points="12,40 9,46 15,46"/>
        <polygon points="12,250 9,244 15,244"/>
      </g>
      <text x="-8" y="148" fill="#c62828" font-size="22" font-weight="bold" font-family="Arial">C</text>

      <!-- Dim D (cian) — distancia entre centros de tornillos · ARRIBA -->
      <g stroke="#0288d1" stroke-width="1.4" fill="#0288d1">
        <line x1="135" y1="-12" x2="135" y2="20"/>
        <line x1="155" y1="-12" x2="155" y2="20"/>
        <line x1="135" y1="-6"  x2="155" y2="-6"/>
        <polygon points="135,-6 141,-9 141,-3"/>
        <polygon points="155,-6 149,-9 149,-3"/>
      </g>
      <text x="145" y="-18" text-anchor="middle" fill="#0288d1" font-size="22" font-weight="bold" font-family="Arial">D</text>
    </g>
  </svg>`;
}

function generateReport() {
  try {
    const win = window.open('', '_blank', 'width=1100,height=900');
    if (!win) {
      alert('Activa las ventanas emergentes para generar el informe.');
      return;
    }

    const r = calcularRefrigeracion({ kva_onan: getOnan(), pct: getPct(), alt: getAlt() });
    const proyecto  = (_val('proyecto').trim()) || 'Sin nombre asignado';
    const matricula = (_val('mat_input').trim()) || '—';

    // Lectura completa del formulario (todos los IDs originales)
    const t = {
      serie:  _val('t_serie'),  sub:   _val('t_sub'),    zona: _val('t_zona'),
      dept:   _val('t_dept'),   grupo: _val('t_grupo'),  kva:  _val('t_kva'),
      refrig: _val('t_refrig')
    };
    const rad = {
      A: _val('rad_A'), B: _val('rad_B'), C: _val('rad_C'), D: _val('rad_D'),
      cant:   _val('rad_cant'),
      obleas: _val('rad_obleas'),
      otras:  _val('rad_otras')
    };
    const fan = {
      marca:    _val('fan_marca'),    modelo:   _val('fan_modelo'),
      nserie:   _val('fan_nserie'),   tipo:     _val('fan_tipo_pala'),
      diam:     _val('fan_diam'),     aspas:    _val('fan_aspas'),
      rpm:      _val('fan_rpm'),      montaje:  _val('fan_montaje'),
      peso:     _val('fan_peso'),     flow_val: _val('fan_flow_val'),
      flow_unit: _val('fan_flow_unit'),
      cfm_nom:  _val('fan_cfm_nom'),  m3s:      _val('fan_m3s'),
      volt:     _val('fan_volt'),     hz:       _val('fan_hz'),
      kw:       _val('fan_kw'),       amp:      _val('fan_amp'),
      cosphi:   _val('fan_cosphi'),   ip:       _val('fan_ip'),
      aislam:   _val('fan_aislam'),   protmotor: _val('fan_protmotor'),
      tmin:     _val('fan_tmin'),     sentido:  _val('fan_sentido'),
      cert:     _val('fan_cert'),     material: _val('fan_material')
    };
    const mon = {
      tipo_fij:  _val('mon_tipo_fij'),  flujo_dir: _val('mon_flujo_dir'),
      marco:     _val('mon_marco'),     npuntos:   _val('mon_npuntos'),
      tornillos: _val('mon_tornillos'), dist:      _val('mon_dist'),
      junta:     _val('mon_junta'),     obs:       _val('mon_obs')
    };
    const disp = _val('disposicion').trim() || '—';
    const conn = getMotorConn() === 'D' ? 'Δ Delta (D)' : 'Y Estrella (Y)';
    const fechaIso = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const horaIso  = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // Snapshot del gráfico — convertir a base64 PNG con fondo blanco
    let chartImg = '';
    try {
      if (state.chart) chartImg = state.chart.toBase64Image('image/png', 1);
    } catch (err) {
      console.warn('[informe] chart snapshot failed:', err);
    }

    // Compatibilidad mecánica · vista completa (4 criterios + resumen)
    const compat = evaluarCompatibilidad({
      A: parseFloat(rad.A), B: parseFloat(rad.B), C: parseFloat(rad.C),
      diametro_mm: parseFloat(fan.diam), distancia_mm: parseFloat(mon.dist),
      disposicion: _val('disposicion')
    });
    const compatRow = (n, c, titleFallback) => `
      <tr>
        <td><strong>${n}</strong> · ${escaparHtml(c.title || titleFallback)}</td>
        <td>${escaparHtml(c.val || '—')}</td>
        <td><span class="estado est-${c.estado}">${c.estado.toUpperCase()}</span></td>
        <td>${escaparHtml(c.desc || '—')}</td>
      </tr>`;

    // Tabla del calculador de ventiladores
    const fanRows = state.fans.map((f, i) => {
      const c = calcularUnidadesRequeridas({ cfm_total: state.cfmReq, cfm_fan: f.cfm });
      return `<tr>
        <td class="tc">${i + 1}</td>
        <td>${escaparHtml(f.desc) || `Opción ${i + 1}`}</td>
        <td class="tr mono">${f.cfm > 0 ? formatearNumero(f.cfm) : '—'}</td>
        <td class="tc mono"><strong>${c.n ?? '—'}</strong></td>
        <td class="tr mono">${c.n !== null ? formatearNumero(c.cfm_logrado) : '—'}</td>
        <td class="tr mono">${c.cobertura_pct !== null ? c.cobertura_pct + '%' : '—'}</td>
        <td class="tr mono">${c.n !== null ? formatearNumero(c.exceso) : '—'}</td>
        <td class="tc">${c.n !== null ? (c.ok ? '<span class="ok">✓</span>' : '<span class="ko">✗</span>') : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="8" class="tc" style="font-style:italic;color:#888;padding:14px">Sin opciones registradas</td></tr>';

    // Mejor opción (la de menor número de unidades que cumple)
    const fanResults = state.fans
      .map(f => ({ f, ...calcularUnidadesRequeridas({ cfm_total: state.cfmReq, cfm_fan: f.cfm }) }))
      .filter(r => r.ok);
    const best = fanResults.length ? fanResults.reduce((a, b) => b.n < a.n ? b : a) : null;

    // Protección eléctrica (solo si hay datos)
    const iF = extraerCorrienteFan(fan.amp, getMotorConn());
    const f0 = state.fans[0];
    const nF = (f0 && f0.cfm > 0 && state.cfmReq > 0) ? Math.ceil(state.cfmReq / f0.cfm) : 0;
    let protBlock, materiales;
    if (iF !== null && Number.isFinite(iF) && nF > 0) {
      const p = calcularProteccionElectrica({ amps_por_fan: iF, n_fans: nF });
      const kwTot = parseFloat(fan.kw) ? (parseFloat(fan.kw) * nF / 1000).toFixed(2) : '—';
      const pesoTot = parseFloat(fan.peso) ? (parseFloat(fan.peso) * nF).toFixed(1) : '—';
      const cosphi = parseFloat(fan.cosphi) || null;
      const kvaTot = (parseFloat(fan.kw) && cosphi) ? (parseFloat(fan.kw) * nF / cosphi / 1000).toFixed(2) : null;
      protBlock = `
        <table class="rpt-table">
          <tbody>
            ${_row('Conexión motor', conn)}
            ${_row('Corriente nominal por ventilador', iF.toFixed(2) + ' A', true)}
            ${_row('Cantidad de ventiladores', nF + ' unidades', true)}
            ${_row('Corriente total del sistema', p.amps_totales.toFixed(2) + ' A', true)}
            ${_row('Corriente mínima del breaker (×1.25 NEC 430)', p.amps_min_breaker.toFixed(2) + ' A', true)}
            ${_row('Potencia eléctrica total absorbida', kwTot + ' kW', true)}
            ${kvaTot ? _row('Potencia aparente total (S = P/cos φ)', kvaTot + ' kVA', true) : ''}
            ${_row('Peso total motoventiladores', pesoTot + ' kg', true)}
            ${_row('Guardamotor sugerido', p.guardamotor ? `ABB ${p.guardamotor.model} · PID ${p.guardamotor.pid} · setting ${iF.toFixed(2)} A` : 'Fuera de catálogo MS116')}
            ${_row('Breaker principal sugerido', p.breaker ? `ABB ${p.breaker.model} · ${p.breaker.in} A · PID ${p.breaker.pid} · pérdidas ${p.breaker.power_w} W` : 'Excede catálogo S203 (50 A) — consultar familia superior')}
            ${_row('Auxiliar guardamotor (SCADA)', `ABB ${p.aux_guardamotor.model} · PID ${p.aux_guardamotor.pid}`)}
            ${_row('Auxiliar breaker (SCADA)', `ABB ${p.aux_breaker.model} · PID ${p.aux_breaker.pid}`)}
          </tbody>
        </table>`;
      // Lista de materiales con cantidades y PIDs
      const items = [
        { qty: nF, model: `Motoventilador ${escaparHtml(fan.marca)} ${escaparHtml(fan.modelo)}`, pid: escaparHtml(fan.nserie || '—'), notes: `${fan.diam || '?'} mm Ø · ${fan.cfm_nom || '?'} CFM · ${fan.hz || '?'} Hz` },
        ...(p.guardamotor ? [{ qty: nF, model: `Guardamotor ABB ${p.guardamotor.model}`, pid: p.guardamotor.pid, notes: `Rango ajuste ${p.guardamotor.min}–${p.guardamotor.max} A · setting ${iF.toFixed(2)} A` }] : []),
        ...(p.aux_guardamotor ? [{ qty: nF, model: `Auxiliar guardamotor ABB ${p.aux_guardamotor.model}`, pid: p.aux_guardamotor.pid, notes: p.aux_guardamotor.desc }] : []),
        ...(p.breaker ? [{ qty: 1, model: `Breaker principal ABB ${p.breaker.model}`, pid: p.breaker.pid, notes: `In ${p.breaker.in} A · 3P · Curva C · 6 kA · pérdidas ${p.breaker.power_w} W` }] : []),
        { qty: 1, model: `Auxiliar breaker ABB ${p.aux_breaker.model}`, pid: p.aux_breaker.pid, notes: p.aux_breaker.desc }
      ];
      materiales = `
        <table class="ft">
          <thead>
            <tr>
              <th class="tc" style="width:30px">#</th>
              <th class="tc" style="width:50px">Cant.</th>
              <th>Componente</th>
              <th style="width:140px">PID / Ref.</th>
              <th>Especificación</th>
            </tr>
          </thead>
          <tbody>${items.map((it, i) => `
            <tr>
              <td class="tc">${i + 1}</td>
              <td class="tc mono"><strong>${it.qty}</strong></td>
              <td>${it.model}</td>
              <td class="mono">${it.pid}</td>
              <td>${it.notes}</td>
            </tr>`).join('')}</tbody>
        </table>`;
    } else {
      protBlock  = '<p style="font-style:italic;color:#888">Sin ficha de ventilador completa para evaluar la protección eléctrica.</p>';
      materiales = '<p style="font-style:italic;color:#888">Lista de materiales no disponible — complete la ficha del ventilador y los parámetros del cálculo.</p>';
    }

    // Pre-cómputos para mostrar fórmulas con valores reales sustituidos
    const onanFmt = formatearNumero(r.onan);
    const cfmFmt  = formatearNumero(r.cfm_nivel_mar);
    const cfmAlt  = formatearNumero(r.cfm_corregido);
    const altFmt  = formatearNumero(getAlt());
    const fAltFmt = r.factor_altitud.toFixed(4);
    const slopeFmt= r.pendiente.toFixed(3);
    const pctFmt  = getPct().toFixed(1);
    // Para §8 — fórmula N aplicada con la mejor opción si existe
    const formulaSeleccion = best
      ? `<div class="formula-box">
           <div class="l">Fórmula aplicada</div>
           <div class="sym">N = ⌈ CFM<sub>total</sub> ÷ CFM<sub>fan</sub> ⌉</div>
           <div class="apply">N = ⌈ ${formatearNumero(state.cfmReq)} ÷ ${formatearNumero(best.f.cfm)} ⌉ <span class="arrow">→</span> N = <span class="res">${best.n} unidades</span></div>
           <div class="apply">CFM logrado = ${best.n} × ${formatearNumero(best.f.cfm)} = <span class="res">${formatearNumero(best.cfm_logrado)} CFM</span> · cobertura <span class="res">${best.cobertura_pct}%</span></div>
         </div>`
      : `<div class="formula-box">
           <div class="l">Fórmula aplicable</div>
           <div class="sym">N = ⌈ CFM<sub>total</sub> ÷ CFM<sub>fan</sub> ⌉</div>
           <div class="apply">Cargue al menos una opción de ventilador con CFM válido para sustituir.</div>
         </div>`;

    // §3 — fórmulas del cálculo de refrigeración aplicadas
    const formulaCalc = `
      <div class="formula-box">
        <div class="l">Pendiente Westinghouse interpolada</div>
        <div class="sym">m(p) = m₁ + (m₂ − m₁) · (p − p₁) / (p₂ − p₁)</div>
        <div class="apply">m(${pctFmt}%) = <span class="res">${slopeFmt} CFM/kVA</span> · interpolación lineal entre los puntos calibrados (115/125/133/166%)</div>
      </div>
      <div class="formula-box">
        <div class="l">CFM requerido al nivel del mar</div>
        <div class="sym">CFM₀ = m(p) × kVA<sub>ONAN</sub></div>
        <div class="apply">CFM₀ = ${slopeFmt} × ${onanFmt} kVA <span class="arrow">→</span> <span class="res">${cfmFmt} CFM</span></div>
      </div>
      <div class="formula-box">
        <div class="l">Factor de corrección por altitud (modelo ISA)</div>
        <div class="sym">F<sub>alt</sub> = e<sup>(h / 8500)</sup>&nbsp;&nbsp;&nbsp;&nbsp;CFM<sub>alt</sub> = CFM₀ × F<sub>alt</sub></div>
        <div class="apply">F<sub>alt</sub> = e<sup>(${altFmt} / 8500)</sup> = <span class="res">${fAltFmt}</span></div>
        <div class="apply">CFM<sub>alt</sub> = ${cfmFmt} × ${fAltFmt} <span class="arrow">→</span> <span class="res">${cfmAlt} CFM</span></div>
      </div>`;

    // §9 — fórmulas eléctricas aplicadas (cuando hay ventilador)
    let formulaProt = '';
    if (iF !== null && Number.isFinite(iF) && nF > 0) {
      const iTot = (nF * iF).toFixed(2);
      const iMin = (nF * iF * 1.25).toFixed(2);
      formulaProt = `
        <div class="formula-box">
          <div class="l">Corriente total del sistema</div>
          <div class="sym">I<sub>total</sub> = N × I<sub>fan</sub></div>
          <div class="apply">I<sub>total</sub> = ${nF} × ${iF.toFixed(2)} A <span class="arrow">→</span> <span class="res">${iTot} A</span></div>
        </div>
        <div class="formula-box">
          <div class="l">Corriente mínima del breaker (NEC 430 — factor de seguridad ×1.25)</div>
          <div class="sym">I<sub>min,breaker</sub> = 1.25 × I<sub>total</sub></div>
          <div class="apply">I<sub>min,breaker</sub> = 1.25 × ${iTot} A <span class="arrow">→</span> <span class="res">${iMin} A</span></div>
        </div>
        ${parseFloat(fan.kw) ? `
        <div class="formula-box">
          <div class="l">Potencia eléctrica total absorbida</div>
          <div class="sym">P<sub>total</sub> = N × P<sub>1,fan</sub></div>
          <div class="apply">P<sub>total</sub> = ${nF} × ${fan.kw} W <span class="arrow">→</span> <span class="res">${(parseFloat(fan.kw) * nF / 1000).toFixed(2)} kW</span></div>
        </div>` : ''}
        ${(parseFloat(fan.kw) && parseFloat(fan.cosphi)) ? `
        <div class="formula-box">
          <div class="l">Potencia aparente total</div>
          <div class="sym">S<sub>total</sub> = P<sub>total</sub> / cos φ</div>
          <div class="apply">S<sub>total</sub> = ${(parseFloat(fan.kw) * nF / 1000).toFixed(2)} kW / ${fan.cosphi} <span class="arrow">→</span> <span class="res">${(parseFloat(fan.kw) * nF / parseFloat(fan.cosphi) / 1000).toFixed(2)} kVA</span></div>
        </div>` : ''}`;
    }

    const cssBase   = location.origin + location.pathname.replace(/\/[^\/]*$/, '/');
    const headerImg = '../assets/img/afinia/header_compact.png';
    const footerImg = '../assets/img/afinia/footer.png';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe técnico AFINIA — Selección ONAF — ${escaparHtml(proyecto)}</title>
<base href="${cssBase}">
<style>
  /* Hoja Letter conforme Formato Afinia.docx (referencia: Informe
     Casacara). El header y footer se repiten en CADA hoja al
     imprimir mediante el patron clasico thead/tfoot de tabla
     paginada. En print mode los navegadores Chrome, Edge, Firefox
     y Safari rasterizan thead UNA VEZ POR PAGINA al inicio y tfoot
     al final, replicando el comportamiento del Formato Afinia. */
  @page {
    size: letter portrait;
    margin: 0;
  }
  html, body {
    margin: 0; padding: 0;
    background: #fff;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Marco de pagina: tabla con thead = header repetido y
     tfoot = footer repetido. tbody contiene el flujo del informe. */
  .page-frame { width: 100%; border-collapse: collapse; }
  .page-frame > thead { display: table-header-group; }
  .page-frame > tfoot { display: table-footer-group; }
  .page-frame > thead > tr > th,
  .page-frame > tfoot > tr > td,
  .page-frame > tbody > tr > td { padding: 0; border: 0; vertical-align: top; }

  /* Cuerpo del informe: padding lateral 1.18in (3 cm aprox., pgMar
     del docx) y padding vertical pequeno para separar del header/
     footer en cada hoja impresa. */
  .page-frame > tbody > tr > td.page-body { padding: 8pt 1.18in 8pt 1.18in; }

  .afinia-header-img,
  .afinia-footer-img {
    display: block;
    width: 100%;
    height: auto;
  }
  .afinia-footer { position: relative; }
  .afinia-footer .footer-text {
    position: absolute;
    left: 6%; right: 6%; bottom: 14%;
    text-align: center;
    font-size: 6.5pt; color: #fff;
    font-weight: 600; letter-spacing: .01em;
    line-height: 1.2;
  }
  .report { padding: 0; }

  /* ── Tipografía · tamaños reducidos para mejor densidad ────── */
  h1 { font-size: 13pt; margin: 0 0 3pt; color: #0d3a73; letter-spacing: -.01em; line-height: 1.25; }
  h2 { font-size: 10pt; margin: 8pt 0 4pt; color: #0d3a73; padding-bottom: 2pt; border-bottom: 1px solid #5ba4d4; }
  h3 { font-size: 9pt; margin: 6pt 0 2pt; color: #0d3a73; }
  p, td, th { font-size: 8pt; line-height: 1.36; }
  .meta { margin: 0 0 3pt; }
  /* Sección anchor: el primer h2/h3 dentro NO lleva margen-top
     extra, evita huecos cuando la sección entera salta de página. */
  .section-anchor > h2:first-child,
  .section-anchor > h3:first-child { margin-top: 0; }
  .meta { font-size: 7.5pt; color: #666; margin-bottom: 3pt; }
  .mono { font-family: "Consolas", "Courier New", monospace; font-variant-numeric: tabular-nums; }
  .tc { text-align: center; }
  .tr { text-align: right; }

  /* Bloques que NUNCA deben partirse entre páginas */
  .keep, .kpi-grid, .cover-block, .info-box, .chart-block,
  .rpt-table, .ft, .estado, .materiales, .formula-box, .rad-diagram {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* Sección entera (título + primer bloque de contenido) se mantiene
     unida vía .section-anchor — evita que el h2 quede solo al pie de
     una página y su tabla salte a la siguiente. */
  .section-anchor {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* h2/h3 nunca deben quedar como última línea de página */
  h2, h3 {
    break-after: avoid;
    page-break-after: avoid;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  p, li { widows: 4; orphans: 4; }

  .cover-block {
    margin-top: 12pt;
    padding: 10pt 12pt; border-radius: 5pt;
    background: linear-gradient(135deg, #e3f2fd 0%, #f5fafd 100%);
    border: 1px solid #90caf9;
  }
  .cover-block h1 { color: #0d3a73; }
  .cover-block .proj { font-size: 10.5pt; font-weight: 600; color: #1258a0; margin-top: 4pt; }
  .cover-block .ref  { font-size: 7.5pt; color: #555; margin-top: 3pt; line-height: 1.4; }

  /* ── KPIs ──────────────────────────────────────────────────── */
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6pt; margin: 8pt 0; }
  .kpi-card {
    border: 1px solid #b0cce8; border-radius: 4pt;
    padding: 6pt 8pt; background: #f0f7ff;
    border-left: 2.5pt solid #0d47a1;
  }
  .kpi-card.cfm { background: #f0fafd; border-left-color: #0277bd; }
  .kpi-card.alt { background: #f0fdf6; border-left-color: #1b5e20; }
  .kpi-card .l { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #555; margin-bottom: 3pt; }
  .kpi-card .v { font-size: 10.5pt; font-weight: 700; color: #0d3a73; }

  /* ── Tablas ────────────────────────────────────────────────── */
  .rpt-table { width: 100%; border-collapse: collapse; margin: 3pt 0 6pt; }
  .rpt-table th, .rpt-table td { padding: 3pt 6pt; border-bottom: 1px solid #d8e3f0; vertical-align: top; }
  .rpt-table th { text-align: left; background: #ddeaf7; color: #0d3a73; font-weight: 600; font-size: 7.5pt; width: 38%; }
  .rpt-table td { font-size: 8pt; }

  .ft { width: 100%; border-collapse: collapse; margin-top: 5pt; }
  .ft th { background: #0d3a73; color: #fff; padding: 4pt 6pt; text-align: left; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .ft td { padding: 4pt 6pt; border-bottom: 1px solid #e0e8f3; font-size: 7.8pt; vertical-align: top; }
  .ft tr:nth-child(even) td { background: #f8fbff; }

  .info-box {
    margin: 6pt 0; padding: 8pt 12pt; border-radius: 4pt;
    background: #fff8e1; border: 1px solid #ffe082;
    font-size: 7.8pt; color: #5d4037;
  }
  .info-box strong { color: #b85f00; }

  .ok { color: #1b5e20; font-weight: 700; }
  .ko { color: #b71c1c; font-weight: 700; }

  .estado {
    display: inline-block; padding: 1pt 6pt; border-radius: 8pt;
    font-size: 6.5pt; font-weight: 700; letter-spacing: .04em;
  }
  .estado.est-ok   { background: #e8f5e9; color: #1b5e20; border: 1px solid #81c784; }
  .estado.est-warn { background: #fff3e0; color: #b85f00; border: 1px solid #ffb74d; }
  .estado.est-err  { background: #ffebee; color: #b71c1c; border: 1px solid #ef9a9a; }
  .estado.est-nd   { background: #f5f5f5; color: #757575; border: 1px solid #d0d0d0; }

  .best-mark {
    display: inline-block;
    background: #1b5e20; color: #fff; padding: 1pt 6pt;
    border-radius: 3pt; font-size: 6.5pt; font-weight: 700;
    margin-left: 5pt;
  }

  /* ── Bloque del gráfico (no se parte entre páginas) ────────── */
  .chart-block {
    margin: 8pt 0; padding: 6pt 6pt 3pt;
    border: 1px solid #b0cce8; border-radius: 4pt; background: #fff;
    text-align: center;
  }
  .chart-img { width: 100%; max-width: 5.6in; height: auto; }
  .chart-cap { font-size: 6.5pt; color: #666; margin-top: 3pt; font-style: italic; }

  /* ── Fórmula simbólica + sustitución con valores reales ────── */
  .formula-box {
    margin: 6pt 0;
    padding: 8pt 12pt; border-radius: 4pt;
    background: #f5f8fc; border: 1px solid #d0dce8;
    border-left: 2.5pt solid #1565c0;
  }
  .formula-box .l {
    font-size: 6.5pt; font-weight: 700; color: #1565c0;
    text-transform: uppercase; letter-spacing: .04em; margin-bottom: 3pt;
  }
  .formula-box .sym {
    font-family: "Cambria Math", "Times New Roman", serif;
    font-size: 9.5pt; font-style: italic; color: #1a1a1a;
  }
  .formula-box .apply {
    margin-top: 3pt;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 8pt; color: #1b5e20; font-variant-numeric: tabular-nums;
  }
  .formula-box .apply .arrow { color: #999; margin: 0 3pt; }
  .formula-box .apply .res   { color: #c62828; font-weight: 700; }

  /* ── Diagrama del radiador (SVG embebido) ───────────────────── */
  .rad-diagram {
    margin: 8pt 0; padding: 8pt 12pt 5pt;
    border: 1px solid #d0dce8; border-radius: 4pt; background: #fff;
  }
  .rad-diagram svg,
  .rad-diagram-img { display: block; width: 100%; max-width: 5.4in; height: auto; margin: 0 auto; }
  .rad-legend { margin-top: 5pt; display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 10pt; font-size: 7.5pt; }
  .rad-legend .lbl { display: inline-block; width: 12pt; text-align: center; font-weight: 700; color: #fff; border-radius: 50%; margin-right: 4pt; padding: 1pt 0; font-size: 7pt; }
  .lbl.a, .lbl.c { background: #c62828; }
  .lbl.b         { background: #2e7d32; }
  .lbl.d         { background: #0288d1; }

  /* SCREEN preview: simula una hoja Letter centrada con sombra. */
  @media screen {
    body { background: #888; padding: 24px 0; }
    .page-frame {
      width: 8.5in;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 4px 18px rgba(0,0,0,.18);
    }
  }

  @media print {
    body { background: #fff; }
    .page-frame { box-shadow: none; }
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

<!-- Marco de pagina: thead se repite como ENCABEZADO y tfoot como
     PIE en cada hoja al imprimir. El contenido del informe vive
     dentro de un unico td del tbody, que el navegador pagina
     respetando page-break-* y break-inside:avoid. -->
<table class="page-frame">
  <thead>
    <tr><th>
      <header class="afinia-header" aria-label="Encabezado oficial CaribeMar de la Costa S.A.S E.S.P. - AFINIA Grupo EPM">
        <img class="afinia-header-img" src="${headerImg}" alt="">
      </header>
    </th></tr>
  </thead>
  <tfoot>
    <tr><td>
      <footer class="afinia-footer" aria-hidden="true">
        <img class="afinia-footer-img" src="${footerImg}" alt="">
        <div class="footer-text">CaribeMar de la Costa S.A.S E.S.P. / Carrera 13B #26 – 78 Edificio Chambacú – Piso 1 / Cartagena.</div>
      </footer>
    </td></tr>
  </tfoot>
  <tbody>
    <tr><td class="page-body">
<article class="report">

  <!-- ── CARÁTULA ───────────────────────────────────────── -->
  <div class="cover-block">
    <div class="meta">CARIBEMAR DE LA COSTA S.A.S E.S.P · AFINIA Grupo EPM</div>
    <h1>Informe Técnico de Actualización y Repotenciación del Sistema de Refrigeración</h1>
    <div class="proj">${escaparHtml(proyecto)}</div>
    <div class="ref">
      <strong>Generado:</strong> ${fechaIso} · ${horaIso}<br>
      <strong>Normativas:</strong> IEEE C57.12.00-2015 · ANSI C57.12.91 · IEEE C57.91-2011 · Westinghouse T&amp;D Reference
    </div>
  </div>

  <!-- ── 1 · IDENTIFICACIÓN ─────────────────────────────── -->
  <section class="section-anchor">
    <h2>1. Identificación del transformador</h2>
    <table class="rpt-table">
      <tbody>
        ${_row('Matrícula AFINIA', matricula)}
        ${_row('Serie',           t.serie)}
        ${_row('Subestación',     t.sub)}
        ${_row('Zona',            t.zona)}
        ${_row('Departamento',    t.dept)}
        ${_row('Grupo',           t.grupo)}
        ${_row('Potencia placa',  t.kva)}
        ${_row('Refrigeración actual', t.refrig)}
      </tbody>
    </table>
  </section>

  <!-- ── 2 · PARÁMETROS DEL CÁLCULO ─────────────────────── -->
  <section class="section-anchor">
    <h2>2. Parámetros del cálculo de refrigeración</h2>
    <table class="rpt-table">
      <tbody>
        ${_row('Potencia ONAN base',          formatearNumero(r.onan)  + ' kVA', true)}
        ${_row('Potencia ONAF objetivo',      formatearNumero(r.onaf)  + ' kVA', true)}
        ${_row('Δ Potencia adicional',        formatearNumero(r.delta) + ' kVA', true)}
        ${_row('Factor ONAF/ONAN',            getPct().toFixed(1) + ' %', true)}
        ${_row('Pendiente Westinghouse',      r.pendiente.toFixed(3) + ' CFM/kVA', true)}
        ${_row('Altitud de instalación',      getAlt() + ' m s.n.m.', true)}
        ${_row('Factor corrección densidad ISA', r.factor_altitud.toFixed(4), true)}
      </tbody>
    </table>
  </section>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="l">ONAN</div><div class="v">${formatearNumero(r.onan)} kVA</div></div>
    <div class="kpi-card"><div class="l">ONAF</div><div class="v">${formatearNumero(r.onaf)} kVA</div></div>
    <div class="kpi-card"><div class="l">Δ Potencia</div><div class="v">${formatearNumero(r.delta)} kVA</div></div>
    <div class="kpi-card cfm"><div class="l">CFM nivel mar</div><div class="v">${formatearNumero(r.cfm_nivel_mar)}</div></div>
    <div class="kpi-card alt"><div class="l">CFM altitud</div><div class="v">${formatearNumero(r.cfm_corregido)}</div></div>
  </div>

  <!-- ── 3 · CURVAS WESTINGHOUSE ────────────────────────── -->
  <section class="section-anchor">
    <h2>3. Curvas de enfriamiento adicional ONAF</h2>
    <p class="meta">Punto de operación: <strong class="mono">${(r.onan / 1000).toFixed(1)} MVA · ${formatearNumero(r.cfm_nivel_mar)} CFM</strong> · pendiente Westinghouse <strong class="mono">${r.pendiente.toFixed(3)} CFM/kVA</strong> al ${getPct().toFixed(1)} %.</p>
  </section>
  ${formulaCalc}
  <div class="chart-block">
    ${chartImg
      ? `<img class="chart-img" src="${chartImg}" alt="Curvas de enfriamiento ONAF">`
      : `<div style="padding:40pt;text-align:center;color:#888;font-style:italic">Gráfico no disponible (Chart.js no se cargó). Reintente desde la calculadora con conexión activa.</div>`}
    <div class="chart-cap">Líneas rojas punteadas: proyección del punto de operación sobre los ejes (potencia ONAN y CFM requerido al nivel del mar). Curvas fijas 115/125/133/166% calibradas Westinghouse T&amp;D Reference. Curva oscura: interpolación lineal al porcentaje seleccionado.</div>
  </div>

  <!-- ── 4 · DATOS MECÁNICOS DEL RADIADOR ───────────────── -->
  <section class="section-anchor">
    <h2>4. Datos mecánicos del cuerpo de radiador</h2>
    <p class="meta">Diagrama de referencia con las dimensiones A/B/C/D según convención AFINIA:</p>
  </section>
  <div class="rad-diagram">
    <img class="rad-diagram-img" src="../assets/img/afinia/diagrama-radiador.png" alt="Diagrama de referencia del cuerpo de radiador con cotas A, B, C y D según convención AFINIA">
    <div class="rad-legend">
      <div><span class="lbl a">A</span> Altura del cuerpo de radiador</div>
      <div><span class="lbl b">B</span> Distancia entre oblea inicial y oblea final</div>
      <div><span class="lbl c">C</span> Ancho de frente del cuerpo de radiador</div>
      <div><span class="lbl d">D</span> Distancia entre centros de tornillos del flanche</div>
    </div>
  </div>
  <table class="rpt-table">
    <tbody>
      ${_row('A — Altura del cuerpo (mm)',                    rad.A,      true)}
      ${_row('B — Distancia oblea inicial–final (mm)',        rad.B,      true)}
      ${_row('C — Ancho de frente del cuerpo (mm)',           rad.C,      true)}
      ${_row('D — Distancia entre tornillos del flanche (mm)', rad.D,      true)}
      ${_row('Cantidad de radiadores',                         rad.cant,   true)}
      ${_row('Obleas por radiador',                            rad.obleas, true)}
      ${_row('Otras medidas / observaciones',                  rad.otras)}
      ${_row('Disposición mecánica del ventilador',            disp)}
    </tbody>
  </table>

  <!-- ── 5 · DATOS DEL MOTOVENTILADOR ───────────────────── -->
  <section class="section-anchor">
    <h2>5. Datos del motoventilador</h2>
    <h3>Identificación y aerodinámica</h3>
    <table class="rpt-table">
      <tbody>
        ${_row('Marca',                 fan.marca)}
        ${_row('Modelo / Referencia',   fan.modelo)}
        ${_row('N.° artículo / parte',  fan.nserie)}
        ${_row('Tipo de pala',          fan.tipo)}
        ${_row('Diámetro nominal (mm)', fan.diam,    true)}
        ${_row('Número de aspas',       fan.aspas,   true)}
        ${_row('RPM nominal',           fan.rpm,     true)}
        ${_row('Posición de montaje',   fan.montaje)}
        ${_row('Peso conjunto (kg)',    fan.peso,    true)}
        ${_row('Caudal de entrada',     fan.flow_val ? `${fan.flow_val} ${ETIQUETAS_CAUDAL_ALT[fan.flow_unit] || fan.flow_unit}` : '—', true)}
        ${_row('CFM nominal (ft³/min)', fan.cfm_nom, true)}
        ${_row('Equivalente m³/s',      fan.m3s,     true)}
      </tbody>
    </table>
  </section>
  <section class="section-anchor">
    <h3>Motor eléctrico</h3>
    <table class="rpt-table">
      <tbody>
        ${_row('Tensión nominal · conexión', fan.volt)}
        ${_row('Frecuencia',                 fan.hz + ' Hz', true)}
        ${_row('Potencia absorbida P₁',      fan.kw + ' W',  true)}
        ${_row('Corriente nominal',          fan.amp,        true)}
        ${_row('Factor de potencia cos φ',   fan.cosphi,     true)}
        ${_row('Grado de protección',        fan.ip)}
        ${_row('Clase de aislamiento',       fan.aislam)}
        ${_row('Protección del motor',       fan.protmotor)}
        ${_row('Temperatura mínima (°C)',    fan.tmin, true)}
        ${_row('Sentido de rotación',        fan.sentido)}
        ${_row('Certificación',              fan.cert)}
        ${_row('Material palas / rotor',     fan.material)}
      </tbody>
    </table>
  </section>

  <!-- ── 6 · MONTAJE SOBRE RADIADOR ─────────────────────── -->
  <section class="section-anchor">
    <h2>6. Montaje sobre radiador</h2>
    <table class="rpt-table">
      <tbody>
        ${_row('Tipo de fijación',                       mon.tipo_fij)}
        ${_row('Dirección del flujo',                    mon.flujo_dir)}
        ${_row('Dimensiones marco (mm)',                 mon.marco)}
        ${_row('Puntos de fijación',                     mon.npuntos,   true)}
        ${_row('Tornillos tipo / Ø',                     mon.tornillos)}
        ${_row('Separación ventilador–radiador (mm)',    mon.dist,      true)}
        ${_row('Junta / sello perimetral',               mon.junta)}
        ${_row('Observaciones de montaje',               mon.obs)}
      </tbody>
    </table>
  </section>

  <!-- ── 7 · COMPATIBILIDAD MECÁNICA ────────────────────── -->
  <section class="section-anchor">
    <h2>7. Análisis de compatibilidad mecánica</h2>
    <table class="ft">
      <thead>
        <tr>
          <th style="width:32%">Criterio</th>
          <th style="width:18%">Valor</th>
          <th style="width:14%">Estado</th>
          <th>Diagnóstico</th>
        </tr>
      </thead>
      <tbody>
        ${compatRow('C1', compat.c1, 'Cobertura del panel (covDim vs Ø)')}
        ${compatRow('C2', compat.c2, 'Sección de flujo / altura vs Ø')}
        ${compatRow('C3', compat.c3, 'Holgura ventilador–radiador')}
        ${compatRow('C4', compat.c4, 'Relación A/Ø o B/Ø')}
      </tbody>
    </table>
  </section>
  <div class="info-box"><strong>Conclusión:</strong> ${escaparHtml(compat.resumen.mensaje)}</div>

  <!-- ── 8 · SELECCIÓN DE MOTOVENTILADORES ──────────────── -->
  <section class="section-anchor">
    <h2>8. Selección de motoventiladores</h2>
    <p class="meta">CFM requerido a nivel del mar: <strong class="mono">${formatearNumero(r.cfm_nivel_mar)} CFM</strong> · CFM corregido por altitud (${getAlt()} m): <strong class="mono">${formatearNumero(r.cfm_corregido)} CFM</strong></p>
  </section>
  ${formulaSeleccion}
  <table class="ft">
    <thead>
      <tr>
        <th class="tc" style="width:30px">#</th>
        <th>Descripción / modelo</th>
        <th class="tr" style="width:80px">CFM/fan</th>
        <th class="tc" style="width:65px">Unidades</th>
        <th class="tr" style="width:90px">CFM logrado</th>
        <th class="tr" style="width:70px">Cobertura</th>
        <th class="tr" style="width:80px">Exceso</th>
        <th class="tc" style="width:40px">OK</th>
      </tr>
    </thead>
    <tbody>${fanRows}</tbody>
  </table>
  ${best ? `<div class="info-box"><strong>Recomendación:</strong> opción "${escaparHtml(best.f.desc) || `Opción ${state.fans.indexOf(best.f) + 1}`}" — <strong class="mono">${best.n} unidades</strong> de <strong class="mono">${formatearNumero(best.f.cfm)} CFM</strong> cubren el requerimiento con cobertura del <strong>${best.cobertura_pct}%</strong> y exceso de <strong class="mono">${formatearNumero(best.exceso)} CFM</strong>.<span class="best-mark">menor cantidad</span></div>` : ''}

  <!-- ── 9 · PROTECCIÓN ELÉCTRICA ───────────────────────── -->
  <section class="section-anchor">
    <h2>9. Circuito de protección eléctrica y mando</h2>
    <p class="meta">Aplicación de las fórmulas de dimensionamiento con los datos cargados:</p>
  </section>
  ${formulaProt}
  ${protBlock}

  <!-- ── 10 · LISTA DE MATERIALES ───────────────────────── -->
  <section class="section-anchor materiales">
    <h2>10. Lista de materiales</h2>
    ${materiales}
  </section>

  <div class="info-box" style="margin-top:12pt">
    Documento generado automáticamente por SGM · TRANSPOWER. La validación
    final del diseño debe ser revisada por el ingeniero responsable conforme
    a IEEE C57.91 (cargabilidad) y al criterio de operación de la red AFINIA.
  </div>

</article>
    </td></tr>
  </tbody>
</table>

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

// Etiquetas humanizadas (sin importar todo el módulo de unidades)
const ETIQUETAS_CAUDAL_ALT = {
  m3s:   'm³/s',
  m3min: 'm³/min',
  m3h:   'm³/h',
  cfm:   'CFM',
  cfs:   'CFS'
};


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
