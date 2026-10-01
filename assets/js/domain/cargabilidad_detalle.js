// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Dominio puro: la ventana de detalle de Cargabilidad
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE MÓDULO
// El clic en una fila de la tabla priorizada (o en el mapa de calor) no
// abría nada. La ventana leía `d.diag.carg`, un grupo de calificaciones
// que traía el archivo original —retirado por confidencialidad— y que no
// trae NINGUNA de las fuentes vivas: ni las filas del parque real
// (`cargabilidad_parque.js`) ni el baseline de demostración. `d.diag`
// indefinido → error → la ventana nunca se mostraba.
//
// Detrás de ese error había más afirmaciones sin dato: la curva del
// primario dibujada con `car || 0` («0,0 A» que nadie midió), «supera el
// 1er límite SCADA» en equipos sin límite SCADA, «dentro de su capacidad»
// sin medida y la condición `medio` en verde.
//
// Aquí vive lo que la ventana AFIRMA de un equipo, con una sola regla: lo
// que falta se muestra «—», nunca como un valor, y nada se toma de otra
// parte para rellenar (CLAUDE.md §3.2). Funciones puras, sin DOM.
// ══════════════════════════════════════════════════════════════

import { BUCKETS_HI } from './schema.js';
import { codigoDevanado, DEV_LABEL } from './cargabilidad_config.js';
import { tiempoAdmisible } from './sobrecarga_admisible.js';

/** Lo que se muestra en lugar de un dato que no existe. */
export const SIN_DATO = '—';

const CLAVES_DIAG = Object.freeze(['carg', 'edad', 'dga', 'fur', 'herm']);

const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

/** Texto de un campo, o «—». Un objeto nunca se pinta («[object Object]»). */
export function textoODash(v) {
  if (v == null || typeof v === 'object') return SIN_DATO;
  const s = String(v).trim();
  return s || SIN_DATO;
}

/**
 * Calificaciones 1–5 del panel «Diagnóstico de condición».
 *
 * Si la fila no trae `diag` —las del parque no lo traen— las cinco quedan en
 * null y la ventana muestra «—». NO se toman de `salud_actual.calif_*`: esas
 * tienen su propio vocabulario oficial y `calif_crg` tiene deuda abierta
 * (`10` TODO-64.b / TODO-56); mostrarlas aquí es una decisión aparte.
 *
 * @returns {{carg:number|null, edad:number|null, dga:number|null, fur:number|null, herm:number|null}}
 */
// ⚠️ La ventana usa `cargabilidad_diagnostico.js` desde `99 §124` (calificaciones
// de Salud de Activos). Esta se conserva por compat de caché (L-102) y sus pruebas.
export function diagnosticoDe(d) {
  const g = (d && d.diag && typeof d.diag === 'object') ? d.diag : {};
  const out = {};
  for (const k of CLAVES_DIAG) {
    const v = g[k];
    const n = (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) ? Number(v) : NaN;
    out[k] = Number.isFinite(n) ? n : null;
  }
  return out;
}

/**
 * Condición del equipo para la ventana.
 *
 * Las filas del parque traen la CLAVE del bucket oficial (`muy_pobre`): se
 * muestra con su nombre y su color de MO.00418 (`schema.js`), no la clave
 * cruda en verde. Un texto que no es clave se muestra tal cual y sin color
 * de juicio, salvo «OBSOLETO», que conserva el rojo que ya tenía. Vacío o
 * «N/D» → «—».
 *
 * @returns {{texto:string, color:string|null}}
 */
export function condicionDe(cond) {
  const s = typeof cond === 'string' ? cond.trim() : '';
  if (!s || s.toUpperCase() === 'N/D') return { texto: SIN_DATO, color: null };
  const b = BUCKETS_HI.find((x) => x.key === s.toLowerCase());
  if (b) return { texto: b.label, color: b.color };
  return { texto: s, color: /OBSOLET/i.test(s) ? 'var(--cri)' : null };
}

/**
 * Corriente medida del primario, que es la que dibuja la curva de tendencia.
 * Sin medida devuelve null —no cero—: la ventana no dibuja curva.
 * @returns {number|null}
 */
// ⚠️ Sin uso en la ventana desde `99 §124` (no hay curva de ejemplo); compat de caché (L-102).
export function picoPrimario(d) {
  const car = d && d.P ? d.P.car : null;
  return (typeof car === 'number' && Number.isFinite(car)) ? car : null;
}

/**
 * Qué se sabe de UN devanado (`k` = 'P' | 'S' | 'T'):
 *   'medido'        → corriente y ampacidad: hay porcentaje.
 *   'sin_ampacidad' → hay corriente medida pero no ampacidad: no se puede
 *                     evaluar, y la corriente NO se esconde.
 *   'sin_medida'    → hay ampacidad pero no corriente.
 *   'no_aplica'     → terciario de un equipo sin tensión terciaria.
 *   'sin_dato'      → nada.
 * Los medidores mostraban «N/A» (no aplica) para todo lo que faltaba y
 * escondían la corriente de un devanado sin ampacidad.
 */
export function estadoDevanado(d, k) {
  const o = d && d[k] ? d[k] : {};
  const amp = num(o.amp);
  const car = num(o.car);
  if (car != null && amp != null && amp > 0) return 'medido';
  if (car != null) return 'sin_ampacidad';
  if (amp != null) return 'sin_medida';
  if (k === 'T' && (!d || d.vt == null || d.vt === '' || d.vt === 'N/A')) return 'no_aplica';
  return 'sin_dato';
}

/**
 * Devanado con el que se leen la «Cargabilidad restante» y la sobrecarga
 * admisible: el más cargado (el que fija `cmax`), o el primario si no hay
 * ninguno. Antes era SIEMPRE el primario: con el secundario sobrecargado la
 * caja salía verde («hay margen») y la estimación de sobrecarga no aparecía.
 */
export function devanadoReferencia(d) {
  return (d && codigoDevanado(d.dev)) || 'P';
}

/**
 * Lectura de la sobrecarga admisible (IEEE C57.91, tabla simplificada) de un
 * devanado por encima de su ampacidad. Devuelve null si no hay sobrecarga.
 *
 * La tarjeta mostraba «Factor 1.1×» —el ESCALÓN de la tabla— como si fuera
 * el factor del equipo (102 % medido). Ahora se separan: `pct` es la carga
 * medida (% de la ampacidad, lo que se muestra: un factor de «1,00×» con
 * 100,3 % se contradecía) y `escalon` el de la tabla con que se estiman los
 * MINUTOS —el más cercano, como siempre lo hizo `tiempoAdmisible`—; el
 * envejecimiento sale de la carga medida. Por encima del último escalón la
 * tabla no sirve: `fueraDeTabla` y ni minutos ni envejecimiento (sería
 * extrapolar una curva simplificada).
 *
 * @returns {null | {pct:number, factor:number, escalon:number, tope:number,
 *                   fueraDeTabla:boolean, minutos:number|null,
 *                   envejecimiento:number|null}}
 */
export function lecturaSobrecarga(o) {
  const car = num(o && o.car);
  const amp = num(o && o.amp);
  if (car == null || amp == null || amp <= 0) return null;
  const factor = car / amp;
  if (factor <= 1) return null;
  // Mismo modelo que ya usaba la tarjeta: sobrecarga sostenida desde carga
  // nominal (100 %) a 30 °C.
  const sob = tiempoAdmisible(factor, 100, 30);
  const tope = tiempoAdmisible(1e6, 100, 30).factor_usado;
  const fueraDeTabla = factor > tope;
  const min = sob.minutos;
  return {
    pct: Math.round(factor * 1000) / 10,
    factor: Math.round(factor * 100) / 100,
    escalon: sob.factor_usado,
    tope,
    fueraDeTabla,
    minutos: (fueraDeTabla || min == null || !Number.isFinite(min)) ? null : min,
    envejecimiento: (fueraDeTabla || typeof sob.aceleracion_envejecimiento !== 'number')
      ? null : sob.aceleracion_envejecimiento,
  };
}

/**
 * Frase bajo la curva. Solo afirma lo que sostienen los datos de la fila:
 * nombra el devanado que supera su ampacidad (el que fija `cmax`), menciona
 * el 1er límite SCADA solo si ese devanado lo tiene y lo pasa, sin medida no
 * dice que el equipo opere bien, y avisa del devanado con corriente pero sin
 * ampacidad, que no se pudo evaluar. Ningún campo dice que la medida sea un
 * «pico de demanda» ni de qué hora es: se habla de la «medida registrada».
 */
export function fraseCarga(d) {
  if (!d || typeof d.cmax !== 'number' || !Number.isFinite(d.cmax)) {
    return 'Sin corriente medida: no hay carga que comparar con su ampacidad.';
  }
  const sinEvaluar = ['P', 'S', 'T']
    .filter((k) => estadoDevanado(d, k) === 'sin_ampacidad')
    .map((k) => DEV_LABEL[k].toLowerCase());
  const nota = !sinEvaluar.length ? ''
    : sinEvaluar.length === 1
      ? ` El ${sinEvaluar[0]} tiene corriente medida pero no ampacidad: no se pudo evaluar.`
      : ` El ${sinEvaluar.join(' y el ')} tienen corriente medida pero no ampacidad: no se pudieron evaluar.`;
  if (d.cmax > 100) {
    const o = d[devanadoReferencia(d)] || {};
    const pasaL1 = typeof o.l1 === 'number' && typeof o.car === 'number' && o.car > o.l1;
    const quien = d.dev ? ` del ${String(d.dev).toLowerCase()}` : '';
    return `La corriente${quien} supera su ampacidad nominal${pasaL1 ? ' y el 1er límite SCADA' : ''} en la medida registrada.${nota}`;
  }
  return `Equipo operando dentro de su capacidad nominal en los devanados con medida y ampacidad.${nota}`;
}

/** «34.5 / 13.8 kV» (terciaria solo si existe); sin ninguna tensión, «—». */
export function tensionTexto(d) {
  const p = textoODash(d && d.vp);
  const s = textoODash(d && d.vs);
  const t = (d && d.vt !== 'N/A') ? textoODash(d && d.vt) : SIN_DATO;
  if (p === SIN_DATO && s === SIN_DATO && t === SIN_DATO) return SIN_DATO;
  return `${p} / ${s}${t !== SIN_DATO ? ' / ' + t : ''} kV`;
}
