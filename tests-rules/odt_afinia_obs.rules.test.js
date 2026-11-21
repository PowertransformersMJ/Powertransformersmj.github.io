// ══════════════════════════════════════════════════════════════
// Firma de ODT Afinia · «POR SUBSANAR» (decisión del Ingeniero del 2026-11-21), reglas en el emulador.
//   · odt_afinia_obs/{id}: la registra SOLO un admin con perfil, en UN lote con su candado del N.º y sus puntos; el AZT
//     asignado está en la lista blanca azt, habilitado (nombre y correo de SU habilitación), activo, no es visitante y
//     no es quien registra; lectores = [AZT]; resumen contiguo desde '0', todo PENDIENTE.
//   · puntos/{k}: el AZT asignado pasa PENDIENTE → SUBSANADO de SU obs con nota (3-500); el admin pasa SUBSANADO →
//     VERIFICADO (nota opcional) o → PENDIENTE (devolver, nota obligatoria); quien lo marcó subsanado no lo revisa.
//     Cada cambio AGREGA su entrada de rastro (rev + 1) y mueve el resumen de la obs en el MISMO lote (atados).
//   · candado «un N.º, una obs ABIERTA»: odt_afinia_obs_nro/{nro}; se reasigna solo con la anterior RESUELTA.
//   · lectura: admin con perfil o el AZT asignado; otro técnico, visitante y anónimo, fuera. Nada se borra.
//   · RESUELTA (admin, con nota) es final: ya no cambia ningún punto ni el resumen.
//   · hueco de un registro a medias (el registro exige solo el ÚLTIMO punto): lo repara solo un admin con perfil, con la
//     obs ABIERTA y la entrada PENDIENTE del punto ya en el resumen.
// Cada caso en las DOS direcciones (L-73/L-78): lo que se niega tiene su control que pasa. Un lote = una conexión.
// Carga máxima (L-110): 40 puntos de 600 caracteres en el lote de registro. Prefijo `ob_`; nunca clearFirestore()
// (la lista blanca compartida se AMPLÍA con arrayUnion: no pisa la de tests-rules/odt_afinia.rules.test.js).
// Datos INVENTADOS: ningún uid, correo, nombre ni N.º de ODT real.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, where, orderBy, limit, writeBatch,
  serverTimestamp, arrayUnion
} from 'firebase/firestore';

let testEnv;

/* ── personas inventadas ─────────────────────────────────────────────────────── */
const P = {
  ob_admin: { rol: 'admin', nombre: 'Admin Registra Prueba', email: 'admin.registra@prueba.test' },
  ob_admin2: { rol: 'admin', nombre: 'Admin Azt Prueba', email: 'admin.azt@prueba.test' },          // admin que además es AZT
  ob_azt: { rol: 'tecnico', nombre: 'Azt Obs Prueba', email: 'azt.obs@prueba.test' },
  ob_azt2: { rol: 'tecnico', nombre: 'Azt Obs Otro', email: 'azt.obs.otro@prueba.test' },
  ob_tercero: { rol: 'tecnico', nombre: 'Tercero Obs Prueba', email: 'tercero.obs@prueba.test' },
  ob_visit: { rol: 'visitante', nombre: 'Visitante Obs Prueba', email: 'visitante.obs@prueba.test' },
  ob_fuera: { rol: 'tecnico', nombre: 'Fuera Obs Prueba', email: 'fuera.obs@prueba.test' },         // habilitado, NO en la lista blanca
  ob_nohab: { rol: 'tecnico', nombre: 'Sin Habilitar Obs', email: 'nohab.obs@prueba.test' },        // en la lista blanca, NO habilitado
  ob_inact: { rol: 'tecnico', nombre: 'Inactivo Obs Prueba', email: 'inactivo.obs@prueba.test', activo: false }
};
const NOMBRE = (u) => (P[u] && P[u].nombre) || '';
const CORREO = (u) => (P[u] ? P[u].email : u + '@prueba.test').toLowerCase();
const HABILITADOS = ['ob_admin2', 'ob_azt', 'ob_azt2', 'ob_visit', 'ob_fuera', 'ob_inact'];
const LISTA_AZT = ['ob_admin2', 'ob_azt', 'ob_azt2', 'ob_visit', 'ob_nohab', 'ob_inact'];

/* ── contextos ──────────────────────────────────────────────────────────────── */
const plano = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
async function leer(ruta) {
  let v; await testEnv.withSecurityRulesDisabled(async (c) => { v = (await getDoc(doc(c.firestore(), ruta))).data(); }); return v;
}
async function sembrar(fn) { await testEnv.withSecurityRulesDisabled(async (c) => fn(c.firestore())); }

/* ── obs, puntos y lotes ─────────────────────────────────────────────────────── */
const ID = (k) => 'obobs' + String(k).padStart(15, '0');      // 20 alfanuméricos
const NRO = (k) => String(k).padStart(8, '0');
const QUIEN = (u) => ({ uid: u, nombre: NOMBRE(u) });
const AZT = (u) => ({ uid: u, nombre: NOMBRE(u), correo: CORREO(u) });
const resumenDe = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), 'PENDIENTE']));
function obsDe(admin, nro, n, { azt = 'ob_azt', ...extra } = {}) {
  return {
    nro, subestacion: 'S/E Prueba Sur', equipo: 'TR-Prueba', fechaPrevista: '15/11/2026', azt: AZT(azt), lectores: [azt],
    estado: 'ABIERTA', resumen: resumenDe(n), creadoPor: QUIEN(admin), creadoEn: serverTimestamp(), rev: 0, ...extra
  };
}
function puntoDe(admin, k, extra = {}) {
  return {
    orden: Number(k), texto: 'Punto de prueba número ' + k, quien: 'contratista', estado: 'PENDIENTE', rev: 0, rastro: {},
    creadoPor: QUIEN(admin), creadoEn: serverTimestamp(), ...extra
  };
}
/**
 * Lo que escribe la página al registrar: obs + candado del N.º + puntos 0..n-1, en UN lote.
 * `puntos`: [k, datos] a escribir (por defecto, 0..n-1); `candado` null = sin candado; `mas(b, d)` agrega operaciones.
 */
function registrar(admin, id, nro, { n = 2, azt, obs, puntos, candado, mas } = {}) {
  const d = plano(admin); const b = writeBatch(d);
  b.set(doc(d, 'odt_afinia_obs', id), obs || obsDe(admin, nro, n, azt ? { azt } : {}));
  if (candado !== null) b.set(doc(d, 'odt_afinia_obs_nro', nro), candado || { obsId: id });
  for (const [k, datos] of (puntos || Array.from({ length: n }, (_, i) => [String(i), puntoDe(admin, i)]))) {
    b.set(doc(d, 'odt_afinia_obs', id, 'puntos', k), datos);
  }
  if (mas) mas(b, d);
  return b.commit();
}
/**
 * Lo que escribe la página al cambiar un punto: update del punto {estado, rev, rastro.<rev>} + update de la obs
 * {resumen.<k>, ultimo}, en UN lote. Cada pieza se puede torcer para la negativa.
 */
async function cambiar(uid, id, k, a, { nota = 'Nota de prueba', entrada = {}, punto = {}, obs, sinObs = false, sinPunto = false, rev } = {}) {
  const actual = await leer('odt_afinia_obs/' + id + '/puntos/' + k);
  const r = rev ?? actual.rev + 1;
  const d = plano(uid); const b = writeBatch(d);
  if (!sinPunto) {
    b.update(doc(d, 'odt_afinia_obs', id, 'puntos', k), {
      estado: a, rev: r, ['rastro.' + r]: { de: actual.estado, a, nota, por: QUIEN(uid), en: serverTimestamp(), ...entrada }, ...punto
    });
  }
  if (!sinObs) b.update(doc(d, 'odt_afinia_obs', id), obs || { ['resumen.' + k]: a, ultimo: k });
  return b.commit();
}
const resolver = (uid, id, extra = {}) => updateDoc(doc(plano(uid), 'odt_afinia_obs', id), {
  estado: 'RESUELTA', rev: 1, resolucion: { nota: 'La ODT ya no va', por: QUIEN(uid), en: serverTimestamp() }, ...extra
});
function agregar(uid, id, k, { datos, sinObs = false, sinPunto = false, obs } = {}) {
  const d = plano(uid); const b = writeBatch(d);
  if (!sinPunto) b.set(doc(d, 'odt_afinia_obs', id, 'puntos', k), datos || puntoDe(uid, k, { texto: 'Punto agregado ' + k, quien: 'responsable' }));
  if (!sinObs) b.update(doc(d, 'odt_afinia_obs', id), obs || { ['resumen.' + k]: 'PENDIENTE', ultimo: k });
  return b.commit();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await sembrar(async (d) => {
    for (const [uid, p] of Object.entries(P)) {
      await setDoc(doc(d, 'usuarios', uid), { email: p.email, rol: p.rol, activo: p.activo ?? true, nombre: p.nombre });
    }
    await setDoc(doc(d, 'admins', 'ob_arranque'), { email: 'arranque.obs@prueba.test' });   // admin de arranque SIN perfil
    // La lista blanca es UN documento compartido con las pruebas de la firma: se AMPLÍA, no se pisa.
    await setDoc(doc(d, 'odt_afinia_config', 'firmantes'), { azt: arrayUnion(...LISTA_AZT) }, { merge: true });
    for (const uid of HABILITADOS) {
      await setDoc(doc(d, 'odt_afinia_firmantes', uid), {
        uid, correo: CORREO(uid), correoVerificado: true, proveedor: 'password', authTime: 1, acuerdoVersion: 'odt-acuerdo-v1',
        acuerdo: 'acuerdo de prueba', nombre: NOMBRE(uid), en: serverTimestamp()
      });
    }
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

// ═════════════════════════════════════════════════════════════════════════════
describe('registrar — solo un admin con perfil, en UN lote con su candado y sus puntos', () => {
  test('el admin registra; un técnico, el admin de arranque sin perfil, un visitante y un anónimo no', async () => {
    await assertFails(registrar('ob_azt2', ID(2), NRO(2)));
    await assertFails(registrar('ob_arranque', ID(3), NRO(3)));
    await assertFails(registrar('ob_visit', ID(4), NRO(4)));
    await assertFails((() => { const d = anon(); const b = writeBatch(d); b.set(doc(d, 'odt_afinia_obs', ID(5)), obsDe('ob_admin', NRO(5), 1)); return b.commit(); })());
    await assertSucceeds(registrar('ob_admin', ID(1), NRO(1)));
    const o = await leer('odt_afinia_obs/' + ID(1));
    assert.equal(o.estado, 'ABIERTA');
    assert.deepEqual(o.resumen, { 0: 'PENDIENTE', 1: 'PENDIENTE' });
    assert.deepEqual(await leer('odt_afinia_obs_nro/' + NRO(1)), { obsId: ID(1) });
  });
  test('el AZT: en la lista blanca, habilitado, activo, no visitante, no quien registra y con SU nombre y correo', async () => {
    await assertFails(registrar('ob_admin', ID(10), NRO(10), { azt: 'ob_fuera' }));       // no está en la lista blanca
    await assertFails(registrar('ob_admin', ID(11), NRO(11), { azt: 'ob_nohab' }));       // no habilitado
    await assertFails(registrar('ob_admin', ID(12), NRO(12), { azt: 'ob_inact' }));       // perfil inactivo
    await assertFails(registrar('ob_admin', ID(13), NRO(13), { azt: 'ob_visit' }));       // visitante
    await assertFails(registrar('ob_admin2', ID(14), NRO(14), { azt: 'ob_admin2' }));     // quien registra no es el AZT
    await assertFails(registrar('ob_admin', ID(15), NRO(15), { obs: { ...obsDe('ob_admin', NRO(15), 2), azt: { uid: 'ob_azt', nombre: 'Otro Nombre', correo: CORREO('ob_azt') } } }));
    await assertFails(registrar('ob_admin', ID(19), NRO(19), { obs: { ...obsDe('ob_admin', NRO(19), 2), azt: { ...AZT('ob_azt'), extra: 1 } } }));
    await assertFails(registrar('ob_admin', ID(16), NRO(16), { obs: obsDe('ob_admin', NRO(16), 2, { lectores: ['ob_azt', 'ob_tercero'] }) }));
    // Control: el mismo admin con un AZT que cumple (aquí ob_admin2, admin y AZT a la vez), y ob_azt2.
    await assertSucceeds(registrar('ob_admin', ID(17), NRO(17), { azt: 'ob_admin2' }));
    await assertSucceeds(registrar('ob_admin', ID(18), NRO(18), { azt: 'ob_azt2' }));
  });
  test('forma exacta de la obs: estado, rev, resumen contiguo y PENDIENTE, campos de más, textos y fecha', async () => {
    const mal = (k, extra) => registrar('ob_admin', ID(k), NRO(k), { obs: obsDe('ob_admin', NRO(k), 2, extra) });
    await assertFails(mal(20, { estado: 'RESUELTA' }));
    await assertFails(mal(21, { rev: 1 }));
    await assertFails(mal(22, { resumen: { 0: 'PENDIENTE', 1: 'VERIFICADO' } }));
    await assertFails(registrar('ob_admin', ID(23), NRO(23), { obs: obsDe('ob_admin', NRO(23), 2, { resumen: { 0: 'PENDIENTE', 2: 'PENDIENTE' } }),
      puntos: [['0', puntoDe('ob_admin', 0)], ['2', puntoDe('ob_admin', 2)]] }));         // resumen con hueco
    await assertFails(mal(24, { extra: 'campo de más' }));
    await assertFails(mal(25, { equipo: 'e'.repeat(161) }));
    await assertFails(mal(26, { subestacion: 'S' }));
    await assertFails(mal(27, { fechaPrevista: '31/02/2026' }));
    await assertFails(mal(28, { nro: '1234567' }));
    await assertFails(mal(29, { creadoPor: { uid: 'ob_admin', nombre: 'Otro' } }));
    // Control: equipo vacío (opcional) y 160 caracteres pasan.
    await assertSucceeds(mal(30, { equipo: '' }));
    await assertSucceeds(mal(31, { equipo: 'e'.repeat(160) }));
  });
  test('cada punto: PENDIENTE, rev 0, rastro vacío, orden = su id, texto 5-600, a quién le toca; id 0..39', async () => {
    const mal = (k, extra) => registrar('ob_admin', ID(k), NRO(k), { n: 1, puntos: [['0', puntoDe('ob_admin', 0, extra)]] });
    await assertFails(mal(40, { estado: 'VERIFICADO' }));
    await assertFails(mal(41, { rev: 1 }));
    await assertFails(mal(42, { rastro: { 1: { de: 'PENDIENTE', a: 'SUBSANADO' } } }));
    await assertFails(mal(43, { orden: 3 }));
    await assertFails(mal(44, { texto: 'abcd' }));
    await assertFails(mal(45, { texto: '     abcd' }));
    await assertFails(mal(46, { quien: 'interventoria' }));
    await assertFails(mal(47, { otro: 1 }));
    // Un punto sin su entrada en el resumen, o con un id fuera de 0..39, se niega.
    await assertFails(registrar('ob_admin', ID(48), NRO(48), { n: 1, puntos: [['0', puntoDe('ob_admin', 0)], ['1', puntoDe('ob_admin', 1)]] }));
    await assertFails(registrar('ob_admin', ID(49), NRO(49), { obs: obsDe('ob_admin', NRO(49), 1, { resumen: { 40: 'PENDIENTE' } }), puntos: [['40', puntoDe('ob_admin', 40)]] }));
    // Control: quien = azt y responsable; texto de 5 y de 600.
    await assertSucceeds(registrar('ob_admin', ID(50), NRO(50), { n: 2, puntos: [['0', puntoDe('ob_admin', 0, { quien: 'azt', texto: 'abcde' })], ['1', puntoDe('ob_admin', 1, { quien: 'responsable', texto: 'x'.repeat(600) })]] }));
  });
  test('atado: sin candado, con el candado de otra obs o sin el último punto, se niega', async () => {
    await assertFails(registrar('ob_admin', ID(60), NRO(60), { candado: null }));
    await assertFails(registrar('ob_admin', ID(61), NRO(61), { candado: { obsId: ID(62) } }));
    await assertFails(registrar('ob_admin', ID(63), NRO(63), { n: 2, puntos: [['0', puntoDe('ob_admin', 0)]] }));
    // Un punto suelto (sin la obs en el lote) tampoco entra.
    await assertFails(setDoc(doc(plano('ob_admin'), 'odt_afinia_obs', ID(64), 'puntos', '0'), puntoDe('ob_admin', 0)));
  });
  test('carga máxima (L-110): 40 puntos de 600 caracteres en UN lote', async () => {
    const puntos = Array.from({ length: 40 }, (_, i) => [String(i), puntoDe('ob_admin', i, { texto: String(i).padStart(2, '0') + 'x'.repeat(598), quien: ['contratista', 'azt', 'responsable'][i % 3] })]);
    await assertSucceeds(registrar('ob_admin', ID(70), NRO(70), { n: 40, puntos }));
    assert.equal(Object.keys((await leer('odt_afinia_obs/' + ID(70))).resumen).length, 40);
  });
});

describe('«un N.º, una obs ABIERTA» (candado odt_afinia_obs_nro)', () => {
  test('el mismo N.º no se registra dos veces mientras la primera está ABIERTA; con ella RESUELTA, sí (candado reasignado)', async () => {
    await assertSucceeds(registrar('ob_admin', ID(80), NRO(80)));
    await assertFails(registrar('ob_admin', ID(81), NRO(80)));
    await assertSucceeds(resolver('ob_admin', ID(80)));
    await assertSucceeds(registrar('ob_admin', ID(81), NRO(80)));
    assert.deepEqual(await leer('odt_afinia_obs_nro/' + NRO(80)), { obsId: ID(81) });
    assert.equal((await leer('odt_afinia_obs/' + ID(80))).estado, 'RESUELTA', 'la anterior queda (nada se borra)');
    // El candado no se reasigna a una obs que ya existe, ni sin la obs nueva en el lote.
    await assertFails(setDoc(doc(plano('ob_admin'), 'odt_afinia_obs_nro', NRO(80)), { obsId: ID(80) }));
  });
  test('el candado lo lee solo el admin; nadie lo lista ni lo borra', async () => {
    await assertSucceeds(getDoc(doc(plano('ob_admin'), 'odt_afinia_obs_nro', NRO(1))));
    await assertFails(getDoc(doc(plano('ob_azt'), 'odt_afinia_obs_nro', NRO(1))));
    await assertFails(getDocs(query(collection(plano('ob_admin'), 'odt_afinia_obs_nro'), limit(5))));
    await assertFails(deleteDoc(doc(plano('ob_admin'), 'odt_afinia_obs_nro', NRO(1))));
  });
});

describe('lectura — un admin con perfil o el AZT asignado; nadie más', () => {
  test('el AZT asignado lee su obs y sus puntos y la lista con array-contains (limit ≤ 50); el admin, todas', async () => {
    const az = plano('ob_azt');
    await assertSucceeds(getDoc(doc(az, 'odt_afinia_obs', ID(1))));
    await assertSucceeds(getDocs(query(collection(az, 'odt_afinia_obs'), where('lectores', 'array-contains', 'ob_azt'), orderBy('creadoEn', 'desc'), limit(50))));
    await assertSucceeds(getDocs(query(collection(az, 'odt_afinia_obs', ID(1), 'puntos'), limit(40))));
    await assertSucceeds(getDoc(doc(az, 'odt_afinia_obs', ID(1), 'puntos', '0')));
    await assertFails(getDocs(query(collection(az, 'odt_afinia_obs'), orderBy('creadoEn', 'desc'), limit(50))));      // sin su filtro
    await assertFails(getDocs(query(collection(az, 'odt_afinia_obs'), where('lectores', 'array-contains', 'ob_azt'), limit(51))));
    await assertFails(getDocs(query(collection(az, 'odt_afinia_obs', ID(1), 'puntos'), limit(41))));
    const ad = plano('ob_admin');
    await assertSucceeds(getDocs(query(collection(ad, 'odt_afinia_obs'), orderBy('creadoEn', 'desc'), limit(50))));
    await assertSucceeds(getDoc(doc(ad, 'odt_afinia_obs', ID(1), 'puntos', '1')));
  });
  test('otro técnico, un visitante, un admin de arranque sin perfil y un anónimo no la leen (ni sus puntos)', async () => {
    for (const d of [plano('ob_azt2'), plano('ob_tercero'), plano('ob_visit'), plano('ob_arranque'), anon()]) {
      await assertFails(getDoc(doc(d, 'odt_afinia_obs', ID(1))));
      await assertFails(getDoc(doc(d, 'odt_afinia_obs', ID(1), 'puntos', '0')));
      await assertFails(getDocs(query(collection(d, 'odt_afinia_obs', ID(1), 'puntos'), limit(40))));
    }
    // Su propia consulta sí corre, y solo trae las suyas (sin datos ajenos).
    const r = await getDocs(query(collection(plano('ob_azt2'), 'odt_afinia_obs'), where('lectores', 'array-contains', 'ob_azt2'), limit(50)));
    assert.ok(r.docs.every((x) => x.data().lectores.includes('ob_azt2')));
    await assertFails(getDocs(query(collection(plano('ob_tercero'), 'odt_afinia_obs'), where('lectores', 'array-contains', 'ob_azt'), limit(50))));
    await assertFails(getDocs(query(collection(plano('ob_visit'), 'odt_afinia_obs'), where('lectores', 'array-contains', 'ob_visit'), limit(50))));
  });
});

describe('AZT asignado: PENDIENTE → SUBSANADO de SU obs, con nota, con su rastro y el resumen en el MISMO lote', () => {
  test('pasa con nota; el rastro guarda de, a, nota, quién y la hora del servidor; el resumen lo dice', async () => {
    await assertFails(cambiar('ob_azt', ID(1), '0', 'SUBSANADO', { nota: 'ok' }));                 // nota de 2
    await assertFails(cambiar('ob_azt', ID(1), '0', 'SUBSANADO', { nota: '     ' }));              // solo espacios
    await assertSucceeds(cambiar('ob_azt', ID(1), '0', 'SUBSANADO', { nota: 'Se subió la foto del antes' }));
    const p = await leer('odt_afinia_obs/' + ID(1) + '/puntos/0');
    assert.equal(p.estado, 'SUBSANADO'); assert.equal(p.rev, 1);
    assert.deepEqual(Object.keys(p.rastro), ['1']);
    assert.deepEqual({ ...p.rastro['1'], en: null }, { de: 'PENDIENTE', a: 'SUBSANADO', nota: 'Se subió la foto del antes', por: QUIEN('ob_azt'), en: null });
    assert.ok(p.rastro['1'].en && typeof p.rastro['1'].en.toMillis === 'function', 'hora del servidor');
    const o = await leer('odt_afinia_obs/' + ID(1));
    assert.equal(o.resumen['0'], 'SUBSANADO'); assert.equal(o.ultimo, '0');
    // Otra vez sobre el mismo punto (ya SUBSANADO): no.
    await assertFails(cambiar('ob_azt', ID(1), '0', 'SUBSANADO', { nota: 'Otra vez' }));
  });
  test('atado en las dos direcciones: sin el resumen, el resumen solo, o un resumen distinto, se niega', async () => {
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { sinObs: true }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { sinPunto: true }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { obs: { 'resumen.1': 'VERIFICADO', ultimo: '1' } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { obs: { 'resumen.1': 'SUBSANADO', 'resumen.0': 'VERIFICADO', ultimo: '1' } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { obs: { 'resumen.1': 'SUBSANADO', ultimo: '0' } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { obs: { 'resumen.1': 'SUBSANADO', ultimo: '1', estado: 'RESUELTA' } }));
  });
  test('rastro obligatorio y exacto: sin entrada, con otro «de», a nombre de otro, con campos de más o saltando rev, se niega', async () => {
    // Sin la entrada del rastro.
    await assertFails((async () => {
      const d = plano('ob_azt'); const b = writeBatch(d);
      b.update(doc(d, 'odt_afinia_obs', ID(1), 'puntos', '1'), { estado: 'SUBSANADO', rev: 1 });
      b.update(doc(d, 'odt_afinia_obs', ID(1)), { 'resumen.1': 'SUBSANADO', ultimo: '1' });
      return b.commit();
    })());
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { entrada: { de: 'VERIFICADO' } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { entrada: { por: QUIEN('ob_admin') } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { entrada: { extra: 1 } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { entrada: { en: new Date() } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { rev: 2 }));
    // Solo esos campos: cambiar el texto o a quién le toca, no.
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { punto: { texto: 'Texto cambiado por el AZT' } }));
    await assertFails(cambiar('ob_azt', ID(1), '1', 'SUBSANADO', { punto: { quien: 'responsable' } }));
    // Ni saltar a VERIFICADO.
    await assertFails(cambiar('ob_azt', ID(1), '1', 'VERIFICADO'));
    // Control: el mismo cambio bien hecho pasa.
    await assertSucceeds(cambiar('ob_azt', ID(1), '1', 'SUBSANADO'));
  });
  test('solo el AZT asignado: otro técnico, un visitante, el admin y un anónimo no marcan subsanado', async () => {
    await assertSucceeds(registrar('ob_admin', ID(90), NRO(90)));
    await assertFails(cambiar('ob_azt2', ID(90), '0', 'SUBSANADO'));
    await assertFails(cambiar('ob_visit', ID(90), '0', 'SUBSANADO'));
    await assertFails(cambiar('ob_admin', ID(90), '0', 'SUBSANADO'));
    await assertFails(cambiar('ob_tercero', ID(90), '0', 'SUBSANADO'));
    // Ni el AZT de OTRA obs (ob_azt2 tiene la suya, ID(18)) sobre esta.
    await assertSucceeds(cambiar('ob_azt2', ID(18), '0', 'SUBSANADO'));
    await assertSucceeds(cambiar('ob_azt', ID(90), '0', 'SUBSANADO'));
  });
});

describe('admin: verificar o devolver, solo desde SUBSANADO; quien lo marcó subsanado no lo revisa', () => {
  test('devolver exige motivo; verificar admite nota vacía; desde PENDIENTE o VERIFICADO, no', async () => {
    await assertFails(cambiar('ob_admin', ID(1), '0', 'PENDIENTE', { nota: '' }));
    await assertSucceeds(cambiar('ob_admin', ID(1), '0', 'PENDIENTE', { nota: 'La foto no tiene fecha' }));
    await assertFails(cambiar('ob_admin', ID(1), '0', 'VERIFICADO', { nota: '' }));                 // ya está PENDIENTE
    await assertSucceeds(cambiar('ob_azt', ID(1), '0', 'SUBSANADO', { nota: 'Foto con fecha' }));
    await assertFails(cambiar('ob_azt', ID(1), '0', 'VERIFICADO', { nota: '' }));                   // el AZT no verifica
    await assertSucceeds(cambiar('ob_admin', ID(1), '0', 'VERIFICADO', { nota: '' }));
    await assertFails(cambiar('ob_admin', ID(1), '0', 'PENDIENTE', { nota: 'Devolver un verificado' }));
    const p = await leer('odt_afinia_obs/' + ID(1) + '/puntos/0');
    assert.deepEqual(Object.keys(p.rastro), ['1', '2', '3', '4'], 'el rastro solo crece');
    assert.deepEqual(Object.values(p.rastro).map((e) => [e.de, e.a, e.por.uid]), [
      ['PENDIENTE', 'SUBSANADO', 'ob_azt'], ['SUBSANADO', 'PENDIENTE', 'ob_admin'], ['PENDIENTE', 'SUBSANADO', 'ob_azt'], ['SUBSANADO', 'VERIFICADO', 'ob_admin']
    ]);
  });
  test('separación de funciones: el admin que además es el AZT no verifica lo que él marcó; otro admin sí', async () => {
    await assertSucceeds(cambiar('ob_admin2', ID(17), '0', 'SUBSANADO', { nota: 'Lo hice yo' }));
    await assertFails(cambiar('ob_admin2', ID(17), '0', 'VERIFICADO', { nota: '' }));
    await assertFails(cambiar('ob_admin2', ID(17), '0', 'PENDIENTE', { nota: 'Me lo devuelvo' }));
    await assertSucceeds(cambiar('ob_admin', ID(17), '0', 'VERIFICADO', { nota: 'Revisado' }));
  });
  test('nada se reescribe del rastro: tocar una entrada anterior o mandarlo entero sin ella, se niega', async () => {
    const p = await leer('odt_afinia_obs/' + ID(1) + '/puntos/1');     // SUBSANADO, rev 1
    assert.equal(p.estado, 'SUBSANADO');
    await assertFails(cambiar('ob_admin', ID(1), '1', 'VERIFICADO', { punto: { 'rastro.1': { ...p.rastro['1'], nota: 'Nota reescrita' } } }));
    // El rastro mandado ENTERO, sin la entrada 1 (la «quita»): se niega.
    await assertFails((async () => {
      const d = plano('ob_admin'); const b = writeBatch(d);
      b.update(doc(d, 'odt_afinia_obs', ID(1), 'puntos', '1'), {
        estado: 'VERIFICADO', rev: 2, rastro: { 2: { de: 'SUBSANADO', a: 'VERIFICADO', nota: '', por: QUIEN('ob_admin'), en: serverTimestamp() } }
      });
      b.update(doc(d, 'odt_afinia_obs', ID(1)), { 'resumen.1': 'VERIFICADO', ultimo: '1' });
      return b.commit();
    })());
    await assertSucceeds(cambiar('ob_admin', ID(1), '1', 'VERIFICADO'));
  });
});

describe('agregar punto — admin con perfil, obs ABIERTA, con su entrada PENDIENTE en el resumen', () => {
  test('pasa con el punto y su resumen en UN lote; sin uno de los dos, o el AZT, o pisando un id, no', async () => {
    await assertFails(agregar('ob_admin', ID(1), '2', { sinObs: true }));
    await assertFails(agregar('ob_admin', ID(1), '2', { sinPunto: true }));
    await assertFails(agregar('ob_azt', ID(1), '2'));
    await assertFails(agregar('ob_admin', ID(1), '40', { obs: { 'resumen.40': 'PENDIENTE', ultimo: '40' } }));
    await assertFails(agregar('ob_admin', ID(1), '2', { obs: { 'resumen.2': 'VERIFICADO', ultimo: '2' } }));
    await assertSucceeds(agregar('ob_admin', ID(1), '2'));
    assert.equal((await leer('odt_afinia_obs/' + ID(1))).resumen['2'], 'PENDIENTE');
    await assertFails(agregar('ob_admin', ID(1), '2'));                                   // ya existe: sería un update
    await assertFails(agregar('ob_admin', ID(1), '0', { datos: puntoDe('ob_admin', 0) })); // pisar el punto 0
  });
});

// Decisión documentada en la cabecera del bloque de reglas (2026-11-21): por el presupuesto de lecturas, el registro
// exige solo que exista el ÚLTIMO punto. Un registro a medias (escrito directo a la base: la página siempre escribe
// todos) deja un hueco, y SOLO un admin con perfil lo repara creando el punto que falta, con la obs ABIERTA y su
// entrada PENDIENTE ya en el resumen.
describe('hueco de un registro a medias — lo repara solo un admin con perfil', () => {
  test('el registro sin el punto 0 pasa; el AZT, el admin sin perfil, otro estado u otro id no lo reparan; el admin sí; con la obs RESUELTA, nadie', async () => {
    const hueco = (id, nro) => registrar('ob_admin', id, nro, { n: 3, puntos: [['1', puntoDe('ob_admin', 1)], ['2', puntoDe('ob_admin', 2)]] });
    const suelto = (uid, id, k, extra) => setDoc(doc(plano(uid), 'odt_afinia_obs', id, 'puntos', k), puntoDe(uid, k, extra));
    await assertSucceeds(hueco(ID(120), NRO(120)));
    await assertFails(suelto('ob_azt', ID(120), '0'));
    await assertFails(suelto('ob_arranque', ID(120), '0'));
    await assertFails(suelto('ob_admin', ID(120), '0', { estado: 'VERIFICADO' }));
    await assertFails(suelto('ob_admin', ID(120), '3'));            // '3' no está en el resumen
    await assertSucceeds(suelto('ob_admin', ID(120), '0'));
    await assertFails(suelto('ob_admin', ID(120), '0'));            // ya existe: sería un update
    assert.deepEqual((await leer('odt_afinia_obs/' + ID(120))).resumen, resumenDe(3), 'el resumen no cambió');
    // Con la obs RESUELTA, el hueco ya no se repara (sus puntos se conservan tal cual).
    await assertSucceeds(hueco(ID(121), NRO(121)));
    await assertSucceeds(resolver('ob_admin', ID(121)));
    await assertFails(suelto('ob_admin', ID(121), '0'));
  });
});

describe('RESUELTA — admin con perfil y nota; final: ningún punto ni el resumen vuelven a cambiar', () => {
  test('el AZT no la resuelve; sin nota, no; después, nada cambia y no vuelve a ABIERTA', async () => {
    await assertSucceeds(registrar('ob_admin', ID(100), NRO(100)));
    await assertSucceeds(cambiar('ob_azt', ID(100), '0', 'SUBSANADO'));
    await assertFails(resolver('ob_azt', ID(100)));
    await assertFails(resolver('ob_admin', ID(100), { resolucion: { nota: 'no', por: QUIEN('ob_admin'), en: serverTimestamp() } }));
    await assertFails(resolver('ob_admin', ID(100), { rev: 2 }));
    await assertFails(resolver('ob_admin', ID(100), { resumen: {} }));
    await assertSucceeds(resolver('ob_admin', ID(100)));
    await assertFails(cambiar('ob_azt', ID(100), '1', 'SUBSANADO'));
    await assertFails(cambiar('ob_admin', ID(100), '0', 'VERIFICADO'));
    await assertFails(agregar('ob_admin', ID(100), '2'));
    await assertFails(updateDoc(doc(plano('ob_admin'), 'odt_afinia_obs', ID(100)), { estado: 'ABIERTA', rev: 2 }));
    await assertFails(resolver('ob_admin', ID(100), { rev: 2 }));
    // Se sigue leyendo (nada se borra).
    await assertSucceeds(getDoc(doc(plano('ob_azt'), 'odt_afinia_obs', ID(100))));
  });
});

describe('nada se borra', () => {
  test('ni la obs, ni un punto, ni el candado: tampoco el admin', async () => {
    for (const u of ['ob_admin', 'ob_azt']) {
      await assertFails(deleteDoc(doc(plano(u), 'odt_afinia_obs', ID(1))));
      await assertFails(deleteDoc(doc(plano(u), 'odt_afinia_obs', ID(1), 'puntos', '0')));
      await assertFails(deleteDoc(doc(plano(u), 'odt_afinia_obs_nro', NRO(1))));
    }
    assert.ok(await leer('odt_afinia_obs/' + ID(1)));
  });
});
