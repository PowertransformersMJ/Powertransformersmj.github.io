// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · LECTURAS (I/O) · `99 §122`
// ──────────────────────────────────────────────────────────────
// Solo getDoc por id (las reglas niegan los listados de lo grande): homologación,
// catálogo, resumen de un mes y la serie de un punto-mes. Nada de onSnapshot. Una
// caché en memoria por sesión evita releer lo mismo al cambiar de rango.
// Firebase 10.14.1 (el mismo que firebase-init). Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe } from '../firebase-init.js';
import { desempaquetar } from '../domain/scada_carga_series.js';
import { ESCRITURA } from '../domain/scada_carga_config.js';

const cache = new Map();
const aU8 = (b) => (b && typeof b.toUint8Array === 'function' ? b.toUint8Array() : (b instanceof Uint8Array ? b : new Uint8Array(0)));

/** Olvida lo leído (tras una carga nueva). */
export function olvidarCache() { cache.clear(); }

async function leerUno(col, id) {
  const db = getDbSafe();
  if (!db) return { estado: 'fallo', error: 'sin conexión a la base' };
  try {
    const snap = await getDoc(doc(db, col, id));
    return snap.exists() ? { estado: 'ok', datos: snap.data() } : { estado: 'no_existe' };
  } catch (e) {
    console.warn('[scada-carga] lectura', col, e && e.code || e);
    return { estado: 'fallo', error: (e && e.code) || 'error' };
  }
}

/** Homologación vigente: {estado, datos}. */
export function leerHomologacion() { return leerUno('scada_homologacion', 'vigente'); }
/** Catálogo de lo cargado: {estado, datos}. */
export function leerCatalogo() { return leerUno('scada_catalogo', 'estado'); }
/** Resumen de un mes ('AAAA-MM'): {estado, datos}. */
export async function leerResumenMes(mes) {
  const k = 'r|' + mes;
  if (cache.has(k)) return cache.get(k);
  const r = await leerUno('scada_resumen', mes);
  if (r.estado !== 'fallo') cache.set(k, r);
  return r;
}

/** Convierte un doc de serie guardado en {niveles: {N: {kv, fam: {IR: {v: Float32Array, m, b}}}}}. */
export function desempaquetarDoc(d) {
  const out = { claveId: d.claveId, mes: d.mes, n: d.n, niveles: {} };
  for (const [nv, x] of Object.entries(d.niveles || {})) {
    out.niveles[nv] = { kv: x.kv, fam: {} };
    for (const [f, s] of Object.entries(x.fam || {})) out.niveles[nv].fam[f] = desempaquetar({ v: aU8(s.v), m: aU8(s.m), b: aU8(s.b) });
  }
  return out;
}

/**
 * Series de un punto en varios meses: {porMes: {AAAA-MM: {estado: 'ok'|'no_existe'|'fallo', serie?}}}.
 * Solo se piden los meses que el catálogo dice que existen para el punto.
 */
export async function leerSeriesPunto(claveId, meses) {
  const porMes = {};
  await Promise.all(meses.map(async (mes) => {
    const k = 's|' + claveId + '|' + mes;
    if (cache.has(k)) { porMes[mes] = cache.get(k); return; }
    const r = await leerUno('scada_series', claveId + '__' + mes);
    const reg = r.estado === 'ok' ? { estado: 'ok', serie: desempaquetarDoc(r.datos) } : { estado: r.estado };
    if (r.estado !== 'fallo') cache.set(k, reg);
    porMes[mes] = reg;
  }));
  return { porMes };
}

/** Últimas cargas (registro). */
export async function listarCargas(n = ESCRITURA.limiteRegistros) {
  const db = getDbSafe();
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'scada_cargas'), orderBy('abiertaEn', 'desc'), limit(Math.min(n, 20))));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Último registro de cambios de la homologación. */
export async function listarRegistroHomologacion(n = ESCRITURA.limiteRegistros) {
  const db = getDbSafe();
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'scada_homologacion_registro'), orderBy('en', 'desc'), limit(Math.min(n, 20))));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
