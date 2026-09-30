// ══════════════════════════════════════════════════════════════
// Firmas DELEGADAS para Fichas Técnicas (ADR-119): el custodio otorga a un usuario que
// lea de SU directorio las personas que nombra (las cinco de la lista, cada una con la
// autorización de su titular) para exportar el PE.02081; todo cambio con su registro que
// SOLO se agrega; el delegado registra cada Excel con folio. Las DOS direcciones (L-78).
// Espejo de firmas_delegados.rules.test.js (Órdenes, ADR-117). Prefijo `fdf_`, nombres sintéticos.
// ══════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, writeBatch, serverTimestamp, collection, query, where, orderBy, limit, startAfter,
  documentId, Bytes
} from 'firebase/firestore';

const PROJECT_ID = 'demo-sgm-rules';
let testEnv;
const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const lote = (n) => 'K' + String(n).padStart(19, '0');
// Folio (id) de una emisión del delegado: 20 letras o dígitos, como los que da Firestore.
const fol = (t) => ('G' + t + 'x'.repeat(20)).replace(/[^A-Za-z0-9]/g, 'x').slice(0, 20);
const H = 'e'.repeat(64);   // la huella de las firmas sembradas en el directorio
const HOY = { fecha: '2026-09-30', medio: 'Autorización verbal al custodio' };
const CINCO = ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS', 'JORGE_MIRANDA', 'ERICK_VERGARA'];
const autDe = (ps) => Object.fromEntries(ps.map((p) => [p, HOY]));

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const u = (id, rol, activo, nombre) => setDoc(doc(d, 'usuarios/' + id), { email: id + '@x.co', rol, activo, nombre });
    await u('fdf_admin', 'admin', true, 'Custodio FF');
    await u('fdf_admin2', 'admin', true, 'Otro Admin FF');
    await u('fdf_carlos', 'tecnico', true, 'Carlos Sintetico FF');
    await u('fdf_jorge', 'tecnico', true, 'Jorge Sintetico FF');
    await u('fdf_otro', 'tecnico', true, 'Otro Tecnico FF');
    await u('fdf_inactivo', 'tecnico', false, 'Inactivo FF');
    await u('fdf_baja', 'tecnico', true, 'Se Da De Baja FF');
    await u('fdf_degradado', 'admin', true, 'Custodio Que Baja FF');
    await u('fdf_solo_ordenes', 'tecnico', true, 'Solo Ordenes FF');
    await setDoc(doc(d, 'admins/fdf_arranque'), { email: 'x@x.co' });
    const firma = { imagen: Bytes.fromUint8Array(new Uint8Array([137, 80, 78, 71])), huella: H, autorizacion: HOY, registro: 'r', en: new Date() };
    for (const p of CINCO) {
      await setDoc(doc(d, 'firmas_equipo/fdf_admin/personas/' + p), firma);
      await setDoc(doc(d, 'firmas_equipo/fdf_degradado/personas/' + p), firma);
    }
    await setDoc(doc(d, 'firmas_equipo/fdf_admin2/personas/JORGE_MIRANDA'), firma);
    await setDoc(doc(d, 'firmas/fdf_admin'), { imagen: Bytes.fromUint8Array(new Uint8Array([1])), huella: 'f'.repeat(64), en: new Date() });
    // Un usuario con permiso SOLO en Órdenes E/S (ADR-117), sembrado tal cual lo deja la página.
    await setDoc(doc(d, 'firmas_delegados/fdf_solo_ordenes'), {
      custodio: 'fdf_admin', custodioNombre: 'Custodio FF', delegadoNombre: 'Solo Ordenes FF', personaPropia: 'JORGE_RHENALS',
      personas: ['MIGUEL_JIMENEZ', 'JORGE_RHENALS'], autorizaciones: autDe(['MIGUEL_JIMENEZ', 'JORGE_RHENALS']),
      alcance: 'ordenes', lote: 'L' + '9'.repeat(19), en: new Date()
    });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

/** Datos de una delegación en Fichas (lo que escribe la página del custodio). */
const deleg = (extra = {}) => ({
  custodio: 'fdf_admin', custodioNombre: 'Custodio FF', delegadoNombre: 'Carlos Sintetico FF', personaPropia: 'CARLOS_MARTELO',
  personas: CINCO, autorizaciones: autDe(CINCO),
  alcance: 'fichas', lote: lote(1), en: serverTimestamp(), ...extra
});
const regDe = (delegado, dd, tipo) => ({
  tipo, delegado, delegadoNombre: dd.delegadoNombre, personaPropia: dd.personaPropia, personas: dd.personas,
  autorizaciones: dd.autorizaciones, lote: dd.lote, custodio: dd.custodio, custodioNombre: dd.custodioNombre, en: serverTimestamp()
});
/** Otorga (o cambia) en UN lote: la delegación y su registro. */
function otorgar(quien, delegado, dd, { tipo = 'alta', idReg, reg } = {}) {
  const f = db(quien); const b = writeBatch(f);
  b.set(doc(f, 'firmas_delegados_fichas/' + delegado), dd);
  b.set(doc(f, 'firmas_delegados_fichas_registro/' + (idReg || (delegado + '_' + dd.lote))), reg || regDe(delegado, dd, tipo));
  return b.commit();
}
function retirar(quien, delegado, loteActual, { conRegistro = true, custodio = 'fdf_admin', nombre = 'Custodio FF' } = {}) {
  const f = db(quien); const b = writeBatch(f);
  b.delete(doc(f, 'firmas_delegados_fichas/' + delegado));
  if (conRegistro) {
    b.set(doc(f, 'firmas_delegados_fichas_registro/' + delegado + '_' + loteActual + '_retiro'),
      { tipo: 'retiro', delegado, lote: loteActual, custodio, custodioNombre: nombre, en: serverTimestamp() });
  }
  return b.commit();
}
const cas = (k, persona, nombre, origen = 'equipo', huella = H) => ({ k, persona, nombre, origen, huella });
/** Una ficha típica exportada por Carlos: él elabora (su firma propia) y las otras cuatro casillas del directorio. */
const CINCO_CASILLAS = [
  cas('elab', 'CARLOS_MARTELO', 'CARLOS MARTELO', 'propia', 'd'.repeat(64)),
  cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ'),
  cas('apr', 'JORGE_MIRANDA', 'JORGE MIRANDA'),
  cas('apr2', 'ERICK_VERGARA', 'ERICK VERGARA'),
  cas('rec', 'ERICK_VERGARA', 'ERICK VERGARA')
];
const emision = (extra = {}) => ({
  equipo: { matricula: 'T-0001', subestacion: 'SUBESTACION SINTETICA', serie: 'S-1' },
  documento: 'PE.02081', casillas: CINCO_CASILLAS,
  huellaArchivo: 'a'.repeat(64), custodio: 'fdf_admin', custodioNombre: 'Custodio FF',
  // La delegación VIGENTE de Carlos es la del cambio (lote 52): una emisión con un lote viejo no vale.
  emisor: 'fdf_carlos', emisorNombre: 'Carlos Sintetico FF', delegacion: lote(52), en: serverTimestamp(), ...extra
});

describe('firmas_delegados_fichas — solo el custodio otorga, con su registro en el mismo lote', () => {
  test('el custodio otorga a Carlos las cinco (lote con registro «alta») y a Jorge dos', async () => {
    await assertSucceeds(otorgar('fdf_admin', 'fdf_carlos', deleg()));
    await assertSucceeds(otorgar('fdf_admin', 'fdf_jorge', deleg({ delegadoNombre: 'Jorge Sintetico FF', personaPropia: 'JORGE_RHENALS',
      personas: ['MIGUEL_JIMENEZ', 'JORGE_MIRANDA'], autorizaciones: autDe(['MIGUEL_JIMENEZ', 'JORGE_MIRANDA']) })));
  });
  test('sin registro, con el registro suelto o con un registro que no cuadra: no', async () => {
    await assertFails(setDoc(doc(db('fdf_admin'), 'firmas_delegados_fichas/fdf_otro'), deleg({ delegadoNombre: 'Otro Tecnico FF', lote: lote(2) })));
    await assertFails(setDoc(doc(db('fdf_admin'), 'firmas_delegados_fichas_registro/fdf_otro_' + lote(2)), regDe('fdf_otro', deleg({ delegadoNombre: 'Otro Tecnico FF', lote: lote(2) }), 'alta')));
    const dd = deleg({ delegadoNombre: 'Otro Tecnico FF', lote: lote(3) });
    await assertFails(otorgar('fdf_admin', 'fdf_otro', dd, { reg: { ...regDe('fdf_otro', dd, 'alta'), personas: ['MIGUEL_JIMENEZ'] } }));
    await assertFails(otorgar('fdf_admin', 'fdf_otro', dd, { tipo: 'cambio' }));
    await assertFails(otorgar('fdf_admin', 'fdf_otro', dd, { idReg: 'fdf_otro_OTROID' }));
    // El registro de Órdenes no sirve para Fichas (colecciones propias).
    {
      const f = db('fdf_admin'); const b = writeBatch(f);
      b.set(doc(f, 'firmas_delegados_fichas/fdf_otro'), dd);
      b.set(doc(f, 'firmas_delegados_registro/fdf_otro_' + dd.lote), regDe('fdf_otro', dd, 'alta'));
      await assertFails(b.commit());
    }
  });
  test('ni un técnico (ni para sí mismo), ni el admin de arranque, ni otro admin a nombre ajeno', async () => {
    await assertFails(otorgar('fdf_carlos', 'fdf_carlos', deleg({ custodio: 'fdf_carlos', custodioNombre: 'Carlos Sintetico FF', lote: lote(4) })));
    await assertFails(otorgar('fdf_otro', 'fdf_otro', deleg({ lote: lote(5), delegadoNombre: 'Otro Tecnico FF' })));
    await assertFails(otorgar('fdf_arranque', 'fdf_otro', deleg({ custodio: 'fdf_arranque', custodioNombre: '', lote: lote(6), delegadoNombre: 'Otro Tecnico FF' })));
    await assertFails(otorgar('fdf_admin2', 'fdf_otro', deleg({ lote: lote(7), delegadoNombre: 'Otro Tecnico FF' })));
  });
  test('datos que no cuadran: no', async () => {
    const mal = [
      { custodioNombre: 'Nombre Falso' }, { delegadoNombre: 'Otro Nombre' }, { personaPropia: 'MIGUEL_JIMENEZ' },
      { personaPropia: 'JORGE_MIRANDA' },
      { personas: ['JUAN_CARDONA'], autorizaciones: { JUAN_CARDONA: HOY } },
      { personas: [], autorizaciones: {} },
      { personas: ['MIGUEL_JIMENEZ', 'MIGUEL_JIMENEZ'], autorizaciones: { MIGUEL_JIMENEZ: HOY } },
      { autorizaciones: autDe(['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS', 'JORGE_MIRANDA']) },
      { autorizaciones: { ...autDe(CINCO), ERICK_VERGARA: { fecha: '30/09/2026', medio: 'verbal' } } },
      { autorizaciones: { ...autDe(CINCO), JORGE_MIRANDA: { fecha: '2026-09-30', medio: 'x' } } },
      { autorizaciones: { ...autDe(CINCO), JORGE_MIRANDA: { fecha: '2026-09-30', medio: 'verbal', extra: 1 } } },
      { alcance: 'ordenes' }, { en: new Date() }, { lote: 'corto' }, { extra: 1 }
    ];
    let i = 10;
    for (const m of mal) {
      const dd = deleg({ delegadoNombre: 'Otro Tecnico FF', lote: lote(i++), ...m });
      await assertFails(otorgar('fdf_admin', 'fdf_otro', dd));
    }
  });
  test('a sí mismo, a un usuario inactivo o inexistente: no', async () => {
    await assertFails(otorgar('fdf_admin', 'fdf_admin', deleg({ delegadoNombre: 'Custodio FF', lote: lote(40) })));
    await assertFails(otorgar('fdf_admin', 'fdf_inactivo', deleg({ delegadoNombre: 'Inactivo FF', lote: lote(41) })));
    await assertFails(otorgar('fdf_admin', 'fdf_nadie', deleg({ delegadoNombre: '', lote: lote(42) })));
  });
  test('cambiar: con lote NUEVO y registro «cambio»; nunca otro admin', async () => {
    await assertFails(otorgar('fdf_admin', 'fdf_carlos', deleg(), { tipo: 'cambio' }));   // mismo lote
    await assertFails(otorgar('fdf_admin', 'fdf_carlos', deleg({ lote: lote(50) }), { tipo: 'alta' }));
    await assertFails(otorgar('fdf_admin2', 'fdf_carlos', deleg({ lote: lote(51), custodio: 'fdf_admin2', custodioNombre: 'Otro Admin FF' }), { tipo: 'cambio' }));
    await assertFails(updateDoc(doc(db('fdf_admin2'), 'firmas_delegados_fichas/fdf_carlos'), { personas: ['MIGUEL_JIMENEZ'] }));
    await assertSucceeds(otorgar('fdf_admin', 'fdf_carlos', deleg({ lote: lote(52) }), { tipo: 'cambio' }));
  });
  test('lecturas: el delegado la suya; el custodio las suyas; nadie más', async () => {
    await assertSucceeds(getDoc(doc(db('fdf_carlos'), 'firmas_delegados_fichas/fdf_carlos')));
    await assertFails(getDoc(doc(db('fdf_carlos'), 'firmas_delegados_fichas/fdf_jorge')));
    await assertFails(getDocs(query(collection(db('fdf_carlos'), 'firmas_delegados_fichas'), limit(5))));
    await assertSucceeds(getDoc(doc(db('fdf_admin'), 'firmas_delegados_fichas/fdf_carlos')));
    await assertSucceeds(getDocs(query(collection(db('fdf_admin'), 'firmas_delegados_fichas'), where('custodio', '==', 'fdf_admin'), limit(50))));
    await assertFails(getDocs(query(collection(db('fdf_admin'), 'firmas_delegados_fichas'), limit(50))));
    await assertFails(getDoc(doc(db('fdf_admin2'), 'firmas_delegados_fichas/fdf_carlos')));
    await assertFails(getDocs(query(collection(db('fdf_carlos'), 'firmas_delegados_fichas_registro'), limit(5))));
    await assertSucceeds(getDocs(query(collection(db('fdf_admin'), 'firmas_delegados_fichas_registro'), where('custodio', '==', 'fdf_admin'), limit(50))));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'firmas_delegados_fichas/fdf_carlos')));
  });
});

describe('el directorio del custodio: el delegado en Fichas lee SOLO lo que se le delegó', () => {
  test('Carlos lee las cinco (delegadas)', async () => {
    for (const p of CINCO) await assertSucceeds(getDoc(doc(db('fdf_carlos'), 'firmas_equipo/fdf_admin/personas/' + p)));
  });
  test('Jorge solo las dos suyas; ni otro directorio, ni listar, ni escribir, ni la firma propia del custodio', async () => {
    await assertSucceeds(getDoc(doc(db('fdf_jorge'), 'firmas_equipo/fdf_admin/personas/JORGE_MIRANDA')));
    await assertFails(getDoc(doc(db('fdf_jorge'), 'firmas_equipo/fdf_admin/personas/ERICK_VERGARA')));
    await assertFails(getDoc(doc(db('fdf_carlos'), 'firmas_equipo/fdf_admin2/personas/JORGE_MIRANDA')));
    await assertFails(getDocs(query(collection(db('fdf_carlos'), 'firmas_equipo/fdf_admin/personas'), limit(5))));
    await assertFails(setDoc(doc(db('fdf_carlos'), 'firmas_equipo/fdf_admin/personas/CARLOS_MARTELO'), { x: 1 }));
    await assertFails(deleteDoc(doc(db('fdf_carlos'), 'firmas_equipo/fdf_admin/personas/CARLOS_MARTELO')));
    await assertFails(getDoc(doc(db('fdf_carlos'), 'firmas/fdf_admin')));
    await assertFails(getDocs(query(collection(db('fdf_carlos'), 'firmas_equipo_registro'), limit(5))));
    await assertFails(getDoc(doc(db('fdf_otro'), 'firmas_equipo/fdf_admin/personas/MIGUEL_JIMENEZ')));
  });
  test('los permisos no se mezclan: el de Órdenes no abre Fichas, y el de Fichas no da registro en Órdenes', async () => {
    await assertSucceeds(getDoc(doc(db('fdf_solo_ordenes'), 'firmas_equipo/fdf_admin/personas/MIGUEL_JIMENEZ')));
    await assertFails(getDoc(doc(db('fdf_solo_ordenes'), 'firmas_equipo/fdf_admin/personas/JORGE_MIRANDA')));
    await assertFails(setDoc(doc(db('fdf_solo_ordenes'), 'fichas_emisiones/' + fol('so')), emision({
      emisor: 'fdf_solo_ordenes', emisorNombre: 'Solo Ordenes FF', delegacion: 'L' + '9'.repeat(19),
      casillas: [cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')] })));
    await assertFails(setDoc(doc(db('fdf_carlos'), 'ordenes_emisiones/' + fol('oc')), {
      orden: { tipo: 'SALIDA', numero: '1', zona: 'X', fecha: '30/09/2026' }, documento: 'IT.05801', formato: 'pdf',
      casillas: [{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'equipo', huella: H }],
      huellaArchivo: 'a'.repeat(64), custodio: 'fdf_admin', custodioNombre: 'Custodio FF',
      emisor: 'fdf_carlos', emisorNombre: 'Carlos Sintetico FF', delegacion: lote(52), en: serverTimestamp() }));
  });
  test('el custodio sigue leyendo su directorio como siempre', async () => {
    await assertSucceeds(getDoc(doc(db('fdf_admin'), 'firmas_equipo/fdf_admin/personas/JORGE_MIRANDA')));
    await assertFails(getDoc(doc(db('fdf_admin2'), 'firmas_equipo/fdf_admin/personas/MIGUEL_JIMENEZ')));
  });
});

describe('emisiones del delegado (fichas_emisiones con emisor y delegación)', () => {
  test('Carlos registra el Excel con las cinco casillas (la suya propia y cuatro del directorio)', async () => {
    await assertSucceeds(setDoc(doc(db('fdf_carlos'), 'fichas_emisiones/' + fol('e1')), emision()));
    // Elaboró el Ingeniero (de la lista, con su otro nombre dictado) y la casilla de Carlos no está: también vale.
    await assertSucceeds(setDoc(doc(db('fdf_carlos'), 'fichas_emisiones/' + fol('e2')), emision({ casillas: [
      cas('elab', 'MIGUEL_JIMENEZ', 'MIGUEL A. JIMENEZ'), cas('rev', 'JORGE_MIRANDA', 'JORGE MIRANDA'),
      cas('apr', 'ERICK_VERGARA', 'ERICK VERGARA'), cas('apr2', 'JORGE_MIRANDA', 'JORGE MIRANDA'), cas('rec', 'ERICK_VERGARA', 'ERICK VERGARA')] })));
    // Su propia casilla escrita a mano («Otra persona»): persona vacía.
    await assertSucceeds(setDoc(doc(db('fdf_carlos'), 'fichas_emisiones/' + fol('e3')), emision({ casillas: [
      cas('elab', '', 'CARLOS MARTELO', 'propia', 'd'.repeat(64)), cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')] })));
  });
  test('lo que no cuadra con su delegación: no', async () => {
    const c = (casillas) => ({ casillas });
    const mal = [
      { custodio: 'fdf_admin2', custodioNombre: 'Otro Admin FF' }, { emisor: 'fdf_jorge' }, { emisorNombre: 'Otro' },
      { custodioNombre: 'Nombre Falso' }, { delegacion: lote(999) }, { delegacion: lote(1) },
      // Una persona en una casilla que no es la suya en la lista (el Ingeniero en «Aprobación», Erick en «Elaboración»).
      c([cas('apr', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')]),
      c([cas('elab', 'ERICK_VERGARA', 'ERICK VERGARA')]),
      c([cas('rec', 'JORGE_MIRANDA', 'JORGE MIRANDA')]),
      // Alguien que no es de la lista, o una casilla que no existe.
      c([cas('rev', 'JUAN_CARDONA', 'JUAN CARDONA')]),
      c([cas('otra', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')]),
      // La «propia» a nombre de otro.
      c([cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ', 'propia', 'd'.repeat(64))]),
      c([cas('elab', 'JORGE_RHENALS', 'JORGE RHENALS', 'propia', 'd'.repeat(64))]),
      // Huella que no es la de la firma que HOY está en el directorio, o fuera de forma.
      c([cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ', 'equipo', '1'.repeat(64))]),
      c([cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ', 'equipo', 'zz')]),
      c([cas('rev', 'MIGUEL_JIMENEZ', 'X'.repeat(81))]),
      c([{ ...cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ'), extra: 1 }]),
      c([cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ', 'otro')]),
      // La misma casilla dos veces; seis casillas; ninguna.
      c([cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ'), cas('rev', 'JORGE_MIRANDA', 'JORGE MIRANDA')]),
      c([...CINCO_CASILLAS.slice(0, 4), cas('elab', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')]),
      c([...CINCO_CASILLAS, cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')]),
      c([]),
      { documento: 'IT.05801' }, { en: new Date() }, { extra: 1 }, { huellaArchivo: 'zz' },
      { equipo: { matricula: 'T-1', subestacion: 'S', serie: 'S', otro: 1 } },
      { equipo: { matricula: 'T'.repeat(121), subestacion: 'S', serie: 'S' } },
      { equipo: { matricula: 7, subestacion: 'S', serie: 'S' } }
    ];
    let i = 0;
    for (const m of mal) await assertFails(setDoc(doc(db('fdf_carlos'), 'fichas_emisiones/' + fol('m' + (i++))), emision(m)));
  });
  test('Jorge no registra firmas que no se le delegaron', async () => {
    const base = { emisor: 'fdf_jorge', emisorNombre: 'Jorge Sintetico FF', delegacion: lote(1) };
    await assertSucceeds(setDoc(doc(db('fdf_jorge'), 'fichas_emisiones/' + fol('j1')), emision({ ...base,
      casillas: [cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ'), cas('apr', 'JORGE_MIRANDA', 'JORGE MIRANDA')] })));
    await assertFails(setDoc(doc(db('fdf_jorge'), 'fichas_emisiones/' + fol('j2')), emision({ ...base,
      casillas: [cas('apr2', 'ERICK_VERGARA', 'ERICK VERGARA')] })));
    await assertFails(setDoc(doc(db('fdf_jorge'), 'fichas_emisiones/' + fol('j3')), emision({ ...base,
      casillas: [cas('elab', 'CARLOS_MARTELO', 'CARLOS MARTELO')] })));
  });
  test('el folio de una emisión del delegado es un id de 20 letras o dígitos', async () => {
    await assertFails(setDoc(doc(db('fdf_carlos'), 'fichas_emisiones/corto'), emision()));
    await assertFails(setDoc(doc(db('fdf_carlos'), 'fichas_emisiones/FOLIO-CON-GUIONES-000'), emision()));
  });
  test('un técnico sin delegación no registra; el delegado no lee ni lista el registro; nadie lo edita', async () => {
    await assertFails(setDoc(doc(db('fdf_otro'), 'fichas_emisiones/' + fol('e9')), emision({ emisor: 'fdf_otro', emisorNombre: 'Otro Tecnico FF' })));
    await assertFails(getDoc(doc(db('fdf_carlos'), 'fichas_emisiones/' + fol('e1'))));
    await assertFails(getDocs(query(collection(db('fdf_carlos'), 'fichas_emisiones'), limit(5))));
    await assertFails(updateDoc(doc(db('fdf_carlos'), 'fichas_emisiones/' + fol('e1')), { huellaArchivo: 'b'.repeat(64) }));
    await assertFails(deleteDoc(doc(db('fdf_admin'), 'fichas_emisiones/' + fol('e1'))));
  });
  test('el custodio recorre SU registro de permisos de 50 en 50 (por id); otro admin no', async () => {
    const q1 = await assertSucceeds(getDocs(query(collection(db('fdf_admin'), 'firmas_delegados_fichas_registro'),
      where('custodio', '==', 'fdf_admin'), orderBy(documentId()), limit(50))));
    await assertSucceeds(getDocs(query(collection(db('fdf_admin'), 'firmas_delegados_fichas_registro'),
      where('custodio', '==', 'fdf_admin'), orderBy(documentId()), startAfter(q1.docs[0]), limit(50))));
    await assertFails(getDocs(query(collection(db('fdf_admin2'), 'firmas_delegados_fichas_registro'),
      where('custodio', '==', 'fdf_admin'), orderBy(documentId()), limit(50))));
  });
  test('el custodio ve los últimos usos de cada delegado (por emisor, los más nuevos primero)', async () => {
    await assertSucceeds(getDocs(query(collection(db('fdf_admin'), 'fichas_emisiones'), where('emisor', '==', 'fdf_carlos'), orderBy('en', 'desc'), limit(20))));
    await assertSucceeds(getDoc(doc(db('fdf_admin'), 'fichas_emisiones/' + fol('e1'))));
  });
  test('el administrador sigue registrando como antes; con «emisor» (sin delegación) no', async () => {
    const adm = { equipo: { matricula: 'T-0001', subestacion: 'S', serie: 'S' }, documento: 'PE.02081',
      casillas: [cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ', 'propia', 'b'.repeat(64))],
      huellaArchivo: 'a'.repeat(64), custodio: 'fdf_admin', custodioNombre: 'Custodio FF', en: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('fdf_admin'), 'fichas_emisiones/fdf_a1'), adm));
    await assertFails(setDoc(doc(db('fdf_admin'), 'fichas_emisiones/' + fol('a2')), { ...adm, emisor: 'fdf_admin', emisorNombre: 'Custodio FF', delegacion: lote(1) }));
    await assertFails(setDoc(doc(db('fdf_carlos'), 'fichas_emisiones/fdf_a3'), { ...adm, custodio: 'fdf_carlos', custodioNombre: 'Carlos Sintetico FF' }));
  });
});

describe('vigencia: retirar, dar de baja o degradar corta en la siguiente petición', () => {
  test('retirar exige su registro de retiro; otro admin no retira; después ya no lee ni registra', async () => {
    await assertSucceeds(otorgar('fdf_admin', 'fdf_baja', deleg({ delegadoNombre: 'Se Da De Baja FF', personaPropia: 'JORGE_RHENALS', lote: lote(70) })));
    await assertFails(retirar('fdf_admin', 'fdf_baja', lote(70), { conRegistro: false }));
    {
      const f = db('fdf_admin'); const b = writeBatch(f);
      b.delete(doc(f, 'firmas_delegados_fichas/fdf_baja'));
      b.set(doc(f, 'firmas_delegados_fichas_registro/fdf_baja_' + lote(70) + '_retiro'),
        { tipo: 'retiro', delegado: 'fdf_baja', lote: lote(70), custodio: 'fdf_admin', custodioNombre: 'Custodio FF', personas: ['MIGUEL_JIMENEZ'], en: serverTimestamp() });
      await assertFails(b.commit());
    }
    await assertFails(retirar('fdf_admin2', 'fdf_baja', lote(70), { custodio: 'fdf_admin2', nombre: 'Otro Admin FF' }));
    await assertSucceeds(getDoc(doc(db('fdf_baja'), 'firmas_equipo/fdf_admin/personas/ERICK_VERGARA')));
    await assertSucceeds(retirar('fdf_admin', 'fdf_baja', lote(70)));
    await assertFails(getDoc(doc(db('fdf_baja'), 'firmas_equipo/fdf_admin/personas/ERICK_VERGARA')));
    await assertFails(setDoc(doc(db('fdf_baja'), 'fichas_emisiones/' + fol('b1')), emision({ emisor: 'fdf_baja', emisorNombre: 'Se Da De Baja FF',
      delegacion: lote(70), casillas: [cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')] })));
    await assertFails(updateDoc(doc(db('fdf_admin'), 'firmas_delegados_fichas_registro/fdf_baja_' + lote(70)), { tipo: 'cambio' }));
    await assertFails(deleteDoc(doc(db('fdf_admin'), 'firmas_delegados_fichas_registro/fdf_baja_' + lote(70))));
  });
  test('el delegado desactivado ya no lee ni registra', async () => {
    await assertSucceeds(otorgar('fdf_admin', 'fdf_otro', deleg({ delegadoNombre: 'Otro Tecnico FF', personaPropia: 'JORGE_RHENALS', lote: lote(80) })));
    await assertSucceeds(getDoc(doc(db('fdf_otro'), 'firmas_equipo/fdf_admin/personas/MIGUEL_JIMENEZ')));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'usuarios/fdf_otro'), { activo: false }));
    await assertFails(getDoc(doc(db('fdf_otro'), 'firmas_equipo/fdf_admin/personas/MIGUEL_JIMENEZ')));
    await assertFails(setDoc(doc(db('fdf_otro'), 'fichas_emisiones/' + fol('o1')), emision({ emisor: 'fdf_otro', emisorNombre: 'Otro Tecnico FF',
      delegacion: lote(80), casillas: [cas('rev', 'MIGUEL_JIMENEZ', 'MIGUEL JIMENEZ')] })));
  });
  test('si el custodio deja de ser admin, sus delegaciones dejan de servir', async () => {
    await assertSucceeds(otorgar('fdf_degradado', 'fdf_baja', deleg({ custodio: 'fdf_degradado', custodioNombre: 'Custodio Que Baja FF',
      delegadoNombre: 'Se Da De Baja FF', personaPropia: 'JORGE_RHENALS', lote: lote(91) })));
    await assertSucceeds(getDoc(doc(db('fdf_baja'), 'firmas_equipo/fdf_degradado/personas/JORGE_MIRANDA')));
    await assertFails(getDoc(doc(db('fdf_baja'), 'firmas_equipo/fdf_admin/personas/JORGE_MIRANDA')));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'usuarios/fdf_degradado'), { rol: 'tecnico' }));
    await assertFails(getDoc(doc(db('fdf_baja'), 'firmas_equipo/fdf_degradado/personas/JORGE_MIRANDA')));
    // Ya no es admin: puede retirar su delegación aunque no escriba registro.
    await assertSucceeds(deleteDoc(doc(db('fdf_degradado'), 'firmas_delegados_fichas/fdf_baja')));
  });
});
