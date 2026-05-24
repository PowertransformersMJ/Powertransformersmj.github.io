// ══════════════════════════════════════════════════════════════
// Renderer · Top 10 transformadores por violaciones
// ══════════════════════════════════════════════════════════════

import { aggTop10 } from '../../../domain/scada_violaciones.js';
import { scopedEvents, store } from '../state.js';

const $ = (sel) => document.querySelector(sel);

const LABEL_MAP = {
  all:     'todas las magnitudes',
  voltage: 'tensiones (kV)',
  current: 'corrientes (A)',
  power:   'potencias (MVA/MW/MVAr)',
};

export function renderTop10() {
  const { topTab } = store.state;
  const data = aggTop10(scopedEvents(), topTab);
  const tbody = document.querySelector('#top10-table tbody');
  const detail = $('#top10-detail');

  if (data.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--slate-400)">Sin datos para esta magnitud</td></tr>`;
    if (detail) detail.textContent = '—';
    return;
  }
  if (tbody) {
    tbody.innerHTML = data.map((t, i) => `
      <tr>
        <td><span class="rank rank-${i + 1}">#${i + 1}</span></td>
        <td><strong>${t.name}</strong><div class="small">${t.sid}</div></td>
        <td>${t.kv}</td>
        <td><span class="zona-pill">${t.zona || '—'}</span></td>
        <td class="num">${t.u1}</td>
        <td class="num">${t.u2}</td>
        <td class="num num-bad">${t.total.toLocaleString()}</td>
        <td class="num">${t.maxV.toFixed(3)}</td>
      </tr>`).join('');
  }
  if (detail) {
    detail.textContent =
      `Mostrando Top 10 por ${LABEL_MAP[topTab]} · ${data[0].name} lidera con ${data[0].total.toLocaleString()} violaciones`;
  }
}
