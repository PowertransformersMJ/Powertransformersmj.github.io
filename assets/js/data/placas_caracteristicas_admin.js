// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — PLACA CARACTERÍSTICA · escritura (solo administrador) · TODO-69, ADR-166
// ──────────────────────────────────────────────────────────────
// UNA placa por lote: su meta (firmada: carga.por = uid, carga.en = hora del servidor, carga.paquete NUEVO), sus 3
// espacios de parte (escritos o borrados) y su registro de solo agregar. La regla exige todo junto (firestore.rules).
// La simulación compara por huellas (foto y datos), no por el orden de los campos. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { doc, getDoc, writeBatch, serverTimestamp, Bytes } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { COLECCION } from '../domain/placa_caracteristica.js';

export const COLECCION_REGISTRO = 'placas_caracteristicas_registro';

/** ¿Quien tiene la sesión es administrador activo? (la regla lo vuelve a exigir) */
export function esAdministrador() {
  const s = getSession(); const p = (s && s.profile) || {};
  return !!(getDbSafe() && s && s.user && s.user.uid && p.rol === 'admin' && p.activo !== false);
}

/** Lo que hay hoy de una placa: {hay:false} · {hay:true, huella, huellaDatos, paquete} · {error:true, codigo}. */
export async function estadoActual(id) {
  try {
    const snap = await getDoc(doc(getDbSafe(), COLECCION, id));
    if (!snap.exists()) return { hay: false };
    const m = snap.data();
    return { hay: true, huella: (m.foto && m.foto.huella) || null, huellaDatos: (m.fuente && m.fuente.huella_datos) || null, paquete: (m.carga && m.carga.paquete) || null };
  } catch (e) { return { error: true, codigo: (e && e.code) || String(e) }; }
}

/**
 * Guarda las placas, UNA por lote, en orden.
 * @param {Array<{id, matricula, meta, partes: Uint8Array[], reemplazo: boolean}>} placas
 * @param {{paquete: string, alAvanzar?: (hechas:number, total:number) => void}} op  paquete: id único de esta carga
 * @returns {Promise<{escritas: string[], fallos: Array<{id, motivo}>}>}
 */
export async function guardarPlacas(placas, { paquete, alAvanzar = () => {} }) {
  const db = getDbSafe(); const s = getSession();
  if (!db || !esAdministrador()) throw new Error('Solo un administrador puede cargar las placas.');
  if (!/^[A-Za-z0-9-]{4,40}$/.test(String(paquete))) throw new Error('Identificador de carga inválido.');
  const uid = s.user.uid; const escritas = []; const fallos = [];
  let k = 0;
  for (const p of placas) {
    const lote = writeBatch(db);
    const foto = p.meta.foto || null;
    lote.set(doc(db, COLECCION, p.id), { ...p.meta, carga: { por: uid, en: serverTimestamp(), paquete } });
    for (let n = 0; n < 3; n++) {
      const ref = doc(db, COLECCION, p.id, 'partes', String(n));
      if (foto && n < p.partes.length) lote.set(ref, { bytes: Bytes.fromUint8Array(p.partes[n]), lote: foto.lote });
      else lote.delete(ref);
    }
    lote.set(doc(db, COLECCION_REGISTRO, p.id + '_' + paquete), {
      idPlaca: p.id, accion: p.reemplazo ? 'reemplazo' : 'alta', paquete, matricula: String(p.matricula || '').slice(0, 40),
      huella: (foto && foto.huella) || 'sinfoto', huellaDatos: p.meta.fuente.huella_datos, por: uid, en: serverTimestamp()
    });
    try { await lote.commit(); escritas.push(p.id); }
    catch (e) { fallos.push({ id: p.id, motivo: (e && e.code) || String(e) }); }
    alAvanzar(++k, placas.length);
  }
  return { escritas, fallos };
}
