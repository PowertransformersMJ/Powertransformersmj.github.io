// Informe de Mantenimiento Brigada · INTEGRACIÓN de los cuatro frentes, con los módulos
// REALES (sin dobles): dominio (modelo, plantilla, documento), datos (repositorio y almacén
// locales), Word (docx + zip + png). Es la costura que ninguna prueba de un solo frente ve:
//   configuración (logos y firmante) → informe completo → imágenes en el almacén →
//   crear → guardar → emitir (firmas que se estampan) → versión congelada →
//   construirDocumento → refsDelDocumento → metaDeRef / resolverUrls / resolverBytes → Word.
// Datos INVENTADOS (fixture del dominio); imágenes = PNG de color generados aquí. Cero red.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import * as M from '../assets/js/domain/informe_brigada_modelo.js';
import { MARCA_CLAVES, SECCIONES_FIGURAS } from '../assets/js/domain/informe_brigada_plantilla.js';
import { construirDocumento, refsDelDocumento, metaDeRef } from '../assets/js/domain/informe_brigada_documento.js';
import { nuevoIdArchivo, idFicha, claveFirmante, firmasParaEmitir } from '../assets/js/domain/informe_brigada_rutas.js';
import { docxBytes, refsDeImagenes } from '../assets/js/domain/informe_brigada_docx.js';
import { pngColor } from '../assets/js/domain/png_simple.js';
import { crearRepositorio } from '../assets/js/data/informes_brigada_local.js';
import { crearAlmacen, resolverUrls, resolverBytes } from '../assets/js/data/informes_brigada_almacen.js';
import { contenidoCompletoEjemplo } from './informe_brigada_fixture.js';

/** localStorage de mentira. */
class Memoria {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

const SESION = { uid: 'uid-editor-1', nombre: 'Editor Prueba', rol: 'admin' };   // editor del fixture y administrador
const AUTOR = { uid: SESION.uid, nombre: SESION.nombre };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const png = (w, h, color) => pngColor(w, h, color);
const meta = (b, w, h, extra = {}) => ({ mime: 'image/png', ancho: w, alto: h, tamano: b.length, huella: sha(b), ...extra });
const blob = (b) => new Blob([b], { type: 'image/png' });

/** Arma TODO el recorrido y devuelve las piezas para revisarlas. */
async function recorrido() {
  const repo = crearRepositorio({ sesion: () => SESION, almacenamiento: new Memoria() });
  const almacen = crearAlmacen({ modo: 'local', nuevo: true });
  const almacenes = { local: almacen };

  // 1 · configuración (admin): contrato, 5 logos y un firmante con su firma
  let config = (await repo.leerConfig()).config;
  const marca = {};
  for (const [i, k] of MARCA_CLAVES.entries()) {
    const b = png(60 + i, 24, '#FB6600');
    marca[k] = await almacen.subirLogo(k, blob(b), meta(b, 60 + i, 24), AUTOR);
  }
  const bf = png(50, 20, '#1A237E');
  const clave = claveFirmante('FIRMANTE PRUEBA');
  const firma = await almacen.subirFirma(clave, blob(bf), meta(bf, 50, 20, { autorizacion: { fecha: '2026-01-15', medio: 'correo de prueba' } }), AUTOR);
  await repo.guardarConfig({ ...config, contrato_defecto: '9900000001', marca, firmantes: [{ clave, nombre: 'FIRMANTE PRUEBA', cargo: 'Cargo de prueba', firma }] });
  config = (await repo.leerConfig()).config;

  // 2 · el informe completo del fixture, con sus imágenes subidas DE VERDAD al almacén
  let c = contenidoCompletoEjemplo();
  const inf = await repo.crear({
    equipo_ref: { transformador_id: c.equipo.transformador_id, matricula: c.equipo.matricula, subestacion: c.equipo.subestacion, serie: c.equipo.serie },
    actividad: c.actividad, modelo: c.modelo, contenido: c
  });
  c = { ...c, archivos: {} };
  let n = 0;
  for (const s of SECCIONES_FIGURAS) {
    for (const [g, cu] of c.figuras[s].entries()) {
      for (const [f, fig] of cu.figuras.entries()) {
        for (let k = 0; k < fig.fotos.length; k++) {
          const b = png(30, 40, ['#336699', '#669933', '#993366'][n++ % 3]);
          const aid = nuevoIdArchivo();
          c = M.registrarArchivo(c, aid, await almacen.subirArchivo(inf.id, aid, blob(b), meta(b, 30, 40), AUTOR));
          const marcas = fig.fotos[k].marcas;
          c = M.ponerFoto(c, { seccion: s, g, f, k }, aid);
          if (marcas && marcas.length) c = M.cambiarCampo(c, `figuras.${s}.${g}.figuras.${f}.fotos.${k}.marcas`, marcas);
        }
      }
    }
  }
  const bc = png(118, 89, '#FFFFFF');
  const aidc = nuevoIdArchivo();
  c = M.registrarArchivo(c, aidc, await almacen.subirArchivo(inf.id, aidc, blob(bc), meta(bc, 118, 89), AUTOR));
  c = M.cambiarCampo(c, 'anexos.0.archivo', aidc);
  for (const [i, modelo] of [[1, 'VA-50'], [2, 'VX-100']]) {
    const b = png(40, 52, '#DDDDDD');
    const fichaId = idFicha('MARCA-PRUEBA', modelo, sha(b));
    const m = await almacen.subirFicha(fichaId, blob(b), meta(b, 40, 52), AUTOR);
    await repo.registrarFicha({ id: fichaId, titulo: 'FICHA ' + modelo, marca: 'MARCA-PRUEBA', modelo, ...m });
    c = M.cambiarCampo(c, `anexos.${i}.ficha`, { id: fichaId, titulo: 'FICHA ' + modelo, almacen: m.almacen, ruta: m.ruta, mime: m.mime, ancho: m.ancho, alto: m.alto, huella: m.huella });
  }
  c = M.asignarFirmante(c, 'elaborado', config.firmantes[0]);

  // 3 · guardar y emitir (lo que hace editor.js al pulsar «Emitir versión 1»)
  const rev = (await repo.guardar(inf.id, c, inf.rev)).rev;
  const borrador = await repo.obtener(inf.id);
  const firmas = firmasParaEmitir(c, config);
  const huella = await M.huellaContenido(c);
  const r = await repo.emitir(inf.id, { contenido: c, revEsperada: rev, motivo: '', firmas, marca: config.marca, huella });
  const versionDoc = await repo.obtenerVersion(inf.id, r.version);
  return { repo, almacenes, config, c, borrador, firmas, versionDoc, version: r.version, huella };
}

describe('integración: contenido → datos → Documento → papel y Word', () => {
  test('el informe completo del fixture no tiene faltantes que bloqueen con la configuración real', async () => {
    const e = await recorrido();
    const bloq = M.faltantes(e.c, { config: e.config }).filter((x) => x.bloquea);
    assert.deepEqual(bloq.map((x) => x.ruta), []);
    assert.equal(e.firmas.length, 1, 'se estampa solo la firma registrada de «Elaborado»');
    assert.equal(e.versionDoc.huella, e.huella);
    assert.deepEqual(e.versionDoc.contenido, e.c, 'la versión emitida queda congelada con el mismo contenido');
  });

  test('EMITIDO: cada ref del Documento tiene meta, URL y bytes; la firma sale; el Word abre', async () => {
    const e = await recorrido();
    const contenido = e.versionDoc.contenido;
    const documento = construirDocumento(contenido, { estado: 'emitido', version: e.version, versionDoc: e.versionDoc });
    assert.equal(documento.meta.marcaAgua, null);
    const refs = refsDelDocumento(documento);
    assert.ok(refs.includes('firma:elaborado'));
    for (const ref of refs) assert.ok(metaDeRef(ref, { contenido, config: e.config, versionDoc: e.versionDoc }), 'sin meta: ' + ref);
    const urls = await resolverUrls(refs, { contenido, config: e.config, versionDoc: e.versionDoc, almacenes: e.almacenes });
    assert.deepEqual(refs.filter((x) => !urls.get(x)), [], 'toda imagen tiene URL');
    assert.deepEqual(urls.avisos, []);
    const bytes = await resolverBytes(refsDeImagenes(documento), { contenido, config: e.config, versionDoc: e.versionDoc, almacenes: e.almacenes });
    assert.deepEqual([...bytes.entries()].filter(([, v]) => !v).map(([k]) => k), [], 'toda imagen tiene bytes');
    const zip = await JSZip.loadAsync(docxBytes(documento, bytes));
    const doc = await zip.file('word/document.xml').async('string');
    assert.ok(!doc.includes('[Foto pendiente]'));
    assert.match(doc, /name="Firma elaborado/);
    const enc = (await Promise.all(Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f)).map((f) => zip.file(f).async('string')))).join('');
    assert.ok(!enc.includes('BORRADOR'));
  });

  test('BORRADOR: sin firma aunque el firmante tenga imagen, con marca de agua (decisión 4)', async () => {
    const e = await recorrido();
    const contenido = e.borrador.contenido;
    const documento = construirDocumento(contenido, { estado: 'borrador', version: 0 });
    assert.equal(documento.meta.marcaAgua, 'BORRADOR · SIN EMITIR');
    assert.ok(documento.portada.firmas.every((f) => f.firmaRef == null && f.fecha == null));
    assert.ok(!refsDelDocumento(documento).some((r) => r.startsWith('firma:')));
    const urls = await resolverUrls(['firma:elaborado'], { contenido, config: e.config, versionDoc: null, almacenes: e.almacenes });
    assert.equal(urls.get('firma:elaborado'), null);
    const bytes = await resolverBytes(refsDeImagenes(documento), { contenido, config: e.config, almacenes: e.almacenes });
    const zip = await JSZip.loadAsync(docxBytes(documento, bytes));
    const enc = (await Promise.all(Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f)).map((f) => zip.file(f).async('string')))).join('');
    assert.ok(enc.includes('BORRADOR · SIN EMITIR'));
    assert.doesNotMatch(await zip.file('word/document.xml').async('string'), /name="Firma /);
  });
});
