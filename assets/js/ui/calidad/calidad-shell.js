// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · SHELL
// ──────────────────────────────────────────────────────────────
// Boot del dashboard. Carga Plotly lazy desde CDN, hidrata el
// store con baseline + Firestore realtime cuando esté disponible,
// y orquesta los renderers vía store.on.
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { inicializarFiltros, pintarSelectorZona, actualizarPill } from './filtros.js';
import { suscribirIndicadoresCalidad } from '../../data/indicadores_calidad.js';

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

function renderAll(state) {
  const { dataset, zona, met } = state;
  if (!dataset) return;
  // Asegurar que el select de zona esté poblado (idempotente)
  pintarSelectorZona();
  actualizarPill();
  // Sincroniza UI con state (por si el dataset cambió y la zona actual ya no existe)
  const zSel = document.getElementById('f-zona');
  if (zSel && zSel.value !== zona) zSel.value = zona;
  const mSel = document.getElementById('f-met');
  if (mSel && mSel.value !== met) mSel.value = met;

  renderKPIs(dataset, zona, met);
  renderInsight(dataset, zona);
  renderSerie(dataset, zona);
  renderStack(dataset, zona, met);
  renderPart(dataset, zona, met);
  renderVarMoM(dataset, zona, met);
  renderTop(dataset, zona, met);
  renderHeatmap(dataset, zona, met);
  renderProyeccion(dataset, zona);
  renderMonthTable(dataset, zona);
}

async function boot() {
  inicializarFiltros();

  // 1) Plotly lazy
  try { await loadPlotly(); }
  catch (e) { console.warn('[calidad-shell] Plotly no disponible:', e); }

  // 2) Render reactivo
  store.on(renderAll);

  // 3) Suscripción a la data (baseline + Firestore realtime)
  let _unsub = null;
  try {
    _unsub = suscribirIndicadoresCalidad(({ source, dataset }) => {
      if (!dataset) return;
      store.setDataset(dataset, source);
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
