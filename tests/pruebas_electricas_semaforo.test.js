// Tests del semáforo normativo de Pruebas Eléctricas (Mantenimiento
// Predictivo). Verifica los valores LÍMITE de cada calificador para
// que el comportamiento del tablero original quede congelado: cualquier
// cambio de umbral rompe estos tests a propósito.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADOS, UMBRALES,
  calificarTanDelta, calificarExcitacion, calificarRelacion,
  calificarResistencia, calificarAislamiento, calificarCollar,
  calificarDrm,
  estadoGlobal
} from '../assets/js/domain/pruebas_electricas_semaforo.js';

describe('calificarTanDelta', () => {
  test('≤0.5 → verde (bueno)', () => {
    assert.equal(calificarTanDelta(0).clase, 'b-g');
    assert.equal(calificarTanDelta(0.5).clase, 'b-g');
  });
  test('0.5–0.7 → verde (normal, dentro de norma)', () => {
    assert.equal(calificarTanDelta(0.7).clase, 'b-g');
  });
  test('justo por encima de 0.7 → naranja (investigar)', () => {
    assert.equal(calificarTanDelta(0.71).clase, 'b-o');
    assert.equal(calificarTanDelta(1.0).clase, 'b-o');
  });
  test('>1.0 → rojo (excesivo)', () => {
    assert.equal(calificarTanDelta(1.01).clase, 'b-r');
    assert.equal(calificarTanDelta(2.5).clase, 'b-r');
  });
  test('sin dato → neutral', () => {
    assert.equal(calificarTanDelta(null).clase, 'b-n');
    assert.equal(calificarTanDelta(undefined).clase, 'b-n');
    assert.equal(calificarTanDelta(NaN).clase, 'b-n');
  });
});

describe('calificarExcitacion (Δ depende de la corriente)', () => {
  test('I<50 mA: Δ admisible 10% (verde ≤ mitad, ámbar entre, rojo > 10)', () => {
    assert.equal(calificarExcitacion(5, 30).clase, 'b-g');    // ≤ 5 (mitad) → verde
    assert.equal(calificarExcitacion(5.1, 30).clase, 'b-a');  // > mitad → vigilar
    assert.equal(calificarExcitacion(10, 30).clase, 'b-a');   // = límite → aún ámbar
    assert.equal(calificarExcitacion(10.1, 30).clase, 'b-r'); // > 10 → excede
  });
  test('I≥50 mA: Δ admisible 5% (verde ≤ 2.5, ámbar entre, rojo > 5)', () => {
    assert.equal(calificarExcitacion(2.5, 60).clase, 'b-g');  // ≤ 2.5 (mitad) → verde
    assert.equal(calificarExcitacion(2.6, 60).clase, 'b-a');  // > mitad → vigilar
    assert.equal(calificarExcitacion(5, 60).clase, 'b-a');    // = límite → aún ámbar
    assert.equal(calificarExcitacion(5.1, 60).clase, 'b-r');  // > 5 → excede
  });
  test('frontera de corriente exacta (50 mA) usa el margen estricto', () => {
    // 50 mA ≥ umbral → admisible 5% → 6 > 5 → rojo
    assert.equal(calificarExcitacion(6, 50).clase, 'b-r');
  });
  test('por encima de la mitad del margen → ámbar (vigilar)', () => {
    assert.equal(calificarExcitacion(6, 30).clase, 'b-a'); // 6 > 5 (mitad de 10)
  });
  test('sin dato de Δ → neutral', () => {
    assert.equal(calificarExcitacion(null, 30).clase, 'b-n');
  });
  test('sin corriente → asume margen amplio (10%)', () => {
    assert.equal(calificarExcitacion(9, null).clase, 'b-a'); // 9 ≤ 10 pero > 5 → vigilar
  });
});

describe('calificarRelacion (|Δ| ≤ 0.5%)', () => {
  test('dentro de norma', () => {
    assert.equal(calificarRelacion(0).clase, 'b-g');
    assert.equal(calificarRelacion(0.4).clase, 'b-g');
    assert.equal(calificarRelacion(-0.4).clase, 'b-g'); // usa valor absoluto
  });
  test('cerca del límite (>80%) → ámbar', () => {
    assert.equal(calificarRelacion(0.45).clase, 'b-a'); // > 0.4
    assert.equal(calificarRelacion(0.5).clase, 'b-a');  // = límite
  });
  test('fuera de norma → rojo', () => {
    assert.equal(calificarRelacion(0.51).clase, 'b-r');
    assert.equal(calificarRelacion(-0.6).clase, 'b-r');
  });
});

describe('calificarResistencia (desbalance ≤ 2%, NETA §7.2.2.D.8, flag verificar)', () => {
  test('flag verificar tiene prioridad → ámbar aunque el número esté en rango', () => {
    assert.equal(calificarResistencia(1, true).clase, 'b-a');
    assert.equal(calificarResistencia(null, true).clase, 'b-a');
  });
  test('dentro de norma (≤1.6%)', () => {
    assert.equal(calificarResistencia(0).clase, 'b-g');
    assert.equal(calificarResistencia(1.6).clase, 'b-g');
  });
  test('cerca del límite (>1.6%) → ámbar', () => {
    assert.equal(calificarResistencia(1.8).clase, 'b-a');
    assert.equal(calificarResistencia(2).clase, 'b-a');
  });
  test('fuera de norma (>2%) → rojo', () => {
    assert.equal(calificarResistencia(2.1).clase, 'b-r');
  });
  test('sin dato → neutral', () => {
    assert.equal(calificarResistencia(null).clase, 'b-n');
  });
});

describe('calificarAislamiento (≥ 1 GΩ)', () => {
  test('≥ 1 GΩ → verde', () => {
    assert.equal(calificarAislamiento(1).clase, 'b-g');
    assert.equal(calificarAislamiento(3.5).clase, 'b-g');
  });
  test('< 1 GΩ → rojo', () => {
    assert.equal(calificarAislamiento(0.99).clase, 'b-r');
    assert.equal(calificarAislamiento(0).clase, 'b-r');
  });
  test('sin dato → neutral', () => {
    assert.equal(calificarAislamiento(null).clase, 'b-n');
  });
});

describe('calificarCollar (< 100 mW)', () => {
  test('< 100 mW → verde', () => {
    assert.equal(calificarCollar(0).clase, 'b-g');
    assert.equal(calificarCollar(79).clase, 'b-g');
  });
  test('80–100 mW → ámbar (vigilar)', () => {
    assert.equal(calificarCollar(80).clase, 'b-a');
    assert.equal(calificarCollar(99).clase, 'b-a');
  });
  test('≥ 100 mW → rojo', () => {
    assert.equal(calificarCollar(100).clase, 'b-r');
    assert.equal(calificarCollar(150).clase, 'b-r');
  });
  test('sin dato → neutral', () => {
    assert.equal(calificarCollar(null).clase, 'b-n');
  });
});

describe('calificarDrm (ventana de transición 40–70 ms del conmutador)', () => {
  test('ambos extremos dentro de [45,65] → verde', () => {
    assert.equal(calificarDrm(56, 66).clase, 'b-a'); // 66 > 65 → ámbar
    assert.equal(calificarDrm(46, 64).clase, 'b-g');
    assert.equal(calificarDrm(45, 65).clase, 'b-g'); // guías inclusivas
  });
  test('cerca del borde (entre guía y límite) → ámbar', () => {
    assert.equal(calificarDrm(44, 60).clase, 'b-a'); // 44 < 45
    assert.equal(calificarDrm(50, 66).clase, 'b-a'); // 66 > 65
    assert.equal(calificarDrm(40, 70).clase, 'b-a'); // exactamente en los límites
  });
  test('fuera de la ventana [40,70] → rojo', () => {
    assert.equal(calificarDrm(39, 60).clase, 'b-r');
    assert.equal(calificarDrm(50, 71).clase, 'b-r');
  });
  test('un solo extremo conocido se evalúa solo', () => {
    assert.equal(calificarDrm(56, null).clase, 'b-g'); // 56 dentro de guías
    assert.equal(calificarDrm(null, 66).clase, 'b-a'); // 66 > 65
  });
  test('sin datos → neutral', () => {
    assert.equal(calificarDrm(null, null).clase, 'b-n');
    assert.equal(calificarDrm(undefined, undefined).clase, 'b-n');
  });
});

describe('estadoGlobal (peor prueba define el estado del informe)', () => {
  test('toma el peor estado, ignorando neutrales', () => {
    const e = estadoGlobal({
      tand: ESTADOS.VERDE, relacion: ESTADOS.NARANJA,
      collar: ESTADOS.NEUTRAL, aislamiento: ESTADOS.VERDE
    });
    assert.equal(e.clase, 'b-o');
  });
  test('rojo domina sobre todo', () => {
    const e = estadoGlobal({
      tand: ESTADOS.ROJO, relacion: ESTADOS.AMBAR, collar: ESTADOS.VERDE
    });
    assert.equal(e.clase, 'b-r');
  });
  test('todo neutral o vacío → neutral', () => {
    assert.equal(estadoGlobal({ a: ESTADOS.NEUTRAL }).clase, 'b-n');
    assert.equal(estadoGlobal({}).clase, 'b-n');
    assert.equal(estadoGlobal(null).clase, 'b-n');
  });
});

describe('UMBRALES congelados (regresión de reglas de negocio)', () => {
  test('los límites del tablero original no cambian', () => {
    assert.equal(UMBRALES.tand.limite, 1.0);
    assert.equal(UMBRALES.tand.normal, 0.7);
    assert.equal(UMBRALES.excitacion.corrienteUmbralMA, 50);
    assert.equal(UMBRALES.excitacion.deltaBajaCorriente, 10);
    assert.equal(UMBRALES.excitacion.deltaAltaCorriente, 5);
    assert.equal(UMBRALES.relacion.limite, 0.5);
    assert.equal(UMBRALES.resistencia.limite, 2);
    assert.equal(UMBRALES.aislamiento.minGohm, 1);
    assert.equal(UMBRALES.collar.limite, 100);
  });
});
