// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Dominio puro: topes de lectura de Firestore
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE MÓDULO
// En Firestore se paga por DOCUMENTO leído, no por consulta. Una
// consulta sin `limit()` sobre una colección de N documentos cuesta
// N lecturas CADA vez que se abre la vista, y si además es un
// `onSnapshot` la factura se repite: cada escritura de un solo
// documento reenvía el resultado a TODAS las pestañas suscritas.
// Con el proyecto en plan Blaze (pago por uso) eso ya no es una
// molestia teórica: es dinero real y crece solo con el tiempo.
//
// La defensa es un tope POR DEFECTO en la capa de datos, no en cada
// pantalla: quien no pide límite recibe uno sensato; quien necesita
// otro (un export, por ejemplo) lo pide explícito y manda.
//
// CÓMO SE ELIGIERON LOS NÚMEROS
//  · LIMITE_TRANSFORMADORES = 500 — el parque de transformadores de
//    potencia se cuenta por centenas y crece por compra de activos
//    (unidades al año, no por hora). 500 cubre hoy el inventario
//    COMPLETO con holgura y ya era el tope usado por la vista de
//    Salud de Activos (`listarTransformadoresSalud`), así que no
//    introduce un criterio nuevo: unifica el que ya existía.
//  · LIMITE_ORDENES = 1000 — las órdenes de trabajo SÍ crecen sin
//    techo (histórico acumulado). Se leen ordenadas por `codigo`
//    descendente, o sea las más recientes primero, y los tableros
//    que las consumen (KPIs y motor de alertas) miran a lo sumo los
//    últimos 12 meses. 1000 órdenes cubren ese horizonte con margen
//    amplio y acotan el peor caso a ~1000 lecturas por apertura.
//  · LIMITE_EXPORT = 5000 — un CSV sí quiere el universo, pero
//    tampoco puede ser infinito: 5000 es el techo duro de una
//    descarga puntual y manual.
//
// Si un día una vista necesita el TOTAL real, NO se levantan estos
// topes: se usa el contador agregado (`contarTotal()` en la capa de
// datos, `getCountFromServer`), que cobra ~1 lectura por cada 1000
// documentos contados en lugar de traérselos todos.
// ══════════════════════════════════════════════════════════════

export const LIMITE_TRANSFORMADORES = 500;
export const LIMITE_ORDENES = 1000;
export const LIMITE_EXPORT = 5000;

/**
 * Devuelve una copia de `filtros` con `limite` garantizado.
 *
 * Regla: el límite EXPLÍCITO del llamador siempre manda (un export
 * legítimamente pide más que un tablero); el valor por defecto solo
 * cubre a quien no pidió nada. Valores inválidos (0, negativos, NaN,
 * texto) se tratan como "no pidió nada".
 *
 * @param {object} [filtros]
 * @param {number} porDefecto
 * @returns {object} copia de filtros con `limite` numérico > 0
 */
export function conLimite(filtros, porDefecto) {
  const f = { ...(filtros || {}) };
  const pedido = Number(f.limite);
  f.limite = Number.isFinite(pedido) && pedido > 0
    ? Math.trunc(pedido)
    : porDefecto;
  return f;
}

/**
 * ¿La consulta se quedó pegada al tope? Si se leyeron tantos
 * documentos como el límite, es muy probable que existan más y la
 * vista esté mostrando una foto parcial. Se usa para AVISAR, nunca
 * para levantar el tope en silencio.
 *
 * @param {number} leidos
 * @param {number} limite
 * @returns {boolean}
 */
export function estaTruncado(leidos, limite) {
  const n = Number(leidos);
  const l = Number(limite);
  if (!Number.isFinite(n) || !Number.isFinite(l) || l <= 0) return false;
  return n >= l;
}

/**
 * Diagnóstico legible de una lectura acotada, para telemetría o
 * para pintar un aviso "mostrando los primeros N".
 *
 * @param {string} coleccion
 * @param {number} leidos
 * @param {number} limite
 * @returns {{coleccion: string, leidos: number, limite: number, truncado: boolean}}
 */
export function diagnosticoLectura(coleccion, leidos, limite) {
  return {
    coleccion,
    leidos: Number(leidos) || 0,
    limite,
    truncado: estaTruncado(leidos, limite)
  };
}
