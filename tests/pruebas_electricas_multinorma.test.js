// Evaluación MULTI-NORMA (domain/pruebas_electricas_multinorma.js).
// Dominio puro: sin DOM ni Firestore. node --test. Verifica que cada prueba se
// evalúe contra CADA norma, el consolidado sea el más conservador, y se detecte
// la divergencia (caso testigo aislamiento 110 kV).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { evaluarMultiNorma, metricaPrueba, CRITERIOS_MULTINORMA } from '../assets/js/domain/pruebas_electricas_multinorma.js';

describe('evaluarMultiNorma — resistencia (NETA 2% vs industria 3%)', () => {
  test('0.58% → todas aprueban, sin divergencia, consolidado verde', () => {
    const r = evaluarMultiNorma('resistencia', 0.58);
    assert.equal(r.consolidado.clase, 'b-g');
    assert.equal(r.divergen, false);
  });
  test('2.5% → NETA rojo / industria verde-ámbar → DIVERGEN, consolidado rojo', () => {
    const r = evaluarMultiNorma('resistencia', 2.5);
    assert.equal(r.consolidado.clase, 'b-r');   // NETA ≤2% manda (peor)
    assert.equal(r.divergen, true);
  });
  test('lista las ópticas con su norma citada (NETA + industria + método + MO.00418)', () => {
    const r = evaluarMultiNorma('resistencia', 1);
    const normas = r.opticas.map((o) => o.norma);
    assert.ok(normas.some((n) => /NETA/.test(n)));
    assert.ok(normas.some((n) => /industria/i.test(n)));
    assert.ok(normas.some((n) => /C57\.152/.test(n)));
    assert.ok(normas.some((n) => /MO\.00418/.test(n)));
  });
});

describe('evaluarMultiNorma — aislamiento (caso testigo 110 kV)', () => {
  test('5 GΩ con clase 30 GΩ → pasa piso NETA (5) pero falla por clase → DIVERGEN, consolidado investigar', () => {
    const r = evaluarMultiNorma('aislamiento', 5, { minClase: 30 });
    const neta = r.opticas.find((o) => /100\.5/.test(o.norma));
    const clase = r.opticas.find((o) => /clase/i.test(o.norma));
    assert.equal(neta.estado.clase, 'b-g');     // 5 ≥ 5 piso absoluto
    assert.equal(clase.estado.clase, 'b-o');    // 5 < 30 por clase
    assert.equal(r.divergen, true);
    assert.equal(r.consolidado.clase, 'b-o');   // el más conservador
  });
  test('sin minClase → solo piso NETA 5 GΩ; 6 GΩ → verde', () => {
    const r = evaluarMultiNorma('aislamiento', 6, {});
    assert.equal(r.consolidado.clase, 'b-g');
  });
  test('2.5 GΩ < piso NETA 5 → investigar aun sin clase', () => {
    assert.equal(evaluarMultiNorma('aislamiento', 2.5, {}).consolidado.clase, 'b-o');
  });
});

describe('evaluarMultiNorma — tan δ (NETA 0.5% vs IEEE 0.7 banda)', () => {
  test('0.5135% → NETA investiga (>0.5) / IEEE verde (≤0.7) → DIVERGEN', () => {
    const r = evaluarMultiNorma('tand', 0.5135);
    assert.equal(r.divergen, true);
    assert.equal(r.consolidado.clase, 'b-o'); // NETA manda (más conservador)
  });
  test('0.30% → ambas verde, sin divergencia', () => {
    const r = evaluarMultiNorma('tand', 0.30);
    assert.equal(r.consolidado.clase, 'b-g');
    assert.equal(r.divergen, false);
  });
});

describe('evaluarMultiNorma — relación (NETA = IEEE, sin divergencia)', () => {
  test('1.26% → fuera de norma en ambas, NO divergen', () => {
    const r = evaluarMultiNorma('relacion', 1.26);
    assert.equal(r.consolidado.clase, 'b-r');
    assert.equal(r.divergen, false);
  });
});

describe('metricaPrueba — peor caso por familia', () => {
  const inf = {
    tand: [{ valor_pct: 0.2 }, { valor_pct: 0.51 }],
    excitacion: { delta_ext_pct: 3 },
    relacion: [{ desviacion_pct: -1.26 }, { desviacion_pct: 0.21 }],
    resistencia: [{ delta_max_pct: 0.58 }, { delta_max_pct: 0.11 }],
    aislamiento: [{ gohm: 6.0 }, { gohm: 5.0 }],
    collar: { max_mw: 40 }
  };
  test('tand = máx, relación = máx |desv|, resistencia = máx, aislamiento = mín', () => {
    assert.equal(metricaPrueba('tand', inf), 0.51);
    assert.equal(metricaPrueba('excitacion', inf), 3);
    assert.equal(metricaPrueba('relacion', inf), 1.26);
    assert.equal(metricaPrueba('resistencia', inf), 0.58);
    assert.equal(metricaPrueba('aislamiento', inf), 5.0);
    assert.equal(metricaPrueba('collar', inf), 40);
  });
  test('familia sin dato → null', () => {
    assert.equal(metricaPrueba('tand', {}), null);
    assert.equal(metricaPrueba('aislamiento', { aislamiento: [] }), null);
  });
});

describe('CRITERIOS_MULTINORMA cubre las familias del tablero', () => {
  test('tand, bushing, excitacion, relacion, resistencia, aislamiento, collar', () => {
    ['tand', 'bushing', 'excitacion', 'relacion', 'resistencia', 'aislamiento', 'collar']
      .forEach((k) => assert.ok(Array.isArray(CRITERIOS_MULTINORMA[k]) && CRITERIOS_MULTINORMA[k].length, k));
  });
});
