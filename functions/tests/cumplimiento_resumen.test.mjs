// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El RESUMEN DE NOTIFICACIONES de los avisos de cumplimiento (99 §236) con DOBLES
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): «me gustaría que en SGM, en mi sesión, pueda apreciar cuándo y cuántas veces
// notificas». Sin red, sin emulador y sin Firestore real: la lógica (assets/js/domain/odt_afinia_cumplimiento_resumen.js,
// _remitente.js y _avisos.js) corre sobre los adaptadores de verdad (functions/cumplimiento_resumen.mjs,
// cumplimiento_remitente.mjs y cumplimiento.mjs) con un Firestore del Admin SDK EN MEMORIA. Se prueba:
//   · el resumen se suma en la MISMA transacción en que el correo pasa a «enviado» (los dos cambios se confirman
//     juntos), sin contar dos veces si el script repite el resultado; un error no suma;
//   · odtAvisadas sube SOLO la primera vez que una ODT sale en un correo enviado (también si dos envíos se cruzan: la
//     transacción se repite y no se pierde ni se duplica nada); el tope seguido de un «sí salió» tardío suma una vez;
//   · si la suma falla, el envío se registra igual (no se vuelve a mandar) y el resumen queda «porRecalcular»;
//   · el recálculo (reproceso) desde los correos enviados, por páginas, y que dice lo MISMO que la suma de cada envío;
//   · cada correo nuevo guarda los NOMBRES de sus destinatarios (paraNombres), la fecha de los datos (datosDel) y el
//     responsable normalizado (responsableNorm);
//   · la cola del script: la más vieja primero y solo la del responsable configurado, aunque haya más de 50 de otro;
//   · corrector ronda 1: los correos viejos sin responsableNorm salen (o los retira un corte más reciente); el resumen
//     se calcula ENTERO si no existe o quedó «porRecalcular»; un error pasajero al sumar repite la transacción; los
//     correos en «error» de cortes anteriores quedan reemplazados; reabrir un correo renueva creadoEn;
//   · con un token válido de la cuenta remitente pero la configuración inválida, el estado registra la conexión;
//   · functions/index.js y firestore.indexes.json: el cableado y los índices compuestos.
// Datos INVENTADOS: personas, correos @prueba.test, contratistas, ids de cliente y N.º que empiezan por 9.
// Correr: node --test functions/tests/cumplimiento_resumen.test.mjs (desde la raíz del repositorio).
// ══════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { procesarCorteCumplimiento, idAviso, idCorreo } from '../../assets/js/domain/odt_afinia_cumplimiento_avisos.js';
import * as R from '../../assets/js/domain/odt_afinia_cumplimiento_remitente.js';
import * as RES from '../../assets/js/domain/odt_afinia_cumplimiento_resumen.js';
import { sumarDias } from '../../assets/js/domain/odt_afinia_cumplimiento.js';
import { agregar, normalizarNombre } from '../../assets/js/domain/odt_afinia_indicadores.js';
import { planCorte } from '../../assets/js/data/odt_afinia_cortes_lotes.js';
import { crearDepsCumplimiento } from '../cumplimiento.mjs';
import { crearDepsRemitente, crearOperacionesCola } from '../cumplimiento_remitente.mjs';
import { crearOperacionesResumen } from '../cumplimiento_resumen.mjs';
import { crearAdminFalso, FieldValue, TS } from './firestore_admin_falso.mjs';

/* ── Datos inventados ─────────────────────────────────────────────────────────── */
const RESP = 'RESPONSABLE FICTICIO DE AVISOS';
const AUD = '9000000001-ficticio0aprobado.apps.googleusercontent.com';
const CONFIG = {
  activo: true, remitente: 'remitente.sgm@prueba.test', responsable: 'Responsable  Fictício de Avisos',
  para: [{ correo: 'destino.uno@prueba.test', nombre: 'Persona Uno' }, { correo: 'destino.dos@prueba.test', nombre: 'Persona Dos' }],
  cc: ['copia.uno@prueba.test'], audienciaScript: AUD
};
const DIA_CORTE = '2026-11-21';
const RUTA_RESUMEN = 'odt_afinia_config/cumplimiento_resumen';
const DIA_MS = 24 * 3600 * 1000;
const odt = (nro, { dias = null, estado = 'EJECUTADA', ejecucion = '', cerrada = '' } = {}) => ({
  nro, empresa: 'CONTRATISTA FICTICIO UNO', tipo: 'TIPO FICTICIO', zona: 'ZONA FICTICIA', subestacion: 'S/E FICTICIA ' + nro.slice(-1), prevista: '2026-10-15', cerrada, estado,
  principal: true, azt: 'AZT FICTICIO', jefe: 'JEFE FICTICIO', ejecucion: dias != null ? sumarDias(DIA_CORTE, -dias) : ejecucion, equipo: 'EQUIPO FICTICIO ' + nro.slice(-1)
});
const ID = (k) => 'Resumen' + String(k).padStart(13, '0');
function sembrarCorte(f, id, { odts, sello = '20261121150000' } = {}) {
  const analisis = { responsable: RESP, odts, filasResponsable: odts.length, ...agregar(odts) };
  const p = planCorte({ id, archivo: { nombre: 'INFORME_ODT_' + sello + '_prueba.csv', bytes: 10, sha256: 'ab'.repeat(32) },
    lectura: { filas: odts.length + 3, odtsArchivo: odts.length + 1 }, analisis, por: { uid: 'uid-admin-prueba', nombre: 'Admin Prueba' }, ts: TS });
  for (const o of p.operaciones) f.store.set(o.ruta.join('/'), o.datos);
}
const payload = (ms, extra = {}) => ({ iss: 'https://accounts.google.com', aud: AUD, email: CONFIG.remitente, email_verified: true, exp: ms / 1000 + 3000, iat: ms / 1000 - 10, ...extra });

/** Un mundo de prueba: el proceso de los cortes, la función del script (CON el resumen) y el script de Google simulado. */
function preparar({ config = CONFIG, logicaResumen = RES } = {}) {
  const f = crearAdminFalso();
  if (config) f.store.set('odt_afinia_config/cumplimiento', config);
  const registro = [];
  let ahora = Date.UTC(2026, 10, 21, 16, 0, 0);
  const deps = crearDepsCumplimiento({ db: f.db, FieldValue, ahora: () => new Date(ahora) });
  deps.esperar = async () => {};
  const resumen = crearOperacionesResumen({ db: f.db, FieldValue, logica: logicaResumen });
  let k = 0;
  const depsScript = crearDepsRemitente({
    db: f.db, FieldValue, logica: R, verificarToken: async () => payload(ahora), ahora: () => new Date(ahora),
    nuevoPrestamo: () => 'prestamo' + String(++k).padStart(16, '0'), resumen, log: (...a) => registro.push(a)
  });
  const llamar = (cuerpo) => R.atenderRemitente({ metodo: 'POST', tipo: 'application/json', autorizacion: 'Bearer ' + 'x'.repeat(40), cuerpo }, depsScript);
  /** Un turno del script: pide, «envía» (salvo los que `falla` rechace) y reporta; devuelve lo prestado. */
  async function script({ falla = () => '', responder = true } = {}) {
    const r = await llamar({ accion: 'pendientes', cupo: 100 });
    assert.equal(r.status, 200);
    for (const c of r.cuerpo.correos) {
      const error = falla(c);
      if (responder) await llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: !error, error });
    }
    return r.cuerpo.correos;
  }
  return { f, deps, depsScript, resumen, registro, llamar, script, avanzar: (ms) => { ahora += ms; }, res: () => f.leer(RUTA_RESUMEN) };
}
const ms = (t) => RES.msDeMarca(t);
/** Un correo «en_envio» como lo deja el préstamo (para probar el resultado sin pasar por un corte). */
const correoPrestado = (id, nros, extra = {}) => ({
  corteId: id.split('_')[0], umbral: Number(id.split('_')[1]), responsable: RESP, responsableNorm: normalizarNombre(RESP), para: ['destino.uno@prueba.test'], cc: [],
  paraNombres: ['Persona Uno'], asunto: 'SGM · prueba', texto: 't', html: '', nros, estado: 'en_envio', error: '', errorPor: '', creadoEn: { ms: 1 }, encoladoEnMs: 1,
  intentos: 1, prestamo: 'prestamo' + id.slice(-12).replace(/_/g, 'x').padStart(16, '0'), prestamoHastaMs: Date.UTC(2030, 0, 1), reemplazadoPor: '', ...extra
});
const resultado = (llamar, c, ok = true, error = '') => llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok, error });

describe('la suma de cada envío, en la MISMA transacción', () => {
  test('un corte con ODT de 10, 16 y 26 días: tres correos enviados → 3 notificaciones (una por umbral) y 3 ODT', async () => {
    const { f, deps, script, res } = preparar();
    sembrarCorte(f, ID(1), { odts: [odt('90000801', { dias: 10 }), odt('90000802', { dias: 16 }), odt('90000803', { dias: 26 }), odt('90000804', { dias: 3 })] });
    await procesarCorteCumplimiento(ID(1), deps);
    assert.equal(res(), undefined, 'en cola todavía no cuenta');
    await script();
    const x = res();
    assert.deepEqual([x.enviados, x.porUmbral, x.odtAvisadas], [3, { 10: 1, 15: 1, 20: 1 }, 3]);
    assert.ok(Number.isFinite(ms(x.primerEnvioEn)) && Number.isFinite(ms(x.ultimoEnvioEn)) && Number.isFinite(ms(x.actualizadoEn)));
    assert.ok(ms(x.primerEnvioEn) < ms(x.ultimoEnvioEn), 'el primero y el último');
  });
  test('el correo y el resumen se confirman JUNTOS (nada cambia antes de confirmar la transacción)', async () => {
    const { f, llamar, res } = preparar();
    const c = { id: ID(2) + '_10', ...correoPrestado(ID(2) + '_10', ['90000811', '90000812']) };
    f.store.set('odt_afinia_correos/' + c.id, correoPrestado(c.id, c.nros));
    const vistos = [];
    f.ganchos.antesDeConfirmar = async () => { vistos.push([f.leer('odt_afinia_correos/' + c.id).estado, res()]); };
    const r = await resultado(llamar, c);
    f.ganchos.antesDeConfirmar = null;
    assert.deepEqual(r.cuerpo, { ok: true, registrado: true, estado: 'enviado' });
    assert.deepEqual(vistos[0], ['en_envio', undefined], 'justo antes de confirmar: ni el correo ni el resumen cambiaron');
    assert.equal(f.leer('odt_afinia_correos/' + c.id).estado, 'enviado');
    assert.deepEqual([res().enviados, res().odtAvisadas], [1, 2]);
  });
  test('el script REPITE el resultado (o lo informa con un préstamo viejo): no se cuenta dos veces; un error no suma', async () => {
    const { f, llamar, res } = preparar();
    const id = ID(3) + '_15';
    f.store.set('odt_afinia_correos/' + id, correoPrestado(id, ['90000821']));
    const c = { id, prestamo: correoPrestado(id, []).prestamo };
    assert.equal((await resultado(llamar, c)).cuerpo.estado, 'enviado');
    assert.equal((await resultado(llamar, c)).cuerpo.estado, 'repetido');
    assert.equal((await resultado(llamar, { id, prestamo: 'otroPrestamo0000000001' })).cuerpo.estado, 'repetido');
    assert.deepEqual([res().enviados, res().porUmbral['15'], res().odtAvisadas], [1, 1, 1]);
    const id2 = ID(4) + '_20';
    f.store.set('odt_afinia_correos/' + id2, correoPrestado(id2, ['90000822']));
    assert.equal((await resultado(llamar, { id: id2, prestamo: correoPrestado(id2, []).prestamo }, false, 'Invalid email: x')).cuerpo.estado, 'error');
    assert.deepEqual([res().enviados, res().porUmbral['20'], res().odtAvisadas], [1, 0, 1], 'un error no suma');
  });
  test('odtAvisadas sube SOLO la primera vez: un aviso mayor de una ODT ya avisada no la cuenta otra vez', async () => {
    const { f, deps, script, avanzar, res } = preparar();
    sembrarCorte(f, ID(5), { odts: [odt('90000831', { dias: 10 }), odt('90000832', { dias: 11 })] });
    await procesarCorteCumplimiento(ID(5), deps);
    await script();
    assert.deepEqual([res().enviados, res().odtAvisadas], [1, 2]);
    const primero = ms(res().primerEnvioEn);
    // Cinco días después (la MISMA ejecución): las dos llegan a 15 y 16, y aparece una nueva de 16.
    avanzar(5 * DIA_MS);
    sembrarCorte(f, ID(6), { odts: [odt('90000831', { dias: 10 }), odt('90000832', { dias: 11 }), odt('90000833', { dias: 11 })], sello: '20261126150000' });
    await procesarCorteCumplimiento(ID(6), deps);
    await script();
    const x = res();
    assert.deepEqual([x.enviados, x.porUmbral, x.odtAvisadas], [2, { 10: 1, 15: 1, 20: 0 }, 3], 'la 833 es nueva; la 831 y la 832 ya contaban');
    assert.equal(ms(x.primerEnvioEn), primero, 'el primer envío no cambia');
    assert.ok(ms(x.ultimoEnvioEn) > primero);
  });
  test('dos envíos que se CRUZAN con la misma ODT: la transacción se repite y la ODT cuenta una vez', async () => {
    const { f, depsScript, llamar, res } = preparar();
    const a = ID(7) + '_10'; const b = ID(8) + '_20';
    f.store.set('odt_afinia_correos/' + a, correoPrestado(a, ['90000841', '90000842']));
    f.store.set('odt_afinia_correos/' + b, correoPrestado(b, ['90000841', '90000843']));
    let cruzado = false;
    f.ganchos.antesDeConfirmar = async () => {
      if (cruzado) return;
      cruzado = true;
      // Mientras se confirma el de 10, otra llamada registra el de 20 (lee el resumen sin el de 10).
      await depsScript.cerrar(b, { prestamo: correoPrestado(b, []).prestamo, ok: true, error: '', marca: TS });
    };
    await resultado(llamar, { id: a, prestamo: correoPrestado(a, []).prestamo });
    f.ganchos.antesDeConfirmar = null;
    assert.deepEqual([res().enviados, res().porUmbral, res().odtAvisadas], [2, { 10: 1, 15: 0, 20: 1 }, 3], '841, 842 y 843: la 841 una sola vez');
  });
  test('el tope y después un «sí salió» tardío (mismo préstamo): suma una vez', async () => {
    const { f, llamar, res } = preparar();
    const id = ID(9) + '_10';
    f.store.set('odt_afinia_correos/' + id, correoPrestado(id, ['90000851'], { estado: 'error', error: R.TEXTO_TOPE, errorPor: 'tope' }));
    const c = { id, prestamo: correoPrestado(id, []).prestamo };
    assert.equal((await resultado(llamar, c)).cuerpo.estado, 'enviado');
    assert.equal((await resultado(llamar, c)).cuerpo.estado, 'repetido');
    assert.deepEqual([res().enviados, res().odtAvisadas], [1, 1]);
  });
  test('si la suma falla, el envío se registra IGUAL (no se vuelve a mandar) y el resumen queda «porRecalcular»', async () => {
    const roto = { ...RES, sumarEnvio: () => { throw new Error('consulta de prueba rota'); } };
    const { f, llamar, registro, res } = preparar({ logicaResumen: roto });
    const id = ID(10) + '_10';
    f.store.set('odt_afinia_correos/' + id, correoPrestado(id, ['90000861']));
    f.store.set('odt_afinia_avisos/' + idAviso('90000861', 10), { nro: '90000861', umbral: 10, estado: 'reservado', correoId: id });
    const r = await resultado(llamar, { id, prestamo: correoPrestado(id, []).prestamo });
    assert.deepEqual(r.cuerpo, { ok: true, registrado: true, estado: 'enviado' });
    assert.equal(f.leer('odt_afinia_correos/' + id).estado, 'enviado');
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000861', 10)).estado, 'enviado');
    assert.equal(res().porRecalcular, true);
    assert.equal(res().enviados, undefined, 'sin sumar (lo corrige el recálculo)');
    assert.ok(registro.some(([nivel, msg]) => nivel === 'error' && /Resumen de notificaciones/.test(msg)));
  });
  test('la consulta de lo ya enviado: estado «enviado» + nros «array-contains-any» por tandas de 30, solo el campo nros, DENTRO de la transacción', async () => {
    const { f, llamar } = preparar();
    // Con un resumen que ya existe y está al día (sin él, se calcula entero: ver «corrector ronda 1» abajo).
    f.store.set(RUTA_RESUMEN, { enviados: 0, porUmbral: { 10: 0, 15: 0, 20: 0 }, odtAvisadas: 0, porRecalcular: false });
    const nros = Array.from({ length: 45 }, (_, i) => String(90000900 + i));
    const id = ID(11) + '_10';
    f.store.set('odt_afinia_correos/' + id, correoPrestado(id, nros));
    await resultado(llamar, { id, prestamo: correoPrestado(id, []).prestamo });
    const qs = f.consultas.filter((q) => q.enTransaccion && q.filtros.some((x) => x.op === 'array-contains-any'));
    assert.equal(qs.length, 2, '45 N.º → 30 + 15');
    assert.deepEqual(qs[0].filtros.map((x) => [x.t, x.campo || x.campos, x.op, Array.isArray(x.v) ? x.v.length : x.v]),
      [['where', 'estado', '==', 'enviado'], ['where', 'nros', 'array-contains-any', 30], ['select', ['nros'], undefined, undefined]]);
    assert.equal(RES.LOTE_CONTIENE, 30);
  });
});

describe('el recálculo (reproceso) desde los correos enviados', () => {
  test('corrige un resumen equivocado: cuenta solo los enviados, por umbral, las ODT distintas y el primero y el último', async () => {
    const { f, resumen, res } = preparar();
    const env = (id, u, nros, msEnvio) => f.store.set('odt_afinia_correos/' + id + '_' + u, { corteId: id, umbral: u, estado: 'enviado', nros, enviadoEn: { ms: msEnvio }, creadoEn: { ms: 1 } });
    env(ID(20), 10, ['90000871', '90000872'], 3000);
    env(ID(21), 15, ['90000871', '90000873'], 1000);
    env(ID(22), 20, ['90000874'], 5000);
    f.store.set('odt_afinia_correos/' + ID(23) + '_10', { corteId: ID(23), umbral: 10, estado: 'pendiente', nros: ['90000875'] });
    f.store.set('odt_afinia_correos/' + ID(24) + '_10', { corteId: ID(24), umbral: 10, estado: 'error', nros: ['90000876'] });
    f.store.set(RUTA_RESUMEN, { enviados: 99, porUmbral: { 10: 50 }, odtAvisadas: 7, porRecalcular: true });
    const r = await resumen.recalcular();
    assert.deepEqual(r, { enviados: 3, porUmbral: { 10: 1, 15: 1, 20: 1 }, odtAvisadas: 4 });
    const x = res();
    assert.deepEqual([x.enviados, x.odtAvisadas, ms(x.primerEnvioEn), ms(x.ultimoEnvioEn), x.porRecalcular], [3, 4, 1000, 5000, false]);
    assert.ok(Number.isFinite(ms(x.actualizadoEn)));
  });
  test('lee por PÁGINAS (con cursor) y sin ningún enviado deja todo en cero', async () => {
    const { f, resumen, res } = preparar({ logicaResumen: { ...RES, PAGINA_RECALCULO: 2 } });
    for (let i = 0; i < 5; i++) f.store.set('odt_afinia_correos/' + ID(30 + i) + '_10', { umbral: 10, estado: 'enviado', nros: ['9000088' + i], enviadoEn: { ms: 100 + i } });
    const r = await resumen.recalcular();
    assert.deepEqual([r.enviados, r.odtAvisadas], [5, 5]);
    const pags = f.consultas.filter((q) => q.enTransaccion && q.filtros.some((x) => x.t === 'select' && x.campos.includes('enviadoEn')));
    assert.equal(pags.length, 3, '2 + 2 + 1');
    assert.ok(pags[1].filtros.some((x) => x.t === 'startAfter') && pags[2].filtros.some((x) => x.t === 'startAfter'));
    const vacio = preparar();
    await vacio.resumen.recalcular();
    assert.deepEqual([vacio.res().enviados, vacio.res().odtAvisadas, vacio.res().primerEnvioEn, vacio.res().ultimoEnvioEn], [0, 0, null, null]);
    assert.deepEqual([res().enviados, ms(res().primerEnvioEn), ms(res().ultimoEnvioEn)], [5, 100, 104]);
  });
  test('la suma de cada envío y el recálculo dicen LO MISMO (con fallos, reintentos y ODT repetidas)', async () => {
    const { f, deps, script, avanzar, resumen, res } = preparar();
    sembrarCorte(f, ID(40), { odts: [odt('90000891', { dias: 10 }), odt('90000892', { dias: 15 }), odt('90000893', { dias: 21 })] });
    await procesarCorteCumplimiento(ID(40), deps);
    await script({ falla: (c) => (c.id.endsWith('_15') ? 'Service invoked too many times for one day: email.' : '') });
    await procesarCorteCumplimiento(ID(40), deps, { origen: 'reproceso' });
    await script();
    avanzar(6 * DIA_MS);
    sembrarCorte(f, ID(41), { odts: [odt('90000891', { dias: 16 }), odt('90000894', { dias: 12 })], sello: '20261127150000' });
    await procesarCorteCumplimiento(ID(41), deps);
    await script();
    const suma = res();
    const recalculado = await resumen.recalcular();
    assert.deepEqual([suma.enviados, suma.porUmbral, suma.odtAvisadas], [recalculado.enviados, recalculado.porUmbral, recalculado.odtAvisadas]);
    assert.deepEqual([suma.enviados, suma.odtAvisadas], [5, 4]);
  });
});

describe('cada correo nuevo: a quién (nombres), con qué datos y de qué responsable', () => {
  test('paraNombres (de config.para[].nombre), datosDel (en llano) y responsableNorm; también al re-armarse', async () => {
    const { f, deps } = preparar();
    sembrarCorte(f, ID(50), { odts: [odt('90000901', { dias: 12 })] });
    await procesarCorteCumplimiento(ID(50), deps);
    const c = f.leer('odt_afinia_correos/' + idCorreo(ID(50), 10));
    assert.deepEqual(c.paraNombres, ['Persona Uno', 'Persona Dos']);
    assert.equal(c.datosDel, '21/11/2026 10:00');
    assert.equal(c.responsableNorm, normalizarNombre(RESP));
    f.store.set('odt_afinia_config/cumplimiento', { ...CONFIG, para: [{ correo: 'destino.tres@prueba.test', nombre: 'Persona Tres' }] });
    await procesarCorteCumplimiento(ID(50), deps, { origen: 'reproceso' });
    assert.deepEqual(f.leer('odt_afinia_correos/' + idCorreo(ID(50), 10)).paraNombres, ['Persona Tres'], 'en cola, se re-arma con la configuración de hoy');
  });
});

describe('corrector 99 §236: la cola del script', () => {
  test('la más vieja primero y SOLO la del responsable configurado, aunque haya más de 50 de otro responsable', async () => {
    const { f, script } = preparar();
    for (let i = 0; i < 60; i++) {
      f.store.set('odt_afinia_correos/' + 'Otro' + String(i).padStart(16, '0') + '_10', { ...correoPrestado('X_10', ['90000950']), estado: 'pendiente', responsable: 'OTRA PERSONA FICTICIA', responsableNorm: 'OTRA PERSONA FICTICIA', creadoEn: { ms: i } });
    }
    for (const [k, creado] of [[61, 300], [62, 100], [63, 200]]) {
      f.store.set('odt_afinia_correos/' + ID(k) + '_10', { ...correoPrestado(ID(k) + '_10', ['900009' + k]), estado: 'pendiente', creadoEn: { ms: creado }, encoladoEnMs: creado });
    }
    const ops = crearOperacionesCola({ db: f.db, FieldValue });
    const cola = await ops.listarCola(50, ['pendiente', 'en_envio'], { responsableNorm: normalizarNombre(CONFIG.responsable) });
    const delResp = cola.filter((c) => c.responsableNorm === normalizarNombre(RESP));
    assert.deepEqual(delResp.map((c) => c.id), [ID(62) + '_10', ID(63) + '_10', ID(61) + '_10'], 'del responsable y la más vieja primero');
    assert.ok(cola.length <= 100, 'como mucho dos veces el límite');
    const turno = await script({ responder: false });
    assert.deepEqual(turno.map((c) => c.id), [ID(62) + '_10', ID(63) + '_10', ID(61) + '_10'], 'el script recibe los del responsable aunque haya 60 de otro en cola');
    const qs = f.consultas.filter((q) => q.col === 'odt_afinia_correos' && !q.enTransaccion);
    assert.ok(qs.some((q) => q.filtros[0].campo === 'responsableNorm'), 'la del responsable');
  });
  test('corrector ronda 1: un correo de las fases anteriores (SIN responsableNorm) en cola sale con el script', async () => {
    const { f, script, res } = preparar();
    const viejo = ID(64) + '_10';
    const { responsableNorm, paraNombres, ...sinCampos } = correoPrestado(viejo, ['90000964']);
    f.store.set('odt_afinia_correos/' + viejo, { ...sinCampos, estado: 'pendiente', creadoEn: { ms: 5 }, encoladoEnMs: 5 });
    f.store.set('odt_afinia_avisos/' + idAviso('90000964', 10), { nro: '90000964', umbral: 10, estado: 'reservado', correoId: viejo });
    const turno = await script();
    assert.deepEqual(turno.map((c) => c.id), [viejo]);
    assert.equal(f.leer('odt_afinia_correos/' + viejo).estado, 'enviado');
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000964', 10)).estado, 'enviado', 'su aviso no queda «reservado» para siempre');
    assert.deepEqual([res().enviados, res().odtAvisadas], [1, 1]);
  });
  test('corrector ronda 1: y un corte más reciente lo retira de la cola (sus avisos los toma ese corte)', async () => {
    const { f, deps, script } = preparar();
    const viejo = ID(65) + '_10';
    const { responsableNorm, paraNombres, ...sinCampos } = correoPrestado(viejo, ['90000965']);
    f.store.set('odt_afinia_correos/' + viejo, { ...sinCampos, estado: 'pendiente', creadoEn: { ms: 5 }, encoladoEnMs: 5 });
    f.store.set('odt_afinia_avisos/' + idAviso('90000965', 10), { nro: '90000965', umbral: 10, estado: 'reservado', correoId: viejo });
    sembrarCorte(f, ID(66), { odts: [odt('90000965', { dias: 12 })], sello: '20261122150000' });
    const r = await procesarCorteCumplimiento(ID(66), deps);
    assert.equal(r.reemplazados, 1);
    assert.deepEqual([f.leer('odt_afinia_correos/' + viejo).estado, f.leer('odt_afinia_correos/' + viejo).reemplazadoPor], ['error', ID(66)]);
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000965', 10)).correoId, idCorreo(ID(66), 10));
    assert.deepEqual((await script()).map((c) => c.id), [idCorreo(ID(66), 10)], 'sale el del corte nuevo, no el viejo');
  });
});

describe('corrector ronda 1: el resumen se calcula entero si no existe o quedó «porRecalcular»', () => {
  test('ya había correos enviados (de antes del resumen): el primer envío nuevo cuenta TODOS, no solo el suyo', async () => {
    const { f, llamar, res } = preparar();
    f.store.set('odt_afinia_correos/' + ID(70) + '_20', { corteId: ID(70), umbral: 20, estado: 'enviado', nros: ['90000971', '90000972'], enviadoEn: { ms: 1000 }, creadoEn: { ms: 1 } });
    const id = ID(71) + '_10';
    f.store.set('odt_afinia_correos/' + id, correoPrestado(id, ['90000972', '90000973']));
    await resultado(llamar, { id, prestamo: correoPrestado(id, []).prestamo });
    const x = res();
    assert.deepEqual([x.enviados, x.porUmbral, x.odtAvisadas, x.porRecalcular], [2, { 10: 1, 15: 0, 20: 1 }, 3, false], 'el viejo y el nuevo; la 972 una vez');
    assert.equal(ms(x.primerEnvioEn), 1000, 'el primero es el viejo');
    assert.ok(ms(x.ultimoEnvioEn) > 1000);
  });
  test('una suma que falló deja «porRecalcular»: el envío siguiente lo corrige solo (y quita la marca)', async () => {
    const roto = { ...RES, sumarEnvio: () => { throw new Error('falla de prueba'); } };
    const p = preparar({ logicaResumen: roto });
    const a = ID(72) + '_10';
    p.f.store.set('odt_afinia_correos/' + a, correoPrestado(a, ['90000981']));
    await resultado(p.llamar, { id: a, prestamo: correoPrestado(a, []).prestamo });
    assert.deepEqual([p.res().porRecalcular, p.res().enviados], [true, undefined]);
    // El envío siguiente, ya con la lógica sana.
    const sano = crearOperacionesResumen({ db: p.f.db, FieldValue, logica: RES });
    const deps = crearDepsRemitente({ db: p.f.db, FieldValue, logica: R, verificarToken: async () => payload(Date.UTC(2026, 10, 21, 16)), ahora: () => new Date(Date.UTC(2026, 10, 21, 16)), resumen: sano });
    const b = ID(73) + '_15';
    p.f.store.set('odt_afinia_correos/' + b, correoPrestado(b, ['90000981', '90000982']));
    const llamar = (cuerpo) => R.atenderRemitente({ metodo: 'POST', tipo: 'application/json', autorizacion: 'Bearer ' + 'x'.repeat(40), cuerpo }, deps);
    await resultado(llamar, { id: b, prestamo: correoPrestado(b, []).prestamo });
    const x = p.res();
    assert.deepEqual([x.enviados, x.porUmbral, x.odtAvisadas, x.porRecalcular], [2, { 10: 1, 15: 1, 20: 0 }, 2, false]);
  });
  test('un error PASAJERO al sumar (UNAVAILABLE) repite la transacción y suma; uno sin código va al respaldo', async () => {
    let fallas = 1;
    const pasajero = { ...RES, nrosDistintos: (xs) => { if (fallas-- > 0) { const e = new Error('14 UNAVAILABLE: de prueba'); e.code = 14; throw e; } return RES.nrosDistintos(xs); } };
    const { f, llamar, registro, res } = preparar({ logicaResumen: pasajero });
    f.store.set(RUTA_RESUMEN, { enviados: 3, porUmbral: { 10: 3, 15: 0, 20: 0 }, odtAvisadas: 3, porRecalcular: false });
    const id = ID(74) + '_20';
    f.store.set('odt_afinia_correos/' + id, correoPrestado(id, ['90000991']));
    await resultado(llamar, { id, prestamo: correoPrestado(id, []).prestamo });
    assert.deepEqual([res().enviados, res().porUmbral['20'], res().odtAvisadas, res().porRecalcular], [4, 1, 4, false], 'se repitió y sumó');
    assert.ok(!registro.some(([nivel, msg]) => nivel === 'error' && /Resumen de notificaciones/.test(msg)), 'sin pasar por el respaldo');
    const ops = crearOperacionesResumen({ db: f.db, FieldValue, logica: { ...RES, nrosDistintos: () => { const e = new Error('9 FAILED_PRECONDITION: falta un índice'); e.code = 9; throw e; } } });
    await assert.rejects(f.db.runTransaction((t) => ops.preparar(t, { id: 'x', correo: { umbral: 10, nros: ['1'] }, marca: TS })), (e) => e.deResumen === true && e.code === 9);
  });
});

describe('corrector ronda 1: «Con error» y el orden de la tabla', () => {
  test('los correos en «error» de cortes ANTERIORES quedan reemplazados por el corte más reciente (conservan su motivo)', async () => {
    const { f, deps, script } = preparar();
    sembrarCorte(f, ID(80), { odts: [odt('90000801', { dias: 21 }), odt('90000802', { dias: 11 })] });
    await procesarCorteCumplimiento(ID(80), deps);
    await script({ falla: () => 'Service invoked too many times for one day: email.' });
    const viejo20 = f.leer('odt_afinia_correos/' + idCorreo(ID(80), 20));
    assert.deepEqual([viejo20.estado, viejo20.reemplazadoPor], ['error', '']);
    // Un correo viejo (de las fases anteriores: sin responsableNorm) en «error», del mismo responsable.
    f.store.set('odt_afinia_correos/' + ID(81) + '_15', { corteId: ID(81), umbral: 15, estado: 'error', error: 'falla vieja', reemplazadoPor: '', responsable: RESP, nros: ['90000803'], creadoEn: { ms: 1 } });
    // Y uno de OTRO responsable, que no se toca.
    f.store.set('odt_afinia_correos/' + ID(82) + '_15', { corteId: ID(82), umbral: 15, estado: 'error', error: 'otra', reemplazadoPor: '', responsable: 'OTRA PERSONA FICTICIA', responsableNorm: 'OTRA PERSONA FICTICIA', nros: ['90000804'], creadoEn: { ms: 2 } });
    sembrarCorte(f, ID(83), { odts: [odt('90000801', { dias: 22 })], sello: '20261122150000' });
    await procesarCorteCumplimiento(ID(83), deps);
    for (const [id, motivo] of [[idCorreo(ID(80), 20), /cupo diario/], [idCorreo(ID(80), 10), /cupo diario/], [ID(81) + '_15', /falla vieja/]]) {
      const c = f.leer('odt_afinia_correos/' + id);
      assert.deepEqual([c.estado, c.reemplazadoPor], ['error', ID(83)], id);
      assert.match(c.error, motivo, 'conserva su motivo');
    }
    assert.equal(f.leer('odt_afinia_correos/' + ID(82) + '_15').reemplazadoPor, '', 'el de otro responsable no se toca');
    assert.equal(f.leer('odt_afinia_correos/' + idCorreo(ID(83), 20)).estado, 'pendiente', 'la 801 sale con el corte nuevo');
    // Lo que cuenta la tarjeta «Con error»: estado «error» y sin reemplazar.
    const conError = [...f.store.entries()].filter(([k, v]) => k.startsWith('odt_afinia_correos/') && v.estado === 'error' && v.reemplazadoPor === '');
    assert.deepEqual(conError.map(([k]) => k), ['odt_afinia_correos/' + ID(82) + '_15']);
  });
  test('un correo en «error» que se REABRE renueva creadoEn (la tabla, que ordena por él, lo pone arriba)', async () => {
    const { f, deps, script } = preparar();
    sembrarCorte(f, ID(84), { odts: [odt('90000811', { dias: 21 }), odt('90000812', { dias: 11 })] });
    await procesarCorteCumplimiento(ID(84), deps);
    await script({ falla: (c) => (c.id.endsWith('_20') ? 'falla de prueba' : '') });
    const antes = ms(f.leer('odt_afinia_correos/' + idCorreo(ID(84), 20)).creadoEn);
    const otro = ms(f.leer('odt_afinia_correos/' + idCorreo(ID(84), 10)).creadoEn);
    const r = await procesarCorteCumplimiento(ID(84), deps, { origen: 'reproceso' });
    assert.deepEqual(r.reabiertos, [20]);
    const despues = ms(f.leer('odt_afinia_correos/' + idCorreo(ID(84), 20)).creadoEn);
    assert.ok(despues > antes && despues > otro, 'más nuevo que el primer intento y que el de 10 días, que ya salió');
  });
});

describe('corrector 99 §236: token válido de la cuenta remitente, configuración inválida', () => {
  test('igual registra ultimaConexionEn y el último resultado en llano (sin_config); la respuesta sigue siendo 403', async () => {
    const { f, llamar } = preparar({ config: { ...CONFIG, para: [] } });
    const r = await llamar({ accion: 'pendientes' });
    assert.deepEqual([r.status, r.cuerpo.error], [403, 'sin_config']);
    const e = f.leer('odt_afinia_config/cumplimiento_script');
    assert.ok(Number.isFinite(ms(e.ultimaConexionEn)));
    assert.equal(e.ultimoResultado, R.TEXTO_ESTADO.sinConfig);
    assert.match(R.TEXTO_ESTADO.sinConfig, /^Se conectó, pero la configuración de los avisos no es válida/);
    assert.ok(!('audienciaVista' in e), 'no deja un pedido de aprobación');
  });
});

describe('el cableado (functions/index.js) y los índices', () => {
  const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const idx = codigo(readFileSync(new URL('../index.js', import.meta.url), 'utf8'));
  test('la función del script recibe el resumen; el reproceso lo recalcula DESPUÉS de procesar y sin romperse si falla', () => {
    assert.match(idx, /import \* as RESUMEN from '\.\/domain\/odt_afinia_cumplimiento_resumen\.js';/);
    assert.match(idx, /import \{ crearOperacionesResumen \} from '\.\/cumplimiento_resumen\.mjs';/);
    assert.match(idx, /const resumenCumplimiento = \(\) => crearOperacionesResumen\(\{ db, FieldValue, logica: RESUMEN \}\);/);
    assert.match(idx, /crearDepsRemitente\(\{[^}]*resumen: resumenCumplimiento\(\) \}\)/);
    const r = idx.slice(idx.indexOf('export const reprocesarAvisosCumplimiento = onCall('), idx.indexOf('const verificarTokenGoogle'));
    assert.ok(r.indexOf('procesarCorteCumplimiento(') < r.indexOf('resumenCumplimiento().recalcular()'));
    assert.match(r, /try \{ resultado\.resumen = await resumenCumplimiento\(\)\.recalcular\(\); \} catch \(e\) \{/);
  });
  test('índices compuestos: la cola (responsableNorm ↑ · estado ↑ · creadoEn ↑) y lo ya enviado (estado ↑ · nros CONTAINS)', () => {
    const j = JSON.parse(readFileSync(new URL('../../firestore.indexes.json', import.meta.url), 'utf8'));
    const de = (col) => j.indexes.filter((x) => x.collectionGroup === col).map((x) => x.fields.map((y) => y.fieldPath + ':' + (y.order || y.arrayConfig)).join(' · '));
    assert.deepEqual(de('odt_afinia_correos').sort(), ['estado:ASCENDING · nros:CONTAINS', 'responsableNorm:ASCENDING · estado:ASCENDING · creadoEn:ASCENDING',
      'estado:ASCENDING · creadoEn:ASCENDING'].sort(), 'corrector ronda 1: también la cola sin responsable (los correos viejos)');
    const fuente = codigo(readFileSync(new URL('../cumplimiento_remitente.mjs', import.meta.url), 'utf8'));
    assert.match(fuente, /col\.where\('responsableNorm', '==', responsableNorm\)/);
    assert.match(fuente, /\.where\('estado', 'in', \[\.\.\.estados\]\)\.orderBy\('creadoEn', 'asc'\)\.limit\(limite\)/);
  });
});
