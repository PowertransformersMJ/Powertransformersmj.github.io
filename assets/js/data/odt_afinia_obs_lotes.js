// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · POR SUBSANAR · armado de los lotes (PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Lo que la capa de datos ESCRIBE, armado sin red: cada función devuelve las operaciones
// EXACTAS que el bloque «Por subsanar · ODT Afinia» de firestore.rules espera (allí la
// forma se valida con `size() == N` y la lectura de cada campo: aquí van exactamente esos).
//   · planRegistro      lote: odt_afinia_obs/{id} (11 campos) + candado odt_afinia_obs_nro/{nro}
//                       {obsId} (nuevo, o reasignado si la obs anterior de ese N.º está RESUELTA)
//                       + puntos/{0..n-1} (8 campos cada uno). Solo admin.
//   · planCambioPunto   lote atado: update del punto {estado, rev, rastro.<rev>} + update de la obs
//                       {resumen.<k>, ultimo}. Subsanar (AZT asignado), verificar o devolver (admin).
//   · planAgregarPunto  lote atado: set del punto nuevo + update de la obs {resumen.<k>, ultimo}. Solo admin.
//   · cambiosResolver   update de la obs {estado:'RESUELTA', rev, resolucion{nota, por, en}}. Solo admin.
// Los updates usan rutas de campo («rastro.3», «resumen.7»): solo se escribe lo que cambia, así
// dos cambios en puntos distintos de la misma ODT no se pisan.
// La marca de hora del servidor (`serverTimestamp()`) llega INYECTADA (`ts`): así las pruebas
// arman los lotes en Node sin Firebase.
// Sin Firebase, sin DOM. Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide
// nombres que ya existían (ErrorOdt, esIdOdt, firmanteDesdeHabilitacion).
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, esIdOdt, firmanteDesdeHabilitacion } from './odt_afinia_lotes.js';
import {
  COL_OBS, ESTADOS_OBS, ESTADOS_PUNTO, TOPES_OBS, esIdPunto, esQuien, limpiarTexto, erroresRegistro,
  transicionPunto, errorTextoPunto, errorResolver, siguienteIdPunto
} from '../domain/odt_afinia_obs.js';

const exige = (cond, mensaje) => { if (!cond) throw new ErrorOdt('validacion', mensaje); };
const texto = (v) => (typeof v === 'string' ? v : '');
/** {uid, nombre} tal cual la regla lo compara con odtQuien() (el nombre del perfil, también vacío). */
const porDe = (q) => ({ uid: q.uid, nombre: texto(q.nombre) });

/** Un punto nuevo (8 campos): {orden, texto, quien, estado, rev, rastro, creadoPor, creadoEn}. */
export function documentoPunto({ k, texto: t, quien, por, ts } = {}) {
  exige(esIdPunto(k), 'Número de punto inválido.');
  const s = limpiarTexto(t);
  const err = errorTextoPunto(s);
  exige(!err, err);
  exige(esQuien(quien), 'Diga a quién le toca el punto: Contratista, AZT o Responsable.');
  exige(por && por.uid, 'Falta quién registra.');
  return { orden: Number(k), texto: s, quien, estado: ESTADOS_PUNTO.PENDIENTE, rev: 0, rastro: {}, creadoPor: porDe(por), creadoEn: ts };
}

/**
 * Lote de registro: la obs, su candado y sus puntos.
 * @param {{id:string, form:{nro,subestacion,equipo,fechaPrevista}, azt:object, puntos:Array<{texto,quien}>,
 *          por:{uid:string, nombre:string}, ts:any}} p   azt: la HABILITACIÓN elegida (nombre y correo salen de ella)
 * @returns {{id:string, obs:object, operaciones:Array<{ruta:string[], datos:object}>}}
 */
export function planRegistro({ id, form = {}, azt, puntos = [], por = {}, ts } = {}) {
  exige(esIdOdt(id), 'Identificador inválido.');
  exige(por && por.uid, 'Falta quién registra.');
  const f = firmanteDesdeHabilitacion(azt || {});
  const errores = erroresRegistro({ ...form, aztUid: f.uid }, null, por);
  exige(!errores.length, errores.join(' '));
  exige(Array.isArray(puntos) && puntos.length >= 1 && puntos.length <= TOPES_OBS.puntosMax,
    'La ODT debe llevar de 1 a ' + TOPES_OBS.puntosMax + ' puntos.');
  const docsPuntos = puntos.map((p, i) => documentoPunto({ k: String(i), texto: p && p.texto, quien: p && p.quien, por, ts }));
  const nro = limpiarTexto(form.nro);
  const obs = {
    nro,
    subestacion: limpiarTexto(form.subestacion),
    equipo: limpiarTexto(form.equipo),
    fechaPrevista: limpiarTexto(form.fechaPrevista),
    azt: f,
    lectores: [f.uid],
    estado: ESTADOS_OBS.ABIERTA,
    resumen: Object.fromEntries(docsPuntos.map((_, i) => [String(i), ESTADOS_PUNTO.PENDIENTE])),
    creadoPor: porDe(por),
    creadoEn: ts,
    rev: 0
  };
  const operaciones = [
    { ruta: [COL_OBS.obs, id], datos: obs },
    { ruta: [COL_OBS.nro, nro], datos: { obsId: id } },
    ...docsPuntos.map((d, i) => ({ ruta: [COL_OBS.obs, id, COL_OBS.puntos, String(i)], datos: d }))
  ];
  return { id, obs, operaciones };
}

/**
 * Lote atado de un cambio de punto (subsanar, verificar o devolver).
 * @param {{obs:object, punto:object, accion:'subsanar'|'verificar'|'devolver', nota:string,
 *          sesion:{uid:string, nombre:string, esAdmin:boolean}, ts:any}} p   obs y punto leídos DEL SERVIDOR (con id)
 * @returns {{estado:string, rev:number, operaciones:Array}}
 */
export function planCambioPunto({ obs, punto, accion, nota, sesion = {}, ts } = {}) {
  exige(obs && esIdOdt(obs.id), 'ODT por subsanar sin identificador.');
  exige(punto && esIdPunto(String(punto.id)), 'Punto sin identificador.');
  const t = transicionPunto(obs, punto, accion, { nota, sesion });
  if (!t.ok) throw new ErrorOdt(t.codigo, t.mensaje);
  const k = String(punto.id);
  const entrada = { de: t.entrada.de, a: t.entrada.a, nota: t.entrada.nota, por: porDe(sesion), en: ts };
  return {
    estado: t.estado,
    rev: t.rev,
    operaciones: [
      { tipo: 'update', ruta: [COL_OBS.obs, obs.id, COL_OBS.puntos, k], datos: { estado: t.estado, rev: t.rev, ['rastro.' + t.rev]: entrada } },
      { tipo: 'update', ruta: [COL_OBS.obs, obs.id], datos: { ['resumen.' + k]: t.estado, ultimo: k } }
    ]
  };
}

/**
 * Lote atado de «Agregar punto» (admin, obs ABIERTA): el punto con el próximo id libre + su entrada en el resumen.
 * @returns {{k:string, operaciones:Array}}
 */
export function planAgregarPunto({ obs, texto: t, quien, por = {}, ts } = {}) {
  exige(obs && esIdOdt(obs.id), 'ODT por subsanar sin identificador.');
  if (obs.estado !== ESTADOS_OBS.ABIERTA) throw new ErrorOdt('estado', 'La ODT ya se dio por resuelta: no se le agregan puntos.');
  const k = siguienteIdPunto(obs);
  exige(k != null, 'La ODT ya tiene ' + TOPES_OBS.puntosMax + ' puntos: no caben más.');
  const datos = documentoPunto({ k, texto: t, quien, por, ts });
  return {
    k,
    operaciones: [
      { ruta: [COL_OBS.obs, obs.id, COL_OBS.puntos, k], datos },
      { tipo: 'update', ruta: [COL_OBS.obs, obs.id], datos: { ['resumen.' + k]: ESTADOS_PUNTO.PENDIENTE, ultimo: k } }
    ]
  };
}

/** update de la obs al darla por resuelta: {estado:'RESUELTA', rev, resolucion:{nota, por, en}}. */
export function cambiosResolver(obs, { nota, por = {}, ts } = {}) {
  const err = errorResolver(obs, nota);
  if (err) throw new ErrorOdt(obs && obs.estado === ESTADOS_OBS.ABIERTA ? 'validacion' : 'estado', err);
  exige(por && por.uid, 'Falta quién la da por resuelta.');
  return { estado: ESTADOS_OBS.RESUELTA, rev: (obs.rev || 0) + 1, resolucion: { nota: limpiarTexto(nota), por: porDe(por), en: ts } };
}
