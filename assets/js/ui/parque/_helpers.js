// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Parque · helpers del lado UI
// ══════════════════════════════════════════════════════════════

import { BUCKET_NULL } from '../../domain/parque_salud_config.js';

export const $ = (sel, root = document) => root.querySelector(sel);

// Resuelve una CSS var del :root (con fallback gris si no existe)
export function cssVar(name) {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') return '#888';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

// Color del semáforo por calificación 1..5
export function califColor(c) {
  return cssVar('--h' + Math.min(5, Math.max(1, Math.round(c))));
}

// Color de un bucket (resuelve cssVar en runtime cuando hay DOM)
export function bucketColor(bucket) {
  if (!bucket) return BUCKET_NULL.color;
  if (bucket.cssVar) {
    const c = cssVar(bucket.cssVar);
    if (c) return c;
  }
  return bucket.color || BUCKET_NULL.color;
}
