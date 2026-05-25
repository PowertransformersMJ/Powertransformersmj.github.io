// node --test tests/cargabilidad_severidad.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sev, metricPct, recompute, recomputeAll } from '../assets/js/domain/cargabilidad_severidad.js';

test('sev clasifica por umbrales canónicos', () => {
  assert.equal(sev(null),  'nd');
  assert.equal(sev(0),     'ok');
  assert.equal(sev(50),    'ok');
  assert.equal(sev(79.9),  'ok');
  assert.equal(sev(80),    'avi');
  assert.equal(sev(94.9),  'avi');
  assert.equal(sev(95),    'ale');
  assert.equal(sev(100),   'ale');   // borde superior: 100 todavía es ale
  assert.equal(sev(100.1), 'cri');
  assert.equal(sev(150),   'cri');
});

test('sev maneja valores extremos sin crashear', () => {
  assert.equal(sev(undefined), 'nd');
  // NaN no es null y todas las comparaciones con NaN devuelven false,
  // por lo tanto sev(NaN) cae al return final → 'ok'. Es determinista.
  assert.equal(sev(NaN), 'ok');
});

test('metricPct con devSel "all" devuelve cmax', () => {
  const d = { cmax: 87.5, P: { pct: 75 }, S: { pct: 87.5 }, T: { pct: null } };
  assert.equal(metricPct(d, 'all'), 87.5);
});

test('metricPct con devSel específico devuelve pct del devanado', () => {
  const d = { cmax: 87.5, P: { pct: 75 }, S: { pct: 87.5 }, T: { pct: null } };
  assert.equal(metricPct(d, 'P'), 75);
  assert.equal(metricPct(d, 'S'), 87.5);
  assert.equal(metricPct(d, 'T'), null);
});

test('metricPct con dataset nulo devuelve null', () => {
  assert.equal(metricPct(null, 'all'), null);
  assert.equal(metricPct(undefined, 'P'), null);
});

test('recompute recalcula pct por devanado a partir de car/amp', () => {
  const d = {
    P: { amp: 100, car: 80, pct: null },
    S: { amp: 200, car: 220, pct: null },  // > 100% sobrecarga
    T: { amp: null, car: null, pct: null },
  };
  recompute(d);
  assert.equal(d.P.pct, 80);
  assert.equal(d.S.pct, 110);
  assert.equal(d.T.pct, null);
  assert.equal(d.cmax, 110);
  assert.equal(d.dev, 'Secundario');
});

test('recompute con todos los devanados sin dato deja cmax/dev null', () => {
  const d = {
    P: { amp: null, car: null, pct: null },
    S: { amp: null, car: null, pct: null },
    T: { amp: null, car: null, pct: null },
  };
  recompute(d);
  assert.equal(d.cmax, null);
  assert.equal(d.dev, null);
});

test('recompute con datos solo en primario marca dev=Primario', () => {
  const d = {
    P: { amp: 50, car: 30, pct: null },
    S: { amp: null, car: null, pct: null },
    T: { amp: null, car: null, pct: null },
  };
  recompute(d);
  assert.equal(d.P.pct, 60);
  assert.equal(d.cmax, 60);
  assert.equal(d.dev, 'Primario');
});

test('recompute conserva pct existente cuando car/amp es null', () => {
  const d = {
    P: { amp: null, car: null, pct: 42 },  // dato pre-calculado por backend
    S: { amp: 100, car: 50, pct: null },
    T: { amp: null, car: null, pct: null },
  };
  recompute(d);
  // P mantiene su pct=42 porque no hay amp para recalcular
  assert.equal(d.P.pct, 42);
  // cmax = max(42, 50) = 50
  assert.equal(d.cmax, 50);
});

test('recomputeAll itera el array y devuelve el mismo array', () => {
  const arr = [
    { P: { amp: 100, car: 90 }, S: { amp: null, car: null }, T: { amp: null, car: null } },
    { P: { amp: 200, car: 250 }, S: { amp: null, car: null }, T: { amp: null, car: null } },
  ];
  const ret = recomputeAll(arr);
  assert.equal(ret, arr);
  assert.equal(arr[0].cmax, 90);
  assert.equal(arr[0].dev, 'Primario');
  assert.equal(arr[1].cmax, 125);
});

test('recomputeAll con input no-array no rompe', () => {
  assert.equal(recomputeAll(null), null);
  assert.equal(recomputeAll(undefined), undefined);
  assert.equal(recomputeAll('x'), 'x');
});
