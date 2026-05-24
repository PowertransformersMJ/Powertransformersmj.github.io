// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Parque · Controlador de filtros
// ──────────────────────────────────────────────────────────────
// Engancha los `<select>` de zona/depto/tipo + el `<input>` de
// búsqueda + los botones de filtro HI del apartado de mayor
// consecuencia. Sin frameworks; solo eventos del DOM contra el
// store de `state.js`.
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { TIPOS } from '../../domain/parque_salud_config.js';

const $ = (sel, root = document) => root.querySelector(sel);

// ── Poblado de selects del dashboard global ───────────────────
function pintarSelectsGlobal() {
  const { zonaDepto } = store.state;
  const z = $('#fZona'), d = $('#fDepto'), t = $('#fTipo');
  if (!z || !d || !t) return;

  z.innerHTML = '<option value="">Todas</option>';
  Object.keys(zonaDepto).forEach(zz => z.add(new Option(zz, zz)));

  t.innerHTML = '<option value="">Todos</option>';
  TIPOS.forEach(tt => t.add(new Option(tt, tt)));

  refrescarDeptosGlobal();
  syncSelectsGlobal();
}

function refrescarDeptosGlobal() {
  const { filtros: { zona, depto }, zonaDepto } = store.state;
  const d = $('#fDepto');
  if (!d) return;
  d.innerHTML = '<option value="">Todos</option>';
  const deptos = zona
    ? (zonaDepto[zona] || [])
    : [...new Set(Object.values(zonaDepto).flat())].sort();
  deptos.forEach(x => d.add(new Option(x, x)));
  d.value = depto;
}

function syncSelectsGlobal() {
  const { filtros: { zona, depto, tipo } } = store.state;
  const z = $('#fZona'), d = $('#fDepto'), t = $('#fTipo');
  if (z) z.value = zona;
  if (d) d.value = depto;
  if (t) t.value = tipo;
}

// ── Poblado de selects del apartado "Mayor Consecuencia" ─────
function pintarSelectsSeg() {
  const { zonaDepto } = store.state;
  const z = $('#segZona');
  if (!z) return;
  z.innerHTML = '<option value="">Todas</option>';
  Object.keys(zonaDepto).forEach(zz => z.add(new Option(zz, zz)));
  refrescarDeptosSeg();
}

function refrescarDeptosSeg() {
  const { filtros: { seg }, zonaDepto } = store.state;
  const d = $('#segDepto');
  if (!d) return;
  d.innerHTML = '<option value="">Todos</option>';
  const deptos = seg.zona
    ? (zonaDepto[seg.zona] || [])
    : [...new Set(Object.values(zonaDepto).flat())].sort();
  deptos.forEach(x => d.add(new Option(x, x)));
  d.value = seg.depto;
}

function syncBotonesHi() {
  const { filtros: { seg } } = store.state;
  document.querySelectorAll('#hiFilter button').forEach(b => {
    const hi = +b.getAttribute('data-hi');
    b.classList.toggle('on', hi === 0 ? seg.hi.size === 0 : seg.hi.has(hi));
  });
}

// ── Boot único de los listeners (idempotente) ─────────────────
let _bound = false;
function bindListeners() {
  if (_bound) return;
  _bound = true;

  const z = $('#fZona'), d = $('#fDepto'), t = $('#fTipo');
  if (z) z.addEventListener('change', () => {
    store.setFiltro({ zona: z.value, depto: '' });
    refrescarDeptosGlobal();
  });
  if (d) d.addEventListener('change', () => store.setFiltro({ depto: d.value }));
  if (t) t.addEventListener('change', () => store.setFiltro({ tipo: t.value }));

  const reset = $('#btnReset');
  if (reset) reset.addEventListener('click', () => {
    store.resetFiltros();
    syncSelectsGlobal();
    refrescarDeptosGlobal();
  });

  const search = $('#search');
  if (search) search.addEventListener('input', (e) => store.setBusqueda(e.target.value));

  const sz = $('#segZona'), sd = $('#segDepto');
  if (sz) sz.addEventListener('change', () => {
    store.setSeg({ zona: sz.value, depto: '' });
    refrescarDeptosSeg();
  });
  if (sd) sd.addEventListener('change', () => store.setSeg({ depto: sd.value }));

  document.querySelectorAll('#hiFilter button').forEach(btn => {
    btn.addEventListener('click', () => {
      const hi = +btn.getAttribute('data-hi');
      store.toggleSegHi(hi);
      syncBotonesHi();
    });
  });
}

// ── API pública del controlador ───────────────────────────────
export function inicializarFiltros() {
  bindListeners();
  // Repintar cada vez que llegue un dataset nuevo (rows o filtros).
  store.on(() => {
    pintarSelectsGlobal();
    pintarSelectsSeg();
    syncBotonesHi();
  });
}
