// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · reglas de los ítems
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-06): «posterior a agregar el ítem, me
// permitas modificar las cantidades» y «agrega un material que se llame
// otro y me permitas ingresarlo de forma manual».
//
// Este módulo es PURO (sin DOM ni Firebase): decide qué cantidad es válida
// y qué le falta a un material escrito a mano. Lo que depende de la pantalla
// —si el texto cabe en el renglón del formato, que se mide con la misma
// métrica del documento— lo hace `ordenes-materiales.js` con estas reglas.
// ══════════════════════════════════════════════════════════════

import { pareceDatoPersonal } from './responsables_ordenes.js';
import { LIMITES } from './ordenes_registro.js';

/**
 * La opción «Otro» del desplegable de materiales. Su VALOR es una marca que
 * ningún material del catálogo usa: así un material que algún día se llame
 * «Otro» en un archivo importado no se confunde con la opción abierta. El
 * documento NUNCA imprime esta etiqueta: imprime lo que se escribió.
 */
export const MATERIAL_OTRO = Object.freeze({ valor: '__OTRO__', texto: 'Otro' });

// Documentos de identidad como se escriben en Colombia: «CC 72.345.678», «C.C. No.
// 72345678», «cédula de ciudadanía 72345678», «CE 1234567», «TI 1098765432»…
// `pareceDatoPersonal` (pensado para listas importadas) no cubre todas esas formas
// y un texto libre que se guarda en el registro del equipo debe cerrarlas. Los
// códigos de los materiales («FN-063», «13,8 KV», «4 AWG CC motor») no las tienen.
const RE_DOC_IDENTIDAD = new RegExp(
  '(^|[^A-Za-zÁÉÍÓÚÑáéíóúñ])(C[ÉE]DULA(\\s+DE\\s+(CIUDADAN[ÍI]A|EXTRANJER[ÍI]A))?|C\\s?\\.?\\s?[CE]\\.?|T\\.?\\s?I\\.?)'
  + '\\s*(N[O°º]?\\.?\\s*)?[:#-]?\\s*\\d[\\d.\\s]{4,}', 'i');

/** ¿El texto parece traer un documento de identidad? */
export function pareceDocumento(texto) {
  const t = String(texto == null ? '' : texto);
  return pareceDatoPersonal(t) || RE_DOC_IDENTIDAD.test(t);
}

// El PDF se escribe con Helvetica estándar, que solo tiene los caracteres de
// Windows-1252: un «Ω», un «≥» o una «μ» griega salen como otro signo en el PDF
// firmado aunque la vista previa y el Excel se vean bien. Se piden con letras.
const EXTRA_1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
/** Primer carácter que el PDF no puede imprimir, o '' si todos se pueden. */
export function caracterNoImprimible(texto) {
  for (const ch of String(texto == null ? '' : texto)) {
    const c = ch.codePointAt(0);
    const ok = (c >= 0x20 && c <= 0x7E) || (c >= 0xA0 && c <= 0xFF) || EXTRA_1252.includes(ch);
    if (!ok) return ch;
  }
  return '';
}
const nombreCaracter = (ch) => (/\s/.test(ch) || ch.codePointAt(0) < 0x20 || (ch.codePointAt(0) >= 0x200B && ch.codePointAt(0) <= 0x200F)
  ? 'un espacio o carácter invisible' : `«${ch}»`);

/** Tope de la cantidad: 9 dígitos enteros caben en la columna del formato. */
export const CANTIDAD_MAX = 999999999;

/**
 * Lee una cantidad tecleada. Acepta coma o punto decimal y hasta 3 decimales,
 * que es lo que imprime el documento (con 4 decimales «0,0004» saldría «0» en el
 * papel y «1,9999» saldría «2»). Sin notación científica ni más de 9 enteros.
 * @returns {number|null} la cantidad, o null si no es válida.
 */
export function leerCantidad(v) {
  if (v == null) return null;
  const t = String(v).trim();
  if (!/^\d{1,9}([.,]\d{1,3})?$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= CANTIDAD_MAX ? n : null;
}

/** Suma dos cantidades sin arrastrar el error de la coma flotante (0,1 + 0,2 = 0,3). */
export function sumarCantidades(a, b) {
  return Number((Number(a) + Number(b)).toFixed(3));
}

/**
 * Qué le falta a un material escrito a mano antes de agregarlo.
 * @param {{descripcion?:string, unidad?:string}} m
 * @returns {{campo:'descripcion'|'unidad', mensaje:string}[]} vacío si está completo.
 */
export function problemasOtro(m) {
  const desc = String((m && m.descripcion) || '').trim();
  const unidad = String((m && m.unidad) || '').trim();
  const P = [];
  if (!desc) {
    P.push({ campo: 'descripcion', mensaje: 'Eligió «Otro»: describa el material, porque ese texto es el que se imprime.' });
  } else if (desc.length > LIMITES.descripcion) {
    P.push({ campo: 'descripcion', mensaje: `La descripción admite hasta ${LIMITES.descripcion} caracteres.` });
  } else if (pareceDocumento(desc)) {
    // Las cédulas no viajan en la orden (99 §78): el registro lo lee todo el equipo.
    P.push({ campo: 'descripcion', mensaje: 'La descripción parece traer una cédula o un dato personal: escriba solo el material.' });
  } else if (caracterNoImprimible(desc)) {
    P.push({ campo: 'descripcion', mensaje: `La descripción trae ${nombreCaracter(caracterNoImprimible(desc))}, que el PDF no puede imprimir: escríbalo con letras (p. ej. «ohm», «micro», «mayor o igual»).` });
  }
  if (!unidad) {
    P.push({ campo: 'unidad', mensaje: 'Escriba la unidad del material (por ejemplo UND, Mts o Kg).' });
  } else if (unidad.length > LIMITES.unidad) {
    P.push({ campo: 'unidad', mensaje: `La unidad admite hasta ${LIMITES.unidad} caracteres.` });
  } else if (pareceDocumento(unidad) || /\d{5,}/.test(unidad.replace(/[.\s]/g, ''))) {
    P.push({ campo: 'unidad', mensaje: 'La unidad parece traer un número de documento: escriba solo la unidad (UND, Mts, Kg…).' });
  } else if (caracterNoImprimible(unidad)) {
    P.push({ campo: 'unidad', mensaje: `La unidad trae ${nombreCaracter(caracterNoImprimible(unidad))}, que el PDF no puede imprimir: escríbala con letras.` });
  }
  return P;
}

/**
 * Unidades que ya usa el catálogo, para sugerirlas al escribir una a mano.
 * Sin repetidas (sin distinguir mayúsculas) y en el orden en que aparecen.
 * @param {{unidad?:string}[]} materiales
 * @returns {string[]}
 */
export function unidadesSugeridas(materiales) {
  const vistas = new Set();
  const out = [];
  (Array.isArray(materiales) ? materiales : []).forEach((m) => {
    const u = String((m && m.unidad) || '').trim();
    const k = u.toLowerCase();
    if (u && !vistas.has(k)) { vistas.add(k); out.push(u); }
  });
  return out;
}
