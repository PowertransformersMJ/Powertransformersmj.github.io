// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · reglas de los ítems
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Pedido del Ingeniero (2026-10-06): corregir la cantidad de un ítem
// ya agregado y un material «Otro» escrito a mano. Lo que se escribe
// a mano termina en un documento con firmas y en el registro que lee
// todo el equipo: estas pruebas fijan qué se acepta y qué no.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MATERIAL_OTRO, leerCantidad, sumarCantidades, problemasOtro, unidadesSugeridas, pareceDocumento, caracterNoImprimible, CANTIDAD_MAX
} from '../assets/js/domain/ordenes_items.js';
import { LIMITES } from '../assets/js/domain/ordenes_registro.js';

describe('leerCantidad — la misma regla al agregar y al corregir en la tabla', () => {
  test('acepta enteros y decimales con coma o punto', () => {
    assert.equal(leerCantidad('3'), 3);
    assert.equal(leerCantidad('2,5'), 2.5);
    assert.equal(leerCantidad('2.5'), 2.5);
    assert.equal(leerCantidad(' 7 '), 7);
    assert.equal(leerCantidad(4), 4);
  });
  for (const malo of ['', '   ', '0', '-1', 'abc', null, undefined, 'NaN', 'Infinity', '1e3', '0x10']) {
    test(`rechaza ${JSON.stringify(malo)}`, () => assert.equal(leerCantidad(malo), null));
  }
  test('hasta 3 decimales: lo que el papel imprime es lo que se escribió', () => {
    assert.equal(leerCantidad('2,125'), 2.125);
    assert.equal(leerCantidad('0,0004'), null);   // saldría «0» en el PDF
    assert.equal(leerCantidad('1,9999'), null);   // saldría «2»
  });
  test('tope de 9 enteros (caben en la columna CANTIDAD)', () => {
    assert.equal(leerCantidad(String(CANTIDAD_MAX)), CANTIDAD_MAX);
    assert.equal(leerCantidad('1234567890'), null);
  });
  test('acumular no arrastra el error de la coma flotante', () => {
    assert.equal(sumarCantidades(0.1, 0.2), 0.3);
    assert.equal(sumarCantidades(0.7, 0.1), 0.8);
    assert.equal(sumarCantidades(3, 2), 5);
  });
});

describe('problemasOtro — un material escrito a mano', () => {
  test('completo: sin problemas', () => {
    assert.deepEqual(problemasOtro({ descripcion: 'Empaque de nitrilo 6 mm', unidad: 'Mts' }), []);
  });
  test('sin descripción ni unidad: dice las dos cosas', () => {
    const P = problemasOtro({ descripcion: '  ', unidad: '' });
    assert.deepEqual(P.map(p => p.campo), ['descripcion', 'unidad']);
    assert.match(P[0].mensaje, /ese texto es el que se imprime/);
  });
  for (const ced of ['C.C. 1234567', 'CC: 72345678', 'cc 1098765432', 'Cédula 12345678', 'CEDULA: 7.234.567',
    'CC 72.345.678', 'C.C. No. 72345678', 'C.C. N° 72345678', 'CC No 72345678', 'cédula de ciudadanía 72345678',
    'cedula no. 72345678', 'CC-72345678', 'C .C. 1234567', 'CE 1234567', 'TI 1098765432']) {
    test(`no deja entrar una cédula: «${ced}»`, () => {
      const P = problemasOtro({ descripcion: 'Entregado a ' + ced, unidad: 'UND' });
      assert.equal(P.length, 1);
      assert.match(P[0].mensaje, /dato personal/);
    });
  }
  for (const bueno of ['Buje 13,8 KV', 'Motoventilador FN-063', 'Cable 4 AWG CC motor', 'Relé EB 050 A (4 HUECOS)',
    'Transformador CT 600/5 A', 'Pintura epóxica RAL 7035', 'Tubo 1½" “3M” – 1/2', 'Norma IEC 60076-1']) {
    test(`un material con números no se confunde con una cédula: «${bueno}»`, () => {
      assert.deepEqual(problemasOtro({ descripcion: bueno, unidad: 'UND' }), []);
    });
  }
  test('la unidad tampoco deja entrar un número de documento', () => {
    for (const u of ['72345678', 'cc7234567', 'CC 72.345.678']) {
      assert.equal(problemasOtro({ descripcion: 'Tornillo', unidad: u })[0].campo, 'unidad', u);
    }
    assert.deepEqual(problemasOtro({ descripcion: 'Tornillo', unidad: 'M2' }), []);
  });
  for (const [txt, ch] of [['Resistencia 10 Ω', 'Ω'], ['Aceite ≥ 5 L', '≥'], ['Condensador 10 μF', 'μ'], ['Tubo ⌀ 2', '⌀'], ['dos\u200bpalabras', '\u200b']]) {
    test(`un signo que el PDF no imprime se pide con letras: ${JSON.stringify(ch)}`, () => {
      assert.equal(caracterNoImprimible(txt), ch);
      const P = problemasOtro({ descripcion: txt, unidad: 'UND' });
      assert.equal(P[0].campo, 'descripcion');
      assert.match(P[0].mensaje, /el PDF no puede imprimir/);
    });
  }
  test('lo de Windows-1252 sí se imprime (½, comillas tipográficas, raya, µ de micro)', () => {
    assert.equal(caracterNoImprimible('1½ “3M” – 10 µF ñ Á'), '');
  });
  test('pareceDocumento es la misma regla para descripción y unidad', () => {
    assert.equal(pareceDocumento('CC 72.345.678'), true);
    assert.equal(pareceDocumento('Cable 4 AWG CC motor'), false);
  });
  test('respeta los límites del registro (los mismos de firestore.rules)', () => {
    assert.equal(problemasOtro({ descripcion: 'x'.repeat(LIMITES.descripcion + 1), unidad: 'UND' })[0].campo, 'descripcion');
    assert.equal(problemasOtro({ descripcion: 'Tornillo', unidad: 'u'.repeat(LIMITES.unidad + 1) })[0].campo, 'unidad');
  });
});

describe('unidadesSugeridas', () => {
  test('sin repetidas y en el orden del catálogo', () => {
    assert.deepEqual(unidadesSugeridas([{ unidad: 'UND' }, { unidad: 'Mts' }, { unidad: 'und' }, { unidad: '' }, {}, { unidad: 'Kg' }]),
      ['UND', 'Mts', 'Kg']);
  });
  test('sin catálogo, lista vacía', () => assert.deepEqual(unidadesSugeridas(null), []));
});

describe('la pantalla trae lo que el módulo necesita', () => {
  const html = readFileSync(new URL('../pages/ordenes-materiales.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../assets/js/ordenes-materiales.js', import.meta.url), 'utf8');
  for (const id of ['w-descOtro', 'descOtro', 'e-descOtro', 'w-unidad', 'e-unidad', 'unidadesSugeridas']) {
    test(`existe #${id}`, () => assert.match(html, new RegExp(`id="${id}"`)));
  }
  test('la casilla de «Otro» empieza oculta', () => assert.match(html, /id="w-descOtro" hidden/));
  test('la etiqueta «Otro» no viaja al documento: se imprime lo escrito', () => {
    assert.equal(MATERIAL_OTRO.texto, 'Otro');
    assert.match(js, /const desc = otro \? \(\$\('#descOtro'\) \? \$\('#descOtro'\)\.value : ''\)/);
  });
  test('un atajo de teclado confirma la cantidad a medio corregir antes de guardar o exportar', () => {
    assert.match(js, /\['s', 'e', 'p', 'q', 'i'\]\.includes\(k\) && a && a\.classList && a\.classList\.contains\('cant-item'\)\) a\.blur\(\)/);
  });
  test('la rueda del ratón no mueve la cantidad', () => {
    assert.match(js, /addEventListener\('wheel', ev => \{\s*const inp = ev\.target\.closest\('\.cant-item'\);\s*if \(inp && inp === document\.activeElement\) inp\.blur\(\);/);
  });
  test('con el HTML viejo en caché (L-85) las casillas nuevas se buscan con guarda', () => {
    assert.doesNotMatch(js, /\$\('#descOtro'\)\.addEventListener/);
    assert.doesNotMatch(js, /\$\('#w-descOtro'\)\.hidden/);
  });
  test('la cantidad de la tabla es una casilla corregible', () => {
    assert.match(js, /class="cant-item"/);
    assert.match(js, /addEventListener\('change', ev => \{\s*const inp = ev\.target\.closest\('\.cant-item'\)/);
  });
});
