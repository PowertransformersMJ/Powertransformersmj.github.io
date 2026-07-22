// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · DATA LAYER
// ──────────────────────────────────────────────────────────────
// Hidrata el dataset del dashboard combinando 3 fuentes:
//   1. SEED (baseline JSON servido por GitHub Pages)
//   2. Eventos acumulados localmente (IndexedDB / localStorage)
//   3. Realtime Firestore (colección `scada_eventos`) cuando
//      esté configurada y poblada.
//
// API:
//   - cargarBaselineLocal()              → Promise<{meta, events}>
//   - suscribirEventosSCADA(onData, ...) → unsubscribe (Firestore)
//   - mergeAllEvents(seed, extra)        → eventos deduplicados
// ══════════════════════════════════════════════════════════════

import { isFirebaseConfigured } from '../firebase-config.js';
import { getDbSafe } from '../firebase-init.js';
import {
  collection, query, orderBy, limit, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const BASELINE_URL = new URL('../../data/seguimiento-scada-baseline.json', import.meta.url).href;

// G018 (ADR-052 Ola 4): tope de eventos por suscripción. El SOE puede escribir
// ~11k eventos/día; sin límite, UNA visita leería toda la colección y podría
// agotar la cuota Spark (50k lecturas/día). Cap a los N más recientes.
const MAX_EVENTOS_SCADA = 5000;

let _baselineCache = null;

/**
 * Carga el SEED desde el JSON servido. Cachea en memoria.
 * Estructura del JSON:
 *   { meta: {...}, events: [{id, ts, date, sid, sub, asset, kv, zona,
 *                            u, param, uom, m, l, v, vp, viol}, ...] }
 */
export async function cargarBaselineLocal() {
  if (_baselineCache) return _baselineCache;
  const res = await fetch(BASELINE_URL, { cache: 'force-cache' });
  if (!res.ok) throw new Error('Baseline SCADA no disponible (HTTP ' + res.status + ')');
  _baselineCache = await res.json();
  return _baselineCache;
}

/**
 * Fusiona SEED + extra deduplicando por event_id. El SEED se mantiene
 * "como está" (puede tener ids repetidos por colisiones MD5 en
 * eventos genuinamente distintos del SOE → no se deduplica contra
 * sí mismo para preservar el conteo original). Solo el extra se
 * deduplica internamente y contra los ids del SEED.
 */
export function mergeAllEvents(seedEvents, extraEvents) {
  const seedIds = new Set();
  for (const e of seedEvents) seedIds.add(e.id);
  const out = seedEvents.slice();
  const extraIds = new Set();
  for (const e of extraEvents) {
    if (seedIds.has(e.id))  continue;
    if (extraIds.has(e.id)) continue;
    extraIds.add(e.id);
    out.push(e);
  }
  return out;
}

// ── Realtime Firestore ────────────────────────────────────────
function firestoreListo() {
  return isFirebaseConfigured && !!getDbSafe();
}

/**
 * Adapter Firestore → shape plano del dashboard.
 * El doc v2 esperado en `/scada_eventos/{id}` tiene el mismo
 * shape que el SEED (Python lo escribe en upsert al ingerir cada
 * archivo SOE diario en Cloud Functions, F32).
 */
function docToEvent(doc) {
  return { id: doc.id, ...doc };
}

/**
 * Suscribe a la colección scada_eventos. Si Firestore no está
 * configurado, hace fallback inmediato al baseline local y deja
 * onData ejecutarse una sola vez.
 *
 * Devuelve un unsubscribe que cancela la suscripción real.
 */
export function suscribirEventosSCADA(onData, onError) {
  let unsubFirestore = null;
  let resuelto = false;

  // Boot inmediato: baseline local
  cargarBaselineLocal()
    .then(({ meta, events }) => {
      if (!resuelto) onData({ source: 'baseline', meta, events });
    })
    .catch(err => {
      console.warn('[scada] baseline no disponible:', err);
      if (!resuelto) onData({ source: 'empty', meta: null, events: [] });
    });

  if (firestoreListo()) {
    try {
      const db = getDbSafe();
      const ref = collection(db, 'scada_eventos');
      const q = query(ref, orderBy('ts', 'desc'), limit(MAX_EVENTOS_SCADA));
      unsubFirestore = onSnapshot(
        q,
        (snap) => {
          const events = snap.docs.map(d => docToEvent({ id: d.id, ...d.data() }));
          if (events.length === 0) {
            resuelto = true;
            return;
          }
          resuelto = true;
          onData({ source: 'firestore', meta: null, events });
        },
        (err) => {
          console.warn('[scada] onSnapshot error:', err);
          if (onError) onError(err);
        }
      );
    } catch (err) {
      console.warn('[scada] no se pudo abrir suscripción Firestore:', err);
      if (onError) onError(err);
    }
  }

  return function unsubscribe() {
    if (unsubFirestore) {
      try { unsubFirestore(); } catch (_) { /* noop */ }
      unsubFirestore = null;
    }
  };
}
