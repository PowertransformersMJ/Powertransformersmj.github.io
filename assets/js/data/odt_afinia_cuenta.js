// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · la CUENTA de quien firma (Firebase Auth)
// ──────────────────────────────────────────────────────────────────────────────
//   · estadoCuenta            uid, correo, ¿verificado?, proveedor (recarga el usuario)
//   · enviarVerificacion      sendEmailVerification: enlace al buzón del titular
//   · enviarCambioContrasena  sendPasswordResetEmail: enlace para cambiar la contraseña
//   · reautenticar(contraseña) reauthenticateWithCredential + getIdToken(true) y
//                             devuelve las «claims» del token NUEVO: email,
//                             email_verified, auth_time (segundos, entero) y
//                             sign_in_provider, más `iat` (hora de EMISIÓN del token, del
//                             servidor, nunca el reloj del equipo). La regla exige ≤ 5 min
//                             entre la contraseña y la escritura SOLO al habilitarse: desde
//                             el 2026-11-21 la firma no vuelve a pedir la contraseña (usa el
//                             token de la sesión: data/odt_afinia_sesion.js).
//   · edadSesion              cuánto hace que se abrió la sesión (iat − auth_time de un token
//                             recién emitido, SIN pedir contraseña). Desde el 2026-11-21
//                             ninguna pantalla nueva lo usa: Publicar ya no avisa de los
//                             «5 minutos» (procedimiento D5), porque la firma no mide esa
//                             ventana. Se conserva porque una publicar.js vieja de la caché
//                             lo pide (L-102).
// La contraseña solo pasa por aquí y no se guarda en ningún lado: la escribe el
// TITULAR en su equipo (D4 cubre publicar, nunca firmar; Claude no escribe
// contraseñas). Ni publicar ni firmar pasan por reautenticar: solo habilitarse.
// SDK de Auth y `auth` inyectables (pruebas). Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, errorDesdeFirebase } from './odt_afinia_lotes.js';

const CDN_AUTH = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

/**
 * @param {object} [opciones]
 * @param {object} [opciones.authSdk]  {EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail}
 * @param {object} [opciones.auth]     instancia de Auth (por defecto getAuthSafe())
 */
export function crearCuenta(opciones = {}) {
  let _sdk = opciones.authSdk || null;
  let _auth = opciones.auth || null;

  async function sdk() {
    if (!_sdk) _sdk = await import(CDN_AUTH);
    return _sdk;
  }
  async function auth() {
    if (!_auth) {
      const fb = await import('../firebase-init.js');
      _auth = fb.getAuthSafe();
    }
    if (!_auth) throw new ErrorOdt('red', 'La plataforma no está disponible en este momento.');
    return _auth;
  }
  async function usuario() {
    const a = await auth();
    if (!a.currentUser) throw new ErrorOdt('cuenta', 'No hay una sesión abierta. Recargue la página e ingrese.');
    return a.currentUser;
  }
  async function op(fn) {
    try { return await fn(); } catch (e) { throw errorDesdeFirebase(e); }
  }

  return {
    /** uid de la cuenta VIVA de Firebase Auth (cambia si otra pestaña entra con otra cuenta), o null. */
    async uidVivo() {
      try { const a = await auth(); return (a.currentUser && a.currentUser.uid) || null; } catch (_) { return null; }
    },

    /** {uid, correo, verificado, proveedor}. Recarga el usuario para ver una verificación reciente. */
    async estadoCuenta() {
      return op(async () => {
        const u = await usuario();
        if (typeof u.reload === 'function') await u.reload();
        const a = await auth();
        const v = a.currentUser || u;
        const proveedor = (v.providerData || []).some((p) => p && p.providerId === 'password') ? 'password' : ((v.providerData && v.providerData[0] && v.providerData[0].providerId) || '');
        return { uid: v.uid, correo: v.email || '', verificado: v.emailVerified === true, proveedor };
      });
    },

    /** Envía el enlace de verificación al correo de la cuenta. */
    async enviarVerificacion() {
      return op(async () => {
        const F = await sdk(); const u = await usuario();
        await F.sendEmailVerification(u);
        return { correo: u.email || '' };
      });
    },

    /** Envía el enlace para cambiar la contraseña al correo de la cuenta (no a otro). */
    async enviarCambioContrasena() {
      return op(async () => {
        const F = await sdk(); const a = await auth(); const u = await usuario();
        if (!u.email) throw new ErrorOdt('cuenta', 'Su cuenta no tiene correo.');
        await F.sendPasswordResetEmail(a, u.email);
        return { correo: u.email };
      });
    },

    /**
     * Vuelve a pedir la contraseña y renueva el token.
     * @param {string} contrasena
     * @param {{uidEsperado?:string}} [op]  si la cuenta viva no es esta, aborta (L-112)
     * @returns {Promise<{uid:string, email:string, email_verified:boolean, auth_time:number, iat:number, sign_in_provider:string}>}
     */
    async reautenticar(contrasena, { uidEsperado } = {}) {
      if (typeof contrasena !== 'string' || !contrasena) throw new ErrorOdt('contrasena', 'Escriba su contraseña.');
      return op(async () => {
        const F = await sdk(); const u = await usuario();
        if (uidEsperado && u.uid !== uidEsperado) throw new ErrorOdt('cuenta');
        if (!u.email) throw new ErrorOdt('cuenta', 'Su cuenta no tiene correo.');
        const cred = F.EmailAuthProvider.credential(u.email, contrasena);
        await F.reauthenticateWithCredential(u, cred);
        await u.getIdToken(true);
        const r = await u.getIdTokenResult();
        const token = claimsDe(u.uid, r);
        if (uidEsperado && token.uid !== uidEsperado) throw new ErrorOdt('cuenta');
        return token;
      });
    },

    /**
     * Edad de la sesión abierta, en segundos del SERVIDOR: iat − auth_time de un token
     * recién emitido (getIdToken(true) no cambia auth_time: lo prueba el emulador de Auth).
     * No pide contraseña. @returns {Promise<{authTime:number, iat:number, edadSeg:number}>}
     */
    async edadSesion() {
      return op(async () => {
        const u = await usuario();
        await u.getIdToken(true);
        const t = claimsDe(u.uid, await u.getIdTokenResult());
        if (!Number.isInteger(t.auth_time) || !Number.isInteger(t.iat)) throw new ErrorOdt('cuenta', 'No se pudo leer la hora de su inicio de sesión.');
        return { authTime: t.auth_time, iat: t.iat, edadSeg: t.iat - t.auth_time };
      });
    }
  };
}

/** Claims de un getIdTokenResult → {uid, email, email_verified, auth_time, iat, sign_in_provider}. */
export function claimsDe(uid, r) {
  const c = (r && r.claims) || {};
  const entero = (v) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };
  return {
    uid,
    email: typeof c.email === 'string' ? c.email : '',
    email_verified: c.email_verified === true,
    auth_time: entero(c.auth_time),
    iat: entero(c.iat),
    sign_in_provider: (c.firebase && c.firebase.sign_in_provider) || (r && r.signInProvider) || ''
  };
}
