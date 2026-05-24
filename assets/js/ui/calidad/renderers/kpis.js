// Renderer · 6 tarjetas KPI

import { $, fmt } from './_helpers.js';
import { sumSerie, growthPct, gruposDeZona, totalSerieDeZona, proyeccionDeZona } from '../../../domain/saidi_calculo.js';

export function renderKPIs(dataset, zona /* , met */) {
  if (!dataset) return;
  const grp = gruposDeZona(dataset, zona, 'saidi');
  const totalSaidi = totalSerieDeZona(dataset, zona, 'saidi');
  const totalSaifi = totalSerieDeZona(dataset, zona, 'saifi');
  const sob = grp['Sobrecarga/Deslastre'] || [];
  const growth = growthPct(sob);
  const totSob = sumSerie(sob);
  const pj = proyeccionDeZona(dataset, zona) || {};

  const items = [
    { c: 'blue',   l: 'SAIDI_E sistema (Ene–May)',     v: fmt(sumSerie(totalSaidi), 2), d: 'horas-equivalentes' },
    { c: 'teal',   l: 'SAIFI_E sistema (Ene–May)',     v: fmt(sumSerie(totalSaifi), 2), d: 'interrupciones-eq' },
    { c: 'red',    l: 'SAIDI_E Sobrecarga/Deslastre',  v: fmt(totSob, 3),               d: 'causa controlable principal' },
    { c: 'amber',  l: 'Crecimiento Ene→May',           v: growth == null ? '—' : ('+' + growth + '%'), d: 'grupo Sobrecarga/Deslastre' },
    { c: 'purple', l: 'Proyección Dic (base)',         v: fmt(pj.base?.[11], 2),
      d: 'IC95% ' + fmt(pj.ci_inf?.[11], 2) + '–' + fmt(pj.ci_sup?.[11], 2) },
    { c: 'green',  l: 'Pendiente OLS',                 v: '+' + fmt(pj.slope, 2),
      d: '/mes · p=' + fmt(pj.pval, 3) + ' · R²=' + fmt(pj.r2, 2) },
  ];
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
