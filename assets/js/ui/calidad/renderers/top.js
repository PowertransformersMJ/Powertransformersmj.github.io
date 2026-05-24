// Renderer · Top categorías objetivo (tabla)

import { $, fmt, grupoCorto, metricaLabel, metricasActivas } from './_helpers.js';
import { catTotals } from '../../../domain/saidi_calculo.js';

export function renderTop(dataset, zona, met) {
  if (!dataset) return;
  const mets = metricasActivas(met);
  const isAmbos = mets.length > 1;
  const tbody = document.querySelector('#top-table tbody');
  const thead = document.querySelector('#top-table thead');
  if (!tbody) return;

  if (isAmbos) {
    // Cabecera con columnas SAIDI y SAIFI
    if (thead) {
      thead.innerHTML = `<tr>
        <th scope="col">#</th>
        <th scope="col">Categoría</th>
        <th scope="col">Grupo</th>
        <th scope="col" class="num">SAIDI (h-eq)</th>
        <th scope="col" class="num">SAIFI (int-eq)</th>
      </tr>`;
    }
    // Ordenamos por SAIDI; mostramos también SAIFI alineado a la misma categoría
    const tSaidi = catTotals(dataset, zona, 'saidi');
    const tSaifi = catTotals(dataset, zona, 'saifi');
    const mapSaifi = Object.fromEntries(tSaifi.map(d => [d.cat, d.tot]));
    tbody.innerHTML = tSaidi.slice(0, 8).map((d, i) => {
      const grp = grupoCorto(d.cat);
      const gl = grp === 'rac' ? 'Racion.' : 'Sob/Desl';
      const rankCls = i + 1 <= 3 ? `rank-${i + 1}` : '';
      const saifiVal = mapSaifi[d.cat] || 0;
      return `<tr>
        <td class="rank ${rankCls}">${i + 1}</td>
        <td>${d.cat}</td>
        <td><span class="grp-pill g-${grp}">${gl}</span></td>
        <td class="num ${i === 0 ? 'num-bad' : ''}">${fmt(d.tot, 3)}</td>
        <td class="num">${fmt(saifiVal, 3)}</td>
      </tr>`;
    }).join('');
  } else {
    // Cabecera por defecto (una sola métrica + %)
    if (thead) {
      thead.innerHTML = `<tr>
        <th scope="col">#</th>
        <th scope="col">Categoría</th>
        <th scope="col">Grupo</th>
        <th scope="col" class="num">Acum.</th>
        <th scope="col" class="num">%</th>
      </tr>`;
    }
    const t = catTotals(dataset, zona, met);
    const tot = t.reduce((s, d) => s + d.tot, 0);
    tbody.innerHTML = t.slice(0, 8).map((d, i) => {
      const grp = grupoCorto(d.cat);
      const gl = grp === 'rac' ? 'Racion.' : 'Sob/Desl';
      const rankCls = i + 1 <= 3 ? `rank-${i + 1}` : '';
      return `<tr>
        <td class="rank ${rankCls}">${i + 1}</td>
        <td>${d.cat}</td>
        <td><span class="grp-pill g-${grp}">${gl}</span></td>
        <td class="num ${i === 0 ? 'num-bad' : ''}">${fmt(d.tot, 3)}</td>
        <td class="num">${tot > 0 ? fmt(d.tot / tot * 100, 1) : '—'}%</td>
      </tr>`;
    }).join('');
  }
  const pill = $('#top-pill');
  if (pill) pill.textContent = metricaLabel(met);
}
