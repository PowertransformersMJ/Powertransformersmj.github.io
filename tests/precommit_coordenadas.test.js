// L-140: la posición real de una S/E nunca entra al repo PÚBLICO. La guardia vive en el kernel (bóveda,
// verify-secretos ≥ 1.16.0, probada allí con su sonda) y solo muerde si el pre-commit del sitio le pasa
// `--coordenadas`: esta prueba vigila ese cableado (en CI no hay bóveda, así que no corre el kernel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hook = readFileSync(join(RAIZ, 'githooks', 'pre-commit'), 'utf8');

test('el pre-commit corre el escáner del kernel con --staged --coordenadas y bloquea si falla', () => {
  const llamadas = hook.split('\n').filter((l) => /^node "\$K" /.test(l));
  assert.equal(llamadas.length, 1, 'una sola llamada al escáner: ' + JSON.stringify(llamadas));
  assert.match(llamadas[0], /^node "\$K" --staged --coordenadas \|\| \{[^}]*exit 1; \}$/);
  assert.match(llamadas[0], /posición de una S\/E/);
});
