// Contrato del modelo flexible de bloques (domain/pruebas_electricas_bloques.js).
// Verifica forma, ACOTAMIENTO (caps de seguridad/escala) y robustez ante basura.
// Dominio puro: sin DOM ni Firestore. node --test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarBloques, sanitizarBloque, sanitizarSerie, LIMITES, BLOQUES_SCHEMA_VERSION
} from '../assets/js/domain/pruebas_electricas_bloques.js';

// Bloque representativo de la IA: excitación 17 TAPs × 3 fases (curva de línea).
const EXCITACION_IA = {
  prueba: 'excitacion', titulo: 'Corriente de excitación', unidad: 'mA',
  eje_x: 'Posición del conmutador', grafica: 'linea', limite: 10, guia: 5,
  observaciones: 'Fases laterales A y C similares; comportamiento normal.',
  series: [
    { nombre: 'Fase A', puntos: Array.from({ length: 17 }, (_, i) => ({ x: i + 1, y: 17.964 + i })) },
    { nombre: 'Fase B', puntos: Array.from({ length: 17 }, (_, i) => ({ x: i + 1, y: 11.623 + i })) },
    { nombre: 'Fase C', puntos: Array.from({ length: 17 }, (_, i) => ({ x: i + 1, y: 18.525 + i })) }
  ],
  tabla: {
    columnas: ['TAP', 'Fase A (mA)', 'Fase B (mA)', 'Fase C (mA)', 'Desv. %'],
    filas: [['1', '17.964', '11.623', '18.525', '3.0'], ['17', '27.722', '18.841', '28.018', '1.06']]
  }
};

describe('sanitizarBloques · forma y versión', () => {
  const out = sanitizarBloques([EXCITACION_IA]);
  test('devuelve {schema_version, bloques}', () => {
    assert.equal(out.schema_version, BLOQUES_SCHEMA_VERSION);
    assert.equal(out.bloques.length, 1);
  });
  test('conserva la curva completa (17 puntos × 3 series)', () => {
    const b = out.bloques[0];
    assert.equal(b.series.length, 3);
    assert.equal(b.series[0].puntos.length, 17);
    assert.deepEqual(b.series[0].puntos[0], { x: 1, y: 17.964 });
    assert.equal(b.grafica, 'linea');
    assert.equal(b.limite, 10);
  });
  test('conserva la tabla de detalle', () => {
    assert.equal(out.bloques[0].tabla.columnas.length, 5);
    assert.equal(out.bloques[0].tabla.filas.length, 2);
  });
});

describe('sanitizarBloques · acotamiento (seguridad/escala)', () => {
  test('trunca bloques al tope', () => {
    const muchos = Array.from({ length: LIMITES.BLOQUES + 10 }, () => EXCITACION_IA);
    assert.equal(sanitizarBloques(muchos).bloques.length, LIMITES.BLOQUES);
  });
  test('trunca puntos por serie al tope', () => {
    const s = sanitizarSerie({ nombre: 'X', puntos: Array.from({ length: LIMITES.PUNTOS + 50 }, (_, i) => ({ x: i, y: i })) });
    assert.equal(s.puntos.length, LIMITES.PUNTOS);
  });
  test('trunca series al tope', () => {
    const b = sanitizarBloque({ titulo: 'T', series: Array.from({ length: LIMITES.SERIES + 5 }, () => ({ nombre: 'S', puntos: [{ x: 1, y: 1 }] })) });
    assert.equal(b.series.length, LIMITES.SERIES);
  });
});

describe('sanitizarBloques · robustez', () => {
  test('grafica inválida → cae a "linea"', () => {
    assert.equal(sanitizarBloque({ titulo: 'T', grafica: 'pastel', series: [{ nombre: 'a', puntos: [{ x: 1, y: 2 }] }] }).grafica, 'linea');
  });
  test('descarta bloques sin título o sin datos', () => {
    const out = sanitizarBloques([{ titulo: '', series: [] }, { titulo: 'Vacío', series: [], tabla: {} }, EXCITACION_IA]);
    assert.equal(out.bloques.length, 1);
  });
  test('x puede ser etiqueta (no numérica) — p.ej. par de devanados', () => {
    const b = sanitizarBloque({ titulo: 'Aislamiento', grafica: 'barra', series: [{ nombre: 'GΩ', puntos: [{ x: 'AT-MT', y: 6.01 }, { x: 'AT-BT', y: 6.17 }] }] });
    assert.equal(b.series[0].puntos[0].x, 'AT-MT');
    assert.equal(b.series[0].puntos[0].y, 6.01);
  });
  test('entrada basura no rompe (null/strings/números)', () => {
    assert.deepEqual(sanitizarBloques(null).bloques, []);
    assert.deepEqual(sanitizarBloques('x').bloques, []);
    assert.doesNotThrow(() => sanitizarBloques([null, 5, 'a', {}]));
  });
  test('coma decimal en y se normaliza a número', () => {
    const b = sanitizarBloque({ titulo: 'T', series: [{ nombre: 's', puntos: [{ x: 1, y: '0,51' }] }] });
    assert.equal(b.series[0].puntos[0].y, 0.51);
  });
});
