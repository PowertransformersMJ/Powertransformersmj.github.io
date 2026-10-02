// Triángulo de Duval 1 · margen de la zona en ppm (`99 §131`). Datos SINTÉTICOS (el repo es público).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { margenPpm, CAMBIO_PEQUENO } from '../assets/js/domain/dga_duval_margen.js';
import { zonaDuval1 } from '../assets/js/domain/dga_duval.js';

const aplicar = (g, m, f) => { const x = { ...g, [m.gas]: g[m.gas] + m.delta * f }; return zonaDuval1(x.CH4, x.C2H4, x.C2H2).zona; };

describe('margen de la zona en ppm', () => {
  test('PD lejos en ppm aunque esté «a menos de 2 puntos» de T1 (la zona PD mide 2 puntos)', () => {
    const g = { CH4: 5000, C2H4: 5, C2H2: 2 };
    assert.equal(zonaDuval1(g.CH4, g.C2H4, g.C2H2).zona, 'PD');
    const m = margenPpm(g);
    // Sumando: (7 + x) / (5007 + x) = 2 % → x ≈ 95,04 ppm de etileno (19 veces lo medido). Restando metano: 7 / (m' + 7) = 2 %
    // → m' = 343 → −4.657 ppm (93 % de lo medido). Gana el metano: es el cambio RELATIVO más chico. Ninguno es pequeño.
    const et = m.opciones.find((o) => o.gas === 'C2H4' && o.delta > 0);
    assert.ok(Math.abs(et.delta - 95.04) < 0.05, String(et.delta));
    assert.equal(m.gas, 'CH4'); assert.equal(m.zona, 'T1'); assert.ok(Math.abs(m.delta + 4657) < 0.5, String(m.delta));
    assert.equal(m.pequeno, false);
  });
  test('cerca de la frontera T2/T3: pocos ppm bastan y se avisa', () => {
    const g = { CH4: 100, C2H4: 98, C2H2: 2 };  // C2H4 49 %, C2H2 1 % → T2; a T3 con +4 de etileno o −4 de metano
    const m = margenPpm(g);
    assert.equal(m.zona, 'T3'); assert.ok(Math.abs(Math.abs(m.delta) - 4) < 0.01, String(m.delta));
    assert.equal(m.pequeno, true, '4 ppm ≤ 15 % de lo medido');
  });
  test('el cambio que devuelve es el primero: un poco más cambia la zona; un poco menos, no', () => {
    for (const g of [{ CH4: 40, C2H4: 30, C2H2: 9 }, { CH4: 12, C2H4: 3, C2H2: 20 }, { CH4: 300, C2H4: 600, C2H2: 0 }, { CH4: 80, C2H4: 4, C2H2: 0.5 }]) {
      const m = margenPpm(g); const base = zonaDuval1(g.CH4, g.C2H4, g.C2H2).zona;
      assert.notEqual(aplicar(g, m, 1.0001), base); assert.equal(aplicar(g, m, 0.9999), base);
    }
  });
  test('se compara gas por gas: una traza no tapa a otro gas que cambia la zona dentro de su 15 % (revisión 2026-10-02)', () => {
    for (const g of [{ CH4: 168, C2H4: 148, C2H2: 5 }, { CH4: 750.1, C2H4: 162.6, C2H2: 2.3 }, { CH4: 960, C2H4: 5.5, C2H2: 34.5 }]) {
      const m = margenPpm(g);
      assert.equal(m.pequeno, true, JSON.stringify(g)); assert.equal(m.gas, 'CH4'); assert.ok(m.delta < 0);
      assert.notEqual(aplicar(g, m, 1.0001), zonaDuval1(g.CH4, g.C2H4, g.C2H2).zona);
    }
  });
  test('una traza de acetileno decide: 1 ppm o menos se marca como no firme', () => {
    const m = margenPpm({ CH4: 12, C2H4: 6, C2H2: 0 });  // T2 con C2H2 0; x / (18 + x) = 4 % → 0,75 ppm de acetileno la lleva a DT
    assert.equal(m.gas, 'C2H2'); assert.equal(m.zona, 'DT'); assert.ok(Math.abs(m.delta - 0.75) < 0.001, String(m.delta));
    assert.ok(m.delta <= CAMBIO_PEQUENO.ppmMin); assert.equal(m.pequeno, true);
  });
  test('sin los tres gases o con el triángulo vacío no hay margen', () => {
    assert.equal(margenPpm({ CH4: 5, C2H4: null, C2H2: 0 }), null);
    assert.equal(margenPpm({ CH4: 0, C2H4: 0, C2H2: 0 }), null);
    assert.equal(margenPpm(null), null);
  });
});
