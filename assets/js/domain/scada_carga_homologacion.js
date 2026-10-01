// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · homologación matrícula ↔ punto SCADA (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Cadena: transformador (matrícula) → fila de la homologación → clave SCADA ('/estación/elemento',
// sin nivel: abarca todos los niveles del punto) → niveles medidos → devanado P/S/T (por la
// tensión de placa, ±10 %) → ampacidad del devanado.
// Decisión del Ingeniero (2026-09-30): las filas dudosas se MUESTRAN con su aviso y su
// cargabilidad no es firme hasta que él las confirme una por una (pestaña Homologación).
// Los avisos se detectan por REGLA (aquí no hay ningún nombre real; el repo es público).
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { normalizarTexto, claveId, esElementoTransformador } from './scada_carga_csv.js';
import { CALCULO, NIVELES } from './scada_carga_config.js';

/** FNV-1a de 32 bits → hex (ids estables y cortos). */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Matrícula comparable (sin espacios ni diferencias de mayúsculas). */
export function normalizarMatricula(m) {
  return String(m == null ? '' : m).toUpperCase().replace(/\s+/g, '').trim();
}

/** Subestación comparable: sin tildes, sin mayúsculas y con un solo espacio. */
const subestacionComparable = (s) => normalizarTexto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Id estable de una fila de la homologación (matrícula + subestación). Una tilde o un espacio de
 * más en el Excel no cambian el id (si cambiaran, la fila «nueva» perdería la confirmación).
 */
export function filaId(matricula, subestacion) {
  return 'r' + fnv1a(normalizarMatricula(matricula) + '|' + subestacionComparable(subestacion));
}

/** '/Est/elem' → {est, elem} o null si el texto no es una clave. */
export function analizarClaveHomologada(texto) {
  const t = String(texto || '').trim();
  const m = t.match(/^\/\s*([^/]+?)\s*\/\s*([^/]+?)\s*$/);
  return m ? { est: m[1], elem: m[2] } : null;
}

const encab = (s) => normalizarTexto(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * Filas de la hoja de homologación (array de arrays, como lo da SheetJS).
 * Reconoce el encabezado por SUBESTACION, MATRICULA y la columna que contiene 'SWTRAFO'.
 * @returns {{ok, motivo?, filas: Array<{orden, subestacion, matricula, texto, clave: {est, elem}|null}>}}
 */
export function leerFilasHomologacion(aoa) {
  const filas = Array.isArray(aoa) ? aoa : [];
  let cab = -1; let cS = -1; let cM = -1; let cK = -1;
  for (let i = 0; i < Math.min(filas.length, 20) && cab < 0; i++) {
    const r = (filas[i] || []).map(encab);
    const s = r.findIndex((x) => x === 'SUBESTACION');
    const m = r.findIndex((x) => x === 'MATRICULA');
    const k = r.findIndex((x) => x.includes('SWTRAFO'));
    if (s >= 0 && m >= 0 && k >= 0) { cab = i; cS = s; cM = m; cK = k; }
  }
  if (cab < 0) return { ok: false, motivo: 'No se encontró el encabezado SUBESTACION / MATRICULA / swTrafo.', filas: [] };
  const out = [];
  for (let i = cab + 1; i < filas.length; i++) {
    const r = filas[i] || [];
    const subestacion = String(r[cS] == null ? '' : r[cS]).trim();
    const matricula = String(r[cM] == null ? '' : r[cM]).trim();
    const texto = String(r[cK] == null ? '' : r[cK]).trim();
    if (!subestacion && !matricula && !texto) continue;
    out.push({ orden: out.length + 1, subestacion, matricula, texto, clave: analizarClaveHomologada(texto) });
  }
  return { ok: true, filas: out };
}

/**
 * Funde las filas nuevas del Excel con la homologación vigente. Conserva cada decisión; una fila
 * que sale del Excel queda `retirada: true` (nunca se borra).
 * @returns {{filas: Object<string, object>, nuevas, cambiadas, retiradas, colisiones: string[]}}
 */
export function fusionarHomologacion(nuevas, vigente) {
  const previas = (vigente && vigente.filas) || {};
  const filas = {};
  const colisiones = [];
  let n = 0; let c = 0;
  for (const f of nuevas) {
    const id = filaId(f.matricula, f.subestacion);
    if (filas[id]) { colisiones.push(f.matricula); continue; }
    const p = previas[id];
    const base = {
      orden: f.orden, subestacion: f.subestacion, matricula: f.matricula, texto_excel: f.texto,
      clave_excel: f.clave ? '/' + f.clave.est + '/' + f.clave.elem : null, decision: p ? (p.decision || null) : null
    };
    if (!p) n++;
    else if (p.clave_excel !== base.clave_excel || p.texto_excel !== base.texto_excel) c++;
    filas[id] = base;
  }
  let r = 0;
  const sueltas = [];
  for (const [id, p] of Object.entries(previas)) {
    if (filas[id]) continue;
    filas[id] = { ...p, retirada: true };
    if (!p.retirada) { r++; if (p.decision) sueltas.push(p); }
  }
  // Una fila nueva hereda la decisión de la que salió del Excel si es la ÚNICA con su matrícula
  // (se corrigió el nombre de la subestación). Si la clave cambió, el aviso CLAVE_CAMBIO lo dirá.
  for (const f of Object.values(filas)) {
    if (f.retirada || f.decision || previas[filaId(f.matricula, f.subestacion)]) continue;
    const m = normalizarMatricula(f.matricula);
    const cand = sueltas.filter((p) => normalizarMatricula(p.matricula) === m);
    if (m && cand.length === 1) f.decision = cand[0].decision;
  }
  return { filas, nuevas: n, cambiadas: c, retiradas: r, colisiones };
}

/** Clave efectiva de una fila: la de la decisión del Ingeniero, o la del Excel. */
export function claveEfectiva(fila) {
  return (fila && fila.decision && fila.decision.clave) || (fila && fila.clave_excel) || null;
}

/** Placa de un transformador del parque: {P, S, T} con {kv, A} (null donde falta). */
export function placaDe(tx) {
  const e = (tx && tx.electrico) || {};
  const num = (x) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? v : null; };
  const d = (kv, a) => ({ kv: num(kv), A: num(a) });
  return {
    P: d(e.tension_primaria_kv, e.corriente_nominal_primaria_a),
    S: d(e.tension_secundaria_kv, e.corriente_nominal_secundaria_a),
    T: d(e.tension_terciaria_kv, e.corriente_nominal_terciaria_a)
  };
}

/**
 * Mapa nivel → devanado por la tensión de placa (±10 %). Nunca se suman niveles.
 * @param {string[]} niveles  ['N34_5', 'N13_8', …]
 * @returns {{mapa: Object<string, 'P'|'S'|'T'>, sinDevanado: string[], ambiguos: string[], sinMedida: string[]}}
 */
export function mapaNivelDevanado(niveles, placa) {
  const mapa = {}; const sinDevanado = []; const ambiguos = [];
  for (const n of niveles || []) {
    const kv = NIVELES[n] ? NIVELES[n].kv : null;
    const cand = ['P', 'S', 'T'].filter((d) => placa && placa[d] && placa[d].kv
      && Math.abs(placa[d].kv - kv) / kv <= CALCULO.toleranciaNivelPlaca);
    if (cand.length === 1) mapa[n] = cand[0];
    else if (cand.length === 0) sinDevanado.push(n);
    else ambiguos.push(n);
  }
  const usados = new Set(Object.values(mapa));
  const sinMedida = ['P', 'S', 'T'].filter((d) => placa && placa[d] && placa[d].kv && placa[d].A && !usados.has(d));
  return { mapa, sinDevanado, ambiguos, sinMedida };
}

/** Avisos y si BLOQUEAN la firmeza hasta que el Ingeniero confirme. */
export const AVISOS = Object.freeze({
  NO_ENCONTRADO: { bloquea: true, texto: 'La homologación no trae un punto SCADA para este transformador.' },
  CLAVE_CIRCUITO: { bloquea: true, texto: 'Se mide un circuito, no el transformador: es solo una parte de su carga.' },
  CLAVE_COMPARTIDA: { bloquea: true, texto: 'La misma medida está asignada a más de un transformador.' },
  MATRICULA_REPETIDA: { bloquea: true, texto: 'La matrícula aparece en más de una fila de la homologación.' },
  MATRICULA_SIN_EQUIPO: { bloquea: true, texto: 'La matrícula no existe en el parque.' },
  NIVEL_SIN_DEVANADO: { bloquea: true, texto: 'Un nivel medido no coincide con ninguna tensión de placa.' },
  NIVEL_AMBIGUO: { bloquea: true, texto: 'Un nivel medido coincide con más de un devanado.' },
  RELACION_NIVELES: { bloquea: true, texto: 'La relación de corrientes entre los dos lados no coincide con la de tensiones: puede ser otro equipo o una placa errada.' },
  SIN_DATOS_AUN: { bloquea: false, texto: 'Todavía no hay datos cargados de este punto.' },
  DEVANADO_SIN_MEDIDA: { bloquea: false, texto: 'Un devanado de placa no tiene medida SCADA.' },
  CLAVE_CAMBIO: { bloquea: true, texto: 'La clave del Excel cambió después de la confirmación.' },
  RETIRADA: { bloquea: false, texto: 'La fila ya no está en el Excel; conserva su decisión.' }
});

/**
 * Relación entre los dos lados (dos devanados): corriente baja / corriente alta frente a kV alta / kV baja.
 * @returns {{medido, esperado, ok}|null}
 */
export function relacionNiveles(resumenPorNivel, mapa, placa) {
  const niveles = Object.keys(mapa || {});
  if (niveles.length !== 2) return null;
  const [a, b] = niveles.sort((x, y) => NIVELES[y].kv - NIVELES[x].kv);   // a = alta, b = baja
  const ra = resumenPorNivel[a]; const rb = resumenPorNivel[b];
  if (!ra || !rb || !(ra.i && ra.i.p50 > 0) || !(rb.i && rb.i.p50 > 0)) return null;
  const medido = rb.i.p50 / ra.i.p50;
  const esperado = NIVELES[a].kv / NIVELES[b].kv;
  return { medido, esperado, ok: Math.abs(medido - esperado) / esperado <= CALCULO.relacionNivelesTol };
}

/**
 * Avisos de una fila con su contexto.
 * @param {object} fila  fila de la homologación vigente
 * @param {{filasPorClave: Map<string, number>, filasPorMatricula: Map<string, number>, tx: object|null,
 *          punto: {niveles: Object<string, object>}|null, resumenPorNivel?: object}} ctx
 * @returns {{avisos: string[], mapa, relacion}}
 */
export function avisosFila(fila, ctx) {
  const avisos = [];
  const clave = claveEfectiva(fila);
  const k = analizarClaveHomologada(clave);
  if (fila.retirada) avisos.push('RETIRADA');
  if (!k) avisos.push('NO_ENCONTRADO');
  else if (!esElementoTransformador(k.elem)) avisos.push('CLAVE_CIRCUITO');
  if (k && (ctx.filasPorClave.get(claveId(k.est, k.elem)) || 0) > 1) avisos.push('CLAVE_COMPARTIDA');
  if ((ctx.filasPorMatricula.get(normalizarMatricula(fila.matricula)) || 0) > 1) avisos.push('MATRICULA_REPETIDA');
  if (!ctx.tx) avisos.push('MATRICULA_SIN_EQUIPO');
  if (fila.decision && fila.decision.clave_excel_vista != null && fila.decision.clave_excel_vista !== fila.clave_excel) avisos.push('CLAVE_CAMBIO');
  let mapa = null; let relacion = null;
  if (k && !ctx.punto) avisos.push('SIN_DATOS_AUN');
  if (ctx.punto) {
    const placa = placaDe(ctx.tx);
    const auto = mapaNivelDevanado(Object.keys(ctx.punto.niveles || {}), placa);
    mapa = (fila.decision && fila.decision.mapa) || auto.mapa;
    if (!(fila.decision && fila.decision.mapa)) {
      if (auto.sinDevanado.length) avisos.push('NIVEL_SIN_DEVANADO');
      if (auto.ambiguos.length) avisos.push('NIVEL_AMBIGUO');
    }
    if (auto.sinMedida.length) avisos.push('DEVANADO_SIN_MEDIDA');
    relacion = ctx.resumenPorNivel ? relacionNiveles(ctx.resumenPorNivel, mapa, placa) : null;
    if (relacion && !relacion.ok) avisos.push('RELACION_NIVELES');
  }
  return { avisos, mapa, relacion };
}

/**
 * Estado efectivo (la MISMA función en la página y en la administración):
 *   'excluida'   → el Ingeniero dijo «no usar» o la fila salió del Excel: no se calcula;
 *   'confirmada' → hay decisión y TODOS los avisos que bloquean ya los vio;
 *   'pendiente'  → algún aviso que bloquea sin confirmar: se muestra como provisional;
 *   'automatica' → sin avisos que bloqueen.
 */
export function estadoEfectivo(fila, avisos) {
  if (!fila) return 'sin_homologacion';
  if (fila.retirada || (fila.decision && fila.decision.tipo === 'no_usar')) return 'excluida';
  const bloqueantes = (avisos || []).filter((a) => AVISOS[a] && AVISOS[a].bloquea);
  if (fila.decision) {
    const vistos = new Set(fila.decision.avisos_vistos || []);
    return bloqueantes.every((a) => vistos.has(a)) ? 'confirmada' : 'pendiente';
  }
  return bloqueantes.length ? 'pendiente' : 'automatica';
}

/** Conteos por clave y por matrícula (para CLAVE_COMPARTIDA y MATRICULA_REPETIDA), sin las retiradas ni excluidas. */
export function conteosHomologacion(filas) {
  const filasPorClave = new Map(); const filasPorMatricula = new Map();
  for (const f of Object.values(filas || {})) {
    if (f.retirada || (f.decision && f.decision.tipo === 'no_usar')) continue;
    const k = analizarClaveHomologada(claveEfectiva(f));
    if (k) { const id = claveId(k.est, k.elem); filasPorClave.set(id, (filasPorClave.get(id) || 0) + 1); }
    const m = normalizarMatricula(f.matricula);
    filasPorMatricula.set(m, (filasPorMatricula.get(m) || 0) + 1);
  }
  return { filasPorClave, filasPorMatricula };
}

/** Objetivo de la importación: estaciones de las claves homologadas; sus elementos homologados y TODO swTrafo de esas estaciones. */
export function objetivoImportacion(filas) {
  const elementos = new Map();
  for (const f of Object.values(filas || {})) {
    if (f.decision && f.decision.tipo === 'no_usar') continue;
    for (const texto of [f.clave_excel, f.decision && f.decision.clave]) {
      const k = analizarClaveHomologada(texto);
      if (!k) continue;
      const est = normalizarTexto(k.est);
      if (!elementos.has(est)) elementos.set(est, new Set());
      elementos.get(est).add(normalizarTexto(k.elem));
    }
  }
  return {
    estaciones: [...elementos.keys()],
    quiere(est, elem) {
      const s = elementos.get(est);
      return !!s && (s.has(elem) || /^sw(tr|auto)/.test(elem));
    }
  };
}
