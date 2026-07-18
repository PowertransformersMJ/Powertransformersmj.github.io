#!/usr/bin/env node
// ===========================================================
// 🔒 boot-gate.mjs — candado del presupuesto de boot (TODO-28 #2)
// ===========================================================
// Comité 2026-07-18 (bóveda comite-futuro-cerebro): "advertir se ignoró
// 3 veces; bloquear funciona". Si los archivos always-on superan
// bootCharsTarget, el commit NO pasa (lo invoca githooks/pre-commit).
//
// Complementa al kernel: brain-check reporta el boot-budget como informativo;
// este candado lo hace BLOQUEANTE en el commit (invocado por githooks/pre-commit).
//
// Medición idéntica al kernel (brain-check.mjs líneas 123-126):
//   readFileSync(p, 'utf-8').length  (sin normalizar CRLF)
// ===========================================================
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'docs', '.brain-manifest.json'), 'utf-8'));
const TARGET = manifest.bootCharsTarget;
const ALWAYS_ON = manifest.alwaysOn || [];

if (!TARGET || !ALWAYS_ON.length) process.exit(0); // sin presupuesto declarado → gate no aplica

let bootChars = 0;
const detail = [];
for (const rel of ALWAYS_ON) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) continue;
  const chars = readFileSync(p, 'utf-8').length;
  bootChars += chars;
  detail.push(`   ${rel}: ${chars}c`);
}

if (bootChars > TARGET) {
  console.error(`\n🔒 BOOT-GATE: always-on = ${bootChars}c > objetivo ${TARGET}c (exceso ${bootChars - TARGET}c)`);
  console.error(detail.join('\n'));
  console.error('   Regla one-in-one-out (§G.5): toda regla nueva desplaza o fusiona una existente.');
  console.error('   PODA antes de commitear (o --no-verify SOLO si es intencional y documentado).');
  process.exit(1);
}
console.log(`🔒 boot-gate OK: ${bootChars}c ≤ ${TARGET}c (margen ${TARGET - bootChars}c)`);
process.exit(0);
