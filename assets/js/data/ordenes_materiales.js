// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: registro de Órdenes de Materiales (99 §77)
// ──────────────────────────────────────────────────────────────
// `ordenes_materiales/{clave}`: las OE/OS del equipo. Reglas y límites en
// `firestore.rules` + `domain/ordenes_registro.js`.
//
// Tres decisiones que NO se deshacen "por comodidad":
//  · CREAR y EDITAR son caminos distintos. Crear falla si la orden ya existe
//    (nunca se ofrece reemplazar la orden de otro desde una orden nueva);
//    editar exige la versión con la que se abrió.
//  · Ningún diálogo va dentro de `runTransaction`: la función se reintenta
//    ante contención y la pregunta saldría dos veces. Aquí solo se compara y
//    se escribe; cualquier diferencia sale como `ErrorRegistro` (que el SDK
//    no reintenta) con el estado actual, y la UI decide.
//  · Borrar deja, en la MISMA transacción, la lápida con la copia exacta y la
//    bitácora. La regla no deja borrar sin lápida.
// Sin `onSnapshot`: una lectura acotada al abrir y un botón «Actualizar».
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, getDoc, getDocs, query, orderBy, limit,
  runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { auditar } from '../domain/audit.js';
import {
  COLECCION, COLECCION_BORRADAS, TOPE_LECTURA,
  aDocumento, ordenDesdeRegistro, problemasParaRegistro, aMilisegundos
} from '../domain/ordenes_registro.js';

/** Tiempo máximo que se espera al servidor antes de decir «no hubo respuesta». */
export const ESPERA_MS = 12000;

/**
 * Error del registro con un código que la UI sabe explicar:
 * 'sin-sesion' · 'invalida' · 'existe' · 'no-existe' · 'borrada' · 'version' ·
 * 'permiso' · 'red' · 'tiempo'. `actual` = la orden como está en el registro;
 * `lapida` = { borradaPor, borradaEn } si la eliminaron.
 */
export class ErrorRegistro extends Error {
  constructor(codigo, mensaje, extra) {
    super(mensaje);
    this.name = 'ErrorRegistro';
    this.codigo = codigo;
    Object.assign(this, extra || {});
  }
}

export function disponible() { return isFirebaseConfigured && !!getDbSafe(); }

function db() {
  const d = getDbSafe();
  if (!d) throw new ErrorRegistro('sin-sesion', 'Firebase no está disponible en esta página.');
  return d;
}

/** Quién escribe: uid + el nombre EXACTO de su perfil (la regla lo compara). */
export function autorActual() {
  const s = getSession();
  if (!s || !s.user || !s.user.uid) {
    throw new ErrorRegistro('sin-sesion', 'No hay una sesión activa: vuelva a iniciar sesión.');
  }
  return { uid: s.user.uid, nombre: String((s.profile && s.profile.nombre) || '') };
}

const refOrden = (clave) => doc(db(), COLECCION, clave);
const refLapida = (clave) => doc(db(), COLECCION_BORRADAS, clave);

function lapidaDe(data) {
  if (!data) return null;
  return {
    borradaPor: { uid: String((data.borradaPor && data.borradaPor.uid) || ''),
                  nombre: String((data.borradaPor && data.borradaPor.nombre) || '') },
    borradaEn: aMilisegundos(data.borradaEn)
  };
}

/** Errores del SDK → códigos del registro. Los propios pasan tal cual. */
function traducir(e) {
  if (e instanceof ErrorRegistro) return e;
  const code = String((e && e.code) || '');
  if (code === 'permission-denied') {
    return new ErrorRegistro('permiso', 'El registro rechazó la operación.', { causa: e });
  }
  if (['unavailable', 'deadline-exceeded', 'failed-precondition', 'cancelled'].includes(code) ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return new ErrorRegistro('red', 'No hubo conexión con el registro.', { causa: e });
  }
  return new ErrorRegistro('red', (e && e.message) || 'No se pudo completar la operación.', { causa: e });
}

/** La promesa, o un ErrorRegistro('tiempo') si el servidor no contesta a tiempo. */
function conEspera(promesa) {
  let t;
  const reloj = new Promise((_, rej) => {
    t = setTimeout(() => rej(new ErrorRegistro('tiempo', 'El registro no respondió a tiempo.')), ESPERA_MS);
  });
  return Promise.race([promesa, reloj]).finally(() => clearTimeout(t));
}

function registroBitacora(tx, accion, clave, nota, antes) {
  const s = getSession() || {};
  const u = s.user || {};
  tx.set(doc(collection(db(), 'auditoria')), {
    ...auditar({
      accion, coleccion: COLECCION, docId: clave,
      uid: u.uid, email: u.email, rol: s.role,
      diff: antes ? { antes } : null, nota
    }),
    at: serverTimestamp()
  });
}

/**
 * Las órdenes del registro, las de fecha más reciente primero.
 * @returns {Promise<{ordenes: object[], truncado: boolean}>}
 */
export async function listar() {
  try {
    const q = query(collection(db(), COLECCION), orderBy('fechaISO', 'desc'), limit(TOPE_LECTURA + 1));
    const snap = await conEspera(getDocs(q));
    const ordenes = snap.docs.map((d) => ordenDesdeRegistro(d.id, d.data()));
    const truncado = ordenes.length > TOPE_LECTURA;
    return { ordenes: truncado ? ordenes.slice(0, TOPE_LECTURA) : ordenes, truncado };
  } catch (e) { throw traducir(e); }
}

/**
 * Una orden por clave, con su lápida si no existe.
 * @returns {Promise<{orden: object|null, lapida: object|null}>}
 */
export async function obtener(clave) {
  try {
    const s = await conEspera(getDoc(refOrden(clave)));
    if (s.exists()) return { orden: ordenDesdeRegistro(s.id, s.data()), lapida: null };
    const l = await conEspera(getDoc(refLapida(clave)));
    return { orden: null, lapida: l.exists() ? lapidaDe(l.data()) : null };
  } catch (e) { throw traducir(e); }
}

/** Orden local tal como quedó escrita, para actualizar la lista sin releer. */
function comoQuedo(datos, extra) {
  const ahora = Date.now();
  return ordenDesdeRegistro(datos.clave, Object.assign({}, datos, extra, {
    creadoEn: extra.creadoEn === undefined ? ahora : extra.creadoEn,
    actualizadoEn: ahora
  }));
}

/**
 * Crea una orden. Falla con 'existe' si ya hay una con ese tipo y número.
 * @param {object} orden  la del formulario (o del navegador, al subir)
 * @param {{migradaDe?: 'navegador'|'pendiente', elaboradaEn?: string}} [opts]
 */
export async function crear(orden, opts = {}) {
  const problemas = problemasParaRegistro(orden);
  if (problemas.length) throw new ErrorRegistro('invalida', problemas[0], { problemas });
  const { datos, ajustes } = aDocumento(orden);
  const yo = autorActual();
  const extra = {};
  if (opts.migradaDe) extra.migradaDe = opts.migradaDe;
  if (opts.elaboradaEn) extra.elaboradaEn = String(opts.elaboradaEn).slice(0, 40);

  try {
    await conEspera(runTransaction(db(), async (tx) => {
      const ref = refOrden(datos.clave);
      const s = await tx.get(ref);
      if (s.exists()) {
        throw new ErrorRegistro('existe', 'Ya hay una orden con ese tipo y número.',
          { actual: ordenDesdeRegistro(s.id, s.data()) });
      }
      tx.set(ref, {
        ...datos, ...extra,
        creadoPor: yo, creadoEn: serverTimestamp(),
        actualizadoPor: yo, actualizadoEn: serverTimestamp(),
        version: 1
      });
      registroBitacora(tx, 'crear', datos.clave,
        `${datos.tipo} N.º ${datos.numero}` + (opts.migradaDe ? ` (subida desde ${opts.migradaDe})` : ''));
    }));
  } catch (e) { throw traducir(e); }

  return { orden: comoQuedo(datos, { ...extra, creadoPor: yo, actualizadoPor: yo, version: 1 }), ajustes };
}

/**
 * Edita una orden abierta desde el registro.
 * @param {object} orden
 * @param {number} versionEsperada la versión con la que se abrió (o la actual, para «guardar la mía encima»)
 */
export async function editar(orden, versionEsperada) {
  const problemas = problemasParaRegistro(orden);
  if (problemas.length) throw new ErrorRegistro('invalida', problemas[0], { problemas });
  const { datos, ajustes } = aDocumento(orden);
  const yo = autorActual();
  let previa = null;

  try {
    await conEspera(runTransaction(db(), async (tx) => {
      const ref = refOrden(datos.clave);
      const s = await tx.get(ref);
      if (!s.exists()) {
        const l = await tx.get(refLapida(datos.clave));
        throw l.exists()
          ? new ErrorRegistro('borrada', 'La orden fue eliminada del registro.', { lapida: lapidaDe(l.data()) })
          : new ErrorRegistro('no-existe', 'La orden ya no está en el registro.');
      }
      const actual = s.data();
      if (actual.version !== versionEsperada) {
        throw new ErrorRegistro('version', 'Otra persona guardó cambios en esta orden.',
          { actual: ordenDesdeRegistro(s.id, actual) });
      }
      previa = actual;
      // tipo, número y clave no cambian (la regla lo exige): van igual que antes.
      const { clave, tipo, numero, ...editables } = datos;
      tx.update(ref, {
        ...editables,
        actualizadoPor: yo, actualizadoEn: serverTimestamp(),
        version: actual.version + 1
      });
      registroBitacora(tx, 'actualizar', clave, `${tipo} N.º ${numero} → v${actual.version + 1}`, actual);
    }));
  } catch (e) { throw traducir(e); }

  return {
    orden: comoQuedo(datos, {
      creadoPor: previa.creadoPor, creadoEn: aMilisegundos(previa.creadoEn),
      migradaDe: previa.migradaDe, elaboradaEn: previa.elaboradaEn,
      actualizadoPor: yo, version: previa.version + 1
    }),
    ajustes
  };
}

/** Elimina una orden (creador o admin; lo impone la regla). */
export async function eliminar(clave, versionEsperada) {
  const yo = autorActual();
  try {
    await conEspera(runTransaction(db(), async (tx) => {
      const ref = refOrden(clave);
      const s = await tx.get(ref);
      if (!s.exists()) throw new ErrorRegistro('no-existe', 'La orden ya no está en el registro.');
      const actual = s.data();
      if (actual.version !== versionEsperada) {
        throw new ErrorRegistro('version', 'Otra persona guardó cambios en esta orden.',
          { actual: ordenDesdeRegistro(s.id, actual) });
      }
      tx.delete(ref);
      tx.set(refLapida(clave), { clave, borradaPor: yo, borradaEn: serverTimestamp(), orden: actual });
      registroBitacora(tx, 'eliminar', clave, `${actual.tipo} N.º ${actual.numero} (v${actual.version})`, actual);
    }));
  } catch (e) { throw traducir(e); }
}
