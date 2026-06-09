// Helper puro del panel tan δ (ui/pruebas/tand-panel.js, ADR-029): mapeo de
// sección de aislamiento → devanado, para agrupar el filtro "por devanado".
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { devanadoDe, analizarTand } from '../assets/js/ui/pruebas/tand-panel.js';

// Mini-informe para el análisis: un rep con un bloque de series (tensiones) y puntos.
const rep = (id, label, secs) => ({ id, label, config: '', bloque: { series: [{ nombre: 'Tan δ @ 10 kV', puntos: secs.map(([x, y]) => ({ x, y })) }] } });

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

describe('analizarTand · veredicto multi-norma sobre datos reales', () => {
  const tens = ['Tan δ @ 10 kV'];
  test('sin mediciones visibles → null', () => {
    assert.equal(analizarTand([], ['CH'], tens), null);
    assert.equal(analizarTand([rep('a', 'x', [['CH', 0.3]])], ['CH'], []), null);
  });
  test('todo ≤0.5% → cumple ambas normas (NETA y IEEE)', () => {
    const r = analizarTand([rep('a', '2021', [['CH', 0.2], ['CL', 0.35]])], ['CH', 'CL'], tens);
    const neta = r.porNorma.find((p) => p.nm.id === 'neta');
    const ieee = r.porNorma.find((p) => p.nm.id === 'ieee');
    assert.equal(neta.cumplen, 2); assert.equal(neta.superan, 0);
    assert.equal(ieee.cumplen, 2); assert.equal(ieee.superan, 0);
    assert.equal(r.peor.y, 0.35);
  });
  test('valor en 0.5–1% → cumple IEEE pero supera NETA (zona de investigación)', () => {
    const r = analizarTand([rep('a', '2022', [['CH', 0.7], ['CL', 0.3]])], ['CH', 'CL'], tens);
    const neta = r.porNorma.find((p) => p.nm.id === 'neta');
    const ieee = r.porNorma.find((p) => p.nm.id === 'ieee');
    assert.equal(neta.superan, 1); // 0.7 > 0.5
    assert.equal(ieee.superan, 0); // 0.7 ≤ 1
    assert.equal(r.peor.sec, 'CH');
  });
  test('valor >1% → supera AMBAS normas', () => {
    const r = analizarTand([rep('a', '2023', [['CH', 1.4]])], ['CH'], tens);
    assert.equal(r.porNorma.find((p) => p.nm.id === 'ieee').superan, 1);
    assert.equal(r.porNorma.find((p) => p.nm.id === 'neta').superan, 1);
  });
  test('tendencia del peor caso entre informes (cronológico)', () => {
    const r = analizarTand([rep('a', '2021', [['CH', 0.2]]), rep('b', '2023', [['CH', 0.6]])], ['CH'], tens);
    assert.equal(r.tendencia.ini.max, 0.2);
    assert.equal(r.tendencia.fin.max, 0.6);
    assert.equal(r.tendencia.dir, 'al alza');
  });
});
