// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · CONTROLADOR DE FILTROS
// Engancha los <select>, <input>, chips y botones del header al
// store. Sin frameworks.
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { listarUnicos } from '../../domain/cargabilidad_filtros.js';

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function fillSelect(id, valores, labelDefault) {
  const el = $(id);
  if (!el) return;
  const cur = el.value;
  el.innerHTML = `<option value="">${labelDefault}</option>` +
    valores.map(v => `<option value="${v}">${formatear(v)}</option>`).join('');
  if (valores.includes(cur)) el.value = cur;
}

// Capitaliza minúscula con primera mayúscula (ej: "BOLIVAR" → "Bolivar")
function formatear(v) {
  const s = String(v);
  if (/^G\d$/i.test(s)) return s;  // grupos quedan G1/G2/G3
  return s[0] + s.slice(1).toLowerCase();
}

export function pintarSelectores(rows) {
  fillSelect('#fZona',  listarUnicos(rows, 'zona'),  'Todas las zonas');
  fillSelect('#fDep',   listarUnicos(rows, 'dep'),   'Todos los deptos');
  // Grupos: G1/G2/G3 sin transformación
  const el = $('#fGrupo');
  if (el) {
    const cur = el.value;
    el.innerHTML = '<option value="">Todos los grupos</option>' +
      listarUnicos(rows, 'grupo').map(v => `<option value="${v}">${v}</option>`).join('');
    if (cur) el.value = cur;
  }
}

export function sincronizarUI() {
  const f = store.state.filtros;
  if ($('#search')) $('#search').value = f.q;
  if ($('#fZona'))  $('#fZona').value  = f.zona;
  if ($('#fDep'))   $('#fDep').value   = f.dep;
  if ($('#fGrupo')) $('#fGrupo').value = f.grupo;
  if ($('#fDev'))   $('#fDev').value   = f.dev;
  $$('.chip-f').forEach(c => {
    const k = c.dataset.sev;
    c.classList.toggle('active', f.sev.has(k));
  });
}

let _bound = false;
export function inicializarFiltros() {
  if (_bound) return;
  _bound = true;

  const search = $('#search');
  if (search) search.addEventListener('input', e => store.setFiltro({ q: e.target.value }));

  const zSel = $('#fZona');
  if (zSel) zSel.addEventListener('change', e => store.setFiltro({ zona: e.target.value }));

  const dSel = $('#fDep');
  if (dSel) dSel.addEventListener('change', e => store.setFiltro({ dep: e.target.value }));

  const gSel = $('#fGrupo');
  if (gSel) gSel.addEventListener('change', e => store.setFiltro({ grupo: e.target.value }));

  const dvSel = $('#fDev');
  if (dvSel) dvSel.addEventListener('change', e => store.setFiltro({ dev: e.target.value }));

  $$('.chip-f').forEach(c => {
    c.addEventListener('click', () => {
      const k = c.dataset.sev;
      if (k) store.toggleSev(k);
    });
  });

  const reset = $('#reset');
  if (reset) reset.addEventListener('click', () => store.resetFiltros());

  // Sort columns
  $$('thead th[data-k]').forEach(th => {
    th.addEventListener('click', () => store.setSort(th.dataset.k));
  });
}
