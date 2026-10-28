// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · MES CASI SIN MEDIDA en la firmeza de varios meses (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («Sí, y antes muéstrame quién cambia»): un mes en que el devanado tuvo horas para medir (al menos
// 72 en servicio) pero midió menos de 72 cuenta como mes NO medido, igual que un mes sin ningún dato. Antes contaba como
// «medido con cobertura casi cero» y hundía la cobertura del periodo (Maracayo T1: su medida murió el 26-jun y jul–oct
// trajeron 1–86 h), mientras que un mes sin dato no penalizaba igual. Sigue exigiéndose haber medido al menos la mitad de
// los meses. Resguardo: si eso es lo que vuelve firme al equipo y la cifra o la sobrecarga dependen de esos meses → provisional.
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO } from './scada_carga_config.js';

export const MOTIVO_MES_CASI_SIN_MEDIDA = 'la cifra depende de meses que casi no midieron';

/**
 * ¿El devanado casi no midió ese mes? Midió algo, pero menos de 72 h y menos de la mitad de lo que estuvo en servicio,
 * teniendo al menos 72 h en servicio para medir. Un mes con poco servicio pero bien medido (70 de 80 h) NO es una medida
 * caída (revisión adversarial 2026-10-28).
 * @param {number} n  horas válidas del mes  @param {number} s  horas en servicio del mes (sin las que el parque no cargó)
 */
export function mesCasiSinMedida(n, s) {
  const h = CALCULO.horasMinFirme;
  return n > 0 && n < h && s >= h && n / s < CALCULO.coberturaMinFirme;
}

/** El devanado con la regla de ANTES (sus meses casi sin medida contados como medidos), para `firmeza`. */
export function reglaDeAntes(x) {
  return x && x.coberturaConCasi != null ? { ...x, coberturaFirmeza: x.coberturaConCasi, mesesMedidos: x.mesesMedidosConCasi } : x;
}

/**
 * El motivo de provisional si la regla NUEVA es la que vuelve firme al equipo (`firmeAntes` = false: con la regla de antes,
 * `firmeza` con `reglaDeAntes` en cada devanado, no era firme) y el resultado DEPENDE de los meses casi sin medida: sin
 * ellos la cifra baja —con el medio paso de redondeo de 0,0005 A del resumen guardado— o no queda ninguna, o la señal de
 * sobrecarga de algún devanado baja (`sobreSinMesesCasi`). Si con la regla de antes ya era firme, nada cambia (Puerto
 * Escondido y San Carlos, vista previa 2026-10-28: su cifra bajaba una décima sin el mes de la bahía caída).
 * @param {Array<{pct: number|null, A: number|null, sobre?: number, pctSinMesesCasi?: number|null, sobreSinMesesCasi?: number}>} devanados
 * @param {number|null} pctEq  la cifra del equipo
 * @param {boolean} firmeAntes
 */
export function motivoMesCasiSinMedida(devanados, pctEq, firmeAntes) {
  const con = (devanados || []).filter((x) => x && x.pct != null);
  if (firmeAntes || pctEq == null || !con.some((x) => x.pctSinMesesCasi !== undefined)) return null;
  if (con.some((x) => x.sobreSinMesesCasi !== undefined && (x.sobre || 0) > x.sobreSinMesesCasi)) return MOTIVO_MES_CASI_SIN_MEDIDA;
  let sin = -Infinity;
  for (const x of con) {
    const v = x.pctSinMesesCasi !== undefined ? x.pctSinMesesCasi : x.pct;
    if (v != null && v > sin) sin = v;
  }
  const cifra = con.reduce((a, b) => (b.pct > a.pct ? b : a));
  const tol = cifra.A > 0 ? (100 * 0.0005) / cifra.A : 0;
  return pctEq > sin + tol ? MOTIVO_MES_CASI_SIN_MEDIDA : null;
}
