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
// Diseño adaptable a fuente local o Firestore:
//   · Si Firebase está configurado → onSnapshot en vivo.
//   · Si NO → cae a un seed local (SEED_LOCAL) replicando la unidad
//     173523-15510 del tablero original, para que la vista funcione
//     sin backend y los tests no requieran red.
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

import { getDbSafe, getStorageSafe, isFirebaseConfigured } from '../firebase-init.js';
import { deepClean } from './_firestore_clean.js';
import {
  sanitizarUnidad, validarUnidad,
  sanitizarInforme, validarInforme
} from '../domain/pruebas_electricas_schema.js';

const COL_UNIDADES = 'pruebas_electricas';
const SUBCOL_INFORMES = 'informes';

/* ─── Seed local · unidad real 173523-15510 del tablero ───────── */
// Solo se usa cuando Firebase NO está configurado. Mantiene la vista
// operativa offline y alimenta los tests de integración con un mock
// determinístico (mismos números que las gráficas del tablero).
export const SEED_LOCAL = Object.freeze({
  unidad: sanitizarUnidad({
    serie: '173523-15510',
    fabricante: 'Siemens',
    ano_fabricacion: 1998,
    potencia: '22.5 / 30 MVA',
    tensiones: '110/34.5/13.8 kV',
    grupo_conexion: 'YNyn0d1',
    refrigeracion: 'ONAN/ONAF',
    frecuencia: '60 Hz · 3φ',
    cliente: 'Electricaribe',
    ubicacion: 'S/E La Jagua, Cesar',
    subestacion: 'La Jagua'
  }),
  informes: [2012, 2014, 2020].map((ano, i) => sanitizarInforme({
    unidadId: '173523-15510',
    serie: '173523-15510',
    ano,
    tand: [
      { code: 'CH',  valor_pct: [0.39, 0.42, 0.146][i] },
      { code: 'CHL', valor_pct: [0.27, 0.34, 0.100][i] },
      { code: 'CL',  valor_pct: [1.23, 1.52, 0.192][i] },
      { code: 'CLT', valor_pct: [0.24, 0.32, 0.089][i] },
      { code: 'CT',  valor_pct: [0.49, 0.67, 0.334][i] },
      { code: 'CHT', valor_pct: [0.54, 0.66, 0.054][i] }
    ],
    excitacion:  { delta_pct: [4.41, 4.83, 3.02][i], corriente_ma: 12 },
    relacion:    { desviacion_pct: [0.13, 0.31, 0.23][i] },
    resistencia: { desbalance_pct: [2, 3, null][i], verificar: i === 2 },
    aislamiento: { gohm: [null, 2.5, null][i] },
    collar:      { mw: [49, 56, 57.9][i] }
  }))
});

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
 * Suscribe a la lista de unidades. Si no hay Firebase, emite el seed
 * local una vez y devuelve un unsubscribe no-op.
 * @returns {function} unsubscribe
 */
export function suscribirUnidades(onData, onError) {
  if (!isReady()) {
    Promise.resolve().then(() => onData([{ id: SEED_LOCAL.unidad.serie, ...SEED_LOCAL.unidad }]));
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
 * Sin Firebase → emite el seed local de esa serie.
 * @returns {function} unsubscribe
 */
export function suscribirInformes(unidadId, onData, onError) {
  if (!isReady()) {
    Promise.resolve().then(() => onData(
      SEED_LOCAL.informes
        .filter((r) => !unidadId || r.serie === unidadId)
        .map((r, i) => ({ id: `seed-${r.ano}-${i}`, ...r }))
    ));
    return () => {};
  }
  return onSnapshot(
    query(collInformes(unidadId), orderBy('ano', 'asc')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[pruebas_electricas.suscribirInformes]', err); }
  );
}

export async function obtenerUnidad(id) {
  if (!isReady()) {
    return id === SEED_LOCAL.unidad.serie
      ? { id, ...SEED_LOCAL.unidad } : null;
  }
  const s = await getDoc(unidadRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function listarInformes(unidadId) {
  if (!isReady()) {
    return SEED_LOCAL.informes
      .filter((r) => !unidadId || r.serie === unidadId)
      .map((r, i) => ({ id: `seed-${r.ano}-${i}`, ...r }));
  }
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
  const task = uploadBytesResumable(sref(storage, storagePath), file, { contentType: 'application/pdf' });
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
