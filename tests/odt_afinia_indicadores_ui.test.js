// Firma de ODT Afinia · INDICADORES · PANTALLA con el doble de DOM (tests/odt_afinia_ui_dobles.js, más createElementNS
// para el SVG, y focus / scrollIntoView para seguir el foco) y el repositorio de cortes sobre el doble de Firestore con
// consultas (conConsultas, del fixture), sin navegador:
//   · anclas #indicadores, #indicadores=<id>, #indicadores-cargar; la pestaña solo la ve el administrador;
//   · sin cortes: cómo cargar el primero; con cortes: tarjetas, definiciones justo debajo, tabla por contratista con
//     fila de total, gráficos SVG, tipo y zona (sus columnas SUMAN el total), historial;
//   · #indicadores abre el último corte DE LA PERSONA DE LA SESIÓN (aunque no esté entre los 50 más recientes);
//   · un número abre la lista de esas ODT (con Contratista si las mezcla) y su estado en SGM, consultado POR N.º:
//     «No está en SGM» si se consultó y no está, «Sin consultar» si no se pudo consultar;
//   · los filtros recalculan; los encabezados ordenan (y el foco vuelve al encabezado); «Cerrar la lista» devuelve el
//     foco a quien la abrió (centrado); al navegar, el título del corte (o el aviso «Corte guardado») queda con el foco,
//     y lo que queda debajo de la barra superior FIJA de la página cuenta como oculto (se desplaza hasta él);
//   · la comparación con el corte anterior (su propia consulta, también fuera de los 50 del historial), con el % de
//     cierre por contratista; el historial pagina de 50 en 50 (el foco pasa al primer corte que llega) y va como fichas
//     en un celular; #indicadores encuentra el corte propio aunque el nombre lleve Ñ;
//   · cargar: archivo → vista previa (responsable por defecto = el del perfil; el selector no se rehace al cambiarlo) →
//     «Guardar corte» en dos pasos (con el foco en cada paso) → abre el corte; al terminar de leer, el foco pasa a
//     «Vista previa»; la tabla por contratista trae «Otro estado» si hay; un archivo equivocado se dice así; el
//     mismo archivo ya guardado (por su huella, en el servidor) y un archivo más viejo que el último corte se avisan;
//     ninguna vista deja «null» pintado.
// Datos INVENTADOS.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crearDomFalso, crearFirestoreFalso } from './odt_afinia_ui_dobles.js';
import { crearRepositorioCortes } from '../assets/js/data/odt_afinia_cortes.js';
import { leerCsv, analizarResponsable, ENCABEZADOS_AFINIA, MSG_OTRO_ARCHIVO, SGM_NO_ESTA, SGM_SIN_CONSULTAR } from '../assets/js/domain/odt_afinia_indicadores.js';
import { RESP_A, RESP_A_PERFIL, RESP_B, ALFA, BETA, GAMMA, AZT_1, AZT_2, JEFE_1, JEFE_2, JEFE_3, archivoBase, csv, odt, fila, latin1, conConsultas } from './odt_afinia_indicadores_fixture.js';

let guardado; let dom; let proto; const originales = {};
before(() => {
  guardado = globalThis.document;
  dom = crearDomFalso();
  dom.createElementNS = (_ns, tag) => dom.createElement(tag);
  dom.activeElement = dom.body;
  proto = Object.getPrototypeOf(dom.createElement('div'));
  for (const k of ['appendChild', 'focus', 'scrollIntoView', 'getBoundingClientRect']) originales[k] = proto[k];
  // Tan estricto como el navegador (99 §231.12): appendChild de algo que no es un nodo (p. ej. un arreglo anidado) falla.
  proto.appendChild = function (c) {
    if (!c || (c.nodeType !== 1 && c.nodeType !== 3)) throw new TypeError('appendChild: no es un nodo (' + Object.prototype.toString.call(c) + ')');
    return originales.appendChild.call(this, c);
  };
  // El foco y el desplazamiento, para seguirlos (el doble común no los trae).
  proto.focus = function () { dom.activeElement = this; };
  proto.scrollIntoView = function () { this.desplazado = (this.desplazado || 0) + 1; };
  proto.getBoundingClientRect = function () { return { top: 5000 }; };   // fuera de la ventana
  globalThis.document = dom;
});
after(() => {
  if (proto) for (const [k, v] of Object.entries(originales)) { if (v === undefined) delete proto[k]; else proto[k] = v; }
  if (guardado === undefined) delete globalThis.document; else globalThis.document = guardado;
});

const { montarIndicadores, enfocarVista, VACIO, SOLO_ADMIN } = await import('../assets/js/ui/odt-afinia/indicadores.js');
const { montarCargar, AVISO_OTRO_PROGRAMA } = await import('../assets/js/ui/odt-afinia/indicadores-cargar.js');
const { montarVistaCorte, deltaPuntos, BARRA_FIJA_PX } = await import('../assets/js/ui/odt-afinia/indicadores-vista.js');
const { pasoEje, COLOR_ESTADO, ORDEN_PILA, graficoMensual } = await import('../assets/js/ui/odt-afinia/indicadores-graficos.js');
const { leerAncla, montarOdtAfinia, MSG_INDICADORES_NO_CARGO } = await import('../assets/js/ui/odt-afinia/app.js');

const ADMIN = { uid: 'uid-admin-prueba', nombre: RESP_A_PERFIL, correoPerfil: 'admin@prueba.test', rol: 'admin', esAdmin: true, legacy: false };
const OTRO_ADMIN = { ...ADMIN, uid: 'uid-admin-dos-prueba', nombre: 'Administradora De Prueba' };
const TECNICO = { uid: 'uid-tecnico-prueba', nombre: 'Tecnico De Prueba', correoPerfil: 'tecnico@prueba.test', rol: 'tecnico', esAdmin: false, legacy: false };
const HEX = 'ef'.repeat(32);
const caja = () => document.createElement('div');
const botones = (el) => el.todos().filter((x) => x.tagName === 'BUTTON');
const boton = (el, texto) => botones(el).find((b) => b.textContent.includes(texto));
const porId = (el, id) => el.todos().find((x) => x.id === id);
const visible = (el) => { for (let n = el; n; n = n.parentNode) if (n.hidden) return false; return true; };
const activo = () => document.activeElement;
function sinRestos(el) {
  const restos = [];
  (function recorrer(n) {
    if (n.childNodes && n.childNodes.length) { n.childNodes.forEach(recorrer); return; }
    if (['null', 'undefined', 'false', 'NaN', '[object Object]'].includes(String(n.textContent).trim())) restos.push(n.textContent);
  })(el);
  assert.deepEqual(restos, [], 'quedó un resto pintado como texto: ' + restos.join(', '));
}
async function hasta(cond, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 5));
  }
}
const nuevoFs = (op) => conConsultas(crearFirestoreFalso(op));
const repoDe = (fs, s = ADMIN) => crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => s, tiempoLoteMs: 30 });
/** Guarda un corte (como lo haría la pantalla de carga) desde un texto CSV. */
async function guardarCorte(fs, texto, { nombre = 'INFORME_ODT_prueba.csv', resp = RESP_A, sha = HEX, lectura = null } = {}) {
  const l = lectura || leerCsv(texto);
  return repoDe(fs).guardar({ archivo: { nombre, bytes: texto.length || 1, sha256: sha }, lectura: l, analisis: analizarResponsable(l, resp) });
}
function montar(p) {
  const c = caja(); const idas = [];
  return montarIndicadores(c, { alIr: (ancla, m) => idas.push([ancla, m || '']), ...p }).then((r) => ({ c, r, idas }));
}
/** Las filas del cuerpo de una tabla, como textos de sus celdas. */
const filasDe = (tabla) => tabla.todos().filter((x) => x.tagName === 'TBODY')[0].childNodes.map((tr) => tr.childNodes.map((td) => td.textContent));
const entero = (t) => Number(String(t).replace(/\D/g, '')) || 0;

describe('anclas y pestaña', () => {
  test('#indicadores, #indicadores=<id> y #indicadores-cargar; un id mal formado vuelve a la bandeja', () => {
    assert.deepEqual(leerAncla('#indicadores'), { vista: 'indicadores', sub: 'ultimo' });
    assert.deepEqual(leerAncla('#indicadores=' + 'A'.repeat(20)), { vista: 'indicadores', sub: 'corte', corteId: 'A'.repeat(20) });
    assert.deepEqual(leerAncla('#indicadores-cargar'), { vista: 'indicadores', sub: 'cargar' });
    assert.deepEqual(leerAncla('#indicadores=../x'), { vista: 'bandeja' });
    assert.deepEqual(leerAncla('#subsanar'), { vista: 'subsanar', sub: 'lista' }, 'lo de antes no cambia');
  });
  async function arrancar(perfil, hash, extra = {}) {
    const g = { window: globalThis.window, location: globalThis.location, sesion: globalThis.__sgmSession };
    globalThis.window = { __sgmSession: { user: { uid: perfil.uid }, profile: { nombre: perfil.nombre, email: perfil.correoPerfil, rol: perfil.rol, activo: true }, role: perfil.rol }, addEventListener: () => {} };
    globalThis.__sgmSession = globalThis.window.__sgmSession;
    globalThis.location = { hash };
    try {
      const raiz = caja();
      await montarOdtAfinia(raiz, { franja: caja(), repoObs: { listar: async () => ({ lista: [], tope: false }) }, ...extra });
      return raiz;
    } finally {
      for (const [k, v] of [['window', g.window], ['location', g.location], ['__sgmSession', g.sesion]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
    }
  }
  test('el administrador ve «Indicadores» y entra por #indicadores; el técnico no la ve y por el ancla recibe un aviso', async () => {
    const fs = nuevoFs();
    const raiz = await arrancar(ADMIN, '#indicadores', { repoCortes: repoDe(fs) });
    const nav = raiz.querySelectorAll('.odt-nav-btn');
    const b = nav.find((x) => x.textContent === 'Indicadores');
    assert.ok(b, 'pestaña');
    assert.equal(b.getAttribute('href'), '#indicadores');
    assert.equal(b.getAttribute('aria-current'), 'page');
    await hasta(() => raiz.textContent.includes(VACIO));
    sinRestos(raiz);
    const r2 = await arrancar(TECNICO, '#indicadores', { repoCortes: repoDe(fs, TECNICO) });
    assert.ok(!r2.querySelectorAll('.odt-nav-btn').some((x) => x.textContent === 'Indicadores'));
    // 2026-11-24: también los ven los LECTORES de la lista (tests/odt_afinia_indicadores_lectores.test.js); el técnico no está.
    assert.ok(r2.textContent.includes('Los indicadores son solo para los administradores y las personas que ellos autoricen.'));
    assert.match(MSG_INDICADORES_NO_CARGO, /Recargue la página/);
  });
});

describe('vista de un corte', () => {
  test('sin cortes: cómo cargar el primero; un técnico: solo administradores', async () => {
    const fs = nuevoFs();
    const { c, idas } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    assert.ok(c.textContent.includes(VACIO));
    await boton(c, 'Cargar el primer corte').disparar('click');
    assert.deepEqual(idas, [['indicadores-cargar', '']]);
    const t = await montar({ repoCortes: repoDe(fs, TECNICO), sesion: TECNICO });
    assert.equal(t.c.textContent, SOLO_ADMIN);
  });
  test('el último corte: tarjetas, definiciones justo debajo, tabla por contratista con total, gráficos, tipo y zona e historial', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_20260410080000_prueba.csv' });
    const { c, r } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    await r.vista.anterior;
    const t = c.textContent;
    for (const x of ['Indicadores de ODT · ' + RESP_A, 'Datos del 10/04/2026 03:00', 'del 05/01/2026 al 06/04/2026', 'Generadas', 'Por ejecutar', 'Ejecutadas sin cerrar', 'Cerradas',
      'No ejecutadas / inactivas', '% de cierre', '50,0 %', '3 de 6', 'Otro estado', 'Por contratista', ALFA, BETA, 'Evolución mensual',
      'Por tipo de trabajo', 'Por zona', 'ZONA NORTE', 'Qué es cada indicador', 'Cerradas ÷ (Generadas − No ejecutadas − Inactivas).',
      'Historial de cortes', 'Este corte', 'Sin filtros: las 8 ODT del corte.', 'Es el primer corte de este responsable']) assert.ok(t.includes(x), x);
    assert.ok(t.indexOf('Qué es cada indicador') < t.indexOf('Por contratista'), 'las definiciones van justo debajo de las tarjetas');
    assert.ok(!t.includes('Huella SHA-256 ') || t.includes('(identifica este archivo exacto)'), 'la huella dice para qué sirve');
    const tarjetas = c.querySelectorAll('.odt-ind-tarjeta-valor').map((x) => x.textContent);
    assert.deepEqual(tarjetas, ['8', '1', '1', '3', '2', '50,0 %', '1'], 'Generadas, Por ejecutar, Ejecutadas sin cerrar, Cerradas, No ejecutadas / inactivas, %, Otro');
    const total = c.querySelectorAll('.odt-ind-total')[0];
    assert.ok(total.textContent.startsWith('Total'));
    assert.ok(total.textContent.includes('50,0 %'));
    // Cada celda de la tabla por contratista lleva el nombre de su columna (en un celular se ve como ficha).
    const tablaC = c.querySelectorAll('.odt-ind-tabla-contratistas')[0];
    for (const td of tablaC.todos().filter((x) => x.tagName === 'TD')) assert.ok(td.getAttribute('data-etq'), 'celda sin data-etq');
    const svgs = c.todos().filter((x) => x.tagName === 'SVG');
    assert.equal(svgs.length, 2, 'barras por contratista y evolución mensual');
    for (const s of svgs) {
      assert.equal(s.getAttribute('role'), 'img');
      assert.ok(s.todos().some((x) => x.tagName === 'TITLE'));
      assert.ok(s.todos().some((x) => x.tagName === 'DESC'));
    }
    const tramos = svgs[0].todos().filter((x) => x.tagName === 'RECT');
    assert.ok(tramos.length >= 5);
    for (const x of tramos) assert.ok(Object.values(COLOR_ESTADO).includes(x.getAttribute('fill')), 'color de un estado');
    // Tablas accesibles: encabezados con scope.
    for (const th of c.todos().filter((x) => x.tagName === 'TH')) assert.ok(['col', 'row'].includes(th.getAttribute('scope')), 'th sin scope');
    assert.ok(r.corte && r.historial.length === 1);
    sinRestos(c);
  });
  test('por tipo de trabajo y por zona: las columnas de cada fila SUMAN su total, y cada número abre su lista', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    const tablas = c.querySelectorAll('.odt-ind-tabla').filter((x) => /^Por (tipo de trabajo|zona)/.test(x.todos().find((y) => y.tagName === 'CAPTION').textContent));
    assert.equal(tablas.length, 2);
    for (const tabla of tablas) {
      const enc = tabla.todos().filter((x) => x.tagName === 'THEAD')[0].todos().filter((x) => x.tagName === 'TH').map((x) => x.textContent);
      assert.ok(enc.includes('No ejecutadas / inactivas') && enc.some((x) => x.startsWith('Otro estado')), enc.join(' | '));
      for (const f of filasDe(tabla)) {
        const nums = f.slice(1, -1).map(entero);   // sin el nombre ni el %
        assert.equal(nums.slice(1).reduce((s, x) => s + x, 0), nums[0], f.join(' | ') + ': las columnas suman el total');
      }
    }
    const b = botones(c).find((x) => (x.getAttribute('aria-label') || '') === 'Ver 2 ODT cerradas · TIPO UNO');
    assert.ok(b, 'el número de un tipo es un botón');
    await b.disparar('click');
    assert.ok(c.querySelectorAll('.odt-ind-lista')[0].textContent.includes('ODT · Cerradas · TIPO UNO (2)'));
  });
  test('un número abre la lista de esas ODT (con su contratista) y su estado en SGM, consultado por N.º y una vez por N.º', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    fs.poner('odt_afinia/OdtFalsa000000000001', { nro: '90000002', estado: 'LISTA' });
    fs.poner('odt_afinia/OdtFalsa000000000002', { nro: '90000004', estado: 'CERRADA' });
    fs.poner('odt_afinia/OdtFalsa000000000003', { nro: '90000004', estado: 'REEMPLAZADA' });
    fs.poner('odt_afinia_obs/ObsFalsa00000000001', { nro: '90000006', estado: 'ABIERTA' });
    const { c } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    const tarjeta = botones(c).find((b) => b.getAttribute('aria-label') === 'Ver las 3 ODT: Cerradas');
    assert.ok(tarjeta, 'la tarjeta de Cerradas es un botón');
    const antes = fs.consultas.length;
    await tarjeta.disparar('click');
    const lista = () => c.querySelectorAll('.odt-ind-lista')[0];
    assert.ok(lista().desplazado >= 1, 'se desplaza a la lista (el CSS la deja debajo de la barra fija)');
    assert.ok(lista().textContent.includes('ODT · Cerradas (3)'));
    assert.ok(activo().className.includes('odt-ind-lista-titulo'), 'el foco va al título de la lista');
    await hasta(() => lista().textContent.includes('Cerrada en SGM'));
    assert.ok(activo().className.includes('odt-ind-lista-titulo'), 'y sigue ahí al llegar el estado en SGM');
    const filas = lista().todos().filter((x) => x.tagName === 'TR').slice(1).map((tr) => tr.childNodes.map((td) => td.textContent));
    // Con el AZT y el jefe de trabajo de cada ODT (corte de la versión 2).
    assert.deepEqual(filas, [
      ['90000002', ALFA, 'S/E PRUEBA UNO', 'TIPO UNO', AZT_1, JEFE_2, '10/02/2026', 'CERRADA', '20/03/2026', 'Lista'],
      ['90000004', ALFA, 'S/E PRUEBA UNO', 'TIPO DOS', AZT_2, JEFE_1, '01/03/2026', 'CERRADA', '02/03/2026', 'Cerrada en SGM'],
      ['90000006', BETA, 'S/E PRUEBA UNO', 'TIPO UNO', AZT_2, JEFE_3, '04/03/2026', 'CERRADA', '30/04/2026', 'Por subsanar']
    ]);
    const nuevas = fs.consultas.slice(antes);
    assert.deepEqual([...new Set(nuevas.map((q) => q.col))].sort(), ['odt_afinia', 'odt_afinia_obs'], 'solo lee la firma y «Por subsanar»');
    assert.ok(nuevas.every((q) => q.filtros.some((f) => f.t === 'where' && f.campo === 'nro' && f.opr === 'in')), 'por N.º');
    // Otro número (BETA · No ejecutadas): solo se consulta el N.º nuevo; el que no está en SGM lo dice.
    const n = botones(c).find((b) => (b.getAttribute('aria-label') || '').startsWith('Ver 1 ODT no ejecutadas · ' + BETA));
    const antes2 = fs.consultas.length;
    await n.disparar('click');
    assert.ok(lista().textContent.includes('ODT · No ejecutadas · ' + BETA + ' (1)'));
    await hasta(() => lista().textContent.includes(SGM_NO_ESTA));
    assert.ok(!lista().todos().some((x) => x.tagName === 'TH' && x.textContent === 'Contratista'), 'la lista de un contratista no repite la columna');
    assert.ok(fs.consultas.slice(antes2).every((q) => q.filtros.some((f) => f.t === 'where' && Array.isArray(f.valor) && f.valor.length === 1 && f.valor[0] === '90000005')));
    // Volver a las cerradas no vuelve a consultar.
    const antes3 = fs.consultas.length;
    await tarjeta.disparar('click');
    assert.equal(fs.consultas.length, antes3);
    // «Cerrar la lista» devuelve el foco a quien la abrió, y lo trae al CENTRO de la ventana (lejos de la barra fija).
    const bloques = [];
    tarjeta.scrollIntoView = (o) => { bloques.push(o && o.block); };
    await boton(lista(), 'Cerrar la lista').disparar('click');
    assert.equal(lista().textContent, '');
    assert.equal(activo(), tarjeta);
    assert.deepEqual(bloques, ['center']);
    sinRestos(c);
  });
  test('el estado en SGM: «Sin consultar» si no se pudo consultar y un aviso con «Reintentar»', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const r = await repoDe(fs).leer((await repoDe(fs).listar()).cortes[0].id);
    let fallar = true; let llamadas = 0;
    const cargarSgm = async (nros) => { llamadas++; if (fallar) throw new Error('sin red de prueba'); return { mapa: new Map([['90000002', { clave: 'lista', etiqueta: 'Lista' }]]), consultados: nros }; };
    const c = caja();
    const v = montarVistaCorte(c, { ...r, historial: [], cargarSgm, alIr: () => {} });
    v.elegir({ clave: 'cerrada' }, null);
    const lista = () => c.querySelectorAll('.odt-ind-lista')[0];
    await hasta(() => lista().textContent.includes('No se pudo consultar el estado en SGM'));
    assert.equal(lista().todos().filter((x) => x.tagName === 'TD' && x.textContent === SGM_SIN_CONSULTAR).length, 3);
    fallar = false;
    await boton(lista(), 'Reintentar la consulta en SGM').disparar('click');
    await hasta(() => lista().textContent.includes('Lista') && lista().textContent.includes(SGM_NO_ESTA));
    assert.equal(llamadas, 2);
    // Sin consulta posible (sin repositorio): todas «Sin consultar», nunca «—».
    const c2 = caja();
    montarVistaCorte(c2, { ...r, historial: [], alIr: () => {} }).elegir({ clave: 'total' }, null);
    const celdas = c2.querySelectorAll('.odt-ind-lista')[0].todos().filter((x) => x.tagName === 'TR').slice(1).map((tr) => tr.childNodes.at(-1).textContent);
    assert.ok(celdas.length === 8 && celdas.every((x) => x === SGM_SIN_CONSULTAR), celdas.join(','));
  });
  test('los filtros recalculan todo; «Quitar filtros» vuelve al corte entero; los encabezados ordenan y conservan el foco', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    const sel = porId(c, 'odtIndEmpresa');
    sel.value = BETA; await sel.disparar('change');
    assert.ok(c.textContent.includes('Con filtros (Contratista: ' + BETA + '): 3 de 8 ODT.'));
    assert.deepEqual(c.querySelectorAll('.odt-ind-tarjeta-valor').map((x) => x.textContent), ['3', '0', '0', '1', '2', '100,0 %']);
    const zona = porId(c, 'odtIndZona');
    zona.value = 'ZONA NORTE'; await zona.disparar('change');
    assert.ok(c.textContent.includes('1 de 8 ODT.'));
    await boton(c, 'Quitar filtros').disparar('click');
    assert.ok(c.textContent.includes('Sin filtros: las 8 ODT del corte.'));
    assert.equal(sel.value, '');
    // Ordenar por contratista (A→Z) y otra vez (Z→A); el foco queda en el encabezado (uno nuevo, el de la misma columna).
    const orden = () => filasDe(c.querySelectorAll('.odt-ind-tabla-contratistas')[0]).map((f) => f[0]);
    assert.equal(orden()[0], ALFA, 'por total, de mayor a menor');
    const ordenar = () => botones(c).find((b) => b.getAttribute('title') === 'Ordenar por contratista');
    const viejo = ordenar();
    await viejo.disparar('click');
    assert.deepEqual(orden(), [...orden()].sort((x, y) => x.localeCompare(y, 'es')));
    assert.notEqual(ordenar(), viejo, 'la tabla se repintó');
    assert.equal(activo(), ordenar(), 'el foco vuelve al encabezado pulsado');
    const th = c.todos().find((x) => x.tagName === 'TH' && x.getAttribute('aria-sort') === 'ascending');
    assert.ok(th && th.textContent.startsWith('Contratista'));
    await ordenar().disparar('click');
    assert.deepEqual(orden(), [...orden()].sort((x, y) => y.localeCompare(x, 'es')));
    sinRestos(c);
  });
  test('comparación con el corte anterior del mismo responsable: ± por estado y contratista (con el % de cierre), cambios y nuevas', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_20260401080000_antes.csv' });
    const despues = archivoBase().replace(/90000001\|SI\|([^\r]*)\|GENERADA\|/, '90000001|SI|$1|EJECUTADA|')
      + csv([odt('90000050', { estado: 'GENERADA' })]).split('\r\n').slice(1).join('\r\n');
    const b = await guardarCorte(fs, despues, { nombre: 'INFORME_ODT_20260410080000_despues.csv' });
    const { c, r } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    await r.vista.anterior;
    await hasta(() => c.textContent.includes('ODT que cambiaron de estado'));
    const t = c.textContent;
    assert.ok(t.includes('Corte anterior: datos del 01/04/2026 03:00'));
    assert.ok(t.includes('INFORME_ODT_20260401080000_antes.csv'));
    assert.ok(t.includes('ODT que cambiaron de estado (1)'));
    assert.ok(t.includes('ODT nuevas en este corte (1)'));
    assert.ok(t.includes('90000050'));
    assert.ok(t.includes('+1'), 'diferencia');
    // Por contratista, también el % de cierre antes → ahora y su diferencia en puntos.
    const porContratista = c.querySelectorAll('.odt-ind-tabla').find((x) => (x.todos().find((y) => y.tagName === 'CAPTION') || {}).textContent === 'Por contratista (antes → ahora, y la diferencia)');
    const alfa = filasDe(porContratista).find((f) => f[0] === ALFA);
    assert.equal(alfa.at(-1), '50,0 % → 40,0 % (−10,0 puntos)');
    // Las listas van plegadas, con su conteo a la vista.
    assert.ok(c.todos().filter((x) => x.tagName === 'DETAILS' && x.className.includes('odt-ind-plegable')).length >= 2);
    assert.ok(c.todos().some((x) => x.tagName === 'A' && x.getAttribute('href').startsWith('#indicadores=')), 'enlace al corte anterior');
    // El historial tiene los dos, el actual marcado.
    assert.ok(t.includes('INFORME_ODT_20260410080000_despues.csv') && t.includes('Este corte'));
    // Abrir el anterior por su id: ese no tiene anterior.
    const hist = await repoDe(fs).listar();
    const viejo = hist.cortes.find((x) => x.id !== b.id);
    const v = await montar({ vista: 'corte', corteId: viejo.id, repoCortes: repoDe(fs), sesion: ADMIN });
    await v.r.vista.anterior;
    assert.ok(v.c.textContent.includes('Es el primer corte de este responsable'));
    sinRestos(c);
  });
  test('un archivo VIEJO cargado después no invierte la comparación (el anterior es por la fecha de los datos)', async () => {
    const fs = nuevoFs();
    const nuevo = await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_20260420080000_nuevo.csv' });
    await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_20260405080000_viejo.csv' });   // guardado DESPUÉS
    const { c, r } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    assert.equal(r.corte.id, nuevo.id, '#indicadores abre el de datos más recientes, no el último guardado');
    await r.vista.anterior;
    assert.ok(c.textContent.includes('Corte anterior: datos del 05/04/2026 03:00'));
  });
  test('#indicadores abre el último corte DE LA PERSONA de la sesión, aunque esté fuera de los 50 más recientes', async () => {
    const fs = nuevoFs();
    const propio = await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_20260301080000_propio.csv' });
    const l = leerCsv(archivoBase());
    for (let i = 0; i < 51; i++) await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_202604' + String(i % 28 + 1).padStart(2, '0') + '080000_b.csv', resp: RESP_B, lectura: l });
    const { c, r } = await montar({ repoCortes: repoDe(fs), sesion: ADMIN });
    assert.equal(r.historial.length, 50);
    assert.ok(!r.historial.some((x) => x.id === propio.id), 'no está entre los 50 más recientes');
    assert.equal(r.corte.id, propio.id);
    assert.ok(c.textContent.includes('Indicadores de ODT · ' + RESP_A));
    assert.ok(!c.textContent.includes('Todavía no hay cortes suyos'));
    // Otra persona sin cortes propios: el último guardado, diciendo de quién es.
    const o = await montar({ repoCortes: repoDe(fs, OTRO_ADMIN), sesion: OTRO_ADMIN });
    assert.ok(o.c.textContent.includes('Todavía no hay cortes suyos (de ' + OTRO_ADMIN.nombre + '): se muestra el último guardado, de ' + RESP_B + '.'));
    assert.ok(o.c.textContent.includes('Indicadores de ODT · ' + RESP_B));
  });
  test('#indicadores con un nombre con Ñ: abre el corte propio fuera de los 50 (la consulta va con el nombre como lo guarda Afinia)', async () => {
    const RESP_N = 'PERSONA MUÑOZ DE PRUEBA';                       // como lo trae el CSV: sin tildes, con Ñ
    const PERFIL_N = { ...ADMIN, uid: 'uid-admin-ene-prueba', nombre: 'Persona Muñoz de Prueba' };
    const fs = nuevoFs();
    const texto = csv([odt('90000401', { resp: RESP_N }), odt('90000402', { resp: RESP_N, estado: 'CERRADA', cerrada: '02/03/2026 08:00' })]);
    const propio = await guardarCorte(fs, texto, { nombre: 'INFORME_ODT_20260301080000_ene.csv', resp: RESP_N });
    const l = leerCsv(archivoBase());
    for (let i = 0; i < 51; i++) await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_202604' + String(i % 28 + 1).padStart(2, '0') + '080000_n.csv', resp: RESP_B, lectura: l });
    const { c, r } = await montar({ repoCortes: repoDe(fs, PERFIL_N), sesion: PERFIL_N });
    assert.ok(!r.historial.some((x) => x.id === propio.id), 'no está entre los 50 más recientes');
    assert.equal(r.corte.id, propio.id);
    assert.ok(c.textContent.includes('Indicadores de ODT · ' + RESP_N));
    assert.ok(!c.textContent.includes('Todavía no hay cortes suyos'));
    assert.ok(fs.consultas.some((q) => q.filtros.some((f) => f.t === 'where' && f.campo === 'responsable' && f.opr === '==' && f.valor === RESP_N)), 'preguntó con la Ñ');
  });
  test('historial de 50 en 50 («Ver cortes más antiguos») y el corte anterior encontrado fuera de esos 50', async () => {
    const fs = nuevoFs();
    const l = leerCsv(archivoBase());
    const ids = [];
    for (let i = 0; i < 53; i++) {
      const dia = String(1 + (i % 28)).padStart(2, '0'); const mes = String(3 + Math.floor(i / 28)).padStart(2, '0');
      ids.push((await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_2026' + mes + dia + '080000_h' + i + '.csv', lectura: l })).id);
    }
    // El segundo más viejo: su anterior (el primero) no está entre los 50 más recientes del historial.
    const { c, r } = await montar({ vista: 'corte', corteId: ids[1], repoCortes: repoDe(fs), sesion: ADMIN });
    await r.vista.anterior;
    assert.ok(!r.historial.some((x) => x.id === ids[0]));
    assert.ok(c.textContent.includes('_h0.csv'), 'encontró el anterior con su propia consulta');
    assert.ok(!c.textContent.includes('Es el primer corte'));
    const filasHist = () => filasDe(c.querySelectorAll('.odt-ind-tabla').find((x) => (x.todos().find((y) => y.tagName === 'CAPTION') || {}).textContent.startsWith('Cada corte guardado'))).length;
    assert.equal(filasHist(), 50);
    assert.ok(c.textContent.includes('Se muestran los 50 cortes guardados más recientes; hay más.'));
    await boton(c, 'Ver cortes más antiguos').disparar('click');
    await hasta(() => filasHist() === 53);
    assert.ok(!boton(c, 'Ver cortes más antiguos'), 'ya no hay más');
    // El foco no cae al principio de la página: pasa al enlace del primer corte que llegó (el 51.º; el actual no tiene).
    assert.equal(activo().tagName, 'A');
    assert.equal(activo().getAttribute('href'), '#indicadores=' + ids[2]);
    // En un celular el historial va como fichas: cada dato con su nombre.
    const tablaHist = c.querySelectorAll('.odt-ind-tabla-historial')[0];
    assert.ok(tablaHist && tablaHist.className.includes('odt-ind-fichas'));
    const celdas = tablaHist.todos().filter((x) => (x.tagName === 'TD' || (x.tagName === 'TH' && x.getAttribute('scope') === 'row')));
    assert.ok(celdas.length > 0 && celdas.every((x) => x.getAttribute('data-etq')), 'cada celda con su data-etq');
    sinRestos(c);
  });
  test('«Ver cortes más antiguos» que falla: el aviso, y el foco vuelve al botón (no al principio de la página)', async () => {
    const fs = nuevoFs();
    const l = leerCsv(archivoBase());
    const ids = [];
    for (let i = 0; i < 51; i++) ids.push((await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_202603' + String(1 + (i % 28)).padStart(2, '0') + '080000_f' + i + '.csv', lectura: l })).id);
    const c = caja();
    const hist = await repoDe(fs).listar();
    assert.equal(hist.tope, true);
    const r = montarVistaCorte(c, {
      ...(await repoDe(fs).leer(ids[50])), historial: hist.cortes, historialTope: hist.tope,
      repoCortes: repoDe(fs), alIr: () => {}, masHistorial: async () => { throw new Error('sin red de prueba'); }
    });
    await r.anterior;
    await boton(c, 'Ver cortes más antiguos').disparar('click');
    assert.ok(c.textContent.includes('No se pudieron leer más cortes: sin red de prueba'));
    assert.equal(activo(), boton(c, 'Ver cortes más antiguos'));
  });
  test('al navegar, el título del corte queda a la vista y con el foco; con «Corte guardado», el aviso', async () => {
    const fs = nuevoFs();
    const g = await guardarCorte(fs, archivoBase());
    const a = await montar({ vista: 'corte', corteId: g.id, repoCortes: repoDe(fs), sesion: ADMIN });
    const titulo = a.c.querySelectorAll('.odt-ind-titulo')[0];
    assert.equal(activo(), titulo);
    assert.equal(titulo.getAttribute('tabindex'), '-1');
    assert.ok(titulo.desplazado >= 1, 'estaba fuera de la ventana: se desplazó hasta él');
    const b = await montar({ vista: 'corte', corteId: g.id, repoCortes: repoDe(fs), sesion: ADMIN, mensaje: 'Corte guardado: prueba.' });
    const av = b.c.querySelectorAll('.odt-ind-aviso-inicial')[0];
    assert.equal(activo(), av);
    assert.equal(av.textContent, 'Corte guardado: prueba.');
    const k = await montar({ vista: 'cargar', repoCortes: repoDe(fs), sesion: ADMIN });
    assert.equal(activo().textContent, 'Cargar un corte de indicadores');
    // Sin nada que enfocar, no falla.
    assert.equal(enfocarVista(caja()), null);
    sinRestos(k.c);
  });
  test('la barra superior FIJA de la página: un título que queda debajo de ella cuenta como oculto y se desplaza hasta él', () => {
    assert.ok(BARRA_FIJA_PX > 64 && BARRA_FIJA_PX < 80, 'más alta que la barra (64 px) y menos que el scroll-margin-top del CSS (80 px)');
    const alto = globalThis.innerHeight;
    globalThis.innerHeight = 800;
    try {
      const probar = (top) => {
        const z = caja();
        const t = document.createElement('h2'); t.className = 'odt-ind-titulo';
        t.getBoundingClientRect = () => ({ top, bottom: top + 30 });
        z.appendChild(t);
        assert.equal(enfocarVista(z), t);
        assert.equal(activo(), t);
        return t.desplazado || 0;
      };
      assert.equal(probar(30), 1, 'a 30 px: tapado por la barra (dentro de la ventana, pero no se ve)');
      assert.equal(probar(BARRA_FIJA_PX - 1), 1);
      assert.equal(probar(-20), 1, 'arriba de la ventana');
      assert.equal(probar(BARRA_FIJA_PX), 0, 'justo debajo de la barra: se ve');
      assert.equal(probar(300), 0);
      assert.equal(probar(790), 1, 'abajo, casi fuera de la ventana');
    } finally { if (alto === undefined) delete globalThis.innerHeight; else globalThis.innerHeight = alto; }
  });
  test('un corte que no existe: aviso y botón al último; un corte incompleto lo dice sin números de parte', async () => {
    const fs = nuevoFs();
    const big = csv(Array.from({ length: 410 }, (_, i) => odt(String(93000000 + i))));
    const g = await guardarCorte(fs, big);
    const { c, idas } = await montar({ vista: 'corte', corteId: 'Z'.repeat(20), repoCortes: repoDe(fs), sesion: ADMIN });
    assert.ok(c.textContent.includes('Ese corte no existe en la plataforma.'));
    await boton(c, 'Ver el último corte').disparar('click');
    assert.deepEqual(idas, [['indicadores', '']]);
    fs.store.delete('odt_afinia_cortes/' + g.id + '/partes/1');
    const i = await montar({ vista: 'corte', corteId: g.id, repoCortes: repoDe(fs), sesion: ADMIN });
    assert.ok(i.c.textContent.includes('Este corte está INCOMPLETO: le faltan datos guardados en la plataforma'));
    assert.ok(!/partes?:? \d/.test(i.c.textContent), 'sin números de parte');
  });
  test('piezas: diferencia en puntos, paso del eje, orden y colores fijos, meses vacíos en el gráfico y su tabla', () => {
    assert.equal(deltaPuntos(0.5, 0.512), '+1,2 puntos');
    assert.equal(deltaPuntos(0.6, 0.595), '−0,5 puntos');
    assert.equal(deltaPuntos(0.5, 0.5), '0 puntos');
    assert.equal(deltaPuntos(null, 0.5), '—');
    assert.equal(pasoEje(123), 50);
    assert.equal(pasoEje(8), 2);
    assert.equal(pasoEje(0), 1);
    assert.deepEqual([...ORDEN_PILA], ['cerrada', 'ejecutada', 'generada', 'noEjecutada', 'inactiva', 'otro']);
    assert.equal(new Set(Object.values(COLOR_ESTADO)).size, 6);
    // Meses con huecos (como con un filtro): el gráfico y «Ver los datos del gráfico» los muestran en 0.
    const g = graficoMensual([{ mes: '2026-04', generadas: 2, cerradas: 1 }, { mes: '2026-01', generadas: 1, cerradas: 0 }]);
    const filas = filasDe(g.todos().find((x) => x.tagName === 'TABLE'));
    assert.deepEqual(filas, [['enero de 2026', '1', '0'], ['febrero de 2026', '0', '0'], ['marzo de 2026', '0', '0'], ['abril de 2026', '2', '1']]);
    assert.equal(g.todos().filter((x) => x.tagName === 'RECT').length, 8, 'dos columnas por mes, también los vacíos');
    // Control (L-144): el doble estricto SÍ rechaza un arreglo anidado, como el navegador.
    assert.throws(() => document.createElement('dl').appendChild([document.createElement('dt')]), /no es un nodo/);
  });
});

describe('cargar un corte', () => {
  const NOMBRE = 'INFORME_ODT_20260410080000_prueba.csv';
  const archivo = (texto, nombre = NOMBRE, bytes = latin1(texto)) => ({ name: nombre, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(0) });
  async function cargar(sesion, texto, extra = {}, fs = nuevoFs(), nombre = NOMBRE) {
    const c = caja(); const idas = [];
    const r = montarCargar(c, { repoCortes: repoDe(fs, sesion), sesion, historial: [], alIr: (a, m) => idas.push([a, m || '']), pausa: async () => {}, ...extra });
    const entrada = porId(c, 'odtIndArchivo');
    if (texto != null) { entrada.files = [typeof texto === 'string' ? archivo(texto, nombre) : texto]; await entrada.disparar('change'); }
    return { fs, c, r, idas, entrada };
  }
  test('archivo → vista previa con el responsable del perfil → «Guardar corte» en dos pasos (con el foco) → abre el corte guardado', async () => {
    const { fs, c, idas } = await cargar(ADMIN, archivoBase());
    const t = c.textContent;
    for (const x of ['Vista previa', 'Filas leídas', '11', 'ODT distintas en el archivo', '10', 'Responsables O.D.T.', 'Huella SHA-256 (identifica este archivo exacto)',
      'Fecha de los datos', '10/04/2026 03:00', 'del 05/01/2026 al 06/04/2026', '% de cierre', '50,0 %', 'Responsables del archivo (2)', RESP_B,
      'Estados que esta página no conoce']) assert.ok(t.includes(x), x);
    assert.ok(!t.includes('ISO-8859-1'), 'sin la codificación (palabra técnica)');
    assert.equal(porId(c, 'odtIndResponsable').value, RESP_A, 'por defecto, el del perfil (comparado sin tildes)');
    const guardar = boton(c, 'Guardar corte');
    const si = boton(c, 'Sí, guardar el corte');
    assert.ok(visible(guardar));
    assert.ok(!visible(si), 'el «Sí» no se ve hasta el primer paso');
    await guardar.disparar('click');
    assert.ok(visible(si));
    assert.ok(!visible(guardar));
    assert.equal(activo(), si, 'el foco pasa a «Sí, guardar el corte»');
    assert.match(c.textContent, /Se guarda el corte de PERSONA FICTICIA UNO: 8 ODT \(3 cerradas\), con datos del 10\/04\/2026 03:00/);
    await si.disparar('click');
    assert.equal(idas.length, 1);
    assert.match(idas[0][0], /^indicadores=[A-Za-z0-9]{20}$/);
    assert.equal(idas[0][1], 'Corte guardado: PERSONA FICTICIA UNO, 8 ODT.');
    assert.equal(fs.lotes.length, 1);
    const corte = fs.lotes[0].ops[0].datos;
    assert.equal(corte.responsable, RESP_A);
    assert.equal(corte.archivo.nombre, NOMBRE);
    assert.equal(corte.fechaDatos, '2026-04-10T08:00:00');
    assert.match(corte.archivo.sha256, /^[0-9a-f]{64}$/);
    assert.equal(corte.archivo.bytes, latin1(archivoBase()).length);
    sinRestos(c);
  });
  test('al terminar de leer, el foco (que el campo deshabilitado soltó) pasa a «Vista previa» o al error; si está en otra parte, no se toca', async () => {
    document.activeElement = document.body;
    const a = await cargar(ADMIN, archivoBase());
    assert.equal(activo().textContent, 'Vista previa');
    assert.equal(activo().getAttribute('tabindex'), '-1');
    document.activeElement = document.body;
    const vacio = { name: NOMBRE, size: 0, arrayBuffer: async () => new ArrayBuffer(0) };
    const b = await cargar(ADMIN, vacio);
    assert.ok(activo().className.includes('odt-ind-estado'), 'el mensaje de error');
    assert.ok(activo().textContent.includes('El archivo está vacío.'));
    const otro = caja(); otro.focus();
    await cargar(ADMIN, archivoBase());
    assert.equal(activo(), otro, 'la persona llevó el foco a otra parte: se respeta');
    sinRestos(a.c); sinRestos(b.c);
  });
  test('la vista previa por contratista trae «Otro estado» cuando hay estados desconocidos: cada fila suma su total', async () => {
    const { c } = await cargar(ADMIN, archivoBase());
    const tabla = c.querySelectorAll('.odt-ind-tabla').find((x) => (x.todos().find((y) => y.tagName === 'CAPTION') || {}).textContent === 'Por contratista');
    const ths = tabla.todos().filter((x) => x.tagName === 'TH' && x.getAttribute('scope') === 'col').map((x) => x.textContent);
    assert.deepEqual(ths, ['Contratista', 'Generadas', 'Por ejecutar', 'Ejecutadas sin cerrar', 'No ejecutadas', 'Cerradas', 'Inactivas', 'Otro estado', '% de cierre']);
    const filas = tabla.todos().filter((x) => x.tagName === 'TR').slice(1).map((tr) => tr.childNodes.map((td) => td.textContent));
    assert.equal(filas.length, 4, 'tres contratistas y el total');
    for (const f of filas) assert.equal(f.slice(2, 8).reduce((t, x) => t + entero(x), 0), entero(f[1]), f.join(' · '));
    assert.ok(filas.some((f) => f[0] === GAMMA && entero(f[7]) === 1), 'el estado desconocido, en su columna');
    // Sin estados desconocidos, la columna no aparece.
    const k = await cargar(ADMIN, csv([odt('90000501'), odt('90000502', { estado: 'CERRADA', cerrada: '02/03/2026 08:00' })]));
    const t2 = k.c.querySelectorAll('.odt-ind-tabla').find((x) => (x.todos().find((y) => y.tagName === 'CAPTION') || {}).textContent === 'Por contratista');
    assert.ok(!t2.todos().some((x) => x.tagName === 'TH' && x.textContent === 'Otro estado'));
  });
  test('«Cancelar» vuelve al primer paso sin guardar (y el foco a «Guardar corte»)', async () => {
    const { fs, c } = await cargar(ADMIN, archivoBase());
    await boton(c, 'Guardar corte').disparar('click');
    await boton(c, 'Cancelar').disparar('click');
    assert.ok(visible(boton(c, 'Guardar corte')));
    assert.ok(!visible(boton(c, 'Sí, guardar el corte')));
    assert.equal(activo(), boton(c, 'Guardar corte'));
    assert.equal(fs.lotes.length, 0);
  });
  test('si el perfil no aparece como responsable: hay que elegirlo; cambiarlo recalcula sin rehacer el selector (el foco sigue ahí)', async () => {
    const { c } = await cargar({ ...ADMIN, nombre: 'Nadie De Prueba' }, archivoBase());
    const sel = porId(c, 'odtIndResponsable');
    assert.equal(sel.value, '');
    assert.ok(c.textContent.includes('no aparece como RESPONSABLE O.D.T. en el archivo'));
    assert.ok(!visible(boton(c, 'Guardar corte')));
    sel.focus();
    sel.value = RESP_B; await sel.disparar('change');
    assert.equal(porId(c, 'odtIndResponsable'), sel, 'el mismo selector');
    assert.equal(activo(), sel);
    assert.equal(sel.value, RESP_B);
    assert.ok(c.textContent.includes('Filas del responsable'));
    assert.ok(visible(boton(c, 'Guardar corte')));
    sel.value = RESP_A; await sel.disparar('change');
    assert.match(c.textContent, /Se guarda el corte de PERSONA FICTICIA UNO: 8 ODT/);
    sinRestos(c);
  });
  test('un archivo sin algunas columnas mínimas: dice cuáles y nada que guardar (sin pintar filas en cero)', async () => {
    const enc = ENCABEZADOS_AFINIA.filter((x) => x !== 'RESPONSABLE O.D.T.');
    const { c } = await cargar(ADMIN, csv([odt('90000001').slice(0, 47)], { encabezados: enc }));
    assert.ok(c.textContent.includes('Al archivo le faltan columnas que se necesitan: RESPONSABLE O.D.T.'));
    assert.ok(!visible(boton(c, 'Guardar corte')));
    assert.equal(porId(c, 'odtIndResponsable'), undefined);
    assert.ok(!c.textContent.includes('Filas leídas'));
  });
  test('un archivo equivocado (guardado en Excel con «;», o cualquier otro CSV): se dice que no es el informe de Afinia', async () => {
    const conPuntoYComa = csv([fila().join(';')]).replace(/\|/g, ';');
    for (const texto of [conPuntoYComa, 'nombre,valor\r\nuno,1\r\n']) {
      const { c } = await cargar(ADMIN, texto);
      const t = c.textContent;
      assert.ok(t.includes(MSG_OTRO_ARCHIVO), t);
      assert.ok(!t.includes('Al archivo le faltan columnas'), 'sin la lista de las 10 columnas');
      for (const x of ['Filas leídas', 'ODT distintas en el archivo', 'Responsables O.D.T.']) assert.ok(!t.includes(x), 'no pinta ' + x + ' en cero');
      assert.equal(porId(c, 'odtIndResponsable'), undefined);
      assert.ok(!visible(boton(c, 'Guardar corte')));
    }
  });
  test('un archivo que no viene como lo entrega Afinia (UTF-8): se lee y se avisa en llano', async () => {
    const bytes = new TextEncoder().encode(archivoBase());
    const { c } = await cargar(ADMIN, archivo('', NOMBRE, bytes));
    assert.ok(c.textContent.includes(AVISO_OTRO_PROGRAMA));
    assert.ok(visible(boton(c, 'Guardar corte')));
  });
  test('filas raras: se avisan en la vista previa («|» de más, N.º con estados distintos)', async () => {
    const texto = csv([
      odt('90000061', { estado: 'CERRADA', cerrada: '01/05/2026 08:00', extra: { OBSERVACIONES: 'con | barra' } }),
      odt('90000062', { estado: 'EJECUTADA' }), odt('90000062', { estado: 'CERRADA', cerrada: '01/05/2026 08:00' })
    ]);
    const { c } = await cargar(ADMIN, texto);
    const t = c.textContent;
    assert.ok(t.includes('Avisos de la lectura'));
    assert.ok(t.includes('«|» de más dentro de un texto'));
    assert.ok(t.includes('estados distintos'));
    for (const li of c.todos().filter((x) => x.tagName === 'LI')) assert.ok(!li.textContent.endsWith('….'), li.textContent);
  });
  test('el mismo archivo ya guardado para ese responsable: se avisa (del historial o, si no está en él, del servidor por su huella)', async () => {
    const texto = archivoBase();
    const sha = createHash('sha256').update(Buffer.from(latin1(texto))).digest('hex');
    const { c } = await cargar(ADMIN, texto, { historial: [{ id: 'X'.repeat(20), responsable: RESP_A, archivo: { sha256: sha }, creadoEnMs: Date.UTC(2026, 10, 20, 15), version: 2 }] });
    assert.ok(c.textContent.includes('Este mismo archivo ya se guardó como corte de este responsable'));
    assert.ok(c.textContent.includes('quedan dos cortes iguales en el historial'));
    // Fuera del historial (p. ej. más allá de los 50): lo encuentra la consulta por huella.
    const fs = nuevoFs();
    await guardarCorte(fs, texto, { nombre: NOMBRE, sha });
    const k = await cargar(ADMIN, texto, {}, fs);
    await hasta(() => k.c.textContent.includes('Este mismo archivo ya se guardó como corte de este responsable'));
    // Para OTRO responsable del mismo archivo, no.
    await k.r.elegir(RESP_B);
    assert.ok(!k.c.textContent.includes('Este mismo archivo ya se guardó'));
  });
  test('un archivo con datos más VIEJOS que el último corte del responsable: se avisa (con las dos fechas); uno más nuevo, no', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase(), { nombre: 'INFORME_ODT_20260420080000_x.csv' });
    const { c } = await cargar(ADMIN, archivoBase(), {}, fs);
    await hasta(() => c.textContent.includes('más viejos que el último corte guardado de este responsable'));
    assert.ok(c.textContent.includes('Este archivo trae datos del 10/04/2026 03:00, más viejos que el último corte guardado de este responsable (datos del 20/04/2026 03:00)'));
    assert.ok(visible(boton(c, 'Guardar corte')), 'se puede guardar igual (completa el historial)');
    const n = await cargar(ADMIN, archivoBase(), {}, fs, 'INFORME_ODT_20260425080000_prueba.csv');
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(!n.c.textContent.includes('más viejos que el último corte'));
  });
  test('solo un administrador con perfil carga cortes', async () => {
    const { c } = await cargar(TECNICO, null);
    assert.ok(c.textContent.includes('Solo un administrador carga cortes'));
    assert.equal(porId(c, 'odtIndArchivo'), undefined);
    const l = await cargar({ ...ADMIN, legacy: true }, null);
    assert.ok(l.c.textContent.includes('no tiene perfil'));
  });
  test('un lote que no responde: «NO repita» y el botón sigue bloqueado', async () => {
    const fs = nuevoFs({ colgarLote: true });
    const c = caja(); const idas = [];
    montarCargar(c, { repoCortes: crearRepositorioCortes({ sdk: fs.F, db: fs.db, sesion: () => ADMIN, tiempoLoteMs: 20 }), sesion: ADMIN, alIr: (a) => idas.push(a), pausa: async () => {} });
    const entrada = porId(c, 'odtIndArchivo');
    entrada.files = [archivo(archivoBase())]; await entrada.disparar('change');
    await boton(c, 'Guardar corte').disparar('click');
    const si = boton(c, 'Sí, guardar el corte');
    await si.disparar('click');
    assert.match(c.textContent, /NO repita/);
    assert.equal(si.disabled, true);
    assert.equal(entrada.disabled, true);
    assert.deepEqual(idas, []);
  });
});
