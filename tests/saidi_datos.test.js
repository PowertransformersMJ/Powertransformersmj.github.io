// node --test tests/saidi_datos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colIdx, mesDesdeValor, diaDesdeValor, mesDesdePeriodo, diaDesdeColumna,
  detectarColumnaFecha, detectarColumnaPorHeader, agregarDatosCrudos,
  COLS_DATOS_DEFAULT, MESES_CANON, filtrarCausasCanonicas,
  filtrarPorCausa2, CAUSA2_SOBRECARGA, CAUSA2_TODAS,
} from '../assets/js/domain/saidi_datos.js';

// ── colIdx ────────────────────────────────────────────────────
test('colIdx convierte letras de columna a índice 0-based', () => {
  assert.equal(colIdx('A'), 0);
  assert.equal(colIdx('B'), 1);
  assert.equal(colIdx('Z'), 25);
  assert.equal(colIdx('AA'), 26);
  assert.equal(colIdx('N'), 13);   // Causa 2
  assert.equal(colIdx('AJ'), 35);  // SAIFI_E
  assert.equal(colIdx('AK'), 36);  // SAIDI_E
  assert.equal(colIdx('BG'), 58);  // ZONA
});

test('colIdx es case-insensitive y rechaza basura', () => {
  assert.equal(colIdx('aj'), 35);
  assert.equal(colIdx(''), -1);
  assert.equal(colIdx('A1'), -1);
  assert.equal(colIdx(null), -1);
});

test('COLS_DATOS_DEFAULT coincide con el mapeo del director', () => {
  assert.equal(COLS_DATOS_DEFAULT.causa,   colIdx('N'));
  assert.equal(COLS_DATOS_DEFAULT.periodo, colIdx('AC'));  // 28 · mes
  assert.equal(COLS_DATOS_DEFAULT.saifi,   colIdx('AJ'));
  assert.equal(COLS_DATOS_DEFAULT.saidi,   colIdx('AK'));
  assert.equal(COLS_DATOS_DEFAULT.dia,     colIdx('BB'));  // 53 · día
  assert.equal(COLS_DATOS_DEFAULT.zona,    colIdx('BG'));
  assert.equal(COLS_DATOS_DEFAULT.subest,  colIdx('AW'));  // 48 · NB_SUBESTACION
});

// ── mesDesdeValor ─────────────────────────────────────────────
test('mesDesdeValor interpreta Date nativo', () => {
  assert.equal(mesDesdeValor(new Date(2026, 0, 15)), 0);  // Ene
  assert.equal(mesDesdeValor(new Date(2026, 4, 1)), 4);   // May
});

test('mesDesdeValor interpreta dd/mm/yyyy', () => {
  assert.equal(mesDesdeValor('15/01/2026'), 0);
  assert.equal(mesDesdeValor('01/05/2026'), 4);
  assert.equal(mesDesdeValor('28-02-2026'), 1);
});

test('mesDesdeValor interpreta yyyy-mm-dd', () => {
  assert.equal(mesDesdeValor('2026-03-10'), 2);
  assert.equal(mesDesdeValor('2026/12/01'), 11);
});

test('mesDesdeValor interpreta mm/yyyy', () => {
  assert.equal(mesDesdeValor('04/2026'), 3);
});

test('mesDesdeValor interpreta nombres de mes en español', () => {
  assert.equal(mesDesdeValor('Enero'), 0);
  assert.equal(mesDesdeValor('mayo'), 4);
  assert.equal(mesDesdeValor('Dic'), 11);
  assert.equal(mesDesdeValor('septiembre'), 8);
});

test('mesDesdeValor interpreta serial Excel', () => {
  // 2026-01-15 ≈ serial 46037
  assert.equal(mesDesdeValor(46037), 0);
});

test('mesDesdeValor devuelve null ante basura', () => {
  assert.equal(mesDesdeValor(''), null);
  assert.equal(mesDesdeValor(null), null);
  assert.equal(mesDesdeValor('hola'), null);
  assert.equal(mesDesdeValor('99/99/9999'), null);
});

// ── detectarColumnaFecha ──────────────────────────────────────
test('detectarColumnaFecha encuentra la columna con más fechas', () => {
  const rows = [
    ['causa', 'fecha_evento', 'valor'],
    ['Sobrecarga', '15/01/2026', 1.2],
    ['Sobrecarga', '20/02/2026', 1.5],
    ['Racionamiento', '01/03/2026', 0.8],
  ];
  assert.equal(detectarColumnaFecha(rows), 1);
});

test('detectarColumnaFecha devuelve -1 si no hay columna de fecha', () => {
  const rows = [
    ['causa', 'valor'],
    ['Sobrecarga', 1.2],
    ['Racionamiento', 0.8],
  ];
  assert.equal(detectarColumnaFecha(rows), -1);
});

// ── agregarDatosCrudos ────────────────────────────────────────
// Construye filas con las columnas en su posición real (N=13, AJ=35,
// AK=36, BG=58) + una columna de fecha autodetectable en col 0.
function fila({ fecha, causa, saifi, saidi, zona }) {
  const r = new Array(59).fill('');
  r[0] = fecha;
  r[COLS_DATOS_DEFAULT.causa] = causa;
  r[COLS_DATOS_DEFAULT.saifi] = saifi;
  r[COLS_DATOS_DEFAULT.saidi] = saidi;
  r[COLS_DATOS_DEFAULT.zona]  = zona;
  return r;
}

function headerRow() {
  const r = new Array(59).fill('');
  r[0] = 'FECHA';
  r[COLS_DATOS_DEFAULT.causa] = 'CAUSA 2';
  r[COLS_DATOS_DEFAULT.saifi] = 'SAIFI_E';
  r[COLS_DATOS_DEFAULT.saidi] = 'SAIDI_E';
  r[COLS_DATOS_DEFAULT.zona]  = 'ZONA CONFIRMADA';
  return r;
}

test('agregarDatosCrudos suma SAIDI/SAIFI por mes×zona×causa', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'SOBRECARGA TRAFO SDL', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '20/01/2026', causa: 'SOBRECARGA TRAFO SDL', saifi: 0.2, saidi: 2.0, zona: 'BOLIVAR' }),
    fila({ fecha: '15/02/2026', causa: 'Racionamiento de Emergencia por Deficit STN', saifi: 0.5, saidi: 3.0, zona: 'ORIENTE' }),
  ];
  const { dataset, reporte } = agregarDatosCrudos(rows);

  assert.equal(reporte.procesadas, 3);
  assert.deepEqual(dataset.meses, ['Ene', 'Feb']);

  // BOLIVAR · Ene SAIDI = 1.0 + 2.0 = 3.0
  const bol = dataset.zonas.BOLIVAR;
  assert.equal(bol.cat_saidi['SOBRECARGA TRAFO SDL'][0], 3.0);
  assert.equal(bol.cat_saifi['SOBRECARGA TRAFO SDL'][0], 0.1 + 0.2);

  // TODAS agrega todas las zonas
  const todas = dataset.zonas.TODAS;
  assert.equal(todas.cat_saidi['SOBRECARGA TRAFO SDL'][0], 3.0);
  assert.equal(todas.cat_saidi['Racionamiento de Emergencia por Deficit STN'][1], 3.0);
});

test('agregarDatosCrudos clasifica causas canónicas en sus grupos', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'SOBRECARGA TRAFO SDL', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '10/01/2026', causa: 'Racionamiento Programado por Deficit STN', saifi: 0.2, saidi: 2.0, zona: 'BOLIVAR' }),
    fila({ fecha: '10/01/2026', causa: 'Deslastre por capacidad SDL', saifi: 0.3, saidi: 3.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  const g = dataset.zonas.TODAS.grp_saidi;
  assert.equal(g['Sobrecarga/Deslastre'][0], 1.0 + 3.0);  // SOBRECARGA + Deslastre
  assert.equal(g['Racionamiento/Deficit'][0], 2.0);
  assert.equal(g['Otras causas'][0], 0);  // ninguna de las 13 cae aquí
});

test('agregarDatosCrudos SOLO incluye las 13 causas del catálogo', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'Sobrecarga',            saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '11/01/2026', causa: 'Lluvias',               saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR' }),
    fila({ fecha: '12/01/2026', causa: 'Red de BT',             saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR' }),
    fila({ fecha: '13/01/2026', causa: 'Mantenimiento Trafo de Conexion al STN', saifi: 0.5, saidi: 5.0, zona: 'ORIENTE' }),
    fila({ fecha: '14/01/2026', causa: 'sobrecarga del str',    saifi: 0.2, saidi: 2.0, zona: 'ORIENTE' }),
  ];
  const { dataset, reporte } = agregarDatosCrudos(rows);
  assert.equal(reporte.procesadas, 2);        // Sobrecarga + sobrecarga del str
  assert.equal(reporte.descartadasFiltro, 3); // Lluvias, Red de BT, Mantenimiento
  assert.deepEqual(dataset.cats_order.sort(), ['Sobrecarga', 'sobrecarga del str']);
  assert.equal('Lluvias' in dataset.zonas.TODAS.cat_saidi, false);
});

test('agregarDatosCrudos descarta filas sin fecha o sin causa válida', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: 'basura',     causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '12/01/2026', causa: '',           saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
  ];
  const { reporte } = agregarDatosCrudos(rows);
  assert.equal(reporte.procesadas, 1);
  assert.equal(reporte.descartadasMes, 1);
  assert.equal(reporte.descartadasCausa, 1);
});

test('agregarDatosCrudos calcula proyección OLS por zona', () => {
  const rows = [headerRow()];
  // 5 meses de datos para que OLS tenga puntos
  for (let m = 1; m <= 5; m++) {
    rows.push(fila({ fecha: `10/0${m}/2026`, causa: 'Sobrecarga', saifi: 0.1 * m, saidi: 1.0 * m, zona: 'BOLIVAR' }));
  }
  const { dataset } = agregarDatosCrudos(rows);
  assert.ok(dataset.zonas.TODAS.proj, 'TODAS debe tener proyección');
  assert.equal(dataset.meses_full.length, 12);
  assert.equal(dataset.proj_global, dataset.zonas.TODAS.proj);
});

test('agregarDatosCrudos ordena cats_order por aporte SAIDI desc', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'Sobrecarga',          saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '10/01/2026', causa: 'SOBRECARGA TRAFO SDL', saifi: 0.1, saidi: 9.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  assert.equal(dataset.cats_order[0], 'SOBRECARGA TRAFO SDL');
  assert.equal(dataset.cats_order[1], 'Sobrecarga');
});

test('agregarDatosCrudos lanza si no hay registros válidos', () => {
  const rows = [
    headerRow(),
    fila({ fecha: 'x', causa: '', saifi: 0, saidi: 0, zona: '' }),
  ];
  assert.throws(() => agregarDatosCrudos(rows), /No se pudo detectar una columna de fecha|no produjo registros/);
});

// ── Filtros opcionales a nivel de fila (Part A) ───────────────
// Columnas de filtro extra: clas_creg@59 (BC), sui@60, area_macro@61
// (BD), min@62 (BE). Se activan vía override numérico en opts.
const OPTS_FILTROS = { clas_creg: 59, sui: 60, area_macro: 61, min: 62 };
function filaFiltro({ fecha, causa, saifi, saidi, zona, clas, sui, area, min }) {
  const r = fila({ fecha, causa, saifi, saidi, zona });
  r[59] = clas; r[60] = sui; r[61] = area; r[62] = min;
  return r;
}
// Valores que pasan TODOS los filtros.
const OK = { clas: 'NO PROGRAMADA NO EXCLUIDA', sui: 'SI', area: 'TRANSPORTE', min: 'INC' };

test('filtros de fila: solo entran eventos que cumplen los 4 filtros', () => {
  const rows = [
    headerRow(),
    filaFiltro({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR', ...OK }),
    // Falla SUI
    filaFiltro({ fecha: '11/01/2026', causa: 'Sobrecarga', saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR', ...OK, sui: 'NO' }),
    // Falla AREA_GESTION_MACRO
    filaFiltro({ fecha: '12/01/2026', causa: 'Sobrecarga', saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR', ...OK, area: 'DISTRIBUCION' }),
    // Falla MIN
    filaFiltro({ fecha: '13/01/2026', causa: 'Sobrecarga', saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR', ...OK, min: 'EXC' }),
    // Falla CLASIFICACION_CREG_063
    filaFiltro({ fecha: '14/01/2026', causa: 'Sobrecarga', saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR', ...OK, clas: 'PROGRAMADA EXCLUIDA' }),
    // PROGRAMADA NO EXCLUIDA sí pasa el filtro CREG
    filaFiltro({ fecha: '15/01/2026', causa: 'Sobrecarga', saifi: 0.2, saidi: 2.0, zona: 'BOLIVAR', ...OK, clas: 'PROGRAMADA NO EXCLUIDA' }),
  ];
  const { dataset, reporte } = agregarDatosCrudos(rows, OPTS_FILTROS);
  assert.equal(reporte.procesadas, 2);             // OK + PROGRAMADA NO EXCLUIDA
  assert.equal(reporte.descartadasFiltroFila, 4);  // SUI, AREA, MIN, CREG-excluida
  assert.equal(dataset.zonas.TODAS.cat_saidi['Sobrecarga'][0], 1.0 + 2.0);
});

test('filtros de fila: robustos a tildes, caja y espacios', () => {
  const rows = [
    headerRow(),
    filaFiltro({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR',
      clas: '  no programada no excluida ', sui: 'si', area: 'Transporte', min: ' inc ' }),
  ];
  const { reporte } = agregarDatosCrudos(rows, OPTS_FILTROS);
  assert.equal(reporte.procesadas, 1);
  assert.equal(reporte.descartadasFiltroFila, 0);
});

test('filtros de fila: INACTIVOS cuando las columnas no existen', () => {
  // Sin opts: las filas de 59 anchos no traen encabezados BC/BD/BE/SUI,
  // así que ningún filtro se activa y nada se descarta por ese motivo.
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '11/01/2026', causa: 'Sobrecarga', saifi: 0.2, saidi: 2.0, zona: 'ORIENTE' }),
  ];
  const { reporte } = agregarDatosCrudos(rows);
  assert.equal(reporte.procesadas, 2);
  assert.equal(reporte.descartadasFiltroFila, 0);
});

// ── Desglose programado / no-programado (Part C) ──────────────
test('prog: clasifica SAIDI/SAIFI en programado vs no_programado por CREG', () => {
  const rows = [
    headerRow(),
    filaFiltro({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR', ...OK, clas: 'NO PROGRAMADA NO EXCLUIDA' }),
    filaFiltro({ fecha: '20/01/2026', causa: 'Sobrecarga', saifi: 0.4, saidi: 4.0, zona: 'BOLIVAR', ...OK, clas: 'PROGRAMADA NO EXCLUIDA' }),
    filaFiltro({ fecha: '15/02/2026', causa: 'Sobrecarga', saifi: 0.2, saidi: 2.0, zona: 'ORIENTE', ...OK, clas: 'NO PROGRAMADA NO EXCLUIDA' }),
  ];
  const { dataset } = agregarDatosCrudos(rows, OPTS_FILTROS);
  const p = dataset.prog;
  // BOLIVAR Ene
  assert.equal(p.BOLIVAR.no_programado.saidi[0], 1.0);
  assert.equal(p.BOLIVAR.programado.saidi[0], 4.0);
  assert.equal(p.BOLIVAR.no_programado.saifi[0], 0.1);
  // TODAS agrega ambas zonas: Ene + Feb
  assert.equal(p.TODAS.no_programado.saidi[0], 1.0);  // Ene
  assert.equal(p.TODAS.no_programado.saidi[1], 2.0);  // Feb ORIENTE
  assert.equal(p.TODAS.programado.saidi[0], 4.0);
  // Series recortadas al rango [Ene..Feb] = 2 meses
  assert.equal(p.TODAS.no_programado.saidi.length, 2);
});

test('prog: existe con ceros aunque la columna CREG no resuelva', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  assert.ok(dataset.prog, 'dataset debe exponer prog');
  assert.equal(dataset.prog.TODAS.programado.saidi[0], 0);
  assert.equal(dataset.prog.TODAS.no_programado.saidi[0], 0);
});

// ── diaDesdeValor ─────────────────────────────────────────────
test('diaDesdeValor interpreta Date nativo', () => {
  assert.equal(diaDesdeValor(new Date(2026, 0, 15)), 15);
  assert.equal(diaDesdeValor(new Date(2026, 4, 1)), 1);
});

test('diaDesdeValor interpreta dd/mm/yyyy', () => {
  assert.equal(diaDesdeValor('15/01/2026'), 15);
  assert.equal(diaDesdeValor('01/05/2026'), 1);
  assert.equal(diaDesdeValor('28-02-2026'), 28);
});

test('diaDesdeValor interpreta yyyy-mm-dd', () => {
  assert.equal(diaDesdeValor('2026-03-10'), 10);
  assert.equal(diaDesdeValor('2026/12/31'), 31);
});

test('diaDesdeValor interpreta serial Excel', () => {
  assert.equal(diaDesdeValor(46037), 15);  // 2026-01-15
});

test('diaDesdeValor devuelve null ante basura', () => {
  assert.equal(diaDesdeValor(''), null);
  assert.equal(diaDesdeValor(null), null);
  assert.equal(diaDesdeValor('hola'), null);
  assert.equal(diaDesdeValor('04/2026'), null);  // mm/yyyy no trae día
});

// ── agregarDatosCrudos · detalle diario ───────────────────────
test('agregarDatosCrudos acumula detalle diario por zona×mes', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'SOBRECARGA TRAFO SDL', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '10/01/2026', causa: 'SOBRECARGA TRAFO SDL', saifi: 0.2, saidi: 2.0, zona: 'BOLIVAR' }),
    fila({ fecha: '20/01/2026', causa: 'SOBRECARGA TRAFO SDL', saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);

  assert.ok(dataset.dias, 'el dataset debe traer detalle diario');
  // mesIdx 0 = Enero. Día 10 (índice 9) = 1.0 + 2.0; día 20 (índice 19) = 5.0
  const bolEne = dataset.dias.BOLIVAR[0];
  assert.equal(bolEne.saidi[9], 3.0);
  assert.equal(bolEne.saidi[19], 5.0);
  assert.equal(bolEne.saifi[9], 0.1 + 0.2);
  // TODAS agrega
  assert.equal(dataset.dias.TODAS[0].saidi[9], 3.0);
});

test('agregarDatosCrudos expone mesesIdx paralelo a meses', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/02/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '10/04/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  // meses = Feb..Abr (recortado a [minMes..maxMes]) → idx 1,2,3
  assert.deepEqual(dataset.mesesIdx, [1, 2, 3]);
  assert.equal(dataset.meses.length, dataset.mesesIdx.length);
});

// ── mesDesdePeriodo / diaDesdeColumna ─────────────────────────
test('mesDesdePeriodo interpreta entero 1–12', () => {
  assert.equal(mesDesdePeriodo(1), 0);
  assert.equal(mesDesdePeriodo(5), 4);
  assert.equal(mesDesdePeriodo(12), 11);
});

test('mesDesdePeriodo interpreta "1".."12" como texto', () => {
  assert.equal(mesDesdePeriodo('1'), 0);
  assert.equal(mesDesdePeriodo('04'), 3);
  assert.equal(mesDesdePeriodo('12'), 11);
});

test('mesDesdePeriodo cae a mesDesdeValor para fechas y nombres', () => {
  assert.equal(mesDesdePeriodo('Marzo'), 2);
  assert.equal(mesDesdePeriodo('2026-05-10'), 4);
  assert.equal(mesDesdePeriodo(new Date(2026, 1, 1)), 1);
});

test('mesDesdePeriodo devuelve null ante basura o fuera de rango', () => {
  assert.equal(mesDesdePeriodo(''), null);
  assert.equal(mesDesdePeriodo(null), null);
  assert.equal(mesDesdePeriodo(0), null);
  assert.equal(mesDesdePeriodo(13), null);
});

test('diaDesdeColumna interpreta entero 1–31 y texto', () => {
  assert.equal(diaDesdeColumna(1), 1);
  assert.equal(diaDesdeColumna(28), 28);
  assert.equal(diaDesdeColumna('15'), 15);
  assert.equal(diaDesdeColumna(31), 31);
});

test('diaDesdeColumna cae a diaDesdeValor para fechas completas', () => {
  assert.equal(diaDesdeColumna('10/01/2026'), 10);
  assert.equal(diaDesdeColumna(new Date(2026, 0, 22)), 22);
});

test('diaDesdeColumna devuelve null ante basura o fuera de rango', () => {
  assert.equal(diaDesdeColumna(''), null);
  assert.equal(diaDesdeColumna(0), null);
  assert.equal(diaDesdeColumna(32), null);
  assert.equal(diaDesdeColumna('hola'), null);
});

// ── agregarDatosCrudos · columnas PERIODO (AC) + DIA (BB) ──────
// La hoja DATOS real parte la fecha en PERIODO (mes) y DIA (día). Sin
// columna de fecha única. filaPD las puebla y deja fecha vacía en col 0.
function filaPD({ periodo, dia, causa, saifi, saidi, zona }) {
  const r = new Array(59).fill('');
  r[COLS_DATOS_DEFAULT.periodo] = periodo;
  r[COLS_DATOS_DEFAULT.dia]     = dia;
  r[COLS_DATOS_DEFAULT.causa]   = causa;
  r[COLS_DATOS_DEFAULT.saifi]   = saifi;
  r[COLS_DATOS_DEFAULT.saidi]   = saidi;
  r[COLS_DATOS_DEFAULT.zona]    = zona;
  return r;
}

test('agregarDatosCrudos lee mes de PERIODO y día de DIA (sin fecha única)', () => {
  const rows = [
    headerRow(),
    filaPD({ periodo: 1,  dia: 10, causa: 'SOBRECARGA TRAFO SDL', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    filaPD({ periodo: 1,  dia: 10, causa: 'SOBRECARGA TRAFO SDL', saifi: 0.2, saidi: 2.0, zona: 'BOLIVAR' }),
    filaPD({ periodo: 1,  dia: 20, causa: 'SOBRECARGA TRAFO SDL', saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR' }),
    filaPD({ periodo: 2,  dia: 5,  causa: 'Racionamiento de Emergencia por Deficit STN', saifi: 0.3, saidi: 3.0, zona: 'ORIENTE' }),
  ];
  const { dataset, reporte } = agregarDatosCrudos(rows);

  assert.equal(reporte.procesadas, 4);
  assert.deepEqual(dataset.meses, ['Ene', 'Feb']);

  // Mes desde PERIODO: Ene SAIDI BOLIVAR = 1+2+5 = 8
  assert.equal(dataset.zonas.BOLIVAR.cat_saidi['SOBRECARGA TRAFO SDL'][0], 8.0);

  // Día desde DIA: día 10 (idx 9) = 1+2=3, día 20 (idx 19) = 5
  const bolEne = dataset.dias.BOLIVAR[0];
  assert.equal(bolEne.saidi[9], 3.0);
  assert.equal(bolEne.saidi[19], 5.0);
  assert.equal(bolEne.saifi[9], 0.1 + 0.2);
});

test('agregarDatosCrudos acepta PERIODO por nombre de mes', () => {
  const rows = [
    headerRow(),
    filaPD({ periodo: 'Marzo', dia: 3, causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  assert.deepEqual(dataset.mesesIdx, [2]);  // Marzo
  assert.equal(dataset.dias.BOLIVAR[2].saidi[2], 1.0);  // día 3 → idx 2
});

test('agregarDatosCrudos sigue funcionando con fecha única (retrocompat)', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  assert.deepEqual(dataset.meses, ['Ene']);
  assert.equal(dataset.dias.BOLIVAR[0].saidi[9], 1.0);  // día 10 → idx 9
});

// ── agregarDatosCrudos · subestaciones (NB_SUBESTACION · AW) ───
function filaSub({ periodo, causa, saifi, saidi, zona, subest }) {
  const r = new Array(59).fill('');
  r[COLS_DATOS_DEFAULT.periodo] = periodo;
  r[COLS_DATOS_DEFAULT.causa]   = causa;
  r[COLS_DATOS_DEFAULT.saifi]   = saifi;
  r[COLS_DATOS_DEFAULT.saidi]   = saidi;
  r[COLS_DATOS_DEFAULT.zona]    = zona;
  r[COLS_DATOS_DEFAULT.subest]  = subest;
  return r;
}

test('agregarDatosCrudos acumula aporte por subestación (zona×mes)', () => {
  const rows = [
    headerRow(),
    filaSub({ periodo: 1, causa: 'SOBRECARGA TRAFO SDL', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR', subest: 'SE Cartagena' }),
    filaSub({ periodo: 1, causa: 'SOBRECARGA TRAFO SDL', saifi: 0.2, saidi: 2.0, zona: 'BOLIVAR', subest: 'SE Cartagena' }),
    filaSub({ periodo: 2, causa: 'SOBRECARGA TRAFO SDL', saifi: 0.5, saidi: 5.0, zona: 'BOLIVAR', subest: 'SE Mamonal' }),
  ];
  const { dataset, reporte } = agregarDatosCrudos(rows);

  assert.ok(dataset.subests, 'el dataset debe traer subests');
  // Agregado en TODAS + en la zona
  assert.equal(dataset.subests.TODAS['SE Cartagena'].saidi[0], 3.0);   // Ene = 1+2
  assert.equal(dataset.subests.BOLIVAR['SE Cartagena'].saidi[0], 3.0);
  assert.equal(dataset.subests.BOLIVAR['SE Cartagena'].saifi[0], 0.1 + 0.2);
  assert.equal(dataset.subests.BOLIVAR['SE Mamonal'].saidi[1], 5.0);   // Feb
  // El reporte cuenta subestaciones distintas
  assert.equal(reporte.subestaciones, 2);
});

test('agregarDatosCrudos ignora filas sin NB_SUBESTACION para subests', () => {
  const rows = [
    headerRow(),
    filaSub({ periodo: 1, causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR', subest: '' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  assert.deepEqual(Object.keys(dataset.subests.TODAS), []);
});

test('detectarColumnaPorHeader encuentra NB_SUBESTACION por nombre', () => {
  const header = new Array(10).fill('');
  header[4] = 'NB_SUBESTACION';
  const rows = [header, new Array(10).fill('x')];
  assert.equal(detectarColumnaPorHeader(rows, /nb[_ ]?subest/), 4);
});

test('detectarColumnaPorHeader es tolerante a tildes/espacios/case', () => {
  const header = new Array(6).fill('');
  header[2] = 'Nb Subestación';
  assert.equal(detectarColumnaPorHeader([header], /nb[_ ]?subest/), 2);
  assert.equal(detectarColumnaPorHeader([['a', 'b']], /nb[_ ]?subest/), -1);
});

test('agregarDatosCrudos detecta NB_SUBESTACION fuera de AW por encabezado', () => {
  // Subestación en columna 5 (no AW=48) y header NB_SUBESTACION ahí.
  const header = new Array(59).fill('');
  header[5] = 'NB_SUBESTACION';
  const mkRow = (sub) => {
    const r = new Array(59).fill('');
    r[COLS_DATOS_DEFAULT.periodo] = 1;
    r[COLS_DATOS_DEFAULT.causa]   = 'SOBRECARGA TRAFO SDL';
    r[COLS_DATOS_DEFAULT.saifi]   = 0.1;
    r[COLS_DATOS_DEFAULT.saidi]   = 2.0;
    r[COLS_DATOS_DEFAULT.zona]    = 'BOLIVAR';
    r[5] = sub;
    return r;
  };
  const { dataset } = agregarDatosCrudos([header, mkRow('SE Turbaco')]);
  assert.equal(dataset.subests.BOLIVAR['SE Turbaco'].saidi[0], 2.0);
});

test('filtrarCausasCanonicas preserva subests', () => {
  const rows = [
    headerRow(),
    filaSub({ periodo: 1, causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR', subest: 'SE X' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  const filtrado = filtrarCausasCanonicas(dataset);
  assert.ok(filtrado.subests, 'subests debe sobrevivir al chokepoint');
  assert.equal(filtrado.subests.BOLIVAR['SE X'].saidi[0], 1.0);
});

test('filtrarCausasCanonicas preserva dias y mesesIdx', () => {
  const rows = [
    headerRow(),
    fila({ fecha: '10/01/2026', causa: 'Sobrecarga', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  const filtrado = filtrarCausasCanonicas(dataset);
  assert.ok(filtrado.dias, 'dias debe sobrevivir al chokepoint');
  assert.ok(Array.isArray(filtrado.mesesIdx), 'mesesIdx debe sobrevivir');
});

test('agregarDatosCrudos lanza ante hoja vacía', () => {
  assert.throws(() => agregarDatosCrudos([]), /vacía o sin registros/);
  assert.throws(() => agregarDatosCrudos([headerRow()]), /No se pudo detectar|no produjo registros/);
});

test('MESES_CANON tiene 12 meses en orden', () => {
  assert.equal(MESES_CANON.length, 12);
  assert.equal(MESES_CANON[0], 'Ene');
  assert.equal(MESES_CANON[11], 'Dic');
});

// ── filtrarCausasCanonicas ────────────────────────────────────
// Construye un dataset ya agregado con causas canónicas Y no canónicas
// mezcladas en cada zona, simulando un baseline / cache / pre-agregado
// que llegó SIN filtrar. El chokepoint store.setDataset lo limpia.
function datasetMixto() {
  const zona = () => ({
    total_saidi: [0, 0], total_saifi: [0, 0],
    grp_saidi: {}, grp_saifi: {},
    cat_saidi: {
      'Sobrecarga':          [3, 4],   // canónica
      'SOBRECARGA TRAFO SDL': [10, 2],  // canónica
      'Ramajeo':             [99, 99], // NO canónica → debe desaparecer
      'AVISO DE PELIGRO':    [50, 50], // NO canónica → debe desaparecer
    },
    cat_saifi: {
      'Sobrecarga':          [0.3, 0.4],
      'SOBRECARGA TRAFO SDL': [0.1, 0.1],
      'Ramajeo':             [9, 9],
    },
    proj: null,
  });
  return {
    meses: ['Ene', 'Feb'],
    meses_full: MESES_CANON.slice(),
    zonas: { TODAS: zona(), BOLIVAR: zona(), OCCIDENTE: zona(), ORIENTE: zona() },
    cats_order: ['Ramajeo', 'AVISO DE PELIGRO', 'SOBRECARGA TRAFO SDL', 'Sobrecarga'],
    proj_global: null,
  };
}

test('filtrarCausasCanonicas elimina causas fuera del catálogo de 13', () => {
  const out = filtrarCausasCanonicas(datasetMixto());
  const cats = Object.keys(out.zonas.TODAS.cat_saidi);
  assert.ok(cats.includes('Sobrecarga'));
  assert.ok(cats.includes('SOBRECARGA TRAFO SDL'));
  assert.ok(!cats.includes('Ramajeo'));
  assert.ok(!cats.includes('AVISO DE PELIGRO'));
  // cats_order no debe contener causas no canónicas
  assert.ok(!out.cats_order.includes('Ramajeo'));
  assert.ok(!out.cats_order.includes('AVISO DE PELIGRO'));
});

test('filtrarCausasCanonicas re-deriva grupos y totales desde cats filtradas', () => {
  const out = filtrarCausasCanonicas(datasetMixto());
  const z = out.zonas.TODAS;
  // Sobrecarga(3,4) + SOBRECARGA TRAFO SDL(10,2) = (13, 6) en el grupo rojo
  assert.deepEqual(z.grp_saidi['Sobrecarga/Deslastre'], [13, 6]);
  // total = solo causas canónicas, sin Ramajeo(99,99) ni AVISO(50,50)
  assert.deepEqual(z.total_saidi, [13, 6]);
});

test('filtrarCausasCanonicas ordena cats_order por aporte SAIDI desc', () => {
  const out = filtrarCausasCanonicas(datasetMixto());
  // SOBRECARGA TRAFO SDL=12 > Sobrecarga=7
  assert.equal(out.cats_order[0], 'SOBRECARGA TRAFO SDL');
  assert.equal(out.cats_order[1], 'Sobrecarga');
});

test('filtrarCausasCanonicas es idempotente', () => {
  const once = filtrarCausasCanonicas(datasetMixto());
  const twice = filtrarCausasCanonicas(once);
  assert.deepEqual(twice.cats_order, once.cats_order);
  assert.deepEqual(twice.zonas.TODAS.cat_saidi, once.zonas.TODAS.cat_saidi);
});

test('filtrarCausasCanonicas tolera dataset nulo o sin zonas', () => {
  assert.equal(filtrarCausasCanonicas(null), null);
  const sinZonas = { meses: [], zonas: null };
  assert.equal(filtrarCausasCanonicas(sinZonas), sinZonas);
});

// ── filtrarPorCausa2 ──────────────────────────────────────────
// Dataset ya canónico: mezcla causas de sobrecarga/deslastre con una de
// Racionamiento, más prog/subests/dias para verificar que sobreviven al
// filtro (son a nivel de fila, no por categoría).
function datasetCausa2() {
  const zona = () => ({
    total_saidi: [], total_saifi: [],
    grp_saidi: {}, grp_saifi: {},
    cat_saidi: {
      'Sobrecarga':                          [3, 4],   // sobrecarga
      'SOBRECARGA TRAFO SDL':                [10, 2],  // sobrecarga
      'Racionamiento Programado por Deficit STN': [5, 5], // NO sobrecarga
    },
    cat_saifi: {
      'Sobrecarga':                          [0.3, 0.4],
      'SOBRECARGA TRAFO SDL':                [0.1, 0.1],
      'Racionamiento Programado por Deficit STN': [0.5, 0.5],
    },
    proj: null,
  });
  return {
    meses: ['Ene', 'Feb'],
    meses_full: MESES_CANON.slice(),
    mesesIdx: [0, 1],
    zonas: { TODAS: zona(), BOLIVAR: zona(), OCCIDENTE: zona(), ORIENTE: zona() },
    cats_order: ['SOBRECARGA TRAFO SDL', 'Racionamiento Programado por Deficit STN', 'Sobrecarga'],
    dias: { TODAS: { 0: { saidi: [1], saifi: [1] } } },
    subests: { TODAS: { 'SE-1': { saidi: [9, 9], saifi: [1, 1] } } },
    prog: { TODAS: { programado: { saidi: [2, 2], saifi: [1, 1] }, no_programado: { saidi: [3, 3], saifi: [1, 1] } } },
    proj_global: null,
  };
}

test('filtrarPorCausa2 con TODAS devuelve el dataset sin tocar', () => {
  const ds = datasetCausa2();
  assert.equal(filtrarPorCausa2(ds, CAUSA2_TODAS), ds);
  assert.equal(filtrarPorCausa2(ds, ''), ds);
  assert.equal(filtrarPorCausa2(ds, null), ds);
});

test('filtrarPorCausa2 SOBRECARGA conserva solo las causas de sobrecarga', () => {
  const out = filtrarPorCausa2(datasetCausa2(), CAUSA2_SOBRECARGA);
  const cats = Object.keys(out.zonas.TODAS.cat_saidi);
  assert.ok(cats.includes('Sobrecarga'));
  assert.ok(cats.includes('SOBRECARGA TRAFO SDL'));
  assert.ok(!cats.includes('Racionamiento Programado por Deficit STN'));
  // total re-derivado = Sobrecarga(3,4)+SOBRECARGA TRAFO SDL(10,2) = (13,6)
  assert.deepEqual(out.zonas.TODAS.total_saidi, [13, 6]);
  assert.deepEqual(out.zonas.TODAS.grp_saidi['Sobrecarga/Deslastre'], [13, 6]);
  // El grupo Racionamiento queda en ceros
  assert.deepEqual(out.zonas.TODAS.grp_saidi['Racionamiento/Deficit'], [0, 0]);
});

test('filtrarPorCausa2 con causa única conserva solo esa causa', () => {
  const out = filtrarPorCausa2(datasetCausa2(), 'Sobrecarga');
  const cats = Object.keys(out.zonas.TODAS.cat_saidi);
  assert.deepEqual(cats, ['Sobrecarga']);
  assert.deepEqual(out.zonas.TODAS.total_saidi, [3, 4]);
  assert.deepEqual(out.cats_order, ['Sobrecarga']);
});

test('filtrarPorCausa2 preserva prog / subests / dias (datos de fila) vía spread', () => {
  const ds = datasetCausa2();
  const out = filtrarPorCausa2(ds, CAUSA2_SOBRECARGA);
  assert.deepEqual(out.prog, ds.prog);
  assert.deepEqual(out.subests, ds.subests);
  assert.deepEqual(out.dias, ds.dias);
  assert.deepEqual(out.mesesIdx, ds.mesesIdx);
});
