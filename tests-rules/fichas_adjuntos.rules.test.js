// ══════════════════════════════════════════════════════════════
// Reglas del «Diagrama Operativo» de las fichas (ADR-112), en el emulador.
//   · fichas_adjuntos/{id}: la meta; lo lee el equipo, lo escribe un admin con
//     perfil; el id sale de la identidad (sha256 de «M:matrícula»).
//   · partes/{0..2}: bytes ≤ 900 KB atados a la meta por `lote`; nadie lista.
//   · fichas_adjuntos_registro: solo se agrega (alta/reemplazo/retiro), sin bytes.
// Dos direcciones en cada caso (L-73). Identidades con prefijo `fa_`.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, limit, writeBatch, serverTimestamp, Bytes
} from 'firebase/firestore';

const CLAVE = 'M:T1-FA-PRUEBA';
const ID = 'salud_' + createHash('sha256').update(CLAVE).digest('hex');
const CLAVE2 = 'S:SERIE-FA-2';
const ID2 = 'salud_' + createHash('sha256').update(CLAVE2).digest('hex');
const HUELLA = 'c'.repeat(64);
const LOTE = 'ABCDEFGHIJabcdefghij';
const LOTE2 = 'ZZZZZZZZZZyyyyyyyyyy';
const bytes = (n) => Bytes.fromUint8Array(new Uint8Array(n).fill(7));

let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const meta = (extra = {}) => ({
  clave: CLAVE, matricula: 'T1-FA-PRUEBA', serie: '', documento: 'salud', tipo: 'excel',
  origen: { nombre: 'cronograma.xlsx', hoja: 'Cronograma trabajos' }, mime: 'image/png', ancho: 1226, alto: 472,
  tamano: 1000, partes: 1, huella: HUELLA, lote: LOTE, subidoPor: { uid: 'fa_admin', nombre: 'Admin Uno' }, en: serverTimestamp(), ...extra
});
const registro = (extra = {}) => ({
  idAdjunto: ID, accion: 'alta', nombre: 'cronograma.xlsx', huella: HUELLA, tamano: 1000,
  subidoPor: { uid: 'fa_admin', nombre: 'Admin Uno' }, en: serverTimestamp(), ...extra
});
/** El lote completo que escribe la pantalla: meta + los 3 slots (escritos o borrados) + registro. */
function lote(d, { id = ID, m = meta(), partes = [bytes(1000)], lt = LOTE, reg = registro() } = {}) {
  const b = writeBatch(d);
  b.set(doc(d, 'fichas_adjuntos', id), m);
  for (let n = 0; n < 3; n++) {
    const r = doc(d, 'fichas_adjuntos', id, 'partes', String(n));
    if (n < partes.length) b.set(r, { bytes: partes[n], lote: lt }); else b.delete(r);
  }
  b.set(doc(collection(d, 'fichas_adjuntos_registro')), reg);
  return b.commit();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'usuarios/fa_admin'),    { email: 'a@x.co', rol: 'admin',   activo: true,  nombre: 'Admin Uno' });
    await setDoc(doc(d, 'usuarios/fa_tech'),     { email: 't@x.co', rol: 'tecnico', activo: true,  nombre: 'Tecnico' });
    await setDoc(doc(d, 'usuarios/fa_inactivo'), { email: 'i@x.co', rol: 'admin',   activo: false, nombre: 'Inactivo' });
    await setDoc(doc(d, 'admins/fa_arranque'), { email: 'x@x.co' });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('fichas_adjuntos — escribe un admin con perfil; lee el equipo', () => {
  test('el admin guarda el lote completo (meta + parte + slots borrados + registro)', async () => {
    await assertSucceeds(lote(db('fa_admin')));
  });
  test('un técnico lee la meta y la parte; no las escribe', async () => {
    await assertSucceeds(getDoc(doc(db('fa_tech'), 'fichas_adjuntos', ID)));
    await assertSucceeds(getDoc(doc(db('fa_tech'), 'fichas_adjuntos', ID, 'partes', '0')));
    await assertFails(lote(db('fa_tech'), { reg: registro({ subidoPor: { uid: 'fa_tech', nombre: 'Tecnico' } }), m: meta({ subidoPor: { uid: 'fa_tech', nombre: 'Tecnico' } }) }));
  });
  test('sin sesión, desactivado o admin de arranque sin perfil: no leen o no escriben', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'fichas_adjuntos', ID)));
    await assertFails(getDoc(doc(db('fa_inactivo'), 'fichas_adjuntos', ID)));
    await assertFails(lote(db('fa_arranque'), { m: meta({ subidoPor: { uid: 'fa_arranque', nombre: '' } }), reg: registro({ subidoPor: { uid: 'fa_arranque', nombre: '' } }) }));
  });
  test('nadie lista las partes; la meta solo el admin y con límite', async () => {
    await assertFails(getDocs(collection(db('fa_admin'), 'fichas_adjuntos', ID, 'partes')));
    await assertFails(getDocs(collection(db('fa_admin'), 'fichas_adjuntos')));
    await assertSucceeds(getDocs(query(collection(db('fa_admin'), 'fichas_adjuntos'), limit(10))));
    await assertFails(getDocs(query(collection(db('fa_tech'), 'fichas_adjuntos'), limit(10))));
  });
});

describe('fichas_adjuntos — lo que la regla NO deja pasar', () => {
  test('un id que no corresponde a la clave', async () => {
    await assertFails(lote(db('fa_admin'), { id: ID2 }));
  });
  test('parte de más de 900 KB, parte «3», lote distinto, parte sin meta', async () => {
    await assertFails(lote(db('fa_admin'), { partes: [Bytes.fromUint8Array(new Uint8Array(900 * 1024 + 1))] }));
    await assertFails(setDoc(doc(db('fa_admin'), 'fichas_adjuntos', ID, 'partes', '3'), { bytes: bytes(10), lote: LOTE }));
    await assertFails(lote(db('fa_admin'), { lt: LOTE2 }));
    await assertFails(setDoc(doc(db('fa_admin'), 'fichas_adjuntos', ID2, 'partes', '0'), { bytes: bytes(10), lote: LOTE }));
  });
  test('una parte por encima de las que declara la meta', async () => {
    await assertFails(lote(db('fa_admin'), { partes: [bytes(10), bytes(10)] })); // meta dice partes: 1
  });
  test('autor ajeno o con otro nombre, campos de más, tipo o mime fuera de lista', async () => {
    await assertFails(lote(db('fa_admin'), { m: meta({ subidoPor: { uid: 'fa_tech', nombre: 'Admin Uno' } }) }));
    await assertFails(lote(db('fa_admin'), { m: meta({ subidoPor: { uid: 'fa_admin', nombre: 'Otro' } }) }));
    await assertFails(lote(db('fa_admin'), { m: meta({ extra: 1 }) }));
    await assertFails(lote(db('fa_admin'), { m: meta({ tipo: 'pdf' }) }));
    await assertFails(lote(db('fa_admin'), { m: meta({ mime: 'image/svg+xml' }) }));
    await assertFails(lote(db('fa_admin'), { m: meta({ tamano: 3 * 900 * 1024 + 1 }) }));
  });
});

describe('fichas_adjuntos — reemplazar y quitar sin partes sueltas', () => {
  test('reemplazo de 3 partes por 1: los slots 1 y 2 se borran en el mismo lote', async () => {
    const d = db('fa_admin');
    await assertSucceeds(lote(d, { m: meta({ partes: 3, lote: LOTE2 }), lt: LOTE2, partes: [bytes(10), bytes(10), bytes(10)], reg: registro({ accion: 'reemplazo' }) }));
    await assertSucceeds(lote(d, { reg: registro({ accion: 'reemplazo' }) }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const x = ctx.firestore();
      const p1 = await getDoc(doc(x, 'fichas_adjuntos', ID, 'partes', '1'));
      const p2 = await getDoc(doc(x, 'fichas_adjuntos', ID, 'partes', '2'));
      if (p1.exists() || p2.exists()) throw new Error('quedaron partes sueltas');
    });
  });
  test('borrar la meta dejando una parte: no; con sus partes y su registro: sí', async () => {
    const d = db('fa_admin');
    await assertFails(deleteDoc(doc(d, 'fichas_adjuntos', ID)));
    const b = writeBatch(d);
    b.delete(doc(d, 'fichas_adjuntos', ID));
    for (let n = 0; n < 3; n++) b.delete(doc(d, 'fichas_adjuntos', ID, 'partes', String(n)));
    b.set(doc(collection(d, 'fichas_adjuntos_registro')), registro({ accion: 'retiro' }));
    await assertSucceeds(b.commit());
  });
});

describe('fichas_adjuntos_registro — solo se agrega', () => {
  test('el admin agrega; nadie edita ni borra; el técnico no agrega', async () => {
    const d = db('fa_admin');
    const r = doc(collection(d, 'fichas_adjuntos_registro'));
    await assertSucceeds(setDoc(r, registro({ accion: 'retiro' })));
    await assertFails(updateDoc(r, { nombre: 'otro' }));
    await assertFails(deleteDoc(r));
    await assertFails(setDoc(doc(collection(db('fa_tech'), 'fichas_adjuntos_registro')), registro({ subidoPor: { uid: 'fa_tech', nombre: 'Tecnico' } })));
    await assertFails(setDoc(doc(collection(d, 'fichas_adjuntos_registro')), registro({ accion: 'borrado' })));
  });
});
