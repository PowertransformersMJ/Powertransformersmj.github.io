// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · SHELL
// ──────────────────────────────────────────────────────────────
// Boot del dashboard. Carga Plotly lazy desde CDN, hidrata el
// store con (baseline) → (acumulado local) → (Firestore realtime
// si está disponible) y orquesta los renderers vía store.on.
// ══════════════════════════════════════════════════════════════

import { store, scopedEvents } from './state.js';
import { inicializarFiltros, sincronizarUI, repoblarSelects, actualizarScopePill } from './filtros.js';
import { handleFiles, log, toast } from './upload.js';
import { renderMeta, renderStoragePill } from './renderers/meta.js';
import { renderKPIs } from './renderers/kpis.js';
import { renderGeoIndicators } from './renderers/geo.js';
import { renderTop10 } from './renderers/top10.js';
import { renderTrend } from './renderers/trend.js';
import { renderZonaChart, renderParamChart, renderU1U2Chart } from './renderers/pies.js';
import { renderHeatmap } from './renderers/heatmap.js';
import { renderRankEvolution } from './renderers/bump.js';
import { renderTabla, inicializarTabla, exportCSV } from './renderers/tabla.js';
import { renderUploadStats, renderHistory } from './renderers/upload-stats.js';
import {
  suscribirEventosSCADA, cargarBaselineLocal,
} from '../../data/seguimiento_scada.js';
import { persistInit, persistSave, persistMode } from '../../data/seguimiento_scada_storage.js';

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

// ── Render orquestado (todos los visualizadores) ─────────────
function renderAll() {
  renderMeta();
  renderStoragePill();
  renderKPIs();
  renderGeoIndicators();
  renderTop10();
  renderTrend();
  renderZonaChart();
  renderParamChart();
  renderU1U2Chart();
  renderHeatmap();
  renderRankEvolution();
  repoblarSelects();
  renderTabla();
  actualizarScopePill();
  renderUploadStats();
  renderHistory();
  sincronizarUI();
}

// ── Listeners del módulo de upload ────────────────────────────
function bindUpload() {
  const btnUp = $('#btn-upload');
  if (btnUp) btnUp.addEventListener('click', () => {
    const files = $('#file-input').files;
    if (!files || files.length === 0) {
      toast('Selecciona uno o varios archivos primero', 'error');
      return;
    }
    handleFiles([...files]);
  });

  const btnClear = $('#btn-clear-all');
  if (btnClear) btnClear.addEventListener('click', async () => {
    const { extra, seed } = store.state;
    if (extra.length === 0) {
      toast('No hay nada acumulado para borrar', 'error');
      return;
    }
    const ok = confirm(
      `Esto eliminará ${extra.length.toLocaleString()} eventos acumulados en el navegador.\n\n`
      + `El dataset base (${seed.events.length.toLocaleString()} eventos del seed) se conserva.\n\n`
      + `¿Continuar?`
    );
    if (!ok) return;
    store.limpiarExtra();
    await persistSave([], []);
    toast('Histórico acumulado borrado · dataset base intacto', 'success');
  });

  // Drag & drop
  const uc = $('#upload-card');
  if (uc) {
    ['dragenter', 'dragover'].forEach(ev =>
      uc.addEventListener(ev, e => { e.preventDefault(); uc.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev =>
      uc.addEventListener(ev, e => { e.preventDefault(); uc.classList.remove('drag'); }));
    uc.addEventListener('drop', e => {
      if (e.dataTransfer?.files?.length) handleFiles([...e.dataTransfer.files]);
    });
  }

  const btnExport = $('#btn-export');
  if (btnExport) btnExport.addEventListener('click', () => {
    const { ok, count } = exportCSV();
    if (ok) toast(`✓ ${count.toLocaleString()} filas exportadas`, 'success');
    else    toast('No hay datos para exportar', 'error');
  });
}

// ══════════════════════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════════════════════
async function boot() {
  inicializarFiltros();
  inicializarTabla();
  bindUpload();

  // 1) Cargar Plotly (lazy)
  try {
    await loadPlotly();
  } catch (e) {
    console.warn('[scada-shell] Plotly no disponible:', e);
    log('warn', 'Plotly no se pudo cargar — las gráficas no se renderizarán.');
  }

  // 2) Hidrata el SEED desde el baseline JSON antes que nada
  try {
    const seed = await cargarBaselineLocal();
    store.setSeed(seed, 'baseline');
  } catch (e) {
    console.warn('[scada-shell] baseline no disponible:', e);
    store.setSeed({ meta: null, events: [] }, 'empty');
  }

  // 3) Carga el acumulado local + historial desde IndexedDB
  let persistRes;
  try { persistRes = await persistInit(); }
  catch (_) { persistRes = { mode: 'none', events: [], files: [] }; }
  store.setPersistMode(persistRes.mode);
  if (persistRes.events && persistRes.events.length) {
    store.setExtra(persistRes.events, persistRes.files || []);
    log('info', `Información restaurada: ${persistRes.events.length.toLocaleString()} eventos previamente guardados`
      + (persistRes.migrated ? ' (migrados desde localStorage a IndexedDB)' : ''));
  } else {
    store.setExtra([], persistRes.files || []);
  }

  // 4) Render inicial (después de SEED + extra)
  store.on(() => renderAll());
  renderAll();

  // 5) Suscripción Firestore (opcional)
  let _unsub = null;
  try {
    _unsub = suscribirEventosSCADA(({ source, meta, events }) => {
      if (source === 'firestore' && events.length) {
        store.setSeed({ meta, events }, 'firestore');
      }
    });
  } catch (e) {
    console.warn('[scada-shell] no se pudo abrir suscripción:', e);
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
