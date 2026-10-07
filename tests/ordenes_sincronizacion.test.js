// Registro AUTOMÁTICO de las entregas de Órdenes E/S en el contrato (2026-10-07, `99 §148`).
// Plan de sincronización (registrar · corregir · retirar), la prueba que se repite en cada
// transacción y el aviso para la persona. SOLO datos sintéticos (repositorio público).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizarMovimiento, sanitizarEnlaceOrden } from '../assets/js/domain/movimiento_schema.js';
import { calcularNexo, NEXO_CONTRATOS } from '../assets/js/domain/ordenes_contrato_nexo.js';
import {
  planificarSincronizacion, diferenciaConOrden, cantidadDelItemEnOrden, hayQueSincronizar,
  textoSincronizacion, resultadoVacio, hayNovedad, idMovimientoDeOrden
} from '../assets/js/domain/ordenes_movimientos_registro.js';

const CID = '4125000143';
const CFG = NEXO_CONTRATOS[CID];
const CAT = [
  { codigo: 'S03', nombre: 'Motoventiladores Tipo 1 FN-063', unidad: 'Und', valor_unitario: 1000, marcas_disponibles: ['ZIEHL'] },
  { codigo: 'S20', nombre: 'Relé Buchholz', unidad: 'Und', valor_unitario: 500, marcas_disponibles: [] }
];
const PARQUE = [
  { id: 'doc-tx1', identificacion: { matricula: 'TX-1' }, ubicacion: { subestacion_nombre: 'ALFA', zona: 'BOLIVAR', departamento: 'bolivar' } },
  { id: 'doc-tx2', identificacion: { matricula: 'TX-2' }, ubicacion: { subestacion_nombre: 'BETA', zona: 'ORIENTE', departamento: 'cesar' } }
];
const it = (descripcion, unidad, cantidad) => ({ codigo: '', descripcion, unidad, cantidad });
const orden = (o) => ({ clave: 'ENTRADA_N1', tipo: 'ENTRADA', numero: 'N1', fechaISO: '2026-03-01', creadoEn: 111, version: 1,
  zona: 'BOLIVAR', transformador: 'TX-1 · S/E ALFA', items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 3)], ...o });
const nexoDe = (ordenes, movimientos) => calcularNexo({ ordenes, catalogo: CAT, contratoId: CID, movimientos });
const sinc = (ordenes, movimientos, extra) =>
  planificarSincronizacion({ nexo: nexoDe(ordenes, movimientos), parque: PARQUE, catalogo: CAT, contratoId: CID, ...extra });
/** El movimiento que quedó escrito para una orden (como lo deja la transacción). */
function registrado(o, codigo, extra) {
  const p = sinc([o]).porRegistrar.find((x) => x.payload.suministro_id === ((extra && extra.suministro_id) || 'S03'));
  return { id: p.docId, ...sanitizarMovimiento({ ...p.payload, codigo }), ...(extra || {}) };
}

test('orden nueva con ítems del contrato: todo va a «registrar», nada a corregir ni retirar', () => {
  const p = sinc([orden()]);
  assert.equal(p.porRegistrar.length, 1);
  assert.equal(p.corregir.length, 0);
  assert.equal(p.retirar.length, 0);
  assert.equal(p.porRegistrar[0].payload.orden_es.version, 1, 'la versión de la orden viaja en el enlace');
  assert.equal(p.porRegistrar[0].docId, idMovimientoDeOrden(CID, 'ENTRADA_N1', 'S03'));
});

test('orden ya registrada y sin cambios: no hay nada que sincronizar', () => {
  const o = orden();
  const m = registrado(o, 'MOV-2026-0001');
  const n = nexoDe([o], [m]);
  assert.equal(hayQueSincronizar(n), false);
  const p = sinc([o], [m]);
  assert.equal(p.porRegistrar.length + p.corregir.length + p.retirar.length, 0);
});

test('editar solo la nota de la orden (otra versión, mismo contenido) NO corrige: no se gastan consecutivos', () => {
  const m = registrado(orden(), 'MOV-2026-0001');
  const n = nexoDe([orden({ version: 4, nota: 'otra' })], [m]);
  assert.equal(hayQueSincronizar(n), false);
});

test('la orden cambió la cantidad: se corrige (retira el viejo por su id y registra el de la orden)', () => {
  const m = registrado(orden(), 'MOV-2026-0001');
  const o2 = orden({ version: 2, items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 2)] });
  const p = sinc([o2], [m]);
  assert.equal(p.corregir.length, 1);
  assert.deepEqual(p.corregir[0].ids, [m.id]);
  assert.equal(p.corregir[0].registro.payload.cantidad, 2);
  assert.equal(p.corregir[0].registro.payload.orden_es.version, 2);
  assert.equal(p.corregir[0].registro.docId, m.id, 'mismo id fijo: la corrección reemplaza, no duplica');
  assert.equal(p.porRegistrar.length, 0);
});

test('la orden cambió a un transformador que no está en el parque: se retira el viejo y queda pendiente con motivo', () => {
  const m = registrado(orden(), 'MOV-2026-0001');
  const p = sinc([orden({ version: 2, transformador: 'TX-9 · S/E ZETA' })], [m]);
  assert.equal(p.corregir.length, 1);
  assert.equal(p.corregir[0].registro, null);
  assert.match(p.corregir[0].motivo, /no aparece en el parque/);
});

test('la orden fue eliminada: sus movimientos quedan para retirar, con sus ids', () => {
  const m = registrado(orden(), 'MOV-2026-0001');
  const n = nexoDe([], [m]);
  assert.equal(n.huerfanos.length, 1);
  assert.deepEqual(n.huerfanos[0].ids, [m.id]);
  assert.equal(hayQueSincronizar(n), true);
  const p = sinc([], [m]);
  assert.equal(p.retirar.length, 1);
  assert.deepEqual(p.retirar[0].ids, [m.id]);
});

test('la orden dejó de traer un ítem: ese movimiento se retira y el otro sigue', () => {
  const o = orden({ items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 3), it('Relé Buchholz', 'UND', 1)] });
  const m3 = registrado(o, 'MOV-2026-0001');
  const m20 = registrado(o, 'MOV-2026-0002', { suministro_id: 'S20' });
  const o2 = orden({ version: 2, items: [it('Relé Buchholz', 'UND', 1)] });
  const p = sinc([o2], [m3, m20]);
  assert.deepEqual(p.retirar.map((h) => h.codigo), ['S03']);
  assert.equal(p.corregir.length, 0);
  assert.equal(p.porRegistrar.length, 0);
});

test('un movimiento manual (sin enlace) nunca entra al plan de retiro', () => {
  const manual = { id: 'man-1', codigo: 'MOV-2026-0003', tipo: 'EGRESO', suministro_id: 'S03', cantidad: 1, matricula: 'TX-1', contrato_id: CID };
  const p = sinc([], [manual]);
  assert.equal(p.retirar.length, 0);
});

test('cantidadDelItemEnOrden: mismas reglas del nexo (nombre exacto, unidad del contrato, > 0)', () => {
  const items = [it('Motoventiladores Tipo 1 FN-063', 'UND', 2), it('motoventiladores tipo 1 fn-063', 'Und', 1.5),
    it('Motoventiladores Tipo 1 FN-063', 'Mts', 4), it('Motoventiladores Tipo 1 FN-063', 'UND', 0),
    it('Motoventilador parecido', 'UND', 9)];
  assert.equal(cantidadDelItemEnOrden(items, 'S03', 'Und'), 3.5);
  assert.equal(cantidadDelItemEnOrden(items, 'S20', 'Und'), 0);
  assert.equal(cantidadDelItemEnOrden(null, 'S03', 'Und'), 0);
});

test('diferenciaConOrden: la orden tal cual lo respalda; cada cambio da su motivo', () => {
  const o = orden();
  const m = registrado(o, 'MOV-2026-0001');
  const dif = (ord, extra) => diferenciaConOrden({ orden: ord, enlace: m.orden_es, codigo: 'S03', cantidad: m.cantidad,
    unidadCatalogo: 'Und', cfg: CFG, ...extra });
  assert.equal(dif(o), '');
  assert.equal(dif(orden({ version: 9, nota: 'x' })), '', 'otra versión con el mismo contenido sigue respaldándolo');
  assert.equal(dif(orden({ transformador: 'tx-1 · s/e alfa' })), '', 'mayúsculas/tildes no son un cambio');
  assert.match(dif(null), /eliminada/);
  assert.match(dif(orden({ tipo: 'SALIDA' })), /tipo/);
  assert.match(dif(orden({ fechaISO: '2027-01-15' })), /vigencia/);
  assert.match(dif(orden({ creadoEn: 222 })), /volvió a crear/);
  assert.match(dif(orden({ fechaISO: '2026-03-02' })), /fecha/);
  assert.match(dif(orden({ transformador: 'TX-2 · S/E BETA' })), /transformador/);
  assert.match(dif(orden({ items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 5)] })), /cantidad.*3 → 5/);
  assert.match(dif(orden({ items: [it('Relé Buchholz', 'UND', 1)] })), /ya no trae/);
  assert.equal(dif(o, { unidadCatalogo: null }), null, 'sin la unidad del catálogo no se puede saber: no se toca');
});

test('diferenciaConOrden acepta la creación como Timestamp de Firestore (lectura en la transacción)', () => {
  const m = registrado(orden(), 'MOV-2026-0001');
  const conTs = orden({ creadoEn: { toMillis: () => 111 } });
  assert.equal(diferenciaConOrden({ orden: conTs, enlace: m.orden_es, codigo: 'S03', cantidad: 3, unidadCatalogo: 'Und', cfg: CFG }), '');
});

test('el enlace guarda la versión solo cuando viene (los anteriores quedan iguales)', () => {
  assert.equal(sanitizarEnlaceOrden({ clave: 'ENTRADA_N1', version: 3 }).version, 3);
  assert.ok(!('version' in sanitizarEnlaceOrden({ clave: 'ENTRADA_N1' })));
  assert.ok(!('version' in sanitizarEnlaceOrden({ clave: 'ENTRADA_N1', version: 0 })));
});

test('aviso: dice qué se registró, corrigió, retiró y qué quedó pendiente, sin jerga', () => {
  assert.equal(hayNovedad(resultadoVacio()), false);
  assert.equal(textoSincronizacion(resultadoVacio(), CID).texto, '');
  const r = resultadoVacio();
  r.registrados.push({ codigo: 'MOV-2026-0019' }, { codigo: 'MOV-2026-0020' });
  r.corregidos.push({ codigo: 'MOV-2026-0021', anteriores: ['MOV-2026-0005'] });
  r.retirados.push({ codigo: 'MOV-2026-0007', motivo: 'la orden fue eliminada' });
  let t = textoSincronizacion(r, CID);
  assert.equal(t.tipo, 'ok');
  assert.match(t.texto, /^Contrato 4125000143: 2 entrega\(s\) registrada\(s\) en Movimientos \(MOV-2026-0019, MOV-2026-0020\)/);
  assert.match(t.texto, /MOV-2026-0005 → MOV-2026-0021/);
  assert.match(t.texto, /1 movimiento\(s\) retirado\(s\).*MOV-2026-0007/);
  r.pendientes.push({ linea: { codigo: 'S03', tipo: 'ENTRADA', numero: 'N1' }, motivo: 'el transformador de la orden no aparece en el parque' });
  t = textoSincronizacion(r, CID);
  assert.equal(t.tipo, 'warn');
  assert.match(t.texto, /S03 de ENTRADA N1 — el transformador/);
  r.errores.push('S03 de ENTRADA N1: su usuario no tiene permiso para este cambio'); r.sinPermiso = 1;
  t = textoSincronizacion(r, CID);
  assert.equal(t.tipo, 'err');
  assert.match(t.texto, /administrador abra el contrato/);
});

test('amarre: los contratos con nexo de la regla de Firestore son los de NEXO_CONTRATOS', () => {
  const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const m = reglas.match(/function isContratoConNexo\(v\) \{\s*return v in \[([^\]]*)\];/);
  assert.ok(m, 'falta isContratoConNexo en firestore.rules');
  const enRegla = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
  assert.deepEqual(enRegla, Object.keys(NEXO_CONTRATOS).sort());
});

test('amarre: el registro automático está conectado en Órdenes (guardar, subir, eliminar) y en el tablero', () => {
  const ord = readFileSync(new URL('../assets/js/ordenes-materiales.js', import.meta.url), 'utf8');
  assert.ok((ord.match(/reflejarEnContrato\(/g) || []).length >= 4, 'Órdenes llama al registro automático al guardar, subir y eliminar');
  const tab = readFileSync(new URL('../assets/js/suministros-dashboard-public.js', import.meta.url), 'utf8');
  assert.match(tab, /sincronizarContrato\(/);
});
