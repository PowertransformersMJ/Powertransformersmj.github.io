// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · configuración CENTRAL (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Un solo lugar para todo parámetro de limpieza, cálculo y vista del módulo
// «Cargabilidad SCADA». Los umbrales de la calificación CRG NO viven aquí: son los
// del MO.00418 ya ratificados (`umbrales_salud_baseline.js`, decisión del Ingeniero
// 2026-09-30: «Bandas CRG del MO.00418»), que se leen con `calcularCalifCRG`.
// SIN nombres de puntos reales (el repo es público; la guardia lo hace cumplir).
// Prefijo `scada_carga_` para no chocar con `scada_*.js` (SCADA U1/U2).
// ══════════════════════════════════════════════════════════════════════════════

/** Familias que se guardan: corriente por fase (A), tensión de línea (kV), P (MW) y Q (Mvar) TOTALES. */
export const FAMILIAS = Object.freeze(['IR', 'IS', 'IT', 'URS', 'UST', 'UTR', 'P', 'Q']);
export const FAMILIAS_I = Object.freeze(['IR', 'IS', 'IT']);
export const FAMILIAS_U = Object.freeze(['URS', 'UST', 'UTR']);
/** Token de la variable dentro de la clave de fila del exporte → familia. 'U' (barras) no se usa. */
export const TOKEN_FAMILIA = Object.freeze({
  'I R': 'IR', 'I S': 'IS', 'I T': 'IT', 'U RS': 'URS', 'U ST': 'UST', 'U TR': 'UTR', P: 'P', Q: 'Q'
});
export const UNIDAD = Object.freeze({ IR: 'A', IS: 'A', IT: 'A', URS: 'kV', UST: 'kV', UTR: 'kV', P: 'MW', Q: 'Mvar' });
export const NOMBRE_FAMILIA = Object.freeze({
  IR: 'Corriente fase R', IS: 'Corriente fase S', IT: 'Corriente fase T',
  URS: 'Tensión R-S', UST: 'Tensión S-T', UTR: 'Tensión T-R', P: 'Potencia activa (total)', Q: 'Potencia reactiva (total)'
});

/** Niveles de tensión que aparecen escritos de varias formas en el exporte. */
export const NIVELES = Object.freeze({
  N13_8: { kv: 13.8, etiqueta: '13,8 kV' },
  N34_5: { kv: 34.5, etiqueta: '34,5 kV' },
  N66: { kv: 66, etiqueta: '66 kV' },
  N110: { kv: 110, etiqueta: '110 kV' },
  N220: { kv: 220, etiqueta: '220 kV' },
  N500: { kv: 500, etiqueta: '500 kV' }
});

/**
 * Código por hora de cada serie (Uint8). Solo 0 y 10 cuentan como dato válido.
 * 1 y 2 no tienen valor; los demás guardan el valor CRUDO para poder recalcular.
 */
export const CODIGO = Object.freeze({
  VALIDO: 0,
  SIN_ARCHIVO: 1,        // no llegó archivo para esa hora
  NULO: 2,               // celda vacía, 'null' o no numérica
  BANDERA: 3,            // el propio SCADA la marcó como no válida (Invalid, Not Renewed…)
  CENTINELA: 4,          // valor tope del sistema (32767, −2147483648, …)
  CONGELADO: 5,          // el mismo valor varias horas seguidas: el dato no se renovó
  CERO: 6,               // cero sin explicación (sin tensión que diga que está energizado)
  FUERA_ESCALA: 7,       // tensión imposible para su nivel (voltios, ×10, 1000)
  DESENERGIZADO: 9,      // corriente en cero con tensión presente: fuera de servicio, no es hueco
  RETENIDO: 10           // tensión que no cambió por banda muerta mientras la corriente sí: válida
});
export const CODIGOS_VALIDOS = Object.freeze([0, 10]);
export const MOTIVO = Object.freeze({
  0: 'válido', 1: 'sin archivo', 2: 'vacío o no numérico', 3: 'marcado no válido por el SCADA',
  4: 'valor tope del sistema', 5: 'valor congelado', 6: 'cero sin explicación', 7: 'fuera de escala',
  9: 'fuera de servicio', 10: 'retenido (válido)'
});

/** Bandera de calidad del SCADA por hora (Uint8). 0 = no hay archivo de calidad ese día. */
export const BANDERA = Object.freeze({
  SIN: 0, ACTUAL: 1, INVALID: 2, NOT_RENEWED: 3, NOT_COLLECTED: 4, BLOCKED: 5, EXISTENT: 6, OTRA: 7
});
export const TEXTO_BANDERA = Object.freeze({
  actual: 1, invalid: 2, 'not renewed': 3, 'his - not collected': 4, blocked: 5, existent: 6
});
/** Banderas con las que el dato se acepta (0 = sin archivo de calidad: del 1 al 12 de enero no hay). */
export const BANDERAS_VALIDAS = Object.freeze([0, 1]);

/** Valores tope del sistema (medidos en los exportes). */
export const CENTINELAS = Object.freeze([32767, 32.767, 3276.7, 3276, 3277, 29999.1, -2147483648, 160.74801636]);
export const CENTINELA_ABS = 30000;
export const TOLERANCIA_CENTINELA = 1e-6;
/** Una tensión de línea fuera de [0,5; 1,5] × su nivel nominal es una escala equivocada. */
export const PLAUSIBILIDAD_U = Object.freeze([0.5, 1.5]);
/** Horas seguidas con el MISMO valor para declararlo congelado. */
export const CONGELADO_MIN_H = 6;
/** Tensión quieta sin corriente medida: solo es congelado si dura un día entero. */
export const U_CONGELADO_SIN_I_H = 24;
/** Variación relativa de la corriente para considerar que el equipo «se movió». */
export const VARIACION_I_RETENIDO = 0.15;

/** Cálculo de la cargabilidad. */
export const CALCULO = Object.freeze({
  // Estadístico del periodo sobre la corriente horaria de la fase más cargada. p99 reproduce la
  // carga oficial 2025 (mediana del cociente 1,03-1,13, medido): se ratifica con el Ingeniero.
  estadistico: 'p99',
  estadisticos: Object.freeze(['p95', 'p98', 'p99', 'max']),
  minFasesValidas: 2,
  // Si más de esta fracción de las horas válidas tiene solo 2 fases, la cifra no es firme.
  maxFraccionDosFases: 0.5,
  // Una hora con la corriente por encima de 3 veces la ampacidad es un error de escala, no carga.
  topeFisicoXAmpacidad: 3,
  // Firmeza: cobertura mínima de horas en servicio y horas válidas mínimas.
  coberturaMinFirme: 0.5,
  horasMinFirme: 72,
  // Sobrecarga física (bandera aparte de la CRG): por encima del 100 % de la ampacidad,
  // SOSTENIDA al menos estas horas seguidas.
  sobrecargaPct: 100,
  sobrecargaMinH: 2,
  // Atribución de escala.
  escalaIp99: 2.5,
  escalaIp50: 1.5,
  bandaUIS: Object.freeze([0.85, 1.15]),
  minHorasComparables: 24,
  // El factor de potencia solo se calcula con algo de carga.
  fpMinFraccionS: 0.02,
  fpMinFraccionSMin: 0.10,
  // Desbalance solo con carga apreciable.
  desbalanceMinFraccionA: 0.05,
  // Relación entre niveles (dos devanados): diferencia admitida frente a la relación de tensiones.
  relacionNivelesTol: 0.25,
  // Mapa nivel → devanado: tensión de placa a ±10 %.
  toleranciaNivelPlaca: 0.10,
  // Sin ninguna hora válida: con al menos estas horas de corriente en cero CON tensión, el motivo es «sin carga» (`99 §158`).
  horasMinSinCarga: 24
});

/** Tiempo: los valores son el promedio de la hora que TERMINA en el rótulo (medido); hora de Colombia. */
export const TIEMPO = Object.freeze({
  convencion: 'fin',
  offsetColombiaH: 5,
  mesCompletoMin: 0.9,
  maxMesesRango: 12
});

/** Escritura en Firestore. Los Bytes viajan en base64 (×1,33) más la codificación del canal. */
export const ESCRITURA = Object.freeze({
  loteMaxDocs: 8,
  docMaxBytes: 900 * 1024,
  limiteRegistros: 20,
  detalleMaxItems: 200
});

/** Colores de fase NO semánticos (el verde/ámbar/rojo quedan para el estado), con trazo distinto. */
export const FASES = Object.freeze({
  R: Object.freeze({ color: '#1F5FAD', trazo: 'solid' }),
  S: Object.freeze({ color: '#6E3FA3', trazo: 'dash' }),
  T: Object.freeze({ color: '#8A5A2B', trazo: 'dot' })
});
export const FASE_DE = Object.freeze({ IR: 'R', IS: 'S', IT: 'T', URS: 'R', UST: 'S', UTR: 'T' });

/**
 * Chips de la calificación CRG (número + palabra; el color nunca es la única señal). Las palabras son la escala de
 * condición del MO.00418 (Guía Fig. 3, AX.01 Tabla 11) = `CONDICIONES` de schema.js, por decisión del Ingeniero
 * (2026-10-09, `99 §160`). Escritas aquí a propósito: este archivo no importa otros (L-102).
 */
export const CRG_CHIP = Object.freeze({
  1: Object.freeze({ palabra: 'Muy Bueno', clase: 'chip--success' }),
  2: Object.freeze({ palabra: 'Bueno', clase: 'chip--teal' }),
  3: Object.freeze({ palabra: 'Medio', clase: 'chip--warn' }),
  4: Object.freeze({ palabra: 'Pobre', clase: 'cs-chip--crg4' }),
  5: Object.freeze({ palabra: 'Muy Pobre', clase: 'chip--danger' })
});

/** Nombres de devanado para la pantalla. */
export const DEVANADO = Object.freeze({ P: 'Primario', S: 'Secundario', T: 'Terciario' });
