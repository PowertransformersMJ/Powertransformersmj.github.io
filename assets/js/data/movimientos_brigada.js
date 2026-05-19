// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data: orquesta generación de movimientos
// desde una acción de refrigeración EJECUTADA
// ──────────────────────────────────────────────────────────────
// Microfase 5 de la integración Contratos · Mantenimiento Brigada.
//
// API pública:
//   · generarMovimientosPorAccion({accionId, contratoStock, uid})
//
// Idempotente: si la acción ya tiene el flag
// `movimientos_brigada_generados=true`, NO genera nada nuevo.
// El flag + array `movimientos_brigada_refs` quedan en la acción
// para trazabilidad inversa (poder volver del movimiento a la acción).
// ══════════════════════════════════════════════════════════════

import * as acciones from './acciones_refrigeracion.js';
import * as movimientos from './movimientos.js';
import { cargarStocksFan } from './refrigeracion-stock-loader.js';
import {
  planificarMovimientosEgreso,
  yaGeneroMovimientos,
  parcheoTrazabilidad
} from '../domain/movimientos_brigada_planner.js';

/**
 * @typedef {object} ReporteGeneracion
 * @property {boolean} ok                    · todo correcto / parcial / falló
 * @property {string}  accionId
 * @property {string}  contratoStock
 * @property {Array<string>} movimientosCreados   · IDs/códigos de los movs creados
 * @property {Array<object>} fueraDeContrato      · items que no se generaron
 * @property {Array<object>} sinStock             · items con stock insuficiente
 * @property {Array<{key, error}>} errores        · fallos por item
 * @property {string}  motivo                     · explicación si ok=false
 */

/**
 * Genera los movimientos de egreso correspondientes a una acción
 * de refrigeración EJECUTADA. Se llama automáticamente desde el
 * hook `acciones.actualizarEstado(id, 'ejecutada')` y también puede
 * invocarse manualmente desde la UI admin si una acción quedó sin
 * movimientos generados.
 *
 * @param {object} opts
 * @param {string} opts.accionId         · ID del doc en /acciones_refrigeracion
 * @param {string} opts.contratoStock    · contrato_id base para chequeo
 * @param {string} [opts.uid]            · UID del usuario que dispara
 * @returns {Promise<ReporteGeneracion>}
 */
export async function generarMovimientosPorAccion({ accionId, contratoStock, uid } = {}) {
  const reporte = {
    ok: false,
    accionId,
    contratoStock,
    movimientosCreados: [],
    fueraDeContrato: [],
    sinStock: [],
    errores: [],
    motivo: ''
  };

  if (!accionId) {
    reporte.motivo = 'accionId es obligatorio';
    return reporte;
  }
  if (!contratoStock) {
    reporte.motivo = 'contratoStock vacío · la acción no quedó vinculada a un contrato';
    return reporte;
  }

  let accion = null;
  try {
    accion = await acciones.obtener(accionId);
  } catch (err) {
    reporte.motivo = 'No se pudo leer la acción: ' + (err.message || err);
    reporte.errores.push({ key: '_read_accion', error: err.message || String(err) });
    return reporte;
  }
  if (!accion) {
    reporte.motivo = 'La acción no existe en Firestore';
    return reporte;
  }

  // Idempotencia: si ya se generaron, no duplicar.
  if (yaGeneroMovimientos(accion)) {
    reporte.ok = true;
    reporte.motivo = 'Ya se habían generado previamente (idempotencia)';
    reporte.movimientosCreados = Array.isArray(accion.movimientos_brigada_refs)
      ? accion.movimientos_brigada_refs : [];
    return reporte;
  }

  // Cargar stocks actuales del contrato.
  let indice = null;
  try {
    indice = await cargarStocksFan(contratoStock);
  } catch (err) {
    reporte.motivo = 'No se pudo cargar el índice de stocks: ' + (err.message || err);
    reporte.errores.push({ key: '_load_stocks', error: err.message || String(err) });
    return reporte;
  }

  const plan = planificarMovimientosEgreso({
    accion, accionId, indiceStocks: indice.porFanKey, contratoStock
  });

  reporte.fueraDeContrato = plan.fueraDeContrato;
  reporte.sinStock        = plan.sinStock;

  if (!plan.movimientos.length) {
    reporte.ok = true;
    reporte.motivo = plan.fueraDeContrato.length
      ? 'Todos los items del mix están fuera del catálogo del contrato'
      : 'Sin movimientos a generar';
    return reporte;
  }

  // Crear cada movimiento secuencialmente. Si uno falla (ej. stock
  // negativo), seguir con los demás y reportar al final.
  for (const planMov of plan.movimientos) {
    try {
      // Stripped del _meta antes de persistir (no es parte del schema).
      const { _meta, ...payload } = planMov;
      const movId = await movimientos.crear(payload, uid);
      reporte.movimientosCreados.push(movId);
    } catch (err) {
      reporte.errores.push({
        key: planMov._meta?.fan_db_key || planMov.suministro_id,
        error: err.message || String(err)
      });
    }
  }

  // Marcar la acción como "movimientos generados" si al menos uno
  // se creó. La idempotencia siguiente evita re-procesar.
  if (reporte.movimientosCreados.length > 0) {
    try {
      const parche = parcheoTrazabilidad(reporte.movimientosCreados);
      await acciones.actualizar(accionId, parche);
    } catch (err) {
      reporte.errores.push({ key: '_marcar_accion', error: err.message || String(err) });
    }
  }

  reporte.ok = reporte.errores.length === 0;
  if (!reporte.ok && !reporte.motivo) {
    reporte.motivo = `${reporte.movimientosCreados.length} movs creados · ${reporte.errores.length} errores`;
  }
  return reporte;
}
