// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · CUMPLIMIENTO DEL CIERRE: repositorio en FIRESTORE · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Lo que la PÁGINA lee y escribe de los avisos de cumplimiento (reglas: bloque «Cumplimiento del cierre · ODT Afinia»
// de firestore.rules; pruebas: tests-rules/odt_afinia_cumplimiento.rules.test.js):
//   · leerConfig     odt_afinia_config/cumplimiento, DEL SERVIDOR (solo un admin con perfil): la configuración o null;
//   · guardarConfig  la configuración entera (solo un admin con perfil), armada y revisada por el dominio
//                    (docConfigCumplimiento); se vuelve a leer del servidor para confirmar lo que quedó. Si no trae
//                    audienciaScript (el formulario no la tiene), conserva la guardada (99 §236: el script aprobado);
//   · listarCorreos  el historial de correos (odt_afinia_correos), el más reciente primero, limit ≤ 50: lo leen los
//                    administradores y los LECTORES de Indicadores (la regla decide con odtIndLector);
//   · reprocesar     pide a la Cloud Function reprocesarAvisosCumplimiento({corteId}) (solo un admin con perfil): revisa
//                    un corte guardado y deja en cola los avisos que falten, sin repetir lo ya enviado (99 §236: los
//                    envía el script de Google de la cuenta remitente; el estado de ese script lo lee
//                    data/odt_afinia_cumplimiento_script.js).
// Los correos y los avisos los ESCRIBE SOLO EL SERVIDOR: aquí no hay escritura de ellos.
// El SDK, la base y la llamada a la función se pueden INYECTAR (las pruebas usan dobles en Node). Sin inyección, el
// SDK se carga del CDN 10.14.1 la primera vez que se usa (el mismo de data/odt_afinia.js y de firebase-init.js).
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, errorDesdeFirebase, sesionGlobal } from './odt_afinia_lotes.js';
import { COL_CUMPLIMIENTO, TOPE_CORREOS_LISTA, docConfigCumplimiento, normalizarConfig, errorConfigCumplimiento } from '../domain/odt_afinia_cumplimiento.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const CDN_FUNCIONES = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
/** El nombre de la Cloud Function del reproceso (functions/index.js). */
export const FUNCION_REPROCESAR = 'reprocesarAvisosCumplimiento';
/** Espera máxima de la escritura de la configuración antes de ir a comprobar al servidor. */
export const TIEMPO_GUARDAR_CONFIG_MS = 30000;
/** Espera máxima del reproceso (la función tiene 300 s). */
export const TIEMPO_REPROCESO_MS = 320000;
export const MSG_SOLO_ADMIN_AVISOS = 'Solo un administrador configura y envía los avisos de cumplimiento.';

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
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Un error de la llamada a la función («functions/permission-denied»…) como los demás errores del módulo. */
function errorDeFuncion(e) {
  if (e instanceof ErrorOdt) return e;
  const c = String((e && e.code) || '').replace(/^functions\//, '');
  if (c === 'permission-denied' || c === 'unauthenticated') return new ErrorOdt('sin_permiso', (e && e.message) || MSG_SOLO_ADMIN_AVISOS);
  if (c === 'invalid-argument') return new ErrorOdt('validacion', (e && e.message) || 'El corte no es válido.');
  if (c === 'deadline-exceeded') return new ErrorOdt('tiempo', 'La plataforma no respondió a tiempo. Mire el historial de correos en unos minutos antes de volver a intentarlo.');
  if (c === 'unavailable') return new ErrorOdt('red');
  if (c === 'internal' && e && e.message) return new ErrorOdt('desconocido', e.message);
  return errorDesdeFirebase(e);
}

/**
 * @param {object} [opciones]
 * @param {object} [opciones.sdk]  funciones de Firestore (por defecto, el SDK del CDN 10.14.1)
 * @param {object} [opciones.db]   instancia de Firestore (por defecto, getDbSafe())
 * @param {() => object|null} [opciones.sesion]  por defecto la del guard (sesionGlobal)
 * @param {(nombre:string, datos:object) => Promise<any>} [opciones.llamar]  la llamada a la función (pruebas)
 * @param {number} [opciones.tiempoMs]
 */
export function crearRepositorioCumplimiento(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  const tiempo = Number(opciones.tiempoMs) > 0 ? Number(opciones.tiempoMs) : TIEMPO_GUARDAR_CONFIG_MS;

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
  const getsServidor = (F, q) => (F.getDocsFromServer || F.getDocs)(q);
  function sesion() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    return s;
  }
  function exigirAdmin() {
    const s = sesion();
    if (!s.esAdmin) throw new ErrorOdt('sin_permiso', MSG_SOLO_ADMIN_AVISOS);
    if (s.legacy) throw new ErrorOdt('sin_permiso', 'Su cuenta de administrador no tiene perfil en la plataforma: créelo para configurar los avisos.');
    return s;
  }
  async function op(fn) {
    try { return await fn(); } catch (e) { throw errorDesdeFirebase(e); }
  }
  async function leerDoc() {
    const F = await sdk(); const d = await db();
    const snap = await getServidor(F, F.doc(d, COL_CUMPLIMIENTO.config.col, COL_CUMPLIMIENTO.config.doc));
    return snap.exists() ? normalizarConfig(snap.data()) : null;
  }
  async function llamar(nombre, datos) {
    if (typeof opciones.llamar === 'function') return opciones.llamar(nombre, datos);
    const fb = await import('../firebase-init.js');
    const funciones = typeof fb.getFunctionsSafe === 'function' ? await fb.getFunctionsSafe() : null;
    if (!funciones) throw new ErrorOdt('red', 'La plataforma no está disponible en este momento (las funciones no iniciaron).');
    const { httpsCallable } = await import(CDN_FUNCIONES);
    const r = await httpsCallable(funciones, nombre, { timeout: TIEMPO_REPROCESO_MS })(datos);
    return r && r.data;
  }

  return {
    modo: 'nube',

    /** La configuración guardada (normalizada) o null si todavía no existe. Solo un admin con perfil. */
    async leerConfig() {
      exigirAdmin();
      return op(leerDoc);
    },

    /**
     * Guarda la configuración entera (solo un admin con perfil) y la vuelve a leer del servidor.
     * @param {object} datos  {activo, remitente, para:[{correo, nombre}], cc:[correo], responsable, audienciaScript?}
     *   Sin audienciaScript (el formulario no la trae), se conserva la que está guardada (99 §236).
     */
    async guardarConfig(datos) {
      exigirAdmin();
      const e = errorConfigCumplimiento(normalizarConfig(datos));
      if (e) throw new ErrorOdt('validacion', e);
      const conAudiencia = datos && typeof datos.audienciaScript === 'string';
      const previa = conAudiencia ? null : await op(leerDoc);
      const doc = docConfigCumplimiento({ ...datos, audienciaScript: conAudiencia ? datos.audienciaScript : ((previa && previa.audienciaScript) || '') });
      return op(async () => {
        const F = await sdk(); const d = await db();
        try {
          await conTope(F.setDoc(F.doc(d, COL_CUMPLIMIENTO.config.col, COL_CUMPLIMIENTO.config.doc), doc), tiempo);
        } catch (err) {
          const x = errorDesdeFirebase(err);
          if (x.codigo === 'sin_permiso') throw new ErrorOdt('sin_permiso', 'La plataforma no aceptó la configuración. Recargue la página y vuelva a intentarlo.');
          if (x.codigo !== 'tiempo' && x.codigo !== 'red') throw x;
          let ahora;
          try { ahora = await leerDoc(); } catch (_) { ahora = undefined; }
          if (ahora && mismo(ahora, doc)) return ahora;
          if (ahora === undefined) throw new ErrorOdt('sin_red');
          throw new ErrorOdt('no_entro', 'La configuración NO quedó guardada (la conexión falló). Revise su red y vuelva a intentarlo.');
        }
        const ahora = await leerDoc();
        if (!ahora || !mismo(ahora, doc)) throw new ErrorOdt('no_entro', 'La configuración no quedó como se pidió. Recargue la página para ver la que está guardada.');
        return ahora;
      });
    },

    /** Los correos de aviso, el más reciente primero (como mucho TOPE_CORREOS_LISTA): [{id, …, creadoEnMs, enviadoEnMs}]. */
    async listarCorreos() {
      sesion();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const q = F.query(F.collection(d, COL_CUMPLIMIENTO.correos), F.orderBy('creadoEn', 'desc'), F.limit(TOPE_CORREOS_LISTA));
        const r = await getsServidor(F, q);
        return r.docs.map((x) => { const v = x.data() || {}; return { ...v, id: x.id, creadoEnMs: aMs(v.creadoEn), enviadoEnMs: aMs(v.enviadoEn) }; })
          .sort((a, b) => (b.creadoEnMs || 0) - (a.creadoEnMs || 0));
      });
    },

    /** Revisa un corte y manda los avisos que falten (la Cloud Function). Solo un admin con perfil. */
    async reprocesar(corteId) {
      exigirAdmin();
      if (typeof corteId !== 'string' || !/^[A-Za-z0-9]{20}$/.test(corteId)) throw new ErrorOdt('validacion', 'El corte no es válido.');
      try { return await llamar(FUNCION_REPROCESAR, { corteId }); } catch (e) { throw errorDeFuncion(e); }
    }
  };
}
