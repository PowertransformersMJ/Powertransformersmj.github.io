// Banco local canónico (`scripts/banco/`, auditoría N2 del 2026-11-08, K-7 / S0-03). Antes cada banco era una copia
// suelta en un scratchpad: se borraba (19 de 22 entradas de `.claude/launch.json` quedaron apuntando a la nada) y sus
// simuladores envejecían en silencio (el más nuevo de la bóveda ya no exportaba `arrayUnion`, `arrayRemove` ni
// `FieldPath`, que importan Marcas, el importador de suministros y Datos SCADA: esas páginas no cargaban en el banco).
// Aquí se exige que los simuladores sigan al sitio y que el servidor sirva lo de siempre sin datos reales.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as banco from '../scripts/banco/server.mjs';
import {
  PUERTO_POR_DEFECTO, VERSIONES_FIRESTORE, FRANJA_POR_DEFECTO, crearServidor, dentroDe, leerArgumentos,
  mapaDeImportacion, semillasValidas, transformarHtml
} from '../scripts/banco/server.mjs';
import { revisarTexto } from '../scripts/guardia-scada.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STUBS = join(RAIZ, 'scripts', 'banco', 'stubs');
const CDN = /https:\/\/www\.gstatic\.com\/firebasejs\/([0-9.]+)\/firebase-firestore\.js/;

function archivos(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(js|mjs|html)$/.test(n)) out.push(p);
  }
  return out;
}
const fuentes = [...archivos(join(RAIZ, 'assets', 'js')), ...archivos(join(RAIZ, 'pages')), ...archivos(join(RAIZ, 'admin')),
  join(RAIZ, 'index.html'), join(RAIZ, 'home.html')].map((p) => ({ p, t: readFileSync(p, 'utf8') }));

/** Nombres que el sitio toma de firebase-firestore.js (import estático o `const { … } = await import(…)`). */
function nombresImportadosDeFirestore() {
  const out = new Set();
  const URL_FS = String.raw`['"]https://www\.gstatic\.com/firebasejs/[0-9.]+/firebase-firestore\.js['"]`;
  const estatico = new RegExp(String.raw`import\s*\{([^{}]*)\}\s*from\s*` + URL_FS, 'g');
  const dinamico = new RegExp(String.raw`(?:const|let|var)\s*\{([^{}]*)\}\s*=\s*await\s+import\(\s*` + URL_FS + String.raw`\s*\)`, 'g');
  for (const { t } of fuentes) {
    for (const re of [estatico, dinamico]) {
      for (const m of t.matchAll(re)) {
        m[1].split(',').map((s) => s.replace(/\/\/.*$/gm, '').trim().split(/\s+as\s+|\s*:\s*/)[0]).filter(Boolean).forEach((n) => out.add(n));
      }
    }
  }
  return out;
}

/** Nombres que exporta un módulo del sitio (por texto: los del sitio importan del CDN y no corren en Node). */
function exportsPorTexto(ruta) {
  const t = readFileSync(join(RAIZ, ruta), 'utf8');
  const out = new Set([...t.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
  for (const m of t.matchAll(/^export\s*\{([^}]*)\}/gm)) m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach((n) => out.add(n));
  return out;
}

// Los simuladores son módulos del navegador: se cargan en Node con un `window` de mentira.
async function cargarStub(nombre) {
  globalThis.window = globalThis.window || globalThis;
  return import(pathToFileURL(join(STUBS, nombre)).href + '?t=' + Math.random());
}

describe('los simuladores siguen al sitio', () => {
  test('el Firestore simulado exporta TODO lo que el sitio importa de firebase-firestore.js', async () => {
    const usados = nombresImportadosDeFirestore();
    assert.ok(usados.size >= 20, 'el lector de imports dejó de ver los del sitio (' + usados.size + ')');
    for (const n of ['collection', 'getDocs', 'writeBatch', 'arrayUnion', 'FieldPath']) assert.ok(usados.has(n), n);
    const fs = await cargarStub('firestore.js');
    const faltan = [...usados].filter((n) => !(n in fs));
    assert.deepEqual(faltan, [], 'el banco no cargaría las páginas que importan: ' + faltan.join(', '));
  });
  test('init.js y session.js exportan lo mismo que firebase-init.js y session-guard.js', async () => {
    for (const [stub, real] of [['init.js', 'assets/js/firebase-init.js'], ['session.js', 'assets/js/auth/session-guard.js']]) {
      const esperados = exportsPorTexto(real);
      assert.ok(esperados.size >= 4, real);
      const m = await cargarStub(stub);
      const faltan = [...esperados].filter((n) => !(n in m));
      assert.deepEqual(faltan, [], stub + ' no exporta: ' + faltan.join(', '));
    }
    const init = await cargarStub('init.js');
    assert.equal(init.isFirebaseConfigured, true, 'en el sitio es una constante, no una función');
  });
  test('el importmap cubre todas las versiones de Firestore que el sitio pide al CDN', () => {
    const versiones = new Set(fuentes.flatMap(({ t }) => [...t.matchAll(new RegExp(CDN.source, 'g'))].map((m) => m[1])));
    assert.ok(versiones.size >= 1);
    const faltan = [...versiones].filter((v) => !VERSIONES_FIRESTORE.includes(v));
    assert.deepEqual(faltan, [], 'añade a VERSIONES_FIRESTORE: ' + faltan.join(', '));
  });
});

describe('el Firestore simulado se porta como Firestore', () => {
  let fs;
  before(async () => { fs = await cargarStub('firestore.js'); window.__store.clear(); window.__falloEscritura = false; });
  test('arrayUnion no repite y arrayRemove quita, por valor', async () => {
    const r = fs.doc(fs.getFirestore(), 'suministros', 'S-1');
    await fs.setDoc(r, { marcas: ['A'] });
    await fs.updateDoc(r, { marcas: fs.arrayUnion('A', 'B') });
    assert.deepEqual((await fs.getDoc(r)).data().marcas, ['A', 'B']);
    await fs.updateDoc(r, { marcas: fs.arrayRemove('A') });
    assert.deepEqual((await fs.getDoc(r)).data().marcas, ['B']);
  });
  test('updateDoc con «a.b» o con FieldPath escribe DENTRO del mapa y no borra a los hermanos', async () => {
    const r = fs.doc(fs.getFirestore(), 'paquetes', 'P-1');
    await fs.setDoc(r, { filas: { f1: { decision: 'no', nota: 'x' } }, rev: 1 });
    await fs.updateDoc(r, new fs.FieldPath('filas', 'f1', 'decision'), 'si', 'rev', 2);
    await fs.updateDoc(r, { 'filas.f2.decision': 'no' });
    assert.deepEqual((await fs.getDoc(r)).data(), { filas: { f1: { decision: 'si', nota: 'x' }, f2: { decision: 'no' } }, rev: 2 });
  });
  test('updateDoc de un documento que no existe falla con not-found (como Firestore)', async () => {
    await assert.rejects(fs.updateDoc(fs.doc(fs.getFirestore(), 'paquetes', 'no-hay'), { a: 1 }), (e) => e.code === 'not-found');
  });
  test('un lote que falla no deja nada escrito', async () => {
    const db = fs.getFirestore();
    const b = fs.writeBatch(db);
    b.set(fs.doc(db, 'ordenes', 'O-1'), { n: 1 });
    b.update(fs.doc(db, 'ordenes', 'no-hay'), { n: 2 });
    await assert.rejects(b.commit(), (e) => e.code === 'not-found');
    assert.equal((await fs.getDoc(fs.doc(db, 'ordenes', 'O-1'))).exists(), false);
  });
  test('las listas protegidas exigen custodio == sesión y limit <= 50', async () => {
    window.__sgmSession = { user: { uid: 'u-banco' } };
    const col = fs.collection(fs.getFirestore(), 'firmas_delegados');
    await assert.rejects(fs.getDocs(fs.query(col, fs.limit(10))), (e) => e.code === 'permission-denied');
    const ok = await fs.getDocs(fs.query(col, fs.where('custodio', '==', 'u-banco'), fs.limit(10)));
    assert.equal(ok.size, 0);
  });
});

describe('la página que sirve el banco', () => {
  const pagina = '<!DOCTYPE html><html lang="es"><head>\n<meta charset="utf-8">\n<script type="module" src="../assets/js/auth/page-guard.js"></script>\n</head><body></body></html>';
  test('quita el guardián e inyecta importmap, franja y sesión ANTES de cualquier módulo', () => {
    const t = transformarHtml(pagina);
    assert.doesNotMatch(t, /page-guard\.js/);
    assert.ok(t.indexOf('type="importmap"') > t.indexOf('<head>') && t.indexOf('type="importmap"') < t.indexOf('<meta'));
    assert.match(t, /\/__banco\/stubs\/firestore\.js/);
    assert.ok(t.includes(JSON.stringify(FRANJA_POR_DEFECTO).replace(/</g, '\\u003c')));
    // Como session-guard: el aviso va a window y a document (10 páginas de admin escuchan en document, TODO-16).
    assert.match(t, /window\.dispatchEvent\(new CustomEvent\("sgm:session-ready"/);
    assert.match(t, /document\.dispatchEvent\(new CustomEvent\("sgm:session-ready"/);
    assert.doesNotMatch(transformarHtml(pagina.replace('page-guard', 'admin-guard')), /admin-guard\.js/);
  });
  test('rol por parámetro (visitante marca <html data-rol>) y admin si el rol es raro', () => {
    assert.match(transformarHtml(pagina, { rol: 'visitante' }), /"role":"visitante"[\s\S]*dataset\.rol=s\.role/);
    assert.match(transformarHtml(pagina, { rol: '"><script>' }), /"role":"admin"/);
  });
  test('un texto de la URL no puede cerrar el <script> (caída, franja)', () => {
    const t = transformarHtml(pagina, { caida: '</script><script>alert(1)</script>', franja: '</script>' });
    assert.doesNotMatch(t, /<\/script><script>alert/);
  });
  test('semillas: solo nombres sencillos, sin repetir; lo demás se ignora', () => {
    assert.deepEqual(semillasValidas(['nexo', 'nexo,parque-completo', '../x', 'A', '']), ['nexo', 'parque-completo']);
    const t = transformarHtml(pagina, { semillas: ['nexo', '../../etc'] });
    assert.match(t, /<script src="\/__semillas\/semilla-nexo\.js"><\/script>/);
    assert.doesNotMatch(t, /etc/);
  });
  test('lo publicado (/__antes/) usa simuladores con su prefijo', () => {
    const m = mapaDeImportacion('/__antes');
    assert.equal(m['/__antes/assets/js/firebase-init.js'], '/__banco/stubs/init.js');
    assert.equal(m['/__antes/assets/js/auth/session-guard.js'], '/__banco/stubs/session.js');
  });
  test('rutas: nada fuera de la carpeta, tampoco una hermana con el mismo prefijo', () => {
    assert.equal(dentroDe('/r/sitio', 'pages/a.html'), '/r/sitio/pages/a.html');
    assert.equal(dentroDe('/r/sitio', '../sitio-otro/x'), null);
    assert.equal(dentroDe('/r/sitio', '../../etc/passwd'), null);
  });
  test('argumentos: sirve el checkout del propio archivo (vale desde un worktree); opción rara dice qué hacer', () => {
    const o = leerArgumentos([], {});
    assert.equal(o.repo, RAIZ);
    assert.equal(o.puerto, PUERTO_POR_DEFECTO);
    assert.equal(o.semillas, null);
    assert.deepEqual(leerArgumentos(['--puerto', '0', '--semilla', 'nexo', '--semilla', 'sum'], {}).siempre, ['nexo', 'sum']);
    assert.throws(() => leerArgumentos(['--semila', 'x'], {}), /opción desconocida: --semila .*cabecera/);
    assert.throws(() => leerArgumentos(['--puerto'], {}), /falta el valor/);
  });
});

describe('el servidor del banco', () => {
  let servidor; let base; let semillas;
  const pedir = async (ruta) => { const r = await fetch(base + ruta); return { codigo: r.status, tipo: r.headers.get('content-type') || '', texto: await r.text() }; };
  before(async () => {
    semillas = mkdtempSync(join(tmpdir(), 'banco-semillas-'));
    writeFileSync(join(semillas, 'semilla-demo.js'), 'window.__store = window.__store || new Map();\n');
    servidor = crearServidor({ repo: RAIZ, semillas, siempre: [], ref: 'HEAD' });
    await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
    base = 'http://127.0.0.1:' + servidor.address().port;
  });
  after(() => new Promise((ok) => servidor.close(ok)));
  test('una página real sale sin guardián y con los simuladores', async () => {
    const r = await pedir('/pages/contrato.html');
    assert.equal(r.codigo, 200);
    assert.match(r.tipo, /text\/html/);
    assert.match(r.texto, /type="importmap"/);
    assert.doesNotMatch(r.texto, /auth\/page-guard\.js/);
  });
  test('los simuladores se sirven como JavaScript', async () => {
    for (const n of ['firestore.js', 'init.js', 'session.js']) {
      const r = await pedir('/__banco/stubs/' + n);
      assert.equal(r.codigo, 200, n);
      assert.match(r.tipo, /javascript/, n);
    }
  });
  test('semillas: se piden por nombre y vienen de la carpeta de fuera', async () => {
    assert.match((await pedir('/pages/contrato.html?semilla=demo')).texto, /\/__semillas\/semilla-demo\.js/);
    assert.equal((await pedir('/__semillas/semilla-demo.js')).codigo, 200);
    assert.equal((await pedir('/__semillas/semilla-no-hay.js')).codigo, 404);
    assert.equal((await pedir('/__semillas/..%2Fsemilla-demo.js')).codigo, 403);
  });
  test('lo publicado (/__antes/) sale de git, con su prefijo', async () => {
    const r = await pedir('/__antes/index.html');
    assert.equal(r.codigo, 200);
    assert.match(r.texto, /"\/__antes\/assets\/js\/firebase-init\.js"/);
    assert.equal((await pedir('/__antes/no-existe.html')).codigo, 404);
  });
  test('nada fuera del repositorio', async () => {
    for (const ruta of ['/%2e%2e/%2e%2e/etc/passwd', '/__banco/stubs/..%2F..%2Fserver.mjs', '/__antes/..%2Fx']) {
      assert.notEqual((await pedir(ruta)).codigo, 200, ruta);
    }
  });
  test('sin --semillas no hay semillas, y lo dice', async () => {
    const s = crearServidor({ repo: RAIZ, ref: 'HEAD' });
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    try {
      const r = await fetch('http://127.0.0.1:' + s.address().port + '/__semillas/semilla-demo.js');
      assert.equal(r.status, 404);
      assert.match(await r.text(), /--semillas/);
      const p = await (await fetch('http://127.0.0.1:' + s.address().port + '/pages/contrato.html?semilla=demo')).text();
      assert.doesNotMatch(p, /__semillas/);
    } finally { await new Promise((ok) => s.close(ok)); }
  });
});

describe('la línea de órdenes (lo que arranca .claude/launch.json)', () => {
  const SERVER = join(RAIZ, 'scripts', 'banco', 'server.mjs');
  // Arranca el banco como lo hace launch.json y espera su primera línea; devuelve { hijo, linea, codigo }.
  const arrancar = (args) => new Promise((ok) => {
    const hijo = spawn(process.execPath, [SERVER, ...args], { cwd: RAIZ, env: { ...process.env, PORT: '' } });
    let salida = '';
    const listo = (codigo) => ok({ hijo, linea: salida, codigo });
    hijo.stdout.on('data', (d) => { salida += d; if (/banco en http/.test(salida)) listo(null); });
    hijo.stderr.on('data', (d) => { salida += d; });
    hijo.on('exit', (c) => listo(c));
  });
  test('arranca, dice dónde escucha y sirve; si el puerto está ocupado sale con 1 y dice qué hacer', async () => {
    const a = await arrancar(['--puerto', '0']);
    try {
      const puerto = Number((a.linea.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/) || [])[1]);
      assert.ok(puerto > 0, a.linea);
      assert.equal((await fetch('http://127.0.0.1:' + puerto + '/pages/contrato.html')).status, 200);
      const b = await arrancar(['--puerto', String(puerto)]);
      assert.equal(b.codigo, 1);
      assert.match(b.linea, /no pude escuchar en el puerto .*--puerto N/);
    } finally { a.hijo.kill(); }
  });
  test('una opción mal escrita no arranca: sale con 2 y lo dice', async () => {
    const r = await arrancar(['--semila', 'x']);
    assert.equal(r.codigo, 2);
    assert.match(r.linea, /opción desconocida: --semila/);
  });
  // Revisión de K-7 (2026-11-09): antes escuchaba en TODAS las interfaces y otro equipo de la red podía pedirle archivos.
  test('escucha SOLO en este computador (127.0.0.1): por la dirección de red del equipo no responde', async (t) => {
    const ip = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
    if (!ip) { t.skip('este equipo no tiene una dirección de red además de la local: no hay con qué probar'); return; }
    const a = await arrancar(['--puerto', '0']);
    try {
      const puerto = Number((a.linea.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/) || [])[1]);
      assert.ok(puerto > 0, a.linea);
      assert.equal(await llega('127.0.0.1', puerto), true, 'desde este computador sí');
      assert.equal(await llega(ip, puerto), false, 'por ' + ip + ' (la red) respondió: el banco escucha en todas las interfaces');
      assert.equal(banco.HOST, '127.0.0.1');
    } finally { a.hijo.kill(); }
  });
});

/** ¿Se abre una conexión TCP a host:puerto? (true/false, sin colgarse). */
function llega(host, puerto) {
  return new Promise((ok) => {
    const c = connect({ host, port: puerto });
    const fin = (v) => { c.destroy(); ok(v); };
    c.setTimeout(3000, () => fin(false));
    c.once('connect', () => fin(true));
    c.once('error', () => fin(false));
  });
}

// Revisión de K-7 (2026-11-09): antes servía CUALQUIER archivo del checkout, también .git y lo ignorado (en el
// principal: carpetas ignoradas con informes de cliente, Debug/, .claude/settings.local.json). Checkout falso en el tmp, datos inventados.
describe('el banco no saca lo privado del checkout (.git, lo que empieza por punto, lo ignorado)', () => {
  let raiz; let servidor; let base;
  const pedir = async (ruta) => { const r = await fetch(base + ruta); return { codigo: r.status, texto: await r.text() }; };
  const escribir = (rel, texto) => { const p = join(raiz, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, texto); };
  const git = (...args) => execFileSync('git', ['-c', 'user.name=prueba', '-c', 'user.email=prueba@ejemplo.invalid',
    '-c', 'commit.gpgsign=false', ...args], { cwd: raiz, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))) });
  before(async () => {
    raiz = realpathSync(mkdtempSync(join(tmpdir(), 'banco-privado-')));
    escribir('index.html', '<!DOCTYPE html><html><head><title>x</title></head><body>inicio</body></html>');
    escribir('pages/a.html', '<!DOCTYPE html><html><head><title>a</title></head><body>a</body></html>');
    escribir('assets/js/x.js', 'export const x = 1;\n');
    escribir('.gitignore', 'privado/\n.claude/*\n.env\n');
    git('init', '-q');
    git('add', 'index.html', 'pages', 'assets', '.gitignore');
    git('commit', '-q', '-m', 'prueba');
    escribir('privado/informe-inventado.txt', 'INFORME-INVENTADO-NO-DEBE-SALIR\n');
    escribir('.claude/settings.local.json', '{"inventado":"NO-DEBE-SALIR"}\n');
    escribir('.env', 'CLAVE_INVENTADA=NO-DEBE-SALIR\n');
    escribir('assets/.oculto.js', '// NO-DEBE-SALIR\n');
    escribir('pages/nuevo.html', '<!DOCTYPE html><html><head><title>n</title></head><body>nuevo</body></html>');   // sin commitear, no ignorado
    servidor = crearServidor({ repo: raiz, ref: 'HEAD' });
    await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
    base = 'http://127.0.0.1:' + servidor.address().port;
  });
  after(async () => {
    if (servidor) await new Promise((ok) => servidor.close(ok));
    if (raiz) rmSync(raiz, { recursive: true, force: true });
  });

  test('/.git/config y lo demás de .git no salen (403/404)', async () => {
    for (const ruta of ['/.git/config', '/.git/HEAD', '/pages/%2e%2e/.git/config']) {
      const r = await pedir(ruta);
      assert.ok(r.codigo === 403 || r.codigo === 404, ruta + ' → ' + r.codigo);
      assert.doesNotMatch(r.texto, /\[core\]|refs\/heads/, ruta);
    }
  });
  test('nada que empiece por punto: .claude, .env, .gitignore, un .oculto.js', async () => {
    for (const ruta of ['/.claude/settings.local.json', '/.env', '/.gitignore', '/assets/.oculto.js']) {
      const r = await pedir(ruta);
      assert.ok(r.codigo === 403 || r.codigo === 404, ruta + ' → ' + r.codigo);
      assert.doesNotMatch(r.texto, /NO-DEBE-SALIR|privado\//, ruta);
    }
  });
  test('lo que git ignora no sale aunque esté en el disco', async () => {
    const r = await pedir('/privado/informe-inventado.txt');
    assert.equal(r.codigo, 404);
    assert.doesNotMatch(r.texto, /NO-DEBE-SALIR/);
  });
  test('sin falso rojo: lo rastreado, lo nuevo sin commitear y lo creado con el banco ya abierto sí salen', async () => {
    const inicio = await pedir('/');
    assert.equal(inicio.codigo, 200);
    assert.match(inicio.texto, /type="importmap"/);
    assert.equal((await pedir('/pages/a.html')).codigo, 200);
    assert.equal((await pedir('/assets/js/x.js')).codigo, 200);
    assert.equal((await pedir('/pages/nuevo.html')).codigo, 200);
    escribir('assets/js/despues.js', 'export const y = 2;\n');
    assert.equal((await pedir('/assets/js/despues.js')).codigo, 200);
    assert.equal((await pedir('/no-existe.html')).codigo, 404);
  });
});

describe('el banco no lleva datos reales (el repo es público)', () => {
  test('ni claves ni circuitos del SCADA, ni números de diez cifras, ni coordenadas en sus archivos', () => {
    const lista = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard', 'scripts/banco'], { cwd: RAIZ, encoding: 'utf8' })
      .split('\n').filter(Boolean);
    assert.ok(lista.length >= 4, 'scripts/banco/ debería tener el servidor y sus tres simuladores');
    for (const f of lista) {
      const t = readFileSync(join(RAIZ, f), 'utf8');
      assert.deepEqual(revisarTexto(t), [], f + ': guardia SCADA');
      assert.doesNotMatch(t, /\b\d{10}\b/, f + ': un número de diez cifras (¿contrato, cédula?)');
      assert.doesNotMatch(t, /-?\d{1,2}\.\d{4,}\s*,\s*-?\d{2,3}\.\d{4,}/, f + ': un par de coordenadas');
    }
  });
});
