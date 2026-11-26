// Firma de ODT Afinia · INDICADORES · PERIODO por fecha prevista (pedido del Ingeniero del 2026-11-24: «necesito que
// también exista un calendario para yo poder escoger a mi voluntad periodos a lo largo del año 2026»):
//   · dominio (odt_afinia_indicadores_periodo.js): rango INCLUSIVO en los dos extremos, extremos abiertos, «Desde»
//     después de «Hasta» (no se aplica, con su frase), fechas fuera de 2026 o que no existen, ODT sin fecha prevista
//     (fuera con periodo, dentro sin él), combinado con los demás filtros (contra un conteo hecho aparte en la prueba),
//     periodos rápidos con sus rangos (febrero y cada fin de mes; también años bisiestos), «Este mes» y «Mes pasado»,
//     la opción del selector que corresponde a unas fechas, el texto del periodo y los meses de la evolución mensual;
//   · pantalla: el bloque «Periodo (fecha prevista)» (fechas con min/max de 2026, «Periodo rápido» con todos sus
//     periodos), un periodo rápido llena las fechas y recalcula todo (tarjetas, tablas, gráficos, lista, resumen), las
//     fechas a mano (el selector las reconoce), «Desde» > «Hasta» (una línea clara y no se aplica), el foco se queda en
//     el campo, ODT sin fecha prevista (el resumen lo dice), «Quitar filtros» también quita el periodo, pulsar un mes en
//     la evolución mensual lo pone como periodo, la comparación con el MISMO periodo en los dos cortes, y un corte de la
//     versión 1 (también guarda la fecha prevista);
//   · corrección r1: vaciar una fecha con la tecla de borrar (Chrome solo avisa en el primer borrado) o escribir solo el
//     día (no avisa) se lee al soltar la tecla o al salir del campo; pasar con Tab no cambia el selector; un periodo sin
//     ODT muestra sus meses en 0; singular con 1 ODT.
// Datos INVENTADOS (tests/odt_afinia_indicadores_fixture.js): ninguna persona, empresa ni N.º real.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearDomFalso, crearFirestoreFalso } from './odt_afinia_ui_dobles.js';
import * as D from '../assets/js/domain/odt_afinia_indicadores.js';
import * as P from '../assets/js/domain/odt_afinia_indicadores_periodo.js';
import { crearRepositorioCortes } from '../assets/js/data/odt_afinia_cortes.js';
import { RESP_A, ALFA, BETA, GAMMA, AZT_1, AZT_2, JEFE_1, JEFE_2, JEFE_3, archivoBase, csv, odt, conConsultas } from './odt_afinia_indicadores_fixture.js';

const ADMIN = { uid: 'uid-admin-periodo-prueba', nombre: 'Persona Fictícia Úno', rol: 'admin', esAdmin: true, legacy: false };
const HEX = 'c3'.repeat(32);
const nros = (xs) => xs.map((o) => o.nro);
const cuenta = (c) => [c.total, c.generada, c.ejecutada, c.noEjecutada, c.cerrada, c.inactiva, c.otro];

// ═════════════════════════════════════════════════════════════════════════════
// Va ANTES de cualquier describe y de cualquier await de nivel superior (99 §234.6): en Node 20 (el del CI) un before()
// de raíz registrado después no llega a correr para los describe de pantalla («document is not defined»).
// ═════════════════════════════════════════════════════════════════════════════
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
const V = await import('../assets/js/ui/odt-afinia/indicadores-vista.js');
const B = await import('../assets/js/ui/odt-afinia/indicadores-periodo.js');
const { graficoMensual } = await import('../assets/js/ui/odt-afinia/indicadores-graficos.js');

/** Una ODT ya deduplicada (la forma de la versión 2), para las pruebas del dominio. */
const o = (nro, prevista, extra = {}) => ({
  nro, empresa: ALFA, tipo: 'TIPO UNO', zona: 'ZONA NORTE', subestacion: 'S/E PRUEBA UNO', prevista, cerrada: '', estado: 'GENERADA',
  principal: true, azt: AZT_1, jefe: JEFE_1, ...extra
});

// ═════════════════════════════════════════════════════════════════════════════
describe('dominio: leer y validar «Desde» y «Hasta»', () => {
  test('sin fechas: sin periodo (todo, como antes); una sola: ese lado abierto', () => {
    assert.deepEqual(P.validarPeriodo({}), { desde: '', hasta: '', activo: false, error: '' });
    assert.deepEqual(P.validarPeriodo({ desde: '2026-03-01' }), { desde: '2026-03-01', hasta: '', activo: true, error: '' });
    assert.deepEqual(P.validarPeriodo({ hasta: '2026-03-31' }), { desde: '', hasta: '2026-03-31', activo: true, error: '' });
    assert.deepEqual(P.validarPeriodo({ desde: '2026-03-05', hasta: '2026-03-05' }), { desde: '2026-03-05', hasta: '2026-03-05', activo: true, error: '' }, 'un solo día');
    assert.deepEqual(P.validarPeriodo({ desde: '  ', hasta: '' }), { desde: '', hasta: '', activo: false, error: '' });
  });
  test('«Desde» después de «Hasta»: NO se aplica y lo dice en una línea clara', () => {
    const p = P.validarPeriodo({ desde: '2026-03-31', hasta: '2026-03-01' });
    assert.equal(p.activo, false); assert.equal(p.desde, ''); assert.equal(p.hasta, '');
    assert.equal(p.error, '«Desde» (31/03/2026) es posterior a «Hasta» (01/03/2026): el periodo no se aplica. Corrija una de las dos fechas.');
    // Sin periodo aplicado, filtrar no quita nada.
    const xs = [o('90000301', '2026-03-10'), o('90000302', '')];
    assert.deepEqual(nros(P.filtrarPeriodo(xs, p)), ['90000301', '90000302']);
  });
  test('solo fechas de 2026; un día que no existe o una fecha a medio escribir no se aplican (y lo dicen)', () => {
    for (const [p, campo] of [[{ desde: '2025-12-31' }, '«Desde»'], [{ hasta: '2027-01-01' }, '«Hasta»'], [{ desde: '0002-10-01' }, '«Desde»']]) {
      const r = P.validarPeriodo(p);
      assert.equal(r.activo, false, JSON.stringify(p));
      assert.match(r.error, new RegExp('^La fecha ' + campo + ' \\(\\d\\d/\\d\\d/\\d{4}\\) está fuera de 2026: elija una entre el 01/01/2026 y el 31/12/2026\\. El periodo no se aplica\\.$'), r.error);
    }
    assert.deepEqual([P.PERIODO_MIN, P.PERIODO_MAX, P.PERIODO_ANIO], ['2026-01-01', '2026-12-31', 2026]);
    assert.deepEqual(P.validarPeriodo({ desde: '2026-01-01', hasta: '2026-12-31' }).activo, true, 'los dos bordes del año entran');
    for (const malo of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', 'abc', '2026-3-1', '32/01/2026']) {
      const r = P.validarPeriodo({ desde: malo });
      assert.equal(r.activo, false, malo);
      assert.equal(r.error, 'La fecha «Desde» está incompleta o no existe: escríbala completa (día, mes y año) o elíjala en el calendario. El periodo no se aplica.', malo);
    }
    // El navegador marca un campo a medio escribir (su valor llega vacío): tampoco se aplica.
    const r = P.validarPeriodo({ desde: '2026-03-01', hasta: '', ilegible: { hasta: true } });
    assert.equal(r.activo, false); assert.match(r.error, /^La fecha «Hasta» está incompleta o no existe/);
  });
  test('también se entiende «dd/mm/aaaa» (escrita a mano en un navegador sin calendario)', () => {
    assert.deepEqual(P.validarPeriodo({ desde: '01/03/2026', hasta: '31/3/2026' }), { desde: '2026-03-01', hasta: '2026-03-31', activo: true, error: '' });
    assert.equal(P.leerFecha(''), ''); assert.equal(P.leerFecha('29/02/2028'), '2028-02-29'); assert.equal(P.leerFecha('29/02/2026'), null);
  });
  test('textoPeriodo: «del … al …», «desde el …», «hasta el …»', () => {
    assert.equal(P.textoPeriodo({ desde: '2026-10-01', hasta: '2026-10-31' }), 'del 01/10/2026 al 31/10/2026');
    assert.equal(P.textoPeriodo({ desde: '2026-10-01', hasta: '' }), 'desde el 01/10/2026');
    assert.equal(P.textoPeriodo({ desde: '', hasta: '2026-10-31' }), 'hasta el 31/10/2026');
    assert.equal(P.textoPeriodo(P.SIN_PERIODO), '');
  });
});

describe('dominio: filtrar por el periodo (fecha prevista)', () => {
  const xs = [
    o('90000311', '2026-02-28'), o('90000312', '2026-03-01'), o('90000313', '2026-03-15'), o('90000314', '2026-03-31'),
    o('90000315', '2026-04-01'), o('90000316', ''), o('90000317', '2025-12-31')
  ];
  test('rango INCLUSIVO en los dos extremos', () => {
    const p = P.validarPeriodo({ desde: '2026-03-01', hasta: '2026-03-31' });
    assert.deepEqual(nros(P.filtrarPeriodo(xs, p)), ['90000312', '90000313', '90000314']);
    const dia = P.validarPeriodo({ desde: '2026-03-15', hasta: '2026-03-15' });
    assert.deepEqual(nros(P.filtrarPeriodo(xs, dia)), ['90000313']);
  });
  test('extremos abiertos: solo «Desde», solo «Hasta»', () => {
    assert.deepEqual(nros(P.filtrarPeriodo(xs, P.validarPeriodo({ desde: '2026-03-31' }))), ['90000314', '90000315']);
    assert.deepEqual(nros(P.filtrarPeriodo(xs, P.validarPeriodo({ hasta: '2026-03-01' }))), ['90000311', '90000312', '90000317'], 'sin «Desde» no hay límite por abajo');
  });
  test('sin fecha prevista: FUERA con un periodo y DENTRO sin periodo (cuenta como hoy)', () => {
    assert.ok(!nros(P.filtrarPeriodo(xs, P.validarPeriodo({ desde: '2026-01-01' }))).includes('90000316'));
    assert.ok(!nros(P.filtrarPeriodo(xs, P.validarPeriodo({ hasta: '2026-12-31' }))).includes('90000316'));
    assert.deepEqual(nros(P.filtrarPeriodo(xs, P.validarPeriodo({}))), nros(xs));
    assert.deepEqual(nros(P.filtrarPeriodo(xs, null)), nros(xs));
    assert.equal(P.contarSinPrevista(xs), 1);
    assert.equal(P.enPeriodo(o('90000318', ''), P.SIN_PERIODO), true);
    assert.equal(P.enPeriodo(o('90000318', ''), { desde: '2026-01-01', hasta: '' }), false);
  });
  test('combinado con los demás filtros (tipo, zona, contratista, AZT y jefe): igual a un conteo hecho aparte', () => {
    // 72 ODT inventadas repartidas por todo 2026 (y alguna sin fecha), con dos de cada cosa.
    const muchas = [];
    for (let i = 0; i < 72; i++) {
      const mes = (i % 12) + 1; const dia = ((i * 7) % 28) + 1;
      muchas.push(o('9000' + String(4000 + i), i % 17 === 0 ? '' : '2026-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0'), {
        empresa: i % 3 ? ALFA : BETA, tipo: i % 2 ? 'TIPO UNO' : 'TIPO DOS', zona: i % 5 ? 'ZONA NORTE' : 'ZONA SUR',
        azt: i % 4 ? AZT_1 : AZT_2, jefe: [JEFE_1, JEFE_2, JEFE_3][i % 3], estado: ['GENERADA', 'EJECUTADA', 'CERRADA', 'NO EJECUTADA'][i % 4]
      }));
    }
    const casos = [
      [{}, { desde: '2026-01-01', hasta: '2026-03-31' }], [{ empresa: BETA }, { desde: '2026-04-01', hasta: '2026-06-30' }],
      [{ azt: AZT_2, empresa: ALFA }, { desde: '2026-07-01' }], [{ jefe: JEFE_3, tipo: 'TIPO UNO' }, { hasta: '2026-08-15' }],
      [{ zona: 'ZONA SUR', azt: AZT_1 }, { desde: '2026-02-01', hasta: '2026-11-30' }], [{ empresa: ALFA }, {}],
      [{ tipo: 'TIPO DOS', zona: 'ZONA NORTE', empresa: BETA, azt: AZT_1, jefe: JEFE_1 }, { desde: '2026-01-01', hasta: '2026-12-31' }]
    ];
    for (const [filtros, fechas] of casos) {
      const p = P.validarPeriodo(fechas);
      const dominio = nros(P.filtrarConPeriodo(muchas, filtros, p));
      // A mano, sin el dominio: cada filtro pedido igual al de la ODT, y la fecha entre los dos extremos (incluidos).
      const aMano = muchas.filter((x) => Object.entries(filtros).every(([k, v]) => x[k] === v)
        && (!(fechas.desde || fechas.hasta) || (x.prevista !== '' && (!fechas.desde || x.prevista >= fechas.desde) && (!fechas.hasta || x.prevista <= fechas.hasta)))).map((x) => x.nro);
      assert.deepEqual(dominio, aMano, JSON.stringify([filtros, fechas]));
    }
    // Y los totales por estado del periodo son los de esas ODT (lo que muestran las tarjetas).
    const q = P.validarPeriodo({ desde: '2026-04-01', hasta: '2026-06-30' });
    const t = D.agregar(P.filtrarConPeriodo(muchas, {}, q)).totales;
    const sel = muchas.filter((x) => x.prevista >= '2026-04-01' && x.prevista <= '2026-06-30');
    assert.deepEqual(cuenta(t), [sel.length, ...['GENERADA', 'EJECUTADA', 'NO EJECUTADA', 'CERRADA', 'INACTIVA'].map((e) => sel.filter((x) => x.estado === e).length), 0]);
    // Los 12 meses suman las ODT con fecha; los 4 trimestres, lo mismo.
    const rap = P.periodosRapidos('');
    const suma = (claves) => claves.reduce((s, k) => { const r = rap.find((x) => x.clave === k); return s + P.filtrarPeriodo(muchas, r).length; }, 0);
    const conFecha = muchas.filter((x) => x.prevista).length;
    assert.equal(suma(rap.filter((x) => x.grupo === 'Meses').map((x) => x.clave)), conFecha);
    assert.equal(suma(['trim-1', 'trim-2', 'trim-3', 'trim-4']), conFecha);
    assert.equal(suma(['sem-1', 'sem-2']), conFecha);
    assert.equal(suma(['anio']), conFecha);
  });
  test('la comparación de dos cortes con el MISMO periodo en los dos', () => {
    const antes = [o('90000321', '2026-01-10'), o('90000322', '2026-02-10'), o('90000323', '2026-02-20', { estado: 'EJECUTADA' })];
    const ahora = [o('90000321', '2026-01-10', { estado: 'EJECUTADA' }), o('90000322', '2026-02-10', { estado: 'CERRADA', cerrada: '2026-03-01' }),
      o('90000323', '2026-02-20', { estado: 'CERRADA', cerrada: '2026-02-25' }), o('90000324', '2026-02-27')];
    const feb = P.validarPeriodo({ desde: '2026-02-01', hasta: '2026-02-28' });
    const c = D.compararCortes(P.filtrarConPeriodo(antes, {}, feb), P.filtrarConPeriodo(ahora, {}, feb));
    assert.deepEqual(nros(c.cambios), ['90000322', '90000323'], 'la 90000321 (enero) no entra');
    assert.deepEqual(nros(c.nuevas), ['90000324']);
    assert.deepEqual(c.totales.find((x) => x.clave === 'total'), { clave: 'total', antes: 2, ahora: 3, delta: 1 });
  });
});

describe('dominio: periodos rápidos', () => {
  test('todo 2026, los 12 meses (febrero y cada fin de mes), los 4 trimestres y los 2 semestres', () => {
    const r = P.periodosRapidos('');
    assert.deepEqual(r.map((x) => x.clave), ['anio', ...Array.from({ length: 12 }, (_, i) => 'mes-' + String(i + 1).padStart(2, '0')),
      'trim-1', 'trim-2', 'trim-3', 'trim-4', 'sem-1', 'sem-2']);
    const de = (k) => { const x = r.find((y) => y.clave === k); return [x.texto, x.desde, x.hasta]; };
    assert.deepEqual(de('anio'), ['Todo 2026', '2026-01-01', '2026-12-31']);
    const fines = ['31', '28', '31', '30', '31', '30', '31', '31', '30', '31', '30', '31'];
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    fines.forEach((f, i) => {
      const mm = String(i + 1).padStart(2, '0');
      assert.deepEqual(de('mes-' + mm), [nombres[i] + ' 2026', '2026-' + mm + '-01', '2026-' + mm + '-' + f]);
    });
    assert.deepEqual(de('trim-1'), ['1.er trimestre 2026 (ene–mar)', '2026-01-01', '2026-03-31']);
    assert.deepEqual(de('trim-2'), ['2.º trimestre 2026 (abr–jun)', '2026-04-01', '2026-06-30']);
    assert.deepEqual(de('trim-3'), ['3.er trimestre 2026 (jul–sep)', '2026-07-01', '2026-09-30']);
    assert.deepEqual(de('trim-4'), ['4.º trimestre 2026 (oct–dic)', '2026-10-01', '2026-12-31']);
    assert.deepEqual(de('sem-1'), ['1.er semestre 2026 (ene–jun)', '2026-01-01', '2026-06-30']);
    assert.deepEqual(de('sem-2'), ['2.º semestre 2026 (jul–dic)', '2026-07-01', '2026-12-31']);
    for (const x of r) assert.equal(P.validarPeriodo(x).error, '', x.clave + ': un periodo rápido siempre se aplica');
  });
  test('febrero de un año bisiesto (y los de siglo) y el fin de cada mes', () => {
    assert.equal(P.periodosRapidos('', 2028).find((x) => x.clave === 'mes-02').hasta, '2028-02-29');
    assert.equal(P.periodosRapidos('', 2100).find((x) => x.clave === 'mes-02').hasta, '2100-02-28');
    assert.equal(P.periodosRapidos('', 2000).find((x) => x.clave === 'mes-02').hasta, '2000-02-29');
    assert.deepEqual(P.periodoDeMes('2026-02'), { desde: '2026-02-01', hasta: '2026-02-28' });
    assert.deepEqual(P.periodoDeMes('2026-12'), { desde: '2026-12-01', hasta: '2026-12-31' });
    assert.deepEqual(P.periodoDeMes('2026-13'), { desde: '', hasta: '' });
    assert.equal(P.diasDelMes(2026, 4), 30);
  });
  test('«Este mes» y «Mes pasado», solo si caen en 2026', () => {
    const at = (hoy) => P.periodosRapidos(hoy).filter((x) => x.grupo === 'Atajos').map((x) => [x.clave, x.texto, x.desde, x.hasta]);
    assert.deepEqual(at('2026-11-24'), [['este-mes', 'Este mes (noviembre de 2026)', '2026-11-01', '2026-11-30'], ['mes-pasado', 'Mes pasado (octubre de 2026)', '2026-10-01', '2026-10-31']]);
    assert.deepEqual(at('2026-03-31'), [['este-mes', 'Este mes (marzo de 2026)', '2026-03-01', '2026-03-31'], ['mes-pasado', 'Mes pasado (febrero de 2026)', '2026-02-01', '2026-02-28']]);
    assert.deepEqual(at('2026-01-10'), [['este-mes', 'Este mes (enero de 2026)', '2026-01-01', '2026-01-31']], 'diciembre de 2025 no es de 2026');
    assert.deepEqual(at('2027-01-05'), [['mes-pasado', 'Mes pasado (diciembre de 2026)', '2026-12-01', '2026-12-31']]);
    assert.deepEqual(at('2027-03-05'), []);
    assert.deepEqual(at(''), []);
  });
  test('la opción del selector que corresponde a unas fechas', () => {
    const r = P.periodosRapidos('2026-11-24');
    assert.equal(P.rapidoDe({ desde: '', hasta: '' }, r), '');
    assert.equal(P.rapidoDe({ desde: '2026-03-01', hasta: '2026-03-31' }, r), 'mes-03');
    assert.equal(P.rapidoDe({ desde: '2026-11-01', hasta: '2026-11-30' }, r), 'mes-11', 'el mes antes que el atajo «Este mes»');
    assert.equal(P.rapidoDe({ desde: '2026-01-01', hasta: '2026-03-31' }, r), 'trim-1');
    assert.equal(P.rapidoDe({ desde: '2026-07-01', hasta: '2026-12-31' }, r), 'sem-2');
    assert.equal(P.rapidoDe({ desde: '2026-01-01', hasta: '2026-12-31' }, r), 'anio');
    assert.equal(P.rapidoDe({ desde: '2026-03-02', hasta: '2026-03-31' }, r), P.CLAVE_MEDIDA);
    assert.equal(P.rapidoDe({ desde: '2026-03-01', hasta: '' }, r), P.CLAVE_MEDIDA);
  });
});

describe('dominio: la evolución mensual con un periodo', () => {
  const porMes = [
    { mes: '2026-01', generadas: 3, cerradas: 0 }, { mes: '2026-02', generadas: 2, cerradas: 1 }, { mes: '2026-03', generadas: 0, cerradas: 0 },
    { mes: '2026-04', generadas: 4, cerradas: 2 }, { mes: '2026-05', generadas: 0, cerradas: 3 }
  ];
  test('solo los meses del periodo; los vacíos en 0; las cerradas de meses fuera, aparte', () => {
    assert.deepEqual(P.mesesDelPeriodo(porMes, { desde: '2026-04-01', hasta: '2026-04-30' }), { meses: [{ mes: '2026-04', generadas: 4, cerradas: 2 }], cerradasFuera: 4 });
    assert.deepEqual(P.mesesDelPeriodo([{ mes: '2026-02', generadas: 2, cerradas: 0 }], { desde: '2026-01-01', hasta: '2026-03-31' }).meses,
      [{ mes: '2026-01', generadas: 0, cerradas: 0 }, { mes: '2026-02', generadas: 2, cerradas: 0 }, { mes: '2026-03', generadas: 0, cerradas: 0 }]);
    // Un periodo que no empieza el día 1 usa el mes entero de cada extremo.
    assert.deepEqual(P.mesesDelPeriodo(porMes, { desde: '2026-02-15', hasta: '2026-03-10' }).meses.map((m) => m.mes), ['2026-02', '2026-03']);
  });
  test('un lado abierto llega hasta los datos (sin «Desde», desde enero de 2026)', () => {
    const r1 = P.mesesDelPeriodo(porMes, { desde: '2026-02-01', hasta: '' });
    assert.deepEqual(r1.meses.map((m) => m.mes), ['2026-02', '2026-03', '2026-04', '2026-05']); assert.equal(r1.cerradasFuera, 0);
    const r2 = P.mesesDelPeriodo(porMes.slice(1), { desde: '', hasta: '2026-03-31' });
    assert.deepEqual(r2.meses.map((m) => m.mes), ['2026-01', '2026-02', '2026-03']); assert.equal(r2.cerradasFuera, 5);
  });
  test('sin periodo, los meses tal cual', () => {
    assert.deepEqual(P.mesesDelPeriodo(porMes, P.SIN_PERIODO), { meses: porMes, cerradasFuera: 0 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Pantalla, con el doble de DOM (estricto como el navegador al agregar hijos) y el doble de Firestore con consultas.
const caja = () => document.createElement('div');
const botones = (el) => el.todos().filter((x) => x.tagName === 'BUTTON');
const boton = (el, texto) => botones(el).find((b) => b.textContent.includes(texto));
const porId = (el, id) => el.todos().find((x) => x.id === id);
const tarjetas = (c) => c.querySelectorAll('.odt-ind-tarjeta-valor').map((x) => x.textContent);
const resumen = (c) => c.querySelectorAll('.odt-ind-resumen-filtro')[0].textContent;
const lista = (c) => c.querySelectorAll('.odt-ind-lista')[0];
const filasDe = (t) => t.todos().filter((x) => x.tagName === 'TBODY')[0].childNodes.map((tr) => tr.childNodes.map((td) => td.textContent));
const tablaPorCaption = (c, t) => c.querySelectorAll('.odt-ind-tabla').find((x) => (x.todos().find((y) => y.tagName === 'CAPTION') || {}).textContent === t);
const opcionesDe = (sel) => sel.todos().filter((x) => x.tagName === 'OPTION');
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
/** Cambia un campo como lo haría la persona (valor + evento). */
async function poner(c, id, valor, evento = 'change') { const s = porId(c, id); s.value = valor; await s.disparar(evento); return s; }
/** Deja un corte guardado como los de la VERSIÓN 1 (sin azt ni jefe; con su fecha prevista, como todos). */
function aVersion1(fs, id) {
  const ruta = 'odt_afinia_cortes/' + id;
  const c = fs.store.get(ruta);
  fs.store.set(ruta, { ...c, version: 1 });
  for (let k = 0; k < c.nPartes; k++) {
    const p = fs.store.get(ruta + '/partes/' + k);
    fs.store.set(ruta + '/partes/' + k, { ...p, odts: p.odts.map(({ azt, jefe, ejecucion, equipo, ...resto }) => resto) });   // 99 §236: la versión 1 tampoco trae la ejecución ni el equipo
  }
}
const ID = B.IDS_PERIODO;
// archivoBase() (RESP_A, 8 ODT) por fecha prevista: enero 90000001 · febrero 90000002 (la más temprana de sus dos
// filas: 10/02), 90000003 · marzo 90000004, 90000005, 90000006, 90000007 · abril 90000008. Cerradas: 90000002 el 20/03,
// 90000004 el 02/03 y 90000006 el 30/04.

describe('pantalla: el bloque «Periodo (fecha prevista)»', () => {
  test('está junto a los filtros (antes de ellos), con «Periodo rápido», «Desde» y «Hasta» (fechas de 2026)', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    const bloque = c.querySelectorAll('.odt-ind-periodo')[0];
    assert.ok(bloque, 'el bloque');
    assert.equal(bloque.tagName, 'FIELDSET');
    assert.equal(bloque.todos().find((x) => x.tagName === 'LEGEND').textContent, 'Periodo (fecha prevista)');
    const filtros = c.querySelectorAll('.odt-ind-filtros')[0];
    const hermanos = bloque.parentNode.childNodes;
    assert.equal(hermanos.indexOf(filtros), hermanos.indexOf(bloque) + 1, 'justo antes de los filtros');
    // Los filtros de siempre no cambian.
    assert.deepEqual(filtros.todos().filter((x) => x.tagName === 'LABEL').map((x) => x.textContent), ['Tipo de trabajo', 'Zona', 'Contratista', 'AZT en sitio', 'Jefe de trabajo']);
    assert.deepEqual(bloque.todos().filter((x) => x.tagName === 'LABEL').map((x) => [x.textContent, x.htmlFor]), [['Periodo rápido', ID.rapido], ['Desde', ID.desde], ['Hasta', ID.hasta]]);
    for (const id of [ID.desde, ID.hasta]) {
      const f = porId(c, id);
      assert.equal(f.tagName, 'INPUT'); assert.equal(f.type, 'date', 'con el calendario del navegador');
      assert.equal(f.getAttribute('min'), '2026-01-01'); assert.equal(f.getAttribute('max'), '2026-12-31');
      assert.equal(f.value, '');
      assert.equal(f.getAttribute('aria-describedby'), ID.ayuda + ' ' + ID.error);
    }
    const sel = porId(c, ID.rapido);
    assert.equal(sel.tagName, 'SELECT');
    const textos = opcionesDe(sel).map((x) => x.textContent);
    for (const t of ['Sin periodo (todas las fechas)', 'Todo 2026', 'Enero 2026', 'Febrero 2026', 'Diciembre 2026', '1.er trimestre 2026 (ene–mar)',
      '4.º trimestre 2026 (oct–dic)', '1.er semestre 2026 (ene–jun)', '2.º semestre 2026 (jul–dic)']) assert.ok(textos.includes(t), t);
    assert.deepEqual(opcionesDe(sel).filter((x) => /^mes-\d\d$/.test(x.value)).map((x) => x.textContent),
      ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m) => m + ' 2026'), 'los 12 meses');
    const medida = opcionesDe(sel).find((x) => x.value === 'medida');
    assert.equal(medida.disabled, true, '«Fechas a la medida» no se elige de la lista: solo se muestra');
    assert.equal(medida.textContent, B.TEXTO_MEDIDA);
    assert.deepEqual(sel.todos().filter((x) => x.tagName === 'OPTGROUP').map((x) => x.getAttribute('label')).filter((g) => g !== 'Atajos'), ['Año', 'Meses', 'Trimestres', 'Semestres']);
    assert.equal(porId(c, ID.ayuda).textContent, B.AYUDA_PERIODO);
    assert.equal(porId(c, ID.error).textContent, '', 'sin error, la línea queda vacía (y no ocupa lugar)');
    assert.equal(resumen(c), 'Sin filtros: las 8 ODT del corte.');
    sinRestos(c);
  });
  test('un periodo rápido llena las fechas y TODO se recalcula: tarjetas, tablas, gráficos, resumen y lista', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    await poner(c, ID.rapido, 'mes-03');
    assert.equal(porId(c, ID.desde).value, '2026-03-01'); assert.equal(porId(c, ID.hasta).value, '2026-03-31');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/03/2026 al 31/03/2026): 4 de 8 ODT.');
    // Marzo: 90000004 CERRADA, 90000005 NO EJECUTADA, 90000006 CERRADA, 90000007 INACTIVA → % = 2 ÷ (4 − 1 − 1).
    assert.deepEqual(tarjetas(c), ['4', '0', '0', '2', '2', '100,0 %']);
    const porContratista = filasDe(c.querySelectorAll('.odt-ind-tabla-contratistas')[0]).map((f) => [f[0], f[1]]);
    assert.deepEqual(porContratista, [[BETA, '3'], [ALFA, '1']]);
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Por tipo de trabajo')).map((f) => [f[0], f[1]]).sort(), [['TIPO DOS', '2'], ['TIPO UNO', '2']]);
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Por zona')).map((f) => [f[0], f[1]]).sort(), [['ZONA NORTE', '2'], ['ZONA SUR', '2']]);
    // El gráfico por contratista: solo los de marzo.
    const svgs = c.todos().filter((x) => x.tagName === 'SVG');
    assert.equal(svgs.length, 2);
    assert.deepEqual(svgs[0].todos().filter((x) => x.getAttribute('class') === 'odt-ind-svg-etq').map((x) => x.textContent), [BETA, ALFA]);
    // La evolución mensual: solo marzo (4 generadas; 1 cerrada en marzo y la otra en abril, fuera del gráfico, se dice).
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Generadas y cerradas por mes')), [['marzo de 2026', '4', '1']]);
    assert.equal(c.querySelectorAll('.odt-ind-cerradas-fuera')[0].textContent, V.textoCerradasFuera(1));
    // Con 1, en singular; con más, en plural.
    assert.equal(V.textoCerradasFuera(1), '1 ODT de este periodo se cerró en un mes fuera de él: cuenta en «Cerradas», pero no tiene columna en este gráfico (solo muestra los meses del periodo).');
    assert.equal(V.textoCerradasFuera(3), '3 ODT de este periodo se cerraron en un mes fuera de él: cuentan en «Cerradas», pero no tienen columna en este gráfico (solo muestra los meses del periodo).');
    // La lista de un número respeta el periodo y lo nombra.
    await botones(c).find((b) => b.getAttribute('aria-label') === 'Ver las 2 ODT: Cerradas').disparar('click');
    assert.equal(lista(c).querySelectorAll('.odt-ind-lista-titulo')[0].textContent, 'ODT · Cerradas · Periodo: del 01/03/2026 al 31/03/2026 (2)');
    assert.deepEqual(filasDe(lista(c)).map((f) => [f[0], f[6]]), [['90000004', '01/03/2026'], ['90000006', '04/03/2026']]);
    // Todo 2026 = todas (las 8 traen fecha prevista de 2026).
    await poner(c, ID.rapido, 'anio');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/01/2026 al 31/12/2026): 8 de 8 ODT.');
    assert.deepEqual(tarjetas(c), ['8', '1', '1', '3', '2', '50,0 %', '1']);
    // Un trimestre (enero–marzo) y luego sin periodo.
    await poner(c, ID.rapido, 'trim-1');
    assert.deepEqual(tarjetas(c), ['7', '1', '1', '3', '2', '60,0 %']);
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Generadas y cerradas por mes')).map((f) => f[0]), ['enero de 2026', 'febrero de 2026', 'marzo de 2026']);
    await poner(c, ID.rapido, '');
    assert.equal(porId(c, ID.desde).value, ''); assert.equal(porId(c, ID.hasta).value, '');
    assert.equal(resumen(c), 'Sin filtros: las 8 ODT del corte.');
    assert.equal(c.querySelectorAll('.odt-ind-cerradas-fuera').length, 0);
    sinRestos(c);
  });
  test('fechas a mano: extremos incluidos y abiertos; el selector reconoce el periodo; el foco se queda en el campo', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    const desde = porId(c, ID.desde); const hastaF = porId(c, ID.hasta); const sel = porId(c, ID.rapido);
    const bloque = c.querySelectorAll('.odt-ind-periodo')[0];
    desde.focus();
    await poner(c, ID.desde, '2026-02-10');
    assert.equal(resumen(c), 'Con filtros (Periodo: desde el 10/02/2026): 7 de 8 ODT.', 'solo «Desde»: 90000002 (10/02) entra');
    assert.equal(sel.value, 'medida', '«Fechas a la medida»');
    assert.equal(dom.activeElement, desde, 'el foco se queda en «Desde»');
    assert.equal(c.querySelectorAll('.odt-ind-periodo')[0], bloque, 'el bloque no se rehízo');
    hastaF.focus();
    await poner(c, ID.hasta, '2026-02-10', 'input');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 10/02/2026 al 10/02/2026): 1 de 8 ODT.', 'un solo día, incluido');
    assert.equal(dom.activeElement, hastaF);
    await poner(c, ID.desde, '');
    assert.equal(resumen(c), 'Con filtros (Periodo: hasta el 10/02/2026): 2 de 8 ODT.', 'solo «Hasta»: enero y la del 10/02');
    // Sin «Desde», la evolución empieza en enero; la cerrada de marzo (90000002) queda fuera del gráfico y se dice.
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Generadas y cerradas por mes')), [['enero de 2026', '1', '0'], ['febrero de 2026', '1', '0']]);
    assert.equal(c.querySelectorAll('.odt-ind-cerradas-fuera')[0].textContent, V.textoCerradasFuera(1));
    // Escribir las fechas de un mes entero: el selector lo muestra.
    await poner(c, ID.desde, '2026-04-01'); await poner(c, ID.hasta, '2026-04-30');
    assert.equal(sel.value, 'mes-04');
    assert.deepEqual(tarjetas(c), ['1', '0', '0', '0', '0', '0,0 %', '1'], 'abril: la de estado desconocido');
    sinRestos(c);
  });
  test('«Desde» después de «Hasta»: una línea clara, el periodo no se aplica y el resumen lo dice', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    await poner(c, ID.desde, '2026-03-31'); await poner(c, ID.hasta, '2026-03-01');
    assert.equal(porId(c, ID.error).textContent, '«Desde» (31/03/2026) es posterior a «Hasta» (01/03/2026): el periodo no se aplica. Corrija una de las dos fechas.');
    assert.equal(porId(c, ID.error).getAttribute('role'), 'status');
    assert.equal(resumen(c), 'Sin filtros: las 8 ODT del corte. ' + V.NOTA_PERIODO_NO_APLICA);
    assert.deepEqual(tarjetas(c), ['8', '1', '1', '3', '2', '50,0 %', '1'], 'como sin periodo');
    assert.equal(porId(c, ID.rapido).value, 'medida');
    // Corregida, se aplica y la línea se va.
    await poner(c, ID.hasta, '2026-04-30');
    assert.equal(porId(c, ID.error).textContent, '');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 31/03/2026 al 30/04/2026): 1 de 8 ODT.');
    // A medio escribir (el navegador lo marca y entrega ''): tampoco se aplica.
    const h = porId(c, ID.hasta);
    h.validity = { badInput: true }; h.value = ''; await h.disparar('input');
    assert.match(porId(c, ID.error).textContent, /^La fecha «Hasta» está incompleta o no existe/);
    assert.ok(resumen(c).endsWith(V.NOTA_PERIODO_NO_APLICA));
    sinRestos(c);
  });
  test('vaciar una fecha con la tecla de borrar (Chrome solo avisa en el primer borrado): ese lado queda abierto', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    await poner(c, ID.desde, '2026-02-01');
    const hastaF = await poner(c, ID.hasta, '2026-02-28');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/02/2026 al 28/02/2026): 2 de 8 ODT.');
    hastaF.focus();
    // 1.er borrado (el día): el valor pasa de la fecha a '' con el campo «a medio escribir»; Chrome sí avisa con «input».
    hastaF.validity = { badInput: true }; hastaF.value = '';
    await hastaF.disparar('input'); await hastaF.disparar('keyup');
    assert.match(porId(c, ID.error).textContent, /^La fecha «Hasta» está incompleta o no existe/);
    assert.ok(resumen(c).endsWith(V.NOTA_PERIODO_NO_APLICA), resumen(c));
    // 2.º borrado (el mes): para el navegador nada cambió; no hay «input» ni «change», solo se suelta la tecla.
    await hastaF.disparar('keyup');
    assert.match(porId(c, ID.error).textContent, /^La fecha «Hasta» está incompleta/);
    // 3.er borrado (el año): el campo queda vacío del todo (ya no «a medio escribir»); tampoco hay «input» ni «change».
    hastaF.validity = { badInput: false };
    await hastaF.disparar('keyup');
    assert.equal(porId(c, ID.error).textContent, '', 'la línea de error se va');
    assert.equal(resumen(c), 'Con filtros (Periodo: desde el 01/02/2026): 7 de 8 ODT.', '«Hasta» vacío: ese lado queda abierto');
    assert.equal(porId(c, ID.rapido).value, 'medida');
    assert.equal(dom.activeElement, hastaF, 'el foco se queda en el campo');
    // Si se sale del campo sin soltar allí la última tecla, al salir también se vuelve a leer.
    await poner(c, ID.hasta, '2026-02-28');
    const desdeF = porId(c, ID.desde);
    desdeF.validity = { badInput: true }; desdeF.value = '';
    await desdeF.disparar('input');
    assert.match(porId(c, ID.error).textContent, /^La fecha «Desde» está incompleta/);
    desdeF.validity = { badInput: false };
    await desdeF.disparar('blur');
    assert.equal(porId(c, ID.error).textContent, '');
    assert.equal(resumen(c), 'Con filtros (Periodo: hasta el 28/02/2026): 3 de 8 ODT.');
    // Vaciadas las dos: sin periodo, como al principio.
    hastaF.validity = { badInput: true }; hastaF.value = ''; await hastaF.disparar('input');
    hastaF.validity = { badInput: false }; await hastaF.disparar('keyup');
    assert.equal(resumen(c), 'Sin filtros: las 8 ODT del corte.');
    assert.equal(porId(c, ID.rapido).value, '');
    sinRestos(c);
  });
  test('un periodo sin ninguna ODT (diciembre): la evolución mensual muestra sus meses en 0', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    await poner(c, ID.rapido, 'mes-12');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/12/2026 al 31/12/2026): 0 de 8 ODT. ' + V.NOTA_SIN_RESULTADOS);
    assert.equal(tarjetas(c)[0], '0');
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Generadas y cerradas por mes')), [['diciembre de 2026', '0', '0']]);
    assert.ok(!c.textContent.includes('Sin fechas para la evolución mensual.'));
    assert.equal(c.querySelectorAll('.odt-ind-cerradas-fuera').length, 0);
    // El gráfico se dibuja sin cuentas rotas (ningún NaN en sus medidas).
    const svgMes = c.todos().filter((x) => x.tagName === 'SVG')[0];
    assert.ok(svgMes, 'el gráfico de la evolución mensual');
    for (const r of svgMes.todos().filter((x) => x.tagName === 'RECT')) for (const k of ['x', 'y', 'width', 'height']) assert.ok(!/NaN/.test(String(r.getAttribute(k))), k);
    // El 4.º trimestre: octubre, noviembre y diciembre, los tres en 0.
    await poner(c, ID.rapido, 'trim-4');
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Generadas y cerradas por mes')).map((f) => f.join('|')), ['octubre de 2026|0|0', 'noviembre de 2026|0|0', 'diciembre de 2026|0|0']);
    // Solo «Desde», después de los datos: el mes de «Desde», en 0.
    await poner(c, ID.rapido, '');
    await poner(c, ID.desde, '2026-11-15');
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Generadas y cerradas por mes')), [['noviembre de 2026', '0', '0']]);
    sinRestos(c);
  });
  test('ODT sin fecha prevista: con periodo quedan fuera y el resumen dice cuántas; sin periodo cuentan', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, csv([
      odt('90000331', { prevista: '02/03/2026 08:00' }), odt('90000332', { prevista: '' }), odt('90000333', { prevista: '', empresa: BETA }),
      odt('90000334', { prevista: '15/07/2026 08:00', estado: 'CERRADA', cerrada: '20/07/2026 08:00' })
    ]));
    const { c } = await montar(fs);
    assert.equal(resumen(c), 'Sin filtros: las 4 ODT del corte.');
    await poner(c, ID.rapido, 'anio');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/01/2026 al 31/12/2026): 2 de 4 ODT. ' + V.textoSinPrevista(2));
    assert.equal(V.textoSinPrevista(2), '2 ODT sin fecha prevista no entran en el periodo.');
    assert.equal(V.textoSinPrevista(1), '1 ODT sin fecha prevista no entra en el periodo.', 'con 1, en singular');
    // Con otro filtro, cuenta las de ese filtro.
    await poner(c, 'odtIndEmpresa', BETA);
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/01/2026 al 31/12/2026 · Contratista: ' + BETA + '): 0 de 4 ODT. 1 ODT sin fecha prevista no entra en el periodo. ' + V.NOTA_SIN_RESULTADOS);
    sinRestos(c);
  });
  test('se combina con los demás filtros (contratista, AZT, jefe…) y «Quitar filtros» también quita el periodo', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    await poner(c, ID.rapido, 'trim-1');
    await poner(c, 'odtIndEmpresa', BETA);
    await poner(c, 'odtIndAzt', AZT_1);
    // BETA en el 1.er trimestre: 90000005 (AZT_1), 90000006 (AZT_2), 90000007 (AZT_1) → con AZT_1, dos.
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/01/2026 al 31/03/2026 · Contratista: ' + BETA + ' · AZT en sitio: ' + AZT_1 + '): 2 de 8 ODT. ' + V.NOTA_CONTEO_PERSONA);
    assert.deepEqual(tarjetas(c), ['2', '0', '0', '0', '2', '—']);
    await poner(c, ID.rapido, 'mes-04');
    assert.ok(resumen(c).includes('0 de 8 ODT. ' + V.NOTA_SIN_RESULTADOS), resumen(c));
    // Sin ninguna ODT, la evolución mensual igual muestra el mes del periodo, en 0 (no «Sin fechas…»).
    assert.ok(!c.textContent.includes('Sin fechas para la evolución mensual.'));
    assert.deepEqual(filasDe(tablaPorCaption(c, 'Generadas y cerradas por mes')), [['abril de 2026', '0', '0']]);
    assert.ok(c.textContent.includes(V.SIN_GRAFICO_CONTRATISTA));
    sinRestos(c);
    await boton(c, 'Quitar filtros').disparar('click');
    assert.equal(resumen(c), 'Sin filtros: las 8 ODT del corte.');
    for (const id of [ID.rapido, ID.desde, ID.hasta, 'odtIndEmpresa', 'odtIndAzt']) assert.equal(porId(c, id).value, '', id);
    assert.equal(porId(c, ID.error).textContent, '');
    assert.deepEqual(tarjetas(c), ['8', '1', '1', '3', '2', '50,0 %', '1']);
    // Después de quitarlo, el mismo periodo se puede volver a poner.
    await poner(c, ID.rapido, 'mes-04');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/04/2026 al 30/04/2026): 1 de 8 ODT.');
    // También con las fechas en error: «Quitar filtros» limpia la línea.
    await poner(c, ID.desde, '2026-05-01');
    assert.ok(porId(c, ID.error).textContent);
    await boton(c, 'Quitar filtros').disparar('click');
    assert.equal(porId(c, ID.error).textContent, '');
    assert.equal(resumen(c), 'Sin filtros: las 8 ODT del corte.');
  });
  test('pulsar un mes en la evolución mensual lo pone como periodo (y el foco va al periodo)', async () => {
    const fs = nuevoFs();
    await guardarCorte(fs, archivoBase());
    const { c } = await montar(fs);
    const btn = c.querySelectorAll('.odt-ind-mes-btn').find((b) => b.textContent === 'febrero de 2026');
    assert.ok(btn, 'en «Ver los datos del gráfico», cada mes es un botón (para el teclado)');
    assert.equal(btn.getAttribute('aria-label'), 'Ver solo febrero de 2026 (lo pone como periodo)');
    await btn.disparar('click');
    assert.equal(porId(c, ID.rapido).value, 'mes-02');
    assert.equal(porId(c, ID.desde).value, '2026-02-01'); assert.equal(porId(c, ID.hasta).value, '2026-02-28');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/02/2026 al 28/02/2026): 2 de 8 ODT.');
    assert.equal(dom.activeElement, porId(c, ID.rapido), 'el foco pasa al selector del periodo (el botón pulsado se rehízo)');
    assert.ok(c.querySelectorAll('.odt-ind-periodo')[0].desplazado >= 1, 'la caja del periodo se lleva a la vista');
    // La columna del gráfico también (con el ratón).
    const col = c.todos().filter((x) => x.tagName === 'RECT' && /odt-ind-svg-col--elegible/.test(x.getAttribute('class') || ''));
    assert.equal(col.length, 2, 'febrero: generadas y cerradas');
    await poner(c, ID.rapido, '');
    const abril = c.todos().filter((x) => x.tagName === 'RECT' && /odt-ind-svg-col--elegible/.test(x.getAttribute('class') || ''))
      .find((x) => (x.todos().find((y) => y.tagName === 'TITLE') || {}).textContent.startsWith('abril de 2026'));
    await abril.disparar('click');
    assert.equal(porId(c, ID.rapido).value, 'mes-04');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/04/2026 al 30/04/2026): 1 de 8 ODT.');
    sinRestos(c);
  });
  test('la comparación con el corte anterior usa el MISMO periodo en los dos cortes', async () => {
    const fs = nuevoFs();
    // Del corte anterior al nuevo, la 90000001 (prevista en enero) pasa de GENERADA a EJECUTADA.
    const despues = archivoBase().replace(/90000001\|SI\|([^\r]*)\|GENERADA\|/, '90000001|SI|$1|EJECUTADA|');
    await guardarCorte(fs, archivoBase(), 'INFORME_ODT_20260401080000_antes.csv');
    await guardarCorte(fs, despues, 'INFORME_ODT_20260410080000_despues.csv');
    const { c, r } = await montar(fs);
    await r.vista.anterior;
    const zona = () => c.querySelectorAll('.odt-ind-seccion').find((x) => x.getAttribute('aria-label') === 'Comparación con el corte anterior');
    await hasta(() => zona().textContent.includes('ODT que cambiaron de estado (1)'));
    assert.ok(!zona().textContent.includes(V.NOTA_COMPARAR_PERIODO), 'sin periodo, sin la línea');
    await poner(c, ID.rapido, 'mes-02');
    assert.ok(zona().textContent.includes('ODT que cambiaron de estado (0)'), 'en febrero no cambió nada');
    assert.equal(zona().querySelectorAll('.odt-ind-comparar-periodo')[0].textContent, 'Periodo: del 01/02/2026 al 28/02/2026. ' + V.NOTA_COMPARAR_PERIODO);
    const porEstado = () => Object.fromEntries(filasDe(tablaPorCaption(zona(), 'Por estado')).map((f) => [f[0], f.slice(1)]));
    assert.deepEqual(porEstado().Generadas, ['2', '2', '0'], 'antes y ahora, con el mismo periodo');
    await poner(c, ID.rapido, 'mes-01');
    assert.ok(zona().textContent.includes('ODT que cambiaron de estado (1)'));
    assert.deepEqual(porEstado().Generadas, ['1', '1', '0']);
    assert.deepEqual(porEstado()['Por ejecutar'], ['1', '0', '−1']);
    assert.deepEqual(porEstado()['Ejecutadas sin cerrar'], ['0', '1', '+1']);
    // Con un periodo y un contratista a la vez, los dos se aplican a los dos cortes.
    await poner(c, 'odtIndEmpresa', BETA);
    assert.ok(zona().textContent.includes('ODT que cambiaron de estado (0)'));
    assert.deepEqual(porEstado().Generadas, ['0', '0', '0']);
    sinRestos(c);
  });
  test('un corte de la VERSIÓN 1 (sin AZT ni jefe) también se filtra por periodo, y su comparación también', async () => {
    const fs = nuevoFs();
    const viejo = await guardarCorte(fs, archivoBase(), 'INFORME_ODT_20260401080000_antes.csv');
    aVersion1(fs, viejo.id);
    const nuevo = await guardarCorte(fs, archivoBase().replace(/90000003\|SI\|([^\r]*)\|EJECUTADA\|/, '90000003|SI|$1|CERRADA|'), 'INFORME_ODT_20260410080000_despues.csv');
    aVersion1(fs, nuevo.id);
    const { c, r } = await montar(fs, { vista: 'corte', corteId: nuevo.id });
    assert.equal(r.corte.version, 1);
    assert.equal(porId(c, 'odtIndAzt').disabled, true, 'los filtros por persona siguen deshabilitados');
    assert.equal(porId(c, ID.rapido).disabled, false, 'el periodo sí se puede usar');
    await poner(c, ID.rapido, 'mes-02');
    assert.equal(resumen(c), 'Con filtros (Periodo: del 01/02/2026 al 28/02/2026): 2 de 8 ODT.');
    assert.deepEqual(tarjetas(c), ['2', '0', '0', '2', '0', '100,0 %']);
    await r.vista.anterior;
    const zona = () => c.querySelectorAll('.odt-ind-seccion').find((x) => x.getAttribute('aria-label') === 'Comparación con el corte anterior');
    await hasta(() => zona().textContent.includes('ODT que cambiaron de estado (1)'));
    assert.ok(zona().textContent.includes(V.NOTA_COMPARAR_PERIODO));
    await poner(c, ID.rapido, 'mes-03');
    assert.ok(zona().textContent.includes('ODT que cambiaron de estado (0)'));
    assert.ok(!c.textContent.includes('INCOMPLETO'));
    sinRestos(c);
  });
});

describe('pantalla: piezas del bloque y del gráfico', () => {
  test('el bloque solo: «Este mes» y «Mes pasado» según hoy; un rápido llena las fechas; un aviso por cambio', async () => {
    const llamadas = [];
    const b = B.crearBloquePeriodo({ alCambiar: (p) => llamadas.push(p), hoy: '2026-11-24' });
    const c = caja(); c.appendChild(b.elemento);
    const textos = opcionesDe(porId(c, ID.rapido)).map((x) => x.textContent);
    assert.ok(textos.includes('Este mes (noviembre de 2026)') && textos.includes('Mes pasado (octubre de 2026)'), textos.join(' | '));
    await poner(c, ID.rapido, 'este-mes');
    assert.deepEqual([porId(c, ID.desde).value, porId(c, ID.hasta).value, porId(c, ID.rapido).value], ['2026-11-01', '2026-11-30', 'este-mes']);
    assert.deepEqual(llamadas, [{ desde: '2026-11-01', hasta: '2026-11-30', activo: true, error: '' }]);
    // El navegador avisa con «input» y con «change»: se recalcula una sola vez.
    const d = porId(c, ID.desde); d.value = '2026-11-02';
    await d.disparar('input'); await d.disparar('change');
    assert.equal(llamadas.length, 2);
    assert.equal(porId(c, ID.rapido).value, 'medida');
    // El mismo mes por su nombre o por «Mes pasado»: mismas fechas, nada que recalcular de más.
    await poner(c, ID.rapido, 'mes-10'); await poner(c, ID.rapido, 'mes-pasado');
    assert.equal(llamadas.length, 3);
    b.limpiar();
    assert.deepEqual([porId(c, ID.desde).value, porId(c, ID.hasta).value, porId(c, ID.rapido).value], ['', '', '']);
    assert.deepEqual(b.periodo(), P.SIN_PERIODO);
    // Otro año: sin atajos.
    const otro = B.crearBloquePeriodo({ hoy: '2027-06-01' });
    assert.ok(!otro.rapidos.some((x) => x.grupo === 'Atajos'));
    // Hoy en Colombia (UTC−5): a las 03:00 UTC del 25 todavía es el 24.
    assert.equal(B.hoyEnColombia(new Date('2026-11-25T03:00:00Z')), '2026-11-24');
    assert.equal(B.hoyEnColombia(new Date('2026-11-25T06:00:00Z')), '2026-11-25');
    sinRestos(c);
  });
  test('el bloque solo: se vuelve a leer al soltar una tecla y al salir del campo, sin recalcular de más', async () => {
    const llamadas = [];
    const b = B.crearBloquePeriodo({ alCambiar: (p) => llamadas.push(p), hoy: '2026-11-24' });
    const c = caja(); c.appendChild(b.elemento);
    const d = porId(c, ID.desde); const hs = porId(c, ID.hasta); const sel = porId(c, ID.rapido); const err = porId(c, ID.error);
    await poner(c, ID.rapido, 'este-mes');
    assert.equal(llamadas.length, 1);
    // Pasar con Tab por las dos fechas (se suelta la tecla en cada una y luego se sale): nada cambia.
    for (const el of [d, hs]) { await el.disparar('keyup'); await el.disparar('blur'); }
    assert.equal(llamadas.length, 1, 'sin recalcular');
    assert.equal(sel.value, 'este-mes', '«Este mes» sigue elegido (no pasa a «Noviembre 2026»)');
    // Escribir solo el día en «Hasta» vacío (p. ej. «15/mm/aaaa»): el valor sigue '' y Chrome no avisa; al soltar la
    // tecla, la línea dice que está incompleta y el periodo no se aplica.
    b.limpiar(); llamadas.length = 0;
    await poner(c, ID.desde, '2026-03-01');
    assert.deepEqual(llamadas, [{ desde: '2026-03-01', hasta: '', activo: true, error: '' }]);
    hs.validity = { badInput: true };
    await hs.disparar('keyup');
    assert.equal(err.textContent, P.ERRORES_PERIODO.ilegible('hasta'));
    assert.deepEqual(b.periodo(), { desde: '', hasta: '', activo: false, error: P.ERRORES_PERIODO.ilegible('hasta') });
    assert.equal(sel.value, 'medida');
    assert.equal(llamadas.length, 2);
    await hs.disparar('keyup'); await hs.disparar('blur');
    assert.equal(llamadas.length, 2, 'el mismo aviso: no se recalcula de más');
    // Completa: se aplica y la línea se va.
    hs.validity = { badInput: false }; hs.value = '2026-03-15';
    await hs.disparar('input'); await hs.disparar('keyup'); await hs.disparar('change');
    assert.equal(llamadas.length, 3);
    assert.deepEqual(b.periodo(), { desde: '2026-03-01', hasta: '2026-03-15', activo: true, error: '' });
    assert.equal(err.textContent, '');
    sinRestos(c);
  });
  test('graficoMensual con los meses de un periodo: no rellena desde enero; solo los meses elegibles se pulsan', async () => {
    const elegidos = [];
    const g = graficoMensual([{ mes: '2026-03', generadas: 2, cerradas: 1 }, { mes: '2026-04', generadas: 0, cerradas: 0 }],
      { rellenar: false, alElegirMes: (m) => elegidos.push(m), elegible: (m) => m === '2026-03' });
    assert.deepEqual(filasDe(g.todos().find((x) => x.tagName === 'TABLE')), [['marzo de 2026', '2', '1'], ['abril de 2026', '0', '0']]);
    const btns = g.querySelectorAll('.odt-ind-mes-btn');
    assert.deepEqual(btns.map((b) => b.textContent), ['marzo de 2026'], 'abril no es elegible: sin botón');
    await btns[0].disparar('click');
    const cols = g.todos().filter((x) => x.tagName === 'RECT' && /elegible/.test(x.getAttribute('class') || ''));
    assert.equal(cols.length, 2);
    await cols[1].disparar('click');
    assert.deepEqual(elegidos, ['2026-03', '2026-03']);
    assert.ok(g.textContent.includes('Pulse una columna (o un mes en «Ver los datos del gráfico») para ver solo ese mes.'));
    // Sin opciones, como siempre (rellena desde enero, nada se pulsa).
    const g2 = graficoMensual([{ mes: '2026-03', generadas: 2, cerradas: 1 }]);
    assert.equal(filasDe(g2.todos().find((x) => x.tagName === 'TABLE')).length, 3);
    assert.equal(g2.querySelectorAll('.odt-ind-mes-btn').length, 0);
    assert.ok(!g2.textContent.includes('Pulse una columna'));
  });
});
