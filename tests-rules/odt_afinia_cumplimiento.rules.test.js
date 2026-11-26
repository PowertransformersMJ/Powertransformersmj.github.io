// ══════════════════════════════════════════════════════════════
// Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE (99 §236, pedido del Ingeniero del 2026-11-26), reglas en el emulador:
//   · corte VERSIÓN 3: entra con version == 3 y la PRIMERA ODT de cada parte con sus 13 claves (`ejecucion`
//     'aaaa-mm-dd' o vacía y `equipo`, texto de 0 a 200); claves de más o de menos, la fecha con otra forma o un equipo
//     que no es texto o pasa de 200, se niegan (lo de la versión 2 nueva
//     negada está en odt_afinia_cortes.rules.test.js). Guardado como lo hace la página (repositorio), entra;
//   · odt_afinia_config/cumplimiento {activo, remitente, para [{correo, nombre}] (1..5), cc [correo] (0..5),
//     responsable, audienciaScript (99 §236: el script de Google aprobado, 0..200 de un id de cliente)}: la leen, la
//     crean y la cambian SOLO los administradores con perfil, con su forma EXACTA de 6 claves (cada
//     destinatario y cada copia se revisan uno por uno); nadie la borra ni la lista; la que arma el dominio
//     (docConfigCumplimiento) pasa, también con 5 destinatarios y 5 copias, y con ≥ 30 % libre del tope de 1000
//     expresiones (relleno calibrado, como la prueba «presupuesto» de los cortes);
//   · odt_afinia_config/cumplimiento_script (99 §236: el estado del script de Google, lo escribe solo la función): lo
//     lee solo un administrador con perfil; nadie lo escribe, borra ni lista desde la página (ni el admin). Con el
//     REPOSITORIO de la página: el admin lee el estado y aprueba el script (audienciaScript = audienciaVista);
//   · odt_afinia_correos y odt_afinia_avisos: escritura del cliente SIEMPRE negada (ni el admin: solo el servidor);
//     los leen (get y list con limit ≤ 50) los administradores y los LECTORES de Indicadores; un técnico que no está en
//     la lista, un visitante, un inactivo y un anónimo, no. También con el REPOSITORIO de la página.
//   · 99 §236 (pedido del 2026-11-26, «cuándo y cuántas veces notificas»): odt_afinia_config/cumplimiento_resumen lo
//     escribe solo el servidor (ni el admin desde la página) y lo leen el admin y los lectores; las consultas del
//     bloque de notificaciones (avisos por N.º con «in» de a 10 y limit 50, la tabla de a 20 con cursor, conteos de
//     limit 50; sin limit o con 51, no) y su REPOSITORIO, para el lector sí y para el técnico no.
// Cada caso en las DOS direcciones (L-73/L-78). Prefijo `cu_` (ids `cucorte…`); nunca clearFirestore() (el emulador se
// comparte con las demás pruebas de reglas): la lista de lectores de Indicadores se deja como estaba. Datos INVENTADOS:
// ninguna persona, empresa, uid, correo, N.º de ODT ni conteo real.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as SDK from 'firebase/firestore';
import { agregar } from '../assets/js/domain/odt_afinia_indicadores.js';
import { crearRepositorioCortes } from '../assets/js/data/odt_afinia_cortes.js';
import { crearRepositorioCumplimiento } from '../assets/js/data/odt_afinia_cumplimiento.js';
import { crearRepositorioScript } from '../assets/js/data/odt_afinia_cumplimiento_script.js';
import { docConfigCumplimiento } from '../assets/js/domain/odt_afinia_cumplimiento.js';
import { crearRepositorioNotificaciones } from '../assets/js/data/odt_afinia_cumplimiento_notificaciones.js';

const { doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, orderBy, limit, writeBatch, serverTimestamp, Timestamp, where, startAfter, getCountFromServer } = SDK;
const REGLAS = readFileSync('firestore.rules', 'utf8');
let testEnv;
let listaAntes;   // la lista de lectores de Indicadores antes de esta prueba (se deja igual al terminar)

/* ── personas inventadas ─────────────────────────────────────────────────────── */
const P = {
  cu_admin: { rol: 'admin', nombre: 'Admin Cumplimiento Prueba', email: 'admin.cumplimiento@prueba.test' },
  cu_lector: { rol: 'tecnico', nombre: 'Lector Cumplimiento Prueba', email: 'lector.cumplimiento@prueba.test' },
  cu_tecnico: { rol: 'tecnico', nombre: 'Tecnico Cumplimiento Prueba', email: 'tecnico.cumplimiento@prueba.test' },
  cu_visit: { rol: 'visitante', nombre: 'Visitante Cumplimiento', email: 'visitante.cumplimiento@prueba.test' },
  cu_inact: { rol: 'admin', nombre: 'Admin Inactivo Cumplimiento', email: 'inactivo.cumplimiento@prueba.test', activo: false }
};
const RUTA_LECTORES = ['odt_afinia_config', 'indicadores'];
const RUTA_CONFIG = ['odt_afinia_config', 'cumplimiento'];
const RUTA_SCRIPT = ['odt_afinia_config', 'cumplimiento_script'];
const AUD = '9000000003-ficticio0reglas.apps.googleusercontent.com';
const plano = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
async function sembrar(fn) { await testEnv.withSecurityRulesDisabled(async (c) => fn(c.firestore())); }
const nombreDe = (u) => (P[u] ? P[u].nombre : '');
const sesionDe = (uid, esAdmin) => () => ({ uid, nombre: nombreDe(uid), esAdmin, legacy: false });

/** Una configuración válida (armada por el dominio, como la guarda la página). */
const CONFIG = docConfigCumplimiento({
  activo: true, remitente: 'remitente.sgm@prueba.test', responsable: 'RESPONSABLE FICTICIO DE CUMPLIMIENTO',
  para: [{ correo: 'destino.uno@prueba.test', nombre: 'Persona Destino Uno' }], cc: []
});
const LLENA = docConfigCumplimiento({
  activo: false, remitente: 'remitente.sgm@prueba.test', responsable: 'RESPONSABLE FICTICIO DE CUMPLIMIENTO',
  para: Array.from({ length: 5 }, (_, i) => ({ correo: 'destino' + i + '@prueba.test', nombre: 'Persona Destino ' + i })),
  cc: Array.from({ length: 5 }, (_, i) => 'copia' + i + '@prueba.test')
});

/* ── cortes de prueba de la versión 3 ─────────────────────────────────────────── */
const ID = (k) => 'cucorte' + String(k).padStart(13, '0');
const HEX = 'cd'.repeat(32);
const odtDe = (i) => ({
  nro: String(94000000 + i), empresa: 'CONTRATISTA FICTICIO ' + (i % 3), tipo: 'TIPO FICTICIO', zona: 'ZONA FICTICIA', subestacion: 'S/E CUMPLIMIENTO ' + (i % 4),
  prevista: '2026-10-0' + ((i % 9) + 1), cerrada: i % 2 ? '2026-11-10' : '', estado: i % 2 ? 'CERRADA' : 'EJECUTADA', principal: true,
  azt: 'AZT FICTICIO', jefe: 'JEFE FICTICIO', ejecucion: '2026-10-2' + (i % 9), equipo: 'EQUIPO FICTICIO ' + (i % 5)
});
const odtsDe = (n) => Array.from({ length: n }, (_, i) => odtDe(i));
function corteDe(n, extra = {}) {
  const ag = agregar(odtsDe(n));
  return {
    responsable: 'RESPONSABLE FICTICIO DE CUMPLIMIENTO', archivo: { nombre: 'INFORME_ODT_20261101000000_prueba.csv', bytes: 999, sha256: HEX },
    rango: ag.rango, fechaDatos: '2026-11-01T00:00:00', filasArchivo: n + 2, odtsArchivo: n + 1, filasResponsable: n, odts: n,
    totales: ag.totales, porEmpresa: ag.porEmpresa, porTipo: ag.porTipo, porZona: ag.porZona, porMes: ag.porMes,
    nPartes: Math.ceil(n / 400), version: 3, creadoPor: { uid: 'cu_admin', nombre: nombreDe('cu_admin') }, creadoEn: serverTimestamp(), ...extra
  };
}
function guardar(id, n, { primera, db } = {}) {
  const d = db || plano('cu_admin'); const b = writeBatch(d);
  b.set(doc(d, 'odt_afinia_cortes', id), corteDe(n));
  const odts = odtsDe(n);
  if (primera) odts[0] = primera({ ...odts[0] });
  b.set(doc(d, 'odt_afinia_cortes', id, 'partes', '0'), { k: 0, odts });
  return b.commit();
}

// Lección §234.6: los hooks de raíz van ANTES de todo describe (en Node 20, uno tardío no corre).
before(async () => {
  testEnv = await initializeTestEnvironment({ projectId: 'demo-sgm-rules', firestore: { rules: REGLAS, host: '127.0.0.1', port: 8080 } });
  await sembrar(async (d) => {
    for (const [uid, p] of Object.entries(P)) await setDoc(doc(d, 'usuarios', uid), { email: p.email, rol: p.rol, activo: p.activo ?? true, nombre: p.nombre });
    await setDoc(doc(d, 'admins', 'cu_arranque'), { email: 'arranque.cumplimiento@prueba.test' });   // admin de arranque SIN perfil
    const l = await getDoc(doc(d, ...RUTA_LECTORES));
    listaAntes = l.exists() ? l.data() : null;
    // El lector, el visitante y el inactivo en la lista (los dos últimos no deben leer igual).
    await setDoc(doc(d, ...RUTA_LECTORES), { lectores: ['cu_lector', 'cu_visit', 'cu_inact'], actualizadoPor: { uid: 'cu_admin', nombre: nombreDe('cu_admin') }, actualizadoEn: Timestamp.now() });
    // Un correo y dos avisos como los escribe el servidor.
    await setDoc(doc(d, 'odt_afinia_correos', ID(1) + '_10'), {
      corteId: ID(1), umbral: 10, responsable: 'RESPONSABLE FICTICIO DE CUMPLIMIENTO', para: ['destino.uno@prueba.test'], cc: [], asunto: 'SGM · prueba',
      texto: 'texto de prueba', html: '<p>html de prueba</p>', nros: ['94000001'], estado: 'enviado', error: '', creadoEn: Timestamp.now(),
      encoladoEnMs: 1, enviadoEn: Timestamp.now(), intentos: 1, prestamo: 'prestamo0000000000000001', prestamoHastaMs: 1, reemplazadoPor: ''
    });
    // El estado del script de Google, como lo escribe la función avisosCorreoRemitente (99 §236).
    await setDoc(doc(d, ...RUTA_SCRIPT), { audienciaVista: AUD, vistaEn: Timestamp.now(), ultimaConexionEn: Timestamp.now(), ultimoResultado: 'Pidió permiso: este script todavía no está aprobado en SGM.' });
    await setDoc(doc(d, 'odt_afinia_avisos', '94000001_10'), { nro: '94000001', umbral: 10, estado: 'enviado', corteId: ID(1), correoId: ID(1) + '_10', dias: 11, en: Timestamp.now() });
    await setDoc(doc(d, 'odt_afinia_avisos', '94000001_15'), { nro: '94000001', umbral: 15, estado: 'omitido', corteId: ID(1), correoId: '', dias: 11, en: Timestamp.now() });
  });
});
after(async () => {
  if (!testEnv) return;
  await sembrar(async (d) => {
    if (listaAntes) await setDoc(doc(d, ...RUTA_LECTORES), listaAntes); else await deleteDoc(doc(d, ...RUTA_LECTORES));
  });
  await testEnv.cleanup();
});

// ═════════════════════════════════════════════════════════════════════════════
describe('corte de la VERSIÓN 3: la primera ODT con sus 13 claves (con la fecha de ejecución y el equipo)', () => {
  test('entra con `ejecucion` en fecha o vacía; se niega sin ella, con una clave de más o con otra forma', async () => {
    await assertSucceeds(guardar(ID(10), 5));
    await assertSucceeds(guardar(ID(11), 5, { primera: (o) => ({ ...o, ejecucion: '' }) }));
    await assertFails(guardar(ID(12), 5, { primera: (o) => { delete o.ejecucion; delete o.equipo; return o; } }));   // 11 claves: la forma de la versión 2
    await assertFails(guardar(ID(13), 5, { primera: (o) => ({ ...o, extra: '' }) }));                           // 14 claves
    await assertFails(guardar(ID(22), 5, { primera: (o) => { delete o.equipo; return o; } }));                  // 12 claves: sin el equipo
    await assertFails(guardar(ID(23), 5, { primera: (o) => ({ ...o, equipo: 'E'.repeat(201) }) }));            // equipo de más de 200
    await assertFails(guardar(ID(24), 5, { primera: (o) => ({ ...o, equipo: 7 }) }));                           // equipo que no es texto
    await assertFails(guardar(ID(25), 5, { primera: (o) => ({ ...o, equipo: null }) }));
    await assertSucceeds(guardar(ID(26), 5, { primera: (o) => ({ ...o, equipo: '' }) }));                      // control: vacío
    await assertSucceeds(guardar(ID(27), 5, { primera: (o) => ({ ...o, equipo: 'E'.repeat(200) }) }));         // control: 200
    await assertFails(guardar(ID(14), 5, { primera: (o) => { const x = { ...o, ejecución: o.ejecucion }; delete x.ejecucion; return x; } }));
    for (const [k, v] of [[15, '26/11/2026'], [16, '2026-13-01'], [17, '2026-11-26T00:00:00'], [18, 20261126], [19, null], [20, '2026-1-05'], [21, ' 2026-11-26']]) {
      await assertFails(guardar(ID(k), 5, { primera: (o) => ({ ...o, ejecucion: v }) }), 'ejecucion ' + v);
    }
    assert.equal((await (async () => { let v; await sembrar(async (d) => { v = (await getDoc(doc(d, 'odt_afinia_cortes', ID(10), 'partes', '0'))).data(); }); return v; })()).odts[0].ejecucion, odtDe(0).ejecucion);
  });
  test('guardado como la página (repositorio): versión 3 y cada ODT con su `ejecucion` y su `equipo`', async () => {
    const repo = crearRepositorioCortes({ sdk: SDK, db: plano('cu_admin'), sesion: sesionDe('cu_admin', true) });
    const analisis = { responsable: 'RESPONSABLE FICTICIO DE CUMPLIMIENTO', odts: odtsDe(410), filasResponsable: 412, ...agregar(odtsDe(410)) };
    const g = await repo.guardar({ archivo: { nombre: 'INFORME_ODT_20261102000000_prueba.csv', bytes: 100, sha256: 'ce'.repeat(32) }, lectura: { filas: 500, odtsArchivo: 450 }, analisis });
    const l = await repo.leer(g.id);
    assert.equal(l.corte.version, 3);
    assert.equal(l.completo, true);
    assert.ok(l.odts.every((o) => Object.keys(o).length === 13 && /^\d{4}-\d{2}-\d{2}$/.test(o.ejecucion) && /^EQUIPO FICTICIO \d$/.test(o.equipo)));
  });
});

describe('odt_afinia_config/cumplimiento — solo administradores con perfil, forma exacta', () => {
  test('el admin la crea, la lee y la cambia (también con 5 destinatarios y 5 copias); nadie la borra ni la lista', async () => {
    await assertSucceeds(setDoc(doc(plano('cu_admin'), ...RUTA_CONFIG), CONFIG));
    await assertSucceeds(getDoc(doc(plano('cu_admin'), ...RUTA_CONFIG)));
    await assertSucceeds(setDoc(doc(plano('cu_admin'), ...RUTA_CONFIG), LLENA));
    await assertSucceeds(updateDoc(doc(plano('cu_admin'), ...RUTA_CONFIG), { activo: true }));
    await assertFails(deleteDoc(doc(plano('cu_admin'), ...RUTA_CONFIG)));
    await assertFails(getDocs(query(collection(plano('cu_admin'), 'odt_afinia_config'), limit(5))));
  });
  test('los demás (lector de Indicadores, técnico, visitante, inactivo, arranque sin perfil, anónimo) ni la leen ni la escriben', async () => {
    await sembrar((d) => setDoc(doc(d, ...RUTA_CONFIG), CONFIG));
    for (const u of ['cu_lector', 'cu_tecnico', 'cu_visit', 'cu_inact', 'cu_arranque']) {
      await assertFails(getDoc(doc(plano(u), ...RUTA_CONFIG)), u + ' leer');
      await assertFails(setDoc(doc(plano(u), ...RUTA_CONFIG), CONFIG), u + ' escribir');
      await assertFails(updateDoc(doc(plano(u), ...RUTA_CONFIG), { activo: false }), u + ' cambiar');
    }
    await assertFails(getDoc(doc(anon(), ...RUTA_CONFIG)));
    await assertFails(setDoc(doc(anon(), ...RUTA_CONFIG), CONFIG));
  });
  test('SABOTAJE: claves de más o de menos, tipos, correos, nombres, topes y responsable', async () => {
    const mal = (cambio) => setDoc(doc(plano('cu_admin'), ...RUTA_CONFIG), cambio(JSON.parse(JSON.stringify(LLENA))));
    const casos = [
      ['clave de más', (c) => ({ ...c, extra: 1 })],
      ['sin cc', (c) => { delete c.cc; return c; }],
      ['activo como texto', (c) => ({ ...c, activo: 'si' })],
      ['remitente sin dominio', (c) => ({ ...c, remitente: 'remitente@prueba' })],
      ['remitente con espacio', (c) => ({ ...c, remitente: 'remi tente@prueba.test' })],
      ['sin destinatarios', (c) => ({ ...c, para: [] })],
      ['6 destinatarios', (c) => ({ ...c, para: [...c.para, { correo: 'sexto@prueba.test', nombre: 'Sexto' }] })],
      ['destinatario sin nombre', (c) => ({ ...c, para: [{ correo: 'uno@prueba.test' }] })],
      ['destinatario con una clave de más', (c) => { c.para[2].cargo = 'x'; return c; }],
      ['el QUINTO destinatario con correo malo', (c) => { c.para[4].correo = 'no-es-correo'; return c; }],
      ['nombre vacío', (c) => { c.para[0].nombre = ''; return c; }],
      ['nombre de 81', (c) => { c.para[1].nombre = 'N'.repeat(81); return c; }],
      ['nombre con espacio en la punta', (c) => { c.para[3].nombre = ' Persona'; return c; }],
      ['destinatario que no es mapa', (c) => { c.para[0] = 'uno@prueba.test'; return c; }],
      ['6 copias', (c) => ({ ...c, cc: [...c.cc, 'sexta@prueba.test'] })],
      ['la QUINTA copia mala', (c) => { c.cc[4] = 'copia mala'; return c; }],
      ['cc que no es lista', (c) => ({ ...c, cc: 'copia@prueba.test' })],
      ['responsable corto', (c) => ({ ...c, responsable: 'AB' })],
      ['responsable con espacio en la punta', (c) => ({ ...c, responsable: ' RESPONSABLE FICTICIO' })],
      ['responsable de 121', (c) => ({ ...c, responsable: 'R'.repeat(121) })],
      // 99 §236: el script de Google aprobado.
      ['sin audienciaScript (la forma de 5 claves)', (c) => { delete c.audienciaScript; return c; }],
      ['audienciaScript de 201', (c) => ({ ...c, audienciaScript: 'A'.repeat(201) })],
      ['audienciaScript con espacio', (c) => ({ ...c, audienciaScript: 'con espacio' })],
      ['audienciaScript con comillas', (c) => ({ ...c, audienciaScript: 'a"b' })],
      ['audienciaScript que no es texto', (c) => ({ ...c, audienciaScript: 7 })],
      ['audienciaScript nulo', (c) => ({ ...c, audienciaScript: null })]
    ];
    for (const [que, cambio] of casos) await assertFails(mal(cambio), que);
    // Controles: los mismos topes, bien, pasan.
    await assertSucceeds(mal((c) => { c.para[1].nombre = 'N'.repeat(80); return c; }));
    await assertSucceeds(mal((c) => ({ ...c, cc: [], para: [c.para[0]], responsable: 'ABC' })));
    await assertSucceeds(mal((c) => ({ ...c, responsable: 'R'.repeat(120) })));
    await assertSucceeds(mal((c) => ({ ...c, audienciaScript: AUD })));
    await assertSucceeds(mal((c) => ({ ...c, audienciaScript: 'A'.repeat(200) })));
    await assertSucceeds(mal((c) => ({ ...c, audienciaScript: '' })));
  });
  test('el repositorio de la página: el admin guarda y vuelve a leer; un técnico (aunque la página creyera que es admin) no', async () => {
    const repo = crearRepositorioCumplimiento({ sdk: SDK, db: plano('cu_admin'), sesion: sesionDe('cu_admin', true) });
    const g = await repo.guardarConfig({ ...CONFIG, para: [{ correo: '  destino.dos@prueba.test ', nombre: ' Persona  Dos ' }, { correo: '', nombre: '' }] });
    assert.deepEqual(g.para, [{ correo: 'destino.dos@prueba.test', nombre: 'Persona Dos' }]);
    assert.deepEqual(await repo.leerConfig(), g);
    const tec = crearRepositorioCumplimiento({ sdk: SDK, db: plano('cu_tecnico'), sesion: sesionDe('cu_tecnico', true) });
    await assert.rejects(tec.guardarConfig(CONFIG), (e) => e.codigo === 'sin_permiso');
    await assert.rejects(tec.leerConfig(), (e) => e.codigo === 'sin_permiso');
  });
});

describe('odt_afinia_config/cumplimiento_script (99 §236) — lo escribe solo el servidor; lo lee solo el admin', () => {
  test('el admin lo lee; el lector de Indicadores, técnico, visitante, inactivo, arranque sin perfil y anónimo, no', async () => {
    await assertSucceeds(getDoc(doc(plano('cu_admin'), ...RUTA_SCRIPT)));
    for (const u of ['cu_lector', 'cu_tecnico', 'cu_visit', 'cu_inact', 'cu_arranque']) await assertFails(getDoc(doc(plano(u), ...RUTA_SCRIPT)), u);
    await assertFails(getDoc(doc(anon(), ...RUTA_SCRIPT)));
  });
  test('SABOTAJE: nadie desde la página lo crea, lo cambia (p. ej. para «aprobarse» un script), lo borra ni lo lista (ni el admin)', async () => {
    for (const u of ['cu_admin', 'cu_lector', 'cu_tecnico']) {
      const d = plano(u);
      await assertFails(setDoc(doc(d, ...RUTA_SCRIPT), { audienciaVista: 'otro', ultimoResultado: 'x' }), u);
      await assertFails(updateDoc(doc(d, ...RUTA_SCRIPT), { audienciaVista: 'otro' }), u);
      await assertFails(deleteDoc(doc(d, ...RUTA_SCRIPT)), u);
    }
    await assertFails(getDocs(query(collection(plano('cu_admin'), 'odt_afinia_config'), limit(5))));
  });
  test('el repositorio de la página: el admin lee el estado y aprueba el script (la configuración entera, con audienciaScript); el técnico no', async () => {
    await sembrar((d) => setDoc(doc(d, ...RUTA_CONFIG), CONFIG));
    const rs = crearRepositorioScript({ sdk: SDK, db: plano('cu_admin'), sesion: sesionDe('cu_admin', true) });
    const e = await rs.leerEstado();
    assert.equal(e.audienciaVista, AUD);
    assert.ok(Number.isFinite(e.ultimaConexionEnMs) && Number.isFinite(e.vistaEnMs));
    const g = await rs.aprobar(e.audienciaVista);
    assert.equal(g.audienciaScript, AUD);
    let guardada; await sembrar(async (d) => { guardada = (await getDoc(doc(d, ...RUTA_CONFIG))).data(); });
    assert.equal(guardada.audienciaScript, AUD);
    assert.equal(Object.keys(guardada).length, 6);
    // Guardar el formulario (sin audienciaScript) conserva el script aprobado.
    const repo = crearRepositorioCumplimiento({ sdk: SDK, db: plano('cu_admin'), sesion: sesionDe('cu_admin', true) });
    const { audienciaScript: _fuera, ...form } = g;
    assert.equal((await repo.guardarConfig({ ...form, activo: false })).audienciaScript, AUD);
    const tec = crearRepositorioScript({ sdk: SDK, db: plano('cu_tecnico'), sesion: sesionDe('cu_tecnico', true) });
    await assert.rejects(tec.leerEstado(), (x) => x.codigo === 'sin_permiso');
    await assert.rejects(tec.aprobar(AUD), (x) => x.codigo === 'sin_permiso');
  });
});

describe('odt_afinia_correos y odt_afinia_avisos — solo el servidor escribe; leen admin y lectores', () => {
  const lecturas = (db) => [
    () => getDoc(doc(db, 'odt_afinia_correos', ID(1) + '_10')),
    () => getDocs(query(collection(db, 'odt_afinia_correos'), orderBy('creadoEn', 'desc'), limit(50))),
    () => getDoc(doc(db, 'odt_afinia_avisos', '94000001_10')),
    () => getDocs(query(collection(db, 'odt_afinia_avisos'), limit(50)))
  ];
  test('el admin y el lector de Indicadores leen; técnico fuera de la lista, visitante e inactivo (aunque estén), arranque y anónimo, no', async () => {
    for (const u of ['cu_admin', 'cu_lector']) for (const f of lecturas(plano(u))) await assertSucceeds(f());
    for (const u of ['cu_tecnico', 'cu_visit', 'cu_inact', 'cu_arranque']) for (const f of lecturas(plano(u))) await assertFails(f(), u);
    for (const f of lecturas(anon())) await assertFails(f());
  });
  test('listas solo con limit ≤ 50', async () => {
    for (const col of ['odt_afinia_correos', 'odt_afinia_avisos']) {
      await assertFails(getDocs(query(collection(plano('cu_admin'), col), limit(51))));
      await assertFails(getDocs(collection(plano('cu_admin'), col)));
      await assertSucceeds(getDocs(query(collection(plano('cu_lector'), col), limit(50))));
    }
  });
  test('SABOTAJE: nadie desde la página crea, cambia ni borra un correo o un aviso (ni el admin)', async () => {
    for (const u of ['cu_admin', 'cu_lector', 'cu_tecnico']) {
      const d = plano(u);
      await assertFails(setDoc(doc(d, 'odt_afinia_correos', ID(2) + '_20'), { corteId: ID(2), umbral: 20, estado: 'enviado' }), u);
      await assertFails(updateDoc(doc(d, 'odt_afinia_correos', ID(1) + '_10'), { estado: 'error' }), u);
      await assertFails(deleteDoc(doc(d, 'odt_afinia_correos', ID(1) + '_10')), u);
      // Marcar a mano un aviso como «enviado» (para que el servidor no lo mande) o borrarlo (para que lo repita).
      await assertFails(setDoc(doc(d, 'odt_afinia_avisos', '94000002_20'), { nro: '94000002', umbral: 20, estado: 'enviado' }), u);
      await assertFails(updateDoc(doc(d, 'odt_afinia_avisos', '94000001_15'), { estado: 'reservado' }), u);
      await assertFails(deleteDoc(doc(d, 'odt_afinia_avisos', '94000001_10')), u);
    }
  });
  test('el repositorio de la página: el lector y el admin listan el historial de correos; el técnico no', async () => {
    const r = await crearRepositorioCumplimiento({ sdk: SDK, db: plano('cu_lector'), sesion: sesionDe('cu_lector', false) }).listarCorreos();
    assert.ok(r.some((c) => c.id === ID(1) + '_10' && c.estado === 'enviado' && Number.isFinite(c.creadoEnMs)));
    assert.ok((await crearRepositorioCumplimiento({ sdk: SDK, db: plano('cu_admin'), sesion: sesionDe('cu_admin', true) }).listarCorreos()).length >= 1);
    await assert.rejects(crearRepositorioCumplimiento({ sdk: SDK, db: plano('cu_tecnico'), sesion: sesionDe('cu_tecnico', false) }).listarCorreos(), (e) => e.codigo === 'sin_permiso');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 99 §236 (pedido del 2026-11-26: «cuándo y cuántas veces notificas»): el resumen de notificaciones y las consultas del
// bloque «Notificaciones a …» y de los avisos de cada ODT.
// ═════════════════════════════════════════════════════════════════════════════
const RUTA_RESUMEN = ['odt_afinia_config', 'cumplimiento_resumen'];
const RESUMEN = { enviados: 3, porUmbral: { 10: 1, 15: 1, 20: 1 }, odtAvisadas: 2, primerEnvioEn: Timestamp.now(), ultimoEnvioEn: Timestamp.now(), actualizadoEn: Timestamp.now(), porRecalcular: false };
describe('odt_afinia_config/cumplimiento_resumen (99 §236) — lo escribe solo el servidor; leen admin y lectores', () => {
  test('el admin y el lector de Indicadores lo leen; técnico fuera de la lista, visitante, inactivo, arranque sin perfil y anónimo, no', async () => {
    await sembrar((d) => setDoc(doc(d, ...RUTA_RESUMEN), RESUMEN));
    for (const u of ['cu_admin', 'cu_lector']) await assertSucceeds(getDoc(doc(plano(u), ...RUTA_RESUMEN)));
    for (const u of ['cu_tecnico', 'cu_visit', 'cu_inact', 'cu_arranque']) await assertFails(getDoc(doc(plano(u), ...RUTA_RESUMEN)), u);
    await assertFails(getDoc(doc(anon(), ...RUTA_RESUMEN)));
  });
  test('SABOTAJE: nadie desde la página lo crea, lo cambia (p. ej. para inflar las cuentas), lo borra ni lo lista (ni el admin)', async () => {
    for (const u of ['cu_admin', 'cu_lector', 'cu_tecnico']) {
      const d = plano(u);
      await assertFails(setDoc(doc(d, ...RUTA_RESUMEN), { ...RESUMEN, enviados: 99 }), u);
      await assertFails(updateDoc(doc(d, ...RUTA_RESUMEN), { enviados: 0 }), u);
      await assertFails(deleteDoc(doc(d, ...RUTA_RESUMEN)), u);
    }
    await assertFails(getDocs(query(collection(plano('cu_lector'), 'odt_afinia_config'), limit(5))));
  });
});

describe('las consultas del bloque de notificaciones y de los avisos de cada ODT (99 §236)', () => {
  const nros = Array.from({ length: 10 }, (_, i) => String(94000001 + i));
  test('el lector: avisos por N.º con «in» de a 10 (limit 50) y con «==»; la tabla de a 20 con su cursor; conteos de limit 50', async () => {
    await sembrar(async (d) => {
      await setDoc(doc(d, 'odt_afinia_correos', ID(3) + '_20'), { corteId: ID(3), umbral: 20, estado: 'error', error: 'prueba', reemplazadoPor: '', nros: ['94000002'], creadoEn: Timestamp.now() });
      await setDoc(doc(d, 'odt_afinia_correos', ID(4) + '_15'), { corteId: ID(4), umbral: 15, estado: 'pendiente', reemplazadoPor: '', nros: ['94000003'], creadoEn: Timestamp.now() });
    });
    const d = plano('cu_lector');
    const avisos = collection(d, 'odt_afinia_avisos');
    const correos = collection(d, 'odt_afinia_correos');
    await assertSucceeds(getDocs(query(avisos, where('nro', 'in', nros), limit(50))));
    await assertSucceeds(getDocs(query(avisos, where('nro', '==', '94000001'), limit(50))));
    await assertFails(getDocs(query(avisos, where('nro', 'in', nros), limit(51))), 'limit 51');
    await assertFails(getDocs(query(avisos, where('nro', 'in', nros))), 'sin limit');
    const p1 = await assertSucceeds(getDocs(query(correos, orderBy('creadoEn', 'desc'), limit(21))));
    await assertSucceeds(getDocs(query(correos, orderBy('creadoEn', 'desc'), startAfter(p1.docs[0]), limit(21))));
    await assertSucceeds(getCountFromServer(query(correos, where('estado', 'in', ['pendiente', 'en_envio']), limit(50))));
    await assertSucceeds(getCountFromServer(query(correos, where('estado', '==', 'error'), where('reemplazadoPor', '==', ''), limit(50))));
    await assertFails(getCountFromServer(query(correos, where('estado', 'in', ['pendiente', 'en_envio']))), 'un conteo sin limit');
    for (const u of ['cu_tecnico', 'cu_visit']) {
      await assertFails(getDocs(query(collection(plano(u), 'odt_afinia_avisos'), where('nro', 'in', nros), limit(50))), u);
      await assertFails(getCountFromServer(query(collection(plano(u), 'odt_afinia_correos'), where('estado', 'in', ['pendiente']), limit(50))), u);
    }
  });
  test('el REPOSITORIO de la página (data/odt_afinia_cumplimiento_notificaciones.js): el lector lee todo; el técnico, nada', async () => {
    await sembrar((d) => setDoc(doc(d, ...RUTA_RESUMEN), RESUMEN));
    const repo = crearRepositorioNotificaciones({ sdk: SDK, db: plano('cu_lector'), sesion: sesionDe('cu_lector', false) });
    const r = await repo.leerResumen();
    assert.deepEqual([r.enviados, r.odtAvisadas, r.porUmbral], [3, 2, { 10: 1, 15: 1, 20: 1 }]);
    assert.ok(Number.isFinite(r.ultimoEnvioEnMs));
    const p = await repo.listar();
    assert.ok(p.items.some((c) => c.id === ID(1) + '_10' && c.estado === 'enviado' && Number.isFinite(c.enviadoEnMs)));
    const n = await repo.contarPendientes();
    assert.ok(n.enCola >= 1 && n.conError >= 1 && n.tope === 50);
    const m = await repo.avisosDeOdts(Array.from({ length: 25 }, (_, i) => String(94000001 + i)));
    assert.deepEqual(m.get('94000001').map((a) => a.estado).sort(), ['enviado', 'omitido']);
    assert.ok(Number.isFinite(m.get('94000001')[0].enMs));
    assert.deepEqual((await repo.avisosDeOdt('94000001')).map((a) => a.umbral).sort(), [10, 15]);
    const tec = crearRepositorioNotificaciones({ sdk: SDK, db: plano('cu_tecnico'), sesion: sesionDe('cu_tecnico', false) });
    for (const f of [() => tec.leerResumen(), () => tec.listar(), () => tec.contarPendientes(), () => tec.avisosDeOdt('94000001')]) {
      await assert.rejects(f(), (e) => e.codigo === 'sin_permiso');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRESUPUESTO de la configuración: la más cara (5 destinatarios y 5 copias) debe entrar dejando ≥ 30 % libre del tope de
// 1000 expresiones. Relleno calibrado como en odt_afinia_cortes.rules.test.js (presupuesto de los cortes).
// ═════════════════════════════════════════════════════════════════════════════
describe('presupuesto — la configuración más grande entra dejando ≥ 30 % del tope de 1000 expresiones', () => {
  const U = '1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1 && 1 == 1';
  const FUNCIONES = '    function cuPadU() { return ' + U + '; }\n    function cuPadV() { return ' + Array(10).fill('cuPadU()').join(' && ') + '; }\n';
  const relleno = (n) => [...Array(Math.floor(n / 100)).fill('cuPadV()'), ...Array(Math.floor((n % 100) / 10)).fill('cuPadU()'), ...Array(n % 10).fill('1 == 1')].join(' && ') || 'true';
  let nProyecto = 0;
  async function escribir(reglas, { crear } = {}) {
    const env = await initializeTestEnvironment({ projectId: 'demo-sgm-cumplimiento-' + (++nProyecto), firestore: { rules: reglas, host: '127.0.0.1', port: 8080 } });
    try {
      await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'usuarios', 'cu_admin'), { email: P.cu_admin.email, rol: 'admin', activo: true, nombre: P.cu_admin.nombre }));
      const d = env.authenticatedContext('cu_admin').firestore();
      if (crear) { await setDoc(doc(d, 'cal', 'x'), { a: 1 }); return 'entra'; }
      await setDoc(doc(d, ...RUTA_CONFIG), LLENA);
      return 'entra';
    } catch (e) {
      return /1000 expressions/.test(String(e && e.message)) ? 'tope' : 'niega: ' + String(e && e.message).slice(0, 200);
    } finally { await env.cleanup(); }
  }
  const vacia = (n) => "rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\n" + FUNCIONES
    + '    function cuPad() { return ' + relleno(n) + '; }\n    match /cal/{id} { allow create: if cuPad(); }\n} }';
  function conRelleno(n) {
    const fin = "&& d.responsable is string && d.responsable.matches('^\\\\S.{1,118}\\\\S$');";
    const ancla = '    function odtCumCorreo(v)';
    for (const a of [fin, ancla]) assert.equal(REGLAS.split(a).length, 2, 'el ancla «' + a + '» cambió: ajuste esta prueba');
    // Con función: en un texto de reemplazo, «$'» (que trae el patrón del responsable) significaría «lo que sigue».
    return REGLAS.replace(fin, () => fin.slice(0, -1) + ' && ' + relleno(n) + ';').replace(ancla, () => FUNCIONES + ancla);
  }
  test('calibrado: con ≥ 30 % de relleno, la configuración de 5 + 5 entra; con el relleno entero, no', async () => {
    let lo = 50; let hi = 400;
    assert.equal(await escribir(vacia(lo), { crear: true }), 'entra');
    assert.equal(await escribir(vacia(hi), { crear: true }), 'tope');
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (await escribir(vacia(m), { crear: true }) === 'entra') lo = m; else hi = m; }
    const cap = lo;
    assert.equal(await escribir(conRelleno(0)), 'entra');
    assert.equal(await escribir(conRelleno(Math.ceil(cap * 0.3))), 'entra', 'la regla ya no deja 30 % libre (caben ' + cap + ' términos solos)');
    assert.equal(await escribir(conRelleno(cap)), 'tope', 'control: el relleno entero pasa el tope');
  });
});
