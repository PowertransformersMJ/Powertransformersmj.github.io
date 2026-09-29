// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Entrada/Salida (IT.05801) · qué firma lleva cada línea (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-28): «al exportar el pdf no salen las firmas de
// autorizado ni entregado». Decisión suya: «Entregado» con las firmas del equipo
// que él custodia, como en Fichas (`99 §99`/`§108`): Carlos Martelo y Jorge
// Rhenals ya las dieron con su autorización; confirmó que aceptan usarlas también
// en las órdenes de entrada y salida. Juan Cardona no está en el directorio: su
// línea sale en blanco hasta que se cargue la suya.
//
// Reglas:
//  · La línea de quien tiene la sesión lleva SU firma propia (`§71`), nunca la del
//    directorio; se reconoce por la lista cerrada de nombres (`firmas_sesion.js`).
//  · Del directorio SOLO sale la firma de quienes autorizaron su uso en órdenes
//    (`EQUIPO_EN_ORDENES`) y SOLO en «ENTREGADO POR», buscada por CLAVE fija
//    (nombre exacto de la lista), nunca por parecido. Revisión 2026-09-28: sin este
//    límite, una orden del registro con otros nombres llevaba firmas de personas que
//    no lo autorizaron, o en líneas que no eran la suya.
//  · Nadie más recibe una firma: su línea queda para firmar a mano.
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ══════════════════════════════════════════════════════════════════════════════

import { lineaDeLaSesion } from './firmas_sesion.js';
import { idDeNombreDeLista } from './firmas_equipo.js';

/** Las tres líneas de firma del formato, en su orden: [clave de la orden, rótulo]. */
export const LINEAS_ORDEN = Object.freeze([
  Object.freeze(['autorizado', 'AUTORIZADO POR']),
  Object.freeze(['entregado', 'ENTREGADO POR']),
  Object.freeze(['recibido', 'RECIBIDO POR'])
]);

const nombreDe = (orden, k) => String((((orden || {})[k]) || {}).nombre || '').trim();

/** Quienes autorizaron usar su firma del directorio en las órdenes (decisión del Ingeniero, 2026-09-28). */
export const EQUIPO_EN_ORDENES = Object.freeze(new Set(['CARLOS_MARTELO', 'JORGE_RHENALS']));
/** La única línea que puede llevar una firma del directorio. */
export const LINEA_EQUIPO = 'entregado';
/** ¿La línea `k` puede llevar la firma del directorio de la persona `id`? */
export function firmaDelEquipoAplica(k, id) { return k === LINEA_EQUIPO && EQUIPO_EN_ORDENES.has(id); }

/**
 * Qué firma lleva cada línea de una orden.
 * @param {object} orden  con `autorizado`, `entregado`, `recibido` ({nombre})
 * @param {string} nombreSesion  nombre del perfil de la sesión
 * @param {{propia?: boolean, equipo?: Iterable<string>}} disponibles
 *        `propia`: hay firma propia · `equipo`: claves con firma leída del directorio
 * @returns {Array<{k:string, rol:string, nombre:string, origen:('propia'|'equipo'|null), id:(string|null), motivo:string}>}
 */
export function planFirmasOrden(orden, nombreSesion = '', disponibles = {}) {
  const equipo = new Set(disponibles.equipo || []);
  return LINEAS_ORDEN.map(([k, rol]) => {
    const nombre = nombreDe(orden, k);
    if (!nombre) return { k, rol, nombre: '', origen: null, id: null, motivo: 'Sin nombre.' };
    const id = idDeNombreDeLista(nombre);
    if (lineaDeLaSesion(nombre, nombreSesion)) {
      return disponibles.propia
        ? { k, rol, nombre, origen: 'propia', id, motivo: '' }
        : { k, rol, nombre, origen: null, id, motivo: 'Aún no ha cargado su firma propia.' };
    }
    if (!id || !firmaDelEquipoAplica(k, id)) return { k, rol, nombre, origen: null, id, motivo: 'Se firma a mano.' };
    if (equipo.has(id)) return { k, rol, nombre, origen: 'equipo', id, motivo: '' };
    return { k, rol, nombre, origen: null, id, motivo: 'No hay firma suya en el directorio.' };
  });
}

/** Claves de las personas de la orden cuya firma hay que leer del directorio (sin la de la sesión). */
export function personasEquipoDeOrden(orden, nombreSesion = '') {
  const ids = new Set();
  for (const [k] of LINEAS_ORDEN) {
    const nombre = nombreDe(orden, k);
    if (!nombre || lineaDeLaSesion(nombre, nombreSesion)) continue;
    const id = idDeNombreDeLista(nombre);
    if (id && firmaDelEquipoAplica(k, id)) ids.add(id);
  }
  return [...ids];
}

/** Nombre del archivo con el folio de la emisión antes de la extensión: «…_F-AB12CD34.pdf». */
export function nombreConFolio(nombre, folio) {
  const s = String(nombre || ''); const f = String(folio || '');
  if (!f) return s;
  const i = s.lastIndexOf('.');
  return i > 0 ? s.slice(0, i) + '_' + f + s.slice(i) : s + '_' + f;
}
