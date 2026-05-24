// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · FILTROS
// ──────────────────────────────────────────────────────────────
// Funciones PURAS para aplicar el scope global (zona + período
// temporal) a un arreglo de eventos. Sin DOM ni I/O.
// ══════════════════════════════════════════════════════════════

/**
 * Estado de filtros del dashboard.
 * @typedef {Object} ScadaFiltros
 * @property {string} zona       Filtro global de zona ('' = todas).
 * @property {string} dateMode   'all' | 'cutoff' | 'single' | 'range'.
 * @property {string} dateSingle YYYY-MM-DD para modo single.
 * @property {string} dateFrom   YYYY-MM-DD para modo range (desde).
 * @property {string} dateTo     YYYY-MM-DD para modo range (hasta).
 * @property {string} dateCutoff YYYY-MM-DD para modo cutoff (acumulado hasta).
 */

/**
 * Aplica el scope global a un arreglo de eventos.
 * Devuelve un nuevo array sin mutar el original.
 */
export function applyGlobalScope(events, filtros) {
  const { zona, dateMode, dateSingle, dateFrom, dateTo, dateCutoff } = filtros;
  let out = events;
  if (zona) out = out.filter(e => e.zona === zona);
  if (dateMode === 'single' && dateSingle) {
    out = out.filter(e => e.date === dateSingle);
  } else if (dateMode === 'range' && (dateFrom || dateTo)) {
    out = out.filter(e =>
      (!dateFrom || e.date >= dateFrom) &&
      (!dateTo   || e.date <= dateTo)
    );
  } else if (dateMode === 'cutoff' && dateCutoff) {
    out = out.filter(e => e.date <= dateCutoff);
  }
  return out;
}

/**
 * Lista ordenada de fechas (YYYY-MM-DD) presentes en los datos.
 */
export function availableDates(events) {
  const s = new Set();
  for (const e of events) s.add(e.date);
  return [...s].sort();
}

/**
 * Filtros vacíos (estado inicial del dashboard).
 */
export function filtrosVacios() {
  return {
    zona: '',
    dateMode: 'all',
    dateSingle: '',
    dateFrom: '',
    dateTo: '',
    dateCutoff: '',
  };
}

/**
 * ¿Hay algún filtro activo?
 */
export function hayFiltroActivo(filtros) {
  if (filtros.zona) return true;
  if (filtros.dateMode === 'single' && filtros.dateSingle) return true;
  if (filtros.dateMode === 'range' && (filtros.dateFrom || filtros.dateTo)) return true;
  if (filtros.dateMode === 'cutoff' && filtros.dateCutoff) return true;
  return false;
}
