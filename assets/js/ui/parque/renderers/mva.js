// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Renderer · Matriz HI×Criticidad + MVA
// ──────────────────────────────────────────────────────────────
// Dos renderers (matriz semáforo + barras MVA por estado de
// salud) que viven en el mismo dominio funcional.
// ══════════════════════════════════════════════════════════════

import { $, cssVar } from '../_helpers.js';
import { BUCKETS } from '../../../domain/parque_salud_config.js';
import { critIndex, fmtPct } from '../../../domain/parque_salud_calc.js';

// ── Matriz Criticidad × Salud ────────────────────────────────
function colorCelda(hi, cons) {
  const score = hi + cons; // 1..9
  if (hi >= 4 && cons >= 3) return cssVar('--h5');
  if (score >= 7) return cssVar('--h5');
  if (score >= 5) return cssVar('--h4');
  if (score >= 4) return cssVar('--h3');
  return cssVar('--h1');
}

export function renderMatrix(rows) {
  const host = $('#matrix');
  if (!host) return;

  const cells = {};
  for (let s = 1; s <= 5; s++) for (let c = 0; c < 5; c++) cells[s + '-' + c] = 0;
  rows.forEach(a => {
    if (a.bucket.cls >= 1 && a.bucket.cls <= 5) {
      cells[a.bucket.cls + '-' + critIndex(a.usuarios_aguas_abajo)]++;
    }
  });

  const consLabels = ['Mín', 'Menor', 'Mod', 'Mayor', 'Máx'];
  let html = '<table class="matrix"><tr><th></th>';
  consLabels.forEach(l => html += `<th>${l}</th>`);
  html += '</tr>';
  for (let hi = 5; hi >= 1; hi--) {
    html += `<tr><th>${hi}</th>`;
    for (let c = 0; c < 5; c++) {
      const v = cells[hi + '-' + c];
      html += `<td class="${v ? '' : 'z'}" style="background:${v ? colorCelda(hi, c + 1) : cssVar('--bg-2')}" title="HI ${hi} · ${consLabels[c]}: ${v} activos">${v || '·'}</td>`;
    }
    html += '</tr>';
  }
  html += '<tr><th></th>';
  consLabels.forEach(l => html += `<th>${l}</th>`);
  html += '</tr></table><div style="text-align:center;font-family:var(--mono);font-size:10px;color:var(--ink-dim);margin-top:4px">CONSECUENCIA (usuarios aguas abajo)</div>';
  host.innerHTML = html;
}

// ── MVA por estado de salud ──────────────────────────────────
let _mvaChart = null;

function fmtM(x) {
  return x >= 1000 ? (x / 1000).toFixed(2) + 'k' : Math.round(x * 10) / 10;
}

export function renderMVA(rows) {
  const conMva = rows.filter(a => a.mva != null);
  const porEstado = [1, 2, 3, 4, 5].map(c =>
    conMva.filter(a => a.bucket.cls === c).reduce((s, a) => s + a.mva, 0)
  );
  const totalEval = porEstado.reduce((s, v) => s + v, 0);
  const riesgo = porEstado[3] + porEstado[4];
  const critico = porEstado[4];

  const stats = [
    { l: 'MVA evaluados', v: fmtM(totalEval), s: conMva.length + ' activos con potencia', cls: '' },
    { l: 'MVA en riesgo', v: fmtM(riesgo),    s: 'Pobre + Muy Pobre · ' + (totalEval ? fmtPct(riesgo / totalEval * 100) : '0') + '%', cls: 'risk' },
    { l: 'MVA crítico',   v: fmtM(critico),   s: 'Muy Pobre (cond. 5)', cls: 'crit' },
    { l: 'MVA Pobre',     v: fmtM(porEstado[3]), s: 'condición 4', cls: 'risk' },
  ];
  const host = $('#mvaStats');
  if (host) {
    host.innerHTML = stats.map(x => `<div class="mva-stat ${x.cls}"><div class="l">${x.l}</div><div class="v">${x.v}<small> MVA</small></div><div class="s">${x.s}</div></div>`).join('');
  }

  const canvas = $('#chMVA');
  if (!canvas || typeof Chart === 'undefined') return;
  const colors = BUCKETS.map(b => cssVar(b.cssVar));
  const labels = BUCKETS.map(b => b.cls + ' ' + b.label);

  if (_mvaChart) _mvaChart.destroy();

  const mvaLabels = {
    id: 'mvaLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = '700 12px Inter';
      ctx.fillStyle = cssVar('--ink');
      ctx.textAlign = 'center';
      meta.data.forEach((bar, i) => {
        const v = chart.data.datasets[0].data[i];
        if (v) ctx.fillText(Math.round(v), bar.x, bar.y - 6);
      });
      ctx.restore();
    },
  };

  _mvaChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: porEstado.map(v => Math.round(v * 10) / 10), backgroundColor: colors, borderRadius: 5, maxBarThickness: 64 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 16 } },
      scales: {
        y: { beginAtZero: true, ticks: { color: cssVar('--ink-dim'), font: { family: 'JetBrains Mono' } }, grid: { color: cssVar('--chart-grid') }, title: { display: true, text: 'MVA instalados', color: cssVar('--ink-dim'), font: { size: 10, family: 'JetBrains Mono' } } },
        x: { ticks: { color: cssVar('--ink'), font: { family: 'Inter', size: 11 } }, grid: { display: false } },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw} MVA` } } },
    },
    plugins: [mvaLabels],
  });
}
