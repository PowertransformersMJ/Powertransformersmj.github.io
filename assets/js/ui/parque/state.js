// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Parque · Store (publish/subscribe)
// ──────────────────────────────────────────────────────────────
// Estado mutable del dashboard, sin frameworks. Los renderers
// se subscriben con `store.on('change', fn)` y se ejecutan cada
// vez que cambia el state. El boot llama `store.set(...)` cuando
// llega un snapshot nuevo de Firestore o del baseline.
//
// Forma del state:
//   rows: SaludActivoRow[]    // dataset completo normalizado
//   src:  'firestore'|'baseline'|'upload'|'empty'
//   extra: string|null        // p.ej. nombre del archivo subido
//   zonaDepto: { [zona]: [depto] }
//   filtros: {
//     zona, depto, tipo, q,                 // filtros del dashboard global
//     seg: { zona, depto, hi: Set<number> } // filtros del apartado "Mayor Consecuencia"
//   }
// ══════════════════════════════════════════════════════════════

import { buildZonaDepto } from '../../domain/parque_salud_calc.js';

const _state = {
  rows: [],
  src: 'empty',
  extra: null,
  zonaDepto: {},
  filtros: {
    zona: '', depto: '', tipo: '', q: '',
    seg: { zona: '', depto: '', hi: new Set() },
  },
};

const _listeners = new Set();

function notify() {
  _listeners.forEach(fn => {
    try { fn(_state); } catch (e) { console.error('[parque/state listener]', e); }
  });
}

// ── API pública ───────────────────────────────────────────────
export const store = {
  /** Lectura cruda. NO mutar. */
  get state() { return _state; },

  /** Subscribe a cambios. Devuelve unsubscribe. */
  on(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  /**
   * Reemplaza el dataset completo y reinicia filtros.
   * Recalcula el mapa zona→deptos.
   */
  setRows(rows, src = 'baseline', extra = null) {
    _state.rows = Array.isArray(rows) ? rows : [];
    _state.src = src;
    _state.extra = extra;
    _state.zonaDepto = buildZonaDepto(_state.rows);
    // Reset filtros (los selects deben repoblarse)
    _state.filtros.zona = '';
    _state.filtros.depto = '';
    _state.filtros.tipo = '';
    _state.filtros.q = '';
    _state.filtros.seg.zona = '';
    _state.filtros.seg.depto = '';
    _state.filtros.seg.hi.clear();
    notify();
  },

  /** Actualiza filtros parciales del dashboard global. */
  setFiltro(parche) {
    Object.assign(_state.filtros, parche);
    notify();
  },

  /** Actualiza el texto de búsqueda sin reiniciar filtros. */
  setBusqueda(q) {
    _state.filtros.q = q || '';
    notify();
  },

  /** Actualiza filtros del apartado "Mayor Consecuencia". */
  setSeg(parche) {
    Object.assign(_state.filtros.seg, parche);
    notify();
  },

  /** Toggle del set hi (botones del apartado Mayor Consecuencia). */
  toggleSegHi(hi) {
    const s = _state.filtros.seg.hi;
    if (hi === 0) { s.clear(); }
    else if (s.has(hi)) { s.delete(hi); }
    else { s.add(hi); }
    notify();
  },

  /** Reinicia los 3 selects del dashboard global. */
  resetFiltros() {
    _state.filtros.zona = '';
    _state.filtros.depto = '';
    _state.filtros.tipo = '';
    notify();
  },
};

// ── Helper de filtrado global ─────────────────────────────────
// Aplica los filtros (zona/depto/tipo) al dataset completo.
// Útil para los renderers que consumen el subconjunto activo.
export function filasFiltradas(state = _state) {
  const { zona, depto, tipo } = state.filtros;
  return state.rows.filter(a =>
    (!zona  || a.zona === zona) &&
    (!depto || a.departamento === depto) &&
    (!tipo  || a.tipo_activo === tipo)
  );
}

// ── Helper de filtrado segmentado ─────────────────────────────
// El apartado "Mayor Consecuencia" usa filtros propios sobre
// todo el parque (NO se concatena con los globales).
export function filasSegmento(state = _state) {
  const { seg } = state.filtros;
  return state.rows.filter(a =>
    (!seg.zona  || a.zona === seg.zona) &&
    (!seg.depto || a.departamento === seg.depto) &&
    (seg.hi.size === 0 || seg.hi.has(a.bucket.cls))
  );
}
