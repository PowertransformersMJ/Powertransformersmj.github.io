// Recomendaciones de diagnóstico (domain/pruebas_electricas_recomendaciones.js).
// Dominio puro: sin DOM. node --test. Verifica que cada veredicto produzca una
// sugerencia accionable y que la divergencia se anteponga.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { recomendarPrueba, accionPrueba, RECOMENDACIONES } from '../assets/js/domain/pruebas_electricas_recomendaciones.js';
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

describe('accionPrueba — clasificación de mantenimiento (predictiva/preventiva/correctiva)', () => {
  test('verde estable → PREVENTIVA (rutina), no relevante', () => {
    const a = accionPrueba('tand', { estado: ESTADOS.VERDE, tendencia: 'estable' });
    assert.equal(a.tipo, 'preventiva');
    assert.equal(a.etiqueta, 'Preventiva');
    assert.equal(a.relevante, false);
    assert.ok(a.texto && a.texto.length);
  });
  test('ámbar/naranja → PREDICTIVA, relevante', () => {
    const a = accionPrueba('excitacion', { estado: ESTADOS.NARANJA });
    assert.equal(a.tipo, 'predictiva');
    assert.equal(a.relevante, true);
  });
  test('rojo → CORRECTIVA, relevante', () => {
    const a = accionPrueba('bushing', { estado: ESTADOS.ROJO });
    assert.equal(a.tipo, 'correctiva');
    assert.equal(a.relevante, true);
    assert.match(a.texto, /explosión|reemplazar|sacar de servicio/i);
  });
  test('sin dato → DIAGNÓSTICA', () => {
    const a = accionPrueba('relacion', { estado: ESTADOS.NEUTRAL });
    assert.equal(a.tipo, 'diagnostica');
  });
  test('VERDE pero EMPEORA fuerte (≥5% relativo) → sube a PREDICTIVA (tendencia manda)', () => {
    const a = accionPrueba('tand', { estado: ESTADOS.VERDE, tendencia: 'empeora', delta: 12 });
    assert.equal(a.tipo, 'predictiva');
    assert.equal(a.relevante, true);
  });
  test('VERDE que empeora LEVE (<5%) sigue PREVENTIVA', () => {
    const a = accionPrueba('tand', { estado: ESTADOS.VERDE, tendencia: 'empeora', delta: 2 });
    assert.equal(a.tipo, 'preventiva');
  });
});
