// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · Criterios MO.00418 (estático)
// ──────────────────────────────────────────────────────────────
// Cuadro siempre visible con las 7 variables y sus 5 filas de
// evaluación. No depende del dataset (catálogo del documento).
// Se renderiza una vez al boot.
// ══════════════════════════════════════════════════════════════

import { $, califColor } from '../_helpers.js';
import { VARS, CRITERIOS } from '../../../domain/parque_salud_config.js';

export function renderCriterios() {
  const host = $('#criterios');
  if (!host) return;
  host.innerHTML = VARS.map(v => {
    const cr = CRITERIOS[v.k];
    const rows = cr.filas.map(f =>
      `<tr><td class="cc" style="background:${califColor(f.c)}">${f.c}</td><td>${f.r}</td></tr>`
    ).join('');
    return `<div class="crit-card">
      <div class="ch"><div><span class="cn">${v.n}</span> <span class="cu">· ${cr.unidad}</span></div><span class="cref">${cr.ref}</span></div>
      <table class="crit-table"><tbody>${rows}</tbody></table>
      <div class="cnote">${cr.nota}</div>
    </div>`;
  }).join('');
}
