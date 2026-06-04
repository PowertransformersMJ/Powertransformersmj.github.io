// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: índice de stocks por fan_db_key
// ──────────────────────────────────────────────────────────────
// Microfase 3 de la integración Contratos · Mantenimiento Brigada.
//
// Función pura que toma una lista de suministros del contrato y una
// lista de movimientos del MISMO contrato y devuelve un Map indexado
// por `fan_db_key` con el stock disponible computado.
//
// Sirve para enriquecer los dropdowns de motoventiladores en
// Selección ONAF con un badge en tiempo real:
//
//   "Motoventilador Tipo 1 (FN063) · ✓ 36 disponibles"
//   "Motoventilador Tipo 3 (ZN063) · ⛔ Sin stock"
//
// Sin dependencias de Firebase. I/O vive en
// assets/js/data/refrigeracion-stock-loader.js.
// ══════════════════════════════════════════════════════════════

import { computarStockDesdeMovimientos } from './stock_calculo.js';
import { resolverFanDesdeSuministro } from './suministros_fan_db_map.js';

/**
 * @typedef {object} StockFanEntry
 * @property {string} fan_db_key
 * @property {string} codigo_suministro      · S03, S04…
 * @property {string} contrato_id
 * @property {string} nombre_contractual     · "Motoventilador Tipo N (MODELO)"
 * @property {number} stock_inicial          · cantidad pactada
 * @property {number} ingresado              · Σ tipo=ingreso
 * @property {number} egresado               · Σ tipo=egreso
 * @property {number} stock_actual           · inicial + ingresado - egresado
 * @property {boolean} disponible            · stock_actual > 0
 */

/**
 * Indexa los suministros de un contrato por `fan_db_key`,
 * computando el stock disponible para cada uno.
 *
 * Solo procesa suministros que tengan `fan_db_key` no vacío (los demás
 * — Coraza, Radiadores, etc. — quedan fuera del índice porque no son
 * motoventiladores).
 *
 * Si dos suministros del mismo contrato apuntan al mismo `fan_db_key`
 * (caso patológico que no debería pasar tras Microfase 2), gana el
 * primero y se reporta en `colisiones`.
 *
 * @param {Array<object>} suministros · sanitizados, del mismo contrato
 * @param {Array<object>} movimientos · del mismo contrato
 * @returns {{
 *   porFanKey: Map<string, StockFanEntry>,
 *   colisiones: Array<string>,
 *   resumen: { suministros: number, conFanKey: number, conStock: number, sinStock: number }
 * }}
 */
export function construirIndiceStocksFan(suministros, movimientos) {
  const porFanKey = new Map();
  const colisiones = [];
  const resumen = { suministros: 0, conFanKey: 0, conStock: 0, sinStock: 0 };

  if (!Array.isArray(suministros)) suministros = [];
  if (!Array.isArray(movimientos)) movimientos = [];

  // Agrupar movimientos por suministro_id en cliente (1 sola pasada).
  const movsPorSuministro = new Map();
  for (const m of movimientos) {
    if (!m || !m.suministro_id) continue;
    const key = String(m.suministro_id);
    if (!movsPorSuministro.has(key)) movsPorSuministro.set(key, []);
    movsPorSuministro.get(key).push(m);
  }

  for (const s of suministros) {
    resumen.suministros++;
    const enlace = resolverFanDesdeSuministro(s);
    if (!enlace) continue;  // suministro sin fan_db_key o key huérfana
    resumen.conFanKey++;

    if (porFanKey.has(enlace.fan_db_key)) {
      colisiones.push(enlace.fan_db_key);
      continue;
    }

    const movs = movsPorSuministro.get(String(s.codigo)) || [];
    const stock = computarStockDesdeMovimientos(enlace.stock_inicial, movs);

    const entry = {
      fan_db_key:         enlace.fan_db_key,
      codigo_suministro:  enlace.codigo_suministro,
      contrato_id:        enlace.contrato_id,
      nombre_contractual: enlace.nombre_contractual,
      stock_inicial:      stock.inicial,
      ingresado:          stock.ingresado,
      egresado:           stock.egresado,
      stock_actual:       stock.actual,
      disponible:         stock.actual > 0
    };
    porFanKey.set(enlace.fan_db_key, entry);

    if (entry.disponible) resumen.conStock++;
    else resumen.sinStock++;
  }

  return { porFanKey, colisiones, resumen };
}

/**
 * Genera el texto de badge para mostrar al lado del modelo en un
 * dropdown del cálculo Selección ONAF.
 *
 * Tres estados visuales:
 *   · stock > 0   → "· ✓ N disponibles"
 *   · stock = 0   → "· ⛔ Sin stock (cid contrato)"
 *   · no enlazado → "· ✗ Fuera de contrato"  (la entrada es null/undefined)
 *
 * @param {StockFanEntry|null|undefined} entry
 * @returns {string}
 */
export function badgeTexto(entry) {
  if (!entry) return '· ✗ Fuera de contrato';
  if (entry.stock_actual > 0) {
    return `· ✓ ${entry.stock_actual} disponibles`;
  }
  return `· ⛔ Sin stock · contrato ${entry.contrato_id}`;
}

/**
 * Indica si una opción del dropdown debe estar deshabilitada según
 * la entrada del índice de stocks. Es un wrapper semántico para
 * mantener la lógica en un solo lugar.
 *
 * Política: solo deshabilitamos las opciones que TIENEN tipificación
 * pero NO tienen stock. Las que están fuera de contrato (sin entry)
 * quedan habilitadas porque el usuario puede tipear datos manuales
 * o cargar un motoventilador no contractual.
 *
 * @param {StockFanEntry|null|undefined} entry
 * @returns {boolean}
 */
export function debeDeshabilitarse(entry) {
  return Boolean(entry && entry.stock_actual <= 0);
}
