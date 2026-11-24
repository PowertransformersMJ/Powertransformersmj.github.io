// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · POR SUBSANAR · las filas del EXCEL (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): «descargar un documento excel donde esté el detalle de cada ODT de lo que se
// necesita corregir para que esté conforme, sea control previo o registro fotográfico». Antes se quejó de un Excel
// que «toca organizar las columnas para poder filtrar»: este abre LISTO para filtrar (encabezado en la fila 1, sin
// filas de título encima, y el filtro en todo el rango; eso lo pone ui/odt-afinia/subsanar-excel.js).
//
// Dos hojas (aquí solo los DATOS: títulos, anchos, formatos y filas; nada de SheetJS):
//   · «Detalle»: una fila por punto. N.º ODT · Subestación · Equipo · Fecha prevista · AZT asignado · Estado de la ODT ·
//     N.º del punto · Documento · Control previo · Registro fotográfico · ODT · A quién le toca · Estado del punto ·
//     Nota del AZT y fecha · Registrado el · Qué hay que corregir (al final: el texto largo se ve completo hacia la derecha). Las tres columnas «Sí»/vacía (control previo, registro
//     fotográfico, ODT) son para filtrar con un clic «todo lo del control previo» o «todo lo del registro fotográfico».
//   · «Resumen»: una fila por ODT, con sus conteos.
// El documento de cada punto lo decide clasificarPunto (domain/odt_afinia_obs_documento.js) por su texto.
// Las fechas van como FECHAS de Excel (número + formato dd/mm/aaaa), en la hora de Colombia: así se ordenan y se
// filtran como fechas. Una celda vacía va como null (sin celda): el filtro la muestra como «(Vacías)».
// Por defecto se exportan las ODT ABIERTAS; con «Incluir las ya resueltas», también las RESUELTAS.
// Orden: las abiertas primero, luego por N.º; dentro de cada ODT, los puntos en su orden (1, 2, 3…).
// Sin Firebase, sin DOM. Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { ESTADOS_OBS, ESTADOS_PUNTO, ETIQUETA_OBS, ETIQUETA_QUIEN, rastroOrdenado } from './odt_afinia_obs.js';
import { ZONA_HORARIA, esFechaDMA, fechaBogota } from './odt_afinia_textos.js';
import { clasificarPunto, CATEGORIAS } from './odt_afinia_obs_documento.js';

export const NOMBRE_HOJA = Object.freeze({ detalle: 'Detalle', resumen: 'Resumen' });
/** Formatos de número de Excel (el código del archivo; Excel lo muestra según su idioma). */
export const FORMATO_FECHA = 'dd/mm/yyyy';
export const FORMATO_FECHA_HORA = 'dd/mm/yyyy hh:mm';
export const SI = 'Sí';
/** El estado del punto como lo pidió el Ingeniero para el Excel. */
export const ETIQUETA_ESTADO_PUNTO = Object.freeze({
  PENDIENTE: 'Pendiente',
  SUBSANADO: 'Subsanado (falta verificar)',
  VERIFICADO: 'Verificado'
});

/** Columnas de «Detalle», en orden: título, ancho (en caracteres) y, si es fecha, su formato. */
export const COLUMNAS_DETALLE = Object.freeze([
  { titulo: 'N.º ODT', ancho: 12 },
  { titulo: 'Subestación', ancho: 24 },
  { titulo: 'Equipo', ancho: 26 },
  { titulo: 'Fecha prevista', ancho: 16, formato: FORMATO_FECHA },
  { titulo: 'AZT asignado', ancho: 26 },
  { titulo: 'Estado de la ODT', ancho: 18 },
  { titulo: 'N.º del punto', ancho: 15 },
  { titulo: 'Documento', ancho: 46 },          // cabe «Control previo + Registro fotográfico + ODT»
  { titulo: 'Control previo', ancho: 16 },
  { titulo: 'Registro fotográfico', ancho: 22 },
  { titulo: 'ODT', ancho: 8 },
  { titulo: 'A quién le toca', ancho: 17 },
  { titulo: 'Estado del punto', ancho: 28 },
  { titulo: 'Nota del AZT y fecha', ancho: 60 },
  { titulo: 'Registrado el', ancho: 18, formato: FORMATO_FECHA_HORA },
  // El texto va AL FINAL: SheetJS gratuito no escribe «Ajustar texto», y en la última columna el texto largo se ve
  // completo hacia la derecha (no lo tapa ninguna celda vecina con dato).
  { titulo: 'Qué hay que corregir', ancho: 90 }
].map(Object.freeze));

/** Columnas de «Resumen», en orden. */
export const COLUMNAS_RESUMEN = Object.freeze([
  { titulo: 'N.º ODT', ancho: 12 },
  { titulo: 'Subestación', ancho: 24 },
  { titulo: 'Equipo', ancho: 26 },
  { titulo: 'Fecha prevista', ancho: 16, formato: FORMATO_FECHA },
  { titulo: 'AZT asignado', ancho: 26 },
  { titulo: 'Estado de la ODT', ancho: 18 },
  { titulo: 'Puntos totales', ancho: 16 },
  { titulo: 'Pendientes', ancho: 13 },
  { titulo: 'Subsanados por verificar', ancho: 26 },
  { titulo: 'Verificados', ancho: 13 },
  { titulo: 'Puntos de control previo', ancho: 26 },
  { titulo: 'Puntos de registro fotográfico', ancho: 32 },
  { titulo: 'Puntos de ODT', ancho: 15 },
  { titulo: 'Aclaraciones del AZT', ancho: 22 }
].map(Object.freeze));

// ── Fechas → número de serie de Excel (días desde el 30/12/1899), en la hora de Colombia ──
const DIA_MS = 24 * 60 * 60 * 1000;
const BASE_EXCEL = Date.UTC(1899, 11, 30);
const serial = (a, m, d, hh = 0, mi = 0) => (Date.UTC(a, m - 1, d, hh, mi) - BASE_EXCEL) / DIA_MS;
const FMT_FH = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

/** 'dd/mm/aaaa' → número de serie de Excel (esa fecha a las 00:00), o null si no es una fecha real. */
export function serialDeFechaDMA(f) {
  if (!esFechaDMA(f)) return null;
  const [d, m, a] = f.split('/').map(Number);
  return serial(a, m, d);
}

/** Milisegundos → {a, m, d, hh, mi} en la hora de Colombia, o null. */
function partesBogota(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const p = Object.fromEntries(FMT_FH.formatToParts(new Date(ms)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return { a: p.year, m: p.month, d: p.day, hh: p.hour % 24, mi: p.minute };
}

/** Milisegundos → número de serie de Excel con la hora de Colombia (al minuto), o null. */
export function serialDeMs(ms) {
  const p = partesBogota(ms);
  return p ? serial(p.a, p.m, p.d, p.hh, p.mi) : null;
}

const dos = (n) => String(n).padStart(2, '0');
/** Milisegundos → 'dd/mm/aaaa hh:mm' en la hora de Colombia, o '' si no hay. */
export function textoFechaHora(ms) {
  const p = partesBogota(ms);
  return p ? dos(p.d) + '/' + dos(p.m) + '/' + p.a + ' ' + dos(p.hh) + ':' + dos(p.mi) : '';
}

/** Nombre del archivo: ODT_por_subsanar_AAAA-MM-DD.xlsx (fecha de Colombia). */
export function nombreArchivoExcel(ahora = new Date()) {
  const [d, m, a] = fechaBogota(ahora).split('/');
  return 'ODT_por_subsanar_' + a + '-' + m + '-' + d + '.xlsx';
}

// ── Lectura de una obs y sus puntos ────────────────────────────────────────────
const texto = (v) => (typeof v === 'string' ? v : '');
const oNulo = (v) => (v === '' || v == null ? null : v);
const numeroDe = (p, i) => (/^\d+$/.test(String(p && p.id)) ? Number(p.id) + 1 : i + 1);
const ordenDe = (p) => (Number.isFinite(p && p.orden) ? p.orden : Number(p && p.id));

/**
 * La nota con que el AZT marcó el punto «subsanado» (la última) y su fecha: «Se cambió la foto (15/11/2026 10:30)».
 * Si lo último que pasó fue una DEVOLUCIÓN del administrador, se agrega: «· Devuelto el 16/11/2026 08:00: <motivo>».
 * null si el punto nunca se marcó subsanado.
 */
export function notaDelAzt(punto) {
  const rastro = rastroOrdenado(punto);
  const sub = [...rastro].reverse().find((e) => e.a === ESTADOS_PUNTO.SUBSANADO);
  if (!sub) return null;
  const partes = [];
  const f = textoFechaHora(sub.enMs);
  partes.push(texto(sub.nota) + (f ? ' (' + f + ')' : ''));
  const ultima = rastro[rastro.length - 1];
  if (ultima && ultima !== sub && ultima.de === ESTADOS_PUNTO.SUBSANADO && ultima.a === ESTADOS_PUNTO.PENDIENTE) {
    const fd = textoFechaHora(ultima.enMs);
    partes.push('Devuelto' + (fd ? ' el ' + fd : '') + (texto(ultima.nota) ? ': ' + ultima.nota : ''));
  }
  return partes.join(' · ').trim() || null;
}

/** Abiertas primero, luego por N.º (como texto: todos tienen 8 dígitos). */
function comparaObs(a, b) {
  const pa = a.estado === ESTADOS_OBS.ABIERTA ? 0 : 1;
  const pb = b.estado === ESTADOS_OBS.ABIERTA ? 0 : 1;
  return (pa - pb) || texto(a.nro).localeCompare(texto(b.nro)) || texto(a.id).localeCompare(texto(b.id));
}
/** ¿La obs entra en el Excel? Las ABIERTAS siempre; las RESUELTAS solo si se piden. */
const entra = (obs, incluirResueltas) => !!obs && (obs.estado === ESTADOS_OBS.ABIERTA || (incluirResueltas === true && obs.estado === ESTADOS_OBS.RESUELTA));

/**
 * De la lista de «Por subsanar», las obs que van al Excel, en su orden (para leer sus puntos del servidor).
 * @param {Array<object>} lista   lo que devolvió repoObs.listar().lista
 * @param {{incluirResueltas?:boolean}} [op]
 */
export function obsParaExportar(lista, { incluirResueltas = false } = {}) {
  return (lista || []).filter((o) => entra(o, incluirResueltas)).sort(comparaObs);
}

/** Lo que se repite en las dos hojas: N.º · Subestación · Equipo · Fecha prevista · AZT · Estado de la ODT. */
function datosObs(obs) {
  const f = texto(obs.fechaPrevista);
  return [
    texto(obs.nro),
    oNulo(texto(obs.subestacion)),
    oNulo(texto(obs.equipo)),
    serialDeFechaDMA(f) ?? oNulo(f),
    oNulo(texto(obs.azt && obs.azt.nombre)),
    ETIQUETA_OBS[obs.estado] || oNulo(texto(obs.estado))
  ];
}

/** Los puntos de la obs en su orden, cada uno con su número y su clasificación. */
function puntosClasificados(puntos) {
  return [...(puntos || [])]
    .sort((a, b) => ordenDe(a) - ordenDe(b))
    .map((p, i) => ({ p, n: numeroDe(p, i), c: clasificarPunto({ texto: p.texto, quien: p.quien }) }));
}

/** Filas de «Detalle» (sin el encabezado): una por punto. */
export function filasDetalle(registros) {
  const filas = [];
  for (const { obs, puntos } of registros || []) {
    const base = datosObs(obs);
    for (const { p, n, c } of puntosClasificados(puntos)) {
      const tiene = (d) => (c.documentos.includes(d) ? SI : null);
      filas.push([
        ...base,
        n,
        c.etiqueta,
        tiene('control_previo'),
        tiene('registro_fotografico'),
        tiene('odt'),
        ETIQUETA_QUIEN[p.quien] || oNulo(texto(p.quien)),
        ETIQUETA_ESTADO_PUNTO[p.estado] || oNulo(texto(p.estado)),
        notaDelAzt(p),
        serialDeMs(Number.isFinite(p.creadoEnMs) ? p.creadoEnMs : obs.creadoEnMs),
        texto(p.texto)
      ]);
    }
  }
  return filas;
}

/** Filas de «Resumen» (sin el encabezado): una por ODT. */
export function filasResumen(registros) {
  return (registros || []).map(({ obs, puntos }) => {
    const lista = puntosClasificados(puntos);
    const cuenta = (fn) => lista.filter(fn).length;
    const conDoc = (d) => cuenta(({ c }) => c.documentos.includes(d));
    return [
      ...datosObs(obs),
      lista.length,
      cuenta(({ p }) => p.estado === ESTADOS_PUNTO.PENDIENTE),
      cuenta(({ p }) => p.estado === ESTADOS_PUNTO.SUBSANADO),
      cuenta(({ p }) => p.estado === ESTADOS_PUNTO.VERIFICADO),
      conDoc('control_previo'),
      conDoc('registro_fotografico'),
      conDoc('odt'),
      cuenta(({ c }) => c.categoria === CATEGORIAS.aclaracion)
    ];
  });
}

/**
 * Las dos hojas del libro, listas para SheetJS: [{nombre, columnas, filas}] con el ENCABEZADO en la primera fila.
 * @param {Array<{obs:object, puntos:Array<object>}>} registros   lo leído del servidor (repoObs.leer de cada obs)
 * @param {{incluirResueltas?:boolean}} [op]
 * @returns {{hojas:Array<{nombre:string, columnas:Array, filas:Array<Array>}>, odts:number, puntos:number}}
 */
export function armarHojas(registros, { incluirResueltas = false } = {}) {
  const elegidos = (registros || []).filter((r) => r && entra(r.obs, incluirResueltas))
    .sort((a, b) => comparaObs(a.obs, b.obs));
  const detalle = filasDetalle(elegidos);
  return {
    hojas: [
      { nombre: NOMBRE_HOJA.detalle, columnas: COLUMNAS_DETALLE, filas: [COLUMNAS_DETALLE.map((c) => c.titulo), ...detalle] },
      { nombre: NOMBRE_HOJA.resumen, columnas: COLUMNAS_RESUMEN, filas: [COLUMNAS_RESUMEN.map((c) => c.titulo), ...filasResumen(elegidos)] }
    ],
    odts: elegidos.length,
    puntos: detalle.length
  };
}
