#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// Guardia «cero cerebro en el sitio» (99 §212; auditoría N2 del 2026-11-08, K-7 / S7-10).
// ──────────────────────────────────────────────────────────────
// El repositorio es PÚBLICO y, desde §212, el cerebro vive en la bóveda privada
// (brain-private/sgm-transpower, hermana del repo PRINCIPAL; desde un worktree no es «../»).
// Aquí solo queda el PUENTE: un CLAUDE.md corto.
// Esta guardia frena que el cerebro vuelva al repo:
//   · cualquier archivo bajo `docs/`, salvo las fichas que la web carga
//     (`docs/pruebas/<nombre>.json`: las pide `assets/js/pruebas-electricas-shell.js`
//     y Pages las publica, §211);
//   · cualquier archivo bajo `skills/` o `_legacy/`;
//   · cualquier archivo bajo una carpeta `.claude/` (en cualquier nivel), salvo `.claude/settings.json`
//     de la raíz, lo único versionado (reglas, skills y router de Claude no van al sitio);
//   · en CUALQUIER carpeta, los nombres propios del cerebro (05-ESTADO-GLOBAL.md, 10-MEMORIA-CORTO-PLAZO.md,
//     99-HISTORIAL-ADR.md) y los SKILL.md: así un cerebro copiado bajo un docs/ anidado también frena,
//     sin bloquear las carpetas docs/ legítimas del sitio (p. ej. assets/docs/);
//   · un CLAUDE.md, AGENTS.md o GEMINI.md (o su .local.md), en cualquier carpeta, de más de
//     TOPE_PUENTE_BYTES: el puente mide ~1,6 kB; el router de antes, ~25 kB.
// Solo mira RUTAS y TAMAÑOS (nunca imprime contenido). Borrar cerebro siempre pasa.
// El registro de CI es PÚBLICO: con --arbol o dentro de GitHub Actions no imprime rutas, solo la
// categoría y el conteo (un nombre de archivo puede llevar un dato; L-140).
//
// Uso:  node scripts/guardia-cero-cerebro.mjs                  (lo preparado: pre-commit)
//       node scripts/guardia-cero-cerebro.mjs --push           (lo que se sube: pre-push, refs por stdin)
//       node scripts/guardia-cero-cerebro.mjs --arbol          (todo lo versionado: CI; sin rutas)
//       node scripts/guardia-cero-cerebro.mjs --arbol --rutas  (lo mismo con rutas, solo en tu máquina)
// ══════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Tope del puente en BYTES (el de hoy: 1.605 B, 2026-11-09). Subirlo pide su ADR en la bóveda. */
export const TOPE_PUENTE_BYTES = 2048;

const CARPETA_CEREBRO = /^(docs|skills|_legacy)\//i;
const FICHA_DEL_SITIO = /^docs\/pruebas\/[^/]+\.json$/;
/** Una carpeta `.claude/` en cualquier nivel; de ella solo se versiona el settings.json de la raíz. */
const CARPETA_CLAUDE = /(^|\/)\.claude\//i;
const SETTINGS_VERSIONADO = '.claude/settings.json';
/** Nombres propios del cerebro (estado global, memoria de corto plazo, historial de ADR), en cualquier carpeta. */
const NOMBRE_DEL_CEREBRO = /(^|\/)(05-ESTADO-GLOBAL|10-MEMORIA-CORTO-PLAZO|99-HISTORIAL-ADR)\.md$/i;
const ARCHIVO_SKILL = /(^|\/)SKILL\.md$/i;
/** Archivos de instrucciones que el agente carga solo (puentes): CLAUDE.md, AGENTS.md, GEMINI.md. */
const ARCHIVO_PUENTE = /(^|\/)(CLAUDE|AGENTS|GEMINI)(\.local)?\.md$/i;
const CEROS = /^0+$/;

/** Categorías (sin rutas): es lo único que se imprime en un registro público. */
export const CATEGORIAS = {
  docs: 'docs/ (fuera de las fichas docs/pruebas/*.json)',
  skills: 'skills/',
  legacy: '_legacy/',
  claude: '.claude/ (fuera de .claude/settings.json)',
  nombre: 'archivo con nombre del cerebro (05-ESTADO-GLOBAL, 10-MEMORIA-CORTO-PLAZO o 99-HISTORIAL-ADR)',
  skill: 'SKILL.md',
  puente: 'CLAUDE.md, AGENTS.md o GEMINI.md de más de ' + TOPE_PUENTE_BYTES + ' B',
};

/** Clasifica una ruta (sin mirar tamaños): {categoria, motivo} o null. */
function clasificarRuta(ruta) {
  const r = String(ruta || '').replace(/^\.\//, '');
  if (CARPETA_CEREBRO.test(r)) {
    if (FICHA_DEL_SITIO.test(r)) return null;
    const carpeta = r.split('/')[0].toLowerCase();
    if (carpeta === 'docs') return { categoria: CATEGORIAS.docs, motivo: 'docs/ es del cerebro; en el sitio solo van las fichas docs/pruebas/*.json' };
    return { categoria: carpeta === 'skills' ? CATEGORIAS.skills : CATEGORIAS.legacy, motivo: carpeta + '/ es del cerebro' };
  }
  if (CARPETA_CLAUDE.test(r) && r !== SETTINGS_VERSIONADO) {
    return { categoria: CATEGORIAS.claude, motivo: '.claude/ es de Claude, no del sitio; solo se versiona .claude/settings.json' };
  }
  if (NOMBRE_DEL_CEREBRO.test(r)) return { categoria: CATEGORIAS.nombre, motivo: 'es un archivo del cerebro, en cualquier carpeta' };
  if (ARCHIVO_SKILL.test(r)) return { categoria: CATEGORIAS.skill, motivo: 'un SKILL.md es del cerebro, en cualquier carpeta' };
  return null;
}

/** ¿Esta ruta es cerebro que no debe estar en el sitio? Devuelve el motivo o ''. */
export function rutaDeCerebro(ruta) {
  const c = clasificarRuta(ruta);
  return c ? c.motivo : '';
}

/** ¿Un CLAUDE.md, AGENTS.md o GEMINI.md que dejó de ser un puente? Devuelve el motivo o ''. */
export function claudeGordo(ruta, bytes) {
  if (!ARCHIVO_PUENTE.test(String(ruta || ''))) return '';
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= TOPE_PUENTE_BYTES) return '';
  return n + ' B > ' + TOPE_PUENTE_BYTES + ' B: en el sitio solo va el puente';
}

/** Revisa [{ruta, bytes}] y devuelve [{ruta, motivo, categoria}] (bytes solo hace falta para los puentes). */
export function revisar(entradas) {
  const out = [];
  for (const { ruta, bytes } of entradas || []) {
    const c = clasificarRuta(ruta);
    if (c) { out.push({ ruta, motivo: c.motivo, categoria: c.categoria }); continue; }
    const gordo = claudeGordo(ruta, bytes);
    if (gordo) out.push({ ruta, motivo: gordo, categoria: CATEGORIAS.puente });
  }
  return out;
}

/** ¿Se pueden imprimir rutas? Nunca en GitHub Actions (registro público); con --arbol, solo si se pide --rutas. */
export function rutasVisibles(modo, argv = [], env = {}) {
  if (env.GITHUB_ACTIONS) return false;
  if (modo === 'arbol') return argv.includes('--rutas');
  return true;
}

/** Resumen para un registro público: «categoría: N archivo(s)», contando cada ruta una vez y sin nombrarla. */
export function resumenPublico(hallazgos) {
  const porCategoria = new Map();
  for (const { ruta, categoria } of hallazgos || []) {
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, new Set());
    porCategoria.get(categoria).add(ruta);
  }
  return [...porCategoria].map(([categoria, rutas]) => categoria + ': ' + rutas.size + ' archivo(s)');
}

/**
 * Commits que se suben, del stdin de pre-push: [{ref, local, rango}] (sin borrados de rama).
 * El rango excluye también lo que ya está en CUALQUIER rama remota: un commit que ya es público
 * (p. ej. el de DESARROLLO que el merge lleva a main) no publica nada nuevo. Sin esto, el merge
 * de 99 §212 (f3c2c3d..6accdc3) habría dado rojo por 6a6ebae, que ya estaba en origin/DESARROLLO.
 */
export function subidasDePush(stdin) {
  const out = [];
  for (const linea of String(stdin || '').split('\n').filter(Boolean)) {
    const [ref, local, , remoto] = linea.trim().split(/\s+/);
    if (!local || CEROS.test(local)) continue;
    const rango = !remoto || CEROS.test(remoto) ? [local, '--not', '--remotes'] : [local, '--not', remoto, '--remotes'];
    out.push({ ref, local, rango });
  }
  return out;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
const lista = (salida) => salida.split('\0').filter(Boolean);
function bytesDe(objeto) {
  try { return Number(git(['cat-file', '-s', objeto]).trim()); } catch (_) { return NaN; }
}

/** pre-commit: lo preparado (agregado, copiado, modificado, renombrado o cambiado de tipo). */
function entradasPreparadas() {
  return lista(git(['diff', '--cached', '--name-only', '--diff-filter=ACMRT', '-z']))
    .map((ruta) => ({ ruta, bytes: ARCHIVO_PUENTE.test(ruta) ? bytesDe(':' + ruta) : 0 }));
}

/** CI: todo lo versionado (el índice; en CI es el árbol del commit). */
function entradasDelArbol() {
  return lista(git(['ls-files', '-z'])).map((ruta) => {
    if (!ARCHIVO_PUENTE.test(ruta)) return { ruta, bytes: 0 };
    let bytes = bytesDe(':' + ruta);
    if (!Number.isFinite(bytes)) { try { bytes = statSync(ruta).size; } catch (_) { bytes = 0; } }
    return { ruta, bytes };
  });
}

/** Árbol completo de un commit con tamaños (git ls-tree -r -l). */
function entradasDeCommit(sha) {
  return lista(git(['ls-tree', '-r', '-l', '-z', sha])).map((l) => {
    const tab = l.indexOf('\t');
    const meta = l.slice(0, tab).trim().split(/\s+/);
    return { ruta: l.slice(tab + 1), bytes: Number(meta[3]) };
  });
}

/**
 * pre-push: cada commit del rango (lo que agrega o cambia) y la punta de cada rama que se sube.
 * Devuelve {lineas} (con rutas, para tu máquina) y {hallazgos} (todos, para el resumen sin rutas).
 */
function bloqueosDePush(stdin) {
  const lineas = [];
  const hallazgos = [];
  for (const { ref, local, rango } of subidasDePush(stdin)) {
    let shas;
    try { shas = git(['rev-list', ...rango]).split('\n').filter(Boolean); }
    catch (_) { shas = git(['rev-list', local, '--not', '--remotes']).split('\n').filter(Boolean); }
    for (const sha of shas) {
      const rutas = [...new Set(lista(git(['diff-tree', '-r', '-m', '--root', '--no-commit-id', '--name-only', '--diff-filter=ACMRT', '-z', sha])))];
      const entradas = rutas.map((ruta) => ({ ruta, bytes: ARCHIVO_PUENTE.test(ruta) ? bytesDe(sha + ':' + ruta) : 0 }));
      for (const h of revisar(entradas)) {
        lineas.push('commit ' + sha.slice(0, 8) + ': ' + h.ruta + ' (' + h.motivo + ')');
        hallazgos.push(h);
      }
    }
    const punta = revisar(entradasDeCommit(local));
    hallazgos.push(...punta);
    for (const h of punta.slice(0, 5)) lineas.push('punta de ' + (ref || local.slice(0, 8)) + ': ' + h.ruta + ' (' + h.motivo + ')');
    if (punta.length > 5) lineas.push('punta de ' + (ref || local.slice(0, 8)) + ': … y ' + (punta.length - 5) + ' rutas de cerebro más');
  }
  return { lineas, hallazgos };
}

const COMO_SEGUIR = {
  preparado: [
    'Sácalo de lo preparado sin perder nada: git restore --staged <ruta> (el archivo sigue en tu disco).',
    'El cerebro (router, docs/, ADR, lecciones, skills) se escribe y se commitea en la bóveda (brain-private/sgm-transpower).',
  ],
  push: [
    'Una rama o etiqueta de antes de 99 §212 trae el cerebro viejo entero: no se sube; rehaz el trabajo sobre la rama actual.',
    'Si son commits nuevos, aún no son públicos: arma una rama nueva desde el remoto (git switch -c <nueva> origin/<rama>)',
    'y pasa con git cherry-pick solo los commits sanos; el cerebro se commitea en la bóveda (brain-private/sgm-transpower).',
  ],
  arbol: [
    'Lleva el archivo a la bóveda (brain-private/sgm-transpower) y commitéalo allí;',
    'luego sácalo del sitio con git rm --cached <ruta> (queda en tu disco) y commitea ese retiro.',
  ],
};

function principal(argv, env = process.env) {
  const modo = argv.includes('--push') ? 'push' : argv.includes('--arbol') ? 'arbol' : 'preparado';
  let lineas;
  let hallazgos;
  if (modo === 'push') {
    let entrada = '';
    try { entrada = readFileSync(0, 'utf8'); } catch (_) { entrada = ''; }
    ({ lineas, hallazgos } = bloqueosDePush(entrada));
  } else {
    hallazgos = revisar(modo === 'arbol' ? entradasDelArbol() : entradasPreparadas());
    lineas = hallazgos.map((h) => h.ruta + ' (' + h.motivo + ')');
  }
  if (!hallazgos.length) return 0;
  const conRutas = rutasVisibles(modo, argv, env);
  const que = { preparado: 'lo preparado', push: 'lo que se sube', arbol: 'lo versionado' }[modo];
  console.log('🔒 guardia-cero-cerebro: ' + que + ' devuelve CEREBRO al sitio, y el repo es PÚBLICO (99 §212):');
  if (conRutas) {
    const unicos = [...new Set(lineas)];
    for (const x of unicos.slice(0, 30)) console.log('   · ' + x);
    if (unicos.length > 30) console.log('   · … y ' + (unicos.length - 30) + ' más');
  } else {
    for (const x of resumenPublico(hallazgos)) console.log('   · ' + x);
    console.log('   (Las rutas no se imprimen: este registro puede ser público y un nombre de archivo puede llevar un dato.');
    console.log('   En tu máquina, fuera de CI, las lista: node scripts/guardia-cero-cerebro.mjs --arbol --rutas)');
  }
  console.log('   Cómo seguir:');
  for (const l of COMO_SEGUIR[modo]) console.log('   ' + l);
  console.log('   Una ficha que la web carga va en docs/pruebas/<NN-nombre>.json. Si el puente de verdad necesita');
  console.log('   crecer, se sube TOPE_PUENTE_BYTES en scripts/guardia-cero-cerebro.mjs con su ADR, nunca saltando el hook.');
  return 1;
}

// Mismo criterio que scripts/boveda.mjs: realpath, para que una ruta por un enlace (en macOS /tmp → /private/tmp)
// no deje la guardia en «exit 0 sin revisar nada».
const esPrincipal = (() => {
  try { return realpathSync(process.argv[1] || '') === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (esPrincipal) process.exit(principal(process.argv.slice(2)));
