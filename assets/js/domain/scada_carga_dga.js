// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · «Gases disueltos (DGA) y carga» · `99 §127`
// ──────────────────────────────────────────────────────────────────────────────
// Cruza la CARGA medida por el SCADA en el rango con la calificación DGA de Salud de Activos y da un
// NIVEL DE ATENCIÓN (Rutina … Inmediato) que elige qué adversidades y acciones se muestran.
// Decisiones del Ingeniero (2026-10-01): el panel actúa cerca o por encima de la capacidad (CRG 4–5, carga
// > 75 %; también con 2 h seguidas sobre el 100 %, que es superar la capacidad); por debajo dice «carga
// normal». Sin medición SCADA no hay nivel (la cifra del Excel no sustituye a la medida). La tabla es
// criterio de ingeniería del área sobre IEC 60076-7, IEEE C57.91 e IEC 60599, NO una tabla de norma.
// Los gases son SOLO calificaciones 1–5 (5 = peor): no hay ppm ni fecha de toma, así que no se diagnostica
// el tipo de falla. La columna sale de la DGA OFICIAL (promedio redondeado de TDGC, CO, CO₂ y C₂H₂, como en
// Salud de Activos): el CO y el CO₂ pesan a través de ese promedio, y el panel dice de qué grupo sale.
// Nada se escribe en el parque. Archivo NUEVO a propósito (L-102). Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

import { CONDICIONES } from './schema.js';
import { CALCULO } from './scada_carga_config.js';
import { maxSostenido, estadisticas } from './scada_carga_kpis.js';
import { calcularEvalDGA } from './salud_activos.js';
import { BASELINE_UMBRALES_SALUD } from './umbrales_salud_baseline.js';

/** El panel actúa desde esta calificación de cargabilidad (MO.00418 §A3.4: 4 = más del 75 % hoy). */
export const CRG_ACTUA = 4;
/**
 * Fila severa del panel: 2 h seguidas sobre 1,3 p.u. Es el MENOR tope de corriente de IEC 60076-7:2005 Tabla 4
 * (unidades grandes); en las medianas el tope de corriente es mayor, pero sin temperatura no se sabe si se
 * superó el de punto caliente: criterio conservador del área, nunca «fuera de norma».
 */
export const SEVERA_PCT = 130;

export const NIVELES_ATENCION = Object.freeze([
  Object.freeze({ n: 1, palabra: 'Rutina' }),
  Object.freeze({ n: 2, palabra: 'Seguimiento' }),
  Object.freeze({ n: 3, palabra: 'Atención' }),
  Object.freeze({ n: 4, palabra: 'Prioritario' }),
  Object.freeze({ n: 5, palabra: 'Inmediato' }),
]);

/** Rótulos de las filas armados con las bandas CRG VIGENTES (si un admin las cambia, el rótulo no miente). */
export function filasCarga(umbrales) {
  const c = { ...BASELINE_UMBRALES_SALUD.crg, ...((umbrales && umbrales.crg) || {}) };
  return {
    R1: 'Cerca de la capacidad: más del ' + c.c4_min_excl + ' % (CRG 4)',
    R2: 'En el límite: más del ' + c.c5_min_excl + ' % (CRG 5)',
    R3: 'Sobre la capacidad: ' + CALCULO.sobrecargaMinH + ' h o más seguidas sobre el ' + CALCULO.sobrecargaPct + ' %',
    R4: 'Sobrecarga severa: ' + CALCULO.sobrecargaMinH + ' h o más seguidas sobre el ' + SEVERA_PCT + ' %',
  };
}

/** Columnas de gases. */
export const COLUMNAS_GASES = Object.freeze({
  A: 'Sin calificación DGA',
  B: 'Gases Muy Bueno o Bueno (1–2)',
  C: 'Gases Medio (3)',
  D: 'Gases Pobre o Muy Pobre (4–5)',
  E: 'Acetileno (C₂H₂) en 5',
});

/**
 * Tabla ratificada por el Ingeniero (2026-10-01). La columna E va como la D (MO.00418 §A9.1). R2×B = 4 por
 * decisión suya tras el comité: CRG 5 lleva el índice de salud a 4 o más (MO.00418 §4.1.3). R3×C = 5 la mantuvo
 * aunque en agosto esa columna C sale del CO y el CO₂ (papel) en los 18 casos.
 */
export const MATRIZ_ATENCION = Object.freeze({
  R1: Object.freeze({ A: 3, B: 2, C: 3, D: 4, E: 4 }),
  R2: Object.freeze({ A: 4, B: 4, C: 4, D: 5, E: 5 }),
  R3: Object.freeze({ A: 4, B: 4, C: 5, D: 5, E: 5 }),
  R4: Object.freeze({ A: 5, B: 5, C: 5, D: 5, E: 5 }),
});

export const GRUPOS_DGA = Object.freeze([
  Object.freeze({ k: 'tdgc', nombre: 'Gases combustibles (TDGC)', familia: 'combustibles' }),
  Object.freeze({ k: 'co', nombre: 'Monóxido de carbono (CO)', familia: 'papel' }),
  Object.freeze({ k: 'co2', nombre: 'Dióxido de carbono (CO₂)', familia: 'papel' }),
  Object.freeze({ k: 'c2h2', nombre: 'Acetileno (C₂H₂)', familia: 'acetileno' }),
]);

/** Calificación 1–5 o null (misma regla que el diagnóstico de Salud de Activos, `cargabilidad_diagnostico.js`). */
function calificacion(v) {
  const n = (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) ? Number(v) : NaN;
  return (Number.isFinite(n) && n >= 1 && n <= 5) ? n : null;
}

/** Palabra oficial de la escala (Tabla 11: 1 Muy Bueno … 5 Muy Pobre). */
export function palabraCondicion(v) {
  const c = v == null ? null : CONDICIONES.find((x) => x.value === Math.round(v));
  return c ? c.label : '—';
}

/**
 * Gases del equipo, del MISMO documento del transformador (`salud_actual`). La DGA oficial es la evaluación
 * compuesta `eval_dga`, como en Salud de Activos; si falta pero hay grupos, se calcula con la MISMA regla
 * oficial (calcularEvalDGA) y se dice (`dgaCalculada`). `ts_calculo` es la fecha del CÁLCULO, no la de la
 * toma de la muestra: no se devuelve para no rotularla como tal.
 */
export function leerGases(tx) {
  const sa = (tx && tx.salud_actual) || {};
  const g = {
    dga: calificacion(sa.eval_dga), tdgc: calificacion(sa.calif_tdgc), co: calificacion(sa.calif_co),
    co2: calificacion(sa.calif_co2), c2h2: calificacion(sa.calif_c2h2), dgaCalculada: false,
  };
  g.grupos = GRUPOS_DGA.filter(({ k }) => g[k] != null).length;
  if (g.dga == null && g.grupos) {
    g.dga = calcularEvalDGA({ calif_tdgc: g.tdgc, calif_co: g.co, calif_co2: g.co2, calif_c2h2: g.c2h2 });
    g.dgaCalculada = g.dga != null;
  }
  g.origen = sa.muestra_dga_ref ? 'muestra' : 'salud_activos';
  return g;
}

/**
 * De qué grupos sale la calificación: los que están en 3 o más (o, si ninguno, los que igualan la DGA).
 * @returns {{grupos: string[], familias: Set<string>}}  familias: 'papel' | 'combustibles' | 'acetileno'
 */
export function origenGases(g) {
  const altos = GRUPOS_DGA.filter(({ k }) => g[k] != null && g[k] >= 3);
  return { grupos: altos.map(({ k }) => k), familias: new Set(altos.map(({ familia }) => familia)) };
}

/**
 * Columna de gases. El acetileno en 5 va a su columna (E). Los combustibles (TDGC) en 4–5, que el promedio
 * puede esconder, suben UNA columna. El CO y el CO₂ pesan solo a través del promedio oficial (sin ajuste
 * extra); en 4–5 activan además la advertencia del papel (`papel`).
 * @returns {{col, subio, papel, combustibles, acetileno}}
 */
export function columnaGases(g) {
  const papel = (g.co != null && g.co >= 4) || (g.co2 != null && g.co2 >= 4);
  const combustibles = g.tdgc != null && g.tdgc >= 4;
  const acetileno = g.c2h2 === 5;
  if (acetileno) return { col: 'E', subio: false, papel, combustibles, acetileno };
  if (g.dga == null) return { col: 'A', subio: false, papel, combustibles, acetileno };
  const e = Math.round(g.dga);
  let col = e >= 4 ? 'D' : (e === 3 ? 'C' : 'B');
  let subio = false;
  if (combustibles && col !== 'D') { col = col === 'B' ? 'C' : 'D'; subio = true; }
  return { col, subio, papel, combustibles, acetileno };
}

/**
 * Lo que la fila necesita de la carga del rango, tomado SOLO de los devanados con cifra válida y de la serie
 * LIMPIA de cargabilidad (sin las horas de escala imposible, > 3 × ampacidad): la misma del indicador
 * «Sobre el 100 % sostenido». Un devanado con escala sospechosa (cifra nula) no cuenta. Dice en qué devanado
 * se vio la sobrecarga, cuándo y cuántas horas se descartaron por imposibles.
 * @param {{pct, crg, clase, motivoNulo, motivos?, devMax, niveles:Array, oficial?}} calc  `calcularEquipo` del rango
 * @param {Object<string, {t?:number[], carga?:{serie, excluidas}, sobre?:{horas, primera, ultima}}>} porNivel
 */
export function entradaCarga(calc, porNivel) {
  const base = {
    pct: calc ? calc.pct : null, crg: calc ? calc.crg : null, clase: calc ? calc.clase : 'nulo',
    motivoNulo: calc ? calc.motivoNulo : null, motivos: (calc && calc.motivos) || [], devMax: calc ? calc.devMax : null,
    crgOficial: calc && calc.oficial ? calc.oficial.calif : null,
    horasSobre100: 0, devSobre: null, desde: null, hasta: null, max2h: null, devMax2h: null, picoMax: null, excluidas: [],
  };
  if (!calc || calc.pct == null) return base;
  for (const n of calc.niveles || []) {
    if (!n.devanado || n.pct == null) continue;
    const d = porNivel && porNivel[n.nivel];
    if (!d || !d.carga) continue;
    if (d.carga.excluidas) base.excluidas.push({ dev: n.devanado, h: d.carga.excluidas });   // por devanado: nunca se suman
    if (d.sobre && d.sobre.horas > base.horasSobre100) {
      base.horasSobre100 = d.sobre.horas; base.devSobre = n.devanado;
      base.desde = d.t && d.sobre.primera != null ? d.t[d.sobre.primera] : null;
      base.hasta = d.t && d.sobre.ultima != null ? d.t[d.sobre.ultima] : null;
    }
    const m2 = maxSostenido(d.carga.serie, CALCULO.sobrecargaMinH);
    if (m2 && (base.max2h == null || m2.valor > base.max2h)) { base.max2h = m2.valor; base.devMax2h = n.devanado; }
    const e = estadisticas(d.carga.serie);
    if (e.max != null && (base.picoMax == null || e.max > base.picoMax)) base.picoMax = e.max;
  }
  return base;
}

/**
 * Fila de carga. null = no se calcula (con su motivo); 'R0' = carga normal (el panel no da nivel).
 * R4 solo con cifra FIRME: con cifra provisional (homologación por confirmar, cobertura baja…) un error de
 * escala de la medida podría parecer sobrecarga severa → se queda en R3 con `severaSinConfirmar`.
 * @returns {{fila, motivo?, pico:boolean, severaSinConfirmar:boolean}}
 */
export function franjaCarga(e) {
  if (!e || e.pct == null) return { fila: null, motivo: (e && e.motivoNulo) || 'sin cifra de cargabilidad', pico: false, severaSinConfirmar: false };
  const pico = e.picoMax != null && e.picoMax > CALCULO.sobrecargaPct && !(e.horasSobre100 > 0);
  const severa = e.max2h != null && e.max2h > SEVERA_PCT;
  if (severa && e.clase === 'firme') return { fila: 'R4', pico, severaSinConfirmar: false };
  if (severa || e.horasSobre100 > 0) return { fila: 'R3', pico, severaSinConfirmar: severa };
  if (e.crg === 5) return { fila: 'R2', pico, severaSinConfirmar: false };
  if (e.crg != null && e.crg >= CRG_ACTUA) return { fila: 'R1', pico, severaSinConfirmar: false };
  return { fila: 'R0', pico, severaSinConfirmar: false };
}

/**
 * Nivel de atención del cruce.
 * @returns {null | {n:number, palabra:string, provisional:boolean}}
 */
export function nivelAtencion(fila, col, clase) {
  const fil = MATRIZ_ATENCION[fila];
  if (!fil || fil[col] == null) return null;
  const n = fil[col];
  return { n, palabra: NIVELES_ATENCION[n - 1].palabra, provisional: clase !== 'firme' };
}

/** Grupo del catálogo → condición del cruce. */
const GRUPO_CATALOGO = Object.freeze({ c2h2: 'acetileno', tdgc: 'combustibles', co_co2: 'papel' });

/** ¿Un ítem del catálogo aplica a este cruce? `grupo`: '' (siempre), 'c2h2', 'tdgc' o 'co_co2'. */
export function aplica(item, fila, cg) {
  if (!item.filas.includes(fila) || !item.columnas.includes(cg.col)) return false;
  if (!item.grupo) return true;
  const k = GRUPO_CATALOGO[item.grupo];
  return !!(k && cg[k]);
}

/** Cruce completo, listo para pintar. `catalogo`: {adversidades:[], acciones:[]} (ver scada_carga_dga_textos.js). */
export function cruceDgaCarga(tx, entrada, catalogo) {
  const gases = leerGases(tx);
  const cg = columnaGases(gases);
  const franja = franjaCarga(entrada);
  const actua = !!franja.fila && franja.fila !== 'R0';
  const nivel = actua ? nivelAtencion(franja.fila, cg.col, entrada.clase) : null;
  const sel = (lista) => (actua ? (lista || []).filter((it) => aplica(it, franja.fila, cg)) : []);
  return { gases, columna: cg, origen: origenGases(gases), franja, nivel, adversidades: sel(catalogo && catalogo.adversidades), acciones: sel(catalogo && catalogo.acciones) };
}
