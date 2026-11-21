// Firma de ODT Afinia · revisión ESTRUCTURAL de las casillas con pdf-lib (sin navegador).
// Cada caso parte de la ODT SINTÉTICA de la fixture (con las líneas de sus celdas) y le agrega
// algo DENTRO o FUERA de una casilla: imagen (XObject), Form XObject, trazo, relleno, texto,
// anotación, imagen en línea y CTM con q/Q. Datos inventados (repo público).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { armarOdt, pngFirma, PDFLib } from './odt_afinia_fixture.js';
import { ZONAS_MEDIDAS } from '../assets/js/domain/odt_afinia_zonas.js';
import { rectTinta } from '../assets/js/domain/odt_afinia_casilla.js';
import {
  revisarEstructura, leerContenido, multiplicar, aplicar, segmentoToca, poligonoToca, PROFUNDIDAD_MAX
} from '../assets/js/domain/odt_afinia_estructura.js';

const Z = ZONAS_MEDIDAS;
const { PDFDocument, PDFName, rgb, StandardFonts } = PDFLib;

/** La ODT sintética con algo agregado en la ÚLTIMA página. */
async function conAgregado(fn) {
  const { bytes } = await armarOdt();
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pag = doc.getPage(doc.getPageCount() - 1);
  await fn(doc, pag);
  return doc.save();
}
const revisar = (b) => revisarEstructura(b, Z, PDFLib);
const ocupada = (r, clave) => (r.ocupadas.find((o) => o.clave === clave) || { motivos: [] }).motivos;
/** Contenido crudo agregado a la página (sin comprimir). */
function crudo(doc, pag, texto) {
  pag.node.addContentStream(doc.context.register(doc.context.stream(texto)));
}
const centro = (z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });

describe('la ODT sintética vacía pasa (las líneas de las celdas no cuentan)', () => {
  test('sin nada agregado: ok, sin error', async () => {
    const { bytes } = await armarOdt();
    const copia = bytes.slice();
    const r = await revisar(bytes);
    assert.deepEqual(r, { ok: true, ocupadas: [], error: null });
    assert.deepEqual([...bytes], [...copia], 'no modifica los bytes que recibe');
  });
  test('falta pdf-lib: lanza (no se da por vacía)', async () => {
    const { bytes } = await armarOdt();
    await assert.rejects(revisarEstructura(bytes, Z, {}), /pdf-lib/);
  });
});

describe('imagen (XObject /Image)', () => {
  test('dentro de la casilla del AZT → ocupada por «imagen»', async () => {
    const b = await conAgregado(async (doc, pag) => {
      const png = await doc.embedPng(pngFirma(120, 40, 1));
      pag.drawImage(png, { x: Z.azt.x + 20, y: Z.azt.y + 5, width: 80, height: 25 });
    });
    const r = await revisar(b);
    assert.equal(r.ok, false);
    assert.deepEqual(ocupada(r, 'azt'), ['imagen']);
    assert.deepEqual(ocupada(r, 'responsable'), []);
  });
  test('fuera de las casillas → vacía', async () => {
    const b = await conAgregado(async (doc, pag) => {
      const png = await doc.embedPng(pngFirma(120, 40, 1));
      pag.drawImage(png, { x: 400, y: 600, width: 80, height: 25 });
    });
    assert.equal((await revisar(b)).ok, true);
  });
});

describe('Form XObject (p. ej. la firma de Fill&Sign dentro del contenido)', () => {
  async function formulario(x, y) {
    return conAgregado(async (doc, pag) => {
      const otro = await PDFDocument.create({ updateMetadata: false });
      const p = otro.addPage([100, 30]);
      p.drawLine({ start: { x: 5, y: 5 }, end: { x: 95, y: 25 }, thickness: 1.5, color: rgb(0, 0, 0.5) });
      const [emb] = await doc.embedPdf(otro);
      pag.drawPage(emb, { x, y, width: 100, height: 30 });
    });
  }
  test('dentro de la casilla del Responsable → ocupada por «formulario:trazo»', async () => {
    const r = await revisar(await formulario(Z.responsable.x + 10, Z.responsable.y + 2));
    assert.deepEqual(ocupada(r, 'responsable'), ['formulario:trazo']);
    assert.deepEqual(ocupada(r, 'azt'), []);
  });
  test('fuera de las casillas → vacía (la /Matrix y la CTM se aplican)', async () => {
    assert.equal((await revisar(await formulario(400, 500))).ok, true);
  });
});

describe('trazos y rellenos', () => {
  test('una raya oscura que cruza la casilla del AZT → «trazo»', async () => {
    const c = centro(Z.azt);
    const b = await conAgregado((doc, pag) => pag.drawLine({ start: { x: c.x - 30, y: c.y }, end: { x: c.x + 30, y: c.y + 5 }, thickness: 1, color: rgb(0, 0, 0) }));
    assert.deepEqual(ocupada(await revisar(b), 'azt'), ['trazo']);
  });
  test('un relleno BLANCO sobre la casilla no cuenta; uno oscuro sí', async () => {
    const blanco = await conAgregado((doc, pag) => pag.drawRectangle({ ...rectTinta(Z, 'azt'), color: rgb(1, 1, 1) }));
    assert.equal((await revisar(blanco)).ok, true);
    const r = rectTinta(Z, 'azt');
    const oscuro = await conAgregado((doc, pag) => pag.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: rgb(0.1, 0.1, 0.1) }));
    assert.deepEqual(ocupada(await revisar(oscuro), 'azt'), ['trazo']);
  });
  test('un relleno que CUBRE toda la casilla (sin bordes adentro) también cuenta', async () => {
    const b = await conAgregado((doc, pag) => crudo(doc, pag, '0 g 0 0 612 792 re f'));
    const r = await revisar(b);
    for (const c of ['azt', 'responsable', 'si', 'fecha']) assert.deepEqual(ocupada(r, c), ['trazo'], c);
  });
  test('una curva de Bézier (firma vectorial) dentro de SI', async () => {
    const s = Z.si;
    const b = await conAgregado((doc, pag) => crudo(doc, pag, `0 0 0 RG ${s.x - 5} ${s.y + 2} m ${s.x} ${s.y + 9} ${s.x + 6} ${s.y - 1} ${s.x + 12} ${s.y + 6} c S`));
    assert.deepEqual(ocupada(await revisar(b), 'si'), ['trazo']);
  });
});

describe('CTM con q/Q y cm', () => {
  test('lo pintado dentro de «q … cm … Q» se mueve con la CTM, y Q la restaura', async () => {
    const c = centro(Z.azt);
    // Dentro de q/Q la raya se corre 300 pt (queda fuera); después de Q, la misma raya cae en la casilla.
    const corrida = `q 1 0 0 1 0 300 cm 0 G ${c.x - 10} ${c.y} m ${c.x + 10} ${c.y} l S Q`;
    assert.equal((await revisar(await conAgregado((doc, pag) => crudo(doc, pag, corrida)))).ok, true);
    const restaurada = corrida + ` 0 G ${c.x - 10} ${c.y} m ${c.x + 10} ${c.y} l S`;
    assert.deepEqual(ocupada(await revisar(await conAgregado((doc, pag) => crudo(doc, pag, restaurada))), 'azt'), ['trazo']);
  });
  test('una escala con cm lleva a la casilla algo dibujado lejos', async () => {
    const c = centro(Z.responsable);
    const b = await conAgregado((doc, pag) => crudo(doc, pag, `q 0.5 0 0 0.5 0 0 cm 0 G ${2 * c.x - 4} ${2 * c.y} m ${2 * c.x + 4} ${2 * c.y} l S Q`));
    assert.deepEqual(ocupada(await revisar(b), 'responsable'), ['trazo']);
  });
});

describe('texto, imagen en línea y anotaciones', () => {
  test('una «X» escrita en SI → «texto»; en blanco o invisible no cuenta', async () => {
    const conX = (op) => conAgregado(async (doc, pag) => {
      const f = await doc.embedFont(StandardFonts.Helvetica);
      pag.drawText('X', { x: Z.si.x, y: Z.si.y, size: 8, font: f, color: op.color });
    });
    assert.deepEqual(ocupada(await revisar(await conX({ color: rgb(0, 0, 0) })), 'si'), ['texto']);
    assert.equal((await revisar(await conX({ color: rgb(1, 1, 1) }))).ok, true);
    const invisible = await conAgregado((doc, pag) => crudo(doc, pag, `BT 3 Tr 1 0 0 1 ${Z.si.x} ${Z.si.y} Tm (X) Tj ET`));
    assert.equal((await revisar(invisible)).ok, true);
  });
  test('imagen en línea (BI … ID … EI) en la casilla de FECHA, con «EI» dentro de los datos', async () => {
    const f = Z.fecha;
    const b = await conAgregado((doc, pag) => crudo(doc, pag, `q 20 0 0 6 ${f.x + 5} ${f.y} cm BI /W 2 /H 1 /CS /G /BPC 8 ID EIx EI Q`));
    assert.deepEqual(ocupada(await revisar(b), 'fecha'), ['imagen']);
  });
  test('una anotación (Stamp) cuyo /Rect toca la casilla del AZT', async () => {
    const b = await conAgregado((doc, pag) => {
      const r = rectTinta(Z, 'azt');
      const an = doc.context.obj({ Type: 'Annot', Subtype: 'Stamp', Rect: [r.x + 5, r.y + 2, r.x + 60, r.y + 20] });
      pag.node.addAnnot(doc.context.register(an));
    });
    assert.deepEqual(ocupada(await revisar(b), 'azt'), ['anotacion:Stamp']);
  });
  test('una anotación lejos de las casillas no cuenta', async () => {
    const b = await conAgregado((doc, pag) => {
      pag.node.addAnnot(doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [400, 600, 450, 620] })));
    });
    assert.equal((await revisar(b)).ok, true);
  });
});

describe('lo ilegible NO se da por vacío', () => {
  test('un Do de un XObject que no existe → ok:false con error', async () => {
    const b = await conAgregado((doc, pag) => crudo(doc, pag, '/NoExiste Do'));
    const r = await revisar(b);
    assert.equal(r.ok, false);
    assert.match(r.error, /No se pudo revisar/);
  });
  test('Form XObject anidado más allá de PROFUNDIDAD_MAX → ok:false', async () => {
    const b = await conAgregado((doc, pag) => {
      // Un formulario que se dibuja a sí mismo: recursión sin fin.
      const res = doc.context.obj({});
      const form = doc.context.stream('/Yo Do', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 10, 10], Resources: res });
      const ref = doc.context.register(form);
      res.set(PDFName.of('XObject'), doc.context.obj({ Yo: ref }));
      const recursos = pag.node.Resources();
      recursos.set(PDFName.of('XObject'), doc.context.obj({ Yo: ref }));
      crudo(doc, pag, '/Yo Do');
    });
    const r = await revisar(b);
    assert.equal(r.ok, false);
    assert.match(r.error, /anidados/);
    assert.ok(PROFUNDIDAD_MAX >= 3);
  });
});

describe('piezas', () => {
  test('lector del contenido: operandos, operadores, cadenas con paréntesis y comentarios', () => {
    const t = new TextEncoder().encode('% nota\nq 1 0 0 1 5 6 cm (a (b) \\) c) Tj [ (x) 3 ] TJ << /K 1 >> BDC /Im1 Do Q');
    const ops = leerContenido(t).filter((x) => x.op).map((x) => x.op);
    assert.deepEqual(ops, ['q', 'cm', 'Tj', 'TJ', 'BDC', 'Do', 'Q']);
  });
  test('matrices: multiplicar y aplicar', () => {
    const m = multiplicar([2, 0, 0, 2, 0, 0], [1, 0, 0, 1, 10, 20]);
    assert.deepEqual(aplicar(m, 1, 1), [12, 22]);
  });
  test('geometría: segmento y polígono contra un rectángulo', () => {
    const r = { x: 0, y: 0, w: 10, h: 10 };
    assert.equal(segmentoToca([-5, 5], [15, 5], r), true);
    assert.equal(segmentoToca([-5, 15], [15, 15], r), false);
    assert.equal(poligonoToca([[-5, -5], [20, -5], [20, 20], [-5, 20]], r), true, 'lo cubre entero');
    assert.equal(poligonoToca([[20, 20], [30, 20], [30, 30]], r), false);
  });
});
