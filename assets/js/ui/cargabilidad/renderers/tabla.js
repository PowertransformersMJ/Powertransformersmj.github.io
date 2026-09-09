// Renderer · Tabla priorizada de intervención
// Sort por columna · click en fila abre el modal.

import { $, fmt, cap } from './_helpers.js';
import { sev, metricPct } from '../../../domain/cargabilidad_severidad.js';
import { SEVCOL, SEVLBL, DEV_LABEL } from '../../../domain/cargabilidad_config.js';
import { store } from '../state.js';

/** Corriente medida del devanado que la tabla está mostrando. */
function corrienteDe(d, devSel) {
  const k = devSel === 'all'
    ? ({ Primario: 'P', Secundario: 'S', Terciario: 'T' }[d.dev] || 'P')
    : devSel;
  return d[k] ? d[k].car : null;
}

/**
 * Los TRES devanados de un equipo en una celda: «P 145 · S 145 · T —».
 *
 * La tabla mostraba un solo devanado por fila —el más cargado, o el que
 * eligiera el filtro—, así que era imposible ver de un vistazo si un equipo
 * excede su ampacidad en uno o en dos. Con 28 de los 30 equipos en sobrecarga
 * excediendo primario Y secundario a la vez, esa distinción es justo lo que
 * hay que ver. En rojo el devanado que supera su ampacidad; guion si no tiene
 * medida (que NO es lo mismo que estar al 0 %).
 */
function devanadosCelda(d) {
  return ['P', 'S', 'T'].map((k) => {
    const o = d[k];
    if (!o || o.pct == null) return `<span class="muted">${k} —</span>`;
    const alto = o.pct > 100;
    return `<span style="color:${alto ? 'var(--cri)' : 'var(--ink2)'};font-weight:${alto ? 700 : 400}">`
      + `${k} ${o.pct.toFixed(0)}%</span>`;
  }).join('<span class="muted"> · </span>');
}

export function renderTabla(rows) {
  const tbody = $('#tbody');
  const tcount = $('#tcount');
  if (!tbody) return;

  const { sort, dir, filtros } = store.state;
  const devSel = filtros.dev;

  const r2 = [...rows].filter(d => d.cmax != null).sort((a, b) => {
    let A, B;
    // Un valor ausente NO es un cero: se hunde al final del orden en vez de
    // colarse entre los equipos medidos y ensuciar el ranking.
    const sinDato = -Infinity;
    if (sort === 'cmax') { A = metricPct(a, devSel) ?? sinDato; B = metricPct(b, devSel) ?? sinDato; }
    // «I medida» ordena por AMPERIOS, no por porcentaje. Antes compartía clave
    // con «% Ampacidad» y la flecha del orden salía en las dos columnas a la
    // vez, como si hubiera dos criterios activos. Además ordenar por corriente
    // absoluta es otra pregunta —qué equipo mueve más carga— y ahora se puede.
    else if (sort === 'icar') { A = corrienteDe(a, devSel) ?? sinDato; B = corrienteDe(b, devSel) ?? sinDato; }
    else if (sort === 'us')  { A = a.us ?? sinDato; B = b.us ?? sinDato; }
    else if (sort === 'pot') { A = a.pot ?? sinDato; B = b.pot ?? sinDato; }
    else { A = ('' + a[sort]).toLowerCase(); B = ('' + b[sort]).toLowerCase(); }
    return A < B ? -dir : A > B ? dir : 0;
  });

  // Sin indicador, pulsar «MVA» reordena la tabla y nada dice que pasó: el
  // Ingeniero no puede distinguir «ordenó por potencia» de «no hizo nada».
  document.querySelectorAll('thead th[data-k]').forEach((th) => {
    const activo = th.dataset.k === sort;
    th.setAttribute('aria-sort', activo ? (dir === 1 ? 'ascending' : 'descending') : 'none');
    const base = th.dataset.rotulo || (th.dataset.rotulo = th.textContent.replace(/\s*[▲▼]$/, '').trim());
    th.textContent = activo ? `${base} ${dir === 1 ? '▲' : '▼'}` : base;
    th.style.cursor = 'pointer';
    th.style.color = activo ? 'var(--ink)' : '';
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
      <td class="mono" style="font-weight:700">${d.pot == null ? '—' : fmt(d.pot / 1000, 1)}</td>
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
      <td class="mono" style="font-size:11.5px;white-space:nowrap">${devanadosCelda(d)}</td>
      <td class="mono muted">${d.us == null ? '—' : fmt(d.us, 0)}</td>
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
