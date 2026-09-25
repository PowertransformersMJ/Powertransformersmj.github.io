// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · FIRMAS DEL EQUIPO (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-25, `99 §99`): «el entregable en Excel debe
// llevar la firma de todos; es un documento de trazabilidad». Se le advirtió
// que estampar la firma de otros desde su cuenta muestra firmas de personas que
// no vieron esa versión; lo decidió así, con la autorización de cada titular.
//
// Las firmas del equipo las guarda un CUSTODIO (administrador) en SU espacio
// privado (Storage `firmas-equipo/{su uid}/{persona}`): solo él las lee, las
// reemplaza o las quita; otro administrador no las ve (la autorización se dio a
// una persona, no a un rol). Cada alta declara la fecha y el medio de la
// autorización del titular, y cada emisión con firmas del equipo queda en un
// registro que solo admite agregar (Firestore). Nada de esto toca el repositorio,
// que es PÚBLICO.
//
// Reglas de estampado (aquí, puras y probadas):
//  · La casilla de quien tiene la sesión lleva SU firma propia (`§71`/`§98`).
//  · Las demás casillas de personas DE LA LISTA llevan la firma del directorio,
//    buscada por CLAVE fija, nunca por el texto: «Otra persona» escrita a mano
//    jamás recibe una firma del directorio, aunque se escriba igual.
//  · «Recibe» también se estampa (decisión del Ingeniero, 2026-09-25).
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ══════════════════════════════════════════════════════════════════════════════

import { CASILLAS_FIRMA, firmanteDe, casillaEsDeLaSesion } from './fichas_firmantes.js';

/**
 * Personas de la lista dictada (`§89`) con su CLAVE fija. La clave no se deriva
 * del nombre en tiempo de ejecución (las tildes darían claves distintas) y es la
 * misma que exigen las reglas de Storage. Un mismo titular con dos nombres
 * dictados («MIGUEL A. JIMENEZ» / «MIGUEL JIMENEZ») es UNA persona.
 */
export const PERSONAS_EQUIPO = Object.freeze([
  Object.freeze({ id: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', nombres: Object.freeze(['MIGUEL A. JIMENEZ', 'MIGUEL JIMENEZ']) }),
  Object.freeze({ id: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', nombres: Object.freeze(['CARLOS MARTELO']) }),
  Object.freeze({ id: 'JORGE_RHENALS', nombre: 'JORGE RHENALS', nombres: Object.freeze(['JORGE RHENALS']) }),
  Object.freeze({ id: 'JORGE_MIRANDA', nombre: 'JORGE MIRANDA', nombres: Object.freeze(['JORGE MIRANDA']) }),
  Object.freeze({ id: 'ERICK_VERGARA', nombre: 'ERICK VERGARA', nombres: Object.freeze(['ERICK VERGARA']) })
]);

/** Claves válidas, en el orden de la lista. */
export const IDS_EQUIPO = Object.freeze(PERSONAS_EQUIPO.map((p) => p.id));

/** Clave de una persona de la lista por su nombre EXACTO de la lista, o null. */
export function idDeNombreDeLista(nombre) {
  const n = String(nombre == null ? '' : nombre).trim();
  const p = PERSONAS_EQUIPO.find((x) => x.nombres.includes(n));
  return p ? p.id : null;
}

/** Nombre para mostrar de una clave, o ''. */
export function nombreDePersona(id) {
  const p = PERSONAS_EQUIPO.find((x) => x.id === id);
  return p ? p.nombre : '';
}

/**
 * Clave de la persona DE LA LISTA que ocupa la casilla `k`, o null si la casilla
 * está en «Otra persona» o vacía. Se decide por la opción elegida (`otra`), no
 * por el texto: «Otra persona» escrita como «JORGE MIRANDA» devuelve null.
 */
export function personaDeCasilla(k, plan = {}) {
  const f = firmanteDe(k, plan);
  if (f.otra || !f.nombre) return null;
  return idDeNombreDeLista(f.nombre);
}

/**
 * Qué firma lleva cada casilla en una emisión con firmas del equipo.
 *
 * @param {object} plan           estado editable de la ficha
 * @param {string} nombreSesion   nombre de perfil de quien tiene la sesión
 * @param {{propia?: boolean, equipo?: Set<string>|string[]}} disponibles
 *        `propia`: hay firma propia de la sesión · `equipo`: claves con firma en el directorio
 * @returns {Array<{k:string, nombre:string, origen:('propia'|'equipo'|null), id:(string|null), motivo:string}>}
 */
export function planDeEstampado(plan = {}, nombreSesion = '', disponibles = {}) {
  const equipo = new Set(disponibles.equipo || []);
  return CASILLAS_FIRMA.map((k) => {
    const f = firmanteDe(k, plan);
    const id = personaDeCasilla(k, plan);
    if (!f.nombre) return { k, nombre: '', origen: null, id: null, motivo: 'Sin firmante.' };
    // La casilla de la sesión es SIEMPRE la firma propia; nunca la del directorio.
    if (casillaEsDeLaSesion(k, plan, nombreSesion)) {
      return disponibles.propia
        ? { k, nombre: f.nombre, origen: 'propia', id, motivo: '' }
        : { k, nombre: f.nombre, origen: null, id, motivo: 'Aún no ha cargado su firma propia.' };
    }
    if (!id) return { k, nombre: f.nombre, origen: null, id: null, motivo: 'Persona escrita a mano: no se estampa.' };
    if (equipo.has(id)) return { k, nombre: f.nombre, origen: 'equipo', id, motivo: '' };
    return { k, nombre: f.nombre, origen: null, id, motivo: 'No hay firma suya en el directorio.' };
  });
}

/** Personas de la ficha cuya firma hay que leer del directorio (sin la de la sesión). */
export function personasALeer(plan = {}, nombreSesion = '') {
  const ids = new Set();
  for (const k of CASILLAS_FIRMA) {
    if (casillaEsDeLaSesion(k, plan, nombreSesion)) continue;
    const id = personaDeCasilla(k, plan);
    if (id) ids.add(id);
  }
  return [...ids];
}

const esFechaReal = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

/**
 * Declaración de la autorización del titular (fecha ISO + medio), como en las
 * cédulas (`§78`). La fecha no puede ser futura.
 * @returns {{ok: boolean, motivo: string}}
 */
export function validarAutorizacion(aut = {}, hoyISO = new Date().toISOString().slice(0, 10)) {
  const fecha = String(aut.fecha || '').trim();
  const medio = String(aut.medio || '').trim();
  if (!esFechaReal(fecha)) return { ok: false, motivo: 'Escoja la fecha de la autorización.' };
  if (fecha > hoyISO) return { ok: false, motivo: 'La fecha de la autorización no puede ser futura.' };
  if (medio.length < 3) return { ok: false, motivo: 'Diga por qué medio autorizó (p. ej. «correo del 25/09/2026»).' };
  if (medio.length > 200) return { ok: false, motivo: 'El medio de la autorización es demasiado largo (máx. 200).' };
  return { ok: true, motivo: '' };
}

/** Folio corto y legible de una emisión a partir del id del registro. */
export function folioDeEmision(id) {
  return 'F-' + String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
}

/** Texto de la marca tenue que lleva cada firma del equipo dentro del Excel. */
export function textoMarca(folio) {
  return 'SGM ' + String(folio || '');
}
