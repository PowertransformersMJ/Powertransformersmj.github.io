// ══════════════════════════════════════════════════════════════
// Renderer · Bump chart (evolución de ranking día a día)
// ──────────────────────────────────────────────────────────────
// 3 variantes seleccionables vía store.bumpVariant ('A'|'B'|'C').
// Default 'A'. La tabla resumen se conserva en A y B; la
// variante C la oculta y muestra cards laterales individuales.
// ══════════════════════════════════════════════════════════════

import {
  buildDailyRanking, calcularHistorial, deltaPosicion, rankSparkline,
} from '../../../domain/scada_ranking.js';
import { store } from '../state.js';

const $ = (sel) => document.querySelector(sel);

// Paleta restringida (Top 5) común a las 3 variantes
const PALETTE_TOP5 = ['#DC2626', '#2563EB', '#0D9488', '#F59E0B', '#7C3AED'];

// Día (YYYY-MM-DD) → "MIE 14"
function fmtFechaCorta(date) {
  const d = new Date(date + 'T12:00:00');
  const wd = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'][d.getDay()];
  return `${wd} ${String(d.getDate()).padStart(2, '0')}`;
}

// Sparkline con colores graduados (verde=mejor → rojo=peor)
function gradientSparkline(series) {
  const blocks = '▁▂▃▄▅▆▇█';
  const valid = series.filter(x => x !== null);
  if (!valid.length) return '';
  const max = Math.max(...valid), min = Math.min(...valid);
  return series.map(r => {
    if (r === null) return '<span style="color:#CBD5E1"> </span>';
    const norm = max === min ? 0.5 : (max - r) / (max - min);
    const idx = Math.round(norm * (blocks.length - 1));
    const block = blocks[idx];
    const r1 = Math.round(220 + (-220 + 22) * norm);
    const g1 = Math.round(38  + (-38  + 163) * norm);
    const b1 = Math.round(38  + (-38  + 74)  * norm);
    return `<span style="color:rgb(${r1},${g1},${b1})">${block}</span>`;
  }).join('');
}

// Genera y renderiza la tabla de detalle común a las variantes A y B.
function renderTablaResumen({ dates, ranking, metaBy }, topN, sidsHighlight = null) {
  const tbody = document.querySelector('#rank-evo-table tbody');
  if (!tbody) return;
  if (dates.length < 2) { tbody.innerHTML = ''; return; }
  const lastD = dates[dates.length - 1];
  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;
  const hist = calcularHistorial({ dates, ranking, metaBy });
  const filas = ranking[lastD].filter(r => r.rank <= topN);
  tbody.innerHTML = filas.map((r) => {
    const { delta, cls } = deltaPosicion(r.rank, prevRank[r.sid]);
    const h = hist[r.sid];
    const rb = r.rank <= 3 ? `rank-badge r${r.rank}` : 'rank-badge';
    const idx = sidsHighlight ? sidsHighlight.indexOf(r.sid) : -1;
    const color = idx >= 0 ? PALETTE_TOP5[idx % PALETTE_TOP5.length] : null;
    const dot = color
      ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle"></span>`
      : '';
    return `<tr>
      <td><span class="${rb}">${r.rank}</span></td>
      <td><span class="rank-delta ${cls}">${delta}</span></td>
      <td>${dot}<strong>${r.name}</strong></td>
      <td><span class="zona-pill">${r.zona || '—'}</span></td>
      <td class="num">${r.count.toLocaleString()}</td>
      <td class="num">#${h.best}</td>
      <td class="num">#${h.worst}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:-1px">${gradientSparkline(h.series)}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// VARIANTE A — Spline + anotaciones inline (Top 5)
// ══════════════════════════════════════════════════════════════
function renderVariantA({ dates, ranking, metaBy }) {
  const lastD = dates[dates.length - 1];
  const sidsTop = ranking[lastD].filter(r => r.rank <= 5).map(r => r.sid);

  const traces = sidsTop.map((sid, i) => {
    const color = PALETTE_TOP5[i % PALETTE_TOP5.length];
    const x = [], y = [], txt = [];
    for (const d of dates) {
      const r = ranking[d].find(z => z.sid === sid);
      x.push(fmtFechaCorta(d));
      y.push(r ? r.rank : null);
      txt.push(r ? `${metaBy.get(sid).name}<br>${d}<br>Pos #${r.rank} · ${r.count} viol.` : null);
    }
    return {
      x, y, text: txt, hoverinfo: 'text',
      mode: 'lines+markers', type: 'scatter',
      line:   { width: 3, color, shape: 'spline', smoothing: 0.7 },
      marker: { size: 10, color, line: { width: 2, color: '#fff' } },
      name: metaBy.get(sid).name, connectgaps: true,
    };
  });

  const annotations = sidsTop.map((sid, i) => {
    const lastIdx = dates.length - 1;
    const lastRank = ranking[dates[lastIdx]].find(z => z.sid === sid);
    if (!lastRank) return null;
    return {
      x: fmtFechaCorta(dates[lastIdx]),
      y: lastRank.rank,
      text: '  ' + metaBy.get(sid).name.split(' ')[0],
      showarrow: false,
      xanchor: 'left',
      font: { size: 11, color: PALETTE_TOP5[i % PALETTE_TOP5.length], family: 'Inter' },
    };
  }).filter(Boolean);

  Plotly.newPlot('bump-chart', traces, {
    margin: { t: 24, r: 130, b: 50, l: 60 },
    xaxis: { title: { text: 'Día', font: { size: 11, color: '#475569' } },
      tickfont: { size: 10, color: '#64748B' }, type: 'category',
      gridcolor: '#F1F5F9', linecolor: '#CBD5E1' },
    yaxis: { title: { text: 'Posición', font: { size: 11, color: '#475569' } },
      autorange: 'reversed', dtick: 1, tickfont: { size: 10, color: '#64748B' },
      gridcolor: '#F1F5F9', linecolor: '#CBD5E1' },
    showlegend: false, annotations,
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: 'Inter, -apple-system, sans-serif' },
    hovermode: 'closest',
  }, { displayModeBar: false, responsive: true });

  renderTablaResumen({ dates, ranking, metaBy }, 5, sidsTop);
}

// ══════════════════════════════════════════════════════════════
// VARIANTE B — Heatmap rank día × transformador (Top 10)
// ══════════════════════════════════════════════════════════════
function renderVariantB({ dates, ranking, metaBy }) {
  const topN = 10;
  const sidSet = new Set();
  for (const d of dates) for (const r of ranking[d]) if (r.rank <= topN) sidSet.add(r.sid);
  const sids = [...sidSet];

  const z = sids.map(sid => dates.map(d => {
    const r = ranking[d].find(x => x.sid === sid);
    return r ? r.rank : null;
  }));
  const text = z.map(row => row.map(v => v == null ? '' : '#' + v));

  Plotly.newPlot('bump-chart', [{
    z, x: dates.map(fmtFechaCorta), y: sids.map(s => metaBy.get(s).name),
    type: 'heatmap',
    colorscale: [
      [0,   '#7F1D1D'], [0.2, '#DC2626'], [0.4, '#F59E0B'],
      [0.6, '#FCD34D'], [0.8, '#86EFAC'], [1,   '#16A34A'],
    ],
    zmin: 1, zmax: topN,
    text, texttemplate: '%{text}',
    textfont: { size: 10, color: '#fff', family: 'Inter' },
    hovertemplate: '<b>%{y}</b><br>%{x} · Posición %{z}<extra></extra>',
    colorbar: {
      title: { text: 'Pos.', font: { size: 10 } }, tickfont: { size: 9 },
      thickness: 14,
      tickvals: [1, Math.round(topN / 2), topN],
      ticktext: ['#1 peor', '#' + Math.round(topN / 2), '#' + topN + ' mejor'],
    },
  }], {
    margin: { t: 20, r: 90, b: 60, l: 220 },
    xaxis: { tickangle: -45, tickfont: { size: 9 }, side: 'top' },
    yaxis: { tickfont: { size: 11 }, autorange: 'reversed' },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: 'Inter, -apple-system, sans-serif' },
  }, { displayModeBar: false, responsive: true });

  renderTablaResumen({ dates, ranking, metaBy }, topN);
}

// ══════════════════════════════════════════════════════════════
// VARIANTE C — Step lines + cards laterales (Top 5 / Top 15)
// ══════════════════════════════════════════════════════════════
function renderVariantC({ dates, ranking, metaBy }) {
  const topNHighlight = 5;
  const topNAll = 15;
  const lastD = dates[dates.length - 1];
  const sidsHighlight = ranking[lastD].filter(r => r.rank <= topNHighlight).map(r => r.sid);
  const highlightSet = new Set(sidsHighlight);

  const sidsAll = new Set();
  for (const d of dates) for (const r of ranking[d]) if (r.rank <= topNAll) sidsAll.add(r.sid);

  const tracesGray = [...sidsAll].filter(s => !highlightSet.has(s)).map(sid => {
    const x = [], y = [];
    for (const d of dates) {
      const r = ranking[d].find(z => z.sid === sid);
      x.push(fmtFechaCorta(d));
      y.push(r ? r.rank : null);
    }
    return {
      x, y, type: 'scatter', mode: 'lines',
      line: { width: 1.5, color: 'rgba(148,163,184,.35)', shape: 'hv' },
      hoverinfo: 'skip', showlegend: false,
    };
  });

  const tracesHighlight = sidsHighlight.map((sid, i) => {
    const color = PALETTE_TOP5[i % PALETTE_TOP5.length];
    const x = [], y = [], txt = [];
    for (const d of dates) {
      const r = ranking[d].find(z => z.sid === sid);
      x.push(fmtFechaCorta(d));
      y.push(r ? r.rank : null);
      txt.push(r ? `${metaBy.get(sid).name}<br>${d}<br>Pos #${r.rank} · ${r.count}` : null);
    }
    return {
      x, y, text: txt, hoverinfo: 'text',
      type: 'scatter', mode: 'lines+markers',
      line: { width: 3, color, shape: 'hv' },
      marker: { size: 9, color, line: { width: 2, color: '#fff' } },
      name: metaBy.get(sid).name, showlegend: false,
    };
  });

  Plotly.newPlot('bump-chart', [...tracesGray, ...tracesHighlight], {
    margin: { t: 24, r: 30, b: 50, l: 60 },
    xaxis: { title: { text: 'Día', font: { size: 11, color: '#475569' } },
      tickfont: { size: 10, color: '#64748B' }, type: 'category', gridcolor: '#F1F5F9' },
    yaxis: { title: { text: 'Posición', font: { size: 11, color: '#475569' } },
      autorange: 'reversed', dtick: 1, tickfont: { size: 10, color: '#64748B' }, gridcolor: '#F1F5F9' },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: 'Inter, -apple-system, sans-serif' },
    hovermode: 'closest',
  }, { displayModeBar: false, responsive: true });

  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;
  const hist = calcularHistorial({ dates, ranking, metaBy });

  const host = $('#cards-c');
  if (host) {
    host.innerHTML = sidsHighlight.map((sid, i) => {
      const color = PALETTE_TOP5[i % PALETTE_TOP5.length];
      const r = ranking[lastD].find(z => z.sid === sid);
      if (!r) return '';
      const { delta, cls } = deltaPosicion(r.rank, prevRank[sid]);
      const h = hist[sid];
      return `<div class="rank-card" style="border-left-color:${color}">
        <div class="rank-card-head">
          <div class="rank-card-pos" style="color:${color}">#${r.rank}</div>
          <div class="rank-card-delta ${cls}">${delta}</div>
        </div>
        <div class="rank-card-name">${r.name}</div>
        <div class="rank-card-zona"><span class="zona-pill">${r.zona || '—'}</span></div>
        <div class="rank-card-spark" style="color:${color};font-family:'JetBrains Mono',monospace;font-size:18px;letter-spacing:-2px;line-height:1">${rankSparkline(h.series)}</div>
        <div class="rank-card-meta">
          <span><b>${r.count.toLocaleString()}</b> viol.</span>
          <span>mejor <b>#${h.best}</b></span>
          <span>peor <b>#${h.worst}</b></span>
        </div>
      </div>`;
    }).join('');
  }
}

// ══════════════════════════════════════════════════════════════
// Render despachador
// ══════════════════════════════════════════════════════════════
function aplicarLayoutSegunVariante(variant) {
  const host = $('#rank-evo-content');
  if (host) host.classList.toggle('layout-dual', variant === 'C');
  const tabla = $('#rank-evo-table');
  if (tabla) tabla.style.display = variant === 'C' ? 'none' : '';
  const cards = $('#cards-c');
  if (cards) cards.style.display = variant === 'C' ? '' : 'none';
}

export function renderRankEvolution() {
  if (typeof Plotly === 'undefined') return;
  const { allEvents, filtros, topTab, bumpVariant } = store.state;
  const rankInfo = buildDailyRanking(allEvents, {
    zona: filtros.zona,
    magFilter: topTab,
  });
  const empty   = $('#rank-evo-empty');
  const content = $('#rank-evo-content');
  const pill    = $('#rank-evo-pill');

  if (rankInfo.dates.length < 2) {
    if (empty)   empty.style.display = 'block';
    if (content) content.style.display = 'none';
    if (pill)    pill.textContent = rankInfo.dates.length === 1
      ? '1 día cargado · falta histórico'
      : 'sin datos';
    return;
  }
  if (empty)   empty.style.display = 'none';
  if (content) content.style.display = 'block';
  if (pill)    pill.textContent = `${rankInfo.dates.length} días · ${rankInfo.dates[0]} → ${rankInfo.dates[rankInfo.dates.length - 1]}`;

  aplicarLayoutSegunVariante(bumpVariant);

  document.querySelectorAll('#bump-variant-seg .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.variant === bumpVariant);
  });

  if (bumpVariant === 'B')      renderVariantB(rankInfo);
  else if (bumpVariant === 'C') renderVariantC(rankInfo);
  else                          renderVariantA(rankInfo);
}
