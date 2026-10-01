// ══════════════════════════════════════════════════════════════
// Renderer · Modal de detalle (drill-down)
// Reúne: medidores por devanado · enlace a las curvas horarias MEDIDAS por el
// SCADA (página «Cargabilidad SCADA», `99 §122`; reemplazó la curva de ejemplo,
// `99 §124`) · diagnóstico con las 7 calificaciones de Salud de Activos
// (`domain/cargabilidad_diagnostico.js`) · workflow de REFERENCIA (4 pasos, no
// estado real) · ficha técnica. Lo que la ventana afirma sale de
// `domain/cargabilidad_detalle.js`: lo que falta es «—», nunca un valor.
// ══════════════════════════════════════════════════════════════

import { $, fmt, cap } from './_helpers.js';
import { sev } from '../../../domain/cargabilidad_severidad.js';
import { SEVCOL, SEVLBL, DEV_LABEL } from '../../../domain/cargabilidad_config.js';
// Lo que la ventana afirma de un equipo: lo que falta sale «—», nunca un valor.
import {
  SIN_DATO, textoODash, condicionDe, fraseCarga, tensionTexto,
  estadoDevanado, devanadoReferencia, lecturaSobrecarga,
} from '../../../domain/cargabilidad_detalle.js';
import { calificacionesDe } from '../../../domain/cargabilidad_diagnostico.js';
import { store } from '../state.js';

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

// ── Punto de color de la escala oficial ─────────────────────
// El texto va claro (contraste sobre el fondo oscuro) y el color oficial
// (MO.00418, `schema.js`) en el punto.
const punto = (color) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle"></span>`;

// ── Una calificación de Salud de Activos ────────────────────
function filaCalificacion(c) {
  // El número como lo muestra Salud de Activos: redondeado a 2 decimales, sin
  // ceros de más (1,5 y no 1,50), con coma.
  const r = c.valor == null ? null : Math.round(c.valor * 100) / 100;
  const dec = r == null || Number.isInteger(r) ? 0 : (Number.isInteger(r * 10) ? 1 : 2);
  const valor = r == null ? ''
    : ` <span class="muted" style="font-weight:400;font-size:11.5px">(${fmt(r, dec)})</span>`;
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">
    <span class="muted" style="font-size:13px">${c.nombre}</span>
    <span style="font-weight:700;color:${c.color ? 'var(--ink)' : 'var(--ink3)'}">${c.color ? punto(c.color) : ''}${c.texto}${valor}</span>
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
  const { detailIndex, rows } = store.state;

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
  // Diagnóstico = calificaciones de Salud de Activos (`99 §124`). Las filas del
  // parque NO traen el `diag` del archivo retirado: leerlo reventaba la ventana.
  const califs = calificacionesDe(d);
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
          <h3 style="margin:0 0 10px;font-size:15px">Curvas horarias · medidas del SCADA</h3>
          <div class="muted" style="font-size:12.5px;margin-bottom:14px">La carga hora por hora de este transformador —medida por el SCADA— se ve en «Cargabilidad SCADA» cuando están cargados la homologación y el mes.</div>
          ${store.state.source === 'baseline-demo'
            ? `<span class="muted" style="font-size:12px">Equipo de demostración: no tiene curvas.</span>`
            : d.id
              ? `<a class="btn" href="cargabilidad-scada.html#mat=${encodeURIComponent(d.id)}${d.docId ? '&id=' + encodeURIComponent(d.docId) : ''}" target="_top" style="display:inline-block;padding:8px 14px;font-size:12.5px;color:var(--ink);text-decoration:none">Abrir sus curvas en Cargabilidad SCADA →</a>`
              : `<span class="muted" style="font-size:12px">Sin matrícula: no se puede abrir su curva.</span>`}
        </div>
        <div class="glass panel" style="display:flex;align-items:center;justify-content:space-around;gap:10px;flex-wrap:wrap">
          <div style="max-width:160px">
            <div class="tag" style="margin-bottom:8px">Cargabilidad por devanado</div>
            <div class="muted" style="font-size:11.5px">Corriente registrada en Salud de Activos de cada devanado frente a su ampacidad nominal.</div>
          </div>
          ${gauge('Primario', d.P.pct, subMedidor(d, 'P'))}
          ${gauge('Secundario', d.S.pct, subMedidor(d, 'S'))}
          ${gauge('Terciario', d.T.pct, subMedidor(d, 'T'))}
          <div style="flex-basis:100%;font-size:12.5px;color:var(--ink2);margin-top:4px">${fraseCarga(d)}</div>
        </div>
      </div>
      <div style="flex:1;min-width:300px;display:flex;flex-direction:column;gap:16px">
        <div class="glass panel">
          <h3 style="margin:0 0 4px;font-size:15px">Diagnóstico de condición</h3>
          <div class="muted" style="font-size:11.5px;margin-bottom:6px">Calificaciones de Salud de Activos · MO.00418 (1 Muy Bueno … 5 Muy Pobre)</div>
          ${califs.map(filaCalificacion).join('')}
          <div style="display:flex;justify-content:space-between;padding:9px 0;font-size:13px">
            <span class="muted" style="font-size:13px">Condición</span>
            <span style="font-weight:700;color:var(--ink)">${cond.color ? punto(cond.color) : ''}${cond.texto}</span>
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

  const abriendo = !overlay.classList.contains('show');
  overlay.classList.add('show');
  if (abriendo) llevarALaVista(overlay);
}
