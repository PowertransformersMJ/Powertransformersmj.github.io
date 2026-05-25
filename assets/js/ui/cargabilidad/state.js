// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · STORE
// Publish/subscribe minimal sin frameworks.
// ══════════════════════════════════════════════════════════════

import { filtrosVacios } from '../../domain/cargabilidad_filtros.js';

const _state = {
  rows: [],                  // dataset normalizado (con _i, _base, recompute aplicado)
  source: 'empty',           // 'baseline' | 'firestore' | 'empty'
  filtros: filtrosVacios(),  // { q, zona, dep, grupo, dev, sev: Set }
  sort: 'cmax',              // columna activa para ordenar tabla
  dir: -1,                   // 1 asc · -1 desc
  live: false,               // simulación tiempo real activa
  lastTs: Date.now(),        // timestamp del último jitter
  detailIndex: null,         // _i del transformador en el modal (null = cerrado)
  detailWin: '24h',          // '24h' | '7d' | '30d'
};

const _listeners = new Set();
function notify() {
  _listeners.forEach(fn => {
    try { fn(_state); } catch (e) { console.error('[cargabilidad/store listener]', e); }
  });
}

export const store = {
  get state() { return _state; },
  on(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },

  setRows(rows, source = 'baseline') {
    _state.rows = Array.isArray(rows) ? rows : [];
    _state.source = source;
    _state.lastTs = Date.now();
    notify();
  },

  setFiltro(parche) {
    Object.assign(_state.filtros, parche);
    notify();
  },

  toggleSev(s) {
    const set = _state.filtros.sev;
    if (set.has(s)) set.delete(s);
    else set.add(s);
    notify();
  },

  resetFiltros() {
    _state.filtros = filtrosVacios();
    notify();
  },

  setSort(k) {
    if (_state.sort === k) _state.dir *= -1;
    else { _state.sort = k; _state.dir = -1; }
    notify();
  },

  setLive(v)  { _state.live = !!v; notify(); },
  setLastTs(ts){ _state.lastTs = ts; },        // sin notify — solo para el clock
  setDetail(i){ _state.detailIndex = i; notify(); },
  closeDetail(){ _state.detailIndex = null; notify(); },
  setDetailWin(w){ _state.detailWin = w; notify(); },
};
