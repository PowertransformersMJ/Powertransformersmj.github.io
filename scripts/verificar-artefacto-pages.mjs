#!/usr/bin/env node
// Verifica un artefacto de GitHub Pages armado con LISTA DE PERMITIDOS: busca en cada HTML/JS/CSS/JSON del
// artefacto las referencias relativas (href, src, import, fetch, url(), new URL) y reporta las que existen en
// el repo pero NO en el artefacto (eso se rompería al publicar). Las que tampoco existen en el repo ya
// estaban rotas: se cuentan aparte. Imprime su cobertura (doctrina 7: un gate que da 0 puede mentir).
// Uso: node verificar-artefacto-pages.mjs <artefacto> <repo>
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, extname } from 'node:path';

const [art, repo] = process.argv.slice(2).map(p => resolve(p));
if (!art || !repo) { console.error('uso: verificar-artefacto-pages.mjs <artefacto> <repo>'); process.exit(2); }
const EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest']);
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); s.isDirectory() ? walk(p) : files.push(p); } })(art);
const RX = [
  /(?:href|src|action|poster)\s*=\s*["']([^"'#?]+)/g,
  /\bimport\s*(?:[^'"]*?\sfrom\s*)?["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  /\bfetch\(\s*["']([^"'#?]+)/g,
  /url\(\s*["']?([^"')#?]+)/g,
  /new URL\(\s*["']([^"']+)["']/g,
  /importScripts\(\s*["']([^"']+)["']/g,
  // rutas ARMADAS en tiempo de ejecución: se comprueba su CARPETA prefijo (fetch('../docs/pruebas/' + id) y `../x/${id}`)
  /\bfetch\(\s*["']([^"']+\/)["']\s*\+/g,
  /`((?:\.\.?\/)[^`$]*\/)\$\{/g,
];
// fetch() y las rutas armadas se resuelven contra la PÁGINA que carga el script, no contra el .js: se prueba
// cada carpeta que tenga un .html.
const BASES = [...new Set(files.filter(f => f.endsWith('.html')).map(f => dirname(f)))];
const DOC_REL = new Set([3, 7, 8]); // índices de RX que el navegador resuelve contra el documento
let refs = 0; const faltan = new Map(); const rotas = new Set();
for (const f of files) {
  if (!EXT.has(extname(f))) continue;
  const txt = readFileSync(f, 'utf8');
  for (const [i, rx] of RX.entries()) for (const m of txt.matchAll(rx)) {
    const r = m[1].trim();
    if (!r || /^(https?:|data:|mailto:|tel:|javascript:|blob:|\/\/|#|\$\{|\{)/.test(r) || r.includes('${')) continue;
    refs++;
    if (DOC_REL.has(i) && /\.m?js$/.test(f) && !r.startsWith('/')) {
      const cands = BASES.map(b => resolve(b, r)).filter(a => !relative(art, a).startsWith('..'));
      if (cands.some(a => existsSync(a))) continue;
      const enRepo = cands.find(a => existsSync(join(repo, relative(art, a))));
      if (enRepo) { const rel = relative(art, enRepo); if (!faltan.has(rel)) faltan.set(rel, relative(art, f)); }
      else rotas.add(r);
      continue;
    }
    const abs = r.startsWith('/') ? join(art, r) : resolve(dirname(f), r);
    const rel = relative(art, abs);
    if (rel.startsWith('..')) continue;
    if (existsSync(abs)) continue;
    const enRepo = join(repo, rel);
    if (existsSync(enRepo)) { if (!faltan.has(rel)) faltan.set(rel, relative(art, f)); }
    else rotas.add(rel);
  }
}
console.log(`cobertura: ${files.length} archivos en el artefacto, ${refs} referencias relativas revisadas`);
console.log(`rotas también en el repo (no las causa la lista): ${rotas.size}`);
if (faltan.size) {
  console.log(`❌ FALTAN en el artefacto ${faltan.size} rutas que el repo SÍ tiene:`);
  for (const [r, desde] of faltan) console.log(`  - ${r}   (citada desde ${desde})`);
  process.exit(1);
}
console.log('✅ el artefacto tiene todo lo que sus páginas citan y el repo tiene');
