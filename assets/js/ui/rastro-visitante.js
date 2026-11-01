// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Rastro de actividad del visitante (en su navegador) · `99 §199`
// ──────────────────────────────────────────────────────────────
// Lo carga el guardián de sesión SOLO para el rol visitante, sin esperar (si falla, la página sigue
// igual). Anota en `actividad_visitante/{uid}/eventos`, que solo lee el administrador: la página que
// abre, el equipo y el mes que consulta (ruta `#mat=…`), los filtros y botones que usa y lo que
// selecciona en el mapa (evento `sgm:consulta` de mapa-colombia.js). Sin ubicación física
// (decisión del Ingeniero). Escribe en segundo plano y nunca rompe la página. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { getDbSafe } from '../firebase-init.js';
import { paginaDe, eventoDeRuta, describirDispositivo, detalleLimpio, recortar, TOPE_CLAVE } from '../domain/rastro_visitante.js';

const TOPE_EVENTOS = 1500;   // por pestaña: corta un bucle accidental sin perder una visita normal
const VENTANA_REPETIDO_MS = 1500;

let iniciado = false;

/** @param {{user:object, acceso:object}} sess  la sesión que publica el guardián */
export async function iniciar(sess) {
  if (iniciado || !sess || !sess.user || !sess.acceso || !sess.acceso.restringido) return;
  iniciado = true;
  const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const db = getDbSafe();
  if (!db) return;
  const uid = sess.user.uid;
  const ingreso = recortar((sess.user.metadata && sess.user.metadata.lastSignInTime) || '', TOPE_CLAVE);
  const sesion = idSesion();
  const pagina = paginaDe(location.pathname);
  const ref = collection(db, 'actividad_visitante', uid, 'eventos');
  let enviados = 0;
  let ultimo = '';
  let ultimoEn = 0;

  const anotar = (tipo, detalle, extra) => {
    if (enviados >= TOPE_EVENTOS) return;
    const d = detalleLimpio(detalle);
    const firma = tipo + JSON.stringify(d);
    const ahora = Date.now();
    if (firma === ultimo && ahora - ultimoEn < VENTANA_REPETIDO_MS) return;   // el mismo gesto dos veces seguidas
    ultimo = firma; ultimoEn = ahora; enviados++;
    const doc = { tipo, pagina, ingreso, sesion, en: serverTimestamp(), ...(extra || {}) };
    if (Object.keys(d).length) doc.detalle = d;
    addDoc(ref, doc).catch((e) => console.warn('[rastro] no se anotó', e && e.code));
  };

  anotar('pagina', null, { disp: describirDispositivo(navigator.userAgent, {
    ancho: screen && screen.width, alto: screen && screen.height, tactil: navigator.maxTouchPoints > 1 }) });

  // Si el guardián lo trajo aquí desde una página que no tiene permitida, se anota el intento.
  try {
    const intento = sessionStorage.getItem('sgm.rastro.intento');
    if (intento) { sessionStorage.removeItem('sgm.rastro.intento'); anotar('intento', { texto: intento }); }
  } catch (_) { /* sin almacenamiento de sesión: no hay intento que anotar */ }

  // Cargabilidad SCADA: la ruta dice qué equipo y qué mes/periodo mira. La página la cambia con el
  // `#…` (hashchange) o con history.replaceState (mes, periodo, rango del detalle): se escuchan las dos.
  const porRuta = () => { const ev = eventoDeRuta(location.hash); if (ev) anotar(ev.tipo, ev.detalle); };
  porRuta();
  window.addEventListener('hashchange', porRuta);
  for (const m of ['replaceState', 'pushState']) {
    const original = history[m];
    if (typeof original !== 'function') continue;
    history[m] = function (...args) {
      const r = original.apply(this, args);
      try { porRuta(); } catch (_) { /* el rastro nunca rompe la navegación */ }
      return r;
    };
  }

  // Mapa: lo que selecciona (departamento, municipio, subestación y transformador).
  document.addEventListener('sgm:consulta', (ev) => {
    const x = (ev && ev.detail) || {};
    anotar('seleccion', { tipo: x.tipo, nombre: x.nombre, mat: x.tx });
  });

  // Filtros, listas y casillas: qué cambió y a qué valor.
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!t || !t.closest || !t.closest('main') || t.type === 'password' || t.type === 'hidden') return;
    let valor = '';
    if (t.tagName === 'SELECT') valor = [...t.selectedOptions].map((o) => o.textContent).join(', ');
    else if (t.type === 'checkbox' || t.type === 'radio') valor = (t.checked ? 'marcado' : 'desmarcado');
    else valor = t.value;
    anotar('control', { control: nombreDe(t), valor });
  }, true);

  // Botones, pestañas y enlaces (no el lienzo del mapa: pan y zoom no son consultas). Lo que ya anota su
  // propio evento (abrir un equipo, seleccionar en el mapa) no se repite como clic.
  document.addEventListener('click', (ev) => {
    const t = ev.target && ev.target.closest && ev.target.closest('button, a, [role="tab"], [role="button"]');
    if (!t || !t.closest('main') || t.closest('.leaflet-container')) return;
    if (t.matches('a[href^="#mat="], [data-sub], [data-mun], [data-dep], [data-volver], [id^="csCurvas-"]')) return;
    const pulsado = t.getAttribute('aria-pressed');
    const texto = recortar(t.getAttribute('aria-label') || t.textContent || '', 80);
    // Un botón que se marca y desmarca: se anota cómo QUEDA (el clic lo invierte).
    anotar('clic', { texto: pulsado == null ? texto : texto + (pulsado === 'true' ? ' (desmarcado)' : ' (marcado)'), control: t.id || '' });
  }, true);
}

/**
 * Cómo se llama el control para una persona: su aria-label, el texto de su rótulo (SIN las opciones de un
 * select ni otros controles que el rótulo envuelva), su placeholder o su id.
 */
function nombreDe(t) {
  const aria = t.getAttribute('aria-label') || (t.getAttribute('aria-labelledby') && textoDe(document.getElementById(t.getAttribute('aria-labelledby'))));
  if (aria) return recortar(aria, 80);
  const lbl = (t.id && document.querySelector(`label[for="${CSS.escape(t.id)}"]`)) || t.closest('label');
  const delRotulo = lbl ? textoDe(lbl) : '';
  return recortar(delRotulo || t.getAttribute('placeholder') || t.name || t.id || t.tagName, 80);
}
/** El texto propio de un nodo, sin el de los controles que contiene. */
function textoDe(nodo) {
  if (!nodo) return '';
  const c = nodo.cloneNode(true);
  c.querySelectorAll('select, option, input, textarea, button').forEach((x) => x.remove());
  return c.textContent || '';
}

/** Un id por pestaña (las visitas de una misma pestaña se agrupan). */
function idSesion() {
  try {
    let s = sessionStorage.getItem('sgm.rastro');
    if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('sgm.rastro', s); }
    return s;
  } catch (_) { return Math.random().toString(36).slice(2, 12); }
}
