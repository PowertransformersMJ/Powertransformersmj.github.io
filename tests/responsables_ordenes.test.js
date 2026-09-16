// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · cédulas de los responsables (99 §78)
// ──────────────────────────────────────────────────────────────
// Todos los nombres y números son INVENTADOS (el repositorio es público).
// Fija: el id que calculan navegador y reglas, que la orden guardada nunca
// lleva cédula y que al imprimir solo manda el directorio.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  idDeResponsable, normalizarCedula, problemaCedula, formatoImpresion, enmascarar,
  nombresDeOrden, aplicarCedulas, faltantes, sinCedulas, traeCedulas,
  paresDeArchivo, cedulasRepetidas, pareceDatoPersonal, esHojaDeOrdenExportada, RE_NOMBRE, RE_CEDULA
} from '../assets/js/domain/responsables_ordenes.js';

const ORDEN = () => ({
  tipo: 'SALIDA', numero: '1',
  autorizado: { nombre: 'PERSONA UNO', cedula: '' },
  entregado: { nombre: 'PERSONA DOS', cedula: '' },
  recibido: { nombre: 'PEÑA TRES CUATRO CINCO', cedula: '' }
});

describe('id del documento', () => {
  test('reemplaza TODOS los espacios y conserva la Ñ (igual que la regla)', () => {
    assert.equal(idDeResponsable('PEÑA TRES CUATRO CINCO'), 'PEÑA_TRES_CUATRO_CINCO');
    assert.equal(idDeResponsable('PERSONA DOS'), 'PERSONA_DOS');
  });

  test('nombre fuera de forma → sin id', () => {
    for (const n of ['', 'persona dos', 'PERSONA  DOS', ' PERSONA', 'PERSONA DOS ', 'JOSÉ PEREZ', 'A-B', 'X'.repeat(81)]) {
      assert.equal(idDeResponsable(n), '', JSON.stringify(n));
    }
  });

  test('las expresiones que repite la regla', () => {
    assert.ok(RE_NOMBRE.test('PEÑA TRES'));
    assert.ok(RE_CEDULA.test('12345') && RE_CEDULA.test('123456789012'));
    assert.ok(!RE_CEDULA.test('1234') && !RE_CEDULA.test('1234567890123') && !RE_CEDULA.test('12.345'));
  });
});

describe('cédula', () => {
  test('normaliza puntos y espacios', () => {
    assert.equal(normalizarCedula('11.222.333'), '11222333');
    assert.equal(normalizarCedula(' 44 555 666 '), '44555666');
  });

  test('explica por qué no sirve', () => {
    assert.equal(problemaCedula('11222333'), '');
    assert.ok(problemaCedula(''));
    assert.ok(problemaCedula('1234'));
    assert.ok(problemaCedula('1234567890123'));
    assert.ok(problemaCedula('12a45'));
  });

  test('impresión en un solo lugar y pista que nunca muestra el número entero', () => {
    assert.equal(formatoImpresion('11.222.333'), '11222333');
    assert.equal(enmascarar('11222333'), '•••333');
    assert.ok(!enmascarar('11222333').includes('11222'));
    assert.equal(enmascarar(''), '');
  });
});

describe('al imprimir manda el directorio', () => {
  test('aplica las cédulas por nombre en una COPIA', () => {
    const o = ORDEN();
    const mapa = new Map([['PERSONA UNO', '10000001'], ['PEÑA TRES CUATRO CINCO', '30000003']]);
    const c = aplicarCedulas(o, mapa);
    assert.equal(c.autorizado.cedula, '10000001');
    assert.equal(c.entregado.cedula, '');
    assert.equal(c.recibido.cedula, '30000003');
    assert.equal(o.autorizado.cedula, '', 'la orden original no se toca');
  });

  test('ignora la cédula que traiga la orden (una copia vieja no manda)', () => {
    const o = ORDEN();
    o.entregado.cedula = '99999999';
    assert.equal(aplicarCedulas(o, new Map()).entregado.cedula, '');
    assert.equal(aplicarCedulas(o, new Map([['PERSONA DOS', '20000002']])).entregado.cedula, '20000002');
  });

  test('dice a quién le falta', () => {
    assert.deepEqual(faltantes(ORDEN(), new Map([['PERSONA UNO', '10000001']])), ['PERSONA DOS', 'PEÑA TRES CUATRO CINCO']);
  });

  test('una orden sin personas elegidas no rompe', () => {
    const o = { tipo: 'SALIDA', autorizado: { nombre: 'PERSONA UNO' }, entregado: { nombre: '' } };
    assert.deepEqual(nombresDeOrden(o), ['PERSONA UNO']);
    const c = aplicarCedulas(o, new Map());
    assert.equal(c.recibido.cedula, '');
  });
});

describe('lo que se guarda nunca lleva cédula', () => {
  test('sinCedulas vacía las tres y no toca el resto', () => {
    const o = ORDEN();
    o.autorizado.cedula = '10000001'; o.recibido.cedula = '30000003';
    assert.ok(traeCedulas(o));
    const s = sinCedulas(o);
    assert.ok(!traeCedulas(s));
    assert.ok(!JSON.stringify(s).includes('10000001'));
    assert.equal(s.recibido.nombre, 'PEÑA TRES CUATRO CINCO');
    assert.equal(o.autorizado.cedula, '10000001', 'no muta la original');
  });

  test('una copia hecha con aplicarCedulas y luego limpiada no deja rastro', () => {
    const conCed = aplicarCedulas(ORDEN(), new Map([['PERSONA DOS', '20000002']]));
    assert.ok(!JSON.stringify(sinCedulas(conCed)).includes('20000002'));
  });
});

describe('importar desde el archivo del administrador', () => {
  const CONOCIDOS = ['PERSONA UNO', 'PERSONA DOS', 'PEÑA TRES CUATRO CINCO'];

  test('lee el módulo suelto (nombre/cédula en el mismo objeto) y marca quién está en la lista', () => {
    const html = `entregadoPor: [
      { nombre: 'PERSONA UNO', cedula: '10.000.001' },
      { nombre: 'PERSONA DOS',   cedula: '20000002' },
      { nombre: 'OTRA PERSONA', cedula: '40000004' },
      { nombre: 'SIN CEDULA', cedula: '' }
    ]`;
    const r = paresDeArchivo(html, CONOCIDOS);
    assert.deepEqual(r.map((p) => [p.nombre, p.cedula, p.enLista, p.problema]), [
      ['PERSONA UNO', '10000001', true, ''],
      ['PERSONA DOS', '20000002', true, ''],
      ['OTRA PERSONA', '40000004', false, '']
    ]);
  });

  test('lee JSON y CSV', () => {
    assert.equal(paresDeArchivo('[{"nombre":"PERSONA UNO","cedula":"10000001"}]', CONOCIDOS)[0].cedula, '10000001');
    const csv = paresDeArchivo('NOMBRE;CEDULA\nPERSONA DOS;20.000.002\n', CONOCIDOS);
    assert.deepEqual(csv.map((p) => [p.nombre, p.cedula]), [['PERSONA DOS', '20000002']]);
  });

  test('marca cédulas repetidas y largos imposibles', () => {
    const r = paresDeArchivo(`{ nombre: 'PERSONA UNO', cedula: '10000001' }, { nombre: 'PERSONA DOS', cedula: '10000001' }, { nombre: 'PEÑA TRES CUATRO CINCO', cedula: '123' }`, CONOCIDOS);
    assert.ok(r.find((p) => p.nombre === 'PERSONA UNO').problema.includes('otra persona'));
    assert.ok(r.find((p) => p.nombre === 'PEÑA TRES CUATRO CINCO').problema);
    assert.deepEqual([...cedulasRepetidas(r)], ['10000001']);
  });

  test('archivo sin pares → lista vacía', () => {
    assert.deepEqual(paresDeArchivo('<html>nada</html>', CONOCIDOS), []);
  });
});

describe('importar listas desde el Excel de una orden no mete cédulas', () => {
  test('reconoce los rótulos del bloque de firmas y la cédula con número', () => {
    for (const t of ['CÉDULA:  10000001', 'CEDULA: 10000001', 'NOMBRE:  PERSONA UNO', 'AUTORIZADO POR:', 'RECIBIDO POR:', 'c.c. 10000001']) {
      assert.ok(pareceDatoPersonal(t), t);
    }
  });

  test('no confunde materiales reales', () => {
    for (const t of ['CABLE 4/0 AWG', 'RADIADOR 1200 MM', 'VENTILADOR 380 V 50 HZ', 'CODIGO 12345678 BUJE', 'ACEITE DIELECTRICO']) {
      assert.ok(!pareceDatoPersonal(t), t);
    }
  });

  test('las hojas del formato exportado se saltan; las demás no', () => {
    assert.ok(esHojaDeOrdenExportada('Orden') && esHojaDeOrdenExportada('Orden 2'));
    assert.ok(!esHojaDeOrdenExportada('Materiales') && !esHojaDeOrdenExportada('Ordenes viejas'));
  });
});
