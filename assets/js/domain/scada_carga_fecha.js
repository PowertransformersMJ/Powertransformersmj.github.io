// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · fecha y hora de Colombia (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Todo se calcula en hora de Colombia (UTC−5 fijo, sin horario de verano) con aritmética
// UTC, sin `new Date(texto)`: el resultado no depende de la zona del computador.
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { TIEMPO } from './scada_carga_config.js';

const H_MS = 3600 * 1000;
const OFF = TIEMPO.offsetColombiaH * H_MS;
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = (n) => String(n).padStart(2, '0');

/** Partes de un instante en hora de Colombia. */
export function partesCO(ms) {
  const d = new Date(ms - OFF);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), hora: d.getUTCHours(), min: d.getUTCMinutes() };
}

/** 'AAAA-MM-DDTHH:mm' (lo que da un input datetime-local) → ms, en hora de Colombia; null si no es válida. */
export function parseFechaHoraCO(texto) {
  const m = String(texto || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [a, mo, d, h, mi] = [+m[1], +m[2], +m[3], m[4] == null ? 0 : +m[4], m[5] == null ? 0 : +m[5]];
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(a, mo, 0)).getUTCDate() || h > 23 || mi > 59) return null;
  return Date.UTC(a, mo - 1, d, h, mi) + OFF;
}

/** ms → 'AAAA-MM-DDTHH:mm' para un input datetime-local (hora de Colombia). */
export function aInputCO(ms) {
  const p = partesCO(ms);
  return p.anio + '-' + dos(p.mes) + '-' + dos(p.dia) + 'T' + dos(p.hora) + ':' + dos(p.min);
}

/** ms → 'AAAA-MM-DD HH:mm' para Plotly (sin zona: se muestra tal cual, en hora de Colombia). */
export function xPlotly(ms) {
  const p = partesCO(ms);
  return p.anio + '-' + dos(p.mes) + '-' + dos(p.dia) + ' ' + dos(p.hora) + ':' + dos(p.min);
}

/** ms → '14-ago-2026 18:00'. */
export function formatoCO(ms) {
  if (ms == null) return '—';
  const p = partesCO(ms);
  return dos(p.dia) + '-' + MESES_CORTOS[p.mes - 1] + '-' + p.anio + ' ' + dos(p.hora) + ':' + dos(p.min);
}

/** Intervalo de una hora que empieza en ms: '14-ago-2026 18:00–19:00'. */
export function intervaloCO(ms) {
  if (ms == null) return '—';
  const f = partesCO(ms + H_MS);
  return formatoCO(ms) + '–' + dos(f.hora) + ':00';
}

/** 'AAAA-MM' → 'agosto 2026'. */
export function nombreMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return (MESES_LARGOS[m - 1] || mes) + ' ' + a;
}

/** Rango de un mes completo [inicio del día 1, inicio del día 1 del mes siguiente) en ms. */
export function rangoDeMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return { desde: Date.UTC(a, m - 1, 1) + OFF, hasta: Date.UTC(a, m, 1) + OFF };
}

/**
 * Valida un rango elegido por el usuario.
 * @returns {{ok: boolean, errores: Array<{campo: 'desde'|'hasta', texto: string}>}}
 */
export function validarRango({ desde, hasta, min = null, max = null, maxMeses = TIEMPO.maxMesesRango }) {
  const errores = [];
  if (desde == null) errores.push({ campo: 'desde', texto: 'Escriba una fecha y hora de inicio válidas.' });
  if (hasta == null) errores.push({ campo: 'hasta', texto: 'Escriba una fecha y hora final válidas.' });
  if (errores.length) return { ok: false, errores };
  if (desde >= hasta) errores.push({ campo: 'desde', texto: 'La fecha inicial debe ser anterior a la final.' });
  if (min != null && hasta <= min) errores.push({ campo: 'hasta', texto: 'El rango termina antes del primer dato cargado.' });
  if (max != null && desde >= max) errores.push({ campo: 'desde', texto: 'El rango empieza después del último dato cargado.' });
  if (hasta - desde > maxMeses * 31 * 24 * H_MS) errores.push({ campo: 'hasta', texto: 'El rango no puede pasar de ' + maxMeses + ' meses.' });
  return { ok: !errores.length, errores };
}
