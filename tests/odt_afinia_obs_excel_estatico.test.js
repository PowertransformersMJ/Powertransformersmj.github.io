// Firma de ODT Afinia · «POR SUBSANAR» · DESCARGAR EXCEL · revisión ESTÁTICA (lo que una prueba de ejecución no ve):
//   · L-102: lo nuevo vive en archivos NUEVOS; a sus vecinos de antes (que pudieron quedar viejos en la caché del
//     navegador) solo les piden nombres que ya existían; por-subsanar.js carga el bloque con import() y pregunta si trae
//     lo que usa (si no carga, la lista sigue igual);
//   · los dos archivos de dominio son PUROS (sin Firebase, sin DOM, sin red, sin SheetJS);
//   · la pantalla: SheetJS 0.18.5 del CDN con su SRI (== la de node_modules), entregada por XLSX.writeFile (sin enlaces a
//     Blobs propios, L-107), sin innerHTML y sin esconder botones; el encabezado va en la fila 1 con el filtro en todo el
//     rango; el CSS nuevo con el prefijo .odt-;
//   · repo público: en el código nuevo, ningún N.º de 8 dígitos ni correo; en las pruebas nuevas, solo N.º inventados
//     (empiezan por 9) y ninguno con la forma de los de Afinia.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, posix } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const NUEVOS = [
  'assets/js/domain/odt_afinia_obs_documento.js',
  'assets/js/domain/odt_afinia_obs_excel.js',
  'assets/js/ui/odt-afinia/subsanar-excel.js'
];
const PRUEBAS = ['tests/odt_afinia_obs_documento.test.js', 'tests/odt_afinia_obs_excel.test.js', 'tests/odt_afinia_obs_excel_ui.test.js',
  'tests/odt_afinia_obs_excel_estatico.test.js'];
const FUENTE = Object.fromEntries(NUEVOS.map((p) => [p, leer(p)]));
/** Lo que los archivos nuevos pueden pedir a cada vecino de ANTES (nombres que ya exportaban antes de esta entrega). */
const YA_EXISTIAN = {
  'assets/js/ui/odt-afinia/comun.js': ['h', 'mensajeDe', 'aviso', 'vaciar'],
  'assets/js/domain/odt_afinia_obs.js': ['TOPES_OBS', 'ESTADOS_OBS', 'ESTADOS_PUNTO', 'ETIQUETA_OBS', 'ETIQUETA_QUIEN', 'rastroOrdenado'],
  'assets/js/domain/odt_afinia_textos.js': ['ZONA_HORARIA', 'esFechaDMA', 'fechaBogota']
};
function importsDe(ruta, texto) {
  return [...codigo(texto).matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)].map((m) => [
    posix.normalize(posix.join(posix.dirname(ruta), m[2])),
    m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)
  ]);
}
function pedidosNuevos(ruta, texto) {
  const out = [];
  for (const [mod, nombres] of importsDe(ruta, texto)) {
    if (NUEVOS.includes(mod)) continue;
    const permitidos = YA_EXISTIAN[mod];
    if (!permitidos) { out.push('vecino no previsto: ' + mod); continue; }
    for (const n of nombres) if (!permitidos.includes(n)) out.push(n + ' a ' + mod);
  }
  return out;
}

describe('L-102: lo nuevo en archivos NUEVOS; a los vecinos de antes, solo lo que ya existía', () => {
  test('los archivos nuevos y sus pruebas existen; la cabecera dice que son nuevos a propósito', () => {
    for (const p of NUEVOS) {
      assert.ok(existsSync(resolve(RAIZ, p)), p);
      assert.match(FUENTE[p], /Archivo NUEVO a propósito \(L-102\)/, p);
    }
    for (const p of PRUEBAS) assert.ok(existsSync(resolve(RAIZ, p)), p);
  });
  test('ningún archivo nuevo le pide a un vecino de antes un nombre que no existía', () => {
    for (const [p, t] of Object.entries(FUENTE)) assert.deepEqual(pedidosNuevos(p, t), [], p);
    // Mutación (L-144): pedirle a comun.js un nombre nuevo SÍ se ve.
    assert.deepEqual(pedidosNuevos('assets/js/ui/odt-afinia/x.js', "import { h, entregarXlsx } from './comun.js';"), ['entregarXlsx a assets/js/ui/odt-afinia/comun.js']);
  });
  test('los nombres permitidos siguen existiendo en esos vecinos (control)', async () => {
    for (const [mod, nombres] of Object.entries(YA_EXISTIAN)) {
      if (mod.includes('/ui/')) {
        const t = codigo(leer(mod));
        for (const n of nombres) assert.match(t, new RegExp('export (const|function|async function) ' + n + '\\b'), mod + ' · ' + n);
        continue;
      }
      const m = await import('../' + mod);
      for (const n of nombres) assert.ok(n in m, mod + ' · ' + n);
    }
  });
  test('por-subsanar.js carga el bloque con import() (nunca estático), pregunta si trae lo que usa y, si no carga, sigue', () => {
    const p = codigo(leer('assets/js/ui/odt-afinia/por-subsanar.js'));
    assert.ok(!/^import[^;]*subsanar-excel/m.test(p), 'sin import estático');
    assert.match(p, /import\('\.\/subsanar-excel\.js'\)/);
    assert.match(p, /typeof m\.bloqueDescargaExcel === 'function' \? m : null/);
    assert.match(p, /\.catch\(\(\) => null\)/);
    assert.match(p, /zonaExcel\.appendChild\(mx\.bloqueDescargaExcel\(\{ repoObs \}\)\)/, 'con el repositorio de la sesión (lo que ella puede leer)');
    // Lo de antes no cambia: la lista y el contador siguen saliendo de las obs.
    assert.match(p, /export async function montarListaObs/);
  });
});

describe('el dominio es puro', () => {
  for (const p of NUEVOS.filter((x) => x.includes('/domain/'))) {
    test(p.split('/').pop() + ': sin Firebase, sin DOM, sin red, sin SheetJS; solo módulos hermanos', () => {
      const c = codigo(FUENTE[p]);
      assert.ok(!/firebasejs|gstatic|firebase-init|session-guard/.test(c), 'Firebase');
      assert.ok(!/\bdocument\.|\bwindow\.|localStorage|sessionStorage|\bfetch\(/.test(c), 'DOM / red');
      assert.ok(!/\bXLSX\.|xlsx@0|SheetJS/.test(c), 'SheetJS se usa en la pantalla');
      for (const [, esp] of c.matchAll(/from\s*'([^']+)'/g)) assert.match(esp, /^\.\/[a-z0-9_]+\.js$/, esp);
    });
  }
});

describe('la pantalla del Excel', () => {
  const ui = codigo(FUENTE['assets/js/ui/odt-afinia/subsanar-excel.js']);
  test('SheetJS 0.18.5 del CDN, con la SRI del archivo de node_modules y crossOrigin', () => {
    const version = JSON.parse(leer('node_modules/xlsx/package.json')).version;
    assert.equal(version, '0.18.5');
    assert.equal(JSON.parse(leer('package.json')).devDependencies.xlsx, '^0.18.5');
    assert.match(ui, /'https:\/\/cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js'/);
    const sri = 'sha384-' + createHash('sha384').update(readFileSync(resolve(RAIZ, 'node_modules/xlsx/dist/xlsx.full.min.js'))).digest('base64');
    assert.ok(ui.includes("export const SHEETJS_SRI = '" + sri + "';"), 'SRI == la del archivo publicado');
    assert.match(ui, /s\.integrity = SHEETJS_SRI; s\.crossOrigin = 'anonymous';/);
  });
  test('lo entrega XLSX.writeFile: sin enlaces a Blobs propios (L-107), sin innerHTML, sin esconder botones', () => {
    assert.match(ui, /XLSX\.writeFile\(wb, nombre, \{ bookType: 'xlsx', compression: true \}\)/);
    assert.ok(!/createObjectURL|entregarBlob|innerHTML|insertAdjacentHTML|outerHTML|window\.open/.test(ui));
    assert.ok(!/\.hidden\s*=/.test(ui), 'nada se esconde con hidden');
  });
  test('cada hoja: encabezado en la fila 1 (sin filas de título), filtro y rango desde A1 hasta la última celda, anchos', () => {
    assert.match(ui, /const ws = XLSX\.utils\.aoa_to_sheet\(hoja\.filas\);/);
    assert.match(ui, /encode_range\(\{ s: \{ r: 0, c: 0 \}, e: \{ r: Math\.max\(hoja\.filas\.length - 1, 0\), c: hoja\.columnas\.length - 1 \} \}\)/);
    assert.match(ui, /ws\['!autofilter'\] = \{ ref: rango \};/);
    assert.match(ui, /ws\['!cols'\] = hoja\.columnas\.map\(\(col\) => \(\{ wch: col\.ancho \}\)\);/);
    const dom = codigo(FUENTE['assets/js/domain/odt_afinia_obs_excel.js']);
    assert.match(dom, /filas: \[COLUMNAS_DETALLE\.map\(\(c\) => c\.titulo\), \.\.\.detalle\]/);
    assert.match(dom, /filas: \[COLUMNAS_RESUMEN\.map\(\(c\) => c\.titulo\), \.\.\.filasResumen\(elegidos\)\]/);
  });
  test('un error al leer no entrega un Excel a medias; el botón no se esconde y vuelve a quedar disponible', () => {
    const i = ui.indexOf('const registros = await leerRegistros('); const j = ui.indexOf('await entregar(XLSX, armarLibro(XLSX, hojas), nombre);');
    assert.ok(i > 0 && j > i, 'se entrega DESPUÉS de leer todas');
    assert.match(ui, /finally \{\s*ocupado = false; btn\.disabled = false; casilla\.disabled = false;/);
    // Si el botón tenía el foco (se pulsó con el teclado), lo recupera al terminar.
    assert.match(ui, /const teniaFoco = typeof document !== 'undefined' && document\.activeElement === btn;/);
    assert.match(ui, /if \(teniaFoco && typeof btn\.focus === 'function'\) \{ try \{ btn\.focus\(\{ preventScroll: true \}\); \}/);
    assert.match(ui, /casilla\.checked = false;/, 'la casilla nace desmarcada');
  });
  test('el CSS del bloque, con el prefijo .odt-', () => {
    const css = leer('assets/css/odt-afinia.css').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const s of ['.odt-obs-excel {', '.odt-obs-excel-opcion {']) assert.ok(css.includes(s), s);
  });
});

describe('repo público', () => {
  test('en el código nuevo: sin N.º de 8 dígitos, sin correos', () => {
    for (const [p, t] of Object.entries(FUENTE)) {
      assert.ok(!/(?<![0-9])[0-9]{8}(?![0-9])/.test(t), p + ': un número de 8 dígitos');
      assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(t), p + ': un correo');
    }
  });
  test('en las pruebas nuevas: solo N.º de ODT inventados (empiezan por 9) y correos de prueba', () => {
    for (const p of PRUEBAS) {
      const t = leer(p);
      for (const [n] of t.matchAll(/(?<![0-9A-Za-z])[0-9]{8}(?![0-9])/g)) assert.match(n, /^9/, p + ': N.º ' + n);
      for (const [c] of t.matchAll(/[a-z0-9.-]+@[a-z0-9-]+\.[a-z]{2,}/gi)) assert.match(c, /@prueba\.test$/, p + ': correo ' + c);
    }
  });
});
