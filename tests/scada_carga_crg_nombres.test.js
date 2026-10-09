// Calificación de cargabilidad CRG 1–5 (`99 §160`): se nombra con la escala de condición del MO.00418 (Guía Fig. 3,
// AX.01 Tabla 11), por decisión del Ingeniero (2026-10-09): 1 Muy Bueno · 2 Bueno · 3 Medio · 4 Pobre · 5 Muy Pobre.
// Las mismas palabras en Cargabilidad SCADA (CRG_CHIP) y en el mapa (NOMBRE_CRG) que en la salud (CONDICIONES).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CRG_CHIP } from '../assets/js/domain/scada_carga_config.js';
import { CONDICIONES } from '../assets/js/domain/schema.js';

const ESCALA = ['Muy Bueno', 'Bueno', 'Medio', 'Pobre', 'Muy Pobre'];

test('CRG_CHIP usa la escala de condición del MO (= CONDICIONES)', () => {
  for (let n = 1; n <= 5; n++) {
    assert.equal(CRG_CHIP[n].palabra, ESCALA[n - 1]);
    assert.equal(CRG_CHIP[n].palabra, CONDICIONES[n - 1].label);
  }
});

test('el mapa nombra la CRG con las mismas palabras (sin el vocabulario viejo)', () => {
  const src = readFileSync(new URL('../assets/js/ui/mapa/mapa-colombia.js', import.meta.url), 'utf8');
  const m = src.match(/const NOMBRE_CRG = (\{[^}]*\});/);
  assert.ok(m, 'NOMBRE_CRG existe');
  const nombres = Function('return ' + m[1])();
  assert.deepEqual([1, 2, 3, 4, 5].map((k) => nombres[k]), ESCALA);
  assert.doesNotMatch(m[1], /Baja|Moderada|Media|Alta|Crítica/);
});
