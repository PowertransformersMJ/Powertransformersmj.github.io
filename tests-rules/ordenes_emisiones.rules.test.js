// ══════════════════════════════════════════════════════════════
// Reglas de `ordenes_emisiones` (Órdenes de Entrada/Salida IT.05801, 2026-09-28):
// cada PDF/Excel con firmas del equipo queda registrado. SOLO se agrega, a nombre
// de quien emite (administrador con perfil). Se prueba en las DOS direcciones (L-78).
// Identidades con prefijo `oe_` (el emulador lo comparten otros archivos).
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, collection, query, limit } from 'firebase/firestore';

const PROJECT_ID = 'demo-sgm-rules';
let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'usuarios/oe_admin'), { email: 'a@x.co', rol: 'admin', activo: true, nombre: 'Custodio OE' });
    await setDoc(doc(d, 'usuarios/oe_admin2'), { email: 'b@x.co', rol: 'admin', activo: true, nombre: 'Otro Admin' });
    await setDoc(doc(d, 'usuarios/oe_tech'), { email: 't@x.co', rol: 'tecnico', activo: true, nombre: 'Tecnico OE' });
    await setDoc(doc(d, 'usuarios/oe_revocado'), { email: 'r@x.co', rol: 'admin', activo: false, nombre: 'Revocado OE' });
    await setDoc(doc(d, 'admins/oe_arranque'), { email: 'x@x.co' });
    await setDoc(doc(d, 'ordenes_emisiones/oe_semilla'), { documento: 'IT.05801' });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

const emision = (extra = {}) => ({
  orden: { tipo: 'SALIDA', numero: '901', zona: 'BOLIVAR', fecha: '28/09/2026' },
  documento: 'IT.05801', formato: 'pdf',
  casillas: [{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'propia', huella: 'b'.repeat(64) },
    { rol: 'entregado', persona: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', origen: 'equipo', huella: 'c'.repeat(64) }],
  huellaArchivo: 'a'.repeat(64), custodio: 'oe_admin', custodioNombre: 'Custodio OE', en: serverTimestamp(), ...extra
});

describe('ordenes_emisiones — SOLO se agrega, a nombre de quien emite', () => {
  test('el administrador con perfil registra, y lee lo registrado', async () => {
    await assertSucceeds(setDoc(doc(db('oe_admin'), 'ordenes_emisiones/oe_e1'), emision()));
    await assertSucceeds(getDoc(doc(db('oe_admin'), 'ordenes_emisiones/oe_e1')));
    await assertSucceeds(setDoc(doc(db('oe_admin'), 'ordenes_emisiones/oe_e1x'), emision({ formato: 'xlsx' })));
    await assertSucceeds(getDocs(query(collection(db('oe_admin2'), 'ordenes_emisiones'), limit(10))));
  });
  test('nadie lo edita, lo borra ni lo pisa', async () => {
    await assertFails(updateDoc(doc(db('oe_admin'), 'ordenes_emisiones/oe_e1'), { huellaArchivo: 'd'.repeat(64) }));
    await assertFails(deleteDoc(doc(db('oe_admin'), 'ordenes_emisiones/oe_e1')));
    await assertFails(setDoc(doc(db('oe_admin'), 'ordenes_emisiones/oe_semilla'), emision()));
  });
  test('rechaza datos que no cuadran', async () => {
    const d = db('oe_admin');
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e2'), emision({ documento: 'PE.02081' })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e3'), emision({ formato: 'docx' })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e4'), emision({ casillas: [] })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e5'), emision({ casillas: [1, 2, 3, 4] })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e6'), emision({ huellaArchivo: 'zz' })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e7'), emision({ orden: { tipo: 'SALIDA', numero: '1', zona: 'X', fecha: '', cedula: '123' } })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e8'), emision({ extra: 1 })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e9'), emision({ en: new Date() })));
  });
  test('solo a su propio nombre (uid y nombre del perfil)', async () => {
    const d = db('oe_admin');
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e10'), emision({ custodio: 'oe_admin2' })));
    await assertFails(setDoc(doc(d, 'ordenes_emisiones/oe_e11'), emision({ custodioNombre: 'Otro Nombre' })));
  });
  test('ni técnico, ni admin revocado, ni admin de arranque sin perfil, ni sin sesión', async () => {
    await assertFails(setDoc(doc(db('oe_tech'), 'ordenes_emisiones/oe_e12'), emision({ custodio: 'oe_tech', custodioNombre: 'Tecnico OE' })));
    await assertFails(getDoc(doc(db('oe_tech'), 'ordenes_emisiones/oe_e1')));
    await assertFails(setDoc(doc(db('oe_revocado'), 'ordenes_emisiones/oe_e13'), emision({ custodio: 'oe_revocado', custodioNombre: 'Revocado OE' })));
    await assertFails(setDoc(doc(db('oe_arranque'), 'ordenes_emisiones/oe_e14'), emision({ custodio: 'oe_arranque', custodioNombre: '' })));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'ordenes_emisiones/oe_e1')));
  });
});
