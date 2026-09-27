// La casilla BENEFICIOS (B23:L26) crece con su texto (`99 §105`, decisión del
// Ingeniero: «Agrandar la casilla»). Si el texto cabe, la hoja sale idéntica.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import { ajustarAltoCasilla, altoFila, lineasTexto, ALTO_MAXIMO_FILA } from '../assets/js/ui/fichas/alto-casilla.js';
import { exportarFichaPlanificacion } from '../assets/js/ui/fichas/exportar-planificacion.js';
import { redaccionBeneficiosAcciones, ACCIONES_BENEFICIO } from '../assets/js/domain/beneficios_acciones_mtto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
before(() => { globalThis.__sgmJSZip = JSZip; });
const EQ = { subestacion: 'SUBESTACION DE PRUEBA', serie: 'S-0001', matricula: 'T0-PRUEBA', departamento: 'DEP', mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3 };
async function hoja1(beneficios, crecerBeneficios = true) {
  const b = await exportarFichaPlanificacion(EQ, { plan: { proyecto: 'P', alcance: 'A.', beneficios }, crecerBeneficios }, { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array' });
  return (await JSZip.loadAsync(b)).file('xl/worksheets/sheet1.xml').async('string');
}
const alturas = (x) => [23, 24, 25, 26].map((r) => altoFila(x, r));

describe('Alto de la casilla (puro)', () => {
  const XML = '<worksheet><sheetFormatPr defaultRowHeight="13"/><sheetData><row r="23" spans="1:40"></row><row r="24" ht="24.5" customHeight="1"></row><row r="25" ht="24.5" customHeight="1"></row><row r="26" ht="34" customHeight="1"></row></sheetData></worksheet>';
  test('cuenta líneas por párrafo', () => {
    assert.equal(lineasTexto('a\n\nb', 100), 3);
    assert.equal(lineasTexto('x'.repeat(250), 100), 3);
  });
  test('si el texto cabe, el XML sale idéntico', () => {
    assert.equal(ajustarAltoCasilla(XML, { filas: [23, 24, 25, 26], texto: 'Texto corto.' }), XML);
  });
  test('si no cabe, crece la primera fila, con alto propio', () => {
    const x = ajustarAltoCasilla(XML, { filas: [23, 24, 25, 26], texto: 'x'.repeat(200 * 20) });
    assert.match(x, /<row r="23" spans="1:40" ht="[\d.]+" customHeight="1">/);
    assert.ok(altoFila(x, 23) > 13);
    assert.deepEqual([24, 25, 26].map((r) => altoFila(x, r)), [24.5, 24.5, 34]);
  });
  test('nunca pasa el tope de Excel por fila: reparte en las siguientes', () => {
    const x = ajustarAltoCasilla(XML, { filas: [23, 24, 25, 26], texto: 'x'.repeat(200 * 70) });
    assert.equal(altoFila(x, 23), ALTO_MAXIMO_FILA);
    assert.ok(altoFila(x, 24) > 24.5 && altoFila(x, 24) <= ALTO_MAXIMO_FILA);
  });
});

describe('En el Excel exportado', () => {
  test('Mantenimiento con texto corto: las filas de la casilla no cambian', async () => {
    const x = await hoja1('Beneficios breves del proyecto.');
    assert.deepEqual(alturas(x), [13, 24.5, 24.5, 34]);
  });
  test('el PI (sin la marca de Mantenimiento) conserva la casilla aunque su texto sea largo', async () => {
    const x = await hoja1('Beneficio técnico del proyecto. '.repeat(120), false);
    assert.deepEqual(alturas(x), [13, 24.5, 24.5, 34]);
  });
  test('beneficios largos de las acciones: la casilla crece lo suficiente para todas sus líneas', async () => {
    const todas = ACCIONES_BENEFICIO.flatMap((a) => (a.elementos ? a.elementos.map((e) => a.id + ':' + e.id) : [a.id]));
    const txt = redaccionBeneficiosAcciones(EQ, null, todas);
    const x = await hoja1(txt);
    const total = alturas(x).reduce((a, b) => a + b, 0);
    assert.ok(total >= lineasTexto(txt, 200) * 12.5 + 18, 'alto ' + total);
    assert.ok(alturas(x).every((h) => h <= ALTO_MAXIMO_FILA));
    // La hoja 1 conserva «ajustar a una página»: se sigue imprimiendo en una.
    assert.match(x, /<pageSetUpPr fitToPage="1"\/>/);
  });
});
