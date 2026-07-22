// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Tests de firestore.rules (G025, Ola 3)
// ──────────────────────────────────────────────────────────────
// firestore.rules es el ÚNICO firewall del backend y no tenía ni un
// test. Esta suite valida los invariantes de seguridad críticos con
// el emulador de Firestore. NO va en tests/ (que corre sin emulador):
// se ejecuta con `npm run test:rules` (firebase emulators:exec).
//
// Cubre: sin-auth denegado · miembro-del-equipo lee · no-admin no
// escribe · admin sí · REVOCACIÓN por activo:false aunque figure en
// /admins (ADR-052) · lectura self-scoped de /usuarios · validación
// de schema en el create.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-sgm-rules';

// Payload v2 mínimo que satisface el `allow create` de /transformadores
// (departamento debe ser un enum válido: bolivar/cordoba/sucre/cesar/magdalena).
const trafoValido = {
  schema_version: 2,
  identificacion: { codigo: 'TX-TEST-01', nombre: 'Test', tipo_activo: 'POTENCIA' },
  ubicacion: { departamento: 'bolivar', zona: '' },
  estado_servicio: 'operativo'
};

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
  // Semilla con reglas DESHABILITADAS: perfiles, /admins legacy y un trafo.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'),   { email: 'a@x.co', rol: 'admin',   activo: true });
    await setDoc(doc(db, 'usuarios/tech1'),    { email: 't@x.co', rol: 'tecnico', activo: true });
    await setDoc(doc(db, 'usuarios/revoked1'), { email: 'r@x.co', rol: 'admin',   activo: false });
    await setDoc(doc(db, 'admins/revoked1'),   { legacy: true }); // en /admins pero desactivado
    await setDoc(doc(db, 'transformadores/tx-seed'), trafoValido);
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('firestore.rules — invariantes de seguridad (G025)', () => {
  test('sin auth NO puede leer transformadores', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'transformadores/tx-seed')));
  });

  test('miembro del equipo (activo:true) SÍ lee transformadores', async () => {
    const db = testEnv.authenticatedContext('tech1').firestore();
    await assertSucceeds(getDoc(doc(db, 'transformadores/tx-seed')));
  });

  test('no-admin NO puede crear transformadores', async () => {
    const db = testEnv.authenticatedContext('tech1').firestore();
    await assertFails(setDoc(doc(db, 'transformadores/tx-tech'), trafoValido));
  });

  test('admin SÍ puede crear un transformador v2 válido', async () => {
    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(setDoc(doc(db, 'transformadores/tx-admin'), trafoValido));
  });

  test('admin desactivado (activo:false) queda REVOCADO aunque figure en /admins (ADR-052)', async () => {
    const db = testEnv.authenticatedContext('revoked1').firestore();
    await assertFails(getDoc(doc(db, 'transformadores/tx-seed')));           // no team member
    await assertFails(setDoc(doc(db, 'transformadores/tx-rev'), trafoValido)); // no admin
  });

  test('un usuario lee SU perfil pero NO el de otro (self-scoped)', async () => {
    const db = testEnv.authenticatedContext('tech1').firestore();
    await assertSucceeds(getDoc(doc(db, 'usuarios/tech1')));
    await assertFails(getDoc(doc(db, 'usuarios/admin1')));
  });

  test('admin lee cualquier perfil', async () => {
    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(getDoc(doc(db, 'usuarios/tech1')));
  });

  test('admin NO puede crear transformador con schema inválido (falta schema_version)', async () => {
    const db = testEnv.authenticatedContext('admin1').firestore();
    const { schema_version, ...invalido } = trafoValido;
    await assertFails(setDoc(doc(db, 'transformadores/tx-bad'), invalido));
  });
});
