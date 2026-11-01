// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · ¿quien mira solo ve? · `99 §198`
// ──────────────────────────────────────────────────────────────
// Rol «visitante»: ve el módulo, sin lo que está en Borrador (paneles de gases y de Duval) y sin
// descargas (CSV ni imagen de las gráficas). Decisiones del Ingeniero 2026-10-30. El guardián de
// sesión marca <html data-rol="visitante"> antes de mostrar la página. Es presentación: lo que el
// visitante puede leer lo deciden las reglas. Archivo NUEVO (L-102): nadie importa por nombre algo
// nuevo de un módulo ya publicado.
// ══════════════════════════════════════════════════════════════

export function soloVer() {
  return document.documentElement.dataset.rol === 'visitante';
}

/** Botones de la barra de las gráficas que se quitan: al visitante, también «descargar imagen». */
export function sinBotones(base) {
  return soloVer() ? [...base, 'toImage'] : base;
}
