// ══════════════════════════════════════════════════════════════
// DEV · PROPUESTA — 4 opciones de ILUSTRACIÓN de las tablas de excitación
// (por NIVEL DE TENSIÓN · valores totales · criterios según norma).
// Reutiliza los helpers de dominio YA exportados del panel real — no duplica
// criterio. Es material de PROPUESTA: cuando el director elija, se integra la
// opción ganadora en `excitacion-panel.js`.
// ══════════════════════════════════════════════════════════════
import { nivelDe, fasesDe, perdidasDe, tapsDe, evaluarPatron } from '../assets/js/ui/pruebas/excitacion-panel.js';
import { UMBRALES } from '../assets/js/domain/pruebas_electricas_semaforo.js';

const U = UMBRALES.excitacion;
const CRIT = { guia: U.guia, limite: U.limite };
const FASES = ['A', 'B', 'C'];
const COLORS = ['#1f3a5f', '#2c6e72', '#6d597a', '#a4694f', '#46734b', '#5d6d7e'];
const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const fmt = (v) => (v == null ? '—' : round(v));
const numTap = (t) => { const n = Number(t); return isFinite(n) ? n : 0; };

const ESTADO_TXT = { ok: 'Cumple', warn: 'Vigilar', bad: 'No cumple', na: 's/d' };
const ESTADO_COL = { ok: '#15803d', warn: '#b45309', bad: '#b91c1c', na: '#64748b' };
const ESTADO_BG = { ok: '#dcfce7', warn: '#fef3c7', bad: '#fee2e2', na: '#f1f5f9' };

function badge(estado) {
  const b = document.createElement('span'); b.textContent = ESTADO_TXT[estado];
  b.style.cssText = `display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;color:${ESTADO_COL[estado]};background:${ESTADO_BG[estado]}`;
  return b;
}
function chipNorma(acron, cumple, sub) {
  const c = document.createElement('span');
  c.style.cssText = `display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid ${cumple ? '#bbf7d0' : '#fecaca'};color:${cumple ? '#15803d' : '#b91c1c'};background:${cumple ? '#f0fdf4' : '#fef2f2'}`;
  c.textContent = `${cumple ? '✓' : '✕'} ${acron}`;
  c.title = `${acron} · ${sub} — ${cumple ? 'cumple' : 'no cumple'}`;
  return c;
}
function badgeNorma(inf) {
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
  const netaOk = inf.ok && inf.patron !== 'plano';
  const ieeeOk = inf.deltaMax != null && inf.deltaMax <= inf.admisible;
  wrap.append(chipNorma('NETA', netaOk, 'patrón 2+1'), chipNorma('IEEE', ieeeOk, `Δ≤${inf.admisible}%`));
  return wrap;
}
const dCls = (d) => (d == null ? '' : d > CRIT.limite ? 'd-bad' : d > CRIT.guia ? 'd-warn' : 'd-ok');
const scrollWrap = (tbl) => { const s = document.createElement('div'); s.className = 'pe-tabla-scroll'; s.appendChild(tbl); return s; };

// ── Construcción de datos (espejo de la lógica del panel) ──────────
export function construirMeds(items) {
  const reps = items.map((it, i) => ({ id: it.id, label: it.label, ano: it.ano, config: it.config, color: COLORS[i % COLORS.length] }));
  const meds = [];
  items.forEach((it, i) => {
    const rep = reps[i];
    it.excs.forEach((ex) => {
      const niv = nivelDe(ex.titulo, it.config);
      const taps = tapsDe(ex.bloque); const lista = taps.length ? taps : [null];
      lista.forEach((tap) => {
        meds.push({ rep, nivel: niv.label, dev: niv.dev, kv: niv.kv, tap, fases: fasesDe(ex.bloque, tap), wfases: perdidasDe(ex.bloque, tap), ev: evaluarPatron(fasesDe(ex.bloque, tap), it.config) });
      });
    });
  });
  return meds;
}

// Agrega por NIVEL → INFORME (valores totales + veredicto normativo).
export function agregar(meds) {
  const byNivel = new Map();
  meds.forEach((m) => {
    if (!byNivel.has(m.nivel)) byNivel.set(m.nivel, new Map());
    const inf = byNivel.get(m.nivel);
    if (!inf.has(m.rep.id)) inf.set(m.rep.id, { rep: m.rep, rows: [] });
    inf.get(m.rep.id).rows.push(m);
  });
  return [...byNivel.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([nivel, infMap]) => {
    const informes = [...infMap.values()].sort((a, b) => (a.rep.ano || 0) - (b.rep.ano || 0)).map((g) => {
      const Iprom = {}; FASES.forEach((f) => { Iprom[f] = round(avg(g.rows.map((m) => m.fases[f]).filter((v) => v != null))); });
      const Wprom = {}; FASES.forEach((f) => { Wprom[f] = round(avg(g.rows.map((m) => m.wfases && m.wfases[f]).filter((v) => v != null))); });
      const tieneW = FASES.some((f) => Wprom[f] != null);
      const sumW = tieneW ? round(FASES.reduce((a, f) => a + (Wprom[f] || 0), 0)) : null;
      const evs = g.rows.map((m) => m.ev).filter(Boolean);
      const peor = evs.reduce((a, b) => (b.deltaExt > (a ? a.deltaExt : -1) ? b : a), null);
      const deltaMax = peor ? peor.deltaExt : null;
      const ok = evs.length ? evs.every((e) => e.ok) : true;
      const estado = !evs.length ? 'na' : ok ? 'ok' : (deltaMax > peor.admisible * 2 ? 'bad' : 'warn');
      const Imax = round(Math.max(...g.rows.map((m) => (m.ev ? m.ev.corrMax : 0))));
      return { rep: g.rep, rows: g.rows, Iprom, Wprom, sumW, tieneW, deltaMax, ok, estado, Imax, patron: peor ? peor.patron : '—', admisible: peor ? peor.admisible : CRIT.limite };
    });
    const dev = infMap.values().next().value.rows[0].dev;
    const kv = infMap.values().next().value.rows[0].kv;
    return {
      nivel, dev, kv, informes,
      deltaMaxNivel: round(Math.max(...informes.map((x) => x.deltaMax || 0))),
      sumWNivel: round(informes.reduce((a, x) => a + (x.sumW || 0), 0)),
      ImaxNivel: round(Math.max(...informes.map((x) => x.Imax || 0))),
      estadoNivel: informes.some((x) => x.estado === 'bad') ? 'bad' : informes.some((x) => x.estado === 'warn') ? 'warn' : 'ok',
    };
  });
}

// ════════════ OPCIÓN 1 — Tarjeta por nivel + banda KPI + tabla por años ════════════
export function opcion1(niveles) {
  const root = document.createElement('div'); root.className = 'opt opt1';
  niveles.forEach((N) => {
    const card = document.createElement('div'); card.className = 'opt1-card';
    const band = document.createElement('div'); band.className = 'opt1-band';
    band.innerHTML = `<div class="opt1-niv">${esc(N.nivel)}</div><div class="opt1-kpis"><span><b>${N.ImaxNivel}</b> mA · I máx</span><span><b>${N.deltaMaxNivel}</b> % · Δ ext máx</span><span><b>${N.sumWNivel}</b> W · Σ pérd.</span></div>`;
    band.appendChild(badge(N.estadoNivel)); card.appendChild(band);
    const tbl = document.createElement('table'); tbl.className = 'pe-tabla';
    tbl.innerHTML = '<thead><tr><th>Informe</th><th>I A (mA)</th><th>I B (mA)</th><th>I C (mA)</th><th>Δ ext (%)</th><th>Σ pérd. (W)</th><th>Criterio (norma)</th></tr></thead>';
    const tb = document.createElement('tbody');
    N.informes.forEach((inf) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(inf.rep.label)}${inf.rep.config ? ' · ' + esc(inf.rep.config) : ''}</td><td>${fmt(inf.Iprom.A)}</td><td class="col-b">${fmt(inf.Iprom.B)}</td><td>${fmt(inf.Iprom.C)}</td><td class="${dCls(inf.deltaMax)}">${fmt(inf.deltaMax)}</td><td>${fmt(inf.sumW)}</td>`;
      const td = document.createElement('td'); td.appendChild(badgeNorma(inf)); tr.appendChild(td); tb.appendChild(tr);
    });
    tbl.appendChild(tb); card.appendChild(scrollWrap(tbl)); root.appendChild(card);
  });
  return root;
}

// ════════════ OPCIÓN 2 — Matriz TRANSPUESTA (métrica × años) por nivel ════════════
export function opcion2(niveles) {
  const root = document.createElement('div'); root.className = 'opt opt2';
  niveles.forEach((N) => {
    const card = document.createElement('div'); card.className = 'opt2-card';
    const h = document.createElement('div'); h.className = 'opt2-head'; h.innerHTML = `<span class="opt2-niv">${esc(N.nivel)}</span>`; h.appendChild(badge(N.estadoNivel)); card.appendChild(h);
    const aos = N.informes;
    const tbl = document.createElement('table'); tbl.className = 'pe-tabla opt2-matriz';
    tbl.innerHTML = `<thead><tr><th>Métrica</th>${aos.map((i) => `<th>${esc(i.rep.label)}</th>`).join('')}</tr></thead>`;
    const tb = document.createElement('tbody');
    const fila = (lbl, fn, cls) => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="opt2-mlbl">${lbl}</td>` + aos.map((i) => `<td class="${cls ? cls(i) : ''}">${fn(i)}</td>`).join(''); return tr; };
    tb.appendChild(fila('I fase A (mA)', (i) => fmt(i.Iprom.A)));
    tb.appendChild(fila('I fase B central (mA)', (i) => fmt(i.Iprom.B)));
    tb.appendChild(fila('I fase C (mA)', (i) => fmt(i.Iprom.C)));
    tb.appendChild(fila('Δ ext máx (%)', (i) => fmt(i.deltaMax), (i) => dCls(i.deltaMax)));
    tb.appendChild(fila('Σ pérdidas (W)', (i) => fmt(i.sumW)));
    tb.appendChild(fila('Patrón 2+1', (i) => i.patron));
    const crTr = document.createElement('tr'); crTr.innerHTML = '<td class="opt2-mlbl">Criterio (norma)</td>';
    aos.forEach((i) => { const td = document.createElement('td'); td.appendChild(badgeNorma(i)); crTr.appendChild(td); });
    tb.appendChild(crTr); tbl.appendChild(tb); card.appendChild(scrollWrap(tbl)); root.appendChild(card);
  });
  return root;
}

// ════════════ OPCIÓN 3 — Detalle por TAP + semáforo + totales + franja de norma ════════════
export function opcion3(niveles) {
  const root = document.createElement('div'); root.className = 'opt opt3';
  niveles.forEach((N) => {
    const sec = document.createElement('div'); sec.className = 'opt3-nivel';
    const nh = document.createElement('div'); nh.className = 'opt3-nivhead';
    nh.innerHTML = `<span class="opt3-niv">${esc(N.nivel)}</span><span class="opt3-sub">${N.informes.length} informe(s) · Δ ext máx ${N.deltaMaxNivel}% · Σ pérd. ${N.sumWNivel} W</span>`;
    nh.appendChild(badge(N.estadoNivel)); sec.appendChild(nh);
    N.informes.forEach((inf) => {
      const card = document.createElement('div'); card.className = 'opt3-card';
      const ribbon = document.createElement('div'); ribbon.className = 'opt3-ribbon';
      ribbon.innerHTML = `<span><b>${esc(inf.rep.label)}</b>${inf.rep.config ? ' · ' + esc(inf.rep.config) : ''}</span>`;
      ribbon.appendChild(badgeNorma(inf)); card.appendChild(ribbon);
      const tbl = document.createElement('table'); tbl.className = 'pe-tabla';
      tbl.innerHTML = '<thead><tr><th></th><th>TAP</th><th>I A (mA)</th><th>I B (mA)</th><th>I C (mA)</th><th>Δ ext (%)</th><th>Σ pérd. (W)</th></tr></thead>';
      const tb = document.createElement('tbody');
      inf.rows.slice().sort((a, b) => numTap(a.tap) - numTap(b.tap)).forEach((m) => {
        const d = m.ev ? m.ev.deltaExt : null;
        const sem = d == null ? 'na' : d > CRIT.limite ? 'bad' : d > CRIT.guia ? 'warn' : 'ok';
        const wf = m.wfases || {}; const hayW = FASES.some((f) => wf[f] != null); const sumWtap = FASES.reduce((a, f) => a + (wf[f] || 0), 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><span class="opt3-dot" style="background:${ESTADO_COL[sem]}"></span></td><td>${esc(String(m.tap))}</td><td>${fmt(m.fases.A)}</td><td class="col-b">${fmt(m.fases.B)}</td><td>${fmt(m.fases.C)}</td><td class="${dCls(d)}">${d == null ? '—' : d}</td><td>${hayW ? round(sumWtap) : '—'}</td>`;
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      const tf = document.createElement('tfoot');
      tf.innerHTML = `<tr><td></td><td>Total / Prom</td><td>${fmt(inf.Iprom.A)}</td><td class="col-b">${fmt(inf.Iprom.B)}</td><td>${fmt(inf.Iprom.C)}</td><td>${fmt(inf.deltaMax)}</td><td>${fmt(inf.sumW)}</td></tr>`;
      tbl.appendChild(tf); card.appendChild(scrollWrap(tbl)); sec.appendChild(card);
    });
    root.appendChild(sec);
  });
  return root;
}

// ════════════ OPCIÓN 4 — Scorecard / KPI tiles por nivel + franja de norma + strip ════════════
export function opcion4(niveles) {
  const root = document.createElement('div'); root.className = 'opt opt4';
  niveles.forEach((N) => {
    const card = document.createElement('div'); card.className = 'opt4-card';
    const head = document.createElement('div'); head.className = 'opt4-head'; head.innerHTML = `<span class="opt4-niv">${esc(N.nivel)}</span>`; head.appendChild(badge(N.estadoNivel)); card.appendChild(head);
    const tiles = document.createElement('div'); tiles.className = 'opt4-tiles';
    const tile = (v, u, l, cls) => `<div class="opt4-tile ${cls || ''}"><div class="opt4-v">${v}<small>${u}</small></div><div class="opt4-l">${l}</div></div>`;
    const dc = N.deltaMaxNivel > CRIT.limite ? 'is-bad' : N.deltaMaxNivel > CRIT.guia ? 'is-warn' : 'is-ok';
    tiles.innerHTML = tile(N.ImaxNivel, ' mA', 'Corriente máx') + tile(N.deltaMaxNivel, ' %', 'Δ ext máx', dc) + tile(N.sumWNivel, ' W', 'Σ pérdidas') + tile(N.informes.length, '', 'Informes');
    card.appendChild(tiles);
    const vr = document.createElement('div'); vr.className = 'opt4-verdict';
    vr.innerHTML = `<div class="opt4-norma"><b>NETA</b> ATS §7.2.2.D.6 · patrón 2+1</div><div class="opt4-norma"><b>IEEE</b> Std 62 / C57.152 · Δ ext ≤ ${CRIT.guia}–${CRIT.limite}%</div>`;
    const vb = document.createElement('div'); vb.className = 'opt4-vb'; vb.appendChild(badge(N.estadoNivel)); vr.appendChild(vb); card.appendChild(vr);
    const tbl = document.createElement('table'); tbl.className = 'pe-tabla opt4-strip';
    tbl.innerHTML = '<thead><tr><th>Año</th><th>I A</th><th>I B</th><th>I C</th><th>Δ ext</th><th>Σ W</th><th>Criterio</th></tr></thead>';
    const tb = document.createElement('tbody');
    N.informes.forEach((inf) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(inf.rep.label)}</td><td>${fmt(inf.Iprom.A)}</td><td class="col-b">${fmt(inf.Iprom.B)}</td><td>${fmt(inf.Iprom.C)}</td><td class="${dCls(inf.deltaMax)}">${fmt(inf.deltaMax)}</td><td>${fmt(inf.sumW)}</td>`;
      const td = document.createElement('td'); td.appendChild(badgeNorma(inf)); tr.appendChild(td); tb.appendChild(tr);
    });
    tbl.appendChild(tb); card.appendChild(scrollWrap(tbl)); root.appendChild(card);
  });
  return root;
}

// ════════════ FUSIÓN 1+4 — banda + KPI tiles + franja de norma + tabla por años ════════════
export function opcionFusion(niveles) {
  const root = document.createElement('div'); root.className = 'opt optF';
  niveles.forEach((N) => {
    const card = document.createElement('div'); card.className = 'optF-card';
    const band = document.createElement('div'); band.className = 'optF-band';
    band.innerHTML = `<div class="optF-niv">${esc(N.nivel)}</div>`; band.appendChild(badge(N.estadoNivel));
    card.appendChild(band);
    const tiles = document.createElement('div'); tiles.className = 'optF-tiles';
    const tile = (v, u, l, cls) => `<div class="optF-tile ${cls || ''}"><div class="optF-v">${v}<small>${u}</small></div><div class="optF-l">${l}</div></div>`;
    const dc = N.deltaMaxNivel > CRIT.limite ? 'is-bad' : N.deltaMaxNivel > CRIT.guia ? 'is-warn' : 'is-ok';
    tiles.innerHTML = tile(N.ImaxNivel, ' mA', 'Corriente máx') + tile(N.deltaMaxNivel, ' %', 'Δ ext máx', dc) + tile(N.sumWNivel, ' W', 'Σ pérdidas') + tile(N.informes.length, '', 'Informes');
    card.appendChild(tiles);
    const vr = document.createElement('div'); vr.className = 'optF-verdict';
    vr.innerHTML = `<div class="optF-norma"><b>NETA</b> ATS §7.2.2.D.6 · patrón 2+1</div><div class="optF-norma"><b>IEEE</b> Std 62 / C57.152 · Δ ext ≤ ${CRIT.guia}–${CRIT.limite}%</div>`;
    const vb = document.createElement('div'); vb.className = 'optF-vb'; vb.appendChild(badge(N.estadoNivel)); vr.appendChild(vb);
    card.appendChild(vr);
    const tbl = document.createElement('table'); tbl.className = 'pe-tabla';
    tbl.innerHTML = '<thead><tr><th>Informe</th><th>I A (mA)</th><th>I B (mA)</th><th>I C (mA)</th><th>Δ ext (%)</th><th>Σ pérd. (W)</th><th>Criterio (norma)</th></tr></thead>';
    const tb = document.createElement('tbody');
    N.informes.forEach((inf) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(inf.rep.label)}${inf.rep.config ? ' · ' + esc(inf.rep.config) : ''}</td><td>${fmt(inf.Iprom.A)}</td><td class="col-b">${fmt(inf.Iprom.B)}</td><td>${fmt(inf.Iprom.C)}</td><td class="${dCls(inf.deltaMax)}">${fmt(inf.deltaMax)}</td><td>${fmt(inf.sumW)}</td>`;
      const td = document.createElement('td'); td.appendChild(badgeNorma(inf)); tr.appendChild(td); tb.appendChild(tr);
    });
    tbl.appendChild(tb); card.appendChild(scrollWrap(tbl)); root.appendChild(card);
  });
  return root;
}

export const OPCIONES = [
  { n: 'F', titulo: 'FUSIÓN 1+4 — banda + KPI tiles + franja de norma + tabla por años', desc: 'Combina lo mejor de ambas: cabecera del nivel con veredicto, mosaicos de cifras grandes (I máx · Δ ext máx · Σ pérd · # informes) con color por desviación, franja con la norma citada (NETA + IEEE), y debajo la tabla completa por informe/año con su criterio. Impacto gerencial + trazabilidad por año.', render: opcionFusion },
  { n: 1, titulo: 'Tarjeta por nivel + banda KPI + tabla por años', desc: 'Cada nivel es una tarjeta con una banda superior de KPIs (I máx, Δ ext máx, Σ pérdidas) y veredicto global; debajo, una fila por informe con sus valores promedio y el criterio por norma (NETA/IEEE). Compacta y ejecutiva.', render: opcion1 },
  { n: 2, titulo: 'Matriz transpuesta (métrica × años) por nivel', desc: 'Por nivel, una matriz donde las FILAS son métricas (I por fase, Δ ext, Σ pérdidas, patrón, criterio) y las COLUMNAS son los años. Pensada para leer la TENDENCIA de una métrica de izquierda a derecha.', render: opcion2 },
  { n: 3, titulo: 'Detalle por TAP + semáforo + totales', desc: 'La más fiel al informe: por nivel e informe, la tabla completa por posición de TAP con un semáforo por fila (Δ vs guía/límite), franja de criterio normativo arriba y fila de totales/promedio abajo.', render: opcion3 },
  { n: 4, titulo: 'Scorecard / KPI tiles por nivel', desc: 'La más gerencial: por nivel, mosaicos de cifras grandes (corriente máx, Δ ext máx, Σ pérdidas, # informes), una franja con el veredicto de cada norma, y una tira condensada de una fila por año.', render: opcion4 },
];
