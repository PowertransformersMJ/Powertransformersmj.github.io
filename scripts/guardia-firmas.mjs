#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// Guardia de FIRMAS (ADR-099) — ninguna imagen de firma entra al repo.
// ──────────────────────────────────────────────────────────────
// El repositorio es PÚBLICO: una firma que entra a un commit queda publicada
// en el historial para siempre. Las firmas viven en Storage (`firmas/{uid}`,
// `firmas-equipo/{custodio}/{persona}`), nunca aquí.
//
// Bloquea el commit si lo preparado (agregado o modificado) trae:
//   · una IMAGEN cuyo nombre o ruta habla de firmas o de una persona de la
//     lista del equipo (firma, signature, sign, jimenez, miranda, vergara,
//     martelo, rhenals, fmjp); o
//   · una imagen cuya huella SHA-256 esté en la lista privada de la bóveda
//     (`brain-private/sgm-transpower/huellas-firmas.json`): así un archivo
//     renombrado tampoco pasa. Si la bóveda no está, solo avisa.
// No imprime el contenido de nada.
// ══════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const IMAGEN = /\.(png|jpe?g|gif|webp|tiff?|bmp|heic|svg)$/i;
const SOSPECHOSO = /(firma|signature|\bsign|fmjp|jimenez|miranda|vergara|martelo|rhenals|firmas-equipo)/i;

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: opts.buffer ? undefined : 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function raizPrincipal() {
  // En un worktree, la bóveda cuelga del repo PRINCIPAL (como la guardia de cédulas).
  const comun = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
  return dirname(comun);
}

function huellasPrivadas() {
  const ruta = resolve(raizPrincipal(), '..', 'brain-private', 'sgm-transpower', 'huellas-firmas.json');
  if (!existsSync(ruta)) return null;
  try { return new Set((JSON.parse(readFileSync(ruta, 'utf8')).huellas || []).map((h) => String(h).toLowerCase())); }
  catch (_) { return null; }
}

const preparados = git(['diff', '--cached', '--name-only', '--diff-filter=AM', '-z']).split('\0').filter(Boolean);
const imagenes = preparados.filter((f) => IMAGEN.test(f));
const bloqueos = [];
for (const f of imagenes) if (SOSPECHOSO.test(f)) bloqueos.push(f + ' (nombre o ruta de firma)');

const huellas = huellasPrivadas();
if (huellas && huellas.size) {
  for (const f of imagenes) {
    const bytes = execFileSync('git', ['show', ':' + f], { maxBuffer: 64 * 1024 * 1024 });
    if (huellas.has(createHash('sha256').update(bytes).digest('hex'))) bloqueos.push(f + ' (es una firma registrada)');
  }
} else if (imagenes.length) {
  console.log('⚠️  guardia-firmas: no se encontró la lista privada de huellas; solo se revisaron los nombres.');
}

if (bloqueos.length) {
  console.log('🔒 guardia-firmas: el commit trae imágenes que parecen FIRMAS (el repo es público):');
  for (const b of bloqueos) console.log('   · ' + b);
  console.log('   Las firmas se suben en «Mi firma» o en «Firmas del equipo»; nunca al repositorio.');
  process.exit(1);
}
process.exit(0);
