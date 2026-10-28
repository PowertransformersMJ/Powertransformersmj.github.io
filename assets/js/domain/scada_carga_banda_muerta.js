// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · CORRIENTE CON BANDA MUERTA de un punto (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («Sí, con resguardos»): en algunos puntos el SCADA manda la corriente en escalones gruesos y solo
// la renueva cuando cambia un escalón entero (Tres Palmas: 0,976 A = 3,1 puntos de la cifra). El valor se repite muchas
// horas sin estar muerto, y la regla «6 h con el mismo valor = congelado» lo descartaba. Con la marca en la decisión de la
// homologación (`decision.banda_muerta = {N13_8: <escalón en A>}`), la limpieza de ESE punto y nivel toma una corriente
// repetida como buena («retenida») SOLO si: (1) la bandera es buena (las horas «Not Renewed» o «Invalid» siguen fuera);
// (2) la tensión del mismo nivel se movió dentro del tramo y, si el tramo pasa de 24 h, también otra fase de corriente (la
// medida está viva); y la cifra queda firme solo si (3) el escalón no pasa de 5 puntos de la ampacidad del devanado y
// (4) los meses limpiados con la marca la siguen teniendo en la decisión. Nada más cambia. La marca la aplica el importador al cargar
// un mes y `reprocesarConMarcas` a los meses ya guardados (las series conservan valor y bandera crudos). Funciones PURAS.
// Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { analizarClaveHomologada, claveEfectiva } from './scada_carga_homologacion.js';
import { claveId } from './scada_carga_csv.js';
import { procesarPuntoMes } from './scada_carga_importacion.js';
import { conMarcaInvalid } from './scada_carga_invalid.js';
import { CODIGO, CONGELADO_MIN_H, FAMILIAS_I, FAMILIAS_U } from './scada_carga_config.js';

/** El escalón de la medida no puede pasar de estos puntos de la ampacidad del devanado para que la cifra sea firme. */
export const TOPE_BANDA_MUERTA_PCT = 5;

export const MOTIVO_BANDA_MUERTA = 'la banda muerta de la medida pasa de 5 puntos de la cifra';

export const MOTIVO_BANDA_MUERTA_SIN_MARCA = 'limpiado con una banda muerta que ya no está en la decisión: vuelva a limpiar el mes';

/** Horas de un tramo quieto que se aceptan sin que otra fase se mueva (= `scada_carga_limpieza.js`). */
export const BANDA_MUERTA_SOLA_H = 24;

/** Versión de la marca que el lector de archivos declara (`importar-mes.js` detiene un lector viejo en caché). */
export const VERSION_BANDA_MUERTA = 1;

/** El escalón (A) que la decisión «usar» de la fila declara para ese nivel; null sin marca. */
export function bandaMuerta(fila, nivel) {
  const bm = fila && fila.decision && fila.decision.tipo === 'usar' ? fila.decision.banda_muerta : null;
  const v = bm && typeof bm === 'object' ? bm[nivel] : null;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Los puntos (claveId) con banda muerta marcada y sus niveles: los de las filas marcadas, con su clave efectiva de hoy.
 * @param {Object<string, object>} filas  las filas de la homologación
 * @returns {Map<string, string[]>}
 */
export function puntosBandaMuerta(filas) {
  const out = new Map();
  for (const f of Object.values(filas || {})) {
    if (!f || f.retirada || !f.decision || f.decision.tipo !== 'usar') continue;
    const nvs = Object.keys(f.decision.banda_muerta || {}).filter((nv) => bandaMuerta(f, nv) != null);
    if (!nvs.length) continue;
    const k = analizarClaveHomologada(claveEfectiva(f));
    if (!k) continue;
    const cid = claveId(k.est, k.elem);
    out.set(cid, [...new Set([...(out.get(cid) || []), ...nvs])].sort());
  }
  return out;
}

/** ¿Alguna serie de `familias` tomó al menos dos valores distintos en [a, z), entre las horas cuya celda era buena? */
function seMovio(fam, familias, a, z) {
  // Tras la limpieza, una celda buena queda válida, retenida o congelada: las tres cuentan (como en la limpieza).
  const buena = (c) => c === CODIGO.VALIDO || c === CODIGO.RETENIDO || c === CODIGO.CONGELADO;
  for (const f of familias) {
    const s = fam[f];
    if (!s) continue;
    let primero = null;
    for (let h = a; h < z; h++) {
      if (!buena(s.m[h])) continue;
      if (primero == null) primero = s.v[h];
      else if (s.v[h] !== primero) return true;
    }
  }
  return false;
}

/** El mismo criterio de la limpieza: la tensión se movió y, en más de 24 h, también otra fase de corriente. */
function aceptaria(fam, f, a, z) {
  if (!seMovio(fam, FAMILIAS_U, a, z)) return false;
  return z - a <= BANDA_MUERTA_SOLA_H || seMovio(fam, FAMILIAS_I.filter((g) => g !== f), a, z);
}

const VIEJO = 'El limpiador de esta pestaña es de una versión anterior y no aplica la banda muerta de la corriente: recargue la página (Cmd+Shift+R) y vuelva a intentarlo.';

/**
 * Comprueba un punto-mes limpiado CON la marca y deja el rastro en su resumen. En un nivel marcado, ninguna corriente puede
 * quedar «congelada» en un tramo que la regla acepta; en un nivel SIN marca, ninguna corriente puede quedar «retenida»: si
 * pasa, algún módulo de la pestaña es de una versión anterior (caché del navegador) y se detiene en vez de guardar en
 * silencio. Cada nivel marcado lleva en su resumen `bandaMuertaAceptadas` (horas con alguna corriente repetida tomada como
 * buena). Modifica y devuelve `p`.
 * @param {{niveles: Object, resumen: Object}} p  el resultado de `procesarPuntoMes(…, {bandaMuerta: niveles})`
 * @param {string[]} niveles  los niveles marcados del punto
 */
export function conMarcaBandaMuerta(p, niveles) {
  for (const [nv, x] of Object.entries((p && p.niveles) || {})) {
    if (!x || !x.fam) continue;
    const fams = FAMILIAS_I.map((f) => [f, x.fam[f]]).filter(([, s]) => s);
    const n = fams.length ? fams[0][1].m.length : 0;
    if (!(niveles || []).includes(nv)) {
      if (fams.some(([, s]) => s.m.some((c) => c === CODIGO.RETENIDO))) throw new Error(VIEJO);
      continue;
    }
    for (const [f, s] of fams) {
      let ini = -1;
      for (let h = 0; h <= n; h++) {
        const sigue = h < n && s.m[h] === CODIGO.CONGELADO && ini >= 0 && s.v[h] === s.v[ini];
        if (sigue) continue;
        if (ini >= 0 && h - ini >= CONGELADO_MIN_H && aceptaria(x.fam, f, ini, h)) throw new Error(VIEJO);
        ini = h < n && s.m[h] === CODIGO.CONGELADO ? h : -1;
      }
    }
    if (p.resumen && p.resumen[nv]) p.resumen[nv] = { ...p.resumen[nv], bandaMuertaAceptadas: horasRetenidasI(x.fam) };
  }
  return p;
}

/** Horas con alguna corriente «retenida» (la banda muerta la tomó como buena) en las series de un nivel. */
export function horasRetenidasI(fam) {
  const fs = FAMILIAS_I.map((f) => fam && fam[f]).filter((s) => s && s.m);
  const n = fs.length ? fs[0].m.length : 0;
  let k = 0;
  for (let h = 0; h < n; h++) if (fs.some((s) => s.m[h] === CODIGO.RETENIDO)) k++;
  return k;
}

/**
 * Vuelve a limpiar un punto-mes YA GUARDADO (desempaquetado) con las marcas de su punto: devuelve los niveles con los
 * códigos nuevos (mismos valores y banderas crudos) y su resumen, como los guardaría el importador.
 * @param {{niveles: Object<string, {kv, fam: Object<string, {v, m, b}>}>}} guardado  la serie guardada, desempaquetada
 * @param {{aceptarInvalid?: boolean, bandaMuerta?: string[]}} marcas
 * @returns {{niveles, resumen, conteos}}
 */
export function reprocesarConMarcas(guardado, marcas = {}) {
  const op = {};
  if (marcas.aceptarInvalid) op.aceptarInvalid = true;
  if (marcas.bandaMuerta && marcas.bandaMuerta.length) op.bandaMuerta = marcas.bandaMuerta;
  let p = procesarPuntoMes({}, guardado, 'completar', op);
  if (op.aceptarInvalid) p = conMarcaInvalid(p);
  if (op.bandaMuerta) p = conMarcaBandaMuerta(p, op.bandaMuerta);
  return { niveles: p.niveles, resumen: p.resumen, conteos: p.conteos };
}

/**
 * El motivo de provisional si un devanado con cifra tiene un escalón mayor que el tope (o sin ampacidad para medirlo).
 * @param {Array<{pct: number|null, bandaMuertaPct?: number|null}>} devanados  los de `calcularEquipo`
 */
export function motivoBandaMuerta(devanados) {
  const dentro = (v) => typeof v === 'number' && Number.isFinite(v) && v <= TOPE_BANDA_MUERTA_PCT;
  return (devanados || []).some((x) => x && x.pct != null && x.bandaMuertaPct !== undefined && !dentro(x.bandaMuertaPct))
    ? MOTIVO_BANDA_MUERTA : null;
}

/**
 * El motivo de provisional si un devanado con cifra trae horas limpiadas con banda muerta (`bandaMuertaAceptadas` de su
 * resumen) y la decisión de hoy ya no tiene la marca para ese nivel: sin la marca no hay tope que lo respalde.
 * @param {Array<{pct: number|null, bandaMuertaSinMarca?: boolean}>} devanados  los de `calcularEquipo`
 */
export function motivoBandaMuertaSinMarca(devanados) {
  return (devanados || []).some((x) => x && x.pct != null && x.bandaMuertaSinMarca) ? MOTIVO_BANDA_MUERTA_SIN_MARCA : null;
}
