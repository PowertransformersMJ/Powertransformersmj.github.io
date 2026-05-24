// ══════════════════════════════════════════════════════════════
// Renderer · Bump chart (evolución de ranking día a día)
// ──────────────────────────────────────────────────────────────
// 3 variantes seleccionables vía store.bumpVariant ('A'|'B'|'C').
// Cantidad de equipos vía store.rankTopN (5 | 10 | 15).
// Selección de equipo individual vía store.selectedSid; al
// seleccionar un sid se atenúa el resto y se abre un panel
// detalle con la trayectoria día por día.
// ══════════════════════════════════════════════════════════════

import { BUMP_COLORS } from '../../../domain/scada_config.js';
import {
  buildDailyRanking, deltaPosicion,
} from '../../../domain/scada_ranking.js';
import { store } from '../state.js';

// ── historialClamped(rankInfo, topN) ─────────────────────────
// Como `calcularHistorial` del dominio, pero descarta los días
// en que el equipo cayó FUERA del Top N. Así los "mejor/peor"
// y la sparkline quedan acotados al universo visible (sin ruido
// del tipo #150 que es "fuera del top en algún día").
//
// SEMÁNTICA OPERATIVA (importante):
//   En SCADA, rank=1 es el equipo con MÁS violaciones (peor
//   estado operativo). rank=N es el con menos (mejor). Por
//   eso "mejor histórico" = max(ranks) y "peor histórico" =
//   min(ranks). Las columnas y stats se renombran abajo
//   aplicando esa inversión.
function historialClamped(rankInfo, topN) {
  const { dates, ranking, metaBy } = rankInfo;
  const hist = {};
  for (const sid of metaBy.keys()) {
    const series = dates.map(d => {
      const r = ranking[d].find(z => z.sid === sid);
      return r && r.rank <= topN ? r.rank : null;
    });
    const valid = series.filter(x => x !== null);
    if (valid.length) {
      hist[sid] = {
        // Notación matemática (no operativa)
        rankMin: Math.min(...valid),  // = PEOR estado operativo (más viol.)
        rankMax: Math.max(...valid),  // = MEJOR estado operativo (menos viol.)
        series,
      };
    }
  }
  return hist;
}

const $ = (sel) => document.querySelector(sel);

const PALETTE_TOP5 = ['#DC2626', '#2563EB', '#0D9488', '#F59E0B', '#7C3AED'];

// Paleta según N (5 → 5 colores; 10/15 → BUMP_COLORS rotado)
function paletteFor(n) {
  return n <= 5 ? PALETTE_TOP5 : BUMP_COLORS;
}

// Día (YYYY-MM-DD) → "MIE 14"
function fmtFechaCorta(date) {
  const d = new Date(date + 'T12:00:00');
  const wd = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'][d.getDay()];
  return `${wd} ${String(d.getDate()).padStart(2, '0')}`;
}

// Sparkline coloreado.
// Convención SCADA: rank=1 = MÁS violaciones = peor estado operativo.
// El bloque ALTO representa rank=1 (peor) en color ROJO; el bloque
// BAJO representa rank=N (mejor estado operativo) en VERDE.
function gradientSparkline(series) {
  const blocks = '▁▂▃▄▅▆▇█';
  const valid = series.filter(x => x !== null);
  if (!valid.length) return '';
  const max = Math.max(...valid), min = Math.min(...valid);
  return series.map(r => {
    if (r === null) return '<span style="color:#CBD5E1"> </span>';
    // norm=1 cuando rank=min (rank=1 = peor estado). Bloque alto + rojo.
    // norm=0 cuando rank=max (mejor estado).                Bloque bajo + verde.
    const norm = max === min ? 0.5 : (max - r) / (max - min);
    const idx = Math.round(norm * (blocks.length - 1));
    const block = blocks[idx];
    // Color: norm=1 → rojo (220,38,38); norm=0 → verde (22,163,74)
    const r1 = Math.round(22  + (220 - 22)  * norm);
    const g1 = Math.round(163 + (38  - 163) * norm);
    const b1 = Math.round(74  + (38  - 74)  * norm);
    return `<span style="color:rgb(${r1},${g1},${b1})">${block}</span>`;
  }).join('');
}

// Resuelve nombre del sid (busca en ranking cualquier día)
function nombreDeSid(rankInfo, sid) {
  return rankInfo.metaBy.get(sid)?.name || sid;
}

// ── Tabla resumen común a las 3 variantes (A y B la usan,
//    C la oculta y muestra cards laterales). ─────────────────
function renderTablaResumen(rankInfo, sidsTop, paleta) {
  const { dates, ranking } = rankInfo;
  const tbody = document.querySelector('#rank-evo-table tbody');
  if (!tbody) return;
  if (dates.length < 2) { tbody.innerHTML = ''; return; }
  const lastD = dates[dates.length - 1];
  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;
  const hist = historialClamped(rankInfo, store.state.rankTopN);
  const filas = ranking[lastD].filter(r => sidsTop.includes(r.sid));
  const { selectedSid } = store.state;
  tbody.innerHTML = filas.map((r) => {
    const { delta, cls } = deltaPosicion(r.rank, prevRank[r.sid]);
    const h = hist[r.sid] || { rankMin: r.rank, rankMax: r.rank, series: [] };
    const rb = r.rank <= 3 ? `rank-badge r${r.rank}` : 'rank-badge';
    const idx = sidsTop.indexOf(r.sid);
    const color = paleta[idx % paleta.length];
    const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle"></span>`;
    const isSelected = selectedSid === r.sid;
    // SEMÁNTICA OPERATIVA:
    //   "Mejor" = posición más ALTA históricamente = menos violaciones = rankMax.
    //   "Peor"  = posición más BAJA históricamente = más violaciones = rankMin.
    return `<tr data-sid="${r.sid}" class="rank-row${isSelected ? ' is-selected' : ''}" style="cursor:pointer">
      <td><span class="${rb}">${r.rank}</span></td>
      <td><span class="rank-delta ${cls}">${delta}</span></td>
      <td>${dot}<strong>${r.name}</strong></td>
      <td><span class="zona-pill">${r.zona || '—'}</span></td>
      <td class="num">${r.count.toLocaleString()}</td>
      <td class="num">#${h.rankMax}</td>
      <td class="num">#${h.rankMin}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:14px;letter-spacing:-1px">${gradientSparkline(h.series)}</td>
    </tr>`;
  }).join('');
  bindRowClicks();
}

// Click en filas → setSelectedSid
let _rowsBound = false;
function bindRowClicks() {
  if (_rowsBound) return;
  _rowsBound = true;
  const tbody = document.querySelector('#rank-evo-table tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-sid]');
      if (!tr) return;
      const sid = tr.getAttribute('data-sid');
      // Toggle: clic en el mismo equipo lo deselecciona
      store.setSelectedSid(store.state.selectedSid === sid ? null : sid);
    });
  }
}

// Click en una línea/celda del chart → setSelectedSid (variantes A y C)
function bindPlotlyClick(sidsTop) {
  const div = document.getElementById('bump-chart');
  if (!div || !div.on) return;
  div.removeAllListeners && div.removeAllListeners('plotly_click');
  div.on('plotly_click', (data) => {
    const pt = data.points[0];
    // En variantes A y C las traces highlight quedan al final;
    // resolvemos por nombre que es siempre el name del trace.
    const name = pt.data.name;
    const found = sidsTop.find(sid => nombreDeSid({ metaBy: store.state._bumpMeta || new Map() }, sid) === name);
    if (found) {
      store.setSelectedSid(store.state.selectedSid === found ? null : found);
    } else if (pt.data._sid) {
      const sid = pt.data._sid;
      store.setSelectedSid(store.state.selectedSid === sid ? null : sid);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// VARIANTE A — Spline + anotaciones inline (Top N)
// ══════════════════════════════════════════════════════════════
function renderVariantA(rankInfo) {
  const { dates, ranking, metaBy } = rankInfo;
  const { rankTopN, selectedSid } = store.state;
  const lastD = dates[dates.length - 1];
  const sidsTop = ranking[lastD].filter(r => r.rank <= rankTopN).map(r => r.sid);
  const paleta = paletteFor(rankTopN);

  const traces = sidsTop.map((sid, i) => {
    const color = paleta[i % paleta.length];
    const isSelected = selectedSid === sid;
    const isDimmed = selectedSid && !isSelected;
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
      line:   { width: isSelected ? 4 : 3, color: isDimmed ? 'rgba(148,163,184,.35)' : color, shape: 'spline', smoothing: 0.7 },
      marker: { size: isSelected ? 12 : 10, color: isDimmed ? 'rgba(148,163,184,.5)' : color, line: { width: 2, color: '#fff' } },
      name: metaBy.get(sid).name,
      _sid: sid,
      connectgaps: true,
    };
  });

  // Anotación al final solo si NO hay selección, o solo del seleccionado
  const annotations = sidsTop.map((sid, i) => {
    if (selectedSid && selectedSid !== sid) return null;
    const lastRank = ranking[dates[dates.length - 1]].find(z => z.sid === sid);
    if (!lastRank) return null;
    return {
      x: fmtFechaCorta(dates[dates.length - 1]),
      y: lastRank.rank,
      text: '  ' + metaBy.get(sid).name.split(' ')[0],
      showarrow: false,
      xanchor: 'left',
      font: { size: 11, color: paleta[i % paleta.length], family: 'Inter' },
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

  bindPlotlyClick(sidsTop);
  renderTablaResumen(rankInfo, sidsTop, paleta);
}

// ══════════════════════════════════════════════════════════════
// VARIANTE B — Heatmap rank día × transformador (Top N)
// ══════════════════════════════════════════════════════════════
function renderVariantB(rankInfo) {
  const { dates, ranking, metaBy } = rankInfo;
  const { rankTopN, selectedSid } = store.state;
  const sidSet = new Set();
  for (const d of dates) for (const r of ranking[d]) if (r.rank <= rankTopN) sidSet.add(r.sid);
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
    zmin: 1, zmax: rankTopN,
    text, texttemplate: '%{text}',
    textfont: { size: 10, color: '#fff', family: 'Inter' },
    hovertemplate: '<b>%{y}</b><br>%{x} · Posición %{z}<extra></extra>',
    colorbar: {
      title: { text: 'Pos.', font: { size: 10 } }, tickfont: { size: 9 },
      thickness: 14,
      tickvals: [1, Math.round(rankTopN / 2), rankTopN],
      ticktext: ['#1 peor', '#' + Math.round(rankTopN / 2), '#' + rankTopN + ' mejor'],
    },
    opacity: selectedSid ? 0.5 : 1,
  }], {
    margin: { t: 20, r: 90, b: 60, l: 220 },
    xaxis: { tickangle: -45, tickfont: { size: 9 }, side: 'top' },
    yaxis: { tickfont: { size: 11 }, autorange: 'reversed' },
    plot_bgcolor: '#fff', paper_bgcolor: '#fff',
    font: { family: 'Inter, -apple-system, sans-serif' },
    // Highlight de la fila seleccionada con un rectángulo
    shapes: selectedSid ? (() => {
      const idx = sids.indexOf(selectedSid);
      if (idx < 0) return [];
      return [{
        type: 'rect', xref: 'paper', yref: 'y',
        x0: 0, x1: 1, y0: idx - 0.5, y1: idx + 0.5,
        line: { color: '#0d1f38', width: 3 },
        fillcolor: 'rgba(0,0,0,0)',
      }];
    })() : [],
  }, { displayModeBar: false, responsive: true });

  // Click en una celda → selecciona el sid de esa fila
  const div = document.getElementById('bump-chart');
  if (div && div.on) {
    div.removeAllListeners && div.removeAllListeners('plotly_click');
    div.on('plotly_click', (data) => {
      const pt = data.points[0];
      // pt.y es el nombre del transformador (eje Y)
      const sid = sids.find(s => metaBy.get(s).name === pt.y);
      if (sid) store.setSelectedSid(store.state.selectedSid === sid ? null : sid);
    });
  }

  // sidsTop para la tabla en B = todos los del Top N
  const lastD = dates[dates.length - 1];
  const sidsTopOrdenados = ranking[lastD].filter(r => r.rank <= rankTopN).map(r => r.sid);
  renderTablaResumen(rankInfo, sidsTopOrdenados, paletteFor(rankTopN));
}

// ══════════════════════════════════════════════════════════════
// VARIANTE C — Step lines + cards laterales (Top N · highlight 5)
// ══════════════════════════════════════════════════════════════
function renderVariantC(rankInfo) {
  const { dates, ranking, metaBy } = rankInfo;
  const { rankTopN, selectedSid } = store.state;
  const lastD = dates[dates.length - 1];
  const topNHighlight = Math.min(5, rankTopN);
  const sidsHighlight = ranking[lastD].filter(r => r.rank <= topNHighlight).map(r => r.sid);
  const highlightSet = new Set(sidsHighlight);
  const paleta = paletteFor(rankTopN);

  const sidsAll = new Set();
  for (const d of dates) for (const r of ranking[d]) if (r.rank <= rankTopN) sidsAll.add(r.sid);

  const tracesGray = [...sidsAll].filter(s => !highlightSet.has(s)).map((sid) => {
    const x = [], y = [];
    for (const d of dates) {
      const r = ranking[d].find(z => z.sid === sid);
      x.push(fmtFechaCorta(d));
      y.push(r ? r.rank : null);
    }
    const isSelected = selectedSid === sid;
    return {
      x, y, type: 'scatter', mode: 'lines+markers',
      line: { width: isSelected ? 3 : 1.5, color: isSelected ? '#0d1f38' : 'rgba(148,163,184,.35)', shape: 'hv' },
      marker: { size: isSelected ? 8 : 4, color: isSelected ? '#0d1f38' : 'rgba(148,163,184,.35)' },
      hoverinfo: isSelected ? 'text' : 'skip',
      text: isSelected ? dates.map(d => {
        const r = ranking[d].find(z => z.sid === sid);
        return r ? `${metaBy.get(sid).name}<br>${d}<br>Pos #${r.rank} · ${r.count}` : null;
      }) : null,
      name: metaBy.get(sid).name,
      _sid: sid,
      showlegend: false,
    };
  });

  const tracesHighlight = sidsHighlight.map((sid, i) => {
    const color = paleta[i % paleta.length];
    const x = [], y = [], txt = [];
    for (const d of dates) {
      const r = ranking[d].find(z => z.sid === sid);
      x.push(fmtFechaCorta(d));
      y.push(r ? r.rank : null);
      txt.push(r ? `${metaBy.get(sid).name}<br>${d}<br>Pos #${r.rank} · ${r.count}` : null);
    }
    const isSelected = selectedSid === sid;
    const isDimmed = selectedSid && !isSelected;
    return {
      x, y, text: txt, hoverinfo: 'text',
      type: 'scatter', mode: 'lines+markers',
      line: { width: isSelected ? 4 : 3, color: isDimmed ? 'rgba(148,163,184,.35)' : color, shape: 'hv' },
      marker: { size: isSelected ? 11 : 9, color: isDimmed ? 'rgba(148,163,184,.5)' : color, line: { width: 2, color: '#fff' } },
      name: metaBy.get(sid).name,
      _sid: sid,
      showlegend: false,
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

  // Click handler en C: las traces tienen _sid, lo usamos
  const div = document.getElementById('bump-chart');
  if (div && div.on) {
    div.removeAllListeners && div.removeAllListeners('plotly_click');
    div.on('plotly_click', (data) => {
      const pt = data.points[0];
      const sid = pt.data._sid;
      if (sid) store.setSelectedSid(store.state.selectedSid === sid ? null : sid);
    });
  }

  // Cards laterales (Top 5 destacado)
  const prevD = dates[dates.length - 2];
  const prevRank = {};
  for (const r of ranking[prevD]) prevRank[r.sid] = r.rank;
  const hist = historialClamped(rankInfo, store.state.rankTopN);

  const host = $('#cards-c');
  if (host) {
    host.innerHTML = sidsHighlight.map((sid, i) => {
      const color = paleta[i % paleta.length];
      const r = ranking[lastD].find(z => z.sid === sid);
      if (!r) return '';
      const { delta, cls } = deltaPosicion(r.rank, prevRank[sid]);
      const h = hist[sid] || { rankMin: r.rank, rankMax: r.rank, series: [] };
      const isSelected = selectedSid === sid;
      // mejor = rankMax (posición más alta = menos violaciones)
      // peor  = rankMin (posición más baja = más violaciones)
      return `<div class="rank-card${isSelected ? ' is-selected' : ''}" data-sid="${sid}" style="border-left-color:${color};cursor:pointer">
        <div class="rank-card-head">
          <div class="rank-card-pos" style="color:${color}">#${r.rank}</div>
          <div class="rank-card-delta ${cls}">${delta}</div>
        </div>
        <div class="rank-card-name">${r.name}</div>
        <div class="rank-card-zona"><span class="zona-pill">${r.zona || '—'}</span></div>
        <div class="rank-card-spark" style="color:${color};font-family:'JetBrains Mono',monospace;font-size:18px;letter-spacing:-2px;line-height:1">${gradientSparkline(h.series)}</div>
        <div class="rank-card-meta">
          <span><b>${r.count.toLocaleString()}</b> viol.</span>
          <span>mejor <b>#${h.rankMax}</b></span>
          <span>peor <b>#${h.rankMin}</b></span>
        </div>
      </div>`;
    }).join('');
    bindCardClicks();
  }
}

let _cardsBound = false;
function bindCardClicks() {
  if (_cardsBound) return;
  _cardsBound = true;
  const host = $('#cards-c');
  if (host) {
    host.addEventListener('click', (e) => {
      const card = e.target.closest('.rank-card[data-sid]');
      if (!card) return;
      const sid = card.getAttribute('data-sid');
      store.setSelectedSid(store.state.selectedSid === sid ? null : sid);
    });
  }
}

// ══════════════════════════════════════════════════════════════
// Panel detalle del equipo seleccionado
// ══════════════════════════════════════════════════════════════
function renderDetalle(rankInfo) {
  const panel = $('#rank-detail');
  if (!panel) return;
  const { selectedSid, rankTopN } = store.state;
  if (!selectedSid) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const { dates, ranking, metaBy } = rankInfo;
  const meta = metaBy.get(selectedSid);
  if (!meta) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  // Trayectoria día por día — solo se cuentan los días en que el
  // equipo estuvo dentro del Top N visible. Los demás aparecen
  // como "fuera" para no contaminar el rango.
  const trayectoria = dates.map(d => {
    const r = ranking[d].find(z => z.sid === selectedSid);
    const inTop = r && r.rank <= rankTopN;
    return {
      date: d,
      rank: inTop ? r.rank : null,
      count: r ? r.count : null,
      outside: r && !inTop ? r.rank : null,  // posición real cuando está fuera del Top N
    };
  });
  const validas = trayectoria.filter(t => t.rank !== null);
  if (!validas.length) {
    panel.innerHTML = `<div style="text-align:center;padding:20px;color:var(--slate-400)">Sin presencia en el Top ${rankTopN} para este equipo.</div>`;
    const closeBtn0 = `<button type="button" class="btn btn-ghost" id="rank-detail-close">✕ Quitar selección</button>`;
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:20px"><span style="color:var(--slate-500)">${meta.name} sin presencia en el Top ${rankTopN}.</span>${closeBtn0}</div>`;
    const c0 = $('#rank-detail-close');
    if (c0) c0.addEventListener('click', () => store.setSelectedSid(null));
    return;
  }

  // SEMÁNTICA OPERATIVA invertida:
  //   rank=1 = más violaciones = peor estado operativo.
  //   "Mejor"  = posición más ALTA históricamente (menos viol.).
  //   "Peor"   = posición más BAJA históricamente (más viol.).
  const peor   = Math.min(...validas.map(t => t.rank));   // rank más bajo
  const mejor  = Math.max(...validas.map(t => t.rank));   // rank más alto
  const avg    = (validas.reduce((s, t) => s + t.rank, 0) / validas.length).toFixed(1);
  const totalViol = validas.reduce((s, t) => s + (t.count || 0), 0);
  const firstRank = validas[0].rank;
  const lastRank  = validas[validas.length - 1].rank;
  // tendencia operativa:
  //   lastRank > firstRank  → bajó al fondo del ranking → menos violaciones → MEJORÓ
  //   lastRank < firstRank  → subió al top del ranking  → más violaciones   → EMPEORÓ
  const tendencia = lastRank - firstRank;

  // Recorrido por día con deltas
  const filas = [];
  let prev = null;
  for (const t of trayectoria) {
    let deltaHTML = '', posHTML;
    if (t.rank === null) {
      deltaHTML = '<span class="rank-delta same" style="opacity:.5">fuera</span>';
      posHTML = t.outside
        ? `<span style="color:var(--slate-400);font-size:11px">fuera del Top ${rankTopN} (#${t.outside})</span>`
        : '<span style="color:var(--slate-400)">—</span>';
      prev = null;  // reinicia para el siguiente delta
    } else {
      posHTML = `<span class="rank-badge ${t.rank<=3?'r'+t.rank:''}">${t.rank}</span>`;
      if (prev === null) {
        deltaHTML = '<span class="rank-delta new">inicio</span>';
      } else {
        const dRank = prev - t.rank;
        // dRank > 0 → rank bajó = subió al top = MÁS violaciones = empeoró
        // dRank < 0 → rank subió = bajó del top = MENOS violaciones = mejoró
        if (dRank > 0)      deltaHTML = `<span class="rank-delta up">▲ ${dRank} (peor)</span>`;
        else if (dRank < 0) deltaHTML = `<span class="rank-delta down">▼ ${Math.abs(dRank)} (mejor)</span>`;
        else                deltaHTML = '<span class="rank-delta same">=</span>';
      }
      prev = t.rank;
    }
    filas.push(`<tr>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--slate-600)">${t.date}</td>
      <td>${posHTML}</td>
      <td>${deltaHTML}</td>
      <td class="num">${t.count != null ? t.count.toLocaleString() : '—'}</td>
    </tr>`);
  }

  const tendenciaTxt = tendencia > 0
    ? `<span style="color:var(--green-700);font-weight:700">▼ Mejoró ${tendencia} pos.</span> (bajó del top de violaciones)`
    : tendencia < 0
    ? `<span style="color:var(--red);font-weight:700">▲ Empeoró ${Math.abs(tendencia)} pos.</span> (subió en el top de violaciones)`
    : `<span style="color:var(--slate-500);font-weight:700">= Sin cambio neto</span>`;

  panel.innerHTML = `
    <div class="rank-detail-head">
      <div>
        <div class="rank-detail-tag">Trayectoria del equipo · acotada al Top ${rankTopN}</div>
        <h4>${meta.name}</h4>
        <div class="rank-detail-meta">
          <span class="zona-pill">${meta.zona || '—'}</span>
          <span>${tendenciaTxt}</span>
        </div>
      </div>
      <button type="button" class="btn btn-ghost" id="rank-detail-close" title="Cerrar detalle">✕ Quitar selección</button>
    </div>

    <div class="rank-detail-stats">
      <div class="rank-detail-stat" style="border-left-color:var(--green)">
        <div class="lbl">Mejor estado (menos viol.)</div>
        <div class="val">#${mejor}</div>
      </div>
      <div class="rank-detail-stat" style="border-left-color:var(--red)">
        <div class="lbl">Peor estado (más viol.)</div>
        <div class="val">#${peor}</div>
      </div>
      <div class="rank-detail-stat" style="border-left-color:var(--blue)">
        <div class="lbl">Posición promedio</div>
        <div class="val">#${avg}</div>
      </div>
      <div class="rank-detail-stat" style="border-left-color:var(--purple)">
        <div class="lbl">Viol. en días dentro del top</div>
        <div class="val">${totalViol.toLocaleString()}</div>
      </div>
    </div>

    <div class="rank-detail-sparkbig" style="font-family:'JetBrains Mono',monospace;font-size:32px;letter-spacing:-3px;line-height:1;margin:10px 0">${gradientSparkline(trayectoria.map(t => t.rank))}</div>

    <table class="rank-detail-table">
      <thead><tr>
        <th scope="col">Día</th>
        <th scope="col">Posición</th>
        <th scope="col">Δ vs día anterior</th>
        <th scope="col" class="num">Violaciones</th>
      </tr></thead>
      <tbody>${filas.join('')}</tbody>
    </table>
  `;

  const closeBtn = $('#rank-detail-close');
  if (closeBtn) closeBtn.addEventListener('click', () => store.setSelectedSid(null));
}

// ══════════════════════════════════════════════════════════════
// Despachador
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
  // Cache de metaBy para resolver sid↔name en click handlers
  store.state._bumpMeta = rankInfo.metaBy;

  const empty   = $('#rank-evo-empty');
  const content = $('#rank-evo-content');
  const pill    = $('#rank-evo-pill');

  if (rankInfo.dates.length < 2) {
    if (empty)   empty.style.display = 'block';
    if (content) content.style.display = 'none';
    if (pill)    pill.textContent = rankInfo.dates.length === 1
      ? '1 día cargado · falta histórico'
      : 'sin datos';
    const panel = $('#rank-detail');
    if (panel) panel.hidden = true;
    return;
  }
  if (empty)   empty.style.display = 'none';
  if (content) content.style.display = 'block';
  if (pill)    pill.textContent = `${rankInfo.dates.length} días · ${rankInfo.dates[0]} → ${rankInfo.dates[rankInfo.dates.length - 1]}`;

  aplicarLayoutSegunVariante(bumpVariant);

  // Sincroniza el segmented A/B/C con el state
  document.querySelectorAll('#bump-variant-seg .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.variant === bumpVariant);
  });
  // Sincroniza el segmented Top N con el state
  document.querySelectorAll('#rank-topn-seg .seg-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.n === store.state.rankTopN);
  });

  if (bumpVariant === 'B')      renderVariantB(rankInfo);
  else if (bumpVariant === 'C') renderVariantC(rankInfo);
  else                          renderVariantA(rankInfo);

  renderDetalle(rankInfo);
}
