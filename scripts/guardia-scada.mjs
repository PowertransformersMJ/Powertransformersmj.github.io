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
//     «sw» + mayúscula + letras con número —swTrafo, swTrf, swAuto o uno con errata—, circuito de tres letras
//     y 3xx, o línea LN con número), con o sin el nivel de tensión en medio y con o sin la barra inicial;
//   · el nombre SUELTO de un circuito (tres letras y 3xx) o de una línea (LN con número), sin la estación: la forma que
//     usa la suma de circuitos («13,8 kV = suma de circuitos A + B»); los de prueba son «EDM3xx»;
//   · un archivo .csv/.xls/.xlsx cuyo nombre hable del exporte o de la homologación.
//   · una foto JPEG embebida en texto (base64 largo) o un archivo del paquete de placas características
//     (fotos y lecturas reales de las placas, ADR-166).
// Los datos de prueba usan estaciones inventadas que empiezan por «EstDemo»: pasan.
// Revisa SOLO lo que se agrega (líneas nuevas del diff y archivos nuevos), y el
// mensaje del commit (también es público). Nunca imprime lo que encontró.
// Las líneas se leen con --text, --no-textconv y --no-ext-diff: un «.gitattributes» («*.csv -diff», «binary»), un
// filtro textconv o un diff externo no la dejan ciega; lo binario se decide por el CONTENIDO, como git sin atributos.
// En --ci revisa además los NOMBRES de todo el árbol de la punta: el rojo dura mientras el archivo siga en él.
//
// Uso:  node scripts/guardia-scada.mjs              (lo preparado: pre-commit)
//       node scripts/guardia-scada.mjs --mensaje F   (mensaje del commit: commit-msg)
//       node scripts/guardia-scada.mjs --push        (lo que se sube: pre-push, refs por stdin)
//       node scripts/guardia-scada.mjs --probar F    (un archivo cualquiera)
//       node scripts/guardia-scada.mjs --rango A..B  (los commits de un rango, a mano: p. ej. origin/main..HEAD)
//       node scripts/guardia-scada.mjs --ci          (GitHub Actions: el rango del push o del PR, leído del evento,
//                                                     y los nombres del árbol de la punta (solo cuántos, nunca cuáles).
//                                                     Solo patrones: no necesita la bóveda. K-7, S7-07@10-11)
// ══════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEMO = /EstDemo/;
// Una fila de exporte del SCADA.
const FILA = new RegExp('Mv' + 'Moment');
// Ejemplos con forma: '/EstDemo1/swTrafo1', '/EstDemo1 /13.8kV  /swTrafo1' — el primer segmento es la estación,
// con alguna minúscula (los modelos de equipos «ZN045/FN050» no son estaciones); los circuitos son
// tres letras y un número de la serie 3xx, o una línea LNnnn. Desde 2026-10-24 (ADR-181) el elemento de transformador es
// cualquier «sw» + mayúscula + letras + número (también los que traen una errata en el nombre) y la barra inicial es
// opcional («Estacion/elemento=homologado», la forma de un alias de elemento); el elemento puede llevar una o dos letras
// tras el número, el nivel puede venir en «KV», y la estación se mira con un tope de largo (sin tope, una línea larga
// sin barras costaba tiempo cuadrático: revisión adversarial 2026-10-24).
const CLAVE = /\/?\s*((?=[A-Za-zÀ-ÿñÑ0-9]{0,9}[a-zà-ÿñ])[A-Za-zÀ-ÿñÑ][A-Za-zÀ-ÿñÑ0-9]{1,9})\s*\/(?:\s*[0-9.,]+\s*[kK]\s*[vV]\s*\/)?\s*(sw[A-Z][A-Za-z]*\d+[A-Za-z]{0,2}|swAuto\d+|[A-Z]{3}3\d{2}|LN\d{3})\b/;
// Un circuito o una línea SUELTOS (sin '/estación/'), desde la suma de circuitos (2026-10-24): «EDM3xx» es el de prueba;
// un color «#RRGGBB» (p. ej. el ámbar de la paleta) no es un circuito. Desde la diferencia de barra (2026-11-04, §208)
// también las bahías de 66 kV de la serie 6xx («EDM6xx» es la de prueba) y los bancos de condensadores «BCOMPn».
const SUELTO = /(?<!#)\b(?!EDM[36]\d{2}\b)[A-Z]{3}[36]\d{2}\b|\bLN\d{3}\b|\bBCOMP\d+\b/;
const ARCHIVO = new RegExp('(variables[ _-]?el[eé]ctricas|homologaci[oó]n|swtrafo|' + 'mv' + 'moment|_average[-_]|_quality[-_]|ir_current|p_average|urs_average)', 'i');
const TABLA = /\.(csv|xls|xlsx)$/i;
// Una foto JPEG en base64 (empieza por «/9j/») de cientos de caracteres; y los archivos del paquete de placas.
const FOTO_B64 = new RegExp('/9' + 'j/[A-Za-z0-9+/]{400,}');
const PAQUETE_PLACAS = /(placas-parte-\d+\.json|paquete-placas)/i;

/** ¿Este texto trae un dato SCADA con forma real? Devuelve el motivo (sin el dato) o ''. */
export function motivoEnLinea(linea) {
  const s = String(linea || '');
  if (DEMO.test(s)) return '';
  if (FILA.test(s)) return 'fila de un exporte del SCADA';
  if (CLAVE.test(s)) return 'clave de un punto SCADA';
  if (SUELTO.test(s)) return 'nombre de un circuito o línea del SCADA';
  if (FOTO_B64.test(s)) return 'foto embebida (placa u otra imagen real)';
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

/**
 * ¿El nombre de un archivo preparado delata un exporte o la homologación? Se compara en NFC: un nombre que llega
 * descompuesto (NFD, «o» + tilde combinante, como suele venir desde un Mac o por la web) no casaba con
 * «homologaci[oó]n» ni con «el[eé]ctricas» (revisión adversarial 2026-11-09).
 */
export function archivoSospechoso(ruta) {
  const s = String(ruta || '').normalize('NFC');
  return (TABLA.test(s) && ARCHIVO.test(s)) || PAQUETE_PLACAS.test(s);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

// Opciones de los diff que se revisan por líneas. Sin ellas, un «.gitattributes» con «*.csv -diff» o «binary» hace
// que git muestre «Binary files … differ», un filtro textconv muestra el texto convertido y un diff externo
// (diff.external, GIT_EXTERNAL_DIFF) muestra lo que quiera: la revisión quedaba ciega en los cuatro modos (revisión
// adversarial 2026-11-09). --full-index da el blob nuevo completo, para decidir qué es binario de verdad.
const DIFF_CRUDO = ['--no-color', '--text', '--no-textconv', '--no-ext-diff', '--full-index'];
const ENCABEZADO = /^diff --(git|cc|combined) /;

/** Parte un diff -U0 por archivo: [{ ruta, blob, lineas }] con las líneas AGREGADAS (blob = el nuevo, del «index»). */
function bloquesDeDiff(diff) {
  const bloques = [];
  let b = null;
  let cabecera = false;
  for (const l of diff.split('\n')) {
    if (ENCABEZADO.test(l)) { b = { ruta: '', blob: '', lineas: [] }; bloques.push(b); cabecera = true; continue; }
    if (!b) continue;
    if (l.startsWith('@@')) { cabecera = false; continue; }
    if (cabecera) {
      const idx = /^index [0-9a-f,]+\.\.([0-9a-f]+)/.exec(l);
      if (idx) b.blob = idx[1];
      else if (l.startsWith('+++ ')) b.ruta = l.slice(4).replace(/^b\//, '');
      continue;
    }
    if (l.startsWith('+')) b.lineas.push(l.slice(1));
  }
  return bloques;
}

/**
 * De estos blobs, ¿cuáles son binarios por CONTENIDO? Un NUL en los primeros 8000 bytes: la misma regla de git, pero
 * sin mirar los atributos. Con --text, una foto real (un PNG de la historia) daba un «circuito» por azar: medido el
 * 2026-11-09 sobre los 1849 commits del repo, ese era el único cambio de veredicto, y esta regla lo quita.
 */
function blobsBinarios(blobs) {
  const pedir = [...new Set(blobs)].filter((s) => s && !/^0+$/.test(s));
  const binarios = new Set();
  if (!pedir.length) return binarios;
  const out = execFileSync('git', ['cat-file', '--batch'], { input: pedir.join('\n') + '\n', maxBuffer: 256 * 1024 * 1024 });
  let i = 0;
  while (i < out.length) {
    const fin = out.indexOf(10, i);
    if (fin < 0) break;
    const cab = out.toString('utf8', i, fin).split(' ');   // «<sha> <tipo> <tamaño>» o «<sha> missing»
    i = fin + 1;
    if (cab.length < 3) continue;
    const n = Number(cab[2]);
    if (out.subarray(i, i + Math.min(n, 8000)).includes(0)) binarios.add(cab[0]);
    i += n + 1;
  }
  return binarios;
}

/** Hallazgos en las líneas agregadas de un diff (hecho con DIFF_CRUDO): [{ ruta, motivo }], sin los binarios. */
function hallazgosDeDiff(diff) {
  const conHallazgo = [];
  for (const b of bloquesDeDiff(diff)) {
    const motivos = [];
    for (const l of b.lineas) { const m = motivoEnLinea(l); if (m) motivos.push(m); }
    if (motivos.length) conHallazgo.push({ ...b, motivos });
  }
  // Solo se lee el contenido de los archivos con algún hallazgo: lo normal (sin hallazgos) no cuesta nada más.
  const binarios = blobsBinarios(conHallazgo.map((b) => b.blob));
  const out = [];
  for (const b of conHallazgo) if (!binarios.has(b.blob)) for (const motivo of b.motivos) out.push({ ruta: b.ruta, motivo });
  return out;
}

/** Hallazgos en lo preparado (git diff --cached -U0), para el pre-commit. */
function hallazgosPreparados() {
  return hallazgosDeDiff(git(['diff', '--cached', '-U0', ...DIFF_CRUDO, '--diff-filter=ACMRT']));
}

/** Hallazgos en las líneas agregadas por un commit ya hecho (--push, --rango y --ci). */
function hallazgosDeCommit(sha) {
  return hallazgosDeDiff(git(['show', ...DIFF_CRUDO, '-U0', '--format=', sha]));
}

/**
 * Cuántos archivos del árbol de `punta` tienen nombre de exporte, de homologación o del paquete de placas. Con -z:
 * sin él git escapa las tildes y el nombre no casa. Es «git ls-files -z» de la punta, leído del commit y no del
 * checkout (así vale igual para el push, el PR y una prueba).
 */
function sospechososEnArbol(punta) {
  return git(['ls-tree', '-r', '-z', '--name-only', '--full-tree', punta]).split('\0').filter((f) => f && archivoSospechoso(f)).length;
}

/**
 * Revisa commits ya hechos: el mensaje, las líneas agregadas y los nombres de los archivos nuevos.
 * Los nombres van con -z: sin él git escapa las tildes («Homologaci\303\263n…») y el nombre no casa
 * (medido el 2026-11-09: «--push» dejaba pasar un «Variables Eléctricas ….csv»).
 * conRutas = false no imprime el nombre del archivo: el registro de CI de un repo público se lee sin sesión.
 */
function revisarShas(shas, conRutas = true) {
  const bloqueos = [];
  for (const sha of shas) {
    const msg = git(['log', '-1', '--format=%B', sha]);
    if (revisarTexto(msg).length) bloqueos.push('commit ' + sha.slice(0, 8) + ' (el mensaje trae un dato SCADA)');
    if (hallazgosDeCommit(sha).length) bloqueos.push('commit ' + sha.slice(0, 8) + ' (agrega un dato SCADA)');
    const nuevos = git(['show', '--no-color', '--name-only', '--diff-filter=ACR', '--format=', '-z', sha]).split('\0').filter(Boolean);
    for (const f of nuevos) {
      if (archivoSospechoso(f)) bloqueos.push('commit ' + sha.slice(0, 8) + ' (' + (conRutas ? f : 'un archivo con nombre de exporte SCADA, de homologación o del paquete de placas') + ')');
    }
  }
  return bloqueos;
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
    bloqueos.push(...revisarShas(git(['rev-list', ...rango]).split('\n').filter(Boolean)));
  }
  return bloqueos;
}

const CEROS = /^0+$/;
const EVENTOS_SIN_RANGO = new Set(['workflow_dispatch', 'schedule', 'repository_dispatch']);

/**
 * Qué commits revisa la guardia en CI, según el evento de GitHub Actions (`GITHUB_EVENT_NAME` y el JSON de
 * `GITHUB_EVENT_PATH`). Pura: no toca git. Devuelve uno de:
 *   { revList, desde, hasta, alterno } → `git rev-list ...revList`; `alterno` sirve si `desde` no está en el clon
 *   { nada }  → no hay commits nuevos que revisar (rama borrada, corrida lanzada a mano)
 *   { error } → el evento no dice qué revisar: la guardia falla CERRADO.
 * Fuera de la rama principal se revisa TODO lo que la rama trae y la principal no, no solo este push: así no se
 * escapa nada si GitHub cancela la corrida anterior (`cancel-in-progress`: 48 de 966 pares de push seguidos en la
 * misma rama llegaron con menos de 60 s, medido el 2026-11-09), ni en una rama nueva o un push forzado, y la rama
 * sigue en rojo mientras el dato esté en ella y no en la principal (un push limpio después no lo tapa). Se compara
 * con la principal y no con «--remotes» (como hace --push): en el clon de CI la rama recién subida ya está en
 * origin/ y el rango quedaría vacío, en silencio. En la principal no hay con qué comparar: el rango es el del push.
 */
export function rangoDeEvento(nombre, evento) {
  const ev = evento || {};
  const principal = (ev.repository && ev.repository.default_branch) || 'main';
  if (nombre === 'pull_request') {
    const pr = ev.pull_request || {};
    const base = pr.base && pr.base.sha;
    const hasta = pr.head && pr.head.sha;
    if (!base || !hasta) return { error: 'el evento del PR no trae base.sha y head.sha' };
    return { desde: base, hasta, revList: [base + '..' + hasta], alterno: [hasta, '--not', 'origin/' + (pr.base.ref || principal)] };
  }
  if (nombre === 'push') {
    const desde = String(ev.before || '');
    const hasta = String(ev.after || '');
    if (!hasta || CEROS.test(hasta)) return { nada: 'se borró una rama: no hay commits que revisar' };
    if (ev.ref !== 'refs/heads/' + principal || !desde || CEROS.test(desde)) return { hasta, revList: [hasta, '--not', 'origin/' + principal] };
    return { desde, hasta, revList: [desde + '..' + hasta], alterno: null };
  }
  if (EVENTOS_SIN_RANGO.has(nombre)) return { nada: 'el evento «' + nombre + '» no trae commits nuevos (corrida lanzada a mano o programada)' };
  return { error: 'el evento «' + nombre + '» no está previsto: añade su caso en rangoDeEvento (scripts/guardia-scada.mjs) con su prueba' };
}

function existe(ref) {
  try { git(['rev-parse', '--verify', '--quiet', ref + '^{commit}']); return true; } catch (_) { return false; }
}

/**
 * --ci: los commits del push o del PR. Devuelve { shas, rotulo, punta }, { nada, punta? } o { error }.
 * `punta` es el commit cuyo árbol se revisa por NOMBRES: la del push o del PR, o HEAD (el checkout) en una corrida
 * a mano o programada, que también publica (pages.yml «Run workflow»). Una rama borrada no tiene punta.
 */
function revisarCi() {
  const nombre = process.env.GITHUB_EVENT_NAME || '';
  const ruta = process.env.GITHUB_EVENT_PATH || '';
  if (!nombre || !ruta) return { error: '«--ci» corre en GitHub Actions (faltan GITHUB_EVENT_NAME o GITHUB_EVENT_PATH); en tu máquina usa «--rango A..B»' };
  let evento;
  try { evento = JSON.parse(readFileSync(ruta, 'utf8')); } catch (_) { return { error: 'no pude leer el evento de GitHub (' + ruta + ')' }; }
  const r = rangoDeEvento(nombre, evento);
  if (r.nada) return EVENTOS_SIN_RANGO.has(nombre) ? { nada: r.nada, punta: 'HEAD' } : r;
  if (r.error) return r;
  if (!existe(r.hasta)) return { error: 'el commit ' + r.hasta.slice(0, 8) + ' no está en el clon (¿el checkout perdió «fetch-depth: 0»?)' };
  let revList = r.revList;
  let nota = '';
  if (r.desde && !existe(r.desde)) {
    if (!r.alterno) return { error: 'no encuentro el commit anterior ' + r.desde.slice(0, 8) + ' (¿push forzado a la rama principal?): no sé qué commits son nuevos' };
    revList = r.alterno;
    nota = '; la base ' + r.desde.slice(0, 8) + ' no está en el clon';
  }
  if (revList[1] === '--not' && !existe(revList[2])) return { error: 'no encuentro ' + revList[2] + ' para comparar (¿el checkout perdió «fetch-depth: 0»?)' };
  return { shas: git(['rev-list', ...revList]).split('\n').filter(Boolean), rotulo: revList.join(' ') + nota, punta: r.hasta };
}

function errorCi(motivo) {
  console.log('❌ guardia-scada (CI): ' + motivo + '.');
  console.log('   Cómo seguir: en tu máquina, «node scripts/guardia-scada.mjs --rango <anterior>..<nuevo>». Si sale limpio y es main,');
  console.log('   publica a mano: GitHub → Actions → «Deploy · GitHub Pages» → Run workflow (sin rango: ahí esta guardia solo');
  console.log('   revisa los nombres del árbol).');
  return 1;
}

function principal(argv) {
  const bloqueos = [];
  const enCi = argv.includes('--ci');
  let rotulo = '';
  if (enCi) {
    const r = revisarCi();
    if (r.error) return errorCi(r.error);
    // El rango solo ve lo NUEVO: un archivo con nombre de exporte que ya quedó en el árbol pasaba en el push siguiente
    // (revisión adversarial 2026-11-09). Por eso se cuentan también los nombres de TODO el árbol de la punta, sin
    // imprimirlos (el registro de CI es público): el rojo dura mientras el archivo siga ahí.
    let arbol = '';
    if (r.punta) {
      let n;
      try { n = sospechososEnArbol(r.punta); } catch (_) { return errorCi('no pude leer el árbol de ' + r.punta.slice(0, 8)); }
      if (n) bloqueos.push('el árbol de ' + r.punta.slice(0, 8) + ' trae ' + n + ' archivo(s) con nombre de exporte SCADA, de homologación o del paquete de placas (sigue en rojo mientras estén en él)');
      arbol = ' y los nombres del árbol de ' + r.punta.slice(0, 8);
    }
    if (r.nada) {
      if (!bloqueos.length) {
        console.log('ℹ️  guardia-scada (CI): ' + r.nada + (r.punta ? '; revisé los nombres del árbol de ' + r.punta.slice(0, 8) + ': ninguno de exporte' : '') + '. El contenido del árbol lo revisa tests/scada_carga_guardia.test.js.');
        return 0;
      }
      rotulo = r.nada;
    } else {
      bloqueos.push(...revisarShas(r.shas, false));
      rotulo = r.shas.length + ' commit(s) revisado(s) (' + r.rotulo + ')' + arbol;
      if (!bloqueos.length) {
        console.log('✅ guardia-scada (CI): ' + rotulo + ', sin datos SCADA.');
        return 0;
      }
    }
  } else if (argv.includes('--rango')) {
    const rango = argv[argv.indexOf('--rango') + 1] || '';
    let shas = null;
    if (rango && !rango.startsWith('-')) {
      try { shas = git(['rev-list', rango]).split('\n').filter(Boolean); } catch (_) { shas = null; }
    }
    if (!shas) {
      console.log('❌ guardia-scada: no entiendo el rango «' + rango + '» (p. ej. --rango origin/main..HEAD; los dos commits deben estar en este clon).');
      return 1;
    }
    bloqueos.push(...revisarShas(shas));
    if (!bloqueos.length) {
      console.log('✅ guardia-scada: ' + shas.length + ' commit(s) revisado(s) (' + rango + '), sin datos SCADA.');
      return 0;
    }
  } else if (argv.includes('--push')) bloqueos.push(...revisarPush());
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
    for (const f of nuevos) if (archivoSospechoso(f)) bloqueos.push(f + ' (tabla de exporte SCADA, de homologación o paquete de placas)');
    // Esta misma guardia y su prueba describen las formas: se revisan con la misma regla (usan EstDemo).
    for (const h of hallazgosPreparados()) bloqueos.push(h.ruta + ' (' + h.motivo + ')');
  }
  }
  if (bloqueos.length) {
    console.log('🔒 guardia-scada: lo que se va a publicar trae DATOS DE RED del SCADA (el repo es público):');
    for (const x of [...new Set(bloqueos)].slice(0, 30)) console.log('   · ' + x);
    console.log('   Las mediciones y la homologación se cargan en «Datos SCADA» (administración), nunca al repositorio.');
    console.log('   Las placas características (fotos y lecturas) se cargan en «Placas características» (administración).');
    console.log('   En pruebas use estaciones inventadas que empiecen por «EstDemo».');
    if (enCi) {
      console.log('   CI: ' + rotulo + '.');
      console.log('   En CI esto llega DESPUÉS de subir: el commit ya está en GitHub (repo público). Qué hacer: (1) avisa al');
      console.log('   Ingeniero; (2) saca el dato en un commit NUEVO (si usas «git revert», reescribe el mensaje: el que propone');
      console.log('   git copia el asunto original); la historia lo sigue sirviendo por su SHA y purgarla es decisión del Ingeniero');
      console.log('   (L-140); (3) si es un falso positivo, ajusta la forma en esta guardia con su caso en tests/scada_carga_guardia.test.js.');
      console.log('   En main, la web no se publica hasta que un push salga en verde (pages.yml espera esta verificación). En otra');
      console.log('   rama, el rojo sigue mientras el commit esté en ella y no en main: al llevarla a main, ese push saldrá en rojo');
      console.log('   una vez (trae el commit); el siguiente push a main, o el despliegue a mano (Run workflow), publica.');
      console.log('   Un archivo con nombre de exporte, de homologación o de placas frena TODO push y el despliegue a mano mientras');
      console.log('   siga en el árbol: sácalo del repositorio en un commit nuevo (el original se guarda fuera del repo).');
    }
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exit(principal(process.argv.slice(2)));
