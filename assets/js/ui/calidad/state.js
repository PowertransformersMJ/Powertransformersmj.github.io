// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · STORE
// ──────────────────────────────────────────────────────────────
// Estado mutable del dashboard. Sin frameworks. Renderers se
// suscriben con `store.on(fn)` y se ejecutan en cada cambio.
// ══════════════════════════════════════════════════════════════

const _state = {
  dataset: null,    // { meses, meses_full, zonas, cats_order, kpi, proj_global }
  zona: 'TODAS',
  met:  'saidi',
  source: 'empty',  // 'baseline' | 'firestore' | 'empty'
};

const _listeners = new Set();
function notify() {
  _listeners.forEach(fn => {
    try { fn(_state); } catch (e) { console.error('[calidad/store listener]', e); }
  });
}

export const store = {
  get state() { return _state; },
  on(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },

  setDataset(dataset, source = 'baseline') {
    _state.dataset = dataset || null;
    _state.source = source;
    // Validar zona seleccionada vs dataset; fallback a TODAS
    if (dataset && dataset.zonas && !dataset.zonas[_state.zona]) {
      _state.zona = 'TODAS';
    }
    notify();
  },

  setZona(z)  { _state.zona = z; notify(); },
  setMet(m)   { _state.met  = m; notify(); },
};
