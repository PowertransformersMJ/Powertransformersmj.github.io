// node --test tests/propuestas_mantenimiento.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPropuesta, FLUJO } from '../assets/js/domain/propuestas_mantenimiento.js';

test('activo todo en 1-2 devuelve propuesta vacía', () => {
  const p = buildPropuesta({
    calif_dga: 1, calif_adfq: 2, calif_fur: 1, calif_crg: 2,
    calif_pyt: 1, calif_edad: 2, calif_her: 1,
  });
  assert.equal(p.vacio, true);
  assert.equal(p.nodes.length, 0);
});

test('DGA en 3 dispara nodo dga_comb (sin CO)', () => {
  const p = buildPropuesta({
    calif_dga: 3, calif_adfq: 1, calif_fur: 1, calif_crg: 1,
    calif_pyt: 1, calif_edad: 1, calif_her: 1,
    det: { ev_co: 1, ev_co2: 1 },
  });
  assert.equal(p.vacio, false);
  assert.equal(p.nodes.some(n => n.id === 'dga_comb'), true);
});

test('DGA con CO elevado dispara dga_co', () => {
  const p = buildPropuesta({
    calif_dga: 3, calif_adfq: 1, calif_fur: 1, calif_crg: 1,
    calif_pyt: 1, calif_edad: 1, calif_her: 1,
    det: { ev_co: 4, ev_co2: 1 },
  });
  assert.equal(p.nodes.some(n => n.id === 'dga_co'), true);
});

test('DGA >= 4 escala a TOA', () => {
  const p = buildPropuesta({
    calif_dga: 5, calif_adfq: 1, calif_fur: 1, calif_crg: 1,
    calif_pyt: 1, calif_edad: 1, calif_her: 1,
    det: {},
  });
  assert.equal(p.nodes.some(n => n.id === 'toa'), true);
});

test('ADFQ en 4 con rigidez baja dispara adfq_rig', () => {
  const p = buildPropuesta({
    calif_dga: 1, calif_adfq: 4, calif_fur: 1, calif_crg: 1,
    calif_pyt: 1, calif_edad: 1, calif_her: 1,
    det: { rigidez: 18, ic: 1400 },
  });
  assert.equal(p.nodes.some(n => n.id === 'adfq_rig'), true);
});

test('FUR + EDAD juntos producen nodos en orden', () => {
  const p = buildPropuesta({
    calif_dga: 1, calif_adfq: 1, calif_fur: 5, calif_crg: 1,
    calif_pyt: 1, calif_edad: 5, calif_her: 1,
  });
  assert.equal(p.nodes[0].id, 'fur');
  assert.equal(p.nodes[1].id, 'edad');
  assert.deepEqual(p.criticas.sort(), ['Edad', 'Furanos']);
});

test('Acciones priorizadas: las más reforzadas primero', () => {
  // CRG + EDAD ambas dispararán muchas acciones; "Aumento de capacidad
  // de transformación" debe aparecer reforzada al menos 2 veces.
  const p = buildPropuesta({
    calif_dga: 1, calif_adfq: 1, calif_fur: 1, calif_crg: 4,
    calif_pyt: 1, calif_edad: 4, calif_her: 1,
  });
  const ref = p.acciones.find(x => x.texto === 'Aumento de capacidad de transformación');
  assert.equal(ref != null, true);
  assert.equal(ref.n >= 2, true);
});

test('FLUJO tiene todos los nodos requeridos por el motor', () => {
  const requeridos = ['dga_co', 'dga_comb', 'toa', 'adfq_ic', 'adfq_rig', 'fur', 'edad', 'crg', 'pyt', 'her'];
  requeridos.forEach(id => {
    assert.equal(FLUJO[id] != null, true, `falta nodo ${id}`);
    assert.equal(typeof FLUJO[id].label, 'string');
    assert.equal(Array.isArray(FLUJO[id].acc), true);
  });
});

test('Atención (3) y crítico (4-5) clasifican correctamente', () => {
  const p = buildPropuesta({
    calif_dga: 3, calif_adfq: 4, calif_fur: 1, calif_crg: 1,
    calif_pyt: 1, calif_edad: 1, calif_her: 1,
    det: {},
  });
  assert.equal(p.atencion.includes('DGA'), true);
  assert.equal(p.criticas.includes('ADFQ'), true);
});
