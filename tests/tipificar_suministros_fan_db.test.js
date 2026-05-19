// Tests del script de tipificación de suministros con FAN_DB
// (Microfase 2 de la integración Contratos · Brigada).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAPEO_4125000143,
  MAPEO_4123000081,
  aplicarTipificacion,
  necesitaTipificar,
  ejecutarTipificacion
} from '../scripts/migrate/tipificar-suministros-fan-db.js';
import { sanitizarSuministro } from '../assets/js/domain/suministro_schema.js';
import { FAN_DB } from '../assets/js/data/refrigeracion-fan-db.js';

describe('MAPEO_4125000143 · tipificación congelada', () => {
  test('tiene exactamente 4 entradas (Tipo 1, 2, 3, 4)', () => {
    assert.equal(MAPEO_4125000143.length, 4);
  });

  test('cada entrada apunta a una clave válida del FAN_DB', () => {
    for (const m of MAPEO_4125000143) {
      assert.ok(FAN_DB[m.fan_db_key], `fan_db_key "${m.fan_db_key}" debe existir en FAN_DB`);
    }
  });

  test('todas las entradas tienen ZIEHL ABEGG y ENERGINN como marcas', () => {
    for (const m of MAPEO_4125000143) {
      assert.ok(m.marcas.includes('ZIEHL ABEGG'));
      assert.ok(m.marcas.includes('ENERGINN'));
    }
  });

  test('S06 (Tipo 4 ZN045) trae corrección de unidad a Und', () => {
    const s06 = MAPEO_4125000143.find(m => m.codigo === 'S06');
    assert.ok(s06, 'esperaba entrada S06');
    assert.equal(s06.unidad, 'Und');
    assert.equal(s06.fan_db_key, 'zn045_60');
  });

  test('los códigos están en orden S03, S04, S05, S06', () => {
    const codigos = MAPEO_4125000143.map(m => m.codigo);
    assert.deepEqual(codigos, ['S03', 'S04', 'S05', 'S06']);
  });
});

describe('MAPEO_4123000081 · pendiente confirmación del director', () => {
  test('queda vacío hasta que el director confirme modelo del Tipo 1', () => {
    assert.equal(MAPEO_4123000081.length, 0,
      '4123 solo tiene Tipo 1 pero el director quiere escoger FN-063 o FN-050 en runtime');
  });
});

describe('aplicarTipificacion · función pura', () => {
  test('agrega fan_db_key cuando no existe', () => {
    const s = sanitizarSuministro({
      codigo: 'S03', nombre: 'Motoventiladores Tipo 1', unidad: 'Und',
      contrato_id: '4125000143', stock_inicial: 36
    });
    const next = aplicarTipificacion(s, MAPEO_4125000143[0]);
    assert.equal(next.fan_db_key, 'fn063_60');
  });

  test('agrega marcas sin duplicar las existentes', () => {
    const s = sanitizarSuministro({
      codigo: 'S03', nombre: 'Motoventiladores Tipo 1', unidad: 'Und',
      contrato_id: '4125000143', marcas_disponibles: ['ZIEHL ABEGG']
    });
    const next = aplicarTipificacion(s, MAPEO_4125000143[0]);
    assert.deepEqual(next.marcas_disponibles.sort(), ['ENERGINN', 'ZIEHL ABEGG']);
  });

  test('S06 corrige unidad de "mts" a "Und"', () => {
    const s = sanitizarSuministro({
      codigo: 'S06', nombre: 'Motoventiladores Tipo 4', unidad: 'mts',
      contrato_id: '4125000143', marcas_disponibles: ['ENERGINN']
    });
    // unidad="mts" no está en UNIDADES, sanitizar la cae a 'Und' por defecto.
    // Pero si entrara como string raw, la corrección del mapeo aplica.
    const conMts = { ...s, unidad: 'mts' };
    const next = aplicarTipificacion(conMts, MAPEO_4125000143[3]);
    assert.equal(next.unidad, 'Und');
    assert.equal(next.fan_db_key, 'zn045_60');
    assert.ok(next.marcas_disponibles.includes('ENERGINN'));
    assert.ok(next.marcas_disponibles.includes('ZIEHL ABEGG'));
  });

  test('lanza error si fan_db_key del mapeo no existe en FAN_DB', () => {
    const s = sanitizarSuministro({
      codigo: 'S99', nombre: 'X', unidad: 'Und', contrato_id: '4125000143'
    });
    const malMapeo = { codigo: 'S99', fan_db_key: 'no_existe_99' };
    assert.throws(() => aplicarTipificacion(s, malMapeo), /no existe en FAN_DB/);
  });

  test('preserva campos no tocados por el mapeo', () => {
    const s = sanitizarSuministro({
      codigo: 'S03', nombre: 'Motoventiladores Tipo 1', unidad: 'Und',
      contrato_id: '4125000143', stock_inicial: 36, valor_unitario: 5935453,
      observaciones: 'nota de prueba'
    });
    const next = aplicarTipificacion(s, MAPEO_4125000143[0]);
    assert.equal(next.stock_inicial, 36);
    assert.equal(next.valor_unitario, 5935453);
    assert.equal(next.observaciones, 'nota de prueba');
    assert.equal(next.nombre, 'Motoventiladores Tipo 1');
  });

  test('input null retorna sin cambios', () => {
    assert.equal(aplicarTipificacion(null, MAPEO_4125000143[0]), null);
    assert.deepEqual(aplicarTipificacion({}, null), {});
  });
});

describe('necesitaTipificar · detector de cambios pendientes', () => {
  test('false cuando todo está al día (fan_db_key + marcas + valor_unitario)', () => {
    const s = sanitizarSuministro({
      codigo: 'S03', nombre: 'Tipo 1', unidad: 'Und',
      contrato_id: '4125000143',
      fan_db_key: 'fn063_60',
      marcas_disponibles: ['ZIEHL ABEGG', 'ENERGINN'],
      valor_unitario: 5935453  // del PDF 044 de aceptación de oferta
    });
    assert.equal(necesitaTipificar(s, MAPEO_4125000143[0]), false);
  });

  test('true si falta valor_unitario del mapeo', () => {
    const s = sanitizarSuministro({
      codigo: 'S03', nombre: 'Tipo 1', unidad: 'Und',
      contrato_id: '4125000143',
      fan_db_key: 'fn063_60',
      marcas_disponibles: ['ZIEHL ABEGG', 'ENERGINN']
      // valor_unitario: 0 (default del sanitizador) → diff del mapeo (5935453)
    });
    assert.equal(necesitaTipificar(s, MAPEO_4125000143[0]), true);
  });

  test('true si falta fan_db_key', () => {
    const s = sanitizarSuministro({
      codigo: 'S03', nombre: 'Tipo 1', unidad: 'Und',
      contrato_id: '4125000143',
      marcas_disponibles: ['ZIEHL ABEGG', 'ENERGINN']
    });
    assert.equal(necesitaTipificar(s, MAPEO_4125000143[0]), true);
  });

  test('true si falta una marca del mapeo', () => {
    const s = sanitizarSuministro({
      codigo: 'S03', nombre: 'Tipo 1', unidad: 'Und',
      contrato_id: '4125000143',
      fan_db_key: 'fn063_60',
      marcas_disponibles: ['ZIEHL ABEGG']
    });
    assert.equal(necesitaTipificar(s, MAPEO_4125000143[0]), true);
  });

  test('true si la unidad no coincide (caso S06)', () => {
    const s = {
      codigo: 'S06', contrato_id: '4125000143', unidad: 'mts',
      fan_db_key: 'zn045_60',
      marcas_disponibles: ['ZIEHL ABEGG', 'ENERGINN']
    };
    assert.equal(necesitaTipificar(s, MAPEO_4125000143[3]), true);
  });
});

describe('ejecutarTipificacion · runner defensivo', () => {
  test('procesa los 4 suministros del 4125 cuando todos existen', async () => {
    const store = new Map([
      ['4125000143/S03', sanitizarSuministro({ codigo: 'S03', nombre: 'Tipo 1', unidad: 'Und', contrato_id: '4125000143', stock_inicial: 36 })],
      ['4125000143/S04', sanitizarSuministro({ codigo: 'S04', nombre: 'Tipo 2', unidad: 'Und', contrato_id: '4125000143', stock_inicial: 32 })],
      ['4125000143/S05', sanitizarSuministro({ codigo: 'S05', nombre: 'Tipo 3', unidad: 'Und', contrato_id: '4125000143', stock_inicial: 0 })],
      ['4125000143/S06', sanitizarSuministro({ codigo: 'S06', nombre: 'Tipo 4', unidad: 'Und', contrato_id: '4125000143', stock_inicial: 1 })]
    ]);
    const writes = [];
    const r = await ejecutarTipificacion({
      mapeo: MAPEO_4125000143,
      contratoId: '4125000143',
      read: async (cid, codigo) => store.get(`${cid}/${codigo}`) || null,
      write: async (cid, codigo, next) => writes.push({ cid, codigo, next }),
      log: () => {},
      dryRun: false
    });
    assert.equal(r.escaneados, 4);
    assert.equal(r.tipificados, 4);
    assert.equal(r.faltantes.length, 0);
    assert.equal(r.errores.length, 0);
    assert.equal(writes.length, 4);
    // Verificar que el último write (S06) tiene fan_db_key correcto
    const s06 = writes.find(w => w.codigo === 'S06');
    assert.equal(s06.next.fan_db_key, 'zn045_60');
  });

  test('dryRun=true no escribe', async () => {
    const store = new Map([
      ['4125000143/S03', sanitizarSuministro({ codigo: 'S03', nombre: 'Tipo 1', unidad: 'Und', contrato_id: '4125000143' })]
    ]);
    const r = await ejecutarTipificacion({
      mapeo: [MAPEO_4125000143[0]],
      contratoId: '4125000143',
      read: async (cid, codigo) => store.get(`${cid}/${codigo}`) || null,
      log: () => {},
      dryRun: true
    });
    assert.equal(r.tipificados, 1);
    assert.equal(r.lista.length, 1);
    assert.equal(r.lista[0].despues.fan_db_key, 'fn063_60');
  });

  test('reporta suministros faltantes sin throw', async () => {
    const r = await ejecutarTipificacion({
      mapeo: MAPEO_4125000143,
      contratoId: '4125000143',
      read: async () => null,
      log: () => {},
      dryRun: true
    });
    assert.equal(r.tipificados, 0);
    assert.deepEqual(r.faltantes.sort(), ['S03', 'S04', 'S05', 'S06']);
  });

  test('idempotente: re-ejecutar no genera escrituras adicionales', async () => {
    const tipificado = sanitizarSuministro({
      codigo: 'S03', nombre: 'Tipo 1', unidad: 'Und',
      contrato_id: '4125000143', fan_db_key: 'fn063_60',
      marcas_disponibles: ['ZIEHL ABEGG', 'ENERGINN'],
      valor_unitario: 5935453  // tipificado completo con valor del mapeo
    });
    const writes = [];
    const r = await ejecutarTipificacion({
      mapeo: [MAPEO_4125000143[0]],
      contratoId: '4125000143',
      read: async () => tipificado,
      write: async (...args) => writes.push(args),
      log: () => {},
      dryRun: false
    });
    assert.equal(r.sinCambio, 1);
    assert.equal(r.tipificados, 0);
    assert.equal(writes.length, 0);
  });

  test('exige opts.write cuando dryRun=false', async () => {
    await assert.rejects(
      ejecutarTipificacion({
        mapeo: MAPEO_4125000143,
        contratoId: '4125000143',
        read: async () => null,
        log: () => {},
        dryRun: false
      }),
      /write es obligatorio/
    );
  });

  test('exige contratoId', async () => {
    await assert.rejects(
      ejecutarTipificacion({
        mapeo: MAPEO_4125000143,
        contratoId: '',
        read: async () => null,
        log: () => {},
        dryRun: true
      }),
      /contratoId es obligatorio/
    );
  });

  test('respeta el límite si se especifica', async () => {
    const store = new Map([
      ['4125000143/S03', sanitizarSuministro({ codigo: 'S03', nombre: 'X', unidad: 'Und', contrato_id: '4125000143' })],
      ['4125000143/S04', sanitizarSuministro({ codigo: 'S04', nombre: 'X', unidad: 'Und', contrato_id: '4125000143' })],
      ['4125000143/S05', sanitizarSuministro({ codigo: 'S05', nombre: 'X', unidad: 'Und', contrato_id: '4125000143' })],
      ['4125000143/S06', sanitizarSuministro({ codigo: 'S06', nombre: 'X', unidad: 'Und', contrato_id: '4125000143' })]
    ]);
    const r = await ejecutarTipificacion({
      mapeo: MAPEO_4125000143,
      contratoId: '4125000143',
      read: async (cid, codigo) => store.get(`${cid}/${codigo}`) || null,
      log: () => {},
      dryRun: true,
      limite: 2
    });
    assert.equal(r.escaneados, 2);
    assert.equal(r.tipificados, 2);
  });
});
