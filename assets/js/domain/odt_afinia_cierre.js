// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · CIERRE: compositor @2, REEMPLAZO y CERRADA (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Decisiones del Ingeniero del 2026-11-21 (99 §231):
//   1. Pie de cierre de la página 2: «¿SE CIERRA LA ODT? SI» → X (como antes);
//      «FECHA CIERRE» → la FECHA PREVISTA de la orden (odt.fechaTrabajo, no la de hoy);
//      «ODT GENERADA N°» → el N.º de la ODT, estampado al componer con el acto del
//      Responsable. Eso es el compositor 'odt-afinia@2'. La versión la decide el
//      compositor del acto del Responsable: un acto 'odt-afinia@1' (ODT ya firmadas)
//      se recompone EXACTAMENTE igual que siempre, sin el N.º. La etapa del AZT es
//      idéntica en @1 y @2. El acto @2 del Responsable guarda su pie de cierre COMPLETO:
//      cierre = {si:true, fecha (= la prevista), generada (= el N.º estampado)}. La regla
//      exige cierre.generada == N.º: un armador viejo de la caché (L-102) escribe el cierre
//      sin `generada` y se niega (ver cierreDelResponsable).
//   2. REEMPLAZAR una ODT LISTA (revierte D6 con su visto bueno): solo el admin, con
//      motivo; queda 'REEMPLAZADA' (final) y su N.º se puede volver a publicar. Nada se
//      borra: actos, partes y constancia se conservan y se pueden leer.
//   3. CERRADA: el admin registra el cierre en Afinia de una LISTA (fecha dd/mm/aaaa
//      entre la prevista y hoy, y el nombre del soporte). Final: no se reemplaza ni se anula.
// Las reglas (bloque odt_afinia de firestore.rules) exigen lo mismo; esto da el «no» con
// un mensaje claro ANTES de que la base lo niegue.
// Archivo NUEVO a propósito (L-102): las exportaciones nuevas viven aquí, así un consumidor
// nuevo nunca pide un nombre que un vecino viejo en la caché del navegador no tiene.
// ══════════════════════════════════════════════════════════════════════════════

import { TOPES, esNro } from './odt_afinia_rutas.js';
import { esFechaDMA, ordenDMA, fechaBogota } from './odt_afinia_textos.js';

// ── Compositor ─────────────────────────────────────────────────────────────────
export const COMPOSITOR_V1 = 'odt-afinia@1';
export const COMPOSITOR_V2 = 'odt-afinia@2';
export const COMPOSITORES = Object.freeze([COMPOSITOR_V1, COMPOSITOR_V2]);
/** El que firma los actos NUEVOS (las reglas exigen esta cadena exacta). */
export const COMPOSITOR_VIGENTE = COMPOSITOR_V2;

/**
 * Versión con que se compone, según el compositor del acto del Responsable.
 * Sin compositor (una llamada de antes de @2) = @1: mismos bytes que siempre.
 * @returns {'odt-afinia@1'|'odt-afinia@2'}
 */
export function versionDeComposicion(compositor) {
  if (compositor == null) return COMPOSITOR_V1;
  if (COMPOSITORES.includes(compositor)) return compositor;
  throw new TypeError('Compositor desconocido («' + String(compositor) + '»): recargue la página.');
}

/** ¿Esa versión estampa el N.º en «ODT GENERADA N°»? (solo @2). */
export const estampaGenerada = (compositor) => versionDeComposicion(compositor) === COMPOSITOR_V2;

/** Lo que dice el papel junto al N.º que se estampa (pie de la página 2). */
export const ETIQUETA_GENERADA = 'ODT GENERADA N°';
/** «ODT GENERADA N° 00000001» (lo que se muestra en pantalla antes de firmar). */
export function textoGenerada(nro) {
  if (!esNro(nro)) throw new TypeError('El N.º de ODT debe tener 8 dígitos.');
  return ETIQUETA_GENERADA + ' ' + nro;
}

/** La FECHA CIERRE que se estampa: la fecha PREVISTA de la orden (no se edita). */
export const fechaCierreDe = (odt) => (odt && typeof odt.fechaTrabajo === 'string' ? odt.fechaTrabajo : null);

/**
 * Para la pantalla Firmar del Responsable: por qué TODAVÍA no puede firmar (le habla a él), o null.
 * La FECHA CIERRE es la prevista: si aún no llega (hoy en Bogotá), se dice desde cuándo podrá; si no es
 * una fecha real, que avise. Con esto la pantalla no ofrece «Preparar mi firma» en vano.
 */
export function avisoAntesDeFirmar(odt, ahora = new Date()) {
  const f = fechaCierreDe(odt);
  if (!esFechaDMA(f)) return 'La fecha prevista de la orden no es una fecha válida: todavía no se puede firmar. Avise al administrador.';
  if (ordenDMA(f) > ordenDMA(fechaBogota(ahora))) return 'Todavía no puede firmar: la fecha prevista de la orden es el ' + f + '. Podrá firmar y cerrar la ODT desde ese día.';
  return null;
}

/**
 * Mensaje cuando un módulo nuevo convive con uno viejo de la caché del navegador (L-102). Neutro: sirve para
 * Ver, Descargar, Publicar, Reemplazar y Registrar el cierre. Al preparar o firmar va MSG_RECARGAR_FIRMA.
 */
export const MSG_RECARGAR = 'La página tiene partes de una versión anterior (caché del navegador). Recargue con Cmd + Shift + R (o Ctrl + Shift + R) y vuelva a intentarlo.';
/** Lo mismo al preparar o firmar: después de recargar, la firma se prepara de nuevo. */
export const MSG_RECARGAR_FIRMA = 'La página tiene partes de una versión anterior (caché del navegador). Recargue con Cmd + Shift + R (o Ctrl + Shift + R) y prepare de nuevo su firma.';

/**
 * El pie de cierre que firma el Responsable con @2, tal como queda en su acto:
 * {si:true, fecha (= la fecha PREVISTA), generada (= el N.º que se estampa en «ODT GENERADA N°»)}.
 * Por qué `generada` va ESCRITO en el acto (L-102): con un preparar.js y un odt_afinia_lotes.js viejos en
 * la caché y un odt_afinia_rutas.js nuevo, se componía como @1 (sin el N.º) y se guardaba un acto que decía
 * «@2»; la regla lo aceptaba y esa ODT LISTA ya no se podía ver ni descargar. Un armador viejo escribe el
 * cierre SIN `generada`, y la regla exige cierre.generada == N.º: ese acto se niega.
 */
export function cierreDelResponsable(odt, fecha) {
  if (!odt || !esNro(odt.nro)) throw new TypeError('El N.º de ODT debe tener 8 dígitos.');
  return { si: true, fecha, generada: odt.nro };
}

/**
 * ¿La firma preparada (la copia congelada de Preparar) y, si se pasa, el acto ya armado son del compositor
 * vigente? null si sí; si no, el mensaje para recargar. Lo miran firmar.js (antes de mostrar el pie) y la
 * capa de datos (antes de escribir): una pieza vieja de la caché (preparar.js u odt_afinia_lotes.js de antes
 * de @2) no deja el compositor vigente ni `generada` en el cierre del Responsable.
 * @param {{rol:string, compositor?:string, nro?:string, cierre?:object}|null} congelado
 * @param {{rol:string, compositor?:string, nro?:string, cierre?:object}} [acto]  los datos del acto armado
 * @returns {string|null}
 */
export function errorFirmaAlDia(congelado, acto) {
  const alDia = (x) => !!x && x.compositor === COMPOSITOR_VIGENTE
    && (x.rol !== 'responsable' || (esNro(x.nro) && !!x.cierre && x.cierre.generada === x.nro));
  if (!alDia(congelado)) return MSG_RECARGAR_FIRMA;
  if (acto !== undefined && !alDia(acto)) return MSG_RECARGAR_FIRMA;
  return null;
}

// ── Estados nuevos ─────────────────────────────────────────────────────────────
export const ESTADOS_CIERRE = Object.freeze({ CERRADA: 'CERRADA', REEMPLAZADA: 'REEMPLAZADA' });
export const ETIQUETA_ESTADO_CIERRE = Object.freeze({
  [ESTADOS_CIERRE.CERRADA]: 'Cerrada en Afinia',
  [ESTADOS_CIERRE.REEMPLAZADA]: 'Reemplazada'
});
/** Desde qué estados se descarga el PDF firmado (las reglas de descargas exigen lo mismo). */
export const ESTADOS_DESCARGABLES = Object.freeze(['LISTA', ESTADOS_CIERRE.CERRADA]);
/** Con la ODT vigente en uno de estos estados, su N.º se puede volver a publicar. */
export const ESTADOS_QUE_LIBERAN_NRO = Object.freeze(['ANULADA', ESTADOS_CIERRE.REEMPLAZADA]);

export const puedeDescargar = (odt) => !!odt && ESTADOS_DESCARGABLES.includes(odt.estado);
export const liberaNro = (estado) => ESTADOS_QUE_LIBERAN_NRO.includes(estado);
/** Solo una LISTA se reemplaza o se registra como cerrada en Afinia. */
export const puedeReemplazar = (odt) => !!odt && odt.estado === 'LISTA';
export const puedeCerrarAfinia = (odt) => !!odt && odt.estado === 'LISTA';
/** ¿Estado final? (ya no cambia: ni firmas, ni anulación, ni reemplazo, ni cierre). */
export const esFinal = (estado) => estado === 'ANULADA' || estado === ESTADOS_CIERRE.CERRADA || estado === ESTADOS_CIERRE.REEMPLAZADA;

/** Etiqueta de un estado: la del mapa base (si se pasa) o la de los estados nuevos. */
export function etiquetaEstado(estado, base = {}) {
  return (base && base[estado]) || ETIQUETA_ESTADO_CIERRE[estado] || String(estado || '—');
}

/**
 * Por qué no se puede volver a publicar un N.º cuya ODT vigente está en `estado`.
 * @returns {string|null}  null si el N.º está libre (ANULADA o REEMPLAZADA)
 */
export function mensajeNroOcupado(estado) {
  if (liberaNro(estado)) return null;
  if (estado === 'LISTA') return 'Ya hay una ODT LISTA (con las dos firmas) con ese N.º: para publicarla de nuevo, primero reemplácela («Reemplazar (administrador)» en su detalle).';
  if (estado === ESTADOS_CIERRE.CERRADA) return 'Esa ODT ya está cerrada en Afinia: su N.º no se vuelve a publicar.';
  if (estado === 'PENDIENTE_AZT' || estado === 'PENDIENTE_RESPONSABLE') return 'Ya hay una ODT vigente con ese N.º (le falta alguna firma): para publicarla de nuevo, primero anúlela.';
  return 'Ya hay una ODT vigente con ese N.º. Para volver a publicarla, primero anule la vigente (si le falta una firma) o reemplácela (si ya está lista).';
}

const no = (codigo, mensaje) => ({ ok: false, codigo, mensaje });
const texto = (v) => (typeof v === 'string' ? v : '');
const revDe = (odt) => (Number.isInteger(odt && odt.rev) ? odt.rev : 0);

function noEnLista(odt, que) {
  const e = odt && odt.estado;
  if (e === ESTADOS_CIERRE.CERRADA) return no('estado', 'La ODT ya está cerrada en Afinia: ya no ' + que + '.');
  if (e === ESTADOS_CIERRE.REEMPLAZADA) return no('estado', 'La ODT ya fue reemplazada: ya no ' + que + '.');
  if (e === 'ANULADA') return no('estado', 'La ODT está anulada: ya no ' + que + '.');
  return no('estado', 'Solo una ODT LISTA (con las dos firmas) ' + que + '.');
}

// ── Reemplazar (admin, desde LISTA, con motivo) ────────────────────────────────
/**
 * Cambio de reemplazo. `en` lo pone la capa de datos con la hora del servidor.
 * @param {object} odt
 * @param {{motivo:string, por:{uid:string, nombre?:string}}} p
 * @returns {{ok:true, cambios:{estado:'REEMPLAZADA', rev:number, reemplazo:{motivo:string, por:{uid:string, nombre:string}}}} | {ok:false, codigo:string, mensaje:string}}
 */
export function cambioReemplazar(odt, { motivo, por } = {}) {
  if (!puedeReemplazar(odt)) return noEnLista(odt, 'se reemplaza');
  const m = texto(motivo).trim();
  if (m.length < TOPES.motivoMin || m.length > TOPES.motivoMax) {
    return no('validacion', 'El motivo del reemplazo debe tener entre ' + TOPES.motivoMin + ' y ' + TOPES.motivoMax + ' caracteres.');
  }
  if (!por || !por.uid) return no('validacion', 'Falta quién reemplaza.');
  // La regla compara `por` con {uid, nombre del perfil}: va el nombre TAL CUAL (también vacío).
  return { ok: true, cambios: { estado: ESTADOS_CIERRE.REEMPLAZADA, rev: revDe(odt) + 1, reemplazo: { motivo: m, por: { uid: por.uid, nombre: texto(por.nombre) } } } };
}

// ── Registrar el cierre en Afinia (admin, desde LISTA) ─────────────────────────
/** Largo del nombre del soporte (p. ej. el archivo que se subió a Afinia). */
export const SOPORTE = Object.freeze({ min: 3, max: 120 });

/**
 * Error de los datos del cierre en Afinia, o null: fecha real dd/mm/aaaa, no posterior a hoy
 * (Bogotá) ni anterior a la fecha prevista de la orden; soporte de 3 a 120 caracteres.
 */
export function errorCierreAfinia({ fecha, soporte } = {}, { fechaTrabajo, ahora = new Date() } = {}) {
  if (!esFechaDMA(fecha)) return 'La fecha del cierre en Afinia debe ser una fecha real en formato dd/mm/aaaa.';
  if (ordenDMA(fecha) > ordenDMA(fechaBogota(ahora))) return 'La fecha del cierre en Afinia no puede ser posterior a hoy.';
  if (fechaTrabajo != null && esFechaDMA(fechaTrabajo) && ordenDMA(fecha) < ordenDMA(fechaTrabajo)) {
    return 'La fecha del cierre en Afinia no puede ser anterior a la fecha prevista de la orden (' + fechaTrabajo + ').';
  }
  const s = texto(soporte).trim();
  if (s.length < SOPORTE.min || s.length > SOPORTE.max) return 'Escriba el soporte del cierre (entre ' + SOPORTE.min + ' y ' + SOPORTE.max + ' caracteres; p. ej. el nombre del archivo que subió a Afinia).';
  return null;
}

/**
 * Cambio de cierre en Afinia: {estado:'CERRADA', rev, cierreAfinia:{fecha, soporte, por}}.
 * `en` lo pone la capa de datos con la hora del servidor.
 */
export function cambioCerrarAfinia(odt, { fecha, soporte, por, ahora = new Date() } = {}) {
  if (!puedeCerrarAfinia(odt)) return noEnLista(odt, 'se registra como cerrada en Afinia');
  const f = texto(fecha).trim(); const s = texto(soporte).trim();
  const err = errorCierreAfinia({ fecha: f, soporte: s }, { fechaTrabajo: odt.fechaTrabajo, ahora });
  if (err) return no('validacion', err);
  if (!por || !por.uid) return no('validacion', 'Falta quién registra el cierre.');
  return { ok: true, cambios: { estado: ESTADOS_CIERRE.CERRADA, rev: revDe(odt) + 1, cierreAfinia: { fecha: f, soporte: s, por: { uid: por.uid, nombre: texto(por.nombre) } } } };
}

/** «Cerrada en Afinia el dd/mm/aaaa · soporte X · registró Nombre» (detalle y Constancia). */
export function textoCierreAfinia(c) {
  if (!c) return '';
  const quien = (c.por && c.por.nombre) || '—';
  return 'Cerrada en Afinia el ' + (c.fecha || '—') + ' · soporte ' + (c.soporte || '—') + ' · registró ' + quien;
}
