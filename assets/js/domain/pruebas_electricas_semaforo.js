// ═══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — semáforo normativo · dominio puro (sin DOM)
// ───────────────────────────────────────────────────────────────
// Calificación por norma de las pruebas eléctricas de campo de un
// transformador de potencia. Reproduce EXACTAMENTE los umbrales,
// colores y comportamiento del tablero estático original
// (TransformerOps · "Tablero Dinámico de Pruebas Eléctricas").
//
// Referencias normativas (las mismas del tablero original):
//   · IEEE Std 62 · IEEE C57.12.90 · C57.19.100  (tan δ / excitación)
//   · IEC 60076-1 · IEEE C57.152                 (relación / resistencia)
//   · NETA / criterio de fabricante              (aislamiento CC)
//   · Test Data Reference Book                   (collar caliente)
//
// Todas las funciones son puras: reciben input y devuelven un
// estado determinístico. Sin DOM, sin Firestore, sin state mutable.
// Diseñado para tests con node --test (valores límite).
// ═══════════════════════════════════════════════════════════════

/* ─── Estados del semáforo (clases CSS heredadas del tablero) ──── */
// b-g = verde (dentro de norma) · dot g
// b-a = ámbar (vigilar / verificar) · dot a
// b-o = naranja (investigar) · dot o
// b-r = rojo (fuera de norma) · dot r
// b-n = neutral (sin dato tabulado / no medido) · dot n
export const ESTADOS = Object.freeze({
  VERDE:    { clase: 'b-g', dot: 'g', nivel: 0, etiqueta: 'dentro de norma' },
  AMBAR:    { clase: 'b-a', dot: 'a', nivel: 1, etiqueta: 'vigilar / verificar' },
  NARANJA:  { clase: 'b-o', dot: 'o', nivel: 2, etiqueta: 'investigar' },
  ROJO:     { clase: 'b-r', dot: 'r', nivel: 3, etiqueta: 'fuera de norma' },
  NEUTRAL:  { clase: 'b-n', dot: 'n', nivel: -1, etiqueta: 'sin dato tabulado' }
});

/* ─── Umbrales normativos congelados (fuente de verdad) ───────── */
// Replican literalmente la sección "Criterios de evaluación" y las
// líneas límite/guía de las gráficas del tablero original.
export const UMBRALES = Object.freeze({
  // Factor de potencia / tan δ (%) — IEEE 62 · C57.12.90
  // ≤0.5 bueno · 0.5–0.7 normal · 0.7–1 investigar · >1 excesivo
  // Gráfica: límite rojo 1.0% · guía ámbar 0.5%
  tand: Object.freeze({
    bueno: 0.5,        // ≤ 0.5  → verde
    normal: 0.7,       // 0.5–0.7 → verde (normal, dentro de norma)
    investigar: 1.0,   // 0.7–1.0 → naranja (investigar)
    limite: 1.0,       // > 1.0  → rojo (excesivo)
    guia: 0.5,         // línea guía ámbar de la gráfica
    ymax: 1.6
  }),
  // Corriente de excitación — IEEE Std 62
  // I<50 mA → Δ<10% · I>50 mA → Δ<5% (entre las 2 fases mayores)
  // Gráfica: límite rojo 10% · guía ámbar 5%
  excitacion: Object.freeze({
    corrienteUmbralMA: 50,  // frontera de corriente que define el Δ admisible
    deltaBajaCorriente: 10, // Δ% admisible si I < 50 mA
    deltaAltaCorriente: 5,  // Δ% admisible si I ≥ 50 mA
    limite: 10,
    guia: 5,
    ymax: 12
  }),
  // Relación de transformación — IEC 60076-1 · C57.152
  // Desviación ≤ ±0.5% respecto a placa
  relacion: Object.freeze({
    limite: 0.5,       // |Δ%| > 0.5 → rojo
    ymax: 0.6
  }),
  // Resistencia de devanados — ANSI/NETA ATS §7.2.2.D.8 (IEEE C57.152 método)
  // Desbalance entre fases ≤ 2% (corregido a temperatura; o vs fábrica)
  resistencia: Object.freeze({
    limite: 2,         // desbalance% > 2 → rojo (NETA D.8)
    ymax: 3
  }),
  // Resistencia de aislamiento (CC) — NETA / fabricante
  // Mínimo ≥ 1 GΩ para esta clase de tensión
  aislamiento: Object.freeze({
    minGohm: 1,        // < 1 GΩ → rojo
    ymax: 4
  }),
  // Collar caliente / bujes — Test Data Reference Book
  // Pérdidas < 100 mW
  collar: Object.freeze({
    limite: 100,       // ≥ 100 mW → rojo
    ymax: 110
  }),
  // DRM · Resistencia Dinámica del conmutador (OLTC) — IEEE C57.152
  // Tiempo de transición entre tomas dentro de [40, 70] ms.
  drm: Object.freeze({
    min: 40,           // < 40 ms → rojo (transición demasiado rápida)
    max: 70,           // > 70 ms → rojo (contacto lento / desgaste)
    guiaBaja: 45,
    guiaAlta: 65,
    ymax: 80
  })
});

/* ─── Helpers internos ────────────────────────────────────────── */

function esNulo(v) {
  return v === null || v === undefined || v === '' ||
    (typeof v === 'number' && Number.isNaN(v));
}

/* ─── Calificadores por prueba (núcleo del semáforo) ──────────── */

/**
 * Tangente δ / factor de potencia (%).
 * REGLA DE NEGOCIO (no alterar sin cambiar el tablero):
 *   ≤0.5 → verde (bueno) · 0.5–0.7 → verde (normal) ·
 *   0.7–1.0 → naranja (investigar) · >1.0 → rojo (excesivo).
 * @param {number} pct tan δ en porcentaje
 */
export function calificarTanDelta(pct) {
  if (esNulo(pct)) return ESTADOS.NEUTRAL;
  const u = UMBRALES.tand;
  if (pct > u.limite) return ESTADOS.ROJO;          // > 1.0 excesivo
  if (pct > u.normal) return ESTADOS.NARANJA;       // 0.7–1.0 investigar
  return ESTADOS.VERDE;                              // ≤ 0.7 dentro de norma
}

/**
 * Desbalance de corriente de excitación entre las dos fases mayores.
 * REGLA DE NEGOCIO: el Δ admisible depende de la magnitud de la
 * corriente — si I < 50 mA se admite Δ < 10%; si I ≥ 50 mA, Δ < 5%.
 * @param {number} deltaPct desbalance entre las 2 fases mayores (%)
 * @param {number} corrienteMA corriente de excitación de referencia (mA)
 */
export function calificarExcitacion(deltaPct, corrienteMA) {
  if (esNulo(deltaPct)) return ESTADOS.NEUTRAL;
  const u = UMBRALES.excitacion;
  const admisible = (!esNulo(corrienteMA) && corrienteMA >= u.corrienteUmbralMA)
    ? u.deltaAltaCorriente
    : u.deltaBajaCorriente;
  if (deltaPct > admisible) return ESTADOS.ROJO;
  if (deltaPct > admisible * 0.5) return ESTADOS.AMBAR; // > mitad del margen → vigilar
  return ESTADOS.VERDE;
}

/**
 * Relación de transformación: desviación respecto a placa.
 * REGLA DE NEGOCIO: |Δ%| ≤ 0.5 dentro de norma; fuera → rojo.
 * @param {number} desviacionPct desviación respecto a placa (%)
 */
export function calificarRelacion(desviacionPct) {
  if (esNulo(desviacionPct)) return ESTADOS.NEUTRAL;
  const u = UMBRALES.relacion;
  const abs = Math.abs(desviacionPct);
  if (abs > u.limite) return ESTADOS.ROJO;
  if (abs > u.limite * 0.8) return ESTADOS.AMBAR;   // cerca del límite → vigilar
  return ESTADOS.VERDE;
}

/**
 * Resistencia de devanados: desbalance entre fases (%).
 * REGLA DE NEGOCIO: desbalance ≤ 5% dentro de norma. Si el dato está
 * marcado como dudoso (flag de digitación), se devuelve ÁMBAR
 * ("verificar") aunque el número caiga en rango — esto replica el
 * caso AT 2020 = 847.22 mΩ del tablero (probable error de digitación).
 * @param {number} desbalancePct desbalance entre fases (%)
 * @param {boolean} [flagVerificar=false] dato sospechoso de digitación
 */
export function calificarResistencia(desbalancePct, flagVerificar = false) {
  if (flagVerificar) return ESTADOS.AMBAR;          // "a verificar" tiene prioridad
  if (esNulo(desbalancePct)) return ESTADOS.NEUTRAL;
  const u = UMBRALES.resistencia;
  if (desbalancePct > u.limite) return ESTADOS.ROJO;
  if (desbalancePct > u.limite * 0.8) return ESTADOS.AMBAR;
  return ESTADOS.VERDE;
}

/**
 * Resistencia de aislamiento (CC).
 * REGLA DE NEGOCIO: ≥ 1 GΩ dentro de norma; sin dato → neutral.
 * @param {number} gohm resistencia de aislamiento (GΩ)
 */
export function calificarAislamiento(gohm) {
  if (esNulo(gohm)) return ESTADOS.NEUTRAL;
  const u = UMBRALES.aislamiento;
  if (gohm < u.minGohm) return ESTADOS.ROJO;
  return ESTADOS.VERDE;
}

/**
 * Collar caliente / pérdidas en bujes (mW).
 * REGLA DE NEGOCIO: pérdidas < 100 mW dentro de norma.
 * @param {number} mW pérdidas (miliwatts)
 */
export function calificarCollar(mW) {
  if (esNulo(mW)) return ESTADOS.NEUTRAL;
  const u = UMBRALES.collar;
  if (mW >= u.limite) return ESTADOS.ROJO;
  if (mW >= u.limite * 0.8) return ESTADOS.AMBAR;
  return ESTADOS.VERDE;
}

/**
 * DRM · tiempo de transición del conmutador (ms).
 * REGLA DE NEGOCIO: dentro de [40, 70] ms está en norma. Fuera de esa
 * ventana → rojo (transición sospechosa). Cerca de los bordes (guías
 * 45/65 ms) → ámbar (vigilar tendencia). Se evalúa la ventana medida
 * (min/max); el peor extremo define el estado.
 * @param {number} tiempoMinMs extremo inferior de la ventana medida
 * @param {number} tiempoMaxMs extremo superior de la ventana medida
 */
export function calificarDrm(tiempoMinMs, tiempoMaxMs) {
  const lo = esNulo(tiempoMinMs) ? null : tiempoMinMs;
  const hi = esNulo(tiempoMaxMs) ? null : tiempoMaxMs;
  if (lo == null && hi == null) return ESTADOS.NEUTRAL;
  const u = UMBRALES.drm;
  const min = lo == null ? hi : lo;
  const max = hi == null ? lo : hi;
  if (min < u.min || max > u.max) return ESTADOS.ROJO;
  if (min < u.guiaBaja || max > u.guiaAlta) return ESTADOS.AMBAR;
  return ESTADOS.VERDE;
}

/* ─── Mapa de calificadores por clave de prueba ───────────────── */
export const CALIFICADORES = Object.freeze({
  tand: calificarTanDelta,
  excitacion: calificarExcitacion,
  relacion: calificarRelacion,
  resistencia: calificarResistencia,
  aislamiento: calificarAislamiento,
  collar: calificarCollar,
  drm: calificarDrm
});

/**
 * Estado global de un informe: el peor estado entre todas sus pruebas
 * (excluyendo neutrales). Replica el criterio del tablero donde el
 * hallazgo dominante (rojo CL 2012/2014) define el estado histórico.
 * @param {object} estados mapa { claveprueba: estado }
 * @returns {object} el estado de mayor nivel (peor) o NEUTRAL si vacío
 */
export function estadoGlobal(estados) {
  const vals = Object.values(estados || {})
    .filter((e) => e && e.nivel >= 0);
  if (!vals.length) return ESTADOS.NEUTRAL;
  return vals.reduce((peor, e) => (e.nivel > peor.nivel ? e : peor), vals[0]);
}
