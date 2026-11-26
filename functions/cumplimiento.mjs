// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Avisos de CUMPLIMIENTO DEL CIERRE: adaptadores de la Cloud Function · 99 §236
// ──────────────────────────────────────────────────────────────
// La lógica (qué avisar, a quién, con qué texto, sin repetir) vive en
// assets/js/domain/odt_afinia_cumplimiento_avisos.js (copiada a ./domain/ por prepare-deploy.mjs). Aquí solo
// está lo que toca la base, para inyectarlo en ella:
//   · crearDepsCumplimiento: las lecturas y escrituras con el Admin SDK (sin reglas: solo el servidor escribe en
//     odt_afinia_correos y odt_afinia_avisos). La reserva de un aviso es create() (si ya existe, no se repite) y
//     los cambios de estado compartido van en transacción (cambiarAvisoSi exige el estado y, al tomar una reserva
//     abandonada, que siga siendo del MISMO correo: dos procesos no toman la misma).
//   · CAMBIO del 2026-11-26 (99 §236): la función YA NO ENVÍA correo (sin nodemailer ni secreto). encolarCorreo deja
//     cada correo EN COLA («pendiente», en transacción); lo envía el script de Google de la cuenta remitente a través
//     de la función avisosCorreoRemitente (cumplimiento_remitente.mjs, de donde salen también listarCola y
//     marcarAvisosDeCorreo). reemplazarCorreo retira de la cola lo que dejó un corte anterior; corrector ronda 1:
//     marcarErrorReemplazado cierra los correos en «error» de cortes anteriores (listarErroresVigentes).
//   · esAdminConPerfil: quién puede pedir el reproceso: el mismo criterio de las reglas del módulo de Indicadores
//     (hasProfile() && isAdmin(): perfil en /usuarios, rol 'admin' y activo).
// Sin estado global: todo llega por parámetro (las pruebas de functions/tests/ usan un Firestore en memoria).
// ══════════════════════════════════════════════════════════════

import { crearOperacionesCola } from './cumplimiento_remitente.mjs';

const COL = Object.freeze({
  config: ['odt_afinia_config', 'cumplimiento'],
  cortes: 'odt_afinia_cortes',
  partes: 'partes',
  correos: 'odt_afinia_correos',
  avisos: 'odt_afinia_avisos'
});
const PARTES_MAX = 60;
const LOTE_MAX = 400;
const LECTURA_MAX = 100;

/** ¿El error es «ya existe» (create() de un documento que existe)? */
export function esYaExiste(e) {
  const c = e && e.code;
  return c === 6 || c === 'already-exists' || c === 'ALREADY_EXISTS' || /already exists/i.test(String(e && e.message));
}

/**
 * @param {{db:object, FieldValue:object, log?:Function, ahora?:()=>Date}} p
 *   db: getFirestore() del Admin SDK · FieldValue: el de firebase-admin/firestore (serverTimestamp)
 */
export function crearDepsCumplimiento({ db, FieldValue, log, ahora = () => new Date() }) {
  const aviso = (id) => db.collection(COL.avisos).doc(id);
  const correo = (id) => db.collection(COL.correos).doc(id);
  const coincide = (x, esperado) => (typeof esperado === 'string' ? x.estado === esperado
    : !!esperado && typeof esperado === 'object' && Object.entries(esperado).every(([k, v]) => x[k] === v));
  async function leerVarios(ids, ref) {
    const m = new Map();
    for (let i = 0; i < ids.length; i += LECTURA_MAX) {
      const refs = ids.slice(i, i + LECTURA_MAX).map(ref);
      if (!refs.length) continue;
      const snaps = await db.getAll(...refs);
      for (const s of snaps) if (s.exists) m.set(s.id, s.data());
    }
    return m;
  }
  return {
    ...crearOperacionesCola({ db, FieldValue }),
    async leerConfig() {
      const s = await db.collection(COL.config[0]).doc(COL.config[1]).get();
      return s.exists ? s.data() : null;
    },
    async leerCorte(id) {
      const s = await db.collection(COL.cortes).doc(id).get();
      return s.exists ? { ...s.data(), id } : null;
    },
    async leerPartes(id) {
      const r = await db.collection(COL.cortes).doc(id).collection(COL.partes).limit(PARTES_MAX).get();
      return r.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    /** ¿Hay otro corte del MISMO responsable con datos más recientes? (usa el índice responsable ↑ · fechaDatos ↓ · creadoEn ↓) */
    async hayCorteMasReciente(corte) {
      if (!corte || !corte.responsable || !corte.fechaDatos) return false;
      const r = await db.collection(COL.cortes).where('responsable', '==', corte.responsable).where('fechaDatos', '>', corte.fechaDatos)
        .orderBy('fechaDatos', 'desc').orderBy('creadoEn', 'desc').limit(1).get();
      return !r.empty;
    },
    async leerAvisos(ids) { return leerVarios(ids, aviso); },
    /** Los correos que nombran avisos «reservado» de otro corte (¿su proceso se cortó?). */
    async leerCorreos(ids) { return leerVarios(ids, correo); },
    async crearAviso(id, datos) {
      try { await aviso(id).create(datos); return true; } catch (e) { if (esYaExiste(e)) return false; throw e; }
    },
    /** esperado: el estado ('error'…) o {estado, correoId} (todas sus claves deben coincidir). */
    async cambiarAvisoSi(id, esperado, cambios) {
      const ref = aviso(id);
      return db.runTransaction(async (t) => {
        const s = await t.get(ref);
        if (!s.exists || !coincide(s.data() || {}, esperado)) return false;
        t.update(ref, cambios);
        return true;
      });
    },
    async actualizarAvisos(ids, cambios) {
      for (let i = 0; i < ids.length; i += LOTE_MAX) {
        const b = db.batch();
        for (const id of ids.slice(i, i + LOTE_MAX)) b.update(aviso(id), cambios);
        await b.commit();
      }
    },
    /**
     * Deja un correo EN COLA (transacción, 99 §236): nuevo → «pendiente» ({estado:'nuevo'}); si ya salió →
     * {estado:'enviado', nros}; si lo tiene el script («en_envio») → {estado:'ocupado', nros} (no se toca); si estaba
     * en «error» → vuelve a «pendiente» re-armado, con los intentos en cero ({estado:'reabierto'}); si seguía en cola →
     * se re-arma con las ODT de hoy ({estado:'actualizado'}).
     * Corrector ronda 1 (99 §236): al REABRIRSE, creadoEn se renueva (es cuándo quedó en cola por última vez). Así la
     * tabla «Cuándo se le notificó», que ordena por creadoEn, lo pone arriba cuando sale, y mientras espera muestra la
     * hora en que volvió a la cola, no la del primer intento.
     */
    async encolarCorreo(id, datos, { ahoraMs }) {
      const ref = correo(id);
      return db.runTransaction(async (t) => {
        const s = await t.get(ref);
        if (!s.exists) {
          t.create(ref, { ...datos, estado: 'pendiente', error: '', errorPor: '', creadoEn: FieldValue.serverTimestamp(), encoladoEnMs: ahoraMs, enviadoEn: null, intentos: 0, prestamo: '', prestamoHastaMs: 0, reemplazadoPor: '' });
          return { estado: 'nuevo' };
        }
        const x = s.data() || {};
        const nros = Array.isArray(x.nros) ? x.nros : [];
        if (x.estado === 'enviado') return { estado: 'enviado', nros };
        if (x.estado === 'en_envio') return { estado: 'ocupado', nros };
        if (x.estado === 'error') {
          t.update(ref, { ...datos, estado: 'pendiente', error: '', errorPor: '', creadoEn: FieldValue.serverTimestamp(), encoladoEnMs: ahoraMs, intentos: 0, prestamo: '', prestamoHastaMs: 0, reemplazadoPor: '' });
          return { estado: 'reabierto' };
        }
        t.update(ref, { ...datos, estado: 'pendiente' });
        return { estado: 'actualizado' };
      });
    },
    /** Retira de la cola un correo que reemplazó un corte más reciente (solo si sigue «pendiente»): {ok, nros, umbral}. */
    async reemplazarCorreo(id, { porCorte, error }) {
      const ref = correo(id);
      return db.runTransaction(async (t) => {
        const s = await t.get(ref);
        const x = s.exists ? (s.data() || {}) : null;
        if (!x || x.estado !== 'pendiente') return { ok: false };
        t.update(ref, { estado: 'error', error, reemplazadoPor: porCorte });
        return { ok: true, nros: Array.isArray(x.nros) ? x.nros : [], umbral: x.umbral };
      });
    },
    /**
     * Corrector ronda 1 (99 §236): un correo en «error» de un corte ANTERIOR queda reemplazado por el corte más reciente
     * (sus ODT se revisan con él, y el corte viejo ya no se puede reprocesar). Se conserva su error (el motivo real);
     * solo se le pone reemplazadoPor. Así la tarjeta «Con error» deja de contarlo. Transacción: solo si sigue en
     * «error» y sin reemplazar. Devuelve true si lo marcó.
     */
    async marcarErrorReemplazado(id, { porCorte }) {
      const ref = correo(id);
      return db.runTransaction(async (t) => {
        const s = await t.get(ref);
        const x = s.exists ? (s.data() || {}) : null;
        if (!x || x.estado !== 'error' || x.reemplazadoPor) return false;
        t.update(ref, { reemplazadoPor: porCorte });
        return true;
      });
    },
    marca: () => FieldValue.serverTimestamp(),
    ahora,
    log: typeof log === 'function' ? log : () => {}
  };
}

/**
 * ¿Puede pedir el reproceso? Perfil en /usuarios con rol 'admin' y activo (como hasProfile() && isAdmin() de las
 * reglas del módulo de Indicadores: el arranque por /admins sin perfil no cuenta).
 * @param {{existe:boolean, datos:object|null}} perfil
 */
export function esAdminConPerfil(perfil) {
  const d = perfil && perfil.existe ? (perfil.datos || {}) : null;
  return !!d && d.rol === 'admin' && d.activo === true;
}
