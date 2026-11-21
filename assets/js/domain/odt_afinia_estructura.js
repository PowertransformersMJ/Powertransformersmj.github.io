// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · revisión ESTRUCTURAL de las casillas (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Segunda defensa (comité W-11: seg[9] y arq[11]; revisión del 20-11, lente comp)
// contra un v0 que ya trae algo en una casilla. La primera es la TINTA medida en
// el raster de pdf.js (odt_afinia_casilla.js), que solo existe en el navegador.
// Esta lee el CONTENIDO de la última página con pdf-lib (INYECTADO) y marca la
// casilla como ocupada si dentro de su rectángulo de revisión (la caja reducida
// 2 pt, la misma de la tinta) cae:
//   · una IMAGEN (operador `Do` de un XObject /Image, o imagen en línea BI…ID…EI),
//     con su cuadro unidad llevado por la CTM;
//   · algo pintado por un Form XObject (`Do` de un /Form): se recorre su contenido
//     con su /Matrix y la CTM (hasta PROFUNDIDAD_MAX niveles);
//   · un TRAZO o RELLENO oscuro (m/l/c/v/y/re + S/s/f/F/f*/B/B*/b/b*), con la CTM
//     aplicada, el estado guardado y restaurado con q/Q y el color de pintura
//     (lo que es más claro que LUMA_TINTA, como un fondo blanco, no cuenta);
//   · el ORIGEN de un texto visible (Tj/TJ/'/" con Tm × CTM), p. ej. una «X»;
//   · una ANOTACIÓN de la página (/Annots, cualquier /Subtype) cuyo /Rect la toca.
// Si algo no se puede leer, NO se da por vacía: `ok:false` con `error` (como la
// tinta «sinMedir»). Las líneas de la celda quedan fuera: el rectángulo de
// revisión está 2 pt adentro del borde.
// Probado en Node con PDF sintéticos (tests/odt_afinia_estructura.test.js).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CLAVES_ZONA } from './odt_afinia_zonas.js';
import { rectTinta, LUMA_TINTA } from './odt_afinia_casilla.js';

/** Niveles de Form XObject anidados que se recorren (más es raro y se trata como ilegible). */
export const PROFUNDIDAD_MAX = 6;
/** Puntos con que se aproxima cada curva de Bézier. */
const MUESTRAS_CURVA = 8;

// ── Geometría (puntos PDF) ─────────────────────────────────────────────────────
const IDENTIDAD = Object.freeze([1, 0, 0, 1, 0, 0]);
/** M × N (primero M, después N), matrices PDF [a b c d e f]. */
export function multiplicar(m, n) {
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]
  ];
}
export const aplicar = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const dentro = (p, r) => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;

/** ¿El segmento p-q toca el rectángulo r? (Liang–Barsky, bordes incluidos). */
export function segmentoToca(p, q, r) {
  let t0 = 0; let t1 = 1;
  const dx = q[0] - p[0]; const dy = q[1] - p[1];
  const lados = [[-dx, p[0] - r.x], [dx, r.x + r.w - p[0]], [-dy, p[1] - r.y], [dy, r.y + r.h - p[1]]];
  for (const [pp, qq] of lados) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

function puntoEnPoligono(pt, poli) {
  let adentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i]; const [xj, yj] = poli[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}

/** ¿Un trazo (polilínea) pasa por r? */
function lineaToca(puntos, r) {
  if (puntos.length === 1) return dentro(puntos[0], r);
  for (let i = 1; i < puntos.length; i++) if (segmentoToca(puntos[i - 1], puntos[i], r)) return true;
  return false;
}
/** ¿Un relleno (polígono cerrado) toca r? (borde que entra o r adentro del polígono). */
export function poligonoToca(poli, r) {
  if (!poli.length) return false;
  if (lineaToca([...poli, poli[0]], r)) return true;
  return poli.length >= 3 && puntoEnPoligono([r.x + r.w / 2, r.y + r.h / 2], poli);
}

// ── Lector de content streams (solo lo necesario para ubicar lo que se pinta) ──
const BLANCO = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

/**
 * Ítems del contenido: operandos (num, name, str, arr) y operadores ({op}).
 * Las imágenes en línea (BI … ID datos EI) salen como un solo {op:'EI'}.
 * @param {Uint8Array} b
 */
export function leerContenido(b) {
  const out = [];
  const n = b.length;
  let i = 0;
  const pila = [];          // arreglos/diccionarios abiertos
  const emitir = (x) => { if (pila.length) pila[pila.length - 1].push(x); else out.push(x); };
  while (i < n) {
    const c = b[i];
    if (BLANCO.has(c)) { i++; continue; }
    if (c === 0x25) { while (i < n && b[i] !== 0x0a && b[i] !== 0x0d) i++; continue; }        // % comentario
    if (c === 0x28) {                                                                          // ( cadena )
      let prof = 1; i++;
      while (i < n && prof > 0) {
        if (b[i] === 0x5c) { i += 2; continue; }
        if (b[i] === 0x28) prof++; else if (b[i] === 0x29) prof--;
        i++;
      }
      emitir({ t: 'str' }); continue;
    }
    if (c === 0x3c && b[i + 1] === 0x3c) { pila.push([]); i += 2; continue; }                // <<
    if (c === 0x3e && b[i + 1] === 0x3e) { const d = pila.pop() || []; emitir({ t: 'dict', v: d }); i += 2; continue; }
    if (c === 0x3c) { while (i < n && b[i] !== 0x3e) i++; i++; emitir({ t: 'str' }); continue; } // <hex>
    if (c === 0x5b) { pila.push([]); i++; continue; }
    if (c === 0x5d) { const a = pila.pop() || []; emitir({ t: 'arr', v: a }); i++; continue; }
    if (c === 0x7b || c === 0x7d) { i++; continue; }
    if (c === 0x2f) {                                                                          // /nombre
      let j = i + 1;
      while (j < n && !BLANCO.has(b[j]) && !DELIM.has(b[j])) j++;
      emitir({ t: 'name', v: nombrePdf(b, i + 1, j) }); i = j; continue;
    }
    let j = i;
    while (j < n && !BLANCO.has(b[j]) && !DELIM.has(b[j])) j++;
    if (j === i) { i++; continue; }
    const pal = latin1(b, i, j);
    i = j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(pal)) { emitir({ t: 'num', v: Number(pal) }); continue; }
    if (pal === 'true' || pal === 'false' || pal === 'null') { emitir({ t: 'kw' }); continue; }
    if (pal === 'ID') {
      // Datos binarios de la imagen en línea: hasta «EI» rodeado de blancos.
      i++;
      while (i < n && !(b[i] === 0x45 && b[i + 1] === 0x49 && BLANCO.has(b[i - 1]) && (i + 2 >= n || BLANCO.has(b[i + 2]) || DELIM.has(b[i + 2])))) i++;
      i += 2;
      pila.length = 0;
      out.push({ op: 'EI' });
      continue;
    }
    if (pila.length) continue;   // palabra suelta dentro de un arreglo/diccionario: no es operador
    out.push({ op: pal });
  }
  return out;
}
function latin1(b, i, j) { let s = ''; for (let k = i; k < j; k++) s += String.fromCharCode(b[k]); return s; }
function nombrePdf(b, i, j) {
  return latin1(b, i, j).replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// ── Color de pintura → luminancia 0-255 (lo desconocido cuenta como oscuro) ────
function luma(nums) {
  if (!nums.length || nums.some((x) => !Number.isFinite(x))) return 0;
  if (nums.length === 1) return 255 * nums[0];
  if (nums.length === 3) return 255 * (0.299 * nums[0] + 0.587 * nums[1] + 0.114 * nums[2]);
  if (nums.length === 4) {
    const k = nums[3];
    return 255 * (0.299 * (1 - nums[0]) * (1 - k) + 0.587 * (1 - nums[1]) * (1 - k) + 0.114 * (1 - nums[2]) * (1 - k));
  }
  return 0;
}

// ── Recorrido ──────────────────────────────────────────────────────────────────
/**
 * Recorre el contenido y llama a `marcar(motivo, forma)` por cada cosa pintada:
 * forma = {tipo:'linea'|'poligono'|'punto', puntos} en puntos PDF de la página.
 */
function recorrer(bytes, ctmBase, recursos, ctx, prof) {
  if (prof > PROFUNDIDAD_MAX) throw new Error('demasiados formularios anidados');
  const { marcar } = ctx;
  let st = { ctm: ctmBase.slice(), relleno: 0, trazo: 0, tr: 0, tl: 0 };
  const guardados = [];
  let ops = [];
  let subtrayectos = []; let actual = null; let pos = null;
  let tm = IDENTIDAD.slice(); let tlm = IDENTIDAD.slice();
  const nums = () => ops.filter((o) => o.t === 'num').map((o) => o.v);
  const P = (x, y) => aplicar(st.ctm, x, y);
  const nuevo = (x, y) => { actual = { puntos: [P(x, y)], cerrado: false }; subtrayectos.push(actual); pos = [x, y]; };
  const a = (x, y) => { if (!actual) nuevo(pos ? pos[0] : x, pos ? pos[1] : y); actual.puntos.push(P(x, y)); pos = [x, y]; };
  const curva = (p0, p1, p2, p3) => {
    for (let k = 1; k <= MUESTRAS_CURVA; k++) {
      const t = k / MUESTRAS_CURVA; const u = 1 - t;
      a(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
    }
  };
  const pintar = (rellena, traza) => {
    for (const s of subtrayectos) {
      if (rellena && st.relleno < ctx.umbralLuma) marcar('trazo', { tipo: 'poligono', puntos: s.puntos });
      if (traza && st.trazo < ctx.umbralLuma) marcar('trazo', { tipo: 'linea', puntos: s.cerrado ? [...s.puntos, s.puntos[0]] : s.puntos });
    }
    subtrayectos = []; actual = null;
  };
  const cuadroUnidad = (motivo) => marcar(motivo, { tipo: 'poligono', puntos: [P(0, 0), P(1, 0), P(1, 1), P(0, 1)] });
  const texto = () => {
    if (st.tr === 3 || st.tr === 7 || st.relleno >= ctx.umbralLuma) return;
    marcar('texto', { tipo: 'punto', puntos: [aplicar(multiplicar(tm, st.ctm), 0, 0)] });
  };
  const td = (x, y) => { tlm = multiplicar([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); };

  for (const it of leerContenido(bytes)) {
    if (!it.op) { ops.push(it); continue; }
    const v = nums();
    switch (it.op) {
      case 'q': guardados.push({ ...st, ctm: st.ctm.slice() }); break;
      case 'Q': if (guardados.length) st = guardados.pop(); break;
      case 'cm': if (v.length >= 6) st.ctm = multiplicar(v.slice(-6), st.ctm); break;
      case 'g': st.relleno = luma(v.slice(-1)); break;
      case 'G': st.trazo = luma(v.slice(-1)); break;
      case 'rg': st.relleno = luma(v.slice(-3)); break;
      case 'RG': st.trazo = luma(v.slice(-3)); break;
      case 'k': st.relleno = luma(v.slice(-4)); break;
      case 'K': st.trazo = luma(v.slice(-4)); break;
      case 'sc': case 'scn': st.relleno = ops.some((o) => o.t === 'name') ? 0 : luma(v); break;
      case 'SC': case 'SCN': st.trazo = ops.some((o) => o.t === 'name') ? 0 : luma(v); break;
      case 'cs': st.relleno = 0; break;
      case 'CS': st.trazo = 0; break;
      case 'm': if (v.length >= 2) nuevo(v[v.length - 2], v[v.length - 1]); break;
      case 'l': if (v.length >= 2) a(v[v.length - 2], v[v.length - 1]); break;
      case 'c': if (v.length >= 6 && pos) { const [x1, y1, x2, y2, x3, y3] = v.slice(-6); curva(pos, [x1, y1], [x2, y2], [x3, y3]); } break;
      case 'v': if (v.length >= 4 && pos) { const [x2, y2, x3, y3] = v.slice(-4); curva(pos, pos, [x2, y2], [x3, y3]); } break;
      case 'y': if (v.length >= 4 && pos) { const [x1, y1, x3, y3] = v.slice(-4); curva(pos, [x1, y1], [x3, y3], [x3, y3]); } break;
      case 're': if (v.length >= 4) {
        const [x, y, w, hh] = v.slice(-4);
        nuevo(x, y); a(x + w, y); a(x + w, y + hh); a(x, y + hh); actual.cerrado = true; pos = [x, y]; actual = null;
      } break;
      case 'h': if (actual) { actual.cerrado = true; if (actual.puntos.length) { pos = null; } actual = null; } break;
      case 'S': pintar(false, true); break;
      case 's': for (const s of subtrayectos) s.cerrado = true; pintar(false, true); break;
      case 'f': case 'F': case 'f*': pintar(true, false); break;
      case 'B': case 'B*': pintar(true, true); break;
      case 'b': case 'b*': for (const s of subtrayectos) s.cerrado = true; pintar(true, true); break;
      case 'n': subtrayectos = []; actual = null; break;
      case 'BT': tm = IDENTIDAD.slice(); tlm = IDENTIDAD.slice(); break;
      case 'Tm': if (v.length >= 6) { tm = v.slice(-6); tlm = tm.slice(); } break;
      case 'Td': if (v.length >= 2) td(v[v.length - 2], v[v.length - 1]); break;
      case 'TD': if (v.length >= 2) { st.tl = -v[v.length - 1]; td(v[v.length - 2], v[v.length - 1]); } break;
      case 'TL': if (v.length) st.tl = v[v.length - 1]; break;
      case 'T*': td(0, -st.tl); break;
      case 'Tr': if (v.length) st.tr = v[v.length - 1]; break;
      case 'Tj': case 'TJ': texto(); break;
      case "'": td(0, -st.tl); texto(); break;
      case '"': td(0, -st.tl); texto(); break;
      case 'EI': cuadroUnidad('imagen'); break;
      case 'Do': {
        const nombre = [...ops].reverse().find((o) => o.t === 'name');
        if (nombre) ctx.xobjeto(nombre.v, st.ctm, recursos, prof, cuadroUnidad);
        break;
      }
      default: break;
    }
    ops = [];
  }
}

/**
 * Revisión estructural de las casillas en la ÚLTIMA página.
 * @param {Uint8Array} bytes   el v0 (no se modifica: pdf-lib recibe una copia)
 * @param {object} zonas       las derivadas por validarOdt
 * @param {object} PDFLib      pdf-lib inyectado (PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream)
 * @param {{claves?:string[], umbralLuma?:number}} [op]
 * @returns {Promise<{ok:boolean, ocupadas:Array<{clave:string, motivos:string[]}>, error:string|null}>}
 */
export async function revisarEstructura(bytes, zonas, PDFLib, { claves = CLAVES_ZONA, umbralLuma = LUMA_TINTA } = {}) {
  const L = PDFLib || {};
  for (const k of ['PDFDocument', 'PDFName', 'PDFDict', 'PDFArray', 'PDFRawStream', 'decodePDFRawStream']) {
    if (!L[k]) throw new TypeError('Falta pdf-lib (' + k + ').');
  }
  const rects = claves.map((clave) => ({ clave, r: rectTinta(zonas, clave) }));
  const motivos = Object.fromEntries(claves.map((c) => [c, new Set()]));
  const marcar = (motivo, forma) => {
    for (const { clave, r } of rects) {
      const toca = forma.tipo === 'punto' ? dentro(forma.puntos[0], r)
        : forma.tipo === 'linea' ? lineaToca(forma.puntos, r) : poligonoToca(forma.puntos, r);
      if (toca) motivos[clave].add(motivo);
    }
  };
  try {
    const doc = await L.PDFDocument.load(bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes), { updateMetadata: false });
    const ctxPdf = doc.context;
    const N = (s) => L.PDFName.of(s);
    const nums = (arr) => (arr ? arr.asArray().map((x) => Number(ctxPdf.lookup(x).asNumber())) : null);
    const contenidoDe = (obj) => {
      const s = ctxPdf.lookup(obj);
      if (s instanceof L.PDFRawStream) return L.decodePDFRawStream(s).decode();
      if (s && typeof s.getUnencodedContents === 'function') return s.getUnencodedContents();
      if (s && typeof s.getContents === 'function') return s.getContents();
      throw new Error('contenido ilegible');
    };
    const pagina = doc.getPage(doc.getPageCount() - 1);
    const ctx = {
      marcar,
      umbralLuma,
      xobjeto(nombre, ctm, recursos, prof, cuadroUnidad) {
        const dic = recursos && recursos.lookupMaybe(N('XObject'), L.PDFDict);
        const xo = dic && dic.lookup(N(nombre));
        if (!xo || !xo.dict) throw new Error('XObject /' + nombre + ' no encontrado');
        const sub = String(xo.dict.lookup(N('Subtype')));
        if (sub === '/Image') { cuadroUnidad('imagen'); return; }
        if (sub !== '/Form') throw new Error('XObject /' + nombre + ' de tipo ' + sub);
        const matriz = nums(xo.dict.lookupMaybe(N('Matrix'), L.PDFArray)) || IDENTIDAD;
        const propios = xo.dict.lookupMaybe(N('Resources'), L.PDFDict) || recursos;
        const motivoPrevio = ctx.marcar;
        ctx.marcar = (m, f) => motivoPrevio(m === 'trazo' || m === 'texto' || m === 'imagen' ? 'formulario:' + m : m, f);
        try { recorrer(contenidoDe(xo), multiplicar(matriz, ctm), propios, ctx, prof + 1); } finally { ctx.marcar = motivoPrevio; }
      }
    };
    // Contenido de la página (uno o varios streams, que se leen como uno solo).
    const cont = pagina.node.Contents();
    const partes = [];
    if (cont instanceof L.PDFArray) { for (const x of cont.asArray()) partes.push(contenidoDe(x)); } else if (cont) partes.push(contenidoDe(cont));
    const total = new Uint8Array(partes.reduce((s, p) => s + p.length + 1, 0));
    let k = 0; for (const p of partes) { total.set(p, k); k += p.length; total[k++] = 0x0a; }
    recorrer(total, IDENTIDAD, pagina.node.Resources(), ctx, 0);
    // Anotaciones (Fill&Sign, Stamp, Ink, FreeText…): cualquier /Rect que toque la casilla.
    const annots = pagina.node.Annots();
    for (const ref of (annots ? annots.asArray() : [])) {
      const an = ctxPdf.lookup(ref);
      if (!(an instanceof L.PDFDict)) continue;
      const r = nums(an.lookupMaybe(N('Rect'), L.PDFArray));
      if (!r || r.length !== 4) continue;
      const sub = String(an.lookup(N('Subtype')) || '/desconocida').replace(/^\//, '');
      marcar('anotacion:' + sub, { tipo: 'poligono', puntos: [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]] });
    }
  } catch (e) {
    return { ok: false, ocupadas: [], error: 'No se pudo revisar el contenido de la última página (' + ((e && e.message) || 'error') + ').' };
  }
  const ocupadas = claves.filter((c) => motivos[c].size).map((c) => ({ clave: c, motivos: [...motivos[c]].sort() }));
  return { ok: ocupadas.length === 0, ocupadas, error: null };
}
