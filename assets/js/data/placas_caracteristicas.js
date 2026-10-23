// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — PLACA CARACTERÍSTICA (I/O) · TODO-69
// ──────────────────────────────────────────────────────────────
// Firestore `placas_caracteristicas/{idTransformador}` (lo leído de la placa + meta de la foto) y
// `partes/{0..2}` (la foto JPEG en trozos ≤ 900 KB atados por `lote`). Solo LECTURA desde la página;
// la carga la hace el administrador. Por qué Firestore y no Storage: Storage niega las descargas al
// navegador en producción (`99 §100`). «No hay» ≠ «no se pudo leer». Caché en memoria por huella.
// Archivo NUEVO (L-102); lo carga el panel con import().
// ══════════════════════════════════════════════════════════════

import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe } from '../firebase-init.js';
import { COLECCION, PARTES_MAX, unir } from '../domain/placa_caracteristica.js';

const idValido = (id) => /^[A-Za-z0-9_-]{6,64}$/.test(String(id || ''));

/** La placa leída del equipo: {hay:false} · {hay:true, placa} · {error:true, mensaje}. */
export async function leerPlaca(idTx) {
  const db = getDbSafe();
  if (!db || !idValido(idTx)) return { error: true, mensaje: 'Sin conexión con la base de datos.' };
  try {
    const snap = await getDoc(doc(db, COLECCION, idTx));
    return snap.exists() ? { hay: true, placa: snap.data() } : { hay: false };
  } catch (e) {
    console.warn('[placa] meta:', (e && e.code) || e);
    if (e && /permission-denied/.test(String(e.code))) return { error: true, mensaje: 'Sin permiso para leer la placa (la sesión venció o no tiene acceso). Recargue la página.' };
    return { error: true, mensaje: 'No se pudo leer la placa (revise la conexión).' };
  }
}

async function huella(bytes) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const cache = new Map();   // id → {huella, bytes}

/** Los bytes de la foto, verificados (mismo lote y misma huella): {bytes} · {error:true, mensaje}. */
export async function leerFoto(idTx, foto) {
  const c = cache.get(idTx);
  if (c && foto && c.huella === foto.huella) return { bytes: c.bytes };
  const db = getDbSafe();
  if (!db || !foto || !idValido(idTx)) return { error: true, mensaje: 'Sin foto.' };
  try {
    const n = Math.max(1, Math.min(PARTES_MAX, +foto.partes || 1));
    const snaps = await Promise.all(Array.from({ length: n }, (_, i) => getDoc(doc(db, COLECCION, idTx, 'partes', String(i)))));
    const partes = [];
    for (const s of snaps) {
      const d = s.exists() ? s.data() : null;
      if (!d || d.lote !== foto.lote || !d.bytes || typeof d.bytes.toUint8Array !== 'function') return { error: true, mensaje: 'La foto guardada está incompleta.' };
      partes.push(d.bytes.toUint8Array());
    }
    const bytes = unir(partes);
    if (foto.huella && await huella(bytes) !== foto.huella) return { error: true, mensaje: 'La foto guardada no coincide con su huella.' };
    cache.set(idTx, { huella: foto.huella, bytes });
    return { bytes };
  } catch (e) {
    console.warn('[placa] foto:', (e && e.code) || e);
    return { error: true, mensaje: 'No se pudo leer la foto de la placa (revise la conexión).' };
  }
}
