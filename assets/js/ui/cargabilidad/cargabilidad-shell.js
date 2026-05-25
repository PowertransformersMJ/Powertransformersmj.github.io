// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · SHELL (entrypoint)
// Boot reactivo:
//   1) inicializa filtros + modal + listeners de botones
//   2) hidrata dataset (baseline JSON + Firestore realtime)
//   3) fija _base y recompute para cada trafo
//   4) suscribe el store y dispara renderAll en cada cambio
//   5) tick clock cada segundo para el indicador "actualizado hace…"
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { inicializarFiltros, pintarSelectores, sincronizarUI } from './filtros.js';
import { inicializarModal } from './modal.js';
import { toggleLive, fijarBase } from './live.js';
import { exportarCSV } from './export.js';
import { suscribirCargabilidad } from '../../data/seguimiento_cargabilidad.js';
import { aplicarFiltros } from '../../domain/cargabilidad_filtros.js';
import { recomputeAll } from '../../domain/cargabilidad_severidad.js';

import { renderKPIs }     from './renderers/kpis.js';
import { renderOverview } from './renderers/overview.js';
import { renderHeatmap }  from './renderers/heatmap.js';
import { renderTabla }    from './renderers/tabla.js';
import { renderModal }    from './renderers/modal-detalle.js';

const $ = (s) => document.querySelector(s);

function safeRender(name, fn) {
  try { fn(); } catch (e) {
    console.error(`[cargabilidad/render:${name}]`, e);
  }
}

function renderAll(state) {
  if (!state.rows.length) return;
  const filtradas = aplicarFiltros(state.rows, state.filtros);
  safeRender('selectores', () => pintarSelectores(state.rows));
  safeRender('sync-ui',    () => sincronizarUI());
  safeRender('kpis',       () => renderKPIs(filtradas));
  safeRender('overview',   () => renderOverview(filtradas));
  safeRender('heatmap',    () => renderHeatmap(filtradas));
  safeRender('tabla',      () => renderTabla(filtradas));
  safeRender('modal',      () => renderModal());
}

function bindBotones() {
  const liveBtn = $('#liveBtn');
  if (liveBtn) liveBtn.addEventListener('click', () => {
    const ahora = toggleLive();
    liveBtn.classList.toggle('live', ahora);
    liveBtn.innerHTML = ahora ? '⏸ Tiempo real activo' : '▶ Activar tiempo real';
    const dot = $('#liveDot');
    if (dot) dot.style.background = ahora ? 'var(--ok)' : 'var(--ink3)';
  });

  const exportBtn = $('#exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const n = exportarCSV();
    console.info(`[cargabilidad/export] ${n} filas exportadas`);
  });
}

function tickClock() {
  const now = new Date();
  const clock = $('#clock');
  if (clock) clock.textContent = now.toLocaleTimeString('es-CO');
  const ago = $('#ago');
  if (ago) {
    const sec = Math.round((Date.now() - store.state.lastTs) / 1000);
    ago.textContent = store.state.live ? `actualizado hace ${sec} s` : 'datos estáticos (snapshot)';
  }
}

async function boot() {
  inicializarFiltros();
  inicializarModal();
  bindBotones();

  // Render reactivo
  store.on(renderAll);

  // Suscripción a datos (baseline + Firestore realtime)
  let _unsub = null;
  try {
    _unsub = suscribirCargabilidad(({ source, rows }) => {
      if (!Array.isArray(rows)) return;
      // Importante: mutamos in-place para fijar _base y _i.
      const enriquecidas = fijarBase(rows.slice());
      recomputeAll(enriquecidas);
      store.setRows(enriquecidas, source);
    });
  } catch (e) {
    console.warn('[cargabilidad-shell] no se pudo abrir suscripción:', e);
  }

  // Tick clock
  setInterval(tickClock, 1000);
  tickClock();

  window.addEventListener('beforeunload', () => {
    if (_unsub) try { _unsub(); } catch (_) { /* noop */ }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
