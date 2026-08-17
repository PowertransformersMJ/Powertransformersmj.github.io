// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · Cargabilidad
// DATA LAYER
// ──────────────────────────────────────────────────────────────
// Hidrata el dataset del dashboard combinando:
//   1. Baseline JSON local (cargado con 3 URLs candidatas como
//      fallback robusto, mismo patrón que indicadores-calidad).
//   2. Realtime Firestore (colección /cargabilidad_transformadores)
//      cuando esté configurada y poblada.
//
// API pública:
//   - cargarBaselineLocal()                       → Promise<rows[]>
//   - suscribirCargabilidad(onData, onError)      → unsubscribe()
//   - ultimoErrorBaseline()                        → Error | null
// ══════════════════════════════════════════════════════════════

import { isFirebaseConfigured } from '../firebase-config.js';
import { getDbSafe } from '../firebase-init.js';
import {
  collection, query, orderBy, onSnapshot, limit,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { LIMITE_CARGABILIDAD } from '../domain/limites_lectura.js';

function candidatasBaselineURL() {
  const out = [];
  try {
    out.push(new URL('../../data/seguimiento-cargabilidad-baseline.json', import.meta.url).href);
  } catch (_) { /* import.meta no disponible en entornos extraños */ }
  const path = (typeof location !== 'undefined') ? location.pathname : '';
  if (path.includes('/pages/')) {
    out.push('../assets/data/seguimiento-cargabilidad-baseline.json');
  } else {
    out.push('assets/data/seguimiento-cargabilidad-baseline.json');
  }
  out.push('/assets/data/seguimiento-cargabilidad-baseline.json');
  return [...new Set(out)];
}

let _baselineCache = null;
let _ultimoError = null;

export function ultimoErrorBaseline() {
  return _ultimoError;
}

/**
 * Carga el baseline JSON de cargabilidad. Cachea en memoria.
 * Shape esperado: array de objetos transformador (id, sub, zona,
 * dep, grupo, pot, refrig, cond, reg, vp/vs/vt, uucc, us, P/S/T
 * con amp/car/l1/l2/pct, cmax, diag).
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
      const data = await res.json();
      if (!Array.isArray(data)) {
        ultimo = new Error(`Shape inesperado en ${url} · se esperaba array`);
        continue;
      }
      _baselineCache = data;
      console.info('[cargabilidad] baseline cargado desde:', url, '·', data.length, 'trafos');
      _ultimoError = null;
      return _baselineCache;
    } catch (e) {
      ultimo = e;
    }
  }
  _ultimoError = ultimo;
  throw new Error('Baseline Cargabilidad no disponible · ' + (ultimo?.message || 'sin red'));
}

function firestoreListo() {
  return isFirebaseConfigured && !!getDbSafe();
}

/**
 * Suscribe a /cargabilidad_transformadores en tiempo real.
 * Si Firestore no está configurado o vacío, hace fallback al baseline.
 *
 * Devuelve un unsubscribe() que cancela la suscripción real.
 */
export function suscribirCargabilidad(onData, onError) {
  let unsubFirestore = null;
  let resuelto = false;

  cargarBaselineLocal()
    .then(rows => {
      if (!resuelto) onData({ source: 'baseline', rows });
    })
    .catch(err => {
      console.warn('[cargabilidad] baseline no disponible:', err);
      if (!resuelto) onData({ source: 'empty', rows: [] });
    });

  if (firestoreListo()) {
    try {
      const db = getDbSafe();
      const ref = collection(db, 'cargabilidad_transformadores');
      // Tope de lectura: hay un registro por transformador, así que 500
      // cubre el parque entero; lo que evita es que una suscripción sin
      // límite reenvíe la colección completa en cada escritura.
      const q = query(ref, orderBy('id'), limit(LIMITE_CARGABILIDAD));
      unsubFirestore = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map(d => ({ ...d.data() }));
          if (rows.length === 0) { resuelto = true; return; }
          resuelto = true;
          onData({ source: 'firestore', rows });
        },
        (err) => {
          console.warn('[cargabilidad] onSnapshot error:', err);
          if (onError) onError(err);
        }
      );
    } catch (err) {
      console.warn('[cargabilidad] no se pudo abrir suscripción:', err);
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
