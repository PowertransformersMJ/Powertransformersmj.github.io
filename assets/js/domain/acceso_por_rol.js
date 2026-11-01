// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Páginas que puede abrir cada rol · `99 §198`
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-30): «un nuevo usuario que solo podrá apreciar el módulo de
// cargabilidad SCADA y mapa; solo es visitante, no puede crear ni gestionar nada».
// El guardián de sesión (auth/session-guard.js) carga este módulo SOLO para el visitante y,
// si la página no está en su lista, lo manda a su inicio sin mostrarla. Esconder no protege:
// la barrera real son firestore.rules, storage.rules y functions/acceso_ia.mjs (mismo criterio).
// Para cualquier otro rol no cambia nada. Puro: sin DOM ni Firebase. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

export const ROL_VISITANTE = 'visitante';

/** Las páginas del visitante, en el orden de su menú. Rutas desde la raíz del sitio. */
const PAGINAS_VISITANTE = Object.freeze([
  Object.freeze({ ruta: 'pages/cargabilidad-scada.html', titulo: 'Cargabilidad SCADA', icono: 'chart-line' }),
  Object.freeze({ ruta: 'pages/mapa-v2.html', titulo: 'Mapa', icono: 'map' }),
]);
const INICIO_VISITANTE = PAGINAS_VISITANTE[0].ruta;

/**
 * Ante la duda, CERRADO (espejo exacto de firestore.rules y storage.rules): cuenta como visitante todo
 * texto que contenga «visitante» (mayúsculas, espacios raros escritos por consola) y todo rol que no sea
 * texto; sin rol (o null) no lo es. El guardián (session-guard.js) y el login (index.html) repiten esta
 * línea en su lugar para no depender de este módulo (una prueba los amarra).
 */
export function esRolVisitante(rol) {
  if (rol == null) return false;
  return typeof rol !== 'string' || rol.toLowerCase().includes(ROL_VISITANTE);
}

/**
 * La página como «carpeta/nombre» sin extensión: '/pages/x.html', '/pages/x', '/pages/x/' y
 * '/repo/pages/x.html' dan 'pages/x'. Se comparan los dos últimos tramos EXACTOS: 'mapa' no
 * deja pasar a 'mapa-v2' ni al revés.
 */
export function clavePagina(pathname) {
  let p = String(pathname ?? '').split(/[?#]/)[0];
  try { p = decodeURIComponent(p); } catch (_) { /* mal codificada: se compara tal cual y no coincide */ }
  const tramos = p.toLowerCase().split('/').filter(Boolean);
  if (tramos.length) tramos[tramos.length - 1] = tramos[tramos.length - 1].replace(/\.html$/, '');
  return tramos.slice(-2).join('/');
}

const CLAVES_VISITANTE = new Set(PAGINAS_VISITANTE.map((p) => clavePagina('/' + p.ruta)));

/**
 * @param {string} rol       profile.rol
 * @param {string} pathname  location.pathname
 * @returns {{restringido:boolean, permitido:boolean, destino?:string|null, inicio?:string,
 *            paginas?:Array<{ruta:string,titulo:string,icono:string}>}}
 *   destino: la ruta (desde la raíz) a la que se manda al visitante cuando la página no es suya.
 */
export function decidirAcceso(rol, pathname) {
  if (!esRolVisitante(rol)) return { restringido: false, permitido: true };
  const permitido = CLAVES_VISITANTE.has(clavePagina(pathname));
  return {
    restringido: true,
    permitido,
    destino: permitido ? null : INICIO_VISITANTE,
    inicio: INICIO_VISITANTE,
    paginas: PAGINAS_VISITANTE.map((p) => ({ ...p })),
  };
}
