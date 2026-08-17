// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Historial de informes
// ──────────────────────────────────────────────────────────────
// Historial de informes de la unidad (#reportlist + #kpi-informes):
//   Fecha · Ejecutante · Equipos · Serie en PDF · Estado · PDF.
//   Mapea 1:1 al modelo de la subcolección /informes.
//
// NOTA (G012, 2026-07-22): las "tablas de detalle por prueba" (Familia B:
// mountTablas + renderTablaTand/Excitacion/Relacion/Resistencia/Aislamiento/
// Collar/DrmIdentidad + renderTablaResumen) se RETIRARON: eran código muerto
// (mountTablas se desconectó del shell en ADR §8.3 y sus contenedores
// t-tand/t-exc/t-rel/t-res/t-ins/t-col/t-drm ya no existen en ningún HTML).
// El detalle por prueba lo renderiza hoy `tablas-pruebas-panel.js` (L-57).
// ══════════════════════════════════════════════════════════════

/* ─── Helpers de presentación ─────────────────────────────────── */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ordenarPorAno(informes) {
  return (informes || []).slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
}

/* ─── Historial de informes (#reportlist + KPI) ───────────────── */

// ¿El informe quedó pendiente de extracción? Se considera PROCESADO cualquier
// estado que empiece por "extraido" (incluye `extraido_ia` de la IA) o
// "procesado". Antes el chequeo solo aceptaba `extraido`/`procesado` exactos →
// los informes extraídos con IA (`extraido_ia`) se mostraban como "pendiente".
function esPendienteExtraccion(inf) {
  const e = inf && inf.pdf && inf.pdf.estado;
  if (!e) return false;
  return !String(e).startsWith('extraido') && e !== 'procesado';
}

// `kind`: 'pending' (PDF cargado sin extraer) vs procesado.
function badgeEstadoInforme(inf) {
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
  // Editar datos: captura manual de los valores reales leídos del PDF.
  // Solo para informes vivos (los base/seed son de solo lectura).
  // (Para re-extraer un informe, se sube de nuevo el PDF — upsert por fecha;
  // el botón "Reprocesar" se retiró por su costo vs re-subir, ADR-020.)
  const editar = !inf._seed
    ? `<button type="button" class="btn-sm edit" data-edit="${esc(inf.id)}" ` +
      `title="Digitar manualmente los valores del informe">✎ Editar datos</button>`
    : '';
  return `<div class="acts">` +
    `<a class="btn-sm" href="${u}" target="_blank" rel="noopener">↗ Abrir</a>` +
    `<a class="btn-sm dl" href="${u}" download rel="noopener">⤓ Descargar PDF</a>` +
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
