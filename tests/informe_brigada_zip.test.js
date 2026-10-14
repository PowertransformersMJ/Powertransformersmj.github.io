// Zip «almacenado» del Word del Informe de Mantenimiento Brigada: CRC-32 correcto,
// se lee de vuelta con jszip y la salida es determinista. Sin archivos en disco.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

import { crc32, crearZip } from '../assets/js/domain/zip_almacenado.js';

describe('CRC-32', () => {
  test('vector conocido «123456789» = 0xCBF43926', () => {
    assert.equal(crc32('123456789'), 0xCBF43926);
  });
  test('vacío = 0 y se puede encadenar', () => {
    assert.equal(crc32(new Uint8Array(0)), 0);
    assert.equal(crc32('6789', crc32('12345')), crc32('123456789'));
  });
});

describe('crearZip', () => {
  const entradas = () => [
    { nombre: '[Content_Types].xml', datos: '<Types/>' },
    { nombre: 'word/document.xml', datos: '<w:document>Ñandú · «prueba» – ok</w:document>' },
    { nombre: 'word/media/imagen1.png', datos: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2, 3, 250, 0]) },
    { nombre: 'carpeta con tildes/ácido.txt', datos: 'texto' },
  ];

  test('jszip lo lee y cada entrada sale idéntica', async () => {
    const zip = await JSZip.loadAsync(crearZip(entradas()));
    for (const e of entradas()) {
      const f = zip.file(e.nombre);
      assert.ok(f, `falta ${e.nombre}`);
      if (typeof e.datos === 'string') assert.equal(await f.async('string'), e.datos);
      else assert.deepEqual(new Uint8Array(await f.async('uint8array')), e.datos);
    }
    assert.equal(Object.keys(zip.files).length, entradas().length);
  });

  test('método 0 (sin compresión), nombres en UTF-8 y fecha fija', () => {
    const z = crearZip([{ nombre: 'ácido.xml', datos: 'x' }]);
    const v = new DataView(z.buffer);
    assert.equal(v.getUint32(0, true), 0x04034B50);
    assert.equal(v.getUint16(6, true) & 0x0800, 0x0800, 'bandera UTF-8');
    assert.equal(v.getUint16(8, true), 0, 'método almacenado');
    assert.equal(v.getUint16(12, true), (1 << 5) | 1, '1980-01-01');
    assert.equal(new TextDecoder().decode(z.subarray(30, 30 + 'ácido.xml'.length + 1)), 'ácido.xml');
  });

  test('salida determinista: mismas entradas, mismos bytes', () => {
    assert.deepEqual(crearZip(entradas()), crearZip(entradas()));
  });

  test('rechaza nombres repetidos, vacíos o absolutos', () => {
    assert.throws(() => crearZip([{ nombre: 'a.xml', datos: '' }, { nombre: 'a.xml', datos: '' }]), /repetida/);
    assert.throws(() => crearZip([{ nombre: '', datos: '' }]), /inválido/);
    assert.throws(() => crearZip([{ nombre: '/a.xml', datos: '' }]), /inválido/);
  });

  test('un zip vacío es válido', async () => {
    const zip = await JSZip.loadAsync(crearZip([]));
    assert.equal(Object.keys(zip.files).length, 0);
  });
});
