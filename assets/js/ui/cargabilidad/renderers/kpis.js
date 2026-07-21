// Renderer · 6 tarjetas KPI

import { $, fmt } from './_helpers.js';

export function renderKPIs(rows) {
  const host = $('#kpis');
  if (!host) return;
  const valid  = rows.filter(d => d.cmax != null);
  const crit   = valid.filter(d => d.cmax > 100).length;
  const riesgo = valid.filter(d => d.cmax > 80).length;
  const pr     = valid.length ? (riesgo / valid.length * 100) : 0;
  let mx = 0, mxloc = '—';
  valid.forEach(d => { if (d.cmax > mx) { mx = d.cmax; mxloc = d.sub; } });
  const us = valid.filter(d => d.cmax > 100).reduce((a, d) => a + (d.us || 0), 0);
  const subs = new Set(rows.map(d => d.sub)).size;

  const K = [
    ['TX en sobrecarga',    crit,                    'equipos', '&gt;100% en ≥1 devanado', 'var(--cri)'],
    ['Flota en riesgo',     pr.toFixed(0),           '%',       riesgo + ' TX por encima del 80%', 'var(--avi)'],
    ['Máxima carga',        mx.toFixed(0),           '%',       mxloc, 'var(--cri)'],
    ['Usuarios expuestos',  (us / 1000).toFixed(us > 9999 ? 0 : 1), 'mil', 'bajo equipos críticos', 'var(--aqua2)'],
    ['Equipos visibles',    rows.length,             'TX',      subs + ' subestaciones', 'var(--aqua)'],
    // G020 (ADR-052 Ola 2): retirado 'Tiempo medio mitig. 4.2h' — era un valor
    // FABRICADO (hard-coded, sin origen en datos). Doctrina: no fabricar datos.
  ];

  host.innerHTML = K.map(k =>
    `<div class="glass kpi">
      <div class="tag">${k[0]}</div>
      <div style="display:flex;align-items:baseline;gap:6px;">
        <span class="n mono" style="color:${k[4]}">${fmt(+k[1], String(k[1]).includes('.') ? 1 : 0)}</span>
        <span class="u">${k[2]}</span>
      </div>
      <div class="s">${k[3]}</div>
    </div>`
  ).join('');
}
