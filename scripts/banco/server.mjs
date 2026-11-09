#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// Banco local CANÓNICO (auditoría N2 del 2026-11-08, K-7 / S0-03): sirve un checkout del sitio con las
// páginas REALES, sin guardián, y con Firebase y la sesión apuntando a simuladores en memoria
// (`scripts/banco/stubs/`). No se despliega (pages.yml publica solo su lista de permitidos) y NO trae
// datos: las semillas con datos del cliente viven FUERA del repo (la bóveda) y se pasan con --semillas.
// Antes cada banco era una copia suelta en un scratchpad que se borra (19 de 22 entradas de
// `.claude/launch.json` quedaron apuntando a la nada) y sus simuladores envejecían sin que nada lo viera:
// `tests/banco_canonico.test.js` exige que los simuladores exporten todo lo que el sitio importa.
// ──────────────────────────────────────────────────────────────
// Uso:  node scripts/banco/server.mjs [repo] [--puerto N] [--semillas CARPETA] [--semilla NOMBRE]…
//                                     [--ref REF] [--franja TEXTO]
//   repo        checkout a servir (por defecto, el de este archivo: sirve también desde un worktree)
//   --puerto    8140 por defecto (o PORT); 0 = uno libre
//   --semillas  carpeta con `semilla-<nombre>.js` (p. ej. un banco de la bóveda); sin ella no hay semillas
//   --semilla   semilla que entra en TODAS las páginas (se repite); `?semilla=a,b` añade en una página
//   --ref       lo publicado para /__antes/ y /__mezcla/ (por defecto origin/main)
//   --franja    texto de la franja roja que rotula cada página (L-135)
// Rutas: /pages/x.html (lo del checkout) · /__antes/pages/x.html (lo publicado, `git show REF:`) ·
//   /__mezcla/pages/x.html (HTML publicado con el JS del checkout, L-85) · /__banco/stubs/… · /__semillas/…
// En la página: ?semilla=a,b · ?rol=visitante (por defecto admin) · ?caida=<colección> (la tumba).
// Lo privado no sale (revisión de K-7, 2026-11-09): escucha SOLO en este computador (127.0.0.1, no en la red) y del
// checkout sirve solo lo que git rastrea o lo nuevo que no ignora; nunca una ruta con un tramo que empiece por punto
// (.git, .claude, .env…). Así no salen .git, .claude/settings.local.json ni los informes de cliente ignorados (Debug/…).
// ══════════════════════════════════════════════════════════════

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const PUERTO_POR_DEFECTO = 8140;
// Solo este computador: otro equipo de la misma red (wifi, oficina) no llega al banco.
export const HOST = '127.0.0.1';
// Las versiones de Firestore que el sitio importa del CDN (la prueba exige que estén todas).
export const VERSIONES_FIRESTORE = ['10.14.1', '10.7.1'];
export const FRANJA_POR_DEFECTO = 'VISTA PREVIA EN ESTE COMPUTADOR — no es la plataforma real: datos simulados; nada se guarda en la plataforma.';
const NOMBRE_SEMILLA = /^[a-z0-9][a-z0-9-]{0,60}$/;
const ROL = /^[a-z_]{3,20}$/;
const RUTA_GIT = /^[\w./-]+$/;
const GUARDIAN = /<script[^>]*src="[^"]*auth\/(page|admin)-guard\.js"[^>]*><\/script>/g;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

// JSON seguro dentro de un <script>: un «</script>» en un texto no cierra la etiqueta.
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Nombres de semilla válidos de una lista (o de «a,b»); los demás se ignoran. */
export function semillasValidas(lista) {
  const plana = [].concat(lista || []).flatMap((x) => String(x).split(','));
  return [...new Set(plana.map((x) => x.trim()).filter((x) => NOMBRE_SEMILLA.test(x)))];
}

/** El importmap que cambia Firestore, firebase-init y session-guard por los simuladores. */
export function mapaDeImportacion(pref = '') {
  const imports = {};
  for (const v of VERSIONES_FIRESTORE) imports[`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`] = '/__banco/stubs/firestore.js';
  imports[`${pref}/assets/js/firebase-init.js`] = '/__banco/stubs/init.js';
  imports[`${pref}/assets/js/auth/session-guard.js`] = '/__banco/stubs/session.js';
  return imports;
}

/** Prepara una página: quita el guardián e inyecta semillas, importmap, franja y sesión simulada. */
export function transformarHtml(html, o = {}) {
  const rol = ROL.test(o.rol || '') ? o.rol : 'admin';
  const sesion = { user: { uid: 'u-banco', email: 'banco@local' }, profile: { nombre: 'Ingeniero Sintetico', rol, activo: true }, role: rol };
  const franja = o.franja || FRANJA_POR_DEFECTO;
  const bloque = [
    ...semillasValidas(o.semillas).map((n) => `<script src="/__semillas/semilla-${n}.js"></script>`),
    o.caida ? `<script>window.__caida=${js(String(o.caida))};</script>` : '',
    `<script type="importmap">${js({ imports: mapaDeImportacion(o.pref || '') })}</script>`,
    '<style>#bancoFranja{position:fixed;z-index:99999;left:0;right:0;top:0;background:#b91c1c;color:#fff;font:700 14px/1.3 Inter,system-ui,sans-serif;text-align:center;padding:8px 12px;box-shadow:0 2px 10px rgba(0,0,0,.35)}body{padding-top:38px!important}</style>',
    '<script>(function(){var s=' + js(sesion) + ';window.__sgmSession=s;window.__sgmAdmin={uid:s.user.uid,email:s.user.email};' +
      'if(s.role===' + js('visitante') + ')document.documentElement.dataset.rol=s.role;' +
      'window.__confirmaciones=[];window.confirm=function(t){window.__confirmaciones.push(t);return true;};' +
      'document.addEventListener("DOMContentLoaded",function(){if(window.top===window){var d=document.createElement("div");d.id="bancoFranja";d.textContent=' + js(franja) + ';document.body.prepend(d);}' +
      // Como session-guard: el aviso va a window Y a document (hay páginas que escuchan en cada uno).
      'window.dispatchEvent(new CustomEvent("sgm:session-ready",{detail:s}));document.dispatchEvent(new CustomEvent("sgm:session-ready",{detail:s}));});})();</script>'
  ].filter(Boolean).join('\n');
  return String(html).replace(GUARDIAN, '').replace(/<head(\s[^>]*)?>/i, (m) => m + '\n' + bloque + '\n');
}

/** Ruta dentro de `base`, o null si se sale (también de una carpeta hermana con el mismo prefijo). */
export function dentroDe(base, rel) {
  const b = normalize(base);
  const p = normalize(join(b, rel));
  return p === b || p.startsWith(b.endsWith(sep) ? b : b + sep) ? p : null;
}

/** ¿Algún tramo de la ruta empieza por punto? (.git, .claude, .env, .gitignore…): el banco no los sirve. */
export const conPunto = (rel) => String(rel).split(/[\\/]/).some((s) => s.startsWith('.'));

/**
 * Lo que el banco puede servir del checkout: lo que git rastrea y lo nuevo que no ignora (`git ls-files --cached
 * --others --exclude-standard`). Lo ignorado (informes de cliente, Debug/, skills/) no sale. La lista se lee al primer
 * pedido; un archivo que aparece después se consulta a git cuando se pide (no hace falta reiniciar el banco). Sin git, o
 * con una ruta que git no acepta (p. ej. tras un enlace simbólico), no se sirve: falla cerrado.
 */
export function permitidosDelCheckout(repo) {
  const listar = (...ruta) => execFileSync('git', ['-C', repo, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...ruta],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\0').filter(Boolean).map((r) => r.normalize('NFC'));
  let vistos = null;
  return (rel) => {
    const r = String(rel).normalize('NFC');
    if (!r || conPunto(r)) return false;
    try {
      if (!vistos) vistos = new Set(listar());
      if (vistos.has(r)) return true;
      if (listar(':(literal)' + r).includes(r)) { vistos.add(r); return true; }
    } catch (_) { /* sin git o ruta que git no acepta: no se sirve */ }
    return false;
  };
}

/** Opciones de la línea de órdenes. */
export function leerArgumentos(argv, env = process.env) {
  const o = { repo: resolve(AQUI, '..', '..'), puerto: Number(env.PORT) || PUERTO_POR_DEFECTO, semillas: null, siempre: [], ref: 'origin/main', franja: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => { if (i + 1 >= argv.length) throw new Error('falta el valor de ' + a); return argv[++i]; };
    if (a === '--puerto') o.puerto = Number(valor());
    else if (a === '--semillas') o.semillas = resolve(valor());
    else if (a === '--semilla') o.siempre.push(valor());
    else if (a === '--ref') o.ref = valor();
    else if (a === '--franja') o.franja = valor();
    else if (a.startsWith('--')) throw new Error('opción desconocida: ' + a + ' (ver la cabecera de scripts/banco/server.mjs)');
    else o.repo = resolve(a);
  }
  if (!Number.isInteger(o.puerto) || o.puerto < 0 || o.puerto > 65535) throw new Error('puerto inválido: ' + o.puerto);
  return o;
}

/** El servidor (sin escuchar todavía). */
export function crearServidor(opciones) {
  const o = { ref: 'origin/main', siempre: [], ...opciones };
  const repo = resolve(o.repo);
  const permitido = permitidosDelCheckout(repo);
  const deGit = (archivo) => {
    if (!RUTA_GIT.test(archivo) || archivo.split('/').includes('..')) return null;
    try { return execFileSync('git', ['-C', repo, 'show', o.ref + ':' + archivo], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { return null; }
  };
  return http.createServer(async (req, res) => {
    const fin = (codigo, texto) => { res.writeHead(codigo, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end(texto); };
    try {
      const url = new URL(req.url, 'http://localhost');
      let ruta = decodeURIComponent(url.pathname);
      if (ruta.endsWith('/')) ruta += 'index.html';
      let datos = null;
      let pref = '';
      if (ruta.startsWith('/__antes/') || ruta.startsWith('/__mezcla/')) {
        const mezcla = ruta.startsWith('/__mezcla/');
        datos = deGit(ruta.slice(mezcla ? '/__mezcla/'.length : '/__antes/'.length));
        if (!datos) return fin(404, 'no está en ' + o.ref);
        // La mezcla: HTML publicado con el JS y el CSS del checkout (el caso L-85).
        if (mezcla) datos = Buffer.from(datos.toString('utf8').replace(/\.\.\/assets\//g, '/assets/'));
        else pref = '/__antes';
      } else if (ruta.startsWith('/__banco/stubs/')) {
        const f = dentroDe(join(AQUI, 'stubs'), ruta.slice('/__banco/stubs/'.length));
        if (!f) return fin(403, 'fuera del banco');
        datos = await readFile(f);
      } else if (ruta.startsWith('/__semillas/')) {
        const nombre = ruta.slice('/__semillas/'.length);
        if (!o.semillas) return fin(404, 'sin semillas: arranca con --semillas <carpeta fuera del repo>');
        if (!/^semilla-[a-z0-9][a-z0-9-]{0,60}\.js$/.test(nombre)) return fin(403, 'nombre de semilla inválido');
        datos = await readFile(join(o.semillas, nombre));
      } else {
        const f = dentroDe(repo, ruta.replace(/^\/+/, ''));
        if (!f) return fin(403, 'fuera del repositorio');
        const rel = relative(repo, f).split(sep).join('/');
        if (conPunto(rel)) return fin(403, 'el banco no sirve rutas que empiezan por punto (.git, .claude…)');
        if (!permitido(rel)) return fin(404, 'no encontrado (del checkout el banco sirve solo lo que git rastrea o lo nuevo que no ignora)');
        datos = await readFile(f);
      }
      const ext = extname(ruta).toLowerCase();
      if (ext === '.html' && !ruta.startsWith('/__banco/')) {
        datos = Buffer.from(transformarHtml(datos.toString('utf8'), {
          pref, franja: o.franja, rol: url.searchParams.get('rol'), caida: url.searchParams.get('caida'),
          semillas: o.semillas ? [...o.siempre, url.searchParams.get('semilla') || ''] : []
        }));
      }
      res.writeHead(200, { 'content-type': TIPOS[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(datos);
    } catch (_) { fin(404, 'no encontrado'); }
  });
}

// Se arranca solo si es el programa (con la ruta real: en macOS /var es un enlace a /private/var).
const esPrincipal = () => { try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1] || '')).href; } catch (_) { return false; } };
if (esPrincipal()) {
  let o;
  try { o = leerArgumentos(process.argv.slice(2)); } catch (e) { console.error('❌ banco: ' + e.message); process.exit(2); }
  const s = crearServidor(o);
  s.on('error', (e) => {
    console.error('❌ banco: no pude escuchar en el puerto ' + o.puerto + ' (' + e.code + '). ¿Otro banco abierto? Usa --puerto N o cierra el otro.');
    process.exit(1);
  });
  s.listen(o.puerto, HOST, () => {
    console.log('banco en http://' + HOST + ':' + s.address().port + '/index.html (solo este computador) · repo ' + o.repo + (o.semillas ? ' · semillas ' + o.semillas : ' · sin semillas'));
  });
}
