// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · cálculos (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Unidades: corriente por fase en A, tensión de línea en kV, P en MW y Q en Mvar TOTALES.
// Solo se usan horas VÁLIDAS (códigos 0 y 10, con `validos`). Un agregado sin datos da
// null, nunca 0 (L-104).
//
// Cargabilidad de un DEVANADO (criterio del sistema, MO.00418 §A3.4: corriente / ampacidad):
//   I_f(h)   = corriente de la fase más cargada en la hora h (al menos 2 fases válidas);
//   pct_d(h) = 100 · I_f(h) / A_d, con A_d = electrico.corriente_nominal_{primaria|secundaria|terciaria}_a;
//   CARGA_d  = estadístico del periodo (p99 por defecto: «valor que se supera solo el 1 % del
//              tiempo»; reproduce la carga oficial 2025, medido). Una hora con I_f > 3·A_d es
//              escala equivocada y se excluye.
// Cargabilidad del EQUIPO = máximo de los devanados medidos (nunca se suman niveles).
// Calificación CRG: la función ratificada `calcularCalifCRG` (bandas MO.00418).
// Sobrecarga física: bandera APARTE, solo si se SOSTIENE ≥ 2 h por encima del 100 %.
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO, FAMILIAS_I, FAMILIAS_U, CODIGO } from './scada_carga_config.js';
import { validos } from './scada_carga_limpieza.js';
import { calcularCalifCRG } from './salud_activos.js';

const finitos = (arr) => { const o = []; for (let i = 0; i < arr.length; i++) if (Number.isFinite(arr[i])) o.push(arr[i]); return o; };

/** Percentil por rango más cercano sobre valores YA ordenados (asc). */
export function percentilOrdenado(orden, q) {
  if (!orden.length) return null;
  const pos = Math.min(orden.length - 1, Math.max(0, Math.ceil(q * orden.length) - 1));
  return orden[pos];
}

/** Estadísticos de una serie horaria (NaN = sin dato). Índices referidos a la serie. */
export function estadisticas(arr) {
  const v = finitos(arr);
  if (!v.length) return { n: 0, p50: null, p95: null, p98: null, p99: null, max: null, iMax: null, min: null, iMin: null, prom: null };
  const orden = [...v].sort((a, b) => a - b);
  let iMax = -1; let iMin = -1;
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) continue;
    if (iMax < 0 || arr[i] > arr[iMax]) iMax = i;
    if (iMin < 0 || arr[i] < arr[iMin]) iMin = i;
  }
  let suma = 0; for (const x of v) suma += x;
  return {
    n: v.length, p50: percentilOrdenado(orden, 0.5), p95: percentilOrdenado(orden, 0.95), p98: percentilOrdenado(orden, 0.98),
    p99: percentilOrdenado(orden, 0.99), max: arr[iMax], iMax, min: arr[iMin], iMin, prom: suma / v.length
  };
}

/** Corriente de la fase más cargada por hora (NaN con menos de 2 fases válidas). */
export function iFaseMax(fam) {
  const vs = FAMILIAS_I.map((f) => (fam[f] ? validos(fam[f]) : null));
  const n = (vs.find(Boolean) || []).length;
  const out = new Float32Array(n).fill(NaN);
  let unaFalta = 0;
  for (let h = 0; h < n; h++) {
    let mx = -Infinity; let k = 0;
    for (const s of vs) if (s && Number.isFinite(s[h])) { k++; if (s[h] > mx) mx = s[h]; }
    if (k >= CALCULO.minFasesValidas) { out[h] = mx; if (k === 2) unaFalta++; }
  }
  return { serie: out, unaFalta };
}

/**
 * Máximo SOSTENIDO: el mayor valor que se mantiene durante N horas seguidas (máx sobre ventanas
 * del mínimo de la ventana). {valor, idx} con idx = inicio de la ventana; null si no hay ventana.
 */
export function maxSostenido(arr, N) {
  let mejor = null; let idx = null;
  for (let i = 0; i + N <= arr.length; i++) {
    let mn = Infinity; let ok = true;
    for (let j = i; j < i + N; j++) { if (!Number.isFinite(arr[j])) { ok = false; break; } mn = Math.min(mn, arr[j]); }
    if (ok && (mejor == null || mn > mejor)) { mejor = mn; idx = i; }
  }
  return mejor == null ? null : { valor: mejor, idx };
}

/** Horas en ventanas de N horas seguidas por encima de `umbral` (y la primera y la última). */
export function horasSostenidasSobre(arr, umbral, N) {
  const marca = new Uint8Array(arr.length);
  let run = 0;
  for (let h = 0; h < arr.length; h++) {
    run = (Number.isFinite(arr[h]) && arr[h] > umbral) ? run + 1 : 0;
    if (run >= N) for (let j = h - run + 1; j <= h; j++) marca[j] = 1;
  }
  let horas = 0; let primera = null; let ultima = null;
  for (let h = 0; h < marca.length; h++) if (marca[h]) { horas++; if (primera == null) primera = h; ultima = h; }
  return { horas, primera, ultima };
}

const mediana = (v) => (v.length ? percentilOrdenado([...v].sort((a, b) => a - b), 0.5) : null);

/**
 * Resumen FÍSICO de un nivel (sin ampacidad): lo que guarda el importador por mes y lo que la
 * página calcula para el rango. La cargabilidad se obtiene después dividiendo por la ampacidad.
 * @param {Object<string, {v, m, b}>} fam  series del nivel (mismo largo)
 * @param {number} kv  tensión nominal del nivel
 */
export function resumenFisico(fam, kv) {
  const { serie: iF, unaFalta } = iFaseMax(fam);
  const n = iF.length;
  const est = estadisticas(iF);
  const sost = maxSostenido(iF, CALCULO.sobrecargaMinH);
  // Horas fuera de servicio (no son hueco) y cobertura sobre las horas en servicio.
  let des = 0;
  const ref = fam.IR || fam.IS || fam.IT;
  if (ref) for (let h = 0; h < n; h++) if (ref.m[h] === CODIGO.DESENERGIZADO) des++;
  const serv = n - des;
  // Potencias y tensión.
  const P = fam.P ? validos(fam.P) : null;
  const Q = fam.Q ? validos(fam.Q) : null;
  const Us = FAMILIAS_U.map((f) => (fam[f] ? validos(fam[f]) : null)).filter(Boolean);
  const S = new Float32Array(n).fill(NaN);
  const Uprom = new Float32Array(n).fill(NaN);
  const Sui = new Float32Array(n).fill(NaN);
  const pVal = [];
  for (let h = 0; h < n; h++) {
    if (P && Q && Number.isFinite(P[h]) && Number.isFinite(Q[h])) S[h] = Math.hypot(P[h], Q[h]);
    if (P && Number.isFinite(P[h])) pVal.push(P[h]);
    let su = 0; let k = 0;
    for (const u of Us) if (Number.isFinite(u[h])) { su += u[h]; k++; }
    if (k) Uprom[h] = su / k;
    // Para S por U·I se usa la corriente PROMEDIO de las fases (no la más cargada).
    let si = 0; let ki = 0;
    for (const f of FAMILIAS_I) { const s = fam[f]; if (s && (s.m[h] === CODIGO.VALIDO || s.m[h] === CODIGO.RETENIDO)) { si += s.v[h]; ki++; } }
    if (k && ki >= 2) Sui[h] = Math.sqrt(3) * Uprom[h] * (si / ki) / 1000;
  }
  const comparables = [];
  for (let h = 0; h < n; h++) if (Number.isFinite(S[h]) && Number.isFinite(Sui[h]) && S[h] > 0) comparables.push(Sui[h] / S[h]);
  const sP = Math.sign(mediana(pVal) || 0) || 1;
  let flujoInverso = 0;
  if (P) for (let h = 0; h < n; h++) if (Number.isFinite(P[h]) && sP * P[h] < 0) flujoInverso++;
  return {
    horas: n, servicio: serv, desenergizadas: des,
    i: { n: est.n, p50: est.p50, p95: est.p95, p98: est.p98, p99: est.p99, max: est.max, iMax: est.iMax, min: est.min, prom: est.prom, unaFalta },
    sostenida: sost,
    cobertura: serv > 0 ? est.n / serv : null,
    s: estadisticas(S),
    rUI: comparables.length >= CALCULO.minHorasComparables ? mediana(comparables) : null,
    u: estadisticas(Uprom),
    kv, sP, flujoInverso
  };
}

/** Atribución de escala para un devanado con su ampacidad (null si no hay ampacidad). */
export function atribuirEscala(resumen, A) {
  if (!(A > 0) || !resumen || !resumen.i || resumen.i.n === 0) return 'sin_dato';
  const r99 = resumen.i.p99 / A; const r50 = resumen.i.p50 / A;
  const escalaI = r99 > CALCULO.escalaIp99 || r50 > CALCULO.escalaIp50;
  const escalaPQ = resumen.rUI != null && (resumen.rUI < CALCULO.bandaUIS[0] || resumen.rUI > CALCULO.bandaUIS[1]);
  if (escalaI && escalaPQ) return 'ESCALA_INDETERMINADA';
  if (escalaI) return 'ESCALA_I';
  if (escalaPQ) return 'ESCALA_PQ';
  return 'ok';
}

/** Cargabilidad (%) de un devanado con el estadístico elegido; null sin ampacidad o sin datos. */
export function cargabilidad(resumen, A, estadistico = CALCULO.estadistico) {
  if (!(A > 0) || !resumen || !resumen.i || resumen.i[estadistico] == null) return null;
  return 100 * resumen.i[estadistico] / A;
}

/** Calificación CRG 1-5 con las bandas ratificadas del MO.00418 (umbrales activos o baseline). */
export function califCRG(pct, umbrales) {
  if (pct == null || !Number.isFinite(pct)) return null;
  return calcularCalifCRG({ crg_pct: pct }, umbrales).calif;
}

/**
 * Serie horaria de cargabilidad (%) de un devanado, excluyendo el tope físico (I > 3·A).
 * @returns {{serie: Float32Array, excluidas: number}}
 */
export function serieCargabilidad(iF, A) {
  const out = new Float32Array(iF.length).fill(NaN);
  let excluidas = 0;
  if (!(A > 0)) return { serie: out, excluidas };
  for (let h = 0; h < iF.length; h++) {
    if (!Number.isFinite(iF[h])) continue;
    if (iF[h] > CALCULO.topeFisicoXAmpacidad * A) { excluidas++; continue; }
    out[h] = 100 * iF[h] / A;
  }
  return { serie: out, excluidas };
}

/** Potencia aparente horaria S = √(P² + Q²) (MVA). */
export function serieS(fam) {
  const P = fam.P ? validos(fam.P) : null; const Q = fam.Q ? validos(fam.Q) : null;
  const n = (P || Q || []).length;
  const out = new Float32Array(n).fill(NaN);
  for (let h = 0; h < n; h++) if (P && Q && Number.isFinite(P[h]) && Number.isFinite(Q[h])) out[h] = Math.hypot(P[h], Q[h]);
  return out;
}

/** Factor de potencia horario |P|/S (solo con S ≥ 2 % de la referencia) y sus agregados. */
export function factorPotencia(fam, sRef) {
  const P = fam.P ? validos(fam.P) : null;
  const S = serieS(fam);
  const n = S.length;
  const fp = new Float32Array(n).fill(NaN);
  let sumP = 0; let sumS = 0; let iMin = null;
  const piso = sRef > 0 ? CALCULO.fpMinFraccionS * sRef : 0;
  const pisoMin = sRef > 0 ? CALCULO.fpMinFraccionSMin * sRef : 0;
  for (let h = 0; h < n; h++) {
    if (!P || !Number.isFinite(S[h]) || !(S[h] > 0) || S[h] < piso) continue;
    fp[h] = Math.abs(P[h]) / S[h];
    sumP += Math.abs(P[h]); sumS += S[h];
    if (S[h] >= pisoMin && (iMin == null || fp[h] < fp[iMin])) iMin = h;
  }
  return { serie: fp, prom: sumS > 0 ? sumP / sumS : null, min: iMin == null ? null : fp[iMin], iMin };
}

/** Desbalance de corriente horario (%): 100·máx|I_k − Ī|/Ī con 3 fases y Ī ≥ 5 % de A. */
export function desbalanceI(fam, A) {
  const s = FAMILIAS_I.map((f) => (fam[f] ? validos(fam[f]) : null));
  const n = (s.find(Boolean) || []).length;
  const out = new Float32Array(n).fill(NaN);
  for (let h = 0; h < n; h++) {
    if (s.some((x) => !x || !Number.isFinite(x[h]))) continue;
    const m = (s[0][h] + s[1][h] + s[2][h]) / 3;
    if (!(m > 0) || (A > 0 && m < CALCULO.desbalanceMinFraccionA * A)) continue;
    out[h] = 100 * Math.max(...s.map((x) => Math.abs(x[h] - m))) / m;
  }
  return out;
}

/** Desequilibrio de tensión horario (%): 100·máx|U_k − Ū|/Ū con las 3 tensiones de línea. */
export function desequilibrioU(fam) {
  const s = FAMILIAS_U.map((f) => (fam[f] ? validos(fam[f]) : null));
  const n = (s.find(Boolean) || []).length;
  const out = new Float32Array(n).fill(NaN);
  for (let h = 0; h < n; h++) {
    if (s.some((x) => !x || !Number.isFinite(x[h]))) continue;
    const m = (s[0][h] + s[1][h] + s[2][h]) / 3;
    if (!(m > 0)) continue;
    out[h] = 100 * Math.max(...s.map((x) => Math.abs(x[h] - m))) / m;
  }
  return out;
}

/** ¿Tridevanado con carga en el terciario? (tensión Y ampacidad terciarias; si no, el terciario es de estabilización). */
export function esTridevanado(placa) {
  return !!(placa && placa.T && placa.T.kv > 0 && placa.T.A > 0);
}

/**
 * ¿Se mide el devanado que lleva la carga? En dos devanados basta uno; en un tridevanado
 * hace falta el primario, o el secundario y el terciario a la vez.
 */
export function mideLaCarga(placa, devanadosMedidos) {
  const d = new Set(devanadosMedidos || []);
  if (!d.size) return false;
  if (!esTridevanado(placa)) return true;
  return d.has('P') || (d.has('S') && d.has('T'));
}

/**
 * FIRMEZA de la cifra del equipo. firme = true solo si se cumple TODO; si no, los motivos.
 * @param {{estadoHomologacion, esCircuito, devanados: Array<{d, A, cobertura, n, escala}>, placa, mesesFallidos}} ctx
 */
export function firmeza(ctx) {
  const motivos = [];
  if (!['automatica', 'confirmada'].includes(ctx.estadoHomologacion)) motivos.push('homologación por confirmar');
  if (ctx.esCircuito && ctx.estadoHomologacion !== 'confirmada') motivos.push('se mide un circuito, no el transformador');
  const usados = (ctx.devanados || []).filter((x) => x.pct != null);
  if (!usados.length) motivos.push('sin dato en ningún devanado');
  if ((ctx.devanados || []).some((x) => !(x.A > 0))) motivos.push('falta la ampacidad de un devanado');
  if (!mideLaCarga(ctx.placa, usados.map((x) => x.d))) motivos.push('no se mide el devanado que lleva la carga');
  if (usados.some((x) => x.cobertura != null && x.cobertura < CALCULO.coberturaMinFirme)) motivos.push('cobertura menor al 50 %');
  if (usados.some((x) => x.n < CALCULO.horasMinFirme)) motivos.push('menos de 72 horas válidas');
  // Con solo 2 de 3 fases la fase más cargada puede ser la que falta: la cifra es un mínimo, no firme.
  if (usados.some((x) => x.n > 0 && (x.unaFalta || 0) / x.n > CALCULO.maxFraccionDosFases)) motivos.push('falta una fase en la mayoría de las horas');
  if ((ctx.devanados || []).some((x) => x.escala === 'ESCALA_I' || x.escala === 'ESCALA_INDETERMINADA')) motivos.push('escala de la corriente sospechosa');
  if ((ctx.mesesFallidos || []).length) motivos.push('un mes del rango no se pudo leer');
  return { firme: motivos.length === 0, motivos };
}
