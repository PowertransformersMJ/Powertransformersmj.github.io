#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// Guardia de FIRMAS (ADR-099) — ninguna imagen de firma entra al repo.
// ──────────────────────────────────────────────────────────────
// El repositorio es PÚBLICO: una firma que entra a un commit queda publicada
// en el historial para siempre. Las firmas viven en Storage (`firmas/{uid}`,
// `firmas-equipo/{custodio}/{persona}`), nunca aquí.
//
// Bloquea el commit si CUALQUIER archivo preparado (agregado, copiado,
// modificado, renombrado o cambiado de tipo) es:
//   · una IMAGEN —por extensión O por su contenido (bytes mágicos), porque en
//     Storage las firmas se guardan SIN extensión— cuyo nombre o ruta habla de
//     firmas o de una persona de la lista del equipo; o cuya huella SHA-256
//     esté en la lista privada de la bóveda
//     (`brain-private/sgm-transpower/huellas-firmas.json`), aunque se renombre;
//   · un Excel emitido con firmas del equipo (folio `_F-XXXXXXXX` en el nombre)
//     o cualquier documento zip que traiga dentro `xl/media/firma-*`.
// No imprime el contenido de nada.
//
//   (sin argumentos) → lo preparado (pre-commit; y pre-merge-commit, donde el
//                      índice ya es el resultado del merge)
//   --push           → lo que se va a subir (pre-push): lee las referencias por
//                      stdin, como guardia-cedulas, y revisa los archivos que
//                      agrega o cambia CADA commit del rango, leídos de su blob.
//                      Cubre lo que no pasa por el pre-commit: cherry-pick,
//                      rebase, merge en avance rápido y `commit --no-verify`.
// ══════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const IMAGEN = /\.(png|jpe?g|gif|webp|tiff?|bmp|heic|svg)$/i;
const SOSPECHOSO = /(firma|signature|\bsign|fmjp|jimenez|miranda|vergara|martelo|rhenals|firmas-equipo)/i;
// El Excel que emite «Descargar con firmas del equipo» lleva el folio en el nombre.
const EXCEL_EMITIDO = /_F-[A-Z0-9]{8}\.xlsx$/i;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
function bytesPreparados(f) {
  return execFileSync('git', ['show', ':' + f], { maxBuffer: 256 * 1024 * 1024 });
}

/** ¿Es una imagen por su CONTENIDO (bytes mágicos), tenga la extensión que tenga? */
function esImagenPorBytes(b) {
  if (!b || b.length < 12) return false;
  const h = (i) => b[i];
  return (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4E && h(3) === 0x47)            // PNG
    || (h(0) === 0xFF && h(1) === 0xD8 && h(2) === 0xFF)                                // JPEG
    || (h(0) === 0x47 && h(1) === 0x49 && h(2) === 0x46)                                // GIF
    || (h(0) === 0x49 && h(1) === 0x49 && h(2) === 0x2A && h(3) === 0x00)               // TIFF II
    || (h(0) === 0x4D && h(1) === 0x4D && h(2) === 0x00 && h(3) === 0x2A)               // TIFF MM
    || (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP');
}

/** ¿Un archivo zip (xlsx/docx/pptx) que trae dentro una firma estampada? */
function zipConFirma(b) {
  if (!b || b.length < 4 || !(b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04)) return false;
  // Los nombres de las entradas van sin comprimir en las cabeceras del zip.
  return b.includes(Buffer.from('xl/media/firma-', 'latin1'));
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

/** Por qué un archivo es una FIRMA ('' si no lo es). `leer(f)` da sus bytes; si no se pueden leer, no se revisa. */
function motivoFirma(f, leer, huellas, cuenta) {
  if (EXCEL_EMITIDO.test(f)) return 'Excel emitido con firmas del equipo';
  let b = null;
  try { b = leer(f); } catch (_) { return ''; }
  if (zipConFirma(b)) return 'documento con una firma estampada dentro';
  if (!(IMAGEN.test(f) || esImagenPorBytes(b))) return '';
  cuenta.imagenes++;
  if (SOSPECHOSO.test(f)) return 'imagen con nombre o ruta de firma';
  if (huellas && huellas.has(createHash('sha256').update(b).digest('hex'))) return 'es una firma registrada';
  return '';
}

/** --push: los rangos de commits a revisar, desde las referencias que git le pasa al pre-push por stdin. */
function rangosDePush(entrada) {
  const rangos = [];
  for (const fila of String(entrada || '').split('\n').filter(Boolean)) {
    const [, local, , remoto] = fila.trim().split(/\s+/);
    if (!local || /^0+$/.test(local)) continue;                  // se borra una rama: nada que revisar
    // Rama nueva, o un remoto que este clon no tiene (push forzado tras un push ajeno): todo lo que no está en un remoto.
    let conocido = !!remoto && !/^0+$/.test(remoto);
    if (conocido) { try { execFileSync('git', ['cat-file', '-e', remoto + '^{commit}'], { stdio: 'ignore' }); } catch (_) { conocido = false; } }
    rangos.push(conocido ? [remoto + '..' + local] : [local, '--not', '--remotes']);
  }
  return rangos;
}

const PUSH = process.argv.includes('--push');
const huellas = huellasPrivadas();
const bloqueos = [];
const cuenta = { imagenes: 0 };
if (PUSH) {
  let entrada = '';
  try { entrada = readFileSync(0, 'utf8'); } catch (_) { entrada = ''; }
  for (const rango of rangosDePush(entrada)) {
    for (const sha of git(['rev-list', ...rango]).split('\n').filter(Boolean)) {
      // Lo que ESE commit agrega o cambia (un merge, contra su primer padre), leído de su blob y no del disco.
      const rutas = git(['show', '-m', '--first-parent', '--format=', '--name-only', '--diff-filter=ACMRT', '-z', sha]).split('\0').filter(Boolean);
      const blob = (f) => execFileSync('git', ['cat-file', 'blob', sha + ':' + f], { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      for (const f of rutas) {
        const m = motivoFirma(f, blob, huellas, cuenta);
        if (m) bloqueos.push('commit ' + sha.slice(0, 8) + ' · ' + f + ' (' + m + ')');
      }
    }
  }
} else {
  // TODO lo preparado (agregado, copiado, modificado, renombrado o cambiado de
  // tipo): no solo lo que tiene extensión de imagen (revisión de ADR-099).
  const preparados = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRT', '-z']).split('\0').filter(Boolean);
  for (const f of preparados) {
    const m = motivoFirma(f, bytesPreparados, huellas, cuenta);
    if (m) bloqueos.push(f + ' (' + m + ')');
  }
}
if (cuenta.imagenes && !(huellas && huellas.size)) {
  console.log('⚠️  guardia-firmas: no se encontró la lista privada de huellas; solo se revisaron nombres y contenido.');
}

if (bloqueos.length) {
  console.log('🔒 guardia-firmas: ' + (PUSH ? 'lo que se va a subir' : 'el commit') + ' trae FIRMAS o documentos con firmas (el repo es público):');
  for (const x of [...new Set(bloqueos)]) console.log('   · ' + x);
  console.log('   Las firmas se suben en «Mi firma» o en «Firmas del equipo»; nunca al repositorio.');
  if (PUSH) console.log('   Un commit nuevo que la borre no basta (la historia es pública): rehaga el cambio sin la firma en una rama nueva desde lo ya publicado y suba esa.');
  process.exit(1);
}
process.exit(0);
