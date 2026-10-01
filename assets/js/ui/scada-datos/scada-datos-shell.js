// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Datos SCADA (administración) · arranque · `99 §122`
// ──────────────────────────────────────────────────────────────
// Lee el parque, la homologación vigente y el catálogo; monta las tres pestañas.
// «Cargar mes» se habilita solo con una homologación vigente. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, pestanas, esperarSesion } from '../cargabilidad-scada/dom.js';
import { listarV2 } from '../../data/transformadores.js';
import { diagnosticoLectura } from '../../domain/limites_lectura.js';
import { leerHomologacion, leerCatalogo, listarCargas, listarRegistroHomologacion, olvidarCache } from '../../data/scada_carga.js';
import { puedeAdministrar } from '../../data/scada_carga_admin.js';
import { montarHomologacion } from './homologacion.js';
import { montarCargaMes } from './importar-mes.js';
import { formatoCO, nombreMes } from '../../domain/scada_carga_fecha.js';

const $ = (id) => document.getElementById(id);
const estado = { parque: [], truncado: false, homologacion: null, catalogo: null };

async function cargarTodo() {
  olvidarCache();
  const [p, h, c] = await Promise.allSettled([listarV2({ limite: 500 }), leerHomologacion(), leerCatalogo()]);
  if (p.status === 'fulfilled') {
    estado.parque = p.value;
    estado.truncado = diagnosticoLectura('transformadores', p.value.length, 500).truncado;
  } else throw new Error('No se pudo leer el parque de transformadores.');
  estado.homologacion = h.status === 'fulfilled' && h.value.estado === 'ok' ? h.value.datos : null;
  estado.errorHomologacion = h.status !== 'fulfilled' || h.value.estado === 'fallo';
  estado.catalogo = c.status === 'fulfilled' && c.value.estado === 'ok' ? c.value.datos : null;
}

async function pintarRegistro() {
  const cont = $('panel-registro');
  poner(cont, el('div', { class: 'cs-estado', role: 'status' }, 'Consultando…'));
  try {
    const [cargas, cambios] = await Promise.all([listarCargas(20), listarRegistroHomologacion(20)]);
    const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
    const t1 = el('table', { class: 'cs-tabla' }, el('caption', {}, 'Últimas cargas de meses'),
      el('thead', {}, el('tr', {}, ['Abierta', 'Meses', 'Carpeta', 'Estado', 'Escrituras', 'Por'].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, cargas.length ? cargas.map((x) => {
        const interrumpida = x.estado === 'iniciada' && ms(x.abiertaEn) && Date.now() - ms(x.abiertaEn) > 6 * 3600e3;
        return el('tr', {},
          el('td', {}, formatoCO(ms(x.abiertaEn))),
          el('td', {}, (x.meses || []).map(nombreMes).join(', ')),
          el('td', {}, x.carpeta || ''),
          el('td', {}, interrumpida ? 'interrumpida' : (x.estado || '')),
          el('td', {}, x.escrituras ? (x.escrituras.series || 0) + ' series' : '—'),
          el('td', {}, (x.por && x.por.nombre) || ''));
      }) : el('tr', {}, el('td', { colspan: 6 }, 'Todavía no hay cargas.'))));
    const t2 = el('table', { class: 'cs-tabla' }, el('caption', {}, 'Últimos cambios de la homologación'),
      el('thead', {}, el('tr', {}, ['Fecha', 'Tipo', 'Fila', 'Por'].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, cambios.length ? cambios.map((x) => el('tr', {},
        el('td', {}, formatoCO(ms(x.en))),
        el('td', {}, { carga_excel: 'Excel cargado', confirmacion: 'Confirmación', reapertura: 'Reapertura' }[x.tipo] || x.tipo),
        el('td', {}, x.tipo === 'carga_excel' && x.resumen ? x.resumen.total + ' filas (' + x.resumen.nuevas + ' nuevas, ' + x.resumen.cambiadas + ' cambiadas, ' + x.resumen.retiradas + ' retiradas)'
          : ((estado.homologacion && estado.homologacion.filas && estado.homologacion.filas[x.filaId] && estado.homologacion.filas[x.filaId].matricula) || x.filaId || '')),
        el('td', {}, (x.por && x.por.nombre) || ''))) : el('tr', {}, el('td', { colspan: 4 }, 'Todavía no hay cambios.'))));
    poner(cont, el('div', { class: 'cs-panel' }, el('div', { class: 'cs-tabla-caja' }, t1)), el('div', { class: 'cs-panel' }, el('div', { class: 'cs-tabla-caja' }, t2)));
  } catch (e) {
    console.warn('[scada-datos] registro', e);
    poner(cont, el('div', { class: 'cs-estado', role: 'alert' }, 'No se pudo consultar el registro (revise la conexión).',
      el('br'), el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: pintarRegistro }, 'Reintentar')));
  }
}

/** El mismo aviso en las tres pestañas (ninguna queda en «Cargando…»). `hijos` crea nodos NUEVOS en cada llamada. */
function avisoEnTodas(hijos) {
  for (const id of ['panel-homologacion', 'panel-cargar', 'panel-registro']) poner($(id), el('div', { class: 'cs-estado', role: 'alert' }, ...hijos()));
}

async function arrancar() {
  await esperarSesion();
  // Las pestañas responden SIEMPRE, también cuando la página no puede seguir (revisión del 10-01).
  let registroListo = false;
  const tabs = pestanas(document.querySelector('.cs-tabs'), (id) => { if (id === 'tab-registro' && registroListo) pintarRegistro(); });
  if (!puedeAdministrar()) {
    avisoEnTodas(() => ['Solo un administrador con perfil puede cargar datos SCADA.']);
    return;
  }
  try { await cargarTodo(); }
  catch (e) {
    avisoEnTodas(() => [(e && e.message) || 'No se pudo leer la información.',
      el('br'), el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => location.reload() }, 'Reintentar')]);
    return;
  }
  const refrescar = async () => { await cargarTodo(); homologacion.pintar(estado); carga.pintar(estado); };
  const homologacion = montarHomologacion($('panel-homologacion'), { alCambiar: refrescar });
  const carga = montarCargaMes($('panel-cargar'), { alTerminar: refrescar });
  homologacion.pintar(estado);
  carga.pintar(estado);
  registroListo = true;
  const desdeHash = { '#tab=cargar': 'tab-cargar', '#tab=registro': 'tab-registro' }[location.hash];
  if (desdeHash) tabs.activar(desdeHash);
  else if (document.getElementById('tab-registro').getAttribute('aria-selected') === 'true') pintarRegistro();
}

arrancar();
