// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Panel de Factor de Potencia / Tan δ (devanados)
// ──────────────────────────────────────────────────────────────
// Vista ÚNICA y CONDENSADA del tan δ de devanados (ADR-029): una sola gráfica
// con panel de filtros (año/informe · grupo de conexión · tensión de prueba ·
// devanado/sección) y dos vistas:
//   · TENDENCIA año tras año (barras): eje X = informe en el tiempo, barras por
//     sección (color por sección), la misma sección alineada entre años para leer
//     su evolución. Cada barra vs límite 1% / guía 0.5%.
//   · COMPARAR por sección (barras): eje X = sección, barras por informe.
// El director: "todo el tan δ se condensa AQUÍ, no más gráficas de tan δ".
//
// Ambas vistas tienen render de barras propio: "tendencia" (eje temporal) y "por
// devanado" (eje X = sección, leyenda limpia por informe + criterio normativo).
// Sin estado global; el estado de filtros vive en la closure del panel. DOM puro;
// testeable el helper `devanadoDe`.
// ══════════════════════════════════════════════════════════════

// Paleta EJECUTIVA / gerencial: tonos sobrios y diferenciables (azules, verdeazulados,
// pizarra, tierra apagada) — sin colores chillones, apta para reportería de dirección.
const COLORES = ['#1f3a5f', '#2c6e72', '#6d597a', '#a4694f', '#46734b', '#5d6d7e', '#7a5c4b', '#355c7d', '#4a7c59', '#8c5a6e'];
const PAL_SEC = ['#1f3a5f', '#2c6e72', '#a4694f', '#6d597a', '#46734b', '#5d6d7e', '#355c7d', '#8c5a3f', '#4a7c59', '#7a5c6e', '#2f5b66', '#9a7b46', '#566b8a', '#6b4f59'];
// Criterio normativo del factor de potencia / tan δ de aislamiento de devanados.
// IEEE Std 62 / C57.152: tan δ corregido a 20 °C ≤ 0.5% es típico de aislamiento
// nuevo/sano (guía); > 1% se considera deteriorado y exige investigación (límite).
const CRIT = { limite: 1, guia: 0.5, norma: 'IEEE 62 / C57.152' };
// Catálogo MULTI-NORMA del tan δ (espejo del motor `pruebas_electricas_multinorma.js`):
// NETA es la más estricta (≤0.5% = guía); IEEE marca el límite de deterioro (≤1%).
// Cada barra/medición se evalúa contra AMBAS (veredicto conservador). `acron` se usa
// en el sello/emblema; son emblemas ESTILIZADOS propios (no los logotipos oficiales
// registrados — evita uso de marca de terceros), con la referencia exacta al estándar.
const NORMAS_TAND = [
  { id: 'neta', acron: 'NETA', nom: 'ANSI/NETA', sub: 'ATS · Tabla 100.3', umbral: 0.5, criterio: '≤ 0.5%', color: '#2c6e72' },
  { id: 'ieee', acron: 'IEEE', nom: 'IEEE', sub: 'Std 62 / C57.152', umbral: 1, criterio: '≤ 1%', color: '#1f3a5f' },
];
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NS = 'http://www.w3.org/2000/svg';
const el = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };

// Devanado al que pertenece una sección de aislamiento (1ª letra del foco tras la C).
export function devanadoDe(sec) {
  const s = String(sec).toUpperCase();
  if (s.includes('+')) return 'Combinadas';
  if (/^C?H/.test(s)) return 'AT (H)';
  if (/^C?L/.test(s)) return 'MT/BT (L)';
  if (/^C?T/.test(s)) return 'Terciario (T)';
  return 'Otras';
}

const chip = (txt, on, onClick, color) => {
  const b = document.createElement('button'); b.type = 'button';
  b.className = 'pe-fase-chip' + (on ? ' is-on' : ''); b.textContent = txt;
  if (color) b.style.setProperty('--c', color);
  b.dataset.k = txt;
  b.addEventListener('click', () => onClick(b)); return b;
};

// Emblema/sello ESTILIZADO de una norma (medalla de certificación) — símbolo propio,
// no el logotipo registrado. SVG inline (sin red, sin dependencias).
function medallaNorma(color, acron) {
  const s = el('svg', { viewBox: '0 0 48 58', width: '44', height: '54', 'aria-hidden': 'true' });
  s.appendChild(el('path', { d: 'M17 39 L13 56 L24 50 L35 56 L31 39 Z', fill: color, opacity: '0.85' }));
  s.appendChild(el('circle', { cx: '24', cy: '22', r: '20', fill: '#fff', stroke: color, 'stroke-width': '2.5' }));
  s.appendChild(el('circle', { cx: '24', cy: '22', r: '15.5', fill: 'none', stroke: color, 'stroke-width': '1', opacity: '0.45' }));
  const t = el('text', { x: '24', y: '26', 'text-anchor': 'middle', 'font-size': acron.length > 4 ? '8.5' : '10.5', 'font-weight': '800', fill: color, 'font-family': 'system-ui, sans-serif' });
  t.textContent = acron; s.appendChild(t);
  return s;
}

// Análisis MULTI-NORMA de tan δ a partir de las mediciones VISIBLES (filtros activos).
// Puro y testeable: no toca el DOM, solo agrega y clasifica datos REALES (sin inventar).
// @returns {null|{M, peor, porNorma, tendencia}}
export function analizarTand(repsVis, secs, tens) {
  const M = [];
  (repsVis || []).forEach((r) => (tens || []).forEach((t) => {
    const s = r.bloque.series.find((x) => x.nombre === t); if (!s) return;
    (secs || []).forEach((sec) => { const p = s.puntos.find((pp) => String(pp.x) === sec); if (p && typeof p.y === 'number') M.push({ rep: r, sec, tension: t, y: p.y }); });
  }));
  if (!M.length) return null;
  const peor = M.reduce((a, b) => (b.y > a.y ? b : a));
  const porNorma = NORMAS_TAND.map((nm) => {
    const cumplen = M.filter((m) => m.y <= nm.umbral).length;
    return { nm, cumplen, superan: M.length - cumplen, total: M.length };
  });
  const porRep = (repsVis || []).map((r) => { const ys = M.filter((m) => m.rep.id === r.id).map((m) => m.y); return ys.length ? { rep: r, max: Math.max(...ys) } : null; }).filter(Boolean);
  let tendencia = null;
  if (porRep.length >= 2) { const ini = porRep[0], fin = porRep[porRep.length - 1], d = fin.max - ini.max;
    tendencia = { ini, fin, delta: d, dir: Math.abs(d) < 0.03 ? 'estable' : d > 0 ? 'al alza' : 'a la baja' }; }
  return { M, peor, porNorma, tendencia };
}

// Pinta el bloque "Análisis conforme a norma" (sellos + veredicto por norma + conclusión).
function renderAnalisis(box, datos) {
  box.innerHTML = '';
  if (!datos) { box.innerHTML = '<p class="muted small">Sin mediciones para analizar con los filtros activos.</p>'; return; }
  const { M, peor, porNorma, tendencia } = datos;
  const card = document.createElement('div'); card.className = 'pe-analisis';
  const head = document.createElement('div'); head.className = 'pe-analisis-head';
  head.innerHTML = `<span>Análisis conforme a norma</span><span class="pe-analisis-n">${M.length} mediciones evaluadas</span>`;
  card.appendChild(head);
  const sellos = document.createElement('div'); sellos.className = 'pe-sellos';
  porNorma.forEach(({ nm, cumplen, superan, total }) => {
    const c = document.createElement('div'); c.className = 'pe-sello-card'; c.style.setProperty('--c', nm.color);
    c.appendChild(medallaNorma(nm.color, nm.acron));
    const cls = superan === 0 ? 'ok' : (cumplen / total >= 0.8 ? 'warn' : 'bad');
    const info = document.createElement('div'); info.className = 'pe-sello-info';
    info.innerHTML =
      `<div class="pe-sello-nom">${esc(nm.nom)}</div>` +
      `<div class="pe-sello-sub">${esc(nm.sub)}</div>` +
      `<div class="pe-sello-crit">tan δ ${esc(nm.criterio)}</div>` +
      `<div class="pe-sello-res pe-${cls}"><b>${cumplen}/${total}</b> cumplen${superan ? ` · ${superan} sobre criterio` : ''}</div>`;
    c.appendChild(info); sellos.appendChild(c);
  });
  card.appendChild(sellos);
  let nivel, frase;
  if (peor.y <= 0.5) { nivel = 'ok'; frase = 'Aislamiento SANO: todas las mediciones cumplen incluso el criterio más estricto (NETA ≤ 0.5%).'; }
  else if (peor.y <= 1) { nivel = 'warn'; const band = M.filter((m) => m.y > 0.5).length;
    frase = `Conforme a IEEE (≤ 1%): todas las mediciones pasan. ${band} medición(es) en 0.5–1% (zona de investigación IEEE / sobre el criterio NETA): vigilar tendencia.`; }
  else { nivel = 'bad'; const sup = M.filter((m) => m.y > 1).length;
    frase = `Atención: ${sup} medición(es) SUPERAN el límite IEEE (≤ 1%) — aislamiento posiblemente deteriorado, requiere investigación.`; }
  const concl = document.createElement('div'); concl.className = `pe-conclusion pe-${nivel}`;
  const l1 = document.createElement('div'); l1.className = 'pe-concl-frase'; l1.textContent = frase;
  const l2 = document.createElement('div'); l2.className = 'pe-concl-meta';
  l2.textContent = `Peor medición: ${peor.y}% · ${peor.sec} · ${peor.rep.label}${peor.rep.config ? ' (' + peor.rep.config + ')' : ''} · ${peor.tension}.` +
    (tendencia ? ` Tendencia del peor caso: ${tendencia.ini.max}% (${tendencia.ini.rep.label}) → ${tendencia.fin.max}% (${tendencia.fin.rep.label}) · ${tendencia.dir}.` : '');
  concl.append(l1, l2); card.appendChild(concl);
  box.appendChild(card);
}

/**
 * Monta el panel de tan δ en `cont`.
 * @param {HTMLElement} cont
 * @param {Array<{id:string,label:string,ano:(number|null),config:string,bloque:object}>} items
 *   Un item por INFORME que tenga bloque tan δ (prueba 'tand'); `bloque` con series
 *   (tensiones de prueba) cuyos puntos son {x: sección, y: %}.
 */
export function montarPanelTand(cont, items) {
  const reps = (Array.isArray(items) ? items : [])
    .filter((it) => it && it.bloque && (it.bloque.series || []).some((s) => (s.puntos || []).some((p) => typeof p.y === 'number')))
    .map((it) => ({ ...it }));
  if (!reps.length) { cont.innerHTML = '<p class="muted small">Aún no hay tan δ de devanados extraído para esta unidad.</p>'; return; }
  reps.forEach((r, i) => { r.color = r.color || COLORES[i % COLORES.length]; r.config = r.config || ''; });

  const tensiones = [...new Set(reps.flatMap((r) => r.bloque.series.map((s) => s.nombre)))].sort();
  const secciones = [...new Set(reps.flatMap((r) => r.bloque.series.flatMap((s) => s.puntos.map((p) => String(p.x)))))];
  const grupos = [...new Set(reps.map((r) => r.config).filter(Boolean))];
  const ORDEN_DEV = ['AT (H)', 'MT/BT (L)', 'Terciario (T)', 'Combinadas', 'Otras'];
  const seccPorDev = ORDEN_DEV.map((d) => ({ dev: d, secs: secciones.filter((s) => devanadoDe(s) === d) })).filter((g) => g.secs.length);

  const sel = { rep: new Set(reps.map((r) => r.id)), grupo: new Set(grupos), tension: new Set(tensiones), seccion: new Set(secciones) };
  // POR DEFECTO: DEVANADOS en el eje X (cada sección rotulada = precisión sobre qué
  // devanado es y contra qué, sin suponer por color) — el director lo prefiere así.
  let modo = 'seccion';

  cont.innerHTML = '';
  // ── Tarjeta de filtros ───────────────────────────────────
  const card = document.createElement('div'); card.className = 'pe-filtros';
  const head = document.createElement('div'); head.className = 'pe-filtros-head';
  head.innerHTML = '<span class="ttl"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>Filtros</span>';
  const reset = document.createElement('button'); reset.className = 'pe-reset'; reset.textContent = 'Restablecer';
  head.appendChild(reset); card.appendChild(head);

  const cap = Object.assign(document.createElement('p'), { className: 'muted small', style: 'margin:2px 0 8px' });
  const chartBox = document.createElement('div'); chartBox.className = 'chartbox';
  const analisisBox = document.createElement('div'); analisisBox.className = 'pe-analisis-box';

  const repsVisibles = () => reps.filter((r) => sel.rep.has(r.id) && (!grupos.length || sel.grupo.has(r.config)));
  const seccionesVis = () => secciones.filter((s) => sel.seccion.has(s));
  const tensionesVis = () => tensiones.filter((t) => sel.tension.has(t));
  const contadores = [];

  // Vista TENDENCIA año tras año (barras): eje X = informe en el tiempo.
  function svgTendencia(secs, tensList, repsVis) {
    if (!repsVis.length || !secs.length || !tensList.length) return null;
    const xs = repsVis, lines = [];
    secs.forEach((sec, sIdx) => { const color = PAL_SEC[sIdx % PAL_SEC.length];
      tensList.forEach((t, tIdx) => { const pts = [];
        xs.forEach((r, i) => { const s = r.bloque.series.find((x) => x.nombre === t); const p = s && s.puntos.find((pp) => String(pp.x) === sec); if (p && typeof p.y === 'number') pts.push({ i, value: p.y }); });
        if (pts.length) lines.push({ sec, tension: t, color, dash: tIdx > 0, pts });
      }); });
    if (!lines.length) return null;
    const allY = lines.flatMap((l) => l.pts.map((p) => p.value));
    const W = 920, H = 340, L = 54, R = 16, T = 24, B = 60;
    const ymax = Math.max(Math.max(...allY) * 1.12, 1.05);
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    const n = xs.length, innerW = W - L - R, X = (i) => L + (n === 1 ? innerW / 2 : (i + 0.5) * (innerW / n));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, yy = Y(v); svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: '#e7ebf0' }));
      const tx = el('text', { x: L - 8, y: yy + 4, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = v.toFixed(2); svg.appendChild(tx); }
    [[1, '#c0392b', 'límite 1%'], [0.5, '#b07d12', 'guía 0.5%']].forEach(([v, c, lbl]) => { if (v <= ymax) {
      svg.appendChild(el('line', { x1: L, y1: Y(v), x2: W - R, y2: Y(v), stroke: c, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
      const tx = el('text', { x: W - R, y: Y(v) - 4, fill: c, 'font-size': 9, 'text-anchor': 'end' }); tx.textContent = lbl; svg.appendChild(tx); } });
    xs.forEach((r, i) => { const tx = el('text', { x: X(i), y: H - B + 18, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = r.label; svg.appendChild(tx); });
    svg.appendChild(Object.assign(el('text', { x: (L + W - R) / 2, y: H - 6, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle' }), { textContent: 'Año / informe →' }));
    const nCombos = lines.length, slotW = innerW / Math.max(n, 1), bw = Math.min(slotW * 0.84 / Math.max(nCombos, 1), 16), y0 = Y(0);
    lines.forEach((l, k) => { l.pts.forEach((p) => {
      const cx = X(p.i) - (nCombos * bw) / 2 + (k + 0.5) * bw, yy = Y(p.value);
      const rect = el('rect', { x: cx - bw / 2, y: yy, width: Math.max(bw - 0.5, 1), height: Math.max(y0 - yy, 0), fill: l.color, rx: 1 });
      if (l.dash) rect.setAttribute('opacity', '0.5');
      rect.appendChild(el('title', {})).textContent = `${l.sec} · ${l.tension} · ${xs[p.i].label}: ${p.value}%`;
      svg.appendChild(rect); }); });
    let lx = L; secs.forEach((sec, sIdx) => { if (!lines.some((l) => l.sec === sec) || lx > W - 90) return; const color = PAL_SEC[sIdx % PAL_SEC.length];
      svg.appendChild(el('rect', { x: lx, y: T - 16, width: 12, height: 4, rx: 2, fill: color }));
      const t = el('text', { x: lx + 16, y: T - 12, fill: '#5b6876', 'font-size': 9 }); t.textContent = sec; svg.appendChild(t); lx += 22 + sec.length * 6; });
    return svg;
  }

  // Vista POR DEVANADO (barras): eje X = sección de aislamiento ROTULADA, barras por
  // informe (color por INFORME, no por informe×tensión → leyenda limpia). Cada barra
  // se evalúa vs el criterio normativo (CRIT): dentro de norma / sobre guía / supera
  // límite. Devuelve {svg, total, sobre, guia} para que el caption cite el veredicto.
  function svgPorDevanado(secs, tensList, repsVis) {
    if (!repsVis.length || !secs.length || !tensList.length) return null;
    // Combos (informe × tensión) que aportan al menos una barra; color SIEMPRE por informe.
    const combos = [];
    repsVis.forEach((r) => tensList.forEach((t, tIdx) => {
      const s = r.bloque.series.find((x) => x.nombre === t);
      if (s && secs.some((sec) => { const p = s.puntos.find((pp) => String(pp.x) === sec); return p && typeof p.y === 'number'; }))
        combos.push({ rep: r, tension: t, tenue: tIdx > 0, color: r.color });
    }));
    if (!combos.length) return null;
    const allY = [];
    secs.forEach((sec) => combos.forEach((c) => { const s = c.rep.bloque.series.find((x) => x.nombre === c.tension); const p = s && s.puntos.find((pp) => String(pp.x) === sec); if (p && typeof p.y === 'number') allY.push(p.y); }));
    if (!allY.length) return null;
    const W = 920, L = 54, R = 16, B = 60;
    // Leyenda LIMPIA por informe (un swatch por informe, envuelta en filas).
    const repsConDato = repsVis.filter((r) => combos.some((c) => c.rep.id === r.id));
    const legItems = repsConDato.map((r) => ({ color: r.color, txt: `${r.label}${r.config ? ' · ' + r.config : ''}` }));
    const legRows = []; let row = [], lx = L;
    legItems.forEach((it) => { const w = 18 + it.txt.length * 6 + 16; if (lx + w > W - R && row.length) { legRows.push(row); row = []; lx = L; } row.push({ ...it, x: lx }); lx += w; });
    if (row.length) legRows.push(row);
    const tensNote = tensList.length > 1;
    const T = legRows.length * 16 + (tensNote ? 16 : 4) + 10, H = T + 250;
    const ymax = Math.max(Math.max(...allY) * 1.12, 1.05);
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    const n = secs.length, innerW = W - L - R, X = (i) => L + (i + 0.5) * (innerW / n);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
    // Leyenda por informe.
    legRows.forEach((r, ri) => { const y = 12 + ri * 16; r.forEach((it) => {
      svg.appendChild(el('rect', { x: it.x, y: y - 8, width: 11, height: 11, rx: 2, fill: it.color }));
      const tx = el('text', { x: it.x + 16, y: y + 1, fill: '#5b6876', 'font-size': 10 }); tx.textContent = it.txt; svg.appendChild(tx); }); });
    if (tensNote) { const ty = 12 + legRows.length * 16; const tx = el('text', { x: L, y: ty, fill: '#8a97a5', 'font-size': 9 }); tx.textContent = `Tensión de prueba — barra llena: ${tensList[0]} · barra tenue: ${tensList[1]}`; svg.appendChild(tx); }
    // Rejilla + eje Y.
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, yy = Y(v); svg.appendChild(el('line', { x1: L, y1: yy, x2: W - R, y2: yy, stroke: '#e7ebf0' }));
      const tx = el('text', { x: L - 8, y: yy + 4, fill: '#8a97a5', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = v.toFixed(2); svg.appendChild(tx); }
    // Líneas de criterio normativo (rotuladas con la norma).
    [[CRIT.limite, '#c0392b', `límite ${CRIT.limite}% · ${CRIT.norma}`], [CRIT.guia, '#b07d12', `guía ${CRIT.guia}%`]].forEach(([v, c, lbl]) => { if (v <= ymax) {
      svg.appendChild(el('line', { x1: L, y1: Y(v), x2: W - R, y2: Y(v), stroke: c, 'stroke-width': 1, 'stroke-dasharray': '5 4' }));
      const tx = el('text', { x: W - R, y: Y(v) - 4, fill: c, 'font-size': 9, 'text-anchor': 'end' }); tx.textContent = lbl; svg.appendChild(tx); } });
    // Etiquetas de sección (eje X) + título.
    secs.forEach((sec, i) => { const tx = el('text', { x: X(i), y: H - B + 18, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono, monospace' }); tx.textContent = sec; svg.appendChild(tx); });
    svg.appendChild(Object.assign(el('text', { x: (L + W - R) / 2, y: H - 6, fill: '#5b6876', 'font-size': 10, 'text-anchor': 'middle' }), { textContent: 'Sección de aislamiento (devanado vs devanado) →' }));
    // Barras (agrupadas por sección) + veredicto normativo por barra.
    const slotW = innerW / Math.max(n, 1), nb = combos.length, bw = Math.min(slotW * 0.82 / Math.max(nb, 1), 18), y0 = Y(0);
    let total = 0, sobre = 0, enGuia = 0;
    secs.forEach((sec, i) => { combos.forEach((c, k) => {
      const s = c.rep.bloque.series.find((x) => x.nombre === c.tension); const p = s && s.puntos.find((pp) => String(pp.x) === sec);
      if (!p || typeof p.y !== 'number') return;
      total++; const over = p.y > CRIT.limite, warn = !over && p.y > CRIT.guia; if (over) sobre++; else if (warn) enGuia++;
      const cx = X(i) - (nb * bw) / 2 + (k + 0.5) * bw, yy = Y(p.y);
      const rect = el('rect', { x: cx - bw / 2, y: yy, width: Math.max(bw - 1, 1), height: Math.max(y0 - yy, 0), fill: over ? '#c0392b' : c.color, rx: 1 });
      if (c.tenue) rect.setAttribute('opacity', '0.55');
      if (over) { rect.setAttribute('stroke', '#7f1d1d'); rect.setAttribute('stroke-width', '1'); }
      const estado = over ? 'SUPERA límite (1%)' : warn ? 'sobre guía (0.5%)' : 'dentro de norma';
      rect.appendChild(el('title', {})).textContent = `${sec} · ${c.rep.label}${c.rep.config ? ' · ' + c.rep.config : ''} · ${c.tension}: ${p.y}% — ${estado} [${CRIT.norma}]`;
      svg.appendChild(rect); }); });
    return { svg, total, sobre, guia: enGuia };
  }

  const pintar = () => {
    chartBox.innerHTML = '';
    const repsVis = repsVisibles(), secs = seccionesVis(), tens = tensionesVis();
    let svg = null;
    if (modo === 'tendencia') {
      svg = svgTendencia(secs, tens, repsVis);
      cap.textContent = `Tendencia año tras año: eje X = informe (en el tiempo), BARRAS por sección (color por sección) — la misma sección queda alineada entre años para leer su evolución. ${tens.length > 1 ? 'Tensión: barra llena = ' + tens[0] + ', tenue = ' + tens[1] + '. ' : ''}Criterio ${CRIT.norma}: guía ${CRIT.guia}% / límite ${CRIT.limite}%.`;
    } else {
      const r = svgPorDevanado(secs, tens, repsVis);
      svg = r && r.svg;
      if (r) {
        const ok = r.total - r.sobre - r.guia;
        const partes = [`${ok}/${r.total} dentro de norma`];
        if (r.guia) partes.push(`${r.guia} sobre guía (>${CRIT.guia}%)`);
        if (r.sobre) partes.push(`${r.sobre} SUPERA límite (>${CRIT.limite}%, en rojo)`);
        cap.textContent = `Por devanado: eje X = sección de aislamiento ROTULADA (precisión de qué devanado es y contra qué); barras por informe (color por informe, ver leyenda${tens.length > 1 ? ' · 2 tensiones: llena/tenue' : ''}). Criterio ${CRIT.norma} — guía ${CRIT.guia}% / límite ${CRIT.limite}%. Veredicto: ${partes.join(' · ')}.`;
      }
    }
    if (svg) chartBox.appendChild(svg); else chartBox.innerHTML = '<p class="muted small">Sin datos para los filtros activos.</p>';
    renderAnalisis(analisisBox, analizarTand(repsVis, secs, tens));
    contadores.forEach((fn) => fn());
  };

  function grupoFiltro(label, gitems, setSel, opts = {}) {
    const g = document.createElement('div'); g.className = 'pe-fgrupo';
    const cab = document.createElement('div'); cab.className = 'pe-fgrupo-cab';
    cab.appendChild(Object.assign(document.createElement('span'), { className: 'pe-fgrupo-lbl', textContent: label }));
    const meta = document.createElement('div'); meta.className = 'pe-fgrupo-meta';
    const cnt = Object.assign(document.createElement('span'), { className: 'pe-fgrupo-cnt' });
    const todos = Object.assign(document.createElement('button'), { className: 'pe-fgrupo-todos', textContent: 'todos' });
    meta.append(cnt, todos); cab.appendChild(meta); g.appendChild(cab);
    const chipsWrap = document.createElement('div');
    const btns = new Map();
    const all = () => (opts.keys || gitems.map((it) => it.key ?? it));
    const onToggle = (key, btn) => { if (setSel.has(key)) { if (setSel.size > 1) setSel.delete(key); } else setSel.add(key); btn.classList.toggle('is-on', setSel.has(key)); pintar(); };
    if (opts.sub) {
      chipsWrap.className = 'pe-subsec';
      for (const sub of opts.sub) { const row = document.createElement('div'); row.className = 'pe-subsec-row';
        row.appendChild(Object.assign(document.createElement('span'), { className: 'pe-subsec-lbl', textContent: sub.dev }));
        sub.secs.forEach((s) => { const b = chip(s, setSel.has(s), (btn) => onToggle(s, btn)); btns.set(s, b); row.appendChild(b); });
        chipsWrap.appendChild(row); }
    } else {
      chipsWrap.className = 'pe-fgrupo-chips';
      if (opts.todosChip) { const tb = chip(opts.todosChip, setSel.size === all().length, () => { all().forEach((k) => setSel.add(k)); btns.forEach((b, k) => b.classList.toggle('is-on', setSel.has(k))); pintar(); });
        tb.style.fontWeight = '700'; tb.dataset.todos = '1'; chipsWrap.appendChild(tb); contadores.push(() => tb.classList.toggle('is-on', setSel.size === all().length)); }
      gitems.forEach((it) => { const key = it.key ?? it; const b = chip(it.label ?? it, setSel.has(key), (btn) => onToggle(key, btn), it.color); btns.set(key, b); chipsWrap.appendChild(b); });
    }
    g.appendChild(chipsWrap);
    todos.addEventListener('click', () => { const A = all(); const full = setSel.size === A.length; setSel.clear(); if (!full) A.forEach((k) => setSel.add(k)); else setSel.add(A[A.length - 1]); btns.forEach((b, k) => b.classList.toggle('is-on', setSel.has(k))); pintar(); });
    contadores.push(() => { cnt.textContent = `${setSel.size}/${all().length}`; });
    card.appendChild(g);
    return btns;
  }

  const bRep = grupoFiltro('Año / informe', reps.map((r) => ({ key: r.id, label: `${r.label}${r.config ? ' · ' + r.config : ''}`, color: r.color })), sel.rep, { keys: reps.map((r) => r.id), todosChip: 'Todos los años' });
  const bGr = grupos.length ? grupoFiltro('Grupo de conexión', grupos, sel.grupo, { keys: grupos }) : new Map();
  const bTen = grupoFiltro('Tensión de prueba', tensiones, sel.tension, { keys: tensiones });
  const bSec = grupoFiltro('Devanado / sección', null, sel.seccion, { sub: seccPorDev, keys: secciones });

  reset.addEventListener('click', () => {
    sel.rep = new Set(reps.map((r) => r.id)); sel.grupo = new Set(grupos); sel.tension = new Set(tensiones); sel.seccion = new Set(secciones);
    bRep.forEach((b, k) => b.classList.toggle('is-on', sel.rep.has(k)));
    bGr.forEach((b, k) => b.classList.toggle('is-on', sel.grupo.has(k)));
    bTen.forEach((b, k) => b.classList.toggle('is-on', sel.tension.has(k)));
    bSec.forEach((b, k) => b.classList.toggle('is-on', sel.seccion.has(k)));
    pintar();
  });

  // ── Toggle de vista ──────────────────────────────────────
  const vistaBar = document.createElement('div'); vistaBar.className = 'pe-fase-chips'; vistaBar.style.cssText = 'display:flex;gap:6px;align-items:center;margin:0 0 6px';
  vistaBar.appendChild(Object.assign(document.createElement('span'), { textContent: 'Vista:', style: 'font-size:12px;font-weight:600;color:#475569;margin-right:4px' }));
  const mkVista = (key, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pe-fase-chip' + (modo === key ? ' is-on' : ''); b.textContent = txt;
    b.addEventListener('click', () => { modo = key; [...vistaBar.querySelectorAll('.pe-fase-chip')].forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on'); pintar(); }); return b; };
  vistaBar.append(mkVista('seccion', 'Por devanado (secciones en X)'), mkVista('tendencia', 'Tendencia (años en X)'));

  cont.appendChild(card);
  cont.appendChild(vistaBar);
  cont.appendChild(cap);
  cont.appendChild(chartBox);
  cont.appendChild(analisisBox);
  pintar();
}
