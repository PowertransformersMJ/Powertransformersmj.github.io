// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · AJUSTES DEL LIBRO PE.02081 (`99 §110`)
// ──────────────────────────────────────────────────────────────────────────────
// Pedidos del Ingeniero (2026-09-27) sobre el Excel de Mantenimiento Especializado:
//   · «necesito que la hoja de beneficios en la ficha técnica de mantenimiento
//     especializado no aparezca al exportar el excel» → quitarHojaDelLibro.
//     (La hoja «Beneficios» del libro es el estudio económico de la plantilla,
//     que el sistema no escribe; el texto de beneficios va en la hoja 1, B23.)
//   · «en el diagrama futuro sale de lado, necesito que se vea bien igual que en
//     el diagrama actual» → cajaDeImagen: el tamaño con que la hoja muestra la
//     imagen, para dibujarla derecha y sin deformar.
//
// quitarHojaDelLibro LEE y PLANEA todo antes de escribir: si algo falla, lanza y
// el zip queda como estaba (el Excel sale con la hoja; nunca se deja de emitir).
// Quita la hoja del libro, sus relaciones, su tipo y lo que SOLO ella usaba;
// corre las áreas de impresión de las hojas que siguen; y renumera el pie
// «Pág. N de T» de cada hoja para que el papel no diga «de 5» con cuatro páginas.
// Lo demás lo remata limpiarOcultos (`§104`), que corre después.
// ══════════════════════════════════════════════════════════════════════════════

import { partesSueltas, rutaRels, resolver } from './limpiar-ocultos.js';

const EMU_PX = 9525;
const attr = (tag, n) => { const m = String(tag).match(new RegExp('\\s' + n.replace(':', '\\:') + '="([^"]*)"')); return m ? m[1] : null; };
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escXml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function relaciones(xml) {
  return [...String(xml || '').matchAll(/<Relationship\b[^>]*\/?>/g)].map((m) => ({
    tag: m[0], id: attr(m[0], 'Id'), tipo: attr(m[0], 'Type') || '', target: attr(m[0], 'Target') || '',
    externo: attr(m[0], 'TargetMode') === 'External'
  }));
}

/**
 * Tamaño (px) con que la hoja muestra la imagen `rId` de un dibujo: su <a:ext>.
 * @returns {Promise<{w:number,h:number}|null>}
 */
export async function cajaDeImagen(zip, rutaDibujo, rId) {
  const f = zip.file(rutaDibujo);
  if (!f) return null;
  const xml = await f.async('string');
  for (const m of xml.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
    if (!new RegExp('r:embed="' + escRe(rId) + '"').test(m[0])) continue;
    const e = m[0].match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!e) return null;
    const w = Math.round(+e[1] / EMU_PX); const h = Math.round(+e[2] / EMU_PX);
    return w > 20 && h > 20 ? { w, h } : null;
  }
  return null;
}

/**
 * Ancla la imagen `rId` de un dibujo a SU tamaño (<a:ext>), no a las celdas.
 * Un twoCellAnchor estira la imagen al rectángulo de celdas, y cada programa
 * mide las columnas distinto (Excel para Mac, para Windows, LibreOffice, la
 * vista previa): el Diagrama Futuro salía angostado ~10 % fuera del Mac en que
 * se guardó la plantilla (revisión `§110`). Con oneCellAnchor + ext se ve del
 * mismo tamaño en todos, sin deformar. Conserva la esquina superior izquierda.
 * Imagen girada a 90° o 270° (el Diagrama Actual va a 270°): Excel guarda su
 * ancla como la caja YA girada, con ancho y alto cambiados respecto del <a:ext>
 * (así viene en la plantilla, y así la lee la vista previa); el ancla nueva
 * también, o Excel la deformaría (revisión 2026-09-28).
 * @returns {Promise<boolean>} true si la cambió
 */
export async function anclarConTamano(zip, rutaDibujo, rId) {
  const f = zip.file(rutaDibujo);
  if (!f) return false;
  const xml = await f.async('string');
  let hecho = false;
  const nuevo = xml.replace(/<xdr:twoCellAnchor\b[^>]*>([\s\S]*?)<\/xdr:twoCellAnchor>/g, (a, cuerpo) => {
    if (hecho || !new RegExp('r:embed="' + escRe(rId) + '"').test(cuerpo)) return a;
    const de = cuerpo.match(/<xdr:from>[\s\S]*?<\/xdr:from>/);
    const e = cuerpo.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    const pic = cuerpo.match(/<xdr:pic>[\s\S]*<\/xdr:pic>/);
    if (!de || !e || !pic) return a;
    hecho = true;
    const giro = (cuerpo.match(/<a:xfrm\b[^>]*\brot="(-?\d+)"/) || [])[1];
    const grados = giro ? (((Math.round(+giro / 60000) % 360) + 360) % 360) : 0;
    const acostada = (grados >= 45 && grados < 135) || (grados >= 225 && grados < 315);
    const [cx, cy] = acostada ? [e[2], e[1]] : [e[1], e[2]];
    return '<xdr:oneCellAnchor>' + de[0] + '<xdr:ext cx="' + cx + '" cy="' + cy + '"/>' + pic[0] + '<xdr:clientData/></xdr:oneCellAnchor>';
  });
  if (hecho) zip.file(rutaDibujo, nuevo);
  return hecho;
}

/** Texto de cada texto compartido (índice → texto). */
function textosCompartidos(xml) {
  return [...String(xml || '').matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)]
    .map((si) => [...String(si[1] || '').matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join(''));
}

const RE_PIE = /^(Pág\.?)\s*\d+\s+de\s+\d+$/;

/** Reescribe el pie «Pág. N de T» de una hoja (conserva «Pág» o «Pág.» y el estilo). */
function renumerarPie(hojaXml, compartidos, n, total) {
  let hecho = false;
  const nuevo = String(hojaXml).replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (c, at, dentro) => {
    if (hecho || !dentro) return c;
    const t = attr(at, 't');
    let texto = null;
    if (t === 's') { const v = dentro.match(/<v>(\d+)<\/v>/); texto = v ? compartidos[+v[1]] : null; }
    else if (t === 'inlineStr') texto = [...dentro.matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
    const m = texto != null && String(texto).trim().match(RE_PIE);
    if (!m) return c;
    hecho = true;
    const a = String(at).replace(/\st="[^"]*"/, '');
    return '<c' + a + ' t="inlineStr"><is><t>' + escXml(m[1] + ' ' + n + ' de ' + total) + '</t></is></c>';
  });
  return nuevo;
}

/**
 * Quita una hoja del libro (solo del archivo que se descarga) y renumera los pies.
 * @returns {Promise<boolean>} true si la quitó; false si el libro no la tiene
 */
export async function quitarHojaDelLibro(zip, nombre) {
  const nombres = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const leer = (r) => (zip.file(r) ? zip.file(r).async('string') : Promise.resolve(null));
  const [raizRels, ct] = await Promise.all([leer('_rels/.rels'), leer('[Content_Types].xml')]);
  const relDoc = relaciones(raizRels).find((r) => /\/officeDocument$/.test(r.tipo));
  if (!relDoc || ct == null) throw new Error('libro sin estructura conocida');
  const libro = resolver('', relDoc.target);
  const relsLibro = rutaRels(libro);
  const [wb, wbRels] = await Promise.all([leer(libro), leer(relsLibro)]);
  if (wb == null || wbRels == null) throw new Error('libro sin libro');

  const hojas = [...wb.matchAll(/<sheet\b[^>]*\/?>/g)].map((m) => m[0]);
  const idx = hojas.findIndex((h) => attr(h, 'name') === escXml(nombre) || attr(h, 'name') === nombre);
  if (idx < 0) return false;
  if (hojas.length < 2) throw new Error('no se quita la única hoja');
  const rid = attr(hojas[idx], 'r:id');
  const rel = relaciones(wbRels).find((r) => r.id === rid);
  if (!rel) throw new Error('hoja sin relación');
  const parte = resolver(libro, rel.target);

  // Todos los .rels (para saber qué deja de alcanzarse al soltar la hoja).
  const rels = new Map();
  for (const n of nombres.filter((x) => /\.rels$/.test(x))) rels.set(n, await leer(n));
  const antes = new Set(partesSueltas(nombres, (r) => (rels.has(r) ? rels.get(r) : null)));

  // Libro: sin la hoja; áreas de impresión y demás nombres locales corridos.
  let wb2 = wb.replace(hojas[idx], '');
  wb2 = wb2.replace(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g, (d, at) => {
    const l = attr(at, 'localSheetId');
    if (l == null) return d;
    if (+l === idx) return '';
    if (+l > idx) return d.replace(/\slocalSheetId="\d+"/, ' localSheetId="' + (+l - 1) + '"');
    return d;
  });
  wb2 = wb2.replace(/<definedNames>\s*<\/definedNames>/, '');
  // Pestaña activa / primera visible: nunca apuntan a una hoja que ya no está.
  wb2 = wb2.replace(/\s(activeTab|firstSheet)="(\d+)"/g, (a, k, v) => {
    const n = +v;
    return n > idx ? ' ' + k + '="' + (n - 1) + '"' : (n === idx ? ' ' + k + '="0"' : a);
  });
  const wbRels2 = wbRels.replace(relaciones(wbRels).find((r) => r.id === rid).tag, '');
  rels.set(relsLibro, wbRels2);

  // Lo que SOLO la hoja usaba (su dibujo, sus imágenes, su impresora…).
  const despues = partesSueltas(nombres, (r) => (rels.has(r) ? rels.get(r) : null));
  const quitar = despues.filter((p) => !antes.has(p));
  if (!quitar.includes(parte)) throw new Error('la hoja sigue alcanzable');
  const fuera = new Set(quitar.map((q) => '/' + q));
  const ct2 = ct.replace(/<Override\b[^>]*\/>/g, (o) => (fuera.has(attr(o, 'PartName')) ? '' : o));

  // Pies «Pág. N de T» de las hojas que siguen, en su orden.
  const quedan = [...wb2.matchAll(/<sheet\b[^>]*\/?>/g)].map((m) => m[0]);
  const relTextos = relaciones(wbRels2).find((r) => /\/sharedStrings$/.test(r.tipo));
  const compartidos = textosCompartidos(relTextos ? await leer(resolver(libro, relTextos.target)) : '');
  const pies = new Map();
  for (let i = 0; i < quedan.length; i++) {
    const r = relaciones(wbRels2).find((q) => q.id === attr(quedan[i], 'r:id'));
    if (!r) continue;
    const ruta = resolver(libro, r.target);
    const xml = await leer(ruta);
    if (xml == null) continue;
    const nuevo = renumerarPie(xml, compartidos, i + 1, quedan.length);
    if (nuevo !== xml) pies.set(ruta, nuevo);
  }

  // Escribir (todo ya calculado).
  zip.file(libro, wb2);
  zip.file(relsLibro, wbRels2);
  zip.file('[Content_Types].xml', ct2);
  for (const [ruta, xml] of pies) zip.file(ruta, xml);
  for (const q of quitar) zip.remove(q);
  return true;
}
