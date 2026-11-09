// Guardia de datos SCADA en CI (S7-07@10-11; K-7 de la auditoría del 2026-11-08): revisa el RANGO del push o del
// PR, leído del evento de GitHub Actions, sin la bóveda. Se prueba en repos de git TEMPORALES con datos de forma
// inventada y ARMADOS POR PARTES: ninguna línea de este archivo tiene la forma completa (ver scada_carga_guardia.test.js).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rangoDeEvento } from '../scripts/guardia-scada.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDIA = join(RAIZ, 'scripts', 'guardia-scada.mjs');
const CEROS = '0'.repeat(40);
const NO_ESTA = 'a'.repeat(40);
const S = '/';
const ESTACION = 'Ficti' + 'cia';                       // inventada, pero con forma real (no empieza por «EstDemo»)
const CLAVE = S + ESTACION + S + 'swTr' + 'afo1';       // clave de punto inventada
const CIRCUITO = 'XYZ' + '301';                          // circuito inventado
const TABLA = 'Variables El' + 'éctricas 2026.csv';      // nombre de exporte CON tilde (git lo escapa sin -z)

let base, dir, c, evento;

function g(...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}
function commit(mensaje, archivos = {}) {
  const rutas = Object.keys(archivos);
  for (const r of rutas) writeFileSync(join(dir, r), archivos[r]);
  if (rutas.length) g('add', '--', ...rutas);
  g('commit', '-q', '--allow-empty', '-m', mensaje);
  return g('rev-parse', 'HEAD');
}
function correr(args, { nombre, ev, entrada, cwd = dir } = {}) {
  const env = { ...process.env };
  delete env.GITHUB_EVENT_NAME;
  delete env.GITHUB_EVENT_PATH;
  if (nombre) {
    writeFileSync(evento, JSON.stringify(ev || {}));
    env.GITHUB_EVENT_NAME = nombre;
    env.GITHUB_EVENT_PATH = evento;
  }
  const r = spawnSync(process.execPath, [GUARDIA, ...args], { cwd, encoding: 'utf8', env, input: entrada || '' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const push = (before, after, ref = 'refs/heads/main', cwd = dir) =>
  correr(['--ci'], { nombre: 'push', ev: { before, after, ref, repository: { default_branch: 'main' } }, cwd });

before(() => {
  base = mkdtempSync(join(tmpdir(), 'guardia-scada-ci-'));
  dir = join(base, 'repo');
  evento = join(base, 'evento.json');
  mkdirSync(dir);
  g('init', '-q', '-b', 'main');
  g('config', 'user.name', 'Prueba');
  g('config', 'user.email', 'prueba@example.invalid');
  g('config', 'commit.gpgsign', 'false');
  c = {};
  c.base = commit('base', { 'leeme.txt': 'hola\n' });
  g('update-ref', 'refs/remotes/origin/main', c.base);   // lo que el clon de CI ve como origin/main
  c.limpio = commit('limpio', { 'a.txt': 'nada\n' });
  c.clave = commit('agrega una nota', { 'b.txt': 'punto ' + CLAVE + '\n' });
  c.mensaje = commit('suma del circuito ' + CIRCUITO, { 'c.txt': 'x\n' });
  c.tabla = commit('agrega una tabla', { [TABLA]: 'a,b\n' });
  c.conTabla = commit('limpio, pero la tabla sigue en el árbol', { 'e.txt': 'z\n' });
  g('rm', '-q', '--', TABLA);
  c.sinTabla = commit('saca la tabla del árbol');
  c.limpio2 = commit('limpio 2', { 'd.txt': 'y\n' });
});
after(() => { rmSync(base, { recursive: true, force: true }); });

describe('rangoDeEvento (puro)', () => {
  test('push a main, push a otra rama, rama nueva, rama borrada y PR', () => {
    assert.deepEqual(rangoDeEvento('push', { before: 'b1', after: 'a1', ref: 'refs/heads/main' }).revList, ['b1..a1']);
    assert.equal(rangoDeEvento('push', { before: 'b1', after: 'a1', ref: 'refs/heads/main' }).alterno, null);
    // Fuera de main: TODO lo que la rama trae y main no (una corrida cancelada no deja nada sin revisar).
    assert.deepEqual(rangoDeEvento('push', { before: 'b1', after: 'a1', ref: 'refs/heads/claude/x' }).revList, ['a1', '--not', 'origin/main']);
    // Rama NUEVA: contra la principal, nunca «--not --remotes» (en CI la rama recién subida ya está en origin/).
    assert.deepEqual(rangoDeEvento('push', { before: CEROS, after: 'a1', ref: 'refs/heads/claude/x' }).revList, ['a1', '--not', 'origin/main']);
    assert.deepEqual(rangoDeEvento('push', { before: 'b1', after: 'a1', ref: 'refs/heads/x', repository: { default_branch: 'master' } }).revList, ['a1', '--not', 'origin/master']);
    assert.ok(rangoDeEvento('push', { before: 'b1', after: CEROS }).nada);
    const pr = rangoDeEvento('pull_request', { pull_request: { base: { sha: 'b1', ref: 'main' }, head: { sha: 'h1' } } });
    assert.deepEqual(pr.revList, ['b1..h1']);
    assert.ok(rangoDeEvento('pull_request', { pull_request: {} }).error);
  });
  test('lanzado a mano no tiene rango; un evento no previsto falla cerrado', () => {
    assert.ok(rangoDeEvento('workflow_dispatch', {}).nada);
    assert.ok(rangoDeEvento('merge_group', {}).error);
    assert.ok(rangoDeEvento('', null).error);
  });
});

describe('--ci sobre un repo temporal', () => {
  test('un push limpio pasa y dice cuántos commits revisó', () => {
    const r = push(c.base, c.limpio);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /✅ guardia-scada \(CI\): 1 commit/);
  });
  test('un push que agrega una clave de punto se frena, sin imprimir el dato', () => {
    const r = push(c.limpio, c.clave);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /agrega un dato SCADA/);
    assert.ok(!r.out.includes(ESTACION), 'imprimió el dato');
    assert.match(r.out, /ya está en GitHub/);
  });
  test('un dato solo en el MENSAJE del commit se frena', () => {
    const r = push(c.clave, c.mensaje);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /el mensaje trae un dato SCADA/);
    assert.ok(!r.out.includes(CIRCUITO), 'imprimió el dato');
  });
  test('una tabla de exporte con tilde en el nombre se frena, y en CI no se imprime el nombre', () => {
    const r = push(c.mensaje, c.tabla);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /un archivo con nombre de exporte SCADA/);
    assert.ok(!r.out.includes('Variables'), 'imprimió el nombre del archivo en un registro público');
  });
  test('en main solo cuenta lo NUEVO: el push siguiente, limpio, pasa aunque la historia ya traiga algo', () => {
    // La historia trae la tabla, pero ya salió del árbol (c.sinTabla): pasa.
    assert.equal(push(c.tabla, c.limpio2).code, 0);
  });
  test('un archivo con nombre de exporte que SIGUE en el árbol frena el push siguiente, sin imprimir su nombre', () => {
    // Revisión adversarial 2026-11-09: el push siguiente salía verde y pages.yml publicaba el árbol con el archivo.
    const r = push(c.tabla, c.conTabla);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /el árbol de \w+ trae 1 archivo/);
    assert.ok(!r.out.includes('Variables'), 'imprimió el nombre del archivo en un registro público');
    // En otra rama, aunque el commit ya esté en main (el rango queda vacío), el rojo sigue mientras esté en el árbol.
    g('update-ref', 'refs/remotes/origin/main', c.conTabla);
    try {
      const rama = push(c.conTabla, c.conTabla, 'refs/heads/DESARROLLO');
      assert.equal(rama.code, 1, rama.out);
      assert.match(rama.out, /0 commit/);
    } finally { g('update-ref', 'refs/remotes/origin/main', c.base); }
    // Al sacarlo del árbol en un commit nuevo, el push pasa.
    assert.equal(push(c.conTabla, c.sinTabla).code, 0);
  });
  test('la corrida a mano (también publica) revisa los nombres del árbol del checkout', () => {
    g('checkout', '-q', '--detach', c.conTabla);
    try {
      const sucia = correr(['--ci'], { nombre: 'workflow_dispatch', ev: {} });
      assert.equal(sucia.code, 1, sucia.out);
      assert.ok(!sucia.out.includes('Variables'), 'imprimió el nombre del archivo en un registro público');
    } finally { g('checkout', '-q', 'main'); }
  });
  test('en otra rama, un push limpio NO tapa el dato: sigue en rojo hasta que el commit esté en main', () => {
    const r = push(c.tabla, c.limpio2, 'refs/heads/DESARROLLO');
    assert.equal(r.code, 1, r.out);
    g('update-ref', 'refs/remotes/origin/main', c.limpio2);          // la rama ya se llevó a main
    try {
      const luego = push(c.limpio2, c.limpio2, 'refs/heads/DESARROLLO');
      assert.equal(luego.code, 0, luego.out);
    } finally { g('update-ref', 'refs/remotes/origin/main', c.base); }
  });
  test('rama nueva: revisa lo que trae y origin/main no', () => {
    // Como en el clon de CI, la rama recién subida YA está en origin/ («--not --remotes» la dejaría vacía).
    g('update-ref', 'refs/remotes/origin/claude/x', c.clave);
    g('update-ref', 'refs/remotes/origin/claude/y', c.base);
    const sucia = push(CEROS, c.clave, 'refs/heads/claude/x');
    assert.equal(sucia.code, 1, sucia.out);
    const yaEnMain = push(CEROS, c.base, 'refs/heads/claude/y');
    assert.equal(yaEnMain.code, 0, yaEnMain.out);
    assert.match(yaEnMain.out, /0 commit/);
  });
  test('push forzado: en otra rama se compara con origin/main; en main falla cerrado y dice cómo seguir', () => {
    const otra = push(NO_ESTA, c.clave, 'refs/heads/claude/x');
    assert.equal(otra.code, 1, otra.out);
    assert.match(otra.out, /--not origin\/main/);
    assert.equal(push(NO_ESTA, c.limpio, 'refs/heads/claude/x').code, 0);
    const enMain = push(NO_ESTA, c.limpio);
    assert.equal(enMain.code, 1, enMain.out);
    assert.match(enMain.out, /no encuentro el commit anterior/);
    assert.match(enMain.out, /Run workflow/);
  });
  test('PR: revisa base..head', () => {
    const pr = (b, h) => correr(['--ci'], { nombre: 'pull_request', ev: { pull_request: { base: { sha: b, ref: 'main' }, head: { sha: h } } } });
    assert.equal(pr(c.tabla, c.limpio2).code, 0);
    assert.equal(pr(c.limpio, c.mensaje).code, 1);
  });
  test('rama borrada y corrida a mano pasan (no hay commits nuevos); un evento no previsto o sin entorno, no', () => {
    assert.equal(push(c.limpio2, CEROS).code, 0);
    const mano = correr(['--ci'], { nombre: 'workflow_dispatch', ev: {} });
    assert.equal(mano.code, 0, mano.out);
    assert.match(mano.out, /ℹ️/);
    assert.equal(correr(['--ci'], { nombre: 'merge_group', ev: {} }).code, 1);
    const sinEntorno = correr(['--ci']);
    assert.equal(sinEntorno.code, 1, sinEntorno.out);
    assert.match(sinEntorno.out, /--rango/);
  });
});

describe('nombres en Unicode descompuesto (NFD, como llegan desde un Mac)', () => {
  test('--ci, --rango y --push frenan un xlsx de homologación con el nombre en NFD', () => {
    // La ruta se mete con «--index-info» (stdin): así git no la recompone (core.precomposeUnicode en macOS).
    const nfd = 'Homologación subestaciones.xlsx';
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: dir, input: 'x\n', encoding: 'utf8' }).trim();
    execFileSync('git', ['update-index', '--index-info'], { cwd: dir, input: '100644 ' + blob + '\t' + nfd + '\n' });
    g('commit', '-q', '-m', 'agrega un libro');
    const conNfd = g('rev-parse', 'HEAD');
    try {
      assert.ok(execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', conNfd], { cwd: dir, encoding: 'utf8' }).includes(nfd), 'git recompuso el nombre: la prueba no prueba NFD');
      const ci = push(c.limpio2, conNfd);                  // en main el rango es solo este commit
      assert.equal(ci.code, 1, ci.out);
      assert.ok(!ci.out.includes('Homologaci'), 'imprimió el nombre del archivo en un registro público');
      assert.equal(correr(['--rango', c.limpio2 + '..' + conNfd]).code, 1);
      assert.equal(correr(['--push'], { entrada: 'refs/heads/main ' + conNfd + ' refs/heads/main ' + c.limpio2 + '\n' }).code, 1);
    } finally { g('reset', '-q', '--hard', c.limpio2); }
  });
});

// Un «.gitattributes» con «*.csv -diff» o «binary», un textconv o un diff externo dejaban ciega la revisión por líneas
// en los 4 modos (revisión adversarial 2026-11-09). Repo temporal aparte: aquí se cambian atributos y configuración.
describe('.gitattributes, textconv y diff externo no ciegan la revisión por líneas', () => {
  let d;
  const gd = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8' }).trim();
  const FILA = S + ESTACION + S + 'swTr' + 'afo1' + S + 'I R' + S + 'Mv' + 'Moment,1,2,3';   // fila de exporte inventada
  function commitEn(mensaje, archivos) {
    for (const [r, t] of Object.entries(archivos)) writeFileSync(join(d, r), t);
    gd('add', '--', ...Object.keys(archivos));
    gd('commit', '-q', '-m', mensaje);
    return gd('rev-parse', 'HEAD');
  }
  const losTres = (antes, sha) => ({
    rango: correr(['--rango', antes + '..' + sha], { cwd: d }).code,
    push: correr(['--push'], { entrada: 'refs/heads/main ' + sha + ' refs/heads/main ' + antes + '\n', cwd: d }).code,
    ci: push(antes, sha, 'refs/heads/main', d).code,
  });
  before(() => {
    d = join(base, 'atributos');
    mkdirSync(d);
    gd('init', '-q', '-b', 'main');
    gd('config', 'user.name', 'Prueba');
    gd('config', 'user.email', 'prueba@example.invalid');
    gd('config', 'commit.gpgsign', 'false');
    gd('config', 'diff.vacio.textconv', 'true');            // un textconv que no deja ver nada
  });
  test('«*.csv -diff», «binary» y un textconv: --rango, --push y --ci frenan la fila', () => {
    const b0 = commitEn('atributos', { '.gitattributes': '*.csv -diff\n*.dat binary\n*.cnv diff=vacio\n', 'leeme.txt': 'hola\n' });
    const csv = commitEn('agrega datos', { 'datos.csv': 'a;b\n' + FILA + '\n' });
    assert.deepEqual(losTres(b0, csv), { rango: 1, push: 1, ci: 1 });
    const dat = commitEn('agrega datos 2', { 'datos.dat': FILA + '\n' });
    assert.deepEqual(losTres(csv, dat), { rango: 1, push: 1, ci: 1 });
    const cnv = commitEn('agrega datos 3', { 'datos.cnv': FILA + '\n' });
    assert.deepEqual(losTres(dat, cnv), { rango: 1, push: 1, ci: 1 });
  });
  test('pre-commit: frena con «-diff» y con un diff externo configurado', () => {
    writeFileSync(join(d, 'otra.csv'), FILA + '\n');
    gd('add', '--', 'otra.csv');
    try {
      assert.equal(correr([], { cwd: d }).code, 1);
      gd('config', 'diff.external', 'true');               // un diff externo que no imprime nada
      try { assert.equal(correr([], { cwd: d }).code, 1); } finally { gd('config', '--unset', 'diff.external'); }
    } finally { gd('reset', '-q', '--hard', 'HEAD'); }
  });
  test('un binario de verdad (con NUL) no da un falso rojo aunque traiga por azar algo con forma', () => {
    // Medido el 2026-11-09: con --text a secas, un PNG real de la historia del repo daba un «circuito» por azar.
    const antes = gd('rev-parse', 'HEAD');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('\n ' + CIRCUITO + ' \n')]);
    const foto = commitEn('agrega una foto', { 'foto.png': png });
    assert.deepEqual(losTres(antes, foto), { rango: 0, push: 0, ci: 0 });
    // Un binario MODIFICADO cuyo pedazo nuevo no trae NUL: se decide por el archivo entero, no por el pedazo.
    const bin0 = commitEn('agrega un binario', { 'tabla.bin': Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from('\nuno\ndos\n')]) });
    const bin1 = commitEn('cambia el binario', { 'tabla.bin': Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from('\nuno\n' + CIRCUITO + '\n')]) });
    assert.deepEqual(losTres(bin0, bin1), { rango: 0, push: 0, ci: 0 });
    writeFileSync(join(d, 'foto2.png'), png);
    gd('add', '--', 'foto2.png');
    try { assert.equal(correr([], { cwd: d }).code, 0); } finally { gd('reset', '-q', '--hard', 'HEAD'); }
  });
});

describe('--rango y --push', () => {
  test('--rango revisa a mano y sí muestra el nombre del archivo', () => {
    assert.equal(correr(['--rango', c.base + '..' + c.limpio]).code, 0);
    const r = correr(['--rango', c.mensaje + '..' + c.tabla]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /Variables/);
    assert.equal(correr(['--rango', '--all']).code, 1);
    assert.equal(correr(['--rango', NO_ESTA + '..' + c.limpio]).code, 1);
  });
  test('--push (pre-push) sigue igual y ahora también ve los nombres con tilde', () => {
    const linea = (local, remoto) => 'refs/heads/main ' + local + ' refs/heads/main ' + remoto + '\n';
    assert.equal(correr(['--push'], { entrada: linea(c.limpio, c.base) }).code, 0);
    assert.equal(correr(['--push'], { entrada: linea(c.clave, c.limpio) }).code, 1);
    const tabla = correr(['--push'], { entrada: linea(c.tabla, c.mensaje) });
    assert.equal(tabla.code, 1, tabla.out);
    assert.match(tabla.out, /Variables/);
  });
});

describe('ci.yml', () => {
  test('corre la guardia con la historia completa (sin ella no hay commit anterior ni origin/main)', () => {
    const yml = readFileSync(join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
    const i = yml.indexOf('\n  guardia-scada:');
    assert.ok(i > 0, 'falta el job guardia-scada en ci.yml');
    const resto = yml.slice(i + 1);
    const fin = resto.search(/\n  [A-Za-z][\w-]*:\s*\n/);   // el job siguiente, si lo hay
    const job = fin > 0 ? resto.slice(0, fin) : resto;
    assert.match(job, /fetch-depth: 0/);
    assert.match(job, /run: node scripts\/guardia-scada\.mjs --ci/);
  });
});
