// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · CONTROLADOR FILTROS
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { listarZonas } from '../../domain/saidi_calculo.js';
import { zonaLabel, metricaTitulo } from '../../domain/saidi_config.js';

const $ = (s) => document.querySelector(s);

export function pintarSelectorZona() {
  const sel = $('#f-zona');
  if (!sel || !store.state.dataset) return;
  const zonas = listarZonas(store.state.dataset);
  const cur = sel.value || store.state.zona;
  sel.innerHTML = '';
  zonas.forEach(z => {
    const o = document.createElement('option');
    o.value = z;
    o.textContent = zonaLabel(z);
    sel.appendChild(o);
  });
  if (zonas.includes(cur)) sel.value = cur;
}

export function actualizarPill() {
  const pill = $('#filter-pill');
  if (!pill) return;
  const { zona, met } = store.state;
  pill.textContent = `${zonaLabel(zona)} · ${metricaTitulo(met)}`;
}

let _bound = false;
export function inicializarFiltros() {
  if (_bound) return;
  _bound = true;
  const zSel = $('#f-zona');
  const mSel = $('#f-met');
  if (zSel) zSel.addEventListener('change', () => store.setZona(zSel.value));
  if (mSel) mSel.addEventListener('change', () => store.setMet(mSel.value));
}
