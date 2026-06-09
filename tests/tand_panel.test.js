// Helper puro del panel tan δ (ui/pruebas/tand-panel.js, ADR-029): mapeo de
// sección de aislamiento → devanado, para agrupar el filtro "por devanado".
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { devanadoDe } from '../assets/js/ui/pruebas/tand-panel.js';

describe('devanadoDe · sección de aislamiento → devanado', () => {
  test('AT (H): secciones de alta', () => {
    assert.equal(devanadoDe('CH'), 'AT (H)');
    assert.equal(devanadoDe('CHL'), 'AT (H)');
    assert.equal(devanadoDe('CHT'), 'AT (H)');
  });
  test('MT/BT (L)', () => {
    assert.equal(devanadoDe('CL'), 'MT/BT (L)');
    assert.equal(devanadoDe('CLT'), 'MT/BT (L)');
    assert.equal(devanadoDe('CLH'), 'MT/BT (L)');
  });
  test('Terciario (T)', () => {
    assert.equal(devanadoDe('CT'), 'Terciario (T)');
    assert.equal(devanadoDe('CTH'), 'Terciario (T)');
  });
  test('Combinadas (con +) se separan, sin importar su 1ª letra', () => {
    assert.equal(devanadoDe('CH+CHL'), 'Combinadas');
    assert.equal(devanadoDe('CL+CLT+CLH'), 'Combinadas');
    assert.equal(devanadoDe('CT+CTH+CTL'), 'Combinadas');
  });
});
