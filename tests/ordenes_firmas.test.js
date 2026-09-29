// Órdenes de Entrada/Salida (IT.05801): «Entregado por» con las firmas del equipo que custodia
// el Ingeniero, como en Fichas (decisión suya, 2026-09-28). Qué firma lleva cada línea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFirmasOrden, personasEquipoDeOrden, nombreConFolio, LINEAS_ORDEN } from '../assets/js/domain/ordenes_firmas.js';

const orden = (a, e, r) => ({ autorizado: { nombre: a }, entregado: { nombre: e }, recibido: { nombre: r } });
const SESION = 'ING. MIGUEL JIMENEZ';

test('Autorizado (la sesión) lleva la firma propia; Entregado de la lista, la del directorio', () => {
  const p = planFirmasOrden(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO', 'GERARDO RAMIREZ'), SESION, { propia: true, equipo: ['CARLOS_MARTELO', 'JORGE_RHENALS'] });
  assert.deepEqual(p.map((x) => [x.k, x.origen, x.id]), [['autorizado', 'propia', 'MIGUEL_JIMENEZ'], ['entregado', 'equipo', 'CARLOS_MARTELO'], ['recibido', null, null]]);
  assert.match(p[2].motivo, /firma a mano/);
});

test('Jorge Rhenals también; Juan Cardona no está en el directorio: en blanco', () => {
  const e = { propia: true, equipo: ['CARLOS_MARTELO', 'JORGE_RHENALS'] };
  assert.equal(planFirmasOrden(orden('MIGUEL JIMENEZ', 'JORGE RHENALS', 'RAMON ROMERO'), SESION, e)[1].origen, 'equipo');
  const jc = planFirmasOrden(orden('MIGUEL JIMENEZ', 'JUAN CARDONA', 'RAMON ROMERO'), SESION, e)[1];
  assert.equal(jc.origen, null); assert.equal(jc.id, null);
});

test('sin firma leída del directorio no se estampa (y lo dice)', () => {
  const p = planFirmasOrden(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO', 'X'), SESION, { propia: true, equipo: [] });
  assert.equal(p[1].origen, null); assert.match(p[1].motivo, /No hay firma suya en el directorio/);
});

test('la línea de la sesión NUNCA lleva la del directorio (aunque esté cargada)', () => {
  const p = planFirmasOrden(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO', 'X'), SESION, { propia: false, equipo: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO'] });
  assert.equal(p[0].origen, null); assert.match(p[0].motivo, /propia/);
  // Si la sesión es otra persona de la lista, su línea es la propia y la del Ingeniero va del directorio.
  const q = planFirmasOrden(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO', 'X'), 'CARLOS MARTELO', { propia: true, equipo: ['MIGUEL_JIMENEZ'] });
  assert.deepEqual(q.map((x) => x.origen), ['equipo', 'propia', null]);
});

test('por CLAVE exacta de la lista: un nombre parecido no recibe firma', () => {
  const e = { propia: true, equipo: ['CARLOS_MARTELO'] };
  for (const n of ['CARLOS MARTELO PEREZ', 'ING. CARLOS MARTELO', 'CARLOS  MARTELO', 'carlos martelo']) {
    assert.equal(planFirmasOrden(orden('MIGUEL JIMENEZ', n, 'X'), SESION, e)[1].origen, null, n);
  }
});

test('personasEquipoDeOrden: lo que hay que leer del directorio (sin la sesión, sin repetir)', () => {
  assert.deepEqual(personasEquipoDeOrden(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO', 'GERARDO RAMIREZ'), SESION), ['CARLOS_MARTELO']);
  assert.deepEqual(personasEquipoDeOrden(orden('MIGUEL JIMENEZ', 'JUAN CARDONA', 'GERARDO RAMIREZ'), SESION), []);
  assert.deepEqual(personasEquipoDeOrden(orden('MIGUEL JIMENEZ', 'JORGE RHENALS', 'JORGE RHENALS'), SESION), ['JORGE_RHENALS']);
  assert.deepEqual(personasEquipoDeOrden(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO', ''), 'CARLOS MARTELO'), ['MIGUEL_JIMENEZ']);
});

test('nombreConFolio y las tres líneas del formato', () => {
  assert.equal(nombreConFolio('Orden_Salida_901_2026-09-28.pdf', 'F-AB12CD34'), 'Orden_Salida_901_2026-09-28_F-AB12CD34.pdf');
  assert.equal(nombreConFolio('Orden.xlsx', ''), 'Orden.xlsx');
  assert.deepEqual(LINEAS_ORDEN.map((l) => l[0]), ['autorizado', 'entregado', 'recibido']);
});
