// Informe de Mantenimiento Brigada · revisión ESTÁTICA de la capa de datos:
// lo que el texto de los módulos promete y una prueba de ejecución no ve.
//   · el repositorio local no trae Firebase (la vista previa no escribe nada);
//   · de las acciones de refrigeración solo se usa `listar` (decisión 12);
//   · las firmas nunca salen por URL con token (data/firmas.js:13);
//   · cero nombres de personas en el código (decisión 3: editores por uid).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
/** El código sin comentarios (para no confundir lo que se explica con lo que se ejecuta). */
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const NUBE = leer('assets/js/data/informes_brigada.js');
const LOCAL = leer('assets/js/data/informes_brigada_local.js');
const ALMACEN = leer('assets/js/data/informes_brigada_almacen.js');
const RUTAS = leer('assets/js/domain/informe_brigada_rutas.js');

describe('el repositorio LOCAL no toca la plataforma', () => {
  test('no importa Firebase ni el guard (que trae Firebase)', () => {
    assert.ok(!LOCAL.includes('firebasejs'), 'nada de firebasejs');
    assert.ok(!/firebase-init|session-guard|gstatic/.test(codigo(LOCAL)));
    const estaticos = [...codigo(LOCAL).matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    assert.deepEqual(estaticos, ['../domain/informe_brigada_rutas.js']);
  });

  test('el dominio de la capa de datos es puro (sin red, sin DOM)', () => {
    assert.ok(!/firebasejs|gstatic|document\.|window\.|localStorage/.test(codigo(RUTAS)));
    const estaticos = [...codigo(RUTAS).matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    assert.deepEqual(estaticos.sort(), ['./fichas_adjunto.js', './firmas.js']);
  });
});

describe('acciones de refrigeración: SOLO lectura (decisión 12)', () => {
  for (const [nombre, texto] of [['nube', NUBE], ['local', LOCAL]]) {
    test(`${nombre}: de acciones_refrigeracion.js solo se toma \`listar\``, () => {
      const c = codigo(texto);
      assert.ok(!/^import[^;]*acciones_refrigeracion/m.test(c), 'sin import estático del módulo de acciones');
      const usos = [...c.matchAll(/acciones_refrigeracion\.js'\)\)([.\w]*)/g)].map((m) => m[1]);
      assert.deepEqual(usos, ['.listar']);
      assert.ok(!/actualizarEstado|eliminar\b|addDoc|updateDoc/.test(c), 'ninguna función de escritura de acciones a la vista');
      assert.ok(!/['"]acciones_refrigeracion['"]/.test(c), 'no escribe la colección de acciones directamente');
    });
  }
});

describe('firmas de terceros: nunca por URL con token; solo desde una versión emitida', () => {
  test('ningún tramo de FIRMAS del almacén usa getDownloadURL', () => {
    const tramos = [...ALMACEN.matchAll(/\/\/ ── FIRMAS \(inicio\)[\s\S]*?\/\/ ── FIRMAS \(fin\) ──/g)].map((m) => m[0]);
    assert.equal(tramos.length, 3, 'un tramo de firmas por adaptador (storage, firestore, local)');
    for (const t of tramos) assert.ok(!codigo(t).includes('getDownloadURL'), t.slice(0, 80));
  });

  test('url() desvía las rutas de firma a urlFirma ANTES de pedir una URL', () => {
    const urls = [...ALMACEN.matchAll(/async url\(meta\) \{\n([^\n]*)/g)].map((m) => m[1]);
    assert.equal(urls.length, 3);
    for (const l of urls) assert.match(l, /if \(esRutaFirma\(meta\.ruta\)\) return this\.urlFirma\(meta\);/);
  });

  test('resolver: una ref de firma sin versión emitida no se resuelve; cada ref en su carpeta', () => {
    assert.match(ALMACEN, /if \(r\.startsWith\('firma:'\) && !ctx\.versionDoc\) return null;/);
    assert.match(ALMACEN, /if \(!rutaAdmitidaPara\(r, meta\.ruta\)\) return \{ rechazada: true \};/);
  });
});

describe('sin datos de personas en el código (decisión 3: editores por uid)', () => {
  // Los apellidos se leen de scripts/guardia-firmas.mjs (SOSPECHOSO): así esta
  // prueba no escribe ningún nombre en el repositorio.
  const fuente = /const SOSPECHOSO = \/\(([^)]*)\)\/i;/.exec(leer('scripts/guardia-firmas.mjs'));
  const GENERICAS = new Set(['firma', 'signature', '\\bsign', 'firmas-equipo']);
  const apellidos = fuente ? fuente[1].split('|').filter((x) => !GENERICAS.has(x)) : [];
  const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const PERSONAS = { test: (texto) => apellidos.some((x) => sinTildes(texto).includes(x)) };
  test('la lista de apellidos se pudo leer de la guardia', () => { assert.ok(apellidos.length >= 4, apellidos.join(',')); });
  for (const [nombre, texto] of [['nube', NUBE], ['local', LOCAL], ['almacén', ALMACEN], ['rutas', RUTAS],
    ['reglas de Firestore (bloque nuevo)', leer('firestore.rules').split('Informe de Mantenimiento Brigada · formato F60-ADM')[1].split('// ── Resto: cerrado por defecto ──')[0]],
    ['reglas de Storage (bloque nuevo)', leer('storage.rules').split('Informe de Mantenimiento Brigada · F60-ADM')[1].split('// ── Resto: cerrado por defecto ──')[0]]]) {
    test(`${nombre}: ningún apellido del equipo`, () => {
      assert.ok(!PERSONAS.test(texto));
    });
  }
});

describe('consultas con tope y sin escuchas de colecciones (CLAUDE.md §3.2)', () => {
  test('toda consulta de la nube lleva limit() y no hay onSnapshot', () => {
    const c = codigo(NUBE);
    assert.ok(!/onSnapshot/.test(c));
    const consultas = [...c.matchAll(/F\.query\(([\s\S]*?)\);/g)].map((m) => m[1]);
    assert.ok(consultas.length >= 4);
    for (const q of consultas) assert.match(q, /F\.limit\(/, q.slice(0, 60));
  });

  test('la nube escribe con transacción cuando hay estado compartido (rev)', () => {
    const c = codigo(NUBE);
    assert.match(c, /F\.runTransaction\(/);
    for (const metodo of ['guardar', 'corregir', 'emitir', 'anular']) {
      const cuerpo = new RegExp(`async ${metodo}\\([^)]*\\) \\{([\\s\\S]*?)\\n    \\},`).exec(c);
      assert.ok(cuerpo, metodo);
      assert.match(cuerpo[1], /transaccion\(id,/, metodo + ' va por transacción');
    }
    assert.ok(!/deleteDoc/.test(c), 'el repositorio nunca borra informes');
  });
});

// ── Storage: tope de DOS documentos de Firestore por evaluación ─────────────────
// «No more than two Firestore documents may be accessed in a single Rules evaluation»
// (firebase.google.com/docs/storage/security/rules-conditions). El EMULADOR NO aplica ese
// tope (la revisión de seguridad lo comprobó: una regla con 3 lecturas pasaba en el emulador
// y fallaría en producción), así que se cuenta aquí, en el peor caso, para cada `allow`
// del bloque del informe en storage.rules.
describe('storage.rules · bloque del informe: ≤ 2 documentos de Firestore por regla', () => {
  const REGLAS = leer('storage.rules');
  const ini = REGLAS.indexOf('Informe de Mantenimiento Brigada');
  const fin = REGLAS.indexOf('Resto: cerrado por defecto', ini);
  const bloque = REGLAS.slice(ini, fin).replace(/\/\/.*$/gm, '');
  // Documentos que puede tocar cada función auxiliar (peor caso). Las de fuera del bloque vienen de
  // storage.rules:25-60: el perfil es usuarios/{uid}; el arranque legado mira admins/{uid}.
  const DOCS = {
    hasProfile: ['usuarios'], profile: ['usuarios'], adminsBootstrapValido: ['usuarios', 'admins'],
    isTeamMember: ['usuarios', 'admins'], isAdmin: ['usuarios', 'admins'], ibrEditor: ['usuarios', 'config']
  };
  const docsDe = (expr) => {
    const s = new Set();
    for (const m of expr.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) (DOCS[m[1]] || []).forEach((d) => s.add(d));
    for (const m of expr.matchAll(/firestore\.(?:get|exists)\(\/databases\/\(default\)\/documents\/([A-Za-z_]+)/g)) s.add(m[1]);
    return s;
  };

  test('toda función del bloque que lee Firestore está contada', () => {
    for (const m of bloque.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/g)) {
      if (/firestore\./.test(m[2])) assert.ok(DOCS[m[1]], `la función ${m[1]} lee Firestore y no está en la tabla de esta prueba`);
    }
    assert.ok(!/ibrInforme\s*\(/.test(bloque), 'nada lee el documento del informe (sería el tercero)');
  });

  test('cada allow del bloque lee como máximo 2 documentos distintos', () => {
    const allows = [...bloque.matchAll(/allow\s+[\w, ]+:\s*if\s+([\s\S]*?);/g)];
    assert.ok(allows.length >= 12, 'se encontraron las reglas del bloque (' + allows.length + ')');
    for (const m of allows) {
      const d = docsDe(m[1]);
      assert.ok(d.size <= 2, `«allow … if ${m[1].replace(/\s+/g, ' ').slice(0, 80)}…» lee ${d.size} documentos: ${[...d].join(', ')}`);
    }
  });
});
