// Renderer · Top categorías objetivo (tabla)

import { $, fmt, grupoCorto, metricaNombre } from './_helpers.js';
import { catTotals } from '../../../domain/saidi_calculo.js';

export function renderTop(dataset, zona, met) {
  if (!dataset) return;
  const t = catTotals(dataset, zona, met);
  const tot = t.reduce((s, d) => s + d.tot, 0);
  const tbody = document.querySelector('#top-table tbody');
  if (tbody) {
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
  if (pill) pill.textContent = metricaNombre(met);
}
