// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Matriz Criticidad × Salud (F36)
// ──────────────────────────────────────────────────────────────
// Implementa el componente central del Procedimiento A6 / §4.2
// del MO.00418: cruce entre criticidad operativa (usuarios aguas
// abajo) y condición de salud (HI).
//
// Fórmula de rangos (§A9.9):
//   Tamaño = (max_usuarios − min_usuarios) / 5
//   Con min = 1 y max = 48312 → pasos de 9662.
// ══════════════════════════════════════════════════════════════

export const NIVELES_ORDEN = Object.freeze([
  'minima', 'menor', 'moderada', 'mayor', 'maxima'
]);

export const LABELS_NIVEL = Object.freeze({
  minima:   'Mínima',
  menor:    'Menor',
  moderada: 'Moderada',
  mayor:    'Mayor',
  maxima:   'Máxima'
});

// Colores semáforo para celdas VRD/AMRL/NAR/ROJ
export const COLORES_CELDA = Object.freeze({
  VRD:  { hex: '#1B8E3F', label: 'Verde (OK)' },
  AMRL: { hex: '#F5C518', label: 'Amarillo (atención)' },
  NAR:  { hex: '#EF7820', label: 'Naranja (alta)' },
  ROJ:  { hex: '#E53935', label: 'Roja (crítica)' }
});

// Matriz 5×5 oficial (fila = HI, columna = criticidad)
// MO.00418 Tabla 11.
//                  minima  menor   moderada mayor   maxima
const MATRIZ = Object.freeze({
  5: { minima: 'AMRL', menor: 'NAR',  moderada: 'ROJ',  mayor: 'ROJ',  maxima: 'ROJ' },
  4: { minima: 'VRD',  menor: 'AMRL', moderada: 'NAR',  mayor: 'ROJ',  maxima: 'ROJ' },
  3: { minima: 'VRD',  menor: 'AMRL', moderada: 'AMRL', mayor: 'NAR',  maxima: 'ROJ' },
  2: { minima: 'VRD',  menor: 'VRD',  moderada: 'AMRL', mayor: 'NAR',  maxima: 'ROJ' },
  1: { minima: 'VRD',  menor: 'VRD',  moderada: 'VRD',  mayor: 'AMRL', maxima: 'NAR' }
});

/**
 * Calcula los rangos de criticidad para un tope dado.
 *
 * @param {number} maxUsuarios — tope dinámico (p.ej. 48312)
 * @param {number} [minUsuarios=1] — piso (§A9.9: 1, no 0)
 * @returns {Array<{nivel, min, max}>}
 */
export function calcularRangosCriticidad(maxUsuarios, minUsuarios = 1) {
  const max = Number(maxUsuarios);
  const min = Number(minUsuarios) || 1;
  if (!Number.isFinite(max) || max <= min) return [];
  const tam = Math.floor((max - min) / 5);
  const rangos = [];
  for (let i = 0; i < 5; i++) {
    const lo = min + i * tam;
    const hi = i === 4 ? max : (min + (i + 1) * tam) - 1;
    rangos.push({ nivel: NIVELES_ORDEN[i], min: lo, max: hi });
  }
  return rangos;
}

/**
 * Clasifica un número de usuarios en su nivel de criticidad.
 */
export function nivelPorUsuarios(usuarios, rangos) {
  const n = Number(usuarios);
  if (!Number.isFinite(n) || !Array.isArray(rangos) || !rangos.length) return null;
  // Se redondea antes de clasificar: los usuarios son personas, no decimales,
  // y un 9662,5 caía en la grieta entera entre dos rangos y devolvía null —
  // el equipo desaparecía de la matriz sin que nadie lo notara.
  const v = Math.round(n);
  if (v <= rangos[0].min) return rangos[0].nivel;
  for (const r of rangos) {
    if (v >= r.min && v <= r.max) return r.nivel;
  }
  return rangos[rangos.length - 1].nivel;
}

/**
 * Devuelve el color de la celda (VRD/AMRL/NAR/ROJ) para una
 * combinación (HI_redondeado 1..5, nivel criticidad).
 */
export function colorCelda(hiEntero, nivelCriticidad) {
  const hi = Math.round(Math.min(5, Math.max(1, hiEntero)));
  const fila = MATRIZ[hi];
  if (!fila) return null;
  return fila[nivelCriticidad] || null;
}

/**
 * Prioridad numérica para ranking (1 = peor, 4 = OK).
 * Útil para el Plan de Inversión (F30).
 */
export function prioridadNumerica(color) {
  switch (color) {
    case 'ROJ':  return 1;
    case 'NAR':  return 2;
    case 'AMRL': return 3;
    case 'VRD':  return 4;
    default:     return 5;
  }
}

/**
 * Asigna el color a un transformador dado su `salud_actual.hi_final`
 * y su `criticidad.nivel`. Devuelve `null` si faltan datos.
 */
export function evaluarTransformador(tx, rangos) {
  if (!tx) return null;
  const hi = tx.salud_actual && tx.salud_actual.hi_final;
  let nivel = tx.criticidad && tx.criticidad.nivel;
  if (!nivel && tx.servicio) {
    nivel = nivelPorUsuarios(tx.servicio.usuarios_aguas_abajo, rangos);
  }
  if (hi == null || !nivel) return null;
  const color = colorCelda(Math.round(hi), nivel);
  return {
    hi, nivel, color,
    prioridad: prioridadNumerica(color)
  };
}

/**
 * Agrega conteos por celda para un universo de transformadores.
 * Devuelve estructura 5×5 lista para renderizar.
 */
export function agregarConteos(transformadores, rangos) {
  const out = {};
  for (const hi of [1, 2, 3, 4, 5]) {
    out[hi] = {};
    for (const n of NIVELES_ORDEN) out[hi][n] = { count: 0, color: colorCelda(hi, n), ids: [] };
  }
  for (const tx of transformadores) {
    const res = evaluarTransformador(tx, rangos);
    if (!res) continue;
    // Mismo clamp que `colorCelda`: sin él, un HI fuera de escala (5,6 por un
    // redondeo o un dato sucio) se evaluaba como ROJO pero luego desaparecía
    // del conteo — el equipo MÁS crítico de la flota se perdía de la matriz.
    const filaHi = Math.min(5, Math.max(1, Math.round(res.hi)));
    if (!out[filaHi] || !out[filaHi][res.nivel]) continue;
    out[filaHi][res.nivel].count += 1;
    out[filaHi][res.nivel].ids.push(tx.id || tx.codigo);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════
// Lectura por POTENCIA — informativa, NO normativa (99 §81)
// ──────────────────────────────────────────────────────────────
// La criticidad del MO.00418 se mide por usuarios aguas abajo y eso NO cambia:
// la casilla de la matriz sigue saliendo de `nivelPorUsuarios`. Pero el parque
// tiene 14 equipos de ≥20 MVA con ≤10 usuarios registrados (870 MVA, 23 % de la
// potencia) porque el «1» se usa como marcador de «no aplica» en unidades de
// transmisión: ahí la columna normativa dice «mínima» y el papel se firma sin
// que nadie vea la capacidad que está en juego. Estas bandas existen para
// MOSTRAR la potencia junto a la posición, nunca para reclasificar.
// Cortes = los de la distribución real del parque (mediana 6,5 · p75 30 · máx 150).
// ══════════════════════════════════════════════════════════════

/** Número de verdad, o null. `Number(null)` da 0 y eso convierte un vacío en un dato. */
function numeroOVacio(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const BANDAS_POTENCIA = Object.freeze([
  { nivel: 'minima',   min: 0,  max: 5,        etiqueta: '< 5 MVA',        punto: 1 },
  { nivel: 'menor',    min: 5,  max: 10,       etiqueta: '5 – 9,9 MVA',    punto: 2 },
  { nivel: 'moderada', min: 10, max: 20,       etiqueta: '10 – 19,9 MVA',  punto: 3 },
  { nivel: 'mayor',    min: 20, max: 50,       etiqueta: '20 – 49,9 MVA',  punto: 4 },
  { nivel: 'maxima',   min: 50, max: Infinity, etiqueta: '≥ 50 MVA',       punto: 5 }
]);

/** Banda de potencia de un equipo (o null si no hay dato). */
export function bandaPotencia(mva) {
  const v = numeroOVacio(mva);
  if (v == null || v <= 0) return null;
  return BANDAS_POTENCIA.find((b) => v >= b.min && v < b.max) || BANDAS_POTENCIA[BANDAS_POTENCIA.length - 1];
}

/** Nivel 1..5 que tendría la consecuencia si se midiera por potencia. INFORMATIVO. */
export function nivelPorPotencia(mva) {
  const b = bandaPotencia(mva);
  return b ? b.nivel : null;
}

/**
 * ¿El registro de usuarios de este equipo hay que mirarlo con lupa? Devuelve
 * el motivo en palabras, o '' si no hay nada que advertir. No cambia ninguna
 * clasificación: es lo que se imprime al lado de la casilla.
 */
export function avisoDatoConsecuencia(usuarios, mva) {
  // `Number(null)` es 0: sin este filtro, un campo VACÍO se leería como «0
  // usuarios registrados» y la hoja afirmaría algo que el archivo no dice.
  const u = numeroOVacio(usuarios);
  const m = numeroOVacio(mva);
  const sinUsuarios = u != null && u <= 1;
  const grande = m != null && m >= 20;
  if (sinUsuarios && grande) {
    return 'Dato de usuarios a confirmar: el «1» se usa como marcador de «no aplica» en unidades de ' +
           'transmisión, y aquí hay capacidad comprometida de peso.';
  }
  if (sinUsuarios) return 'Sin usuarios registrados aguas abajo (0 o 1): la columna sale del valor registrado, no de un conteo.';
  if (u != null && u >= 10000 && m != null && m < 10) {
    return 'Muchos usuarios para poca potencia: la consecuencia por clientes es alta aunque el activo sea pequeño.';
  }
  return '';
}

/** Cuántos equipos del parque caen en cada columna (para imprimirlo en la cabecera). */
export function conteoPorNivel(usuariosDelParque, rangos) {
  const cuenta = { minima: 0, menor: 0, moderada: 0, mayor: 0, maxima: 0 };
  (usuariosDelParque || []).forEach((u) => {
    const v = numeroOVacio(u);
    if (v == null) return;                       // sin dato no cuenta en ninguna columna
    const n = nivelPorUsuarios(v, rangos);
    if (n && cuenta[n] != null) cuenta[n] += 1;
  });
  return cuenta;
}
