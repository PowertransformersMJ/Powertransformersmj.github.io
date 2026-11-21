// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · POR SUBSANAR · repositorio en FIRESTORE
// ──────────────────────────────────────────────────────────────────────────────
// Reglas: bloque «Por subsanar · ODT Afinia» de firestore.rules (pruebas:
// tests-rules/odt_afinia_obs.rules.test.js). Lo que se escribe lo arma
// data/odt_afinia_obs_lotes.js (puro); aquí solo va la entrada y salida:
//   · listar          where('lectores','array-contains', uid) + orderBy('creadoEn','desc') + limit(50)
//                     (índice compuesto en firestore.indexes.json) y, si es admin, además las 50 más recientes
//   · leer            la obs y sus puntos (list con limit ≤ 40), DEL SERVIDOR
//   · previaDelNro    ¿el N.º ya tiene una obs? {obsId, estado, libre} (solo admin; lee el candado)
//   · registrar       lote: obs + candado del N.º + puntos (solo admin; el AZT, de la lista blanca y habilitado)
//   · cambiarPunto    lote atado: punto {estado, rev, rastro.<rev>} + obs {resumen.<k>, ultimo}
//   · agregarPunto    lote atado: punto nuevo + obs {resumen.<k>, ultimo} (solo admin)
//   · resolver        update de la obs {estado:'RESUELTA', rev, resolucion} (solo admin)
// Las lecturas que DECIDEN van al servidor. Un «sin permiso» se explica releyendo el servidor.
// Un lote que no responde a tiempo NO se da por perdido: si el servidor aún no lo muestra,
// se lanza ErrorOdt('pendiente') («NO repita», MENSAJES.pendiente) con `final`: el desenlace del
// lote ('entro', o el error con su «no» explicado). La pantalla lo espera sin volver a ofrecer
// el botón (como «Publicar» y «Firmar» con data/odt_afinia.js).
// El SDK y la base se pueden INYECTAR (las pruebas usan dobles en Node). Sin inyección, el SDK se
// carga del CDN 10.14.1 la primera vez que se usa (el mismo que usa data/odt_afinia.js).
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { COL, CONFIG_FIRMANTES, esNro } from '../domain/odt_afinia_rutas.js';
import { ErrorOdt, MENSAJES, errorDesdeFirebase, sesionGlobal, esIdOdt } from './odt_afinia_lotes.js';
import { COL_OBS, ESTADOS_OBS, TOPES_OBS, esIdPunto } from '../domain/odt_afinia_obs.js';
import { planRegistro, planCambioPunto, planAgregarPunto, cambiosResolver } from './odt_afinia_obs_lotes.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
/** Perfiles de la plataforma (activo, rol): los relee el admin para explicar un «no». */
const COL_USUARIOS = 'usuarios';
/** Espera máxima de un lote antes de ir a comprobar al servidor (como en data/odt_afinia.js). */
export const TIEMPO_LOTE_OBS_MS = 60000;

export const MSG_OBS_NO_EXISTE = 'La ODT por subsanar no existe o usted no está asignado a ella.';
export const MSG_NRO_ABIERTO = 'Ya hay una ODT por subsanar ABIERTA con ese N.º: agregue los puntos en ella (o dela por resuelta antes de registrar otra).';

/** Timestamp de Firestore (o número) → milisegundos, o null. */
const aMs = (t) => {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  return null;
};
/** La promesa, o ErrorOdt('tiempo') si no responde en `ms` (sin cancelarla). */
function conTope(promesa, ms) {
  let t;
  const tope = new Promise((_, rej) => { t = setTimeout(() => rej(new ErrorOdt('tiempo')), ms); });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(t));
}
/**
 * El desenlace de un lote que sigue en curso: resuelve 'entro' o RECHAZA con ErrorOdt (un «no» de la
 * regla, explicado con `causa`). Lleva un catch vacío para que, si nadie lo espera, no quede un rechazo sin manejar.
 */
function desenlace(lote, causa) {
  const f = lote.then(() => 'entro', async (e) => {
    const err = errorDesdeFirebase(e);
    if (err.codigo !== 'sin_permiso') throw err;
    let m = err.message;
    try { m = await causa(); } catch (_) { /* queda el mensaje general */ }
    throw new ErrorOdt('sin_permiso', m);
  });
  f.catch(() => {});
  return f;
}

/** Obs leída → con sus marcas de hora en milisegundos. */
function obsDesdeDoc(id, data) {
  const d = data || {};
  const out = { ...d, id, creadoEnMs: aMs(d.creadoEn) };
  if (d.resolucion) out.resolucion = { ...d.resolucion, enMs: aMs(d.resolucion.en) };
  return out;
}
/** Punto leído → con el rastro en milisegundos. */
function puntoDesdeDoc(id, data) {
  const d = data || {};
  const rastro = {};
  for (const [r, e] of Object.entries(d.rastro || {})) rastro[r] = { ...e, enMs: aMs(e && e.en) };
  return { ...d, id: String(id), rastro, creadoEnMs: aMs(d.creadoEn) };
}

/**
 * @param {object} [opciones]
 * @param {object} [opciones.sdk]   funciones de Firestore (por defecto, el SDK del CDN 10.14.1)
 * @param {object} [opciones.db]    instancia de Firestore (por defecto, getDbSafe())
 * @param {() => object|null} [opciones.sesion]  por defecto la del guard (sesionGlobal)
 * @param {number} [opciones.tiempoLoteMs]
 */
export function crearRepositorioObs(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  const tiempoLote = Number(opciones.tiempoLoteMs) > 0 ? Number(opciones.tiempoLoteMs) : TIEMPO_LOTE_OBS_MS;

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
  /** Lectura que DECIDE: siempre del servidor (un doble sin *FromServer cae a la normal). */
  const getServidor = (F, ref) => (F.getDocFromServer || F.getDoc)(ref);
  const getsServidor = (F, q) => (F.getDocsFromServer || F.getDocs)(q);

  function sesion() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    if (s.legacy) throw new ErrorOdt('sin_permiso', 'Su cuenta de administrador no tiene perfil en la plataforma: créelo para usar «Por subsanar».');
    return s;
  }
  function exigirAdmin() {
    const s = sesion();
    if (!s.esAdmin) throw new ErrorOdt('sin_permiso', 'Solo un administrador puede hacer esto.');
    return s;
  }
  async function op(fn) {
    try { return await fn(); } catch (e) { throw errorDesdeFirebase(e); }
  }
  function aplicarLote(F, d, operaciones) {
    const b = F.writeBatch(d);
    for (const o of operaciones) {
      const ref = F.doc(d, ...o.ruta);
      if (o.tipo === 'update') b.update(ref, o.datos); else b.set(ref, o.datos);
    }
    return b.commit();
  }
  /** El lote, con su «no» explicado y sin darlo por perdido si no respondió a tiempo. */
  async function escribir(F, d, operaciones, { yaEntro, causa }) {
    let lote = null;
    try {
      lote = aplicarLote(F, d, operaciones);
      await conTope(lote, tiempoLote);
    } catch (e) {
      const err = errorDesdeFirebase(e);
      if (err.codigo === 'sin_permiso') throw new ErrorOdt('sin_permiso', await causa());
      if (err.codigo !== 'tiempo' && err.codigo !== 'red') throw err;
      let entro = null;
      try { entro = await yaEntro(); } catch (_) { entro = null; }
      if (entro === true) return;
      // Sin respuesta a tiempo: el SDK sigue intentando; no se afirma que no entró. Va con su desenlace (`final`).
      if (err.codigo === 'tiempo') {
        const p = new ErrorOdt('pendiente', MENSAJES.pendiente);
        if (lote) p.final = desenlace(lote, causa);
        throw p;
      }
      if (entro === false) throw new ErrorOdt('no_entro', 'El cambio NO quedó registrado (la conexión falló). Revise su red y vuelva a intentarlo.');
      throw new ErrorOdt('sin_red');
    }
  }
  /** La obs del servidor (con id), o ErrorOdt('no_existe') si no existe o no es suya. */
  async function leerObsDoc(F, d, obsId, s) {
    let snap;
    try { snap = await getServidor(F, F.doc(d, COL_OBS.obs, obsId)); } catch (e) {
      const err = errorDesdeFirebase(e);
      if (err.codigo === 'sin_permiso' || err.codigo === 'no_existe') throw new ErrorOdt('no_existe', MSG_OBS_NO_EXISTE);
      throw err;
    }
    if (!snap.exists()) throw new ErrorOdt('no_existe', MSG_OBS_NO_EXISTE);
    const o = obsDesdeDoc(obsId, snap.data());
    // La regla ya lo niega; aquí también, por si la lectura vino de otra parte (y para las pruebas con dobles).
    if (!s.esAdmin && !(Array.isArray(o.lectores) && o.lectores.includes(s.uid))) throw new ErrorOdt('no_existe', MSG_OBS_NO_EXISTE);
    return o;
  }
  async function leerPunto(F, d, obsId, k) {
    const snap = await getServidor(F, F.doc(d, COL_OBS.obs, obsId, COL_OBS.puntos, k));
    if (!snap.exists()) throw new ErrorOdt('no_existe', 'Ese punto no existe en la plataforma. Recargue la página.');
    return puntoDesdeDoc(k, snap.data());
  }
  /** El candado del N.º y su obs: null si el N.º nunca tuvo obs; si no, {obsId, estado, libre}. */
  async function leerPrevia(F, d, nro) {
    const cand = await getServidor(F, F.doc(d, COL_OBS.nro, nro));
    if (!cand.exists()) return null;
    const obsId = cand.data().obsId;
    const so = esIdOdt(obsId) ? await getServidor(F, F.doc(d, COL_OBS.obs, obsId)) : null;
    const estado = so && so.exists() ? so.data().estado : null;
    return { obsId, estado, libre: estado === ESTADOS_OBS.RESUELTA };
  }

  const repo = {
    modo: 'nube',

    /** Las obs que la sesión puede ver: {lista, tope}. El AZT, las suyas; el admin, además las 50 más recientes. */
    async listar() {
      const s = sesion();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const col = F.collection(d, COL_OBS.obs);
        const consultas = [F.query(col, F.where('lectores', 'array-contains', s.uid), F.orderBy('creadoEn', 'desc'), F.limit(TOPES_OBS.listado))];
        if (s.esAdmin) consultas.push(F.query(col, F.orderBy('creadoEn', 'desc'), F.limit(TOPES_OBS.listado)));
        const res = await Promise.all(consultas.map((q) => getsServidor(F, q)));
        const porId = new Map();
        for (const r of res) for (const x of r.docs) porId.set(x.id, obsDesdeDoc(x.id, x.data()));
        return { lista: [...porId.values()], tope: res.some((r) => r.docs.length >= TOPES_OBS.listado) };
      });
    },

    /** La obs y sus puntos (en orden), del servidor: {obs, puntos}. */
    async leer(obsId) {
      const s = sesion();
      if (!esIdOdt(obsId)) throw new ErrorOdt('no_existe', MSG_OBS_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const obs = await leerObsDoc(F, d, obsId, s);
        const r = await getsServidor(F, F.query(F.collection(d, COL_OBS.obs, obsId, COL_OBS.puntos), F.limit(TOPES_OBS.puntosMax)));
        const puntos = r.docs.filter((x) => esIdPunto(x.id)).map((x) => puntoDesdeDoc(x.id, x.data()))
          .sort((a, b) => (a.orden ?? Number(a.id)) - (b.orden ?? Number(b.id)));
        return { obs, puntos };
      });
    },

    /** ¿El N.º ya tiene una obs? null si nunca; si no, {obsId, estado, libre} (libre = la que tiene está RESUELTA). */
    async previaDelNro(nro) {
      exigirAdmin();
      const n = String(nro || '').trim();
      if (!esNro(n)) throw new ErrorOdt('validacion', 'El N.º de ODT debe tener 8 dígitos.');
      return op(async () => leerPrevia(await sdk(), await db(), n));
    },

    /**
     * Registra una ODT por subsanar (solo admin).
     * @param {{form:{nro,subestacion,equipo,fechaPrevista}, azt:object, puntos:Array<{texto,quien}>}} p  azt: la habilitación elegida
     * @returns {Promise<{id:string, estado:'entro'}>}
     */
    async registrar({ form = {}, azt, puntos = [] } = {}) {
      const s = exigirAdmin();
      const nro = String(form.nro || '').trim();
      if (!esNro(nro)) throw new ErrorOdt('validacion', 'El N.º de ODT debe tener 8 dígitos.');
      return op(async () => {
        const F = await sdk(); const d = await db();
        // «Un N.º, una obs abierta»: el candado lo exige la regla; aquí se dice ANTES y en llano.
        const previa = await leerPrevia(F, d, nro);
        if (previa && !previa.libre) throw new ErrorOdt('duplicado', MSG_NRO_ABIERTO);
        const id = F.doc(F.collection(d, COL_OBS.obs)).id;
        const plan = planRegistro({ id, form, azt, puntos, por: { uid: s.uid, nombre: s.nombre }, ts: F.serverTimestamp() });
        await escribir(F, d, plan.operaciones, {
          yaEntro: async () => (await getServidor(F, F.doc(d, COL_OBS.obs, id))).exists(),
          causa: async () => repo.causaRechazoRegistro({ nro, azt })
        });
        return { id, estado: 'entro' };
      });
    },

    /** Por qué la regla negó un registro, releyendo el servidor (en llano). */
    async causaRechazoRegistro({ nro, azt } = {}) {
      const base = 'La plataforma no aceptó el registro. ';
      const causas = [];
      try {
        const F = await sdk(); const d = await db();
        const previa = esNro(nro) ? await leerPrevia(F, d, nro) : null;
        if (previa && !previa.libre) return base + MSG_NRO_ABIERTO;
        const uid = azt && azt.uid;
        if (uid) {
          const cfg = await getServidor(F, F.doc(d, CONFIG_FIRMANTES.col, CONFIG_FIRMANTES.doc));
          const lista = cfg.exists() && Array.isArray(cfg.data().azt) ? cfg.data().azt : [];
          if (!lista.includes(uid)) causas.push((azt.nombre || 'El AZT elegido') + ' no está en la lista blanca de AZT.');
          const h = await getServidor(F, F.doc(d, COL.firmantes, uid));
          if (!h.exists()) causas.push((azt.nombre || 'El AZT elegido') + ' no está habilitado.');
          else if (h.data().nombre !== azt.nombre || h.data().correo !== azt.correo) causas.push('La habilitación del AZT no coincide con lo elegido: recargue y elíjalo de nuevo.');
          const u = await getServidor(F, F.doc(d, COL_USUARIOS, uid));
          if (!u.exists() || u.data().activo !== true) causas.push((azt.nombre || 'El AZT elegido') + ' no tiene un perfil activo.');
        }
      } catch (e) {
        causas.push('No se pudo releer el estado en la plataforma (' + ((e && e.message) || 'error') + ').');
      }
      const s = leerSesion();
      if (s && !String(s.nombre || '').trim()) causas.push('Su perfil de administrador no tiene nombre.');
      return base + (causas.length ? causas.join(' ') : 'Recargue y vuelva a intentarlo; si sigue, avise al Ingeniero.');
    },

    /**
     * Subsanar (AZT asignado), verificar o devolver (admin) UN punto.
     * @param {string} obsId @param {string} k  id del punto ('0'..'39')
     * @param {'subsanar'|'verificar'|'devolver'} accion @param {string} nota
     * @returns {Promise<{estado:'entro', puntoEstado:string}>}
     */
    async cambiarPunto(obsId, k, accion, nota) {
      const s = sesion();
      if (!esIdOdt(obsId) || !esIdPunto(String(k))) throw new ErrorOdt('no_existe', MSG_OBS_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        // Se decide con lo que hay EN EL SERVIDOR ahora (no con lo que se pintó).
        const obs = await leerObsDoc(F, d, obsId, s);
        const punto = await leerPunto(F, d, obsId, String(k));
        const plan = planCambioPunto({ obs, punto, accion, nota, sesion: s, ts: F.serverTimestamp() });
        await escribir(F, d, plan.operaciones, {
          yaEntro: async () => (await leerPunto(F, d, obsId, String(k))).rev === plan.rev,
          causa: async () => repo.causaRechazoPunto(obsId, String(k), punto.rev)
        });
        return { estado: 'entro', puntoEstado: plan.estado };
      });
    },

    /** Por qué la regla negó un cambio de punto, releyendo el servidor. */
    async causaRechazoPunto(obsId, k, revLeida) {
      const base = 'La plataforma no aceptó el cambio. ';
      try {
        const F = await sdk(); const d = await db();
        const snap = await getServidor(F, F.doc(d, COL_OBS.obs, obsId));
        if (snap.exists() && snap.data().estado !== ESTADOS_OBS.ABIERTA) return base + 'La ODT ya se dio por resuelta.';
        const p = await leerPunto(F, d, obsId, k);
        if (p.rev !== revLeida) return base + 'El punto cambió mientras usted trabajaba. Recargue para ver su estado.';
      } catch (_) { /* sin lectura: queda el mensaje general */ }
      return base + 'Recargue la página y vuelva a intentarlo; si sigue, avise al administrador.';
    },

    /** «Agregar punto» (solo admin, obs ABIERTA): {estado:'entro', k}. */
    async agregarPunto(obsId, { texto, quien } = {}) {
      const s = exigirAdmin();
      if (!esIdOdt(obsId)) throw new ErrorOdt('no_existe', MSG_OBS_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const obs = await leerObsDoc(F, d, obsId, s);
        const plan = planAgregarPunto({ obs, texto, quien, por: { uid: s.uid, nombre: s.nombre }, ts: F.serverTimestamp() });
        await escribir(F, d, plan.operaciones, {
          yaEntro: async () => (await getServidor(F, F.doc(d, COL_OBS.obs, obsId, COL_OBS.puntos, plan.k))).exists(),
          causa: async () => 'La plataforma no aceptó el punto nuevo: la ODT cambió mientras tanto (otro punto agregado o ya resuelta). Recargue y vuelva a intentarlo.'
        });
        return { estado: 'entro', k: plan.k };
      });
    },

    /** Dar la obs por resuelta (solo admin, con nota; final). */
    async resolver(obsId, nota) {
      const s = exigirAdmin();
      if (!esIdOdt(obsId)) throw new ErrorOdt('no_existe', MSG_OBS_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const obs = await leerObsDoc(F, d, obsId, s);
        const cambios = cambiosResolver(obs, { nota, por: { uid: s.uid, nombre: s.nombre }, ts: F.serverTimestamp() });
        await escribir(F, d, [{ tipo: 'update', ruta: [COL_OBS.obs, obsId], datos: cambios }], {
          yaEntro: async () => (await getServidor(F, F.doc(d, COL_OBS.obs, obsId))).data().estado === ESTADOS_OBS.RESUELTA,
          causa: async () => 'La plataforma no aceptó el cambio: la ODT cambió mientras tanto. Recargue y vuelva a intentarlo.'
        });
        return { estado: 'entro', rev: cambios.rev };
      });
    }
  };
  return repo;
}
