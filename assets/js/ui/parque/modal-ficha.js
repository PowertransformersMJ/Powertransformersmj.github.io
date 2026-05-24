// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Modal Ficha de Activo
// ──────────────────────────────────────────────────────────────
// Modal con (1) propuesta de mantenimiento (flujograma), (2) panel
// DGA + Triángulo de Duval SVG, (3) las 7 variables con su
// calificación + criterio MO.00418 highlighteado.
//
// La función `openModal(cod)` busca el activo en el store y arma
// el HTML completo. `closeModal()` cierra el modal.
// ══════════════════════════════════════════════════════════════

import { $, califColor, bucketColor } from './_helpers.js';
import {
  VARS, PESOS, CRITERIOS, CALIF_LABEL, BUCKET_NULL,
} from '../../domain/parque_salud_config.js';
import {
  fmtCond, critNivel, condIC, condRigidez,
  duvalDashboard, DUVAL_LABELS,
} from '../../domain/parque_salud_calc.js';
import { buildPropuesta } from '../../domain/propuestas_mantenimiento.js';
import { store } from './state.js';

// ── SVG del Triángulo de Duval 1 (IEC 60599) ─────────────────
function duvalSVG(dv) {
  const TOP = [150, 20], BL = [26, 250], BR = [274, 250]; // CH4 arriba · C2H2 BL · C2H4 BR
  const toXY = (m, a, e) => [
    m / 100 * TOP[0] + a / 100 * BL[0] + e / 100 * BR[0],
    m / 100 * TOP[1] + a / 100 * BL[1] + e / 100 * BR[1],
  ];
  // Clip de polígono (vértices [x,y,m,a,e]) por "coord OP umbral"
  const clip = (poly, idx, op, thr) => {
    const out = [];
    const inside = p => op === 'ge' ? p[idx] >= thr - 1e-9 : p[idx] <= thr + 1e-9;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], ai = inside(A), bi = inside(B);
      if (ai) out.push(A);
      if (ai !== bi) {
        const t = (thr - A[idx]) / (B[idx] - A[idx]);
        out.push([0, 1, 2, 3, 4].map(k => A[k] + t * (B[k] - A[k])));
      }
    }
    return out;
  };
  const zonePoly = cons => {
    let p = [
      [TOP[0], TOP[1], 100, 0, 0],
      [BR[0], BR[1], 0, 0, 100],
      [BL[0], BL[1], 0, 100, 0],
    ];
    cons.forEach(([i, o, t]) => p = clip(p, i, o, t));
    return p;
  };
  const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  const cent = p => { let x = 0, y = 0; p.forEach(v => { x += v[0]; y += v[1]; }); return [x / p.length, y / p.length]; };

  const ZONES = [
    { z: 'PD', col: '#9b6dd6', cons: [[[2, 'ge', 98]]] },
    { z: 'T1', col: '#3bb273', cons: [[[3, 'le', 4], [4, 'le', 20], [2, 'le', 98]]] },
    { z: 'T2', col: '#f2c43d', cons: [[[3, 'le', 4], [4, 'ge', 20], [4, 'le', 50]]] },
    { z: 'T3', col: '#ef7d28', cons: [[[3, 'le', 15], [4, 'ge', 50]]] },
    { z: 'DT', col: '#9aa7b0', cons: [[[3, 'ge', 4], [3, 'le', 13], [4, 'le', 50]], [[3, 'ge', 15], [3, 'le', 29], [4, 'ge', 40]], [[3, 'ge', 13], [3, 'le', 15], [4, 'ge', 40], [4, 'le', 50]]] },
    { z: 'D1', col: '#f0992e', cons: [[[3, 'ge', 13], [4, 'le', 23]]] },
    { z: 'D2', col: '#e23048', cons: [[[3, 'ge', 29], [4, 'ge', 23]], [[3, 'ge', 13], [3, 'le', 29], [4, 'ge', 23], [4, 'le', 40]]] },
  ];

  let svg = '';
  ZONES.forEach(Z => {
    let big = null, bigA = -1;
    Z.cons.forEach(c => {
      const poly = zonePoly(c);
      if (poly.length < 3) return;
      const pts = poly.map(v => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join(' ');
      const op = (Z.z === dv.zone) ? 0.9 : 0.5;
      svg += `<polygon points="${pts}" fill="${Z.col}" fill-opacity="${op}" stroke="#fff" stroke-width="0.6"/>`;
      const ar = area(poly);
      if (ar > bigA) { bigA = ar; big = cent(poly); }
    });
    if (big && bigA > 110) {
      const hl = (Z.z === dv.zone);
      svg += `<text x="${big[0].toFixed(1)}" y="${(big[1] + 3).toFixed(1)}" text-anchor="middle" font-size="${hl ? 12 : 10}" font-weight="${hl ? '700' : '600'}" fill="#fff" style="paint-order:stroke;stroke:rgba(0,0,0,.3);stroke-width:.6px">${Z.z}</text>`;
    }
  });

  const P = toXY(dv.M, dv.A, dv.E);
  svg += `<circle cx="${P[0].toFixed(1)}" cy="${P[1].toFixed(1)}" r="6.5" fill="#0b2230" stroke="#fff" stroke-width="2.2"/>`;
  return `<svg viewBox="0 0 300 282" width="100%" style="max-width:300px" aria-label="Triángulo de Duval con regiones">
    ${svg}
    <polygon points="${TOP[0]},${TOP[1]} ${BR[0]},${BR[1]} ${BL[0]},${BL[1]}" fill="none" stroke="var(--ink-dim)" stroke-width="1.2"/>
    <text x="${TOP[0]}" y="${TOP[1] - 6}" text-anchor="middle" font-size="10" fill="var(--ink-dim)">%CH₄</text>
    <text x="${BL[0] - 2}" y="${BL[1] + 14}" text-anchor="middle" font-size="10" fill="var(--ink-dim)">%C₂H₂</text>
    <text x="${BR[0] + 2}" y="${BR[1] + 14}" text-anchor="middle" font-size="10" fill="var(--ink-dim)">%C₂H₄</text>
  </svg>`;
}

// ── Cadena con la medición de cada variable ──────────────────
function measuredStr(k, d) {
  if (!d) return '';
  const f = {
    dga:  d.tdgc != null ? `TDGC ${d.tdgc} ppm` : null,
    adfq: (d.rigidez != null || d.ic != null) ? `rigidez ${d.rigidez ?? '—'} kV · IC ${d.ic ?? '—'}` : null,
    fur:  d.fur2fal != null ? `2FAL ${d.fur2fal} ppb` : null,
    crg:  d.carga != null ? `${d.carga}%` : null,
    edad: d.edad_anos != null ? `${d.edad_anos} años${d.anio ? ` · fab. ${d.anio}` : ''}` : null,
  }[k];
  return f ? ` · medido: ${f}` : '';
}

// ── Mini-tabla de sub-condición (rigidez/IC) ─────────────────
function subMini(rows) {
  return `<table class="dga-sub" style="margin:2px 0 6px"><tbody>${rows.map(r => {
    const cc = r[2] != null ? califColor(Math.round(r[2])) : 'var(--ink-dim)';
    return `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td><td><span class="hi-pill" style="color:${cc}">${r[2] != null ? Math.round(r[2]) : '—'}</span></td></tr>`;
  }).join('')}</tbody></table>`;
}

// ── Detalle por variable (ADFQ / FUR / CRG / EDAD) ───────────
function varDetail(k, a) {
  const d = a.det;
  if (!d) return '';
  if (k === 'adfq') {
    const rows = [];
    if (d.rigidez != null) rows.push(['Rigidez dieléctrica', d.rigidez + ' kV', condRigidez(d.rigidez)]);
    if (d.ic != null) rows.push(['Índice de calidad IC', d.ic, condIC(d.ic)]);
    if (!rows.length) return '';
    const extra = [];
    if (d.humedad != null) extra.push('Humedad ' + d.humedad + ' ppm');
    if (d.nn != null) extra.push('NN ' + d.nn);
    if (d.ti != null) extra.push('TI ' + d.ti);
    return subMini(rows) + (extra.length ? `<div class="crit-note">Otros: ${extra.join(' · ')}</div>` : '');
  }
  if (k === 'fur' && d.fur2fal != null) {
    if (d.fur2fal <= 0) return `<div class="vmeasure"><span>2FAL: <b>0</b> ppb · sin degradación detectable</span></div>`;
    const f = d.fur2fal;
    const DP = (Math.log10(f * 0.88) - 4.51) / (-0.0035);
    let usada = (Math.log10(DP) - 2.903) / (-0.006021);
    usada = Math.max(0, Math.min(100, usada));
    return `<div class="vmeasure"><span>2FAL: <b>${f}</b> ppb</span><span>DP ≈ <b>${Math.round(DP)}</b></span><span>Vida remanente ≈ <b>${(100 - usada).toFixed(0)}%</b></span></div>
      <div class="crit-note">DP y vida útil por curva de Chedong (MO.00418): DP=(log(2FAL·0,88)−4,51)/−0,0035.</div>`;
  }
  if (k === 'crg' && d.carga != null) {
    return `<div class="vmeasure"><span>Cargabilidad medida: <b>${d.carga}%</b></span></div>`;
  }
  if (k === 'edad' && d.edad_anos != null) {
    return `<div class="vmeasure"><span><b>${d.edad_anos}</b> años</span>${d.anio ? `<span>año de fabricación <b>${d.anio}</b></span>` : ''}</div>`;
  }
  return '';
}

// ── Panel DGA con gases + Duval ──────────────────────────────
function dgaPanel(a) {
  const d = a.det || {};
  const gasList = [['H₂', 'h2'], ['CH₄', 'ch4'], ['C₂H₄', 'c2h4'], ['C₂H₆', 'c2h6'], ['CO', 'co'], ['CO₂', 'co2'], ['C₂H₂', 'c2h2'], ['TDGC', 'tdgc']]
    .filter(([_, k]) => d[k] != null)
    .map(([n, k]) => `<span>${n}: <b>${d[k]}</b></span>`)
    .join('');

  const ventCol = { OPERATIVA: 'var(--h1)', OBSOLETA: 'var(--h4)', 'N/A': 'var(--ink-dim)' };
  const term = [];
  if (d.refrig) term.push(`<span>Refrigeración: <b style="color:var(--ink)">${d.refrig}</b></span>`);
  if (d.ventil) {
    const vc = ventCol[String(d.ventil).toUpperCase()] || 'var(--ink-dim)';
    term.push(`<span>Ventilación: <b style="color:${vc}">${d.ventil}</b></span>`);
  }
  const termHTML = term.length ? `<div class="dga-gases" style="margin-bottom:10px">${term.join('')}</div>` : '';

  const sub = [
    ['TDGC (∑H₂,CH₄,C₂H₄,C₂H₆)', d.tdgc, d.ev_tdgc, '≥401→5 · 301–400→4 · 201–300→3 · 95–200→2 · &lt;95→1'],
    ['CO',  d.co,  d.ev_co,  '≥750→5 · 550–749→4 · 300–549→3 · 100–299→2 · &lt;100→1'],
    ['CO₂', d.co2, d.ev_co2, '≥7001→5 · 5000–7000→4 · 3000–4999→3 · 1500–2999→2 · &lt;1500→1'],
    ['C₂H₂', d.c2h2, d.ev_c2h2, '≥7→5 · 6→4 · 5→3 · 3–4→2 · &lt;3→1'],
  ].filter(r => r[1] != null);
  const subRows = sub.map(r => {
    const k = r[2] != null ? Math.round(r[2]) : null;
    const cc = k != null ? califColor(k) : 'var(--ink-dim)';
    return `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td><td><span class="hi-pill" style="color:${cc}">${k != null ? k : '—'}</span></td><td style="color:var(--ink-faint);font-size:10px">${r[3]}</td></tr>`;
  }).join('');

  let duvalHTML;
  if (d.ch4 != null && d.c2h4 != null && d.c2h2 != null) {
    const dv = duvalDashboard(d.ch4, d.c2h4, d.c2h2);
    if (!dv || dv.sum < 1) {
      duvalHTML = '<div class="crit-note" style="margin-top:8px">Gases de falla por debajo del umbral de diagnóstico (∑CH₄+C₂H₄+C₂H₂ &lt; 1 ppm): el triángulo de Duval no es concluyente — sin falla activa.</div>';
    } else {
      const L = DUVAL_LABELS[dv.zone];
      duvalHTML = `<div class="dga-grid">
        <div>${duvalSVG(dv)}</div>
        <div>
          <div style="font-size:10px;color:var(--ink-dim);font-family:var(--mono);letter-spacing:.08em">TRIÁNGULO DE DUVAL 1 · IEC 60599</div>
          <div class="duval-zone"><span style="color:var(--accent)">${L[0]}</span> — ${L[1]}</div>
          <div class="mono" style="font-size:11px;color:var(--ink-dim);margin-top:4px">%CH₄ ${dv.M.toFixed(1)} · %C₂H₄ ${dv.E.toFixed(1)} · %C₂H₂ ${dv.A.toFixed(1)}</div>
          <div class="crit-note" style="margin-top:8px">Duval indica el <b>tipo</b> de falla incipiente; la <b>severidad</b> (condición 1–5) la define MO.00418. Se leen juntos.</div>
        </div>
      </div>`;
    }
  } else {
    duvalHTML = `<div class="crit-note" style="margin-top:8px">El triángulo de Duval requiere CH₄, C₂H₄ y C₂H₂. La fuente solo trae estos gases en TX_Potencia; para esta hoja (${a.tipo_activo}) no es calculable.</div>`;
  }

  return `<div class="dga-panel">
    <h4>DGA — detalle (gases, criterio MO.00418 y Duval)</h4>
    ${gasList ? `<div class="dga-gases">${gasList} <span style="border:none;background:none;color:var(--ink-faint)">ppm</span></div>` : ''}
    ${termHTML}
    ${subRows ? `<table class="dga-sub"><thead><tr><th>Subcriterio</th><th>Medido</th><th>Cond.</th><th>Umbral MO.00418</th></tr></thead><tbody>${subRows}</tbody></table>` : ''}
    <div class="crit-note">Evaluación DGA compuesta (documento): <b>${a.calif_dga != null ? a.calif_dga : '—'}</b></div>
    ${duvalHTML}
  </div>`;
}

// ── HTML del bloque "propuesta de mantenimiento" ─────────────
function propuestaHTML(activo) {
  const p = buildPropuesta(activo);
  if (p.vacio) {
    return `<div class="prop-panel ok"><h4>Propuesta de mantenimiento · flujograma</h4>
      <div class="crit-note">Todas las variables en condición Bueno / Muy Bueno (≤2). No se requieren acciones correctivas; mantener el seguimiento programado (PSM / trimestral) según la condición del equipo.</div></div>`;
  }
  const ramas = p.nodes.map(n => {
    const matches = (n.match || []).map(mk =>
      `<span class="mtag ${p.flagged[mk] != null ? 'adv' : ''}">${({ dga: 'DGA', adfq: 'ADFQ', fur: 'Furanos', crg: 'Cargabilidad', pyt: 'Estudios P&T', edad: 'Edad', her: 'Hermeticidad' }[mk] || mk)}${p.flagged[mk] != null ? ' ⚠' : ''}</span>`
    ).join('');
    const ins = n.insumos ? `<div class="crit-note">Insumos del estudio: ${n.insumos.join(' · ')}</div>` : '';
    return `<div class="prop-rama">
      <div class="pr-h"><span class="pr-sev s${n.sev}">${n.sev}</span> <b>${n.label}</b></div>
      ${matches ? `<div class="pr-match">Se entrelaza con: ${matches}</div>` : ''}
      ${ins}
      <div class="pr-acc">${n.acc.map(x => `<span>${x}</span>`).join('')}</div>
    </div>`;
  }).join('');
  const accHTML = p.acciones.map(({ texto, n }) =>
    `<li>${n >= 2 ? '<b class="reinf">★</b> ' : ''}${texto}${n >= 2 ? ` <span class="rc">×${n}</span>` : ''}</li>`
  ).join('');
  return `<div class="prop-panel">
    <h4>Propuesta de mantenimiento · flujograma</h4>
    <div class="prop-sum">${p.criticas.length ? `<span class="badge crit">Crítico (4–5): ${p.criticas.join(', ')}</span>` : ''}${p.atencion.length ? `<span class="badge aten">Atención (3): ${p.atencion.join(', ')}</span>` : ''}</div>
    <div class="prop-cols">
      <div><div class="pc-t">Variables disparadoras y entrelazado</div>${ramas}</div>
      <div><div class="pc-t">Acciones recomendadas (priorizadas)</div>
        <ol class="prop-acclist">${accHTML}</ol>
        <div class="crit-note">★ acción reforzada por varias variables (match más efectivo). Derivada del flujograma de diagnóstico; complementa el juicio del especialista.</div>
      </div>
    </div>
  </div>`;
}

// ── API pública ───────────────────────────────────────────────
export function openModal(cod) {
  const a = store.state.rows.find(x => x.codigo === cod);
  if (!a) return;
  const b = a.bucket;
  const col = bucketColor(b);

  $('#mCode').textContent = a.codigo + ' · ' + a.matricula;
  $('#mName').textContent = (a.subestacion || (a.tipo_activo || 'Transformador').replace(/_/g, ' '));
  $('#mMeta').innerHTML = `<b>${a.zona}</b> · ${a.departamento} · ${a.tipo_activo.replace(/_/g, ' ')} · `
    + `Criticidad <b>${critNivel(a.usuarios_aguas_abajo)}</b> (${a.usuarios_aguas_abajo.toLocaleString('es-CO')} usuarios)`;
  const mHiN = $('#mHiN');
  mHiN.textContent = fmtCond(a.hi);
  mHiN.style.color = col;
  const mHiL = $('#mHiL');
  mHiL.textContent = b.label;
  mHiL.style.background = col;
  $('#mPropuesta').innerHTML = propuestaHTML(a);

  $('#mVars').innerHTML = dgaPanel(a) + VARS.map(v => {
    const raw = a['calif_' + v.k];
    const has = raw != null && !Number.isNaN(raw);
    const c = has ? Math.round(raw) : 0;
    const shown = has ? (Number.isInteger(raw) ? raw : Math.round(raw * 100) / 100) : '—';
    const cr = CRITERIOS[v.k];
    const rows = cr.filas.map(f =>
      `<tr class="${has && f.c === c ? 'hit' : ''}"><td class="cc" style="${has && f.c === c ? 'background:' + califColor(f.c) : ''}">${f.c}</td><td>${f.r}</td></tr>`
    ).join('');
    return `<div class="var-card">
      <div class="vh">
        <div class="vscore" style="background:${has ? califColor(c) : BUCKET_NULL.color};${has ? '' : 'color:var(--ink-dim)'}">${shown}</div>
        <div class="vmeta">
          <div class="vname">${v.n}</div>
          <div class="vsub">${has ? CALIF_LABEL[c] : 'Sin dato'} · ${cr.unidad}${measuredStr(v.k, a.det)}</div>
        </div>
        <div class="vweight">peso<b>${Math.round(PESOS[v.k] * 100)}%</b></div>
      </div>
      ${v.k !== 'dga' ? varDetail(v.k, a) : ''}
      <table class="crit-table"><tbody>${rows}</tbody></table>
      <div class="crit-note">${cr.ref} — ${cr.nota}</div>
    </div>`;
  }).join('');

  $('#modalBg').classList.add('on');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const bg = $('#modalBg');
  if (bg) bg.classList.remove('on');
  document.body.style.overflow = '';
}

// ── Listeners únicos (binded por shell) ──────────────────────
export function bindModalEvents() {
  document.addEventListener('click', (e) => {
    const tr = e.target.closest('tr.click[data-cod]');
    if (tr) openModal(tr.getAttribute('data-cod'));
  });
  const close = $('#mClose');
  if (close) close.onclick = closeModal;
  const bg = $('#modalBg');
  if (bg) bg.addEventListener('click', (e) => { if (e.target.id === 'modalBg') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}
