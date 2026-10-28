// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · MES CASI SIN MEDIDA en la firmeza de varios meses (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («Sí, y antes muéstrame quién cambia»): un mes en que el devanado tuvo horas para medir (al menos
// 72 en servicio) pero midió menos de 72 cuenta como mes NO medido, igual que un mes sin ningún dato. Antes contaba como
// «medido con cobertura casi cero» y hundía la cobertura del periodo (Maracayo T1: su medida murió el 26-jun y jul–oct
// trajeron 1–86 h), mientras que un mes sin dato no penalizaba igual. Sigue exigiéndose haber medido al menos la mitad de
// los meses. Resguardo: si eso es lo que la vuelve firme y la cifra BAJA al quitar esos meses (depende de ellos) → provisional.
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO } from './scada_carga_config.js';

export const MOTIVO_MES_CASI_SIN_MEDIDA = 'la cifra depende de meses que casi no midieron';

/**
 * ¿El devanado casi no midió ese mes? Midió algo, pero menos de 72 h, teniendo al menos 72 h en servicio para medir.
 * @param {number} n  horas válidas del mes  @param {number} s  horas en servicio del mes (sin las que el parque no cargó)
 */
export function mesCasiSinMedida(n, s) {
  const h = CALCULO.horasMinFirme;
  return n > 0 && n < h && s >= h;
}

/**
 * El motivo de provisional si la regla NUEVA es la que vuelve firme la cifra y la cifra DEPENDE de los meses casi sin
 * medida. Depende: sin ellos (`pctSinMesesCasi` de cada devanado que los tuvo; los demás, su cifra) la cifra baja —con el
 * medio paso de redondeo de 0,0005 A del resumen guardado— o no queda ninguna. La regla nueva la vuelve firme: el devanado
 * que da la cifra, contando esos meses como medidos (`coberturaConCasi`, la regla de antes), no llegaba a la cobertura
 * mínima. Si con la regla de antes ya cumplía, nada cambia (Puerto Escondido y San Carlos, vista previa 2026-10-28: su
 * cifra bajaba una décima sin el mes de la bahía caída y eran firmes antes).
 * @param {Array<{pct: number|null, A: number|null, pctSinMesesCasi?: number|null, coberturaConCasi?: number}>} devanados  los de `calcularEquipo`
 * @param {number|null} pctEq  la cifra del equipo
 */
export function motivoMesCasiSinMedida(devanados, pctEq) {
  const con = (devanados || []).filter((x) => x && x.pct != null);
  if (pctEq == null || !con.some((x) => x.pctSinMesesCasi !== undefined)) return null;
  const cifra = con.reduce((a, b) => (b.pct > a.pct ? b : a));
  if (!(cifra.coberturaConCasi != null && cifra.coberturaConCasi < CALCULO.coberturaMinFirme)) return null;
  let sin = -Infinity;
  for (const x of con) {
    const v = x.pctSinMesesCasi !== undefined ? x.pctSinMesesCasi : x.pct;
    if (v != null && v > sin) sin = v;
  }
  const tol = cifra.A > 0 ? (100 * 0.0005) / cifra.A : 0;
  return pctEq > sin + tol ? MOTIVO_MES_CASI_SIN_MEDIDA : null;
}
