// node --test tests/scada_violaciones.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggKPIs, aggTop10, aggTrend, aggByZona, aggByParam, aggHeatmap, aggFiltros,
} from '../assets/js/domain/scada_violaciones.js';
import { magnitudeOf, ELEM_MAP, HEATMAP_PARAMS } from '../assets/js/domain/scada_config.js';

function ev(extras = {}) {
  return Object.assign({
    id: 'x', ts: '2026-05-18T01:00:00', date: '2026-05-18',
    sid: 'SUB1__swTrafo1__66kV', sub: 'SUB1', asset: 'swTrafo1', kv: '66kV',
    zona: 'NORTE', u: 'U2', param: 'voltage_RS', uom: 'kV',
    m: 70, l: 69, v: 1, vp: 1.4, viol: 1,
  }, extras);
}

test('magnitudeOf clasifica correctamente las 9 magnitudes', () => {
  assert.equal(magnitudeOf('voltage_RS'),    'voltage');
  assert.equal(magnitudeOf('voltage_ST'),    'voltage');
  assert.equal(magnitudeOf('voltage_TR'),    'voltage');
  assert.equal(magnitudeOf('current_R'),     'current');
  assert.equal(magnitudeOf('current_S'),     'current');
  assert.equal(magnitudeOf('current_T'),     'current');
  assert.equal(magnitudeOf('active_power'),  'power');
  assert.equal(magnitudeOf('reactive_power'),'power');
  assert.equal(magnitudeOf('apparent_power'),'power');
  assert.equal(magnitudeOf('otro'),          'other');
});

test('ELEM_MAP cubre las 9 entradas U RS .. S', () => {
  ['U RS', 'U ST', 'U TR', 'I R', 'I S', 'I T', 'P', 'Q', 'S'].forEach(k => {
    assert.equal(Array.isArray(ELEM_MAP[k]), true, `falta ${k}`);
    assert.equal(ELEM_MAP[k].length, 2);
  });
});

test('aggKPIs cuenta total/viol/u1/u2/trafos/subs/voltage', () => {
  const data = [
    ev({ id: '1', viol: 1, u: 'U1', param: 'voltage_RS', sub: 'A' }),
    ev({ id: '2', viol: 1, u: 'U2', param: 'voltage_ST', sub: 'A' }),
    ev({ id: '3', viol: 0, u: 'U1', param: 'voltage_TR', sub: 'B' }),
    ev({ id: '4', viol: 1, u: 'U2', param: 'current_R', sub: 'B', sid: 'B__t__22' }),
    ev({ id: '5', viol: 1, u: 'U1', param: 'active_power', sub: 'C', sid: 'C__t__34' }),
  ];
  const k = aggKPIs(data);
  assert.equal(k.total, 5);
  assert.equal(k.viol, 4);
  assert.equal(k.u1, 2);
  assert.equal(k.u2, 2);
  assert.equal(k.voltage, 2);
  assert.equal(k.current, 1);
  assert.equal(k.power, 1);
  assert.equal(k.subs, 3);
});

test('aggKPIs.maxViol toma el evento con v más alto', () => {
  const data = [
    ev({ v: 1.2 }), ev({ v: 5.5 }), ev({ v: 3.3 }),
  ];
  const k = aggKPIs(data);
  assert.equal(k.maxViol.v, 5.5);
});

test('aggTop10 agrupa por sid y ordena descendente', () => {
  const data = [
    ev({ sid: 'A', viol: 1, u: 'U1', v: 1 }),
    ev({ sid: 'A', viol: 1, u: 'U2', v: 2 }),
    ev({ sid: 'A', viol: 1, u: 'U2', v: 3 }),
    ev({ sid: 'B', viol: 1, u: 'U1', v: 5 }),
  ];
  const top = aggTop10(data);
  assert.equal(top.length, 2);
  assert.equal(top[0].sid, 'A');
  assert.equal(top[0].total, 3);
  assert.equal(top[0].u1, 1);
  assert.equal(top[0].u2, 2);
  assert.equal(top[0].maxV, 3);
});

test('aggTop10 filtra por magnitud cuando se pide', () => {
  const data = [
    ev({ sid: 'A', viol: 1, param: 'voltage_RS' }),
    ev({ sid: 'A', viol: 1, param: 'current_R' }),
    ev({ sid: 'B', viol: 1, param: 'voltage_ST' }),
  ];
  const v = aggTop10(data, 'voltage');
  assert.equal(v.length, 2);
  const c = aggTop10(data, 'current');
  assert.equal(c.length, 1);
  assert.equal(c[0].sid, 'A');
});

test('aggTrend (daily) suma U1/U2 por fecha', () => {
  const data = [
    ev({ date: '2026-05-18', ts: '2026-05-18T01:00:00', viol: 1, u: 'U1' }),
    ev({ date: '2026-05-18', ts: '2026-05-18T02:00:00', viol: 1, u: 'U2' }),
    ev({ date: '2026-05-19', ts: '2026-05-19T01:00:00', viol: 1, u: 'U2' }),
  ];
  const t = aggTrend(data, 'daily');
  assert.equal(t.length, 2);
  assert.equal(t[0].label, '2026-05-18');
  assert.equal(t[0].U1, 1); assert.equal(t[0].U2, 1);
  assert.equal(t[1].U2, 1);
});

test('aggTrend (hourly) incluye las 24 horas como labels', () => {
  const data = [
    ev({ ts: '2026-05-18T03:00:00', viol: 1, u: 'U1' }),
    ev({ ts: '2026-05-18T15:00:00', viol: 1, u: 'U2' }),
  ];
  const t = aggTrend(data, 'hourly');
  assert.equal(t.length, 24);
  const h3  = t.find(x => x.label === '03:00');
  const h15 = t.find(x => x.label === '15:00');
  assert.equal(h3.U1, 1); assert.equal(h15.U2, 1);
});

test('aggByZona suma violaciones por zona, ignora no-viol', () => {
  const data = [
    ev({ zona: 'NORTE', viol: 1 }),
    ev({ zona: 'NORTE', viol: 1 }),
    ev({ zona: 'OCCIDENTE', viol: 1 }),
    ev({ zona: 'OCCIDENTE', viol: 0 }),  // no-viol ignorado
    ev({ zona: '', viol: 1 }),           // → SIN_ZONA
  ];
  const z = aggByZona(data);
  const m = Object.fromEntries(z.map(x => [x.zona, x.violations]));
  assert.equal(m.NORTE, 2);
  assert.equal(m.OCCIDENTE, 1);
  assert.equal(m.SIN_ZONA, 1);
});

test('aggByParam ordena descendente', () => {
  const data = [
    ev({ param: 'voltage_RS' }), ev({ param: 'voltage_RS' }),
    ev({ param: 'current_R' }),
  ];
  const p = aggByParam(data);
  assert.equal(p[0].parameter, 'voltage_RS');
  assert.equal(p[0].violations, 2);
});

test('aggHeatmap devuelve top 15 + lista de parámetros', () => {
  const data = [];
  // 17 subestaciones
  for (let i = 0; i < 17; i++) {
    for (let n = 0; n < 17 - i; n++) {
      data.push(ev({ sub: 'SUB_' + i, param: 'voltage_RS' }));
    }
  }
  const { rows, params } = aggHeatmap(data);
  assert.equal(rows.length, 15);
  assert.equal(params.length, HEATMAP_PARAMS.length);
  // El primero debe tener el mayor total
  assert.equal(rows[0].sub, 'SUB_0');
  assert.equal(rows[0].total, 17);
});

test('aggFiltros devuelve catálogos ordenados sin duplicados', () => {
  const data = [
    ev({ sub: 'B', asset: 'a1', kv: '66kV', zona: 'NORTE' }),
    ev({ sub: 'A', asset: 'a2', kv: '34kV', zona: 'BOLIVAR' }),
    ev({ sub: 'A', asset: 'a1', kv: '66kV', zona: 'NORTE' }),
  ];
  const f = aggFiltros(data);
  assert.deepEqual(f.sub,   ['A', 'B']);
  assert.deepEqual(f.asset, ['a1', 'a2']);
  assert.deepEqual(f.kv,    ['34kV', '66kV']);
  assert.deepEqual(f.zona,  ['BOLIVAR', 'NORTE']);
});
