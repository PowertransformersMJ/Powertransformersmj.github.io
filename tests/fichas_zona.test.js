// Zona del activo en la ficha y en el PE.02081 (`99 §106`): la zona, no el departamento.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { zonaDelActivo } from '../assets/js/domain/fichas_zona.js';
import { celdasFichaPlan } from '../assets/js/ui/fichas/exportar-planificacion.js';

describe('Zona del activo', () => {
  test('usa la zona registrada del activo', () => {
    assert.equal(zonaDelActivo({ zona: 'OCCIDENTE', departamento: 'cordoba' }), 'OCCIDENTE');
    assert.equal(zonaDelActivo({ ubicacion: { zona: 'ORIENTE' } }), 'ORIENTE');
  });
  test('si faltara, la deduce del departamento con el catálogo (nunca escribe el departamento)', () => {
    assert.equal(zonaDelActivo({ departamento: 'Córdoba' }), 'OCCIDENTE');
    assert.equal(zonaDelActivo({ departamento: 'SUCRE' }), 'OCCIDENTE');
    assert.equal(zonaDelActivo({ departamento: 'cesar' }), 'ORIENTE');
    assert.equal(zonaDelActivo({ departamento: 'Magdalena' }), 'ORIENTE');
    assert.equal(zonaDelActivo({ departamento: 'bolivar' }), 'BOLIVAR');
    assert.equal(zonaDelActivo({ departamento: 'Antioquia' }), '');
    assert.equal(zonaDelActivo({}), '');
  });
  test('la casilla D13 (ZONA) del PE.02081 lleva la zona', () => {
    const d13 = celdasFichaPlan({ zona: 'BOLIVAR', departamento: 'bolivar', subestacion: 'X' }, {}).find((c) => c.cell === 'D13');
    assert.equal(d13.val, 'BOLIVAR');
    const d13b = celdasFichaPlan({ departamento: 'cordoba', subestacion: 'X' }, {}).find((c) => c.cell === 'D13');
    assert.equal(d13b.val, 'OCCIDENTE');
  });
});
