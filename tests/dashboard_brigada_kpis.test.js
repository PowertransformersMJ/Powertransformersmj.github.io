// Tests del computador de KPIs Brigada para el dashboard (Microfase 6).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  computarKpisBrigada,
  esEgresoDeBrigada
} from '../assets/js/domain/dashboard_brigada_kpis.js';

function accion(id, estado, mixCantidades, extra = {}) {
  return {
    id,
    estado_accion: estado,
    matricula:     'T1-M/M-CHG',
    subestacion:   'CHIRIGUANA',
    fecha_accion:  '2026-05-18',
    fecha_ejecucion: estado === 'ejecutada' ? '2026-05-20' : '',
    mix: mixCantidades.map((c, i) => ({
      key: ['fn063_60','fn050_60','zn045_60'][i] || 'fn063_60',
      modelo: ['FN063-6DL.4I.A7P1','FN050-4DH.4I.A7P1','ZN045-4DL.2F.V7P2'][i] || 'FN063',
      cantidad: c
    })),
    movimientos_brigada_generados: estado === 'ejecutada',
    movimientos_brigada_refs:      estado === 'ejecutada' ? ['MOV-2026-' + id] : [],
    ...extra
  };
}

function mov(suministro_id, cantidad, observaciones, valor_total = 0) {
  return {
    suministro_id, cantidad, tipo: 'EGRESO',
    observaciones, valor_total,
    suministro_nombre: 'Motoventilador Tipo X (test)'
  };
}

describe('esEgresoDeBrigada · detector', () => {
  test('true cuando observaciones empieza con "Acción"', () => {
    assert.equal(esEgresoDeBrigada({ tipo: 'EGRESO', observaciones: 'Acción acc_001 · …' }), true);
  });
  test('true cuando observaciones contiene accion_refrig:', () => {
    assert.equal(esEgresoDeBrigada({ tipo: 'EGRESO', observaciones: 'Egreso por accion_refrig:abc' }), true);
  });
  test('false si tipo no es EGRESO', () => {
    assert.equal(esEgresoDeBrigada({ tipo: 'INGRESO', observaciones: 'Acción' }), false);
  });
  test('false si observaciones no menciona acción', () => {
    assert.equal(esEgresoDeBrigada({ tipo: 'EGRESO', observaciones: 'Egreso manual' }), false);
  });
  test('false para input null', () => {
    assert.equal(esEgresoDeBrigada(null), false);
    assert.equal(esEgresoDeBrigada({}), false);
  });
});

describe('computarKpisBrigada · totales', () => {
  test('input vacío devuelve todos los contadores en cero', () => {
    const r = computarKpisBrigada({});
    assert.equal(r.totales.accionesEjecutadas, 0);
    assert.equal(r.totales.accionesPlanificadas, 0);
    assert.equal(r.totales.movimientosGenerados, 0);
    assert.equal(r.totales.unidadesConsumidas, 0);
    assert.deepEqual(r.topModelos, []);
    assert.deepEqual(r.accionesRecientes, []);
    assert.deepEqual(r.pendientesPorEjecutar, []);
  });

  test('cuenta acciones por estado_accion', () => {
    const acciones = [
      accion('a1', 'ejecutada',   [4]),
      accion('a2', 'planificada', [3]),
      accion('a3', 'aprobada',    [2]),
      accion('a4', 'pendiente_aprobacion', [1]),
      accion('a5', 'cancelada',   [5]),
      accion('a6', 'ejecutada',   [2, 1])
    ];
    const r = computarKpisBrigada({ acciones });
    assert.equal(r.totales.accionesEjecutadas, 2);
    assert.equal(r.totales.accionesPlanificadas, 3);
  });

  test('suma unidades consumidas solo de egresos de brigada', () => {
    const movs = [
      mov('S03', 4, 'Acción acc_001 · transformador …', 23000000),
      mov('S03', 6, 'Acción acc_002 · transformador …', 34000000),
      mov('S04', 2, 'Egreso manual desde admin · sin trace', 10000000),  // NO es de brigada
      mov('S05', 3, 'Acción acc_003 · ZN063', 17000000)
    ];
    const r = computarKpisBrigada({ movimientos: movs });
    assert.equal(r.totales.movimientosGenerados, 3);
    assert.equal(r.totales.unidadesConsumidas, 13);
  });
});

describe('computarKpisBrigada · topModelos', () => {
  test('ordena descendente por unidades y respeta topN', () => {
    const movs = [
      mov('S03', 8, 'Acción acc_001 · FN063', 40000000),
      mov('S03', 4, 'Acción acc_002 · FN063', 20000000),
      mov('S04', 6, 'Acción acc_003 · FN050', 30000000),
      mov('S05', 2, 'Acción acc_004 · ZN063', 10000000),
      mov('S06', 1, 'Acción acc_005 · ZN045', 5000000)
    ];
    const r = computarKpisBrigada({ movimientos: movs, topN: 3 });
    assert.equal(r.topModelos.length, 3);
    assert.equal(r.topModelos[0].suministro_id, 'S03');
    assert.equal(r.topModelos[0].unidades, 12);
    assert.equal(r.topModelos[0].costo, 60000000);
    assert.equal(r.topModelos[1].suministro_id, 'S04');
    assert.equal(r.topModelos[1].unidades, 6);
    assert.equal(r.topModelos[2].suministro_id, 'S05');
  });
});

describe('computarKpisBrigada · accionesRecientes', () => {
  test('solo incluye las que tienen movimientos_brigada_generados=true', () => {
    const acciones = [
      accion('a1', 'ejecutada', [2]),
      accion('a2', 'planificada', [3]),  // NO incluida
      accion('a3', 'ejecutada', [4])
    ];
    const r = computarKpisBrigada({ acciones });
    assert.equal(r.accionesRecientes.length, 2);
    assert.ok(r.accionesRecientes.every(a => a.id === 'a1' || a.id === 'a3'));
  });

  test('orden descendente por fecha_ejecucion y tope 5', () => {
    const acciones = [];
    for (let i = 1; i <= 7; i++) {
      const a = accion(`a${i}`, 'ejecutada', [i]);
      a.fecha_ejecucion = `2026-05-${10 + i}`;
      acciones.push(a);
    }
    const r = computarKpisBrigada({ acciones });
    assert.equal(r.accionesRecientes.length, 5);
    assert.equal(r.accionesRecientes[0].id, 'a7');  // fecha más reciente primero
    assert.equal(r.accionesRecientes[4].id, 'a3');
  });

  test('mixResumen formatea como "FN063×4 · FN050×2"', () => {
    const acciones = [accion('a1', 'ejecutada', [4, 2])];
    const r = computarKpisBrigada({ acciones });
    assert.equal(r.accionesRecientes[0].mixResumen, 'FN063×4 · FN050×2');
    assert.equal(r.accionesRecientes[0].totalU, 6);
  });
});

describe('computarKpisBrigada · pendientesPorEjecutar', () => {
  test('lista acciones no-ejecutadas con mix > 0', () => {
    const acciones = [
      accion('a1', 'planificada', [3]),
      accion('a2', 'ejecutada',   [2]),  // NO pendiente
      accion('a3', 'aprobada',    [4]),
      accion('a4', 'pendiente_aprobacion', [0]), // sin mix · NO listada
      accion('a5', 'cancelada',   [5])   // canceladas excluidas
    ];
    const r = computarKpisBrigada({ acciones });
    assert.equal(r.pendientesPorEjecutar.length, 2);
    assert.ok(r.pendientesPorEjecutar.some(p => p.id === 'a1'));
    assert.ok(r.pendientesPorEjecutar.some(p => p.id === 'a3'));
  });

  test('cada pendiente trae matricula, subestacion, fecha, unidadesMix', () => {
    const acciones = [accion('a1', 'planificada', [3, 2])];
    const r = computarKpisBrigada({ acciones });
    const p = r.pendientesPorEjecutar[0];
    assert.equal(p.matricula, 'T1-M/M-CHG');
    assert.equal(p.subestacion, 'CHIRIGUANA');
    assert.equal(p.unidadesMix, 5);
    assert.equal(p.fecha, '2026-05-18');
  });
});
