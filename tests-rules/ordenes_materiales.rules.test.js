// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Reglas del registro de Órdenes de Materiales (99 §77)
// ──────────────────────────────────────────────────────────────
// `ordenes_materiales` es la PRIMERA colección donde escribe un técnico.
// Cualquier hueco aquí es escritura de alguien que no debía. Estas pruebas
// corren contra el emulador (`npm run test:rules`) con un proyecto propio,
// para no mezclarse con la semilla de firestore.rules.test.js.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, collection,
  query, orderBy, limit, serverTimestamp, runTransaction
} from 'firebase/firestore';

const PROJECT_ID = 'demo-sgm-rules-om';
let testEnv;

const PERFILES = {
  tecA:   { rol: 'tecnico', activo: true,  nombre: 'TECNICO A' },
  tecB:   { rol: 'tecnico', activo: true,  nombre: 'TECNICO B' },
  admin:  { rol: 'admin',   activo: true,  nombre: 'ADMIN UNO' },
  apagado: { rol: 'tecnico', activo: false, nombre: 'APAGADO' }
};

const autor = (uid) => ({ uid, nombre: PERFILES[uid].nombre });

function orden(uid, extra) {
  return Object.assign({
    clave: 'SALIDA_01012030-01', tipo: 'SALIDA', numero: '01012030-01',
    zona: 'ZONA-X', fechaISO: '2030-01-01', fecha: '1 de enero de 2030', hora: '08:00',
    origen: 'SEDE A', destino: 'SEDE B', transformador: '', motivo: 'M', motivoSel: 'M',
    nota: '', empresaVig: '', conFirmas: true,
    items: [{ codigo: 'C1', descripcion: 'MATERIAL', unidad: 'UN', cantidad: 1 }],
    autorizado: { nombre: 'P1' }, entregado: { nombre: 'P2' }, recibido: { nombre: 'P3' },
    creadoPor: autor(uid), creadoEn: serverTimestamp(),
    actualizadoPor: autor(uid), actualizadoEn: serverTimestamp(), version: 1
  }, extra || {});
}

const db = (uid) => (uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext()).firestore();
const ref = (d, clave = 'SALIDA_01012030-01') => doc(d, 'ordenes_materiales', clave);
const lapida = (d, clave = 'SALIDA_01012030-01') => doc(d, 'ordenes_materiales_borradas', clave);

/** Siembra la orden de `uid` saltándose las reglas (con Timestamps reales). */
async function sembrar(uid, extra) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(ctx.firestore()), orden(uid, extra));
  });
}

/** Borra como lo hace el módulo: orden + lápida con la copia exacta, en una transacción. */
function borrarConLapida(uid, copiaAlterada) {
  const d = db(uid);
  return runTransaction(d, async (tx) => {
    const snap = await tx.get(ref(d));
    const copia = copiaAlterada ? Object.assign({}, snap.data(), copiaAlterada) : snap.data();
    tx.delete(ref(d));
    tx.set(lapida(d), { clave: 'SALIDA_01012030-01', borradaPor: autor(uid), borradaEn: serverTimestamp(), orden: copia });
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const [uid, p] of Object.entries(PERFILES)) await setDoc(doc(d, 'usuarios', uid), p);
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('ordenes_materiales — lectura', () => {
  test('sin sesión, sin perfil o desactivado NO leen', async () => {
    await sembrar('tecA');
    await assertFails(getDoc(ref(db(null))));
    await assertFails(getDoc(ref(db('intruso'))));
    await assertFails(getDoc(ref(db('apagado'))));
  });

  test('un miembro activo lee, y la lista exige límite ≤ 501', async () => {
    await sembrar('tecA');
    await assertSucceeds(getDoc(ref(db('tecB'))));
    const col = collection(db('tecB'), 'ordenes_materiales');
    await assertSucceeds(getDocs(query(col, orderBy('fechaISO', 'desc'), limit(501))));
    await assertFails(getDocs(query(col, limit(502))));
    await assertFails(getDocs(col));
  });
});

describe('ordenes_materiales — crear', () => {
  test('un técnico activo crea una orden válida', async () => {
    await assertSucceeds(setDoc(ref(db('tecA')), orden('tecA')));
  });

  test('crear ENCIMA de una existente se rechaza (no se pisa la orden de otro)', async () => {
    await sembrar('tecA');
    await assertFails(setDoc(ref(db('tecB')), orden('tecB')));
  });

  test('desactivado o sin perfil NO crean', async () => {
    await assertFails(setDoc(ref(db('apagado')), orden('apagado')));
    await assertFails(setDoc(ref(db('intruso')), Object.assign(orden('tecA'), { creadoPor: { uid: 'intruso', nombre: '' }, actualizadoPor: { uid: 'intruso', nombre: '' } })));
  });

  test('la clave debe salir del tipo y el número', async () => {
    const d = db('tecA');
    await assertFails(setDoc(doc(d, 'ordenes_materiales', 'ENTRADA_100'), orden('tecA', { clave: 'ENTRADA_100' })));
    await assertFails(setDoc(ref(d), orden('tecA', { tipo: 'ENTRADA' })));
    await assertSucceeds(setDoc(doc(d, 'ordenes_materiales', 'SALIDA_OE~12'), orden('tecA', { clave: 'SALIDA_OE~12', numero: 'OE/12' })));
  });

  test('número fuera del alfabeto o de más de 30 caracteres se rechaza', async () => {
    const d = db('tecA');
    const n = 'A'.repeat(31);
    await assertFails(setDoc(doc(d, 'ordenes_materiales', 'SALIDA_' + n), orden('tecA', { clave: 'SALIDA_' + n, numero: n })));
    await assertFails(setDoc(doc(d, 'ordenes_materiales', 'SALIDA_oe-1'), orden('tecA', { clave: 'SALIDA_oe-1', numero: 'oe-1' })));
  });

  test('una cédula (o cualquier otro dato) en una persona se rechaza', async () => {
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { entregado: { nombre: 'P2', cedula: '123' } })));
  });

  test('campos fuera de la lista blanca (una firma) se rechazan', async () => {
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { firma: 'data:image/png;base64,AAAA' })));
  });

  test('autoría falsa (uid de otro o nombre distinto al del perfil) se rechaza', async () => {
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { creadoPor: autor('tecB') })));
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { creadoPor: { uid: 'tecA', nombre: 'ING. JEFE' } })));
  });

  test('fechas de guardado inventadas o versión distinta de 1 se rechazan', async () => {
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { creadoEn: new Date('2020-01-01') })));
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { version: 5 })));
  });

  test('materiales: vacío o más de 200 se rechaza', async () => {
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { items: [] })));
    const muchos = Array.from({ length: 201 }, () => ({ descripcion: 'M', unidad: 'UN', cantidad: 1 }));
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { items: muchos })));
  });

  test('textos por encima del límite se rechazan', async () => {
    await assertFails(setDoc(ref(db('tecA')), orden('tecA', { nota: 'x'.repeat(501) })));
  });
});

describe('ordenes_materiales — editar', () => {
  const edicion = (uid, extra) => Object.assign(
    { nota: 'editada', actualizadoPor: autor(uid), actualizadoEn: serverTimestamp(), version: 2 }, extra || {});

  test('otro técnico activo edita con versión +1', async () => {
    await sembrar('tecA');
    await assertSucceeds(updateDoc(ref(db('tecB')), edicion('tecB')));
  });

  test('saltar o repetir la versión se rechaza', async () => {
    await sembrar('tecA');
    await assertFails(updateDoc(ref(db('tecB')), edicion('tecB', { version: 3 })));
    await assertFails(updateDoc(ref(db('tecB')), edicion('tecB', { version: 1 })));
  });

  test('tipo, número, clave y autoría de creación son inmutables', async () => {
    await sembrar('tecA');
    const d = db('tecB');
    await assertFails(updateDoc(ref(d), edicion('tecB', { numero: '01012030-02', clave: 'SALIDA_01012030-02' })));
    await assertFails(updateDoc(ref(d), edicion('tecB', { creadoPor: autor('tecB') })));
    await assertFails(updateDoc(ref(d), edicion('tecB', { migradaDe: 'navegador' })));
  });

  test('editar firmando como otro se rechaza', async () => {
    await sembrar('tecA');
    await assertFails(updateDoc(ref(db('tecB')), edicion('tecB', { actualizadoPor: autor('tecA') })));
  });

  test('un desactivado no edita', async () => {
    await sembrar('tecA');
    await assertFails(updateDoc(ref(db('apagado')), edicion('apagado')));
  });
});

describe('ordenes_materiales — borrar y lápida', () => {
  test('el creador borra dejando la lápida con la copia exacta', async () => {
    await sembrar('tecA');
    await assertSucceeds(borrarConLapida('tecA'));
    const l = await getDoc(lapida(db('tecB')));
    assert.equal(l.data().orden.numero, '01012030-01');
  });

  test('un técnico NO borra la orden de otro', async () => {
    await sembrar('tecA');
    await assertFails(borrarConLapida('tecB'));
  });

  test('el admin borra la orden de cualquiera', async () => {
    await sembrar('tecA');
    await assertSucceeds(borrarConLapida('admin'));
  });

  test('borrar SIN lápida se rechaza, aunque sea el creador', async () => {
    await sembrar('tecA');
    await assertFails(deleteDoc(ref(db('tecA'))));
  });

  test('una lápida con la copia alterada se rechaza', async () => {
    await sembrar('tecA');
    await assertFails(borrarConLapida('tecA', { nota: 'no era así' }));
  });

  test('una lápida suelta (sin borrar la orden) se rechaza', async () => {
    await sembrar('tecA');
    const d = db('tecA');
    const snap = await getDoc(ref(d));
    await assertFails(setDoc(lapida(d), { clave: 'SALIDA_01012030-01', borradaPor: autor('tecA'), borradaEn: serverTimestamp(), orden: snap.data() }));
  });

  test('las lápidas no se listan ni se borran', async () => {
    await sembrar('tecA');
    await borrarConLapida('tecA');
    await assertFails(getDocs(query(collection(db('admin'), 'ordenes_materiales_borradas'), limit(10))));
    await assertFails(deleteDoc(lapida(db('admin'))));
  });

  test('crear, editar y borrar pueden registrar la bitácora en la misma escritura', async () => {
    const d = db('tecA');
    const b = writeBatch(d);
    b.set(ref(d), orden('tecA'));
    b.set(doc(collection(d, 'auditoria')), { accion: 'crear', coleccion: 'ordenes_materiales', at: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});

