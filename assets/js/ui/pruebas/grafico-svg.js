// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Componente Gráfico (SVG)
// ──────────────────────────────────────────────────────────────
// Puerto FIEL de las 6 gráficas del tablero estático original
// (TransformerOps · "Tablero Dinámico de Pruebas Eléctricas").
// Reproduce EXACTAMENTE dimensiones, líneas de cuadrícula, paleta,
// líneas límite/guía dashed, tooltips y los datasets del tablero.
//
// Diseño:
//   · Las funciones reciben un objeto `serie` opcional con los
//     puntos derivados de los informes Firestore. Si no se pasa,
//     usan los DATASETS por defecto (los números reales del tablero
//     de la unidad 173523-15510), de modo que la vista se ve
//     idéntica al original aun sin backend.
//   · Sin dependencia de Chart.js: SVG nativo vía createElementNS,
//     igual que el tablero. Tooltips con un único <div id="tip">.
//
// Las líneas límite (rojo) y guía (ámbar) replican los umbrales del
// semáforo (pruebas_electricas_semaforo.js · UMBRALES). NO alterar
// sin cambiar el dominio.
// ══════════════════════════════════════════════════════════════

const NS = 'http://www.w3.org/2000/svg';

/* ─── Tooltip flotante (un único nodo reusado) ────────────────── */
let _tip;
function tipEl() {
  if (!_tip) {
    _tip = document.getElementById('pe-tip');
    if (!_tip) {
      _tip = document.createElement('div');
      _tip.id = 'pe-tip';
      _tip.className = 'pe-tip';
      document.body.appendChild(_tip);
    }
  }
  return _tip;
}
function showTip(e, h) { const t = tipEl(); t.innerHTML = h; t.style.opacity = 1; moveTip(e); }
function moveTip(e) { const t = tipEl(); t.style.left = (e.clientX + 14) + 'px'; t.style.top = (e.clientY - 10) + 'px'; }
function hideTip() { const t = tipEl(); t.style.opacity = 0; }

/* ─── Helpers SVG (idénticos al tablero) ──────────────────────── */
function el(tag, a) {
  const n = document.createElementNS(NS, tag);
  for (const k in a) n.setAttribute(k, a[k]);
  return n;
}
function tx(svg, x, y, s, o) {
  o = o || {};
  const t = el('text', Object.assign(
    { x, y, fill: '#8a97a5', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10 }, o));
  t.textContent = s;
  svg.appendChild(t);
  return t;
}

/* ─── Paleta de las gráficas (congelada · igual al tablero) ───── */
export const COL = Object.freeze({
  grid: '#e7ebf0', lim: '#c0392b', guide: '#b07d12',
  CH: '#1e4e79', CHL: '#6398c4', CL: '#c0392b', CLT: '#b07d12', CT: '#1f7a4d', CHT: '#6b4f9e',
  teal: '#0f8a99', navy: '#1e4e79', green: '#1f7a4d', purple: '#6b4f9e'
});

/* ─── Eje temporal (años de los informes del tablero) ─────────── */
const YR = [2012, 2014, 2020], XMIN = 2012, XMAX = 2020;
function xmap(W, L, R, y) { return L + ((y - XMIN) / (XMAX - XMIN)) * (W - L - R); }

/* ─── Datasets por defecto (números reales del tablero) ───────── */
const DEF = Object.freeze({
  tand: {
    CH:  [0.39, 0.42, 0.146], CHL: [0.27, 0.34, 0.100], CL:  [1.23, 1.52, 0.192],
    CLT: [0.24, 0.32, 0.089], CT:  [0.49, 0.67, 0.334], CHT: [0.54, 0.66, 0.054]
  },
  excitacion: [4.41, 4.83, 3.02],
  relacion: { atmt: [0.13, 0.09, 0.14], atter: [{ x: 2014, y: 0.31 }, { x: 2020, y: 0.23 }] },
  resistencia: [
    { label: '2012', bars: [{ w: 'AT', v: 0.76 }, { w: 'MT', v: 0.95 }, { w: 'BT', v: 1.01 }] },
    { label: '2014', bars: [{ w: 'AT', v: 0.22 }, { w: 'MT', v: 0.15 }, { w: 'BT', v: 0.35 }] },
    { label: '2020', bars: [{ w: 'AT', v: 0.04, flag: true }, { w: 'MT', v: 0.20 }] }
  ],
  aislamiento: [
    ['P–Tierra', 3.50], ['P–Sec', 2.50], ['P–Terc', 3.56],
    ['S–Tierra', 2.20], ['S–Terc', 1.54], ['T–Tierra', 1.42]
  ],
  collar: [49, 56, 57.9]
});

/* ══════════════════════════════════════════════════════════════
 * Gráfica 1 · Tangente δ / factor de potencia (6 configuraciones)
 * límite rojo 1.0 % · guía ámbar 0.5 % · ymax 1.6
 * ══════════════════════════════════════════════════════════════ */
export function chartTanDelta(serie) {
  const src = (serie && serie.tand) || DEF.tand;
  const W = 720, H = 300, L = 46, R = 18, T = 16, B = 40, ymax = 1.6;
  const X = (y) => xmap(W, L, R, y), Y = (v) => T + (1 - v / ymax) * (H - T - B);
  const data = {
    CH:  { c: COL.CH,  v: src.CH  }, CHL: { c: COL.CHL, v: src.CHL },
    CL:  { c: COL.CL,  v: src.CL  }, CLT: { c: COL.CLT, v: src.CLT },
    CT:  { c: COL.CT,  v: src.CT  }, CHT: { c: COL.CHT, v: src.CHT }
  };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  [0, 0.5, 1.0, 1.5].forEach((g) => {
    const yy = Y(g);
    svg.appendChild(el('line', {
      x1: L, y1: yy, x2: W - R, y2: yy,
      stroke: g === 1 ? COL.lim : (g === 0.5 ? COL.guide : COL.grid), 'stroke-width': 1,
      'stroke-dasharray': (g === 1 || g === 0.5) ? '5 4' : '', opacity: g === 0.5 ? 0.55 : 1
    }));
    tx(svg, L - 8, yy + 4, g.toFixed(1), { 'text-anchor': 'end', fill: g === 1 ? COL.lim : '#8a97a5' });
  });
  YR.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));
  for (const k in data) {
    const d = data[k];
    if (!Array.isArray(d.v)) continue;
    for (let i = 0; i < d.v.length - 1; i++) {
      svg.appendChild(el('line', {
        x1: X(YR[i]), y1: Y(d.v[i]), x2: X(YR[i + 1]), y2: Y(d.v[i + 1]),
        stroke: d.c, 'stroke-width': 2.4, 'stroke-linecap': 'round'
      }));
    }
    d.v.forEach((val, i) => {
      if (val == null) return;
      const dot = el('circle', { cx: X(YR[i]), cy: Y(val), r: 4, fill: d.c });
      dot.setAttribute('class', 'gpt');
      dot.addEventListener('mouseenter', (e) => showTip(e, `<b>${k}</b> · ${YR[i]}<br>tan δ = ${val.toFixed(3)} %`));
      dot.addEventListener('mousemove', moveTip);
      dot.addEventListener('mouseleave', hideTip);
      svg.appendChild(dot);
    });
  }
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 2 · Corriente de excitación · Δ entre fases mayores
 * límite rojo 10 % · guía ámbar 5 % · ymax 12
 * ══════════════════════════════════════════════════════════════ */
export function chartExc(serie) {
  const v = (serie && serie.excitacion) || DEF.excitacion;
  const W = 720, H = 250, L = 42, R = 18, T = 16, B = 40, ymax = 12;
  const X = (y) => xmap(W, L, R, y), Y = (val) => T + (1 - val / ymax) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  [0, 5, 10].forEach((g) => {
    const yy = Y(g);
    svg.appendChild(el('line', {
      x1: L, y1: yy, x2: W - R, y2: yy,
      stroke: g === 10 ? COL.lim : (g === 5 ? COL.guide : COL.grid), 'stroke-width': 1,
      'stroke-dasharray': g > 0 ? '5 4' : '', opacity: g === 5 ? 0.55 : 1
    }));
    tx(svg, L - 8, yy + 4, g + '%', { 'text-anchor': 'end', fill: g === 10 ? COL.lim : '#8a97a5' });
  });
  YR.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));
  for (let i = 0; i < v.length - 1; i++) {
    if (v[i] == null || v[i + 1] == null) continue;
    svg.appendChild(el('line', {
      x1: X(YR[i]), y1: Y(v[i]), x2: X(YR[i + 1]), y2: Y(v[i + 1]),
      stroke: COL.teal, 'stroke-width': 2.4, 'stroke-linecap': 'round'
    }));
  }
  v.forEach((val, i) => {
    if (val == null) return;
    const dot = el('circle', { cx: X(YR[i]), cy: Y(val), r: 5, fill: COL.teal });
    dot.setAttribute('class', 'gpt');
    dot.addEventListener('mouseenter', (e) => showTip(e, `${YR[i]}<br>Δ fases = ${val.toFixed(2)} %`));
    dot.addEventListener('mousemove', moveTip);
    dot.addEventListener('mouseleave', hideTip);
    svg.appendChild(dot);
  });
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 3 · Relación de transformación · desviación vs placa
 * límite rojo 0.5 % · ymax 0.6 · 2 series (AT–MT, AT–Terc.)
 * ══════════════════════════════════════════════════════════════ */
export function chartRel(serie) {
  const rel = (serie && serie.relacion) || DEF.relacion;
  const atmt = Array.isArray(rel.atmt)
    ? rel.atmt.map((y, i) => ({ x: YR[i], y })).filter((p) => p.y != null)
    : rel.atmt;
  const atter = rel.atter;
  const W = 720, H = 230, L = 44, R = 18, T = 16, B = 40, ymax = 0.6;
  const X = (y) => xmap(W, L, R, y), Y = (v) => T + (1 - v / ymax) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  [0, 0.25, 0.5].forEach((g) => {
    const yy = Y(g);
    svg.appendChild(el('line', {
      x1: L, y1: yy, x2: W - R, y2: yy,
      stroke: g === 0.5 ? COL.lim : COL.grid, 'stroke-width': 1,
      'stroke-dasharray': g === 0.5 ? '5 4' : ''
    }));
    tx(svg, L - 8, yy + 4, g.toFixed(2) + '%', { 'text-anchor': 'end', fill: g === 0.5 ? COL.lim : '#8a97a5' });
  });
  YR.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));
  const line = (arr, c, lbl) => {
    for (let i = 0; i < arr.length - 1; i++) {
      svg.appendChild(el('line', {
        x1: X(arr[i].x), y1: Y(arr[i].y), x2: X(arr[i + 1].x), y2: Y(arr[i + 1].y),
        stroke: c, 'stroke-width': 2.2, 'stroke-linecap': 'round'
      }));
    }
    arr.forEach((p) => {
      const d = el('circle', { cx: X(p.x), cy: Y(p.y), r: 4.5, fill: c });
      d.setAttribute('class', 'gpt');
      d.addEventListener('mouseenter', (e) => showTip(e, `<b>${lbl}</b> · ${p.x}<br>desv = ${p.y.toFixed(2)} %`));
      d.addEventListener('mousemove', moveTip);
      d.addEventListener('mouseleave', hideTip);
      svg.appendChild(d);
    });
  };
  line(atmt, COL.navy, 'AT–MT');
  line(atter, COL.purple, 'AT–Terc.');
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 4 · Resistencia de devanados · desbalance por fase
 * límite rojo 5 % · ymax 6 · barras agrupadas por año
 * barra flag → patrón hatch ámbar + ⚠ ("a verificar")
 * ══════════════════════════════════════════════════════════════ */
export function chartRes(serie) {
  const groups = (serie && serie.resistencia) || DEF.resistencia;
  const W = 720, H = 260, L = 42, R = 16, T = 16, B = 44, ymax = 6;
  const Y = (v) => T + (1 - v / ymax) * (H - T - B);
  const cmap = { AT: COL.navy, MT: COL.green, BT: COL.purple };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  [0, 2.5, 5].forEach((g) => {
    const yy = Y(g);
    svg.appendChild(el('line', {
      x1: L, y1: yy, x2: W - R, y2: yy,
      stroke: g === 5 ? COL.lim : COL.grid, 'stroke-width': 1, 'stroke-dasharray': g === 5 ? '5 4' : ''
    }));
    tx(svg, L - 8, yy + 4, g.toFixed(1) + '%', { 'text-anchor': 'end', fill: g === 5 ? COL.lim : '#8a97a5' });
  });
  const defs = el('defs', {});
  const pat = el('pattern', { id: 'pe-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pat.appendChild(el('rect', { width: 6, height: 6, fill: '#f1e2c0' }));
  pat.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: COL.guide, 'stroke-width': 2 }));
  defs.appendChild(pat);
  svg.appendChild(defs);
  const gw = (W - L - R) / groups.length;
  groups.forEach((grp, gi) => {
    const gx = L + gi * gw, bw = gw / 5, gap = bw * 0.25;
    const tot = grp.bars.length * bw + (grp.bars.length - 1) * gap, start = gx + (gw - tot) / 2;
    grp.bars.forEach((b, bi) => {
      const x = start + bi * (bw + gap);
      const vv = Math.max(b.v, 0.04);
      const y = Y(vv), h = (H - T - B) - (y - T);
      const rect = el('rect', { x, y, width: bw, height: h, rx: 2, fill: b.flag ? 'url(#pe-hatch)' : cmap[b.w] });
      rect.setAttribute('class', 'gpt');
      rect.addEventListener('mouseenter', (e) => showTip(e, `${grp.label} · ${b.w}<br>Δ ${b.flag ? '(a verificar) ' : ''}= ${b.v.toFixed(2)} %`));
      rect.addEventListener('mousemove', moveTip);
      rect.addEventListener('mouseleave', hideTip);
      svg.appendChild(rect);
      tx(svg, x + bw / 2, y - 5, b.flag ? '⚠' : b.v.toFixed(1), { 'text-anchor': 'middle', 'font-size': 9, fill: b.flag ? COL.guide : '#5b6876' });
    });
    tx(svg, gx + gw / 2, H - B + 22, grp.label, { 'text-anchor': 'middle', 'font-size': 11 });
  });
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 5 · Resistencia de aislamiento (CC) · por par de devanado
 * límite rojo 1 GΩ · ymax 4 · barras teal
 * ══════════════════════════════════════════════════════════════ */
export function chartIns(serie) {
  const data = (serie && serie.aislamiento) || DEF.aislamiento;
  const W = 720, H = 250, L = 44, R = 16, T = 16, B = 64, ymax = 4;
  const Y = (v) => T + (1 - v / ymax) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  [0, 1, 2, 3, 4].forEach((g) => {
    const yy = Y(g);
    svg.appendChild(el('line', {
      x1: L, y1: yy, x2: W - R, y2: yy,
      stroke: g === 1 ? COL.lim : COL.grid, 'stroke-width': 1, 'stroke-dasharray': g === 1 ? '5 4' : ''
    }));
    tx(svg, L - 8, yy + 4, g, { 'text-anchor': 'end', fill: g === 1 ? COL.lim : '#8a97a5' });
  });
  const n = data.length, gw = (W - L - R) / n;
  data.forEach((d, i) => {
    const bw = gw * 0.5, x = L + i * gw + (gw - bw) / 2, y = Y(d[1]), h = (H - T - B) - (y - T);
    const rect = el('rect', { x, y, width: bw, height: h, rx: 2, fill: COL.teal });
    rect.setAttribute('class', 'gpt');
    rect.addEventListener('mouseenter', (e) => showTip(e, `${d[0]}<br>${d[1].toFixed(2)} GΩ`));
    rect.addEventListener('mousemove', moveTip);
    rect.addEventListener('mouseleave', hideTip);
    svg.appendChild(rect);
    tx(svg, x + bw / 2, y - 5, d[1].toFixed(2), { 'text-anchor': 'middle', 'font-size': 9, fill: '#5b6876' });
    tx(svg, L + i * gw + gw / 2, H - B + 18, d[0], { 'text-anchor': 'middle', 'font-size': 9 });
  });
  tx(svg, L - 8, T - 4, 'GΩ', { 'text-anchor': 'end', 'font-size': 9 });
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 6 · Collar caliente / pérdidas en bujes
 * límite rojo 100 mW · ymax 110 · línea verde
 * ══════════════════════════════════════════════════════════════ */
export function chartCol(serie) {
  const v = (serie && serie.collar) || DEF.collar;
  const W = 720, H = 240, L = 44, R = 18, T = 16, B = 40, ymax = 110;
  const X = (y) => xmap(W, L, R, y), Y = (val) => T + (1 - val / ymax) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  [0, 50, 100].forEach((g) => {
    const yy = Y(g);
    svg.appendChild(el('line', {
      x1: L, y1: yy, x2: W - R, y2: yy,
      stroke: g === 100 ? COL.lim : COL.grid, 'stroke-width': 1, 'stroke-dasharray': g === 100 ? '5 4' : ''
    }));
    tx(svg, L - 8, yy + 4, g, { 'text-anchor': 'end', fill: g === 100 ? COL.lim : '#8a97a5' });
  });
  tx(svg, L - 8, T - 4, 'mW', { 'text-anchor': 'end', 'font-size': 9 });
  YR.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));
  for (let i = 0; i < v.length - 1; i++) {
    if (v[i] == null || v[i + 1] == null) continue;
    svg.appendChild(el('line', {
      x1: X(YR[i]), y1: Y(v[i]), x2: X(YR[i + 1]), y2: Y(v[i + 1]),
      stroke: COL.green, 'stroke-width': 2.4, 'stroke-linecap': 'round'
    }));
  }
  v.forEach((val, i) => {
    if (val == null) return;
    const dot = el('circle', { cx: X(YR[i]), cy: Y(val), r: 5, fill: COL.green });
    dot.setAttribute('class', 'gpt');
    dot.addEventListener('mouseenter', (e) => showTip(e, `${YR[i]}<br>máx = ${val} mW`));
    dot.addEventListener('mousemove', moveTip);
    dot.addEventListener('mouseleave', hideTip);
    svg.appendChild(dot);
  });
  return svg;
}

/* ─── Mapa id-contenedor → función gráfica ────────────────────── */
const FACTORIES = {
  'c-tand': chartTanDelta, 'c-exc': chartExc, 'c-rel': chartRel,
  'c-res': chartRes, 'c-ins': chartIns, 'c-col': chartCol
};

/**
 * Monta las 6 gráficas en sus contenedores. Si `serie` viene de
 * informes Firestore, las gráficas se redibujan con esos datos;
 * si no, usan los datasets por defecto del tablero.
 * @param {object} [serie] datos derivados de informes
 * @param {Document|HTMLElement} [root=document] raíz de búsqueda
 */
export function mountCharts(serie, root) {
  const scope = root || document;
  for (const id in FACTORIES) {
    const c = scope.getElementById ? scope.getElementById(id) : scope.querySelector('#' + id);
    if (c) { c.innerHTML = ''; c.appendChild(FACTORIES[id](serie)); }
  }
}
