// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · CONFIG
// ──────────────────────────────────────────────────────────────
// Constantes canónicas del dashboard SAIDI_E / SAIFI_E:
// paleta por grupo de causa, clasificador por categoría,
// LAYOUT base de Plotly, etiquetas.
// Funciones PURAS · sin DOM · sin I/O.
// ══════════════════════════════════════════════════════════════

// Paleta corporativa
export const COLORS = Object.freeze({
  NAV:    '#0F172A',
  RED:    '#DC2626',
  AMBER:  '#F59E0B',
  GREEN:  '#16A34A',
  BLUE:   '#2563EB',
  TEAL:   '#0D9488',
  PURPLE: '#7C3AED',
  SLATE:  '#94A3B8',
});

// Color por GRUPO de causa (los 3 grupos canónicos del dashboard).
// Invariante normativo: rojo = causa controlable principal.
export const GCOL = Object.freeze({
  'Sobrecarga/Deslastre':   COLORS.RED,
  'Racionamiento/Deficit':  COLORS.PURPLE,
  'Otras causas':           '#CBD5E1',
});

// Orden canónico de los 3 grupos (apilados en charts stack)
export const GRUPOS = Object.freeze([
  'Otras causas',
  'Racionamiento/Deficit',
  'Sobrecarga/Deslastre',
]);

// Clasificador de categoría → color de barra (heatmap, top, etc.)
//   - "SOBRE..." / "Sobrecarga" / contiene "STR"  → ROJO  (sobrecarga)
//   - contiene "Racion"                            → PÚRPURA (racionamiento)
//   - resto                                        → ÁMBAR (deslastre)
export function categoriaColor(cat) {
  const u = String(cat).toUpperCase();
  if (u.includes('SOBRE') || cat === 'Sobrecarga' || u.includes('STR')) return COLORS.RED;
  if (String(cat).includes('Racion')) return COLORS.PURPLE;
  return COLORS.AMBER;
}

// Clasificador grupo abreviado (pill de la tabla top)
export function grupoCorto(cat) {
  return String(cat).includes('Racion') ? 'rac' : 'sob';
}

// Tipografía y layout base Plotly.
//
// IMPORTANTE: Plotly MUTA internamente los objetos `layout` y `font`
// que recibe (les agrega defaults, recalcula tamaños, etc.). Por eso
// estas no son constantes congeladas sino FUNCIONES factory que
// devuelven un objeto FRESCO cada vez — usar Object.freeze rompería
// el render con "Attempted to assign to readonly property".

export function font() {
  return {
    family: '-apple-system, "Segoe UI", Inter, Roboto, sans-serif',
    size: 11,
    color: '#475569',
  };
}

export function layoutBase() {
  return {
    font: font(),
    paper_bgcolor: '#fff',
    plot_bgcolor: '#fff',
    margin: { l: 48, r: 16, t: 10, b: 36 },
    xaxis: { gridcolor: '#F1F5F9', zeroline: false },
    yaxis: { gridcolor: '#F1F5F9', zeroline: false },
    legend: { orientation: 'h', y: -0.18, font: { size: 10 } },
  };
}

export function plotlyCfg() {
  return { responsive: true, displayModeBar: false };
}

// Etiquetas de métricas
export const METRICAS = Object.freeze({
  saidi: { key: 'saidi', nombre: 'SAIDI_E', titulo: 'SAIDI_E (duración)' },
  saifi: { key: 'saifi', nombre: 'SAIFI_E', titulo: 'SAIFI_E (frecuencia)' },
});

export function metricaNombre(met) {
  return METRICAS[met] ? METRICAS[met].nombre : 'SAIDI_E';
}

// Helper: construye la clave dentro de un objeto de zona dado un
// prefijo (grp|cat|total) y la métrica (saidi|saifi).
// Ej.  metKey('grp', 'saifi') → 'grp_saifi'
export function metKey(prefijo, met) {
  return `${prefijo}_${met}`;
}

// Zonas en orden canónico (selector)
export const ZONAS_ORDEN = Object.freeze(['TODAS', 'BOLIVAR', 'OCCIDENTE', 'ORIENTE']);

// Etiquetas humanas de zona para el selector
export function zonaLabel(z) {
  return z === 'TODAS' ? 'Todas las zonas' : z;
}
