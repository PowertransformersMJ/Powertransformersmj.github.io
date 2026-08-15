import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADOS, mapearColumnas, normalizarEncabezado, normalizarCodigoUC,
  evaluarFila, evaluarListado, resumir, ordenarPorGravedad, filasParaExportar
} from '../assets/js/domain/fichas_evaluacion_uucc.js';

/* Encabezados tal como salen de las exportaciones del parque, con la errata
   «TERCEARIO» incluida a propósito: viene así en la fuente oficial. */
const CAB = ['SUBESTACION', 'MATRICULA', 'SERIE', 'POTENCIA (KVA)',
  'NIVEL DE TENSION PRIMARIO (KV)', 'NIVEL DE TENSION SECUNDARIO (KV)',
  'NIVEL DE TENSION TERCEARIO (KV)', 'REGULACION', 'UUCC', 'ZONA', 'DEPARTAMENTO'];

const fila = (sub, mat, kva, kvp, kvt, reg, uucc) =>
  [sub, mat, 'S-0001', kva, kvp, '13.8', kvt, reg, uucc, 'ZONA 1', 'DEPARTAMENTO 1'];

test('normalizarEncabezado quita tildes, signos y espacios sobrantes', () => {
  assert.equal(normalizarEncabezado('  Nivel de Tensión  Primario (kV) '), 'NIVEL DE TENSION PRIMARIO KV');
  assert.equal(normalizarEncabezado(null), '');
});

test('normalizarCodigoUC tolera guiones, espacios y minúsculas', () => {
  assert.equal(normalizarCodigoUC('n4-t4'), 'N4T4');
  assert.equal(normalizarCodigoUC(' N4 T4 '), 'N4T4');
  assert.equal(normalizarCodigoUC(''), null);
});

test('mapearColumnas reconoce los encabezados reales, errata incluida', () => {
  const { mapa, faltantes } = mapearColumnas(CAB);
  assert.equal(faltantes.length, 0);
  assert.equal(mapa.subestacion, 0);
  assert.equal(mapa.potenciaKva, 3);
  assert.equal(mapa.kvPrim, 4);
  assert.equal(mapa.kvTerc, 6, 'debe reconocer TERCEARIO (errata de la fuente)');
  assert.equal(mapa.uucc, 8);
});

test('mapearColumnas denuncia las columnas imprescindibles que faltan', () => {
  const { faltantes } = mapearColumnas(['SUBESTACION', 'MATRICULA', 'UUCC']);
  assert.ok(faltantes.includes('POTENCIA (KVA)'));
  assert.ok(faltantes.includes('NIVEL DE TENSION PRIMARIO (KV)'));
});

test('no confunde POTENCIA (KVA) con otra columna que empiece igual', () => {
  const { mapa } = mapearColumnas(['POTENCIA APARENTE', 'POTENCIA (KVA)', 'NIVEL DE TENSION PRIMARIO (KV)']);
  assert.equal(mapa.potenciaKva, 1);
});

test('CONCORDANTE cuando la UUCC registrada coincide con la calculada', () => {
  const { mapa } = mapearColumnas(CAB);
  const r = evaluarFila(fila('SUBESTACION A', 'TX-A-01', 20000, 66, 'N/A', 'OLTC', 'N4T4'), mapa);
  assert.equal(r.uuccCalculada, 'N4T4');
  assert.equal(r.estado, ESTADOS.CONCORDANTE);
  assert.ok(r.pasos.length > 0, 'debe dejar la traza del cálculo');
});

test('DISCREPANCIA nombra ambas bandas para que la decisión sea informada', () => {
  const { mapa } = mapearColumnas(CAB);
  const r = evaluarFila(fila('SUBESTACION B', 'TX-B-01', 20000, 66, 'N/A', 'OLTC', 'N4T2'), mapa);
  assert.equal(r.estado, ESTADOS.DISCREPANCIA);
  assert.match(r.motivo, /N4T2/);
  assert.match(r.motivo, /N4T4/);
});

test('FALTA REGISTRO cuando no hay UUCC pero sí se puede calcular', () => {
  const { mapa } = mapearColumnas(CAB);
  const r = evaluarFila(fila('SUBESTACION C', 'TX-C-01', 10000, 34.5, 'N/A', 'NLTC', ''), mapa);
  assert.equal(r.estado, ESTADOS.FALTA_REGISTRO);
  assert.ok(r.uuccCalculada, 'debe proponer la que corresponde por placa');
});

test('SIN CALCULO cuando falta la tensión primaria — no se inventa un código', () => {
  const { mapa } = mapearColumnas(CAB);
  const r = evaluarFila(fila('SUBESTACION D', 'TX-D-01', 12500, '', 'N/A', 'OLTC', 'N3T4'), mapa);
  assert.equal(r.estado, ESTADOS.SIN_CALCULO);
  assert.equal(r.uuccCalculada, null);
  assert.ok(r.motivo.length > 0);
});

test('la comparación tolera formato: «n4-t4» registrada equivale a N4T4', () => {
  const { mapa } = mapearColumnas(CAB);
  const r = evaluarFila(fila('SUBESTACION E', 'TX-E-01', 20000, 66, 'N/A', 'OLTC', 'n4-t4'), mapa);
  assert.equal(r.estado, ESTADOS.CONCORDANTE);
});

test('un terciario con dato lleva el equipo a tridevanado', () => {
  const { mapa } = mapearColumnas(CAB);
  const bi  = evaluarFila(fila('SUBESTACION F', 'TX-F-01', 30000, 110, 'N/A', 'OLTC', ''), mapa);
  const tri = evaluarFila(fila('SUBESTACION F', 'TX-F-02', 30000, 110, 13.8, 'OLTC', ''), mapa);
  assert.equal(bi.devanado, 'bi');
  assert.equal(tri.devanado, 'tri');
});

test('evaluarListado numera las filas como Excel y descarta las vacías', () => {
  const m = [CAB,
    fila('SUBESTACION A', 'TX-A-01', 20000, 66, 'N/A', 'OLTC', 'N4T4'),
    [], ['', '', '', '', '', '', '', '', '', '', ''],
    fila('SUBESTACION B', 'TX-B-01', 20000, 66, 'N/A', 'OLTC', 'N4T2')];
  const r = evaluarListado(m);
  assert.equal(r.filas.length, 2);
  assert.equal(r.descartadas, 2);
  assert.equal(r.filas[0].fila, 2, 'la primera fila de datos es la 2 en Excel');
  assert.equal(r.filas[1].fila, 5);
});

test('evaluarListado sobre archivo vacío no revienta', () => {
  const r = evaluarListado([]);
  assert.equal(r.filas.length, 0);
  assert.equal(r.resumen.total, 0);
  assert.equal(r.resumen.conformidad, 0);
});

test('la conformidad excluye a los no evaluables — no castiga un vacío de placa', () => {
  const r = resumir([
    { estado: ESTADOS.CONCORDANTE }, { estado: ESTADOS.CONCORDANTE },
    { estado: ESTADOS.DISCREPANCIA }, { estado: ESTADOS.SIN_CALCULO }
  ]);
  assert.equal(r.total, 4);
  assert.equal(r.evaluables, 3);
  // 2 de 3 evaluables = 66,7 %; sobre el total serían 50 % y sería injusto.
  assert.equal(r.conformidad, 66.7);
  assert.equal(r.pctConcordantes, 50);
});

test('ordenarPorGravedad pone primero lo que exige decisión', () => {
  const orden = ordenarPorGravedad([
    { estado: ESTADOS.CONCORDANTE, subestacion: 'A' },
    { estado: ESTADOS.SIN_CALCULO, subestacion: 'B' },
    { estado: ESTADOS.DISCREPANCIA, subestacion: 'C' },
    { estado: ESTADOS.FALTA_REGISTRO, subestacion: 'D' }
  ]).map((x) => x.estado);
  assert.deepEqual(orden, [
    ESTADOS.DISCREPANCIA, ESTADOS.FALTA_REGISTRO, ESTADOS.SIN_CALCULO, ESTADOS.CONCORDANTE
  ]);
});

test('la exportación lleva la traza del cálculo, no solo el veredicto', () => {
  const { mapa } = mapearColumnas(CAB);
  const ev = evaluarFila(fila('SUBESTACION A', 'TX-A-01', 20000, 66, 'N/A', 'OLTC', 'N4T2'), mapa);
  const [cab, primera] = filasParaExportar([ev]);
  assert.ok(cab.includes('Traza del cálculo'));
  assert.equal(cab.length, primera.length);
  assert.match(String(primera[primera.length - 2]), /MVA/);
});

/* ── El listado como fuente de datos de toda la página ──────────────────── */

import { equiposDesdeListado, mapearEnsayos, ensayosReconocidos }
  from '../assets/js/domain/fichas_evaluacion_uucc.js';

const CAB_FULL = [...CAB, 'FURANOS', 'EVALUACION FURANOS', 'H2', 'CH4', 'C2H4', 'C2H2',
  'CO', 'CO2', 'RIGIDEZ DIELECTRICA', 'CONTENIDO HUMEDAD', 'CARGABILIDAD',
  'EDAD', 'AÑO DE FABRICACION', 'CANTIDAD DE USUARIOS', 'CONDICION', 'MUNICIPIO'];

const filaFull = (sub, uucc, extra) =>
  [...fila(sub, 'TX-01', 20000, 66, 'N/A', 'OLTC', uucc), ...extra];

test('mapearEnsayos reconoce las columnas de ensayo del parque', () => {
  const m = mapearEnsayos(CAB_FULL);
  assert.equal(m.fur, CAB.length);
  assert.ok(m.h2 !== undefined && m.co2 !== undefined && m.crg !== undefined);
  assert.ok(ensayosReconocidos(CAB_FULL).length >= 12);
});

test('equiposDesdeListado entrega equipos con placa, veredicto y ensayos', () => {
  const m = [CAB_FULL,
    filaFull('SUBESTACIÓN A', 'N4T4', [5779, 5, 378, 2580, 3882, 57, 1872, 10818, 27, 19, 98, 43, 1982, 3816, 5, 'MUNICIPIO A'])];
  const { equipos, evaluacion } = equiposDesdeListado(m);
  assert.equal(equipos.length, 1);
  const e = equipos[0];
  assert.equal(e.subestacion, 'SUBESTACIÓN A');
  assert.equal(e.potencia_kva, 20000);
  assert.equal(e.kv_prim, 66);
  assert.equal(e.uucc_registrada, 'N4T4');
  assert.equal(e.estado_uucc, ESTADOS.CONCORDANTE);
  assert.equal(e.det.fur2fal, 5779, 'los furanos deben viajar al bloque de diagnóstico');
  assert.equal(e.det.c2h2, 57);
  assert.equal(e.cond_int, 5);
  assert.equal(e.usuarios, 3816);
  assert.equal(e.municipio, 'MUNICIPIO A');
  // La evaluación viene de un solo recorrido, no de dos.
  assert.equal(evaluacion.filas.length, 1);
});

test('lo que el archivo no trae se queda en null, no en cero', () => {
  const { equipos } = equiposDesdeListado([CAB,
    fila('SUBESTACIÓN B', 'TX-02', 10000, 34.5, 'N/A', 'NLTC', 'N3T3')]);
  const e = equipos[0];
  assert.equal(e.det.fur2fal, null, 'sin columna de furanos NO se asume 0');
  assert.equal(e.cond_int, null);
  assert.equal(e.usuarios, null);
  assert.equal(e.estado_uucc, ESTADOS.CONCORDANTE, 'la UUCC sí se evalúa igual');
});

test('el veredicto viaja resuelto para que tablero e informe no discrepen', () => {
  const { equipos, evaluacion } = equiposDesdeListado([CAB,
    fila('SUBESTACIÓN C', 'TX-03', 20000, 66, 'N/A', 'OLTC', 'N4T2')]);
  assert.equal(equipos[0].estado_uucc, evaluacion.filas[0].estado);
  assert.equal(equipos[0].uucc_calculada, evaluacion.filas[0].uuccCalculada);
});
