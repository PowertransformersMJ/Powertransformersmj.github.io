// Firma de ODT Afinia · revisión ESTÁTICA de la página, la pantalla y la capa de datos:
//   · la página copia la estructura de informe-brigada (page-guard, AQUA, import() con try/catch,
//     lucide/aqua/aqua-shell con defer) y, con el «procede» (99 §231.15), está en el menú UNA vez, en Ejecución;
//   · CSS con prefijo .odt-, sin transition: all ni backdrop-filter, y el módulo NO se imprime (L-107);
//   · ninguna salida del documento fuera de «Descargar» (sin window.print, window.open ni URLs públicas);
//     la descarga registra ANTES de entregar; pdf.js recibe siempre una COPIA;
//   · la pantalla no usa innerHTML (los textos de personas van con textContent);
//   · la capa de datos: lector propio de «Mi firma» (no data/firmas.js), lecturas que deciden del
//     SERVIDOR, reautenticación con getIdToken(true) solo al firmar o habilitarse (publicar NO la pide);
//   · repo público: sin correos ni dominios reales en el código del módulo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
/** El código sin comentarios (no confundir lo que se explica con lo que se ejecuta). */
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const PAGINA = leer('pages/firma-odt-afinia.html');
const CSS = leer('assets/css/odt-afinia.css');
const UI_DIR = join(RAIZ, 'assets/js/ui/odt-afinia');
const UI = Object.fromEntries(readdirSync(UI_DIR).filter((n) => n.endsWith('.js')).map((n) => [n, readFileSync(join(UI_DIR, n), 'utf8')]));
const DATOS = Object.fromEntries(['odt_afinia.js', 'odt_afinia_lotes.js', 'odt_afinia_mi_firma.js', 'odt_afinia_cuenta.js']
  .map((n) => [n, leer('assets/js/data/' + n)]));

describe('página con la estructura de informe-brigada, en el menú tras el «procede»', () => {
  test('guard, estilos AQUA y del módulo', () => {
    assert.match(PAGINA, /<script type="module" src="\.\.\/assets\/js\/auth\/page-guard\.js"><\/script>/);
    for (const css of ['aqua-tokens.css', 'aqua-components.css', 'odt-afinia.css']) assert.ok(PAGINA.includes('../assets/css/' + css), css);
    assert.match(PAGINA, /<meta name="robots" content="noindex, nofollow"\/>/);
  });
  test('el módulo entra por import() dentro de try/catch (L-102)', () => {
    const m = /<script type="module">([\s\S]*?)<\/script>/.exec(PAGINA);
    assert.ok(m, 'script de arranque');
    assert.match(m[1], /try\s*\{[\s\S]*await import\('\.\.\/assets\/js\/ui\/odt-afinia\/app\.js'\)[\s\S]*\}\s*catch\s*\(err\)/);
  });
  test('lucide, aqua y aqua-shell con defer', () => {
    for (const s of ['../assets/vendor/lucide/lucide.min.js', '../assets/js/aqua.js', '../assets/js/aqua-shell.js']) {
      assert.ok(PAGINA.includes('<script src="' + s + '" defer></script>'), s);
    }
  });
  test('con su «procede» (99 §231.15): el menú la nombra UNA vez, en Ejecución, debajo de Órdenes, y la página está publicada', () => {
    const shell = leer('assets/js/aqua-shell.js');
    const lineas = shell.split('\n').filter((l) => l.includes('firma-odt-afinia'));
    assert.equal(lineas.length, 1, 'una sola línea del menú');
    assert.match(lineas[0], /href="\$\{u\('pages\/firma-odt-afinia\.html'\)\}" class="sb-item" data-key="firma-odt-afinia"/);
    assert.match(lineas[0], /data-lucide="signature"/);
    assert.ok(!/sb-admin/.test(lineas[0]), 'no es solo de admin: la ven los técnicos que firman');
    const ejecucion = shell.slice(shell.indexOf('<div class="sb-group-title">Ejecución</div>'));
    const bloque = ejecucion.slice(0, ejecucion.indexOf('</div>', ejecucion.indexOf('</div>') + 1));
    assert.ok(bloque.indexOf("pages/ordenes.html')") < bloque.indexOf('firma-odt-afinia') && bloque.indexOf('firma-odt-afinia') < bloque.indexOf("pages/ordenes-materiales.html')"), 'entre Órdenes y Órdenes de Materiales');
    assert.match(UI['app.js'], /export const ESTADO_PAGINA = 'publicado';/);
  });
  test('la página no pasa a «publicado» con los textos sin el «procede» del Ingeniero', async () => {
    const { TEXTOS_APROBADOS } = await import('../assets/js/domain/odt_afinia_textos.js');
    const m = /export const ESTADO_PAGINA = '([a-z_]+)';/.exec(UI['app.js']);
    assert.ok(m, 'ESTADO_PAGINA declarado');
    assert.ok(['vista_previa', 'publicado'].includes(m[1]));
    if (m[1] === 'publicado') assert.equal(TEXTOS_APROBADOS, true, 'ESTADO_PAGINA publicado exige TEXTOS_APROBADOS = true');
    // Mientras tanto, el rótulo de borrador sale en la declaración (firma y habilitación).
    if (!TEXTOS_APROBADOS) assert.match(codigo(UI['declaracion.js']), /TEXTOS_APROBADOS \? null : h\('p', \{ class: 'odt-borrador'/);
    assert.match(codigo(UI['habilitarme.js']), /armarDeclaracion\(/);
    assert.match(codigo(UI['firmar.js']), /armarDeclaracion\(/);
  });
  test('trae el aviso de que no se imprime', () => {
    assert.match(PAGINA, /class="odt-solo-impresion"/);
  });
});

describe('CSS (prefijo .odt-, rendimiento, impresión)', () => {
  const sinComentarios = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  test('sin transition: all, sin backdrop-filter', () => {
    assert.ok(!/transition\s*:\s*all/i.test(sinComentarios));
    assert.ok(!/transition\s*:[^;]*\ball\b/i.test(sinComentarios));
    assert.ok(!/backdrop-filter/i.test(sinComentarios));
  });
  test('cada selector lleva el prefijo .odt-', () => {
    const bloques = [...sinComentarios.matchAll(/(@?[^{}@]+)\{/g)].map((m) => m[1].trim());
    const selectores = bloques.filter((s) => s && !s.startsWith('@') && !/^(from|to|\d+%)$/.test(s));
    assert.ok(bloques.filter((s) => s.startsWith('@media')).length >= 2, 'el lector ve los @media');
    assert.ok(selectores.length > 40, 'el lector de selectores ve las reglas (' + selectores.length + ')');
    for (const s of selectores) {
      for (const parte of s.split(',')) assert.match(parte.trim(), /\.odt-/, 'sin prefijo: ' + parte.trim());
    }
    // Mutación (L-144): un selector sin prefijo se vería.
    assert.ok(![...'body { color: red }'.matchAll(/(@?[^{}@]+)\{/g)].map((m) => m[1].trim()).every((s) => /\.odt-/.test(s)));
  });
  test('@media print oculta el módulo, los lienzos y la vista', () => {
    const m = /@media print\s*\{([\s\S]*?)\n\}/.exec(sinComentarios);
    assert.ok(m, 'bloque de impresión');
    for (const c of ['.odt-raiz', '.odt-lienzo', '.odt-vista']) assert.ok(m[1].includes(c), c);
    assert.match(m[1], /display:\s*none\s*!important/);
  });
});

describe('salidas del documento (L-107)', () => {
  const todo = Object.entries(UI).map(([n, t]) => [n, codigo(t)]);
  test('sin window.print, window.open ni URL de descarga pública', () => {
    for (const [n, c] of todo) {
      assert.ok(!/\bprint\s*\(/.test(c), n + ': print()');
      assert.ok(!/window\.open\s*\(/.test(c), n + ': window.open');
      assert.ok(!/getDownloadURL/.test(c), n + ': getDownloadURL');
    }
  });
  test('entregarBlob solo se usa en la descarga registrada', () => {
    const usos = todo.filter(([, c]) => /entregarBlob/.test(c)).map(([n]) => n).sort();
    assert.deepEqual(usos, ['comun.js', 'detalle.js']);
    assert.match(todo.find(([n]) => n === 'detalle.js')[1], /descargarOdt\(\{[\s\S]*registrar:[\s\S]*entregar: entregarBlob/);
    const prep = codigo(UI['preparar.js']);
    const i = prep.indexOf('await registrar('); const j = prep.indexOf('entregar(d.bytes');
    assert.ok(i > 0 && j > i, 'registrar ANTES de entregar');
  });
  test('createObjectURL solo en comun.js: entregarBlob y el import de pdf-lib desde los bytes verificados', () => {
    const usos = todo.filter(([, c]) => /createObjectURL/.test(c)).map(([n]) => n);
    assert.deepEqual(usos, ['comun.js']);
    const c = codigo(UI['comun.js']);
    assert.equal((c.match(/createObjectURL\(/g) || []).length, 2, 'dos usos con nombre');
    assert.match(c, /crearUrl\(new Blob\(\[bytes\], \{ type: 'text\/javascript' \}\)\)/, 'pdf-lib se importa de ESOS bytes');
    assert.match(c, /importar\(urlVerificada\)/);
  });
  test('cada lienzo de pdf.js pasa por bloquearCopia (sin menú contextual ni arrastre)', () => {
    const v = codigo(UI['vista-pdf.js']);
    assert.match(v, /bloquearCopia\(lienzo\)/);
    const c = codigo(UI['comun.js']);
    assert.match(c, /addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\)/);
    assert.match(c, /setAttribute\('draggable', 'false'\)/);
  });
  test('no se expone nada en window (ni repositorio ni cuenta)', () => {
    const m = /<script type="module">([\s\S]*?)<\/script>/.exec(PAGINA);
    assert.ok(!/window\.__sgmOdtAfinia\s*=/.test(codigo(m[1])));
    for (const [n, t] of Object.entries(UI)) assert.ok(!/window\.__sgmOdt|globalThis\.__sgmOdt/.test(codigo(t)), n);
    assert.match(codigo(UI['app.js']), /return \{ ir \};/);
  });
  test('pdf.js recibe siempre una COPIA de los bytes', () => {
    const v = codigo(UI['vista-pdf.js']);
    assert.match(v, /data:\s*bytes\.slice\(\)/);
    assert.equal((v.match(/getDocument\(/g) || []).length, 1, 'una sola entrada a pdf.js');
  });
});

describe('pantalla: textos de personas sin HTML', () => {
  test('ningún archivo de ui/odt-afinia usa innerHTML ni insertAdjacentHTML', () => {
    for (const [n, t] of Object.entries(UI)) assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(codigo(t)), n);
  });
  test('la declaración va con textContent y la casilla nace desmarcada', () => {
    const d = codigo(UI['declaracion.js']);
    assert.match(d, /textoEl\.textContent = texto;/);
    assert.match(d, /casilla\.checked = false;/);
    assert.match(d, /contrasena\.value = '';/);
  });
});

describe('capa de datos', () => {
  test('«Mi firma» con lector PROPIO: no usa data/firmas.js ni devuelve null ante un fallo', () => {
    const m = codigo(DATOS['odt_afinia_mi_firma.js']);
    assert.ok(!/['"]\.\/firmas\.js['"]|data\/firmas\.js/.test(m));
    assert.ok(!/return null/.test(m), 'un fallo no se convierte en «no hay»');
    assert.match(m, /throw errorDesdeFirebase\(e\)/);
    assert.match(m, /COL\.firmaPropia, s\.uid/, 'la ruta sale del uid de la sesión, no de un parámetro');
    for (const [n, t] of Object.entries(UI)) assert.ok(!/miFirma\s*\(\s*\)|from '\.\.\/\.\.\/data\/firmas\.js'/.test(codigo(t)), n + ' usa el miFirma() viejo');
  });
  test('las lecturas que deciden van al servidor', () => {
    const c = codigo(DATOS['odt_afinia.js']);
    assert.match(c, /getDocFromServer/);
    assert.ok((c.match(/getServidor\(F,/g) || []).length >= 8);
    assert.ok(!/F\.getDoc\(/.test(c), 'ninguna lectura de caché directa');
  });
  test('reautenticación: reauthenticateWithCredential + getIdToken(true); publicar NO la pide', () => {
    const c = codigo(DATOS['odt_afinia_cuenta.js']);
    assert.match(c, /reauthenticateWithCredential\(u, cred\)/);
    assert.match(c, /getIdToken\(true\)/);
    assert.match(c, /sendEmailVerification/);
    assert.match(c, /sendPasswordResetEmail/);
    assert.ok(!/reautenticar/.test(codigo(UI['publicar.js'])), 'publicar no pide contraseña (D4)');
    assert.match(codigo(UI['firmar.js']), /cuenta\.reautenticar\(clave, \{ uidEsperado: c\.uid \}\)/);
  });
  test('publicar: firmantes SOLO de la lista blanca (candidatos) y revisión ESTRUCTURAL de las casillas', () => {
    const c = codigo(UI['publicar.js']);
    assert.match(c, /await repo\.candidatos\(\)/);
    assert.ok(!/listarHabilitados/.test(c), 'no ofrece habilitados sin la lista blanca');
    assert.match(c, /await revisarEstructura\(st\.bytes, v\.zonas, st\.PDFLib/);
    assert.match(c, /revisarCasillas\(/, 'y la tinta del raster');
    assert.match(c, /const g = \+\+gen;/, 'token de generación al elegir archivo');
    assert.match(c, /cerrarLectura\(\); st = null;/, 'cierra pdf.js al publicar');
    assert.match(c, /avisoSesionReciente\(edad, errEdad\)/, 'D5: aviso si la sesión es reciente');
  });
  test('la capa de datos no importa Firebase de forma estática (se prueba en Node con dobles)', () => {
    for (const [n, t] of Object.entries(DATOS)) assert.ok(!/^import[^;]*gstatic/m.test(t), n);
  });
  test('firmar: lote de 2 (set del acto + update de la ODT)', () => {
    const c = codigo(DATOS['odt_afinia.js']);
    assert.match(c, /\{ ruta: plan\.acto\.ruta, datos: plan\.acto\.datos \},\s*\{ tipo: 'update', ruta: plan\.odt\.ruta, datos: plan\.odt\.cambios \}/);
  });
});

describe('repo público', () => {
  test('sin correos ni dominios reales en el módulo (solo @prueba.test en pruebas)', () => {
    const textos = [...Object.values(UI), ...Object.values(DATOS), PAGINA, CSS];
    for (const t of textos) assert.ok(!/@(gmail|hotmail|outlook|afinia|epm)\./i.test(t));
  });
  test('ningún número de 8 dígitos (un N.º de ODT real) escrito en el código del módulo', () => {
    for (const [n, t] of [...Object.entries(UI), ...Object.entries(DATOS)]) assert.ok(!/(?<![0-9])[0-9]{8}(?![0-9])/.test(t), n);
    assert.ok(!/(?<![0-9])[0-9]{8}(?![0-9])/.test(PAGINA));
  });
});
