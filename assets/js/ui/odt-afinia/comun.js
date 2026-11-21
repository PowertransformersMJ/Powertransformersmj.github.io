// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · utilidades de PANTALLA
// ──────────────────────────────────────────────────────────────────────────────
// · h(): crea elementos con textContent (nunca innerHTML con datos: un nombre o
//   un motivo no se interpretan como HTML).
// · Fechas y horas en la hora de Colombia.
// · cargarPdfLib(): el pdf-lib VENDORIZADO, con su SHA-256 comprobada antes del
//   primer uso (el import() dinámico no admite SRI; comité W-11), e importado desde
//   un Blob URL de ESOS MISMOS bytes.
// · bloquearCopia(): un lienzo con la ODT no se guarda ni se arrastra como imagen
//   (menú contextual y arrastre bloqueados; L-107).
// · entregarBlob(): descarga ESOS bytes (L-107), sin abrir pestañas.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { PDF_LIB } from '../../domain/odt_afinia_rutas.js';
import { huella } from '../../domain/odt_afinia_partes.js';
import { ZONA_HORARIA } from '../../domain/odt_afinia_textos.js';

/**
 * Crea un elemento. `attrs`: class, text (→ textContent), on{Evento}, dataset, y el resto como atributo
 * (o propiedad si es checked/disabled/value/hidden/type).
 */
export function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (['checked', 'disabled', 'value', 'hidden', 'type', 'htmlFor', 'name', 'id', 'accept', 'autocomplete', 'placeholder', 'maxLength', 'rows'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of hijos.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

/** Vacía un contenedor. */
export function vaciar(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

// ── Fechas (Bogotá) ────────────────────────────────────────────────────────────
const FMT_FH = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});
/** «dd/mm/aaaa, hh:mm:ss» (hora de Colombia) de unos milisegundos; '—' si no hay. */
export function fechaHora(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  return FMT_FH.format(new Date(ms));
}
/** Hora de autenticación (auth_time en SEGUNDOS) en la hora de Colombia. */
export const horaAutenticacion = (seg) => (Number.isFinite(seg) ? fechaHora(seg * 1000) : '—');

/** «ab12cd…9f0e» para mostrar una huella sin ocupar media pantalla (el título lleva la completa). */
export function huellaCorta(hx) {
  return typeof hx === 'string' && hx.length > 16 ? hx.slice(0, 10) + '…' + hx.slice(-6) : (hx || '—');
}

/** Mensaje de un error para la persona (ErrorOdt ya trae el suyo). */
export function mensajeDe(e) {
  return (e && e.message) ? String(e.message) : 'No se pudo completar la operación.';
}

// ── pdf-lib vendorizado ────────────────────────────────────────────────────────
const URL_PDF_LIB = new URL('../../../vendor/pdf-lib-1.17.1.esm.min.js', import.meta.url).href;
let _pdfLib = null;
const importarModulo = (u) => import(u);
/**
 * Carga pdf-lib 1.17.1 (assets/vendor) y comprueba antes su SHA-256 contra la fijada en
 * el dominio. Si no coincide, NO se usa (un compositor distinto daría otra huella).
 * Se importan LOS MISMOS bytes comprobados, desde un Blob URL (sin un segundo pedido
 * que una caché o un despliegue a medias podría servir distinto: TOCTOU). El
 * vendorizado no tiene imports relativos, así que funciona desde el Blob.
 * Con piezas inyectadas (pruebas) no se usa la caché del módulo.
 */
export function cargarPdfLib({
  fetchFn = globalThis.fetch, importar = importarModulo,
  crearUrl = (b) => URL.createObjectURL(b), revocarUrl = (u) => URL.revokeObjectURL(u)
} = {}) {
  const inyectado = fetchFn !== globalThis.fetch || importar !== importarModulo;
  if (_pdfLib && !inyectado) return _pdfLib;
  const p = (async () => {
    const r = await fetchFn(URL_PDF_LIB, { cache: 'force-cache' });
    if (!r || !r.ok) throw new Error('No se pudo descargar el compositor de PDF.');
    const bytes = new Uint8Array(await r.arrayBuffer());
    const hx = await huella(bytes);
    if (hx !== PDF_LIB.sha256) throw new Error('El compositor de PDF no es el fijado (huella distinta). Recargue con Cmd + Shift + R; si sigue, avise al administrador.');
    const urlVerificada = crearUrl(new Blob([bytes], { type: 'text/javascript' }));
    let mod;
    try { mod = await importar(urlVerificada); } finally { revocarUrl(urlVerificada); }
    if (!mod || !mod.PDFDocument) throw new Error('El compositor de PDF no cargó.');
    return mod;
  })();
  if (!inyectado) {
    _pdfLib = p;
    _pdfLib.catch(() => { _pdfLib = null; });
  }
  return p;
}

// ── Entrega de un archivo ──────────────────────────────────────────────────────
/**
 * Descarga EXACTAMENTE `bytes` con ese nombre (Blob + enlace temporal).
 * @returns {Blob} el Blob entregado (las pruebas comparan su huella)
 */
export function entregarBlob(bytes, nombre) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return blob;
}

/**
 * Un lienzo con la ODT no es una salida del documento (L-107): sin «Guardar imagen como…»
 * ni «Copiar imagen» desde el menú contextual, y sin arrastrarlo fuera de la página.
 * (Una captura de pantalla sigue siendo posible: riesgo residual anotado para el ADR.)
 */
export function bloquearCopia(lienzo) {
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
  lienzo.addEventListener('dragstart', (e) => e.preventDefault());
  lienzo.setAttribute('draggable', 'false');
  return lienzo;
}

/** Aviso dentro de un contenedor (role=status), con tipo: info | ok | aviso | error. */
export function aviso(texto, tipo = 'info') {
  return h('p', { class: 'odt-aviso odt-aviso--' + tipo, role: tipo === 'error' ? 'alert' : 'status', text: texto });
}
