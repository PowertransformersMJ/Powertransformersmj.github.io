// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — La potencia se APRECIA junto a la casilla (99 §81)
// ──────────────────────────────────────────────────────────────
// La casilla de la matriz sigue saliendo de la norma (condición × usuarios).
// Estas piezas solo sirven para mostrar la potencia y advertir cuando el
// registro de usuarios no representa el alcance real. Si alguna de ellas
// empezara a mover la columna, estas pruebas fallan.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANDAS_POTENCIA, bandaPotencia, nivelPorPotencia, avisoDatoConsecuencia,
  conteoPorNivel, calcularRangosCriticidad, nivelPorUsuarios, NIVELES_ORDEN
} from '../assets/js/domain/matriz_riesgo.js';

describe('bandas de potencia (informativas)', () => {
  test('cada banda cubre su tramo, sin huecos ni solapes', () => {
    assert.deepEqual(BANDAS_POTENCIA.map((b) => b.nivel), NIVELES_ORDEN);
    const casos = [[0.225, 'minima'], [4.99, 'minima'], [5, 'menor'], [9.9, 'menor'],
                   [10, 'moderada'], [19.9, 'moderada'], [20, 'mayor'], [49.9, 'mayor'],
                   [50, 'maxima'], [150, 'maxima']];
    casos.forEach(([mva, nivel]) => assert.equal(nivelPorPotencia(mva), nivel, String(mva)));
  });

  test('sin potencia no se inventa banda', () => {
    for (const v of [null, undefined, 0, -3, 'x', NaN]) assert.equal(nivelPorPotencia(v), null, String(v));
    assert.equal(bandaPotencia(null), null);
  });

  test('el tamaño del punto crece con la banda y sirve de leyenda', () => {
    assert.deepEqual(BANDAS_POTENCIA.map((b) => b.punto), [1, 2, 3, 4, 5]);
    assert.equal(bandaPotencia(150).etiqueta, '≥ 50 MVA');
  });
});

describe('la potencia NO mueve la casilla', () => {
  test('dos equipos con los mismos usuarios caen en la misma columna, pesen lo que pesen', () => {
    const rangos = calcularRangosCriticidad(48312);
    const chico = nivelPorUsuarios(5632, rangos);
    const grande = nivelPorUsuarios(5632, rangos);
    assert.equal(chico, grande);
    assert.equal(chico, 'minima');
    // …y su lectura por potencia sí difiere: eso es lo que se muestra al lado.
    assert.notEqual(nivelPorPotencia(3), nivelPorPotencia(150));
  });
});

describe('aviso cuando el registro de usuarios no representa el alcance', () => {
  test('equipo grande con 1 usuario: se advierte el marcador', () => {
    const t = avisoDatoConsecuencia(1, 150);
    assert.ok(t.includes('a confirmar'));
    assert.ok(avisoDatoConsecuencia(0, 60).length > 0);
  });

  test('equipo pequeño con 1 usuario: se dice, sin dramatizar', () => {
    const t = avisoDatoConsecuencia(1, 3);
    assert.ok(t.includes('Sin usuarios registrados'));
  });

  test('muchos usuarios y poca potencia también se señala', () => {
    assert.ok(avisoDatoConsecuencia(33748, 5).includes('Muchos usuarios'));
  });

  test('un equipo normal no dispara aviso', () => {
    assert.equal(avisoDatoConsecuencia(5632, 15), '');
    assert.equal(avisoDatoConsecuencia(null, null), '');
  });
});

describe('conteo del parque por columna (lo que se imprime en la cabecera)', () => {
  test('cuenta cada equipo en su nivel y no se inventa ninguno', () => {
    const rangos = calcularRangosCriticidad(48312);
    const c = conteoPorNivel([1, 100, 9662, 9663, 19325, 28987, 48312], rangos);
    assert.equal(c.minima, 3);
    assert.equal(c.menor, 1);
    assert.equal(c.moderada, 1);
    assert.equal(c.mayor, 1);
    assert.equal(c.maxima, 1);
    assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 7);
  });

  test('valores sin dato no cuentan en ninguna columna', () => {
    const rangos = calcularRangosCriticidad(48312);
    const c = conteoPorNivel([null, undefined, 'x', NaN], rangos);
    assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 0);
  });
});
