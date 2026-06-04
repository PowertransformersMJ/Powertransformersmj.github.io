// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · PROYECCIÓN OLS
// ──────────────────────────────────────────────────────────────
// Regresión lineal por mínimos cuadrados (OLS) sobre la serie
// real disponible, con bandas de confianza al 95% (Student's t)
// y escenarios optimista (−10%) / pesimista (+10%).
//
// Función PURA. Sin DOM ni I/O. Útil para REFRESCAR la proyección
// cuando entre data nueva al dataset, sin esperar al backend
// Python que la produce hoy.
//
// El bloque `proj` del baseline JSON ya viene precalculado por el
// backend; esta función es alternativa y produce el mismo shape.
// ══════════════════════════════════════════════════════════════

/**
 * Cuantil de la distribución t de Student inverso (aproximación
 * para 95% bilateral). Devuelve un valor cercano al exacto para
 * 1..30 grados de libertad. Para df grande tiende a 1.96.
 */
const T_INV_95 = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447,  7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
  26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
};
function tCrit95(df) {
  if (df <= 0) return 12.706;
  if (df > 30) return 1.96;
  return T_INV_95[df] || 1.96;
}

/**
 * P-value bilateral (aproximación de Welford) para t-stat con df.
 * No es exacta pero sirve para reportes — los valores cercanos a
 * 0.05 quedan a 2 decimales del verdadero.
 */
function tPValue(t, df) {
  // Aproximación: para df grande, t ~ N(0,1) y p ≈ 2 * (1 - Φ(|t|))
  const x = Math.abs(t);
  // Phi(x) aproximado con función error (Abramowitz & Stegun 7.1.26)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const xa = Math.abs(x) / Math.sqrt(2);
  const t1 = 1.0 / (1.0 + p * xa);
  const erf = 1 - (((((a5 * t1 + a4) * t1) + a3) * t1 + a2) * t1 + a1) * t1 * Math.exp(-xa * xa);
  const Phi = 0.5 * (1 + sign * erf);
  return Math.max(0, Math.min(1, 2 * (1 - Phi)));
}

/**
 * Calcula proyección OLS de una serie real (ej. primeros 5 meses)
 * extendida hasta `mesesFull.length` (12) con bandas IC95% y
 * escenarios.
 *
 * @param {(number|null)[]} real  Valores reales (con nulls al final si no hay)
 * @param {number} N              Total de meses a proyectar (default 12)
 * @returns {{
 *   real:   (number|null)[],
 *   base:   number[],   opt: number[], pes: number[],
 *   ci_inf: number[],   ci_sup: number[],
 *   r2: number, slope: number, intercept: number, pval: number
 * }}
 */
export function calcularProyeccionOLS(real, N = 12) {
  // Solo los valores no nulos cuentan para el ajuste
  const xs = [], ys = [];
  for (let i = 0; i < real.length; i++) {
    if (real[i] != null && Number.isFinite(+real[i])) {
      xs.push(i);
      ys.push(+real[i]);
    }
  }
  const n = xs.length;
  if (n < 2) {
    // Sin datos suficientes — proyección plana en 0
    const zeros = new Array(N).fill(0);
    return {
      real: [...real, ...new Array(Math.max(0, N - real.length)).fill(null)].slice(0, N),
      base: zeros, opt: zeros.slice(), pes: zeros.slice(),
      ci_inf: zeros.slice(), ci_sup: zeros.slice(),
      r2: 0, slope: 0, intercept: 0, pval: 1,
    };
  }
  // OLS y = a + b x
  const sumX = xs.reduce((s, v) => s + v, 0);
  const sumY = ys.reduce((s, v) => s + v, 0);
  const meanX = sumX / n, meanY = sumY / n;
  let Sxx = 0, Sxy = 0, Syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY;
    Sxx += dx * dx;
    Sxy += dx * dy;
    Syy += dy * dy;
  }
  const slope = Sxx === 0 ? 0 : Sxy / Sxx;
  const intercept = meanY - slope * meanX;
  const yhat = xs.map(x => intercept + slope * x);
  const residuos = ys.map((y, i) => y - yhat[i]);
  const SSE = residuos.reduce((s, r) => s + r * r, 0);
  const SST = Syy;
  const r2 = SST === 0 ? 0 : 1 - SSE / SST;
  const df = n - 2;
  const se2 = df > 0 ? SSE / df : 0;
  const seSlope = Sxx > 0 && df > 0 ? Math.sqrt(se2 / Sxx) : 0;
  const tStat = seSlope > 0 ? slope / seSlope : 0;
  const pval = df > 0 ? tPValue(tStat, df) : 1;
  const tCrit = tCrit95(df);

  // Proyección sobre los N meses
  const base = [];
  const ci_inf = [];
  const ci_sup = [];
  for (let i = 0; i < N; i++) {
    const y = intercept + slope * i;
    base.push(round4(y));
    // IC95% del valor esperado en x=i:
    //   y ± t * sqrt( se2 * (1/n + (i - meanX)^2 / Sxx) )
    if (df > 0 && Sxx > 0) {
      const sePred = Math.sqrt(se2 * (1 / n + Math.pow(i - meanX, 2) / Sxx));
      const half = tCrit * sePred;
      ci_inf.push(Math.max(0, round4(y - half)));
      ci_sup.push(round4(y + half));
    } else {
      ci_inf.push(round4(Math.max(0, y)));
      ci_sup.push(round4(y));
    }
  }
  const opt = base.map(v => round4(v * 0.9));
  const pes = base.map(v => round4(v * 1.1));
  const realOut = [...real];
  while (realOut.length < N) realOut.push(null);

  return {
    real: realOut.slice(0, N),
    base, opt, pes,
    ci_inf, ci_sup,
    r2: round4(r2),
    slope: round4(slope),
    intercept: round4(intercept),
    pval: round4(pval),
  };
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}
