// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: carga «solo gases» (ppm de la última DGA) · `99 §131`
// ──────────────────────────────────────────────────────────────
// Escribe SOLO `ultima_dga` (+ updatedAt) en cada transformador del plan, con update: reemplaza ese mapa y no toca
// `salud_actual` ni ninguna calificación. No crea documentos en /muestras (eso dispararía el recálculo de salud que
// borra la calificación de cargabilidad, TODO-64.b). Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { collection, doc, addDoc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';
import { auditar } from '../domain/audit.js';

const LOTE = 450;

export function isReady() { return isFirebaseConfigured && !!getDbSafe(); }

/**
 * @param {Array<{id:string, matricula:string, ultima_dga:object}>} escribir  `planCargaGases(...).escribir`
 * @param {{uid?:string, archivo?:string, onProgress?:Function}} opts
 * @returns {Promise<{escritos:number}>}
 */
export async function escribirUltimasDga(escribir, { uid = '', archivo = '', onProgress } = {}) {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  let escritos = 0;
  for (let i = 0; i < escribir.length; i += LOTE) {
    const batch = writeBatch(db);
    for (const x of escribir.slice(i, i + LOTE)) {
      batch.update(doc(db, 'transformadores', x.id), { ultima_dga: x.ultima_dga, updatedAt: serverTimestamp() });
    }
    await batch.commit();
    escritos += Math.min(LOTE, escribir.length - i);
    if (onProgress) onProgress({ escritos, total: escribir.length });
  }
  try {
    await addDoc(collection(db, 'auditoria'), {
      ...auditar({ accion: 'cargar_gases_dga', coleccion: 'transformadores', docId: '', uid,
        nota: `${archivo} — ppm de la última DGA en ${escritos} transformadores (solo el campo ultima_dga)` }),
      at: serverTimestamp(),
    });
  } catch (_) { /* el registro es de mejor esfuerzo, como en la importación */ }
  return { escritos };
}
