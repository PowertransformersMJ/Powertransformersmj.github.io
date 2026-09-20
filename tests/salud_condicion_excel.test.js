// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — La condición del Excel no la pisa ningún recálculo (99 §80)
// ──────────────────────────────────────────────────────────────
// Decisión del Ingeniero (`99 §74.14`, ratificada 2026-09-20): la condición
// oficial del activo la fija el archivo de Salud de Activos. El motor del
// MO.00418 sigue calculando, pero su número viaja al lado. Antes, el trigger
// de una muestra nueva reemplazaba `salud_actual` entero y la borraba.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fusionarConservandoCondicion, condicionVieneDelExcel
} from '../assets/js/domain/salud_activos.js';
import { sanitizarTransformador } from '../assets/js/domain/transformador_schema.js';

const DEL_EXCEL = {
  hi_final: 4.6, bucket: 'muy_pobre', hi_recalculado: 2.1, bucket_recalculado: 'bueno',
  condicion_fuente: 'excel', overrides_aplicados: ['_importacion_v2'], calif_edad: 3
};
const RECALCULO = {
  hi_final: 2.4, bucket: 'bueno', calif_edad: 4, calif_dga: 2,
  ts_calculo: '2026-09-20T10:00:00.000Z', overrides_aplicados: ['regla_dga']
};

describe('de dónde viene la condición', () => {
  test('la marca explícita manda', () => {
    assert.equal(condicionVieneDelExcel({ condicion_fuente: 'excel' }), true);
    assert.equal(condicionVieneDelExcel({ condicion_fuente: 'motor', overrides_aplicados: ['_importacion_v2'] }), false);
  });

  test('sin marca, vale el rastro que dejó el importador', () => {
    assert.equal(condicionVieneDelExcel({ overrides_aplicados: ['_importacion_v2', 'x'] }), true);
    assert.equal(condicionVieneDelExcel({ overrides_aplicados: ['regla_dga'] }), false);
    assert.equal(condicionVieneDelExcel(null), false);
  });
});

describe('una muestra nueva NO cambia la condición del Excel', () => {
  test('conserva hi_final y bucket, y guarda el recálculo al lado', () => {
    const r = fusionarConservandoCondicion(DEL_EXCEL, RECALCULO);
    assert.equal(r.hi_final, 4.6, 'la condición del Excel sigue mandando');
    assert.equal(r.bucket, 'muy_pobre');
    assert.equal(r.hi_recalculado, 2.4, 'el motor queda al lado, actualizado');
    assert.equal(r.bucket_recalculado, 'bueno');
    assert.equal(r.condicion_fuente, 'excel');
    assert.ok(r.overrides_aplicados.includes('_importacion_v2'), 'no se pierde el rastro');
  });

  test('lo demás del recálculo sí entra (calificaciones, sello de tiempo)', () => {
    const r = fusionarConservandoCondicion(DEL_EXCEL, RECALCULO);
    assert.equal(r.calif_edad, 4);
    assert.equal(r.calif_dga, 2);
    assert.equal(r.ts_calculo, '2026-09-20T10:00:00.000Z');
  });

  test('el equipo que nunca pasó por el Excel sigue con el motor', () => {
    const r = fusionarConservandoCondicion({ hi_final: 3, condicion_fuente: 'motor' }, RECALCULO);
    assert.equal(r.hi_final, 2.4);
    assert.equal(r.condicion_fuente, 'motor');
  });

  test('sin salud previa, o con el Excel sin condición, manda el motor', () => {
    assert.equal(fusionarConservandoCondicion(null, RECALCULO).hi_final, 2.4);
    assert.equal(fusionarConservandoCondicion({ condicion_fuente: 'excel', hi_final: null }, RECALCULO).hi_final, 2.4);
  });

  test('no muta lo que recibe', () => {
    const previo = JSON.parse(JSON.stringify(DEL_EXCEL));
    const nuevo = JSON.parse(JSON.stringify(RECALCULO));
    fusionarConservandoCondicion(previo, nuevo);
    assert.deepEqual(previo, DEL_EXCEL);
    assert.deepEqual(nuevo, RECALCULO);
  });

  test('dos muestras seguidas: la segunda tampoco la pisa', () => {
    const r1 = fusionarConservandoCondicion(DEL_EXCEL, RECALCULO);
    const r2 = fusionarConservandoCondicion(r1, Object.assign({}, RECALCULO, { hi_final: 1.2, bucket: 'excelente' }));
    assert.equal(r2.hi_final, 4.6);
    assert.equal(r2.hi_recalculado, 1.2);
  });
});

describe('la marca sobrevive al esquema', () => {
  test('sanitizarTransformador conserva condicion_fuente y el recálculo', () => {
    const doc = sanitizarTransformador({
      schema_version: 2,
      identificacion: { codigo: 'TX-PRUEBA', nombre: 'Prueba', tipo_activo: 'POTENCIA' },
      ubicacion: { departamento: 'bolivar', zona: '' },
      estado_servicio: 'operativo',
      salud_actual: DEL_EXCEL
    });
    assert.equal(doc.salud_actual.condicion_fuente, 'excel');
    assert.equal(doc.salud_actual.hi_final, 4.6);
    assert.equal(doc.salud_actual.hi_recalculado, 2.1);
  });

  test('una fuente inventada no pasa', () => {
    const doc = sanitizarTransformador({
      schema_version: 2,
      identificacion: { codigo: 'TX-PRUEBA', nombre: 'Prueba', tipo_activo: 'POTENCIA' },
      ubicacion: { departamento: 'bolivar', zona: '' },
      estado_servicio: 'operativo',
      salud_actual: Object.assign({}, DEL_EXCEL, { condicion_fuente: 'a-ojo' })
    });
    assert.equal(doc.salud_actual.condicion_fuente, '');
  });
});
