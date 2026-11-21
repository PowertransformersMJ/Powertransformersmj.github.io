// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · la SESIÓN con la que se firma (sin contraseña)
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero (2026-11-21, «solo al entrar, sin límite», tomada sabiendo el
// riesgo: una sesión abierta podría firmar y la firma pierde fuerza como prueba): la
// contraseña se escribe SOLO al iniciar sesión. Para firmar se usa el token de ESA sesión:
//   · crearSesionFirma().tokenVigente  renueva el token con getIdToken(true) (NO pide la
//                       contraseña y NO cambia auth_time: lo prueba el emulador de Auth) y
//                       devuelve sus «claims»: email, email_verified, auth_time (inicio de
//                       la sesión, en segundos), iat y sign_in_provider.
//   · verificarSesionParaFirmar  justo antes de escribir: la cuenta viva sigue siendo la
//                       de la copia preparada y la sesión es de esa cuenta y ese correo,
//                       abierta con correo y contraseña y con el correo verificado. Sin
//                       ventana de 5 minutos ni comparación con la hora de publicar o con
//                       la firma del AZT: la regla ya no las pide.
// El acto guarda auth_time como «sesión iniciada el …» (solo registro).
// La HABILITACIÓN no cambia: sigue pidiendo la contraseña (odt_afinia_cuenta.reautenticar).
// Compromiso que reemplaza a R3/D5 en la regla: Claude nunca pulsa «Firmar» ni
// «Confirmar firma» en ninguna sesión.
// `auth` inyectable (pruebas). Archivo NUEVO a propósito (L-102): firmar.js lo pide aquí y
// no a vecinos (odt_afinia_cuenta.js, preparar.js) que pudieron quedar viejos en la caché.
// ══════════════════════════════════════════════════════════════════════════════

import { PROVEEDOR, esHuella } from '../domain/odt_afinia_rutas.js';
import { ErrorOdt, errorDesdeFirebase } from './odt_afinia_lotes.js';
import { claimsDe } from './odt_afinia_cuenta.js';

/**
 * @param {object} [opciones]
 * @param {object} [opciones.auth]  instancia de Auth (por defecto getAuthSafe(), cargada al primer uso)
 */
export function crearSesionFirma(opciones = {}) {
  let _auth = opciones.auth || null;

  async function auth() {
    if (!_auth) {
      const fb = await import('../firebase-init.js');
      _auth = fb.getAuthSafe();
    }
    if (!_auth) throw new ErrorOdt('red', 'La plataforma no está disponible en este momento.');
    return _auth;
  }

  return {
    /**
     * Claims del token de la sesión abierta, renovado SIN pedir la contraseña.
     * @param {{uidEsperado?:string}} [op]  si la cuenta viva no es esta, aborta (L-112)
     * @returns {Promise<{uid:string, email:string, email_verified:boolean, auth_time:number, iat:number, sign_in_provider:string}>}
     */
    async tokenVigente({ uidEsperado } = {}) {
      try {
        const a = await auth();
        const u = a.currentUser;
        if (!u) throw new ErrorOdt('cuenta', 'No hay una sesión abierta. Recargue la página e ingrese.');
        if (uidEsperado && u.uid !== uidEsperado) throw new ErrorOdt('cuenta');
        await u.getIdToken(true);
        const token = claimsDe(u.uid, await u.getIdTokenResult());
        if (uidEsperado && token.uid !== uidEsperado) throw new ErrorOdt('cuenta');
        return token;
      } catch (e) {
        throw errorDesdeFirebase(e);
      }
    }
  };
}

/**
 * Justo antes de escribir la firma: ¿la cuenta viva y la sesión son las de la copia preparada?
 * @param {object} congelado  la copia de «Preparar» (prepararFirma)
 * @param {{uidVivo:string|null, token:object}} p  token: claims de tokenVigente
 * @returns {string|null}  el motivo para no firmar, en llano, o null
 */
export function verificarSesionParaFirmar(congelado, { uidVivo, token } = {}) {
  if (!congelado) return 'Primero prepare la firma.';
  if (!uidVivo || uidVivo !== congelado.uid) return 'La sesión de esta pestaña cambió de cuenta. No se firma: recargue la página y entre con su propia cuenta.';
  if (!token || token.uid !== congelado.uid) return 'La sesión abierta es de otra cuenta. No se firma: recargue la página y entre con su propia cuenta.';
  if (typeof token.email !== 'string' || !token.email) return 'Su sesión no trae el correo de la cuenta. Recargue la página, entre de nuevo y firme.';
  if (token.email !== congelado.correo) return 'El correo de su sesión no coincide con el de la declaración. Vuelva a preparar la firma.';
  if (token.email_verified !== true) return 'Su correo no está verificado. Complete el paso 1 de «Habilitarme».';
  if (token.sign_in_provider !== PROVEEDOR) return 'Para firmar, su sesión debe abrirse con su correo y contraseña. Salga, entre de nuevo así y firme.';
  if (!Number.isInteger(token.auth_time)) return 'No se pudo leer la hora de su inicio de sesión. Recargue la página y firme.';
  if (!esHuella(congelado.huellaVista)) return 'La firma preparada no tiene huella.';
  return null;
}
