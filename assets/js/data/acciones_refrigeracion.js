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
import { deepClean } from './_firestore_clean.js';

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

/**
 * Catálogo de justificaciones para registrar una NUEVA acción sobre
 * un transformador que YA tiene acciones registradas. Sin alguna de
 * estas justificaciones, el modal bloquea el guardado para evitar
 * duplicados accidentales.
 */
export const JUSTIFICACIONES_REREGISTRO = Object.freeze({
  UNIDAD_AVERIADA:       'unidad_refrigeracion_averiada',
  REEMPLAZO_GARANTIA:    'reemplazo_por_garantia',
  MANTENIMIENTO_RECURRENTE: 'mantenimiento_programado_recurrente',
  CAMBIO_DISENO:         'cambio_de_diseno',
  ACTUALIZACION_TECNICA: 'actualizacion_tecnica',
  OTRO:                  'otro'
});

const JUSTIFICACIONES_VALIDAS = Object.values(JUSTIFICACIONES_REREGISTRO);

/** Etiqueta humanizada de la justificación para mostrar en UI. */
export function labelJustificacionRereg(j) {
  return ({
    unidad_refrigeracion_averiada:        'Unidad de refrigeración averiada',
    reemplazo_por_garantia:               'Reemplazo por reclamación de garantía',
    mantenimiento_programado_recurrente:  'Mantenimiento programado recurrente',
    cambio_de_diseno:                     'Cambio de diseño / repotenciación',
    actualizacion_tecnica:                'Actualización técnica del sistema',
    otro:                                 'Otro (especificar en el detalle)'
  })[j] || j;
}

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
 * Verifica si el UID dado tiene permisos de admin según las rules
 * de Firestore. Devuelve `{ok: bool, motivo: string, perfil: obj}`
 * con diagnóstico accionable. Útil para mostrar mensaje claro al
 * usuario ANTES de intentar el write y obtener un genérico
 * "permission-denied".
 *
 * Las rules consideran admin a:
 *   · `/usuarios/{uid}` con `rol == 'admin'` y `activo == true`, O
 *   · `/admins/{uid}` con cualquier doc (bootstrap legacy)
 */
export async function verificarPermisosAdmin(uid) {
  if (!uid) {
    return { ok: false, motivo: 'no_logueado', perfil: null,
      mensaje: 'No hay sesión Firebase activa. Inicie sesión y vuelva a intentar.' };
  }
  const db = getDbSafe();
  if (!db) {
    return { ok: false, motivo: 'firebase_no_init', perfil: null,
      mensaje: 'Firebase no está inicializado en esta sesión.' };
  }
  // Caso A · perfil en /usuarios/{uid} con rol admin activo
  let perfilUsuarios = null;
  try {
    const snapU = await getDoc(doc(db, 'usuarios', uid));
    if (snapU.exists()) {
      perfilUsuarios = snapU.data();
      if (perfilUsuarios.rol === 'admin' && perfilUsuarios.activo === true) {
        return { ok: true, motivo: 'admin_via_usuarios', perfil: perfilUsuarios,
          mensaje: 'Admin verificado vía /usuarios/{uid}.' };
      }
    }
  } catch (err) {
    // Las rules pueden bloquear lectura cruzada de /usuarios; si falla
    // por permission-denied, intentamos el bootstrap legacy.
    console.warn('[verificarPermisosAdmin] /usuarios lectura falló:', err);
  }
  // Caso B · bootstrap legacy en /admins/{uid}
  try {
    const snapA = await getDoc(doc(db, 'admins', uid));
    if (snapA.exists()) {
      return { ok: true, motivo: 'admin_via_admins_bootstrap', perfil: snapA.data(),
        mensaje: 'Admin verificado vía bootstrap legacy /admins/{uid}.' };
    }
  } catch (err) {
    console.warn('[verificarPermisosAdmin] /admins lectura falló:', err);
  }
  // No es admin
  if (perfilUsuarios) {
    return {
      ok: false, motivo: 'no_admin', perfil: perfilUsuarios,
      mensaje: `Su usuario existe en /usuarios/{${uid}} pero NO tiene rol admin (rol actual: "${perfilUsuarios.rol || 'sin definir'}", activo: ${perfilUsuarios.activo === true ? 'sí' : 'no'}). Pida al administrador que actualice su perfil con rol='admin' y activo=true.`
    };
  }
  return {
    ok: false, motivo: 'sin_perfil', perfil: null,
    mensaje: `Su sesión Firebase (UID: ${uid}) NO tiene perfil en /usuarios/{uid} ni en /admins/{uid}. Pida al administrador que cree su perfil con rol='admin'.`
  };
}

// `deepClean` se importa de `./_firestore_clean.js` · es la
// función pura que elimina undefined/NaN de objetos anidados antes
// de persistir en Firestore. Ver CLAUDE.md §0.1.2.6 (regla
// permanente desde 2026-05-03).

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

    mix:           arr(data.mix),                  // Array<{key, marca, modelo, cfm_unitario, cantidad, disposicion, ubicacion:{lado,cuerpo,posicion}, ficha}>
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
    responsable_email:  s(data.responsable_email),

    // Anti-duplicado · si esta es una NUEVA acción para un
    // transformador que ya tenía registros, debe llevar la
    // justificación de re-registro (regla anti-duplicado 2026-05-04).
    es_re_registro:           !!data.es_re_registro,
    justificacion_repeticion: JUSTIFICACIONES_VALIDAS.includes(data.justificacion_repeticion)
                                ? data.justificacion_repeticion : '',
    justificacion_detalle:    s(data.justificacion_detalle)
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
  // Anti-duplicado: si es re-registro, debe llevar justificación válida
  if (data.es_re_registro) {
    if (!JUSTIFICACIONES_VALIDAS.includes(data.justificacion_repeticion)) {
      errs.push('justificacion_repeticion es obligatoria cuando ya existe una acción registrada para este transformador');
    }
    if (data.justificacion_repeticion === JUSTIFICACIONES_REREGISTRO.OTRO
        && (!data.justificacion_detalle || data.justificacion_detalle.length < 10)) {
      errs.push('justificacion_detalle es obligatoria (min 10 chars) cuando la justificación es "otro"');
    }
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

/**
 * Verifica si ya existen acciones registradas para un transformador
 * (por matrícula AFINIA = transformador_id). Si hay, devuelve el
 * conteo y los IDs de las últimas 5 para mostrar al usuario antes
 * de permitir un nuevo registro.
 *
 * @param {string} transformadorId  · matrícula AFINIA
 * @returns {Promise<{existe: boolean, count: number, ultimas: Array<{id, fecha_accion, accion_descripcion, estado_accion}>}>}
 */
export async function existeAccionParaTransformador(transformadorId) {
  if (!transformadorId) return { existe: false, count: 0, ultimas: [] };
  try {
    const snap = await getDocs(query(
      collRef(),
      where('transformador_id', '==', transformadorId),
      orderBy('fecha_accion', 'desc'),
      limit(5)
    ));
    const ultimas = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        fecha_accion:       data.fecha_accion       || '',
        accion_descripcion: data.accion_descripcion || '',
        estado_accion:      data.estado_accion      || '',
        es_re_registro:     !!data.es_re_registro
      };
    });
    return { existe: ultimas.length > 0, count: ultimas.length, ultimas };
  } catch (err) {
    console.warn('[existeAccionParaTransformador] query falló:', err);
    return { existe: false, count: 0, ultimas: [], error: err.message };
  }
}

export async function crear(data, uid) {
  const payload = sanitizar(data);
  const errs = validar(payload);
  if (errs.length) throw new Error('Validación acción de refrigeración:\n  · ' + errs.join('\n  · '));

  // ANTI-DUPLICADO · segunda línea de defensa en el data layer.
  // Aunque la UI hace su propio chequeo en guardarAccion, aquí
  // verificamos de nuevo. Si ya existen acciones para esta
  // matrícula y el payload no marca es_re_registro=true con una
  // justificación válida, RECHAZAMOS el create.
  // Esto previene cualquier write desde otros call sites o tests
  // que olviden el chequeo de UI.
  const dup = await existeAccionParaTransformador(payload.transformador_id);
  if (dup.existe) {
    if (!payload.es_re_registro) {
      throw new Error(
        `Anti-duplicado · transformador ${payload.transformador_id} ya tiene ` +
        `${dup.count} acción(es) registrada(s). El payload debe llevar ` +
        `es_re_registro=true + justificacion_repeticion válida.`
      );
    }
    if (!JUSTIFICACIONES_VALIDAS.includes(payload.justificacion_repeticion)) {
      throw new Error(
        `Anti-duplicado · re-registro detectado pero justificacion_repeticion ` +
        `inválida: "${payload.justificacion_repeticion}". Valores válidos: ` +
        JUSTIFICACIONES_VALIDAS.join(', ')
      );
    }
    if (payload.justificacion_repeticion === JUSTIFICACIONES_REREGISTRO.OTRO
        && (!payload.justificacion_detalle || payload.justificacion_detalle.length < 10)) {
      throw new Error(
        'Anti-duplicado · justificación "otro" requiere detalle ≥10 caracteres.'
      );
    }
  } else if (payload.es_re_registro) {
    // El cliente marcó es_re_registro=true pero no hay duplicados.
    // Lo dejamos pasar (no es una violación) pero corregimos el flag.
    payload.es_re_registro = false;
    payload.justificacion_repeticion = '';
    payload.justificacion_detalle = '';
  }

  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  payload.createdBy = uid || payload.responsable_uid || null;
  // Deep-clean recursivo: elimina undefined/NaN de objetos y arrays
  // anidados (mix[].ficha, evaluacion, proteccion, compatibilidad,
  // resumen_json, validacion_grafica). Firestore rechaza undefined
  // con error "permission-denied" engañoso (ver CLAUDE.md §0.1.2.6).
  const limpio = deepClean(payload);
  const ref = await addDoc(collRef(), limpio);
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
  await updateDoc(docRef(id), deepClean(payload));
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
