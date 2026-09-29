// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes E/S · qué firma lleva cada línea cuando exporta un DELEGADO (puro)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-28): «que los usuarios de Carlos Martelo y Jorge
// Rhenals, al exportar la orden, salgan las firmas de ellos y la mía; yo autorizo».
// Decidió: desde el usuario de Carlos O de Jorge pueden salir las tres (la suya en
// «AUTORIZADO POR», la de Carlos o Jorge en «ENTREGADO POR»), cada una SOLO en su
// línea. El permiso lo da él, persona por persona, en `firmas_delegados/{uid}`
// (`99 §117`); las reglas del servidor lo vuelven a exigir.
//
// Reglas (espejo de `casillaDelegadaOk` en firestore.rules):
//  · Del directorio del custodio, SOLO las personas de la delegación y SOLO en su
//    línea: MIGUEL_JIMENEZ en «autorizado»; CARLOS_MARTELO o JORGE_RHENALS en «entregado».
//  · La línea del propio delegado se reconoce por la CLAVE que fijó el custodio
//    (`personaPropia`), no por el nombre de su perfil (el repo es público: sus
//    nombres completos no van en el código). Lleva su firma PROPIA («Mi firma») si
//    la cargó; si no, su copia del directorio (autorizada), como firma del equipo.
//  · «RECIBIDO POR» y cualquier otro nombre: siempre a mano.
//
// El camino del custodio (`ordenes_firmas.js`) queda INTACTO. Archivo NUEVO (L-102).
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ══════════════════════════════════════════════════════════════════════════════

import { idDeNombreDeLista } from './firmas_equipo.js';
import { LINEAS_ORDEN } from './ordenes_firmas.js';

/** Quién puede salir del directorio en cada línea cuando exporta un delegado. */
export const LINEAS_DELEGABLES = Object.freeze({
  autorizado: Object.freeze(['MIGUEL_JIMENEZ']),
  entregado: Object.freeze(['CARLOS_MARTELO', 'JORGE_RHENALS']),
  recibido: Object.freeze([])
});

const nombreDe = (orden, k) => String((((orden || {})[k]) || {}).nombre || '').trim();

/** ¿La persona `id` puede salir del directorio en la línea `k`, según la delegación? */
export function delegadaAplica(k, id, delegacion = {}) {
  const personas = Array.isArray(delegacion.personas) ? delegacion.personas : [];
  return !!id && (LINEAS_DELEGABLES[k] || []).includes(id) && personas.includes(id);
}

/** ¿La línea `k` con ese nombre es la del propio delegado? (por su clave, y solo en «entregado») */
export function esLineaDelDelegado(k, nombreDeLaLinea, delegacion = {}) {
  const propia = delegacion.personaPropia;
  return k === 'entregado' && !!propia && idDeNombreDeLista(nombreDeLaLinea) === propia;
}

/**
 * Qué firma lleva cada línea cuando exporta un delegado.
 * @param {object} orden  con `autorizado`, `entregado`, `recibido` ({nombre})
 * @param {{personas: string[], personaPropia: string}} delegacion
 * @param {{propia?: boolean, equipo?: Iterable<string>}} disponibles
 *        `propia`: el delegado cargó su «Mi firma» · `equipo`: claves leídas del directorio
 * @returns {Array<{k, rol, nombre, origen: ('propia'|'equipo'|null), id, motivo}>}
 */
export function planFirmasOrdenDelegada(orden, delegacion = {}, disponibles = {}) {
  const equipo = new Set(disponibles.equipo || []);
  return LINEAS_ORDEN.map(([k, rol]) => {
    const nombre = nombreDe(orden, k);
    if (!nombre) return { k, rol, nombre: '', origen: null, id: null, motivo: 'Sin nombre.' };
    const id = idDeNombreDeLista(nombre);
    const suya = esLineaDelDelegado(k, nombre, delegacion);
    if (suya && disponibles.propia) return { k, rol, nombre, origen: 'propia', id, motivo: '' };
    if (!delegadaAplica(k, id, delegacion)) {
      return { k, rol, nombre, origen: null, id, motivo: suya ? 'Aún no ha cargado su firma propia.' : 'Se firma a mano.' };
    }
    if (equipo.has(id)) return { k, rol, nombre, origen: 'equipo', id, motivo: '' };
    return { k, rol, nombre, origen: null, id, motivo: 'No hay firma suya en el directorio.' };
  });
}

/**
 * Claves que hay que leer del directorio para ESTA orden (sin la línea propia si
 * el delegado ya tiene su firma propia).
 */
export function personasALeerDelegada(orden, delegacion = {}, { propia = false } = {}) {
  const ids = new Set();
  for (const [k] of LINEAS_ORDEN) {
    const nombre = nombreDe(orden, k);
    if (!nombre) continue;
    if (propia && esLineaDelDelegado(k, nombre, delegacion)) continue;
    const id = idDeNombreDeLista(nombre);
    if (delegadaAplica(k, id, delegacion)) ids.add(id);
  }
  return [...ids];
}

/** Todas las claves del directorio que la delegación permite (para la vista previa y los avisos). */
export function personasDeLaDelegacion(delegacion = {}) {
  const personas = Array.isArray(delegacion.personas) ? delegacion.personas : [];
  const todas = [...LINEAS_DELEGABLES.autorizado, ...LINEAS_DELEGABLES.entregado];
  return todas.filter((id) => personas.includes(id));
}
