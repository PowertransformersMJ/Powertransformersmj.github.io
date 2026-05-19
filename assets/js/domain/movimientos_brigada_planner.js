// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: planner de movimientos · Brigada → Suministros
// ──────────────────────────────────────────────────────────────
// Microfase 5 de la integración Contratos · Mantenimiento Brigada.
//
// Función pura que, dado un documento de acción de refrigeración
// EJECUTADA y un índice de stocks por fan_db_key del contrato,
// produce el array de movimientos de EGRESO que deben crearse en
// `/movimientos` para reflejar el consumo real del contrato.
//
// No hace I/O. El data layer (movimientos_brigada.js) toma esta
// lista y la persiste con `crearMovimiento` en transacción atómica.
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {object} MovimientoPlanificado
 * @property {string} suministro_id   · "S03", "S04", ...
 * @property {string} contrato_id     · "4125000143"
 * @property {string} tipo            · "EGRESO" (fijo)
 * @property {number} cantidad        · unidades consumidas (> 0)
 * @property {string} responsable     · UID del brigadista
 * @property {string} fecha           · ISO date "YYYY-MM-DD"
 * @property {string} referencia      · acción ID + fan_db_key, para trazabilidad inversa
 * @property {string} observaciones   · descripción humana
 * @property {object} _meta           · datos derivados para la UI / audit
 */

/**
 * Planifica los movimientos de egreso a generar cuando una acción
 * de refrigeración pasa al estado "ejecutada". Solo produce
 * movimientos para los items del mix cuyo `key` (fan_db_key) está
 * tipificado en el índice de stocks del contrato.
 *
 * Items fuera del contrato (sin entry en el índice) se reportan en
 * `fueraDeContrato` y NO generan movimiento — el director decide
 * si los registra manualmente desde el módulo Movimientos.
 *
 * @param {object} opts
 * @param {object} opts.accion · documento sanitizado de /acciones_refrigeracion
 * @param {string} opts.accionId · ID del doc para la trazabilidad inversa
 * @param {Map<string, object>} opts.indiceStocks · `state.stocksFan.porFanKey`
 * @param {string} [opts.contratoStock] · contrato_id activo (sanity check)
 * @returns {{
 *   movimientos: Array<MovimientoPlanificado>,
 *   fueraDeContrato: Array<{key: string, modelo: string, cantidad: number}>,
 *   sinStock: Array<{key: string, cantidad: number, stock_actual: number}>
 * }}
 */
export function planificarMovimientosEgreso({ accion, accionId, indiceStocks, contratoStock = '' } = {}) {
  const movimientos = [];
  const fueraDeContrato = [];
  const sinStock = [];

  if (!accion || !Array.isArray(accion.mix) || !indiceStocks || typeof indiceStocks.get !== 'function') {
    return { movimientos, fueraDeContrato, sinStock };
  }

  const fechaIso = accion.fecha_ejecucion || accion.fecha_accion ||
                   new Date().toISOString().slice(0, 10);
  const responsable = String(accion.responsable_uid || '');

  for (const item of accion.mix) {
    if (!item || !item.key) continue;
    const fanKey = String(item.key).toLowerCase();
    const cantidad = Math.max(0, Math.floor(Number(item.cantidad) || 0));
    if (cantidad <= 0) continue;

    const entry = indiceStocks.get(fanKey);
    if (!entry) {
      fueraDeContrato.push({ key: fanKey, modelo: String(item.modelo || ''), cantidad });
      continue;
    }

    // Sanity: el contrato del entry debe coincidir con el contrato activo.
    // Si no coincide, no movemos stock del contrato equivocado.
    if (contratoStock && entry.contrato_id && entry.contrato_id !== contratoStock) {
      fueraDeContrato.push({ key: fanKey, modelo: String(item.modelo || ''), cantidad });
      continue;
    }

    if (entry.stock_actual < cantidad) {
      sinStock.push({ key: fanKey, cantidad, stock_actual: entry.stock_actual });
      // Igual planificamos el movimiento — la transacción de
      // crearMovimiento lo rechazará si permitirNegativo=false, y el
      // operador verá el error explícito. NO silenciamos el caso.
    }

    const anio = parseInt(String(fechaIso).slice(0, 4), 10);
    movimientos.push({
      suministro_id:     entry.codigo_suministro,
      suministro_nombre: entry.nombre_contractual,
      contrato_id:       entry.contrato_id,
      anio:              Number.isInteger(anio) ? anio : new Date().getFullYear(),
      tipo:              'EGRESO',
      cantidad,
      marca:             String(item.marca || '').toUpperCase(),
      // Datos del activo intervenido — útiles para reportes de
      // consumo por matrícula/zona/depto en el dashboard del contrato.
      transformador_id:  String(accion.transformador_id || ''),
      matricula:         String(accion.matricula || ''),
      subestacion:       String(accion.subestacion || ''),
      zona:              String(accion.zona || ''),
      departamento:      String(accion.departamento || ''),
      // Identificación operativa del movimiento.
      usuario:           responsable,
      odt:               String(accion.odt || ''),
      observaciones:     armarObservacion(accion, entry, item, accionId),
      // Campos derivados internos (no se persisten directos, los lee
      // el data layer para construir referencias / audit / trace).
      _meta: {
        accion_id:           accionId,
        fan_db_key:          fanKey,
        nombre_contractual:  entry.nombre_contractual,
        codigo_suministro:   entry.codigo_suministro,
        contrato_id:         entry.contrato_id,
        cantidad,
        stock_previo:        entry.stock_actual,
        fecha:               fechaIso,
        referencia:          `accion_refrig:${accionId}:${fanKey}`
      }
    });
  }

  return { movimientos, fueraDeContrato, sinStock };
}

function armarObservacion(accion, entry, item, accionId) {
  const partes = [
    `Acción ${accionId}`,
    accion.matricula ? `transformador ${accion.matricula}` : null,
    accion.subestacion ? `S/E ${accion.subestacion}` : null,
    entry.nombre_contractual,
    `${item.cantidad} u`,
    item.disposicion ? `disposición ${item.disposicion}` : null,
    accion.accion_descripcion ? `· ${accion.accion_descripcion}` : null
  ].filter(Boolean);
  return partes.join(' · ');
}

/**
 * Detecta si una acción ya tuvo sus movimientos generados.
 * El marcador es persistente (campo del doc) para que la operación
 * sea idempotente entre re-ejecuciones de actualizarEstado.
 *
 * @param {object} accion
 * @returns {boolean}
 */
export function yaGeneroMovimientos(accion) {
  return Boolean(accion && accion.movimientos_brigada_generados);
}

/**
 * Construye el parche a aplicar sobre la acción tras generar los
 * movimientos, registrando los IDs creados para trazabilidad inversa
 * (poder volver de un movimiento a la acción que lo originó y
 * viceversa).
 *
 * @param {Array<string>} movIds · IDs/códigos devueltos por crearMovimiento
 * @returns {{ movimientos_brigada_generados: true, movimientos_brigada_refs: Array<string>, movimientos_brigada_generados_at: string }}
 */
export function parcheoTrazabilidad(movIds) {
  return {
    movimientos_brigada_generados:    true,
    movimientos_brigada_refs:         Array.isArray(movIds) ? movIds.filter(Boolean) : [],
    movimientos_brigada_generados_at: new Date().toISOString()
  };
}
