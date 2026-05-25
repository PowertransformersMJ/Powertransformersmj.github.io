// Renderer · Heatmap top-10 equipos × devanado (P/S/T)

import { $ } from './_helpers.js';
import { store } from '../state.js';

function hmColor(p) {
  if (p == null) return ['rgba(255,255,255,.04)', 'var(--ink3)', '—'];
  if (p > 100)  return ['var(--cri)', '#fff',     p.toFixed(0) + '%'];
  if (p >= 95)  return ['var(--ale)', '#fff',     p.toFixed(0) + '%'];
  if (p >= 80)  return ['var(--avi)', '#06222A',  p.toFixed(0) + '%'];
  return         ['rgba(52,211,153,.22)', '#9BF3D3', p.toFixed(0) + '%'];
}

export function renderHeatmap(rows) {
  const host = $('#heatmap');
  if (!host) return;
  const top = rows
    .filter(d => d.cmax != null)
    .sort((a, b) => b.cmax - a.cmax)
    .slice(0, 10);

  host.innerHTML =
    `<div style="display:grid;grid-template-columns:1fr 60px 60px 60px;gap:6px;align-items:center;">
      <div></div>
      <div class="tag" style="text-align:center;">Prim</div>
      <div class="tag" style="text-align:center;">Sec</div>
      <div class="tag" style="text-align:center;">Ter</div>
      ${top.map(d => {
        const c = ['P', 'S', 'T'].map(w => hmColor(d[w] && d[w].pct));
        return `<div class="hm-eq" data-i="${d._i}"
                style="font-size:11.5px;font-weight:600;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;">${d.sub}</div>
                ${c.map(x => `<div class="hm-cell" style="background:${x[0]};color:${x[1]}">${x[2]}</div>`).join('')}`;
      }).join('')}
    </div>`;

  host.querySelectorAll('.hm-eq').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.i, 10);
      if (!Number.isNaN(i)) store.setDetail(i);
    });
  });
}
