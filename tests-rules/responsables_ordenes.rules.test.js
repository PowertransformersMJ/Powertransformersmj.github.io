// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Reglas del directorio de cédulas (99 §78)
// ──────────────────────────────────────────────────────────────
// Nombres y números INVENTADOS (el repositorio es público). Cubre las dos
// direcciones (L-78): el equipo activo lee una a una, el admin escribe; el
// técnico no escribe ni lista; desactivados y sin perfil no leen; la forma
// del documento (id, dígitos, autorización, autor) se impone.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach, describe } from 'node:test';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, collection, query, limit, serverTimestamp
} from 'firebase/firestore';

const PROJECT_ID = 'demo-sgm-rules-cedulas';
let testEnv;

const PERFILES = {
  admin:     { rol: 'admin',   activo: true,  nombre: 'ADMIN UNO' },
  tec:       { rol: 'tecnico', activo: true,  nombre: 'TECNICO UNO' },
  adminOff:  { rol: 'admin',   activo: false, nombre: 'ADMIN APAGADO' },
  tecOff:    { rol: 'tecnico', activo: false, nombre: 'TECNICO APAGADO' },
  adminSinNombre: { rol: 'admin', activo: true }
};

const db = (uid) => (uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext()).firestore();
const ref = (d, id = 'PERSONA_DOS') => doc(d, 'responsables_ordenes', id);

function ficha(uid, extra) {
  return Object.assign({
    nombre: 'PERSONA DOS', cedula: '20000002',
    autorizacion: { fecha: '2030-01-01', medio: 'correo de prueba' },
    actualizadoPor: { uid, nombre: (PERFILES[uid] && PERFILES[uid].nombre) || '' },
    actualizadoEn: serverTimestamp()
  }, extra || {});
}

async function sembrar() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(ctx.firestore()), { nombre: 'PERSONA DOS', cedula: '20000002',
      autorizacion: { fecha: '2030-01-01', medio: 'correo de prueba' },
      actualizadoPor: { uid: 'admin', nombre: 'ADMIN UNO' }, actualizadoEn: new Date() });
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
    for (const [uid, p] of Object.entries(PERFILES)) await setDoc(doc(ctx.firestore(), 'usuarios', uid), p);
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('responsables_ordenes — lectura', () => {
  test('técnico y admin activos leen UNA cédula por nombre', async () => {
    await sembrar();
    await assertSucceeds(getDoc(ref(db('tec'))));
    await assertSucceeds(getDoc(ref(db('admin'))));
  });

  test('sin sesión, sin perfil o desactivados NO leen', async () => {
    await sembrar();
    await assertFails(getDoc(ref(db(null))));
    await assertFails(getDoc(ref(db('intruso'))));
    await assertFails(getDoc(ref(db('tecOff'))));
    await assertFails(getDoc(ref(db('adminOff'))));
  });

  test('listar el directorio: solo admin activo y con límite ≤ 50', async () => {
    await sembrar();
    await assertSucceeds(getDocs(query(collection(db('admin'), 'responsables_ordenes'), limit(50))));
    await assertFails(getDocs(query(collection(db('admin'), 'responsables_ordenes'), limit(51))));
    await assertFails(getDocs(collection(db('admin'), 'responsables_ordenes')));
    await assertFails(getDocs(query(collection(db('tec'), 'responsables_ordenes'), limit(50))));
  });
});

describe('responsables_ordenes — escritura', () => {
  test('el admin activo crea y actualiza', async () => {
    await assertSucceeds(setDoc(ref(db('admin')), ficha('admin')));
    await assertSucceeds(setDoc(ref(db('admin')), ficha('admin', { cedula: '20000003' })));
  });

  test('un técnico NO escribe ni borra; un admin desactivado tampoco', async () => {
    await assertFails(setDoc(ref(db('tec')), ficha('tec')));
    await assertFails(setDoc(ref(db('adminOff')), ficha('adminOff')));
    await sembrar();
    await assertFails(deleteDoc(ref(db('tec'))));
    await assertFails(deleteDoc(ref(db('adminOff'))));
  });

  test('el admin borra', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(ref(db('admin'))));
  });

  test('el id debe salir del nombre, con TODOS los espacios y la Ñ', async () => {
    const d = db('admin');
    await assertSucceeds(setDoc(doc(d, 'responsables_ordenes', 'PEÑA_TRES_CUATRO'), ficha('admin', { nombre: 'PEÑA TRES CUATRO' })));
    await assertFails(setDoc(doc(d, 'responsables_ordenes', 'PEÑA_TRES CUATRO'), ficha('admin', { nombre: 'PEÑA TRES CUATRO' })));
    await assertFails(setDoc(doc(d, 'responsables_ordenes', 'OTRA_PERSONA'), ficha('admin')));
  });

  test('cédula con puntos, letras o largo imposible se rechaza', async () => {
    for (const cedula of ['20.000.002', '2000000A', '1234', '1234567890123', 20000002]) {
      await assertFails(setDoc(ref(db('admin')), ficha('admin', { cedula })));
    }
  });

  test('nombre en minúsculas o con tilde se rechaza', async () => {
    const d = db('admin');
    await assertFails(setDoc(doc(d, 'responsables_ordenes', 'persona_dos'), ficha('admin', { nombre: 'persona dos' })));
    await assertFails(setDoc(doc(d, 'responsables_ordenes', 'JOSÉ_DOS'), ficha('admin', { nombre: 'JOSÉ DOS' })));
  });

  test('sin autorización declarada, o con una vacía, se rechaza', async () => {
    const { autorizacion, ...sin } = ficha('admin');
    await assertFails(setDoc(ref(db('admin')), sin));
    await assertFails(setDoc(ref(db('admin')), ficha('admin', { autorizacion: { fecha: '2030-01-01', medio: '' } })));
    await assertFails(setDoc(ref(db('admin')), ficha('admin', { autorizacion: { fecha: 'ayer', medio: 'correo' } })));
  });

  test('campos de más (otra persona, firma) se rechazan', async () => {
    await assertFails(setDoc(ref(db('admin')), ficha('admin', { firma: 'data:image/png;base64,AAAA' })));
  });

  test('autor falso o fecha inventada se rechazan', async () => {
    await assertFails(setDoc(ref(db('admin')), ficha('admin', { actualizadoPor: { uid: 'tec', nombre: 'TECNICO UNO' } })));
    await assertFails(setDoc(ref(db('admin')), ficha('admin', { actualizadoPor: { uid: 'admin', nombre: 'OTRO' } })));
    await assertFails(setDoc(ref(db('admin')), ficha('admin', { actualizadoEn: new Date('2020-01-01') })));
  });

  test('un admin cuyo perfil no tiene nombre SÍ escribe (firma con nombre vacío, igual que su perfil)', async () => {
    await assertSucceeds(setDoc(ref(db('adminSinNombre')), ficha('adminSinNombre')));
  });

  test('el lote EXACTO del editor (ficha + bitácora) pasa para el admin y cae entero para el técnico', async () => {
    const lote = (uid) => {
      const d = db(uid);
      const b = writeBatch(d);
      b.set(ref(d), ficha(uid));
      b.set(doc(collection(d, 'auditoria')), { accion: 'actualizar', coleccion: 'responsables_ordenes',
        docId: 'PERSONA_DOS', nota: 'cédula de PERSONA DOS: (sin cédula) → •••002', at: serverTimestamp() });
      return b.commit();
    };
    await assertSucceeds(lote('admin'));
    await assertFails(lote('tec'));
  });
});
