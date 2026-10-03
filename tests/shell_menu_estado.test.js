// Clases de estado del <body> (`99 §135`, L-121 punto 3): el ☰ del celular estuvo mes y medio sin código —existían el
// botón y el CSS de `body.sb-open`, pero ningún JS ponía la clase—. Toda clase `body.<x>` que use el CSS debe ACTIVARSE en
// algún lado: con `classList.add/toggle('<x>')` en `assets/js/**` o en el atributo `class` de algún `<body>` del HTML.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function archivos(dir, ext) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p, ext));
    else if (n.endsWith(ext)) out.push(p);
  }
  return out;
}

const css = archivos(join(raiz, 'assets', 'css'), '.css').map((p) => readFileSync(p, 'utf8')).join('\n');
const js = archivos(join(raiz, 'assets', 'js'), '.js').map((p) => readFileSync(p, 'utf8')).join('\n');
const html = ['.', 'pages', 'admin']
  .flatMap((d) => readdirSync(join(raiz, d)).filter((n) => n.endsWith('.html')).map((n) => join(raiz, d, n)))
  .map((p) => readFileSync(p, 'utf8')).join('\n');

const clasesBody = [...new Set([...css.matchAll(/body\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
const clasesDeBodyHtml = new Set([...html.matchAll(/<body\b[^>]*\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)));
const seActivaEnJs = (c) => new RegExp(`classList\\.(?:add|toggle)\\(\\s*['"\`]${c}['"\`]`).test(js);

describe('clases de estado del <body>', () => {
  test('el CSS usa al menos la del menú (sb-open), la de AQUA y la de admin', () => {
    for (const c of ['sb-open', 'aqua', 'is-admin']) assert.ok(clasesBody.includes(c), c);
  });
  test('toda clase body.<x> del CSS se activa en un JS o en el <body> de alguna página', () => {
    const muertas = clasesBody.filter((c) => !seActivaEnJs(c) && !clasesDeBodyHtml.has(c));
    assert.deepEqual(muertas, [], 'clases de estado que nadie pone: ' + muertas.join(', '));
  });
  test('el ☰ abre y cierra el cajón: aqua-shell.js pone y quita sb-open', () => {
    const shell = readFileSync(join(raiz, 'assets', 'js', 'aqua-shell.js'), 'utf8');
    assert.match(shell, /classList\.add\(\s*'sb-open'\s*\)/);
    assert.match(shell, /classList\.remove\(\s*'sb-open'\s*\)/);
  });
});
