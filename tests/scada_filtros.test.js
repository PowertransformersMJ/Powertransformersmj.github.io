// node --test tests/scada_filtros.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGlobalScope, availableDates, filtrosVacios, hayFiltroActivo,
} from '../assets/js/domain/scada_filtros.js';

const data = [
  { date: '2026-05-18', zona: 'NORTE' },
  { date: '2026-05-19', zona: 'NORTE' },
  { date: '2026-05-19', zona: 'BOLIVAR' },
  { date: '2026-05-20', zona: 'OCCIDENTE' },
];

test('filtrosVacios devuelve estructura completa', () => {
  const f = filtrosVacios();
  assert.equal(f.zona, '');
  assert.equal(f.dateMode, 'all');
  assert.equal(f.dateSingle, '');
  assert.equal(f.dateFrom, '');
  assert.equal(f.dateTo, '');
  assert.equal(f.dateCutoff, '');
});

test('applyGlobalScope sin filtros devuelve todo', () => {
  const out = applyGlobalScope(data, filtrosVacios());
  assert.equal(out.length, 4);
});

test('applyGlobalScope filtra por zona', () => {
  const out = applyGlobalScope(data, { ...filtrosVacios(), zona: 'NORTE' });
  assert.equal(out.length, 2);
});

test('applyGlobalScope modo single filtra al día exacto', () => {
  const out = applyGlobalScope(data, {
    ...filtrosVacios(), dateMode: 'single', dateSingle: '2026-05-19',
  });
  assert.equal(out.length, 2);
});

test('applyGlobalScope modo range filtra rango cerrado', () => {
  const out = applyGlobalScope(data, {
    ...filtrosVacios(), dateMode: 'range',
    dateFrom: '2026-05-19', dateTo: '2026-05-20',
  });
  assert.equal(out.length, 3);
});

test('applyGlobalScope modo range con solo dateFrom', () => {
  const out = applyGlobalScope(data, {
    ...filtrosVacios(), dateMode: 'range', dateFrom: '2026-05-20',
  });
  assert.equal(out.length, 1);
});

test('applyGlobalScope modo cutoff filtra acumulado hasta', () => {
  const out = applyGlobalScope(data, {
    ...filtrosVacios(), dateMode: 'cutoff', dateCutoff: '2026-05-19',
  });
  assert.equal(out.length, 3);
});

test('applyGlobalScope combina zona + período', () => {
  const out = applyGlobalScope(data, {
    ...filtrosVacios(),
    zona: 'NORTE',
    dateMode: 'single', dateSingle: '2026-05-18',
  });
  assert.equal(out.length, 1);
});

test('availableDates devuelve fechas únicas ordenadas', () => {
  const dates = availableDates(data);
  assert.deepEqual(dates, ['2026-05-18', '2026-05-19', '2026-05-20']);
});

test('hayFiltroActivo detecta zona', () => {
  const f = { ...filtrosVacios(), zona: 'NORTE' };
  assert.equal(hayFiltroActivo(f), true);
});

test('hayFiltroActivo detecta dateMode con fecha', () => {
  assert.equal(hayFiltroActivo({ ...filtrosVacios(), dateMode: 'single', dateSingle: '2026-05-18' }), true);
  assert.equal(hayFiltroActivo({ ...filtrosVacios(), dateMode: 'cutoff', dateCutoff: '2026-05-18' }), true);
  assert.equal(hayFiltroActivo({ ...filtrosVacios(), dateMode: 'range', dateFrom: '2026-05-18' }), true);
});

test('hayFiltroActivo retorna false para filtros vacíos', () => {
  assert.equal(hayFiltroActivo(filtrosVacios()), false);
});

test('hayFiltroActivo retorna false con dateMode pero sin fechas', () => {
  assert.equal(hayFiltroActivo({ ...filtrosVacios(), dateMode: 'single' }), false);
});
