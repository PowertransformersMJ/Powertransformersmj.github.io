// Registro en Movimientos de las entregas de Órdenes E/S (2026-10-07, `99 §147`). SOLO datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizarMovimiento, validarMovimiento } from '../assets/js/domain/movimiento_schema.js';
import { calcularNexo } from '../assets/js/domain/ordenes_contrato_nexo.js';
import {
  planificarRegistro, resolverTransformador, idMovimientoDeOrden, ubicacionParque, USUARIO_ORDENES
} from '../assets/js/domain/ordenes_movimientos_registro.js';

const CID = '4125000143';
const CAT = [
  { codigo: 'S03', nombre: 'Motoventiladores Tipo 1 FN-063', unidad: 'Und', valor_unitario: 1000, marcas_disponibles: ['ZIEHL'] },
  { codigo: 'S11', nombre: 'Silica Gel por Kg', unidad: 'Kg', valor_unitario: 10, marcas_disponibles: [] },
  { codigo: 'S20', nombre: 'Relé Buchholz', unidad: 'Und', valor_unitario: 500, marcas_disponibles: ['A', 'B'] }
];
const PARQUE = [
  { id: 'doc-tx1', identificacion: { matricula: 'TX-1' }, ubicacion: { subestacion_nombre: 'ALFA', zona: 'BOLIVAR', departamento: 'bolivar' } },
  { id: 'doc-tx2', identificacion: { matricula: 'TX-2' }, ubicacion: { subestacion_nombre: 'BETA', zona: 'ORIENTE', departamento: 'cesar' } },
  { id: 'doc-tx2b', identificacion: { matricula: 'TX-2' }, ubicacion: { subestacion_nombre: 'GAMMA', zona: 'ORIENTE', departamento: 'cesar' } }
];
const it = (descripcion, unidad, cantidad) => ({ codigo: '', descripcion, unidad, cantidad });
const orden = (o) => ({ clave: 'ENTRADA_' + (o.numero || 'N1'), tipo: 'ENTRADA', numero: 'N1', fechaISO: '2026-03-01', creadoEn: 111,
  zona: 'BOLIVAR', transformador: 'TX-1 · S/E ALFA', items: [], ...o });
const nexoDe = (ordenes, movimientos) => calcularNexo({ ordenes, catalogo: CAT, contratoId: CID, movimientos });
const plan = (ordenes, movimientos, extra) => planificarRegistro({ nexo: nexoDe(ordenes, movimientos), parque: PARQUE, catalogo: CAT, contratoId: CID, ...extra });
/** Lo que quedaría escrito en Firestore (saneado, con código). */
const escrito = (p, codigo) => ({ ...sanitizarMovimiento({ ...p.payload, codigo }) });

test('el enlace con la orden SOBREVIVE al saneo y el movimiento valida', () => {
  const p = plan([orden({ items: [it('Relé Buchholz', 'UND', 2)] })]).porRegistrar[0];
  const m = escrito(p, 'MOV-2026-0002');
  assert.equal(m.orden_es.clave, 'ENTRADA_N1');
  assert.equal(m.orden_es.cantidad, 2);
  assert.equal(m.fecha_entrega, '2026-03-01');
  assert.deepEqual(validarMovimiento(m), []);
});

test('un movimiento manual (sin campos nuevos) queda idéntico: no aparecen orden_es ni fecha_entrega', () => {
  const m = sanitizarMovimiento({ codigo: 'MOV-2026-0001', anio: 2026, tipo: 'EGRESO', suministro_id: 'S20', cantidad: 1,
    transformador_id: 'x', matricula: 'TX-1', valor_unitario: 1 });
  assert.ok(!('orden_es' in m));
  assert.ok(!('fecha_entrega' in m));
});

test('el movimiento toma transformador, zona y departamento DEL PARQUE y usa el id del documento', () => {
  const p = plan([orden({ transformador: 'tx-2 · s/e Beta', zona: 'BOLIVAR', items: [it('Relé Buchholz', 'UND', 1)] })]).porRegistrar[0];
  assert.equal(p.payload.transformador_id, 'doc-tx2');
  assert.equal(p.payload.matricula, 'TX-2');
  assert.equal(p.payload.subestacion, 'BETA');
  assert.equal(p.payload.zona, 'ORIENTE');
  assert.equal(p.payload.departamento, 'cesar');
  assert.equal(p.payload.usuario, USUARIO_ORDENES);
  assert.ok(!/^Acción /.test(p.payload.observaciones), 'no se confunde con un egreso de Brigada');
});

test('dos renglones del mismo ítem en una orden se registran como UN movimiento', () => {
  const r = plan([orden({ items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 2), it('Motoventiladores Tipo 1 FN-063', 'UND', 3)] })]);
  assert.equal(r.porRegistrar.length, 1);
  assert.equal(r.porRegistrar[0].payload.cantidad, 5);
  assert.equal(r.porRegistrar[0].payload.marca, 'ZIEHL', 'una sola marca en el catálogo: se toma');
});

test('id fijo por (orden, ítem): repetir no duplica, y una barra de la clave no rompe el id', () => {
  assert.equal(idMovimientoDeOrden(CID, 'ENTRADA_20260119', 'S03'), 'oes_4125000143_ENTRADA_20260119_S03');
  assert.ok(!idMovimientoDeOrden(CID, 'ENTRADA_A/B', 'S03').includes('/'));
});

test('no registrables, con su motivo: decimales, sin transformador, no hallado, ambiguo, supera lo que queda', () => {
  const r = plan([
    orden({ numero: 'D', items: [it('Silica Gel por Kg', 'Kg', 2.5)] }),
    orden({ numero: 'S', transformador: '', items: [it('Relé Buchholz', 'UND', 1)] }),
    orden({ numero: 'X', transformador: 'TX-9 · S/E OMEGA', items: [it('Relé Buchholz', 'UND', 1)] }),
    orden({ numero: 'A', transformador: 'TX-2', items: [it('Relé Buchholz', 'UND', 1)] }),
    orden({ numero: 'Q', items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 9)] })
  ], [], { existencias: { S03: 5 } });
  const m = Object.fromEntries(r.noRegistrables.map((x) => [x.linea.numero, x.motivo]));
  assert.match(m.D, /decimales/);
  assert.match(m.S, /no indica transformador/);
  assert.match(m.X, /no aparece en el parque/);
  assert.match(m.A, /más de una vez/);
  assert.match(m.Q, /supera lo que queda/);
  assert.equal(r.porRegistrar.length, 0);
});

test('resolverTransformador: sin S/E solo vale si la matrícula es única', () => {
  assert.equal(resolverTransformador(PARQUE, 'TX-1', '').ok, true);
  assert.equal(resolverTransformador(PARQUE, 'TX-2', '').ok, false);
  assert.equal(ubicacionParque({ docId: 'd', matricula: 'M', subestacion: 'S', zona: 'bolivar', departamento: 'BOLIVAR' }).zona, 'BOLIVAR');
});

test('NO hay doble conteo: un movimiento enlazado + su orden suman UNA vez', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 2)] });
  const p = plan([o]).porRegistrar[0];
  const mov = escrito(p, 'MOV-2026-0002');
  const n = nexoDe([o], [mov]);
  assert.equal(n.porItemPendiente.S20, undefined, 'lo registrado ya no queda pendiente');
  assert.equal(n.totalPendiente, 0);
  assert.equal(n.totalRegistrado, 1000);
  assert.equal(n.porItem.S20.cantidad, 2, 'lo entregado se sigue mostrando completo');
  assert.equal(n.lineasDetalle[0].estado, 'registrado');
  assert.deepEqual(n.lineasDetalle[0].movimientos, ['MOV-2026-0002']);
  assert.equal(n.avisos.length, 0, 'un movimiento enlazado nunca dispara el aviso de doble registro');
  assert.equal(plan([o], [mov]).porRegistrar.length, 0, 'no se vuelve a registrar');
});

test('orden que sube después de registrada: «desfasado» y solo se descuenta la diferencia', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 2)] });
  const mov = escrito(plan([o]).porRegistrar[0], 'MOV-2026-0002');
  const n = nexoDe([{ ...o, items: [it('Relé Buchholz', 'UND', 5)] }], [mov]);
  assert.equal(n.lineasDetalle[0].estado, 'desfasado');
  assert.equal(n.porItemPendiente.S20.cantidad, 3);
  assert.ok(n.avisos.some((a) => /cambiaron en la orden/.test(a)));
});

test('orden rehecha (mismo número, otro creadoEn) o con otro transformador: «desfasado»', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 2)] });
  const mov = escrito(plan([o]).porRegistrar[0], 'MOV-2026-0002');
  assert.equal(nexoDe([{ ...o, creadoEn: 999 }], [mov]).lineasDetalle[0].estado, 'desfasado');
  assert.equal(nexoDe([{ ...o, transformador: 'TX-2 · S/E BETA' }], [mov]).lineasDetalle[0].estado, 'desfasado');
});

test('orden eliminada después de registrada: el movimiento queda huérfano y se avisa', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 2)] });
  const mov = escrito(plan([o]).porRegistrar[0], 'MOV-2026-0002');
  const n = nexoDe([], [mov]);
  assert.ok(n.avisos.some((a) => /ya no existe/.test(a) && /MOV-2026-0002/.test(a)));
});

test('un egreso NO enlazado (manual o de Brigada) al mismo transformador sigue disparando el aviso, aunque la orden esté registrada', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 2)] });
  const mov = escrito(plan([o]).porRegistrar[0], 'MOV-2026-0002');
  const manual = { tipo: 'EGRESO', suministro_id: 'S20', matricula: 'TX-1', subestacion: 'ALFA', codigo: 'MOV-2026-0003' };
  assert.ok(nexoDe([o], [mov, manual]).avisos.some((a) => /doble registro/.test(a)));
});

test('movimiento enlazado de OTRO contrato no cuenta para este', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 2)] });
  const mov = { ...escrito(plan([o]).porRegistrar[0], 'MOV-2026-0002'), contrato_id: '4123000081' };
  assert.equal(nexoDe([o], [mov]).lineasDetalle[0].estado, 'por_registrar');
});

// Revisión adversarial (10-07): orden rehecha con otro número después de registrada.
test('orden borrada y rehecha con otro número: el huérfano cuenta y SÍ salta el aviso de doble registro con la plata', () => {
  const a = orden({ numero: 'A1', items: [it('Relé Buchholz', 'UND', 2)] });
  const movA = escrito(plan([a]).porRegistrar[0], 'MOV-2026-0002');
  const b = orden({ numero: 'B1', items: [it('Relé Buchholz', 'UND', 2)] });
  const n = nexoDe([b], [movA]);
  assert.ok(n.avisos.some((x) => /doble registro/.test(x)), 'el huérfano del mismo ítem y trafo entra al chequeo');
  assert.ok(n.avisos.some((x) => /ya no existe/.test(x) && /1\.000 pesos/.test(x) && /dos veces/.test(x)));
});

test('un renglón del ítem con otra unidad no entra al nexo ni al registro', () => {
  const r = plan([orden({ items: [it('Silica Gel por Kg', 'UND', 3), it('Silica Gel por Kg', 'Kg', 4)] })]);
  assert.equal(r.porRegistrar.length, 1);
  assert.equal(r.porRegistrar[0].payload.cantidad, 4);
});
