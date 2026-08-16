// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargador de pdf.js (SSoT de la versión)
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// El lector de informes usaba pdf.js 3.11.174, versión afectada por
// CVE-2024-4367: un PDF preparado con malicia podía ejecutar código
// JavaScript en la página al procesar sus fuentes. Como aquí los PDFs
// los sube gente y se abren dentro de una sesión con permisos, ese
// agujero no es teórico. Mozilla lo corrigió en 4.2.0; se fija 4.10.38
// (última de la línea 4.x, ya parcheada).
//
// QUÉ CAMBIÓ EN LA FORMA DE CARGARLO
// Desde 4.x pdf.js SOLO se publica como módulo ES (`.mjs`): ya no
// existe el `pdf.min.js` clásico que se cargaba con <script> y dejaba
// `window.pdfjsLib`. Para no romper a nadie, este módulo importa la
// librería y SIGUE publicando el mismo global `window.pdfjsLib`: el
// contrato viejo se conserva, solo cambia quién lo rellena.
//
// POR QUÉ jsDelivr Y NO cdnjs
// cdnjs no publica las carpetas `cmaps/` ni `standard_fonts/` (hoy
// devuelven 403, también en la versión vieja: ese aviso de
// "fetchStandardFontData failed" venía de ahí). jsDelivr sirve el
// paquete npm completo, así que build, worker, cmaps y fuentes salen
// TODOS del mismo origen y la misma versión — que es justo lo que
// pdf.js exige para no perder glifos al extraer texto.
// ══════════════════════════════════════════════════════════════

/** Versión fijada. Subirla aquí la sube en toda la aplicación. */
export const PDFJS_VERSION = '4.10.38';

const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

/** cMaps y fuentes estándar: mismo origen y misma versión que el build. */
export const PDFJS_CMAP_URL  = `${PDFJS_BASE}/cmaps/`;
export const PDFJS_FONTS_URL = `${PDFJS_BASE}/standard_fonts/`;

/**
 * Opciones de seguridad que acompañan a CADA `getDocument`.
 * `isEvalSupported: false` cierra la vía de ejecución de código que
 * explotaba CVE-2024-4367. Es defensa en profundidad: aunque la versión
 * ya está parcheada, si alguien retrocede el pin el agujero sigue
 * cerrado. Para extraer texto no hace falta `eval`, así que no cuesta
 * nada funcionalmente.
 */
export const PDFJS_OPCIONES_SEGURAS = Object.freeze({
  isEvalSupported: false
});

let promesa = null;

/**
 * Carga pdf.js una sola vez (idempotente) y deja el worker configurado.
 * También publica `window.pdfjsLib` por compatibilidad con el código
 * que ya leía ese global.
 *
 * @returns {Promise<object>} el namespace de pdf.js (`getDocument`, …)
 */
export function cargarPdfJs() {
  if (!promesa) {
    promesa = import(`${PDFJS_BASE}/build/pdf.min.mjs`).then((mod) => {
      // El build ESM exporta el namespace directo; el `.default` se
      // contempla por si un empaquetado futuro lo envuelve.
      const lib = (mod && typeof mod.getDocument === 'function')
        ? mod
        : (mod && mod.default);
      if (!lib || typeof lib.getDocument !== 'function') {
        throw new Error('pdf.js cargó pero no expone getDocument');
      }
      if (lib.GlobalWorkerOptions) {
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.min.mjs`;
      }
      // Compat: el shell y cualquier código legacy siguen leyendo este
      // global. Contrato ADITIVO, no se renombra nada.
      window.pdfjsLib = lib;
      return lib;
    }).catch((err) => {
      // Se limpia la promesa para permitir un reintento si el CDN falló
      // de forma transitoria; el llamador decide qué hacer con el error.
      promesa = null;
      throw err;
    });
  }
  return promesa;
}
