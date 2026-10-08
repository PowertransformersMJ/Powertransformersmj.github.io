// Freno al PUBLICAR (99 §150, M-10): a `main` no sube código que cite `99 §N` sin su ADR en el 99 de ese commit.
// Solo funciones puras (sin git): el caso real (776e31f habría frenado §146-§148) se comprobó a mano en el cierre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { citasDeAdr, encabezadosAdr, faltantes, commitsAMain, RUTAS_CODIGO } from '../scripts/freno-publicar.mjs';

test('citas: «99 §N», con decimales y entre comillas invertidas; no confunde otros §', () => {
  const c = citasDeAdr('// `99 §148` · ver 99 §52.8 y (99 §147.3) · §G.4 · 9 §12 · 199 §7');
  assert.deepEqual([...c].sort((a, b) => a - b), [52, 147, 148]);
});

test('encabezados: solo «## N.» al comienzo de línea', () => {
  const h = encabezadosAdr('## 146. ADR-146 — x\ntexto ## 147. no\n## 148. ADR-148\n### 149. no');
  assert.deepEqual([...h].sort((a, b) => a - b), [146, 148]);
});

test('faltantes: lo citado sin ADR, en orden', () => {
  assert.deepEqual(faltantes(new Set([148, 52, 146]), new Set([52, 146])), [148]);
  assert.deepEqual(faltantes(new Set([52]), new Set([52])), []);
});

test('commits a main del stdin de pre-push (ignora otras ramas y borrados)', () => {
  const stdin = 'refs/heads/x aaa111 refs/heads/main bbb222\n' +
    'refs/heads/y ccc333 refs/heads/DESARROLLO-/-PROYECTO-MJ ddd444\n' +
    '(delete) 0000000000000000000000000000000000000000 refs/heads/main eee555\n';
  assert.deepEqual(commitsAMain(stdin), ['aaa111']);
});

test('solo se mira el CÓDIGO publicado, no los docs del cerebro', () => {
  assert.ok(RUTAS_CODIGO.includes('assets') && RUTAS_CODIGO.includes('firestore.rules'));
  assert.ok(!RUTAS_CODIGO.some((r) => r.startsWith('docs')));
});

test('amarre: el pre-push llama al freno', () => {
  const hook = readFileSync(new URL('../githooks/pre-push', import.meta.url), 'utf8');
  assert.match(hook, /node scripts\/freno-publicar\.mjs --push/);
});
