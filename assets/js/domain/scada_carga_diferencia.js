// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · medida de un nivel por DIFERENCIA DE BARRA (dominio puro) · 2026-11-04
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-04): dos transformadores comparten la barra de un nivel y uno de ellos no tiene medida
// propia que sirva en ese nivel. Su corriente sale de la barra: lo que sale por sus bahías menos lo que entra por el otro
// transformador, con P y Q (resta FASORIAL: restar magnitudes de corriente da cientos de amperios falsos cuando la barra
// tiene bancos de condensadores).
//   ΔP = −Σ s·P,  ΔQ = −Σ s·Q   (s = +1, o −1 en el elemento cuya P o Q llega con el signo invertido)
//   I  = 1000·√(ΔP² + ΔQ²) / (√3·U)   [A, con P en MW, Q en Mvar y U en kV: la tensión de la barra]
// Es un MODO de la suma de circuitos: `scada_carga_suma.js` lo orquesta (misma clave '<cid>--suma', mismo candado de
// lectura, mismo derivado aparte); aquí vive solo lo propio de la diferencia. Reglas hora por hora:
//   · la hora vale solo si cada elemento en servicio trae P y Q válidas: nunca una diferencia parcial;
//   · una bahía de SALIDA abierta (sus tres corrientes en cero con la tensión de la barra válida, o fuera de servicio)
//     aporta 0;
//   · el transformador RESTADO aporta 0 solo si TODOS sus devanados están fuera esa hora: si su bahía de este nivel marca
//     cero mientras otro devanado lleva carga (bahía puenteada) o no se sabe, la hora es un hueco;
//   · escala por hora: una bahía con √3·U·I ÷ S fuera de [0,5; 2] deja la hora en hueco (un kW↔MW a mitad de mes);
//   · el sentido de la potencia de cada bahía material se guarda en la decisión y se revisa cada mes: si cambia, BLOQUEA
//     (un signo equivocado inventa carga).
// Excepción declarada a «la cifra usa SOLO la corriente» (`53 §2`) y a «no calcular corriente desde la potencia»
// (`99 §189.5`): aquí P y Q SÍ dan la cifra, con su guarda de escala (`99 §208`).
// Los nombres de las bahías salen SIEMPRE de la decisión guardada en la base: aquí no hay ningún nombre real.
// Funciones PURAS. Archivo NUEVO (L-102): solo importa exportaciones ya publicadas y no importa la suma (sin ciclo).
// ══════════════════════════════════════════════════════════════════════════════

import { CODIGO, CODIGOS_VALIDOS, FAMILIAS_I, FAMILIAS_U, NIVELES } from './scada_carga_config.js';
import { normalizarTexto, claveId, esElementoTransformador } from './scada_carga_csv.js';
import { percentilOrdenado } from './scada_carga_kpis.js';

/** Parámetros de la diferencia. Cambiar uno exige subir `version` (los derivados viejos dejan de leerse y se recargan). */
export const DIF = Object.freeze({
  version: 1,
  tipo: 'diferencia_barra',
  maxElementos: 8,
  escalaHora: Object.freeze([0.5, 2]),      // √3·U·I ÷ S de una bahía en una hora: fuera → hueco (código 7)
  escalaMes: Object.freeze([0.85, 1.15]),   // mediana del mes de cada bahía: fuera → cifra provisional (aviso)
  sMinEscala: 0.5,                          // MVA: por debajo, la razón de escala es ruido y no se mira
  maxEscalaFuera: 0.5,                      // más de la mitad de las horas fuera de escala → sin cifra
  pisoRel: 0.03,                            // piso de exactitud: 3 % del p99 de la corriente del flujo de la barra
  minHorasSentido: 24                       // una bahía con menos horas en servicio en el mes no se juzga
});

export const CRITERIO_DIF = 'corriente equivalente = √(ΔP² + ΔQ²) ÷ (√3·U), con ΔP y ΔQ = salidas de la barra menos el '
  + 'transformador restado, hora por hora (todas las bahías en servicio con P y Q válidas; salida abierta = 0; el restado '
  + '= 0 solo con todos sus devanados fuera); U = tensión de la barra; tensiones del transformador restado';

const valida = (c) => CODIGOS_VALIDOS.includes(c);
const norm = normalizarTexto;
const ordenado = (a) => [...a].sort((x, y) => x - y);
const RAIZ3 = Math.sqrt(3);
const red = (x, d) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const coma = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));
/** Un código de hueco nunca es «fuera de servicio» (9): eso diría que el transformador estaba apagado. */
const hueco = (c) => (c === CODIGO.DESENERGIZADO ? CODIGO.CERO : c);

/**
 * Lista de nombres sin repetidos (por texto comparable), sin vacíos, en orden alfabético comparable. `leer` = cómo se lee
 * cada nombre (un '/estación/elemento' de la misma estación, por su elemento: ver `especDiferenciaNivel`).
 */
function lista(x, leer = (t) => t) {
  const vistos = new Set(); const out = [];
  for (const y of Array.isArray(x) ? x : []) {
    const t = leer(String(y == null ? '' : y).trim());
    if (!t || vistos.has(norm(t))) continue;
    vistos.add(norm(t)); out.push(t);
  }
  return out.sort((a, b) => norm(a).localeCompare(norm(b)));
}
/** Sentidos guardados: {elemento comparable: ±1}; cualquier otro valor se ignora (lo señala `erroresDiferencia`). */
function sentidos(x, leer = (t) => t) {
  const out = {};
  for (const [k, v] of Object.entries(x && typeof x === 'object' ? x : {})) if (v === 1 || v === -1) out[norm(leer(String(k).trim()))] = v;
  return out;
}

/** Firma de una diferencia: versión, nivel, salidas, restados, signos invertidos y sentidos (el orden no la cambia). */
export function firmaDiferencia(nv, { salidas = [], restar = [], invP = [], invQ = [], sentidoP = {}, sentidoQ = {} } = {}) {
  const j = (a) => [...new Set(a.map(norm))].sort().join('+');
  const js = (o) => Object.keys(o).sort().map((k) => k + '=' + o[k]).join(',');
  return 'dif' + DIF.version + '|' + nv + '|S:' + j(salidas) + '|R:' + j(restar) + '|iP:' + j(invP) + '|iQ:' + j(invQ)
    + '|sP:' + js(sentidoP) + '|sQ:' + js(sentidoQ);
}

/**
 * La diferencia de UN nivel, normalizada, con la misma forma que un nivel de la suma (más lo suyo); null si no se puede.
 * @param {object} cfg  `decision.diferencia[nivel]` = {salidas, restar, invertir_p, invertir_q, sentido_p, sentido_q,
 *   barra_solo_estos, verificado}
 * @param {string} est  la estación del transformador; @param {string} nv  el nivel; @param {string} devanado  P, S o T
 * @param {function} [analizar]  el analizador de claves '/estación/elemento' de la homologación (lo pasa quien llama: este
 *   archivo no la importa). Con él, un '/estación/elemento' de la MISMA estación vale por su elemento, como en la suma
 *   (`erroresDiferencia` lo acepta así); cualquier otra cosa se conserva tal cual y nunca llega.
 */
export function especDiferenciaNivel(cfg, est, nv, devanado, analizar = null) {
  if (!cfg || typeof cfg !== 'object' || !NIVELES[nv] || !devanado) return null;
  const leer = (t) => { const k = typeof analizar === 'function' ? analizar(t) : null; return k && norm(k.est) === norm(est) ? k.elem : t; };
  const salidas = lista(cfg.salidas, leer); const restar = lista(cfg.restar, leer);
  if (!salidas.length || !restar.length) return null;
  const invP = lista(cfg.invertir_p, leer).map(norm); const invQ = lista(cfg.invertir_q, leer).map(norm);
  const sentidoP = sentidos(cfg.sentido_p, leer); const sentidoQ = sentidos(cfg.sentido_q, leer);
  const cidsSalidas = salidas.map((e) => claveId(est, e)); const cidsRestar = restar.map((e) => claveId(est, e));
  return {
    modo: 'diferencia', nivel: nv, devanado, elems: [...salidas, ...restar], cids: [...cidsSalidas, ...cidsRestar],
    salidas, restar, cidsSalidas, cidsRestar, invP, invQ, sentidoP, sentidoQ, fases: [...FAMILIAS_I],
    firma: firmaDiferencia(nv, { salidas, restar, invP, invQ, sentidoP, sentidoQ }), barraPropia: cfg.barra_solo_estos === true,
    ...(cfg.verificado ? { verificado: String(cfg.verificado) } : {})
  };
}

/** Promedio de las tensiones válidas de unas familias en la hora h (kV); null si ninguna vale. */
function tensionDe(fam, h) {
  let s = 0; let k = 0;
  for (const f of FAMILIAS_U) {
    const x = fam && fam[f];
    if (x && valida(x.m[h]) && Number.isFinite(x.v[h]) && x.v[h] > 0) { s += x.v[h]; k++; }
  }
  return k ? s / k : null;
}
/** Las tres corrientes en cero (6) o fuera de servicio (9): la bahía no lleva corriente esa hora. */
const sinCorriente = (fam, h) => !!fam && FAMILIAS_I.every((f) => fam[f] && (fam[f].m[h] === CODIGO.CERO || fam[f].m[h] === CODIGO.DESENERGIZADO));
const todas9 = (fam, h) => !!fam && FAMILIAS_I.every((f) => fam[f] && fam[f].m[h] === CODIGO.DESENERGIZADO);
/** Corriente promedio de las fases válidas (al menos 2) en la hora h; null si no. */
function corrienteDe(fam, h) {
  let s = 0; let k = 0;
  for (const f of FAMILIAS_I) {
    const x = fam && fam[f];
    if (x && valida(x.m[h]) && Number.isFinite(x.v[h])) { s += x.v[h]; k++; }
  }
  return k >= 2 ? s / k : null;
}
const copiaSerie = (s) => {
  const out = { v: new Float32Array(s.v), m: new Uint8Array(s.m), b: new Uint8Array(s.b) };
  for (const k of ['max', 'min', 'ins']) if (s[k]) out[k] = new Float32Array(s[k]);
  return out;
};
const serieVacia = (N) => ({ v: new Float32Array(N).fill(NaN), m: new Uint8Array(N).fill(CODIGO.SIN_ARCHIVO), b: new Uint8Array(N) });

/**
 * Sentido de cada bahía con sentido guardado: el signo de la mediana de s·X en sus horas en servicio del mes debe ser el
 * verificado. Una bahía con menos de 24 horas en servicio no se juzga (un mes con el otro transformador fuera).
 * @param {Object<string, {P: number[], Q: number[]}>} flujos  por elemento comparable, los s·P y s·Q de sus horas en servicio
 * @param {{elems: string[], sentidoP: object, sentidoQ: object}} sp
 * @returns {{ok: boolean, fallan: string[]}}  `fallan` = «elemento (P)» / «elemento (Q)»
 */
export function revisarSentidos(flujos, sp) {
  const fallan = [];
  for (const e of sp.elems) {
    const k = norm(e);
    for (const [V, guardado] of [['P', sp.sentidoP[k]], ['Q', sp.sentidoQ[k]]]) {
      if (guardado == null) continue;
      const x = (flujos[k] && flujos[k][V]) || [];
      if (x.length < DIF.minHorasSentido) continue;
      const md = percentilOrdenado(ordenado(x), 0.5);
      if (md !== 0 && Math.sign(md) !== guardado) fallan.push(e + ' (' + V + ')');
    }
  }
  return { ok: !fallan.length, fallan };
}

/**
 * El nivel DERIVADO por diferencia de barra, hora por hora (ver la cabecera). Las tres fases llevan la misma corriente
 * equivalente; P y Q del nivel = ΔP y ΔQ; las tensiones son copias de las del (primer) transformador restado.
 * @param {{salidas: Array<object|null>, restar: Array<object|null>, otrosRestar: Array<object[]>, sp: object, n: number}} p
 *   `salidas` y `restar` = familias de cada elemento en el nivel, en el orden de `sp.salidas` y `sp.restar`;
 *   `otrosRestar[i]` = las familias de los OTROS niveles del restado i (para saber si está fuera del todo)
 * @returns {{fam, horas: {total, completas, abiertas, fueraServicio, hueco, restadoPuenteado, escala},
 *   parte: {p, q}, piso: {A, flujoP99A}, sentidos: {ok, fallan}, escalaMes: Object<string, number>, bloqueaEscala: boolean}}
 */
export function componerDiferencia({ salidas = [], restar = [], otrosRestar = [], sp, n }) {
  const elementos = [
    ...sp.salidas.map((e, i) => ({ e, fam: salidas[i] || null, restado: false, otros: [] })),
    ...sp.restar.map((e, i) => ({ e, fam: restar[i] || null, restado: true, otros: otrosRestar[i] || [] }))
  ].map((x) => ({ ...x, k: norm(x.e), sP: sp.invP.includes(norm(x.e)) ? -1 : 1, sQ: sp.invQ.includes(norm(x.e)) ? -1 : 1 }));
  const N = n;
  const I = serieVacia(N); const P = serieVacia(N); const Q = serieVacia(N);
  const horas = { total: N, completas: 0, abiertas: 0, fueraServicio: 0, hueco: 0, restadoPuenteado: 0, escala: 0 };
  const flujos = Object.fromEntries(elementos.map((x) => [x.k, { P: [], Q: [] }]));
  const razones = Object.fromEntries(elementos.map((x) => [x.k, []]));
  const parteP = []; const parteQ = []; const flujoA = [];
  const restados = elementos.filter((x) => x.restado); const deSalida = elementos.filter((x) => !x.restado);
  for (let h = 0; h < N; h++) {
    // Tensión de la barra: la del transformador restado o, si no vale, la de cualquier bahía de la barra que la traiga.
    let U = null;
    for (const x of [...restados, ...deSalida]) { U = tensionDe(x.fam, h); if (U != null) break; }
    let dP = 0; let dQ = 0; let ret = false; let b = 0; let codigo = null; let enServicio = 0; let abiertas = 0;
    let puenteado = false; let fueraEscala = false; let sumaP = 0; let sumaQ = 0; let sumaS = 0;
    for (const x of elementos) {
      const f = x.fam;
      if (!f) { if (codigo == null) codigo = CODIGO.SIN_ARCHIVO; continue; }
      if (!x.restado && sinCorriente(f, h) && (todas9(f, h) || U != null)) { abiertas++; continue; }   // salida abierta: 0
      if (x.restado && sinCorriente(f, h)) {
        // Restado fuera en todos sus devanados: aporta 0. Sin sus otros devanados no se sabe: hueco (falla cerrado).
        if (x.otros.length && x.otros.every((o) => sinCorriente(o, h))) continue;
        puenteado = true; if (codigo == null) codigo = hueco(f.IR.m[h]); continue;
      }
      const p = f.P; const q = f.Q;
      const okP = !!p && valida(p.m[h]) && Number.isFinite(p.v[h]); const okQ = !!q && valida(q.m[h]) && Number.isFinite(q.v[h]);
      if (!okP || !okQ) { if (codigo == null) codigo = hueco(!okP ? (p ? p.m[h] : CODIGO.SIN_ARCHIVO) : (q ? q.m[h] : CODIGO.SIN_ARCHIVO)); continue; }
      enServicio++;
      flujos[x.k].P.push(x.sP * p.v[h]); flujos[x.k].Q.push(x.sQ * q.v[h]);
      if (p.m[h] === CODIGO.RETENIDO || q.m[h] === CODIGO.RETENIDO) ret = true;
      b = Math.max(b, p.b[h], q.b[h]);
      dP -= x.sP * p.v[h]; dQ -= x.sQ * q.v[h];
      const S = Math.hypot(p.v[h], q.v[h]);
      sumaP += Math.abs(p.v[h]); sumaQ += Math.abs(q.v[h]); sumaS += S;
      // Escala por hora: la potencia y la corriente de la bahía deben decir lo mismo (√3·U·I ≈ S).
      const Ib = corrienteDe(f, h);
      if (U != null && Ib != null) {
        const SI = RAIZ3 * U * Ib / 1000;
        if (Math.max(S, SI) >= DIF.sMinEscala) {
          const r = S > 0 ? SI / S : Infinity;
          if (Number.isFinite(r)) razones[x.k].push(r);
          if (!(r >= DIF.escalaHora[0] && r <= DIF.escalaHora[1])) fueraEscala = true;
        }
      }
    }
    if (codigo != null || fueraEscala || (enServicio > 0 && U == null)) {
      const r = restados.find((x) => x.fam);
      const cu = r && r.fam.URS ? hueco(r.fam.URS.m[h]) : CODIGO.SIN_ARCHIVO;
      const c = codigo != null ? codigo : (fueraEscala ? CODIGO.FUERA_ESCALA : (valida(cu) ? CODIGO.NULO : cu));
      I.m[h] = c; P.m[h] = c; Q.m[h] = c;
      horas.hueco++;
      if (puenteado) horas.restadoPuenteado++;
      else if (codigo == null && fueraEscala) horas.escala++;
      continue;
    }
    if (enServicio === 0) {   // todo fuera: el transformador no lleva carga
      I.v[h] = 0; I.m[h] = CODIGO.DESENERGIZADO; P.v[h] = 0; P.m[h] = CODIGO.DESENERGIZADO; Q.v[h] = 0; Q.m[h] = CODIGO.DESENERGIZADO;
      horas.fueraServicio++;
      continue;
    }
    const cod = ret ? CODIGO.RETENIDO : CODIGO.VALIDO;
    I.v[h] = 1000 * Math.hypot(dP, dQ) / (RAIZ3 * U); I.m[h] = cod; I.b[h] = b;
    P.v[h] = dP; P.m[h] = cod; P.b[h] = b; Q.v[h] = dQ; Q.m[h] = cod; Q.b[h] = b;
    horas.completas++;
    if (abiertas > 0) horas.abiertas++;
    if (sumaP > 0) parteP.push(Math.abs(dP) / (sumaP / 2));
    if (sumaQ > 0) parteQ.push(Math.abs(dQ) / (sumaQ / 2));
    flujoA.push(1000 * (sumaS / 2) / (RAIZ3 * U));
  }
  const fam = { IR: I, IS: copiaSerie(I), IT: copiaSerie(I), P, Q };
  const r0 = restados.find((x) => x.fam);
  for (const F of FAMILIAS_U) if (r0 && r0.fam[F]) fam[F] = copiaSerie(r0.fam[F]);
  const flujoP99A = percentilOrdenado(ordenado(flujoA), 0.99);
  const escalaMes = {};
  for (const x of elementos) {
    const md = razones[x.k].length >= DIF.minHorasSentido ? percentilOrdenado(ordenado(razones[x.k]), 0.5) : null;
    if (md != null) escalaMes[x.e] = red(md, 3);
  }
  return {
    fam, horas,
    parte: { p: red(100 * (percentilOrdenado(ordenado(parteP), 0.5) ?? NaN), 2), q: red(100 * (percentilOrdenado(ordenado(parteQ), 0.5) ?? NaN), 2) },
    piso: { A: red(flujoP99A == null ? null : DIF.pisoRel * flujoP99A, 1), flujoP99A: red(flujoP99A, 1) },
    sentidos: revisarSentidos(flujos, sp),
    escalaMes,
    bloqueaEscala: horas.escala > 0 && horas.escala > DIF.maxEscalaFuera * (horas.completas + horas.escala)
  };
}

/**
 * Copia de las corrientes del derivado SIN las horas bajo el piso de exactitud (para el cuadre con la medida propia:
 * comparar ruido con ruido daría un «no cuadra» falso). Solo las familias de corriente.
 */
export function sobrePiso(fam, pisoA) {
  const out = {};
  for (const F of FAMILIAS_I) {
    if (!fam || !fam[F]) continue;
    const s = copiaSerie(fam[F]);
    if (pisoA != null && Number.isFinite(pisoA)) for (let h = 0; h < s.v.length; h++) if (valida(s.m[h]) && !(s.v[h] >= pisoA)) s.m[h] = CODIGO.CERO;
    out[F] = s;
  }
  return out;
}

/** Bahías cuya potencia y corriente no cuadran entre sí en el mes (mediana fuera de [0,85; 1,15]): «X (1,32)». */
export function escalaFueraDeBanda(escalaMes) {
  return Object.entries(escalaMes || {}).filter(([, r]) => Number.isFinite(r) && (r < DIF.escalaMes[0] || r > DIF.escalaMes[1]))
    .map(([e, r]) => e + ' (' + coma(r, 2) + ')');
}

/** ¿La cifra queda dentro del error de la diferencia? (p99 del nivel ≤ piso de exactitud) */
export function dentroDelPiso(p99, piso) {
  return p99 != null && Number.isFinite(p99) && !!piso && piso.A != null && Number.isFinite(piso.A) && p99 <= piso.A;
}

/**
 * Errores (texto llano) de las diferencias de una decisión ANTES de guardarla; vacío = se puede guardar. D5 (otro
 * transformador mide la barra) la revisa quien llama, que conoce el catálogo de la suma.
 * @param {{est: string, elem: string}} k  la medida de esta fila (ya analizada)
 * @param {object} decision  la decisión que se va a guardar (con `mapa`, `diferencia` y quizá `suma`)
 * @param {{claveDe: Map<string, string>, usadoEn: Map<string, string>, puntos: object, analizar: function}} ctx
 *   `claveDe` = cid → fila que lo usa como medida; `usadoEn` = cid → fila que lo usa en una suma o como salida de una
 *   diferencia; `analizar` = el analizador de claves '/estación/elemento' de la homologación
 */
export function erroresDiferencia(k, decision, { claveDe = new Map(), usadoEn = new Map(), puntos = {}, analizar = () => null } = {}) {
  const err = [];
  const dif = decision && decision.diferencia;
  if (!dif || typeof dif !== 'object') return err;
  const mapa = decision.mapa || {};
  const est = norm(k.est);
  if (Array.isArray(decision.previas) && decision.previas.length) err.push('Esta fila trae medidas anteriores (cambio de medida): la diferencia de barra no se puede usar con ellas.');
  for (const nv of Object.keys(dif).sort()) {
    const s = dif[nv];
    if (!s || typeof s !== 'object') continue;
    if (!NIVELES[nv]) { err.push('Nivel desconocido: ' + nv + '.'); continue; }
    const et = NIVELES[nv].etiqueta;
    if (!mapa[nv]) err.push('El nivel ' + et + ' se mide por diferencia de barra pero no está asignado a ningún devanado.');
    if (decision.suma && decision.suma[nv]) err.push('El nivel ' + et + ' no puede medirse a la vez por suma de circuitos y por diferencia de barra.');
    const elemDe = (t) => {
      const kk = analizar(t);
      if (kk) return norm(kk.est) === est ? kk.elem : (err.push('«' + t + '» es de otra estación: las bahías deben ser de la misma estación del transformador.'), null);
      if (t.includes('/')) { err.push('«' + t + '» no es el nombre de una bahía: escriba solo el nombre (sin barras).'); return null; }
      return t;
    };
    const crudo = (a) => (Array.isArray(a) ? a : []).map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
    const sal = crudo(s.salidas); const res = crudo(s.restar);
    if (!sal.length) err.push('Escriba al menos una bahía de salida para el nivel ' + et + '.');
    if (!res.length) err.push('Escriba el transformador que se resta en el nivel ' + et + '.');
    if (sal.length + res.length > DIF.maxElementos) err.push('El nivel ' + et + ' tiene más de ' + DIF.maxElementos + ' elementos en la diferencia: revise la lista.');
    const vistos = new Set();
    const entradas = new Set();
    for (const [t, restado] of [...sal.map((x) => [x, false]), ...res.map((x) => [x, true])]) {
      const elem = elemDe(t);
      if (elem == null) continue;
      const n = norm(elem);
      if (vistos.has(n)) { err.push('«' + elem + '» está repetido en la diferencia de ' + et + '.'); continue; }
      vistos.add(n); entradas.add(n);
      if (n === norm(k.elem)) { err.push('«' + elem + '» es la propia medida del transformador: no puede estar en su diferencia.'); continue; }
      const c = claveId(k.est, elem);
      if (restado) {
        if (!esElementoTransformador(elem)) err.push('«' + elem + '» no es un transformador: solo se resta un transformador.');
        const pc = puntos ? puntos[c] : null;
        if (pc && pc.niveles && Object.keys(pc.niveles).length && !pc.niveles[nv]) err.push('«' + elem + '» está en los datos cargados pero no mide ' + et + ': revise el nivel o el nombre.');
        continue;
      }
      if (esElementoTransformador(elem)) { err.push('«' + elem + '» es un transformador: va en «restar», no en las salidas.'); continue; }
      if (usadoEn.has(c)) err.push('«' + elem + '» ya está en la suma o la diferencia de otra fila (' + usadoEn.get(c) + ').');
      if (claveDe.has(c)) err.push('«' + elem + '» es la medida de otra fila (' + claveDe.get(c) + ').');
      const pc = puntos ? puntos[c] : null;
      if (pc && pc.niveles && Object.keys(pc.niveles).length && !pc.niveles[nv]) err.push('«' + elem + '» está en los datos cargados pero no mide ' + et + ': revise el nivel o el nombre.');
    }
    for (const [campo, que] of [['invertir_p', 'P'], ['invertir_q', 'Q']]) {
      for (const t of crudo(s[campo])) if (!entradas.has(norm(t))) err.push('El signo invertido de ' + que + ' de «' + t + '» no es de una bahía de la diferencia de ' + et + '.');
    }
    for (const [campo, que] of [['sentido_p', 'P'], ['sentido_q', 'Q']]) {
      for (const [t, v] of Object.entries(s[campo] && typeof s[campo] === 'object' ? s[campo] : {})) {
        if (!entradas.has(norm(t))) err.push('El sentido de ' + que + ' de «' + t + '» no es de una bahía de la diferencia de ' + et + '.');
        else if (v !== 1 && v !== -1) err.push('El sentido de ' + que + ' de «' + t + '» debe ser 1 o −1.');
      }
    }
    if (s.barra_solo_estos !== true) err.push('Confirme que la barra de ' + et + ' no tiene más bahías que las de la diferencia (casilla obligatoria).');
  }
  return err;
}

/** Rótulo llano de una diferencia de un nivel: «Secundario por diferencia de barra: A + B − X (P y Q)». */
export function textoDiferencia(sp, nombreNivel) {
  return nombreNivel + ' por diferencia de barra: ' + sp.salidas.join(' + ') + ' − ' + sp.restar.join(' − ') + ' (P y Q)';
}

/**
 * Lo que se le atribuye al transformador en el mes, en texto: «P 0,19 % · Q 1,62 % del flujo de la barra · piso de
 * exactitud 12,1 A». Con carga real ese número es su parte, no un error.
 */
export function textoParte(derivado) {
  if (!derivado) return null;
  const pt = derivado.parte || {};
  const partes = [];
  if (pt.p != null || pt.q != null) partes.push('lo que se atribuye a este transformador: P ' + coma(pt.p, 2) + ' % · Q ' + coma(pt.q, 2) + ' % del flujo de la barra');
  if (derivado.piso && derivado.piso.A != null) partes.push('piso de exactitud ' + coma(derivado.piso.A) + ' A');
  return partes.length ? partes.join(' · ') : null;
}
