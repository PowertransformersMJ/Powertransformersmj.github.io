// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · PERSISTENCIA LOCAL
// ──────────────────────────────────────────────────────────────
// IndexedDB (principal) con fallback a localStorage para el
// acumulado de eventos SCADA cargados desde Excel/CSV/JSONL.
// El SEED (baseline JSON) NO se persiste — se hidrata cada vez
// desde el servidor para que las correcciones del backend se
// propaguen sin acción del usuario.
//
// API:
//   - persistInit()              → {mode, events, files}
//   - persistSave(events, files) → Promise<boolean>
//   - persistMode()              → 'indexeddb' | 'localstorage' | 'none'
//   - md5hex16(str)              → hash MD5 truncado a 16 chars
//                                  (idéntico al backend Python para
//                                   que los event_id coincidan)
// ══════════════════════════════════════════════════════════════

import { PERSIST } from '../domain/scada_config.js';

let _idb = null;
let _persistMode = '?';

// ── SparkMD5 (lazy desde CDN) ─────────────────────────────────
const SPARKMD5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.2/spark-md5.min.js';
let _sparkPromise = null;

export function loadSparkMD5() {
  if (typeof window !== 'undefined' && typeof window.SparkMD5 !== 'undefined') {
    return Promise.resolve(window.SparkMD5);
  }
  if (_sparkPromise) return _sparkPromise;
  _sparkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SPARKMD5_CDN;
    s.async = true;
    s.onload = () => {
      if (typeof window.SparkMD5 === 'undefined') {
        reject(new Error('SparkMD5 cargó pero el global no está disponible.'));
      } else {
        resolve(window.SparkMD5);
      }
    };
    s.onerror = () => reject(new Error('No se pudo descargar SparkMD5 desde CDN.'));
    document.head.appendChild(s);
  });
  return _sparkPromise;
}

/**
 * Hash MD5 hex truncado a 16 chars. Idéntico a la implementación
 * Python que produce los `event_id` del SEED — permite dedup
 * cross-backend/frontend usando la misma semilla.
 *
 * IMPORTANTE: invocar después de `await loadSparkMD5()`.
 */
export function md5hex16(str) {
  if (typeof window === 'undefined' || typeof window.SparkMD5 === 'undefined') {
    throw new Error('md5hex16: SparkMD5 no cargado. Llamar loadSparkMD5() antes.');
  }
  return window.SparkMD5.hash(str).slice(0, 16);
}

// ── IndexedDB helpers ─────────────────────────────────────────
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no soportado'));
      return;
    }
    const req = indexedDB.open(PERSIST.DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PERSIST.DB_STORE)) {
        db.createObjectStore(PERSIST.DB_STORE);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error || new Error('IndexedDB open error'));
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PERSIST.DB_STORE, 'readonly');
    const req = tx.objectStore(PERSIST.DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbSet(db, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PERSIST.DB_STORE, 'readwrite');
    tx.objectStore(PERSIST.DB_STORE).put(val, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

// ── localStorage fallback ─────────────────────────────────────
function lsAvailable() {
  try {
    localStorage.setItem('__t__', 'x');
    localStorage.removeItem('__t__');
    return true;
  } catch (_) {
    return false;
  }
}

// ── API pública ───────────────────────────────────────────────

/**
 * Inicializa la capa de persistencia y devuelve los datos guardados.
 * Migra automáticamente datos legacy de localStorage a IndexedDB.
 */
export async function persistInit() {
  try {
    _idb = await idbOpen();
    const ev = await idbGet(_idb, PERSIST.K_EVENTS);
    const fl = await idbGet(_idb, PERSIST.K_HISTORY);
    _persistMode = 'indexeddb';
    // Migración desde localStorage
    if ((!ev || !ev.length) && lsAvailable()) {
      try {
        const oldEv = JSON.parse(localStorage.getItem(PERSIST.LS_EVENTS)  || '[]');
        const oldFl = JSON.parse(localStorage.getItem(PERSIST.LS_HISTORY) || '[]');
        if (oldEv.length) {
          await idbSet(_idb, PERSIST.K_EVENTS,  oldEv);
          await idbSet(_idb, PERSIST.K_HISTORY, oldFl);
          return { mode: 'indexeddb', events: oldEv, files: oldFl, migrated: true };
        }
      } catch (_) { /* ignorar */ }
    }
    return { mode: 'indexeddb', events: ev || [], files: fl || [] };
  } catch (_) {
    if (lsAvailable()) {
      _persistMode = 'localstorage';
      try {
        return {
          mode: 'localstorage',
          events: JSON.parse(localStorage.getItem(PERSIST.LS_EVENTS)  || '[]'),
          files:  JSON.parse(localStorage.getItem(PERSIST.LS_HISTORY) || '[]'),
        };
      } catch (_) {
        return { mode: 'localstorage', events: [], files: [] };
      }
    }
    _persistMode = 'none';
    return { mode: 'none', events: [], files: [] };
  }
}

/**
 * Guarda eventos + historial. Devuelve true/false.
 */
export async function persistSave(events, files) {
  if (_persistMode === 'indexeddb' && _idb) {
    try {
      await idbSet(_idb, PERSIST.K_EVENTS,  events);
      await idbSet(_idb, PERSIST.K_HISTORY, files);
      return true;
    } catch (e) {
      console.error('[scada/storage] IndexedDB no pudo guardar:', e);
      return false;
    }
  }
  if (_persistMode === 'localstorage') {
    try {
      localStorage.setItem(PERSIST.LS_EVENTS,  JSON.stringify(events));
      localStorage.setItem(PERSIST.LS_HISTORY, JSON.stringify(files));
      return true;
    } catch (e) {
      console.error('[scada/storage] localStorage lleno (~5MB):', e);
      return false;
    }
  }
  return false;
}

export function persistMode() {
  return _persistMode;
}

export function persistAvailable() {
  return _persistMode === 'indexeddb' || _persistMode === 'localstorage';
}
