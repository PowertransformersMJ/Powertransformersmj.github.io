// ═══════════════════════════════════════════════════════════════
// REFRIGERACIÓN · transformadores AFINIA — LECTOR DE FIRESTORE
// ───────────────────────────────────────────────────────────────
// ⛔ ESTE ARCHIVO NO CONTIENE DATOS DE CLIENTE — Y NO DEBE VOLVER
//    A CONTENERLOS NUNCA.
//
//    `assets/` se publica tal cual en GitHub Pages y el repositorio
//    es PÚBLICO: todo lo que se escriba aquí queda descargable por
//    cualquier persona en internet, sin login. El parque real
//    (series, matrículas, subestaciones, potencias) vive ÚNICAMENTE
//    en Firestore, colección `transformadores`, detrás de Auth.
//
// Antes: constante congelada con el parque completo incrustado.
// Ahora: lector que consulta Firestore vía `listarV2` y traduce el
// documento v2 (por secciones) a la forma canónica en MAYÚSCULAS
// que consume `assets/js/calculo-refrigeracion.js`.
//
// ── CONTRATO (cambios ADITIVOS, nada se renombra) ──────────────
//   · `TRANSFORMADORES_AFINIA`  — sigue exportado. Ahora es un array
//     VACÍO congelado: placeholder de compatibilidad para que ningún
//     import existente reviente. Quien lo use debe migrar al lector.
//   · `buscarPorMatricula(mat)` — misma firma. Ahora es `async`
//     (devuelve `Promise<obj|null>`) porque el dato viaja por red.
//   · NUEVO `cargarTransformadoresAfinia(opts)` — lector asíncrono
//     con caché en memoria (una sola lectura por sesión: free-tier).
//   · NUEVO `mapearDocV2ACatalogo(doc)` — mapeo PURO y testeable.
//   · NUEVO `catalogoEnCache()` — acceso síncrono a lo ya cargado.
//   · NUEVO `limpiarCacheCatalogo()` — para tests y recargas.
//
// ── ⚠️ DEUDA DE DATOS CONOCIDA (no se inventa nada) ────────────
//   · REFRIGERACION ← `refrigeracion.tipo_refrigeracion`. HOY llega
//     VACÍO: tanto la migración v1→v2
//     (`scripts/migrate/v1-to-v2-transformadores.js`) como el
//     importador de Excel (`assets/js/domain/importador.js`) escriben
//     la sección `refrigeracion: {}` sin poblarla. PENDIENTE: añadir
//     el campo al documento del transformador (importador + ficha
//     técnica) para que el módulo de refrigeración vuelva a mostrarlo.
//   · GRUPO ← `identificacion.grupo`. El importador de Excel sí lo
//     mapea cuando la hoja trae la columna, pero los documentos
//     migrados desde v1 quedaron con cadena vacía. PENDIENTE igual.
//
//   Mientras tanto ambos campos llegan como '' y la interfaz muestra
//   "No especificado". Es DELIBERADO: un campo vacío es información
//   honesta; un valor fabricado corrompería el dimensionamiento ONAF.
//   PROHIBIDO rellenarlos con valores por defecto o adivinados.
// ═══════════════════════════════════════════════════════════════

import { DEPARTAMENTOS } from '../domain/schema.js';

/**
 * @typedef {object} TransformadorAfinia
 * @property {string} SERIE
 * @property {string} POTENCIA (KVA)
 * @property {string} GRUPO           · G1 / G2 / G3 · puede venir vacío
 * @property {string} SUBESTACION
 * @property {string} MATRICULA       · clave de búsqueda
 * @property {string} ZONA            · BOLIVAR / ORIENTE / OCCIDENTE
 * @property {string} DEPARTAMENTO
 * @property {string} REFRIGERACION   · puede venir vacío (ver deuda arriba)
 */

/**
 * Placeholder de compatibilidad. SIEMPRE vacío por diseño: el
 * catálogo real no se publica. Usa `cargarTransformadoresAfinia()`.
 * @type {ReadonlyArray<TransformadorAfinia>}
 */
export const TRANSFORMADORES_AFINIA = Object.freeze([]);

// ── Helpers puros ──────────────────────────────────────────────

function txt(v) {
  return v == null ? '' : String(v).trim();
}

/**
 * La zona es derivable del departamento por la tabla de dominio
 * (regla documentada en `docs/MODELO-DATOS-v2.md`, la misma que usó
 * la migración v1→v2). No es un dato inventado: es una derivación
 * determinista. Solo se aplica si el documento no trae zona propia.
 */
function inferirZonaDesdeDepartamento(departamento) {
  const d = txt(departamento).toLowerCase();
  const hit = DEPARTAMENTOS.find((x) => x.value === d);
  return hit ? hit.zona : '';
}

/**
 * Traduce un documento v2 de Firestore a la fila canónica del
 * catálogo de refrigeración. Función PURA (sin red, sin DOM):
 * acepta tanto el shape por secciones (v2) como la proyección plana
 * v1 que los documentos llevan replicada en el nivel raíz.
 *
 * @param {object} doc — documento tal como lo devuelve `listarV2`.
 * @returns {TransformadorAfinia}
 */
export function mapearDocV2ACatalogo(doc) {
  const d  = doc || {};
  const id = d.identificacion || {};
  const pl = d.placa          || {};
  const ub = d.ubicacion      || {};
  const rf = d.refrigeracion  || {};

  const departamento = txt(ub.departamento || d.departamento);
  const potencia = (pl.potencia_kva != null && pl.potencia_kva !== '')
    ? pl.potencia_kva
    : d.potencia_kva;

  return {
    SERIE:            txt(pl.serial || d.serial),
    'POTENCIA (KVA)': (potencia == null || potencia === '') ? '' : String(potencia),
    // Vacío si Firestore no lo trae. NO se sustituye por un default.
    GRUPO:            txt(id.grupo).toUpperCase(),
    SUBESTACION:      txt(ub.subestacion_nombre || d.subestacion).toUpperCase(),
    MATRICULA:        txt(id.matricula || id.codigo || d.codigo).toUpperCase(),
    ZONA:             txt(ub.zona).toUpperCase() || inferirZonaDesdeDepartamento(departamento),
    DEPARTAMENTO:     departamento.toUpperCase(),
    // Vacío si Firestore no lo trae. NO se sustituye por un default.
    REFRIGERACION:    txt(rf.tipo_refrigeracion).toUpperCase()
  };
}

/**
 * Ordena por subestación y matrícula, como venía el catálogo viejo,
 * para que el combobox mantenga el mismo orden de lectura.
 */
function ordenarCatalogo(filas) {
  return filas.slice().sort((a, b) =>
    a.SUBESTACION.localeCompare(b.SUBESTACION, 'es') ||
    a.MATRICULA.localeCompare(b.MATRICULA, 'es')
  );
}

// ── Lector con caché ───────────────────────────────────────────

let _cache   = null;   // ReadonlyArray ya mapeado
let _enVuelo = null;   // promesa compartida (evita lecturas duplicadas)

/**
 * Lee el parque desde Firestore y lo devuelve en la forma canónica
 * del catálogo. Una sola lectura one-shot por sesión (free-tier
 * sagrado: sin `onSnapshot`, con `limit`).
 *
 * @param {{limite?: number, forzar?: boolean}} [opts]
 * @returns {Promise<ReadonlyArray<TransformadorAfinia>>}
 */
export async function cargarTransformadoresAfinia(opts = {}) {
  const { limite = 500, forzar = false } = opts;
  if (forzar) { _cache = null; _enVuelo = null; }
  if (_cache)   return _cache;
  if (_enVuelo) return _enVuelo;

  _enVuelo = (async () => {
    // Import dinámico a propósito: mantiene este módulo cargable
    // desde Node (tests) sin arrastrar el SDK de Firebase.
    const mod  = await import('./transformadores.js');
    const docs = await mod.listarV2({ limite });
    const filas = (Array.isArray(docs) ? docs : [])
      .map(mapearDocV2ACatalogo)
      .filter((t) => t.MATRICULA);
    _cache = Object.freeze(ordenarCatalogo(filas));
    return _cache;
  })();

  try {
    return await _enVuelo;
  } finally {
    _enVuelo = null;
  }
}

/**
 * Acceso SÍNCRONO a lo ya cargado. Devuelve el array vacío mientras
 * la lectura no haya ocurrido — nunca lanza.
 * @returns {ReadonlyArray<TransformadorAfinia>}
 */
export function catalogoEnCache() {
  return _cache || TRANSFORMADORES_AFINIA;
}

/** Invalida la caché en memoria (tests, cambio de sesión). */
export function limpiarCacheCatalogo() {
  _cache = null;
  _enVuelo = null;
}

/**
 * Búsqueda por matrícula. MISMA FIRMA que antes, pero ahora `async`
 * porque el dato ya no vive en el bundle: devuelve una promesa que
 * resuelve al transformador o a `null` si no existe.
 *
 * @param {string} matricula
 * @returns {Promise<TransformadorAfinia|null>}
 */
export async function buscarPorMatricula(matricula) {
  if (!matricula) return null;
  const lista = await cargarTransformadoresAfinia();
  const M = txt(matricula).toUpperCase();
  return lista.find((t) => t.MATRICULA === M) || null;
}
