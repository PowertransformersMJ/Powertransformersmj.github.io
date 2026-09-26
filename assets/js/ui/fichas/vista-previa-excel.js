// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · VISTA PREVIA DEL EXCEL (`99 §102`)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-25): «la ficha técnica completa con todas las
// hojas, quiero validar que no se exporte información que no necesito».
//
// Se lee el MISMO .xlsx que se descargaría (no el estado de la pantalla): así lo
// que se ve es lo que viaja en el archivo, incluido lo que la plantilla trae y
// este sistema no escribe. Dos partes:
//   · leerLibroParaVista(zip) — PURA (sin DOM): hojas en su área de impresión,
//     con celdas (valor, fórmula calculada, estilo), imágenes y cuadros de texto
//     en su lugar; y los DATOS OCULTOS del archivo. Se prueba con node.
//   · mostrarVistaPrevia(modelo, opciones) — la ventana, una pestaña por hoja.
// Solo MUESTRA: no quita ni cambia nada del archivo. Quitar los datos ocultos lo
// hace el exportador (`limpiar-ocultos.js`, `99 §104`); aquí se comprueba.
// ══════════════════════════════════════════════════════════════════════════════

import { partesSueltas, textosSobrantes } from './limpiar-ocultos.js';

const EMU_PX = 9525;
const PT_PX = 96 / 72;

/** JSZip: la instancia ya cargada (pruebas o exportador) o la del CDN, igual que el exportador. */
export async function cargarJSZip() {
  if (globalThis.__sgmJSZip) return globalThis.__sgmJSZip;
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
  const JSZip = mod.default || mod;
  if (!JSZip || typeof JSZip.loadAsync !== 'function') throw new Error('No se pudo cargar la librería para leer el Excel.');
  return JSZip;
}

/* ── utilidades XML ─────────────────────────────────────────────────────────── */

const attr = (tag, nombre) => {
  const m = String(tag || '').match(new RegExp('\\s' + nombre + '="([^"]*)"'));
  return m ? m[1] : null;
};
const num = (tag, nombre) => { const v = attr(tag, nombre); return v == null || v === '' ? null : +v; };
const desXml = (s) => String(s == null ? '' : s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const textoDe = (xml) => desXml([...String(xml || '').matchAll(/<(?:a:)?t(?:\s[^>]*)?>([^<]*)<\/(?:a:)?t>/g)].map((m) => m[1]).join(''));

/** Columna «AB» → índice 0-based. */
export function colIndice(letras) {
  let n = 0;
  for (const ch of String(letras).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
const refPartes = (ref) => {
  const m = String(ref).replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i);
  return m ? { c: colIndice(m[1]), r: +m[2] - 1 } : null;
};
const colLetras = (c) => { let s = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

async function texto(zip, ruta) { const f = zip.file(ruta); return f ? f.async('string') : null; }
function resolverRuta(base, target) {
  if (/^\//.test(target)) return target.slice(1);
  const partes = base.split('/'); partes.pop();
  for (const p of target.split('/')) { if (p === '..') partes.pop(); else if (p !== '.') partes.push(p); }
  return partes.join('/');
}
function relaciones(xml) {
  const m = new Map();
  for (const r of String(xml || '').matchAll(/<Relationship\b[^>]*\/?>/g)) {
    m.set(attr(r[0], 'Id'), { target: attr(r[0], 'Target'), tipo: attr(r[0], 'Type') || '', externo: attr(r[0], 'TargetMode') === 'External' });
  }
  return m;
}

/* ── colores y estilos ─────────────────────────────────────────────────────── */

const INDEXADOS = { 8: '000000', 9: 'FFFFFF', 10: 'FF0000', 11: '00FF00', 12: '0000FF', 13: 'FFFF00', 22: 'C0C0C0', 23: '808080', 64: '000000', 65: 'FFFFFF' };

function paleta(temaXml) {
  const orden = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const colores = {};
  for (const n of orden) {
    const m = String(temaXml || '').match(new RegExp('<a:' + n + '>([\\s\\S]*?)</a:' + n + '>'));
    const srgb = m ? (m[1].match(/<a:srgbClr[^>]*>/) || [''])[0] : '';
    const sys = m ? (m[1].match(/<a:sysClr[^>]*>/) || [''])[0] : '';
    colores[n] = attr(srgb, 'val') || attr(sys, 'lastClr') || null;
  }
  return orden.map((n) => colores[n] || (n === 'lt1' ? 'FFFFFF' : '000000'));
}
function conTinte(hex, tinte) {
  if (!tinte) return hex;
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const t = Math.max(-1, Math.min(1, tinte));
  return c.map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t)).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function color(tag, tema) {
  if (!tag) return null;
  const rgb = attr(tag, 'rgb');
  let hex = null;
  if (rgb) hex = rgb.length === 8 ? rgb.slice(2) : rgb;
  else if (attr(tag, 'theme') != null) hex = tema[+attr(tag, 'theme')] || null;
  else if (attr(tag, 'indexed') != null) hex = INDEXADOS[+attr(tag, 'indexed')] || null;
  if (!hex) return null;
  return '#' + conTinte(hex.toUpperCase(), num(tag, 'tint') || 0);
}

function leerEstilos(estilosXml, tema) {
  const s = String(estilosXml || '');
  const formatos = {};
  for (const m of s.matchAll(/<numFmt\b[^>]*\/>/g)) formatos[num(m[0], 'numFmtId')] = desXml(attr(m[0], 'formatCode'));
  const bloque = (n) => (s.match(new RegExp('<' + n + '\\b[^>]*>([\\s\\S]*?)</' + n + '>')) || ['', ''])[1];
  const fuentes = [...bloque('fonts').matchAll(/<font\b[^>]*?(?:\/>|>([\s\S]*?)<\/font>)/g)].map((m) => {
    const f = m[1] || '';
    return {
      b: /<b(?:\s[^>]*)?\/>/.test(f) && !/<b val="0"/.test(f), i: /<i(?:\s[^>]*)?\/>/.test(f) && !/<i val="0"/.test(f),
      u: /<u(?:\s[^>]*)?\/>/.test(f), sz: num((f.match(/<sz\b[^>]*>/) || [''])[0], 'val') || 11,
      color: color((f.match(/<color\b[^>]*>/) || [''])[0], tema), nombre: attr((f.match(/<name\b[^>]*>/) || [''])[0], 'val') || ''
    };
  });
  const rellenos = [...bloque('fills').matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => {
    const p = (m[1].match(/<patternFill\b[^>]*>/) || [''])[0];
    if (!p || attr(p, 'patternType') === 'none' || !attr(p, 'patternType')) return null;
    return color((m[1].match(/<fgColor\b[^>]*>/) || [''])[0], tema) || '#D9D9D9';
  });
  const bordes = [...bloque('borders').matchAll(/<border\b[^>]*?(?:\/>|>([\s\S]*?)<\/border>)/g)].map((m) => {
    const b = m[1] || '';
    const lado = (n) => {
      const t = (b.match(new RegExp('<' + n + '\\b[^>]*?(?:/>|>([\\s\\S]*?)</' + n + '>)')) || []);
      const est = attr(t[0] || '', 'style');
      if (!est) return null;
      return { grueso: /medium|thick|double/.test(est) ? 2 : 1, color: color(((t[1] || '').match(/<color\b[^>]*>/) || [''])[0], tema) || '#000' };
    };
    return { t: lado('top'), r: lado('right'), b: lado('bottom'), l: lado('left') };
  });
  const xfs = [...bloque('cellXfs').matchAll(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)].map((m) => {
    const a = (m[2] || '').match(/<alignment\b[^>]*>/);
    return {
      fuente: num('<x' + m[1] + '>', 'fontId') || 0, relleno: num('<x' + m[1] + '>', 'fillId') || 0,
      borde: num('<x' + m[1] + '>', 'borderId') || 0, formato: num('<x' + m[1] + '>', 'numFmtId') || 0,
      h: a ? attr(a[0], 'horizontal') : null, v: a ? attr(a[0], 'vertical') : null, envolver: a ? attr(a[0], 'wrapText') === '1' : false
    };
  });
  return { formatos, fuentes, rellenos, bordes, xfs };
}

/* ── formato de números (lo que el ojo ve en Excel, en es-CO) ────────────────── */

const FORMATOS_FECHA = new Set([14, 15, 16, 17, 22]);
export function formatearValor(v, codigo, idFormato) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return v == null ? '' : String(v);
  const cod = String(codigo || '');
  const esFecha = FORMATOS_FECHA.has(idFormato) || (/(^|[^"])(d{1,4}|y{2,4})/i.test(cod.replace(/"[^"]*"/g, '')) && !/#|0\.0/.test(cod));
  if (esFecha) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mes = MESES[d.getUTCMonth()]; const aa = String(d.getUTCFullYear()).slice(2);
    // Formatos internos con el mes en letras (Excel en es-CO): 15 d-mmm-aa · 16 d-mmm · 17 mmm-aa.
    if (idFormato === 17 || (/mmm/i.test(cod) && !/d/i.test(cod.replace(/"[^"]*"/g, '')))) return mes + '-' + aa;
    if (idFormato === 15 || /d+[-/ ]mmm[-/ ]y/i.test(cod)) return d.getUTCDate() + '-' + mes + '-' + aa;
    if (idFormato === 16 || /d+[-/ ]mmm/i.test(cod)) return d.getUTCDate() + '-' + mes;
    return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
  }
  const secciones = cod.split(';');
  // El cero tiene su propia sección en los formatos contables: «$ -», no «$ 0,00».
  if (v === 0 && secciones.length >= 3) {
    const cero = secciones[2].replace(/_./g, '').replace(/\*./g, '').replace(/\\/g, '');
    const literal = (cero.match(/"([^"]*)"/g) || []).map((q) => q.slice(1, -1)).join(' ').trim();
    if (literal && !/0/.test(cero.replace(/"[^"]*"/g, ''))) return literal.replace(/^\$\s*/, '$ ').replace(/\?+$/, '').trim();
  }
  const seccion = secciones[0];
  const dec = idFormato === 2 || idFormato === 4 ? 2 : ((seccion.match(/0\.(0+)/) || [null, ''])[1].length);
  if (/%/.test(seccion)) return (v * 100).toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' %';
  const miles = idFormato === 3 || idFormato === 4 || /#,##0/.test(seccion);
  if (miles || dec || idFormato === 1 || idFormato === 2) {
    const s = Math.abs(v).toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: miles });
    const moneda = /"\$"|\[\$\$|\$/.test(seccion) ? '$ ' : '';
    return (v < 0 ? (/\\\(|\(/.test(cod.split(';')[1] || '') ? '(' + moneda + s + ')' : '-' + moneda + s) : moneda + s);
  }
  // General: hasta 10 cifras, coma decimal.
  const g = Number.isInteger(v) ? String(v) : String(+v.toPrecision(10));
  return g.replace('.', ',');
}

/* ── fórmulas: el subconjunto que usa el PE.02081 ───────────────────────────── */

/**
 * Calcula una fórmula con celdas del libro. Soporta números, textos, referencias
 * (con hoja), rangos, + - * / ^ &, comparaciones y SUM, COUNT, IF, AVERAGE,
 * MIN, MAX, ROUND. Una referencia a OTRO libro ([1]…) no se calcula: se marca.
 * @returns {{valor: any, externa?: boolean, error?: string}}
 */
export function calcularFormula(formula, hojaActual, leerCelda) {
  const s = String(formula || '').trim();
  let i = 0; let externa = false;
  const esp = () => { while (s[i] === ' ') i++; };
  const ERR = (m) => { throw new Error(m); };
  function hojaYRef() {
    const ini = i; let hoja = null;
    if (s[i] === "'") { const j = s.indexOf("'!", i + 1); if (j < 0) ERR('ref'); hoja = s.slice(i + 1, j); i = j + 2; }
    else {
      const m = s.slice(i).match(/^(\[\d+\])?([A-Za-zÁÉÍÓÚÑáéíóúñ_][\w ÁÉÍÓÚÑáéíóúñ.]*)!/);
      if (m) { hoja = m[0].slice(0, -1); i += m[0].length; }
    }
    if (hoja && /^\[\d+\]/.test(hoja)) { externa = true; hoja = hoja.replace(/^\[\d+\]/, ''); }
    const m = s.slice(i).match(/^\$?[A-Z]{1,3}\$?\d+(:\$?[A-Z]{1,3}\$?\d+)?/i);
    if (!m) { i = ini; return null; }
    i += m[0].length;
    return { hoja: hoja || hojaActual, ref: m[0] };
  }
  // Un error de Excel («#¡DIV/0!», «#¡VALOR!»…) se propaga tal cual, como en Excel.
  const ERROR_EXCEL = /^#(?:¡?(?:DIV\/0!|VALOR!|REF!|NOMBRE\?|NUM!|NULO!)|N\/A|VALUE!|NAME\?|NULL!)$/;
  const aNum = (v) => (typeof v === 'number' ? v : (v === '' || v == null ? 0 : (Number.isFinite(+v) ? +v : (ERROR_EXCEL.test(String(v)) ? ERR(String(v)) : NaN))));
  function valores(r) {
    const [a, b] = r.ref.replace(/\$/g, '').split(':');
    const p = refPartes(a); const q = refPartes(b || a);
    const out = [];
    for (let rr = Math.min(p.r, q.r); rr <= Math.max(p.r, q.r); rr++) {
      for (let cc = Math.min(p.c, q.c); cc <= Math.max(p.c, q.c); cc++) out.push(externa ? undefined : leerCelda(r.hoja, colLetras(cc) + (rr + 1)));
    }
    return out;
  }
  function primario() {
    esp();
    if (s[i] === '(') { i++; const v = comparacion(); esp(); if (s[i] !== ')') ERR('paréntesis'); i++; return v; }
    if (s[i] === '"') { const j = s.indexOf('"', i + 1); const v = s.slice(i + 1, j); i = j + 1; return v; }
    if (s[i] === '+' || s[i] === '-') { const sg = s[i++]; const v = aNum(primario()); return sg === '-' ? -v : v; }
    const n = s.slice(i).match(/^\d+(\.\d+)?(E[+-]?\d+)?/i);
    if (n && !/^[A-Z]/i.test(s.slice(i + n[0].length, i + n[0].length + 1))) { i += n[0].length; return +n[0]; }
    const fn = s.slice(i).match(/^([A-Z][A-Z0-9.]*)\(/i);
    if (fn) {
      i += fn[0].length; const args = [];
      esp();
      while (s[i] !== ')') {
        if (i >= s.length) ERR('función');
        esp();
        // ¿Un rango suelto (A1:B9) como argumento? Si no, se reparsea como expresión.
        const guardado = i; const r = hojaYRef();
        if (r && /:/.test(r.ref) && /^\s*[,;)]/.test(s.slice(i))) args.push({ rango: valores(r) });
        else { i = guardado; args.push(comparacion()); }
        esp(); if (s[i] === ',' || s[i] === ';') i++;
      }
      i++;
      const plano = args.flatMap((a) => (a && a.rango ? a.rango : [a]));
      const nums = plano.filter((v) => typeof v === 'number');
      switch (fn[1].toUpperCase()) {
        case 'SUM': return nums.reduce((t, v) => t + v, 0);
        case 'COUNT': return nums.length;
        case 'AVERAGE': return nums.length ? nums.reduce((t, v) => t + v, 0) / nums.length : ERR('#¡DIV/0!');
        case 'MIN': return nums.length ? Math.min(...nums) : 0;
        case 'MAX': return nums.length ? Math.max(...nums) : 0;
        case 'ROUND': { const f = 10 ** aNum(args[1]); return Math.round(aNum(args[0]) * f) / f; }
        case 'IF': return (args[0] && args[0] !== 0) ? (args.length > 1 ? args[1] : true) : (args.length > 2 ? args[2] : false);
        default: ERR('función ' + fn[1]);
      }
    }
    const r = hojaYRef();
    if (r) return externa ? undefined : leerCelda(r.hoja, r.ref.replace(/\$/g, ''));
    ERR('símbolo');
  }
  function potencia() { let v = primario(); esp(); while (s[i] === '^') { i++; v = aNum(v) ** aNum(primario()); esp(); } return v; }
  function producto() { let v = potencia(); esp(); while (s[i] === '*' || s[i] === '/') { const o = s[i++]; const w = aNum(potencia()); if (o === '/' && w === 0) ERR('#¡DIV/0!'); v = o === '*' ? aNum(v) * w : aNum(v) / w; esp(); } return v; }
  function suma() { let v = producto(); esp(); while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const w = aNum(producto()); v = o === '+' ? aNum(v) + w : aNum(v) - w; esp(); } return v; }
  function concat() { let v = suma(); esp(); while (s[i] === '&') { i++; v = String(v ?? '') + String(suma() ?? ''); esp(); } return v; }
  function comparacion() {
    let v = concat(); esp();
    const m = s.slice(i).match(/^(<>|<=|>=|=|<|>)/);
    if (m) {
      i += m[1].length; const w = concat();
      const a = typeof v === 'number' || typeof w === 'number' ? aNum(v) : String(v ?? ''); const b = typeof v === 'number' || typeof w === 'number' ? aNum(w) : String(w ?? '');
      v = { '=': a === b, '<>': a !== b, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[m[1]];
    }
    return v;
  }
  try {
    const v = comparacion(); esp();
    if (i < s.length) return { valor: null, error: 'no se pudo calcular', externa };
    if (externa) return { valor: null, externa: true };
    return { valor: typeof v === 'boolean' ? (v ? 'VERDADERO' : 'FALSO') : (Number.isNaN(v) ? '#¡VALOR!' : v) };
  } catch (e) {
    if (!externa && ERROR_EXCEL.test(e.message)) return { valor: e.message };
    return { valor: null, externa, error: e.message };
  }
}

/* ── lectura del libro ──────────────────────────────────────────────────────── */

function leerHojaCeldas(hojaXml, compartidos) {
  const celdas = new Map();
  for (const m of String(hojaXml).matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = m[1]; const a = '<c' + m[2] + '>'; const cuerpo = m[3] || '';
    const t = attr(a, 't'); const s = num(a, 's') || 0;
    const f = cuerpo.match(/<f\b[^>]*>([\s\S]*?)<\/f>/);
    const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/);
    let valor = null;
    if (t === 's' && v) valor = compartidos[+v[1]] ?? '';
    else if (t === 'inlineStr') valor = textoDe((cuerpo.match(/<is>([\s\S]*?)<\/is>/) || ['', ''])[1]);
    else if (t === 'str' && v) valor = desXml(v[1]);
    else if (t === 'b' && v) valor = v[1] === '1' ? 'VERDADERO' : 'FALSO';
    else if (t === 'e' && v) valor = desXml(v[1]);
    else if (v) valor = +v[1];
    celdas.set(ref, { ref, estilo: s, valor, formula: f ? desXml(f[1]) : null, tieneValor: !!v || t === 'inlineStr' });
  }
  return celdas;
}

function geometria(hojaXml) {
  const x = String(hojaXml);
  const fmt = (x.match(/<sheetFormatPr\b[^>]*>/) || [''])[0];
  const anchoDef = num(fmt, 'defaultColWidth') || ((num(fmt, 'baseColWidth') || 8) + 0.71);
  const altoDef = num(fmt, 'defaultRowHeight') || 15;
  const cols = [...x.matchAll(/<col\b[^>]*>/g)].map((m) => ({ min: num(m[0], 'min'), max: num(m[0], 'max'), w: num(m[0], 'width'), oculta: attr(m[0], 'hidden') === '1' }));
  const filas = {};
  for (const m of x.matchAll(/<row\b([^>]*)>/g)) {
    const r = num('<r' + m[1] + '>', 'r');
    if (r != null) filas[r - 1] = { ht: num('<r' + m[1] + '>', 'ht'), oculta: attr('<r' + m[1] + '>', 'hidden') === '1' };
  }
  const anchoPx = (w) => Math.trunc(((256 * w + Math.trunc(128 / 7)) / 256) * 7);
  const anchoCol = (c) => {
    const k = cols.find((q) => c + 1 >= q.min && c + 1 <= q.max);
    if (k && k.oculta) return 0;
    return anchoPx(k && k.w != null ? k.w : anchoDef);
  };
  const altoFila = (r) => { const f = filas[r]; if (f && f.oculta) return 0; return Math.round(((f && f.ht != null) ? f.ht : altoDef) * PT_PX); };
  const cacheX = [0]; const cacheY = [0];
  const X = (c) => { while (cacheX.length <= c) cacheX.push(cacheX[cacheX.length - 1] + anchoCol(cacheX.length - 1)); return cacheX[c]; };
  const Y = (r) => { while (cacheY.length <= r) cacheY.push(cacheY[cacheY.length - 1] + altoFila(cacheY.length - 1)); return cacheY[r]; };
  return { X, Y, anchoCol, altoFila, filas, cols };
}

function areaImpresion(workbookXml, indice, nombreHoja, hojaXml) {
  for (const m of String(workbookXml).matchAll(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g)) {
    if (attr('<d' + m[1] + '>', 'name') !== '_xlnm.Print_Area' || num('<d' + m[1] + '>', 'localSheetId') !== indice) continue;
    const r = desXml(m[2]).split(',')[0].replace(/^.*!/, '').replace(/\$/g, '');
    const [a, b] = r.split(':'); const p = refPartes(a); const q = refPartes(b || a);
    if (p && q) return { c0: p.c, r0: p.r, c1: q.c, r1: q.r, definida: true };
  }
  const d = (String(hojaXml).match(/<dimension ref="([^"]+)"/) || [])[1] || 'A1';
  const [a, b] = d.split(':'); const p = refPartes(a) || { c: 0, r: 0 }; const q = refPartes(b || a) || p;
  return { c0: p.c, r0: p.r, c1: q.c, r1: q.r, definida: false };
}

/* Dibujos: imágenes y cuadros de texto en su lugar (px desde el origen de la hoja). */
async function leerDibujo(zip, rutaDibujo, geo) {
  const xml = await texto(zip, rutaDibujo);
  if (!xml) return { imagenes: [], textos: [], lineas: [] };
  const rels = relaciones(await texto(zip, rutaDibujo.replace(/drawings\/(drawing\d+\.xml)$/, 'drawings/_rels/$1.rels')));
  const imagenes = []; const textos = []; const lineas = [];
  let capa = 0;   // orden del documento = orden de capas (lo de atrás va primero)
  const punto = (bloque, t) => {
    const m = bloque.match(new RegExp('<xdr:' + t + '><xdr:col>(\\d+)</xdr:col><xdr:colOff>(-?\\d+)</xdr:colOff><xdr:row>(\\d+)</xdr:row><xdr:rowOff>(-?\\d+)</xdr:rowOff></xdr:' + t + '>'));
    return m ? { x: geo.X(+m[1]) + (+m[2]) / EMU_PX, y: geo.Y(+m[3]) + (+m[4]) / EMU_PX } : null;
  };
  const cajaAncla = (ancla) => {
    const a = punto(ancla, 'from');
    if (!a) {
      const pos = ancla.match(/<xdr:pos x="(-?\d+)" y="(-?\d+)"\/>/); const ext = ancla.match(/<xdr:ext cx="(\d+)" cy="(\d+)"\/>/);
      return pos && ext ? { x: +pos[1] / EMU_PX, y: +pos[2] / EMU_PX, w: +ext[1] / EMU_PX, h: +ext[2] / EMU_PX } : null;
    }
    const b = punto(ancla, 'to');
    if (b) return { x: a.x, y: a.y, w: Math.max(0, b.x - a.x), h: Math.max(0, b.y - a.y) };
    const ext = ancla.match(/<xdr:ext cx="(\d+)" cy="(\d+)"\/>/);
    return ext ? { x: a.x, y: a.y, w: +ext[1] / EMU_PX, h: +ext[2] / EMU_PX } : null;
  };
  const xfrm = (x) => {
    const m = x.match(/<a:xfrm\b[^>]*>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    return m ? { x: +m[1], y: +m[2], cx: +m[3], cy: +m[4] } : null;
  };
  async function elemento(tipo, x, caja) {
    if (tipo === 'pic') {
      const id = attr((x.match(/<a:blip\b[^>]*>/) || [''])[0], 'r:embed');
      const r = id && rels.get(id);
      const ruta = r ? resolverRuta(rutaDibujo, r.target) : null;
      const ext = ruta ? ruta.split('.').pop().toLowerCase() : '';
      let src = null; let bytes = 0;
      if (ruta && zip.file(ruta)) {
        if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
          const b64 = await zip.file(ruta).async('base64');
          src = 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + b64;
          bytes = Math.round(b64.length * 3 / 4);
        } else {
          bytes = (await zip.file(ruta).async('uint8array')).length;
        }
      }
      // EMF/WMF (el logo de la plantilla) no se dibuja en el navegador: se avisa, pero sí va en el Excel.
      imagenes.push({ ...caja, capa: capa++, src, bytes, ruta: ruta || '', nota: src ? '' : ('Imagen ' + (ext || '?').toUpperCase() + ' (logo): sí va en el Excel; aquí no se puede dibujar') });
    } else if (tipo === 'sp') {
      const cuerpo = (x.match(/<xdr:txBody>([\s\S]*?)<\/xdr:txBody>/) || ['', ''])[1];
      const body = (cuerpo.match(/<a:bodyPr\b[^>]*>/) || [''])[0];
      const parrafos = [...cuerpo.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((p) => {
        const rpr = (p[1].match(/<a:rPr\b[^>]*>/) || p[1].match(/<a:endParaRPr\b[^>]*>/) || [''])[0];
        return { texto: textoDe(p[1]), b: attr(rpr, 'b') === '1', sz: (num(rpr, 'sz') || 1100) / 100, algn: attr((p[1].match(/<a:pPr\b[^>]*>/) || [''])[0], 'algn') || 'l' };
      });
      const sp = (x.match(/<xdr:spPr\b[^>]*>([\s\S]*?)<\/xdr:spPr>/) || ['', ''])[1];
      const geom = attr((sp.match(/<a:prstGeom\b[^>]*>/) || [''])[0], 'prst') || '';
      const lnTag = (sp.match(/<a:ln\b[^>]*?(?:\/>|>([\s\S]*?)<\/a:ln>)/) || []);
      const conBorde = !!lnTag[0] && !/<a:noFill\/>/.test(lnTag[1] || '');
      const relleno = /<a:solidFill>/.test(sp.replace(/<a:ln[\s\S]*?<\/a:ln>/g, '')) && !/<a:noFill\/>/.test(sp.replace(/<a:ln[\s\S]*?<\/a:ln>/g, ''));
      if (parrafos.some((p) => p.texto.trim()) || conBorde || relleno) {
        textos.push({ ...caja, capa: capa++, parrafos, borde: conBorde, redondo: /roundRect/.test(geom), abajo: attr(body, 'anchor') === 'b', centro: attr(body, 'anchor') === 'ctr' });
      }
    } else if (tipo === 'cxnSp') {
      const f = x.match(/<a:xfrm\b([^>]*)>/);
      lineas.push({ ...caja, capa: capa++, voltearH: f && attr(f[0], 'flipH') === '1', voltearV: f && attr(f[0], 'flipV') === '1' });
    }
  }
  async function grupo(x, caja) {
    const g = (x.match(/<xdr:grpSpPr\b[^>]*>([\s\S]*?)<\/xdr:grpSpPr>/) || ['', ''])[1];
    const off = g.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/); const ext = g.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    const ch = g.match(/<a:chOff x="(-?\d+)" y="(-?\d+)"\/>\s*<a:chExt cx="(\d+)" cy="(\d+)"\/>/);
    const cuerpo = x.replace(/^<xdr:grpSp>[\s\S]*?<\/xdr:grpSpPr>/, '').replace(/<\/xdr:grpSp>$/, '');
    for (const h of hijos(cuerpo)) {
      const fx = h.tipo === 'grpSp' ? (() => { const gg = (h.xml.match(/<xdr:grpSpPr\b[^>]*>([\s\S]*?)<\/xdr:grpSpPr>/) || ['', ''])[1]; const o = gg.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/); const e = gg.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/); return o && e ? { x: +o[1], y: +o[2], cx: +e[1], cy: +e[2] } : null; })() : xfrm(h.xml);
      let c = caja;
      if (fx && ch && +ch[3] > 0 && +ch[4] > 0) {
        c = { x: caja.x + (fx.x - +ch[1]) / +ch[3] * caja.w, y: caja.y + (fx.y - +ch[2]) / +ch[4] * caja.h, w: fx.cx / +ch[3] * caja.w, h: fx.cy / +ch[4] * caja.h };
      } else if (fx && off && ext) {
        c = { x: caja.x + (fx.x - +off[1]) / EMU_PX, y: caja.y + (fx.y - +off[2]) / EMU_PX, w: fx.cx / EMU_PX, h: fx.cy / EMU_PX };
      }
      if (h.tipo === 'grpSp') await grupo(h.xml, c); else await elemento(h.tipo, h.xml, c);
    }
  }
  function hijos(x) {
    const out = []; let i = 0;
    const re = /<xdr:(sp|pic|grpSp|cxnSp|graphicFrame)\b[^>]*>/g;
    while (i < x.length) {
      re.lastIndex = i; const m = re.exec(x); if (!m) break;
      const tipo = m[1]; let prof = 0; let j = m.index;
      const abre = new RegExp('<xdr:' + tipo + '\\b[^>]*>|</xdr:' + tipo + '>', 'g'); abre.lastIndex = m.index;
      let fin = -1; let t;
      while ((t = abre.exec(x))) { if (t[0].startsWith('</')) { prof--; if (prof === 0) { fin = abre.lastIndex; break; } } else if (!t[0].endsWith('/>')) prof++; }
      if (fin < 0) break;
      out.push({ tipo, xml: x.slice(j, fin) }); i = fin;
    }
    return out;
  }
  for (const m of xml.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
    const ancla = m[0]; const caja = cajaAncla(ancla); if (!caja) continue;
    const cuerpo = ancla.replace(/^<xdr:\w+\b[^>]*>/, '').replace(/<\/xdr:\w+>$/, '').replace(/<xdr:(from|to)>[\s\S]*?<\/xdr:\1>/g, '').replace(/<xdr:(pos|ext)\b[^>]*\/>/g, '');
    for (const h of hijos(cuerpo)) { if (h.tipo === 'grpSp') await grupo(h.xml, caja); else await elemento(h.tipo, h.xml, caja); }
  }
  return { imagenes, textos, lineas };
}

/* ── datos ocultos del archivo ──────────────────────────────────────────────── */

async function leerOcultos(zip, workbookXml, hojas, hojasXml = []) {
  const out = [];
  const nombresHojas = hojas.map((h) => h.nombre);
  // Vínculos a otros archivos.
  for (const ruta of Object.keys(zip.files).filter((n) => /^xl\/externalLinks\/_rels\/externalLink\d+\.xml\.rels$/.test(n))) {
    for (const r of relaciones(await texto(zip, ruta)).values()) {
      const usos = hojas.flatMap((h) => h.formulasExternas.map((f) => h.nombre + '!' + f));
      const libroXml = await texto(zip, ruta.replace(/_rels\/(externalLink\d+\.xml)\.rels$/, '$1')) || '';
      const hojasExt = [...libroXml.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => desXml(m[1]));
      const guardados = [...libroXml.matchAll(/<cell r="([A-Z]+\d+)"[^>]*>\s*<v>([^<]*)<\/v>/g)].map((m) => m[1] + ' = ' + desXml(m[2]));
      out.push({ titulo: 'Vínculo a otro archivo', detalle: decodeURIComponent(String(r.target || '').replace(/^file:\/\/\//, ''))
          + (hojasExt.length ? ' · hojas de ese archivo: ' + hojasExt.join(', ') : '')
          + (guardados.length ? ' · valores guardados: ' + guardados.slice(0, 10).join(', ') : ''),
        nota: 'Al abrir el Excel, Excel puede pedir «actualizar vínculos». ' + (usos.length ? 'Lo usan: ' + usos.join(', ') + '.' : 'Ninguna fórmula lo usa.') });
    }
  }
  // Propiedades del documento.
  const core = await texto(zip, 'docProps/core.xml');
  if (core) {
    const campos = { 'dc:creator': 'Autor', 'cp:lastModifiedBy': 'Modificado por', 'dc:title': 'Título', 'dc:subject': 'Asunto', 'cp:keywords': 'Palabras clave', 'dc:description': 'Comentarios', 'cp:category': 'Categoría', 'cp:contentStatus': 'Estado', 'dcterms:created': 'Creado', 'dcterms:modified': 'Modificado', 'cp:lastPrinted': 'Última impresión' };
    const vistos = [];
    for (const [tag, rot] of Object.entries(campos)) {
      const m = core.match(new RegExp('<' + tag + '\\b[^>]*>([^<]*)</' + tag + '>'));
      if (m && m[1].trim()) vistos.push(rot + ': ' + desXml(m[1]).trim());
    }
    if (vistos.length) out.push({ titulo: 'Propiedades del documento', detalle: vistos.join(' · '), nota: 'Se ven en Archivo › Información.' });
  }
  const app = await texto(zip, 'docProps/app.xml');
  if (app) {
    const empresa = (app.match(/<Company>([^<]*)<\/Company>/) || [])[1];
    if (empresa) out.push({ titulo: 'Empresa en las propiedades', detalle: desXml(empresa), nota: 'Se ve en Archivo › Información.' });
    const partes = [...(app.match(/<TitlesOfParts>([\s\S]*?)<\/TitlesOfParts>/) || ['', ''])[1].matchAll(/<vt:lpstr>([^<]*)<\/vt:lpstr>/g)].map((m) => desXml(m[1]));
    const fantasmas = partes.filter((p) => !p.includes('!') && !nombresHojas.includes(p));
    if (fantasmas.length) out.push({ titulo: 'Hojas que ya no existen, nombradas en las propiedades', detalle: fantasmas.join(', '), nota: 'Restos de la plantilla; no se ven en el libro.' });
  }
  const custom = await texto(zip, 'docProps/custom.xml');
  if (custom) {
    const props = [...custom.matchAll(/<property\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/property>/g)].map((m) => desXml(m[1]) + ' = ' + textoDe(m[2].replace(/<vt:(\w+)>([^<]*)<\/vt:\1>/, '<t>$2</t>')));
    if (props.length) out.push({ titulo: 'Propiedades personalizadas', detalle: props.join(' · '), nota: 'Metadatos de SharePoint / Microsoft 365 heredados de la plantilla.' });
  }
  const etiqueta = await texto(zip, 'docMetadata/LabelInfo.xml');
  if (etiqueta) {
    const ids = [...etiqueta.matchAll(/<clbl:label\b[^>]*>/g)].map((m) => 'etiqueta ' + attr(m[0], 'id') + ' · sitio ' + attr(m[0], 'siteId'));
    out.push({ titulo: 'Etiqueta de clasificación (Microsoft Purview)', detalle: ids.join(' · ') || 'presente', nota: 'Marca de sensibilidad del documento heredada de la plantilla.' });
  }
  const itemsCx = Object.keys(zip.files).filter((n) => /^customXml\/item\d+\.xml$/.test(n));
  if (itemsCx.length) out.push({ titulo: 'Datos de SharePoint incrustados', detalle: itemsCx.length + ' bloque(s) customXml', nota: 'Esquema de la biblioteca documental de donde salió la plantilla.' });
  const rotos = [...new Set([...String(workbookXml).matchAll(/<definedName\b[^>]*name="([^"]*)"[^>]*>([^<]*)<\/definedName>/g)].filter((m) => /#REF!/.test(m[2])).map((m) => m[1]))];
  if (rotos.length) out.push({ titulo: 'Nombres definidos rotos (#REF!)', detalle: rotos.join(', '), nota: 'Restos de la plantilla que no apuntan a nada.' });
  const impresoras = [];
  for (const n of Object.keys(zip.files).filter((q) => /^xl\/printerSettings\/.*\.bin$/.test(q))) {
    const b = await zip.file(n).async('uint8array');
    let s = ''; for (let k = 0; k + 1 < Math.min(b.length, 64); k += 2) { const c = b[k] | (b[k + 1] << 8); if (!c) break; s += String.fromCharCode(c); }
    if (s.trim()) impresoras.push(s.trim());
  }
  if (impresoras.length) out.push({ titulo: 'Impresora guardada', detalle: [...new Set(impresoras)].join(', '), nota: 'Configuración de impresión de quien hizo la plantilla.' });
  for (const h of hojas) {
    if (h.fueraDelArea.length) {
      out.push({ titulo: 'Contenido FUERA del área de impresión · ' + h.nombre, detalle: h.fueraDelArea.slice(0, 12).map((c) => c.ref + ': ' + c.texto).join(' · ') + (h.fueraDelArea.length > 12 ? ' · …' : ''),
        nota: h.fueraDelArea.length + ' celda(s) que viajan en el archivo pero no se imprimen.' });
    }
    for (const d of h.dibujosFuera) {
      const que = d.parrafos ? 'Cuadro de texto' : (d.ruta !== undefined ? 'Imagen' : 'Línea');
      const detalle = d.parrafos ? d.parrafos.map((p) => p.texto).join(' / ').slice(0, 160)
        : (d.ruta ? d.ruta.split('/').pop() + ' · ' + Math.round(d.w) + ' × ' + Math.round(d.h) + ' px en la hoja'
          + (d.bytes ? ' · ' + Math.round(d.bytes / 1024) + ' KB' : '') : 'línea dibujada');
      out.push({ titulo: que + (d.parcial ? ' parcialmente' : '') + ' FUERA del área de impresión · ' + h.nombre, detalle,
        nota: d.parcial ? 'Una parte no se imprime, pero viaja completa en el archivo.' : 'No se imprime ni se ve en la hoja, pero viaja en el archivo.',
        miniatura: d.src || null });
    }
    if (h.ocultas.length) out.push({ titulo: 'Filas o columnas ocultas con contenido · ' + h.nombre, detalle: h.ocultas.slice(0, 12).join(' · '), nota: 'No se ven, pero viajan en el archivo.' });
  }
  const comentarios = Object.keys(zip.files).filter((n) => /comments\d*\.xml$|threadedComment/.test(n));
  if (comentarios.length) out.push({ titulo: 'Comentarios', detalle: comentarios.length + ' archivo(s) de comentarios', nota: '' });
  // Restos de hojas borradas (`99 §104`): piezas a las que ya nada llega y
  // textos que ninguna celda usa.
  const nombres = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const rels = new Map();
  for (const n of nombres.filter((q) => /\.rels$/.test(q))) rels.set(n, await texto(zip, n));
  const sueltas = partesSueltas(nombres, (r) => (rels.has(r) ? rels.get(r) : null));
  if (sueltas.length) {
    const partes = []; let miniatura = null;
    for (const n of sueltas) {
      const b = await zip.file(n).async('uint8array');
      partes.push(n.split('/').pop() + ' · ' + (b.length < 1024 ? b.length + ' B' : Math.round(b.length / 1024) + ' KB'));
      if (!miniatura && /\.png$/i.test(n)) miniatura = 'data:image/png;base64,' + await zip.file(n).async('base64');
    }
    out.push({ titulo: 'Piezas del archivo que ninguna hoja usa', detalle: partes.join(' · '), nota: 'Restos de hojas borradas: no se ven, pero viajan en el archivo.', miniatura });
  }
  const sobrantes = textosSobrantes(await texto(zip, 'xl/sharedStrings.xml'), hojasXml);
  if (sobrantes.length) {
    out.push({ titulo: 'Textos guardados que ninguna celda usa', detalle: sobrantes.slice(0, 12).map((x) => desXml(x.texto)).join(' · ') + (sobrantes.length > 12 ? ' · …' : ''),
      nota: sobrantes.length + ' texto(s) de hojas borradas que viajan en el archivo.' });
  }
  const carpeta = (String(workbookXml).match(/<x15ac:absPath\b[^>]*url="([^"]*)"/) || [])[1];
  if (carpeta) out.push({ titulo: 'Carpeta de quien guardó el archivo', detalle: desXml(carpeta), nota: 'Ruta del computador donde se guardó la plantilla.' });
  return out;
}

/**
 * Lee el libro para la vista previa. PURA (sin DOM).
 * @param {object} zip  instancia de JSZip ya cargada con el .xlsx
 */
export async function leerLibroParaVista(zip) {
  const wb = await texto(zip, 'xl/workbook.xml');
  const relsWb = relaciones(await texto(zip, 'xl/_rels/workbook.xml.rels'));
  const compartidos = [...String(await texto(zip, 'xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => textoDe(m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')));
  const tema = paleta(await texto(zip, 'xl/theme/theme1.xml'));
  const estilos = leerEstilos(await texto(zip, 'xl/styles.xml'), tema);
  const defs = [...String(wb).matchAll(/<sheet\b[^>]*>/g)].map((m, indice) => ({
    nombre: desXml(attr(m[0], 'name')), oculta: !!attr(m[0], 'state') && attr(m[0], 'state') !== 'visible', indice,
    ruta: 'xl/' + String((relsWb.get(attr(m[0], 'r:id')) || {}).target || '').replace(/^\/?xl\//, '')
  }));
  // Celdas de todas las hojas, para calcular fórmulas entre hojas.
  const xmls = {}; const celdasPorHoja = {};
  for (const d of defs) { xmls[d.nombre] = await texto(zip, d.ruta) || ''; celdasPorHoja[d.nombre] = leerHojaCeldas(xmls[d.nombre], compartidos); }
  const enCurso = new Set();
  function valorDe(hoja, ref) {
    const c = celdasPorHoja[hoja] && celdasPorHoja[hoja].get(ref);
    if (!c) return undefined;
    if (!c.formula || c.tieneValor) return c.valor;
    const k = hoja + '!' + ref;
    if (enCurso.has(k)) return '#REF!';
    enCurso.add(k);
    // Lo que depende (aunque sea de segunda mano) de otro archivo se marca igual:
    // su valor en Excel lo pone ese otro archivo, no este.
    let tocaExterna = false;
    const r = calcularFormula(c.formula, hoja, (h, rf) => {
      const v = valorDe(h, rf);
      const cc = celdasPorHoja[h] && celdasPorHoja[h].get(rf);
      if (cc && cc.calculo && cc.calculo.externa) tocaExterna = true;
      return v;
    });
    if (tocaExterna) { r.externa = true; r.valor = null; delete r.error; }
    enCurso.delete(k);
    c.calculo = r;
    return r.externa ? undefined : (r.error ? '#¿?' : r.valor);
  }
  const hojas = [];
  for (const d of defs) {
    const xml = xmls[d.nombre]; const geo = geometria(xml); const area = areaImpresion(wb, d.indice, d.nombre, xml);
    const merges = [...xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g)].map((m) => { const p = refPartes(m[1]); const q = refPartes(m[2]); return { c0: p.c, r0: p.r, c1: q.c, r1: q.r }; });
    const cubierta = new Map();
    for (const g of merges) for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) cubierta.set(colLetras(c) + (r + 1), g);
    const ox = geo.X(area.c0); const oy = geo.Y(area.r0);
    const celdas = []; const fueraDelArea = []; const ocultas = []; const formulasExternas = [];
    for (const c of celdasPorHoja[d.nombre].values()) {
      const p = refPartes(c.ref);
      let valor = c.formula && !c.tieneValor ? valorDe(d.nombre, c.ref) : c.valor;
      if (c.formula && /\[\d+\]/.test(c.formula)) formulasExternas.push(c.ref);
      const xf = estilos.xfs[c.estilo] || estilos.xfs[0] || {};
      const txt = valor == null ? '' : formatearValor(valor, estilos.formatos[xf.formato], xf.formato);
      const dentro = p.c >= area.c0 && p.c <= area.c1 && p.r >= area.r0 && p.r <= area.r1;
      if (!dentro) { if (String(txt).trim() || c.formula) fueraDelArea.push({ ref: c.ref, texto: String(txt || ('=' + c.formula)).slice(0, 60) }); continue; }
      const g = cubierta.get(c.ref);
      if (g && (g.c0 !== p.c || g.r0 !== p.r)) continue;
      const c1 = g ? g.c1 : p.c; const r1 = g ? g.r1 : p.r;
      const w = geo.X(c1 + 1) - geo.X(p.c); const h = geo.Y(r1 + 1) - geo.Y(p.r);
      if ((w === 0 || h === 0) && String(txt).trim()) ocultas.push(c.ref + ': ' + String(txt).slice(0, 40));
      const fuente = estilos.fuentes[xf.fuente] || {}; const borde = estilos.bordes[xf.borde] || {};
      const relleno = estilos.rellenos[xf.relleno] || null;
      if (!String(txt).trim() && !relleno && !borde.t && !borde.r && !borde.b && !borde.l) continue;
      celdas.push({
        ref: c.ref, x: geo.X(p.c) - ox, y: geo.Y(p.r) - oy, w, h, texto: String(txt),
        formula: c.formula, externa: !!(c.calculo && c.calculo.externa), sinCalculo: !!(c.calculo && c.calculo.error),
        b: !!fuente.b, i: !!fuente.i, sz: fuente.sz || 11, color: fuente.color || '#000', relleno,
        alH: xf.h || (typeof valor === 'number' ? 'right' : 'left'), alV: xf.v || 'bottom', envolver: !!xf.envolver, borde
      });
    }
    const relsH = relaciones(await texto(zip, d.ruta.replace(/worksheets\/(sheet\d+\.xml)$/, 'worksheets/_rels/$1.rels')));
    let dibujo = { imagenes: [], textos: [], lineas: [] };
    for (const r of relsH.values()) if (/\/drawing$/.test(r.tipo)) dibujo = await leerDibujo(zip, resolverRuta(d.ruta, r.target), geo);
    const mover = (o) => ({ ...o, x: o.x - ox, y: o.y - oy });
    const ancho = geo.X(area.c1 + 1) - ox; const alto = geo.Y(area.r1 + 1) - oy;
    // Lo dibujado FUERA del área de impresión no se imprime ni se ve en la hoja,
    // pero viaja en el archivo (revisión de §102: una captura de UPME en Beneficios
    // y en Anexo AT). Se aparta y se reporta en «Datos ocultos».
    const dibujosFuera = [];
    const dentroDe = (o) => {
      const iw = Math.min(o.x + o.w, ancho) - Math.max(o.x, 0); const ih = Math.min(o.y + o.h, alto) - Math.max(o.y, 0);
      const inter = Math.max(0, iw) * Math.max(0, ih); const total = Math.max(1, o.w * o.h);
      if (inter <= 0) { dibujosFuera.push({ ...o, parcial: false }); return false; }
      if (inter / total < 0.9) dibujosFuera.push({ ...o, parcial: true });
      return true;
    };
    const imagenes = dibujo.imagenes.map(mover).filter(dentroDe);
    const textos = dibujo.textos.map(mover).filter(dentroDe);
    const lineas = dibujo.lineas.map(mover).filter(dentroDe);
    hojas.push({
      nombre: d.nombre, oculta: d.oculta, area: colLetras(area.c0) + (area.r0 + 1) + ':' + colLetras(area.c1) + (area.r1 + 1), areaDefinida: area.definida,
      ancho, alto, celdas, imagenes, textos, lineas,
      fueraDelArea, dibujosFuera, ocultas, formulasExternas
    });
  }
  const ocultos = await leerOcultos(zip, wb, hojas, Object.values(xmls));
  for (const h of hojas.filter((q) => q.oculta)) ocultos.unshift({ titulo: 'Hoja oculta', detalle: h.nombre, nota: 'Viaja en el archivo aunque no se vea.' });
  return { hojas, ocultos };
}

/* ── la ventana ─────────────────────────────────────────────────────────────── */

function el(tag, clase, txt) { const e = document.createElement(tag); if (clase) e.className = clase; if (txt != null) e.textContent = txt; return e; }

function pintarLinea(l) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'vpx-linea'); Object.assign(svg.style, { left: l.x + 'px', top: l.y + 'px', width: Math.max(1, l.w) + 'px', height: Math.max(1, l.h) + 'px' });
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const [x1, x2] = l.voltearH ? ['100%', '0'] : ['0', '100%']; const [y1, y2] = l.voltearV ? ['100%', '0'] : ['0', '100%'];
  ln.setAttribute('x1', x1); ln.setAttribute('x2', x2); ln.setAttribute('y1', y1); ln.setAttribute('y2', y2);
  ln.setAttribute('stroke', '#555'); ln.setAttribute('stroke-width', '1'); svg.appendChild(ln);
  return svg;
}
function pintarTexto(t) {
  const d = el('div', 'vpx-texto' + (t.borde ? ' vpx-texto--borde' : '') + (t.redondo ? ' vpx-texto--redondo' : ''));
  Object.assign(d.style, { left: t.x + 'px', top: t.y + 'px', width: t.w + 'px', height: t.h + 'px', justifyContent: t.abajo ? 'flex-end' : (t.centro ? 'center' : 'flex-start') });
  for (const p of t.parrafos) {
    const q = el('div', 'vpx-parrafo', p.texto || '\u00a0');
    Object.assign(q.style, { fontWeight: p.b ? '700' : '400', fontSize: (p.sz * PT_PX).toFixed(1) + 'px', textAlign: { ctr: 'center', r: 'right' }[p.algn] || 'left' });
    d.appendChild(q);
  }
  return d;
}
function pintarImagen(im) {
  const d = im.src ? el('img', 'vpx-img') : el('div', 'vpx-img vpx-img--nota', im.nota);
  if (im.src) { d.src = im.src; d.alt = im.ruta; }
  Object.assign(d.style, { left: im.x + 'px', top: im.y + 'px', width: im.w + 'px', height: im.h + 'px' });
  return d;
}

function pintarHoja(h) {
  const hoja = el('div', 'vpx-hoja');
  hoja.style.width = h.ancho + 'px'; hoja.style.height = h.alto + 'px';
  for (const c of h.celdas) {
    const d = el('div', 'vpx-celda');
    Object.assign(d.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px',
      fontWeight: c.b ? '700' : '400', fontStyle: c.i ? 'italic' : 'normal', fontSize: (c.sz * PT_PX).toFixed(1) + 'px', color: c.color,
      background: c.relleno || 'transparent', justifyContent: { center: 'center', centerContinuous: 'center', right: 'flex-end' }[c.alH] || 'flex-start',
      textAlign: { center: 'center', centerContinuous: 'center', right: 'right', justify: 'justify' }[c.alH] || 'left',
      alignItems: { top: 'flex-start', center: 'center' }[c.alV] || 'flex-end', whiteSpace: c.envolver ? 'pre-wrap' : 'pre' });
    for (const [lado, css] of [['t', 'borderTop'], ['r', 'borderRight'], ['b', 'borderBottom'], ['l', 'borderLeft']]) {
      if (c.borde[lado]) d.style[css] = c.borde[lado].grueso + 'px solid ' + c.borde[lado].color;
    }
    const s = el('span', null, c.texto); d.appendChild(s);
    if (c.externa) { d.classList.add('vpx-externa'); d.title = 'Fórmula que depende de OTRO archivo: =' + c.formula; s.textContent = '⚠ vínculo externo'; }
    else if (c.formula) d.title = '=' + c.formula;
    hoja.appendChild(d);
  }
  // Lo dibujado va ENCIMA de las celdas y en el orden del documento: lo que la
  // plantilla manda al fondo (los huecos blancos de `§89`) no tapa los textos.
  const dibujados = [
    ...h.lineas.map((o) => ({ ...o, tipo: 'linea' })), ...h.textos.map((o) => ({ ...o, tipo: 'texto' })),
    ...h.imagenes.map((o) => ({ ...o, tipo: 'imagen' }))
  ].sort((a, b) => (a.capa ?? 0) - (b.capa ?? 0));
  for (const o of dibujados) hoja.appendChild(o.tipo === 'linea' ? pintarLinea(o) : (o.tipo === 'texto' ? pintarTexto(o) : pintarImagen(o)));
  return hoja;
}

/** Estilos mínimos para imprimir las hojas (los mismos de la vista, sin la ventana). */
const CSS_IMPRESION = `
@page { size: letter portrait; margin: 8mm; }
@page horizontal { size: letter landscape; margin: 8mm; }
html, body { margin: 0; background: #fff; }
.vpx-pagina { position: relative; page-break-after: always; break-after: page; overflow: hidden; }
.vpx-pagina > .vpx-hoja { position: absolute; left: 0; top: 0; }
.vpx-pagina:last-child { page-break-after: auto; break-after: auto; }
.vpx-pagina--h { page: horizontal; }
.vpx-hoja { position: relative; background: #fff; transform-origin: 0 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
.vpx-celda { position: absolute; display: flex; box-sizing: border-box; padding: 0 2px; overflow: hidden; line-height: 1.15; }
.vpx-celda > span { max-width: 100%; }
.vpx-externa { background: #fff1c2 !important; color: #8a5a00 !important; font-weight: 700; }
.vpx-texto { position: absolute; display: flex; flex-direction: column; box-sizing: border-box; padding: 3px 6px; overflow: hidden; line-height: 1.2; }
.vpx-texto--borde { border: 1px solid #555; }
.vpx-texto--redondo { border-radius: 10px; }
.vpx-parrafo { white-space: pre-wrap; }
.vpx-img { position: absolute; object-fit: fill; }
.vpx-img--nota { display: flex; align-items: center; justify-content: center; border: 1px dashed #9aa6b5; color: #6b7785; font-size: 10px; }
.vpx-linea { position: absolute; overflow: visible; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * Imprime las hojas visibles (una por página, vertical u horizontal según su forma)
 * en un marco aparte: el navegador ofrece «Guardar como PDF». No toca la página.
 */
export function imprimirHojas(modelo, titulo) {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  Object.assign(marco.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(marco);
  const doc = marco.contentDocument;
  doc.open(); doc.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title></title></head><body></body></html>'); doc.close();
  doc.title = 'Ficha técnica PE.02081 · ' + String(titulo || '');
  const st = doc.createElement('style'); st.textContent = CSS_IMPRESION; doc.head.appendChild(st);
  // Ancho útil de la página en px (96 ppp): carta menos márgenes.
  const ANCHO_V = (215.9 - 16) / 25.4 * 96; const ALTO_V = (279.4 - 16) / 25.4 * 96;
  for (const h of modelo.hojas.filter((q) => !q.oculta)) {
    const horizontal = h.ancho > h.alto;
    const [W, H] = horizontal ? [ALTO_V, ANCHO_V] : [ANCHO_V, ALTO_V];
    const k = Math.min(W / h.ancho, H / h.alto);
    const pagina = doc.createElement('div');
    pagina.className = 'vpx-pagina' + (horizontal ? ' vpx-pagina--h' : '');
    // Tamaño EXACTO de la página: si la hoja sin escalar sobresale, Chrome encoge
    // todo el documento para que quepa y cada página sale diminuta.
    pagina.style.width = Math.floor(h.ancho * k) + 'px';
    pagina.style.height = Math.floor(h.alto * k) + 'px';
    const hoja = doc.importNode(pintarHoja(h), true);
    // `zoom` (no `transform`): cambia también el tamaño que usa el diseño de la
    // página; con `transform` la hoja seguía «midiendo» su ancho original y Chrome
    // encogía el documento entero al imprimir.
    hoja.style.zoom = String(k);
    pagina.appendChild(hoja);
    doc.body.appendChild(pagina);
  }
  const imprimir = () => {
    try { marco.contentWindow.focus(); marco.contentWindow.print(); } finally { setTimeout(() => marco.remove(), 1500); }
  };
  // Espera a que carguen las imágenes (firmas, diagramas) antes de imprimir.
  const imgs = [...doc.images];
  Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))).then(() => setTimeout(imprimir, 100));
}

/**
 * Muestra la vista previa en una ventana propia.
 * @param {{hojas: Array, ocultos: Array}} modelo  de leerLibroParaVista
 * @param {{titulo: string, avisos?: string[], alCerrar?: Function, contenedor?: HTMLElement}} opciones
 *        `contenedor`: dentro de la ventana de la ficha, para que su trampa de foco
 *        la incluya (fuera, el Tab devolvía el foco a la ficha).
 */
export function mostrarVistaPrevia(modelo, opciones = {}) {
  const previa = document.querySelector('.vpx-fondo'); if (previa) previa.remove();
  const fondo = el('div', 'vpx-fondo');
  const ventana = el('div', 'vpx-ventana'); ventana.setAttribute('role', 'dialog'); ventana.setAttribute('aria-modal', 'true');
  ventana.setAttribute('aria-label', 'Vista previa del Excel');
  const cab = el('div', 'vpx-cab');
  const tit = el('div', 'vpx-titulo'); tit.appendChild(el('strong', null, 'Vista previa del Excel')); tit.appendChild(el('span', null, opciones.titulo || ''));
  const cerrar = el('button', 'ftm-btn', 'Cerrar'); cerrar.type = 'button';
  // PDF (pedido del Ingeniero, 2026-09-25): como el informe de refrigeración, por el
  // cuadro de impresión del navegador («Guardar como PDF»): una hoja por página.
  const pdf = el('button', 'ftm-btn', 'Imprimir / Guardar PDF'); pdf.type = 'button';
  pdf.addEventListener('click', () => imprimirHojas(modelo, opciones.titulo || ''));
  const acciones = el('div', 'vpx-acciones'); acciones.append(pdf, cerrar);
  cab.append(tit, acciones);
  const avisos = el('div', 'vpx-avisos');
  for (const a of (opciones.avisos || [])) avisos.appendChild(el('p', null, a));
  const pestanas = el('div', 'vpx-pestanas'); pestanas.setAttribute('role', 'tablist');
  const cuerpo = el('div', 'vpx-cuerpo');
  const vistas = [...modelo.hojas.map((h) => ({ nombre: h.nombre + (h.oculta ? ' (oculta)' : ''), hoja: h })), { nombre: 'Datos ocultos del archivo (' + modelo.ocultos.length + ')', ocultos: true }];
  function mostrar(i) {
    [...pestanas.children].forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.classList.toggle('vpx-pestana--activa', k === i); });
    cuerpo.textContent = '';
    const v = vistas[i];
    if (v.ocultos) {
      const lista = el('div', 'vpx-ocultos');
      lista.appendChild(el('p', 'vpx-ocultos-intro', 'Lo que viaja dentro del archivo y no se ve en las hojas. El sistema quita estos datos al generar el Excel: esta lista debe quedar vacía.'));
      if (!modelo.ocultos.length) lista.appendChild(el('p', null, 'El archivo no lleva datos ocultos.'));
      for (const o of modelo.ocultos) {
        const it = el('div', 'vpx-oculto'); it.appendChild(el('strong', null, o.titulo)); it.appendChild(el('div', 'vpx-oculto-detalle', o.detalle));
        if (o.nota) it.appendChild(el('div', 'vpx-oculto-nota', o.nota));
        if (o.miniatura && /^data:image\/(png|jpeg|gif);base64,/.test(o.miniatura)) {
          const im = el('img', 'vpx-oculto-img'); im.src = o.miniatura; im.alt = o.titulo; it.appendChild(im);
        }
        lista.appendChild(it);
      }
      cuerpo.appendChild(lista);
      return;
    }
    const marco = el('div', 'vpx-marco'); const hoja = pintarHoja(v.hoja); marco.appendChild(hoja); cuerpo.appendChild(marco);
    const pie = el('p', 'vpx-pie', 'Área de impresión ' + v.hoja.area + (v.hoja.areaDefinida ? '' : ' (sin área definida: se muestra todo lo usado)') + '. Pase el cursor sobre una celda calculada para ver su fórmula.');
    cuerpo.appendChild(pie);
    const ajustar = () => { const k = Math.min(1, (marco.clientWidth - 8) / v.hoja.ancho); hoja.style.transform = 'scale(' + k + ')'; marco.style.height = Math.ceil(v.hoja.alto * k) + 8 + 'px'; };
    requestAnimationFrame(ajustar);
  }
  vistas.forEach((v, i) => {
    const b = el('button', 'vpx-pestana', v.nombre); b.type = 'button'; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => mostrar(i)); pestanas.appendChild(b);
  });
  ventana.append(cab, avisos, pestanas, cuerpo);
  fondo.appendChild(ventana);
  (opciones.contenedor || document.body).appendChild(fondo);
  // Esc en `window` (captura): corre ANTES que la trampa de foco de la ficha, que
  // escucha en `document` y cerraría la ficha entera.
  const cerrarTodo = () => { window.removeEventListener('keydown', teclas, true); fondo.remove(); if (typeof opciones.alCerrar === 'function') opciones.alCerrar(); };
  function teclas(ev) { if (ev.key === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); cerrarTodo(); } }
  window.addEventListener('keydown', teclas, true);
  cerrar.addEventListener('click', cerrarTodo);
  fondo.addEventListener('click', (ev) => { if (ev.target === fondo) cerrarTodo(); });
  mostrar(0);
  cerrar.focus();
  return { cerrar: cerrarTodo };
}
