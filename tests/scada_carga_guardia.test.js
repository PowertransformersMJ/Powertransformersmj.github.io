// Guardia de datos SCADA (`99 §122`): ninguna fila de exporte, clave de punto ni tabla de
// homologación del SCADA entra al repo público. Las claves de prueba se ARMAN por partes
// (una línea de este archivo nunca tiene la forma completa) y usan estaciones inventadas.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { motivoEnLinea, revisarTexto, archivoSospechoso } from '../scripts/guardia-scada.mjs';

const S = '/';
const clave = (est, elem, nivel) => S + est + (nivel ? ' ' + S + nivel + '  ' : '') + S + elem;
const fila = (est) => clave(est, 'swTrafo1', '13.8kV') + S + 'I R     ' + S + 'Mv' + 'Moment,1,2,3';

describe('bloquea por forma', () => {
  test('una clave de transformador, de circuito o de línea con una estación con forma real', () => {
    assert.equal(motivoEnLinea(clave('Ficticia', 'swTrafo1')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea(clave('Ficticia', 'swTrafo2', '34.5kV')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea(clave('Inventad', 'XYZ' + '302')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea(clave('Inventad', 'LN' + '570', '34.5kV')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea(clave('Inventad', 'swTrf3')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea(clave('Inventad', 'swAuto1')), 'clave de un punto SCADA');
    // Un elemento de transformador con errata y la forma de un alias de elemento, sin barra inicial (ADR-181).
    assert.equal(motivoEnLinea(clave('Inventad', 'swTa' + 'fo1', '13.8kV')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea('Inventad' + S + 'swTa' + 'fo1=swTrafo1'), 'clave de un punto SCADA');
    // Elemento con letras tras el número y nivel en «KV» (revisión adversarial 2026-10-24).
    assert.equal(motivoEnLinea(clave('Inventad', 'swTraf' + '1F')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea(clave('Inventad', 'swTraf' + '3F', '13.8KV')), 'clave de un punto SCADA');
    assert.equal(motivoEnLinea(clave('Inventad', 'swTrafo1', '13.8 KV')), 'clave de un punto SCADA');
  });
  test('el nombre SUELTO de un circuito o de una línea, sin la estación (suma de circuitos, 2026-10-24)', () => {
    const c1 = 'XYZ' + '301'; const c2 = 'XYZ' + '302';
    assert.equal(motivoEnLinea('13,8 kV = suma de circuitos ' + c1 + ' + ' + c2), 'nombre de un circuito o línea del SCADA');
    assert.equal(motivoEnLinea('Secundario por suma de circuitos ' + c1), 'nombre de un circuito o línea del SCADA');
    assert.equal(motivoEnLinea('la línea ' + 'LN' + '570'), 'nombre de un circuito o línea del SCADA');
  });
  test('una línea larga sin barras no la cuelga (búsqueda con tope)', () => {
    const t0 = Date.now();
    assert.equal(motivoEnLinea('A'.repeat(200000)), '');
    assert.equal(motivoEnLinea('a'.repeat(200000)), '');
    assert.ok(Date.now() - t0 < 1500, 'tardó ' + (Date.now() - t0) + ' ms');
  });
  test('una fila de exporte', () => {
    assert.equal(motivoEnLinea(fila('Ficticia')), 'fila de un exporte del SCADA');
    assert.deepEqual(revisarTexto('hola\n' + fila('Ficticia')).map((x) => x.n), [2]);
  });
  test('tablas con nombre de exporte o de homologación', () => {
    assert.ok(archivoSospechoso('Homologacion de Transformadores SCADA.xlsx'));
    assert.ok(archivoSospechoso('ir_' + 'average-20260310.csv'));
    assert.ok(!archivoSospechoso('tests/fixtures/otra-cosa.csv'));
    assert.ok(!archivoSospechoso('docs/homologacion.md'));
    // El paquete de placas características (ADR-166) tampoco entra.
    assert.ok(archivoSospechoso('paquete-placas-2026-10-22/placas-parte-01.json'));
    assert.ok(archivoSospechoso('placas-parte-7.json'));
    assert.ok(!archivoSospechoso('admin/placas-caracteristicas.html'));
  });
});

describe('deja pasar', () => {
  test('las estaciones de prueba «EstDemo», los modelos de equipos y los ids internos', () => {
    assert.equal(motivoEnLinea(clave('EstDemo1', 'swTrafo1')), '');
    assert.equal(motivoEnLinea(fila('EstDemo2')), '');
    assert.equal(motivoEnLinea('ZN045' + S + 'FN050' + S + 'FN063'), '');
    assert.equal(motivoEnLinea('SUB1__swTrafo1__66kV'), '');
    assert.equal(motivoEnLinea('../assets/css/aqua-tokens.css'), '');
    // Los circuitos de prueba «EDM3xx», un color «#RRGGBB» y un número de más cifras no son circuitos.
    assert.equal(motivoEnLinea('suma de circuitos ' + 'EDM' + '301 + ' + 'EDM' + '302'), '');
    assert.equal(motivoEnLinea("'#" + 'EAB' + "308'"), '');
    assert.equal(motivoEnLinea('ABC' + '3012'), '');
  });
  test('el repositorio actual no tiene ningún falso positivo', () => {
    const archivos = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n')
      .filter((f) => f && !/\.(png|jpe?g|gif|webp|pdf|xlsx?|emf|woff2?|ico|zip|docx|pptx|mp4)$/i.test(f));
    const con = [];
    for (const f of archivos) {
      let t; try { t = readFileSync(f, 'utf8'); } catch (_) { continue; }
      if (revisarTexto(t).length) con.push(f);
    }
    assert.deepEqual(con, []);
  });
});

describe('fotos embebidas (placas características, ADR-166)', () => {
  test('un JPEG largo en base64 se bloquea; un texto corto con la marca, no', () => {
    const marca = '/9' + 'j/';
    assert.match(motivoEnLinea('"b64":"' + marca + '4AAQSkZJRg' + 'A'.repeat(500) + '"'), /foto embebida/);
    assert.equal(motivoEnLinea('empieza por ' + marca + ' en base64'), '');
  });
});
