// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · «Notificaciones a …» (cumplimiento del cierre) · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): «me gustaría que en SGM, en mi sesión, pueda apreciar cuándo y cuántas veces
// notificas». Un bloque ABIERTO (no plegado) de la vista de un corte, justo arriba de la sección de cumplimiento; lo ven
// el administrador y los lectores de Indicadores, y se lee al montarse (data/odt_afinia_cumplimiento_notificaciones.js):
//   · título «Notificaciones a <destinatarios del correo más reciente>» (sus nombres, paraNombres; un correo viejo sin
//     ellos dice sus direcciones) o «Notificaciones de cumplimiento» si no hay ninguno;
//   · tarjetas del resumen que escribe SOLO el servidor (odt_afinia_config/cumplimiento_resumen): enviadas, de 10, de 15
//     y de 20 días, ODT avisadas y la última (fecha y hora de Colombia, y hace cuánto); si hay, «En cola» y «Con error»
//     (conteos del servidor, como mucho 50: «50 o más»);
//   · la tabla «Cuándo se le notificó», la más reciente primero, de a 20 con «Ver más notificaciones»: fecha y hora de
//     envío (si no ha salido, la de creación con «(en cola)» o «(no salió)»), tipo, para, ODT incluidas (la cantidad,
//     que despliega sus N.º: un <details>, que el navegador anuncia abierto o cerrado), estado en llano y la fecha de
//     los datos del informe (enlace a ese corte si es otro). «Ver más» se pone o se quita (nunca hidden sobre una caja
//     con display propio);
//   · en llano: el registro no depende de los filtros de periodo ni de contratista de la página;
//   · sin ninguna enviada: «Todavía no se ha enviado ninguna notificación»;
//   · el buscador «Historial de avisos de una ODT»: el N.º → sus avisos (umbral, estado en llano y fecha).
// Además, crearAvisosPorOdt: la columna «Avisos recibidos» de las ODT abiertas por franja (indicadores-cumplimiento.js):
// al abrir una franja consulta los avisos de sus ODT (por lotes de 10) y escribe en cada celda los umbrales ENVIADOS con
// su fecha («10 d · 20/11 07:12; 15 d · 25/11 07:10») o «Ninguno»; guarda lo leído mientras la vista siga abierta y no
// repite una consulta que ya va en curso (corrector ronda 1).
// Corrector ronda 1 (99 §236): la sección se nombra con el título visible (aria-labelledby); si el resumen no cuenta
// envíos que la tabla muestra, las tarjetas dicen «por recalcular» (no 0) y no sale «ninguna notificación».
// Todo con textContent (nunca innerHTML). Archivo NUEVO a propósito (L-102): a sus vecinos de antes (comun.js y los
// dominios del módulo) solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe } from './comun.js';
import { textoFechaDatos } from '../../domain/odt_afinia_indicadores.js';
import {
  INTRO_NOTIFICACIONES, NOTA_SIN_FILTROS, SIN_NOTIFICACIONES, NOTA_POR_RECALCULAR, VALOR_POR_RECALCULAR, NOTA_TARJETA_POR_RECALCULAR, TITULO_TABLA_NOTIFICACIONES, TITULO_BUSCADOR,
  TITULO_SIN_DESTINATARIO, tituloNotificaciones, destinatariosDe, textoTipoNotificacion, textoEstadoNotificacion, claseEstadoNotificacion,
  fechaDeNotificacion, fechaHoraColombia, haceCuanto, textoCuantasOdt, textoConteo, nroBuscado, textoAvisosRecibidos, textoEstadoAviso, ordenarAvisos
} from '../../domain/odt_afinia_cumplimiento_resumen.js';
import { crearRepositorioNotificaciones } from '../../data/odt_afinia_cumplimiento_notificaciones.js';

export const CARGANDO_NOTIFICACIONES = 'Consultando las notificaciones…';
export const COLS_NOTIFICACIONES = Object.freeze(['Fecha y hora de envío', 'Tipo', 'Para', 'ODT incluidas', 'Estado', 'Datos del informe del']);
export const PIDE_NRO = 'Escriba el N.º de la ODT, como sale en el informe de Afinia.';
const num = (n) => Number(n || 0).toLocaleString('es-CO');
const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) { /* sin foco */ } } };
let serie = 0;
/** Un id único en la página (la vista se puede montar varias veces). */
const nuevoId = (base) => base + (++serie);

/**
 * @param {HTMLElement} zona  la sección donde se pinta (la crea la vista)
 * @param {{corte:object, repo?:object, ahora?:()=>number}} p  repo: el de data/odt_afinia_cumplimiento_notificaciones.js
 * @returns {{cargar:()=>Promise<void>, estado:()=>object}}
 */
export function montarNotificaciones(zona, { corte, repo = null, ahora = () => Date.now() } = {}) {
  vaciar(zona);
  let r = repo;
  const repoDe = () => { if (!r) r = crearRepositorioNotificaciones(); return r; };
  const idTitulo = nuevoId('odtNotTitulo');
  const titulo = h('h3', { id: idTitulo, class: 'odt-subtitulo odt-not-titulo', tabindex: '-1', text: TITULO_SIN_DESTINATARIO });
  // Corrector ronda 1 (99 §236): la sección se nombra con su título visible («Notificaciones a …»), que cambia.
  zona.setAttribute('aria-labelledby', idTitulo);
  const cuerpo = h('div', { class: 'odt-not-cuerpo' });
  zona.append(titulo, h('p', { class: 'odt-mini', text: INTRO_NOTIFICACIONES }), h('p', { class: 'odt-mini odt-not-sin-filtros', text: NOTA_SIN_FILTROS }), cuerpo);
  zona.appendChild(buscador());
  const est = { resumen: null, items: [], hayMas: false, cursor: null, conteo: null, cargado: false };
  let leyendo = null;

  // ── Tarjetas ──
  /** sinCuentas (corrector ronda 1): el resumen no cuenta envíos que sí están en la tabla; sus tarjetas no dicen 0. */
  function tarjetas({ sinCuentas = false } = {}) {
    const x = est.resumen || { enviados: 0, porUmbral: {}, odtAvisadas: 0 };
    const pu = x.porUmbral || {};
    // La última: la del resumen o, si una de la tabla es más nueva (cuentas por recalcular), esa.
    const deTabla = est.items.filter((c) => c && c.estado === 'enviado' && Number.isFinite(c.enviadoEnMs)).map((c) => c.enviadoEnMs);
    const candidatas = [...(Number.isFinite(x.ultimoEnvioEnMs) ? [x.ultimoEnvioEnMs] : []), ...deTabla];
    const ultima = candidatas.length ? Math.max(...candidatas) : null;
    const cuenta = (v, nota) => (sinCuentas ? [VALOR_POR_RECALCULAR, NOTA_TARJETA_POR_RECALCULAR] : [num(v), nota]);
    const cs = [
      ['enviados', 'Notificaciones enviadas', ...cuenta(x.enviados, 'en total')],
      ['u10', 'De 10 días', ...cuenta(pu['10'], 'ejecutar a conformidad')],
      ['u15', 'De 15 días', ...cuenta(pu['15'], 'apresurar el cierre')],
      ['u20', 'De 20 días', ...cuenta(pu['20'], 'incumplimiento')],
      ['odt', 'ODT avisadas', ...cuenta(x.odtAvisadas, 'con al menos un aviso enviado')],
      // Corrector ronda 1: «hora de Colombia» va con la fecha, no con «hace cuánto».
      ['ultima', 'Última notificación', ultima ? fechaHoraColombia(ultima) : '—', ultima ? 'hora de Colombia · ' + haceCuanto(ultima, ahora()) : 'ninguna todavía']
    ];
    const c = est.conteo;
    // Corrector ronda 1: el script solo las recibe si los avisos están activos (la pantalla no lo sabe: no lo promete).
    if (c && c.enCola > 0) cs.push(['cola', 'En cola', textoConteo(c.enCola, c.tope), 'salen con el próximo envío del script, si los avisos siguen activos']);
    if (c && c.conError > 0) cs.push(['error', 'Con error', textoConteo(c.conError, c.tope), 'no se pudieron enviar: el motivo está en la tabla']);
    return h('ul', { class: 'odt-cum-tarjetas odt-not-tarjetas', 'aria-label': 'Notificaciones: totales' },
      cs.map(([clave, t, v, nota]) => h('li', { class: 'odt-cum-tarjeta odt-not-tarjeta odt-not-tarjeta--' + clave },
        h('div', { class: 'odt-cum-tarjeta-caja' },
          h('span', { class: 'odt-cum-tarjeta-valor', text: v }),
          h('span', { class: 'odt-cum-tarjeta-titulo', text: t }),
          h('span', { class: 'odt-cum-tarjeta-nota', text: nota })))));
  }

  // ── La tabla «Cuándo se le notificó» ──
  const tbody = h('tbody', {});
  const stTabla = h('p', { class: 'odt-mini odt-not-estado-tabla', role: 'status', 'aria-live': 'polite' });
  const btnMas = h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Ver más notificaciones' });
  // «Ver más» se pone o se quita (no se esconde con hidden: .odt-acciones tiene display propio y lo pisaría).
  const pieTabla = h('div', { class: 'odt-not-mas' });
  const ponerMas = () => { vaciar(pieTabla); if (est.hayMas) pieTabla.appendChild(h('div', { class: 'odt-acciones' }, btnMas)); };
  function celdaDatos(c) {
    const texto = c.datosDel || (c.corteId === corte.id ? textoFechaDatos(corte) : '') || '—';
    if (c.corteId && c.corteId === corte.id) return h('td', { 'data-etq': 'Datos del informe del', text: texto + ' (este corte)' });
    if (c.corteId) return h('td', { 'data-etq': 'Datos del informe del' }, h('a', { class: 'odt-enlace', href: '#indicadores=' + c.corteId, text: texto === '—' ? 'Ver el corte' : texto }));
    return h('td', { 'data-etq': 'Datos del informe del', text: texto });
  }
  /** La cantidad de ODT y, plegados en un <details> (el navegador dice si está abierto o cerrado), sus N.º. */
  function celdaOdt(c) {
    const nros = Array.isArray(c.nros) ? c.nros : [];
    if (!nros.length) return h('td', { 'data-etq': 'ODT incluidas', text: textoCuantasOdt(0) });
    return h('td', { 'data-etq': 'ODT incluidas', class: 'odt-not-odt' },
      h('details', { class: 'odt-not-nros-det' },
        h('summary', { class: 'odt-not-ver-nros', text: textoCuantasOdt(nros.length) + ' · ver sus N.º' }),
        h('p', { class: 'odt-mini odt-not-nros', text: nros.join(', ') })));
  }
  function fila(c, ahoraMs) {
    return h('tr', {},
      h('th', { scope: 'row', tabindex: '-1', text: fechaDeNotificacion(c) }),
      h('td', { 'data-etq': 'Tipo', text: textoTipoNotificacion(c.umbral) }),
      // Los nombres parten la línea entre palabras; las direcciones de un correo viejo, donde haga falta.
      h('td', { 'data-etq': 'Para', class: Array.isArray(c.paraNombres) && c.paraNombres.length ? null : 'odt-romper', text: destinatariosDe(c) || '—' }),
      celdaOdt(c),
      h('td', { 'data-etq': 'Estado', class: 'odt-not-estado odt-not-estado--' + claseEstadoNotificacion(c), text: textoEstadoNotificacion(c, ahoraMs) }),
      celdaDatos(c));
  }
  function tabla() {
    vaciar(tbody);
    const ahoraMs = ahora();
    for (const c of est.items) tbody.appendChild(fila(c, ahoraMs));
    ponerMas();
    stTabla.textContent = '';
    return h('div', { class: 'odt-not-tabla-zona' },
      h('h4', { class: 'odt-ind-h4', text: TITULO_TABLA_NOTIFICACIONES }),
      h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-tabla-odt odt-not-tabla' },
        h('caption', { class: 'odt-oculto', text: TITULO_TABLA_NOTIFICACIONES + ': la más reciente primero' }),
        h('thead', {}, h('tr', {}, COLS_NOTIFICACIONES.map((t) => h('th', { scope: 'col', text: t })))),
        tbody)),
      pieTabla, stTabla);
  }
  let pidiendoMas = false;
  /** Cambia en cada lectura completa: una página de «Ver más» que llega después de releer el bloque se descarta. */
  let generacion = 0;
  btnMas.addEventListener('click', async () => {
    if (pidiendoMas || !est.hayMas) return;
    pidiendoMas = true; btnMas.disabled = true;
    stTabla.textContent = 'Consultando más notificaciones…';
    const mia = generacion;
    try {
      const p = await repoDe().listar({ despuesDe: est.cursor });
      if (mia !== generacion) { pidiendoMas = false; btnMas.disabled = false; return; }
      const ahoraMs = ahora();
      const nuevas = p.items.map((c) => fila(c, ahoraMs));
      for (const tr of nuevas) tbody.appendChild(tr);
      est.items.push(...p.items); est.hayMas = p.hayMas; est.cursor = p.cursor;
      ponerMas();
      stTabla.textContent = 'Se muestran ' + num(est.items.length) + ' notificaciones' + (est.hayMas ? '.' : ': son todas.');
      if (nuevas.length) enfocar(nuevas[0].childNodes[0]);
    } catch (e) {
      stTabla.textContent = 'No se pudieron consultar más notificaciones: ' + mensajeDe(e) + ' Pulse «Ver más notificaciones» para reintentar.';
    }
    pidiendoMas = false; btnMas.disabled = false;
  });

  // ── Pintar lo leído ──
  function pintar() {
    vaciar(cuerpo);
    titulo.textContent = tituloNotificaciones(est.items[0] || null);
    const x = est.resumen;
    const enviados = x ? x.enviados : 0;
    // Corrector ronda 1 (99 §236): el resumen puede no contar envíos que la tabla sí muestra (la primera suma falló y
    // quedó «porRecalcular» sin cuentas, o hay envíos de antes del resumen). Entonces no se dice «ninguna» ni se pone 0.
    const hayEnviadas = est.items.some((c) => c && c.estado === 'enviado');
    const sinCuentas = !enviados && hayEnviadas;
    const dudosas = !!(x && x.porRecalcular) || sinCuentas;
    if (dudosas) cuerpo.appendChild(aviso(NOTA_POR_RECALCULAR, 'aviso'));
    if (!enviados && !hayEnviadas && !dudosas) cuerpo.appendChild(h('p', { class: 'odt-vacio odt-not-vacio', text: SIN_NOTIFICACIONES }));
    if (!enviados && !est.items.length) return;
    cuerpo.append(tarjetas({ sinCuentas }), tabla());
  }

  async function cargar() {
    if (leyendo) return leyendo;
    leyendo = (async () => {
      generacion++;
      vaciar(cuerpo);
      cuerpo.appendChild(h('p', { class: 'odt-cargando', text: CARGANDO_NOTIFICACIONES }));
      const rp = repoDe();
      // Los conteos de la cola y de los errores son un extra: si fallan, sus tarjetas no salen.
      const conteo = Promise.resolve().then(() => rp.contarPendientes()).catch(() => null);
      try {
        const [resumen, pagina] = await Promise.all([rp.leerResumen(), rp.listar()]);
        est.resumen = resumen; est.items = [...pagina.items]; est.hayMas = pagina.hayMas; est.cursor = pagina.cursor;
        est.conteo = await conteo;
        est.cargado = true;
        pintar();
      } catch (e) {
        await conteo;
        vaciar(cuerpo);
        cuerpo.appendChild(aviso('No se pudieron leer las notificaciones: ' + mensajeDe(e), 'error'));
        cuerpo.appendChild(h('div', { class: 'odt-acciones' }, h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Consultar de nuevo', onclick: () => cargar() })));
      }
    })().finally(() => { leyendo = null; });
    return leyendo;
  }

  // ── El buscador «Historial de avisos de una ODT» ──
  function buscador() {
    const id = nuevoId('odtNotBuscar');
    const input = h('input', { id, class: 'odt-campo odt-not-buscar-campo', type: 'text', maxLength: 40, autocomplete: 'off' });
    const st = h('div', { class: 'odt-estado odt-not-buscar-resultado', role: 'status', 'aria-live': 'polite' });
    const form = h('form', { class: 'odt-not-buscar', role: 'search', 'aria-label': TITULO_BUSCADOR },
      h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: id, text: 'N.º de la ODT' }), input),
      h('div', { class: 'odt-acciones' }, h('button', { type: 'submit', class: 'odt-btn odt-btn--chico', text: 'Buscar' })));
    let turno = 0;
    form.addEventListener('submit', async (ev) => {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      const nro = nroBuscado(input.value);
      vaciar(st);
      if (!nro) { st.appendChild(aviso(PIDE_NRO, 'error')); enfocar(input); return; }
      const mio = ++turno;
      st.appendChild(h('p', { class: 'odt-cargando', text: 'Consultando los avisos de la ODT ' + nro + '…' }));
      let xs;
      try { xs = await repoDe().avisosDeOdt(nro); } catch (e) {
        if (mio !== turno) return;
        vaciar(st); st.appendChild(aviso('No se pudieron consultar los avisos: ' + mensajeDe(e), 'error'));
        return;
      }
      if (mio !== turno) return;     // llegó una búsqueda más nueva
      vaciar(st);
      if (!xs.length) {
        st.appendChild(h('p', { class: 'odt-vacio', text: 'La ODT ' + nro + ' no tiene avisos registrados: todavía no ha llegado a 10 días desde su ejecución en un corte guardado del responsable configurado (o el N.º no es ese).' }));
        return;
      }
      // El resumen va en un párrafo a la vista (en fichas, el caption de la tabla quedaría angosto) y en el caption oculto.
      const resumen = 'Avisos de la ODT ' + nro + ' (enviados: ' + textoAvisosRecibidos(xs).toLowerCase() + ')';
      st.appendChild(h('p', { class: 'odt-mini odt-not-buscar-resumen', text: resumen + ':' }));
      st.appendChild(h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-not-tabla-avisos' },
        h('caption', { class: 'odt-oculto', text: resumen }),
        h('thead', {}, h('tr', {}, ['Aviso', 'Estado', 'Fecha'].map((t) => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, ordenarAvisos(xs).map((a) => h('tr', {},
          h('th', { scope: 'row', text: textoTipoNotificacion(a.umbral) }),
          h('td', { 'data-etq': 'Estado', class: 'odt-not-estado odt-not-estado--' + (a.estado === 'enviado' ? 'enviado' : a.estado === 'reservado' ? 'cola' : a.estado === 'error' ? 'error' : 'reemplazado'), text: textoEstadoAviso(a) }),
          h('td', { 'data-etq': 'Fecha', text: fechaHoraColombia(a.enMs) })))))));
    });
    return h('div', { class: 'odt-not-buscador' }, h('h4', { class: 'odt-ind-h4', text: TITULO_BUSCADOR }),
      h('p', { class: 'odt-mini', text: 'Escriba el N.º de una ODT para ver qué avisos recibió, cuándo y en qué quedó cada uno.' }), form, st);
  }

  cargar();
  return { cargar, estado: () => ({ ...est, items: [...est.items], leyendo: !!leyendo }) };
}

/**
 * La columna «Avisos recibidos» de las ODT abiertas por franja (indicadores-cumplimiento.js): las celdas llevan la clase
 * `odt-cum-avisos-odt` y el N.º en data-nro; al abrir la franja (o si ya está abierta) se consultan sus avisos y se
 * escriben los umbrales ENVIADOS con su fecha, o «Ninguno».
 * @param {{repo:()=>object}} p  repo: devuelve el de data/odt_afinia_cumplimiento_notificaciones.js
 * @returns {{enlazar:(det:HTMLElement)=>void, cache:Map}}
 */
export function crearAvisosPorOdt({ repo } = {}) {
  const cache = new Map();
  /** Corrector ronda 1 (99 §236): N.º → la consulta que ya va por él (no se pide dos veces lo mismo a la vez). */
  const enCurso = new Map();
  let r = null;
  const repoDe = () => { if (!r) r = (typeof repo === 'function' && repo()) || crearRepositorioNotificaciones(); return r; };
  const celdas = (det) => Array.from(det.querySelectorAll('.odt-cum-avisos-odt'));
  const escribir = (det) => { for (const td of celdas(det)) { const n = td.getAttribute('data-nro'); if (cache.has(n)) td.textContent = textoAvisosRecibidos(cache.get(n)); } };
  async function cargar(det) {
    const nros = [...new Set(celdas(det).map((td) => td.getAttribute('data-nro')).filter((n) => n && !cache.has(n)))];
    // Una franja que nace abierta se carga en enlazar y el navegador además dispara «toggle»: lo que ya se está
    // consultando se espera, no se vuelve a pedir.
    const faltan = nros.filter((n) => !enCurso.has(n));
    const esperas = [...new Set(nros.filter((n) => enCurso.has(n)).map((n) => enCurso.get(n)))];
    if (!faltan.length && !esperas.length) { escribir(det); return; }
    for (const td of celdas(det)) if (!cache.has(td.getAttribute('data-nro'))) td.textContent = 'Consultando…';
    if (faltan.length) {
      const p = Promise.resolve().then(() => repoDe().avisosDeOdts(faltan))
        .then((m) => { for (const n of faltan) cache.set(n, m.get(n) || []); })
        .finally(() => { for (const n of faltan) enCurso.delete(n); });
      for (const n of faltan) enCurso.set(n, p);
      esperas.push(p);
    }
    await Promise.all(esperas.map((p) => p.catch(() => null)));
    escribir(det);
    for (const td of celdas(det)) if (!cache.has(td.getAttribute('data-nro'))) td.textContent = 'No se pudo consultar (cierre y abra la franja para reintentar)';
  }
  function enlazar(det) {
    det.addEventListener('toggle', () => { if (det.open) cargar(det); });
    if (det.open || det.getAttribute('open') !== null) cargar(det);
  }
  return { enlazar, cache };
}
