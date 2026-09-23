// Pruebas del EXPORTADOR de la Ficha de Planificación (PE.02081) contra la
// PLANTILLA OFICIAL REAL (`assets/plantillas/PE-02081-planificacion.xlsx`).
//
// Hasta el 2026-09-23 el exportador no tenía ni una prueba (cola de Fichas,
// paquete «que no vuelva a pasar»). Esta nace con CF-05: el «Valor Real
// Total» y el «Sistema» que el Ingeniero teclea en la ficha se quedaban en la
// pantalla y el Excel firmado salía con J36/K36 en blanco.
//
// Equipo de prueba FICTICIO: el repo es público.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

import {
  celdasFichaPlan,
  exportarFichaPlanificacion
} from '../assets/js/ui/fichas/exportar-planificacion.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
const HOJA = 'xl/worksheets/sheet1.xml';

// El módulo carga JSZip del CDN; en Node se inyecta el del paquete.
before(() => { globalThis.__sgmJSZip = JSZip; });

const EQUIPO = Object.freeze({
  subestacion: 'SUBESTACION DE PRUEBA',
  serie: 'S-0001',
  matricula: 'T0-PRUEBA',
  departamento: 'DEPARTAMENTO DE PRUEBA',
  mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3
});

const celda = (mapa, ref) => mapa.find((m) => m.cell === ref);

/** Exporta con la plantilla real y devuelve { xml de la hoja 1, hoja leída por SheetJS }. */
async function exportar(plan) {
  const plantillaBuffer = readFileSync(PLANTILLA);
  const bytes = await exportarFichaPlanificacion(EQUIPO, { plan }, { plantillaBuffer, tipoSalida: 'uint8array' });
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file(HOJA).async('string');
  const wb = XLSX.read(bytes, { type: 'array' });
  return { xml, hoja: wb.Sheets[wb.SheetNames[0]] };
}

/** Todas las celdas de una hoja como { ref: xml-de-la-celda }. */
function celdasXml(xml) {
  const out = {};
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)) out[m[1]] = m[0];
  return out;
}

describe('CF-05 · el Valor Real y el Sistema llegan al Excel que se firma', () => {
  test('el mapa de la hoja 1 incluye J36 (Valor Real Total) y K36 (Sistema)', () => {
    const mapa = celdasFichaPlan(EQUIPO, { plan: { presu_real: '2.100.000.000', presu_sistema: 'STR' } });
    assert.deepEqual(
      { val: celda(mapa, 'J36').val, numeric: celda(mapa, 'J36').numeric, clear: celda(mapa, 'J36').clear },
      { val: 2100000000, numeric: true, clear: false }
    );
    assert.equal(celda(mapa, 'K36').val, 'STR');
    assert.equal(celda(mapa, 'K36').clear, false);
  });

  test('el dinero se lee con montoCOP: los puntos son miles y la coma, decimales', () => {
    // Con parseFloat, «2.100.000.000» sería 2,1 y «1.234.567,89» sería 1,234.
    const v = (texto) => celda(celdasFichaPlan(EQUIPO, { plan: { presu_real: texto } }), 'J36').val;
    assert.equal(v('2.100.000.000'), 2100000000);
    assert.equal(v('1.234.567,89'), 1234567.89);
    assert.equal(v('$ 500.000'), 500000);
  });

  test('estado cero: sin Valor Real ni Sistema las dos casillas quedan en blanco, sin inventar', () => {
    for (const plan of [{}, { presu_real: '', presu_sistema: '' }, { presu_real: '   ', presu_sistema: '   ' }]) {
      const mapa = celdasFichaPlan(EQUIPO, { plan });
      assert.equal(celda(mapa, 'J36').clear, true, JSON.stringify(plan));
      assert.equal(celda(mapa, 'K36').clear, true, JSON.stringify(plan));
    }
  });

  test('en el archivo: J36 es un NÚMERO con el formato de pesos de la plantilla, K36 texto', async () => {
    const { xml, hoja } = await exportar({ presu_real: '1.234.567,89', presu_sistema: '  STR  ' });
    const c = celdasXml(xml);
    // El estilo 255 (pesos, casilla desbloqueada) y el 72 (centrado) son los de la plantilla.
    assert.equal(c.J36, '<c r="J36" s="255"><v>1234567.89</v></c>');
    assert.match(c.K36, /^<c r="K36" s="72" t="inlineStr">/);
    assert.equal(hoja.J36.v, 1234567.89);
    assert.equal(hoja.J36.t, 'n');
    assert.equal(hoja.K36.v, 'STR');
    // El TOTAL DEL PROYECTO real sigue siendo la fórmula de la plantilla y
    // SIN valor en caché: Excel lo recalcula al abrir con J36 dentro.
    assert.equal(c.J78, '<c r="J78" s="58"><f>SUM(J34:J66)</f></c>');
  });

  test('en el archivo, estado cero: J36 y K36 no llevan ningún valor', async () => {
    const { hoja } = await exportar({});
    assert.ok(!hoja.J36 || hoja.J36.v === '' || hoja.J36.v == null, 'J36 debería quedar vacía');
    assert.ok(!hoja.K36 || hoja.K36.v === '' || hoja.K36.v == null, 'K36 debería quedar vacía');
  });

  test('fuera del mapa, la hoja 1 sale IDÉNTICA a la plantilla (celda por celda)', async () => {
    const plantilla = await JSZip.loadAsync(readFileSync(PLANTILLA));
    const antes = celdasXml(await plantilla.file(HOJA).async('string'));
    const { xml } = await exportar({ presu_real: '2.100.000.000', presu_sistema: 'STR' });
    const despues = celdasXml(xml);
    const mapa = new Set(celdasFichaPlan(EQUIPO, { plan: {} }).map((m) => m.cell));
    const recalculadas = new Set(['I78', 'J78']);   // solo pierden el valor en caché
    const cambiadas = Object.keys(antes)
      .filter((ref) => !mapa.has(ref) && !recalculadas.has(ref) && antes[ref] !== despues[ref]);
    assert.deepEqual(cambiadas, []);
    assert.deepEqual(Object.keys(despues).filter((ref) => !(ref in antes)), [], 'no se crean celdas nuevas');
  });
});
