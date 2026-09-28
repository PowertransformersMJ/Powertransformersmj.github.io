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
// ══════════════════════════════════════════════════════════════════════════════

import { cargarJSZip, colIndice, formatearValor } from './vista-previa-excel.js';

export const TOPES = Object.freeze({ total: 50 * 1024 * 1024, hoja: 20 * 1024 * 1024, hojas: 30, columnas: 200, filas: 1000, celdas: 20000 });
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
const bloque = (xml, n) => (String(xml || '').match(new RegExp('<' + n + '\\b[^>]*>([\\s\\S]*?)</' + n + '>')) || ['', ''])[1];
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
  for (const m of s.matchAll(/<numFmt\b[^>]*\/>/g)) formatos[num(m[0], 'numFmtId')] = desXml(attr(m[0], 'formatCode'));
  const fuentes = [...bloque(s, 'fonts').matchAll(/<font\b[^>]*?(?:\/>|>([\s\S]*?)<\/font>)/g)].map((m) => {
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
  const bordes = [...bloque(s, 'borders').matchAll(/<border\b[^>]*?(?:\/>|>([\s\S]*?)<\/border>)/g)].map((m) => {
    const b = m[1] || '';
    const lado = (n) => {
      const t = b.match(new RegExp('<' + n + '\\b[^>]*?(?:/>|>([\\s\\S]*?)</' + n + '>)')) || [];
      const est = attr(t[0] || '', 'style');
      if (!est || est === 'none') return null;
      return { grueso: GRUESO[est] || 1, estilo: est, color: colorDe(((t[1] || '').match(/<color\b[^>]*>/) || [''])[0], tema, indexados) || '#000000' };
    };
    return { t: lado('top'), r: lado('right'), b: lado('bottom'), l: lado('left') };
  });
  const xfs = [...bloque(s, 'cellXfs').matchAll(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)].map((m) => {
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

/** Tamaño descomprimido declarado de una parte del zip (JSZip 3). */
const tamano = (f) => (f && f._data && Number.isFinite(f._data.uncompressedSize) ? f._data.uncompressedSize : 0);

async function abrir(bytes) {
  const JSZip = await cargarJSZip();
  let zip;
  try { zip = await JSZip.loadAsync(bytes); } catch (e) { throw new Error('El archivo no se pudo abrir como Excel (.xlsx).'); }
  const partes = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const total = partes.reduce((s, n) => s + tamano(zip.files[n]), 0);
  if (total > TOPES.total) throw new Error('El Excel es demasiado grande por dentro (' + Math.round(total / 1048576) + ' MB descomprimido; máximo 50 MB).');
  const ct = zip.file('[Content_Types].xml') ? await zip.file('[Content_Types].xml').async('string') : '';
  if (!/spreadsheetml\.sheet\.main|sheet\.macroEnabled\.main|spreadsheetml\.template\.main/.test(ct)) throw new Error('El archivo no es un libro de Excel (.xlsx).');
  const raiz = relaciones(zip.file('_rels/.rels') ? await zip.file('_rels/.rels').async('string') : '');
  const relDoc = [...raiz.values()].find((r) => /\/officeDocument$/.test(r.tipo));
  const libro = relDoc ? resolverRuta('', relDoc.target) : 'xl/workbook.xml';
  const wb = zip.file(libro) ? await zip.file(libro).async('string') : '';
  const rels = relaciones(zip.file(rutaRels(libro)) ? await zip.file(rutaRels(libro)).async('string') : '');
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
  return { zip, libro, wb, hojas };
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
  const { zip, libro, wb, hojas } = await abrir(bytes);
  const visibles = hojas.filter((h) => h.visible);
  const h = (op.hoja && hojas.find((x) => x.nombre === op.hoja)) || visibles.find((x) => x.activa) || visibles[0] || hojas[0];
  const fh = zip.file(h.ruta);
  if (tamano(fh) > TOPES.hoja) throw new Error('La hoja «' + h.nombre + '» es demasiado grande (máximo 20 MB por dentro).');
  const inventario = [];
  const leer = async (r) => (zip.file(r) ? zip.file(r).async('string') : '');
  const rels = relaciones(await leer(rutaRels(libro)));
  const rutaDe = (tipo) => { const r = [...rels.values()].find((x) => new RegExp('/' + tipo + '$').test(x.tipo)); return r ? resolverRuta(libro, r.target) : null; };
  const tema = paletaTema(await leer(rutaDe('theme') || 'xl/theme/theme1.xml'));
  const estilos = leerEstilos(await leer(rutaDe('styles') || 'xl/styles.xml'), tema);
  const compartidos = [...String(await leer(rutaDe('sharedStrings') || 'xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)]
    .map((m) => textoDe((m[1] || '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')));
  const x = await fh.async('string');

  // Geometría: anchos y altos en píxeles (Arial/Calibri 10-11: 7 px por dígito).
  const fmt = (x.match(/<sheetFormatPr\b[^>]*>/) || [''])[0];
  const anchoDef = num(fmt, 'defaultColWidth') || ((num(fmt, 'baseColWidth') || 8) + 0.43);
  const altoDef = num(fmt, 'defaultRowHeight') || 15;
  const cols = [...x.matchAll(/<col\b[^>]*\/>/g)].map((m) => ({ min: num(m[0], 'min') - 1, max: num(m[0], 'max') - 1, w: num(m[0], 'width'), oculta: attr(m[0], 'hidden') === '1' }));
  const pxCol = (w) => Math.trunc(((256 * w + Math.trunc(128 / 7)) / 256) * 7);
  const colPx = (c) => { const k = cols.find((q) => c >= q.min && c <= q.max); if (k && k.oculta) return 0; return pxCol(k && k.w != null ? k.w : anchoDef); };
  const filasXml = new Map();
  for (const m of x.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) filasXml.set(num('<r' + m[1] + '>', 'r') - 1, { at: '<r' + m[1] + '>', cuerpo: m[2] || '' });
  const filaPx = (r) => { const f = filasXml.get(r); if (f && attr(f.at, 'hidden') === '1') return 0; const ht = f ? num(f.at, 'ht') : null; return Math.round((ht != null ? ht : altoDef) * PX_PT); };

  // Celdas con contenido o con relleno/borde.
  const todas = [];
  for (const [, f] of filasXml) {
    for (const c of f.cuerpo.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
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
      else if (v != null && v !== '') { valor = +v; texto = String(formatearValor(valor, cod, xf.formato)); }
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
  const relsHoja = relaciones(await leer(rutaRels(h.ruta)));
  for (const r of relsHoja.values()) {
    if (/\/oleObject$|\/package$/.test(r.tipo)) inventario.push('un objeto incrustado (OLE)');
    if (!/\/drawing$/.test(r.tipo)) continue;
    const rutaD = resolverRuta(h.ruta, r.target);
    const d = await leer(rutaD);
    const relsD = relaciones(await leer(rutaRels(rutaD)));
    for (const a of d.matchAll(/<(?:xdr:)?(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/(?:xdr:)?\1>/g)) {
      const an = a[0];
      const punto = (t) => {
        const m = an.match(new RegExp('<(?:xdr:)?' + t + '>\\s*<(?:xdr:)?col>(\\d+)</(?:xdr:)?col>\\s*<(?:xdr:)?colOff>(-?\\d+)</(?:xdr:)?colOff>\\s*<(?:xdr:)?row>(\\d+)</(?:xdr:)?row>\\s*<(?:xdr:)?rowOff>(-?\\d+)</(?:xdr:)?rowOff>'));
        return m ? { c: +m[1], dx: +m[2] / EMU_PX, r: +m[3], dy: +m[4] / EMU_PX } : null;
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
        imagenes.push({ ...caja, mime, base64: await zip.file(ruta).async('base64'), recorte });
      } else if (/<(?:xdr:)?(sp|cxnSp)\b/.test(an)) {
        const geom = attr((an.match(/<a:prstGeom\b[^>]*>/) || [''])[0], 'prst') || (/<a:custGeom/.test(an) ? 'custom' : 'rect');
        const spPr = bloque(an, '(?:xdr:)?spPr');
        const antesDeLinea = (spPr.match(/^[\s\S]*?(?=<a:ln\b|$)/) || [''])[0];
        const relleno = /<a:noFill\/>/.test(antesDeLinea) ? null : colorDrawing(bloque(antesDeLinea, 'a:solidFill'), tema);
        const ln = (spPr.match(/<a:ln\b[^>]*>[\s\S]*?<\/a:ln>|<a:ln\b[^>]*\/>/) || [''])[0];
        const linea = !ln || /<a:noFill\/>/.test(ln) ? null : { color: colorDrawing(bloque(ln, 'a:solidFill'), tema) || '#000000', grueso: (num(ln, 'w') || 9525) / EMU_PX };
        const txt = textoDe(bloque(an, '(?:xdr:)?txBody'));
        if (geom === 'custom') inventario.push('una forma libre');
        formas.push({ ...caja, geom, relleno, linea, texto: txt });
      }
    }
  }

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
    if (!pts.length) throw new Error('La hoja «' + h.nombre + '» está vacía.');
    area = { c0: Math.min(...pts.map((p) => p.c0)), r0: Math.min(...pts.map((p) => p.r0)), c1: Math.max(...pts.map((p) => p.c1)), r1: Math.max(...pts.map((p) => p.r1)) };
  }
  if (area.c1 - area.c0 + 1 > TOPES.columnas || area.r1 - area.r0 + 1 > TOPES.filas) {
    throw new Error('La hoja «' + h.nombre + '» ocupa ' + (area.c1 - area.c0 + 1) + ' columnas × ' + (area.r1 - area.r0 + 1)
      + ' filas (máximo ' + TOPES.columnas + ' × ' + TOPES.filas + '). Defina un área de impresión en su Excel.');
  }
  const celdas = todas.filter((q) => q.r >= area.r0 && q.r <= area.r1 && q.c >= area.c0 && q.c <= area.c1);
  if (celdas.length > TOPES.celdas) throw new Error('La hoja tiene demasiadas celdas con contenido (máximo 20.000). Defina un área de impresión.');
  combinadas = combinadas.map((g) => ({ c0: Math.max(g.c0, area.c0), r0: Math.max(g.r0, area.r0), c1: Math.min(g.c1, area.c1), r1: Math.min(g.r1, area.r1) }))
    .filter((g) => g.c0 <= g.c1 && g.r0 <= g.r1);

  const columnas = []; for (let c = area.c0; c <= area.c1; c++) columnas.push(colPx(c));
  const filas = []; for (let r = area.r0; r <= area.r1; r++) filas.push(filaPx(r));
  // Posición absoluta de la hoja → relativa al área.
  const X = (c) => { let s = 0; for (let k = area.c0; k < c; k++) s += colPx(k); for (let k = c; k < area.c0; k++) s -= colPx(k); return s; };
  const Y = (r) => { let s = 0; for (let k = area.r0; k < r; k++) s += filaPx(k); for (let k = r; k < area.r0; k++) s -= filaPx(k); return s; };
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
