#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// Auditoría de COMPLETITUD de los bloques del tablero de Pruebas Eléctricas.
// ──────────────────────────────────────────────────────────────
// Dado el JSON que produce la IA (extraerPruebasElectricasIA — el de la pestaña
// "Interpretación cruda" del panel admin, o un dump de `[IA-DIAG] bloques_raw`),
// reporta por bloque qué magnitudes capturó (series · extra · tabla) y FLAGEA las
// secciones con la inconsistencia típica: una curva por TAP que sólo trae el
// valor graficado y PIERDE las columnas secundarias del informe (Potencia,
// tensión aplicada, relación teórica, %DIF, R.Referencia, etc.).
//
// NO impone layout: el tablero es DINÁMICO — la IA organiza cada informe a su
// criterio. Esto sólo cuida que no se pierdan datos del informe. Las "columnas
// típicas" son PISTAS para recordar qué buscar en el PDF, no un molde obligatorio.
//
// Uso:  node scripts/audit-bloques-pruebas.mjs <ruta-al-json>
//   El JSON puede ser {mediciones:{bloques}}, {bloques} o el arreglo de bloques.
//
// Workflow completo: docs/workflow-auditoria-secciones-pruebas.md
// ══════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';

// Columnas secundarias TÍPICAS por familia (HINTS, no obligatorias — manda el
// informe; cada laboratorio varía). Recordatorio de qué confirmar en el PDF.
const HINTS = {
  excitacion:  ['Potencia (W) por fase', 'Desviación %', 'Evaluación'],
  relacion:    ['Tensión aplicada', 'Relación teórica', '%DIF por fase', 'Evaluación'],
  resistencia: ['R.Referencia (corregida)', 'Desviación %', 'Evaluación'],
  tand:        ['Capacitancia', 'Tan δ a cada tensión', 'Modo', 'Evaluación'],
  bushing:     ['Cap. placa', 'Cap. medida', 'Tan δ placa/medida', 'Evaluación'],
  aislamiento: ['Tensión', 'R 1 min', 'DAR', 'IP', 'Evaluación']
};

const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function familia(prueba) {
  const p = norm(prueba);
  if (p.includes('excit')) return 'excitacion';
  if (p.includes('relac')) return 'relacion';
  if (p.includes('aisl')) return 'aislamiento';
  if (p.includes('resist')) return 'resistencia';
  if (p.includes('tan')) return 'tand';
  if (p.includes('bush') || p.includes('buje')) return 'bushing';
  return null;
}

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node scripts/audit-bloques-pruebas.mjs <ruta-al-json>');
  process.exit(1);
}

let raw;
try { raw = JSON.parse(readFileSync(ruta, 'utf8')); }
catch (e) { console.error(`No se pudo leer/parsear el JSON: ${e.message}`); process.exit(1); }

const bloques = Array.isArray(raw) ? raw
  : raw.bloques ? raw.bloques
  : (raw.mediciones && raw.mediciones.bloques) ? raw.mediciones.bloques
  : (raw.bloques_raw) ? raw.bloques_raw
  : [];

if (!bloques.length) { console.error('No se hallaron bloques en el JSON.'); process.exit(1); }

let flags = 0;
console.log(`\nAUDITORÍA DE COMPLETITUD — ${bloques.length} bloques\n${'='.repeat(64)}`);

for (const b of bloques) {
  const fam = familia(b.prueba);
  const series = b.series || [];
  const extraKeys = new Set();
  let nPuntos = 0;
  for (const s of series) for (const p of (s.puntos || [])) {
    nPuntos++;
    if (p && p.extra) for (const k of Object.keys(p.extra)) extraKeys.add(k);
  }
  const tablaCols = (b.tabla && b.tabla.columnas) ? b.tabla.columnas.length : 0;
  const esCurva = (b.grafica || 'linea') !== 'barra';
  const multiFase = series.length >= 2;

  console.log(`\n▸ ${b.titulo || '(sin título)'}`);
  console.log(`  prueba=${b.prueba} · gráfica=${b.grafica} · series=${series.length} · puntos=${nPuntos}`);
  console.log(`  extra=${extraKeys.size ? [...extraKeys].join(', ') : '—'} · tabla.columnas=${tablaCols}`);
  if (fam) console.log(`  columnas típicas (${fam}): ${HINTS[fam].join(' · ')}`);

  const issues = [];
  if (esCurva && multiFase && !extraKeys.size) {
    issues.push('curva por TAP SIN `extra` → revisa el informe: ¿la tabla trae más columnas por fila (Potencia/tensión/R.Ref/%DIF)? Si sí, deben ir en extra.');
  }
  if (!esCurva && !tablaCols) {
    issues.push('barra SIN `tabla` de detalle → ¿el informe trae una tabla para esta prueba? Si sí, transcríbela completa.');
  }
  if (issues.length) { flags += issues.length; for (const i of issues) console.log(`  ⚠️  ${i}`); }
  else console.log('  ✅ sin banderas');
}

console.log(`\n${'='.repeat(64)}`);
console.log(flags
  ? `⚠️  ${flags} bandera(s) — secciones con posible pérdida de datos. Corregir vía workflow.`
  : '✅ Sin banderas de completitud.');
console.log('');
process.exit(flags ? 2 : 0);
