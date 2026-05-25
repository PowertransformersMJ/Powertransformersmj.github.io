// Renderer · Tabla priorizada de intervención
// Sort por columna · click en fila abre el modal.

import { $, fmt, cap } from './_helpers.js';
import { sev, metricPct } from '../../../domain/cargabilidad_severidad.js';
import { SEVCOL, SEVLBL, DEV_LABEL } from '../../../domain/cargabilidad_config.js';
import { store } from '../state.js';

export function renderTabla(rows) {
  const tbody = $('#tbody');
  const tcount = $('#tcount');
  if (!tbody) return;

  const { sort, dir, filtros } = store.state;
  const devSel = filtros.dev;

  const r2 = [...rows].filter(d => d.cmax != null).sort((a, b) => {
    let A, B;
    if (sort === 'cmax') { A = metricPct(a, devSel) || 0; B = metricPct(b, devSel) || 0; }
    else if (sort === 'us')  { A = a.us; B = b.us; }
    else if (sort === 'pot') { A = a.pot || 0; B = b.pot || 0; }
    else { A = ('' + a[sort]).toLowerCase(); B = ('' + b[sort]).toLowerCase(); }
    return A < B ? -dir : A > B ? dir : 0;
  });

  if (tcount) tcount.textContent = r2.length + ' equipos';

  tbody.innerHTML = r2.map(d => {
    const pct = metricPct(d, devSel);
    const s = sev(pct);
    const devNombre = devSel === 'all'
      ? d.dev
      : DEV_LABEL[devSel];
    const codigoDev = devSel === 'all'
      ? ({ Primario: 'P', Secundario: 'S', Terciario: 'T' }[d.dev] || 'P')
      : devSel;
    const o = d[codigoDev];
    const excede = o && o.l1 && o.car > o.l1;
    const w = Math.min(pct || 0, 160) / 160 * 100;
    return `<tr class="t-row" data-i="${d._i}">
      <td><div style="font-weight:700;">${d.sub}</div><div class="muted">${d.id}</div></td>
      <td class="muted">${cap(d.zona)}</td>
      <td><span class="pill bg-info" style="font-size:10.5px">${devNombre || '—'}</span></td>
      <td class="mono" style="font-weight:700">${fmt(o && o.car, 0)} A</td>
      <td class="mono muted">${fmt(o && o.amp, 0)} A</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="bar" style="flex:1">
            <i style="width:${w}%;background:linear-gradient(90deg,var(--ale),${SEVCOL[s]});box-shadow:0 0 8px ${SEVCOL[s]}"></i>
          </div>
          <b class="mono" style="color:${SEVCOL[s]};min-width:42px;text-align:right">${pct == null ? '—' : pct.toFixed(0) + '%'}</b>
        </div>
      </td>
      <td class="mono" style="color:${excede ? 'var(--cri)' : 'var(--ink2)'};font-size:11.5px">
        ${fmt(o && o.l1, 0)} A${excede ? ' ⚠' : ''}
      </td>
      <td><span class="pill bg-${s}"><span class="dot" style="background:${SEVCOL[s]};color:${SEVCOL[s]}"></span>${SEVLBL[s]}</span></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.t-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const i = parseInt(tr.dataset.i, 10);
      if (!Number.isNaN(i)) store.setDetail(i);
    });
  });
}
