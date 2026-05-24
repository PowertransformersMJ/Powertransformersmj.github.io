// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · STORE
// ──────────────────────────────────────────────────────────────
// Estado mutable del dashboard. Sin frameworks. Los renderers
// se suscriben con `store.on(fn)` y se ejecutan en cada cambio.
// ══════════════════════════════════════════════════════════════

import { mergeAllEvents } from '../../data/seguimiento_scada.js';
import { applyGlobalScope, filtrosVacios } from '../../domain/scada_filtros.js';

const _state = {
  seed: { meta: null, events: [] },   // baseline (JSON o Firestore inicial)
  extra: [],                            // eventos cargados por el usuario
  allEvents: [],                        // SEED ∪ extra (dedup)
  loadedFiles: [],                      // historial de archivos
  topTab: 'all',                        // 'all' | 'voltage' | 'current' | 'power'
  rankTopN: 10,                          // Top N para bump chart (5 | 10 | 15)
  bumpVariant: 'A',                     // 'A' (spline + anotaciones) | 'B' (heatmap rank) | 'C' (step + cards laterales)
  selectedSid: null,                    // sid del transformador seleccionado para ver detalle (o null)
  trendScope: 'auto',                   // 'auto' | 'hourly' | 'daily'
  persistMode: '?',                     // 'indexeddb' | 'localstorage' | 'none'
  filtros: filtrosVacios(),
  source: 'empty',                      // 'baseline' | 'firestore' | 'upload' | 'empty'
};

const _listeners = new Set();

function rebuild() {
  _state.allEvents = mergeAllEvents(_state.seed.events, _state.extra);
}

function notify() {
  _listeners.forEach(fn => {
    try { fn(_state); } catch (e) { console.error('[scada/store listener]', e); }
  });
}

// ── API pública ───────────────────────────────────────────────
export const store = {
  get state() { return _state; },

  on(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  /** Reemplaza el SEED (baseline JSON o Firestore inicial). */
  setSeed({ meta, events }, source = 'baseline') {
    _state.seed = { meta: meta || null, events: events || [] };
    _state.source = source;
    rebuild();
    notify();
  },

  /** Establece los eventos extra (acumulados localmente). */
  setExtra(events, files) {
    _state.extra = Array.isArray(events) ? events : [];
    _state.loadedFiles = Array.isArray(files) ? files : [];
    rebuild();
    notify();
  },

  /** Agrega eventos parseados de un archivo. Recalcula merge. */
  agregarEventos(nuevos, fileMeta) {
    if (nuevos && nuevos.length) _state.extra.push(...nuevos);
    if (fileMeta) _state.loadedFiles.push(fileMeta);
    _state.source = 'upload';
    rebuild();
    notify();
  },

  /** Borra todo el acumulado del usuario. El SEED se conserva. */
  limpiarExtra() {
    _state.extra = [];
    _state.loadedFiles = [];
    rebuild();
    notify();
  },

  setTopTab(tab)         { _state.topTab = tab;         notify(); },
  setRankTopN(n)         { _state.rankTopN = n;         notify(); },
  setBumpVariant(v)      { _state.bumpVariant = v;      notify(); },
  setSelectedSid(sid)    { _state.selectedSid = sid;    notify(); },
  setTrendScope(scope)   { _state.trendScope = scope;   notify(); },
  setPersistMode(mode)   { _state.persistMode = mode;   notify(); },

  setFiltro(parche) {
    Object.assign(_state.filtros, parche);
    notify();
  },

  resetFiltros() {
    _state.filtros = filtrosVacios();
    notify();
  },
};

// ── Helpers de selección ──────────────────────────────────────
export function scopedEvents(state = _state) {
  return applyGlobalScope(state.allEvents, state.filtros);
}
