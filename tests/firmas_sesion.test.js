// Órdenes de Entrada/Salida (IT.05801): la firma de la sesión no salía en «AUTORIZADO POR»
// porque el perfil del Ingeniero es «ING. MIGUEL JIMENEZ» y la línea dice «MIGUEL JIMENEZ»
// (2026-09-28). La línea se reconoce por la lista CERRADA de nombres de la misma persona;
// para nadie más se afloja la comparación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lineaDeLaSesion } from '../assets/js/domain/firmas_sesion.js';

test('el perfil «ING. MIGUEL JIMENEZ» firma la línea «MIGUEL JIMENEZ» (y «MIGUEL A. JIMENEZ»)', () => {
  assert.equal(lineaDeLaSesion('MIGUEL JIMENEZ', 'ING. MIGUEL JIMENEZ'), true);
  assert.equal(lineaDeLaSesion('MIGUEL A. JIMENEZ', 'ING. MIGUEL JIMENEZ'), true);
  assert.equal(lineaDeLaSesion('Miguel  Jiménez', 'MIGUEL JIMENEZ'), true);
  assert.equal(lineaDeLaSesion('Miguel Jimenez', 'Ing. Miguel Jiménez'), true);
});

test('nunca firma la línea de OTRA persona', () => {
  for (const linea of ['CARLOS MARTELO', 'JUAN CARDONA', 'JORGE RHENALS', 'GERARDO RAMIREZ', 'JORGE MIRANDA']) {
    assert.equal(lineaDeLaSesion(linea, 'ING. MIGUEL JIMENEZ'), false, linea);
  }
  assert.equal(lineaDeLaSesion('MIGUEL JIMENEZ', 'CARLOS MARTELO'), false);
});

test('no afloja la comparación para quien no está en la lista (ni títulos ni apellidos de más)', () => {
  assert.equal(lineaDeLaSesion('CARLOS MARTELO', 'ING. CARLOS MARTELO'), false);
  assert.equal(lineaDeLaSesion('MIGUEL JIMENEZ', 'MIGUEL JIMENEZ PEREZ'), false);
  assert.equal(lineaDeLaSesion('JORGE MIRANDA', 'JORGE RHENALS'), false);
  assert.equal(lineaDeLaSesion('CARLOS MARTELO', 'CARLOS MARTELO'), true);   // el igual exacto sigue valiendo
});

test('sin nombre no hay firma', () => {
  assert.equal(lineaDeLaSesion('', 'ING. MIGUEL JIMENEZ'), false);
  assert.equal(lineaDeLaSesion('MIGUEL JIMENEZ', ''), false);
  assert.equal(lineaDeLaSesion(null, undefined), false);
});

test('Órdenes usa esta regla en la línea de firma y en el aviso de la pantalla (no la comparación exacta)', () => {
  const src = readFileSync(new URL('../assets/js/ordenes-materiales.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ lineaDeLaSesion \} from '\.\/domain\/firmas_sesion\.js';/);
  assert.equal((src.match(/lineaDeLaSesion\(/g) || []).length, 2);
  assert.doesNotMatch(src, /firmaAplicaA\(/);
  assert.match(src, /autorizadoPor: \{ nombre: 'MIGUEL JIMENEZ'/);
});

test('el informe de refrigeración usa la misma regla (su línea «Miguel Jimenez» y el perfil «ING. MIGUEL JIMENEZ»)', () => {
  const src = readFileSync(new URL('../assets/js/calculo-refrigeracion.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ lineaDeLaSesion \} from '\.\/domain\/firmas_sesion\.js';/);
  assert.doesNotMatch(src, /firmaAplicaA\(/);
  assert.match(src, /firmaHTMLDe\('Miguel Jimenez'\)/);
  assert.equal(lineaDeLaSesion('Miguel Jimenez', 'ING. MIGUEL JIMENEZ'), true);
});
