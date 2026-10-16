// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada (F60-ADM) · reglas en el emulador
// ──────────────────────────────────────────────────────────────
// Firestore: informes_brigada (+ versiones, archivos), informes_brigada_config,
// informes_brigada_fichas (+ partes) e informes_brigada_bin.
// Storage:   informes_brigada/{id}/archivos, informes_brigada_marca/{logos,
//            firmas, fichas}.
// Cada caso en las DOS direcciones (L-73). Identidades con prefijo `ib_`;
// nunca clearFirestore() (los archivos de tests-rules comparten emulador).
// Al final, la CAPA DE DATOS real (data/informes_brigada*.js) contra estas
// mismas reglas, con el SDK de npm inyectado: lo que escribe la pantalla pasa.
// Datos INVENTADOS.
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as FS from 'firebase/firestore';
import * as ST from 'firebase/storage';
import { crearRepositorio } from '../assets/js/data/informes_brigada.js';
import { crearAlmacen, resolverBytes } from '../assets/js/data/informes_brigada_almacen.js';
import { ErrorIBR, nuevoIdArchivo, rutaArchivo, idBin, idFicha, rutaParteFicha, rutaFicha } from '../assets/js/domain/informe_brigada_rutas.js';

const {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, limit, where, writeBatch, serverTimestamp, Timestamp, Bytes
} = FS;
const { ref, uploadBytes, getBytes, deleteObject, listAll, getMetadata } = ST;

const ACT = 'Actualización y repotenciación del sistema de refrigeración.';
const H = 'ab'.repeat(32);
const H2 = 'cd'.repeat(32);
const NOMBRES = {
  ib_admin: 'Admin Prueba', ib_editor: 'Editor Prueba', ib_tecnico: 'Tecnico Prueba',
  ib_inactivo: 'Inactivo Prueba', ib_admin_fuera: 'Admin Fuera Prueba'
};
const ROLES = { ib_admin: 'admin', ib_editor: 'tecnico', ib_tecnico: 'tecnico', ib_inactivo: 'tecnico', ib_admin_fuera: 'admin' };
const autor = (uid) => ({ uid, nombre: NOMBRES[uid] });
const EQUIPO = { transformador_id: 'tx-prueba-1', matricula: 'T9-Z/Z-PRU', subestacion: 'Prueba Norte', serie: 'SERIE-PRUEBA-001' };
const CONTENIDO = { esquema: 'ibr@1', equipo: { matricula: 'T9-Z/Z-PRU' }, odt: ['ODT-PRUEBA-1'], tablas: { material: [{ descripcion: 'X', cantidad: 1 }] } };
const CONFIG = (extra = {}) => ({
  editores: ['ib_editor', 'ib_admin', 'ib_inactivo'], contrato_defecto: '9900000001', almacen: 'storage',
  firmantes: [], marca: {}, actualizadoPor: autor('ib_admin'), actualizadoEn: serverTimestamp(), ...extra
});

// Imágenes mínimas reales (las reglas miran contentType; el emulador inspecciona el archivo).
const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x11, 0x22, 0x33, 0xFF, 0xD9]);
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const relleno = (base, n) => { const b = new Uint8Array(n); b.set(base); return b; };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const bytesFs = (n) => Bytes.fromUint8Array(new Uint8Array(n).fill(7));

let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const st = (uid) => testEnv.authenticatedContext(uid).storage();
const anon = () => testEnv.unauthenticatedContext();

async function sinReglas(fn) { await testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx)); }
const sembrarConfig = (extra) => sinReglas((ctx) => setDoc(doc(ctx.firestore(), 'informes_brigada_config/general'), CONFIG(extra)));

/** Un informe ya existente (sembrado sin reglas). */
function informeBase(extra = {}) {
  return {
    esquema: 'ibr@1', modelo: 'F60-REFRIG@1', actividad: ACT, equipo_ref: EQUIPO,
    estado: 'borrador', version: 0, rev: 1, contenido: CONTENIDO, anulacion: null,
    creadoPor: autor('ib_editor'), creadoEn: Timestamp.fromMillis(1_000_000), actualizadoPor: autor('ib_editor'), actualizadoEn: Timestamp.fromMillis(1_000_000),
    ...extra
  };
}
const sembrar = (id, extra) => sinReglas((ctx) => setDoc(doc(ctx.firestore(), 'informes_brigada', id), informeBase(extra)));

/** Lo que escribe la pantalla al crear. */
function nuevo(uid, extra = {}) {
  return {
    esquema: 'ibr@1', modelo: 'F60-REFRIG@1', actividad: ACT, equipo_ref: EQUIPO,
    estado: 'borrador', version: 0, rev: 1, contenido: CONTENIDO, anulacion: null,
    creadoPor: autor(uid), creadoEn: serverTimestamp(), actualizadoPor: autor(uid), actualizadoEn: serverTimestamp(),
    ...extra
  };
}
const crear = (uid, id, extra) => setDoc(doc(db(uid), 'informes_brigada', id), nuevo(uid, extra));
const guardar = (uid, id, cambios) => updateDoc(doc(db(uid), 'informes_brigada', id), { actualizadoPor: autor(uid), actualizadoEn: serverTimestamp(), ...cambios });

/** Emitir: informe + versiones/{n} en el MISMO lote. */
function emitir(uid, id, { n = 1, rev = 2, contenido = CONTENIDO, contenidoVersion, motivo = '', soloVersion = false, soloInforme = false, firmas = [] } = {}) {
  const d = db(uid);
  const b = writeBatch(d);
  if (!soloVersion) {
    b.update(doc(d, 'informes_brigada', id), {
      estado: 'emitido', version: n, rev, contenido, actualizadoPor: autor(uid), actualizadoEn: serverTimestamp(),
      emitidoPor: autor(uid), emitidoEn: serverTimestamp()
    });
  }
  if (!soloInforme) {
    b.set(doc(d, 'informes_brigada', id, 'versiones', String(n)), {
      version: n, contenido: contenidoVersion || contenido, huella: H, motivo, firmas, marca: {}, emitidoPor: autor(uid), en: serverTimestamp()
    });
  }
  return b.commit();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sgm-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 }
  });
  await sinReglas(async (ctx) => {
    const d = ctx.firestore();
    for (const uid of Object.keys(NOMBRES)) {
      await setDoc(doc(d, 'usuarios', uid), { email: uid + '@x.co', rol: ROLES[uid], activo: uid !== 'ib_inactivo', nombre: NOMBRES[uid] });
    }
  });
  await sembrarConfig();
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

// ══════════════════════════════════════════════════════════════
// FIRESTORE
// ══════════════════════════════════════════════════════════════
describe('1 · configuración: la lee el equipo; la escribe un admin; nadie la borra', () => {
  test('leer general: equipo sí; inactivo, anónimo u otro id no; nadie lista', async () => {
    await assertSucceeds(getDoc(doc(db('ib_tecnico'), 'informes_brigada_config/general')));
    await assertFails(getDoc(doc(db('ib_inactivo'), 'informes_brigada_config/general')));
    await assertFails(getDoc(doc(anon().firestore(), 'informes_brigada_config/general')));
    await assertFails(getDoc(doc(db('ib_tecnico'), 'informes_brigada_config/otro')));
    await assertFails(getDocs(query(collection(db('ib_admin'), 'informes_brigada_config'), limit(5))));
  });
  test('escribir: admin con la forma exacta sí; técnico, clave de más, almacén raro, 11 editores o sello ajeno no', async () => {
    const ref_ = (uid) => doc(db(uid), 'informes_brigada_config/general');
    await assertFails(setDoc(ref_('ib_tecnico'), { ...CONFIG(), actualizadoPor: autor('ib_tecnico') }));
    await assertSucceeds(setDoc(ref_('ib_admin'), CONFIG()));
    await assertFails(setDoc(ref_('ib_admin'), CONFIG({ otra: 1 })));
    await assertFails(setDoc(ref_('ib_admin'), CONFIG({ almacen: 'otro' })));
    await assertFails(setDoc(ref_('ib_admin'), CONFIG({ editores: Array.from({ length: 11 }, (_, i) => 'u' + i) })));
    await assertFails(setDoc(ref_('ib_admin'), CONFIG({ actualizadoPor: autor('ib_editor') })));
    await assertFails(setDoc(ref_('ib_admin'), CONFIG({ actualizadoPor: { uid: 'ib_admin', nombre: 'Otro Nombre' } })));
    await assertFails(setDoc(ref_('ib_admin'), CONFIG({ contrato_defecto: '1'.repeat(21) })));
    await assertFails(setDoc(ref_('ib_admin'), CONFIG({ actualizadoEn: Timestamp.now() })));
    // Configurar es de administrador (no hace falta ser editor): el admin fuera de la lista SÍ configura.
    await assertSucceeds(setDoc(ref_('ib_admin_fuera'), CONFIG({ actualizadoPor: autor('ib_admin_fuera') })));
    await assertFails(deleteDoc(ref_('ib_admin')));
  });
});

describe('2 · crear un informe: solo un editor activo, en borrador, v0, rev 1', () => {
  test('editor sí; técnico no editor, editor inactivo o admin fuera de la lista no', async () => {
    await assertSucceeds(crear('ib_editor', 'c_ok'));
    await assertFails(crear('ib_tecnico', 'c_tec'));
    await assertFails(crear('ib_inactivo', 'c_inac'));
    await assertFails(crear('ib_admin_fuera', 'c_fuera'));
    await assertSucceeds(crear('ib_admin', 'c_admin'));   // admin que SÍ está en la lista
  });
  test('sin el documento de configuración nadie crea', async () => {
    await sinReglas((ctx) => deleteDoc(doc(ctx.firestore(), 'informes_brigada_config/general')));
    try {
      await assertFails(crear('ib_editor', 'c_sincfg'));
    } finally {
      await sembrarConfig();
    }
    await assertSucceeds(crear('ib_editor', 'c_concfg'));
  });
  test('estado, versión o rev de entrada distintos: no', async () => {
    await assertFails(crear('ib_editor', 'c_e1', { estado: 'emitido' }));
    await assertFails(crear('ib_editor', 'c_e2', { version: 1 }));
    await assertFails(crear('ib_editor', 'c_e3', { rev: 2 }));
  });
  test('otra actividad, otro modelo, otro esquema o equipo sin matrícula: no', async () => {
    await assertFails(crear('ib_editor', 'c_i1', { actividad: 'Mantenimiento de rutina PSM.' }));
    await assertFails(crear('ib_editor', 'c_i2', { modelo: 'OTRO@1' }));
    await assertFails(crear('ib_editor', 'c_i3', { esquema: 'ibr@2' }));
    await assertFails(crear('ib_editor', 'c_i4', { equipo_ref: { transformador_id: 'x', subestacion: 'y' } }));
    await assertFails(crear('ib_editor', 'c_i5', { equipo_ref: { ...EQUIPO, extra: 1 } }));
  });
  test('autoría: creadoPor ajeno, nombre distinto al del perfil o fecha del cliente: no', async () => {
    await assertFails(crear('ib_editor', 'c_a1', { creadoPor: autor('ib_admin') }));
    await assertFails(crear('ib_editor', 'c_a2', { creadoPor: { uid: 'ib_editor', nombre: 'Otro' }, actualizadoPor: { uid: 'ib_editor', nombre: 'Otro' } }));
    await assertFails(crear('ib_editor', 'c_a3', { creadoEn: Timestamp.now() }));
  });
  test('forma: clave de más o emitidoPor de entrada: no', async () => {
    await assertFails(crear('ib_editor', 'c_f1', { extra: 1 }));
    await assertFails(crear('ib_editor', 'c_f2', { emitidoPor: autor('ib_editor') }));
  });
});

describe('3 · leer: el equipo activo, con tope', () => {
  test('get del equipo; list con limit 200; sin límite o con 201 no; inactivo no', async () => {
    await sembrar('l_1');
    await assertSucceeds(getDoc(doc(db('ib_tecnico'), 'informes_brigada', 'l_1')));
    await assertSucceeds(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada'), limit(200))));
    await assertSucceeds(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada'), where('equipo_ref.matricula', '==', 'T9-Z/Z-PRU'), limit(50))));
    await assertFails(getDocs(collection(db('ib_tecnico'), 'informes_brigada')));
    await assertFails(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada'), limit(201))));
    await assertFails(getDoc(doc(db('ib_inactivo'), 'informes_brigada', 'l_1')));
    await assertFails(getDoc(doc(anon().firestore(), 'informes_brigada', 'l_1')));
  });
});

describe('4 · guardar el borrador: rev + 1 exacto; la identidad no cambia', () => {
  test('rev + 1 sí; mismo rev (choque) o rev + 2 no', async () => {
    await sembrar('g_1');
    await assertFails(guardar('ib_editor', 'g_1', { contenido: { a: 1 }, rev: 1 }));
    await assertFails(guardar('ib_editor', 'g_1', { contenido: { a: 1 }, rev: 3 }));
    await assertSucceeds(guardar('ib_editor', 'g_1', { contenido: { a: 1 }, rev: 2 }));
  });
  test('equipo_ref, actividad, creadoPor o creadoEn no se tocan', async () => {
    await sembrar('g_2');
    await assertFails(guardar('ib_editor', 'g_2', { rev: 2, equipo_ref: { ...EQUIPO, matricula: 'OTRA' } }));
    await assertFails(guardar('ib_editor', 'g_2', { rev: 2, actividad: 'Mantenimiento de rutina PSM.' }));
    await assertFails(guardar('ib_editor', 'g_2', { rev: 2, creadoPor: autor('ib_admin') }));
    await assertFails(guardar('ib_editor', 'g_2', { rev: 2, creadoEn: serverTimestamp() }));
  });
  test('técnico no editor no guarda; nadie se marca emitido sin versión ni anulado sin ser admin', async () => {
    await sembrar('g_3');
    await assertFails(guardar('ib_tecnico', 'g_3', { contenido: { a: 1 }, rev: 2 }));
    await assertFails(guardar('ib_editor', 'g_3', { rev: 2, estado: 'emitido' }));
    await assertFails(guardar('ib_editor', 'g_3', { rev: 2, version: 1 }));
    await assertFails(guardar('ib_editor', 'g_3', { rev: 2, anulacion: { motivo: 'motivo largo de prueba', por: autor('ib_editor'), en: serverTimestamp() } }));
    await assertFails(guardar('ib_editor', 'g_3', { rev: 2, estado: 'anulado', anulacion: { motivo: 'motivo largo de prueba', por: autor('ib_editor'), en: serverTimestamp() } }));
  });
});

describe('5 · emitir y corregir: versión + 1 con su copia congelada idéntica', () => {
  test('lote informe + versiones/1 sí; versión + 2, copia distinta o una sola de las dos partes no', async () => {
    await sembrar('e_1');
    await assertFails(emitir('ib_editor', 'e_1', { n: 2 }));
    await assertFails(emitir('ib_editor', 'e_1', { contenidoVersion: { otro: true } }));
    await assertFails(emitir('ib_editor', 'e_1', { soloVersion: true }));
    await assertFails(emitir('ib_editor', 'e_1', { soloInforme: true }));
    await assertFails(emitir('ib_tecnico', 'e_1'));
    await assertSucceeds(emitir('ib_editor', 'e_1'));
  });
  test('emitido: el contenido no se edita; corregir vuelve a borrador SIN cambiar el contenido', async () => {
    await sembrar('e_2', { estado: 'emitido', version: 1, rev: 2, emitidoPor: autor('ib_editor'), emitidoEn: Timestamp.fromMillis(2_000_000) });
    await assertFails(guardar('ib_editor', 'e_2', { contenido: { cambiado: 1 }, rev: 3 }));
    await assertFails(guardar('ib_editor', 'e_2', { estado: 'borrador', contenido: { cambiado: 1 }, rev: 3 }));
    await assertFails(guardar('ib_tecnico', 'e_2', { estado: 'borrador', rev: 3 }));
    await assertFails(guardar('ib_editor', 'e_2', { estado: 'borrador', rev: 3, emitidoPor: autor('ib_admin') }));
    await assertSucceeds(guardar('ib_editor', 'e_2', { estado: 'borrador', rev: 3 }));
  });
  test('v2: motivo corto no; motivo de 10 o más sí', async () => {
    await sembrar('e_3', { estado: 'borrador', version: 1, rev: 3, emitidoPor: autor('ib_editor'), emitidoEn: Timestamp.fromMillis(2_000_000) });
    await assertFails(emitir('ib_editor', 'e_3', { n: 2, rev: 4, motivo: 'corto' }));
    await assertSucceeds(emitir('ib_editor', 'e_3', { n: 2, rev: 4, motivo: 'Corrige la tabla de corrientes' }));
  });
  test('firmas al emitir: solo la del firmante escogido en ESA línea, con su nombre y su carpeta; nada de basura', async () => {
    // contenido con la línea «elaborado» del firmante f-ana-prueba (inventado) y «revisado» escrita a mano
    const C = { ...CONTENIDO, firmas: { elaborado: { nombre: 'ANA PRUEBA', firmante: 'f-ana-prueba' }, revisado: { nombre: 'OTRA PERSONA', firmante: null }, aprobado: { nombre: '', firmante: null } } };
    const meta = (clave, extra = {}) => ({ almacen: 'storage', ruta: `informes_brigada_marca/firmas/${clave}/${H}`, huella: H, mime: 'image/png', ancho: 300, alto: 100, ...extra });
    const buena = { rol: 'elaborado', clave: 'f-ana-prueba', nombre: 'ANA PRUEBA', firma: meta('f-ana-prueba') };
    const intento = async (id, firmas) => { await sembrar(id, { contenido: C }); return emitir('ib_editor', id, { contenido: C, firmas }); };
    await assertFails(intento('ef_1', [{ ...buena, rol: 'aprobado' }]));                                  // otra línea
    await assertFails(intento('ef_2', [{ ...buena, clave: 'f-persona-ajena', firma: meta('f-persona-ajena') }]));   // firma de otro
    await assertFails(intento('ef_3', [{ ...buena, firma: meta('f-ana-prueba', { ruta: `informes_brigada_marca/firmas/f-persona-ajena/${H}` }) }]));   // carpeta ajena
    await assertFails(intento('ef_4', [{ ...buena, nombre: 'OTRO NOMBRE' }]));                           // nombre distinto al de la línea
    await assertFails(intento('ef_5', [{ rol: 'revisado', clave: 'f-otra', nombre: 'OTRA PERSONA', firma: meta('f-otra') }]));   // línea a mano: sin firmante
    await assertFails(intento('ef_6', ['basura']));
    await assertFails(intento('ef_7', [buena, buena]));                                                  // dos veces la misma línea
    await assertFails(intento('ef_8', [{ ...buena, extra: 1 }]));
    await assertSucceeds(intento('ef_9', [buena]));
    await assertSucceeds(intento('ef_10', [{ ...buena, firma: meta('f-ana-prueba', { almacen: 'firestore', ruta: `informes_brigada_bin/firma_f-ana-prueba_${H.slice(0, 16)}` }) }]));
    await assertSucceeds(intento('ef_11', []));
  });
  test('firmas al emitir: las TRES líneas a la vez (Elaborado, Revisado, Aprobado), cada una con su firmante (§163.12)', async () => {
    // nombres inventados; imágenes en Firestore (informes_brigada_bin), como las firmas de terceros en producción
    const C = { ...CONTENIDO, firmas: { elaborado: { nombre: 'ANA PRUEBA', firmante: 'f-ana-prueba' }, revisado: { nombre: 'BETO PRUEBA', firmante: 'f-beto-prueba' }, aprobado: { nombre: 'CIRO PRUEBA', firmante: 'f-ciro-prueba' } } };
    const meta = (clave, extra = {}) => ({ almacen: 'firestore', ruta: `informes_brigada_bin/firma_${clave}_${H.slice(0, 16)}`, huella: H, mime: 'image/png', ancho: 572, alto: 129, ...extra });
    const linea = (rol, clave, nombre) => ({ rol, clave, nombre, firma: meta(clave) });
    const a = linea('elaborado', 'f-ana-prueba', 'ANA PRUEBA');
    const b = linea('revisado', 'f-beto-prueba', 'BETO PRUEBA');
    const c = linea('aprobado', 'f-ciro-prueba', 'CIRO PRUEBA');
    const intento = async (id, firmas) => { await sembrar(id, { contenido: C }); return emitir('ib_editor', id, { contenido: C, firmas }); };
    await assertFails(intento('ef3_1', [a, b, { ...c, firma: meta('f-beto-prueba') }]));                  // la imagen de otro en «aprobado»
    await assertFails(intento('ef3_2', [a, b, { ...b }]));                                               // una línea repetida
    await assertFails(intento('ef3_3', [a, b, c, { ...c }]));                                            // cuatro firmas
    await assertFails(intento('ef3_4', [a, b, { ...c, firma: meta('f-ciro-prueba', { autorizacion: { fecha: '2026-10-16', medio: 'verbal' } }) }]));   // la autorización no viaja
    await assertFails(intento('ef3_5', [a, { ...b, nombre: 'BETO OTRO' }, c]));                          // nombre distinto al de su línea
    await assertSucceeds(intento('ef3_6', [a, b, c]));
    await assertSucceeds(intento('ef3_7', [c, a, b]));                                                   // el orden no importa
  });
  test('versiones: solo se agregan; se listan con tope 50', async () => {
    await sembrar('e_4');
    await assertSucceeds(emitir('ib_editor', 'e_4'));
    const v = doc(db('ib_admin'), 'informes_brigada', 'e_4', 'versiones', '1');
    await assertFails(updateDoc(v, { motivo: 'reescrita' }));
    await assertFails(deleteDoc(v));
    await assertSucceeds(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada', 'e_4', 'versiones'), limit(50))));
    await assertFails(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada', 'e_4', 'versiones'), limit(51))));
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada', 'e_4', 'versiones', '9'), { version: 9 }));
  });
});

describe('6 · anular: solo un admin, con motivo; lo anulado queda congelado; nadie borra', () => {
  const anular = (uid, id, { motivo = 'Equipo equivocado en la prueba', rev = 2, contenido } = {}) => guardar(uid, id, {
    estado: 'anulado', rev, anulacion: { motivo, por: autor(uid), en: serverTimestamp() }, ...(contenido ? { contenido } : {})
  });
  test('admin con motivo sí; editor no admin, motivo de 9 o contenido cambiado no', async () => {
    await sembrar('a_1');
    await assertFails(anular('ib_editor', 'a_1'));
    await assertFails(anular('ib_admin', 'a_1', { motivo: 'nueve car' }));
    await assertFails(anular('ib_admin', 'a_1', { contenido: { cambiado: 1 } }));
    await assertFails(anular('ib_admin_fuera', 'a_1', { motivo: 'x' }));
    await assertSucceeds(anular('ib_admin', 'a_1'));
  });
  test('un informe anulado ya no se toca; borrar un informe: nadie', async () => {
    await sembrar('a_2', { estado: 'anulado', rev: 2, anulacion: { motivo: 'Anulado de prueba', por: autor('ib_admin'), en: Timestamp.fromMillis(3_000_000) } });
    await assertFails(guardar('ib_admin', 'a_2', { rev: 3, estado: 'borrador', anulacion: null }));
    await assertFails(guardar('ib_editor', 'a_2', { rev: 3, contenido: { a: 1 } }));
    for (const uid of ['ib_admin', 'ib_editor', 'ib_tecnico']) await assertFails(deleteDoc(doc(db(uid), 'informes_brigada', 'a_2')));
  });
});

describe('7 · archivos en Firestore (contingencia): una imagen por documento, solo en borrador', () => {
  const foto = (uid, id, a, { n = 1000, ...extra } = {}) => setDoc(doc(db(uid), 'informes_brigada', id, 'archivos', a), {
    bytes: bytesFs(n), mime: 'image/jpeg', ancho: 1600, alto: 1200, tamano: n, huella: H, subidoPor: autor(uid), en: serverTimestamp(), ...extra
  });
  test('700 KB sí; 700 KB + 1, GIF, id mal formado o tamaño que no cuadra no', async () => {
    await sembrar('f_1');
    await assertSucceeds(foto('ib_editor', 'f_1', nuevoIdArchivo(), { n: 700 * 1024 }));
    await assertFails(foto('ib_editor', 'f_1', nuevoIdArchivo(), { n: 700 * 1024 + 1 }));
    await assertFails(foto('ib_editor', 'f_1', nuevoIdArchivo(), { mime: 'image/gif' }));
    await assertFails(foto('ib_editor', 'f_1', 'a123'));
    await assertFails(foto('ib_editor', 'f_1', nuevoIdArchivo(), { tamano: 5 }));
    await assertFails(foto('ib_tecnico', 'f_1', nuevoIdArchivo()));
    await assertFails(foto('ib_editor', 'f_1', nuevoIdArchivo(), { ancho: 4001 }));
  });
  test('con el informe emitido no entra nada; update nunca; borrar solo si nunca se emitió', async () => {
    const a = nuevoIdArchivo();
    await sembrar('f_2');
    await assertSucceeds(foto('ib_editor', 'f_2', a));
    await assertFails(updateDoc(doc(db('ib_editor'), 'informes_brigada', 'f_2', 'archivos', a), { mime: 'image/png' }));
    await assertSucceeds(getDoc(doc(db('ib_tecnico'), 'informes_brigada', 'f_2', 'archivos', a)));
    await assertFails(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada', 'f_2', 'archivos'), limit(5))));
    await assertSucceeds(deleteDoc(doc(db('ib_editor'), 'informes_brigada', 'f_2', 'archivos', a)));
    const b = nuevoIdArchivo();
    await assertSucceeds(foto('ib_editor', 'f_2', b));
    await sinReglas((ctx) => updateDoc(doc(ctx.firestore(), 'informes_brigada', 'f_2'), { estado: 'emitido', version: 1 }));
    await assertFails(foto('ib_editor', 'f_2', nuevoIdArchivo()));
    await assertFails(deleteDoc(doc(db('ib_editor'), 'informes_brigada', 'f_2', 'archivos', b)));
    // un borrador ANULADO que nunca se emitió queda congelado con sus fotos (revisión de seguridad, prueba E)
    const c = nuevoIdArchivo();
    await sembrar('f_3');
    await assertSucceeds(foto('ib_editor', 'f_3', c));
    await sinReglas((ctx) => updateDoc(doc(ctx.firestore(), 'informes_brigada', 'f_3'), { estado: 'anulado' }));
    await assertFails(deleteDoc(doc(db('ib_editor'), 'informes_brigada', 'f_3', 'archivos', c)));
  });
});

describe('8 · biblioteca de fichas: la meta nunca lleva bytes; en Firestore van aparte', () => {
  const meta = (uid, f, extra = {}) => ({
    titulo: 'Ficha de prueba', marca: 'MARCA-PRUEBA', modelo: 'VX-100', almacen: 'storage', ruta: 'informes_brigada_marca/fichas/' + f,
    mime: 'image/png', ancho: 800, alto: 1000, tamano: 1000, huella: H, subidoPor: autor(uid), en: serverTimestamp(), ...extra
  });
  const parte = (uid, f, { n = 1000, ...extra } = {}) => setDoc(doc(db(uid), 'informes_brigada_fichas', f, 'partes', '0'), {
    bytes: bytesFs(n), mime: 'image/png', huella: H, subidoPor: autor(uid), en: serverTimestamp(), ...extra
  });
  test('Storage: editor sí (ruta atada al id); con bytes, ruta ajena o técnico no', async () => {
    await assertSucceeds(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', 'ficha_s_1'), meta('ib_editor', 'ficha_s_1')));
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', 'ficha_s_2'), meta('ib_editor', 'ficha_s_2', { bytes: bytesFs(10) })));
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', 'ficha_s_3'), meta('ib_editor', 'ficha_s_3', { ruta: 'informes_brigada_marca/firmas/f-x/' + H })));
    await assertFails(setDoc(doc(db('ib_tecnico'), 'informes_brigada_fichas', 'ficha_s_4'), meta('ib_tecnico', 'ficha_s_4')));
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', 'Ficha Mal'), meta('ib_editor', 'Ficha Mal')));
  });
  test('Firestore: partes/0 de 900 KB sí y luego la meta (misma huella y tamaño); sin parte o con otra huella no', async () => {
    const f = 'ficha_fs_1';
    const mf = (extra) => meta('ib_editor', f, { almacen: 'firestore', ruta: `informes_brigada_fichas/${f}/partes/0`, tamano: 900 * 1024, ...extra });
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', f), mf()));   // aún no hay bytes
    await assertFails(parte('ib_editor', 'ficha_fs_x', { n: 900 * 1024 + 1 }));
    await assertFails(parte('ib_tecnico', f, { n: 10 }));
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', f, 'partes', '1'), { bytes: bytesFs(10), mime: 'image/png', huella: H, subidoPor: autor('ib_editor'), en: serverTimestamp() }));
    await assertSucceeds(parte('ib_editor', f, { n: 900 * 1024 }));
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', f), mf({ huella: H2 })));
    await assertFails(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', f), mf({ tamano: 10 })));
    await assertSucceeds(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', f), mf()));
    await assertFails(updateDoc(doc(db('ib_editor'), 'informes_brigada_fichas', f, 'partes', '0'), { huella: H2 }));
    await assertFails(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada_fichas', f, 'partes'), limit(5))));
    await assertSucceeds(getDoc(doc(db('ib_tecnico'), 'informes_brigada_fichas', f, 'partes', '0')));
  });
  test('update nunca; NADIE borra (las versiones emitidas la usan); se lista con tope 100', async () => {
    await assertSucceeds(setDoc(doc(db('ib_editor'), 'informes_brigada_fichas', 'ficha_b_1'), meta('ib_editor', 'ficha_b_1')));
    await assertFails(updateDoc(doc(db('ib_editor'), 'informes_brigada_fichas', 'ficha_b_1'), { titulo: 'Otro título' }));
    await assertFails(deleteDoc(doc(db('ib_editor'), 'informes_brigada_fichas', 'ficha_b_1')));
    await assertFails(deleteDoc(doc(db('ib_admin'), 'informes_brigada_fichas', 'ficha_b_1')));
    await assertFails(deleteDoc(doc(db('ib_admin'), 'informes_brigada_fichas', 'ficha_fs_1', 'partes', '0')));
    await assertSucceeds(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada_fichas'), limit(100))));
    await assertFails(getDocs(query(collection(db('ib_tecnico'), 'informes_brigada_fichas'), limit(101))));
  });
});

describe('9 · logos y firmas en Firestore (contingencia)', () => {
  const bin = (uid, clase, clave, extra = {}) => {
    const datos = { clase, clave, bytes: bytesFs(500), mime: 'image/png', ancho: 300, alto: 100, tamano: 500, huella: H, subidoPor: autor(uid), en: serverTimestamp(), ...extra };
    if (clase === 'firma' && !('autorizacion' in extra)) datos.autorizacion = { fecha: '2026-10-01', medio: 'correo de prueba' };
    if (extra.autorizacion === undefined && 'autorizacion' in extra) delete datos.autorizacion;
    const id = extra.__id || `${clase}_${clave}_${H.slice(0, 16)}`;
    delete datos.__id;
    return setDoc(doc(db(uid), 'informes_brigada_bin', id), datos);
  };
  test('admin sube firma con autorización y logo con clave válida; lo demás no', async () => {
    await assertSucceeds(bin('ib_admin', 'firma', 'f-ana-prueba'));
    await assertSucceeds(bin('ib_admin', 'logo', 'applus-portada'));
    await assertFails(bin('ib_admin', 'firma', 'f-sin-aut', { autorizacion: undefined }));
    await assertFails(bin('ib_admin', 'firma', 'f-jpeg-prueba', { mime: 'image/jpeg' }));
    await assertFails(bin('ib_admin', 'logo', 'logo-inventado'));
    await assertFails(bin('ib_admin', 'logo', 'applus-encabezado', { autorizacion: { fecha: '2026-10-01', medio: 'xyz' } }));
    await assertFails(bin('ib_tecnico', 'firma', 'f-tec-prueba'));
    await assertFails(bin('ib_editor', 'logo', 'afinia-portada'));
    await assertFails(bin('ib_admin', 'logo', 'together-portada', { __id: 'logo_together-portada_' + H2.slice(0, 16) }));
    await assertFails(bin('ib_admin', 'logo', 'together-encabezado', { tamano: 1 }));
  });
  test('firma: la lee un editor; ni el técnico ni el admin fuera de la lista; el logo lo lee el equipo; nada se reescribe', async () => {
    const f = doc(db('ib_editor'), 'informes_brigada_bin', `firma_f-ana-prueba_${H.slice(0, 16)}`);
    await assertSucceeds(getDoc(f));
    await assertFails(getDoc(doc(db('ib_tecnico'), 'informes_brigada_bin', `firma_f-ana-prueba_${H.slice(0, 16)}`)));
    await assertFails(getDoc(doc(db('ib_admin_fuera'), 'informes_brigada_bin', `firma_f-ana-prueba_${H.slice(0, 16)}`)));
    await assertSucceeds(getDoc(doc(db('ib_tecnico'), 'informes_brigada_bin', `logo_applus-portada_${H.slice(0, 16)}`)));
    await assertFails(updateDoc(doc(db('ib_admin'), 'informes_brigada_bin', `logo_applus-portada_${H.slice(0, 16)}`), { mime: 'image/jpeg' }));
    await assertFails(getDocs(query(collection(db('ib_admin'), 'informes_brigada_bin'), limit(5))));
  });
  test('borrar: un logo nadie (lo usan las versiones emitidas); una firma solo un admin (el titular puede revocarla)', async () => {
    await assertFails(deleteDoc(doc(db('ib_admin'), 'informes_brigada_bin', `logo_applus-portada_${H.slice(0, 16)}`)));
    await assertFails(deleteDoc(doc(db('ib_editor'), 'informes_brigada_bin', `firma_f-ana-prueba_${H.slice(0, 16)}`)));
    await assertSucceeds(deleteDoc(doc(db('ib_admin'), 'informes_brigada_bin', `firma_f-ana-prueba_${H.slice(0, 16)}`)));
  });
});

// ══════════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════════
describe('10 · Storage · fotos del informe', () => {
  const META = { contentType: 'image/jpeg', customMetadata: { huella: H } };
  const subir = (uid, id, a, bytes = JPEG, meta = META) => uploadBytes(ref(st(uid), `informes_brigada/${id}/archivos/${a}`), bytes, meta);
  test('editor sube JPEG ≤ 700 KB; lo demás no (la regla NO lee el informe: tope de 2 documentos de Storage)', async () => {
    await sembrar('s_1');
    await sembrar('s_emitido', { estado: 'emitido', version: 1, rev: 2 });
    await assertSucceeds(subir('ib_editor', 's_1', nuevoIdArchivo(), relleno(JPEG, 700 * 1024)));
    await assertFails(subir('ib_editor', 's_1', nuevoIdArchivo(), relleno(JPEG, 700 * 1024 + 1)));
    await assertFails(subir('ib_editor', 's_1', nuevoIdArchivo(), JPEG, { contentType: 'image/gif', customMetadata: { huella: H } }));
    await assertFails(subir('ib_editor', 's_1', nuevoIdArchivo(), JPEG, { contentType: 'image/jpeg' }));
    await assertFails(subir('ib_tecnico', 's_1', nuevoIdArchivo()));
    await assertFails(subir('ib_inactivo', 's_1', nuevoIdArchivo()));
    // Storage solo puede leer DOS documentos de Firestore por evaluación (usuarios + configuración):
    // ya no mira el estado del informe. Una foto subida a un emitido queda huérfana (lo emitido está
    // congelado en versiones/{n} y no la cita); cuesta centavos y nunca cambia un informe emitido.
    await assertSucceeds(subir('ib_editor', 's_emitido', nuevoIdArchivo()));
    await assertFails(subir('ib_editor', 's_1', 'foto.jpg'));
  });
  test('sobrescribir no; borrar NADIE desde el navegador; leer el equipo; listar nadie', async () => {
    const a = nuevoIdArchivo();
    const b = nuevoIdArchivo();
    await sembrar('s_2');
    await assertSucceeds(subir('ib_editor', 's_2', a));
    await assertSucceeds(subir('ib_editor', 's_2', b));
    await assertFails(subir('ib_editor', 's_2', a));
    await assertSucceeds(getBytes(ref(st('ib_tecnico'), `informes_brigada/s_2/archivos/${a}`)));
    await assertFails(getBytes(ref(anon().storage(), `informes_brigada/s_2/archivos/${a}`)));
    await assertFails(listAll(ref(st('ib_admin'), 'informes_brigada/s_2/archivos')));
    await assertFails(listAll(ref(st('ib_admin'), 'informes_brigada')));
    await assertFails(deleteObject(ref(st('ib_tecnico'), `informes_brigada/s_2/archivos/${a}`)));
    await assertFails(deleteObject(ref(st('ib_editor'), `informes_brigada/s_2/archivos/${a}`)));
    await assertFails(deleteObject(ref(st('ib_admin'), `informes_brigada/s_2/archivos/${b}`)));
  });
});

describe('11 · Storage · logos de marca', () => {
  const sub = (uid, clave, huella, metaH = huella, bytes = PNG) => uploadBytes(ref(st(uid), `informes_brigada_marca/logos/${clave}/${huella}`), bytes, { contentType: 'image/png', customMetadata: { huella: metaH } });
  test('admin con clave válida y huella igual al nombre sí; clave inventada, huella distinta o técnico no; el equipo lo lee', async () => {
    await assertSucceeds(sub('ib_admin', 'applus-encabezado', H));
    await assertFails(sub('ib_admin', 'logo-inventado', H));
    await assertFails(sub('ib_admin', 'applus-portada', H, H2));
    await assertFails(sub('ib_admin', 'applus-portada', 'no-es-huella'));
    await assertFails(sub('ib_tecnico', 'together-portada', H));
    await assertFails(sub('ib_admin', 'afinia-portada', H, H, relleno(PNG, 1024 * 1024 + 1)));
    await assertSucceeds(getBytes(ref(st('ib_tecnico'), `informes_brigada_marca/logos/applus-encabezado/${H}`)));
    await assertFails(sub('ib_admin', 'applus-encabezado', H));   // inmutable
    await assertFails(listAll(ref(st('ib_tecnico'), 'informes_brigada_marca/logos')));
    await assertFails(deleteObject(ref(st('ib_admin'), `informes_brigada_marca/logos/applus-encabezado/${H}`)));   // lo usan versiones emitidas
  });
});

describe('12 · Storage · firmas de terceros (solo editores las leen)', () => {
  const sub = (uid, { clave = 'f-ana-prueba', huella = H, tipo = 'image/png', bytes = PNG, fecha = '2026-10-01', medio = 'correo de prueba' } = {}) => {
    const customMetadata = { huella };
    if (fecha) customMetadata.autorizacion_fecha = fecha;
    if (medio) customMetadata.autorizacion_medio = medio;
    return uploadBytes(ref(st(uid), `informes_brigada_marca/firmas/${clave}/${huella}`), bytes, { contentType: tipo, customMetadata });
  };
  test('admin con PNG y autorización sí; JPEG, sin fecha, > 512 KB, técnico no', async () => {
    await assertSucceeds(sub('ib_admin'));
    await assertFails(sub('ib_admin', { clave: 'f-jpeg', tipo: 'image/jpeg', bytes: JPEG }));
    await assertFails(sub('ib_admin', { clave: 'f-sin-fecha', fecha: '' }));
    await assertFails(sub('ib_admin', { clave: 'f-grande', bytes: relleno(PNG, 512 * 1024 + 1) }));
    await assertFails(sub('ib_tecnico', { clave: 'f-tecnico' }));
    await assertFails(sub('ib_admin', { clave: 'F-MAYUS' }));
    await assertFails(sub('ib_admin'));   // sobrescribir
  });
  test('la lee un editor; ni el técnico, ni el admin fuera de la lista, ni anónimo; nadie lista', async () => {
    const r = (uid) => ref(uid ? st(uid) : anon().storage(), `informes_brigada_marca/firmas/f-ana-prueba/${H}`);
    await assertSucceeds(getBytes(r('ib_editor')));
    await assertFails(getBytes(r('ib_tecnico')));
    await assertFails(getMetadata(r('ib_tecnico')));
    await assertFails(getBytes(r('ib_admin_fuera')));
    await assertFails(getBytes(r(null)));
    await assertFails(listAll(ref(st('ib_admin'), 'informes_brigada_marca/firmas')));
    await assertFails(listAll(ref(st('ib_editor'), 'informes_brigada_marca/firmas/f-ana-prueba')));
  });
});

describe('13 · Storage · fichas de fabricante', () => {
  const sub = (uid, id, bytes = PNG) => uploadBytes(ref(st(uid), `informes_brigada_marca/fichas/${id}`), bytes, { contentType: 'image/png', customMetadata: { huella: H } });
  test('editor ≤ 2 MB sí; > 2 MB o técnico no; el equipo la lee', async () => {
    await assertSucceeds(sub('ib_editor', 'ficha_st_1', relleno(PNG, 2 * 1024 * 1024)));
    await assertFails(sub('ib_editor', 'ficha_st_2', relleno(PNG, 2 * 1024 * 1024 + 1)));
    await assertFails(sub('ib_tecnico', 'ficha_st_3'));
    await assertFails(sub('ib_editor', 'Ficha Mal'));
    await assertSucceeds(getBytes(ref(st('ib_tecnico'), 'informes_brigada_marca/fichas/ficha_st_1')));
    await assertFails(sub('ib_editor', 'ficha_st_1'));   // inmutable
    await assertFails(deleteObject(ref(st('ib_admin'), 'informes_brigada_marca/fichas/ficha_st_1')));   // lo usan versiones emitidas
  });
});

describe('14 · no regresión: el bloque nuevo no abre rutas vecinas', () => {
  test('una subruta no declarada bajo las carpetas nuevas queda cerrada', async () => {
    await assertFails(uploadBytes(ref(st('ib_admin'), 'informes_brigada_marca/otra/x.png'), PNG, { contentType: 'image/png', customMetadata: { huella: H } }));
    await assertFails(uploadBytes(ref(st('ib_admin'), 'informes_brigada/s_1/otra/x.png'), PNG, { contentType: 'image/png', customMetadata: { huella: H } }));
    await assertFails(setDoc(doc(db('ib_admin'), 'informes_brigada', 's_1', 'otra', 'x'), { a: 1 }));
    await assertFails(setDoc(doc(db('ib_admin'), 'informes_brigada_otra', 'x'), { a: 1 }));
  });
});

// ══════════════════════════════════════════════════════════════
// LA CAPA DE DATOS REAL contra estas reglas (SDK de npm inyectado)
// ══════════════════════════════════════════════════════════════
const sesion = (uid) => () => ({ uid, nombre: NOMBRES[uid], rol: ROLES[uid] });
const repoDe = (uid) => crearRepositorio({ sdk: FS, db: db(uid), sesion: sesion(uid) });
const almacenDe = (uid, modo) => crearAlmacen({ modo, nuevo: true, storage: st(uid), db: db(uid), sdkStorage: ST, sdkFirestore: FS });
const esCodigo = (cod) => (e) => e instanceof ErrorIBR && e.codigo === cod;
const NUEVO = () => ({ equipo_ref: { ...EQUIPO, matricula: 'T9-CAPA-PRU' }, actividad: ACT, modelo: 'F60-REFRIG@1', contenido: { ...CONTENIDO, firmas: {} } });

describe('capa de datos (data/informes_brigada.js) contra las reglas', () => {
  test('ciclo del editor: crear → guardar → choque → emitir v1 → corregir → emitir v2', async () => {
    const r = repoDe('ib_editor');
    assert.equal((await r.leerConfig()).estado, 'ok');
    const inf = await r.crear(NUEVO());
    assert.equal(inf.rev, 1);
    assert.equal((await r.guardar(inf.id, { ...CONTENIDO, nota: 'uno' }, 1)).rev, 2);
    await assert.rejects(repoDe('ib_editor').guardar(inf.id, { nota: 'pisada' }, 1), esCodigo('conflicto'));
    assert.deepEqual(await r.emitir(inf.id, { contenido: { ...CONTENIDO, nota: 'final' }, revEsperada: 2, huella: H }), { version: 1, rev: 3 });
    const e = await r.obtener(inf.id);
    assert.equal(e.estado, 'emitido');
    assert.equal(typeof e.emitidoEn, 'string');
    await assert.rejects(r.guardar(inf.id, CONTENIDO, 3), esCodigo('estado'));
    assert.deepEqual(await r.corregir(inf.id, 3), { rev: 4 });
    await assert.rejects(r.emitir(inf.id, { contenido: CONTENIDO, revEsperada: 4, huella: H, motivo: 'corto' }), esCodigo('validacion'));
    assert.deepEqual(await r.emitir(inf.id, { contenido: { ...CONTENIDO, nota: 'v2' }, revEsperada: 4, huella: H, motivo: 'Corrige la tabla de corrientes' }), { version: 2, rev: 5 });
    assert.deepEqual((await r.listarVersiones(inf.id)).map((v) => v.version), [2, 1]);
    assert.equal((await r.obtenerVersion(inf.id, 1)).contenido.nota, 'final');
    assert.ok((await r.listarDeEquipo('T9-CAPA-PRU')).some((x) => x.id === inf.id));
    assert.ok((await r.listarRecientes({ limite: 500 })).length >= 1, 'el tope se recorta a 200 y la regla lo deja');
    // anular: el editor no; el admin sí
    await assert.rejects(r.anular(inf.id, 5, 'Equipo equivocado en la prueba'), esCodigo('sin_permiso'));
    assert.deepEqual(await repoDe('ib_admin').anular(inf.id, 5, 'Equipo equivocado en la prueba'), { rev: 6 });
  });

  test('el técnico no editor: la pantalla lo frena y, aunque no lo frenara, la regla también', async () => {
    const conConfig = repoDe('ib_tecnico');
    await conConfig.leerConfig();
    await assert.rejects(conConfig.crear(NUEVO()), esCodigo('sin_permiso'));
    await assert.rejects(repoDe('ib_tecnico').crear(NUEVO()), esCodigo('sin_permiso'));   // sin leer config: la regla lo niega
    assert.equal((await repoDe('ib_tecnico').listarRecientes()).constructor, Array);
  });

  test('configuración: la guarda el admin con la forma que exige la regla; sin sesión la lectura dice «sin permiso»', async () => {
    const a = repoDe('ib_admin');
    await a.guardarConfig({ ...CONFIG(), firmantes: [{ nombre: 'Ana Prueba', cargo: 'Cargo de prueba', firma: null }],
      ingenieros: ['Beto Ensayo', 'Ciro Ficticio'], tecnicos: ['Dora Simulada', 'Eva Inventada'] });
    const c = (await a.leerConfig()).config;
    // Personal de 2.2 (2026-10-15): la regla admite las dos listas y vuelven tal cual.
    assert.deepEqual(c.ingenieros, ['Beto Ensayo', 'Ciro Ficticio']);
    assert.deepEqual(c.tecnicos, ['Dora Simulada', 'Eva Inventada']);
    assert.deepEqual(c.editores, ['ib_editor', 'ib_admin', 'ib_inactivo']);
    assert.equal(c.firmantes[0].clave, 'f-ana-prueba');
    await assert.rejects(repoDe('ib_editor').guardarConfig(CONFIG()), esCodigo('sin_permiso'));
    const sinSesion = crearRepositorio({ sdk: FS, db: anon().firestore(), sesion: () => null });
    assert.equal((await sinSesion.leerConfig()).estado, 'sin_permiso');
    await sembrarConfig();
  });

  test('acciones de refrigeración: el lector recibe la matrícula y el tope; nada se escribe', async () => {
    let pedido = null;
    const r = crearRepositorio({ sdk: FS, db: db('ib_editor'), sesion: sesion('ib_editor'), lectorAcciones: async (f) => { pedido = f; return []; } });
    assert.deepEqual(await r.listarAcciones('T9-CAPA-PRU'), []);
    assert.deepEqual(pedido, { transformador_id: 'T9-CAPA-PRU', limite: 5 });
  });
});

describe('capa de datos (data/informes_brigada_almacen.js) contra las reglas', () => {
  test('Storage: el editor sube una foto a su borrador y el equipo la lee; una firma va a Firestore y solo la leen los editores', async () => {
    const inf = await repoDe('ib_editor').crear(NUEVO());
    const aid = nuevoIdArchivo();
    const meta = await almacenDe('ib_editor', 'storage').subirArchivo(inf.id, aid, JPEG, { mime: 'image/jpeg', ancho: 10, alto: 10, tamano: JPEG.length, huella: sha(JPEG) }, autor('ib_editor'));
    assert.equal(meta.ruta, rutaArchivo(inf.id, aid));
    assert.deepEqual([...await almacenDe('ib_tecnico', 'storage').bytes(meta)], [...JPEG]);
    assert.match(await almacenDe('ib_tecnico', 'storage').url(meta), /^https?:\/\//);

    const firma = await almacenDe('ib_admin', 'storage').subirFirma('f-capa-prueba', PNG, { mime: 'image/png', ancho: 1, alto: 1, autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } }, autor('ib_admin'));
    // repetir la misma firma no falla (ya está: no se reescribe)
    await almacenDe('ib_admin', 'storage').subirFirma('f-capa-prueba', PNG, { mime: 'image/png', ancho: 1, alto: 1, autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } }, autor('ib_admin'));
    // Decisión del Ingeniero (2026-10-14): aun con almacén «storage», la firma va a Firestore (sin enlace permanente).
    assert.equal(firma.almacen, 'firestore');
    assert.ok(firma.ruta.startsWith('informes_brigada_bin/firma_'));
    assert.deepEqual([...await almacenDe('ib_editor', 'firestore').bytes(firma)], [...PNG]);
    await assert.rejects(almacenDe('ib_tecnico', 'firestore').bytes(firma));
    const logo = await almacenDe('ib_admin', 'storage').subirLogo('together-portada', PNG, { mime: 'image/png', ancho: 1, alto: 1 }, autor('ib_admin'));
    assert.deepEqual([...await almacenDe('ib_tecnico', 'storage').bytes(logo)], [...PNG]);
  });

  test('Firestore (contingencia): foto, logo, firma y ficha con la forma que exige la regla; la biblioteca no baja bytes', async () => {
    const r = repoDe('ib_editor');
    const inf = await r.crear(NUEVO());
    const aid = nuevoIdArchivo();
    const meta = await almacenDe('ib_editor', 'firestore').subirArchivo(inf.id, aid, JPEG, { mime: 'image/jpeg', ancho: 10, alto: 10 }, autor('ib_editor'));
    assert.equal(meta.almacen, 'firestore');
    assert.deepEqual([...await almacenDe('ib_tecnico', 'firestore').bytes(meta)], [...JPEG]);

    const logo = await almacenDe('ib_admin', 'firestore').subirLogo('applus-portada', PNG, { mime: 'image/png', ancho: 1, alto: 1 }, autor('ib_admin'));
    assert.equal(logo.ruta, 'informes_brigada_bin/' + idBin('logo', 'applus-portada', sha(PNG)));
    await almacenDe('ib_admin', 'firestore').subirLogo('applus-portada', PNG, { mime: 'image/png', ancho: 1, alto: 1 }, autor('ib_admin'));   // idempotente
    const firma = await almacenDe('ib_admin', 'firestore').subirFirma('f-capa-fs', PNG, { mime: 'image/png', ancho: 1, alto: 1, autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } }, autor('ib_admin'));
    assert.deepEqual([...await almacenDe('ib_editor', 'firestore').bytes(firma)], [...PNG]);
    await assert.rejects(almacenDe('ib_tecnico', 'firestore').bytes(firma));

    const fid = idFicha('Marca Prueba', 'VX-100', sha(PNG));
    const mf = await almacenDe('ib_editor', 'firestore').subirFicha(fid, PNG, { mime: 'image/png', ancho: 1, alto: 1 }, autor('ib_editor'));
    assert.equal(mf.ruta, rutaParteFicha(fid));
    await r.registrarFicha({ id: fid, titulo: 'Ficha VX-100 de prueba', marca: 'Marca Prueba', modelo: 'VX-100', ...mf });
    await r.registrarFicha({ id: fid, titulo: 'Ficha VX-100 de prueba', marca: 'Marca Prueba', modelo: 'VX-100', ...mf });   // idempotente
    const lista = await repoDe('ib_tecnico').listarFichas();
    const enLista = lista.find((x) => x.id === fid);
    assert.ok(enLista);
    assert.equal('bytes' in enLista, false);

    // Storage para la misma ficha (otra huella → otro id)
    const PNG2 = relleno(PNG, PNG.length + 3);
    const fid2 = idFicha('Marca Prueba', 'VX-200', sha(PNG2));
    const ms = await almacenDe('ib_editor', 'storage').subirFicha(fid2, PNG2, { mime: 'image/png', ancho: 1, alto: 1 }, autor('ib_editor'));
    assert.equal(ms.ruta, rutaFicha(fid2));
    await r.registrarFicha({ id: fid2, titulo: 'Ficha VX-200 de prueba', marca: 'Marca Prueba', modelo: 'VX-200', ...ms });
  });

  test('emitida: la firma se resuelve para el Word (editor); en borrador, no', async () => {
    const firma = await almacenDe('ib_admin', 'firestore').subirFirma('f-word-prueba', PNG, { mime: 'image/png', ancho: 1, alto: 1, autorizacion: { fecha: '2026-10-01', medio: 'correo de prueba' } }, autor('ib_admin'));
    const versionDoc = { marca: {}, firmas: [{ rol: 'elaborado', clave: 'f-word-prueba', nombre: 'WORD PRUEBA', firma }] };
    const metaDeRef = (refTxt, { versionDoc: v }) => (refTxt === 'firma:elaborado' && v ? v.firmas[0].firma : null);
    const almacenes = { firestore: almacenDe('ib_editor', 'firestore') };
    const emitida = await resolverBytes(['firma:elaborado'], { contenido: {}, config: {}, versionDoc, almacenes, metaDeRef });
    assert.deepEqual([...emitida.get('firma:elaborado').bytes], [...PNG]);
    const borrador = await resolverBytes(['firma:elaborado'], { contenido: {}, config: {}, versionDoc: null, almacenes, metaDeRef: () => firma });
    assert.equal(borrador.get('firma:elaborado'), null);
  });
});
