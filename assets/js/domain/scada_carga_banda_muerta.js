// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · CORRIENTE CON BANDA MUERTA de un punto (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («Sí, con resguardos»): en algunos puntos el SCADA manda la corriente en escalones gruesos y solo
// la renueva cuando cambia un escalón entero (Tres Palmas: 0,976 A = 3,1 puntos de la cifra). El valor se repite muchas
// horas sin estar muerto, y la regla «6 h con el mismo valor = congelado» lo descartaba. Con la marca en la decisión de la
// homologación (`decision.banda_muerta = {N13_8: <escalón en A>}`), la limpieza de ESE punto y nivel toma una corriente
// repetida como buena («retenida») SOLO si: (1) la bandera es buena (las horas «Not Renewed» o «Invalid» siguen fuera);
// (2) la tensión del mismo nivel se movió dentro del tramo (la medida está viva); y la cifra queda firme solo si (3) el
// escalón no pasa de 5 puntos de la ampacidad del devanado. Nada más cambia. La marca la aplica el importador al cargar
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

/** ¿Alguna tensión del nivel tomó al menos dos valores distintos en [a, z), entre las horas cuya celda era buena? */
function tensionSeMovio(fam, a, z) {
  // Tras la limpieza, una celda de tensión buena queda válida, retenida o congelada (pasada iii): las tres cuentan.
  const buena = (c) => c === CODIGO.VALIDO || c === CODIGO.RETENIDO || c === CODIGO.CONGELADO;
  for (const f of FAMILIAS_U) {
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

/**
 * Comprueba un punto-mes limpiado CON la marca y deja el rastro en su resumen. En un nivel marcado, ninguna corriente puede
 * quedar «congelada» en un tramo en que la tensión se movió: si queda, el limpiador de la pestaña es de una versión
 * anterior (caché del navegador) y se detiene en vez de guardar en silencio lo de siempre. Cada nivel marcado lleva en su
 * resumen `bandaMuertaAceptadas` (horas con alguna corriente repetida tomada como buena). Modifica y devuelve `p`.
 * @param {{niveles: Object, resumen: Object}} p  el resultado de `procesarPuntoMes(…, {bandaMuerta: niveles})`
 * @param {string[]} niveles  los niveles marcados del punto
 */
export function conMarcaBandaMuerta(p, niveles) {
  for (const nv of niveles || []) {
    const x = p && p.niveles ? p.niveles[nv] : null;
    if (!x || !x.fam) continue;
    const fams = FAMILIAS_I.map((f) => x.fam[f]).filter(Boolean);
    const n = fams.length ? fams[0].m.length : 0;
    for (const s of fams) {
      let ini = -1;
      for (let h = 0; h <= n; h++) {
        const sigue = h < n && s.m[h] === CODIGO.CONGELADO && ini >= 0 && s.v[h] === s.v[ini];
        if (sigue) continue;
        if (ini >= 0 && h - ini >= CONGELADO_MIN_H && tensionSeMovio(x.fam, ini, h)) {
          throw new Error('El limpiador de esta pestaña es de una versión anterior y no aplica la banda muerta de la corriente: recargue la página (Cmd+Shift+R) y vuelva a intentarlo.');
        }
        ini = h < n && s.m[h] === CODIGO.CONGELADO ? h : -1;
      }
    }
    let aceptadas = 0;
    for (let h = 0; h < n; h++) if (fams.some((s) => s.m[h] === CODIGO.RETENIDO)) aceptadas++;
    if (p.resumen && p.resumen[nv]) p.resumen[nv] = { ...p.resumen[nv], bandaMuertaAceptadas: aceptadas };
  }
  return p;
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
