// ══════════════════════════════════════════════════════════════
// Rol «visitante» (`99 §198`, pedido del Ingeniero 2026-10-30): solo ve Cargabilidad SCADA y el
// Mapa. En la base LEE solo lo que esas dos páginas usan (transformadores y subestaciones con el
// tope de 500, umbrales_salud/global, scada_series/resumen/catálogo/homologación por id, placas y
// sus partes por id, y su propio perfil); no escribe nada SALVO su propio rastro de actividad
// (`actividad_visitante/{suUid}/eventos`, forma acotada, sin poder leerlo: `99 §199`); en Storage no lee nada.
// Cada caso en las DOS direcciones (L-78): lo que se le niega al visitante, un técnico lo hace
// (control: la regla de hoy sigue igual para el equipo). Las ramas por permiso puntual, editores de
// brigada y delegaciones se prueban en sus archivos (fichas_adjuntos_permiso, informes_brigada,
// firmas_delegados, firmas_delegados_fichas). Prefijo `vis_`; nunca clearFirestore(). Datos inventados.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, serverTimestamp, Bytes
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes, listAll } from 'firebase/storage';

const PROJECT_ID = 'demo-sgm-rules';
let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const st = (uid) => testEnv.authenticatedContext(uid).storage();
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4

// Quién mira: el visitante, sus variantes y el equipo de control.
const VIS = 'vis_visitante';
const TEC = 'vis_tec';

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const u = (id, datos) => setDoc(doc(d, 'usuarios/' + id), { email: id + '@x.co', nombre: id, ...datos });
    await u(VIS, { rol: 'visitante', activo: true });
    await u('vis_inactivo', { rol: 'visitante', activo: false });
    await u('vis_variante', { rol: ' Visitante ', activo: true });   // escrito a mano, por fuera del panel
    // Más variantes por consola: espacio de no separación, marca BOM, salto de línea, lista y número.
    await u('vis_nbsp', { rol: 'visitante\u00a0', activo: true });
    await u('vis_bom', { rol: '\ufeffvisitante', activo: true });
    await u('vis_salto', { rol: 'visitante\n', activo: true });
    await u('vis_lista', { rol: ['visitante'], activo: true });
    await u('vis_numero', { rol: 7, activo: true });
    await u('vis_null', { rol: null, activo: true });                // como sin rol: del equipo
    await u(TEC, { rol: 'tecnico', activo: true });
    await u('vis_admin', { rol: 'admin', activo: true });
    await u('vis_sin_rol', { activo: true });                       // perfil viejo sin rol: sigue siendo del equipo
    await setDoc(doc(d, 'admins/' + VIS), { legacy: true });       // ni estando en /admins por error
    await setDoc(doc(d, 'transformadores/vis_tx1'), { codigo: 'VIS-TX-1' });
    await setDoc(doc(d, 'transformadores/vis_tx1/historial_hi/h1'), { hi: 3 });
    await setDoc(doc(d, 'subestaciones/vis_se1'), { codigo: 'VIS-SE-1' });
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    for (const r of ['documentos/vis_doc/a.pdf', 'contratos/vis_contrato/a.pdf', 'pruebas_electricas/vis_unidad/a.pdf']) {
      await uploadBytes(ref(ctx.storage(), r), PDF, { contentType: 'application/pdf' });
    }
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('lo que SÍ lee: lo de Cargabilidad SCADA y el Mapa', () => {
  test('transformadores y subestaciones: por id y en lista con el tope de 500 de las páginas', async () => {
    for (const col of ['transformadores', 'subestaciones']) {
      await assertSucceeds(getDoc(doc(db(VIS), col, col === 'transformadores' ? 'vis_tx1' : 'vis_se1')));
      await assertSucceeds(getDocs(query(collection(db(VIS), col), orderBy('codigo'), limit(500))));
      // Sin tope o con más: no (al equipo no se le exige, como hoy).
      await assertFails(getDocs(query(collection(db(VIS), col), orderBy('codigo'), limit(501))));
      await assertFails(getDocs(query(collection(db(VIS), col), orderBy('codigo'))));
      await assertSucceeds(getDocs(query(collection(db(TEC), col), orderBy('codigo'))));
    }
  });
  test('umbrales: solo el vigente (global)', async () => {
    await assertSucceeds(getDoc(doc(db(VIS), 'umbrales_salud/global')));
    await assertFails(getDoc(doc(db(VIS), 'umbrales_salud/otro')));
    await assertFails(getDocs(query(collection(db(VIS), 'umbrales_salud'), limit(5))));
    await assertFails(getDoc(doc(db(VIS), 'umbrales_salud/global/historial/e1')));
    await assertSucceeds(getDoc(doc(db(TEC), 'umbrales_salud/otro')));
    await assertSucceeds(getDocs(query(collection(db(TEC), 'umbrales_salud'), limit(5))));
  });
  test('SCADA por id; nadie lista', async () => {
    for (const ruta of ['scada_series/a__b__2026-03', 'scada_resumen/2026-03', 'scada_catalogo/estado', 'scada_homologacion/vigente']) {
      await assertSucceeds(getDoc(doc(db(VIS), ruta)));
      await assertFails(getDocs(query(collection(db(VIS), ruta.split('/')[0]), limit(5))));
    }
  });
  test('placa característica y su foto, por id; no lista', async () => {
    await assertSucceeds(getDoc(doc(db(VIS), 'placas_caracteristicas/VISTX0001')));
    await assertSucceeds(getDoc(doc(db(VIS), 'placas_caracteristicas/VISTX0001/partes/0')));
    await assertFails(getDocs(query(collection(db(VIS), 'placas_caracteristicas'), limit(5))));
  });
  test('su propio perfil sí; el de otro no', async () => {
    await assertSucceeds(getDoc(doc(db(VIS), 'usuarios/' + VIS)));
    await assertFails(getDoc(doc(db(VIS), 'usuarios/' + TEC)));
  });
});

describe('lo que NO lee: todo lo demás (el técnico sí, como hoy)', () => {
  const RUTAS = [
    'ordenes/vis_x', 'contratos/vis_x', 'documentos/vis_x', 'responsables_ordenes/vis_x', 'ordenes_materiales/vis_x',
    'pruebas_electricas/vis_x', 'alertas_config/global', 'informes_brigada/vis_x', 'informes_brigada_config/general',
    'scada_cargas/vis_x', 'scada_homologacion_registro/vis_x', 'transformadores/vis_tx1/historial_hi/h1',
  ];
  test('por id', async () => {
    for (const r of RUTAS) {
      await assertFails(getDoc(doc(db(VIS), r)));
      await assertSucceeds(getDoc(doc(db(TEC), r)));
    }
  });
  test('ni su propia firma', async () => {
    await assertFails(getDoc(doc(db(VIS), 'firmas/' + VIS)));
    await assertSucceeds(getDoc(doc(db(TEC), 'firmas/' + TEC)));
  });
  test('ni la bitácora (auditoría)', async () => {
    await assertFails(getDocs(query(collection(db(VIS), 'auditoria'), limit(5))));
  });
});

describe('lo que NO escribe (el técnico sí, con la misma escritura)', () => {
  test('bitácora (auditoría)', async () => {
    await assertFails(addDoc(collection(db(VIS), 'auditoria'), { accion: 'prueba' }));
    await assertSucceeds(addDoc(collection(db(TEC), 'auditoria'), { accion: 'prueba' }));
  });
  test('su firma propia', async () => {
    const firma = { imagen: Bytes.fromUint8Array(new Uint8Array(10)), huella: 'a'.repeat(64), en: serverTimestamp() };
    await assertFails(setDoc(doc(db(VIS), 'firmas/' + VIS), firma));
    await assertSucceeds(setDoc(doc(db(TEC), 'firmas/' + TEC), firma));
  });
  test('ni lo que lee (transformadores, subestaciones, SCADA, placas)', async () => {
    await assertFails(updateDoc(doc(db(VIS), 'transformadores/vis_tx1'), { codigo: 'X' }));
    await assertFails(setDoc(doc(db(VIS), 'subestaciones/vis_se2'), { codigo: 'X' }));
    await assertFails(setDoc(doc(db(VIS), 'scada_catalogo/estado'), { x: 1 }));
    await assertFails(setDoc(doc(db(VIS), 'placas_caracteristicas/VISTX0001'), { x: 1 }));
  });
  test('ni su perfil (no se sube de rol ni se da permisos)', async () => {
    await assertFails(updateDoc(doc(db(VIS), 'usuarios/' + VIS), { rol: 'admin' }));
    await assertFails(updateDoc(doc(db(VIS), 'usuarios/' + VIS), { nombre: 'Otro' }));
    await assertFails(setDoc(doc(db(VIS), 'usuarios/vis_nuevo'), { email: 'n@x.co', rol: 'tecnico', activo: true }));
  });
  // Excepciones aceptadas (`99 §198`): borrar lo PROPIO lo puede cualquier sesión (un técnico que pasa a
  // visitante limpia lo suyo); no lee ni escribe nada ajeno.
  test('excepción aceptada: borrar su propia firma (aunque no exista)', async () => {
    await assertSucceeds(deleteDoc(doc(db(VIS), 'firmas/' + VIS)));
    await assertFails(deleteDoc(doc(db(VIS), 'firmas/' + TEC)));
  });
});

describe('el rol se compara normalizado; el resto del equipo, igual que hoy', () => {
  test('toda variante escrita a mano y todo rol que no sea texto: igual de cerrados (ante la duda, cerrado)', async () => {
    for (const uid of ['vis_variante', 'vis_nbsp', 'vis_bom', 'vis_salto', 'vis_lista', 'vis_numero']) {
      await assertFails(getDoc(doc(db(uid), 'ordenes/vis_x')));
      await assertFails(addDoc(collection(db(uid), 'auditoria'), { accion: 'prueba' }));
      await assertFails(getBytes(ref(st(uid), 'documentos/vis_doc/a.pdf')));
    }
    // Y ven solo lo del visitante, como él.
    for (const uid of ['vis_variante', 'vis_nbsp', 'vis_bom', 'vis_salto', 'vis_lista', 'vis_numero']) {
      await assertSucceeds(getDocs(query(collection(db(uid), 'transformadores'), orderBy('codigo'), limit(500))));
    }
  });
  test('rol null: como sin rol, sigue del equipo (como hoy)', async () => {
    await assertSucceeds(getDoc(doc(db('vis_null'), 'ordenes/vis_x')));
  });
  test('visitante desactivado: nada', async () => {
    await assertFails(getDoc(doc(db('vis_inactivo'), 'transformadores/vis_tx1')));
    await assertFails(getDoc(doc(db('vis_inactivo'), 'scada_catalogo/estado')));
  });
  test('perfil sin rol: sigue siendo del equipo; el admin, igual', async () => {
    await assertSucceeds(getDoc(doc(db('vis_sin_rol'), 'ordenes/vis_x')));
    await assertSucceeds(addDoc(collection(db('vis_sin_rol'), 'auditoria'), { accion: 'prueba' }));
    await assertSucceeds(getDoc(doc(db('vis_admin'), 'ordenes/vis_x')));
    await assertSucceeds(updateDoc(doc(db('vis_admin'), 'usuarios/vis_sin_rol'), { nombre: 'Sin Rol Editado' }));
  });
});

describe('alta en /usuarios (solo el admin)', () => {
  test('el admin crea un visitante sin permisos; con permisos o con otra grafía del rol, no', async () => {
    const base = { email: 'v2@x.co', nombre: 'Visitante Dos', activo: true };
    await assertFails(setDoc(doc(db('vis_admin'), 'usuarios/vis_alta1'), { ...base, rol: 'visitante', permisos_extra: ['fichas.adjuntar_operativo'] }));
    await assertFails(setDoc(doc(db('vis_admin'), 'usuarios/vis_alta2'), { ...base, rol: 'Visitante', permisos_extra: [] }));
    await assertSucceeds(setDoc(doc(db('vis_admin'), 'usuarios/vis_alta3'), { ...base, rol: 'visitante', permisos_extra: [] }));
    await assertSucceeds(setDoc(doc(db('vis_admin'), 'usuarios/vis_alta4'), { ...base, rol: 'visitante' }));
    await assertFails(setDoc(doc(db(TEC), 'usuarios/vis_alta5'), { ...base, rol: 'visitante' }));
  });
});

describe('Storage: el visitante no lee ni lista nada (el técnico sí, como hoy)', () => {
  test('documentos, contratos y pruebas eléctricas', async () => {
    for (const r of ['documentos/vis_doc/a.pdf', 'contratos/vis_contrato/a.pdf', 'pruebas_electricas/vis_unidad/a.pdf']) {
      await assertFails(getBytes(ref(st(VIS), r)));
      await assertFails(listAll(ref(st(VIS), r.split('/').slice(0, 2).join('/'))));
      await assertSucceeds(getBytes(ref(st(TEC), r)));
    }
    await assertFails(getBytes(ref(st('vis_variante'), 'documentos/vis_doc/a.pdf')));
  });
});

describe('rastro de actividad del visitante (`99 §199`): él agrega lo suyo; solo el admin lo lee y lo borra', () => {
  const ev = (extra = {}) => ({ tipo: 'equipo', pagina: 'cargabilidad-scada', ingreso: 'Sun, 01 Nov 2026 17:00:00 GMT', sesion: 'abc123',
    detalle: { mat: 'VIS-TX-1', mes: '2026-09' }, en: serverTimestamp(), ...extra });
  const col = (quien, uid) => collection(db(quien), 'actividad_visitante', uid, 'eventos');
  test('el visitante agrega su evento (con y sin detalle, con dispositivo)', async () => {
    await assertSucceeds(addDoc(col(VIS, VIS), ev()));
    const { detalle, ...sinDetalle } = ev({ tipo: 'pagina', disp: { nav: 'Chrome', so: 'Windows', tipo: 'Computador', pantalla: '1920×1080' } });
    await assertSucceeds(addDoc(col(VIS, VIS), sinDetalle));
    await assertSucceeds(addDoc(col(VIS, VIS), ev({ tipo: 'intento', detalle: { texto: 'admin/usuarios' } })));
  });
  test('lo que no cuadra, no: otro uid, tipo raro, clave de más, texto largo, hora del cliente, detalle con clave rara', async () => {
    await assertFails(addDoc(col(VIS, TEC), ev()));
    await assertFails(addDoc(col(VIS, VIS), ev({ tipo: 'borrar' })));
    await assertFails(addDoc(col(VIS, VIS), ev({ extra: 1 })));
    await assertFails(addDoc(col(VIS, VIS), ev({ detalle: { mat: 'x'.repeat(161) } })));
    await assertFails(addDoc(col(VIS, VIS), ev({ detalle: { raro: 'x' } })));
    await assertFails(addDoc(col(VIS, VIS), ev({ en: new Date() })));
    await assertFails(addDoc(col(VIS, VIS), ev({ pagina: 'p'.repeat(41) })));
    await assertFails(addDoc(col(VIS, VIS), ev({ disp: { nav: 'Chrome', huella: 'x' } })));
  });
  test('ni el técnico, ni el visitante desactivado, ni el admin escriben aquí', async () => {
    await assertFails(addDoc(col(TEC, TEC), ev()));
    await assertFails(addDoc(col('vis_inactivo', 'vis_inactivo'), ev()));
    await assertFails(addDoc(col('vis_admin', 'vis_admin'), ev()));
  });
  test('leer: solo el admin; el visitante no lee ni lo suyo; nadie edita; solo el admin borra', async () => {
    let ref;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      ref = await addDoc(collection(ctx.firestore(), 'actividad_visitante', VIS, 'eventos'), { tipo: 'pagina', pagina: 'mapa-v2', ingreso: 'x', sesion: 's', en: new Date() });
    });
    await assertSucceeds(getDocs(query(col('vis_admin', VIS), orderBy('en', 'desc'), limit(50))));
    await assertFails(getDocs(query(col(VIS, VIS), limit(5))));
    await assertFails(getDoc(doc(db(VIS), ref.path)));
    await assertFails(getDocs(query(col(TEC, VIS), limit(5))));
    await assertFails(updateDoc(doc(db(VIS), ref.path), { tipo: 'clic' }));
    await assertFails(updateDoc(doc(db('vis_admin'), ref.path), { tipo: 'clic' }));
    await assertFails(deleteDoc(doc(db(VIS), ref.path)));
    await assertSucceeds(deleteDoc(doc(db('vis_admin'), ref.path)));
  });
});
