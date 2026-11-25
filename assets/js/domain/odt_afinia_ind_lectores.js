// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · quién más puede VERLOS (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): que un AZT habilitado (de la empresa que firma las ODT) también tenga acceso a los
// indicadores. Decidió: «Todo, solo lectura»: el lector ve lo mismo que el administrador (los contratistas, todos los filtros, periodo, comparación,
// historial y lista de ODT), pero NO carga ni guarda cortes.
//   · La lista es EXPLÍCITA (no «todo AZT»): odt_afinia_config/indicadores {lectores: [uid] (≤ 20), actualizadoPor
//     {uid, nombre}, actualizadoEn (hora del servidor)}. La crea y la cambia solo un admin con perfil; nadie la borra;
//     la lee cualquier persona con perfil (solo trae uids) para saber si mostrar la pestaña. Reglas: bloque
//     «Indicadores · ODT Afinia» de firestore.rules (odtIndLector y odtIndConfigLectores).
//   · El administrador elige entre los AZT habilitados de la lista blanca de la Firma (los que ofrece «Publicar ODT»),
//     con una casilla cada uno; un lector que ya no está entre ellos se sigue mostrando, marcado, para poder quitarlo.
//   · Para el lector, #indicadores abre el ÚLTIMO corte guardado de cualquier responsable (el de datos más recientes;
//     a igualdad, el guardado después): él no es responsable. La introducción dice de quién es el corte.
// Sin Firebase, sin DOM, sin red. Archivo NUEVO a propósito (L-102): todo lo que exporta es nuevo; al dominio de antes
// (odt_afinia_indicadores.js) solo le pide un nombre que ya existía (fechaDatosDeCorte).
// ══════════════════════════════════════════════════════════════════════════════

import { fechaDatosDeCorte } from './odt_afinia_indicadores.js';

/** El documento de la lista de lectores (la regla lo nombra igual: odtIndRutaLectores). */
export const CONFIG_INDICADORES = Object.freeze({ col: 'odt_afinia_config', doc: 'indicadores' });
/** Cuántas personas, como mucho, además de los administradores (la regla: lectores.size() <= 20). */
export const TOPE_LECTORES = 20;
/** Un uid como lo acepta la regla: letras, números, «_» o «-», de 1 a 128. */
const RE_UID = /^[A-Za-z0-9_-]{1,128}$/;
export const esUid = (u) => typeof u === 'string' && RE_UID.test(u);

export const TITULO_SECCION = 'Quién más puede ver los indicadores';
export const AYUDA_SECCION = 'Además de los administradores, pueden VER los indicadores las personas que marque aquí: ven lo mismo que usted (todos los contratistas, filtros, periodo, comparación, historial y lista de ODT), pero no cargan ni guardan cortes. La lista sale de los AZT habilitados en la lista blanca de la Firma de ODT.';
export const SIN_CANDIDATOS = 'No hay AZT habilitados en la lista blanca de la Firma de ODT para elegir.';
export const NOTA_FUERA_DE_LISTA = 'ya no es un AZT habilitado de la lista blanca: desmárquelo para quitarle el acceso';
export const SIN_CAMBIOS = 'No hay cambios que guardar: marque o desmarque a alguien primero.';
/** Si alguien sin acceso llega a «Cargar un corte» (#indicadores-cargar), se le lleva al último corte con este aviso. */
export const MSG_CARGAR_SOLO_ADMIN = 'Cargar un corte nuevo es solo para administradores: aquí está el último corte guardado.';
/** Lo mismo, cuando todavía no hay cortes guardados (no hay «último corte» que mostrar). */
export const MSG_CARGAR_SOLO_ADMIN_SIN_CORTES = 'Cargar un corte nuevo es solo para administradores.';
/** Junto a los filtros del AZT y del jefe, en un corte de la versión 1, para el LECTOR (él no carga cortes). */
export const NOTA_SIN_AZT_JEFE_LECTOR = 'Este corte se guardó antes de que se guardaran el AZT y el jefe de trabajo. Para filtrar por ellos, abra en el historial un corte más reciente.';
/** El final del aviso de un corte INCOMPLETO, para el LECTOR (él no carga cortes). */
export const CIERRE_INCOMPLETO_LECTOR = 'Un corte no se puede corregir: avise a un administrador para que cargue uno nuevo con el mismo archivo.';
/** El aviso cuando la página no deja ver la pestaña (ni admin ni lector). */
export const MSG_SIN_ACCESO = 'Los indicadores son solo para los administradores y las personas que ellos autoricen.';
/** El lector, sin cortes guardados todavía. */
export const VACIO_LECTOR = 'Todavía no hay cortes guardados. Cuando un administrador guarde uno, lo verá aquí.';
/** La introducción del lector antes de saber de quién es el corte (y si no se pudo leer). */
export const INTRO_LECTOR = 'Indicadores de ODT de Afinia en modo de solo lectura: los cortes los carga y los guarda un administrador, y cada uno queda guardado con su fecha (el historial es la trazabilidad).';

/**
 * La introducción del lector con el nombre del RESPONSABLE O.D.T. del corte (nunca «usted es RESPONSABLE O.D.T.»).
 * @param {string} responsable  como lo guardó el corte
 */
export function introLector(responsable) {
  const r = typeof responsable === 'string' ? responsable.trim() : '';
  if (!r) return INTRO_LECTOR;
  return 'Cuántas ODT hay generadas, ejecutadas y cerradas por contratista, de las ODT donde ' + r + ' es RESPONSABLE O.D.T. en Afinia (fechas previstas desde el 01/01/2026). Usted las ve en modo de solo lectura: los cortes los carga y los guarda un administrador, y cada uno queda guardado con su fecha (el historial es la trazabilidad).';
}

/** Los uids válidos de una lista, sin repetir y en su orden. */
export function normalizarLectores(lista) {
  const out = [];
  for (const u of Array.isArray(lista) ? lista : []) if (esUid(u) && !out.includes(u)) out.push(u);
  return out;
}
/** Los lectores de un documento leído (lo que no sea un uid se descarta). */
export const lectoresDe = (config) => normalizarLectores(config && config.lectores);
/** ¿`uid` está en la lista de lectores? */
export const esLectorIndicadores = (config, uid) => esUid(uid) && lectoresDe(config).includes(uid);
/**
 * ¿Esta sesión PUEDE ser lectora? Lo mismo que pide la regla (odtIndLector → isTeamMember): no es admin, su perfil está
 * activo y no es visitante. Así, un inactivo o un visitante que siga en la lista no ve una pestaña que la regla le niega.
 * @param {{uid?:string, esAdmin?:boolean, activo?:boolean, rol?:string}|null} sesion
 */
export function sesionPuedeSerLector(sesion) {
  return !!sesion && esUid(sesion.uid) && !sesion.esAdmin && sesion.activo !== false && !/visitante/i.test(String(sesion.rol || ''));
}

/** Por qué una lista no se puede guardar (null si se puede). */
export function errorLectores(uids) {
  if (!Array.isArray(uids)) return 'La lista de personas no es válida.';
  if (uids.some((u) => !esUid(u))) return 'Hay una persona sin identificador válido en la lista: recargue la página.';
  if (new Set(uids).size !== uids.length) return 'Hay una persona repetida en la lista: recargue la página.';
  if (uids.length > TOPE_LECTORES) return 'Se pueden elegir hasta ' + TOPE_LECTORES + ' personas.';
  return null;
}

/**
 * Lo que se guarda en odt_afinia_config/indicadores (la forma exacta de la regla: 3 campos).
 * @param {{uids:string[], por:{uid:string, nombre:string}, ts:any}} p  ts: serverTimestamp()
 * @returns {{lectores:string[], actualizadoPor:{uid:string, nombre:string}, actualizadoEn:any}}
 */
export function docLectores({ uids, por, ts }) {
  const e = errorLectores(uids);
  if (e) throw new Error(e);
  if (!por || !esUid(por.uid)) throw new Error('La sesión venció. Recargue la página e ingrese de nuevo.');
  return { lectores: [...uids], actualizadoPor: { uid: por.uid, nombre: typeof por.nombre === 'string' ? por.nombre : '' }, actualizadoEn: ts };
}

/**
 * Las casillas de la sección: los AZT elegibles (por nombre) y, al final, los lectores actuales que ya no están entre
 * ellos (marcados, con su nota, para poder quitarlos).
 * @param {{azt?:Array<{uid:string, nombre?:string}>, lectores?:string[], nombres?:Object<string,string>}} p
 *   nombres: uid → nombre de otras personas conocidas (p. ej. habilitados que ya no son elegibles)
 * @returns {Array<{uid:string, nombre:string, marcado:boolean, nota:string}>}
 */
export function opcionesLectores({ azt = [], lectores = [], nombres = {} } = {}) {
  const actuales = normalizarLectores(lectores);
  const vistos = new Set();
  const out = [];
  const porNombre = [...(azt || [])].filter((x) => x && esUid(x.uid))
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  for (const x of porNombre) {
    if (vistos.has(x.uid)) continue;
    vistos.add(x.uid);
    out.push({ uid: x.uid, nombre: String(x.nombre || '').trim() || '(sin nombre)', marcado: actuales.includes(x.uid), nota: '' });
  }
  for (const u of actuales) {
    if (vistos.has(u)) continue;
    vistos.add(u);
    const n = nombres && Object.prototype.hasOwnProperty.call(nombres, u) ? String(nombres[u] || '').trim() : '';
    out.push({ uid: u, nombre: n || 'Persona sin nombre conocido', marcado: true, nota: NOTA_FUERA_DE_LISTA });
  }
  return out;
}

/** Qué cambia entre la lista guardada y la marcada: {agregados, quitados, igual}. */
export function cambiosLectores(antes, ahora) {
  const a = normalizarLectores(antes); const b = normalizarLectores(ahora);
  const agregados = b.filter((u) => !a.includes(u));
  const quitados = a.filter((u) => !b.includes(u));
  return { agregados, quitados, igual: !agregados.length && !quitados.length };
}

/** «A, B y C» (o '' sin nombres). */
export function listaNombres(nombres) {
  const xs = (nombres || []).filter(Boolean);
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
}

/**
 * La frase de la confirmación («Guardar» → «Sí, guardar»), en llano.
 * @param {{agregados:string[], quitados:string[]}} c
 * @param {(uid:string)=>string} nombreDe
 * @param {number} quedan  cuántas personas quedarán con acceso (además de los administradores)
 */
export function textoConfirmacion(c, nombreDe, quedan) {
  const partes = [];
  if (c.agregados.length) partes.push('Podrán ver los indicadores (solo lectura): ' + listaNombres(c.agregados.map(nombreDe)) + '.');
  if (c.quitados.length) partes.push('Dejarán de verlos: ' + listaNombres(c.quitados.map(nombreDe)) + '.');
  partes.push(quedan === 0
    ? 'Después de guardar, solo los administradores verán los indicadores.'
    : 'Después de guardar, además de los administradores, los verá' + (quedan === 1 ? ' 1 persona.' : 'n ' + quedan + ' personas.'));
  return partes.join(' ');
}

/** Lo que dice la sección de la lista guardada: «Hoy, además de los administradores, los ve 1 persona: A.». */
export function textoActual(lectores, nombreDe) {
  const xs = normalizarLectores(lectores);
  if (!xs.length) return 'Hoy solo los administradores ven los indicadores.';
  return 'Hoy, además de los administradores, ' + (xs.length === 1 ? 'los ve 1 persona: ' : 'los ven ' + xs.length + ' personas: ') + listaNombres(xs.map(nombreDe)) + '.';
}

/**
 * De unos cortes (los del historial), el ÚLTIMO de cualquier responsable: el de datos más recientes (la hora de
 * descarga del archivo); a igualdad, el guardado después. null si no hay.
 */
export function ultimoCorteDeTodos(cortes) {
  let mejor = null; let km = null;
  for (const x of cortes || []) {
    if (!x || !x.id) continue;
    const kx = [fechaDatosDeCorte(x) || '', Number(x.creadoEnMs) || 0];
    if (!mejor || km[0] < kx[0] || (km[0] === kx[0] && km[1] < kx[1])) { mejor = x; km = kx; }
  }
  return mejor;
}
