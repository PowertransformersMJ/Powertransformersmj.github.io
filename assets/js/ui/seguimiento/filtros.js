// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · CONTROLADOR FILTROS
// ──────────────────────────────────────────────────────────────
// Engancha los <select>, segmented control de fechas y el botón
// "Limpiar todo" al store. Sin frameworks; solo DOM puro.
// ══════════════════════════════════════════════════════════════

import { store, scopedEvents } from './state.js';
import { availableDates, hayFiltroActivo } from '../../domain/scada_filtros.js';
import { aggFiltros } from '../../domain/scada_violaciones.js';

const $ = (sel) => document.querySelector(sel);

// ── Sincroniza selects/inputs con el state ───────────────────
export function sincronizarUI() {
  const { filtros } = store.state;
  const g = $('#g-zona');         if (g) g.value = filtros.zona;
  const dS = $('#date-single');   if (dS) dS.value = filtros.dateSingle;
  const dC = $('#date-cutoff');   if (dC) dC.value = filtros.dateCutoff;
  const dF = $('#date-from');     if (dF) dF.value = filtros.dateFrom;
  const dT = $('#date-to');       if (dT) dT.value = filtros.dateTo;
  document.querySelectorAll('#date-mode-seg .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === filtros.dateMode);
  });
  updateDateWraps();
}

function updateDateWraps() {
  const { dateMode } = store.state.filtros;
  const ws = $('#date-single-wrap');
  const wr = $('#date-range-wrap');
  const wc = $('#date-cutoff-wrap');
  if (ws) ws.style.display = dateMode === 'single' ? 'inline-flex' : 'none';
  if (wr) wr.style.display = dateMode === 'range'  ? 'inline-flex' : 'none';
  if (wc) wc.style.display = dateMode === 'cutoff' ? 'inline-flex' : 'none';
}

// ── Repoblado de selects (zona / sub / asset / kv / tabla) ────
export function repoblarSelects() {
  const { allEvents, filtros } = store.state;
  const cats = aggFiltros(allEvents);
  const fill = (id, vals) => {
    const s = $('#' + id);
    if (!s) return;
    const cur = s.value;
    [...s.querySelectorAll('option:not(:first-child)')].forEach(o => o.remove());
    vals.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      s.appendChild(o);
    });
    if (cur && [...s.options].some(o => o.value === cur)) s.value = cur;
  };
  fill('f-sub',   cats.sub);
  fill('f-asset', cats.asset);
  fill('f-kv',    cats.kv);
  fill('f-zona',  cats.zona);
  fill('g-zona',  cats.zona);
  const g = $('#g-zona');
  if (g) g.value = filtros.zona;

  // Acotar inputs de fecha al rango disponible
  const dates = availableDates(allEvents);
  if (dates.length) {
    const lo = dates[0], hi = dates[dates.length - 1];
    ['date-single', 'date-from', 'date-to', 'date-cutoff'].forEach(id => {
      const el = $('#' + id);
      if (el) { el.min = lo; el.max = hi; }
    });
  }
}

// ── Pill resumen del scope activo ────────────────────────────
export function actualizarScopePill() {
  const pill = $('#scope-pill');
  const info = $('#date-info');
  if (!pill) return;
  const { filtros, allEvents } = store.state;
  const parts = [];
  if (filtros.dateMode === 'single' && filtros.dateSingle) parts.push('día ' + filtros.dateSingle);
  else if (filtros.dateMode === 'range' && (filtros.dateFrom || filtros.dateTo)) parts.push(`${filtros.dateFrom || 'inicio'} → ${filtros.dateTo || 'fin'}`);
  else if (filtros.dateMode === 'cutoff' && filtros.dateCutoff) parts.push('acumulado hasta ' + filtros.dateCutoff);
  else parts.push('acumulado total');
  parts.push(filtros.zona ? ('zona ' + filtros.zona) : 'todas las zonas');
  pill.textContent = parts.join(' · ');
  pill.className = hayFiltroActivo(filtros) ? 'pill green' : 'pill';

  if (info) {
    const dates = availableDates(allEvents);
    const scopedViol = scopedEvents().filter(e => e.viol).length;
    const rango = dates.length
      ? `${dates[0]} → ${dates[dates.length - 1]} (${dates.length} día${dates.length > 1 ? 's' : ''} cargados)`
      : 'sin datos';
    info.textContent = `${rango} · ${scopedViol.toLocaleString()} violaciones en el período activo`;
  }
}

// ── Bind único de listeners ──────────────────────────────────
let _bound = false;
export function inicializarFiltros() {
  if (_bound) return;
  _bound = true;

  const g = $('#g-zona');
  if (g) g.addEventListener('change', () => store.setFiltro({ zona: g.value }));

  const clear = $('#btn-clear-scope');
  if (clear) clear.addEventListener('click', () => {
    store.resetFiltros();
    sincronizarUI();
  });

  // Segmented control de modo de fecha
  document.querySelectorAll('#date-mode-seg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const patch = { dateMode: mode };
      // Auto-llenado de fechas según modo
      const dates = availableDates(store.state.allEvents);
      if (mode === 'single' && !store.state.filtros.dateSingle && dates.length) {
        patch.dateSingle = dates[dates.length - 1];
      }
      if (mode === 'range' && !store.state.filtros.dateFrom && !store.state.filtros.dateTo && dates.length) {
        patch.dateFrom = dates[0];
        patch.dateTo   = dates[dates.length - 1];
      }
      if (mode === 'cutoff' && !store.state.filtros.dateCutoff && dates.length) {
        patch.dateCutoff = dates[dates.length - 1];
      }
      store.setFiltro(patch);
    });
  });

  const dS = $('#date-single');
  if (dS) dS.addEventListener('change', () => store.setFiltro({ dateSingle: dS.value }));
  const dC = $('#date-cutoff');
  if (dC) dC.addEventListener('change', () => store.setFiltro({ dateCutoff: dC.value }));
  const dF = $('#date-from');
  if (dF) dF.addEventListener('change', () => store.setFiltro({ dateFrom: dF.value }));
  const dT = $('#date-to');
  if (dT) dT.addEventListener('change', () => store.setFiltro({ dateTo: dT.value }));

  // Trend scope
  const ts = $('#trend-scope');
  if (ts) ts.addEventListener('change', () => store.setTrendScope(ts.value));

  // Tabs Top 10
  document.querySelectorAll('#top10-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#top10-tabs .tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      store.setTopTab(btn.dataset.mag);
    });
  });

  // Top N del ranking
  document.querySelectorAll('#rank-topn-seg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#rank-topn-seg .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      store.setRankTopN(parseInt(btn.dataset.n, 10));
    });
  });
}
