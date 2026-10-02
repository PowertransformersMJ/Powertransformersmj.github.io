// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Partes por millón (ppm) de la última DGA desde el Excel de Salud de Activos · `99 §131`
// ──────────────────────────────────────────────────────────────────────────────
// El importador siempre LEYÓ los gases de la hoja TX_Potencia, pero solo guardaba las calificaciones. Desde §131 la
// última DGA en ppm se guarda en el campo `ultima_dga` de la RAÍZ del transformador (no dentro de `salud_actual`: el
// recálculo de salud y la edición de inventario reemplazan ese mapa). Sin fecha de toma: el archivo no la trae.
// Un gas sin valor («N/D», «<1», vacío) queda null, nunca 0. Archivo NUEVO (L-102). Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

import { normalizarNumeroExcel } from './importador.js';

export const GASES_PPM = Object.freeze(['H2', 'CH4', 'C2H4', 'C2H6', 'C2H2', 'CO', 'CO2']);
/** Hoja del parque de potencia en el Excel de Salud de Activos. */
export const HOJA_GASES = 'TX_Potencia';

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const ALIAS = Object.freeze({ H2: ['h2', 'hidrogeno'], CH4: ['ch4', 'metano'], C2H4: ['c2h4', 'etileno'], C2H6: ['c2h6', 'etano'],
  C2H2: ['c2h2', 'acetileno'], CO: ['co', 'monoxido'], CO2: ['co2', 'dioxido'] });

function valor(fila, alias) {
  const llaves = Object.keys(fila);
  for (const a of alias) { const k = llaves.find((x) => norm(x) === a); if (k !== undefined) return fila[k]; }
  return undefined;
}

/** Gases en ppm de una fila (mismas cabeceras que el importador). null si la fila no trae ni un gas. */
export function gasesDeFila(fila) {
  if (!fila || typeof fila !== 'object') return null;
  const gases = {};
  for (const k of GASES_PPM) {
    const n = normalizarNumeroExcel(valor(fila, ALIAS[k]));
    gases[k] = n != null && n >= 0 ? n : null;
  }
  return GASES_PPM.some((k) => gases[k] != null) ? gases : null;
}

/** El objeto que se guarda en `ultima_dga`. */
export function ultimaDgaDeFila(fila, { archivo = '', ahoraISO = '' } = {}) {
  const gases = gasesDeFila(fila);
  if (!gases) return null;
  return { gases, fuente: 'salud_activos', archivo: String(archivo || ''), importado_en: String(ahoraISO || ''), fecha_toma: null };
}

const clave = (v) => String(v == null ? '' : v).trim().toUpperCase();
const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);

/** ¿Dos `ultima_dga` traen los mismos gases? (para no reescribir lo que ya está igual) */
function mismosGases(a, b) {
  if (!a || !b || !a.gases || !b.gases) return false;
  return GASES_PPM.every((k) => (a.gases[k] == null ? null : Number(a.gases[k])) === (b.gases[k] == null ? null : Number(b.gases[k])));
}

/**
 * Plan de la carga «solo gases»: qué equipo recibe qué ppm. Cruza por la matrícula (el importador la guarda como
 * `codigo`). No escribe nada: la página lo SIMULA primero. Una matrícula que se repite en el archivo es AMBIGUA (en un
 * Excel real eran dos transformadores distintos): ninguna de sus filas se escribe; va a `repetidas` para revisarla.
 * @param {Array<object>} filas  filas de la hoja TX_Potencia (sheet_to_json)
 * @param {Array<object>} parque  documentos de /transformadores (con id)
 * @returns {{escribir:Array<{id, matricula, ultima_dga}>, iguales:string[], sinGases:string[], sinCoincidencia:string[], repetidas:string[]}}
 */
export function planCargaGases(filas, parque, { archivo = '', ahoraISO = '' } = {}) {
  const porClave = new Map();
  for (const tx of parque || []) {
    for (const k of [tx.codigo, leer(tx, 'identificacion.codigo'), leer(tx, 'identificacion.matricula')]) {
      const c = clave(k);
      if (!c) continue;
      if (!porClave.has(c)) porClave.set(c, new Set());
      porClave.get(c).add(tx);
    }
  }
  const plan = { escribir: [], iguales: [], sinGases: [], sinCoincidencia: [], repetidas: [] };
  const matDe = (fila) => clave(valor(fila, ['matricula', 'matrícula']) ?? valor(fila, ['codigo', 'código']));
  const veces = new Map();
  for (const fila of filas || []) { const mat = matDe(fila); if (mat) veces.set(mat, (veces.get(mat) || 0) + 1); }
  for (const fila of filas || []) {
    const mat = matDe(fila);
    if (!mat) continue;
    if (veces.get(mat) > 1) { if (!plan.repetidas.includes(mat)) plan.repetidas.push(mat); continue; }
    const u = ultimaDgaDeFila(fila, { archivo, ahoraISO });
    if (!u) { plan.sinGases.push(mat); continue; }
    const txs = porClave.get(mat);
    if (!txs || txs.size !== 1) { plan.sinCoincidencia.push(mat); continue; }
    const [tx] = txs;
    if (mismosGases(tx.ultima_dga, u)) { plan.iguales.push(mat); continue; }
    plan.escribir.push({ id: tx.id, matricula: mat, ultima_dga: u });
  }
  return plan;
}
