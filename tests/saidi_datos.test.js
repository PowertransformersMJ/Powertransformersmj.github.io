// node --test tests/saidi_datos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colIdx, mesDesdeValor, detectarColumnaFecha, agregarDatosCrudos,
  COLS_DATOS_DEFAULT, MESES_CANON,
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
  assert.equal(COLS_DATOS_DEFAULT.causa, colIdx('N'));
  assert.equal(COLS_DATOS_DEFAULT.saifi, colIdx('AJ'));
  assert.equal(COLS_DATOS_DEFAULT.saidi, colIdx('AK'));
  assert.equal(COLS_DATOS_DEFAULT.zona,  colIdx('BG'));
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
    fila({ fecha: '10/01/2026', causa: 'Causa chica', saifi: 0.1, saidi: 1.0, zona: 'BOLIVAR' }),
    fila({ fecha: '10/01/2026', causa: 'Causa grande', saifi: 0.1, saidi: 9.0, zona: 'BOLIVAR' }),
  ];
  const { dataset } = agregarDatosCrudos(rows);
  assert.equal(dataset.cats_order[0], 'Causa grande');
  assert.equal(dataset.cats_order[1], 'Causa chica');
});

test('agregarDatosCrudos lanza si no hay registros válidos', () => {
  const rows = [
    headerRow(),
    fila({ fecha: 'x', causa: '', saifi: 0, saidi: 0, zona: '' }),
  ];
  assert.throws(() => agregarDatosCrudos(rows), /No se pudo detectar una columna de fecha|no produjo registros/);
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
