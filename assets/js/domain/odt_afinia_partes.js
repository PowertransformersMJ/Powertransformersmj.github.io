// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · partir / unir el PDF y su presupuesto (PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Solo se guarda el PDF ORIGINAL (v0), en partes de ≤ 900 KB dentro de
// odt_afinia/{id}/partes/{i} (molde fichas_adjuntos / placas_caracteristicas:
// cada parte con su SHA-256, que la regla recalcula con hashing.sha256).
// Presupuesto: el v0 MÁS las dos imágenes de firma (AZT y Responsable, ≤ 900 KB
// cada una) tiene que caber en 5 partes; si no, se rechaza AL PUBLICAR, para que
// ninguna ODT quede atascada después (comité W-11, arq).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { TOPES } from './odt_afinia_rutas.js';
import { huellaHex } from './fichas_adjunto.js';

export const TOPE_PARTE = TOPES.parte;
export const PARTES_MAX = TOPES.partesMax;
/** Lo máximo que se reserva para el v0 más las imágenes (5 × 900 KB). */
export const TOPE_PRESUPUESTO = PARTES_MAX * TOPE_PARTE;

const comoBytes = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b));
const mb = (n) => (n / 1048576).toFixed(2).replace('.', ',') + ' MB';

/** ¿Empieza como PDF? ('%PDF-', lo mismo que exige la regla a la parte 0). */
export function esPdf(bytes) {
  const b = comoBytes(bytes || []);
  return b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;
}

/** Cuántas partes ocupan `n` bytes. */
export const partesPara = (n) => Math.ceil(n / TOPE_PARTE);

/**
 * Parte los bytes en trozos de ≤ TOPE_PARTE (1..PARTES_MAX). Cada parte es una
 * COPIA (no comparte memoria con el original: pdf.js puede vaciar un búfer).
 */
export function partir(bytes) {
  const b = comoBytes(bytes);
  if (!b.length) throw new Error('No hay nada que guardar.');
  if (partesPara(b.length) > PARTES_MAX) throw new Error('El PDF pesa ' + mb(b.length) + '; el máximo es ' + PARTES_MAX + ' partes de 900 KB.');
  const out = [];
  for (let i = 0; i < b.length; i += TOPE_PARTE) out.push(b.slice(i, Math.min(b.length, i + TOPE_PARTE)));
  return out;
}

/** Une las partes en un solo arreglo nuevo. */
export function unir(partes) {
  const ps = (partes || []).map(comoBytes);
  const n = ps.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n); let k = 0;
  for (const p of ps) { out.set(p, k); k += p.length; }
  return out;
}

/** SHA-256 (hex) de unos bytes. */
export const huella = (bytes) => huellaHex(comoBytes(bytes));

/** SHA-256 de cada parte, en orden. */
export async function huellasDePartes(partes) {
  const out = [];
  for (const p of partes) out.push(await huella(p));
  return out;
}

/**
 * Lo que se guarda al publicar: {partes, huellasPartes, huella, bytes}.
 * `huella` es la del v0 ENTERO (la que firma todo el flujo).
 */
export async function prepararPartes(bytes) {
  const b = comoBytes(bytes);
  if (!esPdf(b)) throw new Error('El archivo no es un PDF.');
  const partes = partir(b);
  return { partes, huellasPartes: await huellasDePartes(partes), huella: await huella(b), bytes: b.length };
}

/**
 * Une las partes leídas y comprueba cada huella y la del total.
 * Lanza si algo no cuadra (el PDF no se muestra ni se firma).
 * @returns {Promise<Uint8Array>}
 */
export async function unirVerificado(partes, { huellasPartes, huella: huellaTotal, bytes } = {}) {
  if (!Array.isArray(partes) || !partes.length) throw new Error('La ODT no tiene partes.');
  if (!Array.isArray(huellasPartes) || huellasPartes.length !== partes.length) throw new Error('Faltan partes de la ODT.');
  for (let i = 0; i < partes.length; i++) {
    if (await huella(partes[i]) !== huellasPartes[i]) throw new Error('La parte ' + i + ' de la ODT no coincide con su huella.');
  }
  const todo = unir(partes);
  if (bytes != null && todo.length !== bytes) throw new Error('El tamaño de la ODT no coincide.');
  if (huellaTotal != null && await huella(todo) !== huellaTotal) throw new Error('La ODT no coincide con su huella.');
  if (!esPdf(todo)) throw new Error('Lo guardado no es un PDF.');
  return todo;
}

/**
 * Presupuesto al publicar: v0 + imágenes ≤ PARTES_MAX × 900 KB.
 * @param {number} bytesV0  tamaño del PDF original
 * @param {{imagenes?:number, imagenMax?:number}} [op]
 * @returns {{ok:boolean, partes:number, total:number, tope:number, mensaje?:string}}
 */
export function presupuesto(bytesV0, { imagenes = TOPES.imagenesPorOdt, imagenMax = TOPES.imagenFirma } = {}) {
  const v0 = Number(bytesV0);
  if (!Number.isFinite(v0) || v0 <= 0) return { ok: false, partes: 0, total: 0, tope: TOPE_PRESUPUESTO, mensaje: 'El PDF está vacío.' };
  const total = v0 + imagenes * imagenMax;
  const partes = partesPara(v0);
  if (total > TOPE_PRESUPUESTO) {
    return { ok: false, partes, total, tope: TOPE_PRESUPUESTO,
      mensaje: 'El PDF pesa ' + mb(v0) + ': con las dos firmas pasaría de ' + mb(TOPE_PRESUPUESTO) + '. Redúzcalo (máximo ' + mb(TOPE_PRESUPUESTO - imagenes * imagenMax) + ').' };
  }
  return { ok: true, partes, total, tope: TOPE_PRESUPUESTO };
}
