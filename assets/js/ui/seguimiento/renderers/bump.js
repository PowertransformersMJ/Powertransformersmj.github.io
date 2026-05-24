// ══════════════════════════════════════════════════════════════
// Renderer · Bump chart (evolución de ranking día a día) + tabla
// ══════════════════════════════════════════════════════════════

import { BUMP_COLORS } from '../../../domain/scada_config.js';
import {
  buildDailyRanking, calcularHistorial, deltaPosicion, rankSparkline,
} from '../../../domain/scada_ranking.js';
import { store } from '../state.js';

const $ = (sel) => document.querySelector(sel);

export function renderRankEvolution() {
  if (typeof Plotly === 'undefined') return;
  const { allEvents, filtros, topTab, rankTopN } = store.state;
  const { dates, ranking, metaBy } = buildDailyRanking(allEvents, {
    zona: filtros.zona,
    magFilter: topTab,
  });
  const empty   = $('#rank-evo-empty');
  const content = $('#rank-evo-content');
  const pill    = $('#rank-evo-pill');

  if (dates.length < 2) {
    if (empty)   empty.style.display = 'block';
    if (content) content.style.display = 'none';
    if (pill)    pill.textContent = dates.length === 1 ? '1 día cargado · falta histórico' : 'sin datos';
    return;
  }
  if (empty)   empty.style.display = 'none';
  if (content) content.style.display = 'block';
  if (pill)    pill.textContent = `${dates.length} días · ${dates[0]} → ${dates[dates.length - 1]}`;

  // Conjunto de sids que aparecen dentro del Top N en algún día
  const sidSet = new Set();
  for (const d of dates) {
    for (const r of ranking[d]) {
      if (r.rank <= rankTopN) sidSet.add(r.sid);
    }
  }
  const sids = [...sidSet];

  // ── Bump chart (líneas con marcadores) ──────────────────────
  const traces = sids.map((sid, i) => {
    const x = [], y = [], txt = [];
    for (const d of dates) {
      const r = ranking[d].find(z => z.sid === sid);
      x.push(d.slice(5));
      y.push(r ? r.rank : null);
      txt.push(r
        ? `${metaBy.get(sid).name}<br>${d}<br>Pos #${r.rank} · ${r.count} violaciones`
        : `${metaBy.get(sid).name}<br>${d}<br>fuera del registro`);
    }
    return {
      x, y, text: txt, hoverinfo: 'text',
      mode: 'lines+markers', type: 'scatter',
      name: metaBy.get(sid).name,
      line:   { width: 2.5, color: BUMP_COLORS[i % BUMP_COLORS.length] },
      marker: { size: 8,   color: BUMP_COLORS[i % BUMP_COLORS.length] },
      connectgaps: false,
    };
  });
  Plotly.newPlot('bump-chart', traces, {
    margin: { t: 10, r: 170, b: 40, l: 40 },
    xaxis: { title: { text: 'Día', font: { size: 10 } }, tickfont: { size: 10 }, type: 'category' },
    yaxis: { title: { text: 'Posición en el ranking', font: { size: 10 } }, autorange: 'reversed', dtick: 1, tickfont: { size: 10 }, gridcolor: '#F1F5F9' },
    showlegend: true, legend: { font: { size: 9 }, x: 1.01, y: 1, xanchor: 'left' },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: '-apple-system,sans-serif', color: '#334155' },
    hovermode: 'closest',
  }, { displayModeBar: false, responsive: true });

  // ── Tabla de deltas ─────────────────────────────────────────
  const lastD = dates[dates.length - 1];
  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;

  const hist = calcularHistorial({ dates, ranking, metaBy });

  const rows = ranking[lastD].filter(r => r.rank <= rankTopN).map(r => {
    const { delta, cls } = deltaPosicion(r.rank, prevRank[r.sid]);
    const h = hist[r.sid];
    const rb = r.rank <= 3 ? `rank-badge r${r.rank}` : 'rank-badge';
    return `<tr>
      <td><span class="${rb}">${r.rank}</span></td>
      <td><span class="rank-delta ${cls}">${delta}</span></td>
      <td><strong>${r.name}</strong></td>
      <td><span class="zona-pill">${r.zona || '—'}</span></td>
      <td class="num">${r.count.toLocaleString()}</td>
      <td class="num">#${h.best}</td>
      <td class="num">#${h.worst}</td>
      <td style="font-family:monospace;font-size:13px;color:var(--purple)">${rankSparkline(h.series)}</td>
    </tr>`;
  }).join('');
  const tbody = document.querySelector('#rank-evo-table tbody');
  if (tbody) tbody.innerHTML = rows;
}
