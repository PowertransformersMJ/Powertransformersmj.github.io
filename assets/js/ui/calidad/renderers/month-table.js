// Renderer · Tabla mensual agregada SAIDI_E

import { fmt } from './_helpers.js';
import { gruposDeZona, sumSerie, totalSerieDeZona } from '../../../domain/saidi_calculo.js';

export function renderMonthTable(dataset, zona) {
  if (!dataset) return;
  const grp = gruposDeZona(dataset, zona, 'saidi');
  const tot = totalSerieDeZona(dataset, zona, 'saidi');
  const M = dataset.meses || [];

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

  let body = rowsDef.map(([g, cls]) => {
    const vals = grp[g] || [];
    const t = sumSerie(vals);
    return `<tr>
      <td><span class="grp-pill ${cls}">${g}</span></td>` +
      vals.map(v => `<td class="num">${fmt(v, 3)}</td>`).join('') +
      `<td class="num num-bad">${fmt(t, 3)}</td></tr>`;
  }).join('');

  body += `<tr style="background:var(--slate-50)">
    <td><b>TOTAL SISTEMA</b></td>` +
    tot.map(v => `<td class="num"><b>${fmt(v, 3)}</b></td>`).join('') +
    `<td class="num"><b>${fmt(sumSerie(tot), 3)}</b></td>
  </tr>`;

  const tbody = document.querySelector('#month-table tbody');
  if (tbody) tbody.innerHTML = body;
}
