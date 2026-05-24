// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Parque de Transformadores · CÁLCULO
// ──────────────────────────────────────────────────────────────
// Helpers de agregación y bucketización del HI sobre arreglos
// de activos. Funciones PURAS, sin DOM ni I/O.
//
// IMPORTANTE: la fórmula del HI canónica vive en
//   assets/js/domain/salud_activos.js  (calcularHIBruto/aplicarOverrides)
// Aquí se mantiene una `calcHI` legacy SOLO para verificación
// auditable contra el valor de la columna CONDICION del Excel.
// El dashboard NO recalcula HI: muestra el valor del documento.
// ══════════════════════════════════════════════════════════════

import { PESOS, VARS, BUCKETS, BUCKET_NULL, CRIT } from './parque_salud_config.js';

// ── HI: cálculo opcional (verificación) ───────────────────────
// Replica la fórmula del documento original. Solo se usa para
// validar fidelidad con la columna CONDICION del Excel.
export function calcHI(activo) {
  let hi = 0;
  for (const v of VARS) {
    hi += (+activo['calif_' + v.k] || 0) * PESOS[v.k];
  }
  return Math.round(hi * 100) / 100;
}

// ── Bucket por HI numérico ────────────────────────────────────
export function bucketOf(hi) {
  if (hi === null || hi === undefined || Number.isNaN(hi)) {
    return BUCKET_NULL;
  }
  return BUCKETS.find(b => hi < b.max) || BUCKETS[4];
}

// ── Criticidad por usuarios aguas abajo ───────────────────────
export function critNivel(usuarios) {
  const r = CRIT.find(c => usuarios >= c.min && usuarios <= c.max);
  return r ? r.nivel : 'Mínima';
}

export function critIndex(usuarios) {
  const i = CRIT.findIndex(c => usuarios >= c.min && usuarios <= c.max);
  return i < 0 ? 0 : i;
}

// ── Variable dominante de un activo (peor calificada) ─────────
export function domVar(activo) {
  let best = VARS[0], bv = -1;
  VARS.forEach(v => {
    const val = +activo['calif_' + v.k];
    if (!Number.isNaN(val) && val > bv) { bv = val; best = v; }
  });
  return bv < 0 ? '—' : best.n;
}

// ── Filtrar activos con HI evaluado ───────────────────────────
export function evaluados(rows) {
  return rows.filter(a => a.hi != null);
}

// ── HI promedio (sobre activos evaluados) ─────────────────────
export function avgHI(rows) {
  const e = evaluados(rows);
  return e.length ? e.reduce((s, a) => s + a.hi, 0) / e.length : null;
}

// ── Variable con peor calificación media en el conjunto ───────
export function topVar(rows) {
  if (!rows.length) return '—';
  let best = '—', bv = -1;
  VARS.forEach(v => {
    const vals = rows.map(a => a['calif_' + v.k]).filter(x => x != null && !Number.isNaN(x));
    if (!vals.length) return;
    const m = vals.reduce((s, x) => s + x, 0) / vals.length;
    if (m > bv) { bv = m; best = v.n; }
  });
  return best;
}

// ── Mapa Zona → Departamentos del dataset ─────────────────────
// Útil para alimentar los selects en cascada.
export function buildZonaDepto(rows) {
  const m = {};
  rows.forEach(a => { (m[a.zona] = m[a.zona] || new Set()).add(a.departamento); });
  const out = {};
  Object.keys(m).sort().forEach(z => { out[z] = [...m[z]].sort(); });
  return out;
}

// ── Sub-condición por valor medido (criterios MO.00418) ───────
// Tabla 4 — ASTM D1816 · rigidez dieléctrica (kV)
export function condRigidez(kv) {
  return kv < 19 ? 5 : kv < 20 ? 4 : kv < 25 ? 3 : kv < 33 ? 2 : 1;
}
// Tabla 5 — Índice de Calidad del aceite
export function condIC(ic) {
  return ic <= 713 ? 5 : ic <= 999 ? 4 : ic <= 1130 ? 3 : ic <= 1499 ? 2 : 1;
}

// ── Formatos numéricos comunes ────────────────────────────────
export function fmtPct(x) {
  return (Math.round(x * 10) / 10).toFixed(1);
}

// Condición ENTERA por activo (1..5) — para chips/badges
export function fmtCond(x) {
  return (x === null || x === undefined || Number.isNaN(x)) ? '—' : String(Math.round(x));
}

// Promedios agregados — para agrupaciones por zona/depto
export function fmtAvg(x) {
  return (x === null || x === undefined || Number.isNaN(x))
    ? '—'
    : (Math.round(x * 10) / 10).toFixed(1);
}

// Capacidad MVA — formato compacto k cuando supera el umbral
export function fmtMva(x) {
  if (x >= 1000) return (x / 1000).toFixed(2) + 'k';
  return String(Math.round(x * 10) / 10);
}

// ══════════════════════════════════════════════════════════════
// Triángulo de Duval 1 (IEC 60599) — versión legacy del dashboard
// ──────────────────────────────────────────────────────────────
// Preserva la lógica de zonas del archivo standalone original.
// La función del módulo dga_diagnostico.duvalTriangle1 tiene una
// versión simplificada distinta — esta replica las reglas que el
// renderer SVG del modal de ficha usa para dibujar los polígonos
// clipados (mismo conjunto de reglas para que el punto y la zona
// indicada sean coherentes).
//
// Devuelve { M, E, A, zone, sum } o null cuando ∑ ≤ 0.
//   M = % CH4    (vértice superior)
//   A = % C2H2   (vértice inferior izquierdo)
//   E = % C2H4   (vértice inferior derecho)
// ══════════════════════════════════════════════════════════════
export function duvalDashboard(ch4, c2h4, c2h2) {
  ch4 = +ch4 || 0;
  c2h4 = +c2h4 || 0;
  c2h2 = +c2h2 || 0;
  const sum = ch4 + c2h4 + c2h2;
  if (sum <= 0) return null;
  const M = 100 * ch4  / sum;
  const E = 100 * c2h4 / sum;
  const A = 100 * c2h2 / sum;
  let z;
  if (M >= 98) z = 'PD';
  else if (A < 4)             z = (E < 20 ? 'T1' : (E < 50 ? 'T2' : 'T3'));
  else if (E >= 50 && A < 15) z = 'T3';
  else if (A < 13)            z = 'DT';
  else if (E < 23)            z = 'D1';
  else if (A >= 29)           z = 'D2';
  else if (E < 40)            z = 'D2';
  else                        z = 'DT';
  return { M, E, A, zone: z, sum };
}

// Nombres de zona Duval (codigo, label corto)
export const DUVAL_LABELS = Object.freeze({
  PD: Object.freeze(['PD', 'Descarga parcial']),
  D1: Object.freeze(['D1', 'Descargas de baja energía']),
  D2: Object.freeze(['D2', 'Descargas de alta energía (arco)']),
  T1: Object.freeze(['T1', 'Falla térmica < 300 °C']),
  T2: Object.freeze(['T2', 'Falla térmica 300–700 °C']),
  T3: Object.freeze(['T3', 'Falla térmica > 700 °C']),
  DT: Object.freeze(['DT', 'Mezcla de fallas térmicas y eléctricas']),
});
