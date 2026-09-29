// El Diagrama Actual dentro de la exportación COMPLETA (`99 §115`): en Node no hay
// canvas, así que sin esto la rama que dibuja y ancla el Actual no la corría ninguna
// prueba (revisión adversarial 2026-09-28). Aquí un navegador de mentira entrega un
// PNG, y se revisa el libro que sale para Mantenimiento y para el PI.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import { exportarFichaPlanificacion } from '../assets/js/ui/fichas/exportar-planificacion.js';
import { leerLibroParaVista } from '../assets/js/ui/fichas/vista-previa-excel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
const EQ = { subestacion: 'SUBESTACION DE PRUEBA', serie: 'S-0001', matricula: 'T0-PRUEBA', zona: 'OCCIDENTE', mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3 };
// PNG de 1×1 que «dibuja» el navegador de mentira (marca reconocible en los bytes).
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 470"><rect width="640" height="470" fill="#fff"/></svg>';
const SALUD = {
  titulo: 't', kpis: [], definicion: '', columnas: [], filas: [], marca: null, hayMarca: false, leyenda: [], puntos: [], potenciaLeyenda: '', avisoDato: ''
};

let guardado;
before(() => {
  globalThis.__sgmJSZip = JSZip;
  guardado = { d: globalThis.document, i: globalThis.Image, f: globalThis.FileReader };
  const ctx = { fillStyle: '', fillRect() {}, translate() {}, rotate() {}, drawImage() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, toBlob: (cb) => cb(new Blob([PNG], { type: 'image/png' })) }) };
  globalThis.Image = class { set src(_) { setTimeout(() => this.onload && this.onload(), 0); } };
  globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then((ab) => { this.result = ab; this.onload && this.onload(); }); } };
});
after(() => {
  for (const [k, v] of [['document', guardado.d], ['Image', guardado.i], ['FileReader', guardado.f]]) {
    if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
  }
});

async function libro(estado) {
  const b = await exportarFichaPlanificacion(EQ, estado, { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array' });
  return JSZip.loadAsync(b);
}
const anclaDelActual = async (z) => {
  const x = await z.file('xl/drawings/drawing3.xml').async('string');
  return (x.match(/<xdr:(?:one|two)CellAnchor\b[^>]*>(?:(?!<\/xdr:(?:one|two)CellAnchor>)[\s\S])*?r:embed="rId2"[\s\S]*?<\/xdr:(?:one|two)CellAnchor>/) || [''])[0];
};

describe('El Diagrama Actual en la exportación completa', () => {
  for (const [nombre, estado, hojas] of [
    ['Mantenimiento', { diagramas: { actual: { svg: SVG }, futuro: { svg: SVG } }, saludRiesgo: SALUD, sinHojaBeneficios: true },
      ['Ficha Técnica', 'Diagrama Actual', 'Diagrama Futuro', 'Salud y riesgo']],
    ['PI', { diagramas: { actual: { svg: SVG }, futuro: { svg: SVG } } },
      ['Ficha Técnica', 'Beneficios', 'Diagrama Actual', 'Diagrama Futuro', 'Anexo AT']]
  ]) {
    test(nombre + ': el Actual lleva el dibujo nuevo, anclado a su tamaño con la caja GIRADA, y conserva su giro', async () => {
      const z = await libro(estado);
      assert.deepEqual([...await z.file('xl/media/image5.png').async('uint8array')], [...PNG], 'el dibujo nuevo del Actual');
      const a = await anclaDelActual(z);
      assert.match(a, /^<xdr:oneCellAnchor>/);
      assert.match(a, /<xdr:ext cx="6019800" cy="4940300"\/>/);
      assert.match(a, /<a:xfrm rot="16200000">/);
      assert.match(a, /<xdr:from><xdr:col>5<\/xdr:col><xdr:colOff>294821<\/xdr:colOff><xdr:row>11<\/xdr:row><xdr:rowOff>104321<\/xdr:rowOff><\/xdr:from>/);
      // El Futuro, derecho y anclado a su tamaño, como en `§110`.
      assert.match(await z.file('xl/drawings/drawing4.xml').async('string'), /<xdr:oneCellAnchor>/);
      // La vista previa lo muestra apaisado y derecho, del tamaño exacto.
      const vista = await leerLibroParaVista(z);
      assert.deepEqual(vista.hojas.map((h) => h.nombre), hojas, 'las mismas hojas de siempre');
      const im = vista.hojas.find((h) => h.nombre === 'Diagrama Actual').imagenes.find((i) => /image5/.test(i.ruta));
      assert.deepEqual([Math.round(im.w), Math.round(im.h), im.rot], [632, 519, 270]);
    });
  }

  test('Mantenimiento: la hoja «Salud y riesgo» (clon del marco del Actual) no se lleva la imagen del Actual', async () => {
    const z = await libro({ diagramas: { actual: { svg: SVG } }, saludRiesgo: SALUD, sinHojaBeneficios: true });
    const rels = await z.file('xl/drawings/_rels/drawing6.xml.rels').async('string');
    assert.doesNotMatch(rels, /image5\.png/);
  });

  test('sin dibujo del Actual, su hoja queda como en la plantilla (twoCellAnchor)', async () => {
    const z = await libro({ saludRiesgo: SALUD, sinHojaBeneficios: true });
    assert.match(await anclaDelActual(z), /^<xdr:twoCellAnchor/);
  });
});
