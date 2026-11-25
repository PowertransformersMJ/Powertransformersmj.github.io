// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · ARRANQUE de la pantalla
// ──────────────────────────────────────────────────────────────────────────────
// `pages/firma-odt-afinia.html` lo carga con import() (L-102). Espera la sesión
// del guard y monta: Bandeja · Habilitarme y Mi firma · Publicar (solo admin).
// La vista se elige con el ancla de la dirección (#bandeja, #habilitarme,
// #publicar, #odt=<id>) para que una recarga vuelva al mismo sitio.
// Estuvo AISLADA (sin menú, con la franja roja de vista previa) hasta el
// «procede» del Ingeniero (2026-11-21, 99 §231.15): ahora está en el menú,
// sección Ejecución, y la franja queda vacía (ESTADO_PAGINA = 'publicado').
// Pestaña «Por subsanar» (decisión del Ingeniero del 2026-11-21): #subsanar (lista), #subsanar=<id>
// (una ODT y sus puntos) y #subsanar-nueva (registrar, solo admin). La ven los administradores y
// quien tenga al menos una ODT por subsanar asignada (la consulta solo trae las suyas), con el
// contador de los puntos que le tocan: al AZT, los pendientes; al administrador, los subsanados
// por verificar. Vive en archivos NUEVOS que entran con import() (L-102): si no cargan, la firma
// sigue igual y la pestaña dice que se recargue.
// Pestaña «Indicadores» (pedido del Ingeniero del 2026-11-23): #indicadores (el último corte), #indicadores=<id> (un
// corte del historial) y #indicadores-cargar (cargar el CSV de Afinia). La ven los administradores y, desde el
// 2026-11-24 (acceso de un AZT a los indicadores: «Todo, solo lectura»), quien esté en la lista de lectores
// odt_afinia_config/indicadores: se pregunta con indicadores-lectores.js (import(), solo si no es admin) y, si está,
// aparece la pestaña (antes de «Por subsanar»); él no carga cortes (si no se pudo comprobar, p. ej. sin red, el ancla
// lo dice: MSG_INDICADORES_SIN_COMPROBAR). Al admin se le pasa el repositorio de la firma
// solo para la lista de AZT habilitados de «Quién más puede ver los indicadores» (`candidatos`, que ya existía).
// También en archivos NUEVOS por import() (indicadores*.js); si no cargan, el resto de la página sigue.
// El contador de «Por subsanar» lo dice con palabras (2026-11-24): «12 ODT · 40 puntos» al AZT, «12 ODT · 5 por
// verificar» al admin (`contador` de por-subsanar.js; si llega uno viejo de la caché, solo el número, como antes).
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

/** 'vista_previa' mientras la página no esté en el menú; 'publicado' después del «procede».
 *  «Procede» del Ingeniero el 2026-11-21 («Sí, agrégalo», 99 §231.15): en el menú, sección Ejecución. */
export const ESTADO_PAGINA = 'publicado';

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

/**
 * Lee la vista pedida en el ancla: {vista:'bandeja'|'habilitarme'|'publicar'|'odt', odtId?}
 * o, la pestaña «Por subsanar», {vista:'subsanar', sub:'lista'|'detalle'|'nueva', obsId?},
 * o, la pestaña «Indicadores», {vista:'indicadores', sub:'ultimo'|'corte'|'cargar', corteId?}.
 */
export function leerAncla(hash) {
  const s = String(hash || '').replace(/^#/, '');
  const m = /^odt=([A-Za-z0-9]{20})$/.exec(s);
  if (m && esIdOdt(m[1])) return { vista: 'odt', odtId: m[1] };
  if (s === 'habilitarme' || s === 'publicar') return { vista: s };
  const ms = /^subsanar=([A-Za-z0-9]{20})$/.exec(s);
  if (ms && esIdOdt(ms[1])) return { vista: 'subsanar', sub: 'detalle', obsId: ms[1] };
  if (s === 'subsanar') return { vista: 'subsanar', sub: 'lista' };
  if (s === 'subsanar-nueva') return { vista: 'subsanar', sub: 'nueva' };
  const mi = /^indicadores=([A-Za-z0-9]{20})$/.exec(s);
  if (mi && esIdOdt(mi[1])) return { vista: 'indicadores', sub: 'corte', corteId: mi[1] };
  if (s === 'indicadores') return { vista: 'indicadores', sub: 'ultimo' };
  if (s === 'indicadores-cargar') return { vista: 'indicadores', sub: 'cargar' };
  return { vista: 'bandeja' };
}

/** La pestaña «Indicadores» vive en archivos NUEVOS: se carga con import() y se pregunta si trae lo que se usa (L-102). */
let _indicadores = null;
function cargarIndicadores() {
  if (!_indicadores) {
    _indicadores = import('./indicadores.js')
      .then((m) => (m && typeof m.montarIndicadores === 'function' && typeof m.crearRepositorioCortes === 'function' ? m : null))
      .catch(() => null);
  }
  return _indicadores;
}
/** Quien no es admin ni está en la lista de lectores y entra por el ancla. */
export const MSG_INDICADORES_SIN_ACCESO = 'Los indicadores son solo para los administradores y las personas que ellos autoricen.';
/** Quien no es admin entra por el ancla y no se pudo comprobar si está en la lista de lectores (falló la conexión). */
export const MSG_INDICADORES_SIN_COMPROBAR = 'No se pudo comprobar si usted puede ver los indicadores porque falló la conexión. Revise su red y recargue la página.';
/** Si la pestaña no cargó: se recarga (como en el resto del módulo, L-102). */
export const MSG_INDICADORES_NO_CARGO = 'No se pudo cargar «Indicadores». Recargue la página con Cmd + Shift + R (Ctrl + Shift + R en Windows).';

/** ¿Quien NO es admin está en la lista de lectores? Vive en un archivo NUEVO: import() y se pregunta (L-102). */
let _lectoresInd = null;
function cargarLectoresInd() {
  if (!_lectoresInd) {
    _lectoresInd = import('./indicadores-lectores.js')
      .then((m) => (m && typeof m.soyLectorIndicadores === 'function' ? m : null))
      .catch(() => null);
  }
  return _lectoresInd;
}

/** La pestaña «Por subsanar» vive en un archivo NUEVO: se carga con import() y se pregunta si trae lo que se usa (L-102). */
let _subsanar = null;
function cargarSubsanar() {
  if (!_subsanar) {
    _subsanar = import('./por-subsanar.js')
      .then((m) => (m && typeof m.montarPorSubsanar === 'function' && typeof m.crearRepositorioObs === 'function' ? m : null))
      .catch(() => null);
  }
  return _subsanar;
}
/** Si la pestaña no cargó: se recarga (como en el resto del módulo, L-102). */
export const MSG_SUBSANAR_NO_CARGO = 'No se pudo cargar «Por subsanar». Recargue la página con Cmd + Shift + R (Ctrl + Shift + R en Windows).';

/**
 * @param {HTMLElement} raiz
 * @param {{franja?:HTMLElement, repoObs?:object, repoCortes?:object, repoLectores?:object}} [op]  repoObs, repoCortes y
 *   repoLectores: inyectables (pruebas); la página no los pasa
 */
export async function montarOdtAfinia(raiz, { franja, repoObs: repoObsInyectado, repoCortes: repoCortesInyectado, repoLectores } = {}) {
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
    ...(sesion.esAdmin ? [{ clave: 'publicar', titulo: 'Publicar ODT' }, { clave: 'indicadores', titulo: 'Indicadores' }] : [])
  ];
  const nav = h('nav', { class: 'odt-nav', 'aria-label': 'Firma de ODT Afinia' },
    vistas.map((v) => h('a', { class: 'odt-nav-btn', href: '#' + v.clave, dataset: { clave: v.clave }, text: v.titulo })));
  const zonaAviso = h('div', { class: 'odt-aviso-general', role: 'status', 'aria-live': 'polite' });
  const zonaRaiz = h('div', { class: 'odt-zona' });
  raiz.append(nav, zonaAviso, zonaRaiz);

  // ── «Por subsanar»: la pestaña (el admin siempre; los demás si tienen alguna asignada) y su contador ──
  let repoObs = repoObsInyectado || null;
  let btnSubsanar = null;
  const pestanaSubsanar = () => {
    if (!btnSubsanar) {
      btnSubsanar = h('a', { class: 'odt-nav-btn', href: '#subsanar', dataset: { clave: 'subsanar' } }, 'Por subsanar');
      nav.appendChild(btnSubsanar);
      if (leerAncla(location.hash).vista === 'subsanar') btnSubsanar.setAttribute('aria-current', 'page');
    }
    return btnSubsanar;
  };
  /**
   * Pone el contador «de su lado» (o lo vuelve a consultar si no llega). Nunca rompe la página. Con `contador` (desde
   * el 2026-11-24): «12 ODT · 40 puntos» / «12 ODT · 5 por verificar», con la frase completa en aria-label y title
   * (en un celular angosto el CSS deja solo «12 ODT»). Sin él (un por-subsanar.js viejo de la caché): solo el número.
   */
  const ponerContador = async (datos) => {
    try {
      const m = await cargarSubsanar();
      if (!m) return;
      if (!repoObs) repoObs = m.crearRepositorioObs();
      const d = datos || await m.contarDeMiLado({ repoObs, sesion });
      if (!sesion.esAdmin && !(d.total > 0) && !btnSubsanar) return;   // sin ODT por subsanar: sin pestaña
      const b = pestanaSubsanar();
      for (const x of b.querySelectorAll('.odt-cuenta')) x.remove();
      const c = d && d.contador;
      if (c && Number.isInteger(c.odts) && Number.isInteger(c.puntos) && typeof c.corto === 'string' && typeof c.resto === 'string') {
        b.setAttribute('aria-label', String(c.etiqueta || ''));
        b.setAttribute('title', String(c.etiqueta || ''));
        b.appendChild(h('span', { class: 'odt-cuenta odt-cuenta--palabras', 'aria-hidden': 'true' },
          h('span', { class: 'odt-cuenta-odt', text: c.corto }),
          h('span', { class: 'odt-cuenta-resto', text: ' · ' + c.resto })));
      } else if (Number.isInteger(d.deMiLado)) {
        b.removeAttribute('aria-label'); b.removeAttribute('title');
        b.appendChild(h('span', {
          class: 'odt-cuenta', text: String(d.deMiLado),
          title: sesion.esAdmin ? 'Puntos subsanados por verificar' : 'Puntos pendientes por subsanar'
        }));
      }
    } catch (_) { /* sin contador: la pestaña sigue (el admin la ve igual) */ }
  };
  if (sesion.esAdmin) pestanaSubsanar();

  // ── «Indicadores» para quien NO es admin: solo si está en la lista de lectores (odt_afinia_config/indicadores) ──
  /**
   * true si la sesión (no admin) es lectora de los indicadores; false ante cualquier duda. Se pregunta UNA vez. Si no se
   * pudo comprobar (sin red u otro fallo que no es un «no»), `lectorSinComprobar` lo recuerda para avisarlo en el ancla.
   */
  let lectorSinComprobar = false;
  const lectorInd = sesion.esAdmin ? Promise.resolve(false) : cargarLectoresInd()
    .then((m) => {
      if (!m) return false;
      if (typeof m.estadoLectorIndicadores !== 'function') return m.soyLectorIndicadores({ sesion, repoLectores });
      return m.estadoLectorIndicadores({ sesion, repoLectores })
        .then((x) => { lectorSinComprobar = !!x && x.sinComprobar === true; return !!x && x.lector === true; });
    })
    .then((x) => x === true, () => false);
  let btnIndicadores = null;
  /** La pestaña del lector, antes de «Por subsanar» (si ya está, esta se saca y se vuelve a poner al final). */
  const pestanaIndicadores = () => {
    if (btnIndicadores) return btnIndicadores;
    btnIndicadores = h('a', { class: 'odt-nav-btn', href: '#indicadores', dataset: { clave: 'indicadores' }, text: 'Indicadores' });
    nav.appendChild(btnIndicadores);
    if (btnSubsanar) nav.appendChild(btnSubsanar);
    if (leerAncla(location.hash).vista === 'indicadores') btnIndicadores.setAttribute('aria-current', 'page');
    return btnIndicadores;
  };
  const avisarLector = lectorInd.then((si) => { if (si) pestanaIndicadores(); }).catch(() => {});

  /** Mensaje para la vista de UNA ODT: {odtId, texto}. */
  let pendiente = null;
  /** Mensaje para la próxima vista de «Por subsanar»: {ancla, texto}. */
  let pendienteSubsanar = null;
  /** «Indicadores»: su repositorio (se crea al entrar) y el mensaje para su próxima vista ({ancla, texto}). */
  let repoCortes = repoCortesInyectado || null;
  let pendienteIndicadores = null;
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
    let mensajeSubsanar = '';
    if (pendienteSubsanar) {
      if ('#' + pendienteSubsanar.ancla === location.hash || pendienteSubsanar.ancla === location.hash) mensajeSubsanar = pendienteSubsanar.texto;
      pendienteSubsanar = null;
    }
    let mensajeIndicadores = '';
    if (pendienteIndicadores) {
      if ('#' + pendienteIndicadores.ancla === location.hash || pendienteIndicadores.ancla === location.hash) mensajeIndicadores = pendienteIndicadores.texto;
      pendienteIndicadores = null;
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
    if (a.vista === 'subsanar') {
      const m = await cargarSubsanar();
      if (!m) { zona.appendChild(aviso(MSG_SUBSANAR_NO_CARGO, 'aviso')); return null; }
      if (!repoObs) repoObs = m.crearRepositorioObs();
      return m.montarPorSubsanar(zona, {
        vista: a.sub, obsId: a.obsId, repoObs, repoOdt: repo, sesion, mensaje: mensajeSubsanar,
        alIr: (ancla, texto) => {
          pendienteSubsanar = texto ? { ancla, texto } : null;
          if ('#' + ancla === location.hash) ir(); else location.hash = ancla;
        },
        alContar: (datos) => { ponerContador(datos); }
      });
    }
    if (a.vista === 'indicadores') {
      const lector = !sesion.esAdmin && await lectorInd;
      if (!sesion.esAdmin && !lector) { zona.appendChild(aviso(lectorSinComprobar ? MSG_INDICADORES_SIN_COMPROBAR : MSG_INDICADORES_SIN_ACCESO, 'aviso')); return null; }
      const m = await cargarIndicadores();
      if (!m) { zona.appendChild(aviso(MSG_INDICADORES_NO_CARGO, 'aviso')); return null; }
      if (!repoCortes) repoCortes = m.crearRepositorioCortes(lector ? { esLector: true } : {});
      return m.montarIndicadores(zona, {
        vista: a.sub, corteId: a.corteId, repoCortes, sesion, mensaje: mensajeIndicadores, lector,
        // Solo al admin: la lista de AZT habilitados de «Quién más puede ver los indicadores» (solo `candidatos`).
        repoOdt: sesion.esAdmin ? repo : null, repoLectores,
        // {reemplazar: true} (el desvío del lector desde #indicadores-cargar): cambia el ancla SIN dejar la anterior en el
        // historial del navegador (si no, «Atrás» lo devolvería a #indicadores-cargar y lo desviaría otra vez).
        alIr: (ancla, texto, op) => {
          pendienteIndicadores = texto ? { ancla, texto } : null;
          if ('#' + ancla === location.hash) ir();
          else if (op && op.reemplazar && typeof location.replace === 'function') location.replace('#' + ancla);
          else location.hash = ancla;
        }
      });
    }
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
  const contador = ponerContador();
  await ir();
  await contador;
  await avisarLector;
  return { ir };
}
