// «Diagrama Operativo» de la ficha de Mantenimiento (`99 §112`): adjunto por
// transformador (Excel o imagen), dibujado una vez y guardado como imagen; en el
// Excel exportado, hoja nueva al final con el marco oficial.
// Sin datos reales: el cronograma de prueba es sintético.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';
import {
  tipoPorBytes, clasificarArchivo, identidadAdjunto, partir, unir, nombreSeguro, encajar, TOPE_PARTE, TOPE_TOTAL
} from '../assets/js/domain/fichas_adjunto.js';
import { leerHojaAdjunta, estructuraSana } from '../assets/js/ui/fichas/diagrama-operativo-lector.js';
import { planoHomologado, svgDeHoja, calendarioDe } from '../assets/js/ui/fichas/diagrama-operativo-dibujo.js';
import { cajaOperativo } from '../assets/js/ui/fichas/diagrama-operativo-hoja.js';
import { CAJA_OPERATIVO } from '../assets/js/ui/fichas/diagrama-operativo-panel.js';
import { exportarFichaPlanificacion, HOJAS_EXTRA } from '../assets/js/ui/fichas/exportar-planificacion.js';
import { leerLibroParaVista } from '../assets/js/ui/fichas/vista-previa-excel.js';
import { HOJAS_SALUD, HOJAS_FICHA } from '../assets/js/ui/fichas/panel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(__dirname, '..', 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');
before(() => { globalThis.__sgmJSZip = JSZip; });
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const EQ = { subestacion: 'SUBESTACION DE PRUEBA', serie: 'S-0001', matricula: 'T0-PRUEBA', zona: 'OCCIDENTE', mva: 30, kv_prim: 110, kv_sec: 13.8, regulacion: 'OLTC', fases: 3 };

/* ── un libro .xlsx mínimo, armado en la prueba ─────────────────────────────── */
async function libroMinimo({ hoja, compartidos = [], estilos, definidos = '', wbPr = '', dibujo = null }) {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + wbPr + '<sheets><sheet name="Cronograma" sheetId="1" r:id="rId1"/></sheets>' + definidos + '</workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
  z.file('xl/styles.xml', estilos);
  z.file('xl/sharedStrings.xml', '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + compartidos.map((t) => '<si><t>' + t + '</t></si>').join('') + '</sst>');
  z.file('xl/worksheets/sheet1.xml', hoja);
  if (dibujo) {
    z.file('xl/worksheets/_rels/sheet1.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
    z.file('xl/drawings/drawing1.xml', dibujo.xml);
    z.file('xl/drawings/_rels/drawing1.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + dibujo.media + '"/></Relationships>');
    z.file('xl/media/' + dibujo.media, new Uint8Array([1, 2, 3, 4]));
  }
  return z.generateAsync({ type: 'uint8array' });
}
const ESTILOS = '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>'
  + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF92D050"/></patternFill></fill></fills>'
  + '<borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>'
  + '<cellXfs count="4"><xf fontId="0" fillId="0" borderId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/>'
  + '<xf fontId="0" fillId="2" borderId="1"/><xf fontId="1" fillId="0" borderId="1"><alignment horizontal="center" wrapText="1"/></xf></cellXfs></styleSheet>';
const col = (i) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
function gantt(dias = 20, { titulo = 'CRONOGRAMA DE PRUEBA', extra = '' } = {}) {
  const fechas = Array.from({ length: dias }, (_, i) => '<c r="' + col(2 + i) + '2" s="1"><v>' + (46216 + i) + '</v></c>').join('');
  const barras = Array.from({ length: 5 }, (_, i) => '<c r="' + col(4 + i) + '3" s="2"/>').join('');
  return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="2" max="2" width="40" customWidth="1"/></cols><sheetData>'
    + '<row r="1"><c r="A1" s="3" t="s"><v>0</v></c></row>'
    + '<row r="2"><c r="A2" s="3" t="s"><v>1</v></c><c r="B2" s="3" t="s"><v>2</v></c>' + fechas + '</row>'
    + '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c>' + barras + '</row>'
    + '</sheetData><mergeCells count="1"><mergeCell ref="A1:' + col(1 + dias) + '1"/></mergeCells>' + extra + '</worksheet>';
}
const COMPARTIDOS = ['CRONOGRAMA DE PRUEBA', 'Ítem', 'Actividad', '1', 'Actividad &lt;script&gt;alert(1)&lt;/script&gt; &amp; "x"'];

describe('Reglas puras del adjunto', () => {
  test('el tipo sale de los BYTES, no de la extensión', () => {
    const conCabeza = (...b) => { const u = new Uint8Array(16); u.set(b, 0); return u; };
    assert.equal(tipoPorBytes(conCabeza(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)), 'png');
    assert.equal(tipoPorBytes(conCabeza(0xFF, 0xD8, 0xFF)), 'jpeg');
    assert.equal(tipoPorBytes(conCabeza(0x50, 0x4B, 0x03, 0x04)), 'zip');
    assert.equal(tipoPorBytes(conCabeza(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)), 'ole');
    assert.equal(tipoPorBytes(conCabeza(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63)), 'heic');
    assert.equal(tipoPorBytes(new TextEncoder().encode('<svg xmlns="x"></svg>')), null);
    assert.match(clasificarArchivo(conCabeza(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)).mensaje, /xlsx/);
    assert.match(clasificarArchivo(new TextEncoder().encode('<html><script>x</script></html>')).mensaje, /Excel|imágenes/);
    assert.equal(clasificarArchivo(conCabeza(0x50, 0x4B, 0x03, 0x04)).clase, 'excel');
    assert.match(clasificarArchivo(new Uint8Array(0)).mensaje, /vacío/);
  });
  test('la identidad es la persistente: el mismo equipo desde el parque vivo o el listado da el MISMO id', async () => {
    const vivo = await identidadAdjunto({ id: 'Xa9firestore', matricula: 'T1-M/M-ARJ', serie: 'S1' });
    const listado = await identidadAdjunto({ matricula: ' t1-m/m-arj ', codigo: 'ARJONA', fila: 12 });
    assert.equal(vivo.id, listado.id);
    assert.match(vivo.id, /^salud_[0-9a-f]{64}$/);
    assert.equal(vivo.clave, 'M:T1-M/M-ARJ');
    assert.equal(await identidadAdjunto({ codigo: 'ARJONA', fila: 3 }), null);
    assert.equal((await identidadAdjunto({ serie: 'ab-1' })).clave, 'S:AB-1');
  });
  test('partir y unir devuelven los mismos bytes; más de 2,6 MB no se guarda', () => {
    const b = new Uint8Array(TOPE_PARTE * 2 + 5).map((_, i) => i % 251);
    const p = partir(b);
    assert.equal(p.length, 3);
    assert.deepEqual(unir(p), b);
    assert.throws(() => partir(new Uint8Array(TOPE_TOTAL + 1)), /2,6 MB/);
  });
  test('nombre de archivo sin rutas ni marcas; encajar sin deformar ni agrandar más de 1,5', () => {
    assert.equal(nombreSeguro('C:\\x\\<img onerror=1>.xlsx'), 'img onerror=1.xlsx');
    assert.equal(nombreSeguro(''), 'adjunto');
    assert.deepEqual(encajar(2000, 1000, { w: 1226, h: 611 }), { ancho: 1222, alto: 611, escala: 0.611 });
    assert.equal(encajar(100, 50, { w: 1226, h: 611 }).ancho, 150);
  });
});

describe('Lector del Excel adjunto', () => {
  test('lee un cronograma: fechas, relleno de barras, combinada del título', async () => {
    const m = await leerHojaAdjunta(await libroMinimo({ hoja: gantt(20), compartidos: COMPARTIDOS, estilos: ESTILOS }));
    assert.equal(m.hoja, 'Cronograma');
    assert.equal(m.columnas.length, 22);
    const fechas = m.celdas.filter((c) => c.esFecha);
    assert.equal(fechas.length, 20);
    assert.equal(fechas[0].texto, '13/07/2026');
    assert.ok(m.celdas.some((c) => c.relleno === '#92D050'));
    assert.deepEqual(m.combinadas[0], { c0: 0, r0: 0, c1: 21, r1: 0 });
    assert.deepEqual(m.inventario, []);
  });
  test('la plantilla oficial: el logo EMF va al INVENTARIO (no se omite en silencio)', async () => {
    const m = await leerHojaAdjunta(readFileSync(PLANTILLA), { hoja: 'Diagrama Actual' });
    assert.equal(m.hoja, 'Diagrama Actual');
    assert.ok(m.inventario.some((t) => /EMF/.test(t)), m.inventario.join(' | '));
    assert.ok(m.imagenes.length >= 1);
  });
  test('una hoja desmesurada se rechaza pidiendo un área de impresión', async () => {
    const hoja = gantt(5).replace('<mergeCell ref="A1:G1"/>', '<mergeCell ref="A1:XFD1"/>');
    await assert.rejects(leerHojaAdjunta(await libroMinimo({ hoja, compartidos: COMPARTIDOS, estilos: ESTILOS })), /área de impresión/);
  });
  test('un zip que no es Excel se rechaza', async () => {
    const z = new JSZip(); z.file('hola.txt', 'x');
    await assert.rejects(leerHojaAdjunta(await z.generateAsync({ type: 'uint8array' })), /no es un libro de Excel/);
  });
});

describe('Dibujo homologado', () => {
  test('un cronograma ancho se homologa: días angostos y fecha en vertical', async () => {
    const m = await leerHojaAdjunta(await libroMinimo({ hoja: gantt(40), compartidos: COMPARTIDOS, estilos: ESTILOS }));
    assert.deepEqual(calendarioDe(m), { fila: 1, c0: 2, c1: 41 });
    const p = planoHomologado(m, { w: 900, h: 400 });
    assert.equal(p.compactado, true);
    assert.equal(p.vertical.size, 40);
    assert.ok(p.columnas[2] < m.columnas[2]);
    assert.ok(p.letraPrevista >= 6);
  });
  test('uno que ya cabe no se toca', async () => {
    const m = await leerHojaAdjunta(await libroMinimo({ hoja: gantt(8), compartidos: COMPARTIDOS, estilos: ESTILOS }));
    const p = planoHomologado(m, { w: 1226, h: 611 });
    assert.equal(p.compactado, false);
    assert.deepEqual(p.columnas, m.columnas);
  });
  test('el texto del archivo NO se vuelve marca: sin etiquetas inyectadas, colores validados', async () => {
    const m = await leerHojaAdjunta(await libroMinimo({ hoja: gantt(8), compartidos: COMPARTIDOS, estilos: ESTILOS }));
    const { svg } = svgDeHoja(m, planoHomologado(m, { w: 1226, h: 611 }));
    assert.doesNotMatch(svg, /<script/i);
    assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;x&quot;/);
    assert.doesNotMatch(svg, /fill="(?!#[0-9A-F]{6}"|none")/i);
  });
});

/* ── la hoja en el Excel ─────────────────────────────────────────────────────── */
async function paqueteSano(z) {
  const nombres = new Set(Object.keys(z.files).filter((n) => !z.files[n].dir));
  const faltan = [];
  for (const n of [...nombres].filter((x) => x.endsWith('.rels'))) {
    const base = n === '_rels/.rels' ? '' : n.replace(/_rels\/([^/]+)\.rels$/, '$1').replace(/[^/]*$/, '');
    for (const m of (await z.file(n).async('string')).matchAll(/<Relationship\b[^>]*\/>/g)) {
      if (/TargetMode="External"/.test(m[0])) continue;
      const t = m[0].match(/Target="([^"]+)"/)[1];
      const out = [];
      for (const p of (t.startsWith('/') ? t.slice(1) : base + t).split('/')) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
      if (!nombres.has(out.join('/'))) faltan.push(n + ' → ' + t);
    }
  }
  const ct = await z.file('[Content_Types].xml').async('string');
  for (const m of ct.matchAll(/PartName="\/([^"]+)"/g)) if (!nombres.has(m[1])) faltan.push('Override sin parte: ' + m[1]);
  return faltan;
}
const SALUD = { titulo: 'Salud', kpis: [], columnas: [], filas: [], leyenda: [], puntos: [], png: PNG };
async function exportar(estado, avisos = []) {
  const b = await exportarFichaPlanificacion(EQ, estado, { plantillaBuffer: readFileSync(PLANTILLA), tipoSalida: 'uint8array', avisos });
  return JSZip.loadAsync(b);
}

describe('La hoja «Diagrama Operativo» en el Excel de Mantenimiento', () => {
  test('el marco que usa la pantalla es el de la plantilla (1226 × 611)', async () => {
    const z = await JSZip.loadAsync(readFileSync(PLANTILLA));
    assert.deepEqual(cajaOperativo(await z.file('xl/worksheets/sheet3.xml').async('string')), { ...CAJA_OPERATIVO });
  });
  test('va al final, con su marco, su imagen dentro del área, pies «de 5» y el paquete sano', async () => {
    const z = await exportar({ plan: { proyecto: 'P' }, saludRiesgo: SALUD, sinHojaBeneficios: true,
      diagramaOperativo: { bytes: PNG, mime: 'image/png', ancho: 1000, alto: 400 } });
    const m = await leerLibroParaVista(z);
    assert.deepEqual(m.hojas.map((h) => h.nombre), ['Ficha Técnica', 'Diagrama Actual', 'Diagrama Futuro', 'Salud y riesgo', 'Diagrama Operativo']);
    assert.deepEqual(m.ocultos, []);
    const op = m.hojas[4];
    assert.ok(op.celdas.some((c) => c.texto === 'DIAGRAMA OPERATIVO'));
    assert.ok(op.celdas.some((c) => c.texto === 'Pág. 5 de 5'));
    assert.ok(m.hojas[0].celdas.some((c) => c.texto === 'Pág 1 de 5'));
    const img = op.imagenes.find((i) => /image\d+\.png$/.test(i.ruta) && Math.round(i.w) === 1000);
    assert.ok(img, JSON.stringify(op.imagenes.map((i) => [i.ruta, i.w, i.h])));
    assert.equal(Math.round(img.h), 400);
    const wb = await z.file('xl/workbook.xml').async('string');
    assert.match(wb, /<definedName name="_xlnm\.Print_Area" localSheetId="4">'Diagrama Operativo'!\$B\$2:\$R\$56<\/definedName>/);
    assert.equal(new Set([...wb.matchAll(/sheetId="(\d+)"/g)].map((x) => x[1])).size, 5);
    assert.deepEqual(await paqueteSano(z), []);
  });
  test('una imagen JPEG declara su tipo en el paquete', async () => {
    const JPG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xFF, 0xD9]);
    const z = await exportar({ plan: {}, saludRiesgo: SALUD, sinHojaBeneficios: true, diagramaOperativo: { bytes: JPG, mime: 'image/jpeg', ancho: 600, alto: 300 } });
    assert.match(await z.file('[Content_Types].xml').async('string'), /<Default Extension="jpeg" ContentType="image\/jpeg"\/>/);
    assert.deepEqual(await paqueteSano(z), []);
  });
  test('sin adjunto no sale y el libro queda como hoy; con un adjunto inválido, sale sin ella y avisa', async () => {
    const sin = await leerLibroParaVista(await exportar({ plan: {}, saludRiesgo: SALUD, sinHojaBeneficios: true }));
    assert.deepEqual(sin.hojas.map((h) => h.nombre), ['Ficha Técnica', 'Diagrama Actual', 'Diagrama Futuro', 'Salud y riesgo']);
    const avisos = [];
    const mal = await leerLibroParaVista(await exportar({ plan: {}, saludRiesgo: SALUD, sinHojaBeneficios: true, diagramaOperativo: { bytes: PNG, mime: 'image/gif', ancho: 10, alto: 10 } }, avisos));
    assert.equal(mal.hojas.length, 4);
    assert.match(avisos.join(' '), /Diagrama Operativo/);
  });
  test('la marca contra la caché mezclada y la pestaña solo en Mantenimiento', () => {
    assert.ok(HOJAS_EXTRA.includes('Diagrama Operativo'));
    assert.ok(HOJAS_SALUD.some((h) => h.id === 'operativo'));
    assert.ok(!HOJAS_FICHA.some((h) => h.id === 'operativo'));
    assert.equal(HOJAS_SALUD[HOJAS_SALUD.length - 1].id, 'plan');
  });
});

describe('Revisión §112: blindaje y más formas de cronograma', () => {
  test('un XML con etiquetas sin cerrar o demasiadas se rechaza al instante (sin congelar)', async () => {
    assert.equal(estructuraSana('<row r="1"><c r="A1"/></row><row r="2"/><rowBreaks/>', 'row', 10), '');
    assert.equal(estructuraSana('<row r="1">'.repeat(5), 'row', 10), 'dañada');
    const t0 = Date.now();
    assert.equal(estructuraSana('<row r="1">'.repeat(240000), 'row', 50000), 'demasiadas');
    assert.ok(Date.now() - t0 < 1000);
    const hoja = gantt(5).replace('</sheetData>', '<row r="9">'.repeat(3000) + '</sheetData>');
    await assert.rejects(leerHojaAdjunta(await libroMinimo({ hoja, compartidos: COMPARTIDOS, estilos: ESTILOS })), /dañado/);
  });
  test('días numerados 1..31 (con reinicio de mes) y semanas «S1…» también se homologan', async () => {
    const dias = Array.from({ length: 40 }, (_, i) => '<c r="' + col(2 + i) + '2"><v>' + (((i + 20) % 31) + 1) + '</v></c>').join('');
    const hojaNum = gantt(2).replace(/<row r="2">[\s\S]*?<\/row>/, '<row r="2"><c r="A2" t="s"><v>1</v></c>' + dias + '</row>');
    const m = await leerHojaAdjunta(await libroMinimo({ hoja: hojaNum, compartidos: COMPARTIDOS, estilos: ESTILOS }));
    assert.deepEqual(calendarioDe(m), { fila: 1, c0: 2, c1: 41 });
    const sems = COMPARTIDOS.concat(Array.from({ length: 30 }, (_, i) => 'S' + (i + 1)));
    const celdasSem = Array.from({ length: 30 }, (_, i) => '<c r="' + col(2 + i) + '2" t="s"><v>' + (COMPARTIDOS.length + i) + '</v></c>').join('');
    const hojaSem = gantt(2).replace(/<row r="2">[\s\S]*?<\/row>/, '<row r="2"><c r="A2" t="s"><v>1</v></c>' + celdasSem + '</row>');
    const m2 = await leerHojaAdjunta(await libroMinimo({ hoja: hojaSem, compartidos: sems, estilos: ESTILOS }));
    assert.deepEqual(calendarioDe(m2), { fila: 1, c0: 2, c1: 31 });
  });
  test('las columnas ocultas del calendario siguen ocultas al homologar', async () => {
    const hoja = gantt(40).replace('<cols>', '<cols><col min="5" max="6" width="9" hidden="1"/>');
    const m = await leerHojaAdjunta(await libroMinimo({ hoja, compartidos: COMPARTIDOS, estilos: ESTILOS }));
    assert.equal(m.columnas[4], 0);
    const p = planoHomologado(m, { w: 900, h: 400 });
    assert.equal(p.compactado, true);
    assert.equal(p.columnas[4], 0);
    assert.equal(p.columnas[5], 0);
  });
  test('un libro con fechas de 1904 muestra la fecha correcta', async () => {
    const hoja = gantt(8).replace(/<v>46216<\/v>/, '<v>' + (46216 - 1462) + '</v>');
    const m = await leerHojaAdjunta(await libroMinimo({ hoja, compartidos: COMPARTIDOS, estilos: ESTILOS, wbPr: '<workbookPr date1904="1"/>' }));
    assert.equal(m.celdas.find((c) => c.r === 1 && c.c === 2).texto, '13/07/2026');
  });
  test('una hoja que solo trae una imagen EMF dice qué pasa (no «vacía»)', async () => {
    const hoja = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData/><drawing r:id="rId1"/></worksheet>';
    const xml = '<xdr:wsDr xmlns:xdr="x" xmlns:a="a" xmlns:r="r"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="952500" cy="952500"/><xdr:pic><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
    await assert.rejects(leerHojaAdjunta(await libroMinimo({ hoja, estilos: ESTILOS, dibujo: { xml, media: 'image1.emf' } })), /EMF[\s\S]*Copiar como imagen/);
  });
});

