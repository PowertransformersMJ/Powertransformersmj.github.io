// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Evaluación MULTI-NORMA · dominio puro
// ──────────────────────────────────────────────────────────────
// Un veredicto robusto NO sale de una sola norma: cada estándar mira la prueba
// desde un ángulo distinto. Esta capa evalúa la métrica peor-caso de cada prueba
// contra CADA norma aplicable y devuelve:
//   · `opticas`: el veredicto por norma (con su umbral citado),
//   · `consolidado`: el PEOR (más conservador) — la seguridad pesa sobre el "pasa por poco",
//   · `divergen`: si las normas NO coinciden (esa divergencia ES información).
// Mirror del marco `skills/pruebas-electricas/_conocimiento/marco-normativo-multinorma.md`.
//
// El veredicto sale del VALOR medido contra la NORMA — nunca del texto del informe
// ni de la IA (L-36). Funciones puras, sin DOM ni Firestore. node --test.
// ══════════════════════════════════════════════════════════════

import {
  ESTADOS,
  calificarTanDelta, calificarExcitacion, calificarRelacion,
  calificarResistencia, calificarCollar
} from './pruebas_electricas_semaforo.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

// Criterio "máximo" genérico: investiga al pasar `inv`, rechaza al pasar `bad`
// (si `bad` es null, nunca llega a rojo por esta óptica).
const maxBanda = (inv, bad) => (v) => {
  v = num(v);
  if (v == null) return ESTADOS.NEUTRAL;
  if (bad != null && v > bad) return ESTADOS.ROJO;
  if (v > inv) return ESTADOS.NARANJA;
  return ESTADOS.VERDE;
};

// Criterio "mínimo" (aislamiento): cae bajo el mínimo → investigar. El mínimo
// puede depender del contexto (clase de tensión).
const minBanda = (getMin) => (v, ctx) => {
  v = num(v);
  const m = getMin(ctx || {});
  if (v == null || m == null) return ESTADOS.NEUTRAL;
  return v < m ? ESTADOS.NARANJA : ESTADOS.VERDE;
};

/* ─── Catálogo de criterios por familia (una óptica por norma) ───
 * Cada óptica: { norma, umbral(texto|fn), evaluar?(valor,ctx)→ESTADOS, nota? }.
 * Sin `evaluar` ⇒ óptica informativa (cualitativa / requiere otro dato): aporta
 * contexto pero no entra en el consolidado. Reusa los calificadores del dominio
 * donde la óptica coincide con el umbral ya probado. */
export const CRITERIOS_MULTINORMA = Object.freeze({
  tand: [
    { norma: 'ANSI/NETA ATS Tabla 100.3', umbral: '≤0.5% (aceite mineral)', evaluar: maxBanda(0.5, 1) },
    { norma: 'IEEE 62 / C57.152', umbral: '≤1% (0.5–1 investigar)', evaluar: calificarTanDelta, nota: 'guía + tendencia' }
  ],
  bushing: [
    { norma: 'ANSI/NETA §7.2.2.D.5', umbral: 'tan δ ≤1% · vs placa: FP>50% / C1>5%', evaluar: maxBanda(0.5, 1) },
    { norma: 'IEEE C57.19.01 / Doble', umbral: '≤0.5% bueno · 0.5–1 investigar · >1 crítico', evaluar: calificarTanDelta, nota: 'orientativa; ΔC1 vs placa manda en seguridad' }
  ],
  excitacion: [
    { norma: 'ANSI/NETA §7.2.2.D.6', umbral: 'patrón 2+1 (2 laterales ~iguales + central menor)', nota: 'criterio cualitativo — sin % normativo duro' },
    { norma: 'IEEE C57.152', umbral: 'vs fábrica/previos/fases (tendencia)', evaluar: (v) => calificarExcitacion(num(v)), nota: 'cambio de decenas de % vs baseline = alarma' }
  ],
  relacion: [
    { norma: 'ANSI/NETA §7.2.2.D.3', umbral: '≤0.5% vs teórica/placa', evaluar: calificarRelacion },
    { norma: 'IEEE C57.152 §7.2.10', umbral: '±0.5% (coincide con NETA)', evaluar: calificarRelacion, nota: 'mismo umbral; énfasis en tendencia' }
  ],
  resistencia: [
    { norma: 'ANSI/NETA ATS §7.2.2.D.8', umbral: '≤2% entre fases / vs fábrica', evaluar: (v) => calificarResistencia(num(v)) },
    { norma: 'Práctica industria (Doble/Megger)', umbral: '≤3%', evaluar: maxBanda(2.4, 3), nota: 'sanity-check' },
    { norma: 'IEEE C57.152 / C57.12.90', umbral: 'método (I≤10% In) + tendencia', nota: 'sin % duro' },
    { norma: 'MO.00418 por clase', umbral: '⚠️ verificar (edición del director)', nota: 'verificar' }
  ],
  aislamiento: [
    { norma: 'ANSI/NETA Tabla 100.5', umbral: '≥5 GΩ (>5 kV, líquido) · piso absoluto', evaluar: minBanda(() => 5) },
    { norma: 'Por clase (MO.00418 / C57.152)', umbral: (ctx) => (ctx && ctx.minClase != null) ? `≥${ctx.minClase} GΩ (clase de tensión)` : '≥ por clase', evaluar: minBanda((ctx) => ctx.minClase != null ? ctx.minClase : null), nota: '⚠️ verificar · criterio primario' },
    { norma: 'IEEE C57.152 (PI/DAR/tendencia)', umbral: 'PI≥1.5 · DAR>1.6 · tendencia', nota: 'requiere PI/DAR del informe' }
  ],
  collar: [
    { norma: 'ANSI/NETA §7.2.2.D.5', umbral: '<100 mW por sección', evaluar: maxBanda(100, null) }
  ]
});

/**
 * Evalúa la métrica peor-caso de una prueba contra TODAS sus normas.
 * @param {string} familia  clave de prueba (tand/bushing/excitacion/relacion/resistencia/aislamiento/collar)
 * @param {number} valor    métrica peor-caso (max tan δ %, max desbalance %, min GΩ, …)
 * @param {object} [ctx]     { minClase } mínimo de aislamiento por clase de tensión
 * @returns {{opticas:Array, consolidado:object, divergen:boolean}|null}
 */
export function evaluarMultiNorma(familia, valor, ctx = {}) {
  const defs = CRITERIOS_MULTINORMA[familia];
  if (!defs) return null;
  const opticas = defs.map((d) => ({
    norma: d.norma,
    umbral: (typeof d.umbral === 'function') ? d.umbral(ctx) : d.umbral,
    estado: d.evaluar ? d.evaluar(valor, ctx) : ESTADOS.NEUTRAL,
    nota: d.nota || null
  }));
  // Solo las ópticas con veredicto real (nivel ≥ 0) entran al consolidado.
  const evaluables = opticas.filter((o) => o.estado && o.estado.nivel >= 0);
  const consolidado = evaluables.length
    ? evaluables.reduce((peor, o) => (o.estado.nivel > peor.nivel ? o.estado : peor), evaluables[0].estado)
    : ESTADOS.NEUTRAL;
  const divergen = new Set(evaluables.map((o) => o.estado.nivel)).size > 1;
  return { opticas, consolidado, divergen };
}

/**
 * Métrica peor-caso de una prueba a partir de las mediciones canónicas del
 * informe (la misma que alimenta el scorecard). Devuelve número o null.
 * @param {string} key  familia
 * @param {object} inf  informe con campos canónicos
 * @returns {number|null}
 */
export function metricaPrueba(key, inf) {
  if (!inf) return null;
  switch (key) {
    case 'tand': {
      const a = (Array.isArray(inf.tand) ? inf.tand : []).map((t) => num(t.valor_pct)).filter((v) => v != null);
      return a.length ? Math.max(...a) : null;
    }
    case 'bushing':
      return num(inf.bushing && inf.bushing.fp_max_pct);
    case 'excitacion':
      return num(inf.excitacion && inf.excitacion.delta_ext_pct);
    case 'relacion': {
      const a = (Array.isArray(inf.relacion) ? inf.relacion : []).map((r) => num(r.desviacion_pct)).filter((v) => v != null);
      return a.length ? Math.max(...a.map(Math.abs)) : null;
    }
    case 'resistencia': {
      const a = (Array.isArray(inf.resistencia) ? inf.resistencia : [])
        .filter((r) => !r.no_medido).map((r) => num(r.delta_max_pct)).filter((v) => v != null);
      return a.length ? Math.max(...a) : null;
    }
    case 'aislamiento': {
      const a = (Array.isArray(inf.aislamiento) ? inf.aislamiento : []).map((x) => num(x.gohm)).filter((v) => v != null);
      return a.length ? Math.min(...a) : null;
    }
    case 'collar':
      return num(inf.collar && inf.collar.max_mw);
    default:
      return null;
  }
}
