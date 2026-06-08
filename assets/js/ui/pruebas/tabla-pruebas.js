// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Tablas dinámicas
// ──────────────────────────────────────────────────────────────
// Reproduce las tablas del tablero original pero ALIMENTADAS por los
// informes Firestore en vivo (no por HTML hard-codeado). Dos familias:
//
//   1) Historial de informes de la unidad (#reportlist + #kpi-informes):
//      Fecha · Ejecutante · Equipos · Serie en PDF · Estado · PDF.
//      Mapea 1:1 al modelo de la subcolección /informes.
//
//   2) Tablas de detalle por prueba:
//      · tan δ  → matriz config × año (las 6 configuraciones de
//                 aislamiento) + calificación de la peor celda.
//      · resto  → resumen año × valor + calificación (el schema
//                 guarda el valor sintetizado por prueba, no el
//                 detalle por fase del PDF original).
//
// La calificación de cada celda sale del dominio puro vía
// `calificarPrueba` (semaforo.js) — aquí NO hay reglas de negocio.
// ══════════════════════════════════════════════════════════════

import { ESTADOS, calificarTanDelta } from '../../domain/pruebas_electricas_semaforo.js';
import { CONFIGS_TAND } from '../../domain/pruebas_electricas_schema.js';
import { calificarPrueba } from './semaforo.js';

/* ─── Helpers de presentación ─────────────────────────────────── */

// Clase de celda numérica según el estado del dominio (hereda las
// clases del tablero: cell-g / cell-a / cell-o / cell-r).
function cellClass(estado) {
  switch (estado) {
    case ESTADOS.VERDE:   return 'cell-g';
    case ESTADOS.AMBAR:   return 'cell-a';
    case ESTADOS.NARANJA: return 'cell-o';
    case ESTADOS.ROJO:    return 'cell-r';
    default:              return 'muted2';
  }
}

function badge(estado, texto) {
  return `<span class="badge ${estado.clase}">${texto || estado.etiqueta}</span>`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ordenarPorAno(informes) {
  return (informes || []).slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
}

/* ─── 1) Historial de informes (#reportlist + KPI) ────────────── */

// ¿El informe quedó pendiente de extracción? Se considera PROCESADO cualquier
// estado que empiece por "extraido" (incluye `extraido_ia` de la IA) o
// "procesado". Antes el chequeo solo aceptaba `extraido`/`procesado` exactos →
// los informes extraídos con IA (`extraido_ia`) se mostraban como "pendiente".
function esPendienteExtraccion(inf) {
  const e = inf && inf.pdf && inf.pdf.estado;
  if (!e) return false;
  return !String(e).startsWith('extraido') && e !== 'procesado';
}

// Estado durable del REPROCESO server-side (ADR-016). El informe trae un mapa
// `reproceso: {estado, inicio, fin, motivo}` que la Cloud Function escribe. Se
// lee aquí para que la fila muestre un estado TERMINAL claro (en vivo, vía
// onSnapshot, sobreviviendo a recargas). Si quedó 'en_curso' más que el tope de
// la CF (900 s + margen) → 'interrumpido' (la llamada murió; el usuario reintenta).
const REPROC_STALE_MS = 16 * 60 * 1000;
function tsMs(t) {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  const n = Date.parse(t); return Number.isFinite(n) ? n : 0;
}
function horaCorta(ms) {
  if (!ms) return '';
  try { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
function reprocEstado(inf) {
  const r = inf && inf.reproceso;
  if (!r || !r.estado) return null;
  if (r.estado === 'en_curso') {
    const desde = tsMs(r.inicio || r.ts);
    if (desde && (Date.now() - desde) > REPROC_STALE_MS) return { estado: 'interrumpido' };
    return { estado: 'en_curso', desde };
  }
  if (r.estado === 'error') return { estado: 'error', motivo: r.motivo || '', fin: tsMs(r.fin || r.ts) };
  return { estado: r.estado }; // 'ok'
}

// `kind`: 'pending' (PDF cargado sin extraer) vs procesado, con overlay del
// estado de reproceso (reprocesando / interrumpido / error) cuando aplica.
function badgeEstadoInforme(inf) {
  const re = reprocEstado(inf);
  if (re && re.estado === 'en_curso') {
    const d = re.desde ? ` desde ${horaCorta(re.desde)}` : '';
    return `<span class="badge b-a">⟳ reprocesando…${esc(d)}</span>`;
  }
  if (re && re.estado === 'interrumpido') {
    return '<span class="badge b-o" title="El reproceso anterior no terminó (se interrumpió). Vuelve a intentar.">⚠ reproceso interrumpido</span>';
  }
  if (re && re.estado === 'error') {
    const t = re.motivo ? ` (${re.motivo})` : '';
    return `<span class="badge b-r" title="${esc('Reproceso falló' + t)}">⚠ reproceso falló</span>`;
  }
  return esPendienteExtraccion(inf)
    ? '<span class="badge b-a">pendiente de extracción</span>'
    : '<span class="badge b-g">procesado</span>';
}

function fechaLabel(inf) {
  if (inf.fecha) return esc(inf.fecha);
  if (inf.ano != null) return String(inf.ano);
  return '—';
}

function accionesPdf(inf) {
  const url = inf.pdf && inf.pdf.downloadURL;
  if (!url) return '<span class="muted2">—</span>';
  const u = esc(url);
  // Reprocesar: disponible para CUALQUIER informe vivo con PDF en Storage (no
  // solo pendientes). Re-extrae con IA server-side → refresca con la lógica/
  // campos actuales (identidad por placa, FP de bujes canónico, etc.) sin re-subir.
  // Mientras un reproceso está EN CURSO (estado durable), el botón se bloquea
  // (ADR-016) para no lanzar dos a la vez; se reactiva al terminar (ok/error).
  const re = reprocEstado(inf);
  const enCurso = re && re.estado === 'en_curso';
  const reproc = (!inf._seed && inf.pdf && inf.pdf.storagePath)
    ? (enCurso
      ? `<button type="button" class="btn-sm reproc" disabled title="Reproceso en curso en el servidor — la fila se actualizará sola al terminar">↻ Reprocesando…</button>`
      : `<button type="button" class="btn-sm reproc" data-reproc="${esc(inf.id)}" ` +
        `data-ano="${esc(inf.ano)}" title="Re-extraer el informe con IA (servidor) y actualizar sus datos">↻ Reprocesar</button>`)
    : '';
  // Editar datos: captura manual de los valores reales leídos del PDF.
  // Solo para informes vivos (los base/seed son de solo lectura).
  const editar = !inf._seed
    ? `<button type="button" class="btn-sm edit" data-edit="${esc(inf.id)}" ` +
      `title="Digitar manualmente los valores del informe">✎ Editar datos</button>`
    : '';
  return `<div class="acts">` +
    `<a class="btn-sm" href="${u}" target="_blank" rel="noopener">↗ Abrir</a>` +
    `<a class="btn-sm dl" href="${u}" download rel="noopener">⤓ Descargar PDF</a>` +
    reproc +
    editar +
    `</div>`;
}

function serieEnPdf(inf, serieUnidad) {
  const det = inf.serie_en_pdf;
  if (det) return esc(det);
  if (esPendienteExtraccion(inf)) {
    return `<span class="muted2">no detectada · asignada ${esc(serieUnidad || '')}</span>`;
  }
  return '<span class="muted2">no impresa</span>';
}

/**
 * Renderiza el historial de informes y actualiza el KPI de conteo.
 * @param {HTMLElement} cont   contenedor de la tabla (#reportlist)
 * @param {Array} informes
 * @param {object} [opts]      { serieUnidad, kpiEl, canDelete }
 *   canDelete → añade columna "Eliminar" con botón por fila
 *   (el shell escucha el click vía delegación en data-del/data-ano).
 */
export function renderInformes(cont, informes, opts = {}) {
  const docs = ordenarPorAno(informes).reverse(); // más recientes primero
  if (opts.kpiEl) opts.kpiEl.textContent = String(docs.length);
  if (!cont) return;
  if (!docs.length) {
    cont.innerHTML = `<p class="muted small">Aún no hay informes cargados para esta unidad.</p>`;
    return;
  }
  const del = !!opts.canDelete;
  const rows = docs.map((inf) => {
    const equipos = Array.isArray(inf.equipos) ? inf.equipos.join(', ') : (inf.equipo || inf.equipos || '');
    // Los informes base (_seed) son de solo lectura: ni checkbox ni botón
    // de borrado; en su lugar una marca "base" no interactiva.
    const selCell = del
      ? (inf._seed
        ? `<td class="num"><span class="muted2" title="Informe base · solo lectura">🔒</span></td>`
        : `<td class="num"><input type="checkbox" class="pe-chk" data-sel="${esc(inf.id)}" ` +
          `data-ano="${esc(inf.ano)}" aria-label="Seleccionar informe ${esc(inf.ano)}"></td>`)
      : '';
    const delCell = del
      ? (inf._seed
        ? `<td><span class="badge b-n">base</span></td>`
        : `<td><button type="button" class="btn-sm danger" data-del="${esc(inf.id)}" ` +
          `data-ano="${esc(inf.ano)}" title="Eliminar este informe">🗑 Eliminar</button></td>`)
      : '';
    return `<tr>` +
      selCell +
      `<td>${fechaLabel(inf)}</td>` +
      `<td>${esc(inf.ejecutante) || '—'}</td>` +
      `<td class="muted small">${esc(equipos) || '—'}</td>` +
      `<td>${serieEnPdf(inf, opts.serieUnidad)}</td>` +
      `<td>${badgeEstadoInforme(inf)}</td>` +
      `<td>${accionesPdf(inf)}</td>` +
      delCell +
      `</tr>`;
  }).join('');
  const toolbar = del
    ? `<div class="pe-del-bar">` +
      `<button type="button" class="btn-sm" data-del-sel title="Eliminar los informes marcados">` +
      `🗑 Eliminar seleccionados</button>` +
      `<button type="button" class="btn-sm danger" data-del-all title="Eliminar TODOS los informes de esta unidad">` +
      `⚠ Eliminar todos</button>` +
      `</div>`
    : '';
  cont.innerHTML =
    toolbar +
    `<div class="tblwrap"><table class="dt">` +
    `<thead><tr>` +
    (del ? '<th class="num"><input type="checkbox" data-sel-all aria-label="Seleccionar todos"></th>' : '') +
    `<th>Fecha</th><th>Ejecutante</th><th>Equipos</th>` +
    `<th>Serie en PDF</th><th>Estado</th><th>Informe (PDF)</th>` +
    (del ? '<th>Eliminar</th>' : '') + `</tr></thead>` +
    `<tbody>${rows}</tbody></table></div>`;
}

/* ─── 2a) Tabla tan δ (matriz config × año) ───────────────────── */

// Mapa rápido code→valor_pct de un informe.
function tandMap(inf) {
  const m = {};
  (Array.isArray(inf.tand) ? inf.tand : []).forEach((t) => {
    if (t && t.code) m[t.code] = t.valor_pct;
  });
  return m;
}

export function renderTablaTand(cont, informes) {
  if (!cont) return;
  const docs = ordenarPorAno(informes);
  const anos = docs.map((d) => d.ano);
  const maps = docs.map(tandMap);
  const head =
    `<tr><th>Config.</th><th>Aislamiento</th>` +
    anos.map((a) => `<th class="num">${esc(a)}</th>`).join('') +
    `<th>Calificación</th></tr>`;
  const body = CONFIGS_TAND.map((cfg) => {
    let peor = ESTADOS.VERDE;
    const celdas = maps.map((m) => {
      const v = m[cfg.code];
      if (v == null) return `<td class="num muted2">n/d</td>`;
      const e = calificarTanDelta(v);
      if (e.nivel > peor.nivel) peor = e;
      return `<td class="num ${cellClass(e)}">${v.toFixed(2)}</td>`;
    }).join('');
    const calif = peor.nivel < 0 ? '<span class="badge b-n">sin dato</span>' : badge(peor);
    return `<tr><td class="cfg">${esc(cfg.code)}</td>` +
      `<td class="assoc">${esc(cfg.entre)}</td>${celdas}<td>${calif}</td></tr>`;
  }).join('');
  cont.innerHTML =
    `<div class="tblwrap"><table class="dt">` +
    `<thead>${head}</thead><tbody>${body}</tbody>` +
    `<caption>tan δ por sección de aislamiento (no por fase). ` +
    `Umbrales: ≤0.5 bueno · 0.5–0.7 normal · 0.7–1 investigar · &gt;1 excesivo.</caption>` +
    `</table></div>`;
}

/* ─── 2b) Tablas resumen año × valor (resto de pruebas) ───────── */

const RESUMEN = {
  excitacion:  { valHead: 'Δ ext. (%)', caption: 'Desbalance entre las dos fases mayores del devanado AT. Límite 10% (5% si I≥50 mA).' },
  relacion:    { valHead: 'Desv. (%)',  caption: 'Desviación de la relación medida respecto a placa. Límite ±0.5%.' },
  resistencia: { valHead: 'Δ máx (%)',  caption: 'Desbalance entre fases del devanado. Límite ≤5%. "verificar" = dato sospechoso de digitación.' },
  aislamiento: { valHead: 'GΩ',         caption: 'Resistencia de aislamiento CC. Mínimo aceptable ≥1 GΩ.' },
  collar:      { valHead: 'mW',         caption: 'Pérdidas máximas en bujes (collar caliente). Límite <100 mW.' },
  drm:         { valHead: 'Tiempo (ms)', caption: 'Resistencia dinámica del conmutador (DRM/OLTC). Ventana normal de transición 40–70 ms.' }
};

/**
 * Renderiza la tabla resumen año × valor de una prueba escalar.
 * @param {string} key  clave de prueba (excitacion|relacion|resistencia|aislamiento|collar)
 * @param {HTMLElement} cont
 * @param {Array} informes
 */
export function renderTablaResumen(key, cont, informes) {
  if (!cont) return;
  const meta = RESUMEN[key];
  if (!meta) return;
  const docs = ordenarPorAno(informes);
  const rows = docs.map((inf) => {
    const { estado, texto } = calificarPrueba(key, inf);
    const cls = cellClass(estado);
    return `<tr><td>${esc(inf.ano)}</td>` +
      `<td class="num ${cls}">${esc(texto)}</td>` +
      `<td>${badge(estado)}</td></tr>`;
  }).join('');
  cont.innerHTML =
    `<div class="tblwrap"><table class="dt">` +
    `<thead><tr><th>Año</th><th class="num">${meta.valHead}</th><th>Calif.</th></tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `<caption>${meta.caption}</caption>` +
    `</table></div>`;
}

/* ─── 2b-bis) Tablas DETALLADAS por prueba (full granularidad) ────
   Muestran TODO el detalle que el schema guarda (fases A/B/C + terminal,
   TAP, par de devanados, bujes individuales, Δ%), no solo el escalar
   resumido. Replican el detalle de la maqueta de referencia. */

// Badge de calificación a partir del string que guarda el schema
// (bueno/OK/normal → verde · investigar/revisar/verificar → ámbar ·
//  excesivo/fuera/bajo/alto → rojo).
function califBadge(calif) {
  const c = String(calif || '').toLowerCase().trim();
  let cls = 'b-n';
  if (['bueno', 'ok', 'normal'].includes(c)) cls = 'b-g';
  else if (['investigar', 'revisar', 'verificar', 'no medido'].includes(c)) cls = 'b-a';
  else if (['excesivo', 'fuera', 'bajo', 'alto'].includes(c)) cls = 'b-r';
  return `<span class="badge ${cls}">${esc(calif || 'n/d')}</span>`;
}
function nv(v) { return (v == null || v === '') ? '—' : esc(v); }
// Celda de fase: valor + terminal real como subtítulo (ej. "H1–PN").
function celdaFase(f) {
  if (!f || f.valor == null) return '<td class="num muted2">—</td>';
  const term = f.term ? `<div class="term">${esc(f.term)}</div>` : '';
  return `<td class="num">${esc(f.valor)}${term}</td>`;
}
function fasePorLetra(fases, letra) {
  return (Array.isArray(fases) ? fases : [])
    .find((f) => String(f.fase || '').toUpperCase() === letra) || null;
}
function envuelve(cont, head, body, caption) {
  cont.innerHTML =
    `<div class="tblwrap"><table class="dt"><thead>${head}</thead>` +
    `<tbody>${body}</tbody><caption>${caption}</caption></table></div>`;
}
function sinFilas(cont, cols, msg) {
  envuelve(cont, `<tr><th>${msg}</th></tr>`, '', '');
  cont.innerHTML = `<p class="muted small">${esc(msg)}</p>`;
}

// Excitación: por fase A/B/C (mA) con terminal, TAP, ref, Δ ext.
export function renderTablaExcitacion(cont, informes) {
  if (!cont) return;
  const docs = ordenarPorAno(informes).filter((i) => i.excitacion &&
    ((i.excitacion.fases && i.excitacion.fases.length) || i.excitacion.delta_ext_pct != null));
  if (!docs.length) return sinFilas(cont, 9, 'Sin datos de corriente de excitación.');
  const body = docs.map((inf) => {
    const e = inf.excitacion || {};
    const A = fasePorLetra(e.fases, 'A'), B = fasePorLetra(e.fases, 'B'), C = fasePorLetra(e.fases, 'C');
    return `<tr><td>${nv(inf.ano)}</td><td>${nv(e.devanado || 'AT')}</td>` +
      `<td>${nv(e.ref)}</td><td>${nv(e.tap)}</td>` +
      celdaFase(A) + celdaFase(B) + celdaFase(C) +
      `<td class="num">${e.delta_ext_pct != null ? esc(e.delta_ext_pct) : '—'}</td>` +
      `<td>${califBadge(e.calif)}</td></tr>`;
  }).join('');
  envuelve(cont,
    `<tr><th>Año</th><th>Devanado</th><th>Ref.</th><th>TAP</th>` +
    `<th class="num">Fase A</th><th class="num">Fase B (central)</th><th class="num">Fase C</th>` +
    `<th class="num">Δ ext. (%)</th><th>Calif.</th></tr>`,
    body,
    'Corriente de excitación por fase (mA). Δ = desbalance entre las dos fases mayores; límite 10% (5% si I≥50 mA).');
}

// Relación de transformación: filas por par de devanados (fases o global), TAP, desviación.
export function renderTablaRelacion(cont, informes) {
  if (!cont) return;
  const docs = ordenarPorAno(informes);
  const filas = [];
  docs.forEach((inf) => {
    (Array.isArray(inf.relacion) ? inf.relacion : []).forEach((r) => {
      const A = fasePorLetra(r.fases, 'A'), B = fasePorLetra(r.fases, 'B'), C = fasePorLetra(r.fases, 'C');
      const tieneFases = (r.fases && r.fases.length);
      const medida = tieneFases
        ? `${celdaFase(A)}${celdaFase(B)}${celdaFase(C)}`
        : `<td class="num" colspan="3">${r.global != null ? esc(r.global) : '—'}` +
          (r.global_term ? `<div class="term">${esc(r.global_term)}</div>` : '') + `</td>`;
      filas.push(`<tr><td>${nv(inf.ano)}</td><td>${nv(r.devanado)}</td><td>${nv(r.asociado)}</td>` +
        `<td>${nv(r.tap)}</td>${medida}` +
        `<td class="num">${r.desviacion_pct != null ? esc(r.desviacion_pct) : '—'}</td>` +
        `<td>${califBadge(r.calif)}</td></tr>`);
    });
  });
  if (!filas.length) return sinFilas(cont, 8, 'Sin datos de relación de transformación.');
  envuelve(cont,
    `<tr><th>Año</th><th>Devanado</th><th>Asociado</th><th>TAP</th>` +
    `<th class="num">Fase A</th><th class="num">Fase B</th><th class="num">Fase C / global</th>` +
    `<th class="num">Desv. (%)</th><th>Calif.</th></tr>`,
    filas.join(''),
    'Relación de transformación (TTR) por par de devanados. Desviación vs placa; límite ±0.5%.');
}

// Resistencia de devanados: filas por devanado (AT/MT/BT), fases (mΩ), Δ máx, verificar.
export function renderTablaResistencia(cont, informes) {
  if (!cont) return;
  const docs = ordenarPorAno(informes);
  const filas = [];
  docs.forEach((inf) => {
    (Array.isArray(inf.resistencia) ? inf.resistencia : []).forEach((r) => {
      const A = fasePorLetra(r.fases, 'A'), B = fasePorLetra(r.fases, 'B'), C = fasePorLetra(r.fases, 'C');
      const flag = r.verificar ? ' <span class="badge b-a">verificar</span>' : '';
      filas.push(`<tr><td>${nv(r.ano_tap || inf.ano)}</td><td>${nv(r.devanado)}</td>` +
        `<td>${nv(r.conexion)}</td>${celdaFase(A)}${celdaFase(B)}${celdaFase(C)}` +
        `<td class="num">${r.delta_max_pct != null ? esc(r.delta_max_pct) : '—'}</td>` +
        `<td>${califBadge(r.calif)}${flag}</td></tr>`);
    });
  });
  if (!filas.length) return sinFilas(cont, 8, 'Sin datos de resistencia de devanados.');
  envuelve(cont,
    `<tr><th>Año (TAP)</th><th>Devanado</th><th>Conexión</th>` +
    `<th class="num">Fase A</th><th class="num">Fase B</th><th class="num">Fase C</th>` +
    `<th class="num">Δ máx (%)</th><th>Calif.</th></tr>`,
    filas.join(''),
    'Resistencia óhmica de devanados (mΩ salvo indicación). Desbalance entre fases; límite ≤5%.');
}

// Resistencia de aislamiento: filas por par de devanados / tierra (GΩ).
export function renderTablaAislamiento(cont, informes) {
  if (!cont) return;
  const docs = ordenarPorAno(informes);
  const filas = [];
  docs.forEach((inf) => {
    (Array.isArray(inf.aislamiento) ? inf.aislamiento : []).forEach((a) => {
      filas.push(`<tr><td>${nv(inf.ano)}</td><td>${nv(a.devanado)}</td><td>${nv(a.asociado)}</td>` +
        `<td class="num">${a.gohm != null ? esc(a.gohm) : '—'}</td>` +
        `<td>${califBadge(a.calif)}</td></tr>`);
    });
  });
  if (!filas.length) return sinFilas(cont, 5, 'Sin datos de resistencia de aislamiento.');
  envuelve(cont,
    `<tr><th>Año</th><th>Devanado</th><th>Asociado</th><th class="num">GΩ</th><th>Calif.</th></tr>`,
    filas.join(''),
    'Resistencia de aislamiento (CC) por par de devanados / tierra. Mínimo aceptable ≥1 GΩ.');
}

// Collar caliente: fila por BUJE individual (I µA + pérdida mW) + máximo.
export function renderTablaCollar(cont, informes) {
  if (!cont) return;
  const docs = ordenarPorAno(informes);
  const filas = [];
  docs.forEach((inf) => {
    const col = inf.collar || {};
    (Array.isArray(col.bujes) ? col.bujes : []).forEach((b) => {
      filas.push(`<tr><td>${nv(inf.ano)}</td><td class="cfg">${nv(b.buje)}</td>` +
        `<td>${nv(b.fase_label || b.fase)}</td><td>${nv(b.devanado)}</td>` +
        `<td class="num">${b.i_ua != null ? esc(b.i_ua) : '—'}</td>` +
        `<td class="num">${b.mw != null ? esc(b.mw) : '—'}</td>` +
        `<td>${califBadge(b.calif)}</td></tr>`);
    });
  });
  if (!filas.length) return sinFilas(cont, 7, 'Sin datos de collar caliente / bujes.');
  envuelve(cont,
    `<tr><th>Año</th><th>Buje</th><th>Fase</th><th>Devanado</th>` +
    `<th class="num">I salida (µA)</th><th class="num">Pérdida (mW)</th><th>Calif.</th></tr>`,
    filas.join(''),
    'Collar caliente por buje individual. Pérdidas; límite <100 mW.');
}

/* ─── 2c) Identidad del conmutador (DRM/OLTC) ─────────────────── */

// Campos de identidad del conmutador medidos en la prueba DRM. Solo se
// muestran los que el informe trae con dato real (sin inventar nada).
const DRM_CAMPOS = [
  { key: 'fabricante',        label: 'Fabricante' },
  { key: 'tipo',             label: 'Tipo' },
  { key: 'serial',           label: 'Serial' },
  { key: 'posiciones',       label: 'Posiciones' },
  { key: 'operaciones',      label: 'Operaciones' },
  { key: 'pos_nominal',      label: 'Posición nominal' },
  { key: 'tension_ui_v',     label: 'Tensión Uᵢ (V)' },
  { key: 'corriente_iu_a',   label: 'Corriente Iᵤ (A)' },
  { key: 'r_conmutacion_ohm', label: 'R conmutación (Ω)' }
];

/**
 * Renderiza la ficha de identidad del conmutador del informe más
 * reciente que traiga datos DRM. Si ningún informe trae conmutador,
 * no pinta nada (queda vacío · sin inventar).
 * @param {HTMLElement} cont
 * @param {Array} informes
 */
export function renderTablaDrmIdentidad(cont, informes) {
  if (!cont) return;
  const docs = ordenarPorAno(informes).reverse(); // más reciente primero
  const conDrm = docs.find((inf) => {
    const c = inf.drm && inf.drm.conmutador;
    return c && DRM_CAMPOS.some((f) => c[f.key] != null && c[f.key] !== '');
  });
  if (!conDrm) {
    cont.innerHTML = '';
    return;
  }
  const c = conDrm.drm.conmutador;
  const filas = DRM_CAMPOS
    .filter((f) => c[f.key] != null && c[f.key] !== '')
    .map((f) => `<tr><td class="assoc">${esc(f.label)}</td><td class="num">${esc(c[f.key])}</td></tr>`)
    .join('');
  if (!filas) { cont.innerHTML = ''; return; }
  cont.innerHTML =
    `<div class="tblwrap"><table class="dt">` +
    `<thead><tr><th>Conmutador (OLTC)</th><th class="num">${esc(conDrm.ano)}</th></tr></thead>` +
    `<tbody>${filas}</tbody>` +
    `<caption>Identidad del conmutador medida en la prueba DRM (informe ${esc(conDrm.ano)}).</caption>` +
    `</table></div>`;
}

/* ─── Montaje conjunto por id de contenedor ───────────────────── */

/**
 * Monta todas las tablas de detalle en sus contenedores (por id).
 * Ids esperados en la página: t-tand, t-exc, t-rel, t-res, t-ins, t-col,
 * t-drm (resumen tiempo de transición) y t-drm-id (identidad conmutador).
 * @param {Array} informes
 * @param {Document|HTMLElement} [root=document]
 */
export function mountTablas(informes, root = document) {
  const byId = (id) => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
  renderTablaTand(byId('t-tand'), informes);
  renderTablaExcitacion(byId('t-exc'), informes);
  renderTablaRelacion(byId('t-rel'), informes);
  renderTablaResistencia(byId('t-res'), informes);
  renderTablaAislamiento(byId('t-ins'), informes);
  renderTablaCollar(byId('t-col'), informes);
  renderTablaResumen('drm',         byId('t-drm'), informes); // DRM: resumen tiempo
  renderTablaDrmIdentidad(byId('t-drm-id'), informes);
}
