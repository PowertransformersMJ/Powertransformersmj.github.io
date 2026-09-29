// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «DIAGRAMA OPERATIVO» · lector del Excel adjunto (`99 §112`)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-28): adjuntar un Excel o una imagen en la ficha de
// Mantenimiento y que salga en una hoja «Diagrama Operativo» del Excel exportado;
// de un Excel, «lo que está al interior del documento homologado a la hoja, que
// se aprecie muy bien y de buena calidad». Lo que reposa ahí es un CRONOGRAMA de
// trabajos (Gantt: una columna por día, barras con relleno), p. ej. la hoja
// «Cronograma trabajos» de una ficha PE.02081.
//
// Este módulo LEE la hoja elegida y devuelve un modelo plano (celdas con su
// estilo, combinadas, anchos, altos, imágenes pegadas) que dibuja
// `diagrama-operativo-dibujo.js`. No toca la página ni ejecuta nada del archivo:
// macros, fórmulas y vínculos no se evalúan (se usa el valor guardado).
//
// Blindaje (revisión del comité, `§112`): el archivo es ajeno. Topes ANTES de
// leer (descomprimido total ≤ 50 MB, hoja ≤ 20 MB, ≤ 30 hojas); solo se lee la
// hoja elegida; el área se recorta a 200 columnas × 1000 filas y 20.000 celdas.
// Lo que no se puede reproducir (EMF/WMF/TIFF, gráficos, objetos incrustados,
// imágenes enlazadas) va a un INVENTARIO que la pantalla muestra: nunca se omite
// en silencio.
//
// CF-40 (verificación del cerebro, L-106): cada parte se descomprime contando los
// bytes REALES (`leerParteAcotada`) y pasa por `revisarXml` —una pasada lineal que
// exige cierres en orden y ningún elemento dentro de otro del mismo nombre—
// ANTES de cualquier regex; las regex buscan el nombre exacto (`(?=[\s>/])`, no
// `\b`, que confundía `<c` con `<c:x`). Topes de texto e imágenes para que el
// dibujo tampoco se dispare. Y todo esto corre en un trabajador con tiempo límite
// (`diagrama-operativo-seguro.js`): la página nunca se traba.
// ══════════════════════════════════════════════════════════════════════════════

import { cargarJSZip, colIndice, formatearValor } from './vista-previa-excel.js';
import { revisarXml, leerParteAcotada, textoParte, aBase64, dimensionesImagen } from './diagrama-operativo-xml.js';

export const TOPES = Object.freeze({
  total: 50 * 1024 * 1024, hoja: 20 * 1024 * 1024, hojas: 30, columnas: 200, filas: 1000, celdas: 20000,
  // CF-40: el presupuesto de 50 MB se cuenta en bytes REALES; cada parte cabe en lo que quede (la hoja, en 20 MB).
  // Texto por celda (32.767: lo máximo de Excel) y total —celdas y cuadros de texto—; imágenes; dibujos y objetos.
  // (Topes medidos contra el costo real de pintar: 1 M de caracteres ≈ 0,1 s; 100 Mpx de imagen ≈ 0,1 s.)
  textoCelda: 32767, textoTotal: 1000000, imagenPx: 120e6, imagenesPx: 250e6, imagenesSvg: 120 * 1024 * 1024,
  dibujos: 4, objetos: 5000
});
/** Límites de Excel: más allá no hay columnas ni filas (un ancla que diga otra cosa es falsa). */
const MAX_COL = 16384; const MAX_FILA = 1048576;
const EMU_PX = 9525;
const PX_PT = 96 / 72;

/* ── utilidades XML (propias: L-102, no se importan internas de otro módulo) ── */
const attr = (tag, n) => { const m = String(tag || '').match(new RegExp('\\s' + n.replace(':', '\\:') + '="([^"]*)"')); return m ? m[1] : null; };
const num = (tag, n) => { const v = attr(tag, n); return v == null || v === '' ? null : +v; };
const desXml = (s) => String(s == null ? '' : s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const textoDe = (xml) => desXml([...String(xml || '').matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:\w+:)?t>/g)].map((m) => m[1]).join(''));
/** Contenido del primer elemento `n` (no vacío). Lineal: busca su cierre exacto con indexOf. */
const bloque = (xml, n) => {
  const s = String(xml || ''); const re = new RegExp('<(' + n + ')(?=[\\s>/])[^>]*>', 'g'); let m;
  while ((m = re.exec(s))) {
    if (m[0].charCodeAt(m[0].length - 2) === 47) continue;   // <n/>: vacío
    const f = s.indexOf('</' + m[1] + '>', re.lastIndex);
    return f < 0 ? '' : s.slice(re.lastIndex, f);
  }
  return '';
};
const refPartes = (ref) => { const m = String(ref || '').replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i); return m ? { c: colIndice(m[1]), r: +m[2] - 1 } : null; };
const rango = (ref) => { const [a, b] = String(ref || '').split(':'); const p = refPartes(a); const q = refPartes(b || a); return p && q ? { c0: Math.min(p.c, q.c), r0: Math.min(p.r, q.r), c1: Math.max(p.c, q.c), r1: Math.max(p.r, q.r) } : null; };
function resolverRuta(base, target) {
  if (/^\//.test(target)) return target.slice(1);
  const partes = base.split('/'); partes.pop();
  for (const p of String(target).split('/')) { if (p === '..') partes.pop(); else if (p !== '.') partes.push(p); }
  return partes.join('/');
}
function relaciones(xml) {
  const m = new Map();
  for (const r of String(xml || '').matchAll(/<Relationship\b[^>]*\/?>/g)) m.set(attr(r[0], 'Id'), { target: attr(r[0], 'Target') || '', tipo: attr(r[0], 'Type') || '', externo: attr(r[0], 'TargetMode') === 'External' });
  return m;
}
const rutaRels = (p) => p.replace(/([^/]+)$/, '_rels/$1.rels');

/* ── colores ─────────────────────────────────────────────────────────────────── */
// Paleta indexada de Excel (64 entradas).
const INDEXADOS = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333'];

export function paletaTema(temaXml) {
  const orden = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  return orden.map((n) => {
    const m = String(temaXml || '').match(new RegExp('<a:' + n + '>([\\s\\S]*?)</a:' + n + '>'));
    const srgb = m ? (m[1].match(/<a:srgbClr[^>]*>/) || [''])[0] : ''; const sys = m ? (m[1].match(/<a:sysClr[^>]*>/) || [''])[0] : '';
    return (attr(srgb, 'val') || attr(sys, 'lastClr') || (n === 'lt1' ? 'FFFFFF' : '000000')).toUpperCase();
  });
}
/** Tinte de Excel sobre la luminosidad HSL (tint > 0 aclara, < 0 oscurece). */
export function conTinte(hex, tinte) {
  if (!tinte) return hex;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); let h = 0; let s = 0; let l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
  }
  const t = Math.max(-1, Math.min(1, tinte));
  l = t < 0 ? l * (1 + t) : l * (1 - t) + t;
  const f = (p, q, x) => { if (x < 0) x += 1; if (x > 1) x -= 1; if (x < 1 / 6) return p + (q - p) * 6 * x; if (x < 1 / 2) return q; if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6; return p; };
  if (s === 0) { r = g = b = l; } else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
  return [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function colorDe(tag, tema, indexados) {
  if (!tag) return null;
  const rgb = attr(tag, 'rgb'); let hex = null;
  if (rgb) hex = rgb.length === 8 ? rgb.slice(2) : rgb;
  else if (attr(tag, 'theme') != null) hex = tema[+attr(tag, 'theme')] || null;
  else if (attr(tag, 'indexed') != null) { const i = +attr(tag, 'indexed'); hex = i === 64 ? '000000' : i === 65 ? 'FFFFFF' : (indexados[i] || null); }
  else if (attr(tag, 'auto') === '1') hex = '000000';
  if (!hex || !/^[0-9A-F]{6}$/i.test(hex)) return null;
  return '#' + conTinte(hex.toUpperCase(), num(tag, 'tint') || 0);
}

/* ── estilos ─────────────────────────────────────────────────────────────────── */
function leerEstilos(xml, tema) {
  const s = String(xml || '');
  const idx = [...bloque(s, 'indexedColors').matchAll(/<rgbColor\b[^>]*>/g)].map((m) => (attr(m[0], 'rgb') || '').slice(-6));
  const indexados = idx.length ? idx : INDEXADOS;
  const formatos = {};
  // Excel no admite códigos de formato de más de 255 caracteres: uno más largo es un archivo alterado y se
  // lee como «General» (cada celda recorre su código: 100.000 caracteres × miles de celdas trababan el lector).
  for (const m of s.matchAll(/<numFmt\b[^>]*\/>/g)) { const cod = desXml(attr(m[0], 'formatCode')); formatos[num(m[0], 'numFmtId')] = cod.length <= 255 ? cod : ''; }
  const fuentes = [...bloque(s, 'fonts').matchAll(/<font(?=[\s>/])[^>]*?(?:\/>|>([\s\S]*?)<\/font>)/g)].map((m) => {
    const f = m[1] || '';
    return {
      b: /<b(?:\s[^>]*)?\/>/.test(f) && !/<b val="(0|false)"/.test(f), i: /<i(?:\s[^>]*)?\/>/.test(f) && !/<i val="(0|false)"/.test(f),
      u: /<u(?:\s[^>]*)?\/>/.test(f) && !/<u val="none"/.test(f), sz: num((f.match(/<sz\b[^>]*>/) || [''])[0], 'val') || 11,
      color: colorDe((f.match(/<color\b[^>]*>/) || [''])[0], tema, indexados), nombre: attr((f.match(/<name\b[^>]*>/) || [''])[0], 'val') || 'Calibri'
    };
  });
  const rellenos = [...bloque(s, 'fills').matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => {
    if (/<gradientFill/.test(m[1])) return colorDe((m[1].match(/<color\b[^>]*>/) || [''])[0], tema, indexados);
    const p = (m[1].match(/<patternFill\b[^>]*>/) || [''])[0];
    const tipo = attr(p, 'patternType');
    if (!p || !tipo || tipo === 'none') return null;
    return colorDe((m[1].match(/<fgColor\b[^>]*>/) || [''])[0], tema, indexados) || (tipo === 'solid' ? '#000000' : '#D9D9D9');
  });
  const GRUESO = { hair: 0.5, thin: 1, dotted: 1, dashed: 1, dashDot: 1, dashDotDot: 1, medium: 2, mediumDashed: 2, mediumDashDot: 2, mediumDashDotDot: 2, slantDashDot: 2, thick: 3, double: 3 };
  const bordes = [...bloque(s, 'borders').matchAll(/<border(?=[\s>/])[^>]*?(?:\/>|>([\s\S]*?)<\/border>)/g)].map((m) => {
    const b = m[1] || '';
    const lado = (n) => {
      const t = b.match(new RegExp('<' + n + '(?=[\\s>/])[^>]*?(?:/>|>([\\s\\S]*?)</' + n + '>)')) || [];
      const est = attr(t[0] || '', 'style');
      if (!est || est === 'none') return null;
      return { grueso: GRUESO[est] || 1, estilo: est, color: colorDe(((t[1] || '').match(/<color\b[^>]*>/) || [''])[0], tema, indexados) || '#000000' };
    };
    return { t: lado('top'), r: lado('right'), b: lado('bottom'), l: lado('left') };
  });
  const xfs = [...bloque(s, 'cellXfs').matchAll(/<xf(?=[\s>/])([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)].map((m) => {
    const a = ((m[2] || '').match(/<alignment\b[^>]*>/) || [''])[0]; const x = '<x' + m[1] + '>';
    return {
      fuente: num(x, 'fontId') || 0, relleno: num(x, 'fillId') || 0, borde: num(x, 'borderId') || 0, formato: num(x, 'numFmtId') || 0,
      h: attr(a, 'horizontal'), v: attr(a, 'vertical'), envolver: attr(a, 'wrapText') === '1' || attr(a, 'wrapText') === 'true',
      rot: num(a, 'textRotation') || 0, sangria: num(a, 'indent') || 0
    };
  });
  return { formatos, fuentes, rellenos, bordes, xfs };
}
const FORMATO_FECHA = (id, cod) => [14, 15, 16, 17, 22, 45, 46, 47].includes(id)
  || (/(^|[^"\\])(d{1,4}|y{2,4}|m{3,5})/i.test(String(cod || '').replace(/"[^"]*"/g, '')) && !/#|0\.0/.test(String(cod || '')));
const FORMATOS_INTERNOS = { 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 14: 'dd/mm/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 22: 'dd/mm/yyyy h:mm' };

/* ── lectura ─────────────────────────────────────────────────────────────────── */

/**
 * Estructura sana ANTES de recorrer con expresiones regulares (revisión §112):
 * un XML con miles de «<row>» sin cerrar hacía que cada búsqueda recorriera
 * el resto del texto (tiempo cuadrático) y congelaba la pestaña. Se cuentan las
 * aperturas y los cierres; si no cuadran o son demasiados, se rechaza.
 */
export function estructuraSana(xml, etiqueta, maximo) {
  const s = String(xml || '');
  const abre = (s.match(new RegExp('<' + etiqueta + '(?=[\\s>/])', 'g')) || []).length;
  const solas = (s.match(new RegExp('<' + etiqueta + '(?:\\s[^<>]*)?/>', 'g')) || []).length;
  const cierra = (s.match(new RegExp('</' + etiqueta + '>', 'g')) || []).length;
  if (abre > maximo) return 'demasiadas';
  if (abre !== solas + cierra) return 'dañada';
  return '';
}
function exigirEstructura(xml, etiqueta, maximo, que) {
  const r = estructuraSana(xml, etiqueta, maximo);
  if (r === 'demasiadas') throw new Error('El Excel trae demasiados elementos («' + que + '») para leerlo aquí. Defina un área de impresión o copie la hoja a un libro nuevo.');
  if (r) throw new Error('El Excel parece dañado por dentro («' + que + '» sin cerrar). Ábralo y vuelva a guardarlo en Excel.');
}

/** Tamaño descomprimido DECLARADO de una parte del zip (JSZip 3): primer filtro, falseable. */
const tamano = (f) => (f && f._data && Number.isFinite(f._data.uncompressedSize) ? f._data.uncompressedSize : 0);

/**
 * Lector de partes con presupuesto (CF-40): cuenta los bytes REALES descomprimidos
 * (total ≤ TOPES.total y cada parte ≤ su tope) y revisa la estructura de cada XML
 * ANTES de que lo toque una regex.
 */
function lectorAcotado(zip) {
  let gastado = 0;
  const grande = (que) => { const e = new Error('El Excel es demasiado grande por dentro (' + que + '). Guarde solo la hoja que necesita en un libro nuevo, o adjunte una imagen.'); e.excede = true; return e; };
  async function bytes(ruta, tope, que) {
    const f = zip.file(ruta); if (!f) return null;
    const cabe = Math.min(tope || TOPES.total, TOPES.total - gastado);
    if (tamano(f) > cabe) throw grande(que);
    let u;
    try { u = await leerParteAcotada(f, cabe); } catch (e) {
      if (e && e.excede) throw grande(que);
      throw new Error('El Excel está dañado o es demasiado grande por dentro.');
    }
    gastado += u.length; return u;
  }
  async function xml(ruta, tope, que) {
    const u = await bytes(ruta, tope, que); if (!u) return '';
    const r = revisarXml(textoParte(u));
    if (r.error === 'demasiadas') throw new Error('El Excel trae demasiados elementos («' + que + '») para leerlo aquí. Defina un área de impresión o copie la hoja a un libro nuevo.');
    if (r.error) throw new Error('El Excel parece dañado por dentro («' + que + '»). Ábralo y vuelva a guardarlo en Excel.');
    return r.xml;
  }
  return { bytes, xml };
}

async function abrir(bytes) {
  const JSZip = await cargarJSZip();
  let zip;
  try { zip = await JSZip.loadAsync(bytes); } catch (e) { throw new Error('El archivo no se pudo abrir como Excel (.xlsx).'); }
  const partes = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const total = partes.reduce((s, n) => s + tamano(zip.files[n]), 0);
  if (total > TOPES.total) throw new Error('El Excel es demasiado grande por dentro (' + Math.round(total / 1048576) + ' MB descomprimido; máximo 50 MB).');
  const lee = lectorAcotado(zip);
  const ct = await lee.xml('[Content_Types].xml', 0, 'tipos');
  if (!/spreadsheetml\.sheet\.main|sheet\.macroEnabled\.main|spreadsheetml\.template\.main/.test(ct)) throw new Error('El archivo no es un libro de Excel (.xlsx).');
  const raiz = relaciones(await lee.xml('_rels/.rels', 0, 'relaciones'));
  const relDoc = [...raiz.values()].find((r) => /\/officeDocument$/.test(r.tipo));
  const libro = relDoc ? resolverRuta('', relDoc.target) : 'xl/workbook.xml';
  const wb = await lee.xml(libro, 0, 'libro');
  const rels = relaciones(await lee.xml(rutaRels(libro), 0, 'relaciones'));
  const activa = num((wb.match(/<workbookView\b[^>]*>/) || [''])[0], 'activeTab') || 0;
  const hojas = [...wb.matchAll(/<sheet\b[^>]*\/?>/g)].map((m, i) => {
    const r = rels.get(attr(m[0], 'r:id'));
    return {
      i, nombre: desXml(attr(m[0], 'name') || ''), visible: !attr(m[0], 'state') || attr(m[0], 'state') === 'visible',
      ruta: r ? resolverRuta(libro, r.target) : null, activa: i === activa
    };
  }).filter((h) => h.ruta && zip.file(h.ruta));
  if (!hojas.length) throw new Error('El Excel no tiene hojas que se puedan leer.');
  if (hojas.length > TOPES.hojas) throw new Error('El Excel trae ' + hojas.length + ' hojas (máximo ' + TOPES.hojas + ').');
  return { zip, libro, wb, rels, hojas, lee };
}

/** Hojas del libro (para el selector): [{nombre, visible, activa}]. */
export async function hojasDelLibro(bytes) {
  const { hojas } = await abrir(bytes);
  return hojas.map((h) => ({ nombre: h.nombre, visible: h.visible, activa: h.activa }));
}

/**
 * Lee UNA hoja del Excel adjunto.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {{hoja?: string}} [op]  nombre de la hoja; si no, la activa (si es visible) o la primera visible
 * @returns {Promise<object>} {hojas, hoja, area, columnas, filas, celdas, combinadas, imagenes, formas, inventario}
 */
export async function leerHojaAdjunta(bytes, op = {}) {
  const { zip, libro, wb, rels, hojas, lee } = await abrir(bytes);
  const visibles = hojas.filter((h) => h.visible);
  const h = (op.hoja && hojas.find((x) => x.nombre === op.hoja)) || visibles.find((x) => x.activa) || visibles[0] || hojas[0];
  const fh = zip.file(h.ruta);
  if (tamano(fh) > TOPES.hoja) throw new Error('La hoja «' + h.nombre + '» es demasiado grande (máximo 20 MB por dentro).');
  const inventario = [];
  const rutaDe = (tipo) => { const r = [...rels.values()].find((x) => new RegExp('/' + tipo + '$').test(x.tipo)); return r ? resolverRuta(libro, r.target) : null; };
  const tema = paletaTema(await lee.xml(rutaDe('theme') || 'xl/theme/theme1.xml', 0, 'tema'));
  const estilos = leerEstilos(await lee.xml(rutaDe('styles') || 'xl/styles.xml', 0, 'estilos'), tema);
  const ssXml = String(await lee.xml(rutaDe('sharedStrings') || 'xl/sharedStrings.xml', 0, 'textos'));
  exigirEstructura(ssXml, 'si', 300000, 'textos');
  exigirEstructura(ssXml.replace(/<(\w+:)?t\b/g, '<t').replace(/<\/(\w+:)?t>/g, '</t>'), 't', 600000, 'textos');
  const compartidos = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)]
    .map((m) => textoDe((m[1] || '').replace(/<rPh(?=[\s>/])[^>]*?\/>|<rPh(?=[\s>/])[\s\S]*?<\/rPh>/g, '')));
  const x = await lee.xml(h.ruta, TOPES.hoja, 'hoja «' + h.nombre + '»');
  exigirEstructura(x, 'row', 50000, 'filas');
  exigirEstructura(x, 'c', 400000, 'celdas');
  if ((x.match(/<mergeCell\b/g) || []).length > 5000) throw new Error('La hoja tiene demasiadas celdas combinadas para leerla aquí. Defina un área de impresión.');
  // Libros con el sistema de fechas de 1904 (plantillas viejas de Mac): +1462 días.
  const desfase1904 = /<workbookPr\b[^>]*\sdate1904="(1|true)"/.test(String(wb)) ? 1462 : 0;

  // Geometría: anchos y altos en píxeles (Arial/Calibri 10-11: 7 px por dígito).
  const fmt = (x.match(/<sheetFormatPr\b[^>]*>/) || [''])[0];
  const anchoDef = num(fmt, 'defaultColWidth') || ((num(fmt, 'baseColWidth') || 8) + 0.43);
  const altoDef = num(fmt, 'defaultRowHeight') || 15;
  const cols = [...x.matchAll(/<col(?=[\s>/])[^>]*\/>/g)].map((m) => ({ min: num(m[0], 'min') - 1, max: num(m[0], 'max') - 1, w: num(m[0], 'width'), oculta: attr(m[0], 'hidden') === '1' }));
  if (cols.length > MAX_COL) throw new Error('El Excel parece dañado por dentro («columnas»). Ábralo y vuelva a guardarlo en Excel.');
  const pxCol = (w) => Math.trunc(((256 * w + Math.trunc(128 / 7)) / 256) * 7);
  // Qué definición manda en cada columna (la PRIMERA que la contiene, como antes con find), en un arreglo.
  const defCol = new Int32Array(MAX_COL).fill(-1);
  cols.forEach((q, i) => {
    if (!(q.min <= q.max)) return;
    for (let c = Math.max(0, q.min); c <= Math.min(MAX_COL - 1, q.max); c++) if (defCol[c] === -1) defCol[c] = i;
  });
  const colPx = (c) => { const k = c >= 0 && c < MAX_COL && defCol[c] >= 0 ? cols[defCol[c]] : undefined; if (k && k.oculta) return 0; return pxCol(k && k.w != null ? k.w : anchoDef); };
  const filasXml = new Map();
  for (const m of x.matchAll(/<row(?=[\s>/])([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) filasXml.set(num('<r' + m[1] + '>', 'r') - 1, { at: '<r' + m[1] + '>', cuerpo: m[2] || '' });
  const filaPx = (r) => { const f = filasXml.get(r); if (f && attr(f.at, 'hidden') === '1') return 0; const ht = f ? num(f.at, 'ht') : null; return Math.round((ht != null ? ht : altoDef) * PX_PT); };

  // Celdas con contenido o con relleno/borde.
  const todas = []; let largos = false;
  for (const [, f] of filasXml) {
    for (const c of f.cuerpo.matchAll(/<c(?=[\s>/])([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = '<c' + c[1] + '>'; const p = refPartes(attr(at, 'r')); if (!p) continue;
      const dentro = c[2] || ''; const t = attr(at, 't'); const si = num(at, 's') || 0;
      const xf = estilos.xfs[si] || estilos.xfs[0] || {};
      const v = (dentro.match(/<v>([\s\S]*?)<\/v>/) || [null, null])[1];
      const cod = estilos.formatos[xf.formato] || FORMATOS_INTERNOS[xf.formato] || '';
      let valor = null; let texto = '';
      if (t === 's') { texto = compartidos[+v] || ''; valor = texto; }
      else if (t === 'inlineStr') { texto = textoDe(bloque(dentro, 'is')); valor = texto; }
      else if (t === 'str' || t === 'e') { texto = desXml(v || ''); valor = texto; }
      else if (t === 'b') { texto = v === '1' ? 'VERDADERO' : 'FALSO'; valor = texto; }
      else if (v != null && v !== '') {
        valor = +v;
        const esF = FORMATO_FECHA(xf.formato, cod);
        texto = String(formatearValor(esF ? valor + desfase1904 : valor, cod, xf.formato));
        if (esF) valor += desfase1904;
      }
      if (texto.length > TOPES.textoCelda) { texto = texto.slice(0, TOPES.textoCelda) + '…'; largos = true; }
      const relleno = estilos.rellenos[xf.relleno] || null; const borde = estilos.bordes[xf.borde] || {};
      if (!texto && !relleno && !borde.t && !borde.r && !borde.b && !borde.l) continue;
      const esFecha = typeof valor === 'number' && FORMATO_FECHA(xf.formato, cod);
      todas.push({
        r: p.r, c: p.c, texto, esNumero: typeof valor === 'number', esFecha,
        fecha: esFecha ? new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 86400000)) : null,
        fuente: estilos.fuentes[xf.fuente] || estilos.fuentes[0] || { sz: 11, nombre: 'Calibri' }, relleno, borde,
        h: xf.h, v: xf.v, envolver: !!xf.envolver, rot: xf.rot || 0, sangria: xf.sangria || 0
      });
    }
  }
  let combinadas = [...x.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => rango(m[1])).filter(Boolean);

  // Dibujos: imágenes pegadas (png/jpeg/gif) y formas sencillas; lo demás, al inventario.
  const imagenes = []; const formas = [];
  const relsHoja = relaciones(await lee.xml(rutaRels(h.ruta), 0, 'relaciones'));
  // Cada imagen DISTINTA se lee y se cuenta una vez, aunque la usen muchas anclas (un logo repetido).
  const medias = new Map(); let pxImagenes = 0; let b64Svg = 0; const grandes = [];
  const dibujosVistos = new Set();
  for (const r of relsHoja.values()) {
    if (/\/oleObject$|\/package$/.test(r.tipo)) inventario.push('un objeto incrustado (OLE)');
    if (!/\/drawing$/.test(r.tipo)) continue;
    const rutaD = resolverRuta(h.ruta, r.target);
    if (dibujosVistos.has(rutaD)) continue;
    dibujosVistos.add(rutaD);
    if (dibujosVistos.size > TOPES.dibujos) throw new Error('La hoja trae demasiados dibujos para leerla aquí. Defina un área de impresión solo con el cronograma.');
    const d = await lee.xml(rutaD, 0, 'dibujos');
    for (const t of ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor']) {
      const n = d.replace(/<(\/?)\w+:(\w*Anchor)\b/g, '<$1$2');
      exigirEstructura(n, t, 2000, 'dibujos');
    }
    const relsD = relaciones(await lee.xml(rutaRels(rutaD), 0, 'relaciones'));
    for (const a of d.matchAll(/<(?:xdr:)?(twoCellAnchor|oneCellAnchor|absoluteAnchor)(?=[\s>/])[^>]*?(?:\/>|>[\s\S]*?<\/(?:xdr:)?\1>)/g)) {
      const an = a[0];
      const punto = (t) => {
        const m = an.match(new RegExp('<(?:xdr:)?' + t + '>\\s*<(?:xdr:)?col>(\\d+)</(?:xdr:)?col>\\s*<(?:xdr:)?colOff>(-?\\d+)</(?:xdr:)?colOff>\\s*<(?:xdr:)?row>(\\d+)</(?:xdr:)?row>\\s*<(?:xdr:)?rowOff>(-?\\d+)</(?:xdr:)?rowOff>'));
        // Un ancla fuera de los límites de Excel es falsa: se ignora (antes obligaba a sumar millones de filas).
        return m && +m[1] < MAX_COL && +m[3] < MAX_FILA ? { c: +m[1], dx: +m[2] / EMU_PX, r: +m[3], dy: +m[4] / EMU_PX } : null;
      };
      const ext = an.match(/<(?:xdr:)?ext cx="(\d+)" cy="(\d+)"/);
      const caja = { de: punto('from'), a: punto('to'), w: ext ? +ext[1] / EMU_PX : null, h: ext ? +ext[2] / EMU_PX : null };
      if (/<(?:xdr:)?graphicFrame\b/.test(an)) { inventario.push(/chart/.test(an) ? 'un gráfico' : 'un objeto gráfico'); continue; }
      if (/<(?:xdr:)?pic\b/.test(an)) {
        const blip = (an.match(/<a:blip\b[^>]*>/) || [''])[0];
        if (attr(blip, 'r:link')) { inventario.push('una imagen enlazada a otro archivo'); continue; }
        const rel = relsD.get(attr(blip, 'r:embed'));
        const ruta = rel ? resolverRuta(rutaD, rel.target) : null;
        const extension = ruta ? ruta.split('.').pop().toLowerCase() : '';
        if (!ruta || !zip.file(ruta)) continue;
        if (!['png', 'jpg', 'jpeg', 'gif'].includes(extension)) { inventario.push('una imagen en formato ' + extension.toUpperCase() + ' que el navegador no dibuja'); continue; }
        const src = (an.match(/<a:srcRect\b[^>]*>/) || [''])[0];
        const recorte = src ? { l: (num(src, 'l') || 0) / 100000, t: (num(src, 't') || 0) / 100000, r: (num(src, 'r') || 0) / 100000, b: (num(src, 'b') || 0) / 100000 } : null;
        const mime = extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : 'image/jpeg';
        let md = medias.get(ruta);
        if (!md) {
          let u;
          try { u = await lee.bytes(ruta, 0, 'imagen pegada'); } catch (e) {
            if (e && e.excede) { medias.set(ruta, { fuera: 'una imagen demasiado pesada' }); inventario.push('una imagen demasiado pesada'); continue; }
            throw e;
          }
          // Una imagen de pocos KB puede declarar miles de millones de píxeles: se mide antes de dibujarla.
          const dim = dimensionesImagen(u); const px = dim ? dim.w * dim.h : 0;
          md = { base64: aBase64(u), px, dim, grande: px > TOPES.imagenPx };
          if (!md.grande && pxImagenes + px > TOPES.imagenesPx) md.fuera = 'una imagen demasiado grande (' + dim.w + ' × ' + dim.h + ' px)';
          else if (!md.grande) pxImagenes += px;
          medias.set(ruta, md);
        }
        if (md.fuera) { inventario.push(md.fuera); continue; }
        const img = { ...caja, mime, base64: md.base64, recorte };
        // Más de 120 Mpx: no se dibuja en la hoja; si es lo ÚNICO de la hoja, va como imagen (la pantalla la reduce, como un adjunto suelto).
        if (md.grande) { grandes.push({ img, dim: md.dim }); continue; }
        // El SVG repite la imagen en cada ancla: su suma también tiene tope.
        if (b64Svg + md.base64.length > TOPES.imagenesSvg) { inventario.push('una imagen repetida demasiadas veces'); continue; }
        b64Svg += md.base64.length;
        imagenes.push(img);
      } else if (/<(?:xdr:)?(sp|cxnSp)\b/.test(an)) {
        const geom = attr((an.match(/<a:prstGeom\b[^>]*>/) || [''])[0], 'prst') || (/<a:custGeom/.test(an) ? 'custom' : 'rect');
        const spPr = bloque(an, '(?:xdr:)?spPr');
        const antesDeLinea = (spPr.match(/^[\s\S]*?(?=<a:ln\b|$)/) || [''])[0];
        const relleno = /<a:noFill\/>/.test(antesDeLinea) ? null : colorDrawing(bloque(antesDeLinea, 'a:solidFill'), tema);
        const ln = (spPr.match(/<a:ln\b[^>]*>[\s\S]*?<\/a:ln>|<a:ln\b[^>]*\/>/) || [''])[0];
        const linea = !ln || /<a:noFill\/>/.test(ln) ? null : { color: colorDrawing(bloque(ln, 'a:solidFill'), tema) || '#000000', grueso: (num(ln, 'w') || 9525) / EMU_PX };
        let txt = textoDe(bloque(an, '(?:xdr:)?txBody'));
        if (txt.length > TOPES.textoCelda) { txt = txt.slice(0, TOPES.textoCelda) + '…'; largos = true; }
        if (geom === 'custom') inventario.push('una forma libre');
        formas.push({ ...caja, geom, relleno, linea, texto: txt });
      }
    }
  }

  if (imagenes.length + formas.length + grandes.length > TOPES.objetos) throw new Error('La hoja trae demasiados dibujos (más de ' + TOPES.objetos.toLocaleString('es-CO') + ') para leerla aquí. Defina un área de impresión solo con el cronograma.');
  if (grandes.length === 1 && !imagenes.length && !formas.length && !todas.some((q) => String(q.texto || '').trim())) imagenes.push(grandes[0].img);
  else for (const g of grandes) inventario.push('una imagen demasiado grande (' + g.dim.w + ' × ' + g.dim.h + ' px)');

  // Área: la de impresión de ESA hoja; si no hay, lo usado (celdas + dibujos).
  let area = null;
  for (const m of String(wb).matchAll(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g)) {
    if (attr('<d' + m[1] + '>', 'name') === '_xlnm.Print_Area' && num('<d' + m[1] + '>', 'localSheetId') === h.i) {
      const r = rango(desXml(m[2]).split('!').pop().split(',')[0]); if (r) area = r;
    }
  }
  if (!area) {
    const pts = todas.map((q) => ({ c0: q.c, r0: q.r, c1: q.c, r1: q.r })).concat(combinadas);
    for (const g of [...imagenes, ...formas]) if (g.de) pts.push({ c0: g.de.c, r0: g.de.r, c1: (g.a || g.de).c, r1: (g.a || g.de).r });
    if (!pts.length && inventario.length) throw new Error('La hoja «' + h.nombre + '» solo trae ' + [...new Set(inventario)].join(', ') + ', que no se puede reproducir. En Excel use «Copiar como imagen» y adjunte esa imagen (PNG o JPG).');
    if (!pts.length) throw new Error('La hoja «' + h.nombre + '» está vacía.');
    area = { c0: Infinity, r0: Infinity, c1: -Infinity, r1: -Infinity };
    for (const p of pts) { if (p.c0 < area.c0) area.c0 = p.c0; if (p.r0 < area.r0) area.r0 = p.r0; if (p.c1 > area.c1) area.c1 = p.c1; if (p.r1 > area.r1) area.r1 = p.r1; }
  }
  if (area.c1 - area.c0 + 1 > TOPES.columnas || area.r1 - area.r0 + 1 > TOPES.filas) {
    throw new Error('La hoja «' + h.nombre + '» ocupa ' + (area.c1 - area.c0 + 1) + ' columnas × ' + (area.r1 - area.r0 + 1)
      + ' filas (máximo ' + TOPES.columnas + ' × ' + TOPES.filas + '). Defina un área de impresión en su Excel.');
  }
  const celdas = todas.filter((q) => q.r >= area.r0 && q.r <= area.r1 && q.c >= area.c0 && q.c <= area.c1);
  if (celdas.length > TOPES.celdas) throw new Error('La hoja tiene demasiadas celdas con contenido (máximo 20.000). Defina un área de impresión.');
  // El texto de los cuadros de texto también cuenta (revisión CF-40: miles de cuadros llenos trababan el dibujo).
  if (celdas.reduce((t, q) => t + q.texto.length, 0) + formas.reduce((t, g) => t + String(g.texto || '').length, 0) > TOPES.textoTotal) {
    throw new Error('La hoja tiene demasiado texto para dibujarla en una página. Defina un área de impresión solo con el cronograma.');
  }
  if (largos) inventario.push('textos de más de ' + TOPES.textoCelda.toLocaleString('es-CO') + ' caracteres (se recortaron)');
  const vistas = new Set();
  combinadas = combinadas.map((g) => ({ c0: Math.max(g.c0, area.c0), r0: Math.max(g.r0, area.r0), c1: Math.min(g.c1, area.c1), r1: Math.min(g.r1, area.r1) }))
    .filter((g) => { const k = g.c0 + ',' + g.r0 + ',' + g.c1 + ',' + g.r1; if (g.c0 > g.c1 || g.r0 > g.r1 || vistas.has(k)) return false; vistas.add(k); return true; });
  // Las combinadas se recorren celda a celda al dibujar: su suma también tiene tope.
  if (combinadas.reduce((t, g) => t + (g.c1 - g.c0 + 1) * (g.r1 - g.r0 + 1), 0) > TOPES.celdas * 20) {
    throw new Error('La hoja tiene demasiadas celdas combinadas para dibujarla. Defina un área de impresión.');
  }

  const columnas = []; for (let c = area.c0; c <= area.c1; c++) columnas.push(colPx(c));
  const filas = []; for (let r = area.r0; r <= area.r1; r++) filas.push(filaPx(r));
  // Posición absoluta de la hoja → relativa al área.
  // (Sumas acumuladas: cada columna/fila se suma una vez aunque haya miles de anclas.)
  const acumulado = (px, base) => {
    const mas = [0]; const menos = [0];
    return (k) => {
      if (k >= base) { const i = k - base; while (mas.length <= i) mas.push(mas[mas.length - 1] + px(base + mas.length - 1)); return mas[i]; }
      const i = base - k; while (menos.length <= i) menos.push(menos[menos.length - 1] - px(base - menos.length)); return menos[i];
    };
  };
  const X = acumulado(colPx, area.c0);
  const Y = acumulado(filaPx, area.r0);
  const ubicar = (g) => {
    if (!g.de) return null;
    const x0 = X(g.de.c) + g.de.dx; const y0 = Y(g.de.r) + g.de.dy;
    const x1 = g.a ? X(g.a.c) + g.a.dx : x0 + (g.w || 0); const y1 = g.a ? Y(g.a.r) + g.a.dy : y0 + (g.h || 0);
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  };
  const imgs = imagenes.map((g) => ({ ...ubicar(g), mime: g.mime, base64: g.base64, recorte: g.recorte })).filter((g) => g.w > 0 && g.h > 0);
  const fms = formas.map((g) => ({ ...ubicar(g), geom: g.geom, relleno: g.relleno, linea: g.linea, texto: g.texto })).filter((g) => g.w > 0 || g.h > 0);

  return {
    hojas: hojas.map((q) => ({ nombre: q.nombre, visible: q.visible, activa: q.activa })), hoja: h.nombre, area,
    columnas, filas, celdas: celdas.map((q) => ({ ...q, r: q.r - area.r0, c: q.c - area.c0 })),
    combinadas: combinadas.map((g) => ({ c0: g.c0 - area.c0, r0: g.r0 - area.r0, c1: g.c1 - area.c0, r1: g.r1 - area.r0 })),
    imagenes: imgs, formas: fms, inventario: [...new Set(inventario)]
  };
}

function colorDrawing(xml, tema) {
  const s = String(xml || '');
  const srgb = (s.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/) || [])[1];
  let hex = srgb ? srgb.toUpperCase() : null;
  if (!hex) {
    const sc = (s.match(/<a:schemeClr val="(\w+)"/) || [])[1];
    const mapa = { lt1: 0, bg1: 0, dk1: 1, tx1: 1, lt2: 2, bg2: 2, dk2: 3, tx2: 3, accent1: 4, accent2: 5, accent3: 6, accent4: 7, accent5: 8, accent6: 9, hlink: 10, folHlink: 11 };
    if (sc && mapa[sc] != null) hex = tema[mapa[sc]];
  }
  if (!hex) return null;
  const lumMod = num((s.match(/<a:lumMod\b[^>]*>/) || [''])[0], 'val'); const lumOff = num((s.match(/<a:lumOff\b[^>]*>/) || [''])[0], 'val');
  if (lumMod != null || lumOff != null) hex = conTinte(hex, lumOff != null ? lumOff / 100000 : -(1 - (lumMod || 100000) / 100000));
  return '#' + hex;
}
