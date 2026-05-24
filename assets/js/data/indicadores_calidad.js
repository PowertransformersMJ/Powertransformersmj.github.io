// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Indicadores de Calidad · DATA LAYER
// ──────────────────────────────────────────────────────────────
// Hidrata el dataset del dashboard SAIDI_E/SAIFI_E combinando:
//   1. Baseline JSON local (assets/data/indicadores-calidad-baseline.json)
//   2. Realtime Firestore (documento /indicadores_calidad/global)
//      cuando esté configurado y poblado.
//
// API:
//   - cargarBaselineLocal()                         → Promise<dataset>
//   - suscribirIndicadoresCalidad(onData, onError)  → unsubscribe
// ══════════════════════════════════════════════════════════════

import { isFirebaseConfigured } from '../firebase-config.js';
import { getDbSafe } from '../firebase-init.js';
import {
  doc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// El baseline vive en /assets/data/. Calculamos la URL relativa al pathname
// actual (más predecible que import.meta.url cuando hay base-tags o roots
// distintos). Si todo falla, intentamos también con import.meta.url como
// fallback de último recurso.
function candidatasBaselineURL() {
  const out = [];
  try {
    out.push(new URL('../../data/indicadores-calidad-baseline.json', import.meta.url).href);
  } catch (_) { /* import.meta no disponible en algún entorno */ }
  // Resolución por pathname — funciona en GitHub Pages bajo /pages/x.html
  const path = (typeof location !== 'undefined') ? location.pathname : '';
  if (path.includes('/pages/')) {
    out.push('../assets/data/indicadores-calidad-baseline.json');
  } else {
    out.push('assets/data/indicadores-calidad-baseline.json');
  }
  // Absoluto desde root
  out.push('/assets/data/indicadores-calidad-baseline.json');
  return [...new Set(out)];
}

let _baselineCache = null;
let _ultimoError = null;

export function ultimoErrorBaseline() {
  return _ultimoError;
}

/**
 * Carga el baseline JSON. Cachea en memoria.
 * Shape esperado:
 *   { meses, meses_full, zonas: {TODAS, BOLIVAR, …}, cats_order, kpi, proj_global }
 */
export async function cargarBaselineLocal() {
  if (_baselineCache) return _baselineCache;
  const urls = candidatasBaselineURL();
  let ultimo = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) {
        ultimo = new Error(`HTTP ${res.status} en ${url}`);
        continue;
      }
      _baselineCache = await res.json();
      console.info('[calidad] baseline cargado desde:', url);
      _ultimoError = null;
      return _baselineCache;
    } catch (e) {
      ultimo = e;
    }
  }
  _ultimoError = ultimo;
  throw new Error('Baseline Indicadores de Calidad no disponible · ' + (ultimo && ultimo.message ? ultimo.message : 'sin red'));
}

function firestoreListo() {
  return isFirebaseConfigured && !!getDbSafe();
}

/**
 * Suscripción al documento /indicadores_calidad/global.
 *
 * Si Firestore no está configurado, hace fallback inmediato al
 * baseline local y deja `onData` ejecutarse una sola vez.
 *
 * El callback recibe ({ source: 'baseline'|'firestore', dataset }).
 *
 * Devuelve un unsubscribe que cancela la suscripción real.
 */
export function suscribirIndicadoresCalidad(onData, onError) {
  let unsubFirestore = null;
  let resuelto = false;

  cargarBaselineLocal()
    .then(dataset => {
      if (!resuelto) onData({ source: 'baseline', dataset });
    })
    .catch(err => {
      console.warn('[calidad] baseline no disponible:', err);
      if (!resuelto) onData({ source: 'empty', dataset: null });
    });

  if (firestoreListo()) {
    try {
      const db = getDbSafe();
      const ref = doc(db, 'indicadores_calidad', 'global');
      unsubFirestore = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            resuelto = true;  // baseline ya entregado, no emitir otra vez
            return;
          }
          const dataset = snap.data();
          if (!dataset || !dataset.zonas) {
            console.warn('[calidad] documento Firestore con shape inválido');
            resuelto = true;
            return;
          }
          resuelto = true;
          onData({ source: 'firestore', dataset });
        },
        (err) => {
          console.warn('[calidad] onSnapshot error:', err);
          if (onError) onError(err);
        }
      );
    } catch (err) {
      console.warn('[calidad] no se pudo abrir suscripción:', err);
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
