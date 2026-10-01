// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · ESCRITURAS del administrador (I/O) · `99 §122`
// ──────────────────────────────────────────────────────────────
// · Homologación: transacciones que leen la versión FRESCA, suben `rev` y crean el
//   registro atado (las reglas exigen que coincidan). Una pestaña vieja no revierte nada.
// · Carga de un mes: se abre el registro ('iniciada') ANTES del primer lote, las series se
//   escriben en lotes pequeños, luego los resúmenes y al final el catálogo (el punto de
//   compromiso: la página no ve un mes a medio cargar) y se cierra el registro una vez.
// Nombre de quien escribe: el de SU perfil (las reglas lo comparan). Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import {
  doc, collection, runTransaction, writeBatch, serverTimestamp, Bytes, setDoc, updateDoc, getDoc, FieldPath
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDbSafe, getAuthSafe } from '../firebase-init.js';
import { getSession } from '../auth/session-guard.js';
import { fusionarHomologacion } from '../domain/scada_carga_homologacion.js';
import { fundirCatalogo, fundirResumen } from '../domain/scada_carga_importacion.js';
import { EXTRAS } from '../domain/scada_carga_extras.js';

function quien() {
  const s = getSession();
  const uid = (s && s.user && s.user.uid) || null;
  if (!uid) return null;
  try { const a = getAuthSafe(); if (a && (!a.currentUser || a.currentUser.uid !== uid)) return null; } catch (_) { /* manda la sesión */ }
  const p = (s && s.profile) || {};
  if (p.rol !== 'admin' || p.activo === false || p.legacy) return null;
  return { uid, nombre: p.nombre || '' };
}

/** ¿Quien tiene la sesión puede cargar datos SCADA? (la regla lo vuelve a exigir) */
export function puedeAdministrar() { return !!(getDbSafe() && quien()); }

/** Nombre del perfil tal como está AHORA (la regla lo compara). */
async function yo() {
  const q = quien();
  if (!q) throw new Error('Solo un administrador con perfil puede cargar datos SCADA.');
  try {
    const snap = await getDoc(doc(getDbSafe(), 'usuarios', q.uid));
    if (snap.exists() && snap.data().nombre != null) q.nombre = snap.data().nombre;
  } catch (_) { /* se usa el de la sesión */ }
  return q;
}

const bytes = (u8) => Bytes.fromUint8Array(u8 instanceof Uint8Array ? u8 : new Uint8Array(u8));

/**
 * Guarda la homologación leída del Excel, fundida con la vigente FRESCA (conserva decisiones).
 * @returns {{ok, rev?, resumen?, motivo?}}
 */
export async function guardarHomologacion(filasExcel, fuente) {
  const db = getDbSafe();
  const por = await yo();
  const ref = doc(db, 'scada_homologacion', 'vigente');
  const regRef = doc(collection(db, 'scada_homologacion_registro'));
  try {
    const r = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const vig = snap.exists() ? snap.data() : null;
      const f = fusionarHomologacion(filasExcel, vig);
      if (f.colisiones.length) throw new Error('Hay matrículas repetidas en la misma subestación: ' + f.colisiones.slice(0, 5).join(', '));
      const rev = vig ? (vig.rev || 0) + 1 : 1;
      const resumen = { nuevas: f.nuevas, cambiadas: f.cambiadas, retiradas: f.retiradas, total: Object.keys(f.filas).length };
      tx.set(ref, { schema: 1, rev, fuente, filas: f.filas, ultimoRegistro: regRef.id, actualizadoPor: por, actualizadoEn: serverTimestamp() });
      tx.set(regRef, { tipo: 'carga_excel', rev, resumen, por, en: serverTimestamp() });
      return { rev, resumen };
    });
    return { ok: true, ...r };
  } catch (e) {
    console.warn('[scada-carga] homologación', e && e.code || e);
    return { ok: false, motivo: (e && e.message) || 'No se pudo guardar la homologación.' };
  }
}

/**
 * Confirma (o reabre, con decision = null) UNA fila. La decisión lleva quién y cuándo.
 * @param {string} filaId
 * @param {null|{tipo: 'usar'|'conjunta'|'no_usar', clave?: string, mapa?: object, nota: string, avisos_vistos: string[], clave_excel_vista: string|null}} decision
 */
export async function decidirFila(filaId, decision) {
  const db = getDbSafe();
  const por = await yo();
  const ref = doc(db, 'scada_homologacion', 'vigente');
  const regRef = doc(collection(db, 'scada_homologacion_registro'));
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('No hay homologación cargada.');
      const vig = snap.data();
      const antes = (vig.filas && vig.filas[filaId] && vig.filas[filaId].decision) || null;
      if (!vig.filas || !vig.filas[filaId]) throw new Error('La fila ya no existe en la homologación.');
      const rev = (vig.rev || 0) + 1;
      const despues = decision ? { ...decision, por, en: serverTimestamp() } : null;
      tx.update(ref, new FieldPath('filas', filaId, 'decision'), despues, 'rev', rev, 'ultimoRegistro', regRef.id,
        'actualizadoPor', por, 'actualizadoEn', serverTimestamp());
      tx.set(regRef, { tipo: decision ? 'confirmacion' : 'reapertura', rev, filaId, antes, despues, por, en: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) {
    console.warn('[scada-carga] decisión', e && e.code || e);
    return { ok: false, motivo: e && e.code === 'permission-denied'
      ? 'No se pudo guardar: lo que hay en pantalla ya no es lo vigente. Recargue y vuelva a intentarlo.'
      : ((e && e.message) || 'No se pudo guardar la decisión.') };
  }
}

/** Abre el registro de una carga ANTES de escribir datos. Devuelve el id. */
export async function abrirCarga({ modo, meses, carpeta, plan, simulacion }) {
  const db = getDbSafe();
  const por = await yo();
  const ref = doc(collection(db, 'scada_cargas'));
  await setDoc(ref, { estado: 'iniciada', modo, meses, carpeta: String(carpeta || '').slice(0, 120), plan, simulacion, abiertaEn: serverTimestamp(), por });
  return ref.id;
}

/** Cierra el registro de la carga (una sola vez). */
export async function cerrarCarga(id, { estado, escrituras, duracion_ms, error, detalle }) {
  const db = getDbSafe();
  const datos = { estado, escrituras: escrituras || {}, duracion_ms: duracion_ms || 0, cerradoEn: serverTimestamp() };
  if (error) datos.error = String(error).slice(0, 500);
  if (detalle) datos.detalle = detalle;
  await updateDoc(doc(db, 'scada_cargas', id), datos);
}

/** Convierte un doc de serie del dominio (bytes Uint8Array) al formato de Firestore. */
function docSerieFirestore(d, cargaId, por) {
  const niveles = {};
  for (const [nv, x] of Object.entries(d.niveles)) {
    niveles[nv] = { kv: x.kv, fam: {} };
    for (const [f, s] of Object.entries(x.fam)) {
      niveles[nv].fam[f] = { v: bytes(s.v), m: bytes(s.m), b: bytes(s.b) };
      for (const k of EXTRAS) if (s[k]) niveles[nv].fam[f][k] = bytes(s[k]);   // máx/mín/instantáneo (`99 §126`)
    }
  }
  return { schema: 1, claveId: d.claveId, clave: d.clave, est: d.est, elem: d.elem, mes: d.mes, n: d.n, formato: d.formato, niveles,
    cargaId, actualizadoPor: por, actualizadoEn: serverTimestamp() };
}

/**
 * Escribe las series en lotes (writeBatch). Si un lote falla, lanza con cuántos se escribieron.
 * @param {Array<Array<object>>} lotes  docs del dominio agrupados
 */
export async function escribirSeries(lotes, cargaId, { alAvanzar } = {}) {
  const db = getDbSafe();
  const por = await yo();
  let escritos = 0;
  for (let i = 0; i < lotes.length; i++) {
    const b = writeBatch(db);
    for (const d of lotes[i]) b.set(doc(db, 'scada_series', d.claveId + '__' + d.mes), docSerieFirestore(d, cargaId, por));
    try { await b.commit(); }
    catch (e) { const err = new Error('Falló el lote ' + (i + 1) + ' de ' + lotes.length + ' (' + ((e && e.code) || 'error') + ').'); err.escritos = escritos; err.lote = i; throw err; }
    escritos += lotes[i].length;
    if (alAvanzar) alAvanzar(i + 1, lotes.length, escritos);
  }
  return escritos;
}

/**
 * Escribe el resumen de un mes FUNDIDO, en una transacción, con lo guardado en ese instante: si
 * otra carga escribió entre la simulación y ahora, sus puntos se conservan (revisión adversarial).
 */
export async function escribirResumen(mes, clavesNuevas, cargaId) {
  const db = getDbSafe();
  const por = await yo();
  const ref = doc(db, 'scada_resumen', mes);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const claves = fundirResumen(snap.exists() ? snap.data().claves : null, clavesNuevas);
    tx.set(ref, { schema: 1, mes, claves, cargaId, actualizadoPor: por, actualizadoEn: serverTimestamp() });
  });
}

/** Lee el catálogo fresco (sin caché): su `cargaId` dice si otra carga terminó mientras se simulaba. */
export async function cargaIdDelCatalogo() {
  const snap = await getDoc(doc(getDbSafe(), 'scada_catalogo', 'estado'));
  return snap.exists() ? (snap.data().cargaId || null) : null;
}

/**
 * Escribe el catálogo FUNDIDO en una transacción (punto de compromiso: con esto la página ve el
 * mes). Nada se quita: meses y puntos de otras cargas se conservan.
 */
export async function escribirCatalogo(nuevo, cargaId) {
  const db = getDbSafe();
  const por = await yo();
  const ref = doc(db, 'scada_catalogo', 'estado');
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const { meses, puntos } = fundirCatalogo(snap.exists() ? snap.data() : null, nuevo);
    tx.set(ref, { schema: 1, meses, puntos, cargaId, actualizadoPor: por, actualizadoEn: serverTimestamp() });
  });
}
