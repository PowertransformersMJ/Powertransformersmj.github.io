// CF-40 (`99 §112.8`): el lector del Excel adjunto no puede trabar la página.
// La verificación del cerebro halló el ReDoS abierto por `styles.xml` y por el
// ORDEN de las etiquetas; L-106: se prueba la CLASE, no el ejemplo. Aquí: la
// revisión estructural lineal, cada forma hostil conocida, la bomba con el
// tamaño falseado, las imágenes gigantes, el trabajador con tiempo límite y que
// el dibujo del trabajador sea el mismo de la página. Sin datos reales.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { revisarXml, leerParteAcotada, textoUtf8, textoParte, aBase64, dimensionesImagen, NO_ANIDAN } from '../assets/js/ui/fichas/diagrama-operativo-xml.js';
import { leerHojaAdjunta, hojasDelLibro, TOPES } from '../assets/js/ui/fichas/diagrama-operativo-lector.js';
import { planoHomologado, svgDeHoja } from '../assets/js/ui/fichas/diagrama-operativo-dibujo.js';
import { leerEnTrabajador, trabajo, medidorFuera, MENSAJE_TIEMPO, TIEMPO_LIMITE, mensaje, revisarPesoSvg, PESO_SVG } from '../assets/js/ui/fichas/diagrama-operativo-seguro.js';

before(() => { globalThis.__sgmJSZip = JSZip; });

/* ── un libro .xlsx armado en la prueba ─────────────────────────────────────── */
const CT = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>';
const RELS = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
const WB = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="H" sheetId="1" r:id="rId1"/></sheets></workbook>';
const WBR = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
const EST = '<styleSheet><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF92D050"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf/><xf fillId="1"/></cellXfs></styleSheet>';
const H = (d, extra = '') => '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>' + d + '</sheetData>' + extra + '</worksheet>';
const FILA = '<row r="1"><c r="A1" t="str"><v>Actividad</v></c><c r="B1" s="1"/></row>';
async function libro({ estilos = EST, hoja = H(FILA), extra = null } = {}) {
  const z = new JSZip();
  z.file('[Content_Types].xml', CT); z.file('_rels/.rels', RELS); z.file('xl/workbook.xml', WB); z.file('xl/_rels/workbook.xml.rels', WBR);
  z.file('xl/styles.xml', estilos); z.file('xl/worksheets/sheet1.xml', hoja);
  if (extra) extra(z);
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
/** Mide el tiempo de una lectura: {ms, error|null, modelo|null}. */
async function medir(bytes) {
  const t0 = performance.now();
  try { const modelo = await leerHojaAdjunta(bytes); return { ms: performance.now() - t0, error: null, modelo }; } catch (e) { return { ms: performance.now() - t0, error: e.message, modelo: null }; }
}
const RAPIDO = 1500;   // ms: holgado para CI; el código viejo tardaba de 5 a 23 s con estos mismos archivos

describe('revisarXml: una pasada lineal que exige estructura sana', () => {
  test('acepta XML sano: vacías, comentarios, declaración, atributos con comillas simples', () => {
    for (const x of ['<?xml version="1.0"?><a><b/><c x=\'1\'>t</c><!-- nota --></a>', '<a></a>', 'texto sin etiquetas', '<a  >x</a >']) {
      assert.equal(revisarXml(x).error, '', x);
    }
  });
  test('un «>» crudo dentro de comillas (Excel real lo escribe) se acepta y sale escrito «&gt;»', () => {
    const r = revisarXml('<a f="[>=100]0" g=\'x>y\'>b > c</a>');
    assert.equal(r.error, '');
    assert.equal(r.xml, '<a f="[&gt;=100]0" g=\'x&gt;y\'>b > c</a>');   // el «>» del texto no se toca
  });
  test('rechaza: sin cerrar, cierre fuera de orden, cierre de otro nombre, cierre sin apertura', () => {
    for (const x of ['<a><b></a>', '</row><row>', '<a><b></a></b>', '</a>', '<a>', '<a x="1"', '<a x="<">']) {
      assert.equal(revisarXml(x).error, 'dañada', x);
    }
  });
  test('comentarios e instrucciones salen del XML (ninguna regex los ve); CDATA queda como texto escapado; DOCTYPE se rechaza', () => {
    assert.deepEqual(revisarXml('<?xml version="1.0"?><a><!-- <font <font --><b/><?x <y ?></a>'), { error: '', xml: '<a><b/></a>' });
    assert.deepEqual(revisarXml('<si><t><![CDATA[a<b & c>d]]></t></si>'), { error: '', xml: '<si><t>a&lt;b &amp; c&gt;d</t></si>' });
    for (const x of ['<!DOCTYPE a><a/>', '<a><!-- sin cerrar</a>', '<a><![CDATA[x</a>', '<?x']) assert.equal(revisarXml(x).error, 'dañada', x);
  });
  test('el mismo nombre anidado se rechaza SOLO en los elementos que el lector recorre buscando su cierre', () => {
    assert.equal(revisarXml('<fonts><font><font/></font></fonts>').error, '');   // vacía: no anida
    assert.equal(revisarXml('<fonts><font><font></font></font></fonts>').error, 'dañada');
    assert.equal(revisarXml('<row><c><c></c></c></row>').error, 'dañada');
    // Una ecuación de Excel (Office Math) anida m:e dentro de m:e; los grupos de formas, igual.
    assert.equal(revisarXml('<a14:m><m:oMath><m:e><m:d><m:e>x</m:e></m:d></m:e><m:f><m:num><m:f/></m:num></m:f></m:oMath></a14:m>').error, '');
    assert.equal(revisarXml('<xdr:grpSp><xdr:grpSp></xdr:grpSp></xdr:grpSp>').error, '');
    assert.ok(NO_ANIDAN.has('xdr:twoCellAnchor') && !NO_ANIDAN.has('m:e'));
  });
  test('una parte en UTF-16 (con su marca) se lee; en UTF-8 conserva el BOM como JSZip', () => {
    const u16 = (t, be) => { const b = new Uint8Array(2 + t.length * 2); b[0] = be ? 0xFE : 0xFF; b[1] = be ? 0xFF : 0xFE; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); b[2 + i * 2 + (be ? 1 : 0)] = c & 255; b[2 + i * 2 + (be ? 0 : 1)] = c >> 8; } return b; };
    assert.equal(textoParte(u16('<a>ñ</a>')), '<a>ñ</a>');
    assert.equal(textoParte(u16('<a>ñ</a>', true)), '<a>ñ</a>');
    assert.equal(textoParte(Uint8Array.from([0xEF, 0xBB, 0xBF, 0x61])), '\uFEFFa');
  });
  test('rechaza nombres que no son de Excel («-», «.», doble prefijo)', () => {
    for (const x of ['<font-x/>', '<a.b></a.b>', '<a:b:c/>', '<1a/>']) assert.equal(revisarXml(x).error, 'dañada', x);
  });
  test('topes: demasiadas etiquetas y demasiada profundidad', () => {
    assert.equal(revisarXml('<a/>'.repeat(11), { maxEtiquetas: 10 }).error, 'demasiadas');
    assert.equal(revisarXml('<row>'.repeat(3) + '</row>'.repeat(3)).error, 'dañada');   // mismo nombre, de los que se recorren
    let x = ''; for (let i = 0; i < 300; i++) x += '<n' + i + '>'; for (let i = 299; i >= 0; i--) x += '</n' + i + '>';
    assert.equal(revisarXml(x).error, 'dañada');
  });
  test('es lineal: 1.000.000 de etiquetas en menos de un segundo', () => {
    const x = '<sheetData>' + '<row r="1"><c r="A1"><v>1</v></c></row>'.repeat(250000) + '</sheetData>';
    const t0 = performance.now(); assert.equal(revisarXml(x).error, ''); assert.ok(performance.now() - t0 < 1000, 'tardó ' + (performance.now() - t0));
  });
});

describe('lector: cada forma hostil conocida se resuelve rápido (la CLASE, L-106)', () => {
  const N = 80000;
  const casos = [
    ['styles.xml con miles de <font> sin cerrar (el hallazgo de la verificación)', () => libro({ estilos: '<styleSheet><fonts>' + '<font>'.repeat(N) + '</fonts></styleSheet>' }), /dañado/],
    ['cierres ANTES que aperturas: la cuenta cuadra, el orden no', () => libro({ hoja: H('</row>'.repeat(20000) + '<row r="1" spans="1:1">'.repeat(20000)) }), /dañado/],
    ['<c:x> no se confunde con una celda <c>', () => libro({ hoja: H('<row r="1">' + '<c:x></c:x>'.repeat(N) + '</row>') }), /vacía/],
    ['<font> dentro de <font> (anidado del mismo nombre)', () => libro({ estilos: '<styleSheet><fonts>' + '<font>'.repeat(5000) + '</font>'.repeat(5000) + '</fonts></styleSheet>' }), /dañado/],
    ['CDATA con miles de «<font» (queda como texto)', () => libro({ estilos: '<styleSheet><fonts><![CDATA[' + '<font'.repeat(N) + ']]></fonts></styleSheet>' }), null],
    ['comentario con miles de «<font» (sale del XML)', () => libro({ estilos: '<styleSheet><fonts><!--' + '<font'.repeat(N) + '--></fonts></styleSheet>' }), null],
    ['miles de <fonts/> vacías antes del bloque de fuentes', () => libro({ estilos: '<styleSheet>' + '<fonts/>'.repeat(N) + '<fonts><font><sz val="11"/></font></fonts></styleSheet>' }), null],
    ['miles de <rPh/> vacías en un texto', () => libro({ hoja: H('<row r="1"><c r="A1" t="inlineStr"><is><t>a</t>' + '<rPh/>'.repeat(N) + '</is></c></row>') }), null],
    ['celdas con «>» crudo en un atributo y vacías', () => libro({ hoja: H('<row r="1">' + '<c r="A1" t="x>y"/>'.repeat(N) + '</row>') }), /vacía|dañado/],
    ['miles de definiciones de columnas', () => libro({ hoja: '<worksheet><cols>' + '<col min="1" max="16384" width="9"/>'.repeat(16384) + '</cols><sheetData>' + FILA + '</sheetData></worksheet>' }), null],
  ];
  for (const [nombre, hacer, esperado] of casos) {
    test(nombre, async () => {
      const r = await medir(await hacer());
      assert.ok(r.ms < RAPIDO, 'tardó ' + Math.round(r.ms) + ' ms');
      if (esperado) assert.match(r.error || 'LEYÓ', esperado);
      else assert.equal(r.error, null, r.error);
    });
  }
  test('más definiciones de columnas que columnas tiene Excel: dañado', async () => {
    const r = await medir(await libro({ hoja: '<worksheet><cols>' + '<col min="1" max="1" width="9"/>'.repeat(16385) + '</cols><sheetData>' + FILA + '</sheetData></worksheet>' }));
    assert.match(r.error, /dañado/);
  });
});

describe('bomba de descompresión con el tamaño FALSEADO', () => {
  /** Pone 1000 como tamaño descomprimido de UNA entrada, en su cabecera local y en la central. */
  function falsear(u, ruta) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); const td = new TextDecoder();
    for (let p = 0; p < u.length - 46; p++) {
      const sig = dv.getUint32(p, true);
      if (sig === 0x04034b50 && td.decode(u.subarray(p + 30, p + 30 + dv.getUint16(p + 26, true))) === ruta) dv.setUint32(p + 22, 1000, true);
      if (sig === 0x02014b50 && td.decode(u.subarray(p + 46, p + 46 + dv.getUint16(p + 28, true))) === ruta) dv.setUint32(p + 24, 1000, true);
    }
    return u;
  }
  test('una hoja de 200 MB reales que declara 1 KB se corta al pasar el tope, sin inflarla entera', async () => {
    const cuerpo = new Uint8Array(200 * 1024 * 1024).fill(32); cuerpo.set(new TextEncoder().encode('<worksheet><sheetData>'), 0);
    const u = falsear(await libro({ hoja: cuerpo }), 'xl/worksheets/sheet1.xml');
    assert.ok(u.length < 1024 * 1024, 'el archivo pesa menos de 1 MB');
    const r = await medir(u);
    assert.match(r.error, /demasiado grande por dentro/);
    assert.ok(r.ms < RAPIDO, 'tardó ' + Math.round(r.ms) + ' ms');
  });
  test('leerParteAcotada cuenta los bytes reales y avisa `excede`', async () => {
    const z = new JSZip(); z.file('a.txt', 'x'.repeat(5000));
    await assert.rejects(leerParteAcotada(z.file('a.txt'), 1000), (e) => e.excede === true);
    assert.equal((await leerParteAcotada(z.file('a.txt'), 10000)).length, 5000);
  });
});

describe('imágenes pegadas: se miden por la cabecera antes de dibujarlas', () => {
  const png = (w, h) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };
  test('PNG, GIF y JPEG (también progresivo)', () => {
    assert.deepEqual(dimensionesImagen(png(640, 480)), { w: 640, h: 480 });
    assert.deepEqual(dimensionesImagen(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02, ...new Array(20).fill(0)])), { w: 800, h: 600 });
    const jpg = (sof) => Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 0, 0, 0xFF, sof, 0, 17, 8, 0x04, 0xB0, 0x06, 0x40, ...new Array(12).fill(0)]);
    assert.deepEqual(dimensionesImagen(jpg(0xC0)), { w: 1600, h: 1200 });
    assert.deepEqual(dimensionesImagen(jpg(0xC2)), { w: 1600, h: 1200 });
    assert.equal(dimensionesImagen(Uint8Array.from([1, 2, 3])), null);
  });
  test('una imagen que declara 40.000 × 40.000 px no se dibuja: va al inventario', async () => {
    const dib = '<xdr:wsDr xmlns:xdr="x" xmlns:a="a" xmlns:r="r"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="952500" cy="952500"/><xdr:pic><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
    const u = await libro({
      hoja: H(FILA, '<drawing r:id="rId1"/>'),
      extra: (z) => {
        z.file('xl/worksheets/_rels/sheet1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
        z.file('xl/drawings/drawing1.xml', dib);
        z.file('xl/drawings/_rels/drawing1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>');
        z.file('xl/media/image1.png', png(40000, 40000));
      }
    });
    const r = await medir(u);
    assert.equal(r.error, null, r.error);
    assert.equal(r.modelo.imagenes.length, 0);
    assert.ok(r.modelo.inventario.some((t) => /demasiado grande \(40000 × 40000 px\)/.test(t)), r.modelo.inventario.join(' | '));
  });
  test('aBase64 da lo mismo que la codificación estándar; textoUtf8 conserva el BOM (como JSZip)', () => {
    const b = new Uint8Array(100000); for (let i = 0; i < b.length; i++) b[i] = (i * 31) & 255;
    assert.equal(aBase64(b), Buffer.from(b).toString('base64'));
    assert.equal(textoUtf8(Uint8Array.from([0xEF, 0xBB, 0xBF, 0x61])), '﻿a');
  });
  test('un ancla que dice la fila 999.999.999 se ignora (antes obligaba a sumar mil millones de filas)', async () => {
    const dib = '<xdr:wsDr xmlns:xdr="x" xmlns:a="a"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>999999999</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>999999999</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:sp><xdr:spPr><a:prstGeom prst="rect"/></xdr:spPr></xdr:sp><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';
    const u = await libro({
      hoja: H(FILA, '<drawing r:id="rId1"/>'),
      extra: (z) => {
        z.file('xl/worksheets/_rels/sheet1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
        z.file('xl/drawings/drawing1.xml', dib);
      }
    });
    const r = await medir(u);
    assert.equal(r.error, null, r.error); assert.ok(r.ms < RAPIDO); assert.equal(r.modelo.formas.length, 0);
  });
});

describe('trabajador con tiempo límite (la página nunca se traba)', () => {
  /** Un Worker de mentira: `guion` decide qué hace al crearse y al recibir la orden. */
  function falso(guion) {
    const creados = [];
    class W {
      constructor(url, op) { this.url = String(url); this.op = op; this.terminado = false; creados.push(this); setTimeout(() => guion.alCrear && guion.alCrear(this), 0); }
      postMessage(m) { this.orden = m; setTimeout(() => guion.alRecibir && guion.alRecibir(this, m), 0); }
      terminate() { this.terminado = true; }
      responder(d) { if (!this.terminado && this.onmessage) this.onmessage({ data: d }); }
      listo() { this.responder(mensaje('listo')); }
      fallar(msg) { if (!this.terminado && this.onerror) this.onerror({ message: msg, preventDefault() {} }); }
    }
    return { W, creados };
  }
  test('se crea como trabajador de MÓDULO desde su propio archivo', async () => {
    const { W, creados } = falso({ alCrear: (w) => w.listo(), alRecibir: (w) => w.responder(mensaje('resultado', { r: { hojas: [] } })) });
    await leerEnTrabajador({ tipo: 'hojas', bytes: new Uint8Array(1) }, { Worker: W });
    assert.match(creados[0].url, /diagrama-operativo-trabajador\.js$/);
    assert.deepEqual(creados[0].op, { type: 'module' });
    assert.equal(creados[0].terminado, true, 'se cierra al terminar');
  });
  test('si se demora más del límite: se TERMINA y avisa con el mensaje de tiempo (sin caer a la página)', async () => {
    const { W, creados } = falso({ alCrear: (w) => w.listo() /* y nunca contesta la orden */ });
    await assert.rejects(leerEnTrabajador({ tipo: 'leer', bytes: new Uint8Array(1), caja: { w: 1, h: 1 } }, { Worker: W, limite: 50 }), (e) => e.tiempo === true && e.message === MENSAJE_TIEMPO);
    assert.equal(creados[0].terminado, true);
    assert.equal(TIEMPO_LIMITE, 20000);
  });
  test('el error del lector llega tal cual (mensaje en español)', async () => {
    const { W } = falso({ alCrear: (w) => w.listo(), alRecibir: (w) => w.responder(mensaje('error', { mensaje: 'La hoja «H» está vacía.' })) });
    await assert.rejects(leerEnTrabajador({ tipo: 'leer', bytes: new Uint8Array(1) }, { Worker: W }), /La hoja «H» está vacía\./);
  });
  test('si el trabajador ni arranca (navegador viejo): se lee en la página, como antes', async () => {
    const u = await libro();
    const { W } = falso({ alCrear: (w) => w.fallar('SyntaxError: import') });
    const r = await leerEnTrabajador({ tipo: 'leer', bytes: u, caja: { w: 1226, h: 611 } }, { Worker: W });
    assert.equal(r.dibujo, null, 'el dibujo lo hace la página');
    assert.equal(r.modelo.hoja, 'H');
    const r2 = await leerEnTrabajador({ tipo: 'hojas', bytes: u }, { Worker: W });
    assert.deepEqual(r2.hojas.map((h) => h.nombre), ['H']);
  });
  test('si no avisa «listo» a tiempo: también se lee en la página (el archivo aún no se le había dado)', async () => {
    const { W } = falso({});
    const r = await leerEnTrabajador({ tipo: 'hojas', bytes: await libro() }, { Worker: W, cargaLimite: 30 });
    assert.deepEqual(r.hojas.map((h) => h.nombre), ['H']);
  });
  test('si el trabajador no pudo cargar JSZip (sin conexión): se lee en la página, como antes', async () => {
    const { W, creados } = falso({ alCrear: (w) => w.responder(mensaje('noArranco')) });
    const r = await leerEnTrabajador({ tipo: 'hojas', bytes: await libro() }, { Worker: W });
    assert.deepEqual(r.hojas.map((h) => h.nombre), ['H']); assert.equal(creados[0].terminado, true);
  });
  test('mensajes sin la marca, o una respuesta antes de enviar la orden, se ignoran', async () => {
    const { W, creados } = falso({
      alCrear: (w) => { w.responder({ ok: true, r: 'ajeno' }); w.responder(mensaje('resultado', { r: 'antes de la orden' })); w.listo(); },
      alRecibir: (w) => { w.responder('basura'); w.responder(mensaje('resultado', { r: { hojas: ['bien'] } })); }
    });
    assert.deepEqual(await leerEnTrabajador({ tipo: 'hojas', bytes: new Uint8Array(1) }, { Worker: W }), { hojas: ['bien'] });
    assert.equal(creados[0].orden.tipo, 'hojas');
  });
  test('cancelar (se cerró la pestaña o se eligió otro archivo) termina el trabajador', async () => {
    const { W, creados } = falso({ alCrear: (w) => w.listo() /* y se queda leyendo */ });
    const ac = new AbortController();
    const p = leerEnTrabajador({ tipo: 'leer', bytes: new Uint8Array(1) }, { Worker: W, senal: ac.signal });
    setTimeout(() => ac.abort(), 20);
    await assert.rejects(p, (e) => e.cancelado === true);
    assert.equal(creados[0].terminado, true);
    const ya = new AbortController(); ya.abort();
    await assert.rejects(leerEnTrabajador({ tipo: 'leer', bytes: new Uint8Array(1) }, { Worker: W, senal: ya.signal }), (e) => e.cancelado === true);
  });
  test('sin Worker (Node): respaldo en la página', async () => {
    const r = await leerEnTrabajador({ tipo: 'leer', bytes: await libro(), caja: { w: 1226, h: 611 } }, { Worker: null });
    assert.equal(r.modelo.hoja, 'H');
  });
});

describe('el dibujo del trabajador es el MISMO de la página', () => {
  /** Lienzo de mentira que anota cada (letra, texto) medido; el ancho depende de ambos. */
  const anotaciones = [];
  const ctx = () => { let font = ''; return { set font(v) { font = v; }, get font() { return font; }, measureText(t) { anotaciones.push(font + '|' + t); return { width: String(t).length * (font.length % 7 + 5) }; } }; };
  let guardado;
  before(() => { guardado = { d: globalThis.document, o: globalThis.OffscreenCanvas }; });
  after(() => { globalThis.document = guardado.d; globalThis.OffscreenCanvas = guardado.o; });
  test('medidorFuera ≡ medidor(): mismas letras, mismos textos, mismo SVG', async () => {
    const hoja = H('<row r="1" ht="30" customHeight="1"><c r="A1" t="str"><v>DESPLIEGUE DE LOGÍSTICA, EQUIPOS Y MATERIALES</v></c></row><row r="2"><c r="A2" t="str"><v>Toma de muestra</v></c><c r="B2" s="1"/></row>', '<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells>');
    const est = '<styleSheet><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><i/><sz val="12"/><name val="Arial Narrow"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF92D050"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf><alignment wrapText="1"/></xf><xf fontId="1" fillId="1"/></cellXfs></styleSheet>';
    const modelo = await leerHojaAdjunta(await libro({ hoja, estilos: est }));
    const caja = { w: 1226, h: 611 };
    // En la página: document + canvas.
    globalThis.document = { createElement: () => ({ getContext: () => ctx() }) }; delete globalThis.OffscreenCanvas;
    anotaciones.length = 0;
    const pP = planoHomologado(modelo, caja); const sP = svgDeHoja(modelo, pP);
    const enPagina = anotaciones.slice();
    // En el trabajador: sin document, con OffscreenCanvas.
    delete globalThis.document; globalThis.OffscreenCanvas = class { getContext() { return ctx(); } };
    anotaciones.length = 0;
    const medir = medidorFuera(); assert.ok(medir);
    const pT = planoHomologado(modelo, caja, medir); const sT = svgDeHoja(modelo, pT, medir);
    assert.ok(enPagina.length > 0);
    assert.deepEqual(anotaciones, enPagina, 'mismas letras y textos medidos');
    assert.equal(sT.svg, sP.svg, 'mismo SVG');
    // Y `trabajo` (lo que corre el trabajador) devuelve ese mismo SVG.
    const t = await trabajo({ tipo: 'leer', bytes: await libro({ hoja, estilos: est }), caja });
    assert.equal(t.dibujo.svg, sP.svg);
    assert.equal(t.dibujo.plano.letraPrevista, pP.letraPrevista);
  });
  test('sin OffscreenCanvas el trabajador no inventa medidas: devuelve dibujo null', async () => {
    delete globalThis.OffscreenCanvas;
    assert.equal(medidorFuera(), null);
    const t = await trabajo({ tipo: 'leer', bytes: await libro(), caja: { w: 1226, h: 611 } });
    assert.equal(t.dibujo, null);
  });
});

describe('topes nuevos (CF-40)', () => {
  test('textos: 32.767 por celda (lo máximo de Excel) y 1.000.000 en la hoja', () => {
    assert.equal(TOPES.textoCelda, 32767); assert.equal(TOPES.textoTotal, 1000000);
  });
  test('demasiado texto en la hoja: se rechaza con un mensaje claro', async () => {
    const filas = []; for (let r = 1; r <= 130; r++) filas.push('<row r="' + r + '"><c r="A' + r + '" t="str"><v>' + 'x'.repeat(8000) + '</v></c></row>');
    const r = await medir(await libro({ hoja: H(filas.join('')) }));
    assert.match(r.error, /demasiado texto/);
  });
  test('hojasDelLibro también pasa por la revisión estructural', async () => {
    const u = await libro(); const z = await JSZip.loadAsync(u);
    z.file('xl/workbook.xml', '<workbook><sheets><sheet name="H" sheetId="1" r:id="rId1"></sheets></workbook>');
    await assert.rejects(hojasDelLibro(await z.generateAsync({ type: 'uint8array' })), /dañado por dentro \(«libro»\)/);
  });
});

describe('revisión CF-40: lo que la página pinta está acotado y no se rechaza lo legítimo', () => {
  const REL_DIB = '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>';
  const ancla = (i, cuerpo) => '<xdr:oneCellAnchor><xdr:from><xdr:col>' + (i % 10) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + Math.floor(i / 10) + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="190500" cy="190500"/>' + cuerpo + '<xdr:clientData/></xdr:oneCellAnchor>';
  const dibujo = (anclas) => '<xdr:wsDr xmlns:xdr="x" xmlns:a="a" xmlns:r="r">' + anclas.join('') + '</xdr:wsDr>';
  const pngDe = (w, h) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };
  const conDibujo = (xml, extra, hoja = H(FILA, '<drawing r:id="rId1"/>')) => libro({ hoja, extra: (z) => { z.file('xl/worksheets/_rels/sheet1.xml.rels', REL_DIB); z.file('xl/drawings/drawing1.xml', xml); if (extra) extra(z); } });
  test('el texto de los cuadros de texto cuenta en el tope: miles de cuadros llenos se rechazan rápido', async () => {
    const anclas = []; for (let i = 0; i < 250; i++) anclas.push(ancla(i, '<xdr:sp><xdr:spPr><a:prstGeom prst="rect"/></xdr:spPr><xdr:txBody><a:p><a:r><a:t>' + 'x'.repeat(5000) + '</a:t></a:r></a:p></xdr:txBody></xdr:sp>'));
    const r = await medir(await conDibujo(dibujo(anclas)));
    assert.match(r.error, /demasiado texto/); assert.ok(r.ms < RAPIDO);
  });
  test('una imagen usada en 40 anclas se lee y se cuenta UNA vez (el logo repetido)', async () => {
    const pic = '<xdr:pic><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic>';
    const anclas = []; for (let i = 0; i < 40; i++) anclas.push(ancla(i, pic));
    const r = await medir(await conDibujo(dibujo(anclas), (z) => {
      z.file('xl/drawings/_rels/drawing1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>');
      z.file('xl/media/image1.png', pngDe(4000, 3000));   // 12 Mpx: 40 veces serían 480 Mpx
    }));
    assert.equal(r.error, null, r.error); assert.equal(r.modelo.imagenes.length, 40); assert.deepEqual(r.modelo.inventario, []);
  });
  test('una hoja que solo trae una imagen de más de 120 Mpx va como imagen (la pantalla la reduce, como un adjunto suelto)', async () => {
    const pic = '<xdr:pic><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic>';
    const u = await conDibujo(dibujo([ancla(0, pic)]), (z) => {
      z.file('xl/drawings/_rels/drawing1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>');
      z.file('xl/media/image1.png', pngDe(15000, 10000));
    }, H('', '<drawing r:id="rId1"/>'));
    const r = await medir(u);
    assert.equal(r.error, null, r.error); assert.equal(r.modelo.imagenes.length, 1); assert.deepEqual(r.modelo.inventario, []);
  });
  test('una ecuación de Excel en un cuadro de texto no hace rechazar la hoja', async () => {
    const ecu = '<mc:AlternateContent xmlns:mc="mc"><mc:Choice Requires="a14"><xdr:sp><xdr:spPr><a:prstGeom prst="rect"/></xdr:spPr><xdr:txBody><a:p><a14:m><m:oMathPara><m:oMath><m:sSup><m:e><m:d><m:e><m:r><m:t>V</m:t></m:r></m:e></m:d></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:oMath></m:oMathPara></a14:m></a:p></xdr:txBody></xdr:sp></mc:Choice><mc:Fallback><xdr:sp><xdr:spPr><a:prstGeom prst="rect"/></xdr:spPr><xdr:txBody><a:p><a:r><a:t>V²</a:t></a:r></a:p></xdr:txBody></xdr:sp></mc:Fallback></mc:AlternateContent>';
    const r = await medir(await conDibujo(dibujo([ancla(0, ecu)])));
    assert.equal(r.error, null, r.error);
  });
  test('partes grandes pero legítimas (estilos de 6 MB) se leen: solo manda el presupuesto de 50 MB', async () => {
    const fmts = []; for (let i = 0; i < 90000; i++) fmts.push('<numFmt numFmtId="' + (200 + i) + '" formatCode="0.' + '0'.repeat(i % 60) + '"/>');
    const est = '<styleSheet><numFmts count="90000">' + fmts.join('') + '</numFmts>' + EST.slice('<styleSheet>'.length);
    assert.ok(est.length > 5 * 1024 * 1024);
    const r = await medir(await libro({ estilos: est }));
    assert.equal(r.error, null, r.error);
  });
  test('un «>» crudo en el formato de número se lee (antes cortaba la etiqueta y la celda salía en General)', async () => {
    const est = '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="[>=1000]#,##0;0"/></numFmts><fonts count="1"><font><sz val="11"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf/><xf numFmtId="164"/></cellXfs></styleSheet>';
    const r = await medir(await libro({ estilos: est, hoja: H('<row r="1"><c r="A1" s="1"><v>1500</v></c></row>') }));
    assert.equal(r.error, null, r.error);
    assert.notEqual(r.modelo.celdas[0].texto, '1500');   // aplica el formato (con separador de miles)
  });
  test('un código de formato de más de 255 caracteres (Excel no lo admite) se lee como General y no demora', async () => {
    const est = '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="0' + '#'.repeat(100000) + '"/></numFmts><fonts count="1"><font><sz val="11"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf/><xf numFmtId="164"/></cellXfs></styleSheet>';
    const filas = []; for (let r = 1; r <= 1000; r++) filas.push('<row r="' + r + '">' + ['A', 'B', 'C'].map((c) => '<c r="' + c + r + '" s="1"><v>' + r + '</v></c>').join('') + '</row>');
    const r = await medir(await libro({ estilos: est, hoja: H(filas.join('')) }));
    assert.equal(r.error, null, r.error); assert.ok(r.ms < RAPIDO, 'tardó ' + Math.round(r.ms)); assert.equal(r.modelo.celdas[0].texto, '1');
  });
  test('revisarPesoSvg: cuenta elementos y texto, no los datos de las imágenes', () => {
    assert.doesNotThrow(() => revisarPesoSvg('<svg><image href="data:image/png;base64,' + 'A'.repeat(30 * 1024 * 1024) + '"/></svg>'));
    assert.throws(() => revisarPesoSvg('<svg>' + '<text>x</text>'.repeat(PESO_SVG.elementos) + '</svg>'), /demasiado pesada/);
    assert.throws(() => revisarPesoSvg('<svg><text>' + 'x'.repeat(PESO_SVG.texto + 1) + '</text></svg>'), /demasiado pesada/);
    assert.doesNotThrow(() => revisarPesoSvg('<svg><rect x="1"/>' + '<text>abc</text>'.repeat(1000) + '</svg>'));
  });
});
