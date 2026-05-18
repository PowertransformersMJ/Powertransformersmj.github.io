// Tests del enlace Suministros ↔ FAN_DB · Microfase 1 de la integración
// Contratos · Mantenimiento Brigada · Selección ONAF.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarSuministro, validarSuministro, FAN_DB_KEY_PATTERN
} from '../assets/js/domain/suministro_schema.js';
import {
  resolverFanDesdeSuministro, indexarSuministrosPorFanKey, cobertura
} from '../assets/js/domain/suministros_fan_db_map.js';
import { FAN_DB } from '../assets/js/data/refrigeracion-fan-db.js';
import {
  FAN_CONTRACTUAL, nombreContractualFan, tieneNombreContractual
} from '../assets/js/data/refrigeracion-fan-contractual.js';

describe('FAN_DB_KEY_PATTERN', () => {
  test('acepta claves reales del FAN_DB', () => {
    for (const key of Object.keys(FAN_DB)) {
      assert.match(key, FAN_DB_KEY_PATTERN, `clave ${key} debería matchear`);
    }
  });

  test('rechaza claves con mayúsculas, espacios o caracteres especiales', () => {
    const invalidas = ['FN050_60H', 'fn050 60h', 'fn050-60h', '050_fn', '_fn050', '', ' fn050 '];
    for (const k of invalidas) {
      assert.equal(FAN_DB_KEY_PATTERN.test(k), false, `clave "${k}" no debería matchear`);
    }
  });
});

describe('sanitizarSuministro · fan_db_key', () => {
  test('si fan_db_key está ausente, queda string vacío', () => {
    const d = sanitizarSuministro({ codigo: 'S02', nombre: 'Motoventilador', unidad: 'Und' });
    assert.equal(d.fan_db_key, '');
  });

  test('normaliza fan_db_key a lowercase', () => {
    const d = sanitizarSuministro({
      codigo: 'S02', nombre: 'Motoventilador', unidad: 'Und',
      fan_db_key: 'FN050_60H'
    });
    assert.equal(d.fan_db_key, 'fn050_60h');
  });

  test('preserva fan_db_key válido sin tocar', () => {
    const d = sanitizarSuministro({
      codigo: 'S07', nombre: 'Motoventilador', unidad: 'Und',
      fan_db_key: 'krenz_f20'
    });
    assert.equal(d.fan_db_key, 'krenz_f20');
  });

  test('hace trim de espacios alrededor', () => {
    const d = sanitizarSuministro({
      codigo: 'S02', nombre: 'Motoventilador', unidad: 'Und',
      fan_db_key: '  fn063_60  '
    });
    assert.equal(d.fan_db_key, 'fn063_60');
  });
});

describe('validarSuministro · fan_db_key', () => {
  test('acepta sin fan_db_key (campo opcional)', () => {
    const d = sanitizarSuministro({ codigo: 'S02', nombre: 'Coraza', unidad: 'm' });
    const errs = validarSuministro(d);
    assert.deepEqual(errs, []);
  });

  test('acepta fan_db_key válido', () => {
    const d = sanitizarSuministro({
      codigo: 'S02', nombre: 'Motoventilador', unidad: 'Und',
      fan_db_key: 'fn050_60h'
    });
    const errs = validarSuministro(d);
    assert.deepEqual(errs, []);
  });

  test('rechaza fan_db_key con formato inválido', () => {
    // El sanitizador hace .toLowerCase() así que mayúsculas pasan al normalizarse.
    // Probamos formatos inválidos que sobreviven al sanitize.
    const d = { codigo: 'S02', contrato_id: '', nombre: 'Motoventilador', unidad: 'Und', stock_inicial: 0, valor_unitario: 0, marcas_disponibles: [], observaciones: '', fan_db_key: 'fn050-60h' };
    const errs = validarSuministro(d);
    assert.ok(errs.some(e => e.includes('fan_db_key')), `esperaba error fan_db_key, recibí: ${errs}`);
  });
});

describe('resolverFanDesdeSuministro', () => {
  test('devuelve null si el suministro no tiene fan_db_key', () => {
    const sum = sanitizarSuministro({ codigo: 'S99', nombre: 'Coraza', unidad: 'm', contrato_id: '4123000081' });
    assert.equal(resolverFanDesdeSuministro(sum), null);
  });

  test('devuelve null si el suministro es null/undefined', () => {
    assert.equal(resolverFanDesdeSuministro(null), null);
    assert.equal(resolverFanDesdeSuministro(undefined), null);
    assert.equal(resolverFanDesdeSuministro({}), null);
  });

  test('devuelve null si fan_db_key NO existe en FAN_DB (clave huérfana)', () => {
    const sum = sanitizarSuministro({
      codigo: 'S02', nombre: 'Motoventilador', unidad: 'Und',
      contrato_id: '4123000081', fan_db_key: 'no_existe_99'
    });
    assert.equal(resolverFanDesdeSuministro(sum), null);
  });

  test('devuelve enlace completo si fan_db_key existe en FAN_DB', () => {
    const sum = sanitizarSuministro({
      codigo: 'S02', nombre: 'Motoventilador Tipo 1', unidad: 'Und',
      stock_inicial: 8, valor_unitario: 1500000,
      contrato_id: '4123000081', fan_db_key: 'fn050_60h'
    });
    const enlace = resolverFanDesdeSuministro(sum);
    assert.ok(enlace, 'esperaba enlace no-null');
    assert.equal(enlace.fan_db_key, 'fn050_60h');
    assert.equal(enlace.contrato_id, '4123000081');
    assert.equal(enlace.codigo_suministro, 'S02');
    assert.equal(enlace.stock_inicial, 8);
    assert.equal(enlace.valor_unitario, 1500000);
    assert.ok(enlace.ficha);
    assert.equal(enlace.ficha.fan_marca, 'ZIEHL-ABEGG');
    assert.equal(enlace.ficha.fan_modelo, 'FN050-4DH.4I.A7P1');
  });

  test('nombre_contractual fallback a marca+modelo si no hay tipificación', () => {
    const sum = sanitizarSuministro({
      codigo: 'S07', nombre: 'Motoventilador KRENZ', unidad: 'Und',
      contrato_id: '4125000143', fan_db_key: 'krenz_f20'
    });
    const enlace = resolverFanDesdeSuministro(sum);
    // FAN_CONTRACTUAL está vacío (pendiente tipificación con el director).
    // El helper debe caer al fallback "marca modelo".
    assert.ok(enlace.nombre_contractual.includes('KRENZ'));
    assert.ok(enlace.nombre_contractual.includes('F20'));
  });
});

describe('indexarSuministrosPorFanKey', () => {
  test('lista vacía devuelve Map vacío sin colisiones', () => {
    const r = indexarSuministrosPorFanKey([]);
    assert.equal(r.porFanKey.size, 0);
    assert.deepEqual(r.colisiones, []);
  });

  test('indexa solo los suministros con fan_db_key resoluble', () => {
    const suministros = [
      sanitizarSuministro({ codigo: 'S01', nombre: 'Coraza', unidad: 'm', contrato_id: '4123000081' }),
      sanitizarSuministro({ codigo: 'S02', nombre: 'Motoventilador 1', unidad: 'Und', contrato_id: '4123000081', fan_db_key: 'fn050_60h', stock_inicial: 8 }),
      sanitizarSuministro({ codigo: 'S07', nombre: 'Motoventilador KRENZ', unidad: 'Und', contrato_id: '4123000081', fan_db_key: 'krenz_f20', stock_inicial: 4 })
    ];
    const r = indexarSuministrosPorFanKey(suministros);
    assert.equal(r.porFanKey.size, 2);
    assert.ok(r.porFanKey.has('fn050_60h'));
    assert.ok(r.porFanKey.has('krenz_f20'));
    assert.equal(r.colisiones.length, 0);
  });

  test('detecta colisiones cuando dos suministros apuntan al mismo fan_db_key', () => {
    const suministros = [
      sanitizarSuministro({ codigo: 'S02', nombre: 'Motoventilador A', unidad: 'Und', contrato_id: '4123000081', fan_db_key: 'fn050_60h', stock_inicial: 8 }),
      sanitizarSuministro({ codigo: 'S03', nombre: 'Motoventilador B', unidad: 'Und', contrato_id: '4123000081', fan_db_key: 'fn050_60h', stock_inicial: 4 })
    ];
    const r = indexarSuministrosPorFanKey(suministros);
    assert.equal(r.porFanKey.size, 1);
    // Gana el primero (S02 con stock 8)
    assert.equal(r.porFanKey.get('fn050_60h').codigo_suministro, 'S02');
    assert.equal(r.porFanKey.get('fn050_60h').stock_inicial, 8);
    assert.deepEqual(r.colisiones, ['fn050_60h']);
  });

  test('ignora input no-array sin throw', () => {
    const r = indexarSuministrosPorFanKey(null);
    assert.equal(r.porFanKey.size, 0);
  });
});

describe('cobertura', () => {
  test('reporta 0/13 enlazadas cuando no hay suministros', () => {
    const r = cobertura([]);
    assert.equal(r.total, Object.keys(FAN_DB).length);
    assert.equal(r.enlazadas, 0);
    assert.equal(r.faltantes.length, r.total);
  });

  test('reporta cobertura parcial correcta', () => {
    const suministros = [
      sanitizarSuministro({ codigo: 'S02', nombre: 'Motoventilador', unidad: 'Und', contrato_id: '4123000081', fan_db_key: 'fn050_60h' }),
      sanitizarSuministro({ codigo: 'S07', nombre: 'Motoventilador KRENZ', unidad: 'Und', contrato_id: '4123000081', fan_db_key: 'krenz_f20' })
    ];
    const r = cobertura(suministros);
    assert.equal(r.enlazadas, 2);
    assert.equal(r.faltantes.length, r.total - 2);
    assert.ok(!r.faltantes.includes('fn050_60h'));
    assert.ok(!r.faltantes.includes('krenz_f20'));
  });
});

describe('nombreContractualFan · placeholder vacío hasta tipificación con director', () => {
  test('FAN_CONTRACTUAL arranca vacío en la Microfase 1', () => {
    assert.equal(Object.keys(FAN_CONTRACTUAL).length, 0,
      'FAN_CONTRACTUAL debe arrancar vacío y poblarse en la Microfase 2 con el mapeo del director');
  });

  test('nombreContractualFan devuelve null cuando no está tipificado', () => {
    assert.equal(nombreContractualFan('fn050_60h'), null);
    assert.equal(nombreContractualFan('krenz_f20'), null);
  });

  test('nombreContractualFan devuelve null para entrada vacía/null', () => {
    assert.equal(nombreContractualFan(''), null);
    assert.equal(nombreContractualFan(null), null);
    assert.equal(nombreContractualFan(undefined), null);
  });

  test('tieneNombreContractual es false en Microfase 1', () => {
    assert.equal(tieneNombreContractual('fn050_60h'), false);
    assert.equal(tieneNombreContractual(''), false);
  });
});
