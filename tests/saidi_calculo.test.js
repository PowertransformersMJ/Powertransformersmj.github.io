// node --test tests/saidi_calculo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sumSerie, avgSerie, growthPct, varMoM,
  catTotals, gruposDeZona, categoriasDeZona, totalSerieDeZona, proyeccionDeZona, listarZonas,
} from '../assets/js/domain/saidi_calculo.js';
import { categoriaColor, grupoCorto, metKey, metricaNombre, COLORS, clasificarGrupoCausa, CAUSAS_CANON } from '../assets/js/domain/saidi_config.js';

// ── sumSerie ──────────────────────────────────────────────────
test('sumSerie suma valores y skipea nulls', () => {
  assert.equal(sumSerie([1, 2, 3]), 6);
  assert.equal(sumSerie([1, null, 3]), 4);
  assert.equal(sumSerie([]), 0);
  assert.equal(sumSerie(null), 0);
  assert.equal(Math.abs(sumSerie([0.1, 0.2]) - 0.3) < 1e-9, true);
});

test('avgSerie promedia ignorando nulls', () => {
  assert.equal(avgSerie([2, 4, 6]), 4);
  assert.equal(avgSerie([2, null, 6]), 4);
  assert.equal(avgSerie([]), 0);
  assert.equal(avgSerie(null), 0);
});

// ── growthPct ─────────────────────────────────────────────────
test('growthPct calcula crecimiento entre primer y último', () => {
  assert.equal(growthPct([1, 2]), 100);
  assert.equal(growthPct([2, 1]), -50);
  assert.equal(growthPct([0.1959, 0.997]), 409);  // del baseline real (Ene→May TODAS)
});

test('growthPct devuelve null cuando primer valor es 0', () => {
  assert.equal(growthPct([0, 5]), null);
});

test('growthPct devuelve null con datos insuficientes', () => {
  assert.equal(growthPct([]), null);
  assert.equal(growthPct([5]), null);
});

// ── varMoM ────────────────────────────────────────────────────
test('varMoM primer elemento es null y resto es % vs mes anterior', () => {
  const v = varMoM([1, 2, 1.5, 3]);
  assert.equal(v[0], null);
  assert.equal(v[1], 100);
  assert.equal(v[2], -25);
  assert.equal(v[3], 100);
});

test('varMoM maneja div-por-cero como null', () => {
  const v = varMoM([0, 5, 10]);
  assert.equal(v[0], null);
  assert.equal(v[1], null);  // prev=0 → null
  assert.equal(v[2], 100);
});

// ── catTotals ─────────────────────────────────────────────────
const datasetMock = {
  meses: ['Ene', 'Feb', 'Mar'],
  cats_order: ['Cat A', 'Cat B', 'Cat C'],
  zonas: {
    TODAS: {
      total_saidi: [1, 2, 3],
      total_saifi: [0.5, 1, 1.5],
      grp_saidi: {
        'Sobrecarga/Deslastre':  [0.5, 1, 1.5],
        'Racionamiento/Deficit': [0, 0, 0.2],
        'Otras causas':          [0.5, 1, 1.3],
      },
      grp_saifi: {
        'Sobrecarga/Deslastre':  [0.1, 0.2, 0.3],
        'Racionamiento/Deficit': [0, 0, 0.05],
        'Otras causas':          [0.4, 0.8, 1.15],
      },
      cat_saidi: {
        'Cat A': [0.4, 0.7, 1.0],
        'Cat B': [0.1, 0.3, 0.5],
        'Cat C': [0, 0, 0],
      },
      cat_saifi: {
        'Cat A': [0.05, 0.1, 0.15],
        'Cat B': [0.05, 0.1, 0.15],
        'Cat C': [0, 0, 0],
      },
      proj: { real: [], base: [], opt: [], pes: [], ci_inf: [], ci_sup: [], r2: 0.9, slope: 0.1, pval: 0.05 },
    },
    BOLIVAR: {
      total_saidi: [0.5, 1, 1.5],
      total_saifi: [0.25, 0.5, 0.75],
      grp_saidi: { 'Sobrecarga/Deslastre': [0.3, 0.6, 0.9], 'Racionamiento/Deficit': [0, 0, 0], 'Otras causas': [0.2, 0.4, 0.6] },
      grp_saifi: { 'Sobrecarga/Deslastre': [0.05, 0.1, 0.15], 'Racionamiento/Deficit': [0, 0, 0], 'Otras causas': [0.2, 0.4, 0.6] },
      cat_saidi: {}, cat_saifi: {},
      proj: { real: [0.3, 0.6, 0.9], base: [], opt: [], pes: [], ci_inf: [], ci_sup: [], r2: 0.95, slope: 0.3, pval: 0.01 },
    },
  },
};

test('catTotals ordena descendente por total y filtra ceros', () => {
  const t = catTotals(datasetMock, 'TODAS', 'saidi');
  assert.equal(t.length, 2);   // Cat C tiene total 0, se filtra
  assert.equal(t[0].cat, 'Cat A');
  assert.equal(t[0].tot, 2.1); // 0.4 + 0.7 + 1.0
  assert.equal(t[1].cat, 'Cat B');
});

test('catTotals devuelve [] para zona inexistente', () => {
  assert.deepEqual(catTotals(datasetMock, 'NOZONA', 'saidi'), []);
});

test('gruposDeZona devuelve series de los 3 grupos', () => {
  const g = gruposDeZona(datasetMock, 'TODAS', 'saidi');
  assert.deepEqual(g['Sobrecarga/Deslastre'], [0.5, 1, 1.5]);
  assert.deepEqual(g['Racionamiento/Deficit'], [0, 0, 0.2]);
});

test('categoriasDeZona respeta el selector de métrica', () => {
  const cs = categoriasDeZona(datasetMock, 'TODAS', 'saifi');
  assert.deepEqual(cs['Cat A'], [0.05, 0.1, 0.15]);
});

test('totalSerieDeZona devuelve la serie correcta según métrica', () => {
  assert.deepEqual(totalSerieDeZona(datasetMock, 'TODAS', 'saidi'), [1, 2, 3]);
  assert.deepEqual(totalSerieDeZona(datasetMock, 'TODAS', 'saifi'), [0.5, 1, 1.5]);
});

test('proyeccionDeZona retorna null si no existe', () => {
  assert.equal(proyeccionDeZona(datasetMock, 'NOZONA'), null);
  assert.equal(proyeccionDeZona(datasetMock, 'BOLIVAR').r2, 0.95);
});

test('listarZonas devuelve las claves del dataset', () => {
  assert.deepEqual(listarZonas(datasetMock).sort(), ['BOLIVAR', 'TODAS']);
});

// ── Config helpers ────────────────────────────────────────────
test('categoriaColor: SOBRE / Sobrecarga / STR → rojo', () => {
  assert.equal(categoriaColor('SOBRECARGA TRAFO SDL'), COLORS.RED);
  assert.equal(categoriaColor('Sobrecarga'), COLORS.RED);
  assert.equal(categoriaColor('Sobrecarga del STR'), COLORS.RED);
});

test('categoriaColor: Racion → púrpura', () => {
  assert.equal(categoriaColor('Racion. Emergencia Deficit STN'), COLORS.PURPLE);
  assert.equal(categoriaColor('Racion. Programado Deficit STN'), COLORS.PURPLE);
});

// Quirk del archivo original: "Deslastre" coincide con "STR" en uppercase
// (DESLASTRE → DESLA-STR-E) y queda clasificado como rojo. Se conserva
// igual que el original para no romper el semáforo visual (regla §0.1.2.1).
test('categoriaColor: Deslastre (quirk del original) → rojo por match "STR"', () => {
  assert.equal(categoriaColor('Deslastre por capacidad SDL'), COLORS.RED);
  assert.equal(categoriaColor('Deslastre cap. TC/Cable SDL'), COLORS.RED);
  assert.equal(categoriaColor('Deslastre cap. transformacion trafo SDL'), COLORS.RED);
});

test('categoriaColor: categorías sin match → ámbar (fallback)', () => {
  assert.equal(categoriaColor('Otro tipo'), COLORS.AMBER);
  assert.equal(categoriaColor('Mantenimiento'), COLORS.AMBER);
});

test('grupoCorto: Racion → "rac", otros → "sob"', () => {
  assert.equal(grupoCorto('Racion. Emergencia Deficit STN'), 'rac');
  assert.equal(grupoCorto('SOBRECARGA TRAFO SDL'), 'sob');
  assert.equal(grupoCorto('Deslastre cap. transporte'), 'sob');
});

// ── Clasificador canónico de causas ───────────────────────────
test('clasificarGrupoCausa: racionamiento (aun con STR) → Racionamiento/Deficit', () => {
  assert.equal(clasificarGrupoCausa('Racionamiento Programado por Deficit STN'), 'Racionamiento/Deficit');
  assert.equal(clasificarGrupoCausa('Racionamiento de Emergencia por Deficit STN'), 'Racionamiento/Deficit');
  // Regresión: "del STR" no debe arrastrar a Sobrecarga/Deslastre por el match "STR".
  assert.equal(clasificarGrupoCausa('Racionamiento de Emergencia por Deficit del STR'), 'Racionamiento/Deficit');
});

test('clasificarGrupoCausa: sobrecarga y deslastre → Sobrecarga/Deslastre', () => {
  assert.equal(clasificarGrupoCausa('SOBRECARGA TRAFO SDL'), 'Sobrecarga/Deslastre');
  assert.equal(clasificarGrupoCausa('Sobrecarga'), 'Sobrecarga/Deslastre');
  assert.equal(clasificarGrupoCausa('Sobrecarga del STR'), 'Sobrecarga/Deslastre');
  assert.equal(clasificarGrupoCausa('Deslastre de carga por capacidad de transformacion'), 'Sobrecarga/Deslastre');
});

test('clasificarGrupoCausa: sin match → Otras causas', () => {
  assert.equal(clasificarGrupoCausa('Mantenimiento'), 'Otras causas');
  assert.equal(clasificarGrupoCausa(''), 'Otras causas');
  assert.equal(clasificarGrupoCausa(null), 'Otras causas');
});

test('CAUSAS_CANON: las 13 causas mapean a Racionamiento o Sobrecarga/Deslastre', () => {
  assert.equal(CAUSAS_CANON.length, 13);
  for (const causa of CAUSAS_CANON) {
    const g = clasificarGrupoCausa(causa);
    assert.notEqual(g, 'Otras causas', `"${causa}" no debería caer en Otras causas`);
  }
});

// Regresión del bug Racionamiento+STR en el color de barra.
test('categoriaColor: Racionamiento ... del STR → púrpura (no rojo)', () => {
  assert.equal(categoriaColor('Racionamiento de Emergencia por Deficit del STR'), COLORS.PURPLE);
});

test('metKey concatena prefijo + métrica', () => {
  assert.equal(metKey('grp', 'saidi'), 'grp_saidi');
  assert.equal(metKey('cat', 'saifi'), 'cat_saifi');
});

test('metricaNombre devuelve etiqueta humana', () => {
  assert.equal(metricaNombre('saidi'), 'SAIDI_E');
  assert.equal(metricaNombre('saifi'), 'SAIFI_E');
  assert.equal(metricaNombre('xxx'), 'SAIDI_E');  // fallback
});
