// Mínimo NETA de aislamiento por clase de tensión (domain/pruebas_electricas_schema.js).
// Dominio puro. node --test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { minNetaGohm, kvAT } from '../assets/js/domain/pruebas_electricas_schema.js';

describe('minNetaGohm · mínimo NETA 100.5 por clase de tensión', () => {
  test('escala con la tensión (toma el escalón ≤ kv)', () => {
    assert.equal(minNetaGohm(5), 1);
    assert.equal(minNetaGohm(13.8), 5);   // clase 15 kV
    assert.equal(minNetaGohm(34.5), 15);
    assert.equal(minNetaGohm(110), 30);   // clase 115 kV → 30 GΩ
    assert.equal(minNetaGohm(115), 30);
  });
  test('por debajo del primer escalón → mínimo base', () => {
    assert.equal(minNetaGohm(0.4), 0.1);
  });
  test('sin tensión → null', () => {
    assert.equal(minNetaGohm(null), null);
    assert.equal(minNetaGohm(undefined), null);
  });
});

describe('kvAT · tensión AT desde el texto de placa', () => {
  test('toma el MAYOR valor (AT)', () => {
    assert.equal(kvAT('110 / 34.5 / 13.8 kV'), 110);
    assert.equal(kvAT('34.5 / 13.8 kV'), 34.5);
  });
  test('un solo valor', () => {
    assert.equal(kvAT('115 kV'), 115);
  });
  test('vacío o sin números → null', () => {
    assert.equal(kvAT(''), null);
    assert.equal(kvAT(null), null);
    assert.equal(kvAT('sin datos'), null);
  });
});
