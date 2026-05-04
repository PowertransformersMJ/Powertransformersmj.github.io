// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Data layer: acciones de refrigeración
// ──────────────────────────────────────────────────────────────
// Persistencia de las acciones de mantenimiento del sistema de
// refrigeración generadas desde el módulo Mantenimiento Brigada
// (`pages/calculo-refrigeracion.html`). Cada documento es un
// snapshot completo del cálculo: identificación del transformador,
// parámetros (ONAN/ONAF/altitud), mix de ventiladores con cantidades,
// evaluación, protección eléctrica, BOM, compatibilidad mecánica,
// y la acción de mantenimiento con su responsable y estado.
//
// La pestaña "Consolidado Sistemas de Refrigeración" (commit 5)
// suscribe a esta colección con onSnapshot para listar todas las
// acciones registradas con filtros + KPIs + export.
// ══════════════════════════════════════════════════════════════

import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

const COL_NAME = 'acciones_refrigeracion';

/** Estados válidos del workflow de la acción. */
export const ESTADOS_ACCION = Object.freeze({
  PLANIFICADA:           'planificada',
  PENDIENTE_APROBACION:  'pendiente_aprobacion',
  APROBADA:              'aprobada',
  EJECUTADA:             'ejecutada',
  CANCELADA:             'cancelada'
});

const ESTADOS_VALIDOS = Object.values(ESTADOS_ACCION);

/** Etiqueta humanizada para el dropdown de estado. */
export function labelEstado(s) {
  return ({
    planificada:           'Planificada',
    pendiente_aprobacion:  'Pendiente de aprobación',
    aprobada:              'Aprobada',
    ejecutada:             'Ejecutada',
    cancelada:             'Cancelada'
  })[s] || s;
}

function collRef() {
  const db = getDbSafe();
  if (!db) throw new Error('Firebase no inicializado.');
  return collection(db, COL_NAME);
}
function docRef(id) { return doc(getDbSafe(), COL_NAME, id); }

export function isReady() {
  return isFirebaseConfigured && !!getDbSafe();
}

/**
 * Sanitiza el payload antes de persistir. Devuelve un objeto limpio
 * con valores por defecto + clamp de números a rangos razonables.
 */
function sanitizar(data) {
  const s = (v) => (v == null ? '' : String(v).trim());
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const arr = (v) => Array.isArray(v) ? v : [];
  return {
    transformador_id: s(data.transformador_id),
    matricula:        s(data.matricula),
    proyecto:         s(data.proyecto),
    subestacion:      s(data.subestacion),
    zona:             s(data.zona),
    departamento:     s(data.departamento),
    grupo:            s(data.grupo),
    serie:            s(data.serie),
    refrigeracion:   s(data.refrigeracion),

    kva_onan:        n(data.kva_onan),
    kva_onaf:        n(data.kva_onaf),
    pct:             n(data.pct),
    altitud:         n(data.altitud),
    cfm_requerido:   n(data.cfm_requerido),
    cfm_corregido:   n(data.cfm_corregido),

    mix:           arr(data.mix),                  // Array<{key, marca, modelo, cfm_unitario, cantidad, ficha}>
    evaluacion:    data.evaluacion || null,         // Objeto evaluarMixVentiladores
    proteccion:    data.proteccion || null,         // Objeto calcularProteccionMix
    compatibilidad: data.compatibilidad || null,    // Objeto evaluarCompatibilidad
    faltantes:     arr(data.faltantes),             // Array<{key, modelo, marca, campo, severidad, sustituto, mensaje}> (microfase 4)
    resumen_json:  data.resumen_json || null,        // Snapshot estructurado conforme prompt técnico (microfase 5)
    validacion_grafica: data.validacion_grafica || null,  // Resultado de validarPuntoOperacion (microfase 6)
    radiador:      data.radiador     || null,
    motoventilador_principal: data.motoventilador_principal || null,
    montaje:       data.montaje      || null,

    accion_descripcion: s(data.accion_descripcion),
    estado_accion:      ESTADOS_VALIDOS.includes(data.estado_accion)
                          ? data.estado_accion : ESTADOS_ACCION.PLANIFICADA,
    fecha_accion:        s(data.fecha_accion),       // ISO date 'YYYY-MM-DD'
    fecha_ejecucion:     s(data.fecha_ejecucion),
    observaciones:       s(data.observaciones),

    responsable_uid:    s(data.responsable_uid),
    responsable_nombre: s(data.responsable_nombre),
    responsable_email:  s(data.responsable_email)
  };
}

/**
 * Validación mínima requerida por las rules + UX. Devuelve array
 * de errores (vacío = OK).
 */
export function validar(data) {
  const errs = [];
  if (!data.transformador_id) errs.push('transformador_id es obligatorio');
  if (!data.matricula)        errs.push('matrícula del transformador es obligatoria');
  if (!data.accion_descripcion || data.accion_descripcion.length < 10) {
    errs.push('accion_descripcion debe tener al menos 10 caracteres');
  }
  if (!ESTADOS_VALIDOS.includes(data.estado_accion)) {
    errs.push('estado_accion inválido');
  }
  if (!data.fecha_accion) errs.push('fecha_accion es obligatoria');
  if (!Array.isArray(data.mix) || data.mix.length === 0) {
    errs.push('mix debe contener al menos un modelo de ventilador');
  }
  return errs;
}

export async function listar(filtros = {}) {
  const constraints = [];
  if (filtros.transformador_id) constraints.push(where('transformador_id', '==', filtros.transformador_id));
  if (filtros.subestacion)      constraints.push(where('subestacion',      '==', filtros.subestacion));
  if (filtros.estado_accion)    constraints.push(where('estado_accion',    '==', filtros.estado_accion));
  if (filtros.responsable_uid)  constraints.push(where('responsable_uid',  '==', filtros.responsable_uid));
  constraints.push(orderBy('fecha_accion', 'desc'));
  if (filtros.limite)           constraints.push(limit(filtros.limite));
  const snap = await getDocs(query(collRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function suscribir(filtros = {}, onData, onError) {
  const constraints = [];
  if (filtros.transformador_id) constraints.push(where('transformador_id', '==', filtros.transformador_id));
  if (filtros.subestacion)      constraints.push(where('subestacion',      '==', filtros.subestacion));
  if (filtros.estado_accion)    constraints.push(where('estado_accion',    '==', filtros.estado_accion));
  if (filtros.responsable_uid)  constraints.push(where('responsable_uid',  '==', filtros.responsable_uid));
  constraints.push(orderBy('fecha_accion', 'desc'));
  if (filtros.limite)           constraints.push(limit(filtros.limite));
  return onSnapshot(
    query(collRef(), ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err)  => { if (onError) onError(err); else console.warn('[acciones_refrigeracion.suscribir]', err); }
  );
}

export async function obtener(id) {
  const s = await getDoc(docRef(id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function crear(data, uid) {
  const payload = sanitizar(data);
  const errs = validar(payload);
  if (errs.length) throw new Error('Validación acción de refrigeración:\n  · ' + errs.join('\n  · '));
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  payload.createdBy = uid || payload.responsable_uid || null;
  const ref = await addDoc(collRef(), payload);
  return ref.id;
}

export async function actualizar(id, parche) {
  const payload = { ...parche };
  // No tocar campos sensibles
  delete payload.createdAt;
  delete payload.createdBy;
  delete payload.transformador_id;
  // Validar el estado si viene
  if (payload.estado_accion && !ESTADOS_VALIDOS.includes(payload.estado_accion)) {
    throw new Error('estado_accion inválido');
  }
  payload.updatedAt = serverTimestamp();
  await updateDoc(docRef(id), payload);
}

export async function actualizarEstado(id, estado, observaciones) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw new Error('estado_accion inválido');
  }
  const parche = { estado_accion: estado };
  if (observaciones !== undefined) parche.observaciones = observaciones;
  if (estado === ESTADOS_ACCION.EJECUTADA) {
    parche.fecha_ejecucion = new Date().toISOString().slice(0, 10);
  }
  await actualizar(id, parche);
}

export async function eliminar(id) {
  await deleteDoc(docRef(id));
}
