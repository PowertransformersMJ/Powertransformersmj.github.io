// Renderer · 6 tarjetas KPI

import { $, fmt } from './_helpers.js';
import { sumSerie, growthPct, gruposDeZona, totalSerieDeZona, proyeccionDeZona } from '../../../domain/saidi_calculo.js';
import { calcularProyeccionOLS } from '../../../domain/saidi_proyeccion.js';

// Proyección de la métrica m sobre el grupo Sob/Desl.
// SAIDI usa el bloque precalculado del baseline; SAIFI se calcula
// on-the-fly con calcularProyeccionOLS para usar las unidades correctas.
function proyDeMetrica(dataset, zona, m) {
  if (m === 'saidi') return proyeccionDeZona(dataset, zona) || {};
  const grp = gruposDeZona(dataset, zona, m);
  const sob = grp['Sobrecarga/Deslastre'] || [];
  if (!sob.length) return {};
  return calcularProyeccionOLS(sob, dataset.meses_full.length);
}

export function renderKPIs(dataset, zona, met = 'saidi') {
  if (!dataset) return;
  const isAmbos = met === 'ambos';
  const grpSaidi = gruposDeZona(dataset, zona, 'saidi');
  const grpSaifi = gruposDeZona(dataset, zona, 'saifi');
  const sobSaidi = grpSaidi['Sobrecarga/Deslastre'] || [];
  const sobSaifi = grpSaifi['Sobrecarga/Deslastre'] || [];

  const totalSistemaSaidi = sumSerie(totalSerieDeZona(dataset, zona, 'saidi'));
  const totalSistemaSaifi = sumSerie(totalSerieDeZona(dataset, zona, 'saifi'));
  const totSobSaidi = sumSerie(sobSaidi);
  const totSobSaifi = sumSerie(sobSaifi);
  const growthSaidi = growthPct(sobSaidi);
  const growthSaifi = growthPct(sobSaifi);

  // Las 2 tarjetas de sistema siempre van; las 4 restantes cambian
  // según la métrica activa para mostrar la información más relevante
  // CON SUS UNIDADES CORRECTAS.
  const items = [
    { c: 'blue', l: 'SAIDI_E sistema (Ene–May)', v: fmt(totalSistemaSaidi, 2), d: 'horas-equivalentes (h-eq)' },
    { c: 'teal', l: 'SAIFI_E sistema (Ene–May)', v: fmt(totalSistemaSaifi, 2), d: 'interrupciones-eq (int-eq)' },
  ];

  if (isAmbos) {
    const pS = proyDeMetrica(dataset, zona, 'saidi');
    const pF = proyDeMetrica(dataset, zona, 'saifi');
    items.push(
      { c: 'red',    l: 'SAIDI_E Sob/Desl (Ene–May)',     v: fmt(totSobSaidi, 3) + ' h-eq',  d: 'duración · causa controlable' },
      { c: 'red',    l: 'SAIFI_E Sob/Desl (Ene–May)',     v: fmt(totSobSaifi, 3) + ' int-eq', d: 'frecuencia · causa controlable' },
      { c: 'amber',  l: 'Crecimiento SAIDI Ene→May',      v: growthSaidi == null ? '—' : ('+' + growthSaidi + '%'),
        d: `pendiente OLS +${fmt(pS.slope, 2)} h-eq/mes` },
      { c: 'amber',  l: 'Crecimiento SAIFI Ene→May',      v: growthSaifi == null ? '—' : ('+' + growthSaifi + '%'),
        d: `pendiente OLS +${fmt(pF.slope, 2)} int-eq/mes` },
    );
  } else if (met === 'saifi') {
    // TODA la información KPI debe ser de SAIFI cuando se selecciona SAIFI.
    const pF = proyDeMetrica(dataset, zona, 'saifi');
    items.push(
      { c: 'red',    l: 'SAIFI_E Sobrecarga/Deslastre',   v: fmt(totSobSaifi, 3), d: 'int-eq · causa controlable' },
      { c: 'amber',  l: 'Crecimiento Ene→May (SAIFI)',    v: growthSaifi == null ? '—' : ('+' + growthSaifi + '%'),
        d: 'SAIFI · grupo Sob/Desl' },
      { c: 'purple', l: 'Proyección Dic (SAIFI · base)',  v: fmt(pF.base?.[11], 2) + ' int-eq',
        d: 'IC95% ' + fmt(pF.ci_inf?.[11], 2) + '–' + fmt(pF.ci_sup?.[11], 2) + ' int-eq' },
      { c: 'green',  l: 'Pendiente OLS (SAIFI)',          v: '+' + fmt(pF.slope, 2) + ' int-eq',
        d: '/mes · p=' + fmt(pF.pval, 3) + ' · R²=' + fmt(pF.r2, 2) },
    );
  } else {
    // SAIDI (default)
    const pS = proyDeMetrica(dataset, zona, 'saidi');
    items.push(
      { c: 'red',    l: 'SAIDI_E Sobrecarga/Deslastre',   v: fmt(totSobSaidi, 3), d: 'h-eq · causa controlable' },
      { c: 'amber',  l: 'Crecimiento Ene→May (SAIDI)',    v: growthSaidi == null ? '—' : ('+' + growthSaidi + '%'),
        d: 'SAIDI · grupo Sob/Desl' },
      { c: 'purple', l: 'Proyección Dic (SAIDI · base)',  v: fmt(pS.base?.[11], 2) + ' h-eq',
        d: 'IC95% ' + fmt(pS.ci_inf?.[11], 2) + '–' + fmt(pS.ci_sup?.[11], 2) + ' h-eq' },
      { c: 'green',  l: 'Pendiente OLS (SAIDI)',          v: '+' + fmt(pS.slope, 2) + ' h-eq',
        d: '/mes · p=' + fmt(pS.pval, 3) + ' · R²=' + fmt(pS.r2, 2) },
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
