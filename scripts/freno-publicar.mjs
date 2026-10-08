#!/usr/bin/env node
// ===========================================================
// 🛑 Freno al PUBLICAR (99 §150, M-10) — instancia, no kernel
// ===========================================================
// Decisión del Ingeniero (2026-10-07): «Frenar al publicar». Tres veces (09-27, 10-02, 10-07) el
// código llegó a `main` citando decisiones (`99 §N`) cuyo ADR quedó sin guardar porque el candado
// de la auditoría frenaba DOCUMENTAR y no PUBLICAR. Ahora documentar nunca se bloquea (downgrade
// #14 en el manifest) y lo que se frena es publicar: un push a `main` cuyo código cita `99 §N`
// sin que `docs/99-HISTORIAL-ADR.md` DE ESE MISMO COMMIT tenga el encabezado `## N.`.
//
//   printf '<ref> <sha> <ref remoto> <sha remoto>\n' | node scripts/freno-publicar.mjs --push
//   node scripts/freno-publicar.mjs --rev <commit>        → revisa un commit a mano
//
// Las funciones puras se prueban en tests/freno_publicar.test.js (sin git).
// ===========================================================
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

const ES_MAIN = /^refs\/heads\/main$/;
const CEROS = /^0+$/;

/** Los commits que este push lleva a `main` (líneas del stdin de pre-push). */
export function commitsAMain(stdin) {
  return String(stdin || '').split('\n').map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 4 && ES_MAIN.test(p[2]) && !CEROS.test(p[1]))
    .map((p) => p[1]);
}

function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return e.status === 1 ? '' : (() => { throw e; })(); }   // grep sin coincidencias = 1
}

/** Revisa un commit: [] si todo lo citado tiene su ADR. */
export function revisarCommit(sha) {
  const citado = git(['grep', '-I', '-o', '-E', '99 §[0-9]+', sha, '--', ...RUTAS_CODIGO]);
  let h99 = '';
  try { h99 = execFileSync('git', ['show', `${sha}:docs/99-HISTORIAL-ADR.md`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { h99 = ''; }
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
    if (f.length) {
      malo = true;
      console.log(`⛔ FRENO AL PUBLICAR (99 §150): ${sha.slice(0, 7)} lleva código que cita ${f.map((n) => '99 §' + n).join(', ')}, ` +
        'pero esos ADR no están en docs/99-HISTORIAL-ADR.md de lo que se publica.\n' +
        '   Guarde primero el ADR (commit del cerebro en la rama) y vuelva a publicar. Documentar nunca está bloqueado.');
    }
  }
  process.exit(malo ? 1 : 0);
}

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
