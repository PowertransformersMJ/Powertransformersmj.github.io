// Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE · EL SCRIPT DE GOOGLE QUE ENVÍA (99 §236, decisión del 2026-11-26) ·
// DOMINIO PURO (domain/odt_afinia_cumplimiento_remitente.js), sin red ni base:
//   · la identidad del script: cabecera «Bearer», emisor de Google, no vencido, correo verificado e IGUAL al remitente
//     (sin mayúsculas), y su aud IGUAL al aprobado (vacío o distinto → «sin_aprobar», que sí deja rastro; otra cuenta,
//     no);
//   · el préstamo: solo del responsable de la configuración, en cola o con el préstamo vencido; al 5.º sin confirmar,
//     «tope»; el resultado: solo con el préstamo vigente, repetido no cambia nada, un «sí salió» tardío se cree;
//   · los errores de MailApp y el último resultado, en llano y recortados; lo que muestra la pantalla;
//   · la atención de una llamada con dobles mínimos: método, tipo, token, configuración, identidad, aprobación,
//     acciones; nunca lanza (500 en llano).
// Datos INVENTADOS: correos @prueba.test, ids de cliente ficticios, N.º que empiezan por 9.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../assets/js/domain/odt_afinia_cumplimiento_remitente.js';

const AUD = '9000000001-ficticio0aprobado.apps.googleusercontent.com';
const OTRO_AUD = '9000000002-ficticio0nuevo.apps.googleusercontent.com';
const AHORA = Date.UTC(2026, 10, 26, 15, 0, 0);
const CONFIG = {
  activo: true, remitente: 'Remitente.SGM@prueba.test', responsable: 'RESPONSABLE FICTICIO DE AVISOS', audienciaScript: AUD,
  para: [{ correo: 'destino.uno@prueba.test', nombre: 'Persona Uno' }], cc: []
};
const payload = (extra = {}) => ({ iss: 'https://accounts.google.com', aud: AUD, email: 'remitente.sgm@prueba.test', email_verified: true, exp: AHORA / 1000 + 3000, iat: AHORA / 1000 - 60, ...extra });

describe('la identidad del script', () => {
  test('el token sale de «Authorization: Bearer …» (y de nada más)', () => {
    const t = 'aaaa.' + 'b'.repeat(40) + '.c_c-c';
    assert.equal(R.tokenDeCabecera('Bearer ' + t), t);
    assert.equal(R.tokenDeCabecera('bearer  ' + t), t);
    for (const v of ['', 'Basic ' + t, t, 'Bearer ', 'Bearer corto', null, undefined, 'Bearer ' + t + ' extra']) assert.equal(R.tokenDeCabecera(v), '', String(v));
  });
  test('aprobado: emisor de Google, vigente, correo verificado e igual al remitente (sin mayúsculas) y aud aprobado', () => {
    assert.deepEqual(R.revisarIdentidad(payload(), CONFIG, AHORA), { ok: true, aud: AUD });
    assert.equal(R.revisarIdentidad(payload({ iss: 'accounts.google.com', email_verified: 'true' }), CONFIG, AHORA).ok, true);
  });
  test('rechazos SIN rastro (no es la cuenta remitente o el token no sirve)', () => {
    const casos = [
      [payload({ iss: 'https://otro.prueba.test' }), 'emisor'],
      [payload({ iss: 'googleapis.com' }), 'emisor'],
      [payload({ exp: AHORA / 1000 - 1 }), 'vencido'],
      [payload({ email_verified: false }), 'correo_sin_verificar'],
      [payload({ email: 'otra.cuenta@prueba.test' }), 'otro_correo'],
      [payload({ email: undefined }), 'otro_correo'],
      [null, 'token_invalido']
    ];
    for (const [p, motivo] of casos) {
      const r = R.revisarIdentidad(p, CONFIG, AHORA);
      assert.equal(r.ok, false); assert.equal(r.motivo, motivo); assert.ok(!r.remitente, motivo + ': no deja rastro');
    }
    assert.equal(R.revisarIdentidad(payload(), { ...CONFIG, remitente: '' }, AHORA).motivo, 'otro_correo');
  });
  test('la cuenta remitente con un script SIN aprobar (aud vacío en la configuración o distinto): «sin_aprobar» con el aud visto', () => {
    assert.deepEqual(R.revisarIdentidad(payload({ aud: OTRO_AUD }), CONFIG, AHORA), { ok: false, motivo: 'sin_aprobar', aud: OTRO_AUD, remitente: true });
    assert.deepEqual(R.revisarIdentidad(payload(), { ...CONFIG, audienciaScript: '' }, AHORA), { ok: false, motivo: 'sin_aprobar', aud: AUD, remitente: true });
    assert.equal(R.revisarIdentidad(payload({ aud: 'con espacio' }), CONFIG, AHORA).motivo, 'audiencia_invalida');
    assert.equal(R.revisarIdentidad(payload({ aud: [AUD] }), CONFIG, AHORA).motivo, 'audiencia_invalida', 'un aud que no es texto');
  });
});

describe('préstamo y resultado (decisiones puras)', () => {
  const c = (extra = {}) => ({ id: 'C'.repeat(20) + '_10', responsable: 'Responsable  Fictício de Avisos', estado: 'pendiente', intentos: 0, para: ['a@prueba.test'], cc: ['b@prueba.test'], ...extra });
  const op = { ahoraMs: AHORA, responsable: CONFIG.responsable };
  test('se presta lo del responsable (comparado normalizado), en cola o con el préstamo vencido; lo demás, no', () => {
    assert.equal(R.decidirPrestamo(c(), op), 'prestar');
    assert.equal(R.decidirPrestamo(c({ estado: 'en_envio', prestamoHastaMs: AHORA }), op), 'prestar', 'vencido justo ahora');
    assert.equal(R.decidirPrestamo(c({ estado: 'en_envio', prestamoHastaMs: AHORA + 1 }), op), 'no', 'préstamo vigente');
    for (const estado of ['enviado', 'error', 'otro']) assert.equal(R.decidirPrestamo(c({ estado }), op), 'no', estado);
    assert.equal(R.decidirPrestamo(c({ responsable: 'OTRA PERSONA FICTICIA' }), op), 'no');
    assert.equal(R.decidirPrestamo(null, op), 'no');
    assert.equal(R.decidirPrestamo(c({ intentos: R.TOPE_INTENTOS - 1 }), op), 'prestar');
    assert.equal(R.decidirPrestamo(c({ intentos: R.TOPE_INTENTOS }), op), 'tope', 'el sexto pedido ya no se presta');
    assert.equal(R.TOPE_INTENTOS, 5);
    assert.equal(R.destinatarios(c()), 2);
  });
  test('el préstamo: «en_envio» por 10 minutos con su id y un intento más; el tope: «error» en llano', () => {
    const marca = { ts: 1 };
    assert.deepEqual(R.cambiosPrestamo(c({ intentos: 2 }), { ahoraMs: AHORA, prestamo: 'p'.repeat(24), marca }),
      { estado: 'en_envio', prestamo: 'p'.repeat(24), prestamoHastaMs: AHORA + 10 * 60 * 1000, prestadoEn: marca, intentos: 3 });
    assert.equal(R.PRESTAMO_MS, 600000);
    assert.equal(R.cambiosTope().estado, 'error');
    assert.match(R.cambiosTope().error, /5 veces sin confirmar/);
  });
  test('el resultado: solo con el préstamo vigente; repetido o de otro préstamo no cambia nada; un «sí salió» tardío se cree', () => {
    const P = 'q'.repeat(24);
    assert.equal(R.decidirResultado(c({ estado: 'en_envio', prestamo: P }), { prestamo: P, ok: true }), 'enviado');
    assert.equal(R.decidirResultado(c({ estado: 'en_envio', prestamo: P }), { prestamo: P, ok: false }), 'error');
    assert.equal(R.decidirResultado(c({ estado: 'en_envio', prestamo: P }), { prestamo: 'r'.repeat(24), ok: true }), 'prestamo_distinto');
    assert.equal(R.decidirResultado(c({ estado: 'enviado', prestamo: P }), { prestamo: P, ok: false }), 'repetido', 'nada se manda dos veces');
    assert.equal(R.decidirResultado(c({ estado: 'error', prestamo: P }), { prestamo: P, ok: false }), 'repetido');
    assert.equal(R.decidirResultado(c({ estado: 'error', prestamo: P, ...R.cambiosTope() }), { prestamo: P, ok: true }), 'enviado', 'el tope: un «sí salió» tardío se cree');
    // Corrector 99 §236: un error que informó el PROPIO script no pasa a «enviado» con un «sí» posterior del mismo préstamo.
    assert.equal(R.decidirResultado(c({ estado: 'error', prestamo: P, ...R.cambiosResultado('error', { error: 'x' }) }), { prestamo: P, ok: true }), 'repetido');
    assert.equal(R.decidirResultado(c({ estado: 'error', prestamo: P }), { prestamo: P, ok: true }), 'repetido', 'sin saber de dónde vino el error, no se cree');
    assert.equal(R.decidirResultado(c({ estado: 'pendiente', prestamo: '' }), { prestamo: P, ok: true }), 'prestamo_distinto', 'devuelto a la cola por un reproceso');
    assert.equal(R.decidirResultado(null, { prestamo: P, ok: true }), 'no_existe');
    assert.deepEqual(R.cambiosResultado('enviado', { marca: 7 }), { estado: 'enviado', error: '', enviadoEn: 7 });
    assert.deepEqual(Object.keys(R.cambiosResultado('error', { error: 'x' })), ['estado', 'error', 'errorPor']);
    assert.equal(R.cambiosTope().errorPor, 'tope');
    assert.deepEqual(R.cambiosResultado('repetido', {}), {});
  });
  test('los errores de MailApp, en llano y recortados (≤ 300)', () => {
    assert.match(R.textoErrorScript('Service invoked too many times for one day: email.'), /^Se acabó el cupo diario/);
    assert.match(R.textoErrorScript('Invalid email: destino@prueba'), /^Google rechazó alguna dirección/);
    assert.match(R.textoErrorScript('falla rara de prueba'), /^El script de Google no pudo enviarlo: falla rara de prueba$/);
    assert.match(R.textoErrorScript(''), /no dijo por qué/);
    assert.ok(R.textoErrorScript('x'.repeat(5000)).length <= R.ERROR_MAX);
  });
  test('el último resultado, en llano', () => {
    const id = 'C'.repeat(20) + '_15';
    assert.equal(R.textoResultado(id, 'enviado'), 'Informó que envió el correo de 15 días.');
    assert.match(R.textoResultado(id, 'error', 'Invalid email: x'), /^Informó que no pudo enviar el correo de 15 días: Google rechazó/);
    assert.match(R.textoResultado(id, 'repetido'), /no cambia nada/);
    assert.match(R.textoPendientes(2, 0), /se le entregaron 2\./);
    assert.match(R.textoPendientes(0, 1), /no había ninguno.* 1 correo quedó en «No se pudo enviar»/);
  });
});

describe('lo que muestra la pantalla del script', () => {
  const f = (ms) => 'F' + ms;
  test('sin estado: nunca se ha conectado; ninguno aprobado; sin pedido de permiso', () => {
    assert.deepEqual(R.resumenEstadoScript(null, null, f), { conexion: 'Nunca se ha conectado', resultado: '—', aprobado: 'Ninguno todavía', pidePermiso: false, audiencia: '' });
  });
  test('un script pide permiso cuando su aud es distinto del aprobado; el aprobado, no', () => {
    const e = { audienciaVista: OTRO_AUD, vistaEnMs: 3, ultimaConexionEnMs: 4, ultimoResultado: R.TEXTO_ESTADO.sinAprobar };
    const r = R.resumenEstadoScript(e, CONFIG, f);
    assert.equal(r.pidePermiso, true); assert.equal(r.audiencia, OTRO_AUD); assert.equal(r.conexion, 'F4');
    assert.equal(r.aprobado, 'Sí (hay un script aprobado)');
    assert.equal(R.resumenEstadoScript({ ...e, audienciaVista: AUD }, CONFIG, f).pidePermiso, false);
    assert.equal(R.resumenEstadoScript({ ...e, audienciaVista: 'no válido' }, CONFIG, f).pidePermiso, false);
    assert.equal(R.TEXTO_PIDE_PERMISO, 'Hay un script de Google pidiendo permiso para enviar los avisos');
    assert.ok(!/contraseña de aplicación|SGM_CORREO_CLAVE/i.test(R.AYUDA_SCRIPT), 'ya no habla de la clave de Gmail');
    assert.ok(!/functions\/|README|\.md\b/.test(R.AYUDA_SCRIPT), 'sin rutas del repositorio (corrector 99 §236)');
  });
});

describe('la atención de una llamada (dobles mínimos)', () => {
  function deps({ config = CONFIG, verificar = async () => payload(), cola = [] } = {}) {
    const d = {
      estados: [], prestados: [], cerrados: [], marcados: [], registro: [],
      verificarToken: verificar,
      leerConfig: async () => config,
      guardarEstado: async (x) => { d.estados.push(x); },
      listarCola: async () => cola,
      prestar: async (id, o) => { d.prestados.push([id, o]); return { estado: 'prestado', correo: { id, para: ['a@prueba.test'], cc: [], asunto: 's', texto: 't', html: '', prestamo: o.prestamo } }; },
      cerrar: async (id, o) => { d.cerrados.push([id, o]); return { estado: o.ok ? 'enviado' : 'error', nros: ['90000001'], umbral: 10 }; },
      marcarAvisosDeCorreo: async (id, o) => { d.marcados.push([id, o]); },
      nuevoPrestamo: () => 'p'.repeat(24),
      marca: () => 'TS',
      ahora: () => new Date(AHORA),
      log: (...a) => d.registro.push(a)
    };
    return d;
  }
  const sol = (cuerpo, extra = {}) => ({ metodo: 'POST', tipo: 'application/json; charset=utf-8', autorizacion: 'Bearer ' + 'x'.repeat(30), cuerpo, ...extra });
  test('método, tipo y token: 405, 415 y 401 (sin tocar la base)', async () => {
    const d = deps();
    assert.equal((await R.atenderRemitente(sol({}, { metodo: 'GET' }), d)).status, 405);
    assert.equal((await R.atenderRemitente(sol({}, { tipo: 'text/plain' }), d)).status, 415);
    assert.equal((await R.atenderRemitente(sol({}, { autorizacion: '' }), d)).status, 401);
    const malo = deps({ verificar: async () => { throw new Error('Invalid token signature: ' + 'x'.repeat(30)); } });
    const r = await R.atenderRemitente(sol({ accion: 'pendientes' }), malo);
    assert.deepEqual([r.status, r.cuerpo.error], [401, 'token_invalido']);
    assert.ok(!JSON.stringify(malo.registro).includes('x'.repeat(30)), 'el token nunca va al registro');
    assert.equal(d.estados.length + malo.estados.length, 0);
  });
  test('sin configuración, o un token de otra cuenta: 403 y no escribe el estado', async () => {
    const sin = deps({ config: null });
    assert.deepEqual([(await R.atenderRemitente(sol({ accion: 'probar' }), sin)).status, sin.estados.length], [403, 0]);
    const otra = deps({ verificar: async () => payload({ email: 'otra.cuenta@prueba.test' }) });
    const r = await R.atenderRemitente(sol({ accion: 'pendientes' }), otra);
    assert.deepEqual([r.status, r.cuerpo.error, otra.estados.length], [403, 'identidad', 0]);
  });
  test('corrector 99 §236: a OTRA cuenta no se le dice si los avisos están configurados; a la remitente, sí', async () => {
    const otro = async () => payload({ email: 'otra.cuenta@prueba.test' });
    const respuestas = [];
    for (const config of [null, { ...CONFIG, para: [] }, CONFIG]) {
      const d = deps({ config, verificar: otro });
      const r = await R.atenderRemitente(sol({ accion: 'probar' }), d);
      respuestas.push(JSON.stringify([r.status, r.cuerpo]));
      assert.equal(d.estados.length, 0);
    }
    assert.equal(new Set(respuestas).size, 1, 'sin configuración, inválida o válida: la misma respuesta');
    assert.match(respuestas[0], /"identidad"/);
    const remitenteSinConfig = await R.atenderRemitente(sol({ accion: 'probar' }), deps({ config: { ...CONFIG, para: [] } }));
    assert.deepEqual([remitenteSinConfig.status, remitenteSinConfig.cuerpo.error], [403, 'sin_config']);
  });
  test('la cuenta remitente con un script sin aprobar: 403 «sin_aprobar» y el aud visto queda en el estado', async () => {
    const d = deps({ verificar: async () => payload({ aud: OTRO_AUD }) });
    const r = await R.atenderRemitente(sol({ accion: 'pendientes' }), d);
    assert.deepEqual([r.status, r.cuerpo.error], [403, 'sin_aprobar']);
    assert.match(r.cuerpo.mensaje, /Aprobar este script/);
    assert.equal(r.cuerpo.audiencia, OTRO_AUD, 'su propio aud: el script lo escribe en su registro para compararlo en SGM');
    assert.deepEqual(d.estados, [{ ultimaConexionEn: 'TS', ultimoResultado: R.TEXTO_ESTADO.sinAprobar, audienciaVista: OTRO_AUD, vistaEn: 'TS' }]);
    assert.equal(d.prestados.length, 0);
  });
  test('aprobado: «probar» responde 200; «pendientes» con activo == false, lista vacía; acción desconocida, 400; cada una deja rastro', async () => {
    const d = deps();
    const p = await R.atenderRemitente(sol({ accion: 'probar' }), d);
    assert.deepEqual([p.status, p.cuerpo.ok, p.cuerpo.audiencia], [200, true, AUD]);
    const ina = deps({ config: { ...CONFIG, activo: false }, cola: [{ id: 'C'.repeat(20) + '_10', estado: 'pendiente', responsable: CONFIG.responsable }] });
    const r = await R.atenderRemitente(sol({ accion: 'pendientes' }), ina);
    assert.deepEqual(r.cuerpo, { ok: true, activo: false, correos: [] });
    assert.equal(ina.prestados.length, 0);
    assert.equal((await R.atenderRemitente(sol({ accion: 'otra' }), d)).status, 400);
    assert.equal((await R.atenderRemitente(sol(null), d)).status, 400);
    assert.equal(d.estados.length, 3);
    assert.ok(d.estados.every((e) => e.ultimaConexionEn === 'TS' && typeof e.ultimoResultado === 'string' && !('audienciaVista' in e)));
  });
  test('«pendientes»: en orden de cola, hasta 10, dentro del cupo; los ajenos y los vigentes no', async () => {
    const id = (k, u) => String.fromCharCode(65 + k).repeat(20) + '_' + u;
    const cola = [
      ...Array.from({ length: 12 }, (_, k) => ({ id: id(k, 10), estado: 'pendiente', responsable: CONFIG.responsable, encoladoEnMs: 100 - k, umbral: 10, para: ['a@prueba.test'], cc: [] })),
      { id: id(20, 20), estado: 'pendiente', responsable: 'OTRA PERSONA FICTICIA', encoladoEnMs: 1, umbral: 20, para: ['a@prueba.test'], cc: [] },
      { id: id(21, 15), estado: 'en_envio', prestamoHastaMs: AHORA + 1000, responsable: CONFIG.responsable, encoladoEnMs: 1, umbral: 15, para: ['a@prueba.test'], cc: [] }
    ];
    const d = deps({ cola });
    const r = await R.atenderRemitente(sol({ accion: 'pendientes' }), d);
    assert.equal(r.cuerpo.correos.length, 10);
    assert.deepEqual(d.prestados.map(([x]) => x), Array.from({ length: 10 }, (_, k) => id(11 - k, 10)), 'el más viejo en la cola, primero');
    const conCupo = deps({ cola });
    assert.equal((await R.atenderRemitente(sol({ accion: 'pendientes', cupo: 3 }), conCupo)).cuerpo.correos.length, 3);
    const sinCupo = deps({ cola });
    assert.equal((await R.atenderRemitente(sol({ accion: 'pendientes', cupo: 0 }), sinCupo)).cuerpo.correos.length, 0);
  });
  test('«resultado»: valida id, préstamo y ok; marca los avisos según la decisión; nunca lanza (500 en llano)', async () => {
    const d = deps();
    const bien = { accion: 'resultado', id: 'C'.repeat(20) + '_10', prestamo: 'p'.repeat(24), ok: true };
    const r = await R.atenderRemitente(sol(bien), d);
    assert.deepEqual(r.cuerpo, { ok: true, registrado: true, estado: 'enviado' });
    assert.deepEqual(d.marcados, [['C'.repeat(20) + '_10', { ids: ['90000001_10'], estado: 'enviado' }]]);
    for (const mal of [{ ...bien, id: '../x' }, { ...bien, prestamo: 'corto' }, { ...bien, ok: 'si' }]) assert.equal((await R.atenderRemitente(sol(mal), d)).status, 400);
    const roto = deps(); roto.cerrar = async () => { throw new Error('falla de la base de prueba'); };
    const x = await R.atenderRemitente(sol(bien), roto);
    assert.deepEqual([x.status, x.cuerpo.error], [500, 'interno']);
  });
});
