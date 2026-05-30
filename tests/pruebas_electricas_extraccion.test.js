// Extractor automático de mediciones desde el texto del PDF.
//
// Verifica el CONTRATO del extractor puro (sin pdf.js ni Firestore):
// dado el texto plano que pdf.js produce de un informe, deduce las
// mediciones de las 6 pruebas. La política es conservadora: ante la
// duda, null (mejor "n/d" que un color equivocado en el semáforo).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizar, parseNum, extraerMediciones
} from '../assets/js/domain/pruebas_electricas_extraccion.js';

describe('normalizar', () => {
  test('quita acentos, baja a minúsculas y colapsa espacios', () => {
    assert.equal(normalizar('  Relación  DE\tTransformación\n'), ' relacion de transformacion ');
  });
  test('texto vacío / null → cadena vacía', () => {
    assert.equal(normalizar(null), '');
    assert.equal(normalizar(undefined), '');
  });
});

describe('parseNum (decimal coma o punto)', () => {
  test('coma decimal', () => assert.equal(parseNum('0,39'), 0.39));
  test('punto decimal', () => assert.equal(parseNum('0.39'), 0.39));
  test('miles con punto, decimal coma', () => assert.equal(parseNum('1.234,5'), 1234.5));
  test('miles con coma, decimal punto', () => assert.equal(parseNum('1,234.5'), 1234.5));
  test('entero', () => assert.equal(parseNum('49'), 49));
  test('no numérico → null', () => assert.equal(parseNum('abc'), null));
  test('null → null', () => assert.equal(parseNum(null), null));
});

describe('extraerMediciones · tan δ por código', () => {
  test('detecta las 6 configuraciones con coma decimal', () => {
    const texto =
      'Factor de potencia / tan delta. CH 0,39 % CHL 0,27 % CL 1,23 % ' +
      'CLT 0,24 % CT 0,49 % CHT 0,54 %';
    const m = extraerMediciones(texto);
    const byCode = Object.fromEntries(m.tand.map((t) => [t.code, t.valor_pct]));
    assert.equal(byCode.CH, 0.39);
    assert.equal(byCode.CHL, 0.27);
    assert.equal(byCode.CL, 1.23);
    assert.equal(byCode.CLT, 0.24);
    assert.equal(byCode.CT, 0.49);
    assert.equal(byCode.CHT, 0.54);
    assert.ok(m._diagnostico.campos.includes('tand'));
  });
  test('alias por terminales (AT-tierra, etc.)', () => {
    const texto = 'Aislamiento AT-tierra: 0,42 %  AT a MT: 0,34 %';
    const m = extraerMediciones(texto);
    const byCode = Object.fromEntries(m.tand.map((t) => [t.code, t.valor_pct]));
    assert.equal(byCode.CH, 0.42);
    assert.equal(byCode.CHL, 0.34);
  });
  test('descarta valores fuera de rango plausible (>10 %)', () => {
    const texto = 'CH 55 %';   // no es un tan δ creíble
    const m = extraerMediciones(texto);
    assert.equal(m.tand.length, 0);
  });
  test('no confunde "cl" dentro de palabras (clase, ciclo)', () => {
    const texto = 'Equipo clase 1 ciclo 12 sin medicion de aislamiento';
    const m = extraerMediciones(texto);
    assert.equal(m.tand.find((t) => t.code === 'CL'), undefined);
  });
});

describe('extraerMediciones · excitación', () => {
  test('Δ% calculado de tres corrientes en mA', () => {
    const texto = 'Corriente de excitacion: H1 10 mA H2 11 mA H3 12 mA';
    const m = extraerMediciones(texto);
    // (12-10)/12*100 = 16.7
    assert.equal(m.excitacion.corriente_ma, 12);
    assert.equal(m.excitacion.delta_pct, 16.7);
    assert.ok(m._diagnostico.campos.includes('excitacion'));
  });
  test('Δ% declarado explícito gana sobre el cálculo', () => {
    const texto = 'Corriente de excitacion. Desbalance 4,41 % entre fases.';
    const m = extraerMediciones(texto);
    assert.equal(m.excitacion.delta_pct, 4.41);
  });
});

describe('extraerMediciones · relación de transformación', () => {
  test('desviación % (valor absoluto)', () => {
    const texto = 'Relacion de transformacion. Error maximo -0,13 %';
    const m = extraerMediciones(texto);
    assert.equal(m.relacion.desviacion_pct, 0.13);
    assert.ok(m._diagnostico.campos.includes('relacion'));
  });
});

describe('extraerMediciones · resistencia de devanados', () => {
  test('desbalance %', () => {
    const texto = 'Resistencia de devanados. Desbalance 2 %';
    const m = extraerMediciones(texto);
    assert.equal(m.resistencia.desbalance_pct, 2);
  });
  test('detecta marca "verificar" cerca de resistencia', () => {
    const texto = 'Resistencia de devanados con valor a confirmar (verificar en sitio).';
    const m = extraerMediciones(texto);
    assert.equal(m.resistencia.verificar, true);
    assert.ok(m._diagnostico.campos.includes('resistencia'));
  });
});

describe('extraerMediciones · aislamiento', () => {
  test('GΩ directo', () => {
    const texto = 'Resistencia de aislamiento 2,5 GΩ a 1 minuto';
    const m = extraerMediciones(texto);
    assert.equal(m.aislamiento.gohm, 2.5);
  });
  test('MΩ se normaliza a GΩ', () => {
    const texto = 'Resistencia de aislamiento 2500 MΩ';
    const m = extraerMediciones(texto);
    assert.equal(m.aislamiento.gohm, 2.5);
  });
});

describe('extraerMediciones · collar caliente', () => {
  test('toma el mayor valor en mW del bloque', () => {
    const texto = 'Hot collar / collar caliente: buje H1 49 mW, H2 56 mW, H3 51 mW';
    const m = extraerMediciones(texto);
    assert.equal(m.collar.mw, 56);
    assert.ok(m._diagnostico.campos.includes('collar'));
  });
});

describe('extraerMediciones · política conservadora', () => {
  test('texto sin pistas → todo null/vacío, sin campos', () => {
    const m = extraerMediciones('Documento administrativo sin mediciones tecnicas.');
    assert.equal(m.tand.length, 0);
    assert.equal(m.excitacion.delta_pct, null);
    assert.equal(m.relacion.desviacion_pct, null);
    assert.equal(m.resistencia.desbalance_pct, null);
    assert.equal(m.aislamiento.gohm, null);
    assert.equal(m.collar.mw, null);
    assert.deepEqual(m._diagnostico.campos, []);
  });
  test('texto vacío no lanza', () => {
    assert.doesNotThrow(() => extraerMediciones(''));
    assert.doesNotThrow(() => extraerMediciones(null));
  });
});
