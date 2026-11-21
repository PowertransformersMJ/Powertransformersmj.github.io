// Firma de ODT Afinia · revisión ESTÁTICA de la página, la pantalla y la capa de datos:
//   · la página copia la estructura de informe-brigada (page-guard, AQUA, import() con try/catch,
//     lucide/aqua/aqua-shell con defer) y, con el «procede» (99 §231.15), está en el menú UNA vez, en Ejecución;
//   · CSS con prefijo .odt-, sin transition: all ni backdrop-filter, y el módulo NO se imprime (L-107);
//   · ninguna salida del documento fuera de «Descargar» (sin window.print, window.open ni URLs públicas);
//     la descarga registra ANTES de entregar; pdf.js recibe siempre una COPIA;
//   · la pantalla no usa innerHTML (los textos de personas van con textContent);
//   · la capa de datos: lector propio de «Mi firma» (no data/firmas.js), lecturas que deciden del
//     SERVIDOR, reautenticación con contraseña SOLO al habilitarse (decisión del Ingeniero del 2026-11-21: firmar
//     usa el token de la sesión abierta, sin contraseña; publicar tampoco la pide);
//   · firmar: la declaración completa + «Firmar» → «Confirmar firma» (confirmar-firma.js), sin casilla ni contraseña;
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
const DATOS = Object.fromEntries(['odt_afinia.js', 'odt_afinia_lotes.js', 'odt_afinia_mi_firma.js', 'odt_afinia_cuenta.js', 'odt_afinia_sesion.js']
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
    // Mientras tanto, el rótulo de borrador sale en el acuerdo (habilitación) y en la declaración de la firma.
    for (const n of ['declaracion.js', 'confirmar-firma.js']) {
      assert.match(codigo(UI[n]), /TEXTOS_APROBADOS \? null : h\('p', \{ class: 'odt-borrador'/, n);
    }
    assert.match(codigo(UI['habilitarme.js']), /armarDeclaracion\(/);
    // 2026-11-21: la firma ya no usa la pieza con casilla y contraseña.
    assert.match(codigo(UI['firmar.js']), /armarConfirmacionFirma\(/);
    assert.ok(!/armarDeclaracion|declaracion\.js/.test(codigo(UI['firmar.js'])), 'firmar.js no usa declaracion.js');
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
  test('2026-11-21: la declaración de la FIRMA va con textContent, sin casilla ni contraseña, y no se envía dos veces', () => {
    const d = codigo(UI['confirmar-firma.js']);
    assert.match(d, /textoEl\.textContent = texto;/);
    assert.ok(!/h\('input'/.test(d), 'ningún campo');
    assert.ok(!/checkbox|password|contrase/i.test(d), 'ni casilla ni contraseña');
    assert.match(d, /text: 'Firmar'/);
    assert.match(d, /text: 'Confirmar firma'/);
    assert.match(d, /text: 'Cancelar'/);
    assert.match(d, /export const LINEA_CONFIRMAR = 'Al confirmar, acepta la declaración de arriba y su firma queda registrada\.';/);
    // «ocupado» se marca ANTES de esperar a alConfirmar (un segundo clic no vuelve a entrar).
    assert.match(d, /if \(ocupado \|\| bloqueado \|\| caja\.hidden\) return;\s*ocupado = true; actualizar\(\);\s*try \{ await alConfirmar\(\); \}/);
    // En el navegador, el `display` de .odt-btn y .odt-acciones gana sobre el atributo `hidden`: lo que se esconde es
    // el paso «Firmar» (div sin clase) y la caja .odt-confirmar, que no fija `display` en la hoja de estilos.
    assert.ok(!/\b(boton|confirmar|cancelar)\.hidden\b/.test(d), 'nunca se esconde un .odt-btn con hidden');
    assert.match(d, /const pasoFirmar = h\('div', \{\}, h\('div', \{ class: 'odt-acciones' \}, boton\)\);/);
    assert.match(d, /pasoFirmar\.hidden = true;\s*caja\.hidden = false;/);
    const cssSin = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const reglasConfirmar = [...cssSin.matchAll(/([^{}]*\.odt-confirmar[^{}]*)\{([^}]*)\}/g)].map((m) => m[2]);
    assert.ok(reglasConfirmar.length >= 1, 'la caja .odt-confirmar tiene estilo');
    for (const r of reglasConfirmar) assert.ok(!/display\s*:/.test(r), '.odt-confirmar no fija display (si lo fijara, hidden no la escondería)');
    assert.match(cssSin, /\.odt-btn \{\s*display: inline-flex;/, 'control (L-144): el lector sí ve el display de .odt-btn');
    // firmar.js tampoco arma campos de contraseña ni casillas.
    const f = codigo(UI['firmar.js']);
    assert.ok(!/password|checkbox|h\('input'/.test(f), 'firmar.js sin campos');
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
  test('reautenticación: reauthenticateWithCredential + getIdToken(true) SOLO al habilitarse; publicar y firmar NO la piden', () => {
    const c = codigo(DATOS['odt_afinia_cuenta.js']);
    assert.match(c, /reauthenticateWithCredential\(u, cred\)/);
    assert.match(c, /getIdToken\(true\)/);
    assert.match(c, /sendEmailVerification/);
    assert.match(c, /sendPasswordResetEmail/);
    assert.ok(!/reautenticar/.test(codigo(UI['publicar.js'])), 'publicar no pide contraseña (D4)');
    // Decisión del Ingeniero del 2026-11-21: la contraseña solo al iniciar sesión (y al aceptar el acuerdo).
    assert.match(codigo(UI['habilitarme.js']), /cuenta\.reautenticar\(clave, \{ uidEsperado: sesion\.uid \}\)/, 'habilitarse SÍ la pide');
    const f = codigo(UI['firmar.js']);
    assert.ok(!/reautenticar/.test(f), 'firmar.js ya no llama a reautenticar');
    assert.match(f, /await sesionFirma\.tokenVigente\(\{ uidEsperado: c\.uid \}\)/, 'firmar usa el token de la sesión');
    assert.match(f, /verificarSesionParaFirmar\(c, \{ uidVivo: await cuenta\.uidVivo\(\), token \}\)/);
    const iVer = f.indexOf('verificarSesionParaFirmar(c,'); const iFirmar = f.indexOf('await repo.firmar(c, token)');
    assert.ok(iVer > 0 && iFirmar > iVer, 'se verifica la sesión ANTES de escribir');
    // Ninguna otra pieza de la firma toca credenciales: el token se renueva sin contraseña.
    const ses = codigo(DATOS['odt_afinia_sesion.js']);
    assert.match(ses, /await u\.getIdToken\(true\);/);
    assert.ok(!/reauthenticate|EmailAuthProvider|credential|contrasena/i.test(ses), 'la sesión de la firma no pide contraseña');
    for (const n of ['confirmar-firma.js', 'preparar.js']) assert.ok(!/reautenticar|reauthenticate/.test(codigo(UI[n])), n);
  });
  test('publicar: firmantes SOLO de la lista blanca (candidatos) y revisión ESTRUCTURAL de las casillas', () => {
    const c = codigo(UI['publicar.js']);
    assert.match(c, /await repo\.candidatos\(\)/);
    assert.ok(!/listarHabilitados/.test(c), 'no ofrece habilitados sin la lista blanca');
    assert.match(c, /await revisarEstructura\(st\.bytes, v\.zonas, st\.PDFLib/);
    assert.match(c, /revisarCasillas\(/, 'y la tinta del raster');
    assert.match(c, /const g = \+\+gen;/, 'token de generación al elegir archivo');
    assert.match(c, /cerrarLectura\(\); st = null;/, 'cierra pdf.js al publicar');
    // 2026-11-21: sin el aviso D5 de «5 minutos» (la firma ya no mide esa ventana: el aviso daba una protección falsa).
    assert.ok(!/avisoSesionReciente|edadSesion|reautenticacionMs|5 minutos|Soy el titular|'Esperar'/.test(c), 'Publicar ya no tiene el paso D5');
    assert.match(c, /btnPublicar\.disabled = true; btnValidar\.disabled = true;\s*await publicarYa\(\);/, 'publica directo, con los botones ocupados');
  });
  test('la capa de datos no importa Firebase de forma estática (se prueba en Node con dobles)', () => {
    for (const [n, t] of Object.entries(DATOS)) assert.ok(!/^import[^;]*gstatic/m.test(t), n);
  });
  test('firmar: lote de 2 (set del acto + update de la ODT)', () => {
    const c = codigo(DATOS['odt_afinia.js']);
    assert.match(c, /\{ ruta: plan\.acto\.ruta, datos: plan\.acto\.datos \},\s*\{ tipo: 'update', ruta: plan\.odt\.ruta, datos: plan\.odt\.cambios \}/);
  });
});

describe('decisiones del 2026-11-21 en la pantalla (L-102: caché de 10 min)', () => {
  test('Publicar: la fecha se llama «Fecha prevista de la orden (dd/mm/aaaa)» y consulta el N.º antes de publicar', () => {
    const c = codigo(UI['publicar.js']);
    assert.match(c, /'Fecha prevista de la orden \(dd\/mm\/aaaa\)'/);
    assert.ok(!/Fecha del trabajo/.test(c));
    assert.match(c, /typeof repo\.previaDelNro === 'function'/, 'un repositorio viejo sin previaDelNro no rompe la validación');
  });
  test('Firmar: el Responsable ya no edita la FECHA CIERRE (sin campo) y la toma de la ODT', () => {
    const c = codigo(UI['firmar.js']);
    assert.ok(!/odtFechaCierre/.test(c), 'no hay campo de fecha de cierre');
    assert.match(c, /fechaCierre: rol === 'responsable' \? fechaCierreDe\(fresca\) : undefined/);
  });
  test('lo nuevo se importa del archivo NUEVO (odt_afinia_cierre.js); de los vecinos viejos, solo nombres que ya existían', () => {
    // Nombres que un vecino que quedó viejo en la caché NO tendría: ninguna pantalla los pide por nombre a ese vecino.
    const nuevos = ['COMPOSITOR_V2', 'COMPOSITOR_VIGENTE', 'ESTADOS_CIERRE', 'puedeDescargar', 'puedeReemplazar', 'textoCierreAfinia', 'MSG_RECARGAR',
      'MSG_RECARGAR_FIRMA', 'etiquetaEstado', 'errorFirmaAlDia', 'avisoAntesDeFirmar', 'cierreDelResponsable'];
    const pedidos = (t) => [...codigo(t).matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)]
      .filter((m) => !m[2].endsWith('odt_afinia_cierre.js'))
      .flatMap((m) => nuevos.filter((x) => new RegExp('\\b' + x + '\\b').test(m[1])).map((x) => x + ' a ' + m[2]));
    for (const [n, t] of Object.entries({ ...UI, ...DATOS })) assert.deepEqual(pedidos(t), [], n);
    // Mutación (L-144): pedirle un nombre nuevo a un vecino viejo SÍ se ve.
    assert.deepEqual(pedidos("import { puedeDescargar } from '../../domain/odt_afinia_estados.js';"), ['puedeDescargar a ../../domain/odt_afinia_estados.js']);
  });
  test('2026-11-21 (L-102): la firma sin contraseña sale de archivos NUEVOS; a los vecinos viejos no se les pide nada nuevo', () => {
    const NUEVOS = { crearSesionFirma: 'odt_afinia_sesion.js', verificarSesionParaFirmar: 'odt_afinia_sesion.js',
      armarConfirmacionFirma: 'confirmar-firma.js', LINEA_CONFIRMAR: 'confirmar-firma.js' };
    const pedidos = (t) => [...codigo(t).matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)]
      .flatMap((m) => Object.entries(NUEVOS).filter(([x, arch]) => new RegExp('\\b' + x + '\\b').test(m[1]) && !m[2].endsWith('/' + arch))
        .map(([x]) => x + ' a ' + m[2]));
    for (const [n, t] of Object.entries({ ...UI, ...DATOS })) assert.deepEqual(pedidos(t), [], n);
    assert.deepEqual(pedidos("import { verificarSesionParaFirmar } from './preparar.js';"), ['verificarSesionParaFirmar a ./preparar.js'], 'mutación (L-144)');
    // Los archivos nuevos solo piden a sus vecinos nombres que ya existían en la entrega anterior.
    const ses = codigo(DATOS['odt_afinia_sesion.js']);
    assert.match(ses, /import \{ PROVEEDOR, esHuella \} from '\.\.\/domain\/odt_afinia_rutas\.js';/);
    assert.match(ses, /import \{ ErrorOdt, errorDesdeFirebase \} from '\.\/odt_afinia_lotes\.js';/);
    assert.match(ses, /import \{ claimsDe \} from '\.\/odt_afinia_cuenta\.js';/);
    const conf = codigo(UI['confirmar-firma.js']);
    assert.match(conf, /import \{ h \} from '\.\/comun\.js';/);
    assert.match(conf, /import \{ TEXTOS_APROBADOS, ROTULO_BORRADOR \} from '\.\.\/\.\.\/domain\/odt_afinia_textos\.js';/);
    // Una firmar.js vieja de la caché sigue encontrando verificarAntesDeFirmar en preparar.js (alias de la nueva).
    assert.match(codigo(UI['preparar.js']), /export function verificarAntesDeFirmar\(congelado, \{ uidVivo, token \} = \{\}\) \{\s*return verificarSesionParaFirmar\(congelado, \{ uidVivo, token \}\);/);
  });
  test('bandeja: una pestaña sin su clave (dominio viejo) sale vacía, y el repositorio viejo sin reemplazar/cerrar pide recargar', () => {
    assert.match(codigo(UI['bandeja.js']), /const de = \(clave\) => grupos\[clave\] \|\| \[\];/);
    assert.ok(!/grupos\[p\.clave\]\.length/.test(codigo(UI['bandeja.js'])));
    assert.match(codigo(UI['detalle.js']), /typeof repo\[nombre\] !== 'function'/);
  });
  test('preparar: no prepara una firma @2 con un compositor viejo de la caché (marca ESTAMPA.dyGenerada)', () => {
    const c = codigo(UI['preparar.js']);
    assert.match(c, /Number\.isFinite\(ESTAMPA\.dyGenerada\)/);
    assert.match(c, /COMPOSITOR !== COMPOSITOR_VIGENTE/);
    assert.match(c, /cierre = cierreDelResponsable\(odt, fecha\)/, 'el pie completo {si, fecha, generada} sale del archivo nuevo');
  });
  test('caché mezclada (L-102): el compositor que se ESCRIBE sale de odt_afinia_cierre.js, y firmar/datos miran la copia antes', () => {
    // Un odt_afinia_rutas.js nuevo (COMPOSITOR = @2) con un armador viejo escribía «@2» sobre lo compuesto en @1:
    // el armador y la capa de datos ya no leen COMPOSITOR de rutas; la regla además exige cierre.generada == N.º.
    const lotes = codigo(DATOS['odt_afinia_lotes.js']);
    assert.match(lotes, /import \{ COMPOSITOR_VIGENTE \} from '\.\.\/domain\/odt_afinia_cierre\.js'/);
    assert.match(lotes, /exige\(c\.compositor === COMPOSITOR_VIGENTE/);
    assert.match(lotes, /datos\.cierre = \{ si: true, fecha: c\.cierre\.fecha, generada: c\.cierre\.generada \}/);
    for (const [n, t] of [['odt_afinia_lotes.js', lotes], ['odt_afinia.js', codigo(DATOS['odt_afinia.js'])]]) {
      const deRutas = /import\s*\{([^}]*)\}\s*from\s*'\.\.\/domain\/odt_afinia_rutas\.js'/.exec(t);
      assert.ok(deRutas && !/\bCOMPOSITOR\b/.test(deRutas[1]), n + ' no toma COMPOSITOR de rutas');
    }
    // La capa de datos compara la copia y el acto armado ANTES de escribir el lote.
    const datos = codigo(DATOS['odt_afinia.js']);
    const iPlan = datos.indexOf('const plan = planFirma(congelado');
    const iGuarda = datos.indexOf('errorFirmaAlDia(congelado, plan.acto.datos)');
    const iLote = datos.indexOf('const lote = aplicarLote(F, d, [', iPlan);
    assert.ok(iPlan > 0 && iGuarda > iPlan && iLote > iGuarda, 'planFirma → guarda → lote');
    // firmar.js: la copia de un preparar.js viejo no se muestra ni se firma; antes de la fecha prevista no hay botón activo.
    const firmar = codigo(UI['firmar.js']);
    assert.match(firmar, /const errAlDia = errorFirmaAlDia\(preparado\);\s*if \(errAlDia\) throw new Error\(errAlDia\);\s*congelado = preparado;/);
    assert.match(firmar, /if \(bloqueada\) return;/);
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

describe('confirmaciones en dos pasos: el botón oculto no se ve (99 §232.9)', () => {
  test('el CSS hace que [hidden] le gane al display de .odt-btn', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../assets/css/odt-afinia.css', import.meta.url), 'utf8');
    assert.match(css, /\.odt-btn\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
  });
});
