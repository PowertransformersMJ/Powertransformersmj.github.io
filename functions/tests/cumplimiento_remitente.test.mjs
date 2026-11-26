// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — La función HTTPS avisosCorreoRemitente (99 §236) con DOBLES: el script de Google que envía
// ──────────────────────────────────────────────────────────────
// Sin red, sin emulador y sin Firestore real: la atención (domain/odt_afinia_cumplimiento_remitente.js) corre sobre los
// adaptadores de verdad (functions/cumplimiento_remitente.mjs) con un Firestore del Admin SDK EN MEMORIA y un
// verificador de token de mentira. Se prueba:
//   · la petición de Express: solo POST con JSON, respuesta JSON sin caché, «Allow: POST» en el 405, sin CORS;
//   · la aprobación: un script nuevo de la cuenta remitente recibe 403 y deja su aud en el estado; aprobado
//     (config.audienciaScript = aud), entra; un token de OTRA cuenta o inválido no escribe nada;
//   · el préstamo en la base: «en_envio» con su préstamo de 10 minutos; dos pedidos seguidos no prestan lo mismo; solo
//     el responsable de la configuración; con activo == false, nada;
//   · el resultado: con el préstamo vigente marca el correo y SUS avisos; repetido o con otro préstamo no cambia nada;
//   · el verificador de verdad (google-auth-library, con una clave hecha aquí y sus certificados de mentira): verifica
//     la firma, el vencimiento y el emisor, y NO exige el aud (lo compara el dominio).
// Datos INVENTADOS: correos @prueba.test, ids de cliente ficticios y N.º que empiezan por 9.
// Correr: node --test functions/tests/cumplimiento_remitente.test.mjs (desde la raíz del repositorio).
// ══════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import * as R from '../../assets/js/domain/odt_afinia_cumplimiento_remitente.js';
import { idAviso } from '../../assets/js/domain/odt_afinia_cumplimiento_avisos.js';
import { normalizarNombre } from '../../assets/js/domain/odt_afinia_indicadores.js';
import { crearDepsRemitente, crearVerificadorGoogle, responderHttp, idPrestamoAlAzar, crearOperacionesCola } from '../cumplimiento_remitente.mjs';
import { crearAdminFalso, FieldValue } from './firestore_admin_falso.mjs';

const AUD = '9000000001-ficticio0aprobado.apps.googleusercontent.com';
const NUEVO = '9000000002-ficticio0nuevo.apps.googleusercontent.com';
const RESP = 'RESPONSABLE FICTICIO DE AVISOS';
const CONFIG = {
  activo: true, remitente: 'remitente.sgm@prueba.test', responsable: RESP, audienciaScript: AUD,
  para: [{ correo: 'destino.uno@prueba.test', nombre: 'Persona Uno' }], cc: ['copia.uno@prueba.test']
};
const C1 = 'Cumplim0000000000001';
// Como lo deja el servidor (99 §236): con creadoEn (la cola sale la más vieja primero) y responsableNorm (la cola se
// consulta por el responsable normalizado).
const correoEnCola = (id, extra = {}) => {
  const c = {
    corteId: id.split('_')[0], umbral: Number(id.split('_')[1]), responsable: RESP, para: ['destino.uno@prueba.test'], cc: ['copia.uno@prueba.test'],
    asunto: 'SGM · asunto de prueba', texto: 'texto de prueba', html: '<p>html de prueba</p>', nros: ['90000901', '90000902'], estado: 'pendiente', error: '',
    creadoEn: { ms: 1 }, encoladoEnMs: 1, intentos: 0, prestamo: '', prestamoHastaMs: 0, ...extra
  };
  return { responsableNorm: normalizarNombre(c.responsable), ...c };
};

function preparar({ config = CONFIG, email = CONFIG.remitente, aud = AUD, tokenValido = true } = {}) {
  const f = crearAdminFalso();
  if (config) f.store.set('odt_afinia_config/cumplimiento', config);
  let ahora = Date.UTC(2026, 10, 26, 15, 0, 0);
  let k = 0;
  const verificados = [];
  const deps = crearDepsRemitente({
    db: f.db, FieldValue, logica: R, ahora: () => new Date(ahora),
    verificarToken: async (t) => {
      verificados.push(t);
      if (!tokenValido) throw new Error('Invalid token signature: ' + t);
      return { iss: 'https://accounts.google.com', aud, email, email_verified: true, exp: ahora / 1000 + 3000, iat: ahora / 1000 - 10 };
    },
    nuevoPrestamo: () => 'prestamo' + String(++k).padStart(16, '0')
  });
  const llamar = (cuerpo, extra = {}) => R.atenderRemitente({ metodo: 'POST', tipo: 'application/json', autorizacion: 'Bearer ' + 'x'.repeat(40), cuerpo, ...extra }, deps);
  return { f, deps, llamar, verificados, avanzar: (ms) => { ahora += ms; }, estado: () => f.leer('odt_afinia_config/cumplimiento_script') };
}

/** Una respuesta de Express de mentira. */
function resFalsa() {
  const r = { cabeceras: {}, codigo: 0, cuerpo: undefined };
  r.set = (k, v) => { r.cabeceras[k] = v; return r; };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (x) => { r.cuerpo = x; return r; };
  return r;
}

describe('la petición de Express (responderHttp)', () => {
  test('solo POST con JSON; respuesta JSON sin caché; 405 con «Allow: POST»; sin cabeceras de CORS', async () => {
    const { deps } = preparar();
    const atender = (sol) => R.atenderRemitente(sol, deps);
    const get = resFalsa();
    await responderHttp({ method: 'GET', get: () => '', body: undefined }, get, atender);
    assert.deepEqual([get.codigo, get.cabeceras.Allow, get.cabeceras['Cache-Control'], get.cuerpo.ok], [405, 'POST', 'no-store', false]);
    const texto = resFalsa();
    await responderHttp({ method: 'POST', get: (k) => (k === 'content-type' ? 'text/plain' : ''), body: 'hola' }, texto, atender);
    assert.equal(texto.codigo, 415);
    const sinToken = resFalsa();
    await responderHttp({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { accion: 'probar' } }, sinToken, atender);
    assert.deepEqual([sinToken.codigo, sinToken.cuerpo.error], [401, 'sin_token']);
    const ok = resFalsa();
    await responderHttp({ method: 'POST', get: (k) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(40) })[k] || '', body: { accion: 'probar' } }, ok, atender);
    assert.deepEqual([ok.codigo, ok.cuerpo.ok], [200, true]);
    for (const r of [get, texto, sinToken, ok]) assert.ok(!Object.keys(r.cabeceras).some((k) => /access-control/i.test(k)), 'sin CORS');
  });
});

describe('la identidad y la aprobación del script', () => {
  test('un script NUEVO de la cuenta remitente: 403 y su aud queda en el estado (para aprobarlo); aprobado, entra', async () => {
    const { f, llamar, estado } = preparar({ config: { ...CONFIG, audienciaScript: '' }, aud: NUEVO });
    const r = await llamar({ accion: 'probar' });
    assert.deepEqual([r.status, r.cuerpo.error], [403, 'sin_aprobar']);
    const e = estado();
    assert.equal(e.audienciaVista, NUEVO);
    assert.ok(e.vistaEn && e.ultimaConexionEn, 'con la hora del servidor');
    assert.equal(e.ultimoResultado, R.TEXTO_ESTADO.sinAprobar);
    // El administrador lo aprueba (la pantalla guarda audienciaScript = audienciaVista).
    f.store.set('odt_afinia_config/cumplimiento', { ...CONFIG, audienciaScript: e.audienciaVista });
    const ok = await llamar({ accion: 'probar' });
    assert.deepEqual([ok.status, ok.cuerpo.ok], [200, true]);
    assert.equal(estado().ultimoResultado, R.TEXTO_ESTADO.probar);
    assert.equal(estado().audienciaVista, NUEVO, 'lo visto se conserva (merge)');
  });
  test('otro script de la MISMA cuenta (aud distinto del aprobado): 403 y pide permiso; el aprobado sigue aprobado', async () => {
    const { llamar, estado } = preparar({ aud: NUEVO });
    assert.equal((await llamar({ accion: 'pendientes' })).status, 403);
    assert.equal(estado().audienciaVista, NUEVO);
  });
  test('un token de OTRA cuenta, uno inválido o sin configuración: 401/403 y NO escribe nada', async () => {
    for (const [op, status] of [[{ email: 'otra.cuenta@prueba.test' }, 403], [{ tokenValido: false }, 401], [{ config: null }, 403]]) {
      const { f, llamar } = preparar(op);
      const r = await llamar({ accion: 'pendientes' });
      assert.equal(r.status, status, JSON.stringify(op));
      assert.equal(f.leer('odt_afinia_config/cumplimiento_script'), undefined, 'sin rastro: ' + JSON.stringify(op));
    }
  });
});

describe('el préstamo y el resultado en la base', () => {
  test('«pendientes»: en «en_envio» con su préstamo de 10 minutos; un segundo pedido no presta lo mismo; al vencer, sí', async () => {
    const { f, llamar, avanzar, estado } = preparar();
    f.store.set('odt_afinia_correos/' + C1 + '_10', correoEnCola(C1 + '_10'));
    const r = await llamar({ accion: 'pendientes', cupo: 50 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.cuerpo.correos, [{ id: C1 + '_10', para: ['destino.uno@prueba.test'], cc: ['copia.uno@prueba.test'], asunto: 'SGM · asunto de prueba', texto: 'texto de prueba', html: '<p>html de prueba</p>', prestamo: 'prestamo0000000000000001' }]);
    const c = f.leer('odt_afinia_correos/' + C1 + '_10');
    assert.deepEqual([c.estado, c.prestamo, c.intentos], ['en_envio', 'prestamo0000000000000001', 1]);
    assert.equal(c.prestamoHastaMs, Date.UTC(2026, 10, 26, 15, 10, 0));
    assert.ok(c.prestadoEn);
    assert.match(estado().ultimoResultado, /se le entregaron 1\./);
    assert.deepEqual((await llamar({ accion: 'pendientes' })).cuerpo.correos, [], 'préstamo vigente');
    avanzar(R.PRESTAMO_MS);
    const otra = await llamar({ accion: 'pendientes' });
    assert.deepEqual(otra.cuerpo.correos.map((x) => x.prestamo), ['prestamo0000000000000002']);
    assert.equal(f.leer('odt_afinia_correos/' + C1 + '_10').intentos, 2);
  });
  test('solo lo del responsable de la configuración; con activo == false, nada (y no presta)', async () => {
    const { f, llamar } = preparar();
    f.store.set('odt_afinia_correos/' + C1 + '_15', correoEnCola(C1 + '_15', { responsable: 'OTRA PERSONA FICTICIA' }));
    assert.deepEqual((await llamar({ accion: 'pendientes' })).cuerpo.correos, []);
    const ina = preparar({ config: { ...CONFIG, activo: false } });
    ina.f.store.set('odt_afinia_correos/' + C1 + '_10', correoEnCola(C1 + '_10'));
    assert.deepEqual((await ina.llamar({ accion: 'pendientes' })).cuerpo, { ok: true, activo: false, correos: [] });
    assert.equal(ina.f.leer('odt_afinia_correos/' + C1 + '_10').estado, 'pendiente');
    // La consulta de la cola (corrector 99 §236): solo del responsable configurado (normalizado), por estado, la más
    // vieja primero, con límite (índice compuesto responsableNorm ↑ · estado ↑ · creadoEn ↑). Corrector ronda 1: y
    // otra igual sin el responsable (los correos de las fases anteriores no traen responsableNorm; índice estado ↑ ·
    // creadoEn ↑).
    const [q1, q2] = f.consultas.slice(-2);
    assert.deepEqual([q1.col, q2.col], ['odt_afinia_correos', 'odt_afinia_correos']);
    const cola = [{ t: 'where', campo: 'estado', op: 'in', v: ['pendiente', 'en_envio'] }, { t: 'orderBy', campo: 'creadoEn', dir: 'asc' }, { t: 'limit', n: R.CANDIDATOS_MAX }];
    assert.deepEqual(q1.filtros, [{ t: 'where', campo: 'responsableNorm', op: '==', v: normalizarNombre(RESP) }, ...cola]);
    assert.deepEqual(q2.filtros, cola);
  });
  test('«resultado» ok: el correo «enviado» y SUS avisos (solo los de ese correo); repetido o con otro préstamo no cambia nada', async () => {
    const { f, llamar } = preparar();
    f.store.set('odt_afinia_correos/' + C1 + '_10', correoEnCola(C1 + '_10'));
    for (const n of ['90000901', '90000902']) f.store.set('odt_afinia_avisos/' + idAviso(n, 10), { nro: n, umbral: 10, estado: 'reservado', correoId: C1 + '_10' });
    f.store.set('odt_afinia_avisos/' + idAviso('90000903', 10), { nro: '90000903', umbral: 10, estado: 'reservado', correoId: 'OtroCorte00000000000_10' });
    const [c] = (await llamar({ accion: 'pendientes' })).cuerpo.correos;
    const malo = await llamar({ accion: 'resultado', id: c.id, prestamo: 'otroPrestamo0000000001', ok: true });
    assert.deepEqual(malo.cuerpo, { ok: true, registrado: false, estado: 'prestamo_distinto' });
    assert.equal(f.leer('odt_afinia_correos/' + c.id).estado, 'en_envio');
    const r = await llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: true });
    assert.deepEqual(r.cuerpo, { ok: true, registrado: true, estado: 'enviado' });
    const x = f.leer('odt_afinia_correos/' + c.id);
    assert.deepEqual([x.estado, x.error], ['enviado', '']); assert.ok(x.enviadoEn);
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000901', 10)).estado, 'enviado');
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000902', 10)).estado, 'enviado');
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000903', 10)).estado, 'reservado', 'el de otro correo no se toca');
    const otra = await llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: false, error: 'tarde' });
    assert.deepEqual(otra.cuerpo, { ok: true, registrado: false, estado: 'repetido' }, 'nada se manda dos veces ni se des-envía');
    assert.equal(f.leer('odt_afinia_correos/' + c.id).estado, 'enviado');
    assert.deepEqual((await llamar({ accion: 'pendientes' })).cuerpo.correos, []);
  });
  test('«resultado» con error: el correo «error» con el motivo en llano; sus avisos reservados, «error»; no se vuelve a prestar', async () => {
    const { f, llamar, estado } = preparar();
    f.store.set('odt_afinia_correos/' + C1 + '_20', correoEnCola(C1 + '_20'));
    f.store.set('odt_afinia_avisos/' + idAviso('90000901', 20), { nro: '90000901', umbral: 20, estado: 'reservado', correoId: C1 + '_20' });
    const [c] = (await llamar({ accion: 'pendientes' })).cuerpo.correos;
    const r = await llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: false, error: 'Service invoked too many times for one day: email.' });
    assert.deepEqual(r.cuerpo, { ok: true, registrado: true, estado: 'error' });
    assert.match(f.leer('odt_afinia_correos/' + c.id).error, /^Se acabó el cupo diario/);
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000901', 20)).estado, 'error');
    assert.match(estado().ultimoResultado, /^Informó que no pudo enviar el correo de 20 días/);
    assert.deepEqual((await llamar({ accion: 'pendientes' })).cuerpo.correos, []);
  });
  test('corrector 99 §236: un «sí salió» DESPUÉS de que el propio script informó el error (mismo préstamo) no cambia nada', async () => {
    const { f, llamar } = preparar();
    f.store.set('odt_afinia_correos/' + C1 + '_10', correoEnCola(C1 + '_10'));
    f.store.set('odt_afinia_avisos/' + idAviso('90000901', 10), { nro: '90000901', umbral: 10, estado: 'reservado', correoId: C1 + '_10' });
    const [c] = (await llamar({ accion: 'pendientes' })).cuerpo.correos;
    assert.equal((await llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: false, error: 'Invalid email: x' })).cuerpo.estado, 'error');
    const despues = await llamar({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: true });
    assert.deepEqual(despues.cuerpo, { ok: true, registrado: false, estado: 'repetido' });
    assert.equal(f.leer('odt_afinia_correos/' + c.id).estado, 'error', 'sigue en «error»: el reproceso lo retoma');
    assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000901', 10)).estado, 'error', 'sus avisos no quedan «enviado»');
  });
  test('corrector 99 §236: marcar los avisos de un correo no pisa uno que OTRO proceso tomó entre la lectura y la escritura', async () => {
    for (const estado of ['error', 'enviado']) {
      const f = crearAdminFalso();
      const ops = crearOperacionesCola({ db: f.db, FieldValue });
      const ruta = 'odt_afinia_avisos/' + idAviso('90000901', 10);
      const otro = 'CorteNuevo0000000002_10';
      f.store.set(ruta, { nro: '90000901', umbral: 10, estado: 'reservado', correoId: C1 + '_10' });
      f.store.set('odt_afinia_avisos/' + idAviso('90000902', 10), { nro: '90000902', umbral: 10, estado: 'reservado', correoId: C1 + '_10' });
      // Justo antes de confirmar, un corte más reciente (otra función) toma el aviso 901 para su propio correo.
      let una = true;
      f.ganchos.antesDeConfirmar = () => { if (una) { una = false; f.store.set(ruta, { nro: '90000901', umbral: 10, estado: 'reservado', correoId: otro }); } };
      const n = await ops.marcarAvisosDeCorreo(C1 + '_10', { ids: [idAviso('90000901', 10), idAviso('90000902', 10)], estado });
      assert.equal(una, false, 'el cruce ocurrió');
      assert.equal(n, 1, estado + ': solo el que sigue siendo de ese correo');
      assert.deepEqual([f.leer(ruta).estado, f.leer(ruta).correoId], ['reservado', otro], estado + ': el tomado por el corte nuevo queda intacto');
      assert.equal(f.leer('odt_afinia_avisos/' + idAviso('90000902', 10)).estado, estado);
    }
  });
  test('el id de préstamo al azar tiene la forma que acepta el dominio', () => {
    const a = idPrestamoAlAzar(); const b = idPrestamoAlAzar();
    assert.ok(R.esPrestamo(a) && R.esPrestamo(b) && a !== b);
  });
});

describe('el verificador de verdad (google-auth-library, sin red)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
  const ahora = () => Math.floor(Date.now() / 1000);
  function token(payload, { clave = privateKey, kid = 'k1' } = {}) {
    const cab = b64({ alg: 'RS256', typ: 'JWT', kid });
    const cuerpo = b64(payload);
    return cab + '.' + cuerpo + '.' + sign('RSA-SHA256', Buffer.from(cab + '.' + cuerpo), clave).toString('base64url');
  }
  /** Un cliente de OAuth con los certificados de mentira (nunca va a la red). */
  function verificador() {
    const cliente = new OAuth2Client();
    cliente.getFederatedSignonCertsAsync = async () => ({ certs: { k1: pem }, format: 'PEM' });
    return crearVerificadorGoogle({ cliente });
  }
  const base = () => ({ iss: 'https://accounts.google.com', aud: NUEVO, email: 'remitente.sgm@prueba.test', email_verified: true, iat: ahora() - 10, exp: ahora() + 3000 });
  test('sin audience: la firma, el vencimiento y el emisor sí; el aud NO (cualquiera pasa: lo compara el dominio)', async () => {
    const v = verificador();
    const p = await v(token(base()));
    assert.equal(p.aud, NUEVO);
    assert.equal((await v(token({ ...base(), aud: 'cualquier-otro-aud' }))).aud, 'cualquier-otro-aud');
  });
  test('una firma de otra clave, un token vencido o de otro emisor: lanza', async () => {
    const v = verificador();
    const otra = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await assert.rejects(v(token(base(), { clave: otra })), /signature/i);
    await assert.rejects(v(token({ ...base(), iat: ahora() - 7200, exp: ahora() - 3600 })), /too late/i);
    await assert.rejects(v(token({ ...base(), iss: 'https://otro.prueba.test' })), /issuer/i);
    await assert.rejects(v(token(base(), { kid: 'k9' })), /No pem found/);
    await assert.rejects(v('no.es.un-token'));
  });
});
