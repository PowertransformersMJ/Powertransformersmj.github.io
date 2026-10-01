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
