// ══════════════════════════════════════════════════════════════
// Firma de ODT Afinia · INDICADORES · LECTORES (pedido del Ingeniero del 2026-11-24, «Todo, solo lectura»), reglas en
// el emulador:
//   · odt_afinia_config/indicadores {lectores: [uid] (≤ 20, sin repetir), actualizadoPor {uid, nombre}, actualizadoEn}:
//     lo crea y lo cambia SOLO un admin con perfil, con su forma exacta; nadie lo borra (ni el admin); lo lee
//     cualquier persona con perfil; listar la colección, nunca;
//   · odt_afinia_cortes/{id} y sus partes: además del admin con perfil, los LEE (get y list, con los mismos topes)
//     quien está en esa lista con perfil activo del equipo. Un AZT que no está, un técnico, un visitante (aunque esté
//     en la lista), un perfil inactivo (aunque esté), alguien sin perfil (aunque esté) y un anónimo, NO. Sin la lista,
//     solo los admin. Un lector NO crea cortes ni los cambia, ni escribe la lista;
//   · el REPOSITORIO de la página (data/odt_afinia_cortes.js con esLector, y data/odt_afinia_ind_lectores.js): un
//     lector incluido lee un corte con sus partes, el anterior y el historial; el «Estado en SGM» sale solo de lo que
//     le asignaron (parcial); uno no incluido se niega aunque la página creyera que sí;
//   · PRESUPUESTO: la lectura del lector y la escritura de la lista dejan ≥ 30 % libre del tope de 1000 expresiones
//     (relleno calibrado, como la prueba «presupuesto» de odt_afinia_cortes.rules.test.js).
// Cada caso en las DOS direcciones (L-73/L-78). Prefijo `il_` (ids `ilcorte…`); nunca clearFirestore() (el emulador
// se comparte con las demás pruebas de reglas). Datos INVENTADOS: ninguna persona, empresa, uid, correo, N.º ni
// conteo real.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as SDK from 'firebase/firestore';
import { agregar } from '../assets/js/domain/odt_afinia_indicadores.js';
import { crearRepositorioCortes } from '../assets/js/data/odt_afinia_cortes.js';
import { crearRepositorioLectoresInd } from '../assets/js/data/odt_afinia_ind_lectores.js';

const { doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, orderBy, limit, writeBatch, serverTimestamp, Timestamp } = SDK;
const REGLAS = readFileSync('firestore.rules', 'utf8');
let testEnv;

/* ── personas inventadas ─────────────────────────────────────────────────────── */
const P = {
  il_admin: { rol: 'admin', nombre: 'Admin Lectores Prueba', email: 'admin.lectores@prueba.test' },
  il_lector: { rol: 'tecnico', nombre: 'Lector Ficticio De Prueba', email: 'lector.ind@prueba.test' },
  il_lector2: { rol: 'tecnico', nombre: 'Segundo Lector Ficticio', email: 'lector2.ind@prueba.test' },
  il_azt: { rol: 'tecnico', nombre: 'Azt No Incluido Prueba', email: 'azt.noincluido@prueba.test' },
  il_tecnico: { rol: 'tecnico', nombre: 'Tecnico Lectores Prueba', email: 'tecnico.lectores@prueba.test' },
  il_visit: { rol: 'visitante', nombre: 'Visitante En La Lista', email: 'visitante.lectores@prueba.test' },
  il_inact: { rol: 'tecnico', nombre: 'Inactivo En La Lista', email: 'inactivo.lectores@prueba.test', activo: false },
  il_admin_inact: { rol: 'admin', nombre: 'Admin Inactivo Lectores', email: 'admin.inactivo.lectores@prueba.test', activo: false }
};
// En la lista: el lector, el visitante, el inactivo y alguien SIN perfil (ninguno de los tres últimos debe leer).
const LISTA = ['il_lector', 'il_visit', 'il_inact', 'il_sinperfil'];
const RUTA_LISTA = ['odt_afinia_config', 'indicadores'];
const plano = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
async function sembrar(fn) { await testEnv.withSecurityRulesDisabled(async (c) => fn(c.firestore())); }
async function leer(ruta) {
  let v; await testEnv.withSecurityRulesDisabled(async (c) => { v = (await getDoc(doc(c.firestore(), ruta))).data(); }); return v;
}
const nombreDe = (u) => (P[u] ? P[u].nombre : '');
/** La lista como la escribe la página (docLectores): 3 campos, quién y la hora del servidor. */
const listaDe = (uid, lectores, extra = {}) => ({ lectores, actualizadoPor: { uid, nombre: nombreDe(uid) }, actualizadoEn: serverTimestamp(), ...extra });
const escribirLista = (uid, datos, db) => setDoc(doc(db || plano(uid), ...RUTA_LISTA), datos);

/* ── cortes de prueba (como los guarda la página, con su repositorio) ─────────── */
const RESP = 'RESPONSABLE FICTICIO DE LECTORES';
const ESTADOS = ['GENERADA', 'EJECUTADA', 'CERRADA', 'CERRADA', 'NO EJECUTADA', 'CERRADA', 'INACTIVA'];
const mm = (i) => String((i % 12) + 1).padStart(2, '0');
const odtDe = (i) => {
  const estado = ESTADOS[i % ESTADOS.length];
  return {
    nro: String(93000000 + i), empresa: 'CONTRATISTA FICTICIO ' + (i % 5), tipo: 'TIPO FICTICIO ' + (i % 4), zona: 'ZONA FICTICIA ' + (i % 3),
    subestacion: 'S/E LECTORES ' + (i % 7), prevista: '2026-' + mm(i) + '-10', cerrada: estado === 'CERRADA' ? '2026-' + mm(i) + '-25' : '',
    estado, principal: i % 4 !== 0, azt: 'AZT FICTICIO ' + (i % 3), jefe: 'JEFE FICTICIO ' + (i % 5)
  };
};
const odtsDe = (n) => Array.from({ length: n }, (_, i) => odtDe(i));
const analisisDe = (n) => ({ responsable: RESP, odts: odtsDe(n), filasResponsable: n + 4, ...agregar(odtsDe(n)) });
const archivoDe = (sello, hex) => ({ nombre: 'INFORME_ODT_' + sello + '_prueba.csv', bytes: 5432, sha256: hex });
const sesionDe = (uid, esAdmin = false) => () => ({ uid, nombre: nombreDe(uid), esAdmin, legacy: false });
/** El repositorio de cortes de la página: el admin, o un «lector» (la página creyó que lo es: la regla decide). */
const repoCortes = (uid, esAdmin = false) => crearRepositorioCortes({ sdk: SDK, db: plano(uid), sesion: sesionDe(uid, esAdmin), esLector: !esAdmin });
const repoLista = (uid, esAdmin = false) => crearRepositorioLectoresInd({ sdk: SDK, db: plano(uid), sesion: sesionDe(uid, esAdmin) });
const NO_INCLUIDOS = ['il_azt', 'il_tecnico', 'il_visit', 'il_inact', 'il_sinperfil'];
let viejo; let nuevo;

/** Lo que hace la vista con un corte: get, list del historial, get y list de sus partes. */
async function lecturas(db, id) {
  return [
    () => getDoc(doc(db, 'odt_afinia_cortes', id)),
    () => getDocs(query(collection(db, 'odt_afinia_cortes'), orderBy('creadoEn', 'desc'), limit(50))),
    () => getDoc(doc(db, 'odt_afinia_cortes', id, 'partes', '0')),
    () => getDocs(query(collection(db, 'odt_afinia_cortes', id, 'partes'), limit(60)))
  ];
}

// Lección §234.6: los hooks de raíz van ANTES de todo describe (en Node 20, uno tardío no corre).
before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: REGLAS, host: '127.0.0.1', port: 8080 }
  });
  await sembrar(async (d) => {
    for (const [uid, p] of Object.entries(P)) {
      await setDoc(doc(d, 'usuarios', uid), { email: p.email, rol: p.rol, activo: p.activo ?? true, nombre: p.nombre });
    }
    await setDoc(doc(d, 'admins', 'il_arranque'), { email: 'arranque.lectores@prueba.test' });   // admin de arranque SIN perfil
  });
  // Dos cortes del mismo responsable (el segundo, de datos más recientes; 2 partes), guardados como la página.
  const repo = repoCortes('il_admin', true);
  viejo = await repo.guardar({ archivo: archivoDe('20260501080000', 'd1'.repeat(32)), lectura: { filas: 900, odtsArchivo: 700 }, analisis: analisisDe(420) });
  nuevo = await repo.guardar({ archivo: archivoDe('20260601080000', 'd2'.repeat(32)), lectura: { filas: 900, odtsArchivo: 700 }, analisis: analisisDe(430) });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

// ═════════════════════════════════════════════════════════════════════════════
describe('sin la lista: solo los administradores leen los cortes', () => {
  test('la lista todavía no existe: el admin lee; el lector (aún sin lista), el técnico y el anónimo, no', async () => {
    await sembrar(async (d) => { assert.equal((await getDoc(doc(d, ...RUTA_LISTA))).exists(), false, 'esta prueba empieza sin la lista'); });
    for (const f of await lecturas(plano('il_admin'), nuevo.id)) await assertSucceeds(f());
    for (const u of ['il_lector', 'il_tecnico']) for (const f of await lecturas(plano(u), nuevo.id)) await assertFails(f());
    for (const f of await lecturas(anon(), nuevo.id)) await assertFails(f());
    assert.equal(await repoLista('il_lector').soyLector(), false, 'sin la lista nadie más es lector');
  });
});

describe('la lista de lectores — la escribe solo un admin con perfil, con su forma exacta; nadie la borra', () => {
  test('el admin la CREA (con la hora del servidor y su nombre); el lector, el técnico, el admin inactivo, el de arranque y el anónimo, no', async () => {
    for (const u of ['il_lector', 'il_tecnico', 'il_admin_inact', 'il_arranque']) await assertFails(escribirLista(u, listaDe(u, LISTA)));
    await assertFails(setDoc(doc(anon(), ...RUTA_LISTA), listaDe('il_admin', LISTA)));
    await assertSucceeds(escribirLista('il_admin', listaDe('il_admin', LISTA)));
    const l = await leer(RUTA_LISTA.join('/'));
    assert.deepEqual(l.lectores, LISTA);
    assert.deepEqual(l.actualizadoPor, { uid: 'il_admin', nombre: P.il_admin.nombre });
    assert.equal(typeof l.actualizadoEn.toMillis(), 'number');
  });
  test('SABOTAJE de forma: campo de más o de menos, otro tipo, > 20, repetidos, vacío, número, coma dentro, otro autor u otra hora', async () => {
    const A = 'il_admin';
    const veinte = Array.from({ length: 20 }, (_, i) => 'il_uid' + i);
    const { lectores, actualizadoPor, actualizadoEn } = listaDe(A, LISTA);
    for (const [que, datos] of [
      ['campo de más', listaDe(A, LISTA, { nota: 'x' })],
      ['sin actualizadoEn', { lectores, actualizadoPor }],
      ['sin actualizadoPor', { lectores, actualizadoEn }],
      ['sin lectores', { actualizadoPor, actualizadoEn }],
      ['lectores no es lista', listaDe(A, 'il_lector')],
      ['lectores como mapa', listaDe(A, { a: 'il_lector' })],
      ['21 uids', listaDe(A, [...veinte, 'il_uid20'])],
      ['repetido', listaDe(A, ['il_lector', 'il_lector'])],
      ['uno vacío', listaDe(A, [''])],
      ['uno vacío al final', listaDe(A, ['il_lector', ''])],
      ['un número', listaDe(A, ['il_lector', 7])],
      ['un nulo', listaDe(A, [null])],
      ['un booleano', listaDe(A, [true])],
      ['coma dentro', listaDe(A, ['il_lector,il_azt'])],
      ['espacio', listaDe(A, ['il lector'])],
      ['barra', listaDe(A, ['il/lector'])],
      ['129 caracteres', listaDe(A, ['x'.repeat(129)])],
      ['otro autor', listaDe(A, LISTA, { actualizadoPor: { uid: 'il_lector', nombre: P.il_lector.nombre } })],
      ['otro nombre', listaDe(A, LISTA, { actualizadoPor: { uid: A, nombre: 'Otro Nombre' } })],
      ['autor con campo de más', listaDe(A, LISTA, { actualizadoPor: { uid: A, nombre: P.il_admin.nombre, rol: 'admin' } })],
      ['hora del cliente', listaDe(A, LISTA, { actualizadoEn: Timestamp.fromMillis(Date.UTC(2026, 0, 1)) })]
    ]) await assertFails(escribirLista(A, datos), que);
    // Controles (pasan): 20 uids exactos, 128 caracteres, «_» y «-», y la lista vacía (solo los admin).
    await assertSucceeds(escribirLista(A, listaDe(A, veinte)));
    await assertSucceeds(escribirLista(A, listaDe(A, ['x'.repeat(128), 'uid_con-guion'])));
    await assertSucceeds(escribirLista(A, listaDe(A, [])));
    await assertSucceeds(escribirLista(A, listaDe(A, LISTA)));
    assert.deepEqual((await leer(RUTA_LISTA.join('/'))).lectores, LISTA);
  });
  test('nadie la borra (ni el admin); un lector no la cambia (ni para agregarse a otro); listar la colección, nunca', async () => {
    for (const u of ['il_admin', 'il_lector', 'il_tecnico']) await assertFails(deleteDoc(doc(plano(u), ...RUTA_LISTA)), u);
    await assertFails(updateDoc(doc(plano('il_lector'), ...RUTA_LISTA), { lectores: [...LISTA, 'il_azt'] }));
    await assertFails(escribirLista('il_lector', listaDe('il_lector', [...LISTA, 'il_azt'])));
    await assertFails(escribirLista('il_azt', listaDe('il_azt', ['il_azt'])));
    // El admin la cambia con update solo si deja la forma exacta (con la hora del servidor).
    await assertFails(updateDoc(doc(plano('il_admin'), ...RUTA_LISTA), { lectores: LISTA }));
    await assertSucceeds(updateDoc(doc(plano('il_admin'), ...RUTA_LISTA), { lectores: LISTA, actualizadoEn: serverTimestamp() }));
    for (const u of ['il_admin', 'il_lector']) await assertFails(getDocs(query(collection(plano(u), 'odt_afinia_config'), limit(5))), u);
    assert.deepEqual((await leer(RUTA_LISTA.join('/'))).lectores, LISTA);
  });
  test('la LEE cualquier persona con perfil (solo trae uids); sin perfil o sin sesión, no', async () => {
    for (const u of ['il_admin', 'il_lector', 'il_azt', 'il_tecnico', 'il_visit', 'il_inact']) await assertSucceeds(getDoc(doc(plano(u), ...RUTA_LISTA)), u);
    await assertFails(getDoc(doc(plano('il_sinperfil'), ...RUTA_LISTA)));
    await assertFails(getDoc(doc(anon(), ...RUTA_LISTA)));
  });
});

describe('leer cortes y partes — el admin y los LECTORES de la lista (con perfil activo del equipo); nadie más', () => {
  test('el lector incluido lee el corte, el historial (limit ≤ 50) y las partes (limit ≤ 60); sin tope o con uno mayor, no', async () => {
    const d = plano('il_lector');
    for (const f of await lecturas(d, nuevo.id)) await assertSucceeds(f());
    await assertSucceeds(getDoc(doc(d, 'odt_afinia_cortes', nuevo.id, 'partes', '1')));
    await assertFails(getDocs(query(collection(d, 'odt_afinia_cortes'), limit(51))));
    await assertFails(getDocs(query(collection(d, 'odt_afinia_cortes'))));
    await assertFails(getDocs(query(collection(d, 'odt_afinia_cortes', nuevo.id, 'partes'), limit(61))));
  });
  test('NO leen: el AZT que no está, el técnico, y —aunque estén en la lista— el visitante, el inactivo y quien no tiene perfil; ni el anónimo', async () => {
    for (const u of NO_INCLUIDOS) for (const f of await lecturas(plano(u), nuevo.id)) await assertFails(f(), u);
    for (const f of await lecturas(anon(), nuevo.id)) await assertFails(f());
  });
  test('el lector NO crea un corte (ni una parte suelta), ni cambia ni borra uno guardado', async () => {
    await assert.rejects(repoCortes('il_lector', true).guardar({ archivo: archivoDe('20260701080000', 'd3'.repeat(32)), lectura: { filas: 900, odtsArchivo: 700 }, analisis: analisisDe(5) }),
      (e) => e.codigo === 'sin_permiso', 'aunque la página lo creyera admin, la regla lo niega');
    const d = plano('il_lector');
    const b = writeBatch(d);
    b.set(doc(d, 'odt_afinia_cortes', 'ilcorte0000000000001'), { responsable: RESP });
    await assertFails(b.commit());
    await assertFails(setDoc(doc(d, 'odt_afinia_cortes', nuevo.id, 'partes', '5'), { k: 5, odts: [odtDe(1)] }));
    await assertFails(updateDoc(doc(d, 'odt_afinia_cortes', nuevo.id), { responsable: 'OTRO' }));
    await assertFails(deleteDoc(doc(d, 'odt_afinia_cortes', nuevo.id)));
    await assertFails(deleteDoc(doc(d, 'odt_afinia_cortes', nuevo.id, 'partes', '0')));
    assert.equal((await leer('odt_afinia_cortes/' + nuevo.id)).responsable, RESP);
  });
});

describe('el REPOSITORIO de la página contra las reglas (lo que hace la pestaña de un lector)', () => {
  const NROS = ['93000001', '93000002', '93000003', '93000004'];
  test('soyLector: el incluido sí; el AZT que no está y el técnico, no', async () => {
    assert.equal(await repoLista('il_lector').soyLector(), true);
    for (const u of ['il_azt', 'il_tecnico']) assert.equal(await repoLista(u).soyLector(), false, u);
  });
  test('el lector incluido: listar, leer un corte CON SUS PARTES, anterior y ultimoDe; porHuella y guardar, no (solo de la carga)', async () => {
    const r = repoCortes('il_lector');
    const h = await r.listar();
    assert.ok(h.cortes.some((c) => c.id === nuevo.id) && h.cortes.some((c) => c.id === viejo.id));
    const l = await r.leer(nuevo.id);
    assert.equal(l.completo, true);
    assert.equal(l.odts.length, 430, 'las dos partes (400 + 30)');
    assert.equal(l.corte.nPartes, 2);
    assert.equal(l.corte.responsable, RESP);
    assert.equal((await r.anterior(l.corte)).anterior.id, viejo.id);
    assert.equal((await r.ultimoDe(RESP)).id, nuevo.id);
    await assert.rejects(r.porHuella('d1'.repeat(32)), (e) => e.codigo === 'sin_permiso');
  });
  test('quien NO está en la lista se niega en la plataforma aunque la página creyera que es lector', async () => {
    for (const u of NO_INCLUIDOS) {
      const r = repoCortes(u);
      const niega = (e) => e.codigo === 'sin_permiso';
      await assert.rejects(r.listar(), niega, u + ' listar');
      await assert.rejects(r.leer(nuevo.id), niega, u + ' leer');
      await assert.rejects(r.ultimoDe(RESP), niega, u + ' ultimoDe');
    }
  });
  test('estadoSgm del lector: solo lo que le asignaron (con las consultas de la bandeja y de «Por subsanar»), y `parcial`', async () => {
    const ts = Timestamp.fromMillis(Date.UTC(2026, 5, 1));
    await sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia', 'ilsgmodt000000000001'), { nro: NROS[0], estado: 'LISTA', lectores: ['il_lector'], publicadoEn: ts });
      await setDoc(doc(d, 'odt_afinia', 'ilsgmodt000000000002'), { nro: NROS[1], estado: 'CERRADA', lectores: ['il_azt'], publicadoEn: ts });
      await setDoc(doc(d, 'odt_afinia_obs', 'ilsgmobs000000000001'), { nro: NROS[2], estado: 'ABIERTA', lectores: ['il_lector'], creadoEn: ts });
      await setDoc(doc(d, 'odt_afinia_obs', 'ilsgmobs000000000002'), { nro: NROS[3], estado: 'ABIERTA', lectores: ['il_azt'], creadoEn: ts });
    });
    const r = await repoCortes('il_lector').estadoSgm(NROS);
    assert.equal(r.parcial, true);
    assert.deepEqual(r.consultados, NROS);
    assert.equal(r.mapa.get(NROS[0]).clave, 'lista');
    assert.equal(r.mapa.get(NROS[2]).clave, 'subsanar');
    assert.equal(r.mapa.has(NROS[1]), false, 'la ODT de otro AZT no se ve');
    assert.equal(r.mapa.has(NROS[3]), false, 'la obs de otro AZT no se ve');
    // El admin, por N.º, las ve todas (y sin `parcial`).
    const a = await repoCortes('il_admin', true).estadoSgm(NROS);
    assert.equal(a.parcial, undefined);
    assert.deepEqual(NROS.map((n) => a.mapa.get(n).clave), ['lista', 'cerrada', 'subsanar', 'subsanar']);
    // Las reglas de la firma y de «Por subsanar» NO cambiaron: cualquiera ve solo lo que le asignaron. El técnico (sin
    // nada asignado) no ve ninguna; el AZT que no es lector ve solo las suyas (nada de los cortes ni de otros).
    assert.equal((await repoCortes('il_tecnico').estadoSgm(NROS)).mapa.size, 0);
    const z = await repoCortes('il_azt').estadoSgm(NROS);
    assert.deepEqual([...z.mapa.keys()].sort(), [NROS[1], NROS[3]]);
    // Por N.º (la consulta del admin), un no admin se niega: esas reglas exigen lectores array-contains uid.
    await assertFails(getDocs(query(collection(plano('il_lector'), 'odt_afinia'), SDK.where('nro', 'in', NROS), limit(50))));
    await assertFails(getDocs(query(collection(plano('il_lector'), 'odt_afinia_obs'), SDK.where('nro', 'in', NROS), limit(50))));
  });
  test('la lista con su repositorio: el admin la guarda y la relee del servidor; un lector no (ni haciéndose pasar por admin)', async () => {
    const r = await repoLista('il_admin', true).guardar(['il_lector', 'il_lector2']);
    assert.deepEqual(r.lectores, ['il_lector', 'il_lector2']);
    assert.deepEqual(r.actualizadoPor, { uid: 'il_admin', nombre: P.il_admin.nombre });
    assert.equal(await repoLista('il_lector2').soyLector(), true);
    for (const f of await lecturas(plano('il_lector2'), nuevo.id)) await assertSucceeds(f());
    await assert.rejects(repoLista('il_lector').guardar(['il_lector']), (e) => e.codigo === 'sin_permiso');
    await assert.rejects(repoLista('il_lector', true).guardar(['il_lector', 'il_azt']), (e) => e.codigo === 'sin_permiso' && /no aceptó la lista/.test(e.message));
    // Quitarlo de la lista le quita la lectura en el acto.
    await repoLista('il_admin', true).guardar(['il_lector']);
    assert.equal(await repoLista('il_lector2').soyLector(), false);
    for (const f of await lecturas(plano('il_lector2'), nuevo.id)) await assertFails(f());
    for (const f of await lecturas(plano('il_lector'), nuevo.id)) await assertSucceeds(f());
    // Se deja como empezó esta parte (el lector, el visitante, el inactivo y el sin perfil).
    await repoLista('il_admin', true).guardar(LISTA);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRESUPUESTO: Firestore evalúa ≤ 1000 expresiones por petición. Se mide como en odt_afinia_cortes.rules.test.js:
// 1) cuántos términos de relleno caben solos en una regla vacía (cap); 2) con las reglas del repo + 30 % de ese
// relleno al final de odtIndLector y de odtIndConfigLectores, la lectura del lector (get y list del corte y de sus
// partes) y la escritura de la lista DEBEN pasar; 3) control: con el relleno entero, NO (el relleno de verdad cuenta).
// ═════════════════════════════════════════════════════════════════════════════
describe('presupuesto — la lectura del lector y la escritura de la lista dejan ≥ 30 % del tope de 1000 expresiones', () => {
  const U = '1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1';
  const FUNCIONES = '    function ilPadU() { return ' + U + '; }\n    function ilPadV() { return ' + Array(10).fill('ilPadU()').join(' && ') + '; }\n';
  const relleno = (n) => [...Array(Math.floor(n / 100)).fill('ilPadV()'), ...Array(Math.floor((n % 100) / 10)).fill('ilPadU()'), ...Array(n % 10).fill('1 == 1')].join(' && ') || 'true';
  const FIN_LECTOR = 'request.auth.uid in get(odtIndRutaLectores()).data.lectores));';
  const FIN_LISTA = "'nombre': profile().get('nombre', '')}\n        && d.actualizadoEn == request.time;";
  const ANCLA = '    function odtIndRutaLectores()';
  let nProyecto = 0;
  const vacia = (n) => "rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\n" + FUNCIONES
    + '    function ilPad() { return ' + relleno(n) + '; }\n    match /cal/{id} { allow create: if ilPad(); }\n} }';
  function conRelleno(nLector, nLista) {
    for (const a of [FIN_LECTOR, FIN_LISTA, ANCLA]) assert.equal(REGLAS.split(a).length, 2, 'el ancla «' + a + '» cambió: ajuste esta prueba');
    return REGLAS.replace(FIN_LECTOR, FIN_LECTOR.slice(0, -1) + ' && ' + relleno(nLector) + ';')
      .replace(FIN_LISTA, FIN_LISTA.slice(0, -1) + ' && ' + relleno(nLista) + ';')
      .replace(ANCLA, FUNCIONES + ANCLA);
  }
  const resultado = (e) => (/1000 expressions/.test(String(e && e.message)) ? 'tope' : 'niega: ' + String(e && e.message).slice(0, 200));
  /** 'entra' | 'tope' | 'niega: …' para: 'vacia' (control), 'lector' (las 4 lecturas de la vista) o 'lista' (el admin la escribe). */
  async function medir(reglas, que) {
    const env = await initializeTestEnvironment({ projectId: 'demo-sgm-presupuesto-lectores-' + (++nProyecto), firestore: { rules: reglas, host: '127.0.0.1', port: 8080 } });
    try {
      await env.withSecurityRulesDisabled(async (c) => {
        const d = c.firestore();
        for (const u of ['il_admin', 'il_lector']) await setDoc(doc(d, 'usuarios', u), { email: P[u].email, rol: P[u].rol, activo: true, nombre: P[u].nombre });
        await setDoc(doc(d, ...RUTA_LISTA), { lectores: ['il_lector'], actualizadoPor: { uid: 'il_admin', nombre: P.il_admin.nombre }, actualizadoEn: Timestamp.now() });
        await setDoc(doc(d, 'odt_afinia_cortes', 'ilcortepres000000001'), { responsable: RESP, creadoEn: Timestamp.now() });
        await setDoc(doc(d, 'odt_afinia_cortes', 'ilcortepres000000001', 'partes', '0'), { k: 0, odts: [odtDe(0)] });
      });
      if (que === 'vacia') {
        const d = env.authenticatedContext('il_admin').firestore();
        await setDoc(doc(d, 'cal', 'x'), { a: 1 });
        return 'entra';
      }
      if (que === 'lista') {
        const d = env.authenticatedContext('il_admin').firestore();
        await setDoc(doc(d, ...RUTA_LISTA), listaDe('il_admin', Array.from({ length: 20 }, (_, i) => 'il_uid' + i)));
        return 'entra';
      }
      const d = env.authenticatedContext('il_lector').firestore();
      for (const f of await lecturas(d, 'ilcortepres000000001')) await f();
      return 'entra';
    } catch (e) {
      return resultado(e);
    } finally { await env.cleanup(); }
  }
  test('calibrado: con ≥ 30 % de relleno, el lector lee y el admin guarda la lista (20 uids); con el relleno entero, no', async () => {
    let lo = 50; let hi = 400;                     // lo entra, hi no
    assert.equal(await medir(vacia(lo), 'vacia'), 'entra');
    assert.equal(await medir(vacia(hi), 'vacia'), 'tope');
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (await medir(vacia(m), 'vacia') === 'entra') lo = m; else hi = m; }
    const cap = lo;
    const margen = Math.ceil(cap * 0.3);
    assert.equal(await medir(conRelleno(0, 0), 'lector'), 'entra');
    assert.equal(await medir(conRelleno(0, 0), 'lista'), 'entra');
    assert.equal(await medir(conRelleno(margen, margen), 'lector'), 'entra', 'la lectura del lector ya no deja 30 % libre (caben ' + cap + ' términos solos)');
    assert.equal(await medir(conRelleno(margen, margen), 'lista'), 'entra', 'la escritura de la lista ya no deja 30 % libre (caben ' + cap + ' términos solos)');
    assert.notEqual(await medir(conRelleno(cap, 0), 'lector'), 'entra', 'control: el relleno entero en la lectura pasa el tope');
    assert.notEqual(await medir(conRelleno(0, cap), 'lista'), 'entra', 'control: el relleno entero en la lista pasa el tope');
  });
});
