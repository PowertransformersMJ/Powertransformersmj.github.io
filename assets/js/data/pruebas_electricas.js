// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: Pruebas Eléctricas
// ──────────────────────────────────────────────────────────────
// Capa de datos DESACOPLADA del módulo Mantenimiento Predictivo ·
// Pruebas Eléctricas. Reemplaza el archivo estático original por
// documentos Firestore consumidos en tiempo real (onSnapshot).
//
// Modelo:
//   /pruebas_electricas/{unidadId}             → identidad de unidad
//     · subcol /informes/{informeId}           → informe por año
//   Storage  pruebas_electricas/{unidadId}/{filename}  → PDF original
//
// Interfaz en tiempo real · SOLO datos reales:
//   · Si Firebase está configurado → onSnapshot en vivo.
//   · Si NO → se emite lista vacía. NO hay seed de demostración: la
//     vista no muestra nada hasta que el usuario suba informes.
//
// Las funciones de escritura sanitizan con el schema de dominio y
// limpian undefined/NaN con deepClean antes de persistir
// (CLAUDE.md §0.1.2.6).
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy,
  onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, getStorageSafe, getFunctionsSafe, isFirebaseConfigured } from '../firebase-init.js';
import { deepClean } from './_firestore_clean.js';
import {
  sanitizarUnidad, validarUnidad,
  sanitizarInforme, validarInforme
} from '../domain/pruebas_electricas_schema.js';

const COL_UNIDADES = 'pruebas_electricas';
const SUBCOL_INFORMES = 'informes';

/* ─── Estado de la capa ───────────────────────────────────────── */
export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

function collUnidades() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, COL_UNIDADES);
}
function unidadRef(id)  { return doc(getDbSafe(), COL_UNIDADES, id); }
function collInformes(unidadId) {
  return collection(getDbSafe(), COL_UNIDADES, unidadId, SUBCOL_INFORMES);
}

/* ─── Lectura en tiempo real ──────────────────────────────────── */

/**
 * Suscribe a la lista de unidades. Sin Firebase emite lista vacía una
 * vez (interfaz en tiempo real · solo datos reales) y devuelve un
 * unsubscribe no-op.
 * @returns {function} unsubscribe
 */
export function suscribirUnidades(onData, onError) {
  if (!isReady()) {
    Promise.resolve().then(() => onData([]));
    return () => {};
  }
  return onSnapshot(
    query(collUnidades(), orderBy('serie', 'asc')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[pruebas_electricas.suscribirUnidades]', err); }
  );
}

/**
 * Suscribe a los informes de una unidad, ordenados por año asc.
 * Sin Firebase → emite lista vacía (solo datos reales).
 * @returns {function} unsubscribe
 */
export function suscribirInformes(unidadId, onData, onError) {
  if (!isReady()) {
    Promise.resolve().then(() => onData([]));
    return () => {};
  }
  return onSnapshot(
    query(collInformes(unidadId), orderBy('ano', 'asc')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[pruebas_electricas.suscribirInformes]', err); }
  );
}

export async function obtenerUnidad(id) {
  if (!isReady()) return null;
  const s = await getDoc(unidadRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function listarInformes(unidadId) {
  if (!isReady()) return [];
  const snap = await getDocs(query(collInformes(unidadId), orderBy('ano', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ─── Escritura ───────────────────────────────────────────────── */

/** Crea/actualiza la unidad (docId = serie). */
export async function guardarUnidad(data) {
  const payload = sanitizarUnidad(data);
  const errs = validarUnidad(payload);
  if (errs.length) throw new Error('Validación unidad:\n  · ' + errs.join('\n  · '));
  payload.updatedAt = serverTimestamp();
  await setDoc(unidadRef(payload.serie), deepClean(payload), { merge: true });
  return payload.serie;
}

/** Crea un informe en la subcolección de la unidad. */
export async function crearInforme(unidadId, data, uid) {
  const payload = sanitizarInforme({ ...data, unidadId });
  const errs = validarInforme(payload);
  if (errs.length) throw new Error('Validación informe:\n  · ' + errs.join('\n  · '));
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  payload.createdBy = uid || null;
  const ref = await addDoc(collInformes(unidadId), deepClean(payload));
  return ref.id;
}

export async function actualizarInforme(unidadId, informeId, parche) {
  const payload = { ...parche };
  delete payload.createdAt;
  delete payload.createdBy;
  payload.updatedAt = serverTimestamp();
  await updateDoc(doc(getDbSafe(), COL_UNIDADES, unidadId, SUBCOL_INFORMES, informeId), deepClean(payload));
}

export async function eliminarInforme(unidadId, informeId) {
  await deleteDoc(doc(getDbSafe(), COL_UNIDADES, unidadId, SUBCOL_INFORMES, informeId));
}

/* ─── Storage · PDF original ──────────────────────────────────── */

/**
 * Sube el PDF original del informe a Firebase Storage.
 * Devuelve { storagePath, downloadURL, filename, size }.
 * Importa las funciones de Storage dinámicamente (CDN) para no
 * cargarlas si la vista no sube archivos.
 * @param {string} unidadId  serie de la unidad
 * @param {File|Blob} file    PDF a subir
 * @param {function} [onProgress] callback(pct 0..100)
 */
export async function subirPDF(unidadId, file, onProgress) {
  const storage = getStorageSafe();
  if (!storage) throw new Error('Firebase Storage no inicializado.');
  const { ref: sref, uploadBytesResumable, getDownloadURL } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
  const filename = (file && file.name) ? file.name : `informe-${Date.now()}.pdf`;
  const storagePath = `${COL_UNIDADES}/${unidadId}/${filename}`;
  const contentType = (file && file.type) || 'application/pdf';
  const task = uploadBytesResumable(sref(storage, storagePath), file, { contentType });
  return new Promise((resolve, reject) => {
    task.on('state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        resolve({ storagePath, downloadURL, filename, size: file ? file.size : null });
      }
    );
  });
}

/**
 * Descarga el binario de un informe ya almacenado para reprocesarlo
 * sin volver a subirlo. Usa `getBlob` del SDK de Storage (el mismo
 * transporte que la subida, ya autorizado) en vez de un `fetch`
 * directo de la downloadURL, que el navegador bloquea por CORS.
 * @param {string} storagePath  ruta del objeto en Storage
 * @returns {Promise<Blob>}
 */
export async function descargarBlobInforme(storagePath) {
  const storage = getStorageSafe();
  if (!storage) throw new Error('Firebase Storage no inicializado.');
  if (!storagePath) throw new Error('El informe no tiene ruta de almacenamiento.');
  const { ref: sref, getBlob } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
  return getBlob(sref(storage, storagePath));
}

/**
 * Extracción de mediciones con IA (Claude vía Cloud Function onCall). El
 * PDF ya está en Storage (subirPDF); aquí solo se pasa su ruta + el
 * modelo elegido. La función lo lee server-side, lo manda a Claude como
 * documento nativo y devuelve las mediciones en la MISMA forma que
 * consume sanitizarInforme(). Lanza si no hay backend, sin sesión, sin
 * saldo o si la IA falla — el llamador hace fallback al extractor local.
 * @param {{unidadId:string, serie:string, storagePath:string, filename?:string, modelId?:string}} payload
 * @returns {Promise<{mediciones:object, modelUsed:string, usage:object}>}
 */
export async function extraerConIA(payload) {
  if (!isReady()) throw new Error('Firebase no inicializado.');
  if (!payload || !payload.storagePath) throw new Error('Falta la ruta del PDF.');
  const functions = await getFunctionsSafe();
  if (!functions) throw new Error('Cloud Functions no disponible.');
  const { httpsCallable } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js');
  const fn = httpsCallable(functions, 'extraerPruebasElectricasIA');
  const res = await fn({
    unidadId:    payload.unidadId,
    serie:       payload.serie,
    storagePath: payload.storagePath,
    filename:    payload.filename || '',
    modelId:     payload.modelId || ''
  });
  const data = res && res.data;
  if (!data || !data.mediciones) throw new Error('La IA no devolvió mediciones.');
  return data;
}
