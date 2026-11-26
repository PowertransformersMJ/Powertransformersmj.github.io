// Firma de ODT Afinia · INDICADORES · DOMINIO (assets/js/domain/odt_afinia_indicadores.js), sin red ni DOM:
//   · decodificación (latin-1 de Afinia, UTF-8 con o sin BOM), encabezados mínimos y lectura por nombre;
//   · el parser: «|» sin comillas, CRLF/LF, filas vacías, filas con columnas de más (cada «|» de más se prueba en su
//     sitio posible y gana la lectura que más formas cumple; si hay duda, se nombra la ODT), de menos, partidas por un
//     salto de línea (se unen mientras la línea siguiente no empiece un registro), sin N.º; un archivo que no es el
//     informe de Afinia (separado por «;», p. ej.);
//   · la fecha de los DATOS de un corte (la del nombre del archivo) ordena los cortes y elige el anterior;
//   · los meses sin datos van en 0; el % de cierre se redondea con enteros (como REDONDEAR de Excel);
//   · responsables normalizados (tildes, mayúsculas, espacios), deduplicación por N.º con aviso de estados
//     distintos, agregados por estado / contratista / tipo / zona / mes, % de cierre, estados desconocidos («Otro»);
//   · filtros, selección, orden, comparación entre cortes, corte anterior y estado en SGM.
// Datos INVENTADOS (tests/odt_afinia_indicadores_fixture.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../assets/js/domain/odt_afinia_indicadores.js';
import { RESP_A, RESP_A_PERFIL, RESP_B, ALFA, BETA, GAMMA, fila, odt, csv, latin1, archivoBase } from './odt_afinia_indicadores_fixture.js';

const leer = (t) => D.leerCsv(t);
const sinTotal = (c) => [c.total, c.generada, c.ejecutada, c.noEjecutada, c.cerrada, c.inactiva, c.otro];

describe('constantes y definiciones', () => {
  test('los 48 encabezados de Afinia, los 10 mínimos y los estados', () => {
    assert.equal(D.ENCABEZADOS_AFINIA.length, 48);
    assert.equal(new Set(D.ENCABEZADOS_AFINIA).size, 48);
    assert.deepEqual([...D.ENCABEZADOS_MINIMOS].sort(), ['EMPRESA', 'ESTADO FINAL DE LA ODT', 'FECHA ODT CERRADA', 'FECHA Y HORA PREVISTA DE INICIO',
      'NRO. ODT', 'ODT PRINCIPAL', 'RESPONSABLE O.D.T.', 'SUBESTACION', 'TIPO DE TRABAJO', 'ZONA']);
    for (const m of D.ENCABEZADOS_MINIMOS) assert.ok(D.ENCABEZADOS_AFINIA.includes(m), m);
    assert.deepEqual([...D.ESTADOS_AFINIA], ['GENERADA', 'EJECUTADA', 'NO EJECUTADA', 'CERRADA', 'INACTIVA']);
    assert.deepEqual([...D.CLAVES], ['total', 'generada', 'ejecutada', 'noEjecutada', 'cerrada', 'inactiva', 'otro']);
    assert.equal(D.PERIODO_DESDE, '2026-01-01');
  });
  test('las definiciones que se muestran son las pedidas', () => {
    const def = Object.fromEntries(D.INDICADORES.map((i) => [i.titulo, i.definicion]));
    assert.deepEqual(Object.keys(def), ['Generadas', 'Por ejecutar', 'Ejecutadas sin cerrar', 'Cerradas', 'No ejecutadas / inactivas', '% de cierre']);
    assert.match(def.Generadas, /Todas las ODT del corte, en cualquier estado/);
    assert.match(def['Por ejecutar'], /GENERADA/);
    assert.match(def['Ejecutadas sin cerrar'], /EJECUTADA/);
    assert.match(def.Cerradas, /CERRADA/);
    assert.match(def['No ejecutadas / inactivas'], /NO EJECUTADA o INACTIVA/);
    assert.equal(def['% de cierre'], 'Cerradas ÷ (Generadas − No ejecutadas − Inactivas).');
  });
});

describe('decodificación', () => {
  test('latin-1 (como lo entrega Afinia): las tildes de los encabezados se leen bien', () => {
    const t = archivoBase();
    const { texto, codificacion } = D.decodificar(latin1(t));
    assert.equal(codificacion, 'ISO-8859-1');
    assert.equal(texto, t);
    assert.ok(texto.includes('ELEMENTO / BAHÍA / LN'));
  });
  test('UTF-8 con BOM y sin BOM; ASCII puro da lo mismo', () => {
    const t = archivoBase();
    const utf8 = new TextEncoder().encode(t);
    assert.deepEqual(D.decodificar(utf8), { texto: t, codificacion: 'UTF-8' });
    const conBom = new Uint8Array([0xEF, 0xBB, 0xBF, ...utf8]);
    assert.deepEqual(D.decodificar(conBom), { texto: t, codificacion: 'UTF-8' });
    assert.equal(D.decodificar(new TextEncoder().encode('A|B\r\n1|2')).texto, 'A|B\r\n1|2');
  });
});

describe('lectura del CSV', () => {
  test('el archivo de prueba: filas, ODT, responsables, estados por fila, sin filas raras', () => {
    const l = leer(archivoBase());
    assert.equal(l.ok, true);
    assert.equal(l.columnas, 48);
    assert.equal(l.distintosAfinia, false);
    assert.deepEqual(l.faltan, []);
    assert.equal(l.filas, 11);
    assert.equal(l.odtsArchivo, 10);
    assert.deepEqual(l.responsables.map((r) => [r.nombre, r.filas, r.odts]), [[RESP_A, 9, 8], [RESP_B, 2, 2]]);
    assert.deepEqual(l.estadosFila, { GENERADA: 2, CERRADA: 5, EJECUTADA: 1, 'NO EJECUTADA': 1, INACTIVA: 1, SUSPENDIDA: 1 });
    assert.deepEqual(l.raras, []);
    assert.deepEqual(l.sinNro, []);
    assert.equal(l.vacias, 1, 'la línea vacía final');
  });
  test('fin de línea LF o CR también; líneas vacías en medio no cuentan', () => {
    for (const eol of ['\n', '\r']) {
      const l = leer(csv([odt('90000001'), '', odt('90000002')], { eol }));
      assert.equal(l.filas, 2, JSON.stringify(eol));
      assert.deepEqual(l.raras, []);
    }
  });
  test('faltan encabezados mínimos: no se lee nada y se dice cuáles', () => {
    const enc = D.ENCABEZADOS_AFINIA.filter((h) => h !== 'ESTADO FINAL DE LA ODT' && h !== 'ZONA');
    const l = leer(csv([fila().slice(0, 46)], { encabezados: enc }));
    assert.equal(l.ok, false);
    assert.deepEqual(l.faltan, ['ZONA', 'ESTADO FINAL DE LA ODT']);
    assert.equal(l.filas, 0);
    assert.equal(leer('').ok, false);
  });
  test('encabezados en otro orden o con tildes de más: se leen por su NOMBRE (y se avisa que no es el orden de Afinia)', () => {
    const enc = [...D.ENCABEZADOS_AFINIA].reverse().map((h) => (h === 'SUBESTACION' ? 'Subestación' : h));
    const f = [...fila({ 'NRO. ODT': '90000077', SUBESTACION: 'S/E INVERTIDA', 'ESTADO FINAL DE LA ODT': 'CERRADA' })].reverse();
    const l = leer(csv([f], { encabezados: enc }));
    assert.equal(l.ok, true);
    assert.equal(l.distintosAfinia, true);
    assert.equal(l.registros[0].nro, '90000077');
    assert.equal(l.registros[0].subestacion, 'S/E INVERTIDA');
    assert.equal(l.registros[0].estado, 'CERRADA');
    assert.match(D.avisosDeLectura(l, null)[0], /no son exactamente los 48/);
  });
  test('una «|» dentro de una descripción (columnas de más): estado, responsable y cierre salen de su sitio, y se nombra la ODT', () => {
    const f = odt('90000011', { estado: 'CERRADA', cerrada: '09/09/2026 10:00', extra: { 'DESCRIPCIÓN DE LA PLANIFICACIÓN DEL TRABAJO / DAÑO': 'Cambio de A|B|C' } });
    const l = leer(csv([f.join('|')]));
    assert.equal(l.raras.length, 1);
    // Con columnas vacías al final, otra lectura igual de buena solo dejaría VACÍO el responsable («|» en «AZT EN
    // SITIO»): no es otra lectura posible, así que la fila NO queda dudosa (se lee bien y se avisa que tenía «|»).
    assert.deepEqual(l.raras[0], { linea: 2, columnas: 50, tipo: 'de más', nro: '90000011', responsable: RESP_A });
    const r = l.registros[0];
    assert.equal(r.nro, '90000011');
    assert.equal(r.empresa, ALFA);
    assert.equal(r.subestacion, 'S/E PRUEBA UNO');
    assert.equal(r.estado, 'CERRADA');
    assert.equal(r.responsable, RESP_A);
    assert.equal(r.cerrada, '2026-09-09');
    const av = D.avisosDeLectura(l, null).join(' ');
    assert.match(av, /«\|» de más dentro de un texto: se leyeron con cuidado para no correr las columnas\. Líneas 2 \(ODT 90000011\)/);
    assert.ok(!/no se pudieron leer con certeza/.test(av), 'sin el aviso de duda: la lectura es la única con datos');
    assert.ok(!/anclad|ISO-8859/.test(av), 'sin palabras técnicas');
  });
  test('doce filas con «a|b» en OBSERVACIONES y la cola vacía: se leen bien, se cuentan y NINGUNA queda dudosa', () => {
    const vacia = { 'CANTIDAD EJECUTADA': '', 'NRO. DE REGISTROS': '', 'AZT EN SITIO': '', 'JEFE DE TRABAJO EN SITIO': '', 'ODT PENDIENTE ?': '' };
    const filas = Array.from({ length: 12 }, (_, i) => odt(String(90000300 + i), { estado: i % 2 ? 'CERRADA' : 'GENERADA', cerrada: i % 2 ? '02/05/2026 08:00' : '', extra: { ...vacia, OBSERVACIONES: 'a|b' } }));
    const l = leer(csv(filas));
    assert.equal(l.raras.length, 12);
    assert.ok(l.raras.every((r) => r.tipo === 'de más' && !r.dudosa && r.responsable === RESP_A));
    const a = D.analizarResponsable(l, RESP_A);
    assert.equal(a.odts.length, 12);
    assert.deepEqual([a.totales.generada, a.totales.cerrada], [6, 6]);
    assert.ok(a.odts.filter((o) => o.estado === 'CERRADA').every((o) => o.cerrada === '2026-05-02'));
    const av = D.avisosDeLectura(l, a).join(' ');
    assert.match(av, /12 fila\(s\) traen una «\|» de más dentro de un texto: se leyeron con cuidado/);
    assert.ok(!/no se pudieron leer con certeza/.test(av));
  });
  test('con la cola de Afinia (cantidades y N.º de registros con número), una «|» en un texto tampoco queda dudosa', () => {
    // Una lectura corrida pondría en RESPONSABLE el número de «NRO. DE REGISTROS»: un nombre lleva letras, no cuenta.
    const f = odt('90000321', { estado: 'CERRADA', cerrada: '03/05/2026 08:00', extra: { OBSERVACIONES: 'uno|dos', 'DESCRIPCIÓN DEL TRABAJO REALIZADO': '', 'CANTIDAD EJECUTADA': '1', 'NRO. DE REGISTROS': '2', 'AZT EN SITIO': 'AZT FICTICIO', 'JEFE DE TRABAJO EN SITIO': 'JEFE FICTICIO', 'ODT PENDIENTE ?': 'NO' } });
    const l = leer(csv([f]));
    assert.deepEqual(l.raras, [{ linea: 2, columnas: 49, tipo: 'de más', nro: '90000321', responsable: RESP_A }]);
    assert.deepEqual([l.registros[0].estado, l.registros[0].responsable, l.registros[0].cerrada], ['CERRADA', RESP_A, '2026-05-03']);
  });
  test('control: si otra lectura igual de buena da OTRO responsable con nombre, la fila SÍ queda dudosa (y se nombra)', () => {
    // Encabezados en otro orden: RESPONSABLE justo después de los textos libres (sin los números que lo anclan). Con una
    // «|» en OBSERVACIONES, tan buena es «la barra en el texto» como «la barra en AZT EN SITIO», que daría otro nombre.
    const ancla = ['CANTIDAD EJECUTADA', 'NRO. DE REGISTROS'];
    const enc = [...ancla, ...D.ENCABEZADOS_AFINIA.filter((x) => !ancla.includes(x))];
    const v = fila({ 'NRO. ODT': '90000331', 'ESTADO FINAL DE LA ODT': 'CERRADA', 'FECHA ODT CERRADA': '04/05/2026 08:00', OBSERVACIONES: 'uno|dos', 'DESCRIPCIÓN DEL TRABAJO REALIZADO': 'TRABAJO HECHO', 'AZT EN SITIO': 'AZT FICTICIO' });
    const porNombre = Object.fromEntries(D.ENCABEZADOS_AFINIA.map((x, i) => [x, v[i]]));
    const l = leer(csv([enc.map((x) => porNombre[x]).join('|')], { encabezados: enc }));
    assert.equal(l.raras.length, 1);
    assert.equal(l.raras[0].dudosa, true);
    assert.equal(l.registros[0].responsable, RESP_A, 'se toma la lectura con la «|» en el texto libre');
    assert.match(D.avisosDeLectura(l, null).join(' '), /1 fila\(s\) no se pudieron leer con certeza; revíselas en Afinia: ODT 90000331 \(línea 2; se tomó como de PERSONA FICTICIA UNO\)/);
  });
  test('una «|» ANTES de los textos libres (en el contratista) corre columnas con forma: la fila queda dudosa', () => {
    const l = leer(csv([odt('90000341', { empresa: 'CONTRATISTA|PARTIDO' })]));
    assert.equal(l.raras.length, 1);
    assert.equal(l.raras[0].dudosa, true);
  });
  test('un salto de línea dentro de un texto (fila partida): se une con la siguiente y se avisa', () => {
    const f = odt('90000012', { estado: 'EJECUTADA', extra: { OBSERVACIONES: 'Primera parte\r\nsegunda parte' } });
    const l = leer(csv([f.join('|'), odt('90000013')]));
    assert.equal(l.filas, 2);
    assert.deepEqual(l.raras, [{ linea: 2, columnas: 48, tipo: 'unida', nro: '90000012', responsable: RESP_A, lineas: 2 }]);
    assert.equal(l.registros[0].estado, 'EJECUTADA');
    assert.equal(l.registros[0].responsable, RESP_A);
    assert.equal(l.registros[1].nro, '90000013');
    assert.match(D.avisosDeLectura(l, null).join(' '), /partidas en varias líneas.*líneas 2 \(ODT 90000012\)/);
  });
  test('un salto de línea Y una «|» en la misma fila: se une entera (aunque pase de las 48) y la ODT sigue en su responsable', () => {
    const f = odt('90000003', { estado: 'CERRADA', cerrada: '01/05/2026 08:00', extra: { OBSERVACIONES: 'uno\r\ndos|tres' } });
    const l = leer(csv([odt('90000001'), f.join('|'), odt('90000004')]));
    assert.equal(l.filas, 3);
    assert.deepEqual(l.sinNro, [], 'el segundo trozo no queda como fila sin N.º');
    const r = l.registros.find((x) => x.nro === '90000003');
    assert.deepEqual([r.estado, r.responsable, r.cerrada], ['CERRADA', RESP_A, '2026-05-01']);
    assert.equal(l.raras.length, 1);
    assert.deepEqual([l.raras[0].tipo, l.raras[0].lineas, l.raras[0].nro], ['de más', 2, '90000003']);
    assert.equal(D.analizarResponsable(l, RESP_A).odts.length, 3, 'ninguna sale del corte del responsable');
  });
  test('una «|» en una columna DESPUÉS de los textos libres (FUENTE DE ORIGEN): responsable, estado y cierre no se corren', () => {
    const f = odt('90000005', { estado: 'CERRADA', cerrada: '01/05/2026 08:00', extra: { 'FUENTE DE ORIGEN': 'WEB|APP' } });
    const l = leer(csv([f.join('|')]));
    const r = l.registros[0];
    assert.deepEqual([r.nro, r.estado, r.responsable, r.cerrada], ['90000005', 'CERRADA', RESP_A, '2026-05-01']);
    assert.equal(D.analizarResponsable(l, RESP_A).odts.length, 1);
    assert.match(D.avisosDeLectura(l, null).join(' '), /Líneas 2 \(ODT 90000005\)/);
  });
  test('muchas filas raras: la lista se corta con «…» y la frase no termina en «….»', () => {
    const l = leer(csv(Array.from({ length: 10 }, (_, i) => odt(String(90000100 + i), { extra: { OBSERVACIONES: 'a|b' } }).join('|'))));
    const av = D.avisosDeLectura(l, null);
    assert.ok(av.length >= 1);
    for (const x of av) assert.ok(!x.endsWith('….') && !x.includes('….'), x);
    assert.ok(av[0].endsWith('…'), av[0]);
  });
  test('columnas de menos que no se pueden unir: se lee de izquierda a derecha y se avisa; una fila sin N.º no cuenta', () => {
    const corta = odt('90000014').slice(0, 30).join('|');
    const sinNro = odt('').join('|');
    const l = leer(csv([corta, odt('90000015'), sinNro]));
    assert.deepEqual(l.raras, [{ linea: 2, columnas: 30, tipo: 'de menos', nro: '90000014', responsable: '', incompleta: true }]);
    assert.equal(l.registros[0].nro, '90000014');
    assert.equal(l.registros[0].estado, '', 'el estado no vino');
    assert.deepEqual(l.sinNro, [4]);
    const avisos = D.avisosDeLectura(l, null).join(' ');
    assert.match(avisos, /vienen incompletas \(con columnas de menos\)/);
    assert.match(avisos, /quedaron sin responsable o sin estado y no entran en el corte de nadie: ODT 90000014 \(línea 2\)/);
    assert.match(avisos, /sin N\.º de ODT no se cuentan/);
  });
  test('otro archivo (separado por «;» como lo deja Excel, un CSV cualquiera, vacío): se reconoce; si faltan pocas columnas, no', () => {
    const conPuntoYComa = csv([fila().join(';')], { encabezados: D.ENCABEZADOS_AFINIA }).replace(/\|/g, ';');
    for (const t of [conPuntoYComa, 'nombre,valor\r\nuno,1\r\n', 'A|B|C\r\n1|2|3\r\n', '']) {
      const l = leer(t);
      assert.equal(l.ok, false);
      assert.equal(D.esOtroArchivo(l), true, JSON.stringify(t.slice(0, 20)));
    }
    const pocas = leer(csv([odt('90000001').slice(0, 47)], { encabezados: D.ENCABEZADOS_AFINIA.filter((x) => x !== 'ZONA') }));
    assert.deepEqual(pocas.faltan, ['ZONA']);
    assert.equal(D.esOtroArchivo(pocas), false, 'faltan unas pocas: se dicen cuáles');
    assert.equal(D.esOtroArchivo(leer(archivoBase())), false);
    assert.match(D.MSG_OTRO_ARCHIVO, /no es el «Informe Seguimiento de Órdenes de Trabajo» de Afinia en CSV\. Si lo abrió y lo guardó en Excel, descárguelo otra vez/);
  });
  test('fechas «dd/mm/aaaa hh:mm» → aaaa-mm-dd; las que no existen quedan vacías', () => {
    assert.equal(D.fechaIso('05/01/2026 07:00'), '2026-01-05');
    assert.equal(D.fechaIso('5/1/2026'), '2026-01-05');
    assert.equal(D.fechaIso('29/02/2028 10:00'), '2028-02-29');
    for (const x of ['29/02/2026 10:00', '31/04/2026', '00/01/2026', '2026-01-05', '', 'mañana']) assert.equal(D.fechaIso(x), '', x);
    assert.equal(D.fechaDMA('2026-01-05'), '05/01/2026');
    assert.equal(D.fechaDMA(''), '—');
    assert.equal(D.nombreMes('2026-03'), 'mar 2026');
    assert.equal(D.nombreMes('2026-03', true), 'marzo de 2026');
  });
  test('leer por pasos da lo mismo que de una vez, con avance y pausas', async () => {
    const t = csv(Array.from({ length: 50 }, (_, i) => odt(String(91000000 + i))));
    const avances = []; let pausas = 0;
    const l = await D.leerCsvPorPasos(t, { cada: 7, pausa: async () => { pausas++; }, alAvance: (f) => avances.push(f) });
    assert.deepEqual(l, leer(t));
    assert.ok(pausas >= 7, 'hubo pausas');
    assert.equal(avances.at(-1), 1);
    assert.ok(avances.every((x, i) => i === 0 || x >= avances[i - 1]), 'el avance no retrocede');
  });
});

describe('responsable, deduplicación y agregados', () => {
  const L = leer(archivoBase());
  test('normalización: sin tildes, mayúsculas, espacios simples (perfil de SGM ↔ CSV de Afinia)', () => {
    assert.equal(D.normalizarNombre(RESP_A_PERFIL), RESP_A);
    assert.equal(D.normalizarNombre('  José   Ñandú  '), 'JOSE NANDU');
    assert.equal(D.buscarResponsable(L, RESP_A_PERFIL).nombre, RESP_A);
    assert.equal(D.buscarResponsable(L, 'Nadie De Prueba'), null);
    assert.equal(D.buscarResponsable(L, ''), null);
  });
  test('RESP_A: 9 filas → 8 ODT (la repetida cuenta una vez, con el estado de su PRIMERA fila y su fecha prevista más temprana)', () => {
    const a = D.analizarResponsable(L, RESP_A_PERFIL);
    assert.equal(a.encontrado, true);
    assert.equal(a.responsable, RESP_A);
    assert.equal(a.filasResponsable, 9);
    assert.equal(a.odts.length, 8);
    assert.equal(a.repetidas, 1);
    assert.deepEqual(a.conflictos, []);
    const o2 = a.odts.find((o) => o.nro === '90000002');
    assert.equal(o2.prevista, '2026-02-10', 'la más temprana');
    assert.equal(a.previstasDistintas, 1);
    assert.deepEqual(Object.keys(o2).sort(), ['azt', 'cerrada', 'empresa', 'estado', 'jefe', 'nro', 'prevista', 'principal', 'subestacion', 'tipo', 'zona']);
  });
  test('totales, % de cierre y «Otro» para un estado que la página no conoce', () => {
    const a = D.analizarResponsable(L, RESP_A);
    assert.deepEqual(sinTotal(a.totales), [8, 1, 1, 1, 3, 1, 1]);
    assert.equal(D.pctCierre(a.totales), 0.5, '3 ÷ (8 − 1 − 1)');
    assert.equal(D.textoPct(D.pctCierre(a.totales)), '50,0 %');
    assert.deepEqual(a.avisos.otrosEstados, [{ estado: 'SUSPENDIDA', n: 1 }]);
    assert.equal(D.claveEstado('suspendida'), 'otro');
    assert.equal(D.claveEstado(' no  ejecutada '), 'noEjecutada');
    assert.equal(D.valorIndicador(a.totales, 'noEjecutadaInactiva'), 2);
    assert.match(D.avisosDeLectura(L, a).join(' '), /no conoce.*SUSPENDIDA \(1\)/);
  });
  test('por contratista (total, cada estado y % de cierre), por tipo y por zona', () => {
    const a = D.analizarResponsable(L, RESP_A);
    const por = Object.fromEntries(a.porEmpresa.map((e) => [e.clave, e]));
    assert.deepEqual(a.porEmpresa.map((e) => e.clave), [ALFA, BETA, GAMMA], 'de mayor a menor');
    assert.deepEqual(sinTotal(por[ALFA]), [4, 1, 1, 0, 2, 0, 0]);
    assert.deepEqual(sinTotal(por[BETA]), [3, 0, 0, 1, 1, 1, 0]);
    assert.deepEqual(sinTotal(por[GAMMA]), [1, 0, 0, 0, 0, 0, 1]);
    assert.equal(D.textoPct(D.pctCierre(por[ALFA])), '50,0 %');
    assert.equal(D.textoPct(D.pctCierre(por[BETA])), '100,0 %', '1 ÷ (3 − 1 − 1)');
    assert.equal(D.textoPct(D.pctCierre(por[GAMMA])), '0,0 %', 'Otro queda en el divisor');
    assert.equal(D.pctCierre({ total: 2, noEjecutada: 1, inactiva: 1, cerrada: 0 }), null, 'sin divisor');
    assert.equal(D.textoPct(null), '—');
    assert.deepEqual(a.porTipo.map((t) => [t.clave, t.total]), [['TIPO DOS', 4], ['TIPO UNO', 4]]);
    assert.deepEqual(a.porZona.map((t) => [t.clave, t.total]), [['ZONA NORTE', 5], ['ZONA SUR', 3]]);
  });
  test('por mes: generadas por la fecha prevista y cerradas por la FECHA ODT CERRADA; rango de fechas previstas', () => {
    const a = D.analizarResponsable(L, RESP_A);
    assert.deepEqual(a.porMes, [
      { mes: '2026-01', generadas: 1, cerradas: 0 },
      { mes: '2026-02', generadas: 2, cerradas: 0 },
      { mes: '2026-03', generadas: 4, cerradas: 2 },
      { mes: '2026-04', generadas: 1, cerradas: 1 }
    ]);
    assert.deepEqual(a.rango, { desde: '2026-01-05', hasta: '2026-04-06' });
    assert.equal(a.avisos.antesDelPeriodo, 0);
  });
  test('una misma ODT con estados (o contratistas) distintos en sus filas: se toma la primera y se avisa', () => {
    const l = leer(csv([
      odt('90000021', { estado: 'EJECUTADA' }), odt('90000021', { estado: 'CERRADA', cerrada: '01/05/2026 08:00' }),
      odt('90000022', { empresa: ALFA }), odt('90000022', { empresa: BETA })
    ]));
    const a = D.analizarResponsable(l, RESP_A);
    assert.equal(a.odts.length, 2);
    assert.equal(a.odts[0].estado, 'EJECUTADA');
    assert.equal(a.odts[1].empresa, ALFA);
    assert.deepEqual(a.conflictos.map((c) => [c.nro, c.campo, c.primero, c.otro]), [['90000021', 'estado', 'EJECUTADA', 'CERRADA'], ['90000022', 'empresa', ALFA, BETA]]);
    const av = D.avisosDeLectura(l, a).join(' ');
    assert.match(av, /estados distintos.*90000021 \(EJECUTADA \/ CERRADA\)/);
    assert.match(av, /contratistas distintos.*90000022/);
  });
  test('la fecha prevista de una ODT repetida: la MÁS TEMPRANA de sus filas, sin importar el orden del archivo (y se avisa)', () => {
    const filas = [odt('90000041', { prevista: '20/05/2026 08:00', estado: 'EJECUTADA' }), odt('90000041', { prevista: '02/03/2026 08:00', estado: 'EJECUTADA' })];
    const a1 = D.analizarResponsable(leer(csv(filas)), RESP_A);
    const a2 = D.analizarResponsable(leer(csv([...filas].reverse())), RESP_A);
    assert.equal(a1.odts[0].prevista, '2026-03-02');
    assert.equal(a2.odts[0].prevista, '2026-03-02');
    assert.deepEqual(a1.porMes, a2.porMes, 'el mes de «generadas» no depende del orden');
    assert.match(D.avisosDeLectura(leer(csv(filas)), a1).join(' '), /1 ODT traen fechas previstas distintas en sus filas: se tomó la más temprana/);
  });
  test('un N.º con dos responsables: cuenta una vez en el archivo y una en cada responsable, y se avisa (también al elegido)', () => {
    const l = leer(csv([odt('90000042'), odt('90000042', { resp: RESP_B, empresa: BETA }), odt('90000043', { resp: RESP_B })]));
    assert.equal(l.odtsArchivo, 2);
    assert.deepEqual(l.responsables.map((r) => r.odts), [2, 1]);
    assert.deepEqual(l.compartidos, [{ nro: '90000042', claves: [RESP_B, RESP_A].sort() }]);
    const av = D.avisosDeLectura(l, D.analizarResponsable(l, RESP_A)).join(' ');
    assert.match(av, /1 N\.º de ODT aparecen con dos o más responsables distintos/);
    assert.match(av, /1 de ellos son de este responsable: 90000042/);
    // Si el N.º compartido no es del elegido, no se le atribuye.
    const l3 = leer(csv([odt('90000045', { resp: RESP_B }), odt('90000045', { resp: 'TERCERA PERSONA DE PRUEBA' }), odt('90000046')]));
    assert.ok(!/de ellos son de este responsable/.test(D.avisosDeLectura(l3, D.analizarResponsable(l3, RESP_A)).join(' ')));
  });
  test('avisos de fechas: antes del 01/01/2026, sin fecha prevista legible, cerrada sin fecha de cierre', () => {
    const l = leer(csv([
      odt('90000031', { prevista: '20/12/2025 08:00' }), odt('90000032', { prevista: '31/02/2026 08:00' }),
      odt('90000033', { estado: 'CERRADA', cerrada: '' })
    ]));
    const a = D.analizarResponsable(l, RESP_A);
    assert.equal(a.avisos.antesDelPeriodo, 1);
    assert.equal(a.avisos.sinPrevista, 1);
    assert.equal(a.avisos.cerradasSinFecha, 1);
    assert.equal(a.fechasIlegibles, 1);
    const av = D.avisosDeLectura(l, a).join(' ');
    assert.match(av, /anterior al 01\/01\/2026/);
    assert.match(av, /no traen una fecha prevista legible/);
    assert.match(av, /no traen FECHA ODT CERRADA/);
  });
  test('un responsable que no está en el archivo: sin ODT', () => {
    const a = D.analizarResponsable(L, 'Nadie De Prueba');
    assert.equal(a.encontrado, false);
    assert.equal(a.odts.length, 0);
    assert.equal(a.totales.total, 0);
    assert.deepEqual(a.rango, { desde: '', hasta: '' });
  });
});

describe('% de cierre, meses sin huecos y fecha de los datos', () => {
  test('el % de cierre se redondea con enteros, como REDONDEAR de Excel (201 de 400 = 50,3 %)', () => {
    assert.equal(D.textoCierre({ total: 400, cerrada: 201, noEjecutada: 0, inactiva: 0 }), '50,3 %');
    assert.equal(D.textoPct(201 / 400), '50,3 %');
    assert.equal(D.textoCierre({ total: 3, cerrada: 1, noEjecutada: 0, inactiva: 0 }), '33,3 %');
    assert.equal(D.textoCierre({ total: 2, cerrada: 0, noEjecutada: 1, inactiva: 1 }), '—', 'sin divisor');
    let distintos = 0;
    for (let den = 1; den <= 400; den++) {
      for (let c = 0; c <= den; c++) {
        const esperado = (Math.round((c * 1000) / den) / 10).toFixed(1).replace('.', ',') + ' %';
        if (D.textoCierre({ total: den, cerrada: c, noEjecutada: 0, inactiva: 0 }) !== esperado || D.textoPct(c / den) !== esperado) distintos++;
      }
    }
    assert.equal(distintos, 0);
    assert.equal(D.deltaCierre({ total: 400, cerrada: 200 }, { total: 400, cerrada: 201 }), '+0,3 puntos', 'la resta de lo que se muestra');
    assert.equal(D.deltaCierre({ total: 4, cerrada: 2 }, { total: 4, cerrada: 2 }), '0 puntos');
    assert.equal(D.deltaCierre(null, { total: 4, cerrada: 2 }), '—');
  });
  test('los meses sin datos van en 0 (desde enero de 2026 hasta el último con datos): el eje no salta meses', () => {
    const odts = [
      { nro: '90000051', estado: 'CERRADA', prevista: '2026-02-03', cerrada: '2026-05-10' },
      { nro: '90000052', estado: 'GENERADA', prevista: '2026-06-01', cerrada: '' }
    ];
    assert.deepEqual(D.agregar(odts).porMes, [
      { mes: '2026-01', generadas: 0, cerradas: 0 }, { mes: '2026-02', generadas: 1, cerradas: 0 }, { mes: '2026-03', generadas: 0, cerradas: 0 },
      { mes: '2026-04', generadas: 0, cerradas: 0 }, { mes: '2026-05', generadas: 0, cerradas: 1 }, { mes: '2026-06', generadas: 1, cerradas: 0 }
    ]);
    // Con un filtro (las ODT de un tipo, p. ej.) también: los meses vacíos entre medio quedan en 0.
    assert.deepEqual(D.rellenarMeses([{ mes: '2026-11', generadas: 2, cerradas: 1 }, { mes: '2026-09', generadas: 1, cerradas: 0 }]).map((m) => m.mes),
      ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    assert.deepEqual(D.rellenarMeses([{ mes: '2025-12', generadas: 1, cerradas: 0 }]).map((m) => m.mes), ['2025-12'], 'un mes anterior al periodo abre el tramo');
    assert.deepEqual(D.rellenarMeses([]), []);
    // Un tramo absurdo (una fecha mal escrita) no infla el gráfico: quedan solo los meses con datos.
    assert.deepEqual(D.rellenarMeses([{ mes: '2026-01', generadas: 1, cerradas: 0 }, { mes: '2099-01', generadas: 1, cerradas: 0 }]).map((m) => m.mes), ['2026-01', '2099-01']);
  });
  test('la fecha de los datos: la hora de descarga del nombre del archivo; si no la trae, el final del día de la prevista más reciente', () => {
    assert.equal(D.selloDeArchivo('INFORME_ODT_20260315083000_prueba.csv'), '2026-03-15T08:30:00');
    for (const x of ['INFORME_ODT_20261340083000_prueba.csv', 'INFORME_ODT_20260315253000_x.csv', 'otro.csv', '']) assert.equal(D.selloDeArchivo(x), '', x);
    assert.deepEqual(D.fechaDatosDe('INFORME_ODT_20260315083000_prueba.csv', { hasta: '2026-03-01' }), { valor: '2026-03-15T08:30:00', origen: 'archivo' });
    assert.deepEqual(D.fechaDatosDe('copia.csv', { desde: '2026-01-02', hasta: '2026-03-01' }), { valor: '2026-03-01T23:59:59', origen: 'rango' });
    assert.deepEqual(D.fechaDatosDe('copia.csv', {}), { valor: '', origen: '' });
    assert.equal(D.textoFechaDatos({ archivo: { nombre: 'INFORME_ODT_20260315083000_prueba.csv' } }), '15/03/2026 03:30');
    // La hora del nombre es UTC: se muestra en hora de Colombia (UTC−5), también cuando cambia el día.
    assert.equal(D.textoFechaDatos({ archivo: { nombre: 'INFORME_ODT_20990301024500_prueba.csv' } }), '28/02/2099 21:45');
    assert.equal(D.textoHoraColombiaDeSello('2099-12-31T23:59:59'), '31/12/2099 18:59');
    assert.equal(D.textoHoraColombiaDeSello('no'), '');
    assert.equal(D.textoFechaDatos({ archivo: { nombre: 'copia.csv' }, rango: { hasta: '2026-03-01' } }), '01/03/2026 (fecha prevista más reciente)');
    assert.equal(D.textoFechaDatos({}), '—');
    assert.equal(D.fechaDatosDeCorte({ fechaDatos: '2026-04-01T10:00:00', archivo: { nombre: 'INFORME_ODT_20260315083000_x.csv' } }), '2026-04-01T10:00:00', 'la guardada manda');
  });
});

describe('filtros, selección y orden', () => {
  const a = D.analizarResponsable(leer(archivoBase()), RESP_A);
  test('filtrar por tipo, zona y contratista recalcula', () => {
    assert.equal(D.filtrar(a.odts, { tipo: 'TIPO UNO' }).length, 4);
    assert.equal(D.filtrar(a.odts, { zona: 'ZONA SUR', empresa: BETA }).length, 2);
    assert.deepEqual(sinTotal(D.agregar(D.filtrar(a.odts, { empresa: ALFA })).totales), [4, 1, 1, 0, 2, 0, 0]);
    assert.equal(D.filtrar(a.odts, {}).length, 8);
    const o = D.opcionesFiltro(a.odts);
    assert.deepEqual(o.tipos, ['TIPO DOS', 'TIPO UNO']);
    assert.deepEqual(o.zonas, ['ZONA NORTE', 'ZONA SUR']);
    assert.deepEqual(o.empresas, [BETA, ALFA, GAMMA].sort((x, y) => x.localeCompare(y, 'es')));
  });
  test('las ODT detrás de un número, por fecha prevista', () => {
    assert.deepEqual(D.seleccionar(a.odts, { clave: 'cerrada' }).map((o) => o.nro), ['90000002', '90000004', '90000006']);
    assert.deepEqual(D.seleccionar(a.odts, { empresa: BETA, clave: 'noEjecutadaInactiva' }).map((o) => o.nro), ['90000005', '90000007']);
    assert.deepEqual(D.seleccionar(a.odts, { clave: 'otro' }).map((o) => o.nro), ['90000008']);
    assert.equal(D.seleccionar(a.odts, { clave: 'total' }).length, 8);
    assert.equal(D.seleccionar(a.odts, { empresa: GAMMA, clave: 'total' }).length, 1);
  });
  test('ordenar la tabla por columna, por % de cierre y por nombre', () => {
    assert.deepEqual(D.ordenarFilas(a.porEmpresa, 'cerrada', 'desc').map((f) => f.clave), [ALFA, BETA, GAMMA]);
    assert.deepEqual(D.ordenarFilas(a.porEmpresa, 'pct', 'desc').map((f) => f.clave), [BETA, ALFA, GAMMA]);
    assert.deepEqual(D.ordenarFilas(a.porEmpresa, 'total', 'asc').map((f) => f.clave), [GAMMA, BETA, ALFA]);
    assert.deepEqual(D.ordenarFilas(a.porEmpresa, 'clave', 'asc').map((f) => f.clave), [BETA, ALFA, GAMMA].sort((x, y) => x.localeCompare(y, 'es')));
  });
});

describe('comparación entre cortes', () => {
  const antes = D.analizarResponsable(leer(archivoBase()), RESP_A).odts;
  const ahora = antes.filter((o) => o.nro !== '90000007').map((o) => (o.nro === '90000001' ? { ...o, estado: 'EJECUTADA' } : o.nro === '90000003' ? { ...o, estado: 'CERRADA', cerrada: '2026-05-01' } : o));
  ahora.push({ ...antes[0], nro: '90000099', estado: 'GENERADA' });
  const c = D.compararCortes(antes, ahora);
  test('diferencias por estado (y el % de cierre antes y ahora)', () => {
    const d = Object.fromEntries(c.totales.map((x) => [x.clave, [x.antes, x.ahora, x.delta]]));
    assert.deepEqual(d.total, [8, 8, 0]);
    assert.deepEqual(d.generada, [1, 1, 0]);
    assert.deepEqual(d.ejecutada, [1, 1, 0]);
    assert.deepEqual(d.cerrada, [3, 4, 1]);
    assert.deepEqual(d.inactiva, [1, 0, -1]);
    assert.equal(c.pct.antes, 0.5);
    assert.equal(c.pct.ahora, 4 / 7);
  });
  test('por contratista, las que cambiaron de estado, las nuevas y las que salieron', () => {
    const alfa = c.porEmpresa.find((x) => x.clave === ALFA);
    assert.equal(alfa.delta.total, 1);
    assert.equal(alfa.delta.cerrada, 1);
    const beta = c.porEmpresa.find((x) => x.clave === BETA);
    assert.equal(beta.delta.inactiva, -1);
    assert.deepEqual(c.cambios.map((x) => [x.nro, x.de, x.a]), [['90000001', 'GENERADA', 'EJECUTADA'], ['90000003', 'EJECUTADA', 'CERRADA']]);
    assert.deepEqual(c.nuevas.map((x) => x.nro), ['90000099']);
    assert.deepEqual(c.salieron.map((x) => x.nro), ['90000007']);
    assert.equal(D.textoDelta(3), '+3');
    assert.equal(D.textoDelta(-2), '−2');
    assert.equal(D.textoDelta(0), '0');
  });
  test('el corte anterior es el del MISMO responsable creado antes (no otro, ni uno posterior)', () => {
    const cortes = [
      { id: 'C4', responsable: RESP_A, creadoEnMs: 400 }, { id: 'C3', responsable: RESP_B, creadoEnMs: 300 },
      { id: 'C2', responsable: RESP_A_PERFIL, creadoEnMs: 200 }, { id: 'C1', responsable: RESP_A, creadoEnMs: 100 }
    ];
    assert.equal(D.corteAnterior(cortes, cortes[0]).id, 'C2');
    assert.equal(D.corteAnterior(cortes, cortes[2]).id, 'C1');
    assert.equal(D.corteAnterior(cortes, cortes[3]), null);
    assert.equal(D.corteAnterior(cortes, cortes[1]), null);
  });
  test('el corte anterior se elige por la fecha de los DATOS: un archivo viejo cargado hoy no invierte la comparación', () => {
    const cortes = [
      // Guardado el último, pero con datos de marzo (un archivo viejo cargado para completar el historial).
      { id: 'VIEJO', responsable: RESP_A, archivo: { nombre: 'INFORME_ODT_20260310080000_x.csv' }, creadoEnMs: 900 },
      { id: 'ABRIL', responsable: RESP_A, fechaDatos: '2026-04-20T09:00:00', creadoEnMs: 500 },
      { id: 'FEB', responsable: RESP_A, fechaDatos: '2026-02-01T09:00:00', creadoEnMs: 100 },
      { id: 'ABRIL2', responsable: RESP_A, fechaDatos: '2026-04-20T09:00:00', creadoEnMs: 600 }
    ];
    const por = Object.fromEntries(cortes.map((c) => [c.id, c]));
    assert.equal(D.corteAnterior(cortes, por.ABRIL).id, 'VIEJO');
    assert.equal(D.corteAnterior(cortes, por.VIEJO).id, 'FEB');
    assert.equal(D.corteAnterior(cortes, por.FEB), null);
    assert.equal(D.corteAnterior(cortes, por.ABRIL2).id, 'ABRIL', 'a igualdad de datos, el guardado antes');
    assert.equal(D.corteMasReciente(cortes, RESP_A_PERFIL).id, 'ABRIL2', 'el de datos más recientes (comparado sin tildes)');
    assert.equal(D.corteMasReciente(cortes, RESP_B), null);
  });
  test('cómo puede estar GUARDADO un responsable (la consulta del servidor compara exacto): con la Ñ de Afinia y sin ella', () => {
    assert.equal(D.nombreComoAfinia('Persona  Muñoz Pérez Güell'), 'PERSONA MUÑOZ PEREZ GÜELL', 'sin tildes, con Ñ y Ü');
    assert.equal(D.normalizarNombre('Persona Muñoz'), 'PERSONA MUNOZ', 'la normalizada quita la Ñ (solo sirve para comparar)');
    assert.deepEqual(D.formasGuardadas('Persona Muñoz', []), ['PERSONA MUÑOZ', 'PERSONA MUNOZ']);
    // Lo que ya muestra el historial va primero (sin repetidos), y solo de ese nombre.
    assert.deepEqual(D.formasGuardadas('Persona Muñoz', [{ responsable: 'PERSONA  MUÑOZ' }, { responsable: RESP_B }, null]), ['PERSONA MUÑOZ', 'PERSONA MUNOZ']);
    assert.deepEqual(D.formasGuardadas(RESP_A_PERFIL, [{ responsable: RESP_A }]), [RESP_A]);
    assert.deepEqual(D.formasGuardadas('  ', []), []);
  });
});

describe('estado en SGM (solo lectura)', () => {
  test('gana la más avanzada; anuladas, reemplazadas y obs resueltas no cuentan', () => {
    const m = D.mapaEstadoSgm({
      odts: [
        { nro: '90000001', estado: 'PENDIENTE_AZT' }, { nro: '90000002', estado: 'LISTA' }, { nro: '90000003', estado: 'CERRADA' },
        { nro: '90000004', estado: 'ANULADA' }, { nro: '90000005', estado: 'REEMPLAZADA' }, { nro: '90000005', estado: 'PENDIENTE_RESPONSABLE' },
        { nro: '90000003', estado: 'REEMPLAZADA' }
      ],
      obs: [{ nro: '90000001', estado: 'ABIERTA' }, { nro: '90000004', estado: 'ABIERTA' }, { nro: '90000006', estado: 'RESUELTA' }]
    });
    assert.deepEqual(Object.fromEntries([...m].map(([k, v]) => [k, v.etiqueta])), {
      90000001: 'Publicada en firma', 90000002: 'Lista', 90000003: 'Cerrada en SGM', 90000004: 'Por subsanar', 90000005: 'Publicada en firma'
    });
    assert.equal(D.mapaEstadoSgm().size, 0);
  });
});
