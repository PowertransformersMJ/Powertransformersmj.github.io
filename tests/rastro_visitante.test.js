// Rastro de actividad del visitante (assets/js/domain/rastro_visitante.js) · `99 §199`
//
// Lo que se guarda va acotado a la forma que exigen las reglas; el resumen cuenta un inicio de
// sesión por cada marca `ingreso` (no por recarga) y el día va en hora de Colombia. Además, los
// amarres: el guardián carga el rastro SOLO para el visitante y el panel nunca pinta HTML ajeno.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  recortar, detalleLimpio, paginaDe, eventoDeRuta, describirDispositivo, describirEvento, resumirActividad, filasCSV,
  TIPOS_EVENTO, CLAVES_DETALLE, TOPE_TEXTO
} from '../assets/js/domain/rastro_visitante.js';

const leer = (r) => readFileSync(new URL('../' + r, import.meta.url), 'utf8');
const en = (iso) => new Date(iso);

describe('forma de lo que se guarda', () => {
  test('recortar: una línea, sin controles, con tope', () => {
    assert.equal(recortar('  a\n\tb\u2028c  '), 'a b c');
    assert.equal(recortar('x'.repeat(500)).length, TOPE_TEXTO);
    assert.equal(recortar(null), '');
  });
  test('detalleLimpio: solo claves conocidas, como texto, sin vacías', () => {
    const d = detalleLimpio({ mat: 'T1-X', mes: '2026-09', raro: 'no', control: '', valor: 7, texto: 'y'.repeat(300) });
    assert.deepEqual(Object.keys(d).sort(), ['mat', 'mes', 'texto', 'valor']);
    assert.equal(d.valor, '7');
    assert.ok(d.texto.length <= TOPE_TEXTO);
    for (const k of Object.keys(d)) assert.ok(CLAVES_DETALLE.includes(k));
  });
  test('paginaDe', () => {
    assert.equal(paginaDe('/pages/cargabilidad-scada.html'), 'cargabilidad-scada');
    assert.equal(paginaDe('/repo/pages/mapa-v2'), 'mapa-v2');
    assert.equal(paginaDe('/'), 'inicio');
  });
  test('eventoDeRuta: equipo con mes o rango; mes o periodo de la lista; nada', () => {
    assert.deepEqual(eventoDeRuta('#mat=T2-M%2FM-PRA&id=abc&mes=2026-09'), { tipo: 'equipo', detalle: { mat: 'T2-M/M-PRA', mes: '2026-09' } });
    assert.deepEqual(eventoDeRuta('#mat=T1&desde=1&hasta=2'), { tipo: 'equipo', detalle: { mat: 'T1', desde: '1', hasta: '2' } });
    assert.deepEqual(eventoDeRuta('#periodo=2026-01_2026-08'), { tipo: 'ruta', detalle: { periodo: '2026-01_2026-08' } });
    assert.equal(eventoDeRuta(''), null);
  });
  test('describirDispositivo', () => {
    assert.deepEqual(describirDispositivo('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537', { ancho: 1920, alto: 1080 }),
      { nav: 'Chrome', so: 'Windows', tipo: 'Computador', pantalla: '1920×1080' });
    assert.equal(describirDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18) Version/18 Mobile Safari/604').tipo, 'Celular');
    assert.equal(describirDispositivo('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile').so, 'Android');
    assert.equal(describirDispositivo('Mozilla/5.0 (Linux; Android 14) Chrome/130').tipo, 'Tableta');   // Android sin «Mobile»
    const ipad = describirDispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18 Safari/605', { tactil: true });
    assert.deepEqual([ipad.so, ipad.tipo], ['iPadOS', 'Tableta']);
    assert.equal(describirDispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18 Safari/605').tipo, 'Computador');
  });
});

describe('resumen del panel', () => {
  const ev = [
    { tipo: 'pagina', pagina: 'cargabilidad-scada', ingreso: 'A', en: en('2026-11-02T13:00:00Z'), disp: { nav: 'Chrome', so: 'Windows', tipo: 'Computador' } },
    { tipo: 'equipo', pagina: 'cargabilidad-scada', ingreso: 'A', detalle: { mat: 'T1-X', mes: '2026-09' }, en: en('2026-11-02T13:05:00Z') },
    { tipo: 'equipo', pagina: 'cargabilidad-scada', ingreso: 'A', detalle: { mat: 'T1-X' }, en: en('2026-11-02T13:20:00Z') },
    { tipo: 'pagina', pagina: 'mapa-v2', ingreso: 'A', en: en('2026-11-02T13:30:00Z') },
    // Misma sesión (sin volver a escribir la clave) dos horas después: OTRA visita, el MISMO inicio de sesión.
    { tipo: 'pagina', pagina: 'mapa-v2', ingreso: 'A', en: en('2026-11-02T15:30:00Z') },
    // Otro inicio de sesión, de madrugada (en Colombia todavía es el día anterior) y un intento.
    { tipo: 'intento', pagina: 'cargabilidad-scada', ingreso: 'B', detalle: { texto: 'admin/usuarios' }, en: en('2026-11-04T03:00:00Z') },
    { tipo: 'seleccion', pagina: 'mapa-v2', ingreso: 'B', detalle: { tipo: 'subestacion', nombre: 'S/E Uno', mat: 'T2-Y' }, en: en('2026-11-04T03:01:00Z') },
  ];
  test('inicios de sesión por marca; visitas por pausa o cambio de día; equipos; día de Colombia', () => {
    const r = resumirActividad(ev);
    assert.equal(r.totalEventos, 7);
    assert.equal(r.totalIngresos, 2);
    assert.equal(r.totalVisitas, 3);
    assert.equal(r.intentos, 1);
    const primera = r.visitas[r.visitas.length - 1];
    assert.equal(primera.duracionMin, 30);
    assert.deepEqual(primera.paginas, ['Cargabilidad SCADA', 'Mapa']);
    assert.deepEqual(primera.equipos, ['T1-X']);
    assert.equal(primera.disp.nav, 'Chrome');
    assert.deepEqual(r.equiposMasVistos.map((q) => [q.mat, q.veces]), [['T1-X', 2], ['T2-Y', 1]]);
    assert.deepEqual(r.porDia.map((d) => [d.dia, d.visitas]), [['2026-11-03', 1], ['2026-11-02', 2]]);
    assert.equal(r.visitas[0].dia, '2026-11-03');   // más reciente primero
  });
  test('una sesión abierta que cruza la medianoche de Colombia se parte en dos visitas', () => {
    const r = resumirActividad([
      { tipo: 'pagina', pagina: 'mapa-v2', ingreso: 'C', en: en('2026-11-06T04:50:00Z') },   // 23:50 en Colombia
      { tipo: 'pagina', pagina: 'mapa-v2', ingreso: 'C', en: en('2026-11-06T05:05:00Z') },   // 00:05 del día siguiente
    ]);
    assert.equal(r.totalIngresos, 1);
    assert.equal(r.totalVisitas, 2);
  });
  test('vacío y Timestamp de Firestore', () => {
    assert.equal(resumirActividad([]).totalIngresos, 0);
    const r = resumirActividad([{ tipo: 'pagina', pagina: 'mapa-v2', ingreso: 'Z', en: { toDate: () => en('2026-11-01T12:00:00Z') } }]);
    assert.equal(r.totalVisitas, 1);
  });
  test('describirEvento y CSV', () => {
    assert.equal(describirEvento(ev[1]), 'Consultó el equipo T1-X (mes 2026-09)');
    assert.equal(describirEvento(ev[6]), 'Seleccionó en el mapa la subestación S/E Uno (transformador T2-Y)');
    assert.match(describirEvento(ev[5]), /^Intentó abrir una página que no tiene permitida \(admin\/usuarios\)/);
    assert.equal(describirEvento({ tipo: 'control', detalle: { control: 'Zona', valor: 'Bolívar' } }), 'Cambió «Zona» a «Bolívar»');
    const csv = filasCSV(ev);
    assert.equal(csv.length, 7);
    assert.equal(csv[0][0], '2026-11-02 08:00:00');   // hora de Colombia
  });
});

describe('amarres', () => {
  test('los tipos del dominio son los de las reglas', () => {
    const todo = leer('firestore.rules');
    const reglas = todo.slice(todo.indexOf('Rastro de actividad del visitante'), todo.indexOf('// ── Resto: cerrado por defecto'));
    const m = reglas.match(/request\.resource\.data\.tipo in \[([^\]]*)\]/);
    assert.ok(m);
    assert.deepEqual([...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]), [...TIPOS_EVENTO]);
    const claves = reglas.match(/d\.keys\(\)\.hasOnly\(\[('mat'[^\]]*)\]\)/);
    assert.deepEqual([...claves[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]), [...CLAVES_DETALLE]);
  });
  test('el guardián carga el rastro solo para el visitante, sin esperar', () => {
    const g = leer('assets/js/auth/session-guard.js');
    assert.match(g, /if \(acceso\.restringido\) \{\s*import\('\.\.\/ui\/rastro-visitante\.js'\)\.then\(\(m\) => m\.iniciar\(sess\)\)\.catch\(/);
  });
  test('al eliminar una cuenta se borra antes su rastro; el intento lo deja el guardián', () => {
    const u = leer('assets/js/data/usuarios.js');
    assert.ok(u.indexOf('await borrarRastro(uid') < u.indexOf('await deleteDoc(ref(uid))'), 'el rastro antes que el perfil');
    assert.match(leer('assets/js/auth/session-guard.js'), /sessionStorage\.setItem\('sgm\.rastro\.intento'/);
  });
  test('el panel no pinta HTML que escribió el visitante', () => {
    const p = leer('assets/js/admin/admin-actividad-visitante.js');
    assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(p));
  });
});
