// Firma de ODT Afinia · INDICADORES · DATOS: el plan del lote (data/odt_afinia_cortes_lotes.js, puro) y el repositorio
// (data/odt_afinia_cortes.js) sobre el doble de Firestore de tests/odt_afinia_ui_dobles.js (con las consultas del
// fixture: where, varios orderBy, limit):
//   · el corte lleva EXACTAMENTE los 17 campos que pide la regla (con fechaDatos), y sus partes {k, odts} en trozos de
//     400 (llenas menos la última); todo en UN lote (corte + partes);
//   · lo que no se puede guardar se dice antes (sin ODT, sin huella, sin fecha, totales que no suman…) y planCorte
//     revisa TODOS los elementos de las listas (la regla, por su tope de expresiones, solo mira el primero);
//   · leer une las partes, descarta lo que no tiene forma de ODT y dice si el corte está completo;
//   · listar trae el más reciente primero; anterior / ultimoDe ordenan por la fecha de los DATOS; porHuella busca el
//     mismo archivo; estadoSgm consulta por N.º (de a 10) la firma y «Por subsanar», solo leyendo;
//   · solo un administrador con perfil; un lote que no responde a tiempo queda «pendiente» (NO repita).
// Datos INVENTADOS.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearFirestoreFalso } from './odt_afinia_ui_dobles.js';
import { leerCsv, analizarResponsable, TOPES_CORTE, CLAVES } from '../assets/js/domain/odt_afinia_indicadores.js';
import { planCorte, trozos, partesPara, unirPartes, odtValida } from '../assets/js/data/odt_afinia_cortes_lotes.js';
import { crearRepositorioCortes, SGM_POR_CONSULTA } from '../assets/js/data/odt_afinia_cortes.js';
import { RESP_A, RESP_B, archivoBase, csv, odt, conConsultas } from './odt_afinia_indicadores_fixture.js';

const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba', rol: 'admin', esAdmin: true, legacy: false };
const TECNICO = { uid: 'uid-tecnico-prueba', nombre: 'Tecnico De Prueba', rol: 'tecnico', esAdmin: false, legacy: false };
const HEX = 'cd'.repeat(32);
const ARCHIVO = { nombre: 'INFORME_ODT_20260101000000_prueba.csv', bytes: 4321, sha256: HEX };
const ID = 'A'.repeat(20);
const TS = { marca: 'ts' };
const CAMPOS_CORTE = ['archivo', 'creadoEn', 'creadoPor', 'fechaDatos', 'filasArchivo', 'filasResponsable', 'nPartes', 'odts', 'odtsArchivo',
  'porEmpresa', 'porMes', 'porTipo', 'porZona', 'rango', 'responsable', 'totales', 'version'];
// Versión 2 (2026-11-24): cada ODT guardada lleva además su AZT en sitio y su jefe de trabajo; versión 3 (2026-11-26,
// 99 §236), su fecha de ejecución y su equipo.
const CAMPOS_ODT = ['azt', 'cerrada', 'ejecucion', 'empresa', 'equipo', 'estado', 'jefe', 'nro', 'prevista', 'principal', 'subestacion', 'tipo', 'zona'];

function base() {
  const lectura = leerCsv(archivoBase());
  return { lectura, analisis: analizarResponsable(lectura, RESP_A) };
}
/** Un archivo con `n` ODT del mismo responsable (para los trozos). */
function grande(n) {
  const lectura = leerCsv(csv(Array.from({ length: n }, (_, i) => odt(String(92000000 + i), { estado: i % 3 ? 'CERRADA' : 'GENERADA', cerrada: i % 3 ? '01/06/2026 08:00' : '' }))));
  return { lectura, analisis: analizarResponsable(lectura, RESP_A) };
}
/** Una ODT guardada válida (9 campos), inventada. */
const odtG = (nro) => ({ nro, empresa: 'CONTRATISTA ALFA S.A.S.', tipo: 'TIPO UNO', zona: 'ZONA NORTE', subestacion: 'S/E PRUEBA UNO',
  prevista: '2026-03-15', cerrada: '', estado: 'GENERADA', principal: true });

describe('plan del lote (puro)', () => {
  test('el corte: exactamente los 17 campos de la regla (con fechaDatos), con sus valores', () => {
    const { lectura, analisis } = base();
    const p = planCorte({ id: ID, archivo: ARCHIVO, lectura, analisis, por: ADMIN, ts: TS });
    assert.deepEqual(Object.keys(p.corte).sort(), CAMPOS_CORTE);
    assert.equal(Object.keys(p.corte).length, 17);
    const c = p.corte;
    assert.equal(c.responsable, RESP_A);
    assert.deepEqual(c.archivo, ARCHIVO);
    assert.deepEqual(c.rango, { desde: '2026-01-05', hasta: '2026-04-06' });
    assert.equal(c.fechaDatos, '2026-01-01T00:00:00', 'la hora de descarga del nombre del archivo');
    assert.equal(c.filasArchivo, 11); assert.equal(c.odtsArchivo, 10); assert.equal(c.filasResponsable, 9); assert.equal(c.odts, 8);
    assert.deepEqual(Object.keys(c.totales), [...CLAVES]);
    assert.deepEqual(c.totales, { total: 8, generada: 1, ejecutada: 1, noEjecutada: 1, cerrada: 3, inactiva: 1, otro: 1 });
    for (const g of [...c.porEmpresa, ...c.porTipo, ...c.porZona]) assert.deepEqual(Object.keys(g), ['clave', ...CLAVES]);
    for (const m of c.porMes) assert.deepEqual(Object.keys(m), ['mes', 'generadas', 'cerradas']);
    assert.deepEqual(c.porMes.map((m) => m.mes), ['2026-01', '2026-02', '2026-03', '2026-04'], 'meses sin huecos');
    // Lo que la regla exige con su PRIMER elemento: que cada lista tenga al menos uno.
    for (const l of [c.porEmpresa, c.porTipo, c.porZona, c.porMes]) assert.ok(l.length >= 1);
    assert.equal(c.nPartes, 1); assert.equal(c.version, 3);   // 99 §236: versión 3 (con la fecha de ejecución)
    assert.deepEqual(c.creadoPor, { uid: ADMIN.uid, nombre: ADMIN.nombre });
    assert.equal(c.creadoEn, TS);
  });
  test('fechaDatos sin hora en el nombre del archivo: el final del día de la fecha prevista más reciente', () => {
    const { lectura, analisis } = base();
    const p = planCorte({ id: ID, archivo: { ...ARCHIVO, nombre: 'informe.csv' }, lectura, analisis, por: ADMIN, ts: TS });
    assert.equal(p.corte.fechaDatos, '2026-04-06T23:59:59');
    assert.match(p.corte.fechaDatos, /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
  });
  test('las partes: {k, odts} con las 13 claves de cada ODT (versión 3); todo en UNA lista de operaciones (corte primero)', () => {
    const { lectura, analisis } = base();
    const p = planCorte({ id: ID, archivo: ARCHIVO, lectura, analisis, por: ADMIN, ts: TS });
    assert.equal(p.operaciones.length, 2);
    assert.deepEqual(p.operaciones[0].ruta, ['odt_afinia_cortes', ID]);
    assert.deepEqual(p.operaciones[1].ruta, ['odt_afinia_cortes', ID, 'partes', '0']);
    assert.deepEqual(Object.keys(p.operaciones[1].datos), ['k', 'odts']);
    assert.equal(p.operaciones[1].datos.k, 0);
    assert.equal(p.operaciones[1].datos.odts.length, 8);
    for (const o of p.operaciones[1].datos.odts) {
      assert.deepEqual(Object.keys(o).sort(), CAMPOS_ODT);
      assert.equal(typeof o.principal, 'boolean');
      assert.ok(odtValida(o));
    }
  });
  test('trozos de 400: llenas menos la última (901 → 400 + 400 + 101)', () => {
    assert.deepEqual(trozos(Array.from({ length: 901 }, (_, i) => i)).map((x) => x.length), [400, 400, 101]);
    assert.deepEqual(trozos(Array.from({ length: 800 }, (_, i) => i)).map((x) => x.length), [400, 400]);
    assert.equal(partesPara(1), 1); assert.equal(partesPara(400), 1); assert.equal(partesPara(401), 2);
    const { lectura, analisis } = grande(901);
    const p = planCorte({ id: ID, archivo: ARCHIVO, lectura, analisis, por: ADMIN, ts: TS });
    assert.equal(p.corte.nPartes, 3);
    assert.deepEqual(p.operaciones.slice(1).map((o) => [o.ruta[3], o.datos.k, o.datos.odts.length]), [['0', 0, 400], ['1', 1, 400], ['2', 2, 101]]);
    assert.equal(TOPES_CORTE.porParte * TOPES_CORTE.partesMax, 24000);
    // Una parte llena (400 ODT) queda muy lejos del 1 MB de un documento de Firestore.
    assert.ok(JSON.stringify(p.operaciones[1].datos).length < 200 * 1024, 'una parte de 400 pesa ' + JSON.stringify(p.operaciones[1].datos).length + ' bytes');
  });
  test('lo que no se puede guardar se dice antes', () => {
    const { lectura, analisis } = base();
    const mal = (cambio) => () => planCorte({ id: ID, archivo: ARCHIVO, lectura, analisis, por: ADMIN, ts: TS, ...cambio });
    assert.throws(mal({ id: 'corto' }), /Identificador/);
    assert.throws(mal({ por: {} }), /quién guarda/);
    assert.throws(mal({ archivo: { ...ARCHIVO, sha256: 'xyz' } }), /huella/);
    assert.throws(mal({ archivo: { ...ARCHIVO, bytes: 0 } }), /tamaño/);
    assert.throws(mal({ archivo: { ...ARCHIVO, nombre: '' } }), /nombre del archivo/);
    assert.throws(mal({ analisis: { ...analisis, odts: [] } }), /no tiene ODT/);
    assert.throws(mal({ analisis: { ...analisis, responsable: '' } }), /responsable/);
    assert.throws(mal({ analisis: { ...analisis, rango: { desde: '', hasta: '' } } }), /fecha prevista legible/);
    assert.throws(mal({ analisis: { ...analisis, totales: { ...analisis.totales, cerrada: 2 } } }), /no suman/);
    assert.throws(mal({ analisis: { ...analisis, odts: [...analisis.odts, analisis.odts[0]] } }), /repetidos|no suman/);
    assert.throws(mal({ lectura: { ...lectura, odtsArchivo: 3 } }), /más ODT en el corte que en el archivo/);
    assert.throws(mal({ lectura: { ...lectura, odtsArchivo: 0 } }), /ODT del archivo no es válido/);
    assert.throws(mal({ analisis: { ...analisis, filasResponsable: 7 } }), /filas del responsable/);
    assert.throws(mal({ analisis: { ...analisis, porMes: Array.from({ length: 241 }, (_, i) => ({ mes: 'm' + i })) } }), /Demasiados meses/);
    assert.throws(mal({ analisis: { ...analisis, porEmpresa: Array.from({ length: 301 }, (_, i) => ({ clave: 'C' + i, total: 0 })) } }), /Demasiados contratistas/);
    // Cada lista con al menos un elemento (la regla revisa el primero): sin él, se dice aquí y no «la plataforma no aceptó».
    for (const l of ['porEmpresa', 'porTipo', 'porZona', 'porMes']) assert.throws(mal({ analisis: { ...analisis, [l]: [] } }), /le faltan los contratistas/, l);
    assert.doesNotThrow(mal({}));
  });
  test('planCorte revisa CADA elemento de las listas (la regla solo mira el primero): uno malo al FINAL tampoco pasa', () => {
    const { lectura, analisis } = base();
    const mal = (cambio) => () => planCorte({ id: ID, archivo: ARCHIVO, lectura, analisis: { ...analisis, ...cambio }, por: ADMIN, ts: TS });
    const ultimo = (l, x) => [...l.slice(0, -1), { ...l[l.length - 1], ...x }];
    assert.throws(mal({ porEmpresa: ultimo(analisis.porEmpresa, { clave: '' }) }), /sin nombre/);
    assert.throws(mal({ porTipo: ultimo(analisis.porTipo, { cerrada: 9 }) }), /más ODT que el corte/);
    assert.throws(mal({ porZona: ultimo(analisis.porZona, { total: 99 }) }), /más ODT que el corte/);
    assert.throws(mal({ porMes: ultimo(analisis.porMes, { mes: '2026-13' }) }), /Un mes con otra forma/);
    assert.throws(mal({ porMes: ultimo(analisis.porMes, { generadas: 99 }) }), /Un mes con otra forma/);
    // Una ODT sin N.º en cualquier posición (aquí, la última).
    assert.throws(mal({ odts: [...analisis.odts.slice(0, -1), { ...analisis.odts[analisis.odts.length - 1], nro: '' }] }), /sin N\.º/);
    // Lo que se guarda va con EXACTAMENTE las claves de la regla, aunque el análisis traiga de más.
    const p = planCorte({ id: ID, archivo: ARCHIVO, lectura, analisis: { ...analisis, porEmpresa: analisis.porEmpresa.map((g) => ({ ...g, extra: 1 })) }, por: ADMIN, ts: TS });
    for (const g of p.corte.porEmpresa) assert.deepEqual(Object.keys(g), ['clave', ...CLAVES]);
  });
  test('odtValida: los 9 campos, textos acotados, fechas aaaa-mm-dd o vacías, principal sí/no', () => {
    assert.equal(odtValida(odtG('90000001')), true);
    assert.equal(odtValida({ ...odtG('90000001'), extra: 1 }), false);
    const sinZona = odtG('90000001'); delete sinZona.zona;
    assert.equal(odtValida(sinZona), false);
    assert.equal(odtValida({ ...odtG(''), nro: '' }), false);
    assert.equal(odtValida({ ...odtG('9'.repeat(TOPES_CORTE.nroMax + 1)) }), false);
    assert.equal(odtValida({ ...odtG('90000001'), tipo: 'T'.repeat(TOPES_CORTE.textoMax + 1) }), false);
    assert.equal(odtValida({ ...odtG('90000001'), prevista: '15/03/2026' }), false);
    assert.equal(odtValida({ ...odtG('90000001'), principal: 'SI' }), false);
    for (const x of [null, 'texto', 7, ['a']]) assert.equal(odtValida(x), false);
  });
  test('unir las partes: completo (en orden de k), o cuáles faltan; lo que no es ODT se DESCARTA', () => {
    const corte = { nPartes: 3, odts: 5 };
    const p = (k, n) => ({ id: String(k), data: { k, odts: Array.from({ length: n }, (_, i) => odtG(9100000 + k * 10 + i + '')) } });
    assert.equal(unirPartes(corte, [p(2, 1), p(0, 2), p(1, 2)]).completo, true);
    assert.deepEqual(unirPartes(corte, [p(2, 1), p(0, 2), p(1, 2)]).odts.map((o) => o.nro), ['9100000', '9100001', '9100010', '9100011', '9100020'], 'en orden de k');
    const r = unirPartes(corte, [p(0, 2), p(2, 1)]);
    assert.equal(r.completo, false);
    assert.deepEqual(r.faltan, [1]);
    assert.equal(unirPartes(corte, [p(0, 2), p(1, 2), p(2, 2)]).completo, false, 'más ODT de las que dice el corte');
    assert.equal(unirPartes({ nPartes: 0, odts: 0 }, []).completo, false);
    // Basura dentro de una parte (la regla solo revisa la primera ODT): se descarta, se cuenta y el corte no queda completo.
    const sucia = { id: '1', data: { k: 1, odts: [odtG('9100010'), { cualquier: 'cosa' }, 'texto', null, { ...odtG('9100011'), extra: true }] } };
    const u = unirPartes(corte, [p(0, 2), sucia, p(2, 1)]);
    assert.equal(u.descartadas, 4);
    assert.deepEqual(u.odts.map((o) => o.nro), ['9100000', '9100001', '9100010', '9100020']);
    assert.equal(u.completo, false);
    // Partes con k fuera del corte, o sin lista, no entran.
    const v = unirPartes(corte, [p(0, 2), p(1, 2), p(2, 1), { id: '3', data: { k: 3, odts: [odtG('9100030')] } }, { id: 'x', data: { odts: [] } }]);
    assert.equal(v.completo, true);
    assert.equal(v.odts.length, 5);
  });
});

describe('repositorio sobre el doble de Firestore', () => {
  const repo = (fs, s = ADMIN, extra = {}) => crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30, ...extra });
  const nuevoFs = (op) => conConsultas(crearFirestoreFalso(op));
  test('guardar: UN lote con el corte (17 campos) y todas sus partes, todo con set; leer lo une y está completo', async () => {
    const fs = nuevoFs();
    const { lectura, analisis } = grande(901);
    const r = await repo(fs).guardar({ archivo: ARCHIVO, lectura, analisis });
    assert.equal(r.estado, 'entro');
    assert.equal(fs.lotes.length, 1, 'un solo lote');
    assert.equal(fs.lotes[0].ops.length, 4);
    assert.ok(fs.lotes[0].ops.every((o) => o.tipo === 'set'));
    assert.equal(fs.lotes[0].ops[0].ruta, 'odt_afinia_cortes/' + r.id);
    assert.deepEqual(Object.keys(fs.lotes[0].ops[0].datos).sort(), CAMPOS_CORTE);
    assert.equal(fs.lotes[0].ops[0].datos.creadoEn, fs.F.serverTimestamp(), 'hora del servidor');
    assert.deepEqual(fs.lotes[0].ops.slice(1).map((o) => o.ruta), [0, 1, 2].map((k) => 'odt_afinia_cortes/' + r.id + '/partes/' + k));
    const l = await repo(fs).leer(r.id);
    assert.equal(l.completo, true);
    assert.equal(l.descartadas, 0);
    assert.equal(l.odts.length, 901);
    assert.equal(l.corte.responsable, RESP_A);
    assert.equal(typeof l.corte.creadoEnMs, 'number');
    const qp = fs.consultas.find((x) => /\/partes$/.test(x.col));
    assert.deepEqual(qp.filtros, [{ t: 'limit', n: TOPES_CORTE.partesMax }], 'las partes, con limit ≤ 60 (lo que pide la regla)');
  });
  test('listar: el más reciente primero, con limit 50 y orderBy creadoEn desc; la página siguiente, con where creadoEn <', async () => {
    const fs = nuevoFs();
    const { lectura, analisis } = base();
    const a = await repo(fs).guardar({ archivo: ARCHIVO, lectura, analisis });
    const b = await repo(fs).guardar({ archivo: { ...ARCHIVO, nombre: 'otro.csv' }, lectura, analisis });
    const { cortes, tope } = await repo(fs).listar();
    assert.deepEqual(cortes.map((c) => c.id), [b.id, a.id]);
    assert.equal(tope, false);
    const q = fs.consultas.find((x) => x.col === 'odt_afinia_cortes');
    assert.deepEqual(q.filtros, [{ t: 'orderBy', campo: 'creadoEn', dir: 'desc' }, { t: 'limit', n: 50 }]);
    assert.equal(fs.consultas.find((x) => /\/partes$/.test(x.col)), undefined, 'listar no lee partes');
    const sig = await repo(fs).listar({ antesDe: cortes[0] });
    assert.deepEqual(sig.cortes.map((c) => c.id), [a.id]);
    const ultima = fs.consultas[fs.consultas.length - 1].filtros[0];
    assert.deepEqual([ultima.t, ultima.campo, ultima.opr], ['where', 'creadoEn', '<']);
  });
  test('anterior y ultimoDe: por la fecha de los DATOS (un archivo viejo cargado hoy no invierte nada), solo del mismo responsable', async () => {
    const fs = nuevoFs();
    const { lectura, analisis } = base();
    const deB = analizarResponsable(lectura, RESP_B);
    const g = (sello, an = analisis) => repo(fs).guardar({ archivo: { ...ARCHIVO, nombre: 'INFORME_ODT_' + sello + '_prueba.csv' }, lectura, analisis: an });
    const marzo = await g('20260301080000');
    const mayo = await g('20260501080000');
    const abril = await g('20260401080000');                // se guarda DESPUÉS de mayo, con datos de antes
    await g('20260415080000', deB);                          // otro responsable, en medio: no cuenta
    const leido = async (r) => (await repo(fs).leer(r.id)).corte;
    assert.equal((await repo(fs).anterior(await leido(mayo))).anterior.id, abril.id);
    assert.equal((await repo(fs).anterior(await leido(abril))).anterior.id, marzo.id);
    assert.deepEqual(await repo(fs).anterior(await leido(marzo)), { anterior: null, tope: false });
    assert.equal((await repo(fs).ultimoDe(RESP_A)).id, mayo.id);
    assert.equal((await repo(fs).ultimoDe('  ' + RESP_A + ' ')).id, mayo.id, 'el nombre se limpia como al guardarlo');
    assert.equal(await repo(fs).ultimoDe('NADIE CON ESE NOMBRE'), null);
    assert.equal(await repo(fs).ultimoDe(''), null);
    // La consulta que pide el índice compuesto responsable ↑ · fechaDatos ↓ · creadoEn ↓ (firestore.indexes.json).
    const q = fs.consultas.filter((x) => x.col === 'odt_afinia_cortes' && x.filtros.some((f) => f.campo === 'fechaDatos' && f.t === 'where'))[0];
    assert.deepEqual(q.filtros.map((f) => [f.t, f.campo || f.n, f.opr || f.dir || '']), [
      ['where', 'responsable', '=='], ['where', 'fechaDatos', '<='], ['orderBy', 'fechaDatos', 'desc'], ['orderBy', 'creadoEn', 'desc'], ['limit', 10, '']]);
    const u = fs.consultas.filter((x) => x.col === 'odt_afinia_cortes' && x.filtros.some((f) => f.t === 'limit' && f.n === 1))[0];
    assert.deepEqual(u.filtros.map((f) => [f.t, f.campo || f.n, f.opr || f.dir || '']), [
      ['where', 'responsable', '=='], ['orderBy', 'fechaDatos', 'desc'], ['orderBy', 'creadoEn', 'desc'], ['limit', 1, '']]);
    // Sin responsable o sin fecha de datos, no se consulta nada.
    const antes = fs.consultas.length;
    assert.deepEqual(await repo(fs).anterior({ responsable: '' }), { anterior: null, tope: false });
    assert.deepEqual(await repo(fs).anterior(null), { anterior: null, tope: false });
    assert.equal(fs.consultas.length, antes);
  });
  test('porHuella: los cortes de ese archivo exacto (limit 20); una huella que no es hex de 64 no consulta', async () => {
    const fs = nuevoFs();
    const { lectura, analisis } = base();
    const a = await repo(fs).guardar({ archivo: ARCHIVO, lectura, analisis });
    await repo(fs).guardar({ archivo: { ...ARCHIVO, sha256: 'ef'.repeat(32) }, lectura, analisis });
    assert.deepEqual((await repo(fs).porHuella(HEX)).map((c) => c.id), [a.id]);
    assert.deepEqual(await repo(fs).porHuella('ab'.repeat(32)), []);
    const q = fs.consultas[fs.consultas.length - 1];
    assert.deepEqual(q.filtros, [{ t: 'where', campo: 'archivo.sha256', opr: '==', valor: 'ab'.repeat(32) }, { t: 'limit', n: 20 }]);
    const antes = fs.consultas.length;
    assert.deepEqual(await repo(fs).porHuella('XYZ'), []);
    assert.equal(fs.consultas.length, antes);
  });
  test('estadoSgm: por N.º, de a 10, en la firma y en «Por subsanar» (solo lectura); gana el más avanzado', async () => {
    const fs = nuevoFs();
    fs.poner('odt_afinia/o1', { nro: '90000001', estado: 'CERRADA' });
    fs.poner('odt_afinia/o2', { nro: '90000002', estado: 'PENDIENTE_AZT' });
    fs.poner('odt_afinia/o3', { nro: '90000003', estado: 'ANULADA' });
    fs.poner('odt_afinia/o4', { nro: '90000004', estado: 'LISTA' });
    fs.poner('odt_afinia_obs/b1', { nro: '90000003', estado: 'ABIERTA' });
    fs.poner('odt_afinia_obs/b2', { nro: '90000004', estado: 'ABIERTA' });
    fs.poner('odt_afinia_obs/b3', { nro: '90000005', estado: 'RESUELTA' });
    const nros = Array.from({ length: 25 }, (_, i) => String(90000001 + i));
    const r = await repo(fs).estadoSgm([...nros, ' 90000001 ', '', null]);
    assert.deepEqual([...r.mapa.entries()].map(([n, x]) => [n, x.clave]).sort(), [['90000001', 'cerrada'], ['90000002', 'firma'], ['90000003', 'subsanar'], ['90000004', 'lista']]);
    assert.equal(r.consultados.length, 25, 'sin repetidos ni vacíos');
    const q = fs.consultas.filter((x) => x.col === 'odt_afinia' || x.col === 'odt_afinia_obs');
    assert.equal(SGM_POR_CONSULTA, 10);
    assert.equal(q.length, 6, '3 trozos (10 + 10 + 5) en cada colección');
    for (const x of q) {
      assert.equal(x.filtros[0].t, 'where'); assert.equal(x.filtros[0].campo, 'nro'); assert.equal(x.filtros[0].opr, 'in');
      assert.ok(x.filtros[0].valor.length <= 10);
      assert.deepEqual(x.filtros[1], { t: 'limit', n: 50 }, 'la regla de esas colecciones pide limit ≤ 50');
    }
    assert.equal(fs.lotes.length, 0, 'solo lectura: nada se escribe');
    assert.deepEqual(await repo(fs).estadoSgm([]), { mapa: new Map(), consultados: [] });
  });
  test('estadoSgm: si un trozo llega al tope de 50, consulta cada N.º por separado para no dejar ninguno afuera', async () => {
    const fs = nuevoFs();
    for (let i = 0; i < 50; i++) fs.poner('odt_afinia/h' + String(i).padStart(3, '0'), { nro: '90000001', estado: 'REEMPLAZADA' });
    fs.poner('odt_afinia/z999', { nro: '90000002', estado: 'LISTA' });
    const r = await repo(fs).estadoSgm(['90000001', '90000002']);
    assert.equal(r.mapa.get('90000002').clave, 'lista');
    assert.ok(fs.consultas.some((x) => x.col === 'odt_afinia' && x.filtros[0].opr === '==' && x.filtros[0].valor === '90000002'));
  });
  test('leer un corte incompleto lo dice; uno que no existe da «no existe»', async () => {
    const fs = nuevoFs();
    const { lectura, analisis } = grande(901);
    const r = await repo(fs).guardar({ archivo: ARCHIVO, lectura, analisis });
    fs.store.delete('odt_afinia_cortes/' + r.id + '/partes/1');
    const l = await repo(fs).leer(r.id);
    assert.equal(l.completo, false);
    assert.deepEqual(l.faltan, [1]);
    await assert.rejects(repo(fs).leer('B'.repeat(20)), (e) => e.codigo === 'no_existe');
    await assert.rejects(repo(fs).leer('../x'), (e) => e.codigo === 'no_existe');
  });
  test('solo un administrador con perfil (técnico, sin sesión y admin de arranque, no), en TODOS los métodos', async () => {
    const fs = nuevoFs();
    const { lectura, analisis } = base();
    const corte = { id: ID, responsable: RESP_A, fechaDatos: '2026-01-01T00:00:00' };
    // Cada llamada se arma al esperarla (una promesa rechazada sin esperar sería un rechazo suelto).
    const llamadas = (r) => [() => r.guardar({ archivo: ARCHIVO, lectura, analisis }), () => r.listar(), () => r.leer(ID), () => r.anterior(corte),
      () => r.ultimoDe(RESP_A), () => r.porHuella(HEX), () => r.estadoSgm(['90000001'])];
    for (const f of llamadas(repo(fs, TECNICO))) await assert.rejects(f, (e) => e.codigo === 'sin_permiso');
    for (const f of llamadas(repo(fs, { ...ADMIN, legacy: true }))) await assert.rejects(f, (e) => e.codigo === 'sin_permiso' && /perfil/.test(e.message));
    for (const f of llamadas(repo(fs, null))) await assert.rejects(f, (e) => e.codigo === 'cuenta');
    assert.equal(fs.lotes.length, 0, 'nada se escribió');
    assert.equal(fs.consultas.length, 0, 'nada se consultó');
  });
  test('un «no» de la regla se explica; un lote que no responde queda «pendiente» con su desenlace (NO repita)', async () => {
    const { lectura, analisis } = base();
    const fsNo = crearFirestoreFalso({ denegarLote: true });
    await assert.rejects(repo(fsNo).guardar({ archivo: ARCHIVO, lectura, analisis }), (e) => e.codigo === 'sin_permiso' && /no aceptó el corte/.test(e.message));
    const fsLento = crearFirestoreFalso({ colgarLote: true });
    await assert.rejects(repo(fsLento).guardar({ archivo: ARCHIVO, lectura, analisis }), (e) => {
      assert.equal(e.codigo, 'pendiente');
      assert.match(e.message, /NO repita/);
      assert.ok(e.final && typeof e.final.then === 'function');
      assert.ok(typeof e.id === 'string' && e.id.length === 20);
      return true;
    });
    // Si el lote sí entró aunque no respondió a tiempo, se da por guardado.
    const fsTarde = crearFirestoreFalso({ escribirYColgar: true });
    const r = await repo(fsTarde).guardar({ archivo: ARCHIVO, lectura, analisis });
    assert.equal(r.estado, 'entro');
    // Sin red: se dice que no quedó guardado.
    const fsRed = crearFirestoreFalso({ rechazarRed: true });
    await assert.rejects(repo(fsRed).guardar({ archivo: ARCHIVO, lectura, analisis }), (e) => e.codigo === 'no_entro');
  });
  test('un corte guardado no se cambia: el repositorio no tiene actualizar ni borrar', () => {
    const r = crearRepositorioCortes({ sdk: {}, db: {}, sesion: () => ADMIN });
    assert.deepEqual(Object.keys(r).sort(), ['anterior', 'estadoSgm', 'guardar', 'leer', 'listar', 'modo', 'porHuella', 'ultimoDe']);
  });
});
