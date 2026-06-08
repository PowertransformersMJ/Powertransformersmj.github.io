// ══════════════════════════════════════════════════════════════
// PRUEBAS ELÉCTRICAS — Tendencia temporal (multi-informe) · dominio puro
// ──────────────────────────────────────────────────────────────
// Un transformador acumula VARIOS informes en el tiempo (un código 450108 con
// ensayos de distintos meses/años). Esta capa agrega, por familia de prueba, el
// ESCALAR representativo de cada informe a lo largo del tiempo → una serie
// temporal por métrica, contra su umbral normativo. Revela degradación (p.ej. la
// tan δ subiendo informe a informe, o el aislamiento cayendo).
//
// DETERMINISTA: usa los campos canónicos ya extraídos por informe (los mismos
// que alimentan el scorecard, ver `ui/pruebas/semaforo.js#calificarPrueba`), NO
// depende de que la IA haga nada nuevo. Devuelve "bloques" con el MISMO contrato
// que el render genérico (`ui/pruebas/grafico-generico.js`) → se grafican igual.
//
// Funciones puras, sin DOM ni Firestore. Testeable con node --test.
// ══════════════════════════════════════════════════════════════

import { evaluarMultiNorma } from './pruebas_electricas_multinorma.js';
import { recomendarPrueba, accionPrueba } from './pruebas_electricas_recomendaciones.js';

const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

/* Escalar representativo de una prueba en UN informe (mismo criterio que el
 * scorecard: el peor caso de cada ensayo). Devuelve número o null. */
function escalar(key, inf) {
  if (!inf) return null;
  switch (key) {
    case 'tand': {
      const a = (Array.isArray(inf.tand) ? inf.tand : []).map((t) => numOrNull(t.valor_pct)).filter((v) => v != null);
      return a.length ? Math.max(...a) : null;
    }
    case 'bushing':
      return numOrNull(inf.bushing && inf.bushing.fp_max_pct);
    case 'excitacion':
      return numOrNull(inf.excitacion && inf.excitacion.delta_ext_pct);
    case 'relacion': {
      const a = (Array.isArray(inf.relacion) ? inf.relacion : []).map((r) => numOrNull(r.desviacion_pct)).filter((v) => v != null);
      return a.length ? Math.max(...a.map(Math.abs)) : null;
    }
    case 'resistencia': {
      const a = (Array.isArray(inf.resistencia) ? inf.resistencia : [])
        .filter((r) => !r.no_medido).map((r) => numOrNull(r.delta_max_pct)).filter((v) => v != null);
      return a.length ? Math.max(...a) : null;
    }
    case 'aislamiento': {
      const a = (Array.isArray(inf.aislamiento) ? inf.aislamiento : []).map((x) => numOrNull(x.gohm)).filter((v) => v != null);
      return a.length ? Math.min(...a) : null; // el mínimo es el peor caso
    }
    case 'collar':
      return numOrNull(inf.collar && inf.collar.max_mw);
    default:
      return null;
  }
}

/* Métricas tendenciables: una por familia, con su umbral normativo y dirección
 * (invertir=true cuando el límite es un MÍNIMO, p.ej. aislamiento ≥ 1 GΩ). */
export const METRICAS_TENDENCIA = Object.freeze([
  { key: 'tand',        prueba: 'tand',        titulo: 'Tangente δ máxima',                 unidad: '%',  limite: 1 },
  { key: 'bushing',     prueba: 'bushing',     titulo: 'FP de bujes (C1) máximo',           unidad: '%',  limite: 1 },
  { key: 'excitacion',  prueba: 'excitacion',  titulo: 'Desbalance de corriente de excitación', unidad: '%',  limite: 10 },
  { key: 'relacion',    prueba: 'relacion',    titulo: 'Desviación de relación (máxima)',    unidad: '%',  limite: 0.5 },
  { key: 'resistencia', prueba: 'resistencia', titulo: 'Desbalance de resistencia (máximo)', unidad: '%',  limite: 2 },
  { key: 'aislamiento', prueba: 'aislamiento', titulo: 'Aislamiento mínimo (1 min)',         unidad: 'GΩ', limite: 1, invertir: true },
  { key: 'collar',      prueba: 'collar',      titulo: 'Collar caliente (pérdida máxima)',   unidad: 'mW', limite: 100 }
]);

/* X temporal de un informe: usa el año; cae a la fecha textual si no hay año. */
function ejeX(inf) {
  if (inf.ano != null) return inf.ano;
  if (inf.fecha) return String(inf.fecha);
  return '';
}

/**
 * Construye los bloques de TENDENCIA (uno por métrica) a partir de los informes
 * de un transformador. Cada bloque es una serie temporal vs su umbral, en el
 * contrato del render genérico (mountBloques/renderBloque).
 * @param {Array} informes  informes del transformador (con campos canónicos)
 * @returns {Array} bloques graficables (vacío si no hay >=1 punto)
 */
export function bloquesTendencia(informes) {
  const docs = (Array.isArray(informes) ? informes : []).filter(Boolean)
    .slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  if (!docs.length) return [];

  return METRICAS_TENDENCIA.map((m) => {
    const puntos = docs.map((inf) => {
      const y = escalar(m.key, inf);
      return y == null ? null : { x: ejeX(inf), y: +y.toFixed(4) };
    }).filter(Boolean);
    return { m, puntos };
  }).filter((e) => e.puntos.length).map(({ m, puntos }) => ({
    prueba: m.prueba,
    titulo: `Tendencia — ${m.titulo}`,
    unidad: m.unidad,
    eje_x: 'Informe (año)',
    grafica: 'linea',
    limite: m.limite,
    invertir: m.invertir === true,
    series: [{ nombre: m.titulo, puntos }]
  }));
}

/**
 * Resumen COMPACTO de la tendencia para alimentar a la IA (F3, narrativa). Solo
 * números ya extraídos (determinista) → la IA NO re-lee PDFs; redacta la lectura.
 * Cada métrica trae su umbral, dirección (invertir = límite es mínimo) y la serie
 * temporal {x,y}. Devuelve [] si no hay >=2 puntos en NINGUNA métrica (sin
 * tendencia que narrar). Función pura (sin DOM ni red).
 * @param {Array} informes
 * @returns {Array<{metrica:string, unidad:string, limite:number, invertir:boolean, puntos:Array<{x:(number|string), y:number}>}>}
 */
export function resumenTendenciaParaIA(informes) {
  const bloques = bloquesTendencia(informes);
  const conSerie = bloques
    .map((b) => ({
      metrica: String(b.titulo).replace(/^Tendencia\s*—\s*/, ''),
      unidad: b.unidad || '',
      limite: b.limite,
      invertir: b.invertir === true,
      puntos: ((b.series && b.series[0] && b.series[0].puntos) || [])
    }))
    .filter((m) => m.puntos.length);
  // Sin al menos una métrica con 2+ puntos no hay evolución que narrar.
  const hayTendencia = conSerie.some((m) => m.puntos.length >= 2);
  return hayTendencia ? conSerie : [];
}

/**
 * ANÁLISIS de tendencia de ALTO NIVEL: por métrica, la serie temporal + el
 * veredicto MULTI-NORMA del valor vigente + la recomendación de diagnóstico + la
 * dirección de la tendencia (empeora/mejora/estable) y el Δ vs el informe previo.
 * Es el insumo del diagnóstico de la unidad (no solo "una línea contra un umbral").
 * @param {Array} informes
 * @param {object} [ctx] {minClase} mínimo de aislamiento por clase de tensión
 * @returns {Array<object>}
 */
export function analisisTendencia(informes, ctx = {}) {
  const docs = (Array.isArray(informes) ? informes : []).filter(Boolean)
    .slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  if (!docs.length) return [];
  const minClase = (ctx && typeof ctx.minClase === 'number') ? ctx.minClase : null;
  return METRICAS_TENDENCIA.map((m) => {
    const puntos = docs.map((inf) => {
      const y = escalar(m.key, inf);
      return y == null ? null : { x: ejeX(inf), y: +y.toFixed(4) };
    }).filter(Boolean);
    if (!puntos.length) return null;
    // Cambios AÑO A AÑO (todo el historial, no solo el último) + PROYECCIÓN de la
    // tendencia (ajuste lineal → años hasta cruzar el límite al ritmo actual).
    const cambios = cambiosAnoAno(puntos, m.invertir === true);
    const limProy = m.key === 'aislamiento' ? minClase : LIM_PROY[m.key];
    const proyeccion = proyectarTendencia(puntos, limProy != null ? limProy : null, m.invertir === true);
    const vigente = puntos[puntos.length - 1].y;
    const previo = puntos.length > 1 ? puntos[puntos.length - 2].y : null;
    const mn = evaluarMultiNorma(m.key, vigente, { minClase });
    const estado = mn ? mn.consolidado : null;
    const recomendacion = recomendarPrueba(m.key, { estado, divergen: mn && mn.divergen });
    let delta = null, deltaRel = null, tendencia = null;
    if (previo != null) {
      delta = +(vigente - previo).toFixed(4);
      deltaRel = previo !== 0 ? +(delta / previo * 100).toFixed(2) : null; // % relativo informe→informe
      const estable = Math.abs(delta) <= Math.abs(previo) * 0.02; // ±2% relativo
      if (estable) tendencia = 'estable';
      else {
        const empeora = m.invertir ? (delta < 0) : (delta > 0); // aislamiento: bajar = empeorar
        tendencia = empeora ? 'empeora' : 'mejora';
      }
    }
    // Acción de mantenimiento CLASIFICADA (predictiva/preventiva/correctiva/
    // diagnóstica), sensible a la tendencia (verde que empeora fuerte → predictiva).
    const accion = accionPrueba(m.key, { estado, tendencia, delta: deltaRel, divergen: !!(mn && mn.divergen) });
    return {
      key: m.key, titulo: m.titulo, unidad: m.unidad, invertir: m.invertir === true,
      puntos, vigente, previo, delta, deltaRel, tendencia, cambios, proyeccion,
      estado, divergen: !!(mn && mn.divergen), opticas: mn ? mn.opticas : [],
      recomendacion, accion, relevante: accion.relevante
    };
  }).filter(Boolean);
}

// Límite "titular" por métrica para la proyección (aislamiento usa minClase).
const LIM_PROY = Object.freeze({ tand: 1, bushing: 1, excitacion: 10, relacion: 0.5, resistencia: 2, collar: 100 });

/**
 * Cambios AÑO A AÑO de una serie: por cada par consecutivo, Δ absoluto y relativo
 * y la dirección (empeora/mejora/estable, ±2% relativo). `invertir`=true → bajar
 * es empeorar (aislamiento).
 * @returns {Array<{de:*, a:*, delta:number, deltaRel:(number|null), dir:string}>}
 */
export function cambiosAnoAno(puntos, invertir) {
  const out = [];
  const ps = Array.isArray(puntos) ? puntos : [];
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1], b = ps[i];
    const delta = +(b.y - a.y).toFixed(4);
    const deltaRel = a.y !== 0 ? +(delta / a.y * 100).toFixed(1) : null;
    const estable = Math.abs(deltaRel || 0) <= 2;
    const empeora = invertir ? (delta < 0) : (delta > 0);
    out.push({ de: a.x, a: b.x, delta, deltaRel, dir: estable ? 'estable' : (empeora ? 'empeora' : 'mejora') });
  }
  return out;
}

/**
 * PROYECCIÓN de la tendencia: ajuste lineal (mínimos cuadrados) sobre (año, valor)
 * → pendiente por año y, si se acerca al límite, ESTIMA cuántos años faltan para
 * cruzarlo al ritmo actual. Devuelve {texto, pendiente, anosACruzar, yaFuera}.
 * @param {Array<{x:*, y:number}>} puntos
 * @param {number|null} limite  límite normativo (null si no aplica)
 * @param {boolean} invertir    true = el límite es un MÍNIMO (bajar es malo)
 */
export function proyectarTendencia(puntos, limite, invertir) {
  const ps = Array.isArray(puntos) ? puntos : [];
  if (ps.length < 2) return { texto: 'Un solo informe: aún no hay tendencia (solo una foto).', pendiente: null, anosACruzar: null, yaFuera: false };
  const xs = [], ys = [];
  ps.forEach((p, i) => { const x = Number(p.x); xs.push(Number.isFinite(x) ? x : i); ys.push(p.y); });
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const den = n * sxx - sx * sx;
  if (den === 0) return { texto: 'Sin pendiente calculable.', pendiente: null, anosACruzar: null, yaFuera: false };
  const m = (n * sxy - sx * sy) / den;
  const ult = ys[ys.length - 1];
  const yaFuera = limite != null && (invertir ? ult < limite : ult > limite);
  const haciaLimite = invertir ? m < 0 : m > 0;
  let anosACruzar = null;
  if (limite != null && haciaLimite && Math.abs(m) > 1e-9 && !yaFuera) {
    const a = (limite - ult) / m;
    if (a >= 0) anosACruzar = +a.toFixed(1);
  }
  let texto;
  if (yaFuera) texto = 'Ya fuera de norma — priorizar la acción correctiva.';
  else if (anosACruzar != null) texto = `Al ritmo actual (~${Math.abs(+m.toFixed(3))}/año) cruzaría el límite en ~${anosACruzar} año(s).`;
  else if (haciaLimite) texto = 'Se acerca lentamente al límite; mantener vigilancia.';
  else texto = 'Tendencia estable o favorable; sin proyección de cruce.';
  return { texto, pendiente: +m.toFixed(4), anosACruzar, yaFuera };
}
