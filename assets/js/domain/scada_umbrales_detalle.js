// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: detalle de los UMBRALES de placa de cada devanado (ONAN / ONAF) · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-23): «me gustaría que exista detalle de los umbrales en las gráficas para una mejor
// interpretación». Lo que decide el resumen en barras de «Cada devanado» (`ui/cargabilidad-scada/panel-devanados-mes.js`)
// sin tocar el DOM: dónde está la carga frente a cada umbral (sin ventiladores, al borde, con ventiladores, por encima), qué
// columnas de etapa lleva la tabla de detalle y cuánto espacio arriba necesita el recuadro de umbrales de cada barra.
// Funciones PURAS. Archivo NUEVO (L-102): el panel lo importa; ningún módulo ya publicado importa de aquí algo que no exista.
// ══════════════════════════════════════════════════════════════

const ORDEN = ['ONAN', 'ONAF', 'ONAF II'];

/**
 * Dónde está una corriente frente a los umbrales de su devanado (`umbralesDevanado`).
 * @param {number|null} i  corriente a la fecha (A)
 * @param {object} u       umbrales del devanado: {onaf, onan, tope, dePlaca, sinLimite}
 * @param {(pct: number) => boolean} [esBorde]  ¿ese % de un umbral ya es «al borde»? La página pasa la banda CRG 5 de los
 *   umbrales de salud configurados (`califCRG(pct) === 5`); por defecto, `BORDE` %.
 * @returns {null | {clase: 'sinLimite'|'holgado'|'borde'|'ventiladores'|'bordeTope'|'supera', pctOnan: number|null,
 *   pctTope: number|null, margenA: number|null, margenOnanA: number|null, excesoA: number|null}}
 *   `holgado`: no pasa la ONAN (o, sin ONAN aparte, su único límite) y está lejos; `borde`: no pasa la ONAN pero está al borde
 *   de ella (sin ventiladores le queda poco); `ventiladores`: pasa la ONAN sin pasar la ONAF (necesita los ventiladores);
 *   `bordeTope`: al borde del límite MAYOR sin pasarlo (con ONAN aparte: ya con ventiladores; sin ella: su único límite, de
 *   placa o la ampacidad de la plataforma); `supera`: pasa el límite mayor. `margenA` = lo que falta para el límite mayor;
 *   `margenOnanA` = lo que falta para la ONAN; `excesoA` = lo que pasa el límite mayor. null si no hay corriente o el
 *   devanado no tiene límite con corriente.
 */
export function lecturaUmbral(i, u, esBorde = (p) => p >= BORDE) {
  if (!u) return null;
  if (u.sinLimite) return { clase: 'sinLimite', pctOnan: null, pctTope: null, margenA: null, margenOnanA: null, excesoA: null };
  const tope = u.onaf && u.onaf.A > 0 ? u.onaf.A : null;
  if (i == null || !Number.isFinite(i) || tope == null) return null;
  const onan = u.onan && u.onan.A > 0 ? u.onan.A : null;
  const pctTope = 100 * i / tope;
  const pctOnan = onan != null ? 100 * i / onan : null;
  const r = (clase, extra = {}) => ({ clase, pctOnan, pctTope, margenA: tope - i, margenOnanA: null, excesoA: null, ...extra });
  if (i > tope) return r('supera', { margenA: null, excesoA: i - tope });
  if (esBorde(pctTope)) return r('bordeTope');
  if (onan != null && i > onan) return r('ventiladores');
  if (onan != null && esBorde(pctOnan)) return r('borde', { margenOnanA: onan - i });
  return r('holgado', { margenOnanA: onan != null ? onan - i : null });
}

/**
 * Un renglón de texto partido en dos por el espacio más cercano al medio si pasa de `max` caracteres (los nombres de abajo de
 * cada barra: con tres devanados en una tarjeta angosta, «sin lectura de los meses» o «90,5 % de la ampacidad» se pisaban).
 * @returns {string[]}
 */
export function partirRenglon(texto, max) {
  const t = String(texto ?? '');
  if (!(max > 0) || t.length <= max) return [t];
  const medio = t.length / 2; let mejor = -1;
  for (let k = 0; k < t.length; k++) if (t[k] === ' ' && (mejor < 0 || Math.abs(k - medio) < Math.abs(mejor - medio))) mejor = k;
  return mejor < 0 ? [t] : [t.slice(0, mejor), t.slice(mejor + 1)];
}

/** «Al borde» por defecto: el 90 % de la banda CRG 5 del MO.00418 (la página usa la banda de los umbrales configurados). */
export const BORDE = 90;

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
 * Factor del tope de la escala para que el recuadro de umbrales (un renglón por umbral) quepa encima del devanado más alto:
 * 1 renglón → 1,255; 2 → 1,33 (el de antes); 3 → 1,405.
 * @param {number} renglones  el mayor número de renglones de un recuadro
 */
export function escalaRotulos(renglones) {
  const n = Math.max(1, Math.min(4, Math.round(Number(renglones) || 0)));
  return 1.18 + 0.075 * n;
}
