// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «DIAGRAMA OPERATIVO» · blindaje del Excel ajeno (`99 §112`, CF-40)
// ──────────────────────────────────────────────────────────────────────────────
// El lector (`diagrama-operativo-lector.js`) recorre el XML del Excel con
// expresiones regulares. Con un archivo FABRICADO para eso, una regex perezosa
// que busca el cierre de una etiqueta puede recorrer el resto del texto una vez
// por cada apertura (tiempo cuadrático) y trabar la página: la verificación del
// cerebro lo demostró por `styles.xml` y por el ORDEN de las etiquetas, que la
// primera defensa (contarlas) no miraba (L-106).
//
// Aquí vive la defensa ESTRUCTURAL, en una sola pasada lineal por parte:
//   · `revisarXml`: toda etiqueta cierra en orden, sin DOCTYPE, con nombres
//     simples y sin anidar el mismo nombre en los elementos que el lector recorre
//     buscando su cierre (`NO_ANIDAN`). Con eso, cada regex del lector encuentra el
//     cierre que busca DENTRO de su elemento: nunca recorre de más. Devuelve el XML
//     saneado: sin comentarios, CDATA como texto escapado y todo «>» de dentro de
//     comillas escrito «&gt;» (Excel real lo deja crudo a veces): así el fin de
//     etiqueta que ven las regex (`[^>]*`) es el mismo que vio esta pasada, y los
//     valores no cambian (el lector los pasa por desXml).
//   · `leerParteAcotada`: descomprime contando los bytes REALES (el tamaño que
//     declara el zip lo escribe su autor y se falsea) y se detiene en el tope.
//   · `dimensionesImagen`: ancho y alto leídos de la cabecera, sin decodificar.
// El respaldo para lo que no se prevea es el tiempo límite del trabajador
// (`diagrama-operativo-seguro.js`): la página nunca se traba.
// ══════════════════════════════════════════════════════════════════════════════

/** Nombres de elemento admitidos: los de SpreadsheetML/DrawingML (sin «-» ni «.»). */
const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z_][A-Za-z0-9_]*)?$/;

/**
 * Elementos que el lector recorre con una regex que busca su CIERRE (o que corta
 * un bloque en su primer cierre): estos no pueden ir dentro de otro del mismo
 * nombre, porque el bloque cortado dejaría aperturas sin cierre y la regex
 * recorrería de más. Todos los demás SÍ pueden anidar (grupos de formas,
 * AlternateContent, las ecuaciones de Office —m:e dentro de m:e—…): el lector no
 * los recorre así (revisión CF-40: una ecuación hacía rechazar la hoja).
 */
export const NO_ANIDAN = Object.freeze(new Set([
  'fonts', 'font', 'fills', 'fill', 'borders', 'border', 'cellXfs', 'xf', 'indexedColors',
  'top', 'left', 'right', 'bottom', 'si', 'is', 'row', 'c', 'v', 'rPh',
  'twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor', 'xdr:twoCellAnchor', 'xdr:oneCellAnchor', 'xdr:absoluteAnchor',
  'spPr', 'xdr:spPr', 'txBody', 'xdr:txBody', 'a:ln', 'a:solidFill',
  'a:lt1', 'a:dk1', 'a:lt2', 'a:dk2', 'a:accent1', 'a:accent2', 'a:accent3', 'a:accent4', 'a:accent5', 'a:accent6', 'a:hlink', 'a:folHlink'
]));

const escTexto = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Revisa la estructura de una parte XML en UNA pasada lineal y la devuelve
 * saneada: sin comentarios ni instrucciones «<? ?>» (ninguna regex los ve), con
 * cada CDATA convertido en texto escapado y con los «>» de dentro de comillas
 * escritos «&gt;». Rechaza DOCTYPE, etiquetas sin cerrar o fuera de orden,
 * nombres ajenos a Excel y el anidado de `NO_ANIDAN`.
 * @param {string} xml
 * @param {{maxEtiquetas?: number, maxProfundidad?: number}} [op]
 * @returns {{error: ''|'dañada'|'demasiadas', xml: string}}  error '' = sana; `xml` saneado
 */
export function revisarXml(xml, op = {}) {
  const r = revisar(String(xml == null ? '' : xml), op);
  return typeof r === 'string' ? { error: r, xml: '' } : { error: '', xml: r.xml };
}

function revisar(s, op) {
  const max = op.maxEtiquetas || 3000000; const hondo = op.maxProfundidad || 256;
  const pila = []; const abiertos = new Map(); let n = 0;
  const trozos = []; let desde = 0; let cambio = false;
  const hasta = (k, poner) => { trozos.push(s.slice(desde, k)); if (poner) trozos.push(poner); cambio = true; };
  let i = s.indexOf('<');
  while (i !== -1) {
    const sig = s.charCodeAt(i + 1);
    if (sig === 33) {   // «<!»
      if (s.startsWith('<!--', i)) {   // comentario: fuera
        const f = s.indexOf('-->', i + 4); if (f < 0) return 'dañada';
        hasta(i); desde = f + 3; i = s.indexOf('<', desde); continue;
      }
      if (s.startsWith('<![CDATA[', i)) {   // CDATA: su texto, escapado
        const f = s.indexOf(']]>', i + 9); if (f < 0) return 'dañada';
        hasta(i, escTexto(s.slice(i + 9, f))); desde = f + 3; i = s.indexOf('<', desde); continue;
      }
      return 'dañada';   // DOCTYPE y demás: Excel no los escribe
    }
    if (sig === 63) {   // «<?…?>»: fuera
      const f = s.indexOf('?>', i + 2); if (f < 0) return 'dañada';
      hasta(i); desde = f + 2; i = s.indexOf('<', desde); continue;
    }
    // Fin de la etiqueta: el primer «>» fuera de comillas. Dentro de comillas no
    // puede haber «<» (XML mal formado); un «>» sí (Excel lo deja crudo): se escapa.
    let j = i + 1; let q = 0;
    for (; j < s.length; j++) {
      const k = s.charCodeAt(j);
      if (q) {
        if (k === q) q = 0;
        else if (k === 60) return 'dañada';
        else if (k === 62) { hasta(j, '&gt;'); desde = j + 1; }
      } else if (k === 34 || k === 39) q = k; else if (k === 62) break; else if (k === 60) return 'dañada';
    }
    if (j >= s.length) return 'dañada';
    if (++n > max) return 'demasiadas';
    const cierre = sig === 47;
    const sola = !cierre && s.charCodeAt(j - 1) === 47;
    const a = cierre ? i + 2 : i + 1; let b = a;
    while (b < j) { const k = s.charCodeAt(b); if (k === 32 || k === 9 || k === 10 || k === 13 || k === 47) break; b++; }
    const nombre = s.slice(a, b);
    if (!NOMBRE.test(nombre)) return 'dañada';
    if (cierre) {
      for (let k = b; k < j; k++) { const c = s.charCodeAt(k); if (c !== 32 && c !== 9 && c !== 10 && c !== 13) return 'dañada'; }
      if (pila.pop() !== nombre) return 'dañada';
      abiertos.set(nombre, abiertos.get(nombre) - 1);
    } else if (!sola) {
      if ((abiertos.get(nombre) || 0) > 0 && NO_ANIDAN.has(nombre)) return 'dañada';
      pila.push(nombre); abiertos.set(nombre, (abiertos.get(nombre) || 0) + 1);
      if (pila.length > hondo) return 'dañada';
    }
    i = s.indexOf('<', j + 1);
  }
  if (pila.length) return 'dañada';
  if (!cambio) return { xml: s };
  trozos.push(s.slice(desde)); return { xml: trozos.join('') };
}

/** Texto de una parte: UTF-8 (como JSZip, conserva el BOM), o UTF-16 si trae su marca (OPC lo admite). */
export function textoParte(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes);
  return textoUtf8(bytes);
}

/**
 * Descomprime una parte del zip contando los bytes REALES y se detiene al pasar
 * `tope` (rechaza con `{excede: true}`). JSZip 3: `internalStream` entrega trozos.
 * @param {object} archivo  entrada de JSZip (`zip.file(ruta)`)
 * @param {number} tope     bytes
 * @returns {Promise<Uint8Array>}
 */
export function leerParteAcotada(archivo, tope) {
  return new Promise((ok, mal) => {
    const trozos = []; let n = 0; let fin = false; let h;
    try { h = archivo.internalStream('uint8array'); } catch (e) { mal(e); return; }
    h.on('data', (d) => {
      if (fin) return;
      n += d.length;
      if (n > tope) { fin = true; try { h.pause(); } catch (_) { /* nada */ } const e = new Error('excede'); e.excede = true; mal(e); return; }
      trozos.push(d);
    }).on('error', (e) => { if (!fin) { fin = true; mal(e); } })
      .on('end', () => {
        if (fin) return; fin = true;
        const u = new Uint8Array(n); let o = 0; for (const t of trozos) { u.set(t, o); o += t.length; }
        ok(u);
      });
    h.resume();
  });
}

/** UTF-8 → texto, igual que JSZip `async('string')` (conserva un BOM inicial). */
export function textoUtf8(bytes) { return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes); }

/** Bytes → base64 por tramos (sin desbordar la pila con archivos grandes). */
export function aBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Ancho y alto de una imagen PNG, GIF o JPEG leídos de su cabecera (sin decodificarla).
 * @param {Uint8Array} b
 * @returns {{w:number, h:number}|null}
 */
export function dimensionesImagen(b) {
  if (!b || b.length < 24) return null;
  const be16 = (p) => (b[p] << 8) | b[p + 1];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
    return { w: ((b[16] << 24) >>> 0) + (b[17] << 16) + (b[18] << 8) + b[19], h: ((b[20] << 24) >>> 0) + (b[21] << 16) + (b[22] << 8) + b[23] };
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let p = 2;
    while (p + 9 < b.length) {
      if (b[p] !== 0xFF) { p++; continue; }
      const m = b[p + 1];
      if (m === 0xFF) { p++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { p += 2; continue; }
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: be16(p + 5), w: be16(p + 7) };
      if (m === 0xD9 || m === 0xDA) return null;
      p += 2 + be16(p + 2);
    }
  }
  return null;
}
