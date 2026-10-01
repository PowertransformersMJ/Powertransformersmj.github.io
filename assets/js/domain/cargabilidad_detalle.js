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
import { codigoDevanado } from './cargabilidad_config.js';

/** Lo que se muestra en lugar de un dato que no existe. */
export const SIN_DATO = '—';

const CLAVES_DIAG = Object.freeze(['carg', 'edad', 'dga', 'fur', 'herm']);

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
export function picoPrimario(d) {
  const car = d && d.P ? d.P.car : null;
  return (typeof car === 'number' && Number.isFinite(car)) ? car : null;
}

/**
 * Frase bajo la curva. Solo afirma lo que sostienen los datos de la fila:
 * nombra el devanado que supera su ampacidad (el que fija `cmax`), menciona
 * el 1er límite SCADA solo si ese devanado lo tiene y lo pasa, y sin medida
 * no dice que el equipo opere bien.
 */
export function fraseCarga(d) {
  if (!d || typeof d.cmax !== 'number' || !Number.isFinite(d.cmax)) {
    return 'Sin corriente medida: no hay carga que comparar con su ampacidad.';
  }
  if (d.cmax > 100) {
    const o = d[codigoDevanado(d.dev) || 'P'] || {};
    const pasaL1 = typeof o.l1 === 'number' && typeof o.car === 'number' && o.car > o.l1;
    const quien = d.dev ? ` del ${String(d.dev).toLowerCase()}` : '';
    return `La corriente${quien} supera su ampacidad nominal${pasaL1 ? ' y el 1er límite SCADA' : ''} en el pico de demanda.`;
  }
  return 'Equipo operando dentro de su capacidad nominal en los devanados medidos.';
}

/** «34.5 / 13.8 kV» (terciaria solo si existe); sin ninguna tensión, «—». */
export function tensionTexto(d) {
  const p = textoODash(d && d.vp);
  const s = textoODash(d && d.vs);
  const t = (d && d.vt !== 'N/A') ? textoODash(d && d.vt) : SIN_DATO;
  if (p === SIN_DATO && s === SIN_DATO && t === SIN_DATO) return SIN_DATO;
  return `${p} / ${s}${t !== SIN_DATO ? ' / ' + t : ''} kV`;
}
