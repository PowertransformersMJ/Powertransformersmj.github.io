// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · FASE SIN CARGA POR DISEÑO (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («Mata de Caña solo son 2 fases · El Paraíso igual»): en un banco de dos monofásicas la tercera
// fase NO existe; la cifra con las otras dos está completa y no es «falta una fase». La marca va en la decisión de la
// homologación, por nivel: `decision.fases_sin_carga = { N13_8: 'IS' }`. Resguardo: si la fase marcada empieza a medir
// (horas con tres fases por encima del tope), el equipo vuelve a provisional con su motivo. Las horas con tres fases ya
// vienen en cada resumen (`i.n − i.unaFalta`): no hay que recargar meses. Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

export const FASES_CORRIENTE = ['IR', 'IS', 'IT'];

/** Tope de horas con tres fases antes de decir que la fase marcada está midiendo: el mayor de 24 h o el 5 % de las válidas. */
export const TOPE_TRES_FASES = { horas: 24, fraccion: 0.05 };

/**
 * La fase marcada sin carga por diseño en ese nivel, o null.
 * @param {object|null} fila  fila de la homologación (con `decision`), la del mes que se calcula
 * @param {string} nivel      p. ej. 'N13_8'
 * @returns {'IR'|'IS'|'IT'|null}
 */
export function faseSinCarga(fila, nivel) {
  const m = fila && fila.decision && fila.decision.tipo === 'usar' ? fila.decision.fases_sin_carga : null;
  const f = m && typeof m === 'object' ? m[nivel] : null;
  return FASES_CORRIENTE.includes(f) ? f : null;
}

/**
 * ¿La fase marcada está midiendo? (horas con tres fases por encima del tope)
 * @param {number} n         horas válidas del nivel
 * @param {number} unaFalta  horas con solo dos fases
 */
export function faseSinCargaMide(n, unaFalta) {
  const tres = Math.max(0, (n || 0) - (unaFalta || 0));
  return tres > Math.max(TOPE_TRES_FASES.horas, TOPE_TRES_FASES.fraccion * (n || 0));
}
