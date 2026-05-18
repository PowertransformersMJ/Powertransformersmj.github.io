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
  // Placeholder · pendiente de tipificación con el director.
  // Formato esperado: 'fan_db_key': 'Motoventilador Tipo N (MODELO)'
  //
  // Ejemplo (a confirmar):
  // fn063_60:    'Motoventilador Tipo 1 (FN063)',
  // fn050_60h:   'Motoventilador Tipo 2 (FN050)',
  // zn045_60:    'Motoventilador Tipo 3 (ZN045)',
  // krenz_f20:   'Motoventilador Tipo 4 (KRENZ F20)',
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
