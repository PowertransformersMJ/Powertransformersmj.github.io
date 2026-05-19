// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Tipificación de suministros con FAN_DB
// ──────────────────────────────────────────────────────────────
// Microfase 2 de la integración Contratos · Suministros ↔
// Mantenimiento Brigada · Selección ONAF.
//
// Aplica `fan_db_key` a los suministros de motoventiladores
// existentes en Firestore, según el mapeo confirmado con el
// director (2026-05-18) para el contrato 4125000143.
//
// También corrige el suministro S06 del contrato 4125 (Tipo 4
// ZN045) que en el Excel local tenía:
//   - Unidad incorrecta: "mts" → corregir a "Und"
//   - Marcas: agregar "ZIEHL ABEGG" + "ENERGINN" (ambas válidas)
//
// Diseño consistente con scripts/migrate/v1-to-v2-transformadores.js:
//   1. `MAPEO_4125000143` y `MAPEO_4123000081` — constantes con la
//      tipificación congelada.
//   2. `aplicarTipificacion(suministroExistente, mapeo)` — función
//      PURA que devuelve el nuevo doc con fan_db_key + correcciones
//      aplicadas. No toca campos que no estén en el mapeo.
//   3. `ejecutarTipificacion({ list, write, log, dryRun, limite,
//      contratoId })` — runner DEFENSIVO. Acepta adaptador de I/O
//      arbitrario. Idempotente: si fan_db_key ya está aplicado y
//      no hay correcciones pendientes, no escribe.
//
// El director (Miguel Jimenez) confirmó la tipificación:
//   S03 → fn063_60       Motoventilador Tipo 1 (FN063)
//   S04 → fn050_60       Motoventilador Tipo 2 (FN050)
//   S05 → zn063_mono_60  Motoventilador Tipo 3 (ZN063)
//   S06 → zn045_60       Motoventilador Tipo 4 (ZN045)
// ══════════════════════════════════════════════════════════════

import { sanitizarSuministro } from '../../assets/js/domain/suministro_schema.js';
import { FAN_DB } from '../../assets/js/data/refrigeracion-fan-db.js';

/**
 * Mapeo de tipificación para el contrato 4125000143.
 *
 * Cada entrada describe cómo enriquecer el suministro existente:
 *   - fan_db_key: clave del FAN_DB a setear
 *   - marcas: array de marcas disponibles (el director pidió
 *     ENERGINN + ZIEHL ABEGG como opciones elegibles)
 *   - unidad (opcional): corrección de la unidad si la actual está mal
 */
// Valores unitarios extraídos del PDF "044-comunicacion-aceptacion-
// de-oferta-4125000143-1.pdf" (precios fijos sin IVA confirmados
// con el director).
export const MAPEO_4125000143 = Object.freeze([
  {
    codigo: 'S03',
    fan_db_key: 'fn063_60',
    marcas: ['ZIEHL ABEGG', 'ENERGINN'],
    valor_unitario: 5935453
  },
  {
    codigo: 'S04',
    fan_db_key: 'fn050_60',
    marcas: ['ZIEHL ABEGG', 'ENERGINN'],
    valor_unitario: 5064165
  },
  {
    codigo: 'S05',
    fan_db_key: 'zn063_mono_60',
    marcas: ['ZIEHL ABEGG', 'ENERGINN'],
    valor_unitario: 5826865
  },
  {
    codigo: 'S06',
    fan_db_key: 'zn045_60',
    marcas: ['ZIEHL ABEGG', 'ENERGINN'],
    unidad: 'Und',          // corrige el Excel local que tenía "mts"
    valor_unitario: 3763525
  }
]);

/**
 * Mapeo de tipificación para el contrato 4123000081.
 *
 * El director indicó: "en 4123 solo tipo 1 (pero permíteme escoger
 * si es FN-063 o FN-050)". Eso es decisión runtime, no de
 * tipificación congelada. El suministro queda sin fan_db_key
 * hasta que se confirme el modelo concreto desde la UI.
 *
 * Cuando se confirme, agregar la entrada aquí siguiendo el patrón
 * del 4125000143.
 */
export const MAPEO_4123000081 = Object.freeze([]);

/**
 * Aplica el mapeo de tipificación a un suministro existente.
 * Función pura: NO toca Firestore.
 *
 * @param {object} suministro — doc actual sanitizado
 * @param {object} mapeo — entrada del MAPEO_NNN
 * @returns {object} suministro modificado (o el mismo si nada cambia)
 */
export function aplicarTipificacion(suministro, mapeo) {
  if (!suministro || !mapeo) return suministro;

  // Validar que la clave existe en FAN_DB para no introducir huérfanas.
  if (mapeo.fan_db_key && !FAN_DB[mapeo.fan_db_key]) {
    throw new Error(
      `aplicarTipificacion: fan_db_key "${mapeo.fan_db_key}" no existe en FAN_DB. ` +
      `Disponibles: ${Object.keys(FAN_DB).join(', ')}.`
    );
  }

  const next = { ...suministro };

  // fan_db_key
  if (mapeo.fan_db_key && next.fan_db_key !== mapeo.fan_db_key) {
    next.fan_db_key = mapeo.fan_db_key;
  }

  // marcas_disponibles · merge (preserva las existentes, agrega las del mapeo)
  if (Array.isArray(mapeo.marcas) && mapeo.marcas.length) {
    const actuales = Array.isArray(next.marcas_disponibles) ? next.marcas_disponibles : [];
    const set = new Set([...actuales.map(s => String(s).trim()).filter(Boolean), ...mapeo.marcas]);
    next.marcas_disponibles = [...set];
  }

  // unidad (corrección opcional)
  if (mapeo.unidad && next.unidad !== mapeo.unidad) {
    next.unidad = mapeo.unidad;
  }

  // valor_unitario (corrección opcional · del PDF de aceptación de oferta).
  // Solo pisamos si está definido en el mapeo Y difiere de lo actual.
  if (typeof mapeo.valor_unitario === 'number' && mapeo.valor_unitario >= 0
      && next.valor_unitario !== mapeo.valor_unitario) {
    next.valor_unitario = mapeo.valor_unitario;
  }

  // Re-sanitizar para garantizar shape canónico final.
  return sanitizarSuministro(next);
}

/**
 * Detecta si un suministro necesita tipificación según el mapeo.
 * Útil para decidir si escribir o no (idempotencia).
 *
 * @param {object} suministro
 * @param {object} mapeo
 * @returns {boolean}
 */
export function necesitaTipificar(suministro, mapeo) {
  if (!suministro || !mapeo) return false;

  if (mapeo.fan_db_key && suministro.fan_db_key !== mapeo.fan_db_key) return true;
  if (mapeo.unidad && suministro.unidad !== mapeo.unidad) return true;
  if (typeof mapeo.valor_unitario === 'number'
      && mapeo.valor_unitario >= 0
      && suministro.valor_unitario !== mapeo.valor_unitario) return true;

  if (Array.isArray(mapeo.marcas) && mapeo.marcas.length) {
    const actuales = new Set(
      (Array.isArray(suministro.marcas_disponibles) ? suministro.marcas_disponibles : [])
        .map(s => String(s).trim())
    );
    for (const m of mapeo.marcas) {
      if (!actuales.has(m)) return true;
    }
  }

  return false;
}

/**
 * Runner defensivo que aplica un mapeo a todos los suministros de
 * un contrato. Acepta adaptador de I/O arbitrario para que el mismo
 * código corra desde web SDK, admin SDK o mock de tests.
 *
 * @param {object} opts
 * @param {Array<{codigo, fan_db_key, marcas, unidad?}>} opts.mapeo — mapeo a aplicar
 * @param {string} opts.contratoId — contrato_id del que tipificar suministros
 * @param {function(string, string): Promise<object|null>} opts.read — lee un suministro por contrato_id + codigo
 * @param {function(string, string, object): Promise<void>} [opts.write] — escribe un suministro (opcional si dryRun)
 * @param {function(...any): void} [opts.log] — logger (default console.info)
 * @param {boolean} [opts.dryRun=false] — si true, NO escribe
 * @param {number} [opts.limite] — máximo de docs a procesar (0 = ilimitado)
 * @returns {Promise<{escaneados, tipificados, sinCambio, faltantes, errores, lista}>}
 */
export async function ejecutarTipificacion({
  mapeo,
  contratoId,
  read,
  write,
  log = console.info,
  dryRun = false,
  limite = 0
}) {
  if (!Array.isArray(mapeo) || !mapeo.length) {
    throw new Error('ejecutarTipificacion: mapeo debe ser un array no vacío.');
  }
  if (!contratoId) {
    throw new Error('ejecutarTipificacion: contratoId es obligatorio.');
  }
  if (typeof read !== 'function') {
    throw new Error('ejecutarTipificacion: opts.read es obligatorio.');
  }
  if (!dryRun && typeof write !== 'function') {
    throw new Error('ejecutarTipificacion: opts.write es obligatorio cuando dryRun=false.');
  }

  const reporte = {
    escaneados: 0,
    tipificados: 0,
    sinCambio: 0,
    faltantes: [],
    errores: [],
    lista: []
  };

  const items = limite > 0 ? mapeo.slice(0, limite) : mapeo;

  for (const entrada of items) {
    reporte.escaneados++;
    try {
      const actual = await read(contratoId, entrada.codigo);
      if (!actual) {
        reporte.faltantes.push(entrada.codigo);
        log(`[tipificar] ⚠ ${contratoId}/${entrada.codigo}: no existe en Firestore`);
        continue;
      }
      if (!necesitaTipificar(actual, entrada)) {
        reporte.sinCambio++;
        log(`[tipificar] = ${contratoId}/${entrada.codigo}: ya tipificado, sin cambios`);
        continue;
      }
      const next = aplicarTipificacion(actual, entrada);
      reporte.lista.push({ codigo: entrada.codigo, antes: actual, despues: next });
      if (!dryRun) {
        await write(contratoId, entrada.codigo, next);
      }
      reporte.tipificados++;
      log(`[tipificar] ✓ ${contratoId}/${entrada.codigo}: fan_db_key=${entrada.fan_db_key}` +
          (dryRun ? ' (dryRun)' : ''));
    } catch (err) {
      reporte.errores.push({ codigo: entrada.codigo, error: err.message });
      log(`[tipificar] ✗ ${contratoId}/${entrada.codigo}: ${err.message}`);
    }
  }

  return reporte;
}
