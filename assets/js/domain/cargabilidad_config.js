// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · Cargabilidad
// Constantes canónicas del dashboard.
// Funciones PURAS · sin DOM · sin I/O.
// ══════════════════════════════════════════════════════════════

// ── Severidad (semáforo normativo) ────────────────────────────
// Umbral según % de cargabilidad sobre ampacidad nominal:
//   > 100%       → cri (crítico · sobrecarga)
//   95–100%      → ale (alerta)
//   80–95%       → avi (aviso preventivo)
//   < 80%        → ok  (normal)
//   sin dato     → nd  (gris)
export const SEVCOL = Object.freeze({
  cri: 'var(--cri)',
  ale: 'var(--ale)',
  avi: 'var(--avi)',
  ok:  'var(--ok)',
  nd:  'var(--ink3)',
});

export const SEVLBL = Object.freeze({
  cri: 'Crítico',
  ale: 'Alerta',
  avi: 'Aviso',
  ok:  'Normal',
  nd:  'Sin dato',
});

// Orden canónico (chips de severidad y agrupación en el donut)
export const SEVERIDADES_ORDEN = Object.freeze(['cri', 'ale', 'avi', 'ok']);

// Umbrales numéricos (inmutables) · referencia para sev()
export const UMBRALES_SEVERIDAD = Object.freeze({
  CRI: 100,   // > 100 % → cri
  ALE: 95,    // >= 95 % → ale
  AVI: 80,    // >= 80 % → avi
  // < 80 % → ok
});

// ── Ventanas de tendencia (modal · drill-down) ────────────────
export const VENTANAS_TREND = Object.freeze(['24h', '7d', '30d']);

// Perfil sintético horario (24h) usado por trend.js cuando no hay
// histórico SCADA. Valores relativos al pico [0..1].
// IMPORTANTE: array CONGELADO solo a nivel raíz. Para usarlo como
// fuente en cálculos usar `[...PROFILE_24H]` o iterar directamente.
export const PROFILE_24H = Object.freeze([
  0.62, 0.58, 0.55, 0.53, 0.52, 0.55, 0.62, 0.71,
  0.78, 0.82, 0.85, 0.87, 0.86, 0.84, 0.83, 0.85,
  0.90, 0.96, 1.00, 0.99, 0.94, 0.86, 0.76, 0.68,
]);

// ── Mapeo de devanados ────────────────────────────────────────
export const DEVANADOS = Object.freeze(['P', 'S', 'T']);
export const DEV_LABEL = Object.freeze({
  P: 'Primario',
  S: 'Secundario',
  T: 'Terciario',
});

// Convierte un código corto P/S/T a su nombre completo
export function nombreDevanado(codigo) {
  return DEV_LABEL[codigo] || codigo;
}
// Inverso: del nombre completo al código corto
export function codigoDevanado(nombre) {
  const lower = String(nombre || '').toLowerCase();
  if (lower.startsWith('prim')) return 'P';
  if (lower.startsWith('sec'))  return 'S';
  if (lower.startsWith('ter'))  return 'T';
  return null;
}

// ── Mapeo diagnóstico DGA / Edad / Furanos / etc. (1..5) ──────
// Coherente con MO.00418 §A9.7 — escala 1 mejor · 5 crítico.
export const DIAG_MAP = Object.freeze({
  1: Object.freeze(['Buena',     'ok']),
  2: Object.freeze(['Aceptable', 'ok']),
  3: Object.freeze(['Media',     'avi']),
  4: Object.freeze(['Alta',      'ale']),
  5: Object.freeze(['Crítica',   'cri']),
});

// Etiquetas humanas para cada métrica del diag
export const DIAG_LABEL = Object.freeze({
  carg: 'Cargabilidad',
  edad: 'Edad',
  dga:  'DGA',
  fur:  'Furanos',
  herm: 'Hermeticidad',
  adfq: 'ADFQ',
  pyt:  'P&T',
});
