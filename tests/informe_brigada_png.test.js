// PNG simple (franja, recuadro, viñeta ⊞ y marcador «pendiente») del Word del
// Informe de Mantenimiento Brigada: firma, IHDR, CRC de cada bloque, Adler-32 y
// que el inflate de node lo descomprime a los mismos píxeles.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { pngRGBA, pngColor, pngVineta, pngMarcador, hexARgb } from '../assets/js/domain/png_simple.js';
import { crc32 } from '../assets/js/domain/zip_almacenado.js';

/** Lee los bloques de un PNG y comprueba su CRC. */
function bloques(png) {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'firma PNG');
  const out = [];
  let p = 8;
  while (p < png.length) {
    const n = v.getUint32(p);
    const tipo = String.fromCharCode(...png.subarray(p + 4, p + 8));
    const datos = png.subarray(p + 8, p + 8 + n);
    assert.equal(v.getUint32(p + 8 + n), crc32(png.subarray(p + 4, p + 8 + n)), `CRC del bloque ${tipo}`);
    out.push({ tipo, datos });
    p += 12 + n;
  }
  return out;
}

function adler32(b) {
  let a = 1, s = 0;
  for (const x of b) { a = (a + x) % 65521; s = (s + a) % 65521; }
  return ((s << 16) | a) >>> 0;
}

describe('pngRGBA', () => {
  test('IHDR, IDAT e IEND válidos; el inflate de node devuelve los mismos píxeles', () => {
    const w = 3, h = 2;
    const px = Uint8Array.from({ length: w * h * 4 }, (_, i) => (i * 37) & 0xFF);
    const b = bloques(pngRGBA(w, h, px));
    assert.deepEqual(b.map((x) => x.tipo), ['IHDR', 'IDAT', 'IEND']);
    const ihdr = new DataView(b[0].datos.buffer, b[0].datos.byteOffset, 13);
    assert.equal(ihdr.getUint32(0), w);
    assert.equal(ihdr.getUint32(4), h);
    assert.equal(b[0].datos[8], 8, '8 bits');
    assert.equal(b[0].datos[9], 6, 'RGBA');
    const crudo = inflateSync(Buffer.from(b[1].datos));
    assert.equal(crudo.length, h * (w * 4 + 1));
    for (let y = 0; y < h; y++) {
      assert.equal(crudo[y * (w * 4 + 1)], 0, 'filtro «ninguno»');
      assert.deepEqual([...crudo.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1))], [...px.subarray(y * w * 4, (y + 1) * w * 4)]);
    }
    const idat = b[1].datos;
    const ad = new DataView(idat.buffer, idat.byteOffset + idat.length - 4, 4).getUint32(0);
    assert.equal(ad, adler32(crudo), 'Adler-32');
  });

  test('imagen de más de 64 KB: varios bloques «stored» y sigue descomprimiendo', () => {
    const w = 200, h = 100;
    const px = new Uint8Array(w * h * 4).fill(200);
    const b = bloques(pngRGBA(w, h, px));
    assert.equal(inflateSync(Buffer.from(b[1].datos)).length, h * (w * 4 + 1));
  });

  test('rechaza medidas o bytes que no cuadran', () => {
    assert.throws(() => pngRGBA(0, 1, new Uint8Array(0)), RangeError);
    assert.throws(() => pngRGBA(2, 2, new Uint8Array(3)), RangeError);
  });
});

describe('imágenes del formato', () => {
  test('pngColor: un solo color exacto (franja #FB6600)', () => {
    const b = bloques(pngColor(4, 2, '#FB6600'));
    const crudo = inflateSync(Buffer.from(b[1].datos));
    assert.deepEqual([...crudo.subarray(1, 5)], [0xFB, 0x66, 0x00, 0xFF]);
    assert.deepEqual(hexARgb('ED7D31'), [0xED, 0x7D, 0x31]);
    assert.throws(() => hexARgb('naranja'), RangeError);
  });

  test('pngVineta: proporción 7,75 : 8, naranja en el borde y blanco dentro', () => {
    const b = bloques(pngVineta(40));
    const ihdr = new DataView(b[0].datos.buffer, b[0].datos.byteOffset, 13);
    const w = ihdr.getUint32(0), h = ihdr.getUint32(4);
    assert.equal(h, 40);
    assert.equal(w, Math.round(40 * 7.75 / 8));
    const crudo = inflateSync(Buffer.from(b[1].datos));
    const pix = (x, y) => [...crudo.subarray(y * (w * 4 + 1) + 1 + x * 4, y * (w * 4 + 1) + 1 + x * 4 + 4)];
    assert.deepEqual(pix(Math.floor(w / 2), 2), [0xF7, 0x96, 0x46, 0xFF], 'borde #F79646');
    assert.deepEqual(pix(Math.floor(w * 0.3), Math.floor(h * 0.3)), [0xFF, 0xFF, 0xFF, 0xFF], 'interior blanco');
    assert.deepEqual(pix(Math.floor(w / 2), Math.floor(h / 2)), [0xF7, 0x96, 0x46, 0xFF], 'cruz naranja');
    assert.equal(pix(0, 0)[3], 0, 'esquina redondeada transparente');
  });

  test('pngMarcador: recuadro punteado con fondo transparente', () => {
    const b = bloques(pngMarcador(60, 30));
    assert.deepEqual(b.map((x) => x.tipo), ['IHDR', 'IDAT', 'IEND']);
  });
});
