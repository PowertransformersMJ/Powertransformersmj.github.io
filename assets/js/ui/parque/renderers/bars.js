// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · HI medio por departamento
// ══════════════════════════════════════════════════════════════

import { $, cssVar, bucketColor } from '../_helpers.js';
import { evaluados, avgHI, bucketOf, fmtPct } from '../../../domain/parque_salud_calc.js';

let _chart = null;

export function renderBars(rows) {
  const canvas = $('#chBars');
  if (!canvas || typeof Chart === 'undefined') return;

  const deptos = [...new Set(rows.map(a => a.departamento))].sort()
    .filter(d => evaluados(rows.filter(a => a.departamento === d)).length > 0);
  const data = deptos.map(d => avgHI(rows.filter(a => a.departamento === d)));
  const cols = data.map(v => bucketColor(bucketOf(v)));

  if (_chart) _chart.destroy();
  _chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: deptos, datasets: [{ data, backgroundColor: cols, borderRadius: 4, maxBarThickness: 46 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 1, max: 5, ticks: { stepSize: 1, color: cssVar('--ink-dim'), font: { family: 'JetBrains Mono' } }, grid: { color: cssVar('--chart-grid') } },
        x: { ticks: { color: cssVar('--ink'), font: { family: 'Inter', size: 11 } }, grid: { display: false } },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` HI medio: ${fmtPct(c.raw)} · ${bucketOf(c.raw).label}` } } },
    },
  });
}
