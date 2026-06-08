// Recomendaciones de diagnóstico (domain/pruebas_electricas_recomendaciones.js).
// Dominio puro: sin DOM. node --test. Verifica que cada veredicto produzca una
// sugerencia accionable y que la divergencia se anteponga.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { recomendarPrueba, RECOMENDACIONES } from '../assets/js/domain/pruebas_electricas_recomendaciones.js';
import { ESTADOS } from '../assets/js/domain/pruebas_electricas_semaforo.js';

describe('recomendarPrueba — por nivel de veredicto', () => {
  test('verde → recomendación de seguimiento/baseline', () => {
    const r = recomendarPrueba('resistencia', { estado: ESTADOS.VERDE });
    assert.match(r, /baseline|seguimiento|registrar/i);
  });
  test('investigar (naranja) → acción correlacionada', () => {
    const r = recomendarPrueba('excitacion', { estado: ESTADOS.NARANJA });
    assert.match(r, /desmagnetizar|TTR|resistencia/i);
  });
  test('rojo → acción correctiva/urgente', () => {
    const r = recomendarPrueba('aislamiento', { estado: ESTADOS.ROJO });
    assert.match(r, /no energizar|secado|inspección/i);
  });
  test('neutral/faltante → qué se necesita para concluir', () => {
    const r = recomendarPrueba('aislamiento', { estado: ESTADOS.NEUTRAL });
    assert.match(r, /PI\/DAR|curva|estabilizada/i);
  });
});

describe('recomendarPrueba — divergencia y fallback', () => {
  test('divergen → antepone la nota de criterio más conservador', () => {
    const r = recomendarPrueba('tand', { estado: ESTADOS.NARANJA, divergen: true });
    assert.match(r, /^Las normas divergen/);
  });
  test('familia desconocida → usa recomendación genérica', () => {
    const r = recomendarPrueba('sfra', { estado: ESTADOS.NARANJA });
    assert.equal(r, RECOMENDACIONES._generico.investigar);
  });
  test('bujes rojo → riesgo de explosión / sacar de servicio', () => {
    const r = recomendarPrueba('bushing', { estado: ESTADOS.ROJO });
    assert.match(r, /explosión|sacar de servicio|reemplazar/i);
  });
});
