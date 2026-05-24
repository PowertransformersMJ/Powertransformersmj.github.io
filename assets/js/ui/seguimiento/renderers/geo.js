// ══════════════════════════════════════════════════════════════
// Renderer · Indicadores por zona (clic = filtra)
// ──────────────────────────────────────────────────────────────
// Se calculan sobre TODOS los eventos (no sobre el scope) para
// poder alternar entre zonas aunque haya un filtro activo. La
// tarjeta activa se resalta con un anillo del mismo color.
// ══════════════════════════════════════════════════════════════

import { ZONA_COLORS } from '../../../domain/scada_config.js';
import { store } from '../state.js';

const $ = (sel) => document.querySelector(sel);

export function renderGeoIndicators() {
  const { allEvents, filtros } = store.state;
  const m = new Map();
  for (const e of allEvents) {
    if (!e.viol) continue;
    const z = e.zona || 'SIN_ZONA';
    m.set(z, (m.get(z) || 0) + 1);
  }
  const zonas = [...m.entries()]
    .map(([zona, violations]) => ({ zona, violations }))
    .sort((a, b) => b.violations - a.violations);
  const totalAll = zonas.reduce((s, x) => s + x.violations, 0);

  const zc = $('#zona-indicators');
  if (!zc) return;
  zc.innerHTML = zonas.map(z => {
    const active = filtros.zona === z.zona;
    const col = ZONA_COLORS[z.zona] || '#7C3AED';
    const pct = ((z.violations / Math.max(totalAll, 1)) * 100).toFixed(1);
    return `<div class="geo-ind" data-val="${z.zona}"
      style="background:#fff;border-radius:6px;padding:12px;cursor:pointer;
             border-left:3px solid ${col};${active ? 'box-shadow:0 0 0 2px ' + col + ';' : ''}">
      <div class="small" style="color:var(--slate-500);text-transform:uppercase;letter-spacing:.5px;font-weight:600">${z.zona}${active ? ' ✓' : ''}</div>
      <div style="font-size:22px;font-weight:700;color:var(--slate-800)">${z.violations.toLocaleString()}</div>
      <div class="small" style="color:var(--slate-400)">violaciones · ${pct}%</div>
    </div>`;
  }).join('');

  document.querySelectorAll('.geo-ind').forEach(el => {
    el.addEventListener('click', () => {
      const val = el.dataset.val;
      const nueva = filtros.zona === val ? '' : val;
      store.setFiltro({ zona: nueva });
    });
  });
}
