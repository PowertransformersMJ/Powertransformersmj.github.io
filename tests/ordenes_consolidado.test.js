// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · zona y consolidado de entregas
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// Pedido del Ingeniero (2026-10-06): «un filtro por zona, y … exportar
// un consolidado en excel de todos los suministros que han sido
// entregados y sobre que transformador y subestacion». Fija qué cuenta
// como entregado (SALIDA), de dónde salen transformador y subestación
// (del campo de la orden, nunca del destino) y cómo se resume.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  claveZona, zonasDe, enZona, partirTransformador, filasEntregas, resumenPorTransformador, SIN_TRANSFORMADOR
} from '../assets/js/domain/ordenes_consolidado.js';

const orden = (o) => ({
  tipo: 'SALIDA', numero: '1', fechaISO: '2026-10-01', fecha: '01/10/2026', zona: 'BOLIVAR',
  origen: 'BODEGA MEMBRILLAL', destino: 'MAMONAL', transformador: 'T1-M/M-MAM · S/E MAMONAL', motivo: 'Mantenimiento de rutina PSM.',
  entregado: { nombre: 'CARLOS MARTELO' }, recibido: { nombre: 'GERARDO RAMIREZ' },
  items: [{ codigo: '', descripcion: 'Relé Buchholz', unidad: 'UND', cantidad: 1 }], ...o
});

describe('zona', () => {
  test('sin tildes, en mayúsculas y sin espacios de más', () => {
    assert.equal(claveZona(' Bolívar '), 'BOLIVAR');
    assert.equal(claveZona('occidente'), 'OCCIDENTE');
  });
  test('zonas presentes, sin repetir y en orden', () => {
    assert.deepEqual(zonasDe([{ zona: 'Oriente' }, { zona: 'BOLÍVAR' }, { zona: 'bolivar' }, { zona: '' }, {}]), ['BOLIVAR', 'ORIENTE']);
  });
  test('sin zona elegida, todas pasan; con zona, solo la suya', () => {
    assert.equal(enZona({ zona: 'ORIENTE' }, ''), true);
    assert.equal(enZona({ zona: 'Bolívar' }, 'BOLIVAR'), true);
    assert.equal(enZona({ zona: 'ORIENTE' }, 'BOLIVAR'), false);
  });
});

describe('transformador y subestación salen del campo de la orden', () => {
  test('«MATRÍCULA · S/E SUBESTACIÓN» se separa', () => {
    assert.deepEqual(partirTransformador('T1-M/M-MAM · S/E MAMONAL'), { matricula: 'T1-M/M-MAM', subestacion: 'MAMONAL' });
    assert.deepEqual(partirTransformador('T2-A/M-NCO · S/E NUEVA COSPIQUE'), { matricula: 'T2-A/M-NCO', subestacion: 'NUEVA COSPIQUE' });
  });
  test('un texto escrito de otra forma queda como matrícula, sin inventar subestación', () => {
    assert.deepEqual(partirTransformador('TRAFO 2 PATIO'), { matricula: 'TRAFO 2 PATIO', subestacion: '' });
    assert.deepEqual(partirTransformador(''), { matricula: '', subestacion: '' });
  });
});

describe('filasEntregas', () => {
  const ords = [
    orden({ numero: '3', fechaISO: '2026-10-03' }),
    orden({ numero: '2', tipo: 'ENTRADA' }),                                          // no es entrega
    orden({ numero: '4', zona: 'ORIENTE', transformador: 'T1-M/M-VAL · S/E VALLEDUPAR' }),
    orden({ numero: '5', transformador: '', destino: 'ALGARROBO' }),                   // sin transformador
    orden({ numero: '1', items: [{ descripcion: 'Silica Gel por Kg', unidad: 'Kg', cantidad: 2.5 }, { descripcion: 'Relé Buchholz', unidad: 'UND', cantidad: 2 }] })
  ];
  test('solo SALIDA: una fila por material', () => {
    const f = filasEntregas(ords);
    assert.equal(f.length, 5);
    assert.ok(!f.some(x => x.numero === '2'));
  });
  test('la zona filtra', () => {
    assert.deepEqual(filasEntregas(ords, { zona: 'Oriente' }).map(x => x.numero), ['4']);
  });
  test('orden: zona → subestación (sin transformador al final) → transformador → fecha → número', () => {
    assert.deepEqual(filasEntregas(ords, { zona: 'BOLIVAR' }).map(x => x.numero + '/' + x.item), ['1/1', '1/2', '3/1', '5/1']);
  });
  test('sin transformador no se deduce la subestación del destino', () => {
    const f = filasEntregas(ords).find(x => x.numero === '5');
    assert.equal(f.conTransformador, false);
    assert.equal(f.subestacion, '');
    assert.equal(f.destino, 'ALGARROBO');
    assert.match(SIN_TRANSFORMADOR, /no indica transformador/);
  });
  test('trae quién entregó y quién recibió', () => {
    const f = filasEntregas(ords)[0];
    assert.equal(f.entrego, 'CARLOS MARTELO');
    assert.equal(f.recibio, 'GERARDO RAMIREZ');
  });
});

describe('resumenPorTransformador', () => {
  test('suma por transformador y material, cuenta órdenes y guarda la última fecha', () => {
    const f = filasEntregas([
      orden({ numero: '1', fechaISO: '2026-09-01', items: [{ descripcion: 'Relé Buchholz', unidad: 'UND', cantidad: 1 }] }),
      orden({ numero: '2', fechaISO: '2026-10-02', items: [{ descripcion: 'relé buchholz', unidad: 'UND', cantidad: 2 }] }),
      orden({ numero: '3', fechaISO: '2026-10-03', items: [{ descripcion: 'Relé Buchholz', unidad: 'Mts', cantidad: 5 }] })
    ]);
    const r = resumenPorTransformador(f);
    const und = r.find(x => x.unidad === 'UND');
    assert.equal(und.cantidad, 3);
    assert.equal(und.ordenes, 2);
    assert.equal(und.ultima, '2026-10-02');
    assert.equal(r.length, 2);   // unidades distintas no se suman
  });
  test('decimales sin error de coma flotante', () => {
    const f = filasEntregas([orden({ items: [{ descripcion: 'X', unidad: 'Kg', cantidad: 0.1 }, { descripcion: 'X', unidad: 'Kg', cantidad: 0.2 }] })]);
    assert.equal(resumenPorTransformador(f)[0].cantidad, 0.3);
  });
});

describe('la pantalla trae el filtro y el consolidado', () => {
  const html = readFileSync(new URL('../pages/ordenes-materiales.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../assets/js/ordenes-materiales.js', import.meta.url), 'utf8');
  test('selector de zona y botón de exportar en «Órdenes guardadas»', () => {
    assert.match(html, /<select id="filtroZona" aria-label="Filtrar las órdenes por zona">/);
    assert.match(html, /id="btnEntregasExcel">Exportar entregas por transformador \(Excel\)<\/button>/);
  });
  test('la lista y las pendientes respetan la zona', () => {
    assert.match(js, /estado\.ordenes\.filter\(o => enZona\(o, zona\)/);
    assert.match(js, /filasPendientes\(zona\)/);
  });
  test('el consolidado usa la zona elegida, solo el registro, y dice su criterio', () => {
    assert.match(js, /filasEntregas\(estado\.ordenes, \{ zona \}\)/);
    assert.match(js, /addWorksheet\('Entregas'/);
    assert.match(js, /addWorksheet\('Por transformador'/);
    assert.match(js, /addWorksheet\('Notas'\)/);
  });
  test('con el HTML viejo en caché (L-85) los elementos nuevos se buscan con guarda', () => {
    assert.doesNotMatch(js, /\$\('#filtroZona'\)\.addEventListener/);
    assert.doesNotMatch(js, /\$\('#btnEntregasExcel'\)\.(addEventListener|onclick)/);
  });
});
