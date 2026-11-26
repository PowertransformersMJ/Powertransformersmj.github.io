// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — El script de Google que envía los avisos (functions/apps-script/avisos-cumplimiento.gs, 99 §236)
// ──────────────────────────────────────────────────────────────
// El .gs se carga en un contexto vm de Node con DOBLES de UrlFetchApp, MailApp, ScriptApp, PropertiesService, Logger y
// Utilities (sin Google ni red). Se prueba:
//   · enviarPendientes manda cada pendiente con MailApp (para, copia, asunto, texto, HTML y el nombre «SGM ·
//     TRANSPOWER») y reporta ok o el error de cada uno, con su id y su préstamo;
//   · con cupo 0 no pide nada ni envía; con poco cupo, para antes del correo que no cabe (sin reportarlo);
//   · si el servidor responde 403 (script sin aprobar) o falla la red, no revienta ni envía;
//   · si un resultado no se puede reportar, se guarda y se reporta al comienzo del turno siguiente, ANTES de pedir más;
//   · corrector 99 §236: el resultado se guarda ANTES de reportarlo (si Google corta la ejecución mientras reporta, no
//     se pierde y el correo no se vuelve a mandar); una ejecución a la vez (LockService); no empieza un envío después
//     de 4 minutos de turno; si la plataforma no recibe un resultado, no envía más en ese turno;
//   · instalar() borra SOLO sus disparadores de enviarPendientes y crea uno cada 10 minutos, y se conecta una vez;
//   · probarConexion() escribe en el registro qué respondió la plataforma y el identificador de este script.
// Datos INVENTADOS: correos @prueba.test. Correr: node --test functions/tests/apps_script.test.mjs
// ══════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODIGO = readFileSync(new URL('../apps-script/avisos-cumplimiento.gs', import.meta.url), 'utf8');

/**
 * Un Google Apps Script de mentira.
 * @param {{cupo?:number, servidor?:(cuerpo:object)=>{codigo:number, datos?:any}|Error, enviar?:(o:object)=>void, disparadores?:string[],
 *          dormir?:(ms:number)=>void, ocupado?:boolean, reloj?:()=>number}} p
 *   dormir: lo que hace Utilities.sleep (puede lanzar: así se corta la ejecución) · ocupado: el candado lo tiene otra
 *   ejecución · reloj: Date.now() del script
 */
function cargar({ cupo = 100, servidor = () => ({ codigo: 200, datos: { ok: true, correos: [] } }), enviar = () => {}, disparadores = [], dormir = () => {}, ocupado = false, reloj = () => 0 } = {}) {
  const llamadas = []; const enviados = []; const registro = []; const props = new Map(); const borrados = []; const creados = []; const esperas = [];
  const candado = { tomado: 0, soltado: 0 };
  let quedan = cupo;
  const ctx = {
    UrlFetchApp: {
      fetch: (url, op) => {
        const cuerpo = JSON.parse(op.payload);
        llamadas.push({ url, op, cuerpo });
        const r = servidor(cuerpo);
        if (r instanceof Error) throw r;
        return { getResponseCode: () => r.codigo, getContentText: () => (typeof r.datos === 'string' ? r.datos : JSON.stringify(r.datos)) };
      }
    },
    MailApp: {
      getRemainingDailyQuota: () => quedan,
      sendEmail: (o) => { enviar(o); enviados.push(o); quedan -= o.to.split(',').length + (o.cc ? o.cc.split(',').length : 0); }
    },
    ScriptApp: {
      getIdentityToken: () => 'token.de.prueba',
      getProjectTriggers: () => disparadores.map((h) => ({ getHandlerFunction: () => h })),
      deleteTrigger: (t) => { borrados.push(t.getHandlerFunction()); },
      newTrigger: (h) => {
        const d = { h };
        const b = { timeBased: () => b, everyMinutes: (n) => { d.min = n; return b; }, create: () => { creados.push(d); return d; } };
        return b;
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => { props.set(k, String(v)); },
        deleteProperty: (k) => { props.delete(k); }
      })
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => { if (ocupado) return false; candado.tomado++; return true; }, releaseLock: () => { candado.soltado++; } })
    },
    Logger: { log: (m) => registro.push(String(m)) },
    Utilities: { sleep: (ms) => { esperas.push(ms); dormir(ms); } },
    Date: { now: () => reloj() },
    JSON
  };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx, { filename: 'avisos-cumplimiento.gs' });
  return { ctx, llamadas, enviados, registro, props, borrados, creados, esperas, candado, cupo: () => quedan };
}
const C = (k, extra = {}) => ({ id: 'Cumplim000000000000' + k + '_10', para: ['destino.uno@prueba.test', 'destino.dos@prueba.test'], cc: ['copia.uno@prueba.test'], asunto: 'SGM · asunto ' + k, texto: 'texto ' + k, html: '<p>html ' + k + '</p>', prestamo: 'prestamo' + String(k).padStart(16, '0'), ...extra });
/** Un servidor de mentira: entrega `correos` al pedir pendientes y responde 200 a lo demás. */
const servidorCon = (correos, otro = () => ({ codigo: 200, datos: { ok: true, registrado: true } })) => (cuerpo) => (cuerpo.accion === 'pendientes' ? { codigo: 200, datos: { ok: true, activo: true, correos } } : otro(cuerpo));

describe('enviarPendientes', () => {
  test('manda cada pendiente con MailApp y reporta ok con su id y su préstamo; la llamada lleva el token y JSON', () => {
    const g = cargar({ servidor: servidorCon([C(1), C(2, { cc: [], html: '' })]) });
    const r = g.ctx.enviarPendientes();
    assert.deepEqual({ ...r }, { enviados: 2, fallidos: 0, sinReportar: 0 });
    assert.deepEqual(g.enviados.map((o) => ({ ...o })), [
      { to: 'destino.uno@prueba.test,destino.dos@prueba.test', cc: 'copia.uno@prueba.test', subject: 'SGM · asunto 1', body: 'texto 1', htmlBody: '<p>html 1</p>', name: 'SGM · TRANSPOWER' },
      { to: 'destino.uno@prueba.test,destino.dos@prueba.test', subject: 'SGM · asunto 2', body: 'texto 2', name: 'SGM · TRANSPOWER' }
    ], 'sin copia ni HTML vacíos');
    assert.deepEqual(g.llamadas.map((l) => l.cuerpo), [
      { accion: 'pendientes', cupo: 100 },
      { accion: 'resultado', id: C(1).id, prestamo: C(1).prestamo, ok: true, error: '' },
      { accion: 'resultado', id: C(2).id, prestamo: C(2).prestamo, ok: true, error: '' }
    ]);
    const op = g.llamadas[0].op;
    assert.equal(g.llamadas[0].url, 'https://southamerica-east1-lordpowertransformersmj.cloudfunctions.net/avisosCorreoRemitente');
    assert.deepEqual([op.method, op.contentType, op.headers.Authorization, op.muteHttpExceptions], ['post', 'application/json', 'Bearer token.de.prueba', true]);
  });
  test('si MailApp falla con uno, reporta ok:false con el mensaje y sigue con los demás', () => {
    const g = cargar({ servidor: servidorCon([C(1), C(2)]), enviar: (o) => { if (o.subject.endsWith('1')) throw new Error('Invalid email: destino@prueba'); } });
    const r = g.ctx.enviarPendientes();
    assert.deepEqual({ ...r }, { enviados: 1, fallidos: 1, sinReportar: 0 });
    assert.deepEqual(g.llamadas.slice(1).map((l) => [l.cuerpo.id, l.cuerpo.ok, l.cuerpo.error]), [[C(1).id, false, 'Invalid email: destino@prueba'], [C(2).id, true, '']]);
  });
  test('con cupo 0 no pide nada ni envía; con poco cupo, para antes del correo que no cabe (sin reportarlo)', () => {
    const cero = cargar({ cupo: 0, servidor: servidorCon([C(1)]) });
    cero.ctx.enviarPendientes();
    assert.equal(cero.llamadas.length, 0);
    assert.equal(cero.enviados.length, 0);
    assert.ok(cero.registro.some((m) => /Sin cupo/.test(m)));
    const poco = cargar({ cupo: 4, servidor: servidorCon([C(1), C(2)]) });
    poco.ctx.enviarPendientes();
    assert.equal(poco.llamadas[0].cuerpo.cupo, 4);
    assert.deepEqual(poco.enviados.map((o) => o.subject), ['SGM · asunto 1'], 'el segundo (3 destinatarios) ya no cabe en 1');
    assert.deepEqual(poco.llamadas.slice(1).map((l) => l.cuerpo.id), [C(1).id], 'el que no se envió no se reporta: su préstamo vence');
  });
  test('si el servidor responde 403 (sin aprobar) o no hay red, no revienta ni envía', () => {
    const g = cargar({ servidor: () => ({ codigo: 403, datos: { ok: false, error: 'sin_aprobar', mensaje: 'Este script todavía no está aprobado en SGM' } }) });
    assert.doesNotThrow(() => g.ctx.enviarPendientes());
    assert.equal(g.enviados.length, 0);
    assert.ok(g.registro.some((m) => /403.*no está aprobado/.test(m)));
    const sinRed = cargar({ servidor: () => new Error('DNS error de prueba') });
    assert.doesNotThrow(() => sinRed.ctx.enviarPendientes());
    assert.equal(sinRed.enviados.length, 0);
    const raro = cargar({ servidor: () => ({ codigo: 200, datos: 'no es JSON' }) });
    assert.doesNotThrow(() => raro.ctx.enviarPendientes());
    assert.equal(raro.enviados.length, 0);
  });
  test('si un resultado no se puede reportar, se guarda y se reporta al comienzo del turno siguiente, ANTES de pedir más', () => {
    let caido = true;
    const g = cargar({ servidor: servidorCon([C(1)], () => (caido ? new Error('sin red de prueba') : { codigo: 200, datos: { ok: true, registrado: true } })) });
    const r = g.ctx.enviarPendientes();
    assert.deepEqual({ ...r }, { enviados: 1, fallidos: 0, sinReportar: 1 });
    assert.equal(g.esperas.length, 2, 'reintenta con pausas antes de guardarlo');
    assert.deepEqual(JSON.parse(g.props.get('sgm_resultados_sin_reportar')).map((x) => x.id), [C(1).id]);
    // Turno siguiente, todavía sin red para los resultados: no pide correos nuevos (así nada se manda dos veces).
    const antes = g.llamadas.length;
    g.ctx.enviarPendientes();
    assert.ok(g.llamadas.slice(antes).every((l) => l.cuerpo.accion === 'resultado'), 'no pide pendientes con resultados guardados');
    assert.equal(g.enviados.length, 1);
    // Vuelve la red: primero reporta lo guardado y después pide.
    caido = false;
    const desde = g.llamadas.length;
    g.ctx.enviarPendientes();
    assert.deepEqual(g.llamadas.slice(desde, desde + 2).map((l) => l.cuerpo.accion), ['resultado', 'pendientes']);
    assert.equal(g.props.has('sgm_resultados_sin_reportar'), false);
  });
  test('un resultado que la plataforma rechaza por su forma (400) no se reintenta para siempre; un 404 o un 500, sí', () => {
    const g = cargar({ servidor: servidorCon([C(1)], () => ({ codigo: 400, datos: { ok: false, error: 'resultado_invalido' } })) });
    g.ctx.enviarPendientes();
    assert.equal(g.props.has('sgm_resultados_sin_reportar'), false);
    for (const codigo of [404, 500, 403]) {
      const x = cargar({ servidor: servidorCon([C(1)], () => ({ codigo, datos: { ok: false } })) });
      x.ctx.enviarPendientes();
      assert.ok(x.props.has('sgm_resultados_sin_reportar'), codigo + ': se guarda para reportarlo después');
    }
  });
  test('corrector 99 §236: si Google CORTA la ejecución mientras reporta, el resultado ya quedó guardado y el turno siguiente lo reporta sin reenviar', () => {
    let corta = true;
    const registrados = new Set();
    // Un servidor con memoria: entrega lo que no tiene resultado registrado (como el préstamo de verdad, que no vuelve
    // a prestar lo enviado). Al principio no contesta los resultados (503) y, en la pausa entre reintentos, se acaba el
    // tiempo de la ejecución (Google lanza).
    const servidor = (cuerpo) => {
      if (cuerpo.accion === 'pendientes') return { codigo: 200, datos: { ok: true, activo: true, correos: [C(1), C(2)].filter((c) => !registrados.has(c.id)) } };
      if (corta) return { codigo: 503, datos: { ok: false } };
      registrados.add(cuerpo.id);
      return { codigo: 200, datos: { ok: true, registrado: true } };
    };
    const g = cargar({ servidor, dormir: () => { if (corta) throw new Error('Exceeded maximum execution time'); } });
    g.ctx.enviarPendientes();
    assert.deepEqual(g.enviados.map((o) => o.subject), ['SGM · asunto 1'], 'el segundo ya no se envía');
    assert.deepEqual(JSON.parse(g.props.get('sgm_resultados_sin_reportar')), [{ accion: 'resultado', id: C(1).id, prestamo: C(1).prestamo, ok: true, error: '' }], 'guardado ANTES de reportar');
    assert.equal(g.candado.soltado, 1, 'suelta el candado aunque se corte');
    // Turno siguiente, ya con la plataforma bien: primero reporta lo guardado (con su préstamo), después pide.
    corta = false;
    const desde = g.llamadas.length;
    g.ctx.enviarPendientes();
    assert.deepEqual(g.llamadas.slice(desde, desde + 2).map((l) => [l.cuerpo.accion, l.cuerpo.id || '']), [['resultado', C(1).id], ['pendientes', '']]);
    assert.equal(g.props.has('sgm_resultados_sin_reportar'), false, 'reportado: se borra de lo guardado');
    assert.deepEqual(g.enviados.map((o) => o.subject), ['SGM · asunto 1', 'SGM · asunto 2'], 'el 1 NO se manda dos veces');
  });
  test('corrector 99 §236: lo reportado bien no queda guardado; si la plataforma no recibe un resultado, no envía más en ese turno', () => {
    const bien = cargar({ servidor: servidorCon([C(1), C(2)]) });
    bien.ctx.enviarPendientes();
    assert.equal(bien.props.has('sgm_resultados_sin_reportar'), false);
    const mal = cargar({ servidor: servidorCon([C(1), C(2)], () => ({ codigo: 500, datos: { ok: false } })) });
    const r = mal.ctx.enviarPendientes();
    assert.deepEqual({ ...r }, { enviados: 1, fallidos: 0, sinReportar: 1 });
    assert.deepEqual(mal.enviados.map((o) => o.subject), ['SGM · asunto 1']);
    assert.ok(mal.registro.some((m) => /no se envía nada más en este turno/.test(m)));
  });
  test('corrector 99 §236: una ejecución a la vez (candado) y nada nuevo después de 4 minutos de turno', () => {
    const ocupado = cargar({ ocupado: true, servidor: servidorCon([C(1)]) });
    ocupado.ctx.enviarPendientes();
    assert.deepEqual([ocupado.llamadas.length, ocupado.enviados.length], [0, 0]);
    assert.ok(ocupado.registro.some((m) => /Otra ejecución/.test(m)));
    let ms = 0;
    const lento = cargar({ reloj: () => ms, servidor: servidorCon([C(1), C(2)]), enviar: () => { ms += 4 * 60 * 1000 + 1; } });
    lento.ctx.enviarPendientes();
    assert.deepEqual(lento.enviados.map((o) => o.subject), ['SGM · asunto 1'], 'el segundo queda para el próximo turno');
    assert.deepEqual(lento.llamadas.slice(1).map((l) => l.cuerpo.id), [C(1).id], 'el que no se envió no se reporta');
    assert.ok(lento.registro.some((m) => /Se acaba el tiempo de este turno/.test(m)));
    assert.deepEqual([lento.candado.tomado, lento.candado.soltado], [1, 1]);
  });
});

describe('instalar y probarConexion', () => {
  test('instalar borra SOLO sus disparadores de enviarPendientes, crea uno cada 10 minutos y se conecta una vez', () => {
    const g = cargar({ disparadores: ['enviarPendientes', 'otraFuncion', 'enviarPendientes'], servidor: () => ({ codigo: 403, datos: { ok: false, error: 'sin_aprobar', mensaje: 'Este script todavía no está aprobado en SGM' } }) });
    g.ctx.instalar();
    assert.deepEqual(g.borrados, ['enviarPendientes', 'enviarPendientes']);
    assert.deepEqual(g.creados.map((d) => ({ ...d })), [{ h: 'enviarPendientes', min: 10 }]);
    assert.deepEqual(g.llamadas.map((l) => l.cuerpo), [{ accion: 'probar' }]);
    assert.ok(g.registro.some((m) => /se creó uno que corre enviarPendientes cada 10 minutos/.test(m)));
    assert.ok(g.registro.some((m) => /respondió 403: Este script todavía no está aprobado/.test(m)));
  });
  test('probarConexion escribe en el registro qué respondió la plataforma (también sin red)', () => {
    const ok = cargar({ servidor: () => ({ codigo: 200, datos: { ok: true, mensaje: 'Conexión aprobada: el script puede enviar los avisos.' } }) });
    ok.ctx.probarConexion();
    assert.deepEqual(ok.registro, ['La plataforma respondió 200: Conexión aprobada: el script puede enviar los avisos.']);
    // Corrector 99 §236: si la plataforma devuelve el identificador del script (su propio aud), lo escribe para compararlo en SGM.
    const conId = cargar({ servidor: () => ({ codigo: 403, datos: { ok: false, error: 'sin_aprobar', mensaje: 'Este script todavía no está aprobado en SGM', audiencia: '9000000002-ficticio0nuevo' } }) });
    conId.ctx.probarConexion();
    assert.deepEqual(conId.registro, ['La plataforma respondió 403: Este script todavía no está aprobado en SGM', 'Identificador de este script: 9000000002-ficticio0nuevo (en SGM debe salir el mismo antes de aprobarlo).']);
    const sinRed = cargar({ servidor: () => new Error('timeout de prueba') });
    assert.doesNotThrow(() => sinRed.ctx.probarConexion());
    assert.match(sinRed.registro[0], /respondió 0: Sin conexión con la plataforma: timeout de prueba/);
  });
});
