// ═══════════════════════════════════════════════════════════════
// REFRIGERACIÓN · NOMBRES CONTRACTUALES de motoventiladores
// ───────────────────────────────────────────────────────────────
// Mapping (fan_db_key → nombre canónico del suministro contractual)
// para unificar el idioma entre Mantenimiento Brigada · Selección
// ONAF y los contratos de Suministros de Elementos y Accesorios.
//
// El director pidió usar el formato del contrato:
//
//     "Motoventilador Tipo N (MODELO)"
//
// donde N es el número de tipo según el contrato (1, 2, 3…) y
// MODELO es el identificador corto (FN050, FN063, KRENZ-F20…).
//
// Si una clave NO está mapeada aquí, el helper devuelve null y el
// consumer cae al fallback "fan_marca fan_modelo" del FAN_DB.
//
// Carga inicial (2026-05-18): vacío. Se poblarán las 13 entradas
// cuando el director entregue las fichas técnicas de ambos
// contratos (4123000081 y 4125000143) y se haga la tipificación
// definitiva.
// ═══════════════════════════════════════════════════════════════

/** @type {Readonly<Record<string, string>>} */
export const FAN_CONTRACTUAL = Object.freeze({
  // Tipificación oficial confirmada con el director (2026-05-18)
  // para el contrato 4125000143 · "SUMINISTRO DE ELEMENTOS Y ACCESORIOS
  // PARA TRANSFORMADORES DE POTENCIA" · AFINIA Grupo EPM.
  //
  // Tensión auxiliar AFINIA: 220 V → motores ZIEHL conectados Delta a
  // 230/400V (no la versión HV 265/460V). Por eso los trifásicos usan
  // las claves _60 (60 Hz Colombia) y NO las _60h.
  //
  // El monofásico Tipo 3 es la familia nueva agregada en Microfase 1.5
  // (modelo ZN063-6EL.4M.V7P1, distinto a ZN063-6DL.4I.V7P1 trifásico).

  fn063_60:       'Motoventilador Tipo 1 (FN063)',
  fn050_60:       'Motoventilador Tipo 2 (FN050)',
  zn063_mono_60:  'Motoventilador Tipo 3 (ZN063)',
  zn045_60:       'Motoventilador Tipo 4 (ZN045)',

  // Variantes adicionales del FAN_DB (HV 265/460V o 50Hz) quedan sin
  // tipificación porque no se compraron en este contrato. Si en un
  // contrato futuro se necesitan, agregar el mapeo aquí.
});

/**
 * Devuelve el nombre contractual canónico de un motoventilador
 * según su clave del FAN_DB, o `null` si no está mapeado todavía.
 *
 * @param {string} fan_db_key — clave del FAN_DB (ej. 'fn050_60h')
 * @returns {string|null}
 */
export function nombreContractualFan(fan_db_key) {
  if (!fan_db_key) return null;
  return FAN_CONTRACTUAL[fan_db_key] || null;
}

/**
 * Indica si una clave del FAN_DB ya tiene nombre contractual
 * tipificado. Útil para reportes de cobertura de la tipificación.
 *
 * @param {string} fan_db_key
 * @returns {boolean}
 */
export function tieneNombreContractual(fan_db_key) {
  return Boolean(fan_db_key && FAN_CONTRACTUAL[fan_db_key]);
}
