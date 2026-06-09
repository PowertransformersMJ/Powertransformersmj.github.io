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
// Reusa svgBloque para la vista "comparar". La vista "tendencia" tiene su propio
// render de barras (eje temporal). Sin estado global; el estado de filtros vive
// en la closure del panel. DOM puro; testeable el helper `devanadoDe`.
// ══════════════════════════════════════════════════════════════

import { svgBloque } from './grafico-generico.js';

const COLORES = ['#1d4ed8', '#0d9488', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#65a30d', '#db2777', '#0f766e', '#9333ea'];
const PAL_SEC = ['#1e4e79', '#0f8a99', '#c0392b', '#b07d12', '#1f7a4d', '#6b4f9e', '#6398c4', '#a93226', '#2e7d32', '#8e44ad', '#d35400', '#16a085', '#c2185b', '#5d6d7e'];
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
  let modo = 'tendencia';

  cont.innerHTML = '';
  // ── Tarjeta de filtros ───────────────────────────────────
  const card = document.createElement('div'); card.className = 'pe-filtros';
  const head = document.createElement('div'); head.className = 'pe-filtros-head';
  head.innerHTML = '<span class="ttl"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>Filtros</span>';
  const reset = document.createElement('button'); reset.className = 'pe-reset'; reset.textContent = 'Restablecer';
  head.appendChild(reset); card.appendChild(head);

  const cap = Object.assign(document.createElement('p'), { className: 'muted small', style: 'margin:2px 0 8px' });
  const chartBox = document.createElement('div'); chartBox.className = 'chartbox';

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

  const pintar = () => {
    chartBox.innerHTML = '';
    const repsVis = repsVisibles(), secs = seccionesVis(), tens = tensionesVis();
    let svg = null;
    if (modo === 'tendencia') {
      svg = svgTendencia(secs, tens, repsVis);
      cap.textContent = `Tendencia año tras año: eje X = informe (en el tiempo), BARRAS por sección (color por sección) — la misma sección queda alineada entre años para leer su evolución. ${tens.length > 1 ? 'Tensión: barra llena = ' + tens[0] + ', tenue = ' + tens[1] + '. ' : ''}Cada barra vs el límite 1% / guía 0.5%.`;
    } else {
      const series = [];
      for (const r of repsVis) for (const s of r.bloque.series) { if (!sel.tension.has(s.nombre)) continue;
        const puntos = s.puntos.filter((p) => sel.seccion.has(String(p.x)) && typeof p.y === 'number');
        if (puntos.length) series.push({ nombre: `${r.label}${r.config ? ' · ' + r.config : ''} · ${s.nombre}`, color: r.color, puntos }); }
      svg = series.length ? svgBloque({ grafica: 'barra', unidad: '%', eje_x: 'Sección de aislamiento', limite: 1, guia: 0.5, series }) : null;
      cap.textContent = 'Comparar por sección: eje X = sección, una barra por (informe × tensión), con límite 1% / guía 0.5%.';
    }
    if (svg) chartBox.appendChild(svg); else chartBox.innerHTML = '<p class="muted small">Sin datos para los filtros activos.</p>';
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
  vistaBar.append(mkVista('tendencia', 'Tendencia año tras año'), mkVista('agrupada', 'Comparar por sección'));

  cont.appendChild(card);
  cont.appendChild(vistaBar);
  cont.appendChild(cap);
  cont.appendChild(chartBox);
  pintar();
}
