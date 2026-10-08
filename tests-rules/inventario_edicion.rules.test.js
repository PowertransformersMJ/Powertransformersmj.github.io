// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Editar un transformador en el emulador (ADR-154)
// ──────────────────────────────────────────────────────────────
// Contra Firestore DE VERDAD (emulador), no contra un modelo:
//   · el camino viejo —escribir la sección completa— BORRABA la
//     matrícula y la condición de salud (y las reglas lo dejaban pasar);
//   · el camino nuevo —campo por campo— cambia solo lo editado;
//   · un técnico sigue sin poder escribir;
//   · la bitácora acepta el diff con rutas de punto ('placa.marca').
// Datos 100 % SINTÉTICOS. Corre con `npm run test:rules`.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp
} from 'firebase/firestore';

import {
  sanitizarTransformador, proyeccionV1
} from '../assets/js/domain/transformador_schema.js';
import {
  valoresFormulario, entradaDesdeFormulario, parcheEdicionInventario
} from '../assets/js/domain/inventario_edicion.js';
import { auditar } from '../assets/js/domain/audit.js';

const PROJECT_ID = 'demo-sgm-rules';

function equipoSintetico(codigo) {
  return {
    schema_version: 2,
    estado_servicio: 'operativo',
    estados_especiales: [],
    identificacion: { codigo, matricula: 'T9-M/M-ZZZ', nombre: 'Equipo de prueba',
      tipo_activo: 'POTENCIA', uucc: 'N4T1', grupo: 'G2' },
    placa: { marca: 'MARCA-X', modelo: 'MOD-1', serial: 'SER-0001', potencia_kva: 25000, numero_fabrica: 'NF-77' },
    ubicacion: { departamento: 'bolivar', municipio: 'Municipio Ficticio', zona: 'BOLIVAR',
      subestacionId: 'SE-ZZZ', subestacion_nombre: 'S/E Ficticia', latitud: 10.1, longitud: -75.2 },
    electrico: { tension_primaria_kv: 66, tension_secundaria_kv: 13.8, corriente_nominal_primaria_a: 218.7, fases: 3 },
    fabricacion: { ano_fabricacion: 1998, fecha_fabricacion: '1998-04-01' },
    servicio: { fecha_instalacion: '1999-01-15', observaciones: 'nota previa', usuarios_aguas_abajo: 12000 },
    salud_actual: { hi_final: 3.1, bucket: 'pobre', condicion_fuente: 'excel', calif_edad: 4 },
    criticidad: { usuarios_aguas_abajo: 12000 },
    codigo, nombre: 'Equipo de prueba', departamento: 'bolivar', municipio: 'Municipio Ficticio',
    subestacion: 'S/E Ficticia', potencia_kva: 25000, tension_primaria_kv: 66, tension_secundaria_kv: 13.8,
    marca: 'MARCA-X', modelo: 'MOD-1', serial: 'SER-0001', fecha_fabricacion: '1998-04-01',
    fecha_instalacion: '1999-01-15', estado: 'operativo', latitud: 10.1, longitud: -75.2,
    observaciones: 'nota previa', re: 'N/A'
  };
}

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/adm154'),  { email: 'a@x.co', rol: 'admin',   activo: true });
    await setDoc(doc(db, 'usuarios/tec154'),  { email: 't@x.co', rol: 'tecnico', activo: true });
    await setDoc(doc(db, 'transformadores/tx154-nuevo'), equipoSintetico('TX-154-A'));
    await setDoc(doc(db, 'transformadores/tx154-viejo'), equipoSintetico('TX-154-B'));
    await setDoc(doc(db, 'transformadores/tx154-tec'),   equipoSintetico('TX-154-C'));
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

// Lo que hace la página: abre el equipo, cambia la marca y guarda.
function parcheMarca(prev, marca) {
  const inicial = entradaDesdeFormulario(valoresFormulario(prev));
  const actual  = entradaDesdeFormulario({ ...valoresFormulario(prev), marca });
  return parcheEdicionInventario(inicial, actual);
}

describe('editar un transformador desde el inventario (ADR-154)', () => {
  test('por qué existe: escribir la sección completa (camino viejo) BORRA matrícula y condición', async () => {
    const db = testEnv.authenticatedContext('adm154').firestore();
    const ref = doc(db, 'transformadores/tx154-viejo');
    const prev = (await getDoc(ref)).data();
    const entrada = { ...entradaDesdeFormulario(valoresFormulario(prev)), marca: 'MARCA-NUEVA' };
    const v2 = sanitizarTransformador(entrada);
    // Igual que `prepararDoc` + `actualizar` de data/transformadores.js.
    await assertSucceeds(updateDoc(ref, { ...v2, ...proyeccionV1(v2), updatedAt: serverTimestamp() }));
    const d = (await getDoc(ref)).data();
    assert.equal(d.identificacion.matricula, '');
    assert.equal(d.ubicacion.subestacionId, '');
    assert.equal(d.salud_actual.hi_final, null);
    assert.equal(d.fabricacion.ano_fabricacion, null);
    assert.equal(d.servicio.usuarios_aguas_abajo, null);
  });

  test('campo por campo: cambia solo la marca; matrícula, condición y lo demás quedan intactos', async () => {
    const db = testEnv.authenticatedContext('adm154').firestore();
    const ref = doc(db, 'transformadores/tx154-nuevo');
    const prev = (await getDoc(ref)).data();
    const { parche, errores } = parcheMarca(prev, 'MARCA-NUEVA');
    assert.deepEqual(errores, []);
    assert.deepEqual(Object.keys(parche).sort(), ['marca', 'placa.marca']);
    await assertSucceeds(updateDoc(ref, { ...parche, updatedAt: serverTimestamp() }));
    const d = (await getDoc(ref)).data();
    assert.equal(d.placa.marca, 'MARCA-NUEVA');
    assert.equal(d.marca, 'MARCA-NUEVA');
    assert.equal(d.identificacion.matricula, 'T9-M/M-ZZZ');
    assert.equal(d.ubicacion.subestacionId, 'SE-ZZZ');
    assert.deepEqual(d.salud_actual, prev.salud_actual);
    assert.equal(d.fabricacion.ano_fabricacion, 1998);
    assert.equal(d.placa.numero_fabrica, 'NF-77');
    assert.deepEqual(d.electrico, prev.electrico);
    assert.deepEqual(d.criticidad, prev.criticidad);
    // Todo igual salvo la marca y la hora de la edición:
    const { updatedAt, ...resto } = d;
    const esperado = { ...prev, marca: 'MARCA-NUEVA', placa: { ...prev.placa, marca: 'MARCA-NUEVA' } };
    assert.deepEqual(resto, esperado);
    assert.ok(updatedAt);
  });

  test('un técnico sigue sin poder escribir el parche', async () => {
    const db = testEnv.authenticatedContext('tec154').firestore();
    const ref = doc(db, 'transformadores/tx154-tec');
    const prev = (await getDoc(ref)).data();
    const { parche } = parcheMarca(prev, 'MARCA-TEC');
    await assertFails(updateDoc(ref, { ...parche, updatedAt: serverTimestamp() }));
  });

  test('la bitácora guarda el diff con rutas de punto tal cual', async () => {
    const db = testEnv.authenticatedContext('adm154').firestore();
    const diff = { 'placa.marca': { antes: 'MARCA-X', despues: 'MARCA-NUEVA' } };
    const ref = await assertSucceeds(addDoc(collection(db, 'auditoria'), {
      ...auditar({ accion: 'actualizar', coleccion: 'transformadores', docId: 'tx154-nuevo', uid: 'adm154', diff }),
      at: serverTimestamp()
    }));
    const a = (await getDoc(ref)).data();
    assert.deepEqual(a.diff, diff);
  });
});
