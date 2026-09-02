// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Tests de storage.rules (TODO-46, cola de ADR-071)
// ──────────────────────────────────────────────────────────────
// `storage.rules` se desplegó SIN una sola prueba. El deploy solo
// COMPILA las reglas: comprueba que la sintaxis es válida, no que
// hagan lo que prometen. La promesa central de ADR-071 —"nadie puede
// descargar la firma de otro ni aunque conozca la ruta"— nunca se
// había demostrado, y es justo la que sostiene que el sitio no sirva
// para estampar la firma ajena en un documento.
//
// Corre con el emulador de Storage Y el de Firestore a la vez: las
// reglas de Storage consultan Firestore (`firestore.exists/get` sobre
// `/usuarios/{uid}`), así que sin el segundo emulador `isTeamMember()`
// no se puede evaluar. De ahí el `--only firestore,storage` de
// `npm run test:rules`.
//
// Los uid llevan prefijo `s_` para no pisarse con los de
// `firestore.rules.test.js`: el runner de node corre los archivos en
// procesos paralelos contra el MISMO emulador. Por la misma razón
// aquí NUNCA se llama a `clearFirestore()`, que borraría la semilla
// del otro archivo a mitad de su corrida.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import {
  ref, uploadBytes, getBytes, deleteObject, listAll, getMetadata
} from 'firebase/storage';

const PROJECT_ID = 'demo-sgm-rules';

// Cabecera PNG real: las reglas miran `contentType` (que lo declara el
// cliente), pero el emulador también inspecciona el archivo, así que se
// usa un PNG mínimo de verdad y no bytes al azar.
const PNG = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // firma PNG
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52  // cabecera IHDR
]);
const PNG_META = { contentType: 'image/png' };

// 1 MB + 1 byte: un byte por encima del tope de `firmas/{uid}`.
const PNG_GRANDE = new Uint8Array(1 * 1024 * 1024 + 1);
PNG_GRANDE.set(PNG, 0);

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4

let testEnv;

/** Storage del usuario `uid` con sesión abierta. */
const como = (uid) => testEnv.authenticatedContext(uid).storage();
/** Storage sin sesión. */
const anonimo = () => testEnv.unauthenticatedContext().storage();

/** Siembra un objeto SIN pasar por las reglas (para probar lecturas). */
async function sembrarObjeto(ruta, bytes = PNG, meta = PNG_META) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), ruta), bytes, meta);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    },
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199
    }
  });

  // ── Semilla de identidades en Firestore (con reglas DESHABILITADAS) ──
  // storage.rules no tiene identidades propias: las lee de /usuarios y
  // /admins. Sin esta semilla, todo el mundo sería un desconocido.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/s_admin'),   { email: 'a@x.co', rol: 'admin',   activo: true });
    await setDoc(doc(db, 'usuarios/s_tech'),    { email: 't@x.co', rol: 'tecnico', activo: true });
    await setDoc(doc(db, 'usuarios/s_otro'),    { email: 'o@x.co', rol: 'tecnico', activo: true });
    await setDoc(doc(db, 'usuarios/s_revocado'), { email: 'r@x.co', rol: 'admin',  activo: false });
    // En /admins pero DESACTIVADO en /usuarios: el caso que ADR-052 cerró.
    await setDoc(doc(db, 'admins/s_revocado'),  { legacy: true });
    // Bootstrap puro: en /admins y SIN perfil en /usuarios. Se conserva
    // para no dejar el proyecto sin ningún admin posible.
    await setDoc(doc(db, 'admins/s_bootstrap'), { legacy: true });
  });

  // ── Semilla de objetos en el bucket ──
  await sembrarObjeto('firmas/s_tech');
  await sembrarObjeto('firmas/s_otro');
  await sembrarObjeto('documentos/doc1/informe.pdf', PDF, { contentType: 'application/pdf' });
  await sembrarObjeto('contratos/c1/contrato.pdf', PDF, { contentType: 'application/pdf' });
  await sembrarObjeto('pruebas_electricas/u1/informe.pdf', PDF, { contentType: 'application/pdf' });
  await sembrarObjeto('otros/suelto.png');
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

// ══════════════════════════════════════════════════════════════
// FIRMAS — la promesa de ADR-071
// ══════════════════════════════════════════════════════════════
describe('storage.rules · firmas/{uid} — la firma es SOLO de su dueño (ADR-071)', () => {

  test('sin sesión NO puede leer una firma', async () => {
    await assertFails(getBytes(ref(anonimo(), 'firmas/s_tech')));
  });

  test('sin sesión NO puede subir una firma', async () => {
    await assertFails(uploadBytes(ref(anonimo(), 'firmas/s_tech'), PNG, PNG_META));
  });

  test('el dueño SÍ lee su propia firma', async () => {
    await assertSucceeds(getBytes(ref(como('s_tech'), 'firmas/s_tech')));
  });

  test('el dueño SÍ sube su propia firma (PNG ≤ 1 MB)', async () => {
    await assertSucceeds(uploadBytes(ref(como('s_tech'), 'firmas/s_tech'), PNG, PNG_META));
  });

  // 🔒 EL INVARIANTE CENTRAL: si esto se rompe, el sitio sirve para
  // estampar la firma ajena — justo lo que ADR-070 retiró del repo público.
  test('otro miembro ACTIVO del equipo NO lee la firma ajena', async () => {
    await assertFails(getBytes(ref(como('s_otro'), 'firmas/s_tech')));
  });

  test('otro miembro NO puede sobrescribir la firma ajena', async () => {
    await assertFails(uploadBytes(ref(como('s_otro'), 'firmas/s_tech'), PNG, PNG_META));
  });

  test('otro miembro NO puede borrar la firma ajena', async () => {
    await assertFails(deleteObject(ref(como('s_otro'), 'firmas/s_tech')));
  });

  // Decisión explícita de ADR-071: la firma manuscrita es un dato
  // personalísimo. Que un administrador pudiera subirla o leerla por otro
  // rompería la única garantía que da el mecanismo.
  test('ni siquiera un ADMIN lee o escribe la firma de otro', async () => {
    await assertFails(getBytes(ref(como('s_admin'), 'firmas/s_tech')));
    await assertFails(uploadBytes(ref(como('s_admin'), 'firmas/s_tech'), PNG, PNG_META));
  });

  test('tampoco puede leerla por los METADATOS (getMetadata también es read)', async () => {
    await assertFails(getMetadata(ref(como('s_otro'), 'firmas/s_tech')));
  });

  test('un usuario REVOCADO (activo:false) no puede leer ni subir la suya', async () => {
    await assertFails(getBytes(ref(como('s_revocado'), 'firmas/s_revocado')));
    await assertFails(uploadBytes(ref(como('s_revocado'), 'firmas/s_revocado'), PNG, PNG_META));
  });

  test('un autenticado SIN perfil en /usuarios no puede subir firma', async () => {
    await assertFails(uploadBytes(ref(como('s_fantasma'), 'firmas/s_fantasma'), PNG, PNG_META));
  });

  test('rechaza un JPG aunque sea del dueño (solo PNG conserva el fondo transparente)', async () => {
    await assertFails(
      uploadBytes(ref(como('s_tech'), 'firmas/s_tech'), PNG, { contentType: 'image/jpeg' })
    );
  });

  test('rechaza un PNG de más de 1 MB', async () => {
    await assertFails(
      uploadBytes(ref(como('s_tech'), 'firmas/s_tech'), PNG_GRANDE, PNG_META)
    );
  });

  test('el dueño SÍ borra su propia firma', async () => {
    await sembrarObjeto('firmas/s_borrable');
    await assertSucceeds(deleteObject(ref(como('s_borrable'), 'firmas/s_borrable')));
  });

  // El match es de UN solo segmento (`/firmas/{uid}`), así que una subruta
  // cae en el comodín final y queda cerrada. Sin esta prueba, cambiar el
  // match a `{uid=**}` abriría un agujero sin que nada avisara.
  test('una SUBRUTA bajo firmas/ queda cerrada, incluso para el propio uid', async () => {
    await assertFails(
      uploadBytes(ref(como('s_tech'), 'firmas/s_tech/extra.png'), PNG, PNG_META)
    );
  });

  // Fuga de metadatos: aunque no pueda leer el contenido, saber QUÉ uids
  // tienen firma cargada ya es información sobre las personas.
  test('nadie puede LISTAR el prefijo firmas/ para descubrir quién tiene firma', async () => {
    await assertFails(listAll(ref(como('s_admin'), 'firmas')));
    await assertFails(listAll(ref(como('s_tech'), 'firmas')));
  });
});

// ══════════════════════════════════════════════════════════════
// DOCUMENTOS TÉCNICOS, CONTRATOS Y PRUEBAS ELÉCTRICAS
// Mismo criterio en las tres: lee el equipo ACTIVO, escribe el admin.
// ══════════════════════════════════════════════════════════════
const RUTAS_DE_EQUIPO = [
  { nombre: 'documentos',         objeto: 'documentos/doc1/informe.pdf',          nuevo: 'documentos/doc1/nuevo.pdf' },
  { nombre: 'contratos',          objeto: 'contratos/c1/contrato.pdf',            nuevo: 'contratos/c1/nuevo.pdf' },
  { nombre: 'pruebas_electricas', objeto: 'pruebas_electricas/u1/informe.pdf',    nuevo: 'pruebas_electricas/u1/nuevo.pdf' }
];

describe('storage.rules · rutas del equipo — lee el activo, escribe el admin', () => {
  for (const r of RUTAS_DE_EQUIPO) {
    test(`${r.nombre}: sin sesión NO lee`, async () => {
      await assertFails(getBytes(ref(anonimo(), r.objeto)));
    });

    test(`${r.nombre}: miembro ACTIVO SÍ lee`, async () => {
      await assertSucceeds(getBytes(ref(como('s_tech'), r.objeto)));
    });

    test(`${r.nombre}: no-admin NO escribe`, async () => {
      await assertFails(uploadBytes(ref(como('s_tech'), r.nuevo), PDF, { contentType: 'application/pdf' }));
    });

    test(`${r.nombre}: admin SÍ escribe`, async () => {
      await assertSucceeds(uploadBytes(ref(como('s_admin'), r.nuevo), PDF, { contentType: 'application/pdf' }));
    });

    // ADR-052: un admin desactivado pierde los PDFs igual que pierde los
    // datos en Firestore. Figurar en /admins ya no basta.
    test(`${r.nombre}: admin REVOCADO (en /admins pero activo:false) no lee ni escribe`, async () => {
      await assertFails(getBytes(ref(como('s_revocado'), r.objeto)));
      await assertFails(uploadBytes(ref(como('s_revocado'), r.nuevo), PDF, { contentType: 'application/pdf' }));
    });
  }

  // El bootstrap legacy existe para no dejar el proyecto sin ningún admin
  // posible. Si esta prueba se cae, alguien lo eliminó sin darse cuenta de
  // que era la última llave.
  test('bootstrap legacy (en /admins, sin perfil en /usuarios) conserva acceso de admin', async () => {
    await assertSucceeds(getBytes(ref(como('s_bootstrap'), 'documentos/doc1/informe.pdf')));
    await assertSucceeds(
      uploadBytes(ref(como('s_bootstrap'), 'documentos/doc1/boot.pdf'), PDF, { contentType: 'application/pdf' })
    );
  });
});

// ══════════════════════════════════════════════════════════════
// CIERRE POR DEFECTO
// ══════════════════════════════════════════════════════════════
describe('storage.rules · todo lo no declarado está cerrado', () => {
  test('una ruta no declarada está cerrada incluso para un admin', async () => {
    await assertFails(getBytes(ref(como('s_admin'), 'otros/suelto.png')));
    await assertFails(uploadBytes(ref(como('s_admin'), 'otros/nuevo.png'), PNG, PNG_META));
  });

  test('la raíz del bucket no se puede listar', async () => {
    await assertFails(listAll(ref(como('s_admin'), '')));
  });
});
