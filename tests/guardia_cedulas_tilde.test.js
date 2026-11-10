// Guardia de cédulas: un documento binario con TILDE en el nombre también se frena (K-7, hallado al diseñar la
// guardia SCADA en CI). Sin `core.quotePath=false`, git escapa la ruta del numstat («"\303\223rden de trabajo.pdf"»),
// la comilla final tapa el «.pdf» y el binario pasaba en silencio; «orden-trabajo.pdf» sí se frenaba.
// Revisión adversarial K-7 (2026-11-09), lo que quotePath no tapaba:
//   · un nombre con comillas dobles o barra invertida sigue entrecomillado en el numstat sin -z;
//   · un renombre en la misma carpeta sale como «dir/{a.pdf => b.pdf}» (pre-commit y --push);
//   · un .gitattributes con «*.csv -diff» (o «binary») dejaba ciega la FORMA: git decía «Binary files differ»;
//   · y al revés, «*.pdf diff» hacía que git llamara texto a un PDF y el numstat no lo marcaba binario.
// Todo con datos INVENTADOS: «PDF» de bytes con nulos, sin datos de nadie, y una cédula de mentira ya usada en
// tests/responsables_ordenes.test.js (se arma en dos pedazos para que este archivo no dispare la FORMA al commitearse).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARDIA = fileURLToPath(new URL('../scripts/guardia-cedulas.mjs', import.meta.url));
const DOMINIO = fileURLToPath(new URL('../assets/js/domain/responsables_ordenes.js', import.meta.url));
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
delete ENV.GUARDIA_BINARIOS_OK;
delete ENV.SGM_HUELLAS; // sin huellas: aquí se prueban la FORMA y los binarios, no el DATO
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=prueba', '-c', 'user.email=prueba@ejemplo.invalid', '-c', 'commit.gpgsign=false', ...a],
  { cwd, env: ENV, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
const escribir = (ruta, datos) => { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, datos); };
const CEDULA_INVENTADA = 'céd' + 'ula 10.000.001';
const CERO = '0'.repeat(40);

/** Bytes de mentira con nulos (git los trata como binarios); deterministas para que el renombre se detecte igual siempre. */
function binarioDeMentira(n, semilla = 7) {
  const b = Buffer.alloc(n);
  let x = semilla;
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; b[i] = (x >> 16) & 0xff; }
  b.set([0x25, 0x50, 0x44, 0x46, 0x00], 0);
  return b;
}

/** Repo temporal con la guardia copiada (sin versionar) y un commit base. */
function repoTemporal(t) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'cedulas-tilde-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const repo = join(raiz, 'sitio');
  escribir(join(repo, 'scripts', 'guardia-cedulas.mjs'), readFileSync(GUARDIA, 'utf8'));
  escribir(join(repo, 'assets', 'js', 'domain', 'responsables_ordenes.js'), readFileSync(DOMINIO, 'utf8')); // la guardia lo importa
  git(repo, 'init', '-q');
  escribir(join(repo, 'leeme.txt'), 'repositorio de prueba\n');
  git(repo, 'add', 'leeme.txt');
  git(repo, 'commit', '-q', '-m', 'base');
  return repo;
}

const guardia = (repo, args = [], input) =>
  spawnSync(process.execPath, [join(repo, 'scripts', 'guardia-cedulas.mjs'), ...args], { cwd: repo, env: ENV, encoding: 'utf8', input });
const cabeza = (repo) => git(repo, 'rev-parse', 'HEAD').trim();
/** pre-push: «<ref local> <sha local> <ref remota> <sha remoto>» por stdin. */
const empujar = (repo, remoto) => guardia(repo, ['--push'], `refs/heads/x ${cabeza(repo)} refs/heads/x ${remoto}\n`);

function preparar(t, nombre) {
  const repo = repoTemporal(t);
  // un «PDF» binario de mentira: bytes nulos para que git lo trate como binario (numstat «-\t-»), sin datos de nadie
  escribir(join(repo, 'docs-campo', nombre), Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01, 0x02, 0x00, 0xff]));
  git(repo, 'add', 'docs-campo');
  return guardia(repo);
}

test('cédulas: un PDF binario con tilde en el nombre («Órden de trabajo.pdf») se frena como cualquier PDF', (t) => {
  const r = preparar(t, 'Órden de trabajo.pdf');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

test('cédulas (control): el mismo PDF sin tilde se frena igual', (t) => {
  const r = preparar(t, 'orden-trabajo.pdf');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

test('cédulas: un PDF con COMILLAS dobles en el nombre se frena (el numstat sin -z lo entrecomillaba)', (t) => {
  const r = preparar(t, 'Acta "final".pdf');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

test('cédulas: un PDF con BARRA INVERTIDA en el nombre se frena', (t) => {
  const r = preparar(t, 'acta\\b.pdf');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

/** Un PDF ya versionado que se renombra EN LA MISMA CARPETA y cambia (numstat sin -z: «actas/{base.pdf => firmada.pdf}»). */
function renombrarEnLaMismaCarpeta(t) {
  const repo = repoTemporal(t);
  escribir(join(repo, 'actas', 'base.pdf'), binarioDeMentira(4000));
  git(repo, 'add', 'actas');
  git(repo, 'commit', '-q', '-m', 'acta base');
  const base = cabeza(repo);
  git(repo, 'mv', 'actas/base.pdf', 'actas/firmada.pdf');
  escribir(join(repo, 'actas', 'firmada.pdf'), Buffer.concat([binarioDeMentira(4000), Buffer.from([0x00, 0x41, 0x42, 0x00])]));
  git(repo, 'add', 'actas');
  // la prueba solo vale si git lo ve como renombre (si no, sería un PDF agregado y eso ya se frenaba)
  assert.match(git(repo, 'diff', '--cached', '--name-status'), /^R\d*\tactas\/base\.pdf\tactas\/firmada\.pdf$/m);
  return { repo, base };
}

test('cédulas: un PDF renombrado y cambiado en la MISMA carpeta se frena en el pre-commit', (t) => {
  const { repo } = renombrarEnLaMismaCarpeta(t);
  const r = guardia(repo);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

test('cédulas --push: el commit de ese renombre en la misma carpeta se frena', (t) => {
  const { repo, base } = renombrarEnLaMismaCarpeta(t);
  git(repo, 'commit', '-q', '-m', 'renombre');
  const r = empujar(repo, base);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

test('cédulas --push: un PDF con comillas en el nombre se frena (rama nueva)', (t) => {
  const repo = repoTemporal(t);
  escribir(join(repo, 'docs-campo', 'Acta "final".pdf'), binarioDeMentira(64));
  git(repo, 'add', 'docs-campo');
  git(repo, 'commit', '-q', '-m', 'acta');
  const r = empujar(repo, CERO);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

/** Un CSV de texto con una cédula INVENTADA, escondido como binario por un .gitattributes. */
function csvEscondido(t, atributo) {
  const repo = repoTemporal(t);
  escribir(join(repo, '.gitattributes'), `*.csv ${atributo}\n`);
  escribir(join(repo, 'datos', 'lista.csv'), `id;nombre;documento\n1;PERSONA UNO;${CEDULA_INVENTADA}\n`);
  git(repo, 'add', '.gitattributes', 'datos');
  return repo;
}

for (const atributo of ['-diff', 'binary']) {
  test(`cédulas: un .csv marcado «${atributo}» en .gitattributes no tapa la FORMA (pre-commit)`, (t) => {
    const repo = csvEscondido(t, atributo);
    const r = guardia(repo);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /seguida de un número/);
    assert.doesNotMatch(r.stdout + r.stderr, /10\.000\.001|10000001/, 'nunca imprime dígitos');
  });
}

test('cédulas --push: un .csv marcado «-diff» tampoco tapa la FORMA', (t) => {
  const repo = csvEscondido(t, '-diff');
  git(repo, 'commit', '-q', '-m', 'lista');
  const r = empujar(repo, CERO);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /seguida de un número/);
});

test('cédulas: «*.pdf diff» en .gitattributes no convierte un PDF en texto que pasa', (t) => {
  const repo = repoTemporal(t);
  escribir(join(repo, '.gitattributes'), '*.pdf diff\n');
  escribir(join(repo, 'docs-campo', 'acta.pdf'), binarioDeMentira(256));
  git(repo, 'add', '.gitattributes', 'docs-campo');
  const r = guardia(repo);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /documento binario/);
});

test('cédulas (control, sin falso rojo): «-diff» con un .csv limpio, una imagen binaria neutra y un texto pasan', (t) => {
  const repo = repoTemporal(t);
  escribir(join(repo, '.gitattributes'), '*.csv -diff\n');
  escribir(join(repo, 'datos', 'lista.csv'), 'id;equipo;estado\n1;TR-01;operativo\n2;TR-02;mantenimiento\n');
  escribir(join(repo, 'assets', 'img', 'logo.png'), binarioDeMentira(20000, 11));
  escribir(join(repo, 'notas.md'), 'Sin datos personales.\n');
  git(repo, 'add', '.gitattributes', 'datos', 'assets/img', 'notas.md');
  const r = guardia(repo);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  git(repo, 'commit', '-q', '-m', 'limpio');
  const p = empujar(repo, CERO);
  assert.equal(p.status, 0, p.stdout + p.stderr);
});

test('cédulas (control, sin falso rojo): un PDF que se BORRA no se frena en el pre-commit', (t) => {
  const repo = repoTemporal(t);
  escribir(join(repo, 'actas', 'vieja.pdf'), binarioDeMentira(128));
  git(repo, 'add', 'actas');
  git(repo, 'commit', '-q', '-m', 'acta vieja');
  git(repo, 'rm', '-q', 'actas/vieja.pdf');
  const r = guardia(repo);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// K-16: en --push y --historia el numstat no llevaba --diff-filter, así que BORRAR un documento binario daba un falso
// rojo (en la historia real, 129b0fc2 y ad5bc682 borran un .docx). Un borrado no sube nada; agregarlo sigue frenando.
/** Un repo con un commit que AGREGA un .docx de mentira y otro que solo lo BORRA. */
function agregarYBorrar(t) {
  const repo = repoTemporal(t);
  const base = cabeza(repo);
  escribir(join(repo, 'formatos', 'Formato de prueba.docx'), binarioDeMentira(512, 3));
  git(repo, 'add', 'formatos');
  git(repo, 'commit', '-q', '-m', 'formato');
  const conFormato = cabeza(repo);
  git(repo, 'rm', '-q', 'formatos/Formato de prueba.docx');
  git(repo, 'commit', '-q', '-m', 'limpieza');
  return { repo, base, conFormato };
}

test('cédulas --push (sin falso rojo): un commit que solo BORRA un documento binario pasa', (t) => {
  const { repo, conFormato } = agregarYBorrar(t);
  const r = empujar(repo, conFormato);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('cédulas --push (control): el commit que AGREGA ese documento se sigue frenando', (t) => {
  const { repo, base, conFormato } = agregarYBorrar(t);
  const r = empujar(repo, base);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok((r.stdout + r.stderr).includes(`commit ${conFormato.slice(0, 8)} · formatos/Formato de prueba.docx: documento binario`), r.stdout + r.stderr);
});

test('cédulas --push: en un rango con el alta y la baja del documento, frena SOLO el alta', (t) => {
  const { repo, base } = agregarYBorrar(t);
  const r = empujar(repo, base);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal((r.stdout + r.stderr).match(/documento binario/g).length, 1, 'el commit que solo borra no debe frenar: ' + r.stdout + r.stderr);
});

test('cédulas --push: un commit que borra un documento y AGREGA otro se frena solo por el nuevo', (t) => {
  const repo = repoTemporal(t);
  escribir(join(repo, 'actas', 'vieja.pdf'), binarioDeMentira(256, 5));
  git(repo, 'add', 'actas');
  git(repo, 'commit', '-q', '-m', 'acta vieja');
  const antes = cabeza(repo);
  git(repo, 'rm', '-q', 'actas/vieja.pdf');
  escribir(join(repo, 'actas', 'nueva.xlsx'), binarioDeMentira(256, 9));
  git(repo, 'add', 'actas');
  git(repo, 'commit', '-q', '-m', 'cambia el acta');
  const r = empujar(repo, antes);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /actas\/nueva\.xlsx: documento binario/);
  assert.doesNotMatch(r.stdout + r.stderr, /vieja\.pdf/);
});

test('cédulas --historia: un documento BORRADO no cuenta como «binario sin revisar»', (t) => {
  const { repo } = agregarYBorrar(t);
  const r = guardia(repo, ['--historia']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /· 1 binario\(s\) SIN revisar por texto/);
});
