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
  });
});

describe('deja pasar', () => {
  test('las estaciones de prueba «EstDemo», los modelos de equipos y los ids internos', () => {
    assert.equal(motivoEnLinea(clave('EstDemo1', 'swTrafo1')), '');
    assert.equal(motivoEnLinea(fila('EstDemo2')), '');
    assert.equal(motivoEnLinea('ZN045' + S + 'FN050' + S + 'FN063'), '');
    assert.equal(motivoEnLinea('SUB1__swTrafo1__66kV'), '');
    assert.equal(motivoEnLinea('../assets/css/aqua-tokens.css'), '');
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
