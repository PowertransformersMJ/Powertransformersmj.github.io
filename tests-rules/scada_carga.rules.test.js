// ══════════════════════════════════════════════════════════════
// Cargabilidad SCADA (ADR-122): el equipo lee por id; solo un admin CON perfil escribe, a su
// nombre y con la hora del servidor; la homologación lleva versión y un registro atado; el
// registro de cargas se abre y se cierra una vez; nada se borra. Las DOS direcciones (L-78).
// Prefijo `scd_`, nombres y puntos sintéticos.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, writeBatch, serverTimestamp, collection, query, limit, orderBy, Bytes, FieldPath
} from 'firebase/firestore';

const PROJECT_ID = 'demo-sgm-rules';
let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const YO = { uid: 'scd_admin', nombre: 'Admin SCD' };
const ID = 'estdemo1__swtrafo1__2026-03';
const nivel = () => {
  const fam = {};
  for (const f of ['IR', 'IS', 'IT', 'URS', 'UST', 'UTR', 'P', 'Q']) fam[f] = { v: Bytes.fromUint8Array(new Uint8Array(744 * 4)), m: Bytes.fromUint8Array(new Uint8Array(744)), b: Bytes.fromUint8Array(new Uint8Array(744)) };
  return { kv: 13.8, fam };
};
const serie = (extra = {}, niveles = { N13_8: nivel() }) => ({
  schema: 1, claveId: 'estdemo1__swtrafo1', clave: '/EstDemo1/swTrafo1', est: 'EstDemo1', elem: 'swTrafo1', mes: '2026-03', n: 744,
  formato: 'v32le+m8+b8', niveles, cargaId: 'c1', actualizadoPor: YO, actualizadoEn: serverTimestamp(), ...extra
});

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const u = (id, rol, activo, nombre) => setDoc(doc(d, 'usuarios/' + id), { email: id + '@x.co', rol, activo, nombre });
    await u('scd_admin', 'admin', true, 'Admin SCD');
    await u('scd_admin2', 'admin', true, 'Otro Admin SCD');
    await u('scd_tec', 'tecnico', true, 'Tecnico SCD');
    await u('scd_inactivo', 'tecnico', false, 'Inactivo SCD');
    await setDoc(doc(d, 'admins/scd_arranque'), { email: 'x@x.co' });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

describe('series, resumen y catálogo', () => {
  test('el admin escribe una serie con la forma exacta (hasta los 6 niveles, ~214 KB); 7 no', async () => {
    const seis = { N13_8: nivel(), N34_5: nivel(), N66: nivel(), N110: nivel(), N220: nivel(), N500: nivel() };
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_series/' + ID), serie({}, seis)));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_series/' + ID), serie({}, { ...seis, N999: nivel() })));
  });
  test('lo que no cuadra: no', async () => {
    const mal = [{ claveId: 'otra__cosa' }, { mes: '2026-04' }, { n: 800 }, { schema: 2 }, { formato: 'json' }, { extra: 1 },
      { actualizadoPor: { uid: 'scd_admin', nombre: 'Nombre Falso' } }, { actualizadoPor: { uid: 'scd_admin2', nombre: 'Otro Admin SCD' } },
      { actualizadoEn: new Date() }, { cargaId: 5 }];
    for (const m of mal) await assertFails(setDoc(doc(db('scd_admin'), 'scada_series/' + ID), serie(m)));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_series/ID_EN_MAYUSCULAS__2026-03'), serie()));
  });
  test('ni técnico, ni admin de arranque, ni anónimo escriben; nadie borra', async () => {
    await assertFails(setDoc(doc(db('scd_tec'), 'scada_series/' + ID), serie({ actualizadoPor: { uid: 'scd_tec', nombre: 'Tecnico SCD' } })));
    await assertFails(setDoc(doc(db('scd_arranque'), 'scada_series/' + ID), serie({ actualizadoPor: { uid: 'scd_arranque', nombre: '' } })));
    await assertFails(deleteDoc(doc(db('scd_admin'), 'scada_series/' + ID)));
  });
  test('el equipo activo lee por id; nadie lista; inactivo y anónimo no leen', async () => {
    await assertSucceeds(getDoc(doc(db('scd_tec'), 'scada_series/' + ID)));
    await assertFails(getDocs(query(collection(db('scd_tec'), 'scada_series'), limit(5))));
    await assertFails(getDocs(query(collection(db('scd_admin'), 'scada_series'), limit(5))));
    await assertFails(getDoc(doc(db('scd_inactivo'), 'scada_series/' + ID)));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'scada_series/' + ID)));
  });
  test('resumen del mes y catálogo', async () => {
    const r = { schema: 1, mes: '2026-03', claves: { estdemo1__swtrafo1: { N13_8: { i: { p99: 100 } } } }, cargaId: 'c1', actualizadoPor: YO, actualizadoEn: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_resumen/2026-03'), r));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_resumen/2026-13'), { ...r, mes: '2026-13' }));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_resumen/2026-04'), r));
    const c = { schema: 1, meses: { '2026-03': { dias: '1'.repeat(31) } }, puntos: {}, cargaId: 'c1', actualizadoPor: YO, actualizadoEn: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_catalogo/estado'), c));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_catalogo/otro'), c));
    await assertSucceeds(getDoc(doc(db('scd_tec'), 'scada_catalogo/estado')));
    await assertSucceeds(getDoc(doc(db('scd_tec'), 'scada_resumen/2026-03')));
  });
  test('catálogo y resumen solo crecen: otra carga no puede borrar meses, puntos ni claves', async () => {
    const r = { schema: 1, mes: '2026-05', claves: { a__b: {}, c__d: {} }, cargaId: 'c1', actualizadoPor: YO, actualizadoEn: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_resumen/2026-05'), r));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_resumen/2026-05'), { ...r, claves: { a__b: {} }, cargaId: 'c2' }));
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_resumen/2026-05'), { ...r, claves: { a__b: { x: 1 }, c__d: {}, e__f: {} }, cargaId: 'c2' }));
    const c = { schema: 1, meses: { '2026-03': {}, '2026-04': {} }, puntos: { a__b: {}, c__d: {} }, cargaId: 'c1', actualizadoPor: YO, actualizadoEn: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_catalogo/estado'), c));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_catalogo/estado'), { ...c, meses: { '2026-04': {} }, cargaId: 'c2' }));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_catalogo/estado'), { ...c, puntos: { a__b: {} }, cargaId: 'c2' }));
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_catalogo/estado'), { ...c, meses: { ...c.meses, '2026-05': {} }, cargaId: 'c2' }));
  });
});

describe('registro de cargas', () => {
  const abrir = (extra = {}) => ({ estado: 'iniciada', modo: 'completar', meses: ['2026-03'], carpeta: 'Marzo', plan: { docs: 3 }, simulacion: { veredicto: 'listo' }, abiertaEn: serverTimestamp(), por: YO, ...extra });
  test('se abre «iniciada» y se cierra UNA vez, por su autor', async () => {
    await assertSucceeds(setDoc(doc(db('scd_admin'), 'scada_cargas/c1'), abrir()));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_cargas/c2'), abrir({ estado: 'completa' })));
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_cargas/c3'), abrir({ modo: 'borrar' })));
    await assertFails(updateDoc(doc(db('scd_admin2'), 'scada_cargas/c1'), { estado: 'completa', cerradoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('scd_admin'), 'scada_cargas/c1'), { estado: 'completa', cerradoEn: serverTimestamp(), modo: 'reemplazar' }));
    await assertSucceeds(updateDoc(doc(db('scd_admin'), 'scada_cargas/c1'), { estado: 'completa', escrituras: { series: 3 }, duracion_ms: 10, cerradoEn: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('scd_admin'), 'scada_cargas/c1'), { estado: 'fallida', cerradoEn: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db('scd_admin'), 'scada_cargas/c1')));
  });
  test('el equipo lista las últimas 20, no más', async () => {
    await assertSucceeds(getDocs(query(collection(db('scd_tec'), 'scada_cargas'), orderBy('abiertaEn', 'desc'), limit(20))));
    await assertFails(getDocs(query(collection(db('scd_tec'), 'scada_cargas'), limit(21))));
  });
});

describe('homologación con versión y registro atado', () => {
  const filas = { r1: { matricula: 'T1-X/X-DM1', clave_excel: '/EstDemo1/swTrafo1', decision: null }, r2: { matricula: 'T2-X/X-DM2', clave_excel: '/EstDemo2/EDM302', decision: null } };
  const vig = (rev, ultimo, f = filas) => ({ schema: 1, rev, fuente: { archivo: 'demo.xlsx' }, filas: f, ultimoRegistro: ultimo, actualizadoPor: YO, actualizadoEn: serverTimestamp() });
  function cargaExcel(quien, rev, reg, f) {
    const d = db(quien); const b = writeBatch(d);
    b.set(doc(d, 'scada_homologacion/vigente'), { ...vig(rev, reg, f), actualizadoPor: quien === 'scd_admin' ? YO : { uid: quien, nombre: 'Otro Admin SCD' } });
    b.set(doc(d, 'scada_homologacion_registro/' + reg), { tipo: 'carga_excel', rev, resumen: { total: 2 }, por: quien === 'scd_admin' ? YO : { uid: quien, nombre: 'Otro Admin SCD' }, en: serverTimestamp() });
    return b.commit();
  }
  test('crear con su registro; sin registro, o con rev equivocado, no', async () => {
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_homologacion/vigente'), vig(1, 'h0')));
    await assertFails(cargaExcel('scd_admin', 2, 'h0'));
    await assertSucceeds(cargaExcel('scd_admin', 1, 'h1'));
    await assertFails(cargaExcel('scd_admin', 1, 'h2'));            // versión vieja
    await assertFails(cargaExcel('scd_admin', 2, 'h3', { r1: filas.r1 }));   // las filas no pueden disminuir
    await assertSucceeds(getDoc(doc(db('scd_tec'), 'scada_homologacion/vigente')));
    await assertFails(cargaExcel('scd_tec', 2, 'h4'));
  });
  test('confirmar UNA fila con su registro; dos filas a la vez o un registro suelto, no', async () => {
    const confirmar = (rev, reg, filaId, decision, segunda) => {
      const d = db('scd_admin'); const b = writeBatch(d);
      const dec = decision ? { ...decision, por: YO, en: serverTimestamp() } : null;
      const campos = [new FieldPath('filas', filaId, 'decision'), dec, 'rev', rev, 'ultimoRegistro', reg, 'actualizadoPor', YO, 'actualizadoEn', serverTimestamp()];
      if (segunda) campos.push(new FieldPath('filas', segunda, 'decision'), { tipo: 'usar' });
      b.update(doc(d, 'scada_homologacion/vigente'), ...campos);
      b.set(doc(d, 'scada_homologacion_registro/' + reg), { tipo: decision ? 'confirmacion' : 'reapertura', rev, filaId, antes: null, despues: dec, por: YO, en: serverTimestamp() });
      return b.commit();
    };
    await assertSucceeds(confirmar(2, 'h5', 'r2', { tipo: 'usar', avisos_vistos: ['CLAVE_CIRCUITO'], nota: 'Confirmado con el equipo' }));
    await assertFails(confirmar(3, 'h6', 'r1', { tipo: 'usar', nota: 'x' }, 'r2'));
    await assertFails(confirmar(3, 'h7', 'r9', { tipo: 'usar', nota: 'x' }));     // fila que no existe
    await assertFails(setDoc(doc(db('scd_admin'), 'scada_homologacion_registro/h8'), { tipo: 'confirmacion', rev: 3, filaId: 'r1', antes: null, despues: { tipo: 'usar' }, por: YO, en: serverTimestamp() }));
    await assertSucceeds(confirmar(3, 'h9', 'r2', null));    // reabrir
    await assertFails(updateDoc(doc(db('scd_admin'), 'scada_homologacion_registro/h9'), { tipo: 'x' }));
    await assertFails(deleteDoc(doc(db('scd_admin'), 'scada_homologacion/vigente')));
  });
});
