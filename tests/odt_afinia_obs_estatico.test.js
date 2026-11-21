// Firma de ODT Afinia · «POR SUBSANAR» · revisión ESTÁTICA (lo que una prueba de ejecución no ve):
//   · L-102: todo lo nuevo vive en archivos NUEVOS; a sus vecinos de antes (que pudieron quedar viejos en la caché del
//     navegador) solo les piden nombres que ya existían en la entrega anterior (bf893d9); app.js carga la pestaña con
//     import() y pregunta si trae lo que usa, y al repositorio de la firma solo se le pide `candidatos` preguntando antes;
//   · los pasos que se esconden son contenedores SIN `display` propio (o la caja .odt-confirmar): `hidden` los esconde de
//     verdad en el navegador; y el CSS hace que [hidden] le gane al display de .odt-btn (99 §232.9); el contador de
//     la pestaña se lee también en la pestaña activa; un lote «pendiente» (NO repita) no rehabilita su botón;
//   · la capa de datos nueva: lecturas que deciden, del servidor; sin Firebase estático; lotes con rutas de campo;
//   · sin innerHTML, sin correos ni N.º de 8 dígitos escritos (repo público); textos de cabecera al día.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, posix } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(RAIZ, p), 'utf8');
const codigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const NUEVOS = [
  'assets/js/domain/odt_afinia_obs.js',
  'assets/js/data/odt_afinia_obs_lotes.js',
  'assets/js/data/odt_afinia_obs.js',
  'assets/js/ui/odt-afinia/por-subsanar.js',
  'assets/js/ui/odt-afinia/subsanar-detalle.js',
  'assets/js/ui/odt-afinia/subsanar-registrar.js'
];
const FUENTE = Object.fromEntries(NUEVOS.map((p) => [p, leer(p)]));
/**
 * Lo que los archivos nuevos pueden pedir a cada vecino de ANTES: nombres que ya exportaban en la entrega anterior
 * (bf893d9, 2026-11-21). Un vecino viejo en la caché los tiene; cualquier otro nombre rompería la carga (L-102).
 */
const YA_EXISTIAN = {
  'assets/js/ui/odt-afinia/comun.js': ['h', 'vaciar', 'aviso', 'mensajeDe', 'fechaHora'],
  'assets/js/data/odt_afinia_lotes.js': ['ErrorOdt', 'MENSAJES', 'errorDesdeFirebase', 'sesionGlobal', 'esIdOdt', 'firmanteDesdeHabilitacion'],
  'assets/js/domain/odt_afinia_rutas.js': ['COL', 'CONFIG_FIRMANTES', 'esNro'],
  'assets/js/domain/odt_afinia_textos.js': ['esFechaDMA']
};
/** [ruta resuelta del módulo, [nombres]] de cada `import {…} from '…'` de un archivo. */
function importsDe(ruta, texto) {
  return [...codigo(texto).matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)].map((m) => [
    posix.normalize(posix.join(posix.dirname(ruta), m[2])),
    m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)
  ]);
}
/** Lo que un archivo nuevo pide a un vecino de antes y que NO estaba (vacío = bien). */
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
  test('los seis archivos existen y su cabecera dice que son nuevos a propósito', () => {
    for (const p of NUEVOS) {
      assert.ok(existsSync(resolve(RAIZ, p)), p);
      assert.match(FUENTE[p], /Archivo NUEVO a propósito \(L-102\)/, p);
    }
  });
  test('ningún archivo nuevo le pide a un vecino de antes un nombre que no existía', () => {
    for (const [p, t] of Object.entries(FUENTE)) assert.deepEqual(pedidosNuevos(p, t), [], p);
    // Mutación (L-144): pedirle a comun.js un nombre nuevo SÍ se ve.
    assert.deepEqual(pedidosNuevos('assets/js/ui/odt-afinia/x.js', "import { h, chipNuevo } from './comun.js';"), ['chipNuevo a assets/js/ui/odt-afinia/comun.js']);
    assert.deepEqual(pedidosNuevos('assets/js/ui/odt-afinia/x.js', "import { montarDetalle } from './detalle.js';"), ['vecino no previsto: assets/js/ui/odt-afinia/detalle.js']);
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
  test('app.js carga la pestaña con import() (nunca estático) y pregunta si trae lo que usa', () => {
    const app = codigo(leer('assets/js/ui/odt-afinia/app.js'));
    assert.ok(!/^import[^;]*(por-subsanar|subsanar-|odt_afinia_obs)/m.test(app), 'sin import estático de lo nuevo');
    assert.match(app, /import\('\.\/por-subsanar\.js'\)/);
    assert.match(app, /typeof m\.montarPorSubsanar === 'function' && typeof m\.crearRepositorioObs === 'function'/);
    assert.match(app, /\.catch\(\(\) => null\)/, 'si no carga, la firma sigue');
    assert.match(app, /MSG_SUBSANAR_NO_CARGO/);
    assert.match(app, /return \{ ir \};/);
  });
  test('al repositorio de la firma (que pudo quedar viejo) solo se le pide `candidatos`, preguntando antes', () => {
    const r = codigo(FUENTE['assets/js/ui/odt-afinia/subsanar-registrar.js']);
    assert.match(r, /typeof repoOdt\.candidatos !== 'function'/);
    assert.deepEqual([...new Set([...r.matchAll(/repoOdt\.(\w+)/g)].map((m) => m[1]))], ['candidatos']);
  });
});

describe('pasos escondidos de verdad (99 §232.9)', () => {
  const UI = ['assets/js/ui/odt-afinia/subsanar-detalle.js', 'assets/js/ui/odt-afinia/subsanar-registrar.js', 'assets/js/ui/odt-afinia/por-subsanar.js'];
  test('solo se esconden contenedores sin `display` propio (pasoUno, pasoDos, caja, pasoGuardar), nunca un botón', () => {
    for (const p of UI) {
      const c = codigo(FUENTE[p]);
      const escondidos = new Set([...c.matchAll(/(\w+(?:\.\w+)?)\.hidden\s*=/g)].map((m) => m[1]));
      for (const x of escondidos) assert.ok(['pasoUno', 'pasoDos', 'caja', 'x.caja', 'pasoGuardar'].includes(x), p + ': esconde ' + x);
    }
    const d = codigo(FUENTE['assets/js/ui/odt-afinia/subsanar-detalle.js']);
    assert.match(d, /const pasoUno = h\('div', \{\}, filaBotones\);/);
    assert.match(d, /const caja = h\('div', \{ class: 'odt-confirmar', role: 'group'/);
    assert.match(d, /const pasoDos = h\('div', \{ hidden: true \}, h\('div', \{ class: 'odt-acciones' \}, confirmar\)\);/);
    const r = codigo(FUENTE['assets/js/ui/odt-afinia/subsanar-registrar.js']);
    assert.match(r, /const pasoGuardar = h\('div', \{ hidden: true \}, h\('div', \{ class: 'odt-acciones' \}, btnGuardar\)\);/);
  });
  test('el CSS: [hidden] le gana a .odt-btn y la caja .odt-confirmar no fija display', () => {
    const css = leer('assets/css/odt-afinia.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(css, /\.odt-btn\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
    for (const m of css.matchAll(/([^{}]*\.odt-confirmar[^{}]*)\{([^}]*)\}/g)) assert.ok(!/display\s*:/.test(m[2]));
    for (const c of ['.odt-obs-puntos', '.odt-obs-punto', '.odt-chip--publicar', '.odt-chip--subsanado', '.odt-chip--verificado']) assert.ok(css.includes(c), c);
    // El contador de la pestaña: separado del texto y legible en la pestaña activa (que pone el texto en blanco).
    assert.match(css, /\.odt-nav-btn \.odt-cuenta\s*\{[^}]*margin-left:\s*6px;[^}]*color:/);
    assert.match(css, /\.odt-nav-btn\[aria-current="page"\] \.odt-cuenta\s*\{[^}]*background:\s*#fff;[^}]*color:\s*var\(--odt-marca/);
  });
  test('«NO repita»: ninguna escritura vuelve a habilitar su botón con un lote pendiente (seguirPendiente en cada una)', () => {
    const d = codigo(FUENTE['assets/js/ui/odt-afinia/subsanar-detalle.js']);
    const r = codigo(FUENTE['assets/js/ui/odt-afinia/subsanar-registrar.js']);
    assert.equal((d.match(/if \(seguirPendiente\(e, /g) || []).length, 3, 'cambiar punto, agregar punto y dar por resuelta');
    assert.equal((r.match(/if \(seguirPendiente\(e, /g) || []).length, 1, 'guardar el registro');
    for (const t of [d, r]) assert.equal((t.match(/repoObs\.(cambiarPunto|agregarPunto|resolver|registrar)\(/g) || []).length, (t.match(/if \(seguirPendiente\(e, /g) || []).length);
    // Mientras se guarda, el formulario no toca lo que se envía (copia de lo validado).
    assert.match(r, /const envio = listo;/);
    assert.match(r, /await repoObs\.registrar\(envio\)/);
    assert.ok(!/listo\.form|listo\.puntos\.length/.test(r.slice(r.indexOf('btnGuardar.addEventListener'))), 'después del await solo se usa la copia');
  });
  test('«Marcar subsanado» → nota → «Confirmar»; «Verificar» y «Devolver» con su confirmación; Devolver exige motivo', () => {
    const d = codigo(FUENTE['assets/js/ui/odt-afinia/subsanar-detalle.js']);
    assert.match(d, /boton: 'Marcar subsanado', confirmar: 'Confirmar'/);
    assert.match(d, /boton: 'Verificar', confirmar: 'Confirmar verificación'/);
    assert.match(d, /boton: 'Devolver', confirmar: 'Confirmar devolución'/);
    assert.match(d, /const err = errorNota\(accion, ta\.value\);\s*if \(err\) \{ st\.textContent = err; return; \}/, 'la nota se valida antes de escribir');
    assert.match(d, /if \(ocupado \|\| caja\.hidden\) return;/, 'un solo envío, y solo con la caja a la vista');
  });
});

describe('capa de datos nueva', () => {
  const repo = codigo(FUENTE['assets/js/data/odt_afinia_obs.js']);
  const lotes = codigo(FUENTE['assets/js/data/odt_afinia_obs_lotes.js']);
  test('las lecturas que deciden van al servidor; sin Firebase estático; el SDK del mismo CDN que la firma', () => {
    assert.match(repo, /getDocFromServer \|\| F\.getDoc/);
    assert.ok(!/F\.getDoc\(/.test(repo), 'ninguna lectura de caché directa');
    assert.ok(!/^import[^;]*gstatic/m.test(repo) && !/^import[^;]*gstatic/m.test(lotes));
    assert.match(repo, /firebasejs\/10\.14\.1\/firebase-firestore\.js/);
  });
  test('los cambios de punto van en UN lote atado (punto + resumen) y con rutas de campo («rastro.<rev>», «resumen.<k>»)', () => {
    assert.match(lotes, /\['rastro\.' \+ t\.rev\]: entrada/);
    assert.match(lotes, /\['resumen\.' \+ k\]: t\.estado, ultimo: k/);
    assert.match(lotes, /\['resumen\.' \+ k\]: ESTADOS_PUNTO\.PENDIENTE, ultimo: k/);
    assert.match(repo, /const plan = planCambioPunto\(\{ obs, punto, accion, nota, sesion: s, ts: F\.serverTimestamp\(\) \}\);\s*await escribir\(F, d, plan\.operaciones/);
  });
  test('«un N.º, una obs abierta»: se consulta el candado ANTES de escribir (la regla lo exige igual)', () => {
    const i = repo.indexOf('const previa = await leerPrevia(F, d, nro);');
    const j = repo.indexOf('const plan = planRegistro(');
    assert.ok(i > 0 && j > i);
    assert.match(repo, /if \(previa && !previa\.libre\) throw new ErrorOdt\('duplicado', MSG_NRO_ABIERTO\);/);
  });
});

describe('repo público y textos', () => {
  test('sin innerHTML, sin correos ni dominios reales y sin N.º de 8 dígitos en los archivos nuevos', () => {
    for (const [p, t] of Object.entries(FUENTE)) {
      assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(codigo(t)), p);
      assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(t), p + ': un correo');
      assert.ok(!/(?<![0-9])[0-9]{8}(?![0-9])/.test(t), p + ': un número de 8 dígitos');
    }
  });
  test('la página y el CSS dicen la verdad: la pestaña «Por subsanar» existe', () => {
    assert.match(leer('pages/firma-odt-afinia.html'), /«Por subsanar»/);
    assert.match(leer('assets/css/odt-afinia.css'), /Por subsanar/);
    assert.match(leer('assets/js/ui/odt-afinia/app.js'), /Pestaña «Por subsanar» \(decisión del Ingeniero del 2026-11-21\)/);
  });
});
