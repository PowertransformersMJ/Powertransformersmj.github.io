#!/usr/bin/env node
// ===========================================================
// 🛑 Freno al PUBLICAR (99 §150, M-10) — instancia, no kernel
// ===========================================================
// Decisión del Ingeniero (2026-10-07): «Frenar al publicar». Tres veces (09-27, 10-02, 10-07) el
// código llegó a `main` citando decisiones (`99 §N`) cuyo ADR quedó sin guardar porque el candado
// de la auditoría frenaba DOCUMENTAR y no PUBLICAR. Ahora documentar nunca se bloquea (downgrade
// #14 en el manifest) y lo que se frena es publicar: un push a `main` (o `master`) cuyo código cita `99 §N`
// sin que `docs/99-HISTORIAL-ADR.md` DE ESE MISMO COMMIT tenga el encabezado `## N.`.
//
//   printf '<ref> <sha> <ref remoto> <sha remoto>\n' | node scripts/freno-publicar.mjs --push
//   node scripts/freno-publicar.mjs --rev <commit>        → revisa un commit a mano
//
// 2026-11-08 (99 §212, F8): el cerebro vive en la bóveda (brain-private/sgm-transpower/, hermana del repo PRINCIPAL;
// scripts/boveda.mjs la halla también desde un worktree). El 99 que manda
// es el del commit que se publica si aún lo trae (commits viejos) y si no, el COMMITEADO en la bóveda (su HEAD, no el
// disco): «el ADR se guarda antes de publicar» sigue siendo verificable. Sin bóveda NO se publica (fallo cerrado).
//
// Las funciones puras se prueban en tests/freno_publicar.test.js; `revisarCommit` también, con un LECTOR INYECTADO
// (sin la bóveda real), y el lector de git, en carpetas temporales con una bóveda falsa al lado (S7-07 de la N2 del 11-08).
// ===========================================================
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rutaBoveda } from './boveda.mjs';

const BOVEDA = rutaBoveda();
const RUTA_99_BOVEDA = 'sgm-transpower/docs/99-HISTORIAL-ADR.md';

/** Rutas de CÓDIGO que se publican (los docs del cerebro no cuentan: citan lo que quieran). */
export const RUTAS_CODIGO = Object.freeze([
  'assets', 'functions', 'pages', 'admin', 'api', 'firestore.rules', 'storage.rules',
  'index.html', 'home.html', 'tests', 'tests-rules'
]);

/** Números de ADR citados como «99 §N» (también «99 §N.M», «`99 §N`»). */
export function citasDeAdr(texto) {
  const out = new Set();
  for (const m of String(texto || '').matchAll(/(?<!\d)99 §(\d{1,4})\b/g)) out.add(Number(m[1]));
  return out;
}

/** Números de ADR que existen como encabezado «## N.» en el 99. */
export function encabezadosAdr(texto99) {
  const out = new Set();
  for (const m of String(texto99 || '').matchAll(/^## (\d{1,4})\./gm)) out.add(Number(m[1]));
  return out;
}

/** Citados que no tienen su ADR, en orden. */
export function faltantes(citas, encabezados) {
  return [...citas].filter((n) => !encabezados.has(n)).sort((a, b) => a - b);
}

// Las ramas que PUBLICAN: las de `on.push.branches` de .github/workflows/pages.yml (main y master). Antes solo se miraba
// main y un push que creara master con una cita sin su ADR pasaba el freno y se desplegaba (revisión de K-7, 2026-11-09).
// tests/freno_publicar.test.js exige que esta lista siga a la de pages.yml.
const ES_MAIN = /^refs\/heads\/(main|master)$/;
const CEROS = /^0+$/;

/** Los commits que este push lleva a una rama que publica: `main` o `master` (líneas del stdin de pre-push). */
export function commitsAMain(stdin) {
  return String(stdin || '').split('\n').map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 4 && ES_MAIN.test(p[2]) && !CEROS.test(p[1]))
    .map((p) => p[1]);
}

function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return e.status === 1 ? '' : (() => { throw e; })(); }   // grep sin coincidencias = 1
}

/** Un archivo leído de git, o null si no está (sin repo, sin commit o sin la ruta). No ensucia la consola. */
function mostrar(args, env = process.env) {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], env }); }
  catch { return null; }
}

/**
 * El entorno para leer OTRO repo (la bóveda). Dentro de un gancho, git fija GIT_DIR, GIT_INDEX_FILE… del SITIO, y
 * `git -C <bóveda>` los obedece: leía el repo del sitio y frenaba todo push a main que citara un ADR, aunque el ADR
 * estuviera commiteado en la bóveda (K-7, 2026-11-09; roto desde la mudanza de `99 §212`). Se quitan las variables
 * que atan git a un repo concreto.
 */
const SIN_REPO_DEL_GANCHO = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
  !['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR', 'GIT_PREFIX', 'GIT_NAMESPACE', 'GIT_QUARANTINE_PATH'].includes(k)));

/**
 * Lo que el freno LEE, con git. Es el lector por defecto de `revisarCommit`; las pruebas le pasan uno falso con la misma
 * forma (S7-07): `citado(sha)` → salida de `git grep` con las citas del código ('' si no hay) · `el99DelCommit(sha)` → el
 * 99 que trae el commit (commits de antes de la mudanza) o null · `el99DeLaBoveda()` → el 99 COMMITEADO en la bóveda
 * (su HEAD, no el disco) o null.
 */
const LECTOR_GIT = Object.freeze({
  citado: (sha) => git(['grep', '-I', '-o', '-E', '99 §[0-9]+', sha, '--', ...RUTAS_CODIGO]),
  el99DelCommit: (sha) => mostrar(['show', `${sha}:docs/99-HISTORIAL-ADR.md`]),
  el99DeLaBoveda: () => mostrar(['-C', BOVEDA, 'show', `HEAD:${RUTA_99_BOVEDA}`], SIN_REPO_DEL_GANCHO)
});

/** Revisa un commit: [] si todo lo citado tiene su ADR; ['SIN-99'] si no hay 99 ni en el commit ni en la bóveda. */
export function revisarCommit(sha, lector = LECTOR_GIT) {
  const citado = lector.citado(sha);
  let h99 = lector.el99DelCommit(sha);
  if (h99 === null) h99 = lector.el99DeLaBoveda();
  if (h99 === null) return ['SIN-99'];
  return faltantes(citasDeAdr(citado), encabezadosAdr(h99));
}

function main() {
  const args = process.argv.slice(2);
  let shas = [];
  if (args[0] === '--rev' && args[1]) shas = [args[1]];
  else if (args[0] === '--push') shas = commitsAMain(readStdin());
  else { console.log('uso: --push (stdin de pre-push) | --rev <commit>'); process.exit(2); }
  let malo = false;
  for (const sha of shas) {
    const f = revisarCommit(sha);
    if (f[0] === 'SIN-99') {
      malo = true;
      console.log(`⛔ FRENO AL PUBLICAR (99 §150): no encuentro el 99 ni en ${sha.slice(0, 7)} ni commiteado en la bóveda (${BOVEDA}/${RUTA_99_BOVEDA}). Sin el 99 no se puede comprobar: NO se publica.`);
    } else if (f.length) {
      malo = true;
      console.log(`⛔ FRENO AL PUBLICAR (99 §150): ${sha.slice(0, 7)} lleva código que cita ${f.map((n) => '99 §' + n).join(', ')}, ` +
        'pero esos ADR no están en el 99 (del commit o, desde la mudanza, commiteado en la bóveda).\n' +
        '   Guarde primero el ADR (commit del cerebro en la BÓVEDA) y vuelva a publicar. Documentar nunca está bloqueado.');
    }
  }
  process.exit(malo ? 1 : 0);
}

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
