// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · «con más carga»: márgenes y escenarios · `99 §131`
// ──────────────────────────────────────────────────────────────────────────────
// Supuesto (se dice en pantalla): la MISMA curva horaria medida del rango, aumentada PAREJO por un factor f en todas las
// horas y devanados. Con ese supuesto el margen hasta cada fila de la tabla de atención (§127) es una cuenta EXACTA:
//   CRG 4: p99·f > c4  ·  CRG 5: p99·f > c5  ·  2 h sobre 100 %: máx. sostenido·f > 100  ·  2 h sobre 130 %: ídem 130.
// Las pérdidas que dependen de la corriente crecen con f² (las del núcleo no cambian; no es una temperatura).
// El punto del triángulo de Duval NO se proyecta: ninguna norma ni estudio da su trayectoria con la carga.
// Archivo NUEVO a propósito (L-102). Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO } from './scada_carga_config.js';
import { califCRG, horasSostenidasSobre } from './scada_carga_kpis.js';
import { BASELINE_UMBRALES_SALUD } from './umbrales_salud_baseline.js';
import { franjaCarga, nivelAtencion, SEVERA_PCT } from './scada_carga_dga.js';

export const ESCENARIOS_FIJOS = Object.freeze([10, 20, 30]);
export const ESCENARIO_LIBRE_MAX = 100;

const ORDEN_FRANJAS = Object.freeze(['R0', 'R1', 'R2', 'R3', 'R4']);
const bandas = (umbrales) => ({ ...BASELINE_UMBRALES_SALUD.crg, ...((umbrales && umbrales.crg) || {}) });

/**
 * Margen de carga hasta cada fila de la tabla de atención.
 * @param {object} entrada  `entradaCarga(calc, porNivel)` (scada_carga_dga.js)
 * @returns {Array<{fila:'R1'|'R2'|'R3'|'R4', ya:boolean, superada:boolean, f:number|null, pct:number|null}>}  pct = aumento en %
 *   Vacío si no hay cifra. R4 solo con cifra firme (como en la tabla). Una franja por DEBAJO de la actual (franjaCarga,
 *   orden R1 < R2 < R3 < R4) queda `ya` + `superada`: subir hasta ella no cambia el nivel.
 */
export function margenesCarga(entrada, umbrales) {
  if (!entrada || entrada.pct == null || !(entrada.pct > 0)) return [];
  const c = bandas(umbrales);
  const out = [];
  const actual = ORDEN_FRANJAS.indexOf(franjaCarga(entrada).fila);
  const m = (fila, ya0, f) => {
    const superada = ORDEN_FRANJAS.indexOf(fila) < actual;
    const ya = ya0 || superada || ORDEN_FRANJAS.indexOf(fila) === actual;
    out.push({ fila, ya, superada, f: ya || f == null ? null : f, pct: ya || f == null ? null : Math.round((f - 1) * 1000) / 10 });
  };
  m('R1', entrada.crg != null && entrada.crg >= 4, c.c4_min_excl / entrada.pct);
  m('R2', entrada.crg === 5, c.c5_min_excl / entrada.pct);
  const sost = entrada.max2h != null && entrada.max2h > 0;
  m('R3', entrada.horasSobre100 > 0, sost ? CALCULO.sobrecargaPct / entrada.max2h : null);
  if (entrada.clase === 'firme') m('R4', sost && entrada.max2h > SEVERA_PCT, sost ? SEVERA_PCT / entrada.max2h : null);
  return out;
}

/**
 * Escenario «carga aumentada en `aumentoPct` %». Recuenta las horas sobre el 100 % sobre la serie LIMPIA de cada devanado
 * con cifra (umbral 100/f, equivalente a multiplicar la serie por f).
 * @param {object} entrada  `entradaCarga(calc, porNivel)`
 * @param {object} calc  `calcularEquipo` del rango (niveles con devanado y cifra)
 * @param {object} porNivel  niveles del detalle (carga.serie limpia)
 * @param {{col:string}} cg  `columnaGases(leerGases(tx))` de HOY (los gases no se proyectan)
 * @returns {null | {aumentoPct, f, pct, max2h, horasSobre100, perdidas, crg, fila, nivel}}
 */
export function escenarioCarga(entrada, calc, porNivel, cg, aumentoPct, umbrales) {
  if (!entrada || entrada.pct == null || !(aumentoPct >= 0)) return null;
  const f = 1 + aumentoPct / 100;
  let horas = 0;
  for (const n of (calc && calc.niveles) || []) {
    if (!n.devanado || n.pct == null) continue;
    const d = porNivel && porNivel[n.nivel];
    if (!d || !d.carga) continue;
    const h = horasSostenidasSobre(d.carga.serie, CALCULO.sobrecargaPct / f, CALCULO.sobrecargaMinH).horas;
    if (h > horas) horas = h;
  }
  const pct = entrada.pct * f;
  const esc = { ...entrada, pct, crg: califCRG(pct, umbrales), horasSobre100: horas,
    max2h: entrada.max2h == null ? null : entrada.max2h * f, picoMax: entrada.picoMax == null ? null : entrada.picoMax * f };
  const fr = franjaCarga(esc);
  const nivel = fr.fila && fr.fila !== 'R0' && cg ? nivelAtencion(fr.fila, cg.col, entrada.clase) : null;
  return { aumentoPct, f, pct, max2h: esc.max2h, horasSobre100: horas, perdidas: f * f, crg: esc.crg, fila: fr.fila, nivel };
}

/** Corriente de referencia (A) del devanado que manda: p99 del equipo × su ampacidad. Para decir el margen en amperios. */
export function corrienteReferencia(calc) {
  if (!calc || calc.pct == null || !calc.devMax) return null;
  const n = (calc.niveles || []).find((x) => x.devanado === calc.devMax && x.pct != null && x.A > 0);
  return n ? (calc.pct * n.A) / 100 : null;
}
