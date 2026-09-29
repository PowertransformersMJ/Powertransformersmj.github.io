// Órdenes E/S exportadas por un DELEGADO (`99 §117`): la firma del Ingeniero SOLO en
// «Autorizado», la de Carlos o Jorge SOLO en «Entregado», y solo las delegadas.
// Nombres de perfil SINTÉTICOS: el repo es público.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  LINEAS_DELEGABLES, delegadaAplica, esLineaDelDelegado, planFirmasOrdenDelegada, personasALeerDelegada, personasDeLaDelegacion
} from '../assets/js/domain/ordenes_firmas_delegadas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRES = { personaPropia: 'CARLOS_MARTELO', personas: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS'] };
const orden = (a, e, r = 'RECEPTOR DE PRUEBA') => ({ autorizado: { nombre: a }, entregado: { nombre: e }, recibido: { nombre: r } });
const origenes = (p) => p.map((x) => x.origen);

describe('qué puede salir del directorio en cada línea', () => {
  test('el Ingeniero solo en «Autorizado»; Carlos y Jorge solo en «Entregado»; «Recibido» nunca', () => {
    assert.deepEqual(LINEAS_DELEGABLES.autorizado, ['MIGUEL_JIMENEZ']);
    assert.ok(delegadaAplica('autorizado', 'MIGUEL_JIMENEZ', TRES));
    assert.ok(!delegadaAplica('entregado', 'MIGUEL_JIMENEZ', TRES));
    assert.ok(!delegadaAplica('autorizado', 'CARLOS_MARTELO', TRES));
    assert.ok(!delegadaAplica('recibido', 'JORGE_RHENALS', TRES));
    assert.ok(!delegadaAplica('entregado', 'JORGE_MIRANDA', { personas: ['JORGE_MIRANDA'] }));
  });
  test('solo lo que la delegación nombra', () => {
    const solo = { personaPropia: 'CARLOS_MARTELO', personas: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO'] };
    assert.ok(!delegadaAplica('entregado', 'JORGE_RHENALS', solo));
    assert.ok(!delegadaAplica('autorizado', 'MIGUEL_JIMENEZ', {}));
    assert.deepEqual(personasDeLaDelegacion(solo), ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO']);
  });
  test('la línea propia se reconoce por su CLAVE, solo en «Entregado»', () => {
    assert.ok(esLineaDelDelegado('entregado', 'CARLOS MARTELO', TRES));
    assert.ok(!esLineaDelDelegado('entregado', 'JORGE RHENALS', TRES));
    assert.ok(!esLineaDelDelegado('recibido', 'CARLOS MARTELO', TRES));
    assert.ok(!esLineaDelDelegado('entregado', 'CARLOS MARTELO', { personas: TRES.personas }));
  });
});

describe('plan de una orden exportada por Carlos', () => {
  test('su orden: Ingeniero y él del directorio (sin «Mi firma»); Recibido a mano', () => {
    const p = planFirmasOrdenDelegada(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO'), TRES, { equipo: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO'] });
    assert.deepEqual(origenes(p), ['equipo', 'equipo', null]);
    assert.equal(p[2].motivo, 'Se firma a mano.');
  });
  test('con «Mi firma» cargada, SU línea lleva la propia (nunca la del directorio)', () => {
    const p = planFirmasOrdenDelegada(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO'), TRES, { propia: true, equipo: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO'] });
    assert.deepEqual(origenes(p), ['equipo', 'propia', null]);
    assert.deepEqual(personasALeerDelegada(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO'), TRES, { propia: true }), ['MIGUEL_JIMENEZ']);
  });
  test('orden entregada por Jorge (el cruce que el Ingeniero autorizó): sale la de Jorge', () => {
    const o = orden('MIGUEL JIMENEZ', 'JORGE RHENALS');
    assert.deepEqual(personasALeerDelegada(o, TRES), ['MIGUEL_JIMENEZ', 'JORGE_RHENALS']);
    assert.deepEqual(origenes(planFirmasOrdenDelegada(o, TRES, { equipo: ['MIGUEL_JIMENEZ', 'JORGE_RHENALS'] })), ['equipo', 'equipo', null]);
  });
  test('sin el cruce delegado, la línea de Jorge queda a mano', () => {
    const solo = { personaPropia: 'CARLOS_MARTELO', personas: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO'] };
    const p = planFirmasOrdenDelegada(orden('MIGUEL JIMENEZ', 'JORGE RHENALS'), solo, { equipo: ['MIGUEL_JIMENEZ', 'JORGE_RHENALS'] });
    assert.deepEqual(origenes(p), ['equipo', null, null]);
  });
  test('Juan Cardona, un nombre parecido o una orden con otro «Autorizado»: a mano', () => {
    assert.deepEqual(origenes(planFirmasOrdenDelegada(orden('MIGUEL JIMENEZ', 'JUAN CARDONA'), TRES, { equipo: ['MIGUEL_JIMENEZ'] })), ['equipo', null, null]);
    assert.deepEqual(origenes(planFirmasOrdenDelegada(orden('MIGUEL JIMENES', 'CARLOS MARTELLO'), TRES, { equipo: TRES.personas })), [null, null, null]);
    assert.deepEqual(origenes(planFirmasOrdenDelegada(orden('OTRO JEFE', 'CARLOS MARTELO'), TRES, { equipo: TRES.personas })), [null, 'equipo', null]);
  });
  test('el Ingeniero escrito en «Entregado» o en «Recibido» nunca lleva su firma', () => {
    const p = planFirmasOrdenDelegada(orden('MIGUEL JIMENEZ', 'MIGUEL JIMENEZ', 'MIGUEL JIMENEZ'), TRES, { equipo: TRES.personas });
    assert.deepEqual(origenes(p), ['equipo', null, null]);
  });
  test('si una firma no se pudo leer, su línea queda a mano (no se inventa)', () => {
    const p = planFirmasOrdenDelegada(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO'), TRES, { equipo: [] });
    assert.deepEqual(origenes(p), [null, null, null]);
    assert.equal(p[0].motivo, 'No hay firma suya en el directorio.');
  });
  test('sin delegación, nada del directorio', () => {
    assert.deepEqual(origenes(planFirmasOrdenDelegada(orden('MIGUEL JIMENEZ', 'CARLOS MARTELO'), {}, { propia: true, equipo: TRES.personas })), [null, null, null]);
  });
});

describe('el camino del custodio no cambia', () => {
  test('ordenes_firmas.js sigue permitiendo SOLO «Entregado» para el directorio del custodio', () => {
    const src = readFileSync(resolve(__dirname, '..', 'assets', 'js', 'domain', 'ordenes_firmas.js'), 'utf8');
    assert.match(src, /export function firmaDelEquipoAplica\(k, id\) \{ return k === LINEA_EQUIPO && EQUIPO_EN_ORDENES\.has\(id\); \}/);
  });
});
