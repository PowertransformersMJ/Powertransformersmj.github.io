// ══════════════════════════════════════════════════════════════
// Reglas de la PLACA CARACTERÍSTICA (TODO-69, ADR-166), en el emulador.
//   · placas_caracteristicas/{id}: lo leído de la placa; lo lee el equipo; lo carga un admin con perfil que firma la
//     carga (carga.por = su uid, carga.en = hora del servidor) con un `paquete` NUEVO por cambio.
//   · partes/{0..2}: la foto JPEG ≤ 900 KB por parte, escrita en la MISMA operación que su meta; nadie lista.
//   · placas_caracteristicas_registro: solo se agrega (alta / reemplazo / retiro).
// Dos direcciones en cada caso (L-73). Un lote = una sola conexión (L-78 §117). Identidades `pc_`. Datos sintéticos.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, limit, writeBatch, serverTimestamp, Bytes } from 'firebase/firestore';

const LOTE = 'abcdef123456'; const LOTE2 = 'zzzzzz999999';
// Una «foto» sintética: empieza como JPEG (FF D8 FF) y su huella es el SHA-256 de sus bytes (la regla lo exige).
const jpeg = (n) => { const u = new Uint8Array(n).fill(7); u.set([0xFF, 0xD8, 0xFF]); return u; };
const sha = (u) => createHash('sha256').update(u).digest('hex');
const H = sha(jpeg(1000)); const HD = 'b'.repeat(64);
const bytes = (n) => Bytes.fromUint8Array(jpeg(n));
// Cada placa es de un transformador del inventario con esa matrícula; pcSinInvent1 no existe.
const IDS = ['pcEquipo0001', 'pcEquipo0002', 'pcEquipo0003', 'pcEquipo0004', 'pcEquipo0005', 'pcSinFoto001', 'pcSinFoto002',
  ...Array.from({ length: 12 }, (_, i) => 'pcMalo' + String(i + 1).padStart(5, '0'))];
let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const foto = (extra = {}) => ({ partes: 1, lote: LOTE, huella: H, mime: 'image/jpeg', ancho: 1600, alto: 1200, bytes: 1000, origen: 'foto', ...extra });
const meta = (uid, paquete, extra = {}) => ({
  schema: 1, matricula: 'T1-PC/PC-PRU', datos: { fabricante: 'X', etapas_kva: { ONAN: 1000 }, tension: { P: '34,5 kV' } },
  fuente: { tipo: 'lectura_de_foto', fecha: '2026-10-18', confianza: 'alta', huella_datos: HD },
  foto: foto(), carga: { por: uid, en: serverTimestamp(), paquete }, ...extra
});
const reg = (uid, id, paquete, accion = 'alta', extra = {}) => ({ idPlaca: id, accion, paquete, matricula: 'T1-PC/PC-PRU', huella: H, huellaDatos: HD, por: uid, en: serverTimestamp(), ...extra });
/** Lo que escribe la página: meta + 3 espacios de parte (escritos o borrados) + registro, en UN lote. */
function cargar(uid, id, paquete, { m, partes = [bytes(1000)], lt = LOTE, sinRegistro = false, accion = 'alta' } = {}) {
  const d = db(uid); const b = writeBatch(d);
  b.set(doc(d, 'placas_caracteristicas', id), m || meta(uid, paquete));
  for (let n = 0; n < 3; n++) {
    const r = doc(d, 'placas_caracteristicas', id, 'partes', String(n));
    if (n < partes.length) b.set(r, { bytes: partes[n], lote: lt }); else b.delete(r);
  }
  if (!sinRegistro) b.set(doc(d, 'placas_caracteristicas_registro', id + '_' + paquete), reg(uid, id, paquete, accion));
  return b.commit();
}
function retirar(uid, id, paquete, { conRegistro = true, dejarParte = false } = {}) {
  const d = db(uid); const b = writeBatch(d);
  b.delete(doc(d, 'placas_caracteristicas', id));
  for (let n = dejarParte ? 1 : 0; n < 3; n++) b.delete(doc(d, 'placas_caracteristicas', id, 'partes', String(n)));
  if (conRegistro) b.set(doc(d, 'placas_caracteristicas_registro', id + '_' + paquete + '_retiro'), reg(uid, id, paquete, 'retiro'));
  return b.commit();
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId: 'demo-sgm-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'usuarios/pc_admin'), { email: 'a@x.co', rol: 'admin', activo: true, nombre: 'Admin' });
    await setDoc(doc(d, 'usuarios/pc_tech'), { email: 't@x.co', rol: 'tecnico', activo: true, nombre: 'Tecnico' });
    await setDoc(doc(d, 'usuarios/pc_inactivo'), { email: 'i@x.co', rol: 'admin', activo: false, nombre: 'Inactivo' });
    await setDoc(doc(d, 'admins/pc_arranque'), { email: 'x@x.co' });
    for (const id of IDS) await setDoc(doc(d, 'transformadores', id), { identificacion: { matricula: 'T1-PC/PC-PRU' } });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('placas_caracteristicas — carga el admin con perfil; lee el equipo', () => {
  test('el admin carga la placa con su foto y su registro; el técnico la lee pero no la carga', async () => {
    await assertSucceeds(cargar('pc_admin', 'pcEquipo0001', 'paq-1'));
    await assertSucceeds(getDoc(doc(db('pc_tech'), 'placas_caracteristicas', 'pcEquipo0001')));
    await assertSucceeds(getDoc(doc(db('pc_tech'), 'placas_caracteristicas', 'pcEquipo0001', 'partes', '0')));
    await assertFails(cargar('pc_tech', 'pcEquipo0002', 'paq-1'));
  });
  test('sin sesión, desactivado o admin de arranque sin perfil: no leen o no cargan', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'placas_caracteristicas', 'pcEquipo0001')));
    await assertFails(getDoc(doc(db('pc_inactivo'), 'placas_caracteristicas', 'pcEquipo0001')));
    await assertFails(cargar('pc_arranque', 'pcEquipo0003', 'paq-1'));
  });
  test('un reemplazo con paquete nuevo pasa; con el mismo paquete, no', async () => {
    await assertSucceeds(cargar('pc_admin', 'pcEquipo0001', 'paq-2', { lt: LOTE2, m: meta('pc_admin', 'paq-2', { foto: foto({ lote: LOTE2 }) }), accion: 'reemplazo' }));
    await assertFails(cargar('pc_admin', 'pcEquipo0001', 'paq-2', { lt: LOTE2, m: meta('pc_admin', 'paq-2', { foto: foto({ lote: LOTE2 }) }), accion: 'reemplazo' }));
  });
  test('una foto de 3 partes con su registro pasa; nadie lista las partes; la meta solo el admin con límite', async () => {
    await assertSucceeds(cargar('pc_admin', 'pcEquipo0004', 'paq-1', { m: meta('pc_admin', 'paq-1', { foto: foto({ partes: 3, bytes: 3000 }) }), partes: [bytes(1000), bytes(1000), bytes(1000)] }));
    await assertFails(getDocs(collection(db('pc_admin'), 'placas_caracteristicas', 'pcEquipo0004', 'partes')));
    await assertFails(getDocs(collection(db('pc_admin'), 'placas_caracteristicas')));
    await assertSucceeds(getDocs(query(collection(db('pc_admin'), 'placas_caracteristicas'), limit(10))));
    await assertFails(getDocs(query(collection(db('pc_tech'), 'placas_caracteristicas'), limit(10))));
  });
  test('una placa sin foto (foto: null) se carga con su registro y no admite partes', async () => {
    await assertSucceeds(cargar('pc_admin', 'pcSinFoto001', 'paq-1', { m: meta('pc_admin', 'paq-1', { foto: null }), partes: [] }));
    await assertFails(cargar('pc_admin', 'pcSinFoto002', 'paq-1', { m: meta('pc_admin', 'paq-1', { foto: null }) }));
  });
  test('retiro completo (meta + 3 partes + registro «retiro») pasa', async () => {
    await assertSucceeds(retirar('pc_admin', 'pcEquipo0004', 'paq-1'));
  });
});

describe('placas_caracteristicas — lo que la regla NO deja pasar', () => {
  test('sin su registro, o con la carga firmada por otro uid', async () => {
    await assertFails(cargar('pc_admin', 'pcMalo00001', 'paq-1', { sinRegistro: true }));
    await assertFails(cargar('pc_admin', 'pcMalo00002', 'paq-1', { m: meta('pc_tech', 'paq-1') }));
  });
  test('meta con paquete nuevo sin sus partes; parte suelta sin cambiar la carga; parte de otro lote', async () => {
    const d = db('pc_admin');
    await assertFails(setDoc(doc(d, 'placas_caracteristicas', 'pcEquipo0001'), meta('pc_admin', 'paq-9')));
    await assertFails(setDoc(doc(d, 'placas_caracteristicas', 'pcEquipo0001', 'partes', '0'), { bytes: bytes(20), lote: LOTE2 }));
    await assertFails(cargar('pc_admin', 'pcMalo00003', 'paq-1', { lt: 'otrolote9999' }));
  });
  test('borrar la parte de una foto viva, o la meta dejando partes, no pasa', async () => {
    await assertFails(deleteDoc(doc(db('pc_admin'), 'placas_caracteristicas', 'pcEquipo0001', 'partes', '0')));
    await assertFails(retirar('pc_admin', 'pcEquipo0001', 'paq-2', { dejarParte: true }));
    await assertFails(retirar('pc_admin', 'pcEquipo0001', 'paq-2', { conRegistro: false }));
  });
  test('parte de más de 900 KB, más partes que las declaradas, foto que no es JPEG, campos de más, notas enormes', async () => {
    await assertFails(cargar('pc_admin', 'pcMalo00004', 'paq-1', { partes: [Bytes.fromUint8Array(new Uint8Array(900 * 1024 + 1))] }));
    await assertFails(cargar('pc_admin', 'pcMalo00005', 'paq-1', { partes: [bytes(10), bytes(10)] }));
    await assertFails(cargar('pc_admin', 'pcMalo00006', 'paq-1', { m: meta('pc_admin', 'paq-1', { foto: foto({ mime: 'image/png' }) }) }));
    await assertFails(cargar('pc_admin', 'pcMalo00007', 'paq-1', { m: { ...meta('pc_admin', 'paq-1'), extra: 1 } }));
    await assertFails(cargar('pc_admin', 'pcMalo00008', 'paq-1', { m: meta('pc_admin', 'paq-1', { datos: { notas: 'x'.repeat(4001) } }) }));
  });
  test('huella que no es la de los bytes; parte 0 que no empieza como JPEG', async () => {
    await assertFails(cargar('pc_admin', 'pcMalo00009', 'paq-1', { m: meta('pc_admin', 'paq-1', { foto: foto({ huella: 'c'.repeat(64) }) }) }));
    const noJpeg = new Uint8Array(1000).fill(7);
    await assertFails(cargar('pc_admin', 'pcMalo00010', 'paq-1', { m: meta('pc_admin', 'paq-1', { foto: foto({ huella: sha(noJpeg) }) }), partes: [Bytes.fromUint8Array(noJpeg)] }));
  });
  test('matrícula distinta a la del inventario, o un transformador que no existe', async () => {
    await assertFails(cargar('pc_admin', 'pcMalo00011', 'paq-1', { m: meta('pc_admin', 'paq-1', { matricula: 'T2-OTRA' }) }));
    await assertFails(cargar('pc_admin', 'pcSinInvent1', 'paq-1'));
  });
  test('un «retiro» sembrado antes de que la placa exista, o con otro paquete, no pasa (y no estorba el real)', async () => {
    const d = db('pc_admin');
    await assertFails(setDoc(doc(d, 'placas_caracteristicas_registro', 'pcEquipo0005_paq-1_retiro'), reg('pc_admin', 'pcEquipo0005', 'paq-1', 'retiro')));
    await assertSucceeds(cargar('pc_admin', 'pcEquipo0005', 'paq-1'));
    await assertFails(setDoc(doc(d, 'placas_caracteristicas_registro', 'pcEquipo0005_paq-7_retiro'), reg('pc_admin', 'pcEquipo0005', 'paq-7', 'retiro')));
    await assertSucceeds(retirar('pc_admin', 'pcEquipo0005', 'paq-1'));
  });
  test('el registro no se reescribe ni se borra', async () => {
    const d = db('pc_admin');
    await assertFails(setDoc(doc(d, 'placas_caracteristicas_registro', 'pcEquipo0001_paq-1'), reg('pc_admin', 'pcEquipo0001', 'paq-1')));
    await assertFails(deleteDoc(doc(d, 'placas_caracteristicas_registro', 'pcEquipo0001_paq-1')));
  });
});
