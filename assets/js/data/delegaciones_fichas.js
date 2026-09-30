// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas DELEGADAS en Fichas Técnicas: lo que hace el CUSTODIO (I/O) · `99 §119`
// ──────────────────────────────────────────────────────────────
// El custodio (administrador con perfil real) decide QUIÉN más puede exportar el
// Excel PE.02081 con las firmas de su directorio y CUÁLES:
// `firmas_delegados_fichas/{uid}` con la autorización de cada titular. Cada
// otorgamiento, cambio o retiro va en UN lote con su registro que SOLO se agrega
// (`firmas_delegados_fichas_registro`, id fijo): o quedan los dos, o ninguno.
// Lista también los últimos usos (`fichas_emisiones` de los delegados).
// Es el espejo de `delegaciones_firmas.js` (Órdenes E/S, `99 §117`), que queda INTACTO.
// Reglas y pruebas: firestore.rules, tests-rules/firmas_delegados_fichas.rules.test.js.
// Archivo NUEVO (L-102). Se carga con import() dinámico, solo para el custodio.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter, documentId, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { folioDeEmision } from '../domain/firmas_equipo.js';
import { DELEGABLES_FICHAS, PROPIAS_FICHAS } from '../domain/fichas_firmas_delegadas.js';

export { DELEGABLES_FICHAS as DELEGABLES, PROPIAS_FICHAS as PROPIAS };
// La lista de usuarios es la misma que en Órdenes E/S (activos, menos el custodio).
export { usuariosParaDelegar } from './delegaciones_firmas.js';

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

/** Delegaciones vigentes de este custodio para Fichas: Map uid → datos. */
export async function delegacionesVigentes() {
  const c = custodio();
  const m = new Map();
  if (!c) return m;
  const snap = await getDocs(query(collection(getDbSafe(), 'firmas_delegados_fichas'), where('custodio', '==', c.uid), limit(50)));
  snap.forEach((d) => m.set(d.id, d.data()));
  return m;
}

/**
 * Otorga o cambia el permiso de `uid` para Fichas (lote NUEVO, con su registro). Devuelve {ok, motivo}.
 * @param {string} uid
 * @param {{delegadoNombre: string, personaPropia: string, personas: string[],
 *          autorizaciones: Object<string, {fecha: string, medio: string}>}} d
 * @param {object|null} vigente  el permiso actual (si lo hay)
 */
export async function otorgar(uid, d, vigente = null) {
  const c = custodio();
  if (!c) return { ok: false, motivo: 'Solo el custodio (administrador) puede dar este permiso.' };
  const personas = DELEGABLES_FICHAS.filter((p) => (d.personas || []).includes(p));
  if (!personas.length) return { ok: false, motivo: 'Marque al menos una firma.' };
  if (!PROPIAS_FICHAS.includes(d.personaPropia)) return { ok: false, motivo: 'Indique quién es este usuario en la lista (Carlos Martelo o Jorge Rhenals).' };
  const autorizaciones = {};
  for (const p of personas) {
    const a = (d.autorizaciones || {})[p] || {};
    autorizaciones[p] = { fecha: String(a.fecha || ''), medio: String(a.medio || '').trim() };
  }
  const db = getDbSafe();
  const lote = doc(collection(db, 'firmas_delegados_fichas')).id;
  const custodioNombre = await nombreVigente(c);
  const datos = {
    custodio: c.uid, custodioNombre, delegadoNombre: String(d.delegadoNombre || ''), personaPropia: d.personaPropia,
    personas, autorizaciones, alcance: 'fichas', lote, en: serverTimestamp()
  };
  const b = writeBatch(db);
  b.set(doc(db, 'firmas_delegados_fichas', uid), datos);
  b.set(doc(db, 'firmas_delegados_fichas_registro', uid + '_' + lote), {
    tipo: vigente ? 'cambio' : 'alta', delegado: uid, delegadoNombre: datos.delegadoNombre, personaPropia: datos.personaPropia,
    personas, autorizaciones, lote, custodio: c.uid, custodioNombre, en: serverTimestamp()
  });
  try {
    await b.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[delegaciones-fichas] otorgar:', e && e.code || e);
    return { ok: false, motivo: e && e.code === 'permission-denied'
      ? 'No se pudo guardar el permiso: lo que hay en pantalla ya no es lo vigente, o este usuario tiene permiso de otro custodio. Recargue la página e inténtelo de nuevo.'
      : 'No se pudo guardar el permiso (' + ((e && e.code) || 'error') + '). Revise la conexión.' };
  }
}

/** Retira el permiso de `uid` para Fichas (con su registro de retiro). Devuelve {ok, motivo}. */
export async function retirar(uid, loteVigente) {
  const c = custodio();
  if (!c) return { ok: false, motivo: 'Solo el custodio puede retirar el permiso.' };
  const db = getDbSafe();
  const b = writeBatch(db);
  b.delete(doc(db, 'firmas_delegados_fichas', uid));
  b.set(doc(db, 'firmas_delegados_fichas_registro', uid + '_' + loteVigente + '_retiro'), {
    tipo: 'retiro', delegado: uid, lote: loteVigente, custodio: c.uid, custodioNombre: await nombreVigente(c), en: serverTimestamp()
  });
  try {
    await b.commit();
    return { ok: true };
  } catch (e) {
    console.warn('[delegaciones-fichas] retirar:', e && e.code || e);
    return { ok: false, motivo: 'No se pudo retirar el permiso (' + ((e && e.code) || 'error') + ').' };
  }
}

/**
 * Los últimos Excel emitidos por DELEGADOS con firmas de este custodio:
 * [{en: Date|null, emisorNombre, equipo, casillas, folio}] (los más nuevos primero).
 * Se consulta POR DELEGADO (los que alguna vez tuvieron permiso, según el registro):
 * las emisiones propias del custodio no ocupan la ventana. Índice:
 * fichas_emisiones (emisor ASC, en DESC).
 */
export async function ultimosUsos({ porDelegado = 20, total = 40 } = {}) {
  const c = custodio();
  if (!c) return [];
  const db = getDbSafe();
  // Quién tuvo permiso alguna vez: los vigentes y TODO el registro, de 50 en 50 (revisión de `§119`: con un solo
  // `limit(50)` un delegado podía quedar por fuera cuando el registro de otro crecía).
  const uids = new Set((await delegacionesVigentes()).keys());
  let ultimo = null;
  for (let pagina = 0; pagina < 20; pagina++) {
    const q = [where('custodio', '==', c.uid), orderBy(documentId()), limit(50)];
    if (ultimo) q.splice(2, 0, startAfter(ultimo));
    const reg = await getDocs(query(collection(db, 'firmas_delegados_fichas_registro'), ...q));
    reg.forEach((d) => { const x = d.data() || {}; if (x.delegado) uids.add(String(x.delegado)); });
    if (reg.size < 50) break;
    ultimo = reg.docs[reg.docs.length - 1];
  }
  const out = [];
  for (const uid of uids) {
    const snap = await getDocs(query(collection(db, 'fichas_emisiones'), where('emisor', '==', uid), orderBy('en', 'desc'), limit(porDelegado)));
    snap.forEach((d) => {
      const x = d.data() || {};
      if (x.custodio !== c.uid) return;
      out.push({
        en: x.en && typeof x.en.toDate === 'function' ? x.en.toDate() : null,
        emisorNombre: String(x.emisorNombre || ''), equipo: x.equipo || {},
        casillas: Array.isArray(x.casillas) ? x.casillas : [], folio: folioDeEmision(d.id)
      });
    });
  }
  return out.sort((a, b) => (b.en ? b.en.getTime() : 0) - (a.en ? a.en.getTime() : 0)).slice(0, total);
}
