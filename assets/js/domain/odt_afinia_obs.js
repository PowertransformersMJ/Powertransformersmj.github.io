// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · POR SUBSANAR (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero (2026-11-21): una pestaña «Por subsanar» donde el AZT asignado
// ve, en SU sesión, las ODT de Afinia que tienen inconsistencias por corregir ANTES de
// poder publicarlas para firma y cerrarlas, con cada punto pendiente. Él marca cada punto
// «subsanado» con una nota; el administrador lo verifica (o lo devuelve con motivo).
// Con todos los puntos verificados, la ODT queda «Lista para publicar» (el administrador la
// publica en «Publicar ODT», que ya existe: aquí NO se publica nada).
//
//   Punto:  PENDIENTE ──(AZT asignado, nota 3-500)──▶ SUBSANADO
//           SUBSANADO ──(admin, nota 0-500)──▶ VERIFICADO
//           SUBSANADO ──(admin, «devolver», nota 3-500)──▶ PENDIENTE
//           Quien lo marcó subsanado no lo verifica ni lo devuelve (separación de funciones).
//   Obs:    ABIERTA ──(admin, nota 3-500)──▶ RESUELTA (final; nada se borra)
//
// RASTRO: cada cambio de un punto AGREGA una entrada {de, a, nota, por, en} con la clave de su
// revisión ('1', '2', …) en el mapa `rastro` del mismo punto; ninguna anterior se cambia ni se
// quita (la regla compara el antes y el después del mismo documento).
// La obs guarda `resumen` {idPunto: estado}: la lista y el contador de la pestaña salen de la obs
// sin leer los puntos; la regla lo mueve atado al punto en el mismo lote.
//
// Formato de «Registrar ODT por subsanar» (parsearPuntos): UN punto por línea; prefijo opcional
// «Contratista:», «AZT:» o «Responsable:» (mayúsculas o minúsculas, con o sin espacio antes de los
// dos puntos). Sin prefijo = Contratista. Las líneas vacías no cuentan; una viñeta o numeración al
// comienzo («- », «• », «* », «1. », «2) ») se quita. De 5 a 600 caracteres por punto; hasta 40 puntos.
//
// Las reglas (bloque «Por subsanar · ODT Afinia» de firestore.rules) exigen lo mismo; esto da el
// «no» con un mensaje claro ANTES de que la base lo niegue.
// Sin Firebase, sin DOM. Archivo NUEVO a propósito (L-102): ninguna pieza vieja de la caché lo nombra.
// ══════════════════════════════════════════════════════════════════════════════

import { esNro } from './odt_afinia_rutas.js';
import { esFechaDMA } from './odt_afinia_textos.js';

// ── Colecciones (las mismas de las reglas) ─────────────────────────────────────
export const COL_OBS = Object.freeze({
  obs: 'odt_afinia_obs',          // odt_afinia_obs/{obsId}
  puntos: 'puntos',               // odt_afinia_obs/{obsId}/puntos/{0..39}
  nro: 'odt_afinia_obs_nro'       // candado «un N.º, una obs abierta»: odt_afinia_obs_nro/{nro} = {obsId}
});

// ── Estados, a quién le toca y topes ───────────────────────────────────────────
export const ESTADOS_OBS = Object.freeze({ ABIERTA: 'ABIERTA', RESUELTA: 'RESUELTA' });
export const ESTADOS_PUNTO = Object.freeze({ PENDIENTE: 'PENDIENTE', SUBSANADO: 'SUBSANADO', VERIFICADO: 'VERIFICADO' });
export const ETIQUETA_OBS = Object.freeze({ ABIERTA: 'Abierta', RESUELTA: 'Resuelta' });
export const ETIQUETA_PUNTO = Object.freeze({ PENDIENTE: 'Pendiente', SUBSANADO: 'Subsanado · por verificar', VERIFICADO: 'Verificado' });
/** A quién le toca corregir el punto (lo que se escribe antes de los dos puntos). */
export const QUIEN = Object.freeze(['contratista', 'azt', 'responsable']);
export const ETIQUETA_QUIEN = Object.freeze({ contratista: 'Contratista', azt: 'AZT', responsable: 'Responsable' });
export const LISTA_PARA_PUBLICAR = 'Lista para publicar';

export const TOPES_OBS = Object.freeze({
  puntosMax: 40,        // ids '0'..'39'
  textoMin: 5,
  textoMax: 600,
  notaMin: 3,           // subsanar, devolver y dar por resuelta
  notaMax: 500,
  subestacionMin: 2,
  subestacionMax: 80,
  equipoMax: 160,       // opcional (0-160)
  listado: 50,          // list de obs: limit <= 50
  revMax: 50            // cambios por punto (el rastro no crece sin fin)
});

/** Ids de los puntos: '0'..'39' (la regla: '^([0-9]|[1-3][0-9])$'). */
export const ID_PUNTOS = Object.freeze(Array.from({ length: TOPES_OBS.puntosMax }, (_, i) => String(i)));
const RE_ID_PUNTO = /^([0-9]|[1-3][0-9])$/;
export const esIdPunto = (k) => typeof k === 'string' && RE_ID_PUNTO.test(k);
export const esQuien = (q) => typeof q === 'string' && QUIEN.includes(q);

/**
 * Las tres acciones sobre un punto: de qué estado sale, a cuál llega, quién la hace y el largo de la nota.
 * `quien`: 'azt' = el AZT asignado (uid en lectores); 'admin' = un administrador con perfil.
 */
export const ACCIONES = Object.freeze({
  subsanar: Object.freeze({ de: 'PENDIENTE', a: 'SUBSANADO', quien: 'azt', notaMin: TOPES_OBS.notaMin, titulo: 'Marcar subsanado' }),
  verificar: Object.freeze({ de: 'SUBSANADO', a: 'VERIFICADO', quien: 'admin', notaMin: 0, titulo: 'Verificar' }),
  devolver: Object.freeze({ de: 'SUBSANADO', a: 'PENDIENTE', quien: 'admin', notaMin: TOPES_OBS.notaMin, titulo: 'Devolver' })
});

// ── Utilidades ─────────────────────────────────────────────────────────────────
const texto = (v) => (typeof v === 'string' ? v : '');
/** Espacios seguidos (y tabuladores) como uno solo, sin espacios a los lados. */
export const limpiarTexto = (v) => texto(v).replace(/\s+/g, ' ').trim();

// ── Formato de líneas de «Registrar ODT por subsanar» ──────────────────────────
const RE_VINETA = /^(?:[-–—•*·]\s*|\d{1,2}[.)]\s+)/;
const RE_PREFIJO = /^(contratista|azt|responsable)\s*:\s*/i;

/**
 * Una línea → {texto, quien} (sin validar el largo). null si la línea está vacía (o es solo una viñeta).
 * Quita una viñeta o numeración del comienzo y lee el prefijo opcional (sin prefijo = contratista).
 */
export function leerLinea(linea) {
  let l = limpiarTexto(linea);
  if (!l) return null;
  l = l.replace(RE_VINETA, '').trim();
  let quien = 'contratista';
  const m = RE_PREFIJO.exec(l);
  if (m) { quien = m[1].toLowerCase(); l = l.slice(m[0].length).trim(); }
  if (!l && !m) return null;          // una viñeta sola cuenta como línea vacía
  return { texto: l, quien };
}

/** Error del texto de UN punto (5-600 caracteres), o null. */
export function errorTextoPunto(t) {
  const s = limpiarTexto(t);
  if (s.length < TOPES_OBS.textoMin) return 'El punto debe tener al menos ' + TOPES_OBS.textoMin + ' caracteres.';
  if (s.length > TOPES_OBS.textoMax) return 'El punto admite hasta ' + TOPES_OBS.textoMax + ' caracteres (tiene ' + s.length + ').';
  return null;
}

/**
 * El área de texto de «Registrar ODT por subsanar» → {puntos:[{texto, quien, linea}], errores:[texto]}.
 * Cada error dice su línea («Línea 3: …»). Hasta TOPES_OBS.puntosMax puntos.
 */
export function parsearPuntos(areaDeTexto) {
  const lineas = texto(areaDeTexto).split(/\r\n|\r|\n/);
  const puntos = []; const errores = [];
  lineas.forEach((cruda, i) => {
    const p = leerLinea(cruda);
    if (!p) return;
    const err = p.texto ? errorTextoPunto(p.texto) : 'Después de «' + ETIQUETA_QUIEN[p.quien] + ':» falta el punto.';
    if (err) { errores.push('Línea ' + (i + 1) + ': ' + err); return; }
    puntos.push({ texto: p.texto, quien: p.quien, linea: i + 1 });
  });
  if (!puntos.length && !errores.length) errores.push('Escriba al menos un punto (uno por línea).');
  if (puntos.length > TOPES_OBS.puntosMax) errores.push('Son ' + puntos.length + ' puntos: el máximo es ' + TOPES_OBS.puntosMax + ' por ODT.');
  return { puntos, errores };
}

// ── Registro ───────────────────────────────────────────────────────────────────
/**
 * Errores del formulario de registro (en llano; vacío si está bien).
 * @param {{nro?:string, subestacion?:string, equipo?:string, fechaPrevista?:string, aztUid?:string}} form
 * @param {{puntos:Array, errores:string[]}} [parseo]  lo que devolvió parsearPuntos
 * @param {{uid?:string}} [quien]  quien registra (no puede ser el AZT asignado)
 */
export function erroresRegistro(form = {}, parseo = null, quien = {}) {
  const e = [];
  if (!esNro(limpiarTexto(form.nro))) e.push('El N.º de ODT debe tener 8 dígitos.');
  const sub = limpiarTexto(form.subestacion);
  if (sub.length < TOPES_OBS.subestacionMin || sub.length > TOPES_OBS.subestacionMax) {
    e.push('Escriba la subestación (de ' + TOPES_OBS.subestacionMin + ' a ' + TOPES_OBS.subestacionMax + ' caracteres).');
  }
  if (limpiarTexto(form.equipo).length > TOPES_OBS.equipoMax) e.push('El equipo admite hasta ' + TOPES_OBS.equipoMax + ' caracteres.');
  if (!esFechaDMA(limpiarTexto(form.fechaPrevista))) e.push('La fecha prevista debe ser una fecha real en formato dd/mm/aaaa.');
  if (!texto(form.aztUid)) e.push('Elija el AZT asignado.');
  else if (quien && quien.uid && form.aztUid === quien.uid) e.push('Quien registra la ODT no puede ser su AZT asignado.');
  if (parseo) e.push(...parseo.errores);
  return e;
}

// ── Lectura de una obs ─────────────────────────────────────────────────────────
/** ¿`uid` es el AZT asignado (está en lectores)? */
export const esAztDe = (obs, uid) => !!uid && !!obs && Array.isArray(obs.lectores) && obs.lectores.includes(uid);
export const estaAbierta = (obs) => !!obs && obs.estado === ESTADOS_OBS.ABIERTA;

/** Conteo de los puntos según el `resumen` de la obs. */
export function contar(obs) {
  const r = (obs && obs.resumen && typeof obs.resumen === 'object') ? obs.resumen : {};
  const out = { pendientes: 0, subsanados: 0, verificados: 0, total: 0 };
  for (const e of Object.values(r)) {
    out.total++;
    if (e === ESTADOS_PUNTO.PENDIENTE) out.pendientes++;
    else if (e === ESTADOS_PUNTO.SUBSANADO) out.subsanados++;
    else if (e === ESTADOS_PUNTO.VERIFICADO) out.verificados++;
  }
  return out;
}

/** «Lista para publicar»: ABIERTA, con puntos, y TODOS verificados. */
export function listaParaPublicar(obs) {
  const c = contar(obs);
  return estaAbierta(obs) && c.total > 0 && c.verificados === c.total;
}

/** Texto del conteo para una tarjeta: «Pendientes 2 · Subsanados por verificar 1 · Verificados 3». */
export function textoConteo(obs) {
  const c = contar(obs);
  return 'Pendientes ' + c.pendientes + ' · Subsanados por verificar ' + c.subsanados + ' · Verificados ' + c.verificados;
}

/**
 * Puntos «de su lado» para el contador de la pestaña (solo obs ABIERTAS):
 * del AZT asignado, los PENDIENTES (le toca subsanarlos); del administrador, los SUBSANADOS (le toca verificarlos).
 */
export function pendientesDeMiLado(lista, sesion = {}) {
  let n = 0;
  for (const o of lista || []) {
    if (!estaAbierta(o)) continue;
    const c = contar(o);
    if (esAztDe(o, sesion.uid)) n += c.pendientes;
    if (sesion.esAdmin) n += c.subsanados;
  }
  return n;
}

/** Orden de la lista: ABIERTAS primero (las «listas para publicar» al final de ellas), luego por fecha de registro. */
export function ordenarLista(lista) {
  const peso = (o) => (estaAbierta(o) ? (listaParaPublicar(o) ? 1 : 0) : 2);
  return [...(lista || [])].sort((a, b) => (peso(a) - peso(b)) || ((b.creadoEnMs || 0) - (a.creadoEnMs || 0)));
}

/** El próximo id libre para «Agregar punto» ('0'..'39'), o null si ya hay 40. */
export function siguienteIdPunto(obs) {
  const usados = Object.keys((obs && obs.resumen) || {}).filter(esIdPunto).map(Number);
  const n = usados.length ? Math.max(...usados) + 1 : 0;
  return n < TOPES_OBS.puntosMax ? String(n) : null;
}

/**
 * ¿La obs y sus puntos cuadran? Lista de avisos en llano (vacía si sí): un punto del resumen sin su
 * documento, o un punto cuyo estado no es el del resumen. La regla los ata en cada cambio; esto
 * avisa si algo quedó raro (por ejemplo, un registro a medias).
 */
export function revisarIntegridad(obs, puntos = []) {
  const avisos = [];
  const r = (obs && obs.resumen) || {};
  const porId = new Map((puntos || []).map((p) => [String(p.id), p]));
  for (const [k, e] of Object.entries(r)) {
    const p = porId.get(k);
    if (!p) avisos.push('Falta el punto ' + (Number(k) + 1) + ' en la plataforma: avise al administrador.');
    else if (p.estado !== e) avisos.push('El punto ' + (Number(k) + 1) + ' no cuadra con el resumen de la ODT: recargue la página.');
  }
  for (const p of puntos || []) if (!(String(p.id) in r)) avisos.push('El punto ' + (Number(p.id) + 1) + ' no está en el resumen de la ODT: avise al administrador.');
  return avisos;
}

// ── Rastro y transiciones de un punto ──────────────────────────────────────────
/** Las entradas del rastro en orden: [{rev, de, a, nota, por, enMs}]. */
export function rastroOrdenado(punto) {
  const r = (punto && punto.rastro && typeof punto.rastro === 'object') ? punto.rastro : {};
  return Object.entries(r)
    .map(([k, e]) => ({ rev: Number(k), ...(e || {}) }))
    .filter((e) => Number.isInteger(e.rev))
    .sort((a, b) => a.rev - b.rev);
}

/** La última entrada del rastro (la del rev actual), o null. */
export function ultimaEntrada(punto) {
  if (!punto || !Number.isInteger(punto.rev) || punto.rev < 1) return null;
  const e = punto.rastro && punto.rastro[String(punto.rev)];
  return e || null;
}

/** «Pendiente → Subsanado · por verificar». */
export const textoCambio = (e) => (ETIQUETA_PUNTO[e && e.de] || '—') + ' → ' + (ETIQUETA_PUNTO[e && e.a] || '—');

/**
 * ¿Puede `sesion` hacer `accion` sobre `punto` de `obs`? null si sí; si no, el motivo en llano.
 * (Las reglas exigen lo mismo.)
 */
export function motivoNoPuede(obs, punto, accion, sesion = {}) {
  const a = ACCIONES[accion];
  if (!a) return 'Acción desconocida.';
  if (!estaAbierta(obs)) return 'La ODT ya se dio por resuelta: sus puntos no cambian.';
  if (!punto || punto.estado !== a.de) return 'El punto ya no está «' + (ETIQUETA_PUNTO[a.de] || a.de) + '». Recargue para ver su estado.';
  if (a.quien === 'azt' && !esAztDe(obs, sesion.uid)) return 'Solo el AZT asignado marca un punto como subsanado.';
  if (a.quien === 'admin') {
    if (!sesion.esAdmin || sesion.legacy) return 'Solo un administrador verifica o devuelve un punto.';
    const u = ultimaEntrada(punto);
    if (u && u.por && u.por.uid === sesion.uid) return 'Usted marcó este punto como subsanado: lo verifica o lo devuelve otro administrador.';
  }
  if ((punto.rev || 0) + 1 > TOPES_OBS.revMax) return 'Este punto llegó al máximo de ' + TOPES_OBS.revMax + ' cambios. Avise al Ingeniero.';
  return null;
}

/** Las acciones que la pantalla ofrece a `sesion` en ese punto (puede estar vacía). */
export function accionesPara(obs, punto, sesion = {}) {
  return Object.keys(ACCIONES).filter((k) => !motivoNoPuede(obs, punto, k, sesion));
}

/** Error de la nota de una acción, o null. */
export function errorNota(accion, nota) {
  const a = ACCIONES[accion];
  const n = limpiarTexto(nota);
  if (!a) return 'Acción desconocida.';
  if (n.length < a.notaMin) {
    return accion === 'devolver'
      ? 'Escriba el motivo de la devolución (al menos ' + a.notaMin + ' caracteres).'
      : 'Escriba qué se hizo para subsanar el punto (al menos ' + a.notaMin + ' caracteres).';
  }
  if (n.length > TOPES_OBS.notaMax) return 'La nota admite hasta ' + TOPES_OBS.notaMax + ' caracteres.';
  return null;
}

/**
 * El cambio de un punto: {ok:true, estado, rev, entrada:{de, a, nota}} o {ok:false, codigo, mensaje}.
 * `entrada` va SIN `por` ni `en`: los pone la capa de datos (perfil y hora del servidor).
 */
export function transicionPunto(obs, punto, accion, { nota, sesion = {} } = {}) {
  const no = motivoNoPuede(obs, punto, accion, sesion);
  if (no) return { ok: false, codigo: 'estado', mensaje: no };
  const errN = errorNota(accion, nota);
  if (errN) return { ok: false, codigo: 'validacion', mensaje: errN };
  const a = ACCIONES[accion];
  const rev = (punto.rev || 0) + 1;
  return { ok: true, estado: a.a, rev, entrada: { de: a.de, a: a.a, nota: limpiarTexto(nota) } };
}

/** Error de la nota para dar la obs por resuelta (3-500), o null. */
export function errorResolver(obs, nota) {
  if (!estaAbierta(obs)) return 'La ODT ya está resuelta.';
  const n = limpiarTexto(nota);
  if (n.length < TOPES_OBS.notaMin || n.length > TOPES_OBS.notaMax) return 'Escriba por qué se da por resuelta (de ' + TOPES_OBS.notaMin + ' a ' + TOPES_OBS.notaMax + ' caracteres).';
  return null;
}
