// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — ¿Qué hacer con el perfil leído al abrir una página? (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// Visto en vivo (2026-09-28): en la PRIMERA carga de una pestaña, leer /usuarios
// tardó más de 3,5 s. El guardián de sesión tomaba esa demora como «no tiene
// perfil»: al Ingeniero (que está en /admins) le ponía un perfil de ARRANQUE con
// su correo como nombre, y en Órdenes no salía su firma; a un técnico lo sacaba
// de la sesión (login?denied=1). Una lectura LENTA o FALLIDA no es un perfil
// inexistente: se espera más, se reintenta un error, y si aun así no se pudo leer
// se ofrece «Reintentar» sin cerrar la sesión. El perfil de arranque (legacy)
// solo aparece cuando /usuarios/{uid} de verdad NO existe y /admins sí.
//
// Funciones PURAS (el reloj se inyecta en las pruebas). Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

/** Errores que NO son de conexión: reintentar no los arregla (revisión de `§116`). */
const DENEGADO = new Set(['permission-denied', 'unauthenticated']);

/**
 * Espera una lectura con paciencia: la MISMA lectura hasta `total` ms (a los
 * `aviso` ms avisa que va lenta); si la lectura FALLA por la conexión, la repite
 * tras cada pausa de `pausas` (cada vez más larga: el cliente de Firestore tarda
 * ~1 s en reconectar), dentro del mismo tiempo total. Un error de PERMISO no se
 * reintenta: devuelve 'denegado'.
 * @param {() => Promise<any>} leer
 * @returns {Promise<{estado:'ok', valor:any} | {estado:'falla', error:any} | {estado:'denegado', error:any} | {estado:'tiempo'}>}
 */
export function esperarLectura(leer, op = {}) {
  // 12 s: más que los 10 s con que el propio cliente de Firestore da la conexión por caída.
  const total = op.total == null ? 12000 : op.total;
  const aviso = op.aviso == null ? 3500 : op.aviso;
  const pausas = Array.isArray(op.pausas) ? op.pausas.slice() : [1500, 3000];
  const reloj = op.reloj || { ahora: () => Date.now(), tras: (ms, f) => setTimeout(f, ms), cancelar: (t) => clearTimeout(t) };
  const inicio = reloj.ahora();
  return new Promise((resolver) => {
    let fin = false;
    const terminar = (r) => { if (fin) return; fin = true; reloj.cancelar(tTotal); reloj.cancelar(tAviso); resolver(r); };
    const tTotal = reloj.tras(total, () => terminar({ estado: 'tiempo' }));
    const tAviso = aviso < total && typeof op.alAvisar === 'function' ? reloj.tras(aviso, () => { if (!fin) op.alAvisar(); }) : null;
    const intentar = () => {
      let p;
      try { p = Promise.resolve(leer()); } catch (e) { p = Promise.reject(e); }
      p.then((valor) => terminar({ estado: 'ok', valor }), (error) => {
        if (fin) return;
        if (error && DENEGADO.has(error.code)) { terminar({ estado: 'denegado', error }); return; }
        const pausa = pausas.shift();
        const resta = total - (reloj.ahora() - inicio);
        if (pausa != null && resta > pausa) reloj.tras(pausa, () => { if (!fin) intentar(); });
        else terminar({ estado: 'falla', error });
      });
    };
    intentar();
  });
}

/**
 * Qué hacer con lo leído. Un perfil NEGADO por las reglas cuenta como inexistente
 * (así era antes y no depende de la conexión); lento o fallido, nunca.
 * @param {{estado:string, existe?:boolean}} perfil   lectura de /usuarios/{uid} (`existe` si estado 'ok')
 * @param {{estado:string, existe?:boolean}|null} admins  lectura de /admins/{uid} (solo se pide si el perfil NO existe)
 * @returns {'perfil'|'consultar-admins'|'legacy'|'sin-perfil'|'reintentar'}
 *   perfil: usar el perfil real · consultar-admins: el perfil no existe, falta leer /admins ·
 *   legacy: perfil de arranque · sin-perfil: cerrar sesión (no tiene acceso) ·
 *   reintentar: no se pudo saber (conexión): NI cerrar sesión NI perfil de arranque
 */
export function decidirPerfil(perfil, admins = null) {
  const noExiste = perfil && (perfil.estado === 'denegado' || (perfil.estado === 'ok' && !perfil.existe));
  if (perfil && perfil.estado === 'ok' && perfil.existe) return 'perfil';
  if (!noExiste) return 'reintentar';
  if (!admins) return 'consultar-admins';
  if (admins.estado === 'denegado') return 'sin-perfil';
  if (admins.estado !== 'ok') return 'reintentar';
  return admins.existe ? 'legacy' : 'sin-perfil';
}
