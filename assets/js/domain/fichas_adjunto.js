// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «DIAGRAMA OPERATIVO» · reglas puras del adjunto (`99 §112`)
// ──────────────────────────────────────────────────────────────────────────────
// Un adjunto por TRANSFORMADOR (decisión del Ingeniero), guardado en el sistema
// (Firestore; Storage no entrega descargas, `§100`). Lo guardado es SIEMPRE una
// imagen aprobada (PNG o JPEG): del Excel se guarda su dibujo homologado, no el
// archivo (comité `§112`: el papel sale igual en cualquier computador y exportar
// nunca vuelve a abrir un archivo ajeno).
//
// Aquí solo lo que no depende de la red ni de la pantalla: identidad del
// documento, tipo por BYTES, topes, partes con su «lote» y huella.
// Las MISMAS constantes están en firestore.rules y en las pruebas.
// ══════════════════════════════════════════════════════════════════════════════

import { identidadDeEquipo } from './fichas_identidad.js';

/** Bytes por parte (cabe en un documento de 1 MiB con sus campos). */
export const TOPE_PARTE = 900 * 1024;
/** Partes como máximo por adjunto. */
export const PARTES_MAX = 3;
/** Tope de lo guardado (≈ 2,6 MB). 208 × 2,6 MB ≈ 550 MB bajo 1 GiB gratis. */
export const TOPE_TOTAL = PARTES_MAX * TOPE_PARTE;
/** Tope del archivo que se elige (antes de procesarlo). */
export const TOPE_ENTRADA = 15 * 1024 * 1024;
/** Colección de Firestore y su registro (solo se agrega, sin bytes). */
export const COLECCION = 'fichas_adjuntos';
export const COLECCION_REGISTRO = 'fichas_adjuntos_registro';

/**
 * Tipo de un archivo por sus primeros bytes (nunca por la extensión).
 * @returns {'png'|'jpeg'|'gif'|'webp'|'bmp'|'zip'|'ole'|'heic'|null}
 */
export function tipoPorBytes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const es = (...v) => v.every((x, i) => b[i] === x);
  if (b.length < 12) return null;
  if (es(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return 'png';
  if (es(0xFF, 0xD8, 0xFF)) return 'jpeg';
  if (es(0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (es(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (es(0x42, 0x4D)) return 'bmp';
  if (es(0x50, 0x4B, 0x03, 0x04)) return 'zip';
  if (es(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)) return 'ole';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && /^(heic|heix|hevc|mif1|msf1)$/.test(String.fromCharCode(b[8], b[9], b[10], b[11]))) return 'heic';
  return null;
}

/** Qué hacer con un archivo según su tipo real: {ok, clase:'imagen'|'excel', mensaje}. */
export function clasificarArchivo(bytes) {
  const n = bytes ? (bytes.length != null ? bytes.length : bytes.byteLength) : 0;
  if (!n) return { ok: false, mensaje: 'El archivo está vacío.' };
  if (n > TOPE_ENTRADA) return { ok: false, mensaje: 'El archivo pesa ' + (n / 1048576).toFixed(1).replace('.', ',') + ' MB; el máximo es 15 MB.' };
  const t = tipoPorBytes(bytes);
  if (t === 'png' || t === 'jpeg' || t === 'gif' || t === 'webp' || t === 'bmp') return { ok: true, clase: 'imagen', tipo: t };
  if (t === 'zip') return { ok: true, clase: 'excel', tipo: t };
  if (t === 'ole') return { ok: false, mensaje: 'Es un Excel antiguo (.xls), protegido con contraseña o con etiqueta de confidencialidad. Ábralo y guárdelo como «Libro de Excel (.xlsx)» sin protección, o adjunte una imagen.' };
  if (t === 'heic') return { ok: false, mensaje: 'La imagen está en formato HEIC (iPhone). Guárdela como JPG o PNG y adjúntela de nuevo.' };
  return { ok: false, mensaje: 'Solo se admiten archivos de Excel (.xlsx) o imágenes (PNG, JPG).' };
}

/** Huella SHA-256 (hex) de unos bytes o de un texto. */
export async function huellaHex(dato) {
  const bytes = typeof dato === 'string' ? new TextEncoder().encode(dato) : (dato instanceof Uint8Array ? dato : new Uint8Array(dato));
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Identidad del adjunto de un equipo: la PERSISTENTE (matrícula o serie), nunca
 * la clave de memoria (`claveEquipo`: id de Firestore, 'COD#fila'). Sin
 * matrícula ni serie no se puede adjuntar.
 * @returns {Promise<{id:string, clave:string, matricula:string, serie:string}|null>}
 */
export async function identidadAdjunto(equipo) {
  const ident = identidadDeEquipo(equipo);
  if (!ident) return null;
  return { id: 'salud_' + await huellaHex(ident.clave), clave: ident.clave, matricula: ident.matricula || '', serie: ident.serie || '' };
}

/** Parte los bytes en trozos de TOPE_PARTE (1..PARTES_MAX); lanza si no caben. */
export function partir(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!b.length) throw new Error('No hay nada que guardar.');
  if (b.length > TOPE_TOTAL) throw new Error('El dibujo pesa ' + (b.length / 1048576).toFixed(1).replace('.', ',') + ' MB; el máximo es 2,6 MB.');
  const out = [];
  for (let i = 0; i < b.length; i += TOPE_PARTE) out.push(b.subarray(i, Math.min(b.length, i + TOPE_PARTE)));
  return out;
}

/** Une las partes en un solo arreglo. */
export function unir(partes) {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total); let k = 0;
  for (const p of partes) { out.set(p, k); k += p.length; }
  return out;
}

/** Lote aleatorio de 20 caracteres [A-Za-z0-9] que ata la meta con sus partes. */
export function loteNuevo() {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const r = new Uint8Array(20); globalThis.crypto.getRandomValues(r);
  return [...r].map((x) => abc[x % abc.length]).join('');
}

/** Nombre de archivo para mostrar y guardar: sin rutas, sin <>\ ni controles, ≤ 120. */
export function nombreSeguro(nombre) {
  // eslint-disable-next-line no-control-regex
  const s = String(nombre == null ? '' : nombre).split(/[\\/]/).pop().replace(/[\u0000-\u001F\u007F<>\\"]/g, '').trim();
  return (s || 'adjunto').slice(0, 120);
}

/**
 * Tamaño con que una imagen se muestra dentro del marco (px): encajada sin
 * deformar, sin agrandarla más de 1,5 veces.
 */
export function encajar(ancho, alto, caja) {
  const s = Math.min(caja.w / ancho, caja.h / alto, 1.5);
  return { ancho: Math.max(1, Math.round(ancho * s)), alto: Math.max(1, Math.round(alto * s)), escala: s };
}
