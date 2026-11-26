// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · el SCRIPT DE GOOGLE que envía los avisos: repositorio · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del 2026-11-26 (99 §236): los correos de aviso los envía un script de Google de la cuenta remitente (sin
// contraseñas). Lo que la PÁGINA hace con él (solo un administrador con perfil; reglas: bloque «Cumplimiento del
// cierre · ODT Afinia» de firestore.rules):
//   · leerEstado  odt_afinia_config/cumplimiento_script, DEL SERVIDOR (lo escribe solo la función
//                 avisosCorreoRemitente): {audienciaVista, vistaEnMs, ultimaConexionEnMs, ultimoResultado} o null;
//   · aprobar     aprueba el script que pidió permiso: guarda audienciaScript = audienciaVista en la configuración
//                 (con el repositorio de la configuración: lee la guardada del servidor y la vuelve a escribir entera,
//                 como la exige la regla; se confirma releyéndola).
// El SDK, la base y la sesión se pueden INYECTAR (las pruebas usan dobles). Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, errorDesdeFirebase, sesionGlobal } from './odt_afinia_lotes.js';
import { esAudiencia } from '../domain/odt_afinia_cumplimiento.js';
import { COL_ESTADO_SCRIPT } from '../domain/odt_afinia_cumplimiento_remitente.js';
import { crearRepositorioCumplimiento, MSG_SOLO_ADMIN_AVISOS } from './odt_afinia_cumplimiento.js';

const CDN_FIRESTORE = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const aMs = (t) => {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  return null;
};

/**
 * @param {object} [opciones]  {sdk, db, sesion, repoCumplimiento} (los tres primeros, como crearRepositorioCumplimiento)
 */
export function crearRepositorioScript(opciones = {}) {
  let _sdk = opciones.sdk || null;
  let _db = opciones.db || null;
  const leerSesion = typeof opciones.sesion === 'function' ? opciones.sesion : sesionGlobal;
  let base = opciones.repoCumplimiento || null;
  const repoConfig = () => { if (!base) base = crearRepositorioCumplimiento(opciones); return base; };
  async function sdk() { if (!_sdk) _sdk = await import(CDN_FIRESTORE); return _sdk; }
  async function db() {
    if (!_db) { const fb = await import('../firebase-init.js'); _db = fb.getDbSafe(); }
    if (!_db) throw new ErrorOdt('red', 'La plataforma no está disponible en este momento (la base no inició).');
    return _db;
  }
  function exigirAdmin() {
    const s = leerSesion();
    if (!s || !s.uid) throw new ErrorOdt('cuenta', 'La sesión venció. Recargue la página e ingrese de nuevo.');
    if (!s.esAdmin) throw new ErrorOdt('sin_permiso', MSG_SOLO_ADMIN_AVISOS);
    if (s.legacy) throw new ErrorOdt('sin_permiso', 'Su cuenta de administrador no tiene perfil en la plataforma: créelo para configurar los avisos.');
    return s;
  }

  return {
    modo: 'nube',

    /** El estado del script (del servidor) o null si nunca se ha conectado. Solo un admin con perfil. */
    async leerEstado() {
      exigirAdmin();
      try {
        const F = await sdk(); const d = await db();
        const ref = F.doc(d, COL_ESTADO_SCRIPT.col, COL_ESTADO_SCRIPT.doc);
        const snap = await (F.getDocFromServer || F.getDoc)(ref);
        if (!snap.exists()) return null;
        const v = snap.data() || {};
        return {
          audienciaVista: typeof v.audienciaVista === 'string' ? v.audienciaVista : '',
          vistaEnMs: aMs(v.vistaEn),
          ultimaConexionEnMs: aMs(v.ultimaConexionEn),
          ultimoResultado: typeof v.ultimoResultado === 'string' ? v.ultimoResultado : ''
        };
      } catch (e) { throw errorDesdeFirebase(e); }
    },

    /**
     * Aprueba el script que pidió permiso (audienciaScript = audiencia). Devuelve la configuración guardada.
     * @param {string} audiencia  la audienciaVista que se mostró
     */
    async aprobar(audiencia) {
      exigirAdmin();
      if (!esAudiencia(audiencia) || !audiencia) throw new ErrorOdt('validacion', 'El identificador del script no es válido: vuelva a consultar su estado.');
      const actual = await repoConfig().leerConfig();
      if (!actual) throw new ErrorOdt('validacion', 'Guarde primero la configuración de los avisos (con el correo remitente) y luego apruebe el script.');
      return repoConfig().guardarConfig({ ...actual, audienciaScript: audiencia });
    }
  };
}
