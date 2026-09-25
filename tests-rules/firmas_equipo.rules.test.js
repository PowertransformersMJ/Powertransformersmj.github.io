// ══════════════════════════════════════════════════════════════
// Reglas de las FIRMAS DEL EQUIPO (ADR-099), en el emulador.
//   · Storage firmas-equipo/{custodio}/{persona}: solo su custodio (admin
//     activo) la lee, la sube o la reemplaza; nadie lista; solo PNG ≤ 512 KB
//     con la autorización declarada y la huella.
//   · Firestore firmas_equipo_registro y fichas_emisiones: SOLO se agrega.
// Identidades con prefijo `fe_` para no pisar la semilla de los otros
// archivos, que corren en paralelo contra el mismo emulador (no se limpia).
// Sin firmas reales: el PNG es la cabecera mínima.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, collection, query, where, limit } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';

const PROJECT_ID = 'demo-sgm-rules';
const PNG = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
const HUELLA = 'a'.repeat(64);
const META = (extra = {}) => ({
  contentType: 'image/png',
  customMetadata: { autorizacionFecha: '2026-09-20', autorizacionMedio: 'correo del 20/09/2026', huella: HUELLA, ...extra }
});
const GRANDE = new Uint8Array(512 * 1024 + 1); GRANDE.set(PNG, 0);

let testEnv;
const st = (uid) => testEnv.authenticatedContext(uid).storage();
const db = (uid) => testEnv.authenticatedContext(uid).firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'usuarios/fe_admin'),   { email: 'a@x.co', rol: 'admin',   activo: true, nombre: 'Custodio Uno' });
    await setDoc(doc(d, 'usuarios/fe_admin2'),  { email: 'b@x.co', rol: 'admin',   activo: true, nombre: 'Custodio Dos' });
    await setDoc(doc(d, 'usuarios/fe_tech'),    { email: 't@x.co', rol: 'tecnico', activo: true, nombre: 'Tecnico' });
    await setDoc(doc(d, 'usuarios/fe_revocado'), { email: 'r@x.co', rol: 'admin',  activo: false, nombre: 'Revocado' });
    await setDoc(doc(d, 'fichas_emisiones/fe_semilla'), { documento: 'PE.02081' });
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), 'firmas-equipo/fe_admin/JORGE_MIRANDA'), PNG, META());
    await uploadBytes(ref(ctx.storage(), 'firmas-equipo/fe_revocado/JORGE_MIRANDA'), PNG, META());
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('Storage · firmas-equipo — solo su custodio', () => {
  test('el custodio sube la firma de una persona de la lista con su autorización', async () => {
    await assertSucceeds(uploadBytes(ref(st('fe_admin'), 'firmas-equipo/fe_admin/ERICK_VERGARA'), PNG, META()));
  });
  test('el custodio la lee; OTRO admin no la lee ni la pisa', async () => {
    await assertSucceeds(getBytes(ref(st('fe_admin'), 'firmas-equipo/fe_admin/JORGE_MIRANDA')));
    await assertFails(getBytes(ref(st('fe_admin2'), 'firmas-equipo/fe_admin/JORGE_MIRANDA')));
    await assertFails(uploadBytes(ref(st('fe_admin2'), 'firmas-equipo/fe_admin/JORGE_MIRANDA'), PNG, META()));
    await assertFails(deleteObject(ref(st('fe_admin2'), 'firmas-equipo/fe_admin/JORGE_MIRANDA')));
  });
  test('un técnico no lee ni sube, ni en su propio espacio', async () => {
    await assertFails(getBytes(ref(st('fe_tech'), 'firmas-equipo/fe_admin/JORGE_MIRANDA')));
    await assertFails(uploadBytes(ref(st('fe_tech'), 'firmas-equipo/fe_tech/JORGE_MIRANDA'), PNG, META()));
  });
  test('sin sesión, nada; un admin desactivado no lee lo que custodiaba', async () => {
    await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), 'firmas-equipo/fe_admin/JORGE_MIRANDA')));
    await assertFails(getBytes(ref(st('fe_revocado'), 'firmas-equipo/fe_revocado/JORGE_MIRANDA')));
  });
  test('…pero sí puede retirarla (quitar no exige seguir siendo admin)', async () => {
    await assertSucceeds(deleteObject(ref(st('fe_revocado'), 'firmas-equipo/fe_revocado/JORGE_MIRANDA')));
  });
  test('nadie LISTA el directorio', async () => {
    await assertFails(listAll(ref(st('fe_admin'), 'firmas-equipo/fe_admin')));
    await assertFails(listAll(ref(st('fe_admin'), 'firmas-equipo')));
  });
  test('persona fuera de la lista, sin autorización, huella mala, fecha mala, no PNG o grande: rechazado', async () => {
    const r = (p) => ref(st('fe_admin'), 'firmas-equipo/fe_admin/' + p);
    await assertFails(uploadBytes(r('JUAN_PEREZ'), PNG, META()));
    await assertFails(uploadBytes(r('CARLOS_MARTELO'), PNG, { contentType: 'image/png' }));
    await assertFails(uploadBytes(r('CARLOS_MARTELO'), PNG, META({ huella: 'xyz' })));
    await assertFails(uploadBytes(r('CARLOS_MARTELO'), PNG, META({ autorizacionFecha: '20/09/2026' })));
    await assertFails(uploadBytes(r('CARLOS_MARTELO'), PNG, META({ autorizacionMedio: 'ok' })));
    await assertFails(uploadBytes(r('CARLOS_MARTELO'), PNG, { ...META(), contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(r('CARLOS_MARTELO'), GRANDE, META()));
  });
  test('una subruta más honda queda cerrada', async () => {
    await assertFails(uploadBytes(ref(st('fe_admin'), 'firmas-equipo/fe_admin/JORGE_MIRANDA/extra'), PNG, META()));
  });
});

describe('Firestore · registros de las firmas del equipo — solo se agrega', () => {
  const alta = (uid, extra = {}) => ({
    tipo: 'alta', persona: 'ERICK_VERGARA', autorizacion: { fecha: '2026-09-20', medio: 'correo del 20/09/2026' },
    huella: HUELLA, custodio: uid, custodioNombre: uid === 'fe_admin' ? 'Custodio Uno' : 'Tecnico', en: serverTimestamp(), ...extra
  });
  test('el custodio registra un alta y un retiro; no los edita ni los borra', async () => {
    await assertSucceeds(setDoc(doc(db('fe_admin'), 'firmas_equipo_registro/fe_r1'), alta('fe_admin')));
    await assertSucceeds(setDoc(doc(db('fe_admin'), 'firmas_equipo_registro/fe_r2'),
      { tipo: 'retiro', persona: 'ERICK_VERGARA', custodio: 'fe_admin', custodioNombre: 'Custodio Uno', en: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db('fe_admin'), 'firmas_equipo_registro/fe_r1')));
    await assertFails(updateDoc(doc(db('fe_admin'), 'firmas_equipo_registro/fe_r1'), { huella: 'b'.repeat(64) }));
    await assertFails(deleteDoc(doc(db('fe_admin'), 'firmas_equipo_registro/fe_r1')));
  });
  test('no se registra a nombre de otro, ni con fecha del cliente, ni persona o tipo inválidos', async () => {
    const d = db('fe_admin');
    await assertFails(setDoc(doc(d, 'firmas_equipo_registro/fe_x1'), alta('fe_admin', { custodio: 'fe_admin2' })));
    await assertFails(setDoc(doc(d, 'firmas_equipo_registro/fe_x2'), alta('fe_admin', { en: new Date() })));
    await assertFails(setDoc(doc(d, 'firmas_equipo_registro/fe_x3'), alta('fe_admin', { persona: 'JUAN_PEREZ' })));
    await assertFails(setDoc(doc(d, 'firmas_equipo_registro/fe_x4'), alta('fe_admin', { tipo: 'borrado' })));
    await assertFails(setDoc(doc(d, 'firmas_equipo_registro/fe_x5'), alta('fe_admin', { custodioNombre: 'Otro Nombre' })));
    await assertFails(setDoc(doc(d, 'firmas_equipo_registro/fe_x6'), alta('fe_admin', { autorizacion: { fecha: '2026-09-20', medio: 'ok' } })));
  });
  test('otro admin NO ve el registro de un custodio: ni por documento ni listando', async () => {
    await assertFails(getDoc(doc(db('fe_admin2'), 'firmas_equipo_registro/fe_r1')));
    await assertFails(getDocs(query(collection(db('fe_admin2'), 'firmas_equipo_registro'), limit(50))));
    // El custodio sí lista lo suyo, filtrando por su uid.
    await assertSucceeds(getDocs(query(collection(db('fe_admin'), 'firmas_equipo_registro'),
      where('custodio', '==', 'fe_admin'), limit(50))));
  });
  test('un técnico no registra', async () => {
    await assertFails(setDoc(doc(db('fe_tech'), 'firmas_equipo_registro/fe_t1'), alta('fe_tech')));
  });

  const emision = (extra = {}) => ({
    equipo: { matricula: 'T1-X', subestacion: 'X', serie: 'S1' }, documento: 'PE.02081',
    casillas: [{ k: 'rev', persona: 'JORGE_MIRANDA', origen: 'equipo', huella: HUELLA }],
    huellaArchivo: 'c'.repeat(64), custodio: 'fe_admin', custodioNombre: 'Custodio Uno', en: serverTimestamp(), ...extra
  });
  test('una emisión se registra una vez y no se toca', async () => {
    await assertSucceeds(setDoc(doc(db('fe_admin'), 'fichas_emisiones/fe_e1'), emision()));
    await assertSucceeds(getDoc(doc(db('fe_admin'), 'fichas_emisiones/fe_e1')));
    await assertFails(updateDoc(doc(db('fe_admin'), 'fichas_emisiones/fe_e1'), { huellaArchivo: 'd'.repeat(64) }));
    await assertFails(deleteDoc(doc(db('fe_admin'), 'fichas_emisiones/fe_e1')));
    // Tampoco se «recrea» encima de una que ya existe.
    await assertFails(setDoc(doc(db('fe_admin'), 'fichas_emisiones/fe_semilla'), emision()));
  });
  test('emisión inválida o de un técnico: rechazada', async () => {
    const d = db('fe_admin');
    await assertFails(setDoc(doc(d, 'fichas_emisiones/fe_e2'), emision({ documento: 'OTRO' })));
    await assertFails(setDoc(doc(d, 'fichas_emisiones/fe_e3'), emision({ huellaArchivo: 'zz' })));
    await assertFails(setDoc(doc(d, 'fichas_emisiones/fe_e4'), emision({ casillas: [] })));
    await assertFails(setDoc(doc(d, 'fichas_emisiones/fe_e5'), emision({ custodio: 'fe_admin2' })));
    await assertFails(setDoc(doc(db('fe_tech'), 'fichas_emisiones/fe_e6'), emision({ custodio: 'fe_tech', custodioNombre: 'Tecnico' })));
    await assertFails(getDoc(doc(db('fe_tech'), 'fichas_emisiones/fe_e1')));
  });
});
