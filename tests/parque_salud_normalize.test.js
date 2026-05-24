// node --test tests/parque_salud_normalize.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _num, _txt, _mva, normalize } from '../assets/js/data/parque_salud_excel.js';

test('_num convierte strings con coma decimal', () => {
  assert.equal(_num('3,14'), 3.14);
  assert.equal(_num('3.14'), 3.14);
  assert.equal(_num(2.71), 2.71);
});

test('_num descarta sentinelas de error', () => {
  assert.equal(_num('#DIV/0!'), null);
  assert.equal(_num('N/A'), null);
  assert.equal(_num(''), null);
  assert.equal(_num(null), null);
  assert.equal(_num('abc'), null);
});

test('_txt limpia espacios y descarta NA', () => {
  assert.equal(_txt('  foo  bar  '), 'foo bar');
  assert.equal(_txt('N/A'), null);
  assert.equal(_txt(''), null);
  assert.equal(_txt(null), null);
});

test('_mva convierte kVA → MVA para TX_Potencia', () => {
  assert.equal(_mva('TX_Potencia', 25000), 25);
  assert.equal(_mva('TPT_Servicio', 5000), 5);
});

test('_mva con string "25,5 MVA" devuelve 25.5', () => {
  const v = _mva('TX_Respaldo', '25,5 MVA');
  // Para valores < 100 se redondea a milésimas
  assert.equal(Math.abs(v - 25.5) < 1e-3, true);
});

test('_mva con Date devuelve null', () => {
  assert.equal(_mva('TX_Potencia', new Date()), null);
  assert.equal(_mva('TX_Potencia', null), null);
});

test('normalize establece hi entero, bucket y zona mayúsculas', () => {
  const out = normalize([
    {
      codigo: '20000001', matricula: 'T1-X', zona: 'bolivar', departamento: 'sucre',
      calif_dga: 3, calif_adfq: 2, calif_fur: 1, calif_crg: 2,
      calif_pyt: 1, calif_edad: 4, calif_her: 1,
      condicion: 3.4, usuarios_aguas_abajo: '12345', mva: '5.5',
    },
  ]);
  assert.equal(out[0].zona, 'BOLIVAR');
  assert.equal(out[0].departamento, 'SUCRE');
  assert.equal(out[0].hi, 3);  // redondeado de 3.4
  assert.equal(out[0].condicion_raw, 3.4);
  assert.equal(out[0].usuarios_aguas_abajo, 12345);
  assert.equal(out[0].mva, 5.5);
  assert.equal(out[0].bucket.cls, 3);
});

test('normalize con condicion null deja hi null y bucket sin evaluación', () => {
  const out = normalize([
    { codigo: 'X', matricula: 'X', zona: 'X', departamento: 'X', condicion: null },
  ]);
  assert.equal(out[0].hi, null);
  assert.equal(out[0].bucket.cls, 0);
});

test('normalize fallback de matrícula al código', () => {
  const out = normalize([
    { codigo: 'X1', zona: 'X', departamento: 'X', condicion: 2 },
  ]);
  assert.equal(out[0].matricula, 'X1');
});

test('normalize zona vacía → SIN ZONA', () => {
  const out = normalize([
    { codigo: 'X', matricula: 'X', zona: '', departamento: '', condicion: 2 },
  ]);
  assert.equal(out[0].zona, 'SIN ZONA');
  assert.equal(out[0].departamento, 'SIN DEPTO');
});

test('normalize calif_* inválido se vuelve null', () => {
  const out = normalize([
    {
      codigo: 'X', matricula: 'X', zona: 'X', departamento: 'X', condicion: 2,
      calif_dga: '', calif_adfq: 'abc', calif_fur: null, calif_crg: 5,
    },
  ]);
  assert.equal(out[0].calif_dga, null);
  assert.equal(out[0].calif_adfq, null);
  assert.equal(out[0].calif_fur, null);
  assert.equal(out[0].calif_crg, 5);
});
