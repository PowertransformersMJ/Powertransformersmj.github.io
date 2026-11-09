// Bóveda desde un WORKTREE (L-111 · S7-01 de la N2 del 2026-11-08 · K-7). La bóveda `brain-private/` es hermana del
// repo PRINCIPAL, no de la carpeta del checkout: desde `.claude/worktrees/<n>/` una ruta «../brain-private» no existe.
// Aquí se arma, en una carpeta temporal que hace de HOME, `Proyectos/` con un repo principal, un worktree ANIDADO (como
// los de Claude Code) y una bóveda FALSA (sus scripts del kernel solo imprimen los argumentos que reciben), y se corre
// desde el worktree lo que de verdad corre: el pre-commit, los 7 hooks de .claude/settings.json, los `npm run brain:*`
// y el freno al publicar. HOME apunta a la carpeta temporal: ni la bóveda real ni el git global se tocan. Corre en CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESTE = 'tests/boveda.test.js';
// Lo que cargan el pre-commit, los hooks y el freno (del árbol de trabajo: se prueba lo que hay en disco, no un commit).
const A_COPIAR = ['scripts', 'githooks', 'assets/js/domain', '.claude/settings.json', 'package.json'];
const KERNEL = ['brain-check', 'session-handoff', 'brain-archive', 'brain-index', 'brain-diff', 'verify-secretos'];
// Entorno limpio: sin variables GIT_* (si la suite corre dentro de un hook de git, apuntarían al repo de verdad),
// sin CLAUDE_PROJECT_DIR heredado, sin huellas de otra parte y con este node primero en el PATH.
const ENV = Object.fromEntries(Object.entries(process.env)
  .filter(([k]) => !/^GIT_/.test(k) && k !== 'CLAUDE_PROJECT_DIR' && k !== 'SGM_HUELLAS'));
ENV.PATH = dirname(process.execPath) + delimiter + (process.env.PATH || '');
const ID = {
  GIT_AUTHOR_NAME: 'prueba', GIT_AUTHOR_EMAIL: 'prueba@example.invalid',
  GIT_COMMITTER_NAME: 'prueba', GIT_COMMITTER_EMAIL: 'prueba@example.invalid'
};

/** Los dos argumentos seguidos tal como los imprime el stub (`"--root","/ruta"`). */
const par = (a, b) => JSON.stringify([a, b]).slice(1, -1);

function copiar(desde, hacia) {
  if (!existsSync(desde)) return;
  if (statSync(desde).isDirectory()) {
    for (const n of readdirSync(desde)) copiar(join(desde, n), join(hacia, n));
    return;
  }
  mkdirSync(dirname(hacia), { recursive: true });
  copyFileSync(desde, hacia);
}

/** HOME/Proyectos/{sitio, sitio/.claude/worktrees/prueba, brain-private}, con HOME = una carpeta temporal. */
function armar({ conBoveda = true } = {}) {
  const T = realpathSync(mkdtempSync(join(tmpdir(), 'sgm-boveda-')));
  const env = { ...ENV, HOME: T };
  const git = (cwd, ...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', env: { ...env, ...ID }, stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  // Commit con plomería (write-tree + commit-tree): no dispara ningún hook.
  const commitTodo = (cwd, mensaje) => {
    git(cwd, 'add', '-A');
    git(cwd, 'update-ref', 'HEAD', git(cwd, 'commit-tree', git(cwd, 'write-tree'), '-m', mensaje));
  };
  const principal = join(T, 'Proyectos', 'sitio');
  const boveda = join(T, 'Proyectos', 'brain-private');
  mkdirSync(principal, { recursive: true });
  for (const r of A_COPIAR) copiar(join(REPO, r), join(principal, r));
  git(principal, 'init', '-q');
  commitTodo(principal, 'sitio de prueba');
  const wt = join(principal, '.claude', 'worktrees', 'prueba');
  git(principal, 'worktree', 'add', '-q', '--detach', wt, 'HEAD');
  if (conBoveda) {
    for (const k of KERNEL) {
      const f = join(boveda, 'kernel', `${k}.mjs`);
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, `console.log('STUB ${k} ' + JSON.stringify(process.argv.slice(2)));\n`);
    }
    const docs = join(boveda, 'sgm-transpower', 'docs');
    mkdirSync(docs, { recursive: true });
    // Un 99 con TODOS los encabezados: el freno no puede quejarse de un ADR faltante, solo de no hallar el 99.
    writeFileSync(join(docs, '99-HISTORIAL-ADR.md'),
      Array.from({ length: 999 }, (_, i) => `## ${i + 1}. ADR de prueba`).join('\n') + '\n');
    git(boveda, 'init', '-q');
    commitTodo(boveda, 'bóveda de prueba');
  }
  const correr = (cwd, cmd, args, extra = {}) => spawnSync(cmd, args, {
    cwd, encoding: 'utf8', input: '{}', env: { ...env, ...extra }, timeout: 60000
  });
  return { T, principal, boveda, wt, git, correr, limpiar: () => rmSync(T, { recursive: true, force: true }) };
}

function hooksDeSettings(dir) {
  const s = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
  return Object.entries(s.hooks).flatMap(([ev, grupos]) => grupos.flatMap((g) => g.hooks.map((h) => [ev, h.command])));
}

test('pre-commit: desde un worktree anidado encuentra el escáner de secretos de la bóveda', (t) => {
  const f = armar();
  t.after(f.limpiar);
  writeFileSync(join(f.wt, 'nota-prueba.txt'), 'hola\n');
  f.git(f.wt, 'add', 'nota-prueba.txt');
  const r = f.correr(f.wt, 'sh', ['githooks/pre-commit']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^STUB verify-secretos \["--staged","--coordenadas"\]$/m); // L-140: la guardia de coordenadas va encendida
});

test('los 7 hooks de .claude/settings.json encuentran la bóveda desde un worktree anidado (y desde el principal)', (t) => {
  const f = armar();
  t.after(f.limpiar);
  const hooks = hooksDeSettings(f.wt);
  assert.equal(hooks.length, 7);
  for (const dir of [f.wt, f.principal]) {
    for (const [ev, cmd] of hooks) {
      const donde = `${ev} con CLAUDE_PROJECT_DIR=${dir === f.wt ? 'worktree' : 'principal'}`;
      const r = f.correr(dir, 'sh', ['-c', cmd], { CLAUDE_PROJECT_DIR: dir });
      assert.equal(r.status, 0, `${donde}: ${r.stderr}`);
      assert.match(r.stdout, /^STUB (brain-check|session-handoff) /m, donde);
      assert.ok(r.stdout.includes(par('--root', join(f.boveda, 'sgm-transpower'))), `${donde}: ${r.stdout}`);
      assert.ok(r.stdout.includes(par('--sitio', dir)), `${donde}: ${r.stdout}`);
    }
  }
  // El gate #18 [a] del kernel lee este hook como TEXTO y exige ver EJECUTADO session-handoff.mjs en una ruta que sepa
  // expandir ($CLAUDE_PROJECT_DIR o $HOME): por eso no va por el envoltorio (si fuera, el linter daría rojo).
  const eco = hooks.filter(([ev, c]) => ev === 'SessionStart' && c.includes('--boot-echo'));
  assert.equal(eco.length, 1);
  assert.match(eco[0][1], /^node "\$HOME\/[^"]+\/kernel\/session-handoff\.mjs" --boot-echo /);
  // Con otra carpeta personal (la bóveda no está en $HOME/Proyectos), el mismo hook cae al envoltorio y la halla por git.
  const otra = f.correr(f.wt, 'sh', ['-c', eco[0][1]], { CLAUDE_PROJECT_DIR: f.wt, HOME: join(f.T, 'otra-casa') });
  assert.equal(otra.status, 0, otra.stderr);
  assert.match(otra.stdout, /^STUB session-handoff /m);
  assert.ok(otra.stdout.includes(par('--root', join(f.boveda, 'sgm-transpower'))), otra.stdout);
});

test('npm run brain:* encuentran la bóveda desde un worktree anidado', (t) => {
  const f = armar();
  t.after(f.limpiar);
  const { scripts } = JSON.parse(readFileSync(join(f.wt, 'package.json'), 'utf8'));
  for (const [nombre, kernel] of [
    ['brain:check', 'brain-check'], ['brain:archive', 'brain-archive'], ['brain:index', 'brain-index'], ['brain:diff', 'brain-diff']
  ]) {
    const r = f.correr(f.wt, 'sh', ['-c', scripts[nombre]]);
    assert.equal(r.status, 0, `${nombre}: ${r.stderr}`);
    assert.match(r.stdout, new RegExp(`^STUB ${kernel} `, 'm'), nombre);
    if (kernel !== 'brain-diff') assert.ok(r.stdout.includes(par('--root', join(f.boveda, 'sgm-transpower'))), `${nombre}: ${r.stdout}`);
  }
});

test('freno al publicar: desde un worktree anidado lee el 99 COMMITEADO en la bóveda', (t) => {
  const f = armar();
  t.after(f.limpiar);
  const r = f.correr(f.wt, process.execPath, ['scripts/freno-publicar.mjs', '--rev', 'HEAD']);
  assert.doesNotMatch(r.stdout, /no encuentro el 99/);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('sin bóveda: dice dónde la buscó y cómo seguir; el pre-commit falla cerrado y ningún hook bloquea la sesión', (t) => {
  const f = armar({ conBoveda: false });
  t.after(f.limpiar);
  const p = f.correr(f.wt, process.execPath, ['scripts/boveda.mjs']);
  assert.equal(p.status, 1);
  assert.ok(p.stderr.includes(f.boveda), p.stderr);
  assert.ok(p.stderr.includes(f.principal), p.stderr);
  assert.match(p.stderr, /Cómo seguir/);
  const calla = f.correr(f.wt, process.execPath, ['scripts/boveda.mjs', 'session-handoff', '--tick', '--si-falta=callar']);
  assert.equal(calla.status, 0);
  assert.equal(calla.stdout, '');
  // Un hook que sale con 2 bloquea el prompt, la compactación o el cierre: sin bóveda todos salen con 0, y el del
  // arranque deja el aviso en stdout (lo que Claude ve).
  for (const [ev, cmd] of hooksDeSettings(f.wt)) {
    const r = f.correr(f.wt, 'sh', ['-c', cmd], { CLAUDE_PROJECT_DIR: f.wt });
    assert.equal(r.status, 0, ev);
    if (cmd.includes('--boot-echo')) assert.ok(r.stdout.includes(f.boveda), `aviso del arranque: ${r.stdout}`);
  }
  writeFileSync(join(f.wt, 'nota-prueba.txt'), 'hola\n');
  f.git(f.wt, 'add', 'nota-prueba.txt');
  const pc = f.correr(f.wt, 'sh', ['githooks/pre-commit']);
  assert.equal(pc.status, 1);
  assert.match(pc.stdout, /COMMIT BLOQUEADO/);
});

test('ninguna ruta del sitio llega a la bóveda con «../brain-private» relativo al checkout (L-111)', () => {
  const patron = ['\\.\\./brain-private', `['"]\\.\\.['"], *['"]\\.\\.['"], *['"]brain-private`].join('|');
  const r = spawnSync('git', ['grep', '-n', '-I', '-E', patron, '--', '.', `:(exclude)${ESTE}`], {
    cwd: REPO, encoding: 'utf8', env: ENV
  });
  assert.equal(r.status, 1,
    `desde un worktree esas rutas no existen; usa scripts/boveda.mjs (o ~/Proyectos/… en el puente):\n${r.stdout}${r.stderr}`);
});
