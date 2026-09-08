// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Ningún XLSX.read recibe un ArrayBuffer crudo
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
// `XLSX.read(x, { type: 'array' })` espera un Uint8Array. Si se le pasa
// el ArrayBuffer que devuelve `file.arrayBuffer()`, NO falla: parsea MAL
// y EN SILENCIO. Un libro de tres hojas sale como una sola hoja llamada
// «Sheet1» con cientos de filas de basura, y el reporte dice
// «Exitosos: 685 · Errores de parseo: 0» tan tranquilo.
//
// Comprobado en el navegador con el Excel real del parque (2026-09-08):
//   XLSX.read(buf,                {type:'array'}) → ['Sheet1']
//   XLSX.read(new Uint8Array(buf),{type:'array'}) → ['TX_Potencia', …]
//
// Era la razón por la que la importación del parque nunca funcionó, y
// estaba en LOS CUATRO sitios que leen Excel en el navegador: el import
// de admin, el del parque, «adjuntar listado» de Fichas Técnicas y la
// carga de indicadores de calidad.
//
// Este test es un gate estructural: relee los archivos y falla si alguien
// vuelve a pasar un buffer sin convertir. No prueba a SheetJS, prueba
// que nosotros lo llamamos bien.
// ══════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Sitios del repo que leen un Excel subido por el usuario. */
const ARCHIVOS = [
  'admin/importar.html',
  'pages/parque-transformadores.html',
  'assets/js/ui/fichas/evaluacion-masiva.js',
  'assets/js/ui/calidad/upload.js'
];

/** Toda llamada a XLSX.read(...) del archivo, sin comentarios. */
function llamadasRead(src) {
  const sinComentarios = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|<!--)/.test(l))
    .join('\n');
  return [...sinComentarios.matchAll(/(?:XLSX|LIBS\.xlsx)\.read\s*\(\s*([^,)]+)/g)]
    .map((m) => m[1].trim());
}

/** Variables que el propio archivo declara YA convertidas a Uint8Array. */
function variablesSeguras(src) {
  return new Set(
    [...src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new Uint8Array\(/g)]
      .map((m) => m[1])
  );
}

describe('XLSX.read — nunca con un ArrayBuffer crudo', () => {
  for (const f of ARCHIVOS) {
    test(`${f}: todo primer argumento es Uint8Array o texto`, () => {
      const src = readFileSync(f, 'utf8');
      const seguras = variablesSeguras(src);
      const args = llamadasRead(src);
      assert.ok(args.length > 0, `esperaba encontrar alguna llamada a XLSX.read en ${f}`);
      for (const a of args) {
        // Vale convertir en la llamada, o pasar una variable que el archivo ya
        // declaró como Uint8Array (convertir una vez y reusar es más limpio que
        // repetir la conversión en cada lectura).
        const ok = a.includes('Uint8Array') || seguras.has(a)
          || /^['"`]/.test(a) || /text|string|csv/i.test(a);
        assert.ok(ok,
          `${f}: XLSX.read(${a}, …) recibe un buffer sin convertir. ` +
          'Con type:"array" hay que pasar new Uint8Array(buf): el ArrayBuffer crudo ' +
          'parsea mal y en silencio.');
      }
    });
  }

  test('el buffer que alimenta la carga de calidad se convierte una sola vez', () => {
    const src = readFileSync('assets/js/ui/calidad/upload.js', 'utf8');
    assert.match(src, /const buf = new Uint8Array\(await file\.arrayBuffer\(\)\)/,
      'upload.js hace 4 lecturas del mismo buffer: se convierte al crearlo, no en cada una');
  });
});
