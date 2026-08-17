// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Panel "Valores por prueba" (tabla + diagnóstico)
// ──────────────────────────────────────────────────────────────
// Vista por PRUEBA: su nombre como título + filtro de AÑO.
//   · "Todos los años" → resumen con el RANGO REAL mín–máx medido por fase
//     (dos valores reales del informe, nunca un promedio) + Σ pérdidas (W).
//   · un año concreto   → TABLA COMPLETA con TODOS los valores (todas las
//     posiciones de TAP / mediciones), discriminada por NIVEL DE TENSIÓN /
//     devanado / configuración.
// Cada grupo cierra con "Diagnóstico conforme a norma" (sellos NETA/IEEE +
// criterio/umbral + veredicto por norma + consolidado) y "Análisis y
// recomendación según resultados" (peor caso + tendencia + acción CBM).
//
// El VEREDICTO sale del VALOR vs NORMA, nunca del texto del laboratorio (L-36).
// REUSA dominio de producción (NO se reinventa, L-55): `nivelDe`/`perdidasDe`
// (excitacion-panel), `familiaMA`/`derivarTablaTAP`/`configInforme` (bloques),
// `evaluarMultiNorma` (multinorma), `accionPrueba` (recomendaciones). NO toca
// el scorecard ni los paneles tan δ / excitación. Helpers puros → node --test.
// ══════════════════════════════════════════════════════════════

import { familiaMA, derivarTablaTAP, quitarColumnasVeredicto } from '../../domain/pruebas_electricas_bloques.js';
import { evaluarMultiNorma } from '../../domain/pruebas_electricas_multinorma.js';
import { accionPrueba } from '../../domain/pruebas_electricas_recomendaciones.js';
import { nivelDe, perdidasDe } from './excitacion-panel.js';

const num = (v) => (typeof v === 'number' && isFinite(v)) ? v
  : (v != null && v !== '' && isFinite(Number(v)) ? Number(v) : null);
const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const fmt = (v) => (v == null ? '—' : round(v, 2));
const avg = (a) => { const x = a.filter((v) => v != null); return x.length ? x.reduce((p, c) => p + c, 0) / x.length : null; };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ORDEN = ['tand', 'bushing', 'excitacion', 'relacion', 'resistencia', 'aislamiento', 'collar'];

const NOMBRE = {
  tand: 'Tan δ / FP · aislamiento del transformador',
  bushing: 'Factor de potencia de bujes (C1)',
  excitacion: 'Corriente de excitación',
  relacion: 'Relación de transformación',
  resistencia: 'Resistencia de devanados',
  aislamiento: 'Resistencia de aislamiento (CC)',
  collar: 'Collar caliente / pérdidas en bujes'
};

const NORMA = {
  excitacion: { franja: '<b>NETA</b> §7.2.2.D.6 · patrón 2+1 &nbsp;·&nbsp; <b>IEEE</b> Std 62 / C57.152 · Δ ext ≤ 5–10%', chips: ['NETA', 'IEEE'] },
  relacion: { franja: '<b>NETA</b> §7.2.2.D.3 &nbsp;·&nbsp; <b>IEEE</b> C57.152 §7.2.10 · ±0.5% vs placa', chips: ['NETA', 'IEEE'] },
  resistencia: { franja: '<b>NETA</b> ATS §7.2.2.D.8 · Δ entre fases ≤ 2%', chips: ['NETA'] },
  aislamiento: { franja: '<b>NETA</b> Tabla 100.5 · ≥ mínimo por CLASE de tensión (⚠️ verificar) · piso 5 GΩ', chips: ['NETA'] },
  bushing: { franja: '<b>NETA</b> §7.2.2.D.5 &nbsp;·&nbsp; <b>IEEE</b> C57.19.100 · tan δ ≤ 1%', chips: ['NETA', 'IEEE'] },
  tand: { franja: '<b>NETA</b> 100.3 · ≤1% (aceite mineral) &nbsp;·&nbsp; <b>IEEE</b> C57.12.90 · ≤0.5% nuevo', chips: ['NETA', 'IEEE'] },
  collar: { franja: '<b>Doble</b> TDRB · &lt; 100 mW (práctica, set 10 kV)', chips: ['DOBLE'] }
};

// kind: 'desb' (desbalance entre fases) | 'max' (valor ≤ umbral) | 'min' (valor ≥ umbral)
const CRIT = {
  excitacion: { kind: 'desb', limite: 10 },
  relacion: { kind: 'desb', limite: 0.5 },
  resistencia: { kind: 'desb', limite: 2 },
  aislamiento: { kind: 'min', min: 5, unidad: 'GΩ' },
  bushing: { kind: 'max', guia: 0.5, limite: 1, unidad: '%' },
  tand: { kind: 'max', guia: 0.5, limite: 1, unidad: '%' },
  collar: { kind: 'max', guia: 100, limite: 100, unidad: 'mW' }
};

const RANK = { na: -1, ok: 0, warn: 1, bad: 2 };
const peorEstado = (a, b) => (RANK[b] > RANK[a] ? b : a);
const EST_TXT = { ok: 'Cumple', warn: 'Vigilar', bad: 'No cumple', na: 's/d' };

const estadoDesb = (d, lim) => (d == null ? 'na' : Math.abs(d) <= lim ? 'ok' : Math.abs(d) <= lim * 2 ? 'warn' : 'bad');
const estadoMax = (v, guia, lim) => (v == null ? 'na' : v <= guia ? 'ok' : v <= lim ? 'warn' : 'bad');
const estadoMin = (v, mn) => (v == null ? 'na' : v >= mn ? 'ok' : v >= mn * 0.5 ? 'warn' : 'bad');

// Color de celda en las tablas de DETALLE: cataloga en ROJO el VALOR de tan δ que,
// según la norma, NO cumple (d-bad, > límite IEEE 1% — rojo negrita) o que recomienda
// INVESTIGAR (d-inv, > guía NETA 0.5% — rojo). Pedido del director. Acotado a 'tand'
// (módulo FP) y SOLO a la columna del propio tan δ (no Cap/Tensión/Desv). Devuelve el
// atributo `class` listo para interpolar (o '' si el valor está dentro de norma).
function claseCeldaTand(familia, header, v) {
  if (familia !== 'tand' || typeof v !== 'number') return '';
  if (!/^(tan\s*δ|valor)/i.test(String(header))) return '';
  const crit = CRIT[familia];
  if (crit.limite != null && v > crit.limite) return ' class="d-bad" title="No cumple — supera el límite IEEE 62/C57.152 (≤1%)"';
  if (crit.guia != null && v > crit.guia) return ' class="d-inv" title="Investigar — supera la guía NETA 100.3 (≤0.5%)"';
  return '';
}

// Etiqueta de discriminación (nivel de tensión / devanado / configuración) a
// partir del título del bloque. Cae al título limpio si no reconoce el patrón.
export function grupoDe(familia, titulo, config) {
  const t = String(titulo || '');
  if (familia === 'excitacion') {
    // Nivel REAL del devanado (AT 66/110 · MT 34.5 · BT 13.8) — NO la tensión de
    // ensayo del título. Reusa `nivelDe` de producción (config = estrella/delta).
    return nivelDe(t, config).label;
  }
  if (familia === 'relacion') {
    const m = t.match(/\b(AT|MT|BT)\s*\/\s*(AT|MT|BT)\b/);
    return m ? `${m[1]} / ${m[2]}` : t;
  }
  if (familia === 'resistencia') {
    const m = t.match(/\b(AT|MT|BT)\b(?:\s*y\s*\b(AT|MT|BT)\b)?/);
    return m ? (m[2] ? `${m[1]} / ${m[2]}` : m[1]) : t;
  }
  // bushing / aislamiento / tand / collar: título limpio (sin signos de apertura).
  return t.replace(/^[^0-9A-Za-zÁÉÍÓÚÑ]+/, '') || t;
}

// Analiza un bloque → { mode:'fases', faseNames, faseAvg[], desvMax } |
//                      { mode:'items', items:[{label, value, extra}] }
function analizarBloque(bloque) {
  const series = (bloque.series || []).filter((s) => (s.puntos || []).length);
  if (!series.length) return null;
  const xsets = series.map((s) => new Set(s.puntos.map((p) => String(p.x))));
  const compartenX = series.length >= 2 &&
    xsets.every((s) => s.size === xsets[0].size && [...s].every((x) => xsets[0].has(x)));
  if (compartenX) {
    const tabla = derivarTablaTAP(bloque); // reutiliza la derivación del tablero
    const n = series.length;
    const faseNames = tabla.columnas.slice(1, 1 + n);
    const colVals = (i) => tabla.filas.map((f) => num(f[1 + i])).filter((v) => v != null);
    const faseAvg = faseNames.map((_, i) => round(avg(colVals(i))));
    // Valores REALES (mín/máx medidos por fase) — no promedios.
    const faseMin = faseNames.map((_, i) => { const v = colVals(i); return v.length ? round(Math.min(...v)) : null; });
    const faseMax = faseNames.map((_, i) => { const v = colVals(i); return v.length ? round(Math.max(...v)) : null; });
    const di = tabla.columnas.indexOf('Desv. %');
    let desvMax = null;
    if (di >= 0) for (const f of tabla.filas) {
      const d = num(f[di]);
      if (d != null && (desvMax == null || Math.abs(d) > Math.abs(desvMax))) desvMax = d;
    }
    return { mode: 'fases', faseNames, faseAvg, faseMin, faseMax, desvMax };
  }
  const items = [];
  for (const s of series) for (const p of s.puntos) items.push({ label: String(p.x), value: num(p.y), extra: p.extra || null });
  return { mode: 'items', items };
}

/* ─── Render helpers (reusan clases pe-fus-* / pe-tabla) ───────── */
const badgeEstado = (e) => {
  const b = document.createElement('span');
  b.className = 'pe-tabla-badge is-' + (e === 'na' ? 'warn' : e);
  b.textContent = EST_TXT[e] || e;
  return b;
};
// Chip de veredicto POR NORMA según el nivel del semáforo (ESTADOS):
//   0 VERDE → ✓ cumple (is-ok) · 1-2 ÁMBAR/NARANJA → ⚠ investigar/vigilar (is-warn,
//   NO "no cumple") · ≥3 ROJO → ✕ fuera de norma (is-bad) · <0 informativa (is-na).
const chipNorma = (acron, nivel) => {
  const c = document.createElement('span');
  const cls = nivel === 0 ? 'is-ok' : nivel >= 3 ? 'is-bad' : nivel < 0 ? 'is-na' : 'is-warn';
  const sym = nivel === 0 ? '✓' : nivel >= 3 ? '✕' : nivel < 0 ? '·' : '⚠';
  const txt = nivel === 0 ? 'cumple' : nivel >= 3 ? 'no cumple (fuera de norma)' : nivel < 0 ? 'sin dato / cualitativa' : 'investigar / vigilar';
  c.className = 'pe-fus-chip ' + cls;
  c.textContent = sym + ' ' + acron;
  c.title = acron + ' — ' + txt;
  return c;
};
const nivelDeEstadoStr = (e) => (e === 'ok' ? 0 : e === 'bad' ? 3 : e === 'na' ? -1 : 2);
// Veredicto por norma del MISMO motor multi-norma que el diagnóstico de abajo
// (L-36/L-37: cada prueba se evalúa contra CADA norma; NUNCA un estado único para
// todas). Antes los chips usaban el consolidado para ambas → marcaban ✕ IEEE en un
// tan δ de 0.51% que SÍ cumple IEEE (≤1%). Si una óptica es informativa (sin
// veredicto numérico), cae al estado consolidado de la fila.
// Corriente de excitación de referencia (máx mA entre fases) de una o varias
// filas → la óptica IEEE elige el margen (Δ<10% si I<50 · Δ<5% si I≥50). Sin
// mA → null (calificador cae al 10%, sin regresión). `faseMax` sólo existe en
// filas modo 'fases' (excitación se mide por fase).
const corrienteExcMax = (...filas) => {
  const vals = filas.flatMap((f) => (f && Array.isArray(f.faseMax)) ? f.faseMax : [])
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  return vals.length ? Math.max(...vals) : null;
};
const ctxExcitacion = (familia, ...filas) =>
  familia === 'excitacion' ? { corrienteMA: corrienteExcMax(...filas) } : undefined;

const chipsCriterio = (familia, fila) => {
  const w = document.createElement('div'); w.className = 'pe-fus-chips';
  const ev = evaluarMultiNorma(familia, metricaFila(familia, fila), ctxExcitacion(familia, fila));
  (NORMA[familia].chips || ['NETA']).forEach((acron) => {
    const op = ev && ev.opticas && ev.opticas.find((o) => selloDe(o.norma).acron === acron && o.estado && o.estado.nivel >= 0);
    w.appendChild(chipNorma(acron, op ? op.estado.nivel : nivelDeEstadoStr(fila.estado)));
  });
  return w;
};
const tile = (v, u, l, cls) =>
  `<div class="pe-fus-tile ${cls || ''}"><div class="pe-fus-v">${v}<small>${u}</small></div><div class="pe-fus-l">${l}</div></div>`;

// Desbalance entre fases en bloques tipo ÍTEM: se calcula POR DEVANADO (prefijo
// antes de '-', ej. MT-A/MT-B/MT-C vs BT-A/BT-B/BT-C), nunca cruzando devanados.
function desvItems(items) {
  const groups = new Map();
  items.forEach((i) => {
    const k = String(i.label).split(/[-–—]/)[0].trim();
    if (!groups.has(k)) groups.set(k, []);
    if (i.value != null) groups.get(k).push(i.value);
  });
  let worst = null;
  for (const arr of groups.values()) {
    if (arr.length >= 2) {
      const m = avg(arr);
      const d = m ? Math.max(...arr.map((v) => Math.abs((v - m) / m * 100))) : null;
      if (d != null && (worst == null || d > worst)) worst = d;
    }
  }
  return worst;
}

/* ─── Diagnóstico conforme a norma (motor REAL `evaluarMultiNorma`) ───
 * No deja nada suelto: por cada grupo muestra la métrica peor-caso, el
 * veredicto de CADA norma (con su umbral), el consolidado conservador y
 * una conclusión accionable. Reusa el mismo motor que el scorecard (L-37). */
const DESC_METRICA = {
  excitacion: 'desbalance Δ ext entre fases laterales',
  relacion: 'desviación máxima vs placa',
  resistencia: 'desbalance máximo entre fases',
  tand: 'tan δ máximo medido',
  bushing: 'tan δ de buje máximo',
  aislamiento: 'resistencia de aislamiento mínima',
  collar: 'pérdida de collar máxima'
};
const unidadMetrica = (familia, filas) => {
  if (CRIT[familia].kind === 'desb') return '%';
  if (familia === 'aislamiento') return 'GΩ';
  if (familia === 'collar') return 'mW';
  return (filas[0] && filas[0].unidad) || '%';
};
const metricaGrupo = (familia, filas) => {
  const crit = CRIT[familia];
  const todos = filas.flatMap((f) => f.valores).filter((v) => v != null);
  if (crit.kind === 'desb') {
    const d = filas.reduce((m, f) => (f.desvMax != null && (m == null || Math.abs(f.desvMax) > Math.abs(m)) ? f.desvMax : m), null);
    return d == null ? null : Math.abs(d);
  }
  if (crit.kind === 'min') return todos.length ? Math.min(...todos) : null;
  return todos.length ? Math.max(...todos) : null;
};
const diagBadge = (e) => {
  if (!e || e.nivel < 0) return `<span class="pe-vp-diag-badge">${e ? esc(e.etiqueta) : 'sin dato'}</span>`;
  const cls = e.nivel === 0 ? 'is-ok' : e.nivel >= 3 ? 'is-bad' : 'is-warn';
  return `<span class="pe-vp-diag-badge ${cls}">${esc(e.etiqueta)}</span>`;
};
const conclusionDiag = (cons) => {
  const n = cons ? cons.nivel : -1;
  if (n < 0) return 'Sin métrica evaluable para emitir veredicto normativo en este conjunto.';
  if (n === 0) return 'Dentro de norma en todas las ópticas evaluables — sin acción requerida; mantener seguimiento de tendencia.';
  if (n === 1) return 'Vigilar: alguna norma pide verificación/tendencia. Comparar con ensayos previos y placa de fábrica antes de concluir.';
  if (n === 2) return 'Investigar: el valor supera el criterio de al menos una norma — repetir/ampliar el ensayo y revisar la causa probable.';
  return 'Fuera de norma: el peor caso excede el límite. Acción correctiva / análisis de causa raíz recomendado.';
};
// Métrica peor-caso de UNA fila (para tendencia y peor caso del grupo).
export function metricaFila(familia, f) {
  const crit = CRIT[familia];
  const vals = (f.valores || []).filter((v) => v != null);
  if (crit.kind === 'desb') return f.desvMax != null ? Math.abs(f.desvMax) : null;
  if (crit.kind === 'min') return vals.length ? Math.min(...vals) : null;
  return vals.length ? Math.max(...vals) : null;
}
// Tendencia año-a-año (primer vs último informe). Para 'min' (aislamiento) bajar = empeorar.
export function tendenciaFilas(familia, filas) {
  const crit = CRIT[familia];
  const ord = filas.slice().sort((a, b) => (a.ano || 0) - (b.ano || 0))
    .map((f) => metricaFila(familia, f)).filter((m) => m != null);
  if (ord.length < 2 || !ord[0]) return { tendencia: 'estable', delta: 0 };
  const first = ord[0], last = ord[ord.length - 1];
  const delta = round((last - first) / Math.abs(first) * 100, 1);
  const peor = crit.kind === 'min' ? last < first : last > first;
  const tendencia = Math.abs(delta) < 5 ? 'estable' : (peor ? 'empeora' : 'mejora');
  return { tendencia, delta };
}
// Fila con el peor caso del grupo.
export function peorCasoFila(familia, filas) {
  const crit = CRIT[familia];
  let best = null, bestM = null;
  filas.forEach((f) => {
    const m = metricaFila(familia, f);
    if (m == null) return;
    const worse = bestM == null || (crit.kind === 'min' ? m < bestM : m > bestM);
    if (worse) { bestM = m; best = f; }
  });
  return { fila: best, metrica: bestM };
}
const ACC_CLS = { 'b-g': 'is-ok', 'b-a': 'is-warn', 'b-r': 'is-bad', 'b-n': '' };

// Sello/emblema ESTILIZADO por norma (NO logotipo oficial — ADR-032, por copyright).
// Calca el diseño de `medallaNorma` (excitacion-panel.js): escudo + 2 círculos +
// acrónimo. Devuelve string SVG (el diagnóstico se arma por innerHTML).
function selloSVG(color, acron) {
  const fs = acron.length > 4 ? 7.5 : 9.5;
  return `<svg viewBox="0 0 48 58" width="30" height="36" aria-hidden="true" style="flex:none">` +
    `<path d="M17 39 L13 56 L24 50 L35 56 L31 39 Z" fill="${color}" opacity="0.85"/>` +
    `<circle cx="24" cy="22" r="20" fill="#fff" stroke="${color}" stroke-width="2.5"/>` +
    `<circle cx="24" cy="22" r="15.5" fill="none" stroke="${color}" stroke-width="1" opacity="0.45"/>` +
    `<text x="24" y="26" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${color}" font-family="system-ui, sans-serif">${esc(acron)}</text></svg>`;
}
// Acrónimo + color por norma (paleta de producción NORMAS_EXC / COLORES).
export function selloDe(norma) {
  const n = String(norma);
  if (/NETA/i.test(n)) return { acron: 'NETA', color: '#2c6e72' };
  if (/IEEE/i.test(n)) return { acron: 'IEEE', color: '#1f3a5f' };
  if (/IEC/i.test(n)) return { acron: 'IEC', color: '#6d597a' };
  if (/CIGRE/i.test(n)) return { acron: 'CIGRE', color: '#a4694f' };
  if (/Doble|Megger/i.test(n)) return { acron: 'DOBLE', color: '#46734b' };
  if (/MO\.?00418/i.test(n)) return { acron: 'MO', color: '#7a5c4b' };
  if (/industria|práctica|practica/i.test(n)) return { acron: 'IND', color: '#5d6d7e' };
  return { acron: 'NORMA', color: '#355c7d' };
}

function bloqueDiagnostico(familia, filas) {
  const metrica = metricaGrupo(familia, filas);
  const ev = evaluarMultiNorma(familia, metrica, ctxExcitacion(familia, ...(filas || [])));
  const wrap = document.createElement('div'); wrap.className = 'pe-vp-diag';
  let html = '<div class="pe-vp-diag-h">Diagnóstico conforme a norma</div>';
  html += `<div class="pe-vp-diag-metric">Métrica peor caso: <b>${fmt(metrica)} ${esc(unidadMetrica(familia, filas))}</b> · ${esc(DESC_METRICA[familia] || 'métrica peor caso')}</div>`;
  if (ev) {
    html += '<table class="pe-vp-diag-tbl"><thead><tr><th>Norma</th><th>Criterio / umbral</th><th>Veredicto</th></tr></thead><tbody>';
    ev.opticas.forEach((o) => {
      const s = selloDe(o.norma);
      const sello = `<span style="display:inline-flex;align-items:center;gap:8px">${selloSVG(s.color, s.acron)}<b>${esc(o.norma)}</b></span>`;
      html += `<tr><td>${sello}</td><td>${esc(o.umbral)}${o.nota ? ` <span class="pe-vp-diag-nota">(${esc(o.nota)})</span>` : ''}</td><td>${diagBadge(o.estado)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += `<div class="pe-vp-diag-cons">Consolidado (criterio conservador): ${diagBadge(ev.consolidado)}${ev.divergen ? ' <span class="pe-vp-diag-nota">· las normas divergen (esa divergencia ES información)</span>' : ''}</div>`;
    html += `<div class="pe-vp-diag-concl">${esc(conclusionDiag(ev.consolidado))}</div>`;
    // ── ANÁLISIS conforme a norma SEGÚN LOS RESULTADOS (capa de recomendación, ADR-012) ──
    const { tendencia, delta } = tendenciaFilas(familia, filas);
    const pc = peorCasoFila(familia, filas);
    const acc = accionPrueba(familia, { estado: ev.consolidado, divergen: ev.divergen, tendencia, delta });
    const u = unidadMetrica(familia, filas);
    const trendTxt = tendencia === 'estable' ? 'estable' : `${tendencia} (${delta > 0 ? '+' : ''}${delta}% del 1.º al último informe)`;
    html += '<div class="pe-vp-diag-h" style="margin-top:12px">Análisis y recomendación (según resultados)</div>';
    html += `<div class="pe-vp-diag-metric">Resultados: <b>${filas.length}</b> informe(s) evaluado(s) · peor caso <b>${fmt(pc.metrica)} ${esc(u)}</b>${pc.fila ? ` en ${esc(pc.fila.label)}${pc.fila.config ? ' (' + esc(pc.fila.config) + ')' : ''}` : ''} · tendencia <b>${esc(trendTxt)}</b>.</div>`;
    html += `<div style="margin-top:6px"><span class="pe-vp-diag-badge ${ACC_CLS[acc.clase] || ''}">${esc(acc.etiqueta)}</span> <span style="font-size:12px;color:#0f172a">${esc(acc.texto)}</span></div>`;
    if (familia === 'excitacion') {
      html += '<div class="pe-vp-diag-nota" style="margin-top:6px">Pérdidas (W): componente resistiva del ensayo (I_exc = magnetizante + pérdidas) — se evalúan por <b>COMPARACIÓN</b> (vs fábrica / ensayos previos / fases hermanas), sin umbral % duro propio (NETA/IEEE comparativo, L-53).</div>';
    }
  } else {
    html += '<div class="pe-vp-diag-concl">Prueba comparativa — sin umbral pasa/no-pasa; se interpreta vs huella/baseline.</div>';
  }
  wrap.innerHTML = html;
  return wrap;
}

/* ══════════════════════════════════════════════════════════════
 * PANEL DE UNA SOLA PRUEBA: su NOMBRE como título + filtro de AÑO.
 *   · "Todos los años"  → resumen comparativo (1 fila por informe).
 *   · un año concreto    → TABLA COMPLETA con TODOS los valores
 *     (todas las posiciones de TAP / todas las mediciones del año).
 * ══════════════════════════════════════════════════════════════ */

function gruposDe(familia, informes) {
  const grupos = new Map();
  informes.forEach((inf) => {
    (inf.bloques || []).forEach((b) => {
      const fam = familiaMA(b);
      if (!fam || fam.key !== familia) return;
      const a = analizarBloque(b);
      if (!a) return;
      const g = grupoDe(familia, b.titulo, inf.config);
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push({ inf, bloque: b, a });
    });
  });
  return grupos;
}

function filaDe(familia, inf, a, bloque) {
  const crit = CRIT[familia];
  let valores, desvMax = null, faseNames = null, faseAvg = null, faseMin = null, faseMax = null, colLabels = null, valoresRaw = null;
  if (a.mode === 'fases') {
    faseNames = a.faseNames; faseAvg = a.faseAvg; faseMin = a.faseMin; faseMax = a.faseMax;
    // KPI y diagnóstico se calculan sobre los EXTREMOS REALES medidos (no promedios).
    valores = (a.faseMin || []).concat(a.faseMax || []);
    desvMax = a.desvMax;
  } else {
    colLabels = a.items.map((i) => i.label); valores = a.items.map((i) => i.value); valoresRaw = a.items;
    if (crit.kind === 'desb') desvMax = desvItems(a.items);
  }
  const vnum = valores.filter((v) => v != null);
  let estado;
  if (crit.kind === 'desb') estado = estadoDesb(desvMax, bloque.limite_desbalance != null ? bloque.limite_desbalance : crit.limite);
  else if (crit.kind === 'min') estado = estadoMin(vnum.length ? Math.min(...vnum) : null, crit.min);
  else estado = estadoMax(vnum.length ? Math.max(...vnum) : null, crit.guia, crit.limite);
  // Σ pérdidas (W) — solo excitación. Reusa `perdidasDe` de producción (promedio
  // de W por fase a lo largo de los TAP); Σ = A+B+C. La potencia es la componente
  // resistiva del ensayo (I_exc = magnetizante + pérdidas), L-53.
  let sumW = null;
  if (familia === 'excitacion') {
    const w = perdidasDe(bloque);
    const wv = ['A', 'B', 'C'].map((k) => (typeof w[k] === 'number' ? w[k] : null)).filter((v) => v != null);
    sumW = wv.length ? round(wv.reduce((a, b) => a + b, 0)) : null;
  }
  return { mode: a.mode, label: inf.label, config: inf.config, ano: inf.ano, unidad: bloque.unidad, faseNames, faseAvg, faseMin, faseMax, colLabels, valores, valoresRaw, desvMax, sumW, estado };
}

// Resumen "Todos los años" con VALORES REALES: rango mín–máx medido por fase
// (dos valores reales del informe), nunca un promedio. Los bloques tipo ítem ya
// muestran su valor real directo.
function cardResumen(familia, grupo, entradas) {
  const filas = entradas.map((e) => filaDe(familia, e.inf, e.a, e.bloque));
  const crit = CRIT[familia];
  const card = cabeceraCard(familia, grupo, filas);
  // Un mismo NIVEL puede mezclar informes 'fases' (las 3 fases comparten TAPs) e
  // 'items' (alguna fase con un TAP faltante en la extracción real → no comparten X).
  // El layout se decide por SI HAY alguna fila 'fases' (no por `filas[0]`), y cada
  // fila se pinta por SU PROPIO modo, rellenando '—' donde no aplica. Antes esto
  // reventaba (`filas[0].mode` aplicado a todas → `faseNames.forEach` sobre null →
  // corta el render del panel tras el 1.er nivel). L-55 / L-56.
  const filaFases = filas.find((f) => f.mode === 'fases');
  const esFases = !!filaFases;
  const nFase = (filaFases && filaFases.faseNames) ? filaFases.faseNames.length : 0;
  const mostrarDesv = esFases && crit.kind === 'desb';
  const scroll = document.createElement('div'); scroll.className = 'pe-tabla-scroll';
  const tbl = document.createElement('table'); tbl.className = 'pe-tabla';
  const conPerd = familia === 'excitacion' && filas.some((f) => f.sumW != null);
  let headCols;
  if (esFases) headCols = [...(filaFases.faseNames || []).map((nm) => nm + ' (mín–máx)'), ...(mostrarDesv ? ['Desv. máx %'] : []), ...(conPerd ? ['Σ pérd. (W)'] : [])];
  else { headCols = []; filas.forEach((f) => (f.colLabels || []).forEach((l) => { if (!headCols.includes(l)) headCols.push(l); })); }
  tbl.innerHTML = '<thead><tr><th>Informe</th>' + headCols.map((c) => `<th>${esc(c)}</th>`).join('') + '<th>Criterio</th></tr></thead>';
  const tb = document.createElement('tbody');
  filas.forEach((f) => {
    const tr = document.createElement('tr');
    let cells = `<td>${esc(f.label)}${f.config ? ' · ' + esc(f.config) : ''}</td>`;
    if (esFases) {
      if (f.mode === 'fases' && f.faseNames) {
        f.faseNames.forEach((_, i) => {
          const mn = (f.faseMin || [])[i], mx = (f.faseMax || [])[i];
          const txt = mn == null ? '—' : (mn === mx ? fmt(mn) : `${fmt(mn)} – ${fmt(mx)}`);
          cells += `<td${i === 1 ? ' class="col-b"' : ''}>${txt}</td>`;
        });
      } else {
        // Fila 'items' dentro de un nivel con layout de fases → '—' en esas columnas.
        for (let i = 0; i < nFase; i++) cells += `<td${i === 1 ? ' class="col-b"' : ''}>—</td>`;
      }
      if (mostrarDesv) {
        const dcls = f.desvMax == null ? '' : Math.abs(f.desvMax) > crit.limite ? 'd-bad' : Math.abs(f.desvMax) > crit.limite * 0.7 ? 'd-warn' : 'd-ok';
        cells += `<td class="${dcls}">${fmt(f.desvMax)}</td>`;
      }
      if (conPerd) cells += `<td>${fmt(f.sumW)}</td>`;
    } else {
      const byLabel = new Map((f.valoresRaw || []).map((it) => [it.label, it.value]));
      headCols.forEach((l) => { cells += `<td>${fmt(byLabel.has(l) ? byLabel.get(l) : null)}</td>`; });
    }
    tr.innerHTML = cells;
    const td = document.createElement('td'); td.appendChild(chipsCriterio(familia, f)); tr.appendChild(td);
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); scroll.appendChild(tbl); card.appendChild(scroll);
  card.appendChild(bloqueDiagnostico(familia, filas));
  return card;
}

// Cabecera de tarjeta (banda + KPI tiles + franja de norma), sin la tabla.
function cabeceraCard(familia, grupo, filas) {
  const crit = CRIT[familia];
  const card = document.createElement('div'); card.className = 'pe-fus-card';
  const estadoGrupo = filas.reduce((acc, f) => peorEstado(acc, f.estado), 'na');
  const band = document.createElement('div'); band.className = 'pe-fus-band';
  band.innerHTML = `<span class="pe-fus-niv">${esc(grupo)}</span>`; band.appendChild(badgeEstado(estadoGrupo)); card.appendChild(band);
  const todos = filas.flatMap((f) => f.valores).filter((v) => v != null);
  const tiles = document.createElement('div'); tiles.className = 'pe-fus-tiles';
  if (crit.kind === 'desb') {
    const valMax = round(Math.max(...todos));
    const desvMax = filas.reduce((m, f) => (f.desvMax != null && (m == null || Math.abs(f.desvMax) > Math.abs(m)) ? f.desvMax : m), null);
    const dc = desvMax == null ? '' : Math.abs(desvMax) > crit.limite ? 'is-bad' : Math.abs(desvMax) > crit.limite * 0.7 ? 'is-warn' : 'is-ok';
    // Σ pérdidas (W) — solo excitación (potencia = componente resistiva del ensayo).
    const sumW = filas.some((f) => f.sumW != null) ? round(filas.reduce((a, f) => a + (f.sumW || 0), 0)) : null;
    const perdTile = (familia === 'excitacion' && sumW != null) ? tile(fmt(sumW), ' W', 'Σ pérdidas') : '';
    tiles.innerHTML = tile(fmt(valMax), ' ' + (filas[0].unidad || ''), 'Valor máx') + tile(fmt(desvMax), ' %', 'Δ / desv. máx', dc) + perdTile + tile(filas.length, '', 'Informes');
  } else if (crit.kind === 'min') {
    const mn = Math.min(...todos);
    tiles.innerHTML = tile(fmt(mn), ' ' + crit.unidad, 'Mínimo', estadoMin(mn, crit.min) === 'ok' ? 'is-ok' : 'is-warn') + tile(fmt(Math.max(...todos)), ' ' + crit.unidad, 'Máximo') + tile(filas.length, '', 'Informes');
  } else {
    const mx = Math.max(...todos); const dc = mx > crit.limite ? 'is-bad' : mx > crit.guia ? 'is-warn' : 'is-ok';
    tiles.innerHTML = tile(fmt(mx), ' ' + crit.unidad, 'Máximo', dc) + tile(filas.length, '', 'Informes') + tile(todos.length, '', 'Mediciones');
  }
  card.appendChild(tiles);
  const vr = document.createElement('div'); vr.className = 'pe-fus-verdict';
  vr.innerHTML = `<span class="pe-fus-norma">${NORMA[familia].franja}</span>`;
  const vb = document.createElement('span'); vb.className = 'pe-fus-vb'; vb.appendChild(badgeEstado(estadoGrupo)); vr.appendChild(vb); card.appendChild(vr);
  return card;
}

// Tabla COMPLETA por fases (todas las posiciones de TAP) vía `derivarTablaTAP`.
function tablaDetalleFases(bloque, familia) {
  const t = derivarTablaTAP(bloque);
  const scroll = document.createElement('div'); scroll.className = 'pe-tabla-scroll';
  const tbl = document.createElement('table'); tbl.className = 'pe-tabla';
  tbl.innerHTML = '<thead><tr>' + t.columnas.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr></thead>';
  const tb = document.createElement('tbody');
  t.filas.forEach((f) => {
    const tr = document.createElement('tr');
    tr.innerHTML = f.map((v, i) => `<td${claseCeldaTand(familia, t.columnas[i], v)}>${v === '' || v == null ? '—' : (typeof v === 'number' ? round(v, 3) : esc(v))}</td>`).join('');
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); scroll.appendChild(tbl); return scroll;
}

// Tabla COMPLETA por ítems (todas las mediciones: config/buje + valor + extras).
function tablaDetalleItems(bloque, a, familia) {
  const extraKeys = [];
  a.items.forEach((it) => it.extra && Object.keys(it.extra).forEach((k) => { if (!extraKeys.includes(k)) extraKeys.push(k); }));
  const columnas = [bloque.eje_x || 'Punto', `Valor${bloque.unidad ? ' (' + bloque.unidad + ')' : ''}`, ...extraKeys];
  const filas = a.items.map((it) => [it.label, it.value, ...extraKeys.map((k) => (it.extra ? it.extra[k] : null))]);
  // Quita columnas de VEREDICTO que la IA pudo filtrar al `extra` (p.ej. "Evaluación"
  // en bujes 2021): el veredicto vive en el diagnóstico, NO en la tabla (L-42).
  const limpia = quitarColumnasVeredicto({ columnas, filas });
  const scroll = document.createElement('div'); scroll.className = 'pe-tabla-scroll';
  const tbl = document.createElement('table'); tbl.className = 'pe-tabla';
  tbl.innerHTML = '<thead><tr>' + limpia.columnas.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr></thead>';
  const tb = document.createElement('tbody');
  limpia.filas.forEach((f) => {
    const tr = document.createElement('tr');
    tr.innerHTML = f.map((v, i) => `<td${claseCeldaTand(familia, limpia.columnas[i], v)}>${v == null || v === '' ? '—' : (typeof v === 'number' ? round(v, 3) : esc(v))}</td>`).join('');
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); scroll.appendChild(tbl); return scroll;
}

function cardDetalle(familia, grupo, entradas) {
  const filas = entradas.map((e) => filaDe(familia, e.inf, e.a, e.bloque));
  const card = cabeceraCard(familia, grupo, filas);
  entradas.forEach((e) => {
    if (entradas.length > 1) {
      const cap = document.createElement('div');
      cap.style.cssText = 'font-size:12px;font-weight:700;color:#334155;margin:10px 0 4px';
      cap.textContent = e.inf.label + (e.inf.config ? ' · ' + e.inf.config : '');
      card.appendChild(cap);
    }
    card.appendChild(e.a.mode === 'fases' ? tablaDetalleFases(e.bloque, familia) : tablaDetalleItems(e.bloque, e.a, familia));
  });
  card.appendChild(bloqueDiagnostico(familia, filas));
  return card;
}

// Panel por prueba: cada NIVEL DE TENSIÓN es un desplegable (acordeón), y DENTRO
// de cada nivel su PROPIO filtro de AÑO (solo los años en que ESE nivel se ensayó).
// "Todos los años" = resumen rango mín–máx + Σ pérdidas; un año = tabla completa
// (todas las posiciones de TAP). El primer nivel abre por defecto.
export function montarPanelPrueba(cont, familia, informes) {
  cont.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = NOMBRE[familia];
  h.style.cssText = 'margin:6px 0 8px;font-size:18px;color:#0f172a';
  cont.appendChild(h);

  const grupos = gruposDe(familia, informes); // Map(nivel → [{inf,bloque,a}])
  if (!grupos.size) {
    cont.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: `Sin datos de ${NOMBRE[familia]}.` }));
    return 0;
  }

  [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([nivel, entradas], idx) => {
    entradas.sort((a, b) => (a.inf.ano || 0) - (b.inf.ano || 0));
    const estadoNivel = entradas
      .map((e) => filaDe(familia, e.inf, e.a, e.bloque).estado)
      .reduce((acc, s) => peorEstado(acc, s), 'na');

    const det = document.createElement('details'); det.className = 'pe-vp-acc'; det.open = idx === 0;
    const sum = document.createElement('summary'); sum.className = 'pe-vp-acc-sum';
    const niv = document.createElement('span'); niv.className = 'pe-fus-niv'; niv.textContent = nivel;
    sum.appendChild(niv); sum.appendChild(badgeEstado(estadoNivel));
    det.appendChild(sum);

    const body = document.createElement('div'); body.className = 'pe-vp-acc-body';
    const anios = [...new Set(entradas.map((e) => e.inf.ano).filter((a) => a != null))].sort((a, b) => a - b);
    const lblY = Object.assign(document.createElement('div'), { className: 'pe-vp-toolbar-lbl', textContent: 'Año (de este nivel)' });
    const yearbar = document.createElement('div'); yearbar.className = 'pe-vp-tabs';
    const content = document.createElement('div');
    const st = { year: 'all' };
    const render = () => {
      content.innerHTML = '';
      // Defensa en profundidad: si un nivel no se puede construir con los datos
      // actuales, muestra un aviso EN ESE nivel — NUNCA tumba el resto del panel
      // (antes una excepción en un nivel cortaba el bucle y ocultaba los demás).
      try {
        const sel = st.year === 'all' ? entradas : entradas.filter((e) => e.inf.ano === st.year);
        const card = st.year === 'all' ? cardResumen(familia, nivel, sel) : cardDetalle(familia, nivel, sel);
        // Tan δ — "Todos los años": además del resumen rango mín–máx, el DETALLE
        // COMPLETO de cada medición (toda sección, toda columna del informe, sin
        // comprimir ni dejar huecos) — pedido del director. Cada informe trae su
        // propia tabla self-consistente (no se fusionan secciones/unidades entre
        // informes → así no aparecen '—'). Se inserta ANTES del diagnóstico.
        if (familia === 'tand' && st.year === 'all') {
          const det = document.createElement('div');
          det.appendChild(Object.assign(document.createElement('div'), { className: 'pe-vp-toolbar-lbl', textContent: 'Detalle y evaluación por informe (todas las secciones)', style: 'margin:14px 0 2px' }));
          sel.forEach((e) => {
            const capn = document.createElement('div');
            capn.style.cssText = 'font-size:12px;font-weight:700;color:#334155;margin:12px 0 4px';
            capn.textContent = e.inf.label + (e.inf.config ? ' · ' + e.inf.config : '');
            det.appendChild(capn);
            det.appendChild(e.a.mode === 'fases' ? tablaDetalleFases(e.bloque, familia) : tablaDetalleItems(e.bloque, e.a, familia));
            // Evaluación conforme a norma de ESE informe/año (veredicto multi-norma
            // del propio ensayo) — pedido del director: una evaluación por cada año.
            det.appendChild(bloqueDiagnostico(familia, [filaDe(familia, e.inf, e.a, e.bloque)]));
          });
          const diag = card.querySelector('.pe-vp-diag');
          if (diag) card.insertBefore(det, diag); else card.appendChild(det);
        }
        const band = card.querySelector('.pe-fus-band'); if (band) band.remove(); // la banda ya es el encabezado del acordeón
        const wrap = document.createElement('div'); wrap.className = 'pe-fus'; wrap.appendChild(card);
        content.appendChild(wrap);
      } catch (e) {
        console.error('[Valores por prueba] no se pudo construir el nivel', nivel, e);
        content.innerHTML = '<p class="muted small">No se pudo construir la tabla de este nivel con los datos actuales.</p>';
      }
      [...yearbar.children].forEach((b) => b.classList.toggle('is-active', b.dataset.year === String(st.year)));
    };
    const mkY = (val, label) => {
      const b = document.createElement('button');
      b.className = 'pe-vp-tab pe-vp-tab-year'; b.dataset.year = String(val); b.textContent = label;
      b.onclick = () => { st.year = val; render(); };
      return b;
    };
    yearbar.appendChild(mkY('all', 'Todos los años'));
    anios.forEach((y) => yearbar.appendChild(mkY(y, String(y))));
    body.appendChild(lblY); body.appendChild(yearbar); body.appendChild(content);
    det.appendChild(body);
    render();
    cont.appendChild(det);
  });

  return grupos.size;
}
