#!/usr/bin/env node
/**
 * session-handoff.mjs — Caja negra anti-saturación (TODO-28 #1, comité §33).
 * Escribe la foto REAL de la sesión (git, no promesas) a docs/.handoff-auto.md para que
 * el próximo operador arranque con datos aunque esta sesión muera sin consolidar (mata M-01).
 *
 * Modos:
 *   --end        SessionEnd/Stop: escribe la foto en silencio (exit 0 siempre — jamás bloquear).
 *   --precompact PreCompact: escribe la foto Y emite JSON con la ORDEN de consolidar docs/10 AHORA.
 *   --boot-echo  SessionStart: si la foto existe y es fresca (<48h), la imprime (entra al contexto).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', '.handoff-auto.md');
const mode = process.argv[2] || '--end';

const git = (args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return '(git no disponible)'; }
};

try {
  if (mode === '--boot-echo') {
    if (existsSync(OUT)) {
      const ageH = (Date.now() - statSync(OUT).mtimeMs) / 3.6e6;
      if (ageH < 48) {
        console.log(`🕹️ HANDOFF AUTOMÁTICO de la sesión anterior (hace ${ageH.toFixed(1)}h — datos de git, no promesas):\n`);
        console.log(readFileSync(OUT, 'utf8'));
      }
    }
    process.exit(0);
  }

  const foto = [
    `# 🕹️ Handoff automático (escrito por hook, no por Claude) — ${new Date().toISOString()}`,
    `> Foto REAL de git al cierre/compactación. Si contradice a docs/10, ESTA es la verdad (M-01).`,
    ``,
    `- Branch: ${git(['branch', '--show-current'])} · HEAD: ${git(['log', '-1', '--format=%h · %s'])}`,
    `- Sucios sin commit: ${git(['status', '--porcelain']) || '(limpio)'}`,
    ``,
    `## Últimos commits (24h)`,
    git(['log', '--since=24hours', '--format=- %h %s']) || '- (ninguno)',
  ].join('\n');
  writeFileSync(OUT, foto, 'utf8');

  if (mode === '--precompact') {
    console.log(JSON.stringify({
      systemMessage: '🧠 PreCompact: foto de sesión escrita en docs/.handoff-auto.md',
      hookSpecificOutput: {
        hookEventName: 'PreCompact',
        additionalContext: 'ORDEN DEL CEREBRO (hook PreCompact, TODO-28 #1): el contexto está por compactarse. ANTES de seguir con la tarea, consolida el estado vivo AHORA en docs/10-MEMORIA-CORTO-PLAZO.md (foco, avances no documentados, callejones) y si cambió la salud, docs/05. La foto real de git quedó en docs/.handoff-auto.md.',
      },
    }));
  }
  process.exit(0);
} catch {
  process.exit(0); // jamás bloquear la sesión por el hook
}
