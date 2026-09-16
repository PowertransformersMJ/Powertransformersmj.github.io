// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · el parque del desplegable
// ──────────────────────────────────────────────────────────────
// El módulo suelto trae el parque copiado dentro del archivo; el sitio lo
// lee del parque vivo en Firestore detrás de la sesión (`99 §70`). Estas
// pruebas fijan la conversión, que es lo que decide qué se imprime en el
// primer renglón del bloque «Motivo» de un documento que se firma.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parqueParaOrdenes } from '../assets/js/domain/ordenes_parque.js';

const V2 = (mat, sub, zona, kva) => ({
  identificacion: { matricula: mat }, ubicacion: { subestacion_nombre: sub, zona }, placa: { potencia_kva: kva }
});

describe('parqueParaOrdenes', () => {
  test('lee el esquema v2 del parque', () => {
    assert.deepEqual(parqueParaOrdenes([V2('T1-X/X-AAA', 'SUB-ALFA', 'ZONA-1', 1000)]),
      [{ matricula: 'T1-X/X-AAA', subestacion: 'SUB-ALFA', zona: 'ZONA-1', potencia: 1000 }]);
  });

  test('y también el aplanado v1', () => {
    const r = parqueParaOrdenes([{ matricula: 'T1', subestacion: 'X', zona: 'zona-dos', potencia_kva: 500 }]);
    assert.deepEqual(r, [{ matricula: 'T1', subestacion: 'X', zona: 'ZONA-DOS', potencia: 500 }]);
  });

  test('la misma matrícula en DOS subestaciones son dos filas; repetida en la misma, una', () => {
    const r = parqueParaOrdenes([
      V2('T1-X/X-BBB', 'SUB-BETA', 'ZONA-2', 2000),
      V2('T1-X/X-BBB', 'SUB-BETA DOS', 'ZONA-3', 3000),
      V2('T1-X/X-BBB', 'SUB-BETA', 'ZONA-2', 2000)
    ]);
    assert.equal(r.length, 2);
  });

  test('sin matrícula o sin subestación no hay nada que imprimir: fuera', () => {
    assert.deepEqual(parqueParaOrdenes([V2('', 'X', 'ZONA-1', 1), V2('T9', '', 'ZONA-1', 1)]), []);
  });

  test('la zona sale en MAYÚSCULA, como la escribe el formato (datos inventados: ninguna prueba copia el parque real)', () => {
    assert.equal(parqueParaOrdenes([V2('T1', 'A', 'zona-uno', 1)])[0].zona, 'ZONA-UNO');
  });

  test('una potencia ausente, cero o no numérica NO se imprime como «0 kVA»', () => {
    for (const kva of [undefined, null, 0, 'abc', -5]) {
      assert.equal(parqueParaOrdenes([V2('T1', 'A', 'B', kva)])[0].potencia, null, String(kva));
    }
  });

  test('ordena por zona, subestación y matrícula', () => {
    const r = parqueParaOrdenes([
      V2('T2', 'SUB-ZETA', 'ZONA-1', 1), V2('T1', 'SUB-ALFA', 'ZONA-2', 1), V2('T1', 'SUB-ZETA', 'ZONA-1', 1)
    ]).map((t) => t.zona + '/' + t.subestacion + '/' + t.matricula);
    assert.deepEqual(r, ['ZONA-1/SUB-ZETA/T1', 'ZONA-1/SUB-ZETA/T2', 'ZONA-2/SUB-ALFA/T1']);
  });

  test('entradas basura no rompen: devuelve vacío', () => {
    assert.deepEqual(parqueParaOrdenes(null), []);
    assert.deepEqual(parqueParaOrdenes([null, undefined, {}]), []);
  });
});
