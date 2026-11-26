// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · NOTIFICACIONES DE CUMPLIMIENTO: repositorio en FIRESTORE · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): «me gustaría que en SGM, en mi sesión, pueda apreciar cuándo y cuántas veces
// notificas». Lo que la PÁGINA lee para el bloque «Notificaciones a …» de la vista de un corte y para los avisos de cada
// ODT (reglas: bloque «Cumplimiento del cierre · ODT Afinia» de firestore.rules; lo leen el administrador y los LECTORES
// de Indicadores; nada de esto se escribe desde la página):
//   · leerResumen        odt_afinia_config/cumplimiento_resumen, DEL SERVIDOR (lo escribe solo el servidor): las
//                        cuentas o null;
//   · listar({despuesDe}) los correos de odt_afinia_correos, el más reciente primero, de a TAM_PAGINA (pide uno más
//                        para saber si hay otra página; limit ≤ 50) y el cursor para «Ver más»;
//   · contarPendientes   cuántos hay en cola (pendiente o en manos del script) y cuántos con error (sin los que
//                        reemplazó un corte más reciente), con un conteo del servidor de limit 50 (si llega a 50, la
//                        pantalla dice «50 o más»). Sin conteo en el SDK, lee la lista (limit 50) y la cuenta;
//   · avisosDeOdts(nros) los avisos (odt_afinia_avisos) de varias ODT: «in» por lotes de 10, limit 50 → Map N.º → [];
//   · avisosDeOdt(nro)   los de una ODT (el buscador «Historial de avisos de una ODT»).
// El SDK y la base se pueden INYECTAR (las pruebas usan dobles). Sin inyección, el SDK se carga del CDN 10.14.1 la
// primera vez que se usa (el mismo de data/odt_afinia.js y de firebase-init.js).
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, errorDesdeFirebase, sesionGlobal } from './odt_afinia_lotes.js';
import { COL_CUMPLIMIENTO } from '../domain/odt_afinia_cumplimiento.js';
import { COL_RESUMEN, contadoresResumen, msDeMarca, nrosDistintos, enLotes } from '../domain/odt_afinia_cumplimiento_resumen.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
/** Notificaciones por página de la tabla «Cuándo se le notificó». */
export const TAM_PAGINA = 20;
/** Tope de los conteos de la cola y de los errores (la regla pide limit ≤ 50). */
export const TOPE_CONTEO = 50;
/** N.º por consulta «in» de los avisos de varias ODT. */
export const LOTE_IN = 10;
/** Avisos por consulta (cada ODT tiene como mucho 3: 10 × 3 = 30). */
export const TOPE_AVISOS = 50;

/** Un correo leído, con sus fechas en milisegundos. */
const correoDe = (x) => { const v = x.data() || {}; return { ...v, id: x.id, creadoEnMs: msDeMarca(v.creadoEn), enviadoEnMs: msDeMarca(v.enviadoEn) }; };
/** Un aviso leído, con su fecha en milisegundos. */
const avisoDe = (x) => { const v = x.data() || {}; return { ...v, id: x.id, enMs: msDeMarca(v.en) }; };

/**
 * @param {object} [opciones]
 * @param {object} [opciones.sdk]  funciones de Firestore (por defecto, el SDK del CDN 10.14.1)
 * @param {object} [opciones.db]   instancia de Firestore (por defecto, getDbSafe())
 * @param {() => object|null} [opciones.sesion]  por defecto la del guard (sesionGlobal)
 */
export function crearRepositorioNotificaciones(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  async function sdk() { if (!_sdk) _sdk = await import(CDN_FIRESTORE); return _sdk; }
  async function db() {
    if (!_db) { const fb = await import('../firebase-init.js'); _db = fb.getDbSafe(); }
    if (!_db) throw new ErrorOdt('red', 'La plataforma no está disponible en este momento (la base no inició).');
    return _db;
  }
  function sesion() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    return s;
  }
  async function op(fn) {
    sesion();
    try { return await fn(await sdk(), await db()); } catch (e) { throw errorDesdeFirebase(e); }
  }
  const getsServidor = (F, q) => (F.getDocsFromServer || F.getDocs)(q);
  async function contar(F, q) {
    if (typeof F.getCountFromServer === 'function') {
      const r = await F.getCountFromServer(q);
      return Number(r && typeof r.data === 'function' ? r.data().count : 0) || 0;
    }
    return (await getsServidor(F, q)).size;
  }

  return {
    modo: 'nube',

    /** El resumen de notificaciones (del servidor) o null si todavía no existe. */
    leerResumen() {
      return op(async (F, d) => {
        const snap = await (F.getDocFromServer || F.getDoc)(F.doc(d, COL_RESUMEN.col, COL_RESUMEN.doc));
        if (!snap.exists()) return null;
        const v = snap.data() || {};
        return {
          ...contadoresResumen(v),
          primerEnvioEnMs: msDeMarca(v.primerEnvioEn), ultimoEnvioEnMs: msDeMarca(v.ultimoEnvioEn), actualizadoEnMs: msDeMarca(v.actualizadoEn),
          porRecalcular: v.porRecalcular === true
        };
      });
    },

    /**
     * Una página de notificaciones (el más reciente primero).
     * @param {{despuesDe?:object|null}} [p]  despuesDe: el cursor que devolvió la página anterior
     * @returns {Promise<{items:object[], hayMas:boolean, cursor:object|null}>}
     */
    listar({ despuesDe = null } = {}) {
      return op(async (F, d) => {
        const partes = [F.orderBy('creadoEn', 'desc'), ...(despuesDe ? [F.startAfter(despuesDe)] : []), F.limit(TAM_PAGINA + 1)];
        const r = await getsServidor(F, F.query(F.collection(d, COL_CUMPLIMIENTO.correos), ...partes));
        const docs = r.docs.slice(0, TAM_PAGINA);
        return { items: docs.map(correoDe), hayMas: r.docs.length > TAM_PAGINA, cursor: docs.length ? docs[docs.length - 1] : null };
      });
    },

    /** {enCola, conError, tope}: cuántos hay en cola y cuántos no se pudieron enviar (cada uno, como mucho `tope`). */
    contarPendientes() {
      return op(async (F, d) => {
        const col = F.collection(d, COL_CUMPLIMIENTO.correos);
        const [enCola, conError] = await Promise.all([
          contar(F, F.query(col, F.where('estado', 'in', ['pendiente', 'en_envio']), F.limit(TOPE_CONTEO))),
          contar(F, F.query(col, F.where('estado', '==', 'error'), F.where('reemplazadoPor', '==', ''), F.limit(TOPE_CONTEO)))
        ]);
        return { enCola, conError, tope: TOPE_CONTEO };
      });
    },

    /** Los avisos de varias ODT: Map N.º → [avisos] (solo las que tienen alguno). */
    avisosDeOdts(nros) {
      const xs = nrosDistintos(nros);
      if (!xs.length) return Promise.resolve(new Map());
      return op(async (F, d) => {
        const col = F.collection(d, COL_CUMPLIMIENTO.avisos);
        const tandas = await Promise.all(enLotes(xs, LOTE_IN).map((lote) => getsServidor(F, F.query(col, F.where('nro', 'in', lote), F.limit(TOPE_AVISOS)))));
        const m = new Map();
        for (const r of tandas) {
          for (const x of r.docs) {
            const a = avisoDe(x);
            if (!m.has(a.nro)) m.set(a.nro, []);
            m.get(a.nro).push(a);
          }
        }
        return m;
      });
    },

    /** Los avisos de UNA ODT (el buscador). */
    avisosDeOdt(nro) {
      if (typeof nro !== 'string' || !nro) return Promise.resolve([]);
      return op(async (F, d) => {
        const r = await getsServidor(F, F.query(F.collection(d, COL_CUMPLIMIENTO.avisos), F.where('nro', '==', nro), F.limit(TOPE_AVISOS)));
        return r.docs.map(avisoDe);
      });
    }
  };
}
