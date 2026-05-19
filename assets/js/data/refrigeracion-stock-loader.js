// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data: loader de stocks por fan_db_key
// ──────────────────────────────────────────────────────────────
// Microfase 3 de la integración Contratos · Mantenimiento Brigada.
//
// Orquesta las 2 queries Firestore (suministros + movimientos del
// contrato) y delega el indexado a la función pura
// `construirIndiceStocksFan` del dominio. Devuelve el Map listo
// para consumir desde la UI del cálculo Selección ONAF.
//
// Tres APIs:
//   · cargarStocksFan(contrato_id)               · one-shot snapshot
//   · suscribirStocksFan(contrato_id, onData)    · realtime onSnapshot
//   · contratosDisponibles()                     · lista de contratos
//                                                  vigentes para el
//                                                  selector de UI
// ══════════════════════════════════════════════════════════════

import * as suministros from './suministros.js';
import * as movimientos from './movimientos.js';
import { construirIndiceStocksFan } from '../domain/refrigeracion_stock_index.js';

/**
 * Carga one-shot el índice de stocks de motoventiladores de un
 * contrato. NO emite realtime; cada llamada hace 2 fetch.
 *
 * @param {string} contrato_id · "4123000081" | "4125000143"
 * @returns {Promise<{
 *   porFanKey: Map,
 *   colisiones: Array,
 *   resumen: { suministros, conFanKey, conStock, sinStock }
 * }>}
 */
export async function cargarStocksFan(contrato_id) {
  if (!contrato_id) {
    return construirIndiceStocksFan([], []);
  }
  const [sums, movs] = await Promise.all([
    suministros.listar({ contrato_id }),
    movimientos.listar({ contrato_id })
  ]);
  return construirIndiceStocksFan(sums, movs);
}

/**
 * Suscripción realtime al índice de stocks de un contrato. Cada vez
 * que cambia un suministro o un movimiento, recalcula el Map y llama
 * a `onData` con el nuevo índice.
 *
 * Devuelve un unsubscribe que cancela AMBAS suscripciones internas
 * (suministros + movimientos).
 *
 * Estrategia: tener cacheadas las 2 listas y, cuando alguna cambia,
 * recomputar el índice. Pequeño debounce de 200ms para no rerender
 * en cascada cuando ambas listas se actualizan casi en simultáneo.
 *
 * @param {string} contrato_id
 * @param {(indice: {porFanKey, colisiones, resumen}) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function suscribirStocksFan(contrato_id, onData, onError) {
  if (!contrato_id || typeof onData !== 'function') {
    return () => {};
  }
  let sumsCache = [];
  let movsCache = [];
  let pending = null;
  let cancelado = false;

  const emit = () => {
    if (cancelado) return;
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      if (cancelado) return;
      try {
        onData(construirIndiceStocksFan(sumsCache, movsCache));
      } catch (err) {
        if (onError) onError(err);
        else console.error('[refrigeracion-stock-loader] emit:', err);
      }
    }, 200);
  };

  const unsubS = suministros.suscribir(
    { contrato_id },
    (data) => { sumsCache = data || []; emit(); },
    (err)  => { if (onError) onError(err); else console.warn('[stock-loader] suministros:', err); }
  );
  const unsubM = movimientos.suscribir(
    { contrato_id },
    (data) => { movsCache = data || []; emit(); },
    (err)  => { if (onError) onError(err); else console.warn('[stock-loader] movimientos:', err); }
  );

  return () => {
    cancelado = true;
    if (pending) clearTimeout(pending);
    if (typeof unsubS === 'function') unsubS();
    if (typeof unsubM === 'function') unsubM();
  };
}

/**
 * Lista de contratos disponibles para el selector de la UI del
 * cálculo. Por ahora congelada con los 2 contratos activos
 * (4123000081 y 4125000143). Si en el futuro hay más contratos
 * de suministros, agregarlos aquí o leerlos desde `/contratos`.
 *
 * @returns {Array<{ id: string, label: string }>}
 */
export function contratosDisponibles() {
  return [
    { id: '4125000143', label: 'Contrato 4125000143 (Suministro Tx Potencia · Diciembre 2025)' },
    { id: '4123000081', label: 'Contrato 4123000081 (Suministro Tx Potencia · OT1 legacy)' }
  ];
}
