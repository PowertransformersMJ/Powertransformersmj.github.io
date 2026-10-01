// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · arranque y navegación · `99 §122`
// ──────────────────────────────────────────────────────────────
// Lee UNA vez el parque, la homologación, el catálogo y los umbrales CRG activos; la lista y
// el detalle comparten ese contexto. Navegación por hash: '#mat=MATRÍCULA' abre el detalle
// (con '&desde=…&hasta=…' opcional), cualquier otro hash vuelve a la lista. El botón «atrás»
// del navegador funciona. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, esperarSesion } from './dom.js';
import { listarV2 } from '../../data/transformadores.js';
import { diagnosticoLectura } from '../../domain/limites_lectura.js';
import { leerHomologacion, leerCatalogo } from '../../data/scada_carga.js';
import { obtenerUmbralesActivos } from '../../data/umbrales_salud.js';
import { montarLista } from './lista.js';
import { montarDetalle } from './detalle.js';

const $ = (id) => document.getElementById(id);
const ctx = { parque: [], truncado: false, homologacion: null, catalogo: null, umbrales: null, esAdmin: false, avisos: [] };
let lista = null;
let detalle = null;

function leerHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  return { mat: p.get('mat'), id: p.get('id'), desde: p.get('desde'), hasta: p.get('hasta'), mes: p.get('mes') };
}

function navegar() {
  const h = leerHash();
  const vL = $('vista-lista'); const vD = $('vista-detalle');
  if (h.mat) {
    vL.hidden = true; vD.hidden = false;
    detalle.abrir(h.mat, { id: h.id, mes: h.mes, desde: h.desde, hasta: h.hasta });
  } else {
    vD.hidden = true; vL.hidden = false;
    detalle.cerrar();
    lista.mostrar(h.mes);
  }
}

async function arrancar() {
  const sesion = await esperarSesion();
  ctx.esAdmin = !!(sesion && sesion.profile && sesion.profile.rol === 'admin');
  const [p, h, c, u] = await Promise.allSettled([listarV2({ limite: 500 }), leerHomologacion(), leerCatalogo(), obtenerUmbralesActivos()]);
  if (p.status !== 'fulfilled') {
    console.warn('[cargabilidad-scada] parque', p.reason);
    poner($('vista-lista'), el('div', { class: 'cs-estado', role: 'alert' }, 'No se pudo leer el parque de transformadores (revise la conexión).',
      el('br'), el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => location.reload() }, 'Reintentar')));
    return;
  }
  ctx.parque = p.value;
  ctx.truncado = diagnosticoLectura('transformadores', p.value.length, 500).truncado;
  if (h.status === 'fulfilled' && h.value.estado === 'ok') ctx.homologacion = h.value.datos;
  else if (h.status !== 'fulfilled' || h.value.estado === 'fallo') ctx.avisos.push('No se pudo leer la homologación: ninguna cifra se puede calcular por ahora (revise la conexión y recargue).');
  if (c.status === 'fulfilled' && c.value.estado === 'ok') ctx.catalogo = c.value.datos;
  else if (c.status !== 'fulfilled' || c.value.estado === 'fallo') ctx.errorCatalogo = true;
  // Sin documento de umbrales propio, las bandas de referencia del MO.00418 SON las vigentes (verificado en
  // producción el 2026-10-01): no se avisa nada; la franja de la lista muestra siempre las bandas en uso.
  ctx.umbrales = u.status === 'fulfilled' ? u.value : null;
  // «Volver» regresa a la lista tal como estaba (atrás) si se llegó desde ella; si se entró
  // directo con un enlace '#mat=…', va a la lista sin salir de la página.
  let desdeLista = false;
  // Se abre con el MES de la lista (misma ventana, misma cifra) y el id del equipo (dos equipos
  // con la misma matrícula no se confunden).
  const abrir = (mat, mes, id) => {
    desdeLista = true;
    location.hash = 'mat=' + encodeURIComponent(mat) + (id ? '&id=' + encodeURIComponent(id) : '') + (mes ? '&mes=' + mes : '');
  };
  const volver = () => { if (desdeLista) { desdeLista = false; history.back(); } else location.hash = ''; };
  lista = montarLista($('vista-lista'), ctx, { alAbrir: abrir });
  detalle = montarDetalle($('vista-detalle'), ctx, { alVolver: volver });
  window.addEventListener('hashchange', navegar);
  navegar();
}

arrancar().catch((e) => {
  console.warn('[cargabilidad-scada] arranque', e);
  poner($('vista-lista'), el('div', { class: 'cs-estado', role: 'alert' }, 'No se pudo abrir la página.', el('br'),
    el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => location.reload() }, 'Reintentar')));
});
