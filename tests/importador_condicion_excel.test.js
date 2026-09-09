// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — La condición oficial la fija el Excel
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Hasta el 2026-09-08 el importador RECALCULABA la condición con el
// motor del MO.00418 y descartaba la columna CONDICION del archivo de
// Salud de Activos. Discrepaban en 98 de 208 equipos: el Excel marcaba
// 9 en «muy pobre» y el motor dejaba 1 (`99 §74.14`).
//
// El Ingeniero —especialista en transformadores de potencia— decidió que
// la condición se toma TAL CUAL viene del archivo. Este archivo fija esa
// decisión y, sobre todo, fija que el recálculo NO se pierde: sigue
// entero al lado, para que la decisión sea reversible y comparable.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parsearFilaTransformador } from '../assets/js/domain/importador.js';

const HOY = new Date('2026-09-08T00:00:00Z');

/** ARIGUANI: el caso real. El Excel dice 5; el motor calculaba 4. */
function fila(extra = {}) {
  return {
    codigo: 'T1-M/M-ARN', nombre: 'Ariguaní', subestacion: 'ARIGUANI',
    departamento: 'MAGDALENA', potencia_kva: 2000, tension_primaria_kv: 34.5,
    'año de fabricacion': 1984, furanos: 5000,
    'carga primario  (a)': 40, 'ampacidad primario  (a)': 33,
    ...extra
  };
}
const salud = (extra) => parsearFilaTransformador(fila(extra), 'TX_Potencia', HOY).docV2.salud_actual;

describe('importador — la condición del Excel manda', () => {

  // 🔒 EL INVARIANTE.
  test('`hi_final` es la CONDICION del Excel, no el recálculo', () => {
    const s = salud({ condicion: 5 });
    assert.equal(s.hi_final, 5, 'la condición oficial la fija el archivo');
    assert.equal(s.bucket, 'muy_pobre');
  });

  test('el recálculo NO se pierde: queda al lado y es comparable', () => {
    const s = salud({ condicion: 5 });
    assert.ok(s.hi_recalculado != null, 'sin esto la decisión sería irreversible');
    assert.notEqual(s.hi_recalculado, s.hi_final,
      'en este caso real los dos valores difieren: por eso hay que guardar ambos');
    assert.ok(s.bucket_recalculado, 'también su banda, para poder contrastar');
    assert.ok(s.hi_bruto != null, 'y el bruto, antes de los overrides');
  });

  test('las calificaciones individuales del motor siguen enteras', () => {
    const s = salud({ condicion: 5 });
    // Solo las que esta fila alimenta. `eval_adfq` y las de DGA salen null
    // porque el fixture no trae ensayos de aceite — y eso es correcto: el
    // motor no inventa una calificación sin medición detrás.
    for (const k of ['calif_fur', 'calif_crg', 'calif_edad']) {
      assert.ok(s[k] != null, `${k} no debe perderse: es la traza del cálculo`);
    }
  });

  test('lo que no se midió sigue en null — el motor no rellena huecos', () => {
    const s = salud({ condicion: 5 });   // sin ensayos de aceite en la fila
    assert.equal(s.eval_adfq, null);
    assert.equal(s.eval_dga, null,
      'una calificación inventada es peor que un hueco: alimenta la matriz de riesgo');
  });

  // Contra-prueba: si el archivo no trae condición, no se inventa nada —
  // se usa lo que el motor sabe calcular.
  test('sin CONDICION en el archivo, cae al recálculo', () => {
    const s = salud({});
    assert.ok(s.hi_final != null);
    assert.equal(s.hi_final, s.hi_recalculado);
  });

  test('una condición fuera de escala no se cuela', () => {
    // `califFloat` del esquema acota a [1,5]: una celda con 9 no puede
    // convertirse en una condición imposible.
    const s = salud({ condicion: 9 });
    assert.ok(s.hi_final <= 5, `hi_final fuera de escala: ${s.hi_final}`);
  });

  test('el bucket acompaña a la condición oficial, no al recálculo', () => {
    const s = salud({ condicion: 1 });
    assert.equal(s.hi_final, 1);
    assert.equal(s.bucket, 'muy_bueno',
      'la banda que se muestra tiene que ser la de la condición que manda');
  });
});
