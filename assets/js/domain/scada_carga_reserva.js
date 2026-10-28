// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · UNIDAD DE RESERVA (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Propuesta aprobada por el Ingeniero («procede con las propuestas»): un transformador que pasa la mayor parte del año en
// reserva (Nueva Cospique T3: solo llevó carga del 10 al 30 de agosto de 2026) no «midió poco»: no tenía carga que medir.
// Se marca en la decisión de la homologación (`decision.unidad_reserva = true`; SOLO los equipos marcados, el resto del
// parque no cambia). Un mes de un equipo marcado es «en reserva» si NINGÚN devanado lleva carga apreciable (sin horas
// válidas, o p99 bajo el 5 % de su ampacidad) y ALGUNO no tiene horas válidas y estuvo fuera de servicio al menos la mitad
// de sus horas. Ese mes queda sin cifra («en reserva») y no cuenta para la firmeza de varios meses, ni como medido ni
// como no medido. Si un mes la unidad entra en servicio, ese mes cuenta como siempre. Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

export const RESERVA = { cargaMaxPct: 5, fraccionFuera: 0.5 };

export const MOTIVO_RESERVA = 'en reserva (sin carga apreciable)';

/** ¿El Ingeniero marcó el equipo como unidad de reserva? (decisión «usar» de su fila de homologación) */
export function esUnidadReserva(fila) {
  return !!(fila && fila.decision && fila.decision.tipo === 'usar' && fila.decision.unidad_reserva === true);
}

/**
 * ¿Ese mes (o rango) fue de reserva? Solo con niveles asignados a un devanado.
 * @param {Array<{devanado: string|null, n: number, pct: number|null, horas: number|null, servicio: number|null}>} niveles
 *   `pct` = p99 ÷ ampacidad × 100 (null si no se pudo calcular); `horas`/`servicio` del resumen del nivel.
 */
export function mesEnReserva(niveles) {
  const con = (niveles || []).filter((x) => x && x.devanado);
  if (!con.length) return false;
  // Carga apreciable (o que no se puede descartar: horas válidas sin cifra, p. ej. escala sospechosa) → no es reserva.
  if (con.some((x) => x.n > 0 && (x.pct == null || x.pct >= RESERVA.cargaMaxPct))) return false;
  return con.some((x) => !(x.n > 0) && x.horas > 0 && x.servicio != null && (x.horas - x.servicio) >= RESERVA.fraccionFuera * x.horas);
}
