// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · STORE
// ──────────────────────────────────────────────────────────────
// Estado mutable del dashboard. Sin frameworks. Renderers se
// suscriben con `store.on(fn)` y se ejecutan en cada cambio.
// ══════════════════════════════════════════════════════════════

import { filtrarCausasCanonicas } from '../../domain/saidi_datos.js';

const GRUPOS_CANON = ['Sobrecarga/Deslastre', 'Racionamiento/Deficit', 'Otras causas'];

const _state = {
  dataset: null,    // { meses, meses_full, zonas, cats_order, kpi, proj_global }
  zona: 'TODAS',
  met:  'saidi',
  // Grupos de causa activos (filtros de chips). Por default los 3 están
  // visibles; el usuario puede ocultarlos con click en los chips del card
  // "Contribución mensual por grupo de causa". Afecta también la
  // gráfica de variación % y la tabla mensual.
  gruposActivos: new Set(GRUPOS_CANON),
  // Modo de la serie temporal: 'mes' (valor mensual) | 'acum' (suma
  // acumulada mes a mes). Afecta solo al chart "Serie temporal del
  // sistema"; el resto de gráficas conserva su lógica.
  serieModo: 'mes',
  // Mes seleccionado para el detalle diario del chart "Serie temporal":
  // null = vista mensual normal; entero 0–11 (mes-calendario) = vista
  // día a día de ese mes. Solo aplica si el dataset trae `dias`.
  serieMes: null,
  // Filtros propios del card "Ranking TOP 10 de subestaciones" (no
  // tocan los filtros globales). rankZona = zona de la tabla; rankMes
  // = null (todos los meses) o entero 0–11 (mes-calendario único).
  rankZona: 'TODAS',
  rankMes: null,
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
    // CHOKEPOINT ÚNICO · el filtro de las 13 causas canónicas se aplica
    // aquí para TODA fuente (baseline, upload Excel/CSV/JSON, cache
    // IndexedDB). Así el dashboard nunca muestra causas fuera del catálogo,
    // sin importar por qué ruta llegó el dataset.
    _state.dataset = dataset ? filtrarCausasCanonicas(dataset) : null;
    _state.source = source;
    // Validar zona seleccionada vs dataset; fallback a TODAS
    if (_state.dataset && _state.dataset.zonas && !_state.dataset.zonas[_state.zona]) {
      _state.zona = 'TODAS';
    }
    // Si el nuevo dataset no trae detalle diario, volver a vista mensual.
    if (_state.serieMes != null) {
      const tieneDias = _state.dataset?.dias && Object.keys(_state.dataset.dias).some(
        zk => _state.dataset.dias[zk] && Object.keys(_state.dataset.dias[zk]).length
      );
      if (!tieneDias) _state.serieMes = null;
    }
    // Validar zona del ranking vs dataset; fallback a TODAS.
    if (_state.dataset?.zonas && !_state.dataset.zonas[_state.rankZona]) {
      _state.rankZona = 'TODAS';
    }
    notify();
  },

  setZona(z)  { _state.zona = z; notify(); },
  setMet(m)   { _state.met  = m; notify(); },
  setSerieModo(m) { _state.serieModo = (m === 'acum' ? 'acum' : 'mes'); notify(); },
  setSerieMes(m) {
    const n = (m == null || m === '') ? null : +m;
    _state.serieMes = (n == null || !Number.isFinite(n)) ? null : Math.max(0, Math.min(11, Math.trunc(n)));
    notify();
  },

  setRankZona(z) { _state.rankZona = z || 'TODAS'; notify(); },
  setRankMes(m) {
    const n = (m == null || m === '') ? null : +m;
    _state.rankMes = (n == null || !Number.isFinite(n)) ? null : Math.max(0, Math.min(11, Math.trunc(n)));
    notify();
  },

  toggleGrupo(g) {
    if (_state.gruposActivos.has(g)) _state.gruposActivos.delete(g);
    else _state.gruposActivos.add(g);
    notify();
  },

  setGruposActivos(setOrArr) {
    _state.gruposActivos = new Set(setOrArr);
    notify();
  },

  resetGruposActivos() {
    _state.gruposActivos = new Set(GRUPOS_CANON);
    notify();
  },
};

export const GRUPOS_DISPONIBLES = GRUPOS_CANON;
