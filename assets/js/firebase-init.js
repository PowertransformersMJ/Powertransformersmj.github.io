// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Bootstrap de Firebase (SDK v10 modular)
// Fase 4 · Integración Firebase
// ──────────────────────────────────────────────────────────────
// Este módulo no se auto-ejecuta en ninguna página todavía.
// Se consumirá desde:
//   - F5  → assets/js/admin/auth.js  (login con Email/Password)
//   - F6+ → módulos CRUD sobre Firestore
//   - F9  → subida/descarga vía Storage
//
// Uso:
//   import { getApp, getAuthSafe, getDbSafe, getStorageSafe,
//            isFirebaseConfigured } from './firebase-init.js';
// ══════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp as _getApp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const APP_NAME = 'sgm-transpower';

function initApp() {
  if (!isFirebaseConfigured) {
    console.warn(
      '[SGM] Firebase aún no configurado. Revisa assets/js/firebase-config.js.'
    );
    return null;
  }
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  return initializeApp(firebaseConfig, APP_NAME);
}

export function getApp() {
  return initApp();
}

export function getAuthSafe() {
  const app = initApp();
  return app ? getAuth(app) : null;
}

// Instancia única de Firestore con auto-detección de long-polling: en redes/
// proxies/antivirus que rompen el streaming WebChannel, el SDK lo detecta y cae
// a long-polling automáticamente → elimina el error "RPC 'Listen' stream
// transport errored (400)" y robustece la conexión en tiempo real (onSnapshot).
// `initializeFirestore` DEBE llamarse antes del primer `getFirestore`; se
// memoiza y, si otra ruta ya inicializó la BD, cae al default sin romper.
let _db = null;
export function getDbSafe() {
  const app = initApp();
  if (!app) return null;
  if (!_db) {
    try {
      _db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch (e) {
      _db = getFirestore(app);
    }
  }
  return _db;
}

export function getStorageSafe() {
  const app = initApp();
  return app ? getStorage(app) : null;
}

// Cloud Functions (HTTPS Callable). Región fija = la de los triggers v2
// del proyecto (southamerica-east1); debe coincidir con functions/index.js
// o el callable responde 'not-found'. Carga el SDK de Functions on-demand
// para no penalizar a las vistas que no invocan funciones.
export async function getFunctionsSafe() {
  const app = initApp();
  if (!app) return null;
  const { getFunctions } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js');
  return getFunctions(app, 'southamerica-east1');
}

export { isFirebaseConfigured };

// Prueba de conexión opcional (solo cuando se carga manualmente).
// Invocar desde la consola:   window.__sgmFirebaseProbe()
if (typeof window !== 'undefined') {
  window.__sgmFirebaseProbe = () => {
    const app = initApp();
    if (!app) return { ok: false, reason: 'Sin configurar' };
    return {
      ok: true,
      name: app.name,
      projectId: app.options.projectId,
      services: { auth: !!getAuth(app), db: !!getFirestore(app), storage: !!getStorage(app) }
    };
  };
}
