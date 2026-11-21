// Firma de ODT Afinia · casilla ocupada / vacía: anotaciones que tocan la zona y fracción de
// tinta medida en píxeles. Arreglos RGBA y anotaciones SINTÉTICOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lienzoBlanco, pintar } from './odt_afinia_fixture.js';
import { ZONAS_MEDIDAS } from '../assets/js/domain/odt_afinia_zonas.js';
import {
  casillaOcupada, revisarCasillas, fraccionTinta, rectAPixeles, rectDeArreglo, intersecta, reducir,
  cajaDe, rectTinta, UMBRAL_TINTA, MARGEN_INTERIOR_PT, CASILLAS_DEL_ROL, CAJA_SI, CAJA_FECHA, LUMA_TINTA
} from '../assets/js/domain/odt_afinia_casilla.js';

const zonas = JSON.parse(JSON.stringify(ZONAS_MEDIDAS));
const AZT = zonas.azt;

describe('constantes calibradas (medidas en local con ODT reales; aquí solo los números)', () => {
  test('umbral, luminancia y cajas de SI / FECHA', () => {
    assert.equal(UMBRAL_TINTA, 0.003);
    assert.equal(LUMA_TINTA, 160);
    assert.deepEqual({ ...CAJA_SI }, { izq: 19, abajo: 2.5, ancho: 44, alto: 13.5 });
    assert.deepEqual({ ...CAJA_FECHA }, { izq: 3.5, abajo: 2.5, ancho: 93.5, alto: 13.5 });
  });
  test('las cajas de cierre quedan sobre su raya, sin tocarla ni tocar la etiqueta', () => {
    // Raya de SI: x 205,25–249,75; raya de FECHA: x 312,5–406; ambas a y ≈ 154,25–154,75;
    // borde de la fila de arriba a y ≈ 166,25. «SI» acaba en x 203,9 y «FECHA CIERRE» en 311,2.
    const si = rectTinta(zonas, 'si'); const fe = rectTinta(zonas, 'fecha');
    for (const r of [si, fe]) assert.ok(r.y > 155 && r.y + r.h < 166, JSON.stringify(r));
    assert.ok(si.x > 204 && si.x + si.w < 249.75, JSON.stringify(si));
    assert.ok(fe.x > 311.5 && fe.x + fe.w < 406, JSON.stringify(fe));
  });
});

describe('geometría', () => {
  test('rectDeArreglo, intersecta y reducir', () => {
    assert.deepEqual(rectDeArreglo([10, 50, 0, 20]), { x: 0, y: 20, w: 10, h: 30 });
    assert.equal(intersecta({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 10, w: 5, h: 5 }), true, 'borde con borde');
    assert.equal(intersecta({ x: 0, y: 0, w: 10, h: 10 }, { x: 10.01, y: 0, w: 5, h: 5 }), false);
    assert.deepEqual(reducir({ x: 0, y: 0, w: 10, h: 10 }, 2), { x: 2, y: 2, w: 6, h: 6 });
    assert.deepEqual(reducir({ x: 0, y: 0, w: 3, h: 3 }, 2), { x: 1.5, y: 1.5, w: 0, h: 0 });
    assert.equal(MARGEN_INTERIOR_PT, 2);
    assert.deepEqual(rectTinta(zonas, 'azt'), reducir(AZT, 2));
  });
  test('cajaDe: rectángulo de cada casilla', () => {
    assert.deepEqual(cajaDe(zonas, 'azt'), AZT);
    const si = cajaDe(zonas, 'si');
    assert.ok(si.x < zonas.si.x && si.x + si.w > zonas.si.x && si.y < zonas.si.y);
    assert.throws(() => cajaDe(zonas, 'otra'), /desconocida/);
  });
  test('rectAPixeles invierte el eje vertical y escala', () => {
    assert.deepEqual(rectAPixeles({ x: 10, y: 700, w: 20, h: 50 }, { escala: 2, altoPagina: 792 }), { x: 20, y: 84, w: 40, h: 100 });
    assert.deepEqual(rectAPixeles({ x: -5, y: 0, w: 10, h: 10 }, { escala: 1, altoPagina: 792, anchoPx: 612, altoPx: 792 }), { x: 0, y: 782, w: 5, h: 10 });
    assert.throws(() => rectAPixeles({ x: 0, y: 0, w: 1, h: 1 }, {}), /escala/);
  });
});

describe('anotaciones (Fill&Sign deja Ink, Stamp, FreeText…)', () => {
  for (const subtype of ['Ink', 'Stamp', 'FreeText', 'Square']) {
    test(subtype + ' dentro de la casilla → ocupada', () => {
      const r = casillaOcupada({ rect: AZT, anotaciones: [{ subtype, rect: [AZT.x + 10, AZT.y + 5, AZT.x + 60, AZT.y + 25] }] });
      assert.deepEqual(r, { ocupada: true, motivos: ['anotacion:' + subtype] });
    });
  }
  test('anotación que solo roza el borde → ocupada', () => {
    const r = casillaOcupada({ rect: AZT, anotaciones: [{ subtype: 'Ink', rect: [AZT.x - 30, AZT.y - 30, AZT.x, AZT.y] }] });
    assert.equal(r.ocupada, true);
  });
  test('anotación en otra parte de la página → vacía', () => {
    const r = casillaOcupada({ rect: AZT, anotaciones: [{ subtype: 'Link', rect: [400, 700, 500, 720] }], tinta: 0 });
    assert.deepEqual(r, { ocupada: false, motivos: [] });
  });
});

describe('tinta (imagen, trazo vectorial o X ya marcada, vistos en píxeles)', () => {
  const W = 612; const H = 792; // escala 1
  test('lienzo blanco → 0; firma pintada dentro → por encima del umbral', () => {
    const rgba = lienzoBlanco(W, H);
    const px = rectAPixeles(reducir(AZT, 2), { escala: 1, altoPagina: H });
    assert.equal(fraccionTinta(rgba, W, H, px), 0);
    pintar(rgba, W, { x: px.x + 20, y: px.y + 10, w: 60, h: 3 }); // un trazo
    const f = fraccionTinta(rgba, W, H, px);
    assert.ok(f > UMBRAL_TINTA, String(f));
    assert.equal(casillaOcupada({ rect: AZT, tinta: f }).ocupada, true);
    assert.match(casillaOcupada({ rect: AZT, tinta: f }).motivos[0], /^tinta:/);
  });
  test('tinta FUERA de la casilla no cuenta', () => {
    const rgba = lienzoBlanco(W, H);
    pintar(rgba, W, { x: 10, y: 10, w: 100, h: 100 });
    const px = rectAPixeles(reducir(AZT, 2), { escala: 1, altoPagina: H });
    assert.equal(fraccionTinta(rgba, W, H, px), 0);
  });
  test('píxeles transparentes cuentan como papel', () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4); // todo 0 = negro transparente
    assert.equal(fraccionTinta(rgba, 4, 4, { x: 0, y: 0, w: 4, h: 4 }), 0);
  });
  test('una X en la celda SI → ocupada', () => {
    const rgba = lienzoBlanco(W, H);
    const px = rectAPixeles(rectTinta(zonas, 'si'), { escala: 1, altoPagina: H });
    pintar(rgba, W, { x: px.x + 1, y: px.y + 1, w: 3, h: 3 });
    const f = fraccionTinta(rgba, W, H, px);
    assert.equal(casillaOcupada({ rect: cajaDe(zonas, 'si'), tinta: f }).ocupada, true);
  });
  test('tinta por debajo del umbral (polvo del escaneo) → vacía', () => {
    assert.equal(casillaOcupada({ rect: AZT, tinta: UMBRAL_TINTA / 2 }).ocupada, false);
    assert.equal(casillaOcupada({ rect: AZT, tinta: UMBRAL_TINTA }).ocupada, false, 'el umbral es estricto (>)');
  });
});

describe('revisarCasillas', () => {
  const vacias = { azt: 0, responsable: 0, si: 0, fecha: 0 };
  test('plantilla limpia → ok', () => {
    assert.deepEqual(revisarCasillas(zonas, { tintas: vacias }), { ok: true, ocupadas: [], sinMedir: [] });
  });
  test('al publicar: cualquier casilla con algo → no', () => {
    const r = revisarCasillas(zonas, { tintas: { ...vacias, responsable: 0.2 }, anotaciones: [{ subtype: 'Stamp', rect: [AZT.x + 1, AZT.y + 1, AZT.x + 9, AZT.y + 9] }] });
    assert.equal(r.ok, false);
    assert.deepEqual(r.ocupadas.map((o) => o.clave), ['azt', 'responsable']);
  });
  test('una casilla SIN medir no se da por vacía', () => {
    const r = revisarCasillas(zonas, { tintas: { azt: 0 } }, CASILLAS_DEL_ROL.responsable);
    assert.equal(r.ok, false);
    assert.deepEqual(r.sinMedir, ['responsable', 'si', 'fecha']);
  });
  test('al firmar el AZT solo mira la suya', () => {
    assert.deepEqual([...CASILLAS_DEL_ROL.azt], ['azt']);
    assert.deepEqual([...CASILLAS_DEL_ROL.responsable], ['responsable', 'si', 'fecha']);
    assert.equal(revisarCasillas(zonas, { tintas: { azt: 0, responsable: 0.9 } }, CASILLAS_DEL_ROL.azt).ok, true);
  });
});
