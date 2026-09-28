// Excel de Mantenimiento Especializado (`99 §110`, pedidos del Ingeniero del
// 2026-09-27): sin la hoja «Beneficios», pies «Pág. N de 4», sin las anotaciones
// en cursiva de las tarjetas de «Salud y riesgo», y el Diagrama Futuro derecho
// (su tamaño sale de la hoja). El PI no cambia.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import { exportarFichaPlanificacion } from '../assets/js/ui/fichas/exportar-planificacion.js';
import { leerLibroParaVista } from '../assets/js/ui/fichas/vista-previa-excel.js';
import { svgSaludRiesgo } from '../assets/js/ui/fichas/salud-riesgo-excel.js';
import { cajaDeImagen, quitarHojaDelLibro, anclarConTamano } from '../assets/js/ui/fichas/ajustes-libro.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
before(() => { globalThis.__sgmJSZip = JSZip; });
const EQ = { subestacion: 'SUBESTACION DE PRUEBA', serie: 'S-0001', matricula: 'T0-PRUEBA', zona: 'OCCIDENTE', mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3 };
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const KPIS = [
  { valor: '3', sub: 'Medio', etiqueta: 'Condición del activo', rol: 'fila 3 de la matriz' },
  { valor: '12.345', sub: 'criticidad Menor', etiqueta: 'Usuarios aguas abajo', rol: 'columna Menor' },
  { valor: '30', sub: 'MVA', etiqueta: 'Capacidad comprometida', rol: 'se muestra: no mueve la casilla' },
  { valor: 'Riesgo alto', sub: 'MO.00418 Tabla 11', etiqueta: 'Veredicto de riesgo', rol: 'resultado de fila × columna' }
];
const MODELO = {
  titulo: 'Salud · PRUEBA', kpis: KPIS, definicion: 'Definición.',
  columnas: [1, 2, 3, 4, 5].map((i) => ({ etiqueta: String(i), rango: '' })),
  filas: [1, 2, 3, 4, 5].map((f) => ({ nombre: String(f), celdas: [0, 1, 2, 3, 4].map((i) => ({ hex: '#1B8E3F', tinta: '#ffffff', aqui: f === 3 && i === 1 })) })),
  marca: { mva: '30 MVA', usuarios: '12.345 usuarios', punto: 4 }, hayMarca: true,
  leyenda: [{ hex: '#1B8E3F', texto: 'Riesgo tolerable' }], puntos: [1, 2, 3, 4, 5], potenciaLeyenda: 'Tamaño', lectura: '', nota: 'Nota.'
};
const plantilla = () => readFileSync(PLANTILLA);
async function libro(estado) {
  const b = await exportarFichaPlanificacion(EQ, estado, { plantillaBuffer: plantilla(), tipoSalida: 'uint8array' });
  return JSZip.loadAsync(b);
}
const MTTO = { plan: { proyecto: 'P' }, saludRiesgo: { ...MODELO, png: PNG }, sinHojaBeneficios: true };

/** Cada relación interna apunta a una parte que existe y cada Override tiene su parte. */
async function paqueteSano(z) {
  const nombres = new Set(Object.keys(z.files).filter((n) => !z.files[n].dir));
  const faltan = [];
  for (const n of [...nombres].filter((x) => x.endsWith('.rels'))) {
    const base = n === '_rels/.rels' ? '' : n.replace(/_rels\/([^/]+)\.rels$/, '$1').replace(/[^/]*$/, '');
    const xml = await z.file(n).async('string');
    for (const m of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      if (/TargetMode="External"/.test(m[0])) continue;
      const t = m[0].match(/Target="([^"]+)"/)[1];
      const partes = (t.startsWith('/') ? t.slice(1) : base + t).split('/');
      const out = [];
      for (const p of partes) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
      if (!nombres.has(out.join('/'))) faltan.push(n + ' → ' + t);
    }
  }
  const ct = await z.file('[Content_Types].xml').async('string');
  for (const m of ct.matchAll(/PartName="\/([^"]+)"/g)) if (!nombres.has(m[1])) faltan.push('Override sin parte: ' + m[1]);
  return faltan;
}

async function pie(z, hoja, celda) {
  const xml = await z.file('xl/worksheets/' + hoja).async('string');
  const m = xml.match(new RegExp('<c r="' + celda + '"[^>]*>([\\s\\S]*?)</c>'));
  return m ? (m[1].match(/<t\b[^>]*>([^<]*)<\/t>/) || [])[1] : null;
}

describe('Mantenimiento: el Excel sale sin la hoja «Beneficios»', () => {
  test('cuatro hojas, áreas de impresión en su sitio, sin piezas de la hoja quitada y sin datos ocultos', async () => {
    const z = await libro(MTTO);
    const m = await leerLibroParaVista(z);
    assert.deepEqual(m.hojas.map((h) => h.nombre), ['Ficha Técnica', 'Diagrama Actual', 'Diagrama Futuro', 'Salud y riesgo']);
    assert.deepEqual(m.ocultos, []);
    const wb = await z.file('xl/workbook.xml').async('string');
    assert.doesNotMatch(wb, /Beneficios/);
    const areas = [...wb.matchAll(/<definedName name="_xlnm\.Print_Area" localSheetId="(\d)">([^<]*)<\/definedName>/g)]
      .map((a) => a[1] + ':' + a[2]).sort();
    assert.deepEqual(areas, ["0:'Ficha Técnica'!$A$1:$M$110", "1:'Diagrama Actual'!$B$2:$R$56",
      "2:'Diagrama Futuro'!$B$2:$R$56", "3:'Salud y riesgo'!$B$2:$R$56"]);
    assert.equal(z.file('xl/worksheets/sheet2.xml'), null);
    assert.equal(z.file('xl/drawings/drawing2.xml'), null);
    assert.doesNotMatch(await z.file('[Content_Types].xml').async('string'), /sheet2\.xml/);
    assert.deepEqual(await paqueteSano(z), []);
  });
  test('los pies dicen «de 4», en el orden de las hojas', async () => {
    const z = await libro(MTTO);
    assert.equal(await pie(z, 'sheet1.xml', 'B110'), 'Pág 1 de 4');
    assert.equal(await pie(z, 'sheet3.xml', 'B56'), 'Pág. 2 de 4');
    assert.equal(await pie(z, 'sheet4.xml', 'B56'), 'Pág. 3 de 4');
    assert.equal(await pie(z, 'sheet6.xml', 'B56'), 'Pág. 4 de 4');
  });
  test('la hoja 1 conserva su casilla BENEFICIOS (B23)', async () => {
    const z = await libro({ ...MTTO, plan: { proyecto: 'P', beneficios: 'Texto de beneficios de prueba.' } });
    const s1 = await z.file('xl/worksheets/sheet1.xml').async('string');
    assert.match(s1, /Texto de beneficios de prueba\./);
  });
  test('el PI no cambia: cinco hojas con «Beneficios» y sus pies «de 5»', async () => {
    const z = await libro({ plan: { proyecto: 'P' } });
    const m = await leerLibroParaVista(z);
    assert.deepEqual(m.hojas.map((h) => h.nombre), ['Ficha Técnica', 'Beneficios', 'Diagrama Actual', 'Diagrama Futuro', 'Anexo AT']);
    assert.ok(z.file('xl/worksheets/sheet2.xml'));
    // El pie sigue siendo el texto compartido de la plantilla («Pág. 3 de 5»), sin tocar.
    assert.match(await z.file('xl/worksheets/sheet3.xml').async('string'), /<c r="B56"[^>]*t="s"/);
  });
  test('si el libro no tiene la hoja, no hace nada', async () => {
    const z = await JSZip.loadAsync(plantilla());
    assert.equal(await quitarHojaDelLibro(z, 'No existe'), false);
    assert.ok(z.file('xl/worksheets/sheet2.xml'));
  });
});

describe('«Salud y riesgo» en el Excel sin las anotaciones en cursiva', () => {
  test('las cuatro tarjetas llevan cifra, texto y título, sin sus anotaciones', () => {
    const { svg } = svgSaludRiesgo(MODELO);
    for (const k of KPIS) {
      assert.match(svg, new RegExp(k.etiqueta));
      assert.doesNotMatch(svg, new RegExp(k.rol.replace(/[×:]/g, '.')));
    }
    assert.doesNotMatch(svg, /font-style="italic"/);
  });
});

describe('Diagrama Futuro derecho', () => {
  test('el tamaño con que la hoja muestra la imagen del Futuro sale de su dibujo (609 × 589)', async () => {
    const z = await JSZip.loadAsync(plantilla());
    assert.deepEqual(await cajaDeImagen(z, 'xl/drawings/drawing4.xml', 'rId2'), { w: 609, h: 589 });
    // El Actual SÍ lleva el giro que compensa su dibujo rotado; el Futuro no.
    assert.match(await z.file('xl/drawings/drawing3.xml').async('string'), /<a:xfrm rot="16200000">/);
    assert.doesNotMatch(await z.file('xl/drawings/drawing4.xml').async('string'), /<a:xfrm rot=/);
  });
  test('sin dibujo o sin la imagen, no inventa tamaño', async () => {
    const z = await JSZip.loadAsync(plantilla());
    assert.equal(await cajaDeImagen(z, 'xl/drawings/drawing4.xml', 'rId99'), null);
    assert.equal(await cajaDeImagen(z, 'xl/drawings/no-existe.xml', 'rId2'), null);
  });
});

describe('El Futuro se ve del mismo tamaño en todos los programas (revisión §110)', () => {
  test('su imagen queda anclada a su tamaño (609 × 589), no estirada a las celdas; el logo no cambia', async () => {
    const z = await JSZip.loadAsync(plantilla());
    const antes = await z.file('xl/drawings/drawing4.xml').async('string');
    assert.equal(await anclarConTamano(z, 'xl/drawings/drawing4.xml', 'rId2'), true);
    const x = await z.file('xl/drawings/drawing4.xml').async('string');
    const una = x.match(/<xdr:oneCellAnchor>[\s\S]*?<\/xdr:oneCellAnchor>/g) || [];
    assert.equal(una.length, 1);
    assert.match(una[0], /r:embed="rId2"/);
    assert.match(una[0], /<xdr:ext cx="5802081" cy="5606143"\/>/);
    assert.equal(una[0].match(/<xdr:from>[\s\S]*?<\/xdr:from>/)[0],
      '<xdr:from><xdr:col>5</xdr:col><xdr:colOff>290286</xdr:colOff><xdr:row>8</xdr:row><xdr:rowOff>108856</xdr:rowOff></xdr:from>');
    assert.match(antes, /<xdr:col>5<\/xdr:col><xdr:colOff>290286<\/xdr:colOff><xdr:row>8<\/xdr:row>/);
    assert.match(x, /<xdr:twoCellAnchor\b[^>]*>(?:(?!<\/xdr:twoCellAnchor>)[\s\S])*r:embed="rId1"/);
    // La vista previa lo lee con su tamaño exacto.
    const m = await leerLibroParaVista(z);
    const im = m.hojas.find((h) => h.nombre === 'Diagrama Futuro').imagenes.find((i) => /image6/.test(i.ruta));
    assert.deepEqual([Math.round(im.w), Math.round(im.h), im.rot], [609, 589, 0]);
  });
  test('una segunda vez no hay nada que cambiar', async () => {
    const z = await JSZip.loadAsync(plantilla());
    await anclarConTamano(z, 'xl/drawings/drawing4.xml', 'rId2');
    assert.equal(await anclarConTamano(z, 'xl/drawings/drawing4.xml', 'rId2'), false);
  });
  test('la vista previa lee el giro del Diagrama Actual (270°)', async () => {
    const m = await leerLibroParaVista(await JSZip.loadAsync(plantilla()));
    const im = m.hojas.find((h) => h.nombre === 'Diagrama Actual').imagenes.find((i) => /image5/.test(i.ruta));
    assert.equal(im.rot, 270);
  });
});

