// Informe de Mantenimiento Brigada · repositorio LOCAL y almacén LOCAL, de punta
// a punta en node: crear, guardar con rev, choque, emitir, corregir, anular,
// versiones, respaldo; subir imágenes (con el control de metadatos de cámara) y
// resolver las referencias del papel (firmas solo emitidas). Cero red.
// Datos INVENTADOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { crearRepositorio, guardarRespaldo, leerRespaldo, borrarRespaldo } from '../assets/js/data/informes_brigada_local.js';
import { crearAlmacen, resolverUrls, resolverBytes } from '../assets/js/data/informes_brigada_almacen.js';
import { ACTIVIDAD_REFRIGERACION, CLAVE_LOCAL, ErrorIBR, nuevoIdArchivo, rutaFirma } from '../assets/js/domain/informe_brigada_rutas.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** localStorage de mentira (con opción de «lleno»). */
class Memoria {
  constructor({ lleno = false } = {}) { this.m = new Map(); this.lleno = lleno; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.lleno) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

const EDITOR = { uid: 'uid-editor-1', nombre: 'Editor Prueba', rol: 'tecnico' };
const ADMIN = { uid: 'uid-admin-1', nombre: 'Admin Prueba', rol: 'admin' };
const TECNICO = { uid: 'uid-tecnico-1', nombre: 'Tecnico Prueba', rol: 'tecnico' };
const H = 'ab'.repeat(32);
const EQUIPO = { transformador_id: 'tx-prueba-1', matricula: 'T9-Z/Z-PRU', subestacion: 'Prueba Norte', serie: 'SERIE-PRUEBA-001' };
const contenido = (extra = {}) => ({ esquema: 'ibr@1', equipo: { matricula: 'T9-Z/Z-PRU' }, odt: ['ODT-PRUEBA-1'], firmas: {}, ...extra });
const NUEVO = () => ({ equipo_ref: EQUIPO, actividad: ACTIVIDAD_REFRIGERACION, modelo: 'F60-REFRIG@1', contenido: contenido() });
const sha = (b) => createHash('sha256').update(b).digest('hex');

async function esError(promesa, cod) {
  await assert.rejects(promesa, (e) => e instanceof ErrorIBR && e.codigo === cod);
}

/** Repositorio con una sesión que se puede cambiar a mitad de prueba. */
function repo(opciones = {}) {
  const s = { actual: EDITOR };
  const r = crearRepositorio({ sesion: () => s.actual, almacenamiento: new Memoria(), ...opciones });
  return { r, como: (x) => { s.actual = x; } };
}

describe('repositorio local: el ciclo completo de un informe', () => {
  test('config de vista previa: quien tiene la sesión es editor, almacén local', async () => {
    const { r } = repo();
    const c = await r.leerConfig();
    assert.equal(c.estado, 'ok');
    assert.deepEqual(c.config.editores, ['uid-editor-1']);
    assert.equal(c.config.almacen, 'local');
    assert.equal(r.modo, 'local');
  });

  test('crear → guardar (rev) → choque → emitir v1 → corregir → emitir v2 → anular', async () => {
    const { r, como } = repo();
    const inf = await r.crear(NUEVO());
    assert.match(inf.id, /^local-[A-Za-z0-9]{16}$/);
    assert.equal(inf.estado, 'borrador');
    assert.equal(inf.rev, 1);
    assert.equal(inf.version, 0);
    assert.deepEqual(inf.creadoPor, { uid: 'uid-editor-1', nombre: 'Editor Prueba' });
    assert.deepEqual((await r.listarDeEquipo('T9-Z/Z-PRU')).map((x) => x.id), [inf.id]);
    assert.deepEqual(await r.listarDeEquipo('OTRA'), []);

    const g = await r.guardar(inf.id, contenido({ nota: 'uno' }), 1);
    assert.equal(g.rev, 2);
    // otra pantalla con el rev viejo choca y no pisa
    await esError(r.guardar(inf.id, contenido({ nota: 'pisada' }), 1), 'conflicto');
    assert.equal((await r.obtener(inf.id)).contenido.nota, 'uno');

    const e1 = await r.emitir(inf.id, { contenido: contenido({ nota: 'final' }), revEsperada: 2, huella: H });
    assert.deepEqual(e1, { version: 1, rev: 3 });
    const emitido = await r.obtener(inf.id);
    assert.equal(emitido.estado, 'emitido');
    assert.deepEqual(emitido.emitidoPor, { uid: 'uid-editor-1', nombre: 'Editor Prueba' });
    await esError(r.guardar(inf.id, contenido(), 3), 'estado');
    const v1 = await r.obtenerVersion(inf.id, 1);
    assert.equal(v1.contenido.nota, 'final');
    assert.equal(v1.huella, H);

    assert.deepEqual(await r.corregir(inf.id, 3), { rev: 4 });
    assert.equal((await r.obtener(inf.id)).estado, 'borrador');
    assert.equal((await r.obtener(inf.id)).version, 1);
    await esError(r.emitir(inf.id, { contenido: contenido(), revEsperada: 4, huella: H, motivo: 'corto' }), 'validacion');
    assert.deepEqual(await r.emitir(inf.id, { contenido: contenido({ nota: 'v2' }), revEsperada: 4, huella: H, motivo: 'Corrige la tabla de corrientes' }), { version: 2, rev: 5 });
    assert.deepEqual((await r.listarVersiones(inf.id)).map((v) => v.version), [2, 1]);
    assert.equal((await r.obtenerVersion(inf.id, 1)).contenido.nota, 'final', 'la v1 sigue congelada');

    como(EDITOR);
    await esError(r.anular(inf.id, 5, 'Equipo equivocado en la prueba'), 'sin_permiso');
    como(ADMIN);
    await esError(r.anular(inf.id, 5, 'corto'), 'validacion');
    assert.deepEqual(await r.anular(inf.id, 5, 'Equipo equivocado en la prueba'), { rev: 6 });
    const anulado = await r.obtener(inf.id);
    assert.equal(anulado.estado, 'anulado');
    assert.equal(anulado.anulacion.motivo, 'Equipo equivocado en la prueba');
    assert.equal(anulado.contenido.nota, 'v2', 'anular no cambia el contenido');
    como(EDITOR);
    await esError(r.corregir(inf.id, 6), 'estado');
  });

  test('solo los editores arman; solo un admin configura', async () => {
    const { r, como } = repo();
    como(TECNICO);
    await esError(r.guardarConfig({ editores: ['uid-tecnico-1'] }), 'sin_permiso');
    como(ADMIN);
    await r.guardarConfig({ editores: ['uid-editor-1'], contrato_defecto: '9900000001', almacen: 'local' });
    const c = (await r.leerConfig()).config;
    assert.deepEqual(c.editores, ['uid-editor-1']);
    assert.equal(c.contrato_defecto, '9900000001');
    assert.equal(c.almacen, 'local', 'en la vista previa el almacén siempre es local');
    await esError(r.crear(NUEVO()), 'sin_permiso');   // el admin no está en la lista
    await esError(r.guardarConfig({ editores: Array.from({ length: 11 }, (_, i) => 'u' + i) }), 'validacion');
    como(TECNICO);
    await esError(r.crear(NUEVO()), 'sin_permiso');
    como(EDITOR);
    assert.equal((await r.crear(NUEVO())).estado, 'borrador');
    // Actividad de la lista o escrita a mano (2026-10-26): crea con el F60 y se guarda normalizada; la inválida no.
    assert.equal((await r.crear({ ...NUEVO(), actividad: 'Mantenimiento de rutina PSM.' })).actividad, 'Mantenimiento de rutina PSM.');
    const mano = await r.crear({ ...NUEVO(), actividad: '  Cambio  de bujes de baja tensión ' });
    assert.equal(mano.actividad, 'Cambio de bujes de baja tensión');
    assert.equal(mano.modelo, 'F60-REFRIG@1');
    assert.equal((await r.obtener(mano.id)).actividad, 'Cambio de bujes de baja tensión');
    for (const mala of ['', 'ab', 'x'.repeat(201), 'Primera línea\nSegunda línea']) await esError(r.crear({ ...NUEVO(), actividad: mala }), 'validacion');
  });

  test('lo armado sobrevive a recargar; si el navegador no deja guardar, sigue en memoria y lo dice', async () => {
    const disco = new Memoria();
    const a = crearRepositorio({ sesion: () => EDITOR, almacenamiento: disco });
    const inf = await a.crear(NUEVO());
    assert.ok(JSON.parse(disco.getItem(CLAVE_LOCAL)).informes[inf.id]);
    const b = crearRepositorio({ sesion: () => EDITOR, almacenamiento: disco });
    assert.equal((await b.obtener(inf.id)).id, inf.id);
    assert.equal(b.persistente, true);

    const lleno = crearRepositorio({ sesion: () => EDITOR, almacenamiento: new Memoria({ lleno: true }) });
    const x = await lleno.crear(NUEVO());
    assert.equal(lleno.persistente, false);
    assert.equal((await lleno.obtener(x.id)).id, x.id);
    const sinDisco = crearRepositorio({ sesion: () => EDITOR, almacenamiento: null });
    await sinDisco.crear(NUEVO());
    assert.equal(sinDisco.persistente, false);

    const roto = new Memoria();
    roto.setItem(CLAVE_LOCAL, '{no es json');
    assert.deepEqual(await crearRepositorio({ sesion: () => EDITOR, almacenamiento: roto }).listarRecientes(), []);
  });

  test('lo que devuelve es una copia: tocarla no cambia lo guardado', async () => {
    const { r } = repo();
    const inf = await r.crear(NUEVO());
    inf.contenido.odt.push('INVENTADA');
    inf.estado = 'emitido';
    const otra = await r.obtener(inf.id);
    assert.deepEqual(otra.contenido.odt, ['ODT-PRUEBA-1']);
    assert.equal(otra.estado, 'borrador');
  });

  test('acciones de refrigeración: solo lectura, con tope 5; si fallan, [] con aviso', async () => {
    const accion = { id: 'acc-1', fecha_accion: '2026-03-15', estado_accion: 'ejecutada', accion_descripcion: 'Prueba inventada', kva_onan: 10000, kva_onaf: 14000,
      mix: [{ marca: 'MARCA-PRUEBA', modelo: 'VX-100', cfm_unitario: 7000, cantidad: 4, ficha: { x: 1 } }] };
    const antes = structuredClone(accion);
    let pedido = null;
    const { r } = repo({ lectorAcciones: async (f) => { pedido = f; return [accion]; } });
    const l = await r.listarAcciones('T9-Z/Z-PRU');
    assert.deepEqual(pedido, { transformador_id: 'T9-Z/Z-PRU', limite: 5 });
    assert.equal(l[0].mix[0].cfm_unitario, 7000);
    assert.deepEqual(accion, antes, 'la acción no se toca');
    const { r: r2 } = repo({ lectorAcciones: async () => { throw new Error('sin red'); } });
    const vacio = await r2.listarAcciones('T9-Z/Z-PRU');
    assert.deepEqual([...vacio], []);
    assert.match(vacio.error, /No se pudieron leer/);
    assert.deepEqual(await r2.listarAcciones(''), []);
  });

  test('biblioteca de fichas: título, id y huella; registrar dos veces no duplica', async () => {
    const { r } = repo();
    const f = { id: 'ficha_marca-prueba_vx-100_abababab', titulo: 'Ficha VX-100 de prueba', marca: 'MARCA-PRUEBA', modelo: 'VX-100', almacen: 'local', ruta: 'informes_brigada_marca/fichas/ficha_marca-prueba_vx-100_abababab', mime: 'image/png', ancho: 800, alto: 1000, tamano: 1234, huella: H };
    await r.registrarFicha(f);
    await r.registrarFicha({ ...f, titulo: 'Otro título' });
    await r.registrarFicha({ ...f, id: 'ficha_a_b_00000000', titulo: 'Anterior alfabéticamente' });
    const l = await r.listarFichas();
    assert.deepEqual(l.map((x) => x.titulo), ['Anterior alfabéticamente', 'Ficha VX-100 de prueba']);
    await esError(r.registrarFicha({ ...f, id: 'Con Espacios' }), 'validacion');
    await esError(r.registrarFicha({ ...f, titulo: 'ab' }), 'validacion');
    await esError(r.registrarFicha({ ...f, huella: 'x' }), 'validacion');
  });

  test('respaldo ante un choque: se guarda, se lee y se borra', () => {
    const m = new Memoria();
    assert.equal(guardarRespaldo('inf-1', contenido({ nota: 'mía' }), m), true);
    assert.equal(leerRespaldo('inf-1', m).contenido.nota, 'mía');
    borrarRespaldo('inf-1', m);
    assert.equal(leerRespaldo('inf-1', m), null);
    assert.equal(guardarRespaldo('inf-1', {}, new Memoria({ lleno: true })), false);
    assert.equal(guardarRespaldo('inf-1', {}, null), false);
  });
});

/* ── imágenes sintéticas ───────────────────────────────────────────────────── */
const APP0 = [0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
const SOS = [0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x11, 0x22, 0x33, 0xFF, 0xD9];
const EXIF = [0xFF, 0xE1, 0x00, 0x0E, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x08];
const jpeg = (...seg) => new Uint8Array([0xFF, 0xD8, ...APP0, ...seg.flat(), ...SOS]);
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const blob = (u8, type) => new Blob([u8], { type });
const metaDe = (u8, mime, extra = {}) => ({ mime, ancho: 1600, alto: 1200, tamano: u8.length, huella: sha(u8), ...extra });

/** metaDeRef de prueba con la semántica de §3.3 del plan (la real es de B1). */
function metaDeRefPrueba(ref, { contenido: c, config, versionDoc }) {
  const [tipo, id] = String(ref).split(':');
  if (tipo === 'archivo') return (c.archivos || {})[id] || null;
  if (tipo === 'ficha') return ((c.anexos || []).find((a) => a.clave === id) || {}).ficha || null;
  if (tipo === 'marca') return ((versionDoc ? versionDoc.marca : config.marca) || {})[id] || null;
  if (tipo === 'firma') return versionDoc ? ((versionDoc.firmas || []).find((f) => f.rol === id) || {}).firma || null : null;
  return null;
}

describe('almacén local: el último control antes de guardar una imagen', () => {
  test('una foto limpia entra; su meta trae la huella real y se lee igual', async () => {
    const a = crearAlmacen({ modo: 'local', nuevo: true });
    const u8 = jpeg();
    const aid = nuevoIdArchivo();
    let progreso = 0;
    const meta = await a.subirArchivo('local-PRUEBA', aid, blob(u8, 'image/jpeg'), metaDe(u8, 'image/jpeg'), EDITOR, { alProgreso: (x) => { progreso = x; } });
    assert.equal(meta.almacen, 'local');
    assert.equal(meta.ruta, `informes_brigada/local-PRUEBA/archivos/${aid}`);
    assert.equal(meta.huella, sha(u8));
    assert.equal(meta.tamano, u8.length);
    assert.deepEqual(meta.subidoPor, { uid: 'uid-editor-1', nombre: 'Editor Prueba' });
    assert.equal(progreso, 1);
    assert.match(await a.url(meta), /^blob:/);
    assert.deepEqual([...await a.bytes(meta)], [...u8]);
    assert.equal(await a.borrarArchivo(meta), true);
    await esError(a.bytes(meta), 'no_existe');
  });

  test('se rechaza: con datos de cámara (GPS), tipo falso, tamaño o huella que no cuadran, GIF, demasiado grande', async () => {
    const a = crearAlmacen({ modo: 'local', nuevo: true });
    const sub = (u8, meta) => a.subirArchivo('local-PRUEBA', nuevoIdArchivo(), blob(u8, 'image/jpeg'), meta, EDITOR);
    const conExif = jpeg(EXIF);
    await esError(sub(conExif, metaDe(conExif, 'image/jpeg')), 'validacion');
    await esError(sub(jpeg(), metaDe(jpeg(), 'image/png')), 'validacion');
    await esError(sub(jpeg(), metaDe(jpeg(), 'image/jpeg', { tamano: 5 })), 'validacion');
    await esError(sub(jpeg(), metaDe(jpeg(), 'image/jpeg', { huella: H })), 'validacion');
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0]);
    await esError(sub(gif, metaDe(gif, 'image/gif')), 'validacion');
    const grande = new Uint8Array(700 * 1024 + 1); grande.set(jpeg());
    await esError(sub(grande, metaDe(grande, 'image/jpeg')), 'validacion');
    await esError(sub(jpeg(), metaDe(jpeg(), 'image/jpeg', { ancho: 0 })), 'validacion');
    await esError(a.subirArchivo('local-PRUEBA', 'mal', blob(jpeg(), 'image/jpeg'), metaDe(jpeg(), 'image/jpeg'), EDITOR), 'validacion');
  });

  test('sin sesión no sube; firmas solo PNG y con la autorización del titular; logos solo con su clave', async () => {
    const a = crearAlmacen({ modo: 'local', nuevo: true });
    const previa = globalThis.__sgmSession;
    delete globalThis.__sgmSession;
    await esError(a.subirArchivo('local-PRUEBA', nuevoIdArchivo(), blob(jpeg(), 'image/jpeg'), metaDe(jpeg(), 'image/jpeg')), 'sin_permiso');
    if (previa) globalThis.__sgmSession = previa;
    await esError(a.subirFirma('f-ana-prueba', blob(PNG, 'image/png'), metaDe(PNG, 'image/png'), ADMIN), 'validacion');
    await esError(a.subirFirma('f-ana-prueba', blob(jpeg(), 'image/jpeg'), metaDe(jpeg(), 'image/jpeg', { autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } }), ADMIN), 'validacion');
    const f = await a.subirFirma('f-ana-prueba', blob(PNG, 'image/png'), metaDe(PNG, 'image/png', { autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } }), ADMIN);
    assert.equal(f.ruta, rutaFirma('f-ana-prueba', sha(PNG)));
    assert.deepEqual(f.autorizacion, { fecha: '2026-10-01', medio: 'correo de prueba' });
    await esError(a.subirLogo('logo-inventado', blob(PNG, 'image/png'), metaDe(PNG, 'image/png'), ADMIN), 'validacion');
    const logo = await a.subirLogo('applus-portada', blob(PNG, 'image/png'), metaDe(PNG, 'image/png'), ADMIN);
    assert.equal(logo.ruta, `informes_brigada_marca/logos/applus-portada/${sha(PNG)}`);
    const ficha = await a.subirFicha('ficha_marca-prueba_vx-100_' + sha(PNG).slice(0, 8), blob(PNG, 'image/png'), metaDe(PNG, 'image/png'), EDITOR);
    assert.equal(ficha.almacen, 'local');
  });

  test('crearAlmacen: modo desconocido no; el mismo modo comparte memoria (las fotos locales viven ahí)', () => {
    assert.throws(() => crearAlmacen({ modo: 'nube' }), (e) => e.codigo === 'validacion');
    assert.equal(crearAlmacen({ modo: 'local' }), crearAlmacen({ modo: 'local' }));
    assert.notEqual(crearAlmacen({ modo: 'local', nuevo: true }), crearAlmacen({ modo: 'local' }));
  });
});

describe('resolver las referencias del papel', () => {
  async function escenario() {
    const a = crearAlmacen({ modo: 'local', nuevo: true });
    const u8 = jpeg();
    const aid = nuevoIdArchivo();
    const foto = await a.subirArchivo('local-PRUEBA', aid, blob(u8, 'image/jpeg'), metaDe(u8, 'image/jpeg'), EDITOR);
    const firma = await a.subirFirma('f-ana-prueba', blob(PNG, 'image/png'), metaDe(PNG, 'image/png', { autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } }), ADMIN);
    const logo = await a.subirLogo('applus-portada', blob(PNG, 'image/png'), metaDe(PNG, 'image/png'), ADMIN);
    const perdida = { ...foto, ruta: `informes_brigada/local-PRUEBA/archivos/${nuevoIdArchivo()}` };
    const desviada = { ...foto, ruta: firma.ruta };   // una «foto» de borrador que apunta a una firma
    const c = { archivos: { [aid]: foto, perdida, desviada }, anexos: [] };
    const config = { marca: { 'applus-portada': logo } };
    const versionDoc = { marca: { 'applus-portada': logo }, firmas: [{ rol: 'elaborado', clave: 'f-ana-prueba', nombre: 'ANA PRUEBA', firma }] };
    return { a, aid, foto, firma, logo, c, config, versionDoc, almacenes: { local: a } };
  }

  test('borrador: fotos y logos sí; la firma NO aunque exista (decisión 4)', async () => {
    const e = await escenario();
    const refs = [`archivo:${e.aid}`, 'marca:applus-portada', 'firma:elaborado', 'archivo:perdida', 'archivo:desviada', 'archivo:no-registrada'];
    const m = await resolverUrls(refs, { contenido: e.c, config: e.config, almacenes: e.almacenes, metaDeRef: metaDeRefPrueba });
    assert.match(m.get(`archivo:${e.aid}`), /^blob:/);
    assert.match(m.get('marca:applus-portada'), /^blob:/);
    assert.equal(m.get('firma:elaborado'), null);
    assert.equal(m.get('archivo:perdida'), null);
    assert.equal(m.get('archivo:desviada'), null);
    assert.equal(m.get('archivo:no-registrada'), null);
    assert.ok(m.avisos.some((x) => /No se pudieron leer 1 foto o anexo/.test(x)), m.avisos.join(' | '));
    assert.ok(m.avisos.some((x) => /carpeta que no le corresponde/.test(x)), m.avisos.join(' | '));
  });

  test('emitido: la firma se resuelve desde la versión; si su huella no cuadra, no se estampa', async () => {
    const e = await escenario();
    const m = await resolverUrls(['firma:elaborado'], { contenido: e.c, config: e.config, versionDoc: e.versionDoc, almacenes: e.almacenes, metaDeRef: metaDeRefPrueba });
    assert.match(m.get('firma:elaborado'), /^blob:/);
    const b = await resolverBytes(['firma:elaborado', `archivo:${e.aid}`], { contenido: e.c, config: e.config, versionDoc: e.versionDoc, almacenes: e.almacenes, metaDeRef: metaDeRefPrueba });
    assert.deepEqual([...b.get('firma:elaborado').bytes], [...PNG]);
    assert.equal(b.get(`archivo:${e.aid}`).mime, 'image/jpeg');
    const alterada = { ...e.versionDoc, firmas: [{ ...e.versionDoc.firmas[0], firma: { ...e.firma, huella: H } }] };
    const b2 = await resolverBytes(['firma:elaborado'], { contenido: e.c, config: e.config, versionDoc: alterada, almacenes: e.almacenes, metaDeRef: metaDeRefPrueba });
    assert.equal(b2.get('firma:elaborado'), null);
    assert.ok(b2.avisos.some((x) => /no coincide con su huella/.test(x)));
  });

  test('con el metaDeRef REAL del motor (si ya existe): mismas respuestas', { skip: !existsSync(resolve(RAIZ, 'assets/js/domain/informe_brigada_documento.js')) }, async () => {
    const { metaDeRef } = await import('../assets/js/domain/informe_brigada_documento.js');
    const e = await escenario();
    const ctx = { contenido: e.c, config: e.config, versionDoc: null };
    assert.deepEqual(metaDeRef(`archivo:${e.aid}`, ctx), e.foto);
    assert.deepEqual(metaDeRef('marca:applus-portada', ctx), e.logo);
    assert.equal(metaDeRef('firma:elaborado', ctx) || null, null, 'sin versión emitida, ninguna firma');
    assert.deepEqual(metaDeRef('firma:elaborado', { ...ctx, versionDoc: e.versionDoc }), e.firma);
    const m = await resolverUrls([`archivo:${e.aid}`, 'firma:elaborado'], { ...ctx, almacenes: e.almacenes });
    assert.match(m.get(`archivo:${e.aid}`), /^blob:/);
    assert.equal(m.get('firma:elaborado'), null);
  });
});

describe('correcciones de la revisión de flujo (modo local y respaldo)', () => {
  test('dos pestañas con el mismo informe: la segunda NO pisa en silencio lo que guardó la primera (choque por rev)', async () => {
    const disco = new Memoria();
    const a = crearRepositorio({ sesion: () => EDITOR, almacenamiento: disco });
    const b = crearRepositorio({ sesion: () => EDITOR, almacenamiento: disco });
    const inf = await a.crear(NUEVO());
    assert.ok(await b.obtener(inf.id), 'la otra pestaña ve el informe creado');
    assert.equal((await a.guardar(inf.id, contenido({ nota: 'pestaña A' }), 1)).rev, 2);
    await esError(b.guardar(inf.id, contenido({ nota: 'pestaña B con rev viejo' }), 1), 'conflicto');
    assert.equal((await b.obtener(inf.id)).contenido.nota, 'pestaña A');
    // y lo que guarda B con el rev al día no borra los informes que creó A
    const otro = await a.crear(NUEVO());
    assert.equal((await b.guardar(inf.id, contenido({ nota: 'B al día' }), 2)).rev, 3);
    assert.ok(await a.obtener(otro.id), 'el informe nuevo de A sigue ahí');
  });

  test('respaldo: guarda la BASE de la que partió y quién lo dejó (para recuperar sin pisar a otro)', () => {
    const disco = new Memoria();
    assert.ok(guardarRespaldo('inf-1', contenido({ nota: 'mio' }), disco, { base: contenido({ nota: 'base' }), revBase: 4, uid: 'uid-editor-1' }));
    const r = leerRespaldo('inf-1', disco);
    assert.equal(r.contenido.nota, 'mio');
    assert.equal(r.base.nota, 'base');
    assert.equal(r.revBase, 4);
    assert.equal(r.uid, 'uid-editor-1');
    // la forma vieja (sin extra) sigue funcionando
    assert.ok(guardarRespaldo('inf-2', contenido(), disco));
    assert.equal(leerRespaldo('inf-2', disco).base, undefined);
  });

  test('Storage: el enlace de cada foto se pide UNA vez por sesión (cada «Ver hojas» ya no vuelve a pedir ~30)', async () => {
    let pedidos = 0;
    const sdk = { ref: (_st, ruta) => ({ ruta }), getDownloadURL: async (r) => { pedidos += 1; return 'https://descarga.prueba/' + r.ruta; } };
    const al = crearAlmacen({ modo: 'storage', nuevo: true, storage: {}, sdkStorage: sdk });
    const meta = { almacen: 'storage', ruta: 'informes_brigada/inf-1/archivos/a' + 'B'.repeat(20) };
    assert.equal(await al.url(meta), 'https://descarga.prueba/' + meta.ruta);
    await al.url(meta); await al.url({ ...meta });
    assert.equal(pedidos, 1);
    al.liberar();
    await al.url(meta);
    assert.equal(pedidos, 2, 'liberar() olvida los enlaces');
  });

  test('almacén local: `tiene` dice si la imagen sigue en la memoria de la pestaña', async () => {
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
    const al = crearAlmacen({ modo: 'local', nuevo: true });
    const meta = await al.subirLogo('applus-portada', png, { mime: 'image/png', ancho: 1, alto: 1 }, { uid: 'uid-admin-1', nombre: 'Admin Prueba' });
    assert.equal(al.tiene(meta), true);
    assert.equal(crearAlmacen({ modo: 'local', nuevo: true }).tiene(meta), false, 'otra pestaña (o tras recargar): ya no está');
  });
});
