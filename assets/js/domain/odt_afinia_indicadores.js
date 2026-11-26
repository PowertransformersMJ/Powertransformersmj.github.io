// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES por responsable (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (Responsable O.D.T. en Afinia, 2026-11-23): «que quede una trazabilidad con
// indicadores de cuántas ODT hay generadas, ejecutadas y cerradas por contratista», solo de las ODT
// donde él es RESPONSABLE O.D.T. Decisiones suyas: pestaña «Indicadores» en Firma de ODT Afinia;
// periodo desde el 01/01/2026; los cortes se hacen a pedido y cada uno queda guardado con su fecha.
//
// FUENTE: Afinia → Reportes → «Informe Seguimiento de Órdenes de Trabajo» (Nro. de registros: Todos;
// fechas previstas del 01/01/2026 a hoy) → INFORME_ODT_<AAAAMMDDhhmmss>_<usuario>.csv:
//   ISO-8859-1 (latin-1), fin de línea CRLF, separador «|», SIN comillas, 1.ª fila = encabezados,
//   48 columnas (ENCABEZADOS_AFINIA), fechas «dd/mm/aaaa hh:mm».
// Sin comillas, una barra «|» o un salto de línea dentro de un texto libre (descripción, observaciones)
// cambiaría el número de columnas. Por eso:
//   · una fila con MENOS columnas se une con la(s) línea(s) siguiente(s) mientras esas no empiecen un registro
//     nuevo (ITEM y NRO. ODT numéricos): un salto de línea dentro de un texto. Si el archivo no trae ITEM, solo
//     se une si juntas no pasan de las columnas del encabezado;
//   · una fila con MÁS columnas (una «|» dentro de un texto) se lee de izquierda a derecha hasta los textos
//     libres y, después de ellos, se prueba dónde caben las «|» de más: cada columna de la cola tiene su forma
//     (fecha, número, SI/NO, estado, nombre del responsable —con alguna letra—, texto) y gana la lectura que más
//     formas cumple (a igualdad, las «|» en los textos libres). Si ninguna cuadra del todo, o otra lectura igual de
//     buena da OTRO responsable, estado o fecha de cierre CON VALOR (una que solo los deja vacíos no es otra
//     lectura posible: es la misma con menos datos), la fila queda DUDOSA y se nombra en los avisos (N.º y
//     responsable): no desaparece callada;
//   · todas esas filas se cuentan y se avisan en la vista previa (con su línea y su N.º).
//
// Una MISMA ODT puede venir en VARIAS filas (cambian incidencias, elemento o fechas): se cuenta UNA vez por
// «NRO. ODT», con el estado y el contratista de su PRIMERA fila (si otra fila trae otro estado o contratista, se
// avisa) y la fecha prevista MÁS TEMPRANA de sus filas (no depende del orden en que Afinia exporte). El
// responsable se compara NORMALIZADO (sin tildes, en mayúsculas, espacios simples): el CSV lo trae en mayúsculas
// sin tildes y el perfil de SGM con tildes.
//
// INDICADORES (las definiciones que se muestran en pantalla, INDICADORES):
//   Generadas = todas las ODT del corte (cualquier estado) · Por ejecutar = GENERADA ·
//   Ejecutadas sin cerrar = EJECUTADA · Cerradas = CERRADA · No ejecutadas / inactivas = NO EJECUTADA + INACTIVA ·
//   % de cierre = CERRADA ÷ (total − NO EJECUTADA − INACTIVA), redondeado a una cifra decimal con números enteros
//   (como REDONDEAR de Excel). Un estado que esta página no conoce va a «Otro estado»: se cuenta aparte y queda en
//   el divisor del % de cierre.
//
// FECHA DE LOS DATOS de un corte: la hora de descarga que Afinia pone en el nombre del archivo
// (INFORME_ODT_<AAAAMMDDhhmmss>_…); si el nombre no la trae, el final del día de su fecha prevista más reciente.
// El «corte anterior» es el del mismo responsable con datos anteriores (a igualdad, el guardado antes): así un
// archivo viejo cargado hoy no invierte la comparación.
//
// AZT Y JEFE DE TRABAJO (pedido del Ingeniero del 2026-11-24: «un filtro para buscar por AZT y JEFE DE TRABAJO»):
//   · AZT = «AZT EN SITIO»; jefe de trabajo = «JEFE DE TRABAJO EN SITIO» y, si viene vacío, «JEFE DE TRABAJO» (el
//     asignado). Si los dos vienen vacíos, en los filtros sale «(sin dato)». Se leen por su NOMBRE y NO son de los 10
//     encabezados mínimos: si el archivo no los trae, quedan vacíos y la vista previa lo avisa. Las columnas de FIRMA
//     y FECHA Y HORA del AZT y del jefe no se usan.
//   · Se guardan con espacios simples y sin espacios a los lados (así se agrupan) y se muestran tal cual vienen.
//   · Como el estado y el contratista, se toman de la PRIMERA fila de la ODT (si otra fila trae otro, se avisa).
//   · «JEFE DE TRABAJO» queda entre los textos libres: en una fila con «|» de más se lee de izquierda a derecha y
//     podría correrse; esa fila ya se avisa (y solo se usa cuando «JEFE DE TRABAJO EN SITIO» viene vacío).
//   · Los cortes guardados desde ese día son la VERSIÓN 2 (VERSION_CORTE): cada ODT guardada lleva además `azt` y
//     `jefe` (11 campos). Los de la versión 1 (9 campos) se siguen leyendo, pero no traen con qué filtrar por ellos.
//
// Sin Firebase, sin DOM, sin red. Archivo NUEVO a propósito (L-102): ninguna pieza vieja de la caché lo nombra.
// ══════════════════════════════════════════════════════════════════════════════

// ── Colección (la misma de las reglas: bloque «Indicadores · ODT Afinia» de firestore.rules) ──
export const COL_CORTES = Object.freeze({
  cortes: 'odt_afinia_cortes',    // odt_afinia_cortes/{id}  (id aleatorio de 20)
  partes: 'partes'                // odt_afinia_cortes/{id}/partes/{0..59}  {k, odts:[…]}
});
/** 1: los primeros cortes (ODT de 9 campos). 2: desde el 2026-11-24, cada ODT con su AZT y su jefe (11 campos). */
export const VERSION_CORTE = 2;
export const TOPES_CORTE = Object.freeze({
  porParte: 400,              // ODT por parte (≈ 110 KB: lejos del 1 MB de un documento)
  partesMax: 60,              // 24.000 ODT por corte
  responsableMin: 3,
  responsableMax: 120,
  archivoNombreMax: 200,
  archivoBytesMax: 209715200, // 200 MB
  filasMax: 2000000,
  listasMax: 300,             // contratistas, tipos y zonas de un corte
  mesesMax: 240,
  textoMax: 200,              // cada texto de una ODT guardada
  nroMax: 40,                 // el N.º de una ODT guardada
  listado: 50                 // historial: limit <= 50
});
/** Inicio del periodo acordado (decisión del Ingeniero): la descarga de Afinia empieza ese día. */
export const PERIODO_DESDE = '2026-01-01';
export const SEPARADOR = '|';

/** Los 48 encabezados del informe de Afinia, en su orden (referencia para avisar si cambian). */
export const ENCABEZADOS_AFINIA = Object.freeze([
  'ITEM', 'NRO. CONSIGNACION', 'NRO. ODT', 'ODT PRINCIPAL', 'EMPRESA', 'TIPO DE TRABAJO', 'NRO. TRAZABILIDAD',
  'TIPO DE MANTENIMIENTO', 'CATEGORIA', 'FECHA Y HORA PREVISTA DE INICIO', 'FECHA Y HORA PREVISTA DE FIN',
  'FECHA Y HORA AZT - ENTREGA ZP', 'FIRMA AZT - ENTREGA ZP', 'FECHA Y HORA JEFE DE TRABAJO - RECIBE ZP',
  'FIRMA JEFE DE TRABAJO - RECIBE ZP', 'FECHA Y HORA JEFE DE TRABAJO - ENTREGA ZT', 'FIRMA JEFE DE TRABAJO - ENTREGA ZT',
  'FECHA Y HORA AZT - RECIBE ZT', 'FIRMA AZT - RECIBE ZT', 'ZONA', 'DEPARTAMENTO', 'MUNICIPIO', 'SUBESTACION',
  'ELEMENTO / BAHÍA / LN', 'EQUIPO', 'LUGAR DE TRABAJO', 'TRABAJO EN EQUIPOS DESENERGIZADOS',
  'TRABAJO EN TENSIÓN O EN CALIENTE', 'DESCRIPCIÓN DE LA PLANIFICACIÓN DEL TRABAJO / DAÑO', 'CANTIDAD PROGRAMADA',
  'CONDICIONES DE ASEO Y LIMPIEZA', 'JEFE DE TRABAJO', 'HORA REAL INICIO', 'HORA REAL FIN',
  'INCIDENCIA EN LA NO EJECUCIÓN', 'OBSERVACIONES', 'CONDICIONES AMBIENTALES FINALES',
  'DESCRIPCIÓN DEL TRABAJO REALIZADO', 'CANTIDAD EJECUTADA', 'NRO. DE REGISTROS', 'RESPONSABLE O.D.T.', 'AZT EN SITIO',
  'JEFE DE TRABAJO EN SITIO', 'ODT PENDIENTE ?', 'FECHA ODT PENDIENTE', 'FECHA ODT CERRADA', 'ESTADO FINAL DE LA ODT',
  'FUENTE DE ORIGEN'
]);

/** Lo que se lee de cada fila: campo → encabezado (los mínimos que debe traer el archivo). */
export const CAMPOS = Object.freeze({
  nro: 'NRO. ODT',
  principal: 'ODT PRINCIPAL',
  empresa: 'EMPRESA',
  tipo: 'TIPO DE TRABAJO',
  prevista: 'FECHA Y HORA PREVISTA DE INICIO',
  zona: 'ZONA',
  subestacion: 'SUBESTACION',
  responsable: 'RESPONSABLE O.D.T.',
  cerrada: 'FECHA ODT CERRADA',
  estado: 'ESTADO FINAL DE LA ODT'
});
export const ENCABEZADOS_MINIMOS = Object.freeze(Object.values(CAMPOS));
/**
 * Lo que se lee si el archivo lo trae (NO es de los mínimos): el AZT en sitio y el jefe de trabajo en sitio; si este
 * viene vacío, el jefe de trabajo asignado (`jefeRespaldo`).
 */
export const CAMPOS_OPCIONALES = Object.freeze({
  azt: 'AZT EN SITIO',
  jefe: 'JEFE DE TRABAJO EN SITIO',
  jefeRespaldo: 'JEFE DE TRABAJO'
});
/** Lo que muestran los filtros (y la lista) cuando una ODT no trae el AZT o el jefe de trabajo. */
export const SIN_DATO = '(sin dato)';

/** Columnas de texto libre (donde puede colarse una «|» o un salto de línea): marcan la zona sin ancla. */
const RE_TEXTO_LIBRE = /^(ELEMENTO|EQUIPO$|LUGAR DE TRABAJO|DESCRIPCION|CONDICIONES|INCIDENCIA|OBSERVACIONES)/;

// ── Estados de Afinia y contadores ─────────────────────────────────────────────
export const ESTADOS_AFINIA = Object.freeze(['GENERADA', 'EJECUTADA', 'NO EJECUTADA', 'CERRADA', 'INACTIVA']);
/** Claves de los contadores (en este orden se guardan y se muestran). `total` = Generadas. */
export const CLAVES = Object.freeze(['total', 'generada', 'ejecutada', 'noEjecutada', 'cerrada', 'inactiva', 'otro']);
const CLAVE_DE_ESTADO = Object.freeze({ GENERADA: 'generada', EJECUTADA: 'ejecutada', 'NO EJECUTADA': 'noEjecutada', CERRADA: 'cerrada', INACTIVA: 'inactiva' });
/** Nombre de cada contador en pantalla (lenguaje del Ingeniero). */
export const ETIQUETA_CLAVE = Object.freeze({
  total: 'Generadas', generada: 'Por ejecutar', ejecutada: 'Ejecutadas sin cerrar', noEjecutada: 'No ejecutadas',
  cerrada: 'Cerradas', inactiva: 'Inactivas', otro: 'Otro estado', noEjecutadaInactiva: 'No ejecutadas / inactivas'
});
/** El estado de Afinia detrás de cada contador (encabezados de la tabla). */
export const ESTADO_DE_CLAVE = Object.freeze({
  generada: 'GENERADA', ejecutada: 'EJECUTADA', noEjecutada: 'NO EJECUTADA', cerrada: 'CERRADA', inactiva: 'INACTIVA', otro: 'otro'
});

/** Qué es cada indicador (se deja escrito en la pantalla). */
export const INDICADORES = Object.freeze([
  Object.freeze({ clave: 'total', titulo: 'Generadas', definicion: 'Todas las ODT del corte, en cualquier estado. Cada N.º de ODT cuenta una sola vez aunque venga en varias filas.' }),
  Object.freeze({ clave: 'generada', titulo: 'Por ejecutar', definicion: 'ODT en estado GENERADA en Afinia: todavía no se ejecutan.' }),
  Object.freeze({ clave: 'ejecutada', titulo: 'Ejecutadas sin cerrar', definicion: 'ODT en estado EJECUTADA: el trabajo se hizo y falta cerrarlas.' }),
  Object.freeze({ clave: 'cerrada', titulo: 'Cerradas', definicion: 'ODT en estado CERRADA en Afinia.' }),
  Object.freeze({ clave: 'noEjecutadaInactiva', titulo: 'No ejecutadas / inactivas', definicion: 'ODT en estado NO EJECUTADA o INACTIVA: no se cuentan en el % de cierre.' }),
  Object.freeze({ clave: 'pctCierre', titulo: '% de cierre', definicion: 'Cerradas ÷ (Generadas − No ejecutadas − Inactivas).' })
]);
export const DEFINICION_OTRO = 'Otro estado: un estado que Afinia muestre y esta página no conozca. Se cuenta aparte y sí entra en el divisor del % de cierre.';

// ── Utilidades de texto ────────────────────────────────────────────────────────
const texto = (v) => (v == null ? '' : String(v));
/** Sin tildes, en mayúsculas y con espacios simples (para comparar nombres y encabezados). */
export function normalizarTexto(v) {
  return texto(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}
/** El nombre de una persona, para compararlo con el de otra fuente (CSV ↔ perfil de SGM). */
export const normalizarNombre = normalizarTexto;
/** Espacios simples y sin espacios a los lados (lo que se muestra y se guarda). */
export const limpiar = (v) => texto(v).replace(/\s+/g, ' ').trim();
const recortar = (v, n = TOPES_CORTE.textoMax) => { const s = limpiar(v); return s.length > n ? s.slice(0, n) : s; };
/** Cierra una frase con punto, sin dejar «….» cuando la lista ya termina en puntos suspensivos. */
const frase = (s) => (/[.…]$/.test(s) ? s : s + '.');
/** Los primeros `n` de una lista, con «…» si hay más. */
const primeros = (xs, n, f = (x) => x) => xs.slice(0, n).map(f).join(', ') + (xs.length > n ? '…' : '');

/** El contador de un estado de Afinia ('otro' si no se conoce). */
export function claveEstado(estado) {
  return CLAVE_DE_ESTADO[normalizarTexto(estado)] || 'otro';
}

// ── Fechas ─────────────────────────────────────────────────────────────────────
const RE_FECHA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/;
/** «dd/mm/aaaa hh:mm» (o solo la fecha) → 'aaaa-mm-dd'; '' si está vacía o no es una fecha real. */
export function fechaIso(v) {
  const m = RE_FECHA.exec(limpiar(v));
  if (!m) return '';
  return isoDe(Number(m[3]), Number(m[2]), Number(m[1]));
}
/** Año, mes y día → 'aaaa-mm-dd'; '' si no es una fecha real. */
function isoDe(a, mes, d) {
  if (!(a >= 1000 && a <= 9999) || mes < 1 || mes > 12 || d < 1) return '';
  const dias = [31, (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (d > dias) return '';
  return a + '-' + String(mes).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
const RE_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const esIso = (v) => typeof v === 'string' && RE_ISO.test(v);
/** 'aaaa-mm-dd' → 'dd/mm/aaaa' (para mostrar); '—' si no hay. */
export function fechaDMA(iso) {
  return esIso(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** 'aaaa-mm' → 'mar 2026' (corto) o 'marzo de 2026' (largo). */
export function nombreMes(mes, largo = false) {
  const m = /^(\d{4})-(\d{2})$/.exec(texto(mes));
  if (!m) return texto(mes);
  const i = Number(m[2]) - 1;
  return largo ? MESES_LARGO[i] + ' de ' + m[1] : MESES[i] + ' ' + m[1];
}
/** El mes siguiente a 'aaaa-mm'. */
function mesSiguiente(m) {
  const a = Number(m.slice(0, 4)); const n = Number(m.slice(5, 7));
  return n === 12 ? (a + 1) + '-01' : a + '-' + String(n + 1).padStart(2, '0');
}

// ── Fecha de los DATOS de un corte ─────────────────────────────────────────────
const RE_SELLO = /INFORME_ODT_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/i;
const RE_FECHA_DATOS = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
/** ¿'aaaa-mm-ddThh:mm:ss'? */
export const esFechaDatos = (v) => typeof v === 'string' && RE_FECHA_DATOS.test(v);
/** La hora de descarga que Afinia pone en el nombre del archivo (INFORME_ODT_<AAAAMMDDhhmmss>_…), o ''. */
export function selloDeArchivo(nombre) {
  const m = RE_SELLO.exec(texto(nombre));
  if (!m) return '';
  const iso = isoDe(Number(m[1]), Number(m[2]), Number(m[3]));
  const v = iso + 'T' + m[4] + ':' + m[5] + ':' + m[6];
  return iso && esFechaDatos(v) ? v : '';
}
/**
 * La fecha de los datos de un corte: la hora de descarga del nombre del archivo o, si no la trae, el final del día
 * de la fecha prevista más reciente del corte.
 * @returns {{valor:string, origen:'archivo'|'rango'|''}}
 */
export function fechaDatosDe(nombreArchivo, rango) {
  const s = selloDeArchivo(nombreArchivo);
  if (s) return { valor: s, origen: 'archivo' };
  const h = rango && rango.hasta;
  return esIso(h) ? { valor: h + 'T23:59:59', origen: 'rango' } : { valor: '', origen: '' };
}
/** La fecha de los datos de un corte guardado (si no la trae, se calcula como al guardarlo). */
export function fechaDatosDeCorte(c) {
  if (c && esFechaDatos(c.fechaDatos)) return c.fechaDatos;
  return fechaDatosDe(c && c.archivo && c.archivo.nombre, c && c.rango).valor;
}
/**
 * La hora del nombre del archivo viene en UTC: Afinia la pone así (comprobado el 2026-11-25: un archivo descargado en
 * Colombia el 25/11 a las 20:53 se llama INFORME_ODT_20261126015247…). Se GUARDA tal cual (ordena los cortes igual) y se
 * MUESTRA en hora de Colombia (UTC−5, sin horario de verano): 'aaaa-mm-ddThh:mm:ss' UTC → «dd/mm/aaaa hh:mm».
 */
export function textoHoraColombiaDeSello(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(texto(v));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 5 * 3600000);
  const dos = (n) => String(n).padStart(2, '0');
  return dos(d.getUTCDate()) + '/' + dos(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + dos(d.getUTCHours()) + ':' + dos(d.getUTCMinutes());
}
/** «23/11/2026 16:35» (la hora de descarga del archivo, en hora de Colombia) o «20/11/2026 (fecha prevista más reciente)»; '—' si no hay. */
export function textoFechaDatos(c) {
  const v = fechaDatosDeCorte(c);
  if (!v) return '—';
  return selloDeArchivo(c && c.archivo && c.archivo.nombre) === v ? textoHoraColombiaDeSello(v) : fechaDMA(v.slice(0, 10)) + ' (fecha prevista más reciente)';
}

// ── Decodificación ─────────────────────────────────────────────────────────────
/**
 * Bytes del archivo → {texto, codificacion}. El informe de Afinia viene en ISO-8859-1; si el archivo se guardó
 * en UTF-8 (con marca BOM, o UTF-8 válido con letras no ASCII), se lee como UTF-8.
 */
export function decodificar(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (u.length >= 3 && u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF) {
    return { texto: new TextDecoder('utf-8').decode(u.subarray(3)), codificacion: 'UTF-8' };
  }
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(u);
    if (/[^\x00-\x7F]/.test(t)) return { texto: t, codificacion: 'UTF-8' };
  } catch (_) { /* no es UTF-8: es el latin-1 de Afinia */ }
  return { texto: new TextDecoder('windows-1252').decode(u), codificacion: 'ISO-8859-1' };
}

// ── Forma de cada columna (para leer bien una fila con «|» de más) ─────────────
/**
 * 'fecha' | 'numero' | 'sino' | 'estado' | 'nombre' | 'texto'. Un texto puede traer «|»; el nombre del responsable
 * también (rara vez: cuesta puntos), pero debe tener alguna letra (una lectura corrida le pondría el número de la
 * columna vecina); lo demás no trae «|».
 */
function formaDeColumna(nombreNormalizado) {
  const x = nombreNormalizado;
  if (/^FECHA/.test(x)) return 'fecha';
  if (/^(CANTIDAD|NRO\.? |ITEM$)/.test(x)) return 'numero';
  if (/^ODT (PENDIENTE|PRINCIPAL)/.test(x)) return 'sino';
  if (x === normalizarTexto(CAMPOS.estado)) return 'estado';
  if (x === normalizarTexto(CAMPOS.responsable)) return 'nombre';
  return 'texto';
}
/** ¿La columna puede traer una «|» dentro? (un texto libre y, con castigo, el nombre del responsable) */
const admiteBarra = (forma) => forma === 'texto' || forma === 'nombre';
function cumpleForma(forma, v) {
  const s = limpiar(v);
  if (forma === 'fecha') return s === '' || fechaIso(s) !== '';
  if (forma === 'numero') return s === '' || /^-?\d+([.,]\d+)?$/.test(s);
  if (forma === 'sino') return /^(SI|NO)?$/i.test(s);
  if (forma === 'estado') return s === '' || /^[A-ZÁÉÍÓÚÑÜ ]+$/i.test(s);
  if (forma === 'nombre') return s === '' || /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s);
  return true;
}

// ── Lectura del CSV ────────────────────────────────────────────────────────────
/**
 * Un lector por pasos del texto ya decodificado (para no congelar la pantalla con archivos grandes, de decenas de
 * MB: la pantalla llama `paso()` y deja respirar al navegador entre pasos). `leerCsv` lo corre de una vez.
 * @param {string} contenido
 * @returns {{paso:(n?:number)=>boolean, resultado:()=>object, avance:()=>number}}
 */
export function crearLector(contenido) {
  const t = texto(contenido).replace(/^﻿/, '');
  const lineas = t.split(/\r\n|\n|\r/);
  let iEnc = 0;
  while (iEnc < lineas.length && !lineas[iEnc].trim()) iEnc++;
  const encabezados = iEnc < lineas.length ? lineas[iEnc].split(SEPARADOR).map((s) => limpiar(s)) : [];
  const n = encabezados.length;
  const norm = encabezados.map(normalizarTexto);
  const indice = {};
  for (const [campo, enc] of Object.entries(CAMPOS)) indice[campo] = norm.indexOf(normalizarTexto(enc));
  for (const [campo, enc] of Object.entries(CAMPOS_OPCIONALES)) indice[campo] = norm.indexOf(normalizarTexto(enc));
  const faltan = ENCABEZADOS_MINIMOS.filter((enc) => !norm.includes(normalizarTexto(enc)));
  const libres = norm.map((x, i) => (RE_TEXTO_LIBRE.test(x) ? i : -1)).filter((i) => i >= 0);
  const iniLibre = libres.length ? libres[0] : n;
  const finLibre = libres.length ? libres[libres.length - 1] : n;
  const distintosAfinia = n !== ENCABEZADOS_AFINIA.length
    || ENCABEZADOS_AFINIA.some((enc, i) => normalizarTexto(enc) !== norm[i]);
  const formas = norm.map(formaDeColumna);
  const iItem = norm.indexOf('ITEM');
  let ultimaConTexto = lineas.length - 1;
  while (ultimaConTexto > iEnc && !lineas[ultimaConTexto].trim()) ultimaConTexto--;

  const registros = [];
  const raras = [];       // {linea, columnas, tipo:'de más'|'de menos'|'unida', lineas?, nro, responsable, dudosa?}
  const sinNro = [];      // líneas sin N.º de ODT (no se cuentan)
  let vacias = 0;
  let i = iEnc + 1;
  const fin = faltan.length ? i : lineas.length;   // sin los encabezados mínimos no se lee nada

  /** ¿Esta línea empieza un registro nuevo? (ITEM y NRO. ODT numéricos). */
  const empiezaRegistro = (partes) => iItem >= 0 && indice.nro >= 0 && partes.length > Math.max(iItem, indice.nro)
    && /^\d+$/.test(partes[iItem].trim()) && /^\d+$/.test(partes[indice.nro].trim());

  /**
   * Una fila con «|» de más: lo de antes de los textos libres, de izquierda a derecha; la cola (después de ellos),
   * la lectura que más formas cumple. → {leer:(j)=>string, dudosa:boolean}
   */
  function alinear(c) {
    const k = c.length - n;
    const izquierda = (j) => c[j] ?? '';
    // Lo de antes de los textos libres debe cuadrar tal cual (una «|» ahí corre todo y no se puede saber dónde).
    let dudosaIzq = false;
    for (let j = 0; j < Math.min(iniLibre, n); j++) if (formas[j] !== 'texto' && !cumpleForma(formas[j], c[j])) dudosaIzq = true;
    if (!libres.length) return { leer: izquierda, dudosa: true };
    const cola = [];
    for (let j = finLibre + 1; j < n; j++) cola.push(j);
    const m = cola.length;
    const derecha = (j) => (j > finLibre ? c[c.length - (n - j)] ?? '' : c[j] ?? '');
    if (!m) return { leer: izquierda, dudosa: dudosaIzq };
    if (k > 4) return { leer: derecha, dudosa: true };   // más de 4 «|» en una fila: no se prueba (sería lento)
    const iResp = cola.indexOf(indice.responsable);
    const iEstado = cola.indexOf(indice.estado);
    const iCerr = cola.indexOf(indice.cerrada);
    let mejor = null;
    const candidatos = [];
    // s[j] = «|» de más que hay antes de la columna cola[j] (no decrece; 0..k). s[0] = las de los textos libres.
    const s = new Array(m).fill(0);
    (function recorrer(j, min) {
      if (j === m) { evaluar(); return; }
      for (let v = min; v <= k; v++) { s[j] = v; recorrer(j + 1, v); }
    })(0, 0);
    function evaluar() {
      let puntos = 0; let falla = false;
      const valores = [];
      for (let j = 0; j < m; j++) {
        const dentro = (j < m - 1 ? s[j + 1] : k) - s[j];          // «|» dentro de esta columna
        const col = cola[j];
        if (dentro > 0 && !admiteBarra(formas[col])) return;        // una fecha, un número o el estado no traen «|»
        const v = c.slice(col + s[j], col + s[j] + dentro + 1).join(SEPARADOR);
        valores.push(v);
        if (formas[col] !== 'texto') { if (cumpleForma(formas[col], v)) puntos += 10; else falla = true; }
        if (col === indice.estado && CLAVE_DE_ESTADO[normalizarTexto(v)]) puntos += 5;
        if (col === indice.responsable && dentro > 0) puntos -= 3;   // un nombre rara vez trae «|»
      }
      const x = { s: [...s], puntos, falla, valores, clave: [iResp, iEstado, iCerr].map((p) => (p >= 0 ? normalizarTexto(valores[p]) : '')) };
      candidatos.push(x);
      // A igualdad: más «|» en los textos libres; después, lo más tarde posible en la cola.
      const suma = (a) => a.reduce((t2, v) => t2 + v, 0);
      if (!mejor || x.puntos > mejor.puntos || (x.puntos === mejor.puntos && (x.s[0] > mejor.s[0] || (x.s[0] === mejor.s[0] && suma(x.s) < suma(mejor.s))))) mejor = x;
    }
    if (!mejor) return { leer: derecha, dudosa: true };
    // Empate de verdad: otra lectura igual de buena que da OTRO responsable, estado o fecha de cierre CON VALOR. Si solo
    // los deja vacíos (p. ej. la cola de la fila viene vacía y la «|» de más cabría en «AZT EN SITIO»), no es otra
    // lectura posible: es la misma con menos datos, y la elegida queda (sin marcarla dudosa).
    const otraLectura = (x) => x.clave.some((v, i) => v !== '' && v !== mejor.clave[i]);
    const empate = candidatos.some((x) => x !== mejor && x.puntos === mejor.puntos && otraLectura(x));
    const elegido = mejor;
    const pos = new Map(cola.map((col, j) => [col, j]));
    return {
      leer: (j) => (pos.has(j) ? elegido.valores[pos.get(j)] : j < iniLibre ? izquierda(j) : (c[j] ?? '')),
      dudosa: dudosaIzq || elegido.falla || empate
    };
  }

  function paso(max = 4000) {
    const tope = Math.min(fin, i + max);
    while (i < tope) {
      const linea = i + 1;
      const cruda = lineas[i];
      i++;
      if (!cruda.trim()) { vacias++; continue; }
      let c = cruda.split(SEPARADOR);
      let unidas = 0;
      // Un salto de línea dentro de un texto libre parte la fila: se une con las líneas siguientes mientras no
      // empiecen un registro nuevo (sin ITEM en el archivo: solo si juntas no pasan de las columnas del encabezado).
      while (c.length < n && i <= ultimaConTexto && unidas < 200) {
        const sig = lineas[i].split(SEPARADOR);
        if (iItem >= 0 ? empiezaRegistro(sig) : c.length + sig.length - 1 > n) break;
        c[c.length - 1] += '\n' + sig[0];
        c = c.concat(sig.slice(1));
        i++; unidas++;
      }
      let leer = (j) => (j < 0 ? '' : c[j] ?? '');
      let dudosa = false;
      if (c.length > n) { const a = alinear(c); leer = (j) => (j < 0 ? '' : a.leer(j)); dudosa = a.dudosa; }
      const nro = limpiar(leer(indice.nro));
      const responsable = limpiar(leer(indice.responsable));
      const estado = normalizarTexto(leer(indice.estado));
      if (c.length !== n || unidas) {
        const rara = { linea, columnas: c.length, tipo: c.length > n ? 'de más' : c.length < n ? 'de menos' : 'unida', nro, responsable };
        if (unidas) rara.lineas = unidas + 1;
        if (dudosa) rara.dudosa = true;
        if (c.length < n && (!responsable || !estado)) rara.incompleta = true;
        raras.push(rara);
      }
      if (!nro) { sinNro.push(linea); continue; }
      registros.push({
        linea,
        nro,
        principal: normalizarTexto(leer(indice.principal)) === 'SI',
        empresa: recortar(leer(indice.empresa)),
        tipo: recortar(leer(indice.tipo)),
        prevista: fechaIso(leer(indice.prevista)),
        previstaCruda: limpiar(leer(indice.prevista)),
        zona: recortar(leer(indice.zona)),
        subestacion: recortar(leer(indice.subestacion)),
        responsable,
        rc: normalizarNombre(responsable),
        cerrada: fechaIso(leer(indice.cerrada)),
        estado,
        azt: recortar(leer(indice.azt)),
        jefe: recortar(leer(indice.jefe)) || recortar(leer(indice.jefeRespaldo))
      });
    }
    return i >= fin;
  }

  function resultado() {
    const porResp = new Map();
    const todos = new Map();      // N.º → claves de sus responsables
    for (const r of registros) {
      let rs = todos.get(r.nro);
      if (!rs) { rs = new Set(); todos.set(r.nro, rs); }
      rs.add(r.rc);
      let g = porResp.get(r.rc);
      if (!g) { g = { nombre: r.responsable, clave: r.rc, filas: 0, nros: new Set() }; porResp.set(r.rc, g); }
      g.filas++; g.nros.add(r.nro);
    }
    const responsables = [...porResp.values()]
      .map((g) => ({ nombre: g.nombre || '(sin responsable)', clave: g.clave, filas: g.filas, odts: g.nros.size }))
      .sort((a, b) => b.filas - a.filas || a.nombre.localeCompare(b.nombre, 'es'));
    const estadosFila = {};
    for (const r of registros) estadosFila[r.estado || '(sin estado)'] = (estadosFila[r.estado || '(sin estado)'] || 0) + 1;
    // Un mismo N.º con dos o más responsables: cuenta una vez en el archivo y una vez en cada responsable.
    const compartidos = [...todos.entries()].filter(([, rs]) => rs.size > 1).map(([nro, rs]) => ({ nro, claves: [...rs].sort() }))
      .sort((a, b) => a.nro.localeCompare(b.nro));
    return {
      ok: faltan.length === 0 && n > 0,
      encabezados, columnas: n, faltan, distintosAfinia,
      // ¿Trae el archivo las columnas del AZT y del jefe de trabajo? (no son de los mínimos)
      traeAzt: indice.azt >= 0, traeJefe: indice.jefe >= 0 || indice.jefeRespaldo >= 0,
      registros, filas: registros.length, odtsArchivo: todos.size,
      responsables, estadosFila, raras, sinNro, vacias, compartidos
    };
  }
  const avance = () => (fin <= iEnc + 1 ? 1 : Math.min(1, (i - iEnc - 1) / (fin - iEnc - 1)));
  return { paso, resultado, avance };
}

/** Lee el CSV de una vez (pruebas y archivos chicos). */
export function leerCsv(contenido) {
  const l = crearLector(contenido);
  while (!l.paso(1e9));
  return l.resultado();
}

/**
 * Lee el CSV por pasos, esperando `pausa()` entre pasos (la pantalla le pasa un setTimeout 0) y contando el avance.
 * @param {string} contenido
 * @param {{pausa?:()=>Promise<void>, cada?:number, alAvance?:(fraccion:number)=>void}} [op]
 */
export async function leerCsvPorPasos(contenido, { pausa = null, cada = 3000, alAvance = null } = {}) {
  const l = crearLector(contenido);
  for (;;) {
    const listo = l.paso(cada);
    if (typeof alAvance === 'function') alAvance(l.avance());
    if (listo) break;
    if (typeof pausa === 'function') await pausa();
  }
  return l.resultado();
}

/**
 * ¿Es otro archivo (no el informe de Afinia en CSV con «|»)? Sí, si el encabezado trae una sola columna (p. ej.
 * separado por «;» o «,», como lo deja Excel al guardarlo) o no trae NINGUNO de los encabezados mínimos.
 */
export function esOtroArchivo(lectura) {
  if (!lectura || lectura.ok) return false;
  return !(lectura.columnas > 1) || lectura.faltan.length >= ENCABEZADOS_MINIMOS.length;
}
export const MSG_OTRO_ARCHIVO = 'Este archivo no es el «Informe Seguimiento de Órdenes de Trabajo» de Afinia en CSV. Si lo abrió y lo guardó en Excel, descárguelo otra vez de Afinia y cárguelo sin abrirlo.';
// El corte se guarda igual (versión 2) y su filtro queda con una sola opción, «(sin dato)», con todas sus ODT.
export const MSG_SIN_COLUMNA_AZT = 'El archivo no trae la columna «AZT EN SITIO»: el corte se guarda sin el AZT y, en su filtro, todas las ODT saldrán como «' + SIN_DATO + '».';
export const MSG_SIN_COLUMNA_JEFE = 'El archivo no trae las columnas «JEFE DE TRABAJO EN SITIO» ni «JEFE DE TRABAJO»: el corte se guarda sin el jefe de trabajo y, en su filtro, todas las ODT saldrán como «' + SIN_DATO + '».';

// ── Responsable, deduplicación y agregados ─────────────────────────────────────
/** La entrada de la lista de responsables que corresponde a `nombre` (comparado normalizado), o null. */
export function buscarResponsable(lectura, nombre) {
  const c = normalizarNombre(nombre);
  if (!c || !lectura || !Array.isArray(lectura.responsables)) return null;
  return lectura.responsables.find((r) => r.clave === c) || null;
}

/** Las filas del responsable (comparado normalizado). */
export function filtrarPorResponsable(registros, nombre) {
  const c = normalizarNombre(nombre);
  return (registros || []).filter((r) => (r.rc ?? normalizarNombre(r.responsable)) === c);
}

/** La ODT que se guarda (versión 2: 11 campos, con su AZT en sitio y su jefe de trabajo), desde su primera fila. */
export function odtDeFila(r) {
  return {
    nro: recortar(r.nro, TOPES_CORTE.nroMax), empresa: recortar(r.empresa), tipo: recortar(r.tipo), zona: recortar(r.zona),
    subestacion: recortar(r.subestacion), prevista: esIso(r.prevista) ? r.prevista : '', cerrada: esIso(r.cerrada) ? r.cerrada : '',
    estado: recortar(normalizarTexto(r.estado)), principal: r.principal === true,
    azt: recortar(r.azt), jefe: recortar(r.jefe)
  };
}

/** Lo que se compara entre las filas de una misma ODT (además del estado): se toma el de la primera y se avisa. */
const CAMPOS_PRIMERA_FILA = Object.freeze(['empresa', 'azt', 'jefe']);
/**
 * Una ODT por N.º: el estado, el contratista, el AZT y el jefe de su PRIMERA fila (avisa si otra fila trae otro) y la
 * fecha prevista MÁS TEMPRANA de sus filas (no depende del orden del archivo; avisa cuántas traían fechas distintas).
 * @returns {{odts:object[], conflictos:Array<{nro, campo:'estado'|'empresa'|'azt'|'jefe', primero, otro, linea}>,
 *            repetidas:number, previstasDistintas:number}}
 */
export function deduplicar(filas) {
  const porNro = new Map();
  const conflictos = [];
  let repetidas = 0;
  for (const r of filas || []) {
    const previo = porNro.get(r.nro);
    if (!previo) { porNro.set(r.nro, { odt: odtDeFila(r), previstas: new Set(esIso(r.prevista) ? [r.prevista] : []) }); continue; }
    repetidas++;
    if (esIso(r.prevista)) {
      previo.previstas.add(r.prevista);
      if (!previo.odt.prevista || r.prevista < previo.odt.prevista) previo.odt.prevista = r.prevista;
    }
    const est = recortar(normalizarTexto(r.estado));
    if (est !== previo.odt.estado) conflictos.push({ nro: r.nro, campo: 'estado', primero: previo.odt.estado, otro: est, linea: r.linea });
    for (const campo of CAMPOS_PRIMERA_FILA) {
      const v = recortar(r[campo]);
      if (v !== previo.odt[campo]) conflictos.push({ nro: r.nro, campo, primero: previo.odt[campo], otro: v, linea: r.linea });
    }
  }
  const xs = [...porNro.values()];
  return { odts: xs.map((x) => x.odt), conflictos, repetidas, previstasDistintas: xs.filter((x) => x.previstas.size > 1).length };
}

/** Contadores en cero. */
export function contadores() {
  return { total: 0, generada: 0, ejecutada: 0, noEjecutada: 0, cerrada: 0, inactiva: 0, otro: 0 };
}
function sumar(c, o) { c.total++; c[claveEstado(o.estado)]++; }

/** El divisor del % de cierre: total − no ejecutadas − inactivas. */
const divisor = (c) => (c ? (c.total || 0) - (c.noEjecutada || 0) - (c.inactiva || 0) : 0);
/** % de cierre (0..1) = cerradas ÷ (total − no ejecutadas − inactivas); null si el divisor es 0. */
export function pctCierre(c) {
  if (!c) return null;
  const den = divisor(c);
  return den > 0 ? (c.cerrada || 0) / den : null;
}
/** El % de cierre en milésimas, redondeado con enteros (como REDONDEAR de Excel); null si no aplica. */
function milesimasCierre(c) {
  const den = divisor(c);
  return den > 0 ? Math.round(((c.cerrada || 0) * 1000) / den) : null;
}
const conComa = (milesimas) => (milesimas / 10).toFixed(1).replace('.', ',');
/** El % de cierre de unos contadores para mostrar: «75,0 %» (una cifra decimal, coma decimal); '—' si no aplica. */
export function textoCierre(c) {
  const m = c ? milesimasCierre(c) : null;
  return m == null ? '—' : conComa(m) + ' %';
}
/** Una fracción (0..1) como porcentaje: «75,0 %»; '—' si no es un número. Sin el error de la coma flotante en los medios. */
export function textoPct(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return '—';
  return conComa(Math.round(Number((p * 1000).toPrecision(12)))) + ' %';
}
/**
 * La diferencia entre el % de cierre de dos cortes, en puntos y a partir de lo que se MUESTRA de cada uno (así cuadra
 * con la resta de los dos números de la tabla): «+1,2 puntos», «−0,5 puntos», «0 puntos»; '—' si falta uno.
 */
export function deltaCierre(antes, ahora) {
  const a = antes ? milesimasCierre(antes) : null; const b = ahora ? milesimasCierre(ahora) : null;
  if (a == null || b == null) return '—';
  const d = b - a;
  return d === 0 ? '0 puntos' : (d > 0 ? '+' : '−') + conComa(Math.abs(d)) + ' puntos';
}
/** El valor de un indicador en unos contadores (incluye los compuestos). */
export function valorIndicador(c, clave) {
  if (!c) return 0;
  if (clave === 'noEjecutadaInactiva') return (c.noEjecutada || 0) + (c.inactiva || 0);
  if (clave === 'pctCierre') return pctCierre(c);
  return c[clave] || 0;
}

/**
 * Los meses SIN huecos: desde enero de 2026 (o el primero con datos, si es anterior) hasta el último con datos, con
 * {generadas:0, cerradas:0} en los que no tienen; así el eje del gráfico es continuo y la tabla muestra los ceros.
 * Si el tramo pasa de TOPES_CORTE.mesesMax (una fecha mal escrita, p. ej.), quedan solo los meses con datos.
 */
export function rellenarMeses(porMes) {
  const xs = [...(porMes || [])].sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
  if (!xs.length) return xs;
  const desdePeriodo = PERIODO_DESDE.slice(0, 7);
  const ini = xs[0].mes < desdePeriodo ? xs[0].mes : desdePeriodo;
  const fin = xs[xs.length - 1].mes;
  const por = new Map(xs.map((m) => [m.mes, m]));
  const out = [];
  for (let m = ini; m <= fin; m = mesSiguiente(m)) {
    out.push(por.get(m) || { mes: m, generadas: 0, cerradas: 0 });
    if (out.length > TOPES_CORTE.mesesMax) return xs;
  }
  return out;
}

const SIN = Object.freeze({ empresa: '(sin contratista)', tipo: '(sin tipo de trabajo)', zona: '(sin zona)' });
/**
 * Totales por estado; por contratista, tipo de trabajo y zona (con sus contadores); por mes de la fecha prevista
 * (generadas) y por mes de la FECHA ODT CERRADA (cerradas), sin huecos; rango de fechas previstas y avisos.
 * @param {object[]} odts  deduplicadas
 */
export function agregar(odts) {
  const totales = contadores();
  const grupos = { empresa: new Map(), tipo: new Map(), zona: new Map() };
  const meses = new Map();
  const mes = (m) => { let x = meses.get(m); if (!x) { x = { mes: m, generadas: 0, cerradas: 0 }; meses.set(m, x); } return x; };
  let desde = ''; let hasta = '';
  let sinPrevista = 0; let cerradasSinFecha = 0; let antesDelPeriodo = 0;
  const otros = new Map();
  for (const o of odts || []) {
    sumar(totales, o);
    for (const g of ['empresa', 'tipo', 'zona']) {
      const k = o[g] || SIN[g];
      let c = grupos[g].get(k);
      if (!c) { c = contadores(); grupos[g].set(k, c); }
      sumar(c, o);
    }
    if (esIso(o.prevista)) {
      if (!desde || o.prevista < desde) desde = o.prevista;
      if (!hasta || o.prevista > hasta) hasta = o.prevista;
      if (o.prevista < PERIODO_DESDE) antesDelPeriodo++;
      mes(o.prevista.slice(0, 7)).generadas++;
    } else sinPrevista++;
    const k = claveEstado(o.estado);
    if (k === 'cerrada') { if (esIso(o.cerrada)) mes(o.cerrada.slice(0, 7)).cerradas++; else cerradasSinFecha++; }
    if (k === 'otro') { const e = o.estado || '(sin estado)'; otros.set(e, (otros.get(e) || 0) + 1); }
  }
  const lista = (m) => [...m.entries()].map(([clave, c]) => ({ clave, ...c }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave, 'es'));
  return {
    totales,
    porEmpresa: lista(grupos.empresa),
    porTipo: lista(grupos.tipo),
    porZona: lista(grupos.zona),
    porMes: rellenarMeses([...meses.values()]),
    rango: { desde, hasta },
    avisos: { sinPrevista, cerradasSinFecha, antesDelPeriodo, otrosEstados: [...otros.entries()].map(([estado, n]) => ({ estado, n })) }
  };
}

/**
 * Todo lo del responsable elegido: filas, ODT deduplicadas, agregados y avisos.
 * @param {object} lectura  lo que devolvió leerCsv / leerCsvPorPasos
 * @param {string} nombre   el responsable (se compara normalizado)
 */
export function analizarResponsable(lectura, nombre) {
  const entrada = buscarResponsable(lectura, nombre);
  const filas = entrada ? filtrarPorResponsable(lectura.registros, entrada.clave) : [];
  const { odts, conflictos, repetidas, previstasDistintas } = deduplicar(filas);
  const ag = agregar(odts);
  const fechasIlegibles = filas.filter((r) => r.previstaCruda && !r.prevista).length;
  return {
    responsable: entrada ? entrada.nombre : limpiar(nombre),
    clave: entrada ? entrada.clave : normalizarNombre(nombre),
    encontrado: !!entrada,
    filasResponsable: filas.length,
    repetidas,
    previstasDistintas,
    odts,
    conflictos,
    fechasIlegibles,
    // ODT sin AZT en sitio / sin jefe de trabajo (en los filtros salen como «(sin dato)»).
    sinAzt: odts.filter((o) => !o.azt).length,
    sinJefe: odts.filter((o) => !o.jefe).length,
    ...ag
  };
}

/** Avisos en llano para la vista previa (vacío si todo está bien). */
export function avisosDeLectura(lectura, analisis) {
  const out = [];
  if (!lectura) return out;
  // Sin las columnas del AZT o del jefe de trabajo (no son de las mínimas): el corte se guarda igual, sin ellas.
  if (lectura.ok && lectura.traeAzt === false) out.push(MSG_SIN_COLUMNA_AZT);
  if (lectura.ok && lectura.traeJefe === false) out.push(MSG_SIN_COLUMNA_JEFE);
  if (lectura.distintosAfinia && lectura.ok) out.push('Los encabezados no son exactamente los 48 del informe de Afinia (' + lectura.columnas + ' columnas): se leyeron por su nombre. Revise que sea el «Informe Seguimiento de Órdenes de Trabajo».');
  const raras = lectura.raras || [];
  const por = (t) => raras.filter((r) => r.tipo === t);
  const lineas = (xs) => primeros(xs, 8, (r) => r.linea + (r.nro ? ' (ODT ' + r.nro + ')' : ''));
  if (por('unida').length) out.push(frase(por('unida').length + ' fila(s) venían partidas en varias líneas (un salto de línea dentro de un texto) y se unieron: líneas ' + lineas(por('unida'))));
  if (por('de más').length) out.push(frase(por('de más').length + ' fila(s) traen una «|» de más dentro de un texto: se leyeron con cuidado para no correr las columnas. Líneas ' + lineas(por('de más'))));
  const dudosas = raras.filter((r) => r.dudosa);
  if (dudosas.length) {
    out.push(frase(dudosas.length + ' fila(s) no se pudieron leer con certeza; revíselas en Afinia: ' + primeros(dudosas, 6, (r) => 'ODT ' + (r.nro || '(sin N.º)') + ' (línea ' + r.linea + '; se tomó como de ' + (r.responsable || 'nadie') + ')')));
  }
  if (por('de menos').length) out.push(frase(por('de menos').length + ' fila(s) vienen incompletas (con columnas de menos): lo que falta se toma vacío. Líneas ' + lineas(por('de menos'))));
  const incompletas = raras.filter((r) => r.incompleta && r.nro);
  if (incompletas.length) out.push(frase('De ellas, ' + incompletas.length + ' quedaron sin responsable o sin estado y no entran en el corte de nadie: ' + primeros(incompletas, 6, (r) => 'ODT ' + r.nro + ' (línea ' + r.linea + ')')));
  if (lectura.sinNro.length) out.push(frase(lectura.sinNro.length + ' fila(s) sin N.º de ODT no se cuentan: líneas ' + primeros(lectura.sinNro, 8)));
  const compartidos = lectura.compartidos || [];
  if (compartidos.length) {
    out.push(frase(compartidos.length + ' N.º de ODT aparecen con dos o más responsables distintos: cuentan una vez en el total del archivo y una vez en cada responsable (por eso la suma de la tabla de responsables puede pasar del total de ODT del archivo)'));
    const mios = analisis ? compartidos.filter((x) => x.claves.includes(analisis.clave)) : [];
    if (mios.length) out.push(frase(mios.length + ' de ellos son de este responsable: ' + primeros(mios, 6, (x) => x.nro) + '. Su estado en SGM se busca por N.º y podría ser el de la ODT del otro responsable'));
  }
  if (!analisis) return out;
  const est = analisis.conflictos.filter((c) => c.campo === 'estado');
  if (est.length) out.push(frase(est.length + ' ODT vienen con estados distintos en sus filas; se tomó el de la primera: ' + primeros(est, 6, (c) => c.nro + ' (' + (c.primero || 'vacío') + ' / ' + (c.otro || 'vacío') + ')')));
  const emp = analisis.conflictos.filter((c) => c.campo === 'empresa');
  if (emp.length) out.push(frase(emp.length + ' ODT vienen con contratistas distintos en sus filas; se tomó el de la primera: ' + primeros(emp, 6, (c) => c.nro)));
  const azt = analisis.conflictos.filter((c) => c.campo === 'azt');
  if (azt.length) out.push(frase(azt.length + ' ODT vienen con AZT en sitio distintos en sus filas; se tomó el de la primera: ' + primeros(azt, 6, (c) => c.nro)));
  const jefe = analisis.conflictos.filter((c) => c.campo === 'jefe');
  if (jefe.length) out.push(frase(jefe.length + ' ODT vienen con jefes de trabajo distintos en sus filas; se tomó el de la primera: ' + primeros(jefe, 6, (c) => c.nro)));
  if (lectura.traeAzt !== false && analisis.sinAzt) out.push(analisis.sinAzt + ' ODT no traen AZT en sitio: en su filtro salen como «' + SIN_DATO + '».');
  if (lectura.traeJefe !== false && analisis.sinJefe) out.push(analisis.sinJefe + ' ODT no traen jefe de trabajo (ni en sitio ni asignado): en su filtro salen como «' + SIN_DATO + '».');
  if (analisis.previstasDistintas) out.push(analisis.previstasDistintas + ' ODT traen fechas previstas distintas en sus filas: se tomó la más temprana.');
  const a = analisis.avisos || {};
  if (a.antesDelPeriodo) out.push(a.antesDelPeriodo + ' ODT tienen fecha prevista anterior al 01/01/2026 (el periodo acordado empieza ese día): revise el rango de fechas de la descarga.');
  if (a.sinPrevista) out.push(a.sinPrevista + ' ODT no traen una fecha prevista legible: no entran en la evolución mensual.');
  if (a.cerradasSinFecha) out.push(a.cerradasSinFecha + ' ODT CERRADAS no traen FECHA ODT CERRADA: no entran en las cerradas por mes.');
  if (a.otrosEstados && a.otrosEstados.length) out.push('Estados que esta página no conoce (van a «Otro estado»): ' + a.otrosEstados.map((x) => x.estado + ' (' + x.n + ')').join(', ') + '.');
  return out;
}

// ── Filtros, selección y orden (sobre las ODT del corte) ───────────────────────
/** El AZT o el jefe de una ODT como lo agrupan los filtros: con espacios simples; «(sin dato)» si no trae. */
export const personaDe = (o, campo) => limpiar(o && o[campo]) || SIN_DATO;
/**
 * Las ODT que cumplen los filtros ('' o ausente = todos). Se combinan: tipo de trabajo, zona, contratista, AZT en
 * sitio y jefe de trabajo.
 */
export function filtrar(odts, { tipo = '', zona = '', empresa = '', azt = '', jefe = '' } = {}) {
  return (odts || []).filter((o) => (!tipo || (o.tipo || SIN.tipo) === tipo)
    && (!zona || (o.zona || SIN.zona) === zona) && (!empresa || (o.empresa || SIN.empresa) === empresa)
    && (!azt || personaDe(o, 'azt') === azt) && (!jefe || personaDe(o, 'jefe') === jefe));
}
/**
 * Las personas de un campo ('azt' o 'jefe') con cuántas ODT tiene cada una: [{valor, n}], por nombre y con
 * «(sin dato)» al final (solo si alguna ODT no lo trae).
 */
export function opcionesConConteo(odts, campo) {
  const m = new Map();
  for (const o of odts || []) { const k = personaDe(o, campo); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => (a.valor === SIN_DATO) - (b.valor === SIN_DATO) || a.valor.localeCompare(b.valor, 'es'));
}
/**
 * Valores distintos para los filtros (ordenados): tipos, zonas y contratistas (textos) y, con su conteo, los AZT en
 * sitio y los jefes de trabajo ([{valor, n}]).
 */
export function opcionesFiltro(odts) {
  const s = { tipos: new Set(), zonas: new Set(), empresas: new Set() };
  for (const o of odts || []) { s.tipos.add(o.tipo || SIN.tipo); s.zonas.add(o.zona || SIN.zona); s.empresas.add(o.empresa || SIN.empresa); }
  const ord = (x) => [...x].sort((a, b) => a.localeCompare(b, 'es'));
  return { tipos: ord(s.tipos), zonas: ord(s.zonas), empresas: ord(s.empresas), azts: opcionesConConteo(odts, 'azt'), jefes: opcionesConConteo(odts, 'jefe') };
}
/** ¿El corte guardó el AZT y el jefe de cada ODT? (versión 2 en adelante; los de la versión 1 no los traen) */
export const corteTraeAztJefe = (c) => Number(c && c.version) >= 2;
/** ¿La ODT cuenta en el indicador `clave`? */
export function cuentaEn(o, clave) {
  if (clave === 'total' || clave === 'pctCierre') return true;
  const k = claveEstado(o.estado);
  if (clave === 'noEjecutadaInactiva') return k === 'noEjecutada' || k === 'inactiva';
  return k === clave;
}
/** Las ODT detrás de un número (contratista, tipo, zona, AZT o jefe opcionales y un indicador), por fecha prevista y N.º. */
export function seleccionar(odts, { empresa = '', tipo = '', zona = '', azt = '', jefe = '', clave = 'total' } = {}) {
  return filtrar(odts, { empresa, tipo, zona, azt, jefe }).filter((o) => cuentaEn(o, clave))
    .sort((a, b) => (a.prevista || '9999').localeCompare(b.prevista || '9999') || a.nro.localeCompare(b.nro));
}
/**
 * Ordena las filas de una tabla por contratista (o tipo, o zona).
 * @param {object[]} filas  [{clave, total, …}]
 * @param {'clave'|'pct'|string} columna  @param {'asc'|'desc'} dir
 */
export function ordenarFilas(filas, columna = 'total', dir = 'desc') {
  const s = dir === 'asc' ? 1 : -1;
  const v = (f) => (columna === 'pct' ? (pctCierre(f) ?? -1) : columna === 'clave' ? f.clave : (f[columna] || 0));
  return [...(filas || [])].sort((a, b) => {
    const x = v(a); const y = v(b);
    const c = typeof x === 'string' ? x.localeCompare(y, 'es') : x - y;
    return c * s || a.clave.localeCompare(b.clave, 'es');
  });
}

// ── Comparación entre dos cortes ───────────────────────────────────────────────
/**
 * Diferencias entre el corte anterior y el actual (sobre sus ODT, con los mismos filtros si se pasan).
 * @param {object[]} odtsAntes  @param {object[]} odtsAhora
 * @returns {{totales:Array<{clave, antes, ahora, delta}>, pct:{antes, ahora}, cuentas:{antes, ahora},
 *            porEmpresa:Array<{clave, antes, ahora, delta}>, cambios:Array<{nro, empresa, subestacion, de, a}>,
 *            nuevas:object[], salieron:object[]}}
 */
export function compararCortes(odtsAntes, odtsAhora) {
  const A = agregar(odtsAntes); const B = agregar(odtsAhora);
  const dif = (a, b) => Object.fromEntries(CLAVES.map((k) => [k, (b[k] || 0) - (a[k] || 0)]));
  const totales = CLAVES.map((k) => ({ clave: k, antes: A.totales[k], ahora: B.totales[k], delta: B.totales[k] - A.totales[k] }));
  const mA = new Map(A.porEmpresa.map((x) => [x.clave, x])); const mB = new Map(B.porEmpresa.map((x) => [x.clave, x]));
  const nombres = [...new Set([...mA.keys(), ...mB.keys()])];
  const porEmpresa = nombres.map((k) => {
    const a = mA.get(k) || contadores(); const b = mB.get(k) || contadores();
    return { clave: k, antes: a, ahora: b, delta: dif(a, b) };
  }).sort((x, y) => (y.ahora.total || 0) - (x.ahora.total || 0) || x.clave.localeCompare(y.clave, 'es'));
  const porNroA = new Map((odtsAntes || []).map((o) => [o.nro, o]));
  const porNroB = new Map((odtsAhora || []).map((o) => [o.nro, o]));
  const cambios = []; const nuevas = []; const salieron = [];
  for (const o of odtsAhora || []) {
    const p = porNroA.get(o.nro);
    if (!p) nuevas.push(o);
    else if (p.estado !== o.estado) cambios.push({ nro: o.nro, empresa: o.empresa, subestacion: o.subestacion, tipo: o.tipo, de: p.estado, a: o.estado });
  }
  for (const o of odtsAntes || []) if (!porNroB.has(o.nro)) salieron.push(o);
  const porNro = (a, b) => a.nro.localeCompare(b.nro);
  return {
    totales, pct: { antes: pctCierre(A.totales), ahora: pctCierre(B.totales) }, cuentas: { antes: A.totales, ahora: B.totales },
    porEmpresa, cambios: cambios.sort(porNro), nuevas: nuevas.sort(porNro), salieron: salieron.sort(porNro)
  };
}
/** «+3», «−2» o «0» (signo menos tipográfico). */
export function textoDelta(d) {
  if (!Number.isFinite(d) || d === 0) return '0';
  return (d > 0 ? '+' : '−') + Math.abs(d).toLocaleString('es-CO');
}

/** La clave de orden de un corte: la fecha de sus datos y, a igualdad, cuándo se guardó. */
function claveCorte(c) { return [fechaDatosDeCorte(c), Number(c && c.creadoEnMs) || 0]; }
const antesQue = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
/**
 * De unos cortes, el ANTERIOR a `corte` del mismo responsable: el de datos más recientes que sean anteriores a los
 * suyos (a igualdad de datos, el guardado antes); null si no hay.
 * @param {object[]} cortes  [{id, responsable, fechaDatos?, archivo?, rango?, creadoEnMs}]
 */
export function corteAnterior(cortes, corte) {
  if (!corte) return null;
  const c = normalizarNombre(corte.responsable);
  const k = claveCorte(corte);
  let mejor = null; let km = null;
  for (const x of cortes || []) {
    if (!x || x.id === corte.id || normalizarNombre(x.responsable) !== c) continue;
    const kx = claveCorte(x);
    if (!antesQue(kx, k)) continue;
    if (!mejor || antesQue(km, kx)) { mejor = x; km = kx; }
  }
  return mejor;
}
/** De unos cortes, el de datos más recientes del responsable `nombre` (comparado normalizado); null si no hay. */
export function corteMasReciente(cortes, nombre) {
  const c = normalizarNombre(nombre);
  let mejor = null; let km = null;
  for (const x of cortes || []) {
    if (!x || normalizarNombre(x.responsable) !== c) continue;
    const kx = claveCorte(x);
    if (!mejor || antesQue(km, kx)) { mejor = x; km = kx; }
  }
  return mejor;
}
/**
 * El nombre como lo escribe Afinia en el CSV: MAYÚSCULAS sin tildes, pero con la Ñ y la Ü (son letras, no tildes).
 * «Persona Muñoz Pérez» → «PERSONA MUÑOZ PEREZ».
 */
export function nombreComoAfinia(nombre) {
  return texto(nombre).normalize('NFD').replace(/([nNuU])([\u0303\u0308])|[\u0300-\u036f]/g, (m, letra, marca) => (letra ? letra + marca : ''))
    .normalize('NFC').toUpperCase().replace(/\s+/g, ' ').trim();
}
/**
 * Cómo puede estar GUARDADO el responsable `nombre` en un corte (el corte lo guarda tal cual viene en el CSV; la
 * consulta al servidor compara exacto): lo que ya muestran los cortes conocidos de ese nombre (comparado
 * normalizado), el nombre como lo escribe Afinia (con Ñ) y el normalizado (sin Ñ). Sin repetidos, como mucho `max`.
 */
export function formasGuardadas(nombre, cortes = [], max = 4) {
  const c = normalizarNombre(nombre);
  if (!c) return [];
  const xs = (cortes || []).filter((x) => x && normalizarNombre(x.responsable) === c).map((x) => limpiar(x.responsable));
  return [...new Set([...xs, nombreComoAfinia(nombre), c].filter(Boolean))].slice(0, max);
}

// ── Estado de cada ODT en SGM (solo lectura de lo que el módulo ya tiene) ──────
export const ETIQUETA_SGM = Object.freeze({
  cerrada: 'Cerrada en SGM', lista: 'Lista', firma: 'Publicada en firma', subsanar: 'Por subsanar'
});
/** Lo que dice la celda cuando el N.º se consultó y SGM no lo tiene, o cuando todavía no se consultó. */
export const SGM_NO_ESTA = 'No está en SGM';
export const SGM_SIN_CONSULTAR = 'Sin consultar';
const RANGO_SGM = Object.freeze({ subsanar: 1, firma: 2, lista: 3, cerrada: 4 });
/**
 * N.º → {clave, etiqueta}, con lo que SGM ya tiene: las ODT publicadas en «Firma de ODT Afinia» (vigentes:
 * PENDIENTE_* = «Publicada en firma», LISTA, CERRADA; las ANULADAS y REEMPLAZADAS no cuentan) y las ODT
 * «Por subsanar» ABIERTAS. Si un N.º tiene varias, gana la más avanzada (Cerrada > Lista > Publicada > Por subsanar).
 */
export function mapaEstadoSgm({ odts = [], obs = [] } = {}) {
  const m = new Map();
  const poner = (nro, clave) => {
    const n = limpiar(nro);
    if (!n) return;
    const previo = m.get(n);
    if (!previo || RANGO_SGM[clave] > RANGO_SGM[previo.clave]) m.set(n, { clave, etiqueta: ETIQUETA_SGM[clave] });
  };
  for (const o of obs || []) if (o && o.estado === 'ABIERTA') poner(o.nro, 'subsanar');
  for (const o of odts || []) {
    if (!o) continue;
    if (o.estado === 'CERRADA') poner(o.nro, 'cerrada');
    else if (o.estado === 'LISTA') poner(o.nro, 'lista');
    else if (o.estado === 'PENDIENTE_AZT' || o.estado === 'PENDIENTE_RESPONSABLE') poner(o.nro, 'firma');
  }
  return m;
}
