// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · DEVANADOS de placa por transformador
// ──────────────────────────────────────────────────────────────
// Para cada devanado registrado (primario, secundario, terciario): tensión, ampacidad (corriente
// nominal con ventiladores en servicio, `53 §3`), POTENCIA DEL DEVANADO y, si el SCADA lo mide, su carga.
// La placa del parque no guarda la potencia de cada devanado: se CALCULA de su tensión y su
// ampacidad, √3 × kV × A. En un equipo de tres devanados cada uno tiene la suya (p. ej.
// 110 kV · 40 MVA, 34,5 kV · 15 MVA, 13,8 kV · 35 MVA), y la placa solo da una.
// Monofásicos (`electrico.fases` = 1): kV × A, o kV × A / √3 si el devanado va entre fase y neutro
// (el parque guarda la tensión de línea del sistema); se toma la que cuadra con la placa.
// Archivo NUEVO (L-102): lista y detalle leen de aquí; ninguno exporta algo nuevo al otro.
// Dominio puro: sin DOM ni Firebase.
// ══════════════════════════════════════════════════════════════

import { DEVANADO } from './scada_carga_config.js';

/** Un devanado cuya potencia supera la de placa del equipo en más de este factor no cuadra. */
export const FACTOR_NO_CUADRA = 1.5;

const pos = (x) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? v : null; };
const R3 = Math.sqrt(3);

/** Potencia de placa del equipo en kVA: la mayor de sus etapas (la ampacidad es la de ventiladores en servicio). */
export function potenciaPlacaKva(tx) {
  const p = (tx && tx.placa) || {};
  const v = [p.potencia_ofaf_kva, p.potencia_onaf_kva, p.potencia_kva, p.potencia_onan_kva].map(pos).filter(Boolean);
  return v.length ? Math.max(...v) : null;
}

/** Potencia de un devanado en MVA: √3 × kV × A / 1000 (con `fases` = 1, kV × A / 1000). */
export function potenciaDevanadoMva(kv, A, fases) {
  const k = pos(kv); const a = pos(A);
  if (!k || !a) return null;
  return (Number(fases) === 1 ? 1 : R3) * k * a / 1000;
}

/**
 * Potencia y conexión del devanado. Trifásico: √3·kV·A. Monofásico: kV·A, o kV·A/√3 (fase-neutro) si
 * esa cuadra mejor con la placa. Sin placa, el monofásico queda en kV·A.
 */
export function potenciaYConexion(kv, A, fases, placaMva) {
  const m = potenciaDevanadoMva(kv, A, fases);
  if (m == null) return { mva: null, conexion: null };
  if (Number(fases) !== 1) return { mva: m, conexion: 'trifasico' };
  const fn = m / R3;
  if (placaMva && Math.abs(Math.log(fn / placaMva)) < Math.abs(Math.log(m / placaMva))) return { mva: fn, conexion: 'fase_neutro' };
  return { mva: m, conexion: 'monofasico' };
}

/** Causa probable de un devanado que no cuadra (razón = su potencia ÷ la de placa, ya > FACTOR_NO_CUADRA). */
export function causaNoCuadra(razon, fases) {
  if (razon >= 8 && razon <= 12) return 'errata_x10';
  if (Number(fases) !== 1 && ((razon >= 1.6 && razon <= 1.9) || (razon >= 2.7 && razon <= 3.3))) return 'parece_monofasico';
  return 'no_cuadra_placa';
}

/**
 * Devanados registrados del transformador, con lo que el SCADA dice de cada uno.
 * La carga de un devanado se publica SOLO si el equipo tiene cifra (`calc.pct`): un circuito sin confirmar,
 * una homologación excluida o sin homologación «no dan número» (decisión del Ingeniero, `scada_carga_vista.js`),
 * y tampoco lo dan sus devanados. Nunca se suman niveles: si dos caen en el mismo devanado, manda el mayor.
 * @param {object} tx    transformador del parque (`electrico`, `placa`)
 * @param {object|null} calc  resultado de `calcularEquipo`, o null
 * @returns {Array<{d:'P'|'S'|'T', nombre:string, kv:number|null, A:number|null, mva:number|null,
 *   conexion:null|'trifasico'|'monofasico'|'fase_neutro', niveles:string[], pct:number|null, iP99:number|null,
 *   manda:boolean, aviso:null|'sin_tension'|'sin_ampacidad'|'errata_x10'|'parece_monofasico'|'no_cuadra_placa'}>}
 */
export function devanadosDe(tx, calc) {
  const e = (tx && tx.electrico) || {};
  const datos = {
    P: [e.tension_primaria_kv, e.corriente_nominal_primaria_a],
    S: [e.tension_secundaria_kv, e.corriente_nominal_secundaria_a],
    T: [e.tension_terciaria_kv, e.corriente_nominal_terciaria_a]
  };
  const pk = potenciaPlacaKva(tx);
  const placaMva = pk != null ? pk / 1000 : null;
  const niveles = (calc && calc.niveles) || [];
  const conCifra = !!(calc && calc.pct != null);
  const out = [];
  for (const d of ['P', 'S', 'T']) {
    const kv = pos(datos[d][0]); const A = pos(datos[d][1]);
    if (!kv && !A) continue;                         // devanado no registrado (p. ej. sin terciario)
    const { mva, conexion } = potenciaYConexion(kv, A, e.fases, placaMva);
    const deEste = niveles.filter((n) => n.devanado === d);
    const conPct = conCifra ? deEste.filter((n) => n.pct != null) : [];
    const pct = conPct.length ? Math.max(...conPct.map((n) => n.pct)) : null;
    let aviso = null;
    if (!kv) aviso = 'sin_tension';
    else if (!A) aviso = 'sin_ampacidad';
    else if (placaMva && mva > FACTOR_NO_CUADRA * placaMva) aviso = causaNoCuadra(mva / placaMva, e.fases);
    out.push({
      d, nombre: DEVANADO[d], kv, A, mva, conexion, niveles: deEste.map((n) => n.etiqueta || n.nivel),
      pct, iP99: pct != null && A ? pct * A / 100 : null,
      manda: conCifra && calc.devMax === d, aviso
    });
  }
  return out;
}

/** Texto corto del aviso de un devanado (lista y detalle). */
export const TEXTO_AVISO_DEVANADO = Object.freeze({
  sin_tension: 'sin tensión de placa',
  sin_ampacidad: 'sin ampacidad',
  errata_x10: 'posible errata ×10 en la ampacidad: corregir ampacidad y carga juntas',
  parece_monofasico: 'su potencia cuadra como monofásico: confirmar el número de fases',
  no_cuadra_placa: 'su potencia no cuadra con la de placa: la ampacidad parece de otra potencia'
});

// ── Formato (sin DOM: toLocaleString) ───────────────────────────────────────
const n = (v, dec) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
/** Tensión: sin decimales si es entera (110 kV), con uno si no (13,8 kV). */
export const kvTexto = (kv) => n(kv, Number.isInteger(kv) ? 0 : 1);
/** Ampacidad: un decimal por debajo de 100 A (7,2 A), entera desde ahí. */
export const ampTexto = (A) => n(A, A < 100 ? 1 : 0);
/** Potencia: un decimal desde 10 MVA, dos por debajo (0,25 MVA). */
export const mvaTexto = (mva) => n(mva, mva >= 10 ? 1 : 2);
/** Carga del devanado con un decimal, como la cifra del equipo. */
export const pctTexto = (pct) => n(pct, 1);

// ── CSV (los tres devanados en columnas fijas) ─────────────────────────────
export const CSV_DEV_CAB = ['P', 'S', 'T'].flatMap((d) => [DEVANADO[d] + '_kV', DEVANADO[d] + '_ampacidad_A', DEVANADO[d] + '_potencia_calc_MVA', DEVANADO[d] + '_carga_pct']);
/** Valores del CSV para una fila (vacíos si el devanado no está registrado o la fila viene de un módulo viejo). */
export function csvDevanados(ds) {
  const lista = Array.isArray(ds) ? ds : [];
  return ['P', 'S', 'T'].flatMap((d) => {
    const v = lista.find((y) => y && y.d === d && y.nombre);
    return v ? [v.kv, v.A, v.mva != null ? Math.round(v.mva * 100) / 100 : null, v.pct] : [null, null, null, null];
  });
}
