// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · quién va en «Elaboración» por defecto según la SESIÓN (`99 §120`)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-30): «en los usuarios de Carlos y Jorge Rhenals aparece
// solo mi nombre en Elaboró; necesito que aparezca el de ellos, Carlos cuando sea la
// sesión con su usuario y Jorge Rhenals cuando sea con su usuario, con sus firmas y
// todo. Yo apruebo y autorizo esta forma».
//
// Mientras nadie elija a otra persona, la casilla «Elaboración» lleva a quien tiene la
// sesión SI es de la lista de Elaboración (`FIRMANTES.elab`, `§89`). La página dice quién
// es con el nombre de la LISTA que le corresponde (su clave en el permiso de Fichas,
// `§119`): sus perfiles no se llaman como en la lista (`§117.1`) y una comparación
// aproximada no vale en una firma (`§71.4`). Sin eso, el primero de la lista (como antes).
//
// Es estado de la PÁGINA (uno por pestaña, nunca se guarda en el borrador): lo leen igual
// la pantalla, el Excel y el estampado, porque todos pasan por `fichas_firmantes.js`.
// Archivo NUEVO (L-102): un `fichas_firmantes.js` viejo en caché no lo importa y sigue
// con el primero de la lista. Cero DOM, cero Firebase.
// ══════════════════════════════════════════════════════════════════════════════

let nombreDeLaSesion = '';

/**
 * Fija (o borra, con '') el nombre de la lista de quien tiene la sesión. Solo sirve si ese
 * nombre está en la lista de Elaboración: si no, `fichas_firmantes.js` sigue con el primero.
 * @param {string} nombre  p. ej. 'CARLOS MARTELO'
 */
export function fijarElaboradorDeLaSesion(nombre) {
  nombreDeLaSesion = typeof nombre === 'string' ? nombre.trim().toUpperCase() : '';
}

/** El nombre de la lista de quien tiene la sesión, o '' si no se sabe. */
export function elaboradorDeLaSesion() { return nombreDeLaSesion; }
