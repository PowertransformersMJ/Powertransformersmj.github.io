// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Componente Gráfico (SVG)
// ──────────────────────────────────────────────────────────────
// Puerto FIEL de las 6 gráficas del tablero estático original
// (TransformerOps · "Tablero Dinámico de Pruebas Eléctricas").
// Reproduce EXACTAMENTE dimensiones, líneas de cuadrícula, paleta,
// líneas límite/guía dashed, tooltips y los datasets del tablero.
//
// Diseño (interfaz en tiempo real · SOLO datos cargados):
//   · `derivarSeries(informes)` proyecta los informes Firestore a un
//     objeto `serie` con eje de años DINÁMICO (los años de los
//     informes que el usuario subió, no un eje congelado).
//   · Las funciones de gráfica reciben ese `serie`. Si NO hay
//     informes (serie vacía), cada gráfica dibuja un estado vacío
//     ("Sin informes cargados") — NUNCA datos de demostración.
//   · El schema persiste escalares sintetizados por prueba, así que
//     resistencia y aislamiento se grafican como barra escalar por
//     año (no por fase/par, que el schema no almacena).
//   · Sin dependencia de Chart.js: SVG nativo vía createElementNS,
//     igual que el tablero. Tooltips con un único <div id="tip">.
//
// Las líneas límite (rojo) y guía (ámbar) replican los umbrales del
// semáforo (pruebas_electricas_semaforo.js · UMBRALES). NO alterar
// sin cambiar el dominio.
// ══════════════════════════════════════════════════════════════

import { CONFIGS_TAND } from '../../domain/pruebas_electricas_schema.js';

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

/* ─── Derivación de series desde informes (eje de años dinámico) ─
 * Proyecta los informes Firestore (schema v2) a un objeto `serie` con
 * la MISMA forma que el tablero de referencia: tendencia año a año
 * sobre la misma gráfica. Cada prueba conserva su detalle:
 *   · tand        → 6 secciones (CH/CHL/CL/CLT/CT/CHT), valor por año
 *   · excitacion  → Δ ext. (%) por año (línea)
 *   · relacion    → DOS series por año: AT–MT (navy) y AT–Terc. (purple)
 *   · resistencia → barras agrupadas AT/MT/BT por año (con flag/no medido)
 *   · aislamiento → FOTO del informe más reciente: una barra por par
 *   · collar      → pérdida máx (mW) por año (línea)
 * @param {Array} informes
 */
export function derivarSeries(informes) {
  const docs = (informes || [])
    .filter((i) => i && i.ano != null)
    .slice()
    .sort((a, b) => a.ano - b.ano);
  const anos = docs.map((d) => d.ano);

  // 1) tan δ — un valor por sección y por año.
  const tand = {};
  CONFIGS_TAND.forEach((cfg) => {
    tand[cfg.code] = docs.map((inf) => {
      const t = (Array.isArray(inf.tand) ? inf.tand : []).find((x) => x && x.code === cfg.code);
      return t && t.valor_pct != null ? t.valor_pct : null;
    });
  });

  // 2) Excitación — Δ ext. (%) por año.
  const excitacion = docs.map((i) =>
    (i.excitacion && i.excitacion.delta_ext_pct != null) ? i.excitacion.delta_ext_pct : null);

  // 3) Relación — dos series (AT–MT, AT–Terc.) por año.
  const relValor = (inf, matcher) => {
    const filas = Array.isArray(inf.relacion) ? inf.relacion : [];
    const fila = filas.find((r) => matcher(String(r.asociado || '').toUpperCase()));
    return fila && fila.desviacion_pct != null ? Math.abs(fila.desviacion_pct) : null;
  };
  const relacion = {
    atmt:  docs.map((i) => relValor(i, (a) => a.startsWith('MT'))),
    atter: docs.map((i) => relValor(i, (a) => a.includes('TER')))
  };

  // 4) Resistencia — barras agrupadas AT/MT/BT por año.
  const resBar = (inf, dev) => {
    const filas = Array.isArray(inf.resistencia) ? inf.resistencia : [];
    const fila = filas.find((r) => String(r.devanado || '').toUpperCase() === dev);
    if (!fila) return null;
    if (fila.no_medido) return { v: null, flag: false, no_medido: true };
    return { v: fila.delta_max_pct, flag: !!fila.verificar, no_medido: false };
  };
  const resistencia = docs.map((i) => ({
    ano: i.ano,
    AT: resBar(i, 'AT'),
    MT: resBar(i, 'MT'),
    BT: resBar(i, 'BT')
  }));

  // 5) Aislamiento — FOTO del informe más reciente con datos (por par).
  const ultimoIns = [...docs].reverse()
    .find((i) => Array.isArray(i.aislamiento) && i.aislamiento.length);
  const aislamiento = ultimoIns
    ? ultimoIns.aislamiento.map((a) => ({
        label: `${a.devanado}–${a.asociado}`,
        v: a.gohm != null ? a.gohm : null
      }))
    : [];
  const aislamientoAno = ultimoIns ? ultimoIns.ano : null;

  // 6) Collar — pérdida máx (mW) por año.
  const collar = docs.map((i) => (i.collar && i.collar.max_mw != null ? i.collar.max_mw : null));

  // 7) DRM — ventana de tiempo de transición del conmutador (ms) por año.
  //    Cada año aporta [min, max]; se grafica como banda/whisker contra
  //    la ventana normal 40–70 ms.
  const drm = docs.map((i) => {
    const d = i.drm || {};
    return {
      ano: i.ano,
      lo: d.tiempo_min_ms != null ? d.tiempo_min_ms : null,
      hi: d.tiempo_max_ms != null ? d.tiempo_max_ms : null
    };
  });

  return { anos, tand, excitacion, relacion, resistencia, aislamiento, aislamientoAno, collar, drm };
}

/* ─── Helpers de eje dinámico + estado vacío ──────────────────── */
// Mapeador X según los años reales. Con un solo año, centra el punto.
function mkX(anos, W, L, R) {
  const min = anos[0], max = anos[anos.length - 1];
  const span = (max - min) || 1;
  return (yr) => (anos.length <= 1 ? L + (W - L - R) / 2 : L + ((yr - min) / span) * (W - L - R));
}
// SVG con un mensaje centrado (cuando no hay informes que graficar).
function emptyState(W, H, msg) {
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  svg.appendChild(el('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 8, fill: 'none', stroke: COL.grid, 'stroke-dasharray': '6 6' }));
  tx(svg, W / 2, H / 2 + 4, msg, { 'text-anchor': 'middle', 'font-size': 13, fill: '#8a97a5' });
  return svg;
}
function sinDatos(serie) { return !serie || !Array.isArray(serie.anos) || serie.anos.length === 0; }

/* ══════════════════════════════════════════════════════════════
 * Gráfica 1 · Tangente δ / factor de potencia (6 configuraciones)
 * límite rojo 1.0 % · guía ámbar 0.5 % · ymax 1.6
 * ══════════════════════════════════════════════════════════════ */
export function chartTanDelta(serie) {
  const W = 720, H = 300, L = 46, R = 18, T = 16, B = 40, ymax = 1.6;
  if (sinDatos(serie)) return emptyState(W, H, 'Sin informes cargados');
  const anos = serie.anos, src = serie.tand || {};
  const X = mkX(anos, W, L, R), Y = (v) => T + (1 - v / ymax) * (H - T - B);
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
  anos.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));
  for (const k in data) {
    const d = data[k];
    if (!Array.isArray(d.v)) continue;
    for (let i = 0; i < d.v.length - 1; i++) {
      if (d.v[i] == null || d.v[i + 1] == null) continue;
      svg.appendChild(el('line', {
        x1: X(anos[i]), y1: Y(d.v[i]), x2: X(anos[i + 1]), y2: Y(d.v[i + 1]),
        stroke: d.c, 'stroke-width': 2.4, 'stroke-linecap': 'round'
      }));
    }
    d.v.forEach((val, i) => {
      if (val == null) return;
      const dot = el('circle', { cx: X(anos[i]), cy: Y(val), r: 4, fill: d.c });
      dot.setAttribute('class', 'gpt');
      dot.addEventListener('mouseenter', (e) => showTip(e, `<b>${k}</b> · ${anos[i]}<br>tan δ = ${val.toFixed(3)} %`));
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
  const W = 720, H = 250, L = 42, R = 18, T = 16, B = 40, ymax = 12;
  if (sinDatos(serie)) return emptyState(W, H, 'Sin informes cargados');
  const anos = serie.anos, v = serie.excitacion || [];
  const X = mkX(anos, W, L, R), Y = (val) => T + (1 - val / ymax) * (H - T - B);
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
  anos.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));
  for (let i = 0; i < v.length - 1; i++) {
    if (v[i] == null || v[i + 1] == null) continue;
    svg.appendChild(el('line', {
      x1: X(anos[i]), y1: Y(v[i]), x2: X(anos[i + 1]), y2: Y(v[i + 1]),
      stroke: COL.teal, 'stroke-width': 2.4, 'stroke-linecap': 'round'
    }));
  }
  v.forEach((val, i) => {
    if (val == null) return;
    const dot = el('circle', { cx: X(anos[i]), cy: Y(val), r: 5, fill: COL.teal });
    dot.setAttribute('class', 'gpt');
    dot.addEventListener('mouseenter', (e) => showTip(e, `${anos[i]}<br>Δ fases = ${val.toFixed(2)} %`));
    dot.addEventListener('mousemove', moveTip);
    dot.addEventListener('mouseleave', hideTip);
    svg.appendChild(dot);
  });
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 3 · Relación de transformación · desviación vs placa
 * límite rojo 0.5 % · ymax 0.6 · DOS series de tendencia:
 *   AT–MT (navy) y AT–Terc. (purple) — tal cual el tablero.
 * ══════════════════════════════════════════════════════════════ */
export function chartRel(serie) {
  const W = 720, H = 230, L = 44, R = 18, T = 16, B = 40, ymax = 0.6;
  if (sinDatos(serie)) return emptyState(W, H, 'Sin informes cargados');
  const anos = serie.anos;
  const rel = serie.relacion || { atmt: [], atter: [] };
  const X = mkX(anos, W, L, R), Y = (v) => T + (1 - v / ymax) * (H - T - B);
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
  anos.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));

  const series = [
    { key: 'atmt',  label: 'AT–MT',    c: COL.navy },
    { key: 'atter', label: 'AT–Terc.', c: COL.purple }
  ];
  series.forEach((s) => {
    const pts = (rel[s.key] || []).map((y, i) => ({ x: anos[i], y })).filter((p) => p.y != null);
    for (let i = 0; i < pts.length - 1; i++) {
      svg.appendChild(el('line', {
        x1: X(pts[i].x), y1: Y(pts[i].y), x2: X(pts[i + 1].x), y2: Y(pts[i + 1].y),
        stroke: s.c, 'stroke-width': 2.2, 'stroke-linecap': 'round'
      }));
    }
    pts.forEach((p) => {
      const d = el('circle', { cx: X(p.x), cy: Y(p.y), r: 4.5, fill: s.c });
      d.setAttribute('class', 'gpt');
      d.addEventListener('mouseenter', (e) => showTip(e, `<b>${s.label}</b> · ${p.x}<br>desv = ${p.y.toFixed(2)} %`));
      d.addEventListener('mousemove', moveTip);
      d.addEventListener('mouseleave', hideTip);
      svg.appendChild(d);
    });
  });

  // Leyenda (esquina superior derecha).
  let lx = W - R - 150;
  series.forEach((s) => {
    svg.appendChild(el('rect', { x: lx, y: T - 2, width: 14, height: 4, rx: 2, fill: s.c }));
    tx(svg, lx + 18, T + 3, s.label, { 'font-size': 10, fill: '#5b6876' });
    lx += 75;
  });
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 4 · Resistencia de devanados · desbalance por año
 * límite rojo 5 % · ymax 6 · barras AGRUPADAS AT/MT/BT por año
 *   AT navy · MT green · BT purple (tal cual el tablero)
 * barra flag → patrón hatch ámbar + ⚠ ("a verificar")
 * barra no medida → marca "n/m"
 * ══════════════════════════════════════════════════════════════ */
export function chartRes(serie) {
  const W = 720, H = 260, L = 42, R = 16, T = 16, B = 44, ymax = 6;
  if (sinDatos(serie)) return emptyState(W, H, 'Sin informes cargados');
  const grupos = serie.resistencia || [];
  const Y = (v) => T + (1 - v / ymax) * (H - T - B);
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

  const cmap = { AT: COL.navy, MT: COL.green, BT: COL.purple };
  const devs = ['AT', 'MT', 'BT'];
  const gw = (W - L - R) / Math.max(grupos.length, 1);
  const bw = Math.min((gw * 0.7) / devs.length, 22);
  const cluster = bw * devs.length + (devs.length - 1) * 4;

  grupos.forEach((grp, gi) => {
    const cx = L + gi * gw + gw / 2;
    const startX = cx - cluster / 2;
    devs.forEach((dev, di) => {
      const b = grp[dev];
      const x = startX + di * (bw + 4);
      if (b && b.no_medido) {
        tx(svg, x + bw / 2, Y(0) - 6, 'n/m', { 'text-anchor': 'middle', 'font-size': 8, fill: '#a9b4c0' });
        return;
      }
      if (!b || b.v == null) return;
      const vv = Math.max(b.v, 0.04);
      const y = Y(vv), h = (H - T - B) - (y - T);
      const rect = el('rect', { x, y, width: bw, height: h, rx: 2, fill: b.flag ? 'url(#pe-hatch)' : cmap[dev] });
      rect.setAttribute('class', 'gpt');
      rect.addEventListener('mouseenter', (e) =>
        showTip(e, `<b>${dev}</b> · ${grp.ano}<br>Δ ${b.flag ? '(a verificar) ' : ''}= ${b.v.toFixed(2)} %`));
      rect.addEventListener('mousemove', moveTip);
      rect.addEventListener('mouseleave', hideTip);
      svg.appendChild(rect);
      if (b.flag) tx(svg, x + bw / 2, y - 4, '⚠', { 'text-anchor': 'middle', 'font-size': 9, fill: COL.guide });
    });
    tx(svg, cx, H - B + 22, grp.ano, { 'text-anchor': 'middle', 'font-size': 11 });
  });

  // Leyenda AT/MT/BT.
  let lx = W - R - 150;
  devs.forEach((dev) => {
    svg.appendChild(el('rect', { x: lx, y: T - 2, width: 12, height: 8, rx: 2, fill: cmap[dev] }));
    tx(svg, lx + 16, T + 5, dev, { 'font-size': 10, fill: '#5b6876' });
    lx += 48;
  });
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 5 · Resistencia de aislamiento (CC) · por año
 * límite rojo 1 GΩ · ymax 4 · barras teal escalares por año
 * ══════════════════════════════════════════════════════════════ */
export function chartIns(serie) {
  const W = 720, H = 250, L = 44, R = 16, T = 16, B = 44, ymax = 4;
  if (sinDatos(serie)) return emptyState(W, H, 'Sin informes cargados');
  const bars = serie.aislamiento || [];
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
  const gw = (W - L - R) / bars.length, bw = Math.min(gw * 0.55, 48);
  bars.forEach((b, i) => {
    const cx = L + i * gw + gw / 2, x = cx - bw / 2;
    if (b.v != null) {
      const y = Y(b.v), h = (H - T - B) - (y - T);
      const rect = el('rect', { x, y, width: bw, height: h, rx: 2, fill: COL.teal });
      rect.setAttribute('class', 'gpt');
      rect.addEventListener('mouseenter', (e) => showTip(e, `${b.label}<br>${b.v.toFixed(2)} GΩ`));
      rect.addEventListener('mousemove', moveTip);
      rect.addEventListener('mouseleave', hideTip);
      svg.appendChild(rect);
      tx(svg, cx, y - 5, b.v.toFixed(2), { 'text-anchor': 'middle', 'font-size': 9, fill: '#5b6876' });
    } else {
      tx(svg, cx, Y(0) - 8, 'n/d', { 'text-anchor': 'middle', 'font-size': 9, fill: '#a9b4c0' });
    }
    tx(svg, cx, H - B + 18, b.label, { 'text-anchor': 'middle', 'font-size': 10 });
  });
  tx(svg, L - 8, T - 4, 'GΩ', { 'text-anchor': 'end', 'font-size': 9 });
  if (serie.aislamientoAno) {
    tx(svg, W - R, T - 4, `Foto ${serie.aislamientoAno}`, { 'text-anchor': 'end', 'font-size': 9, fill: '#8a97a5' });
  }
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 6 · Collar caliente / pérdidas en bujes
 * límite rojo 100 mW · ymax 110 · línea verde
 * ══════════════════════════════════════════════════════════════ */
export function chartCol(serie) {
  const W = 720, H = 240, L = 44, R = 18, T = 16, B = 40, ymax = 110;
  if (sinDatos(serie)) return emptyState(W, H, 'Sin informes cargados');
  const anos = serie.anos, v = serie.collar || [];
  const X = mkX(anos, W, L, R), Y = (val) => T + (1 - val / ymax) * (H - T - B);
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
  anos.forEach((yr) => tx(svg, X(yr), H - B + 22, yr, { 'text-anchor': 'middle', 'font-size': 11 }));
  for (let i = 0; i < v.length - 1; i++) {
    if (v[i] == null || v[i + 1] == null) continue;
    svg.appendChild(el('line', {
      x1: X(anos[i]), y1: Y(v[i]), x2: X(anos[i + 1]), y2: Y(v[i + 1]),
      stroke: COL.green, 'stroke-width': 2.4, 'stroke-linecap': 'round'
    }));
  }
  v.forEach((val, i) => {
    if (val == null) return;
    const dot = el('circle', { cx: X(anos[i]), cy: Y(val), r: 5, fill: COL.green });
    dot.setAttribute('class', 'gpt');
    dot.addEventListener('mouseenter', (e) => showTip(e, `${anos[i]}<br>máx = ${val} mW`));
    dot.addEventListener('mousemove', moveTip);
    dot.addEventListener('mouseleave', hideTip);
    svg.appendChild(dot);
  });
  return svg;
}

/* ══════════════════════════════════════════════════════════════
 * Gráfica 7 · DRM · tiempo de transición del conmutador (OLTC)
 * ventana normal 40–70 ms (rojo) · guías ámbar 45/65 · ymax 80
 *   por año: banda [min,max] verde/ámbar/rojo según la ventana.
 * ══════════════════════════════════════════════════════════════ */
export function chartDrm(serie) {
  const W = 720, H = 250, L = 44, R = 18, T = 16, B = 40, ymax = 80;
  if (sinDatos(serie)) return emptyState(W, H, 'Sin informes cargados');
  const grupos = (serie.drm || []).filter((g) => g && (g.lo != null || g.hi != null));
  if (!grupos.length) return emptyState(W, H, 'Sin datos DRM (conmutador)');
  const anos = grupos.map((g) => g.ano);
  const X = mkX(anos, W, L, R), Y = (v) => T + (1 - v / ymax) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  // Cuadrícula + líneas de ventana normal (40 y 70 rojo · guías 45/65 ámbar).
  [0, 20, 40, 45, 65, 70, 80].forEach((g) => {
    const yy = Y(g);
    const esLimite = (g === 40 || g === 70);
    const esGuia = (g === 45 || g === 65);
    svg.appendChild(el('line', {
      x1: L, y1: yy, x2: W - R, y2: yy,
      stroke: esLimite ? COL.lim : (esGuia ? COL.guide : COL.grid), 'stroke-width': 1,
      'stroke-dasharray': (esLimite || esGuia) ? '5 4' : '', opacity: esGuia ? 0.55 : 1
    }));
    if (g === 0 || g === 40 || g === 70 || g === 80) {
      tx(svg, L - 8, yy + 4, g, { 'text-anchor': 'end', fill: esLimite ? COL.lim : '#8a97a5' });
    }
  });
  tx(svg, L - 8, T - 4, 'ms', { 'text-anchor': 'end', 'font-size': 9 });
  const gw = (W - L - R) / Math.max(grupos.length, 1);
  const bw = Math.min(gw * 0.34, 26);
  grupos.forEach((g, gi) => {
    const cx = anos.length <= 1 ? L + (W - L - R) / 2 : X(g.ano);
    const lo = g.lo != null ? g.lo : g.hi;
    const hi = g.hi != null ? g.hi : g.lo;
    const fuera = (lo < 40 || hi > 70);
    const guia = (lo < 45 || hi > 65);
    const c = fuera ? COL.lim : (guia ? COL.guide : COL.green);
    const yTop = Y(hi), yBot = Y(lo);
    const h = Math.max(yBot - yTop, 3);
    const rect = el('rect', { x: cx - bw / 2, y: yTop, width: bw, height: h, rx: 3, fill: c, opacity: 0.85 });
    rect.setAttribute('class', 'gpt');
    const rango = (lo !== hi) ? `${lo}–${hi} ms` : `${hi} ms`;
    rect.addEventListener('mouseenter', (e) => showTip(e, `<b>DRM</b> · ${g.ano}<br>transición = ${rango}`));
    rect.addEventListener('mousemove', moveTip);
    rect.addEventListener('mouseleave', hideTip);
    svg.appendChild(rect);
    tx(svg, cx, yTop - 5, rango, { 'text-anchor': 'middle', 'font-size': 9, fill: '#5b6876' });
    tx(svg, cx, H - B + 22, g.ano, { 'text-anchor': 'middle', 'font-size': 11 });
  });
  // Leyenda ventana normal.
  tx(svg, W - R, T + 3, 'ventana normal 40–70 ms', { 'text-anchor': 'end', 'font-size': 10, fill: '#5b6876' });
  return svg;
}

/* ─── Mapa id-contenedor → función gráfica ────────────────────── */
const FACTORIES = {
  'c-tand': chartTanDelta, 'c-exc': chartExc, 'c-rel': chartRel,
  'c-res': chartRes, 'c-ins': chartIns, 'c-col': chartCol, 'c-drm': chartDrm
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
