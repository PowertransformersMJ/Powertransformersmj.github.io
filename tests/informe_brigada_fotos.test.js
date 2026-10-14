// Fotos del Informe de Mantenimiento Brigada (decisión 5): plan de reducción, «manda
// el peso», medidas por bytes y detección de EXIF/GPS. JPEG y PNG SINTÉTICOS armados
// byte a byte aquí mismo: ninguna foto real ni archivo en disco.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PARAMS_FOTO, PARAMS_ANEXO, PARAMS_FICHA, PARAMS_FIRMA, PARAMS_LOGO,
  planEscalado, intentosJpeg, elegirResultado, tieneExif, metadatosEn, dimensionesImagen, validarEntrada, pesoLegible
} from '../assets/js/domain/informe_brigada_fotos.js';
import { pngColor } from '../assets/js/domain/png_simple.js';

/* JPEG mínimo: SOI + segmentos + SOFn (medidas) + SOS + datos + EOI. */
function seg(marcador, datos) {
  const d = typeof datos === 'string' ? Uint8Array.from(datos, (c) => c.charCodeAt(0)) : datos;
  const n = d.length + 2;
  return [0xFF, marcador, n >> 8, n & 0xFF, ...d];
}
function jpeg({ ancho = 4032, alto = 3024, sof = 0xC0, exif = false, xmp = false, iptc = false } = {}) {
  const b = [0xFF, 0xD8];
  b.push(...seg(0xE0, 'JFIF\u0000\u0001\u0001\u0000\u0000\u0001\u0000\u0001\u0000\u0000'));
  if (exif) b.push(...seg(0xE1, 'Exif\u0000\u0000MM\u0000*\u0000\u0000\u0000\u0008GPS-PRUEBA'));
  if (xmp) b.push(...seg(0xE1, 'http://ns.adobe.com/xap/1.0/\u0000<x:xmpmeta/>'));
  if (iptc) b.push(...seg(0xED, 'Photoshop 3.0\u0000'));
  b.push(...seg(0xDB, new Uint8Array(65)));                                  // tabla de cuantización
  b.push(...seg(sof, Uint8Array.from([8, alto >> 8, alto & 0xFF, ancho >> 8, ancho & 0xFF, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1])));
  b.push(...seg(0xDA, Uint8Array.from([3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3F, 0])));
  b.push(0x12, 0x34, 0xFF, 0x00, 0x56, 0xFF, 0xD9);
  return Uint8Array.from(b);
}
/* PNG con un bloque de texto (como los que deja una cámara o un editor). */
function pngConTexto() {
  const p = pngColor(2, 2, '#123456');
  const corte = p.length - 12;                                               // antes de IEND
  const tipo = Uint8Array.from('tEXt', (c) => c.charCodeAt(0));
  const datos = Uint8Array.from('Comment\u0000ubicacion', (c) => c.charCodeAt(0));
  const extra = new Uint8Array(12 + datos.length);
  new DataView(extra.buffer).setUint32(0, datos.length);
  extra.set(tipo, 4); extra.set(datos, 8);                                   // CRC en cero: aquí solo se busca el tipo
  const out = new Uint8Array(p.length + extra.length);
  out.set(p.subarray(0, corte)); out.set(extra, corte); out.set(p.subarray(corte), corte + extra.length);
  return out;
}

describe('Plan de reducción', () => {
  test('planEscalado: nunca agranda y redondea a enteros', () => {
    assert.deepEqual(planEscalado(4032, 3024, 1600), { ancho: 1600, alto: 1200 });
    assert.deepEqual(planEscalado(3024, 4032, 1600), { ancho: 1200, alto: 1600 });
    assert.deepEqual(planEscalado(800, 600, 1600), { ancho: 800, alto: 600 });
    assert.deepEqual(planEscalado(3000, 1, 1000), { ancho: 1000, alto: 1 });
  });

  test('topes acordados: foto 160 KB (tope 700 KB = reglas de Storage), firma y logo en PNG', () => {
    assert.deepEqual(PARAMS_FOTO.escalones, [1600, 1280, 1000]);
    assert.equal(PARAMS_FOTO.objetivo, 160 * 1024);
    assert.equal(PARAMS_FOTO.tope, 700 * 1024);
    assert.equal(PARAMS_ANEXO.tope, 700 * 1024);
    assert.equal(PARAMS_FICHA.tope, 2 * 1024 * 1024);
    assert.equal(PARAMS_FIRMA.png, true);
    assert.equal(PARAMS_FIRMA.tope, 512 * 1024);
    assert.equal(PARAMS_LOGO.tope, 1024 * 1024);
  });

  test('manda el peso: primero baja la calidad a 1600 px y después el lado', () => {
    const i = intentosJpeg(PARAMS_FOTO, 4032, 3024);
    assert.equal(i.length, 12);
    assert.deepEqual(i.slice(0, 4).map((x) => [x.ancho, x.calidad]), [[1600, 0.82], [1600, 0.74], [1600, 0.66], [1600, 0.58]]);
    assert.deepEqual([...new Set(i.map((x) => x.ancho))], [1600, 1280, 1000]);
    // una foto pequeña no se agranda: un solo tamaño
    assert.deepEqual([...new Set(intentosJpeg(PARAMS_FOTO, 900, 700).map((x) => x.ancho))], [900]);
  });

  test('elegirResultado: el primero bajo el objetivo; si no, el más liviano bajo el tope; si no, nada', () => {
    const p = { objetivo: 100, tope: 300 };
    assert.equal(elegirResultado([{ tamano: 250 }, { tamano: 90 }, { tamano: 80 }], p).tamano, 90);
    assert.equal(elegirResultado([{ tamano: 290 }, { tamano: 150 }], p).tamano, 150);
    assert.equal(elegirResultado([{ tamano: 400 }, { tamano: 350 }], p), null);
  });
});

describe('Metadatos y medidas por bytes', () => {
  test('tieneExif: detecta el APP1 «Exif» (ahí va el GPS) y no confunde el JFIF', () => {
    assert.equal(tieneExif(jpeg({ exif: true })), true);
    assert.equal(tieneExif(jpeg()), false);
    assert.equal(tieneExif(pngColor(2, 2, '#000000')), false);
  });

  test('metadatosEn: Exif, XMP e IPTC en JPEG; bloques de texto en PNG; limpio = []', () => {
    assert.deepEqual(metadatosEn(jpeg({ exif: true, xmp: true, iptc: true })), ['Exif', 'XMP', 'IPTC']);
    assert.deepEqual(metadatosEn(jpeg()), []);
    assert.deepEqual(metadatosEn(pngConTexto()), ['tEXt']);
    assert.deepEqual(metadatosEn(pngColor(3, 3, '#FFFFFF')), []);
  });

  test('dimensionesImagen: JPEG básico (SOF0), progresivo (SOF2) y PNG', () => {
    assert.deepEqual(dimensionesImagen(jpeg({ ancho: 4032, alto: 3024 })), { tipo: 'jpeg', ancho: 4032, alto: 3024 });
    assert.deepEqual(dimensionesImagen(jpeg({ ancho: 1200, alto: 1600, sof: 0xC2, exif: true })), { tipo: 'jpeg', ancho: 1200, alto: 1600 });
    assert.deepEqual(dimensionesImagen(pngColor(7, 5, '#000000')), { tipo: 'png', ancho: 7, alto: 5 });
    assert.equal(dimensionesImagen(new Uint8Array([1, 2, 3])), null);
  });
});

describe('validarEntrada (por los bytes, nunca por la extensión)', () => {
  test('acepta JPEG y PNG', () => {
    assert.deepEqual(validarEntrada(jpeg()), { ok: true, tipo: 'jpeg' });
    assert.deepEqual(validarEntrada(pngColor(2, 2, '#000000')), { ok: true, tipo: 'png' });
  });
  test('HEIC del iPhone: el mensaje que ya usa Fichas', () => {
    const heic = Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);
    const r = validarEntrada(heic);
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /HEIC/);
  });
  test('un Excel o un archivo vacío no pasan', () => {
    const zip = Uint8Array.from([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.match(validarEntrada(zip).mensaje, /Solo se admiten imágenes/);
    assert.equal(validarEntrada(new Uint8Array(0)).ok, false);
  });
  test('un PDF, un .xls o un archivo desconocido: mensaje de imágenes, nunca el de Excel de Fichas', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4 prueba');
    const ole = Uint8Array.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0]);
    for (const b of [pdf, ole]) {
      const r = validarEntrada(b);
      assert.equal(r.ok, false);
      assert.match(r.mensaje, /Solo se admiten imágenes/);
      assert.doesNotMatch(r.mensaje, /Excel/);
    }
  });
  test('pesoLegible', () => {
    assert.equal(pesoLegible(141 * 1024), '141 KB');
    assert.equal(pesoLegible(1.25 * 1048576), '1,3 MB');
  });
});
