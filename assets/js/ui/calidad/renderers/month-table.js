// Renderer · Tabla mensual agregada SAIDI_E

import { fmt, metricasActivas, metricaUnidad, metricaNombre } from './_helpers.js';
import { gruposDeZona, sumSerie, totalSerieDeZona } from '../../../domain/saidi_calculo.js';

export function renderMonthTable(dataset, zona, met = 'saidi') {
  if (!dataset) return;
  const mets = metricasActivas(met);
  const M = dataset.meses || [];

  // Actualiza el subtítulo del card según métrica activa
  const titulo = document.getElementById('month-titulo-met');
  if (titulo) {
    titulo.textContent = mets.length > 1
      ? '(SAIDI_E h-eq + SAIFI_E int-eq)'
      : `(${metricaNombre(mets[0])} ${metricaUnidad(mets[0])})`;
  }

  const thead = document.querySelector('#month-table thead');
  if (thead) {
    thead.innerHTML =
      `<tr><th scope="col">Grupo / mes</th>` +
      M.map(m => `<th scope="col" class="num">${m}</th>`).join('') +
      `<th scope="col" class="num">Total</th></tr>`;
  }

  const rowsDef = [
    ['Sobrecarga/Deslastre',  'g-sob'],
    ['Racionamiento/Deficit', 'g-rac'],
    ['Otras causas',          ''],
  ];

  let body = '';
  mets.forEach((m, idx) => {
    const grp = gruposDeZona(dataset, zona, m);
    const tot = totalSerieDeZona(dataset, zona, m);
    const sufijo = mets.length > 1 ? ` (${metricaNombre(m)} · ${metricaUnidad(m)})` : '';
    // Separador entre métricas cuando son dos
    if (idx > 0) {
      body += `<tr style="background:var(--slate-100)"><td colspan="${M.length + 2}" style="padding:8px 6px;font-size:10px;color:var(--slate-700);text-transform:uppercase;letter-spacing:.5px;font-weight:700">${metricaNombre(m)} · ${metricaUnidad(m)}</td></tr>`;
    } else if (mets.length > 1) {
      body += `<tr style="background:var(--slate-100)"><td colspan="${M.length + 2}" style="padding:8px 6px;font-size:10px;color:var(--slate-700);text-transform:uppercase;letter-spacing:.5px;font-weight:700">${metricaNombre(m)} · ${metricaUnidad(m)}</td></tr>`;
    }

    body += rowsDef.map(([g, cls]) => {
      const vals = grp[g] || [];
      const t = sumSerie(vals);
      return `<tr>
        <td><span class="grp-pill ${cls}">${g}${sufijo}</span></td>` +
        vals.map(v => `<td class="num">${fmt(v, 3)}</td>`).join('') +
        `<td class="num num-bad">${fmt(t, 3)}</td></tr>`;
    }).join('');

    body += `<tr style="background:var(--slate-50)">
      <td><b>TOTAL SISTEMA${mets.length > 1 ? ' · ' + metricaNombre(m) : ''}</b></td>` +
      tot.map(v => `<td class="num"><b>${fmt(v, 3)}</b></td>`).join('') +
      `<td class="num"><b>${fmt(sumSerie(tot), 3)}</b></td>
    </tr>`;
  });

  const tbody = document.querySelector('#month-table tbody');
  if (tbody) tbody.innerHTML = body;
}
