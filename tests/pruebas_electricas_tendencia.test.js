// Tendencia temporal multi-informe (domain/pruebas_electricas_tendencia.js).
// Dominio puro: sin DOM ni Firestore. node --test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { bloquesTendencia, METRICAS_TENDENCIA, resumenTendenciaParaIA, analisisTendencia, cambiosAnoAno, proyectarTendencia } from '../assets/js/domain/pruebas_electricas_tendencia.js';

// Dos informes del mismo transformador en años distintos (la tan δ empeora).
const INFORMES = [
  {
    ano: 2023,
    tand: [{ valor_pct: 0.51 }, { valor_pct: 0.20 }],
    bushing: { fp_max_pct: 0.42 },
    excitacion: { delta_ext_pct: 3.0 },
    relacion: [{ desviacion_pct: -0.14 }, { desviacion_pct: 0.06 }],
    resistencia: [{ delta_max_pct: 1.07 }, { delta_max_pct: 0.43 }],
    aislamiento: [{ gohm: 6.01 }, { gohm: 5.0 }],
    collar: { max_mw: 40 }
  },
  {
    ano: 2025,
    tand: [{ valor_pct: 0.78 }],
    bushing: { fp_max_pct: 0.55 },
    excitacion: { delta_ext_pct: 2.4 },
    relacion: [{ desviacion_pct: 0.21 }],
    resistencia: [{ delta_max_pct: 1.2 }],
    aislamiento: [{ gohm: 4.5 }],
    collar: { max_mw: 55 }
  }
];

describe('bloquesTendencia · agregación temporal por métrica', () => {
  test('un bloque por métrica con datos, ordenado por año', () => {
    const bloques = bloquesTendencia(INFORMES);
    assert.equal(bloques.length, METRICAS_TENDENCIA.length); // todas tienen datos
    const tand = bloques.find((b) => b.prueba === 'tand');
    assert.equal(tand.series[0].puntos.length, 2);
    assert.deepEqual(tand.series[0].puntos.map((p) => p.x), [2023, 2025]);
  });

  test('tan δ usa el MÁXIMO por informe (peor sección)', () => {
    const tand = bloquesTendencia(INFORMES).find((b) => b.prueba === 'tand');
    assert.equal(tand.series[0].puntos[0].y, 0.51); // 2023: max(0.51,0.20)
    assert.equal(tand.series[0].puntos[1].y, 0.78); // 2025
    assert.equal(tand.limite, 1);
  });

  test('relación usa el máximo VALOR ABSOLUTO de desviación', () => {
    const rel = bloquesTendencia(INFORMES).find((b) => b.prueba === 'relacion');
    assert.equal(rel.series[0].puntos[0].y, 0.14); // max(|-0.14|,|0.06|)
    assert.equal(rel.limite, 0.5);
  });

  test('aislamiento usa el MÍNIMO (peor) e invierte el límite', () => {
    const ais = bloquesTendencia(INFORMES).find((b) => b.prueba === 'aislamiento');
    assert.equal(ais.series[0].puntos[0].y, 5.0); // 2023: min(6.01,5.0)
    assert.equal(ais.series[0].puntos[1].y, 4.5);
    assert.equal(ais.invertir, true);
  });

  test('un solo informe → un punto por métrica (scaffolding válido)', () => {
    const bloques = bloquesTendencia([INFORMES[0]]);
    assert.ok(bloques.length);
    assert.ok(bloques.every((b) => b.series[0].puntos.length === 1));
  });

  test('métrica sin datos no genera bloque', () => {
    const bloques = bloquesTendencia([{ ano: 2024, tand: [{ valor_pct: 0.3 }] }]);
    assert.deepEqual(bloques.map((b) => b.prueba), ['tand']);
  });

  test('sin informes → []', () => {
    assert.deepEqual(bloquesTendencia([]), []);
    assert.deepEqual(bloquesTendencia(null), []);
  });
});

describe('resumenTendenciaParaIA (F3 · payload compacto para la IA)', () => {
  test('arma una entrada por métrica con umbral, dirección y serie {x,y}', () => {
    const r = resumenTendenciaParaIA(INFORMES);
    assert.ok(r.length, 'debe haber métricas');
    const tand = r.find((m) => /Tangente/i.test(m.metrica));
    assert.ok(tand, 'incluye tan δ');
    assert.equal(tand.unidad, '%');
    assert.equal(tand.limite, 1);
    assert.equal(tand.invertir, false);
    assert.deepEqual(tand.puntos.map((p) => p.x), [2023, 2025]);
    const ais = r.find((m) => /Aislamiento/i.test(m.metrica));
    assert.equal(ais.invertir, true); // el límite es un mínimo
  });
  test('quita el prefijo "Tendencia —" del nombre de la métrica', () => {
    const r = resumenTendenciaParaIA(INFORMES);
    assert.ok(r.every((m) => !/^Tendencia/.test(m.metrica)));
  });
  test('un solo informe → [] (no hay evolución que narrar)', () => {
    assert.deepEqual(resumenTendenciaParaIA([INFORMES[0]]), []);
  });
  test('sin informes → []', () => {
    assert.deepEqual(resumenTendenciaParaIA([]), []);
    assert.deepEqual(resumenTendenciaParaIA(null), []);
  });
});

describe('analisisTendencia (diagnóstico de alto nivel por métrica)', () => {
  test('por métrica: veredicto vigente multi-norma + recomendación + tendencia/Δ', () => {
    const a = analisisTendencia(INFORMES, { minClase: 30 });
    const tand = a.find((m) => m.key === 'tand');
    assert.ok(tand);
    // vigente = 0.78 → NETA 100.3 (>0.5) investiga → consolidado naranja
    assert.equal(tand.estado.clase, 'b-o');
    assert.equal(tand.vigente, 0.78);
    // 0.51 → 0.78 (sube) = empeora (más tan δ es peor)
    assert.equal(tand.tendencia, 'empeora');
    assert.ok(tand.delta > 0);
    assert.match(tand.recomendacion, /\w+/);
  });
  test('aislamiento: bajar de 5.0 a 4.5 GΩ = empeora (invertir) y < piso NETA → investigar', () => {
    const a = analisisTendencia(INFORMES, { minClase: 30 });
    const ais = a.find((m) => m.key === 'aislamiento');
    assert.equal(ais.tendencia, 'empeora'); // bajó → peor
    assert.equal(ais.estado.clase, 'b-o');  // 4.5 < 5 piso NETA → investigar
  });
  test('bushing entra como métrica propia (FP de bujes discriminado)', () => {
    const a = analisisTendencia(INFORMES, { minClase: 30 });
    assert.ok(a.find((m) => m.key === 'bushing'));
  });
  test('sin informes → []', () => {
    assert.deepEqual(analisisTendencia([]), []);
    assert.deepEqual(analisisTendencia(null), []);
  });
});

describe('cambiosAnoAno · todo el historial de cambios', () => {
  test('un par por año consecutivo, con Δ, Δrel y dirección', () => {
    const c = cambiosAnoAno([{ x: 2019, y: 0.2 }, { x: 2021, y: 0.3 }, { x: 2023, y: 0.6 }], false);
    assert.equal(c.length, 2);
    assert.deepEqual(c[0], { de: 2019, a: 2021, delta: 0.1, deltaRel: 50, dir: 'empeora' });
    assert.equal(c[1].dir, 'empeora');
  });
  test('estable si |Δrel| ≤ 2%', () => {
    const c = cambiosAnoAno([{ x: 2019, y: 100 }, { x: 2021, y: 101 }], false);
    assert.equal(c[0].dir, 'estable');
  });
  test('aislamiento (invertir): bajar = empeora', () => {
    const c = cambiosAnoAno([{ x: 2019, y: 40 }, { x: 2021, y: 30 }], true);
    assert.equal(c[0].dir, 'empeora');
  });
  test('serie de 1 punto → sin cambios', () => {
    assert.deepEqual(cambiosAnoAno([{ x: 2020, y: 1 }], false), []);
  });
});

describe('proyectarTendencia · ajuste lineal + años hasta cruzar el límite', () => {
  test('tendencia creciente hacia un MÁX → estima años a cruzar', () => {
    // y = 0.1, 0.2, 0.3 en 2019/2021/2023 (pendiente 0.05/año), límite 0.5
    const p = proyectarTendencia([{ x: 2019, y: 0.1 }, { x: 2021, y: 0.2 }, { x: 2023, y: 0.3 }], 0.5, false);
    assert.equal(p.pendiente, 0.05);
    assert.equal(p.anosACruzar, 4); // (0.5-0.3)/0.05 = 4 años desde 2023
    assert.equal(p.yaFuera, false);
    assert.match(p.texto, /cruzaría el límite en ~4/);
  });
  test('ya fuera de norma (sobre el máx) → correctiva', () => {
    const p = proyectarTendencia([{ x: 2019, y: 0.4 }, { x: 2021, y: 0.6 }], 0.5, false);
    assert.equal(p.yaFuera, true);
    assert.match(p.texto, /fuera de norma/i);
  });
  test('aislamiento (invertir): bajando hacia el mínimo → estima cruce', () => {
    // 40 → 35 → 30 (pendiente -2.5/año), límite (mín) 25
    const p = proyectarTendencia([{ x: 2019, y: 40 }, { x: 2021, y: 35 }, { x: 2023, y: 30 }], 25, true);
    assert.ok(p.pendiente < 0);
    assert.equal(p.anosACruzar, 2); // (25-30)/(-2.5) = 2
  });
  test('estable/favorable → sin proyección de cruce', () => {
    const p = proyectarTendencia([{ x: 2019, y: 0.2 }, { x: 2021, y: 0.1 }], 0.5, false);
    assert.equal(p.anosACruzar, null);
    assert.match(p.texto, /estable|favorable/i);
  });
  test('un solo informe → solo una foto', () => {
    const p = proyectarTendencia([{ x: 2020, y: 0.3 }], 0.5, false);
    assert.match(p.texto, /una foto|un solo/i);
    assert.equal(p.anosACruzar, null);
  });
});
