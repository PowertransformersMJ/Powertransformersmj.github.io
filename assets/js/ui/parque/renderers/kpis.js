// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · KPI strip
// ──────────────────────────────────────────────────────────────
// Renderiza las 6 tarjetas resumen del dashboard:
// activos, condición media, % críticos, condición 5, riesgo alto,
// variable dominante.
// ══════════════════════════════════════════════════════════════

import { $ } from '../_helpers.js';
import {
  evaluados, avgHI, topVar, bucketOf, critIndex,
  fmtPct, fmtAvg
} from '../../../domain/parque_salud_calc.js';

export function renderKPIs(rows) {
  const host = $('#kpis');
  if (!host) return;

  const total = rows.length;
  const ev = evaluados(rows);
  const criticos = rows.filter(a => a.bucket.cls >= 4).length;
  const cond5 = rows.filter(a => a.bucket.cls === 5).length;
  const sinEval = total - ev.length;
  const hiAvg = avgHI(rows);
  const pctCrit = ev.length ? criticos / ev.length * 100 : 0;
  const maxCrit = rows.filter(
    a => critIndex(a.usuarios_aguas_abajo) >= 3 && a.bucket.cls >= 4
  ).length;

  const k = [
    { lab: 'Activos en selección', val: total,                              sub: `${ev.length} evaluados · ${sinEval} sin dato`, cls: '' },
    { lab: 'Condición media',      val: fmtAvg(hiAvg),                      sub: bucketOf(hiAvg).label,                          cls: hiAvg >= 3.5 ? 'bad' : hiAvg >= 2.5 ? 'warn' : 'good' },
    { lab: '% activos críticos',   val: fmtPct(pctCrit) + '<small>%</small>', sub: 'condición Pobre/Muy Pobre',                  cls: pctCrit >= 15 ? 'bad' : pctCrit >= 8 ? 'warn' : 'good' },
    { lab: 'Condición 5',          val: cond5,                              sub: 'Muy Pobre · acción inmediata',                 cls: cond5 > 0 ? 'bad' : 'good' },
    { lab: 'Riesgo alto matriz',   val: maxCrit,                            sub: 'crítico × consecuencia ≥ Mayor',               cls: maxCrit > 0 ? 'bad' : 'good' },
    { lab: 'Variable dominante',   val: topVar(rows),                       sub: 'mayor calificación media',                     cls: 'warn' },
  ];
  host.innerHTML = k.map(x => `<div class="kpi ${x.cls}">
     <div class="lab">${x.lab}</div><div class="val">${x.val}</div><div class="sub">${x.sub}</div></div>`).join('');
}
