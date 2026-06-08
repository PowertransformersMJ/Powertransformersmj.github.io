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
import { derivarTablaTAP } from '../../domain/pruebas_electricas_bloques.js';
import { ESTADOS } from '../../domain/pruebas_electricas_semaforo.js';
import { evaluarMultiNorma } from '../../domain/pruebas_electricas_multinorma.js';
import { recomendarPrueba } from '../../domain/pruebas_electricas_recomendaciones.js';

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

/* ─── Ticks para un rango arbitrario [lo,hi] (líneas con auto-rango) ─── */
function ticksRange(lo, hi, n) {
  const out = [], step = (hi - lo) / n;
  for (let i = 0; i <= n; i++) out.push(lo + step * i);
  return out;
}
const fmtTick = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)));

/* ─── Construye el SVG de un bloque ──────────────────────────── */
function svgBloque(bloque) {
  const W = 720, H = 280, L = 48, R = 18, T = 18, B = 46;
  const series = bloque.series || [];
  if (!series.length) return null;
  const { cats, allNum } = ejeX(series);
  const esBarra = bloque.grafica === 'barra';
  const ys = series.flatMap((s) => s.puntos.map((p) => p.y)).filter((v) => v != null);

  // Eje Y. Barras: base en 0 (comparación visual correcta). Líneas: AUTO-RANGE
  // a los datos (zoom) para que la variación real se vea, en vez de aplastar la
  // curva contra un eje desde 0 (curvas de TAP: excitación, relación, resistencia).
  let ymin, ymax, ticks;
  if (esBarra || ys.length < 2) {
    ymin = 0;
    const piso = (bloque.limite != null) ? bloque.limite * 1.2 : (Math.max(0, ...ys) || 1);
    ymax = ejeMax(ys, bloque.limite, piso);
    ticks = ticksY(ymax);
  } else {
    const dmin = Math.min(...ys), dmax = Math.max(...ys);
    const span = (dmax - dmin) || Math.abs(dmax) * 0.1 || 1;
    const pad = span * 0.15;
    ymin = dmin - pad; ymax = dmax + pad;
    // Incluir límite/guía en el rango SOLO si caen cerca de los datos (mismo
    // orden) — si no (p.ej. límite de desviación % vs valor de ratio), se omite
    // del eje de valores para no aplastar la curva.
    const cerca = (v) => v != null && v >= dmin - span && v <= dmax + span;
    if (cerca(bloque.limite)) ymax = Math.max(ymax, bloque.limite + pad * 0.5);
    if (cerca(bloque.guia)) ymin = Math.min(ymin, bloque.guia - pad * 0.5);
    ticks = ticksRange(ymin, ymax, 4);
  }
  const Y = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  // X categórico: cada categoría a un slot equiespaciado (líneas y barras).
  const n = Math.max(cats.length, 1);
  const innerW = W - L - R;
  const xAt = (i) => L + (n === 1 ? innerW / 2 : (i + 0.5) * (innerW / n));
  const catIdx = new Map(cats.map((c, i) => [String(c), i]));

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  // Patrón rayado (hatch) para valores marcados "a verificar" (confirmación
  // humana pendiente) — mismo lenguaje visual que la maqueta.
  const defs = el('defs', {});
  const pat = el('pattern', { id: 'peh-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pat.appendChild(el('rect', { width: 6, height: 6, fill: '#f1e2c0' }));
  pat.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: COL.guide, 'stroke-width': 2 }));
  defs.appendChild(pat); svg.appendChild(defs);
  // Cuadrícula + ticks Y dinámicos.
  for (const g of ticks) {
    const yy = Y(g);
    svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: COL.grid, 'stroke-width': 1 }));
    tx(svg, L - 8, yy + 4, fmtTick(g), { 'text-anchor': 'end' });
  }
  // Línea guía (ámbar) y límite (rojo) — solo si caen dentro del rango visible.
  const enRango = (v) => v != null && v >= ymin && v <= ymax;
  if (enRango(bloque.guia)) {
    svg.appendChild(el('line', { x1: L, y1: Y(bloque.guia), x2: W - R, y2: Y(bloque.guia), stroke: COL.guide, 'stroke-width': 1, 'stroke-dasharray': '5 4', opacity: 0.6 }));
  }
  if (enRango(bloque.limite)) {
    svg.appendChild(el('line', { x1: L, y1: Y(bloque.limite), x2: W - R, y2: Y(bloque.limite), stroke: COL.lim, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
    tx(svg, W - R, Y(bloque.limite) - 4, `límite ${bloque.limite}${bloque.unidad ? ' ' + bloque.unidad : ''}`, { 'text-anchor': 'end', fill: COL.lim, 'font-size': 9 });
  }
  // Etiquetas eje X (si son pocas o números, todas; si muchas, cada k).
  const paso = Math.ceil(cats.length / 18) || 1;
  cats.forEach((c, i) => { if (i % paso === 0) tx(svg, xAt(i), H - B + 20, String(c), { 'text-anchor': 'middle', 'font-size': 10 }); });
  if (bloque.eje_x) tx(svg, (L + W - R) / 2, H - 6, bloque.eje_x, { 'text-anchor': 'middle', 'font-size': 10, fill: COL.ink });
  if (bloque.unidad) tx(svg, L - 8, T - 6, bloque.unidad, { 'text-anchor': 'end', 'font-size': 9 });

  series.forEach((s, si) => {
    const color = s.color || PALETA[si % PALETA.length];
    const pts = s.puntos.filter((p) => p.y != null).map((p) => ({ i: catIdx.get(String(p.x)), x: p.x, y: p.y, verificar: p.verificar }))
      .filter((p) => p.i != null);
    const tipVerif = (p) => p.verificar ? ' <span style="color:#b07d12">(a verificar)</span>' : '';
    if (esBarra) {
      const bw = Math.min((innerW / n) * 0.7 / series.length, 26);
      // Etiqueta el valor sobre la barra solo en series únicas y pocas
      // categorías (en barras agrupadas se amontonan → se deja al tooltip).
      const etiquetar = series.length === 1 && cats.length <= 14;
      const fmtBar = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
      pts.forEach((p) => {
        const cx = xAt(p.i) - (series.length * bw) / 2 + si * bw + bw / 2;
        const yy = Y(p.y), h = (H - T - B) - (yy - T);
        const rect = el('rect', { x: cx - bw / 2, y: yy, width: bw, height: Math.max(h, 0), rx: 2, fill: p.verificar ? 'url(#peh-hatch)' : color });
        hookTip(rect, `<b>${esc(s.nombre)}</b> · ${esc(p.x)}<br>${esc(p.y)}${bloque.unidad ? ' ' + esc(bloque.unidad) : ''}${tipVerif(p)}`);
        svg.appendChild(rect);
        if (p.verificar) tx(svg, cx, yy - 5, '⚠', { 'text-anchor': 'middle', 'font-size': 10, fill: COL.guide });
        else if (etiquetar) tx(svg, cx, yy - 4, fmtBar(p.y), { 'text-anchor': 'middle', 'font-size': 9, fill: COL.ink });
      });
    } else {
      // línea (o dispersión): polilínea + puntos.
      if (bloque.grafica !== 'dispersion' && pts.length > 1) {
        const d = pts.map((p) => `${xAt(p.i)},${Y(p.y)}`).join(' ');
        svg.appendChild(el('polyline', { points: d, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      }
      pts.forEach((p) => {
        // "verificar" → punto hueco con anillo ámbar (señal de confirmación).
        const dot = p.verificar
          ? el('circle', { cx: xAt(p.i), cy: Y(p.y), r: 4, fill: '#fff', stroke: COL.guide, 'stroke-width': 2 })
          : el('circle', { cx: xAt(p.i), cy: Y(p.y), r: 3.6, fill: color });
        hookTip(dot, `<b>${esc(s.nombre)}</b> · ${esc(p.x)}<br>${esc(p.y)}${bloque.unidad ? ' ' + esc(bloque.unidad) : ''}${tipVerif(p)}`);
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

/* ─── Tabla por categoría derivada de las series (curvas sin tabla) ─── */
// Para las curvas por TAP (excitación/relación/resistencia) la IA pone los
// datos en `series`, no en `tabla`. Se arma la tabla "X | serie1 | serie2 …"
// (TAP | Fase A | Fase B | Fase C) para que TODOS los valores por posición
// sean visibles, no solo la curva.
function tablaDeSeries(bloque) {
  return derivarTablaTAP(bloque);
}

/* ─── Bloque derivado: desviación entre fases por categoría (TAP) ─── */
// La semántica del desbalance DIFIERE por prueba (física del transformador):
//  · EXCITACIÓN: la fase central es naturalmente MENOR (núcleo de 3 columnas);
//    el criterio IEEE compara las DOS corrientes más altas (laterales) → 1 línea.
//  · RELACIÓN / RESISTENCIA: las 3 fases deben ser iguales → se grafica la
//    desviación de CADA fase respecto al promedio entre fases (3 líneas) contra
//    la banda ±límite, para ver cuál fase se aparta y en qué TAP.
function bloqueDesviacion(bloque) {
  const series = bloque.series || [];
  const { cats } = ejeX(series);
  const mapas = series.map((s) => new Map((s.puntos || []).map((p) => [String(p.x), p.y])));
  const lim = bloque.limite_desbalance;

  if (bloque.prueba === 'excitacion') {
    const puntos = cats.map((c) => {
      const vals = mapas.map((m) => m.get(String(c))).filter((v) => v != null).sort((a, b) => b - a);
      if (vals.length < 2 || !vals[0]) return null;
      // Δ entre las dos laterales mayores, dividido entre la MAYOR (como el informe).
      return { x: c, y: +(((vals[0] - vals[1]) / Math.abs(vals[0])) * 100).toFixed(3) };
    }).filter(Boolean);
    return {
      titulo: 'Desviación entre fases laterales por TAP (%)',
      unidad: '%', eje_x: bloque.eje_x, grafica: 'linea', limite: lim,
      series: [{ nombre: 'Δ dos fases mayores', puntos }]
    };
  }

  // Si el informe YA reporta la desviación por fila (p.ej. relación trae "%DIF"
  // en `extra` = desviación vs placa/teórica), úsala DIRECTO: ESA es la que
  // corresponde al criterio (±X% vs placa). Solo si no existe se deriva la
  // desviación de cada fase vs el promedio entre fases (caso resistencia:
  // criterio "≤X% entre fases", sin %DIF en el informe).
  const devKey = extraDevKey(series);
  const devSeries = series.map((s, si) => {
    let puntos;
    if (devKey) {
      puntos = (s.puntos || [])
        .filter((p) => p.extra && typeof p.extra[devKey] === 'number')
        .map((p) => { const pt = { x: p.x, y: p.extra[devKey] }; if (p.verificar) pt.verificar = true; return pt; });
    } else {
      puntos = cats.map((c) => {
        const vals = mapas.map((m) => m.get(String(c))).filter((v) => v != null);
        const v = mapas[si].get(String(c));
        if (v == null || vals.length < 2) return null;
        const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (!prom) return null;
        const pt = { x: c, y: +(((v - prom) / Math.abs(prom)) * 100).toFixed(3) };
        const orig = (s.puntos || []).find((pp) => String(pp.x) === String(c));
        if (orig && orig.verificar) pt.verificar = true;
        return pt;
      }).filter(Boolean);
    }
    return { nombre: s.nombre, color: s.color, puntos };
  });
  return {
    titulo: devKey
      ? `Desviación por fase reportada (${devKey}) por TAP`
      : 'Desviación de cada fase vs promedio por TAP (%)',
    unidad: '%', eje_x: bloque.eje_x, grafica: 'linea',
    limite: lim != null ? lim : null,
    guia: lim != null ? -lim : null,   // banda ±límite
    series: devSeries
  };
}

/* ─── Bloque derivado: desviación GENERAL entre fases por TAP ─── */
// Una sola curva: el desbalance MÁXIMO entre fases en cada posición ((máx−mín)
// ÷ promedio × 100), contra el criterio de desbalance. Resume "de un vistazo"
// cuánto se separan las fases en todo el recorrido del conmutador y si en algún
// TAP roza el límite — complementa las 3 curvas por fase. Usado en resistencia.
function bloqueDesviacionGeneral(bloque) {
  const series = bloque.series || [];
  const { cats } = ejeX(series);
  const mapas = series.map((s) => new Map((s.puntos || []).map((p) => [String(p.x), p.y])));
  const puntos = cats.map((c) => {
    const vals = mapas.map((m) => m.get(String(c))).filter((v) => v != null);
    if (vals.length < 2) return null;
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (!prom) return null;
    const max = Math.max(...vals), min = Math.min(...vals);
    return { x: c, y: +(((max - min) / Math.abs(prom)) * 100).toFixed(3) };
  }).filter(Boolean);
  return {
    titulo: 'Desviación general entre fases por TAP (%)',
    unidad: '%', eje_x: bloque.eje_x, grafica: 'linea',
    limite: bloque.limite_desbalance,
    series: [{ nombre: 'Desbalance máx (máx−mín)/prom', puntos }]
  };
}

// Detecta una clave `extra` que YA es la desviación reportada por el informe
// (p.ej. "%DIF" en relación). Devuelve la clave o null.
const _DEV_KEY = /%?\s*dif|desviaci|\bdesv\b/i;
function extraDevKey(series) {
  for (const s of (series || [])) for (const p of (s.puntos || [])) {
    if (p.extra) for (const k of Object.keys(p.extra)) {
      if (typeof p.extra[k] === 'number' && _DEV_KEY.test(k)) return k;
    }
  }
  return null;
}

/* ─── Tabla de detalle del bloque ────────────────────────────── */
function tablaBloque(tabla) {
  if (!tabla || (!tabla.filas.length && !tabla.columnas.length)) return '';
  const head = tabla.columnas.length
    ? `<thead><tr>${tabla.columnas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : '';
  const body = `<tbody>${tabla.filas.map((f) => `<tr>${f.map((c) => `<td class="num">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="tblwrap"><table class="dt">${head}${body}</table></div>`;
}

/* ─── Detección de la dimensión "fase" de un bloque ──────────── */
// La fase puede vivir en las SERIES (curvas por TAP: una serie por fase) o en
// las CATEGORÍAS del eje X (barras: una barra por fase, p.ej. bujes H1/H2/H3,
// resistencia MT/BT por fase A/B/C). Detectamos dónde está para ofrecer el
// filtro por fase en CUALQUIER gráfica que tenga fases, no solo en las curvas.
function faseDe(label) {
  const s = String(label == null ? '' : label);
  const m = s.match(/fase\s*([abc])\b/i) || s.match(/^\s*([abc])\s*$/i);
  return m ? m[1].toUpperCase() : null;
}
// Devuelve { modo:'serie'|'cat'|null, fases:[{key,label,color}] }.
function detectarFases(bloque, cats) {
  const series = bloque.series || [];
  const fasesSerie = series.map((s) => faseDe(s.nombre)).filter(Boolean);
  if (fasesSerie.length >= 2) {
    const fases = series
      .map((s, i) => ({ key: String(i), label: s.nombre || `Serie ${i + 1}`, color: s.color || PALETA[i % PALETA.length] }))
      .filter((_, i) => faseDe(series[i].nombre));
    return { modo: 'serie', fases };
  }
  const mapa = new Map(); // 'A' → primer color asignado
  cats.forEach((c) => { const f = faseDe(c); if (f && !mapa.has(f)) mapa.set(f, null); });
  if (mapa.size >= 2) {
    const fases = [...mapa.keys()].sort().map((k, i) => ({ key: k, label: `Fase ${k}`, color: PALETA[i % PALETA.length] }));
    return { modo: 'cat', fases };
  }
  return { modo: null, fases: [] };
}

const BADGE = (calif) => {
  const c = String(calif || '').toLowerCase();
  let cls = 'b-n';
  if (['bueno', 'ok', 'normal', 'favorable'].includes(c)) cls = 'b-g';
  else if (['investigar', 'revisar', 'verificar'].includes(c)) cls = 'b-a';
  else if (['excesivo', 'fuera', 'bajo', 'alto', 'pobre'].includes(c)) cls = 'b-r';
  return calif ? `<span class="badge ${cls}">${esc(calif)}</span>` : '';
};

// Métrica peor-caso + familia + contexto de un bloque, para alimentar el motor
// multi-norma. NO usa el texto de la IA. Devuelve {family, valor, ctx} o null.
//   · aislamiento (invertir): mínimo medido (GΩ) + minClase = bloque.limite
//   · tan δ / bujes: peor tan δ medido (%)
//   · collar: peor pérdida (mW)
//   · curvas por TAP: peor desbalance entre fases (resistencia = (máx−mín)/prom;
//     excitación/relación = la desviación que ya grafica `bloqueDesviacion`)
function devMaxFamilia(bloque, family) {
  const dev = (family === 'resistencia') ? bloqueDesviacionGeneral(bloque) : bloqueDesviacion(bloque);
  const ds = (dev.series || []).flatMap((s) => (s.puntos || []).map((pt) => Math.abs(pt.y)))
    .filter((v) => typeof v === 'number');
  return ds.length ? Math.max(...ds) : null;
}
function metricaBloque(bloque) {
  if (!bloque) return null;
  const p = String(bloque.prueba || '').toLowerCase();
  const ys = (bloque.series || []).flatMap((s) => (s.puntos || []).map((pt) => pt.y))
    .filter((v) => typeof v === 'number');
  if (bloque.invertir === true || /aisl/.test(p)) {
    return ys.length ? { family: 'aislamiento', valor: Math.min(...ys), ctx: { minClase: bloque.limite != null ? bloque.limite : null } } : null;
  }
  if (/tan|tand/.test(p)) return ys.length ? { family: 'tand', valor: Math.max(...ys), ctx: {} } : null;
  if (/bushing|buje/.test(p)) return ys.length ? { family: 'bushing', valor: Math.max(...ys), ctx: {} } : null;
  if (/collar/.test(p)) return ys.length ? { family: 'collar', valor: Math.max(...ys), ctx: {} } : null;
  if (bloque.limite_desbalance != null) {
    let family = null;
    if (/excit/.test(p)) family = 'excitacion';
    else if (/relac/.test(p)) family = 'relacion';
    else if (/resist/.test(p)) family = 'resistencia';
    if (!family) return null;
    const v = devMaxFamilia(bloque, family);
    return v == null ? null : { family, valor: v, ctx: {} };
  }
  return null;
}

// Evaluación multi-norma del bloque (consolidado + ópticas por norma). null si
// no hay métrica reconocible.
function multiNormaBloque(bloque) {
  const m = metricaBloque(bloque);
  if (!m) return null;
  return evaluarMultiNorma(m.family, m.valor, m.ctx);
}

// Badge del bloque: veredicto CONSOLIDADO multi-norma (el más conservador). Cae
// al texto de la IA solo si no se puede derivar.
function badgeBloque(bloque) {
  const mn = multiNormaBloque(bloque);
  if (!mn || mn.consolidado === ESTADOS.NEUTRAL) return BADGE(bloque.calif);
  return `<span class="badge ${mn.consolidado.clase}">${esc(mn.consolidado.etiqueta)}</span>`;
}

// Panel "Evaluación multi-norma": una línea por norma con su umbral y veredicto,
// el consolidado y una nota si las normas divergen. Es el corazón del pedido del
// director: mostrar las distintas calificaciones según cada norma.
function panelMultiNorma(bloque) {
  const m = metricaBloque(bloque);
  if (!m) return '';
  const mn = evaluarMultiNorma(m.family, m.valor, m.ctx);
  if (!mn) return '';
  const filas = mn.opticas.map((o) => {
    const v = (o.estado && o.estado.nivel >= 0)
      ? `<span class="mn-v ${o.estado.clase}"><span class="dot ${o.estado.dot}"></span>${esc(o.estado.etiqueta)}</span>`
      : '<span class="mn-v muted small">—</span>';
    const nota = o.nota ? ` <span class="mn-nota">· ${esc(o.nota)}</span>` : '';
    return `<li><span class="mn-norma">${esc(o.norma)}</span><span class="mn-umbral">${esc(o.umbral || '')}</span>${v}${nota}</li>`;
  }).join('');
  const cons = mn.consolidado && mn.consolidado.nivel >= 0
    ? `<span class="mn-v ${mn.consolidado.clase}"><span class="dot ${mn.consolidado.dot}"></span>${esc(mn.consolidado.etiqueta)}</span>`
    : '—';
  const div = mn.divergen
    ? '<p class="mn-div">⊳ Las normas divergen — el consolidado toma el criterio más conservador (la seguridad pesa sobre el "pasa por poco").</p>'
    : '';
  // Sugerencia de diagnóstico (qué investigar / cómo determinar el estado),
  // conforme a la skill. Aparece siempre: aprueba → seguimiento; investigar/
  // rechaza/faltante → acción correlacionada.
  const rec = recomendarPrueba(m.family, { estado: mn.consolidado, divergen: mn.divergen });
  const recHtml = rec ? `<p class="mn-rec"><b>Recomendación</b> ${esc(rec)}</p>` : '';
  return `<div class="pe-multinorma"><div class="pe-mn-head">Evaluación multi-norma <span class="pe-mn-cons">consolidado: ${cons}</span></div>`
    + `<ul class="pe-mn-list">${filas}</ul>${div}${recHtml}</div>`;
}

/**
 * Monta una gráfica (chips de filtro por fase + SVG) para un bloque. El filtro
 * por fase opera sobre series (curvas) o categorías (barras), y se aplica a
 * CUALQUIER gráfica con fases — incluida la gráfica DERIVADA de desviación.
 * @param {object} bloque  bloque (o sub-bloque de desviación) a graficar
 * @returns {DocumentFragment} chips (si aplica) + chartbox
 */
function montarGrafica(bloque) {
  const frag = document.createDocumentFragment();
  const chipsBox = document.createElement('div');
  chipsBox.className = 'pe-fase-chips';
  const chart = document.createElement('div');
  chart.className = 'chartbox';
  const series = bloque.series || [];
  const { cats } = ejeX(series);
  const { modo, fases } = detectarFases(bloque, cats);
  const activas = new Set(fases.map((f) => f.key)); // fases visibles

  const pintar = () => {
    chart.innerHTML = '';
    let sub = bloque;
    if (modo === 'serie') {
      sub = { ...bloque, series: series.filter((_, i) => activas.has(String(i))) };
    } else if (modo === 'cat') {
      // Oculta los puntos cuya categoría es una fase no seleccionada; los puntos
      // sin fase (otras categorías) se conservan siempre.
      sub = {
        ...bloque,
        series: series.map((s) => ({
          ...s,
          puntos: (s.puntos || []).filter((p) => { const f = faseDe(p.x); return !f || activas.has(f); })
        }))
      };
    }
    const svg = svgBloque(sub);
    if (svg) chart.appendChild(svg);
  };

  if (modo) {
    fases.forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pe-fase-chip is-on';
      b.style.setProperty('--c', f.color);
      b.textContent = f.label;
      b.addEventListener('click', () => {
        if (activas.has(f.key)) { if (activas.size > 1) activas.delete(f.key); } // nunca dejar 0
        else activas.add(f.key);
        b.classList.toggle('is-on', activas.has(f.key));
        pintar();
      });
      chipsBox.appendChild(b);
    });
    frag.appendChild(chipsBox);
  }
  pintar();
  if (chart.firstChild) frag.appendChild(chart);
  return frag;
}

/* ─── Bloques derivados: magnitudes secundarias (extra) por fase ──────
 * Una curva por TAP puede traer, además del valor graficado, otras magnitudes
 * por punto en `extra`. TODAS van a la TABLA (derivarTablaTAP). Pero NO todas
 * merecen su propia gráfica: R.Ref ≈ R.Medida (duplicaría la curva principal),
 * Tensión/Relación teórica son entradas monótonas, %DIF ya es la desviación. Por
 * eso SOLO se grafica una magnitud DISTINTA y diagnóstica: la POTENCIA (su propia
 * escala, p.ej. excitación). Lista ampliable si surge otra magnitud graficable. */
const EXTRA_GRAFICABLE = /poten|\(\s*w\s*\)|\bk?w\b|\bk?va\b/i;
function bloquesDeExtra(bloque) {
  const series = bloque.series || [];
  const keys = []; const seen = new Set();
  for (const s of series) for (const p of (s.puntos || [])) {
    if (p.extra) for (const k of Object.keys(p.extra)) {
      if (typeof p.extra[k] === 'number' && EXTRA_GRAFICABLE.test(k) && !seen.has(k)) { seen.add(k); keys.push(k); }
    }
  }
  return keys.map((k) => ({
    key: k,
    bloque: {
      titulo: k, unidad: '', eje_x: bloque.eje_x, grafica: 'linea',
      series: series.map((s) => ({
        nombre: s.nombre, color: s.color,
        puntos: (s.puntos || []).filter((p) => p.extra && typeof p.extra[k] === 'number').map((p) => ({ x: p.x, y: p.extra[k] }))
      })).filter((s) => s.puntos.length)
    }
  })).filter((e) => e.bloque.series.length);
}

/* Subtítulo de una gráfica: QUÉ muestra (título) + QUÉ evalúa (sub). El director
 * pidió que cada gráfica detalle a qué corresponde y qué está evaluando. */
function chartCap(titulo, evalua) {
  const d = document.createElement('div');
  d.className = 'pe-chart-cap';
  d.innerHTML = `<span class="pe-chart-ttl">${esc(titulo)}</span>`
    + (evalua ? `<span class="pe-chart-sub">${esc(evalua)}</span>` : '');
  return d;
}
// "Qué evalúa" de la gráfica principal, derivado del criterio normativo del bloque.
function evaluaPrincipal(bloque) {
  const cr = bloque.criterio;
  if (cr && (cr.umbral || cr.norma)) return `Evalúa: ${[cr.umbral, cr.norma].filter(Boolean).join(' · ')}`;
  return '';
}

/**
 * Renderiza UN bloque como tarjeta (título + gráfica + observaciones + tabla).
 * @param {object} bloque  bloque ya sanitizado
 * @returns {HTMLElement}
 */
export function renderBloque(bloque) {
  const card = document.createElement('section');
  card.className = 'pe-bloque';
  const norm = bloque.prueba ? `<span class="norm">${esc(bloque.prueba)}</span>` : '';
  let html = `<h2>${esc(bloque.titulo)} ${badgeBloque(bloque)} ${norm}</h2>`;
  if (bloque.observaciones) {
    // Callout de hallazgo: ámbar ("Dato a verificar") cuando la calificación o
    // algún punto pide confirmación humana; "Análisis de la IA" si no.
    const algunVerif = (bloque.series || []).some((s) => (s.puntos || []).some((p) => p.verificar));
    const warn = algunVerif || /verificar|investigar|revisar|excesivo|fuera|alto|bajo|pobre/i.test(bloque.calif || '');
    html += `<div class="callout${warn ? ' warn' : ''}"><div class="ttl">${warn ? 'Dato a verificar' : 'Análisis de la IA'}</div><p style="margin:0">${esc(bloque.observaciones)}</p></div>`;
  }
  // Criterio VERIFICABLE: la fórmula aplicada + el panel MULTI-NORMA (veredicto
  // por cada norma + consolidado + divergencias). El veredicto sale del valor vs
  // la norma, no de la IA (L-36 / ADR-012). Si el bloque no tiene métrica
  // reconocible, cae al criterio único (umbral/norma) que adjunta el shell.
  const cr = bloque.criterio;
  if (cr && cr.formula) {
    html += `<div class="pe-criterio"><span class="pe-cr-item"><b>Fórmula</b> ${esc(cr.formula)}</span></div>`;
  }
  const panel = panelMultiNorma(bloque);
  if (panel) {
    html += panel;
  } else if (cr && (cr.umbral || cr.norma)) {
    html += '<div class="pe-criterio">'
      + (cr.umbral ? `<span class="pe-cr-item"><b>Criterio</b> ${esc(cr.umbral)}</span>` : '')
      + (cr.norma ? `<span class="pe-cr-item"><b>Norma</b> ${esc(cr.norma)}</span>` : '')
      + '</div>';
  }
  card.innerHTML = html;

  // Gráfica principal (subtítulo "qué muestra/qué evalúa" + chips de filtro + SVG).
  const ejeLabel = bloque.eje_x || 'posición';
  const magnitud = bloque.unidad ? `Valores (${bloque.unidad})` : 'Valores';
  card.appendChild(chartCap(
    `${magnitud} vs ${ejeLabel}`,
    evaluaPrincipal(bloque) || 'Evalúa la tendencia y la simetría entre fases.'
  ));
  card.appendChild(montarGrafica(bloque));

  // Gráfica DERIVADA de desviación entre fases (curvas por TAP con criterio de
  // desbalance). Pasa por montarGrafica → también es filtrable por fase
  // (relación/resistencia: 3 series de fase; excitación: 1 serie Δ, sin chips).
  const { modo } = detectarFases(bloque, ejeX(bloque.series || []).cats);
  if (modo === 'serie' && bloque.limite_desbalance != null) {
    const dev = bloqueDesviacion(bloque);
    if (dev.series.some((s) => s.puntos.length)) {
      const crit = dev.guia != null ? `±${bloque.limite_desbalance}%` : `≤ ${bloque.limite_desbalance}%`;
      const norma = bloque.criterio && bloque.criterio.norma ? ` (${bloque.criterio.norma})` : '';
      card.appendChild(chartCap(dev.titulo, `Evalúa el desbalance entre fases contra el criterio ${crit}${norma}.`));
      card.appendChild(montarGrafica(dev));
    }
    // Resistencia de devanados: además, una curva ÚNICA de desviación GENERAL
    // (desbalance máx entre fases por TAP) contra su criterio — el desbalance
    // entre fases es el criterio rector de esta prueba (IEEE 62.2 / C57.152).
    if (bloque.prueba === 'resistencia') {
      const gen = bloqueDesviacionGeneral(bloque);
      if (gen.series.some((s) => s.puntos.length)) {
        const norma = bloque.criterio && bloque.criterio.norma ? ` (${bloque.criterio.norma})` : '';
        card.appendChild(chartCap(gen.titulo,
          `Desbalance máximo entre fases en cada TAP contra el criterio ≤ ${bloque.limite_desbalance}%${norma}.`));
        card.appendChild(montarGrafica(gen));
      }
    }
  }

  // Gráficas DERIVADAS de magnitudes secundarias graficables (extra): p.ej.
  // Potencia (W) en excitación. Una curva multi-fase por su propia escala.
  for (const ex of bloquesDeExtra(bloque)) {
    card.appendChild(chartCap(`${ex.key} por fase`, 'Magnitud complementaria del informe, por fase.'));
    card.appendChild(montarGrafica(ex.bloque));
  }

  // Tabla: la propia del bloque (la IA la transcribe COMPLETA del informe) o,
  // para curvas sin tabla, una derivada de las series (valores por TAP).
  const tabla = (bloque.tabla && bloque.tabla.filas && bloque.tabla.filas.length)
    ? bloque.tabla
    : ((bloque.grafica !== 'barra') ? tablaDeSeries(bloque) : bloque.tabla);
  const tblHtml = tablaBloque(tabla);
  if (tblHtml) card.insertAdjacentHTML('beforeend', tblHtml);

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
