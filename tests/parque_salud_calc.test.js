// node --test tests/parque_salud_calc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcHI, bucketOf, critNivel, critIndex, domVar,
  avgHI, evaluados, topVar, buildZonaDepto,
  condRigidez, condIC, fmtPct, fmtCond, fmtAvg, fmtMva,
  duvalDashboard, DUVAL_LABELS,
} from '../assets/js/domain/parque_salud_calc.js';
import { PESOS, BUCKETS, BUCKET_NULL, CRIT } from '../assets/js/domain/parque_salud_config.js';

test('calcHI usa pesos canónicos suman 1.0', () => {
  const suma = Object.values(PESOS).reduce((s, p) => s + p, 0);
  assert.equal(Math.abs(suma - 1.0) < 1e-9, true);
});

test('calcHI con activo todo en 3 devuelve 3.00', () => {
  const a = { calif_dga: 3, calif_edad: 3, calif_adfq: 3, calif_fur: 3, calif_crg: 3, calif_pyt: 3, calif_her: 3 };
  assert.equal(calcHI(a), 3);
});

test('calcHI con activo todo en 1 devuelve 1.00', () => {
  const a = { calif_dga: 1, calif_edad: 1, calif_adfq: 1, calif_fur: 1, calif_crg: 1, calif_pyt: 1, calif_her: 1 };
  assert.equal(calcHI(a), 1);
});

test('bucketOf por bordes Tabla 11', () => {
  assert.equal(bucketOf(1.0).cls, 1);
  assert.equal(bucketOf(1.49).cls, 1);
  assert.equal(bucketOf(1.5).cls, 2);
  assert.equal(bucketOf(2.5).cls, 3);
  assert.equal(bucketOf(3.5).cls, 4);
  assert.equal(bucketOf(4.5).cls, 5);
  assert.equal(bucketOf(5).cls, 5);
});

test('bucketOf con null/NaN devuelve BUCKET_NULL', () => {
  assert.equal(bucketOf(null).cls, 0);
  assert.equal(bucketOf(undefined).cls, 0);
  assert.equal(bucketOf(NaN).cls, 0);
  assert.equal(bucketOf(null), BUCKET_NULL);
});

test('critNivel y critIndex con bordes Tabla 9', () => {
  assert.equal(critNivel(1), 'Mínima');
  assert.equal(critNivel(9662), 'Mínima');
  assert.equal(critNivel(9663), 'Menor');
  assert.equal(critNivel(28987), 'Mayor');
  assert.equal(critNivel(48312), 'Máxima');
  assert.equal(critIndex(1), 0);
  assert.equal(critIndex(48312), 4);
});

test('domVar devuelve la variable con peor calificación', () => {
  const a = { calif_dga: 1, calif_edad: 5, calif_adfq: 2, calif_fur: 3, calif_crg: 1, calif_pyt: 2, calif_her: 1 };
  assert.equal(domVar(a), 'Edad');
});

test('avgHI promedia solo activos evaluados', () => {
  const rows = [
    { hi: 1, bucket: BUCKETS[0] },
    { hi: 3, bucket: BUCKETS[2] },
    { hi: 5, bucket: BUCKETS[4] },
    { hi: null, bucket: BUCKET_NULL },
  ];
  assert.equal(avgHI(rows), 3);
  assert.equal(evaluados(rows).length, 3);
  assert.equal(avgHI([]), null);
});

test('topVar identifica variable más alta promedio', () => {
  const rows = [
    { calif_dga: 5, calif_edad: 1, calif_adfq: 1, calif_fur: 1, calif_crg: 1, calif_pyt: 1, calif_her: 1 },
    { calif_dga: 5, calif_edad: 1, calif_adfq: 1, calif_fur: 1, calif_crg: 1, calif_pyt: 1, calif_her: 1 },
  ];
  assert.equal(topVar(rows), 'DGA');
});

test('buildZonaDepto agrupa deptos por zona', () => {
  const rows = [
    { zona: 'BOLIVAR', departamento: 'BOLIVAR' },
    { zona: 'BOLIVAR', departamento: 'SUCRE' },
    { zona: 'ORIENTE', departamento: 'CESAR' },
    { zona: 'BOLIVAR', departamento: 'BOLIVAR' },
  ];
  const m = buildZonaDepto(rows);
  assert.deepEqual(Object.keys(m).sort(), ['BOLIVAR', 'ORIENTE']);
  assert.deepEqual(m.BOLIVAR, ['BOLIVAR', 'SUCRE']);
  assert.deepEqual(m.ORIENTE, ['CESAR']);
});

test('condRigidez aplica Tabla 4 (ASTM D1816)', () => {
  assert.equal(condRigidez(10), 5);   // < 19
  assert.equal(condRigidez(19), 4);   // [19,20)
  assert.equal(condRigidez(22), 3);   // [20,25)
  assert.equal(condRigidez(30), 2);   // [25,33)
  assert.equal(condRigidez(40), 1);   // >= 33
});

test('condIC aplica Tabla 5', () => {
  assert.equal(condIC(500), 5);
  assert.equal(condIC(713), 5);
  assert.equal(condIC(800), 4);
  assert.equal(condIC(999), 4);
  assert.equal(condIC(1100), 3);
  assert.equal(condIC(1400), 2);
  assert.equal(condIC(1500), 1);
});

test('fmtCond, fmtAvg, fmtMva manejan null/NaN', () => {
  assert.equal(fmtCond(null), '—');
  assert.equal(fmtCond(undefined), '—');
  assert.equal(fmtCond(NaN), '—');
  assert.equal(fmtCond(3.4), '3');
  assert.equal(fmtAvg(3.456), '3.5');
  assert.equal(fmtAvg(null), '—');
  assert.equal(fmtPct(15.236), '15.2');
  assert.equal(fmtMva(2500), '2.50k');
  assert.equal(fmtMva(45), '45');
});

test('duvalDashboard: PD con CH4 dominante', () => {
  const dv = duvalDashboard(990, 5, 5);
  assert.equal(dv.zone, 'PD');
  assert.equal(dv.M >= 98, true);
});

test('duvalDashboard: D2 con C2H2 alto', () => {
  const dv = duvalDashboard(20, 40, 40);
  assert.equal(['D2', 'DT'].includes(dv.zone), true);
});

test('duvalDashboard: T3 térmica alta', () => {
  const dv = duvalDashboard(20, 75, 5);
  assert.equal(dv.zone, 'T3');
});

test('duvalDashboard: T1 térmica baja', () => {
  const dv = duvalDashboard(60, 10, 0);
  assert.equal(dv.zone, 'T1');
});

test('duvalDashboard: ∑=0 devuelve null', () => {
  assert.equal(duvalDashboard(0, 0, 0), null);
  assert.equal(duvalDashboard(null, null, null), null);
});

test('DUVAL_LABELS cubre las 7 zonas', () => {
  ['PD', 'D1', 'D2', 'T1', 'T2', 'T3', 'DT'].forEach(z => {
    assert.equal(Array.isArray(DUVAL_LABELS[z]), true);
    assert.equal(DUVAL_LABELS[z].length, 2);
  });
});
