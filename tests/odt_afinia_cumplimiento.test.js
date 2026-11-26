// Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE (99 §236, pedido del Ingeniero del 2026-11-26) · DOMINIO PURO:
//   · lectura del CSV: la fecha de ejecución sale de «FECHA Y HORA AZT - RECIBE ZT» (solo la fecha), opcional (si falta
//     la columna, se avisa), de la primera fila que la traiga (si otra trae otra, se avisa); el corte nuevo es la
//     versión 3 (13 campos por ODT: con la ejecución y el EQUIPO, que la tabla de los avisos muestra);
//   · días calendario sin horas; la fecha del corte en COLOMBIA (UTC−5) cuando la hora viene del nombre del archivo
//     (UTC), también cerca de la medianoche UTC y en el cambio de año;
//   · umbrales exactos (9/10/14/15/19/20/21) en abiertas y cerradas; franjas; próximo aviso;
//   · «fecha por revisar»: vacía, año fuera de 2020–2030 (incluidos los rezagos absurdos de decenas de miles de días),
//     ejecución posterior al corte, cierre anterior a la ejecución, CERRADA sin cierre; fuera del % y sin avisos;
//   · % de cumplimiento (las abiertas con ≤ 20 días no cuentan), mediana (impar/par), por contratista;
//   · cortes de la versión 1 y 2 sin ejecución;
//   · configuración de los avisos (forma exacta de 6 claves, con audienciaScript: el script de Google aprobado; topes,
//     correos, nombres, repetidos);
//   · plan de avisos: el más alto la primera vez y los menores «omitido»; cada umbral una sola vez; error → se toma;
//     uno menor nunca después de uno mayor; una reserva ABANDONADA por otro correo (proceso cortado) se toma, y una cuyo
//     correo sí salió no se repite; una cuyo correo sigue EN COLA o en manos del script, no (avisosAbandonados);
//   · sin la hora de descarga en el nombre del archivo, el corte no genera avisos (corteConHoraDeDescarga);
//   · 99 §236 (envío por el script de Google): el estado de cada correo en llano (textoEstadoCorreo), el resultado del
//     reproceso («quedaron en cola…»), el correo demasiado grande va solo con el texto (correoParaCola);
//   · armado de los correos: asuntos y textos de cada umbral (singular y plural), saludo con los nombres de la
//     configuración, tabla por contratista, «Situación» en el de 20, pie con la fecha de Colombia y el responsable.
// Datos INVENTADOS (personas, contratistas, correos @prueba.test y N.º que empiezan por 9).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../assets/js/domain/odt_afinia_indicadores.js';
import * as C from '../assets/js/domain/odt_afinia_cumplimiento.js';
import * as A from '../assets/js/domain/odt_afinia_cumplimiento_avisos.js';
import { planCorte, CAMPOS_ODT_POR_VERSION, odtValida, unirPartes } from '../assets/js/data/odt_afinia_cortes_lotes.js';
import { RESP_A, ALFA, BETA, GAMMA, odt, csv } from './odt_afinia_indicadores_fixture.js';

const ENCABEZADOS_AFINIA_FIXTURE = D.ENCABEZADOS_AFINIA;

const ZT = 'FECHA Y HORA AZT - RECIBE ZT';
/** Una ODT de un corte de la versión 3 (como la guarda odtDeFila). */
const o3 = (nro, { estado = 'EJECUTADA', ejecucion = '2026-11-01', cerrada = '', empresa = ALFA, subestacion = 'S/E PRUEBA UNO', equipo = 'EQUIPO FICTICIO UNO' } = {}) => ({
  nro, empresa, tipo: 'TIPO UNO', zona: 'ZONA NORTE', subestacion, prevista: '2026-10-30', cerrada, estado, principal: true,
  azt: 'AZT FICTICIO UNO', jefe: 'JEFE FICTICIO UNO', ejecucion, equipo
});
const CORTE = '2026-11-21';   // la fecha del corte (Colombia) de casi todas las pruebas

describe('lectura: la fecha de ejecución (FECHA Y HORA AZT - RECIBE ZT) y el corte de la versión 3', () => {
  test('se lee solo la fecha; vacía o ilegible queda vacía; el archivo dice si trae la columna', () => {
    assert.ok(ENCABEZADOS_AFINIA_FIXTURE.includes(ZT));
    const l = D.leerCsv(csv([
      odt('90000301', { estado: 'EJECUTADA', extra: { [ZT]: '05/11/2026 23:59' } }),
      odt('90000302', { estado: 'CERRADA', cerrada: '20/11/2026 08:00', extra: { [ZT]: '01/11/2026 00:10' } }),
      odt('90000303', { estado: 'EJECUTADA', extra: { [ZT]: '' } }),
      odt('90000304', { estado: 'EJECUTADA', extra: { [ZT]: '31/02/2026 10:00' } })
    ]));
    assert.equal(l.traeEjecucion, true);
    const a = D.analizarResponsable(l, RESP_A);
    const por = Object.fromEntries(a.odts.map((o) => [o.nro, o.ejecucion]));
    assert.deepEqual(por, { 90000301: '2026-11-05', 90000302: '2026-11-01', 90000303: '', 90000304: '' });
    assert.equal(D.CAMPOS_OPCIONALES.ejecucion, ZT);
    assert.ok(!D.ENCABEZADOS_MINIMOS.includes(ZT), 'no es de los mínimos');
    assert.deepEqual(D.avisosDeLectura(l, a).filter((x) => x.includes('RECIBE ZT')), [], 'trae la columna: nada que avisar');
  });
  test('sin la columna: el corte se lee igual (ejecución vacía) y la vista previa lo avisa', () => {
    const sin = ENCABEZADOS_AFINIA_FIXTURE.filter((h) => h !== ZT);
    const quitar = (f) => f.filter((_, i) => ENCABEZADOS_AFINIA_FIXTURE[i] !== ZT);
    const l = D.leerCsv(csv([quitar(odt('90000311', { estado: 'EJECUTADA' }))], { encabezados: sin }));
    assert.equal(l.ok, true);
    assert.equal(l.traeEjecucion, false);
    const a = D.analizarResponsable(l, RESP_A);
    assert.equal(a.odts[0].ejecucion, '');
    assert.ok(D.avisosDeLectura(l, a).includes(D.MSG_SIN_COLUMNA_EJECUCION));
  });
  test('varias filas de una ODT: la de la PRIMERA que la traiga; si otra trae otra, se avisa', () => {
    const l = D.leerCsv(csv([
      odt('90000321', { estado: 'EJECUTADA', extra: { [ZT]: '' } }),
      odt('90000321', { estado: 'EJECUTADA', extra: { [ZT]: '03/11/2026 09:00' } }),
      odt('90000322', { estado: 'EJECUTADA', extra: { [ZT]: '04/11/2026 09:00' } }),
      odt('90000322', { estado: 'EJECUTADA', extra: { [ZT]: '06/11/2026 09:00' } })
    ]));
    const a = D.analizarResponsable(l, RESP_A);
    assert.deepEqual(a.odts.map((o) => [o.nro, o.ejecucion]), [['90000321', '2026-11-03'], ['90000322', '2026-11-04']]);
    assert.deepEqual(a.conflictos.filter((c) => c.campo === 'ejecucion').map((c) => [c.nro, c.primero, c.otro]), [['90000322', '2026-11-04', '2026-11-06']]);
    assert.ok(D.avisosDeLectura(l, a).some((x) => /1 ODT vienen con fechas de ejecución distintas.*90000322/.test(x)));
  });
  test('el corte nuevo es la versión 3: cada ODT con sus 13 campos (también la ejecución vacía, y el equipo); odtValida por versión', () => {
    const l = D.leerCsv(csv([odt('90000331', { estado: 'EJECUTADA', extra: { [ZT]: '10/11/2026 07:00' } }), odt('90000332', { estado: 'GENERADA' })]));
    const p = planCorte({ id: 'B'.repeat(20), archivo: { nombre: 'INFORME_ODT_20261121150000_prueba.csv', bytes: 10, sha256: 'ab'.repeat(32) },
      lectura: l, analisis: D.analizarResponsable(l, RESP_A), por: { uid: 'u', nombre: 'n' }, ts: 'TS' });
    assert.equal(D.VERSION_CORTE, 3);
    assert.equal(p.corte.version, 3);
    for (const o of p.partes[0].odts) { assert.deepEqual(Object.keys(o), [...CAMPOS_ODT_POR_VERSION[3]]); assert.ok(odtValida(o, 3)); }
    assert.deepEqual(p.partes[0].odts.map((o) => o.ejecucion), ['2026-11-10', '']);
    assert.deepEqual(p.partes[0].odts.map((o) => o.equipo), ['EQUIPO DE PRUEBA', 'EQUIPO DE PRUEBA'], 'el equipo, de la columna «EQUIPO»');
    assert.equal(D.CAMPOS_OPCIONALES.equipo, 'EQUIPO');
    const v3 = o3('90000333');
    assert.equal(odtValida(v3, 3), true);
    assert.equal(odtValida({ ...v3, ejecucion: '10/11/2026' }, 3), false, 'la fecha con otra forma');
    assert.equal(odtValida({ ...v3, ejecucion: 7 }, 3), false);
    assert.equal(odtValida({ ...v3, equipo: '' }, 3), true, 'sin equipo: vacío');
    assert.equal(odtValida({ ...v3, equipo: 'E'.repeat(200) }, 3), true);
    assert.equal(odtValida({ ...v3, equipo: 'E'.repeat(201) }, 3), false, 'un equipo de más de 200');
    assert.equal(odtValida({ ...v3, equipo: 7 }, 3), false);
    const { ejecucion, equipo, ...v2 } = v3;
    assert.equal(odtValida(v2, 3), false, 'una de 11 en un corte de la versión 3');
    assert.equal(odtValida({ ...v2, ejecucion }, 3), false, 'una de 12 (sin el equipo) en un corte de la versión 3');
    assert.equal(odtValida(v3, 2), false, 'una de 13 en un corte de la versión 2');
    assert.equal(odtValida(v2), true); assert.equal(odtValida(v3), true);
    const r = unirPartes({ nPartes: 1, odts: 2, version: 3 }, [{ id: '0', data: { k: 0, odts: [v3, o3('90000334')] } }]);
    assert.equal(r.completo, true);
  });
});

describe('fechas: días calendario y la fecha del corte en Colombia', () => {
  test('diasEntre, sumarDias y fechaReal (sin horas; meses, bisiestos y años)', () => {
    assert.equal(C.diasEntre('2026-11-01', '2026-11-21'), 20);
    assert.equal(C.diasEntre('2026-11-21', '2026-11-21'), 0);
    assert.equal(C.diasEntre('2026-12-25', '2027-01-04'), 10);
    assert.equal(C.diasEntre('2028-02-28', '2028-03-01'), 2, '2028 es bisiesto');
    assert.equal(C.diasEntre('2026-02-28', '2026-03-01'), 1);
    assert.equal(C.diasEntre('2026-11-21', '2026-11-01'), -20);
    assert.equal(C.diasEntre('2026-02-31', '2026-03-05'), null, 'un día que no existe');
    assert.equal(C.sumarDias('2026-12-20', 20), '2027-01-09');
    assert.equal(C.sumarDias('', 20), '');
    assert.equal(C.fechaReal('2026-02-29'), false);
    assert.equal(C.fechaReal('2028-02-29'), true);
  });
  test('la hora del nombre del archivo viene en UTC: la fecha del corte es la de Colombia (UTC−5), cerca de la medianoche UTC', () => {
    assert.equal(C.fechaColombiaDeSello('2026-11-26T04:59:59'), '2026-11-25', 'las 23:59 del 25 en Colombia');
    assert.equal(C.fechaColombiaDeSello('2026-11-26T05:00:00'), '2026-11-26', 'la medianoche de Colombia');
    assert.equal(C.fechaColombiaDeSello('2026-11-26T00:30:00'), '2026-11-25');
    assert.equal(C.fechaColombiaDeSello('2027-01-01T03:00:00'), '2026-12-31', 'el cambio de año');
    assert.equal(C.fechaColombiaDeSello('2026-03-01T02:00:00'), '2026-02-28');
    assert.equal(C.fechaColombiaDeSello('no'), '');
    const delArchivo = { archivo: { nombre: 'INFORME_ODT_20261126015247_prueba.csv' }, fechaDatos: '2026-11-26T01:52:47' };
    assert.equal(C.fechaDelCorte(delArchivo), '2026-11-25', 'descargado el 25/11 a las 20:52 en Colombia');
    // Sin la hora en el nombre: el final del día de la prevista más reciente (ya es una fecha local).
    assert.equal(C.fechaDelCorte({ archivo: { nombre: 'informe.csv' }, fechaDatos: '2026-11-20T23:59:59' }), '2026-11-20');
    assert.equal(C.fechaDelCorte({ archivo: { nombre: 'informe.csv' }, rango: { desde: '2026-01-02', hasta: '2026-11-19' } }), '2026-11-19');
    assert.equal(C.fechaDelCorte({}), '');
    // Solo un corte con la hora de descarga en el nombre del archivo genera avisos (99 §236).
    assert.equal(C.corteConHoraDeDescarga(delArchivo), true);
    assert.equal(C.corteConHoraDeDescarga({ archivo: { nombre: 'informe.csv' }, fechaDatos: '2026-11-20T23:59:59' }), false);
    assert.equal(C.corteConHoraDeDescarga({}), false);
    // Una ODT ejecutada el 05/11 cumple 20 días con el archivo bajado a las 20:52 del 25/11 en Colombia, no 21.
    const e = C.evaluarOdt(o3('90000341', { ejecucion: '2026-11-05' }), C.fechaDelCorte(delArchivo));
    assert.equal(e.dias, 20); assert.equal(e.franja, 'f20'); assert.equal(e.vencida, false);
  });
});

describe('cada ODT frente al plazo de 20 días', () => {
  const abierta = (dias) => C.evaluarOdt(o3('90000351', { ejecucion: C.sumarDias(CORTE, -dias) }), CORTE);
  const cerrada = (dias) => C.evaluarOdt(o3('90000352', { estado: 'CERRADA', ejecucion: '2026-10-01', cerrada: C.sumarDias('2026-10-01', dias) }), CORTE);
  test('abiertas en los umbrales exactos: 9, 10, 14, 15, 19, 20 y 21 días', () => {
    const tabla = [9, 10, 14, 15, 19, 20, 21].map((d) => { const e = abierta(d); return [d, e.tipo, e.dias, e.franja, e.umbral, e.cumple, e.vencida, e.proximo ? e.proximo.umbral : null]; });
    assert.deepEqual(tabla, [
      [9, 'abierta', 9, 'f0', 0, true, false, 10],
      [10, 'abierta', 10, 'f10', 10, true, false, 15],
      [14, 'abierta', 14, 'f10', 10, true, false, 15],
      [15, 'abierta', 15, 'f15', 15, true, false, 20],
      [19, 'abierta', 19, 'f15', 15, true, false, 20],
      [20, 'abierta', 20, 'f20', 20, true, false, null],
      [21, 'abierta', 21, 'f21', 20, false, true, null]
    ]);
    assert.equal(abierta(0).franja, 'f0');
    assert.equal(abierta(9).proximo.fecha, C.sumarDias(CORTE, 1), 'el aviso de 10 días, mañana');
    assert.equal(abierta(9).limite, C.sumarDias(CORTE, 11));
    assert.equal(C.textoProximoAviso(abierta(14)), '15 días · ' + D.fechaDMA(C.sumarDias(CORTE, 1)));
    assert.match(C.textoProximoAviso(abierta(20)), /vence hoy/);
    assert.match(C.textoProximoAviso(abierta(21)), /incumplimiento/);
  });
  test('cerradas: a 20 días cumple; a 21 no; a 0 (el mismo día) cumple', () => {
    assert.deepEqual([0, 19, 20, 21, 45].map((d) => [cerrada(d).dias, cerrada(d).cumple]), [[0, true], [19, true], [20, true], [21, false], [45, false]]);
    assert.equal(cerrada(20).limite, '2026-10-21');
  });
  test('solo EJECUTADA y CERRADA: GENERADA (aunque traiga RECIBE ZT), NO EJECUTADA, INACTIVA y otro estado quedan fuera', () => {
    for (const estado of ['GENERADA', 'NO EJECUTADA', 'INACTIVA', 'SUSPENDIDA', '']) assert.equal(C.evaluarOdt(o3('90000361', { estado }), CORTE).tipo, 'fuera', estado);
  });
  test('fecha por revisar: vacía, año fuera de 2020–2030, posterior al corte, cierre antes de la ejecución, CERRADA sin cierre', () => {
    const m = (o, f = CORTE) => { const e = C.evaluarOdt(o, f); return [e.tipo, e.motivo]; };
    assert.deepEqual(m(o3('90000371', { ejecucion: '' })), ['revisar', 'sinEjecucion']);
    assert.deepEqual(m(o3('90000372', { ejecucion: '2026-02-31' })), ['revisar', 'sinEjecucion'], 'ilegible');
    assert.deepEqual(m(o3('90000373', { ejecucion: '2019-12-31' })), ['revisar', 'ejecucionFueraDeRango']);
    assert.deepEqual(m(o3('90000374', { ejecucion: '2031-01-01', estado: 'CERRADA', cerrada: '2031-01-02' })), ['revisar', 'ejecucionFueraDeRango']);
    // Los rezagos absurdos (decenas de miles de días): un año mal escrito cae aquí, no en las vencidas.
    assert.deepEqual(m(o3('90000375', { ejecucion: '1900-01-01' })), ['revisar', 'ejecucionFueraDeRango']);
    assert.deepEqual(m(o3('90000376', { ejecucion: '0206-11-01', estado: 'CERRADA', cerrada: '2026-11-03' })), ['revisar', 'ejecucionFueraDeRango']);
    assert.deepEqual(m(o3('90000377', { ejecucion: '2026-11-22' })), ['revisar', 'ejecucionDespuesDelCorte']);
    assert.deepEqual(m(o3('90000378', { estado: 'CERRADA', ejecucion: '2026-11-10', cerrada: '2026-11-09' })), ['revisar', 'cierreAntesDeEjecucion']);
    assert.deepEqual(m(o3('90000379', { estado: 'CERRADA', ejecucion: '2026-11-10', cerrada: '' })), ['revisar', 'sinCierre']);
    assert.deepEqual(m(o3('90000380', { estado: 'CERRADA', ejecucion: '2026-11-10', cerrada: '2039-01-01' })), ['revisar', 'cierreFueraDeRango']);
    assert.deepEqual(m(o3('90000381', { ejecucion: '2026-11-10' }), ''), ['revisar', 'sinFechaCorte']);
    assert.deepEqual(m(o3('90000382', { estado: 'CERRADA', ejecucion: '2026-11-10', cerrada: '2026-11-12' }), ''), ['cerrada', undefined], 'una cerrada no necesita la fecha del corte');
    for (const k of Object.keys(C.MOTIVOS_REVISAR)) assert.ok(C.MOTIVOS_REVISAR[k].length > 10, k);
  });
});

describe('el cumplimiento de un conjunto de ODT', () => {
  const odts = [
    o3('90000401', { estado: 'CERRADA', ejecucion: '2026-10-01', cerrada: '2026-10-11' }),                 // 10 días: a tiempo
    o3('90000402', { estado: 'CERRADA', ejecucion: '2026-10-01', cerrada: '2026-10-21' }),                 // 20: a tiempo
    o3('90000403', { estado: 'CERRADA', ejecucion: '2026-10-01', cerrada: '2026-10-31', empresa: BETA }),  // 30: fuera de plazo
    o3('90000404', { ejecucion: C.sumarDias(CORTE, -25), empresa: BETA }),                                 // abierta vencida
    o3('90000405', { ejecucion: C.sumarDias(CORTE, -12) }),                                                // abierta en plazo (sin veredicto)
    o3('90000406', { ejecucion: C.sumarDias(CORTE, -20), empresa: GAMMA }),                                // vence hoy
    o3('90000407', { ejecucion: '' }),                                                                     // por revisar
    o3('90000408', { estado: 'GENERADA' }),                                                                // fuera
    o3('90000409', { estado: 'NO EJECUTADA', empresa: BETA })                                              // fuera
  ];
  const ev = C.evaluarCumplimiento(odts, CORTE);
  test('totales, % (cerradas a tiempo ÷ (cerradas evaluables + abiertas vencidas)) y mediana', () => {
    assert.deepEqual(ev.totales, { evaluables: 6, cerradas: 3, cerradasATiempo: 2, cerradasFuera: 1, abiertas: 3, abiertasEnPlazo: 2, abiertasVencidas: 1, revisar: 1 });
    assert.equal(ev.fuera, 2);
    assert.equal(ev.pct, 2 / 4);
    assert.equal(C.textoCumplimiento(ev.totales), '50,0 %');
    assert.equal(ev.mediana, 20, 'mediana de 10, 20 y 30');
    assert.equal(C.textoDias(ev.mediana), '20 días');
    assert.deepEqual(ev.revisar.map((e) => e.o.nro), ['90000407']);
  });
  test('las abiertas con 20 días o menos no cuentan en el %; sin divisor, el % no aplica', () => {
    const solo = C.evaluarCumplimiento([o3('90000411', { ejecucion: C.sumarDias(CORTE, -20) }), o3('90000412', { ejecucion: C.sumarDias(CORTE, -3) })], CORTE);
    assert.equal(solo.pct, null);
    assert.equal(C.textoCumplimiento(solo.totales), '—');
    assert.equal(solo.mediana, null);
    assert.equal(C.textoDias(null), '—');
    const una = C.evaluarCumplimiento([o3('90000413', { ejecucion: C.sumarDias(CORTE, -21) })], CORTE);
    assert.equal(una.pct, 0, 'una abierta vencida sola: 0 %');
  });
  test('mediana con un número par: el promedio de las dos del medio', () => {
    assert.equal(C.mediana([3, 1, 4, 10]), 3.5);
    assert.equal(C.textoDias(3.5), '3,5 días');
    assert.equal(C.textoDias(1), '1 día');
    assert.equal(C.mediana([]), null);
  });
  test('por contratista (los que más incumplen primero) y franjas de las abiertas', () => {
    assert.deepEqual(ev.porEmpresa.map((g) => [g.clave, g.evaluables, g.cerradasATiempo, g.cerradasFuera, g.abiertasVencidas, g.revisar, g.pct, g.mediana]), [
      [BETA, 2, 0, 1, 1, 0, 0, 30],
      [ALFA, 3, 2, 0, 0, 1, 1, 15],
      [GAMMA, 1, 0, 0, 0, 0, null, null]
    ]);
    assert.deepEqual(ev.franjas.map((f) => [f.clave, f.odts.map((e) => e.o.nro)]), [
      ['f0', []], ['f10', ['90000405']], ['f15', []], ['f20', ['90000406']], ['f21', ['90000404']]
    ]);
    assert.deepEqual(ev.abiertas.map((e) => e.dias), [25, 20, 12], 'más días primero');
  });
  test('cortes de la versión 1 y 2: no guardaron la ejecución', () => {
    assert.equal(C.corteTraeEjecucion({ version: 1 }), false);
    assert.equal(C.corteTraeEjecucion({ version: 2 }), false);
    assert.equal(C.corteTraeEjecucion({ version: 3 }), true);
    assert.equal(C.corteTraeEjecucion(null), false);
    // Si igual se evaluaran sus ODT (sin `ejecucion`), todas las EJECUTADA/CERRADA quedarían por revisar, nunca vencidas.
    const { ejecucion, ...v2 } = o3('90000421');
    assert.equal(C.evaluarOdt(v2, CORTE).motivo, 'sinEjecucion');
  });
});

describe('configuración de los avisos (odt_afinia_config/cumplimiento)', () => {
  const base = () => ({ activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Persona Uno' }], cc: [], responsable: RESP_A });
  test('el documento: EXACTAMENTE 6 claves, limpio (filas vacías fuera, espacios de más fuera)', () => {
    const d = C.docConfigCumplimiento({ ...base(), para: [{ correo: ' uno@prueba.test ', nombre: '  Persona   Uno ' }, { correo: '', nombre: '' }], cc: ['', ' copia@prueba.test'] });
    assert.deepEqual(Object.keys(d), [...C.CLAVES_CONFIG]);
    assert.equal(C.CLAVES_CONFIG.length, 6);
    assert.deepEqual(d, { activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Persona Uno' }], cc: ['copia@prueba.test'], responsable: RESP_A, audienciaScript: '' });
    assert.equal(C.COL_CUMPLIMIENTO.config.col + '/' + C.COL_CUMPLIMIENTO.config.doc, 'odt_afinia_config/cumplimiento');
  });
  test('audienciaScript (99 §236): el id del script de Google aprobado, de 0 a 200 caracteres de un id de cliente', () => {
    const aud = '9123456789-ficticio0prueba.apps.googleusercontent.com';
    assert.equal(C.docConfigCumplimiento({ ...base(), audienciaScript: ' ' + aud + ' ' }).audienciaScript, aud);
    const e = (v) => C.errorConfigCumplimiento(C.normalizarConfig({ ...base(), audienciaScript: v }));
    for (const v of ['', aud, 'A'.repeat(200), 'https://ficticio.prueba.test/x', 'a_b-c.d:e/f']) assert.equal(e(v), '', v);
    for (const v of ['A'.repeat(201), 'con espacio', 'tilde-é', 'a;b', 'a"b']) assert.match(e(v), /script de Google aprobado no es válido/, v);
    assert.equal(e(7), '', 'lo que no es texto se normaliza a vacío');
    assert.equal(C.esAudiencia(''), true);
    assert.equal(C.esAudiencia(null), false);
  });
  test('los errores, en llano', () => {
    const e = (cambio) => C.errorConfigCumplimiento(C.normalizarConfig({ ...base(), ...cambio }));
    assert.equal(e({}), '');
    assert.match(e({ remitente: 'sin-arroba' }), /remitente/);
    assert.match(e({ para: [] }), /al menos un destinatario/);
    assert.match(e({ para: Array.from({ length: 6 }, (_, i) => ({ correo: 'p' + i + '@prueba.test', nombre: 'P' + i })) }), /Como mucho 5/);
    assert.match(e({ para: [{ correo: 'uno@prueba.test', nombre: '' }] }), /nombre del destinatario 1/);
    assert.match(e({ para: [{ correo: 'uno@prueba', nombre: 'Uno' }] }), /destinatario 1 no es válido/);
    assert.match(e({ para: [{ correo: 'uno@prueba.test', nombre: 'N'.repeat(81) }] }), /nombre del destinatario 1/);
    assert.match(e({ cc: Array.from({ length: 6 }, (_, i) => 'c' + i + '@prueba.test') }), /5 correos en copia/);
    assert.match(e({ cc: ['UNO@prueba.test'] }), /repetido/);
    assert.match(e({ responsable: 'AB' }), /RESPONSABLE O.D.T./);
    assert.match(C.errorConfigCumplimiento({ ...base(), activo: 'si' }), /activos/);
    assert.throws(() => C.docConfigCumplimiento({ ...base(), remitente: '' }), /remitente/);
    // Solo dominios de prueba (repo público); el de un TLD de una letra se arma por partes para que no parezca un correo.
    for (const [v, ok] of [['a@prueba.test', true], ['nombre.apellido+x@sub.prueba.test', true], ['a@b', false], ['a b@prueba.test', false], ['@prueba.test', false], ['a@c.' + 'c', false]]) assert.equal(C.esCorreo(v), ok, v);
  });
});

describe('plan de avisos: cada umbral una sola vez; el más alto la primera vez; nunca uno menor después de uno mayor', () => {
  const CID = 'C'.repeat(20);
  const ab = (nro, dias) => C.evaluarOdt(o3(nro, { ejecucion: C.sumarDias(CORTE, -dias) }), CORTE);
  const ex = (pares) => new Map(pares.map(([nro, u, estado, correoId = 'X'.repeat(20) + '_' + u]) => [A.idAviso(nro, u), { nro, umbral: u, estado, correoId }]));
  const resumen = (plan) => plan.map((p) => [p.e.o.nro, p.umbral, p.accion, p.menores.map((m) => m.umbral + ':' + m.accion).join(',')]);
  test('la primera vez: solo el MÁS ALTO alcanzado; los menores, «omitido»', () => {
    const plan = A.planAvisos([ab('90000501', 10), ab('90000502', 17), ab('90000503', 26)], new Map(), CID);
    assert.deepEqual(resumen(plan), [
      ['90000501', 10, 'reservar', ''],
      ['90000502', 15, 'reservar', '10:crearOmitido'],
      ['90000503', 20, 'reservar', '10:crearOmitido,15:crearOmitido']
    ]);
    assert.equal(A.idAviso('90000503', 20), '90000503_20');
    assert.equal(A.idCorreo(CID, 20), CID + '_20');
  });
  test('ya avisada: el mismo umbral no se repite; el siguiente sí (sin tocar los ya enviados)', () => {
    const plan = A.planAvisos([ab('90000511', 12), ab('90000512', 16), ab('90000513', 22)],
      ex([['90000511', 10, 'enviado'], ['90000512', 10, 'enviado'], ['90000513', 15, 'enviado'], ['90000513', 10, 'omitido']]), CID);
    assert.deepEqual(resumen(plan), [
      ['90000511', 10, 'nada', ''],
      ['90000512', 15, 'reservar', ''],
      ['90000513', 20, 'reservar', '']
    ]);
  });
  test('un aviso en «error» lo toma este proceso; uno reservado para ESTE correo se reintenta; uno reservado por otro, no', () => {
    const plan = A.planAvisos([ab('90000521', 11), ab('90000522', 11), ab('90000523', 11)],
      ex([['90000521', 10, 'error'], ['90000522', 10, 'reservado', A.idCorreo(CID, 10)], ['90000523', 10, 'reservado']]), CID);
    assert.deepEqual(resumen(plan).map((x) => x[2]), ['tomar', 'reintentar', 'nada']);
    assert.equal(plan[0].esperado, 'error');
  });
  test('una reserva ABANDONADA por otro correo (su proceso se cortó) se toma; si su correo salió con esa ODT, no se repite', () => {
    const ahoraMs = Date.UTC(2026, 10, 21, 16);
    const L = A.LEASE_ENVIO_MS;
    /** El correo de otro corte (k = 1..9) para el umbral u. */
    const de = (k, u) => A.idCorreo(String(k).repeat(20), u);
    const res = (nro, u, k, intentoEnMs) => [A.idAviso(nro, u), { nro, umbral: u, estado: 'reservado', correoId: de(k, u), intentoEnMs }];
    const existentes = new Map([
      res('90000551', 10, 1, ahoraMs - L),       // sin correo y con el candado vencido: abandonada
      res('90000552', 10, 2, ahoraMs - 60000),   // sin correo, hace un minuto: el otro proceso sigue
      res('90000553', 15, 3, ahoraMs - L),       // su correo en «error»
      res('90000554', 20, 4, ahoraMs - L),       // su correo EN COLA (99 §236): sale con él, aunque espere horas
      res('90000555', 20, 5, ahoraMs - L),       // su correo en manos del script de Google: sale con él
      res('90000556', 10, 6, ahoraMs - L),       // su correo SALIÓ con esta ODT
      res('90000557', 10, 7, ahoraMs - L),       // su correo salió SIN esta ODT
      [A.idAviso('90000558', 10), { nro: '90000558', umbral: 10, estado: 'reservado', correoId: A.idCorreo(CID, 10), intentoEnMs: 0 }]   // de ESTE corte: no
    ]);
    const correos = new Map([
      [de(3, 15), { estado: 'error' }],
      [de(4, 20), { estado: 'pendiente', encoladoEnMs: ahoraMs - 10 * L }],
      [de(5, 20), { estado: 'en_envio', prestamoHastaMs: ahoraMs - L }],
      [de(6, 10), { estado: 'enviado', nros: ['90000556'] }],
      [de(7, 10), { estado: 'enviado', nros: ['90000599'] }]
    ]);
    const m = A.avisosAbandonados(existentes, correos, { corteId: CID, ahoraMs });
    assert.deepEqual(Object.fromEntries(m), { '90000551_10': 'libre', '90000553_15': 'libre', '90000556_10': 'enviado', '90000557_10': 'libre' });
    // El plan: la abandonada se TOMA (exigiendo que siga siendo de ese correo); la en curso, la en cola y la que salió, no.
    const plan = A.planAvisos([ab('90000551', 11), ab('90000552', 11), ab('90000556', 11), ab('90000554', 26), ab('90000555', 26)], existentes, CID, m);
    assert.deepEqual(resumen(plan), [
      ['90000551', 10, 'tomar', ''], ['90000552', 10, 'nada', ''], ['90000556', 10, 'nada', ''],
      ['90000554', 20, 'nada', ''], ['90000555', 20, 'nada', '']
    ]);
    assert.deepEqual(plan[0].esperado, { estado: 'reservado', correoId: de(1, 10) });
    // Un menor abandonado queda «omitido» cuando sale uno mayor; un mayor abandonado no impide el menor.
    const ex2 = new Map([res('90000559', 10, 8, 0), res('90000560', 20, 9, 0)]);
    const m2 = A.avisosAbandonados(ex2, new Map(), { corteId: CID, ahoraMs });
    const plan2 = A.planAvisos([ab('90000559', 16), ab('90000560', 16)], ex2, CID, m2);
    assert.deepEqual(resumen(plan2), [['90000559', 15, 'reservar', '10:omitirError'], ['90000560', 15, 'reservar', '10:crearOmitido']]);
    assert.deepEqual(plan2[0].menores[0].esperado, { estado: 'reservado', correoId: de(8, 10) });
    // Sin el mapa de abandonadas (como antes), una reserva de otro correo nunca se toma.
    assert.equal(A.planAvisos([ab('90000551', 11)], existentes, CID)[0].accion, 'nada');
  });
  test('nunca uno menor después de uno mayor: con el de 20 ya enviado, el de 15 (de datos más viejos) no sale; el mío pendiente queda «omitido»', () => {
    const plan = A.planAvisos([ab('90000531', 16), ab('90000532', 16)],
      ex([['90000531', 20, 'enviado'], ['90000532', 20, 'reservado'], ['90000532', 15, 'error', A.idCorreo(CID, 15)]]), CID);
    assert.deepEqual(resumen(plan).map((x) => x[2]), ['nada', 'omitirMio']);
  });
  test('un menor en «error» pasa a «omitido» cuando sale uno mayor', () => {
    const plan = A.planAvisos([ab('90000541', 21)], ex([['90000541', 10, 'error']]), CID);
    assert.deepEqual(resumen(plan), [['90000541', 20, 'reservar', '10:omitirError,15:crearOmitido']]);
  });
});

describe('los correos: asunto, texto, tabla por contratista y pie', () => {
  const config = { activo: true, remitente: 'remitente@prueba.test', para: [{ correo: 'uno@prueba.test', nombre: 'Persona Uno' }, { correo: 'dos@prueba.test', nombre: 'Persona Dos' }], cc: [], responsable: RESP_A };
  const corte = { responsable: RESP_A, archivo: { nombre: 'INFORME_ODT_20261121150000_prueba.csv' }, fechaDatos: '2026-11-21T15:00:00' };
  const ev = (nro, dias, empresa = ALFA) => C.evaluarOdt(o3(nro, { ejecucion: C.sumarDias(CORTE, -dias), empresa, subestacion: 'S/E <PRUEBA>' }), CORTE);
  test('los tres asuntos, con cuántas ODT', () => {
    assert.equal(A.asuntoCorreo(10, 3), 'SGM · ODT con 10 días desde su ejecución: el contratista debe ejecutarlas a conformidad (3 ODT)');
    assert.equal(A.asuntoCorreo(15, 1), 'SGM · ODT con 15 días desde su ejecución: apresurar el cierre (1 ODT)');
    assert.equal(A.asuntoCorreo(20, 12), 'SGM · INCUMPLIMIENTO: ODT con 20 días o más desde su ejecución, cerrar de inmediato (12 ODT)');
  });
  test('los cuerpos dicen lo pedido (conformidad y soportes; apresurar; cerrar de inmediato e incumplimiento), en singular con 1', () => {
    const t10 = A.parrafosCorreo(10, 2).join(' ');
    assert.match(t10, /Las siguientes 2 ODT cumplen 10 días o más desde su ejecución y siguen sin cerrar/);
    assert.match(t10, /ejecutarlas a conformidad/);
    assert.match(t10, /control previo, registro fotográfico y la ODT firmada por el jefe de trabajo/);
    assert.match(t10, /20 días calendario desde la ejecución/);
    assert.match(A.parrafosCorreo(10, 1).join(' '), /La siguiente ODT cumple 10 días o más .* sigue sin cerrar.* ejecutarla a conformidad/);
    assert.match(A.parrafosCorreo(15, 3).join(' '), /apresurarse a cerrarlas: se acerca el día 20/);
    const t20 = A.parrafosCorreo(20, 2).join(' ');
    assert.match(t20, /alcanzaron o superaron el plazo de 20 días/);
    assert.match(t20, /Deben cerrarse de forma inmediata, con el debido proceso/);
    assert.match(t20, /incumplimiento del contratista/);
  });
  test('el correo armado: saludo con los nombres de la configuración, tabla por contratista, «Situación» en el de 20 y el pie', () => {
    const c = A.armarCorreo({ umbral: 20, evaluadas: [ev('90000601', 20), ev('90000602', 27, BETA), ev('90000603', 22)], config, corte });
    assert.equal(c.asunto, A.asuntoCorreo(20, 3));
    assert.ok(c.texto.startsWith('Buen día, Persona Uno y Persona Dos:'));
    assert.ok(c.html.includes('Buen día, Persona Uno y Persona Dos:'));
    assert.ok(c.texto.indexOf(BETA) < c.texto.indexOf(ALFA), 'por contratista, por nombre («CONSORCIO…» antes que «CONTRATISTA…»)');
    assert.ok(c.texto.indexOf('90000603') < c.texto.indexOf('90000601'), 'dentro, más días primero');
    assert.match(c.texto, /N\.º ODT: 90000601 · Subestación: S\/E <PRUEBA> · Equipo: EQUIPO FICTICIO UNO · Contratista: CONTRATISTA ALFA S\.A\.S\. · Fecha de ejecución: 01\/11\/2026 · Días transcurridos: 20 · Fecha límite \(ejecución \+ 20 días\): 21\/11\/2026 · Situación: Vence hoy/);
    assert.match(c.texto, /90000602 .* Situación: Incumplimiento/);
    assert.ok(c.html.includes('S/E &lt;PRUEBA&gt;') && !c.html.includes('<PRUEBA>'), 'el HTML escapa lo que viene del archivo');
    assert.ok(c.html.includes('<th') && c.html.includes('scope="col"'));
    const pie = 'Según el informe de Afinia con datos del 21/11/2026 10:00 · Responsable O.D.T.: ' + RESP_A + ' · Mensaje generado por SGM · TRANSPOWER';
    assert.equal(A.pieCorreo(corte), pie, 'la hora de Colombia del corte');
    assert.ok(c.texto.endsWith(pie));
    assert.deepEqual(A.columnasCorreo(10), ['N.º ODT', 'Subestación', 'Equipo', 'Contratista', 'Fecha de ejecución', 'Días transcurridos', 'Fecha límite (ejecución + 20 días)']);
    assert.ok(c.html.includes('>Equipo</th>') && c.html.includes('>EQUIPO FICTICIO UNO</td>'), 'la columna «Equipo» en la tabla del HTML');
    const sinEquipo = C.evaluarOdt(o3('90000605', { ejecucion: C.sumarDias(CORTE, -12), equipo: '' }), CORTE);
    assert.match(A.armarCorreo({ umbral: 10, evaluadas: [sinEquipo], config, corte }).texto, /Equipo: — ·/);
    assert.ok(!A.armarCorreo({ umbral: 10, evaluadas: [ev('90000604', 11)], config, corte }).texto.includes('Situación'));
  });
  test('el resultado de un reproceso, en llano (99 §236: queda en cola; lo envía el script de Google)', () => {
    assert.match(A.textoResultadoReproceso({ motivo: 'inactivo' }), /desactivados/);
    assert.match(A.textoResultadoReproceso({ motivo: 'procesado', encolados: [{ umbral: 15, n: 2 }, { umbral: 20, n: 1 }], reabiertos: [20], errores: [{ umbral: 10, n: 1, error: 'falla de prueba' }] }),
      /^Quedaron en cola 2 correos: el de 15 días \(2 ODT\), el de 20 días \(1 ODT\)\. Los enviará el script de Google de la cuenta remitente en los próximos minutos \(mire el historial\)\. El de 20 días había fallado: vuelve a intentarse\. No se pudo dejar en cola el de 10 días \(1 ODT\): falla de prueba\. Quedó para reintentar\.$/);
    assert.match(A.textoResultadoReproceso({ motivo: 'procesado', encolados: [{ umbral: 10, n: 1 }] }), /^Quedaron en cola 1 correo: el de 10 días \(1 ODT\)\./);
    assert.match(A.textoResultadoReproceso({ motivo: 'procesado', encolados: [], errores: [] }), /No había avisos pendientes/);
    assert.match(A.textoResultadoReproceso({ motivo: 'procesado', errores: [{ umbral: 10, n: 1, error: 'No se pudo registrar.' }] }), /: No se pudo registrar\. Quedó para reintentar\.$/, 'sin dos puntos seguidos');
    assert.match(A.textoResultadoReproceso({ motivo: 'procesado', ocupados: [15] }), /El correo de 15 días ya lo tomó el script de Google para enviarlo/);
    assert.match(A.textoResultadoReproceso({ motivo: 'sin_hora_de_descarga' }), /no trae la hora de descarga/);
    assert.ok(!/Gmail|clave/i.test(A.textoResultadoReproceso({ motivo: 'procesado', encolados: [{ umbral: 10, n: 1 }] })));
    for (const k of Object.keys(A.TEXTO_MOTIVO)) assert.ok(A.TEXTO_MOTIVO[k].length > 10, k);
  });
});

describe('la cola de correos, en llano (99 §236: los envía el script de Google)', () => {
  test('el estado de cada correo en el historial: en cola, enviándose, enviado (con la hora), error (con el motivo), reemplazado', () => {
    const f = (ms) => 'F' + ms;
    assert.deepEqual([...A.ESTADOS_CORREO], ['pendiente', 'en_envio', 'enviado', 'error']);
    assert.equal(A.textoEstadoCorreo({ estado: 'pendiente' }, f), 'En cola: lo enviará el script de Google en los próximos minutos');
    assert.match(A.textoEstadoCorreo({ estado: 'en_envio' }, f), /^Enviándose: el script de Google lo tomó/);
    // Corrector 99 §236: con el préstamo VENCIDO ya no dice «Enviándose» (el script no confirmó).
    assert.match(A.textoEstadoCorreo({ estado: 'en_envio', prestamoHastaMs: 1000 }, f), /^Enviándose/, 'sin la hora de ahora, como antes');
    assert.equal(A.textoEstadoCorreo({ estado: 'en_envio', prestamoHastaMs: 1000 }, f, 1000), A.TEXTO_PRESTAMO_VENCIDO);
    assert.match(A.textoEstadoCorreo({ estado: 'en_envio', prestamoHastaMs: 5000 }, f, 1000), /^Enviándose/, 'vigente');
    assert.match(A.TEXTO_PRESTAMO_VENCIDO, /no confirmó el envío/);
    assert.equal(A.textoEstadoCorreo({ estado: 'enviado', enviadoEnMs: 5 }, f), 'Enviado el F5');
    assert.equal(A.textoEstadoCorreo({ estado: 'enviado' }, f), 'Enviado');
    assert.equal(A.textoEstadoCorreo({ estado: 'error', error: 'motivo de prueba' }, f), 'No se pudo enviar: motivo de prueba');
    assert.equal(A.textoEstadoCorreo({ estado: 'error', error: A.TEXTO_REEMPLAZADO, reemplazadoPor: 'C'.repeat(20) }, f), 'No se envió: lo reemplazó un corte con datos más recientes');
    assert.equal(A.textoEstadoCorreo({}, f), '—');
    for (const t of Object.values(A.ETIQUETA_ESTADO_CORREO)) assert.ok(!/Gmail|clave|contraseña/i.test(t), t);
  });
  test('un correo demasiado grande para un mensaje de Google va solo con el texto (la misma tabla, en líneas)', () => {
    const chico = { asunto: 'a', texto: 't'.repeat(10), html: 'h'.repeat(10) };
    assert.equal(A.correoParaCola(chico), chico);
    const grande = { asunto: 'a', texto: 't'.repeat(1000), html: 'h'.repeat(A.TOPE_CUERPO_CORREO) };
    assert.deepEqual(A.correoParaCola(grande), { ...grande, html: '' });
    assert.ok(A.TOPE_CUERPO_CORREO <= 200000, 'por debajo de los 200 KB por mensaje de MailApp');
  });
  test('el texto técnico de un error, recortado (para el registro de la función)', () => {
    assert.equal(A.textoTecnico(Object.assign(new Error('falla técnica de prueba'), {})), 'falla técnica de prueba');
    assert.ok(A.textoTecnico(new Error('x'.repeat(600))).length <= 301);
    assert.equal(A.textoTecnico(null), 'Error desconocido');
  });
});
