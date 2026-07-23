// Evaluación MULTI-NORMA (domain/pruebas_electricas_multinorma.js).
// Dominio puro: sin DOM ni Firestore. node --test. Verifica que cada prueba se
// evalúe contra CADA norma, el consolidado sea el más conservador, y se detecte
// la divergencia (caso testigo aislamiento 110 kV).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { evaluarMultiNorma, metricaPrueba, corrienteExcitacionMax, CRITERIOS_MULTINORMA } from '../assets/js/domain/pruebas_electricas_multinorma.js';

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

// G011 — la óptica IEEE de excitación debe usar la MAGNITUD de corriente para
// elegir el margen: Δ<10% si I<50 mA · Δ<5% si I≥50 mA (IEEE Std 62). Antes se
// ignoraba la corriente (siempre 10%) → sub-calificaba.
describe('evaluarMultiNorma — excitación depende de la corriente (G011)', () => {
  test('I≥50 mA y 5%<Δ≤10% → ROJO (antes quedaba ÁMBAR)', () => {
    const r = evaluarMultiNorma('excitacion', 6, { corrienteMA: 55 });
    assert.equal(r.consolidado.clase, 'b-r'); // fuera de norma
  });
  test('frontera exacta I=50 mA aplica el margen estricto (5%)', () => {
    assert.equal(evaluarMultiNorma('excitacion', 6, { corrienteMA: 50 }).consolidado.clase, 'b-r');
  });
  test('I<50 mA con mismo Δ=6% → NO rojo (margen amplio 10%)', () => {
    const r = evaluarMultiNorma('excitacion', 6, { corrienteMA: 30 });
    assert.notEqual(r.consolidado.clase, 'b-r');
    assert.equal(r.consolidado.clase, 'b-a'); // vigilar (>mitad de 10%)
  });
  test('sin corriente (ctx vacío) conserva el comportamiento previo = margen 10%', () => {
    assert.equal(evaluarMultiNorma('excitacion', 6).consolidado.clase, 'b-a');
    assert.equal(evaluarMultiNorma('excitacion', 6, {}).consolidado.clase, 'b-a');
  });
  test('I≥50 y Δ dentro de 5% → VERDE; el consolidado sale de la óptica IEEE (NETA es cualitativa)', () => {
    assert.equal(evaluarMultiNorma('excitacion', 2, { corrienteMA: 55 }).consolidado.clase, 'b-g');
  });
});

describe('corrienteExcitacionMax — corriente de referencia (máx mA entre fases)', () => {
  test('toma el máximo de las fases', () => {
    assert.equal(corrienteExcitacionMax({ excitacion: { fases: [{ valor: 12 }, { valor: 55 }, { valor: 8 }] } }), 55);
  });
  test('sin fases / sin excitación / entrada nula → null (calificador cae al 10%)', () => {
    assert.equal(corrienteExcitacionMax({ excitacion: { fases: [] } }), null);
    assert.equal(corrienteExcitacionMax({ excitacion: {} }), null);
    assert.equal(corrienteExcitacionMax({}), null);
    assert.equal(corrienteExcitacionMax(null), null);
  });
  test('ignora fases sin valor numérico', () => {
    assert.equal(corrienteExcitacionMax({ excitacion: { fases: [{ valor: null }, { valor: 33 }, {}] } }), 33);
  });
});

// ══════════════════════════════════════════════════════════════
// TODO-15a — óptica ΔC1 de bujes (capacitancia vs placa)
// ══════════════════════════════════════════════════════════════
describe('bushing · óptica ΔC1 vs placa (NETA ±5% · sin rojo automático)', () => {
  const optDc1 = (r) => r.opticas.find((o) => o.norma.includes('ΔC1'));

  test('ΔC1 ≤5% → verde; sin afectar el consolidado si FP verde', () => {
    const r = evaluarMultiNorma('bushing', 0.3, { dc1MaxPct: 4.9 });
    assert.equal(optDc1(r).estado.nivel, 0);
    assert.equal(r.consolidado.nivel, 0);
  });

  test('ΔC1 >5% → investigar y ARRASTRA el consolidado aunque FP esté verde', () => {
    const r = evaluarMultiNorma('bushing', 0.3, { dc1MaxPct: 6.2 });
    assert.equal(optDc1(r).estado.etiqueta, 'investigar');
    assert.equal(r.consolidado.etiqueta, 'investigar');   // el gap que cerró 15a
  });

  test('ΔC1 >10% → SIGUE en investigar (|Δ| absoluto: nunca rojo automático)', () => {
    const r = evaluarMultiNorma('bushing', 0.3, { dc1MaxPct: 14 });
    assert.equal(optDc1(r).estado.etiqueta, 'investigar');
    assert.notEqual(r.consolidado.etiqueta, 'crítico');
  });

  test('sin dc1MaxPct en ctx → óptica NEUTRAL (no participa del consolidado)', () => {
    const r = evaluarMultiNorma('bushing', 0.3, {});
    assert.ok(optDc1(r).estado.nivel < 0);
    assert.equal(r.consolidado.nivel, 0);   // FP verde manda, sin regresión
  });

  test('FP rojo + ΔC1 verde → consolidado sigue rojo (peor óptica manda)', () => {
    const r = evaluarMultiNorma('bushing', 1.4, { dc1MaxPct: 2 });
    assert.ok(r.consolidado.nivel >= 3 || r.consolidado.etiqueta.includes('crít') || r.consolidado.clase === 'b-r');
  });
});
