// Nexo Contrato ↔ Órdenes E/S (pedido del 2026-10-07). SOLO datos sintéticos: el repo es público.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NEXO_CONTRATOS, TABLA_ACCESORIOS, EXCLUIDOS, normal, unidadComparable, codigoDelItem,
  claveTransformador, calcularNexo, existenciaConOrdenes, SIN_TRANSFORMADOR
} from '../assets/js/domain/ordenes_contrato_nexo.js';

const CID = '4125000143';
const CAT = [
  { codigo: 'S03', nombre: 'Motoventiladores Tipo 1 FN-063', unidad: 'Und', valor_unitario: 1000 },
  { codigo: 'S11', nombre: 'Silica Gel por Kg', unidad: 'Kg', valor_unitario: 10 },
  { codigo: 'S20', nombre: 'Relé Buchholz', unidad: 'Und', valor_unitario: 500 },
  { codigo: 'S01', nombre: 'Suministro de coraza', unidad: 'Mt', valor_unitario: 2 }
];
const it = (descripcion, unidad, cantidad) => ({ codigo: '', descripcion, unidad, cantidad });
const orden = (o) => ({ tipo: 'ENTRADA', numero: 'N1', fechaISO: '2026-03-01', zona: 'BOLIVAR', transformador: 'TX-1 · S/E ALFA', items: [], ...o });
const nexo = (ordenes, extra) => calcularNexo({ ordenes, catalogo: CAT, contratoId: CID, ...extra });

test('amarre: cada nombre de la lista «Accesorios» de Órdenes está en la tabla del nexo o en los excluidos', () => {
  const src = readFileSync(new URL('../assets/js/ordenes-materiales.js', import.meta.url), 'utf8');
  const nombres = [...src.matchAll(/descripcion: "([^"]+)", unidad: "[^"]+", grupo: "Accesorios"/g)].map((m) => m[1]);
  assert.ok(nombres.length >= 25, 'debía encontrar la lista Accesorios');
  const conocidos = new Set([...Object.keys(TABLA_ACCESORIOS), ...EXCLUIDOS].map(normal));
  for (const n of nombres) assert.ok(conocidos.has(normal(n)), `«${n}» no está en TABLA_ACCESORIOS ni en EXCLUIDOS`);
  assert.equal(new Set(Object.values(TABLA_ACCESORIOS)).size, 25, 'los 25 códigos S01–S25, sin repetir');
});

test('vigencias de contratos con nexo: fechas válidas y sin cruzarse', () => {
  const v = Object.values(NEXO_CONTRATOS).sort((a, b) => a.desde.localeCompare(b.desde));
  for (const c of v) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.desde) && c.desde <= c.hasta);
  for (let i = 1; i < v.length; i++) assert.ok(v[i].desde > v[i - 1].hasta, 'dos contratos no pueden cubrir la misma fecha');
});

test('codigoDelItem: nombre exacto sin tildes ni mayúsculas; un parecido NO cuenta', () => {
  assert.equal(codigoDelItem('Relé Buchholz'), 'S20');
  assert.equal(codigoDelItem('  rele   BUCHHOLZ '), 'S20');
  assert.equal(codigoDelItem('Relé buccholz · Relé EB 050 A (4 HUECOS) · CEDASPE'), '');
  assert.equal(codigoDelItem('Coraza · Liquid tigh ½ “x 100 mts'), '');
});

test('unidadComparable: UND = Und, Mts = Mt, GL = Gal', () => {
  assert.equal(unidadComparable('UND'), unidadComparable('Und'));
  assert.equal(unidadComparable('Mts'), unidadComparable('Mt'));
  assert.equal(unidadComparable('GL'), unidadComparable('Gal'));
  assert.notEqual(unidadComparable('Kg'), unidadComparable('UND'));
});

test('calcularNexo: suma cantidades y dinero por ítem y por transformador', () => {
  const r = nexo([orden({ items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 4), it('Relé Buchholz', 'UND', 1)] }),
                  orden({ numero: 'N2', transformador: 'TX-2 · S/E BETA', zona: 'ORIENTE', items: [it('Motoventiladores Tipo 1 FN-063', 'UND', 2)] })]);
  assert.equal(r.activo, true);
  assert.equal(r.porItem.S03.cantidad, 6);
  assert.equal(r.porItem.S03.valor, 6000);
  assert.equal(r.totalValor, 6500);
  assert.equal(r.lineas, 3);
  assert.equal(r.ordenesQueCuentan, 2);
  assert.deepEqual(r.transformadores.map((t) => [t.matricula, t.valor]), [['TX-1', 4500], ['TX-2', 2000]]);
  assert.deepEqual(r.zonas.map((z) => [z.zona, z.valor]), [['BOLIVAR', 4500], ['ORIENTE', 2000]]);
});

test('solo cuentan las ENTRADA: una SALIDA no descuenta y se informa', () => {
  const r = nexo([orden({ tipo: 'SALIDA', items: [it('Relé Buchholz', 'UND', 1)] })]);
  assert.equal(r.totalValor, 0);
  assert.equal(r.noCuentan.ordenes.otroTipo, 1);
});

test('fuera de la vigencia del pedido (o sin fecha) no cuenta', () => {
  const r = nexo([orden({ fechaISO: '2025-12-22', items: [it('Relé Buchholz', 'UND', 1)] }),
                  orden({ fechaISO: '2026-12-23', items: [it('Relé Buchholz', 'UND', 1)] }),
                  orden({ fechaISO: '', items: [it('Relé Buchholz', 'UND', 1)] }),
                  orden({ fechaISO: '2025-12-23', items: [it('Relé Buchholz', 'UND', 1)] })]);
  assert.equal(r.noCuentan.ordenes.fueraDeVigencia, 3);
  assert.equal(r.porItem.S20.cantidad, 1, 'el primer día de la vigencia sí cuenta');
});

test('Bodega Membrillal y los Krenz no cuentan: se informan en cantidad, sin pesos', () => {
  const r = nexo([orden({ items: [it('Coraza · Liquid tigh ½ “x 100 mts', 'Mts', 30), it('Motoventilador Trifasico F20 marca Krenz (URE)', 'UND', 2)] })]);
  assert.equal(r.totalValor, 0);
  assert.equal(r.noCuentan.ordenes.sinItems, 1);
  assert.equal(r.noCuentan.materiales.length, 2);
  assert.ok(r.noCuentan.materiales.every((m) => !('valor' in m)));
  assert.ok(r.noCuentan.materiales.some((m) => /URE/.test(m.motivo)));
});

test('unidad distinta a la del contrato no se suma (nunca se mezclan unidades)', () => {
  const r = nexo([orden({ items: [it('Silica Gel por Kg', 'UND', 3)] })]);
  assert.equal(r.porItem.S11, undefined);
  assert.match(r.noCuentan.materiales[0].motivo, /unidad/);
});

test('decimales en kilos y metros sí cuentan', () => {
  const r = nexo([orden({ items: [it('Silica Gel por Kg', 'Kg', 2.5)] }), orden({ numero: 'N2', items: [it('Silica Gel por Kg', 'Kg', 0.25)] })]);
  assert.equal(r.porItem.S11.cantidad, 2.75);
  assert.equal(r.porItem.S11.valor, 27.5);
});

test('cantidad cero, negativa o vacía no cuenta', () => {
  const r = nexo([orden({ items: [it('Relé Buchholz', 'UND', 0), it('Relé Buchholz', 'UND', -2), it('Relé Buchholz', 'UND', '')] })]);
  assert.equal(r.totalValor, 0);
  assert.equal(r.noCuentan.materiales.length, 1);
});

test('el mismo transformador escrito con y sin tilde es UN solo grupo', () => {
  const r = nexo([orden({ transformador: 'TX-9 · S/E CURUMANÍ', items: [it('Relé Buchholz', 'UND', 1)] }),
                  orden({ numero: 'N2', transformador: 'tx-9 · S/E Curumani', items: [it('Relé Buchholz', 'UND', 1)] })]);
  assert.equal(r.transformadores.length, 1);
  assert.equal(r.transformadores[0].items[0].cantidad, 2);
  assert.equal(r.transformadores[0].ordenes.length, 2);
  assert.equal(claveTransformador('TX-9 · S/E CURUMANÍ'), claveTransformador('tx-9 · s/e curumani'));
});

test('orden sin transformador: va a su propio grupo, rotulado', () => {
  const r = nexo([orden({ transformador: '', items: [it('Relé Buchholz', 'UND', 1)] })]);
  assert.equal(r.transformadores[0].matricula, SIN_TRANSFORMADOR);
});

test('ítem del contrato que el catálogo cargado no trae: no cuenta y se dice por qué', () => {
  const r = nexo([orden({ items: [it('Buje 66/110 KV', 'UND', 1)] })]);
  assert.equal(r.totalValor, 0);
  assert.match(r.noCuentan.materiales[0].motivo, /catálogo/);
});

test('editar o eliminar una orden cambia la cifra (es un cálculo, no una copia)', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 1)] });
  assert.equal(nexo([o]).totalValor, 500);
  assert.equal(nexo([{ ...o, items: [it('Relé Buchholz', 'UND', 3)] }]).totalValor, 1500);
  assert.equal(nexo([]).totalValor, 0);
});

test('aviso de doble registro: egreso del mismo ítem al mismo transformador también por movimiento', () => {
  const o = orden({ items: [it('Relé Buchholz', 'UND', 1)] });
  const sin = nexo([o], { movimientos: [{ tipo: 'EGRESO', suministro_id: 'S20', matricula: 'TX-2', subestacion: 'BETA' }] });
  assert.equal(sin.avisos.length, 0);
  const con = nexo([o], { movimientos: [{ tipo: 'EGRESO', suministro_id: 'S20', matricula: 'tx-1', subestacion: 'Alfa' }] });
  assert.equal(con.avisos.length, 1);
  assert.match(con.avisos[0], /doble registro/);
});

test('contrato sin nexo (o sin id): apagado y en cero', () => {
  const r = calcularNexo({ ordenes: [orden({ items: [it('Relé Buchholz', 'UND', 1)] })], catalogo: CAT, contratoId: '4123000081' });
  assert.equal(r.activo, false);
  assert.equal(r.totalValor, 0);
  assert.equal(calcularNexo().activo, false);
});

test('existenciaConOrdenes: descuenta lo entregado por órdenes además de los egresos', () => {
  assert.deepEqual(existenciaConOrdenes({ inicial: 73, ingresado: 0, egresado: 0, actual: 73 }, 36),
    { inicial: 73, ingresado: 0, egresadoMovimientos: 0, entregadoOrdenes: 36, egresado: 36, actual: 37 });
  assert.equal(existenciaConOrdenes({ inicial: 5, ingresado: 2, egresado: 1 }, 2.5).actual, 3.5);
  assert.equal(existenciaConOrdenes({ inicial: 5 }, -3).actual, 5, 'un valor negativo no suma');
});

// Revisión adversarial (10-07): órdenes sin transformador y zonas.
test('órdenes sin transformador: un grupo por zona, y no cuentan como transformador en la zona', () => {
  const r = nexo([orden({ transformador: '', zona: 'BOLIVAR', items: [it('Relé Buchholz', 'UND', 2)] }),
                  orden({ numero: 'N2', transformador: '', zona: 'ORIENTE', items: [it('Relé Buchholz', 'UND', 1)] }),
                  orden({ numero: 'N3', transformador: 'TX-5 · S/E GAMMA', zona: 'ORIENTE', items: [it('Relé Buchholz', 'UND', 1)] })]);
  assert.equal(r.transformadores.filter((t) => t.matricula === SIN_TRANSFORMADOR).length, 2);
  assert.deepEqual(r.zonas.map((z) => [z.zona, z.valor, z.transformadores]), [['BOLIVAR', 1000, 0], ['ORIENTE', 1000, 1]]);
});

test('un egreso sin matrícula no dispara un aviso de doble registro contra órdenes sin transformador', () => {
  const r = nexo([orden({ transformador: '', items: [it('Relé Buchholz', 'UND', 1)] })],
    { movimientos: [{ tipo: 'EGRESO', suministro_id: 'S20', matricula: '', subestacion: '' }] });
  assert.equal(r.avisos.length, 0);
});
