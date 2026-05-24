// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · Distribución de condición
// ──────────────────────────────────────────────────────────────
// Barras verticales (5 buckets) con leyenda inferior. Usa
// Chart.js global (cargado por el HTML). Cachea la instancia
// para destruir en re-render.
// ══════════════════════════════════════════════════════════════

import { $, cssVar } from '../_helpers.js';
import { BUCKETS, BUCKET_NULL } from '../../../domain/parque_salud_config.js';
import { evaluados, fmtPct } from '../../../domain/parque_salud_calc.js';

let _chart = null;

export function renderDonut(rows) {
  const canvas = $('#chDonut');
  if (!canvas || typeof Chart === 'undefined') return;

  const counts = [1, 2, 3, 4, 5].map(c => rows.filter(a => a.bucket.cls === c).length);
  const labels = BUCKETS.map(b => (b.cls + ' ' + b.label));
  const colors = BUCKETS.map(b => cssVar(b.cssVar));

  if (_chart) _chart.destroy();

  // Plugin: número de activos sobre cada barra
  const countLabels = {
    id: 'countLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = '700 14px Inter';
      ctx.fillStyle = cssVar('--ink');
      ctx.textAlign = 'center';
      meta.data.forEach((bar, i) => {
        const v = chart.data.datasets[0].data[i];
        if (v) ctx.fillText(v, bar.x, bar.y - 6);
      });
      ctx.restore();
    },
  };

  _chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderRadius: 5, maxBarThickness: 64 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: cssVar('--ink-dim'), font: { family: 'JetBrains Mono' } },
          grid: { color: cssVar('--chart-grid') },
          title: { display: true, text: 'N° de activos', color: cssVar('--ink-dim'), font: { size: 10, family: 'JetBrains Mono' } },
        },
        x: {
          ticks: { color: cssVar('--ink'), font: { family: 'Inter', size: 11 } },
          grid: { display: false },
        },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw} activos` } } },
    },
    plugins: [countLabels],
  });

  const total = evaluados(rows).length || 1;
  const sinEval = rows.filter(a => a.hi == null).length;
  const legend = $('#donutLegend');
  if (legend) {
    legend.innerHTML = BUCKETS.map((b, i) =>
      `<span><i style="background:${cssVar(b.cssVar)}"></i>${b.cls} ${b.label} · ${counts[i]} (${fmtPct(counts[i] / total * 100)}%)</span>`
    ).join('')
      + (sinEval ? `<span><i style="background:${BUCKET_NULL.color}"></i>Sin evaluación · ${sinEval}</span>` : '');
  }
}
