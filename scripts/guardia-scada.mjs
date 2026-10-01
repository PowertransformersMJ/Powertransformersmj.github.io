#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// Guardia de datos SCADA (ADR-122) — ningún dato de red real entra al repo.
// ──────────────────────────────────────────────────────────────
// El repositorio es PÚBLICO. Las mediciones SCADA, los nombres de sus puntos
// y la tabla que los cruza con las matrículas son información operativa del
// cliente: viven en Firestore (detrás de la sesión), nunca aquí.
//
// Bloquea por FORMA, sin lista de nombres reales en el repo:
//   · una línea con la marca de fila de los exportes del SCADA (la palabra del tipo de medida);
//   · una clave de punto con forma real: barra, estación, barra, elemento (transformador
//     swTrafo, swTrf o swAuto con número, circuito de tres letras y 3xx, o línea LN con número),
//     con o sin el nivel de tensión en medio;
//   · un archivo .csv/.xls/.xlsx cuyo nombre hable del exporte o de la homologación.
// Los datos de prueba usan estaciones inventadas que empiezan por «EstDemo»: pasan.
// Revisa SOLO lo que se agrega (líneas nuevas del diff y archivos nuevos), y el
// mensaje del commit (también es público). Nunca imprime lo que encontró.
//
// Uso:  node scripts/guardia-scada.mjs              (lo preparado: pre-commit)
//       node scripts/guardia-scada.mjs --mensaje F   (mensaje del commit: commit-msg)
//       node scripts/guardia-scada.mjs --push        (lo que se sube: pre-push, refs por stdin)
//       node scripts/guardia-scada.mjs --probar F    (un archivo cualquiera)
// ══════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEMO = /EstDemo/;
// Una fila de exporte del SCADA.
const FILA = new RegExp('Mv' + 'Moment');
// Ejemplos con forma: '/EstDemo1/swTrafo1', '/EstDemo1 /13.8kV  /swTrafo1' — el primer segmento es la estación,
// con alguna minúscula (los modelos de equipos «ZN045/FN050» no son estaciones); los circuitos son
// tres letras y un número de la serie 3xx, o una línea LNnnn.
const CLAVE = /\/\s*((?=[A-Za-zÀ-ÿñÑ0-9]*[a-zà-ÿñ])[A-Za-zÀ-ÿñÑ][A-Za-zÀ-ÿñÑ0-9]{1,9})\s*\/(?:\s*[0-9.,]+\s*k[vV]\s*\/)?\s*(swTr[A-Za-z]*\d+|swAuto\d+|[A-Z]{3}3\d{2}|LN\d{3})\b/;
const ARCHIVO = new RegExp('(variables[ _-]?el[eé]ctricas|homologaci[oó]n|swtrafo|' + 'mv' + 'moment|_average[-_]|_quality[-_]|ir_current|p_average|urs_average)', 'i');
const TABLA = /\.(csv|xls|xlsx)$/i;

/** ¿Este texto trae un dato SCADA con forma real? Devuelve el motivo (sin el dato) o ''. */
export function motivoEnLinea(linea) {
  const s = String(linea || '');
  if (DEMO.test(s)) return '';
  if (FILA.test(s)) return 'fila de un exporte del SCADA';
  if (CLAVE.test(s)) return 'clave de un punto SCADA';
  return '';
}

/** Revisa varias líneas; devuelve [{n, motivo}] (n = número de línea, empezando en 1). */
export function revisarTexto(texto) {
  const out = [];
  String(texto || '').split(/\r?\n/).forEach((l, i) => {
    const m = motivoEnLinea(l);
    if (m) out.push({ n: i + 1, motivo: m });
  });
  return out;
}

/** ¿El nombre de un archivo preparado delata un exporte o la homologación? */
export function archivoSospechoso(ruta) {
  return TABLA.test(ruta) && ARCHIVO.test(ruta);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Líneas AGREGADAS por archivo en lo preparado (git diff --cached -U0). */
function lineasAgregadas() {
  const diff = git(['diff', '--cached', '-U0', '--no-color', '--diff-filter=ACMRT']);
  const porArchivo = new Map();
  let actual = null;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { actual = l.slice(4).replace(/^b\//, ''); continue; }
    if (actual && l.startsWith('+') && !l.startsWith('+++')) {
      if (!porArchivo.has(actual)) porArchivo.set(actual, []);
      porArchivo.get(actual).push(l.slice(1));
    }
  }
  return porArchivo;
}

/** Líneas agregadas por un commit ya hecho (para --push). */
function agregadasDeCommit(sha) {
  const out = [];
  for (const l of git(['show', '--no-color', '-U0', '--format=', sha]).split('\n')) {
    if (l.startsWith('+') && !l.startsWith('+++')) out.push(l.slice(1));
  }
  return out;
}

/** --push: revisa cada commit que se va a subir (referencias por stdin, formato de pre-push). */
function revisarPush() {
  const bloqueos = [];
  let entrada = '';
  try { entrada = readFileSync(0, 'utf8'); } catch (_) { entrada = ''; }
  for (const linea of entrada.split('\n').filter(Boolean)) {
    const [, local, , remoto] = linea.trim().split(/\s+/);
    if (!local || /^0+$/.test(local)) continue;                  // se borra una rama: nada que revisar
    const rango = /^0+$/.test(remoto || '') ? [local, '--not', '--remotes'] : [remoto + '..' + local];
    const shas = git(['rev-list', ...rango]).split('\n').filter(Boolean);
    for (const sha of shas) {
      const msg = git(['log', '-1', '--format=%B', sha]);
      if (revisarTexto(msg).length) bloqueos.push('commit ' + sha.slice(0, 8) + ' (el mensaje trae un dato SCADA)');
      if (agregadasDeCommit(sha).some((l) => motivoEnLinea(l))) bloqueos.push('commit ' + sha.slice(0, 8) + ' (agrega un dato SCADA)');
      const nuevos = git(['show', '--no-color', '--name-only', '--diff-filter=ACR', '--format=', sha]).split('\n').filter(Boolean);
      for (const f of nuevos) if (archivoSospechoso(f)) bloqueos.push('commit ' + sha.slice(0, 8) + ' (' + f + ')');
    }
  }
  return bloqueos;
}

function principal(argv) {
  const bloqueos = [];
  if (argv.includes('--push')) bloqueos.push(...revisarPush());
  else {
  const i = argv.indexOf('--mensaje');
  const j = argv.indexOf('--probar');
  if (i >= 0 || j >= 0) {
    const ruta = argv[(i >= 0 ? i : j) + 1];
    const texto = readFileSync(ruta, 'utf8');
    // En el mensaje de commit se ignoran los comentarios de git.
    const limpio = i >= 0 ? texto.split('\n').filter((l) => !l.startsWith('#')).join('\n') : texto;
    for (const h of revisarTexto(limpio)) bloqueos.push((i >= 0 ? 'mensaje del commit' : ruta) + ', línea ' + h.n + ' (' + h.motivo + ')');
  } else {
    const nuevos = git(['diff', '--cached', '--name-only', '--diff-filter=ACR', '-z']).split('\0').filter(Boolean);
    for (const f of nuevos) if (archivoSospechoso(f)) bloqueos.push(f + ' (tabla con nombre de exporte SCADA o de homologación)');
    for (const [f, lineas] of lineasAgregadas()) {
      // Esta misma guardia y su prueba describen las formas: se revisan con la misma regla (usan EstDemo).
      lineas.forEach((l) => {
        const m = motivoEnLinea(l);
        if (m) bloqueos.push(f + ' (' + m + ')');
      });
    }
  }
  }
  if (bloqueos.length) {
    console.log('🔒 guardia-scada: lo que se va a publicar trae DATOS DE RED del SCADA (el repo es público):');
    for (const x of [...new Set(bloqueos)].slice(0, 30)) console.log('   · ' + x);
    console.log('   Las mediciones y la homologación se cargan en «Datos SCADA» (administración), nunca al repositorio.');
    console.log('   En pruebas use estaciones inventadas que empiecen por «EstDemo».');
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exit(principal(process.argv.slice(2)));
