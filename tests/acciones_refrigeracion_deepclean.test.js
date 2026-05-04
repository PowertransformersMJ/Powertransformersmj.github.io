// Tests del deep-clean del data layer acciones_refrigeracion.
//
// Firestore rechaza valores undefined / NaN / function con un
// mensaje engañoso "Missing or insufficient permissions" (en
// realidad es un error de tipo). El _deepClean recursivo aplicado
// en crear()/actualizar() previene el problema (regla CLAUDE.md
// §0.1.2.6).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepClean as __deepClean } from '../assets/js/data/_firestore_clean.js';

test('deepClean: undefined top-level → undefined', () => {
  assert.equal(__deepClean(undefined), undefined);
});

test('deepClean: null se preserva', () => {
  assert.equal(__deepClean(null), null);
});

test('deepClean: primitivos se preservan (incluyendo 0, "" y false)', () => {
  assert.equal(__deepClean(0), 0);
  assert.equal(__deepClean(''), '');
  assert.equal(__deepClean(false), false);
  assert.equal(__deepClean('hola'), 'hola');
  assert.equal(__deepClean(123), 123);
});

test('deepClean: NaN → undefined', () => {
  assert.equal(__deepClean(NaN), undefined);
});

test('deepClean: Infinity → undefined', () => {
  assert.equal(__deepClean(Infinity), undefined);
  assert.equal(__deepClean(-Infinity), undefined);
});

test('deepClean: function → undefined', () => {
  assert.equal(__deepClean(() => 1), undefined);
});

test('deepClean: objeto plano elimina claves con undefined', () => {
  const r = __deepClean({ a: 1, b: undefined, c: 'x', d: null });
  assert.deepEqual(r, { a: 1, c: 'x', d: null });
  assert.ok(!('b' in r));
});

test('deepClean: objeto anidado · profundidad 3', () => {
  const r = __deepClean({
    nivel1: {
      nivel2: {
        nivel3: { a: 1, b: undefined, c: NaN },
        x: undefined
      },
      y: 'ok'
    }
  });
  assert.deepEqual(r, {
    nivel1: {
      nivel2: { nivel3: { a: 1 } },
      y: 'ok'
    }
  });
});

test('deepClean: array elimina items undefined', () => {
  const r = __deepClean([1, undefined, 'x', undefined, null]);
  assert.deepEqual(r, [1, 'x', null]);
});

test('deepClean: array de objetos · cada uno limpiado recursivo', () => {
  const r = __deepClean([
    { a: 1, b: undefined },
    { c: NaN, d: 'ok' },
    { e: undefined }    // ← objeto vacío post-clean, pero igual se conserva como {}
  ]);
  assert.deepEqual(r, [{ a: 1 }, { d: 'ok' }, {}]);
});

test('deepClean: caso real · payload acciones_refrigeracion con ficha incompleta', () => {
  const payload = {
    transformador_id: 'T1-M/M-CHG',
    matricula:        'T1-M/M-CHG',
    accion_descripcion: 'Repotenciación del sistema de refrigeración con mix multi-modelo',
    estado_accion:      'planificada',
    fecha_accion:       '2026-05-03',
    tolerancia_pct:     5,
    mix: [
      {
        key: 'fn063_50',
        marca: 'ZIEHL',
        modelo: 'FN063',
        cfm_unitario: 5933,
        cantidad: 4,
        ficha: {
          fan_marca: 'ZIEHL', fan_modelo: 'FN063',
          fan_amp: '1.13 A', fan_kw: 300,
          fan_unknown_field: undefined,    // ← simulando ficha del catálogo con campos opcionales
          fan_cosphi: NaN                   // ← campo derivado mal
        }
      }
    ],
    evaluacion: { aprobado: true, cfm_aporte_total: 23732, cfm_requerido: 24094, deficit: undefined, exceso: NaN },
    proteccion: {
      grupos: [{ key: 'fn063_50', amps_unitario: 1.13, contactor: undefined }],
      breaker: null
    },
    faltantes: [{ campo: 'fan_cosphi', severidad: 'aviso', mensaje: 'falta cos φ', sustituto: 0.85 }],
    resumen_json: { evaluacion: 'APROBADO', razon: undefined },
    validacion_grafica: null,
    createdBy: undefined
  };
  const limpio = __deepClean(payload);
  // Las claves con undefined o NaN deben desaparecer
  assert.ok(!('fan_unknown_field' in limpio.mix[0].ficha));
  assert.ok(!('fan_cosphi' in limpio.mix[0].ficha));
  assert.ok(!('deficit' in limpio.evaluacion));
  assert.ok(!('exceso' in limpio.evaluacion));
  assert.ok(!('contactor' in limpio.proteccion.grupos[0]));
  assert.ok(!('razon' in limpio.resumen_json));
  assert.ok(!('createdBy' in limpio));
  // Las claves con valores legítimos deben preservarse
  assert.equal(limpio.transformador_id, 'T1-M/M-CHG');
  assert.equal(limpio.tolerancia_pct, 5);
  assert.equal(limpio.evaluacion.aprobado, true);
  assert.equal(limpio.validacion_grafica, null);    // null preservado
  assert.equal(limpio.faltantes[0].sustituto, 0.85);
});

test('deepClean: preserva objetos especiales (Timestamp simulado con toDate)', () => {
  const fakeTimestamp = { toDate: () => new Date(), seconds: 1234567 };
  const r = __deepClean(fakeTimestamp);
  assert.equal(r, fakeTimestamp);
});

test('deepClean: preserva FieldValue de Firestore (con _methodName)', () => {
  const fakeFV = { _methodName: 'serverTimestamp' };
  const r = __deepClean(fakeFV);
  assert.equal(r, fakeFV);
});
