// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Parque de Transformadores · CONFIG
// ──────────────────────────────────────────────────────────────
// Configuración auditable del dashboard Salud de Activos por Zona.
// Pesos, buckets, criticidad, variables y criterios MO.00418.
// Funciones PURAS · sin DOM · sin I/O · importable desde Node.
//
// Fuente canónica: MO.00418.DE-GAC-AX.01 Ed. 02
//   · §4.2 Tabla 10 (pesos HI)
//   · §4.2.1 Tabla 9 (criticidad por usuarios aguas abajo)
//   · §4.2.1 Tabla 11 (bucketización HI)
//   · §4.1 Tablas 1-9 (criterios por variable)
// ══════════════════════════════════════════════════════════════

// Pesos oficiales — MO.00418 Tabla 10 (suma = 1.00). Editables.
// Mismo set canónico que assets/js/domain/schema.js#PESOS_HI;
// se reexporta aquí con la nomenclatura de claves cortas que usa
// el dashboard (dga/edad/adfq/fur/crg/pyt/her).
export const PESOS = Object.freeze({
  dga:  0.35,
  edad: 0.30,
  adfq: 0.15,
  fur:  0.05,
  crg:  0.05,
  pyt:  0.05,
  her:  0.05,
});

// Sanity check: la suma debe ser 1.0 (con tolerancia decimal)
(function verificarPesos() {
  const suma = Object.values(PESOS).reduce((s, p) => s + p, 0);
  if (Math.abs(suma - 1.0) > 1e-9) {
    throw new Error(
      `[parque_salud_config] PESOS no suma 1.0 (suma=${suma}). ` +
      `Revisar MO.00418 Tabla 10.`
    );
  }
})();

// Las 7 variables del HI · clave + nombre humano
export const VARS = Object.freeze([
  Object.freeze({ k: 'dga',  n: 'DGA' }),
  Object.freeze({ k: 'edad', n: 'Edad' }),
  Object.freeze({ k: 'adfq', n: 'ADFQ' }),
  Object.freeze({ k: 'fur',  n: 'Furanos' }),
  Object.freeze({ k: 'crg',  n: 'Cargabilidad' }),
  Object.freeze({ k: 'pyt',  n: 'Protec. & TC' }),
  Object.freeze({ k: 'her',  n: 'Hermeticidad' }),
]);

// Buckets visuales de HI · escala 1..5 (1 mejor) · MO.00418 Tabla 11
// El color se resuelve desde CSS var (--h1..--h5) en runtime.
// Los `color` aquí son fallback CSS-equivalente para entornos
// sin DOM (tests Node).
export const BUCKETS = Object.freeze([
  Object.freeze({ max: 1.5, label: 'Muy Bueno', cls: 1, cssVar: '--h1', color: '#1cc870' }),
  Object.freeze({ max: 2.5, label: 'Bueno',     cls: 2, cssVar: '--h2', color: '#7fbf12' }),
  Object.freeze({ max: 3.5, label: 'Medio',     cls: 3, cssVar: '--h3', color: '#ffb800' }),
  Object.freeze({ max: 4.5, label: 'Pobre',     cls: 4, cssVar: '--h4', color: '#ff9500' }),
  Object.freeze({ max: 5.1, label: 'Muy Pobre', cls: 5, cssVar: '--h5', color: '#ff3b30' }),
]);

// Bucket-cero para activos sin evaluación
export const BUCKET_NULL = Object.freeze({
  label: 'Sin evaluación', cls: 0, cssVar: null, color: '#3a4658',
});

// Etiqueta humana por calificación entera 1..5
export const CALIF_LABEL = Object.freeze({
  1: 'Muy Bueno', 2: 'Bueno', 3: 'Medio', 4: 'Pobre', 5: 'Muy Pobre',
});

// Rangos de criticidad por usuarios — MO.00418 Tabla 9 (tope 48.312 anual)
export const CRIT = Object.freeze([
  Object.freeze({ nivel: 'Mínima',   min:     1, max:  9662 }),
  Object.freeze({ nivel: 'Menor',    min:  9663, max: 19324 }),
  Object.freeze({ nivel: 'Moderada', min: 19325, max: 28986 }),
  Object.freeze({ nivel: 'Mayor',    min: 28987, max: 38648 }),
  Object.freeze({ nivel: 'Máxima',   min: 38649, max: 48312 }),
]);

// Tipos de activo del parque
export const TIPOS = Object.freeze(['TX_Potencia', 'TPT_Servicio', 'TX_Respaldo']);

// Nombres humanos por clave de variable
export const VAR_NOMBRE = Object.freeze({
  dga: 'DGA', adfq: 'ADFQ', fur: 'Furanos',
  crg: 'Cargabilidad', pyt: 'Estudios P&T',
  edad: 'Edad', her: 'Hermeticidad',
});

// ══════════════════════════════════════════════════════════════
// Criterios de evaluación 1..5 por variable — MO.00418 Ed.02
// Se renderizan en la sección "Criterios de evaluación" y en la
// ficha de detalle (modal) del activo.
// ══════════════════════════════════════════════════════════════
export const CRITERIOS = Object.freeze({
  dga: Object.freeze({
    ref: '§4.1 Tablas 1–3',
    unidad: 'TDGC (ppm) y C₂H₂ (ppm)',
    nota: 'DGA es compuesta: integra Total de Gases Combustibles (TDGC), CO/CO₂ y Acetileno (C₂H₂). Se muestran los criterios de TDGC y C₂H₂.',
    filas: Object.freeze([
      Object.freeze({ c: 5, r: '∑TDGC ≥ 401  ·  C₂H₂ ≥ 7' }),
      Object.freeze({ c: 4, r: '301 ≤ ∑TDGC < 401  ·  6 ≤ C₂H₂ < 7' }),
      Object.freeze({ c: 3, r: '201 ≤ ∑TDGC < 301  ·  5 ≤ C₂H₂ < 6' }),
      Object.freeze({ c: 2, r: '95 ≤ ∑TDGC < 201  ·  3 ≤ C₂H₂ < 5' }),
      Object.freeze({ c: 1, r: '∑TDGC < 95  ·  C₂H₂ < 3' }),
    ]),
  }),
  adfq: Object.freeze({
    ref: '§4.1.1 Tablas 4–5',
    unidad: 'Rigidez ASTM D1816 (kV) · Índice de Calidad (IC)',
    nota: 'Integra Rigidez Dieléctrica (RD) e Índice de Calidad del aceite (IC = tensión interfacial + número de neutralización).',
    filas: Object.freeze([
      Object.freeze({ c: 5, r: 'RD < 19 kV  ·  IC ≤ 713' }),
      Object.freeze({ c: 4, r: '19 ≤ RD < 20 kV  ·  713 < IC ≤ 999' }),
      Object.freeze({ c: 3, r: '20 ≤ RD < 25 kV  ·  999 < IC ≤ 1130' }),
      Object.freeze({ c: 2, r: '25 ≤ RD < 33 kV  ·  1130 < IC ≤ 1499' }),
      Object.freeze({ c: 1, r: 'RD ≥ 33 kV  ·  IC ≥ 1499' }),
    ]),
  }),
  fur: Object.freeze({
    ref: '§4.1.2 Tabla 6',
    unidad: '2-Furfural 2FAL (ppb)',
    nota: 'Calif. 4 o 5 implica fin de vida útil del papel (irreversible) y reclasificación a juicio del Profesional de Transformadores.',
    filas: Object.freeze([
      Object.freeze({ c: 5, r: '2FAL ≥ 5500 ppb' }),
      Object.freeze({ c: 4, r: '4800 ≤ 2FAL < 5500 ppb' }),
      Object.freeze({ c: 3, r: '3600 ≤ 2FAL < 4800 ppb' }),
      Object.freeze({ c: 2, r: '2400 ≤ 2FAL < 3600 ppb' }),
      Object.freeze({ c: 1, r: '2FAL < 2400 ppb' }),
    ]),
  }),
  crg: Object.freeze({
    ref: '§4.1.3 Tabla 7',
    unidad: '% de carga vs. capacidad nominal',
    nota: 'Calif. 5 obliga reclasificación inmediata del estado de salud a 4 (cercanía a sobrecapacidad).',
    filas: Object.freeze([
      Object.freeze({ c: 5, r: 'Cargabilidad > 90 %' }),
      Object.freeze({ c: 4, r: '75 % < Cargabilidad ≤ 90 %' }),
      Object.freeze({ c: 3, r: '65 % < Cargabilidad ≤ 75 %' }),
      Object.freeze({ c: 2, r: '60 % < Cargabilidad ≤ 65 %' }),
      Object.freeze({ c: 1, r: 'Cargabilidad ≤ 60 %' }),
    ]),
  }),
  edad: Object.freeze({
    ref: '§4.1.4 Tabla 8',
    unidad: 'años desde fabricación',
    nota: 'Vida útil reconocida CREG 085/2018 = 30 años para transformadores de potencia.',
    filas: Object.freeze([
      Object.freeze({ c: 5, r: 'Edad ≥ 30 años' }),
      Object.freeze({ c: 4, r: '26 ≤ Edad < 30 años' }),
      Object.freeze({ c: 3, r: '19 ≤ Edad < 26 años' }),
      Object.freeze({ c: 2, r: '7 ≤ Edad < 19 años' }),
      Object.freeze({ c: 1, r: 'Edad < 7 años' }),
    ]),
  }),
  pyt: Object.freeze({
    ref: '§4.1.6',
    unidad: 'protección eléctrica + telecontrol (cualitativa)',
    nota: 'Escala cualitativa de exposición. 1 = protección integral + SCADA; 5 = sin protección ni telecontrol.',
    filas: Object.freeze([
      Object.freeze({ c: 5, r: 'Sin protección eléctrica ni telecontrol' }),
      Object.freeze({ c: 4, r: 'Exposición alta (protección o telecontrol muy deficiente)' }),
      Object.freeze({ c: 3, r: 'Exposición media (cobertura parcial)' }),
      Object.freeze({ c: 2, r: 'Exposición baja (protección sin telecontrol pleno)' }),
      Object.freeze({ c: 1, r: 'Protección integral + telecontrol (SCADA)' }),
    ]),
  }),
  her: Object.freeze({
    ref: '§4.1.5 Tabla 9',
    unidad: 'localización de fugas (cualitativa)',
    nota: 'Escala por localización e intensidad de fugas observadas en inspección detallada.',
    filas: Object.freeze([
      Object.freeze({ c: 5, r: 'Fugas superiores' }),
      Object.freeze({ c: 4, r: 'Fugas por accesorios' }),
      Object.freeze({ c: 3, r: 'Fugas por junction block' }),
      Object.freeze({ c: 2, r: 'Fugas laterales' }),
      Object.freeze({ c: 1, r: 'Sin fugas' }),
    ]),
  }),
});

// ══════════════════════════════════════════════════════════════
// Mapeo posicional del Excel "Salud de Activos 2026.xlsx"
// Lo usa el parser data/parque_salud_excel.js. Si la estructura
// del documento del cliente cambia, basta editar estos índices.
// ══════════════════════════════════════════════════════════════
export const XLS_SHEETS = Object.freeze([
  Object.freeze({
    sheet: 'TX_Potencia', hr: 0, tipo: 'TX_Potencia',
    cm: Object.freeze({ codigo: 0, serie: 1, potencia: 2, subestacion: 4, matricula: 5, zona: 6, departamento: 7,
        dga: 27, adfq: 35, fur: 37, crg: 45, her: 50, edad: 53, pyt: 54, condicion: 55, macro: 56, usuarios: 59, aliado: 60, causante: 61 }),
  }),
  Object.freeze({
    sheet: 'TPT_Servicio', hr: 1, tipo: 'TPT_Servicio',
    cm: Object.freeze({ codigo: 0, serie: 1, potencia: 2, subestacion: 3, matricula: 4, zona: 5, departamento: 6,
        dga: 23, adfq: 32, fur: 34, crg: 43, her: 50, edad: 53, pyt: null, condicion: 54, macro: 55, usuarios: null, aliado: 58, causante: null }),
  }),
  Object.freeze({
    sheet: 'TX_Respaldo', hr: 1, tipo: 'TX_Respaldo',
    cm: Object.freeze({ codigo: 0, serie: 1, potencia: 2, subestacion: 4, matricula: 5, zona: 6, departamento: 7,
        dga: 23, adfq: 32, fur: 33, crg: 86, her: 82, edad: 85, pyt: 87, condicion: 88, macro: 89, usuarios: null, aliado: null, causante: null }),
  }),
]);
