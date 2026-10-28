// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · limpieza de las series (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Cada hora recibe un CÓDIGO (scada_carga_config.js · CODIGO) y el valor CRUDO se
// conserva: si el Ingeniero ratifica otros parámetros, se recalcula sin volver a leer
// las carpetas. Un dato descartado se ve como HUECO, nunca como cero (L-104).
//
// Pasada de celda (por hora y familia), en este orden:
//   sin archivo → 1 · vacío/'null' → 2 · bandera del SCADA no válida → 3 ·
//   (tensiones) fuera de [0,5; 1,5] × el nivel → 7 · valor tope del sistema → 4 · cero → 6.
// Pasada de serie (por nivel y mes):
//   (i)   corriente en cero en las 3 fases con tensión presente → 9 «fuera de servicio» (no es hueco);
//   (ii)  el MISMO valor ≥ 6 h seguidas en I, P o Q → 5 «congelado» (con banda muerta marcada, la corriente → 10 si la
//         tensión del nivel se movió en el tramo);
//   (iii) tensión quieta ≥ 6 h: si la corriente se movió → 10 «retenido» (válido, banda muerta);
//         si la corriente también quedó quieta → 5; sin corriente medida, 5 solo con ≥ 24 h.
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import {
  CODIGO, FAMILIAS_I, FAMILIAS_U, BANDERAS_VALIDAS, CENTINELAS, CENTINELA_ABS, TOLERANCIA_CENTINELA,
  PLAUSIBILIDAD_U, CONGELADO_MIN_H, U_CONGELADO_SIN_I_H, VARIACION_I_RETENIDO, CODIGOS_VALIDOS, BANDERA
} from './scada_carga_config.js';

const esU = (fam) => FAMILIAS_U.includes(fam);

/** ¿Es un valor tope del sistema? */
export function esCentinela(v) {
  if (!Number.isFinite(v)) return false;
  if (Math.abs(v) >= CENTINELA_ABS) return true;
  return CENTINELAS.some((c) => Math.abs(v - c) <= TOLERANCIA_CENTINELA * Math.max(1, Math.abs(c)));
}

/**
 * Código de una celda (pasada 1).
 * @param {number} v       valor crudo (NaN si vacío)
 * @param {number} b       bandera de calidad (0 = sin archivo de calidad)
 * @param {string} fam     familia ('IR', 'URS', 'P', …)
 * @param {number} kv      tensión nominal del nivel
 * @param {boolean} presente  ¿llegó archivo para esa hora?
 */
export function codigoCelda(v, b, fam, kv, presente) {
  if (!presente) return CODIGO.SIN_ARCHIVO;
  if (!Number.isFinite(v)) return CODIGO.NULO;
  if (!BANDERAS_VALIDAS.includes(b)) return CODIGO.BANDERA;
  if (esU(fam) && v !== 0 && kv > 0) {
    const r = Math.abs(v) / kv;
    if (r < PLAUSIBILIDAD_U[0] || r > PLAUSIBILIDAD_U[1]) return CODIGO.FUERA_ESCALA;
  }
  if (esCentinela(v)) return CODIGO.CENTINELA;
  if (v === 0) return CODIGO.CERO;
  return CODIGO.VALIDO;
}

const valida = (c) => CODIGOS_VALIDOS.includes(c);

/** Corridas de horas (índices consecutivos) con código válido y el MISMO valor exacto. */
function corridasIguales(v, m, minLargo) {
  const out = [];
  let ini = -1;
  for (let h = 0; h <= v.length; h++) {
    const sigue = h < v.length && m[h] === CODIGO.VALIDO && ini >= 0 && v[h] === v[ini];
    if (sigue) continue;
    if (ini >= 0 && h - ini >= minLargo) out.push([ini, h]);
    ini = (h < v.length && m[h] === CODIGO.VALIDO) ? h : -1;
  }
  return out;
}

/** ¿Alguna tensión con celda VÁLIDA tomó al menos dos valores distintos en [a, z)? (antes de la pasada iii) */
function tensionSeMovio(fams, a, z) {
  for (const f of FAMILIAS_U) {
    const s = fams[f];
    if (!s) continue;
    let primero = null;
    for (let h = a; h < z; h++) {
      if (s.m[h] !== CODIGO.VALIDO) continue;
      if (primero == null) primero = s.v[h];
      else if (s.v[h] !== primero) return true;
    }
  }
  return false;
}

/** Horas de un tramo quieto que la banda muerta acepta SIN que otra fase se mueva (= `scada_carga_banda_muerta.js`). */
const BANDA_MUERTA_SOLA_H = 24;

/**
 * ¿La banda muerta acepta el tramo quieto [a, z) de la corriente `f`? Alguna tensión se movió y, en un tramo de más de
 * 24 h, también otra fase de corriente (revisión adversarial 2026-10-28: con las tres corrientes muertas y la tensión viva,
 * la cifra salía firme y baja). Las fases se miran con su celda buena (válida, o ya marcada en esta misma pasada).
 */
function retenidaPorBandaMuerta(fams, f, a, z) {
  if (!tensionSeMovio(fams, a, z)) return false;
  if (z - a <= BANDA_MUERTA_SOLA_H) return true;
  const buena = (c) => c === CODIGO.VALIDO || c === CODIGO.CONGELADO || c === CODIGO.RETENIDO;
  for (const g of FAMILIAS_I) {
    const s = fams[g];
    if (g === f || !s) continue;
    let primero = null;
    for (let h = a; h < z; h++) {
      if (!buena(s.m[h])) continue;
      if (primero == null) primero = s.v[h];
      else if (s.v[h] !== primero) return true;
    }
  }
  return false;
}

/** Corriente de la fase más cargada por hora con lo VÁLIDO (NaN si menos de 2 fases). */
function iMaxHoraria(fams, n) {
  const out = new Float32Array(n).fill(NaN);
  for (let h = 0; h < n; h++) {
    let mx = -Infinity; let k = 0;
    for (const f of FAMILIAS_I) {
      const s = fams[f];
      if (s && valida(s.m[h])) { k++; if (s.v[h] > mx) mx = s.v[h]; }
    }
    if (k >= 2) out[h] = mx;
  }
  return out;
}

/**
 * Limpia un nivel completo de un mes. Modifica y devuelve `fams[fam].m` (Uint8Array).
 * @param {Object<string, {v: Float32Array, b: Uint8Array, presente: Uint8Array}>} fams
 * @param {number} kv  tensión nominal del nivel
 * @param {{aceptarInvalid?: boolean, bandaMuerta?: true}} [opciones]  `aceptarInvalid`: la bandera «Invalid» de este punto no
 *   es confiable (decisión del Ingeniero, `scada_carga_invalid.js`): sus horas se juzgan como si fueran «Actual». La bandera
 *   cruda no cambia. `bandaMuerta`: la corriente de este nivel solo se renueva al cambiar un escalón (`scada_carga_banda_muerta.js`).
 * @returns {Object<string, {v, b, m}>}
 */
export function limpiarNivel(fams, kv, opciones = {}) {
  const n = Object.values(fams)[0] ? Object.values(fams)[0].v.length : 0;
  const out = {};
  const aceptarInvalid = !!(opciones && opciones.aceptarInvalid);
  // Solo `true` (revisión adversarial 2026-10-28): un importador viejo en caché pasa la LISTA de niveles del punto, y con
  // `!!` se activaba en todos sus niveles sin que la autocomprobación lo viera.
  const bandaMuerta = !!opciones && opciones.bandaMuerta === true;
  for (const [fam, s] of Object.entries(fams)) {
    const m = new Uint8Array(n);
    for (let h = 0; h < n; h++) {
      const b = aceptarInvalid && s.b[h] === BANDERA.INVALID ? BANDERA.ACTUAL : s.b[h];
      m[h] = codigoCelda(s.v[h], b, fam, kv, !!s.presente[h]);
    }
    out[fam] = { v: s.v, b: s.b, m };
    // Extras de §126 (solo para ver) viajan sin tocarse. Lista local a propósito: este archivo no importa
    // de scada_carga_extras.js (que importa de aquí) y no gana exportaciones nuevas (L-102).
    for (const k of ['max', 'min', 'ins']) if (s[k]) out[fam][k] = s[k];
  }
  // (i) Fuera de servicio: las tres corrientes en cero y alguna tensión válida.
  const hayI = FAMILIAS_I.every((f) => out[f]);
  for (let h = 0; h < n && hayI; h++) {
    if (!FAMILIAS_I.every((f) => out[f].m[h] === CODIGO.CERO)) continue;
    if (!FAMILIAS_U.some((f) => out[f] && out[f].m[h] === CODIGO.VALIDO)) continue;
    for (const f of FAMILIAS_I) out[f].m[h] = CODIGO.DESENERGIZADO;
    for (const f of ['P', 'Q']) if (out[f] && out[f].m[h] === CODIGO.CERO) out[f].m[h] = CODIGO.DESENERGIZADO;
  }
  // (ii) Congelado en I, P y Q. Con banda muerta (marca del Ingeniero, `scada_carga_banda_muerta.js`), la corriente quieta
  // de ESTE nivel es válida («retenida») si alguna tensión del nivel se movió dentro del tramo y, si el tramo pasa de 24 h,
  // además otra fase de corriente se movió en él: la medida está viva y solo no cambió de escalón. P y Q, como siempre.
  for (const f of [...FAMILIAS_I, 'P', 'Q']) {
    if (!out[f]) continue;
    for (const [a, z] of corridasIguales(out[f].v, out[f].m, CONGELADO_MIN_H)) {
      const codigo = bandaMuerta && FAMILIAS_I.includes(f) && retenidaPorBandaMuerta(out, f, a, z) ? CODIGO.RETENIDO : CODIGO.CONGELADO;
      for (let h = a; h < z; h++) out[f].m[h] = codigo;
    }
  }
  // (iii) Tensión quieta: retenida si la corriente se movió; congelada si no.
  const iF = iMaxHoraria(out, n);
  for (const f of FAMILIAS_U) {
    if (!out[f]) continue;
    for (const [a, z] of corridasIguales(out[f].v, out[f].m, CONGELADO_MIN_H)) {
      let mn = Infinity; let mx = -Infinity; let k = 0;
      for (let h = a; h < z; h++) if (Number.isFinite(iF[h])) { k++; mn = Math.min(mn, iF[h]); mx = Math.max(mx, iF[h]); }
      let codigo;
      if (k >= 2) codigo = (mx > 0 && (mx - mn) / mx > VARIACION_I_RETENIDO) ? CODIGO.RETENIDO : CODIGO.CONGELADO;
      else codigo = (z - a >= U_CONGELADO_SIN_I_H) ? CODIGO.CONGELADO : CODIGO.RETENIDO;
      for (let h = a; h < z; h++) out[f].m[h] = codigo;
    }
  }
  return out;
}

/** Conteo de horas por código de una serie. */
export function conteoCodigos(m) {
  const c = {};
  for (let h = 0; h < m.length; h++) c[m[h]] = (c[m[h]] || 0) + 1;
  return c;
}

/** Valores utilizables de una serie: el valor si el código es válido, NaN si no. ÚNICO lector permitido. */
export function validos(s) {
  const out = new Float32Array(s.v.length);
  for (let h = 0; h < s.v.length; h++) out[h] = valida(s.m[h]) ? s.v[h] : NaN;
  return out;
}
