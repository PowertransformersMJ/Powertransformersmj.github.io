// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Bloques de análisis (modelo de datos FLEXIBLE)
// ──────────────────────────────────────────────────────────────
// Contrato genérico para que la IA exprese SIN LÍMITES su interpretación
// de un informe: cada prueba se modela como un "bloque" con sus series de
// puntos (curvas/barras) + su tabla de detalle + metadatos. El tablero
// grafica cualquier bloque de forma genérica → soportar un formato nuevo
// (DGA, SFRA, bushing, n posiciones de TAP, etc.) NO requiere tocar código.
//
// Decisión de arquitectura (ADR-006):
//   · El RESUMEN normativo (matriz/semáforo) sigue en el doc del informe
//     (liviano, va en el onSnapshot en vivo).
//   · Estos BLOQUES (detalle pesado: 17 TAPs × fases × tablas) NO inflan el
//     doc Firestore: se persisten como JSON en Storage y se cargan perezosamente
//     al abrir el tablero (desacople lectura ligera ↔ detalle pesado).
//
// Seguridad/escala: este sanitizador es DEFENSIVO y ACOTADO (caps) — la salida
// del LLM es semi-confiable; nunca se persiste sin acotar (protege Firestore,
// Storage y el render de payloads abusivos).
//
// Funciones puras, sin DOM ni Firestore. Testeable con node --test.
// ══════════════════════════════════════════════════════════════

export const BLOQUES_SCHEMA_VERSION = 1;

// Topes duros (escala + seguridad): un informe real cabe holgado debajo.
export const LIMITES = Object.freeze({
  BLOQUES: 24,   // familias de prueba × variantes por informe
  SERIES: 16,    // p.ej. 3 fases × pares de devanado
  PUNTOS: 64,    // p.ej. 17 posiciones de TAP (margen amplio)
  FILAS: 80,     // filas de la tabla de detalle
  COLS: 18,      // columnas de la tabla
  TXT: 240       // tope de longitud de un texto libre (título, observación)
});

export const TIPOS_GRAFICA = Object.freeze(['linea', 'barra', 'dispersion']);

/* ─── helpers puros ──────────────────────────────────────────── */
const str = (v, max = LIMITES.TXT) => {
  const s = (v == null) ? '' : String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
};
const num = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'string') v = v.replace(/,/g, '.');
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const arr = (v) => Array.isArray(v) ? v : [];

/* ─── Punto de una serie: x puede ser número (TAP) o etiqueta (par) ─ */
export function sanitizarPunto(p) {
  const src = p || {};
  const xNum = num(src.x);
  return {
    x: xNum != null ? xNum : str(src.x, 40), // número si se puede; si no, etiqueta
    y: num(src.y)
  };
}

/* ─── Serie (una línea / un grupo de barras) ─────────────────── */
export function sanitizarSerie(s) {
  const src = s || {};
  const puntos = arr(src.puntos)
    .slice(0, LIMITES.PUNTOS)
    .map(sanitizarPunto)
    .filter((pt) => pt.y != null || pt.x !== '');
  return {
    nombre: str(src.nombre, 60),
    color: str(src.color, 24),  // opcional; el render asigna paleta si falta
    puntos
  };
}

/* ─── Tabla de detalle (genérica, acotada) ───────────────────── */
export function sanitizarTabla(t) {
  const src = t || {};
  const columnas = arr(src.columnas).slice(0, LIMITES.COLS).map((c) => str(c, 60));
  const filas = arr(src.filas).slice(0, LIMITES.FILAS).map((fila) =>
    arr(fila).slice(0, LIMITES.COLS).map((cell) => str(cell, 80)));
  return { columnas, filas };
}

/* ─── Bloque de análisis (una prueba / una visualización) ────── */
export function sanitizarBloque(b) {
  const src = b || {};
  const grafica = TIPOS_GRAFICA.includes(str(src.grafica)) ? str(src.grafica) : 'linea';
  const series = arr(src.series).slice(0, LIMITES.SERIES).map(sanitizarSerie)
    .filter((s) => s.puntos.length);
  const tabla = sanitizarTabla(src.tabla);
  return {
    prueba:        str(src.prueba, 60),     // clave de familia (excitacion, bushing, …)
    titulo:        str(src.titulo),         // título visible del bloque
    unidad:        str(src.unidad, 24),     // "mA" | "GΩ" | "pF" | "%" …
    eje_x:         str(src.eje_x, 60),      // "Posición del TAP" | "Buje" …
    grafica,
    series,
    tabla,
    limite:        num(src.limite),         // línea roja (límite normativo)
    guia:          num(src.guia),           // línea ámbar (guía)
    invertir:      src.invertir === true,   // límite es MÍNIMO (p.ej. aislamiento ≥1 GΩ)
    calif:         str(src.calif, 40),      // calificación global del bloque
    observaciones: str(src.observaciones)   // narrativa del laboratorio (para callout)
  };
}

/**
 * Sanitiza el arreglo de bloques que produce la IA. Descarta bloques sin
 * título o sin datos (ni series ni tabla). ACOTADO por LIMITES.
 * @param {Array} input
 * @returns {{schema_version:number, bloques:Array}}
 */
export function sanitizarBloques(input) {
  const bloques = arr(input)
    .slice(0, LIMITES.BLOQUES)
    .map(sanitizarBloque)
    .filter((b) => b.titulo && (b.series.length || b.tabla.filas.length));
  return { schema_version: BLOQUES_SCHEMA_VERSION, bloques };
}
