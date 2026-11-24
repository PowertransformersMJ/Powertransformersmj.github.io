// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · armado del lote de un CORTE (PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Lo que la capa de datos ESCRIBE al guardar un corte, armado sin red. El bloque «Indicadores · ODT Afinia» de
// firestore.rules valida la forma con `size() == N` y la lectura de cada campo: aquí van exactamente esos.
//   · odt_afinia_cortes/{id}  (17 campos): responsable, archivo {nombre, bytes, sha256}, rango {desde, hasta}
//     (fechas previstas mín/máx del subconjunto, 'aaaa-mm-dd'), fechaDatos ('aaaa-mm-ddThh:mm:ss': la hora de
//     descarga del nombre del archivo o, si no la trae, el final del día de rango.hasta; ordena los cortes y
//     elige el anterior), filasArchivo, odtsArchivo, filasResponsable, odts (cuántas), totales {total, generada,
//     ejecutada, noEjecutada, cerrada, inactiva, otro}, porEmpresa / porTipo / porZona [{clave, …contadores}],
//     porMes [{mes, generadas, cerradas}] (sin huecos), nPartes, version (2), creadoPor {uid, nombre}, creadoEn
//     (hora del servidor).
//   · odt_afinia_cortes/{id}/partes/{k}  (2 campos): {k, odts:[{nro, empresa, tipo, zona, subestacion, prevista,
//     cerrada, estado, principal, azt, jefe}]}, en trozos de 400 (la última, el resto): todas llenas menos la última.
//     VERSIÓN 2 (pedido del Ingeniero del 2026-11-24): cada ODT lleva además su AZT en sitio (`azt`) y su jefe de
//     trabajo (`jefe`), textos de 0 a 200 (11 campos). Los cortes de la versión 1 (ODT de 9 campos) ya guardados se
//     siguen leyendo: unirPartes acepta la forma de la versión de cada corte.
// La regla no puede recorrer listas y tiene un tope de 1000 expresiones por documento: de cada lista (porEmpresa,
// porTipo, porZona, porMes y las ODT de cada parte) solo revisa que sea lista, su tamaño máximo y la forma del PRIMER
// elemento (por eso cada lista lleva al menos uno). TODOS los elementos los valida AQUÍ planCorte antes de escribir
// (y, al leer, unirPartes descarta lo que no tenga la forma de una ODT).
// TODO va en UN solo lote (corte + partes): o entra todo o nada. Un corte nunca cambia (update y delete
// prohibidos en la regla): es la trazabilidad.
// La marca de hora del servidor (`serverTimestamp()`) llega INYECTADA (`ts`): las pruebas arman el lote en Node.
// Sin Firebase, sin DOM. Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya
// existían (ErrorOdt, esIdOdt).
// ══════════════════════════════════════════════════════════════════════════════

import { ErrorOdt, esIdOdt } from './odt_afinia_lotes.js';
import { COL_CORTES, TOPES_CORTE, VERSION_CORTE, CLAVES, esIso, esFechaDatos, limpiar, odtDeFila, fechaDatosDe } from '../domain/odt_afinia_indicadores.js';

const exige = (cond, mensaje) => { if (!cond) throw new ErrorOdt('validacion', mensaje); };
const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const RE_HEX = /^[0-9a-f]{64}$/;

/** Las ODT en trozos de `tam` (todas llenas menos la última). */
export function trozos(odts, tam = TOPES_CORTE.porParte) {
  const out = [];
  for (let i = 0; i < (odts || []).length; i += tam) out.push(odts.slice(i, i + tam));
  return out;
}
/** Cuántas partes ocupan `n` ODT. */
export const partesPara = (n) => Math.ceil(n / TOPES_CORTE.porParte);

/** Contadores con EXACTAMENTE las 7 claves (enteros ≥ 0). */
function contadoresParaGuardar(c = {}) {
  return Object.fromEntries(CLAVES.map((k) => [k, Number.isInteger(c[k]) && c[k] >= 0 ? c[k] : 0]));
}
const grupoParaGuardar = (g) => ({ clave: limpiar(g.clave).slice(0, TOPES_CORTE.textoMax), ...contadoresParaGuardar(g) });
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Los campos de una ODT guardada en cada versión del corte (la 2 suma el AZT en sitio y el jefe de trabajo). */
export const CAMPOS_ODT_POR_VERSION = Object.freeze({
  1: Object.freeze(['nro', 'empresa', 'tipo', 'zona', 'subestacion', 'prevista', 'cerrada', 'estado', 'principal']),
  2: Object.freeze(['nro', 'empresa', 'tipo', 'zona', 'subestacion', 'prevista', 'cerrada', 'estado', 'principal', 'azt', 'jefe'])
});
const textoHasta = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;

/**
 * ¿Tiene la forma de una ODT guardada? Los campos de su versión y nada más (versión 1: 9; versión 2: 11, con `azt` y
 * `jefe`), textos acotados, fechas 'aaaa-mm-dd' o vacías y principal sí/no. Sin `version` (1 o 2), vale cualquiera de
 * las dos formas.
 */
export function odtValida(o, version) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const formas = CAMPOS_ODT_POR_VERSION[version] ? [CAMPOS_ODT_POR_VERSION[version]] : Object.values(CAMPOS_ODT_POR_VERSION);
  const campos = formas.find((c) => Object.keys(o).length === c.length && c.every((k) => k in o));
  return !!campos
    && textoHasta(o.nro, 1, TOPES_CORTE.nroMax)
    && campos.filter((k) => !['nro', 'prevista', 'cerrada', 'principal'].includes(k)).every((k) => textoHasta(o[k], 0, TOPES_CORTE.textoMax))
    && (o.prevista === '' || esIso(o.prevista)) && (o.cerrada === '' || esIso(o.cerrada)) && typeof o.principal === 'boolean';
}

/**
 * El documento del corte (17 campos) y sus partes.
 * @param {{id:string, archivo:{nombre:string, bytes:number, sha256:string}, lectura:{filas:number, odtsArchivo:number},
 *          analisis:object, por:{uid:string, nombre:string}, ts:any}} p   analisis: analizarResponsable(…)
 * @returns {{id:string, corte:object, partes:Array<{k:number, odts:object[]}>, operaciones:Array<{ruta:string[], datos:object}>}}
 */
export function planCorte({ id, archivo = {}, lectura = {}, analisis = {}, por = {}, ts } = {}) {
  exige(esIdOdt(id), 'Identificador del corte inválido.');
  exige(por && typeof por.uid === 'string' && por.uid, 'Falta quién guarda el corte.');
  const nombre = limpiar(archivo.nombre);
  exige(nombre.length >= 1 && nombre.length <= TOPES_CORTE.archivoNombreMax, 'El nombre del archivo debe tener de 1 a ' + TOPES_CORTE.archivoNombreMax + ' caracteres.');
  exige(entero(archivo.bytes, 1, TOPES_CORTE.archivoBytesMax), 'El tamaño del archivo no es válido.');
  exige(typeof archivo.sha256 === 'string' && RE_HEX.test(archivo.sha256), 'No se pudo calcular la huella del archivo (lo que identifica este archivo exacto).');
  const responsable = limpiar(analisis.responsable);
  exige(responsable.length >= TOPES_CORTE.responsableMin && responsable.length <= TOPES_CORTE.responsableMax, 'Elija el responsable del corte.');
  const odts = (analisis.odts || []).map(odtDeFila);
  exige(odts.length >= 1, 'El responsable elegido no tiene ODT en el archivo: no hay corte que guardar.');
  exige(odts.every((o) => odtValida(o, VERSION_CORTE)), 'Hay ODT sin N.º o con datos de otra forma: no se puede guardar el corte.');
  exige(odts.length <= TOPES_CORTE.porParte * TOPES_CORTE.partesMax, 'El corte pasa de ' + (TOPES_CORTE.porParte * TOPES_CORTE.partesMax) + ' ODT.');
  exige(new Set(odts.map((o) => o.nro)).size === odts.length, 'Hay N.º de ODT repetidos en el corte.');
  const filasArchivo = lectura.filas; const odtsArchivo = lectura.odtsArchivo; const filasResponsable = analisis.filasResponsable;
  exige(entero(filasArchivo, 1, TOPES_CORTE.filasMax), 'El número de filas del archivo no es válido.');
  exige(entero(odtsArchivo, 1, filasArchivo), 'El número de ODT del archivo no es válido.');
  exige(entero(filasResponsable, odts.length, filasArchivo), 'El número de filas del responsable no es válido.');
  exige(odts.length <= odtsArchivo, 'Hay más ODT en el corte que en el archivo.');
  const totales = contadoresParaGuardar(analisis.totales);
  exige(totales.total === odts.length, 'Los totales no suman las ODT del corte.');
  exige(CLAVES.slice(1).reduce((s, k) => s + totales[k], 0) === totales.total, 'Los estados no suman el total.');
  const rango = { desde: analisis.rango && analisis.rango.desde, hasta: analisis.rango && analisis.rango.hasta };
  exige(esIso(rango.desde) && esIso(rango.hasta) && rango.desde <= rango.hasta, 'Ninguna ODT del responsable trae una fecha prevista legible: no se puede fechar el corte.');
  const fechaDatos = fechaDatosDe(nombre, rango).valor;
  exige(esFechaDatos(fechaDatos), 'No se pudo fechar el corte: el archivo no trae la hora de descarga y no hay fechas previstas.');
  const lista = (xs, max, nombreLista) => {
    const l = Array.isArray(xs) ? xs : [];
    exige(l.length <= max, 'Demasiados ' + nombreLista + ' en el corte (' + l.length + ').');
    return l;
  };
  const porEmpresa = lista(analisis.porEmpresa, TOPES_CORTE.listasMax, 'contratistas').map(grupoParaGuardar);
  const porTipo = lista(analisis.porTipo, TOPES_CORTE.listasMax, 'tipos de trabajo').map(grupoParaGuardar);
  const porZona = lista(analisis.porZona, TOPES_CORTE.listasMax, 'zonas').map(grupoParaGuardar);
  const porMes = lista(analisis.porMes, TOPES_CORTE.mesesMax, 'meses').map((m) => ({
    mes: String(m.mes), generadas: Number.isInteger(m.generadas) ? m.generadas : 0, cerradas: Number.isInteger(m.cerradas) ? m.cerradas : 0
  }));
  // Lo que la regla revisa solo en el PRIMER elemento de cada lista, aquí se revisa en TODOS (y cada lista trae al menos uno).
  exige(porEmpresa.length >= 1 && porTipo.length >= 1 && porZona.length >= 1 && porMes.length >= 1,
    'Al corte le faltan los contratistas, los tipos de trabajo, las zonas o los meses: no se puede guardar.');
  const n = odts.length;
  const contadorOk = (g) => CLAVES.every((k) => g[k] <= n);
  exige([...porEmpresa, ...porTipo, ...porZona].every((g) => g.clave.length >= 1 && contadorOk(g)), 'Un contratista, tipo o zona sin nombre o con más ODT que el corte.');
  exige(porMes.every((m) => RE_MES.test(m.mes) && m.generadas >= 0 && m.generadas <= n && m.cerradas >= 0 && m.cerradas <= n), 'Un mes con otra forma o con más ODT que el corte.');
  const partes = trozos(odts).map((x, k) => ({ k, odts: x }));
  const corte = {
    responsable,
    archivo: { nombre, bytes: archivo.bytes, sha256: archivo.sha256 },
    rango,
    fechaDatos,
    filasArchivo,
    odtsArchivo,
    filasResponsable,
    odts: odts.length,
    totales,
    porEmpresa,
    porTipo,
    porZona,
    porMes,
    nPartes: partes.length,
    version: VERSION_CORTE,
    creadoPor: { uid: por.uid, nombre: typeof por.nombre === 'string' ? por.nombre : '' },
    creadoEn: ts
  };
  const operaciones = [
    { ruta: [COL_CORTES.cortes, id], datos: corte },
    ...partes.map((p) => ({ ruta: [COL_CORTES.cortes, id, COL_CORTES.partes, String(p.k)], datos: { k: p.k, odts: p.odts } }))
  ];
  return { id, corte, partes, operaciones };
}

/**
 * Las ODT de un corte desde sus partes leídas, y si el corte está COMPLETO (todas las partes 0..nPartes-1, tantas
 * ODT como dice el corte y todas con la forma de una ODT de SU versión —9 campos en la 1, 11 en la 2—: las que no la
 * tienen se DESCARTAN, para que un corte mal formado no rompa la pestaña).
 * @param {object} corte  @param {Array<{id:string, data:object}>} partesLeidas
 * @returns {{odts:object[], completo:boolean, faltan:number[], descartadas:number}}
 */
export function unirPartes(corte, partesLeidas) {
  const n = corte && Number.isInteger(corte.nPartes) ? corte.nPartes : 0;
  const version = corte ? corte.version : undefined;
  const porK = new Map();
  for (const p of partesLeidas || []) {
    const k = Number(p.id);
    if (Number.isInteger(k) && k >= 0 && k < n && p.data && Array.isArray(p.data.odts)) porK.set(k, p.data.odts);
  }
  const faltan = [];
  const odts = [];
  let descartadas = 0;
  for (let k = 0; k < n; k++) {
    const x = porK.get(k);
    if (!x) { faltan.push(k); continue; }
    for (const o of x) { if (odtValida(o, version)) odts.push(o); else descartadas++; }
  }
  const completo = n >= 1 && !faltan.length && !descartadas && odts.length === corte.odts;
  return { odts, completo, faltan, descartadas };
}
