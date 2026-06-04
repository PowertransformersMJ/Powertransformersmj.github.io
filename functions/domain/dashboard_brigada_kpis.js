// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: KPIs de Brigada para el dashboard de Contratos
// ──────────────────────────────────────────────────────────────
// Microfase 6 de la integración Contratos · Mantenimiento Brigada.
//
// Función pura que toma:
//   · acciones de refrigeración del contrato (con sus mixes)
//   · movimientos del contrato (para correlacionar consumo real)
// y devuelve los KPIs y rankings que se renderean en la nueva
// sección "Consumo por Mantenimiento Brigada · Sistema de
// Refrigeración" del dashboard del contrato.
//
// Sin dependencia de Firebase. I/O vive en el JS del dashboard.
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {object} BrigadaKpis
 * @property {object} totales
 * @property {number} totales.accionesEjecutadas      · acciones con estado=ejecutada
 * @property {number} totales.accionesPlanificadas    · resto (planificadas + pendientes + aprobadas)
 * @property {number} totales.movimientosGenerados    · suma de movs creados por brigada
 * @property {number} totales.unidadesConsumidas      · suma de cantidades de los egresos brigada
 * @property {Array<object>} topModelos               · top N por unidades consumidas
 * @property {Array<object>} accionesRecientes        · top 5 acciones más recientes
 * @property {Array<object>} pendientesPorEjecutar    · acciones planificadas con mix > 0
 */

/**
 * Identifica si un movimiento fue generado automáticamente desde
 * una acción de Brigada (Microfase 5). El planner pone una
 * referencia con prefijo `accion_refrig:` en las observaciones.
 *
 * Como `referencia` no es un campo del schema persistente sino que
 * va dentro de `observaciones`, hacemos el match por substring.
 *
 * @param {object} mov
 * @returns {boolean}
 */
export function esEgresoDeBrigada(mov) {
  if (!mov || mov.tipo !== 'EGRESO') return false;
  const obs = String(mov.observaciones || '');
  return obs.startsWith('Acción ') || obs.includes('accion_refrig:');
}

/**
 * Calcula los KPIs de Brigada a partir de las listas crudas del
 * contrato. Función pura.
 *
 * @param {object} input
 * @param {Array<object>} input.acciones      · de /acciones_refrigeracion del contrato
 * @param {Array<object>} input.movimientos   · de /movimientos del contrato
 * @param {number} [input.topN=5]             · cuántos modelos en topModelos
 * @returns {BrigadaKpis}
 */
export function computarKpisBrigada({ acciones = [], movimientos = [], topN = 5 } = {}) {
  const accs = Array.isArray(acciones) ? acciones : [];
  const movs = Array.isArray(movimientos) ? movimientos : [];

  let accionesEjecutadas = 0;
  let accionesPlanificadas = 0;
  const pendientesPorEjecutar = [];

  for (const a of accs) {
    if (a.estado_accion === 'ejecutada') accionesEjecutadas++;
    else if (a.estado_accion === 'cancelada') { /* ignorado */ }
    else {
      accionesPlanificadas++;
      if (Array.isArray(a.mix) && a.mix.length > 0) {
        const totalU = a.mix.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
        if (totalU > 0) {
          pendientesPorEjecutar.push({
            id:           a.id,
            matricula:    a.matricula || '',
            subestacion:  a.subestacion || '',
            fecha:        a.fecha_accion || '',
            unidadesMix:  totalU,
            estado:       a.estado_accion || ''
          });
        }
      }
    }
  }

  // Filtrar movimientos generados por brigada y acumular por suministro.
  const consumoPorSuministro = new Map();  // suministro_id → {suministro_id, nombre, unidades, costo}
  let movimientosGenerados = 0;
  let unidadesConsumidas = 0;

  for (const m of movs) {
    if (!esEgresoDeBrigada(m)) continue;
    movimientosGenerados++;
    const cant = Number(m.cantidad) || 0;
    unidadesConsumidas += cant;
    const sid = String(m.suministro_id || '');
    if (!sid) continue;
    const prev = consumoPorSuministro.get(sid);
    if (prev) {
      prev.unidades += cant;
      prev.costo    += (Number(m.valor_total) || 0);
    } else {
      consumoPorSuministro.set(sid, {
        suministro_id: sid,
        nombre:        String(m.suministro_nombre || sid),
        unidades:      cant,
        costo:         Number(m.valor_total) || 0
      });
    }
  }

  // Top N modelos por unidades consumidas.
  const topModelos = [...consumoPorSuministro.values()]
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, Math.max(0, topN | 0));

  // Top 5 acciones recientes con egresos generados (ejecutadas).
  const accionesRecientes = accs
    .filter(a => a.movimientos_brigada_generados === true)
    .sort((a, b) => String(b.fecha_ejecucion || b.fecha_accion || '')
                      .localeCompare(String(a.fecha_ejecucion || a.fecha_accion || '')))
    .slice(0, 5)
    .map(a => ({
      id:           a.id,
      matricula:    a.matricula || '',
      subestacion:  a.subestacion || '',
      fecha:        a.fecha_ejecucion || a.fecha_accion || '',
      mixResumen:   resumirMix(a.mix),
      totalU:       Array.isArray(a.mix) ? a.mix.reduce((s, it) => s + (Number(it.cantidad) || 0), 0) : 0,
      movsRefs:     Array.isArray(a.movimientos_brigada_refs) ? a.movimientos_brigada_refs : []
    }));

  return {
    totales: {
      accionesEjecutadas,
      accionesPlanificadas,
      movimientosGenerados,
      unidadesConsumidas
    },
    topModelos,
    accionesRecientes,
    pendientesPorEjecutar
  };
}

function resumirMix(mix) {
  if (!Array.isArray(mix) || !mix.length) return '—';
  return mix.map(it => {
    const m = String(it.modelo || it.key || '?').split('-')[0] || '?';
    return `${m}×${it.cantidad}`;
  }).join(' · ');
}
