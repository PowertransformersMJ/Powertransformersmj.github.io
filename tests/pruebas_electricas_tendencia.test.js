// Tendencia temporal multi-informe (domain/pruebas_electricas_tendencia.js).
// Dominio puro: sin DOM ni Firestore. node --test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { bloquesTendencia, METRICAS_TENDENCIA, resumenTendenciaParaIA, analisisTendencia } from '../assets/js/domain/pruebas_electricas_tendencia.js';

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
