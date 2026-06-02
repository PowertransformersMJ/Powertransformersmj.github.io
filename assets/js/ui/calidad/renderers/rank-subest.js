// Renderer · Ranking TOP 10 de subestaciones por aporte SAIDI_E / SAIFI_E
// Filtrable por zona y por mes desde sus propios selectores (rankZona /
// rankMes en el store). Respeta la métrica global activa para el orden.

import { $, fmt, metricaLabel, metricasActivas } from './_helpers.js';
import { MESES_CANON } from '../../../domain/saidi_datos.js';
import { rankingSubestaciones } from '../../../domain/saidi_calculo.js';
import { zonaLabel } from '../../../domain/saidi_config.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function renderRankSubest(dataset, met = 'saidi', rankZona = 'TODAS', rankMes = null) {
  const tbody = document.querySelector('#rank-subest-table tbody');
  const thead = document.querySelector('#rank-subest-table thead');
  const pill = $('#rank-subest-pill');
  if (!tbody) return;

  const ordenarPor = metricasActivas(met)[0]; // 'saidi' o 'saifi'

  if (thead) {
    thead.innerHTML = `<tr>
      <th scope="col">#</th>
      <th scope="col">Subestación</th>
      <th scope="col" class="num">SAIDI (h-eq)</th>
      <th scope="col" class="num">SAIFI (int-eq)</th>
      <th scope="col" class="num">%</th>
    </tr>`;
  }

  // Dataset sin detalle de subestaciones (baseline / CSV / pre-agregado).
  if (!dataset?.subests || !dataset.subests[rankZona]) {
    tbody.innerHTML = `<tr><td colspan="5" class="rank-empty">
      El ranking por subestación requiere cargar el Excel de origen (hoja DATOS · columna NB_SUBESTACION).
    </td></tr>`;
    if (pill) pill.textContent = 'sin detalle de subestaciones';
    return;
  }

  const filas = rankingSubestaciones(dataset, rankZona, ordenarPor, rankMes);
  const total = filas.reduce((s, d) => s + (+d[ordenarPor] || 0), 0);
  const top = filas.slice(0, 10);

  if (!top.length) {
    const mesTxt = rankMes != null ? `${MESES_CANON[rankMes]} · ` : '';
    tbody.innerHTML = `<tr><td colspan="5" class="rank-empty">
      ${mesTxt}Sin aporte de subestaciones para ${esc(zonaLabel(rankZona))}.
    </td></tr>`;
  } else {
    tbody.innerHTML = top.map((d, i) => {
      const rankCls = i + 1 <= 3 ? `rank-${i + 1}` : '';
      const share = total > 0 ? (+d[ordenarPor] || 0) / total * 100 : 0;
      return `<tr>
        <td class="rank ${rankCls}">${i + 1}</td>
        <td>${esc(d.sub)}</td>
        <td class="num ${i === 0 ? 'num-bad' : ''}">${fmt(d.saidi, 3)}</td>
        <td class="num">${fmt(d.saifi, 3)}</td>
        <td class="num">${total > 0 ? fmt(share, 1) : '—'}%</td>
      </tr>`;
    }).join('');
  }

  if (pill) {
    const mesTxt = rankMes != null ? MESES_CANON[rankMes] : 'todos los meses';
    pill.textContent = `${zonaLabel(rankZona)} · ${mesTxt} · ${metricaLabel(met)}`;
  }
}
