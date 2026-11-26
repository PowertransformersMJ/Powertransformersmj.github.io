// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · CUMPLIMIENTO DEL CIERRE (dominio PURO) · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): «todas las ODT sin excepción deben ser cerradas en un plazo no mayor a 20 días
// calendario; superar este umbral es un incumplimiento de los contratistas; la fecha que cuenta no es la de generación
// sino la de ejecución». Decisiones (99 §236):
//   · Fecha de ejecución = «FECHA Y HORA AZT - RECIBE ZT» del informe de Afinia, solo la fecha (`ejecucion` de cada ODT
//     de un corte de la VERSIÓN 3). Fecha de cierre = `cerrada` («FECHA ODT CERRADA»).
//   · Solo se evalúan las ODT EJECUTADA y CERRADA. GENERADA, NO EJECUTADA, INACTIVA (y cualquier otro estado) quedan
//     fuera: Afinia prellena RECIBE ZT en las GENERADA y eso no prueba que se ejecutaran.
//   · Días transcurridos = diferencia en días CALENDARIO entre fechas (sin horas). CERRADA: cierre − ejecución.
//     EJECUTADA (abierta): fecha del corte − ejecución, donde la fecha del corte es la fecha EN COLOMBIA (UTC−5) de la
//     hora de descarga del nombre del archivo (que viene en UTC); si el corte no la trae del nombre del archivo, la fecha
//     de su `fechaDatos` (el final del día de la fecha prevista más reciente: ya es una fecha local).
//   · Plazo: cumple si días ≤ 20; incumple si días > 20.
//   · Fecha por revisar: ejecución vacía o ilegible, año fuera de 2020–2030, ejecución posterior a la fecha del corte o
//     cierre anterior a la ejecución (y, por lo mismo, una CERRADA sin fecha de cierre legible o con su año fuera de
//     rango): esa ODT queda FUERA del %, se lista aparte y no recibe avisos.
//   · % de cumplimiento = cerradas con días ≤ 20 ÷ (cerradas evaluables + abiertas con días > 20). Las abiertas con
//     días ≤ 20 todavía no tienen veredicto (no cuentan). Se muestra también la mediana de días hasta el cierre.
//   · Avisos por correo (solo ODT abiertas): umbral 10 si días ≥ 10; 15 si ≥ 15; 20 si ≥ 20 (el plan, el armado y el
//     envío viven en domain/odt_afinia_cumplimiento_avisos.js y en la Cloud Function).
//   · La configuración de los avisos: odt_afinia_config/cumplimiento {activo, remitente, para [{correo, nombre}] (1 a 5),
//     cc [correo] (0 a 5), responsable, audienciaScript}; la leen y la escriben solo los administradores
//     (firestore.rules). Ningún correo ni nombre vive en el código: el saludo usa el nombre guardado allí.
//     audienciaScript (99 §236, envío por un script de Google): el identificador del script de Google APROBADO por el
//     administrador (el «aud» de su token de identidad; vacío = ninguno). Lo usa la función avisosCorreoRemitente
//     (domain/odt_afinia_cumplimiento_remitente.js).
// Sin Firebase, sin DOM, sin red: lo usan la pantalla (indicadores-cumplimiento.js) y la Cloud Function (copiado a
// functions/domain por functions/prepare-deploy.mjs). Archivo NUEVO a propósito (L-102): a su vecino de antes
// (odt_afinia_indicadores.js) solo le pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { claveEstado, esIso, fechaDMA, fechaDatosDeCorte, selloDeArchivo, limpiar, textoPct } from './odt_afinia_indicadores.js';

/** Plazo máximo de cierre, en días calendario desde la ejecución. */
export const PLAZO_CIERRE_DIAS = 20;
/** Los umbrales de aviso (días desde la ejecución), de menor a mayor. */
export const UMBRALES_AVISO = Object.freeze([10, 15, 20]);
/** Desde esta versión el corte guarda la fecha de ejecución de cada ODT. */
export const VERSION_CON_EJECUCION = 3;
/** Años aceptados en una fecha de ejecución o de cierre (lo demás es «fecha por revisar»). */
export const ANIO_MIN = 2020;
export const ANIO_MAX = 2030;
/** Colecciones y documento de la configuración (las mismas de firestore.rules, bloque «Cumplimiento del cierre»). */
export const COL_CUMPLIMIENTO = Object.freeze({
  config: Object.freeze({ col: 'odt_afinia_config', doc: 'cumplimiento' }),
  correos: 'odt_afinia_correos',
  avisos: 'odt_afinia_avisos'
});
/** Cuántos correos lista el historial de la pantalla (la regla pide limit ≤ 50). */
export const TOPE_CORREOS_LISTA = 50;
/** ¿El corte guardó la fecha de ejecución de cada ODT? (versión 3 en adelante) */
export const corteTraeEjecucion = (c) => Number(c && c.version) >= VERSION_CON_EJECUCION;

// ── Fechas (días calendario, sin horas) ────────────────────────────────────────
const MS_DIA = 24 * 3600 * 1000;
const COLOMBIA_MS = 5 * 3600 * 1000;      // UTC−5, sin horario de verano
const msDe = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
/** ¿'aaaa-mm-dd' de un día que existe? (esIso solo mira la forma: un 31 de febrero no pasa aquí) */
export function fechaReal(v) {
  return esIso(v) && new Date(msDe(v)).toISOString().slice(0, 10) === v;
}
const anioValido = (iso) => { const a = Number(iso.slice(0, 4)); return a >= ANIO_MIN && a <= ANIO_MAX; };
/** Días calendario de `desde` a `hasta` ('aaaa-mm-dd'); null si alguna no es una fecha real. */
export function diasEntre(desde, hasta) {
  if (!fechaReal(desde) || !fechaReal(hasta)) return null;
  return Math.round((msDe(hasta) - msDe(desde)) / MS_DIA);
}
/** 'aaaa-mm-dd' + n días; '' si no es una fecha real. */
export function sumarDias(iso, n) {
  if (!fechaReal(iso)) return '';
  return new Date(msDe(iso) + n * MS_DIA).toISOString().slice(0, 10);
}
/** 'aaaa-mm-ddThh:mm:ss' en UTC (la hora del nombre del archivo de Afinia) → la FECHA en Colombia; '' si no se lee. */
export function fechaColombiaDeSello(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(typeof v === 'string' ? v : '');
  if (!m) return '';
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isFinite(t) ? new Date(t - COLOMBIA_MS).toISOString().slice(0, 10) : '';
}
/**
 * La fecha del corte con la que se cuentan los días de una ODT abierta: la fecha EN COLOMBIA de la hora de descarga
 * (si la `fechaDatos` del corte salió del nombre del archivo, que viene en UTC) o, si no, la fecha de su `fechaDatos`
 * (el final del día de su fecha prevista más reciente). '' si el corte no tiene fecha de datos.
 */
export function fechaDelCorte(corte) {
  const fd = fechaDatosDeCorte(corte);
  if (!fd) return '';
  return corteConHoraDeDescarga(corte) ? fechaColombiaDeSello(fd) : fd.slice(0, 10);
}
/**
 * ¿La fecha de los datos del corte es la hora de descarga del nombre del archivo? Si no (archivo renombrado), es la
 * fecha prevista más reciente, que puede ser futura: con ella los avisos por correo NO se envían (99 §236).
 */
export function corteConHoraDeDescarga(corte) {
  const fd = fechaDatosDeCorte(corte);
  return !!fd && selloDeArchivo(corte && corte.archivo && corte.archivo.nombre) === fd;
}

// ── Evaluación de cada ODT ─────────────────────────────────────────────────────
/** Por qué una ODT queda en «fecha por revisar» (lo que se muestra en la lista aparte). */
export const MOTIVOS_REVISAR = Object.freeze({
  sinEjecucion: 'Sin fecha de ejecución (vacía o ilegible)',
  ejecucionFueraDeRango: 'Fecha de ejecución con un año fuera de ' + ANIO_MIN + '–' + ANIO_MAX,
  ejecucionDespuesDelCorte: 'Fecha de ejecución posterior a la fecha de los datos del corte',
  sinCierre: 'CERRADA sin fecha de cierre legible',
  cierreFueraDeRango: 'Fecha de cierre con un año fuera de ' + ANIO_MIN + '–' + ANIO_MAX,
  cierreAntesDeEjecucion: 'Fecha de cierre anterior a la fecha de ejecución',
  sinFechaCorte: 'El corte no tiene fecha de datos para contar los días'
});

/** Franjas de las ODT abiertas (EJECUTADA) por días desde la ejecución. */
export const FRANJAS = Object.freeze([
  Object.freeze({ clave: 'f0', titulo: '0 a 9 días', desde: 0, hasta: 9 }),
  Object.freeze({ clave: 'f10', titulo: '10 a 14 días', desde: 10, hasta: 14 }),
  Object.freeze({ clave: 'f15', titulo: '15 a 19 días', desde: 15, hasta: 19 }),
  Object.freeze({ clave: 'f20', titulo: '20 días: vence hoy', desde: 20, hasta: 20 }),
  Object.freeze({ clave: 'f21', titulo: 'Más de 20 días: vencidas', desde: 21, hasta: Infinity })
]);
/** La franja de unos días (las de antes de 0 no existen: una ejecución posterior al corte es «fecha por revisar»). */
export const franjaDe = (dias) => (FRANJAS.find((f) => dias >= f.desde && dias <= f.hasta) || FRANJAS[0]).clave;
/** El umbral MÁS ALTO alcanzado (10, 15 o 20); 0 si todavía no llega a 10. */
export const umbralDe = (dias) => UMBRALES_AVISO.filter((u) => dias >= u).pop() || 0;

/**
 * Una ODT frente al plazo.
 * @param {object} o  ODT de un corte (versión 3: con `ejecucion`)
 * @param {string} fechaCorte  'aaaa-mm-dd' (fechaDelCorte)
 * @returns {{o, tipo:'cerrada'|'abierta'|'revisar'|'fuera', dias?:number, limite?:string, cumple?:boolean,
 *            vencida?:boolean, franja?:string, umbral?:number, proximo?:{umbral:number, fecha:string}|null, motivo?:string}}
 *   fuera: no es EJECUTADA ni CERRADA (no se evalúa). limite: ejecución + 20 días.
 */
export function evaluarOdt(o, fechaCorte) {
  const k = claveEstado(o && o.estado);
  if (k !== 'cerrada' && k !== 'ejecutada') return { o, tipo: 'fuera' };
  const revisar = (motivo) => ({ o, tipo: 'revisar', motivo, estado: k });
  const ej = o.ejecucion;
  if (!fechaReal(ej)) return revisar('sinEjecucion');
  if (!anioValido(ej)) return revisar('ejecucionFueraDeRango');
  if (fechaReal(fechaCorte) && ej > fechaCorte) return revisar('ejecucionDespuesDelCorte');
  const limite = sumarDias(ej, PLAZO_CIERRE_DIAS);
  if (k === 'cerrada') {
    if (!fechaReal(o.cerrada)) return revisar('sinCierre');
    if (!anioValido(o.cerrada)) return revisar('cierreFueraDeRango');
    if (o.cerrada < ej) return revisar('cierreAntesDeEjecucion');
    const dias = diasEntre(ej, o.cerrada);
    return { o, tipo: 'cerrada', dias, limite, cumple: dias <= PLAZO_CIERRE_DIAS };
  }
  if (!fechaReal(fechaCorte)) return revisar('sinFechaCorte');
  const dias = diasEntre(ej, fechaCorte);
  const sig = UMBRALES_AVISO.find((u) => u > dias);
  return {
    o, tipo: 'abierta', dias, limite, cumple: dias <= PLAZO_CIERRE_DIAS, vencida: dias > PLAZO_CIERRE_DIAS,
    franja: franjaDe(dias), umbral: umbralDe(dias), proximo: sig ? { umbral: sig, fecha: sumarDias(ej, sig) } : null
  };
}

/** La mediana de unos números (null sin datos; con un número par, el promedio de los dos del medio). */
export function mediana(xs) {
  const v = (xs || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Contadores en cero de un grupo (todo el corte o un contratista). */
function contadoresCumplimiento() {
  return { evaluables: 0, cerradas: 0, cerradasATiempo: 0, cerradasFuera: 0, abiertas: 0, abiertasEnPlazo: 0, abiertasVencidas: 0, revisar: 0 };
}
function sumar(c, e) {
  if (e.tipo === 'revisar') { c.revisar++; return; }
  if (e.tipo === 'cerrada') { c.evaluables++; c.cerradas++; if (e.cumple) c.cerradasATiempo++; else c.cerradasFuera++; return; }
  if (e.tipo === 'abierta') { c.evaluables++; c.abiertas++; if (e.vencida) c.abiertasVencidas++; else c.abiertasEnPlazo++; }
}
/** El divisor del % de cumplimiento: las cerradas evaluables y las abiertas que ya pasaron los 20 días. */
export const divisorCumplimiento = (c) => (c ? (c.cerradasATiempo || 0) + (c.cerradasFuera || 0) + (c.abiertasVencidas || 0) : 0);
/** % de cumplimiento (0..1) = cerradas a tiempo ÷ (cerradas evaluables + abiertas vencidas); null si el divisor es 0. */
export function pctCumplimiento(c) {
  const den = divisorCumplimiento(c);
  return den > 0 ? (c.cerradasATiempo || 0) / den : null;
}
export const textoCumplimiento = (c) => textoPct(pctCumplimiento(c));
/** «12 días», «12,5 días», «1 día» o «—». */
export function textoDias(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const t = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
  return t + (n === 1 ? ' día' : ' días');
}
const SIN_CONTRATISTA = '(sin contratista)';

/**
 * El cumplimiento de unas ODT (las del corte, ya filtradas por la pantalla).
 * @param {object[]} odts  @param {string} fechaCorte  'aaaa-mm-dd'
 * @returns {{fechaCorte:string, evaluadas:object[], totales:object, pct:number|null, mediana:number|null,
 *            porEmpresa:object[], franjas:Array<{clave, titulo, desde, hasta, odts:object[]}>, abiertas:object[],
 *            revisar:object[], fuera:number}}
 */
export function evaluarCumplimiento(odts, fechaCorte) {
  const evaluadas = (odts || []).map((o) => evaluarOdt(o, fechaCorte));
  const totales = contadoresCumplimiento();
  const grupos = new Map();
  const diasCierre = new Map();
  let fuera = 0;
  for (const e of evaluadas) {
    if (e.tipo === 'fuera') { fuera++; continue; }
    sumar(totales, e);
    const k = limpiar(e.o.empresa) || SIN_CONTRATISTA;
    let g = grupos.get(k);
    if (!g) { g = contadoresCumplimiento(); grupos.set(k, g); diasCierre.set(k, []); }
    sumar(g, e);
    if (e.tipo === 'cerrada') diasCierre.get(k).push(e.dias);
  }
  const cerradas = evaluadas.filter((e) => e.tipo === 'cerrada');
  const porDias = (a, b) => b.dias - a.dias || String(a.o.nro).localeCompare(String(b.o.nro));
  const abiertas = evaluadas.filter((e) => e.tipo === 'abierta').sort(porDias);
  const porEmpresa = [...grupos.entries()].map(([clave, c]) => ({ clave, ...c, pct: pctCumplimiento(c), mediana: mediana(diasCierre.get(clave)) }))
    .sort((a, b) => b.abiertasVencidas - a.abiertasVencidas || b.cerradasFuera - a.cerradasFuera || b.evaluables - a.evaluables || a.clave.localeCompare(b.clave, 'es'));
  return {
    fechaCorte,
    evaluadas,
    totales,
    pct: pctCumplimiento(totales),
    mediana: mediana(cerradas.map((e) => e.dias)),
    porEmpresa,
    franjas: FRANJAS.map((f) => ({ ...f, odts: abiertas.filter((e) => e.franja === f.clave) })),
    abiertas,
    revisar: evaluadas.filter((e) => e.tipo === 'revisar').sort((a, b) => String(a.o.nro).localeCompare(String(b.o.nro))),
    fuera
  };
}

/** «Próximo aviso» de una ODT abierta: «15 días · 05/12/2026», o lo que ya alcanzó. */
export function textoProximoAviso(e) {
  if (!e || e.tipo !== 'abierta') return '—';
  if (e.proximo) return e.proximo.umbral + ' días · ' + fechaDMA(e.proximo.fecha);
  return e.dias === PLAZO_CIERRE_DIAS ? 'Ya alcanzó el de 20 días (vence hoy)' : 'Ya alcanzó el de 20 días (incumplimiento)';
}

// ── Lo que se muestra en pantalla ──────────────────────────────────────────────
export const TITULO_CUMPLIMIENTO = 'Cumplimiento del cierre (20 días desde la ejecución)';
export const INTRO_CUMPLIMIENTO = 'Toda ODT debe quedar CERRADA a más tardar 20 días calendario después de su ejecución (la fecha en que el AZT recibe la zona de trabajo, «FECHA Y HORA AZT - RECIBE ZT» en Afinia; no la fecha en que se generó). Pasar de 20 días es un incumplimiento del contratista. Solo se evalúan las ODT EJECUTADA y CERRADA, con los mismos filtros de arriba.';
/** Un corte de la versión 1 o 2: no guardó la fecha de ejecución. */
export const SIN_EJECUCION_CORTE = 'Este corte se guardó antes de que se guardara la fecha de ejecución de cada ODT, así que con él no se puede calcular el cumplimiento del cierre. Para verlo, guarde un corte nuevo con el archivo de Afinia.';
export const SIN_EJECUCION_CORTE_LECTOR = 'Este corte se guardó antes de que se guardara la fecha de ejecución de cada ODT, así que con él no se puede calcular el cumplimiento del cierre. Abra en el historial un corte más reciente o pida a un administrador que guarde uno nuevo.';
/** Qué es cada tarjeta (se deja escrito en la pantalla). */
export const TARJETAS_CUMPLIMIENTO = Object.freeze([
  Object.freeze({ clave: 'evaluables', titulo: 'Evaluables', definicion: 'ODT EJECUTADA o CERRADA con sus fechas en regla (sin las de «fecha por revisar»).' }),
  Object.freeze({ clave: 'cerradasATiempo', titulo: 'Cerradas a tiempo', definicion: 'CERRADA a 20 días o menos de su ejecución.' }),
  Object.freeze({ clave: 'cerradasFuera', titulo: 'Cerradas fuera de plazo', definicion: 'CERRADA a más de 20 días de su ejecución: incumplimiento.' }),
  Object.freeze({ clave: 'abiertasVencidas', titulo: 'Abiertas vencidas', definicion: 'EJECUTADA sin cerrar y con más de 20 días desde su ejecución a la fecha del corte: incumplimiento.' }),
  Object.freeze({ clave: 'pct', titulo: '% de cumplimiento', definicion: 'Cerradas a tiempo ÷ (cerradas evaluables + abiertas vencidas). Las abiertas con 20 días o menos todavía no tienen veredicto y no cuentan.' }),
  Object.freeze({ clave: 'mediana', titulo: 'Mediana de días al cierre', definicion: 'La mitad de las ODT cerradas evaluables se cerró en este número de días o menos desde su ejecución.' })
]);

// ── Configuración de los avisos (odt_afinia_config/cumplimiento) ───────────────
export const TOPES_CONFIG = Object.freeze({ paraMin: 1, paraMax: 5, ccMax: 5, nombreMax: 80, responsableMin: 3, responsableMax: 120 });
/** Un correo: el MISMO patrón que la regla (odtCumCorreo en firestore.rules). */
export const RE_CORREO = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}[.][A-Za-z]{2,24}$/;
export const esCorreo = (v) => typeof v === 'string' && RE_CORREO.test(v);
/** Un nombre del saludo: de 1 a 80 caracteres, sin espacios en las puntas (como lo pide la regla). */
const RE_NOMBRE = /^\S(.{0,78}\S)?$/;
/** El responsable O.D.T.: de 3 a 120 caracteres, sin espacios en las puntas (como el del corte). */
const RE_RESPONSABLE = /^\S.{1,118}\S$/;
export const CLAVES_CONFIG = Object.freeze(['activo', 'remitente', 'para', 'cc', 'responsable', 'audienciaScript']);
/**
 * El identificador del script de Google aprobado (99 §236): de 0 a 200 caracteres de los que trae un id de cliente
 * de Google (letras, números, «.», «_», «-», «:» y «/»). El MISMO patrón que la regla (odtCumConfig).
 */
export const RE_AUDIENCIA = /^[A-Za-z0-9._:\/-]{0,200}$/;
export const esAudiencia = (v) => typeof v === 'string' && RE_AUDIENCIA.test(v);

/**
 * Lo que escribió el administrador, limpio: textos sin espacios de más, filas vacías fuera (un destinatario sin
 * correo ni nombre, una copia vacía).
 */
export function normalizarConfig(d = {}) {
  const x = d || {};
  return {
    activo: x.activo === true,
    remitente: limpiar(x.remitente),
    para: (Array.isArray(x.para) ? x.para : []).map((p) => ({ correo: limpiar(p && p.correo), nombre: limpiar(p && p.nombre) }))
      .filter((p) => p.correo || p.nombre),
    cc: (Array.isArray(x.cc) ? x.cc : []).map((c) => limpiar(c)).filter(Boolean),
    responsable: limpiar(x.responsable),
    audienciaScript: typeof x.audienciaScript === 'string' ? x.audienciaScript.trim() : ''
  };
}
/** El primer error de una configuración (ya normalizada), en llano; '' si está bien. */
export function errorConfigCumplimiento(c) {
  if (!c || typeof c !== 'object') return 'Falta la configuración de los avisos.';
  if (typeof c.activo !== 'boolean') return 'Indique si los avisos están activos.';
  if (!esCorreo(c.remitente)) return 'El correo del remitente no es válido.';
  const T = TOPES_CONFIG;
  if (!Array.isArray(c.para) || c.para.length < T.paraMin) return 'Escriba al menos un destinatario (correo y nombre).';
  if (c.para.length > T.paraMax) return 'Como mucho ' + T.paraMax + ' destinatarios.';
  for (const [i, p] of c.para.entries()) {
    if (!p || typeof p !== 'object' || Object.keys(p).length !== 2) return 'El destinatario ' + (i + 1) + ' no tiene la forma esperada.';
    if (!esCorreo(p.correo)) return 'El correo del destinatario ' + (i + 1) + ' no es válido.';
    if (typeof p.nombre !== 'string' || !RE_NOMBRE.test(p.nombre)) return 'Escriba el nombre del destinatario ' + (i + 1) + ' (de 1 a ' + T.nombreMax + ' caracteres): es el del saludo del correo.';
  }
  if (!Array.isArray(c.cc) || c.cc.length > T.ccMax) return 'Como mucho ' + T.ccMax + ' correos en copia.';
  for (const [i, x] of c.cc.entries()) if (!esCorreo(x)) return 'El correo en copia ' + (i + 1) + ' no es válido.';
  const todos = [...c.para.map((p) => p.correo), ...c.cc].map((x) => x.toLowerCase());
  if (new Set(todos).size !== todos.length) return 'Hay un correo repetido entre los destinatarios y las copias.';
  if (typeof c.responsable !== 'string' || !RE_RESPONSABLE.test(c.responsable)) return 'Escriba el RESPONSABLE O.D.T. de los cortes que generan avisos (de ' + T.responsableMin + ' a ' + T.responsableMax + ' caracteres), como sale en los cortes.';
  if (c.audienciaScript !== undefined && !esAudiencia(c.audienciaScript)) return 'El identificador del script de Google aprobado no es válido: apruébelo otra vez desde esta sección.';
  return '';
}
/** El documento que se guarda: EXACTAMENTE las 6 claves (la regla lo exige con size() == 6). Lanza si no es válido. */
export function docConfigCumplimiento(datos) {
  const c = normalizarConfig(datos);
  const e = errorConfigCumplimiento(c);
  if (e) throw new Error(e);
  return { activo: c.activo, remitente: c.remitente, para: c.para.map((p) => ({ correo: p.correo, nombre: p.nombre })), cc: [...c.cc], responsable: c.responsable, audienciaScript: c.audienciaScript };
}
export const TITULO_SECCION_AVISOS = 'Avisos de cumplimiento por correo';
export const AYUDA_SECCION_AVISOS = 'Cada vez que se GUARDA un corte del responsable que elija aquí, la plataforma revisa sus ODT EJECUTADA sin cerrar y deja en cola, como mucho, un correo por umbral: a los 10 días desde la ejecución (el contratista debe ejecutarlas a conformidad), a los 15 (apresurar el cierre) y a los 20 o más (cerrar de inmediato: incumplimiento). Cada ODT recibe cada aviso una sola vez; si cuando se revisa ya pasó varios umbrales, solo se envía el más alto. Los correos de la cola los envía un script de Google que vive en la cuenta remitente (una cuenta de Gmail dedicada a SGM): cada 10 minutos le pregunta a la plataforma si hay correos y los envía desde esa cuenta. Nadie copia claves: la primera vez, el script pide permiso y usted lo aprueba aquí.';
