// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Reglas del registro AUTOMÁTICO de entregas de Órdenes E/S (99 §148)
// ──────────────────────────────────────────────────────────────
// Decisión del Ingeniero: el equipo (no solo el admin) registra en Movimientos las
// entregas de las órdenes de ENTRADA del contrato con nexo. Estas pruebas fijan el
// MÍNIMO privilegio: un técnico solo crea el egreso enlazado a una orden real, con
// id fijo, valor del catálogo y el consecutivo del contador; solo retira uno cuando
// la orden ya no lo respalda; y el contador solo avanza de a uno. Todo lo demás de
// /movimientos sigue siendo del admin. Datos sintéticos (repositorio público).
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach, describe } from 'node:test';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, Timestamp
} from 'firebase/firestore';
import { calcularNexo } from '../assets/js/domain/ordenes_contrato_nexo.js';
import { planificarSincronizacion, diferenciaConOrden, cantidadDelItemEnOrden } from '../assets/js/domain/ordenes_movimientos_registro.js';
import { sanitizarMovimiento, validarMovimiento } from '../assets/js/domain/movimiento_schema.js';
import { generarCodigoMov } from '../assets/js/domain/schema.js';

const PROJECT_ID = 'demo-sgm-rules-mov';
const CID = '4125000143';
const CREADO = Timestamp.fromMillis(1767268800000);
let testEnv;

const PERFILES = {
  tecA:    { rol: 'tecnico', activo: true,  nombre: 'TECNICO A' },
  admin:   { rol: 'admin',   activo: true,  nombre: 'ADMIN UNO' },
  apagado: { rol: 'tecnico', activo: false, nombre: 'APAGADO' }
};

function orden(extra) {
  return Object.assign({
    clave: 'ENTRADA_100', tipo: 'ENTRADA', numero: '100', fechaISO: '2026-03-01',
    transformador: 'T-1 · S/E UNO', zona: 'ZONA-X',
    items: [{ descripcion: 'Motoventiladores Tipo 1 FN-063', unidad: 'UND', cantidad: 3 }],
    autorizado: { nombre: 'P1' }, entregado: { nombre: 'P2' }, recibido: { nombre: 'P3' },
    creadoPor: { uid: 'tecA', nombre: 'TECNICO A' }, creadoEn: CREADO,
    actualizadoPor: { uid: 'tecA', nombre: 'TECNICO A' }, actualizadoEn: CREADO, version: 2
  }, extra || {});
}

const ID = `oes_${CID}_ENTRADA_100_S03`;

function movimiento(uid, extra, enlaceExtra) {
  return Object.assign({
    codigo: 'MOV-2026-0019', tipo: 'EGRESO', suministro_id: 'S03', contrato_id: CID, anio: 2026,
    cantidad: 3, valor_unitario: 1234.56, valor_total: 3 * 1234.56,
    transformador_id: 'tx-1', matricula: 'T-1', subestacion: 'UNO', zona: 'ZONA-X', departamento: 'x',
    usuario: 'Órdenes E/S', observaciones: 'Entregado según orden', fecha_entrega: '2026-03-01', createdBy: uid,
    orden_es: Object.assign({ clave: 'ENTRADA_100', tipo: 'ENTRADA', numero: '100', fechaISO: '2026-03-01',
      creadoEn: CREADO.toMillis(), version: 2, cantidad: 3, transformador: 'T-1 · S/E UNO' }, enlaceExtra || {})
  }, extra || {});
}

const db = (uid) => (uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext()).firestore();

/** Registra como el módulo: contador +1 y el movimiento, en una transacción. */
function registrar(uid, { id = ID, mov, salto = 1, anio = 2026 } = {}) {
  const d = db(uid);
  return runTransaction(d, async (tx) => {
    const cRef = doc(d, 'suministros_config', `correlativo_mov_${anio}`);
    const c = await tx.get(cRef);
    const n = (c.exists() ? c.data().ultimo : 0) + salto;
    tx.set(cRef, { anio, ultimo: n, updatedAt: serverTimestamp() });
    tx.set(doc(d, 'movimientos', id), mov || movimiento(uid, { codigo: `MOV-${anio}-${String(n).padStart(4, '0')}` }));
  });
}

async function sembrar(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await sembrar(async (d) => {
    for (const [uid, p] of Object.entries(PERFILES)) await setDoc(doc(d, 'usuarios', uid), p);
    await setDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), orden());
    await setDoc(doc(d, 'ordenes_materiales', 'SALIDA_200'), orden({ clave: 'SALIDA_200', tipo: 'SALIDA', numero: '200' }));
    await setDoc(doc(d, 'suministros', `${CID}_S03`), { codigo: 'S03', contrato_id: CID, unidad: 'Und', valor_unitario: 1234.56, stock_inicial: 50 });
    await setDoc(doc(d, 'suministros', '4123000081_S03'), { codigo: 'S03', contrato_id: '4123000081', unidad: 'Und', valor_unitario: 1234.56 });
    await setDoc(doc(d, 'suministros_config', 'correlativo_mov_2026'), { anio: 2026, ultimo: 18, updatedAt: CREADO });
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('movimientos · el técnico registra entregas de órdenes', () => {
  test('egreso enlazado a una orden de ENTRADA real, con su contador → permitido', async () => {
    await assertSucceeds(registrar('tecA'));
  });
  test('el admin sigue registrando movimientos manuales (sin orden)', async () => {
    const m = movimiento('admin', { codigo: 'MOV-2026-0019' });
    delete m.orden_es;
    await assertSucceeds(setDoc(doc(db('admin'), 'movimientos', 'manual-1'), m));
  });
  test('movimiento manual (sin orden) → negado al técnico', async () => {
    const m = movimiento('tecA', { codigo: 'MOV-2026-0019' });
    delete m.orden_es;
    await assertFails(registrar('tecA', { id: 'manual-1', mov: m }));
  });
  test('id distinto del fijo de la orden → negado', async () => {
    await assertFails(registrar('tecA', { id: 'otro-id' }));
  });
  test('contrato sin nexo → negado', async () => {
    const m = movimiento('tecA', { contrato_id: '4123000081' });
    await assertFails(registrar('tecA', { id: 'oes_4123000081_ENTRADA_100_S03', mov: m }));
  });
  test('orden de SALIDA → negado', async () => {
    const m = movimiento('tecA', {}, { clave: 'SALIDA_200', tipo: 'SALIDA', numero: '200' });
    await assertFails(registrar('tecA', { id: `oes_${CID}_SALIDA_200_S03`, mov: m }));
  });
  test('orden que no existe → negado', async () => {
    const m = movimiento('tecA', {}, { clave: 'ENTRADA_999', numero: '999' });
    await assertFails(registrar('tecA', { id: `oes_${CID}_ENTRADA_999_S03`, mov: m }));
  });
  test('versión de la orden distinta (cambió desde que se leyó) → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('tecA', {}, { version: 1 }) }));
  });
  test('fecha de la orden distinta → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('tecA', {}, { fechaISO: '2026-03-02' }) }));
  });
  test('valor unitario distinto del catálogo → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('tecA', { valor_unitario: 9999, valor_total: 3 * 9999 }) }));
  });
  test('valor total que no es cantidad × valor unitario → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('tecA', { valor_total: 1 }) }));
  });
  test('código que no es el del contador → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('tecA', { codigo: 'MOV-2026-0050' }) }));
  });
  test('saltarse números del contador → negado', async () => {
    await assertFails(registrar('tecA', { salto: 2 }));
  });
  test('a nombre de otra persona → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('admin', { codigo: 'MOV-2026-0019' }) }));
  });
  test('INGRESO → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('tecA', { tipo: 'INGRESO', codigo: 'MOV-2026-0019' }) }));
  });
  test('usuario desactivado → negado', async () => {
    await assertFails(registrar('apagado', { mov: movimiento('apagado', { codigo: 'MOV-2026-0019' }) }));
  });
  test('reutilizar un MOV ya asignado sin avanzar el contador → negado', async () => {
    await assertFails(setDoc(doc(db('tecA'), 'movimientos', ID), movimiento('tecA', { codigo: 'MOV-2026-0018' })));
  });
  test('código de otro año que el del movimiento → negado', async () => {
    await assertFails(registrar('tecA', { mov: movimiento('tecA', { codigo: 'MOV-2031-0019' }) }));
  });
  test('primer movimiento de un año sin contador: arranca en 1 → permitido', async () => {
    await assertSucceeds(registrar('tecA', { anio: 2027, mov: movimiento('tecA', { codigo: 'MOV-2027-0001', anio: 2027 }) }));
  });
  test('editar un movimiento → sigue siendo solo del admin', async () => {
    await assertSucceeds(registrar('tecA'));
    await assertFails(updateDoc(doc(db('tecA'), 'movimientos', ID), { observaciones: 'x' }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'movimientos', ID), { observaciones: 'x' }));
  });
});

describe('movimientos · el técnico retira solo lo que la orden ya no respalda', () => {
  beforeEach(async () => {
    await sembrar(async (d) => {
      await setDoc(doc(d, 'movimientos', ID), movimiento('tecA', { codigo: 'MOV-2026-0018' }));
      const legado = movimiento('tecA', { codigo: 'MOV-2026-0017' });
      delete legado.orden_es.version;
      await setDoc(doc(d, 'movimientos', `oes_${CID}_ENTRADA_100_S04`), Object.assign(legado, { suministro_id: 'S04' }));
      const manual = movimiento('admin', { codigo: 'MOV-2026-0016' });
      delete manual.orden_es;
      await setDoc(doc(d, 'movimientos', 'manual-1'), manual);
    });
  });
  test('la orden lo respalda tal cual → negado', async () => {
    await assertFails(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
  });
  test('creación de la orden con microsegundos (como en producción) y orden intacta → negado', async () => {
    const conMicros = new Timestamp(1767268800, 367123000);
    await sembrar(async (d) => {
      await setDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), orden({ creadoEn: conMicros }));
      await setDoc(doc(d, 'movimientos', ID), movimiento('tecA', { codigo: 'MOV-2026-0018' }, { creadoEn: conMicros.toMillis() }));
    });
    if (Number.isInteger(conMicros.toMillis())) throw new Error('la prueba debía traer la fracción de los microsegundos');
    await assertFails(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
  });
  test('la orden guarda el transformador con un espacio al final y está intacta → negado', async () => {
    await sembrar((d) => updateDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), { transformador: 'T-1 · S/E UNO ' }));
    await assertFails(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
  });
  test('la orden cambió (otra versión) → permitido', async () => {
    await sembrar((d) => updateDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), { version: 3 }));
    await assertSucceeds(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
  });
  test('la orden fue eliminada → permitido', async () => {
    await sembrar((d) => deleteDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100')));
    await assertSucceeds(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
  });
  test('la orden se borró y se volvió a crear con el mismo número → permitido', async () => {
    await sembrar((d) => setDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), orden({ creadoEn: Timestamp.fromMillis(1767355200000), version: 2 })));
    await assertSucceeds(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
  });
  test('enlace anterior (sin versión) y orden sin cambios visibles → negado (lo corrige el admin)', async () => {
    await sembrar((d) => updateDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), { version: 3 }));
    await assertFails(deleteDoc(doc(db('tecA'), 'movimientos', `oes_${CID}_ENTRADA_100_S04`)));
  });
  test('enlace anterior (sin versión) y la orden cambió de fecha → permitido', async () => {
    await sembrar((d) => updateDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), { fechaISO: '2026-03-05', version: 3 }));
    await assertSucceeds(deleteDoc(doc(db('tecA'), 'movimientos', `oes_${CID}_ENTRADA_100_S04`)));
  });
  test('movimiento manual → negado al técnico, permitido al admin', async () => {
    await assertFails(deleteDoc(doc(db('tecA'), 'movimientos', 'manual-1')));
    await assertSucceeds(deleteDoc(doc(db('admin'), 'movimientos', 'manual-1')));
  });
  test('usuario desactivado → negado aunque la orden haya cambiado', async () => {
    await sembrar((d) => deleteDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100')));
    await assertFails(deleteDoc(doc(db('apagado'), 'movimientos', ID)));
  });
});

describe('suministros_config · contador del consecutivo MOV', () => {
  const ref = (uid, id) => doc(db(uid), 'suministros_config', id);
  test('avanzar de a uno → permitido; saltar → negado', async () => {
    await assertSucceeds(setDoc(ref('tecA', 'correlativo_mov_2026'), { anio: 2026, ultimo: 19, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(ref('tecA', 'correlativo_mov_2026'), { anio: 2026, ultimo: 25, updatedAt: serverTimestamp() }));
  });
  test('bajar o repetir → negado', async () => {
    await assertFails(setDoc(ref('tecA', 'correlativo_mov_2026'), { anio: 2026, ultimo: 18, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(ref('tecA', 'correlativo_mov_2026'), { anio: 2026, ultimo: 3, updatedAt: serverTimestamp() }));
  });
  test('crear el de un año nuevo: solo empezando en 1', async () => {
    await assertFails(setDoc(ref('tecA', 'correlativo_mov_2027'), { anio: 2027, ultimo: 9000, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(ref('tecA', 'correlativo_mov_2027'), { anio: 2027, ultimo: 1, updatedAt: serverTimestamp() }));
  });
  test('año que no coincide con el id, campos extra u otro documento → negado', async () => {
    await assertFails(setDoc(ref('tecA', 'correlativo_mov_2027'), { anio: 2028, ultimo: 1, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(ref('tecA', 'correlativo_mov_2026'), { anio: 2026, ultimo: 19, updatedAt: serverTimestamp(), x: 1 }));
    await assertFails(setDoc(ref('tecA', 'global'), { permitirNegativo: true }));
  });
  test('borrar el contador → negado al técnico', async () => {
    await assertFails(deleteDoc(ref('tecA', 'correlativo_mov_2026')));
  });
  test('el admin conserva el control total', async () => {
    await assertSucceeds(setDoc(ref('admin', 'correlativo_mov_2026'), { anio: 2026, ultimo: 40, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(ref('admin', 'global'), { permitirNegativo: false }));
  });
});

// ── De punta a punta con el MISMO armado del programa (dominio real) ──
// Construye la entrega con calcularNexo → planificarSincronizacion → sanitizarMovimiento y la
// escribe como data/movimientos.js#registrarDesdeOrden (contador + movimiento, valor y enlace
// tomados en la transacción). Si el programa y la regla se desalinean, esto falla.

describe('de punta a punta: el armado del programa pasa las reglas', () => {
  const parque = [{ id: 'tx-1', identificacion: { matricula: 'T-1' }, ubicacion: { subestacion_nombre: 'UNO', zona: 'ZONA-X', departamento: 'x' } }];
  const catalogo = [{ codigo: 'S03', nombre: 'MOTOVENT', unidad: 'Und', valor_unitario: 1234.56 }];
  const ordenApp = () => ({ ...orden(), creadoEn: CREADO.toMillis() });   // como la entrega ordenDesdeRegistro

  async function registrarComoElPrograma(uid, item) {
    const d = db(uid);
    return runTransaction(d, async (tx) => {
      const ref = doc(d, 'movimientos', item.docId);
      if ((await tx.get(ref)).exists()) return 'ya_estaba';
      const os = await tx.get(doc(d, 'ordenes_materiales', item.payload.orden_es.clave));
      const ss = await tx.get(doc(d, 'suministros', `${CID}_${item.payload.suministro_id}`));
      const o = os.data();
      if (cantidadDelItemEnOrden(o.items, 'S03', ss.data().unidad) !== item.payload.cantidad) return 'orden_cambio';
      const cRef = doc(d, 'suministros_config', 'correlativo_mov_2026');
      const c = await tx.get(cRef);
      const n = (c.exists() ? c.data().ultimo : 0) + 1;
      tx.set(cRef, { anio: 2026, ultimo: n, updatedAt: serverTimestamp() });
      const vu = Number(ss.data().valor_unitario);
      const final = sanitizarMovimiento({ ...item.payload, codigo: generarCodigoMov(2026, n), valor_unitario: vu,
        valor_total: item.payload.cantidad * vu,
        orden_es: { ...item.payload.orden_es, creadoEn: o.creadoEn.toMillis(), version: o.version } });
      if (validarMovimiento(final).length) throw new Error(validarMovimiento(final).join('; '));
      tx.set(ref, { ...final, createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return 'registrado';
    });
  }

  test('registrar, cambiar la orden, retirar y volver a registrar (técnico)', async () => {
    let nexo = calcularNexo({ ordenes: [ordenApp()], catalogo, contratoId: CID, movimientos: [] });
    let plan = planificarSincronizacion({ nexo, parque, catalogo, contratoId: CID });
    if (plan.porRegistrar.length !== 1) throw new Error('el plan debía traer una entrega');
    await assertSucceeds(registrarComoElPrograma('tecA', plan.porRegistrar[0]));
    const m = (await getDoc(doc(db('admin'), 'movimientos', ID))).data();
    if (m.codigo !== 'MOV-2026-0019' || m.orden_es.version !== 2) throw new Error('movimiento inesperado: ' + JSON.stringify(m));

    // El técnico edita la orden: 3 → 2 unidades (versión 3).
    await sembrar((d) => updateDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'),
      { items: [{ descripcion: 'Motoventiladores Tipo 1 FN-063', unidad: 'UND', cantidad: 2 }], version: 3 }));
    const o2 = { ...ordenApp(), items: [{ descripcion: 'Motoventiladores Tipo 1 FN-063', unidad: 'UND', cantidad: 2 }], version: 3 };
    nexo = calcularNexo({ ordenes: [o2], catalogo, contratoId: CID, movimientos: [{ id: ID, ...m }] });
    plan = planificarSincronizacion({ nexo, parque, catalogo, contratoId: CID });
    if (plan.corregir.length !== 1 || plan.corregir[0].ids[0] !== ID) throw new Error('el plan debía corregir la entrega');
    const motivo = diferenciaConOrden({ orden: o2, enlace: m.orden_es, codigo: 'S03', cantidad: m.cantidad, unidadCatalogo: 'Und' });
    if (!motivo) throw new Error('la orden cambió: debía haber motivo');
    await assertSucceeds(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
    await assertSucceeds(registrarComoElPrograma('tecA', plan.corregir[0].registro));
    const m2 = (await getDoc(doc(db('admin'), 'movimientos', ID))).data();
    if (m2.codigo !== 'MOV-2026-0020' || m2.cantidad !== 2 || m2.orden_es.version !== 3) throw new Error('corrección inesperada: ' + JSON.stringify(m2));
    // Ahora la orden lo respalda: el técnico ya no puede retirarlo.
    await assertFails(deleteDoc(doc(db('tecA'), 'movimientos', ID)));
  });
});
