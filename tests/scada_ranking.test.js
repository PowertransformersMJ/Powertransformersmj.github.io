// node --test tests/scada_ranking.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyRanking, calcularHistorial, deltaPosicion, rankSparkline,
} from '../assets/js/domain/scada_ranking.js';

function ev(extras = {}) {
  return Object.assign({
    sid: 'A', sub: 'SUB', asset: 't', kv: '66kV',
    zona: 'NORTE', viol: 1, u: 'U1', param: 'voltage_RS',
    date: '2026-05-18', ts: '2026-05-18T01:00:00',
  }, extras);
}

test('buildDailyRanking calcula posición por día', () => {
  const data = [
    ev({ sid: 'A', date: '2026-05-18' }),
    ev({ sid: 'A', date: '2026-05-18' }),  // A=2 en 18
    ev({ sid: 'B', date: '2026-05-18' }),  // B=1 en 18
    ev({ sid: 'A', date: '2026-05-19' }),  // A=1 en 19
    ev({ sid: 'B', date: '2026-05-19' }),
    ev({ sid: 'B', date: '2026-05-19' }),  // B=2 en 19
  ];
  const r = buildDailyRanking(data);
  assert.deepEqual(r.dates, ['2026-05-18', '2026-05-19']);
  assert.equal(r.ranking['2026-05-18'][0].sid, 'A');
  assert.equal(r.ranking['2026-05-18'][0].rank, 1);
  assert.equal(r.ranking['2026-05-19'][0].sid, 'B');
});

test('buildDailyRanking respeta filtro de zona', () => {
  const data = [
    ev({ sid: 'A', zona: 'NORTE' }),
    ev({ sid: 'B', zona: 'BOLIVAR' }),
  ];
  const r = buildDailyRanking(data, { zona: 'NORTE' });
  assert.equal(r.ranking['2026-05-18'].length, 1);
  assert.equal(r.ranking['2026-05-18'][0].sid, 'A');
});

test('buildDailyRanking respeta filtro por magnitud', () => {
  const data = [
    ev({ sid: 'A', param: 'voltage_RS' }),
    ev({ sid: 'B', param: 'current_R' }),
  ];
  const v = buildDailyRanking(data, { magFilter: 'voltage' });
  assert.equal(v.ranking['2026-05-18'].length, 1);
  assert.equal(v.ranking['2026-05-18'][0].sid, 'A');
});

test('calcularHistorial devuelve best/worst/series por sid', () => {
  const r = buildDailyRanking([
    ev({ sid: 'A', date: '2026-05-18' }),
    ev({ sid: 'A', date: '2026-05-19' }),
    ev({ sid: 'A', date: '2026-05-19' }),  // A=2 en 19
    ev({ sid: 'B', date: '2026-05-18' }),
    ev({ sid: 'B', date: '2026-05-18' }),  // B=2 en 18
    ev({ sid: 'B', date: '2026-05-19' }),  // B=1 en 19
  ]);
  const h = calcularHistorial(r);
  // A: en 18 va #2, en 19 va #1
  assert.equal(h.A.best,  1);
  assert.equal(h.A.worst, 2);
  assert.deepEqual(h.A.series, [2, 1]);
  // B: en 18 va #1, en 19 va #2
  assert.equal(h.B.best,  1);
  assert.equal(h.B.worst, 2);
});

test('deltaPosicion: NEW cuando no había rank previo', () => {
  assert.deepEqual(deltaPosicion(5, undefined), { delta: 'NEW', cls: 'new' });
  assert.deepEqual(deltaPosicion(5, null),      { delta: 'NEW', cls: 'new' });
});

test('deltaPosicion: ▲ cuando mejora posición', () => {
  const r = deltaPosicion(2, 5);  // de #5 a #2 = subió 3 posiciones
  assert.equal(r.delta, '▲ 3');
  assert.equal(r.cls, 'up');
});

test('deltaPosicion: ▼ cuando empeora posición', () => {
  const r = deltaPosicion(7, 2);  // de #2 a #7 = bajó 5 posiciones
  assert.equal(r.delta, '▼ 5');
  assert.equal(r.cls, 'down');
});

test('deltaPosicion: = cuando se mantiene', () => {
  const r = deltaPosicion(3, 3);
  assert.equal(r.delta, '=');
  assert.equal(r.cls, 'same');
});

test('rankSparkline produce 1 char por día', () => {
  const s = rankSparkline([1, 2, 3, 4, 5]);
  assert.equal(s.length, 5);
  // rank 1 = mejor = bloque más alto (último char de la paleta)
  // rank 5 = peor = bloque más bajo
  assert.equal(s[0], '█');
  assert.equal(s[4], '▁');
});

test('rankSparkline maneja null (día sin presencia)', () => {
  const s = rankSparkline([1, null, 3]);
  assert.equal(s.length, 3);
  assert.equal(s[1], ' ');
});

test('rankSparkline con un solo valor devuelve bloque medio', () => {
  const s = rankSparkline([5]);
  // max=min=5, norm=0.5 → bloque medio
  assert.equal(s.length, 1);
});

test('rankSparkline serie vacía devuelve ""', () => {
  assert.equal(rankSparkline([]), '');
  assert.equal(rankSparkline([null, null]), '');
});
