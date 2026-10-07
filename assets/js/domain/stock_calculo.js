// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: motor puro de stock (Fase 39)
// ──────────────────────────────────────────────────────────────
// Helpers puros para:
//   · agregar movimientos (INGRESO/EGRESO) y derivar stock_actual,
//   · generar el siguiente correlativo MOV-YYYY-NNNN sin colisión,
//   · validar si un movimiento dejaría stock negativo.
//
// Vive en /domain/ (no en /data/) porque NO hace I/O. Lo importan
// tanto el data layer (movimientos.js) dentro de runTransaction
// como los tests unitarios.
// ══════════════════════════════════════════════════════════════

import { generarCodigoMov, MOVIMIENTO_CODIGO_PATTERN } from './schema.js';

/**
 * Agrega ingresos y egresos de un suministro.
 * Args:
 *   stockInicial — número (puede ser 0).
 *   movimientos  — array de {tipo, cantidad}. Otros campos ignorados.
 * Returns:
 *   { inicial, ingresado, egresado, actual }
 */
export function computarStockDesdeMovimientos(stockInicial, movimientos) {
  const ini = Number.isFinite(+stockInicial) ? +stockInicial : 0;
  let ingresado = 0;
  let egresado = 0;
  if (Array.isArray(movimientos)) {
    for (const m of movimientos) {
      const cant = Number.isFinite(+m?.cantidad) ? +m.cantidad : 0;
      if (cant <= 0) continue;
      if (m.tipo === 'INGRESO') ingresado += cant;
      else if (m.tipo === 'EGRESO') egresado += cant;
    }
  }
  return {
    inicial:   ini,
    ingresado: ingresado,
    egresado:  egresado,
    actual:    ini + ingresado - egresado
  };
}

/**
 * Calcula el siguiente secuencial dado un set de códigos del año.
 * Args:
 *   codigosExistentes — array de strings con formato MOV-YYYY-NNNN
 *                       (puede mezclar años; se filtra al pedido).
 *   anio              — año target.
 * Returns:
 *   integer >= 1.
 *
 * El caller (en runTransaction) garantiza que `codigosExistentes`
 * fue leído en el mismo batch que el create, evitando race condition.
 */
export function siguienteSecuencial(codigosExistentes, anio) {
  const a = +anio;
  if (!Number.isInteger(a)) throw new Error('siguienteSecuencial: anio inválido');
  let max = 0;
  if (Array.isArray(codigosExistentes)) {
    for (const c of codigosExistentes) {
      if (typeof c !== 'string') continue;
      if (!MOVIMIENTO_CODIGO_PATTERN.test(c)) continue;
      const [, anioStr, secStr] = c.match(/^MOV-(\d{4})-(\d{4})$/);
      if (+anioStr !== a) continue;
      const sec = +secStr;
      if (sec > max) max = sec;
    }
  }
  return max + 1;
}

/**
 * Conveniencia: combina siguienteSecuencial + generarCodigoMov.
 */
export function generarSiguienteCodigo(codigosExistentes, anio) {
  return generarCodigoMov(anio, siguienteSecuencial(codigosExistentes, anio));
}

/**
 * Valida que un movimiento no dejaría stock negativo.
 * Args:
 *   stockActual       — agregado actual del suministro.
 *   tipo              — 'INGRESO' | 'EGRESO'.
 *   cantidad          — entero >= 1.
 *   permitirNegativo  — bool, default false.
 * Returns:
 *   { ok: bool, faltante: number|null, resultado: number }
 *   faltante > 0 sólo cuando ok=false (stock no alcanza).
 */
export function validarStockMovimiento(stockActual, tipo, cantidad, permitirNegativo = false) {
  const a = +stockActual;
  const c = +cantidad;
  if (!Number.isFinite(a)) {
    return { ok: false, faltante: null, resultado: NaN };
  }
  if (!Number.isInteger(c) || c < 1) {
    return { ok: false, faltante: null, resultado: a };
  }
  const delta = (tipo === 'INGRESO') ? c : (tipo === 'EGRESO' ? -c : 0);
  const resultado = a + delta;
  if (resultado < 0 && !permitirNegativo) {
    return { ok: false, faltante: -resultado, resultado };
  }
  return { ok: true, faltante: null, resultado };
}

/**
 * Configuración por defecto del módulo (alineada con
 * /suministros_config/global). El data layer hace merge con el
 * doc remoto.
 */
export const DEFAULT_SUMINISTROS_CONFIG = Object.freeze({
  permitirNegativo:    false,
  umbral_critico_pct:  0.20,
  umbral_medio_pct:    0.50
});

/**
 * Valores en pesos del contrato para el tablero (pedido del Ingeniero, 2026-10-07: «el valor
 * disponible no coincide» con el pedido 5626000011).
 * Antes el «Valor contrato» era SIEMPRE Σ inicial × valor unitario, y el pedido no se reparte
 * exacto en unidades (en 4125000143 quedan $172.941,50 sin asignar): el disponible nunca
 * cuadraba con los documentos. Ahora, si el contrato tiene `monto_total` registrado, ese es el
 * valor; si no (contratos sin valor cargado), se conserva el cálculo por cantidades.
 *
 * Args:
 *   items       — [{ valor_unitario, stock: { inicial, egresado } }]
 *   montoTotal  — monto_total del contrato (0, vacío o inválido = no registrado).
 * Returns:
 *   { valorContrato, valorCantidades, valorConsumido, valorDisponible, ejecucion,
 *     fuente: 'contrato' | 'cantidades', diferencia }   (diferencia = contrato − cantidades)
 */
export function valoresContrato(items, montoTotal) {
  let valorCantidades = 0;
  let valorConsumido = 0;
  for (const r of (Array.isArray(items) ? items : [])) {
    const valU = Number.isFinite(+r?.valor_unitario) ? +r.valor_unitario : 0;
    const ini = Number.isFinite(+r?.stock?.inicial) ? +r.stock.inicial : 0;
    const egr = Number.isFinite(+r?.stock?.egresado) ? +r.stock.egresado : 0;
    valorCantidades += ini * valU;
    valorConsumido += egr * valU;
  }
  const monto = Number.isFinite(+montoTotal) && +montoTotal > 0 ? +montoTotal : 0;
  const valorContrato = monto || valorCantidades;
  return {
    valorContrato,
    valorCantidades,
    valorConsumido,
    valorDisponible: Math.max(0, valorContrato - valorConsumido),
    ejecucion: valorContrato > 0 ? valorConsumido / valorContrato : 0,
    fuente: monto ? 'contrato' : 'cantidades',
    diferencia: monto ? monto - valorCantidades : 0
  };
}
