// Firma de ODT Afinia · constantes del dominio (colecciones, estados, topes, versiones) y su
// amarre con firestore.rules. El bloque `odt_afinia` YA existe: el amarre corre siempre y, si el
// bloque desaparece o se renombra (un merge, por ejemplo), la prueba FALLA en vez de saltarse.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  COL, ESTADOS, LISTA_ESTADOS, ROLES, ETIQUETA_ROL, VERSIONES, COMPOSITOR, PROVEEDOR, TOPES, PDF_LIB,
  esNro, esHuella, esRol, esEstado, tieneFormaFechaDMA, rutaOdt, rutaParte, rutaActo, rutaFirmante, rutaNro, rutaFirmaPropia
} from '../assets/js/domain/odt_afinia_rutas.js';
import { PLANTILLAS, literales } from '../assets/js/domain/odt_afinia_textos.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGLAS = readFileSync(resolve(RAIZ, 'firestore.rules'), 'utf8');
const HAY_BLOQUE = /match\s+\/odt_afinia\//.test(REGLAS);

describe('constantes (DISENO-FINAL §2-§3)', () => {
  test('colecciones con prefijo odt_afinia y firma propia en firmas/{uid}', () => {
    assert.deepEqual({ ...COL }, {
      odt: 'odt_afinia', partes: 'partes', actos: 'actos', devoluciones: 'devoluciones',
      firmantes: 'odt_afinia_firmantes', nro: 'odt_afinia_nro', descargas: 'odt_afinia_descargas', firmaPropia: 'firmas'
    });
    assert.ok(!Object.values(COL).some((c) => /firmas?_(equipo|delegad)|delegaciones_/.test(c)));
  });
  test('estados, roles y etiquetas (CERRADA y REEMPLAZADA se agregan AL FINAL: cambio compatible, 2026-11-21)', () => {
    assert.deepEqual([...LISTA_ESTADOS], ['PENDIENTE_AZT', 'PENDIENTE_RESPONSABLE', 'LISTA', 'ANULADA', 'CERRADA', 'REEMPLAZADA']);
    assert.equal(ESTADOS.LISTA, 'LISTA');
    assert.deepEqual([...ROLES], ['azt', 'responsable']);
    assert.deepEqual({ ...ETIQUETA_ROL }, { azt: 'AZT EN SITIO', responsable: 'RESPONSABLE O.D.T.' });
  });
  test('versiones, compositor y proveedor', () => {
    assert.deepEqual({ ...VERSIONES }, { acuerdo: 'odt-acuerdo-v1', azt: 'odt-azt-v1', responsable: 'odt-resp-v1' });
    assert.equal(COMPOSITOR, 'odt-afinia@2', 'el vigente (2026-11-21): estampa además el N.º en «ODT GENERADA N°»');
    assert.equal(PROVEEDOR, 'password');
    for (const v of Object.values(VERSIONES)) assert.ok(PLANTILLAS[v], 'plantilla de ' + v);
  });
  test('topes', () => {
    assert.equal(TOPES.parte, 921600);
    assert.equal(TOPES.partesMax, 5);
    assert.equal(TOPES.imagenFirma, 921600);
    assert.equal(TOPES.reautenticacionMs, 300000);
    assert.deepEqual([TOPES.motivoMin, TOPES.motivoMax, TOPES.listado, TOPES.actos, TOPES.paginas], [10, 500, 50, 2, 2]);
  });
  test('validadores', () => {
    assert.equal(esNro('00000001'), true);
    for (const n of ['0000001', '000000001', 12345678, ' 00000001', '0000000a']) assert.equal(esNro(n), false, String(n));
    assert.equal(esHuella('a'.repeat(64)), true);
    assert.equal(esHuella('A'.repeat(64)), false);
    assert.equal(esRol('azt'), true); assert.equal(esRol('admin'), false);
    assert.equal(esEstado('LISTA'), true); assert.equal(esEstado('lista'), false);
    assert.equal(tieneFormaFechaDMA('20/11/2026'), true); assert.equal(tieneFormaFechaDMA('2026-11-20'), false);
  });
  test('rutas de documentos', () => {
    assert.equal(rutaOdt('id1'), 'odt_afinia/id1');
    assert.equal(rutaParte('id1', 0), 'odt_afinia/id1/partes/0');
    assert.equal(rutaActo('id1', 'azt'), 'odt_afinia/id1/actos/azt');
    assert.equal(rutaFirmante('uid-azt-prueba'), 'odt_afinia_firmantes/uid-azt-prueba');
    assert.equal(rutaNro('00000001'), 'odt_afinia_nro/00000001');
    assert.equal(rutaFirmaPropia('uid-azt-prueba'), 'firmas/uid-azt-prueba');
  });
  test('pdf-lib fijado', () => {
    assert.equal(PDF_LIB.ruta, 'assets/vendor/pdf-lib-1.17.1.esm.min.js');
    assert.match(PDF_LIB.sha256, /^[0-9a-f]{64}$/);
  });
});

describe('amarre con firestore.rules', () => {
  test('el bloque odt_afinia existe en firestore.rules', () => {
    assert.ok(HAY_BLOQUE, 'no hay «match /odt_afinia/» en firestore.rules');
  });
  test('cada literal de las plantillas v1 está en las reglas, tal cual', () => {
    for (const v of Object.values(VERSIONES)) {
      for (const l of literales(v)) assert.ok(REGLAS.includes("'" + l + "'") || REGLAS.includes('"' + l + '"'), v + ': falta en las reglas el literal ' + JSON.stringify(l));
    }
  });
  test('versiones, compositor, colecciones, estados y topes en las reglas', () => {
    for (const s of [...Object.values(VERSIONES), COMPOSITOR, COL.firmantes, COL.nro, COL.descargas, ...LISTA_ESTADOS]) {
      assert.ok(REGLAS.includes("'" + s + "'") || REGLAS.includes('/' + s + '/'), 'falta ' + s);
    }
    assert.ok(REGLAS.includes('^[0-9]{8}$'), 'N.º de 8 dígitos');
    assert.ok(REGLAS.includes('300000'), 'reautenticación de 5 min en milisegundos');
    assert.ok(/900\s*\*\s*1024/.test(REGLAS), 'parte de 900 KB');
  });
});
