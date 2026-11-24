// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · pestaña «INDICADORES» (entrada y enrutado; solo administradores)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-23): trazabilidad con indicadores de cuántas ODT hay generadas, ejecutadas y
// cerradas por contratista, solo de las ODT donde él es RESPONSABLE O.D.T. Cortes a pedido, cada uno guardado
// con su fecha (el historial es la trazabilidad). Anclas:
//   · #indicadores          el último corte DE LA PERSONA DE LA SESIÓN (el de datos más recientes de su nombre); si
//                           no tiene ninguno, el último guardado, diciendo de quién es; si no hay cortes, cómo cargar
//                           el primero;
//   · #indicadores=<id>     un corte del historial;
//   · #indicadores-cargar   cargar un corte nuevo desde el CSV de Afinia (indicadores-cargar.js).
// La vista de un corte vive en indicadores-vista.js y sus gráficos en indicadores-graficos.js. Todo lo que se lee
// pasa por el repositorio de cortes (data/odt_afinia_cortes.js): el historial de 50 en 50, el corte anterior con su
// propia consulta, el último corte de un responsable y el estado de cada ODT en SGM, consultado POR N.º y de solo
// lectura (Por subsanar / Publicada en firma / Lista / Cerrada en SGM), solo al abrir una lista.
// Al terminar de montar una vista (al navegar, no al filtrar), su título —o el aviso «Corte guardado»— queda a la
// vista y con el foco: así el cambio de corte no pasa inadvertido. La página tiene una barra superior FIJA (la del
// menú, 64 px): lo que queda debajo de ella no se ve aunque esté dentro de la ventana, así que se cuenta como fuera
// (BARRA_FIJA_PX) y el CSS deja el destino 80 px por debajo del borde (scroll-margin-top).
// app.js carga este archivo con import() y pregunta si trae lo que usa (L-102): si no carga, el resto de la
// página sigue. Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe } from './comun.js';
import { crearRepositorioCortes } from '../../data/odt_afinia_cortes.js';
import { normalizarNombre, corteMasReciente, formasGuardadas } from '../../domain/odt_afinia_indicadores.js';
import { montarVistaCorte, BARRA_FIJA_PX } from './indicadores-vista.js';
import { montarCargar } from './indicadores-cargar.js';

export { crearRepositorioCortes };

export const TITULO_PESTANA = 'Indicadores';
export const INTRO = 'Cuántas ODT hay generadas, ejecutadas y cerradas por contratista, solo de las ODT donde usted es RESPONSABLE O.D.T. en Afinia (fechas previstas desde el 01/01/2026). Cada corte se hace a pedido, con el archivo que descarga de Afinia, y queda guardado con su fecha: el historial es la trazabilidad.';
export const VACIO = 'Todavía no hay cortes guardados. Descargue de Afinia el «Informe Seguimiento de Órdenes de Trabajo» en CSV y cárguelo aquí.';
export const SOLO_ADMIN = 'Los indicadores son solo para administradores.';

/**
 * Lleva a la pantalla la vista recién montada: el aviso inicial (p. ej. «Corte guardado: …») o, si no hay, su título.
 * Si su borde de arriba no se ve (fuera de la ventana o debajo de la barra fija de arriba), se desplaza hasta él (el
 * CSS lo deja debajo de la barra); después recibe el foco (sin volver a desplazar).
 * @param {HTMLElement} zona
 * @returns {HTMLElement|null} lo que quedó enfocado
 */
export function enfocarVista(zona) {
  if (!zona || typeof zona.querySelectorAll !== 'function') return null;
  const destino = zona.querySelectorAll('.odt-ind-aviso-inicial')[0] || zona.querySelectorAll('.odt-ind-titulo')[0];
  if (!destino) return null;
  if (destino.getAttribute('tabindex') == null) destino.setAttribute('tabindex', '-1');
  let fuera = true;
  try {
    const r = destino.getBoundingClientRect();
    const alto = globalThis.innerHeight || 0;
    fuera = !(r.top >= BARRA_FIJA_PX && r.top <= alto - 48);
  } catch (_) { fuera = true; }
  if (fuera && typeof destino.scrollIntoView === 'function') { try { destino.scrollIntoView({ block: 'start' }); } catch (_) { /* sin desplazamiento */ } }
  if (typeof destino.focus === 'function') {
    try { destino.focus({ preventScroll: true }); } catch (_) { try { destino.focus(); } catch (__) { /* sin foco */ } }
  }
  return destino;
}

/**
 * El último corte de la persona de la sesión: el de datos más recientes de su nombre (comparado normalizado), con la
 * consulta propia del repositorio (no depende de los 50 del historial) y, además, lo que haya en el historial.
 * La consulta compara EXACTO con el responsable tal como se guardó (como viene en el CSV: con Ñ si la trae), así que
 * se pregunta por cada forma en que puede estar guardado (formasGuardadas: la del historial, la de Afinia con Ñ y la
 * normalizada), no solo por la normalizada (que quita la Ñ).
 * @returns {Promise<object|null>}
 */
export async function ultimoPropio(repoCortes, historial, nombre) {
  if (!normalizarNombre(nombre)) return null;
  let delServidor = [];
  if (repoCortes && typeof repoCortes.ultimoDe === 'function') {
    delServidor = await Promise.all(formasGuardadas(nombre, historial).map((f) => Promise.resolve()
      .then(() => repoCortes.ultimoDe(f)).catch(() => null)));
  }
  return corteMasReciente([...delServidor, ...(historial || [])].filter(Boolean), nombre);
}

/**
 * Monta la vista pedida por el ancla.
 * @param {HTMLElement} contenedor
 * @param {{vista?:'ultimo'|'corte'|'cargar', corteId?:string, repoCortes:object, sesion:object, mensaje?:string,
 *          alIr:(ancla:string, mensaje?:string)=>void}} p
 */
export async function montarIndicadores(contenedor, p) {
  const { vista = 'ultimo', corteId, repoCortes, sesion, mensaje, alIr } = p;
  vaciar(contenedor);
  if (!sesion || !sesion.esAdmin) { contenedor.appendChild(aviso(SOLO_ADMIN, 'aviso')); return null; }
  if (sesion.legacy) {
    contenedor.appendChild(aviso('Su cuenta de administrador no tiene perfil en la plataforma: créelo para usar los indicadores.', 'aviso'));
    return null;
  }
  const cargando = h('p', { class: 'odt-cargando', text: 'Consultando los cortes guardados…' });
  contenedor.appendChild(cargando);
  let historial = [];
  let historialTope = false;
  let errorHistorial = null;
  try {
    const r = await repoCortes.listar();
    historial = (r && r.cortes) || []; historialTope = !!(r && r.tope);
  } catch (e) { errorHistorial = e; }

  if (vista === 'cargar') {
    cargando.remove();
    const zona = h('div', {});
    contenedor.appendChild(zona);
    const r = montarCargar(zona, { repoCortes, sesion, historial, alIr });
    if (errorHistorial) zona.appendChild(aviso('No se pudo leer el historial (para avisar si el archivo ya se guardó): ' + mensajeDe(errorHistorial), 'aviso'));
    enfocarVista(zona);
    return r;
  }

  // #indicadores: el último corte de la persona de la sesión (si no tiene, el último guardado, diciendo de quién es).
  let id = corteId;
  let nota = '';
  if (vista !== 'corte' && !errorHistorial && historial.length) {
    const propio = await ultimoPropio(repoCortes, historial, sesion.nombre);
    if (propio) id = propio.id;
    else {
      id = historial[0].id;
      nota = 'Todavía no hay cortes suyos' + (sesion.nombre ? ' (de ' + sesion.nombre + ')' : '') + ': se muestra el último guardado, de ' + (historial[0].responsable || '—') + '.';
    }
  }
  cargando.remove();

  contenedor.appendChild(h('p', { class: 'odt-mini', text: INTRO }));
  if (errorHistorial) {
    contenedor.appendChild(aviso(mensajeDe(errorHistorial), 'error'));
    contenedor.appendChild(h('div', { class: 'odt-acciones' },
      h('button', { type: 'button', class: 'odt-btn', text: 'Reintentar', onclick: () => montarIndicadores(contenedor, p) }),
      h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Cargar un corte', onclick: () => alIr('indicadores-cargar') })));
    return null;
  }
  if (vista !== 'corte' && !historial.length) {
    if (mensaje) contenedor.appendChild(aviso(mensaje, 'ok'));
    contenedor.appendChild(h('p', { class: 'odt-vacio', text: VACIO }));
    contenedor.appendChild(h('div', { class: 'odt-acciones' },
      h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Cargar el primer corte', onclick: () => alIr('indicadores-cargar') })));
    return { historial };
  }
  const leyendo = h('p', { class: 'odt-cargando', text: 'Leyendo el corte guardado…' });
  contenedor.appendChild(leyendo);
  let r;
  try {
    r = await repoCortes.leer(id);
  } catch (e) {
    leyendo.remove();
    contenedor.appendChild(aviso(mensajeDe(e), 'error'));
    contenedor.appendChild(h('div', { class: 'odt-acciones' },
      h('button', { type: 'button', class: 'odt-btn', text: 'Ver el último corte', onclick: () => alIr('indicadores') })));
    return null;
  }
  leyendo.remove();
  const zona = h('div', { class: 'odt-ind-raiz' });
  contenedor.appendChild(zona);
  const vistaCorte = montarVistaCorte(zona, {
    ...r, historial, historialTope, repoCortes, alIr, mensaje, nota,
    masHistorial: (antesDe) => repoCortes.listar({ antesDe }),
    cargarSgm: typeof repoCortes.estadoSgm === 'function' ? (nros) => repoCortes.estadoSgm(nros) : null
  });
  enfocarVista(zona);
  return { historial, corte: r.corte, vista: vistaCorte };
}
