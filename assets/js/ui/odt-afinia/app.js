// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · ARRANQUE de la pantalla
// ──────────────────────────────────────────────────────────────────────────────
// `pages/firma-odt-afinia.html` lo carga con import() (L-102). Espera la sesión
// del guard y monta: Bandeja · Habilitarme y Mi firma · Publicar (solo admin).
// La vista se elige con el ancla de la dirección (#bandeja, #habilitarme,
// #publicar, #odt=<id>) para que una recarga vuelva al mismo sitio.
// La página está AISLADA: no tiene entrada en el menú hasta el «procede» del
// Ingeniero (P6); mientras tanto la franja roja lo dice.
// Un mensaje («firma registrada», «anulada», «publicada») es de UNA ODT: se muestra en
// su vista si la persona sigue en ella; si ya se fue a otra, va al aviso general de
// arriba, nunca a la vista de otra ODT ni se pierde en la bandeja.
// No se expone nada en window (ni repositorio ni cuenta): un script de la página no
// tiene a mano con qué escribir actos.
// Diseño: bóveda `research-archive/2026-11-20-odt-firmas/DISENO-FINAL.md` §5.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { crearRepositorioOdt } from '../../data/odt_afinia.js';
import { crearCuenta } from '../../data/odt_afinia_cuenta.js';
import { miFirmaOdt } from '../../data/odt_afinia_mi_firma.js';
import { sesionGlobal, esIdOdt } from '../../data/odt_afinia_lotes.js';
import { h, vaciar, aviso } from './comun.js';
import { montarBandeja } from './bandeja.js';
import { montarHabilitarme } from './habilitarme.js';
import { montarPublicar } from './publicar.js';
import { montarDetalle } from './detalle.js';

/** 'vista_previa' mientras la página no esté en el menú; 'publicado' después del «procede». */
export const ESTADO_PAGINA = 'vista_previa';

function esperarSesion(ms = 30000) {
  if (window.__sgmSession) return Promise.resolve(window.__sgmSession);
  return new Promise((res) => {
    const t = setTimeout(() => res(window.__sgmSession || null), ms);
    window.addEventListener('sgm:session-ready', () => { clearTimeout(t); res(window.__sgmSession || null); }, { once: true });
  });
}

/**
 * ¿El mensaje de la ODT `odtId` corresponde a la vista del ancla `hash`? (solo si es ESA ODT).
 * @returns {boolean}
 */
export function mensajeEsDeLaVista(hash, odtId) {
  const a = leerAncla(hash);
  return a.vista === 'odt' && !!odtId && a.odtId === odtId;
}

/** Lee la vista pedida en el ancla: {vista:'bandeja'|'habilitarme'|'publicar'|'odt', odtId?}. */
export function leerAncla(hash) {
  const s = String(hash || '').replace(/^#/, '');
  const m = /^odt=([A-Za-z0-9]{20})$/.exec(s);
  if (m && esIdOdt(m[1])) return { vista: 'odt', odtId: m[1] };
  if (s === 'habilitarme' || s === 'publicar') return { vista: s };
  return { vista: 'bandeja' };
}

/**
 * @param {HTMLElement} raiz
 * @param {{franja?:HTMLElement}} [op]
 */
export async function montarOdtAfinia(raiz, { franja } = {}) {
  vaciar(raiz);
  raiz.appendChild(h('p', { class: 'odt-cargando', text: 'Verificando su sesión…' }));
  await esperarSesion();
  const sesion = sesionGlobal();
  if (franja) {
    vaciar(franja);
    if (ESTADO_PAGINA === 'vista_previa') {
      franja.appendChild(h('div', { class: 'odt-franja-fila odt-franja--previa' },
        h('b', { text: 'VISTA PREVIA · sin menú' }),
        h('span', { text: 'Esta página todavía no está en el menú: se revisa antes de abrirla al equipo.' })));
    }
  }
  vaciar(raiz);
  if (!sesion) { raiz.appendChild(aviso('No hay una sesión abierta. Recargue la página e ingrese.', 'error')); return null; }

  const repo = crearRepositorioOdt();
  const cuenta = crearCuenta();
  const leerMiFirma = () => miFirmaOdt();

  const vistas = [
    { clave: 'bandeja', titulo: 'Bandeja' },
    { clave: 'habilitarme', titulo: 'Habilitarme y Mi firma' },
    ...(sesion.esAdmin ? [{ clave: 'publicar', titulo: 'Publicar ODT' }] : [])
  ];
  const nav = h('nav', { class: 'odt-nav', 'aria-label': 'Firma de ODT Afinia' },
    vistas.map((v) => h('a', { class: 'odt-nav-btn', href: '#' + v.clave, dataset: { clave: v.clave }, text: v.titulo })));
  const zonaAviso = h('div', { class: 'odt-aviso-general', role: 'status', 'aria-live': 'polite' });
  const zonaRaiz = h('div', { class: 'odt-zona' });
  raiz.append(nav, zonaAviso, zonaRaiz);

  /** Mensaje para la vista de UNA ODT: {odtId, texto}. */
  let pendiente = null;
  const avisoGeneral = (texto) => { vaciar(zonaAviso); if (texto) zonaAviso.appendChild(aviso(texto, 'ok')); };
  /** El aviso de una vista de ODT: a su vista si sigue abierta; si no, al aviso general. */
  const avisarDe = (odtId, texto) => {
    if (mensajeEsDeLaVista(location.hash, odtId)) { pendiente = { odtId, texto: texto || '' }; ir(); } else if (texto) avisoGeneral(texto);
  };
  async function ir() {
    const a = leerAncla(location.hash);
    for (const b of nav.querySelectorAll('.odt-nav-btn')) {
      const activa = b.dataset.clave === (a.vista === 'odt' ? 'bandeja' : a.vista);
      if (activa) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
    vaciar(zonaAviso);
    let mensaje = '';
    if (pendiente) {
      if (a.vista === 'odt' && a.odtId === pendiente.odtId) mensaje = pendiente.texto; else avisoGeneral(pendiente.texto);
      pendiente = null;
    }
    // Cada vista se monta en un contenedor NUEVO: si la persona cambia de vista antes de que
    // la anterior termine de leer, la vieja pinta en un nodo ya retirado y no se mezclan.
    const zona = h('div', { class: 'odt-vista-actual' });
    vaciar(zonaRaiz); zonaRaiz.appendChild(zona);
    if (a.vista === 'habilitarme') return montarHabilitarme(zona, { repo, cuenta, sesion, miFirmaOdt: leerMiFirma });
    if (a.vista === 'publicar' && sesion.esAdmin) {
      return montarPublicar(zona, { repo, cuenta, sesion, alPublicar: (id) => { pendiente = { odtId: id, texto: 'Publicada y comprobada en el servidor.' }; location.hash = 'odt=' + id; } });
    }
    if (a.vista === 'odt') {
      return montarDetalle(zona, {
        repo, cuenta, sesion, odtId: a.odtId, miFirmaOdt: leerMiFirma, mensaje,
        alVolver: () => { location.hash = 'bandeja'; },
        alCambiar: (m) => avisarDe(a.odtId, m)
      });
    }
    return montarBandeja(zona, { repo, sesion, alAbrir: (id) => { location.hash = 'odt=' + id; } });
  }
  window.addEventListener('hashchange', () => { ir(); });
  await ir();
  return { ir };
}
