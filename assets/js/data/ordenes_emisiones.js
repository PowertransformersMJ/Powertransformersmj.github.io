// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Entrada/Salida · registro de emisiones con firmas del equipo (I/O)
// ──────────────────────────────────────────────────────────────
// Cada PDF o Excel de una orden que lleva firmas del directorio del custodio
// queda en `ordenes_emisiones/{folio}` (SOLO se agrega): qué orden, qué formato,
// qué firmas (con su huella) y la huella del archivo entregado. Es la misma
// trazabilidad que Fichas (`fichas_emisiones`, `99 §108`), en su propia
// colección porque aquel registro solo admite el formato PE.02081.
// Reglas y pruebas: firestore.rules, tests-rules/ordenes_emisiones.rules.test.js.
// Sin registro no se descarga con firmas del equipo (la página pregunta y, si
// se acepta, sale solo con la firma propia, sin folio).
// Este módulo se carga con import() dinámico desde la página, solo para admin.
// ══════════════════════════════════════════════════════════════

import { collection, doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';

const COLECCION = 'ordenes_emisiones';

/** Sesión VIVA con perfil REAL de administrador activo (la regla lo vuelve a exigir). */
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

/** ¿Quien tiene la sesión puede registrar emisiones? */
export function puedeRegistrar() { return !!(getDbSafe() && custodio()); }

/** Id nuevo (de Firestore) para la emisión que se va a registrar. */
export function nuevaEmisionOrdenId() { return doc(collection(getDbSafe(), COLECCION)).id; }

/** Nombre vigente del perfil: la regla lo compara con /usuarios/{uid}.nombre. */
async function nombreVigente(c) {
  try {
    const snap = await getDoc(doc(getDbSafe(), 'usuarios', c.uid));
    return (snap.exists() && snap.data().nombre) || c.nombre || '';
  } catch (_) { return c.nombre || ''; }
}

/**
 * Registra una emisión con firmas del equipo. Si falla, lanza.
 * @param {string} id
 * @param {{orden: object, formato: ('pdf'|'xlsx'), casillas: Array<{rol, persona, nombre, origen, huella}>, huellaArchivo: string}} datos
 */
export async function registrarEmisionOrden(id, { orden, formato, casillas, huellaArchivo }) {
  const c = custodio();
  if (!c) throw new Error('Sin sesión de administrador.');
  const o = orden || {};
  await setDoc(doc(getDbSafe(), COLECCION, id), {
    orden: { tipo: String(o.tipo || ''), numero: String(o.numero || ''), zona: String(o.zona || ''), fecha: String(o.fecha || '') },
    documento: 'IT.05801',
    formato,
    casillas: (casillas || []).map((x) => ({
      rol: String(x.rol || ''), persona: String(x.persona || ''), nombre: String(x.nombre || ''), origen: String(x.origen || ''), huella: String(x.huella || '')
    })),
    huellaArchivo,
    custodio: c.uid,
    custodioNombre: await nombreVigente(c),
    en: serverTimestamp()
  });
}
