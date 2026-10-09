// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · PERIODO de varios meses e HISTORIA de un equipo (dominio puro) · `99 §159`
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-09): ver el parque en un RANGO de meses («un espectro a nivel general») y, por equipo,
// desde cuándo supera su capacidad y el día de su mayor corriente en cada devanado. Sus decisiones:
//   · la lista muestra la CARGA DEL PERIODO (p99 de TODAS sus horas, exacto) y al lado su PEOR MES;
//   · el periodo se elige por MESES (hasta 12); las fechas exactas por día siguen en el detalle;
//   · «empezó a superar» = 2 h seguidas sobre el 100 % (la sobrecarga sostenida del módulo), con la primera hora
//     suelta como nota;
//   · los meses PROVISIONALES cuentan igual que los firmes (se rotulan, no se excluyen).
// El p99 del periodo sale de las horas más altas que cada resumen mensual guarda (`top`, `TOP_HORAS`): con meses
// cargados sin esas horas, la cifra del periodo se pide «preparar» en vez de inventarse. Un mes que el PARQUE no cargó
// (p. ej. mayo) no cuenta para la cobertura, ni los días que aún no cargó de un mes incompleto; uno que vino para el
// parque y no para el equipo, sí (es un hueco suyo). Por devanado solo cuentan los niveles que dan cifra en su mes.
// Funciones PURAS. Archivo NUEVO (L-102): la lista y el detalle lo cargan con import().
// ══════════════════════════════════════════════════════════════════════════════

import { FAMILIAS, CALCULO, DEVANADO } from './scada_carga_config.js';
import { horasMes, msRotulo, deBytesF32, recortarRango, ventanaDeMes } from './scada_carga_series.js';
import { iFaseMax, serieCargabilidad, horasSostenidasSobre } from './scada_carga_kpis.js';
import { calcularEquipo, filaDeTransformador, indicePorMatricula } from './scada_carga_vista.js';
import { conteosHomologacion, analizarClaveHomologada, claveEfectiva } from './scada_carga_homologacion.js';
import { claveId } from './scada_carga_csv.js';

/** Meses por periodo (el mismo tope del detalle): con 90 horas por mes el p99 sale exacto hasta 8.928 h. */
export const MAX_MESES_PERIODO = 12;
const TOP_MIN = 90;   // = TOP_HORAS del importador; aquí solo para saber hasta dónde alcanza (sin importarlo: L-102)
const TOPE_IMPOSIBLE = CALCULO.topeFisicoXAmpacidad * 100;

/** Horas más altas guardadas → Float32Array (de mayor a menor); null si no hay. Acepta Bytes de Firestore, Uint8Array o lista. */
export function topsDe(t) {
  if (t == null) return null;
  if (typeof t.toUint8Array === 'function') return deBytesF32(t.toUint8Array());
  if (t instanceof Uint8Array) return deBytesF32(t);
  if (Array.isArray(t)) return Float32Array.from(t);
  return null;
}

/**
 * p99 de la UNIÓN de varios meses, con el mismo rango más cercano de `estadisticas` (posición ⌈0,99·N⌉ − 1).
 * @param {Array<{n: number, top: Float32Array|null}>} partes  horas válidas del mes y sus horas más altas
 * @returns {{n: number, p99: number|null, exacto: boolean}}  exacto = false si a algún mes con horas le faltan las suyas
 */
export function p99DePeriodo(partes) {
  let N = 0; let completo = true; const v = [];
  for (const p of partes || []) {
    const n = p && p.n ? p.n : 0;
    if (!n) continue;
    N += n;
    if (!p.top || p.top.length < Math.min(n, TOP_MIN)) { completo = false; continue; }
    for (const x of p.top) if (Number.isFinite(x)) v.push(x);
  }
  if (!N) return { n: 0, p99: null, exacto: true };
  const pos = Math.min(N - 1, Math.max(0, Math.ceil(0.99 * N) - 1));
  const k = N - pos;                       // 1 = el máximo
  if (!completo || k > v.length) return { n: N, p99: null, exacto: false };
  v.sort((a, b) => b - a);
  return { n: N, p99: Math.round(v[k - 1] * 1000) / 1000, exacto: true };
}

const pond = (pares) => { let s = 0; let w = 0; for (const [x, n] of pares) if (x != null && Number.isFinite(x) && n > 0) { s += x * n; w += n; } return w ? s / w : null; };
const mayor = (a, b) => (b == null ? a : (a == null || b > a ? b : a));

/**
 * Resumen de UN punto para el periodo, por nivel, con la forma del resumen mensual (lo que `calcularEquipo` espera).
 * Exactos: n, p99 (de `top`), máx, máximo sostenido, horas, en servicio, desenergizadas, cobertura, horas con 2 fases.
 * Aproximados (solo los usan los avisos de escala y de relación entre niveles): p50 y rUI (promedio ponderado por horas).
 * @param {Array<{mes: string, r: object|null, noCargadas?: number}>} porMes  `resumen.claves[cid]` de cada mes que el
 *   parque cargó; `noCargadas` = horas de los días de ese mes que el PARQUE aún no cargó (no son hueco del equipo)
 * @returns {{porNivel: Object<string, object>, faltaTop: Object<string, string[]>}}
 */
export function resumenPeriodo(porMes) {
  const niveles = new Set();
  for (const x of porMes || []) if (x && x.r) for (const nv of Object.keys(x.r)) niveles.add(nv);
  const porNivel = {}; const faltaTop = {};
  for (const nv of niveles) {
    let n = 0; let horas = 0; let serv = 0; let des = 0; let unaFalta = 0; let fi = 0; let sP = 0;
    let max = null; let sost = null; let sMax = null; let sP99 = null;
    const p50 = []; const prom = []; const rUI = []; const uProm = []; const partes = []; const sinTop = [];
    for (const { mes, r, noCargadas } of porMes) {
      const x = r && r[nv];
      // Los días que el parque no cargó no cuentan, como un mes no cargado (el resumen los trae como horas del mes).
      const fuera = noCargadas > 0 ? noCargadas : 0;
      // El mes vino para el parque pero no trae este nivel del punto: es un hueco de SU medición (pesa en la cobertura).
      if (!x) { const h = Math.max(0, horasMes(mes) - fuera); horas += h; serv += h; continue; }
      const i = x.i || {};
      const nm = i.n || 0;
      n += nm; unaFalta += i.unaFalta || 0; fi += x.flujoInverso || 0; sP += (x.sP || 1) * Math.max(1, nm);
      horas += Math.max(0, (x.horas || 0) - fuera); serv += Math.max(0, (x.servicio != null ? x.servicio : (x.horas || 0)) - fuera); des += x.des || 0;
      max = mayor(max, i.max); sost = mayor(sost, x.sost && x.sost.v); sMax = mayor(sMax, x.sMax); sP99 = mayor(sP99, x.sP99);
      p50.push([i.p50, nm]); prom.push([i.prom, nm]); rUI.push([x.rUI, nm]); uProm.push([x.uProm, nm]);
      const top = topsDe(x.top);
      if (nm && !top) sinTop.push(mes);
      partes.push({ n: nm, top });
    }
    const p = p99DePeriodo(partes);
    if (sinTop.length) faltaTop[nv] = sinTop;
    porNivel[nv] = {
      i: { n, p50: pond(p50), p95: null, p98: null, p99: p.p99, max, iMax: null, prom: pond(prom), unaFalta },
      sost: sost == null ? null : { v: sost, idx: null },
      horas, servicio: serv, des, cob: serv > 0 ? Math.round((n / serv) * 1000) / 1000 : null,
      sMax, sP99, rUI: pond(rUI), uProm: pond(uProm), sP: sP < 0 ? -1 : 1, flujoInverso: fi, desde: null
    };
  }
  return { porNivel, faltaTop };
}

const conSost = (x) => !!(x && (x.sobrecargaSostenida || x.sobrecargaProvisional));
const enPeriodo = (x) => !!(x && (conSost(x) || x.picoAislado));

// Un nivel CUENTA en un mes con la misma compuerta de `calcularEquipo` (`cuentan`, `99 §129`): el equipo tiene cifra ese
// mes (no es un circuito sin confirmar ni una homologación excluida) y el nivel la suya (escala válida, con ampacidad).
// Si además trae horas imposibles (> 3 × ampacidad, con el mismo medio paso de redondeo), su máximo y su sobrecarga no
// salen del resumen —que es de la corriente en bruto— sino de la curva limpia del mes.
const tolNivel = (n) => (100 * 0.0005) / n.A;
export const nivelCuenta = (x, n) => !!(x && x.pct != null && n && n.devanado && n.pct != null && n.A > 0);
export const nivelConImposibles = (n) => n.picoPct != null && n.picoPct + tolNivel(n) > TOPE_IMPOSIBLE;

/**
 * Lo que dicen los meses de UN equipo (las filas mensuales de la lista, ya verificadas): peor mes, meses en CRG 4–5,
 * primer mes con sobrecarga sostenida y con alguna hora sobre el 100 %, y por devanado su mayor corriente CONFIABLE,
 * desde qué mes supera su capacidad y en cuántos meses. Los meses provisionales cuentan igual (decisión del Ingeniero):
 * cada dato dice de qué clase fue su mes.
 * @param {Array<{mes: string, fila: object|null, r: object|null}>} meses  en orden; `r` = resumen.claves[cid] del mes
 * @param {{hayAntes?: boolean}} [opc]  hayAntes = el punto tiene meses cargados ANTES del primero de la lista: entonces
 *   «desde el primer mes» es «desde el inicio del periodo», no «desde el inicio de los datos»
 */
export function agregadosDeMeses(meses, { hayAntes = false } = {}) {
  const porMes = (meses || []).map(({ mes, fila: x }) => (x ? {
    mes, pct: x.pct, clase: x.clase, crg: x.crg, motivoNulo: x.motivoNulo || null, motivos: x.motivos || [],
    sost: conSost(x), pico: !!x.picoAislado,
    porConfirmar: x.verificacion === 'fallo' || !!(x.sobrecargaPorVerificar && x.sobrecargaPorVerificar.length)
  } : { mes, pct: null, clase: 'nulo', crg: null, motivoNulo: 'sin datos', motivos: [], sost: false, pico: false, porConfirmar: false }));
  const conCifra = porMes.filter((m) => m.pct != null);
  const peorMes = conCifra.reduce((a, b) => (a == null || b.pct > a.pct ? b : a), null);
  // Primer mes con alguna hora de corriente medida (no basta con que el mes exista para el punto).
  const primerConDato = porMes.find((m, k) => ((meses[k].fila && meses[k].fila.niveles) || []).some((n) => n.n > 0)) || null;
  const primeraSost = porMes.find((m) => m.sost) || null;
  const primeraHora = (meses || []).map(({ fila }, k) => (enPeriodo(fila) ? porMes[k] : null)).find(Boolean) || null;
  // Por devanado, solo con los niveles que cuentan. El resumen guarda el máximo horario de cada nivel y su hora (iMax).
  const porDev = {};
  for (const { mes, fila: x, r } of meses || []) {
    if (!x || !r) continue;
    for (const n of x.niveles || []) {
      const rn = r[n.nivel];
      if (!nivelCuenta(x, n) || !n.n) continue;
      const g = porDev[n.devanado] || (porDev[n.devanado] = {
        devanado: n.devanado, nombre: DEVANADO[n.devanado], nivel: n.nivel, A: n.A,
        max: null, pct: null, mes: null, idx: null, ms: null, clase: null,
        imposibles: [], primeraSost: null, mesesSost: 0, mesesConDato: 0
      });
      g.mesesConDato++;
      if (nivelConImposibles(n)) { g.imposibles.push({ mes, nivel: n.nivel, A: n.A, clase: x.clase }); continue; }
      if (n.sostenidaPct != null && n.sostenidaPct - tolNivel(n) > CALCULO.sobrecargaPct) {
        g.mesesSost++;
        if (!g.primeraSost) g.primeraSost = { mes, nivel: n.nivel, A: n.A, clase: x.clase };
      }
      if (!rn || !rn.i || rn.i.max == null) continue;
      const pct = (100 * rn.i.max) / n.A;
      if (g.pct != null && g.pct >= pct) continue;
      Object.assign(g, { nivel: n.nivel, A: n.A, max: rn.i.max, pct, mes, idx: rn.i.iMax, ms: rn.i.iMax != null && rn.i.iMax >= 0 ? msRotulo(mes, rn.i.iMax) : null, clase: x.clase });
    }
  }
  const devanados = ['P', 'S', 'T'].map((d) => porDev[d]).filter(Boolean);
  // La mayor corriente del equipo: la mayor CONFIABLE de sus devanados; si algún mes trae horas imposibles, su máximo
  // limpio puede ser mayor y queda «por confirmar» (la historia del detalle lo resuelve con la curva).
  const imposibles = devanados.flatMap((d) => d.imposibles.map((m) => m.mes));
  const conCifraDev = devanados.filter((d) => d.pct != null);
  const mayor = conCifraDev.reduce((a, b) => (a == null || b.pct > a.pct ? b : a), null);
  const mayorCorriente = mayor ? { ...mayor, porConfirmar: imposibles.length > 0, mesesPorConfirmar: [...new Set(imposibles)].sort() }
    : (imposibles.length ? { devanado: devanados.find((d) => d.imposibles.length).devanado, max: null, pct: null, mes: null, ms: null, clase: null, porConfirmar: true, mesesPorConfirmar: [...new Set(imposibles)].sort() } : null);
  const desdeElPrimero = !!primeraSost && !!primerConDato && primeraSost.mes === primerConDato.mes;
  return {
    porMes, peorMes, mesesConCifra: conCifra.length, mesesCRG45: conCifra.filter((m) => m.crg >= 4).length,
    mesesSostenida: porMes.filter((m) => m.sost).length,
    primerMesConDato: primerConDato ? primerConDato.mes : null,
    primeraSostenida: primeraSost ? { mes: primeraSost.mes, clase: primeraSost.clase, inicioDatos: desdeElPrimero && !hayAntes, inicioPeriodo: desdeElPrimero && hayAntes } : null,
    primeraHora: primeraHora ? { mes: primeraHora.mes, clase: primeraHora.clase } : null,
    devanados, mayorCorriente, porConfirmar: porMes.filter((m) => m.porConfirmar).length
  };
}

/**
 * Horas de los días que el PARQUE aún no cargó en cada mes INCOMPLETO del periodo (p. ej. octubre con 7 de 31 días):
 * igual que un mes no cargado, no son hueco de ningún equipo. Solo en periodos de VARIOS meses: un mes solo se ve
 * igual que en «Un mes» (allí un mes incompleto es provisional por su cobertura). Los meses completos (≥ 90 % de sus
 * días) no se tocan: su día suelto sin cargar cuenta como en la lista del mes.
 * @returns {Object<string, number>}
 */
export function horasNoCargadas(catalogo, meses) {
  const out = {};
  if (!catalogo || !catalogo.meses || !meses || meses.length < 2) return out;
  for (const m of meses) {
    const c = catalogo.meses[m];
    if (!c || c.completo || typeof c.dias !== 'string') continue;
    const faltan = c.dias.length - (c.dias.match(/1/g) || []).length;
    if (faltan > 0) out[m] = faltan * 24;
  }
  return out;
}

/**
 * Filas de la lista para un PERIODO de meses.
 * @param {{parque: object[], homologacion: object|null, catalogo: object|null, meses: string[],
 *          resumenes: Object<string, object|null>, filasPorMes: Object<string, object[]>, umbrales?: object, estadistico?: string}} ctx
 *   `meses`: los del periodo que el parque cargó (en orden); `filasPorMes`: las filas de `filasLista` de cada mes, ya verificadas.
 */
export function filasPeriodo({ parque, homologacion, catalogo, meses, resumenes, filasPorMes, umbrales, estadistico }) {
  const filasH = (homologacion && homologacion.filas) || {};
  const porMat = indicePorMatricula(filasH);
  const conteos = conteosHomologacion(filasH);
  const puntos = (catalogo && catalogo.puntos) || {};
  const idx = (meses || []).map((m) => new Map(((filasPorMes && filasPorMes[m]) || []).map((x) => [x.id, x])));
  const noCargadas = horasNoCargadas(catalogo, meses);
  return (parque || []).map((tx) => {
    const fila = filaDeTransformador(tx, porMat);
    const k = fila ? analizarClaveHomologada(claveEfectiva(fila)) : null;
    const cid = k ? claveId(k.est, k.elem) : null;
    const punto = cid ? puntos[cid] || null : null;
    const rDe = (mes) => (cid && resumenes && resumenes[mes] && resumenes[mes].claves ? resumenes[mes].claves[cid] || null : null);
    const sint = resumenPeriodo(meses.map((mes) => ({ mes, r: rDe(mes), noCargadas: noCargadas[mes] })));
    // `mes` = el último del periodo: si TODO el periodo es anterior al primer mes del punto, el motivo lo dice como en la lista.
    const c = calcularEquipo({ tx, fila, punto, resumenPorNivel: cid ? sint.porNivel : null, conteos, umbrales, estadistico, mes: meses[meses.length - 1] || null });
    const hayAntes = !!punto && (punto.meses || []).some((m) => m < meses[0]);
    const ag = agregadosDeMeses(meses.map((mes, j) => ({ mes, fila: idx[j].get(tx.id) || null, r: rDe(mes) })), { hayAntes });
    const base = idx.map((m) => m.get(tx.id)).find(Boolean) || {};
    // Meses cargados SIN sus horas más altas en un nivel que da la cifra: no se inventa, se pide preparar.
    const faltan = [...new Set((c.niveles || []).filter((n) => n.devanado && sint.faltaTop[n.nivel]).flatMap((n) => sint.faltaTop[n.nivel]))].sort();
    const sinPreparar = faltan.length > 0 && c.pct == null;
    const cifra = sinPreparar ? { pct: null, crg: null, clase: 'nulo', firme: false, motivoNulo: 'falta preparar ' + faltan.join(', ') } : {};
    const clase = cifra.clase || c.clase;
    const sost = ag.mesesSostenida > 0;
    return {
      id: tx.id, matricula: base.matricula || '', subestacion: base.subestacion || '', zona: base.zona || '', departamento: base.departamento || '',
      potenciaKva: base.potenciaKva || null, filaId: fila ? fila.id : null, claveId: cid, tienePunto: !!punto,
      ...c, ...cifra,
      sobrecargaSostenida: clase === 'firme' && sost, sobrecargaProvisional: clase !== 'firme' && sost,
      picoAislado: !sost && !!ag.primeraHora, sobrecargaPorVerificar: [], verificacion: ag.porConfirmar ? 'fallo' : null,
      delta: null,
      // Para ordenar la lista por estas columnas (ordenarFilas usa x[campo]).
      peor: ag.peorMes ? ag.peorMes.pct : null, mayor: ag.mayorCorriente ? ag.mayorCorriente.pct : null,
      periodo: { meses, faltanPreparar: faltan, ...ag }
    };
  });
}

// ── Lo exacto, con la curva de UN mes (el detalle la lee solo cuando hace falta) ───────────────────────────────────

/** Serie de cargabilidad LIMPIA (sin horas de más de 3 × ampacidad) de un nivel en el mes; null si la curva no lo trae. */
function cargaDelMes(docMes, mes, nivel, A) {
  if (!docMes || docMes.estado !== 'ok' || !docMes.serie || !(A > 0)) return null;
  const nv = docMes.serie.niveles && docMes.serie.niveles[nivel];
  if (!nv || !nv.fam) return null;
  const v = ventanaDeMes(mes);
  const rec = recortarRango({ [mes]: { estado: 'ok', series: nv.fam } }, FAMILIAS, v.desde, v.hasta);
  const iF = iFaseMax(rec.fam).serie;
  return { iF, carga: serieCargabilidad(iF, A).serie };
}

/**
 * En la curva de un mes y un nivel: la primera ventana de 2 h seguidas sobre el 100 %, la primera hora suelta sobre el
 * 100 % y la corriente máxima LIMPIA, con su rótulo (ms). null si la curva no se pudo leer o no trae el nivel.
 */
export function hitosDeCurva(docMes, mes, nivel, A) {
  const c = cargaDelMes(docMes, mes, nivel, A);
  if (!c) return null;
  const sobre = horasSostenidasSobre(c.carga, CALCULO.sobrecargaPct, CALCULO.sobrecargaMinH);
  let primeraHora = null; let iMax = -1;
  for (let h = 0; h < c.carga.length; h++) {
    const x = c.carga[h];
    if (!Number.isFinite(x)) continue;
    if (primeraHora == null && x > CALCULO.sobrecargaPct) primeraHora = h;
    if (iMax < 0 || x > c.carga[iMax]) iMax = h;
  }
  const ms = (i) => (i == null || i < 0 ? null : msRotulo(mes, i));
  return {
    primeraSostenida: ms(sobre.primera), horasSostenidas: sobre.horas, primeraHora: ms(primeraHora),
    max: iMax >= 0 ? { A: c.iF[iMax], pct: c.carga[iMax], ms: ms(iMax) } : null
  };
}
