// Firma de ODT Afinia · componer(v0, actos, {PDFLib, zonas}): determinista (misma SHA-256 en dos
// corridas, en otro proceso y con el pdf-lib de node_modules), estampa DENTRO de la zona de su rol y
// en ningún otro lado, y no toca el resto del documento. PDFs y PNG SINTÉTICOS armados en memoria.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { armarOdt, pngFirma, PDFLib, NRO } from './odt_afinia_fixture.js';
import { validarOdt } from '../assets/js/domain/odt_afinia_formato.js';
import { componer, componerConHuella, rectFirma, esPng, ESTAMPA } from '../assets/js/domain/odt_afinia_componer.js';
import { FIRMA_PAPEL } from '../assets/js/domain/firmas_tamano.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PDFLibNpm = createRequire(import.meta.url)('pdf-lib');
const sha = (b) => createHash('sha256').update(b).digest('hex');

const IMG_AZT = pngFirma(250, 100, 1);    // 2,5 : 1
const IMG_RESP = pngFirma(300, 80, 2);    // 3,75 : 1
const FECHA = '20/11/2026';
const actosAzt = () => ({ azt: { imagen: IMG_AZT } });
const actosAmbos = () => ({ azt: { imagen: IMG_AZT }, responsable: { imagen: IMG_RESP, cierre: { si: true, fecha: FECHA } } });

async function base() {
  const odt = await armarOdt();
  const v = validarOdt(odt.estructura, { nro: NRO });
  assert.equal(v.ok, true);
  return { v0: odt.bytes, zonas: v.zonas };
}

// ── Lector mínimo del contenido de una página (lo que pdf-lib escribe) ─────────
const mult = (m, n) => [ // m × n (convención PDF: el punto es fila)
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]
];
function contenido(doc, i) {
  const C = doc.getPage(i).node.Contents();
  const arr = C.asArray ? C.asArray() : [C];
  return arr.map((r) => Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(r)).decode()).toString('latin1'));
}
/** Imágenes (rect final) y textos (punto + texto) de una página. */
function dibujado(doc, i) {
  const toks = contenido(doc, i).join('\n').match(/<[0-9A-Fa-f]*>|\/[^\s/<>[\]()]+|[^\s<>[\]()/]+/g) || [];
  let ctm = [1, 0, 0, 1, 0, 0]; const pila = []; let ops = []; let tm = null;
  const imagenes = []; const textos = [];
  for (const t of toks) {
    if (/^-?[0-9.]+$/.test(t) || t.startsWith('/') || t.startsWith('<')) { ops.push(t); continue; }
    if (t === 'q') pila.push(ctm);
    else if (t === 'Q') ctm = pila.pop();
    else if (t === 'cm') ctm = mult(ops.slice(-6).map(Number), ctm);
    else if (t === 'Tm') tm = ops.slice(-6).map(Number);
    else if (t === 'Do') {
      const m = ctm; // cuadrado unidad → rect
      imagenes.push({ nombre: ops[ops.length - 1], x: m[4], y: m[5], w: m[0], h: m[3] });
    } else if (t === 'Tj') {
      const hex = ops[ops.length - 1].slice(1, -1);
      textos.push({ texto: Buffer.from(hex, 'hex').toString('latin1'), x: tm[4], y: tm[5] });
    }
    ops = [];
  }
  return { imagenes, textos };
}
const dentro = (r, z, m = 0) => r.x >= z.x + m - 1e-6 && r.y >= z.y + m - 1e-6 && r.x + r.w <= z.x + z.w - m + 1e-6 && r.y + r.h <= z.y + z.h - m + 1e-6;
const toca = (r, z) => r.x < z.x + z.w && z.x < r.x + r.w && r.y < z.y + z.h && z.y < r.y + r.h;

describe('determinista', () => {
  test('dos corridas → misma SHA-256 (con y sin Responsable)', async () => {
    const { v0, zonas } = await base();
    for (const actos of [actosAzt, actosAmbos]) {
      const a = await componer(v0, actos(), { PDFLib, zonas });
      const b = await componer(v0, actos(), { PDFLib, zonas });
      assert.equal(sha(a), sha(b));
    }
  });
  test('el pdf-lib vendorizado y el de node_modules (1.17.1) dan los MISMOS bytes', async () => {
    const { v0, zonas } = await base();
    assert.equal(sha(await componer(v0, actosAmbos(), { PDFLib, zonas })), sha(await componer(v0, actosAmbos(), { PDFLib: PDFLibNpm, zonas })));
  });
  test('en OTRO proceso de Node sale la misma huella', async () => {
    const { v0, zonas } = await base();
    const aqui = sha(await componer(v0, actosAmbos(), { PDFLib, zonas }));
    const guion = `
      const F = await import(${JSON.stringify(resolve(RAIZ, 'tests/odt_afinia_fixture.js'))});
      const fmt = await import(${JSON.stringify(resolve(RAIZ, 'assets/js/domain/odt_afinia_formato.js'))});
      const c = await import(${JSON.stringify(resolve(RAIZ, 'assets/js/domain/odt_afinia_componer.js'))});
      const o = await F.armarOdt(); const v = fmt.validarOdt(o.estructura, { nro: F.NRO });
      const r = await c.componerConHuella(o.bytes, { azt: { imagen: F.pngFirma(250, 100, 1) }, responsable: { imagen: F.pngFirma(300, 80, 2), cierre: { si: true, fecha: '20/11/2026' } } }, { PDFLib: F.PDFLib, zonas: v.zonas });
      process.stdout.write(r.huella);`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', guion], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, aqui);
  });
  test('la huella de componerConHuella es la de los bytes entregados y no cambia al recomponer', async () => {
    const { v0, zonas } = await base();
    const r1 = await componerConHuella(v0, actosAmbos(), { PDFLib, zonas });
    const r2 = await componerConHuella(v0, actosAmbos(), { PDFLib, zonas });
    assert.equal(r1.huella, sha(r1.bytes));
    assert.equal(r1.huella, r2.huella);
    const soloAzt = await componerConHuella(v0, actosAzt(), { PDFLib, zonas });
    assert.notEqual(soloAzt.huella, r1.huella, 'la firma del Responsable cambia la huella');
  });
  test('no toca el v0 que recibe', async () => {
    const { v0, zonas } = await base();
    const antes = sha(v0);
    await componer(v0, actosAmbos(), { PDFLib, zonas });
    assert.equal(sha(v0), antes);
  });
  test('sin actos devuelve una COPIA exacta del v0 (lo que se ve es lo publicado)', async () => {
    const { v0, zonas } = await base();
    const c = await componer(v0, {}, { PDFLib, zonas });
    assert.equal(sha(c), sha(v0));
    assert.notEqual(c.buffer, v0.buffer);
  });
});

describe('estampa dentro de la zona de su rol, y en ningún otro lado', () => {
  test('solo AZT: una imagen, dentro de la casilla AZT (con margen), centrada; nada en la del Responsable ni en el cierre', async () => {
    const { v0, zonas } = await base();
    const doc = await PDFLib.PDFDocument.load(await componer(v0, actosAzt(), { PDFLib, zonas }));
    const { imagenes, textos } = dibujado(doc, 1);
    assert.equal(imagenes.length, 1);
    const img = imagenes[0];
    assert.ok(dentro(img, zonas.azt, ESTAMPA.margenPt), JSON.stringify(img));
    assert.ok(!toca(img, zonas.responsable));
    assert.ok(Math.abs((img.x + img.w / 2) - (zonas.azt.x + zonas.azt.w / 2)) < 1e-6, 'centrada en x');
    assert.ok(Math.abs((img.y + img.h / 2) - (zonas.azt.y + zonas.azt.h / 2)) < 1e-6, 'centrada en y');
    assert.ok(!textos.some((t) => t.texto === 'X' || t.texto === FECHA), 'sin cierre');
    assert.equal(dibujado(doc, 0).imagenes.length, 0, 'la página 1 no lleva firmas');
  });
  test('AZT + Responsable: cada imagen en su casilla; X en SI y FECHA CIERRE en su punto (Helvetica)', async () => {
    const { v0, zonas } = await base();
    const doc = await PDFLib.PDFDocument.load(await componer(v0, actosAmbos(), { PDFLib, zonas }));
    const { imagenes, textos } = dibujado(doc, 1);
    assert.equal(imagenes.length, 2);
    const [azt, resp] = imagenes; // orden fijo: AZT y luego Responsable
    assert.ok(dentro(azt, zonas.azt, ESTAMPA.margenPt) && !toca(azt, zonas.responsable));
    assert.ok(dentro(resp, zonas.responsable, ESTAMPA.margenPt) && !toca(resp, zonas.azt));
    const x = textos.find((t) => t.texto === 'X');
    const f = textos.find((t) => t.texto === FECHA);
    assert.deepEqual([x.x, x.y], [zonas.si.x, zonas.si.y]);
    assert.deepEqual([f.x, f.y], [zonas.fecha.x, zonas.fecha.y]);
    const fuentes = [...doc.getPage(1).node.Resources().lookup(PDFLib.PDFName.of('Font')).asMap().values()]
      .map((ref) => doc.context.lookup(ref).get(PDFLib.PDFName.of('BaseFont')).toString());
    assert.ok(fuentes.includes('/Helvetica'));
  });
  test('el tamaño sale de tamanoFirma: misma superficie (2400 pt²) salvo tope de alto', async () => {
    const { zonas } = await base();
    const ancha = rectFirma(zonas.responsable, 3.75);
    assert.ok(Math.abs(ancha.ancho * ancha.alto - ESTAMPA.areaPt2) < 1e-6);
    const alta = rectFirma(zonas.azt, 1.2);
    assert.ok(alta.alto <= ESTAMPA.altoMaxPt + 1e-9 && alta.alto <= zonas.azt.h - 2 * ESTAMPA.margenPt + 1e-9);
    const muyAncha = rectFirma(zonas.responsable, 40);
    assert.ok(muyAncha.ancho <= zonas.responsable.w - 2 * ESTAMPA.margenPt + 1e-9);
    assert.ok(ESTAMPA.areaPt2 > FIRMA_PAPEL.areaPt2, 'la casilla de la ODT es más grande que el renglón del Excel');
  });
  test('el resto del documento no cambia: página 1 y el contenido original de la página 2 iguales', async () => {
    const { v0, zonas } = await base();
    const orig = await PDFLib.PDFDocument.load(v0);
    const comp = await PDFLib.PDFDocument.load(await componer(v0, actosAmbos(), { PDFLib, zonas }));
    assert.equal(contenido(comp, 0).join(''), contenido(orig, 0).join(''));
    const c2 = contenido(comp, 1);
    assert.ok(c2.includes(contenido(orig, 1).join('')), 'el flujo original sigue intacto');
    assert.equal(comp.getPageCount(), 2);
    const tamOrig = orig.getPage(1).getSize(); const tamComp = comp.getPage(1).getSize();
    assert.deepEqual(tamComp, tamOrig);
  });
});

describe('se niega a componer lo que no debe', () => {
  test('Responsable sin AZT', async () => {
    const { v0, zonas } = await base();
    await assert.rejects(componer(v0, { responsable: actosAmbos().responsable }, { PDFLib, zonas }), /después de la del AZT/);
  });
  test('imagen que no es PNG, vacía o de más de 900 KB', async () => {
    const { v0, zonas } = await base();
    await assert.rejects(componer(v0, { azt: { imagen: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]) } }, { PDFLib, zonas }), /no es un PNG/);
    await assert.rejects(componer(v0, { azt: {} }, { PDFLib, zonas }), /no trae la imagen/);
    const grande = new Uint8Array(900 * 1024 + 1); grande.set(IMG_AZT.subarray(0, 8));
    await assert.rejects(componer(v0, { azt: { imagen: grande } }, { PDFLib, zonas }), /900 KB/);
  });
  test('cierre sin SI o con fecha mala', async () => {
    const { v0, zonas } = await base();
    for (const cierre of [undefined, { si: false, fecha: FECHA }, { si: true, fecha: '2026-11-20' }]) {
      await assert.rejects(componer(v0, { azt: { imagen: IMG_AZT }, responsable: { imagen: IMG_RESP, cierre } }, { PDFLib, zonas }), /cierre/);
    }
  });
  test('sin zonas, sin pdf-lib, o con algo que no es PDF', async () => {
    const { v0, zonas } = await base();
    await assert.rejects(componer(v0, actosAzt(), { PDFLib }), /zonas/);
    await assert.rejects(componer(v0, actosAzt(), { zonas }), /pdf-lib/);
    await assert.rejects(componer(new Uint8Array([1, 2, 3, 4, 5, 6]), actosAzt(), { PDFLib, zonas }), /no es un PDF/);
  });
  test('un PDF de 3 páginas', async () => {
    const { zonas } = await base();
    const tres = await armarOdt({ paginas: 3 });
    await assert.rejects(componer(tres.bytes, actosAzt(), { PDFLib, zonas }), /2 páginas/);
  });
  test('acepta la imagen como Bytes de Firestore (toUint8Array) y como ArrayBuffer', async () => {
    const { v0, zonas } = await base();
    const ref = sha(await componer(v0, actosAzt(), { PDFLib, zonas }));
    const bytesFs = { toUint8Array: () => IMG_AZT.slice() };
    assert.equal(sha(await componer(v0, { azt: { imagen: bytesFs } }, { PDFLib, zonas })), ref);
    assert.equal(sha(await componer(v0.slice().buffer, { azt: { imagen: IMG_AZT.slice().buffer } }, { PDFLib, zonas })), ref);
  });
  test('esPng', () => {
    assert.equal(esPng(IMG_AZT), true);
    assert.equal(esPng(new Uint8Array(10)), false);
  });
});
