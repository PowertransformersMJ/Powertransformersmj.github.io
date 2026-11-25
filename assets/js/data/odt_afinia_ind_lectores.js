// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · repositorio de la LISTA DE LECTORES en FIRESTORE
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): que un AZT también tenga acceso a los indicadores («Todo, solo lectura»). El documento
// odt_afinia_config/indicadores {lectores: [uid], actualizadoPor {uid, nombre}, actualizadoEn} dice quién, además de los
// administradores, puede LEER los cortes (reglas: bloque «Indicadores · ODT Afinia» de firestore.rules; pruebas:
// tests-rules/odt_afinia_cortes_lectores.rules.test.js). Lo que se guarda lo arma domain/odt_afinia_ind_lectores.js.
//   · leer       el documento, DEL SERVIDOR (cualquier persona con perfil): {lectores, actualizadoPor, actualizadoEnMs}
//                o null si todavía no existe (entonces solo los administradores ven los indicadores);
//   · soyLector  ¿la sesión está en la lista? (false ante cualquier duda: sin sesión, sin red o sin documento). Antes
//                de leer, la sesión debe poder serlo como lo pide la regla (activa y no visitante: sesionPuedeSerLector);
//   · comprobarLector  lo mismo, diciendo además si NO se pudo comprobar por la conexión (`sinComprobar`: sin red o
//                sin respuesta a tiempo), para que la página avise que se recargue en vez de decir que no tiene acceso;
//   · guardar    la lista nueva (solo un admin con perfil): setDoc del documento entero (crear o cambiar), y se
//                vuelve a leer del servidor para confirmar lo que quedó. No se borra nunca (la regla lo niega).
// El SDK y la base se pueden INYECTAR (las pruebas usan dobles en Node). Sin inyección, el SDK se carga del CDN
// 10.14.1 la primera vez que se usa (el mismo de data/odt_afinia.js).
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, errorDesdeFirebase, sesionGlobal } from './odt_afinia_lotes.js';
import { CONFIG_INDICADORES, docLectores, errorLectores, lectoresDe, esLectorIndicadores, sesionPuedeSerLector } from '../domain/odt_afinia_ind_lectores.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
/** Espera máxima de la escritura antes de ir a comprobar al servidor. */
export const TIEMPO_GUARDAR_LECTORES_MS = 30000;
export const MSG_SOLO_ADMIN_LECTORES = 'Solo un administrador elige quién más puede ver los indicadores.';

const aMs = (t) => {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  return null;
};
function conTope(promesa, ms) {
  let t;
  const tope = new Promise((_, rej) => { t = setTimeout(() => rej(new ErrorOdt('tiempo')), ms); });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(t));
}
const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * @param {object} [opciones]
 * @param {object} [opciones.sdk]   funciones de Firestore (por defecto, el SDK del CDN 10.14.1)
 * @param {object} [opciones.db]    instancia de Firestore (por defecto, getDbSafe())
 * @param {() => object|null} [opciones.sesion]  por defecto la del guard (sesionGlobal)
 * @param {number} [opciones.tiempoMs]
 */
export function crearRepositorioLectoresInd(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  const tiempo = Number(opciones.tiempoMs) > 0 ? Number(opciones.tiempoMs) : TIEMPO_GUARDAR_LECTORES_MS;

  async function sdk() {
    if (!_sdk) _sdk = await import(CDN_FIRESTORE);
    return _sdk;
  }
  async function db() {
    if (!_db) {
      const fb = await import('../firebase-init.js');
      _db = fb.getDbSafe();
    }
    if (!_db) throw new ErrorOdt('red', 'La plataforma no está disponible en este momento (la base no inició).');
    return _db;
  }
  const getServidor = (F, ref) => (F.getDocFromServer || F.getDoc)(ref);
  function sesion() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    return s;
  }
  async function op(fn) {
    try { return await fn(); } catch (e) { throw errorDesdeFirebase(e); }
  }
  async function leerDoc() {
    const F = await sdk(); const d = await db();
    const snap = await getServidor(F, F.doc(d, CONFIG_INDICADORES.col, CONFIG_INDICADORES.doc));
    if (!snap.exists()) return null;
    const x = snap.data() || {};
    return { lectores: lectoresDe(x), actualizadoPor: x.actualizadoPor || null, actualizadoEnMs: aMs(x.actualizadoEn) };
  }

  const repo = {
    modo: 'nube',

    /** La lista guardada (null si el documento no existe). LANZA si falla. */
    async leer() {
      sesion();
      return op(leerDoc);
    },

    /**
     * ¿La persona de la sesión puede ver los indicadores sin ser administrador? Nunca lanza: {lector, sinComprobar}.
     * `sinComprobar` = no se pudo leer la lista por la CONEXIÓN (sin red o sin respuesta a tiempo); un «no» de la
     * plataforma (permiso), una sesión vencida o cualquier otro fallo cuentan como «no es lector», como antes.
     */
    async comprobarLector() {
      let s = null;
      try { s = leerSesion(); } catch (_) { s = null; }
      if (!sesionPuedeSerLector(s)) return { lector: false, sinComprobar: false };
      try {
        return { lector: esLectorIndicadores(await op(leerDoc), s.uid), sinComprobar: false };
      } catch (e) {
        const c = e && e.codigo;
        return { lector: false, sinComprobar: c === 'red' || c === 'sin_red' || c === 'tiempo' };
      }
    },

    /** ¿La persona de la sesión puede ver los indicadores sin ser administrador? Nunca lanza (false ante cualquier duda). */
    async soyLector() {
      return (await repo.comprobarLector()).lector === true;
    },

    /**
     * Guarda la lista (solo un admin con perfil) y la vuelve a leer del servidor.
     * @param {string[]} uids
     * @returns {Promise<{lectores:string[], actualizadoPor:object|null, actualizadoEnMs:number|null}>}
     */
    async guardar(uids) {
      const s = sesion();
      if (!s.esAdmin) throw new ErrorOdt('sin_permiso', MSG_SOLO_ADMIN_LECTORES);
      if (s.legacy) throw new ErrorOdt('sin_permiso', 'Su cuenta de administrador no tiene perfil en la plataforma: créelo para elegir quién ve los indicadores.');
      const e = errorLectores(uids);
      if (e) throw new ErrorOdt('validacion', e);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const datos = docLectores({ uids, por: { uid: s.uid, nombre: s.nombre }, ts: F.serverTimestamp() });
        try {
          await conTope(F.setDoc(F.doc(d, CONFIG_INDICADORES.col, CONFIG_INDICADORES.doc), datos), tiempo);
        } catch (err) {
          const x = errorDesdeFirebase(err);
          if (x.codigo === 'sin_permiso') {
            throw new ErrorOdt('sin_permiso', 'La plataforma no aceptó la lista. ' + (String(s.nombre || '').trim() ? 'Recargue la página y vuelva a intentarlo.' : 'Su perfil de administrador no tiene nombre.'));
          }
          if (x.codigo !== 'tiempo' && x.codigo !== 'red') throw x;
          // Sin respuesta a tiempo: se comprueba en el servidor si quedó (y si no, se dice).
          let ahora = null;
          try { ahora = await leerDoc(); } catch (_) { ahora = undefined; }
          if (ahora && iguales(ahora.lectores, datos.lectores)) return ahora;
          if (ahora === undefined) throw new ErrorOdt('sin_red');
          throw new ErrorOdt('no_entro', 'La lista NO quedó guardada (la conexión falló). Revise su red y vuelva a intentarlo.');
        }
        const ahora = await leerDoc();
        if (!ahora || !iguales(ahora.lectores, datos.lectores)) {
          throw new ErrorOdt('no_entro', 'La lista no quedó como se pidió. Recargue la página para ver la que está guardada.');
        }
        return ahora;
      });
    }
  };
  return repo;
}
