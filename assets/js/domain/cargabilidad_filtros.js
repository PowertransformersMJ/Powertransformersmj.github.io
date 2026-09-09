// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · FILTROS
// Función pura aplicarFiltros + helpers para selectores.
// ══════════════════════════════════════════════════════════════

import { sev } from './cargabilidad_severidad.js';

/**
 * Normaliza el filtro de zonas a un Set.
 *
 * Acepta Set, array, cadena o vacío: el filtro pasó de una zona a VARIAS
 * (encargo del Ingeniero, 2026-09-09) y esta función es lo que permite que
 * cualquier llamada antigua con `zona: 'BOLIVAR'` siga funcionando en vez de
 * filtrar de más en silencio, que es como se pierde media flota sin que nadie
 * lo note.
 *
 * @returns {Set<string>} vacío = TODAS las zonas, no ninguna.
 */
export function normalizarZonas(v) {
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v.filter(Boolean));
  if (typeof v === 'string' && v) return new Set([v]);
  return new Set();
}

/**
 * @typedef {Object} CargaFiltros
 * @property {string} q       Texto libre (busca en sub / id / dep)
 * @property {Set<string>} zona  Zonas operativas activas · vacío = todas
 * @property {string} dep     Departamento exacto
 * @property {string} grupo   G1 / G2 / G3
 * @property {string} dev     'all' | 'P' | 'S' | 'T'
 * @property {Set<string>} sev Severidades activas (cri/ale/avi/ok)
 */

/**
 * Aplica los filtros del dashboard a un array de transformadores.
 * Función pura · no muta el input.
 */
export function aplicarFiltros(rows, filtros) {
  if (!Array.isArray(rows)) return [];
  const { q = '', zona = '', dep = '', grupo = '', dev = 'all', sev: sevActivas } = filtros || {};
  const setSev  = sevActivas instanceof Set ? sevActivas : new Set(sevActivas || []);
  const setZona = normalizarZonas(zona);
  const qLow = String(q || '').toLowerCase().trim();

  return rows.filter(d => {
    if (!d) return false;
    // Sin zonas marcadas se ven TODAS. Es lo contrario del criterio de las
    // severidades, donde el estado inicial las trae las cuatro activas: aquí un
    // Set vacío significa «no acotado», no «nada».
    if (setZona.size && !setZona.has(d.zona)) return false;
    if (dep   && d.dep   !== dep)   return false;
    if (grupo && d.grupo !== grupo) return false;
    if (qLow) {
      const sub = String(d.sub || '').toLowerCase();
      const id  = String(d.id  || '').toLowerCase();
      const dp  = String(d.dep || '').toLowerCase();
      if (!sub.includes(qLow) && !id.includes(qLow) && !dp.includes(qLow)) return false;
    }
    const s = sev(d.cmax);
    if (s === 'nd') {
      // Sin dato se trata bajo "normal" (consistente con el archivo
      // original): solo aparece cuando el chip ok está activo.
      if (!setSev.has('ok')) return false;
    } else if (!setSev.has(s)) return false;

    if (dev !== 'all') {
      const o = d[dev];
      if (!o || o.pct == null) return false;
    }
    return true;
  });
}

/**
 * Devuelve los valores únicos de un campo del dataset, ordenados
 * alfabéticamente y descartando valores vacíos / 'N/D'.
 */
export function listarUnicos(rows, campo) {
  if (!Array.isArray(rows)) return [];
  const set = new Set();
  for (const d of rows) {
    const v = d && d[campo];
    if (v && v !== 'N/D' && v !== 'N/A') set.add(v);
  }
  return [...set].sort();
}

/**
 * Construye el estado inicial de filtros con todas las severidades
 * activas (chips iniciales).
 */
export function filtrosVacios() {
  return {
    q: '', zona: new Set(), dep: '', grupo: '', dev: 'all',
    sev: new Set(['cri', 'ale', 'avi', 'ok']),
  };
}
