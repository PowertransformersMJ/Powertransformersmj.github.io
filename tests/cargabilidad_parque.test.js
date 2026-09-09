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

// ══════════════════════════════════════════════════════════════
// El porcentaje de un devanado sale de SUS amperios
// ──────────────────────────────────────────────────────────────
// HISTORIA, porque sin ella este cambio parece revertir una orden.
// El 2026-07-27 el Ingeniero decidió que mandara el % oficial de la
// hoja: en aquel Excel las columnas de amperios estaban sucias
// —ASTREA con 418 A sobre una ampacidad de 167 (250 %), AGUAS
// BLANCAS con 88 % frente a un cociente de 17,5 %— y el cociente no
// era de fiar (`99 §67.3`).
//
// Esa decisión se aplicaba a UN valor por equipo, pero el código lo
// usaba como porcentaje de LOS TRES devanados. De ahí las dos cosas
// que el Ingeniero reportó el 2026-09-09: devanados con «96 %» junto
// a «— A / — A», y 74 equipos acusados de «fuente en desacuerdo»
// cuando la captura estaba bien — un valor único no puede coincidir
// con tres cocientes distintos.
//
// La hoja «Cargabilidad_2025» disuelve el conflicto que motivó
// aquella decisión: trae un porcentaje POR DEVANADO, los tres
// coinciden con sus propios amperios en el 100 % de las filas
// medidas, ASTREA baja a 53,2 % y no queda ninguna fila imposible.
// Así que el porcentaje vuelve a salir del cociente, y la cifra de
// equipo se conserva aparte, en `pct_oficial`, comparada contra el
// devanado más cargado — que es lo que pretende describir.
// ══════════════════════════════════════════════════════════════

describe('devanado — cada devanado con sus propios amperios', () => {

  test('el porcentaje es el cociente carga/ampacidad', () => {
    assert.equal(devanado(100, 59).pct, 59);
    assert.equal(devanado(167.3, 88.97).pct, 53.2, 'ASTREA con el dato de 2025');
  });

  // 🔒 EL INVARIANTE que motivó el cambio: sin medida no hay porcentaje.
  test('sin medida NO se inventa un porcentaje', () => {
    assert.equal(devanado(null, null).pct, null, 'es el «96 % junto a — A» que se reportó');
    assert.equal(devanado(100, null).pct, null);
    assert.equal(devanado(null, 50).pct, null);
  });

  test('ampacidad cero o ausente no produce división', () => {
    assert.equal(devanado(0, 50).pct, null);
    assert.equal(devanado(null, 50).cociente, null);
  });

  test('la sobrecarga se lee del cociente, no de una cifra heredada', () => {
    assert.equal(devanado(100.4, 133.7).pct, 133.2, 'BARRANCO DE LOBA, hoja 2025');
  });
});

describe('filaCargabilidad — la cifra de equipo no se pinta en los devanados', () => {

  const base = {
    identificacion: { matricula: 'T-PCT' },
    ubicacion: { subestacion_nombre: 'PRUEBA', departamento: 'CESAR' },
    electrico: {
      corriente_nominal_primaria_a: 100, corriente_medida_primaria_a: 60,
      corriente_nominal_secundaria_a: 200, corriente_medida_secundaria_a: 40
    },
    salud_actual: { crg_pct_medido: 96 }
  };

  // 🔒 Lo que el Ingeniero vio en pantalla: un terciario sin ninguna medida
  // mostrando el porcentaje del equipo.
  test('un devanado sin medida queda en null aunque el equipo traiga porcentaje', () => {
    const f = filaCargabilidad(base);
    assert.equal(f.T.pct, null, 'el terciario no tiene amperios: no puede tener porcentaje');
    assert.equal(f.T.amp, null);
    assert.equal(f.T.car, null);
  });

  test('cada devanado medido muestra SU propio porcentaje', () => {
    const f = filaCargabilidad(base);
    assert.equal(f.P.pct, 60);
    assert.equal(f.S.pct, 20, 'no los 96 de la cifra de equipo');
  });

  test('la cifra de equipo se conserva aparte, no se pierde', () => {
    assert.equal(filaCargabilidad(base).pct_oficial, 96);
  });

  // El desacuerdo se juzga contra el devanado MÁS cargado. Compararlo contra
  // cada devanado acusaba a los otros dos por construcción: así se llegó a 74.
  test('el desacuerdo se mide contra el devanado más cargado', () => {
    assert.equal(filaCargabilidad(base).desacuerdo_fuente, true, '96 frente a un máximo de 60');
    const coherente = { ...base, salud_actual: { crg_pct_medido: 60 } };
    assert.equal(filaCargabilidad(coherente).desacuerdo_fuente, false,
      'la cifra de equipo describe al devanado más cargado: no hay contradicción');
  });

  test('sin cifra de equipo no hay desacuerdo que declarar', () => {
    const sinOficial = { ...base, salud_actual: {} };
    assert.equal(filaCargabilidad(sinOficial).desacuerdo_fuente, false);
  });

  test('la sobrecarga se declara desde los amperios medidos', () => {
    const sobre = { ...base, electrico: { ...base.electrico, corriente_medida_primaria_a: 133 } };
    assert.equal(filaCargabilidad(sobre).sobrecarga_medida, true);
    assert.equal(filaCargabilidad(base).sobrecarga_medida, false);
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
    // El fixture es AGUAS BLANCAS con el dato VIEJO (88 A sobre 502 de
    // ampacidad, y la hoja declarando 88 %). Antes el porcentaje mostrado era
    // el oficial; ahora es el cociente de sus propios amperios, y la
    // contradicción sigue declarada en `desacuerdo_fuente`.
    const f = filaCargabilidad(tx());
    assert.equal(f.P.amp, 502);
    assert.equal(f.P.car, 88);
    assert.equal(f.P.pct, 17.5, 'lo que de verdad dicen sus amperios');
    assert.equal(f.pct_oficial, 88, 'la cifra de la hoja no se pierde');
    assert.equal(f.desacuerdo_fuente, true, 'y la contradicción se sigue señalando');
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

// ══════════════════════════════════════════════════════════════
// La zona se deduce del departamento cuando no viene registrada
// ──────────────────────────────────────────────────────────────
// Con el filtro de zona en modo múltiple esto dejó de ser cosmético.
// `listarUnicos` no pinta chip para una zona vacía, así que un equipo
// sin zona no tiene control que lo alcance: en cuanto se marca
// CUALQUIER zona desaparece del tablero, y los KPI caen sin causa
// visible. Deducirla del departamento cierra el hueco para todo
// registro con departamento válido — que es lo que las reglas de
// Firestore ya garantizan. Mismo respaldo que usa el módulo de
// refrigeración.
// ══════════════════════════════════════════════════════════════

import { zonaDeDepartamento } from '../assets/js/domain/cargabilidad_parque.js';

describe('zonaDeDepartamento', () => {

  test('los cinco departamentos del parque tienen zona', () => {
    assert.equal(zonaDeDepartamento('BOLIVAR'), 'BOLIVAR');
    assert.equal(zonaDeDepartamento('CORDOBA'), 'OCCIDENTE');
    assert.equal(zonaDeDepartamento('SUCRE'), 'OCCIDENTE');
    assert.equal(zonaDeDepartamento('CESAR'), 'ORIENTE');
    assert.equal(zonaDeDepartamento('MAGDALENA'), 'ORIENTE');
  });

  test('no distingue mayúsculas ni espacios sobrantes', () => {
    assert.equal(zonaDeDepartamento(' magdalena '), 'ORIENTE');
    assert.equal(zonaDeDepartamento('Córdoba'), '', 'el catálogo va sin tildes: no se inventa');
  });

  test('lo que no está en el catálogo no recibe zona inventada', () => {
    assert.equal(zonaDeDepartamento('ATLANTICO'), '');
    assert.equal(zonaDeDepartamento(''), '');
    assert.equal(zonaDeDepartamento(null), '');
  });
});

describe('filaCargabilidad — la zona registrada manda sobre la deducida', () => {

  const base = {
    identificacion: { matricula: 'T-DEP' },
    ubicacion: { subestacion_nombre: 'PRUEBA', departamento: 'SUCRE' },
    salud_actual: { crg_pct_medido: 55 }
  };

  test('sin zona registrada se deduce del departamento', () => {
    assert.equal(filaCargabilidad(base).zona, 'OCCIDENTE');
  });

  // 🔒 El respaldo NO puede pisar el dato del registro: si alguien movió una
  // unidad de zona sin cambiarle el departamento, manda lo registrado.
  test('con zona registrada se respeta esa, aunque discrepe del departamento', () => {
    const tx = { ...base, ubicacion: { ...base.ubicacion, zona: 'BOLIVAR' } };
    assert.equal(filaCargabilidad(tx).zona, 'BOLIVAR');
  });

  test('sin zona y sin departamento reconocible se queda vacía, no se inventa', () => {
    const tx = { ...base, ubicacion: { subestacion_nombre: 'PRUEBA' } };
    assert.equal(filaCargabilidad(tx).zona, '');
  });
});
