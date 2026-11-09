// Guardia «cero cerebro en el sitio» (99 §212; N2 2026-11-08, K-7 / S7-10): el repo es PÚBLICO y el cerebro
// vive en la bóveda. Pruebas MUTANTES en repos de prueba desechables (un `docs/x.md`, un CLAUDE.md gordo,
// `skills/`, `_legacy/`) que deben dar rojo, y sus CONTROLES (las fichas `docs/pruebas/*.json` y el puente
// pasan). Al final, el árbol real del sitio no da rojo y los hooks y el CI llaman a la guardia.
// K-7 (revisión adversarial del 2026-11-09): el cerebro con sus nombres propios en un docs/ anidado, .claude/**,
// SKILL.md en cualquier carpeta y AGENTS.md / GEMINI.md gordos también frenan; con --arbol o en GitHub Actions
// no se imprimen rutas (log público); y la guardia muerde aunque se la llame por un enlace (realpath).
// Todos los nombres de archivo de estas pruebas son inventados.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rutaDeCerebro, claudeGordo, revisar, subidasDePush, TOPE_PUENTE_BYTES } from '../scripts/guardia-cero-cerebro.mjs';
// Las funciones nuevas de K-7 van por el espacio de nombres: así, contra la versión de antes, solo fallan sus pruebas.
import * as G from '../scripts/guardia-cero-cerebro.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDIA = join(RAIZ, 'scripts', 'guardia-cero-cerebro.mjs');
const CEROS = '0'.repeat(40);

// git aislado: sin la configuración global ni la del sistema (firmas GPG, hooks…) y sin un GIT_DIR heredado.
const VACIO = join(mkdtempSync(join(tmpdir(), 'cero-cerebro-cfg-')), 'gitconfig');
writeFileSync(VACIO, '');
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: VACIO, GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Prueba', GIT_AUTHOR_EMAIL: 'prueba@example.invalid',
  GIT_COMMITTER_NAME: 'Prueba', GIT_COMMITTER_EMAIL: 'prueba@example.invalid' };
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY']) delete ENV[k];
// Fuera de GitHub Actions por defecto (en el CI real esta variable llega puesta): cada prueba del registro
// público la pone ella misma.
delete ENV.GITHUB_ACTIONS;

const g = (dir, ...args) => execFileSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' }).trim();
const texto = (n) => '# puente\n' + 'x'.repeat(Math.max(0, n - 10)) + '\n';
function escribir(dir, ruta, contenido) {
  mkdirSync(dirname(join(dir, ruta)), { recursive: true });
  writeFileSync(join(dir, ruta), contenido);
}
function preparar(dir, archivos) {
  for (const [ruta, contenido] of Object.entries(archivos)) escribir(dir, ruta, contenido);
  // -f: como quien salta el .gitignore (la primera red), y para no depender del ignore global de la máquina.
  g(dir, 'add', '-f', '--', ...Object.keys(archivos));
}
function commit(dir, archivos, msg) {
  preparar(dir, archivos);
  g(dir, 'commit', '-q', '-m', msg);
  return g(dir, 'rev-parse', 'HEAD');
}
/** Un sitio de prueba como el de hoy: una página, el puente (1.605 B) y una ficha. */
function sitio() {
  const dir = mkdtempSync(join(tmpdir(), 'cero-cerebro-'));
  g(dir, 'init', '-q', '-b', 'main');
  const base = commit(dir, { 'index.html': '<!doctype html>\n', 'CLAUDE.md': texto(1605),
    'docs/pruebas/01-ficha.json': '{}\n' }, 'base');
  return { dir, base };
}
const guardia = (dir, args = [], input = '', env = ENV, script = GUARDIA) =>
  spawnSync(process.execPath, [script, ...args], { cwd: dir, env, input, encoding: 'utf8' });
const EN_ACTIONS = { ...ENV, GITHUB_ACTIONS: 'true' };
const push = (ref, local, remoto) => ref + ' ' + local + ' ' + ref + ' ' + remoto + '\n';

describe('reglas (funciones puras)', () => {
  test('docs/ es del cerebro, salvo las fichas docs/pruebas/*.json; skills/ y _legacy/ siempre', () => {
    for (const r of ['docs/x.md', 'docs/99-HISTORIAL-ADR.md', 'docs/.handoff-auto.md', 'docs/pruebas/notas.md',
      'docs/pruebas/sub/01.json', 'Docs/x.md', 'skills/a/SKILL.md', '_legacy/cerebro-anterior/docs/10.md']) {
      assert.ok(rutaDeCerebro(r), r + ' debería ser cerebro');
    }
    for (const r of ['docs/pruebas/01-factor-potencia-aislamiento.json', 'docs/pruebas/11-nueva.json',
      'assets/docs/pruebas/173523/informe.pdf', 'documentos/x.md', 'pages/skills.html', 'scripts/docs.mjs', 'CLAUDE.md']) {
      assert.equal(rutaDeCerebro(r), '', r + ' es del sitio');
    }
  });
  test('un CLAUDE.md (en cualquier carpeta) de más del tope deja de ser un puente', () => {
    assert.equal(TOPE_PUENTE_BYTES, 2048);
    assert.equal(claudeGordo('CLAUDE.md', 1568), '');
    assert.equal(claudeGordo('CLAUDE.md', TOPE_PUENTE_BYTES), '');
    assert.match(claudeGordo('CLAUDE.md', TOPE_PUENTE_BYTES + 1), /2049 B > 2048 B/);
    assert.ok(claudeGordo('functions/CLAUDE.md', 25000));
    assert.ok(claudeGordo('CLAUDE.local.md', 3000));
    assert.equal(claudeGordo('README.md', 50000), '');
    assert.deepEqual(revisar([{ ruta: 'index.html', bytes: 0 }, { ruta: 'CLAUDE.md', bytes: 1568 }]), []);
    assert.deepEqual(revisar([{ ruta: 'skills/x.md' }, { ruta: 'CLAUDE.md', bytes: 9000 }]).map((h) => h.ruta), ['skills/x.md', 'CLAUDE.md']);
  });
  test('stdin de pre-push: sin borrados; el rango deja fuera lo que ya está en cualquier rama remota', () => {
    const s = subidasDePush(push('refs/heads/main', 'aaa', 'bbb') + push('refs/heads/nueva', 'ccc', CEROS) +
      '(delete) ' + CEROS + ' refs/heads/x ddd\n');
    assert.deepEqual(s, [
      { ref: 'refs/heads/main', local: 'aaa', rango: ['aaa', '--not', 'bbb', '--remotes'] },
      { ref: 'refs/heads/nueva', local: 'ccc', rango: ['ccc', '--not', '--remotes'] },
    ]);
  });
});

describe('pre-commit: lo preparado (repo de prueba)', () => {
  test('CONTROL: una ficha nueva en docs/pruebas y un puente editado pasan', () => {
    const { dir } = sitio();
    preparar(dir, { 'docs/pruebas/02-otra.json': '{}\n', 'CLAUDE.md': texto(1700), 'index.html': '<!doctype html><p>\n' });
    const r = guardia(dir);
    assert.equal(r.status, 0, r.stdout);
  });
  test('MUTANTE: preparar docs/x.md da rojo, nombra la ruta y dice cómo seguir', () => {
    const { dir } = sitio();
    preparar(dir, { 'docs/x.md': '# una neurona\n' });
    const r = guardia(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /docs\/x\.md/);
    assert.match(r.stdout, /git restore --staged/);
    assert.match(r.stdout, /brain-private/);
  });
  test('MUTANTE: un CLAUDE.md gordo da rojo (también uno anidado)', () => {
    const { dir } = sitio();
    preparar(dir, { 'CLAUDE.md': texto(TOPE_PUENTE_BYTES + 1) });
    const r = guardia(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /CLAUDE\.md \(2049 B > 2048 B/);
    const otro = sitio().dir;
    preparar(otro, { 'functions/CLAUDE.md': texto(20000) });
    assert.equal(guardia(otro).status, 1);
  });
  test('MUTANTE: skills/, _legacy/ y un archivo del sitio renombrado hacia docs/ dan rojo', () => {
    for (const ruta of ['skills/pruebas-electricas/SKILL.md', '_legacy/cerebro-anterior/CLAUDE-viejo.md']) {
      const { dir } = sitio();
      preparar(dir, { [ruta]: 'x\n' });
      assert.equal(guardia(dir).status, 1, ruta);
    }
    const { dir } = sitio();
    g(dir, 'mv', 'index.html', 'docs/index.html');
    assert.equal(guardia(dir).status, 1);
  });
  test('CONTROL: sacar cerebro del sitio siempre pasa', () => {
    const { dir } = sitio();
    commit(dir, { 'docs/viejo.md': 'x\n' }, 'cerebro de antes de §212');
    g(dir, 'rm', '-q', '--cached', 'docs/viejo.md');
    const r = guardia(dir);
    assert.equal(r.status, 0, r.stdout);
  });
});

describe('pre-push: el rango y la punta (repo de prueba)', () => {
  test('CONTROL: subir commits sanos, una rama nueva sana o borrar una rama pasa', () => {
    const { dir, base } = sitio();
    const b = commit(dir, { 'docs/pruebas/02-otra.json': '{}\n', 'CLAUDE.md': texto(1600) }, 'sano');
    assert.equal(guardia(dir, ['--push'], push('refs/heads/main', b, base)).status, 0);
    assert.equal(guardia(dir, ['--push'], push('refs/heads/nueva', b, CEROS)).status, 0);
    assert.equal(guardia(dir, ['--push'], '(delete) ' + CEROS + ' refs/heads/x ' + b + '\n').status, 0);
  });
  test('MUTANTE: un commit del rango que agrega docs/x.md da rojo aunque otro lo quite después', () => {
    const { dir, base } = sitio();
    const c = commit(dir, { 'docs/x.md': '# neurona\n' }, 'trae cerebro');
    g(dir, 'rm', '-q', 'docs/x.md');
    g(dir, 'commit', '-q', '-m', 'lo quita');
    const d = g(dir, 'rev-parse', 'HEAD');
    const r = guardia(dir, ['--push'], push('refs/heads/main', d, base));
    assert.equal(r.status, 1);
    assert.match(r.stdout, new RegExp('commit ' + c.slice(0, 8) + ': docs/x\\.md'));
    assert.match(r.stdout, /cherry-pick/);
  });
  test('MUTANTE: un commit del rango con un CLAUDE.md gordo da rojo', () => {
    const { dir, base } = sitio();
    const e = commit(dir, { 'CLAUDE.md': texto(25000) }, 'el router vuelve');
    assert.equal(guardia(dir, ['--push'], push('refs/heads/main', e, base)).status, 1);
  });
  test('MUTANTE: la punta de una rama vieja trae cerebro aunque sus commits ya estén en el remoto', () => {
    const { dir } = sitio();
    const o = commit(dir, { '_legacy/README.md': 'x\n' }, 'linaje viejo');
    g(dir, 'update-ref', 'refs/remotes/origin/viejo', o);   // sus commits ya son «públicos»: el rango queda vacío
    const r = guardia(dir, ['--push'], push('refs/heads/otra', o, CEROS));
    assert.equal(r.status, 1);
    assert.match(r.stdout, /punta de refs\/heads\/otra: _legacy\/README\.md/);
  });
});

describe('CI: todo lo versionado (repo de prueba)', () => {
  test('CONTROL: el sitio de prueba (puente + docs/pruebas) pasa', () => {
    assert.equal(guardia(sitio().dir, ['--arbol']).status, 0);
  });
  test('MUTANTE: docs/x.md o un CLAUDE.md gordo en el árbol dan rojo', () => {
    const a = sitio().dir;
    preparar(a, { 'docs/x.md': '# neurona\n' });
    const r = guardia(a, ['--arbol']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /lo versionado/);
    const b = sitio().dir;
    commit(b, { 'CLAUDE.md': texto(3000) }, 'puente gordo');
    assert.equal(guardia(b, ['--arbol']).status, 1);
  });
});

describe('K-7: cobertura (el cerebro fuera de docs/, skills/ y _legacy/ de la raíz)', () => {
  const MUTANTES = [
    'pages/docs/05-ESTADO-GLOBAL.md', 'sgm-transpower/docs/99-HISTORIAL-ADR.md', 'functions/docs/10-MEMORIA-CORTO-PLAZO.md',
    'otra/carpeta/99-historial-adr.md', '.claude/rules/router.md', '.claude/skills/x/SKILL.md', '.claude/CLAUDE.md',
    '.claude/settings.local.json', 'functions/.claude/settings.json', 'herramientas/inventada/SKILL.md', 'skill.md',
  ];
  const CONTROLES = [
    '.claude/settings.json', 'assets/docs/pruebas/1/a.pdf', 'assets/docs/manual-inventado.md', 'pages/estado-global.html',
    'scripts/skill.mjs', 'docs/pruebas/05-ficha-inventada.json', 'assets/05-ESTADO-GLOBAL.png', 'notas/AGENTS-viejo.md',
  ];
  test('reglas: nombres del cerebro y SKILL.md en cualquier carpeta, .claude/** salvo settings.json', () => {
    for (const r of MUTANTES) assert.ok(rutaDeCerebro(r), r + ' debería ser cerebro');
    for (const r of CONTROLES) assert.equal(rutaDeCerebro(r), '', r + ' es del sitio');
  });
  test('reglas: AGENTS.md y GEMINI.md llevan el mismo tope que CLAUDE.md (en cualquier carpeta)', () => {
    for (const r of ['AGENTS.md', 'GEMINI.md', 'functions/AGENTS.md', 'pages/gemini.md', 'AGENTS.local.md']) {
      assert.match(claudeGordo(r, TOPE_PUENTE_BYTES + 1), /2049 B > 2048 B/, r);
      assert.equal(claudeGordo(r, TOPE_PUENTE_BYTES), '', r + ' en el tope pasa');
    }
    assert.equal(claudeGordo('notas/AGENTS-viejo.md', 50000), '');
  });
  test('MUTANTE (pre-commit): cada ruta nueva da rojo en un repo de prueba', () => {
    for (const ruta of MUTANTES) {
      const { dir } = sitio();
      preparar(dir, { [ruta]: 'x\n' });
      const r = guardia(dir);
      assert.equal(r.status, 1, ruta + ' debería dar rojo:\n' + r.stdout);
      assert.ok(r.stdout.includes(ruta), ruta);
    }
    for (const ruta of ['AGENTS.md', 'GEMINI.md', 'functions/AGENTS.md']) {
      const { dir } = sitio();
      preparar(dir, { [ruta]: texto(3000) });
      assert.equal(guardia(dir).status, 1, ruta + ' de 3000 B debería dar rojo');
    }
  });
  test('CONTROL (pre-commit): settings.json, assets/docs, una ficha y un AGENTS.md corto pasan', () => {
    const { dir } = sitio();
    const archivos = Object.fromEntries(CONTROLES.map((r) => [r, 'x\n']));
    archivos['AGENTS.md'] = texto(1605);
    archivos['GEMINI.md'] = texto(TOPE_PUENTE_BYTES);
    preparar(dir, archivos);
    const r = guardia(dir);
    assert.equal(r.status, 0, r.stdout);
  });
  test('MUTANTE (--push y --arbol): un 99-HISTORIAL-ADR.md anidado y un AGENTS.md gordo dan rojo', () => {
    const { dir, base } = sitio();
    const c = commit(dir, { 'pages/docs/99-HISTORIAL-ADR.md': 'x\n', 'AGENTS.md': texto(3000) }, 'cerebro anidado');
    assert.equal(guardia(dir, ['--push'], push('refs/heads/main', c, base)).status, 1);
    assert.equal(guardia(dir, ['--arbol']).status, 1);
  });
});

describe('K-7: el registro de CI es público (sin rutas con --arbol o en GitHub Actions)', () => {
  const OCULTA = 'notas-inventadas-k7';
  function conCerebro() {
    const { dir, base } = sitio();
    const c = commit(dir, { ['docs/' + OCULTA + '.md']: 'x\n', ['docs/sub/' + OCULTA + '-2.md']: 'x\n',
      ['.claude/rules/' + OCULTA + '.md']: 'x\n' }, 'cerebro de prueba');
    return { dir, base, c };
  }
  test('MUTANTE: --arbol da rojo sin nombrar rutas: solo categoría y conteo', () => {
    const { dir } = conCerebro();
    const r = guardia(dir, ['--arbol']);
    assert.equal(r.status, 1);
    assert.ok(!r.stdout.includes(OCULTA), 'imprimió una ruta en el registro público:\n' + r.stdout);
    assert.match(r.stdout, /docs\/ \(fuera de las fichas docs\/pruebas\/\*\.json\): 2 archivo\(s\)/);
    assert.match(r.stdout, /\.claude\/ \(fuera de \.claude\/settings\.json\): 1 archivo\(s\)/);
    assert.match(r.stdout, /--arbol --rutas/);
  });
  test('MUTANTE: con GITHUB_ACTIONS tampoco hay rutas en pre-commit ni en --push', () => {
    const { dir, base, c } = conCerebro();
    preparar(dir, { ['docs/' + OCULTA + '-3.md']: 'x\n' });
    const pc = guardia(dir, [], '', EN_ACTIONS);
    assert.equal(pc.status, 1);
    assert.ok(!pc.stdout.includes(OCULTA), pc.stdout);
    assert.match(pc.stdout, /docs\/ .*: 1 archivo\(s\)/);
    const pu = guardia(dir, ['--push'], push('refs/heads/main', c, base), EN_ACTIONS);
    assert.equal(pu.status, 1);
    assert.ok(!pu.stdout.includes(OCULTA), pu.stdout);
    assert.ok(!pu.stdout.includes(c.slice(0, 8)), 'tampoco el SHA con su ruta');
    // Cada ruta cuenta una vez aunque salga en el commit y en la punta.
    assert.match(pu.stdout, /docs\/ .*: 2 archivo\(s\)/);
  });
  test('MUTANTE: --arbol --rutas dentro de GitHub Actions sigue sin rutas', () => {
    const { dir } = conCerebro();
    const r = guardia(dir, ['--arbol', '--rutas'], '', EN_ACTIONS);
    assert.equal(r.status, 1);
    assert.ok(!r.stdout.includes(OCULTA), r.stdout);
  });
  test('CONTROL: en tu máquina, --arbol --rutas y el pre-commit sí nombran las rutas', () => {
    const { dir } = conCerebro();
    const r = guardia(dir, ['--arbol', '--rutas']);
    assert.equal(r.status, 1);
    assert.ok(r.stdout.includes('docs/' + OCULTA + '.md'), r.stdout);
    preparar(dir, { ['docs/' + OCULTA + '-3.md']: 'x\n' });
    assert.ok(guardia(dir).stdout.includes('docs/' + OCULTA + '-3.md'));
  });
  test('funciones puras: rutasVisibles y resumenPublico', () => {
    assert.equal(typeof G.rutasVisibles, 'function');
    assert.equal(G.rutasVisibles('preparado', [], {}), true);
    assert.equal(G.rutasVisibles('push', [], {}), true);
    assert.equal(G.rutasVisibles('arbol', [], {}), false);
    assert.equal(G.rutasVisibles('arbol', ['--arbol', '--rutas'], {}), true);
    for (const modo of ['preparado', 'push', 'arbol']) assert.equal(G.rutasVisibles(modo, ['--rutas'], { GITHUB_ACTIONS: 'true' }), false);
    const h = revisar([{ ruta: 'docs/a.md' }, { ruta: 'docs/b.md' }, { ruta: 'docs/a.md' }, { ruta: 'CLAUDE.md', bytes: 9000 }]);
    const resumen = G.resumenPublico(h);
    assert.deepEqual(resumen, [G.CATEGORIAS.docs + ': 2 archivo(s)', G.CATEGORIAS.puente + ': 1 archivo(s)']);
    assert.ok(!resumen.join('\n').includes('a.md'));
  });
});

describe('K-7: la guardia muerde aunque se la llame por un enlace (realpath, como scripts/boveda.mjs)', () => {
  test('MUTANTE: node <enlace a scripts/>/guardia-cero-cerebro.mjs con docs/x.md preparado da rojo', () => {
    const { dir } = sitio();
    preparar(dir, { 'docs/x.md': '# neurona\n' });
    const enlaces = mkdtempSync(join(tmpdir(), 'cero-cerebro-enlace-'));
    symlinkSync(join(RAIZ, 'scripts'), join(enlaces, 'scripts'), 'dir');
    symlinkSync(GUARDIA, join(enlaces, 'guardia-enlazada.mjs'));
    for (const script of [join(enlaces, 'scripts', 'guardia-cero-cerebro.mjs'), join(enlaces, 'guardia-enlazada.mjs')]) {
      const r = guardia(dir, [], '', ENV, script);
      assert.equal(r.status, 1, script + ' salió ' + r.status + ' sin revisar:\n' + r.stdout + r.stderr);
      assert.match(r.stdout, /docs\/x\.md/);
    }
  });
  test('CONTROL: importarla desde otro módulo no la ejecuta', () => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
      'const m = await import(' + JSON.stringify(new URL('../scripts/guardia-cero-cerebro.mjs', import.meta.url).href) +
      '); console.log(typeof m.revisar);'], { cwd: sitio().dir, env: ENV, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'function');
  });
});

describe('el sitio real', () => {
  test('el árbol versionado de este repo no da rojo (medida de hoy: 0 rutas de cerebro)', () => {
    const r = guardia(RAIZ, ['--arbol']);
    assert.equal(r.status, 0, r.stdout);
    assert.equal(guardia(RAIZ, ['--arbol'], '', EN_ACTIONS).status, 0, 'tampoco como en el CI');
  });
  test('de .claude/ solo se versiona settings.json, y no hay ningún SKILL.md versionado (medida de hoy)', () => {
    const versionado = g(RAIZ, 'ls-files', '-z').split('\0').filter(Boolean);
    assert.deepEqual(versionado.filter((r) => /(^|\/)\.claude\//i.test(r)), ['.claude/settings.json']);
    assert.deepEqual(versionado.filter((r) => /(^|\/)SKILL\.md$/i.test(r)), []);
  });
  test('el puente de hoy cabe en el tope', () => {
    const bytes = statSync(join(RAIZ, 'CLAUDE.md')).size;
    assert.ok(bytes <= TOPE_PUENTE_BYTES, 'CLAUDE.md mide ' + bytes + ' B');
  });
  test('amarre: pre-commit, pre-push y CI llaman a la guardia', () => {
    const leer = (r) => readFileSync(join(RAIZ, r), 'utf8');
    assert.match(leer('githooks/pre-commit'), /node scripts\/guardia-cero-cerebro\.mjs;/);
    assert.match(leer('githooks/pre-push'), /node scripts\/guardia-cero-cerebro\.mjs --push/);
    assert.match(leer('.github/workflows/ci.yml'), /run: node scripts\/guardia-cero-cerebro\.mjs --arbol/);
  });
  test('.gitignore: docs/, skills/ y _legacy/ quedan fuera de `git add`; las fichas y assets/docs no', () => {
    const { dir } = sitio();
    copyFileSync(join(RAIZ, '.gitignore'), join(dir, '.gitignore'));
    const ignorado = (r) => spawnSync('git', ['check-ignore', '-q', '--no-index', r], { cwd: dir, env: ENV }).status === 0;
    for (const r of ['docs/x.md', 'docs/sub/y.md', 'skills/a/SKILL.md', '_legacy/z.md']) assert.ok(ignorado(r), r);
    for (const r of ['docs/pruebas/11-nueva.json', 'assets/docs/pruebas/1/a.pdf', 'pages/skills.html']) assert.ok(!ignorado(r), r);
  });
});
