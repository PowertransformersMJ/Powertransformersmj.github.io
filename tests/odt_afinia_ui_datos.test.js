// Firma de ODT Afinia · CAPA DE DATOS con dobles de Firestore (sin navegador ni emulador).
// Comprueba que lo que se ENVÍA tiene exactamente la forma del contrato de las reglas
// (bloque odt_afinia de firestore.rules: size()==N + cada campo leído) y el flujo de punta
// a punta: publicar → leer (huellas) → firmar AZT → firmar Responsable → descargar.
// Que las reglas acepten esa forma lo prueba tests-rules/odt_afinia.rules.test.js.
// Datos inventados (repo público): uids uid-*-prueba, correos @prueba.test, N.º 00000001.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { armarOdt, pngFirma, PDFLib, NRO } from './odt_afinia_fixture.js';
import { crearFirestoreFalso, tokenFalso, TS, BytesFalso } from './odt_afinia_ui_dobles.js';
import {
  crearRepositorioOdt, conTope, MSG_FALTA_LISTA_BLANCA, MSG_SESION_ANTES_DE_PUBLICAR, MSG_SESION_ANTES_DEL_AZT, MSG_IDENTIDAD_CAMBIO, MSG_NO_EXISTE
} from '../assets/js/data/odt_afinia.js';
import { crearCuenta, claimsDe } from '../assets/js/data/odt_afinia_cuenta.js';
import { miFirmaOdt, HUELLA_MI_FIRMA_DISTINTA } from '../assets/js/data/odt_afinia_mi_firma.js';
import { ErrorOdt, planPublicacion, documentoHabilitacion } from '../assets/js/data/odt_afinia_lotes.js';
import { prepararFirma, verificarAntesDeFirmar, descargarOdt, prepararDescarga } from '../assets/js/ui/odt-afinia/preparar.js';
import { validarOdt } from '../assets/js/domain/odt_afinia_formato.js';
import { prepararPartes } from '../assets/js/domain/odt_afinia_partes.js';
import { textoAcuerdo, declaracionAzt, declaracionResponsable, fechaBogota } from '../assets/js/domain/odt_afinia_textos.js';
import { ZONAS_MEDIDAS } from '../assets/js/domain/odt_afinia_zonas.js';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba', correoPerfil: 'admin@prueba.test', rol: 'admin', activo: true, esAdmin: true, legacy: false };
const AZT = { uid: 'uid-azt-prueba', nombre: 'Azt De Prueba', correoPerfil: 'azt@prueba.test', rol: 'tecnico', activo: true, esAdmin: false, legacy: false };
const RESP = { uid: 'uid-resp-prueba', nombre: 'Resp De Prueba', correoPerfil: 'resp@prueba.test', rol: 'tecnico', activo: true, esAdmin: false, legacy: false };
const correoDe = (s) => s.correoPerfil;
const FORM = { nro: NRO, consignacion: 'C-0001', subestacion: 'S/E Sintética', equipo: 'TR-Prueba', fechaTrabajo: '01/01/2026' };

const claves = (o) => Object.keys(o).sort();

/** Base con habilitaciones de AZT y Responsable y su «Mi firma» subida DESPUÉS. */
async function escenario(op = {}) {
  const fs = crearFirestoreFalso(op);
  for (const s of [AZT, RESP]) {
    fs.poner('odt_afinia_firmantes/' + s.uid, { uid: s.uid, nombre: s.nombre, correo: correoDe(s), en: TS });
  }
  // Lista blanca por rol (la escribe el Ingeniero en la consola) y perfiles activos.
  fs.poner('odt_afinia_config/firmantes', { azt: [AZT.uid], responsable: [RESP.uid, ADMIN.uid] });
  for (const s of [ADMIN, AZT, RESP]) fs.poner('usuarios/' + s.uid, { nombre: s.nombre, rol: s.rol, activo: true });
  const pngs = { [AZT.uid]: pngFirma(240, 90, 1), [RESP.uid]: pngFirma(200, 80, 2) };
  for (const s of [AZT, RESP]) fs.poner('firmas/' + s.uid, { imagen: BytesFalso.fromUint8Array(pngs[s.uid]), huella: sha(pngs[s.uid]), en: TS });
  const { bytes, estructura } = await armarOdt();
  const v = validarOdt(estructura, { nro: NRO });
  assert.ok(v.ok, 'la ODT sintética es válida');
  const repo = (s, extra = {}) => crearRepositorioOdt({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30, ...extra });
  return { fs, bytes, zonas: v.zonas, pngs, repo };
}

async function publicada(e) {
  const r = e.repo(ADMIN);
  const habs = await r.listarHabilitados();
  const firmantes = { azt: habs.find((h) => h.uid === AZT.uid), responsable: habs.find((h) => h.uid === RESP.uid) };
  const preparado = await prepararPartes(e.bytes);
  const { id } = await r.publicar({ form: FORM, preparado, zonas: e.zonas, firmantes });
  return { id, preparado, firmantes };
}

async function prepararDe(e, s, id, extra = {}) {
  const r = e.repo(s);
  const { odt, bytesV0 } = await r.leerOdt(id);
  const actos = await r.leerActos(id);
  const miFirma = await miFirmaOdt({ sdk: e.fs.F, db: e.fs.db, sesion: () => s });
  const habilitacion = await r.leerHabilitacion();
  const c = await prepararFirma({ odt, bytesV0, actos, sesion: s, correo: correoDe(s), miFirma, habilitacion, PDFLib, ...extra });
  return { r, c, odt, bytesV0, actos };
}

describe('habilitación: odt_afinia_firmantes/{uid} con 9 campos exactos', () => {
  test('documento y ruta', async () => {
    const fs = crearFirestoreFalso();
    const r = crearRepositorioOdt({ sdk: fs.F, db: fs.db, sesion: () => AZT });
    const tk = tokenFalso({ uid: AZT.uid, email: correoDe(AZT) });
    await r.habilitarme(tk);
    assert.equal(fs.lotes.length, 1);
    const op = fs.lotes[0].ops[0];
    assert.equal(op.ruta, 'odt_afinia_firmantes/' + AZT.uid);
    assert.deepEqual(claves(op.datos), ['acuerdo', 'acuerdoVersion', 'authTime', 'correo', 'correoVerificado', 'en', 'nombre', 'proveedor', 'uid']);
    assert.equal(op.datos.acuerdo, textoAcuerdo({ nombre: AZT.nombre, correo: correoDe(AZT) }));
    assert.equal(op.datos.acuerdoVersion, 'odt-acuerdo-v1');
    assert.equal(op.datos.authTime, tk.auth_time);
    assert.ok(Number.isInteger(op.datos.authTime));
    assert.equal(op.datos.en, TS);
    assert.equal(op.datos.proveedor, 'password');
    assert.equal(op.datos.correoVerificado, true);
  });
  test('sin correo verificado o sin contraseña: no se escribe', async () => {
    assert.throws(() => documentoHabilitacion({ uid: 'u', nombre: 'Nombre Prueba', token: tokenFalso({ email_verified: false }), ts: TS }), ErrorOdt);
    assert.throws(() => documentoHabilitacion({ uid: 'u', nombre: 'Nombre Prueba', token: tokenFalso({ sign_in_provider: 'google.com' }), ts: TS }), ErrorOdt);
    assert.throws(() => documentoHabilitacion({ uid: 'u', nombre: 'xy', token: tokenFalso(), ts: TS }), /nombre/);
  });
});

describe('publicar: un lote con la ODT (16 campos), sus partes y el candado del N.º', () => {
  test('forma exacta del lote', async () => {
    const e = await escenario();
    const { id, preparado } = await publicada(e);
    assert.match(id, /^[A-Za-z0-9]{20}$/);
    const lote = e.fs.lotes.at(-1).ops;
    assert.equal(lote.length, 1 + preparado.partes.length + 1);
    const odt = lote[0];
    assert.equal(odt.ruta, 'odt_afinia/' + id);
    assert.deepEqual(claves(odt.datos), ['bytes', 'consignacion', 'equipo', 'estado', 'fechaTrabajo', 'firmantes', 'huella', 'huellasPartes',
      'lectores', 'nro', 'partes', 'publicadoEn', 'publicadoPor', 'rev', 'subestacion', 'zonas']);
    const d = odt.datos;
    assert.equal(d.estado, 'PENDIENTE_AZT'); assert.equal(d.rev, 0);
    assert.deepEqual(d.lectores, [AZT.uid, RESP.uid]);
    assert.deepEqual(d.firmantes, {
      azt: { uid: AZT.uid, nombre: AZT.nombre, correo: correoDe(AZT) },
      responsable: { uid: RESP.uid, nombre: RESP.nombre, correo: correoDe(RESP) }
    });
    assert.deepEqual(d.publicadoPor, { uid: ADMIN.uid, nombre: ADMIN.nombre });
    assert.equal(d.publicadoEn, TS);
    assert.equal(d.huella, sha(e.bytes));
    assert.equal(d.bytes, e.bytes.length);
    assert.deepEqual(claves(d.zonas), ['azt', 'fecha', 'responsable', 'si']);
    assert.deepEqual(claves(d.zonas.azt), ['h', 'w', 'x', 'y']);
    assert.deepEqual(claves(d.zonas.si), ['x', 'y']);
    lote.slice(1, -1).forEach((p, i) => {
      assert.equal(p.ruta, 'odt_afinia/' + id + '/partes/' + i);
      assert.deepEqual(claves(p.datos), ['datos']);
      assert.equal(sha(p.datos.datos.toUint8Array()), d.huellasPartes[i]);
    });
    assert.deepEqual(lote.at(-1), { tipo: 'set', ruta: 'odt_afinia_nro/' + NRO, datos: { odtId: id } });
  });

  test('un PDF de 3 partes: huellas por parte, número exacto y la parte 0 empieza por %PDF-', async () => {
    const grande = new Uint8Array(2 * 900 * 1024 + 10).fill(0x41); grande.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
    const preparado = await prepararPartes(grande);
    const habs = { azt: { uid: AZT.uid, nombre: AZT.nombre, correo: correoDe(AZT) }, responsable: { uid: RESP.uid, nombre: RESP.nombre, correo: correoDe(RESP) } };
    const p = planPublicacion({ id: 'A'.repeat(20), form: FORM, preparado, zonas: ZONAS_MEDIDAS, firmantes: habs, quien: ADMIN, ts: TS, aBytes: BytesFalso.fromUint8Array });
    assert.equal(p.odt.partes, 3);
    assert.equal(p.operaciones.length, 5);
    assert.deepEqual(p.operaciones.slice(1, 4).map((o) => o.ruta.join('/')), [0, 1, 2].map((i) => 'odt_afinia/' + 'A'.repeat(20) + '/partes/' + i));
    assert.equal(p.operaciones[1].datos.datos.toUint8Array()[0], 0x25);
  });

  test('separación de funciones: el AZT no puede ser quien publica; AZT ≠ Responsable', async () => {
    const e = await escenario();
    const preparado = await prepararPartes(e.bytes);
    const yo = { uid: ADMIN.uid, nombre: ADMIN.nombre, correo: 'admin@prueba.test' };
    const r = e.repo(ADMIN);
    const resp = { uid: RESP.uid, nombre: RESP.nombre, correo: correoDe(RESP) };
    await assert.rejects(r.publicar({ form: FORM, preparado, zonas: e.zonas, firmantes: { azt: yo, responsable: resp } }), /publica/);
    await assert.rejects(r.publicar({ form: FORM, preparado, zonas: e.zonas, firmantes: { azt: resp, responsable: resp } }), /distintas/);
    assert.equal(e.fs.lotes.length, 0, 'nada se envió');
  });

  test('solo un administrador con perfil publica', async () => {
    const e = await escenario();
    const preparado = await prepararPartes(e.bytes);
    await assert.rejects(e.repo(AZT).publicar({ form: FORM, preparado, zonas: e.zonas, firmantes: {} }), (x) => x.codigo === 'sin_permiso');
    await assert.rejects(e.repo({ ...ADMIN, legacy: true }).publicar({ form: FORM, preparado, zonas: e.zonas, firmantes: {} }), (x) => x.codigo === 'sin_permiso');
  });

  test('N.º duplicado: si la vigente no está ANULADA se avisa antes; si está ANULADA se reasigna', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const antes = e.fs.lotes.length;
    await assert.rejects(publicada(e), (x) => x.codigo === 'duplicado');
    assert.equal(e.fs.lotes.length, antes, 'no se envió el lote');
    await e.repo(ADMIN).anular(id, 'Se publicó con un error de prueba.');
    const otra = await publicada(e);
    assert.notEqual(otra.id, id);
    assert.deepEqual(e.fs.store.get('odt_afinia_nro/' + NRO), { odtId: otra.id });
  });
});

describe('leerOdt: une las partes del servidor y verifica las huellas', () => {
  test('devuelve el original exacto', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { odt, bytesV0 } = await e.repo(AZT).leerOdt(id);
    assert.equal(odt.id, id);
    assert.equal(sha(bytesV0), sha(e.bytes));
  });
  test('una parte alterada o faltante: lanza y no devuelve bytes', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const malo = e.bytes.slice(); malo[malo.length - 2] ^= 1;
    e.fs.poner('odt_afinia/' + id + '/partes/0', { datos: BytesFalso.fromUint8Array(malo) });
    await assert.rejects(e.repo(AZT).leerOdt(id), (x) => x.codigo === 'huella');
    e.fs.store.delete('odt_afinia/' + id + '/partes/0');
    await assert.rejects(e.repo(AZT).leerOdt(id), (x) => x.codigo === 'huella');
  });
});

describe('miFirmaOdt: lector propio que distingue «no hay» de «falló»', () => {
  test('no hay documento → {hay:false}', async () => {
    const fs = crearFirestoreFalso();
    assert.deepEqual(await miFirmaOdt({ sdk: fs.F, db: fs.db, sesion: () => AZT }), { hay: false });
  });
  test('falla la lectura → LANZA (no se traga el error como «no hay»)', async () => {
    const fs = crearFirestoreFalso({ sinRedLectura: true });
    await assert.rejects(miFirmaOdt({ sdk: fs.F, db: fs.db, sesion: () => AZT }), (x) => x instanceof ErrorOdt && x.codigo === 'red');
  });
  test('sin sesión → lanza', async () => {
    const fs = crearFirestoreFalso();
    await assert.rejects(miFirmaOdt({ sdk: fs.F, db: fs.db, sesion: () => null }), (x) => x.codigo === 'cuenta');
  });
  test('lee firmas/{uidSesión}, devuelve los BYTES y la huella calculada de ellos', async () => {
    const fs = crearFirestoreFalso();
    const png = pngFirma(120, 50, 3);
    fs.poner('firmas/' + AZT.uid, { imagen: BytesFalso.fromUint8Array(png), huella: sha(png), en: TS });
    fs.poner('firmas/' + RESP.uid, { imagen: BytesFalso.fromUint8Array(pngFirma(120, 50, 4)), huella: 'e'.repeat(64), en: TS });
    const r = await miFirmaOdt({ sdk: fs.F, db: fs.db, sesion: () => AZT });
    assert.equal(r.hay, true);
    assert.deepEqual([...r.imagen], [...png]);
    assert.equal(r.huella, sha(png));
    assert.equal(r.huellaDeclarada, sha(png));
    assert.ok(Number.isFinite(r.enMs));
  });
  test('huella declarada distinta de la de los bytes → lanza con mensaje útil (la regla del acto la negaría)', async () => {
    const fs = crearFirestoreFalso();
    fs.poner('firmas/' + AZT.uid, { imagen: BytesFalso.fromUint8Array(pngFirma(120, 50, 3)), huella: 'f'.repeat(64), en: TS });
    await assert.rejects(miFirmaOdt({ sdk: fs.F, db: fs.db, sesion: () => AZT }), (x) => x.codigo === 'validacion' && x.message === HUELLA_MI_FIRMA_DISTINTA);
  });
  test('lo guardado no es PNG → lanza', async () => {
    const fs = crearFirestoreFalso();
    fs.poner('firmas/' + AZT.uid, { imagen: BytesFalso.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), huella: '0'.repeat(64), en: TS });
    await assert.rejects(miFirmaOdt({ sdk: fs.F, db: fs.db, sesion: () => AZT }), (x) => x.codigo === 'validacion');
  });
});

describe('firmar: lote de 2 (acto + estado) desde la copia congelada', () => {
  test('AZT: acto de 16 campos + update {estado, rev}; lo visto, lo firmado y lo subido tienen la misma huella', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { r, c } = await prepararDe(e, AZT, id);
    assert.equal(sha(c.bytes), c.huellaVista, 'la huella es la de los bytes que se muestran');
    assert.equal(c.declaracion.texto, declaracionAzt({ nombre: AZT.nombre, correo: correoDe(AZT), nro: NRO }));
    const tk = tokenFalso({ uid: AZT.uid, email: correoDe(AZT) });
    assert.equal(verificarAntesDeFirmar(c, { uidVivo: AZT.uid, token: tk }), null);
    await r.firmar(c, tk);
    const lote = e.fs.lotes.at(-1).ops;
    assert.equal(lote.length, 2);
    const [acto, upd] = lote;
    assert.equal(acto.ruta, 'odt_afinia/' + id + '/actos/azt');
    assert.equal(acto.tipo, 'set');
    assert.deepEqual(claves(acto.datos), ['authTime', 'compositor', 'correo', 'correoVerificado', 'declaracion', 'declaracionVersion', 'en',
      'huellaBase', 'huellaImagen', 'huellaVista', 'imagen', 'nombre', 'nro', 'proveedor', 'rol', 'uid']);
    assert.equal(acto.datos.uid, AZT.uid);
    assert.equal(acto.datos.correo, tk.email);
    assert.equal(acto.datos.authTime, tk.auth_time);
    assert.equal(acto.datos.huellaVista, c.huellaVista);
    assert.equal(acto.datos.huellaBase, sha(e.bytes));
    assert.deepEqual([...acto.datos.imagen.toUint8Array()], [...e.pngs[AZT.uid]], 'imagen == firmas/{uid}.imagen byte a byte');
    assert.equal(acto.datos.huellaImagen, sha(e.pngs[AZT.uid]));
    assert.equal(acto.datos.compositor, 'odt-afinia@1');
    assert.equal(acto.datos.declaracionVersion, 'odt-azt-v1');
    assert.equal(acto.datos.en, TS);
    assert.deepEqual(upd, { tipo: 'update', ruta: 'odt_afinia/' + id, datos: { estado: 'PENDIENTE_RESPONSABLE', rev: 1 } });
  });

  test('Responsable: verifica la firma del AZT, acto de 17 campos con cierre, y la descarga sale con su misma huella', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const a = await prepararDe(e, AZT, id);
    await a.r.firmar(a.c, tokenFalso({ uid: AZT.uid, email: correoDe(AZT) }));
    const hoy = fechaBogota();
    const p = await prepararDe(e, RESP, id, { fechaCierre: hoy });
    assert.equal(p.c.declaracion.texto, declaracionResponsable({ nombre: RESP.nombre, correo: correoDe(RESP), nro: NRO, fecha: hoy }));
    await p.r.firmar(p.c, tokenFalso({ uid: RESP.uid, email: correoDe(RESP) }));
    const [acto, upd] = e.fs.lotes.at(-1).ops;
    assert.equal(Object.keys(acto.datos).length, 17);
    assert.deepEqual(acto.datos.cierre, { si: true, fecha: hoy });
    assert.equal(acto.datos.declaracionVersion, 'odt-resp-v1');
    assert.deepEqual(upd.datos, { estado: 'LISTA', rev: 2 });

    // Descargar: componer → huella → registrar → entregar ESE Blob (L-107).
    const r = e.repo(RESP);
    const { odt, bytesV0 } = await r.leerOdt(id);
    const actos = await r.leerActos(id);
    let entregado = null;
    const res = await descargarOdt({
      odt, bytesV0, actos, PDFLib,
      registrar: (oid, hx) => r.registrarDescarga(oid, hx),
      entregar: (bytes, nombre) => { entregado = { bytes, nombre }; return 'blob'; }
    });
    assert.equal(sha(entregado.bytes), res.huella, 'la huella registrada es la de los bytes entregados');
    assert.equal(res.huella, p.c.huellaVista, 'y es la que vio el Responsable al firmar');
    assert.equal(entregado.nombre, 'ODT_' + NRO + '_firmada.pdf');
    const reg = e.fs.lotes.at(-1).ops[0];
    assert.match(reg.ruta, /^odt_afinia_descargas\/[A-Za-z0-9]+$/);
    assert.deepEqual(claves(reg.datos), ['en', 'huella', 'odtId', 'uid']);
    assert.deepEqual({ ...reg.datos, en: null }, { odtId: id, uid: RESP.uid, huella: res.huella, en: null });
  });

  test('si el registro de la descarga falla, NO se entrega el archivo', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const a = await prepararDe(e, AZT, id);
    await a.r.firmar(a.c, tokenFalso({ uid: AZT.uid, email: correoDe(AZT) }));
    const p = await prepararDe(e, RESP, id, { fechaCierre: fechaBogota() });
    await p.r.firmar(p.c, tokenFalso({ uid: RESP.uid, email: correoDe(RESP) }));
    const { odt, bytesV0 } = await p.r.leerOdt(id);
    const actos = await p.r.leerActos(id);
    let entregas = 0;
    await assert.rejects(descargarOdt({ odt, bytesV0, actos, PDFLib, registrar: async () => { throw new ErrorOdt('red'); }, entregar: () => { entregas++; } }));
    assert.equal(entregas, 0);
  });

  test('una firma del AZT alterada bloquea al Responsable y la descarga', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const a = await prepararDe(e, AZT, id);
    await a.r.firmar(a.c, tokenFalso({ uid: AZT.uid, email: correoDe(AZT) }));
    const ruta = 'odt_afinia/' + id + '/actos/azt';
    e.fs.poner(ruta, { ...e.fs.store.get(ruta), huellaVista: '0'.repeat(64) });
    await assert.rejects(prepararDe(e, RESP, id, { fechaCierre: fechaBogota() }), (x) => x.codigo === 'huella');
  });

  test('«Mi firma» anterior a la habilitación: no se prepara', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    e.fs.poner('odt_afinia_firmantes/' + AZT.uid, { uid: AZT.uid, nombre: AZT.nombre, correo: correoDe(AZT), en: TS }); // habilitación MÁS nueva
    await assert.rejects(prepararDe(e, AZT, id), /anterior a su habilitación/);
  });

  test('sin habilitación o sin «Mi firma»: no se prepara', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    e.fs.store.delete('firmas/' + AZT.uid);
    await assert.rejects(prepararDe(e, AZT, id), /Mi firma/);
    e.fs.store.delete('odt_afinia_firmantes/' + AZT.uid);
    await assert.rejects(prepararDe(e, AZT, id), /habilítese/);
  });

  test('el Responsable no firma antes que el AZT, y nadie firma la casilla ajena', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    await assert.rejects(prepararDe(e, RESP, id, { fechaCierre: fechaBogota() }), (x) => x.codigo === 'estado');
    const tercero = { ...AZT, uid: 'uid-tercero-prueba' };
    await assert.rejects(prepararDe(e, tercero, id), (x) => x.codigo === 'sin_permiso');
  });

  test('L-112: si la cuenta viva cambió o el token es de otra cuenta, se aborta sin escribir', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { r, c } = await prepararDe(e, AZT, id);
    const tk = tokenFalso({ uid: AZT.uid, email: correoDe(AZT) });
    assert.match(verificarAntesDeFirmar(c, { uidVivo: 'uid-otra-prueba', token: tk }), /cambió de cuenta/);
    assert.match(verificarAntesDeFirmar(c, { uidVivo: AZT.uid, token: { ...tk, uid: 'uid-otra-prueba' } }), /otra cuenta/);
    assert.match(verificarAntesDeFirmar(c, { uidVivo: AZT.uid, token: { ...tk, email: 'otro@prueba.test' } }), /correo/);
    assert.match(verificarAntesDeFirmar(c, { uidVivo: AZT.uid, token: { ...tk, auth_time: tk.auth_time - 301 } }), /5 minutos/);
    assert.match(verificarAntesDeFirmar(c, { uidVivo: AZT.uid, token: { ...tk, email_verified: false } }), /verificado/);
    const antes = e.fs.lotes.length;
    await assert.rejects(e.repo(RESP).firmar(c, tk), (x) => x.codigo === 'cuenta', 'otra sesión no escribe la copia ajena');
    await assert.rejects(r.firmar(c, { ...tk, email: 'otro@prueba.test' }), (x) => x.codigo === 'validacion');
    assert.equal(e.fs.lotes.length, antes);
  });

  test('la copia congelada no cambia aunque cambie la fuente', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { c } = await prepararDe(e, AZT, id);
    assert.ok(Object.isFrozen(c));
    const huellaImagen = c.huellaImagen;
    e.fs.poner('firmas/' + AZT.uid, { imagen: BytesFalso.fromUint8Array(pngFirma(90, 40, 7)), huella: '1'.repeat(64), en: TS });
    assert.equal(c.huellaImagen, huellaImagen);
    assert.equal(sha(c.imagen), huellaImagen);
  });
});

describe('red caída a mitad del lote', () => {
  async function firmarCon(op) {
    const e = await escenario();
    const { id } = await publicada(e);
    const { c } = await prepararDe(e, AZT, id);
    Object.assign(e.fs.opciones, op);
    return { e, p: e.repo(AZT).firmar(c, tokenFalso({ uid: AZT.uid, email: correoDe(AZT) })) };
  }
  test('sin respuesta pero el acto quedó en el servidor → entró', async () => {
    const { p } = await firmarCon({ escribirYColgar: true });
    assert.deepEqual(await p, { estado: 'entro' });
  });
  test('sin respuesta y sin acto en el servidor → PENDIENTE (sigue en cola: no se afirma que no entró)', async () => {
    const { p } = await firmarCon({ colgarLote: true });
    const r = await p;
    assert.equal(r.estado, 'pendiente');
    assert.match(r.mensaje, /NO repita/);
    assert.ok(r.final instanceof Promise);
  });
  test('sin respuesta y sin poder leer el servidor → también PENDIENTE', async () => {
    const { p } = await firmarCon({ colgarLote: true, sinRedLectura: true });
    assert.equal((await p).estado, 'pendiente');
  });
  test('lote RECHAZADO por la red y sin acto en el servidor → no entró', async () => {
    const { p } = await firmarCon({ rechazarRed: true });
    await assert.rejects(p, (x) => x.codigo === 'no_entro');
  });
  test('lote rechazado por la red y sin poder leer el servidor → sin red', async () => {
    const { p } = await firmarCon({ rechazarRed: true, sinRedLectura: true });
    await assert.rejects(p, (x) => x.codigo === 'sin_red');
  });
  test('«sin permiso» dice la causa probable leyendo el estado actual', async () => {
    const { p } = await firmarCon({ denegarLote: true });
    await assert.rejects(p, (x) => x.codigo === 'sin_permiso' && /5 minutos|cambió|anulada/.test(x.message));
  });
  test('conTope corta una promesa colgada', async () => {
    await assert.rejects(conTope(new Promise(() => {}), 5), (x) => x.codigo === 'tiempo');
  });
});

describe('anular, devolver y bandeja', () => {
  test('anular: update de 3 claves {estado, rev, anulacion{motivo, por, en}}', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    await e.repo(ADMIN).anular(id, '  Motivo de anulación de prueba  ');
    const [op] = e.fs.lotes.at(-1).ops;
    assert.equal(op.tipo, 'update');
    assert.deepEqual(claves(op.datos), ['anulacion', 'estado', 'rev']);
    assert.deepEqual({ ...op.datos, anulacion: { ...op.datos.anulacion, en: null } },
      { estado: 'ANULADA', rev: 1, anulacion: { motivo: 'Motivo de anulación de prueba', por: { uid: ADMIN.uid, nombre: ADMIN.nombre }, en: null } });
    assert.equal(op.datos.anulacion.en, TS);
    await assert.rejects(e.repo(ADMIN).anular(id, 'Otra vez anulada'), (x) => x.codigo === 'estado');
    await assert.rejects(e.repo(AZT).anular(id, 'No soy administrador'), (x) => x.codigo === 'sin_permiso');
  });
  test('anular con motivo corto: no se envía', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const antes = e.fs.lotes.length;
    await assert.rejects(e.repo(ADMIN).anular(id, 'corto'), (x) => x.codigo === 'validacion');
    assert.equal(e.fs.lotes.length, antes);
  });
  test('devolver: {uid, rol, motivo, en} en devoluciones/{rol_rev} (id determinista: una por turno)', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const r = await e.repo(AZT).devolver(id, 'azt', 'La consignación no corresponde.', 0);
    assert.deepEqual(r, { estado: 'entro', id: 'azt_0' });
    const [op] = e.fs.lotes.at(-1).ops;
    assert.equal(op.ruta, 'odt_afinia/' + id + '/devoluciones/azt_0');
    assert.deepEqual(claves(op.datos), ['en', 'motivo', 'rol', 'uid']);
    assert.equal(op.datos.uid, AZT.uid);
    const antes = e.fs.lotes.length;
    await assert.rejects(e.repo(AZT).devolver(id, 'azt', 'Otra devolución en el mismo turno.', 0), (x) => x.codigo === 'devuelta');
    assert.equal(e.fs.lotes.length, antes, 'la segunda del mismo turno no se envía');
    await assert.rejects(e.repo(AZT).devolver(id, 'azt', 'Sin saber la revisión vista.'), (x) => x.codigo === 'validacion');
  });
  test('bandeja: array-contains del uid propio + orderBy publicadoEn desc + limit 50; el admin además las 50 recientes', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const r1 = await e.repo(AZT).listarBandeja();
    const q = e.fs.consultas.at(-1);
    assert.equal(q.col, 'odt_afinia');
    assert.deepEqual(q.filtros, [{ t: 'where', campo: 'lectores', opr: 'array-contains', valor: AZT.uid }, { t: 'orderBy', campo: 'publicadoEn', dir: 'desc' }, { t: 'limit', n: 50 }]);
    assert.deepEqual(r1.odts.map((o) => o.id), [id]);
    const n = e.fs.consultas.length;
    const r2 = await e.repo(ADMIN).listarBandeja();
    const qs = e.fs.consultas.slice(n);
    assert.equal(qs.length, 2);
    assert.deepEqual(qs[1].filtros, [{ t: 'orderBy', campo: 'publicadoEn', dir: 'desc' }, { t: 'limit', n: 50 }]);
    assert.deepEqual(r2.odts.map((o) => o.id), [id]);
    const tercero = await e.repo({ ...AZT, uid: 'uid-tercero-prueba' }).listarBandeja();
    assert.deepEqual(tercero.odts, []);
  });
  test('descarga solo de una ODT LISTA', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { odt, bytesV0 } = await e.repo(ADMIN).leerOdt(id);
    await assert.rejects(prepararDescarga({ odt, bytesV0, actos: {}, PDFLib }), (x) => x.codigo === 'estado');
  });
});

describe('contrato nuevo: lista blanca, D5, D6 y causas de rechazo', () => {
  test('publicar: un firmante fuera de la lista blanca de su rol (o sin lista) se dice antes y no se envía nada', async () => {
    const e = await escenario();
    const preparado = await prepararPartes(e.bytes);
    const habs = await e.repo(ADMIN).listarHabilitados();
    const invertidos = { azt: habs.find((h) => h.uid === RESP.uid), responsable: habs.find((h) => h.uid === AZT.uid) };
    await assert.rejects(e.repo(ADMIN).publicar({ form: FORM, preparado, zonas: e.zonas, firmantes: invertidos }), /lista blanca de AZT/);
    e.fs.store.delete('odt_afinia_config/firmantes');
    const bien = { azt: habs.find((h) => h.uid === AZT.uid), responsable: habs.find((h) => h.uid === RESP.uid) };
    await assert.rejects(e.repo(ADMIN).publicar({ form: FORM, preparado, zonas: e.zonas, firmantes: bien }), (x) => x.message === MSG_FALTA_LISTA_BLANCA);
    assert.equal(e.fs.lotes.length, 0);
  });
  test('candidatos: solo habilitados de la lista blanca de ESE rol, activos y no visitantes; el admin nunca es AZT', async () => {
    const e = await escenario();
    e.fs.poner('odt_afinia_firmantes/' + ADMIN.uid, { uid: ADMIN.uid, nombre: ADMIN.nombre, correo: ADMIN.correoPerfil, en: TS });
    e.fs.poner('odt_afinia_firmantes/uid-otro-prueba', { uid: 'uid-otro-prueba', nombre: 'Otro De Prueba', correo: 'otro@prueba.test', en: TS });
    e.fs.poner('usuarios/uid-otro-prueba', { nombre: 'Otro De Prueba', rol: 'tecnico', activo: true });
    const c = await e.repo(ADMIN).candidatos();
    assert.deepEqual(c.azt.map((h) => h.uid), [AZT.uid]);
    assert.deepEqual(c.responsable.map((h) => h.uid).sort(), [ADMIN.uid, RESP.uid].sort(), 'D5: el admin puede ser Responsable');
    assert.deepEqual(c.fuera.map((f) => [f.uid, f.motivo]), [['uid-otro-prueba', 'no está en la lista blanca']]);
    await assert.rejects(e.repo(AZT).candidatos(), (x) => x.codigo === 'sin_permiso');
  });
  test('D6: una ODT LISTA no se anula (no se envía nada)', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    e.fs.poner('odt_afinia/' + id, { ...e.fs.store.get('odt_afinia/' + id), estado: 'LISTA', rev: 2 });
    const antes = e.fs.lotes.length;
    await assert.rejects(e.repo(ADMIN).anular(id, 'Motivo suficiente de prueba'), (x) => x.codigo === 'estado' && /lista no se anula/.test(x.message));
    assert.equal(e.fs.lotes.length, antes);
  });
  test('publicar sin respuesta a tiempo → PENDIENTE con «NO repita» (no se afirma que no entró)', async () => {
    const e = await escenario({ colgarLote: true });
    const r = await publicada(e).catch((x) => x);
    assert.ok(!(r instanceof Error), r && r.message);
    const habs = await e.repo(ADMIN).listarHabilitados();
    const res = await e.repo(ADMIN).publicar({ form: { ...FORM, nro: '00000002' }, preparado: await prepararPartes(e.bytes), zonas: e.zonas,
      firmantes: { azt: habs.find((h) => h.uid === AZT.uid), responsable: habs.find((h) => h.uid === RESP.uid) } });
    assert.equal(res.estado, 'pendiente');
    assert.match(res.mensaje, /NO repita/);
  });
  test('causaRechazoFirma: inicio de sesión anterior a la publicación → «inicie sesión de nuevo y firme»', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { r, c } = await prepararDe(e, AZT, id);
    const odt = await r.leerOdtDoc(id);
    const viejo = tokenFalso({ uid: AZT.uid, email: correoDe(AZT), ahoraMs: odt.publicadoEnMs - 60000 });
    assert.equal(await r.causaRechazoFirma(c, viejo), 'La plataforma no aceptó su firma. ' + MSG_SESION_ANTES_DE_PUBLICAR);
  });
  test('causaRechazoFirma: el Responsable con sesión anterior a la firma del AZT; nombre/correo distintos de lo publicado', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const a = await prepararDe(e, AZT, id);
    await a.r.firmar(a.c, tokenFalso({ uid: AZT.uid, email: correoDe(AZT) }));
    const p = await prepararDe(e, RESP, id, { fechaCierre: fechaBogota() });
    const actoAzt = await p.r.leerActo(id, 'azt');
    const odt = await p.r.leerOdtDoc(id);
    assert.ok(actoAzt.enMs > odt.publicadoEnMs);
    const entre = actoAzt.enMs; // auth_time (s) == firma del AZT: no es POSTERIOR, y sí es posterior a publicar
    const tk = tokenFalso({ uid: RESP.uid, email: correoDe(RESP), ahoraMs: entre });
    assert.equal(await p.r.causaRechazoFirma(p.c, tk), 'La plataforma no aceptó su firma. ' + MSG_SESION_ANTES_DEL_AZT);
    const ruta = 'odt_afinia/' + id;
    const o = e.fs.store.get(ruta);
    e.fs.poner(ruta, { ...o, firmantes: { ...o.firmantes, responsable: { ...o.firmantes.responsable, correo: 'otro@prueba.test' } } });
    assert.equal(await p.r.causaRechazoFirma(p.c, tokenFalso({ uid: RESP.uid, email: correoDe(RESP) })), 'La plataforma no aceptó su firma. ' + MSG_IDENTIDAD_CAMBIO);
  });
  test('causaRechazoFirma: la huella de «Mi firma» no coincide con su imagen → mensaje útil', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { r, c } = await prepararDe(e, AZT, id);
    e.fs.poner('firmas/' + AZT.uid, { ...e.fs.store.get('firmas/' + AZT.uid), huella: '0'.repeat(64) });
    assert.equal(await r.causaRechazoFirma(c, tokenFalso({ uid: AZT.uid, email: correoDe(AZT) })), 'La plataforma no aceptó su firma. ' + HUELLA_MI_FIRMA_DISTINTA);
  });
  test('leerOdtDoc: inexistente o ajena → «no_existe» con el mismo mensaje', async () => {
    const e = await escenario();
    await assert.rejects(e.repo(AZT).leerOdtDoc('B'.repeat(20)), (x) => x.codigo === 'no_existe' && x.message === MSG_NO_EXISTE);
    await assert.rejects(e.repo(AZT).leerOdtDoc('no-es-un-id'), (x) => x.codigo === 'no_existe');
  });
});

describe('cuenta: horas del SERVIDOR (iat, auth_time), nunca el reloj del equipo', () => {
  const usuarioFalso = (claims) => ({
    uid: AZT.uid, email: correoDe(AZT), renovado: 0,
    async getIdToken(forzar) { if (forzar) this.renovado++; return 'tk'; },
    async getIdTokenResult() { return { claims }; }
  });
  test('claimsDe trae iat entero (o NaN si no es entero)', () => {
    const c = claimsDe('u', { claims: { email: 'a@prueba.test', email_verified: true, auth_time: 100, iat: 160, firebase: { sign_in_provider: 'password' } } });
    assert.deepEqual(c, { uid: 'u', email: 'a@prueba.test', email_verified: true, auth_time: 100, iat: 160, sign_in_provider: 'password' });
    assert.ok(Number.isNaN(claimsDe('u', { claims: { iat: 1.5 } }).iat));
  });
  test('edadSesion = iat − auth_time de un token recién emitido (sin pedir contraseña)', async () => {
    const u = usuarioFalso({ auth_time: 1000, iat: 1240 });
    const cuenta = crearCuenta({ authSdk: {}, auth: { currentUser: u } });
    assert.deepEqual(await cuenta.edadSesion(), { authTime: 1000, iat: 1240, edadSeg: 240 });
    assert.equal(u.renovado, 1, 'renueva el token para tener un iat del servidor de ahora');
    const sinIat = crearCuenta({ authSdk: {}, auth: { currentUser: usuarioFalso({ auth_time: 1000 }) } });
    await assert.rejects(sinIat.edadSesion(), (x) => x.codigo === 'cuenta');
  });
  test('verificarAntesDeFirmar mide los 5 min con iat: un reloj local adelantado no bloquea', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const { c } = await prepararDe(e, AZT, id);
    const tk = tokenFalso({ uid: AZT.uid, email: correoDe(AZT) });
    const conIat = { ...tk, iat: tk.auth_time + 10 };
    assert.equal(verificarAntesDeFirmar(c, { uidVivo: AZT.uid, token: conIat, ahoraMs: Date.now() + 3600e3 }), null, 'reloj del equipo +1 h');
    assert.match(verificarAntesDeFirmar(c, { uidVivo: AZT.uid, token: { ...tk, iat: tk.auth_time + 301 } }), /5 minutos/);
  });
});

describe('zonas guardadas fuera del formato (otro cliente): no se compone ni se firma', () => {
  test('la casilla del AZT corrida 10 pt → prepararFirma lanza «huella» y no se escribe nada', async () => {
    const e = await escenario();
    const { id } = await publicada(e);
    const ruta = 'odt_afinia/' + id;
    const o = e.fs.store.get(ruta);
    e.fs.poner(ruta, { ...o, zonas: { ...o.zonas, azt: { ...o.zonas.azt, x: o.zonas.azt.x + 10 } } });
    const antes = e.fs.lotes.length;
    await assert.rejects(prepararDe(e, AZT, id), (x) => x.codigo === 'huella' && /±3 pt/.test(x.message));
    assert.equal(e.fs.lotes.length, antes);
  });
});
