#!/usr/bin/env node
/**
 * guardia-cedulas.mjs — candado de datos personales (99 §78).
 *
 * El repositorio es PÚBLICO y dos veces se colaron cédulas reales por un
 * saneado hecho contra la FORMA y no contra el DATO (L-75, L-90). El candado
 * mira las dos cosas:
 *   · DATO: toda corrida de dígitos (con puntos, comas, espacios, guiones o
 *     apóstrofos en medio) se prueba en TODAS sus ventanas de 5 a 12 dígitos
 *     contra HUELLAS SHA-256 con sal de las cédulas registradas. Las huellas y
 *     la sal viven FUERA del repo (bóveda privada); aquí no hay ningún número.
 *   · FORMA: «cédula» o «C.C.» seguida de un número bloquea aunque ese número
 *     no esté registrado (en tests/ y tests-rules/ solo avisa: ahí van números
 *     inventados a propósito).
 * Y lo que el texto no deja ver: un PDF/Excel/Word agregado se bloquea (los
 * que genera este sitio llevan cédulas y van comprimidos). Nunca imprime dígitos.
 *
 *   (sin argumentos)          → lo preparado para commit (pre-commit y pre-merge-commit)
 *   --mensaje <archivo>       → el mensaje del commit (commit-msg)
 *   --push                    → lo que se va a subir; lee las referencias por stdin (pre-push)
 *   --historia                → toda la historia: cuenta coincidencias y binarios NO revisados
 *   --registrar <archivo>     → agrega a las huellas las cédulas de un archivo local
 *   --probar <archivo>        → revisa un archivo suelto (para comprobar el candado)
 *
 * Escapes explícitos: GUARDIA_BINARIOS_OK=1 (binarios revisados a mano) o
 * `git commit --no-verify` (queda en la conciencia de quien lo usa).
 * Sin huellas: la parte de DATO avisa en voz alta; FORMA y binarios siguen.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paresDeArchivo, problemaCedula } from '../assets/js/domain/responsables_ordenes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 1024, ...opts }).toString();

/** La bóveda se busca desde el repositorio PRINCIPAL: un worktree vive en otra carpeta. */
function rutaHuellas() {
  if (process.env.SGM_HUELLAS) return process.env.SGM_HUELLAS;
  let base = ROOT;
  try { base = dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()); } catch (_) { /* sin git */ }
  return resolve(base, '..', 'brain-private', 'sgm-transpower', 'huellas-cedulas.json');
}
const HUELLAS = rutaHuellas();
const huellaDe = (sal, digitos) => createHash('sha256').update(sal + ':' + digitos).digest('hex');
const ocultar = (t) => String(t).replace(/\d/g, '•');

const RE_CORRIDA = /\d(?:[\d.,'’\s -]{0,40}\d)?/g;
const RE_FORMA = /(c[ée]dula|\bc\.\s?c\.?)\W{0,8}\d[\d.,'’\s -]{3,20}\d/i;
const EXT_BLOQUEO = /\.(pdf|xlsx|xlsm|xls|docx|doc|pptx|odt|ods)$/i;
const IMG_SOSPECHOSA = /(orden|vista|captura|pantalla|screenshot).*\.(png|jpe?g|webp)$/i;
const RUTA_PRUEBAS = /^(tests|tests-rules)\//;

function leerHuellas() {
  if (!existsSync(HUELLAS)) return null;
  const d = JSON.parse(readFileSync(HUELLAS, 'utf8'));
  return { sal: d.sal, set: new Set(d.huellas || []) };
}

/** Todas las ventanas de 5 a 12 dígitos de un texto (y de lo que decodifique un base64 largo). */
function ventanas(texto) {
  const out = new Set();
  const agregar = (s) => {
    (String(s).match(RE_CORRIDA) || []).forEach((corrida) => {
      const d = corrida.replace(/\D/g, '').slice(0, 400);
      for (let n = 5; n <= 12; n++) for (let i = 0; i + n <= d.length; i++) out.add(d.slice(i, i + n));
    });
  };
  agregar(texto);
  (String(texto).match(/[A-Za-z0-9+/]{16,}={0,2}/g) || []).slice(0, 50).forEach((b64) => {
    try { agregar(Buffer.from(b64, 'base64').toString('latin1')); } catch (_) { /* no era base64 */ }
  });
  return out;
}

const H = leerHuellas();
const traeRegistrada = (texto) => {
  if (!H) return false;
  for (const v of ventanas(texto)) if (H.set.has(huellaDe(H.sal, v))) return true;
  return false;
};

/** Parser del diff con estado: '+++ ' solo es cabecera justo después de '--- '. */
function agregadasPorArchivo(diff) {
  const archivos = new Map();
  let archivo = null, linea = 0, trasMenos = false;
  diff.split('\n').forEach((l) => {
    if (l.startsWith('diff --git ')) { archivo = null; trasMenos = false; return; }
    if (l.startsWith('--- ') && archivo === null) { trasMenos = true; return; }
    if (trasMenos && l.startsWith('+++ ')) {
      archivo = l.slice(4).replace(/^b\//, '');
      if (!archivos.has(archivo)) archivos.set(archivo, []);
      trasMenos = false; return;
    }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) { linea = Number(h[1]); return; }
    if (archivo === null || l.startsWith('\\')) return;
    if (l.startsWith('+')) { archivos.get(archivo).push({ linea, texto: l.slice(1) }); linea++; }
    else if (!l.startsWith('-')) linea++;
  });
  return archivos;
}

/** Revisa un diff → {bloqueos:[], avisos:[]} (mensajes SIN dígitos). */
function revisarDiff(diff, numstat) {
  const bloqueos = [], avisos = [];
  for (const [archivo, lineas] of agregadasPorArchivo(diff)) {
    const enPruebas = RUTA_PRUEBAS.test(archivo);
    if (traeRegistrada(archivo)) bloqueos.push(`${ocultar(archivo)}: el NOMBRE del archivo contiene una cédula registrada`);
    lineas.forEach((l) => {
      if (traeRegistrada(l.texto)) bloqueos.push(`${ocultar(archivo)}:${l.linea} cédula registrada`);
      else if (RE_FORMA.test(l.texto)) {
        (enPruebas ? avisos : bloqueos).push(`${ocultar(archivo)}:${l.linea} «cédula/C.C.» seguida de un número`);
      }
    });
    // Una cédula partida en dos líneas seguidas.
    for (let i = 1; i < lineas.length; i++) {
      if (lineas[i].linea !== lineas[i - 1].linea + 1) continue;
      const junta = lineas[i - 1].texto.slice(-24) + lineas[i].texto.slice(0, 24);
      if (!traeRegistrada(lineas[i - 1].texto) && !traeRegistrada(lineas[i].texto) && traeRegistrada(junta)) {
        bloqueos.push(`${ocultar(archivo)}:${lineas[i - 1].linea} cédula registrada partida en dos líneas`);
      }
    }
  }
  String(numstat || '').split('\n').filter(Boolean).forEach((fila) => {
    const [a, b, ...resto] = fila.split('\t');
    const ruta = resto.join('\t');
    if (a !== '-' || b !== '-') return;
    if (EXT_BLOQUEO.test(ruta) || IMG_SOSPECHOSA.test(ruta)) {
      if (process.env.GUARDIA_BINARIOS_OK === '1') avisos.push(`${ocultar(ruta)}: binario aceptado por GUARDIA_BINARIOS_OK=1`);
      else bloqueos.push(`${ocultar(ruta)}: documento binario (puede llevar cédulas que no se pueden leer); si lo revisó, GUARDIA_BINARIOS_OK=1`);
    }
  });
  return { bloqueos, avisos };
}

function informar({ bloqueos, avisos }, que) {
  if (!H) console.warn('⚠️  guardia-cedulas: sin huellas en la bóveda privada → solo se revisó la FORMA y los binarios.');
  avisos.forEach((a) => console.warn(`⚠️  guardia-cedulas: ${a}`));
  if (bloqueos.length) {
    console.error(`❌ guardia-cedulas (${que}):`);
    bloqueos.forEach((b) => console.error(`   ${b}`));
    console.error('   Las cédulas viven en Firestore (99 §78). No se muestran dígitos.');
    process.exit(1);
  }
  process.exit(0);
}

const DIFF_OPC = ['--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/', '-U0'];
const modo = process.argv[2] || '';

if (modo === '--registrar') {
  const archivo = process.argv[3];
  if (!archivo || !existsSync(archivo)) { console.error('Uso: --registrar <archivo local>'); process.exit(2); }
  const previo = existsSync(HUELLAS) ? JSON.parse(readFileSync(HUELLAS, 'utf8')) : null;
  const sal = (previo && previo.sal) || randomBytes(16).toString('hex');
  const set = new Set((previo && previo.huellas) || []);
  const antes = set.size;
  const texto = readFileSync(archivo, 'utf8');
  const pares = paresDeArchivo(texto, []).filter((p) => !problemaCedula(p.cedula));
  pares.forEach((p) => set.add(huellaDe(sal, p.cedula)));
  writeFileSync(HUELLAS, JSON.stringify({
    _nota: 'Huellas SHA-256 con sal de cédulas reales (99 §78). PRIVADO: nunca al repositorio público.',
    sal, huellas: Array.from(set)
  }, null, 1) + '\n');
  const menciones = (texto.match(/c[ée]dula\W{0,8}["']?\d/gi) || []).length;
  console.log(`🔒 huellas: ${set.size} (nuevas: ${set.size - antes}); pares leídos: ${pares.length}` +
    (menciones > pares.length ? ` ⚠️ el archivo menciona ${menciones} cédulas con número: revise si faltó alguna` : ''));
  process.exit(0);
}

if (modo === '--probar') {
  const txt = readFileSync(process.argv[3] || '', 'utf8');
  const lineas = txt.split('\n').map((t, i) => ({ linea: i + 1, texto: t }));
  const n = lineas.filter((l) => traeRegistrada(l.texto)).length;
  const f = lineas.filter((l) => !traeRegistrada(l.texto) && RE_FORMA.test(l.texto)).length;
  console.log(`🔎 prueba: ${n} línea(s) con cédula registrada · ${f} con forma «cédula + número»`);
  process.exit(n || f ? 1 : 0);
}

if (modo === '--mensaje') {
  const txt = readFileSync(process.argv[3] || '', 'utf8');
  const bloqueos = [];
  if (traeRegistrada(txt)) bloqueos.push('el mensaje del commit contiene una cédula registrada');
  else if (RE_FORMA.test(txt)) bloqueos.push('el mensaje del commit trae «cédula/C.C.» seguida de un número');
  informar({ bloqueos, avisos: [] }, 'mensaje');
}

if (modo === '--push' || modo === '--historia') {
  const rangos = [];
  if (modo === '--historia') rangos.push(['--all']);
  else {
    readFileSync(0, 'utf8').split('\n').filter(Boolean).forEach((fila) => {
      const [, local, , remoto] = fila.split(' ');
      if (!local || /^0+$/.test(local)) return;               // borrar una rama: nada que revisar
      rangos.push(/^0+$/.test(remoto || '') ? [local, '--not', '--remotes'] : [`${remoto}..${local}`]);
    });
  }
  const bloqueos = [], avisos = [];
  let binariosSinRevisar = 0, commits = 0;
  rangos.forEach((r) => {
    git(['rev-list', ...r]).split('\n').filter(Boolean).forEach((sha) => {
      commits++;
      const msg = git(['log', '-1', '--format=%B', sha]);
      if (traeRegistrada(msg)) bloqueos.push(`commit ${sha.slice(0, 8)}: el mensaje trae una cédula registrada`);
      else if (RE_FORMA.test(msg)) bloqueos.push(`commit ${sha.slice(0, 8)}: el mensaje trae «cédula/C.C.» seguida de un número`);
      const diff = git(['show', '-m', '--first-parent', '--format=', ...DIFF_OPC, sha]);
      const numstat = git(['show', '-m', '--first-parent', '--format=', '--numstat', '--no-ext-diff', sha]);
      const res = revisarDiff(diff, modo === '--historia' ? '' : numstat);
      res.bloqueos.forEach((b) => bloqueos.push(`commit ${sha.slice(0, 8)} · ${b}`));
      if (modo === '--historia') binariosSinRevisar += numstat.split('\n').filter((f) => f.startsWith('-\t-\t')).length;
      else res.avisos.forEach((a) => avisos.push(a));
    });
  });
  if (modo === '--historia') {
    const formas = bloqueos.filter((b) => b.includes('seguida de un número')).length;
    console.log(`🔎 historia: ${commits} commit(s) · ${bloqueos.length - formas} hallazgo(s) con cédula registrada · ` +
      `${formas} con forma «cédula + número» (revisar a mano) · ${binariosSinRevisar} binario(s) SIN revisar por texto`);
    bloqueos.filter((b) => !b.includes('seguida de un número')).forEach((b) => console.log(`   ${b}`));
    process.exit(bloqueos.length - formas ? 1 : 0);
  }
  informar({ bloqueos, avisos }, 'push');
}

// Por defecto: lo preparado para commit.
const diff = git(['diff', '--cached', ...DIFF_OPC]);
const numstat = git(['diff', '--cached', '--numstat', '--no-ext-diff', '--diff-filter=AMR']);
informar(revisarDiff(diff, numstat), 'commit');
