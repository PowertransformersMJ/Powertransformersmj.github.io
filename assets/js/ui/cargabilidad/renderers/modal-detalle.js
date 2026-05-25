// ══════════════════════════════════════════════════════════════
// Renderer · Modal de detalle (drill-down)
// Reúne: gauge SVG por devanado · trend SVG con perfil sintético ·
// diagnóstico 7 variables · workflow 4 pasos · ficha técnica.
// ══════════════════════════════════════════════════════════════

import { $, fmt, cap } from './_helpers.js';
import { sev } from '../../../domain/cargabilidad_severidad.js';
import {
  SEVCOL, SEVLBL, DIAG_MAP, PROFILE_24H, DIAG_LABEL,
} from '../../../domain/cargabilidad_config.js';
import { store } from '../state.js';

// ── Generación de series sintéticas (24h / 7d / 30d) ─────────
function makeSeries(peak, win) {
  if (win === '24h') return PROFILE_24H.map((p, i) => ({
    x: i, y: peak * p, lbl: String(i).padStart(2, '0') + 'h',
  }));
  const days = win === '7d' ? 7 : 30;
  const out = [];
  for (let i = 0; i < days; i++) {
    const f = 0.82 + 0.18 * Math.sin(i * 1.1) + ((i * 97 % 13) / 13 - 0.5) * 0.12;
    out.push({
      x: i, y: peak * Math.max(0.5, Math.min(1.02, f)),
      lbl: win === '7d' ? 'D' + (i + 1) : String(i + 1),
    });
  }
  return out;
}

// ── Gauge semicircular SVG ───────────────────────────────────
function gauge(label, pct, sub) {
  const p = pct == null ? 0 : pct;
  const cl = Math.min(p, 150);
  const ang = cl / 150 * 270 - 135;
  const col = SEVCOL[sev(pct == null ? null : pct)];
  const r = 52, cx = 64, cy = 64, rad = Math.PI / 180;
  const a0 = -135 * rad, a1 = ang * rad;
  const large = (ang + 135) > 180 ? 1 : 0;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const tx0 = cx + r * Math.cos(-135 * rad), ty0 = cy + r * Math.sin(-135 * rad);
  const tx1 = cx + r * Math.cos(135 * rad),  ty1 = cy + r * Math.sin(135 * rad);
  return `<div style="text-align:center">
    <svg width="124" height="124" viewBox="0 0 128 128">
      <path d="M${tx0} ${ty0} A${r} ${r} 0 1 1 ${tx1} ${ty1}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="11" stroke-linecap="round"/>
      <path d="M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ${col})"/>
      <text x="64" y="60" text-anchor="middle" font-family="Sora" font-weight="800" font-size="26" fill="${col}">${pct == null ? 'N/A' : pct.toFixed(0) + '%'}</text>
      <text x="64" y="80" text-anchor="middle" font-size="10.5" fill="#9FC9C8">${sub}</text>
    </svg>
    <div class="disp" style="font-weight:700;font-size:13px;margin-top:-4px">${label}</div>
  </div>`;
}

// ── Trend chart SVG ─────────────────────────────────────────
function trendSVG(d, win) {
  const o = d.P;
  const peak = o.car || 0;
  const ser = makeSeries(peak, win);
  const W = 720, H = 290;
  const ymax = Math.max(210, (o.l2 || 0) * 1.08, peak * 1.15);
  const X = (i) => i / (ser.length - 1) * W;
  const Y = (v) => H - v / ymax * H;
  const pts = ser.map((s, i) => [X(i), Y(s.y)]);
  const line = 'M' + pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' L');
  const area = `M0,${H} L` + pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' L') + ` L${W},${H} Z`;
  const lvls = [0, 50, 100, 150, 200].filter(v => v <= ymax);
  const ylab = lvls.map(v =>
    `<text x="-10" y="${(Y(v) + 4).toFixed(0)}" fill="#6E9A9C" font-size="11" text-anchor="end">${v}</text>
     <line x1="0" y1="${Y(v).toFixed(0)}" x2="${W}" y2="${Y(v).toFixed(0)}" stroke="rgba(255,255,255,.05)"/>`
  ).join('');
  const step = Math.ceil(ser.length / 8);
  const xlab = ser.map((s, i) =>
    i % step === 0
      ? `<text x="${X(i).toFixed(0)}" y="${H + 22}" fill="#6E9A9C" font-size="10.5" text-anchor="middle">${s.lbl}</text>`
      : ''
  ).join('');
  const limLine = (v, c) => v
    ? `<line x1="0" y1="${Y(v).toFixed(0)}" x2="${W}" y2="${Y(v).toFixed(0)}" stroke="${c}" stroke-width="2" stroke-dasharray="7 5"/>`
    : '';
  const dots = pts.map((p, i) => {
    const above = ser[i].y > (o.amp || 1e9);
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${above ? 'var(--cri)' : 'var(--aqua)'}"/>`;
  }).join('');
  const pi = ser.reduce((mi, s, i, a) => s.y > a[mi].y ? i : mi, 0);
  return `<svg viewBox="-44 -10 ${W + 70} ${H + 46}" style="width:100%">
    ${ylab}${xlab}
    <defs>
      <linearGradient id="ar" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#5EEAD4" stop-opacity=".4"/>
        <stop offset="1" stop-color="#5EEAD4" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#ar)"/>
    ${limLine(o.amp, 'var(--avi)')}${limLine(o.l1, 'var(--ale)')}${limLine(o.l2, 'var(--cri)')}
    <path d="${line}" fill="none" stroke="var(--aqua)" stroke-width="3" style="filter:drop-shadow(0 0 6px var(--aqua))"/>
    ${dots}
    <g>
      <rect x="${(X(pi) - 30).toFixed(0)}" y="${(Y(ser[pi].y) - 38).toFixed(0)}" width="78" height="28" rx="7"
            fill="${ser[pi].y > (o.amp || 1e9) ? 'var(--cri)' : 'var(--aqua2)'}"/>
      <text x="${(X(pi) + 9).toFixed(0)}" y="${(Y(ser[pi].y) - 19).toFixed(0)}" text-anchor="middle" fill="#fff"
            font-family="Sora" font-weight="800" font-size="13">${ser[pi].y.toFixed(1)} A</text>
    </g>
  </svg>`;
}

// ── Diagnóstico (filas DGA / Edad / etc.) ────────────────────
function diagRow(k, score) {
  if (score == null) {
    return `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">
      <span class="muted" style="font-size:13px">${k}</span>
      <span style="font-weight:700;color:var(--ink3)">Sin dato</span>
    </div>`;
  }
  const m = DIAG_MAP[Math.round(score)] || ['—', 'ink3'];
  const col = m[1] === 'ink3' ? 'var(--ink3)' : `var(--${m[1]})`;
  return `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">
    <span class="muted" style="font-size:13px">${k}</span>
    <span style="font-weight:700;color:${col}">${m[0]}</span>
  </div>`;
}

// ── Renderer principal del modal ────────────────────────────
export function renderModal() {
  const overlay = $('#overlay');
  const body = $('#modalBody');
  if (!overlay || !body) return;
  const { detailIndex, detailWin, rows } = store.state;

  if (detailIndex == null || !rows[detailIndex]) {
    overlay.classList.remove('show');
    return;
  }
  const d = rows[detailIndex];
  const o = d.P;
  const s = sev(d.cmax);
  const col = SEVCOL[s];
  const margin = (o.amp && o.car != null) ? (o.amp - o.car) : null;
  const marginPct = (o.amp && o.car != null) ? ((o.amp - o.car) / o.amp * 100) : null;
  const condCri = (d.cond || '').toUpperCase().includes('OBSOLET');

  const steps = [
    ['1', 'Reconocer alerta',           'Operador confirma evento y registra causa raíz', 'done'],
    ['2', 'Redistribución de carga',    'Transferir carga a TX adyacente vía maniobra de red', 'active'],
    ['3', 'Programar intervención',     'Orden de trabajo a mantenimiento · ventana nocturna', 'pend'],
    ['4', condCri ? 'Evaluar repotenciación' : 'Seguimiento',
      'Equipo ' + (condCri ? 'OBSOLETO: evaluar reposición' : 'en observación'), 'pend'],
  ];
  const wf = steps.map(st => {
    let bg, line;
    if (st[3] === 'done')   { bg = 'background:var(--ok);color:#06222A'; line = 'var(--ok)'; }
    else if (st[3] === 'active') { bg = 'background:linear-gradient(145deg,var(--aqua),var(--aqua2));color:#06222A'; line = 'var(--aqua)'; }
    else { bg = 'background:rgba(255,255,255,.1);color:var(--ink2)'; line = 'rgba(255,255,255,.12)'; }
    return `<div class="wf-step">
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="wf-num" style="${bg}">${st[3] === 'done' ? '✓' : st[0]}</div>
        <div style="width:2px;flex:1;background:${line};margin:2px 0;min-height:14px"></div>
      </div>
      <div style="padding-bottom:14px">
        <div class="disp" style="font-weight:700;font-size:13.5px">${st[1]}</div>
        <div class="muted" style="font-size:11.5px;margin-top:2px">${st[2]}</div>
      </div>
    </div>`;
  }).join('');

  const spec = (k, v) => `<div class="spec"><div class="k">${k}</div><div class="v mono">${v}</div></div>`;

  body.innerHTML = `
    <div class="glass panel" style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding-right:60px">
      <div style="width:58px;height:58px;border-radius:16px;background:linear-gradient(145deg,${col},#FF8AA0);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -6px ${col}">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
      </div>
      <div style="flex:1;min-width:240px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="disp" style="font-size:23px;font-weight:800">Subestación ${d.sub}</span>
          <span class="pill bg-${s}"><span class="dot" style="background:${col};color:${col}"></span>${SEVLBL[s].toUpperCase()} · ${d.cmax == null ? '—' : d.cmax.toFixed(0) + '%'}</span>
          <span class="pill" style="background:rgba(255,255,255,.08);color:var(--ink2);font-size:11px">Cond. ${d.cond}</span>
        </div>
        <div class="tag" style="margin-top:4px">Matrícula ${d.id} · Zona ${cap(d.zona)} · ${cap(d.dep)} · Grupo ${d.grupo} · ${fmt(d.us)} usuarios</div>
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        ${spec('Potencia', fmt(d.pot) + ' kVA')}
        ${spec('Tensión', d.vp + ' / ' + d.vs + (d.vt !== 'N/A' ? ' / ' + d.vt : '') + ' kV')}
        ${spec('Refrig.', d.refrig || '—')}
        ${spec('Regul.', d.reg || '—')}
        ${spec('UUCC', d.uucc || '—')}
      </div>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div style="flex:2;min-width:520px;display:flex;flex-direction:column;gap:16px">
        <div class="glass panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 style="margin:0;font-size:15px">Tendencia de corriente · Devanado Primario</h3>
            <div style="display:flex;gap:6px" id="winToggle">
              ${['24h', '7d', '30d'].map(w => `<button class="btn ${w === detailWin ? 'on' : ''}" data-win="${w}" style="padding:6px 12px;font-size:11.5px">${w === '24h' ? '24 h' : w === '7d' ? '7 d' : '30 d'}</button>`).join('')}
            </div>
          </div>
          <div class="legend" style="margin-bottom:10px">
            <span style="color:var(--aqua)">● Corriente medida (A)</span>
            <span style="color:var(--avi)">— Ampacidad ${fmt(o.amp, 1)} A</span>
            <span style="color:var(--ale)">— 1er Límite ${fmt(o.l1, 1)} A</span>
            <span style="color:var(--cri)">— 2º Límite ${fmt(o.l2, 1)} A</span>
          </div>
          <div id="trend">${trendSVG(d, detailWin)}</div>
          <div class="muted" style="margin-top:6px">
            ${d.cmax > 100 ? 'Corriente supera la ampacidad nominal y el 1er límite SCADA en el pico de demanda.' : 'Equipo operando dentro de su capacidad nominal en la ventana observada.'}
            <i style="color:var(--ink3)">Serie de perfil — pendiente conexión SCADA histórica.</i>
          </div>
        </div>
        <div class="glass panel" style="display:flex;align-items:center;justify-content:space-around;gap:10px;flex-wrap:wrap">
          <div style="max-width:160px">
            <div class="tag" style="margin-bottom:8px">Cargabilidad por devanado</div>
            <div class="muted" style="font-size:11.5px">Estado instantáneo de cada devanado frente a su ampacidad nominal.</div>
          </div>
          ${gauge('Primario', d.P.pct, fmt(d.P.car, 1) + ' / ' + fmt(d.P.amp, 1) + ' A')}
          ${gauge('Secundario', d.S.pct, d.S.amp ? fmt(d.S.car, 1) + ' / ' + fmt(d.S.amp, 1) + ' A' : 'N/A')}
          ${gauge('Terciario', d.T.pct, d.T.amp ? fmt(d.T.car, 1) + ' / ' + fmt(d.T.amp, 1) + ' A' : 'N/A')}
        </div>
      </div>
      <div style="flex:1;min-width:300px;display:flex;flex-direction:column;gap:16px">
        <div class="glass panel">
          <h3 style="margin:0 0 10px;font-size:15px">Diagnóstico de condición</h3>
          ${diagRow(DIAG_LABEL.carg, d.diag.carg)}
          ${diagRow(DIAG_LABEL.edad, d.diag.edad)}
          ${diagRow(DIAG_LABEL.dga,  d.diag.dga)}
          ${diagRow(DIAG_LABEL.fur,  d.diag.fur)}
          ${diagRow(DIAG_LABEL.herm, d.diag.herm)}
          <div style="display:flex;justify-content:space-between;padding:9px 0;font-size:13px">
            <span class="muted" style="font-size:13px">Condición</span>
            <span style="font-weight:700;color:${condCri ? 'var(--cri)' : 'var(--ok)'}">${d.cond}</span>
          </div>
          <div style="margin-top:8px;padding:11px 13px;border-radius:12px;background:${margin != null && margin < 0 ? 'rgba(251,80,112,.12)' : 'rgba(52,211,153,.1)'};border:1px solid ${margin != null && margin < 0 ? 'rgba(251,80,112,.3)' : 'rgba(52,211,153,.25)'};font-size:12px;color:${margin != null && margin < 0 ? '#FFB0BF' : '#9BF3D3'}">
            Cargabilidad restante: <b>${margin == null ? '—' : fmt(margin, 1) + ' A (' + fmt(marginPct, 0) + '%)'}</b> en primario.${margin != null && margin < 0 ? ' Equipo operando por encima de su capacidad nominal.' : ''}
          </div>
        </div>
        <div class="glass panel" style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 style="margin:0;font-size:15px">Workflow de mitigación</h3>
            <span class="pill bg-avi" style="font-size:11px">En curso · 2/4</span>
          </div>
          ${wf}
        </div>
      </div>
    </div>`;

  // Listeners del toggle de ventana 24h/7d/30d
  body.querySelectorAll('#winToggle .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.dataset.win;
      store.setDetailWin(w);
    });
  });

  overlay.classList.add('show');
}
