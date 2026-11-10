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
    writeFileSync(join(boveda, 'kernel', 'VERSION'), '1.17.0\n'); // el pre-push exige 1.17.0 o más (K-16)
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

// K-16 (L-140): el pre-push corre el escáner del kernel COMMIT POR COMMIT, «--rango <base> <commit> --coordenadas» por
// cada commit nuevo (la base de un commit es su padre; la de un merge, la mezcla automática de sus padres sin los archivos
// que cambia respecto a los dos): lo que no pasó por el pre-commit (cherry-pick, rebase, merge, --no-verify) tampoco sube
// con la posición de una S/E. Se corre el pre-push ENTERO desde el worktree, como lo corre git, con las referencias por
// stdin; el stub del kernel dice con qué argumentos lo llamaron. Las otras guardias del pre-push solo ven el commit nuevo
// (un texto limpio).
const PRE_PUSH = 'githooks/pre-push';
const LLAMADA = 'STUB verify-secretos ';
const CERO = '0'.repeat(40);
const ref = (local, remoto, rama = 'refs/heads/claude/prueba') => `${rama} ${local} ${rama} ${remoto}\n`;
// Un dato vetado INVENTADO (hace de coordenada o de credencial; no tiene forma de ninguna de las dos): el escáner de
// prueba de abajo frena si una línea AGREGADA entre sus dos argumentos lo trae. El del kernel es más estricto: lee ENTERO
// cada archivo que cambia en el rango (un archivo con un dato ya publicado frena si se toca).
const VETADO = 'DATO-VETADO-K16';
const ESCANER_QUE_MIRA = [
  "import { execFileSync } from 'node:child_process';",
  'const a = process.argv.slice(2);',
  `console.log('${LLAMADA}' + JSON.stringify(a));`,
  "const d = execFileSync('git', ['diff', '--no-color', '-U0', a[1], a[2]], { encoding: 'utf8' });",
  `if (d.split('\\n').some((l) => l.startsWith('+') && !l.startsWith('+++') && l.includes('${VETADO}'))) process.exit(1);`
].join('\n') + '\n';
// Las dos MITADES inventadas de un dato (hacen de la latitud y la longitud del «par partido» del kernel): este escáner
// lee ENTERO cada archivo que cambia en el rango, como el del kernel, y frena si trae las dos.
const MITADES = ['MITAD-NORTE-K16', 'MITAD-OESTE-K16'];
const ESCANER_DEL_PAR = [
  "import { execFileSync } from 'node:child_process';",
  'const a = process.argv.slice(2);',
  `console.log('${LLAMADA}' + JSON.stringify(a));`,
  "const rutas = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRT', '-z', a[1], a[2]], { encoding: 'utf8' }).split('\\0').filter(Boolean);",
  `for (const r of rutas) { const t = execFileSync('git', ['show', a[2] + ':' + r], { encoding: 'utf8' }); if (${JSON.stringify(MITADES)}.every((m) => t.includes(m))) process.exit(1); }`
].join('\n') + '\n';

/** Un commit con plomería (sin hooks), en el worktree: el árbol de `desde` (o el vacío) con `archivos` puestos y `quitar` fuera. */
function commitArbol(f, { padres = [], desde = padres[0], archivos = {}, quitar = [], mensaje = 'prueba K-16' }) {
  const g = (...a) => f.git(f.wt, ...a);
  if (desde) g('read-tree', desde); else g('read-tree', '--empty');
  for (const [r, t] of Object.entries(archivos)) {
    mkdirSync(dirname(join(f.wt, r)), { recursive: true });
    writeFileSync(join(f.wt, r), t);
    g('add', '--', r);
  }
  for (const r of quitar) g('rm', '-q', '--cached', '--', r);
  return g('commit-tree', g('write-tree'), ...padres.flatMap((p) => ['-p', p]), '-m', mensaje);
}

/** El fixture con origin/main ya MÁS ALLÁ de `base` (de donde sale la rama) y, en el worktree, un commit nuevo. */
function armarPush(opciones) {
  const f = armar(opciones);
  const base = f.git(f.wt, 'rev-parse', 'HEAD');
  const commitSobre = (cwd, archivo) => {
    writeFileSync(join(cwd, archivo), 'texto de prueba\n');
    f.git(cwd, 'add', archivo);
    return f.git(cwd, 'commit-tree', f.git(cwd, 'write-tree'), '-p', base, '-m', archivo);
  };
  f.git(f.principal, 'update-ref', 'refs/remotes/origin/main', commitSobre(f.principal, 'otra-en-main.txt'));
  const punta = commitSobre(f.wt, 'nota-de-la-rama.txt');
  f.git(f.wt, 'update-ref', 'HEAD', punta);
  const empujar = (refs) => {
    const r = spawnSync('sh', [PRE_PUSH, 'origin', 'https://ejemplo.invalid/sitio.git'], {
      cwd: f.wt, encoding: 'utf8', input: refs, env: { ...ENV, HOME: f.T }, timeout: 120000
    });
    const llamadas = r.stdout.split('\n').filter((l) => l.startsWith(LLAMADA)).map((l) => JSON.parse(l.slice(LLAMADA.length)));
    return { ...r, llamadas };
  };
  return { ...f, base, punta, empujar };
}

test('pre-push: el escáner del kernel va con --rango <padre> <commit> --coordenadas, en cada referencia', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  const una = f.empujar(ref(f.punta, f.base));
  assert.equal(una.status, 0, una.stdout + una.stderr);
  assert.deepEqual(una.llamadas, [['--rango', f.base, f.punta, '--coordenadas']]);
  // Dos referencias: una llamada por cada una. Una rama que se BORRA no tiene nada que revisar.
  const varias = f.empujar(ref(f.punta, f.base) + ref(f.punta, f.base, 'refs/heads/claude/otra') + `(delete) ${CERO} refs/heads/vieja ${f.base}\n`);
  assert.equal(varias.status, 0, varias.stdout + varias.stderr);
  assert.deepEqual(varias.llamadas, [['--rango', f.base, f.punta, '--coordenadas'], ['--rango', f.base, f.punta, '--coordenadas']]);
  const borrar = f.empujar(`(delete) ${CERO} refs/heads/vieja ${f.base}\n`);
  assert.equal(borrar.status, 0, borrar.stdout + borrar.stderr);
  assert.deepEqual(borrar.llamadas, []);
});

test('pre-push: una rama NUEVA revisa cada commit que no está en ninguna rama remota, contra su padre (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  // origin/main avanzó después de la base: se revisa solo el commit de la rama, contra su padre (la base).
  const sola = f.empujar(ref(f.punta, CERO));
  assert.equal(sola.status, 0, sola.stdout + sola.stderr);
  assert.deepEqual(sola.llamadas, [['--rango', f.base, f.punta, '--coordenadas']]);
  // Dos commits nuevos: los dos, del más viejo al más nuevo, cada uno contra su padre (no las dos puntas).
  const otro = commitArbol(f, { padres: [f.punta], archivos: { 'otra-nota.txt': 'texto de prueba\n' } });
  const dos = f.empujar(ref(otro, CERO));
  assert.equal(dos.status, 0, dos.stdout + dos.stderr);
  assert.deepEqual(dos.llamadas, [['--rango', f.base, f.punta, '--coordenadas'], ['--rango', f.punta, otro, '--coordenadas']]);
  // Lo que ya está en ALGUNA rama remota ya pasó por aquí (o ya es público): no se vuelve a revisar.
  f.git(f.principal, 'update-ref', 'refs/remotes/origin/desarrollo', f.punta);
  const yaEsta = f.empujar(ref(otro, CERO));
  assert.equal(yaEsta.status, 0, yaEsta.stdout + yaEsta.stderr);
  assert.deepEqual(yaEsta.llamadas, [['--rango', f.punta, otro, '--coordenadas']]);
  // Un commit RAÍZ (una rama huérfana) se revisa contra el árbol vacío: todo lo que trae es nuevo.
  const raiz = commitArbol(f, { archivos: { 'solo.txt': 'texto de prueba\n' } });
  const vacio = f.git(f.wt, 'hash-object', '-t', 'tree', '/dev/null');
  const huerfana = f.empujar(ref(raiz, CERO, 'refs/heads/claude/huerfana'));
  assert.equal(huerfana.status, 0, huerfana.stdout + huerfana.stderr);
  assert.deepEqual(huerfana.llamadas, [['--rango', vacio, raiz, '--coordenadas']]);
});

test('pre-push: un dato que un commit AGREGA y otro del mismo push QUITA no se cuela (commit por commit; K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  writeFileSync(join(f.boveda, 'kernel', 'verify-secretos.mjs'), ESCANER_QUE_MIRA);
  // Lo que aconseja el propio freno, mal hecho: sacar el archivo en un commit NUEVO. Entre las dos puntas no hay nada,
  // pero el primer commit queda en la historia pública con el dato.
  const agrega = commitArbol(f, { padres: [f.punta], archivos: { 'datos/punto.txt': `S/E inventada ${VETADO}\n` } });
  const quita = commitArbol(f, { padres: [agrega], quitar: ['datos/punto.txt'] });
  assert.equal(f.git(f.wt, 'diff', '--name-only', f.punta, quita), '', 'entre las dos puntas no cambia nada');
  // Rama que ya está en el remoto (en la punta) y rama nueva: las dos frenan en el commit que lo agrega.
  const existente = f.empujar(ref(quita, f.punta));
  assert.equal(existente.status, 1, existente.stdout + existente.stderr);
  // Exacta: lo que el remoto ya tiene en esa rama (la punta) no se vuelve a revisar, aunque no esté en refs/remotes.
  assert.deepEqual(existente.llamadas, [['--rango', f.punta, agrega, '--coordenadas']]);
  assert.match(existente.stdout, /PUSH BLOQUEADO: lo que se sube trae una credencial o la posición de una S\/E/);
  const nueva = f.empujar(ref(quita, CERO));
  assert.equal(nueva.status, 1, nueva.stdout + nueva.stderr);
  assert.deepEqual(nueva.llamadas.at(-1), ['--rango', f.punta, agrega, '--coordenadas']);
  // La salida: rehacer los commits que aún no se subieron; otro commit encima no lo arregla.
  assert.match(nueva.stdout, /commit por commit/);
});

test('pre-push: una referencia a un ÁRBOL (no a un commit) se revisa entera contra el árbol vacío (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  writeFileSync(join(f.boveda, 'kernel', 'verify-secretos.mjs'), ESCANER_QUE_MIRA);
  // «git rev-list» sobre un árbol no lista nada y sale con 0: sin este caso, la etiqueta pasaba sin revisar.
  const conDato = commitArbol(f, { archivos: { 'punto.txt': `S/E inventada ${VETADO}\n` } });
  const arbol = f.git(f.wt, 'rev-parse', `${conDato}^{tree}`);
  const vacio = f.git(f.wt, 'hash-object', '-t', 'tree', '/dev/null');
  const r = f.empujar(ref(arbol, CERO, 'refs/tags/arbol-prueba'));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(r.llamadas, [['--rango', vacio, arbol, '--coordenadas']]);
});

test('pre-push: una rama VIEJA que trae main (merge o rebase) no frena por lo que main ya publicó (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  writeFileSync(join(f.boveda, 'kernel', 'verify-secretos.mjs'), ESCANER_QUE_MIRA);
  // main ya publicó dos archivos con el dato (hacen de los del DANE y de la llave web de Firebase, que ya son públicos).
  const mainVieja = f.git(f.wt, 'rev-parse', 'refs/remotes/origin/main');
  const main = commitArbol(f, {
    padres: [mainVieja],
    archivos: { 'assets/geo/rotulos.json': `{"nota":"${VETADO}"}\n`, 'assets/js/firebase-config.js': `// ${VETADO}\n` }
  });
  f.git(f.principal, 'update-ref', 'refs/remotes/origin/main', main);
  // La rama vieja salió de la base, antes de esos archivos, y ya está en el remoto.
  const NOTA = { 'nota-vieja.txt': 'rama vieja\n' };
  const vieja = commitArbol(f, { padres: [f.base], archivos: NOTA });
  const RAMA = 'refs/heads/claude/vieja';
  f.git(f.principal, 'update-ref', 'refs/remotes/origin/claude/vieja', vieja);
  // Merge de main (limpio): se revisa contra la mezcla automática de sus padres, que es igual al merge: no sale nada.
  const merge = commitArbol(f, { padres: [vieja, main], desde: main, archivos: NOTA });
  const mezcla = f.git(f.wt, 'merge-tree', '--write-tree', vieja, main).split('\n')[0];
  assert.equal(mezcla, f.git(f.wt, 'rev-parse', `${merge}^{tree}`), 'el merge limpio es la mezcla automática');
  const conMerge = f.empujar(ref(merge, vieja, RAMA));
  assert.equal(conMerge.status, 0, conMerge.stdout + conMerge.stderr);
  assert.deepEqual(conMerge.llamadas, [['--rango', mezcla, merge, '--coordenadas']]);
  // Rebase sobre main y push forzado: el commit rehecho, contra su padre nuevo (la punta de main).
  const rehecho = commitArbol(f, { padres: [main], archivos: NOTA });
  const conRebase = f.empujar(ref(rehecho, vieja, RAMA));
  assert.equal(conRebase.status, 0, conRebase.stdout + conRebase.stderr);
  assert.deepEqual(conRebase.llamadas, [['--rango', main, rehecho, '--coordenadas']]);
  // Lo que la rama agrega DESPUÉS del merge sí se revisa (y frena): saltar el merge no apaga la guardia.
  const despues = commitArbol(f, { padres: [merge], archivos: { 'datos/nuevo.txt': `${VETADO}\n` } });
  const propio = f.empujar(ref(despues, vieja, RAMA));
  assert.equal(propio.status, 1, propio.stdout + propio.stderr);
  assert.deepEqual(propio.llamadas, [['--rango', mezcla, merge, '--coordenadas'], ['--rango', merge, despues, '--coordenadas']]);
});

test('pre-push: un MERGE que mete un dato propio (o al resolver un conflicto) frena; contra la mezcla de sus padres (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  writeFileSync(join(f.boveda, 'kernel', 'verify-secretos.mjs'), ESCANER_QUE_MIRA);
  const main = f.git(f.wt, 'rev-parse', 'refs/remotes/origin/main');
  const RAMA = 'refs/heads/claude/vieja';
  // Merge «malvado»: los padres se mezclan limpio, pero el merge agrega un archivo que ninguno de los dos trae.
  const malvado = commitArbol(f, { padres: [f.punta, main], desde: main, archivos: { 'nota-de-la-rama.txt': 'texto de prueba\n', 'datos/dentro.txt': `${VETADO}\n` } });
  const mezcla = f.git(f.wt, 'merge-tree', '--write-tree', f.punta, main).split('\n')[0];
  const r1 = f.empujar(ref(malvado, CERO, RAMA));
  assert.equal(r1.status, 1, r1.stdout + r1.stderr);
  assert.deepEqual(r1.llamadas.at(-1), ['--rango', mezcla, malvado, '--coordenadas']);
  assert.match(r1.stdout, /contra la mezcla automática de sus padres/);
  // Conflicto: la rama y main cambian el mismo archivo; quien resuelve deja el dato. La mezcla automática trae las
  // marcas del conflicto, y lo que se escribió al resolver sale en el diff contra ella.
  const lado = commitArbol(f, { padres: [f.base], archivos: { 'otra-en-main.txt': 'versión de la rama\n' } });
  const conflicto = commitArbol(f, { padres: [lado, main], desde: main, archivos: { 'otra-en-main.txt': `resuelto a mano ${VETADO}\n` } });
  const r2 = f.empujar(ref(conflicto, CERO, RAMA));
  assert.equal(r2.status, 1, r2.stdout + r2.stderr);
  assert.equal(r2.llamadas.at(-1)[2], conflicto);
  // El mismo conflicto resuelto SIN el dato pasa.
  const limpio = commitArbol(f, { padres: [lado, main], desde: main, archivos: { 'otra-en-main.txt': 'resuelto a mano\n' } });
  const r3 = f.empujar(ref(limpio, CERO, RAMA));
  assert.equal(r3.status, 0, r3.stdout + r3.stderr);
  assert.equal(r3.llamadas.at(-1)[2], limpio);
});

test('pre-push: un merge LIMPIO que arma el dato con una mitad de cada lado frena (el archivo que tocaron los dos se lee entero; K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  writeFileSync(join(f.boveda, 'kernel', 'verify-secretos.mjs'), ESCANER_DEL_PAR);
  // Un archivo con las dos posiciones vacías; una rama pone la «latitud» (línea 1) y otra la «longitud» (línea 3).
  const inicio = commitArbol(f, { padres: [f.punta], archivos: { 'datos/geo.txt': 'lat: 0\nnombre: S/E inventada\nlng: 0\n' } });
  const norte = commitArbol(f, { padres: [inicio], archivos: { 'datos/geo.txt': `lat: ${MITADES[0]}\nnombre: S/E inventada\nlng: 0\n` } });
  const oeste = commitArbol(f, { padres: [inicio], archivos: { 'datos/geo.txt': `lat: 0\nnombre: S/E inventada\nlng: ${MITADES[1]}\n` } });
  f.git(f.principal, 'update-ref', 'refs/remotes/origin/claude/oeste', oeste);
  // git las mezcla SIN conflicto, y el merge es igual a la mezcla automática: ninguno de los dos padres trae el par.
  const mezcla = f.git(f.wt, 'merge-tree', '--write-tree', norte, oeste).split('\n')[0];
  const merge = commitArbol(f, { padres: [norte, oeste], desde: mezcla });
  assert.equal(f.git(f.wt, 'rev-parse', `${merge}^{tree}`), mezcla, 'el merge es la mezcla automática');
  const r = f.empujar(ref(merge, CERO, 'refs/heads/claude/norte'));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const [, base, punta] = r.llamadas.at(-1);
  assert.equal(punta, merge);
  assert.notEqual(base, mezcla, 'la base no es la mezcla entera: le falta el archivo que tocaron los dos');
  assert.match(f.git(f.wt, 'diff', '--name-only', base, merge), /^datos\/geo\.txt$/m);
  assert.match(r.stdout, /contra la mezcla automática de sus padres/);
});

test('pre-push: lo que está en OTRO remoto (uno privado) sí se revisa al subir a origin; lo de origin no (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  writeFileSync(join(f.boveda, 'kernel', 'verify-secretos.mjs'), ESCANER_QUE_MIRA);
  const privado = commitArbol(f, { padres: [f.punta], archivos: { 'datos/privado.txt': `${VETADO}\n` } });
  f.git(f.principal, 'update-ref', 'refs/remotes/privado/datos', privado);
  // Estar en refs/remotes/privado/ no lo hace público: al subirlo a origin se revisa (y frena).
  const r = f.empujar(ref(privado, CERO, 'refs/heads/claude/datos'));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(r.llamadas.at(-1), ['--rango', f.punta, privado, '--coordenadas']);
  // Si ya está en una rama de origin (el remoto al que se sube), ya pasó por aquí: no se vuelve a revisar.
  f.git(f.principal, 'update-ref', 'refs/remotes/origin/claude/datos-viejo', privado);
  const ya = f.empujar(ref(privado, CERO, 'refs/heads/claude/datos'));
  assert.equal(ya.status, 0, ya.stdout + ya.stderr);
  assert.deepEqual(ya.llamadas, []);
});

test('pre-push: subir a una URL usa el remoto que la tiene; una URL que no es de ningún remoto revisa más, nunca menos (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  const URL = 'https://ejemplo.invalid/sitio.git';
  f.git(f.principal, 'remote', 'add', 'origin', URL);
  const porUrl = (url) => spawnSync('sh', [PRE_PUSH, url, url], { cwd: f.wt, encoding: 'utf8', input: ref(f.punta, CERO), env: { ...ENV, HOME: f.T }, timeout: 120000 });
  const llamadasDe = (r) => r.stdout.split('\n').filter((l) => l.startsWith(LLAMADA)).map((l) => JSON.parse(l.slice(LLAMADA.length)));
  // La URL de origin: como si se subiera a «origin» (solo el commit nuevo de la rama).
  const conocida = porUrl(URL);
  assert.equal(conocida.status, 0, conocida.stdout + conocida.stderr);
  assert.deepEqual(llamadasDe(conocida), [['--rango', f.base, f.punta, '--coordenadas']]);
  // Otra URL: nada cuenta como ya publicado, así que se revisan también la base y lo anterior (más llamadas, no menos).
  const ajena = porUrl('https://otro.invalid/copia.git');
  assert.equal(ajena.status, 0, ajena.stdout + ajena.stderr);
  assert.ok(llamadasDe(ajena).length > 1, ajena.stdout);
  assert.deepEqual(llamadasDe(ajena).at(-1), ['--rango', f.base, f.punta, '--coordenadas']);
});

test('pre-push: un merge de TRES padres (octopus) va contra su primer padre, y frena lo que trae (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  writeFileSync(join(f.boveda, 'kernel', 'verify-secretos.mjs'), ESCANER_QUE_MIRA);
  const main = f.git(f.wt, 'rev-parse', 'refs/remotes/origin/main');
  const otra = commitArbol(f, { padres: [f.base], archivos: { 'otra.txt': 'otra rama\n' } });
  f.git(f.principal, 'update-ref', 'refs/remotes/origin/claude/otra', otra);
  const pulpo = commitArbol(f, { padres: [f.punta, main, otra], desde: main, archivos: { 'nota-de-la-rama.txt': 'texto de prueba\n', 'otra.txt': 'otra rama\n', 'datos/pulpo.txt': `${VETADO}\n` } });
  const r = f.empujar(ref(pulpo, CERO, 'refs/heads/claude/pulpo'));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(r.llamadas.at(-1), ['--rango', f.punta, pulpo, '--coordenadas']);
  assert.match(r.stdout, /contra su primer padre/);
});

test('pre-push: si el escáner encuentra algo, o falta, NO se sube (fallo cerrado)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  const escaner = join(f.boveda, 'kernel', 'verify-secretos.mjs');
  writeFileSync(escaner, `console.log('${LLAMADA}' + JSON.stringify(process.argv.slice(2))); process.exit(1);\n`);
  const r = f.empujar(ref(f.punta, f.base));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.llamadas.length, 1);
  assert.match(r.stdout, /PUSH BLOQUEADO: lo que se sube trae una credencial o la posición de una S\/E/);
  rmSync(escaner);
  const sinEscaner = f.empujar(ref(f.punta, f.base));
  assert.equal(sinEscaner.status, 1, sinEscaner.stdout + sinEscaner.stderr);
  assert.match(sinEscaner.stdout, /PUSH BLOQUEADO: no encuentro el escáner del kernel/);
});

test('pre-push: con un kernel ANTERIOR a 1.17.0 (o sin VERSION) NO se sube: su escáner vale menos (K-16)', (t) => {
  const f = armarPush();
  t.after(f.limpiar);
  const version = join(f.boveda, 'kernel', 'VERSION');
  for (const v of ['1.16.0\n', '1.9.9\n', '']) {
    writeFileSync(version, v);
    const r = f.empujar(ref(f.punta, f.base));
    assert.equal(r.status, 1, `VERSION «${v.trim()}»: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /PUSH BLOQUEADO: el kernel de la bóveda es .* y este gancho necesita 1\.17\.0/);
    assert.deepEqual(r.llamadas, []);
  }
  for (const v of ['1.17.0\n', '1.18.2\n', '2.0.0\n']) {
    writeFileSync(version, v);
    const r = f.empujar(ref(f.punta, f.base));
    assert.equal(r.status, 0, `VERSION «${v.trim()}»: ${r.stdout}${r.stderr}`);
  }
});

test('pre-push: sin bóveda NO se sube, y dice dónde la buscó', (t) => {
  const f = armarPush({ conBoveda: false });
  t.after(f.limpiar);
  const r = f.empujar(ref(f.punta, f.base));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /PUSH BLOQUEADO: no encuentro la bóveda privada/);
  assert.ok(r.stderr.includes(f.boveda), r.stderr);
});
