// Flujo «Guardia de datos» (K-16, resto de K-7; revisión adversarial del 2026-11-09): la guardia SCADA y la de cero
// cerebro corren también en las ramas que ci.yml no mira (ordenes/*, mapa/*, fichas/*, informe-brigada…), en las
// etiquetas y en los PR a otras bases. Se lee el YAML de los flujos sin dependencias (un lector mínimo para el
// subconjunto que usan: mapas, listas y bloques «|»; cotejado con el YAML de Ruby sobre ci.yml, pages.yml y este) y
// se comprueba lo esencial: disparadores (complemento EXACTO de ci.yml), comandos, permisos, historia y concurrencia.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rangoDeEvento } from '../scripts/guardia-scada.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLUJOS = join(RAIZ, '.github', 'workflows');
const CEROS = '0'.repeat(40);

/** Quita el comentario « #…» de un valor (fuera de comillas). */
function sinComentario(s) {
  const t = s.trim();
  const q = t.match(/^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*")/);
  return q ? q[1] : t.replace(/(^|\s)#.*$/, '').trim();
}

/** Un valor suelto: sin comillas, sin comentario; vacío o «~» → null; «[a, b]» → lista. Todo lo demás, texto. */
function escalar(v) {
  const s = sinComentario(v);
  if (s.startsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('"')) return JSON.parse(s);
  if (s === '' || s === '~' || s === 'null') return null;
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(',').map(escalar).filter((x) => x !== null);
  return s;
}

/** Lector mínimo del YAML de los flujos de GitHub: mapas, listas (también de mapas) y bloques «|» / «>». */
function leerYaml(texto) {
  const L = String(texto).replace(/\r/g, '').split('\n');
  const sangria = (l) => l.length - l.trimStart().length;
  const util = (i) => { while (i < L.length && /^\s*(#.*)?$/.test(L[i])) i++; return i; };
  const guion = (l) => /^\s*-(\s|$)/.test(l);
  const CLAVE = /^("[^"]*"|'[^']*'|[^\s:#'"-][^:#]*?|-[^\s:#][^:#]*?)\s*:(?:\s+(.*))?$/;
  function nodo(i) {
    i = util(i);
    return guion(L[i]) ? lista(i, sangria(L[i])) : mapa(i, sangria(L[i]));
  }
  // Las líneas más sangradas que la clave, tal cual (sin quitar comentarios: en un «run: |» son del shell).
  function literal(i, ind) {
    const lineas = [];
    let j = i + 1;
    while (j < L.length && (L[j].trim() === '' || sangria(L[j]) > ind)) lineas.push(L[j++]);
    while (lineas.length && lineas[lineas.length - 1].trim() === '') lineas.pop();
    const base = Math.min(...lineas.filter((l) => l.trim()).map(sangria));
    return [lineas.map((l) => l.slice(base)).join('\n') + '\n', j];
  }
  function valor(resto, i, ind) {
    const r = sinComentario(resto || '');
    if (/^[|>][+-]?$/.test(r)) return literal(i, ind);
    if (r !== '') return [escalar(r), i + 1];
    const j = util(i + 1);
    if (j < L.length && (sangria(L[j]) > ind || (sangria(L[j]) === ind && guion(L[j])))) return nodo(j);
    return [null, i + 1];
  }
  function mapa(i, ind) {
    const m = {};
    while ((i = util(i)) < L.length && sangria(L[i]) === ind && !guion(L[i])) {
      const k = L[i].trim().match(CLAVE);
      assert.ok(k, 'no entiendo la línea ' + (i + 1) + ' del YAML: ' + L[i].trim());
      [m[escalar(k[1])], i] = valor(k[2], i, ind);
    }
    return [m, i];
  }
  function lista(i, ind) {
    const a = [];
    while ((i = util(i)) < L.length && sangria(L[i]) === ind && guion(L[i])) {
      const resto = L[i].trimStart().slice(1);
      let v;
      if (resto.trim() === '') [v, i] = valor('', i, ind);
      else if (CLAVE.test(resto.trim()) && !/^['"[]/.test(resto.trim())) {
        L[i] = ' '.repeat(ind) + ' ' + resto;              // «- clave: v» es un mapa: el guion pasa a ser sangría
        [v, i] = mapa(i, sangria(L[i]));
      } else [v, i] = [escalar(resto), i + 1];
      a.push(v);
    }
    return [a, i];
  }
  const [raiz, fin] = nodo(0);
  assert.equal(util(fin), L.length, 'el YAML no se leyó entero: me detuve en la línea ' + (fin + 1));
  return raiz;
}

const flujo = (nombre) => leerYaml(readFileSync(join(FLUJOS, nombre), 'utf8'));

/** Patrón de rama de GitHub → RegExp («**»: cualquier cosa; «*»: todo menos «/»). Solo esos comodines. */
function patron(p) {
  assert.doesNotMatch(p, /[?+[\]!]/, 'el patrón «' + p + '» usa comodines que esta prueba no sabe leer');
  const literal = (x) => x.replace(/[.^${}()|\\]/g, '\\$&');
  return new RegExp('^' + p.split('**').map((t) => t.split('*').map(literal).join('[^/]*')).join('.*') + '$');
}
const casa = (lista, rama) => lista.some((p) => patron(p).test(rama));

describe('guardia-datos.yml (K-16): las guardias de datos en TODAS las ramas, sin la bóveda', () => {
  // Se lee dentro de cada prueba: si falta el flujo, cada una sale en rojo con su nombre (no solo la suite).
  const leer = () => {
    const datos = flujo('guardia-datos.yml');
    const jobs = Object.values(datos.jobs || {});
    const pasos = jobs.flatMap((j) => j.steps || []);
    return { datos, ci: flujo('ci.yml'), jobs, pasos, runs: pasos.map((p) => p.run || '').join('\n') };
  };

  test('el lector (control): comentarios, comillas, listas de mapas, bloques «|» y claves vacías', () => {
    const muestra = ['# comentario', 'name: Prueba · lector', 'on:', '  push:', '    branches:', '      - main',
      "      - 'rama/**'   # comentario: con dos puntos", '  workflow_dispatch:', 'jobs:', '  uno:',
      '    runs-on: ubuntu-latest   # al final', '    steps:', '      - name: Paso', '        with:', '          fetch-depth: 0',
      '      - run: |', '          # del shell, no del YAML', '          echo "a: b"', '', '          echo fin',
      '    lista:', '    - x', '    vacio:', ''].join('\n');
    assert.deepEqual(leerYaml(muestra), {
      name: 'Prueba · lector',
      on: { push: { branches: ['main', 'rama/**'] }, workflow_dispatch: null },
      jobs: { uno: { 'runs-on': 'ubuntu-latest', steps: [{ name: 'Paso', with: { 'fetch-depth': '0' } },
        { run: '# del shell, no del YAML\necho "a: b"\n\necho fin\n' }], lista: ['x'], vacio: null } },
    });
    assert.throws(() => leerYaml('a: 1\n  b: 2\n'), /no se leyó entero/);
    // Y los flujos reales se leen: ci.yml trae sus ramas (con un comentario al final de una) y pages.yml las que publican.
    const ci = flujo('ci.yml');
    assert.ok(Array.isArray(ci.on.push.branches) && ci.on.push.branches.includes('main'), 'ci.yml: on.push.branches');
    assert.ok(Array.isArray(ci.on.pull_request.branches) && ci.on.pull_request.branches.includes('main'), 'ci.yml: on.pull_request.branches');
    assert.ok(flujo('pages.yml').on.push.branches.includes('main'));
  });

  test('disparadores: push y pull_request, el complemento EXACTO de ci.yml (sin huecos ni dobles)', () => {
    const { datos, ci } = leer();
    assert.deepEqual(Object.keys(datos.on).sort(), ['pull_request', 'push']);
    assert.equal(datos.on.push.branches, undefined, 'un «branches» en push dejaría fuera ramas nuevas');
    assert.deepEqual([...datos.on.push['branches-ignore']].sort(), [...ci.on.push.branches].sort(),
      'push: las ramas que se ignoran aquí deben ser EXACTAMENTE las de ci.yml (on.push.branches)');
    assert.deepEqual(datos.on.push.tags, ['**'], 'con solo branches-ignore GitHub no correría en las etiquetas');
    assert.equal(datos.on.pull_request.branches, undefined);
    assert.deepEqual([...datos.on.pull_request['branches-ignore']].sort(), [...ci.on.pull_request.branches].sort(),
      'pull_request: las bases que se ignoran aquí deben ser EXACTAMENTE las de ci.yml (on.pull_request.branches)');
    // Cada rama la mira UN flujo: las de hoy en GitHub, las de la revisión y algunas al borde de los patrones.
    for (const rama of ['main', 'master', 'claude/x', 'claude/a/b', 'DESARROLLO-/-PROYECTO-MJ', 'ordenes/zona-y-entregas',
      'mapa/boton-mapa', 'fichas/cf-38-reemplazo-con-funcion', 'informe-brigada', 'sinmed-paso2', 'claude', 'mainx', 'x/main']) {
      const enCi = casa(ci.on.push.branches, rama);
      const aqui = !casa(datos.on.push['branches-ignore'], rama);
      assert.ok(enCi !== aqui, rama + ': ' + (enCi ? 'la miran los dos flujos' : 'no la mira ninguno'));
    }
    assert.ok(!casa(ci.on.push.branches, 'ordenes/zona-y-entregas'), 'la rama de la revisión debe quedar para este flujo');
  });

  test('comandos: las dos guardias de la rama principal (--ci y --arbol); sin npm, sin la suite, sin la bóveda', () => {
    const { jobs, pasos, runs } = leer();
    assert.equal(jobs.length, 1, 'un solo job');
    assert.match(runs, /^node "\$GUARDIAS\/guardia-scada\.mjs" --ci$/m);
    assert.match(runs, /^node "\$GUARDIAS\/guardia-cero-cerebro\.mjs" --arbol$/m);
    // Las guardias salen de origin/<principal>, no de la rama: una rama vieja no las trae o no conoce «--ci».
    const toma = pasos.find((p) => /git show "origin\//.test(p.run || ''));
    assert.ok(toma, 'falta el paso que toma las guardias de la rama principal');
    assert.equal(toma.id, 'guardias');
    assert.equal(toma.env && toma.env.PRINCIPAL, '${{ github.event.repository.default_branch }}');
    assert.match(toma.run, /for g in guardia-scada guardia-cero-cerebro; do/);
    assert.match(toma.run, /git show "origin\/\$\{PRINCIPAL:-main\}:scripts\/\$g\.mjs" > "\$D\/\$g\.mjs"/);
    assert.match(toma.run, /\|\| \{ echo .*; exit 1; \}/, 'sin la guardia de main el paso debe fallar CERRADO');
    assert.match(toma.run, /D="\$\(realpath "\$RUNNER_TEMP"\)\//, 'por un enlace guardia-scada sale 0 sin revisar');
    assert.doesNotMatch(runs, /node\s+"?(\.\/)?scripts\//, 'no se corre la copia de la rama');
    assert.doesNotMatch(runs, /\bnpm\b|\bnpx\b|node --test|brain-private|boveda/);
    const nodo = pasos.find((p) => /^actions\/setup-node@/.test(p.uses || ''));
    assert.ok(nodo, 'falta actions/setup-node');
    assert.equal(nodo.with['node-version'], '20');
    assert.equal(nodo.with.cache, undefined, 'sin npm ci no hay caché que guardar');
    // La guardia de main entiende esos modos.
    assert.match(readFileSync(join(RAIZ, 'scripts', 'guardia-scada.mjs'), 'utf8'), /argv\.includes\('--ci'\)/);
    assert.match(readFileSync(join(RAIZ, 'scripts', 'guardia-cero-cerebro.mjs'), 'utf8'), /argv\.includes\('--arbol'\)/);
  });

  test('permisos: solo contents: read; checkout con TODA la historia y sin dejar la credencial; corrida corta', () => {
    const { datos, jobs, pasos } = leer();
    assert.deepEqual(datos.permissions, { contents: 'read' });
    for (const j of jobs) assert.ok(j.permissions === undefined, 'un job no debe pedir más permisos');
    const co = pasos.filter((p) => /^actions\/checkout@/.test(p.uses || ''));
    assert.equal(co.length, 1);
    assert.equal(co[0].with['fetch-depth'], '0', 'sin la historia no hay origin/main ni commit anterior');
    assert.equal(co[0].with['persist-credentials'], 'false');
    for (const j of jobs) {
      const min = Number(j['timeout-minutes']);
      assert.ok(min > 0 && min <= 10, 'timeout-minutes corto (≤ 10): ' + j['timeout-minutes']);
    }
  });

  test('concurrencia: ninguna corrida se cancela ni se descarta (cada push con su veredicto)', () => {
    const c = leer().datos.concurrency || {};
    assert.equal(c['cancel-in-progress'], 'false');
    // Con un grupo compartido GitHub cancela la que espera turno aunque cancel-in-progress sea false.
    assert.match(String(c.group), /\$\{\{ github\.run_id \}\}/);
  });

  test('una rama fuera de ci.yml, una etiqueta o un PR a otra base: el rango no depende de corridas anteriores', () => {
    const ev = (ref, before) => ({ ref, before, after: 'c'.repeat(40), repository: { default_branch: 'main' } });
    for (const [ref, before] of [['refs/heads/ordenes/x', 'b'.repeat(40)], ['refs/heads/mapa/y', CEROS], ['refs/tags/v9', CEROS]]) {
      assert.deepEqual(rangoDeEvento('push', ev(ref, before)).revList, ['c'.repeat(40), '--not', 'origin/main'], ref);
    }
    const pr = { pull_request: { base: { sha: 'a'.repeat(40), ref: 'ordenes/x' }, head: { sha: 'd'.repeat(40) } } };
    assert.deepEqual(rangoDeEvento('pull_request', pr).alterno, ['d'.repeat(40), '--not', 'origin/ordenes/x']);
  });
});
