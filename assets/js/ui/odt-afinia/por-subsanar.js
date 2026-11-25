// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · pestaña «POR SUBSANAR» (lista y enrutado)
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero (2026-11-21): el AZT asignado ve, en SU sesión, las ODT de Afinia
// con inconsistencias por corregir antes de poder firmarlas y cerrarlas, con cada punto
// pendiente; el administrador las registra y verifica lo que el AZT marca «subsanado».
//   · Lista (#subsanar): una tarjeta por ODT con N.º, subestación, fecha prevista, AZT y el
//     conteo Pendientes / Subsanados por verificar / Verificados; insignia «Lista para publicar»
//     cuando todos están verificados. El admin ve además «Registrar ODT por subsanar».
//   · Detalle (#subsanar=<id>): subsanar-detalle.js.
//   · Registrar (#subsanar-nueva, solo admin): subsanar-registrar.js.
// La lista y el contador de la pestaña salen de las obs (su `resumen`), sin leer los puntos. Desde el 2026-11-24 el
// contador lo dice con palabras («12 ODT · 40 puntos» al AZT; «12 ODT · 5 por verificar» al administrador): lo arma
// domain/odt_afinia_obs_contador.js (archivo NUEVO, L-102) y viaja en `contador` junto a {total, deMiLado} de antes.
// «Descargar Excel» (pedido del Ingeniero del 2026-11-24): sobre la lista (si hay alguna ODT), para quien
// ve la pestaña; vive en subsanar-excel.js, que entra con import() (L-102): si no carga, la lista sigue igual.
// app.js carga este archivo con import() y pregunta si existe montarPorSubsanar (L-102): si no
// carga, el resto de la página sigue. Archivo NUEVO a propósito (L-102): a sus vecinos de antes
// (comun.js) solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe } from './comun.js';
import { crearRepositorioObs } from '../../data/odt_afinia_obs.js';
import { TOPES_OBS, ordenarLista, pendientesDeMiLado, textoConteo } from '../../domain/odt_afinia_obs.js';
import { contadorPorSubsanar } from '../../domain/odt_afinia_obs_contador.js';
import { montarDetalleObs, chipObs } from './subsanar-detalle.js';
import { montarRegistrarObs } from './subsanar-registrar.js';

export { crearRepositorioObs, chipObs };

export const TITULO_PESTANA = 'Por subsanar';
export const INTRO_AZT = 'Las ODT de Afinia que tienen puntos por corregir antes de poder firmarlas y cerrarlas. Abra cada una, corrija lo que falta y márquelo «subsanado» con una nota: el administrador lo verifica.';
export const INTRO_ADMIN = 'Las ODT de Afinia con inconsistencias por corregir antes de publicarlas para firma. Cuando todos sus puntos estén verificados, quedan «Lista para publicar»: se publican en «Publicar ODT».';
export const VACIO_AZT = 'No tiene ODT por subsanar.';
export const VACIO_ADMIN = 'Todavía no hay ODT por subsanar registradas.';

/** «Descargar Excel» vive en un archivo NUEVO: se carga con import() y se pregunta si trae lo que se usa (L-102). */
let _excel = null;
function cargarExcel() {
  if (!_excel) {
    _excel = import('./subsanar-excel.js')
      .then((m) => (m && typeof m.bloqueDescargaExcel === 'function' ? m : null))
      .catch(() => null);
  }
  return _excel;
}

/**
 * Lo que viaja al contador de la pestaña: {total, deMiLado} (de antes) y `contador` (ODT y puntos, con palabras; si la
 * lista llegó al tope de la consulta, como mínimo: «12+ ODT»).
 */
const cuentaDe = (lista, sesion, tope) => ({
  total: lista.length, deMiLado: pendientesDeMiLado(lista, sesion), contador: contadorPorSubsanar(lista, sesion, { tope: tope === true })
});

/**
 * Cuántas obs ve la sesión y cuántos puntos le tocan «de su lado» (para la pestaña).
 * @returns {Promise<{total:number, deMiLado:number, contador:{odts:number, puntos:number, tope:boolean, texto:string, corto:string, resto:string, etiqueta:string}}>}
 */
export async function contarDeMiLado({ repoObs, sesion }) {
  const { lista, tope } = await repoObs.listar();
  return cuentaDe(lista, sesion, tope);
}

/**
 * Monta la vista pedida por el ancla.
 * @param {HTMLElement} contenedor
 * @param {{vista:'lista'|'detalle'|'nueva', obsId?:string, repoObs:object, repoOdt?:object, sesion:object,
 *          mensaje?:string, alIr:(ancla:string, mensaje?:string)=>void, alContar?:(datos?:{total:number, deMiLado:number, contador:object})=>void}} p
 */
export async function montarPorSubsanar(contenedor, p) {
  const { vista = 'lista', sesion } = p;
  if (vista === 'detalle') return montarDetalleObs(contenedor, p);
  if (vista === 'nueva') {
    if (!sesion || !sesion.esAdmin) {
      vaciar(contenedor);
      contenedor.appendChild(aviso('Solo un administrador registra ODT por subsanar.', 'aviso'));
      return null;
    }
    return montarRegistrarObs(contenedor, p);
  }
  return montarListaObs(contenedor, p);
}

/** La lista de ODT por subsanar de la sesión. */
export async function montarListaObs(contenedor, { repoObs, sesion, mensaje, alIr, alContar }) {
  vaciar(contenedor);
  contenedor.appendChild(h('h2', { class: 'odt-subtitulo', text: 'ODT por subsanar' }));
  contenedor.appendChild(h('p', { class: 'odt-mini', text: sesion.esAdmin ? INTRO_ADMIN : INTRO_AZT }));
  if (mensaje) contenedor.appendChild(aviso(mensaje, 'ok'));
  if (sesion.esAdmin && !sesion.legacy) {
    contenedor.appendChild(h('div', { class: 'odt-acciones' },
      h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Registrar ODT por subsanar', onclick: () => alIr('subsanar-nueva') })));
  }
  const cargando = h('p', { class: 'odt-cargando', text: 'Consultando las ODT por subsanar…' });
  contenedor.appendChild(cargando);
  let datos;
  try {
    datos = await repoObs.listar();
  } catch (e) {
    cargando.remove();
    contenedor.appendChild(aviso(mensajeDe(e), 'error'));
    contenedor.appendChild(h('div', { class: 'odt-acciones' },
      h('button', { type: 'button', class: 'odt-btn', text: 'Reintentar', onclick: () => montarListaObs(contenedor, { repoObs, sesion, mensaje, alIr, alContar }) })));
    return null;
  }
  cargando.remove();
  const lista = ordenarLista(datos.lista);
  if (typeof alContar === 'function') alContar(cuentaDe(lista, sesion, datos.tope));
  if (!lista.length) {
    contenedor.appendChild(h('p', { class: 'odt-vacio', text: sesion.esAdmin ? VACIO_ADMIN : VACIO_AZT }));
    return { lista };
  }
  // «Descargar Excel»: el lugar se reserva ya (sobre la lista); el bloque llega cuando carga su archivo.
  const zonaExcel = h('div', {});
  contenedor.appendChild(zonaExcel);
  contenedor.appendChild(h('ul', { class: 'odt-filas' }, lista.map((o) => {
    const chip = chipObs(o);
    const meta = [o.subestacion, o.equipo, o.fechaPrevista ? 'prevista ' + o.fechaPrevista : '', o.azt && o.azt.nombre ? 'AZT: ' + o.azt.nombre : '']
      .filter(Boolean).join(' · ');
    return h('li', { class: 'odt-fila' },
      h('button', { type: 'button', class: 'odt-fila-btn', onclick: () => alIr('subsanar=' + o.id) },
        h('span', { class: 'odt-fila-nro', text: 'ODT N.º ' + o.nro }),
        h('span', { class: chip.clase, text: chip.texto }),
        h('span', { class: 'odt-fila-meta', text: meta || '—' }),
        h('span', { class: 'odt-fila-meta odt-obs-conteo', text: textoConteo(o) })));
  })));
  if (datos.tope) contenedor.appendChild(aviso('Se muestran las ' + TOPES_OBS.listado + ' más recientes.', 'info'));
  const mx = await cargarExcel();
  if (mx) {
    try { zonaExcel.appendChild(mx.bloqueDescargaExcel({ repoObs })); } catch (_) { /* sin el bloque: la lista sigue */ }
  }
  return { lista };
}
