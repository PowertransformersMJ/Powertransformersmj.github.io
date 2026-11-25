// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · repositorio de CORTES en FIRESTORE
// ──────────────────────────────────────────────────────────────────────────────
// Reglas: bloque «Indicadores · ODT Afinia» de firestore.rules (pruebas: tests-rules/odt_afinia_cortes.rules.test.js).
// Lo que se escribe lo arma data/odt_afinia_cortes_lotes.js (puro); aquí solo va la entrada y salida:
//   · listar     orderBy('creadoEn','desc') + limit(50): el historial, más reciente primero (sin las partes);
//                con `antesDe` (un corte), la página siguiente: where('creadoEn','<', su creadoEn)
//   · anterior   el corte ANTERIOR de un corte, con su PROPIA consulta (no depende del historial de 50):
//                where responsable == + where fechaDatos <= + orderBy fechaDatos desc, creadoEn desc + limit
//                (índice compuesto responsable ↑ · fechaDatos ↓ · creadoEn ↓ en firestore.indexes.json)
//   · ultimoDe   el corte de datos más recientes de un responsable (la misma consulta, sin tope de fecha)
//   · porHuella  los cortes de ESE archivo exacto: where('archivo.sha256','==') + limit(20)
//   · leer       el corte y sus partes (list con limit ≤ 60), DEL SERVIDOR; dice si está completo
//   · guardar    UN lote: el corte + todas sus partes (o entra todo o nada). Solo un administrador con perfil.
//   · estadoSgm  el estado en SGM de unos N.º, de SOLO LECTURA: where('nro','in', ≤ 10) + limit(50) sobre las ODT
//                de la firma (odt_afinia) y las de «Por subsanar» (odt_afinia_obs); las reglas de esas dos ya
//                dejan listar a un administrador con perfil (limit ≤ 50), y el N.º tiene su índice de un campo.
//                Un LECTOR (no admin) solo puede leer ahí lo que le asignaron (lectores array-contains uid; esas
//                reglas no cambian): se leen sus ODT con las MISMAS consultas de la bandeja y de «Por subsanar»
//                (con sus índices) y se cruzan por N.º; lo demás no se puede afirmar y vuelve con `parcial`
//                (la vista dice «Sin consultar»). Lo que trajeron esas dos consultas se REUTILIZA un minuto
//                (SGM_LECTOR_VIGENCIA_MS) en las siguientes listas del lector: no se vuelven a leer (hasta 100
//                documentos) cada vez que abre otro número; si fallan, no se guarda nada y la próxima vuelve a leer.
// LECTORES (pedido del Ingeniero del 2026-11-24, «Todo, solo lectura»): además de un administrador con perfil, leen
// (listar, leer, anterior, ultimoDe, estadoSgm) las personas de la lista odt_afinia_config/indicadores; la página
// lo sabe por data/odt_afinia_ind_lectores.js y lo pasa en `opciones.esLector`. Guardar y porHuella (solo de la carga)
// siguen siendo solo de un administrador. La regla decide de verdad (odtIndLector).
// Un corte NUNCA cambia: no hay actualizar ni borrar (la regla los niega siempre).
// Un lote que no responde a tiempo NO se da por perdido: si el servidor aún no muestra el corte, se lanza
// ErrorOdt('pendiente') («NO repita», MENSAJES.pendiente) con `final`, el desenlace del lote; la pantalla lo
// espera sin volver a ofrecer el botón (como «Por subsanar» con data/odt_afinia_obs.js).
// El SDK y la base se pueden INYECTAR (las pruebas usan dobles en Node). Sin inyección, el SDK se carga del CDN
// 10.14.1 la primera vez que se usa (el mismo de data/odt_afinia.js).
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, MENSAJES, errorDesdeFirebase, sesionGlobal, esIdOdt } from './odt_afinia_lotes.js';
import { COL_CORTES, TOPES_CORTE, corteAnterior, fechaDatosDeCorte, mapaEstadoSgm, limpiar } from '../domain/odt_afinia_indicadores.js';
import { COL } from '../domain/odt_afinia_rutas.js';
import { COL_OBS } from '../domain/odt_afinia_obs.js';
import { planCorte, unirPartes } from './odt_afinia_cortes_lotes.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
/** Espera máxima del lote antes de ir a comprobar al servidor (como en data/odt_afinia_obs.js). */
export const TIEMPO_LOTE_CORTE_MS = 60000;
export const MSG_CORTE_NO_EXISTE = 'Ese corte no existe en la plataforma.';
export const MSG_SOLO_ADMIN = 'Los indicadores son solo para administradores.';
/** Para quien no es admin ni está en la lista de lectores. */
export const MSG_SIN_ACCESO_CORTES = 'Los indicadores son solo para los administradores y las personas que ellos autoricen.';
/** N.º por consulta del estado en SGM (where in) y el tope de cada consulta (la regla de esas colecciones pide ≤ 50). */
export const SGM_POR_CONSULTA = 10;
const SGM_LIMITE = 50;
/** Cuánto se reutiliza lo que el LECTOR tiene asignado (las dos consultas de su «Estado en SGM»). */
const SGM_LECTOR_VIGENCIA_MS = 60000;

/** Timestamp de Firestore (o número) → milisegundos, o null. */
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
/** El desenlace de un lote en curso: 'entro' o un ErrorOdt (con catch vacío: nadie queda con un rechazo suelto). */
function desenlace(lote, causa) {
  const f = lote.then(() => 'entro', async (e) => {
    const err = errorDesdeFirebase(e);
    if (err.codigo !== 'sin_permiso') throw err;
    throw new ErrorOdt('sin_permiso', await causa());
  });
  f.catch(() => {});
  return f;
}
const corteDesdeDoc = (id, d) => ({ ...(d || {}), id, creadoEnMs: aMs(d && d.creadoEn) });

/**
 * @param {object} [opciones]
 * @param {object} [opciones.sdk]   funciones de Firestore (por defecto, el SDK del CDN 10.14.1)
 * @param {object} [opciones.db]    instancia de Firestore (por defecto, getDbSafe())
 * @param {() => object|null} [opciones.sesion]  por defecto la del guard (sesionGlobal)
 * @param {number} [opciones.tiempoLoteMs]
 * @param {boolean|(() => boolean)} [opciones.esLector]  ¿la sesión (no admin) está en la lista de lectores? (solo leer)
 * @param {() => number} [opciones.ahora]  reloj en ms (pruebas); por defecto Date.now
 */
export function crearRepositorioCortes(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  const tiempoLote = Number(opciones.tiempoLoteMs) > 0 ? Number(opciones.tiempoLoteMs) : TIEMPO_LOTE_CORTE_MS;
  const esLector = typeof opciones.esLector === 'function' ? () => opciones.esLector() === true : () => opciones.esLector === true;
  const ahora = typeof opciones.ahora === 'function' ? opciones.ahora : () => Date.now();
  /** El LECTOR: lo que tiene asignado en la firma y en «Por subsanar» ({uid, t, promesa}), reutilizado un minuto. */
  let asignados = null;

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

  /** La sesión de un administrador con perfil (la regla lo exige para leer y para guardar). */
  function exigirAdmin() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    if (!s.esAdmin) throw new ErrorOdt('sin_permiso', MSG_SOLO_ADMIN);
    if (s.legacy) throw new ErrorOdt('sin_permiso', 'Su cuenta de administrador no tiene perfil en la plataforma: créelo para usar los indicadores.');
    return s;
  }
  /** Para LEER: un administrador con perfil o un lector de la lista (la regla lo vuelve a exigir: odtIndLector). */
  function exigirLectura() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    if (s.esAdmin) return exigirAdmin();
    if (!esLector()) throw new ErrorOdt('sin_permiso', MSG_SIN_ACCESO_CORTES);
    return s;
  }
  async function op(fn) {
    try { return await fn(); } catch (e) { throw errorDesdeFirebase(e); }
  }

  const repo = {
    modo: 'nube',

    /**
     * El historial: {cortes:[{id, …, creadoEnMs}], tope} (más reciente primero; sin las partes). Con `antesDe` (un
     * corte de una página anterior), los siguientes 50 guardados antes que él.
     */
    async listar({ antesDe } = {}) {
      exigirLectura();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const filtros = antesDe && antesDe.creadoEn ? [F.where('creadoEn', '<', antesDe.creadoEn)] : [];
        const q = F.query(F.collection(d, COL_CORTES.cortes), ...filtros, F.orderBy('creadoEn', 'desc'), F.limit(TOPES_CORTE.listado));
        const r = await getsServidor(F, q);
        const cortes = r.docs.map((x) => corteDesdeDoc(x.id, x.data()))
          .sort((a, b) => (b.creadoEnMs || 0) - (a.creadoEnMs || 0));
        return { cortes, tope: r.docs.length >= TOPES_CORTE.listado };
      });
    },

    /**
     * El corte ANTERIOR a `corte` (mismo responsable, datos anteriores; a igualdad, guardado antes), con su propia
     * consulta al servidor: {anterior: corte|null, tope}. `tope` = no se encontró y hay más cortes de esa misma fecha
     * de datos de los que se miraron (muy raro: el mismo archivo guardado decenas de veces).
     */
    async anterior(corte) {
      exigirLectura();
      const fd = fechaDatosDeCorte(corte);
      if (!corte || !corte.responsable || !fd) return { anterior: null, tope: false };
      return op(async () => {
        const F = await sdk(); const d = await db();
        for (const lim of [10, TOPES_CORTE.listado]) {
          const q = F.query(F.collection(d, COL_CORTES.cortes), F.where('responsable', '==', corte.responsable), F.where('fechaDatos', '<=', fd),
            F.orderBy('fechaDatos', 'desc'), F.orderBy('creadoEn', 'desc'), F.limit(lim));
          const r = await getsServidor(F, q);
          const a = corteAnterior(r.docs.map((x) => corteDesdeDoc(x.id, x.data())), corte);
          if (a || r.docs.length < lim) return { anterior: a, tope: false };
        }
        return { anterior: null, tope: true };
      });
    },

    /** El corte de datos más recientes del responsable (escrito como lo guarda el corte), o null. */
    async ultimoDe(responsable) {
      exigirLectura();
      const r0 = limpiar(responsable);
      if (!r0) return null;
      return op(async () => {
        const F = await sdk(); const d = await db();
        const q = F.query(F.collection(d, COL_CORTES.cortes), F.where('responsable', '==', r0),
          F.orderBy('fechaDatos', 'desc'), F.orderBy('creadoEn', 'desc'), F.limit(1));
        const r = await getsServidor(F, q);
        return r.docs.length ? corteDesdeDoc(r.docs[0].id, r.docs[0].data()) : null;
      });
    },

    /** Los cortes ya guardados de ESE archivo exacto (por su huella), de cualquier responsable. */
    async porHuella(sha256) {
      exigirAdmin();
      if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) return [];
      return op(async () => {
        const F = await sdk(); const d = await db();
        const r = await getsServidor(F, F.query(F.collection(d, COL_CORTES.cortes), F.where('archivo.sha256', '==', sha256), F.limit(20)));
        return r.docs.map((x) => corteDesdeDoc(x.id, x.data()));
      });
    },

    /**
     * El estado en SGM de unos N.º (SOLO LECTURA): {mapa: Map(nro → {clave, etiqueta}), consultados: [nro]}. Un N.º
     * consultado que no está en el mapa NO está en SGM (ni publicado en la firma ni por subsanar). Para un LECTOR (no
     * admin) vuelve además `parcial: true`: solo se miraron las ODT que le asignaron (sus reglas no le dejan ver otras),
     * así que uno que no está en el mapa NO se puede afirmar.
     */
    async estadoSgm(nros) {
      const s = exigirLectura();
      const lista = [...new Set((nros || []).map((x) => limpiar(x)).filter((x) => x && x.length <= TOPES_CORTE.nroMax))];
      if (!lista.length) return { mapa: new Map(), consultados: [] };
      if (!s.esAdmin) {
        return op(async () => {
          // Las mismas consultas de la bandeja (odt_afinia) y de «Por subsanar» (odt_afinia_obs), con sus índices; lo que
          // traen se reutiliza un minuto (otra lista del lector no las repite). Si fallan, no queda guardado.
          if (!asignados || asignados.uid !== s.uid || !(ahora() - asignados.t < SGM_LECTOR_VIGENCIA_MS)) {
            const promesa = (async () => {
              const F = await sdk(); const d = await db();
              const [ro, rb] = await Promise.all([[COL.odt, 'publicadoEn'], [COL_OBS.obs, 'creadoEn']].map(([col, orden]) => getsServidor(F,
                F.query(F.collection(d, col), F.where('lectores', 'array-contains', s.uid), F.orderBy(orden, 'desc'), F.limit(SGM_LIMITE)))));
              return { odts: ro.docs.map((x) => x.data()), obs: rb.docs.map((x) => x.data()) };
            })();
            const vez = { uid: s.uid, t: ahora(), promesa };
            asignados = vez;
            promesa.catch(() => { if (asignados === vez) asignados = null; });
          }
          const vigente = asignados.promesa;
          const { odts, obs } = await vigente;
          const pedidos = new Set(lista);
          const suyos = (xs) => xs.filter((x) => x && pedidos.has(limpiar(x.nro)));
          return { mapa: mapaEstadoSgm({ odts: suyos(odts), obs: suyos(obs) }), consultados: lista, parcial: true };
        });
      }
      return op(async () => {
        const F = await sdk(); const d = await db();
        const consultar = async (col, trozo) => {
          const r = await getsServidor(F, F.query(F.collection(d, col), F.where('nro', 'in', trozo), F.limit(SGM_LIMITE)));
          if (r.docs.length < SGM_LIMITE) return r.docs.map((x) => x.data());
          // Llegó al tope: uno por uno, para no dejar ninguno afuera.
          const uno = await Promise.all(trozo.map((nro) => getsServidor(F, F.query(F.collection(d, col), F.where('nro', '==', nro), F.limit(SGM_LIMITE)))));
          return uno.flatMap((x) => x.docs.map((y) => y.data()));
        };
        const trozos = [];
        for (let i = 0; i < lista.length; i += SGM_POR_CONSULTA) trozos.push(lista.slice(i, i + SGM_POR_CONSULTA));
        const [odts, obs] = await Promise.all([COL.odt, COL_OBS.obs].map(async (col) => (await Promise.all(trozos.map((t) => consultar(col, t)))).flat()));
        return { mapa: mapaEstadoSgm({ odts, obs }), consultados: lista };
      });
    },

    /** Un corte con sus ODT, del servidor: {corte, odts, completo, faltan}. */
    async leer(id) {
      exigirLectura();
      if (!esIdOdt(id)) throw new ErrorOdt('no_existe', MSG_CORTE_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const snap = await getServidor(F, F.doc(d, COL_CORTES.cortes, id));
        if (!snap.exists()) throw new ErrorOdt('no_existe', MSG_CORTE_NO_EXISTE);
        const corte = corteDesdeDoc(id, snap.data());
        const r = await getsServidor(F, F.query(F.collection(d, COL_CORTES.cortes, id, COL_CORTES.partes), F.limit(TOPES_CORTE.partesMax)));
        const u = unirPartes(corte, r.docs.map((x) => ({ id: x.id, data: x.data() })));
        return { corte, ...u };
      });
    },

    /**
     * Guarda el corte en UN lote (corte + partes). Solo un administrador con perfil.
     * @param {{archivo:{nombre, bytes, sha256}, lectura:object, analisis:object}} p
     * @returns {Promise<{id:string, estado:'entro'}>}
     */
    async guardar({ archivo, lectura, analisis } = {}) {
      const s = exigirAdmin();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const id = F.doc(F.collection(d, COL_CORTES.cortes)).id;
        const plan = planCorte({ id, archivo, lectura, analisis, por: { uid: s.uid, nombre: s.nombre }, ts: F.serverTimestamp() });
        const causa = async () => {
          const t = 'La plataforma no aceptó el corte. ';
          const x = leerSesion();
          if (x && !String(x.nombre || '').trim()) return t + 'Su perfil de administrador no tiene nombre.';
          return t + 'Recargue la página y vuelva a intentarlo; si sigue, avise al Ingeniero.';
        };
        let lote = null;
        try {
          const b = F.writeBatch(d);
          for (const o of plan.operaciones) b.set(F.doc(d, ...o.ruta), o.datos);
          lote = b.commit();
          await conTope(lote, tiempoLote);
        } catch (e) {
          const err = errorDesdeFirebase(e);
          if (err.codigo === 'sin_permiso') throw new ErrorOdt('sin_permiso', await causa());
          if (err.codigo !== 'tiempo' && err.codigo !== 'red') throw err;
          let entro = null;
          try { entro = (await getServidor(F, F.doc(d, COL_CORTES.cortes, id))).exists(); } catch (_) { entro = null; }
          if (entro === true) return { id, estado: 'entro' };
          if (err.codigo === 'tiempo') {
            const p = new ErrorOdt('pendiente', MENSAJES.pendiente);
            p.id = id;
            if (lote) p.final = desenlace(lote, causa);
            throw p;
          }
          if (entro === false) throw new ErrorOdt('no_entro', 'El corte NO quedó guardado (la conexión falló). Revise su red y vuelva a intentarlo.');
          throw new ErrorOdt('sin_red');
        }
        return { id, estado: 'entro' };
      });
    }
  };
  return repo;
}
