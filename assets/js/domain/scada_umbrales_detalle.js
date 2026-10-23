// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: detalle de los UMBRALES de placa de cada devanado (ONAN / ONAF) · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-23): «me gustaría que exista detalle de los umbrales en las gráficas para una mejor
// interpretación». Lo que decide el resumen en barras de «Cada devanado» (`ui/cargabilidad-scada/panel-devanados-mes.js`)
// sin tocar el DOM: dónde está la carga frente a cada umbral (sin ventiladores, con ventiladores, por encima), qué columnas
// de etapa lleva la tabla de detalle y si el rótulo de la ONAN debe ir bajo su línea para no pisar el de la ONAF.
// Funciones PURAS. Archivo NUEVO (L-102): el panel lo importa; ningún módulo ya publicado importa de aquí algo que no exista.
// ══════════════════════════════════════════════════════════════

const ORDEN = ['ONAN', 'ONAF', 'ONAF II'];

/**
 * Dónde está una corriente frente a los umbrales de su devanado (`umbralesDevanado`).
 * @param {number|null} i  corriente a la fecha (A)
 * @param {object} u       umbrales del devanado: {onaf, onan, tope, dePlaca, sinLimite}
 * @returns {null | {clase: 'sinLimite'|'holgado'|'ventiladores'|'supera', pctOnan: number|null, pctTope: number|null,
 *   margenA: number|null, excesoA: number|null}}
 *   `holgado`: no pasa la ONAN (o, sin ONAN aparte, su único límite); `ventiladores`: pasa la ONAN sin pasar la ONAF (necesita
 *   los ventiladores); `supera`: pasa el límite mayor. `margenA` = lo que falta para el límite mayor; `excesoA` = lo que lo pasa.
 *   null si no hay corriente o el devanado no tiene límite con corriente.
 */
export function lecturaUmbral(i, u) {
  if (!u) return null;
  if (u.sinLimite) return { clase: 'sinLimite', pctOnan: null, pctTope: null, margenA: null, excesoA: null };
  const tope = u.onaf && u.onaf.A > 0 ? u.onaf.A : null;
  if (i == null || !Number.isFinite(i) || tope == null) return null;
  const onan = u.onan && u.onan.A > 0 ? u.onan.A : null;
  const pctTope = 100 * i / tope;
  const pctOnan = onan != null ? 100 * i / onan : null;
  if (i > tope) return { clase: 'supera', pctOnan, pctTope, margenA: null, excesoA: i - tope };
  const clase = onan != null && i > onan ? 'ventiladores' : 'holgado';
  return { clase, pctOnan, pctTope, margenA: tope - i, excesoA: null };
}

/**
 * Columnas de etapa de la tabla de detalle: las etapas que traen los devanados, en orden ONAN → ONAF → ONAF II, y al final
 * «ampacidad» si algún devanado no tiene placa legible (su límite es la ampacidad de la plataforma).
 * @param {Array<{d: string}>} registrados
 * @param {Object<string, {etapas: Array<{nombre: string}>}>} U
 * @returns {string[]}
 */
export function columnasEtapas(registrados, U) {
  const hay = new Set();
  for (const b of registrados || []) for (const e of ((U && U[b.d]) || {}).etapas || []) hay.add(e.nombre);
  const out = ORDEN.filter((n) => hay.has(n));
  for (const n of hay) if (!ORDEN.includes(n) && n !== 'ampacidad') out.push(n);
  if (hay.has('ampacidad')) out.push('ampacidad');
  return out;
}

/**
 * ¿El rótulo de la ONAN va DEBAJO de su línea? Sí cuando queda a menos de `cerca` (fracción de la escala) del límite mayor:
 * así los dos rótulos no se pisan (el del límite mayor va encima de su línea).
 * @param {number|null} onan  valor de la ONAN en la escala de la gráfica
 * @param {number|null} tope  valor del límite mayor
 * @param {number} maxY       tope de la escala
 * @param {number} [cerca=0.1]
 */
export function onanDebajo(onan, tope, maxY, cerca = 0.1) {
  if (onan == null || tope == null || !(maxY > 0)) return false;
  return Math.abs(tope - onan) < cerca * maxY;
}
