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

/**
 * Chips de zona. Son chips y no un `<select multiple>` a propósito: hay tres
 * zonas, el filtro de severidad de al lado ya usa chips, y con un desplegable
 * múltiple hay que abrirlo para saber qué está filtrado. Aquí el estado se ve
 * sin tocar nada, que es lo que importa en un tablero que se mira de lejos.
 */
let _zonasPintadas = '';

export function pintarChipsZona(rows) {
  const host = $('#fZonaChips');
  if (!host) return;
  const zonas = listarUnicos(rows, 'zona');
  // Solo se reconstruye cuando cambia la LISTA de zonas. El estado marcado lo
  // refresca `sincronizarUI` sobre los botones que ya están.
  //
  // Reconstruir en cada render parecía inocente y no lo era: `renderAll` corre
  // con cada cambio del store, así que el botón que el usuario acababa de
  // pulsar se reemplazaba por otro nuevo y el FOCO se perdía. Con teclado eso
  // significa que después de marcar una zona no se puede marcar la siguiente
  // sin volver a tabular desde el principio. Verificado en el preview.
  const firma = zonas.join('|');
  if (firma === _zonasPintadas && host.children.length === zonas.length) return;
  _zonasPintadas = firma;
  const activas = store.state.filtros.zona;
  host.innerHTML = zonas.map(z =>
    `<button type="button" class="chip-f f-zona${activas.has(z) ? ' active' : ''}" ` +
    `data-zona="${z}" aria-pressed="${activas.has(z)}">${formatear(z)}</button>`).join('');
}

export function pintarSelectores(rows) {
  pintarChipsZona(rows);
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
  if ($('#fDep'))   $('#fDep').value   = f.dep;
  if ($('#fGrupo')) $('#fGrupo').value = f.grupo;
  if ($('#fDev'))   $('#fDev').value   = f.dev;
  $$('.chip-f[data-sev]').forEach(c => {
    const on = f.sev.has(c.dataset.sev);
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', String(on));
  });
  $$('.chip-f[data-zona]').forEach(c => {
    const on = f.zona.has(c.dataset.zona);
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

let _bound = false;
export function inicializarFiltros() {
  if (_bound) return;
  _bound = true;

  const search = $('#search');
  if (search) search.addEventListener('input', e => store.setFiltro({ q: e.target.value }));

  // Delegación: los chips de zona se repintan en cada render (salen del
  // dataset), así que un listener por chip se perdería en el primer repintado.
  const zonaHost = $('#fZonaChips');
  if (zonaHost) zonaHost.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-zona]');
    if (chip && zonaHost.contains(chip)) store.toggleZona(chip.dataset.zona);
  });

  const dSel = $('#fDep');
  if (dSel) dSel.addEventListener('change', e => store.setFiltro({ dep: e.target.value }));

  const gSel = $('#fGrupo');
  if (gSel) gSel.addEventListener('change', e => store.setFiltro({ grupo: e.target.value }));

  const dvSel = $('#fDev');
  if (dvSel) dvSel.addEventListener('change', e => store.setFiltro({ dev: e.target.value }));

  $$('.chip-f[data-sev]').forEach(c => {
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
