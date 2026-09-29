// ══════════════════════════════════════════════════════════════
// «Diagrama Operativo» (ADR-118): con el permiso «fichas.adjuntar_operativo» en su perfil
// (lo pone SOLO el admin), un técnico adjunta y reemplaza; quitar sigue siendo del admin.
// (Base del archivo: las reglas de ADR-112, en fichas_adjuntos.rules.test.js.)
//   · fichas_adjuntos/{id}: la meta; lo lee el equipo, lo escribe un admin con
//     perfil; el id sale de la identidad (sha256 de «M:matrícula»).
//   · partes/{0..2}: bytes ≤ 900 KB atados a la meta por `lote`; nadie lista.
//   · fichas_adjuntos_registro: solo se agrega (alta/reemplazo/retiro), sin bytes.
// Dos direcciones en cada caso (L-73). Identidades con prefijo `fp_` (otra clave: no choca con fa_).
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, limit, writeBatch, serverTimestamp, Bytes
} from 'firebase/firestore';

const CLAVE = 'M:T1-FP-PRUEBA';
const ID = 'salud_' + createHash('sha256').update(CLAVE).digest('hex');
const CLAVE2 = 'S:SERIE-FP-2';
const ID2 = 'salud_' + createHash('sha256').update(CLAVE2).digest('hex');
const HUELLA = 'c'.repeat(64);
const LOTE = 'ABCDEFGHIJabcdefghij';
const LOTE2 = 'ZZZZZZZZZZyyyyyyyyyy';
const bytes = (n) => Bytes.fromUint8Array(new Uint8Array(n).fill(7));

let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const meta = (extra = {}) => ({
  clave: CLAVE, matricula: 'T1-FP-PRUEBA', serie: '', documento: 'salud', tipo: 'excel',
  origen: { nombre: 'cronograma.xlsx', hoja: 'Cronograma trabajos' }, mime: 'image/png', ancho: 1226, alto: 472,
  tamano: 1000, partes: 1, huella: HUELLA, lote: LOTE, subidoPor: { uid: 'fp_carlos', nombre: 'Carlos FP' }, en: serverTimestamp(), ...extra
});
const registro = (extra = {}) => ({
  idAdjunto: ID, accion: 'alta', lote: LOTE, nombre: 'cronograma.xlsx', huella: HUELLA, tamano: 1000,
  subidoPor: { uid: 'fp_carlos', nombre: 'Carlos FP' }, en: serverTimestamp(), ...extra
});
const idRegistro = (r) => r.idAdjunto + '_' + r.lote + (r.accion === 'retiro' ? '_retiro' : '');
/** El lote completo que escribe la pantalla: meta + los 3 slots (escritos o borrados) + registro con id fijo. */
function lote(d, { id = ID, m = meta(), partes = [bytes(1000)], lt = LOTE, reg = registro(), sinRegistro = false, idReg } = {}) {
  const b = writeBatch(d);
  b.set(doc(d, 'fichas_adjuntos', id), m);
  for (let n = 0; n < 3; n++) {
    const r = doc(d, 'fichas_adjuntos', id, 'partes', String(n));
    if (n < partes.length) b.set(r, { bytes: partes[n], lote: lt }); else b.delete(r);
  }
  if (!sinRegistro) b.set(doc(d, 'fichas_adjuntos_registro', idReg || idRegistro(reg)), reg);
  return b.commit();
}
function retiro(d, loteMeta, { conRegistro = true } = {}) {
  const b = writeBatch(d);
  b.delete(doc(d, 'fichas_adjuntos', ID));
  for (let n = 0; n < 3; n++) b.delete(doc(d, 'fichas_adjuntos', ID, 'partes', String(n)));
  const reg = registro({ accion: 'retiro', lote: loteMeta });
  if (conRegistro) b.set(doc(d, 'fichas_adjuntos_registro', idRegistro(reg)), reg);
  return b.commit();
}

const PERM = 'fichas.adjuntar_operativo';
const de = (uid, nombre) => ({ subidoPor: { uid, nombre } });

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'usuarios/fp_admin'),    { email: 'a@x.co', rol: 'admin',   activo: true,  nombre: 'Admin FP' });
    await setDoc(doc(d, 'usuarios/fp_carlos'),   { email: 'c@x.co', rol: 'tecnico', activo: true,  nombre: 'Carlos FP', permisos_extra: [PERM] });
    await setDoc(doc(d, 'usuarios/fp_jorge'),    { email: 'j@x.co', rol: 'tecnico', activo: true,  nombre: 'Jorge FP', permisos_extra: ['otro.permiso', PERM] });
    await setDoc(doc(d, 'usuarios/fp_sin'),      { email: 's@x.co', rol: 'tecnico', activo: true,  nombre: 'Sin Permiso FP' });
    await setDoc(doc(d, 'usuarios/fp_otro'),     { email: 'o@x.co', rol: 'tecnico', activo: true,  nombre: 'Otro Permiso FP', permisos_extra: ['inventario.editar'] });
    await setDoc(doc(d, 'usuarios/fp_inactivo'), { email: 'i@x.co', rol: 'tecnico', activo: false, nombre: 'Inactivo FP', permisos_extra: [PERM] });
    await setDoc(doc(d, 'usuarios/fp_raro'),     { email: 'r@x.co', rol: 'tecnico', activo: true,  nombre: 'Raro FP', permisos_extra: PERM });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('con el permiso en su perfil, un técnico adjunta y reemplaza', () => {
  test('Carlos (con permiso) adjunta el lote completo a su nombre', async () => {
    await assertSucceeds(lote(db('fp_carlos')));
  });
  test('Jorge (con permiso, entre otros) reemplaza 1 parte por 3 y luego 3 por 1 (borra los espacios que sobran)', async () => {
    const d = db('fp_jorge'); const J = de('fp_jorge', 'Jorge FP');
    await assertSucceeds(lote(d, { m: meta({ partes: 3, lote: LOTE2, ...J }), lt: LOTE2, partes: [bytes(10), bytes(10), bytes(10)], reg: registro({ accion: 'reemplazo', lote: LOTE2, ...J }) }));
    const L3 = 'QQQQQQQQQQwwwwwwwwww';
    await assertSucceeds(lote(d, { m: meta({ lote: L3, ...J }), lt: L3, reg: registro({ accion: 'reemplazo', lote: L3, ...J }) }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const x = ctx.firestore();
      if ((await getDoc(doc(x, 'fichas_adjuntos', ID, 'partes', '1'))).exists()) throw new Error('quedó la parte 1');
    });
  });
  test('a nombre de otro, no', async () => {
    const L4 = 'RRRRRRRRRRtttttttttt';
    await assertFails(lote(db('fp_carlos'), { m: meta({ lote: L4, ...de('fp_jorge', 'Jorge FP') }), lt: L4, reg: registro({ accion: 'reemplazo', lote: L4, ...de('fp_jorge', 'Jorge FP') }) }));
  });
});

describe('QUITAR sigue siendo solo del administrador', () => {
  test('con permiso no se quita (ni con su registro de retiro), ni se borra una parte suelta', async () => {
    await assertFails(retiro(db('fp_carlos'), 'QQQQQQQQQQwwwwwwwwww'));
    await assertFails(deleteDoc(doc(db('fp_carlos'), 'fichas_adjuntos', ID, 'partes', '0')));
    await assertFails(setDoc(doc(db('fp_carlos'), 'fichas_adjuntos_registro', ID + '_QQQQQQQQQQwwwwwwwwww_retiro'),
      registro({ accion: 'retiro', lote: 'QQQQQQQQQQwwwwwwwwww' })));
  });
  test('el administrador sí', async () => {
    const d = db('fp_admin');
    const b = writeBatch(d);
    b.delete(doc(d, 'fichas_adjuntos', ID));
    for (let n = 0; n < 3; n++) b.delete(doc(d, 'fichas_adjuntos', ID, 'partes', String(n)));
    b.set(doc(d, 'fichas_adjuntos_registro', ID + '_QQQQQQQQQQwwwwwwwwww_retiro'),
      registro({ accion: 'retiro', lote: 'QQQQQQQQQQwwwwwwwwww', ...de('fp_admin', 'Admin FP') }));
    await assertSucceeds(b.commit());
  });
});

describe('sin el permiso, no', () => {
  test('técnico sin permiso, con OTRO permiso, desactivado o con el permiso mal escrito: no adjuntan', async () => {
    for (const [uid, nombre] of [['fp_sin', 'Sin Permiso FP'], ['fp_otro', 'Otro Permiso FP'], ['fp_inactivo', 'Inactivo FP'], ['fp_raro', 'Raro FP']]) {
      await assertFails(lote(db(uid), { id: ID2, m: meta({ clave: CLAVE2, matricula: '', serie: 'SERIE-FP-2', ...de(uid, nombre) }),
        reg: registro({ idAdjunto: ID2, ...de(uid, nombre) }) }));
    }
  });
  test('nadie se da el permiso a sí mismo ni a otro: solo el admin escribe /usuarios', async () => {
    await assertFails(updateDoc(doc(db('fp_sin'), 'usuarios/fp_sin'), { permisos_extra: [PERM] }));
    await assertFails(updateDoc(doc(db('fp_carlos'), 'usuarios/fp_sin'), { permisos_extra: [PERM] }));
    await assertSucceeds(updateDoc(doc(db('fp_admin'), 'usuarios/fp_sin'), { permisos_extra: [PERM] }));
  });
  test('con el permiso recién dado por el admin, ya adjunta; al quitárselo, ya no', async () => {
    const S = de('fp_sin', 'Sin Permiso FP');
    await assertSucceeds(lote(db('fp_sin'), { id: ID2, m: meta({ clave: CLAVE2, matricula: '', serie: 'SERIE-FP-2', ...S }), reg: registro({ idAdjunto: ID2, ...S }) }));
    await assertSucceeds(updateDoc(doc(db('fp_admin'), 'usuarios/fp_sin'), { permisos_extra: [] }));
    const L5 = 'SSSSSSSSSSuuuuuuuuuu';
    await assertFails(lote(db('fp_sin'), { id: ID2, lt: L5, m: meta({ clave: CLAVE2, matricula: '', serie: 'SERIE-FP-2', lote: L5, ...S }), reg: registro({ idAdjunto: ID2, accion: 'reemplazo', lote: L5, ...S }) }));
  });
});
