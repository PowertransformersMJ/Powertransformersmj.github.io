// Franja-timeline de informes (F2) · estadoInforme + lineaTiempoInformes.
// Funciones puras de ui/pruebas/semaforo.js (sin DOM en import). node --test.
// Verifican que la cronología use la MISMA calificación que la matriz (peor
// prueba por informe) y que el orden/marcadores sean estables.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  estadoInforme, estadoVigente, lineaTiempoInformes
} from '../assets/js/ui/pruebas/semaforo.js';

// Informe sano (todas las pruebas dentro de norma) y otro degradado (tan δ roja).
const SANO = {
  ano: 2023,
  tand: [{ valor_pct: 0.20 }],
  excitacion: { delta_ext_pct: 2.0 },
  relacion: [{ desviacion_pct: 0.05 }],
  resistencia: [{ delta_max_pct: 0.5 }],
  aislamiento: [{ gohm: 6.0 }],
  collar: { max_mw: 30 }
};
const DEGRADADO = {
  ano: 2025,
  tand: [{ valor_pct: 1.8 }],          // > 1.0 → rojo
  excitacion: { delta_ext_pct: 2.4 },
  relacion: [{ desviacion_pct: 0.10 }],
  resistencia: [{ delta_max_pct: 0.9 }],
  aislamiento: [{ gohm: 5.5 }],
  collar: { max_mw: 40 }
};

describe('estadoInforme', () => {
  test('informe sano → verde (peor prueba dentro de norma)', () => {
    assert.equal(estadoInforme(SANO).clase, 'b-g');
  });
  test('informe con una prueba roja → rojo (peor caso manda)', () => {
    assert.equal(estadoInforme(DEGRADADO).clase, 'b-r');
  });
  test('sin informe → neutral', () => {
    assert.equal(estadoInforme(null).clase, 'b-n');
    assert.equal(estadoInforme(undefined).clase, 'b-n');
  });
});

describe('estadoVigente usa el informe de mayor año', () => {
  test('toma el más reciente aunque la lista venga desordenada', () => {
    // DEGRADADO (2025) es el más reciente → rojo, sin importar el orden de entrada
    assert.equal(estadoVigente([SANO, DEGRADADO]).clase, 'b-r');
    assert.equal(estadoVigente([DEGRADADO, SANO]).clase, 'b-r');
  });
  test('lista vacía → neutral', () => {
    assert.equal(estadoVigente([]).clase, 'b-n');
  });
});

describe('lineaTiempoInformes', () => {
  test('ordena por año ascendente y marca vigente el último', () => {
    const linea = lineaTiempoInformes([DEGRADADO, SANO]);
    assert.equal(linea.length, 2);
    assert.deepEqual(linea.map((p) => p.ano), [2023, 2025]);
    assert.equal(linea[0].vigente, false);
    assert.equal(linea[1].vigente, true);
  });
  test('cada nodo lleva el estado global de su informe', () => {
    const linea = lineaTiempoInformes([SANO, DEGRADADO]);
    assert.equal(linea[0].estado.clase, 'b-g'); // 2023 sano
    assert.equal(linea[1].estado.clase, 'b-r'); // 2025 degradado
  });
  test('cae a fecha textual cuando no hay año', () => {
    const linea = lineaTiempoInformes([{ fecha: '2024-03', tand: [{ valor_pct: 0.2 }] }]);
    assert.equal(linea[0].ano, null);
    assert.equal(linea[0].fecha, '2024-03');
  });
  test('lista vacía → []', () => {
    assert.deepEqual(lineaTiempoInformes([]), []);
    assert.deepEqual(lineaTiempoInformes(null), []);
  });
});
