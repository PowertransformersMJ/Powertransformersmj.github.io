// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · Tabla "Activos por Mayor Consecuencia"
// ──────────────────────────────────────────────────────────────
// Apartado con sus PROPIOS filtros (independientes de los del
// dashboard global). Top 15 por usuarios aguas abajo.
// ══════════════════════════════════════════════════════════════

import { $, bucketColor } from '../_helpers.js';
import { fmtCond } from '../../../domain/parque_salud_calc.js';
import { filasSegmento } from '../state.js';

function fmtM(x) {
  return x >= 1000 ? (x / 1000).toFixed(2) + 'k' : String(Math.round(x * 10) / 10);
}

export function renderTabla() {
  const tbody = document.querySelector('#tblCrit tbody');
  const kpisHost = $('#consKpis');
  if (!tbody || !kpisHost) return;

  const base = filasSegmento();
  const usuarios = base.reduce((s, a) => s + (a.usuarios_aguas_abajo || 0), 0);
  const mvaTot = base.reduce((s, a) => s + (a.mva || 0), 0);
  const mvaRiesgo = base.filter(a => a.bucket.cls >= 4).reduce((s, a) => s + (a.mva || 0), 0);

  const kpis = [
    { l: 'Activos',            v: base.length,                        s: 'en el filtro actual', cls: '' },
    { l: 'Usuarios afectados', v: usuarios.toLocaleString('es-CO'),   s: 'suma aguas abajo',    cls: '' },
    { l: 'MVA total',          v: fmtM(mvaTot) + ' MVA',              s: 'capacidad instalada', cls: '' },
    { l: 'MVA en riesgo',      v: fmtM(mvaRiesgo) + ' MVA',           s: 'condición 4–5',       cls: mvaRiesgo > 0 ? 'risk' : '' },
  ];
  kpisHost.innerHTML = kpis.map(x => `<div class="mva-stat ${x.cls}"><div class="l">${x.l}</div><div class="v">${x.v}</div><div class="s">${x.s}</div></div>`).join('');

  const top = [...base].sort((a, b) => (b.usuarios_aguas_abajo || 0) - (a.usuarios_aguas_abajo || 0)).slice(0, 15);
  tbody.innerHTML = top.map((a, i) => {
    const b = a.bucket;
    const col = bucketColor(b);
    return `<tr class="click" data-cod="${a.codigo}">
      <td class="rank">${i + 1}</td>
      <td class="code">${a.codigo}</td>
      <td class="mono" style="color:var(--ink-dim)">${a.matricula}</td>
      <td>${a.zona}</td><td>${a.departamento}</td>
      <td class="mono" style="font-size:11px">${a.tipo_activo}</td>
      <td><span class="hi-pill" style="color:${col}">${fmtCond(a.hi)}</span></td>
      <td><span class="chip" style="background:${col}"><i></i>${b.label}</span></td>
      <td class="mono">${a.mva != null ? a.mva.toFixed(2) : '—'}</td>
      <td class="mono">${a.usuarios_aguas_abajo.toLocaleString('es-CO')}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="10" style="text-align:center;color:var(--ink-dim);padding:24px">Sin activos para este filtro.</td></tr>`;
}
