// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Render GENÉRICO de bloques de análisis (SVG)
// ──────────────────────────────────────────────────────────────
// Motor "sin límites": dado un bloque (modelo flexible de
// domain/pruebas_electricas_bloques.js) lo dibuja como gráfica
// (línea / barra / dispersión, multi-serie, eje Y dinámico) + tabla de
// detalle. NO conoce ninguna prueba en particular → soporta cualquier
// formato que la IA produzca, presente o futuro, sin tocar este código.
//
// Reusa ejeMax/ticksY (grafico-svg.js) para que las barras/puntos nunca
// se salgan del marco (L-23). Tooltips vía el mismo #pe-tip compartido.
// ══════════════════════════════════════════════════════════════

import { ejeMax, ticksY } from './grafico-svg.js';

const NS = 'http://www.w3.org/2000/svg';
// Paleta estable (se asigna por índice cuando la serie no trae color).
const PALETA = ['#1e4e79', '#0f8a99', '#c0392b', '#b07d12', '#1f7a4d', '#6b4f9e', '#6398c4', '#a93226'];
const COL = { grid: '#e7ebf0', lim: '#c0392b', guide: '#b07d12', muted: '#8a97a5', ink: '#5b6876' };

function el(tag, a) {
  const n = document.createElementNS(NS, tag);
  for (const k in a) n.setAttribute(k, a[k]);
  return n;
}
function tx(svg, x, y, s, o = {}) {
  const t = el('text', Object.assign({ x, y, fill: COL.muted, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10 }, o));
  t.textContent = s; svg.appendChild(t); return t;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─── Tooltip compartido (mismo nodo que grafico-svg) ────────── */
let _tip;
function tipEl() {
  if (!_tip) {
    _tip = document.getElementById('pe-tip');
    if (!_tip) { _tip = document.createElement('div'); _tip.id = 'pe-tip'; _tip.className = 'pe-tip'; document.body.appendChild(_tip); }
  }
  return _tip;
}
function showTip(e, h) { const t = tipEl(); t.innerHTML = h; t.style.opacity = 1; moveTip(e); }
function moveTip(e) { const t = tipEl(); t.style.left = (e.clientX + 14) + 'px'; t.style.top = (e.clientY - 10) + 'px'; }
function hideTip() { tipEl().style.opacity = 0; }
function hookTip(node, html) {
  node.setAttribute('class', 'gpt');
  node.addEventListener('mouseenter', (e) => showTip(e, html));
  node.addEventListener('mousemove', moveTip);
  node.addEventListener('mouseleave', hideTip);
}

/* ─── Eje X: orden de categorías (números o etiquetas) ───────── */
// Devuelve la lista ordenada de valores X distintos de todas las series.
function ejeX(series) {
  const vistos = new Map(); // clave → valor original
  let allNum = true;
  for (const s of series) for (const p of s.puntos) {
    const k = String(p.x);
    if (!vistos.has(k)) vistos.set(k, p.x);
    if (typeof p.x !== 'number') allNum = false;
  }
  let cats = [...vistos.values()];
  if (allNum) cats.sort((a, b) => a - b);
  return { cats, allNum };
}

/* ─── Construye el SVG de un bloque ──────────────────────────── */
function svgBloque(bloque) {
  const W = 720, H = 280, L = 48, R = 18, T = 18, B = 46;
  const series = bloque.series || [];
  if (!series.length) return null;
  const { cats, allNum } = ejeX(series);
  const ys = series.flatMap((s) => s.puntos.map((p) => p.y));
  const piso = (bloque.limite != null) ? bloque.limite * 1.2 : (Math.max(0, ...ys.filter((v) => v != null)) || 1);
  const ymax = ejeMax(ys, bloque.limite, piso);
  const Y = (v) => T + (1 - v / ymax) * (H - T - B);
  // X categórico: cada categoría a un slot equiespaciado (líneas y barras).
  const n = Math.max(cats.length, 1);
  const innerW = W - L - R;
  const xAt = (i) => L + (n === 1 ? innerW / 2 : (i + 0.5) * (innerW / n));
  const catIdx = new Map(cats.map((c, i) => [String(c), i]));

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  // Cuadrícula + ticks Y dinámicos.
  for (const g of ticksY(ymax)) {
    const yy = Y(g);
    svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: COL.grid, 'stroke-width': 1 }));
    tx(svg, L - 8, yy + 4, String(+g.toFixed(2)), { 'text-anchor': 'end' });
  }
  // Línea guía (ámbar) y límite (rojo).
  if (bloque.guia != null && bloque.guia <= ymax) {
    svg.appendChild(el('line', { x1: L, y1: Y(bloque.guia), x2: W - R, y2: Y(bloque.guia), stroke: COL.guide, 'stroke-width': 1, 'stroke-dasharray': '5 4', opacity: 0.6 }));
  }
  if (bloque.limite != null && bloque.limite <= ymax) {
    svg.appendChild(el('line', { x1: L, y1: Y(bloque.limite), x2: W - R, y2: Y(bloque.limite), stroke: COL.lim, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
    tx(svg, W - R, Y(bloque.limite) - 4, `límite ${bloque.limite}${bloque.unidad ? ' ' + bloque.unidad : ''}`, { 'text-anchor': 'end', fill: COL.lim, 'font-size': 9 });
  }
  // Etiquetas eje X (si son pocas o números, todas; si muchas, cada k).
  const paso = Math.ceil(cats.length / 18) || 1;
  cats.forEach((c, i) => { if (i % paso === 0) tx(svg, xAt(i), H - B + 20, String(c), { 'text-anchor': 'middle', 'font-size': 10 }); });
  if (bloque.eje_x) tx(svg, (L + W - R) / 2, H - 6, bloque.eje_x, { 'text-anchor': 'middle', 'font-size': 10, fill: COL.ink });
  if (bloque.unidad) tx(svg, L - 8, T - 6, bloque.unidad, { 'text-anchor': 'end', 'font-size': 9 });

  const esBarra = bloque.grafica === 'barra';
  series.forEach((s, si) => {
    const color = s.color || PALETA[si % PALETA.length];
    const pts = s.puntos.filter((p) => p.y != null).map((p) => ({ i: catIdx.get(String(p.x)), x: p.x, y: p.y }))
      .filter((p) => p.i != null);
    if (esBarra) {
      const bw = Math.min((innerW / n) * 0.7 / series.length, 26);
      pts.forEach((p) => {
        const cx = xAt(p.i) - (series.length * bw) / 2 + si * bw + bw / 2;
        const yy = Y(p.y), h = (H - T - B) - (yy - T);
        const rect = el('rect', { x: cx - bw / 2, y: yy, width: bw, height: Math.max(h, 0), rx: 2, fill: color });
        hookTip(rect, `<b>${esc(s.nombre)}</b> · ${esc(p.x)}<br>${esc(p.y)}${bloque.unidad ? ' ' + esc(bloque.unidad) : ''}`);
        svg.appendChild(rect);
      });
    } else {
      // línea (o dispersión): polilínea + puntos.
      if (bloque.grafica !== 'dispersion' && pts.length > 1) {
        const d = pts.map((p) => `${xAt(p.i)},${Y(p.y)}`).join(' ');
        svg.appendChild(el('polyline', { points: d, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      }
      pts.forEach((p) => {
        const dot = el('circle', { cx: xAt(p.i), cy: Y(p.y), r: 3.6, fill: color });
        hookTip(dot, `<b>${esc(s.nombre)}</b> · ${esc(p.x)}<br>${esc(p.y)}${bloque.unidad ? ' ' + esc(bloque.unidad) : ''}`);
        svg.appendChild(dot);
      });
    }
  });

  // Leyenda (multi-serie).
  if (series.length > 1) {
    let lx = L;
    series.forEach((s, si) => {
      const color = s.color || PALETA[si % PALETA.length];
      svg.appendChild(el('rect', { x: lx, y: T - 12, width: 12, height: 4, rx: 2, fill: color }));
      const t = tx(svg, lx + 16, T - 8, s.nombre, { 'font-size': 9, fill: COL.ink });
      lx += 18 + Math.min(s.nombre.length * 6 + 14, 130);
      void t;
    });
  }
  return svg;
}

/* ─── Tabla de detalle del bloque ────────────────────────────── */
function tablaBloque(tabla) {
  if (!tabla || (!tabla.filas.length && !tabla.columnas.length)) return '';
  const head = tabla.columnas.length
    ? `<thead><tr>${tabla.columnas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : '';
  const body = `<tbody>${tabla.filas.map((f) => `<tr>${f.map((c) => `<td class="num">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="tblwrap"><table class="dt">${head}${body}</table></div>`;
}

const BADGE = (calif) => {
  const c = String(calif || '').toLowerCase();
  let cls = 'b-n';
  if (['bueno', 'ok', 'normal', 'favorable'].includes(c)) cls = 'b-g';
  else if (['investigar', 'revisar', 'verificar'].includes(c)) cls = 'b-a';
  else if (['excesivo', 'fuera', 'bajo', 'alto', 'pobre'].includes(c)) cls = 'b-r';
  return calif ? `<span class="badge ${cls}">${esc(calif)}</span>` : '';
};

/**
 * Renderiza UN bloque como tarjeta (título + gráfica + observaciones + tabla).
 * @param {object} bloque  bloque ya sanitizado
 * @returns {HTMLElement}
 */
export function renderBloque(bloque) {
  const card = document.createElement('section');
  card.className = 'pe-bloque';
  const norm = bloque.prueba ? `<span class="norm">${esc(bloque.prueba)}</span>` : '';
  let html = `<h2>${esc(bloque.titulo)} ${BADGE(bloque.calif)} ${norm}</h2>`;
  if (bloque.observaciones) html += `<div class="callout">${esc(bloque.observaciones)}</div>`;
  html += `<div class="chartbox" data-chart></div>`;
  html += tablaBloque(bloque.tabla);
  card.innerHTML = html;
  const chart = card.querySelector('[data-chart]');
  const svg = svgBloque(bloque);
  if (svg) chart.appendChild(svg); else chart.remove();
  return card;
}

/**
 * Monta todos los bloques en un contenedor (limpia antes).
 * @param {HTMLElement} cont
 * @param {object|Array} data  resultado de sanitizarBloques ({bloques}) o el arreglo
 */
export function mountBloques(cont, data) {
  if (!cont) return;
  const bloques = Array.isArray(data) ? data : (data && data.bloques) || [];
  cont.innerHTML = '';
  if (!bloques.length) {
    cont.innerHTML = '<p class="muted small">Sin bloques de análisis para esta unidad.</p>';
    return;
  }
  for (const b of bloques) cont.appendChild(renderBloque(b));
}
