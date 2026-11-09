#!/usr/bin/env node
// ===========================================================
// 🗄️ boveda.mjs — dónde está la bóveda privada (cerebro y kernel de SGM), desde CUALQUIER checkout
// ===========================================================
// La bóveda `brain-private/` es hermana de la carpeta del repo PRINCIPAL. Un worktree (`.claude/worktrees/<n>/`)
// vive en otra carpeta y ahí la hermana brain-private no existe (L-111; S7-01 de la N2 del 2026-11-08). La carpeta del
// principal es la de arriba de `git rev-parse --path-format=absolute --git-common-dir` (lo mismo que ya hacían las
// guardias de cédulas y firmas). Sin git, la de este checkout. Por aquí llegan a la bóveda el pre-commit, 6 de los 7
// hooks de .claude/settings.json, los `npm run brain:*`, el freno y el saneamiento. Dos sitios no pueden correr código
// o los lee el kernel como texto, y van por la ruta fija de este Mac (`~/Proyectos/brain-private`): el puente
// (CLAUDE.md, `@~/…`) y el SessionStart `--boot-echo` (el gate #18 [a] tiene que ver el session-handoff.mjs que corre).
//
//   node scripts/boveda.mjs                      → imprime la ruta de la bóveda (exit 1 si no está, con el porqué)
//   node scripts/boveda.mjs <kernel> [args…]     → node <bóveda>/kernel/<kernel>.mjs --root <bóveda>/sgm-transpower
//                                                   --sitio <este checkout> [args…]   (brain-diff, sin --root/--sitio)
// Si falta la bóveda:
//   (por defecto)        aviso a stderr y exit 1: npm y pre-commit fallan CERRADO.
//   --si-falta=avisar    aviso a stdout y exit 0: hook de arranque (Claude lo ve en su contexto).
//   --si-falta=callar    aviso a stderr y exit 0: hooks de latido y cierre (nunca bloquear la sesión).
// Con --si-falta=avisar|callar nunca sale con 2 (en un hook, 2 bloquea el prompt, la compactación o el cierre).
// ===========================================================
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** La carpeta de ESTE checkout (principal o worktree): la de arriba de scripts/. */
export const SITIO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** El cerebro de SGM dentro de la bóveda. */
export const CEREBRO = 'sgm-transpower';
/** Scripts del kernel que no llevan --root/--sitio (brain-diff mira la carpeta de arriba de la bóveda). */
const SIN_RAIZ = new Set(['brain-diff']);

/** Carpeta del repo PRINCIPAL vista desde `desde` (un worktree o el propio principal). */
export function raizPrincipal(desde = SITIO) {
  try {
    const comun = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: desde, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (comun && basename(comun) === '.git') return dirname(comun);
  } catch { /* sin git o fuera de un repo: abajo */ }
  return desde;
}

/** Ruta de la bóveda: hermana del repo principal. No comprueba que exista. */
export function rutaBoveda(desde = SITIO) {
  return resolve(raizPrincipal(desde), '..', 'brain-private');
}

/** Por qué falta y cómo seguir (sin jerga: lo puede leer el Ingeniero). */
export function avisoSinBoveda(falta, desde = SITIO) {
  const principal = raizPrincipal(desde);
  return [
    `⚠️  No encuentro la bóveda privada de SGM: falta ${falta}.`,
    `   Se busca junto al repo PRINCIPAL (${principal}), que da \`git rev-parse --git-common-dir\`; así sirve`,
    '   igual desde un worktree. Sin ella no corren el linter, el latido ni el escáner de secretos, y el cerebro',
    '   (router, 05 y 10) no está a mano.',
    `   Cómo seguir: la bóveda tiene que estar en ${resolve(principal, '..', 'brain-private')}. Si se movió,`,
    '   devuélvela ahí; en una máquina sin bóveda (por ejemplo, CI) este paso no se puede hacer.'
  ].join('\n');
}

export function main(argv) {
  let siFalta = 'fallar';
  const resto = [];
  for (const a of argv) {
    const m = /^--si-falta=(avisar|callar|fallar)$/.exec(a);
    if (m) siFalta = m[1]; else resto.push(a);
  }
  const [kernel, ...args] = resto;
  if (kernel !== undefined && !/^[a-z][a-z0-9-]*$/.test(kernel)) {
    console.error(`uso: node scripts/boveda.mjs [<script del kernel, p. ej. brain-check>] [args…] [--si-falta=avisar|callar]`);
    return siFalta === 'fallar' ? 1 : 0;
  }
  const boveda = rutaBoveda();
  const destino = kernel ? join(boveda, 'kernel', `${kernel}.mjs`) : boveda;
  if (!existsSync(destino)) {
    const aviso = avisoSinBoveda(destino);
    if (siFalta === 'avisar') { console.log(aviso); return 0; }
    console.error(aviso);
    return siFalta === 'callar' ? 0 : 1;
  }
  if (!kernel) { console.log(boveda); return 0; }
  const raiz = SIN_RAIZ.has(kernel) ? [] : ['--root', join(boveda, CEREBRO), '--sitio', SITIO];
  const r = spawnSync(process.execPath, [destino, ...raiz, ...args], { stdio: 'inherit' });
  if (r.error) { console.error(`⚠️  boveda.mjs: no pude correr ${destino}: ${r.error.message}`); return siFalta === 'fallar' ? 1 : 0; }
  if (r.status === null) return siFalta === 'fallar' ? 1 : 0;   // terminado por una señal (p. ej. el timeout del hook)
  return r.status === 2 && siFalta !== 'fallar' ? 1 : r.status;
}

const esPrincipal = (() => {
  try { return realpathSync(process.argv[1] || '') === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (esPrincipal) process.exit(main(process.argv.slice(2)));
