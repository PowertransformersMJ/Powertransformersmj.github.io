// Tests del parser puro del importador de suministros (F42 + polish 2026-04-27).
// Cero Firebase. Cero SheetJS — el data layer extrae los rows y los
// pasa ya tipados al parser puro. Canal único: Excel (.xlsm).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsearCatalogoRows, parsearMarcasRows, prepararPlanImportacion
} from '../assets/js/domain/importador_suministros.js';

describe('parsearCatalogoRows (Sheet2)', () => {
  test('parsea filas válidas y normaliza unidad', () => {
    const { suministros, errores } = parsearCatalogoRows([
      { ID: 'S01', Nombre: 'Coraza',         Unidad: 'm',   Stock_Inicial: '0',  Valor_Unitario: '15120.00' },
      { ID: 'S02', Nombre: 'Motoventiladores', Unidad: 'Und', Stock_Inicial: '55', Valor_Unitario: '5,233,200.00' }
    ]);
    assert.equal(errores.length, 0);
    assert.equal(suministros.length, 2);
    assert.equal(suministros[0].codigo, 'S01');
    assert.equal(suministros[0].unidad, 'Mt');
    assert.equal(suministros[0].stock_inicial, 0);
    assert.equal(suministros[1].stock_inicial, 55);
    assert.equal(suministros[1].valor_unitario, 5233200);
  });

  test('skipea filas vacías y totalsRow', () => {
    const { suministros } = parsearCatalogoRows([
      {},
      { ID: '', Nombre: '' },
      { ID: 'TOTAL', Nombre: 'TOTAL' },
      { ID: 'S05', Nombre: 'X', Unidad: 'Und', Stock_Inicial: '1' }
    ]);
    assert.equal(suministros.length, 1);
    assert.equal(suministros[0].codigo, 'S05');
  });

  test('codigo lowercase se eleva a uppercase', () => {
    const { suministros } = parsearCatalogoRows([
      { ID: 's03', Nombre: 'Radiador', Unidad: 'Und', Stock_Inicial: '4' }
    ]);
    assert.equal(suministros[0].codigo, 'S03');
  });
});

describe('parsearMarcasRows (Sheet3)', () => {
  test('parsea marcas válidas', () => {
    const { marcas } = parsearMarcasRows([
      { ID_Suministro: 'S02', Nombre_Suministro: 'Motoventiladores', Marca: 'ZIEHL ABEGG' },
      { ID_Suministro: 'S07', Nombre_Suministro: 'Imagen térmica',   Marca: 'MESSKO' }
    ]);
    assert.equal(marcas.length, 2);
    assert.equal(marcas[0].suministro_id, 'S02');
    assert.equal(marcas[0].marca, 'ZIEHL ABEGG');
  });

  test('skipea placeholders "Por definir" y "(edite)"', () => {
    const { marcas } = parsearMarcasRows([
      { ID_Suministro: 'S01', Nombre_Suministro: 'Coraza', Marca: 'Por definir' },
      { ID_Suministro: 'S02', Nombre_Suministro: 'X',      Marca: 'ABB' },
      { ID_Suministro: 'S03', Nombre_Suministro: 'Y',      Marca: '(edite)' },
      { ID_Suministro: 'S04', Nombre_Suministro: 'Z',      Marca: '—' }
    ]);
    assert.equal(marcas.length, 1);
    assert.equal(marcas[0].marca, 'ABB');
  });

  test('skipea filas sin suministro_id', () => {
    const { marcas } = parsearMarcasRows([
      { ID_Suministro: '', Marca: 'X' },
      { ID_Suministro: 'XYZ', Marca: 'X' }  // patrón inválido
    ]);
    assert.equal(marcas.length, 0);
  });
});

describe('prepararPlanImportacion', () => {
  test('genera plan con crear/actualizar/huérfanos correctos', () => {
    const parsed = {
      suministros: [
        { codigo: 'S01', nombre: 'A', unidad: 'Und', stock_inicial: 1, valor_unitario: 100, marcas_disponibles: [], observaciones: '' },
        { codigo: 'S02', nombre: 'B', unidad: 'Und', stock_inicial: 2, valor_unitario: 200, marcas_disponibles: [], observaciones: '' }
      ],
      marcas: [
        { suministro_id: 'S02', suministro_nombre: 'B', marca: 'ABB', observaciones: '' }
      ]
    };
    const existentes = {
      suministrosIds: new Set(['S01', 'S99']),  // S01 existe, S99 huérfano, S02 nuevo
      marcasKeys:     new Set()
    };
    const plan = prepararPlanImportacion(parsed, existentes);

    // Suministros
    assert.deepEqual(plan.suministros.actualizar.map((s) => s.codigo), ['S01']);
    assert.deepEqual(plan.suministros.crear.map((s) => s.codigo), ['S02']);
    assert.deepEqual(plan.suministros.huerfanos, ['S99']);

    // Marcas
    assert.equal(plan.marcas.crear.length, 1);

    // Resumen tiene solo suministros + marcas (canal Excel únicamente)
    assert.equal(plan.resumen.suministros.crear, 1);
    assert.equal(plan.resumen.suministros.actualizar, 1);
    assert.equal(plan.resumen.marcas.crear, 1);
    assert.equal(plan.transformadores, undefined);
    assert.equal(plan.correcciones, undefined);
  });

  test('plan vacío con inputs vacíos', () => {
    const plan = prepararPlanImportacion({}, {});
    assert.equal(plan.suministros.crear.length, 0);
    assert.equal(plan.suministros.actualizar.length, 0);
    assert.equal(plan.marcas.crear.length, 0);
  });
});
