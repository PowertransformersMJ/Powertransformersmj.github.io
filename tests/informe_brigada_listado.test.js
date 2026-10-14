// Informe de Mantenimiento Brigada · listado del parque (dominio puro).
// Datos INVENTADOS: ninguna matrícula, serie ni subestación real.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  plano, condicionDe, mvaDe, contarInformesPorMatricula, etiquetaEstado,
  filtrarEquipos, ordenarEquipos, opcionesFiltro, posibleParqueIncompleto, matriculaDeInforme
} from '../assets/js/domain/informe_brigada_listado.js';

const PARQUE = Object.freeze([
  { transformador_id: 'tx-a', matricula: 'T9-Z/Z-PRU', subestacion: 'Prueba Norte', zona: 'OCCIDENTE', departamento: 'CÓRDOBA', municipio: 'Pueblo Uno', serie: 'SERIE-PRUEBA-001', potencia_kva: 14000, salud: { numero: 2 } },
  { transformador_id: 'tx-b', matricula: 'T8-Y/Y-PRU', subestacion: 'Ensayo Sur', zona: 'ORIENTE', departamento: 'CESAR', municipio: 'Villa Ensayo', serie: 'SERIE-PRUEBA-002', potencia_kva: 25000, salud: { numero: 4 } },
  { transformador_id: 'tx-c', matricula: 'T7-X/X-PRU', subestacion: 'Ángel de Prueba', zona: 'ORIENTE', departamento: 'MAGDALENA', municipio: '', serie: '', potencia_kva: null, salud: { numero: null } },
  { transformador_id: 'tx-d', matricula: 'T6-W/W-PRU', subestacion: 'Prueba Norte', zona: 'OCCIDENTE', departamento: 'cordoba', municipio: 'Pueblo Dos', serie: 'SERIE-PRUEBA-004', potencia_kva: 6250, condicion: 5 }
]);

describe('plano / condición / MVA', () => {
  test('plano quita tildes, mayúsculas y espacios de sobra', () => {
    assert.equal(plano('  Ángel   de  PRUEBA '), 'angel de prueba');
    assert.equal(plano(null), '');
  });
  test('condicionDe: salud.numero o condicion; fuera de 1..5 o vacío = null (vacío no es cero, L-104)', () => {
    assert.equal(condicionDe(PARQUE[0]), 2);
    assert.equal(condicionDe(PARQUE[2]), null);
    assert.equal(condicionDe(PARQUE[3]), 5);
    assert.equal(condicionDe({ salud: { numero: 0 } }), null);
    assert.equal(condicionDe({ salud: { numero: '' } }), null);
    assert.equal(condicionDe({ condicion: 2.4 }), null);
  });
  test('mvaDe convierte kVA → MVA y deja null el vacío', () => {
    assert.equal(mvaDe(PARQUE[0]), 14);
    assert.equal(mvaDe(PARQUE[2]), null);
    assert.equal(mvaDe({ potencia_kva: '' }), null);
    assert.equal(mvaDe({ mva: 2.5 }), 2.5);
  });
});

describe('búsqueda y filtros', () => {
  test('busca sin tildes ni mayúsculas, en varios campos y con varias palabras', () => {
    assert.deepEqual(filtrarEquipos(PARQUE, { texto: 'angel' }).map((e) => e.transformador_id), ['tx-c']);
    assert.deepEqual(filtrarEquipos(PARQUE, { texto: 'PRUEBA norte' }).map((e) => e.transformador_id), ['tx-a', 'tx-d']);
    assert.deepEqual(filtrarEquipos(PARQUE, { texto: 'serie-prueba-002' }).map((e) => e.transformador_id), ['tx-b']);
    assert.deepEqual(filtrarEquipos(PARQUE, { texto: 'pueblo dos' }).map((e) => e.transformador_id), ['tx-d']);
    assert.deepEqual(filtrarEquipos(PARQUE, { texto: 't8-y/y' }).map((e) => e.transformador_id), ['tx-b']);
    assert.equal(filtrarEquipos(PARQUE, { texto: 'no-existe' }).length, 0);
  });
  test('zona y departamento se comparan sin tildes ni mayúsculas', () => {
    assert.deepEqual(filtrarEquipos(PARQUE, { departamento: 'Córdoba' }).map((e) => e.transformador_id), ['tx-a', 'tx-d']);
    assert.deepEqual(filtrarEquipos(PARQUE, { zona: 'oriente' }).map((e) => e.transformador_id), ['tx-b', 'tx-c']);
  });
  test('condición: número o «sd» (sin dato)', () => {
    assert.deepEqual(filtrarEquipos(PARQUE, { condicion: '4' }).map((e) => e.transformador_id), ['tx-b']);
    assert.deepEqual(filtrarEquipos(PARQUE, { condicion: 'sd' }).map((e) => e.transformador_id), ['tx-c']);
  });
  test('sin filtros devuelve todo; entrada rara no revienta', () => {
    assert.equal(filtrarEquipos(PARQUE).length, 4);
    assert.deepEqual(filtrarEquipos(null), []);
    assert.deepEqual(filtrarEquipos([null, undefined]), []);
  });
});

describe('orden', () => {
  test('por defecto: subestación ascendente (sin tildes), con matrícula como desempate', () => {
    assert.deepEqual(ordenarEquipos(PARQUE).map((e) => e.transformador_id), ['tx-c', 'tx-b', 'tx-d', 'tx-a']);
  });
  test('los vacíos van al final en los dos sentidos', () => {
    assert.deepEqual(ordenarEquipos(PARQUE, { clave: 'mva', asc: true }).map((e) => e.transformador_id), ['tx-d', 'tx-a', 'tx-b', 'tx-c']);
    assert.deepEqual(ordenarEquipos(PARQUE, { clave: 'mva', asc: false }).map((e) => e.transformador_id), ['tx-b', 'tx-a', 'tx-d', 'tx-c']);
    assert.deepEqual(ordenarEquipos(PARQUE, { clave: 'condicion', asc: false }).map((e) => e.transformador_id), ['tx-d', 'tx-b', 'tx-a', 'tx-c']);
  });
  test('por número de informes, usando el conteo', () => {
    const conteo = contarInformesPorMatricula([
      { id: 'i1', equipo_ref: { matricula: 'T8-Y/Y-PRU' }, estado: 'emitido', version: 1 },
      { id: 'i2', equipo_ref: { matricula: 'T8-Y/Y-PRU' }, estado: 'borrador', version: 0 },
      { id: 'i3', equipo_ref: { matricula: 'T6-W/W-PRU' }, estado: 'borrador', version: 0 }
    ]);
    assert.deepEqual(ordenarEquipos(PARQUE, { clave: 'informes', asc: false, conteo }).map((e) => e.transformador_id).slice(0, 2), ['tx-b', 'tx-d']);
  });
  test('no muta el arreglo original y una clave desconocida cae a subestación', () => {
    const copia = PARQUE.map((e) => e.transformador_id);
    ordenarEquipos(PARQUE, { clave: 'zona', asc: false });
    assert.deepEqual(PARQUE.map((e) => e.transformador_id), copia);
    assert.deepEqual(ordenarEquipos(PARQUE, { clave: 'inventada' }).map((e) => e.transformador_id), ['tx-c', 'tx-b', 'tx-d', 'tx-a']);
  });
});

describe('conteo de informes por matrícula', () => {
  const INF = [
    { id: 'a', equipo_ref: { matricula: 'T9-Z/Z-PRU' }, estado: 'emitido', version: 2, actualizadoEn: '2026-03-01T10:00:00Z' },
    { id: 'b', equipo_ref: { matricula: 'T9-Z/Z-PRU' }, estado: 'borrador', version: 0, actualizadoEn: '2026-04-01T10:00:00Z' },
    { id: 'c', equipo_ref: { matricula: 'T9-Z/Z-PRU' }, estado: 'anulado', version: 1, actualizadoEn: '2026-01-01T10:00:00Z' },
    { id: 'd', contenido: { equipo: { matricula: 'T8-Y/Y-PRU' } }, estado: 'emitido', version: 1, actualizadoEn: '2026-02-01T10:00:00Z' },
    { id: 'e', estado: 'borrador' }
  ];
  test('totales por estado y el último por fecha de actualización', () => {
    const m = contarInformesPorMatricula(INF);
    const r = m.get('T9-Z/Z-PRU');
    assert.equal(r.total, 3);
    assert.equal(r.emitidos, 1);
    assert.equal(r.borradores, 1);
    assert.equal(r.anulados, 1);
    assert.equal(r.ultimo.id, 'b');
    assert.equal(m.get('T8-Y/Y-PRU').total, 1, 'si no hay equipo_ref usa la matrícula del contenido');
    assert.equal(m.size, 2, 'un informe sin matrícula no se cuenta');
  });
  test('matriculaDeInforme prefiere la identidad fija', () => {
    assert.equal(matriculaDeInforme({ equipo_ref: { matricula: 'A' }, contenido: { equipo: { matricula: 'B' } } }), 'A');
    assert.equal(matriculaDeInforme(null), '');
  });
  test('etiqueta del estado', () => {
    assert.equal(etiquetaEstado('emitido', 2), 'v2 emitido');
    assert.equal(etiquetaEstado('borrador', 0), 'borrador');
    assert.equal(etiquetaEstado('borrador', 1), 'v1 · en corrección');
    assert.equal(etiquetaEstado('anulado', 1), 'anulado');
  });
});

describe('opciones de filtro y tope de lectura', () => {
  test('zonas y departamentos sin repetir (sin tildes), condiciones presentes y «sd»', () => {
    const o = opcionesFiltro(PARQUE);
    assert.deepEqual(o.zonas, ['OCCIDENTE', 'ORIENTE']);
    assert.deepEqual(o.departamentos, ['CESAR', 'CÓRDOBA', 'MAGDALENA']);
    assert.deepEqual(o.condiciones, ['2', '4', '5', 'sd']);
  });
  test('posible parque incompleto si llegan tantos como el tope', () => {
    assert.equal(posibleParqueIncompleto(500, 500), true);
    assert.equal(posibleParqueIncompleto(208, 500), false);
  });
});
