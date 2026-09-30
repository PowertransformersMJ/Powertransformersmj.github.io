// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firmas DELEGADAS en Fichas Técnicas: lo que usa el DELEGADO (I/O) · `99 §119`
// ──────────────────────────────────────────────────────────────
// Un usuario al que el custodio (el Ingeniero) le dio permiso en
// `firmas_delegados_fichas/{uid}` lee, del directorio de ESE custodio, solo las
// firmas de las personas nombradas, y registra cada Excel que las lleva en
// `fichas_emisiones` (rama del delegado: custodio = dueño del directorio, emisor =
// quien emite, delegacion = el lote vigente). Las reglas lo exigen de nuevo en cada
// petición: retirar el permiso corta en la siguiente lectura.
//
// `adaptadorDelegado()` devuelve el MISMO contrato que la página le da al módulo de
// fichas para el custodio ({disponible, leer, nuevaEmisionId, registrarEmision}): el
// camino de la exportación (`panel.js`) no cambia. Nunca URL pública; SIN caché de
// firmas: cada emisión relee y la pantalla compara la huella de los bytes.
// Archivo NUEVO (L-102). La página lo carga con import() dinámico si NO es custodio.
// ══════════════════════════════════════════════════════════════

import { collection, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { delegacionFichasDe, puedeLeerDelegada, casillaDelegadaValida } from '../domain/fichas_firmas_delegadas.js';
import { nombreDePersona } from '../domain/firmas_equipo.js';

/** Sesión VIVA, con perfil real y activo (no la de arranque). */
function sesion() {
  const s = getSession();
  const uid = (s && s.user && s.user.uid) || null;
  if (!uid) return null;
  try {
    const auth = getAuthSafe();
    if (auth && (!auth.currentUser || auth.currentUser.uid !== uid)) return null;
  } catch (_) { /* sin Auth manda la sesión publicada */ }
  const p = (s && s.profile) || {};
  if (p.activo === false || p.legacy) return null;
  return { uid, nombre: p.nombre || '' };
}

function aBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * La delegación para Fichas de quien tiene la sesión (ver `delegacionFichasDe`)
 * · null si no tiene · {error: true} si no se pudo leer.
 */
export async function miDelegacionFichas() {
  const c = sesion();
  if (!c || !getDbSafe()) return null;
  try {
    const snap = await getDoc(doc(getDbSafe(), 'firmas_delegados_fichas', c.uid));
    return snap.exists() ? delegacionFichasDe(snap.data()) : null;
  } catch (e) {
    if (e && e.code === 'permission-denied') return null;
    console.warn('[firmas-delegadas-fichas] delegación:', e && e.code || e);
    return { error: true };
  }
}

/**
 * Una firma del directorio del custodio, recién leída: {dataUrl, huella, autorizacion}
 * · null si NO HAY · {denegada: true} si el permiso no existe o se retiró · {error: true}
 * si no se pudo leer (red).
 */
export async function leerFirmaDelegada(delegacion, id) {
  if (!sesion() || !getDbSafe() || !puedeLeerDelegada(id, delegacion)) return { error: true };
  try {
    const snap = await getDoc(doc(getDbSafe(), 'firmas_equipo', delegacion.custodio, 'personas', id));
    if (!snap.exists()) return null;
    const d = snap.data() || {};
    const img = d.imagen;
    if (!img || typeof img.toUint8Array !== 'function') return { error: true };
    const a = d.autorizacion || {};
    return {
      dataUrl: 'data:image/png;base64,' + aBase64(img.toUint8Array()),
      huella: d.huella || '',
      autorizacion: { fecha: String(a.fecha || ''), medio: String(a.medio || '') }
    };
  } catch (e) {
    if (e && e.code === 'permission-denied') return { denegada: true };
    console.warn('[firmas-delegadas-fichas] lectura:', e && e.code || e);
    return { error: true };
  }
}

/** Nombre vigente de QUIEN EMITE: la regla lo compara con su /usuarios/{uid}.nombre. */
async function nombreVigente(c) {
  try {
    const snap = await getDoc(doc(getDbSafe(), 'usuarios', c.uid));
    return (snap.exists() && snap.data().nombre) || c.nombre || '';
  } catch (_) { return c.nombre || ''; }
}

/**
 * Registra una emisión del delegado (lanza si falla: sin registro no sale con las firmas).
 * @param {string} id
 * @param {{equipo, casillas: Array, huellaArchivo: string}} datos
 * @param {{custodio, custodioNombre, lote}} delegacion  la VIGENTE (recién leída)
 */
export async function registrarEmisionDelegada(id, { equipo, casillas, huellaArchivo }, delegacion) {
  const c = sesion();
  if (!c) throw new Error('Sin sesión.');
  const cs = (casillas || []).map((x) => ({
    k: String(x.k || ''), persona: String(x.persona || ''), nombre: String(x.nombre || ''), origen: String(x.origen || ''), huella: String(x.huella || '')
  }));
  const mala = cs.find((x) => !casillaDelegadaValida(x, delegacion));
  if (mala) throw new Error('La firma de ' + (mala.nombre || mala.k) + ' ya no está en su permiso. Recargue la página.');
  const e = equipo || {};
  await setDoc(doc(getDbSafe(), 'fichas_emisiones', id), {
    equipo: {
      matricula: String(e.matricula || '').slice(0, 120),
      subestacion: String(e.subestacion || '').slice(0, 120),
      serie: String(e.serie || '').slice(0, 120)
    },
    documento: 'PE.02081',
    casillas: cs,
    huellaArchivo,
    custodio: delegacion.custodio,
    custodioNombre: delegacion.custodioNombre,
    emisor: c.uid,
    emisorNombre: await nombreVigente(c),
    delegacion: delegacion.lote,
    en: serverTimestamp()
  });
}

/**
 * El adaptador de la página para un DELEGADO, o null si esta sesión no tiene permiso
 * (entonces exporta como antes, con su firma propia). Si el permiso NO se pudo leer (red),
 * no se da por inexistente: el adaptador queda «pendiente» y lo vuelve a intentar solo
 * (revisión de `§119`, doctrina `§99`: una lectura fallida no es «no hay»).
 * @param {{alCambiar?: (motivo: {retirado: boolean}) => void}} op  se llama si el permiso
 *        llegó, cambió o se retiró (`retirado`: lo tenía y ya no)
 */
export async function adaptadorDelegado(op = {}) {
  const primera = await miDelegacionFichas();
  if (!primera) return null;
  let deleg = primera.error ? null : primera;
  let pendiente = !!primera.error;
  let ultimoIntento = Date.now();
  const avisar = (retirado) => { try { if (typeof op.alCambiar === 'function') op.alCambiar({ retirado }); } catch (_) { /* la pantalla se repinta sola */ } };
  let revisando = null;
  /** Relee el permiso (una sola lectura a la vez); si llegó, cambió o se retiró, avisa para repintar. */
  const revisar = () => (revisando = revisando || (async () => {
    const antes = deleg;
    const nueva = await miDelegacionFichas();
    ultimoIntento = Date.now();
    if (nueva && nueva.error) return deleg;          // sin conexión no se da por retirado
    pendiente = false;
    deleg = nueva;
    if ((!antes) !== (!nueva) || (antes && nueva && antes.lote !== nueva.lote)) avisar(!!antes && !nueva);
    return deleg;
  })().finally(() => { revisando = null; }));
  /** Mientras no se sepa (red), se reintenta: a los pocos segundos, al volver la conexión y al usar la ficha. */
  const reintentar = () => { if (pendiente && !revisando && Date.now() - ultimoIntento > 3000) revisar().catch(() => {}); };
  if (pendiente) {
    for (const ms of [4000, 15000, 45000]) setTimeout(reintentar, ms);
    globalThis.addEventListener('online', reintentar);
  }

  return {
    disponible() { reintentar(); return !!(deleg && getDbSafe() && sesion()); },
    /** Nombre de SU clave en la lista («CARLOS MARTELO»): con «Mi firma», su casilla se reconoce por ella (como en §117). */
    nombreEnLaLista() { return deleg && deleg.personaPropia ? nombreDePersona(deleg.personaPropia) : ''; },
    /** Las claves que el permiso no nombra no se piden al servidor: no hay firma para esta sesión. */
    async leer(id) {
      const d = deleg;
      if (!d || !puedeLeerDelegada(id, d)) return null;
      const r = await leerFirmaDelegada(d, id);
      if (r && r.denegada) { await revisar(); return null; }
      return r;
    },
    nuevaEmisionId() { return doc(collection(getDbSafe(), 'fichas_emisiones')).id; },
    async registrarEmision(id, datos) {
      // El lote se relee en CADA emisión: si el Ingeniero cambió o retiró el permiso, se nota aquí.
      const d = await revisar();
      if (!d) throw new Error('Ya no tiene permiso para usar las firmas del equipo.');
      return registrarEmisionDelegada(id, datos, d);
    }
  };
}
