// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Session Guard unificado (v3 hardened)
// Único punto de verificación de sesión en todo el sitio.
// Sin autenticación válida no hay contenido visible.
// ──────────────────────────────────────────────────────────────
// Resiliencia:
//  - Timeout de Auth corto (4s) + failsafe absoluto (7s).
//  - Detección inmediata si auth.currentUser ya está disponible.
//  - El perfil se espera hasta 12 s (aviso «conexión lenta» a los 3,5 s); un error de
//    conexión se reintenta. Lento o fallido NO es «sin perfil»: se ofrece Reintentar,
//    que vuelve a leer en la misma página (`99 §116`).
//  - Detección de unauthorized-domain con mensaje claro.
//  - Logs [SGM] visibles en consola en cada fase para diagnóstico.
// ══════════════════════════════════════════════════════════════

import {
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { getAuthSafe, getDbSafe, isFirebaseConfigured } from '../firebase-init.js';

// Raíz del sitio calculada desde la URL de este módulo.
const BASE_URL  = new URL('../../../', import.meta.url).href;
const LOGIN_URL = BASE_URL + 'index.html';
const HOME_URL  = BASE_URL + 'home.html';

const AUTH_TIMEOUT_MS    = 4000;   // tiempo máximo esperando onAuthStateChanged
const PROFILE_TIMEOUT_MS = 3500;   // a partir de aquí se avisa «conexión lenta» (antes: se rendía)
const PROFILE_TOTAL_MS   = 12000;  // tiempo máximo leyendo el perfil (> 10 s: Firestore da la conexión por caída a los 10 s)
const FAILSAFE_MS        = 7500;   // failsafe de la fase de Auth: muestra error y libera UI

// ── Splash visible mientras se verifica la sesión ──
function hideBody() {
  if (document.getElementById('sgm-guard-hide')) return;
  const s = document.createElement('style');
  s.id = 'sgm-guard-hide';
  s.textContent = 'body{visibility:hidden!important}';
  document.head.appendChild(s);
  mountSplash();
}
function revealBody() {
  document.getElementById('sgm-guard-hide')?.remove();
  unmountSplash();
}

function mountSplash(msg = 'Verificando sesión…') {
  let el = document.getElementById('sgm-splash');
  if (el) { const m = el.querySelector('.sgm-splash-msg'); if (m) m.textContent = msg; return; }
  el = document.createElement('div');
  el.id = 'sgm-splash';
  el.className = 'sgm-splash';
  el.style.cssText = [
    'visibility:visible!important',
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:1rem',
    'background:#0a0f1e', 'color:#a0b0cc',
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:.85rem', 'letter-spacing:.14em', 'text-transform:uppercase'
  ].join(';');
  el.innerHTML =
    '<div class="sgm-splash-ring" style="width:56px;height:56px;border:3px solid rgba(79,140,255,.15);border-top-color:#4f8cff;border-right-color:#00d9c0;border-radius:50%;animation:sgmSpin .9s linear infinite"></div>'
    + '<div class="sgm-splash-msg" style="opacity:.75">' + msg + '</div>'
    // Escape valve: aparece a los 2s para que el user nunca quede atrapado.
    + '<a id="sgm-splash-escape" href="' + LOGIN_URL + '" style="display:none;color:#8fa0bb;text-decoration:underline;letter-spacing:0;text-transform:none;font-family:system-ui,sans-serif;font-size:.78rem;opacity:.75;margin-top:1rem">¿Tarda demasiado? Volver al login</a>';
  if (!document.getElementById('sgm-splash-kf')) {
    const kf = document.createElement('style');
    kf.id = 'sgm-splash-kf';
    kf.textContent = '@keyframes sgmSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(kf);
  }
  document.documentElement.appendChild(el);
  // Mostrar la escape valve a los 2 s.
  setTimeout(() => {
    const a = document.getElementById('sgm-splash-escape');
    if (a) a.style.display = 'inline';
  }, 2000);
}
function unmountSplash() {
  document.getElementById('sgm-splash')?.remove();
}
function showSplashError(msg, href, reintentar = null) {
  let el = document.getElementById('sgm-splash');
  if (!el) { mountSplash(''); el = document.getElementById('sgm-splash'); }
  el.innerHTML =
    '<div style="width:42px;height:42px;border-radius:50%;background:rgba(255,90,110,.12);border:1px solid rgba(255,90,110,.4);display:inline-flex;align-items:center;justify-content:center;color:#ff5a6e;font-size:1.2rem;font-weight:700">!</div>'
    + '<div class="sgm-splash-msg sgm-splash-err" style="color:#ff5a6e;max-width:520px;text-align:center;line-height:1.55;letter-spacing:0;text-transform:none;font-family:system-ui,sans-serif;font-size:.92rem">' + msg + '</div>'
    + (reintentar ? '<button type="button" id="sgm-splash-reintentar" style="margin-top:.5rem;padding:.55rem 1.3rem;border-radius:8px;border:1px solid #4f8cff;background:#4f8cff;color:#fff;font:600 .9rem system-ui,sans-serif;letter-spacing:0;text-transform:none;cursor:pointer">Reintentar</button>'
      + '<button type="button" id="sgm-splash-salir" style="margin-top:.25rem;padding:.35rem .9rem;border:0;background:none;color:#8fa0bb;text-decoration:underline;font:.8rem system-ui,sans-serif;letter-spacing:0;text-transform:none;cursor:pointer">Cerrar sesión</button>' : '')
    + (href && !reintentar ? `<a href="${href}" style="color:#4f8cff;text-decoration:underline;letter-spacing:0;text-transform:none;font-family:system-ui,sans-serif;margin-top:.5rem">Ir al login</a>` : '');
  // «Reintentar» vuelve a leer DENTRO de la página (el cliente ya está conectado): recargar
  // arrancaba en frío otra vez (revisión de `§116`). «Cerrar sesión» lo dice y lo hace.
  const b = document.getElementById('sgm-splash-reintentar');
  if (b && reintentar) b.addEventListener('click', () => { mountSplash('Verificando su perfil…'); reintentar(); });
  const x = document.getElementById('sgm-splash-salir');
  if (x) x.addEventListener('click', () => { logout(); });
}

hideBody();

// Failsafe absoluto: si nada resuelve en FAILSAFE_MS, muestra error y permite ir al login.
const FAILSAFE_TIMER = setTimeout(() => {
  if (!document.getElementById('sgm-guard-hide')) return; // ya resuelto
  console.warn('[SGM] FAILSAFE: %sms sin respuesta. Origin actual: %s', FAILSAFE_MS, location.origin);
  showSplashError(
    'No fue posible verificar la sesión. Verifica que el dominio "' + location.hostname +
    '" esté autorizado en Firebase Console (Authentication → Settings → Authorized domains).',
    LOGIN_URL
  );
}, FAILSAFE_MS);

// ── Utilidades ──
function redirect(url) {
  console.info('[SGM] redirigiendo →', url);
  try { location.replace(url); } catch (_) { location.href = url; }
}

// Una lectura LENTA o FALLIDA no es «no existe» (`99 §116`): se espera hasta
// PROFILE_TOTAL_MS (a los PROFILE_TIMEOUT_MS se avisa «conexión lenta») y un
// error se reintenta una vez. Devuelven {estado:'ok', existe, ...} o {estado:'falla'|'tiempo'}.
async function leerConPaciencia(esperarLectura, db, col, uid) {
  const r = await esperarLectura(() => getDoc(doc(db, col, uid)), {
    total: PROFILE_TOTAL_MS, aviso: PROFILE_TIMEOUT_MS,
    alAvisar: () => { console.warn('[SGM] lectura lenta de /%s/%s: se sigue esperando', col, uid); mountSplash('Conexión lenta: verificando su perfil…'); }
  });
  if (r.estado === 'falla' || r.estado === 'denegado') console.warn('[SGM] No se pudo leer /%s/%s:', col, uid, r.error);
  if (r.estado === 'tiempo') console.warn('[SGM] timeout %sms en: getDoc /%s/%s', PROFILE_TOTAL_MS, col, uid);
  if (r.estado !== 'ok') return { estado: r.estado };
  const snap = r.valor;
  return { estado: 'ok', existe: snap.exists(), snap };
}

const loadProfile = (esp, db, uid) => leerConPaciencia(esp, db, 'usuarios', uid);
const isLegacyAdmin = (esp, db, uid) => leerConPaciencia(esp, db, 'admins', uid);

function humanizeAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return 'El dominio "' + location.hostname + '" no está autorizado en Firebase Auth. ' +
      'Agrégalo en Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Sin conexión con el servidor de autenticación.';
  }
  return err?.message || code || 'Error desconocido.';
}

// ── API principal ──
export function ensureSession({ requireAdmin = false } = {}) {
  return new Promise((resolve) => {
    console.info('[SGM] ensureSession start · origin:', location.origin);

    if (!isFirebaseConfigured) {
      console.warn('[SGM] Firebase no configurado — al login.');
      redirect(LOGIN_URL);
      return;
    }

    let auth, db;
    try {
      auth = getAuthSafe();
      db   = getDbSafe();
    } catch (err) {
      console.error('[SGM] Firebase init error:', err);
      clearTimeout(FAILSAFE_TIMER);
      showSplashError('Firebase no pudo inicializar: ' + (err?.message || ''), LOGIN_URL);
      return;
    }
    if (!auth || !db) { redirect(LOGIN_URL); return; }

    // Detección inmediata: ¿ya hay user en Auth? Si sí, procesar sin esperar.
    const earlyUser = auth.currentUser;
    if (earlyUser) {
      console.info('[SGM] currentUser presente al arrancar:', earlyUser.email);
      handleUser(earlyUser);
      return;
    }

    // Timeout duro al onAuthStateChanged. Si Auth no responde en 4s,
    // asumimos que no hay sesión y mandamos al login.
    const failTimer = setTimeout(() => {
      console.warn('[SGM] timeout %sms esperando Auth — al login.', AUTH_TIMEOUT_MS);
      try { unsub(); } catch (_) {}
      redirect(LOGIN_URL);
    }, AUTH_TIMEOUT_MS);

    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(auth, (user) => {
        clearTimeout(failTimer);
        if (!user) {
          console.info('[SGM] sin sesión — al login.');
          try { unsub(); } catch (_) {}
          redirect(LOGIN_URL);
          return;
        }
        handleUser(user);
      }, (authErr) => {
        clearTimeout(failTimer);
        clearTimeout(FAILSAFE_TIMER);
        console.error('[SGM] Auth error:', authErr);
        showSplashError(humanizeAuthError(authErr), LOGIN_URL);
      });
    } catch (err) {
      clearTimeout(failTimer);
      clearTimeout(FAILSAFE_TIMER);
      console.error('[SGM] No se pudo suscribir a Auth:', err);
      showSplashError(humanizeAuthError(err), LOGIN_URL);
    }

    async function handleUser(user) {
      try { unsub(); } catch (_) {}
      // Auth ya respondió: el failsafe (que habla del dominio de Auth) deja de aplicar.
      // La lectura del perfil tiene su propio tope (PROFILE_TOTAL_MS) y su propio aviso.
      clearTimeout(FAILSAFE_TIMER);
      try {
        console.info('[SGM] sesión encontrada:', user.email, '— buscando perfil…');
        // Dentro del try: si este módulo no carga, la página sigue OCULTA con su error
        // (con un import estático, un fallo la dejaba visible sin verificar; revisión de `§116`).
        const { esperarLectura, decidirPerfil } = await import('../domain/decision_perfil.js');
        const lectura = await loadProfile(esperarLectura, db, user.uid);
        let decision = decidirPerfil(lectura);
        let admins = null;
        if (decision === 'consultar-admins') {
          admins = await isLegacyAdmin(esperarLectura, db, user.uid);
          decision = decidirPerfil(lectura, admins);
        }
        if (decision === 'reintentar') {
          // No se pudo SABER (conexión): ni perfil de arranque ni cerrar la sesión (`99 §116`).
          console.warn('[SGM] no se pudo leer el perfil — se ofrece reintentar (sin cerrar sesión).');
          showSplashError('No se pudo leer su perfil: la conexión con el servidor está lenta o se cortó. '
            + 'Su sesión sigue abierta.', LOGIN_URL, () => handleUser(user));
          return;
        }
        let profile = null;
        if (decision === 'perfil') profile = { uid: lectura.snap.id, ...lectura.snap.data() };
        if (decision === 'legacy') {
          console.info('[SGM] perfil legacy admin (colección /admins) — autorizado.');
          profile = {
            uid: user.uid, email: user.email,
            nombre: user.displayName || user.email,
            rol: 'admin', activo: true, legacy: true
          };
        }

        if (!profile || profile.activo === false) {
          console.warn('[SGM] usuario sin perfil activo — signOut + login.');
          try { await signOut(auth); } catch (_) {}
          redirect(LOGIN_URL + '?denied=1');
          return;
        }

        if (requireAdmin && profile.rol !== 'admin') {
          console.warn('[SGM] rol insuficiente para admin: %s — al home.', profile.rol);
          redirect(HOME_URL + '?denied=admin');
          return;
        }

        const sess = { user, profile, role: profile.rol };
        window.__sgmSession = sess;
        window.__sgmAdmin = { uid: user.uid, email: user.email };
        try {
          window.dispatchEvent(new CustomEvent('sgm:session-ready', { detail: sess }));
          // TODO-16: 10 páginas admin escuchan este evento en `document`
          // (no en window) — un evento disparado en window NUNCA llega a
          // un listener de document. Doble dispatch para cubrir ambos.
          document.dispatchEvent(new CustomEvent('sgm:session-ready', { detail: sess }));
        } catch (_) {}
        clearTimeout(FAILSAFE_TIMER);
        revealBody();
        console.info('[SGM] sesión OK · rol:', profile.rol);
        resolve(sess);
      } catch (innerErr) {
        clearTimeout(FAILSAFE_TIMER);
        console.error('[SGM] Error resolviendo perfil:', innerErr);
        showSplashError('Error verificando perfil: ' + (innerErr?.message || ''), LOGIN_URL);
      }
    }
  });
}

export async function logout() {
  const auth = getAuthSafe();
  if (auth) {
    try { await signOut(auth); } catch (_) {}
  }
  try { sessionStorage.removeItem('sgm.access'); } catch (_) {}
  redirect(LOGIN_URL);
}

export function getSession() {
  return window.__sgmSession || null;
}

export function isAdmin() {
  const s = getSession();
  return !!(s && s.role === 'admin');
}
