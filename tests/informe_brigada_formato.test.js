// Informe de Mantenimiento Brigada (F60-ADM) — cómo se escriben los datos en el papel.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  numES, listaY, fechaDMA, rangoFechas, ordinalEs, mayusculasEs, tipoTituloEs, matriculaArchivo,
  departamentoPapel, departamentoConocido
} from '../assets/js/domain/informe_brigada_formato.js';
import { DEPARTAMENTOS } from '../assets/js/domain/schema.js';

describe('numES: coma decimal y sin ceros de relleno, como el modelo', () => {
  test('decimales, enteros y vacíos', () => {
    assert.equal(numES(2.03), '2,03');
    assert.equal(numES(1.9), '1,9');
    assert.equal(numES(14), '14');
    assert.equal(numES(34500), '34500');
    assert.equal(numES(0.1 + 0.2), '0,3');
    assert.equal(numES(null), '');
    assert.equal(numES(undefined), '');
    assert.equal(numES(NaN), '');
    assert.equal(numES('texto'), 'texto');
  });
});

describe('listaY', () => {
  test('0, 1, 2 y 3 elementos; ignora vacíos', () => {
    assert.equal(listaY([]), '');
    assert.equal(listaY(['A']), 'A');
    assert.equal(listaY(['A', 'B']), 'A y B');
    assert.equal(listaY(['A', 'B', 'C']), 'A, B y C');
    assert.equal(listaY(['A', '', '  ', 'B']), 'A y B');
    assert.equal(listaY(['A', 'B'], 'o'), 'A o B');
    assert.equal(listaY(null), '');
  });
});

describe('fechas', () => {
  test('fechaDMA: ISO → dd/mm/aaaa; lo que no es fecha → vacío', () => {
    assert.equal(fechaDMA('2026-02-21'), '21/02/2026');
    assert.equal(fechaDMA(''), '');
    assert.equal(fechaDMA('2026-02-30'), '');
    assert.equal(fechaDMA(null), '');
  });
  test('rangoFechas: los 4 casos del modelo', () => {
    assert.equal(rangoFechas('2026-02-20', '2026-02-20'), 'el 20 de febrero de 2026');
    assert.equal(rangoFechas('2026-02-20', '2026-02-21'), 'del 20 al 21 de febrero de 2026');
    assert.equal(rangoFechas('2026-02-28', '2026-03-02'), 'del 28 de febrero al 2 de marzo de 2026');
    assert.equal(rangoFechas('2025-12-30', '2026-01-02'), 'del 30 de diciembre de 2025 al 2 de enero de 2026');
  });
  test('rangoFechas con una sola fecha o ninguna', () => {
    assert.equal(rangoFechas('2026-05-07', ''), 'el 7 de mayo de 2026');
    assert.equal(rangoFechas('', '2026-05-07'), 'el 7 de mayo de 2026');
    assert.equal(rangoFechas('', ''), '');
  });
});

describe('ordinalEs, mayúsculas y tipo título', () => {
  test('ordinales antes de sustantivo masculino', () => {
    assert.equal(ordinalEs(1), 'primer');
    assert.equal(ordinalEs(3), 'tercer');
    assert.equal(ordinalEs(4), 'cuarto');
    assert.equal(ordinalEs(12), 'duodécimo');
    assert.equal(ordinalEs(13), '13.º');
    assert.equal(ordinalEs(0), '');
  });
  test('mayúsculas con tildes y Ñ', () => {
    assert.equal(mayusculasEs('ñandú córdoba'), 'ÑANDÚ CÓRDOBA');
    assert.equal(mayusculasEs(null), '');
  });
  test('tipo título: partículas en minúscula, romanos en mayúscula', () => {
    assert.equal(tipoTituloEs('SAN JUAN DEL CESAR'), 'San Juan del Cesar');
    assert.equal(tipoTituloEs('PRUEBA NORTE'), 'Prueba Norte');
    assert.equal(tipoTituloEs('EL BANCO DE LA PRUEBA'), 'El Banco de la Prueba');
    assert.equal(tipoTituloEs('PRUEBA II'), 'Prueba II');
    assert.equal(tipoTituloEs('Ya Escrita'), 'Ya Escrita');
    assert.equal(tipoTituloEs('  '), '');
  });
});

describe('matrícula para nombre de archivo y departamento del papel', () => {
  test('matriculaArchivo cambia los caracteres prohibidos por «_»', () => {
    assert.equal(matriculaArchivo('T9-Z/Z-PRU'), 'T9-Z_Z-PRU');
    assert.equal(matriculaArchivo('A\\B:C*D?E"F<G>H|I'), 'A_B_C_D_E_F_G_H_I');
  });
  test('departamentoPapel: en MAYÚSCULAS y con su tilde', () => {
    assert.equal(departamentoPapel('cordoba'), 'CÓRDOBA');
    assert.equal(departamentoPapel('Córdoba'), 'CÓRDOBA');
    assert.equal(departamentoPapel('CORDOBA'), 'CÓRDOBA');
    assert.equal(departamentoPapel('bolivar'), 'BOLÍVAR');
    assert.equal(departamentoPapel('cesar'), 'CESAR');
    assert.equal(departamentoPapel('Departamento Inventado'), 'DEPARTAMENTO INVENTADO');
    assert.equal(departamentoPapel(''), '');
  });
  test('amarre: cada departamento de schema.js sale con su nombre oficial en mayúsculas', () => {
    for (const d of DEPARTAMENTOS) {
      assert.equal(departamentoPapel(d.value), d.label.toLocaleUpperCase('es-CO'));
      assert.ok(departamentoConocido(d.value) && departamentoConocido(d.label.toLocaleUpperCase('es-CO')));
    }
    assert.equal(departamentoConocido('Departamento Inventado'), false);
  });
});
