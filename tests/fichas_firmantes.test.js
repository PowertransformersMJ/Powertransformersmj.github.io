// Quién firma el PE.02081 — la lista DICTADA por el Ingeniero (2026-09-23,
// `99 §89`) y la función que usan por igual la pantalla y el Excel.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FIRMANTES, CASILLAS_FIRMA, OTRA_PERSONA, firmanteDe, indicePorDefecto } from '../assets/js/domain/fichas_firmantes.js';
import { tieneContenido } from '../assets/js/domain/fichas_borrador.js';

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

  test('una persona de la lista lleva SIEMPRE su cargo dictado: un cargo viejo no se le pega; la fecha viaja', () => {
    // Revisión §89: una ficha vieja con solo el cargo tecleado imprimía «JORGE MIRANDA / Subgerente…».
    const f = firmanteDe('apr', { occ_apr: 'Subgerente Mantenimiento AT', fec_apr: ' 03/10/2026 ' });
    assert.equal(f.nombre, 'JORGE MIRANDA');
    assert.equal(f.ocupacion, 'LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT');
    assert.equal(f.fecha, '03/10/2026');
  });

  test('el segundo aprobador no repite a quien ya está en el primero', () => {
    // Ficha vieja: Aprobación tenía un solo campo y se tecleó «Erick Vergara».
    const vieja = { nom_apr: 'Erick Vergara', occ_apr: 'Subgerente Mantenimiento AT' };
    assert.equal(firmanteDe('apr', vieja).nombre, 'ERICK VERGARA');
    assert.equal(firmanteDe('apr2', vieja).nombre, 'JORGE MIRANDA');
    assert.equal(indicePorDefecto('apr2', vieja), 1);
    // Sin nada escrito, el orden dictado: Miranda y Vergara.
    assert.equal(firmanteDe('apr2', {}).nombre, 'ERICK VERGARA');
    // Si se elige explícitamente, manda la elección.
    assert.equal(firmanteDe('apr2', { nom_apr: 'ERICK VERGARA', nom_apr2: 'ERICK VERGARA' }).nombre, 'ERICK VERGARA');
  });

  test('«Otra persona» explícita con el nombre borrado NO vuelve sola a la persona por defecto', () => {
    // Revisión §89: se imprimía ERICK VERGARA con el cargo viejo de otra persona.
    assert.deepEqual(firmanteDe('rec', { sel_rec: OTRA_PERSONA, nom_rec: '', occ_rec: 'CARGO VIEJO DE PRUEBA' }),
      { nombre: '', ocupacion: 'CARGO VIEJO DE PRUEBA', fecha: '', otra: true, indice: -1 });
  });
});

describe('El borrador no cuenta como trabajo lo que no lo es (revisión §89)', () => {
  test('la marca «Otra persona» sin nombre escrito no es contenido; con nombre, sí', () => {
    assert.equal(tieneContenido({ plan: { sel_elab: OTRA_PERSONA, nom_elab: '', occ_elab: '' } }), false);
    assert.equal(tieneContenido({ plan: { sel_elab: OTRA_PERSONA, nom_elab: 'PERSONA DE PRUEBA' } }), true);
  });
});
