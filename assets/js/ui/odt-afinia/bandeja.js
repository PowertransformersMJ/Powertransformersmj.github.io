// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · BANDEJA
// ──────────────────────────────────────────────────────────────────────────────
// Pestañas: Mi turno · En curso · Listas · Cerradas · Firmadas por mí · Anuladas y reemplazadas.
// «Cerradas» (2026-11-21): las que el admin registró como cerradas en Afinia; reposan aquí.
// Las REEMPLAZADAS van con las anuladas. Si odt_afinia_estados.js quedó viejo en la caché
// (sin la clave `cerradas`), la pestaña sale vacía en lugar de romper la bandeja (L-102).
// «Firmadas por mí» lleva el aviso del Decreto 2364/2012 art. 6: si ve una que no
// firmó, avise de inmediato y cambie su contraseña (el titular es el único que
// puede detectar una suplantación; comité W-11, legal). Muestra N.º, fecha y
// hora de la firma y hora de autenticación (leídas del acto UNA vez por bandeja: cada
// acto trae la imagen de la firma, así que no se vuelve a bajar en cada clic).
// La lista sale del servidor (limit 50); el estado se filtra aquí.
// Estado cero: sin ODT y sin habilitación, la bandeja orienta a «Habilitarme y Mi firma».
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { bandeja, rolDe, ETIQUETA_ESTADO } from '../../domain/odt_afinia_estados.js';
import { ETIQUETA_ROL } from '../../domain/odt_afinia_rutas.js';
import { etiquetaEstado } from '../../domain/odt_afinia_cierre.js';
import { h, vaciar, aviso, fechaHora, horaAutenticacion, mensajeDe } from './comun.js';

export const PESTANAS = Object.freeze([
  { clave: 'miTurno', titulo: 'Mi turno', vacio: 'No tiene ODT esperando su firma.' },
  { clave: 'enCurso', titulo: 'En curso', vacio: 'No hay ODT en curso.' },
  { clave: 'listas', titulo: 'Listas', vacio: 'Todavía no hay ODT con las dos firmas.' },
  { clave: 'cerradas', titulo: 'Cerradas', vacio: 'No hay ODT cerradas en Afinia.' },
  { clave: 'firmadasPorMi', titulo: 'Firmadas por mí', vacio: 'No ha firmado ninguna ODT.' },
  { clave: 'anuladas', titulo: 'Anuladas y reemplazadas', vacio: 'No hay ODT anuladas ni reemplazadas.' }
]);

export const AVISO_SUPLANTACION = 'Si ve aquí una ODT que usted no firmó, avise de inmediato al Ingeniero y cambie su contraseña.';
export const AVISO_SIN_HABILITAR = 'Aún no está habilitado para firmar ODT: vaya a «Habilitarme y Mi firma».';

/** Máximo de filas de «Firmadas por mí» que leen su acto (cada una es una lectura). */
const TOPE_DETALLE = 20;

/**
 * @param {HTMLElement} contenedor
 * @param {{repo:object, sesion:{uid:string}, alAbrir:(odtId:string)=>void, pestana?:string}} p
 */
export async function montarBandeja(contenedor, { repo, sesion, alAbrir, pestana = 'miTurno' }) {
  vaciar(contenedor);
  contenedor.appendChild(h('p', { class: 'odt-cargando', text: 'Consultando sus ODT…' }));
  let datos;
  try {
    datos = await repo.listarBandeja();
  } catch (e) {
    vaciar(contenedor);
    contenedor.appendChild(aviso(mensajeDe(e), 'error'));
    contenedor.appendChild(h('button', { type: 'button', class: 'odt-btn', text: 'Reintentar', onclick: () => montarBandeja(contenedor, { repo, sesion, alAbrir, pestana }) }));
    return;
  }
  const grupos = bandeja(datos.odts, sesion.uid);
  /** Las ODT de una pestaña (una clave que un módulo viejo no trae = vacía, nunca un error). */
  const de = (clave) => grupos[clave] || [];
  // Estado cero que orienta: sin ODT, ¿le falta habilitarse? (si no se puede saber, se dice).
  let orientacion = null;
  if (!datos.odts.length && typeof repo.leerHabilitacion === 'function') {
    try {
      if (!(await repo.leerHabilitacion())) {
        orientacion = h('p', { class: 'odt-aviso odt-aviso--info', role: 'status' }, AVISO_SIN_HABILITAR + ' ',
          h('a', { class: 'odt-enlace', href: '#habilitarme', text: 'Ir a Habilitarme' }));
      }
    } catch (e) {
      orientacion = aviso('No se pudo comprobar si ya está habilitado para firmar: ' + mensajeDe(e), 'aviso');
    }
  }
  /** Actos ya pedidos en ESTA bandeja (id_rol → promesa): uno por fila, no uno por clic. */
  const cacheActos = new Map();
  const leerActo = (id, rol) => {
    const k = id + '_' + rol;
    if (!cacheActos.has(k)) {
      const p = repo.leerActo(id, rol);
      cacheActos.set(k, p);
      p.catch(() => cacheActos.delete(k));      // un fallo no queda guardado: el próximo clic reintenta
    }
    return cacheActos.get(k);
  };
  vaciar(contenedor);
  if (orientacion) contenedor.appendChild(orientacion);

  const lista = h('div', { class: 'odt-lista', role: 'tabpanel' });
  const botones = PESTANAS.map((p) => h('button', {
    type: 'button', class: 'odt-pestana', role: 'tab', 'aria-selected': 'false', dataset: { clave: p.clave },
    onclick: () => elegir(p.clave)
  }, p.titulo + ' ', h('span', { class: 'odt-cuenta', text: String(de(p.clave).length) })));
  contenedor.appendChild(h('div', { class: 'odt-pestanas', role: 'tablist', 'aria-label': 'Bandeja de ODT' }, botones));
  if (datos.tope) contenedor.appendChild(aviso('Se muestran las 50 ODT más recientes.', 'info'));
  contenedor.appendChild(lista);

  function elegir(clave) {
    for (const b of botones) b.setAttribute('aria-selected', String(b.dataset.clave === clave));
    pintarLista(clave);
  }

  function filaOdt(o) {
    const rol = rolDe(o, sesion.uid);
    return h('li', { class: 'odt-fila' },
      h('button', { type: 'button', class: 'odt-fila-btn', onclick: () => alAbrir(o.id) },
        h('span', { class: 'odt-fila-nro', text: 'ODT N.º ' + o.nro }),
        h('span', { class: 'odt-fila-meta', text: [o.subestacion, o.equipo, 'prevista ' + o.fechaTrabajo].filter(Boolean).join(' · ') }),
        h('span', { class: 'odt-chip odt-chip--' + String(o.estado).toLowerCase(), text: etiquetaEstado(o.estado, ETIQUETA_ESTADO) }),
        rol ? h('span', { class: 'odt-mini', text: 'Usted firma como ' + ETIQUETA_ROL[rol] }) : null));
  }

  function pintarLista(clave) {
    vaciar(lista);
    const p = PESTANAS.find((x) => x.clave === clave) || PESTANAS[0];
    if (clave === 'firmadasPorMi') lista.appendChild(aviso(AVISO_SUPLANTACION, 'aviso'));
    const items = de(p.clave);
    if (!items.length) { lista.appendChild(h('p', { class: 'odt-vacio', text: p.vacio })); return; }
    if (clave !== 'firmadasPorMi') { lista.appendChild(h('ul', { class: 'odt-filas' }, items.map(filaOdt))); return; }
    // Firmadas por mí: N.º, fecha y hora de la firma y hora de autenticación, leídas del acto.
    const tabla = h('table', { class: 'odt-tabla' },
      h('thead', {}, h('tr', {}, ['N.º ODT', 'Firmé como', 'Fecha y hora de la firma', 'Escribí mi contraseña', ''].map((t) => h('th', { scope: 'col', text: t })))));
    const cuerpo = h('tbody');
    tabla.appendChild(cuerpo);
    lista.appendChild(h('div', { class: 'odt-tabla-caja' }, tabla));
    items.slice(0, TOPE_DETALLE).forEach((o) => {
      const rol = rolDe(o, sesion.uid);
      const cFecha = h('td', { text: '…' }); const cAuth = h('td', { text: '…' });
      cuerpo.appendChild(h('tr', {},
        h('td', { text: o.nro }), h('td', { text: ETIQUETA_ROL[rol] }), cFecha, cAuth,
        h('td', {}, h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Ver constancia', onclick: () => alAbrir(o.id) }))));
      leerActo(o.id, rol).then((a) => {
        cFecha.textContent = a ? fechaHora(a.enMs) : 'no se encontró el registro';
        cAuth.textContent = a ? horaAutenticacion(a.authTime) : '—';
      }).catch(() => { cFecha.textContent = 'no se pudo leer'; cAuth.textContent = '—'; });
    });
    if (items.length > TOPE_DETALLE) lista.appendChild(h('p', { class: 'odt-mini', text: 'Y ' + (items.length - TOPE_DETALLE) + ' más (abra cada una para ver su constancia).' }));
  }

  elegir(PESTANAS.some((p) => p.clave === pestana) ? pestana : 'miTurno');
  return { grupos, cacheActos };
}
