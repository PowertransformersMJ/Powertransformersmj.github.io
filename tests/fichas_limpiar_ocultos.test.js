// Datos ocultos fuera del Excel de Fichas (`99 §104`). Orden del Ingeniero:
// «datos ocultos no necesito que se exporte en los documentos». La plantilla los
// trae; el archivo exportado NO. Lo visible no cambia. Sin firmas reales.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, posix } from 'node:path';
import JSZip from 'jszip';

import { exportarFichaPlanificacion } from '../assets/js/ui/fichas/exportar-planificacion.js';
import { leerLibroParaVista } from '../assets/js/ui/fichas/vista-previa-excel.js';
import { limpiarOcultos, planDeLimpieza, partesSueltas, textosSobrantes, resolver } from '../assets/js/ui/fichas/limpiar-ocultos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
before(() => { globalThis.__sgmJSZip = JSZip; });

const EQUIPO = Object.freeze({
  subestacion: 'SUBESTACION DE PRUEBA', serie: 'S-0001', matricula: 'T0-PRUEBA',
  departamento: 'DEPARTAMENTO DE PRUEBA', mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3
});
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ESTADO = { plan: { proyecto: 'PROYECTO LIMPIO', alcance: 'Alcance.', fechaentrega: '15-12-2026' }, firmas: { elab: { dataUrl: PNG, rel: 2.5 } } };

const plantilla = () => JSZip.loadAsync(readFileSync(PLANTILLA));
async function exportado(estado = ESTADO) {
  const bytes = await exportarFichaPlanificacion(EQUIPO, estado, { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array' });
  return JSZip.loadAsync(bytes);
}
const archivos = (zip) => Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
const txt = (zip, n) => zip.file(n).async('string');

describe('La plantilla trae datos ocultos (la vista previa los muestra)', () => {
  test('los 13: vínculo, fechas, hoja borrada, SharePoint, etiqueta, nombres rotos, impresora, UPME fuera, piezas y textos sueltos', async () => {
    const m = await leerLibroParaVista(await plantilla());
    const t = m.ocultos.map((o) => o.titulo).join(' | ');
    for (const re of [/Vínculo a otro archivo/, /Propiedades del documento/, /Hojas que ya no existen/, /Propiedades personalizadas/,
      /Etiqueta de clasificación/, /SharePoint/, /Nombres definidos rotos/, /Impresora guardada/, /Imagen FUERA del área de impresión · Beneficios/,
      /Imagen FUERA del área de impresión · Anexo AT/, /Piezas del archivo que ninguna hoja usa/, /Textos guardados que ninguna celda usa/]) {
      assert.match(t, re);
    }
    const piezas = m.ocultos.find((o) => /Piezas del archivo/.test(o.titulo));
    assert.match(piezas.detalle, /drawing5\.xml/);
    assert.match(piezas.detalle, /image7\.png/);
    assert.match(m.ocultos.find((o) => /Textos guardados/.test(o.titulo)).detalle, /ACTUACIONES/);
  });
});

describe('El Excel exportado sale SIN datos ocultos', () => {
  test('la vista previa no encuentra nada oculto (PI y Mantenimiento usan el mismo exportador)', async () => {
    const m = await leerLibroParaVista(await exportado());
    assert.deepEqual(m.ocultos, []);
  });
  test('no viajan las piezas: vínculo, SharePoint, etiqueta, impresora, UPME, hoja borrada', async () => {
    const zip = await exportado();
    const n = archivos(zip).join('\n');
    for (const re of [/externalLink/, /customXml/, /docProps\/custom\.xml/, /LabelInfo/, /printerSettings/, /image4\.png/, /image7\.png/, /drawing5\.xml/]) {
      assert.doesNotMatch(n, re);
    }
    const wb = await txt(zip, 'xl/workbook.xml');
    assert.doesNotMatch(wb, /externalReferences|#REF!|revisionPtr|absPath/);
    assert.equal((wb.match(/_xlnm\.Print_Area/g) || []).length, 5, 'las cinco áreas de impresión siguen');
    assert.doesNotMatch(await txt(zip, 'docProps/core.xml'), /2018|2023|lastPrinted/);
    assert.doesNotMatch(await txt(zip, 'docProps/app.xml'), /Anexos MT|TitlesOfParts/);
    assert.doesNotMatch(await txt(zip, 'xl/sharedStrings.xml'), /ACTUACIONES|Coste Total Adecuación/);
  });
  test('el paquete queda sano: cada tipo, cada relación y cada r:id apunta a algo que existe', async () => {
    const zip = await exportado();
    const hay = new Set(archivos(zip));
    const ct = await txt(zip, '[Content_Types].xml');
    for (const m of ct.matchAll(/PartName="\/([^"]+)"/g)) assert.ok(hay.has(m[1]), 'tipo sin parte: ' + m[1]);
    for (const r of [...hay].filter((q) => q.endsWith('.rels'))) {
      const base = r === '_rels/.rels' ? '' : r.replace(/_rels\/([^/]+)\.rels$/, '$1');
      const xml = await txt(zip, r);
      for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
        assert.doesNotMatch(m[0], /TargetMode="External"/, 'relación externa en ' + r);
        const destino = resolver(base, m[0].match(/Target="([^"]+)"/)[1]);
        assert.ok(hay.has(destino), r + ' → ' + destino);
      }
      if (!base) continue;
      const ids = new Set([...xml.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]));
      for (const m of (await txt(zip, base)).matchAll(/\sr:(?:id|embed|link)="([^"]+)"/g)) assert.ok(ids.has(m[1]), base + ' usa ' + m[1] + ' sin relación');
    }
    assert.deepEqual(Object.keys(zip.files).filter((q) => zip.files[q].dir && ![...hay].some((f) => f.startsWith(q))), [], 'sin carpetas vacías');
  });
  test('Beneficios!K11 lee este libro (mismo 0 de antes) y K14 da #¡DIV/0! como en Excel', async () => {
    const zip = await exportado();
    const s2 = await txt(zip, 'xl/worksheets/sheet2.xml');
    assert.match(s2, /<c r="K11" s="136"><f>'Ficha Técnica'!J37\/1000000<\/f><\/c>/);
    assert.match(s2, /<c r="K14" s="219"><f>\+K12\/K11<\/f><\/c>/);
    const ben = (await leerLibroParaVista(zip)).hojas[1];
    const k = (ref) => ben.celdas.find((c) => c.ref === ref);
    assert.equal(k('K11').externa, false);
    assert.equal(k('K11').texto, '$ -');
    assert.equal(k('K14').texto, '#¡DIV/0!');
  });
  test('la impresión no cambia: sin impresora guardada, cada hoja conserva su escala y orientación', async () => {
    const zip = await exportado();
    const esperado = { sheet1: 'scale="43" orientation="portrait"', sheet2: 'scale="52" orientation="landscape"', sheet6: 'scale="45" orientation="landscape"' };
    for (const [h, a] of Object.entries(esperado)) assert.match(await txt(zip, 'xl/worksheets/' + h + '.xml'), new RegExp('<pageSetup ' + a + '/>'));
  });
});

describe('Lo visible no cambia', () => {
  test('mismas celdas, imágenes y textos en las cinco hojas (salvo K11/K14, que ahora se calculan)', async () => {
    const antes = await leerLibroParaVista(await plantilla());
    const zip = await plantilla();
    await limpiarOcultos(zip);
    const despues = await leerLibroParaVista(zip);
    assert.equal(despues.hojas.length, 5);
    antes.hojas.forEach((h, i) => {
      const d = despues.hojas[i];
      assert.equal(d.nombre, h.nombre); assert.equal(d.area, h.area);
      const celdas = (x) => x.celdas.filter((c) => !['K11', 'K14'].includes(c.ref) || x.nombre !== 'Beneficios').map((c) => [c.ref, c.texto, c.x, c.y, c.w, c.h]);
      assert.deepEqual(celdas(d), celdas(h), h.nombre + ': celdas');
      const img = (x) => x.imagenes.map((o) => [o.ruta, o.x, o.y, o.w, o.h]);
      assert.deepEqual(img(d), img(h), h.nombre + ': imágenes dentro del área');
      assert.deepEqual(d.textos.map((o) => o.parrafos.map((p) => p.texto).join('/')), h.textos.map((o) => o.parrafos.map((p) => p.texto).join('/')), h.nombre + ': cuadros de texto');
    });
  });
  test('las firmas estampadas siguen en la hoja 1 después de limpiar', async () => {
    const m = await leerLibroParaVista(await exportado());
    assert.ok(m.hojas[0].imagenes.some((i) => /firma-elab\.png$/.test(i.ruta) && i.src));
  });
  test('los textos compartidos conservan su número: las celdas no se corren', async () => {
    const zip = await exportado();
    const si = (await txt(zip, 'xl/sharedStrings.xml')).match(/<si>[\s\S]*?<\/si>/g);
    assert.equal(si.length, 134, 'mismo número de textos que la plantilla');
  });
});

describe('La limpieza, pieza por pieza', () => {
  test('limpiar dos veces no cambia nada más', async () => {
    const zip = await exportado();
    const nombres = archivos(zip);
    const textos = new Map();
    for (const n of nombres) if (/\.(xml|rels)$/.test(n)) textos.set(n, await txt(zip, n));
    const plan = planDeLimpieza(nombres, textos);
    assert.equal(plan.escribir.size, 0);
    assert.deepEqual(plan.quitar, []);
  });
  test('una fórmula compartida con vínculo que no se puede corregir: NO se toca nada (el archivo sale como antes)', async () => {
    const zip = await plantilla();
    const s2 = await txt(zip, 'xl/worksheets/sheet2.xml');
    zip.file('xl/worksheets/sheet2.xml', s2.replace("<f>'[1]Ficha Técnica'!J37/1000000</f>", "<f t=\"shared\" ref=\"K11\" si=\"9\">'[1]Hoja Que No Existe'!J37</f>"));
    const antes = archivos(zip);
    await assert.rejects(limpiarOcultos(zip), /compartida/);
    assert.deepEqual(archivos(zip), antes);
  });
  test('una fórmula que lee una hoja que aquí no existe se queda con su valor, sin fórmula', () => {
    const nombres = ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml'];
    const plan = planDeLimpieza(nombres, {
      '[Content_Types].xml': '<Types/>',
      '_rels/.rels': '<Relationships><Relationship Id="rId1" Type="x/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x/externalLink" Target="externalLinks/externalLink1.xml"/></Relationships>',
      'xl/workbook.xml': '<workbook><sheets><sheet name="Hoja" sheetId="1" r:id="rId1"/></sheets><externalReferences><externalReference r:id="rId2"/></externalReferences></workbook>',
      'xl/worksheets/sheet1.xml': '<c r="A1"><f>[1]Otra!B2*2</f><v>8</v></c><c r="A2"><f>\'[1]Hoja\'!B2</f></c>'
    });
    const s = plan.escribir.get('xl/worksheets/sheet1.xml');
    assert.equal(s, '<c r="A1"><v>8</v></c><c r="A2"><f>\'Hoja\'!B2</f></c>');
    assert.doesNotMatch(plan.escribir.get('xl/workbook.xml'), /externalReferences/);
    assert.doesNotMatch(plan.escribir.get('xl/_rels/workbook.xml.rels'), /externalLink/);
  });
  test('piezas sueltas y textos sobrantes se detectan por sí solos', () => {
    const rels = { '_rels/.rels': '<Relationship Id="a" Type="t" Target="xl/w.xml"/>', 'xl/_rels/w.xml.rels': '<Relationship Id="b" Type="t" Target="m/i.png"/>' };
    assert.deepEqual(partesSueltas(['[Content_Types].xml', '_rels/.rels', 'xl/w.xml', 'xl/_rels/w.xml.rels', 'xl/m/i.png', 'xl/m/vieja.png'], (r) => rels[r] ?? null), ['xl/m/vieja.png']);
    const ss = '<sst><si><t>usado</t></si><si><t>sobra</t></si><si><t></t></si></sst>';
    assert.deepEqual(textosSobrantes(ss, ['<c r="A1" t="s"><v>0</v></c>']), [{ i: 1, texto: 'sobra' }]);
    assert.equal(posix.normalize(resolver('xl/drawings/drawing1.xml', '../media/image1.png')), 'xl/media/image1.png');
  });
});
