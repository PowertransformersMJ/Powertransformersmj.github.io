// Firma de ODT Afinia · INDICADORES · filtros por AZT EN SITIO y por JEFE DE TRABAJO (pedido del Ingeniero del
// 2026-11-24: «necesito que en las ODT anexes un filtro para buscar por AZT y JEFE DE TRABAJO»):
//   · dominio: las dos columnas se leen por su NOMBRE (no son de las 10 mínimas: sin ellas, el archivo se lee igual y
//     se avisa); el jefe es el EN SITIO y, si viene vacío, el asignado («JEFE DE TRABAJO»); espacios simples para
//     agrupar; vacíos → «(sin dato)»; distintos entre las filas de una ODT → el de la primera, con aviso; filtros que
//     se combinan con tipo, zona y contratista; opciones con su conteo, por nombre y «(sin dato)» al final;
//   · datos: la VERSIÓN 2 del corte (cada ODT con 11 campos); planCorte los valida en TODAS; al leer, unirPartes
//     acepta la forma de la versión de cada corte (los de la versión 1, de 9 campos, se siguen leyendo);
//   · pantalla: los dos filtros (con conteo), que se combinan con los demás y responden en tarjetas, tablas, lista
//     (que suma las columnas «AZT» y «Jefe de trabajo») y comparación; «Quitar filtros» los limpia; un corte de la
//     versión 1 los muestra deshabilitados con su nota; si el corte anterior es de la versión 1, filtrar por AZT o por
//     jefe en la comparación «no aplica» (una línea en vez de números engañosos); la vista previa de la carga cuenta
//     las personas y avisa lo raro.
// Datos INVENTADOS (tests/odt_afinia_indicadores_fixture.js): ninguna persona, empresa ni N.º real.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crearDomFalso, crearFirestoreFalso } from './odt_afinia_ui_dobles.js';
import * as D from '../assets/js/domain/odt_afinia_indicadores.js';
import { planCorte, unirPartes, odtValida, CAMPOS_ODT_POR_VERSION } from '../assets/js/data/odt_afinia_cortes_lotes.js';
import { crearRepositorioCortes } from '../assets/js/data/odt_afinia_cortes.js';
import {
  RESP_A, BETA, ALFA, AZT_1, AZT_2, JEFE_1, JEFE_2, JEFE_3, archivoBase, csv, odt, latin1, conConsultas
} from './odt_afinia_indicadores_fixture.js';

const { ENCABEZADOS_AFINIA, SIN_DATO } = D;
const ADMIN = { uid: 'uid-admin-azt-prueba', nombre: 'Persona Fictícia Úno', rol: 'admin', esAdmin: true, legacy: false };
const HEX = 'a1'.repeat(32);
const ID = 'B'.repeat(20);
const TS = { marca: 'ts' };
/** Un CSV con solo algunas columnas (las de `encabezados`), desde filas de 48 del fixture. */
const conColumnas = (encabezados, filas) => csv(filas.map((f) => encabezados.map((h) => f[ENCABEZADOS_AFINIA.indexOf(h)])), { encabezados });
const sinColumnas = (...fuera) => ENCABEZADOS_AFINIA.filter((h) => !fuera.includes(h));
const nros = (xs) => xs.map((o) => o.nro);
const cuenta = (c) => [c.total, c.generada, c.ejecutada, c.noEjecutada, c.cerrada, c.inactiva, c.otro];

// ═════════════════════════════════════════════════════════════════════════════
describe('dominio: lectura del AZT en sitio y del jefe de trabajo', () => {
  const L = D.leerCsv(archivoBase());
  const A = D.analizarResponsable(L, RESP_A);
  test('se leen por su nombre: AZT EN SITIO y JEFE DE TRABAJO EN SITIO (o, si viene vacío, JEFE DE TRABAJO)', () => {
    assert.equal(L.traeAzt, true); assert.equal(L.traeJefe, true);
    const por = Object.fromEntries(A.odts.map((o) => [o.nro, [o.azt, o.jefe]]));
    assert.deepEqual(por['90000001'], [AZT_1, JEFE_1]);
    assert.deepEqual(por['90000003'], [AZT_2, JEFE_2]);
    assert.deepEqual(por['90000005'], [AZT_1, JEFE_3], 'jefe en sitio vacío: el asignado');
    assert.deepEqual(D.CAMPOS_OPCIONALES, { azt: 'AZT EN SITIO', jefe: 'JEFE DE TRABAJO EN SITIO', jefeRespaldo: 'JEFE DE TRABAJO' });
    for (const enc of Object.values(D.CAMPOS_OPCIONALES)) assert.ok(!D.ENCABEZADOS_MINIMOS.includes(enc), 'no es de los mínimos: ' + enc);
    // Sin avisos nuevos en el archivo de prueba (todas traen los dos; ninguno cambia entre filas).
    assert.deepEqual(A.conflictos, []);
    assert.equal(A.sinAzt, 0); assert.equal(A.sinJefe, 0);
  });
  test('espacios de más se recortan y se colapsan (agrupan con el mismo nombre); el nombre se muestra tal cual', () => {
    const l = D.leerCsv(csv([odt('90000101', { azt: '  AZT   FICTICIO  UNO ', jefe: 'Jefe  De   Minúsculas ' }), odt('90000102')]));
    const a = D.analizarResponsable(l, RESP_A);
    assert.deepEqual(a.odts.map((o) => o.azt), [AZT_1, AZT_1]);
    assert.equal(a.odts[0].jefe, 'Jefe De Minúsculas', 'tal cual (sin pasar a mayúsculas ni quitar tildes)');
    assert.deepEqual(D.opcionesConConteo(a.odts, 'azt'), [{ valor: AZT_1, n: 2 }]);
  });
  test('en otro orden de columnas también (se leen por nombre)', () => {
    const enc = [...ENCABEZADOS_AFINIA].reverse();
    const l = D.leerCsv(conColumnas(enc, [odt('90000111', { azt: AZT_2, jefe: '', jefePlan: JEFE_3 })]));
    assert.equal(l.ok, true);
    assert.deepEqual([l.registros[0].azt, l.registros[0].jefe], [AZT_2, JEFE_3]);
  });
  test('una «|» de más en las observaciones no corre el AZT ni el jefe (la fila no queda dudosa)', () => {
    const l = D.leerCsv(csv([odt('90000121', { azt: AZT_2, jefe: JEFE_3, extra: { OBSERVACIONES: 'con | barra' } })]));
    assert.equal(l.raras.length, 1);
    assert.ok(!l.raras[0].dudosa);
    assert.deepEqual([l.registros[0].azt, l.registros[0].jefe, l.registros[0].responsable], [AZT_2, JEFE_3, RESP_A]);
  });
  test('un archivo SIN esas columnas se lee igual (no son mínimas): quedan vacías y la vista previa lo avisa', () => {
    const fuera = sinColumnas('AZT EN SITIO', 'JEFE DE TRABAJO EN SITIO', 'JEFE DE TRABAJO');
    const l = D.leerCsv(conColumnas(fuera, [odt('90000131'), odt('90000132', { estado: 'CERRADA', cerrada: '02/03/2026 08:00' })]));
    assert.equal(l.ok, true);
    assert.equal(l.traeAzt, false); assert.equal(l.traeJefe, false);
    const a = D.analizarResponsable(l, RESP_A);
    assert.deepEqual(a.odts.map((o) => [o.azt, o.jefe]), [['', ''], ['', '']]);
    const av = D.avisosDeLectura(l, a);
    assert.ok(av.includes(D.MSG_SIN_COLUMNA_AZT) && av.includes(D.MSG_SIN_COLUMNA_JEFE), av.join(' | '));
    assert.ok(!av.some((x) => /no traen AZT|no traen jefe/.test(x)), 'sin columna no se cuenta «sin dato» aparte');
    // Dice lo que se verá después (el filtro queda con «(sin dato)»), no que no se podrá filtrar.
    for (const m of [D.MSG_SIN_COLUMNA_AZT, D.MSG_SIN_COLUMNA_JEFE]) assert.ok(m.endsWith('todas las ODT saldrán como «' + SIN_DATO + '».') && !m.includes('no se podrá'), m);
    // Se puede guardar igual (sin AZT ni jefe).
    const p = planCorte({ id: ID, archivo: { nombre: 'x.csv', bytes: 1, sha256: HEX }, lectura: l, analisis: a, por: ADMIN, ts: TS });
    assert.ok(p.partes[0].odts.every((o) => o.azt === '' && o.jefe === ''));
    // Solo con el jefe ASIGNADO (sin el «en sitio»): se usa ese.
    const l2 = D.leerCsv(conColumnas(sinColumnas('JEFE DE TRABAJO EN SITIO'), [odt('90000133', { jefePlan: JEFE_2 })]));
    assert.equal(l2.traeJefe, true);
    assert.equal(l2.registros[0].jefe, JEFE_2);
    assert.ok(!D.avisosDeLectura(l2, D.analizarResponsable(l2, RESP_A)).includes(D.MSG_SIN_COLUMNA_JEFE));
  });
  test('vacíos: «(sin dato)» en las opciones (al final, con su conteo) y aviso con cuántas ODT', () => {
    const l = D.leerCsv(csv([odt('90000141', { azt: '' }), odt('90000142', { azt: AZT_2, jefe: '', jefePlan: '' }), odt('90000143')]));
    const a = D.analizarResponsable(l, RESP_A);
    assert.equal(a.sinAzt, 1); assert.equal(a.sinJefe, 1);
    assert.deepEqual(D.opcionesConConteo(a.odts, 'azt'), [{ valor: AZT_1, n: 1 }, { valor: AZT_2, n: 1 }, { valor: SIN_DATO, n: 1 }]);
    assert.deepEqual(D.opcionesConConteo(a.odts, 'jefe'), [{ valor: JEFE_1, n: 2 }, { valor: SIN_DATO, n: 1 }]);
    const av = D.avisosDeLectura(l, a).join(' | ');
    assert.match(av, /1 ODT no traen AZT en sitio: en su filtro salen como «\(sin dato\)»\./);
    assert.match(av, /1 ODT no traen jefe de trabajo \(ni en sitio ni asignado\)/);
    assert.deepEqual(nros(D.filtrar(a.odts, { azt: SIN_DATO })), ['90000141']);
    assert.deepEqual(nros(D.filtrar(a.odts, { jefe: SIN_DATO })), ['90000142']);
  });
  test('distintos entre las filas de una ODT: se toma el de la PRIMERA fila y se avisa (como estado y contratista)', () => {
    const l = D.leerCsv(csv([
      odt('90000151', { azt: AZT_1, jefe: JEFE_1 }), odt('90000151', { azt: AZT_2, jefe: JEFE_1 }),
      odt('90000152', { azt: AZT_2, jefe: JEFE_2 }), odt('90000152', { azt: AZT_2, jefe: JEFE_3 }),
      // Mismo jefe por dos caminos (en sitio vacío + asignado, y en sitio): no es distinto.
      odt('90000153', { jefe: '', jefePlan: JEFE_3 }), odt('90000153', { jefe: JEFE_3 })
    ]));
    const a = D.analizarResponsable(l, RESP_A);
    const o = Object.fromEntries(a.odts.map((x) => [x.nro, x]));
    assert.equal(o['90000151'].azt, AZT_1); assert.equal(o['90000152'].jefe, JEFE_2);
    assert.deepEqual(a.conflictos.map((c) => [c.nro, c.campo, c.primero, c.otro]), [['90000151', 'azt', AZT_1, AZT_2], ['90000152', 'jefe', JEFE_2, JEFE_3]]);
    const av = D.avisosDeLectura(l, a);
    assert.ok(av.includes('1 ODT vienen con AZT en sitio distintos en sus filas; se tomó el de la primera: 90000151.'), av.join(' | '));
    assert.ok(av.includes('1 ODT vienen con jefes de trabajo distintos en sus filas; se tomó el de la primera: 90000152.'), av.join(' | '));
  });
});

describe('dominio: filtros por AZT y por jefe, combinados, y sus opciones con conteo', () => {
  const A = D.analizarResponsable(D.leerCsv(archivoBase()), RESP_A);
  test('cada uno solo y combinados con tipo, zona y contratista', () => {
    assert.deepEqual(nros(D.filtrar(A.odts, { azt: AZT_2 })), ['90000003', '90000004', '90000006']);
    assert.deepEqual(nros(D.filtrar(A.odts, { jefe: JEFE_3 })), ['90000005', '90000006']);
    assert.deepEqual(nros(D.filtrar(A.odts, { azt: AZT_2, jefe: JEFE_1 })), ['90000004']);
    assert.deepEqual(nros(D.filtrar(A.odts, { azt: AZT_1, empresa: BETA })), ['90000005', '90000007']);
    assert.deepEqual(nros(D.filtrar(A.odts, { jefe: JEFE_2, tipo: 'TIPO DOS' })), ['90000003', '90000008']);
    assert.deepEqual(nros(D.filtrar(A.odts, { azt: AZT_2, zona: 'ZONA SUR', empresa: BETA, tipo: 'TIPO UNO', jefe: JEFE_3 })), ['90000006']);
    assert.deepEqual(D.filtrar(A.odts, { azt: 'NADIE' }), []);
    assert.equal(D.filtrar(A.odts, { azt: '', jefe: '' }).length, 8, 'vacío = todos');
    // Los agregados de lo filtrado (lo que pintan tarjetas y tablas).
    assert.deepEqual(cuenta(D.agregar(D.filtrar(A.odts, { azt: AZT_2 })).totales), [3, 0, 1, 0, 2, 0, 0]);
    // La lista de un número también filtra por ellos.
    assert.deepEqual(nros(D.seleccionar(A.odts, { azt: AZT_2, clave: 'cerrada' })), ['90000004', '90000006']);
    assert.deepEqual(nros(D.seleccionar(A.odts, { jefe: JEFE_1, empresa: ALFA, clave: 'total' })), ['90000001', '90000004']);
  });
  test('opciones: cada persona con su conteo, por nombre; las sumas dan el total del corte', () => {
    const o = D.opcionesFiltro(A.odts);
    assert.deepEqual(o.azts, [{ valor: AZT_1, n: 5 }, { valor: AZT_2, n: 3 }]);
    assert.deepEqual(o.jefes, [{ valor: JEFE_3, n: 2 }, { valor: JEFE_1, n: 3 }, { valor: JEFE_2, n: 3 }]);
    for (const xs of [o.azts, o.jefes]) assert.equal(xs.reduce((s, x) => s + x.n, 0), A.odts.length);
    // Lo de antes no cambia (textos sin conteo).
    assert.deepEqual(o.tipos, ['TIPO DOS', 'TIPO UNO']);
  });
  test('un corte de la versión 1 (sus ODT no traen azt ni jefe) no los tiene; uno de la 2, sí', () => {
    assert.equal(D.VERSION_CORTE, 2);
    assert.equal(D.corteTraeAztJefe({ version: 1 }), false);
    assert.equal(D.corteTraeAztJefe({ version: 2 }), true);
    assert.equal(D.corteTraeAztJefe({}), false);
    assert.equal(D.corteTraeAztJefe(null), false);
    // Las ODT de la versión 1 (sin los campos) caen en «(sin dato)»: por eso la pantalla deshabilita esos filtros.
    assert.deepEqual(D.opcionesConConteo([{ nro: '90000161' }], 'azt'), [{ valor: SIN_DATO, n: 1 }]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('datos: versión 2 del corte (ODT de 11 campos) y lectura de los de la versión 1', () => {
  const lectura = D.leerCsv(archivoBase());
  const analisis = D.analizarResponsable(lectura, RESP_A);
  const plan = (a = analisis) => planCorte({ id: ID, archivo: { nombre: 'INFORME_ODT_20260101000000_prueba.csv', bytes: 10, sha256: HEX }, lectura, analisis: a, por: ADMIN, ts: TS });
  const v2 = (nro, extra = {}) => ({ nro, empresa: ALFA, tipo: 'TIPO UNO', zona: 'ZONA NORTE', subestacion: 'S/E PRUEBA UNO', prevista: '2026-03-15', cerrada: '', estado: 'GENERADA', principal: true, azt: AZT_1, jefe: JEFE_1, ...extra });
  const v1 = (nro) => { const { azt, jefe, ...resto } = v2(nro); return resto; };
  test('planCorte: version 2 y CADA ODT con los 11 campos (azt y jefe, textos de hasta 200)', () => {
    const p = plan();
    assert.equal(p.corte.version, 2);
    assert.equal(Object.keys(p.corte).length, 17, 'el corte sigue con los mismos 17 campos');
    assert.deepEqual([...CAMPOS_ODT_POR_VERSION[2]], [...CAMPOS_ODT_POR_VERSION[1], 'azt', 'jefe']);
    for (const o of p.partes[0].odts) {
      assert.deepEqual(Object.keys(o), [...CAMPOS_ODT_POR_VERSION[2]]);
      assert.ok(odtValida(o, 2));
    }
    assert.deepEqual(p.partes[0].odts.filter((o) => o.nro === '90000005').map((o) => [o.azt, o.jefe]), [[AZT_1, JEFE_3]]);
    // Un AZT de más de 200 letras se recorta (como los demás textos), también en la ÚLTIMA ODT.
    const largo = { ...analisis, odts: analisis.odts.map((o, i) => (i === analisis.odts.length - 1 ? { ...o, azt: 'A'.repeat(300), jefe: '  J  ' } : o)) };
    const u = plan(largo).partes[0].odts.at(-1);
    assert.equal(u.azt.length, 200); assert.equal(u.jefe, 'J');
  });
  test('odtValida: la forma de su versión (9 o 11 campos); sin versión, cualquiera de las dos', () => {
    assert.equal(odtValida(v2('90000171'), 2), true);
    assert.equal(odtValida(v1('90000171'), 1), true);
    assert.equal(odtValida(v2('90000171'), 1), false, 'una de 11 en un corte de la versión 1');
    assert.equal(odtValida(v1('90000171'), 2), false, 'una de 9 en un corte de la versión 2');
    assert.equal(odtValida(v1('90000171')), true); assert.equal(odtValida(v2('90000171')), true);
    for (const mal of [{ azt: 7 }, { azt: null }, { jefe: 'J'.repeat(201) }, { azt: ['x'] }]) assert.equal(odtValida(v2('90000171', mal), 2), false, JSON.stringify(mal).slice(0, 40));
    assert.equal(odtValida(v2('90000171', { azt: '', jefe: 'J'.repeat(200) }), 2), true);
    const sinJefe = v2('90000171'); delete sinJefe.jefe;
    assert.equal(odtValida(sinJefe), false, '10 campos: ninguna de las dos formas');
    assert.equal(odtValida({ ...v2('90000171'), extra: 1 }), false);
  });
  test('unirPartes: un corte de la versión 1 se lee con sus ODT de 9 campos; uno de la 2, con las de 11', () => {
    const parte = (odts) => [{ id: '0', data: { k: 0, odts } }];
    const r1 = unirPartes({ nPartes: 1, odts: 2, version: 1 }, parte([v1('90000181'), v1('90000182')]));
    assert.equal(r1.completo, true); assert.equal(r1.descartadas, 0);
    const r2 = unirPartes({ nPartes: 1, odts: 2, version: 2 }, parte([v2('90000181'), v2('90000182')]));
    assert.equal(r2.completo, true); assert.deepEqual(r2.odts.map((o) => o.azt), [AZT_1, AZT_1]);
    // Mezcladas: la que no es de la versión del corte se descarta (y el corte no queda completo).
    const m = unirPartes({ nPartes: 1, odts: 2, version: 2 }, parte([v2('90000181'), v1('90000182')]));
    assert.equal(m.descartadas, 1); assert.equal(m.completo, false);
    const m1 = unirPartes({ nPartes: 1, odts: 2, version: 1 }, parte([v2('90000181'), v1('90000182')]));
    assert.equal(m1.descartadas, 1); assert.equal(m1.completo, false);
  });
  test('el repositorio: guarda la versión 2 y lee también un corte de la versión 1 ya guardado', async () => {
    const fs = conConsultas(crearFirestoreFalso());
    const repo = crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => ADMIN, tiempoLoteMs: 30 });
    const g = await repo.guardar({ archivo: { nombre: 'INFORME_ODT_20260101000000_prueba.csv', bytes: 10, sha256: HEX }, lectura, analisis });
    const datos = fs.lotes[0].ops.map((o) => o.datos);
    assert.equal(datos[0].version, 2);
    assert.ok(datos[1].odts.every((o) => Object.keys(o).length === 11));
    const l2 = await repo.leer(g.id);
    assert.equal(l2.completo, true); assert.equal(l2.odts[0].azt, AZT_1);
    aVersion1(fs, g.id);
    const l1 = await repo.leer(g.id);
    assert.equal(l1.corte.version, 1);
    assert.equal(l1.completo, true, 'el corte de la versión 1 sigue completo');
    assert.ok(l1.odts.every((o) => Object.keys(o).length === 9));
  });
});

/** Deja un corte guardado como los de la VERSIÓN 1 (lo que hay en producción antes del 2026-11-24): sin azt ni jefe. */
function aVersion1(fs, id) {
  const ruta = 'odt_afinia_cortes/' + id;
  const c = fs.store.get(ruta);
  fs.store.set(ruta, { ...c, version: 1 });
  for (let k = 0; k < c.nPartes; k++) {
    const p = fs.store.get(ruta + '/partes/' + k);
    fs.store.set(ruta + '/partes/' + k, { ...p, odts: p.odts.map(({ azt, jefe, ...resto }) => resto) });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Pantalla, con el doble de DOM (estricto como el navegador al agregar hijos) y el doble de Firestore con consultas.
let guardadoDoc; let dom; let proto; const originales = {};
before(() => {
  guardadoDoc = globalThis.document;
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
  if (guardadoDoc === undefined) delete globalThis.document; else globalThis.document = guardadoDoc;
});

const { montarIndicadores } = await import('../assets/js/ui/odt-afinia/indicadores.js');
const { NOTA_SIN_AZT_JEFE, NOTA_COMPARAR_SIN_AZT_JEFE, NOTA_COMPARAR_PERSONA, NOTA_SIN_RESULTADOS, NOTA_CONTEO_PERSONA, SIN_GRAFICO_CONTRATISTA } = await import('../assets/js/ui/odt-afinia/indicadores-vista.js');
const { montarCargar, textoPersonas } = await import('../assets/js/ui/odt-afinia/indicadores-cargar.js');

const caja = () => document.createElement('div');
const botones = (el) => el.todos().filter((x) => x.tagName === 'BUTTON');
const boton = (el, texto) => botones(el).find((b) => b.textContent.includes(texto));
const porId = (el, id) => el.todos().find((x) => x.id === id);
const visible = (el) => { for (let n = el; n; n = n.parentNode) if (n.hidden) return false; return true; };
const opcionesDe = (sel) => sel.childNodes.map((o) => o.textContent);
const tarjetas = (c) => c.querySelectorAll('.odt-ind-tarjeta-valor').map((x) => x.textContent);
const lista = (c) => c.querySelectorAll('.odt-ind-lista')[0];
const filasLista = (c) => lista(c).todos().filter((x) => x.tagName === 'TR').slice(1).map((tr) => tr.childNodes.map((td) => td.textContent));
const encabezadosLista = (c) => lista(c).todos().filter((x) => x.tagName === 'TH' && x.getAttribute('scope') === 'col').map((x) => x.textContent);
const tablaPorCaption = (c, t) => c.querySelectorAll('.odt-ind-tabla').find((x) => (x.todos().find((y) => y.tagName === 'CAPTION') || {}).textContent === t);
async function hasta(cond, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('no se cumplió a tiempo'); await new Promise((r) => setTimeout(r, 5)); }
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
const repoDe = (fs) => crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => ADMIN, tiempoLoteMs: 30 });
async function guardarCorte(fs, texto, nombre = 'INFORME_ODT_20260410080000_prueba.csv') {
  const l = D.leerCsv(texto);
  return repoDe(fs).guardar({ archivo: { nombre, bytes: texto.length, sha256: HEX }, lectura: l, analisis: D.analizarResponsable(l, RESP_A) });
}
async function montar(fs, p = {}) {
  const c = caja();
  const r = await montarIndicadores(c, { repoCortes: repoDe(fs), sesion: ADMIN, alIr: () => {}, ...p });
  return { c, r };
}
async function elegir(c, id, valor) { const s = porId(c, id); s.value = valor; await s.disparar('change'); return s; }

describe('pantalla: los filtros «AZT en sitio» y «Jefe de trabajo»', () => {
  test('están junto a los demás, con «Todos» y cada persona con su conteo (por nombre)', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    const azt = porId(c, 'odtIndAzt'); const jefe = porId(c, 'odtIndJefe');
    assert.ok(azt && jefe, 'los dos filtros');
    const filtros = c.querySelectorAll('.odt-ind-filtros')[0];
    assert.deepEqual(filtros.todos().filter((x) => x.tagName === 'LABEL').map((x) => x.textContent), ['Tipo de trabajo', 'Zona', 'Contratista', 'AZT en sitio', 'Jefe de trabajo']);
    assert.deepEqual(filtros.todos().filter((x) => x.tagName === 'LABEL').map((x) => x.htmlFor), ['odtIndTipo', 'odtIndZona', 'odtIndEmpresa', 'odtIndAzt', 'odtIndJefe']);
    assert.deepEqual(opcionesDe(azt), ['Todos', AZT_1 + ' · 5 ODT', AZT_2 + ' · 3 ODT']);
    assert.deepEqual(opcionesDe(jefe), ['Todos', JEFE_3 + ' · 2 ODT', JEFE_1 + ' · 3 ODT', JEFE_2 + ' · 3 ODT']);
    assert.deepEqual(azt.childNodes.map((o) => o.value), ['', AZT_1, AZT_2], 'el valor es el nombre');
    assert.equal(azt.disabled, false); assert.equal(jefe.disabled, false);
    assert.ok(!c.textContent.includes(NOTA_SIN_AZT_JEFE));
    sinRestos(c);
  });
  test('se combinan con los demás: tarjetas, tablas y resumen responden; «Quitar filtros» los limpia también', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    const azt = await elegir(c, 'odtIndAzt', AZT_2);
    const resumen = () => c.querySelectorAll('.odt-ind-resumen-filtro')[0].textContent;
    assert.equal(resumen(), 'Con filtros (AZT en sitio: ' + AZT_2 + '): 3 de 8 ODT.', 'un solo filtro por persona: su número y las tarjetas coinciden');
    assert.deepEqual(tarjetas(c), ['3', '0', '1', '2', '0', '66,7 %']);
    const porContratista = () => c.querySelectorAll('.odt-ind-tabla-contratistas')[0].todos().filter((x) => x.tagName === 'TBODY')[0].childNodes.map((tr) => tr.childNodes[0].textContent);
    assert.deepEqual(porContratista(), [ALFA, BETA]);
    const jefe = await elegir(c, 'odtIndJefe', JEFE_1);
    // Con otro filtro al lado, el número de cada persona (de todo el corte) ya no es el de las tarjetas: se aclara.
    assert.equal(resumen(), 'Con filtros (AZT en sitio: ' + AZT_2 + ' · Jefe de trabajo: ' + JEFE_1 + '): 1 de 8 ODT. ' + NOTA_CONTEO_PERSONA);
    assert.deepEqual(tarjetas(c), ['1', '0', '0', '1', '0', '100,0 %']);
    // Con contratista: AZT_1 + BETA (una no ejecutada y una inactiva: el % no aplica).
    await elegir(c, 'odtIndJefe', '');
    await elegir(c, 'odtIndAzt', AZT_1);
    await elegir(c, 'odtIndEmpresa', BETA);
    assert.deepEqual(tarjetas(c), ['2', '0', '0', '0', '2', '—']);
    assert.ok(resumen().endsWith('2 de 8 ODT. ' + NOTA_CONTEO_PERSONA), resumen());
    // Por tipo y por zona también: con AZT_1 + BETA, TIPO UNO (90000005) y TIPO DOS (90000007).
    const tipos = tablaPorCaption(c, 'Por tipo de trabajo').todos().filter((x) => x.tagName === 'TBODY')[0].childNodes.map((tr) => [tr.childNodes[0].textContent, tr.childNodes[1].textContent]);
    assert.deepEqual(tipos.sort(), [['TIPO DOS', '1'], ['TIPO UNO', '1']]);
    assert.ok(!c.textContent.includes(NOTA_SIN_RESULTADOS));
    // Una combinación sin ODT no rompe nada, y el resumen lo dice (con de dónde sale el número de cada persona).
    await elegir(c, 'odtIndJefe', JEFE_2);
    assert.ok(c.textContent.includes('0 de 8 ODT. ' + NOTA_SIN_RESULTADOS + ' ' + NOTA_CONTEO_PERSONA));
    assert.ok(c.textContent.includes('Sin fechas para la evolución mensual.'));
    // Sin ODT tampoco hay gráfico por contratista: lo dice en llano (antes quedaba la palabra «null» suelta).
    assert.ok(c.textContent.includes(SIN_GRAFICO_CONTRATISTA));
    sinRestos(c);
    // Sin filtro por persona (TIPO DOS + ZONA SUR: ninguna), solo la primera frase.
    await elegir(c, 'odtIndJefe', ''); await elegir(c, 'odtIndAzt', '');
    await elegir(c, 'odtIndTipo', 'TIPO DOS'); await elegir(c, 'odtIndZona', 'ZONA SUR');
    const r0 = c.querySelectorAll('.odt-ind-resumen-filtro')[0].textContent;
    assert.ok(r0.endsWith('0 de 8 ODT. ' + NOTA_SIN_RESULTADOS), r0);
    assert.ok(c.textContent.includes(SIN_GRAFICO_CONTRATISTA));
    sinRestos(c);
    await boton(c, 'Quitar filtros').disparar('click');
    assert.ok(c.textContent.includes('Sin filtros: las 8 ODT del corte.'));
    assert.equal(azt.value, ''); assert.equal(jefe.value, ''); assert.equal(porId(c, 'odtIndEmpresa').value, '');
    assert.deepEqual(tarjetas(c), ['8', '1', '1', '3', '2', '50,0 %', '1']);
    sinRestos(c);
  });
  test('la lista de ODT de un número suma las columnas «AZT» y «Jefe de trabajo», y respeta esos filtros', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    await elegir(c, 'odtIndAzt', AZT_2);
    await botones(c).find((b) => b.getAttribute('aria-label') === 'Ver las 2 ODT: Cerradas').disparar('click');
    const tituloLista = () => lista(c).querySelectorAll('.odt-ind-lista-titulo')[0].textContent;
    assert.equal(tituloLista(), 'ODT · Cerradas · AZT en sitio: ' + AZT_2 + ' (2)', 'el título nombra el filtro activo');
    assert.deepEqual(encabezadosLista(c),['N.º', 'Contratista', 'Subestación', 'Tipo de trabajo', 'AZT', 'Jefe de trabajo', 'Fecha prevista', 'Estado en Afinia', 'Fecha de cierre', 'Estado en SGM']);
    assert.deepEqual(filasLista(c).map((f) => f.slice(0, 6)), [
      ['90000004', ALFA, 'S/E PRUEBA UNO', 'TIPO DOS', AZT_2, JEFE_1],
      ['90000006', BETA, 'S/E PRUEBA UNO', 'TIPO UNO', AZT_2, JEFE_3]
    ]);
    // Cada celda lleva el nombre de su columna: si la caja mide menos de 1000 px (1280 o 1100 px con el menú, o
    // celular), va como fichas.
    const tds = lista(c).todos().filter((x) => x.tagName === 'TD');
    assert.ok(tds.length === 18 && tds.every((td) => td.getAttribute('data-etq')), 'celda sin data-etq');
    assert.deepEqual(lista(c).todos().filter((x) => x.tagName === 'TR')[1].childNodes.slice(1).map((td) => td.getAttribute('data-etq')), encabezadosLista(c).slice(1));
    // Con el filtro del jefe, la lista se rehace con los dos filtros.
    await elegir(c, 'odtIndJefe', JEFE_3);
    await botones(c).find((b) => b.getAttribute('aria-label') === 'Ver las 1 ODT: Cerradas').disparar('click');
    assert.deepEqual(filasLista(c).map((f) => f[0]), ['90000006']);
    assert.equal(tituloLista(), 'ODT · Cerradas · AZT en sitio: ' + AZT_2 + ' · Jefe de trabajo: ' + JEFE_3 + ' (1)');
    // Un número de la tabla por contratista ya dice su contratista: con ese mismo filtro, no se repite.
    await elegir(c, 'odtIndJefe', '');
    await elegir(c, 'odtIndEmpresa', BETA);
    await botones(c).find((b) => (b.getAttribute('aria-label') || '').startsWith('Ver 1 ODT cerradas · ' + BETA)).disparar('click');
    assert.equal(tituloLista(), 'ODT · Cerradas · ' + BETA + ' · AZT en sitio: ' + AZT_2 + ' (1)');
    sinRestos(c);
  });
  test('«(sin dato)»: opción al final con su conteo; filtrar por ella y la lista lo muestra', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, csv([odt('90000191', { azt: '' }), odt('90000192', { azt: AZT_2, estado: 'CERRADA', cerrada: '02/03/2026 08:00' })]));
    const { c } = await montar(fs);
    assert.deepEqual(opcionesDe(porId(c, 'odtIndAzt')), ['Todos', AZT_2 + ' · 1 ODT', SIN_DATO + ' · 1 ODT']);
    await elegir(c, 'odtIndAzt', SIN_DATO);
    assert.ok(c.textContent.includes('1 de 2 ODT.'));
    await botones(c).find((b) => b.getAttribute('aria-label') === 'Ver las 1 ODT: Generadas').disparar('click');
    assert.deepEqual(filasLista(c).map((f) => [f[0], f[4]]), [['90000191', SIN_DATO]]);
  });
});

describe('pantalla: un corte de la VERSIÓN 1 (guardado antes del AZT y del jefe)', () => {
  test('los dos filtros salen deshabilitados, con la nota clara; la lista no suma columnas vacías; lo demás funciona', async () => {
    const fs = nuevoFs();
    const g = await guardarCorte(fs, archivoBase());
    aVersion1(fs, g.id);
    const { c, r } = await montar(fs, { vista: 'corte', corteId: g.id });
    assert.equal(r.corte.version, 1);
    for (const id of ['odtIndAzt', 'odtIndJefe']) {
      const s = porId(c, id);
      assert.equal(s.disabled, true, id + ' deshabilitado');
      assert.deepEqual(opcionesDe(s), ['Todos']);
      assert.equal(s.getAttribute('aria-describedby'), 'odtIndNotaAztJefe', 'el lector de pantalla lee la nota');
    }
    const nota = porId(c, 'odtIndNotaAztJefe');
    assert.equal(nota.textContent, 'Este corte se guardó antes de que se guardaran el AZT y el jefe de trabajo. Para filtrar por ellos, cargue un corte nuevo.');
    assert.equal(nota.textContent, NOTA_SIN_AZT_JEFE);
    assert.ok(c.querySelectorAll('.odt-ind-filtros')[0].todos().includes(nota), 'junto a los filtros');
    // Los otros filtros siguen; la lista va sin AZT ni jefe.
    await elegir(c, 'odtIndEmpresa', BETA);
    assert.ok(c.textContent.includes('3 de 8 ODT.'));
    await botones(c).find((b) => b.getAttribute('aria-label') === 'Ver las 3 ODT: Generadas').disparar('click');
    assert.ok(!encabezadosLista(c).includes('AZT') && !encabezadosLista(c).includes('Jefe de trabajo'), encabezadosLista(c).join(' | '));
    assert.equal(filasLista(c).length, 3);
    await boton(c, 'Quitar filtros').disparar('click');
    assert.ok(c.textContent.includes('Sin filtros: las 8 ODT del corte.'));
    assert.ok(!c.textContent.includes('INCOMPLETO'), 'el corte de la versión 1 se lee completo');
    sinRestos(c);
  });
});

describe('pantalla: comparación con un corte anterior de la versión 1', () => {
  const despues = () => archivoBase().replace(/90000001\|SI\|([^\r]*)\|GENERADA\|/, '90000001|SI|$1|EJECUTADA|');
  test('sigue comparando (por N.º, estado y contratista); con un filtro por AZT o por jefe, lo dice en una línea en vez de números', async () => {
    const fs = nuevoFs();
    const viejo = await guardarCorte(fs, archivoBase(), 'INFORME_ODT_20260401080000_antes.csv');
    aVersion1(fs, viejo.id);
    await guardarCorte(fs, despues(), 'INFORME_ODT_20260410080000_despues.csv');
    const { c, r } = await montar(fs);
    await r.vista.anterior;
    const zona = () => c.querySelectorAll('.odt-ind-seccion').find((x) => x.getAttribute('aria-label') === 'Comparación con el corte anterior');
    await hasta(() => zona().textContent.includes('ODT que cambiaron de estado (1)'));
    assert.ok(tablaPorCaption(zona(), 'Por estado'));
    // Con contratista (no es AZT ni jefe) sí se compara.
    await elegir(c, 'odtIndEmpresa', ALFA);
    assert.ok(zona().textContent.includes('ODT que cambiaron de estado (1)'));
    // Con el AZT: no se compara (el anterior no lo guardó); ni tablas ni listas con números.
    await elegir(c, 'odtIndAzt', AZT_1);
    assert.ok(zona().textContent.includes(NOTA_COMPARAR_SIN_AZT_JEFE), zona().textContent);
    assert.ok(zona().textContent.includes('Corte anterior: datos del 01/04/2026 08:00'), 'dice cuál es el anterior');
    assert.equal(tablaPorCaption(zona(), 'Por estado'), undefined);
    assert.ok(!zona().textContent.includes('ODT que cambiaron de estado'));
    await elegir(c, 'odtIndAzt', '');
    await elegir(c, 'odtIndJefe', JEFE_1);
    assert.ok(zona().textContent.includes(NOTA_COMPARAR_SIN_AZT_JEFE));
    await boton(c, 'Quitar filtros').disparar('click');
    assert.ok(!zona().textContent.includes(NOTA_COMPARAR_SIN_AZT_JEFE));
    assert.ok(tablaPorCaption(zona(), 'Por estado'));
    sinRestos(c);
  });
  test('entre dos cortes de la versión 2, el filtro por AZT se aplica a los dos', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase(), 'INFORME_ODT_20260401080000_antes.csv');
    await guardarCorte(fs, despues(), 'INFORME_ODT_20260410080000_despues.csv');
    const { c, r } = await montar(fs);
    await r.vista.anterior;
    const zona = () => c.querySelectorAll('.odt-ind-seccion').find((x) => x.getAttribute('aria-label') === 'Comparación con el corte anterior');
    await hasta(() => zona().textContent.includes('ODT que cambiaron de estado (1)'));
    assert.ok(!zona().textContent.includes(NOTA_COMPARAR_PERSONA), 'sin filtro por persona, sin la línea');
    await elegir(c, 'odtIndAzt', AZT_2);     // la 90000001 (la que cambió) es de AZT_1
    assert.ok(zona().textContent.includes('ODT que cambiaron de estado (0)'));
    assert.ok(!zona().textContent.includes(NOTA_COMPARAR_SIN_AZT_JEFE));
    assert.ok(zona().textContent.includes(NOTA_COMPARAR_PERSONA), 'avisa que una ODT que cambió de persona sale como nueva o como salida');
    await elegir(c, 'odtIndAzt', AZT_1);
    assert.ok(zona().textContent.includes('ODT que cambiaron de estado (1)'));
    await elegir(c, 'odtIndAzt', ''); await elegir(c, 'odtIndJefe', JEFE_1);
    assert.ok(zona().textContent.includes(NOTA_COMPARAR_PERSONA));
    await elegir(c, 'odtIndJefe', ''); await elegir(c, 'odtIndEmpresa', ALFA);
    assert.ok(!zona().textContent.includes(NOTA_COMPARAR_PERSONA), 'con contratista, como antes');
  });
});

describe('pantalla: la vista previa de la carga', () => {
  const NOMBRE = 'INFORME_ODT_20260410080000_prueba.csv';
  const archivo = (texto) => { const b = latin1(texto); return { name: NOMBRE, size: b.length, arrayBuffer: async () => b.buffer.slice(0) }; };
  async function cargar(texto, historial = []) {
    const fs = nuevoFs(); const c = caja(); const idas = [];
    montarCargar(c, { repoCortes: repoDe(fs), sesion: ADMIN, historial, alIr: (a) => idas.push(a), pausa: async () => {} });
    const entrada = porId(c, 'odtIndArchivo');
    entrada.files = [archivo(texto)]; await entrada.disparar('change');
    return { fs, c, idas };
  }
  const dd = (c, t) => { const dt = c.todos().find((x) => x.tagName === 'DT' && x.textContent === t); return dt ? dt.parentNode.childNodes[1].textContent : null; };
  test('cuenta las personas (AZT en sitio y jefes de trabajo) y guarda la versión 2 con el AZT y el jefe de cada ODT', async () => {
    const { fs, c, idas } = await cargar(archivoBase());
    assert.equal(dd(c, 'AZT en sitio'), '2 personas');
    assert.equal(dd(c, 'Jefes de trabajo'), '3 personas');
    assert.ok(!/AZT en sitio distintos|jefes de trabajo distintos|no traen AZT|no traen jefe|no trae la columna|no trae las columnas/.test(c.textContent), 'nada que avisar del AZT ni del jefe');
    await boton(c, 'Guardar corte').disparar('click');
    await boton(c, 'Sí, guardar el corte').disparar('click');
    assert.equal(idas.length, 1);
    const [corte, parte] = fs.lotes[0].ops.map((o) => o.datos);
    assert.equal(corte.version, 2);
    assert.deepEqual(parte.odts.map((o) => [o.nro, o.azt, o.jefe]).find((x) => x[0] === '90000005'), ['90000005', AZT_1, JEFE_3]);
    sinRestos(c);
  });
  test('avisa si el archivo no trae las columnas, si una ODT trae AZT distintos entre filas y cuántas vienen sin dato', async () => {
    const fuera = sinColumnas('AZT EN SITIO', 'JEFE DE TRABAJO EN SITIO', 'JEFE DE TRABAJO');
    const a = await cargar(conColumnas(fuera, [odt('90000201'), odt('90000202')]));
    assert.equal(dd(a.c, 'AZT en sitio'), 'No viene en el archivo');
    assert.equal(dd(a.c, 'Jefes de trabajo'), 'No viene en el archivo');
    assert.ok(a.c.textContent.includes(D.MSG_SIN_COLUMNA_AZT) && a.c.textContent.includes(D.MSG_SIN_COLUMNA_JEFE));
    assert.ok(visible(boton(a.c, 'Guardar corte')), 'se puede guardar igual');
    const b = await cargar(csv([odt('90000211', { azt: AZT_1 }), odt('90000211', { azt: AZT_2 }), odt('90000212', { azt: '' })]));
    assert.ok(b.c.textContent.includes('1 ODT vienen con AZT en sitio distintos en sus filas; se tomó el de la primera: 90000211.'));
    assert.ok(b.c.textContent.includes('1 ODT no traen AZT en sitio'));
    assert.equal(dd(b.c, 'AZT en sitio'), '1 persona · 1 ODT sin dato');
    sinRestos(a.c); sinRestos(b.c);
  });
  test('el mismo archivo ya guardado como corte de la VERSIÓN 1: no dice «dos cortes iguales» (el nuevo trae el AZT y el jefe)', async () => {
    const texto = archivoBase();
    const sha = createHash('sha256').update(Buffer.from(latin1(texto))).digest('hex');
    const ya = (id, version) => ({ id: id.repeat(20), responsable: RESP_A, archivo: { sha256: sha }, creadoEnMs: Date.UTC(2026, 10, 20, 15), version });
    const IGUALES = 'Si lo guarda otra vez, quedan dos cortes iguales en el historial.';
    const SIN = 'pero sin el AZT en sitio y el jefe de trabajo. Este corte nuevo sí los trae: guárdelo para poder filtrar por ellos.';
    const v1 = await cargar(texto, [ya('X', 1)]);
    assert.ok(v1.c.textContent.includes('Este mismo archivo ya se guardó como corte de este responsable el ') && v1.c.textContent.includes(SIN), v1.c.textContent);
    assert.ok(!v1.c.textContent.includes(IGUALES));
    assert.ok(visible(boton(v1.c, 'Guardar corte')), 'se puede guardar');
    const v2 = await cargar(texto, [ya('Y', 2)]);
    assert.ok(v2.c.textContent.includes(IGUALES) && !v2.c.textContent.includes(SIN));
    // Si ya está también el de la versión 2, sí quedarían dos iguales.
    const ambos = await cargar(texto, [ya('X', 1), ya('Y', 2)]);
    assert.ok(ambos.c.textContent.includes(IGUALES) && !ambos.c.textContent.includes(SIN));
    // Un archivo SIN las columnas del AZT y del jefe: el corte nuevo tampoco los trae (serían iguales).
    const fuera = conColumnas(sinColumnas('AZT EN SITIO', 'JEFE DE TRABAJO EN SITIO', 'JEFE DE TRABAJO'), [odt('90000221'), odt('90000222')]);
    const shaF = createHash('sha256').update(Buffer.from(latin1(fuera))).digest('hex');
    const f = await cargar(fuera, [{ ...ya('Z', 1), archivo: { sha256: shaF } }]);
    assert.ok(f.c.textContent.includes(IGUALES) && !f.c.textContent.includes(SIN), f.c.textContent);
    sinRestos(v1.c);
  });
  test('textoPersonas: en llano', () => {
    assert.equal(textoPersonas([], 'azt', false), 'No viene en el archivo');
    assert.equal(textoPersonas([{ azt: AZT_1 }, { azt: AZT_2 }, { azt: AZT_1 }], 'azt', true), '2 personas');
    assert.equal(textoPersonas([{ jefe: '' }], 'jefe', true), '0 personas · 1 ODT sin dato');
  });
});
