// Fechas de la ficha escogidas en calendario (`99 §91`): el calendario habla ISO,
// el papel PE.02081 escribe «dd/mm/aaaa». Pantalla y Excel usan estas funciones.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fechaAISO, isoAFecha, fechaParaPapel } from '../assets/js/domain/fichas_fechas.js';

describe('Conversión calendario ↔ papel', () => {
  test('ida y vuelta: lo que se elige en el calendario es lo que se imprime', () => {
    assert.equal(isoAFecha('2026-12-15'), '15/12/2026');
    assert.equal(fechaAISO('15/12/2026'), '2026-12-15');
    assert.equal(isoAFecha(fechaAISO('01/02/2027')), '01/02/2027');
  });

  test('las fechas escritas a mano antes del calendario se reconocen', () => {
    assert.equal(fechaAISO('1/2/2027'), '2027-02-01');
    assert.equal(fechaAISO('15-12-2026'), '2026-12-15');
    assert.equal(fechaAISO('15.12.2026'), '2026-12-15');
    assert.equal(fechaAISO('2026-12-15'), '2026-12-15');
  });

  test('un día que no existe NO se convierte en otro', () => {
    for (const v of ['31/04/2026', '29/02/2027', '00/01/2026', '32/01/2026', '15/13/2026', '2026-02-30']) {
      assert.equal(fechaAISO(v), '', v);
    }
    assert.equal(fechaAISO('29/02/2028'), '2028-02-29', 'bisiesto');
    assert.equal(isoAFecha('2027-02-29'), '');
  });

  test('vacío o texto que no es fecha: el calendario queda vacío', () => {
    for (const v of [null, undefined, '', '  ', 'diciembre 2026', 'aaaa', '2026']) assert.equal(fechaAISO(v), '', String(v));
    assert.equal(isoAFecha(''), '');
  });
});

describe('fechaParaPapel — cómo sale en el Excel', () => {
  test('una fecha real sale siempre «dd/mm/aaaa»', () => {
    assert.equal(fechaParaPapel('2026-12-15'), '15/12/2026');
    assert.equal(fechaParaPapel('1/2/2027'), '01/02/2027');
    assert.equal(fechaParaPapel(' 15/12/2026 '), '15/12/2026');
  });

  test('un texto viejo que no es fecha sale tal cual: no se inventa otra', () => {
    assert.equal(fechaParaPapel('diciembre 2026'), 'diciembre 2026');
    assert.equal(fechaParaPapel('31/04/2026'), '31/04/2026');
    assert.equal(fechaParaPapel(''), '');
    assert.equal(fechaParaPapel(null), '');
  });
});
