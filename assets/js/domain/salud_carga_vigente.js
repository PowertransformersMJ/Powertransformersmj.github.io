// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: la CARGA VIGENTE de un transformador para recalcular su salud (CRG)
// ──────────────────────────────────────────────────────────────
// El recálculo que dispara una muestra nueva (`functions/index.js#onMuestraCreate`) llamaba al motor SIN la carga:
// `calcularCalifCRG({})` da nulo y el equipo perdía su cargabilidad (`calif_crg`, `crg_pct_medido`) con cada muestra.
// Aquí se arma la carga desde el propio documento, igual que la arma el importador: el % oficial manda (el del Excel o
// el que el Ingeniero fijó desde el SCADA, 2026-10-23) y, si no hay, el cociente carga medida ÷ ampacidad por devanado.
// La fuente del % (de dónde salió, de qué mes) viaja con él mientras el % no cambie.
// Funciones PURAS (sin Firebase). Archivo NUEVO (L-102). ADR-167.
// ══════════════════════════════════════════════════════════════

/** Campos que dicen de dónde salió el % oficial de cargabilidad. */
export const CAMPOS_FUENTE_CRG = Object.freeze(['crg_fuente', 'crg_periodo', 'crg_nota']);

/**
 * La carga que el motor necesita (`snapshotSaludCompleto({ cargaActual })` → `calcularCalifCRG`).
 * @param {object} tx  documento del transformador (v2)
 * @returns {{crg_pct, cp, ap, cs, as, ct, at}}
 */
export function cargaActualDesdeTransformador(tx) {
  const e = (tx && tx.electrico) || {};
  const s = (tx && tx.salud_actual) || {};
  return {
    crg_pct: s.crg_pct_medido ?? null,
    cp: e.corriente_medida_primaria_a ?? null,   ap: e.corriente_nominal_primaria_a ?? null,
    cs: e.corriente_medida_secundaria_a ?? null, as: e.corriente_nominal_secundaria_a ?? null,
    ct: e.corriente_medida_terciaria_a ?? null,  at: e.corriente_nominal_terciaria_a ?? null
  };
}

/**
 * Tras el recálculo, la fuente del % oficial sigue al % si este no cambió (el motor no la conoce).
 * @param {object} previo  `salud_actual` antes del recálculo
 * @param {object} snap    `salud_actual` recalculado (ya fusionado con la condición del Excel)
 * @returns {object} snap con la fuente conservada
 */
export function conservarFuenteCRG(previo, snap) {
  const out = Object.assign({}, snap || {});
  const p = previo || {};
  if (p.crg_pct_medido == null || out.crg_pct_medido !== p.crg_pct_medido) return out;
  for (const k of CAMPOS_FUENTE_CRG) if (p[k] != null && out[k] == null) out[k] = p[k];
  return out;
}
