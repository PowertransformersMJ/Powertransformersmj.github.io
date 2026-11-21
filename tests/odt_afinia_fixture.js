// Firma de ODT Afinia · material SINTÉTICO para las pruebas (no es una prueba).
// Todo se arma EN MEMORIA: la guardia de cédulas frena cualquier .pdf y el repo es
// público (P5): ningún N.º, nombre, correo ni uid real; los textos de la ODT son
// los del formato (título, pie, etiquetas) y lo demás es relleno inventado.
import { deflateSync } from 'node:zlib';
import * as PDFLib from '../assets/vendor/pdf-lib-1.17.1.esm.min.js';
import { ANCLAS_ESPERADAS, ETIQUETAS, CLAVES_ZONA } from '../assets/js/domain/odt_afinia_zonas.js';
import { TITULO, PIE } from '../assets/js/domain/odt_afinia_formato.js';

export { PDFLib };
export const NRO = '00000001';

// ── PNG mínimo (RGBA, sin filtros) ─────────────────────────────────────────────
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function trozo(tipo, datos) {
  const t = Buffer.from(tipo, 'ascii');
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
  return Buffer.concat([largo, t, datos, crc]);
}
/**
 * PNG sintético de una «firma»: trazo oscuro en diagonal sobre fondo transparente.
 * @param {number} ancho @param {number} alto @param {number} [semilla] cambia el trazo
 */
export function pngFirma(ancho = 250, alto = 100, semilla = 1) {
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 4); // filtro 0
    for (let x = 0; x < ancho; x++) {
      const yTrazo = Math.round((alto - 1) * (0.5 + 0.4 * Math.sin((x / ancho) * Math.PI * 2 * semilla)));
      if (Math.abs(y - yTrazo) <= 2) { const i = 1 + x * 4; fila[i] = 10; fila[i + 1] = 20; fila[i + 2] = 90; fila[i + 3] = 255; }
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr), trozo('IDAT', deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0))
  ]));
}

// ── ODT sintética ──────────────────────────────────────────────────────────────
/**
 * Arma una ODT sintética y devuelve {bytes, itemsPorPagina, estructura}.
 * `itemsPorPagina` son los ítems de texto {str,x,y,w,h} tal como los daría pdf.js
 * (se anotan al dibujar: en Node no hay pdf.js).
 * Opciones para los casos negativos:
 *   paginas (2), ancho/alto (Carta), rotacion (0), caja [x,y] (MediaBox desplazada),
 *   titulo / pie / etiquetas (true), nro (NRO; null = no lo escribe),
 *   corrimiento: {dx, dy} para TODAS las etiquetas o {clave: {dx, dy}} por etiqueta,
 *   etiquetasPartidas: escribe cada etiqueta en dos ítems (como Excel),
 *   acroForm: agrega un campo de formulario, cifrado: marca /Encrypt en el trailer.
 */
export async function armarOdt(op = {}) {
  const {
    paginas = 2, ancho = 612, alto = 792, rotacion = 0, caja = null,
    titulo = true, pie = true, etiquetas = true, nro = NRO,
    corrimiento = null, etiquetasPartidas = false, acroForm = false, cifrado = false, otroTexto = 'Relleno sintético de prueba'
  } = op;
  // Sin fechas ni «Producer»: la ODT sintética sale IGUAL en cada corrida (huellas estables).
  const doc = await PDFLib.PDFDocument.create({ updateMetadata: false });
  const fuente = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const itemsPorPagina = [];
  for (let n = 0; n < paginas; n++) {
    const p = doc.addPage([ancho, alto]);
    if (caja) p.setMediaBox(caja[0], caja[1], ancho, alto);
    if (rotacion) p.setRotation(PDFLib.degrees(rotacion));
    const items = [];
    const escribir = (str, x, y, size = 8) => {
      p.drawText(str, { x, y, size, font: fuente });
      items.push({ str, x, y, w: fuente.widthOfTextAtSize(str, size), h: size });
    };
    if (n === 0) {
      if (titulo) escribir(TITULO, 200, 740, 12);
      if (nro) { escribir('N.º ODT', 420, 720); escribir(nro, 470, 720); }
      escribir('CONSIGNACION 12345678901', 40, 700); // número de 11 dígitos: no es un N.º de 8
      escribir(otroTexto, 40, 680);
    }
    if (pie) escribir(PIE + ' Ed.07', 40, 20, 6);
    const ultima = n === paginas - 1;
    if (ultima && etiquetas) {
      // Las líneas de las casillas (contenido vectorial normal del formato).
      p.drawRectangle({ x: 81.20, y: 190.50, width: 121.02, height: 34.50, borderWidth: 0.5, borderColor: PDFLib.rgb(0, 0, 0) });
      p.drawRectangle({ x: 225.22, y: 190.50, width: 159.45, height: 34.50, borderWidth: 0.5, borderColor: PDFLib.rgb(0, 0, 0) });
      for (const clave of CLAVES_ZONA) {
        const c = corrimiento && (corrimiento[clave] || (corrimiento.dx != null || corrimiento.dy != null ? corrimiento : null));
        const dx = (c && c.dx) || 0; const dy = (c && c.dy) || 0;
        const { x, y } = ANCLAS_ESPERADAS[clave];
        const texto = ETIQUETAS[clave];
        if (etiquetasPartidas && texto.includes(' ')) {
          const [a, ...resto] = texto.split(' ');
          escribir(a, x + dx, y + dy, 7);
          escribir(resto.join(' '), x + dx + fuente.widthOfTextAtSize(a + ' ', 7), y + dy, 7);
        } else {
          escribir(texto, x + dx, y + dy, 7);
        }
      }
      escribir('SITIO DE PRUEBA', 400, 120, 7); // «SITIO» no debe confundirse con «SI»
    }
    itemsPorPagina.push(items);
  }
  if (acroForm) doc.getForm().createTextField('campo.sintetico').addToPage(doc.getPage(0), { x: 40, y: 600, width: 100, height: 14 });
  if (cifrado) doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: 'Standard' });
  const bytes = await doc.save();
  const estructura = {
    cifrado, acroForm,
    paginas: itemsPorPagina.map((items) => ({
      ancho, alto, caja: caja ? [caja[0], caja[1], ancho, alto] : [0, 0, ancho, alto], rotacion: rotacion % 360, items
    }))
  };
  return { bytes, itemsPorPagina, estructura };
}

/** Imagen RGBA en blanco (papel) de ancho × alto. */
export function lienzoBlanco(ancho, alto) {
  return new Uint8ClampedArray(ancho * alto * 4).fill(255);
}
/** Pinta un rectángulo oscuro en el lienzo RGBA. */
export function pintar(rgba, ancho, { x, y, w, h }, color = [20, 20, 20, 255]) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) rgba.set(color, (j * ancho + i) * 4);
}
