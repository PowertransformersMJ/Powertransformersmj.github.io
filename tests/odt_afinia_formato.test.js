// Firma de ODT Afinia · ¿es una ODT del formato? Con PDFs SINTÉTICOS armados en memoria
// (Carta, 2 páginas, etiquetas en sus coordenadas). La estructura (tamaño, caja, rotación,
// cifrado, AcroForm) se lee con pdf-lib de verdad; los ítems de texto los anota el armador
// (en Node no hay pdf.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { armarOdt, PDFLib, NRO } from './odt_afinia_fixture.js';
import {
  validarOdt, estructuraConPdfLib, conTextos, itemsDePdfjs, nrosEnTexto, TITULO, PIE, CARTA
} from '../assets/js/domain/odt_afinia_formato.js';
import { ZONAS_MEDIDAS } from '../assets/js/domain/odt_afinia_zonas.js';

/** Lee la estructura con pdf-lib y le pega los ítems (lo que hará la página con pdf.js). */
async function leer(odt) {
  const est = await estructuraConPdfLib(odt.bytes, PDFLib);
  return conTextos(est, odt.itemsPorPagina);
}
const codigos = (r) => r.errores.map((e) => e.codigo);

describe('constantes del formato', () => {
  test('título, pie y Carta', () => {
    assert.equal(TITULO, 'ORDEN DE TRABAJO (O.D.T.)');
    assert.equal(PIE, 'IT.05800.CO-MA-FO.01');
    assert.deepEqual({ ...CARTA }, { ancho: 612, alto: 792, tolerancia: 1 });
  });
});

describe('acepta la ODT sintética', () => {
  test('2 páginas Carta con título, pie, etiquetas y N.º', async () => {
    const r = validarOdt(await leer(await armarOdt()), { nro: NRO });
    assert.equal(r.ok, true, JSON.stringify(r.errores));
    assert.equal(r.nro, NRO);
    assert.deepEqual(r.zonas, {
      azt: { ...ZONAS_MEDIDAS.azt }, responsable: { ...ZONAS_MEDIDAS.responsable },
      si: { ...ZONAS_MEDIDAS.si }, fecha: { ...ZONAS_MEDIDAS.fecha }
    });
  });
  test('etiquetas partidas en dos ítems (como Excel) y con tildes/espacios raros', async () => {
    const odt = await armarOdt({ etiquetasPartidas: true });
    const r = validarOdt(await leer(odt), { nro: NRO });
    assert.equal(r.ok, true, JSON.stringify(r.errores));
  });
  test('el número de 11 dígitos de la consignación no cuenta como N.º', async () => {
    const r = validarOdt(await leer(await armarOdt()), { nro: NRO });
    assert.deepEqual(r.nrosLeidos, [NRO]);
    assert.deepEqual(nrosEnTexto('A 12345678 B 123456789 C 00000002'), ['12345678', '00000002']);
  });
});

describe('rechaza', () => {
  test('el control previo sintético: lleva el título pero no las etiquetas de casilla', async () => {
    const r = validarOdt(await leer(await armarOdt({ etiquetas: false })), { nro: NRO });
    assert.equal(r.ok, false);
    assert.deepEqual([...new Set(codigos(r))], ['etiquetas']);
    assert.equal(r.errores.length, 4, 'las cuatro etiquetas faltan');
  });
  test('3 páginas', async () => {
    const r = validarOdt(await leer(await armarOdt({ paginas: 3 })), { nro: NRO });
    assert.equal(r.ok, false);
    assert.ok(codigos(r).includes('paginas'));
  });
  test('1 página', async () => {
    const r = validarOdt(await leer(await armarOdt({ paginas: 1 })), { nro: NRO });
    assert.ok(codigos(r).includes('paginas'));
  });
  test('página rotada', async () => {
    const odt = await armarOdt({ rotacion: 90 });
    const est = await leer(odt);
    assert.equal(est.paginas[0].rotacion, 90, 'pdf-lib lee la rotación');
    const r = validarOdt(est, { nro: NRO });
    assert.ok(codigos(r).includes('rotacion'));
  });
  test('otro tamaño (A4)', async () => {
    const r = validarOdt(await leer(await armarOdt({ ancho: 595.28, alto: 841.89 })), { nro: NRO });
    assert.ok(codigos(r).includes('tamano'));
  });
  test('Carta con MediaBox desplazada', async () => {
    const r = validarOdt(await leer(await armarOdt({ caja: [10, 10] })), { nro: NRO });
    assert.ok(codigos(r).includes('caja'));
  });
  test('N.º que no coincide', async () => {
    const r = validarOdt(await leer(await armarOdt()), { nro: '00000002' });
    assert.deepEqual(codigos(r), ['nro_no_coincide']);
    assert.deepEqual(r.nrosLeidos, [NRO]);
  });
  test('N.º confirmado con forma inválida', async () => {
    const r = validarOdt(await leer(await armarOdt()), { nro: '1234' });
    assert.ok(codigos(r).includes('nro_formato'));
  });
  test('sin título', async () => {
    const r = validarOdt(await leer(await armarOdt({ titulo: false })), { nro: NRO });
    assert.deepEqual(codigos(r), ['titulo']);
  });
  test('sin pie (en cada página)', async () => {
    const r = validarOdt(await leer(await armarOdt({ pie: false })), { nro: NRO });
    assert.deepEqual(codigos(r), ['pie', 'pie']);
  });
  test('PDF cifrado (/Encrypt)', async () => {
    const odt = await armarOdt({ cifrado: true });
    const est = await estructuraConPdfLib(odt.bytes, PDFLib);
    assert.equal(est.cifrado, true);
    const r = validarOdt(est, { nro: NRO });
    assert.ok(codigos(r).includes('cifrado'));
  });
  test('PDF con AcroForm', async () => {
    const odt = await armarOdt({ acroForm: true });
    const est = await leer(odt);
    assert.equal(est.acroForm, true);
    assert.ok(codigos(validarOdt(est, { nro: NRO })).includes('acroform'));
  });
  test('etiquetas fuera de tolerancia (fila corrida 5 pt)', async () => {
    const r = validarOdt(await leer(await armarOdt({ corrimiento: { dx: 0, dy: -5 } })), { nro: NRO });
    assert.equal(r.ok, false);
    assert.ok(r.errores.every((e) => e.codigo === 'etiquetas'));
    assert.match(r.errores[0].mensaje, /no se estampa/);
  });
  test('sin páginas', () => {
    const r = validarOdt({ paginas: [] }, { nro: NRO });
    assert.deepEqual(codigos(r), ['paginas']);
  });
});

describe('itemsDePdfjs', () => {
  test('convierte transform/width/height de pdf.js', () => {
    const tc = { items: [
      { str: 'AZT EN SITIO', transform: [7, 0, 0, 7, 270, 181], width: 44.1, height: 7 },
      { str: 'sin alto', transform: [9, 0, 0, 9, 10, 20], width: 30 },
      { type: 'beginMarkedContent' }
    ] };
    assert.deepEqual(itemsDePdfjs(tc), [
      { str: 'AZT EN SITIO', x: 270, y: 181, w: 44.1, h: 7 },
      { str: 'sin alto', x: 10, y: 20, w: 30, h: 9 }
    ]);
    assert.deepEqual(itemsDePdfjs(null), []);
  });
});
