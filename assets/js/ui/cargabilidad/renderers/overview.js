// Renderer · zone-bars (barras por zona) + donut (distribución)

import { $ } from './_helpers.js';
import { sev } from '../../../domain/cargabilidad_severidad.js';
import { SEVCOL, SEVERIDADES_ORDEN, SEVLBL } from '../../../domain/cargabilidad_config.js';
import { store } from '../state.js';

export function renderOverview(rows) {
  renderDonut(rows);
  renderZoneBars(rows);
}

function renderDonut(rows) {
  const host = $('#donut');
  if (!host) return;
  const valid = rows.filter(d => d.cmax != null);
  // Conteo por severidad, en orden ok → avi → ale → cri (orden de
  // apilado del donut igual que el archivo original).
  const seg = [
    { n: SEVLBL.ok,  c: 'ok' },
    { n: SEVLBL.avi, c: 'avi' },
    { n: SEVLBL.ale, c: 'ale' },
    { n: SEVLBL.cri, c: 'cri' },
  ].map(s => ({ ...s, v: valid.filter(d => sev(d.cmax) === s.c).length }));

  const tot = seg.reduce((a, s) => a + s.v, 0) || 1;
  let acc = 0;
  const stops = seg.map(s => {
    const p = s.v / tot * 360;
    const seg2 = `${SEVCOL[s.c]} ${acc}deg ${acc + p}deg`;
    acc += p;
    return seg2;
  }).join(',');

  const leg = seg.map(s =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:12.5px;">
       <span style="display:flex;align-items:center;gap:8px;"><span class="dot" style="background:${SEVCOL[s.c]};color:${SEVCOL[s.c]}"></span>${s.n}</span>
       <b class="mono">${s.v}</b>
     </div>`
  ).join('');

  host.innerHTML = `<div style="display:flex;gap:18px;align-items:center;">
    <div style="width:120px;height:120px;border-radius:50%;flex-shrink:0;background:conic-gradient(${stops});-webkit-mask:radial-gradient(transparent 54%,#000 55%);mask:radial-gradient(transparent 54%,#000 55%);"></div>
    <div style="flex:1;">${leg}</div>
  </div>`;
  // Marcar el orden global SEVERIDADES_ORDEN como usado (lint hint)
  void SEVERIDADES_ORDEN;
}

function renderZoneBars(rows) {
  const host = $('#zonebars');
  if (!host) return;
  const valid = rows.filter(d => d.cmax != null);
  const zonas = {};
  valid.forEach(d => { (zonas[d.zona] = zonas[d.zona] || []).push(d); });
  const maxn = Math.max(1, ...Object.values(zonas).map(a => a.length));
  const bars = Object.entries(zonas)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([z, arr]) => {
      const crit = arr.filter(d => d.cmax > 100).length;
      const w  = arr.length / maxn * 100;
      const cw = crit / arr.length * w;
      const prom = arr.reduce((a, d) => a + d.cmax, 0) / arr.length;
      return `<div class="zonebar-row" data-zona="${z}" style="margin-bottom:14px;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
          <b>${z}</b>
          <span class="mono muted">${arr.length} TX · ${prom.toFixed(0)}% prom · <span class="c-cri">${crit} crít</span></span>
        </div>
        <div class="bar" style="height:15px;">
          <i style="width:${w}%;background:linear-gradient(90deg,rgba(94,234,212,.5),rgba(34,211,238,.35))"></i>
          <i style="width:${cw}%;background:linear-gradient(90deg,var(--cri),#FF8AA0);box-shadow:0 0 12px var(--cri)"></i>
        </div>
      </div>`;
    }).join('');
  host.innerHTML = bars;

  // Click en barra de zona → fija filtro
  host.querySelectorAll('.zonebar-row').forEach(el => {
    el.addEventListener('click', () => {
      const z = el.dataset.zona;
      store.setFiltro({ zona: z });
    });
  });
}
