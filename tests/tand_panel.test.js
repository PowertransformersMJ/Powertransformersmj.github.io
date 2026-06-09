// Helper puro del panel tan δ (ui/pruebas/tand-panel.js, ADR-029): mapeo de
// sección de aislamiento → devanado, para agrupar el filtro "por devanado".
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { devanadoDe, analizarTand } from '../assets/js/ui/pruebas/tand-panel.js';

// Mini-informe para el análisis: un rep con un bloque de series (tensiones) y puntos.
const rep = (id, label, secs) => ({ id, label, config: '', bloque: { series: [{ nombre: 'Tan δ @ 10 kV', puntos: secs.map(([x, y]) => ({ x, y })) }] } });
// Rep con DOS tensiones (para tip-up): secs2 = [[sección, y@10kV, y@2kV], …].
const rep2 = (id, label, secs2) => ({ id, label, config: '', bloque: { series: [
  { nombre: 'Tan δ @ 10 kV', puntos: secs2.map(([x, y10]) => ({ x, y: y10 })) },
  { nombre: 'Tan δ @ 2 kV', puntos: secs2.map(([x, , y2]) => ({ x, y: y2 })) },
] } });
const tens2 = ['Tan δ @ 10 kV', 'Tan δ @ 2 kV'];

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

describe('analizarTand · tip-up (ΔFP = FP@alta − FP@baja)', () => {
  test('una sola tensión por sección → no hay tip-up', () => {
    const r = analizarTand([rep('a', '2021', [['CH', 0.3]])], ['CH'], ['Tan δ @ 10 kV']);
    assert.equal(r.tipups.length, 0);
    assert.equal(r.tipResumen, null);
  });
  test('ΔFP positivo grande → ionización (PD/vacíos)', () => {
    // CH: 0.55@10kV − 0.40@2kV = +0.15 > umbral 0.1
    const r = analizarTand([rep2('a', '2021', [['CH', 0.55, 0.40]])], ['CH'], tens2);
    assert.equal(r.tipups.length, 1);
    assert.equal(r.tipups[0].delta, 0.15);
    assert.equal(r.tipups[0].estado, 'ioniza');
    assert.equal(r.tipResumen.ioniza, 1);
    assert.equal(r.tipResumen.peor.sec, 'CH');
  });
  test('ΔFP ≈ 0 → plano (sano)', () => {
    const r = analizarTand([rep2('a', '2021', [['CL', 0.31, 0.29]])], ['CL'], tens2);
    assert.equal(r.tipups[0].estado, 'plano'); // |0.02| ≤ 0.1
    assert.equal(r.tipResumen.planas, 1);
  });
  test('ΔFP negativo grande → tip-down (humedad/tierra núcleo)', () => {
    const r = analizarTand([rep2('a', '2021', [['CHL', 0.20, 0.45]])], ['CHL'], tens2);
    assert.equal(r.tipups[0].delta, -0.25);
    assert.equal(r.tipups[0].estado, 'tipdown');
    assert.equal(r.tipResumen.tipdown, 1);
  });
  test('peor tip-up = mayor |ΔFP| entre secciones', () => {
    const r = analizarTand([rep2('a', '2021', [['CH', 0.55, 0.40], ['CL', 0.20, 0.45]])], ['CH', 'CL'], tens2);
    assert.equal(r.tipResumen.total, 2);
    assert.equal(r.tipResumen.peor.sec, 'CL'); // |−0.25| > |+0.15|
  });
});
