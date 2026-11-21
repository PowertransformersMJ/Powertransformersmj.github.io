// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · máquina de estados y turno (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
//   PENDIENTE_AZT ──(acto azt)──▶ PENDIENTE_RESPONSABLE ──(acto responsable)──▶ LISTA
//         └──────────────┴──(admin, con motivo)──▶ ANULADA
//   LISTA ──(admin, con motivo)──▶ REEMPLAZADA   (su N.º se puede volver a publicar)
//   LISTA ──(admin, fecha y soporte)──▶ CERRADA  (cerrada en Afinia: reposa en la página)
// Una ODT LISTA (ya firmada por los dos) NO se anula (D6 del Ingeniero, 20-11): se REEMPLAZA
// (decisión del 2026-11-21, que revierte D6 con su visto bueno). ANULADA, REEMPLAZADA y
// CERRADA son finales. Lo nuevo (reemplazo y cierre) vive en odt_afinia_cierre.js (L-102).
//
// Las reglas exigen lo mismo (DISENO-FINAL §3); esto da el mensaje claro ANTES
// de que la base lo niegue. Identidad SIEMPRE por uid, nunca por nombre (P2).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ESTADOS, ROLES, TOPES, esEstado, esRol } from './odt_afinia_rutas.js';
import { ESTADOS_CIERRE, ETIQUETA_ESTADO_CIERRE } from './odt_afinia_cierre.js';

const { CERRADA, REEMPLAZADA } = ESTADOS_CIERRE;

/** Cada firma mueve UN paso: de → a. */
export const TRANSICIONES = Object.freeze({
  azt: Object.freeze({ de: ESTADOS.PENDIENTE_AZT, a: ESTADOS.PENDIENTE_RESPONSABLE }),
  responsable: Object.freeze({ de: ESTADOS.PENDIENTE_RESPONSABLE, a: ESTADOS.LISTA })
});

/** Cómo se lee cada estado en pantalla. */
export const ETIQUETA_ESTADO = Object.freeze({
  [ESTADOS.PENDIENTE_AZT]: 'Pendiente: firma del AZT',
  [ESTADOS.PENDIENTE_RESPONSABLE]: 'Pendiente: firma del Responsable',
  [ESTADOS.LISTA]: 'Lista para descargar',
  [ESTADOS.ANULADA]: 'Anulada',
  ...ETIQUETA_ESTADO_CIERRE           // CERRADA: «Cerrada en Afinia» · REEMPLAZADA: «Reemplazada»
});

const uidDe = (odt, rol) => (odt && odt.firmantes && odt.firmantes[rol] && odt.firmantes[rol].uid) || null;

/** El rol al que le toca firmar en ese estado, o null (LISTA, ANULADA, CERRADA, REEMPLAZADA, desconocido). */
export function rolEnTurno(estado) {
  for (const rol of ROLES) if (TRANSICIONES[rol].de === estado) return rol;
  return null;
}

/** El rol de `uid` en la ODT ('azt' | 'responsable'), o null si no firma. */
export function rolDe(odt, uid) {
  if (!uid) return null;
  for (const rol of ROLES) if (uidDe(odt, rol) === uid) return rol;
  return null;
}

/** ¿Le toca firmar a `uid` ahora? */
export function esMiTurno(odt, uid) {
  const rol = rolDe(odt, uid);
  return !!rol && rolEnTurno(odt && odt.estado) === rol;
}

/**
 * ¿El acto de ese rol ya existe según el estado? (deducido de la máquina, sin leer actos).
 * CERRADA y REEMPLAZADA solo salen de LISTA: las dos firmas están.
 */
export function yaFirmo(odt, rol) {
  const e = odt && odt.estado;
  const conLasDos = e === ESTADOS.LISTA || e === CERRADA || e === REEMPLAZADA;
  if (rol === 'azt') return e === ESTADOS.PENDIENTE_RESPONSABLE || conLasDos;
  if (rol === 'responsable') return conLasDos;
  return false;
}

const no = (codigo, mensaje) => ({ ok: false, codigo, mensaje });

/**
 * Cambio que produce la firma de `rol` por `uid`: {ok:true, cambios:{estado, rev}}
 * o {ok:false, codigo, mensaje}. Solo estado y rev cambian (hasOnly en la regla).
 */
export function cambioFirma(odt, rol, uid) {
  if (!odt || !esEstado(odt.estado)) return no('no_existe', 'La ODT no existe o no se pudo leer.');
  if (!esRol(rol)) return no('validacion', 'Rol desconocido.');
  if (!uid) return no('sin_permiso', 'Debe iniciar sesión para firmar.');
  if (uidDe(odt, rol) !== uid) return no('sin_permiso', 'Esta casilla no es suya: solo firma la persona asignada a ese rol.');
  if (rol === 'responsable' && uidDe(odt, 'azt') === uid) return no('sin_permiso', 'La misma cuenta no puede firmar las dos casillas.');
  if (odt.estado === ESTADOS.ANULADA) return no('estado', 'La ODT fue anulada: ya no se firma.');
  if (odt.estado === ESTADOS.LISTA) return no('estado', 'La ODT ya tiene las dos firmas.');
  if (odt.estado === CERRADA) return no('estado', 'La ODT ya está cerrada en Afinia: ya no se firma.');
  if (odt.estado === REEMPLAZADA) return no('estado', 'La ODT fue reemplazada por otra versión: ya no se firma.');
  const t = TRANSICIONES[rol];
  if (odt.estado !== t.de) {
    return rol === 'responsable'
      ? no('estado', 'Todavía falta la firma del AZT: el Responsable firma después.')
      : no('estado', 'Su firma ya está registrada en esta ODT.');
  }
  const rev = Number.isInteger(odt.rev) ? odt.rev : 0;
  return { ok: true, cambios: { estado: t.a, rev: rev + 1 } };
}

/** Estados desde los que se anula (D6: nunca desde LISTA, ANULADA, CERRADA ni REEMPLAZADA). La regla exige lo mismo. */
export const ESTADOS_ANULABLES = Object.freeze([ESTADOS.PENDIENTE_AZT, ESTADOS.PENDIENTE_RESPONSABLE]);

/** ¿Se puede anular? (solo PENDIENTE_AZT o PENDIENTE_RESPONSABLE). */
export const puedeAnular = (odt) => !!odt && ESTADOS_ANULABLES.includes(odt.estado);

/**
 * Cambio de anulación (solo admin; la regla lo exige). `en` lo pone la capa de
 * datos con la hora del servidor. Devuelve {ok, cambios:{estado, rev, anulacion:{motivo, por}}}.
 */
export function cambioAnular(odt, { motivo, por } = {}) {
  if (odt && odt.estado === ESTADOS.LISTA) return no('estado', 'La ODT ya tiene las dos firmas: una ODT lista no se anula (si hay que corregirla, se reemplaza).');
  if (odt && odt.estado === CERRADA) return no('estado', 'La ODT ya está cerrada en Afinia: no se anula.');
  if (odt && odt.estado === REEMPLAZADA) return no('estado', 'La ODT ya fue reemplazada: no se anula.');
  if (!puedeAnular(odt)) return no('estado', 'La ODT ya está anulada o no existe.');
  const m = typeof motivo === 'string' ? motivo.trim() : '';
  if (m.length < TOPES.motivoMin || m.length > TOPES.motivoMax) {
    return no('validacion', 'El motivo debe tener entre ' + TOPES.motivoMin + ' y ' + TOPES.motivoMax + ' caracteres.');
  }
  if (!por || !por.uid || !por.nombre) return no('validacion', 'Falta quién anula.');
  const rev = Number.isInteger(odt.rev) ? odt.rev : 0;
  return { ok: true, cambios: { estado: ESTADOS.ANULADA, rev: rev + 1, anulacion: { motivo: m, por: { uid: por.uid, nombre: por.nombre } } } };
}

/**
 * Error de la pareja de firmantes al publicar, o null (los mismos «no» de la regla):
 * dos personas distintas y quien publica nunca es el AZT.
 */
export function errorFirmantes(firmantes, publicadorUid) {
  const a = firmantes && firmantes.azt; const r = firmantes && firmantes.responsable;
  if (!a || !a.uid || !r || !r.uid) return 'Faltan el AZT o el Responsable.';
  if (a.uid === r.uid) return 'El AZT y el Responsable deben ser personas distintas.';
  if (publicadorUid && a.uid === publicadorUid) return 'Quien publica la ODT no puede ser el AZT.';
  return null;
}

/**
 * Lista blanca por rol (odt_afinia_config/firmantes = {azt:[uid], responsable:[uid]}, que solo
 * se escribe desde la consola de Firebase). La regla de publicar exige que cada firmante esté
 * en la lista de SU rol; esto da el mismo «no» con un mensaje claro.
 * @returns {string|null}
 */
export function errorListaBlanca(config, firmantes) {
  if (!config) return 'Falta la lista blanca de firmantes: la crea el Ingeniero en la consola de Firebase.';
  const a = firmantes && firmantes.azt; const r = firmantes && firmantes.responsable;
  const lista = (rol) => (Array.isArray(config[rol]) ? config[rol] : []);
  if (a && a.uid && !lista('azt').includes(a.uid)) return (a.nombre || 'El AZT') + ' no está en la lista blanca de AZT EN SITIO (la cambia el Ingeniero en la consola).';
  if (r && r.uid && !lista('responsable').includes(r.uid)) return (r.nombre || 'El Responsable') + ' no está en la lista blanca de RESPONSABLE O.D.T. (la cambia el Ingeniero en la consola).';
  return null;
}

/**
 * Quién se puede ofrecer en cada casilla al publicar: habilitado, en la lista blanca de ESE
 * rol y con perfil activo que no es visitante (si se conoce su perfil). El AZT nunca es quien
 * publica. Devuelve {azt:[], responsable:[], fuera:[{uid, nombre, motivo}]}.
 * @param {Array<{uid:string, nombre:string}>} habilitados
 * @param {{azt?:string[], responsable?:string[]}|null} config
 * @param {Record<string, {activo?:boolean, rol?:string}|null>} [perfiles]  uid → perfil (null = sin perfil)
 * @param {string} [publicadorUid]
 */
export function firmantesElegibles(habilitados, config, perfiles = {}, publicadorUid = '') {
  const out = { azt: [], responsable: [], fuera: [] };
  const lista = (rol) => (config && Array.isArray(config[rol]) ? config[rol] : []);
  for (const h of habilitados || []) {
    if (!h || !h.uid) continue;
    const p = Object.prototype.hasOwnProperty.call(perfiles || {}, h.uid) ? perfiles[h.uid] : undefined;
    if (p === null) { out.fuera.push({ uid: h.uid, nombre: h.nombre, motivo: 'no tiene perfil' }); continue; }
    if (p && p.activo !== true) { out.fuera.push({ uid: h.uid, nombre: h.nombre, motivo: 'está inactivo' }); continue; }
    if (p && /visitante/i.test(String(p.rol || ''))) { out.fuera.push({ uid: h.uid, nombre: h.nombre, motivo: 'es visitante' }); continue; }
    const enAzt = lista('azt').includes(h.uid); const enResp = lista('responsable').includes(h.uid);
    if (!enAzt && !enResp) { out.fuera.push({ uid: h.uid, nombre: h.nombre, motivo: 'no está en la lista blanca' }); continue; }
    if (enAzt && h.uid !== publicadorUid) out.azt.push(h);
    if (enResp) out.responsable.push(h);
  }
  return out;
}

/**
 * Pestaña de la bandeja para `uid`:
 * 'mi_turno' | 'en_curso' | 'listas' | 'cerradas' | 'anuladas' (anuladas Y reemplazadas).
 */
export function grupoBandeja(odt, uid) {
  const e = odt && odt.estado;
  if (e === ESTADOS.ANULADA || e === REEMPLAZADA) return 'anuladas';
  if (e === CERRADA) return 'cerradas';
  if (e === ESTADOS.LISTA) return 'listas';
  if (esMiTurno(odt, uid)) return 'mi_turno';
  return 'en_curso';
}

/**
 * Reparte una lista de ODT en la bandeja; «firmadasPorMi» se cruza con las demás.
 * `cerradas` es una clave NUEVA (2026-11-21): la bandeja la lee con «|| []» por si este archivo quedó viejo.
 */
export function bandeja(odts, uid) {
  const out = { miTurno: [], enCurso: [], listas: [], cerradas: [], anuladas: [], firmadasPorMi: [] };
  const clave = { mi_turno: 'miTurno', en_curso: 'enCurso', listas: 'listas', cerradas: 'cerradas', anuladas: 'anuladas' };
  for (const o of odts || []) {
    out[clave[grupoBandeja(o, uid)]].push(o);
    const rol = rolDe(o, uid);
    if (rol && yaFirmo(o, rol)) out.firmadasPorMi.push(o);
  }
  return out;
}
