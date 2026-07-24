// TODO-09 — mapper del parque para el dashboard de Salud de Activos.
// Dominio puro (domain/parque_salud.js): doc v2 → fila del contrato del
// dashboard (mismo shape que el DEMO). Regla de oro: SIN fabricar — lo
// ausente viaja como null.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { filaParqueDesdeTx, filasParque } from '../assets/js/domain/parque_salud.js';

const FIXTURE_COMPLETO = {
  id: 'abc123',
  identificacion: { codigo: 'T1-A/M-CPA', matricula: 'MAT-77', tipo_activo: 'TPT' },
  ubicacion: { zona: 'CORDOBA', departamento: 'córdoba', municipio: 'Montería', subestacion_nombre: 'SE CENTRO' },
  placa: { potencia_kva: 40000 },
  criticidad: { usuarios_aguas_abajo: 2500 },
  salud_actual: {
    eval_dga: 3, eval_adfq: 2.5, calif_fur: 1, calif_crg: 4,
    calif_pyt: 2, calif_edad: 5, calif_her: 1, hi_final: 3.2
  }
};

describe('filaParqueDesdeTx — doc v2 completo', () => {
  test('mapea identidad, ubicación, tipo y potencia', () => {
    const f = filaParqueDesdeTx(FIXTURE_COMPLETO);
    assert.equal(f.codigo, 'T1-A/M-CPA');
    assert.equal(f.matricula, 'MAT-77');
    assert.equal(f.tipo_activo, 'TPT_Servicio');       // TPT → TPT_Servicio
    assert.equal(f.zona, 'CORDOBA');
    assert.equal(f.departamento, 'córdoba');           // tal cual: el dashboard normaliza
    assert.equal(f.subestacion, 'SE CENTRO');
    assert.equal(f.mva, 40);                            // 40 000 kVA → 40 MVA
    assert.equal(f.usuarios_aguas_abajo, 2500);
  });

  test('las 7 calificaciones y la condición salen del motor oficial (G010)', () => {
    const f = filaParqueDesdeTx(FIXTURE_COMPLETO);
    assert.equal(f.calif_dga, 3);
    assert.equal(f.calif_adfq, 2.5);
    assert.equal(f.calif_fur, 1);
    assert.equal(f.calif_crg, 4);
    assert.equal(f.calif_pyt, 2);
    assert.equal(f.calif_edad, 5);
    assert.equal(f.calif_her, 1);
    assert.equal(f.condicion, 3.2);                    // hi_final, no re-inventado
  });

  test('mapeo de tipos POTENCIA y RESPALDO + default seguro', () => {
    const mk = (t) => filaParqueDesdeTx({ identificacion: { codigo: 'X', tipo_activo: t } });
    assert.equal(mk('POTENCIA').tipo_activo, 'TX_Potencia');
    assert.equal(mk('RESPALDO').tipo_activo, 'TX_Respaldo');
    assert.equal(mk('OTRO').tipo_activo, 'TX_Potencia');
  });
});

describe('filaParqueDesdeTx — sin salud calculada (parque real hoy)', () => {
  test('doc sin salud_actual → califs y condición null, SIN fabricar', () => {
    const f = filaParqueDesdeTx({ id: 'z1', identificacion: { codigo: 'T-KDR04', tipo_activo: 'POTENCIA' }, ubicacion: { zona: 'BOLIVAR' } });
    ['dga', 'adfq', 'fur', 'crg', 'pyt', 'edad', 'her'].forEach((k) => assert.equal(f['calif_' + k], null));
    assert.equal(f.condicion, null);
    assert.equal(f.mva, null);
    assert.equal(f.usuarios_aguas_abajo, null);
    assert.equal(f.codigo, 'T-KDR04');
  });

  test('fallback de código: identificacion.codigo → codigo raíz → id', () => {
    assert.equal(filaParqueDesdeTx({ codigo: 'RAIZ' }).codigo, 'RAIZ');
    assert.equal(filaParqueDesdeTx({ id: 'doc9' }).codigo, 'doc9');
  });
});

describe('filasParque — listado', () => {
  test('mapea el arreglo y descarta nulos; tolera entrada no-array', () => {
    const filas = filasParque([FIXTURE_COMPLETO, null, { id: 'b' }]);
    assert.equal(filas.length, 2);
    assert.equal(filasParque(null).length, 0);
    assert.equal(filasParque('x').length, 0);
  });
});
