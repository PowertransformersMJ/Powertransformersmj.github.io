// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · Listado buscable de activos
// ══════════════════════════════════════════════════════════════

import { $, bucketColor } from '../_helpers.js';
import { fmtCond } from '../../../domain/parque_salud_calc.js';
import { store } from '../state.js';

export function renderListado(rows) {
  const tbody = document.querySelector('#tblList tbody');
  const countTag = $('#listCount');
  if (!tbody) return;

  const q = (store.state.filtros.q || '').toLowerCase().trim();
  let list = rows;
  if (q) {
    list = rows.filter(a =>
      (a.codigo + ' ' + a.matricula + ' ' + (a.subestacion || '')).toLowerCase().includes(q)
    );
  }
  list = [...list].sort((a, b) => (b.hi ?? -1) - (a.hi ?? -1));

  if (countTag) countTag.textContent = `${list.length} de ${rows.length} activos`;
  tbody.innerHTML = list.map(a => {
    const b = a.bucket;
    const col = bucketColor(b);
    return `<tr class="click" data-cod="${a.codigo}">
      <td class="code">${a.codigo}</td>
      <td class="mono" style="color:var(--ink-dim)">${a.matricula}</td>
      <td>${a.departamento}</td>
      <td>${a.subestacion || '—'}</td>
      <td class="mono" style="font-size:11px">${a.tipo_activo}</td>
      <td class="mono">${a.mva != null ? a.mva.toFixed(2) : '—'}</td>
      <td><span class="hi-pill" style="color:${col}">${fmtCond(a.hi)}</span></td>
      <td><span class="chip" style="background:${col}"><i></i>${b.label}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="text-align:center;color:var(--ink-dim);padding:24px">Sin coincidencias.</td></tr>`;
}
