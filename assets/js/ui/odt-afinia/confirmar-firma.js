// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · la DECLARACIÓN + «Firmar» → «Confirmar firma»
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero (2026-11-21): para firmar NO se vuelve a pedir la contraseña
// (se escribió al iniciar sesión); basta un botón «Firmar» y después «Confirmar firma».
// Sin casilla y sin campo de contraseña.
// Lo que la persona lee es EXACTAMENTE lo que se guarda: la declaración va completa,
// con textContent (sin HTML, sin recortes), desde la misma cadena que se escribirá en
// el acto (comité W-11, legal). Debajo, «Firmar»; al pulsarlo aparecen «Confirmar firma»
// y «Cancelar» con una línea en llano (LINEA_CONFIRMAR). «Confirmar firma» llama a
// `alConfirmar` UNA vez: mientras trabaja, los botones quedan ocupados (sin doble envío).
// Lo que se esconde y se muestra es un contenedor SIN `display` propio (el paso «Firmar» y la
// caja .odt-confirmar): en el navegador, el `display` de .odt-btn y .odt-acciones gana sobre el
// atributo `hidden`, así que nunca se esconde un botón ni una fila de acciones directamente.
// La habilitación (aceptar el acuerdo, una vez) sigue en declaracion.js con casilla y
// contraseña: esta pieza es solo de la firma.
// Mientras el Ingeniero no apruebe los textos (TEXTOS_APROBADOS = false), encima va el
// rótulo «Borrador · pendiente del Ingeniero», igual que en declaracion.js.
// Archivo NUEVO a propósito (L-102): firmar.js no le pide nada nuevo a declaracion.js,
// que pudo quedar viejo en la caché.
// ══════════════════════════════════════════════════════════════════════════════

import { h } from './comun.js';
import { TEXTOS_APROBADOS, ROTULO_BORRADOR } from '../../domain/odt_afinia_textos.js';

/** La línea que acompaña a «Confirmar firma». */
export const LINEA_CONFIRMAR = 'Al confirmar, acepta la declaración de arriba y su firma queda registrada.';

let _n = 0;

/**
 * @param {{texto:string, version:string, alConfirmar:()=>Promise<void>|void}} p
 * @returns {{raiz:HTMLElement, textoEl:HTMLElement, boton:HTMLButtonElement, pasoFirmar:HTMLElement,
 *            confirmar:HTMLButtonElement, cancelar:HTMLButtonElement, caja:HTMLElement, estado:HTMLElement,
 *            rotulo:HTMLElement|null, textoMostrado:()=>string, bloquear:(b:boolean)=>void}}
 */
export function armarConfirmacionFirma({ texto, version, alConfirmar } = {}) {
  if (typeof texto !== 'string' || !texto) throw new TypeError('Falta el texto de la declaración.');
  if (typeof alConfirmar !== 'function') throw new TypeError('Falta qué hacer al confirmar la firma.');
  const id = 'odtFirma' + (++_n);
  const textoEl = h('blockquote', { class: 'odt-declaracion-texto', id: id + 'Texto', lang: 'es' });
  textoEl.textContent = texto;                 // EXACTO: lo que se guarda

  const boton = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Firmar', 'aria-describedby': id + 'Texto' });
  const confirmar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Confirmar firma', 'aria-describedby': id + 'Linea' });
  const cancelar = h('button', { type: 'button', class: 'odt-btn', text: 'Cancelar' });
  // Contenedor sin clase (sin `display` propio): `hidden` sí lo esconde en el navegador.
  const pasoFirmar = h('div', {}, h('div', { class: 'odt-acciones' }, boton));
  const caja = h('div', { class: 'odt-confirmar', role: 'group', 'aria-label': 'Confirmar la firma', hidden: true },
    h('p', { class: 'odt-parrafo', id: id + 'Linea', text: LINEA_CONFIRMAR }),
    h('div', { class: 'odt-acciones' }, confirmar, cancelar));
  const estado = h('p', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });

  let ocupado = false;     // «Confirmar firma» en curso
  let bloqueado = false;   // la firma ya se envió (o quedó pendiente): nada más se ofrece
  const actualizar = () => {
    boton.disabled = ocupado || bloqueado;
    confirmar.disabled = ocupado || bloqueado;
    cancelar.disabled = ocupado || bloqueado;
  };

  boton.addEventListener('click', () => {
    if (ocupado || bloqueado) return;
    estado.textContent = '';
    pasoFirmar.hidden = true;
    caja.hidden = false;
  });
  cancelar.addEventListener('click', () => {
    if (ocupado || bloqueado) return;
    caja.hidden = true;
    pasoFirmar.hidden = false;
    estado.textContent = '';
  });
  confirmar.addEventListener('click', async () => {
    // Se marca «ocupado» ANTES de cualquier espera: un segundo clic no vuelve a entrar.
    if (ocupado || bloqueado || caja.hidden) return;
    ocupado = true; actualizar();
    try { await alConfirmar(); } finally { ocupado = false; actualizar(); }
  });

  const rotulo = TEXTOS_APROBADOS ? null : h('p', { class: 'odt-borrador', role: 'note', text: ROTULO_BORRADOR });
  const raiz = h('section', { class: 'odt-declaracion', 'aria-label': 'Declaración' },
    rotulo,
    h('p', { class: 'odt-declaracion-version', text: 'Texto ' + (version || '') + ' (se guarda tal cual):' }),
    textoEl,
    pasoFirmar,
    caja,
    estado
  );

  return {
    raiz, textoEl, boton, pasoFirmar, confirmar, cancelar, caja, estado, rotulo,
    textoMostrado: () => textoEl.textContent,
    bloquear(b) { bloqueado = !!b; actualizar(); }
  };
}
