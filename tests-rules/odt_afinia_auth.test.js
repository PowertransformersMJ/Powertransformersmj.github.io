// ══════════════════════════════════════════════════════════════
// Firma de ODT Afinia · prueba con el emulador de AUTH (revisión 20-11, lentes legal[0] y arq[5] del comité; rehecha
// el 2026-11-21 con la decisión del Ingeniero «la contraseña solo al iniciar sesión, sin límite»).
// Las pruebas de reglas usan tokens simulados (`claims: {auth_time}`): aquí, con el SDK cliente contra los emuladores
// de Auth y Firestore, se usa el token que de verdad se envía:
//   1) un usuario con correo verificado inicia sesión con contraseña: el token trae sign_in_provider 'password',
//      email_verified y auth_time;
//   2) refrescar el token (getIdToken(true)) SIN contraseña NO cambia auth_time; una contraseña errada tampoco;
//   3) HABILITARSE SÍ exige contraseña reciente: con las claims de ese token real y su auth_time corrido 10 min atrás,
//      la habilitación se NIEGA (en vivo no se puede esperar 5 min); reautenticar (> 1 s después) da un auth_time
//      NUEVO y mayor, y con ESE token vivo la habilitación pasa y guarda ese auth_time;
//   4) FIRMAR NO exige reautenticar: con el token vivo de la sesión (abierta ANTES de publicar y solo renovado con
//      getIdToken(true), sin escribir la contraseña) el lote de firma PASA y el acto guarda ese auth_time («sesión
//      iniciada»). Declarar en el acto otro authTime no sirve.
// Lo que las pruebas de reglas cubren aparte: otro proveedor, correo sin verificar, firmante no asignado, imagen ajena
// y el Responsable con una sesión anterior a publicar y a la firma del AZT.
// Se corre con `npm run test:rules:auth` (emulators:exec --only auth,firestore). Dentro de `npm run test:rules`
// (sin emulador de Auth) se SALTA con su motivo a la vista; con SGM_EXIGE_AUTH=1 (lo pone el script) falta el
// emulador ⇒ FALLA. Datos INVENTADOS: ningún uid, correo, nombre ni N.º real.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider, signOut
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, terminate, doc, setDoc, getDoc, writeBatch, serverTimestamp, Bytes, Timestamp
} from 'firebase/firestore';

const PROYECTO = 'demo-sgm-rules';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const EXIGE = process.env.SGM_EXIGE_AUTH === '1';
const SALTO = AUTH_HOST ? false : 'necesita el emulador de Auth: npm run test:rules:auth';

test('el emulador de Auth está presente cuando el script lo exige (SGM_EXIGE_AUTH=1)', () => {
  if (EXIGE) assert.ok(AUTH_HOST, 'SGM_EXIGE_AUTH=1 sin FIREBASE_AUTH_EMULATOR_HOST: el script no levantó el emulador de Auth');
});

/* ── datos inventados (sufijo por corrida: el emulador puede estar vivo de antes) ─────────── */
const SUF = String(Date.now()).slice(-9);
const UID = 'oa_auth_azt_' + SUF;
const CORREO = `azt.auth.${SUF}@prueba.test`;
const CLAVE = 'clave-de-prueba-' + SUF;
const NOMBRE = 'Azt Auth Prueba';
const ODT = 'oaauth' + SUF.padStart(14, '0');          // 20 alfanuméricos
const NRO = '9' + SUF.slice(-7).padStart(7, '0');      // 8 dígitos inventados
const DECL_AZT = (n, c, nro) => `Yo, ${n}, con mi cuenta personal ${c}, declaro que revisé las dos páginas de la ODT N.º ${nro} y, como AZT EN SITIO, la firmo. Esta firma equivale a mi firma manuscrita.`;
const ACUERDO = (n, c) => `Yo, ${n}, con mi cuenta personal ${c}, acepto firmar electrónicamente las ODT de Afinia en SGM. Mi firma solo se estampa desde mi propia cuenta y con mi contraseña personal, que no comparto.`;
const sha = (u) => createHash('sha256').update(u).digest('hex');
const FIRMA = (() => { const u = new Uint8Array(700).fill(42); u.set([0x89, 0x50, 0x4E, 0x47]); return u; })();
const PDF = (() => { const u = new Uint8Array(1500).fill(0x41); u.set([0x25, 0x50, 0x44, 0x46, 0x2D]); return u; })();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const fechaBogota = (dias) => {
  const t = new Date(Date.now() - 5 * 3600e3 + dias * 86400e3); const p = (x) => String(x).padStart(2, '0');
  return `${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
};

let testEnv; let app; let auth; let db;

/** Crea en el emulador de Auth un usuario con correo VERIFICADO (API de administración del emulador). */
async function crearUsuario() {
  const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROYECTO}/accounts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: UID, email: CORREO, password: CLAVE, emailVerified: true, displayName: NOMBRE })
  });
  assert.ok(r.ok, 'no se pudo crear el usuario en el emulador de Auth: ' + r.status + ' ' + (await r.text()));
}
/** Lo que escribe la página al firmar como AZT: acto + cambio de estado, en UN lote, con el token vivo. */
function loteFirmaAzt(authTime) {
  const b = writeBatch(db);
  b.set(doc(db, 'odt_afinia', ODT, 'actos', 'azt'), {
    rol: 'azt', uid: UID, correo: CORREO, correoVerificado: true, proveedor: 'password', authTime, nombre: NOMBRE, nro: NRO,
    imagen: Bytes.fromUint8Array(FIRMA), huellaImagen: sha(FIRMA), huellaBase: sha(PDF), huellaVista: 'e'.repeat(64),
    // Compositor vigente (2026-11-21): la regla solo acepta actos nuevos con 'odt-afinia@2'.
    compositor: 'odt-afinia@2', declaracionVersion: 'odt-azt-v1', declaracion: DECL_AZT(NOMBRE, CORREO, NRO), en: serverTimestamp()
  });
  b.update(doc(db, 'odt_afinia', ODT), { estado: 'PENDIENTE_RESPONSABLE', rev: 1 });
  return b.commit();
}

/** Lo que escribe la página al habilitarse: odt_afinia_firmantes/{uid} con el token recién reautenticado. */
function documentoHabilitacion(authTime) {
  return {
    uid: UID, correo: CORREO, correoVerificado: true, proveedor: 'password', authTime,
    acuerdoVersion: 'odt-acuerdo-v1', acuerdo: ACUERDO(NOMBRE, CORREO), nombre: NOMBRE, en: serverTimestamp()
  };
}

describe('emulador de Auth: firmar NO pide reautenticar (2026-11-21); habilitarse SÍ', { skip: SALTO }, () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROYECTO,
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
    });
    await crearUsuario();
    // Solo el perfil (con las reglas apagadas): la habilitación la escribe la prueba de reautenticar con el token vivo y «Mi firma»
    // se sube después de ella.
    await testEnv.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'usuarios', UID), { email: CORREO, rol: 'tecnico', activo: true, nombre: NOMBRE });
    });
    app = initializeApp({ projectId: PROYECTO, apiKey: 'demo-clave-no-real' }, 'odt-auth-' + SUF);
    auth = getAuth(app);
    connectAuthEmulator(auth, 'http://' + AUTH_HOST, { disableWarnings: true });
    db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  });
  after(async () => {
    if (auth) await signOut(auth).catch(() => {});
    if (db) await terminate(db).catch(() => {});
    if (app) await deleteApp(app).catch(() => {});
    if (testEnv) await testEnv.cleanup();
  });

  let t1;   // claims del token del inicio de sesión
  let t2;   // claims del token tras reautenticar (al habilitarse)

  test('inicio de sesión con contraseña: el token trae password, correo verificado y auth_time', async () => {
    const cred = await signInWithEmailAndPassword(auth, CORREO, CLAVE);
    assert.equal(cred.user.uid, UID);
    t1 = (await cred.user.getIdTokenResult()).claims;
    assert.equal(t1.firebase.sign_in_provider, 'password');
    assert.equal(t1.email_verified, true);
    assert.equal(t1.email, CORREO);
    assert.ok(Number.isInteger(t1.auth_time), 'auth_time entero: ' + t1.auth_time);
    assert.ok(Math.abs(t1.auth_time * 1000 - Date.now()) < 60e3, 'auth_time es de ahora');
  });

  test('refrescar el token SIN contraseña no cambia auth_time; una contraseña errada tampoco', async () => {
    await espera(1100);
    await auth.currentUser.getIdToken(true);
    assert.equal((await auth.currentUser.getIdTokenResult()).claims.auth_time, t1.auth_time);
    await assert.rejects(reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(CORREO, CLAVE + 'x')));
    await auth.currentUser.getIdToken(true);
    assert.equal((await auth.currentUser.getIdTokenResult()).claims.auth_time, t1.auth_time);
  });

  test('habilitarse SÍ exige contraseña reciente: las claims del token real con su auth_time de hace 10 min → no', async () => {
    // En vivo no se puede esperar 5 min: se usan las MISMAS claims del token real, con su inicio de sesión corrido.
    const vieja = t1.auth_time - 600;
    const d = testEnv.authenticatedContext(UID, {
      email: t1.email, email_verified: t1.email_verified, auth_time: vieja, firebase: { sign_in_provider: t1.firebase.sign_in_provider }
    }).firestore();
    await assertFails(setDoc(doc(d, 'odt_afinia_firmantes', UID), documentoHabilitacion(vieja)));
    assert.equal((await getDoc(doc(db, 'odt_afinia_firmantes', UID))).exists(), false, 'no quedó habilitado');
  });

  test('reautenticar (> 1 s después) da un auth_time NUEVO y mayor; con ese token vivo la habilitación pasa', async () => {
    await espera(1100);
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(CORREO, CLAVE));
    await auth.currentUser.getIdToken(true);
    t2 = (await auth.currentUser.getIdTokenResult()).claims;
    assert.ok(t2.auth_time > t1.auth_time, `auth_time nuevo (${t2.auth_time}) > anterior (${t1.auth_time})`);
    assert.equal(t2.firebase.sign_in_provider, 'password');
    // Control de la misma prueba: declarar el auth_time viejo no sirve (authTime debe ser el del token).
    await assertFails(setDoc(doc(db, 'odt_afinia_firmantes', UID), documentoHabilitacion(t1.auth_time)));
    await assertSucceeds(setDoc(doc(db, 'odt_afinia_firmantes', UID), documentoHabilitacion(t2.auth_time)));
    assert.equal((await getDoc(doc(db, 'odt_afinia_firmantes', UID))).data().authTime, t2.auth_time);
    // «Mi firma» DESPUÉS de habilitarse (la regla del acto lo exige), con las reglas apagadas.
    await testEnv.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'firmas', UID), { imagen: Bytes.fromUint8Array(FIRMA), huella: sha(FIRMA), en: serverTimestamp() });
    });
  });

  test('firmar NO exige reautenticar: con la sesión abierta ANTES de publicar (sin volver a escribir la contraseña) el acto pasa', async () => {
    await espera(1100);
    const publicadoMs = Date.now();
    await testEnv.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'odt_afinia', ODT), {
        nro: NRO, consignacion: 'C-PRUEBA-AUTH', subestacion: 'S/E Prueba Auth', equipo: 'TX Prueba Auth', fechaTrabajo: fechaBogota(-3),
        firmantes: { azt: { uid: UID, nombre: NOMBRE, correo: CORREO }, responsable: { uid: 'oa_auth_resp', nombre: 'Resp Auth Prueba', correo: 'resp.auth@prueba.test' } },
        lectores: [UID, 'oa_auth_resp'], estado: 'PENDIENTE_AZT', rev: 0,
        huella: sha(PDF), bytes: PDF.length, partes: 1, huellasPartes: [sha(PDF)],
        zonas: { azt: { x: 1, y: 1, w: 1, h: 1 }, responsable: { x: 1, y: 1, w: 1, h: 1 }, si: { x: 1, y: 1 }, fecha: { x: 1, y: 1 } },
        publicadoPor: { uid: 'oa_auth_admin', nombre: 'Admin Auth Prueba' }, publicadoEn: Timestamp.fromMillis(publicadoMs)
      });
    });
    // Lo que hace la página al confirmar la firma: renovar el token SIN contraseña (data/odt_afinia_sesion.js).
    await espera(1100);
    await auth.currentUser.getIdToken(true);
    const vivo = (await auth.currentUser.getIdTokenResult()).claims;
    assert.equal(vivo.auth_time, t2.auth_time, 'la sesión es la misma: renovar no la reinicia');
    assert.ok(vivo.auth_time * 1000 < publicadoMs, 'la sesión es ANTERIOR a la publicación (antes, D5 la negaba)');
    // Control: el acto con un authTime que no es el del token se niega.
    await assertFails(loteFirmaAzt(t1.auth_time));
    await assertSucceeds(loteFirmaAzt(vivo.auth_time));
    const acto = (await getDoc(doc(db, 'odt_afinia', ODT, 'actos', 'azt'))).data();
    assert.equal(acto.authTime, t2.auth_time, 'el acto guarda el inicio de la sesión («sesión iniciada»)');
    assert.equal((await getDoc(doc(db, 'odt_afinia', ODT))).data().estado, 'PENDIENTE_RESPONSABLE');
    assert.equal((await auth.currentUser.getIdTokenResult()).claims.auth_time, t2.auth_time, 'firmar no reautenticó');
  });
});
