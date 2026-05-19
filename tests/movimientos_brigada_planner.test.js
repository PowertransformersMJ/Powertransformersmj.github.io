// Tests del planner de movimientos Brigada → Suministros (Microfase 5).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  planificarMovimientosEgreso,
  yaGeneroMovimientos,
  parcheoTrazabilidad
} from '../assets/js/domain/movimientos_brigada_planner.js';

function indiceFake(entries) {
  return new Map(entries.map(e => [e.fan_db_key, e]));
}

function accionFake(extra = {}) {
  return {
    transformador_id: 'T1-M/M-CHG',
    matricula:        'T1-M/M-CHG',
    subestacion:      'CHIRIGUANA',
    responsable_uid:  'UID_BRIGADA_123',
    estado_accion:    'ejecutada',
    fecha_accion:     '2026-05-18',
    fecha_ejecucion:  '2026-05-20',
    accion_descripcion: 'Cambio de motoventiladores en transformador T1',
    mix: [],
    ...extra
  };
}

describe('planificarMovimientosEgreso · casos básicos', () => {
  test('mix vacío devuelve listas vacías', () => {
    const r = planificarMovimientosEgreso({
      accion: accionFake(),
      accionId: 'acc_001',
      indiceStocks: indiceFake([])
    });
    assert.equal(r.movimientos.length, 0);
    assert.equal(r.fueraDeContrato.length, 0);
    assert.equal(r.sinStock.length, 0);
  });

  test('input null no lanza error', () => {
    const r = planificarMovimientosEgreso({});
    assert.equal(r.movimientos.length, 0);
  });

  test('accion sin mix array devuelve vacío', () => {
    const r = planificarMovimientosEgreso({
      accion: { mix: 'no-array' },
      accionId: 'acc_001',
      indiceStocks: indiceFake([])
    });
    assert.equal(r.movimientos.length, 0);
  });
});

describe('planificarMovimientosEgreso · casos del contrato 4125', () => {
  test('genera 2 movimientos por mix con FN063 + KRENZ tipificados', () => {
    const accion = accionFake({
      mix: [
        { key: 'fn063_60',      modelo: 'FN063-6DL.4I.A7P1', cantidad: 4, disposicion: 'lateral' },
        { key: 'zn045_60',      modelo: 'ZN045-4DL.2F.V7P2', cantidad: 2, disposicion: 'vertical_1' }
      ]
    });
    const indice = indiceFake([
      { fan_db_key: 'fn063_60', codigo_suministro: 'S03', contrato_id: '4125000143', nombre_contractual: 'Motoventilador Tipo 1 (FN063)', stock_actual: 36 },
      { fan_db_key: 'zn045_60', codigo_suministro: 'S06', contrato_id: '4125000143', nombre_contractual: 'Motoventilador Tipo 4 (ZN045)', stock_actual: 5 }
    ]);
    const r = planificarMovimientosEgreso({
      accion, accionId: 'acc_001', indiceStocks: indice, contratoStock: '4125000143'
    });
    assert.equal(r.movimientos.length, 2);
    assert.equal(r.movimientos[0].suministro_id, 'S03');
    assert.equal(r.movimientos[0].contrato_id,   '4125000143');
    assert.equal(r.movimientos[0].tipo,          'EGRESO');
    assert.equal(r.movimientos[0].cantidad,       4);
    assert.equal(r.movimientos[0].usuario,        'UID_BRIGADA_123');
    assert.equal(r.movimientos[0].anio,           2026);
    assert.equal(r.movimientos[0].matricula,      'T1-M/M-CHG');
    assert.equal(r.movimientos[0].subestacion,    'CHIRIGUANA');
    assert.equal(r.movimientos[0]._meta.fecha,    '2026-05-20');
    assert.equal(r.movimientos[0]._meta.referencia, 'accion_refrig:acc_001:S03');
    assert.ok(r.movimientos[0].observaciones.includes('CHIRIGUANA'));
    assert.ok(r.movimientos[0].observaciones.includes('Motoventilador Tipo 1 (FN063)'));
    assert.equal(r.movimientos[0]._meta.accion_id, 'acc_001');
    assert.equal(r.movimientos[0]._meta.fan_db_key, 'fn063_60');
  });

  test('items fuera del catálogo del contrato van a fueraDeContrato', () => {
    const accion = accionFake({
      mix: [
        { key: 'krenz_f20', modelo: 'F20-A10069', cantidad: 2 }
      ]
    });
    const indice = indiceFake([
      { fan_db_key: 'fn063_60', codigo_suministro: 'S03', contrato_id: '4125000143', stock_actual: 36 }
    ]);
    const r = planificarMovimientosEgreso({
      accion, accionId: 'acc_001', indiceStocks: indice
    });
    assert.equal(r.movimientos.length, 0);
    assert.equal(r.fueraDeContrato.length, 1);
    assert.equal(r.fueraDeContrato[0].key, 'krenz_f20');
    assert.equal(r.fueraDeContrato[0].cantidad, 2);
  });

  test('items con stock insuficiente igual se planifican pero se reportan', () => {
    const accion = accionFake({
      mix: [{ key: 'zn045_60', modelo: 'ZN045', cantidad: 10 }]
    });
    const indice = indiceFake([
      { fan_db_key: 'zn045_60', codigo_suministro: 'S06', contrato_id: '4125000143', stock_actual: 3 }
    ]);
    const r = planificarMovimientosEgreso({ accion, accionId: 'acc_001', indiceStocks: indice });
    assert.equal(r.movimientos.length, 1);
    assert.equal(r.movimientos[0].cantidad, 10);
    assert.equal(r.sinStock.length, 1);
    assert.equal(r.sinStock[0].key, 'zn045_60');
    assert.equal(r.sinStock[0].cantidad, 10);
    assert.equal(r.sinStock[0].stock_actual, 3);
  });

  test('contratoStock mismatch · item va a fueraDeContrato', () => {
    const accion = accionFake({
      mix: [{ key: 'fn063_60', modelo: 'FN063', cantidad: 4 }]
    });
    const indice = indiceFake([
      { fan_db_key: 'fn063_60', codigo_suministro: 'S03', contrato_id: '4123000081', stock_actual: 36 }
    ]);
    const r = planificarMovimientosEgreso({
      accion, accionId: 'acc_001', indiceStocks: indice, contratoStock: '4125000143'
    });
    assert.equal(r.movimientos.length, 0);
    assert.equal(r.fueraDeContrato.length, 1);
  });

  test('cantidad 0 o negativa no genera movimiento', () => {
    const accion = accionFake({
      mix: [
        { key: 'fn063_60', cantidad: 0 },
        { key: 'fn063_60', cantidad: -3 }
      ]
    });
    const indice = indiceFake([
      { fan_db_key: 'fn063_60', codigo_suministro: 'S03', contrato_id: '4125000143', stock_actual: 36 }
    ]);
    const r = planificarMovimientosEgreso({ accion, accionId: 'acc_001', indiceStocks: indice });
    assert.equal(r.movimientos.length, 0);
  });

  test('fecha fallback: ejecucion > accion > today', () => {
    const accion = accionFake({
      mix: [{ key: 'fn063_60', cantidad: 1 }],
      fecha_ejecucion: '',
      fecha_accion: '2026-04-15'
    });
    const indice = indiceFake([
      { fan_db_key: 'fn063_60', codigo_suministro: 'S03', contrato_id: '4125000143', stock_actual: 5 }
    ]);
    const r = planificarMovimientosEgreso({ accion, accionId: 'acc_001', indiceStocks: indice });
    assert.equal(r.movimientos[0]._meta.fecha, '2026-04-15');
    assert.equal(r.movimientos[0].anio, 2026);
  });

  test('observación incluye trazabilidad inversa (accion id + nombre + distribución)', () => {
    const accion = accionFake({
      mix: [{ key: 'fn063_60', modelo: 'FN063', cantidad: 4, disposicion: 'lateral' }]
    });
    const indice = indiceFake([
      { fan_db_key: 'fn063_60', codigo_suministro: 'S03', contrato_id: '4125000143', nombre_contractual: 'Motoventilador Tipo 1 (FN063)', stock_actual: 36 }
    ]);
    const r = planificarMovimientosEgreso({ accion, accionId: 'acc_XYZ', indiceStocks: indice });
    const obs = r.movimientos[0].observaciones;
    assert.ok(obs.includes('acc_XYZ'));
    assert.ok(obs.includes('Motoventilador Tipo 1 (FN063)'));
    // El nuevo formato agregado lista "4u lateral" (sin la palabra "disposición")
    assert.ok(obs.includes('4u lateral'));
  });

  test('AGRUPADO · mismo modelo con disposiciones distintas → UN solo mov con cantidad sumada', () => {
    const accion = accionFake({
      mix: [
        { key: 'fn050_60', modelo: 'FN050', cantidad: 4, disposicion: 'lateral' },
        { key: 'fn050_60', modelo: 'FN050', cantidad: 2, disposicion: 'vertical_1' }
      ]
    });
    const indice = indiceFake([
      { fan_db_key: 'fn050_60', codigo_suministro: 'S04', contrato_id: '4125000143', nombre_contractual: 'Motoventilador Tipo 2 (FN050)', stock_actual: 32, valor_unitario: 5064165 }
    ]);
    const r = planificarMovimientosEgreso({ accion, accionId: 'acc_AGG', indiceStocks: indice, contratoStock: '4125000143' });
    // UN solo movimiento agregado, no 2.
    assert.equal(r.movimientos.length, 1);
    assert.equal(r.movimientos[0].suministro_id, 'S04');
    assert.equal(r.movimientos[0].cantidad, 6);  // 4 + 2
    assert.equal(r.movimientos[0].valor_unitario, 5064165);
    assert.equal(r.movimientos[0].valor_total, 6 * 5064165);
    // La distribución por disposición se preserva en _meta para trazabilidad
    assert.equal(r.movimientos[0]._meta.distribucion.length, 2);
    assert.equal(r.movimientos[0]._meta.distribucion[0].disposicion, 'lateral');
    assert.equal(r.movimientos[0]._meta.distribucion[0].cantidad, 4);
    assert.equal(r.movimientos[0]._meta.distribucion[1].disposicion, 'vertical_1');
    assert.equal(r.movimientos[0]._meta.distribucion[1].cantidad, 2);
    // Observación incluye la distribución detallada
    assert.ok(r.movimientos[0].observaciones.includes('4u lateral'));
    assert.ok(r.movimientos[0].observaciones.includes('2u vertical_1'));
  });
});

describe('yaGeneroMovimientos · idempotencia', () => {
  test('false si la acción no tiene el marcador', () => {
    assert.equal(yaGeneroMovimientos({}), false);
    assert.equal(yaGeneroMovimientos(null), false);
    assert.equal(yaGeneroMovimientos({ estado_accion: 'ejecutada' }), false);
  });

  test('true si la acción tiene movimientos_brigada_generados=true', () => {
    assert.equal(yaGeneroMovimientos({ movimientos_brigada_generados: true }), true);
  });
});

describe('parcheoTrazabilidad · marcador post-generación', () => {
  test('arma el parche con flag + refs + timestamp', () => {
    const p = parcheoTrazabilidad(['MOV-2026-0001', 'MOV-2026-0002']);
    assert.equal(p.movimientos_brigada_generados, true);
    assert.deepEqual(p.movimientos_brigada_refs, ['MOV-2026-0001', 'MOV-2026-0002']);
    assert.ok(p.movimientos_brigada_generados_at.includes('T'));
  });

  test('filtra refs vacías/null', () => {
    const p = parcheoTrazabilidad(['MOV-2026-0001', null, '', undefined, 'MOV-2026-0003']);
    assert.deepEqual(p.movimientos_brigada_refs, ['MOV-2026-0001', 'MOV-2026-0003']);
  });

  test('refs vacío si input no es array', () => {
    const p = parcheoTrazabilidad(null);
    assert.deepEqual(p.movimientos_brigada_refs, []);
  });
});
