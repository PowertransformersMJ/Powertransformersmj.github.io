// Firma de ODT Afinia · «POR SUBSANAR» · las filas del EXCEL (dominio puro) y el libro que arma la pantalla, leído de
// vuelta con la SheetJS 0.18.5 de node_modules (la misma versión del CDN):
//   · «Detalle»: una fila por punto, las 16 columnas en el orden pedido, estados y «a quién le toca» en llano, las tres
//     columnas «Sí»/vacía, la nota del AZT con su fecha (y la devolución, si fue lo último), fechas como FECHAS de Excel
//     en la hora de Colombia, los puntos en su orden y las ODT abiertas primero (por N.º);
//   · «Resumen»: una fila por ODT con sus conteos;
//   · por defecto solo las ABIERTAS; «Incluir las ya resueltas» suma las RESUELTAS;
//   · el libro: dos hojas, encabezado en la fila 1, filtro en TODO el rango, anchos, formato de fecha y texto completo;
//   · el nombre del archivo con la fecha de Colombia.
// Datos INVENTADOS (repo público): N.º que empiezan por 9, personas y subestaciones de prueba.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import {
  armarHojas, filasDetalle, filasResumen, obsParaExportar, nombreArchivoExcel, notaDelAzt, serialDeFechaDMA, serialDeMs, textoFechaHora,
  COLUMNAS_DETALLE, COLUMNAS_RESUMEN, NOMBRE_HOJA, ETIQUETA_ESTADO_PUNTO, FORMATO_FECHA, FORMATO_FECHA_HORA, SI
} from '../assets/js/domain/odt_afinia_obs_excel.js';
import { armarLibro } from '../assets/js/ui/odt-afinia/subsanar-excel.js';

const XLSX = createRequire(import.meta.url)('xlsx');

// Colombia es UTC−5 todo el año: 15:30 UTC = 10:30 en Colombia.
const enCol = (a, m, d, hh = 0, mi = 0) => Date.UTC(a, m - 1, d, hh + 5, mi);
const POR_AZT = { uid: 'uid-azt-prueba', nombre: 'Azt De Prueba' };
const POR_ADMIN = { uid: 'uid-admin-prueba', nombre: 'Admin De Prueba' };
const TEXTO_LARGO = 'Registro fotográfico: reemplazar la imagen 3 por una tomada en esta visita. ' + 'Detalle de prueba. '.repeat(27);

function registro({ id, nro, estado = 'ABIERTA', fechaPrevista = '05/10/2026', equipo = 'TR-Prueba', puntos }) {
  return {
    obs: { id, nro, subestacion: 'S/E Prueba ' + nro.slice(-1), equipo, fechaPrevista, azt: { uid: POR_AZT.uid, nombre: POR_AZT.nombre }, estado, creadoEnMs: enCol(2026, 10, 6, 9, 0) },
    puntos
  };
}
const ABIERTA_B = registro({
  id: 'IdObsPruebaB00000002', nro: '90000002',
  puntos: [
    // Desordenados a propósito: el Excel los pone en su orden (1, 2, 3, 4).
    { id: '2', orden: 2, texto: 'Aclarar en qué sitio estaba el grupo el 05/10/2026 por la mañana.', quien: 'azt', estado: 'VERIFICADO', rev: 2,
      creadoEnMs: enCol(2026, 10, 6, 9, 0),
      rastro: { 1: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Estuvimos en la S/E Prueba 2', por: POR_AZT, enMs: enCol(2026, 10, 7, 8, 15) },
        2: { de: 'SUBSANADO', a: 'VERIFICADO', nota: '', por: POR_ADMIN, enMs: enCol(2026, 10, 8, 9, 0) } } },
    { id: '0', orden: 0, texto: 'Control previo: ajustar la hora anotada (06:00).', quien: 'contratista', estado: 'PENDIENTE', rev: 0, rastro: {},
      creadoEnMs: enCol(2026, 10, 6, 9, 0) },
    { id: '3', orden: 3, texto: 'Definir en el sistema la hora real fin que vale.', quien: 'responsable', estado: 'PENDIENTE', rev: 2,
      creadoEnMs: enCol(2026, 10, 9, 14, 45),
      rastro: { 1: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Ya se corrigió', por: POR_AZT, enMs: enCol(2026, 10, 10, 10, 0) },
        2: { de: 'SUBSANADO', a: 'PENDIENTE', nota: 'Falta la hora fin', por: POR_ADMIN, enMs: enCol(2026, 10, 11, 16, 5) } } },
    { id: '1', orden: 1, texto: TEXTO_LARGO, quien: 'contratista', estado: 'SUBSANADO', rev: 1, creadoEnMs: enCol(2026, 10, 6, 9, 0),
      rastro: { 1: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Se cambió la foto', por: POR_AZT, enMs: enCol(2026, 10, 7, 10, 30) } } }
  ]
});
const ABIERTA_A = registro({
  id: 'IdObsPruebaA00000001', nro: '90000001', equipo: '',
  puntos: [
    { id: '0', orden: 0, texto: 'Si el AZT confirma otro día, ajustar el día en la ODT, en el control previo y en el registro fotográfico.',
      quien: 'contratista', estado: 'PENDIENTE', rev: 0, rastro: {} },        // sin creadoEnMs: va la fecha de la obs
    { id: '1', orden: 1, texto: 'Aviso: punto informativo de prueba.', quien: 'azt', estado: 'PENDIENTE', rev: 0, rastro: {}, creadoEnMs: enCol(2026, 10, 6, 9, 0) }
  ]
});
const RESUELTA = registro({
  id: 'IdObsPruebaC00000003', nro: '90000000', estado: 'RESUELTA',
  puntos: [{ id: '0', orden: 0, texto: 'Registro fotográfico: agregar una imagen nítida de la placa.', quien: 'contratista', estado: 'VERIFICADO', rev: 2, rastro: {},
    creadoEnMs: enCol(2026, 10, 6, 9, 0) }]
});
const TODOS = [RESUELTA, ABIERTA_B, ABIERTA_A];

describe('columnas', () => {
  test('«Detalle»: las 16 columnas en el orden pedido; «Resumen»: las 14', () => {
    assert.deepEqual(COLUMNAS_DETALLE.map((c) => c.titulo), [
      'N.º ODT', 'Subestación', 'Equipo', 'Fecha prevista', 'AZT asignado', 'Estado de la ODT', 'N.º del punto', 'Documento',
      'Control previo', 'Registro fotográfico', 'ODT', 'A quién le toca', 'Estado del punto', 'Nota del AZT y fecha', 'Registrado el', 'Qué hay que corregir'
    ]);
    assert.deepEqual(COLUMNAS_RESUMEN.map((c) => c.titulo), [
      'N.º ODT', 'Subestación', 'Equipo', 'Fecha prevista', 'AZT asignado', 'Estado de la ODT', 'Puntos totales', 'Pendientes',
      'Subsanados por verificar', 'Verificados', 'Puntos de control previo', 'Puntos de registro fotográfico', 'Puntos de ODT', 'Aclaraciones del AZT'
    ]);
    for (const c of [...COLUMNAS_DETALLE, ...COLUMNAS_RESUMEN]) {
      assert.ok(Number.isInteger(c.ancho) && c.ancho >= c.titulo.length + 2, c.titulo + ': el ancho deja ver el título y el botón del filtro');
    }
    assert.equal(COLUMNAS_DETALLE.find((c) => c.titulo === 'Qué hay que corregir').ancho, 90, 'el texto, ancho');
    assert.ok(COLUMNAS_DETALLE.find((c) => c.titulo === 'Documento').ancho >= 'Control previo + Registro fotográfico + ODT'.length + 2,
      'la etiqueta más larga de «Documento» se ve entera');
    assert.deepEqual(COLUMNAS_DETALLE.filter((c) => c.formato).map((c) => [c.titulo, c.formato]), [['Fecha prevista', FORMATO_FECHA], ['Registrado el', FORMATO_FECHA_HORA]]);
    assert.deepEqual({ ...ETIQUETA_ESTADO_PUNTO }, { PENDIENTE: 'Pendiente', SUBSANADO: 'Subsanado (falta verificar)', VERIFICADO: 'Verificado' });
    assert.deepEqual({ ...NOMBRE_HOJA }, { detalle: 'Detalle', resumen: 'Resumen' });
  });
});

describe('fechas en la hora de Colombia', () => {
  test('dd/mm/aaaa → fecha de Excel; milisegundos → fecha y hora de Colombia', () => {
    assert.equal(serialDeFechaDMA('01/01/2026'), 46023);
    assert.equal(serialDeFechaDMA('15/11/2026'), 46341);
    assert.equal(serialDeFechaDMA('31/02/2026'), null, 'un día que no existe');
    assert.equal(serialDeFechaDMA('2026-11-15'), null);
    assert.equal(serialDeMs(Date.UTC(2026, 10, 15, 15, 30)), 46341 + 10.5 / 24, '15:30 UTC = 10:30 en Colombia');
    assert.equal(serialDeMs(Date.UTC(2026, 10, 16, 3, 0)), 46341 + 22 / 24, 'a las 03:00 UTC del 16 todavía es el 15 en Colombia');
    assert.equal(serialDeMs(null), null);
    assert.equal(textoFechaHora(Date.UTC(2026, 10, 16, 3, 0)), '15/11/2026 22:00');
    assert.equal(textoFechaHora(undefined), '');
  });
  test('nombre del archivo: ODT_por_subsanar_AAAA-MM-DD.xlsx con la fecha de Colombia', () => {
    assert.equal(nombreArchivoExcel(new Date(Date.UTC(2026, 10, 24, 15, 0))), 'ODT_por_subsanar_2026-11-24.xlsx');
    assert.equal(nombreArchivoExcel(new Date(Date.UTC(2026, 10, 25, 3, 0))), 'ODT_por_subsanar_2026-11-24.xlsx', 'las 22:00 en Colombia: todavía es el 24');
    assert.equal(nombreArchivoExcel(new Date(Date.UTC(2027, 0, 1, 5, 0))), 'ODT_por_subsanar_2027-01-01.xlsx');
  });
});

describe('qué ODT entran y en qué orden', () => {
  test('por defecto solo las ABIERTAS (por N.º); con «Incluir las ya resueltas», también las RESUELTAS, después', () => {
    const lista = TODOS.map((r) => r.obs);
    assert.deepEqual(obsParaExportar(lista).map((o) => o.nro), ['90000001', '90000002']);
    assert.deepEqual(obsParaExportar(lista, { incluirResueltas: true }).map((o) => o.nro), ['90000001', '90000002', '90000000']);
    assert.deepEqual(obsParaExportar(lista, { incluirResueltas: 'sí' }).map((o) => o.nro), ['90000001', '90000002'], 'solo true las incluye');
    assert.deepEqual(obsParaExportar([{ nro: '90000005', estado: 'OTRO' }, null]), [], 'un estado desconocido no entra');
    assert.deepEqual(obsParaExportar(undefined), []);
  });
});

describe('hoja «Detalle»', () => {
  const { hojas, odts, puntos } = armarHojas(TODOS);
  const [detalle, resumen] = hojas;
  test('dos hojas con el encabezado en la primera fila; una fila por punto de las ABIERTAS', () => {
    assert.deepEqual(hojas.map((x) => x.nombre), ['Detalle', 'Resumen']);
    assert.deepEqual(detalle.filas[0], COLUMNAS_DETALLE.map((c) => c.titulo));
    assert.deepEqual(resumen.filas[0], COLUMNAS_RESUMEN.map((c) => c.titulo));
    assert.equal(odts, 2);
    assert.equal(puntos, 6);
    assert.equal(detalle.filas.length, 1 + 6);
    for (const f of detalle.filas) assert.equal(f.length, 16);
  });
  test('orden: ODT 90000001 y luego 90000002; dentro, los puntos 1, 2, 3, 4', () => {
    assert.deepEqual(detalle.filas.slice(1).map((f) => [f[0], f[6]]), [
      ['90000001', 1], ['90000001', 2], ['90000002', 1], ['90000002', 2], ['90000002', 3], ['90000002', 4]
    ]);
  });
  test('cada columna de una fila: datos de la ODT, documento, «Sí»/vacío, a quién le toca, texto, estado, nota y fecha', () => {
    const f = detalle.filas.slice(1);
    // ODT 90000002, punto 2: el texto largo (registro fotográfico), subsanado con nota.
    assert.deepEqual(f[3], [
      '90000002', 'S/E Prueba 2', 'TR-Prueba', serialDeFechaDMA('05/10/2026'), 'Azt De Prueba', 'Abierta',
      2, 'Registro fotográfico', null, SI, null, 'Contratista', 'Subsanado (falta verificar)',
      'Se cambió la foto (07/10/2026 10:30)', serialDeMs(enCol(2026, 10, 6, 9, 0)), TEXTO_LARGO
    ]);
    assert.ok(TEXTO_LARGO.length > 500 && f[3][15] === TEXTO_LARGO, 'el texto va COMPLETO');
    // Punto 1 de 90000002: control previo, pendiente, sin nota.
    assert.deepEqual(f[2].slice(6), [1, 'Control previo', SI, null, null, 'Contratista', 'Pendiente', null, serialDeMs(enCol(2026, 10, 6, 9, 0)), 'Control previo: ajustar la hora anotada (06:00).']);
    // Punto 3: aclaración del AZT, verificada (la nota del AZT sigue a la vista).
    assert.deepEqual(f[4].slice(7, 14), ['Aclaración del AZT', null, null, null, 'AZT', 'Verificado', 'Estuvimos en la S/E Prueba 2 (07/10/2026 08:15)']);
    // Punto 4: del Responsable, devuelto: la nota del AZT y la devolución.
    assert.deepEqual(f[5].slice(7, 15), ['Sistema / decisión del Responsable', null, null, null, 'Responsable', 'Pendiente',
      'Ya se corrigió (10/10/2026 10:00) · Devuelto el 11/10/2026 16:05: Falta la hora fin', serialDeMs(enCol(2026, 10, 9, 14, 45))]);
    // ODT 90000001: equipo vacío (sin celda), los tres documentos y el aviso.
    assert.equal(f[0][2], null, 'un dato vacío va sin celda («(Vacías)» en el filtro)');
    assert.deepEqual(f[0].slice(7, 11), ['Control previo + Registro fotográfico + ODT', SI, SI, SI]);
    assert.equal(f[0][14], serialDeMs(enCol(2026, 10, 6, 9, 0)), 'sin fecha del punto: la de la ODT');
    assert.deepEqual(f[1].slice(7, 12), ['Aviso', null, null, null, 'AZT']);
  });
  test('«Incluir las ya resueltas»: la RESUELTA al final, con su estado', () => {
    const conResueltas = armarHojas(TODOS, { incluirResueltas: true });
    assert.equal(conResueltas.odts, 3);
    const ultima = conResueltas.hojas[0].filas.at(-1);
    assert.deepEqual([ultima[0], ultima[5], ultima[7], ultima[12]], ['90000000', 'Resuelta', 'Registro fotográfico', 'Verificado']);
  });
  test('la nota del AZT: la última vez que lo marcó subsanado; nada si nunca lo marcó', () => {
    assert.equal(notaDelAzt({ rastro: {} }), null);
    assert.equal(notaDelAzt({}), null);
    const p = { rastro: {
      1: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Primera', enMs: enCol(2026, 10, 1, 8, 0) },
      2: { de: 'SUBSANADO', a: 'PENDIENTE', nota: 'No sirve', enMs: enCol(2026, 10, 2, 8, 0) },
      3: { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Segunda', enMs: enCol(2026, 10, 3, 8, 0) }
    } };
    assert.equal(notaDelAzt(p), 'Segunda (03/10/2026 08:00)', 'la devolución ya quedó atrás');
  });
});

describe('hoja «Resumen»', () => {
  test('una fila por ODT con sus conteos (de los puntos leídos)', () => {
    const [, resumen] = armarHojas(TODOS).hojas;
    assert.deepEqual(resumen.filas.slice(1), [
      ['90000001', 'S/E Prueba 1', null, serialDeFechaDMA('05/10/2026'), 'Azt De Prueba', 'Abierta', 2, 2, 0, 0, 1, 1, 1, 0],
      ['90000002', 'S/E Prueba 2', 'TR-Prueba', serialDeFechaDMA('05/10/2026'), 'Azt De Prueba', 'Abierta', 4, 2, 1, 1, 1, 1, 0, 1]
    ]);
    assert.deepEqual(filasResumen([]), []);
    assert.deepEqual(filasDetalle([]), []);
  });
  test('sin ODT: las dos hojas quedan con su encabezado (y nada más)', () => {
    const vacio = armarHojas([]);
    assert.deepEqual(vacio.hojas.map((x) => x.filas.length), [1, 1]);
    assert.equal(vacio.odts, 0);
  });
});

describe('el libro (SheetJS 0.18.5) leído de vuelta', () => {
  const { hojas } = armarHojas(TODOS, { incluirResueltas: true });
  const bytes = XLSX.write(armarLibro(XLSX, hojas), { bookType: 'xlsx', type: 'buffer', compression: true });
  const leido = XLSX.read(bytes, { cellNF: true, cellStyles: true, cellDates: false });
  test('dos hojas, «Detalle» primero; encabezado en la fila 1; filas y columnas completas', () => {
    assert.deepEqual(leido.SheetNames, ['Detalle', 'Resumen']);
    const d = XLSX.utils.sheet_to_json(leido.Sheets.Detalle, { header: 1, defval: null });
    assert.deepEqual(d[0], COLUMNAS_DETALLE.map((c) => c.titulo));
    assert.equal(d.length, 1 + 7);
    assert.equal(leido.Sheets.Detalle['!ref'], 'A1:P8');
    assert.equal(leido.Sheets.Resumen['!ref'], 'A1:N4');
    assert.ok(d.some((f) => f[15] === TEXTO_LARGO), 'el texto completo, sin cortar');
  });
  test('filtro en TODO el rango de cada hoja (y el nombre oculto que Excel espera)', async () => {
    const zip = await JSZip.loadAsync(bytes);
    const h1 = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const h2 = await zip.file('xl/worksheets/sheet2.xml').async('string');
    assert.match(h1, /<autoFilter ref="A1:P8"\/>/);
    assert.match(h2, /<autoFilter ref="A1:N4"\/>/);
    const libro = await zip.file('xl/workbook.xml').async('string');
    assert.match(libro, /<definedName name="_xlnm\._FilterDatabase" localSheetId="0"[^>]*>&apos;Detalle&apos;!A1:P8<\/definedName>/);
    // Anchos: la columna del texto (P, la última) a 90 caracteres.
    assert.equal(leido.Sheets.Detalle['!cols'][15].wch, 90);
    assert.equal(leido.Sheets.Detalle['!cols'].length, 16);
  });
  test('las fechas son FECHAS de Excel con su formato; un «Sí» es texto; las vacías no tienen celda', () => {
    const ws = leido.Sheets.Detalle;
    assert.equal(ws.D2.t, 'n');
    assert.equal(ws.D2.z, FORMATO_FECHA);
    assert.equal(ws.D2.v, serialDeFechaDMA('05/10/2026'));
    assert.equal(ws.O2.z, FORMATO_FECHA_HORA);   // «Registrado el» (O); el texto va en P, la última
    assert.equal(ws.I2.v, 'Sí');
    assert.equal(ws.C2, undefined, 'el equipo vacío de la ODT 90000001');
    assert.equal(leido.Sheets.Resumen.D2.z, FORMATO_FECHA);
    assert.equal(leido.Sheets.Resumen.G2.t, 'n', 'los conteos son números');
  });
});
