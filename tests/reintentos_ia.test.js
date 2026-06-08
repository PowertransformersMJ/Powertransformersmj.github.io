// Reintento con backoff para la IA (functions/reintentos.mjs) · TODO-09.
//
// Garantiza que "Reprocesar" solo falle por causas ajenas a la IA: los fallos
// TRANSITORIOS (429/500/529, cortes de conexión) se reintentan; los
// PERMANENTES/EXTERNOS (401/400/413) se relanzan de inmediato; y el reintento
// respeta el presupuesto de tiempo de la Cloud Function. Puro: sin red ni Firebase.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  esErrorTransitorioIA, retrasoBackoff, conReintentosIA, IA_STATUS_TRANSITORIOS,
  conTimeoutAbortable, TimeoutIA,
} from '../functions/reintentos.mjs';

const err = (props) => Object.assign(new Error(props.message || 'x'), props);
const sinDormir = async () => {}; // no esperar en los tests

describe('esErrorTransitorioIA — clasificación transitorio vs permanente', () => {
  test('status transitorios → true', () => {
    for (const s of IA_STATUS_TRANSITORIOS) {
      assert.equal(esErrorTransitorioIA(err({ status: s })), true, `status ${s}`);
    }
  });

  test('529 overloaded (campo statusCode o response.status) → true', () => {
    assert.equal(esErrorTransitorioIA(err({ statusCode: 529 })), true);
    assert.equal(esErrorTransitorioIA(err({ response: { status: 503 } })), true);
  });

  test('errores permanentes/externos → false', () => {
    assert.equal(esErrorTransitorioIA(err({ status: 401 })), false); // auth
    assert.equal(esErrorTransitorioIA(err({ status: 400 })), false); // invalid_request
    assert.equal(esErrorTransitorioIA(err({ status: 413 })), false); // payload
    assert.equal(esErrorTransitorioIA(err({ status: 403 })), false);
    assert.equal(esErrorTransitorioIA(err({ status: 404 })), false);
  });

  test('errores de conexión/timeout del SDK (sin status) → true', () => {
    assert.equal(esErrorTransitorioIA(err({ name: 'APIConnectionError' })), true);
    assert.equal(esErrorTransitorioIA(err({ name: 'APIConnectionTimeoutError' })), true);
    assert.equal(esErrorTransitorioIA(err({ message: 'socket hang up' })), true);
    assert.equal(esErrorTransitorioIA(err({ message: 'request to ... failed, reason: ECONNRESET' })), true);
    assert.equal(esErrorTransitorioIA(err({ message: 'Overloaded' })), true);
  });

  test('undici "terminated" / body timeout (incl. cause.code) → true (ADR-018)', () => {
    // El caso real: TypeError: terminated con cause UND_ERR_BODY_TIMEOUT.
    assert.equal(esErrorTransitorioIA(err({ message: 'terminated' })), true);
    assert.equal(esErrorTransitorioIA(Object.assign(new TypeError('terminated'), { cause: { code: 'UND_ERR_BODY_TIMEOUT' } })), true);
    assert.equal(esErrorTransitorioIA(err({ message: 'fetch failed', cause: { message: 'other side closed' } })), true);
    assert.equal(esErrorTransitorioIA(err({ message: 'terminated', cause: { code: 'UND_ERR_HEADERS_TIMEOUT' } })), true);
  });

  test('null/undefined y errores sin pistas → false', () => {
    assert.equal(esErrorTransitorioIA(null), false);
    assert.equal(esErrorTransitorioIA(undefined), false);
    assert.equal(esErrorTransitorioIA(err({ message: 'algo raro del dominio' })), false);
  });
});

describe('retrasoBackoff — exponencial, jitter, Retry-After y tope', () => {
  test('exponencial con rnd fijo', () => {
    assert.equal(retrasoBackoff(0, { baseMs: 1000, rnd: () => 0 }), 1000);
    assert.equal(retrasoBackoff(1, { baseMs: 1000, rnd: () => 0 }), 2000);
    assert.equal(retrasoBackoff(2, { baseMs: 1000, rnd: () => 0 }), 4000);
  });

  test('respeta Retry-After si vino', () => {
    assert.equal(retrasoBackoff(3, { baseMs: 1000, retryAfterMs: 2500, rnd: () => 0 }), 2500);
  });

  test('nunca excede maxMs', () => {
    assert.equal(retrasoBackoff(20, { baseMs: 1000, maxMs: 30000, rnd: () => 0 }), 30000);
    assert.equal(retrasoBackoff(0, { retryAfterMs: 999999, maxMs: 30000 }), 30000);
  });
});

describe('conReintentosIA — política de reintento', () => {
  test('éxito al primer intento: no reintenta', async () => {
    let n = 0;
    const r = await conReintentosIA(async () => { n++; return 'ok'; }, { dormirFn: sinDormir });
    assert.equal(r, 'ok');
    assert.equal(n, 1);
  });

  test('transitorio y luego éxito: reintenta y resuelve', async () => {
    let n = 0;
    const r = await conReintentosIA(async () => {
      n++;
      if (n < 3) throw err({ status: 529, message: 'overloaded' });
      return 'ok';
    }, { dormirFn: sinDormir, baseMs: 1 });
    assert.equal(r, 'ok');
    assert.equal(n, 3);
  });

  test('permanente: NO reintenta, relanza de inmediato', async () => {
    let n = 0;
    await assert.rejects(
      conReintentosIA(async () => { n++; throw err({ status: 401, message: 'auth' }); }, { dormirFn: sinDormir }),
      /auth/
    );
    assert.equal(n, 1);
  });

  test('agota los intentos en fallo transitorio persistente', async () => {
    let n = 0;
    await assert.rejects(
      conReintentosIA(async () => { n++; throw err({ status: 500, message: 'internal' }); },
        { intentos: 4, dormirFn: sinDormir, baseMs: 1 }),
      /internal/
    );
    assert.equal(n, 4);
  });

  test('presupuesto de tiempo: no inicia un intento sin margen', async () => {
    let n = 0;
    let t = 0;
    const ahora = () => t;
    await assert.rejects(
      conReintentosIA(async () => {
        n++;
        t += 100000; // cada intento "consume" 100 s del presupuesto
        throw err({ status: 529, message: 'overloaded' });
      }, { intentos: 10, baseMs: 1000, deadlineMs: 150000, margenMs: 5000, ahora, dormirFn: sinDormir }),
      /overloaded/
    );
    // Con deadline 150 s y 100 s por intento, tras el 2.º intento (t=200 s) ya no
    // hay margen → no se hace un 3.er intento pese a permitir 10.
    assert.equal(n, 2);
  });

  test('onReintento se invoca por cada reintento (no en el éxito final)', async () => {
    const eventos = [];
    await conReintentosIA(async () => {
      if (eventos.length < 2) throw err({ status: 503, message: 'unavailable' });
      return 'ok';
    }, { dormirFn: sinDormir, baseMs: 1, onReintento: (ev) => eventos.push(ev) });
    assert.equal(eventos.length, 2);
    assert.equal(eventos[0].intento, 1);
    assert.equal(eventos[1].intento, 2);
  });
});

describe('conTimeoutAbortable — acota el intento y aborta el cuelgue (ADR-017)', () => {
  test('resuelve si el trabajo termina antes del timeout', async () => {
    const r = await conTimeoutAbortable(async () => 'ok', 1000);
    assert.equal(r, 'ok');
  });

  test('un trabajo que SE CUELGA (nunca resuelve) rechaza con TimeoutIA y ABORTA el signal', async () => {
    let abortado = false;
    await assert.rejects(
      conTimeoutAbortable((signal) => new Promise((resolve) => {
        // se cuelga: nunca resuelve por sí mismo. Solo el abort lo libera.
        signal.addEventListener('abort', () => { abortado = true; resolve('tarde'); });
      }), 30),
      (e) => e instanceof TimeoutIA && e.code === 'ia_timeout' && e.transitorio === true
    );
    assert.equal(abortado, true, 'el signal debe abortarse al vencer el timeout');
  });

  test('propaga el error real del trabajo si falla antes del timeout', async () => {
    await assert.rejects(
      conTimeoutAbortable(async () => { throw err({ status: 401, message: 'auth' }); }, 1000),
      /auth/
    );
  });

  test('TimeoutIA es transitorio para esErrorTransitorioIA → reintentable', () => {
    assert.equal(esErrorTransitorioIA(new TimeoutIA(400000)), true);
    assert.equal(esErrorTransitorioIA({ transitorio: true }), true);
    assert.equal(esErrorTransitorioIA(err({ name: 'AbortError' })), true);
    assert.equal(esErrorTransitorioIA(err({ message: 'The operation was aborted' })), true);
  });

  test('integración: un cuelgue acotado por intento + reintento → termina en error (NUNCA cuelga)', async () => {
    // Simula el patrón real de la CF: cada intento se cuelga; conTimeoutAbortable
    // lo aborta → TimeoutIA (transitorio) → conReintentosIA reintenta hasta agotar
    // y RELANZA. Lo clave: la promesa SIEMPRE se asienta (no queda colgada).
    let intentos = 0;
    await assert.rejects(
      conReintentosIA(
        () => conTimeoutAbortable((signal) => new Promise((resolve) => {
          intentos++;
          signal.addEventListener('abort', () => resolve('tarde'));
        }), 20),
        { intentos: 2, baseMs: 1, dormirFn: async () => {} }
      ),
      (e) => e instanceof TimeoutIA
    );
    assert.equal(intentos, 2);
  });
});
