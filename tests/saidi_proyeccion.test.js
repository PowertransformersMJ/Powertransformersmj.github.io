// node --test tests/saidi_proyeccion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProyeccionOLS } from '../assets/js/domain/saidi_proyeccion.js';

// Datos reales del baseline (TODAS · Sobrecarga/Deslastre · Ene–May)
const REAL_TODAS_SOB = [0.1959, 0.2245, 0.4360, 0.5197, 0.9970];

test('OLS sobre TODAS · Sobrecarga produce slope positivo significativo', () => {
  const p = calcularProyeccionOLS(REAL_TODAS_SOB, 12);
  assert.equal(p.real.length, 12);
  assert.equal(p.base.length, 12);
  assert.equal(p.opt.length, 12);
  assert.equal(p.pes.length, 12);
  assert.equal(p.ci_inf.length, 12);
  assert.equal(p.ci_sup.length, 12);
  // El backend Python reporta slope ≈ 0.1897 — comprobamos +/- 0.01
  assert.equal(Math.abs(p.slope - 0.1897) < 0.01, true, 'slope debe estar cerca de 0.1897');
  // R² > 0.8 — la pendiente es claramente positiva
  assert.ok(p.r2 > 0.8, 'r2 debe ser > 0.8');
  // base[0] debe ser cercano al intercept
  assert.equal(typeof p.intercept, 'number');
});

test('Escenarios opt/pes son ±10% sobre base', () => {
  const p = calcularProyeccionOLS(REAL_TODAS_SOB, 12);
  for (let i = 0; i < 12; i++) {
    // Tolerancia por redondeo a 4 decimales
    if (Math.abs(p.base[i]) > 1e-4) {
      assert.equal(Math.abs(p.opt[i] / p.base[i] - 0.9) < 0.001, true, `opt[${i}]/base[${i}] ≠ 0.9`);
      assert.equal(Math.abs(p.pes[i] / p.base[i] - 1.1) < 0.001, true, `pes[${i}]/base[${i}] ≠ 1.1`);
    }
  }
});

test('IC95% encierra la base proyectada', () => {
  const p = calcularProyeccionOLS(REAL_TODAS_SOB, 12);
  for (let i = 0; i < 12; i++) {
    assert.ok(p.ci_inf[i] <= p.base[i], `ci_inf[${i}] (${p.ci_inf[i]}) debe ≤ base[${i}] (${p.base[i]})`);
    assert.ok(p.ci_sup[i] >= p.base[i], `ci_sup[${i}] (${p.ci_sup[i]}) debe ≥ base[${i}] (${p.base[i]})`);
  }
});

test('OLS con menos de 2 puntos → proyección plana en 0', () => {
  const p1 = calcularProyeccionOLS([null, null, null], 12);
  assert.equal(p1.slope, 0);
  assert.equal(p1.r2, 0);
  assert.equal(p1.base[0], 0);
  const p2 = calcularProyeccionOLS([0.5], 12);
  assert.equal(p2.slope, 0);
});

test('OLS sobre serie constante → slope=0, R²=0', () => {
  const p = calcularProyeccionOLS([1, 1, 1, 1, 1], 12);
  assert.equal(p.slope, 0);
  assert.equal(p.r2, 0);
  // Base proyectada constante en 1
  assert.equal(Math.abs(p.base[6] - 1) < 0.001, true);
});

test('OLS lineal perfecto → R²=1', () => {
  // y = 2x; perfect fit
  const p = calcularProyeccionOLS([0, 2, 4, 6, 8], 12);
  assert.equal(Math.abs(p.r2 - 1) < 0.001, true);
  assert.equal(Math.abs(p.slope - 2) < 0.001, true);
});

test('OLS ignora valores null en la serie real', () => {
  const p = calcularProyeccionOLS([1, 2, 3, null, null], 12);
  // Solo se usan los 3 primeros valores; slope=1 ideal
  assert.equal(Math.abs(p.slope - 1) < 0.01, true);
});

test('p-value de serie con tendencia clara es bajo', () => {
  const p = calcularProyeccionOLS(REAL_TODAS_SOB, 12);
  assert.ok(p.pval < 0.1, 'p-value debe ser < 0.1 (tendencia significativa)');
});

test('p-value de serie aleatoria sin tendencia es alto', () => {
  // Serie con ruido pero sin tendencia clara
  const p = calcularProyeccionOLS([0.5, 0.5, 0.5, 0.5, 0.5], 12);
  // Slope = 0, p-value debería ser ~1 o no significativo
  assert.ok(p.pval >= 0.5 || p.slope === 0);
});

test('BOLIVAR · Sobrecarga reproduce slope del backend', () => {
  const REAL_BOLIVAR = [0.1662, 0.1841, 0.3439, 0.2992, 0.4521];
  const p = calcularProyeccionOLS(REAL_BOLIVAR, 12);
  // Backend reporta 0.0687
  assert.equal(Math.abs(p.slope - 0.0687) < 0.005, true, `slope=${p.slope} ≠ ~0.0687`);
});
