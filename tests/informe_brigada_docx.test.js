// Word (.docx) del Informe de Mantenimiento Brigada (formato F60-ADM V.11).
// Se arma con un Documento ESCRITO A MANO (no depende del dominio del papel) y datos
// INVENTADOS; se lee de vuelta con jszip. Sin archivos en disco ni imágenes reales.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';

import {
  construirDocx, docxBytes, MIME_DOCX, GEOM_CUADRICULA, refsDeImagenes, fotosConMarcas, claveMarcada, escXml
} from '../assets/js/domain/informe_brigada_docx.js';
import { pngColor } from '../assets/js/domain/png_simple.js';
import { geometriaCuadricula, FIRMA_PORTADA } from '../assets/js/domain/informe_brigada_documento.js';
import { tamanoFirma } from '../assets/js/domain/firmas_tamano.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = (...p) => resolve(__dirname, '..', ...p);

/* ── Documento de prueba (PLAN §3.4), todo inventado ───────────────────────── */
function documentoDePrueba({ estado = 'borrador' } = {}) {
  const emitido = estado === 'emitido';
  const foto = (id, marcas = []) => ({ ref: id ? `archivo:${id}` : null, ancho: 600, alto: 800, marcas });
  return {
    meta: { titulo: 'INFORME T9-Z_Z-PRU', matricula: 'T9-Z/Z-PRU', estado, version: emitido ? 1 : 0, marcaAgua: emitido ? null : estado === 'anulado' ? 'ANULADO' : 'BORRADOR · SIN EMITIR' },
    formato: {
      codigo: 'F60-ADM V. 11 – 16/09/2024',
      direcciones: [{ t: 'Bogotá D.C.', b: true }, { t: 'Calle 71A Bis No. 20 - 69' }, { t: 'PBX: (601) 7441133' }, { t: 'Barranquilla', b: true }, { t: 'Calle 58 No. 59B-09' }, { t: 'PBX: (605) 3851256' }],
      web: 'www.applus.com',
    },
    encabezado: { logo: 'marca:applus-encabezado', together: 'marca:together-encabezado' },
    portada: {
      logos: { afinia: 'marca:afinia-portada', applus: 'marca:applus-portada', together: 'marca:together-portada' },
      titulo: ['INFORME DE MANTENIMIENTO CORRECTIVO.', 'ACTUALIZACIÓN DE SISTEMA DE REFRIGERACIÓN', 'T9-Z/Z-PRU.'],
      indice: [
        { nivel: 1, numero: '1.', texto: 'INTRODUCCIÓN' }, { nivel: 1, numero: '2.', texto: 'DESCRIPCIÓN DE TRABAJOS' },
        { nivel: 2, numero: '2.1', texto: 'Objetivo' }, { nivel: 2, numero: '2.2', texto: 'Personal' },
      ],
      anexosTitulo: 'ANEXOS', anexosSubtitulo: 'ACTUALIZACIÓN DE REFRIGERACIÓN',
      anexos: ['CONSIGNACIÓN', 'FICHA TÉCNICA VENTILADOR VX-100', 'CÁLCULO DE VENTILADORES'],
      cliente: 'CLIENTE: AFINIA GRUPO E.P.M.',
      datos: [
        [{ t: 'ASUNTO: ACTUALIZACIÓN SISTEMA DE REFRIGERACIÓN', esc: 0.88 }],
        [{ t: 'MARCA-PRUEBA 10 / 14 MVA SERIE: SERIE-PRUEBA-001', esc: 0.905 }],
        [{ t: 'ZONA: ', esc: 0.905 }, { t: '[zona]', falta: true, esc: 0.905 }],
        [{ t: 'MATRICULA: T9-Z/Z-PRU', esc: 0.905 }],
      ],
      firmas: ['elaborado', 'revisado', 'aprobado'].map((rol, k) => ({
        rol, rotulo: `${rol[0].toUpperCase()}${rol.slice(1)} por:`, casilla: 'Fecha / Firma:',
        nombre: ['INGENIERO PRUEBA UNO', 'REVISOR PRUEBA', 'APROBADOR PRUEBA'][k],
        // la ref se pone SIEMPRE aquí para probar que en borrador el Word la ignora igual
        firmaRef: k === 0 ? `firma:${rol}` : null, fecha: k === 0 ? '21/02/2026' : null,
      })),
    },
    bloques: [
      { tipo: 'titulo', id: 's1', nivel: 1, numero: '1.', texto: 'INTRODUCCIÓN', estilo: 'barra', antes: 12.455, antesEnTope: true, conSiguiente: true },
      { tipo: 'parrafo', id: 'intro_p2', antes: 12.25, runs: [{ t: 'Con base en inspecciones en la Subestación Prueba Norte & Sur <norte>, el activo está en ' }, { t: 'condición de salud 2 (bueno)', mark: true }, { t: '.' }] },
      { tipo: 'titulo', id: 's2_1', nivel: 2, numero: '2.1', texto: 'OBJETIVO', estilo: 'normal', antes: 12.845, conSiguiente: true },
      { tipo: 'titulo', id: 's2_1_1', nivel: 3, numero: '2.1.1', texto: 'OBJETIVO GENERAL', estilo: 'normal', antes: 12.545, conSiguiente: true },
      { tipo: 'parrafo', id: 'ingreso', antes: 12.645, runs: [{ t: 'Consignación ' }, { t: '990001', b: true }, { t: '.' }] },
      { tipo: 'cuadricula', id: 'g01', disposicion: '2x1', antes: 9.045, figuras: [
        { numero: 1, pie: 'Panorámica del equipo', fotos: [foto('a1')] },
        { numero: 2, pie: 'Placa característica', fotos: [foto(null)] },
      ] },
      { tipo: 'titulo', id: 's3', nivel: 1, numero: '3.', texto: 'INFORMACIÓN CARACTERÍSTICA', estilo: 'barra', antes: 0, saltoAntes: true, conSiguiente: true },
      { tipo: 'tabla', id: 't1', antes: 24.05, geom: { x0: 117.1, cols: [162.0, 215.4], bExt: 0.5, bH: 0.5, bV: 0.5, dy: 0.6, dx: -4.1, fuente: 't10' }, filas: [
        { alto: 13.09, celdas: [{ estilo: 'rotulo', runs: [{ t: 'MATRICULA', b: true, esc: 0.76471, sep: 0.2 }] }, { runs: [{ t: 'T9-Z/Z-PRU' }] }] },
        { alto: 13.09, celdas: [{ estilo: 'rotulo', runs: [{ t: 'SERIAL', b: true, esc: 0.88235 }] }, { runs: [{ t: 'SERIE-PRUEBA-001' }] }] },
      ] },
      { tipo: 'pieTabla', texto: 'Tabla 1 Características del activo', antes: 0.9, conAnterior: true },
      { tipo: 'tabla', id: 't2', antes: 9.85, geom: { x0: 85, cols: [34.6, 308.3, 57.3, 59.3], bExt: 1, bH: 1, bV: 0.5, dy: 2.5, dx: 0.4, fuente: 't10' }, filas: [
        { alto: 15.14, celdas: [{ runs: [{ t: '1' }] }, { runs: [{ t: 'VENTILADOR MARCA-PRUEBA VX-100 (7000 CFM)' }], envolver: true }, { runs: [{ t: 'UND' }] }, { runs: [{ t: '4' }] }] },
      ] },
      { tipo: 'pieTabla', texto: 'Tabla 2 Material Utilizado', antes: 1.4, conAnterior: true },
      { tipo: 'titulo', id: 's4', nivel: 1, numero: '4.', texto: 'PROCEDIMIENTO', estilo: 'barra', antes: 12.455, saltoAntes: true, antesEnTope: true, conSiguiente: true },
      { tipo: 'cuadricula', id: 'g02', disposicion: '3f', antes: 12.5, figuras: [{ numero: 3, pie: 'Consumo de ventiladores VX-100', fotos: [foto('a2'), foto('a3', [{ x: 0.1, y: 0.2, w: 0.3, h: 0.2 }]), foto('a4')] }] },
      { tipo: 'etiqueta', texto: 'Tabla 5.', antes: 38.0, conSiguiente: true },
      { tipo: 'tabla', id: 't5', antes: 0.05, geom: { x0: 74.5, cols: [95.1, 128.0, 127.6, 124.5], bExt: 0.5, bH: 0.5, bV: 0.5, dy: 0.6, dx: 0.25, fuente: 't11' }, filas: [
        { alto: 13, celdas: [{ runs: [{ t: 'CONSUMO DE CORRIENTE EN VENTILADORES' }], span: 4 }] },
        { alto: 13, celdas: [{ runs: [{ t: 'V1 VX-100' }] }, { runs: [{ t: '2,03' }] }, { runs: [{ t: '1,9' }] }, { runs: [{ t: '1,91' }] }] },
      ] },
      { tipo: 'cuadricula', id: 'g03', disposicion: '2x2f', antes: 12.5, figuras: [{ numero: 4, pie: 'Prueba de sentido de giro', fotos: [foto('a2'), foto('a3'), foto('a4'), foto('a1')] }] },
      { tipo: 'cuadricula', id: 'g04', disposicion: '1x1', antes: 13.0, figuras: [{ numero: 5, pie: 'Estado final transformador de potencia', fotos: [{ ref: 'archivo:a1', ancho: 1263, alto: 916, marcas: [] }] }] },
      { tipo: 'titulo', id: 's5', nivel: 1, numero: '5.', texto: 'RECOMENDACIONES Y CONCLUSIONES', estilo: 'manual', antes: 21.4, conSiguiente: true },
      { tipo: 'vineta', id: 'c1', antes: 12.5, runs: [{ t: 'La intervención realizada al transformador T9-Z/Z-PRU permitió mejorar la disipación.' }] },
      { tipo: 'titulo', id: 's5_1', nivel: 2, numero: '5.1', texto: 'RECOMENDACIONES', estilo: 'plano', antes: 12.7, conSiguiente: true },
      { tipo: 'vineta', id: 'r7', antes: 12.645, runs: [{ t: 'Todas las actividades se ejecutaron cumpliendo con los requisitos de seguridad' }, { t: ', control previo, ODTs', b: true }, { t: '.' }] },
      { tipo: 'anexoTitulo', id: 'anexos', texto: 'ANEXOS', antes: 0, saltoAntes: true, conSiguiente: true },
      { tipo: 'anexoTitulo', id: 'anexo_consignacion', texto: 'CONSIGNACIÓN', antes: 1.05, conSiguiente: true },
      { tipo: 'anexoImagen', clave: 'consignacion', ref: 'archivo:a5', ancho: 1178, alto: 893, antes: 0 },
      { tipo: 'anexoTitulo', id: 'anexo_ficha_actual', texto: 'FICHA TÉCNICA VENTILADOR VX-100', antes: 0, saltoAntes: true, conSiguiente: true },
      { tipo: 'anexoImagen', clave: 'ficha_actual', ref: 'ficha:ficha_actual', ancho: 1150, alto: 1538, anchoPt: 400, antes: 0 },
      { tipo: 'anexoTitulo', id: 'anexo_calculo', texto: 'CÁLCULO DE VENTILADORES', antes: 0, saltoAntes: true, conSiguiente: true },
      { tipo: 'tabla', id: 'calc_actual', antes: 12, geom: { x0: 85, cols: [170.0, 70.0, 100.9, 101.0], bExt: 1, bH: 1, bV: 0.5, dy: 2.5, dx: 0, fuente: 't10' }, filas: [
        { alto: 15.14, celdas: [{ runs: [{ t: 'ACTUAL', b: true }], estilo: 'negrita', span: 4, fondo: '#D9D9D9' }] },
        { alto: 15.14, celdas: ['TIPO / MODELO', 'CANTIDAD', 'CFM POR UNIDAD', 'CFM TOTAL'].map((t) => ({ runs: [{ t, b: true }], estilo: 'negrita' })) },
        { alto: 15.14, celdas: [{ runs: [{ t: 'VX-50' }] }, { runs: [{ t: '3' }] }, { runs: [{ t: '5000' }] }, { runs: [{ t: '15000' }] }] },
      ] },
      { tipo: 'tabla', id: 'calc_proyectado', antes: 24, geom: { x0: 85, cols: [170.0, 70.0, 100.9, 101.0], bExt: 1, bH: 1, bV: 0.5, dy: 2.5, dx: 0, fuente: 't10' }, filas: [
        { alto: 15.14, celdas: [{ runs: [{ t: 'PROYECTADO', b: true }], estilo: 'negrita', span: 4, fondo: '#D9D9D9' }] },
        { alto: 15.14, celdas: [{ runs: [{ t: 'MARCA-PRUEBA VX-100' }] }, { runs: [{ t: '4' }] }, { runs: [{ t: '7000' }] }, { runs: [{ t: '28000' }] }] },
      ] },
    ],
  };
}

const PNG = (hex) => ({ bytes: pngColor(6, 8, hex), mime: 'image/png', ancho: 6, alto: 8 });
function imagenesDePrueba({ conLogos = true } = {}) {
  const m = new Map();
  for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) m.set(`archivo:${id}`, PNG('#336699'));
  m.set('ficha:ficha_actual', PNG('#999999'));
  m.set('firma:elaborado', PNG('#000080'));      // firma inventada (un rectángulo): solo para probar la regla
  if (conLogos) for (const k of ['applus-encabezado', 'together-encabezado', 'applus-portada', 'together-portada', 'afinia-portada']) m.set(`marca:${k}`, PNG('#EC6825'));
  return m;
}

async function abrir(documento, imagenes) {
  const r = construirDocx(documento, imagenes);
  const zip = await JSZip.loadAsync(docxBytes(documento, imagenes));
  const leer = async (n) => (zip.file(n) ? zip.file(n).async('string') : null);
  return { r, zip, leer, doc: await leer('word/document.xml'), enc: await leer('word/header1.xml'), pie: await leer('word/footer1.xml') };
}

/** Texto visible de una parte (lo que va dentro de <w:t>), sin entidades. */
function texto(xml) {
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

/** ¿Etiquetas XML balanceadas? (pila simple; ignora declaraciones y comentarios). */
function balanceado(xml) {
  const pila = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g)) {
    const [, cierra, nombre, , vacia] = m;
    if (vacia) continue;
    if (cierra) { if (pila.pop() !== nombre) return false; } else pila.push(nombre);
  }
  return pila.length === 0;
}

const PARTES = ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/document.xml', 'word/styles.xml',
  'word/settings.xml', 'word/fontTable.xml', 'word/header1.xml', 'word/footer1.xml', 'word/_rels/document.xml.rels',
  'word/_rels/header1.xml.rels', 'word/_rels/footer1.xml.rels'];

describe('Paquete .docx', () => {
  test('es un zip que jszip abre, con todas las partes obligatorias', async () => {
    const { zip } = await abrir(documentoDePrueba(), imagenesDePrueba());
    for (const p of PARTES) assert.ok(zip.file(p), `falta ${p}`);
    assert.equal(MIME_DOCX, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  test('tipos de contenido: PNG y JPEG por extensión y cada Override con su parte', async () => {
    const { zip, leer } = await abrir(documentoDePrueba(), imagenesDePrueba());
    const ct = await leer('[Content_Types].xml');
    assert.match(ct, /Extension="png" ContentType="image\/png"/);
    assert.match(ct, /Extension="jpeg" ContentType="image\/jpeg"/);
    for (const m of ct.matchAll(/PartName="\/([^"]+)"/g)) assert.ok(zip.file(m[1]), `Override sin parte: ${m[1]}`);
  });

  test('las relaciones no apuntan a archivos inexistentes y cada r:id usado existe', async () => {
    const { zip, leer } = await abrir(documentoDePrueba(), imagenesDePrueba());
    for (const [rels, parte] of [['word/_rels/document.xml.rels', 'word/document.xml'], ['word/_rels/header1.xml.rels', 'word/header1.xml'], ['word/_rels/footer1.xml.rels', 'word/footer1.xml']]) {
      const xml = await leer(rels);
      const ids = new Set();
      for (const m of xml.matchAll(/<Relationship Id="([^"]+)" Type="[^"]+" Target="([^"]+)"( TargetMode="External")?\/>/g)) {
        ids.add(m[1]);
        if (!m[3]) assert.ok(zip.file(`word/${m[2]}`), `${rels} → word/${m[2]} no existe`);
      }
      const usa = await leer(parte);
      for (const m of usa.matchAll(/r:(?:embed|id)="([^"]+)"/g)) assert.ok(ids.has(m[1]), `${parte} usa ${m[1]} sin relación`);
    }
    const raiz = await leer('_rels/.rels');
    for (const m of raiz.matchAll(/Target="([^"]+)"/g)) assert.ok(zip.file(m[1]), `_rels/.rels → ${m[1]}`);
  });

  test('todo el XML está balanceado y los ids de dibujo no se repiten', async () => {
    const { zip } = await abrir(documentoDePrueba(), imagenesDePrueba());
    const ids = [];
    for (const n of Object.keys(zip.files).filter((x) => /\.(xml|rels)$/.test(x))) {
      const xml = await zip.file(n).async('string');
      assert.ok(balanceado(xml), `${n}: etiquetas sin cerrar`);
      for (const m of xml.matchAll(/<wp:docPr id="(\d+)"/g)) ids.push(m[1]);
    }
    assert.equal(new Set(ids).size, ids.length);
  });

  test('salida determinista sin fecha de creación', () => {
    assert.deepEqual(docxBytes(documentoDePrueba(), imagenesDePrueba()), docxBytes(documentoDePrueba(), imagenesDePrueba()));
  });
});

describe('Hoja, encabezado y pie del F60', () => {
  test('carta 12240 × 15840 y márgenes del modelo (109 / 85,1 / 78 / 85 pt)', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.match(doc, /<w:pgSz w:w="12240" w:h="15840"\/>/);
    assert.match(doc, /<w:pgMar w:top="2180" w:right="1702" w:bottom="1560" w:left="1700" w:header="0" w:footer="0" w:gutter="0"\/>/);
    assert.match(doc, /<w:headerReference w:type="default" r:id="[^"]+"\/><w:footerReference w:type="default"/);
  });

  test('encabezado: dos logos flotantes, direcciones Bogotá/Barranquilla y enlace azul subrayado', async () => {
    const { enc, leer } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.equal((enc.match(/<wp:anchor /g) || []).length, 2);
    const t = texto(enc);
    for (const s of ['Bogotá D.C.', 'Calle 71A Bis No. 20 - 69', 'PBX: (601) 7441133', 'Barranquilla', 'Calle 58 No. 59B-09', 'PBX: (605) 3851256', 'www.applus.com']) assert.ok(t.includes(s), s);
    assert.match(enc, /<w:framePr [^>]*w:hAnchor="page" w:vAnchor="page" w:x="1842" w:y="882"\/>/);
    assert.match(enc, /<w:hyperlink r:id="[^"]+"/);
    assert.match(await leer('word/_rels/header1.xml.rels'), /Target="http:\/\/www\.applus\.com" TargetMode="External"/);
    assert.match(enc, /w:ascii="Arial"/);
  });

  test('pie: código F60-ADM, número de página (campo PAGE) en recuadro naranja y franja', async () => {
    const { pie, zip, leer } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.ok(texto(pie).includes('F60-ADM V. 11 – 16/09/2024'));
    // campo PAGE en 5 partes (begin / instrText / separate / texto / end), TODAS en blanco (revisión de fidelidad #6)
    assert.match(pie, /<w:fldChar w:fldCharType="begin"\/>[\s\S]*<w:instrText xml:space="preserve"> PAGE <\/w:instrText>[\s\S]*<w:fldChar w:fldCharType="separate"\/>[\s\S]*<w:fldChar w:fldCharType="end"\/>/);
    assert.ok(!pie.includes('fldSimple'));
    const partesCampo = [...pie.matchAll(/<w:r><w:rPr>(.*?)<\/w:rPr><w:(fldChar|instrText|t)\b/g)].filter((m) => /FFFFFF/.test(m[1]) || m[2] !== 't');
    assert.equal(partesCampo.length, 5);
    assert.ok(partesCampo.every((m) => /w:color w:val="FFFFFF"/.test(m[1])), 'cada parte del campo PAGE lleva el blanco');
    assert.equal((pie.match(/<wp:anchor [^>]*behindDoc="1"/g) || []).length, 2, 'franja + recuadro detrás del texto');
    const rels = await leer('word/_rels/footer1.xml.rels');
    const medios = [...rels.matchAll(/Target="(media\/[^"]+)"/g)].map((m) => m[1]);
    assert.equal(medios.length, 2);
    for (const m of medios) assert.ok(zip.file(`word/${m}`));
  });
});

describe('Cuerpo', () => {
  test('textos esperados, en orden, con Arial Narrow; los rótulos de la Tabla 1 con escala', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    const t = texto(doc);
    const orden = ['INFORME DE MANTENIMIENTO CORRECTIVO.', '1.', 'INTRODUCCIÓN', 'DESCRIPCIÓN DE TRABAJOS', 'ELABORADO', 'INTRODUCCIÓN', 'condición de salud 2 (bueno)',
      'OBJETIVO GENERAL', 'Figura 1', '. Panorámica del equipo', 'INFORMACIÓN CARACTERÍSTICA', 'MATRICULA', 'T9-Z/Z-PRU', 'Tabla 1 Características del activo',
      'VENTILADOR MARCA-PRUEBA VX-100 (7000 CFM)', 'Tabla 2 Material Utilizado', 'PROCEDIMIENTO', 'Figura 3', 'Tabla 5.', 'CONSUMO DE CORRIENTE EN VENTILADORES',
      '2,03', 'Figura 4', 'Figura 5', '5. RECOMENDACIONES Y CONCLUSIONES', '5.1 RECOMENDACIONES', 'ANEXOS', 'CONSIGNACIÓN', 'FICHA TÉCNICA VENTILADOR VX-100',
      'CÁLCULO DE VENTILADORES', 'ACTUAL', 'TIPO / MODELO', '15000', 'PROYECTADO', '28000'];
    let p = 0;
    for (const s of orden) {
      const k = s === 'ELABORADO' ? t.indexOf('Elaborado por:', p) : t.indexOf(s, p);
      assert.ok(k >= 0, `no aparece «${s}» en su lugar`);
      p = k;
    }
    assert.match(doc, /w:ascii="Arial Narrow"/);
    assert.match(doc, /w:ascii="Tahoma"[^>]*\/><w:w w:val="78"\/>|w:ascii="Tahoma"/);
    assert.match(doc, /<w:spacing w:val="4"\/><w:w w:val="76"\/>/, 'MATRICULA comprimida al 76 % con 0,2 pt de espaciado');
    assert.match(doc, /<w:highlight w:val="yellow"\/>/);
  });

  test('saltos de hoja: portada sola, 3., 4., ANEXOS y cada anexo siguiente', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    // 1. (renglón de espacio arriba) · 3. · 4. (renglón de espacio arriba) · ANEXOS · ficha · cálculo
    assert.equal((doc.match(/<w:pageBreakBefore\/>/g) || []).length, 6);
    assert.match(doc, /<w:pageBreakBefore\/>(?:(?!<\/w:p>).)*<\/w:p><w:p>(?:(?!<\/w:p>).)*INTRODUCCIÓN/s, '1. va tras un renglón vacío que abre hoja');
  });

  test('títulos con barra gris #D9D9D9, «Título 1/2/3» y siempre unidos al siguiente', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    const barras = doc.match(/<w:p><w:pPr><w:pStyle w:val="Ttulo1"\/><w:keepNext\/>(?:<w:pageBreakBefore\/>)?<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"\/>/g) || [];
    assert.equal(barras.length, 4, '1., 3., 4. y 5.');
    assert.ok(doc.includes('<w:pStyle w:val="Ttulo3"/><w:keepNext/>'), 'nivel 3');
  });

  test('viñetas ⊞ en gris #808080 con sangría francesa de 18,1 pt', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.equal((doc.match(/<w:ind w:left="362" w:hanging="362"\/>/g) || []).length, 2);
    assert.match(doc, /<w:color w:val="808080"\/>/);
  });

  test('fotos con borde difuminado (softEdge 15,8 pt); los anexos sin difuminar', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    const fotos = (doc.match(/name="Foto \d+"/g) || []).length / 2;
    const suaves = (doc.match(/<a:softEdge rad="200660"\/>/g) || []).length;
    assert.equal(suaves, fotos);
    assert.ok(fotos >= 9);
    const anexo = doc.slice(doc.indexOf('name="Anexo '));
    assert.ok(!anexo.slice(0, anexo.indexOf('</wp:inline>')).includes('softEdge'));
  });

  test('cuadrículas en el x0 del papel (sangría = x0 − 85) con bordes de 0,5 pt; filas que no se parten', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    // 2x1: 481,2 pt centrada → x0 = 65,4 → sangría −19,6 pt; 1x1: 484,9 pt → x0 = 63,55 → −21,45 pt
    assert.ok((doc.match(/<w:tblW w:w="9624" w:type="dxa"\/><w:tblInd w:w="-392" w:type="dxa"\/>/g) || []).length >= 1, '2x1: 481,2 pt');
    assert.ok(doc.includes('<w:tblW w:w="9698" w:type="dxa"/><w:tblInd w:w="-429" w:type="dxa"/>'), '1x1: 484,9 pt');
    assert.ok(doc.includes('<w:cantSplit/>'));
    assert.ok(!/<\/w:tbl><w:tbl>/.test(doc), 'dos tablas seguidas se unirían en Word');
  });

  test('texto escapado: «&» y «<» nunca rompen el XML', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.ok(doc.includes('Prueba Norte &amp; Sur &lt;norte&gt;'));
    assert.ok(texto(doc).includes('Prueba Norte & Sur <norte>'));
    assert.equal(escXml('a\u0001b<c'), 'ab&lt;c', 'quita controles que XML no admite');
  });

  test('hueco «[dato]» de un borrador en rojo', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.match(doc, /<w:color w:val="C00000"\/>(?:(?!<\/w:r>).)*\[zona\]/);
  });
});

describe('Firmas, marca de agua e imágenes que faltan', () => {
  test('BORRADOR: marca de agua y NINGUNA firma aunque haya ref e imagen', async () => {
    const { r, enc, doc } = await abrir(documentoDePrueba({ estado: 'borrador' }), imagenesDePrueba());
    assert.match(enc, /string="BORRADOR · SIN EMITIR"/);
    assert.ok(!doc.includes('name="Firma'));
    assert.ok(!texto(doc).includes('21/02/2026'), 'sin fecha de firma');
    const firma = imagenesDePrueba().get('firma:elaborado').bytes;
    const medios = r.partes.filter((p) => p.nombre.startsWith('word/media/'));
    assert.ok(medios.length > 0);
    assert.ok(!medios.some((p) => p.datos.length === firma.length && p.datos.every((x, i) => x === firma[i])), 'el PNG de la firma no viaja en el borrador');
    assert.ok(!refsDeImagenes(documentoDePrueba()).includes('firma:elaborado'));
  });

  test('ANULADO: marca de agua «ANULADO» y sin firmas', async () => {
    const { enc, doc } = await abrir(documentoDePrueba({ estado: 'anulado' }), imagenesDePrueba());
    assert.match(enc, /string="ANULADO"/);
    assert.ok(!doc.includes('name="Firma'));
  });

  test('EMITIDO: sin marca de agua, firma estampada bajo «Fecha / Firma:» con su fecha', async () => {
    const d = documentoDePrueba({ estado: 'emitido' });
    const { enc, doc } = await abrir(d, imagenesDePrueba());
    assert.ok(!enc.includes('PowerPlusWaterMarkObject'));
    assert.equal((doc.match(/name="Firma elaborado \d+"/g) || []).length, 2);
    assert.ok(texto(doc).includes('Fecha / Firma:21/02/2026'), 'la fecha va en su tabulación (x = 250 pt), sin negrita');
    assert.match(doc, /<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow"[^>]*\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t xml:space="preserve">21\/02\/2026<\/w:t>/);
    assert.ok(refsDeImagenes(d).includes('firma:elaborado'));
  });

  test('foto que falta → «[Foto pendiente]» y aviso; logos que faltan → recuadro y aviso', async () => {
    const { r, doc, enc } = await abrir(documentoDePrueba(), imagenesDePrueba({ conLogos: false }));
    assert.ok(texto(doc).includes('[Foto pendiente]'));
    assert.ok(r.avisos.some((a) => /1 hueco de foto está vacío/.test(a)), r.avisos.join(' | '));
    assert.ok(r.avisos.some((a) => /Faltan 5 logos/.test(a)), r.avisos.join(' | '));
    assert.match(enc, /name="Logo Applus pendiente \d+"/);
  });

  test('imagen que no es PNG ni JPEG: se deja por fuera con aviso (nunca se mete al Word)', () => {
    const m = imagenesDePrueba();
    m.set('archivo:a1', { bytes: new TextEncoder().encode('esto no es una imagen'), mime: 'image/png' });
    const { avisos } = construirDocx(documentoDePrueba(), m);
    assert.ok(avisos.some((a) => /no era/.test(a)));
  });

  test('óvalos rojos: se usa la foto horneada (claveMarcada) y, si falta, la foto sola con aviso', () => {
    const d = documentoDePrueba();
    const marcadas = fotosConMarcas(d);
    assert.equal(marcadas.length, 1);
    assert.equal(marcadas[0].clave, claveMarcada('archivo:a3', [{ x: 0.1, y: 0.2, w: 0.3, h: 0.2 }]));
    // ancho de la foto en el papel para el trazo de 1,5 pt: el de la geometría compartida con el papel
    const bq = d.bloques.find((b) => b.tipo === 'cuadricula' && JSON.stringify(b).includes('archivo:a3'));
    const G = geometriaCuadricula(bq);
    const k = bq.figuras.findIndex((f) => JSON.stringify(f).includes('archivo:a3'));
    assert.equal(marcadas[0].anchoPt, Math.round(G.filas[0].fotos[k].w * 10) / 10);
    const unaSola = { ...d, bloques: d.bloques.map((b) => (b === bq ? { ...b, disposicion: '1x1', figuras: [b.figuras[k]] } : b)) };
    const G1 = geometriaCuadricula(unaSola.bloques.find((b) => b.disposicion === '1x1' && JSON.stringify(b).includes('archivo:a3')));
    assert.equal(fotosConMarcas(unaSola)[0].anchoPt, Math.round(G1.filas[0].fotos[0].w * 10) / 10, 'una foto a lo ancho (o con su tope de alto)');
    const sin = construirDocx(d, imagenesDePrueba());
    assert.ok(sin.avisos.some((a) => /óvalos/.test(a)));
    const m = imagenesDePrueba();
    m.set(marcadas[0].clave, PNG('#EE0000'));
    const con = construirDocx(d, m);
    assert.ok(!con.avisos.some((a) => /óvalos/.test(a)));
  });

  test('Documento vacío o inválido: error claro', () => {
    assert.throws(() => construirDocx(null), /falta el Documento/);
    assert.doesNotThrow(() => docxBytes({ meta: {}, bloques: [] }));
  });
});

describe('Amarres con el dominio del papel', () => {
  const plantilla = raiz('assets', 'js', 'domain', 'informe_brigada_plantilla.js');
  test('GEOM_CUADRICULA ES DISPOSICIONES de la plantilla (sin copia que se desfase: a la copia le faltaba x0 de 3f)', { skip: !existsSync(plantilla) && 'falta la plantilla' }, async () => {
    const { DISPOSICIONES } = await import(plantilla);
    assert.equal(GEOM_CUADRICULA, DISPOSICIONES);
  });

  const docMod = raiz('assets', 'js', 'domain', 'informe_brigada_documento.js');
  const fixture = raiz('tests', 'informe_brigada_fixture.js');
  test('integración: contenido completo → construirDocumento → Word sin bloques desconocidos', { skip: !(existsSync(docMod) && existsSync(fixture)) && 'faltan el documento o el fixture del dominio' }, async () => {
    const { construirDocumento, refsDelDocumento } = await import(docMod);
    const fx = await import(fixture);
    const contenido = typeof fx.contenidoCompletoEjemplo === 'function' ? fx.contenidoCompletoEjemplo() : null;
    assert.ok(contenido, 'el fixture expone contenidoCompletoEjemplo()');
    for (const estado of ['borrador', 'emitido']) {
      const documento = construirDocumento(contenido, { estado });
      const refs = refsDelDocumento(documento);
      assert.deepEqual([...refsDeImagenes(documento)].sort(), [...refs].sort(), 'mismas imágenes que pide el papel');
      const m = new Map(refs.map((x) => [x, PNG('#777777')]));
      const { avisos } = construirDocx(documento, m);
      assert.ok(!avisos.some((a) => /no tiene forma en Word/.test(a)), avisos.join(' | '));
      const zip = await JSZip.loadAsync(docxBytes(documento, m));
      const xml = await zip.file('word/document.xml').async('string');
      assert.ok(balanceado(xml));
    }
  });
});

describe('exportarWord (pantalla)', () => {
  test('pide las imágenes una vez, hornea los óvalos y entrega un .docx con nombre de archivo seguro', async () => {
    const { exportarWord, nombreArchivo } = await import('../assets/js/ui/informe-brigada/exportar-word.js');
    const d = documentoDePrueba();
    let pedidas = null;
    const horneadas = [];
    const r = await exportarWord({
      documento: d,
      resolverBytes: async (refs) => { pedidas = refs; return imagenesDePrueba(); },
      hornear: async (blob, marcas) => { horneadas.push(marcas); return new Blob([pngColor(6, 8, '#EE0000')], { type: 'image/png' }); },
    });
    assert.deepEqual(pedidas, refsDeImagenes(d));
    assert.equal(horneadas.length, 1);
    assert.equal(r.nombre, 'INFORME T9-Z_Z-PRU.docx');
    assert.equal(r.blob.type, MIME_DOCX);
    assert.ok(!r.avisos.some((a) => /óvalos/.test(a)), r.avisos.join(' | '));
    const zip = await JSZip.loadAsync(new Uint8Array(await r.blob.arrayBuffer()));
    assert.ok(zip.file('word/document.xml'));
    assert.match(await zip.file('docProps/core.xml').async('string'), /<dcterms:created xsi:type="dcterms:W3CDTF">\d{4}-/);
    assert.equal(nombreArchivo({ meta: { titulo: 'INFORME A/B:C*D' } }), 'INFORME A_B_C_D.docx');
  });

  test('si el almacén falla, el Word sale igual con avisos (nunca inventa imágenes)', async () => {
    const { exportarWord } = await import('../assets/js/ui/informe-brigada/exportar-word.js');
    const r = await exportarWord({ documento: documentoDePrueba(), resolverBytes: async () => { throw new Error('red caída'); }, hornear: async (b) => b });
    assert.ok(r.avisos.some((a) => /No se pudieron leer las imágenes/.test(a)));
    assert.ok(r.bytes > 1000);
    await assert.rejects(() => exportarWord({ documento: null, resolverBytes: async () => new Map() }), /No hay informe/);
  });
});

describe('correcciones de la revisión de fidelidad (Word = papel)', () => {
  test('rótulos de la Tabla 1 en Arial Narrow Bold 11 (sz 22), aunque la tabla sea de 10', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    const i = doc.indexOf('MATRICULA</w:t>');
    const run = doc.slice(doc.lastIndexOf('<w:r>', i), i);
    assert.match(run, /<w:b\/>/);
    assert.match(run, /<w:sz w:val="22"\/>/);
  });

  test('tres fotos en x0 = 64,3 pt (como el papel), no centradas: sangría −20,7 pt', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.match(doc, /<w:tblInd w:w="-414" w:type="dxa"\/>/);
  });

  test('la foto va arriba a la izquierda (vAlign top, 5,2 pt) y el extra inferior NO se suma otra vez como margen', async () => {
    const { doc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    const celdaFoto = doc.slice(doc.indexOf('<w:tc>', doc.indexOf('<w:tblInd w:w="-392"')), doc.indexOf('</w:tc>', doc.indexOf('<w:tblInd w:w="-392"')));
    assert.match(celdaFoto, /<w:vAlign w:val="top"\/>/);
    assert.match(celdaFoto, /<w:left w:w="104" w:type="dxa"\/>/);
    assert.match(celdaFoto, /<w:bottom w:w="0" w:type="dxa"\/>/);
  });

  test('anexo: el ancho que calculó el Documento (el mismo del papel), sin recortarlo a 585 pt', async () => {
    const d = documentoDePrueba();
    d.bloques.find((b) => b.clave === 'ficha_actual').anchoPt = undefined;   // a todo el ancho: 441,9 × 591,0 pt
    const { doc } = await abrir(d, imagenesDePrueba());
    assert.ok(doc.includes(`cx="${Math.round(441.9 * 12700)}" cy="${Math.round((441.9 * 1538 / 1150) * 12700)}"`), 'ficha a 441,9 × 591,0 pt');
  });

  test('marca de agua como el papel: −52°, rojo C80000 al 14 %, Arial negrita, centrada en la HOJA', async () => {
    const { enc } = await abrir(documentoDePrueba(), imagenesDePrueba());
    assert.match(enc, /rotation:308;/);
    assert.match(enc, /fillcolor="#C80000"/);
    assert.match(enc, /<v:fill opacity="\.14"\/>/);
    assert.match(enc, /mso-position-horizontal-relative:page;mso-position-vertical:center;mso-position-vertical-relative:page/);
    assert.match(enc, /font-family:&quot;Arial&quot;;font-size:1pt;font-weight:bold/);
  });

  test('portada: un dato muy largo se COMPRIME a lo ancho (no se parte en dos en su fila de alto fijo)', async () => {
    const d = documentoDePrueba();
    d.portada.datos[1] = [{ t: 'FABRICANTE DE NOMBRE MUY LARGO PRUEBA S.A.S. 10 / 14 MVA SERIE: SERIE-PRUEBA-0000000001', esc: 0.905 }];
    const { doc } = await abrir(d, imagenesDePrueba());
    const i = doc.indexOf('FABRICANTE DE NOMBRE MUY LARGO');
    const run = doc.slice(doc.lastIndexOf('<w:r>', i), i);
    const w = Number((/<w:w w:val="(\d+)"\/>/.exec(run) || [])[1]);
    assert.ok(w > 0 && w < 90, 'escala ' + w);
    // un dato corto conserva su 90 %
    const j = doc.indexOf('MATRICULA: T9-Z/Z-PRU');
    assert.match(doc.slice(doc.lastIndexOf('<w:r>', j), j), /<w:w w:val="91"\/>|<w:w w:val="90"\/>/);
  });

  test('firma emitida CENTRADA bajo la fecha (centro x = 270,5 pt), como en el papel (§163.14)', async () => {
    const { doc } = await abrir(documentoDePrueba({ estado: 'emitido' }), imagenesDePrueba());
    const i = doc.indexOf('name="Firma elaborado');
    const ancla = doc.slice(doc.lastIndexOf('<wp:anchor', i), i);
    const x = Number((ancla.match(/<wp:positionH relativeFrom="page"><wp:posOffset>(-?\d+)<\/wp:posOffset>/) || [])[1]);
    const cx = Number((ancla.match(/<wp:extent cx="(\d+)"/) || [])[1]);
    assert.ok(x > 0 && cx > 0, 'ancla con posición y tamaño');
    assert.ok(Math.abs((x + cx / 2) / 12700 - 270.5) < 0.01, 'centro ' + (x + cx / 2) / 12700);
    assert.ok(cx / 12700 <= 92 + 1e-6, 'ancho dentro de la caja');
    assert.ok(Math.abs(cx / 12700 - tamanoFirma(6 / 8, FIRMA_PORTADA).ancho) < 0.01, 'sin tamaño del documento, el Word usa la caja NUEVA');
  });
  test('firma emitida: con el tamaño y el borde que calcula el documento, el Word usa ESOS números', async () => {
    const d = documentoDePrueba({ estado: 'emitido' });
    d.portada.firmas[0] = { ...d.portada.firmas[0], firmaTamPt: { ancho: 80, alto: 20 }, firmaXPt: 225 };   // 225 ≠ 270,5 − 40: prueba que LEE firmaXPt
    const { doc } = await abrir(d, imagenesDePrueba());
    const i = doc.indexOf('name="Firma elaborado');
    const ancla = doc.slice(doc.lastIndexOf('<wp:anchor', i), i);
    assert.match(ancla, new RegExp(`<wp:positionH relativeFrom="page"><wp:posOffset>${Math.round(225 * 12700)}</wp:posOffset>`));
    assert.match(ancla, new RegExp(`<wp:extent cx="${Math.round(80 * 12700)}" cy="${Math.round(20 * 12700)}"`));
  });
  test('nombre muy largo junto a una firma ancha: se comprime para terminar antes de ella; uno corto no se toca (§163.14)', async () => {
    const d = documentoDePrueba({ estado: 'emitido' });
    const largo = 'NOMBRE PRUEBA SEGUNDO APELLIDO LARGUISIMO';
    d.portada.firmas[0] = { ...d.portada.firmas[0], nombre: largo, firmaTamPt: { ancho: 92, alto: 20 }, firmaXPt: 224.5 };
    const { doc } = await abrir(d, imagenesDePrueba());
    const j = doc.indexOf(largo);
    const w = Number((doc.slice(doc.lastIndexOf('<w:r>', j), j).match(/<w:w w:val="(\d+)"\/>/) || [])[1]);
    assert.ok(w > 0 && w < 100, 'comprimido: ' + w);
    const d2 = documentoDePrueba({ estado: 'emitido' });
    d2.portada.firmas[0] = { ...d2.portada.firmas[0], firmaTamPt: { ancho: 92, alto: 20 }, firmaXPt: 224.5 };
    const r2 = await abrir(d2, imagenesDePrueba());
    const k = r2.doc.indexOf('INGENIERO PRUEBA UNO');
    assert.doesNotMatch(r2.doc.slice(r2.doc.lastIndexOf('<w:r>', k), k), /<w:w /, 'un nombre corto queda igual');
  });
});
