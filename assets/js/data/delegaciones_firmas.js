// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas DELEGADAS: lo que hace el CUSTODIO (I/O) · `99 §117`
// ──────────────────────────────────────────────────────────────
// El custodio (administrador con perfil real) decide QUIÉN más puede usar las
// firmas de su directorio en Órdenes E/S y CUÁLES: `firmas_delegados/{uid}`
// con la autorización de cada titular. Cada otorgamiento, cambio o retiro va en
// UN lote con su registro que SOLO se agrega (`firmas_delegados_registro`, id
// fijo): o quedan los dos, o ninguno. Además copia SU firma propia al
// directorio (para que salga en «AUTORIZADO POR» cuando exporta un delegado) y
// lista los últimos usos (`ordenes_emisiones` de los delegados).
// Reglas y pruebas: firestore.rules, tests-rules/firmas_delegados.rules.test.js.
// Archivo NUEVO (L-102). Se carga con import() dinámico, solo para el custodio.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { folioDeEmision } from '../domain/firmas_equipo.js';

/** Personas del directorio que se pueden delegar (las que aceptaron su uso en órdenes). */
export const DELEGABLES = Object.freeze(['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS']);
/** Quién puede ser el propio delegado en la lista (nunca el Ingeniero: «Autorizado» no es su línea). */
export const PROPIAS = Object.freeze(['CARLOS_MARTELO', 'JORGE_RHENALS']);

function custodio() {
  const s = getSession();
  const uid = (s && s.user && s.user.uid) || null;
  if (!uid) return null;
  try {
    const auth = getAuthSafe();
    if (auth && (!auth.currentUser || auth.currentUser.uid !== uid)) return null;
  } catch (_) { /* sin Auth manda la sesión publicada */ }
  const p = (s && s.profile) || {};
  if (p.rol !== 'admin' || p.activo === false || p.legacy) return null;
  return { uid, nombre: p.nombre || '' };
}

/** ¿Quien tiene la sesión puede otorgar? (la regla lo vuelve a exigir) */
export function puedeOtorgar() { return !!(getDbSafe() && custodio()); }

/** Nombre del custodio tal como está AHORA en su perfil (la regla lo compara). */
async function nombreVigente(c) {
  try {
    const snap = await getDoc(doc(getDbSafe(), 'usuarios', c.uid));
    return (snap.exists() && snap.data().nombre) || c.nombre || '';
  } catch (_) { return c.nombre || ''; }
}

/**
 * Usuarios activos a quienes se les puede delegar (todos menos el custodio):
 * [{uid, nombre, etiqueta}] — `nombre` es el del perfil TAL CUAL (la regla lo compara; puede
 * venir vacío) y `etiqueta` lo que se muestra (el correo si no hay nombre).
 */
export async function usuariosParaDelegar() {
  const c = custodio();
  if (!c) return [];
  const snap = await getDocs(query(collection(getDbSafe(), 'usuarios'), limit(100)));
  const out = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    if (d.id !== c.uid && x.activo === true) out.push({ uid: d.id, nombre: String(x.nombre || ''), etiqueta: String(x.nombre || x.email || d.id) });
  });
  return out.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/** Delegaciones vigentes de este custodio: Map uid → {personaPropia, personas, autorizaciones, lote, delegadoNombre}. */
export async function delegacionesVigentes() {
  const c = custodio();
  const m = new Map();
  if (!c) return m;
  const snap = await getDocs(query(collection(getDbSafe(), 'firmas_delegados'), where('custodio', '==', c.uid), limit(50)));
  snap.forEach((d) => m.set(d.id, d.data()));
  return m;
}

/**
 * Otorga o cambia la delegación de `uid` (lote NUEVO, con su registro). Devuelve {ok, motivo}.
 * @param {string} uid
 * @param {{delegadoNombre: string, personaPropia: string, personas: string[],
 *          autorizaciones: Object<string, {fecha: string, medio: string}>}} d
 * @param {object|null} vigente  la delegación actual (si la hay)
 */
export async function otorgar(uid, d, vigente = null) {
  const c = custodio();
  if (!c) return { ok: false, motivo: 'Solo el custodio (administrador) puede dar este permiso.' };
  const personas = DELEGABLES.filter((p) => (d.personas || []).includes(p));
  if (!personas.length) return { ok: false, motivo: 'Marque al menos una firma.' };
  if (!PROPIAS.includes(d.personaPropia)) return { ok: false, motivo: 'Indique quién es este usuario en la lista (Carlos Martelo o Jorge Rhenals).' };
  const autorizaciones = {};
  for (const p of personas) {
    const a = (d.autorizaciones || {})[p] || {};
    autorizaciones[p] = { fecha: String(a.fecha || ''), medio: String(a.medio || '').trim() };
  }
  const db = getDbSafe();
  const lote = doc(collection(db, 'firmas_delegados')).id;
  const custodioNombre = await nombreVigente(c);
  const datos = {
    custodio: c.uid, custodioNombre, delegadoNombre: String(d.delegadoNombre || ''), personaPropia: d.personaPropia,
    personas, autorizaciones, alcance: 'ordenes', lote, en: serverTimestamp()
  };
  const b = writeBatch(db);
  b.set(doc(db, 'firmas_delegados', uid), datos);
  b.set(doc(db, 'firmas_delegados_registro', uid + '_' + lote), {
    tipo: vigente ? 'cambio' : 'alta', delegado: uid, delegadoNombre: datos.delegadoNombre, personaPropia: datos.personaPropia,
    personas, autorizaciones, lote, custodio: c.uid, custodioNombre, en: serverTimestamp()
  });
  try {
    await b.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[delegaciones] otorgar:', e && e.code || e);
    return { ok: false, motivo: e && e.code === 'permission-denied'
      ? 'No se pudo guardar el permiso: lo que hay en pantalla ya no es lo vigente, o este usuario tiene permiso de otro custodio. Recargue la página e inténtelo de nuevo.'
      : 'No se pudo guardar el permiso (' + ((e && e.code) || 'error') + '). Revise la conexión.' };
  }
}

/** Retira la delegación de `uid` (con su registro de retiro). Devuelve {ok, motivo}. */
export async function retirar(uid, loteVigente) {
  const c = custodio();
  if (!c) return { ok: false, motivo: 'Solo el custodio puede retirar el permiso.' };
  const db = getDbSafe();
  const b = writeBatch(db);
  b.delete(doc(db, 'firmas_delegados', uid));
  b.set(doc(db, 'firmas_delegados_registro', uid + '_' + loteVigente + '_retiro'), {
    tipo: 'retiro', delegado: uid, lote: loteVigente, custodio: c.uid, custodioNombre: await nombreVigente(c), en: serverTimestamp()
  });
  try {
    await b.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[delegaciones] retirar:', e && e.code || e);
    return { ok: false, motivo: 'No se pudo retirar el permiso (' + ((e && e.code) || 'error') + ').' };
  }
}

/**
 * Los últimos documentos emitidos por DELEGADOS con firmas de este custodio:
 * [{en: Date|null, emisorNombre, orden, formato, casillas, folio}] (los más nuevos primero).
 * Se consulta POR DELEGADO (los que alguna vez tuvieron permiso, según el registro): las
 * emisiones propias del custodio no ocupan la ventana (revisión de `§117`). Índice:
 * ordenes_emisiones (emisor ASC, en DESC).
 */
export async function ultimosUsos({ porDelegado = 20, total = 40 } = {}) {
  const c = custodio();
  if (!c) return [];
  const db = getDbSafe();
  const reg = await getDocs(query(collection(db, 'firmas_delegados_registro'), where('custodio', '==', c.uid), limit(50)));
  const uids = new Set();
  reg.forEach((d) => { const x = d.data() || {}; if (x.delegado) uids.add(String(x.delegado)); });
  const out = [];
  for (const uid of uids) {
    const snap = await getDocs(query(collection(db, 'ordenes_emisiones'), where('emisor', '==', uid), orderBy('en', 'desc'), limit(porDelegado)));
    snap.forEach((d) => {
      const x = d.data() || {};
      if (x.custodio !== c.uid) return;
      out.push({
        en: x.en && typeof x.en.toDate === 'function' ? x.en.toDate() : null,
        emisorNombre: String(x.emisorNombre || ''), orden: x.orden || {}, formato: String(x.formato || ''),
        casillas: Array.isArray(x.casillas) ? x.casillas : [], folio: folioDeEmision(d.id)
      });
    });
  }
  return out.sort((a, b) => (b.en ? b.en.getTime() : 0) - (a.en ? a.en.getTime() : 0)).slice(0, total);
}
