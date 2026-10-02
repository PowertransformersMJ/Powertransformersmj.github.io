// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Triángulo de Duval 1 · ¿qué tan firme es la zona? (en ppm) · `99 §131`
// ──────────────────────────────────────────────────────────────────────────────
// La distancia en puntos del triángulo engaña cerca de un vértice: la zona PD mide solo 2 puntos (98–100 % de CH₄),
// así que todo punto PD está «a menos de 2 puntos» de T1 aunque falten cientos de ppm para moverlo. Aquí el margen se
// mide en la unidad del laboratorio: cuántos ppm de UN gas del triángulo (sumando o restando) cambian la zona.
// Revisión de producción del 2026-10-02: con la medida en puntos, 10 de los 13 PD salían «frágiles» y no lo son.
// Archivo NUEVO a propósito (L-102). Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

import { zonaDuval1 } from './dga_duval.js';

const TRIANGULO = Object.freeze(['CH4', 'C2H4', 'C2H2']);
/** Criterio (pendiente del Ingeniero) para avisar que la zona no es firme: el cambio cabe en lo que puede variar entre laboratorios. */
export const CAMBIO_PEQUENO = Object.freeze({ relativo: 0.15, ppmMin: 1 });

const zonaCon = (g, k, d) => {
  const x = { ...g, [k]: g[k] + d };
  const z = zonaDuval1(x.CH4, x.C2H4, x.C2H2);
  return z ? z.zona : null;
};

/** Primer Δ (entre `a`, misma zona, y `b`, otra) donde la zona deja de ser `base`: bisección. */
function afinar(g, k, base, a, b) {
  for (let i = 0; i < 80 && Math.abs(b - a) > 1e-9 * Math.max(1, Math.abs(b)); i++) {
    const m = (a + b) / 2;
    if (zonaCon(g, k, m) === base) a = m; else b = m;
  }
  return b;
}

/**
 * Qué tan firme es la zona: para cada gas del triángulo y cada sentido (sumar / restar), el PRIMER cambio en ppm que
 * lleva el punto a otra zona, medido frente a lo que se midió de ESE gas: rel = |Δ| / máx(15 % de lo medido, 1 ppm).
 * Devuelve la opción de menor `rel` (la más alcanzable por una diferencia de laboratorio); `pequeno` = rel ≤ 1 (criterio).
 * Se compara gas por gas: una traza de acetileno no puede tapar un cambio del metano dentro de su propio 15 % (revisión
 * adversarial del 2026-10-02).
 * @param {{CH4:number, C2H4:number, C2H2:number}} gases  ppm (los tres presentes y ≥ 0)
 * @returns {null | {gas:'CH4'|'C2H4'|'C2H2', delta:number, valor:number, zona:string, rel:number, pequeno:boolean,
 *   opciones:Array<{gas, delta, valor, zona, rel}>}}  delta > 0 suma gas, < 0 lo resta.
 */
export function margenPpm(gases) {
  const g = {};
  for (const k of TRIANGULO) {
    const v = gases && gases[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    g[k] = v;
  }
  const z0 = zonaDuval1(g.CH4, g.C2H4, g.C2H2);
  if (!z0) return null;
  const base = z0.zona; const s = z0.suma;
  const opciones = [];
  const proponer = (k, d, zona) => {
    const tol = Math.max(CAMBIO_PEQUENO.relativo * g[k], CAMBIO_PEQUENO.ppmMin);
    opciones.push({ gas: k, delta: d, valor: g[k], zona, rel: Math.abs(d) / tol });
  };
  for (const k of TRIANGULO) {
    // Sumar gas: rejilla geométrica de 1e-4·S a 1000·S y bisección en el primer cambio.
    let prev = 0;
    for (let i = 0; i <= 1400; i++) {
      const d = s * 1e-4 * Math.pow(10, (7 * i) / 1400);
      if (zonaCon(g, k, d) !== base) { const b = afinar(g, k, base, prev, d); proponer(k, b, zonaCon(g, k, b)); break; }
      prev = d;
    }
    // Restar gas: hasta lo que hay (sin dejar el triángulo vacío).
    if (g[k] > 0) {
      prev = 0;
      for (let i = 1; i <= 1000; i++) {
        const d = -g[k] * (i / 1000);
        const zona = zonaCon(g, k, d);
        if (zona == null) break;
        if (zona !== base) { const b = afinar(g, k, base, prev, d); proponer(k, b, zonaCon(g, k, b)); break; }
        prev = d;
      }
    }
  }
  if (!opciones.length) return null;
  const mejor = opciones.reduce((a, b) => (b.rel < a.rel - 1e-12 ? b : a));
  return { ...mejor, pequeno: mejor.rel <= 1, opciones };
}
