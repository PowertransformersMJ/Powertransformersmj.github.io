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
  calcularProteccionElectrica, calcularProteccionMix,
  evaluarMixVentiladores, sugerirMejoras, MIX_ESTADO,
  extraerCorrienteFan,
  evaluarCompatibilidad, mensajeDisposicion, COMPAT_ESTADO,
  deduceOnafDesdeOnanYPct, deducePctDesdeOnanYOnaf,
  calcularYStep, calcularAutoRango,
  formatearNumero, escaparHtml
} from './domain/refrigeracion.js';

const $ = (id) => document.getElementById(id);

/* ─── Estado UI mutable (mínimo) ────────────────────────────── */
//
// `state.mix` es la fuente de verdad del cálculo desde 2026-05-03.
// Cada item es un snapshot del modelo del catálogo + cantidad. La
// suma de aportes (cantidad × CFM unitario) se compara contra el
// CFM requerido vía `evaluarMixVentiladores` del dominio puro.
const state = {
  mix:       [],               // Array<{id, key, marca, modelo, cfm_unitario, cantidad, ficha}>
  mixIdCnt:  1,
  lastEval:  null,             // Snapshot de evaluarMixVentiladores (cache para informe)
  cfmReq:    0,
  cfmReqAlt: 0,
  yStep:     20000,
  lock:      false,            // anti-recursión ONAN↔ONAF↔%
  fanDb:     null,             // cargado lazy
  transformers: null,          // cargado lazy
  chart:     null,
  lastSuggestions: []          // cache para applyMixSuggestion
};

/* ─── Helpers ───────────────────────────────────────────────── */

function getOnan() { return parseFloat($('kva_onan').value) || 60000; }
function getOnaf() { return parseFloat($('kva_onaf').value) || 79800; }
function getPct()  { return parseFloat($('pct').value)      || 133; }
function getAlt()  { return parseFloat($('alt').value)      || 0; }
function getTolerancia() {
  const v = parseFloat($('mix_tolerancia')?.value);
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

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
  syncFichaVisibleConKey(key, db);
  if (status) status.textContent = '✓ Datos cargados desde ficha técnica · use "Agregar al mix" para incluirlo en el cálculo';
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

/* ─── Mix multi-modelo (estado APROBADO / NO APROBADO + sugerencias) ─── */

/**
 * Agrega un modelo del catálogo al mix con la cantidad indicada.
 * Si el modelo ya está en el mix, incrementa la cantidad existente
 * (caso "agregaste 4, ahora pones 2 más → quedan 6").
 */
async function addToMix() {
  const sel = $('mix_fan_sel');
  const qtyInput = $('mix_fan_qty');
  if (!sel || !qtyInput) return;
  const key = sel.value;
  const qty = Math.max(1, Math.floor(parseFloat(qtyInput.value) || 1));
  if (!key) {
    sel.focus();
    return;
  }
  const db = await ensureFanDb();
  const f = db[key];
  if (!f) return;
  const existente = state.mix.find(it => it.key === key);
  if (existente) {
    existente.cantidad += qty;
  } else {
    state.mix.push({
      id:    state.mixIdCnt++,
      key,
      marca:        f.fan_marca || '',
      modelo:       f.fan_modelo || '',
      cfm_unitario: +f.fan_cfm_nom || 0,
      cantidad:     qty,
      ficha:        Object.freeze({ ...f })   // snapshot inmutable de la ficha completa
    });
    // Sincronizar la ficha visible con el ÚLTIMO modelo agregado
    // (mantiene el flujo de compatibilidad mecánica + protección).
    syncFichaVisibleConKey(key, db);
  }
  qtyInput.value = 1;
  renderMix();
  await calcProtection();
}

/**
 * Sincroniza los inputs de la ficha técnica visible con un modelo
 * del catálogo (mantiene compatibilidad con compatibilidad mecánica
 * y la sección "Datos del motoventilador" del informe legacy).
 */
function syncFichaVisibleConKey(key, db) {
  if (!db || !db[key]) return;
  const d = db[key];
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
  for (const o of $('fan_hz').options)        if (o.value === d.fan_hz)         { o.selected = true; break; }
  for (const o of $('fan_ip').options)        if (o.value === d.fan_ip || (o.text || '').includes(d.fan_ip || '')) { o.selected = true; break; }
  for (const o of $('fan_flow_unit').options) if (o.value === d.fan_flow_unit)  { o.selected = true; break; }
  // Reflejar también en el dropdown legacy `fan_db_sel` para que
  // calcProtection pueda extraer la corriente del modelo dominante.
  const legacy = $('fan_db_sel');
  if (legacy) {
    for (const o of legacy.options) if (o.value === key) { o.selected = true; break; }
  }
  syncCfm();
  $('cfm_result_disp').textContent = formatearNumero(d.fan_cfm_nom) + ' CFM';
  checkCompat();
}

function removeFromMix(id) {
  state.mix = state.mix.filter(it => it.id !== id);
  renderMix();
  calcProtection();
}

function updateMixQty(id, qty) {
  const it = state.mix.find(x => x.id === id);
  if (!it) return;
  it.cantidad = Math.max(0, Math.floor(parseFloat(qty) || 0));
  renderMix();
  calcProtection();
}

/**
 * Aplica una sugerencia del motor (`sugerirMejoras`) mutando el
 * estado del mix. La sugerencia trae `cambios[]` con accion =
 * 'agregar' | 'quitar' | 'sustituir' (compuesto de quitar + agregar).
 */
async function applyMixSuggestion(idx) {
  const sug = state.lastSuggestions[idx];
  if (!sug || !Array.isArray(sug.cambios)) return;
  const db = await ensureFanDb();
  for (const c of sug.cambios) {
    if (c.accion === 'quitar') {
      state.mix = state.mix.filter(it => it.key !== c.key);
    } else if (c.accion === 'agregar') {
      const ex = state.mix.find(it => it.key === c.key);
      if (ex) {
        ex.cantidad += c.cantidad;
      } else {
        const f = db[c.key];
        if (!f) continue;
        state.mix.push({
          id:    state.mixIdCnt++,
          key:   c.key,
          marca:        f.fan_marca || c.marca || '',
          modelo:       f.fan_modelo || c.modelo || '',
          cfm_unitario: +f.fan_cfm_nom || c.cfm_unitario || 0,
          cantidad:     c.cantidad,
          ficha:        Object.freeze({ ...f })
        });
      }
    }
  }
  renderMix();
  await calcProtection();
}

/**
 * Renderiza la tabla del mix + banner de estado + panel de
 * sugerencias. Usa `evaluarMixVentiladores` y `sugerirMejoras`
 * del dominio puro como fuente de verdad.
 */
function renderMix() {
  const focId = document.activeElement ? document.activeElement.id : null;
  const tbody = $('mix-tbody');
  if (!tbody) return;

  // Tabla
  if (state.mix.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-4);font-style:italic;padding:18px">
      Sin modelos agregados — seleccione uno arriba y haga click en "Agregar al mix".
    </td></tr>`;
  } else {
    const evalCache = evaluarMixVentiladores({
      items: state.mix.map(it => ({
        key: it.key, modelo: it.modelo, marca: it.marca,
        cfm_unitario: it.cfm_unitario, cantidad: it.cantidad
      })),
      cfm_requerido: state.cfmReq,
      tolerancia_pct: getTolerancia()
    });
    tbody.innerHTML = state.mix.map((it, i) => {
      const aporte = it.cfm_unitario * it.cantidad;
      const aportePct = evalCache.cfm_aporte_total > 0
        ? +(aporte / evalCache.cfm_aporte_total * 100).toFixed(1)
        : 0;
      return `<tr id="mr${it.id}">
        <td style="color:var(--ink-4);font-size:11px;text-align:center">${i + 1}</td>
        <td>${escaparHtml(it.marca)}</td>
        <td>${escaparHtml(it.modelo)}</td>
        <td class="tr mono">${formatearNumero(it.cfm_unitario)}</td>
        <td class="tc">
          <input id="mq${it.id}" type="number" class="mix-qty" value="${it.cantidad}"
                 min="0" step="1" max="999" data-mix-qty="${it.id}"
                 aria-label="Cantidad ${escaparHtml(it.modelo)}">
        </td>
        <td class="tr mono"><strong>${formatearNumero(aporte)}</strong> CFM</td>
        <td class="tr mono">${aportePct.toFixed(1)}%</td>
        <td class="tc"><button type="button" class="btn-rm-mix" data-mix-remove="${it.id}" aria-label="Quitar ${escaparHtml(it.modelo)} del mix">✕</button></td>
      </tr>`;
    }).join('');
  }

  // Pie de tabla con totales
  const totQty = $('mix-total-qty');
  const totCfm = $('mix-total-cfm');
  const totPct = $('mix-total-pct');
  if (totQty && totCfm && totPct) {
    const sumQty = state.mix.reduce((s, it) => s + it.cantidad, 0);
    const sumCfm = state.mix.reduce((s, it) => s + it.cantidad * it.cfm_unitario, 0);
    totQty.textContent = sumQty || '—';
    totCfm.textContent = sumQty ? formatearNumero(sumCfm) + ' CFM' : '— CFM';
    totPct.textContent = sumQty ? '100%' : '—';
  }

  // Banner de estado + sugerencias
  const evalRes = evaluarMixVentiladores({
    items: state.mix.map(it => ({
      key: it.key, modelo: it.modelo, marca: it.marca,
      cfm_unitario: it.cfm_unitario, cantidad: it.cantidad
    })),
    cfm_requerido: state.cfmReq,
    tolerancia_pct: getTolerancia()
  });
  state.lastEval = evalRes;
  renderMixStatus(evalRes);
  renderMixSuggestions(evalRes);

  // Backwards-compat con la sección "Calculador de ventiladores"
  // del informe legacy: mantenemos un alias `state.fans` derivado
  // del mix actual para no romper helpers que aún lo lean.
  state.fans = state.mix.map(it => ({
    id: it.id, desc: `${it.marca} ${it.modelo}`.trim(), cfm: it.cfm_unitario
  }));

  if (focId) { const el = $(focId); if (el) el.focus(); }
}

function renderMixStatus(ev) {
  const banner = $('mix-status');
  if (!banner) return;
  banner.classList.remove('is-aprobado', 'is-no-aprobado', 'is-sin-datos');
  if (ev.estado === MIX_ESTADO.SIN_DATOS) {
    banner.classList.add('is-sin-datos');
    banner.innerHTML = `
      <span class="mix-badge">Sin datos</span>
      <span class="mix-msg">${escaparHtml(ev.mensaje)}</span>`;
    return;
  }
  const cls = ev.aprobado ? 'is-aprobado' : 'is-no-aprobado';
  const badge = ev.aprobado ? '✓ Aprobado' : '✗ No aprobado';
  banner.classList.add(cls);
  const tolKpi = (ev.tolerancia_pct || 0) > 0
    ? `<div class="mix-kpi">Umbral · <b>${formatearNumero(ev.cfm_umbral)} CFM</b> <span style="color:var(--ink-3);font-weight:500">(tol ${ev.tolerancia_pct.toFixed(1)}%)</span></div>`
    : '';
  const kpi = ev.aprobado
    ? `<div class="mix-kpi">Cobertura · <b>${ev.cobertura_pct.toFixed(1)}%</b></div>
       <div class="mix-kpi">Exceso · <b>${formatearNumero(ev.exceso)} CFM</b></div>
       ${tolKpi}
       <div class="mix-kpi">N total · <b>${ev.n_unidades_total}</b></div>`
    : `<div class="mix-kpi">Cobertura · <b>${ev.cobertura_pct.toFixed(1)}%</b></div>
       <div class="mix-kpi">Déficit · <b>${formatearNumero(ev.deficit)} CFM</b></div>
       ${tolKpi}
       <div class="mix-kpi">N total · <b>${ev.n_unidades_total}</b></div>`;
  banner.innerHTML = `
    <span class="mix-badge">${badge}</span>
    <span class="mix-msg">${escaparHtml(ev.mensaje)}</span>
    <div class="mix-kpis">${kpi}</div>`;
}

async function renderMixSuggestions(ev) {
  const panel = $('mix-suggestions');
  if (!panel) return;
  if (ev.estado !== MIX_ESTADO.NO_APROBADO) {
    panel.hidden = true; panel.innerHTML = '';
    state.lastSuggestions = [];
    return;
  }
  const db = state.fanDb || await ensureFanDb();
  const sugs = sugerirMejoras({
    items: state.mix.map(it => ({
      key: it.key, modelo: it.modelo, marca: it.marca,
      cfm_unitario: it.cfm_unitario, cantidad: it.cantidad
    })),
    cfm_requerido: state.cfmReq,
    fan_db: db,
    max_sugerencias: 3
  });
  state.lastSuggestions = sugs;
  if (sugs.length === 0) {
    panel.hidden = false;
    panel.innerHTML = `<div class="mix-sug-title">Sugerencias para alcanzar el CFM requerido</div>
      <div style="font-size:13px;color:var(--ink-3);font-style:italic">
        El catálogo no contiene combinaciones que cubran el déficit de ${formatearNumero(ev.deficit)} CFM con el mix actual. Considere agregar manualmente más unidades.
      </div>`;
    return;
  }
  panel.hidden = false;
  const labelEstrategia = (s) => ({
    agregar_unidades: 'Agregar más unidades',
    sustituir:        'Sustituir modelo más débil',
    agregar_modelo:   'Agregar modelo nuevo'
  }[s] || s);
  panel.innerHTML = `
    <div class="mix-sug-title">Sugerencias para cubrir el déficit (${formatearNumero(ev.deficit)} CFM)</div>
    <div class="mix-sug-grid">
      ${sugs.map((s, i) => `
        <div class="mix-sug-card">
          <div class="strat">${labelEstrategia(s.estrategia)}</div>
          <div class="desc">${escaparHtml(s.descripcion)}</div>
          <div class="kpi">CFM total resultante · <b>${formatearNumero(s.cfm_aporte_total)} CFM</b> · cobertura <b>${s.cobertura_pct.toFixed(1)}%</b> · exceso <b>${formatearNumero(s.exceso)} CFM</b></div>
          <button type="button" data-mix-apply="${i}">Aplicar sugerencia</button>
        </div>`).join('')}
    </div>`;
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

/* ─── Protección eléctrica (mix multi-modelo + fallback legacy) ─── */
//
// Comportamiento:
//   1. Si state.mix.length >= 1 → cálculo agregado del mix con
//      grupos por modelo + breaker principal único. Esta es la
//      ruta principal del refactor 2026-05-03.
//   2. Si state.mix.length === 0 PERO hay un modelo seleccionado
//      en el dropdown técnico legacy `fan_db_sel` → preview con
//      ESE modelo único + N derivado de CFM_requerido / CFM_modelo
//      (comportamiento original v2.9.0). Mantiene continuidad de
//      la funcionalidad legacy y muestra el detalle de protección
//      sin obligar al usuario a entender el flujo nuevo del mix.
//   3. Si no hay nada → placeholder con catálogo de componentes
//      que aparecerán cuando el usuario cargue datos.

async function calcProtection() {
  const conn = getMotorConn();

  const noteEl = $('conn_note');
  if (noteEl) {
    noteEl.textContent = conn === 'D'
      ? 'Δ Delta: tensión de línea completa en cada bobina. Corriente nominal plena. Uso estándar en operación continua de ventiladores.'
      : 'Y Estrella: tensión reducida (V_L/√3) por bobina. Corriente ≈ 1/3 de la corriente Delta. Para arranque suave o motores con bobinado diseñado para estrella.';
  }

  const pf = $('prot-per-fan'), pt = $('prot-total'), ps = $('prot-summary');
  if (!pf || !pt || !ps) return;

  // ── Ruta 1 · Mix multi-modelo (refactor 2026-05-03) ──
  if (state.mix.length >= 1) {
    const itemsProt = state.mix.map(it => {
      const iU = extraerCorrienteFan(it.ficha?.fan_amp, conn);
      return {
        key:           it.key,
        modelo:        it.modelo,
        marca:         it.marca,
        cantidad:      it.cantidad,
        amps_unitario: Number.isFinite(iU) ? iU : 0,
        kw_unitario:   (+it.ficha?.fan_kw / 1000) || 0,
        peso_unitario: +it.ficha?.fan_peso || 0
      };
    });
    const r = calcularProteccionMix({ items: itemsProt, factor_seguridad: 1.25 });
    state.lastProteccion = r;

    pf.innerHTML = renderProtPorGrupo(r, conn);
    pt.innerHTML = renderProtTotal(r);
    ps.innerHTML = renderListaMaterialesMix(r);
    return;
  }

  // ── Ruta 2 · Fallback legacy con modelo único del dropdown ──
  const fanKey = $('fan_db_sel') ? $('fan_db_sel').value : '';
  const db = fanKey ? await ensureFanDb() : null;
  const fanLegacy = db && fanKey ? db[fanKey] : null;
  if (fanLegacy) {
    const iF = extraerCorrienteFan(fanLegacy.fan_amp, conn);
    if (iF !== null && Number.isFinite(iF)) {
      const nFans = (fanLegacy.fan_cfm_nom > 0 && state.cfmReq > 0)
        ? Math.ceil(state.cfmReq / fanLegacy.fan_cfm_nom) : 0;
      const r = calcularProteccionElectrica({ amps_por_fan: iF, n_fans: nFans });
      pf.innerHTML = renderProtLegacyPerFan(fanLegacy, conn, iF, r);
      pt.innerHTML = renderProtLegacyTotal(r, nFans, iF);
      ps.innerHTML = renderProtLegacyMateriales(fanLegacy, conn, iF, r);
      return;
    }
  }

  // ── Ruta 3 · Sin datos · placeholder con catálogo de componentes ──
  pf.innerHTML = `
    <p style="color:var(--ink-4);font-style:italic;padding:6px 10px;margin:0 0 8px">
      Cargue una ficha técnica desde la base de datos arriba (o agregue modelos al mix) para calcular cantidades, settings y PIDs.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--ink-3)">
      <div style="flex:1 1 240px;padding:8px 12px;border:1px dashed rgba(0,40,90,.20);border-radius:6px;background:rgba(255,255,255,.4)">
        <strong style="color:var(--brand-deep)">Guardamotor ABB MS116</strong> (1 por ventilador)<br>
        Rango ajuste: 0.10 … 32 A · Trip class 10A · 50 kA @ 400 V<br>
        45 mm DIN · IEC/EN 60947-4-1
      </div>
      <div style="flex:1 1 240px;padding:8px 12px;border:1px dashed rgba(0,40,90,.20);border-radius:6px;background:rgba(255,255,255,.4)">
        <strong style="color:var(--brand-deep)">Auxiliar HK1-11</strong> (1 por guardamotor)<br>
        1NO+1NC · Montaje frontal · PID <span class="mono">1SAM201902R1001</span><br>
        Señalización falla / estado motor al SCADA
      </div>
    </div>`;
  pt.innerHTML = `
    <p style="color:var(--ink-4);font-style:italic;padding:6px 10px;margin:0 0 8px">
      La corriente total y el breaker principal se calcularán automáticamente con los datos del mix.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--ink-3)">
      <div style="flex:1 1 240px;padding:8px 12px;border:1px dashed rgba(0,40,90,.20);border-radius:6px;background:rgba(255,255,255,.4)">
        <strong style="color:var(--brand-deep)">Breaker principal ABB S203</strong> (1 para todo el sistema)<br>
        Rango: 16 / 25 / 40 / 50 A · 3P · Curva C · 6 kA<br>
        Dimensionado a 1.25 × I<sub>total</sub> (NEC 430)
      </div>
      <div style="flex:1 1 240px;padding:8px 12px;border:1px dashed rgba(0,40,90,.20);border-radius:6px;background:rgba(255,255,255,.4)">
        <strong style="color:var(--brand-deep)">Auxiliar S2C-H11L</strong> (1 por breaker)<br>
        1NO+1NC · Montaje lateral izquierdo S200 · PID <span class="mono">2CDS200936R0001</span><br>
        Señalización falla / estado breaker al SCADA
      </div>
    </div>`;
  ps.innerHTML = '';
}

/* ─── Renderers fallback legacy (modelo único) ─────────────── */

function renderProtLegacyPerFan(fan, conn, iF, r) {
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
    </div>
    <p style="margin-top:8px;font-size:11px;color:var(--ink-3);font-style:italic">
      Vista preview con el modelo seleccionado del catálogo. <strong>Para combinar varios modelos</strong> en el mismo transformador, agregue cada uno al mix arriba con su cantidad: el cálculo se actualizará automáticamente con los grupos reales.
    </p>`;
}

function renderProtLegacyTotal(r, nFans, iF) {
  const brk = r.breaker;
  const n = nFans || '?';
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

function renderProtLegacyMateriales(fan, conn, iF, r) {
  const items = [];
  items.push(`${r.n_fans || 1}× <strong>Motoventilador ${escaparHtml(fan.fan_marca || '')} ${escaparHtml(fan.fan_modelo || '')}</strong> · PID ${escaparHtml(fan.fan_nserie || '—')} · ${fan.fan_diam || '?'} mm Ø · ${fan.fan_cfm_nom || '?'} CFM`);
  if (r.guardamotor)     items.push(`${r.n_fans || 1}× <strong>Guardamotor ABB ${r.guardamotor.model}</strong> · PID ${r.guardamotor.pid} · setting ${iF.toFixed(2)} A · rango ${r.guardamotor.min}…${r.guardamotor.max} A`);
  if (r.aux_guardamotor) items.push(`${r.n_fans || 1}× <strong>Auxiliar guardamotor ABB ${r.aux_guardamotor.model}</strong> · PID ${r.aux_guardamotor.pid} · contacto auxiliar SCADA`);
  if (r.breaker)         items.push(`1× <strong>Breaker principal ABB ${r.breaker.model}</strong> · PID ${r.breaker.pid} · breaker principal 3P del sistema · In ${r.breaker.in} A · Curva C · 6 kA · pérdidas ${r.breaker.power_w} W`);
  if (r.aux_breaker)     items.push(`1× <strong>Auxiliar breaker ABB ${r.aux_breaker.model}</strong> · PID ${r.aux_breaker.pid} · auxiliar S203 SCADA`);
  if (!items.length) return '';
  return `
    <div class="calc-subsect" style="margin-top:18px">Lista de materiales — protección eléctrica (preview con modelo único)</div>
    <ul style="margin:6px 0 0 18px;padding:0;color:var(--ink-2);font-size:13px;line-height:1.7">
      ${items.map(i => `<li>${i}</li>`).join('')}
    </ul>`;
}

function renderProtPorGrupo(r, conn) {
  const txtConn = conn === 'D' ? 'Δ Delta' : 'Y Estrella';
  if (r.grupos.length === 0) {
    return '<p style="color:var(--ink-4);font-style:italic;padding:10px">Sin grupos válidos · verifique las corrientes unitarias en la ficha técnica.</p>';
  }
  return `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${r.grupos.map(g => {
        const gm = g.guardamotor;
        return `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:stretch;padding:10px 12px;border:1px solid rgba(0,40,90,.10);border-radius:8px;background:rgba(255,255,255,.4)">
          <div style="flex:1 1 220px;min-width:200px">
            <div class="prot-label">Grupo · ${escaparHtml(g.marca)} ${escaparHtml(g.modelo)}</div>
            <div class="prot-val">${g.cantidad} × ${g.amps_unitario.toFixed(2)} A (${txtConn})</div>
            <div class="prot-meta">Corriente del grupo: <strong>${g.amps_grupo.toFixed(2)} A</strong> · ${g.cantidad} ventiladores</div>
          </div>
          <div style="flex:1 1 280px;min-width:240px">
            <div class="prot-label">Guardamotor sugerido (${g.cantidad} unidad${g.cantidad === 1 ? '' : 'es'})</div>
            ${gm ? `
              <div class="prot-val">ABB ${gm.model}</div>
              <div class="prot-meta">Rango ajuste: ${gm.min}…${gm.max} A · Setting recomendado: <strong>${g.amps_unitario.toFixed(2)} A</strong></div>
              <div class="prot-meta">PID: ${gm.pid} · 45 mm DIN · IEC/EN 60947-4-1</div>
            ` : `<div class="prot-meta cwrn">Corriente ${g.amps_unitario.toFixed(2)} A fuera del rango MS116 estándar (0.10…32 A). Consultar catálogo.</div>`}
            <div class="prot-meta">+ ${g.cantidad}× <strong>ABB ${g.aux_guardamotor.model}</strong> · auxiliar SCADA · PID ${g.aux_guardamotor.pid}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderProtTotal(r) {
  const brk = r.breaker;
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:stretch">
      <div class="prot-card prot-card--ok" style="min-width:200px">
        <div class="prot-label">Corriente total del sistema</div>
        <div class="prot-val">${r.amps_totales.toFixed(2)} A</div>
        <div class="prot-meta">Σ de ${r.n_total} ventiladores en ${r.grupos.length} grupo${r.grupos.length === 1 ? '' : 's'}</div>
      </div>
      <div class="prot-card prot-card--info" style="min-width:200px">
        <div class="prot-label">Corriente mínima del breaker</div>
        <div class="prot-val">${r.amps_min_breaker.toFixed(2)} A</div>
        <div class="prot-meta">Factor seguridad NEC 430 (×1.25)</div>
      </div>
      <div class="prot-card prot-card--${brk ? 'ok' : 'err'}" style="min-width:260px">
        <div class="prot-label">Breaker principal sugerido</div>
        ${brk ? `
          <div class="prot-val">ABB ${brk.model}</div>
          <div class="prot-meta">In = ${brk.in} A · 3P · Curva C · 6 kA</div>
          <div class="prot-meta">PID: ${brk.pid} · Pérdidas: ${brk.power_w} W</div>
        ` : `<div class="prot-meta cwrn">Corriente ${r.amps_min_breaker.toFixed(2)} A excede el catálogo S203 (50 A). Consultar familia superior.</div>`}
      </div>
      <div class="prot-card prot-card--info" style="min-width:220px">
        <div class="prot-label">Auxiliar breaker SCADA (1 ud)</div>
        <div class="prot-val">ABB ${r.aux_breaker.model}</div>
        <div class="prot-meta">PID: ${r.aux_breaker.pid} · ${r.aux_breaker.desc}</div>
      </div>
      ${r.kw_totales > 0 ? `
      <div class="prot-card prot-card--info" style="min-width:180px">
        <div class="prot-label">Potencia eléctrica total</div>
        <div class="prot-val">${r.kw_totales.toFixed(2)} kW</div>
        <div class="prot-meta">Σ de potencias absorbidas P₁</div>
      </div>` : ''}
      ${r.peso_total > 0 ? `
      <div class="prot-card prot-card--info" style="min-width:180px">
        <div class="prot-label">Peso total motoventiladores</div>
        <div class="prot-val">${r.peso_total.toFixed(1)} kg</div>
        <div class="prot-meta">Σ por unidad × cantidad</div>
      </div>` : ''}
    </div>`;
}

function renderListaMaterialesMix(r) {
  const items = [];
  for (const g of r.grupos) {
    items.push(`${g.cantidad}× <strong>${escaparHtml(g.marca)} ${escaparHtml(g.modelo)}</strong> · motoventilador`);
    if (g.guardamotor) items.push(`${g.cantidad}× <strong>ABB ${g.guardamotor.model}</strong> · PID ${g.guardamotor.pid} · setting ${g.amps_unitario.toFixed(2)} A · guardamotor para ${escaparHtml(g.modelo)}`);
    if (g.aux_guardamotor) items.push(`${g.cantidad}× <strong>ABB ${g.aux_guardamotor.model}</strong> · PID ${g.aux_guardamotor.pid} · auxiliar SCADA del guardamotor`);
  }
  if (r.breaker)     items.push(`1× <strong>ABB ${r.breaker.model}</strong> · PID ${r.breaker.pid} · breaker principal 3P del sistema completo`);
  if (r.aux_breaker) items.push(`1× <strong>ABB ${r.aux_breaker.model}</strong> · PID ${r.aux_breaker.pid} · auxiliar S203 SCADA`);
  if (!items.length) return '';
  return `
    <div class="calc-subsect" style="margin-top:18px">Lista de materiales — protección eléctrica del mix</div>
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

  // Recalcular tabla del mix (estado APROBADO/NO depende del CFM
  // requerido) + protección eléctrica.
  renderMix();
  calcProtection();
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

/* ─── Modal "Registrar acción de mantenimiento" ─────────────── */
//
// Abre un modal que captura una descripción + estado + fechas, y
// persiste un snapshot completo del cálculo en la colección
// `acciones_refrigeracion` de Firestore. La pestaña "Consolidado
// Sistemas de Refrigeración" suscribe a esa colección y refleja
// la acción inmediatamente vía onSnapshot.

function openModalAccion() {
  const modal = $('modalAccion');
  if (!modal) return;
  if (state.mix.length === 0) {
    alert('Agregue al menos un modelo al mix antes de registrar la acción.');
    return;
  }
  // Pre-llenado: fecha de hoy + resumen del mix
  const hoy = new Date().toISOString().slice(0, 10);
  $('acc_fecha').value = hoy;
  $('acc_estado').value = 'planificada';
  $('acc_descripcion').value = '';
  $('acc_observaciones').value = '';
  $('acc_fecha_ej').value = '';
  $('acc_status').textContent = '';
  $('acc_status').className = 'sgm-modal-status';

  // Resumen del cálculo
  const resumen = $('modalAccionResumen');
  if (resumen && state.lastEval) {
    const ev = state.lastEval;
    const matricula = (_val('mat_input').trim()) || '—';
    const sub = _val('t_sub') || '—';
    const aprobado = ev.aprobado;
    resumen.innerHTML = `
      <div><b>Transformador:</b> ${escaparHtml(matricula)} · <b>Subestación:</b> ${escaparHtml(sub)}</div>
      <div><b>Mix:</b> ${state.mix.length} modelo(s) · ${ev.n_unidades_total} unidades · ${formatearNumero(ev.cfm_aporte_total)} CFM total</div>
      <div><b>CFM requerido:</b> ${formatearNumero(state.cfmReq)} · <b>Cobertura:</b> ${ev.cobertura_pct !== null ? ev.cobertura_pct.toFixed(1) + '%' : '—'} · <b>Estado:</b> <span style="color:${aprobado ? '#1b5e20' : '#b71c1c'}">${aprobado ? '✓ APROBADO' : '✗ NO APROBADO'}</span></div>
    `;
  }
  modal.hidden = false;
  setTimeout(() => $('acc_descripcion')?.focus(), 50);
}

function closeModalAccion() {
  const modal = $('modalAccion');
  if (modal) modal.hidden = true;
}

async function guardarAccion() {
  const status = $('acc_status');
  const btnGuardar = $('btnGuardarAccion');
  const setStatus = (msg, kind = 'info') => {
    status.textContent = msg;
    status.className = 'sgm-modal-status is-' + kind;
  };
  try {
    btnGuardar.disabled = true;
    setStatus('Guardando…', 'info');

    // 1) Lectura del modal
    const descripcion   = $('acc_descripcion').value.trim();
    const estado        = $('acc_estado').value;
    const fechaAccion   = $('acc_fecha').value;
    const fechaEj       = $('acc_fecha_ej').value;
    const observaciones = $('acc_observaciones').value.trim();

    if (!descripcion || descripcion.length < 10) {
      throw new Error('La descripción debe tener al menos 10 caracteres.');
    }
    if (!fechaAccion) throw new Error('La fecha de la acción es obligatoria.');

    // 2) Lectura del formulario completo
    const matricula = (_val('mat_input').trim()) || '';
    if (!matricula) throw new Error('Selecciona un transformador (matrícula AFINIA) antes de registrar la acción.');

    // 3) Snapshot del cálculo
    const cfmCalc = calcularRefrigeracion({ kva_onan: getOnan(), pct: getPct(), alt: getAlt() });
    const mixForEval = state.mix.map(it => ({
      key: it.key, modelo: it.modelo, marca: it.marca,
      cfm_unitario: it.cfm_unitario, cantidad: it.cantidad
    }));
    const tolerancia = getTolerancia();
    const evaluacion = evaluarMixVentiladores({ items: mixForEval, cfm_requerido: cfmCalc.cfm_nivel_mar, tolerancia_pct: tolerancia });
    const connKey = getMotorConn();
    const itemsProt = state.mix.map(it => {
      const iU = extraerCorrienteFan(it.ficha?.fan_amp, connKey);
      return {
        key: it.key, modelo: it.modelo, marca: it.marca, cantidad: it.cantidad,
        amps_unitario: Number.isFinite(iU) ? iU : 0,
        kw_unitario:   (+it.ficha?.fan_kw / 1000) || 0,
        peso_unitario: +it.ficha?.fan_peso || 0
      };
    });
    const proteccion = calcularProteccionMix({ items: itemsProt, factor_seguridad: 1.25 });
    const compat = evaluarCompatibilidad({
      A: parseFloat(_val('rad_A')), B: parseFloat(_val('rad_B')), C: parseFloat(_val('rad_C')),
      diametro_mm: parseFloat(_val('fan_diam')), distancia_mm: parseFloat(_val('mon_dist')),
      disposicion: _val('disposicion')
    });

    // 4) Identidad del usuario logueado
    const session = window.__sgmSession || {};
    const responsable_uid    = session.user?.uid || '';
    const responsable_email  = session.user?.email || session.profile?.email || '';
    const responsable_nombre = session.profile?.nombre || responsable_email || 'Responsable';

    // 5) Payload final
    const payload = {
      transformador_id: matricula,        // El catálogo AFINIA usa la matrícula como ID
      matricula,
      proyecto:      _val('proyecto').trim(),
      subestacion:   _val('t_sub'),
      zona:          _val('t_zona'),
      departamento:  _val('t_dept'),
      grupo:         _val('t_grupo'),
      serie:         _val('t_serie'),
      refrigeracion: _val('t_refrig'),

      kva_onan:      getOnan(),
      kva_onaf:      getOnaf(),
      pct:           getPct(),
      altitud:       getAlt(),
      cfm_requerido: cfmCalc.cfm_nivel_mar,
      cfm_corregido: cfmCalc.cfm_corregido,
      tolerancia_pct: tolerancia,

      mix: state.mix.map(it => ({
        key:          it.key,
        marca:        it.marca,
        modelo:       it.modelo,
        cfm_unitario: it.cfm_unitario,
        cantidad:     it.cantidad,
        ficha:        { ...(it.ficha || {}) }      // unfreeze para serializar
      })),
      evaluacion,
      proteccion,
      compatibilidad: compat,

      accion_descripcion: descripcion,
      estado_accion:      estado,
      fecha_accion:       fechaAccion,
      fecha_ejecucion:    fechaEj || '',
      observaciones,

      responsable_uid,
      responsable_nombre,
      responsable_email
    };

    // 6) Persistir vía data layer (lazy import)
    const mod = await import('./data/acciones_refrigeracion.js');
    if (!mod.isReady()) {
      throw new Error('Firebase no está configurado · contacte al administrador.');
    }
    const id = await mod.crear(payload, responsable_uid);
    setStatus(`✓ Acción registrada con ID ${id}`, 'success');
    setTimeout(closeModalAccion, 1500);
  } catch (err) {
    console.error('[acciones_refrigeracion] guardarAccion failed:', err);
    setStatus('✗ ' + (err?.message || String(err)), 'error');
  } finally {
    btnGuardar.disabled = false;
  }
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

    // ── Mix: snapshot de evaluación + protección + sugerencias ──
    //
    // El informe lee state.mix como fuente de verdad. Si el director
    // generó el informe sin agregar nada al mix, se cae con un aviso
    // legible. Las funciones puras del dominio garantizan idempotencia.
    const connKey = getMotorConn();
    const mixForEval = state.mix.map(it => ({
      key: it.key, modelo: it.modelo, marca: it.marca,
      cfm_unitario: it.cfm_unitario, cantidad: it.cantidad
    }));
    const mixEval = evaluarMixVentiladores({
      items: mixForEval,
      cfm_requerido: state.cfmReq,
      tolerancia_pct: getTolerancia()
    });
    const fanDb = state.fanDb || {};
    const mixSugs = (mixEval.estado === MIX_ESTADO.NO_APROBADO)
      ? sugerirMejoras({
          items: mixForEval,
          cfm_requerido: state.cfmReq,
          fan_db: fanDb,
          max_sugerencias: 3
        })
      : [];

    // Filas del mix en la tabla del informe
    const mixRows = state.mix.length === 0
      ? `<tr><td colspan="7" class="tc" style="font-style:italic;color:#888;padding:14px">Sin modelos agregados al mix · use "Agregar al mix" en la calculadora antes de exportar.</td></tr>`
      : mixEval.items.map((it, i) => `<tr>
          <td class="tc">${i + 1}</td>
          <td>${escaparHtml(it.marca)}</td>
          <td>${escaparHtml(it.modelo)}</td>
          <td class="tr mono">${formatearNumero(it.cfm_unitario)}</td>
          <td class="tc mono"><strong>${it.cantidad}</strong></td>
          <td class="tr mono"><strong>${formatearNumero(it.cfm_aporte)}</strong></td>
          <td class="tr mono">${it.aporte_pct !== null ? it.aporte_pct.toFixed(1) + '%' : '—'}</td>
        </tr>`).join('');

    // Protección eléctrica — agrupada por modelo via dominio puro
    const itemsProt = state.mix.map(it => {
      const iU = extraerCorrienteFan(it.ficha?.fan_amp, connKey);
      return {
        key:           it.key,
        modelo:        it.modelo,
        marca:         it.marca,
        cantidad:      it.cantidad,
        amps_unitario: Number.isFinite(iU) ? iU : 0,
        kw_unitario:   (+it.ficha?.fan_kw / 1000) || 0,
        peso_unitario: +it.ficha?.fan_peso || 0,
        cosphi:        +it.ficha?.fan_cosphi || 0
      };
    });
    const protMix = calcularProteccionMix({ items: itemsProt, factor_seguridad: 1.25 });

    // Suma de potencia aparente sobre los grupos: S_grupo = P_grupo / cosφ_grupo
    const kvaTotalMix = itemsProt.reduce((s, it) => {
      if (!it.cosphi || !it.kw_unitario || !it.cantidad) return s;
      return s + (it.kw_unitario * it.cantidad / it.cosphi);
    }, 0);

    let protBlock, materiales;
    if (state.mix.length > 0 && protMix.amps_totales > 0) {
      // Tabla resumen con grupos (una fila por modelo) + totales
      const filasGrupos = protMix.grupos.map(g => `
        <tr>
          <td>${escaparHtml(g.marca)} ${escaparHtml(g.modelo)}</td>
          <td class="tc mono">${g.cantidad}</td>
          <td class="tr mono">${g.amps_unitario.toFixed(2)} A</td>
          <td class="tr mono"><strong>${g.amps_grupo.toFixed(2)} A</strong></td>
          <td class="mono">${g.guardamotor ? `${g.cantidad} × ABB ${g.guardamotor.model}` : 'Fuera de catálogo MS116'}</td>
          <td class="mono">${g.guardamotor ? `setting ${g.amps_unitario.toFixed(2)} A · PID ${g.guardamotor.pid}` : '—'}</td>
        </tr>`).join('');
      protBlock = `
        <table class="ft">
          <thead>
            <tr>
              <th>Grupo · Marca / Modelo</th>
              <th class="tc" style="width:50px">Cant.</th>
              <th class="tr" style="width:80px">A / unidad</th>
              <th class="tr" style="width:90px">A grupo</th>
              <th>Guardamotor (1 por unidad)</th>
              <th>Detalles</th>
            </tr>
          </thead>
          <tbody>${filasGrupos}</tbody>
          <tfoot>
            <tr style="background:#f0f7ff;font-weight:600">
              <td><strong>Σ Sistema completo (mix)</strong></td>
              <td class="tc mono">${protMix.n_total}</td>
              <td class="tr mono">—</td>
              <td class="tr mono"><strong>${protMix.amps_totales.toFixed(2)} A</strong></td>
              <td class="mono">1 × Breaker ${protMix.breaker ? 'ABB ' + protMix.breaker.model : '—'}</td>
              <td class="mono">${protMix.breaker ? `In ${protMix.breaker.in} A · PID ${protMix.breaker.pid}` : 'Excede S203 (50 A)'}</td>
            </tr>
          </tfoot>
        </table>
        <table class="rpt-table" style="margin-top:8pt">
          <tbody>
            ${_row('Conexión motor', conn)}
            ${_row('Corriente total del sistema (Σ grupos)', protMix.amps_totales.toFixed(2) + ' A', true)}
            ${_row('Corriente mínima del breaker (×1.25 NEC 430)', protMix.amps_min_breaker.toFixed(2) + ' A', true)}
            ${_row('Potencia eléctrica total absorbida (Σ kW grupos)', protMix.kw_totales.toFixed(2) + ' kW', true)}
            ${kvaTotalMix > 0 ? _row('Potencia aparente total (S = Σ P/cos φ)', kvaTotalMix.toFixed(2) + ' kVA', true) : ''}
            ${_row('Peso total motoventiladores (Σ peso × cant)', protMix.peso_total.toFixed(1) + ' kg', true)}
            ${_row('Auxiliar breaker (SCADA)', `1 × ABB ${protMix.aux_breaker.model} · PID ${protMix.aux_breaker.pid}`)}
          </tbody>
        </table>`;

      // Lista de materiales agrupada por modelo + ítems del sistema
      const items = [];
      for (const g of protMix.grupos) {
        const itGrupo = state.mix.find(x => x.key === g.key);
        const fch = itGrupo?.ficha || {};
        items.push({
          qty: g.cantidad,
          model: `Motoventilador ${escaparHtml(g.marca)} ${escaparHtml(g.modelo)}`,
          pid: escaparHtml(fch.fan_nserie || '—'),
          notes: `${fch.fan_diam || '?'} mm Ø · ${fch.fan_cfm_nom || '?'} CFM · ${fch.fan_hz || '?'} Hz · grupo ${g.amps_grupo.toFixed(2)} A`
        });
        if (g.guardamotor) {
          items.push({
            qty: g.cantidad,
            model: `Guardamotor ABB ${g.guardamotor.model} (para ${escaparHtml(g.modelo)})`,
            pid: g.guardamotor.pid,
            notes: `Rango ajuste ${g.guardamotor.min}–${g.guardamotor.max} A · setting ${g.amps_unitario.toFixed(2)} A`
          });
        }
        items.push({
          qty: g.cantidad,
          model: `Auxiliar guardamotor ABB ${g.aux_guardamotor.model}`,
          pid: g.aux_guardamotor.pid,
          notes: g.aux_guardamotor.desc
        });
      }
      if (protMix.breaker) {
        items.push({
          qty: 1,
          model: `Breaker principal ABB ${protMix.breaker.model}`,
          pid: protMix.breaker.pid,
          notes: `In ${protMix.breaker.in} A · 3P · Curva C · 6 kA · pérdidas ${protMix.breaker.power_w} W · cubre toda la corriente del mix (${protMix.amps_totales.toFixed(2)} A)`
        });
      }
      items.push({
        qty: 1,
        model: `Auxiliar breaker ABB ${protMix.aux_breaker.model}`,
        pid: protMix.aux_breaker.pid,
        notes: protMix.aux_breaker.desc
      });
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
      protBlock  = '<p style="font-style:italic;color:#888">Sin modelos en el mix con corriente válida · agregue al menos un modelo del catálogo y verifique conexión Δ/Y.</p>';
      materiales = '<p style="font-style:italic;color:#888">Lista de materiales no disponible · agregue modelos al mix antes de exportar.</p>';
    }

    // Pre-cómputos para mostrar fórmulas con valores reales sustituidos
    const onanFmt = formatearNumero(r.onan);
    const cfmFmt  = formatearNumero(r.cfm_nivel_mar);
    const cfmAlt  = formatearNumero(r.cfm_corregido);
    const altFmt  = formatearNumero(getAlt());
    const fAltFmt = r.factor_altitud.toFixed(4);
    const slopeFmt= r.pendiente.toFixed(3);
    const pctFmt  = getPct().toFixed(1);
    // §8 — fórmula del mix aplicada (suma de aportes por modelo)
    const formulaSeleccion = state.mix.length > 0
      ? `<div class="formula-box">
           <div class="l">Fórmula del mix aplicada</div>
           <div class="sym">CFM<sub>mix</sub> = Σ (Cantidad<sub>i</sub> × CFM<sub>unitario,i</sub>) <span class="arrow">≥</span> CFM<sub>requerido</sub></div>
           <div class="apply">CFM<sub>mix</sub> = ${state.mix.map(it => `${it.cantidad} × ${formatearNumero(it.cfm_unitario)}`).join(' + ')} <span class="arrow">→</span> <span class="res">${formatearNumero(mixEval.cfm_aporte_total)} CFM</span></div>
           <div class="apply">CFM<sub>requerido</sub> = <span class="res">${formatearNumero(state.cfmReq)} CFM</span> · cobertura ${mixEval.cobertura_pct !== null ? mixEval.cobertura_pct.toFixed(1) + '%' : '—'} · ${mixEval.aprobado ? `exceso ${formatearNumero(mixEval.exceso)} CFM` : `déficit ${formatearNumero(mixEval.deficit)} CFM`}</div>
         </div>`
      : `<div class="formula-box">
           <div class="l">Fórmula aplicable</div>
           <div class="sym">CFM<sub>mix</sub> = Σ (Cantidad<sub>i</sub> × CFM<sub>unitario,i</sub>)</div>
           <div class="apply">Agregue al menos un modelo del catálogo al mix antes de exportar el informe.</div>
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

    // §9 — fórmulas eléctricas aplicadas (mix multi-modelo)
    let formulaProt = '';
    if (state.mix.length > 0 && protMix.amps_totales > 0) {
      const sumGrupos = protMix.grupos
        .map(g => `(${g.cantidad} × ${g.amps_unitario.toFixed(2)} A)`)
        .join(' + ');
      formulaProt = `
        <div class="formula-box">
          <div class="l">Corriente total del sistema (suma de grupos)</div>
          <div class="sym">I<sub>total</sub> = Σ (Cantidad<sub>i</sub> × I<sub>unitario,i</sub>)</div>
          <div class="apply">I<sub>total</sub> = ${sumGrupos} <span class="arrow">→</span> <span class="res">${protMix.amps_totales.toFixed(2)} A</span></div>
        </div>
        <div class="formula-box">
          <div class="l">Corriente mínima del breaker principal (NEC 430 — factor de seguridad ×1.25)</div>
          <div class="sym">I<sub>min,breaker</sub> = 1.25 × I<sub>total</sub></div>
          <div class="apply">I<sub>min,breaker</sub> = 1.25 × ${protMix.amps_totales.toFixed(2)} A <span class="arrow">→</span> <span class="res">${protMix.amps_min_breaker.toFixed(2)} A</span></div>
        </div>
        ${protMix.kw_totales > 0 ? `
        <div class="formula-box">
          <div class="l">Potencia eléctrica total absorbida (Σ por grupo)</div>
          <div class="sym">P<sub>total</sub> = Σ (Cantidad<sub>i</sub> × P<sub>1,i</sub>)</div>
          <div class="apply">P<sub>total</sub> = <span class="res">${protMix.kw_totales.toFixed(2)} kW</span></div>
        </div>` : ''}
        ${kvaTotalMix > 0 ? `
        <div class="formula-box">
          <div class="l">Potencia aparente total (Σ por grupo / cos φ del grupo)</div>
          <div class="sym">S<sub>total</sub> = Σ (P<sub>i</sub> / cos φ<sub>i</sub>)</div>
          <div class="apply">S<sub>total</sub> = <span class="res">${kvaTotalMix.toFixed(2)} kVA</span></div>
        </div>` : ''}
        ${protMix.peso_total > 0 ? `
        <div class="formula-box">
          <div class="l">Peso total del conjunto motoventiladores</div>
          <div class="sym">W<sub>total</sub> = Σ (Cantidad<sub>i</sub> × Peso<sub>unitario,i</sub>)</div>
          <div class="apply">W<sub>total</sub> = <span class="res">${protMix.peso_total.toFixed(1)} kg</span></div>
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
     Casacara). El header y footer se inyectan EXPLICITAMENTE en
     cada hoja .sheet via JavaScript de paginacion al cargar el
     documento. Este metodo es el unico 100% portable entre
     Chrome, Edge, Firefox y Safari (WebKit/macOS) en window.print().
     thead/tfoot de tabla NO se repiten en Safari (bug WebKit
     historico) y position:fixed con @page margin es inestable
     entre browsers. */
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

  /* Hoja fisica de Letter — width 8.5in x height 11in. Cada
     .sheet tiene SU PROPIO header (top), footer (bottom) y
     content (centro). Los assets reusan las mismas imagenes
     oficiales del Formato Afinia. */
  .sheet {
    width: 8.5in;
    height: 11in;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    box-sizing: border-box;
  }
  .sheet:last-child { page-break-after: auto; }
  .sheet-header {
    position: absolute;
    top: 0; left: 0; right: 0;
    width: 100%;
    height: 1.0in;
  }
  .sheet-footer {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    width: 100%;
    height: 1.07in;
  }
  .sheet-content {
    position: absolute;
    top: 1.0in;
    bottom: 1.07in;
    left: 1.18in;
    right: 1.18in;
    overflow: hidden;
  }
  .afinia-header-img,
  .afinia-footer-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
  }
  .sheet-footer { position: absolute; }
  .sheet-footer .footer-text {
    position: absolute;
    left: 6%; right: 6%; bottom: 14%;
    text-align: center;
    font-size: 6.5pt; color: #fff;
    font-weight: 600; letter-spacing: .01em;
    line-height: 1.2;
  }

  /* Buffer oculto: contiene el contenido completo del informe
     antes de que el script de paginacion lo distribuya en hojas. */
  .report-buffer {
    position: absolute;
    left: -10000px;
    width: calc(8.5in - 2 * 1.18in);
    visibility: hidden;
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

  /* Bloque firma · Elaborado/Aprobado · formato etiqueta/valor lineal */
  .firma-block { margin-top: 14pt; }
  .firma-data { margin: 6pt 0 12pt; }
  .firma-pair { margin-bottom: 6pt; }
  .firma-key {
    font-size: 7.5pt; font-weight: 700; color: #0d3a73;
    text-transform: uppercase; letter-spacing: .04em; line-height: 1.2;
  }
  .firma-val { font-size: 9pt; color: #1a1a1a; line-height: 1.3; margin-top: 1pt; }
  .firma-block-img { margin-top: 12pt; max-width: 3in; }
  .firma-img { display: block; max-width: 2.5in; max-height: 0.75in; margin-bottom: 2pt; }
  .firma-line-under { width: 2.5in; border-top: 1px solid #1a1a1a; }
  .firma-cap { font-size: 7pt; color: #555; margin-top: 2pt; }

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

  /* SCREEN preview: cada hoja .sheet centrada con sombra. */
  @media screen {
    body { background: #888; padding: 24px 0; }
    .report-paginated {
      display: block;
    }
    .sheet {
      margin: 0 auto 24px;
      background: #fff;
      box-shadow: 0 4px 18px rgba(0,0,0,.18);
    }
  }

  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; }
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

<!-- Buffer oculto: contiene el flujo completo del informe sin paginar.
     El script de paginacion al final del body distribuye estos
     bloques en .sheet divs (una por hoja fisica), inyectando header
     y footer en CADA hoja. Este metodo es 100% portable entre
     Chrome, Edge, Firefox y Safari en window.print(). -->
<div class="report-buffer" aria-hidden="true">
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
  <section class="section-anchor start-new-page">
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

  <!-- ── 5 · DATOS DE LOS MOTOVENTILADORES (mix multi-modelo) ── -->
  <section class="section-anchor">
    <h2>5. Datos de los motoventiladores del mix</h2>
    <p class="meta">${state.mix.length === 0
      ? 'Sin modelos agregados al mix · use "Agregar al mix" en la calculadora antes de exportar.'
      : `El sistema combina <strong>${state.mix.length} modelo${state.mix.length === 1 ? '' : 's'}</strong> diferente${state.mix.length === 1 ? '' : 's'} de motoventilador. A continuación se detalla la ficha técnica completa de cada uno tal como fue cargada del catálogo certificado.`}
    </p>
  </section>
  ${state.mix.map((it, idx) => {
    const f = it.ficha || {};
    const flow_unit = f.fan_flow_unit || '';
    const flow_lbl = ETIQUETAS_CAUDAL_ALT[flow_unit] || flow_unit;
    return `
    <section class="section-anchor">
      <h3>5.${idx + 1} · ${escaparHtml(it.marca)} ${escaparHtml(it.modelo)} · <span class="mono">${it.cantidad} unidad${it.cantidad === 1 ? '' : 'es'}</span></h3>
      <p class="meta">Aporte de este modelo al mix: <strong class="mono">${formatearNumero(it.cantidad * it.cfm_unitario)} CFM</strong> (${it.cantidad} × ${formatearNumero(it.cfm_unitario)} CFM/u)</p>
      <table class="rpt-table">
        <tbody>
          ${_row('Marca',                 it.marca)}
          ${_row('Modelo / Referencia',   it.modelo)}
          ${_row('N.° artículo / parte',  f.fan_nserie)}
          ${_row('Tipo de pala',          f.fan_tipo_pala)}
          ${_row('Diámetro nominal (mm)', f.fan_diam,    true)}
          ${_row('Número de aspas',       f.fan_aspas,   true)}
          ${_row('RPM nominal',           f.fan_rpm,     true)}
          ${_row('Posición de montaje',   f.fan_montaje)}
          ${_row('Peso unitario (kg)',    f.fan_peso,    true)}
          ${_row('Peso del grupo (kg)',   f.fan_peso ? (f.fan_peso * it.cantidad).toFixed(1) : '—', true)}
          ${_row('Caudal de entrada',     f.fan_flow_val ? `${f.fan_flow_val} ${flow_lbl}` : '—', true)}
          ${_row('CFM nominal (ft³/min)', f.fan_cfm_nom, true)}
          ${_row('Equivalente m³/s',      f.fan_m3s,     true)}
        </tbody>
      </table>
    </section>
    <section class="section-anchor">
      <h3>5.${idx + 1}.1 · Motor eléctrico — ${escaparHtml(it.modelo)}</h3>
      <table class="rpt-table">
        <tbody>
          ${_row('Tensión nominal · conexión', f.fan_volt)}
          ${_row('Frecuencia',                 (f.fan_hz || '') + ' Hz', true)}
          ${_row('Potencia absorbida P₁',      (f.fan_kw  || '') + ' W',  true)}
          ${_row('Potencia del grupo (kW)',    f.fan_kw ? (f.fan_kw * it.cantidad / 1000).toFixed(2) : '—', true)}
          ${_row('Corriente nominal',          f.fan_amp,        true)}
          ${_row('Factor de potencia cos φ',   f.fan_cosphi,     true)}
          ${_row('Grado de protección',        f.fan_ip)}
          ${_row('Clase de aislamiento',       f.fan_aislam)}
          ${_row('Protección del motor',       f.fan_protmotor)}
          ${_row('Temperatura mínima (°C)',    f.fan_tmin, true)}
          ${_row('Sentido de rotación',        f.fan_sentido)}
          ${_row('Certificación',              f.fan_cert)}
          ${_row('Material palas / rotor',     f.fan_material)}
        </tbody>
      </table>
    </section>`;
  }).join('')}

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
        <th>Marca</th>
        <th>Modelo</th>
        <th class="tr" style="width:90px">CFM / unidad</th>
        <th class="tc" style="width:65px">Cantidad</th>
        <th class="tr" style="width:120px">Aporte CFM</th>
        <th class="tr" style="width:70px">Aporte %</th>
      </tr>
    </thead>
    <tbody>${mixRows}</tbody>
    ${state.mix.length > 0 ? `<tfoot>
      <tr style="background:#f0f7ff;font-weight:700">
        <td colspan="4" class="tr">Σ Totales del mix</td>
        <td class="tc mono">${mixEval.n_unidades_total}</td>
        <td class="tr mono"><strong>${formatearNumero(mixEval.cfm_aporte_total)} CFM</strong></td>
        <td class="tr mono">100%</td>
      </tr>
    </tfoot>` : ''}
  </table>

  <!-- Banner de estado del mix · APROBADO ✓ / NO APROBADO ✗ / SIN DATOS ── -->
  ${state.mix.length > 0 ? `<div class="info-box" style="background:${
    mixEval.aprobado ? '#e8f5e9' : '#ffebee'
  };border-color:${
    mixEval.aprobado ? '#81c784' : '#ef9a9a'
  };color:${mixEval.aprobado ? '#1b5e20' : '#b71c1c'}">
    <strong>${mixEval.aprobado ? '✓ Mix APROBADO' : '✗ Mix NO APROBADO'}:</strong>
    ${escaparHtml(mixEval.mensaje)}
    <br><span class="mono" style="font-size:7.5pt">Cobertura: <strong>${mixEval.cobertura_pct.toFixed(1)}%</strong> · ${
      mixEval.aprobado
        ? `Exceso: <strong>${formatearNumero(mixEval.exceso)} CFM</strong>`
        : `Déficit: <strong>${formatearNumero(mixEval.deficit)} CFM</strong>`
    } · Total ventiladores: <strong>${mixEval.n_unidades_total}</strong></span>
  </div>` : ''}

  <!-- Sugerencias del motor (solo si NO aprobado) ── -->
  ${mixSugs.length > 0 ? `<section class="section-anchor">
    <h3>Sugerencias para alcanzar el CFM requerido</h3>
    <p class="meta">El sistema propone hasta 3 alternativas ordenadas por menor exceso (ajuste más fino primero) basadas en el catálogo certificado de motoventiladores.</p>
    <table class="ft">
      <thead>
        <tr>
          <th class="tc" style="width:30px">#</th>
          <th style="width:90px">Estrategia</th>
          <th>Acción propuesta</th>
          <th class="tr" style="width:120px">CFM resultante</th>
          <th class="tr" style="width:80px">Cobertura</th>
          <th class="tr" style="width:80px">Exceso</th>
        </tr>
      </thead>
      <tbody>${mixSugs.map((s, i) => `
        <tr>
          <td class="tc">${i + 1}</td>
          <td><strong>${({
            agregar_unidades: 'Agregar más unidades',
            sustituir:        'Sustituir modelo débil',
            agregar_modelo:   'Agregar modelo nuevo'
          }[s.estrategia] || s.estrategia)}</strong></td>
          <td>${escaparHtml(s.descripcion)}</td>
          <td class="tr mono">${formatearNumero(s.cfm_aporte_total)} CFM</td>
          <td class="tr mono">${s.cobertura_pct.toFixed(1)}%</td>
          <td class="tr mono">${formatearNumero(s.exceso)} CFM</td>
        </tr>`).join('')}</tbody>
    </table>
  </section>` : ''}

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

  <!-- ── FIRMAS · ELABORADO/APROBADO ─────────────────────── -->
  <section class="section-anchor firma-block">
    <h2>11. Elaborado / Aprobado</h2>
    <div class="firma-data">
      <div class="firma-pair"><div class="firma-key">Elaborado / Aprobado</div><div class="firma-val">Ing. Miguel Jimenez</div></div>
      <div class="firma-pair"><div class="firma-key">Cargo</div><div class="firma-val">Líder de Transformadores de Potencia AFINIA</div></div>
      <div class="firma-pair"><div class="firma-key">Unidad</div><div class="firma-val">Mantenimiento Red Alta Tensión</div></div>
    </div>
    <div class="firma-block-img">
      <img src="../assets/img/afinia/firma-miguel-jimenez.png" alt="Firma Ing. Miguel Jimenez" class="firma-img">
      <div class="firma-line-under"></div>
      <div class="firma-cap">Firma</div>
    </div>
  </section>

</article>
</div>

<!-- Contenedor de hojas paginadas: el script de abajo lo rellena
     con divs .sheet que tienen header + content + footer cada uno. -->
<div class="report-paginated"></div>

<script>
  // Paginacion manual: funciona en TODOS los navegadores (Chrome,
  // Safari, Firefox, Edge) en window.print() porque el header y
  // footer son explicitamente parte de cada hoja .sheet, no se
  // depende de @page running headers ni de thead/tfoot repetidos
  // (Safari NO repite estos ultimos). Cada .sheet tiene 8.5x11in
  // con header absolute top y footer absolute bottom; el contenido
  // del informe se mueve un bloque a la vez al sheet-content del
  // sheet actual; cuando el contenido excede el alto disponible,
  // el bloque pasa a una nueva hoja.
  //
  // CRITICO: la paginacion se ejecuta DESPUES de que todas las
  // imagenes hayan cargado, porque scrollHeight subestima el alto
  // del contenido cuando los <img> aun no tienen su altura natural,
  // lo que provocaria que tablas y bloques se "metan" en una hoja
  // donde no caben y queden recortados por overflow:hidden.
  (function () {
    const HEADER_HTML = ${JSON.stringify(`<img class="afinia-header-img" src="${headerImg}" alt="">`)};
    const FOOTER_HTML = ${JSON.stringify(`<img class="afinia-footer-img" src="${footerImg}" alt=""><div class="footer-text">CaribeMar de la Costa S.A.S E.S.P. / Carrera 13B #26 – 78 Edificio Chambacú – Piso 1 / Cartagena.</div>`)};

    function waitImages(root) {
      const imgs = Array.from(root.querySelectorAll('img'));
      return Promise.all(imgs.map(img => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
          // Failsafe timeout 5s
          setTimeout(res, 5000);
        });
      }));
    }

    function paginate() {
      const buffer = document.querySelector('.report-buffer');
      const out = document.querySelector('.report-paginated');
      if (!buffer || !out) return;

      function newSheet() {
        const s = document.createElement('div');
        s.className = 'sheet';
        s.innerHTML =
          '<div class="sheet-header">' + HEADER_HTML + '</div>' +
          '<div class="sheet-content"></div>' +
          '<div class="sheet-footer">' + FOOTER_HTML + '</div>';
        out.appendChild(s);
        return s.querySelector('.sheet-content');
      }
      function fits(content) {
        return content.scrollHeight <= content.clientHeight;
      }
      // Detecta si un bloque es un h2/h3 huerfano: una <section> que
      // solo contiene el titulo + parrafo meta corto (sin tabla,
      // formula, KPI ni info-box). Si la hoja actual termina en uno
      // de estos al hacer overflow, lo movemos a la siguiente hoja.
      function isOrphanTitleBlock(el) {
        if (!el || !el.classList) return false;
        if (!el.classList.contains('section-anchor')) return false;
        const heavy = el.querySelector('table, .formula-box, .rpt-table, .ft, .kpi-grid, .chart-block, .rad-diagram, .info-box, .estado, .materiales');
        return heavy === null;
      }

      const article = buffer.querySelector('.report');
      const blocks = Array.from(article.children);
      let content = newSheet();

      for (const block of blocks) {
        // Si el bloque pide forzar nueva hoja antes y la hoja actual
        // ya tiene contenido, cerramos esta hoja y empezamos otra.
        const forceBreak = block.classList && block.classList.contains('start-new-page');
        if (forceBreak && content.children.length > 0) {
          content = newSheet();
        }
        content.appendChild(block);
        if (!fits(content)) {
          // Mover este bloque a una nueva hoja
          content.removeChild(block);
          // Si la hoja actual termina con un titulo huerfano (h2 sin
          // contenido pesado siguiente), tambien lo movemos para
          // evitar dejarlo solo al pie de pagina.
          const last = content.lastElementChild;
          const carryOver = isOrphanTitleBlock(last) ? last : null;
          if (carryOver) content.removeChild(carryOver);
          content = newSheet();
          if (carryOver) content.appendChild(carryOver);
          content.appendChild(block);
        }
      }
      buffer.remove();
    }

    // Esperar imagenes (header, footer, diagrama radiador, firma,
    // grafica chart-img) ANTES de paginar. Si paginamos antes, las
    // alturas son subestimadas y los bloques se traslapan dentro de
    // una sola hoja, recortando contenido por overflow:hidden.
    waitImages(document.body).then(() => {
      paginate();
      setTimeout(() => window.print(), 250);
    });
  })();
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

  $('btnAddToMix')?.addEventListener('click', addToMix);
  // Cambio de tolerancia → recalcular banner + sugerencias en vivo
  $('mix_tolerancia')?.addEventListener('input', () => { renderMix(); });
  $('btnExportReport')?.addEventListener('click', generateReport);
  $('btnRegistrarAccion')?.addEventListener('click', openModalAccion);
  $('btnGuardarAccion')?.addEventListener('click', guardarAccion);
  $('btnPrint')?.addEventListener('click', () => window.print());

  // Cierre del modal: backdrop + botón ✕ + tecla Escape
  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', closeModalAccion);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modalAccion')?.hidden) closeModalAccion();
  });

  // Delegación para los inputs de cantidad y botones de eliminar en
  // la tabla del mix (filas dinámicas).
  $('mix-tbody')?.addEventListener('input', (e) => {
    const qtyId = e.target?.dataset?.mixQty;
    if (qtyId) updateMixQty(+qtyId, e.target.value);
  });
  $('mix-tbody')?.addEventListener('click', (e) => {
    const rid = e.target?.closest?.('[data-mix-remove]')?.dataset?.mixRemove;
    if (rid) removeFromMix(+rid);
  });
  // Click sobre "Aplicar sugerencia" en el panel de sugerencias.
  $('mix-suggestions')?.addEventListener('click', (e) => {
    const idx = e.target?.closest?.('[data-mix-apply]')?.dataset?.mixApply;
    if (idx !== undefined) applyMixSuggestion(+idx);
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
    renderMix();
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
