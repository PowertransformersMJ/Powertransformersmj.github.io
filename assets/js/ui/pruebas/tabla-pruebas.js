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

// `kind`: 'pending' (PDF cargado sin extraer) vs procesado.
function badgeEstadoInforme(inf) {
  const pendiente = inf.pdf && inf.pdf.estado &&
    inf.pdf.estado !== 'extraido' && inf.pdf.estado !== 'procesado';
  return pendiente
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
  return `<div class="acts">` +
    `<a class="btn-sm" href="${u}" target="_blank" rel="noopener">↗ Abrir</a>` +
    `<a class="btn-sm dl" href="${u}" download rel="noopener">⤓ Descargar PDF</a>` +
    `</div>`;
}

function serieEnPdf(inf, serieUnidad) {
  const det = inf.pdf && inf.pdf.serie_detectada;
  if (det) return esc(det);
  const pendiente = inf.pdf && inf.pdf.estado &&
    inf.pdf.estado !== 'extraido' && inf.pdf.estado !== 'procesado';
  if (pendiente) {
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
    const equipos = Array.isArray(inf.equipos) ? inf.equipos.join(', ') : (inf.equipos || '');
    const selCell = del
      ? `<td class="num"><input type="checkbox" class="pe-chk" data-sel="${esc(inf.id)}" ` +
        `data-ano="${esc(inf.ano)}" aria-label="Seleccionar informe ${esc(inf.ano)}"></td>`
      : '';
    const delCell = del
      ? `<td><button type="button" class="btn-sm danger" data-del="${esc(inf.id)}" ` +
        `data-ano="${esc(inf.ano)}" title="Eliminar este informe">🗑 Eliminar</button></td>`
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
  collar:      { valHead: 'mW',         caption: 'Pérdidas máximas en bujes (collar caliente). Límite <100 mW.' }
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

/* ─── Montaje conjunto por id de contenedor ───────────────────── */

/**
 * Monta todas las tablas de detalle en sus contenedores (por id).
 * Ids esperados en la página: t-tand, t-exc, t-rel, t-res, t-ins, t-col.
 * @param {Array} informes
 * @param {Document|HTMLElement} [root=document]
 */
export function mountTablas(informes, root = document) {
  const byId = (id) => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
  renderTablaTand(byId('t-tand'), informes);
  renderTablaResumen('excitacion',  byId('t-exc'), informes);
  renderTablaResumen('relacion',    byId('t-rel'), informes);
  renderTablaResumen('resistencia', byId('t-res'), informes);
  renderTablaResumen('aislamiento', byId('t-ins'), informes);
  renderTablaResumen('collar',      byId('t-col'), informes);
}
