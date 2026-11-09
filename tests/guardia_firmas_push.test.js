// Guardia de FIRMAS (99 §99) también en el pre-push y en el merge (S7-09@10-11; K-7 de la N2 del 2026-11-08).
// Un cherry-pick, un rebase, un merge en avance rápido o un `commit --no-verify` no pasan por el pre-commit:
// el pre-push revisa cada commit que se va a subir. TODO es FICTICIO: la «firma» es una imagen PNG inventada
// aquí, y su huella va a una bóveda FALSA en una carpeta temporal, hermana del repo de prueba (como la de
// verdad). Ningún byte ni huella real; nada sale de la carpeta temporal.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDIA = join(RAIZ, 'scripts', 'guardia-firmas.mjs');
const CERO = '0'.repeat(40);
// git aislado: sin la configuración del usuario (firma GPG, hooks globales), sin variables de un hook que
// esté corriendo (GIT_DIR, GIT_INDEX_FILE…) y con un autor de prueba.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
Object.assign(ENV, {
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Prueba', GIT_AUTHOR_EMAIL: 'prueba@example.invalid',
  GIT_COMMITTER_NAME: 'Prueba', GIT_COMMITTER_EMAIL: 'prueba@example.invalid',
});

const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const imagenFicticia = () => Buffer.concat([PNG, randomBytes(64)]);
const FIRMA = imagenFicticia();                       // la «firma registrada» (inventada)

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' }).trim();
const guardia = (cwd, args = [], entrada = '') =>
  spawnSync(process.execPath, [GUARDIA, ...args], { cwd, env: ENV, input: entrada, encoding: 'utf8' });
const linea = (local, remoto, rama = 'refs/heads/main') => `${rama} ${local} ${rama} ${remoto}\n`;

function commitCon(repo, archivos, msg) {
  for (const [ruta, bytes] of Object.entries(archivos)) {
    mkdirSync(dirname(join(repo, ruta)), { recursive: true });
    writeFileSync(join(repo, ruta), bytes);
  }
  git(repo, 'add', '--', ...Object.keys(archivos));
  git(repo, 'commit', '-q', '-m', msg);
  return git(repo, 'rev-parse', 'HEAD');
}

let base, repo, B0;
before(() => {
  base = mkdtempSync(join(tmpdir(), 'guardia-firmas-'));
  const boveda = join(base, 'brain-private', 'sgm-transpower');
  mkdirSync(boveda, { recursive: true });
  writeFileSync(join(boveda, 'huellas-firmas.json'), JSON.stringify({
    nota: 'FICTICIA: huella de una imagen inventada por la prueba',
    huellas: [createHash('sha256').update(FIRMA).digest('hex')],
  }));
  repo = join(base, 'sitio');
  execFileSync('git', ['init', '-q', '--bare', join(base, 'remoto.git')], { env: ENV });
  execFileSync('git', ['init', '-q', '-b', 'main', repo], { env: ENV });
  git(repo, 'remote', 'add', 'origin', join(base, 'remoto.git'));
  B0 = commitCon(repo, { 'README.md': 'repo de prueba\n' }, 'base');
  git(repo, 'push', '-q', 'origin', 'main');           // origin/main = B0: lo que «ya está publicado»
});
after(() => { if (base) rmSync(base, { recursive: true, force: true }); });

describe('--push (pre-push): revisa cada commit que se va a subir', () => {
  test('bloquea una firma registrada aunque venga renombrada y sin extensión', () => {
    git(repo, 'checkout', '-q', '-B', 'p1', B0);
    const c1 = commitCon(repo, { 'assets/img/logo-v2': FIRMA }, 'logo (cherry-pick sin pre-commit)');
    const r = guardia(repo, ['--push'], linea(c1, B0));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /lo que se va a subir trae FIRMAS/);
    assert.match(r.stdout, new RegExp(`commit ${c1.slice(0, 8)} · assets/img/logo-v2 \\(es una firma registrada\\)`));
    assert.match(r.stdout, /rehaga el cambio sin la firma en una rama nueva/);
  });

  test('bloquea una imagen con nombre de firma en un commit INTERMEDIO del rango, no solo en la punta', () => {
    git(repo, 'checkout', '-q', '-B', 'p2', B0);
    const c1 = commitCon(repo, { 'docs/firma-prueba.png': imagenFicticia() }, 'imagen');
    commitCon(repo, { 'notas.txt': 'después\n' }, 'texto');
    const r = guardia(repo, ['--push'], linea(git(repo, 'rev-parse', 'HEAD'), B0));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`commit ${c1.slice(0, 8)} · docs/firma-prueba\\.png \\(imagen con nombre o ruta de firma\\)`));
  });

  test('rama nueva (remoto en ceros) y remoto desconocido (push forzado tras un push ajeno): revisa lo que no está en un remoto', () => {
    git(repo, 'checkout', '-q', '-B', 'p3', B0);
    const c1 = commitCon(repo, { 'x/sello.bin': FIRMA }, 'sello');
    const nueva = guardia(repo, ['--push'], linea(c1, CERO, 'refs/heads/nueva'));
    assert.equal(nueva.status, 1, nueva.stdout + nueva.stderr);
    const ajeno = guardia(repo, ['--push'], linea(c1, 'abcdef0123456789abcdef0123456789abcdef01'));
    assert.equal(ajeno.status, 1, ajeno.stdout + ajeno.stderr);
    assert.match(ajeno.stdout, /x\/sello\.bin \(es una firma registrada\)/);
    assert.doesNotMatch(ajeno.stderr, /fatal|Error/);
  });

  test('un merge que trae la firma desde otra rama también se ve', () => {
    git(repo, 'checkout', '-q', '-B', 'lado', B0);
    commitCon(repo, { 'lado/escaneo.png': FIRMA }, 'lado');
    git(repo, 'checkout', '-q', '-B', 'p4', B0);
    commitCon(repo, { 'p4.txt': 'p4\n' }, 'p4');
    git(repo, 'merge', '-q', '--no-ff', '-m', 'merge lado', 'lado');
    const r = guardia(repo, ['--push'], linea(git(repo, 'rev-parse', 'HEAD'), B0));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /lado\/escaneo\.png \(es una firma registrada\)/);
  });

  test('deja pasar: commits limpios, borrar una rama, una entrada vacía y lo que YA está en el remoto', () => {
    git(repo, 'checkout', '-q', '-B', 'p5', B0);
    const limpio = commitCon(repo, { 'assets/img/icono.png': imagenFicticia(), 'a.txt': 'hola\n' }, 'limpio');
    for (const entrada of [linea(limpio, B0), linea(CERO, B0, 'refs/heads/vieja'), '']) {
      const r = guardia(repo, ['--push'], entrada);
      assert.equal(r.status, 0, JSON.stringify(entrada) + ' → ' + r.stdout + r.stderr);
    }
    // Una firma que ya está publicada no vuelve a frenar cada push: solo se revisa el rango.
    git(repo, 'checkout', '-q', '-B', 'p6', B0);
    const malo = commitCon(repo, { 'viejo/firma.png': FIRMA }, 'ya publicado');
    git(repo, 'push', '-q', 'origin', 'p6');
    const sigue = commitCon(repo, { 'b.txt': 'b\n' }, 'después');
    const r = guardia(repo, ['--push'], linea(sigue, malo, 'refs/heads/p6'));
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

describe('sin argumentos (pre-commit y pre-merge-commit): lo preparado', () => {
  test('el pre-commit sigue igual: bloquea una firma preparada y deja pasar lo limpio', () => {
    git(repo, 'checkout', '-q', '-B', 'c1', B0);
    writeFileSync(join(repo, 'foto'), FIRMA);
    git(repo, 'add', 'foto');
    const r = guardia(repo);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^🔒 guardia-firmas: el commit trae FIRMAS/);
    assert.match(r.stdout, /· foto \(es una firma registrada\)/);
    git(repo, 'rm', '-q', '--cached', 'foto');
    writeFileSync(join(repo, 'c.txt'), 'c\n');
    git(repo, 'add', 'c.txt');
    assert.equal(guardia(repo).status, 0);
    git(repo, 'reset', '-q');
  });

  test('en un merge (lo que ve el pre-merge-commit): el índice ya trae lo de la otra rama', () => {
    git(repo, 'checkout', '-q', '-f', '-B', 'm-lado', B0);
    commitCon(repo, { 'equipo/firma-ficticia.png': imagenFicticia() }, 'lado');
    git(repo, 'checkout', '-q', '-B', 'm-main', B0);
    commitCon(repo, { 'm.txt': 'm\n' }, 'main');
    git(repo, 'merge', '-q', '--no-commit', '--no-ff', 'm-lado');
    const r = guardia(repo);
    git(repo, 'merge', '--abort');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /equipo\/firma-ficticia\.png \(imagen con nombre o ruta de firma\)/);
  });
});

describe('los hooks la llaman (fallo cerrado)', () => {
  const hook = (n) => readFileSync(join(RAIZ, 'githooks', n), 'utf8');
  test('pre-push le pasa las referencias a `guardia-firmas.mjs --push` y bloquea si falla', () => {
    assert.match(hook('pre-push'), /printf '%s\\n' "\$REFS" \| node scripts\/guardia-firmas\.mjs --push \|\| \{[^}]*exit 1; \}/);
  });
  test('pre-merge-commit corre `guardia-firmas.mjs` sobre el resultado del merge y bloquea si falla', () => {
    assert.match(hook('pre-merge-commit'), /^node scripts\/guardia-firmas\.mjs \|\| \{[^}]*exit 1; \}$/m);
  });
});
