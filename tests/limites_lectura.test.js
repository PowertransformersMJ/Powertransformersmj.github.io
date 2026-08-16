// Contrato de los topes de lectura de Firestore (dominio puro).
// Lo que se protege aquí es la FACTURA: ninguna consulta debe salir
// sin `limite`, y un límite explícito del llamador no puede ser
// pisado por el valor por defecto.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITE_TRANSFORMADORES, LIMITE_ORDENES, LIMITE_EXPORT,
  conLimite, estaTruncado, diagnosticoLectura
} from '../assets/js/domain/limites_lectura.js';

describe('topes por defecto', () => {
  test('son números positivos y finitos', () => {
    for (const v of [LIMITE_TRANSFORMADORES, LIMITE_ORDENES, LIMITE_EXPORT]) {
      assert.equal(typeof v, 'number');
      assert.ok(Number.isFinite(v) && v > 0, `tope inválido: ${v}`);
    }
  });

  test('el tope de órdenes es mayor que el del parque (crecen sin techo)', () => {
    assert.ok(LIMITE_ORDENES > LIMITE_TRANSFORMADORES);
  });

  test('el tope de export es el más alto (descarga puntual)', () => {
    assert.ok(LIMITE_EXPORT >= LIMITE_ORDENES);
  });
});

describe('conLimite', () => {
  test('sin filtros: aplica el valor por defecto', () => {
    assert.equal(conLimite(undefined, 500).limite, 500);
    assert.equal(conLimite({}, 500).limite, 500);
  });

  test('filtros sin `limite`: aplica el valor por defecto y conserva el resto', () => {
    const f = conLimite({ estado: 'operativo' }, 500);
    assert.equal(f.limite, 500);
    assert.equal(f.estado, 'operativo');
  });

  test('el límite explícito del llamador MANDA, hacia arriba y hacia abajo', () => {
    assert.equal(conLimite({ limite: 25 }, 500).limite, 25);
    assert.equal(conLimite({ limite: 5000 }, 500).limite, 5000);
  });

  test('valores inválidos caen al valor por defecto (nunca sin tope)', () => {
    for (const malo of [0, -1, NaN, null, undefined, 'muchos', {}, []]) {
      assert.equal(conLimite({ limite: malo }, 500).limite, 500, `entrada: ${String(malo)}`);
    }
  });

  test('un límite decimal se trunca a entero', () => {
    assert.equal(conLimite({ limite: 10.9 }, 500).limite, 10);
  });

  test('no muta el objeto de filtros recibido', () => {
    const original = { estado: 'operativo' };
    const salida = conLimite(original, 500);
    assert.equal(original.limite, undefined);
    assert.notEqual(salida, original);
  });
});

describe('estaTruncado', () => {
  test('leídos por debajo del tope: no hay truncamiento', () => {
    assert.equal(estaTruncado(0, 500), false);
    assert.equal(estaTruncado(499, 500), false);
  });

  test('leídos igual al tope: se asume truncado (puede haber más)', () => {
    assert.equal(estaTruncado(500, 500), true);
  });

  test('límite inválido: no se afirma truncamiento', () => {
    assert.equal(estaTruncado(10, 0), false);
    assert.equal(estaTruncado(10, NaN), false);
  });
});

describe('diagnosticoLectura', () => {
  test('describe la lectura completa', () => {
    assert.deepEqual(
      diagnosticoLectura('transformadores', 120, 500),
      { coleccion: 'transformadores', leidos: 120, limite: 500, truncado: false }
    );
  });

  test('marca el truncamiento cuando la consulta se pega al tope', () => {
    const d = diagnosticoLectura('ordenes', 1000, 1000);
    assert.equal(d.truncado, true);
    assert.equal(d.coleccion, 'ordenes');
  });
});
