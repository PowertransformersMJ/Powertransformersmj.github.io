// Indicadores de Órdenes por accesorio, zona, motivo y mes (pedido del 2026-10-06).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIVO_OTRO, SIN_DATO, normal, sumarMeses, claveAccesorio, grupoMotivo, mesDe, etiquetaMes,
  filtrarOrdenes, cantidadEnOrden, agrupar, serieMensual, porAccesorio, motivosOtros,
  transformadoresDistintos
} from '../assets/js/domain/ordenes_indicadores.js';

const CERRADOS = ['Mantenimiento de rutina PSM.', 'Actualización de accesorios.'];
const it = (descripcion, unidad, cantidad) => ({ codigo: '', descripcion, unidad, cantidad });
const O = [
  { tipo: 'ENTRADA', numero: '1', fechaISO: '2026-01-10', zona: 'OCCIDENTE', transformador: 'T1 · S/E COROZAL',
    motivo: 'Mantenimiento de rutina PSM.', motivoSel: 'Mantenimiento de rutina PSM.',
    items: [it('Motoventiladores Tipo 1', 'UND', 4), it('Silica Gel por Kg', 'Kg', 12.5)] },
  { tipo: 'SALIDA', numero: '2', fechaISO: '2026-03-05', zona: 'Occidente', transformador: '',
    motivo: 'Préstamo a contratista', motivoSel: 'Otro (especificar)',
    items: [it('Motoventiladores Tipo 1', 'UND', 2), it('motoventiladores tipo 1 ', 'und', 1)] },
  { tipo: 'SALIDA', numero: '3', fechaISO: '2026-03-20', zona: 'BOLÍVAR', transformador: 't1 · s/e corozal',
    motivo: 'Actualización de accesorios.', motivoSel: 'Actualización de accesorios.',
    items: [it('Silica Gel por Kg', 'UND', 1)] },
  { tipo: 'ENTRADA', numero: '4', fechaISO: '', zona: 'ORIENTE', motivo: 'texto viejo sin motivoSel',
    items: [it('Relé Buchholz', 'UND', 1)] }
];
const MOTO = claveAccesorio(it('Motoventiladores Tipo 1', 'UND'));

test('normal: sin tildes, minúsculas y espacios simples', () => {
  assert.equal(normal('  Válvula   de  ALIVIO '), 'valvula de alivio');
  assert.equal(normal(null), '');
});

test('claveAccesorio: misma descripción y unidad escritas distinto son el mismo accesorio', () => {
  assert.equal(claveAccesorio(it('Motoventiladores Tipo 1', 'UND')), claveAccesorio(it('motoventiladores  tipo 1', 'und')));
});

test('claveAccesorio: la misma descripción con otra unidad es OTRO accesorio (no se mezclan unidades)', () => {
  assert.notEqual(claveAccesorio(it('Silica Gel por Kg', 'Kg')), claveAccesorio(it('Silica Gel por Kg', 'UND')));
});

test('grupoMotivo: lista cerrada tal cual; «Otro» y textos fuera de la lista van a una sola barra', () => {
  assert.equal(grupoMotivo(O[0], CERRADOS), 'Mantenimiento de rutina PSM.');
  assert.equal(grupoMotivo(O[1], CERRADOS), MOTIVO_OTRO);
  assert.equal(grupoMotivo(O[3], CERRADOS), MOTIVO_OTRO);
  assert.equal(grupoMotivo({ motivo: '' }, CERRADOS), SIN_DATO);
  assert.equal(grupoMotivo({ motivo: 'mantenimiento de rutina psm.' }, CERRADOS), 'Mantenimiento de rutina PSM.');
});

test('mesDe y etiquetaMes', () => {
  assert.equal(mesDe(O[0]), '2026-01');
  assert.equal(mesDe(O[3]), '');
  assert.equal(etiquetaMes('2026-08'), 'ago 26');
});

test('filtrarOrdenes: zona sin tildes ni mayúsculas', () => {
  assert.deepEqual(filtrarOrdenes(O, { zona: 'occidente' }).map(o => o.numero), ['1', '2']);
  assert.deepEqual(filtrarOrdenes(O, { zona: 'BOLIVAR' }).map(o => o.numero), ['3']);
});

test('filtrarOrdenes: tipo, motivo, accesorio y rango de meses se combinan', () => {
  assert.deepEqual(filtrarOrdenes(O, { tipo: 'SALIDA' }).map(o => o.numero), ['2', '3']);
  assert.deepEqual(filtrarOrdenes(O, { motivo: MOTIVO_OTRO }, CERRADOS).map(o => o.numero), ['2', '4']);
  assert.deepEqual(filtrarOrdenes(O, { accesorio: MOTO }).map(o => o.numero), ['1', '2']);
  assert.deepEqual(filtrarOrdenes(O, { desde: '2026-02-01', hasta: '2026-03' }).map(o => o.numero), ['2', '3']);
  assert.deepEqual(filtrarOrdenes(O, { accesorio: MOTO, tipo: 'SALIDA', zona: 'OCCIDENTE' }).map(o => o.numero), ['2']);
});

test('filtrarOrdenes: con rango de fechas, la orden sin fecha queda fuera; sin rango, entra', () => {
  assert.equal(filtrarOrdenes(O, {}).length, 4);
  assert.ok(!filtrarOrdenes(O, { desde: '2026-01-01' }).some(o => o.numero === '4'));
});

test('cantidadEnOrden: suma los renglones repetidos del mismo accesorio', () => {
  assert.equal(cantidadEnOrden(O[1], MOTO), 3);
  assert.equal(cantidadEnOrden(O[2], MOTO), 0);
});

test('agrupar sin accesorio: cuenta órdenes por entrada y salida', () => {
  const z = agrupar(O.slice(0, 3), o => o.zona === 'Occidente' ? 'OCCIDENTE' : o.zona);
  assert.deepEqual(z[0], { clave: 'OCCIDENTE', ENTRADA: 1, SALIDA: 1, total: 2, ordenes: 2 });
});

test('agrupar con accesorio: suma la CANTIDAD de ese accesorio', () => {
  const z = agrupar(filtrarOrdenes(O, { accesorio: MOTO }), () => 'OCCIDENTE', MOTO);
  assert.deepEqual(z[0], { clave: 'OCCIDENTE', ENTRADA: 4, SALIDA: 3, total: 7, ordenes: 2 });
});

test('agrupar: clave vacía va a «(sin dato)»', () => {
  assert.equal(agrupar([{ tipo: 'ENTRADA' }], () => '')[0].clave, SIN_DATO);
});

test('serieMensual: los meses sin órdenes salen en cero y las órdenes sin fecha se cuentan aparte', () => {
  const { serie, sinFecha } = serieMensual(O);
  assert.deepEqual(serie.map(s => [s.clave, s.total]), [['2026-01', 1], ['2026-02', 0], ['2026-03', 2]]);
  assert.equal(serie[1].etiqueta, 'feb 26');
  assert.equal(sinFecha, 1);
});

test('serieMensual: cruza el cambio de año', () => {
  const { serie } = serieMensual([{ tipo: 'ENTRADA', fechaISO: '2025-12-01' }, { tipo: 'SALIDA', fechaISO: '2026-02-01' }]);
  assert.deepEqual(serie.map(s => s.clave), ['2025-12', '2026-01', '2026-02']);
});

test('serieMensual con accesorio: cantidades por mes', () => {
  const { serie } = serieMensual(filtrarOrdenes(O, { accesorio: MOTO }), MOTO);
  assert.deepEqual(serie.map(s => [s.clave, s.ENTRADA, s.SALIDA]), [['2026-01', 4, 0], ['2026-02', 0, 0], ['2026-03', 0, 3]]);
});

test('serieMensual: sin órdenes con fecha, serie vacía', () => {
  assert.deepEqual(serieMensual([O[3]]), { serie: [], sinFecha: 1, fueraDeRango: 0, antesDelCorte: 0 });
  assert.deepEqual(serieMensual([]), { serie: [], sinFecha: 0, fueraDeRango: 0, antesDelCorte: 0 });
});

test('porAccesorio: una orden cuenta UNA vez aunque repita el renglón; la cantidad sí se suma', () => {
  const r = porAccesorio(O);
  const moto = r.find(a => a.clave === MOTO);
  assert.equal(moto.total, 2);
  assert.equal(moto.ENTRADA, 1);
  assert.equal(moto.SALIDA, 1);
  assert.equal(moto.cantE, 4);
  assert.equal(moto.cantS, 3);
  assert.equal(r[0].clave, MOTO, 'el más frecuente va primero');
});

test('porAccesorio: la misma descripción en Kg y en UND son dos filas', () => {
  const silica = porAccesorio(O).filter(a => normal(a.descripcion) === 'silica gel por kg');
  assert.deepEqual(silica.map(a => a.unidad).sort(), ['Kg', 'UND']);
});

test('porAccesorio: cuenta transformadores y zonas distintos, sin tildes ni mayúsculas', () => {
  const kg = porAccesorio(O).find(a => a.unidad === 'Kg');
  assert.equal(kg.transformadores, 1);
  const r = porAccesorio([O[0], O[2]].map(o => ({ ...o, items: [it('X', 'UND', 1)] })));
  assert.equal(r[0].transformadores, 1, '«T1 · S/E COROZAL» y «t1 · s/e corozal» son el mismo');
  assert.equal(r[0].zonas, 2);
});

test('porAccesorio: grupo del catálogo si se pasa la función', () => {
  const r = porAccesorio(O, x => (normal(x.descripcion).startsWith('moto') ? 'Accesorios' : 'Otro'));
  assert.equal(r.find(a => a.clave === MOTO).grupo, 'Accesorios');
});

test('porAccesorio: ignora renglones sin descripción', () => {
  assert.equal(porAccesorio([{ tipo: 'ENTRADA', items: [it('', 'UND', 3)] }]).length, 0);
});

test('motivosOtros: lista los textos libres con su conteo', () => {
  assert.deepEqual(motivosOtros(O, CERRADOS), [
    { texto: 'Préstamo a contratista', ordenes: 1 }, { texto: 'texto viejo sin motivoSel', ordenes: 1 }]);
});

test('transformadoresDistintos: compara sin mayúsculas', () => {
  assert.equal(transformadoresDistintos(O), 1);
});

test('entradas vacías no rompen nada', () => {
  assert.deepEqual(filtrarOrdenes(null, null), []);
  assert.deepEqual(porAccesorio(undefined), []);
  assert.deepEqual(agrupar(undefined, () => ''), []);
  assert.equal(transformadoresDistintos(undefined), 0);
});

test('serieMensual con rango: la serie llega a los bordes del periodo aunque no haya órdenes ahí', () => {
  const { serie } = serieMensual(O, null, { desde: '2025-11-15', hasta: '2026-05' });
  assert.equal(serie[0].clave, '2025-11');
  assert.equal(serie[serie.length - 1].clave, '2026-05');
  assert.equal(serie.length, 7);
});

test('serieMensual marca el mes en curso para no leerlo como una caída', () => {
  const { serie } = serieMensual(O, null, { mesActual: '2026-03' });
  assert.deepEqual(serie.map(s => s.enCurso), [false, false, true]);
});

test('serieMensual: un rango sin órdenes con fecha no inventa una serie', () => {
  assert.deepEqual(serieMensual([O[3]], null, { desde: '2026-01-01', hasta: '2026-03-31' }),
    { serie: [], sinFecha: 1, fueraDeRango: 0, antesDelCorte: 0 });
});

test('serieMensual con tope de lectura: no pinta meses sin leer y marca el más antiguo como incompleto', () => {
  const { serie } = serieMensual(O, null, { desde: '2025-06-01', minimo: '2026-01' });
  assert.equal(serie[0].clave, '2026-01');
  assert.equal(serie[0].incompleto, true);
  assert.ok(serie.slice(1).every(s => !s.incompleto));
});

// Revisión adversarial (10-06): el tope de 120 meses cortaba el FINAL de la serie.
const ord = (f, tipo = 'ENTRADA') => ({ tipo, fechaISO: f, items: [] });
const suma = (s) => s.serie.reduce((a, x) => a + x.total, 0);

test('serieMensual: con un «Desde» de hace más de 10 años se conservan los meses MÁS RECIENTES', () => {
  const r = serieMensual([ord('2026-09-15'), ord('2026-10-02')], null, { desde: '2015-01-01', hasta: '2026-10', mesActual: '2026-10' });
  assert.equal(r.serie.length, 120);
  assert.equal(r.serie[0].clave, '2016-11');
  assert.equal(r.serie[r.serie.length - 1].clave, '2026-10');
  assert.equal(r.serie[r.serie.length - 1].enCurso, true);
  assert.equal(suma(r), 2);
});

test('serieMensual: una orden con el año mal escrito (2016 por 2026) no tumba los meses de ahora', () => {
  const r = serieMensual([ord('2016-09-10'), ord('2026-10-01'), ord('2026-10-02')], null, { mesActual: '2026-10' });
  assert.equal(r.serie[r.serie.length - 1].clave, '2026-10');
  assert.equal(suma(r), 2);
  assert.equal(r.antesDelCorte, 1);
});

test('serieMensual: fechas imposibles (0026, 2062) quedan fuera de la serie y se cuentan aparte', () => {
  const r = serieMensual([ord('0026-03-05'), ord('2062-03-05'), ord('2026-03-05')], null, { mesActual: '2026-10' });
  assert.deepEqual(r.serie.map(s => s.clave), ['2026-03']);
  assert.equal(r.fueraDeRango, 2);
  assert.equal(suma(r), 1);
});

test('serieMensual: una orden del mes siguiente (programada) sí entra', () => {
  const r = serieMensual([ord('2026-10-01'), ord('2026-11-20')], null, { mesActual: '2026-10' });
  assert.deepEqual(r.serie.map(s => s.clave), ['2026-10', '2026-11']);
  assert.equal(r.fueraDeRango, 0);
});

test('sumarMeses: cruza años en ambos sentidos y escribe el año con 4 cifras', () => {
  assert.equal(sumarMeses('2026-01', -1), '2025-12');
  assert.equal(sumarMeses('2026-12', 1), '2027-01');
  assert.equal(sumarMeses('2026-10', -119), '2016-11');
  assert.equal(sumarMeses('0999-01', 0), '0999-01');
});

test('porAccesorio: el empate se resuelve por nombre, nunca sumando unidades distintas', () => {
  const r = porAccesorio([{ tipo: 'ENTRADA', items: [it('Zeta cable', 'Mts', 300), it('Alfa buje', 'UND', 1)] }]);
  assert.deepEqual(r.map(a => a.descripcion), ['Alfa buje', 'Zeta cable']);
});
