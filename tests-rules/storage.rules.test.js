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
import assert from 'node:assert/strict';
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
    // EX-ADMIN DEGRADADO: sigue en el equipo (activo) pero ya NO es admin en
    // /usuarios… y quedó en /admins. Ver el bloque «límites conocidos».
    await setDoc(doc(db, 'usuarios/s_degradado'), { email: 'd@x.co', rol: 'tecnico', activo: true });
    await setDoc(doc(db, 'admins/s_degradado'),  { legacy: true });
  });

  // ── Semilla de objetos en el bucket ──
  await sembrarObjeto('firmas/s_tech');
  await sembrarObjeto('firmas/s_otro');
  await sembrarObjeto('documentos/doc1/informe.pdf', PDF, { contentType: 'application/pdf' });
  await sembrarObjeto('contratos/c1/contrato.pdf', PDF, { contentType: 'application/pdf' });
  await sembrarObjeto('pruebas_electricas/u1/informe.pdf', PDF, { contentType: 'application/pdf' });
  await sembrarObjeto('otros/suelto.png');
  // Segunda unidad, para que el listado de la raíz tenga algo que revelar.
  await sembrarObjeto('pruebas_electricas/u2/informe.pdf', PDF, { contentType: 'application/pdf' });
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

  test('sin sesión NO puede borrar una firma', async () => {
    await assertFails(deleteObject(ref(anonimo(), 'firmas/s_otro')));
  });

  test('un ADMIN no puede borrar la firma de otro (sabotaje sobre un dato personal)', async () => {
    await assertFails(deleteObject(ref(como('s_admin'), 'firmas/s_otro')));
  });

  // El bootstrap legacy es la puerta que más fácil se cuela como superusuario.
  // Sobre firmas NO se cuela: es dueño de la suya y de ninguna otra.
  test('el bootstrap legacy es dueño de SU firma y de ninguna otra', async () => {
    await assertSucceeds(
      uploadBytes(ref(como('s_bootstrap'), 'firmas/s_bootstrap'), PNG, PNG_META)
    );
    await assertFails(getBytes(ref(como('s_bootstrap'), 'firmas/s_tech')));
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

// ══════════════════════════════════════════════════════════════
// LÍMITES CONOCIDOS — lo que las reglas HOY permiten y no debería
// darse por bueno sin decidirlo
// ──────────────────────────────────────────────────────────────
// Estas pruebas NO celebran el comportamiento: lo FIJAN. Salieron de la
// auditoría adversarial de ADR-073 (5 lentes, 26 hallazgos, 3 sobrevivieron
// al refutador y los tres se reprodujeron con el emulador antes de creerlos).
// Si alguien corrige la regla, la prueba se cae y obliga a cambiarla a mano
// — que es exactamente lo que se quiere: que la corrección sea CONSCIENTE y
// no un efecto colateral. Cada una dice qué decisión está esperando.
// ══════════════════════════════════════════════════════════════
describe('storage.rules · límites conocidos (decisión pendiente del Ingeniero)', () => {

  // 🔴 EL GRAVE. `adminsBootstrapValido()` comprueba dos cosas —estar en
  // /admins y no estar desactivado— pero NUNCA mira el ROL, y en `isAdmin()`
  // va en la rama OR, así que gana. Consecuencia: degradar a alguien de
  // 'admin' a 'tecnico' desde el panel —la acción natural cuando sigue en el
  // equipo pero ya no administra— NO le quita la escritura sobre contratos ni
  // sobre los informes reales de cliente. El comentario de las reglas dice
  // otra cosa ("uid en /admins SIN perfil en /usuarios = bootstrap puro") y
  // el cliente hace otra cosa (session-guard.js solo mira /admins cuando NO
  // hay perfil): son las reglas las que se apartan de su propia intención.
  // El mismo defecto está en `firestore.rules` (líneas 42-58), así que
  // alcanza a TODO el backend, no solo al bucket.
  // Arreglo de una línea: `&& !hasProfile()` en vez de
  // `&& (!hasProfile() || profile().activo == true)`.
  // Riesgo del arreglo: si alguien depende de /admins TENIENDO perfil no-admin,
  // pierde el acceso. Por eso se decide, no se ejecuta a ciegas.
  test('🔴 HOY PERMITE: un ex-admin degradado a técnico, aún en /admins, sigue escribiendo en contratos', async () => {
    await assertSucceeds(
      uploadBytes(ref(como('s_degradado'), 'contratos/c1/colado.pdf'), PDF, { contentType: 'application/pdf' })
    );
  });

  test('control: un técnico normal (fuera de /admins) SÍ queda bloqueado', async () => {
    await assertFails(
      uploadBytes(ref(como('s_tech'), 'contratos/c1/bloqueado.pdf'), PDF, { contentType: 'application/pdf' })
    );
  });

  // 🟡 `request.resource.contentType` es la cabecera que DECLARA el cliente,
  // no el resultado de mirar el archivo. La regla no garantiza que el objeto
  // sea una imagen: garantiza que quien lo subió dijo que lo era. No es
  // corregible desde las reglas (haría falta una Cloud Function que inspeccione
  // los bytes). Se fija aquí para que nadie cite esa línea como una garantía
  // de formato que no da. Impacto acotado: la ruta es la propia, el tope de
  // 1 MB sigue vigente y el visor arma el dataURL con 'image/png' fijo.
  test('🟡 HOY PERMITE: un archivo que NO es PNG entra si se declara image/png', async () => {
    await assertSucceeds(
      uploadBytes(ref(como('s_tech'), 'firmas/s_tech'), PDF, PNG_META)
    );
  });

  // 🟡 En Storage, `read` incluye `list`. Al evaluar un listado sobre un
  // prefijo ancestro, los comodines sin ligar se ligan a null y el match
  // aplica igual: como `isTeamMember()` no menciona ni {unidadId} ni
  // {filename}, la condición da true y el listado se concede. Resultado: un
  // técnico puede enumerar TODAS las unidades y contratos del bucket. No
  // añade acceso a contenido (ya podía descargar cada objeto), pero es una
  // capacidad que ninguna línea declara y que nadie eligió.
  // ⚠️ No se puede cerrar el list "en todas partes" sin romper
  // `eliminarUnidad()` (assets/js/data/pruebas_electricas.js), que necesita
  // listAll de admin para borrar los PDFs de una unidad.
  test('🟡 HOY PERMITE: un técnico enumera todas las unidades de pruebas eléctricas', async () => {
    const r = await listAll(ref(como('s_tech'), 'pruebas_electricas'));
    assert.deepEqual(r.prefixes.map((p) => p.name).sort(), ['u1', 'u2']);
  });

  test('🟡 HOY PERMITE: y también el inventario de documentos y contratos', async () => {
    await assertSucceeds(listAll(ref(como('s_tech'), 'documentos')));
    await assertSucceeds(listAll(ref(como('s_tech'), 'contratos')));
  });

  // 🟡 Asimetría menor: `allow delete` de firmas/{uid} es la ÚNICA línea del
  // bloque que exige `isSignedIn()` en vez de `isTeamMember()`. Un usuario
  // dado de baja no puede leer ni subir su firma, pero sí borrarla. Se puede
  // defender (borrar un dato personal propio no es un privilegio) — se fija
  // para que sea una decisión y no un descuido.
  test('🟡 HOY PERMITE: un usuario dado de baja todavía puede borrar su propia firma', async () => {
    await sembrarObjeto('firmas/s_revocado');
    await assertSucceeds(deleteObject(ref(como('s_revocado'), 'firmas/s_revocado')));
  });
});
