// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · máximo, mínimo e instantáneo de cada hora · `99 §126`
// ──────────────────────────────────────────────────────────────────────────────
// Se guardan crudos junto al promedio (claves max/min/ins de cada familia) y sirven SOLO para VER:
// la cifra de cargabilidad, la firmeza y la CRG siguen saliendo del promedio. El «máx» del SCADA trae
// picos falsos: al mostrarlo se ocultan los imposibles (extrasVisibles).
// Archivo NUEVO a propósito (L-102): todo lo nuevo de §126 se exporta desde aquí, así un módulo viejo
// guardado en la caché del navegador nunca recibe un import que no conoce. Solo importa exportaciones
// que ya existían. Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

import { CODIGOS_VALIDOS, FAMILIAS, FAMILIAS_I, FAMILIAS_U, PLAUSIBILIDAD_U } from './scada_carga_config.js';
import { esCentinela } from './scada_carga_limpieza.js';

/** Claves de los extras dentro de cada familia del doc (el orden es el de las columnas del CSV). */
export const EXTRAS = Object.freeze(['max', 'min', 'ins']);
/** Estadístico del NOMBRE del archivo → clave del extra. */
export const EXTRA_DE_ESTADISTICO = Object.freeze({ max: 'max', min: 'min', current: 'ins' });
export const NOMBRE_EXTRA = Object.freeze({ max: 'Máximo de la hora', min: 'Mínimo de la hora', ins: 'Instantáneo (hh:00)' });
/** Un extremo de más de estas veces el mayor promedio del rango (o la ampacidad, en corriente) es un pico falso. */
export const EXTRA_TOPE_X = 3;
/** Con extras un doc pesa ~3 veces más: el lote de escritura también se corta por bytes. */
export const LOTE_MAX_BYTES = 1000 * 1000;

const valida = (c) => CODIGOS_VALIDOS.includes(c);

/** ¿La serie tiene algún valor (no todo NaN)? */
export function tieneValor(arr) {
  if (!arr) return false;
  for (let i = 0; i < arr.length; i++) if (!Number.isNaN(arr[i])) return true;
  return false;
}

/**
 * Máximo, mínimo e instantáneo LISTOS PARA VER, nunca para calcular. Se muestran solo en las horas cuyo
 * PROMEDIO es válido y se ocultan los imposibles: topes del sistema; tensión por encima de 1,5 × kV
 * (escala equivocada) o negativa —una tensión BAJA sí se muestra: una caída dentro de la hora es justo lo
 * que el mínimo enseña—; corriente por encima de 3 × la ampacidad (la escala imposible de la cifra); y
 * cualquier valor de más de 3 veces el mayor promedio del rango (picos falsos del «máx» del SCADA).
 * @param {Object<string, {v, m, max?, min?, ins?}>} fam  series del rango por familia
 * @returns {{series: Object<string, Object<string, Float32Array>>, ocultos: number,
 *           hay: Object<string, boolean>, guardados: Object<string, boolean>}}
 *   hay = el valor se puede mostrar en el rango; guardados = el rango lo trae (aunque todo quede oculto).
 */
export function extrasVisibles(fam, kv, A = null) {
  const series = {}; let ocultos = 0; const hay = {}; const guardados = {};
  for (const f of FAMILIAS) {
    const s = fam[f];
    series[f] = {};
    if (!s) continue;
    let mayor = 0;
    for (let h = 0; h < s.v.length; h++) if (valida(s.m[h]) && Number.isFinite(s.v[h])) mayor = Math.max(mayor, Math.abs(s.v[h]));
    const tope = FAMILIAS_I.includes(f) && A > 0 ? EXTRA_TOPE_X * A : (mayor > 0 ? EXTRA_TOPE_X * mayor : Infinity);
    const esU = FAMILIAS_U.includes(f);
    for (const k of EXTRAS) {
      if (!s[k]) continue;
      const out = new Float32Array(s.v.length).fill(NaN);
      let alguno = false;
      for (let h = 0; h < s.v.length; h++) {
        const x = s[k][h];
        if (!valida(s.m[h]) || !Number.isFinite(x)) continue;
        guardados[k] = true;
        const imposible = esCentinela(x) || Math.abs(x) > tope
          || (esU && (x < 0 || (kv > 0 && x > PLAUSIBILIDAD_U[1] * kv)));
        if (imposible) { ocultos++; continue; }
        out[h] = x; alguno = true;
      }
      if (alguno) { series[f][k] = out; hay[k] = true; }
    }
  }
  return { series, ocultos, hay, guardados };
}
