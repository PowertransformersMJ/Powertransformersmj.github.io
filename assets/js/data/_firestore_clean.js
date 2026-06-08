// ══════════════════════════════════════════════════════════════
// HELPER · Deep-clean recursivo para payloads Firestore (re-export)
// ──────────────────────────────────────────────────────────────
// La implementación vive en domain/firestore_clean.js (también la usa
// la Cloud Function vía functions/domain). Este módulo la re-exporta
// para no romper a los importadores existentes del navegador.
// Ver CLAUDE.md §0.1.2.6 (regla permanente desde 2026-05-03).
// ══════════════════════════════════════════════════════════════
export { deepClean } from '../domain/firestore_clean.js';
