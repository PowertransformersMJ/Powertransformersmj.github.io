// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Las condiciones de deterioro, definidas
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// El alcance nombraba el hallazgo («degradación del aceite
// dieléctrico: …») pero no lo DEFINÍA, ni decía qué riesgo supone
// para el equipo, ni cómo puede afectar al cliente. El Ingeniero
// entregó su propia redacción de cinco condiciones (2026-09-10).
//
// DOS COSAS QUE ESTAS PRUEBAS PROTEGEN:
//  1. El texto es SUYO y va LITERAL. No se parafrasea ni se
//     «mejora»: es la definición que él sostiene ante el
//     regulador.
//  2. En el alcance aparecen SOLO las condiciones que el activo
//     PRESENTA según valores medidos —decisión suya—. Escribir
//     las cinco por defecto sería afirmar hallazgos que el equipo
//     no tiene, en un papel que se firma.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONDICIONES_DETERIORO, CIERRE_CONDICIONES, condicionesPresentes
} from '../assets/js/domain/condiciones_deterioro.js';
import { modoDegradacion, redaccionAlcanceMtto } from '../assets/js/domain/fichas_diagnostico.js';

const EQ = { mva: 33, subestacion: 'MAMONAL', cond_int: 4 };

describe('El catálogo de condiciones', () => {
  test('son las cinco que entregó el Ingeniero', () => {
    assert.deepEqual(Object.keys(CONDICIONES_DETERIORO),
      ['fugas', 'refrigeracion', 'aceite', 'gases', 'papel']);
  });

  test('cada una trae definición, riesgo para el equipo y afectación a clientes', () => {
    for (const [k, c] of Object.entries(CONDICIONES_DETERIORO)) {
      for (const campo of ['condicion', 'definicion', 'riesgoEquipo', 'afectacionClientes']) {
        assert.ok(String(c[campo] || '').trim().length > 20, `${k}.${campo} vacío o demasiado corto`);
      }
    }
  });

  test('el texto es el SUYO, literal — si alguien lo parafrasea, esto cae', () => {
    assert.match(CONDICIONES_DETERIORO.fugas.definicion,
      /Pérdida de aceite dieléctrico por fallas en juntas, sellos, radiadores, válvulas o el tanque/);
    assert.match(CONDICIONES_DETERIORO.gases.riesgoEquipo,
      /pueden anticipar una falla catastrófica, explosión o incendio/);
    assert.match(CONDICIONES_DETERIORO.papel.definicion,
      /suele evidenciarse mediante un bajo grado de polimerización/);
    assert.match(CIERRE_CONDICIONES,
      /^En conjunto, estas condiciones representan señales de deterioro del estado operativo/);
  });

  test('«sistema de refrigeración deficiente» NO tiene detector, y eso está declarado', () => {
    // El registro guarda el TIPO de refrigeración y las cantidades, no su
    // estado. No se cuelga del modo `termico`, que es falla térmica INTERNA.
    assert.deepEqual(CONDICIONES_DETERIORO.refrigeracion.modos, []);
    const conTodo = modoDegradacion(EQ, { c2h4: 900, eadfq: 5, eherm: 5, efur: 5, c2h2: 30 });
    assert.ok(!condicionesPresentes(conTodo).some((c) => c === CONDICIONES_DETERIORO.refrigeracion),
      'no puede aparecer sola: el sistema no la mide');
  });
});

describe('Solo se escribe lo que el activo PRESENTA', () => {
  test('un activo sin modos declarados no produce ninguna condición', () => {
    assert.deepEqual(condicionesPresentes(null), []);
    assert.deepEqual(condicionesPresentes({ todos: [] }), []);
  });

  test('tres gases distintos son UNA condición, no tres', () => {
    const md = { todos: [{ k: 'arco' }, { k: 'termico' }, { k: 'descargas' }] };
    const cs = condicionesPresentes(md);
    assert.equal(cs.length, 1);
    assert.equal(cs[0].condicion, 'Presencia de gases combustibles');
  });

  test('cargabilidad y edad no son condiciones de esta tabla: no se escriben', () => {
    assert.deepEqual(condicionesPresentes({ todos: [{ k: 'carga' }, { k: 'edad' }] }), []);
  });

  test('las cuatro detectables salen, en el orden de severidad del motor', () => {
    const md = modoDegradacion(EQ, { eadfq: 5, erig: 4, eherm: 4, efur: 5, fur: 3200, c2h2: 20 });
    const nombres = condicionesPresentes(md).map((c) => c.condicion);
    assert.deepEqual(nombres, [
      'Papel aislante con alto nivel de degradación',
      'Presencia de gases combustibles',
      'Calidad del aceite desfavorable',
      'Fugas en transformadores de potencia'
    ]);
  });
});

describe('En el alcance del documento', () => {
  const diagMalo = { eadfq: 5, erig: 4, eherm: 4, efur: 5, fur: 3200, c2h2: 20 };
  const diagSano = { eadfq: 1, erig: 1, eic: 1, eherm: 1, efur: 1, fur: 20, c2h2: 0.1 };

  test('el bloque aparece con su cabecera, la definición y las dos consecuencias', () => {
    const t = redaccionAlcanceMtto(EQ, diagMalo, []);
    assert.match(t, /CONDICIONES QUE PRESENTA EL ACTIVO/);
    assert.match(t, /Riesgo para el equipo:/);
    assert.match(t, /Posible afectación a clientes:/);
  });

  test('el cierre del Ingeniero va UNA vez, y solo si hay alguna condición', () => {
    const conMalo = redaccionAlcanceMtto(EQ, diagMalo, []);
    assert.equal((conMalo.match(/En conjunto, estas condiciones/g) || []).length, 1);
    const conSano = redaccionAlcanceMtto(EQ, diagSano, []);
    assert.doesNotMatch(conSano, /CONDICIONES QUE PRESENTA EL ACTIVO/);
    assert.doesNotMatch(conSano, /En conjunto, estas condiciones/);
  });

  test('primero QUÉ le pasa al activo, después QUÉ se le hace', () => {
    const t = redaccionAlcanceMtto(EQ, diagMalo, [{ txt: 'Regeneración de aceite' }]);
    const iCond = t.indexOf('CONDICIONES QUE PRESENTA EL ACTIVO');
    const iAct = t.indexOf('Las actividades contratadas');
    assert.ok(iCond > 0 && iAct > 0, 'deben estar los dos bloques');
    assert.ok(iCond < iAct, 'es el orden en que lo lee quien firma');
  });
});
