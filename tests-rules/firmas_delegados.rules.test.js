// ══════════════════════════════════════════════════════════════
// Firmas DELEGADAS para Órdenes E/S (ADR-117): el custodio otorga a un usuario que
// lea de SU directorio solo las personas que nombra (con la autorización de cada
// titular); todo cambio con su registro que SOLO se agrega; el delegado registra
// sus emisiones con folio. Las DOS direcciones (L-78). Prefijo `fd_`, nombres sintéticos.
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
const lote = (n) => 'L' + String(n).padStart(19, '0');
// Folio (id) de una emisión del delegado: 20 letras o dígitos, como los que da Firestore.
const fol = (t) => ('F' + t + 'x'.repeat(20)).replace(/[^A-Za-z0-9]/g, 'x').slice(0, 20);
const H = 'e'.repeat(64);   // la huella de las firmas sembradas en el directorio
const HOY = { fecha: '2026-09-28', medio: 'Autorización verbal al custodio' };

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const u = (id, rol, activo, nombre) => setDoc(doc(d, 'usuarios/' + id), { email: id + '@x.co', rol, activo, nombre });
    await u('fd_admin', 'admin', true, 'Custodio FD');
    await u('fd_admin2', 'admin', true, 'Otro Admin FD');
    await u('fd_carlos', 'tecnico', true, 'Carlos Sintetico');
    await u('fd_jorge', 'tecnico', true, 'Jorge Sintetico');
    await u('fd_otro', 'tecnico', true, 'Otro Tecnico');
    await u('fd_inactivo', 'tecnico', false, 'Inactivo FD');
    await u('fd_baja', 'tecnico', true, 'Se Da De Baja');
    await u('fd_degradado', 'admin', true, 'Custodio Que Baja');
    await u('fd_sin_nombre', 'tecnico', true, 'Queda Sin Nombre');
    await setDoc(doc(d, 'admins/fd_arranque'), { email: 'x@x.co' });
    const firma = { imagen: Bytes.fromUint8Array(new Uint8Array([137, 80, 78, 71])), huella: 'e'.repeat(64), autorizacion: HOY, registro: 'r', en: new Date() };
    for (const p of ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS', 'JORGE_MIRANDA']) {
      await setDoc(doc(d, 'firmas_equipo/fd_admin/personas/' + p), firma);
      await setDoc(doc(d, 'firmas_equipo/fd_degradado/personas/' + p), firma);
    }
    await setDoc(doc(d, 'firmas_equipo/fd_admin2/personas/MIGUEL_JIMENEZ'), firma);
    await setDoc(doc(d, 'firmas/fd_admin'), { imagen: Bytes.fromUint8Array(new Uint8Array([1])), huella: 'f'.repeat(64), en: new Date() });
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

/** Datos de una delegación (lo que escribe la página del custodio). */
const deleg = (extra = {}) => ({
  custodio: 'fd_admin', custodioNombre: 'Custodio FD', delegadoNombre: 'Carlos Sintetico', personaPropia: 'CARLOS_MARTELO',
  personas: ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS'],
  autorizaciones: { MIGUEL_JIMENEZ: HOY, CARLOS_MARTELO: HOY, JORGE_RHENALS: HOY },
  alcance: 'ordenes', lote: lote(1), en: serverTimestamp(), ...extra
});
const regDe = (delegado, dd, tipo) => ({
  tipo, delegado, delegadoNombre: dd.delegadoNombre, personaPropia: dd.personaPropia, personas: dd.personas,
  autorizaciones: dd.autorizaciones, lote: dd.lote, custodio: dd.custodio, custodioNombre: dd.custodioNombre, en: serverTimestamp()
});
/** Otorga (o cambia) en UN lote: la delegación y su registro. */
function otorgar(quien, delegado, dd, { tipo = 'alta', idReg, reg } = {}) {
  const f = db(quien); const b = writeBatch(f);
  b.set(doc(f, 'firmas_delegados/' + delegado), dd);
  b.set(doc(f, 'firmas_delegados_registro/' + (idReg || (delegado + '_' + dd.lote))), reg || regDe(delegado, dd, tipo));
  return b.commit();
}
function retirar(quien, delegado, loteActual, { conRegistro = true, custodio = 'fd_admin', nombre = 'Custodio FD' } = {}) {
  const f = db(quien); const b = writeBatch(f);
  b.delete(doc(f, 'firmas_delegados/' + delegado));
  if (conRegistro) {
    b.set(doc(f, 'firmas_delegados_registro/' + delegado + '_' + loteActual + '_retiro'),
      { tipo: 'retiro', delegado, lote: loteActual, custodio, custodioNombre: nombre, en: serverTimestamp() });
  }
  return b.commit();
}
const emision = (extra = {}) => ({
  orden: { tipo: 'SALIDA', numero: '777', zona: 'BOLIVAR', fecha: '28/09/2026' },
  documento: 'IT.05801', formato: 'pdf',
  casillas: [{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'equipo', huella: H },
    { rol: 'entregado', persona: 'JORGE_RHENALS', nombre: 'JORGE RHENALS', origen: 'equipo', huella: H }],
  huellaArchivo: 'a'.repeat(64), custodio: 'fd_admin', custodioNombre: 'Custodio FD',
  // La delegación VIGENTE de Carlos es la del cambio (lote 52): una emisión con un lote viejo no vale.
  emisor: 'fd_carlos', emisorNombre: 'Carlos Sintetico', delegacion: lote(52), en: serverTimestamp(), ...extra
});

describe('firmas_delegados — solo el custodio otorga, con su registro en el mismo lote', () => {
  test('el custodio otorga a Carlos (lote con registro «alta») y a Jorge', async () => {
    await assertSucceeds(otorgar('fd_admin', 'fd_carlos', deleg()));
    await assertSucceeds(otorgar('fd_admin', 'fd_jorge', deleg({ delegadoNombre: 'Jorge Sintetico', personaPropia: 'JORGE_RHENALS' })));
  });
  test('sin registro, con el registro suelto o con un registro que no cuadra: no', async () => {
    await assertFails(setDoc(doc(db('fd_admin'), 'firmas_delegados/fd_otro'), deleg({ delegadoNombre: 'Otro Tecnico', lote: lote(2) })));
    await assertFails(setDoc(doc(db('fd_admin'), 'firmas_delegados_registro/fd_otro_' + lote(2)), regDe('fd_otro', deleg({ delegadoNombre: 'Otro Tecnico', lote: lote(2) }), 'alta')));
    const dd = deleg({ delegadoNombre: 'Otro Tecnico', lote: lote(3) });
    await assertFails(otorgar('fd_admin', 'fd_otro', dd, { reg: { ...regDe('fd_otro', dd, 'alta'), personas: ['MIGUEL_JIMENEZ'] } }));
    await assertFails(otorgar('fd_admin', 'fd_otro', dd, { tipo: 'cambio' }));
    await assertFails(otorgar('fd_admin', 'fd_otro', dd, { idReg: 'fd_otro_OTROID' }));
  });
  test('ni un técnico (ni para sí mismo), ni el admin de arranque, ni otro admin a nombre ajeno', async () => {
    await assertFails(otorgar('fd_carlos', 'fd_carlos', deleg({ custodio: 'fd_carlos', custodioNombre: 'Carlos Sintetico', lote: lote(4) })));
    await assertFails(otorgar('fd_otro', 'fd_otro', deleg({ custodio: 'fd_admin', lote: lote(5), delegadoNombre: 'Otro Tecnico' })));
    await assertFails(otorgar('fd_arranque', 'fd_otro', deleg({ custodio: 'fd_arranque', custodioNombre: '', lote: lote(6), delegadoNombre: 'Otro Tecnico' })));
    await assertFails(otorgar('fd_admin2', 'fd_otro', deleg({ lote: lote(7), delegadoNombre: 'Otro Tecnico' })));
  });
  test('datos que no cuadran: no', async () => {
    const mal = [
      { custodioNombre: 'Nombre Falso' }, { delegadoNombre: 'Otro Nombre' }, { personaPropia: 'MIGUEL_JIMENEZ' },
      { personas: ['MIGUEL_JIMENEZ', 'JORGE_MIRANDA'], autorizaciones: { MIGUEL_JIMENEZ: HOY, JORGE_MIRANDA: HOY } },
      { personas: ['ERICK_VERGARA'], autorizaciones: { ERICK_VERGARA: HOY } },
      { personas: [], autorizaciones: {} },
      { personas: ['MIGUEL_JIMENEZ', 'MIGUEL_JIMENEZ'], autorizaciones: { MIGUEL_JIMENEZ: HOY } },
      { autorizaciones: { MIGUEL_JIMENEZ: HOY, CARLOS_MARTELO: HOY } },
      { autorizaciones: { MIGUEL_JIMENEZ: { fecha: '28/09/2026', medio: 'verbal' }, CARLOS_MARTELO: HOY, JORGE_RHENALS: HOY } },
      { autorizaciones: { MIGUEL_JIMENEZ: { fecha: '2026-09-28', medio: 'x' }, CARLOS_MARTELO: HOY, JORGE_RHENALS: HOY } },
      { alcance: 'fichas' }, { en: new Date() }, { lote: 'corto' }, { extra: 1 }
    ];
    let i = 10;
    for (const m of mal) {
      const dd = deleg({ delegadoNombre: 'Otro Tecnico', lote: lote(i++), ...m });
      await assertFails(otorgar('fd_admin', 'fd_otro', dd));
    }
  });
  test('a sí mismo, a un usuario inactivo o inexistente: no', async () => {
    await assertFails(otorgar('fd_admin', 'fd_admin', deleg({ delegadoNombre: 'Custodio FD', lote: lote(40) })));
    await assertFails(otorgar('fd_admin', 'fd_inactivo', deleg({ delegadoNombre: 'Inactivo FD', lote: lote(41) })));
    await assertFails(otorgar('fd_admin', 'fd_nadie', deleg({ delegadoNombre: '', lote: lote(42) })));
  });
  test('cambiar: con lote NUEVO y registro «cambio»; nunca otro admin', async () => {
    await assertFails(otorgar('fd_admin', 'fd_carlos', deleg(), { tipo: 'cambio' }));   // mismo lote
    await assertFails(otorgar('fd_admin', 'fd_carlos', deleg({ lote: lote(50) }), { tipo: 'alta' }));
    await assertFails(otorgar('fd_admin2', 'fd_carlos', deleg({ lote: lote(51), custodio: 'fd_admin2', custodioNombre: 'Otro Admin FD' }), { tipo: 'cambio' }));
    await assertFails(updateDoc(doc(db('fd_admin2'), 'firmas_delegados/fd_carlos'), { personas: ['MIGUEL_JIMENEZ'] }));
    await assertSucceeds(otorgar('fd_admin', 'fd_carlos', deleg({ lote: lote(52) }), { tipo: 'cambio' }));
  });
  test('lecturas: el delegado la suya; el custodio las suyas; nadie más', async () => {
    await assertSucceeds(getDoc(doc(db('fd_carlos'), 'firmas_delegados/fd_carlos')));
    await assertFails(getDoc(doc(db('fd_carlos'), 'firmas_delegados/fd_jorge')));
    await assertFails(getDocs(query(collection(db('fd_carlos'), 'firmas_delegados'), limit(5))));
    await assertSucceeds(getDoc(doc(db('fd_admin'), 'firmas_delegados/fd_carlos')));
    await assertSucceeds(getDocs(query(collection(db('fd_admin'), 'firmas_delegados'), where('custodio', '==', 'fd_admin'), limit(50))));
    await assertFails(getDocs(query(collection(db('fd_admin'), 'firmas_delegados'), limit(50))));
    await assertFails(getDoc(doc(db('fd_admin2'), 'firmas_delegados/fd_carlos')));
    await assertFails(getDocs(query(collection(db('fd_carlos'), 'firmas_delegados_registro'), limit(5))));
    await assertSucceeds(getDocs(query(collection(db('fd_admin'), 'firmas_delegados_registro'), where('custodio', '==', 'fd_admin'), limit(50))));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'firmas_delegados/fd_carlos')));
  });
});

describe('el directorio del custodio: el delegado lee SOLO lo que se le delegó', () => {
  test('Carlos lee la del Ingeniero y las de Carlos y Jorge (delegadas)', async () => {
    for (const p of ['MIGUEL_JIMENEZ', 'CARLOS_MARTELO', 'JORGE_RHENALS']) {
      await assertSucceeds(getDoc(doc(db('fd_carlos'), 'firmas_equipo/fd_admin/personas/' + p)));
    }
  });
  test('ni personas no delegadas, ni otro directorio, ni listar, ni escribir, ni la firma propia del custodio', async () => {
    await assertFails(getDoc(doc(db('fd_carlos'), 'firmas_equipo/fd_admin/personas/JORGE_MIRANDA')));
    await assertFails(getDoc(doc(db('fd_carlos'), 'firmas_equipo/fd_admin2/personas/MIGUEL_JIMENEZ')));
    await assertFails(getDocs(query(collection(db('fd_carlos'), 'firmas_equipo/fd_admin/personas'), limit(5))));
    await assertFails(setDoc(doc(db('fd_carlos'), 'firmas_equipo/fd_admin/personas/CARLOS_MARTELO'), { x: 1 }));
    await assertFails(deleteDoc(doc(db('fd_carlos'), 'firmas_equipo/fd_admin/personas/CARLOS_MARTELO')));
    await assertFails(getDoc(doc(db('fd_carlos'), 'firmas/fd_admin')));
    await assertFails(getDocs(query(collection(db('fd_carlos'), 'firmas_equipo_registro'), limit(5))));
    await assertFails(getDoc(doc(db('fd_otro'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
  });
  test('con menos personas delegadas, la que se quitó deja de leerse', async () => {
    await assertSucceeds(otorgar('fd_admin', 'fd_jorge', deleg({ delegadoNombre: 'Jorge Sintetico', personaPropia: 'JORGE_RHENALS',
      personas: ['MIGUEL_JIMENEZ', 'JORGE_RHENALS'], autorizaciones: { MIGUEL_JIMENEZ: HOY, JORGE_RHENALS: HOY }, lote: lote(60) }), { tipo: 'cambio' }));
    await assertSucceeds(getDoc(doc(db('fd_jorge'), 'firmas_equipo/fd_admin/personas/JORGE_RHENALS')));
    await assertFails(getDoc(doc(db('fd_jorge'), 'firmas_equipo/fd_admin/personas/CARLOS_MARTELO')));
  });
  test('el custodio sigue leyendo su directorio como siempre', async () => {
    await assertSucceeds(getDoc(doc(db('fd_admin'), 'firmas_equipo/fd_admin/personas/JORGE_MIRANDA')));
    await assertFails(getDoc(doc(db('fd_admin2'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
  });
});

describe('emisiones del delegado (ordenes_emisiones con emisor y delegación)', () => {
  test('Carlos registra la suya: dueño del directorio = custodio, emisor = él, delegación vigente', async () => {
    await assertSucceeds(setDoc(doc(db('fd_carlos'), 'ordenes_emisiones/' + fol('e1')), emision()));
    await assertSucceeds(setDoc(doc(db('fd_carlos'), 'ordenes_emisiones/' + fol('e1b')), emision({ formato: 'xlsx',
      casillas: [{ rol: 'entregado', persona: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', origen: 'propia', huella: 'd'.repeat(64) },
        { rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'equipo', huella: H }] })));
  });
  test('lo que no cuadra con su delegación: no', async () => {
    const c = (casillas) => ({ casillas });
    const mal = [
      { custodio: 'fd_admin2', custodioNombre: 'Otro Admin FD' }, { emisor: 'fd_jorge' }, { emisorNombre: 'Otro' },
      { custodioNombre: 'Nombre Falso' }, { delegacion: lote(999) },
      c([{ rol: 'entregado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'equipo', huella: 'b'.repeat(64) }]),
      c([{ rol: 'autorizado', persona: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', origen: 'equipo', huella: 'b'.repeat(64) }]),
      c([{ rol: 'entregado', persona: 'JORGE_MIRANDA', nombre: 'JORGE MIRANDA', origen: 'equipo', huella: 'b'.repeat(64) }]),
      c([{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'propia', huella: 'b'.repeat(64) }]),
      c([{ rol: 'entregado', persona: 'JORGE_RHENALS', nombre: 'JORGE RHENALS', origen: 'propia', huella: 'b'.repeat(64) }]),
      c([{ rol: 'recibido', persona: 'CARLOS_MARTELO', nombre: 'X', origen: 'equipo', huella: 'b'.repeat(64) }]),
      c([{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'equipo', huella: 'zz' }]),
      c([]), { documento: 'PE.02081' }, { en: new Date() }, { extra: 1 }, { delegacion: lote(1) },
      // Revisión §117: dos casillas en la misma línea, tres casillas, una huella que no es la del directorio,
      // datos de la orden fuera de forma o de tamaño.
      c([{ rol: 'entregado', persona: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', origen: 'equipo', huella: H },
        { rol: 'entregado', persona: 'JORGE_RHENALS', nombre: 'JORGE RHENALS', origen: 'equipo', huella: H }]),
      c([{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'equipo', huella: H },
        { rol: 'entregado', persona: 'CARLOS_MARTELO', nombre: 'CARLOS MARTELO', origen: 'equipo', huella: H },
        { rol: 'entregado', persona: 'JORGE_RHENALS', nombre: 'JORGE RHENALS', origen: 'equipo', huella: H }]),
      c([{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'equipo', huella: '1'.repeat(64) }]),
      c([{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'X'.repeat(81), origen: 'equipo', huella: H }]),
      { orden: { tipo: 'OTRO', numero: '777', zona: 'BOLIVAR', fecha: '28/09/2026' } },
      { orden: { tipo: 'SALIDA', numero: '7'.repeat(31), zona: 'BOLIVAR', fecha: '28/09/2026' } },
      { orden: { tipo: 'SALIDA', numero: '777', zona: ['X'], fecha: '28/09/2026' } },
      { orden: { tipo: 'SALIDA', numero: 777, zona: 'BOLIVAR', fecha: '28/09/2026' } }
    ];
    let i = 0;
    for (const m of mal) await assertFails(setDoc(doc(db('fd_carlos'), 'ordenes_emisiones/' + fol('m' + (i++))), emision(m)));
  });
  test('el folio de una emisión del delegado es un id de 20 letras o dígitos', async () => {
    await assertFails(setDoc(doc(db('fd_carlos'), 'ordenes_emisiones/corto'), emision()));
    await assertFails(setDoc(doc(db('fd_carlos'), 'ordenes_emisiones/FOLIO-CON-GUIONES-000'), emision()));
  });
  test('un técnico sin delegación no registra; el delegado no lee el registro; ni Fichas', async () => {
    await assertFails(setDoc(doc(db('fd_otro'), 'ordenes_emisiones/' + fol('e2')), emision({ emisor: 'fd_otro', emisorNombre: 'Otro Tecnico' })));
    await assertFails(getDoc(doc(db('fd_carlos'), 'ordenes_emisiones/' + fol('e1'))));
    await assertFails(getDocs(query(collection(db('fd_carlos'), 'ordenes_emisiones'), limit(5))));
    await assertFails(setDoc(doc(db('fd_carlos'), 'fichas_emisiones/fd_f1'), { documento: 'PE.02081' }));
  });
  test('el administrador sigue registrando como antes; con «emisor» (sin delegación) no', async () => {
    const adm = { orden: emision().orden, documento: 'IT.05801', formato: 'pdf',
      casillas: [{ rol: 'autorizado', persona: 'MIGUEL_JIMENEZ', nombre: 'MIGUEL JIMENEZ', origen: 'propia', huella: 'b'.repeat(64) }],
      huellaArchivo: 'a'.repeat(64), custodio: 'fd_admin', custodioNombre: 'Custodio FD', en: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('fd_admin'), 'ordenes_emisiones/fd_a1'), adm));
    await assertFails(setDoc(doc(db('fd_admin'), 'ordenes_emisiones/' + fol('a2')), { ...adm, emisor: 'fd_admin', emisorNombre: 'Custodio FD', delegacion: lote(1) }));
  });
  // Espejo de §119 en Órdenes: «Últimos usos» recorre el registro de 50 en 50 (antes, un solo limit(50) sin orden).
  test('el custodio recorre SU registro de permisos de 50 en 50 (por id); otro admin, un delegado o una página de 51 no', async () => {
    const q1 = await assertSucceeds(getDocs(query(collection(db('fd_admin'), 'firmas_delegados_registro'),
      where('custodio', '==', 'fd_admin'), orderBy(documentId()), limit(50))));
    await assertSucceeds(getDocs(query(collection(db('fd_admin'), 'firmas_delegados_registro'),
      where('custodio', '==', 'fd_admin'), orderBy(documentId()), startAfter(q1.docs[0]), limit(50))));
    await assertFails(getDocs(query(collection(db('fd_admin2'), 'firmas_delegados_registro'),
      where('custodio', '==', 'fd_admin'), orderBy(documentId()), limit(50))));
    await assertFails(getDocs(query(collection(db('fd_carlos'), 'firmas_delegados_registro'),
      where('custodio', '==', 'fd_admin'), orderBy(documentId()), limit(50))));
    await assertFails(getDocs(query(collection(db('fd_admin'), 'firmas_delegados_registro'),
      where('custodio', '==', 'fd_admin'), orderBy(documentId()), limit(51))));
  });
  test('el custodio ve los últimos usos de cada delegado (por emisor, los más nuevos primero)', async () => {
    await assertSucceeds(getDocs(query(collection(db('fd_admin'), 'ordenes_emisiones'), where('emisor', '==', 'fd_carlos'), orderBy('en', 'desc'), limit(20))));
  });
});

describe('vigencia: retirar, dar de baja o degradar corta en la siguiente petición', () => {
  test('retirar exige su registro de retiro; otro admin no retira; después ya no lee ni registra', async () => {
    await assertSucceeds(otorgar('fd_admin', 'fd_baja', deleg({ delegadoNombre: 'Se Da De Baja', personaPropia: 'JORGE_RHENALS', lote: lote(70) })));
    await assertFails(retirar('fd_admin', 'fd_baja', lote(70), { conRegistro: false }));
    // El registro de retiro no admite datos de más (revisión §117).
    {
      const f = db('fd_admin'); const b = writeBatch(f);
      b.delete(doc(f, 'firmas_delegados/fd_baja'));
      b.set(doc(f, 'firmas_delegados_registro/fd_baja_' + lote(70) + '_retiro'),
        { tipo: 'retiro', delegado: 'fd_baja', lote: lote(70), custodio: 'fd_admin', custodioNombre: 'Custodio FD', personas: ['MIGUEL_JIMENEZ'], en: serverTimestamp() });
      await assertFails(b.commit());
    }
    await assertFails(retirar('fd_admin2', 'fd_baja', lote(70), { custodio: 'fd_admin2', nombre: 'Otro Admin FD' }));
    await assertSucceeds(getDoc(doc(db('fd_baja'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
    await assertSucceeds(retirar('fd_admin', 'fd_baja', lote(70)));
    await assertFails(getDoc(doc(db('fd_baja'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
    await assertFails(setDoc(doc(db('fd_baja'), 'ordenes_emisiones/' + fol('b1')), emision({ emisor: 'fd_baja', emisorNombre: 'Se Da De Baja', delegacion: lote(70) })));
    await assertFails(updateDoc(doc(db('fd_admin'), 'firmas_delegados_registro/fd_baja_' + lote(70)), { tipo: 'cambio' }));
    await assertFails(deleteDoc(doc(db('fd_admin'), 'firmas_delegados_registro/fd_baja_' + lote(70))));
  });
  // Espejo de §119 en Órdenes: el panel ofrece «Retirar permiso» a un usuario ACTIVO sin nombre en su perfil.
  test('retirar el permiso de un delegado cuyo perfil quedó sin nombre (el retiro no depende del nombre)', async () => {
    await assertSucceeds(otorgar('fd_admin', 'fd_sin_nombre', deleg({ delegadoNombre: 'Queda Sin Nombre', personaPropia: 'JORGE_RHENALS', lote: lote(75) })));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'usuarios/fd_sin_nombre'), { nombre: '' }));
    await assertFails(retirar('fd_admin', 'fd_sin_nombre', lote(75), { conRegistro: false }));
    await assertSucceeds(retirar('fd_admin', 'fd_sin_nombre', lote(75)));
    await assertFails(getDoc(doc(db('fd_sin_nombre'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
  });
  test('el delegado desactivado ya no lee', async () => {
    await assertSucceeds(otorgar('fd_admin', 'fd_otro', deleg({ delegadoNombre: 'Otro Tecnico', personaPropia: 'JORGE_RHENALS', lote: lote(80) })));
    await assertSucceeds(getDoc(doc(db('fd_otro'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'usuarios/fd_otro'), { activo: false }));
    await assertFails(getDoc(doc(db('fd_otro'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
  });
  test('si el custodio deja de ser admin, sus delegaciones dejan de servir', async () => {
    // Otro custodio no puede apropiarse de la delegación de Jorge (es de fd_admin).
    await assertFails(otorgar('fd_degradado', 'fd_jorge', deleg({ custodio: 'fd_degradado', custodioNombre: 'Custodio Que Baja',
      delegadoNombre: 'Jorge Sintetico', personaPropia: 'JORGE_RHENALS', lote: lote(90) }), { tipo: 'cambio' }));
    // fd_baja quedó sin delegación (se retiró): el otro custodio le otorga una suya.
    await assertSucceeds(otorgar('fd_degradado', 'fd_baja', deleg({ custodio: 'fd_degradado', custodioNombre: 'Custodio Que Baja',
      delegadoNombre: 'Se Da De Baja', personaPropia: 'JORGE_RHENALS', lote: lote(91) })));
    await assertSucceeds(getDoc(doc(db('fd_baja'), 'firmas_equipo/fd_degradado/personas/MIGUEL_JIMENEZ')));
    await assertFails(getDoc(doc(db('fd_baja'), 'firmas_equipo/fd_admin/personas/MIGUEL_JIMENEZ')));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'usuarios/fd_degradado'), { rol: 'tecnico' }));
    await assertFails(getDoc(doc(db('fd_baja'), 'firmas_equipo/fd_degradado/personas/MIGUEL_JIMENEZ')));
    // Ya no es admin: puede retirar su delegación aunque no escriba registro.
    await assertSucceeds(deleteDoc(doc(db('fd_degradado'), 'firmas_delegados/fd_baja')));
  });
});
