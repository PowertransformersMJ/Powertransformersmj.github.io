// node --test tests/cargabilidad_filtros.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarFiltros, listarUnicos, filtrosVacios } from '../assets/js/domain/cargabilidad_filtros.js';

// Helper para construir un trafo con cmax y devanados
function tx(id, sub, zona, dep, grupo, cmax, extra = {}) {
  return {
    id, sub, zona, dep, grupo, cmax,
    P: { pct: cmax,  car: 100, amp: 100, l1: 100, l2: 110 },
    S: { pct: null,  car: null, amp: null, l1: null, l2: null },
    T: { pct: null,  car: null, amp: null, l1: null, l2: null },
    ...extra,
  };
}

const DATA = [
  tx('T1', 'AGUAS BLANCAS', 'ORIENTE',  'CESAR',     'G1', 55),  // ok
  tx('T2', 'ALGARROBO',     'ORIENTE',  'MAGDALENA', 'G1', 92),  // avi
  tx('T3', 'ANIMAS BAJAS',  'BOLIVAR',  'BOLIVAR',   'G1', 97),  // ale
  tx('T4', 'CALAMAR',       'BOLIVAR',  'BOLIVAR',   'G2', 120), // cri
  tx('T5', 'SANTA MARTA',   'OCCIDENTE','MAGDALENA', 'G3', null), // nd
];

test('filtrosVacios devuelve estructura completa con 4 severidades activas', () => {
  const f = filtrosVacios();
  assert.equal(f.q, '');
  assert.equal(f.zona, '');
  assert.equal(f.dep, '');
  assert.equal(f.grupo, '');
  assert.equal(f.dev, 'all');
  assert.equal(f.sev.size, 4);
  assert.ok(f.sev.has('cri'));
  assert.ok(f.sev.has('ale'));
  assert.ok(f.sev.has('avi'));
  assert.ok(f.sev.has('ok'));
});

test('aplicarFiltros sin filtros devuelve todos (incluyendo nd bajo ok)', () => {
  const out = aplicarFiltros(DATA, filtrosVacios());
  assert.equal(out.length, 5);
});

test('aplicarFiltros con zona devuelve solo coincidencias', () => {
  const f = { ...filtrosVacios(), zona: 'BOLIVAR' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(d => d.id).sort(), ['T3', 'T4']);
});

test('aplicarFiltros con dep filtra por departamento exacto', () => {
  const f = { ...filtrosVacios(), dep: 'MAGDALENA' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(d => d.id).sort(), ['T2', 'T5']);
});

test('aplicarFiltros con grupo filtra exacto', () => {
  const f = { ...filtrosVacios(), grupo: 'G2' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');
});

test('aplicarFiltros con q busca en sub/id/dep (case-insensitive)', () => {
  const f = { ...filtrosVacios(), q: 'cala' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');
});

test('aplicarFiltros con q busca por matrícula', () => {
  const f = { ...filtrosVacios(), q: 't1' };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T1');
});

test('aplicarFiltros con sev excluye severidades desactivadas', () => {
  const f = { ...filtrosVacios(), sev: new Set(['cri']) };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');  // único cri
});

test('aplicarFiltros: nd (sin dato) cuenta como ok', () => {
  // Solo ok activo → debe incluir T1 (ok) y T5 (nd)
  const f = { ...filtrosVacios(), sev: new Set(['ok']) };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(d => d.id).sort(), ['T1', 'T5']);
});

test('aplicarFiltros: sin ok activo, nd se filtra fuera', () => {
  const f = { ...filtrosVacios(), sev: new Set(['cri', 'ale', 'avi']) };
  const out = aplicarFiltros(DATA, f);
  // T1 (ok) y T5 (nd) ambos descartados
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(d => d.id).sort(), ['T2', 'T3', 'T4']);
});

test('aplicarFiltros con dev específico exige pct no nulo en ese devanado', () => {
  // T1 tiene P.pct=55 y S.pct=null → filtrado por dev=S debe excluirlo
  const f = { ...filtrosVacios(), dev: 'S' };
  const out = aplicarFiltros(DATA, f);
  // Ninguno tiene S.pct asignado en el mock
  assert.equal(out.length, 0);
});

test('aplicarFiltros combina múltiples criterios', () => {
  const f = {
    ...filtrosVacios(),
    zona: 'BOLIVAR',
    sev: new Set(['cri']),
  };
  const out = aplicarFiltros(DATA, f);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'T4');
});

test('aplicarFiltros con input no-array devuelve []', () => {
  assert.deepEqual(aplicarFiltros(null, filtrosVacios()), []);
  assert.deepEqual(aplicarFiltros(undefined, filtrosVacios()), []);
});

test('aplicarFiltros con filtros undefined no rompe', () => {
  const out = aplicarFiltros(DATA, undefined);
  assert.equal(Array.isArray(out), true);
});

test('listarUnicos devuelve valores únicos ordenados', () => {
  assert.deepEqual(listarUnicos(DATA, 'zona'), ['BOLIVAR', 'OCCIDENTE', 'ORIENTE']);
  assert.deepEqual(listarUnicos(DATA, 'dep'),  ['BOLIVAR', 'CESAR', 'MAGDALENA']);
  assert.deepEqual(listarUnicos(DATA, 'grupo'), ['G1', 'G2', 'G3']);
});

test('listarUnicos descarta "N/D" y "N/A" y vacíos', () => {
  const data = [
    { x: 'A' }, { x: 'B' }, { x: 'N/D' }, { x: 'N/A' }, { x: '' }, { x: null }, { x: 'A' },
  ];
  assert.deepEqual(listarUnicos(data, 'x'), ['A', 'B']);
});

test('listarUnicos con input no-array devuelve []', () => {
  assert.deepEqual(listarUnicos(null, 'zona'), []);
});
