// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE · RESUMEN DE NOTIFICACIONES (lógica PURA) · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): «me gustaría que en SGM, en mi sesión, pueda apreciar cuándo y cuántas veces
// notificas» al destinatario de los avisos de cumplimiento (10, 15 y 20 días desde la ejecución). Decisiones (99 §236):
//   · El RESUMEN lo escribe SOLO el servidor: odt_afinia_config/cumplimiento_resumen {enviados, porUmbral {'10', '15',
//     '20'}, odtAvisadas, primerEnvioEn, ultimoEnvioEn, actualizadoEn, porRecalcular}. Lo leen el administrador y los
//     lectores de Indicadores (firestore.rules); nadie lo escribe desde la página.
//   · Se suma en la MISMA transacción en que un correo pasa a «enviado» (el resultado ok que informa el script de Google,
//     functions/cumplimiento_remitente.mjs → cerrar). Un resultado repetido no pasa el correo a «enviado» otra vez
//     (decidirResultado → 'repetido'), así que no se cuenta dos veces.
//   · odtAvisadas = cuántos N.º DISTINTOS salieron en al menos un correo enviado. Sube solo con los N.º del correo que
//     NO estaban en ningún otro correo ya enviado (lo consulta la transacción, por tandas: sumarEnvio). Es la misma
//     cuenta que hace el recálculo (recalcularResumen), así que los dos caminos dicen lo mismo.
//   · El reproceso del administrador (reprocesarAvisosCumplimiento) además RECALCULA el resumen desde los correos
//     enviados (corrige lo que hiciera falta). Si la suma de un envío fallara (la consulta, por ejemplo), el envío se
//     registra igual —si no, el script lo volvería a mandar— y el resumen queda «porRecalcular» hasta ese recálculo.
//   · Cada correo NUEVO guarda los NOMBRES de sus destinatarios (paraNombres, de config.para[].nombre) y la fecha de los
//     datos del corte (datosDel): la pantalla dice a quién se notificó sin leer la configuración (los lectores no la
//     leen). Un correo viejo sin paraNombres muestra sus direcciones.
// Aquí: las cuentas (sumarEnvio, recalcularResumen) y lo que dice la pantalla (bloque «Notificaciones a …» de la vista
// del corte, indicadores-notificaciones.js), en llano y en la hora de Colombia (UTC−5, sin horario de verano).
// Sin Firebase, sin DOM, sin red (copiado a functions/domain por functions/prepare-deploy.mjs).
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { limpiar } from './odt_afinia_indicadores.js';
import { UMBRALES_AVISO } from './odt_afinia_cumplimiento.js';
import { listaNombres, TEXTO_REEMPLAZADO } from './odt_afinia_cumplimiento_avisos.js';

/** El documento del resumen: lo escribe SOLO el servidor; lo leen el admin y los lectores (firestore.rules). */
export const COL_RESUMEN = Object.freeze({ col: 'odt_afinia_config', doc: 'cumplimiento_resumen' });
/** Cuántos N.º van en cada consulta «array-contains-any» de la transacción (el tope de Firestore es 30). */
export const LOTE_CONTIENE = 30;
/** Tamaño de cada página de correos enviados en el recálculo. */
export const PAGINA_RECALCULO = 300;
/** Las claves de porUmbral (texto: así quedan en el documento). */
export const CLAVES_UMBRAL = Object.freeze(UMBRALES_AVISO.map(String));

const entero = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
/** {'10': 0, '15': 0, '20': 0} */
export const porUmbralVacio = () => Object.fromEntries(CLAVES_UMBRAL.map((k) => [k, 0]));
/** Los contadores de un resumen leído (o null): enteros ≥ 0, nunca undefined. */
export function contadoresResumen(d) {
  const x = d && typeof d === 'object' ? d : {};
  const pu = x.porUmbral && typeof x.porUmbral === 'object' ? x.porUmbral : {};
  return { enviados: entero(x.enviados), porUmbral: Object.fromEntries(CLAVES_UMBRAL.map((k) => [k, entero(pu[k])])), odtAvisadas: entero(x.odtAvisadas) };
}
/** Los N.º distintos de un correo (textos no vacíos), en su orden. */
export const nrosDistintos = (xs) => [...new Set((Array.isArray(xs) ? xs : []).filter((n) => typeof n === 'string' && n))];
/** Una lista en tandas de `n`. */
export function enLotes(xs, n) {
  const out = [];
  for (let i = 0; i < (xs || []).length; i += n) out.push(xs.slice(i, i + n));
  return out;
}
/** Milisegundos de una marca de tiempo (Timestamp de Firestore, {ms} de los dobles, número o Date); null si no hay. */
export function msDeMarca(t) {
  if (t == null) return null;
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'object' && Number.isFinite(t.ms)) return t.ms;
  return null;
}

/**
 * Lo que suma UN correo que acaba de pasar a «enviado».
 * @param {object|null} previo  el resumen guardado (o null)
 * @param {{umbral:number, nros:string[]}} correo
 * @param {Set<string>} yaAvisadas  los N.º de ese correo que ya salieron en OTRO correo enviado
 * @returns {{enviados:number, porUmbral:object, odtAvisadas:number, nuevas:number}}  nuevas: las ODT que se suman
 */
export function sumarEnvio(previo, correo, yaAvisadas = new Set()) {
  const c = contadoresResumen(previo);
  const ya = yaAvisadas instanceof Set ? yaAvisadas : new Set();
  const nuevas = nrosDistintos(correo && correo.nros).filter((n) => !ya.has(n)).length;
  const k = String(correo && correo.umbral);
  const porUmbral = { ...c.porUmbral };
  if (k in porUmbral) porUmbral[k] += 1;
  return { enviados: c.enviados + 1, porUmbral, odtAvisadas: c.odtAvisadas + nuevas, nuevas };
}

/**
 * El resumen recalculado desde los correos ENVIADOS (el recálculo del reproceso).
 * @param {Array<{umbral:number, nros:string[], enviadoEn:any}>} correos  solo los de estado «enviado»
 * @returns {{enviados:number, porUmbral:object, odtAvisadas:number, primerEnvioEn:any, ultimoEnvioEn:any}}
 *   primerEnvioEn / ultimoEnvioEn: la marca tal como venía (null si ninguno la trae)
 */
export function recalcularResumen(correos) {
  const porUmbral = porUmbralVacio();
  const odt = new Set();
  let enviados = 0; let primero = null; let ultimo = null;
  for (const c of correos || []) {
    if (!c || typeof c !== 'object') continue;
    enviados++;
    const k = String(c.umbral);
    if (k in porUmbral) porUmbral[k]++;
    for (const n of nrosDistintos(c.nros)) odt.add(n);
    const ms = msDeMarca(c.enviadoEn);
    if (ms == null) continue;
    if (!primero || ms < primero.ms) primero = { ms, v: c.enviadoEn };
    if (!ultimo || ms > ultimo.ms) ultimo = { ms, v: c.enviadoEn };
  }
  return { enviados, porUmbral, odtAvisadas: odt.size, primerEnvioEn: primero ? primero.v : null, ultimoEnvioEn: ultimo ? ultimo.v : null };
}

// ── Fechas en la hora de Colombia (UTC−5, sin horario de verano) ───────────────
const COLOMBIA_MS = 5 * 3600 * 1000;
const dos = (n) => String(n).padStart(2, '0');
const enColombia = (ms) => new Date(ms - COLOMBIA_MS);
/** «dd/mm/aaaa hh:mm» en Colombia; '—' sin fecha. */
export function fechaHoraColombia(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  const d = enColombia(ms);
  return dos(d.getUTCDate()) + '/' + dos(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + dos(d.getUTCHours()) + ':' + dos(d.getUTCMinutes());
}
/** «dd/mm hh:mm» en Colombia (la columna de cada ODT); '—' sin fecha. */
export function fechaCortaColombia(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  const d = enColombia(ms);
  return dos(d.getUTCDate()) + '/' + dos(d.getUTCMonth() + 1) + ' ' + dos(d.getUTCHours()) + ':' + dos(d.getUTCMinutes());
}
/** «hace un momento», «hace 5 minutos», «hace 1 hora», «hace 3 días»; '' sin fecha. */
export function haceCuanto(ms, ahoraMs) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || typeof ahoraMs !== 'number' || !Number.isFinite(ahoraMs)) return '';
  const min = Math.floor(Math.max(0, ahoraMs - ms) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return 'hace ' + min + (min === 1 ? ' minuto' : ' minutos');
  const h = Math.floor(min / 60);
  if (h < 24) return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
  const d = Math.floor(h / 24);
  return 'hace ' + d + (d === 1 ? ' día' : ' días');
}

// ── Lo que dice la pantalla (bloque «Notificaciones a …») ─────────────────────
export const TITULO_SIN_DESTINATARIO = 'Notificaciones de cumplimiento';
export const INTRO_NOTIFICACIONES = 'Cuándo y cuántas veces la plataforma envió los avisos de cumplimiento del cierre: a los 10 días desde la ejecución (ejecutar a conformidad), a los 15 (apresurar el cierre) y a los 20 o más (incumplimiento).';
export const NOTA_SIN_FILTROS = 'Este registro no depende de los filtros de periodo ni de contratista de esta página: cuenta todas las notificaciones que ha enviado la plataforma.';
export const SIN_NOTIFICACIONES = 'Todavía no se ha enviado ninguna notificación.';
// Corrector ronda 1 (99 §236): el botón «Revisar y enviar…» solo existe para el administrador en un corte con la fecha
// de ejecución (versión 3); la nota no lo da por hecho. Y el servidor recalcula solo las cuentas con el envío siguiente.
export const NOTA_POR_RECALCULAR = 'Puede faltar algún envío en estas cuentas: no se pudieron sumar en su momento. La tabla sí está completa. Las cuentas se corrigen solas con la próxima notificación que salga; si un administrador no quiere esperar, puede corregirlas con «Revisar y enviar los avisos de este corte», en la sección de cumplimiento de un corte que tenga la fecha de ejecución (por ejemplo, el más reciente).';
/** Corrector ronda 1 (99 §236): en una tarjeta cuyas cuentas no se pueden creer (en lugar de un 0 falso). */
export const VALOR_POR_RECALCULAR = '—';
export const NOTA_TARJETA_POR_RECALCULAR = 'por recalcular';
export const TITULO_TABLA_NOTIFICACIONES = 'Cuándo se le notificó';
export const TITULO_BUSCADOR = 'Historial de avisos de una ODT';
/** El tipo de cada notificación, por umbral. */
export const TIPO_NOTIFICACION = Object.freeze({ 10: '10 días: ejecutar a conformidad', 15: '15 días: apresurar el cierre', 20: '20 días: incumplimiento' });
export const textoTipoNotificacion = (umbral) => TIPO_NOTIFICACION[umbral] || (umbral ? umbral + ' días' : '—');

/** Los destinatarios de un correo: sus nombres (paraNombres) o, en un correo viejo sin ellos, sus direcciones. */
export function destinatariosDe(c) {
  const nombres = (Array.isArray(c && c.paraNombres) ? c.paraNombres : []).map((x) => limpiar(x)).filter(Boolean);
  if (nombres.length) return listaNombres(nombres);
  return listaNombres((Array.isArray(c && c.para) ? c.para : []).map((x) => limpiar(x)).filter(Boolean));
}
/** «Notificaciones a <destinatarios del correo más reciente>» o «Notificaciones de cumplimiento» si no hay ninguno. */
export function tituloNotificaciones(masReciente) {
  const a = masReciente ? destinatariosDe(masReciente) : '';
  return a ? 'Notificaciones a ' + a : TITULO_SIN_DESTINATARIO;
}

const enCola = (c) => c && (c.estado === 'pendiente' || c.estado === 'en_envio');
/** ¿Un correo en manos del script cuyo préstamo ya venció? (lo tomó y no confirmó) */
const prestamoVencido = (c, ahoraMs) => c.estado === 'en_envio' && Number.isFinite(ahoraMs) && Number(c.prestamoHastaMs) > 0 && Number(c.prestamoHastaMs) <= ahoraMs;
/** El estado de una notificación en llano. */
export function textoEstadoNotificacion(c, ahoraMs = NaN) {
  const x = c || {};
  if (x.estado === 'enviado') return 'Enviado';
  // Corrector ronda 1 (99 §236): el script solo recibe la cola si los avisos están activos (los lectores no leen la
  // configuración, así que la pantalla no puede saberlo): no se promete el envío sin esa condición.
  if (x.estado === 'pendiente') return 'En cola: el script lo enviará en los próximos minutos, si los avisos siguen activos';
  if (x.estado === 'en_envio') {
    return prestamoVencido(x, ahoraMs)
      ? 'En cola: el script lo tomó y no confirmó el envío; lo volverá a intentar en su próxima conexión'
      : 'En cola: el script lo está enviando en este momento';
  }
  const motivo = limpiar(x.error).replace(/[.\s]+$/, '');
  // Corrector ronda 1 (99 §236): un correo que FALLÓ y después lo reemplazó un corte más reciente conserva su motivo.
  if (x.estado === 'error' && x.reemplazadoPor && motivo && x.error !== TEXTO_REEMPLAZADO) return 'No se pudo enviar: ' + motivo + '. Sus ODT se revisaron con un corte con datos más recientes';
  if (x.estado === 'error' && x.reemplazadoPor) return 'No se envió: lo reemplazó un corte con datos más recientes';
  if (x.estado === 'error') return 'No se pudo enviar: ' + (motivo || 'la plataforma no registró el motivo');
  return '—';
}
/** La clase de color del estado: enviado, cola, error o reemplazado. */
export function claseEstadoNotificacion(c) {
  const x = c || {};
  if (x.estado === 'enviado') return 'enviado';
  if (enCola(x)) return 'cola';
  if (x.estado === 'error' && x.reemplazadoPor) return 'reemplazado';
  return 'error';
}
/** La fecha de la fila: la de envío (Colombia) o, si no ha salido, la de creación con «(en cola)» o «(no salió)». */
export function fechaDeNotificacion(c) {
  const x = c || {};
  if (x.estado === 'enviado' && Number.isFinite(x.enviadoEnMs)) return fechaHoraColombia(x.enviadoEnMs);
  const base = fechaHoraColombia(x.creadoEnMs);
  if (enCola(x)) return base + ' (en cola)';
  if (x.estado === 'error') return base + ' (no salió)';
  return base;
}
/** «1 ODT», «12 ODT». */
export const textoCuantasOdt = (n) => Number(n || 0).toLocaleString('es-CO') + ' ODT';
/** Un conteo que llegó al tope de la consulta: «50 o más». */
export const textoConteo = (n, tope) => (Number.isFinite(tope) && n >= tope ? Number(tope).toLocaleString('es-CO') + ' o más' : Number(n || 0).toLocaleString('es-CO'));

// ── Avisos de una ODT (odt_afinia_avisos/{nro}_{umbral}) ──────────────────────
/** El N.º que se escribe en el buscador: limpio, de 1 a 40 caracteres (como en los cortes); '' si no sirve. */
export function nroBuscado(v) {
  const t = limpiar(v);
  return t.length >= 1 && t.length <= 40 ? t : '';
}
/** «10 d · 20/11 07:12; 15 d · 25/11 07:10» con los avisos ENVIADOS de una ODT (de menor a mayor), o «Ninguno». */
export function textoAvisosRecibidos(avisos) {
  const env = (avisos || []).filter((a) => a && a.estado === 'enviado').sort((a, b) => (Number(a.umbral) || 0) - (Number(b.umbral) || 0));
  if (!env.length) return 'Ninguno';
  return env.map((a) => a.umbral + ' d · ' + fechaCortaColombia(a.enMs)).join('; ');
}
/** El estado de UN aviso de una ODT, en llano (el buscador). */
export function textoEstadoAviso(a) {
  const x = a || {};
  if (x.estado === 'enviado') return 'Enviado';
  if (x.estado === 'reservado') return 'En cola: sale con el próximo envío del script';
  if (x.estado === 'omitido') return 'No se envía: cuando se revisó, la ODT ya había llegado a un aviso mayor (solo se manda el más alto)';
  if (x.estado === 'error') return 'No se pudo enviar: se vuelve a intentar con el próximo corte o con «Revisar y enviar los avisos de este corte»';
  return '—';
}
/** Los avisos de una ODT para el buscador: de menor a mayor umbral. */
export const ordenarAvisos = (xs) => [...(xs || [])].sort((a, b) => (Number(a.umbral) || 0) - (Number(b.umbral) || 0));
