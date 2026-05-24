// Renderer · 6 tarjetas KPI

import { $, fmt } from './_helpers.js';
import { sumSerie, growthPct, gruposDeZona, totalSerieDeZona, proyeccionDeZona } from '../../../domain/saidi_calculo.js';

export function renderKPIs(dataset, zona, met = 'saidi') {
  if (!dataset) return;
  const isAmbos = met === 'ambos';
  const grpSaidi = gruposDeZona(dataset, zona, 'saidi');
  const grpSaifi = gruposDeZona(dataset, zona, 'saifi');
  const totalSaidi = totalSerieDeZona(dataset, zona, 'saidi');
  const totalSaifi = totalSerieDeZona(dataset, zona, 'saifi');
  const sobSaidi = grpSaidi['Sobrecarga/Deslastre'] || [];
  const sobSaifi = grpSaifi['Sobrecarga/Deslastre'] || [];
  const pj = proyeccionDeZona(dataset, zona) || {};

  const totalSistemaSaidi = sumSerie(totalSaidi);
  const totalSistemaSaifi = sumSerie(totalSaifi);
  const totSobSaidi = sumSerie(sobSaidi);
  const totSobSaifi = sumSerie(sobSaifi);
  const growthSaidi = growthPct(sobSaidi);
  const growthSaifi = growthPct(sobSaifi);

  // Las 2 tarjetas de sistema siempre van; las 4 restantes cambian
  // según la métrica activa para mostrar la información más relevante.
  const items = [
    { c: 'blue',   l: 'SAIDI_E sistema (Ene–May)',     v: fmt(totalSistemaSaidi, 2), d: 'horas-equivalentes (h-eq)' },
    { c: 'teal',   l: 'SAIFI_E sistema (Ene–May)',     v: fmt(totalSistemaSaifi, 2), d: 'interrupciones-eq (int-eq)' },
  ];

  if (isAmbos) {
    items.push(
      { c: 'red',    l: 'SAIDI_E Sobrecarga/Deslastre',  v: fmt(totSobSaidi, 3) + ' h-eq', d: 'duración por causa controlable' },
      { c: 'red',    l: 'SAIFI_E Sobrecarga/Deslastre',  v: fmt(totSobSaifi, 3) + ' int-eq', d: 'frecuencia por causa controlable' },
      { c: 'amber',  l: 'Crecimiento SAIDI Ene→May',     v: growthSaidi == null ? '—' : ('+' + growthSaidi + '%'), d: 'grupo Sob/Desl · duración' },
      { c: 'amber',  l: 'Crecimiento SAIFI Ene→May',     v: growthSaifi == null ? '—' : ('+' + growthSaifi + '%'), d: 'grupo Sob/Desl · frecuencia' },
    );
  } else if (met === 'saifi') {
    items.push(
      { c: 'red',    l: 'SAIFI_E Sobrecarga/Deslastre',  v: fmt(totSobSaifi, 3), d: 'int-eq · causa controlable' },
      { c: 'amber',  l: 'Crecimiento Ene→May',           v: growthSaifi == null ? '—' : ('+' + growthSaifi + '%'), d: 'SAIFI · grupo Sob/Desl' },
      { c: 'purple', l: 'Proyección Dic (base)',         v: fmt(pj.base?.[11], 2) + ' h-eq',
        d: 'SAIDI · IC95% ' + fmt(pj.ci_inf?.[11], 2) + '–' + fmt(pj.ci_sup?.[11], 2) },
      { c: 'green',  l: 'Pendiente OLS (SAIDI)',         v: '+' + fmt(pj.slope, 2) + ' h-eq',
        d: '/mes · p=' + fmt(pj.pval, 3) + ' · R²=' + fmt(pj.r2, 2) },
    );
  } else {
    items.push(
      { c: 'red',    l: 'SAIDI_E Sobrecarga/Deslastre',  v: fmt(totSobSaidi, 3), d: 'h-eq · causa controlable' },
      { c: 'amber',  l: 'Crecimiento Ene→May',           v: growthSaidi == null ? '—' : ('+' + growthSaidi + '%'), d: 'SAIDI · grupo Sob/Desl' },
      { c: 'purple', l: 'Proyección Dic (base)',         v: fmt(pj.base?.[11], 2) + ' h-eq',
        d: 'IC95% ' + fmt(pj.ci_inf?.[11], 2) + '–' + fmt(pj.ci_sup?.[11], 2) },
      { c: 'green',  l: 'Pendiente OLS',                 v: '+' + fmt(pj.slope, 2) + ' h-eq',
        d: '/mes · p=' + fmt(pj.pval, 3) + ' · R²=' + fmt(pj.r2, 2) },
    );
  }

  const host = $('#kpi-grid');
  if (host) {
    host.innerHTML = items.map(i =>
      `<div class="kpi ${i.c}">
        <div class="label">${i.l}</div>
        <div class="value ${String(i.v).length > 7 ? 'smaller' : ''}">${i.v}</div>
        <div class="delta">${i.d}</div>
      </div>`
    ).join('');
  }
}
