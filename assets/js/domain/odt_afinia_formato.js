// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · ¿es una ODT del formato? (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Exige TODAS (comité W-11, arq «el texto suelto no alcanza»):
//   · exactamente 2 páginas, Carta 612×792 ±1 pt, MediaBox con origen (0,0),
//     sin rotación;
//   · sin /Encrypt y sin AcroForm (al reescribirlo se romperían);
//   · el título «ORDEN DE TRABAJO (O.D.T.)» en la página 1;
//   · el pie «IT.05800.CO-MA-FO.01» en CADA página;
//   · las etiquetas de las casillas en la última página, a ±3 pt (zonas);
//   · el N.º de 8 dígitos que confirma el admin, presente en la página 1.
// Un control previo con el título pero sin las etiquetas se rechaza.
//
// No usa pdf.js ni pdf-lib directamente: recibe la ESTRUCTURA ya extraída
// (`estructuraConPdfLib` la arma con pdf-lib INYECTADO; los ítems de texto los
// da pdf.js en la página y se convierten con `itemsDePdfjs`).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { TOPES, esNro } from './odt_afinia_rutas.js';
import { compacto, textoDePagina, zonasDesdeEtiquetas, TOLERANCIA_PT } from './odt_afinia_zonas.js';

export const TITULO = 'ORDEN DE TRABAJO (O.D.T.)';
export const PIE = 'IT.05800.CO-MA-FO.01';
/** Carta en puntos y su tolerancia. */
export const CARTA = Object.freeze({ ancho: 612, alto: 792, tolerancia: 1 });

/**
 * Ítems de `page.getTextContent()` de pdf.js → [{str, x, y, w, h}]
 * (x, y = transform[4], transform[5]; w = width; h = height o |transform[3]|).
 */
export function itemsDePdfjs(textContent) {
  const items = (textContent && textContent.items) || [];
  return items.filter((it) => it && typeof it.str === 'string' && Array.isArray(it.transform)).map((it) => ({
    str: it.str,
    x: Number(it.transform[4]),
    y: Number(it.transform[5]),
    w: Number(it.width) || 0,
    h: Number(it.height) || Math.abs(Number(it.transform[3])) || 0
  }));
}

/**
 * Estructura del PDF con pdf-lib INYECTADO (sin texto): páginas con tamaño,
 * caja y rotación; si está cifrado; si trae AcroForm.
 * @param {Uint8Array} bytes
 * @param {{PDFDocument:any, PDFName:any}} PDFLib
 */
export async function estructuraConPdfLib(bytes, PDFLib) {
  if (!PDFLib || !PDFLib.PDFDocument || !PDFLib.PDFName) throw new TypeError('Falta pdf-lib.');
  let doc;
  try {
    doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(String((e && (e.name + ' ' + e.message)) || ''))) return { cifrado: true, acroForm: false, paginas: [] };
    throw e;
  }
  const acro = doc.catalog.get(PDFLib.PDFName.of('AcroForm'));
  const paginas = doc.getPages().map((p) => {
    const mb = p.getMediaBox();
    return { ancho: mb.width, alto: mb.height, caja: [mb.x, mb.y, mb.x + mb.width, mb.y + mb.height], rotacion: ((p.getRotation().angle % 360) + 360) % 360, items: [] };
  });
  return { cifrado: !!doc.isEncrypted, acroForm: !!acro, paginas };
}

/** Une la estructura de pdf-lib con los ítems de texto (uno por página). */
export function conTextos(estructura, itemsPorPagina) {
  return { ...estructura, paginas: (estructura.paginas || []).map((p, i) => ({ ...p, items: (itemsPorPagina && itemsPorPagina[i]) || [] })) };
}

/** Los números de 8 dígitos sueltos (no dentro de uno más largo) del texto. */
export function nrosEnTexto(texto) {
  return [...new Set([...String(texto || '').matchAll(/(?<![0-9])([0-9]{8})(?![0-9])/g)].map((m) => m[1]))];
}

const cerca = (a, b, t) => Math.abs(a - b) <= t;

/**
 * ¿Es una ODT del formato? Devuelve {ok:true, nro, zonas, nrosLeidos} o
 * {ok:false, errores:[{codigo, mensaje}], nrosLeidos}.
 * @param {{paginas:Array<{ancho:number,alto:number,caja?:number[],rotacion?:number,items:Array}>, cifrado?:boolean, acroForm?:boolean}} doc
 * @param {{nro:string, tolerancia?:number}} confirmado  N.º que confirmó el admin
 */
export function validarOdt(doc, { nro, tolerancia = TOLERANCIA_PT } = {}) {
  const errores = [];
  const err = (codigo, mensaje) => errores.push({ codigo, mensaje });
  const paginas = (doc && doc.paginas) || [];

  if (!esNro(nro)) err('nro_formato', 'El N.º de ODT confirmado debe tener 8 dígitos.');
  if (doc && doc.cifrado) err('cifrado', 'El PDF está cifrado o protegido: no se puede firmar.');
  if (doc && doc.acroForm) err('acroform', 'El PDF trae campos de formulario o firmas digitales: no es el formato de la ODT.');
  if (paginas.length !== TOPES.paginas) err('paginas', 'La ODT debe tener exactamente ' + TOPES.paginas + ' páginas (tiene ' + paginas.length + ').');

  paginas.forEach((p, i) => {
    const n = i + 1;
    if (!cerca(p.ancho, CARTA.ancho, CARTA.tolerancia) || !cerca(p.alto, CARTA.alto, CARTA.tolerancia)) {
      err('tamano', 'La página ' + n + ' no es tamaño Carta (612 × 792 pt).');
    }
    if (Array.isArray(p.caja) && (Math.abs(p.caja[0]) > 0.01 || Math.abs(p.caja[1]) > 0.01)) {
      err('caja', 'La página ' + n + ' tiene la caja desplazada (no empieza en 0,0).');
    }
    if ((p.rotacion || 0) % 360 !== 0) err('rotacion', 'La página ' + n + ' está rotada.');
    if (!compacto(textoDePagina(p.items)).includes(compacto(PIE))) err('pie', 'La página ' + n + ' no lleva el pie ' + PIE + '.');
  });

  const texto1 = paginas.length ? textoDePagina(paginas[0].items) : '';
  if (paginas.length && !compacto(texto1).includes(compacto(TITULO))) err('titulo', 'La página 1 no lleva el título «' + TITULO + '».');

  const nrosLeidos = nrosEnTexto(texto1);
  if (esNro(nro) && paginas.length && !nrosLeidos.includes(nro)) {
    err('nro_no_coincide', 'El N.º ' + nro + ' no aparece en la página 1 de este PDF.');
  }

  let zonas = null;
  if (paginas.length) {
    const ult = paginas[paginas.length - 1];
    const z = zonasDesdeEtiquetas(ult.items, { tolerancia, pagina: { ancho: ult.ancho, alto: ult.alto } });
    if (z.ok) zonas = z.zonas;
    else for (const e of z.errores) err('etiquetas', e.mensaje);
  }

  if (errores.length) return { ok: false, errores, nrosLeidos };
  return { ok: true, nro, zonas, nrosLeidos };
}
