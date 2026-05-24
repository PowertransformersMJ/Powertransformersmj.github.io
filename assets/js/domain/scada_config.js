// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · CONFIG SCADA
// ──────────────────────────────────────────────────────────────
// Parámetros y catálogos canónicos del dashboard de violaciones
// U1/U2. Funciones PURAS · sin DOM · sin I/O.
//
// Fuente: extractor Python del SOE diario de ABB NCS.
//   Filtro:  F(B3) LIKE swTr%
//            AND col.A IS EMPTY
//            AND STATUS = APPEAR
//            AND TAG IN (U1, U2)
// ══════════════════════════════════════════════════════════════

export const VOLTAGE_PARAMS = Object.freeze(new Set(['voltage_RS', 'voltage_ST', 'voltage_TR']));
export const CURRENT_PARAMS = Object.freeze(new Set(['current_R', 'current_S', 'current_T']));
export const POWER_PARAMS   = Object.freeze(new Set(['active_power', 'reactive_power', 'apparent_power']));

// Magnitudes soportadas. magnitudeOf devuelve la familia del parámetro.
export function magnitudeOf(param) {
  if (VOLTAGE_PARAMS.has(param)) return 'voltage';
  if (CURRENT_PARAMS.has(param)) return 'current';
  if (POWER_PARAMS.has(param))   return 'power';
  return 'other';
}

// Mapeo del ELEMENT del SOE original a parámetro normalizado + unidad
export const ELEM_MAP = Object.freeze({
  'U RS': Object.freeze(['voltage_RS', 'kV']),
  'U ST': Object.freeze(['voltage_ST', 'kV']),
  'U TR': Object.freeze(['voltage_TR', 'kV']),
  'I R':  Object.freeze(['current_R',  'A']),
  'I S':  Object.freeze(['current_S',  'A']),
  'I T':  Object.freeze(['current_T',  'A']),
  'P':    Object.freeze(['active_power',   'MW']),
  'Q':    Object.freeze(['reactive_power', 'MVAr']),
  'S':    Object.freeze(['apparent_power', 'MVA']),
});

// Parámetros del heatmap (top 15 subestaciones × parámetro)
export const HEATMAP_PARAMS = Object.freeze([
  'voltage_RS', 'voltage_ST', 'voltage_TR',
  'current_R',  'current_S',  'current_T',
  'apparent_power',
]);

// Paleta del bump chart (15 colores cíclicos)
export const BUMP_COLORS = Object.freeze([
  '#DC2626', '#2563EB', '#0D9488', '#F59E0B', '#7C3AED',
  '#DB2777', '#0891B2', '#65A30D', '#9333EA', '#E11D48',
  '#0EA5E9', '#CA8A04', '#A21CAF', '#1D4ED8', '#B91C1C',
]);

// Colores asignados a zonas operativas
export const ZONA_COLORS = Object.freeze({
  NORTE:     '#0D9488',
  OCCIDENTE: '#2563EB',
  BOLIVAR:   '#F59E0B',
  SIN_ZONA:  '#94A3B8',
});

// Cabeceras esperadas del SOE
export const SOE_HEADERS = Object.freeze({
  REQUIRED: Object.freeze(['A', 'FECHA_RTU', 'B3', 'DESCRIPTION', 'STATUS', 'TAG']),
  ALL: Object.freeze([
    'A', 'FECHA_RTU', 'FECHA_SYSTEM',
    'B1', 'B2', 'B3', 'ELEMENT', 'DESCRIPTION',
    'STATUS', 'B1_NAME',
    'TAG', 'OPERATOR', 'ZONA',
  ]),
});

// Patrón "medido límite unidad" del campo DESCRIPTION
export const DESC_PATTERN = /^\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+([A-Za-z%/]+)\s*$/;

// Claves de persistencia local
export const PERSIST = Object.freeze({
  DB_NAME:  'scada_db_v1',
  DB_STORE: 'kv',
  K_EVENTS: 'extra_events',
  K_HISTORY: 'loaded_files',
  // Claves legacy de localStorage para migración
  LS_EVENTS:  'scada_extra_events_v1',
  LS_HISTORY: 'scada_loaded_files_v1',
});
