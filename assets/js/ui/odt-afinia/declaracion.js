// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · el ACUERDO + casilla + contraseña (habilitarse)
// ──────────────────────────────────────────────────────────────────────────────
// Lo que la persona lee es EXACTAMENTE lo que se guarda: el texto va con
// textContent (sin HTML, sin recortes) desde la misma cadena que se escribirá
// (comité W-11, legal: «el textContent de la declaración que se muestra es
// idéntico a la cadena que se guarda»). La casilla «Acepto» empieza DESMARCADA y
// el botón queda inactivo hasta marcarla y escribir la contraseña.
// La contraseña la escribe el titular; se borra del campo al usarla.
// Desde el 2026-11-21 (decisión del Ingeniero: la contraseña solo al iniciar sesión)
// sirve SOLO para habilitarse (aceptar el acuerdo, una vez). La firma usa
// confirmar-firma.js: la declaración completa + «Firmar» → «Confirmar firma», sin
// casilla ni contraseña. (Una firmar.js vieja de la caché aún podría usar esta pieza:
// sigue funcionando igual, L-102.)
// Mientras el Ingeniero no apruebe los textos (TEXTOS_APROBADOS = false), encima va
// el rótulo «Borrador · pendiente del Ingeniero» (W-11, modo paso a paso).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { h } from './comun.js';
import { TEXTOS_APROBADOS, ROTULO_BORRADOR } from '../../domain/odt_afinia_textos.js';

let _n = 0;

/**
 * @param {{texto:string, version:string, etiquetaCasilla?:string, etiquetaBoton?:string,
 *          alConfirmar:(contrasena:string)=>Promise<void>|void}} p
 * @returns {{raiz:HTMLElement, textoEl:HTMLElement, casilla:HTMLInputElement, contrasena:HTMLInputElement,
 *            boton:HTMLButtonElement, estado:HTMLElement, textoMostrado:()=>string, bloquear:(b:boolean)=>void}}
 */
export function armarDeclaracion({ texto, version, etiquetaCasilla, etiquetaBoton, alConfirmar } = {}) {
  if (typeof texto !== 'string' || !texto) throw new TypeError('Falta el texto de la declaración.');
  const id = 'odtDecl' + (++_n);
  const textoEl = h('blockquote', { class: 'odt-declaracion-texto', id: id + 'Texto', lang: 'es' });
  textoEl.textContent = texto;                 // EXACTO: lo que se guarda

  const casilla = h('input', { type: 'checkbox', id: id + 'Casilla', class: 'odt-casilla', 'aria-describedby': id + 'Texto' });
  casilla.checked = false;                     // NUNCA premarcada
  const contrasena = h('input', {
    type: 'password', id: id + 'Clave', class: 'odt-campo', autocomplete: 'current-password',
    placeholder: 'Su contraseña de SGM'
  });
  const boton = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', disabled: true, text: etiquetaBoton || 'Firmar' });
  const estado = h('p', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });

  let ocupado = false;
  const actualizar = () => { boton.disabled = ocupado || !casilla.checked || !contrasena.value; };
  casilla.addEventListener('change', actualizar);
  contrasena.addEventListener('input', actualizar);

  boton.addEventListener('click', async () => {
    if (boton.disabled || !casilla.checked || !contrasena.value) return;
    const clave = contrasena.value;
    contrasena.value = '';                     // no queda en pantalla
    ocupado = true; actualizar();
    try { await alConfirmar(clave); } finally { ocupado = false; actualizar(); }
  });

  const rotulo = TEXTOS_APROBADOS ? null : h('p', { class: 'odt-borrador', role: 'note', text: ROTULO_BORRADOR });
  const raiz = h('section', { class: 'odt-declaracion', 'aria-label': 'Declaración' },
    rotulo,
    h('p', { class: 'odt-declaracion-version', text: 'Texto ' + (version || '') + ' (se guarda tal cual):' }),
    textoEl,
    h('div', { class: 'odt-declaracion-acepto' },
      casilla,
      h('label', { htmlFor: id + 'Casilla', text: etiquetaCasilla || 'Leí la declaración y la acepto.' })
    ),
    h('div', { class: 'odt-declaracion-clave' },
      h('label', { htmlFor: id + 'Clave', text: 'Contraseña (se le pide para aceptar el acuerdo; no se guarda):' }),
      contrasena
    ),
    h('div', { class: 'odt-acciones' }, boton),
    estado
  );

  return {
    raiz, textoEl, casilla, contrasena, boton, estado, rotulo,
    textoMostrado: () => textoEl.textContent,
    bloquear(b) { ocupado = !!b; actualizar(); casilla.disabled = !!b; contrasena.disabled = !!b; }
  };
}
