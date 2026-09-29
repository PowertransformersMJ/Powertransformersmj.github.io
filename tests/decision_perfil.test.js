// Guardián de sesión (`99 §116`): una lectura LENTA o FALLIDA del perfil no es
// «no tiene perfil». Visto en vivo: el Ingeniero quedó con un perfil de arranque
// (sin su firma en Órdenes) y a un técnico lo habría sacado de la sesión.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { esperarLectura, decidirPerfil } from '../assets/js/domain/decision_perfil.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Reloj de mentira: el tiempo solo avanza cuando la prueba lo pide. */
function relojFalso() {
  let t = 0; let n = 0; const pend = new Map();
  return {
    ahora: () => t,
    tras: (ms, f) => { const id = ++n; pend.set(id, { en: t + ms, f }); return id; },
    cancelar: (id) => { pend.delete(id); },
    async avanzar(ms) {
      const meta = t + ms;
      const asentar = () => new Promise((r) => setImmediate(r));
      for (;;) {
        await asentar();   // lo que la lectura programa al responder entra antes de mirar el reloj
        const prox = [...pend.entries()].filter(([, v]) => v.en <= meta).sort((a, b) => a[1].en - b[1].en)[0];
        if (!prox) break;
        pend.delete(prox[0]); t = prox[1].en; prox[1].f();
      }
      t = meta; await asentar();
    }
  };
}
const diferida = () => { let ok, mal; const p = new Promise((a, b) => { ok = a; mal = b; }); return { p, ok, mal }; };

describe('esperarLectura: paciencia con la primera carga en frío', () => {
  test('una lectura que tarda 5 s (más que los 3,5 s de antes) se ESPERA y da el perfil; avisa una vez que va lenta', async () => {
    const reloj = relojFalso(); const d = diferida(); let avisos = 0;
    const r = esperarLectura(() => d.p, { total: 9000, aviso: 3500, reloj, alAvisar: () => avisos++ });
    await reloj.avanzar(3600); assert.equal(avisos, 1);
    await reloj.avanzar(1400); d.ok('PERFIL');
    assert.deepEqual(await r, { estado: 'ok', valor: 'PERFIL' });
    assert.equal(avisos, 1);
  });
  const sinConexion = () => Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' });
  test('un error de CONEXIÓN se reintenta tras 1,5 s (el cliente tarda ~1 s en reconectar) y da el perfil', async () => {
    const reloj = relojFalso(); let intentos = 0;
    const r = esperarLectura(() => { intentos++; return intentos === 1 ? Promise.reject(sinConexion()) : Promise.resolve('PERFIL'); }, { reloj });
    await reloj.avanzar(1400); assert.equal(intentos, 1);
    await reloj.avanzar(200);
    assert.deepEqual(await r, { estado: 'ok', valor: 'PERFIL' });
    assert.equal(intentos, 2);
  });
  test('errores seguidos: reintentos a los 1,5 s y 3 s más; luego falla', async () => {
    const reloj = relojFalso(); let intentos = 0;
    const r = esperarLectura(() => { intentos++; return Promise.reject(sinConexion()); }, { reloj });
    await reloj.avanzar(6000);
    assert.equal((await r).estado, 'falla');
    assert.equal(intentos, 3);
  });
  test('un error de PERMISO no se reintenta: «denegado» (no es la conexión)', async () => {
    const reloj = relojFalso(); let intentos = 0;
    const r = esperarLectura(() => { intentos++; return Promise.reject(Object.assign(new Error('no'), { code: 'permission-denied' })); }, { reloj });
    await reloj.avanzar(10);
    assert.equal((await r).estado, 'denegado');
    assert.equal(intentos, 1);
  });
  test('por defecto espera 12 s (más que los 10 s con que Firestore da la conexión por caída)', async () => {
    const reloj = relojFalso(); const d = diferida();
    const r = esperarLectura(() => d.p, { reloj });
    await reloj.avanzar(10500); d.ok('PERFIL');
    assert.deepEqual(await r, { estado: 'ok', valor: 'PERFIL' });
  });
  test('sin respuesta en todo el tiempo total: «tiempo» (no «no existe»)', async () => {
    const reloj = relojFalso(); const d = diferida();
    const r = esperarLectura(() => d.p, { total: 9000, reloj });
    await reloj.avanzar(9001);
    assert.deepEqual(await r, { estado: 'tiempo' });
    d.ok('TARDE');   // una respuesta tardía ya no cambia nada
  });
  test('una excepción al LLAMAR la lectura también se reintenta', async () => {
    const reloj = relojFalso(); let intentos = 0;
    const r = esperarLectura(() => { intentos++; if (intentos === 1) throw new Error('x'); return 'OK'; }, { reloj });
    await reloj.avanzar(1600);
    assert.deepEqual(await r, { estado: 'ok', valor: 'OK' });
  });
});

describe('decidirPerfil: solo un perfil que de verdad NO existe cambia la sesión', () => {
  test('perfil leído → el perfil real', () => {
    assert.equal(decidirPerfil({ estado: 'ok', existe: true }), 'perfil');
  });
  test('lectura lenta o fallida → reintentar (NI perfil de arranque NI cerrar sesión)', () => {
    assert.equal(decidirPerfil({ estado: 'tiempo' }), 'reintentar');
    assert.equal(decidirPerfil({ estado: 'falla' }), 'reintentar');
    assert.equal(decidirPerfil(null), 'reintentar');
  });
  test('el perfil no existe: se consulta /admins; arranque solo si /admins existe', () => {
    assert.equal(decidirPerfil({ estado: 'ok', existe: false }), 'consultar-admins');
    assert.equal(decidirPerfil({ estado: 'ok', existe: false }, { estado: 'ok', existe: true }), 'legacy');
    assert.equal(decidirPerfil({ estado: 'ok', existe: false }, { estado: 'ok', existe: false }), 'sin-perfil');
    assert.equal(decidirPerfil({ estado: 'ok', existe: false }, { estado: 'tiempo' }), 'reintentar');
  });
  test('un perfil NEGADO por las reglas cuenta como inexistente (como antes); /admins negado → sin perfil', () => {
    assert.equal(decidirPerfil({ estado: 'denegado' }), 'consultar-admins');
    assert.equal(decidirPerfil({ estado: 'denegado' }, { estado: 'ok', existe: true }), 'legacy');
    assert.equal(decidirPerfil({ estado: 'ok', existe: false }, { estado: 'denegado' }), 'sin-perfil');
  });
});

describe('el guardián de sesión usa la decisión (y ya no se rinde a los 3,5 s)', () => {
  const src = readFileSync(resolve(__dirname, '..', 'assets', 'js', 'auth', 'session-guard.js'), 'utf8');
  test('carga la decisión DENTRO del try (fallo = página oculta), espera hasta 12 s y «Reintentar» relee en la misma página', () => {
    assert.doesNotMatch(src, /^import .*decision_perfil/m);
    assert.match(src, /try \{[\s\S]{0,400}await import\('\.\.\/domain\/decision_perfil\.js'\)/);
    assert.match(src, /const PROFILE_TOTAL_MS\s+= 12000;/);
    assert.match(src, /decision === 'reintentar'[\s\S]{0,400}showSplashError\([\s\S]{0,200}LOGIN_URL, \(\) => handleUser\(user\)\);\s*return;/);
    assert.doesNotMatch(src, /location\.reload\(\)/);
    assert.match(src, /id="sgm-splash-salir"[\s\S]{0,400}Cerrar sesión/);
    // El perfil de arranque solo sale de la decisión 'legacy'.
    assert.equal((src.match(/legacy: true/g) || []).length, 1);
    assert.match(src, /if \(decision === 'legacy'\) \{/);
    // Al entrar la sesión de Auth, el failsafe de Auth se apaga.
    assert.match(src, /async function handleUser\(user\) \{[\s\S]{0,300}clearTimeout\(FAILSAFE_TIMER\);/);
  });
});

describe('la página de ingreso tampoco toma una lectura lenta como «sin acceso»', () => {
  const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');
  test('al arrancar y al ingresar: con falla de conexión entra (decide el guardián); solo sin perfil cierra sesión', () => {
    assert.match(html, /catch \(e\) \{ falla = !\(e && \(e\.code === 'permission-denied' \|\| e\.code === 'unauthenticated'\)\); \}\s*[\s\S]{0,300}if \(falla\) \{ location\.replace\('home\.html'\); return; \}/);
    assert.match(html, /if \(!ok && falla\) \{[\s\S]{0,200}location\.replace\('home\.html'\)/);
    assert.doesNotMatch(html, /\} catch \(_\) \{\}\s*try \{ await signOut\(auth\); \} catch \(_\) \{\}/);
  });
});
