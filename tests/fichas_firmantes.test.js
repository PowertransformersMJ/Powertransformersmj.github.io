// Quién firma el PE.02081 — la lista DICTADA por el Ingeniero (2026-09-23,
// `99 §89`) y la función que usan por igual la pantalla y el Excel.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FIRMANTES, CASILLAS_FIRMA, OTRA_PERSONA, firmanteDe } from '../assets/js/domain/fichas_firmantes.js';

describe('La lista dictada, LITERAL (anti-paráfrasis)', () => {
  test('cada casilla con sus personas y cargos, letra por letra y en su orden', () => {
    const plano = (k) => FIRMANTES[k].map((p) => p.nombre + ' | ' + p.ocupacion);
    assert.deepEqual(plano('elab'), [
      'MIGUEL A. JIMENEZ | PROFESIONAL EN TRANSFORMADORES DE POTENCIA',
      'CARLOS MARTELO | ANALISTA DE TRANSFORMADORES AT',
      'JORGE RHENALS | ANALISTA DE TRANSFORMADORES AT'
    ]);
    assert.deepEqual(plano('rev'), [
      'JORGE MIRANDA | LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT',
      'MIGUEL JIMENEZ | PROFESIONAL EN TRANSFORMADORES DE POTENCIA'
    ]);
    assert.equal(plano('apr')[0], 'JORGE MIRANDA | LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT');
    assert.equal(plano('apr2')[0], 'ERICK VERGARA | JEFE OPERATIVA MANTENIMIENTO RED ALTA TENSION (E)');
    assert.deepEqual(plano('rec'), ['ERICK VERGARA | SUBGERENTE MANTENIMIENTO RED ALTA TENSION']);
    assert.deepEqual(CASILLAS_FIRMA, ['elab', 'rev', 'apr', 'apr2', 'rec']);
  });

  test('ni una cédula en la lista: el repo es público (`§70`, `§78`)', () => {
    for (const k of CASILLAS_FIRMA) {
      for (const p of FIRMANTES[k]) {
        assert.deepEqual(Object.keys(p).sort(), ['nombre', 'ocupacion']);
        assert.ok(!/\d{5,}/.test(p.nombre + p.ocupacion));
      }
    }
  });
});

describe('firmanteDe — lo que se imprime en cada casilla', () => {
  test('sin nada escrito: la primera persona de la casilla, con su cargo', () => {
    assert.deepEqual(firmanteDe('elab', {}), {
      nombre: 'MIGUEL A. JIMENEZ', ocupacion: 'PROFESIONAL EN TRANSFORMADORES DE POTENCIA', fecha: '', otra: false, indice: 0
    });
    assert.equal(firmanteDe('apr2', {}).nombre, 'ERICK VERGARA');
    assert.equal(firmanteDe('rec', {}).ocupacion, 'SUBGERENTE MANTENIMIENTO RED ALTA TENSION');
  });

  test('elegir otra persona de la lista trae SU cargo', () => {
    const f = firmanteDe('elab', { nom_elab: 'CARLOS MARTELO' });
    assert.equal(f.indice, 1);
    assert.equal(f.ocupacion, 'ANALISTA DE TRANSFORMADORES AT');
  });

  test('una ficha vieja con el nombre tecleado se reconoce sola (sin importar mayúsculas)', () => {
    const f = firmanteDe('rev', { nom_rev: '  miguel jimenez ' });
    assert.equal(f.indice, 1);
    assert.equal(f.nombre, 'MIGUEL JIMENEZ');
  });

  test('un nombre que no está en la lista, o «Otra persona», sale tal cual se escribió', () => {
    assert.deepEqual(firmanteDe('rec', { nom_rec: 'PERSONA DE PRUEBA', occ_rec: 'CARGO DE PRUEBA' }),
      { nombre: 'PERSONA DE PRUEBA', ocupacion: 'CARGO DE PRUEBA', fecha: '', otra: true, indice: -1 });
    assert.deepEqual(firmanteDe('elab', { sel_elab: OTRA_PERSONA, nom_elab: '', occ_elab: '' }),
      { nombre: '', ocupacion: '', fecha: '', otra: true, indice: -1 });
  });

  test('el cargo cambiado a mano manda sobre el de la lista; la fecha viaja', () => {
    const f = firmanteDe('apr', { occ_apr: 'CARGO ENCARGADO', fec_apr: ' 03/10/2026 ' });
    assert.equal(f.nombre, 'JORGE MIRANDA');
    assert.equal(f.ocupacion, 'CARGO ENCARGADO');
    assert.equal(f.fecha, '03/10/2026');
  });
});
