// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · CONTROLADOR FILTROS
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { listarZonas } from '../../domain/saidi_calculo.js';
import { zonaLabel, metricaTitulo } from '../../domain/saidi_config.js';
import { CAUSA2_SOBRECARGA } from '../../domain/saidi_datos.js';

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
  const { zona, met, causa2 } = store.state;
  let txt = `${zonaLabel(zona)} · ${metricaTitulo(met)}`;
  if (causa2 === CAUSA2_SOBRECARGA) txt += ' · SOBRECARGA';
  else if (causa2) txt += ` · ${causa2}`;
  pill.textContent = txt;
}

// Llena el selector CAUSA2 (#f-causa) con: "Todas", el filtro madre
// "SOBRECARGA" y cada causa individual presente en el dataset. Las
// opciones se derivan del dataset COMPLETO (store.state.dataset.cats_order),
// no del view filtrado, para que la lista no se reduzca al elegir una causa.
export function pintarSelectorCausa2() {
  const sel = $('#f-causa');
  const ds = store.state.dataset;
  if (!sel || !ds) return;
  const cur = store.state.causa2 || '';
  const cats = Array.isArray(ds.cats_order) ? ds.cats_order : [];

  sel.innerHTML = '';
  const opt = (value, label) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    sel.appendChild(o);
  };
  opt('', 'Todas las causas');
  opt(CAUSA2_SOBRECARGA, 'SOBRECARGA (filtro madre · 13 causas)');
  cats.forEach(c => opt(c, c));

  // Conserva la selección si sigue siendo válida; si no, vuelve a "Todas".
  const valido = cur === '' || cur === CAUSA2_SOBRECARGA || cats.includes(cur);
  sel.value = valido ? cur : '';
  if (!valido && store.state.causa2 !== '') store.setCausa2('');
}

// Sincroniza el estado visual (is-on / is-off) de los chips de grupos
// con store.state.gruposActivos.
export function sincronizarChipsGrupos() {
  const activos = store.state.gruposActivos;
  document.querySelectorAll('#grp-filter .grp-chip').forEach(btn => {
    const g = btn.dataset.grp;
    const on = activos.has(g);
    btn.classList.toggle('is-on', on);
    btn.classList.toggle('is-off', !on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

// Sincroniza el estado visual del segmentado "Por meses / Acumulado"
// con store.state.serieModo.
export function sincronizarSerieModo() {
  const modo = store.state.serieModo || 'mes';
  document.querySelectorAll('#serie-modo .serie-seg').forEach(btn => {
    const on = btn.dataset.modo === modo;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

// Sincroniza el estado visual del segmentado "Por meses / Acumulado"
// del chart programado vs no-programado con store.state.progModo.
export function sincronizarProgModo() {
  const modo = store.state.progModo || 'mes';
  document.querySelectorAll('#prog-modo .serie-seg').forEach(btn => {
    const on = btn.dataset.modo === modo;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

// Sincroniza los chips de serie (programado / no programado) del chart
// prog/no-prog con store.state.progSeries.
export function sincronizarProgSeries() {
  const ser = store.state.progSeries || { prog: true, nop: true };
  document.querySelectorAll('#prog-series .serie-seg').forEach(btn => {
    const key = btn.dataset.serie;
    const on = key === 'prog' ? ser.prog !== false
             : key === 'nop'  ? ser.nop  !== false
             : false;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

// ¿El dataset trae detalle diario? (solo el path crudo de la hoja DATOS).
function _datasetTieneDias(ds) {
  return !!(ds?.dias && Object.keys(ds.dias).some(
    zk => ds.dias[zk] && Object.keys(ds.dias[zk]).length
  ));
}

// Llena el selector de mes (#serie-mes) con los meses del dataset. El
// selector se muestra SIEMPRE (para que la función sea descubrible);
// el hint cambia según haya o no detalle diario. Si no lo hay, al
// elegir un mes la gráfica muestra un estado vacío que pide cargar el
// Excel de origen (hoja DATOS) — único path que produce el día a día.
export function pintarSelectorMes() {
  const wrap = $('#serie-mes-wrap');
  const sel = $('#serie-mes');
  const hint = $('#serie-mes-hint');
  const ds = store.state.dataset;
  if (!wrap || !sel || !ds) return;

  const tieneDias = _datasetTieneDias(ds);
  wrap.style.display = '';

  const meses = ds.meses || [];
  const mesesIdx = ds.mesesIdx || meses.map((_, i) => i);
  sel.innerHTML = '<option value="">Todos los meses (vista mensual)</option>';
  meses.forEach((etiqueta, i) => {
    const idx = mesesIdx[i];
    if (idx == null) return;
    const o = document.createElement('option');
    o.value = String(idx);
    o.textContent = etiqueta;
    sel.appendChild(o);
  });

  if (hint) {
    hint.textContent = tieneDias
      ? 'elige un mes para ver el día a día'
      : 'el día a día requiere cargar el Excel de origen (hoja DATOS)';
  }
}

// Sincroniza los inputs META (SAIDI / SAIFI) con el estado. No pisa el
// valor mientras el usuario está escribiendo en el input (foco activo).
export function sincronizarMeta() {
  const setIf = (sel, val) => {
    const inp = $(sel);
    if (!inp || document.activeElement === inp) return;
    const want = (val == null) ? '' : String(val);
    if (inp.value !== want) inp.value = want;
  };
  setIf('#meta-saidi', store.state.metaSaidi);
  setIf('#meta-saifi', store.state.metaSaifi);
}

// Sincroniza el valor del select con store.state.serieMes.
export function sincronizarSerieMes() {
  const sel = $('#serie-mes');
  if (!sel) return;
  const v = store.state.serieMes;
  sel.value = (v == null) ? '' : String(v);
}

// Llena el selector de zona del ranking de subestaciones con las zonas
// del dataset (misma lista que el filtro global de zona).
export function pintarSelectorRankZona() {
  const sel = $('#rank-zona');
  if (!sel || !store.state.dataset) return;
  const zonas = listarZonas(store.state.dataset);
  const cur = store.state.rankZona;
  sel.innerHTML = '';
  zonas.forEach(z => {
    const o = document.createElement('option');
    o.value = z;
    o.textContent = zonaLabel(z);
    sel.appendChild(o);
  });
  if (zonas.includes(cur)) sel.value = cur;
}

// Llena el selector de mes del ranking con los meses del dataset.
export function pintarSelectorRankMes() {
  const sel = $('#rank-mes');
  const ds = store.state.dataset;
  if (!sel || !ds) return;
  const meses = ds.meses || [];
  const mesesIdx = ds.mesesIdx || meses.map((_, i) => i);
  sel.innerHTML = '<option value="">Todos los meses</option>';
  meses.forEach((etiqueta, i) => {
    const idx = mesesIdx[i];
    if (idx == null) return;
    const o = document.createElement('option');
    o.value = String(idx);
    o.textContent = etiqueta;
    sel.appendChild(o);
  });
}

// Sincroniza ambos selects del ranking con el estado.
export function sincronizarRank() {
  const zSel = $('#rank-zona');
  if (zSel && store.state.rankZona) zSel.value = store.state.rankZona;
  const mSel = $('#rank-mes');
  if (mSel) mSel.value = (store.state.rankMes == null) ? '' : String(store.state.rankMes);
}

let _bound = false;
export function inicializarFiltros() {
  if (_bound) return;
  _bound = true;
  const zSel = $('#f-zona');
  const mSel = $('#f-met');
  if (zSel) zSel.addEventListener('change', () => store.setZona(zSel.value));
  if (mSel) mSel.addEventListener('change', () => store.setMet(mSel.value));

  // Selector CAUSA2 (Todas / SOBRECARGA madre / causa individual)
  const cSel = $('#f-causa');
  if (cSel) cSel.addEventListener('change', () => store.setCausa2(cSel.value));

  // Segmentado de modo de la serie temporal
  document.querySelectorAll('#serie-modo .serie-seg').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.modo) store.setSerieModo(btn.dataset.modo);
    });
  });

  // Segmentado de modo del chart programado vs no-programado
  document.querySelectorAll('#prog-modo .serie-seg').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.modo) store.setProgModo(btn.dataset.modo);
    });
  });

  // Chips de serie del chart prog/no-prog (programado / no programado)
  document.querySelectorAll('#prog-series .serie-seg').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.serie;
      if (s !== 'prog' && s !== 'nop') return;
      const cur = store.state.progSeries || { prog: true, nop: true };
      store.setProgSerie(s, !cur[s]);
    });
  });

  // Selector de mes para el detalle diario de la serie temporal
  const mesSel = $('#serie-mes');
  if (mesSel) mesSel.addEventListener('change', () => store.setSerieMes(mesSel.value));

  // Inputs META de la gráfica programado vs no-programado
  const metaSaidiInp = $('#meta-saidi');
  if (metaSaidiInp) metaSaidiInp.addEventListener('input', () => store.setMeta('saidi', metaSaidiInp.value));
  const metaSaifiInp = $('#meta-saifi');
  if (metaSaifiInp) metaSaifiInp.addEventListener('input', () => store.setMeta('saifi', metaSaifiInp.value));

  // Chips de filtro de grupos de causa
  document.querySelectorAll('#grp-filter .grp-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.grp;
      if (g) store.toggleGrupo(g);
    });
  });

  // Selectores del ranking de subestaciones (zona + mes propios)
  const rZona = $('#rank-zona');
  if (rZona) rZona.addEventListener('change', () => store.setRankZona(rZona.value));
  const rMes = $('#rank-mes');
  if (rMes) rMes.addEventListener('change', () => store.setRankMes(rMes.value));
}
