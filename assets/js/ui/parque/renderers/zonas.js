// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · Tarjetas de zona
// ──────────────────────────────────────────────────────────────
// Comparativo por zona con stacked bar de buckets HI. Cada
// tarjeta es clickable y filtra el dashboard por esa zona.
// ══════════════════════════════════════════════════════════════

import { $, bucketColor, cssVar } from '../_helpers.js';
import { evaluados, avgHI, bucketOf, fmtAvg } from '../../../domain/parque_salud_calc.js';
import { BUCKETS } from '../../../domain/parque_salud_config.js';
import { store } from '../state.js';

export function renderZones() {
  const host = $('#zones');
  if (!host) return;
  const { rows, zonaDepto, filtros } = store.state;

  host.innerHTML = '';
  const cols = BUCKETS.map(b => cssVar(b.cssVar));

  Object.keys(zonaDepto).forEach(z => {
    const subset = rows.filter(a => a.zona === z && (!filtros.tipo || a.tipo_activo === filtros.tipo));
    const denom = evaluados(subset).length || 1;
    const hiAvg = avgHI(subset);
    const counts = [1, 2, 3, 4, 5].map(c => subset.filter(a => a.bucket.cls === c).length);
    const crit = subset.filter(a => a.bucket.cls >= 4).length;
    const stack = counts.map((n, i) => `<i style="width:${n / denom * 100}%;background:${cols[i]}"></i>`).join('');

    const el = document.createElement('div');
    el.className = 'zone' + (filtros.zona === z ? ' sel' : '');
    el.innerHTML = `<div class="zt"><span class="zname">${z}</span><span class="zn">${subset.length} activos</span></div>
      <div class="hi" style="color:${bucketColor(bucketOf(hiAvg))}">${fmtAvg(hiAvg)}</div>
      <div class="hilab">HI medio · ${bucketOf(hiAvg).label}</div>
      <div class="stack">${stack}</div>
      <div class="crit"><b>${crit}</b> en condición Pobre/Muy Pobre</div>`;
    el.onclick = () => {
      const nueva = filtros.zona === z ? '' : z;
      store.setFiltro({ zona: nueva, depto: '' });
    };
    host.appendChild(el);
  });
}
