// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · repositorio en FIRESTORE
// ──────────────────────────────────────────────────────────────────────────────
// Colecciones y reglas: bloque «Firma de ODT Afinia» de firestore.rules
// (pruebas: tests-rules/odt_afinia.rules.test.js). Lo que se escribe lo arma
// data/odt_afinia_lotes.js (puro); aquí solo va la entrada y salida:
//   · publicar          lote: ODT + partes 0..n-1 + candado del N.º (solo admin; los dos
//                       firmantes deben estar en la LISTA BLANCA de su rol). Si el N.º ya tuvo
//                       una ODT ANULADA o REEMPLAZADA, la nueva guarda `reemplaza` = su id
//   · previaDelNro      ¿el N.º ya está publicado? {odtId, estado, libre, mensaje} (lo usa Publicar)
//   · candidatos        habilitados × lista blanca × perfil activo (lo que ofrece Publicar)
//   · leerOdt           lee la ODT y sus partes DEL SERVIDOR, las une y verifica
//                       cada huella y la del total (si no cuadra, lanza)
//   · firmar            lote de 2: actos/{rol} + {estado, rev} de la ODT (antes de escribir, la copia
//                       y el acto deben ser del compositor vigente @2, con el N.º de «ODT GENERADA» en el
//                       cierre del Responsable: una pieza vieja de la caché no firma, L-102)
//   · anular            update {estado:'ANULADA', rev, anulacion} (solo admin; D6: nunca una LISTA)
//   · reemplazar        update {estado:'REEMPLAZADA', rev, reemplazo} (solo admin, solo una LISTA, con motivo)
//   · registrarCierreAfinia  update {estado:'CERRADA', rev, cierreAfinia} (solo admin, solo una LISTA)
//                       (los dos son de 2026-11-21: sus reglas de armado viven en domain/odt_afinia_cierre.js)
//   · habilitarme       odt_afinia_firmantes/{uidPropio} (una vez)
//   · devolver          odt_afinia/{id}/devoluciones/{rol_rev} (id determinista: una por turno)
//   · registrarDescarga odt_afinia_descargas/{auto}
//   · listarBandeja     where('lectores','array-contains', uid) + orderBy + limit(50)
// Para decidir el turno NUNCA se confía en la caché: las lecturas que deciden
// van al servidor (comité W-11, arq «red caída a mitad del lote»).
// Un lote que no responde en TIEMPO_LOTE_MS NO se da por perdido: el SDK lo deja en
// cola y lo reintenta. Si el servidor todavía no lo muestra, el resultado es
// {estado:'pendiente', final} (la pantalla dice «NO repita» y espera `final`); solo
// un lote RECHAZADO da 'no_entro'.
// Un «sin permiso» se explica releyendo el servidor (causaRechazoPublicar,
// causaRechazoFirma), no con un mensaje genérico.
//
// El SDK y la base se pueden INYECTAR (así las pruebas arman los lotes con
// dobles en Node, sin Firebase). Sin inyección, el SDK se carga del CDN 10.14.1
// la primera vez que se usa.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { COL, CONFIG_FIRMANTES, ROLES, TOPES, esNro, esRol, idDevolucion } from '../domain/odt_afinia_rutas.js';
import { errorFirmantes, errorListaBlanca, firmantesElegibles } from '../domain/odt_afinia_estados.js';
import { fechaBogota, ordenDMA } from '../domain/odt_afinia_textos.js';
import { unirVerificado } from '../domain/odt_afinia_partes.js';
import {
  ErrorOdt, MENSAJES, errorDesdeFirebase, sesionGlobal, esIdOdt,
  documentoHabilitacion, planPublicacion, planFirma, cambiosAnulacion,
  documentoDevolucion, documentoDescarga
} from './odt_afinia_lotes.js';
import { miFirmaOdt, HUELLA_MI_FIRMA_DISTINTA } from './odt_afinia_mi_firma.js';
import {
  liberaNro, mensajeNroOcupado, cambioReemplazar, cambioCerrarAfinia, errorFirmaAlDia, MSG_RECARGAR, MSG_RECARGAR_FIRMA
} from '../domain/odt_afinia_cierre.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
/** Perfiles de la plataforma (activo, rol): los lee el admin al elegir firmantes. */
const COL_USUARIOS = 'usuarios';

/** Espera máxima de un lote antes de ir a comprobar al servidor. */
export const TIEMPO_LOTE_MS = 60000;

// ── Mensajes de rechazo que la pantalla muestra tal cual ───────────────────────
export const MSG_NO_EXISTE = 'La ODT no existe o usted no es uno de sus firmantes.';
/**
 * Del paliativo D5, que la regla YA NO aplica (decisión del Ingeniero del 2026-11-21: la contraseña solo al iniciar
 * sesión). Nadie los muestra ya; se conservan porque una preparar.js vieja de la caché los importa por nombre (L-102).
 */
export const MSG_SESION_ANTES_DE_PUBLICAR = 'Su inicio de sesión es anterior a la publicación de esta ODT: vuelva a iniciar sesión y firme.';
export const MSG_SESION_ANTES_DEL_AZT = 'Su inicio de sesión es anterior a la firma del AZT: vuelva a iniciar sesión y firme.';
/** La regla compara nombre y correo del acto con los PUBLICADOS en la ODT. */
export const MSG_IDENTIDAD_CAMBIO = 'Su nombre o correo cambió después de publicar: el admin debe anular y volver a publicar.';
export const MSG_FIRMA_CAMBIO = 'Cambió su firma («Mi firma») después de preparar: vuelva a preparar.';
export const MSG_FALTA_LISTA_BLANCA = 'Falta la lista blanca de firmantes: la crea el Ingeniero en la consola de Firebase.';

/** Bytes de Firestore (o Uint8Array) → Uint8Array. */
export function aUint8(b) {
  if (b instanceof Uint8Array) return b;
  if (b && typeof b.toUint8Array === 'function') return b.toUint8Array();
  if (b instanceof ArrayBuffer) return new Uint8Array(b);
  return null;
}
/** Timestamp de Firestore (o número) → milisegundos, o null. */
export function aMs(t) {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  return null;
}

/** La promesa, o ErrorOdt('tiempo') si no responde en `ms`. NO cancela la promesa (sigue en curso). */
export function conTope(promesa, ms) {
  let t;
  const tope = new Promise((_, rej) => { t = setTimeout(() => rej(new ErrorOdt('tiempo')), ms); });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(t));
}

/**
 * El desenlace de un lote que sigue en curso: resuelve 'entro' o RECHAZA con ErrorOdt.
 * Lleva un catch vacío para que, si nadie lo espera, no quede un rechazo sin manejar.
 */
function desenlace(p) {
  const f = p.then(() => 'entro', (e) => Promise.reject(errorDesdeFirebase(e)));
  f.catch(() => {});
  return f;
}

/** Lista blanca normalizada {azt:[uid], responsable:[uid]}. */
function normalizarConfig(c) {
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
  return { azt: lista(c && c.azt), responsable: lista(c && c.responsable) };
}

/** Acto leído → {rol, uid, nombre, correo, …, imagen: Uint8Array, enMs}. */
function actoDesdeDoc(id, data) {
  const d = data || {};
  return { ...d, rol: d.rol || id, imagen: aUint8(d.imagen), enMs: aMs(d.en) };
}

/**
 * @param {object} [opciones]
 * @param {object} [opciones.sdk]     funciones de Firestore (por defecto, el SDK del CDN 10.14.1)
 * @param {object} [opciones.db]      instancia de Firestore (por defecto, getDbSafe())
 * @param {() => object|null} [opciones.sesion]  por defecto la del guard (sesionGlobal)
 * @param {number} [opciones.tiempoLoteMs]
 * @param {() => Promise<object>} [opciones.miFirma]  lector de «Mi firma» (por defecto miFirmaOdt con el mismo SDK)
 */
export function crearRepositorioOdt(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  const tiempoLote = Number(opciones.tiempoLoteMs) > 0 ? Number(opciones.tiempoLoteMs) : TIEMPO_LOTE_MS;

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
  const leerMiFirma = typeof opciones.miFirma === 'function'
    ? opciones.miFirma
    : async () => miFirmaOdt({ sdk: await sdk(), db: await db(), sesion: leerSesion });
  /** Lectura que DECIDE: siempre del servidor (el simulador del banco no tiene *FromServer: cae a la normal). */
  const getServidor = (F, ref) => (F.getDocFromServer || F.getDoc)(ref);
  const getsServidor = (F, q) => (F.getDocsFromServer || F.getDocs)(q);
  const aBytesDe = (F) => (u) => F.Bytes.fromUint8Array(u);

  function sesion() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    return s;
  }
  function exigirAdmin() {
    const s = sesion();
    if (!s.esAdmin) throw new ErrorOdt('sin_permiso', 'Solo un administrador puede hacer esto.');
    if (s.legacy) throw new ErrorOdt('sin_permiso', 'Su cuenta de administrador no tiene perfil en la plataforma: créelo antes de publicar o anular.');
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
  async function leerConfig(F, d) {
    const s = await getServidor(F, F.doc(d, CONFIG_FIRMANTES.col, CONFIG_FIRMANTES.doc));
    return s.exists() ? normalizarConfig(s.data()) : null;
  }
  /**
   * El candado del N.º y su ODT vigente, del servidor: null si el N.º nunca se publicó; si no,
   * {odtId, estado, publicadoEnMs, libre (ANULADA o REEMPLAZADA), mensaje (por qué no, si no está libre)}.
   */
  async function leerPreviaDelNro(F, d, nro) {
    const cand = await getServidor(F, F.doc(d, COL.nro, nro));
    if (!cand.exists()) return null;
    const odtId = cand.data().odtId;
    const sp = esIdOdt(odtId) ? await getServidor(F, F.doc(d, COL.odt, odtId)) : null;
    const o = sp && sp.exists() ? sp.data() : null;
    const estado = o ? o.estado : null;
    const libre = !!o && liberaNro(estado);
    return { odtId, estado, publicadoEnMs: o ? aMs(o.publicadoEn) : null, libre, mensaje: libre ? null : mensajeNroOcupado(estado) };
  }
  /** Un update de la ODT (anular, reemplazar, cerrar) con su «no» explicado si la regla lo niega. */
  async function actualizarOdt(F, d, odtId, cambios, msgConflicto) {
    try {
      await conTope(aplicarLote(F, d, [{ tipo: 'update', ruta: [COL.odt, odtId], datos: cambios }]), tiempoLote);
    } catch (e) {
      const err = errorDesdeFirebase(e);
      if (err.codigo === 'sin_permiso') throw new ErrorOdt('conflicto', msgConflicto);
      throw err;
    }
  }

  const repo = {
    modo: 'nube',

    // ── Habilitación ──────────────────────────────────────────────────────────
    /** La habilitación de `uid` (por defecto la propia), o null si no existe. LANZA si falla. */
    async leerHabilitacion(uid) {
      const s = sesion();
      const u = uid || s.uid;
      return op(async () => {
        const F = await sdk(); const d = await db();
        const snap = await getServidor(F, F.doc(d, COL.firmantes, u));
        if (!snap.exists()) return null;
        const h = snap.data();
        return { ...h, uid: h.uid || u, enMs: aMs(h.en) };
      });
    },

    /** Habilitados (solo admin; list con limit ≤ 50). */
    async listarHabilitados() {
      exigirAdmin();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const r = await getsServidor(F, F.query(F.collection(d, COL.firmantes), F.limit(TOPES.listado)));
        return r.docs.map((x) => { const h = x.data(); return { ...h, uid: h.uid || x.id, enMs: aMs(h.en) }; })
          .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
      });
    },

    /** Lista blanca por rol (solo admin): {azt:[uid], responsable:[uid]}, o null si el documento no existe. */
    async leerConfigFirmantes() {
      exigirAdmin();
      return op(async () => leerConfig(await sdk(), await db()));
    },

    /**
     * Lo que Publicar ofrece en cada casilla (solo admin): habilitados × lista blanca de ESE
     * rol × perfil activo que no es visitante; el AZT nunca es quien publica.
     * @returns {Promise<{config:object|null, habilitados:Array, azt:Array, responsable:Array, fuera:Array}>}
     */
    async candidatos() {
      const s = exigirAdmin();
      const habilitados = await repo.listarHabilitados();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const config = await leerConfig(F, d);
        const perfiles = {};
        for (const h of habilitados) {
          const u = await getServidor(F, F.doc(d, COL_USUARIOS, h.uid));
          perfiles[h.uid] = u.exists() ? u.data() : null;
        }
        return { config, habilitados, ...firmantesElegibles(habilitados, config, perfiles, s.uid) };
      });
    },

    /**
     * Crea la habilitación propia. `token` es el del inicio de sesión RECIÉN renovado
     * (odt_afinia_cuenta.reautenticar): la regla exige ≤ 5 min.
     */
    async habilitarme(token) {
      const s = sesion();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const datos = documentoHabilitacion({ uid: s.uid, nombre: s.nombre, token, ts: F.serverTimestamp() });
        await conTope(F.setDoc(F.doc(d, COL.firmantes, s.uid), datos), tiempoLote);
        return datos;
      });
    },

    // ── Bandeja ───────────────────────────────────────────────────────────────
    /**
     * Las ODT que la sesión puede ver: las suyas (array-contains, índice compuesto) y,
     * si es admin, además las 50 más recientes. Devuelve {odts, tope}.
     */
    async listarBandeja() {
      const s = sesion();
      if (s.legacy) throw new ErrorOdt('sin_permiso', 'Su cuenta de administrador no tiene perfil en la plataforma: créelo para ver la bandeja de ODT.');
      return op(async () => {
        const F = await sdk(); const d = await db();
        const col = F.collection(d, COL.odt);
        const consultas = [F.query(col, F.where('lectores', 'array-contains', s.uid), F.orderBy('publicadoEn', 'desc'), F.limit(TOPES.listado))];
        if (s.esAdmin) consultas.push(F.query(col, F.orderBy('publicadoEn', 'desc'), F.limit(TOPES.listado)));
        const res = await Promise.all(consultas.map((q) => getsServidor(F, q)));
        const porId = new Map();
        for (const r of res) for (const x of r.docs) porId.set(x.id, { id: x.id, ...x.data(), publicadoEnMs: aMs(x.data().publicadoEn) });
        const odts = [...porId.values()].sort((a, b) => (b.publicadoEnMs || 0) - (a.publicadoEnMs || 0));
        return { odts, tope: res.some((r) => r.docs.length >= TOPES.listado) };
      });
    },

    // ── Lectura de una ODT ────────────────────────────────────────────────────
    /**
     * Solo el documento de la ODT, del servidor. Una ODT inexistente o ajena da
     * permission-denied en la regla (no hay lectores que mirar): las dos se dicen igual.
     */
    async leerOdtDoc(odtId) {
      if (!esIdOdt(odtId)) throw new ErrorOdt('no_existe', MSG_NO_EXISTE);
      try {
        return await op(async () => {
          const F = await sdk(); const d = await db();
          const snap = await getServidor(F, F.doc(d, COL.odt, odtId));
          if (!snap.exists()) throw new ErrorOdt('no_existe', MSG_NO_EXISTE);
          const o = snap.data();
          return { id: odtId, ...o, publicadoEnMs: aMs(o.publicadoEn) };
        });
      } catch (e) {
        if (e && (e.codigo === 'sin_permiso' || e.codigo === 'no_existe')) throw new ErrorOdt('no_existe', MSG_NO_EXISTE);
        throw e;
      }
    },

    /**
     * La ODT y su PDF original (v0): une las partes del servidor y exige que cada
     * huella y la del total coincidan. Devuelve {odt, bytesV0} (bytes congelados:
     * a pdf.js se le pasa SIEMPRE una copia, comité W-11 arq «un solo búfer»).
     */
    async leerOdt(odtId) {
      const odt = await repo.leerOdtDoc(odtId);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const n = Number(odt.partes);
        if (!Number.isInteger(n) || n < 1 || n > TOPES.partesMax) throw new ErrorOdt('huella', 'La ODT no declara sus partes.');
        const snaps = await Promise.all(Array.from({ length: n }, (_, i) => getServidor(F, F.doc(d, COL.odt, odtId, COL.partes, String(i)))));
        const partes = snaps.map((s, i) => {
          if (!s.exists()) throw new ErrorOdt('huella', 'Falta la parte ' + i + ' de la ODT.');
          const b = aUint8(s.data().datos);
          if (!b) throw new ErrorOdt('huella', 'La parte ' + i + ' de la ODT no trae bytes.');
          return b;
        });
        let bytesV0;
        try {
          bytesV0 = await unirVerificado(partes, { huellasPartes: odt.huellasPartes, huella: odt.huella, bytes: odt.bytes });
        } catch (e) {
          throw new ErrorOdt('huella', (e && e.message) || undefined);
        }
        return { odt, bytesV0 };
      });
    },

    /** Los actos de la ODT (list con limit ≤ 2): {azt?, responsable?}. */
    async leerActos(odtId) {
      if (!esIdOdt(odtId)) throw new ErrorOdt('no_existe', MSG_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const r = await getsServidor(F, F.query(F.collection(d, COL.odt, odtId, COL.actos), F.limit(TOPES.actos)));
        const out = {};
        for (const x of r.docs) if (esRol(x.id)) out[x.id] = actoDesdeDoc(x.id, x.data());
        return out;
      });
    },

    /** Un acto (get), o null. */
    async leerActo(odtId, rol) {
      if (!esIdOdt(odtId) || !esRol(rol)) throw new ErrorOdt('no_existe', MSG_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const s = await getServidor(F, F.doc(d, COL.odt, odtId, COL.actos, rol));
        return s.exists() ? actoDesdeDoc(rol, s.data()) : null;
      });
    },

    /** Devoluciones («no firmo») de la ODT (list con limit ≤ 20), las más recientes primero. */
    async leerDevoluciones(odtId) {
      if (!esIdOdt(odtId)) throw new ErrorOdt('no_existe', MSG_NO_EXISTE);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const r = await getsServidor(F, F.query(F.collection(d, COL.odt, odtId, COL.devoluciones), F.limit(20)));
        return r.docs.map((x) => ({ id: x.id, ...x.data(), enMs: aMs(x.data().en) })).sort((a, b) => (b.enMs || 0) - (a.enMs || 0));
      });
    },

    // ── Publicar (solo admin; NO pide contraseña: D4 cubre publicar, nunca firmar) ──
    /**
     * @param {{form:object, preparado:{partes,huellasPartes,huella,bytes}, zonas:object, firmantes:{azt,responsable}}} p
     * @returns {Promise<{id:string, estado:'entro'} | {id:string, estado:'pendiente', mensaje:string, final:Promise<'entro'>}>}
     */
    async publicar({ form, preparado, zonas, firmantes } = {}) {
      const s = exigirAdmin();
      const nro = String((form && form.nro) || '').trim();
      if (!esNro(nro)) throw new ErrorOdt('validacion', 'El N.º de ODT debe tener 8 dígitos.');
      return op(async () => {
        // La pareja (dos personas; el AZT nunca es quien publica) se dice antes de leer nada.
        const errF = errorFirmantes(firmantes, s.uid);
        if (errF) throw new ErrorOdt('validacion', errF);
        const F = await sdk(); const d = await db();
        // Lista blanca por rol: la regla la exige; aquí se dice ANTES y con nombre.
        const errLB = errorListaBlanca(await leerConfig(F, d), firmantes);
        if (errLB) throw new ErrorOdt('sin_permiso', errLB);
        // Candado del N.º: si ya hay una ODT vigente con ese número, se avisa ANTES (la regla lo niega igual).
        // Con la vigente ANULADA o REEMPLAZADA el N.º está libre y la nueva guarda `reemplaza` = su id
        // (la regla del candado exige que coincida con el candado anterior).
        const previa = await leerPreviaDelNro(F, d, nro);
        if (previa && !previa.libre) throw new ErrorOdt('duplicado', previa.mensaje);
        const reemplaza = previa ? previa.odtId : null;
        const id = F.doc(F.collection(d, COL.odt)).id;
        const plan = planPublicacion({
          id, form, preparado, zonas, firmantes, reemplaza,
          quien: { uid: s.uid, nombre: s.nombre }, ts: F.serverTimestamp(), aBytes: aBytesDe(F)
        });
        // Un armador viejo de la caché no sabría de `reemplaza` y la regla negaría el lote: se dice antes.
        if ((plan.odt.reemplaza || null) !== reemplaza) throw new ErrorOdt('estado', MSG_RECARGAR);
        const lote = aplicarLote(F, d, plan.operaciones);
        try {
          await conTope(lote, tiempoLote);
        } catch (e) {
          const err = errorDesdeFirebase(e);
          if (err.codigo === 'sin_permiso') { const c = await repo.causaRechazoPublicar({ nro, firmantes }); throw new ErrorOdt(c.codigo, c.mensaje); }
          if (err.codigo !== 'tiempo') throw err;
          // Sin respuesta a tiempo: el SDK sigue intentando. ¿Ya consta en el servidor?
          let existe = false;
          try { existe = (await getServidor(F, F.doc(d, COL.odt, id))).exists(); } catch (_) { existe = false; }
          if (existe) return { id, estado: 'entro' };
          return { id, estado: 'pendiente', mensaje: MENSAJES.pendiente, final: desenlace(lote) };
        }
        return { id, estado: 'entro' };
      });
    },

    /**
     * Por qué la regla negó una publicación, releyendo el servidor (el admin puede leer todo
     * lo que la regla mira): candado tomado, lista blanca, perfil inactivo o visitante,
     * habilitación distinta de lo enviado, perfil del admin sin nombre.
     * @returns {Promise<{codigo:string, mensaje:string}>}
     */
    async causaRechazoPublicar({ nro, firmantes = {} } = {}) {
      const base = 'La plataforma no aceptó la publicación. ';
      const causas = [];
      try {
        const F = await sdk(); const d = await db();
        if (esNro(nro)) {
          const previa = await leerPreviaDelNro(F, d, nro);
          if (previa && !previa.libre) return { codigo: 'duplicado', mensaje: previa.mensaje || MENSAJES.duplicado };
        }
        const errLB = errorListaBlanca(await leerConfig(F, d), firmantes);
        if (errLB) causas.push(errLB);
        for (const rol of ROLES) {
          const f = firmantes[rol];
          if (!f || !f.uid) continue;
          const quien = f.nombre || rol;
          const u = await getServidor(F, F.doc(d, COL_USUARIOS, f.uid));
          if (!u.exists()) causas.push(quien + ' no tiene perfil en la plataforma.');
          else if (u.data().activo !== true) causas.push(quien + ' está inactivo.');
          else if (/visitante/i.test(String(u.data().rol || ''))) causas.push(quien + ' es visitante.');
          const h = await getServidor(F, F.doc(d, COL.firmantes, f.uid));
          if (!h.exists()) causas.push(quien + ' no está habilitado.');
          else if (h.data().nombre !== f.nombre || h.data().correo !== f.correo) causas.push('La habilitación de ' + quien + ' no coincide con lo elegido: recargue y elíjalo de nuevo.');
        }
      } catch (e) {
        causas.push('No se pudo releer el estado en la plataforma (' + ((e && e.message) || 'error') + ').');
      }
      const s = leerSesion();
      if (s && !String(s.nombre || '').trim()) causas.push('Su perfil de administrador no tiene nombre.');
      if (causas.length) return { codigo: 'sin_permiso', mensaje: base + causas.join(' ') };
      return { codigo: 'sin_permiso', mensaje: base + 'No se encontró la causa: recargue, vuelva a validar y publique; si sigue, avise al Ingeniero.' };
    },

    /**
     * ¿El N.º ya está publicado? (solo admin; lo consulta Publicar al validar). null si nunca se
     * publicó; si no, {odtId, estado, publicadoEnMs, libre, mensaje}.
     */
    async previaDelNro(nro) {
      exigirAdmin();
      const n = String(nro || '').trim();
      if (!esNro(n)) throw new ErrorOdt('validacion', 'El N.º de ODT debe tener 8 dígitos.');
      return op(async () => leerPreviaDelNro(await sdk(), await db(), n));
    },

    // ── Firmar (lote de 2, atado) ─────────────────────────────────────────────
    /**
     * @param {object} congelado  la copia de «Preparar» (L-112)
     * @param {object} token      claims del token de la sesión abierta (con correo y contraseña; desde el 2026-11-21
     *                            la firma no vuelve a pedir la contraseña: data/odt_afinia_sesion.js)
     * @returns {Promise<{estado:'entro'} | {estado:'pendiente', mensaje:string, final:Promise<'entro'>}>}
     *          o lanza ErrorOdt ('sin_permiso' con la causa, 'no_entro', 'sin_red', …)
     */
    async firmar(congelado, token) {
      const s = sesion();
      if (!congelado || congelado.uid !== s.uid) throw new ErrorOdt('cuenta');
      return op(async () => {
        const F = await sdk(); const d = await db();
        const plan = planFirma(congelado, token, { ts: F.serverTimestamp(), aBytes: aBytesDe(F) });
        // L-102: un preparar.js o un armador (odt_afinia_lotes.js) viejos de la caché no dejan el compositor
        // vigente ni el N.º de «ODT GENERADA» en el cierre: se dice ANTES de escribir (la regla lo niega igual).
        const errAlDia = errorFirmaAlDia(congelado, plan.acto.datos);
        if (errAlDia) throw new ErrorOdt('validacion', errAlDia);
        const lote = aplicarLote(F, d, [
          { ruta: plan.acto.ruta, datos: plan.acto.datos },
          { tipo: 'update', ruta: plan.odt.ruta, datos: plan.odt.cambios }
        ]);
        try {
          await conTope(lote, tiempoLote);
          return { estado: 'entro' };
        } catch (e) {
          const err = errorDesdeFirebase(e);
          if (err.codigo === 'tiempo' || err.codigo === 'red') {
            const r = await repo.comprobarFirma(congelado.odtId, congelado.rol, s.uid);
            if (r === 'entro') return { estado: 'entro' };
            // Sin respuesta: el lote sigue en cola (el SDK lo reintenta). No se afirma que no entró.
            if (err.codigo === 'tiempo') return { estado: 'pendiente', mensaje: MENSAJES.pendiente, final: desenlace(lote) };
            // El lote terminó RECHAZADO por la red.
            if (r === 'no_entro') throw new ErrorOdt('no_entro', 'Su firma NO quedó registrada (la conexión falló). Revise su red y vuelva a firmar.');
            throw new ErrorOdt('sin_red', 'No se pudo comprobar si su firma quedó registrada (sin conexión). Recargue cuando vuelva la red y mire el estado antes de volver a firmar.');
          }
          if (err.codigo === 'sin_permiso') throw new ErrorOdt('sin_permiso', await repo.causaRechazoFirma(congelado, token));
          throw err;
        }
      });
    },

    /** Tras un lote sin respuesta: 'entro' | 'no_entro' | 'sin_red' (lee el acto del servidor). */
    async comprobarFirma(odtId, rol, uid) {
      try {
        const F = await sdk(); const d = await db();
        const a = await getServidor(F, F.doc(d, COL.odt, odtId, COL.actos, rol));
        if (a.exists() && a.data().uid === uid) return 'entro';
        return 'no_entro';
      } catch (_) {
        return 'sin_red';
      }
    },

    /**
     * Causa probable de un «sin permiso» al firmar, leyendo el estado ACTUAL del servidor:
     * ODT anulada o avanzada; nombre/correo distintos de los PUBLICADOS; «Mi firma» cambiada
     * o con huella incoherente; fecha de cierre posterior a hoy (Bogotá); token sin correo.
     * La hora del inicio de sesión ya NO es causa (2026-11-21: la regla no mide cuánto hace
     * que se escribió la contraseña ni la compara con la publicación o con la firma del AZT).
     */
    async causaRechazoFirma(congelado, token) {
      const c = congelado || {};
      const base = 'La plataforma no aceptó su firma. ';
      try {
        const o = await repo.leerOdtDoc(c.odtId);
        if (o.estado === 'ANULADA') return base + 'La ODT fue anulada.';
        if (o.estado === 'REEMPLAZADA') return base + 'La ODT fue reemplazada por otra versión.';
        if (o.estado === 'CERRADA') return base + 'La ODT ya está cerrada en Afinia.';
        if (o.estado !== c.estadoPrevio || o.rev !== c.revPrevio) return base + 'La ODT cambió (ya firmada o en otro paso). Recargue para ver su estado.';
        const pub = o.firmantes && o.firmantes[c.rol];
        if (pub && (pub.nombre !== c.nombre || pub.correo !== c.correo)) return base + MSG_IDENTIDAD_CAMBIO;
        // FECHA CIERRE = la fecha PREVISTA de la orden (2026-11-21): la regla exige esa, exacta.
        if (c.cierre && c.cierre.fecha !== o.fechaTrabajo) return base + 'La fecha de cierre (' + c.cierre.fecha + ') no es la fecha prevista de la orden (' + o.fechaTrabajo + '): recargue y prepare de nuevo.';
      } catch (_) { /* sin lectura de la ODT: siguen las otras comprobaciones */ }
      if (!token || typeof token.email !== 'string' || !token.email) return base + 'Su sesión no trae el correo de la cuenta. Recargue la página, entre de nuevo y firme.';
      try {
        const mf = await leerMiFirma();
        if (!mf || !mf.hay || mf.huella !== c.huellaImagen) return base + MSG_FIRMA_CAMBIO;
      } catch (e) {
        if (e && e.message === HUELLA_MI_FIRMA_DISTINTA) return base + HUELLA_MI_FIRMA_DISTINTA;
      }
      if (c.cierre && ordenDMA(c.cierre.fecha) > ordenDMA(fechaBogota())) {
        return base + 'La fecha prevista de la orden (' + c.cierre.fecha + ') es posterior a hoy en la hora de Colombia: podrá firmar y cerrar la ODT desde ese día.';
      }
      if (errorFirmaAlDia(c)) return base + MSG_RECARGAR_FIRMA;
      return base + 'Causas posibles: su sesión no se abrió con su correo y contraseña o su correo no está verificado, '
        + 'su firma («Mi firma») es anterior a su habilitación, su perfil quedó inactivo, o el nombre o el correo de su perfil cambiaron. '
        + 'Vuelva a preparar la firma; si sigue, avise al administrador.';
    },

    // ── Anular (admin, con motivo; D6: solo PENDIENTE_AZT o PENDIENTE_RESPONSABLE) ──
    async anular(odtId, motivo) {
      const s = exigirAdmin();
      const o = await repo.leerOdtDoc(odtId);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const cambios = cambiosAnulacion(o, { motivo, quien: { uid: s.uid, nombre: s.nombre }, ts: F.serverTimestamp() });
        await actualizarOdt(F, d, odtId, cambios, 'No se pudo anular: la ODT cambió mientras tanto (por ejemplo, alguien firmó). Recargue y vuelva a intentarlo.');
        return { estado: 'entro', rev: cambios.rev };
      });
    },

    // ── Reemplazar (admin, con motivo; solo una LISTA; 2026-11-21, revierte D6 con su visto bueno) ──
    /**
     * La ODT queda REEMPLAZADA (final): no se borra nada (actos, partes y constancia se conservan y se
     * leen) y su N.º se puede volver a publicar en «Publicar ODT».
     */
    async reemplazar(odtId, motivo) {
      const s = exigirAdmin();
      const o = await repo.leerOdtDoc(odtId);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const r = cambioReemplazar(o, { motivo, por: { uid: s.uid, nombre: s.nombre } });
        if (!r.ok) throw new ErrorOdt(r.codigo === 'estado' ? 'estado' : 'validacion', r.mensaje);
        const cambios = { estado: r.cambios.estado, rev: r.cambios.rev, reemplazo: { ...r.cambios.reemplazo, en: F.serverTimestamp() } };
        await actualizarOdt(F, d, odtId, cambios, 'No se pudo reemplazar: la ODT cambió mientras tanto (por ejemplo, alguien registró su cierre en Afinia). Recargue y vuelva a intentarlo.');
        return { estado: 'entro', rev: cambios.rev };
      });
    },

    // ── Registrar el cierre en Afinia (admin; solo una LISTA; queda CERRADA, final) ──
    /** @param {{fecha:string, soporte:string}} datos  fecha 'dd/mm/aaaa' (entre la prevista y hoy) y el soporte */
    async registrarCierreAfinia(odtId, { fecha, soporte } = {}) {
      const s = exigirAdmin();
      const o = await repo.leerOdtDoc(odtId);
      return op(async () => {
        const F = await sdk(); const d = await db();
        const r = cambioCerrarAfinia(o, { fecha, soporte, por: { uid: s.uid, nombre: s.nombre } });
        if (!r.ok) throw new ErrorOdt(r.codigo === 'estado' ? 'estado' : 'validacion', r.mensaje);
        const cambios = { estado: r.cambios.estado, rev: r.cambios.rev, cierreAfinia: { ...r.cambios.cierreAfinia, en: F.serverTimestamp() } };
        await actualizarOdt(F, d, odtId, cambios, 'No se pudo registrar el cierre: la ODT cambió mientras tanto (por ejemplo, alguien la reemplazó). Recargue y vuelva a intentarlo.');
        return { estado: 'entro', rev: cambios.rev };
      });
    },

    // ── Devolver («no firmo», con motivo, en su turno; una por turno) ─────────
    /**
     * @param {string} odtId @param {'azt'|'responsable'} rol @param {string} motivo
     * @param {number} rev  la revisión de la ODT que se está viendo (id = «rol_rev»)
     */
    async devolver(odtId, rol, motivo, rev) {
      const s = sesion();
      if (!esIdOdt(odtId)) throw new ErrorOdt('no_existe', MSG_NO_EXISTE);
      let dv;
      try { dv = idDevolucion(rol, rev); } catch (_) { throw new ErrorOdt('validacion', 'No se sabe en qué paso está la ODT: recargue la página.'); }
      return op(async () => {
        const F = await sdk(); const d = await db();
        const datos = documentoDevolucion({ uid: s.uid, rol, motivo, ts: F.serverTimestamp() });
        const ref = F.doc(d, COL.odt, odtId, COL.devoluciones, dv);
        if ((await getServidor(F, ref)).exists()) throw new ErrorOdt('devuelta');
        try {
          await conTope(F.setDoc(ref, datos), tiempoLote);
        } catch (e) {
          const err = errorDesdeFirebase(e);
          if (err.codigo !== 'sin_permiso') throw err;
          // La segunda del mismo turno sería un update (la regla la niega); si no, la ODT avanzó.
          let ya = false;
          try { ya = (await getServidor(F, ref)).exists(); } catch (_) { ya = false; }
          if (ya) throw new ErrorOdt('devuelta');
          throw new ErrorOdt('estado', 'No se pudo devolver: la ODT ya no está en su turno. Recargue para ver su estado.');
        }
        return { estado: 'entro', id: dv };
      });
    },

    // ── Registro de descarga (antes de entregar el archivo) ───────────────────
    async registrarDescarga(odtId, huella) {
      const s = sesion();
      return op(async () => {
        const F = await sdk(); const d = await db();
        const datos = documentoDescarga({ odtId, uid: s.uid, huella, ts: F.serverTimestamp() });
        await conTope(F.setDoc(F.doc(F.collection(d, COL.descargas)), datos), tiempoLote);
        return datos;
      });
    }
  };
  return repo;
}
