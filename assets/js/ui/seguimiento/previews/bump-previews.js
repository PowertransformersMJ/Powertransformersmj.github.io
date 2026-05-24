// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Previews del bump chart
// ──────────────────────────────────────────────────────────────
// Renderiza 3 propuestas visuales del segmento "Evolución de
// posición en el ranking · día a día" sobre el mismo dataset
// (SEED de 1 día expandido sintéticamente a 20 días para que se
// aprecie la trayectoria). El director elige una y la aplica a
// `seguimiento-operativo.html`.
// ══════════════════════════════════════════════════════════════

import { cargarBaselineLocal } from '../../../data/seguimiento_scada.js';
import { BUMP_COLORS } from '../../../domain/scada_config.js';
import {
  buildDailyRanking, calcularHistorial, deltaPosicion, rankSparkline,
} from '../../../domain/scada_ranking.js';

const PLOTLY_CDN = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
let _plotlyPromise = null;
function loadPlotly() {
  if (typeof window.Plotly !== 'undefined') return Promise.resolve(window.Plotly);
  if (_plotlyPromise) return _plotlyPromise;
  _plotlyPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PLOTLY_CDN;
    s.async = true;
    s.onload  = () => window.Plotly ? resolve(window.Plotly) : reject(new Error('Plotly no cargó'));
    s.onerror = () => reject(new Error('CDN Plotly inalcanzable'));
    document.head.appendChild(s);
  });
  return _plotlyPromise;
}

// ── Sintetizador: expandir 1 día real → 20 días con perturbación ──
// Para los previews el director necesita ver MÚLTIPLES días. El SEED
// solo tiene 2026-05-18 (1 día). Generamos 20 días sintéticos
// determinísticos con seed numérico para que el director vea SIEMPRE
// el mismo dibujo (reproducible).
function pseudoRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 0x100000000;
    return s / 0x100000000;
  };
}

function expandirDataset(eventosReales) {
  const rng = pseudoRandom(20260518);
  const inicio = new Date('2026-05-01T00:00:00');
  const out = [];
  // Indexar eventos por sid + tomar conteo base
  const porSid = new Map();
  for (const e of eventosReales) {
    if (!e.viol) continue;
    if (!porSid.has(e.sid)) porSid.set(e.sid, []);
    porSid.get(e.sid).push(e);
  }
  // Generar 20 días: cada día perturbamos cuánto violación tuvo cada sid
  for (let d = 0; d < 20; d++) {
    const fecha = new Date(inicio.getTime() + d * 86400000);
    const dateStr = fecha.toISOString().slice(0, 10);
    for (const [sid, eventos] of porSid.entries()) {
      const base = eventos.length;
      // Factor 0.55..1.45 → variabilidad razonable
      const factor = 0.55 + rng() * 0.9;
      const target = Math.max(1, Math.round(base * factor));
      for (let i = 0; i < target; i++) {
        const src = eventos[Math.floor(rng() * eventos.length)];
        out.push({
          ...src,
          id: `${sid}_${d}_${i}`,
          date: dateStr,
          ts: `${dateStr}T${String(Math.floor(rng() * 24)).padStart(2, '0')}:00:00`,
        });
      }
    }
  }
  return out;
}

// ── Utilidades comunes ────────────────────────────────────────
const $ = (s) => document.querySelector(s);

function fmtFechaCorta(date) {
  // 2026-05-14 → "MIE 14" en mayo
  const d = new Date(date + 'T12:00:00');
  const wd = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'][d.getDay()];
  return `${wd} ${String(d.getDate()).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════
// VARIANTE A — "Card sólido enfocado"
// ══════════════════════════════════════════════════════════════
// · Fondo blanco opaco, sin glass
// · Paleta restringida Top 5 (rojo/azul/teal/ambar/violeta)
// · Líneas curvadas (spline) con sombra sutil
// · Labels de fecha humanizados (MIE 14)
// · Anotaciones inline al final de cada línea con el nombre
// · Tabla zebra + sparkline con gradiente verde→rojo
// ══════════════════════════════════════════════════════════════
function renderVariantA({ dates, ranking, metaBy }, topN = 5) {
  const PALETTE = ['#DC2626', '#2563EB', '#0D9488', '#F59E0B', '#7C3AED'];
  const sidSet = new Set();
  for (const d of dates)
    for (const r of ranking[d])
      if (r.rank <= topN) sidSet.add(r.sid);
  const sids = [...sidSet].slice(0, topN);

  const traces = sids.map((sid, i) => {
    const color = PALETTE[i % PALETTE.length];
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
      line: { width: 3, color, shape: 'spline', smoothing: 0.7 },
      marker: { size: 10, color, line: { width: 2, color: '#fff' } },
      name: metaBy.get(sid).name, connectgaps: true,
    };
  });

  // Anotación al final de cada línea con el nombre
  const annotations = sids.map((sid, i) => {
    const lastIdx = dates.length - 1;
    const lastRank = ranking[dates[lastIdx]].find(z => z.sid === sid);
    if (!lastRank) return null;
    return {
      x: fmtFechaCorta(dates[lastIdx]),
      y: lastRank.rank,
      text: '  ' + metaBy.get(sid).name.split(' ')[0],
      showarrow: false,
      xanchor: 'left',
      font: { size: 11, color: PALETTE[i % PALETTE.length], family: 'Inter' },
    };
  }).filter(Boolean);

  Plotly.newPlot('bump-a', traces, {
    margin: { t: 24, r: 130, b: 50, l: 60 },
    xaxis: {
      title: { text: 'Día', font: { size: 11, color: '#475569' } },
      tickfont: { size: 10, color: '#64748B' }, type: 'category',
      gridcolor: '#F1F5F9', linecolor: '#CBD5E1',
    },
    yaxis: {
      title: { text: 'Posición', font: { size: 11, color: '#475569' } },
      autorange: 'reversed', dtick: 1, tickfont: { size: 10, color: '#64748B' },
      gridcolor: '#F1F5F9', linecolor: '#CBD5E1',
    },
    showlegend: false,
    annotations,
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: 'Inter, -apple-system, sans-serif' },
    hovermode: 'closest',
  }, { displayModeBar: false, responsive: true });

  // Tabla zebra
  const lastD = dates[dates.length - 1];
  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;
  const hist = calcularHistorial({ dates, ranking, metaBy });
  const rowsRanking = ranking[lastD].filter(r => r.rank <= topN);

  document.querySelector('#tbl-a tbody').innerHTML = rowsRanking.map((r, i) => {
    const { delta, cls } = deltaPosicion(r.rank, prevRank[r.sid]);
    const h = hist[r.sid];
    const rb = r.rank <= 3 ? `rank-badge r${r.rank}` : 'rank-badge';
    const color = PALETTE[i % PALETTE.length];
    return `<tr>
      <td><span class="${rb}">${r.rank}</span></td>
      <td><span class="rank-delta ${cls}">${delta}</span></td>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle"></span><strong>${r.name}</strong></td>
      <td><span class="zona-pill">${r.zona || '—'}</span></td>
      <td class="num">${r.count.toLocaleString()}</td>
      <td class="num">#${h.best}</td>
      <td class="num">#${h.worst}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:-1px">${gradientSparkline(h.series)}</td>
    </tr>`;
  }).join('');
}

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
    // Color: norm 1 (mejor=#1) verde · norm 0 (peor) rojo
    const r1 = Math.round(220 + (-220 + 22) * norm);
    const g1 = Math.round(38  + (-38  + 163) * norm);
    const b1 = Math.round(38  + (-38  + 74)  * norm);
    return `<span style="color:rgb(${r1},${g1},${b1})">${block}</span>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// VARIANTE B — "Heatmap rank"
// ══════════════════════════════════════════════════════════════
// · Reemplaza el bump chart por un heatmap día×transformador
// · Filas = Top 10 transformadores · Columnas = días
// · Celda = posición (1 = rojo intenso = peor)
// · Mucho más legible para detectar "quién empeora cada día"
// ══════════════════════════════════════════════════════════════
function renderVariantB({ dates, ranking, metaBy }, topN = 10) {
  const sidSet = new Set();
  for (const d of dates)
    for (const r of ranking[d])
      if (r.rank <= topN) sidSet.add(r.sid);
  const sids = [...sidSet];

  // z = matriz [sid][día] = rank
  const z = sids.map(sid =>
    dates.map(d => {
      const r = ranking[d].find(x => x.sid === sid);
      return r ? r.rank : null;
    })
  );

  // Texto inline
  const text = z.map(row => row.map(v => v == null ? '' : '#' + v));

  Plotly.newPlot('bump-b', [{
    z, x: dates.map(fmtFechaCorta), y: sids.map(s => metaBy.get(s).name),
    type: 'heatmap',
    colorscale: [
      [0,   '#7F1D1D'],   // rank 1 (peor) = rojo oscuro
      [0.2, '#DC2626'],
      [0.4, '#F59E0B'],
      [0.6, '#FCD34D'],
      [0.8, '#86EFAC'],
      [1,   '#16A34A'],   // rank alto (mejor) = verde
    ],
    reversescale: false,
    zmin: 1, zmax: topN,
    text, texttemplate: '%{text}',
    textfont: { size: 10, color: '#fff', family: 'Inter' },
    hovertemplate: '<b>%{y}</b><br>%{x} · Posición %{z}<extra></extra>',
    colorbar: {
      title: { text: 'Pos.', font: { size: 10 } },
      tickfont: { size: 9 },
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

  // Tabla resumen
  const lastD = dates[dates.length - 1];
  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;
  const hist = calcularHistorial({ dates, ranking, metaBy });

  document.querySelector('#tbl-b tbody').innerHTML = ranking[lastD].filter(r => r.rank <= topN).map(r => {
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
      <td style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--purple)">${rankSparkline(h.series)}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// VARIANTE C — "Stepped lines + cards"
// ══════════════════════════════════════════════════════════════
// · Bump chart con líneas STEP (escalones) — más limpio
// · Top 5 destacado, resto en gris translúcido al fondo
// · A la derecha: cards verticales con los Top 5 detallados
//   (sparkline grande + delta visual + violaciones)
// ══════════════════════════════════════════════════════════════
function renderVariantC({ dates, ranking, metaBy }, topNHighlight = 5, topNAll = 15) {
  const PALETTE = ['#DC2626', '#2563EB', '#0D9488', '#F59E0B', '#7C3AED'];
  const sidsAll = new Set();
  for (const d of dates)
    for (const r of ranking[d])
      if (r.rank <= topNAll) sidsAll.add(r.sid);
  const sidsHighlight = [];
  for (const r of ranking[dates[dates.length - 1]]) {
    if (r.rank <= topNHighlight) sidsHighlight.push(r.sid);
  }
  const highlightSet = new Set(sidsHighlight);

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
      hoverinfo: 'skip',
      showlegend: false,
    };
  });

  const tracesHighlight = sidsHighlight.map((sid, i) => {
    const color = PALETTE[i % PALETTE.length];
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
      name: metaBy.get(sid).name,
      showlegend: false,
    };
  });

  Plotly.newPlot('bump-c', [...tracesGray, ...tracesHighlight], {
    margin: { t: 24, r: 30, b: 50, l: 60 },
    xaxis: {
      title: { text: 'Día', font: { size: 11, color: '#475569' } },
      tickfont: { size: 10, color: '#64748B' }, type: 'category',
      gridcolor: '#F1F5F9',
    },
    yaxis: {
      title: { text: 'Posición', font: { size: 11, color: '#475569' } },
      autorange: 'reversed', dtick: 1, tickfont: { size: 10, color: '#64748B' },
      gridcolor: '#F1F5F9',
    },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: 'Inter, -apple-system, sans-serif' },
    hovermode: 'closest',
  }, { displayModeBar: false, responsive: true });

  // Cards laterales (Top 5)
  const lastD = dates[dates.length - 1];
  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;
  const hist = calcularHistorial({ dates, ranking, metaBy });

  document.querySelector('#cards-c').innerHTML = sidsHighlight.map((sid, i) => {
    const color = PALETTE[i % PALETTE.length];
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

// ══════════════════════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════════════════════
async function boot() {
  try {
    await loadPlotly();
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend', '<p style="padding:20px;color:#DC2626">Error cargando Plotly. Revisa conexión a internet.</p>');
    return;
  }
  let seed;
  try {
    seed = await cargarBaselineLocal();
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend', '<p style="padding:20px;color:#DC2626">Error cargando baseline SCADA.</p>');
    return;
  }
  const eventos = expandirDataset(seed.events);
  const rankInfo = buildDailyRanking(eventos);

  renderVariantA(rankInfo);
  renderVariantB(rankInfo);
  renderVariantC(rankInfo);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
