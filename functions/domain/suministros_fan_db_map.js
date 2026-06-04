// ═══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: enlace Suministros ↔ FAN_DB
// ───────────────────────────────────────────────────────────────
// Funciones puras que conectan dos módulos del sistema:
//
//   · /suministros/{cid}_{codigo}  — catálogo contractual con
//      stock_inicial pactado y movimientos asociados
//
//   · FAN_DB                       — catálogo congelado de fichas
//      técnicas de motoventiladores (13 fichas ZIEHL-ABEGG +
//      KRENZ) usado en Mantenimiento Brigada · Selección ONAF
//
// El enlace se establece con el campo opcional `fan_db_key` en el
// documento de suministro. Cuando está presente y coincide con una
// clave del FAN_DB, el motoventilador puede:
//   1. Mostrar stock contractual en vivo en el dropdown del cálculo
//   2. Bloquear "Agregar al mix" si excede el disponible
//   3. Generar movimientos automáticos de egreso al cerrar una
//      acción de mantenimiento en campo
//
// I/O vive en assets/js/data/. Estas funciones son 100% puras y
// testables sin Firebase.
// ═══════════════════════════════════════════════════════════════

import { FAN_DB } from '../data/refrigeracion-fan-db.js';
import { nombreContractualFan } from '../data/refrigeracion-fan-contractual.js';

/**
 * @typedef {object} EnlaceSuministroFan
 * @property {string} fan_db_key            · clave del FAN_DB (ej. 'fn050_60h')
 * @property {object} ficha                 · ficha técnica completa del FAN_DB
 * @property {string} nombre_contractual    · nombre canónico tipo "Motoventilador Tipo N (MODELO)"
 * @property {string} contrato_id           · contrato al que pertenece el suministro
 * @property {string} codigo_suministro     · código del suministro (S01, S02…)
 * @property {number} stock_inicial         · cantidad pactada en el contrato
 * @property {number} valor_unitario        · COP por unidad
 */

/**
 * Resuelve la ficha del FAN_DB asociada a un suministro y enriquece
 * con datos cross-módulo. Devuelve `null` si:
 *   · el suministro no tiene `fan_db_key`
 *   · `fan_db_key` no existe en FAN_DB (clave huérfana, error de
 *     tipificación)
 *
 * @param {object} suministro — documento sanitizado de /suministros
 * @returns {EnlaceSuministroFan|null}
 */
export function resolverFanDesdeSuministro(suministro) {
  if (!suministro || !suministro.fan_db_key) return null;
  const key = String(suministro.fan_db_key).toLowerCase();
  const ficha = FAN_DB[key];
  if (!ficha) return null;
  return {
    fan_db_key:        key,
    ficha,
    nombre_contractual: nombreContractualFan(key)
                         || `${ficha.fan_marca || ''} ${ficha.fan_modelo || ''}`.trim()
                         || key,
    contrato_id:       String(suministro.contrato_id || ''),
    codigo_suministro: String(suministro.codigo || ''),
    stock_inicial:     Number(suministro.stock_inicial) || 0,
    valor_unitario:    Number(suministro.valor_unitario) || 0
  };
}

/**
 * Operación inversa: dado una lista de suministros (típicamente los
 * del contrato activo), devuelve un Map indexado por `fan_db_key`
 * para hacer lookup O(1) cuando se popula el dropdown del cálculo
 * Selección ONAF.
 *
 * Si dos suministros del mismo contrato apuntan al mismo
 * `fan_db_key` (no debería pasar pero por defensa), gana el primero
 * y se reporta en el array `colisiones`.
 *
 * @param {Array<object>} suministros — array sanitizado
 * @returns {{ porFanKey: Map<string, EnlaceSuministroFan>, colisiones: Array<string> }}
 */
export function indexarSuministrosPorFanKey(suministros) {
  const porFanKey = new Map();
  const colisiones = [];
  if (!Array.isArray(suministros)) return { porFanKey, colisiones };
  for (const s of suministros) {
    const enlace = resolverFanDesdeSuministro(s);
    if (!enlace) continue;
    if (porFanKey.has(enlace.fan_db_key)) {
      colisiones.push(enlace.fan_db_key);
      continue;
    }
    porFanKey.set(enlace.fan_db_key, enlace);
  }
  return { porFanKey, colisiones };
}

/**
 * Reporte de cobertura: cuántas claves del FAN_DB ya están enlazadas
 * desde el catálogo de suministros entregado. Sirve para detectar
 * tipificaciones faltantes y motoventiladores fuera del contrato.
 *
 * @param {Array<object>} suministros
 * @returns {{ total: number, enlazadas: number, faltantes: Array<string> }}
 */
export function cobertura(suministros) {
  const claves = Object.keys(FAN_DB);
  const { porFanKey } = indexarSuministrosPorFanKey(suministros);
  const faltantes = claves.filter(k => !porFanKey.has(k));
  return {
    total: claves.length,
    enlazadas: claves.length - faltantes.length,
    faltantes
  };
}
