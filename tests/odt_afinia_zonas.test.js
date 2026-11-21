// Firma de ODT Afinia · zonas derivadas de las ETIQUETAS de la última página, con tolerancia ±3 pt.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { armarOdt } from './odt_afinia_fixture.js';
import {
  zonasDesdeEtiquetas, buscarEtiqueta, normalizarTexto, compacto, lineas, esZonas,
  ZONAS_MEDIDAS, ANCLAS_ESPERADAS, ANCLAS_CALIBRADAS, TOLERANCIA_PT, ETIQUETAS, CLAVES_ZONA
} from '../assets/js/domain/odt_afinia_zonas.js';

const ultima = async (op) => { const o = await armarOdt(op); return o.itemsPorPagina[o.itemsPorPagina.length - 1]; };
const cerca = (a, b) => Math.abs(a - b) < 1e-6;

describe('constantes medidas (DISENO-FINAL §4)', () => {
  test('zonas de respaldo exactas', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(ZONAS_MEDIDAS)), {
      responsable: { x: 81.20, y: 190.50, w: 121.02, h: 34.50 },
      azt: { x: 225.22, y: 190.50, w: 159.45, h: 34.50 },
      si: { x: 224.94, y: 156.2 },
      fecha: { x: 316.0, y: 156.2 }
    });
    assert.equal(TOLERANCIA_PT, 3);
    assert.deepEqual({ ...ETIQUETAS }, { azt: 'AZT EN SITIO', responsable: 'RESPONSABLE O.D.T.', si: 'SI', fecha: 'FECHA CIERRE' });
  });
  test('anclas de etiqueta calibradas (medidas en local con ODT reales; aquí solo los números)', () => {
    assert.equal(ANCLAS_CALIBRADAS, true);
    assert.deepEqual(JSON.parse(JSON.stringify(ANCLAS_ESPERADAS)), {
      responsable: { x: 106.20, y: 168.02 },
      azt: { x: 280.13, y: 168.02 },
      si: { x: 199.22, y: 156.26 },
      fecha: { x: 274.73, y: 156.26 }
    });
    for (const c of CLAVES_ZONA) assert.ok(ANCLAS_ESPERADAS[c], c);
  });
});

describe('texto normalizado', () => {
  test('tildes, mayúsculas y espacios', () => {
    assert.equal(normalizarTexto('  Fecha   cierre '), 'FECHA CIERRE');
    assert.equal(normalizarTexto('Sí'), 'SI');
    assert.equal(compacto('Responsable  O.D.T.'), 'RESPONSABLEO.D.T.');
  });
  test('lineas agrupa por línea base y ordena', () => {
    const l = lineas([{ str: 'b', x: 50, y: 100.5 }, { str: 'a', x: 10, y: 100 }, { str: 'arriba', x: 0, y: 300 }, { str: ' ', x: 0, y: 5 }]);
    assert.deepEqual(l.map((x) => x.items.map((i) => i.str).join('|')), ['arriba', 'a|b']);
  });
});

describe('zonas desde etiquetas', () => {
  test('en su sitio: zonas = las medidas', async () => {
    const r = zonasDesdeEtiquetas(await ultima());
    assert.equal(r.ok, true);
    for (const c of CLAVES_ZONA) assert.deepEqual(r.zonas[c], { ...ZONAS_MEDIDAS[c] }, c);
  });
  test('fila corrida 2,5 pt (dentro de ±3): la zona se mueve lo mismo', async () => {
    const r = zonasDesdeEtiquetas(await ultima({ corrimiento: { dx: 1.5, dy: -2.5 } }));
    assert.equal(r.ok, true, JSON.stringify(r.errores));
    for (const c of CLAVES_ZONA) {
      assert.ok(cerca(r.zonas[c].x, ZONAS_MEDIDAS[c].x + 1.5), c + ' x');
      assert.ok(cerca(r.zonas[c].y, ZONAS_MEDIDAS[c].y - 2.5), c + ' y');
      assert.deepEqual(r.desplazamientos[c], { dx: 1.5, dy: -2.5 });
    }
    assert.equal(r.zonas.azt.w, ZONAS_MEDIDAS.azt.w);
  });
  test('justo en el borde (3 pt) pasa; 3,5 pt no', async () => {
    assert.equal(zonasDesdeEtiquetas(await ultima({ corrimiento: { dx: 3, dy: 0 } })).ok, true);
    const r = zonasDesdeEtiquetas(await ultima({ corrimiento: { dx: 0, dy: 3.5 } }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.errores.map((e) => e.codigo), ['fuera_de_tolerancia', 'fuera_de_tolerancia', 'fuera_de_tolerancia', 'fuera_de_tolerancia']);
  });
  test('una sola etiqueta corrida (texto largo en una fila) se rechaza sola', async () => {
    const r = zonasDesdeEtiquetas(await ultima({ corrimiento: { azt: { dx: 0, dy: -12 } } }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.errores.map((e) => e.clave), ['azt']);
  });
  test('sin etiquetas: falta cada una', async () => {
    const r = zonasDesdeEtiquetas(await ultima({ etiquetas: false }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.errores.map((e) => e.codigo), ['falta_etiqueta', 'falta_etiqueta', 'falta_etiqueta', 'falta_etiqueta']);
  });
  test('«SI» no casa con «SITIO» y se elige la aparición más cercana a lo esperado', async () => {
    const items = await ultima();
    assert.equal(buscarEtiqueta([{ str: 'SITIO', x: 210, y: 156.2, w: 20, h: 7 }], 'SI').length, 0);
    const extra = [...items, { str: 'SI', x: 500, y: 600, w: 8, h: 7 }];
    const r = zonasDesdeEtiquetas(extra);
    assert.equal(r.ok, true);
    assert.deepEqual(r.zonas.si, { ...ZONAS_MEDIDAS.si });
  });
  test('la casilla no puede quedar fuera de la página', async () => {
    const r = zonasDesdeEtiquetas(await ultima(), { pagina: { ancho: 300, alto: 792 } });
    assert.equal(r.ok, false);
    assert.deepEqual(r.errores.map((e) => e.codigo), ['fuera_de_pagina']);
  });
  test('esZonas', async () => {
    assert.equal(esZonas(zonasDesdeEtiquetas(await ultima()).zonas), true);
    assert.equal(esZonas({ azt: { x: 1, y: 1, w: 0, h: 1 } }), false);
    assert.equal(esZonas(null), false);
  });
});

describe('zonas GUARDADAS en la ODT: ±3 pt de las del formato antes de componer', async () => {
  const { errorZonasGuardadas } = await import('../assets/js/domain/odt_afinia_zonas.js');
  const copia = () => JSON.parse(JSON.stringify(ZONAS_MEDIDAS));
  test('las del formato y corridas hasta 3 pt: sí', () => {
    assert.equal(errorZonasGuardadas(copia()), null);
    const z = copia(); z.azt.x += 3; z.si.y -= 3;
    assert.equal(errorZonasGuardadas(z), null);
  });
  test('corrida más de 3 pt, otro tamaño o mal formada: no', () => {
    const z = copia(); z.azt.x += 3.5;
    assert.match(errorZonasGuardadas(z), /AZT EN SITIO[\s\S]*±3 pt/);
    const z2 = copia(); z2.responsable.w += 1;
    assert.match(errorZonasGuardadas(z2), /no está donde la pone el formato/);
    const z3 = copia(); z3.fecha.y += 40;
    assert.ok(errorZonasGuardadas(z3));
    assert.match(errorZonasGuardadas({ azt: 1 }), /no trae bien/);
    assert.match(errorZonasGuardadas(null), /no trae bien/);
  });
});
