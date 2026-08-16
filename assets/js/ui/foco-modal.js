// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — UI · FOCO DE MODALES (utilidad compartida)
// ──────────────────────────────────────────────────────────────────────────────
// QUÉ ES
// Una sola pieza reutilizable que le da a cualquier ventana modal las tres
// cosas que exige un diálogo accesible y que hoy NINGUNA de las del sitio
// tiene, pese a declarar `aria-modal="true"`:
//
//   1. ATRAPA EL FOCO — con el tabulador no te sales del diálogo a la página
//      de detrás. Al llegar al último control, Tab vuelve al primero (y
//      Shift+Tab, al revés).
//   2. CIERRA CON ESCAPE — una sola vía de cierre para todos los diálogos.
//   3. DEVUELVE EL FOCO — al cerrar, el foco regresa al elemento que abrió el
//      diálogo (el botón/fila que se pulsó), no al principio de la página.
//
// POR QUÉ IMPORTA
// `aria-modal="true"` le PROMETE al lector de pantalla que el resto de la
// página está inerte. Si el foco se escapa, el usuario acaba tabulando por
// controles que su lector le dice que no existen: peor que no declararlo.
//
// CÓMO SE USA (patrón de 3 líneas)
//
//     import { atraparFoco } from '../foco-modal.js';   // ajusta la ruta
//
//     let trampa = null;
//
//     function abrir() {
//       modal.classList.add('is-on');
//       modal.setAttribute('aria-hidden', 'false');
//       trampa = atraparFoco(modal, { alCerrar: cerrar });
//     }
//
//     function cerrar() {
//       if (trampa) { trampa.soltar(); trampa = null; }   // devuelve el foco
//       modal.classList.remove('is-on');
//       modal.setAttribute('aria-hidden', 'true');
//     }
//
// `alCerrar` es lo que se llama cuando el usuario pulsa Escape. `soltar()` es
// idempotente: llamarlo dos veces no rompe nada, así que da igual si el cierre
// llega por Escape, por el botón «Cerrar» o por código.
//
// LOS OTROS NUEVE DIÁLOGOS (pendiente, uno a uno — NO de golpe)
// Todos declaran ya `role="dialog" aria-modal="true"`; les falta exactamente
// este cableado. Localízalos con:
//     grep -rn 'aria-modal="true"' assets/js pages admin
// Para los que viven en HTML (admin/ordenes.html, admin/inventario.html,
// admin/suministros-*.html, pages/contrato-info.html, pages/parque-
// transformadores.html, pages/calculo-refrigeracion.html) el enganche va en el
// script de la página, donde ya se hace `hidden = false` / `.show()`. Para los
// que se generan en JS (assets/js/calculo-refrigeracion.js,
// assets/js/ui/pruebas/modal-upsert.js) va junto al `appendChild` del overlay.
// Reglas al migrar cada uno:
//   · el diálogo debe estar VISIBLE antes de llamar a `atraparFoco` (si está
//     `hidden`, sus controles no son enfocables y no habría a qué saltar);
//   · si la página ya tenía su propio manejador de Escape, quítalo o pásalo
//     como `alCerrar` — no dejes los dos, o el diálogo se cerraría dos veces;
//   · `soltar()` SIEMPRE, también en las salidas por error.
//
// Sin dependencias y sin tocar el DOM al importarse: la parte con lógica
// (`calcularSiguienteFoco`) es pura y está cubierta por
// `tests/foco_modal.test.js`.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Selector de los elementos que el navegador considera tabulables.
 * `[tabindex="-1"]` queda FUERA a propósito: es enfocable por código pero no
 * por tabulador, y meterlo aquí haría que Tab se detuviera en contenedores.
 */
export const SELECTOR_FOCALIZABLES = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Decide a qué elemento hay que mover el foco cuando se pulsa Tab dentro de
 * un diálogo. Es la ÚNICA lógica de la utilidad, y es pura: recibe una lista
 * y devuelve un elemento o `null`. No toca el DOM — por eso se puede probar.
 *
 * `null` significa «no interceptes»: deja que el navegador haga su recorrido
 * normal, que dentro del diálogo ya es el correcto.
 *
 * @param {object}  opciones
 * @param {Array}   opciones.focalizables  elementos tabulables del diálogo, en orden
 * @param {*}       opciones.activo        elemento que tiene el foco ahora
 * @param {boolean} opciones.haciaAtras    true si se pulsó Shift+Tab
 * @returns {*|null} elemento a enfocar, o null si no hay que intervenir
 */
export function calcularSiguienteFoco({ focalizables, activo, haciaAtras = false } = {}) {
  const lista = Array.isArray(focalizables) ? focalizables.filter(Boolean) : [];
  if (lista.length === 0) return null;

  const primero = lista[0];
  const ultimo = lista[lista.length - 1];
  const i = lista.indexOf(activo);

  // El foco está fuera del diálogo (o en el contenedor, que no es tabulable):
  // lo traemos de vuelta al extremo que corresponda al sentido del tabulador.
  if (i === -1) return haciaAtras ? ultimo : primero;

  // Un solo control: Tab siempre se queda en él (si no, se escaparía).
  if (lista.length === 1) return primero;

  if (!haciaAtras && activo === ultimo) return primero;   // del final al principio
  if (haciaAtras && activo === primero) return ultimo;    // del principio al final

  return null;   // en medio de la lista: el navegador ya hace lo correcto
}

/** ¿El elemento está realmente a la vista? Un control oculto no es tabulable. */
function estaVisible(el) {
  if (!el || typeof el.getClientRects !== 'function') return true;
  if (el.hasAttribute && el.hasAttribute('hidden')) return false;
  if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
  return el.getClientRects().length > 0;
}

/** Elementos tabulables VISIBLES del diálogo, en orden de documento. */
function focalizablesDe(dialogo) {
  if (!dialogo || typeof dialogo.querySelectorAll !== 'function') return [];
  return Array.prototype.slice.call(dialogo.querySelectorAll(SELECTOR_FOCALIZABLES))
    .filter(estaVisible);
}

/**
 * Atrapa el foco dentro de `dialogo` hasta que se llame a `soltar()`.
 *
 * @param {Element} dialogo  el contenedor del diálogo (el del `role="dialog"`)
 * @param {object}  [opciones]
 * @param {Function} [opciones.alCerrar]   se llama al pulsar Escape
 * @param {Element}  [opciones.devolverFocoA]  a dónde vuelve el foco al soltar
 *                    (por defecto, el elemento que lo tenía al abrir)
 * @param {Element|string} [opciones.autoFoco]  qué enfocar al abrir: un elemento
 *                    o un selector dentro del diálogo (por defecto, el primer
 *                    control tabulable)
 * @param {boolean}  [opciones.escape=true]  poner a false si el diálogo no debe
 *                    poder cerrarse con Escape (p. ej. una confirmación crítica)
 * @returns {{soltar: Function, refrescar: Function}}
 */
export function atraparFoco(dialogo, opciones = {}) {
  const doc = (dialogo && dialogo.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!dialogo || !doc) return { soltar() {}, refrescar() {} };

  const conEscape = opciones.escape !== false;
  const origen = opciones.devolverFocoA || doc.activeElement || null;
  let vivo = true;

  const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) {} } };

  function alPulsarTecla(ev) {
    if (!vivo) return;
    if (conEscape && (ev.key === 'Escape' || ev.key === 'Esc')) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof opciones.alCerrar === 'function') opciones.alCerrar(ev);
      return;
    }
    if (ev.key !== 'Tab') return;
    const destino = calcularSiguienteFoco({
      focalizables: focalizablesDe(dialogo),
      activo: doc.activeElement,
      haciaAtras: !!ev.shiftKey
    });
    if (!destino) return;
    ev.preventDefault();
    enfocar(destino);
  }

  // En fase de captura: así llegamos antes que los manejadores de la página y
  // el foco no se escapa aunque otro script también escuche `keydown`.
  doc.addEventListener('keydown', alPulsarTecla, true);

  /** Lleva el foco al primer control (o al indicado en `autoFoco`). */
  function refrescar() {
    let inicial = opciones.autoFoco;
    if (typeof inicial === 'string') inicial = dialogo.querySelector(inicial);
    if (!inicial || !estaVisible(inicial)) inicial = focalizablesDe(dialogo)[0];
    // Sin ningún control tabulable, enfocamos el propio diálogo para que el
    // lector de pantalla anuncie su etiqueta.
    if (!inicial) {
      if (!dialogo.hasAttribute('tabindex')) dialogo.setAttribute('tabindex', '-1');
      inicial = dialogo;
    }
    enfocar(inicial);
  }
  refrescar();

  return {
    /** Suelta el foco y lo devuelve al origen. Idempotente. */
    soltar() {
      if (!vivo) return;
      vivo = false;
      doc.removeEventListener('keydown', alPulsarTecla, true);
      if (origen && doc.contains && doc.contains(origen)) enfocar(origen);
    },
    refrescar
  };
}

export default atraparFoco;
