// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · Radar de variables
// ──────────────────────────────────────────────────────────────
// Promedio de las 7 calificaciones (1..5) en gráfica radar.
// ══════════════════════════════════════════════════════════════

import { $, cssVar } from '../_helpers.js';
import { VARS } from '../../../domain/parque_salud_config.js';
import { fmtPct } from '../../../domain/parque_salud_calc.js';

let _chart = null;

export function renderRadar(rows) {
  const canvas = $('#chRadar');
  if (!canvas || typeof Chart === 'undefined') return;

  const data = VARS.map(v => {
    const vals = rows.map(a => a['calif_' + v.k]).filter(x => x != null && !Number.isNaN(x));
    return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  });

  if (_chart) _chart.destroy();
  _chart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: VARS.map(v => v.n),
      datasets: [{
        data, fill: true,
        backgroundColor: 'rgba(0,122,255,.13)',
        borderColor: cssVar('--accent'),
        pointBackgroundColor: cssVar('--accent'),
        borderWidth: 2, pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 1, max: 5,
          ticks: { stepSize: 1, color: cssVar('--ink-dim'), backdropColor: 'transparent', font: { size: 9 } },
          grid: { color: cssVar('--chart-grid') },
          angleLines: { color: cssVar('--chart-grid') },
          pointLabels: { color: cssVar('--ink'), font: { size: 11, family: 'Inter' } },
        },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` Calif. media: ${fmtPct(c.raw)}` } } },
    },
  });
}
