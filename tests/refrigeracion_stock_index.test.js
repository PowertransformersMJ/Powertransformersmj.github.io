// Tests del indexador de stocks por fan_db_key (Microfase 3).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  construirIndiceStocksFan, badgeTexto, debeDeshabilitarse
} from '../assets/js/domain/refrigeracion_stock_index.js';
import { sanitizarSuministro } from '../assets/js/domain/suministro_schema.js';

function suministroFan(codigo, fanKey, stockInicial, contratoId = '4125000143') {
  return sanitizarSuministro({
    codigo, nombre: `Motoventilador`, unidad: 'Und',
    contrato_id: contratoId,
    stock_inicial: stockInicial,
    fan_db_key: fanKey
  });
}

function suministroNoFan(codigo, contratoId = '4125000143') {
  return sanitizarSuministro({
    codigo, nombre: 'Coraza', unidad: 'm',
    contrato_id: contratoId, stock_inicial: 100
  });
}

function mov(suministroId, tipo, cantidad) {
  return { suministro_id: suministroId, tipo, cantidad };
}

describe('construirIndiceStocksFan · casos básicos', () => {
  test('listas vacías devuelven Map vacío', () => {
    const r = construirIndiceStocksFan([], []);
    assert.equal(r.porFanKey.size, 0);
    assert.equal(r.colisiones.length, 0);
    assert.deepEqual(r.resumen, { suministros: 0, conFanKey: 0, conStock: 0, sinStock: 0 });
  });

  test('ignora suministros sin fan_db_key', () => {
    const sums = [suministroNoFan('S01'), suministroNoFan('S02')];
    const r = construirIndiceStocksFan(sums, []);
    assert.equal(r.porFanKey.size, 0);
    assert.equal(r.resumen.suministros, 2);
    assert.equal(r.resumen.conFanKey, 0);
  });

  test('ignora suministros con fan_db_key huérfano (no existe en FAN_DB)', () => {
    const sums = [suministroFan('S99', 'no_existe_99', 5)];
    const r = construirIndiceStocksFan(sums, []);
    assert.equal(r.porFanKey.size, 0);
    assert.equal(r.resumen.conFanKey, 0);
  });
});

describe('construirIndiceStocksFan · cálculo de stock', () => {
  test('sin movimientos · stock_actual = stock_inicial', () => {
    const sums = [suministroFan('S03', 'fn063_60', 36)];
    const r = construirIndiceStocksFan(sums, []);
    const e = r.porFanKey.get('fn063_60');
    assert.ok(e);
    assert.equal(e.stock_inicial, 36);
    assert.equal(e.stock_actual, 36);
    assert.equal(e.ingresado, 0);
    assert.equal(e.egresado, 0);
    assert.equal(e.disponible, true);
    assert.equal(e.codigo_suministro, 'S03');
    assert.equal(e.contrato_id, '4125000143');
    assert.equal(e.nombre_contractual, 'Motoventilador Tipo 1 (FN063)');
  });

  test('con egresos · stock_actual = inicial - egresado', () => {
    const sums = [suministroFan('S03', 'fn063_60', 36)];
    const movs = [
      mov('S03', 'EGRESO', 4),
      mov('S03', 'EGRESO', 6),
      mov('S03', 'INGRESO', 2)
    ];
    const r = construirIndiceStocksFan(sums, movs);
    const e = r.porFanKey.get('fn063_60');
    assert.equal(e.stock_actual, 36 + 2 - 4 - 6); // 28
    assert.equal(e.ingresado, 2);
    assert.equal(e.egresado, 10);
    assert.equal(e.disponible, true);
  });

  test('stock cero → disponible=false, sinStock incrementa', () => {
    const sums = [suministroFan('S05', 'zn063_mono_60', 0)];
    const r = construirIndiceStocksFan(sums, []);
    const e = r.porFanKey.get('zn063_mono_60');
    assert.equal(e.stock_actual, 0);
    assert.equal(e.disponible, false);
    assert.equal(r.resumen.sinStock, 1);
    assert.equal(r.resumen.conStock, 0);
  });

  test('stock negativo (egresos > inicial) → disponible=false', () => {
    const sums = [suministroFan('S05', 'zn063_mono_60', 5)];
    const movs = [mov('S05', 'EGRESO', 10)];
    const r = construirIndiceStocksFan(sums, movs);
    const e = r.porFanKey.get('zn063_mono_60');
    assert.equal(e.stock_actual, -5);
    assert.equal(e.disponible, false);
  });

  test('ignora movimientos de suministros que no pertenecen al índice', () => {
    const sums = [suministroFan('S03', 'fn063_60', 36)];
    const movs = [
      mov('S03', 'EGRESO', 4),
      mov('S99', 'EGRESO', 100),  // suministro no indexado (huérfano)
      mov(null, 'EGRESO', 50)     // movimiento sin suministro_id
    ];
    const r = construirIndiceStocksFan(sums, movs);
    const e = r.porFanKey.get('fn063_60');
    assert.equal(e.stock_actual, 32);
    assert.equal(e.egresado, 4);
  });
});

describe('construirIndiceStocksFan · casos del contrato 4125000143', () => {
  test('los 4 tipos del director con stock real', () => {
    const sums = [
      suministroFan('S03', 'fn063_60',       36),  // Tipo 1
      suministroFan('S04', 'fn050_60',       32),  // Tipo 2
      suministroFan('S05', 'zn063_mono_60',   0),  // Tipo 3
      suministroFan('S06', 'zn045_60',        1),  // Tipo 4
      // Resto del catálogo (Coraza, Radiadores, etc.) — no son motoventiladores
      suministroNoFan('S01'),
      suministroNoFan('S02')
    ];
    const r = construirIndiceStocksFan(sums, []);
    assert.equal(r.porFanKey.size, 4);
    assert.equal(r.resumen.conFanKey, 4);
    assert.equal(r.resumen.conStock, 3);
    assert.equal(r.resumen.sinStock, 1);
    assert.equal(r.porFanKey.get('zn063_mono_60').nombre_contractual, 'Motoventilador Tipo 3 (ZN063)');
  });
});

describe('construirIndiceStocksFan · colisiones', () => {
  test('dos suministros mismo fan_db_key → primero gana, segundo a colisiones', () => {
    const sums = [
      suministroFan('S03', 'fn063_60', 36),
      suministroFan('S99', 'fn063_60', 10)
    ];
    const r = construirIndiceStocksFan(sums, []);
    assert.equal(r.porFanKey.size, 1);
    assert.equal(r.porFanKey.get('fn063_60').codigo_suministro, 'S03');
    assert.deepEqual(r.colisiones, ['fn063_60']);
  });
});

describe('badgeTexto · estados visuales', () => {
  test('null/undefined → "Fuera de contrato"', () => {
    assert.equal(badgeTexto(null), '· ✗ Fuera de contrato');
    assert.equal(badgeTexto(undefined), '· ✗ Fuera de contrato');
  });

  test('stock > 0 → "✓ N disponibles"', () => {
    assert.equal(badgeTexto({ stock_actual: 36, contrato_id: '4125000143' }), '· ✓ 36 disponibles');
    assert.equal(badgeTexto({ stock_actual: 1,  contrato_id: '4125000143' }), '· ✓ 1 disponibles');
  });

  test('stock = 0 → "⛔ Sin stock · contrato CID"', () => {
    assert.equal(
      badgeTexto({ stock_actual: 0, contrato_id: '4125000143' }),
      '· ⛔ Sin stock · contrato 4125000143'
    );
  });

  test('stock negativo → "⛔ Sin stock"', () => {
    assert.equal(
      badgeTexto({ stock_actual: -5, contrato_id: '4125000143' }),
      '· ⛔ Sin stock · contrato 4125000143'
    );
  });
});

describe('debeDeshabilitarse · política de bloqueo', () => {
  test('null → false (fuera de contrato sigue habilitado)', () => {
    assert.equal(debeDeshabilitarse(null), false);
    assert.equal(debeDeshabilitarse(undefined), false);
  });

  test('stock > 0 → false (habilitada)', () => {
    assert.equal(debeDeshabilitarse({ stock_actual: 5 }), false);
  });

  test('stock = 0 → true (deshabilitada)', () => {
    assert.equal(debeDeshabilitarse({ stock_actual: 0 }), true);
  });

  test('stock negativo → true', () => {
    assert.equal(debeDeshabilitarse({ stock_actual: -3 }), true);
  });
});
