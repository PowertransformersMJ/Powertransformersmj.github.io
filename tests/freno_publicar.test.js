// Freno al PUBLICAR (99 §150, M-10): a `main` no sube código que cite `99 §N` sin su ADR en el 99 de ese commit.
// Funciones puras (sin git): el caso real (776e31f habría frenado §146-§148) se comprobó a mano en el cierre.
// Desde la mudanza (99 §212) el 99 se lee de la BÓVEDA: ese camino se prueba al final, con un lector inyectado y con el
// lector de git en carpetas temporales. Ninguna prueba lee la bóveda real (S7-07 de la N2 del 11-08).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { citasDeAdr, encabezadosAdr, faltantes, commitsAMain, RUTAS_CODIGO, revisarCommit } from '../scripts/freno-publicar.mjs';

test('citas: «99 §N», con decimales y entre comillas invertidas; no confunde otros §', () => {
  const c = citasDeAdr('// `99 §148` · ver 99 §52.8 y (99 §147.3) · §G.4 · 9 §12 · 199 §7');
  assert.deepEqual([...c].sort((a, b) => a - b), [52, 147, 148]);
});

test('encabezados: solo «## N.» al comienzo de línea', () => {
  const h = encabezadosAdr('## 146. ADR-146 — x\ntexto ## 147. no\n## 148. ADR-148\n### 149. no');
  assert.deepEqual([...h].sort((a, b) => a - b), [146, 148]);
});

test('faltantes: lo citado sin ADR, en orden', () => {
  assert.deepEqual(faltantes(new Set([148, 52, 146]), new Set([52, 146])), [148]);
  assert.deepEqual(faltantes(new Set([52]), new Set([52])), []);
});

test('commits a main del stdin de pre-push (ignora otras ramas y borrados)', () => {
  const stdin = 'refs/heads/x aaa111 refs/heads/main bbb222\n' +
    'refs/heads/y ccc333 refs/heads/DESARROLLO-/-PROYECTO-MJ ddd444\n' +
    '(delete) 0000000000000000000000000000000000000000 refs/heads/main eee555\n';
  assert.deepEqual(commitsAMain(stdin), ['aaa111']);
});

// ── Las ramas que PUBLICAN: pages.yml despliega en push a main Y a master (revisión de K-7, 2026-11-09) ─────────
test('commits a master del stdin de pre-push también (pages.yml publica master); nombres parecidos no', () => {
  const stdin = 'refs/heads/x aaa111 refs/heads/master 0000000000000000000000000000000000000000\n' +
    'refs/heads/y bbb222 refs/heads/mastery ccc333\n' +
    'refs/heads/z ddd444 refs/heads/main2 eee555\n' +
    'refs/heads/w fff666 refs/heads/claude/master ggg777\n';
  assert.deepEqual(commitsAMain(stdin), ['aaa111']);
});

/** Las ramas de `on.push.branches` de pages.yml (las que despliegan), leídas del texto. */
function ramasQuePublican() {
  const yml = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const m = yml.match(/^on:\s*\n\s+push:\s*\n\s+branches:\s*\n((?:[ \t]+-[ \t]+.+\n)+)/m);
  assert.ok(m, 'no encuentro on.push.branches en pages.yml');
  return m[1].split('\n').map((l) => l.replace(/#.*$/, '').replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

test('el freno mira TODAS las ramas que pages.yml publica', () => {
  const ramas = ramasQuePublican();
  assert.ok(ramas.includes('main') && ramas.includes('master'), ramas.join(', '));
  for (const r of ramas) assert.deepEqual(commitsAMain(`refs/heads/x abc123 refs/heads/${r} def456\n`), ['abc123'], r);
});

test('ci.yml: en las ramas que publican ninguna corrida se cancela (su rango quedaría sin revisar)', () => {
  const yml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const bloque = (yml.match(/^concurrency:\s*\n((?:[ \t]+.*\n|\s*\n)+)/m) || [])[1] || '';
  const valor = (clave) => ((bloque.match(new RegExp('^\\s+' + clave + ':\\s*(.+)$', 'm')) || [])[1] || '').trim();
  const cancela = valor('cancel-in-progress');
  const grupo = valor('group');
  assert.ok(grupo && cancela, 'no encuentro concurrency.group y concurrency.cancel-in-progress en ci.yml');
  assert.notEqual(cancela, 'true', 'cancel-in-progress: true cancela también las corridas de main');
  for (const r of ramasQuePublican()) {
    assert.ok(cancela.includes(`github.ref != 'refs/heads/${r}'`), `cancel-in-progress debe ser false en ${r}: ${cancela}`);
    // Con un grupo compartido GitHub cancela la corrida que espera turno aunque cancel-in-progress sea false.
    assert.ok(grupo.includes(`github.ref == 'refs/heads/${r}'`) && grupo.includes('github.run_id'),
      `en ${r} el grupo debe ser uno por corrida (github.run_id): ${grupo}`);
  }
});

test('solo se mira el CÓDIGO publicado, no los docs del cerebro', () => {
  assert.ok(RUTAS_CODIGO.includes('assets') && RUTAS_CODIGO.includes('firestore.rules'));
  assert.ok(!RUTAS_CODIGO.some((r) => r.startsWith('docs')));
});

test('amarre: el pre-push llama al freno', () => {
  const hook = readFileSync(new URL('../githooks/pre-push', import.meta.url), 'utf8');
  assert.match(hook, /node scripts\/freno-publicar\.mjs --push/);
});

// ── El camino de la bóveda (desde la mudanza, el de TODO commit nuevo) ──────────────────────────────────────────
// Citas y encabezados se arman al correr: un «99 §N» literal con un N que no existe haría que el freno real frenara
// este mismo archivo (tests/ es código publicado). 9001 y 9002 no existen en el 99.
const cita = (n) => ['99', `§${n}`].join(' ');
const adr = (n) => `## ${n}. ADR-${n} — de prueba\n`;
const N1 = 9001;
const N2 = 9002;

/** Lector con la forma del de git; null = «ese 99 no está». Cuenta qué se leyó. */
function lectorFalso({ citado = '', delCommit = null, deLaBoveda = null } = {}) {
  const leidas = { delCommit: 0, deLaBoveda: 0 };
  return {
    leidas,
    citado: () => citado,
    el99DelCommit: () => { leidas.delCommit++; return delCommit; },
    el99DeLaBoveda: () => { leidas.deLaBoveda++; return deLaBoveda; }
  };
}

test('bóveda (lector inyectado): ADR presente en el 99 de la bóveda → pasa', () => {
  const l = lectorFalso({ citado: `commit-falso:assets/js/x.js:${cita(N1)}\n`, deLaBoveda: adr(N1) });
  assert.deepEqual(revisarCommit('commit-falso', l), []);
  assert.deepEqual(l.leidas, { delCommit: 1, deLaBoveda: 1 });
});

test('bóveda (lector inyectado): ADR ausente → frena y dice cuál', () => {
  const l = lectorFalso({ citado: `x:${cita(N2)}\nx:${cita(N1)}\n`, deLaBoveda: adr(N1) });
  assert.deepEqual(revisarCommit('commit-falso', l), [N2]);
});

test('bóveda (lector inyectado): sin 99 en el commit ni en la bóveda → SIN-99 (falla cerrado, aun sin citas)', () => {
  for (const citado of [`x:${cita(N1)}\n`, '']) {
    const l = lectorFalso({ citado });
    assert.deepEqual(revisarCommit('commit-falso', l), ['SIN-99']);
    assert.deepEqual(l.leidas, { delCommit: 1, deLaBoveda: 1 });
  }
});

test('bóveda (lector inyectado): si el commit trae su 99 (commits viejos), ese manda y la bóveda no se lee', () => {
  const conAdr = lectorFalso({ citado: `x:${cita(N1)}\n`, delCommit: adr(N1), deLaBoveda: '' });
  assert.deepEqual(revisarCommit('commit-falso', conAdr), []);
  assert.equal(conAdr.leidas.deLaBoveda, 0);
  const sinAdr = lectorFalso({ citado: `x:${cita(N1)}\n`, delCommit: adr(N2), deLaBoveda: adr(N1) });
  assert.deepEqual(revisarCommit('commit-falso', sinAdr), [N1]);   // no se mezcla con el de la bóveda
});

// ── El lector de git, de punta a punta: <tmp>/sitio (con este freno copiado) y al lado <tmp>/brain-private o nada ──
// No toca este repo ni la bóveda real. Sin variables GIT_* (dentro de un hook apuntarían al repo de verdad).
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const FRENO = fileURLToPath(new URL('../scripts/freno-publicar.mjs', import.meta.url));
const RUTA_99 = join('sgm-transpower', 'docs', '99-HISTORIAL-ADR.md');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=prueba', '-c', 'user.email=prueba@ejemplo.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args],
{ cwd, env: ENV, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
const escribir = (ruta, texto) => { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, texto); };

/**
 * Un sitio con un commit cuyo código cita N1 y sin su 99; si `boveda99`, una bóveda al lado con ese 99 commiteado.
 * Ruta REAL (realpath): en macOS el tmp cuelga de /var → /private/var, y el freno solo corre su main() si
 * process.argv[1] es igual a su ruta resuelta; por una ruta con enlace saldría 0 sin revisar nada.
 */
function montaje(t, boveda99 = null) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'freno-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const sitio = join(raiz, 'sitio');
  const boveda = join(raiz, 'brain-private');
  escribir(join(sitio, 'scripts', 'freno-publicar.mjs'), readFileSync(FRENO, 'utf8'));
  // el freno halla la bóveda con scripts/boveda.mjs (S7-01): viaja con él
  escribir(join(sitio, 'scripts', 'boveda.mjs'), readFileSync(fileURLToPath(new URL('../scripts/boveda.mjs', import.meta.url)), 'utf8'));
  escribir(join(sitio, 'assets', 'js', 'x.js'), `// ${cita(N1)}\n`);
  git(sitio, 'init', '-q');
  git(sitio, 'add', 'scripts', 'assets');
  git(sitio, 'commit', '-q', '-m', 'prueba');
  if (boveda99 !== null) {
    escribir(join(boveda, RUTA_99), boveda99);
    git(boveda, 'init', '-q');
    git(boveda, 'add', 'sgm-transpower');
    git(boveda, 'commit', '-q', '-m', 'prueba');
  }
  return { sitio, boveda };
}

function frenar(sitio) {
  const r = spawnSync(process.execPath, [join(sitio, 'scripts', 'freno-publicar.mjs'), '--rev', 'HEAD'],
    { cwd: sitio, env: ENV, encoding: 'utf8' });
  return { codigo: r.status, salida: r.stdout };
}

test('bóveda (git real): sin bóveda al lado → exit 1, dice dónde buscó el 99 y que NO se publica', (t) => {
  const { sitio } = montaje(t);
  const r = frenar(sitio);
  assert.equal(r.codigo, 1);
  assert.match(r.salida, /no encuentro el 99 ni en HEAD ni commiteado en la bóveda/);
  assert.match(r.salida, /brain-private\/sgm-transpower\/docs\/99-HISTORIAL-ADR\.md/);
  assert.match(r.salida, /NO se publica/);
});

test('bóveda (git real): el ADR commiteado en la bóveda → exit 0 y en silencio', (t) => {
  const { sitio } = montaje(t, adr(N1));
  assert.deepEqual(frenar(sitio), { codigo: 0, salida: '' });
});

test('bóveda (git real, DENTRO del gancho): con GIT_DIR/GIT_INDEX_FILE del sitio sigue leyendo la bóveda → exit 0', (t) => {
  // Así lo llama git en el pre-push: con las variables del repo del SITIO puestas. Antes de K-7 (2026-11-09) el freno
  // las heredaba al leer la bóveda y frenaba en falso todo push a main que citara un ADR (roto desde 99 §212).
  const { sitio } = montaje(t, adr(N1));
  const r = spawnSync(process.execPath, [join(sitio, 'scripts', 'freno-publicar.mjs'), '--rev', 'HEAD'], {
    cwd: sitio, encoding: 'utf8',
    env: { ...ENV, GIT_DIR: join(sitio, '.git'), GIT_INDEX_FILE: join(sitio, '.git', 'index'), GIT_WORK_TREE: sitio }
  });
  assert.deepEqual({ codigo: r.status, salida: r.stdout }, { codigo: 0, salida: '' });
});

/** El freno como lo llama el pre-push: `--push` con «<ref> <sha> <ref remoto> <sha remoto>» por stdin. */
function frenarPush(sitio, refRemoto) {
  const sha = git(sitio, 'rev-parse', 'HEAD').trim();
  const r = spawnSync(process.execPath, [join(sitio, 'scripts', 'freno-publicar.mjs'), '--push'],
    { cwd: sitio, env: ENV, encoding: 'utf8', input: `refs/heads/trabajo ${sha} ${refRemoto} ${'0'.repeat(40)}\n` });
  return { codigo: r.status, salida: r.stdout };
}

test('bóveda (git real): un push que CREA master con una cita sin su ADR → frena (pages.yml publica master)', (t) => {
  const { sitio } = montaje(t, adr(N2));   // la bóveda tiene N2; el código cita N1
  for (const rama of ['refs/heads/master', 'refs/heads/main']) {
    const r = frenarPush(sitio, rama);
    assert.equal(r.codigo, 1, rama + ': ' + r.salida);
    assert.ok(r.salida.includes(`cita ${cita(N1)}`), r.salida);
  }
  assert.deepEqual(frenarPush(sitio, 'refs/heads/claude/rama-de-trabajo'), { codigo: 0, salida: '' });   // no publica
});

test('bóveda (git real): el ADR solo en el DISCO de la bóveda, sin commitear → frena (manda su HEAD)', (t) => {
  const { sitio, boveda } = montaje(t, adr(N2));
  writeFileSync(join(boveda, RUTA_99), adr(N2) + adr(N1));
  const r = frenar(sitio);
  assert.equal(r.codigo, 1);
  assert.ok(r.salida.includes(`cita ${cita(N1)}`), r.salida);
  assert.match(r.salida, /Guarde primero el ADR/);
});
