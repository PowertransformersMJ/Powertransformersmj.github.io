// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: cédulas de los responsables (99 §78)
// ──────────────────────────────────────────────────────────────
// `responsables_ordenes/{NOMBRE_CON_GUIONES}` — reglas en `firestore.rules`,
// forma en `domain/responsables_ordenes.js`.
//
// Lo que NO se deshace "por comodidad":
//  · `cedulasPara(nombres)` lee SOLO las personas de la orden, justo al generar
//    el documento. No hay caché: una corrección o un retiro se ven en el
//    siguiente documento, y en la pestaña no quedan las demás cédulas.
//  · Nada de aquí se escribe en localStorage, sessionStorage ni archivos.
//    Firestore del sitio usa caché en MEMORIA (`firebase-init.js` no activa
//    persistencia): verificado 2026-09-16; si algún día se activa, este
//    módulo deja de cumplir su promesa.
//  · La bitácora nunca lleva los dígitos: solo la pista «•••123».
// Este módulo se carga con import() dinámico: si falla, se apagan las
// cédulas y el resto de Órdenes de Materiales sigue funcionando.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, getDoc, getDocs, query, limit, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { auditar } from '../domain/audit.js';
import {
  COLECCION_RESPONSABLES, idDeResponsable, normalizarCedula, problemaCedula, enmascarar
} from '../domain/responsables_ordenes.js';

export const ESPERA_MS = 6000;

/** codigo: 'sin-sesion' | 'invalida' | 'permiso' | 'red' | 'tiempo' */
export class ErrorCedulas extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.name = 'ErrorCedulas'; this.codigo = codigo; }
}

function db() {
  const d = getDbSafe();
  if (!d) throw new ErrorCedulas('sin-sesion', 'Firebase no está disponible en esta página.');
  return d;
}

function traducir(e) {
  if (e instanceof ErrorCedulas) return e;
  const code = String((e && e.code) || '');
  if (code === 'permission-denied') return new ErrorCedulas('permiso', 'Su usuario no tiene acceso a las cédulas.');
  return new ErrorCedulas('red', 'No hubo conexión para consultar las cédulas.');
}

function conEspera(promesa) {
  let t;
  const reloj = new Promise((_, rej) => {
    t = setTimeout(() => rej(new ErrorCedulas('tiempo', 'La consulta de cédulas no respondió a tiempo.')), ESPERA_MS);
  });
  return Promise.race([promesa, reloj]).finally(() => clearTimeout(t));
}

const refDe = (nombre) => doc(db(), COLECCION_RESPONSABLES, idDeResponsable(nombre));

/**
 * Cédulas de las personas indicadas (una lectura por persona, en paralelo).
 * @param {string[]} nombres
 * @returns {Promise<Map<string,string>>} nombre → cédula (solo las que existen)
 */
export async function cedulasPara(nombres) {
  const validos = (nombres || []).filter((n) => idDeResponsable(n));
  const mapa = new Map();
  if (!validos.length) return mapa;
  try {
    const snaps = await conEspera(Promise.all(validos.map((n) => getDoc(refDe(n)))));
    snaps.forEach((s, i) => {
      const c = s.exists() ? normalizarCedula(s.data().cedula) : '';
      if (c) mapa.set(validos[i], c);
    });
    return mapa;
  } catch (e) { throw traducir(e); }
}

/**
 * Directorio completo para el editor del administrador (la regla no deja
 * listar a nadie más). Devuelve la PISTA, no la cédula.
 * @returns {Promise<{nombre, pista, autorizacion, actualizadoPor}[]>}
 */
export async function listarParaEditor() {
  try {
    const snap = await conEspera(getDocs(query(collection(db(), COLECCION_RESPONSABLES), limit(50))));
    return snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        nombre: String(x.nombre || ''),
        pista: enmascarar(x.cedula),
        autorizacion: { fecha: String((x.autorizacion && x.autorizacion.fecha) || ''),
                        medio: String((x.autorizacion && x.autorizacion.medio) || '') },
        actualizadoPor: String((x.actualizadoPor && x.actualizadoPor.nombre) || '')
      };
    });
  } catch (e) { throw traducir(e); }
}

function autor() {
  const s = getSession();
  if (!s || !s.user || !s.user.uid) throw new ErrorCedulas('sin-sesion', 'No hay una sesión activa.');
  return { uid: s.user.uid, nombre: String((s.profile && s.profile.nombre) || ''), email: s.user.email, rol: s.role };
}

function bitacora(lote, accion, id, nota) {
  const a = autor();
  lote.set(doc(collection(db(), 'auditoria')), {
    ...auditar({ accion, coleccion: COLECCION_RESPONSABLES, docId: id, uid: a.uid, email: a.email, rol: a.rol, nota }),
    at: serverTimestamp()
  });
}

/**
 * Guarda (crea o reemplaza) la cédula de una persona, con su bitácora en el
 * mismo lote. `pistaAnterior` es la del editor: la bitácora dice «•••123 →
 * •••456» sin leer ni escribir dígitos.
 * @param {{nombre:string, cedula:string, autorizacion:{fecha:string, medio:string}, pistaAnterior?:string}} p
 */
export async function guardarCedula({ nombre, cedula, autorizacion, pistaAnterior }) {
  const id = idDeResponsable(nombre);
  const c = normalizarCedula(cedula);
  const problema = !id ? 'Nombre no válido.' : problemaCedula(c);
  if (problema) throw new ErrorCedulas('invalida', problema);
  const medio = String((autorizacion && autorizacion.medio) || '').trim();
  const fecha = String((autorizacion && autorizacion.fecha) || '');
  if (medio.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new ErrorCedulas('invalida', 'Declare cómo y cuándo autorizó la persona el uso de su cédula.');
  }
  const a = autor();
  try {
    const lote = writeBatch(db());
    lote.set(refDe(nombre), {
      nombre, cedula: c,
      autorizacion: { fecha, medio: medio.slice(0, 120) },
      actualizadoPor: { uid: a.uid, nombre: a.nombre },
      actualizadoEn: serverTimestamp()
    });
    bitacora(lote, 'actualizar', id, `cédula de ${nombre}: ${pistaAnterior || '(sin cédula)'} → ${enmascarar(c)}`);
    await conEspera(lote.commit());
  } catch (e) { throw traducir(e); }
  return { nombre, pista: enmascarar(c) };
}

/** Quita la cédula de una persona (su documento sale en blanco desde ya). */
export async function quitarCedula(nombre, pistaAnterior) {
  const id = idDeResponsable(nombre);
  if (!id) throw new ErrorCedulas('invalida', 'Nombre no válido.');
  try {
    const lote = writeBatch(db());
    lote.delete(refDe(nombre));
    bitacora(lote, 'eliminar', id, `cédula de ${nombre} retirada (${pistaAnterior || 'sin pista'})`);
    await conEspera(lote.commit());
  } catch (e) { throw traducir(e); }
}
