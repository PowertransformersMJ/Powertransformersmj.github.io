// Firma de ODT Afinia · revisión ESTÁTICA (lo que el texto de los módulos promete):
//   · P1: ningún archivo odt_afinia* (ni ui/odt-afinia/*) importa, directa o indirectamente,
//     nada que case con /firmas?_(equipo|delegad)|delegaciones_/ (higiene; la garantía es la regla
//     por uid más la reautenticación);
//   · el dominio es PURO: sin Firebase, sin DOM, sin importar pdf-lib (llega inyectado);
//   · el pdf-lib vendorizado es byte a byte el de node_modules y su SHA-256 está fijada;
//   · repo público: ni un .pdf de la ODT en el repo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';
import { PDF_LIB } from '../assets/js/domain/odt_afinia_rutas.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(RAIZ, 'assets', 'js');
const PROHIBIDO = /firmas?_(equipo|delegad)|delegaciones_/;
/** El código sin comentarios (no confundir lo que se explica con lo que se ejecuta). */
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function archivos(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (n.endsWith('.js')) out.push(p);
  }
  return out;
}
/** Especificadores importados: estáticos, re-exportados y dinámicos con texto literal. */
function importados(texto) {
  const c = codigo(texto);
  return [
    ...[...c.matchAll(/^\s*(?:import|export)\s[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...c.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...c.matchAll(/import\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1])
  ];
}

const MODULO = archivos(JS).filter((p) => /(^|\/)odt_afinia[^/]*\.js$/.test(p) || /\/ui\/odt-afinia\//.test(p));
const DOMINIO = MODULO.filter((p) => p.includes('/domain/'));
// 'cierre' (2026-11-21): compositor @2, reemplazo y CERRADA; archivo nuevo (L-102), también puro.
const ESPERADOS = ['rutas', 'estados', 'formato', 'zonas', 'casilla', 'componer', 'partes', 'textos', 'cierre'].map((n) => 'odt_afinia_' + n + '.js');

describe('archivos del dominio', () => {
  test('existen los módulos del diseño (§4) y el de cierre (2026-11-21)', () => {
    const nombres = DOMINIO.map((p) => p.split('/').pop()).sort();
    for (const n of ESPERADOS) assert.ok(nombres.includes(n), n);
  });
});

describe('P1: nada de firmas del equipo ni delegadas, en todo el árbol de importaciones', () => {
  test('ni directo ni transitivo', () => {
    assert.ok(MODULO.length >= ESPERADOS.length);
    const vistos = new Set(); const cola = [...MODULO]; const rotos = [];
    while (cola.length) {
      const f = cola.shift();
      if (vistos.has(f)) continue;
      vistos.add(f);
      for (const esp of importados(readFileSync(f, 'utf8'))) {
        assert.ok(!PROHIBIDO.test(esp), relative(RAIZ, f) + ' importa ' + esp);
        if (esp.startsWith('.')) {
          const destino = resolve(dirname(f), esp);
          if (existsSync(destino)) { if (destino.startsWith(JS)) cola.push(destino); } else rotos.push(relative(RAIZ, f) + ' → ' + esp);
        }
      }
    }
    assert.deepEqual(rotos, [], 'importaciones relativas que no existen');
    for (const f of vistos) assert.ok(!PROHIBIDO.test(relative(JS, f)), 'llega a ' + relative(RAIZ, f));
  });
  test('la prueba ve una importación prohibida (mutación)', () => {
    assert.ok(importados("import { x } from '../data/firmas_equipo.js';").some((e) => PROHIBIDO.test(e)));
    assert.ok(importados("const m = await import('./delegaciones_firmas.js');").some((e) => PROHIBIDO.test(e)));
    assert.ok(importados("export { y } from './fichas_firmas_delegadas.js';").some((e) => PROHIBIDO.test(e)));
    assert.ok(!importados("// import { x } from './firmas_equipo.js';").length);
  });
});

describe('el dominio es puro', () => {
  for (const nombre of ESPERADOS) {
    test(nombre + ': sin Firebase, sin DOM, sin red y sin importar pdf-lib', () => {
      const c = codigo(readFileSync(join(JS, 'domain', nombre), 'utf8'));
      assert.ok(!/firebasejs|gstatic|firebase-init|session-guard/.test(c), 'Firebase');
      assert.ok(!/\bdocument\.|\bwindow\.|localStorage|sessionStorage|\bfetch\(/.test(c), 'DOM / red');
      assert.ok(!/pdf-lib|vendor\/|pdfjs/.test(importados(c).join(' ')), 'pdf-lib o pdf.js llegan inyectados');
      for (const esp of importados(c)) assert.match(esp, /^\.\/[a-z0-9_]+\.js$/, 'solo módulos hermanos del dominio: ' + esp);
    });
  }
});

describe('pdf-lib vendorizado', () => {
  const vendor = readFileSync(join(RAIZ, PDF_LIB.ruta));
  test('SHA-256 fijada', () => {
    assert.equal(PDF_LIB.version, '1.17.1');
    assert.equal(createHash('sha256').update(vendor).digest('hex'), PDF_LIB.sha256);
  });
  test('es byte a byte el de node_modules (pdf-lib@1.17.1, dist/pdf-lib.esm.min.js)', () => {
    const npm = join(RAIZ, 'node_modules', 'pdf-lib');
    assert.equal(JSON.parse(readFileSync(join(npm, 'package.json'), 'utf8')).version, PDF_LIB.version);
    const dist = readFileSync(join(npm, 'dist', 'pdf-lib.esm.min.js'));
    assert.equal(createHash('sha256').update(dist).digest('hex'), createHash('sha256').update(vendor).digest('hex'));
  });
  test('fijado exacto en devDependencies', () => {
    const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    assert.equal(pkg.devDependencies['pdf-lib'], PDF_LIB.version);
  });
  test('no trae importaciones externas (se carga solo en el navegador)', () => {
    assert.ok(!/(^|[;}\s])import\s*[{*"']/.test(vendor.toString('utf8').slice(0, 200000)));
  });
});

describe('repo público: ningún PDF de la ODT', () => {
  test('las pruebas y el dominio no leen ni escriben archivos .pdf', () => {
    const yo = fileURLToPath(import.meta.url);
    const pruebas = readdirSync(join(RAIZ, 'tests')).filter((n) => n.startsWith('odt_afinia')).map((n) => join(RAIZ, 'tests', n)).filter((p) => p !== yo);
    for (const f of [...pruebas, ...DOMINIO]) {
      const c = codigo(readFileSync(f, 'utf8'));
      assert.ok(!/['"`][^'"`\n]*\.pdf['"`]/i.test(c.replace(/_firmada\.pdf/g, '')), relative(RAIZ, f) + ' nombra un archivo PDF');
    }
  });
});
