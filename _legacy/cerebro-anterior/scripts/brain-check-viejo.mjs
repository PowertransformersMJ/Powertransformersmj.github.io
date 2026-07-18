#!/usr/bin/env node
// ===========================================================
// 🧠 brain-check — Linter de integridad del cerebro neuronal (portable)
// ===========================================================
// Mitiga la "fatiga de mantenimiento" del LLM (un script NO se vuelve perezoso).
// READ-ONLY: reporta problemas, no modifica nada. Lo corre el Reflejo de
// Auto-auditoría (CLAUDE.md §G.4) al arrancar Y antes de cerrar la sesión.
//
//   node scripts/brain-check.mjs    (o: npm run brain:check)
//
// Chequea:
//   (1) Neuronas huérfanas (cada docs/NN-*.md referenciada en CLAUDE.md,
//       excepto 41-49 que se registran en 40-LOBULOS-DOMINIO).
//   (2) Saturación de capacidad (§G.5).
//   (3) Desync 00-INDICE → 99-HISTORIAL (fragilidad del offset).
//   (4) Frescura OPCIONAL: cache SW (si el proyecto tiene service-worker.js
//       declarado en CLAUDE.md §4 y existe en raíz) + git origin (si hay remoto
//       y 05 declara un sha).
//   (5) Referencias cruzadas:
//       (5a) Cada "## NN." de 99 tiene fila "| §NN |" en 00.
//       (5b) Refs L-NN/M-NN usadas en el cerebro están definidas en 30.
//       (5c) Hojas docs/*.md referenciadas en CLAUDE.md existen.
//
// Diseño: los chequeos universales fallan. Los opcionales solo informan
// si no aplican (cero falsos positivos cuando el proyecto no tiene esa pieza).
// ===========================================================
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
let problems = 0;
const warn = (m) => { console.log('  ⚠️  ' + m); problems++; };
const ok = (m) => console.log('  ✅ ' + m);
const info = (m) => console.log('  ℹ️  ' + m);
const read = (p) => readFileSync(p, 'utf-8');

console.log('\n🧠 BRAIN-CHECK — integridad del cerebro neuronal\n');

// Pre-flight: las piezas críticas existen.
const CLAUDE_PATH = join(ROOT, 'CLAUDE.md');
if (!existsSync(CLAUDE_PATH)) {
  console.log('  ⚠️  CLAUDE.md no existe en la raíz — ¿estás corriendo el linter desde el directorio correcto?');
  process.exit(1);
}
if (!existsSync(DOCS)) {
  console.log('  ⚠️  docs/ no existe — el cerebro no está cableado.');
  process.exit(1);
}

// Topes §G.5 (auto-cargadas en rojo)
const CAPS = {
  'CLAUDE.md': 320,
  'docs/05-ESTADO-GLOBAL.md': 25,
  'docs/10-MEMORIA-CORTO-PLAZO.md': 110,
  'docs/20-MEMORIA-ESPACIAL.md': 280,
  'docs/30-LECCIONES.md': 350,
  'docs/00-INDICE.md': 450,
  'docs/40-LOBULOS-DOMINIO.md': 280,
};

const claude = read(CLAUDE_PATH);

// Registry de lóbulos de dominio: los lóbulos hijos (41-49) NO viven en
// CLAUDE.md §0 — se registran en 40-LOBULOS-DOMINIO.md. Leerlo para no
// marcarlos huérfanos.
const lobeRegistryPath = join(DOCS, '40-LOBULOS-DOMINIO.md');
const lobeRegistry = existsSync(lobeRegistryPath) ? read(lobeRegistryPath) : '';

// 1) Neuronas huérfanas: toda docs/NN-*.md debe estar referenciada en CLAUDE.md
//    (excepto lóbulos hijos 41-50, que se registran en 40-LOBULOS-DOMINIO).
console.log('1) Neuronas huérfanas (registradas en CLAUDE.md / 40-LOBULOS):');
const neurons = readdirSync(DOCS).filter((f) => /^\d{2}-.*\.md$/.test(f));
for (const n of neurons) {
  const isChildLobe = /^(4[1-9]|50)-/.test(n); // 41..50 = lóbulos de dominio hijos
  if (claude.includes(n)) ok(`${n}`);
  else if (isChildLobe && lobeRegistry.includes(n)) ok(`${n} (lóbulo hijo → 40-LOBULOS-DOMINIO)`);
  else if (isChildLobe) warn(`${n} lóbulo hijo NO registrado en 40-LOBULOS-DOMINIO`);
  else warn(`${n} NO referenciada en CLAUDE.md → HUÉRFANA (conectar en §0)`);
}

// 2) Capacidad (§G.5)
console.log('\n2) Capacidad de neuronas (§G.5):');
for (const [rel, cap] of Object.entries(CAPS)) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { warn(`${rel} no existe`); continue; }
  const lines = read(p).split('\n').length;
  if (lines > Math.round(cap * 1.1)) warn(`${rel}: ${lines} líneas (tope ~${cap}) → SHARD/poda`);
  else if (lines > cap) console.log(`  ↗  ${rel}: ${lines} (tope ~${cap}, leve exceso)`);
  else ok(`${rel}: ${lines}/${cap}`);
}

// 3) Desync del índice: cada "| §X | tema | N |" debe apuntar a un header "## " del historial
console.log('\n3) Desync índice 00-INDICE → 99-HISTORIAL (fragilidad offset):');
const indicePath = join(DOCS, '00-INDICE.md');
const histPath = join(DOCS, '99-HISTORIAL-ADR.md');
if (existsSync(indicePath) && existsSync(histPath)) {
  const indice = read(indicePath).split('\n');
  const hist = read(histPath).split('\n');
  let checked = 0, desync = 0;
  for (const row of indice) {
    const m = row.match(/^\|\s*§([\w.]+)\s*\|.*\|\s*(\d+)\s*\|\s*$/);
    if (!m) continue;
    const sec = m[1], ln = parseInt(m[2], 10);
    const target = hist[ln - 1] || '';
    checked++;
    if (!/^##\s/.test(target)) { warn(`§${sec} → línea ${ln} NO es un header (desync)`); desync++; }
    else if (/^\d+$/.test(sec.split('.')[0]) && !new RegExp(`^##\\s+${sec.split('.')[0]}[.\\s]`).test(target)) {
      warn(`§${sec} → línea ${ln} apunta a OTRO § ("${target.replace(/^##\s*/, '').slice(0, 28)}…") → offset drift`); desync++;
    }
  }
  if (!checked) info('índice vacío (sin ADRs todavía) — chequeo omitido');
  else if (!desync) ok(`${checked} entradas del índice apuntan a headers válidos`);
} else {
  info('00-INDICE.md o 99-HISTORIAL-ADR.md no existe — chequeo omitido');
}

// 4) Frescura OPCIONAL: solo aplica si el proyecto declara service-worker en §4 + el archivo existe
console.log('\n4) Frescura (docs ↔ realidad de archivos/git) — OPCIONAL:');

// 4a) Service-worker bump (solo si declara §4 en CLAUDE.md Y existe service-worker.js)
const hasSwSection = /##\s*§4\s*—\s*Cache bump/i.test(claude);
const swPath = join(ROOT, 'service-worker.js');
if (hasSwSection && existsSync(swPath)) {
  const swVer = (read(swPath).match(/CACHE_VERSION\s*=\s*'v?(\d{14})'/) || [])[1];
  // Permitimos que el archivo cliente con APP_VERSION viva en distintas rutas: buscar el primer match.
  // Si el proyecto sigue la convención Altorra, vive en js/core/cache-manager.js.
  const candidates = [
    'js/core/cache-manager.js',
    'src/cache-manager.js',
    'src/lib/cache-manager.js',
  ];
  let cmVer = null, cmPath = null;
  for (const c of candidates) {
    const p = join(ROOT, c);
    if (existsSync(p)) {
      const v = (read(p).match(/APP_VERSION\s*=\s*'v?(\d{14})'/) || [])[1];
      if (v) { cmVer = v; cmPath = c; break; }
    }
  }
  if (swVer && cmVer) {
    if (swVer === cmVer) ok(`cache SW == ${cmPath} (v${swVer})`);
    else warn(`cache DESYNC: SW=v${swVer} ≠ ${cmPath}=v${cmVer} → bumpear AMBOS (§4)`);
  } else if (swVer && !cmVer) {
    info(`SW tiene CACHE_VERSION=v${swVer} pero no encontré APP_VERSION en ${candidates.join(' | ')}`);
  } else {
    info('no pude parsear CACHE_VERSION/APP_VERSION (¿cambió el formato?)');
  }

  // 4b) 05-ESTADO-GLOBAL "Cache version vigente" == SW real
  const estadoPath = join(DOCS, '05-ESTADO-GLOBAL.md');
  if (existsSync(estadoPath)) {
    const estado = read(estadoPath);
    const vigLine = estado.split('\n').find((l) => /Cache version vigente|Versión.*Cache/i.test(l)) || '';
    const vig = (vigLine.match(/v(\d{14})/) || [])[1];
    if (swVer && vig) {
      if (vig === swVer) ok(`05 cache vigente == SW (v${swVer})`);
      else warn(`05 STALE: declara cache vigente v${vig} pero SW=v${swVer} → actualizar 05`);
    } else if (swVer && !vig) {
      info('05 no declara una "Cache version vigente vYYYYMMDDHHMMSS" parseable');
    }
  }
} else {
  info('proyecto sin service-worker.js (o sin §4 en CLAUDE.md) — chequeos de cache omitidos');
}

// 4c) origin/main vs git real (SOFT: solo informativo; no hay remoto en proyectos nuevos)
try {
  const realMain = execSync('git rev-parse --short origin/main 2>/dev/null || git rev-parse --short origin/master 2>/dev/null', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], shell: true }).toString().trim();
  const estadoPath = join(DOCS, '05-ESTADO-GLOBAL.md');
  if (realMain && existsSync(estadoPath)) {
    const estado = read(estadoPath);
    // Match el patrón de asignación "origin/main = <sha>" en cualquier parte de 05.
    const claimed = (estado.match(/origin\/(?:main|master)`?\s*=\s*\*{0,2}`?([0-9a-f]{7,40})/) || [])[1];
    if (claimed) {
      if (realMain.startsWith(claimed) || claimed.startsWith(realMain)) ok(`05 origin == git (${realMain})`);
      else info(`05 dice origin=${claimed} pero git=${realMain} → verificar (¿05 stale o ref local sin fetch?)`);
    } else {
      info('05 sin sha de origin parseable (check omitido)');
    }
  } else if (!realMain) {
    info('origin/main no disponible (sin remoto/fetch o repo sin git) — chequeo omitido');
  }
} catch {
  info('git no disponible o repo sin remoto — chequeo omitido');
}

// 5) Integridad de referencias cruzadas — huecos ocultos en TODO el cerebro
console.log('\n5) Referencias cruzadas (huecos en el cerebro):');

// 5a) Todo ADR "## NN." de 99 debe tener fila "| §NN |" en 00-INDICE
if (existsSync(histPath) && existsSync(indicePath)) {
  const histText = read(histPath);
  const indiceText = read(indicePath);
  const adrNums = new Set([...histText.matchAll(/^##\s+(\d+)\./gm)].map((m) => m[1]));
  const idxNums = new Set([...indiceText.matchAll(/^\|\s*§(\d+)\b/gm)].map((m) => m[1]));
  const missingIdx = [...adrNums].filter((n) => !idxNums.has(n)).sort((a, b) => +a - +b);
  if (!adrNums.size) info('aún no hay ADRs "## NN." en 99 — cerebro recién instalado');
  else if (!missingIdx.length) ok(`${adrNums.size} ADRs de 99 indexados en 00`);
  else warn(`${missingIdx.length} ADR(s) de 99 SIN fila en 00-INDICE: §${missingIdx.join(', §')}`);
}

// 5b) Referencias L-/M- en todo el cerebro deben estar definidas (### L-NN/M-NN) en 30
const leccionesPath = join(DOCS, '30-LECCIONES.md');
if (existsSync(leccionesPath)) {
  const leccionesText = read(leccionesPath);
  const cortoPath = join(DOCS, '10-MEMORIA-CORTO-PLAZO.md');
  const espacialPath = join(DOCS, '20-MEMORIA-ESPACIAL.md');
  const estadoPath = join(DOCS, '05-ESTADO-GLOBAL.md');
  const histText = existsSync(histPath) ? read(histPath) : '';
  const indiceText = existsSync(indicePath) ? read(indicePath) : '';
  const defined = new Set([...leccionesText.matchAll(/^###\s+([LM]-\d{2})\b/gm)].map((m) => m[1]));
  const allBrain = [
    claude, indiceText,
    existsSync(estadoPath) ? read(estadoPath) : '',
    leccionesText, histText,
    existsSync(cortoPath) ? read(cortoPath) : '',
    existsSync(espacialPath) ? read(espacialPath) : '',
  ].join('\n');
  const referenced = new Set([...allBrain.matchAll(/\b([LM]-\d{2})\b/g)].map((m) => m[1]));
  const dangling = [...referenced].filter((r) => !defined.has(r)).sort();
  if (!referenced.size) info('aún no hay refs L-NN/M-NN en el cerebro');
  else if (!dangling.length) ok(`refs L-/M- (${referenced.size} usadas / ${defined.size} def) todas resuelven en 30`);
  else warn(`refs L-/M- COLGANTES (sin def en 30): ${dangling.join(', ')} → definir o corregir`);
}

// 5c) Hojas docs/*.md enlazadas con ruta `docs/...` en CLAUDE.md (curado) deben existir.
//     (Escanear las demás neuronas daría falsos positivos por ejemplos en prosa,
//      p.ej. "shard a docs/31-LECCIONES-GIT.md" — el chequeo 6 cubre lo inverso.)
const docFiles = readdirSync(DOCS).filter((f) => f.endsWith('.md'));
const docTexts = Object.fromEntries(docFiles.map((f) => [f, read(join(DOCS, f))]));
const refDocs = new Set([...claude.matchAll(/docs\/([\w-]+\.md)/g)].map((m) => m[1]));
const PLACEHOLDER = /^NN-|NOMBRE|<tema>|<carpeta>/; // plantillas de neurogénesis, no archivos reales
const missingDocs = [...refDocs].filter((f) => !PLACEHOLDER.test(f) && !existsSync(join(DOCS, f)));
if (!missingDocs.length) ok(`hojas docs/*.md referenciadas en CLAUDE.md (${refDocs.size}) existen`);
else warn(`hojas referenciadas en CLAUDE.md INEXISTENTES: ${missingDocs.join(', ')}`);

// 6) Huérfanos INVERSOS: toda docs/*.md debe estar enlazada desde alguna otra neurona
//    (las core viven en CLAUDE.md §0 → chequeo 1; las hojas de detalle cuelgan de su
//    neurona madre, p.ej. 20-ESPACIAL). Atrapa "hoja existe pero nadie la conoce".
console.log('\n6) Hojas huérfanas (existen en disco pero nadie las enlaza):');
const CORE_NEURONS = new Set([
  '00-INDICE.md', '05-ESTADO-GLOBAL.md', '10-MEMORIA-CORTO-PLAZO.md', '15-CONSEJO-EXTERNO.md',
  '20-MEMORIA-ESPACIAL.md', '30-LECCIONES.md', '40-LOBULOS-DOMINIO.md', '99-HISTORIAL-ADR.md',
]);
let orphanSheets = 0;
for (const f of docFiles) {
  if (CORE_NEURONS.has(f) || /^4[1-9]-/.test(f)) continue; // core → §0; lóbulos → chequeo 1
  const mentioned = claude.includes(f) || docFiles.some((g) => g !== f && docTexts[g].includes(f));
  if (!mentioned) { warn(`${f} HUÉRFANA → enlazar desde su neurona madre (p.ej. 20-ESPACIAL)`); orphanSheets++; }
}
if (!orphanSheets) ok(`cero hojas huérfanas (${docFiles.length - CORE_NEURONS.size} hojas de detalle, todas enlazadas)`);

console.log(`\n${problems === 0 ? '✅ CEREBRO SANO' : '⚠️  ' + problems + ' problema(s) — revisar antes de avanzar'}\n`);
process.exit(problems ? 1 : 0);
