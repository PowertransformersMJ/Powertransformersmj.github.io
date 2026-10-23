// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: cada devanado mes a mes frente a sus límites de PLACA · TODO-69
// ──────────────────────────────────────────────────────────────
// Lo que decide el bloque «Cada devanado: cargabilidad y sus límites de placa» (`ui/cargabilidad-scada/panel-devanados-mes.js`)
// sin tocar el DOM, para poder probarlo: los umbrales de cada devanado (de la placa o, sin placa legible, de la plataforma),
// por qué un devanado no tiene cifra y en qué estado queda a la fecha. Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

const ETIQ = Object.freeze({ ONAN: 'ONAN', ONAF1: 'ONAF', ONAF2: 'ONAF II' });
const de = (lista, d) => (lista || []).find((x) => x.d === d) || null;
const conNiveles = (v) => !!(v && (v.niveles || []).length);

/** % de una corriente frente a un límite ({A}); null si falta alguno. */
export const pctDe = (i, lim) => (i != null && lim && lim.A > 0 ? 100 * i / lim.A : null);

/**
 * Los umbrales de UN devanado: de la placa si los trae (`limitesDePlaca`); si no, la ampacidad y la potencia de la plataforma.
 * `onaf` = el límite MAYOR de la placa (ONAF, ONAF II o, si la placa solo trae una etapa, ONAN); `onan` solo si hay más de
 * una etapa. `tope` = su nombre para los textos («% de ONAF», «% de ONAN», «% de la ampacidad»). `difA`: la ampacidad de la
 * plataforma no es ese límite (más del 2 %); `fueraEscala`: difiere más de 2 veces (un ×10 aplastaría la gráfica).
 * @param {{d: string, A: number, mva: number|null, kv: number|null}} base  el devanado de `devanadosDe` (plataforma)
 * @param {object|null} lp  `limitesDePlaca(placa, tx)` o null
 * Terciario de COMPENSACIÓN (`sinLimite`): la placa no le da carga → sin etapas ni límite; sus cifras se muestran sin %.
 * @returns {{etapas: Array<{nombre, mva, A, origen}>, onaf: {nombre, mva, A, origen}, onan: {nombre, mva, A, origen}|null,
 *   f: number|null, dePlaca: boolean, kv, tope: string, difA: boolean, fueraEscala: boolean, difKv: boolean, kvPlataforma,
 *   compensa: boolean, sinLimite: boolean}}  `origen` de cada corriente: 'impresa' (la graba la placa) o 'calculada'
 */
export function umbralesDevanado(base, lp) {
  const p = lp && lp[base.d];
  if (p && p.sinLimite) {
    const f = base.mva != null && base.A > 0 ? base.mva / base.A : null;
    return { etapas: [], onaf: { nombre: 'sin límite', mva: null, A: null, origen: null }, onan: null, f, dePlaca: true, kv: p.kv, tope: 'sin límite',
      difA: false, fueraEscala: false, difKv: false, kvPlataforma: p.kvPlataforma ?? null, compensa: true, sinLimite: true };
  }
  if (p && p.A && p.A.length) {
    const etapas = p.kva.map((s, k) => ({ nombre: ETIQ[p.nombres[k]] || p.nombres[k], mva: s / 1000, A: p.A[k],
      origen: (p.origenA && p.origenA[k]) || 'calculada' }));
    const onaf = etapas[etapas.length - 1];
    const r = base.A > 0 ? base.A / onaf.A : 1;
    return { etapas, onaf, onan: etapas.length > 1 ? etapas[0] : null, f: onaf.mva / onaf.A, dePlaca: true, kv: p.kv, tope: onaf.nombre,
      difA: Math.abs(r - 1) > 0.02, fueraEscala: r > 2 || r < 0.5, difKv: !!p.difKv, kvPlataforma: p.kvPlataforma ?? null,
      compensa: !!p.compensa, sinLimite: false };
  }
  const f = base.mva != null && base.A > 0 ? base.mva / base.A : null;
  const onaf = { nombre: 'ampacidad', mva: base.mva, A: base.A, origen: 'plataforma' };
  return { etapas: base.A ? [onaf] : [], onaf, onan: null, f, dePlaca: false, kv: base.kv, tope: 'la ampacidad',
    difA: false, fueraEscala: false, difKv: false, kvPlataforma: null, compensa: false, sinLimite: false };
}

/** Por qué un devanado no tiene cifra en una fila: primero el motivo del equipo; si el equipo sí tiene cifra, sin niveles =
 *  sin señal en uso (no se mide o quedó fuera en la homologación) y con niveles = sin horas válidas. */
export function motivoSinCifra(dv, fila) {
  if (fila && fila.pct == null) return fila.motivoNulo || 'sin cifra';
  if (!conNiveles(dv)) return 'sin señal del SCADA en uso para este devanado';
  return 'sin horas válidas de este devanado';
}

/**
 * Estado de cada devanado A LA FECHA, con lo que el bloque necesita.
 * @param {Array} serie  `serieMensualEquipo`
 * @param {Array<{d: string}>} registrados  los devanados del equipo
 * @returns {{algunoLeido: boolean, conCifraEq: object|null, porDevanado: Object<string, {estado: 'cifra'|'sinLectura'|'sinCifra'|'sinSenal',
 *   hoy: object|null, conNiveles: boolean, conCifra: boolean, motivo: string|null, niveles: string[]}>}}
 *   `motivo` (solo `sinCifra` sin ningún mes con cifra) sale del ÚLTIMO mes cargado y leído en que el devanado se mide; nunca
 *   del motivo de un mes hueco ni de otro devanado.
 */
export function estadoDevanados(serie, registrados) {
  const algunoLeido = serie.some((x) => x.cargado && x.leido);
  const conCifraEq = [...serie].reverse().find((x) => x.acumulado && x.acumulado.pct != null) || null;
  const porDevanado = {};
  for (const { d } of registrados) {
    const mideAlguno = serie.some((x) => conNiveles(de(x.mensual.devanados, d)));
    const conCifra = serie.some((x) => { const v = de(x.mensual.devanados, d); return !!(v && v.pct != null); });
    const hoy = conCifraEq ? de(conCifraEq.acumulado.devanados, d) : null;
    const estado = hoy && hoy.pct != null ? 'cifra' : !algunoLeido ? 'sinLectura' : mideAlguno ? 'sinCifra' : 'sinSenal';
    let motivo = null;
    if (mideAlguno && !conCifra) {
      const ult = [...serie].reverse().find((x) => x.cargado && x.leido && conNiveles(de(x.mensual.devanados, d)));
      motivo = ult ? motivoSinCifra(de(ult.mensual.devanados, d), ult.mensual) : 'sin cifra en los meses cargados';
    }
    const niveles = [...new Set(serie.flatMap((x) => { const v = de(x.mensual.devanados, d); return v ? v.niveles || [] : []; }))];
    porDevanado[d] = { estado, hoy, conNiveles: mideAlguno, conCifra, motivo, niveles };
  }
  return { algunoLeido, conCifraEq, porDevanado };
}
