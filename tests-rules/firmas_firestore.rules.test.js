// ══════════════════════════════════════════════════════════════
// Reglas de las FIRMAS en FIRESTORE (ADR-100), en el emulador.
//   · firmas/{uid}: la firma PROPIA; solo su dueño la lee y la escribe.
//   · firmas_equipo/{custodio}/personas/{persona}: firmas del equipo; solo su
//     custodio, y SIEMPRE junto con un registro NUEVO que coincide con ella.
// Dos direcciones en cada caso (L-73): el dueño SÍ, el ajeno NO.
// Identidades con prefijo `ff_`. Sin firmas reales: la imagen es la cabecera
// mínima de un PNG.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, collection, writeBatch, serverTimestamp, Bytes
} from 'firebase/firestore';

const PNG = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
const HUELLA = 'a'.repeat(64);
const OTRA_HUELLA = 'b'.repeat(64);
const AUT = { fecha: '2026-09-25', medio: 'Autorización verbal' };
const bytesDe = (n) => { const u = new Uint8Array(n); u.set(PNG, 0); return Bytes.fromUint8Array(u); };

let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'usuarios/ff_admin'),    { email: 'a@x.co', rol: 'admin',   activo: true,  nombre: 'Custodio Uno' });
    await setDoc(doc(d, 'usuarios/ff_admin2'),   { email: 'b@x.co', rol: 'admin',   activo: true,  nombre: 'Custodio Dos' });
    await setDoc(doc(d, 'usuarios/ff_tech'),     { email: 't@x.co', rol: 'tecnico', activo: true,  nombre: 'Tecnico' });
    await setDoc(doc(d, 'usuarios/ff_inactivo'), { email: 'i@x.co', rol: 'tecnico', activo: false, nombre: 'Inactivo' });
    await setDoc(doc(d, 'admins/ff_arranque'), { email: 'x@x.co' });
    // Un registro VIEJO, ya existente, para probar que no se puede reutilizar.
    await setDoc(doc(d, 'firmas_equipo_registro/ff_viejo'), {
      tipo: 'alta', persona: 'JORGE_MIRANDA', autorizacion: AUT, huella: HUELLA,
      custodio: 'ff_admin', custodioNombre: 'Custodio Uno', en: new Date()
    });
    await setDoc(doc(d, 'firmas_equipo/ff_admin/personas/ERICK_VERGARA'), {
      imagen: bytesDe(64), huella: HUELLA, autorizacion: AUT, registro: 'semilla', en: new Date()
    });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

const propia = (extra = {}) => ({ imagen: bytesDe(64), huella: HUELLA, en: serverTimestamp(), ...extra });

describe('Firestore · firmas/{uid} — la firma propia', () => {
  test('su dueño (técnico activo) la guarda, la lee y la borra', async () => {
    const d = db('ff_tech');
    await assertSucceeds(setDoc(doc(d, 'firmas/ff_tech'), propia()));
    await assertSucceeds(getDoc(doc(d, 'firmas/ff_tech')));
    await assertSucceeds(setDoc(doc(d, 'firmas/ff_tech'), propia({ huella: OTRA_HUELLA })));   // reemplazo
    await assertSucceeds(deleteDoc(doc(d, 'firmas/ff_tech')));
  });
  test('nadie lee ni escribe la firma de OTRO (ni un admin); nadie lista', async () => {
    await assertSucceeds(setDoc(doc(db('ff_admin'), 'firmas/ff_admin'), propia()));
    await assertFails(getDoc(doc(db('ff_tech'), 'firmas/ff_admin')));
    await assertFails(getDoc(doc(db('ff_admin2'), 'firmas/ff_admin')));
    await assertFails(setDoc(doc(db('ff_admin2'), 'firmas/ff_admin'), propia()));
    await assertFails(deleteDoc(doc(db('ff_admin2'), 'firmas/ff_admin')));
    await assertFails(getDocs(collection(db('ff_admin'), 'firmas')));
  });
  test('sin sesión o inactivo, nada', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'firmas/ff_admin')));
    await assertFails(setDoc(doc(db('ff_inactivo'), 'firmas/ff_inactivo'), propia()));
  });
  test('imagen grande, que no es bytes, huella mala, hora del cliente o campos de más: rechazado', async () => {
    const r = doc(db('ff_tech'), 'firmas/ff_tech');
    await assertSucceeds(setDoc(r, propia({ imagen: bytesDe(900 * 1024) })));                 // el tope entra
    await assertFails(setDoc(r, propia({ imagen: bytesDe(900 * 1024 + 1) })));
    await assertFails(setDoc(r, propia({ imagen: 'iVBORw0KGgo=' })));
    await assertFails(setDoc(r, propia({ huella: 'xyz' })));
    await assertFails(setDoc(r, propia({ en: new Date('2020-01-01') })));
    await assertFails(setDoc(r, propia({ dueno: 'otro' })));
  });
});

/** Escribe la firma del equipo y su registro en un lote, como lo hace la página. */
async function lote(uid, persona, { reg = {}, firma = {}, sinRegistro = false, registroId } = {}) {
  const d = db(uid);
  const b = writeBatch(d);
  const regRef = registroId ? doc(d, 'firmas_equipo_registro', registroId) : doc(collection(d, 'firmas_equipo_registro'));
  if (!sinRegistro) {
    b.set(regRef, { tipo: 'alta', persona, autorizacion: AUT, huella: HUELLA, custodio: uid,
      custodioNombre: uid === 'ff_admin' ? 'Custodio Uno' : 'Custodio Dos', en: serverTimestamp(), ...reg });
  }
  b.set(doc(d, 'firmas_equipo', uid, 'personas', persona), {
    imagen: bytesDe(64), huella: HUELLA, autorizacion: AUT, registro: regRef.id, en: serverTimestamp(), ...firma });
  return b.commit();
}

describe('Firestore · firmas_equipo — solo su custodio, y siempre con su registro', () => {
  test('el custodio guarda la firma JUNTO con su registro de alta, y la lee', async () => {
    await assertSucceeds(lote('ff_admin', 'JORGE_MIRANDA'));
    await assertSucceeds(getDoc(doc(db('ff_admin'), 'firmas_equipo/ff_admin/personas/JORGE_MIRANDA')));
    await assertSucceeds(lote('ff_admin', 'JORGE_MIRANDA', { reg: { tipo: 'reemplazo' } }));
  });
  test('sin registro, con un registro VIEJO o con uno que no coincide: rechazado', async () => {
    await assertFails(lote('ff_admin', 'CARLOS_MARTELO', { sinRegistro: true }));
    await assertFails(lote('ff_admin', 'JORGE_MIRANDA', { sinRegistro: true, registroId: 'ff_viejo' }));
    await assertFails(lote('ff_admin', 'CARLOS_MARTELO', { reg: { huella: OTRA_HUELLA } }));
    await assertFails(lote('ff_admin', 'CARLOS_MARTELO', { reg: { persona: 'JORGE_RHENALS' } }));
    await assertFails(lote('ff_admin', 'CARLOS_MARTELO', { reg: { autorizacion: { fecha: '2026-09-24', medio: 'Autorización verbal' } } }));
    await assertFails(lote('ff_admin', 'CARLOS_MARTELO', { reg: { tipo: 'retiro' } }));
  });
  test('OTRO admin no la lee ni la escribe en el espacio ajeno; un técnico tampoco', async () => {
    await assertFails(getDoc(doc(db('ff_admin2'), 'firmas_equipo/ff_admin/personas/ERICK_VERGARA')));
    await assertFails(getDoc(doc(db('ff_tech'), 'firmas_equipo/ff_admin/personas/ERICK_VERGARA')));
    await assertFails(lote('ff_tech', 'JORGE_MIRANDA'));
    await assertFails(getDocs(collection(db('ff_admin'), 'firmas_equipo/ff_admin/personas')));
  });
  test('el admin de arranque (sin perfil) no custodia', async () => {
    await assertFails(lote('ff_arranque', 'JORGE_MIRANDA'));
  });
  test('persona fuera de la lista o imagen grande: rechazado', async () => {
    await assertFails(lote('ff_admin', 'JUAN_PEREZ'));
    await assertFails(lote('ff_admin', 'JORGE_RHENALS', { firma: { imagen: bytesDe(512 * 1024 + 1) } }));
    await assertSucceeds(lote('ff_admin', 'JORGE_RHENALS', { firma: { imagen: bytesDe(512 * 1024) } }));
  });
  test('retirar: borrar junto con el registro de retiro (y borrar solo, también)', async () => {
    const d = db('ff_admin');
    const b = writeBatch(d);
    b.delete(doc(d, 'firmas_equipo/ff_admin/personas/JORGE_RHENALS'));
    b.set(doc(collection(d, 'firmas_equipo_registro')), { tipo: 'retiro', persona: 'JORGE_RHENALS',
      custodio: 'ff_admin', custodioNombre: 'Custodio Uno', en: serverTimestamp() });
    await assertSucceeds(b.commit());
    await assertFails(deleteDoc(doc(db('ff_admin2'), 'firmas_equipo/ff_admin/personas/ERICK_VERGARA')));
    await assertSucceeds(deleteDoc(doc(db('ff_admin'), 'firmas_equipo/ff_admin/personas/ERICK_VERGARA')));
  });
});
