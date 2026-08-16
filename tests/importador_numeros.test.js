// Tests de la normalización numérica del importador Excel.
// Fijan el criterio "separador decimal vs. separador de MILES":
// confundirlos corrompía el dato en silencio (60.000 kVA → 60 kVA)
// y el reporte de importación seguía diciendo "exitoso".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizarNumeroExcel, parsearFilaTransformador
} from '../assets/js/domain/importador.js';

describe('normalizarNumeroExcel — miles a la inglesa (SheetJS raw:false)', () => {
  test('"60,000" (celda con formato de miles) → 60000, NO 60', () => {
    assert.equal(normalizarNumeroExcel('60,000'), 60000);
  });

  test('"1,234,567" → 1234567 (varios grupos de miles)', () => {
    assert.equal(normalizarNumeroExcel('1,234,567'), 1234567);
  });

  test('"1,234.5" → 1234.5 (coma miles + punto decimal)', () => {
    assert.equal(normalizarNumeroExcel('1,234.5'), 1234.5);
  });
});

describe('normalizarNumeroExcel — formato colombiano', () => {
  test('"1.234,5" → 1234.5 (punto miles, coma decimal)', () => {
    assert.equal(normalizarNumeroExcel('1.234,5'), 1234.5);
  });

  test('"0,05" → 0.05 (coma decimal, no miles)', () => {
    assert.equal(normalizarNumeroExcel('0,05'), 0.05);
  });

  test('"1,5" → 1.5 (coma decimal)', () => {
    assert.equal(normalizarNumeroExcel('1,5'), 1.5);
  });

  test('"1.000.000" → 1000000 (puntos de miles inequívocos)', () => {
    assert.equal(normalizarNumeroExcel('1.000.000'), 1000000);
  });

  test('"1234,5" → 1234.5 (sin agrupar, la coma es decimal)', () => {
    assert.equal(normalizarNumeroExcel('1234,5'), 1234.5);
  });
});

describe('normalizarNumeroExcel — vacíos y basura → null (nunca 0)', () => {
  test('"" → null', () => {
    assert.equal(normalizarNumeroExcel(''), null);
  });

  test('"N/A" → null', () => {
    assert.equal(normalizarNumeroExcel('N/A'), null);
  });

  test('null / undefined → null', () => {
    assert.equal(normalizarNumeroExcel(null), null);
    assert.equal(normalizarNumeroExcel(undefined), null);
  });
});

describe('normalizarNumeroExcel — NO REGRESIÓN (casos que ya funcionaban)', () => {
  test('número nativo de SheetJS pasa intacto', () => {
    assert.equal(normalizarNumeroExcel(60000), 60000);
    assert.equal(normalizarNumeroExcel(34.5), 34.5);
    assert.equal(normalizarNumeroExcel(0), 0);
  });

  test('entero como texto: "50000" → 50000', () => {
    assert.equal(normalizarNumeroExcel('50000'), 50000);
  });

  test('punto decimal único se respeta: "34.5" · "13.8" · "0.05"', () => {
    assert.equal(normalizarNumeroExcel('34.5'), 34.5);
    assert.equal(normalizarNumeroExcel('13.8'), 13.8);
    assert.equal(normalizarNumeroExcel('0.05'), 0.05);
  });

  test('coma decimal simple sigue funcionando: "34,5" → 34.5', () => {
    assert.equal(normalizarNumeroExcel('34,5'), 34.5);
  });

  test('espacios sobrantes y negativos: " 34.5 " · "-74.8"', () => {
    assert.equal(normalizarNumeroExcel(' 34.5 '), 34.5);
    assert.equal(normalizarNumeroExcel('-74.8'), -74.8);
  });
});

describe('normalizarNumeroExcel — coordenadas (comaSiempreDecimal)', () => {
  test('"10,391" como coordenada → 10.391, no 10391', () => {
    assert.equal(
      normalizarNumeroExcel('10,391', { comaSiempreDecimal: true }), 10.391);
  });

  test('longitud negativa "-74,812" → -74.812', () => {
    assert.equal(
      normalizarNumeroExcel('-74,812', { comaSiempreDecimal: true }), -74.812);
  });
});

describe('importador — el bug de campo end-to-end', () => {
  test('POTENCIA "60,000" se guarda como 60000 kVA (antes: 60)', () => {
    const { docV2 } = parsearFilaTransformador({
      'MATRICULA': 'TX-A-01',
      'SUBESTACION': 'SUBESTACION A',
      'DEPARTAMENTO': 'BOLIVAR',
      'POTENCIA (KVA)': '60,000'
    }, 'TX_Potencia');
    assert.equal(docV2.placa.potencia_kva, 60000);
  });

  test('rigidez "1.234,5" ya no se pierde (antes: null)', () => {
    const { docV2 } = parsearFilaTransformador({
      'MATRICULA': 'TX-A-02',
      'SUBESTACION': 'SUBESTACION A',
      'DEPARTAMENTO': 'BOLIVAR',
      'RIGIDEZ DIELECTRICA': '1.234,5'
    }, 'TX_Potencia');
    assert.ok(docV2.salud_actual.calif_rd != null,
      'con rigidez legible la calificación RD debe existir');
  });

  test('gases DGA con miles a la inglesa: CO2 "2,000" → 2000', () => {
    const { docV2 } = parsearFilaTransformador({
      'MATRICULA': 'TX-A-03',
      'SUBESTACION': 'SUBESTACION A',
      'DEPARTAMENTO': 'BOLIVAR',
      'co2': '2,000'
    }, 'TX_Potencia');
    // 2000 ppm de CO2 no califica igual que 2 ppm: el veredicto cambia.
    assert.ok(docV2.salud_actual.calif_co2 != null);
    assert.equal(
      docV2.salud_actual.calif_co2,
      parsearFilaTransformador({
        'MATRICULA': 'TX-A-04',
        'SUBESTACION': 'SUBESTACION A',
        'DEPARTAMENTO': 'BOLIVAR',
        'co2': 2000
      }, 'TX_Potencia').docV2.salud_actual.calif_co2);
  });

  test('coordenadas con coma decimal no explotan a miles', () => {
    const { docV2 } = parsearFilaTransformador({
      'MATRICULA': 'TX-A-05',
      'SUBESTACION': 'SUBESTACION A',
      'DEPARTAMENTO': 'BOLIVAR',
      'latitud': '10,391',
      'longitud': '-74,812'
    }, 'TX_Potencia');
    assert.equal(docV2.ubicacion.latitud, 10.391);
    assert.equal(docV2.ubicacion.longitud, -74.812);
  });
});
