// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · registro del equipo (99 §77)
// ──────────────────────────────────────────────────────────────
// Fija lo que decide si dos órdenes son la misma, qué llega a Firestore
// (nunca una cédula) y qué órdenes de un navegador se ofrecen para subir.
// Datos inventados: ningún nombre ni número de una orden real.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarNumero, problemaNumero, claveDe, aDocumento, problemasParaRegistro,
  huella, ordenDesdeRegistro, esDelRegistro, candidatasDeSubida, situacionDeSubida,
  seleccionadaPorDefecto, siguienteNumeroLibre, aMilisegundos, llaveDeMarca, LIMITES, RE_NUMERO
} from '../assets/js/domain/ordenes_registro.js';

const ORDEN = (extra) => Object.assign({
  tipo: 'SALIDA', numero: '01012030-01', zona: 'ZONA-X', fechaISO: '2030-01-01',
  fecha: '1 de enero de 2030', hora: '08:00', origen: 'SEDE A', destino: 'SEDE B',
  items: [{ codigo: 'C1', descripcion: 'MATERIAL UNO', unidad: 'UN', cantidad: 2 }],
  transformador: '', motivo: 'MOTIVO', motivoSel: 'MOTIVO', nota: '',
  autorizado: { nombre: 'PERSONA A', cedula: '' },
  entregado: { nombre: 'PERSONA B', cedula: '' },
  recibido: { nombre: 'PERSONA C', cedula: '' },
  empresaVig: '', conFirmas: true, guardadaEn: '2030-01-01T13:00:00.000Z'
}, extra || {});

describe('número y clave', () => {
  test('normaliza mayúsculas, tildes y espacios sin recortar', () => {
    assert.equal(normalizarNumero('  oe   12 '), 'OE 12');
    assert.equal(normalizarNumero('añó-1'), 'ANO-1');
  });

  test('números distintos NO se funden en la misma clave', () => {
    const claves = ['OE 12', 'OE-12', 'OE/12', 'OE.12', 'OE_12'].map((n) => claveDe('ENTRADA', n));
    assert.equal(new Set(claves).size, 5);
    assert.equal(claveDe('ENTRADA', 'OE/12'), 'ENTRADA_OE~12');
  });

  test('la clave depende del tipo: la misma cifra en entrada y salida son dos órdenes', () => {
    assert.notEqual(claveDe('ENTRADA', '1'), claveDe('SALIDA', '1'));
  });

  test('número inválido → sin clave y con un motivo legible (nunca un rechazo crudo del servidor)', () => {
    for (const n of ['', '-12', ' 12', 'OE~12', 'Nº 12', 'X'.repeat(31)]) {
      assert.equal(claveDe('SALIDA', n), '', n);
      assert.ok(problemaNumero(n), n);
    }
    assert.equal(claveDe('OTRO', '12'), '');
  });

  test('el largo máximo coincide con el del formulario y con la regex de la regla', () => {
    assert.equal(LIMITES.numero, 30);
    assert.ok(RE_NUMERO.test('A'.repeat(30)));
    assert.ok(!RE_NUMERO.test('A'.repeat(31)));
  });
});

describe('lo que se guarda', () => {
  test('nunca lleva cédulas, y avisa que las quitó', () => {
    const { datos, ajustes } = aDocumento(ORDEN({ entregado: { nombre: 'PERSONA B', cedula: '123' } }));
    for (const k of ['autorizado', 'entregado', 'recibido']) assert.deepEqual(Object.keys(datos[k]), ['nombre']);
    assert.ok(ajustes.some((a) => a.includes('cédula')));
    assert.ok(!JSON.stringify(datos).includes('123'));
  });

  test('descarta campos desconocidos (firmas, ids) de la orden y de cada ítem', () => {
    const o = ORDEN({ firma: 'data:image/png;base64,AAAA', guardadaEn: 'x', idInterno: 7 });
    o.items[0].firma = 'AAAA';
    const { datos } = aDocumento(o);
    assert.equal(datos.firma, undefined);
    assert.equal(datos.idInterno, undefined);
    assert.equal(datos.guardadaEn, undefined);
    assert.deepEqual(Object.keys(datos.items[0]).sort(), ['cantidad', 'codigo', 'descripcion', 'unidad']);
  });

  test('recorta textos largos e informa el ajuste', () => {
    const { datos, ajustes } = aDocumento(ORDEN({ nota: 'x'.repeat(600) }));
    assert.equal(datos.nota.length, LIMITES.nota);
    assert.ok(ajustes.some((a) => a.includes('nota')));
  });

  test('guarda el número ya normalizado y la clave derivada de él', () => {
    const { datos } = aDocumento(ORDEN({ numero: ' oe 7 ' }));
    assert.equal(datos.numero, 'OE 7');
    assert.equal(datos.clave, 'SALIDA_OE 7');
  });

  test('problemas: tipo, número, fecha y materiales (1 a 200)', () => {
    assert.deepEqual(problemasParaRegistro(ORDEN()), []);
    assert.equal(problemasParaRegistro(ORDEN({ tipo: '' })).length, 1);
    assert.equal(problemasParaRegistro(ORDEN({ fechaISO: '' })).length, 1);
    assert.equal(problemasParaRegistro(ORDEN({ items: [] })).length, 1);
    const muchos = Array.from({ length: 201 }, () => ({ descripcion: 'M', unidad: 'UN', cantidad: 1 }));
    assert.equal(problemasParaRegistro(ORDEN({ items: muchos })).length, 1);
  });

  test('la huella mira el contenido, no cuándo se guardó ni las cédulas', () => {
    assert.equal(huella(ORDEN()), huella(ORDEN({ guardadaEn: '2031-05-05T00:00:00Z' })));
    assert.equal(huella(ORDEN()), huella(ORDEN({ recibido: { nombre: 'PERSONA C', cedula: '999' } })));
    assert.notEqual(huella(ORDEN()), huella(ORDEN({ nota: 'otra' })));
  });
});

describe('lo que se lee del registro (lo escribió OTRA persona)', () => {
  test('rellena lo que falta como texto: nada de undefined en el PDF', () => {
    const o = ordenDesdeRegistro('SALIDA_1', { tipo: 'SALIDA', numero: '1', items: [{ descripcion: 'M' }] });
    assert.equal(o.nota, '');
    assert.deepEqual(o.entregado, { nombre: '', cedula: '' });
    assert.equal(o.items[0].unidad, '');
    assert.equal(o.items[0].cantidad, 0);
  });

  test('descarta claves inesperadas y tipos raros', () => {
    const o = ordenDesdeRegistro('X', { tipo: '<img>', numero: 5, __proto__x: 1, script: 'alert(1)' });
    assert.equal(o.tipo, '');
    assert.equal(o.numero, '5');
    assert.equal(o.script, undefined);
  });

  test('conserva autoría y versión; timestamps a milisegundos', () => {
    const ts = { toMillis: () => 1900000000000 };
    const o = ordenDesdeRegistro('SALIDA_1', {
      tipo: 'SALIDA', numero: '1', version: 3, creadoPor: { uid: 'u1', nombre: 'A' },
      actualizadoPor: { uid: 'u2', nombre: 'B' }, creadoEn: ts, actualizadoEn: { seconds: 1900000100, nanoseconds: 0 }
    });
    assert.equal(o.version, 3);
    assert.equal(o.creadoPor.uid, 'u1');
    assert.equal(o.creadoEn, 1900000000000);
    assert.equal(o.actualizadoEn, 1900000100000);
    assert.ok(esDelRegistro(o));
    assert.equal(aMilisegundos('2030-01-01T00:00:00Z'), Date.parse('2030-01-01T00:00:00Z'));
  });
});

describe('qué se ofrece para subir', () => {
  test('lo que ya estuvo en el registro NUNCA se ofrece (una borrada no resucita desde una copia)', () => {
    const copia = ORDEN({ creadoPor: { uid: 'u1', nombre: 'A' }, version: 2 });
    assert.deepEqual(candidatasDeSubida([copia], {}), []);
  });

  test('lo marcado con el mismo contenido no vuelve; si el contenido cambió, sí', () => {
    const o = ORDEN();
    const clave = claveDe(o.tipo, o.numero);
    assert.equal(candidatasDeSubida([o], { [clave]: huella(o) }).length, 0);
    assert.equal(candidatasDeSubida([ORDEN({ nota: 'cambió' })], { [clave]: huella(o) }).length, 1);
  });

  test('las inválidas se listan con su motivo (no desaparecen en silencio)', () => {
    const [c] = candidatasDeSubida([ORDEN({ numero: '' })], {});
    assert.ok(c.problema);
    assert.equal(situacionDeSubida(c, { existe: false }), 'invalida');
  });

  test('una inválida también puede descartarse (se marca por su huella)', () => {
    const mala = ORDEN({ numero: '' });
    const [c] = candidatasDeSubida([mala], {});
    assert.equal(candidatasDeSubida([mala], { [llaveDeMarca(c.clave, c.huella)]: c.huella }).length, 0);
  });

  test('dos órdenes con la misma clave: gana la guardada más tarde, la otra queda como repetida', () => {
    const vieja = ORDEN({ nota: 'vieja', guardadaEn: '2030-01-01T00:00:00Z' });
    const nueva = ORDEN({ numero: '01012030-01 ', nota: 'nueva', guardadaEn: '2030-02-01T00:00:00Z' });
    const r = candidatasDeSubida([vieja, nueva], {});
    assert.equal(r.length, 2);
    const ok = r.find((c) => !c.problema);
    assert.equal(ok.orden.nota, 'nueva');
    assert.ok(r.find((c) => c.problema).problema.includes('mismo tipo y número'));
  });

  test('la misma orden repetida idéntica en dos fuentes se ofrece una sola vez', () => {
    assert.equal(candidatasDeSubida([ORDEN(), ORDEN()], {}).length, 1);
  });

  test('situación frente al registro, y solo lo nuevo va marcado por defecto', () => {
    const c = candidatasDeSubida([ORDEN()], {})[0];
    assert.equal(situacionDeSubida(c, { existe: false }), 'nueva');
    assert.equal(situacionDeSubida(c, { existe: true, huella: c.huella }), 'igual');
    assert.equal(situacionDeSubida(c, { existe: true, huella: 'otra' }), 'distinta');
    assert.equal(situacionDeSubida(c, { existe: false, lapida: { borradaPor: {} } }), 'borrada');
    assert.equal(seleccionadaPorDefecto('nueva'), true);
    for (const s of ['igual', 'distinta', 'borrada', 'invalida']) assert.equal(seleccionadaPorDefecto(s), false);
  });
});

describe('siguiente número libre', () => {
  test('el formato modelo propone -01 a todos: se salta a -02, -03…', () => {
    assert.equal(siguienteNumeroLibre('16092030-01', ['16092030-01']), '16092030-02');
    assert.equal(siguienteNumeroLibre('16092030-01', ['16092030-01', '16092030-02']), '16092030-03');
    assert.equal(siguienteNumeroLibre('16092030-01', []), '16092030-01');
  });

  test('conserva el ancho del consecutivo y sirve sin sufijo numérico', () => {
    assert.equal(siguienteNumeroLibre('X-09', ['X-09']), 'X-10');
    assert.equal(siguienteNumeroLibre('ABC', ['ABC']), 'ABC-02');
  });
});
