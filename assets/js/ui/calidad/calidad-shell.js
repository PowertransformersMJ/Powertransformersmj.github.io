// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · SHELL
// ──────────────────────────────────────────────────────────────
// Boot del dashboard. Hidrata el store en este orden:
//   1. IndexedDB (si el usuario cargó un archivo previamente)
//   2. Baseline JSON local (assets/data/...)
//   3. Firestore realtime cuando esté configurado/poblado
//
// Cada render va en try/catch para que un fallo individual no
// rompa la cadena. Errores visibles en banner #calidad-error.
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { inicializarFiltros, pintarSelectorZona, actualizarPill, sincronizarChipsGrupos, sincronizarSerieModo } from './filtros.js';
import { suscribirIndicadoresCalidad, cargarBaselineLocal } from '../../data/indicadores_calidad.js';
import { inicializarPersistencia, limpiarPersistencia, handleFiles } from './upload.js';

import { renderKPIs }       from './renderers/kpis.js';
import { renderInsight }    from './renderers/insight.js';
import { renderSerie }      from './renderers/serie.js';
import { renderStack }      from './renderers/stack.js';
import { renderPart }       from './renderers/part.js';
import { renderVarMoM }     from './renderers/varmom.js';
import { renderTop }        from './renderers/top.js';
import { renderHeatmap }    from './renderers/heatmap.js';
import { renderProyeccion } from './renderers/proyeccion.js';
import { renderMonthTable } from './renderers/month-table.js';

const $ = (sel) => document.querySelector(sel);

const PLOTLY_CDN = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
let _plotlyPromise = null;
function loadPlotly() {
  if (typeof window !== 'undefined' && typeof window.Plotly !== 'undefined') {
    return Promise.resolve(window.Plotly);
  }
  if (_plotlyPromise) return _plotlyPromise;
  _plotlyPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PLOTLY_CDN;
    s.async = true;
    s.onload  = () => typeof window.Plotly === 'undefined'
      ? reject(new Error('Plotly cargó pero el global no está disponible.'))
      : resolve(window.Plotly);
    s.onerror = () => reject(new Error('No se pudo descargar Plotly desde CDN.'));
    document.head.appendChild(s);
  });
  return _plotlyPromise;
}

// ── UI helpers para errores y log ────────────────────────────
function mostrarError(msg) {
  const banner = $('#calidad-error');
  if (!banner) return;
  banner.style.display = 'block';
  banner.innerHTML = '⚠ ' + msg;
}
function ocultarError() {
  const banner = $('#calidad-error');
  if (banner) banner.style.display = 'none';
}
function log(level, msg) {
  const out = $('#upload-log');
  if (!out) return;
  out.classList.add('show');
  out.style.display = 'block';
  const line = document.createElement('div');
  if (level === 'err')  line.className = 'err';
  if (level === 'info') line.className = 'info';
  if (level === 'ok')   line.className = 'ok';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}
function actualizarSourcePill(source, meta) {
  const pill = $('#upload-source-pill');
  if (!pill) return;
  if (source === 'upload' && meta?.nombre) {
    pill.textContent = `archivo: ${meta.nombre}`;
    pill.className = 'pill green';
  } else if (source === 'firestore') {
    pill.textContent = 'fuente: Firestore';
    pill.className = 'pill green';
  } else if (source === 'baseline') {
    pill.textContent = 'baseline integrado';
    pill.className = 'pill';
  } else {
    pill.textContent = 'sin datos';
    pill.className = 'pill red';
  }
}

// Cada renderer envuelto en try/catch independiente
function safeRender(name, fn) {
  try { fn(); }
  catch (e) {
    console.error(`[calidad/render:${name}]`, e);
    log('err', `Render ${name} falló: ${e.message}`);
  }
}

function renderAll(state) {
  const { dataset, zona, met, source, serieModo } = state;
  if (!dataset) return;
  ocultarError();
  safeRender('selector-zona',  () => pintarSelectorZona());
  safeRender('pill-filtro',    () => actualizarPill());
  safeRender('chips-grupos',   () => sincronizarChipsGrupos());
  safeRender('serie-modo',     () => sincronizarSerieModo());
  actualizarSourcePill(source, state._meta);

  // Sincroniza selects con state
  const zSel = $('#f-zona'); if (zSel && zSel.value !== zona) zSel.value = zona;
  const mSel = $('#f-met');  if (mSel && mSel.value !== met)  mSel.value = met;

  safeRender('kpis',        () => renderKPIs(dataset, zona, met));
  safeRender('insight',     () => renderInsight(dataset, zona, met));
  safeRender('serie',       () => renderSerie(dataset, zona, met, serieModo));
  safeRender('stack',       () => renderStack(dataset, zona, met));
  safeRender('part',        () => renderPart(dataset, zona, met));
  safeRender('varmom',      () => renderVarMoM(dataset, zona, met));
  safeRender('top',         () => renderTop(dataset, zona, met));
  safeRender('heatmap',     () => renderHeatmap(dataset, zona, met));
  safeRender('proyeccion',  () => renderProyeccion(dataset, zona, met));
  safeRender('month-table', () => renderMonthTable(dataset, zona, met));
}

// ── Listeners de upload ─────────────────────────────────────
function bindUpload() {
  const fileInput = $('#file-input');
  const btnUp     = $('#btn-upload');
  const btnReset  = $('#btn-reset-baseline');
  const card      = $('#upload-card');

  async function procesarArchivos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) {
      log('err', 'Selecciona al menos un archivo primero');
      return;
    }
    const nombres = files.map(f => `${f.name} (${(f.size / 1024).toFixed(1)} kB)`).join(' + ');
    log('info', `Procesando ${files.length === 1 ? '' : files.length + ' archivos: '}${nombres}…`);
    try {
      const { dataset, meta } = await handleFiles(files);
      store.state._meta = meta;
      log('ok', `✓ Cargado: ${meta.nombre} · ${Object.keys(dataset.zonas).length} zonas · ${dataset.cats_order.length} categorías`);
    } catch (e) {
      log('err', e.message);
      mostrarError('No se pudieron cargar los archivos: ' + e.message);
    }
  }

  if (btnUp) btnUp.addEventListener('click', async () => {
    const files = fileInput?.files;
    if (!files || files.length === 0) {
      log('err', 'Selecciona un archivo primero');
      return;
    }
    await procesarArchivos(files);
  });

  if (fileInput) fileInput.addEventListener('change', async (e) => {
    if (e.target.files?.length) await procesarArchivos(e.target.files);
  });

  if (btnReset) btnReset.addEventListener('click', async () => {
    if (!confirm('Esto borrará el archivo cargado localmente y volverá al baseline integrado. ¿Continuar?')) return;
    await limpiarPersistencia();
    try {
      const baseline = await cargarBaselineLocal();
      store.state._meta = null;
      store.setDataset(baseline, 'baseline');
      log('ok', '↺ Volvió al baseline integrado');
    } catch (e) {
      mostrarError('Reinicio falló: ' + e.message);
    }
  });

  // Drag & drop
  if (card) {
    ['dragenter', 'dragover'].forEach(ev =>
      card.addEventListener(ev, e => { e.preventDefault(); card.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev =>
      card.addEventListener(ev, e => { e.preventDefault(); card.classList.remove('drag'); }));
    card.addEventListener('drop', async e => {
      if (e.dataTransfer?.files?.length) await procesarArchivos(e.dataTransfer.files);
    });
  }
}

// ══════════════════════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════════════════════
async function boot() {
  inicializarFiltros();
  bindUpload();
  store.on(renderAll);

  // 1) Plotly lazy (no bloquea: si falla, KPIs/insight/tabla renderean igual)
  try { await loadPlotly(); }
  catch (e) {
    console.warn('[calidad-shell] Plotly no disponible:', e);
    log('err', 'No se pudo cargar Plotly desde CDN. Las gráficas no se mostrarán pero los KPIs y tablas sí.');
  }

  // 2) IndexedDB (dataset cargado previamente por el usuario)
  let restaurado = false;
  try {
    const persist = await inicializarPersistencia();
    if (persist.dataset) {
      store.state._meta = persist.meta || null;
      store.setDataset(persist.dataset, 'upload');
      log('ok', `Dataset previamente cargado restaurado: ${persist.meta?.nombre || 'sin nombre'}`);
      restaurado = true;
    }
  } catch (e) {
    console.warn('[calidad-shell] IndexedDB falló:', e);
  }

  // 3) Baseline (siempre intentamos cargar, incluso si ya hay dataset
  //    de IndexedDB, para que Firestore tenga un fallback fresco)
  if (!restaurado) {
    try {
      const baseline = await cargarBaselineLocal();
      store.setDataset(baseline, 'baseline');
    } catch (e) {
      console.error('[calidad-shell] baseline no cargó:', e);
      mostrarError(
        'No se pudo cargar el dataset base. Carga un archivo .json, .xlsx, .xlsm o .csv manualmente arriba, ' +
        'o revisa la conexión a internet. Detalle: ' + e.message
      );
    }
  }

  // 4) Firestore realtime (opcional)
  let _unsub = null;
  try {
    _unsub = suscribirIndicadoresCalidad(({ source, dataset }) => {
      if (!dataset) return;
      // Firestore solo gana si no hay upload local
      if (store.state.source !== 'upload') {
        store.setDataset(dataset, source);
      }
    });
  } catch (e) {
    console.warn('[calidad-shell] no se pudo abrir suscripción:', e);
  }
  window.addEventListener('beforeunload', () => {
    if (_unsub) try { _unsub(); } catch (_) { /* noop */ }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
