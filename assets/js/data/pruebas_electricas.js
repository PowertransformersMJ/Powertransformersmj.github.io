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
import { sanitizarBloques } from '../domain/pruebas_electricas_bloques.js';

const COL_UNIDADES = 'pruebas_electricas';
const SUBCOL_INFORMES = 'informes';
const SUBCOL_DIAG = 'diagnostico';

// Diagnóstico de extracción (ADR-007): bloques + interpretación CRUDA de la IA
// viven en una subcolección perezosa del informe (NO en Storage: el bucket no
// tiene CORS para lectura desde el navegador, y NO en el doc del informe: lo
// inflaría en la suscripción viva de la matriz). Se lee solo al abrir el
// análisis (getDoc), nunca en el onSnapshot de la lista.
const diagRef = (unidadId, informeId) =>
  doc(getDbSafe(), COL_UNIDADES, unidadId, SUBCOL_INFORMES, informeId, SUBCOL_DIAG, 'ia');

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
  // Firestore no cascadea subcolecciones: borrar el diagnóstico (ADR-007)
  // primero para no dejar un doc huérfano. Best-effort: no bloquea el borrado.
  await deleteDoc(diagRef(unidadId, informeId)).catch(() => {});
  await deleteDoc(doc(getDbSafe(), COL_UNIDADES, unidadId, SUBCOL_INFORMES, informeId));
}

/**
 * Borra UN PDF puntual de Storage por su `storagePath` (best-effort). Se usa al
 * REEMPLAZAR un informe (upsert por fecha) para no dejar el PDF viejo huérfano.
 * @param {string} storagePath
 */
export async function eliminarPDF(storagePath) {
  if (!storagePath) return;
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    const { ref: sref, deleteObject } =
      await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
    await deleteObject(sref(storage, storagePath));
  } catch (err) {
    console.warn('[pruebas_electricas.eliminarPDF]', err);
  }
}

/**
 * Elimina una UNIDAD completa (un "libro"): todos sus informes, los PDF
 * originales en Storage (carpeta pruebas_electricas/{unidadId}/) y el doc
 * de la unidad. Operación admin (las rules exigen isAdmin()). Irreversible.
 * @param {string} unidadId  serie / docId de la unidad
 */
export async function eliminarUnidad(unidadId) {
  if (!isReady()) throw new Error('Firebase no inicializado.');
  if (!unidadId) throw new Error('Falta el id de la unidad.');
  // 1) Borra todos los informes de la subcolección + su diagnóstico (ADR-007:
  //    Firestore no cascadea subcolecciones, así que el doc diagnostico/ia se
  //    borra explícitamente para no quedar huérfano).
  const snap = await getDocs(collInformes(unidadId));
  await Promise.all(snap.docs.flatMap((d) => [
    deleteDoc(diagRef(unidadId, d.id)).catch(() => {}),
    deleteDoc(d.ref)
  ]));
  // 2) Borra los PDF originales en Storage (toda la carpeta de la unidad).
  const storage = getStorageSafe();
  if (storage) {
    try {
      const { ref: sref, listAll, deleteObject } =
        await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
      const carpeta = sref(storage, `${COL_UNIDADES}/${unidadId}`);
      const listado = await listAll(carpeta);
      await Promise.all(listado.items.map((it) => deleteObject(it).catch(() => {})));
    } catch (err) {
      // Storage es secundario: si falla la limpieza de PDF, igual se borra
      // el doc (no bloquear la eliminación de la unidad por un PDF huérfano).
      console.warn('[pruebas_electricas.eliminarUnidad] limpieza Storage', err);
    }
  }
  // 3) Borra el doc de la unidad.
  await deleteDoc(unidadRef(unidadId));
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

/* ─── Diagnóstico de extracción (bloques + interpretación cruda, ADR-007) ─── */

/**
 * Persiste el diagnóstico de extracción de un informe en Firestore
 * (subcolección perezosa `diagnostico/ia`): los bloques sanitizados + la
 * interpretación CRUDA de la IA (mediciones, resumen de conteos, modelo,
 * usage) para poder comparar "lo que el PDF dice ↔ lo que Claude interpretó ↔
 * lo que se grafica". Se escribe SIEMPRE que la IA corrió — aunque no haya
 * bloques útiles — porque un diagnóstico vacío también es señal (revela que la
 * IA no produjo gráficas). NO va a Storage (CORS) ni al doc del informe (lo
 * inflaría en la suscripción viva).
 * @param {string} unidadId
 * @param {string} informeId  id del doc del informe (de crearInforme)
 * @param {Array}  bloquesRaw arreglo crudo de bloques (de la IA)
 * @param {{modelo?:string, usage?:object, resumen?:object, mediciones_raw?:object}} [diag]
 * @returns {Promise<{count:number}>}
 */
export async function guardarBloques(unidadId, informeId, bloquesRaw, diag) {
  if (!isReady()) throw new Error('Firebase no inicializado.');
  if (!unidadId || !informeId) throw new Error('Falta unidadId o informeId.');
  const limpio = sanitizarBloques(bloquesRaw);
  const d = diag || {};
  // Firestore NO admite arrays anidados (L-30), y `bloques[].tabla.filas` es
  // array de arrays. Se serializa TODO el diagnóstico a un string JSON en un
  // solo campo → inmune a arrays anidados/undefined, y sigue en Firestore (sin
  // CORS). El render lo re-parsea a la lectura.
  const payload = {
    schema_version: limpio.schema_version,
    bloques: limpio.bloques,
    modelo: d.modelo || null,
    usage: d.usage || null,
    resumen: d.resumen || null,
    mediciones_raw: d.mediciones_raw || null
  };
  await setDoc(diagRef(unidadId, informeId), {
    payload: JSON.stringify(payload),
    n_bloques: limpio.bloques.length,
    ts: serverTimestamp()
  });
  return { count: limpio.bloques.length };
}

/**
 * Carga perezosa del diagnóstico de un informe desde Firestore (sin CORS).
 * Re-sanitiza los bloques a la lectura (defensa en profundidad). Devuelve
 * `{schema_version, bloques, modelo, usage, resumen, mediciones_raw}` o null
 * si el informe no tiene diagnóstico (previo a ADR-007 o sin extracción IA).
 * @param {string} unidadId
 * @param {string} informeId
 * @returns {Promise<object|null>}
 */
export async function cargarBloques(unidadId, informeId) {
  if (!isReady() || !unidadId || !informeId) return null;
  try {
    const snap = await getDoc(diagRef(unidadId, informeId));
    if (!snap.exists()) return null;
    const d = snap.data() || {};
    // Compat: payload nuevo (string JSON, L-30) o formato previo (campos sueltos).
    let p = d;
    if (typeof d.payload === 'string') {
      try { p = JSON.parse(d.payload); } catch { p = {}; }
    }
    const limpio = sanitizarBloques(p.bloques);
    return {
      schema_version: limpio.schema_version,
      bloques: limpio.bloques,
      modelo: p.modelo || null,
      usage: p.usage || null,
      resumen: p.resumen || null,
      mediciones_raw: p.mediciones_raw || null
    };
  } catch (err) {
    console.warn('[pruebas_electricas.cargarBloques]', err);
    return null;
  }
}

/**
 * Extracción de mediciones con IA (Claude vía Cloud Function onCall). El
 * PDF ya está en Storage (subirPDF); aquí solo se pasa su ruta + el
 * modelo elegido. La función lo lee server-side, lo manda a Claude como
 * documento nativo y devuelve las mediciones en la MISMA forma que
 * consume sanitizarInforme(). Lanza si no hay backend, sin sesión, sin
 * saldo o si la IA falla — el llamador hace fallback al extractor local.
 * Con `informeId` la función opera en MODO REPROCESO (ADR-016): persiste el
 * resultado server-side y escribe el estado durable en el informe; devuelve un
 * ack `{persisted, estado, n_bloques}` (sin `mediciones`, el cliente NO guarda).
 * Sin `informeId` = MODO CARGA: devuelve los datos crudos para que el cliente
 * persista con su lógica de upsert/confirmación.
 * @param {{unidadId:string, serie:string, storagePath:string, filename?:string, modelId?:string, informeId?:string}} payload
 * @returns {Promise<object>}
 */
export async function extraerConIA(payload) {
  if (!isReady()) throw new Error('Firebase no inicializado.');
  if (!payload || !payload.storagePath) throw new Error('Falta la ruta del PDF.');
  const functions = await getFunctionsSafe();
  if (!functions) throw new Error('Cloud Functions no disponible.');
  const { httpsCallable } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js');
  // timeout explícito (25 min, ADR-019): a máxima calidad (effort:high) un escaneo
  // denso supera los 12–13 min; con 15 min el cliente daba deadline-exceeded. Debe
  // ser ≥ el timeoutSeconds de la función (1500 s) para esperar al servidor. El
  // reproceso es no bloqueante (badge durable) → la espera larga no congela la UI.
  const fn = httpsCallable(functions, 'extraerPruebasElectricasIA', { timeout: 1500000 });
  const res = await fn({
    unidadId:    payload.unidadId,
    serie:       payload.serie,
    storagePath: payload.storagePath,
    filename:    payload.filename || '',
    modelId:     payload.modelId || '',
    informeId:   payload.informeId || ''
  });
  const data = res && res.data;
  if (!data) throw new Error('La función no devolvió datos.');
  // Modo reproceso: ack server-side (sin mediciones). Modo carga: exige mediciones.
  if (!payload.informeId && !data.mediciones) throw new Error('La IA no devolvió mediciones.');
  return data;
}

/**
 * Narrativa de tendencia con IA (F3 · Cloud Function narrativaTendenciaIA). NO
 * sube PDFs: recibe el resumen YA extraído (resumenTendenciaParaIA) y devuelve
 * un texto con el diagnóstico de evolución. Entrada chica → timeout corto.
 * Lanza si no hay backend, sin sesión, o si la IA falla (el llamador lo muestra).
 * @param {{serie?:string, metricas:Array, modelId?:string}} payload
 * @returns {Promise<{narrativa:string, modelUsed:string, usage:object}>}
 */
export async function narrarTendencia(payload) {
  if (!isReady()) throw new Error('Firebase no inicializado.');
  if (!payload || !Array.isArray(payload.metricas) || !payload.metricas.length) {
    throw new Error('Sin datos de tendencia para narrar.');
  }
  const functions = await getFunctionsSafe();
  if (!functions) throw new Error('Cloud Functions no disponible.');
  const { httpsCallable } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js');
  // timeout explícito 120 s (default del SDK 70 s): igual al timeoutSeconds de
  // la función. Entrada chica, pero el modelo puede tardar en redactar.
  const fn = httpsCallable(functions, 'narrativaTendenciaIA', { timeout: 120000 });
  const res = await fn({
    serie:    payload.serie || '',
    metricas: payload.metricas,
    modelId:  payload.modelId || ''
  });
  const data = res && res.data;
  if (!data || !data.narrativa) throw new Error('La IA no devolvió narrativa.');
  return data;
}
