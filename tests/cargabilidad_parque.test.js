// Cargabilidad derivada del PARQUE REAL (ADR-067).
//
// La pantalla mostraba tres transformadores inventados («SUB-DEMO-NORTE»,
// matrícula «TD-01») como si fueran el parque, porque leía un baseline de
// demostración y la colección que debía sustituirlo nunca se pobló. Estos
// tests fijan que las filas salgan del parque y que la incoherencia de la
// fuente se señale en vez de disimularse.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  cargabilidadDeParque, filaCargabilidad, devanado, TOLERANCIA_PCT
} from '../assets/js/domain/cargabilidad_parque.js';

const tx = (extra = {}) => ({
  identificacion: { matricula: 'T1-M/M-ABA', codigo: 'T1-M/M-ABA', uucc: 'N3T1' },
  ubicacion: { subestacion_nombre: 'AGUAS BLANCAS', zona: 'ORIENTE', departamento: 'cesar' },
  placa: { potencia_kva: 2000 },
  electrico: {
    tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8,
    corriente_nominal_primaria_a: 502, corriente_medida_primaria_a: 88
  },
  salud_actual: { crg_pct_medido: 88 },
  ...extra
});

describe('devanado — el porcentaje oficial manda, el desacuerdo se marca', () => {
  test('sin oficial, se usa el cociente carga/ampacidad', () => {
    const d = devanado(100, 59, null);
    assert.equal(d.pct, 59);
    assert.equal(d.desacuerdo, false);
  });

  test('con oficial que concuerda, no hay desacuerdo', () => {
    const d = devanado(41.84, 24.6856, 59);
    assert.equal(d.pct, 59);
    assert.equal(d.desacuerdo, false);
  });

  // Caso real del parque: la hoja dice 88% y sus columnas dan 17,5%.
  test('con oficial que NO concuerda, manda el oficial y se marca', () => {
    const d = devanado(502, 88, 88);
    assert.equal(d.pct, 88, 'el oficial es el que manda (decisión del Ingeniero)');
    assert.equal(d.cociente, 17.5);
    assert.equal(d.desacuerdo, true, 'la contradicción tiene que quedar visible');
  });

  test('una diferencia dentro de la tolerancia no se marca', () => {
    assert.equal(devanado(100, 60, 60 + TOLERANCIA_PCT).desacuerdo, false);
    assert.equal(devanado(100, 60, 60 + TOLERANCIA_PCT + 0.1).desacuerdo, true);
  });

  test('ampacidad cero o ausente no produce división', () => {
    assert.equal(devanado(0, 50, null).pct, null);
    assert.equal(devanado(null, 50, null).cociente, null);
  });
});

describe('filaCargabilidad — datos del parque, sin inventar', () => {
  test('sale la subestación REAL, no una de demostración', () => {
    const f = filaCargabilidad(tx());
    assert.equal(f.sub, 'AGUAS BLANCAS');
    assert.equal(f.zona, 'ORIENTE');
    assert.equal(f.id, 'T1-M/M-ABA');
    assert.ok(!/DEMO/i.test(JSON.stringify(f)), 'ninguna fila puede traer marcas DEMO');
  });

  test('conserva ampacidad y carga medida por devanado', () => {
    const f = filaCargabilidad(tx());
    assert.equal(f.P.amp, 502);
    assert.equal(f.P.car, 88);
    assert.equal(f.P.pct, 88);
    assert.equal(f.desacuerdo_fuente, true);
  });

  test('un equipo sin ningún dato de carga NO produce fila hueca', () => {
    const vacio = { identificacion: { codigo: 'X' }, ubicacion: {}, electrico: {}, salud_actual: {} };
    assert.equal(filaCargabilidad(vacio), null);
  });

  test('detecta la corriente medida por encima de la ampacidad', () => {
    const f = filaCargabilidad(tx({
      electrico: { corriente_nominal_primaria_a: 167.3, corriente_medida_primaria_a: 418.25 },
      salud_actual: { crg_pct_medido: 40 }
    }));
    assert.equal(f.sobrecarga_medida, true);
  });
});

describe('cargabilidadDeParque — resumen honesto de la flota', () => {
  test('cuenta los que quedan fuera en vez de rellenarlos', () => {
    const parque = [tx(), tx(), { identificacion: { codigo: 'Z' }, electrico: {}, salud_actual: {} }];
    const { filas, resumen } = cargabilidadDeParque(parque);
    assert.equal(filas.length, 2);
    assert.equal(resumen.total, 3);
    assert.equal(resumen.sinDatos, 1);
    assert.equal(resumen.desacuerdosFuente, 2);
  });

  test('parque vacío o nulo no revienta', () => {
    for (const p of [[], null, undefined]) {
      const r = cargabilidadDeParque(p);
      assert.equal(r.filas.length, 0);
      assert.equal(r.resumen.conDatos, 0);
    }
  });
});
