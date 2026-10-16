// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · WORD (.docx) · dominio puro
// ──────────────────────────────────────────────────────────────────────────────
// Convierte el MISMO «Documento» (lista de bloques) que dibuja el papel HTML en un
// .docx del formato Applus F60-ADM V.11: así el PDF y el Word dicen las mismas
// palabras. Generador OOXML propio, sin dependencias (zip almacenado + XML).
//
//   construirDocx(documento, imagenes) → { partes, avisos }   (texto XML + bytes)
//   docxBytes(documento, imagenes)     → Uint8Array del .docx
//
// `imagenes` es un Map<ref, { bytes, mime, ancho, alto } | null> con las refs del
// Documento ('archivo:<id>', 'ficha:<clave>', 'marca:<clave>', 'firma:<rol>').
// Una foto con óvalos rojos se busca primero con `claveMarcada(ref, marcas)`
// (la foto ya horneada con sus óvalos) y si no está, sin óvalos y con aviso.
//
// Medidas en pt del modelo (612 × 792). Word usa twips (1 pt = 20) y EMU
// (1 pt = 12 700). Diferencias honestas con el PDF: Word reparte los renglones a
// su manera (los cortes no serán idénticos) y depende de que el computador tenga
// Arial Narrow y Tahoma.
// Sin DOM ni red: corre igual en el navegador y en `node --test`.
// ══════════════════════════════════════════════════════════════════════════════

import { crearZip } from './zip_almacenado.js';
import { pngColor, pngVineta, pngMarcador } from './png_simple.js';
import { tipoPorBytes } from './fichas_adjunto.js';
import { tamanoFirma } from './firmas_tamano.js';
import { DISPOSICIONES } from './informe_brigada_plantilla.js';
import { geometriaCuadricula, FOTO_MARGEN, FIRMA_POSICION, FIRMA_PORTADA } from './informe_brigada_documento.js';

export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ─────────────────────────── medidas del formato ─────────────────────────── */

/** Hoja carta y márgenes del modelo (pt). Cuerpo: x 85,0 → 526,9 · y 109,0 → 714,0. */
export const HOJA = Object.freeze({ ancho: 612, alto: 792, arriba: 109, abajo: 78, izquierda: 85, derecha: 85.1 });
const CUERPO_X = HOJA.izquierda;
const CUERPO_ANCHO = HOJA.ancho - HOJA.izquierda - HOJA.derecha;      // 441,9

/** Cuadrículas de figuras: son LAS de la plantilla (antes había una copia aquí y se desfasó: a la de
 *  tres fotos le faltaba x0 = 64,3). Las fotos se ubican con `geometriaCuadricula`, la MISMA del papel. */
export const GEOM_CUADRICULA = DISPOSICIONES;
const ALTO_MAX_ANEXO = 600;         // red de seguridad: el Documento ya trae el ancho que cabe bajo el título (591,5 pt)
const RADIO_DIFUMINADO_PT = 15.8;   // rampa del borde suave de las fotos (perfil medido en el modelo)

/** Portada: marco de la tabla, filas y posiciones medidas en el modelo (PLAN §6, maqueta:485-551). */
const PORTADA = Object.freeze({
  XL: 71.8, XM: 321.6, XR: 540.2,
  filas: [109.0, 177.8, 248.1, 405.6, 416.9, 564.7, 580.9, 706.2],
  logos: {
    afinia: [369.7, 113.1, 119.2, 61.5],
    applus: [84.7, 239.6, 154.1, 64.5],
    together: [179.6, 293.0, 130.9, 75.2],
  },
  firmas: { y1: [571.1, 611.4, 658.9], y2: [585.0, 625.5, 673.0], xRotulo: 75.5, xCasilla: 192.6 },
});

/** Encabezado y pie (iguales en todas las hojas, portada incluida). */
const ENCABEZADO = Object.freeze({
  logo: [85.1, 4.7, 118.3, 49.5],
  together: [439.5, 43.9, 78.0, 41.3],
  direcciones: { x: 92.1, y: 44.09, renglon: 8.033 },
});
const PIE = Object.freeze({
  codigo: { x: 381.6, y: 727.3 },
  numero: [505.0, 720.0, 22.2, 24.2],
  franja: [0, 750.4, 612.0, 41.6],
});

const COLOR = Object.freeze({
  barra: 'D9D9D9', portadaTitulo: 'E3E3E3', portadaGris: 'DCDCDC', vineta: '808080',
  ciudad: '7F7F7F', direccion: '333333', enlace: '0000FF', franja: '#FB6600', numero: '#ED7D31',
  pendiente: '808080', marcaAgua: 'C80000', falta: 'C00000',
});
const AN = 'Arial Narrow', ARIAL = 'Arial', TAHOMA = 'Tahoma';

/* ─────────────────────────────── utilidades ─────────────────────────────── */

const NS = Object.freeze({
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  v: 'urn:schemas-microsoft-com:vml',
  o: 'urn:schemas-microsoft-com:office:office',
  w10: 'urn:schemas-microsoft-com:office:word',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
});
const RAIZ_NS = `xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}" xmlns:v="${NS.v}" xmlns:o="${NS.o}" xmlns:w10="${NS.w10}"`;
const TIPO_REL = Object.freeze({
  documento: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  core: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  app: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
  estilos: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  ajustes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
  fuentes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable',
  encabezado: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  pie: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  imagen: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  enlace: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
});

const tw = (pt) => Math.round((Number(pt) || 0) * 20);
const emu = (pt) => Math.round((Number(pt) || 0) * 12700);
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Quita los caracteres que XML 1.0 no admite (controles y sustitutos sueltos).
 *  Sin «lookbehind» en la expresión: un Safari viejo no la entiende y tumbaría el módulo. */
function limpiarTexto(s) {
  const t = String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  if (!/[\uD800-\uDFFF]/.test(t)) return t;
  let x = '';
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const d = t.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) { x += t[i] + t[i + 1]; i++; }
    } else if (!(c >= 0xDC00 && c <= 0xDFFF)) x += t[i];
  }
  return x;
}
/** Escapa texto para un nodo o atributo XML. */
export function escXml(s) {
  return limpiarTexto(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Clave de la foto YA horneada con sus óvalos (la usa exportar-word al preparar las imágenes). */
export function claveMarcada(ref, marcas) {
  const m = (Array.isArray(marcas) ? marcas : []).map((k) => [k.x, k.y, k.w, k.h].map((v) => r3(Number(v) || 0)).join(','));
  return `${ref}#ovalos:${m.join(';')}`;
}

/* ─────────────────────────── recorrido del Documento ─────────────────────────── */

function figurasDe(b) { return Array.isArray(b && b.figuras) ? b.figuras : []; }
function fotosDe(f) { return Array.isArray(f && f.fotos) ? f.fotos : []; }

/** Todas las refs de imagen que el Word puede usar (sin repetir), en orden de aparición. */
export function refsDeImagenes(documento) {
  const d = documento || {};
  const vistas = new Set();
  const poner = (ref) => { if (typeof ref === 'string' && ref) vistas.add(ref); };
  poner(d.encabezado && d.encabezado.logo);
  poner(d.encabezado && d.encabezado.together);
  const lg = (d.portada && d.portada.logos) || {};
  poner(lg.afinia); poner(lg.applus); poner(lg.together);
  if (estadoDe(d) === 'emitido') for (const f of ((d.portada && d.portada.firmas) || [])) poner(f && f.firmaRef);
  for (const b of (d.bloques || [])) {
    if (!b) continue;
    if (b.tipo === 'cuadricula') for (const f of figurasDe(b)) for (const ft of fotosDe(f)) poner(ft && ft.ref);
    if (b.tipo === 'anexoImagen') poner(b.ref);
  }
  return [...vistas];
}

/**
 * Fotos con óvalos rojos: [{ ref, marcas, clave, anchoPt }] (para hornearlas antes de construir el Word).
 * `anchoPt` = ancho aproximado de la foto en el papel según su cuadrícula: con él el horneado
 * da el trazo de 1,5 pt también en las fotos de 1, 3 o 4 por figura (no solo en las de dos columnas).
 */
export function fotosConMarcas(documento) {
  const salida = [];
  const vistas = new Set();
  for (const b of ((documento && documento.bloques) || [])) {
    if (!b || b.tipo !== 'cuadricula') continue;
    let cajas = [];
    try { cajas = geometriaCuadricula(b).filas.flatMap((r) => r.fotos); } catch (_) { cajas = []; }
    const una = !!(DISPOSICIONES[b.disposicion] && DISPOSICIONES[b.disposicion].unaFigura);
    const fotos = una ? fotosDe(figurasDe(b)[0]) : figurasDe(b).map((f) => fotosDe(f)[0]);
    fotos.forEach((ft, k) => {
      if (!ft || !ft.ref || !Array.isArray(ft.marcas) || !ft.marcas.length) return;
      const clave = claveMarcada(ft.ref, ft.marcas);
      if (vistas.has(clave)) return;
      vistas.add(clave);
      const anchoPt = cajas[k] ? Math.round(cajas[k].w * 10) / 10 : 229.8;
      salida.push({ ref: ft.ref, marcas: ft.marcas, clave, anchoPt });
    });
  }
  return salida;
}

function estadoDe(d) { return (d && d.meta && d.meta.estado) || 'borrador'; }

/* ─────────────────────────── medidas de una imagen ─────────────────────────── */

function dimensionesPorBytes(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { ancho: v.getUint32(16), alto: v.getUint32(20) };
  }
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01 || m === 0xFF) { i += (m === 0xFF ? 1 : 2); continue; }
      const largo = (b[i + 2] << 8) | b[i + 3];
      if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) {
        return { alto: (b[i + 5] << 8) | b[i + 6], ancho: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + largo;
    }
  }
  return null;
}

/* ─────────────────────────────── el armador ─────────────────────────────── */

class Armador {
  constructor(imagenes, opciones) {
    this.imagenes = imagenes instanceof Map ? imagenes : new Map(Object.entries(imagenes || {}));
    this.opciones = opciones || {};
    this.medios = [];                       // { nombre: 'media/imagen1.png', datos }
    this.medioPorClave = new Map();
    this.rels = { document: [], header1: [], footer1: [] };
    this.idDibujo = 0;
    this.capa = 251658240;
    this.avisos = [];
    this.faltan = { hueco: 0, foto: 0, anexoVacio: 0, anexo: 0, logo: new Set(), firma: 0, tipo: 0, ovalos: 0 };
  }

  rel(parte, tipo, destino, externo = false) {
    const lista = this.rels[parte];
    const ya = lista.find((x) => x.destino === destino && x.tipo === tipo);
    if (ya) return ya.id;
    const id = `rId${parte === 'document' ? 'D' : parte === 'header1' ? 'H' : 'F'}${lista.length + 1}`;
    lista.push({ id, tipo, destino, externo });
    return id;
  }

  /** Registra bytes de imagen una sola vez por clave → nombre dentro de word/. */
  medio(clave, bytes, ext) {
    if (this.medioPorClave.has(clave)) return this.medioPorClave.get(clave);
    const nombre = `media/imagen${this.medios.length + 1}.${ext}`;
    this.medios.push({ nombre, datos: bytes });
    this.medioPorClave.set(clave, nombre);
    return nombre;
  }

  /** Imagen de una ref → { clave, bytes, ext, ancho, alto } | null (con su aviso). */
  imagen(ref, { marcas, clase } = {}) {
    if (!ref) {                                   // hueco sin imagen todavía (no es un error de lectura)
      if (clase === 'foto') this.faltan.hueco++;
      else if (clase === 'anexo') this.faltan.anexoVacio++;
      return null;
    }
    let clave = ref;
    let e = null;
    if (Array.isArray(marcas) && marcas.length) {
      clave = claveMarcada(ref, marcas);
      e = this.imagenes.get(clave) || null;
      if (!e) { e = this.imagenes.get(ref) || null; clave = ref; if (e) this.faltan.ovalos++; }
    } else {
      e = this.imagenes.get(ref) || null;
    }
    if (!e || !e.bytes) { this.anotarFalta(clase, ref); return null; }
    const bytes = e.bytes instanceof Uint8Array ? e.bytes : new Uint8Array(e.bytes);
    const tipo = tipoPorBytes(bytes);
    if (tipo !== 'png' && tipo !== 'jpeg') { this.faltan.tipo++; this.anotarFalta(clase, ref); return null; }
    const d = (e.ancho > 0 && e.alto > 0) ? { ancho: e.ancho, alto: e.alto } : (dimensionesPorBytes(bytes) || { ancho: 4, alto: 3 });
    return { clave, bytes, ext: tipo === 'png' ? 'png' : 'jpeg', ancho: d.ancho, alto: d.alto };
  }

  anotarFalta(clase, ref) {
    if (clase === 'logo') this.faltan.logo.add(String(ref).replace(/^marca:/, ''));
    else if (clase === 'firma') this.faltan.firma++;
    else if (clase === 'anexo') this.faltan.anexo++;
    else this.faltan.foto++;
  }

  /** Imagen generada por código (viñeta, franja, marcador): siempre PNG. */
  generada(clave, fabricar) {
    if (!this.medioPorClave.has(clave)) this.medio(clave, fabricar(), 'png');
    return { clave, ext: 'png', generada: true };
  }

  nuevoId() { this.idDibujo += 1; return this.idDibujo; }
  nuevaCapa() { this.capa += 1024; return this.capa; }

  cerrarAvisos() {
    const f = this.faltan;
    const pl = (n, uno, varios) => (n === 1 ? uno : varios);
    if (f.hueco) this.avisos.push(`${f.hueco} ${pl(f.hueco, 'hueco de foto está vacío', 'huecos de foto están vacíos')}: en el Word queda «[Foto pendiente]».`);
    if (f.foto) this.avisos.push(`${f.foto} ${pl(f.foto, 'foto no se pudo leer', 'fotos no se pudieron leer')} del almacenamiento: queda «[Foto pendiente]».`);
    if (f.anexoVacio) this.avisos.push(`${f.anexoVacio} ${pl(f.anexoVacio, 'anexo no tiene', 'anexos no tienen')} imagen todavía: queda «[Imagen del anexo pendiente]».`);
    if (f.anexo) this.avisos.push(`${f.anexo} ${pl(f.anexo, 'imagen de anexo no se pudo leer', 'imágenes de anexo no se pudieron leer')}: queda «[Imagen del anexo pendiente]».`);
    if (f.logo.size) this.avisos.push(`${pl(f.logo.size, 'Falta 1 logo', `Faltan ${f.logo.size} logos`)} de la marca (${[...f.logo].join(', ')}): en su lugar va un recuadro punteado. Los sube un administrador.`);
    if (f.firma) this.avisos.push(`${f.firma} ${pl(f.firma, 'firma de la versión emitida no se pudo leer', 'firmas de la versión emitida no se pudieron leer')}: la casilla queda en blanco para firmar a mano.`);
    if (f.tipo) this.avisos.push(`${f.tipo} ${pl(f.tipo, 'imagen no era', 'imágenes no eran')} PNG ni JPEG y se ${pl(f.tipo, 'dejó', 'dejaron')} por fuera.`);
    if (f.ovalos) this.avisos.push(`${f.ovalos} ${pl(f.ovalos, 'foto con óvalos rojos salió', 'fotos con óvalos rojos salieron')} sin ellos en el Word (no se pudieron dibujar).`);
    return this.avisos;
  }
}

/* ─────────────────────────────── piezas XML ─────────────────────────────── */

/**
 * Formato de un trozo de texto (orden exacto del esquema CT_RPr).
 * f = { fuente, tam (pt), b, i, color, sep (pt), esc (0..1), pos (pt), mark, u, estiloCar, noProof }
 */
function rPr(f = {}) {
  let x = '';
  if (f.estiloCar) x += `<w:rStyle w:val="${f.estiloCar}"/>`;
  const fu = f.fuente || AN;
  x += `<w:rFonts w:ascii="${fu}" w:hAnsi="${fu}" w:eastAsia="${fu}" w:cs="${fu}"/>`;
  if (f.b) x += '<w:b/><w:bCs/>';
  if (f.i) x += '<w:i/><w:iCs/>';
  if (f.noProof) x += '<w:noProof/>';
  if (f.color) x += `<w:color w:val="${f.color}"/>`;
  if (f.sep) x += `<w:spacing w:val="${tw(f.sep)}"/>`;
  if (f.esc && Math.abs(f.esc - 1) > 0.001) x += `<w:w w:val="${Math.min(600, Math.max(1, Math.round(f.esc * 100)))}"/>`;
  if (f.pos) x += `<w:position w:val="${Math.round(f.pos * 2)}"/>`;
  if (f.tam) x += `<w:sz w:val="${Math.round(f.tam * 2)}"/><w:szCs w:val="${Math.round(f.tam * 2)}"/>`;
  if (f.mark) x += '<w:highlight w:val="yellow"/>';
  if (f.u) x += '<w:u w:val="single"/>';
  return `<w:rPr>${x}</w:rPr>`;
}

/** Un trozo de texto; los tabuladores y saltos de renglón se vuelven <w:tab/> y <w:br/>. */
function run(texto, f = {}) {
  const t = limpiarTexto(texto);
  if (!t) return '';
  const piezas = t.split(/(\t|\r?\n)/);
  let x = '';
  for (const p of piezas) {
    if (!p) continue;
    if (p === '\t') x += '<w:tab/>';
    else if (p === '\n' || p === '\r\n') x += '<w:br/>';
    else x += `<w:t xml:space="preserve">${escXml(p)}</w:t>`;
  }
  return `<w:r>${rPr(f)}${x}</w:r>`;
}
const TAB = (f = {}) => `<w:r>${rPr(f)}<w:tab/></w:r>`;

/** Runs del Documento ({ t, b, i, mark, esc, sep, falta }) con un formato base.
 *  `falta` = hueco «[dato]» de un borrador: va en rojo para que salte a la vista. */
function runsXml(runs, base = {}) {
  const lista = Array.isArray(runs) ? runs : (runs == null ? [] : [{ t: String(runs) }]);
  return lista.map((r) => (typeof r === 'string'
    ? run(r, base)
    : run(r && r.t, {
      ...base,
      b: !!(base.b || (r && r.b)),
      i: !!(base.i || (r && r.i)),
      mark: !!(r && r.mark),
      esc: (r && r.esc) || base.esc,
      sep: (r && r.sep) || base.sep,
      color: r && r.falta ? COLOR.falta : base.color,
    }))).join('');
}
function textoDeRuns(runs) {
  if (typeof runs === 'string') return runs;
  return (Array.isArray(runs) ? runs : []).map((r) => (typeof r === 'string' ? r : (r && r.t) || '')).join('');
}

/* Anchos de Arial (milésimas de em, caracteres 32–126; métrica de Helvetica, que Arial iguala).
   Arial Narrow es Arial al 82 % de ancho. Sirve para que un renglón de la portada que no cabe se
   COMPRIMA a lo ancho (como el papel), en vez de partirse en dos y salirse de su fila de alto fijo. */
const ANCHOS_ARIAL = [
  '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584',
  '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584'
].map((t) => t.split(',').map(Number));
/** Ancho aproximado (pt) de un texto en Arial / Arial Narrow, con 3 % de holgura (mejor comprimir de más que partir). */
export function anchoTextoPt(texto, { tam = 10, negrita = false, angosta = true } = {}) {
  const tabla = ANCHOS_ARIAL[negrita ? 1 : 0];
  let mil = 0;
  for (const ch of String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')) {
    const c = ch.charCodeAt(0);
    mil += c >= 32 && c <= 126 ? tabla[c - 32] : (ch === '·' ? 278 : ch === '–' ? 556 : 600);
  }
  return (mil / 1000) * tam * (angosta ? 0.82 : 1) * 1.03;
}
/** Escala horizontal para que un renglón quepa en `maxPt` (nunca más ancha que `escBase`, nunca menos de 0,5). */
function escalaQueCabe(texto, f, maxPt, escBase = 1) {
  const w = anchoTextoPt(texto, f) * escBase;
  if (!(w > maxPt) || !(maxPt > 0)) return escBase;
  return Math.max(0.5, Math.floor((escBase * maxPt / w) * 1000) / 1000);
}

/**
 * Propiedades de párrafo (orden exacto del esquema CT_PPr).
 * o = { estilo, keepNext, keepLines, saltoAntes, marco, borde, shd, tabs:[{pos, tipo}], antes, despues,
 *       linea, regla, izq, der, colgante, primera, jc, marca: rPr del fin de párrafo }
 */
function pPr(o = {}) {
  let x = '';
  if (o.estilo) x += `<w:pStyle w:val="${o.estilo}"/>`;
  if (o.keepNext) x += '<w:keepNext/>';
  if (o.keepLines) x += '<w:keepLines/>';
  if (o.saltoAntes) x += '<w:pageBreakBefore/>';
  if (o.marco) x += o.marco;
  if (o.borde) x += o.borde;
  if (o.shd) x += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
  if (o.tabs && o.tabs.length) x += `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="${t.tipo || 'left'}" w:pos="${t.pos}"/>`).join('')}</w:tabs>`;
  const linea = o.regla === 'auto' || !o.linea ? 'w:line="240" w:lineRule="auto"' : `w:line="${Math.max(14, tw(o.linea))}" w:lineRule="${o.regla || 'exact'}"`;
  x += `<w:spacing w:before="${Math.max(0, tw(o.antes))}" w:after="${Math.max(0, tw(o.despues))}" ${linea}/>`;
  if (o.izq || o.der || o.colgante || o.primera) {
    let ind = '';
    if (o.izq) ind += ` w:left="${o.izq}"`;
    if (o.der) ind += ` w:right="${o.der}"`;
    if (o.colgante) ind += ` w:hanging="${o.colgante}"`;
    else if (o.primera) ind += ` w:firstLine="${o.primera}"`;
    x += `<w:ind${ind}/>`;
  }
  if (o.jc) x += `<w:jc w:val="${o.jc}"/>`;
  x += o.marca ? rPr(o.marca) : '';
  return `<w:pPr>${x}</w:pPr>`;
}
const P = (contenido, o = {}) => `<w:p>${pPr(o)}${contenido || ''}</w:p>`;

/** Marco de texto (framePr) en coordenadas de hoja (pt). */
function marco({ x, y, w, h, hRule = 'auto', wrap = 'around' }) {
  return `<w:framePr${w ? ` w:w="${tw(w)}"` : ''}${h ? ` w:h="${tw(h)}" w:hRule="${hRule}"` : ''} w:wrap="${wrap}" w:hAnchor="page" w:vAnchor="page" w:x="${tw(x)}" w:y="${tw(y)}"/>`;
}

function grafico(rId, id, nombre, cx, cy, suave) {
  const efecto = suave ? `<a:effectLst><a:softEdge rad="${emu(RADIO_DIFUMINADO_PT)}"/></a:effectLst>` : '';
  return `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:pic xmlns:pic="${NS.pic}"><pic:nvPicPr><pic:cNvPr id="${id}" name="${escXml(nombre)}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${efecto}</pic:spPr>`
    + '</pic:pic></a:graphicData></a:graphic>';
}

/** Imagen en el renglón (fotos, anexos, viñetas). */
function enLinea(A, parte, img, anchoPt, altoPt, { suave = false, nombre = 'Imagen', pos = 0 } = {}) {
  const archivo = A.medioPorClave.get(img.clave) || A.medio(img.clave, img.bytes, img.ext);
  const rId = A.rel(parte, TIPO_REL.imagen, archivo);
  const id = A.nuevoId();
  const cx = Math.max(1, emu(anchoPt)), cy = Math.max(1, emu(altoPt));
  return `<w:r>${rPr({ noProof: true, pos })}<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>`
    + `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="${escXml(nombre)} ${id}"/>`
    + `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${NS.a}" noChangeAspect="1"/></wp:cNvGraphicFramePr>`
    + `${grafico(rId, id, `${nombre} ${id}`, cx, cy, suave)}</wp:inline></w:drawing></w:r>`;
}

/** Imagen flotante en coordenadas de hoja (logos, franja, firmas). */
function anclada(A, parte, img, x, y, w, h, { detras = false, nombre = 'Imagen' } = {}) {
  const archivo = A.medioPorClave.get(img.clave) || A.medio(img.clave, img.bytes, img.ext);
  const rId = A.rel(parte, TIPO_REL.imagen, archivo);
  const id = A.nuevoId();
  const cx = Math.max(1, emu(w)), cy = Math.max(1, emu(h));
  return `<w:r>${rPr({ noProof: true })}<w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${A.nuevaCapa()}" behindDoc="${detras ? 1 : 0}" locked="1" layoutInCell="1" allowOverlap="1">`
    + '<wp:simplePos x="0" y="0"/>'
    + `<wp:positionH relativeFrom="page"><wp:posOffset>${emu(x)}</wp:posOffset></wp:positionH>`
    + `<wp:positionV relativeFrom="page"><wp:posOffset>${emu(y)}</wp:posOffset></wp:positionV>`
    + `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>`
    + `<wp:docPr id="${id}" name="${escXml(nombre)} ${id}"/><wp:cNvGraphicFramePr/>`
    + `${grafico(rId, id, `${nombre} ${id}`, cx, cy, false)}</wp:anchor></w:drawing></w:r>`;
}

/** Logo de la marca en su lugar exacto; si falta, recuadro punteado del mismo tamaño. */
function logo(A, parte, ref, [x, y, w, h], nombre) {
  const img = A.imagen(ref, { clase: 'logo' });
  if (img) return anclada(A, parte, img, x, y, w, h, { detras: true, nombre });
  if (!ref) A.faltan.logo.add(nombre);
  const pend = A.generada(`gen:marcador:${Math.round(w)}x${Math.round(h)}`, () => pngMarcador(Math.round(w * 2), Math.round(h * 2)));
  return anclada(A, parte, pend, x, y, w, h, { detras: true, nombre: `${nombre} pendiente` });
}

function vinetaXml(A, parte, anchoPt, altoPt, pos = 0) {
  const img = A.generada('gen:vineta', () => pngVineta(48));
  return enLinea(A, parte, img, anchoPt, altoPt, { nombre: 'Viñeta', pos });
}

/* Marca de agua del borrador o del anulado: la misma figura que pone Word con «Diseño › Marca de agua»
   (VML), detrás del texto. Igual que el papel (informe-brigada-papel.css · .ibr-agua): Arial negrita de
   54 pt, rojo rgba(200, 0, 0, .14), girada −52° y centrada en la HOJA. */
function marcaDeAgua(texto, id) {
  const t = limpiarTexto(texto);
  const n = Math.max(1, t.length);
  const ancho = r3(Math.min(900, anchoTextoPt(t, { tam: 54, negrita: true, angosta: false }) / 1.03 + 2 * (n - 1)));
  const alto = r3(54 * 0.74);
  return '<w:r><w:rPr><w:noProof/></w:rPr><w:pict>'
    + '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e">'
    + '<v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/>'
    + '<v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/>'
    + '<v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/>'
    + '<v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas>'
    + '<v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/>'
    + '<v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles>'
    + '<o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>'
    + `<v:shape id="PowerPlusWaterMarkObject${id}" o:spid="_x0000_s${2048 + id}" type="#_x0000_t136" `
    + `style="position:absolute;margin-left:0;margin-top:0;width:${ancho}pt;height:${alto}pt;rotation:308;z-index:-251651072;`
    + 'mso-position-horizontal:center;mso-position-horizontal-relative:page;mso-position-vertical:center;mso-position-vertical-relative:page" '
    + `o:allowincell="f" fillcolor="#${COLOR.marcaAgua}" stroked="f"><v:fill opacity=".14"/>`
    + `<v:textpath style="font-family:&quot;${ARIAL}&quot;;font-size:1pt;font-weight:bold" string="${escXml(texto)}"/>`
    + '</v:shape></w:pict></w:r>';
}

/* ─────────────────────────────── tablas ─────────────────────────────── */

const ocho = (pt) => Math.max(2, Math.round((Number(pt) || 0.5) * 8));     // grosor en octavos de pt
const linea = (lado, pt) => `<w:${lado} w:val="single" w:sz="${ocho(pt)}" w:space="0" w:color="000000"/>`;
function tcMar({ arriba = 0, izq = 0, abajo = 0, der = 0 } = {}) {
  return `<w:tcMar><w:top w:w="${tw(arriba)}" w:type="dxa"/><w:left w:w="${tw(izq)}" w:type="dxa"/><w:bottom w:w="${tw(abajo)}" w:type="dxa"/><w:right w:w="${tw(der)}" w:type="dxa"/></w:tcMar>`;
}
function tblPr({ ancho, ind = null, centrada = false, bordes }) {
  return `<w:tblPr><w:tblW w:w="${tw(ancho)}" w:type="dxa"/>${centrada ? '<w:jc w:val="center"/>' : ''}`
    + `${ind != null ? `<w:tblInd w:w="${tw(ind)}" w:type="dxa"/>` : ''}`
    + `<w:tblBorders>${linea('top', bordes.ext)}${linea('left', bordes.ext)}${linea('bottom', bordes.ext)}${linea('right', bordes.ext)}${linea('insideH', bordes.h)}${linea('insideV', bordes.v)}</w:tblBorders>`
    + '<w:tblLayout w:type="fixed"/>'
    + '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
    + '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>';
}
const tblGrid = (cols) => `<w:tblGrid>${cols.map((c) => `<w:gridCol w:w="${tw(c)}"/>`).join('')}</w:tblGrid>`;
function tc(anchoPt, contenido, { span = 1, vMerge = null, shd = null, mar = null, vAlign = null } = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${tw(anchoPt)}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}`
    + `${vMerge ? `<w:vMerge${vMerge === 'inicio' ? ' w:val="restart"' : ''}/>` : ''}`
    + `${shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${shd}"/>` : ''}${mar ? tcMar(mar) : ''}`
    + `${vAlign ? `<w:vAlign w:val="${vAlign}"/>` : ''}</w:tcPr>${contenido || P('', { marca: { tam: 1 } })}</w:tc>`;
}
function tr(celdas, { alto = 0, regla = 'atLeast', noPartir = true } = {}) {
  return `<w:tr><w:trPr>${noPartir ? '<w:cantSplit/>' : ''}${alto ? `<w:trHeight w:val="${tw(alto)}" w:hRule="${regla}"/>` : ''}</w:trPr>${celdas}</w:tr>`;
}

/** Alto que se PIDE para una fila: el procesador suma el grosor de la línea horizontal al alto
 *  pedido (medido en LibreOffice: +0,5 pt por fila con borde de 0,5 pt y +1 pt con borde de 1 pt;
 *  en el modelo hecho en Word, las Tablas 3 y 1 difieren justo esos 0,5 pt). Se resta para que la
 *  distancia entre líneas sea la del modelo. */
const altoFila = (pasoPt, bordePt) => Math.max(1, pasoPt - (Number(bordePt) || 0.5));

/** Tabla de datos con geometría del modelo (Tablas 1–5 y las dos del cálculo). */
function tablaXml(b, { mantenerUltima = false } = {}) {
  const g = b.geom || {};
  const cols = Array.isArray(g.cols) && g.cols.length ? g.cols : [CUERPO_ANCHO];
  const ancho = cols.reduce((s, c) => s + c, 0);
  const fuente = g.fuente === 't11' ? 11 : 10;
  const lineaPt = fuente === 11 ? 12.455 : 11.32;
  const dx = Number(g.dx) || 0;
  const filas = Array.isArray(b.filas) ? b.filas : [];
  const xml = filas.map((f, k) => {
    const ultima = k === filas.length - 1;
    const seguir = !ultima || mantenerUltima;
    let c = 0;
    const celdas = (f.celdas || []).map((cd) => {
      const span = Math.max(1, Math.min(cols.length - c, Number(cd.span) || 1));
      const w = cols.slice(c, c + span).reduce((s, x) => s + x, 0);
      c += span;
      const rot = cd.estilo === 'rotulo';
      const mar = rot ? { izq: 6.0, der: 1.0 } : (dx < 0 ? { izq: 0.5, der: Math.min(-2 * dx, w / 4) } : { izq: Math.min(2 * dx, w / 4) + 0.5, der: 0.5 });
      // Los rótulos de la Tabla 1 van en Arial Narrow Bold 11 (como el modelo y el papel), aunque la tabla sea de 10.
      const base = { fuente: AN, tam: rot ? 11 : fuente, b: rot || cd.estilo === 'negrita' };
      const par = P(runsXml(cd.runs, base), { keepNext: seguir, linea: lineaPt, jc: rot ? 'left' : 'center', marca: { tam: rot ? 11 : fuente } });
      return tc(w, par, { span, shd: cd.fondo ? String(cd.fondo).replace('#', '') : null, mar, vAlign: 'center' });
    }).join('');
    const faltan = cols.length - c;
    const relleno = faltan > 0 ? tc(cols.slice(c).reduce((s, x) => s + x, 0), null, { span: faltan }) : '';
    return tr(celdas + relleno, { alto: altoFila(Number(f.alto) || 13, g.bH) });
  }).join('');
  return `<w:tbl>${tblPr({ ancho, ind: (Number(g.x0) || CUERPO_X) - CUERPO_X, bordes: { ext: g.bExt, h: g.bH, v: g.bV } })}${tblGrid(cols)}${xml}</w:tbl>`;
}

/* ─────────────────────────── cuadrícula de figuras ─────────────────────────── */

function pieFiguraRuns(fig) {
  if (Array.isArray(fig && fig.runs)) return fig.runs;
  if (Array.isArray(fig && fig.pie)) return fig.pie;
  const n = fig && fig.numero != null ? fig.numero : '';
  const texto = String((fig && fig.pie) || '').trim();
  return texto ? [{ t: `Figura ${n}`, b: true }, { t: `. ${texto}` }] : [{ t: `Figura ${n}`, b: true }];
}

function cuadriculaXml(A, b, { mantenerUltima = false } = {}) {
  let D = DISPOSICIONES[b.disposicion];
  let bloque = b;
  if (!D) {
    A.avisos.push(`Disposición de figuras desconocida «${b.disposicion}»: se usó la de dos columnas.`);
    D = DISPOSICIONES['2x1'];
    bloque = { ...b, disposicion: '2x1', geom: null };
  }
  // La MISMA geometría del papel (PDF): mismo tamaño de foto, mismos topes, misma sangría del pie.
  const G = geometriaCuadricula(bloque);
  const cols = G.colW.length;
  const figuras = figurasDe(b);
  const fotos = D.unaFigura
    ? Array.from({ length: D.fotosPorFigura }, (_, k) => fotosDe(figuras[0])[k] || { ref: null })
    : Array.from({ length: cols }, (_, k) => fotosDe(figuras[k])[0] || { ref: null });
  const ancho = G.colW.reduce((s, x) => s + x, 0);
  const vAlign = G.alinearV === 'centro' ? 'center' : 'top';
  let xml = '';
  let k = 0;
  for (const fila of G.filas) {
    const celdas = fila.fotos.map((caja, c) => {
      const f = fotos[k++] || { ref: null };
      const img = A.imagen(f.ref, { marcas: f.marcas, clase: 'foto' });
      const contenido = img
        ? P(enLinea(A, 'document', img, caja.w, caja.h, { suave: true, nombre: 'Foto' }), { keepNext: true, jc: 'left', regla: 'auto', marca: { tam: 1 } })
        : P(run('[Foto pendiente]', { fuente: AN, tam: 10, color: COLOR.pendiente, i: true }), { keepNext: true, jc: 'center', linea: 11.4 });
      // La foto va arriba a la izquierda con 5,2 pt de margen (como el modelo); el «extra inferior» ya va en el
      // alto de la fila (antes se sumaba otra vez como margen de la celda y la fila crecía 7 pt).
      return tc(G.colW[c], contenido, { vAlign, mar: { izq: FOTO_MARGEN.izq } });
    }).join('');
    xml += tr(celdas, { alto: altoFila(fila.alto, 0.5) });
  }
  // fila del pie: un pie por columna, o uno solo centrado si la cuadrícula es UNA figura
  const pieBase = { fuente: AN, tam: 10 };
  if (D.unaFigura) {
    const par = P(runsXml(pieFiguraRuns(figuras[0] || {}), pieBase), { keepNext: mantenerUltima, antes: 0.6, linea: 11.4, jc: 'center' });
    xml += tr(tc(ancho, par, { span: cols, mar: { izq: 5.5, der: 4.9 } }), { alto: altoFila(G.pie.alto, 0.5) });
  } else {
    const celdas = G.colW.map((w, c) => {
      const fig = figuras[c];
      const par = fig
        ? P(runsXml(pieFiguraRuns(fig), pieBase), { keepNext: mantenerUltima, antes: G.pie.dy, linea: 11.4, jc: 'both' })
        : P('', { marca: { tam: 1 } });
      return tc(w, par, { mar: { izq: 5.5 + G.pie.sangria, der: 4.9 } });
    }).join('');
    xml += tr(celdas, { alto: altoFila(G.pie.alto, 0.5) });
  }
  return `<w:tbl>${tblPr({ ancho, ind: G.x0 - CUERPO_X, bordes: { ext: 0.5, h: 0.5, v: 0.5 } })}${tblGrid(G.colW)}${xml}</w:tbl>`;
}

/* ─────────────────────────────── portada ─────────────────────────────── */

function portadaXml(A, d) {
  const T = PORTADA;
  const po = d.portada || {};
  const emitido = estadoDe(d) === 'emitido';
  const anchoIzq = T.XM - T.XL, anchoDer = T.XR - T.XM;
  const altos = T.filas.slice(1).map((y, k) => y - T.filas[k]);
  const fila = (k, izq, der) => tr(izq + der, { alto: altos[k], regla: 'exact' });
  const B10 = { fuente: AN, tam: 10, b: true };

  // derecha · fila 2: título en tres renglones, centrado, fondo #E3E3E3
  const titulo = (Array.isArray(po.titulo) ? po.titulo : []).map((t, k) => P(run(t, B10), { antes: k === 0 ? 14.8 : k === 1 ? 7.8 : 0, linea: 11.2, jc: 'center' })).join('');
  // derecha · fila 3: índice (números en Tahoma comprimida, nivel 2 con sangría)
  const indice = (Array.isArray(po.indice) ? po.indice : []).map((r, k) => {
    const n2 = Number(r.nivel) === 2;
    return P(run(r.numero, { fuente: TAHOMA, tam: 10, esc: 0.77778 }) + TAB({ fuente: AN, tam: 10 }) + run(r.texto, { fuente: AN, tam: 10 }),
      { antes: k === 0 ? 14.2 : 0, linea: 12.1, izq: n2 ? 326 : 10, tabs: [{ pos: n2 ? 686 : 200 }], marca: { tam: 10 } });
  }).join('');
  // derecha · filas 4 y 5: ANEXOS + subtítulo + lista con viñeta
  const anexosTit = P(run(po.anexosTitulo || 'ANEXOS', B10), { linea: 11.3, jc: 'center' });
  const anexos = P(run(po.anexosSubtitulo || '', B10), { antes: 10.35, linea: 11.4, jc: 'center' })
    + (Array.isArray(po.anexos) ? po.anexos : []).map((t, k) => P(vinetaXml(A, 'document', 6.75, 7.0) + TAB({ fuente: AN, tam: 9 })
      + run(t, { fuente: AN, tam: 9, esc: escalaQueCabe(t, { tam: 9 }, T.XR - 343.6 - 2) }),
      { antes: k === 0 ? 4.95 : 0, linea: 10, izq: 440, colgante: 322, marca: { tam: 9 } })).join('');
  // derecha · filas 6 y 7: CLIENTE, ASUNTO y datos del equipo (fondo #DCDCDC)
  const maxDato = T.XR - 341.6 - 2;          // donde arranca el texto de cada dato (tras la viñeta) hasta el marco
  const maxCliente = T.XR - 325.4 - 2;
  const cliente = P(run(po.cliente || '', { ...B10, esc: escalaQueCabe(po.cliente || '', { tam: 10, negrita: true }, maxCliente) }), { antes: 2.4, linea: 11.4, izq: 76 });
  const datos = (Array.isArray(po.datos) ? po.datos : []).map((renglon, k) => {
    const texto = textoDeRuns(renglon);
    const esAsunto = k === 0 && /^ASUNTO\b/i.test(texto);
    if (esAsunto) return P(runsXml(renglon, { ...B10, esc: escalaQueCabe(texto, { tam: 10, negrita: true }, maxCliente, 0.88) }), { antes: 0.6, linea: 11.45, izq: 76 });
    const primero = k === (/^ASUNTO\b/i.test(textoDeRuns(po.datos[0])) ? 1 : 0);
    // Un dato muy largo (p. ej. fabricante + potencia + serie) se comprime a lo ancho, como en el papel: la fila es de alto fijo.
    const esc = escalaQueCabe(texto, { tam: 10, negrita: true }, maxDato, 0.905);
    return P(vinetaXml(A, 'document', 7.75, 8.0) + TAB(B10) + runsXml(renglon.map((r) => (r && typeof r === 'object' ? { ...r, esc } : r)), { ...B10, esc }),
      { antes: primero ? 11.25 : 0, linea: 11.45, izq: 400, colgante: 362, marca: { tam: 10 } });
  }).join('');
  // izquierda · filas 6 y 7: firmas (Elaborado / Revisado / Aprobado) con su casilla «Fecha / Firma:»
  const F = T.firmas;
  let abajo = T.filas[5];
  let firmas = '';
  const anclasFirma = [];
  (Array.isArray(po.firmas) ? po.firmas : []).slice(0, 3).forEach((f, k) => {
    const y1 = F.y1[k], y2 = F.y2[k];
    // La fecha de la emisión va sin negrita en x = 250 pt, como en el papel (FIRMA_POSICION).
    const fecha = emitido && f.fecha ? TAB(B10) + run(f.fecha, { fuente: AN, tam: 10 }) : '';
    firmas += P(run(f.rotulo || '', B10) + TAB(B10) + run(f.casilla || 'Fecha / Firma:', B10) + fecha,
      { antes: y1 - abajo, linea: 11.4, tabs: [{ pos: tw(F.xCasilla - F.xRotulo) }, { pos: tw(FIRMA_POSICION.xFecha - F.xRotulo) }] });
    // con firma estampada, un nombre muy largo se comprime para terminar 3 pt antes de ella, como en el papel (§163.14)
    const nom = String(f.nombre || '').toLocaleUpperCase('es-CO');
    const topeNom = emitido && f.firmaRef && Number.isFinite(f.firmaXPt) ? f.firmaXPt - 3 - F.xRotulo : 0;
    const escNom = topeNom > 0 ? escalaQueCabe(nom, { tam: 10, negrita: true }, topeNom) : 1;
    firmas += P(run(nom, escNom < 1 ? { ...B10, esc: escNom } : B10), { antes: y2 - (y1 + 11.4), linea: 11.4 });
    abajo = y2 + 11.4;
    // la firma SOLO en la versión emitida (nunca en borrador): imagen flotante bajo «Fecha / Firma:»
    if (emitido && f.firmaRef) {
      const img = A.imagen(f.firmaRef, { clase: 'firma' });
      if (img) {
        const propia = f.firmaTamPt && f.firmaTamPt.ancho > 0 && f.firmaTamPt.alto > 0;
        const { ancho, alto } = propia ? f.firmaTamPt : tamanoFirma(img.ancho / img.alto, FIRMA_PORTADA);
        // centrada bajo la fecha, como en el papel (§163.14)
        const x = propia && Number.isFinite(f.firmaXPt) ? f.firmaXPt : (FIRMA_POSICION.xCentro || 270.5) - ancho / 2;
        anclasFirma.push(anclada(A, 'document', img, x, y1 + FIRMA_POSICION.dyFirma, ancho, alto, { nombre: `Firma ${f.rol || k + 1}` }));
      }
    }
  });

  const vacio = P('', { marca: { tam: 1 } });
  const izq = (contenido, vMerge) => tc(anchoIzq, contenido || vacio, { vMerge, mar: { izq: 3.7 } });
  const der = (contenido, o = {}) => tc(anchoDer, contenido || vacio, { mar: o.mar || {}, shd: o.shd || null });
  const filasXml = [
    fila(0, izq(null, 'inicio'), der(null)),
    fila(1, izq(null, 'sigue'), der(titulo, { shd: COLOR.portadaTitulo, mar: { izq: 3.6 } })),
    fila(2, izq(null, 'sigue'), der(indice)),
    fila(3, izq(null, 'sigue'), der(anexosTit, { shd: COLOR.portadaGris })),
    fila(4, izq(null, 'sigue'), der(anexos)),
    fila(5, izq(firmas, 'inicio'), der(cliente, { shd: COLOR.portadaGris })),
    fila(6, izq(null, 'sigue'), der(datos, { shd: COLOR.portadaGris })),
  ].join('');
  const tabla = `<w:tbl>${tblPr({ ancho: anchoIzq + anchoDer, ind: T.XL - CUERPO_X, bordes: { ext: 0.5, h: 0.5, v: 0.5 } })}${tblGrid([anchoIzq, anchoDer])}${filasXml}</w:tbl>`;

  // logos de la portada y firmas: flotantes en coordenadas de hoja, en un renglón mínimo DESPUÉS de la tabla
  const lg = po.logos || {};
  const anclas = logo(A, 'document', lg.afinia, T.logos.afinia, 'Logo afinia')
    + logo(A, 'document', lg.applus, T.logos.applus, 'Logo Applus portada')
    + logo(A, 'document', lg.together, T.logos.together, 'Together portada')
    + anclasFirma.join('');
  return tabla + P(anclas, { linea: 0.7, marca: { tam: 1 } });
}

/* ─────────────────────────────── cuerpo ─────────────────────────────── */

const LINEA_CUERPO = 12.455;
const BASE_CUERPO = { fuente: AN, tam: 11 };

function tituloXml(b, o) {
  const num = limpiarTexto(b.numero || '');
  const txt = limpiarTexto(b.texto || '');
  const base = { fuente: AN, tam: 11, b: true };
  const comun = { keepNext: true, saltoAntes: o.saltoAntes, antes: o.antes, linea: LINEA_CUERPO, marca: { tam: 11, b: true } };
  const nivel = Number(b.nivel) || 1;
  if (b.estilo === 'barra' || b.estilo === 'manual') {
    // barra gris #D9D9D9 de x 101,55 a 528,73: número en 103,1 y texto en 121,1 (el «5.» va pegado, sin tabulación)
    const cont = b.estilo === 'manual'
      ? TAB(base) + run(`${num} ${txt}`.trim(), base)
      : TAB(base) + run(num, base) + TAB(base) + run(txt, base);
    return P(cont, { ...comun, estilo: 'Ttulo1', shd: COLOR.barra, izq: tw(101.55 - CUERPO_X), der: tw(526.9 - 528.73), tabs: [{ pos: 362 }, { pos: 722 }] });
  }
  if (b.estilo === 'plano') return P(run(`${num} ${txt}`.trim(), base), { ...comun, estilo: nivel >= 3 ? 'Ttulo3' : 'Ttulo2' });
  // nivel 2: número en 103,1 y texto en 121,1 · nivel 3: texto en 139,1 (sangría francesa si el título no cabe)
  const izq = nivel >= 3 ? tw(139.1 - CUERPO_X) : tw(121.1 - CUERPO_X);
  return P(run(num, base) + TAB(base) + run(txt, base), { ...comun, estilo: nivel >= 3 ? 'Ttulo3' : 'Ttulo2', izq, colgante: izq - 362 });
}

function parrafoXml(b, o) {
  return P(runsXml(b.runs, BASE_CUERPO), { keepNext: o.keepNext, saltoAntes: o.saltoAntes, antes: o.antes, linea: LINEA_CUERPO, jc: 'both', marca: { tam: 11 } });
}

function vinetaBloqueXml(A, b, o) {
  const base = { fuente: AN, tam: 10, color: COLOR.vineta };
  return P(vinetaXml(A, 'document', 7.75, 8.0) + TAB(base) + runsXml(b.runs, base),
    { keepNext: o.keepNext, saltoAntes: o.saltoAntes, antes: o.antes, linea: 11.3, izq: 362, colgante: 362, jc: 'both', marca: { tam: 10 } });
}

function anexoImagenXml(A, b, o) {
  const img = A.imagen(b.ref, { clase: 'anexo' });
  if (!img) {
    return P(run('[Imagen del anexo pendiente]', { fuente: AN, tam: 11, color: COLOR.pendiente, i: true }),
      { saltoAntes: o.saltoAntes, antes: Math.max(o.antes, 12), linea: LINEA_CUERPO, jc: 'center' });
  }
  const ancho = Number(b.ancho) > 0 ? Number(b.ancho) : img.ancho;
  const alto = Number(b.alto) > 0 ? Number(b.alto) : img.alto;
  const asp = ancho / alto;
  // El Documento ya calculó el ancho que cabe bajo el título (el MISMO del papel): no se recorta otra vez.
  let w = Math.min(CUERPO_ANCHO, Number(b.anchoPt) > 0 ? Number(b.anchoPt) : CUERPO_ANCHO);
  let h = w / asp;
  if (h > ALTO_MAX_ANEXO) { h = ALTO_MAX_ANEXO; w = h * asp; }
  return P(enLinea(A, 'document', img, w, h, { nombre: 'Anexo' }), { saltoAntes: o.saltoAntes, antes: o.antes, jc: 'center', regla: 'auto', marca: { tam: 1 } });
}

/** Renglón vacío de alto exacto (espacio antes de una tabla o arriba de la hoja). */
const espaciador = (alto, o = {}) => P('', { keepNext: o.keepNext, saltoAntes: o.saltoAntes, linea: Math.max(0.7, alto), marca: { tam: 1 } });

function cuerpoXml(A, d) {
  const bloques = (Array.isArray(d.bloques) ? d.bloques : []).filter(Boolean);
  let xml = '';
  let anterior = 'tabla';                   // lo que va antes: la portada termina en su renglón mínimo
  let primero = true;
  let previoMantiene = false;
  bloques.forEach((b, k) => {
    const siguiente = bloques[k + 1];
    const salto = primero || !!b.saltoAntes;       // la portada va sola: el cuerpo empieza en hoja nueva
    let antes = Number(b.antes) || 0;
    let saltoAntes = salto;
    // espacio arriba de una hoja nueva: Word puede omitir el «antes» tras un salto; se garantiza con un renglón vacío
    if (salto && b.antesEnTope && antes > 0.6 && b.tipo !== 'tabla' && b.tipo !== 'cuadricula') {
      xml += espaciador(antes, { saltoAntes: true, keepNext: true });
      antes = 0; saltoAntes = false;
    } else if (salto && b.tipo !== 'tabla' && b.tipo !== 'cuadricula') {
      antes = b.antesEnTope ? antes : 0;
    }
    const mantenerUltima = !!(siguiente && siguiente.conAnterior);
    const keepNext = !!b.conSiguiente;
    const o = { antes, saltoAntes, keepNext };
    switch (b.tipo) {
      case 'titulo': xml += tituloXml(b, o); anterior = 'p'; break;
      case 'parrafo': xml += parrafoXml(b, o); anterior = 'p'; break;
      case 'vineta': xml += vinetaBloqueXml(A, b, o); anterior = 'p'; break;
      case 'pieTabla':
        xml += P(run(b.texto, { fuente: ARIAL, tam: 9, b: true, i: true }), { keepNext, saltoAntes, antes, linea: 10.05, jc: 'center', marca: { tam: 9 } });
        anterior = 'p'; break;
      case 'etiqueta':
        xml += P(run(b.texto, { fuente: AN, tam: 11, b: true }), { keepNext: true, saltoAntes, antes, linea: LINEA_CUERPO, marca: { tam: 11 } });
        anterior = 'p'; break;
      case 'anexoTitulo':
        xml += P(run(b.texto, { fuente: AN, tam: 11, b: true }), { estilo: 'Ttulo2', keepNext: true, saltoAntes, antes, linea: LINEA_CUERPO, jc: 'center', marca: { tam: 11 } });
        anterior = 'p'; break;
      case 'anexoImagen': xml += anexoImagenXml(A, b, o); anterior = 'p'; break;
      case 'tabla':
      case 'cuadricula': {
        // una tabla no tiene «espacio antes»: va un renglón vacío de ese alto (y separa dos tablas seguidas)
        if (salto || antes >= 0.7 || anterior === 'tabla') xml += espaciador(antes, { saltoAntes: salto, keepNext: previoMantiene || salto });
        xml += b.tipo === 'tabla' ? tablaXml(b, { mantenerUltima }) : cuadriculaXml(A, b, { mantenerUltima });
        anterior = 'tabla';
        break;
      }
      default:
        A.avisos.push(`Un bloque de tipo «${b.tipo}» no tiene forma en Word y se omitió.`);
        return;
    }
    previoMantiene = keepNext || b.tipo === 'titulo' || b.tipo === 'etiqueta' || b.tipo === 'anexoTitulo';
    primero = false;
  });
  if (anterior === 'tabla') xml += espaciador(0.7);
  return xml;
}

/* ─────────────────────────── encabezado y pie ─────────────────────────── */

function encabezadoXml(A, d) {
  const f = d.formato || {};
  const e = d.encabezado || {};
  const D = ENCABEZADO.direcciones;
  const dirs = Array.isArray(f.direcciones) ? f.direcciones : [];
  let renglones = dirs.map((x, k) => (k ? '<w:r><w:br/></w:r>' : '')
    + run(x.t, { fuente: ARIAL, tam: 7, b: !!x.b, color: x.b ? COLOR.ciudad : COLOR.direccion })).join('');
  if (f.web) {
    const rId = A.rel('header1', TIPO_REL.enlace, `http://${String(f.web).replace(/^https?:\/\//, '')}`, true);
    renglones += '<w:r><w:br/></w:r>' + run(' ', { fuente: ARIAL, tam: 7, sep: 1.05 })
      + `<w:hyperlink r:id="${rId}" w:history="1">${run(f.web, { estiloCar: 'Hipervnculo', fuente: ARIAL, tam: 7, color: COLOR.enlace, u: true })}</w:hyperlink>`;
  }
  const direcciones = P(renglones, { marco: marco({ x: D.x, y: D.y, w: 140 }), linea: D.renglon, marca: { tam: 7, fuente: ARIAL } });
  let flotantes = logo(A, 'header1', e.logo, ENCABEZADO.logo, 'Logo Applus')
    + logo(A, 'header1', e.together, ENCABEZADO.together, 'Together beyond standards');
  const agua = d.meta && d.meta.marcaAgua;
  if (agua) flotantes += marcaDeAgua(agua, 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${RAIZ_NS}>${direcciones}${P(flotantes, { estilo: 'Encabezado', linea: 0.7, marca: { tam: 1 } })}</w:hdr>`;
}

function pieXml(A, d) {
  const f = d.formato || {};
  const [nx, ny, nw, nh] = PIE.numero;
  const codigo = P(run(f.codigo || '', { fuente: ARIAL, tam: 9, b: true }), { marco: marco({ x: PIE.codigo.x, y: PIE.codigo.y, w: 130 }), linea: 10.05, marca: { tam: 9 } });
  // Campo PAGE en sus 5 partes, cada una con el formato blanco (con w:fldSimple LibreOffice lo pintaba negro).
  const fNum = rPr({ fuente: ARIAL, tam: 11, color: 'FFFFFF' });
  const campoPagina = `<w:r>${fNum}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${fNum}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>`
    + `<w:r>${fNum}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${fNum}<w:t>1</w:t></w:r><w:r>${fNum}<w:fldChar w:fldCharType="end"/></w:r>`;
  const numero = P(campoPagina,
    { marco: marco({ x: nx, y: ny + 6.3, w: nw }), linea: 12.29, jc: 'center', marca: { fuente: ARIAL, tam: 11, color: 'FFFFFF' } });
  const recuadro = A.generada('gen:recuadro', () => pngColor(8, 8, COLOR.numero));
  const franja = A.generada('gen:franja', () => pngColor(8, 8, COLOR.franja));
  const flotantes = anclada(A, 'footer1', franja, ...PIE.franja, { detras: true, nombre: 'Franja naranja' })
    + anclada(A, 'footer1', recuadro, nx, ny, nw, nh, { detras: true, nombre: 'Recuadro del número' });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${RAIZ_NS}>${codigo}${numero}${P(flotantes, { estilo: 'Piedepgina', linea: 0.7, marca: { tam: 1 } })}</w:ftr>`;
}

/* ─────────────────────────── partes fijas del paquete ─────────────────────────── */

function estilosXml() {
  const fu = (n) => `<w:rFonts w:ascii="${n}" w:hAnsi="${n}" w:eastAsia="${n}" w:cs="${n}"/>`;
  const titulo = (id, nombre, nivel) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nombre}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>`
    + `<w:pPr><w:keepNext/><w:outlineLvl w:val="${nivel}"/></w:pPr><w:rPr>${fu(AN)}<w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<w:styles xmlns:w="${NS.w}">`
    + `<w:docDefaults><w:rPrDefault><w:rPr>${fu(AN)}<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CO" w:eastAsia="es-CO" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>`
    + '<w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    + titulo('Ttulo1', 'heading 1', 0) + titulo('Ttulo2', 'heading 2', 1) + titulo('Ttulo3', 'heading 3', 2)
    + '<w:style w:type="paragraph" w:styleId="Encabezado"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Piedepgina"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/></w:style>'
    + '<w:style w:type="character" w:default="1" w:styleId="Fuentedeprrafopredeter"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>'
    + `<w:style w:type="character" w:styleId="Hipervnculo"><w:name w:val="Hyperlink"/><w:basedOn w:val="Fuentedeprrafopredeter"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="${COLOR.enlace}"/><w:u w:val="single"/></w:rPr></w:style>`
    + '<w:style w:type="table" w:default="1" w:styleId="Tablanormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>'
    + '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
    + '<w:style w:type="numbering" w:default="1" w:styleId="Sinlista"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>'
    + '</w:styles>';
}

function ajustesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<w:settings xmlns:w="${NS.w}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/>`
    + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>'
    + '<w:compatSetting w:name="overrideTableStyleFontSizeAndJustification" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/>'
    + '<w:compatSetting w:name="enableOpenTypeFeatures" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/>'
    + '<w:compatSetting w:name="doNotFlipMirrorIndents" w:uri="http://schemas.microsoft.com/office/word" w:val="1"/></w:compat>'
    + '<w:themeFontLang w:val="es-CO"/><w:decimalSymbol w:val=","/><w:listSeparator w:val=";"/></w:settings>';
}

function fuentesXml() {
  const f = (nombre, panose) => `<w:font w:name="${nombre}"><w:panose1 w:val="${panose}"/><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<w:fonts xmlns:w="${NS.w}">${f(AN, '020B0606020202030204')}${f(ARIAL, '020B0604020202020204')}${f(TAHOMA, '020B0604030504040204')}${f('Calibri', '020F0502020204030204')}</w:fonts>`;
}

function relsXml(lista) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<Relationships xmlns="${NS.rel}">`
    + lista.map((x) => `<Relationship Id="${x.id}" Type="${x.tipo}" Target="${escXml(x.destino)}"${x.externo ? ' TargetMode="External"' : ''}/>`).join('')
    + '</Relationships>';
}

function tiposXml() {
  const d = (ext, tipo) => `<Default Extension="${ext}" ContentType="${tipo}"/>`;
  const o = (parte, tipo) => `<Override PartName="${parte}" ContentType="${tipo}"/>`;
  const wml = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<Types xmlns="${NS.ct}">`
    + d('rels', 'application/vnd.openxmlformats-package.relationships+xml') + d('xml', 'application/xml')
    + d('png', 'image/png') + d('jpeg', 'image/jpeg') + d('jpg', 'image/jpeg')
    + o('/word/document.xml', `${wml}.document.main+xml`) + o('/word/styles.xml', `${wml}.styles+xml`)
    + o('/word/settings.xml', `${wml}.settings+xml`) + o('/word/fontTable.xml', `${wml}.fontTable+xml`)
    + o('/word/header1.xml', `${wml}.header+xml`) + o('/word/footer1.xml', `${wml}.footer+xml`)
    + o('/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml')
    + o('/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml')
    + '</Types>';
}

function coreXml(d, opciones) {
  const titulo = (d.meta && d.meta.titulo) || 'INFORME';
  const fecha = typeof opciones.creado === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(opciones.creado) ? opciones.creado.replace(/\.\d+Z$/, 'Z') : null;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + `<dc:title>${escXml(titulo)}</dc:title><dc:subject>Informe de Mantenimiento Brigada · F60-ADM V. 11</dc:subject><dc:creator>SGM · TRANSPOWER</dc:creator><cp:lastModifiedBy>SGM · TRANSPOWER</cp:lastModifiedBy><dc:language>es-CO</dc:language>`
    + (fecha ? `<dcterms:created xsi:type="dcterms:W3CDTF">${fecha}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${fecha}</dcterms:modified>` : '')
    + '</cp:coreProperties>';
}

function appXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    + '<Application>SGM · TRANSPOWER</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>AFINIA · CARIBEMAR</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion>'
    + '</Properties>';
}

/* ─────────────────────────────── API pública ─────────────────────────────── */

/**
 * Documento (PLAN §3.4) → partes del paquete OOXML.
 * @param {object} documento
 * @param {Map<string, {bytes: Uint8Array, mime?: string, ancho?: number, alto?: number}|null>} [imagenes]
 * @param {{ creado?: string }} [opciones]  `creado`: fecha ISO para las propiedades (sin ella, salida determinista)
 * @returns {{ partes: {nombre: string, datos: string|Uint8Array}[], avisos: string[] }}
 */
export function construirDocx(documento, imagenes = new Map(), opciones = {}) {
  if (!documento || typeof documento !== 'object') throw new TypeError('construirDocx: falta el Documento del informe.');
  const A = new Armador(imagenes, opciones);
  const d = documento;
  const rEnc = A.rel('document', TIPO_REL.encabezado, 'header1.xml');
  const rPie = A.rel('document', TIPO_REL.pie, 'footer1.xml');
  A.rel('document', TIPO_REL.estilos, 'styles.xml');
  A.rel('document', TIPO_REL.ajustes, 'settings.xml');
  A.rel('document', TIPO_REL.fuentes, 'fontTable.xml');

  const encabezado = encabezadoXml(A, d);
  const pie = pieXml(A, d);
  const portada = portadaXml(A, d);
  const cuerpo = cuerpoXml(A, d);
  const seccion = `<w:sectPr><w:headerReference w:type="default" r:id="${rEnc}"/><w:footerReference w:type="default" r:id="${rPie}"/>`
    + `<w:pgSz w:w="${tw(HOJA.ancho)}" w:h="${tw(HOJA.alto)}"/>`
    + `<w:pgMar w:top="${tw(HOJA.arriba)}" w:right="${tw(HOJA.derecha)}" w:bottom="${tw(HOJA.abajo)}" w:left="${tw(HOJA.izquierda)}" w:header="0" w:footer="0" w:gutter="0"/>`
    + '<w:cols w:space="708"/></w:sectPr>';
  const documentoXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<w:document ${RAIZ_NS}><w:body>${portada}${cuerpo}${seccion}</w:body></w:document>`;

  const partes = [
    { nombre: '[Content_Types].xml', datos: tiposXml() },
    { nombre: '_rels/.rels', datos: relsXml([
      { id: 'rId1', tipo: TIPO_REL.documento, destino: 'word/document.xml' },
      { id: 'rId2', tipo: TIPO_REL.core, destino: 'docProps/core.xml' },
      { id: 'rId3', tipo: TIPO_REL.app, destino: 'docProps/app.xml' },
    ]) },
    { nombre: 'docProps/core.xml', datos: coreXml(d, A.opciones) },
    { nombre: 'docProps/app.xml', datos: appXml() },
    { nombre: 'word/document.xml', datos: documentoXml },
    { nombre: 'word/styles.xml', datos: estilosXml() },
    { nombre: 'word/settings.xml', datos: ajustesXml() },
    { nombre: 'word/fontTable.xml', datos: fuentesXml() },
    { nombre: 'word/header1.xml', datos: encabezado },
    { nombre: 'word/footer1.xml', datos: pie },
    { nombre: 'word/_rels/document.xml.rels', datos: relsXml(A.rels.document) },
    { nombre: 'word/_rels/header1.xml.rels', datos: relsXml(A.rels.header1) },
    { nombre: 'word/_rels/footer1.xml.rels', datos: relsXml(A.rels.footer1) },
    ...A.medios.map((m) => ({ nombre: `word/${m.nombre}`, datos: m.datos })),
  ];
  return { partes, avisos: A.cerrarAvisos() };
}

/** Documento → bytes del .docx (zip almacenado de las partes). */
export function docxBytes(documento, imagenes = new Map(), opciones = {}) {
  return crearZip(construirDocx(documento, imagenes, opciones).partes);
}
