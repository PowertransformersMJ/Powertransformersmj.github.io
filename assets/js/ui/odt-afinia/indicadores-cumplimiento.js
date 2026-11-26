// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · «Cumplimiento del cierre (20 días desde la ejecución)» · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// La sección de la vista de un corte (indicadores-vista.js la monta y le pasa, en cada repintado, las ODT que cumplen
// los filtros de arriba: periodo, tipo, zona, contratista, AZT y jefe). La ven el administrador y los lectores:
//   · tarjetas: evaluables, cerradas a tiempo, cerradas fuera de plazo, abiertas vencidas, % de cumplimiento y mediana
//     de días al cierre (con qué es cada una, plegado);
//   · tabla por contratista;
//   · las ODT abiertas (EJECUTADA) por franja de días desde la ejecución (0–9, 10–14, 15–19, 20 = vence hoy, > 20 =
//     vencidas), cada franja plegada con su lista (N.º, contratista, subestación, equipo, ejecución, días, fecha límite
//     y próximo aviso, con la aclaración de que el correo sale al guardar un corte); desde el pedido del 2026-11-26
//     («cuándo y cuántas veces notificas», 99 §236), también «Avisos recibidos»: los umbrales ENVIADOS hasta hoy con su
//     fecha o «Ninguno», que se consultan al abrir la franja, en todas (corrector ronda 1: también la de 0 a 9 días)
//     (crearAvisosPorOdt, en indicadores-notificaciones.js);
//   · la lista aparte de «fechas por revisar» (fuera del %, sin avisos), con su motivo;
//   · el historial de correos de aviso (odt_afinia_correos), plegado: se lee AL ABRIRLO (no gasta lecturas si nadie lo
//     mira), el más reciente primero, con su estado en llano (99 §236: «En cola: lo enviará el script de Google en los
//     próximos minutos», «Enviándose…», «Enviado el…», «No se pudo enviar: …»; textoEstadoCorreo). Al administrador,
//     además, «Revisar y enviar los avisos de este corte» en DOS pasos (llama a la Cloud Function
//     reprocesarAvisosCumplimiento: deja en cola lo que falte y devuelve a la cola lo que falló; lo ya enviado no se
//     repite). En PANTALLA, las direcciones de los destinatarios y de las copias solo las ve el administrador; al
//     lector, cuántos son. OJO (corrector 99 §236): es solo de presentación. La regla deja leer al lector el documento
//     entero del correo (para, cc, asunto, texto y html, con los nombres del saludo); separarlos en un documento que
//     solo lea el servidor queda pendiente.
// Un corte de la versión 1 o 2 no guardó la fecha de ejecución: la sección lo dice en llano (SIN_EJECUCION_CORTE).
// Todo con textContent (nunca innerHTML). Archivo NUEVO a propósito (L-102): a sus vecinos de antes (comun.js,
// domain/odt_afinia_indicadores.js) solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe, fechaHora } from './comun.js';
import { fechaDMA, textoFechaDatos } from '../../domain/odt_afinia_indicadores.js';
import {
  TITULO_CUMPLIMIENTO, INTRO_CUMPLIMIENTO, SIN_EJECUCION_CORTE, SIN_EJECUCION_CORTE_LECTOR, TARJETAS_CUMPLIMIENTO, MOTIVOS_REVISAR,
  corteTraeEjecucion, fechaDelCorte, evaluarCumplimiento, textoCumplimiento, textoDias, textoProximoAviso, divisorCumplimiento, pctCumplimiento
} from '../../domain/odt_afinia_cumplimiento.js';
import { textoResultadoReproceso, ETIQUETA_UMBRAL, textoEstadoCorreo } from '../../domain/odt_afinia_cumplimiento_avisos.js';
import { crearRepositorioCumplimiento } from '../../data/odt_afinia_cumplimiento.js';
// 99 §236 (pedido del 2026-11-26, «cuándo y cuántas veces notificas»): la columna «Avisos recibidos» de cada ODT abierta.
import { crearAvisosPorOdt } from './indicadores-notificaciones.js';

/** Cuántas ODT se pintan en cada lista plegada (el resto se cuenta). */
export const TOPE_LISTA_CUMPLIMIENTO = 200;
export const TITULO_CORREOS = 'Correos de aviso';
export const NOTA_CORREOS = 'Los avisos se revisan cada vez que se guarda un corte del responsable configurado (y a pedido del administrador) y quedan en cola; los envía un script de Google desde la cuenta remitente en los minutos siguientes. Cada ODT recibe cada aviso una sola vez.';
export const SIN_CORREOS = 'Todavía no hay correos de aviso.';
const num = (n) => Number(n || 0).toLocaleString('es-CO');
const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) { /* sin foco */ } } };
const sigueEn = (nodo, contenedor) => { for (let n = nodo; n; n = n.parentNode) if (n === contenedor) return true; return false; };
/** La raíz de un nodo (en la página, el documento): si la vista se cierra, la sección deja de colgar de ella. */
const raizDe = (nodo) => { let r = nodo; while (r && r.parentNode) r = r.parentNode; return r; };
/** Bajo las franjas: la fecha de «Próximo aviso» es cuándo la ODT llega al umbral, no cuándo sale el correo. */
export const NOTA_PROXIMO_AVISO = '«Próximo aviso» es la fecha en que la ODT llega a ese umbral. El correo queda en cola cuando se guarda el primer corte desde esa fecha (si los avisos están activos y el corte es del responsable configurado) y sale en los minutos siguientes.';
/** Corrector ronda 1 (99 §236): «Avisos recibidos» es lo enviado hasta hoy, no a la fecha de este corte. */
export const NOTA_AVISOS_RECIBIDOS = '«Avisos recibidos» son los avisos enviados hasta hoy, no hasta la fecha de este corte.';
/** Las columnas de la tabla por contratista: [clave, encabezado]. */
const COLS_CONTRATISTA = Object.freeze([
  ['evaluables', 'Evaluables'], ['cerradasATiempo', 'Cerradas a tiempo'], ['cerradasFuera', 'Cerradas fuera de plazo'],
  ['abiertasEnPlazo', 'Abiertas en plazo'], ['abiertasVencidas', 'Abiertas vencidas'], ['revisar', 'Fecha por revisar']
]);

/**
 * @param {HTMLElement} zona  la sección donde se pinta (la crea la vista)
 * @param {{corte:object, soloLectura?:boolean, repoCumplimiento?:object, repoNotificaciones?:object, alReprocesar?:()=>void}} p
 *   soloLectura: un lector (no admin): sin «Revisar y enviar los avisos de este corte»
 *   repoNotificaciones (99 §236): el de data/odt_afinia_cumplimiento_notificaciones.js, para la columna «Avisos
 *   recibidos» (si no llega, se crea al abrir la primera franja) · alReprocesar: después del reproceso (la vista
 *   vuelve a leer el bloque «Notificaciones a …»)
 * @returns {{pintar:(odts:object[])=>void, abrirCorreos:()=>Promise<void>, estado:()=>object}}
 */
export function montarCumplimiento(zona, { corte, soloLectura = false, repoCumplimiento = null, repoNotificaciones = null, alReprocesar = null } = {}) {
  vaciar(zona);
  let repo = repoCumplimiento;
  const repoDe = () => { if (!repo) repo = crearRepositorioCumplimiento(); return repo; };
  const avisosOdt = crearAvisosPorOdt({ repo: () => repoNotificaciones });
  const conEjecucion = corteTraeEjecucion(corte);
  const fechaCorte = conEjecucion ? fechaDelCorte(corte) : '';
  zona.appendChild(h('h3', { class: 'odt-subtitulo odt-cum-titulo', tabindex: '-1', text: TITULO_CUMPLIMIENTO }));
  zona.appendChild(h('p', { class: 'odt-mini', text: INTRO_CUMPLIMIENTO }));
  const cuerpo = h('div', { class: 'odt-cum-cuerpo' });
  zona.appendChild(cuerpo);
  if (!conEjecucion) cuerpo.appendChild(h('p', { class: 'odt-vacio odt-cum-sin-ejecucion', text: soloLectura ? SIN_EJECUCION_CORTE_LECTOR : SIN_EJECUCION_CORTE }));
  else cuerpo.appendChild(h('p', { class: 'odt-mini', text: 'Los días de las ODT abiertas se cuentan hasta la fecha de los datos del corte: ' + fechaDMA(fechaCorte) + ' (datos del ' + textoFechaDatos(corte) + ').' }));
  const resumen = h('p', { class: 'odt-mini odt-cum-resumen', role: 'status' });
  const zonaNumeros = h('div', { class: 'odt-cum-numeros' });
  if (conEjecucion) cuerpo.append(resumen, zonaNumeros);
  /** Las franjas abiertas (para conservarlas abiertas al repintar con otros filtros). */
  const abiertas = new Set();
  let ultimo = null;

  // ── Tarjetas ──
  function tarjetas(ev) {
    const t = ev.totales;
    const valor = {
      evaluables: num(t.evaluables), cerradasATiempo: num(t.cerradasATiempo), cerradasFuera: num(t.cerradasFuera),
      abiertasVencidas: num(t.abiertasVencidas), pct: textoCumplimiento(t), mediana: textoDias(ev.mediana)
    };
    const nota = {
      pct: num(t.cerradasATiempo) + ' de ' + num(divisorCumplimiento(t)),
      evaluables: num(t.cerradas) + ' cerradas · ' + num(t.abiertas) + ' abiertas',
      mediana: num(t.cerradas) + ' cerradas evaluables'
    };
    // Clases propias (odt-cum-…): las tarjetas de arriba (odt-ind-…) siguen siendo solo las de los estados.
    return h('ul', { class: 'odt-cum-tarjetas', 'aria-label': 'Cumplimiento del cierre: totales' },
      TARJETAS_CUMPLIMIENTO.map((x) => h('li', { class: 'odt-cum-tarjeta odt-cum-tarjeta--' + x.clave },
        h('div', { class: 'odt-cum-tarjeta-caja' },
          h('span', { class: 'odt-cum-tarjeta-valor', text: valor[x.clave] }),
          h('span', { class: 'odt-cum-tarjeta-titulo', text: x.titulo }),
          nota[x.clave] ? h('span', { class: 'odt-cum-tarjeta-nota', text: nota[x.clave] }) : null))));
  }
  function definiciones() {
    return h('details', { class: 'odt-detalles odt-ind-plegable odt-cum-definiciones' },
      h('summary', { text: 'Qué es cada indicador de cumplimiento' }),
      h('dl', { class: 'odt-ind-definiciones' }, TARJETAS_CUMPLIMIENTO.flatMap((x) => [h('dt', { text: x.titulo }), h('dd', { text: x.definicion })]),
        h('dt', { text: 'Fecha por revisar' }), h('dd', { text: 'ODT EJECUTADA o CERRADA con una fecha que no se puede usar (vacía, ilegible, con un año fuera de 2020–2030, una ejecución posterior a la fecha del corte o un cierre anterior a la ejecución). No entra en el % ni recibe avisos: revísela en Afinia.' })));
  }

  // ── Por contratista ──
  function tablaContratistas(ev) {
    const fila = (titulo, c, total = false) => h('tr', { class: total ? 'odt-ind-total' : null },
      h('th', { scope: 'row', text: titulo }),
      COLS_CONTRATISTA.map(([k, nombre]) => h('td', { class: 'odt-ind-n' + ((k === 'abiertasVencidas' || k === 'cerradasFuera') && c[k] > 0 ? ' odt-cum-incumple' : ''), 'data-etq': nombre, text: num(c[k]) })),
      h('td', { class: 'odt-ind-n', 'data-etq': '% de cumplimiento', text: textoCumplimiento(c) }),
      h('td', { class: 'odt-ind-n', 'data-etq': 'Mediana de días al cierre', text: textoDias(c.mediana) }));
    return h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-fichas odt-cum-tabla-contratistas' },
      h('caption', { class: 'odt-ind-caption', text: 'Por contratista (los que más incumplen, primero)' }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', class: 'odt-ind-col1', text: 'Contratista' }),
        COLS_CONTRATISTA.map(([, nombre]) => h('th', { scope: 'col', class: 'odt-ind-n', text: nombre })),
        h('th', { scope: 'col', class: 'odt-ind-n', text: '% de cumplimiento' }), h('th', { scope: 'col', class: 'odt-ind-n', text: 'Mediana de días al cierre' }))),
      h('tbody', {}, ev.porEmpresa.map((g) => fila(g.clave, g))),
      h('tfoot', {}, fila('Total', { ...ev.totales, mediana: ev.mediana }, true))));
  }

  // ── Listas (abiertas por franja y fechas por revisar) ──
  function tablaOdt(titulo, xs, columnas) {
    const visibles = xs.slice(0, TOPE_LISTA_CUMPLIMIENTO);
    return h('div', {},
      h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-tabla-odt odt-cum-tabla-odt' },
        h('caption', { class: 'odt-oculto', text: titulo }),
        h('thead', {}, h('tr', {}, columnas.map(([t]) => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, visibles.map((e) => h('tr', {}, columnas.map(([t, f, clase], i) => (i === 0
          ? h('th', { scope: 'row', class: 'odt-mono', text: f(e) })
          : h('td', { 'data-etq': t, class: clase || null, 'data-nro': clase ? e.o.nro : null, text: f(e) })))))))),
      xs.length > visibles.length ? h('p', { class: 'odt-mini', text: 'Se muestran las primeras ' + num(TOPE_LISTA_CUMPLIMIENTO) + ' de ' + num(xs.length) + '.' }) : null);
  }
  const COLS_ABIERTAS = Object.freeze([
    ['N.º', (e) => e.o.nro], ['Contratista', (e) => e.o.empresa || '—'], ['Subestación', (e) => e.o.subestacion || '—'],
    ['Equipo', (e) => e.o.equipo || '—'],
    ['Ejecución', (e) => fechaDMA(e.o.ejecucion)], ['Días', (e) => num(e.dias)], ['Fecha límite', (e) => fechaDMA(e.limite)],
    ['Próximo aviso', (e) => textoProximoAviso(e)],
    // 99 §236: los avisos ENVIADOS con su fecha, hasta HOY (se consultan al abrir la franja). Corrector ronda 1: también
    // en la de 0 a 9 días, porque en un corte viejo esa ODT pudo recibir sus avisos después.
    ['Avisos recibidos', () => '—', 'odt-cum-avisos-odt']
  ]);
  const COLS_REVISAR = Object.freeze([
    ['N.º', (e) => e.o.nro], ['Contratista', (e) => e.o.empresa || '—'], ['Subestación', (e) => e.o.subestacion || '—'],
    ['Estado en Afinia', (e) => e.o.estado || '—'], ['Ejecución', (e) => fechaDMA(e.o.ejecucion)], ['Cierre', (e) => fechaDMA(e.o.cerrada)],
    ['Motivo', (e) => MOTIVOS_REVISAR[e.motivo] || e.motivo]
  ]);
  function franjas(ev) {
    const caja = h('div', { class: 'odt-cum-franjas' });
    caja.appendChild(h('h4', { class: 'odt-ind-h4', text: 'ODT abiertas (EJECUTADA) por días desde la ejecución: ' + num(ev.abiertas.length) }));
    caja.appendChild(h('ul', { class: 'odt-cum-franjas-lista', 'aria-label': 'ODT abiertas por franja de días' },
      // «18 ODT con 0 a 9 días» para el lector de pantalla (a la vista: el número en negrita y la franja).
      ev.franjas.map((f) => h('li', { class: 'odt-cum-franja odt-cum-franja--' + f.clave },
        h('span', { class: 'odt-cum-franja-n', text: num(f.odts.length) }), h('span', { class: 'odt-oculto', text: ' ODT con' }), h('span', { text: ' ' + f.titulo })))));
    if (ev.abiertas.length) caja.append(h('p', { class: 'odt-mini odt-cum-nota-aviso', text: NOTA_PROXIMO_AVISO }), h('p', { class: 'odt-mini odt-cum-nota-recibidos', text: NOTA_AVISOS_RECIBIDOS }));
    for (const f of ev.franjas) {
      if (!f.odts.length) continue;
      const det = h('details', { class: 'odt-detalles odt-ind-plegable odt-cum-franja-detalle', open: abiertas.has(f.clave) ? '' : null },
        h('summary', { text: f.titulo + ' (' + num(f.odts.length) + ')' }), tablaOdt('ODT abiertas · ' + f.titulo, f.odts, COLS_ABIERTAS));
      det.addEventListener('toggle', () => { if (det.open) abiertas.add(f.clave); else abiertas.delete(f.clave); });
      avisosOdt.enlazar(det);
      caja.appendChild(det);
    }
    return caja;
  }
  function revisar(ev) {
    if (!ev.revisar.length) return h('p', { class: 'odt-mini odt-cum-revisar-vacio', text: 'Fechas por revisar: ninguna.' });
    const det = h('details', { class: 'odt-detalles odt-ind-plegable odt-cum-revisar', open: abiertas.has('revisar') ? '' : null },
      h('summary', { text: 'Fechas por revisar (' + num(ev.revisar.length) + '): fuera del %, sin avisos' }), tablaOdt('Fechas por revisar', ev.revisar, COLS_REVISAR));
    det.addEventListener('toggle', () => { if (det.open) abiertas.add('revisar'); else abiertas.delete('revisar'); });
    return det;
  }

  /** Repinta con las ODT que cumplen los filtros de la vista. */
  function pintar(odts) {
    if (!conEjecucion) return;
    const ev = evaluarCumplimiento(odts || [], fechaCorte);
    ultimo = ev;
    const t = ev.totales;
    const enCuenta = t.evaluables + t.revisar;
    resumen.textContent = enCuenta
      ? num(enCuenta) + ' ODT EJECUTADA o CERRADA con estos filtros: ' + num(t.evaluables) + ' evaluables y ' + num(t.revisar) + ' con fecha por revisar. % de cumplimiento: ' + textoCumplimiento(t) + (pctCumplimiento(t) == null ? ' (todavía sin veredicto)' : '') + '.'
      : 'Con estos filtros no hay ODT EJECUTADA ni CERRADA que evaluar.';
    vaciar(zonaNumeros);
    zonaNumeros.append(tarjetas(ev), definiciones(), tablaContratistas(ev), franjas(ev), revisar(ev));
  }

  // ── Correos de aviso (plegado; se lee al abrirlo) ──
  const zonaCorreos = h('div', { class: 'odt-cum-correos-cuerpo' });
  const zonaEnvio = h('div', { class: 'odt-cum-revisar-envio' });
  const st = h('div', { class: 'odt-estado odt-cum-estado', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const detCorreos = h('details', { class: 'odt-detalles odt-ind-plegable odt-cum-correos' },
    h('summary', { text: TITULO_CORREOS }), h('p', { class: 'odt-mini', text: NOTA_CORREOS }), zonaEnvio, st, zonaCorreos);
  zona.appendChild(detCorreos);
  let correosCargados = false; let leyendo = null; let enviando = false;
  if (!soloLectura && conEjecucion) {
    const btnRevisar = h('button', { type: 'button', class: 'odt-btn', text: 'Revisar y enviar los avisos de este corte' });
    const btnSi = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Sí, revisar y enviar' });
    const btnNo = h('button', { type: 'button', class: 'odt-btn', text: 'Cancelar' });
    // Contenedores sin `display` propio (o la caja .odt-confirmar): `hidden` sí los esconde en el navegador.
    const pasoGuardar = h('div', {}, h('div', { class: 'odt-acciones' }, btnRevisar));
    const caja = h('div', { class: 'odt-confirmar', role: 'group', 'aria-label': 'Confirmar el envío de los avisos', hidden: true },
      h('p', { class: 'odt-parrafo', text: 'Se revisarán las ODT abiertas de este corte y quedarán en cola los avisos que falten (como mucho un correo por umbral: 10, 15 y 20 días); los que fallaron vuelven a intentarse. El script de Google de la cuenta remitente los envía en los minutos siguientes. Lo que ya se envió no se repite. Solo genera avisos si este corte es del responsable configurado y es el de datos más recientes.' }),
      h('div', { class: 'odt-acciones' }, btnSi, btnNo));
    zonaEnvio.append(pasoGuardar, caja);
    btnRevisar.addEventListener('click', () => { if (enviando) return; vaciar(st); pasoGuardar.hidden = true; caja.hidden = false; enfocar(btnSi); });
    btnNo.addEventListener('click', () => { if (enviando) return; caja.hidden = true; pasoGuardar.hidden = false; enfocar(btnRevisar); });
    btnSi.addEventListener('click', async () => {
      if (enviando || caja.hidden) return;
      enviando = true; btnSi.disabled = true; btnNo.disabled = true;
      // Para saber, al volver, si la vista sigue abierta (si se cerró, no se pinta ni se vuelve a leer nada).
      const raiz = raizDe(zona);
      vaciar(st); st.appendChild(h('p', { class: 'odt-cargando', text: 'Revisando el corte y dejando los avisos en cola… (puede tardar un minuto)' }));
      let texto = ''; let tipo = 'ok';
      try { texto = textoResultadoReproceso(await repoDe().reprocesar(corte.id)); } catch (e) { texto = mensajeDe(e); tipo = 'error'; }
      enviando = false; btnSi.disabled = false; btnNo.disabled = false;
      caja.hidden = true; pasoGuardar.hidden = false;
      if (!sigueEn(zona, raiz)) return;
      vaciar(st); st.appendChild(aviso(texto, tipo));
      enfocar(st);
      if (typeof alReprocesar === 'function') { try { alReprocesar(); } catch (_) { /* el bloque de notificaciones sigue como estaba */ } }
      await cargarCorreos(true);
    });
  }
  async function cargarCorreos(forzar = false) {
    if (leyendo) return leyendo;
    if (correosCargados && !forzar) return undefined;
    leyendo = (async () => {
      vaciar(zonaCorreos);
      zonaCorreos.appendChild(h('p', { class: 'odt-cargando', text: 'Consultando los correos de aviso…' }));
      let xs;
      try { xs = await repoDe().listarCorreos(); } catch (e) {
        vaciar(zonaCorreos);
        zonaCorreos.appendChild(aviso('No se pudieron leer los correos de aviso: ' + mensajeDe(e), 'error'));
        zonaCorreos.appendChild(h('div', { class: 'odt-acciones' }, h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Reintentar', onclick: () => cargarCorreos(true) })));
        return;
      }
      correosCargados = true;
      vaciar(zonaCorreos);
      if (!xs.length) { zonaCorreos.appendChild(h('p', { class: 'odt-vacio', text: SIN_CORREOS })); return; }
      const ahoraMs = Date.now();     // un «en_envio» con el préstamo vencido lo dice (corrector 99 §236)
      // En pantalla, las direcciones (Para y Copia) solo al administrador; al lector, cuántas (solo presentación: ver la cabecera).
      const cols = soloLectura ? ['Creado el', 'Aviso', 'ODT', 'Destinatarios', 'Estado', 'Corte'] : ['Creado el', 'Aviso', 'ODT', 'Para', 'Copia', 'Estado', 'Corte'];
      const cuantos = (c) => { const p = (c.para || []).length; const k = (c.cc || []).length; return num(p) + (p === 1 ? ' destinatario' : ' destinatarios') + (k ? ' y ' + num(k) + ' en copia' : ''); };
      const celdasDestino = (c) => (soloLectura
        ? [h('td', { 'data-etq': 'Destinatarios', text: cuantos(c) })]
        : [h('td', { 'data-etq': 'Para', class: 'odt-romper', text: (c.para || []).join(', ') || '—' }),
          h('td', { 'data-etq': 'Copia', class: 'odt-romper', text: (c.cc || []).join(', ') || '—' })]);
      zonaCorreos.appendChild(h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-tabla-odt odt-cum-tabla-correos' },
        h('caption', { class: 'odt-ind-caption', text: 'Los ' + num(xs.length) + ' más recientes, el último primero.' }),
        h('thead', {}, h('tr', {}, cols.map((c) => h('th', { scope: 'col', text: c })))),
        h('tbody', {}, xs.map((c) => h('tr', {},
          h('th', { scope: 'row', text: fechaHora(c.creadoEnMs) }),
          h('td', { 'data-etq': 'Aviso', text: ETIQUETA_UMBRAL[c.umbral] || String(c.umbral || '—') }),
          h('td', { 'data-etq': 'ODT', class: 'odt-romper', text: num((c.nros || []).length) + ((c.nros || []).length ? ': ' + c.nros.slice(0, 12).join(', ') + (c.nros.length > 12 ? '…' : '') : '') }),
          ...celdasDestino(c),
          h('td', { 'data-etq': 'Estado', class: 'odt-cum-correo--' + (c.estado || 'pendiente'), text: textoEstadoCorreo(c, fechaHora, ahoraMs) }),
          h('td', { 'data-etq': 'Corte' }, c.corteId === corte.id ? h('strong', { text: 'Este corte' }) : h('a', { class: 'odt-enlace', href: '#indicadores=' + c.corteId, text: 'Ver el corte' }))))))));
    })().finally(() => { leyendo = null; });
    return leyendo;
  }
  detCorreos.addEventListener('toggle', () => { if (detCorreos.open && !correosCargados && !leyendo) cargarCorreos(); });

  return { pintar, abrirCorreos: () => cargarCorreos(true), estado: () => ({ conEjecucion, fechaCorte, evaluacion: ultimo, correosCargados, enviando }) };
}
