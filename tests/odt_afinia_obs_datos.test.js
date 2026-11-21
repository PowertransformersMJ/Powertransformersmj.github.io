// Firma de ODT Afinia · «POR SUBSANAR» · DATOS: los lotes que se escriben (forma exacta del contrato de las
// reglas: 11 campos la obs, 8 cada punto, 1 el candado; updates con rutas de campo) y el repositorio sobre el
// doble de Firestore (sin red): registrar (obs + candado + puntos, «un N.º, una obs abierta»), cambiar un punto
// (punto + resumen atados en UN lote, con su entrada de rastro), agregar punto, dar por resuelta, listar y leer.
// Lo que el doble NO hace (evaluar reglas) lo prueba tests-rules/odt_afinia_obs.rules.test.js en el emulador.
// Datos INVENTADOS (repo público).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearFirestoreFalso, TS } from './odt_afinia_ui_dobles.js';
import { planRegistro, planCambioPunto, planAgregarPunto, cambiosResolver, documentoPunto } from '../assets/js/data/odt_afinia_obs_lotes.js';
import { crearRepositorioObs, MSG_NRO_ABIERTO, MSG_OBS_NO_EXISTE } from '../assets/js/data/odt_afinia_obs.js';

const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba', rol: 'admin', esAdmin: true, legacy: false };
const ADMIN2 = { uid: 'uid-admin2-prueba', nombre: 'Admin Dos De Prueba', rol: 'admin', esAdmin: true, legacy: false };
const AZT = { uid: 'uid-azt-prueba', nombre: 'Azt De Prueba', rol: 'tecnico', esAdmin: false, legacy: false };
const TERCERO = { uid: 'uid-tercero-prueba', nombre: 'Tercero De Prueba', rol: 'tecnico', esAdmin: false, legacy: false };
const HAB_AZT = { uid: AZT.uid, nombre: AZT.nombre, correo: 'azt@prueba.test', authTime: 1, acuerdo: 'x' };
const ID = 'ObsPrueba00000000001';
const FORM = { nro: '00000001', subestacion: 'S/E Prueba Norte', equipo: 'TR-Prueba', fechaPrevista: '15/11/2026' };
const PUNTOS = [{ texto: 'Falta el registro fotográfico', quien: 'contratista' }, { texto: 'Diligenciar el control previo', quien: 'azt' }];

describe('armado de lotes (puro): la forma exacta que piden las reglas', () => {
  test('registro: obs de 11 campos, candado {obsId} y un punto de 8 campos por línea', () => {
    const p = planRegistro({ id: ID, form: FORM, azt: HAB_AZT, puntos: PUNTOS, por: ADMIN, ts: TS });
    assert.deepEqual(Object.keys(p.obs).sort(), ['azt', 'creadoEn', 'creadoPor', 'equipo', 'estado', 'fechaPrevista', 'lectores', 'nro', 'resumen', 'rev', 'subestacion']);
    assert.deepEqual(p.obs.azt, { uid: AZT.uid, nombre: AZT.nombre, correo: 'azt@prueba.test' }, 'nombre y correo, de la habilitación; nada más');
    assert.deepEqual(p.obs.lectores, [AZT.uid]);
    assert.deepEqual(p.obs.resumen, { 0: 'PENDIENTE', 1: 'PENDIENTE' });
    assert.equal(p.obs.estado, 'ABIERTA'); assert.equal(p.obs.rev, 0);
    assert.deepEqual(p.obs.creadoPor, { uid: ADMIN.uid, nombre: ADMIN.nombre });
    assert.deepEqual(p.operaciones.map((o) => o.ruta.join('/')), [
      'odt_afinia_obs/' + ID, 'odt_afinia_obs_nro/00000001', 'odt_afinia_obs/' + ID + '/puntos/0', 'odt_afinia_obs/' + ID + '/puntos/1'
    ]);
    assert.deepEqual(p.operaciones[1].datos, { obsId: ID });
    const pt = p.operaciones[3].datos;
    assert.deepEqual(Object.keys(pt).sort(), ['creadoEn', 'creadoPor', 'estado', 'orden', 'quien', 'rastro', 'rev', 'texto']);
    assert.deepEqual({ ...pt, creadoEn: null }, { orden: 1, texto: 'Diligenciar el control previo', quien: 'azt', estado: 'PENDIENTE', rev: 0, rastro: {}, creadoPor: { uid: ADMIN.uid, nombre: ADMIN.nombre }, creadoEn: null });
    assert.ok(p.operaciones.every((o) => o.tipo === undefined), 'todo set (creaciones)');
  });
  test('registro: se niega antes de escribir con datos que la regla negaría', () => {
    const base = { id: ID, form: FORM, azt: HAB_AZT, puntos: PUNTOS, por: ADMIN, ts: TS };
    assert.throws(() => planRegistro({ ...base, puntos: [] }), /de 1 a 40 puntos/);
    assert.throws(() => planRegistro({ ...base, puntos: Array.from({ length: 41 }, () => PUNTOS[0]) }), /de 1 a 40 puntos/);
    assert.throws(() => planRegistro({ ...base, form: { ...FORM, nro: '1234' } }), /8 dígitos/);
    assert.throws(() => planRegistro({ ...base, form: { ...FORM, fechaPrevista: '2026-11-15' } }), /fecha real/);
    assert.throws(() => planRegistro({ ...base, azt: { ...HAB_AZT, uid: ADMIN.uid } }), /no puede ser su AZT/);
    assert.throws(() => planRegistro({ ...base, azt: { uid: AZT.uid } }), /nombre/);
    assert.throws(() => planRegistro({ ...base, puntos: [{ texto: 'corto', quien: 'otro' }] }), /a quién le toca/);
    assert.throws(() => planRegistro({ ...base, id: 'corto' }), /Identificador/);
  });
  test('cambio de punto: update del punto {estado, rev, rastro.<rev>} + update de la obs {resumen.<k>, ultimo}', () => {
    const obs = { id: ID, estado: 'ABIERTA', lectores: [AZT.uid], resumen: { 0: 'PENDIENTE', 1: 'PENDIENTE' } };
    const pt = { id: '1', estado: 'PENDIENTE', rev: 0, rastro: {} };
    const p = planCambioPunto({ obs, punto: pt, accion: 'subsanar', nota: 'Se diligenció el control', sesion: AZT, ts: TS });
    assert.equal(p.estado, 'SUBSANADO'); assert.equal(p.rev, 1);
    assert.deepEqual(p.operaciones, [
      { tipo: 'update', ruta: ['odt_afinia_obs', ID, 'puntos', '1'], datos: { estado: 'SUBSANADO', rev: 1, 'rastro.1': { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Se diligenció el control', por: { uid: AZT.uid, nombre: AZT.nombre }, en: TS } } },
      { tipo: 'update', ruta: ['odt_afinia_obs', ID], datos: { 'resumen.1': 'SUBSANADO', ultimo: '1' } }
    ]);
    // Quien no es el AZT asignado, o desde otro estado, no arma nada.
    assert.throws(() => planCambioPunto({ obs, punto: pt, accion: 'subsanar', nota: 'Se hizo', sesion: TERCERO, ts: TS }), /Solo el AZT asignado/);
    assert.throws(() => planCambioPunto({ obs, punto: pt, accion: 'verificar', nota: '', sesion: ADMIN, ts: TS }), /ya no está/);
    assert.throws(() => planCambioPunto({ obs, punto: pt, accion: 'subsanar', nota: '', sesion: AZT, ts: TS }), /qué se hizo/);
  });
  test('agregar punto: el próximo id libre, PENDIENTE, con su entrada en el resumen', () => {
    const obs = { id: ID, estado: 'ABIERTA', lectores: [AZT.uid], resumen: { 0: 'VERIFICADO', 1: 'SUBSANADO' } };
    const p = planAgregarPunto({ obs, texto: 'Corregir la consignación', quien: 'responsable', por: ADMIN, ts: TS });
    assert.equal(p.k, '2');
    assert.deepEqual(p.operaciones.map((o) => [o.tipo || 'set', o.ruta.join('/')]), [['set', 'odt_afinia_obs/' + ID + '/puntos/2'], ['update', 'odt_afinia_obs/' + ID]]);
    assert.deepEqual(p.operaciones[1].datos, { 'resumen.2': 'PENDIENTE', ultimo: '2' });
    assert.throws(() => planAgregarPunto({ obs: { ...obs, estado: 'RESUELTA' }, texto: 'Corregir la consignación', quien: 'azt', por: ADMIN, ts: TS }), /resuelta/);
    assert.throws(() => documentoPunto({ k: '40', texto: 'Corregir la consignación', quien: 'azt', por: ADMIN, ts: TS }), /Número de punto/);
  });
  test('dar por resuelta: {estado, rev + 1, resolucion{nota, por, en}}; solo ABIERTA y con nota', () => {
    const obs = { id: ID, estado: 'ABIERTA', rev: 0 };
    assert.deepEqual(cambiosResolver(obs, { nota: 'La ODT ya no va', por: ADMIN, ts: TS }), {
      estado: 'RESUELTA', rev: 1, resolucion: { nota: 'La ODT ya no va', por: { uid: ADMIN.uid, nombre: ADMIN.nombre }, en: TS }
    });
    assert.throws(() => cambiosResolver(obs, { nota: 'no', por: ADMIN, ts: TS }), /por qué/);
    assert.throws(() => cambiosResolver({ ...obs, estado: 'RESUELTA' }, { nota: 'La ODT ya no va', por: ADMIN, ts: TS }), /ya está resuelta/);
  });
});

/** Un Firestore falso con la lista blanca, la habilitación y el perfil del AZT, y un repositorio por persona. */
function base(op = {}) {
  const fs = crearFirestoreFalso(op);
  fs.poner('odt_afinia_firmantes/' + AZT.uid, HAB_AZT);
  fs.poner('odt_afinia_config/firmantes', { azt: [AZT.uid], responsable: [] });
  fs.poner('usuarios/' + AZT.uid, { nombre: AZT.nombre, rol: 'tecnico', activo: true });
  const repo = (s) => crearRepositorioObs({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30 });
  return { fs, repo };
}

describe('repositorio sobre el doble de Firestore', () => {
  test('registrar: UN lote con obs + candado + puntos; el AZT la lista y la lee; un tercero no', async () => {
    const { fs, repo } = base();
    const r = await repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS });
    assert.equal(r.estado, 'entro');
    assert.equal(fs.lotes.length, 1, 'un solo lote');
    assert.deepEqual(fs.lotes[0].ops.map((o) => o.ruta), ['odt_afinia_obs/' + r.id, 'odt_afinia_obs_nro/00000001', 'odt_afinia_obs/' + r.id + '/puntos/0', 'odt_afinia_obs/' + r.id + '/puntos/1']);
    const l = await repo(AZT).listar();
    assert.deepEqual(l.lista.map((o) => o.nro), ['00000001']);
    const q = fs.consultas.at(-1);
    assert.equal(q.col, 'odt_afinia_obs');
    assert.deepEqual(q.filtros, [{ t: 'where', campo: 'lectores', opr: 'array-contains', valor: AZT.uid }, { t: 'orderBy', campo: 'creadoEn', dir: 'desc' }, { t: 'limit', n: 50 }]);
    const { obs, puntos } = await repo(AZT).leer(r.id);
    assert.equal(obs.id, r.id);
    assert.deepEqual(puntos.map((p) => [p.id, p.estado, p.quien]), [['0', 'PENDIENTE', 'contratista'], ['1', 'PENDIENTE', 'azt']]);
    assert.equal((await repo(TERCERO).listar()).lista.length, 0);
    await assert.rejects(repo(TERCERO).leer(r.id), (e) => e.codigo === 'no_existe' && e.message === MSG_OBS_NO_EXISTE);
    // El admin ve todas (dos consultas: las suyas y las 50 más recientes).
    const n = fs.consultas.length;
    assert.equal((await repo(ADMIN).listar()).lista.length, 1);
    assert.equal(fs.consultas.length - n, 2);
  });
  test('«un N.º, una obs abierta»: el segundo registro con el N.º se niega ANTES de escribir; tras RESUELTA, el candado se reasigna', async () => {
    const { fs, repo } = base();
    const r1 = await repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS });
    await assert.rejects(repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS }), (e) => e.codigo === 'duplicado' && e.message === MSG_NRO_ABIERTO);
    assert.equal(fs.lotes.length, 1, 'no se envió nada');
    assert.deepEqual(await repo(ADMIN).previaDelNro('00000001'), { obsId: r1.id, estado: 'ABIERTA', libre: false });
    await repo(ADMIN).resolver(r1.id, 'Se registró con el AZT equivocado');
    assert.equal(fs.store.get('odt_afinia_obs/' + r1.id).estado, 'RESUELTA');
    assert.equal((await repo(ADMIN).previaDelNro('00000001')).libre, true);
    const r2 = await repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS });
    assert.deepEqual(fs.store.get('odt_afinia_obs_nro/00000001'), { obsId: r2.id });
    assert.equal(fs.store.get('odt_afinia_obs/' + r1.id).estado, 'RESUELTA', 'la anterior queda (nada se borra)');
    // Solo un admin registra.
    await assert.rejects(repo(AZT).registrar({ form: { ...FORM, nro: '00000002' }, azt: HAB_AZT, puntos: PUNTOS }), /Solo un administrador/);
  });
  test('ciclo de un punto: AZT subsana → admin devuelve → AZT subsana → admin verifica: «Lista para publicar» y rastro completo', async () => {
    const { fs, repo } = base();
    const { id } = await repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: [PUNTOS[0]] });
    await repo(AZT).cambiarPunto(id, '0', 'subsanar', 'Se subió la foto');
    const lote = fs.lotes.at(-1).ops;
    assert.deepEqual(lote.map((o) => [o.tipo, o.ruta]), [['update', 'odt_afinia_obs/' + id + '/puntos/0'], ['update', 'odt_afinia_obs/' + id]], 'punto y resumen en UN lote');
    assert.equal(fs.store.get('odt_afinia_obs/' + id).resumen['0'], 'SUBSANADO');
    await assert.rejects(repo(AZT).cambiarPunto(id, '0', 'verificar', ''), /Solo un administrador/);
    await repo(ADMIN).cambiarPunto(id, '0', 'devolver', 'La foto no tiene fecha');
    await repo(AZT).cambiarPunto(id, '0', 'subsanar', 'Foto con fecha');
    await repo(ADMIN).cambiarPunto(id, '0', 'verificar', '');
    const p = fs.store.get('odt_afinia_obs/' + id + '/puntos/0');
    assert.equal(p.estado, 'VERIFICADO'); assert.equal(p.rev, 4);
    assert.deepEqual(Object.keys(p.rastro), ['1', '2', '3', '4'], 'cada cambio AGREGÓ su entrada; ninguna se pisó');
    assert.deepEqual(Object.values(p.rastro).map((e) => [e.de, e.a, e.nota, e.por.uid]), [
      ['PENDIENTE', 'SUBSANADO', 'Se subió la foto', AZT.uid], ['SUBSANADO', 'PENDIENTE', 'La foto no tiene fecha', ADMIN.uid],
      ['PENDIENTE', 'SUBSANADO', 'Foto con fecha', AZT.uid], ['SUBSANADO', 'VERIFICADO', '', ADMIN.uid]
    ]);
    assert.equal(p.texto, 'Falta el registro fotográfico', 'el texto no cambia');
    const { obs, puntos } = await repo(AZT).leer(id);
    assert.deepEqual(obs.resumen, { 0: 'VERIFICADO' });
    assert.ok(Number.isFinite(puntos[0].rastro['1'].enMs), 'la hora del rastro llega en milisegundos');
    const { listaParaPublicar } = await import('../assets/js/domain/odt_afinia_obs.js');
    assert.equal(listaParaPublicar(obs), true);
  });
  test('quien lo marcó subsanado no lo verifica (otro admin sí); agregar punto y su resumen; nada después de RESUELTA', async () => {
    const { fs, repo } = base();
    fs.poner('odt_afinia_firmantes/' + ADMIN2.uid, { uid: ADMIN2.uid, nombre: ADMIN2.nombre, correo: 'admin2@prueba.test' });
    const { id } = await repo(ADMIN).registrar({ form: FORM, azt: { uid: ADMIN2.uid, nombre: ADMIN2.nombre, correo: 'admin2@prueba.test' }, puntos: [PUNTOS[0]] });
    await repo(ADMIN2).cambiarPunto(id, '0', 'subsanar', 'Hecho por el AZT que es admin');
    await assert.rejects(repo(ADMIN2).cambiarPunto(id, '0', 'verificar', ''), /otro administrador/);
    await repo(ADMIN).cambiarPunto(id, '0', 'verificar', 'Revisado');
    const r = await repo(ADMIN).agregarPunto(id, { texto: 'Corregir la consignación', quien: 'responsable' });
    assert.equal(r.k, '1');
    assert.deepEqual(fs.store.get('odt_afinia_obs/' + id).resumen, { 0: 'VERIFICADO', 1: 'PENDIENTE' });
    assert.equal(fs.store.get('odt_afinia_obs/' + id).ultimo, '1');
    await assert.rejects(repo(AZT).agregarPunto(id, { texto: 'Otro punto más', quien: 'azt' }), /Solo un administrador/);
    await repo(ADMIN).resolver(id, 'Cerrada del todo');
    await assert.rejects(repo(ADMIN2).cambiarPunto(id, '1', 'subsanar', 'Tarde'), /resuelta/);
    await assert.rejects(repo(ADMIN).agregarPunto(id, { texto: 'Otro punto más', quien: 'azt' }), /resuelta/);
    await assert.rejects(repo(ADMIN).resolver(id, 'Otra vez'), /ya está resuelta/);
  });
  test('un lote negado se explica releyendo el servidor; uno sin respuesta dice «NO repita»', async () => {
    const neg = base({ denegarLote: true });
    neg.fs.poner('odt_afinia_obs_nro/00000003', { obsId: 'x'.repeat(20) });
    await assert.rejects(neg.repo(ADMIN).registrar({ form: FORM, azt: { ...HAB_AZT, nombre: 'Otro Nombre' }, puntos: PUNTOS }),
      (e) => e.codigo === 'sin_permiso' && /habilitación del AZT no coincide/.test(e.message));
    const colg = base({ colgarLote: true });
    await assert.rejects(colg.repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS }), (e) => e.codigo === 'pendiente' && /NO repita/.test(e.message));
    const red = base({ rechazarRed: true });
    await assert.rejects(red.repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS }), (e) => e.codigo === 'no_entro');
  });
  test('un lote que tarda: el «pendiente» trae su desenlace (`final`): si entra, «entro»; si la base lo niega, el «no» explicado', async () => {
    /** Un SDK cuyo lote no responde hasta `soltar()` (una red lenta). */
    const lento = (fs) => {
      let soltar; const demora = new Promise((r) => { soltar = r; });
      const F = { ...fs.F, writeBatch: (d) => { const b = fs.F.writeBatch(d); return { set: b.set, update: b.update, commit: () => demora.then(() => b.commit()) }; } };
      return { F, soltar };
    };
    const { fs, repo } = base();
    const { id } = await repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS });
    const l = lento(fs);
    const repoLento = crearRepositorioObs({ sdk: l.F, db: fs.db, sesion: () => AZT, tiempoLoteMs: 30 });
    const e = await repoLento.cambiarPunto(id, '0', 'subsanar', 'Se subió la foto').then(() => null, (x) => x);
    assert.equal(e && e.codigo, 'pendiente');
    assert.match(e.message, /NO repita/);
    assert.equal(typeof e.final.then, 'function');
    assert.equal(fs.store.get('odt_afinia_obs/' + id + '/puntos/0').estado, 'PENDIENTE', 'todavía no entró');
    l.soltar();
    assert.equal(await e.final, 'entro');
    assert.equal(fs.store.get('odt_afinia_obs/' + id + '/puntos/0').estado, 'SUBSANADO');
    // El mismo lote tardío, negado por la base: `final` rechaza con el «no» explicado releyendo el servidor.
    const l2 = lento(fs);
    const e2 = await crearRepositorioObs({ sdk: l2.F, db: fs.db, sesion: () => AZT, tiempoLoteMs: 30 })
      .cambiarPunto(id, '1', 'subsanar', 'Control diligenciado').then(() => null, (x) => x);
    assert.equal(e2 && e2.codigo, 'pendiente');
    fs.opciones.denegarLote = true;
    l2.soltar();
    await assert.rejects(e2.final, (x) => x.codigo === 'sin_permiso' && /La plataforma no aceptó el cambio/.test(x.message));
    // Un lote colgado para siempre: también trae `final` (si nadie lo espera, no deja un rechazo sin manejar).
    const colg = base({ colgarLote: true });
    const e3 = await colg.repo(ADMIN).registrar({ form: FORM, azt: HAB_AZT, puntos: PUNTOS }).then(() => null, (x) => x);
    assert.equal(e3.codigo, 'pendiente');
    assert.equal(typeof e3.final.then, 'function');
  });
  test('admin de arranque sin perfil (legacy) y sesión vencida se dicen en llano', async () => {
    const { repo } = base();
    await assert.rejects(repo({ ...ADMIN, legacy: true }).listar(), /no tiene perfil/);
    await assert.rejects(crearRepositorioObs({ sdk: {}, db: {}, sesion: () => null }).listar(), (e) => e.codigo === 'cuenta');
  });
});
