// «Dónde se instaló» cada accesorio del contrato (99 §238). Pedido del Ingeniero (2026-11-27): «al seleccionar
// cualquier accesorio en el dashboard me indique dónde y cuántas cantidades han sido instalados».
// SOLO datos INVENTADOS (repositorio público): códigos S0x, matrículas TX-n, subestaciones ALFA/BETA/GAMMA,
// órdenes 9xxx y movimientos MOV-2026-9xxx.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instalacionesDeItem, fechaDeMovimiento, fechaColombia, aMs } from '../assets/js/domain/suministros_instalaciones.js';
import { htmlDetalle, textoResumen, estadoOrdenes, fmtCant } from '../assets/js/ui/suministros-instalaciones.js';
import { calcularNexo, existenciaConOrdenes, NEXO_CONTRATOS } from '../assets/js/domain/ordenes_contrato_nexo.js';
import { planificarSincronizacion } from '../assets/js/domain/ordenes_movimientos_registro.js';
import { computarStockDesdeMovimientos } from '../assets/js/domain/stock_calculo.js';
import { sanitizarMovimiento } from '../assets/js/domain/movimiento_schema.js';

// ── Datos inventados ──
const CID = '4125000143';        // el contrato con nexo (su vigencia la fija NEXO_CONTRATOS)
const CID_SIN_NEXO = '4123000081';
const CAT = [
  { codigo: 'S03', nombre: 'Motoventiladores Tipo 1 FN-063', unidad: 'Und', valor_unitario: 1000, stock_inicial: 40, marcas_disponibles: [] },
  { codigo: 'S05', nombre: 'Motoventiladores Tipo 3', unidad: 'Und', valor_unitario: 900, stock_inicial: 3, marcas_disponibles: [] },
  { codigo: 'S11', nombre: 'Silica Gel por Kg', unidad: 'Kg', valor_unitario: 10, stock_inicial: 50, marcas_disponibles: [] },
  { codigo: 'S20', nombre: 'Relé Buchholz', unidad: 'Und', valor_unitario: 500, stock_inicial: 5, marcas_disponibles: [] }
];
const PARQUE = [
  { id: 'doc-tx1', identificacion: { matricula: 'TX-1' }, ubicacion: { subestacion_nombre: 'ALFA', zona: 'BOLIVAR', departamento: 'bolivar' } },
  { id: 'doc-tx2', identificacion: { matricula: 'TX-2' }, ubicacion: { subestacion_nombre: 'BETA', zona: 'ORIENTE', departamento: 'cesar' } },
  { id: 'doc-tx3', identificacion: { matricula: 'TX-3' }, ubicacion: { subestacion_nombre: 'GAMMA', zona: 'OCCIDENTE', departamento: 'cordoba' } }
];
const it = (descripcion, unidad, cantidad) => ({ codigo: '', descripcion, unidad, cantidad });
const S03 = (q) => it('Motoventiladores Tipo 1 FN-063', 'UND', q);
const orden = (numero, o) => ({ clave: 'ENTRADA_' + numero, tipo: 'ENTRADA', numero, fechaISO: '2026-03-01', creadoEn: 111, version: 1,
  zona: 'BOLIVAR', transformador: 'TX-1 · S/E ALFA', items: [S03(1)], ...o });

const O1 = orden('9001', { fechaISO: '2026-03-01', items: [S03(3)] });                                   // registrada
const O2 = orden('9002', { fechaISO: '2026-04-10', transformador: 'TX-2 · S/E BETA', zona: 'ORIENTE', items: [S03(4)] });
const O3 = orden('9003', { fechaISO: '2026-05-05', items: [S03(2)] });                                   // mismo TX-1
const O4 = orden('9004', { fechaISO: '2026-05-20', transformador: '', zona: 'ORIENTE', items: [S03(1)] });  // sin transformador
const O5 = orden('9005', { fechaISO: '2026-06-01', transformador: 'TX-9 · S/E OMEGA', items: [it('Relé Buchholz', 'UND', 1)] });
const O6 = orden('9006', { tipo: 'SALIDA', clave: 'SALIDA_9006', items: [S03(5)] });                    // SALIDA: no cuenta
const ORDENES = [O1, O2, O3, O4, O5, O6];

/** El movimiento enlazado que deja el registro automático para una orden (como en producción). */
function registrado(o, codigo) {
  const nx = calcularNexo({ ordenes: [o], catalogo: CAT, contratoId: CID, movimientos: [] });
  const p = planificarSincronizacion({ nexo: nx, parque: PARQUE, catalogo: CAT, contratoId: CID }).porRegistrar[0];
  return { id: p.docId, ...sanitizarMovimiento({ ...p.payload, codigo }) };
}
const mov = (o) => ({ id: 'man-' + o.codigo, contrato_id: CID, tipo: 'EGRESO', suministro_id: 'S03', cantidad: 1,
  matricula: 'TX-3', transformador_id: 'doc-tx3', subestacion: 'GAMMA', zona: 'OCCIDENTE', departamento: 'cordoba', ...o });

const MOVS = [
  registrado(O1, 'MOV-2026-9001'),
  mov({ codigo: 'MOV-2026-9101', cantidad: 2, fecha_entrega: '2026-02-15', odt: '9555' }),
  mov({ codigo: 'MOV-2026-9102', tipo: 'INGRESO', cantidad: 6, matricula: '', transformador_id: '', subestacion: '', zona: '', departamento: '' }),
  mov({ codigo: 'MOV-2026-9103', cantidad: 0 }),                                                       // cero: la tabla no lo cuenta
  mov({ codigo: 'MOV-2026-9104', suministro_id: 'S11', cantidad: 0.1, matricula: 'TX-2', subestacion: 'BETA', zona: 'ORIENTE', departamento: 'cesar', fecha_entrega: '2026-07-01' }),
  mov({ codigo: 'MOV-2026-9105', suministro_id: 'S11', cantidad: 0.2, matricula: 'TX-2', subestacion: 'BETA', zona: 'ORIENTE', departamento: 'cesar', fecha_entrega: '2026-07-02' })
];

/**
 * El tablero, con las MISMAS cuentas de data/movimientos.js (stock por movimientos) y de `recomputarTodo` en
 * suministros-dashboard-public.js (+ lo pendiente del nexo). La prueba de amarre del final comprueba que esas
 * líneas sigan así en el código del tablero: si cambian, esta copia queda vieja y la prueba lo delata.
 */
function tablero({ catalogo = CAT, movimientos = MOVS, ordenes = ORDENES, contratoId = CID } = {}) {
  const bySum = new Map();
  for (const m of movimientos) { if (!bySum.has(m.suministro_id)) bySum.set(m.suministro_id, []); bySum.get(m.suministro_id).push(m); }
  const cat = catalogo.map((s) => ({ ...s, stock: computarStockDesdeMovimientos(s.stock_inicial, bySum.get(s.codigo) || []) }));
  const nexo = NEXO_CONTRATOS[contratoId] && ordenes ? calcularNexo({ ordenes, catalogo: cat, contratoId, movimientos }) : null;
  const pend = nexo ? (nexo.porItemPendiente || nexo.porItem || {}) : {};
  const filas = cat.map((r) => ({ ...r, stock: existenciaConOrdenes(r.stock, pend[r.codigo] ? pend[r.codigo].cantidad : 0) }));
  return { filas, nexo };
}
const detalle = (codigo, extra = {}) => {
  const { filas, nexo } = tablero(extra);
  const item = filas.find((r) => r.codigo === codigo);
  return instalacionesDeItem({ codigo, item, movimientos: extra.movimientos || MOVS, nexo, parque: 'parque' in extra ? extra.parque : PARQUE,
    egresadoTabla: item.stock.egresado });
};

// ── Cuadre con la tabla ──
test('cada ítem cuadra EXACTO con −Egresos de la tabla (movimientos + por registrar), también la suma por transformador', () => {
  const { filas, nexo } = tablero();
  for (const r of filas) {
    const d = instalacionesDeItem({ codigo: r.codigo, item: r, movimientos: MOVS, nexo, parque: PARQUE, egresadoTabla: r.stock.egresado });
    assert.equal(d.total, r.stock.egresado, `${r.codigo}: total`);
    assert.ok(d.cuadre.cuadra, `${r.codigo}: cuadre`);
    const suma = Number(d.filas.reduce((s, f) => s + f.cantidad, 0).toFixed(3));
    assert.equal(suma, r.stock.egresado, `${r.codigo}: suma de filas`);
  }
});

test('S03: total, registrado, por registrar, transformadores y subestaciones', () => {
  const d = detalle('S03');
  assert.equal(d.total, 12);                   // 3 (orden registrada) + 2 (manual) + 4 + 2 + 1 (por registrar)
  assert.equal(d.registrado, 5);
  assert.equal(d.porRegistrar, 7);
  assert.equal(d.transformadores, 3);          // TX-1, TX-2, TX-3; lo que no indica transformador no cuenta
  assert.equal(d.subestaciones, 3);
  assert.equal(d.sinTransformador, 1);
  assert.equal(d.unidad, 'Und');
});

test('filas: la más útil primero (más unidades, luego la más reciente) y lo sin transformador al final', () => {
  const d = detalle('S03');
  assert.deepEqual(d.filas.map((f) => [f.matricula, f.cantidad]), [['TX-1', 5], ['TX-2', 4], ['TX-3', 2], ['', 1]]);
  const [tx1, tx2, tx3, sin] = d.filas;
  // TX-1: la entrega registrada y la por registrar se juntan en el MISMO transformador.
  assert.equal(tx1.estado, 'mixto');
  assert.equal(tx1.registrado, 3);
  assert.equal(tx1.porRegistrar, 2);
  // Una entrega por línea, de la más antigua a la más reciente, con su orden, su movimiento y su cantidad.
  assert.deepEqual(tx1.entregas.map((e) => [e.fecha, e.orden.numero, e.movimiento, e.cantidad, e.estado]),
    [['2026-03-01', '9001', 'MOV-2026-9001', 3, 'registrado'], ['2026-05-05', '9003', '', 2, 'por_registrar']]);
  assert.equal(tx1.fechaReciente, '2026-05-05');
  // TX-2: todo por registrar; zona y departamento salen del PARQUE, no de la orden.
  assert.equal(tx2.estado, 'por_registrar');
  assert.equal(tx2.ubicacion, 'parque');
  assert.equal(tx2.subestacion, 'BETA');
  assert.equal(tx2.zona, 'ORIENTE');
  assert.equal(tx2.departamento, 'cesar');
  assert.deepEqual(tx2.entregas.map((e) => e.movimiento), ['']);
  // TX-3: movimiento manual, con su ODT y su fecha de entrega.
  assert.equal(tx3.estado, 'registrado');
  assert.deepEqual(tx3.entregas.map((e) => [e.fecha, e.deRegistro, e.odt, e.movimiento, e.orden]),
    [['2026-02-15', false, '9555', 'MOV-2026-9101', null]]);
  // La orden sin transformador: su propia fila, al final.
  assert.equal(sin.sinTransformador, true);
  assert.equal(sin.zona, 'ORIENTE');
});

test('desempate por fecha: con las mismas unidades va primero la entrega más reciente', () => {
  const movs = [
    mov({ codigo: 'MOV-2026-9201', cantidad: 2, matricula: 'TX-1', subestacion: 'ALFA', fecha_entrega: '2026-01-10' }),
    mov({ codigo: 'MOV-2026-9202', cantidad: 2, matricula: 'TX-2', subestacion: 'BETA', fecha_entrega: '2026-08-10' })
  ];
  const d = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: movs, nexo: null });
  assert.deepEqual(d.filas.map((f) => f.matricula), ['TX-2', 'TX-1']);
});

test('los INGRESOS no son instalaciones: se informan aparte', () => {
  const d = detalle('S03');
  assert.deepEqual(d.ingresos, { movimientos: 1, cantidad: 6, codigos: ['MOV-2026-9102'] });
  assert.ok(!d.filas.some((f) => f.entregas.some((e) => e.movimiento === 'MOV-2026-9102')));
  const h = htmlDetalle(d, 'ok');
  assert.match(h, /1 ingreso al inventario por 6 Und \(MOV-2026-9102\)/);
  assert.match(h, /Los ingresos no son instalaciones/);
});

test('las SALIDAS no cuentan y un egreso con cantidad 0 tampoco (como la tabla)', () => {
  const d = detalle('S03');
  assert.ok(!d.filas.some((f) => f.entregas.some((e) => e.orden && e.orden.numero === '9006')));
  assert.ok(!d.filas.some((f) => f.entregas.some((e) => e.movimiento === 'MOV-2026-9103')));
});

test('sin parque leído (o sin hallarlo), la ubicación de lo por registrar sale del campo transformador de la orden', () => {
  const d = detalle('S20');
  assert.equal(d.total, 1);
  assert.equal(d.filas[0].matricula, 'TX-9');
  assert.equal(d.filas[0].subestacion, 'OMEGA');
  assert.equal(d.filas[0].ubicacion, 'orden');
  assert.match(htmlDetalle(d, 'ok'), /según la orden \(no se halló en el parque\)/);
  const sinParque = detalle('S03', { parque: null });
  assert.equal(sinParque.total, 12, 'el total no depende del parque');
  assert.equal(sinParque.filas.find((f) => f.matricula === 'TX-2').ubicacion, 'orden');
});

test('decimales (kg): 0,1 + 0,2 = 0,3 sin restos de coma flotante', () => {
  const d = detalle('S11');
  assert.equal(d.total, 0.3);
  assert.equal(d.filas[0].cantidad, 0.3);
  assert.equal(d.unidad, 'Kg');
  assert.ok(d.cuadre.cuadra);
  assert.equal(fmtCant(0.3), '0,3');
});

test('ítem sin instalaciones: la frase exacta, sin tabla', () => {
  const d = detalle('S05');
  assert.equal(d.total, 0);
  assert.equal(d.filas.length, 0);
  const h = htmlDetalle(d, 'ok');
  assert.match(h, /Todavía no se ha instalado ninguna unidad de este accesorio en este contrato\./);
  assert.doesNotMatch(h, /<table/);
});

test('contrato SIN nexo (4123000081): solo movimientos, sin «por registrar»', () => {
  const movs = MOVS.map((m) => ({ ...m, contrato_id: CID_SIN_NEXO }));
  const { filas, nexo } = tablero({ movimientos: movs, contratoId: CID_SIN_NEXO });
  assert.equal(nexo, null);
  const r = filas.find((x) => x.codigo === 'S03');
  const d = instalacionesDeItem({ codigo: 'S03', item: r, movimientos: movs, nexo, parque: null, egresadoTabla: r.stock.egresado });
  assert.equal(d.total, 5);
  assert.equal(d.porRegistrar, 0);
  assert.ok(d.cuadre.cuadra);
  const est = estadoOrdenes({ contratoId: CID_SIN_NEXO, ordenes: null, nexo: null });
  assert.equal(est, 'sin_nexo');
  const h = htmlDetalle(d, est);
  assert.doesNotMatch(h, /Por registrar \(según/);
  assert.match(h, /no se cruza con las órdenes/);
});

test('estado de las órdenes: leyendo, error y listo', () => {
  assert.equal(estadoOrdenes({ contratoId: CID, ordenes: null, nexo: null }), 'leyendo');
  assert.equal(estadoOrdenes({ contratoId: CID, ordenes: { error: 'sin red' }, nexo: null }), 'error');
  const { nexo } = tablero();
  assert.equal(estadoOrdenes({ contratoId: CID, ordenes: { ordenes: ORDENES }, nexo }), 'ok');
});

test('fecha de entrega: la del movimiento; si no la trae, el día del registro en hora de Colombia', () => {
  assert.deepEqual(fechaDeMovimiento({ fecha_entrega: '2026-02-15' }), { fecha: '2026-02-15', deRegistro: false });
  // 03:00 UTC del 2 de marzo = 22:00 del 1 de marzo en Colombia.
  const ts = { seconds: Date.UTC(2026, 2, 2, 3, 0, 0) / 1000, nanoseconds: 0 };
  assert.deepEqual(fechaDeMovimiento({ createdAt: ts }), { fecha: '2026-03-01', deRegistro: true });
  assert.deepEqual(fechaDeMovimiento({}), { fecha: '', deRegistro: false });
  assert.equal(aMs({ toMillis: () => 5 }), 5);
  assert.equal(fechaColombia(0), '');
  const d = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [mov({ codigo: 'MOV-2026-9301', createdAt: ts })] });
  // Sin fecha de entrega no se hace pasar el día del registro por la fecha de entrega.
  assert.match(htmlDetalle(d, 'sin_nexo'), /se registró el 01\/03\/2026 <span class="inst-sub">\(no trae fecha de entrega\)<\/span>/);
});

test('avisos: entrega desfasada (la orden cambió) y movimiento que la orden ya no respalda', () => {
  const m1 = registrado(O1, 'MOV-2026-9001');
  const editada = { ...O1, version: 2, items: [S03(5)] };                        // 3 → 5 después de registrar
  const d1 = detalle('S03', { movimientos: [m1], ordenes: [editada] });
  const f1 = d1.filas.find((f) => f.matricula === 'TX-1');
  assert.ok(f1.avisos.includes('desfasado'));
  assert.equal(d1.total, 5, 'lo registrado (3) + lo que falta según la orden (2)');
  assert.ok(d1.cuadre.cuadra);
  assert.match(htmlDetalle(d1, 'ok'), /La orden cambió después de registrarse/);
  const d2 = detalle('S03', { movimientos: [m1], ordenes: [] });                 // la orden ya no existe
  assert.ok(d2.filas[0].avisos.includes('huerfano'));
  assert.equal(d2.total, 3, 'sigue contando como movimiento, igual que en la tabla');
  assert.ok(d2.cuadre.cuadra);
});

test('nexo viejo en caché sin detalle por línea: se sabe cuánto falta, no dónde (y el total sigue cuadrando)', () => {
  const { filas, nexo } = tablero();
  const viejo = { activo: true, porItemPendiente: nexo.porItemPendiente };
  const r = filas.find((x) => x.codigo === 'S03');
  const d = instalacionesDeItem({ codigo: 'S03', item: r, movimientos: MOVS, nexo: viejo, egresadoTabla: r.stock.egresado });
  assert.equal(d.sinDesglose, 7);
  assert.equal(d.total, 12);
  assert.ok(d.cuadre.cuadra);
  assert.match(htmlDetalle(d, 'ok'), /recargue la página para verlo/);
});

test('si no cuadra con la tabla, el detalle lo dice (no se esconde)', () => {
  const d = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [mov({ codigo: 'MOV-2026-9401', cantidad: 2 })], egresadoTabla: 3 });
  assert.equal(d.cuadre.cuadra, false);
  assert.match(htmlDetalle(d, 'sin_nexo'), /no coincide con la columna −Egresos/);
});

test('HTML del detalle: título, resumen, tabla accesible y texto escapado', () => {
  const d = detalle('S03');
  const h = htmlDetalle(d, 'ok');
  assert.match(h, /Dónde se instaló · <code>S03<\/code> Motoventiladores Tipo 1 FN-063/);
  // Cada cifra con lo suyo: 11 en transformadores y 1 de la orden que no indica transformador (99 §238, R1).
  assert.match(h, /Total instalado: <b>12 Und<\/b>: <b>11 Und<\/b> en <b>3<\/b> transformadores de <b>3<\/b> subestaciones y <b>1 Und<\/b> sin transformador indicado\./);
  assert.match(h, /Registrado en Movimientos: <b>5 Und<\/b> · Por registrar \(según las órdenes de entrada\): <b>7 Und<\/b>/);
  assert.match(h, /<caption class="inst-sr">/);
  for (const c of ['Subestación', 'Transformador', 'Zona / Depto.', 'Cantidad', 'Entregas', 'Estado']) {
    assert.match(h, new RegExp(`<th role="columnheader" scope="col"[^>]*>${c.replace('.', '\\.')}( <span|</th>)`), c);
  }
  assert.equal((h.match(/role="columnheader"/g) || []).length, 6);
  assert.match(h, /<td role="cell" colspan="2">/, 'el pie ocupa las 6 columnas (3 + 1 + 2)');
  assert.match(h, /<th role="rowheader" scope="row" data-etiqueta="Transformador"><div class="inst-val"><code>TX-1<\/code>/);
  assert.match(h, /ENTRADA N\.º 9001/);
  assert.match(h, /<span class="inst-fecha">15\/02\/2026<\/span> · ODT 9555 · <code>MOV-2026-9101<\/code><\/li>/);
  assert.match(h, /igual a la columna −Egresos/);
  assert.match(h, /aria-labelledby="instTitulo"/);
  const malo = instalacionesDeItem({ codigo: 'S03', item: { ...CAT[0], nombre: '<img src=x onerror=alert(1)>' },
    movimientos: [mov({ codigo: 'MOV-2026-9501', matricula: '<b>TX</b>', subestacion: '"><script>' })] });
  const hm = htmlDetalle(malo, 'sin_nexo');
  assert.doesNotMatch(hm, /<img|<script|<b>TX/);
  assert.match(hm, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('resumen para el anuncio (lectores de pantalla)', () => {
  assert.equal(textoResumen(detalle('S03'), 'ok'),
    'S03: total instalado 12 Und: 11 Und en 3 transformadores de 3 subestaciones y 1 Und sin transformador indicado. ' +
    'Registrado en Movimientos: 5 Und. Por registrar: 7 Und.');
  assert.equal(textoResumen(detalle('S05'), 'ok'), 'Todavía no se ha instalado ninguna unidad de S05 en este contrato.');
  const uno = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [mov({ codigo: 'MOV-2026-9601' })] });
  assert.equal(textoResumen(uno, 'sin_nexo'), 'S03: total instalado 1 Und en 1 transformador de 1 subestación. Registrado en Movimientos: 1 Und.');
});

// ── Revisión 1 (99 §238): cifras del resumen, ubicación de lo por registrar, una línea por entrega ──
test('resumen: si una parte no indica transformador, cada cifra va con lo suyo (visible y anuncio)', () => {
  const d = instalacionesDeItem({ codigo: 'S03', item: CAT[0], egresadoTabla: 12, movimientos: [
    mov({ codigo: 'MOV-2026-9701', cantidad: 11, matricula: 'TX-1', subestacion: 'ALFA' }),
    mov({ codigo: 'MOV-2026-9702', cantidad: 1, matricula: '', transformador_id: '', subestacion: '' })] });
  assert.equal(d.enTransformadores, 11);
  assert.equal(d.sinTransformador, 1);
  assert.match(htmlDetalle(d, 'sin_nexo'),
    /Total instalado: <b>12 Und<\/b>: <b>11 Und<\/b> en <b>1<\/b> transformador de <b>1<\/b> subestación y <b>1 Und<\/b> sin transformador indicado\./);
  assert.equal(textoResumen(d, 'sin_nexo'),
    'S03: total instalado 12 Und: 11 Und en 1 transformador de 1 subestación y 1 Und sin transformador indicado. Registrado en Movimientos: 12 Und.');
  // Todo sin transformador: no se cuenta dos veces.
  const sin = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [
    mov({ codigo: 'MOV-2026-9703', cantidad: 3, matricula: '', transformador_id: '', subestacion: '' })] });
  assert.match(htmlDetalle(sin, 'sin_nexo'), /Total instalado: <b>3 Und<\/b>, sin transformador indicado\./);
  assert.equal(textoResumen(sin, 'sin_nexo'), 'S03: total instalado 3 Und, sin transformador indicado. Registrado en Movimientos: 3 Und.');
});

test('resumen: un egreso sin subestación no dice «de 0 subestaciones»', () => {
  const uno = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [mov({ codigo: 'MOV-2026-9711', subestacion: '' })] });
  assert.equal(uno.transformadoresSinSubestacion, 1);
  assert.equal(textoResumen(uno, 'sin_nexo'),
    'S03: total instalado 1 Und en 1 transformador (sin subestación indicada). Registrado en Movimientos: 1 Und.');
  const dos = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [
    mov({ codigo: 'MOV-2026-9712', matricula: 'TX-1', subestacion: 'ALFA' }), mov({ codigo: 'MOV-2026-9713', matricula: 'TX-2', subestacion: '' })] });
  assert.match(htmlDetalle(dos, 'sin_nexo'), /en <b>2<\/b> transformadores de <b>1<\/b> subestación \(1 sin subestación indicada\)/);
  // Dos transformadores en la MISMA subestación no es «sin subestación».
  const misma = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [
    mov({ codigo: 'MOV-2026-9714', matricula: 'TX-1', subestacion: 'ALFA' }), mov({ codigo: 'MOV-2026-9715', matricula: 'TX-4', subestacion: 'ALFA' })] });
  assert.equal(textoResumen(misma, 'sin_nexo'), 'S03: total instalado 2 Und en 2 transformadores de 1 subestación. Registrado en Movimientos: 2 Und.');
});

test('sin nada por registrar: «Nada por registrar» a la vista y el anuncio no dice «Por registrar: 0»', () => {
  const movs = [registrado(O1, 'MOV-2026-9001')];
  const d = detalle('S03', { movimientos: movs, ordenes: [O1] });
  assert.equal(d.porRegistrar, 0);
  assert.match(htmlDetalle(d, 'ok'), /Registrado en Movimientos: <b>3 Und<\/b> · Nada por registrar\./);
  assert.equal(textoResumen(d, 'ok'), 'S03: total instalado 3 Und en 1 transformador de 1 subestación. Registrado en Movimientos: 3 Und.');
});

test('ubicación de lo por registrar: el rótulo dice por qué sale de la orden (leyendo, fallo, duplicado o no hallado)', () => {
  const html = (parque, parqueEstado) => {
    const { filas, nexo } = tablero();
    const r = filas.find((x) => x.codigo === 'S03');
    const d = instalacionesDeItem({ codigo: 'S03', item: r, movimientos: MOVS, nexo, parque, parqueEstado, egresadoTabla: r.stock.egresado });
    assert.ok(d.cuadre.cuadra, 'las cantidades cuadran sin importar el parque');
    return { d, h: htmlDetalle(d, 'ok') };
  };
  const leyendo = html(null, 'leyendo');
  assert.equal(leyendo.d.filas.find((f) => f.matricula === 'TX-2').motivoUbicacion, 'leyendo');
  assert.match(leyendo.h, /ubicación según la orden \(leyendo el parque…\)/);
  assert.match(html([], 'fallo').h, /ubicación según la orden \(no se pudo leer el parque\)/);
  const doble = [...PARQUE, { id: 'doc-tx2b', identificacion: { matricula: 'TX-2' }, ubicacion: { subestacion_nombre: 'BETA', zona: 'ORIENTE', departamento: 'cesar' } }];
  assert.match(html(doble, 'leido').h, /ubicación según la orden \(aparece más de una vez en el parque\)/);
  const sinTx2 = PARQUE.filter((t) => t.id !== 'doc-tx2');
  assert.match(html(sinTx2, 'leido').h, /ubicación según la orden \(no se halló en el parque\)/);
  // Con el parque leído, TX-2 sale del parque y no lleva rótulo.
  const ok = html(PARQUE, 'leido');
  assert.equal(ok.d.filas.find((f) => f.matricula === 'TX-2').ubicacion, 'parque');
  assert.doesNotMatch(ok.h, /<code>TX-2<\/code><div class="inst-sub">/);
  // Sin `parqueEstado` (tablero viejo en caché): una lista es parque leído; null, leyendo.
  assert.equal(instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: MOVS, nexo: tablero().nexo, parque: null })
    .filas.find((f) => f.matricula === 'TX-2').motivoUbicacion, 'leyendo');
});

test('orden sin «· S/E» y parque sin leer o fallido: lo por registrar se suma a la fila de esa matrícula (no se cuenta dos veces)', () => {
  const ordV1 = orden('9021', { fechaISO: '2026-03-01', transformador: 'TX-1', items: [S03(3)] });
  const m1 = registrado(ordV1, 'MOV-2026-9021');
  const ordV2 = { ...ordV1, version: 2, items: [S03(5)] };                       // 3 → 5 después de registrar
  for (const [parque, parqueEstado] of [[null, 'leyendo'], [[], 'fallo'], [PARQUE, 'leido']]) {
    const d = detalle('S03', { movimientos: [m1], ordenes: [ordV2], parque });
    const d2 = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [m1], nexo: tablero({ movimientos: [m1], ordenes: [ordV2] }).nexo,
      parque, parqueEstado, egresadoTabla: d.cuadre.tabla });
    for (const x of [d, d2]) {
      assert.equal(x.filas.length, 1, `${parqueEstado}: una sola fila`);
      assert.equal(x.transformadores, 1, `${parqueEstado}: un transformador`);
      assert.deepEqual([x.filas[0].matricula, x.filas[0].subestacion, x.filas[0].cantidad, x.filas[0].estado], ['TX-1', 'ALFA', 5, 'mixto']);
      assert.ok(x.cuadre.cuadra);
    }
  }
});

test('una línea por entrega: la orden antigua por registrar y la nueva registrada no se cruzan', () => {
  const O_NUEVA = orden('9033', { fechaISO: '2026-05-05', items: [S03(3)] });
  const O_VIEJA = orden('9031', { fechaISO: '2026-03-01', items: [S03(2)] });
  const m = registrado(O_NUEVA, 'MOV-2026-9036');
  const d = detalle('S03', { movimientos: [m], ordenes: [O_NUEVA, O_VIEJA] });
  const f = d.filas[0];
  assert.deepEqual(f.entregas.map((e) => [e.fecha, e.orden.numero, e.movimiento || '(sin)', e.cantidad, e.estado]),
    [['2026-03-01', '9031', '(sin)', 2, 'por_registrar'], ['2026-05-05', '9033', 'MOV-2026-9036', 3, 'registrado']]);
  const lineas = [...htmlDetalle(d, 'ok').matchAll(/<li class="inst-entrega">([\s\S]*?)<\/li>/g)].map((x) => x[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '));
  assert.deepEqual(lineas, [
    '01/03/2026 · ENTRADA N.º 9031 · aún sin movimiento · 2 Und · Por registrar',
    '05/05/2026 · ENTRADA N.º 9033 · MOV-2026-9036 · 3 Und · Registrado'
  ]);
  // 99 §238: la cifra y su unidad van unidas (no se parten en dos renglones).
  assert.match(htmlDetalle(d, 'ok'), /<b>2<\/b>&nbsp;Und/);
});

test('una línea por entrega: dos movimientos manuales cuyo número MOV no sigue el orden de las fechas', () => {
  const d = instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [
    mov({ codigo: 'MOV-2026-9802', cantidad: 4, fecha_entrega: '2026-01-20', odt: '9701' }),
    mov({ codigo: 'MOV-2026-9801', cantidad: 1, fecha_entrega: '2026-06-02', odt: '9702' })] });
  const lineas = [...htmlDetalle(d, 'sin_nexo').matchAll(/<li class="inst-entrega">([\s\S]*?)<\/li>/g)].map((x) => x[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '));
  assert.deepEqual(lineas, [
    '20/01/2026 · ODT 9701 · MOV-2026-9802 · 4 Und',
    '02/06/2026 · ODT 9702 · MOV-2026-9801 · 1 Und'
  ]);
  // Con una sola entrega no se repite la cantidad (ya está en su columna) ni el estado.
  const uno = htmlDetalle(instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: [mov({ codigo: 'MOV-2026-9803', fecha_entrega: '2026-02-01' })] }), 'sin_nexo');
  assert.match(uno, /<li class="inst-entrega"><span class="inst-fecha">01\/02\/2026<\/span> · <code>MOV-2026-9803<\/code><\/li>/);
});

test('el aviso de orden cambiada va en la entrega que lo tiene', () => {
  const m1 = registrado(O1, 'MOV-2026-9001');
  const d = detalle('S03', { movimientos: [m1], ordenes: [{ ...O1, version: 2, items: [S03(5)] }] });
  const lis = [...htmlDetalle(d, 'ok').matchAll(/<li class="inst-entrega">([\s\S]*?)<\/li>/g)].map((x) => x[1]);
  assert.equal(lis.length, 2);
  assert.match(lis.find((x) => x.includes('MOV-2026-9001')), /La orden cambió después de registrarse/);
  assert.doesNotMatch(lis.find((x) => x.includes('aún sin movimiento')), /inst-aviso/);
});

test('botón de cerrar abajo desde 3 transformadores (en celular las fichas son altas)', () => {
  const movs = (n) => Array.from({ length: n }, (_, i) => mov({ codigo: 'MOV-2026-99' + String(i).padStart(2, '0'), matricula: 'TX-' + (i + 1), subestacion: 'S' + i }));
  const pie = (n) => /class="inst-pie"/.test(htmlDetalle(instalacionesDeItem({ codigo: 'S03', item: CAT[0], movimientos: movs(n) }), 'sin_nexo'));
  assert.equal(pie(2), false);
  assert.equal(pie(3), true);
});

// ── Amarres con el tablero (carga perezosa, JS viejo en caché) ──
test('amarre: el tablero carga el detalle perezoso, comprueba que exista y repinta al pintar la tabla', () => {
  const src = readFileSync(new URL('../assets/js/suministros-dashboard-public.js', import.meta.url), 'utf8');
  assert.match(src, /import\(['"]\.\/ui\/suministros-instalaciones\.js['"]\)/, 'import() perezoso: si falla, la tabla sigue');
  assert.match(src, /typeof m\.crearDetalleInstalaciones !== 'function'/, 'comprueba que la función exista (módulo viejo en caché)');
  assert.doesNotMatch(src, /^import[^;]*suministros-instalaciones/m, 'sin import estático: un módulo que falta no tumba el tablero');
  assert.match(src, /<tr data-codigo="\$\{escHtml\(r\.codigo\)\}">/, 'cada fila de ítem lleva su código');
  assert.match(src, /instalaciones\.alPintarTabla\(\)/, 'el detalle abierto se repinta con los datos nuevos');
  assert.match(src, /99 §238/);
  const html = readFileSync(new URL('../pages/suministros-dashboard.html', import.meta.url), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="\.\.\/assets\/css\/suministros-instalaciones\.css"\/>/);
  const ui = readFileSync(new URL('../assets/js/ui/suministros-instalaciones.js', import.meta.url), 'utf8');
  assert.match(ui, /suministros-instalaciones\.css/, 'con el HTML viejo en caché, el módulo enlaza su hoja de estilo');
  assert.match(ui, /aria-expanded/);
  assert.match(ui, /aria-live/);
  assert.match(src, /parqueEstado: parqueFallo \? 'fallo' : \(parqueNexo === null \? 'leyendo' : 'leido'\)/,
    'el tablero dice si el parque se está leyendo o falló (para el rótulo de la ubicación)');
});

test('amarre: −Egresos del tablero se calcula como en la copia de esta prueba (si cambia la fórmula, falla aquí)', () => {
  // Esta prueba no importa el tablero (necesita el navegador y Firebase): compara su código con la copia `tablero()`.
  const src = readFileSync(new URL('../assets/js/suministros-dashboard-public.js', import.meta.url), 'utf8');
  const rec = src.slice(src.indexOf('function recomputarTodo()'), src.indexOf('autoRegistrar();', src.indexOf('function recomputarTodo()')));
  assert.ok(rec.length > 0, 'recomputarTodo existe');
  assert.match(rec, /const base = r\._stockMov \|\| r\.stock \|\|/, 'la base es el stock por movimientos');
  assert.match(rec, /const pend = nexo \? \(nexo\.porItemPendiente \|\| nexo\.porItem \|\| \{\}\) : \{\};/, 'lo pendiente del nexo');
  assert.match(rec, /const ent = pend\[r\.codigo\] \? pend\[r\.codigo\]\.cantidad : 0;/);
  assert.match(rec, /stock: existenciaConOrdenes\(base, ent\)/, 'existencia = movimientos + órdenes por registrar');
  assert.match(rec, /_calc: calcularPorItem\(fila\)/);
  assert.match(src, /const \{ stock, est, pctRest \} = r\._calc;/, 'la tabla pinta el stock de _calc');
  assert.match(src, /−\$\{fmtInt\(stock\.egresado\)\}/, 'la columna −Egresos es stock.egresado');
  const ui = readFileSync(new URL('../assets/js/ui/suministros-instalaciones.js', import.meta.url), 'utf8');
  assert.match(ui, /const stock = \(item\._calc && item\._calc\.stock\) \|\| item\.stock \|\| \{\};/, 'el detalle compara con ese mismo número');
  const datos = readFileSync(new URL('../assets/js/data/movimientos.js', import.meta.url), 'utf8');
  assert.match(datos, /movsBySum\.get\(m\.suministro_id\)\.push\(m\)/, 'movimientos agrupados por suministro_id');
  assert.match(datos, /stock: computarStockDesdeMovimientos\(s\.stock_inicial, movsBySum\.get\(s\.codigo\) \|\| \[\]\)/);
});

test('amarre: estilos del detalle (fichas por ancho de la caja, contraste, etiquetas que no se leen dos veces)', () => {
  const css = readFileSync(new URL('../assets/css/suministros-instalaciones.css', import.meta.url), 'utf8');
  assert.match(css, /@container \(max-width: \d+px\)/, 'las fichas dependen del ancho de la caja, no de la pantalla');
  assert.doesNotMatch(css, /@media \(max-width/, 'sin consulta por ancho de pantalla para las fichas');
  assert.match(css, /content: attr\(data-etiqueta\);\s*content: attr\(data-etiqueta\) \/ "";/, 'etiqueta visible, muda para el lector');
  assert.match(css, /\.inst-tabla code \{[^}]*color: var\(--brand-deep\)/, 'matrícula y MOV con contraste AA');
  assert.match(css, /\.inst-tabla thead th \{ color: var\(--ink-3\) !important; \}/);
  const ui = readFileSync(new URL('../assets/js/ui/suministros-instalaciones.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /title="Ver dónde se instaló"/, 'sin title que repita el nombre del botón');
});
