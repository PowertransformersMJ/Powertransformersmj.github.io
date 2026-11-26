// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Avisos de CUMPLIMIENTO DEL CIERRE: el SCRIPT DE GOOGLE que envía (adaptadores) · 99 §236
// ──────────────────────────────────────────────────────────────
// Decisión del 2026-11-26 (99 §236): las Cloud Functions YA NO ENVÍAN correo (no hay contraseña de aplicación de
// Gmail). Lo envía un script de Google Apps Script en la cuenta remitente (functions/apps-script/), que llama a la
// función HTTPS avisosCorreoRemitente. La lógica (identidad, préstamos, resultados, textos) vive en
// assets/js/domain/odt_afinia_cumplimiento_remitente.js (copiada a ./domain/ por prepare-deploy.mjs y INYECTADA aquí
// como `logica`: este archivo no importa ./domain, que en las pruebas puede no existir). Aquí solo:
//   · crearOperacionesCola: lo que comparten el proceso de un corte y la función del script sobre la cola
//     (odt_afinia_correos) y los avisos (odt_afinia_avisos), con el Admin SDK (sin reglas: solo el servidor escribe);
//   · crearDepsRemitente: las lecturas y escrituras de la función del script. Préstamo y resultado van en
//     TRANSACCIÓN sobre el correo (dos llamadas no prestan ni cierran el mismo correo dos veces); el estado del
//     script (odt_afinia_config/cumplimiento_script) se escribe con merge. Pedido del 2026-11-26 (99 §236, «cuándo y
//     cuántas veces notificas»): al pasar un correo a «enviado», cerrar suma el resumen de notificaciones en la MISMA
//     transacción (cumplimiento_resumen.mjs, inyectado como `resumen`); la cola sale la más vieja primero y solo la del
//     responsable configurado (listarCola; corrector ronda 1: más los correos viejos sin responsableNorm);
//   · crearVerificadorGoogle: la verificación del token de identidad con google-auth-library (OAuth2Client.
//     verifyIdToken SIN `audience`). Comprobado en node_modules (google-auth-library 9.15.1 y la 10.6.2 de
//     firebase-admin, oauth2client.js → verifySignedJwtWithCertsAsync): sin audience verifica la FIRMA con los
//     certificados públicos de Google, iat/exp (con 5 min de holgura) y el emisor (accounts.google.com), y SALTA la
//     comprobación del aud; el aud lo compara el dominio contra config.audienciaScript. Los mensajes de error de la
//     librería traen el token completo: NUNCA se registran;
//   · responderHttp: de la petición de Express a la atención del dominio y de vuelta (JSON, sin caché, sin CORS).
// Sin estado global salvo el cliente de OAuth del verificador (guarda en caché los certificados de Google).
// ══════════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto';

const COL = Object.freeze({
  config: ['odt_afinia_config', 'cumplimiento'],
  estado: ['odt_afinia_config', 'cumplimiento_script'],
  correos: 'odt_afinia_correos',
  avisos: 'odt_afinia_avisos'
});
const LECTURA_MAX = 100;
const lista = (v) => (Array.isArray(v) ? v : []);
/** Milisegundos de una marca (Timestamp del SDK o {ms} de los dobles); 0 si no hay. */
const msDe = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : (t && Number.isFinite(t.ms) ? t.ms : 0));

/**
 * Lo que comparten el proceso de un corte y la función del script sobre la cola de correos y sus avisos.
 * @param {{db:object, FieldValue:object}} p
 */
export function crearOperacionesCola({ db, FieldValue }) {
  const aviso = (id) => db.collection(COL.avisos).doc(id);
  /** Los correos de varias consultas, sin repetir (por id). */
  async function unir(consultas) {
    const m = new Map();
    for (const r of await Promise.all(consultas.map((q) => q.get()))) {
      for (const d of r.docs) if (!m.has(d.id)) m.set(d.id, { ...d.data(), id: d.id });
    }
    return [...m.values()];
  }
  return {
    /**
     * Los correos de la cola en esos estados, LOS MÁS VIEJOS PRIMERO (orden por creadoEn).
     * Corrector 99 §236: con `responsableNorm` (el responsable de la configuración, normalizado), una consulta solo
     * de ese responsable (como mucho `limite`): los de otro (que nunca salen) no tapan la cola aunque haya más de
     * `limite`. Índice compuesto responsableNorm ↑ · estado ↑ · creadoEn ↑ (firestore.indexes.json).
     * Corrector ronda 1 (99 §236): y OTRA sin filtro de responsable (como mucho `limite`, índice estado ↑ · creadoEn ↑),
     * unidas por id. Un correo de las fases anteriores no trae responsableNorm: sin esta segunda consulta nunca
     * saldría ni lo retiraría un corte más reciente, y sus avisos quedarían «reservado» para siempre. Esos correos son
     * los más viejos de la cola, así que salen primero en ella. El dominio descarta los de otro responsable.
     * Devuelve como mucho 2 × `limite`.
     */
    async listarCola(limite, estados, { responsableNorm = '' } = {}) {
      const col = db.collection(COL.correos);
      const cola = (q) => q.where('estado', 'in', [...estados]).orderBy('creadoEn', 'asc').limit(limite);
      const xs = await unir(responsableNorm ? [cola(col.where('responsableNorm', '==', responsableNorm)), cola(col)] : [cola(col)]);
      return xs.sort((a, b) => msDe(a.creadoEn) - msDe(b.creadoEn) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
    /**
     * Corrector ronda 1 (99 §236): los correos en «error» que ningún corte más reciente ha reemplazado
     * (reemplazadoPor == ''), como mucho `limite` por consulta. Hay dos consultas, como en listarCola: una del
     * responsable (responsableNorm) y otra sin ese filtro, para los correos de las fases anteriores. Solo usan
     * igualdades, así que bastan los índices simples. Las usa el proceso de un corte más reciente, que los marca
     * reemplazados (marcarErrorReemplazado, en cumplimiento.mjs).
     */
    async listarErroresVigentes(limite, { responsableNorm = '' } = {}) {
      const col = db.collection(COL.correos);
      const vigentes = (q) => q.where('estado', '==', 'error').where('reemplazadoPor', '==', '').limit(limite);
      return unir(responsableNorm ? [vigentes(col.where('responsableNorm', '==', responsableNorm)), vigentes(col)] : [vigentes(col)]);
    },
    /**
     * Los avisos de un correo pasan a `estado`, solo los que siguen siendo de ESE correo: a «enviado» (salió) los de
     * ese correo; a «error» (falló o se retiró de la cola) solo los que siguen «reservado» por él.
     * Corrector 99 §236: en TRANSACCIÓN por tandas (como mucho LECTURA_MAX avisos): la condición se revisa con lo que
     * hay al confirmar. Si otro proceso (un corte o un reproceso, que corren en OTRA función) toma un aviso entre la
     * lectura y la escritura, la transacción se repite y ese aviso ya no se toca.
     */
    async marcarAvisosDeCorreo(correoId, { ids, estado }) {
      const xs = lista(ids);
      let n = 0;
      for (let i = 0; i < xs.length; i += LECTURA_MAX) {
        const refs = xs.slice(i, i + LECTURA_MAX).map(aviso);
        if (!refs.length) continue;
        n += await db.runTransaction(async (t) => {
          const snaps = await t.getAll(...refs);
          let k = 0;
          snaps.forEach((s, j) => {
            const d = s.exists ? (s.data() || {}) : null;
            if (!d || d.correoId !== correoId) return;
            if (estado !== 'enviado' && d.estado !== 'reservado') return;
            t.update(refs[j], { estado, en: FieldValue.serverTimestamp() });
            k++;
          });
          return k;
        });
      }
      return n;
    }
  };
}

/** Un id de préstamo: 24 caracteres al azar (base64url). */
export const idPrestamoAlAzar = () => randomBytes(18).toString('base64url');

/**
 * @param {{db:object, FieldValue:object, verificarToken:(token:string)=>Promise<object>, logica:object,
 *          ahora?:()=>Date, log?:Function, nuevoPrestamo?:()=>string}} p
 *   logica: el módulo domain/odt_afinia_cumplimiento_remitente.js (decidirPrestamo, cambiosPrestamo, cambiosTope,
 *   decidirResultado, cambiosResultado)
 */
export function crearDepsRemitente({ db, FieldValue, verificarToken, logica, ahora = () => new Date(), log, nuevoPrestamo = idPrestamoAlAzar, resumen = null }) {
  const correo = (id) => db.collection(COL.correos).doc(id);
  const L = logica;
  const registrar = typeof log === 'function' ? log : () => {};
  return {
    ...crearOperacionesCola({ db, FieldValue }),
    verificarToken,
    async leerConfig() {
      const s = await db.collection(COL.config[0]).doc(COL.config[1]).get();
      return s.exists ? s.data() : null;
    },
    async guardarEstado(cambios) {
      await db.collection(COL.estado[0]).doc(COL.estado[1]).set(cambios, { merge: true });
    },
    /** Presta un correo (transacción): {estado:'prestado', correo} | {estado:'tope', nros, umbral} | {estado:'no'}. */
    async prestar(id, { ahoraMs, prestamo, responsable }) {
      const ref = correo(id);
      return db.runTransaction(async (t) => {
        const s = await t.get(ref);
        if (!s.exists) return { estado: 'no' };
        const x = s.data() || {};
        const d = L.decidirPrestamo(x, { ahoraMs, responsable });
        if (d === 'prestar') {
          t.update(ref, L.cambiosPrestamo(x, { ahoraMs, prestamo, marca: FieldValue.serverTimestamp() }));
          return { estado: 'prestado', correo: { id, para: lista(x.para), cc: lista(x.cc), asunto: String(x.asunto || ''), texto: String(x.texto || ''), html: String(x.html || ''), prestamo } };
        }
        if (d === 'tope') {
          t.update(ref, L.cambiosTope());
          return { estado: 'tope', nros: lista(x.nros), umbral: x.umbral };
        }
        return { estado: 'no' };
      });
    },
    /**
     * Registra el resultado que informa el script (transacción): {estado: la decisión, nros, umbral}.
     * 99 §236 (resumen de notificaciones): con `resumen` (cumplimiento_resumen.mjs), cuando el correo pasa a «enviado»
     * el resumen se suma en la MISMA transacción (un resultado repetido es 'repetido': no suma). Si la suma falla, el
     * envío se registra igual (si no, el script lo volvería a mandar) y el resumen queda «porRecalcular».
     */
    async cerrar(id, { prestamo, ok, error, marca }) {
      const ref = correo(id);
      const hacer = (conResumen) => db.runTransaction(async (t) => {
        const s = await t.get(ref);
        const x = s.exists ? (s.data() || {}) : null;
        const d = L.decidirResultado(x, { prestamo, ok });
        const cambios = L.cambiosResultado(d, { error, marca });
        const anotar = conResumen && x && d === 'enviado' ? await resumen.preparar(t, { id, correo: x, marca }) : null;
        if (x && Object.keys(cambios).length) t.update(ref, cambios);
        if (anotar) anotar();
        return { estado: d, nros: x ? lista(x.nros) : [], umbral: x ? x.umbral : null };
      });
      if (!resumen) return hacer(false);
      try { return await hacer(true); } catch (e) {
        if (!e || !e.deResumen) throw e;
        registrar('error', 'Resumen de notificaciones: no se pudo sumar el envío; se registra sin él y queda por recalcular', { correoId: id, error: String(e.message || '').slice(0, 300) });
        const r = await hacer(false);
        if (r.estado === 'enviado') { try { await resumen.marcarPorRecalcular(); } catch (_) { /* lo corrige el recálculo del reproceso */ } }
        return r;
      }
    },
    nuevoPrestamo,
    marca: () => FieldValue.serverTimestamp(),
    ahora,
    log: typeof log === 'function' ? log : () => {}
  };
}

/**
 * La verificación del token de identidad de Google (firma, vencimiento y emisor; el aud lo revisa el dominio).
 * @param {{cliente?:object, cargar?:()=>Promise<object>}} [p]  cliente: un OAuth2Client ya creado (pruebas)
 * @returns {(token:string)=>Promise<object>}  el payload; lanza si el token no vale
 */
export function crearVerificadorGoogle({ cliente = null, cargar = () => import('google-auth-library') } = {}) {
  let c = cliente;
  return async function verificarToken(token) {
    if (!c) {
      const m = await cargar();
      const OAuth2Client = m.OAuth2Client || (m.default && m.default.OAuth2Client);
      c = new OAuth2Client();
    }
    const ticket = await c.verifyIdToken({ idToken: token });     // SIN audience: ver la cabecera
    const p = ticket && typeof ticket.getPayload === 'function' ? ticket.getPayload() : null;
    if (!p) throw new Error('token sin contenido');
    return p;
  };
}

/**
 * De la petición de Express a la atención del dominio y de vuelta: siempre JSON, sin caché; 405 con «Allow: POST».
 * Sin cabeceras de CORS (la función no se llama desde un navegador).
 * @param {object} req  @param {object} res
 * @param {(sol:object)=>Promise<{status:number, cuerpo:object}>} atender
 */
export async function responderHttp(req, res, atender) {
  const cabecera = (k) => (typeof req.get === 'function' ? req.get(k) : (req.headers || {})[k.toLowerCase()]) || '';
  const { status, cuerpo } = await atender({ metodo: req.method, tipo: cabecera('content-type'), autorizacion: cabecera('authorization'), cuerpo: req.body });
  res.set('Cache-Control', 'no-store');
  if (status === 405) res.set('Allow', 'POST');
  res.status(status).json(cuerpo);
}
