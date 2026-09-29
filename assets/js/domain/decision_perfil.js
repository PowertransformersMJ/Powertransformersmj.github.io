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

/**
 * Espera una lectura con paciencia: la MISMA lectura hasta `total` ms (a los
 * `aviso` ms avisa que va lenta); si la lectura FALLA con error, la repite tras
 * `pausa` ms, a lo sumo `reintentos` veces, dentro del mismo tiempo total.
 * @param {() => Promise<any>} leer
 * @returns {Promise<{estado:'ok', valor:any} | {estado:'falla', error:any} | {estado:'tiempo'}>}
 */
export function esperarLectura(leer, op = {}) {
  const total = op.total == null ? 9000 : op.total;
  const aviso = op.aviso == null ? 3500 : op.aviso;
  const pausa = op.pausa == null ? 800 : op.pausa;
  let quedan = op.reintentos == null ? 1 : op.reintentos;
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
        const resta = total - (reloj.ahora() - inicio);
        if (quedan > 0 && resta > pausa) { quedan--; reloj.tras(pausa, () => { if (!fin) intentar(); }); }
        else terminar({ estado: 'falla', error });
      });
    };
    intentar();
  });
}

/**
 * Qué hacer con lo leído.
 * @param {{estado:string, existe?:boolean}} perfil   lectura de /usuarios/{uid} (`existe` si estado 'ok')
 * @param {{estado:string, existe?:boolean}|null} admins  lectura de /admins/{uid} (solo se pide si el perfil NO existe)
 * @returns {'perfil'|'consultar-admins'|'legacy'|'sin-perfil'|'reintentar'}
 *   perfil: usar el perfil real · consultar-admins: el perfil no existe, falta leer /admins ·
 *   legacy: perfil de arranque · sin-perfil: cerrar sesión (no tiene acceso) ·
 *   reintentar: no se pudo saber (conexión): NI cerrar sesión NI perfil de arranque
 */
export function decidirPerfil(perfil, admins = null) {
  if (!perfil || perfil.estado !== 'ok') return 'reintentar';
  if (perfil.existe) return 'perfil';
  if (!admins) return 'consultar-admins';
  if (admins.estado !== 'ok') return 'reintentar';
  return admins.existe ? 'legacy' : 'sin-perfil';
}
