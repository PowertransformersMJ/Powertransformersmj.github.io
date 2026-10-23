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
 * @returns {null | {clase: 'sinLimite'|'holgado'|'borde'|'ventiladores'|'supera', pctOnan: number|null, pctTope: number|null,
 *   margenA: number|null, margenOnanA: number|null, excesoA: number|null}}
 *   `holgado`: no pasa la ONAN (o, sin ONAN aparte, su único límite); `borde`: no la pasa pero va a `BORDE` % o más de ella
 *   (sin ventiladores le queda poco); `ventiladores`: pasa la ONAN sin pasar la ONAF (necesita los ventiladores); `supera`:
 *   pasa el límite mayor. `margenA` = lo que falta para el límite mayor; `margenOnanA` = lo que falta para la ONAN; `excesoA` =
 *   lo que pasa el límite mayor. null si no hay corriente o el devanado no tiene límite con corriente.
 */
export function lecturaUmbral(i, u) {
  if (!u) return null;
  if (u.sinLimite) return { clase: 'sinLimite', pctOnan: null, pctTope: null, margenA: null, margenOnanA: null, excesoA: null };
  const tope = u.onaf && u.onaf.A > 0 ? u.onaf.A : null;
  if (i == null || !Number.isFinite(i) || tope == null) return null;
  const onan = u.onan && u.onan.A > 0 ? u.onan.A : null;
  const pctTope = 100 * i / tope;
  const pctOnan = onan != null ? 100 * i / onan : null;
  if (i > tope) return { clase: 'supera', pctOnan, pctTope, margenA: null, margenOnanA: null, excesoA: i - tope };
  if (onan != null && i > onan) return { clase: 'ventiladores', pctOnan, pctTope, margenA: tope - i, margenOnanA: null, excesoA: null };
  const clase = onan != null && pctOnan >= BORDE ? 'borde' : 'holgado';
  return { clase, pctOnan, pctTope, margenA: tope - i, margenOnanA: onan != null ? onan - i : null, excesoA: null };
}

/** Desde qué % de la ONAN la carga está «al borde» sin ventiladores: el 90 % de la banda CRG 5 (MO.00418). */
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
