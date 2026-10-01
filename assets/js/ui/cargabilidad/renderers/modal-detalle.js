// ══════════════════════════════════════════════════════════════
// Renderer · Modal de detalle (drill-down)
// Reúne: gauge SVG por devanado · trend SVG con perfil ILUSTRATIVO (no
// medido) · diagnóstico de 5 calificaciones (las filas del parque no las
// traen: «—») · workflow de REFERENCIA (4 pasos, no estado real) · ficha
// técnica. Lo que la ventana afirma sale de `domain/cargabilidad_detalle.js`.
// ══════════════════════════════════════════════════════════════

import { $, fmt, cap } from './_helpers.js';
import { sev } from '../../../domain/cargabilidad_severidad.js';
import {
  SEVCOL, SEVLBL, DIAG_MAP, PROFILE_24H, DIAG_LABEL, DEV_LABEL,
} from '../../../domain/cargabilidad_config.js';
// Lo que la ventana afirma de un equipo: lo que falta sale «—», nunca un valor.
import {
  SIN_DATO, textoODash, diagnosticoDe, condicionDe, fraseCarga, picoPrimario, tensionTexto,
  estadoDevanado, devanadoReferencia, lecturaSobrecarga,
} from '../../../domain/cargabilidad_detalle.js';
import { store } from '../state.js';

// ── Generación de series sintéticas (24h / 7d / 30d) ─────────
// Perfil ILUSTRATIVO, no medido: la forma es inventada y solo la escala sale
// de la medida registrada. Por eso ningún punto puede pasar de esa medida (el
// tope era 1,02 y en 7 d/30 d dibujaba una sobrecarga que nadie midió): la
// serie se normaliza para que su máximo sea EXACTAMENTE la medida.
function makeSeries(peak, win) {
  if (win === '24h') return PROFILE_24H.map((p, i) => ({
    x: i, y: peak * p, lbl: String(i).padStart(2, '0') + 'h',
  }));
  const days = win === '7d' ? 7 : 30;
  const fs = [];
  for (let i = 0; i < days; i++) {
    const f = 0.82 + 0.18 * Math.sin(i * 1.1) + ((i * 97 % 13) / 13 - 0.5) * 0.12;
    fs.push(Math.max(0.5, f));
  }
  const fmax = Math.max(...fs);
  return fs.map((f, i) => ({
    x: i, y: peak * f / fmax,
    lbl: win === '7d' ? 'D' + (i + 1) : String(i + 1),
  }));
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
      <text x="64" y="60" text-anchor="middle" font-family="Sora" font-weight="800" font-size="26" fill="${col}">${pct == null ? SIN_DATO : pct.toFixed(0) + '%'}</text>
      <text x="64" y="80" text-anchor="middle" font-size="10.5" fill="#9FC9C8">${sub}</text>
    </svg>
    <div class="disp" style="font-weight:700;font-size:13px;margin-top:-4px">${label}</div>
  </div>`;
}

// ── Trend chart SVG ─────────────────────────────────────────
function trendSVG(d, win) {
  const o = d.P;
  // Sin corriente medida en el primario no se dibuja nada: `car || 0` pintaba
  // una curva en «0,0 A» que nadie midió.
  const peak = picoPrimario(d);
  if (peak == null) {
    return `<div class="muted" style="padding:28px 0;text-align:center">${SIN_DATO} Sin corriente medida en el primario: no hay curva que dibujar.</div>`;
  }
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
  // Los puntos son del perfil ilustrativo: ninguno se pinta en rojo, porque
  // no son medidas. Solo la etiqueta del máximo —que ES la medida registrada—
  // se pinta en rojo si esa medida pasa la ampacidad.
  const dots = pts.map((p) =>
    `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="var(--aqua)"/>`
  ).join('');
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
            font-family="Sora" font-weight="800" font-size="13">${fmt(ser[pi].y, 1)} A</text>
    </g>
  </svg>`;
}

// ── Diagnóstico (filas DGA / Edad / etc.) ────────────────────
function diagRow(k, score) {
  if (score == null) {
    return `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">
      <span class="muted" style="font-size:13px">${k}</span>
      <span style="font-weight:700;color:var(--ink3)">${SIN_DATO}</span>
    </div>`;
  }
  const m = DIAG_MAP[Math.round(score)] || ['—', 'ink3'];
  const col = m[1] === 'ink3' ? 'var(--ink3)' : `var(--${m[1]})`;
  return `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">
    <span class="muted" style="font-size:13px">${k}</span>
    <span style="font-weight:700;color:${col}">${m[0]}</span>
  </div>`;
}

// ── Sobrecarga admisible (IEEE C57.91) ──────────────────────
// Cuando el devanado opera POR ENCIMA de su ampacidad (factor > 1), estima el
// tiempo admisible de sobrecarga y la aceleración de envejecimiento del
// aislamiento con la curva simplificada IEEE C57.91 (§4.1.3 MO.00418). El
// veredicto sale del VALOR (factor = corriente/ampacidad) contra la tabla
// normativa, no de datos fabricados. Se rotula ESTIMACIÓN — la tabla es
// indicativa (sobrecarga sostenida desde carga nominal, 30 °C) y no sustituye
// la curva térmica del fabricante. Se muestra la carga MEDIDA (% de la
// ampacidad) y, aparte, el escalón de la tabla con que se estiman los minutos
// (antes se mostraba el escalón como si fuera el factor del equipo); el
// envejecimiento sale de la carga medida. Por encima del último escalón no se
// estima. Sin sobrecarga (factor ≤ 1) no se muestra. Cero lecturas Firestore.
function sobrecargaAdmisibleCard(o, nombreDev) {
  const l = lecturaSobrecarga(o);
  if (!l) return '';
  const min = l.minutos;
  const tFmt = (min == null)
    ? SIN_DATO
    : (min >= 60 ? `${fmt(min / 60, 1)} h (${min} min)` : `${min} min`);
  const faaFmt = (l.envejecimiento == null) ? SIN_DATO : `${fmt(l.envejecimiento, 1)}×`;
  const cuerpo = l.fueraDeTabla
    ? `Carga medida <b>${fmt(l.pct, 1)} %</b> de la ampacidad del ${nombreDev}: por encima de ${fmt(l.tope * 100, 0)} %, el último escalón de la tabla simplificada, que no permite estimar tiempo admisible ni envejecimiento.`
    : `Carga medida <b>${fmt(l.pct, 1)} %</b> de la ampacidad del ${nombreDev} · tiempo admisible <b>${tFmt}</b> (escalón <b>${fmt(l.escalon, 2)}×</b> de la tabla, el más cercano) · envejecimiento del aislamiento <b>${faaFmt}</b> (con la carga medida).`;
  return `<div style="margin-top:8px;padding:11px 13px;border-radius:12px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);font-size:12px;color:#FCD9A6">
    <div style="font-weight:700;margin-bottom:3px">⚠ Sobrecarga admisible (estimación)</div>
    ${cuerpo}
    <div style="color:var(--ink3);margin-top:5px;font-size:11px"><i>IEEE C57.91 §7 · MO.00418 §4.1.3 — curva simplificada; trata la sobrecarga medida como sostenida a 30 °C. Orientativo, no sustituye la curva térmica del fabricante.</i></div>
  </div>`;
}

// ── Subtítulo de cada medidor ───────────────────────────────
// Antes: «N/A» (no aplica) para todo lo que faltara, y la corriente de un
// devanado sin ampacidad no aparecía en ninguna parte.
function subMedidor(d, k) {
  const o = d[k] || {};
  switch (estadoDevanado(d, k)) {
    case 'medido':        return fmt(o.car, 1) + ' / ' + fmt(o.amp, 1) + ' A';
    case 'sin_ampacidad': return fmt(o.car, 1) + ' A medidos';
    case 'sin_medida':    return SIN_DATO + ' / ' + fmt(o.amp, 1) + ' A';
    case 'no_aplica':     return 'No aplica';
    default:              return 'Sin dato';
  }
}

// ── La ventana, a la vista dentro de la pestaña ─────────────
// En «Seguimiento Operativo» esta página vive en un iframe que la página madre
// estira a todo su alto (sin scroll propio). El fondo `position:fixed` cubre
// entonces el iframe ENTERO y la ventana se pintaba arriba del todo, fuera de
// la vista de quien bajó hasta la tabla: se oscurecía la pantalla y «el clic
// no abría nada». Mover la página madre no sirve (el navegador no la desplaza
// por un elemento fijo), así que al ABRIR se baja la ventana —y su X— hasta
// la primera franja del iframe que DE VERDAD se ve: debajo de todo lo fijo de
// la madre (la barra superior `.tb` y la barra de pestañas, ambas fijas; en
// producción la de pestañas tapaba la X). Se busca con `elementFromPoint` en
// la columna de la X, sin suponer qué barras hay. Al cerrar, la tabla sigue
// donde estaba. Abierta directamente (sin iframe) o con una madre de otro
// origen, no se desplaza nada.
function bajadaEnIframe(xArriba) {
  try {
    if (window.parent === window) return 0;
    const marco = window.frameElement;            // null si la madre es de otro origen
    if (!marco) return 0;
    const madre = window.parent;
    const r = marco.getBoundingClientRect();
    const columna = Math.min(r.right, madre.innerWidth) - 30;   // donde va la X
    const hasta = Math.min(r.bottom, madre.innerHeight);
    // Una franja LIBRE de 48 px (cabe la X con margen): entre la barra superior
    // y la de pestañas hay una rendija de ~14 px donde el iframe asoma.
    const libre = (y0) => {
      for (let k = 0; k <= 48; k += 8) {
        if (madre.document.elementFromPoint(columna, y0 + k) !== marco) return false;
      }
      return true;
    };
    let y = Math.max(0, Math.ceil(r.top));
    while (y < hasta && !libre(y)) y += 4;
    if (y >= hasta) return 0;
    // La X queda 12 px debajo de lo fijo (y la ventana, debajo de la X, donde
    // la pone el padding del fondo).
    return Math.max(0, Math.round(y + 12 - xArriba - r.top));
  } catch (_) { return 0; }
}

// La X se amarra a la esquina de la ventana (`position:relative` en `.modal`):
// si siguiera colgada del fondo, durante la animación de apertura —que pone un
// `transform` en `.modal` y la vuelve su referencia— saltaría `bajar` píxeles.
// Queda donde siempre respecto a la ventana. Las medidas (padding del fondo,
// top/right de la X) se LEEN de `seguimiento-cargabilidad.css`, no se copian.
function llevarALaVista(overlay) {
  const m = overlay.querySelector('.modal');
  const x = overlay.querySelector('.close');
  if (m) { m.style.marginTop = ''; m.style.position = ''; }
  if (x) { x.style.top = ''; x.style.right = ''; }
  if (!m || !x) return;
  const cf = getComputedStyle(overlay);
  const cx = getComputedStyle(x);
  const px = (v) => parseFloat(v) || 0;
  const bajar = bajadaEnIframe(px(cx.top));
  if (!bajar) return;
  m.style.marginTop = bajar + 'px';
  m.style.position = 'relative';
  x.style.top = (px(cx.top) - px(cf.paddingTop)) + 'px';
  x.style.right = (px(cx.right) - px(cf.paddingRight)) + 'px';
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
  // Las fuentes vivas traen siempre P, S y T; una fila sin alguno (p. ej. de la
  // colección en tiempo real, hoy vacía) no debe reventar la ventana.
  const fila = rows[detailIndex];
  const d = { ...fila, P: fila.P || {}, S: fila.S || {}, T: fila.T || {} };
  const o = d.P;
  const s = sev(d.cmax);
  const col = SEVCOL[s];
  // La «Cargabilidad restante» y la sobrecarga se leen en el devanado MÁS
  // cargado (antes, siempre el primario: con el secundario sobrecargado la
  // caja salía verde y la estimación no aparecía).
  const kRef = devanadoReferencia(d);
  const oRef = d[kRef] || o;
  const nombreRef = DEV_LABEL[kRef].toLowerCase();
  const margin = (oRef.amp && oRef.car != null) ? (oRef.amp - oRef.car) : null;
  const marginPct = (oRef.amp && oRef.car != null) ? ((oRef.amp - oRef.car) / oRef.amp * 100) : null;
  const condCri = (d.cond || '').toUpperCase().includes('OBSOLET');
  // Las filas del parque NO traen `diag` (tampoco el baseline): leer `d.diag.carg`
  // reventaba la ventana antes de mostrarse. Sin dato, cada fila sale «—».
  const diag = diagnosticoDe(d);
  const cond = condicionDe(d.cond);

  const steps = [
    // Estados NEUTROS a propósito (G020): es un flujo de REFERENCIA, no un
    // estado operativo real. No afirmar "paso 1 hecho / paso 2 en curso" —
    // eso fabricaría datos (mismo estado para todo TX). Pendiente cablearlo al
    // sistema real de órdenes de trabajo.
    ['1', 'Reconocer alerta',           'Operador confirma evento y registra causa raíz', 'pend'],
    ['2', 'Redistribución de carga',    'Transferir carga a TX adyacente vía maniobra de red', 'pend'],
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

  // La ventana habla de corriente «medida» / «registrada». Con la simulación
  // encendida (o sus valores aún puestos) o con los equipos de demostración, eso
  // no es cierto: se dice arriba, con todas las letras.
  const simulada = store.state.live || ['P', 'S', 'T'].some((k) =>
    fila._base && fila._base[k] != null && fila[k] && fila[k].car !== fila._base[k]);
  const aviso = simulada
    ? 'SIMULACIÓN ACTIVA: las corrientes de esta ventana son simuladas, NO medidas.'
    : (store.state.source === 'baseline-demo'
      ? 'Equipo de DEMOSTRACIÓN: no es un transformador de su parque.' : '');

  body.innerHTML = `${aviso ? `
    <div class="glass panel" style="padding:12px 16px;background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.4);color:#FCD9A6;font-weight:700;font-size:13px">⚠ ${aviso}</div>` : ''}
    <div class="glass panel" style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding-right:60px">
      <div style="width:58px;height:58px;border-radius:16px;background:linear-gradient(145deg,${col},#FF8AA0);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -6px ${col}">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
      </div>
      <div style="flex:1;min-width:240px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="disp" style="font-size:23px;font-weight:800">Subestación ${d.sub}</span>
          <span class="pill bg-${s}"><span class="dot" style="background:${col};color:${col}"></span>${SEVLBL[s].toUpperCase()} · ${d.cmax == null ? '—' : d.cmax.toFixed(0) + '%'}</span>
          <span class="pill" style="background:rgba(255,255,255,.08);color:var(--ink2);font-size:11px">Cond. ${cond.texto}</span>
        </div>
        <div class="tag" style="margin-top:4px">Matrícula ${d.id} · Zona ${textoODash(cap(d.zona))} · ${textoODash(cap(d.dep))} · Grupo ${textoODash(d.grupo)} · ${fmt(d.us)} usuarios</div>
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        ${spec('Potencia', d.pot == null ? SIN_DATO : fmt(d.pot) + ' kVA')}
        ${spec('Tensión', tensionTexto(d))}
        ${spec('Refrig.', textoODash(d.refrig))}
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
            <span style="color:var(--aqua)">● Perfil ilustrativo, escalado a la corriente medida (A)</span>
            <span style="color:var(--avi)">— Ampacidad ${fmt(o.amp, 1)} A</span>
            <span style="color:var(--ale)">— 1er Límite ${fmt(o.l1, 1)} A</span>
            <span style="color:var(--cri)">— 2º Límite ${fmt(o.l2, 1)} A</span>
          </div>
          <div id="trend">${trendSVG(d, detailWin)}</div>
          <div class="muted" style="margin-top:6px">
            ${fraseCarga(d)}
            <i style="color:var(--ink3)">La forma de la curva NO es medida: solo su máximo es la corriente registrada. Pendiente conexión SCADA histórica.</i>
          </div>
        </div>
        <div class="glass panel" style="display:flex;align-items:center;justify-content:space-around;gap:10px;flex-wrap:wrap">
          <div style="max-width:160px">
            <div class="tag" style="margin-bottom:8px">Cargabilidad por devanado</div>
            <div class="muted" style="font-size:11.5px">Corriente registrada de cada devanado frente a su ampacidad nominal.</div>
          </div>
          ${gauge('Primario', d.P.pct, subMedidor(d, 'P'))}
          ${gauge('Secundario', d.S.pct, subMedidor(d, 'S'))}
          ${gauge('Terciario', d.T.pct, subMedidor(d, 'T'))}
        </div>
      </div>
      <div style="flex:1;min-width:300px;display:flex;flex-direction:column;gap:16px">
        <div class="glass panel">
          <h3 style="margin:0 0 10px;font-size:15px">Diagnóstico de condición</h3>
          ${diagRow(DIAG_LABEL.carg, diag.carg)}
          ${diagRow(DIAG_LABEL.edad, diag.edad)}
          ${diagRow(DIAG_LABEL.dga,  diag.dga)}
          ${diagRow(DIAG_LABEL.fur,  diag.fur)}
          ${diagRow(DIAG_LABEL.herm, diag.herm)}
          <div style="display:flex;justify-content:space-between;padding:9px 0;font-size:13px">
            <span class="muted" style="font-size:13px">Condición</span>
            <span style="font-weight:700;color:var(--ink)">${cond.color ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${cond.color};margin-right:6px;vertical-align:middle"></span>` : ''}${cond.texto}</span>
          </div>
          <div style="margin-top:8px;padding:11px 13px;border-radius:12px;background:${margin == null ? 'rgba(255,255,255,.06)' : margin < 0 ? 'rgba(251,80,112,.12)' : 'rgba(52,211,153,.1)'};border:1px solid ${margin == null ? 'rgba(255,255,255,.12)' : margin < 0 ? 'rgba(251,80,112,.3)' : 'rgba(52,211,153,.25)'};font-size:12px;color:${margin == null ? 'var(--ink2)' : margin < 0 ? '#FFB0BF' : '#9BF3D3'}">
            Cargabilidad restante: <b>${margin == null ? '—' : fmt(margin, 1) + ' A (' + fmt(marginPct, 0) + '%)'}</b> en ${nombreRef}.${margin != null && margin < 0 ? ' Equipo operando por encima de su capacidad nominal.' : ''}
          </div>
          ${sobrecargaAdmisibleCard(oRef, nombreRef)}
        </div>
        <div class="glass panel" style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 style="margin:0;font-size:15px">Workflow de mitigación</h3>
            <span class="pill" style="background:rgba(255,255,255,.08);color:var(--ink2);font-size:11px">Flujo de referencia</span>
          </div>
          ${wf}
          <div class="muted" style="font-size:11.5px;margin-top:4px">
            <i style="color:var(--ink3)">Flujo de referencia — pendiente conexión al sistema de órdenes de trabajo.</i>
          </div>
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

  const abriendo = !overlay.classList.contains('show');
  overlay.classList.add('show');
  if (abriendo) llevarALaVista(overlay);
}
