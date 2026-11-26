// Firma de ODT Afinia · INDICADORES · LECTORES y CONTADOR de «Por subsanar» (pedido del 2026-11-24), sin navegador:
//   · dominio de la lista de lectores (odt_afinia_config/indicadores): uids válidos, tope de 20, sin repetir, la forma
//     exacta que se guarda, las casillas (por nombre; un lector que ya no es AZT habilitado sigue, marcado, con su
//     nota), qué cambia, las frases de la confirmación y de «Hoy…», la introducción del lector (de quién es el corte,
//     nunca «usted es RESPONSABLE O.D.T.») y el último corte de cualquier responsable;
//   · el contador de «Por subsanar» con palabras: «N ODT · M puntos» (AZT) y «N ODT · M por verificar» (admin);
//   · datos: el repositorio de la lista (leer, soyLector, guardar solo admin) y el de cortes para un LECTOR (lee; no
//     guarda ni busca por huella; su «Estado en SGM» sale solo de lo que le asignaron, con las consultas de la bandeja y
//     de «Por subsanar», y vuelve `parcial`);
//   · pantalla: el lector abre el último corte de cualquiera, sin «Cargar un corte nuevo», y por #indicadores-cargar se
//     le lleva a #indicadores con un aviso; su lista de ODT dice «Sin consultar» en lo que no le asignaron, con su nota;
//     el admin ve «Quién más puede ver los indicadores» (casillas, «Guardar» en dos pasos); app.js le muestra la pestaña
//     al lector (antes de «Por subsanar») y a nadie más;
//   · lo corregido en la revisión (al final): textos del lector sin «cargue…», la pestaña solo a quien la regla deja
//     leer (activo y no visitante), el desvío con location.replace, el aviso sin red, las casillas repintadas al
//     guardar, las dos consultas del lector reutilizadas un minuto y el contador con tope («12+ ODT»).
// Con los dobles de DOM y de Firestore del módulo. Datos INVENTADOS.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearDomFalso, crearFirestoreFalso, TS } from './odt_afinia_ui_dobles.js';
import { RESP_A, RESP_B, archivoBase, conConsultas } from './odt_afinia_indicadores_fixture.js';

// Lección §234.6: la preparación del DOM falso (hooks de raíz) va ANTES de todo describe y de todo await de nivel superior.
let guardado; let dom; let proto; const originales = {};
before(() => {
  guardado = globalThis.document;
  dom = crearDomFalso();
  dom.createElementNS = (_ns, tag) => dom.createElement(tag);
  dom.activeElement = dom.body;
  proto = Object.getPrototypeOf(dom.createElement('div'));
  for (const k of ['appendChild', 'focus', 'scrollIntoView', 'getBoundingClientRect']) originales[k] = proto[k];
  proto.appendChild = function (c) {
    if (!c || (c.nodeType !== 1 && c.nodeType !== 3)) throw new TypeError('appendChild: no es un nodo (' + Object.prototype.toString.call(c) + ')');
    return originales.appendChild.call(this, c);
  };
  proto.focus = function () { dom.activeElement = this; };
  proto.scrollIntoView = function () { this.desplazado = (this.desplazado || 0) + 1; };
  proto.getBoundingClientRect = function () { return { top: 5000 }; };
  globalThis.document = dom;
});
after(() => {
  if (proto) for (const [k, v] of Object.entries(originales)) { if (v === undefined) delete proto[k]; else proto[k] = v; }
  if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado;
});

const L = await import('../assets/js/domain/odt_afinia_ind_lectores.js');
const { contadorPorSubsanar } = await import('../assets/js/domain/odt_afinia_obs_contador.js');
const { leerCsv, analizarResponsable, SGM_SIN_CONSULTAR } = await import('../assets/js/domain/odt_afinia_indicadores.js');
const { crearRepositorioLectoresInd } = await import('../assets/js/data/odt_afinia_ind_lectores.js');
const { crearRepositorioCortes, MSG_SIN_ACCESO_CORTES } = await import('../assets/js/data/odt_afinia_cortes.js');
const { montarIndicadores, SOLO_ADMIN, INTRO } = await import('../assets/js/ui/odt-afinia/indicadores.js');
const { montarSeccionLectores, soyLectorIndicadores, MSG_SIN_CANDIDATOS_FN } = await import('../assets/js/ui/odt-afinia/indicadores-lectores.js');
const { NOTA_SGM_PARCIAL } = await import('../assets/js/ui/odt-afinia/indicadores-vista.js');
const { montarOdtAfinia, MSG_INDICADORES_SIN_ACCESO } = await import('../assets/js/ui/odt-afinia/app.js');

const ADMIN = { uid: 'uid-admin-prueba', nombre: 'Administrador De Prueba', correoPerfil: 'admin@prueba.test', rol: 'admin', esAdmin: true, legacy: false };
const LECTOR = { uid: 'uid-lector-prueba', nombre: 'Lector Ficticio', correoPerfil: 'lector@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const TECNICO = { uid: 'uid-tecnico-prueba', nombre: 'Tecnico De Prueba', correoPerfil: 'tecnico@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const AZTS = [{ uid: 'uid-azt-beta', nombre: 'Beta Persona Ficticia' }, { uid: LECTOR.uid, nombre: 'Lector Ficticio' }, { uid: 'uid-azt-alfa', nombre: 'Alfa Persona Ficticia' }];
const caja = () => document.createElement('div');
const botones = (el) => el.todos().filter((x) => x.tagName === 'BUTTON');
const boton = (el, texto) => botones(el).find((b) => b.textContent === texto);
const visible = (el) => { for (let n = el; n; n = n.parentNode) if (n.hidden) return false; return true; };
async function hasta(cond, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 5));
  }
}
function sinRestos(el) {
  const restos = [];
  (function recorrer(n) {
    if (n.childNodes && n.childNodes.length) { n.childNodes.forEach(recorrer); return; }
    if (['null', 'undefined', 'false', 'NaN', '[object Object]'].includes(String(n.textContent).trim())) restos.push(n.textContent);
  })(el);
  assert.deepEqual(restos, [], 'quedó un resto pintado como texto: ' + restos.join(', '));
}
const nuevoFs = () => conConsultas(crearFirestoreFalso());
const repoAdmin = (fs) => crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => ADMIN, tiempoLoteMs: 30 });
const repoLector = (fs, s = LECTOR) => crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => s, esLector: true, tiempoLoteMs: 30 });
const repoLista = (fs, s = ADMIN) => crearRepositorioLectoresInd({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoMs: 30 });
/** Guarda un corte de `resp` desde el archivo de prueba (como la pantalla de carga), con su hora de datos en el nombre. */
async function guardarCorte(fs, resp, sello, sha) {
  const texto = archivoBase();
  const l = leerCsv(texto);
  return repoAdmin(fs).guardar({ archivo: { nombre: 'INFORME_ODT_' + sello + '_prueba.csv', bytes: texto.length, sha256: sha }, lectura: l, analisis: analizarResponsable(l, resp) });
}
function montar(p) {
  const c = caja(); const idas = [];
  return montarIndicadores(c, { alIr: (ancla, m) => idas.push([ancla, m || '']), ...p }).then((r) => ({ c, r, idas }));
}

// ═════════════════════════════════════════════════════════════════════════════
describe('dominio: la lista de lectores', () => {
  test('uids válidos (como la regla), sin repetir; ¿está en la lista?', () => {
    assert.deepEqual(L.normalizarLectores(['a', 'a', '', 7, null, 'b_c-1', 'x y', 'b_c-1']), ['a', 'b_c-1']);
    assert.deepEqual(L.normalizarLectores('a'), []);
    assert.equal(L.esLectorIndicadores({ lectores: ['u1', 'u2'] }, 'u2'), true);
    assert.equal(L.esLectorIndicadores({ lectores: ['u1'] }, 'u2'), false);
    assert.equal(L.esLectorIndicadores(null, 'u1'), false);
    assert.equal(L.esLectorIndicadores({ lectores: ['u1'] }, ''), false);
    assert.deepEqual(L.CONFIG_INDICADORES, { col: 'odt_afinia_config', doc: 'indicadores' });
    assert.equal(L.TOPE_LECTORES, 20);
  });
  test('lo que se guarda: 3 campos exactos; hasta 20, sin repetidos ni inválidos', () => {
    const d = L.docLectores({ uids: ['u1', 'u2'], por: { uid: 'uadmin', nombre: 'Admin' }, ts: 'TS' });
    assert.deepEqual(d, { lectores: ['u1', 'u2'], actualizadoPor: { uid: 'uadmin', nombre: 'Admin' }, actualizadoEn: 'TS' });
    assert.deepEqual(L.docLectores({ uids: [], por: { uid: 'uadmin', nombre: 'Admin' }, ts: 'TS' }).lectores, [], 'vacía: solo los administradores');
    const veinte = Array.from({ length: 20 }, (_, i) => 'u' + i);
    assert.equal(L.errorLectores(veinte), null);
    assert.match(L.errorLectores([...veinte, 'u20']), /hasta 20/);
    assert.match(L.errorLectores(['u1', 'u1']), /repetida/);
    assert.match(L.errorLectores(['u1', '']), /identificador/);
    assert.match(L.errorLectores('u1'), /no es válida/);
    assert.throws(() => L.docLectores({ uids: ['u1', 'u1'], por: { uid: 'uadmin' }, ts: 'TS' }), /repetida/);
    assert.throws(() => L.docLectores({ uids: ['u1'], por: null, ts: 'TS' }), /sesión/);
  });
  test('las casillas: los AZT elegibles por nombre (marcados los que ya están) y, al final, el lector que ya no es elegible', () => {
    const o = L.opcionesLectores({ azt: AZTS, lectores: [LECTOR.uid, 'uid-ya-no-esta'], nombres: { 'uid-ya-no-esta': 'Persona Que Salio' } });
    assert.deepEqual(o.map((x) => [x.nombre, x.marcado, !!x.nota]), [
      ['Alfa Persona Ficticia', false, false], ['Beta Persona Ficticia', false, false], ['Lector Ficticio', true, false], ['Persona Que Salio', true, true]]);
    assert.equal(o[3].nota, L.NOTA_FUERA_DE_LISTA);
    assert.equal(L.opcionesLectores({ lectores: ['uid-x'] })[0].nombre, 'Persona sin nombre conocido');
    assert.deepEqual(L.opcionesLectores({}), []);
  });
  test('qué cambia y las frases (singular, plural y «solo los administradores»)', () => {
    const c = L.cambiosLectores(['a', 'b'], ['b', 'c']);
    assert.deepEqual(c, { agregados: ['c'], quitados: ['a'], igual: false });
    assert.equal(L.cambiosLectores(['a'], ['a']).igual, true);
    const nombre = (u) => ({ a: 'Ana Ficticia', b: 'Beto Ficticio', c: 'Ciro Ficticio' }[u]);
    assert.equal(L.textoConfirmacion(c, nombre, 2), 'Podrán ver los indicadores (solo lectura): Ciro Ficticio. Dejarán de verlos: Ana Ficticia. Después de guardar, además de los administradores, los verán 2 personas.');
    assert.equal(L.textoConfirmacion({ agregados: ['a'], quitados: [] }, nombre, 1), 'Podrán ver los indicadores (solo lectura): Ana Ficticia. Después de guardar, además de los administradores, los verá 1 persona.');
    assert.equal(L.textoConfirmacion({ agregados: [], quitados: ['a', 'b'] }, nombre, 0), 'Dejarán de verlos: Ana Ficticia y Beto Ficticio. Después de guardar, solo los administradores verán los indicadores.');
    assert.equal(L.textoActual([], nombre), 'Hoy solo los administradores ven los indicadores.');
    assert.equal(L.textoActual(['a'], nombre), 'Hoy, además de los administradores, los ve 1 persona: Ana Ficticia.');
    assert.equal(L.textoActual(['a', 'b', 'c'], nombre), 'Hoy, además de los administradores, los ven 3 personas: Ana Ficticia, Beto Ficticio y Ciro Ficticio.');
  });
  test('la introducción del lector dice de quién es el corte (nunca «usted es RESPONSABLE O.D.T.»)', () => {
    const t = L.introLector(RESP_A);
    assert.ok(t.includes('donde ' + RESP_A + ' es RESPONSABLE O.D.T.'));
    assert.ok(t.includes('solo lectura'));
    for (const x of [t, L.introLector(''), L.INTRO_LECTOR]) assert.ok(!/usted es RESPONSABLE/i.test(x), x);
    assert.equal(L.introLector(null), L.INTRO_LECTOR);
    assert.match(INTRO, /usted es RESPONSABLE O\.D\.T\./, 'la del administrador no cambia');
  });
  test('el último corte de cualquier responsable: datos más recientes y, a igualdad, el guardado después', () => {
    const cs = [
      { id: 'A', responsable: RESP_A, fechaDatos: '2026-04-10T08:00:00', creadoEnMs: 5 },
      { id: 'B', responsable: RESP_B, fechaDatos: '2026-05-01T08:00:00', creadoEnMs: 1 },
      { id: 'C', responsable: RESP_A, fechaDatos: '2026-05-01T08:00:00', creadoEnMs: 3 },
      { id: 'D', responsable: RESP_B, fechaDatos: '2026-03-01T08:00:00', creadoEnMs: 9 }
    ];
    assert.equal(L.ultimoCorteDeTodos(cs).id, 'C');
    assert.equal(L.ultimoCorteDeTodos([]), null);
    assert.equal(L.ultimoCorteDeTodos([null, { id: 'X' }]).id, 'X');
  });
});

describe('dominio: el contador de «Por subsanar» con palabras', () => {
  const obs = (estado, lectores, resumen) => ({ estado, lectores, resumen });
  const P = 'PENDIENTE'; const S = 'SUBSANADO'; const V = 'VERIFICADO';
  const lista = [
    obs('ABIERTA', ['uid-azt'], { 0: P, 1: P, 2: S }),
    obs('ABIERTA', ['uid-azt'], { 0: P, 1: V }),
    obs('RESUELTA', ['uid-azt'], { 0: V }),
    obs('ABIERTA', ['uid-otro'], { 0: P, 1: S, 2: S })
  ];
  test('AZT: sus ODT abiertas y sus puntos pendientes («2 ODT · 3 puntos»), con la frase completa', () => {
    const c = contadorPorSubsanar(lista, { uid: 'uid-azt', esAdmin: false });
    assert.deepEqual([c.odts, c.puntos, c.texto, c.corto, c.resto], [2, 3, '2 ODT · 3 puntos', '2 ODT', '3 puntos']);
    assert.equal(c.etiqueta, 'Por subsanar: 2 ODT abiertas suyas con 3 puntos pendientes por subsanar');
    const uno = contadorPorSubsanar([lista[1]], { uid: 'uid-azt' });
    assert.deepEqual([uno.texto, uno.etiqueta], ['1 ODT · 1 punto', 'Por subsanar: 1 ODT abierta suya con 1 punto pendiente por subsanar']);
    assert.equal(contadorPorSubsanar([], { uid: 'uid-azt' }).texto, '0 ODT · 0 puntos');
  });
  test('administrador: TODAS las ODT abiertas y los puntos subsanados por verificar («3 ODT · 3 por verificar»)', () => {
    const c = contadorPorSubsanar(lista, { uid: 'uid-admin', esAdmin: true });
    assert.deepEqual([c.odts, c.puntos, c.texto], [3, 3, '3 ODT · 3 por verificar']);
    assert.equal(c.etiqueta, 'Por subsanar: 3 ODT abiertas y 3 puntos subsanados por verificar');
    assert.equal(contadorPorSubsanar([lista[1]], { esAdmin: true }).etiqueta, 'Por subsanar: 1 ODT abierta y 0 puntos subsanados por verificar');
  });
  test('cifras grandes con separador de miles (como el resto de la página)', () => {
    const muchas = Array.from({ length: 1200 }, () => obs('ABIERTA', ['uid-azt'], { 0: P }));
    assert.equal(contadorPorSubsanar(muchas, { uid: 'uid-azt' }).texto, '1.200 ODT · 1.200 puntos');
  });
});

describe('datos: el repositorio de la lista de lectores', () => {
  test('sin el documento: null y nadie es lector; el admin la guarda (3 campos, hora del servidor) y se relee', async () => {
    const fs = nuevoFs();
    assert.equal(await repoLista(fs).leer(), null);
    assert.equal(await repoLista(fs, LECTOR).soyLector(), false);
    const r = await repoLista(fs).guardar([LECTOR.uid]);
    assert.deepEqual(r.lectores, [LECTOR.uid]);
    assert.deepEqual(r.actualizadoPor, { uid: ADMIN.uid, nombre: ADMIN.nombre });
    assert.equal(typeof r.actualizadoEnMs, 'number');
    const escrito = fs.lotes.at(-1).ops[0];
    assert.equal(escrito.ruta, 'odt_afinia_config/indicadores');
    assert.deepEqual(Object.keys(escrito.datos).sort(), ['actualizadoEn', 'actualizadoPor', 'lectores']);
    assert.equal(escrito.datos.actualizadoEn, TS, 'la hora del servidor');
    assert.equal(await repoLista(fs, LECTOR).soyLector(), true);
    assert.equal(await repoLista(fs, TECNICO).soyLector(), false);
    assert.equal(await repoLista(fs, null).soyLector(), false, 'sin sesión: false, sin lanzar');
  });
  test('solo un administrador con perfil la guarda; una lista inválida no se envía', async () => {
    const fs = nuevoFs();
    await assert.rejects(repoLista(fs, LECTOR).guardar([LECTOR.uid]), (e) => e.codigo === 'sin_permiso');
    await assert.rejects(repoLista(fs, { ...ADMIN, legacy: true }).guardar([LECTOR.uid]), (e) => e.codigo === 'sin_permiso' && /perfil/.test(e.message));
    await assert.rejects(repoLista(fs).guardar(['a', 'a']), (e) => e.codigo === 'validacion');
    await assert.rejects(repoLista(fs).guardar(Array.from({ length: 21 }, (_, i) => 'u' + i)), (e) => e.codigo === 'validacion' && /hasta 20/.test(e.message));
    await assert.rejects(repoLista(fs, null).leer(), (e) => e.codigo === 'cuenta');
    assert.equal(fs.lotes.length, 0, 'nada se escribió');
  });
  test('soyLector nunca lanza (sin red, false)', async () => {
    const fs = conConsultas(crearFirestoreFalso({ sinRedLectura: true }));
    assert.equal(await repoLista(fs, LECTOR).soyLector(), false);
    assert.equal(await soyLectorIndicadores({ sesion: LECTOR, repoLectores: repoLista(fs, LECTOR) }), false);
    assert.equal(await soyLectorIndicadores({ sesion: ADMIN, repoLectores: { soyLector: async () => true } }), false, 'el admin no necesita la lista');
    assert.equal(await soyLectorIndicadores({ sesion: LECTOR, repoLectores: { soyLector: async () => { throw new Error('x'); } } }), false);
  });
});

describe('datos: el repositorio de cortes para un LECTOR', () => {
  test('lee (historial, un corte con sus partes, el anterior, el último de un responsable); no guarda ni busca por huella', async () => {
    const fs = nuevoFs();
    const viejo = await guardarCorte(fs, RESP_A, '20260410080000', 'a1'.repeat(32));
    const nuevo = await guardarCorte(fs, RESP_A, '20260510080000', 'a2'.repeat(32));
    const r = repoLector(fs);
    assert.equal((await r.listar()).cortes.length, 2);
    const l = await r.leer(nuevo.id);
    assert.equal(l.completo, true);
    assert.equal(l.odts.length, 8);
    assert.equal((await r.anterior(l.corte)).anterior.id, viejo.id);
    assert.equal((await r.ultimoDe(RESP_A)).id, nuevo.id);
    await assert.rejects(r.porHuella('a1'.repeat(32)), (e) => e.codigo === 'sin_permiso');
    const antes = fs.lotes.length;
    await assert.rejects(r.guardar({}), (e) => e.codigo === 'sin_permiso');
    assert.equal(fs.lotes.length, antes);
  });
  test('quien no es admin ni lector: nada (ni una consulta), con el mensaje de quién puede verlos', async () => {
    const fs = nuevoFs();
    const r = crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => TECNICO });
    for (const f of [() => r.listar(), () => r.leer('A'.repeat(20)), () => r.ultimoDe(RESP_A), () => r.estadoSgm(['90000001'])]) {
      await assert.rejects(f, (e) => e.codigo === 'sin_permiso' && e.message === MSG_SIN_ACCESO_CORTES);
    }
    const r2 = crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => TECNICO, esLector: () => false });
    await assert.rejects(r2.listar(), (e) => e.codigo === 'sin_permiso');
    assert.equal(fs.consultas.length, 0);
  });
  test('estadoSgm del lector: las consultas de la bandeja y de «Por subsanar» (lectores array-contains uid), cruzadas por N.º, y `parcial`', async () => {
    const fs = nuevoFs();
    fs.poner('odt_afinia/OdtLector00000000001', { nro: '90000002', estado: 'LISTA', lectores: [LECTOR.uid], publicadoEn: TS });
    fs.poner('odt_afinia/OdtLector00000000002', { nro: '90000004', estado: 'CERRADA', lectores: ['uid-otro'], publicadoEn: TS });
    fs.poner('odt_afinia/OdtLector00000000003', { nro: '90000099', estado: 'LISTA', lectores: [LECTOR.uid], publicadoEn: TS });
    fs.poner('odt_afinia_obs/ObsLector0000000001', { nro: '90000006', estado: 'ABIERTA', lectores: [LECTOR.uid], creadoEn: TS });
    const r = await repoLector(fs).estadoSgm(['90000002', '90000004', '90000006', '90000002']);
    assert.equal(r.parcial, true);
    assert.deepEqual(r.consultados, ['90000002', '90000004', '90000006']);
    assert.deepEqual([...r.mapa.entries()].map(([n, x]) => [n, x.clave]).sort(), [['90000002', 'lista'], ['90000006', 'subsanar']]);
    assert.equal(fs.consultas.length, 2, 'dos consultas, tenga los N.º que tenga');
    for (const q of fs.consultas) {
      assert.ok(q.filtros.some((f) => f.t === 'where' && f.campo === 'lectores' && f.opr === 'array-contains' && f.valor === LECTOR.uid), q.col);
      assert.ok(!q.filtros.some((f) => f.t === 'where' && f.campo === 'nro'), 'sin consulta por N.º (las reglas no se la dejan)');
      assert.ok(q.filtros.some((f) => f.t === 'limit' && f.n === 50));
    }
    assert.deepEqual(fs.consultas.map((q) => [q.col, q.filtros.find((f) => f.t === 'orderBy').campo]).sort(), [['odt_afinia', 'publicadoEn'], ['odt_afinia_obs', 'creadoEn']]);
  });
});

describe('pantalla: el LECTOR (todo, solo lectura)', () => {
  test('#indicadores abre el último corte de CUALQUIER responsable, dice de quién es y no ofrece cargar', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, RESP_A, '20260410080000', 'b1'.repeat(32));
    const deB = await guardarCorte(fs, RESP_B, '20260512080000', 'b2'.repeat(32));
    await guardarCorte(fs, RESP_A, '20260301080000', 'b3'.repeat(32));   // guardado después, pero de datos más viejos
    const { c, r } = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true });
    assert.equal(r.corte.id, deB.id);
    const intro = c.querySelectorAll('.odt-ind-intro')[0].textContent;
    assert.ok(intro.includes('donde ' + RESP_B + ' es RESPONSABLE O.D.T.'), intro);
    assert.ok(!/usted es RESPONSABLE/.test(c.textContent));
    assert.ok(!boton(c, 'Cargar un corte nuevo') && !boton(c, 'Cargar el primer corte') && !boton(c, 'Cargar un corte'), 'sin cargar');
    assert.ok(boton(c, 'Ver el historial de cortes'));
    assert.equal(c.querySelectorAll('.odt-ind-lectores').length, 0, 'la sección de quién más puede verlos es solo del admin');
    assert.ok(c.textContent.includes('Indicadores de ODT · ' + RESP_B));
    // El historial tiene los tres y cada uno se abre.
    assert.equal(c.querySelectorAll('.odt-ind-tabla-historial')[0].todos().filter((x) => x.tagName === 'TR').length, 4);
    sinRestos(c);
  });
  test('#indicadores=<id> abre ese corte; por #indicadores-cargar se le lleva a #indicadores con un aviso corto', async () => {
    const fs = nuevoFs();
    const deA = await guardarCorte(fs, RESP_A, '20260410080000', 'c1'.repeat(32));
    await guardarCorte(fs, RESP_B, '20260512080000', 'c2'.repeat(32));
    const { r, c } = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true, vista: 'corte', corteId: deA.id });
    assert.equal(r.corte.id, deA.id);
    assert.ok(c.querySelectorAll('.odt-ind-intro')[0].textContent.includes('donde ' + RESP_A + ' es'));
    const antes = fs.consultas.length;
    const x = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true, vista: 'cargar' });
    assert.deepEqual(x.idas, [['indicadores', L.MSG_CARGAR_SOLO_ADMIN]]);
    assert.equal(x.r, null);
    assert.equal(fs.consultas.length, antes, 'ni siquiera consulta el historial');
    assert.ok(!x.c.querySelectorAll('.odt-campo').length, 'sin el campo de archivo');
  });
  test('sin cortes: lo dice sin ofrecer cargar; sin acceso (ni admin ni lector): el aviso de quién puede verlos', async () => {
    const fs = nuevoFs();
    const { c } = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true });
    assert.ok(c.textContent.includes(L.VACIO_LECTOR));
    assert.ok(!botones(c).length, 'ningún botón (ni «Cargar el primer corte»)');
    const t = await montar({ repoCortes: repoLector(fs, TECNICO), sesion: TECNICO });
    assert.equal(t.c.textContent, SOLO_ADMIN);
    assert.equal(SOLO_ADMIN, L.MSG_SIN_ACCESO);
    const t2 = await montar({ repoCortes: repoLector(fs, TECNICO), sesion: TECNICO, lector: 'si' });
    assert.equal(t2.c.textContent, SOLO_ADMIN, 'solo `true` cuenta (L-102 (6))');
  });
  test('la lista de ODT: «Estado en SGM» de lo que le asignaron; lo demás «Sin consultar», con su nota', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, RESP_A, '20260410080000', 'd1'.repeat(32));
    fs.poner('odt_afinia/OdtLector00000000001', { nro: '90000002', estado: 'LISTA', lectores: [LECTOR.uid], publicadoEn: TS });
    fs.poner('odt_afinia/OdtLector00000000002', { nro: '90000004', estado: 'CERRADA', lectores: ['uid-otro'], publicadoEn: TS });
    const { c } = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true });
    const tarjeta = botones(c).find((b) => b.getAttribute('aria-label') === 'Ver las 3 ODT: Cerradas');
    await tarjeta.disparar('click');
    const lista = () => c.querySelectorAll('.odt-ind-lista')[0];
    await hasta(() => lista().textContent.includes('Lista') && !lista().textContent.includes('Consultando'));
    const sgm = lista().todos().filter((x) => x.tagName === 'TR').slice(1).map((tr) => [tr.childNodes[0].textContent, tr.childNodes.at(-1).textContent]);
    assert.deepEqual(sgm, [['90000002', 'Lista'], ['90000004', SGM_SIN_CONSULTAR], ['90000006', SGM_SIN_CONSULTAR]]);
    assert.ok(lista().textContent.includes(NOTA_SGM_PARCIAL));
    const celda = lista().todos().filter((x) => x.tagName === 'TD' && x.textContent === SGM_SIN_CONSULTAR)[0];
    assert.match(celda.getAttribute('title'), /solo puede ver las ODT que le asignaron/);
    // Otro número no vuelve a preguntar por los ya consultados (ni entra en un bucle).
    const n = fs.consultas.length;
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(fs.consultas.length, n, 'sin consultas de más');
    sinRestos(c);
  });
});

describe('pantalla: «Quién más puede ver los indicadores» (solo el administrador)', () => {
  const repoOdtFalso = (azt = AZTS) => ({ llamadas: 0, async candidatos() { this.llamadas++; return { azt, habilitados: azt, fuera: [] }; } });
  async function seccion({ fs = nuevoFs(), repoOdt = repoOdtFalso(), guardados = null } = {}) {
    if (guardados) await repoLista(fs).guardar(guardados);
    const c = caja();
    const s = montarSeccionLectores(c, { repoLectores: repoLista(fs), repoOdt, sesion: ADMIN });
    return { c, s, fs, repoOdt };
  }
  const casillas = (c) => c.todos().filter((x) => x.tagName === 'INPUT' && x.type === 'checkbox');
  const etiquetas = (c) => c.todos().filter((x) => x.tagName === 'LABEL').map((x) => x.textContent);
  test('va plegada dentro de «Indicadores» del admin (arriba) y no lee nada hasta que se abre', async () => {
    const fs = nuevoFs();
    const repoOdt = repoOdtFalso();
    const { c } = await montar({ repoCortes: repoAdmin(fs), sesion: ADMIN, repoOdt, repoLectores: repoLista(fs) });
    const det = c.querySelectorAll('.odt-ind-lectores')[0];
    assert.ok(det, 'la sección');
    assert.equal(det.tagName, 'DETAILS');
    assert.equal(det.childNodes[0].textContent, L.TITULO_SECCION);
    assert.ok(c.childNodes.indexOf(det) < c.childNodes.findIndex((x) => String(x.className).includes('odt-vacio')), 'antes del contenido');
    assert.equal(repoOdt.llamadas, 0, 'plegada: no lee');
    det.open = true;
    await det.disparar('toggle');
    await hasta(() => casillas(det).length === 3);
    assert.equal(repoOdt.llamadas, 1);
    assert.equal(montarSeccionLectores(caja(), { sesion: LECTOR }), null, 'un lector no la tiene');
    assert.equal(montarSeccionLectores(caja(), { sesion: { ...ADMIN, legacy: true } }), null, 'ni un admin sin perfil');
  });
  test('una casilla por AZT habilitado (por nombre), marcadas las que ya pueden; el que ya no es elegible sigue, con su nota', async () => {
    const { c, s } = await seccion({ guardados: [LECTOR.uid, 'uid-ya-no-esta'] });
    await s.cargar();
    assert.deepEqual(etiquetas(c), ['Alfa Persona Ficticia', 'Beta Persona Ficticia', 'Lector Ficticio', 'Persona sin nombre conocido']);
    assert.deepEqual(casillas(c).map((x) => x.checked), [false, false, true, true]);
    assert.ok(c.textContent.includes('(' + L.NOTA_FUERA_DE_LISTA + ')'));
    assert.equal(casillas(c)[3].getAttribute('aria-describedby'), casillas(c)[3].id + 'Nota');
    assert.ok(c.querySelectorAll('.odt-ind-lectores-actual')[0].textContent.startsWith('Hoy, además de los administradores, los ven 2 personas: Lector Ficticio y'));
    // Cada casilla tiene su etiqueta (accesible): for = id.
    for (const x of casillas(c)) assert.ok(c.todos().some((l) => l.tagName === 'LABEL' && l.htmlFor === x.id), x.id);
    sinRestos(c);
  });
  test('«Guardar» en dos pasos: la frase de lo que cambia → «Sí, guardar»; «Cancelar» vuelve; se guarda y se relee', async () => {
    const { c, s, fs } = await seccion();
    await s.cargar();
    assert.ok(c.textContent.includes('Hoy solo los administradores ven los indicadores.'));
    const [alfa, , lector] = casillas(c);
    const guardar = boton(c, 'Guardar'); const si = boton(c, 'Sí, guardar'); const no = boton(c, 'Cancelar');
    assert.ok(visible(guardar) && !visible(si));
    await guardar.disparar('click');
    assert.ok(c.textContent.includes(L.SIN_CAMBIOS), 'sin cambios no pide confirmación');
    assert.ok(!visible(si));
    lector.checked = true; await lector.disparar('change');
    await guardar.disparar('click');
    assert.ok(visible(si) && !visible(guardar));
    assert.ok(c.textContent.includes('Podrán ver los indicadores (solo lectura): Lector Ficticio. Después de guardar, además de los administradores, los verá 1 persona.'));
    assert.equal(document.activeElement, si, 'el foco va a «Sí, guardar»');
    // Cambiar una casilla con la confirmación abierta la cierra (se confirma siempre lo marcado).
    alfa.checked = true; await alfa.disparar('change');
    assert.ok(!visible(si) && visible(guardar));
    await guardar.disparar('click');
    assert.ok(c.textContent.includes('Podrán ver los indicadores (solo lectura): Alfa Persona Ficticia y Lector Ficticio.'));
    await no.disparar('click');
    assert.ok(!visible(si) && visible(guardar));
    assert.equal(fs.lotes.length, 0, 'nada se escribió todavía');
    await guardar.disparar('click');
    await si.disparar('click');
    assert.deepEqual(fs.store.get('odt_afinia_config/indicadores').lectores, ['uid-azt-alfa', LECTOR.uid]);
    assert.ok(c.textContent.includes('Guardado. Hoy, además de los administradores, los ven 2 personas: Alfa Persona Ficticia y Lector Ficticio.'));
    assert.ok(!visible(si) && visible(guardar));
    // Quitarlos a todos: «solo los administradores».
    for (const x of casillas(c)) { x.checked = false; await x.disparar('change'); }
    await guardar.disparar('click');
    assert.ok(c.textContent.includes('Dejarán de verlos: Alfa Persona Ficticia y Lector Ficticio. Después de guardar, solo los administradores verán los indicadores.'));
    await si.disparar('click');
    assert.deepEqual(fs.store.get('odt_afinia_config/indicadores').lectores, []);
    sinRestos(c);
  });
  test('si la página tiene partes viejas (sin `candidatos`) lo dice, y los lectores guardados se pueden quitar igual', async () => {
    const { c, s } = await seccion({ repoOdt: {}, guardados: [LECTOR.uid] });
    await s.cargar();
    assert.ok(c.textContent.includes(MSG_SIN_CANDIDATOS_FN));
    assert.deepEqual(casillas(c).map((x) => x.checked), [true]);
    const e = await seccion({ repoOdt: { candidatos: async () => { throw new Error('sin red de prueba'); } } });
    await e.s.cargar();
    assert.ok(e.c.textContent.includes('No se pudo leer la lista de AZT habilitados: sin red de prueba'));
    assert.ok(e.c.textContent.includes(L.SIN_CANDIDATOS));
    assert.ok(!visible(boton(e.c, 'Guardar')), 'sin casillas, sin «Guardar»');
  });
});

describe('app.js: la pestaña «Indicadores» para el lector', () => {
  async function arrancar(perfil, hash, extra = {}) {
    const g = { window: globalThis.window, location: globalThis.location, sesion: globalThis.__sgmSession };
    globalThis.window = { __sgmSession: { user: { uid: perfil.uid }, profile: { nombre: perfil.nombre, email: perfil.correoPerfil, rol: perfil.rol, activo: true }, role: perfil.rol }, addEventListener: () => {} };
    globalThis.__sgmSession = globalThis.window.__sgmSession;
    globalThis.location = { hash };
    try {
      const raiz = caja();
      await montarOdtAfinia(raiz, { franja: caja(), repoObs: { listar: async () => ({ lista: [], tope: false }) }, ...extra });
      return { raiz, hash: globalThis.location.hash };
    } finally {
      for (const [k, v] of [['window', g.window], ['location', g.location], ['__sgmSession', g.sesion]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
    }
  }
  const nav = (raiz) => raiz.querySelectorAll('.odt-nav-btn').map((b) => b.textContent);
  const lista = (soy) => ({ llamadas: 0, async soyLector() { this.llamadas++; return soy; } });
  const obsDe = (uid) => ({ listar: async () => ({ lista: [{ id: 'O'.repeat(20), estado: 'ABIERTA', lectores: [uid], resumen: { 0: 'PENDIENTE' } }], tope: false }) });
  test('el lector la ve (antes de «Por subsanar») y entra por #indicadores al último corte', async () => {
    const fs = nuevoFs();
    const deB = await guardarCorte(fs, RESP_B, '20260512080000', 'e1'.repeat(32));
    const { raiz } = await arrancar(LECTOR, '#indicadores', { repoLectores: lista(true), repoCortes: repoLector(fs), repoObs: obsDe(LECTOR.uid) });
    assert.deepEqual(nav(raiz), ['Bandeja', 'Habilitarme y Mi firma', 'Indicadores', 'Por subsanar1 ODT · 1 punto']);
    const b = raiz.querySelectorAll('.odt-nav-btn').find((x) => x.textContent === 'Indicadores');
    assert.equal(b.getAttribute('href'), '#indicadores');
    assert.equal(b.getAttribute('aria-current'), 'page');
    await hasta(() => raiz.textContent.includes('Indicadores de ODT · ' + RESP_B));
    assert.ok(raiz.textContent.includes('donde ' + RESP_B + ' es RESPONSABLE O.D.T.'));
    assert.ok(!raiz.todos().some((x) => x.tagName === 'BUTTON' && x.textContent === 'Cargar un corte nuevo'));
    void deB;
  });
  test('por #indicadores-cargar, al lector se le lleva a #indicadores', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, RESP_B, '20260512080000', 'e2'.repeat(32));
    const { hash } = await arrancar(LECTOR, '#indicadores-cargar', { repoLectores: lista(true), repoCortes: repoLector(fs) });
    assert.equal(hash, 'indicadores');
  });
  test('quien no está en la lista no la ve y, por el ancla, recibe el aviso; al admin no se le pregunta', async () => {
    const fs = nuevoFs();
    const { raiz } = await arrancar(TECNICO, '#indicadores', { repoLectores: lista(false), repoCortes: repoLector(fs, TECNICO) });
    assert.ok(!nav(raiz).includes('Indicadores'));
    assert.ok(raiz.textContent.includes(MSG_INDICADORES_SIN_ACCESO));
    assert.equal(fs.consultas.length, 0, 'no lee cortes');
    const l = lista(true);
    const a = await arrancar(ADMIN, '', { repoLectores: l, repoCortes: repoAdmin(fs) });
    assert.deepEqual(nav(a.raiz), ['Bandeja', 'Habilitarme y Mi firma', 'Publicar ODT', 'Indicadores', 'Por subsanar0 ODT · 0 por verificar']);
    assert.equal(l.llamadas, 0, 'al admin no se le pregunta si es lector');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Revisión del 2026-11-24 (ronda 1): al lector no se le pide lo que no puede hacer; la pestaña solo a quien la regla
// deja leer (activo y no visitante); el desvío desde #indicadores-cargar no deja esa ancla en el historial; sin red, un
// aviso de conexión (no «solo administradores»); las casillas se vuelven a pintar después de guardar; el «Estado en
// SGM» del lector no repite sus dos consultas; el contador de «Por subsanar» con tope dice que es un mínimo.
/** Un corte guardado, pasado a la versión 1 (sin AZT ni jefe en sus ODT), como el primero de producción (§234.5). */
function aVersion1(fs, id) {
  const ruta = 'odt_afinia_cortes/' + id;
  const c = fs.store.get(ruta);
  fs.store.set(ruta, { ...c, version: 1 });
  for (let k = 0; k < c.nPartes; k++) {
    const p = fs.store.get(ruta + '/partes/' + k);
    fs.store.set(ruta + '/partes/' + k, { ...p, odts: p.odts.map(({ azt, jefe, ejecucion, equipo, ...resto }) => resto) });   // 99 §236: la versión 1 tampoco trae la ejecución ni el equipo
  }
}

describe('revisión: lo que se le dice al LECTOR', () => {
  test('corte de la versión 1: al lector, «abra en el historial un corte más reciente» (nunca «cargue»); al admin, como antes', async () => {
    const { NOTA_SIN_AZT_JEFE } = await import('../assets/js/ui/odt-afinia/indicadores-vista.js');
    const fs = nuevoFs();
    const g = await guardarCorte(fs, RESP_A, '20260410080000', 'f1'.repeat(32));
    aVersion1(fs, g.id);
    const nota = (c) => c.todos().find((x) => x.id === 'odtIndNotaAztJefe');
    const l = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true, vista: 'corte', corteId: g.id });
    assert.equal(nota(l.c).textContent, L.NOTA_SIN_AZT_JEFE_LECTOR);
    assert.ok(!/cargue/i.test(l.c.textContent), 'al lector no se le pide cargar');
    const a = await montar({ repoCortes: repoAdmin(fs), sesion: ADMIN, vista: 'corte', corteId: g.id });
    assert.equal(nota(a.c).textContent, NOTA_SIN_AZT_JEFE);
    assert.match(NOTA_SIN_AZT_JEFE, /cargue un corte nuevo/);
  });
  test('corte INCOMPLETO: al lector, «avise a un administrador»; al admin, «cargue uno nuevo con el mismo archivo»', async () => {
    const fs = nuevoFs();
    const g = await guardarCorte(fs, RESP_A, '20260410080000', 'f2'.repeat(32));
    fs.store.delete('odt_afinia_cortes/' + g.id + '/partes/0');
    const l = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true, vista: 'corte', corteId: g.id });
    assert.ok(l.c.textContent.includes('Este corte está INCOMPLETO'));
    assert.ok(l.c.textContent.includes(L.CIERRE_INCOMPLETO_LECTOR));
    assert.ok(!/cargue uno nuevo con el mismo archivo\./.test(l.c.textContent.replace(L.CIERRE_INCOMPLETO_LECTOR, '')), 'sin la frase del admin');
    const a = await montar({ repoCortes: repoAdmin(fs), sesion: ADMIN, vista: 'corte', corteId: g.id });
    assert.ok(a.c.textContent.includes('Un corte no se puede corregir: cargue uno nuevo con el mismo archivo.'));
    assert.ok(!a.c.textContent.includes(L.CIERRE_INCOMPLETO_LECTOR));
  });
  test('el desvío desde #indicadores-cargar pide REEMPLAZAR el ancla; sin cortes, el aviso no habla del «último corte guardado»', async () => {
    const fs = nuevoFs();
    const c = caja(); const idas = [];
    await montarIndicadores(c, { repoCortes: repoLector(fs), sesion: LECTOR, lector: true, vista: 'cargar', alIr: (...x) => idas.push(x) });
    assert.deepEqual(idas, [['indicadores', L.MSG_CARGAR_SOLO_ADMIN, { reemplazar: true }]]);
    const v = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true, mensaje: L.MSG_CARGAR_SOLO_ADMIN });
    assert.ok(v.c.textContent.includes(L.MSG_CARGAR_SOLO_ADMIN_SIN_CORTES));
    assert.ok(!v.c.textContent.includes('último corte guardado'), v.c.textContent);
    assert.ok(v.c.textContent.includes(L.VACIO_LECTOR));
    // Con cortes, el aviso sigue completo.
    await guardarCorte(fs, RESP_A, '20260410080000', 'f3'.repeat(32));
    const w = await montar({ repoCortes: repoLector(fs), sesion: LECTOR, lector: true, mensaje: L.MSG_CARGAR_SOLO_ADMIN });
    assert.ok(w.c.textContent.includes(L.MSG_CARGAR_SOLO_ADMIN));
  });
});

describe('revisión: la pestaña solo a quien la regla deja leer, y sin red un aviso de conexión', () => {
  test('dominio: activo, no visitante, no admin y con uid', () => {
    assert.equal(L.sesionPuedeSerLector(LECTOR), true);
    assert.equal(L.sesionPuedeSerLector({ ...LECTOR, activo: true }), true);
    assert.equal(L.sesionPuedeSerLector({ ...LECTOR, activo: false }), false, 'inactivo');
    assert.equal(L.sesionPuedeSerLector({ ...LECTOR, rol: 'visitante' }), false, 'visitante');
    assert.equal(L.sesionPuedeSerLector({ ...LECTOR, rol: 'Visitante externo' }), false, 'visitante (como la regla: contiene «visitante»)');
    assert.equal(L.sesionPuedeSerLector(ADMIN), false, 'el admin no necesita la lista');
    assert.equal(L.sesionPuedeSerLector({ ...LECTOR, uid: '' }), false);
    assert.equal(L.sesionPuedeSerLector(null), false);
  });
  test('datos: un inactivo o un visitante que siga en la lista NO es lector (ni se lee la lista); sin red, `sinComprobar`', async () => {
    const fs = nuevoFs();
    await repoLista(fs).guardar([LECTOR.uid, TECNICO.uid]);
    assert.deepEqual(await repoLista(fs, LECTOR).comprobarLector(), { lector: true, sinComprobar: false });
    assert.deepEqual(await repoLista(fs, { ...LECTOR, activo: false }).comprobarLector(), { lector: false, sinComprobar: false });
    assert.equal(await repoLista(fs, { ...TECNICO, rol: 'visitante' }).soyLector(), false);
    assert.equal(await repoLista(fs, TECNICO).soyLector(), true, 'control: el mismo uid, activo y del equipo, sí');
    const sinRed = conConsultas(crearFirestoreFalso({ sinRedLectura: true }));
    assert.deepEqual(await repoLista(sinRed, LECTOR).comprobarLector(), { lector: false, sinComprobar: true });
    assert.deepEqual(await repoLista(sinRed, { ...LECTOR, activo: false }).comprobarLector(), { lector: false, sinComprobar: false }, 'inactivo: ni lo intenta');
    // Un «no» de la plataforma (permiso negado) u otro fallo no son un problema de conexión; sin respuesta a tiempo, sí.
    for (const [code, sinComprobar] of [['permission-denied', false], ['internal', false], ['deadline-exceeded', true]]) {
      const F = { ...fs.F, getDocFromServer: async () => { throw Object.assign(new Error('falla de prueba'), { code }); } };
      const r = crearRepositorioLectoresInd({ sdk: F, db: fs.db, sesion: () => LECTOR });
      assert.deepEqual(await r.comprobarLector(), { lector: false, sinComprobar }, code);
    }
    assert.deepEqual(await repoLista(sinRed, null).comprobarLector(), { lector: false, sinComprobar: false });
  });
  test('pantalla: estadoLectorIndicadores (y con un repositorio que solo trae soyLector)', async () => {
    const { estadoLectorIndicadores } = await import('../assets/js/ui/odt-afinia/indicadores-lectores.js');
    let llamadas = 0;
    const solo = (soy) => ({ async soyLector() { llamadas++; return soy; } });
    assert.deepEqual(await estadoLectorIndicadores({ sesion: LECTOR, repoLectores: solo(true) }), { lector: true, sinComprobar: false });
    assert.deepEqual(await estadoLectorIndicadores({ sesion: { ...LECTOR, rol: 'visitante' }, repoLectores: solo(true) }), { lector: false, sinComprobar: false });
    assert.deepEqual(await estadoLectorIndicadores({ sesion: { ...LECTOR, activo: false }, repoLectores: solo(true) }), { lector: false, sinComprobar: false });
    assert.equal(llamadas, 1, 'al inactivo y al visitante no se les pregunta');
    assert.deepEqual(await estadoLectorIndicadores({ sesion: LECTOR, repoLectores: { comprobarLector: async () => ({ lector: false, sinComprobar: true }) } }), { lector: false, sinComprobar: true });
    assert.deepEqual(await estadoLectorIndicadores({ sesion: LECTOR, repoLectores: { comprobarLector: async () => { throw new Error('x'); } } }), { lector: false, sinComprobar: false });
    assert.equal(await soyLectorIndicadores({ sesion: { ...LECTOR, activo: false }, repoLectores: solo(true) }), false);
  });

  async function arrancarCon(perfil, hash, extra = {}, { perfilExtra = {}, loc = null } = {}) {
    const g = { window: globalThis.window, location: globalThis.location, sesion: globalThis.__sgmSession };
    globalThis.window = { __sgmSession: { user: { uid: perfil.uid }, profile: { nombre: perfil.nombre, email: perfil.correoPerfil, rol: perfil.rol, activo: true, ...perfilExtra }, role: perfilExtra.rol || perfil.rol }, addEventListener: () => {} };
    globalThis.__sgmSession = globalThis.window.__sgmSession;
    globalThis.location = loc || { hash };
    try {
      const raiz = caja();
      await montarOdtAfinia(raiz, { franja: caja(), repoObs: { listar: async () => ({ lista: [], tope: false }) }, ...extra });
      return { raiz, location: globalThis.location };
    } finally {
      for (const [k, v] of [['window', g.window], ['location', g.location], ['__sgmSession', g.sesion]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
    }
  }
  const nav = (raiz) => raiz.querySelectorAll('.odt-nav-btn').map((b) => b.textContent);
  test('app.js: un inactivo o un visitante en la lista no ve la pestaña (y no se pregunta); sin red, el ancla avisa de la conexión', async () => {
    const { MSG_INDICADORES_SIN_COMPROBAR } = await import('../assets/js/ui/odt-afinia/app.js');
    const fs = nuevoFs();
    for (const perfilExtra of [{ activo: false }, { rol: 'visitante' }]) {
      const l = { llamadas: 0, async comprobarLector() { this.llamadas++; return { lector: true, sinComprobar: false }; } };
      const { raiz } = await arrancarCon(LECTOR, '#indicadores', { repoLectores: l, repoCortes: repoLector(fs) }, { perfilExtra });
      assert.ok(!nav(raiz).includes('Indicadores'), JSON.stringify(perfilExtra));
      assert.ok(raiz.textContent.includes(MSG_INDICADORES_SIN_ACCESO), JSON.stringify(perfilExtra));
      assert.equal(l.llamadas, 0, 'no se pregunta: la regla le negaría todo');
    }
    assert.equal(fs.consultas.length, 0, 'no se leyeron cortes');
    const sinRed = conConsultas(crearFirestoreFalso({ sinRedLectura: true }));
    const { raiz } = await arrancarCon(LECTOR, '#indicadores', { repoLectores: repoLista(sinRed, LECTOR), repoCortes: repoLector(fs) });
    assert.ok(!nav(raiz).includes('Indicadores'));
    assert.ok(raiz.textContent.includes(MSG_INDICADORES_SIN_COMPROBAR));
    assert.ok(!raiz.textContent.includes(MSG_INDICADORES_SIN_ACCESO));
  });
  test('app.js: el desvío del lector usa location.replace (sin dejar #indicadores-cargar en el historial)', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, RESP_B, '20260512080000', 'f4'.repeat(32));
    const loc = { hash: '#indicadores-cargar', reemplazos: [], replace(u) { this.reemplazos.push(u); this.hash = u; } };
    const r = await arrancarCon(LECTOR, '', { repoLectores: { soyLector: async () => true }, repoCortes: repoLector(fs) }, { loc });
    assert.deepEqual(r.location.reemplazos, ['#indicadores']);
    assert.equal(r.location.hash, '#indicadores');
  });
});

describe('revisión: la sección del admin y el «Estado en SGM» del lector', () => {
  test('después de guardar, las casillas se vuelven a pintar: quien ya no era AZT habilitado y se quitó deja de aparecer', async () => {
    const fs = nuevoFs();
    await repoLista(fs).guardar([LECTOR.uid, 'uid-ya-no-esta']);
    const c = caja();
    const s = montarSeccionLectores(c, { repoLectores: repoLista(fs), repoOdt: { candidatos: async () => ({ azt: AZTS, habilitados: AZTS, fuera: [] }) }, sesion: ADMIN });
    await s.cargar();
    const casillas = () => c.todos().filter((x) => x.tagName === 'INPUT' && x.type === 'checkbox');
    assert.equal(casillas().length, 4);
    assert.ok(c.textContent.includes(L.NOTA_FUERA_DE_LISTA));
    const fuera = casillas()[3];
    fuera.checked = false; await fuera.disparar('change');
    await boton(c, 'Guardar').disparar('click');
    await boton(c, 'Sí, guardar').disparar('click');
    assert.deepEqual(fs.store.get('odt_afinia_config/indicadores').lectores, [LECTOR.uid]);
    assert.equal(casillas().length, 3, 'su casilla ya no está');
    assert.ok(!c.textContent.includes(L.NOTA_FUERA_DE_LISTA), 'ni su nota');
    assert.deepEqual(casillas().map((x) => x.checked), [false, false, true]);
    assert.ok(visible(boton(c, 'Guardar')));
    sinRestos(c);
  });
  test('estadoSgm del lector: sus dos consultas se reutilizan un minuto (otra lista no las repite); después, o tras un fallo, se vuelven a leer', async () => {
    const fs = nuevoFs();
    fs.poner('odt_afinia/OdtLector00000000001', { nro: '90000002', estado: 'LISTA', lectores: [LECTOR.uid], publicadoEn: TS });
    fs.poner('odt_afinia_obs/ObsLector0000000001', { nro: '90000006', estado: 'ABIERTA', lectores: [LECTOR.uid], creadoEn: TS });
    let t = 1000;
    let fallar = false;
    const F = { ...fs.F, getDocsFromServer: async (q) => { if (fallar) throw Object.assign(new Error('sin red'), { code: 'unavailable' }); return fs.F.getDocsFromServer(q); } };
    const r = crearRepositorioCortes({ sdk: F, db: fs.db, sesion: () => LECTOR, esLector: true, ahora: () => t });
    const a = await r.estadoSgm(['90000002']);
    assert.deepEqual([...a.mapa.keys()], ['90000002']);
    assert.equal(fs.consultas.length, 2);
    t += 30000;
    const b = await r.estadoSgm(['90000006', '90000004']);
    assert.deepEqual([...b.mapa.keys()], ['90000006']);
    assert.deepEqual(b.consultados, ['90000006', '90000004']);
    assert.equal(b.parcial, true);
    assert.equal(fs.consultas.length, 2, 'dentro del minuto: sin consultas de más');
    t += 31000;
    fallar = true;
    await assert.rejects(r.estadoSgm(['90000002']), (e) => e.codigo === 'red');
    fallar = false;
    const c = await r.estadoSgm(['90000002']);
    assert.deepEqual([...c.mapa.keys()], ['90000002']);
    assert.equal(fs.consultas.length, 4, 'pasado el minuto (y tras el fallo, que no quedó guardado) se vuelve a leer');
  });
});

describe('revisión: el contador de «Por subsanar» con tope', () => {
  const obs = (estado, lectores, resumen) => ({ estado, lectores, resumen });
  test('si la lista llegó al tope de la consulta, las cifras son un mínimo («+» y «al menos»)', () => {
    const lista = [obs('ABIERTA', ['uid-azt'], { 0: 'PENDIENTE', 1: 'PENDIENTE' }), obs('ABIERTA', ['uid-azt'], { 0: 'SUBSANADO' })];
    const c = contadorPorSubsanar(lista, { uid: 'uid-azt' }, { tope: true });
    assert.deepEqual([c.texto, c.corto, c.resto, c.tope], ['2+ ODT · 2+ puntos', '2+ ODT', '2+ puntos', true]);
    assert.equal(c.etiqueta, 'Por subsanar: al menos 2 ODT abiertas suyas con 2 puntos pendientes por subsanar (solo se leyeron las más recientes: puede haber más)');
    const uno = contadorPorSubsanar([lista[1]], { esAdmin: true }, { tope: true });
    assert.deepEqual([uno.texto, uno.etiqueta], ['1+ ODT · 1+ por verificar', 'Por subsanar: al menos 1 ODT abierta y 1 punto subsanado por verificar (solo se leyeron las más recientes: puede haber más)']);
    assert.equal(contadorPorSubsanar([lista[1]], { uid: 'uid-azt' }, { tope: true }).resto, '0+ puntos');
    // Sin tope (o con otra cosa que no sea true), como siempre.
    assert.deepEqual([contadorPorSubsanar(lista, { uid: 'uid-azt' }).texto, contadorPorSubsanar(lista, { uid: 'uid-azt' }, { tope: 'si' }).texto], ['2 ODT · 2 puntos', '2 ODT · 2 puntos']);
  });
  test('la pestaña lo recibe de la lista (`tope` de listar), tanto al arrancar como al abrir «Por subsanar»', async () => {
    const { contarDeMiLado, montarListaObs } = await import('../assets/js/ui/odt-afinia/por-subsanar.js');
    const lista = [{ id: 'O'.repeat(20), estado: 'ABIERTA', lectores: [LECTOR.uid], resumen: { 0: 'PENDIENTE' } }];
    const d = await contarDeMiLado({ repoObs: { listar: async () => ({ lista, tope: true }) }, sesion: LECTOR });
    assert.equal(d.contador.texto, '1+ ODT · 1+ puntos');
    const sin = await contarDeMiLado({ repoObs: { listar: async () => ({ lista, tope: false }) }, sesion: LECTOR });
    assert.equal(sin.contador.texto, '1 ODT · 1 punto');
    const cuentas = [];
    await montarListaObs(caja(), { repoObs: { listar: async () => ({ lista, tope: true }) }, sesion: LECTOR, alIr: () => {}, alContar: (x) => cuentas.push(x.contador.texto) });
    assert.deepEqual(cuentas, ['1+ ODT · 1+ puntos']);
  });
});
