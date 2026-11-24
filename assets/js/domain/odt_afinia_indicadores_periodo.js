// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · el PERIODO (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): «necesito que también exista un calendario para yo poder escoger a mi voluntad
// periodos a lo largo del año 2026».
// Decisión: el periodo filtra por la FECHA PREVISTA DE INICIO de cada ODT (`prevista`, 'aaaa-mm-dd'), que ya guardan
// los cortes de las versiones 1 y 2: es la misma fecha con la que Afinia arma el informe. No cambia la forma guardada,
// ni las reglas, ni los índices: es solo dominio y pantalla.
//   · «Desde» y «Hasta» INCLUIDOS (una ODT prevista el mismo día de un extremo entra). Uno vacío deja ese lado abierto;
//     los dos vacíos = sin periodo (todo, como antes).
//   · Solo fechas de 2026 (del 01/01/2026 al 31/12/2026). Si «Desde» va después de «Hasta», si una fecha cae fuera de
//     2026 o si no se entiende (incompleta, o un día que no existe), el periodo NO se aplica y se dice por qué.
//   · Con un periodo puesto, una ODT sin fecha prevista queda FUERA (se cuenta, para decirlo en el resumen); sin
//     periodo, cuenta como siempre.
//   · Periodos rápidos: todo 2026, cada mes, cada trimestre, cada semestre y, si caen en 2026, «Este mes» y «Mes pasado».
//   · La evolución mensual con un periodo muestra solo sus meses (los vacíos en 0). Una ODT del periodo cerrada en un mes
//     fuera de él (p. ej. prevista el 28/10 y cerrada el 03/11, con el periodo de octubre) cuenta en «Cerradas» pero no
//     tiene columna en el gráfico: se cuentan aparte (cerradasFuera) para decirlo.
// Sin Firebase, sin DOM, sin red. Archivo NUEVO a propósito (L-102): todo lo que exporta es nuevo; al dominio de antes
// (odt_afinia_indicadores.js) solo le pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { esIso, fechaDMA, filtrar } from './odt_afinia_indicadores.js';

/** El año que se puede escoger (decisión del Ingeniero: «periodos a lo largo del año 2026»). */
export const PERIODO_ANIO = 2026;
export const PERIODO_MIN = PERIODO_ANIO + '-01-01';
export const PERIODO_MAX = PERIODO_ANIO + '-12-31';
/** Sin periodo: todas las fechas. */
export const SIN_PERIODO = Object.freeze({ desde: '', hasta: '', activo: false, error: '' });

const MESES_TITULO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_LARGO = MESES_TITULO.map((m) => m.toLowerCase());
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n) => String(n).padStart(2, '0');
const esBisiesto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
/** Los días del mes (1..12) de ese año: febrero con 28 o 29. */
export function diasDelMes(anio, mes) {
  return [31, esBisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1] || 0;
}
/** El primer y el último día del mes 'aaaa-mm' → {desde, hasta}. */
export function periodoDeMes(mes) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(mes || ''));
  if (!m) return { desde: '', hasta: '' };
  const a = Number(m[1]); const n = Number(m[2]);
  return { desde: m[1] + '-' + m[2] + '-01', hasta: m[1] + '-' + m[2] + '-' + dos(diasDelMes(a, n)) };
}
/** Del mes `ini` al mes `fin` (1..12) del año → {desde, hasta}. */
function tramo(anio, ini, fin) {
  return { desde: anio + '-' + dos(ini) + '-01', hasta: anio + '-' + dos(fin) + '-' + dos(diasDelMes(anio, fin)) };
}
const mesSiguiente = (m) => {
  const a = Number(m.slice(0, 4)); const n = Number(m.slice(5, 7));
  return n === 12 ? (a + 1) + '-01' : a + '-' + dos(n + 1);
};
const mesAnterior = (m) => {
  const a = Number(m.slice(0, 4)); const n = Number(m.slice(5, 7));
  return n === 1 ? (a - 1) + '-12' : a + '-' + dos(n - 1);
};

// ── Leer y validar lo que se escribió en «Desde» y «Hasta» ───────────────────
/**
 * Una fecha del campo → 'aaaa-mm-dd'; '' si está vacía; null si no se entiende. Acepta 'aaaa-mm-dd' (lo que entrega
 * el calendario del navegador) y 'dd/mm/aaaa' (escrita a mano en un navegador sin calendario). El día debe existir.
 */
export function leerFecha(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  let a; let m; let d;
  let x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (x) { a = Number(x[1]); m = Number(x[2]); d = Number(x[3]); } else {
    x = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (!x) return null;
    a = Number(x[3]); m = Number(x[2]); d = Number(x[1]);
  }
  if (m < 1 || m > 12 || d < 1 || d > diasDelMes(a, m)) return null;
  return String(a).padStart(4, '0') + '-' + dos(m) + '-' + dos(d);
}

const NOMBRE_CAMPO = Object.freeze({ desde: '«Desde»', hasta: '«Hasta»' });
/** Lo que se dice cuando el periodo no se aplica (una línea clara, junto a las fechas). */
export const ERRORES_PERIODO = Object.freeze({
  ilegible: (campo) => 'La fecha ' + NOMBRE_CAMPO[campo] + ' está incompleta o no existe: escríbala completa (día, mes y año) o elíjala en el calendario. El periodo no se aplica.',
  fuera: (campo, iso) => 'La fecha ' + NOMBRE_CAMPO[campo] + ' (' + fechaDMA(iso) + ') está fuera de ' + PERIODO_ANIO + ': elija una entre el ' + fechaDMA(PERIODO_MIN) + ' y el ' + fechaDMA(PERIODO_MAX) + '. El periodo no se aplica.',
  invertido: (desde, hasta) => '«Desde» (' + fechaDMA(desde) + ') es posterior a «Hasta» (' + fechaDMA(hasta) + '): el periodo no se aplica. Corrija una de las dos fechas.'
});
const noAplica = (error) => ({ desde: '', hasta: '', activo: false, error });

/**
 * El periodo que se aplica, desde lo escrito en «Desde» y «Hasta» (incluidos los dos).
 * `ilegible` marca un campo que el navegador tiene a medio escribir o con un día que no existe (su valor llega vacío).
 * @param {{desde?:string, hasta?:string, ilegible?:{desde?:boolean, hasta?:boolean}}} p
 * @returns {{desde:string, hasta:string, activo:boolean, error:string}} con error: sin fechas y sin aplicar.
 */
export function validarPeriodo({ desde = '', hasta = '', ilegible = {} } = {}) {
  const v = {};
  for (const [campo, crudo] of [['desde', desde], ['hasta', hasta]]) {
    const iso = ilegible && ilegible[campo] === true ? null : leerFecha(crudo);
    if (iso === null) return noAplica(ERRORES_PERIODO.ilegible(campo));
    if (iso && (iso < PERIODO_MIN || iso > PERIODO_MAX)) return noAplica(ERRORES_PERIODO.fuera(campo, iso));
    v[campo] = iso;
  }
  if (v.desde && v.hasta && v.desde > v.hasta) return noAplica(ERRORES_PERIODO.invertido(v.desde, v.hasta));
  return { desde: v.desde, hasta: v.hasta, activo: !!(v.desde || v.hasta), error: '' };
}

// ── Filtrar por el periodo ─────────────────────────────────────────────────────
/** ¿Hay periodo? (alguna de las dos fechas). Un periodo con error ya llega sin fechas. */
export const hayPeriodo = (p) => !!(p && (esIso(p.desde) || esIso(p.hasta)));
/**
 * ¿La ODT entra en el periodo? Sin periodo, siempre. Con periodo: su fecha prevista entre «Desde» y «Hasta», los dos
 * incluidos (un lado vacío no pone límite); sin fecha prevista, NO entra.
 * @param {object} o  @param {{desde?:string, hasta?:string}} periodo  (ya validado: validarPeriodo)
 */
export function enPeriodo(o, periodo) {
  if (!hayPeriodo(periodo)) return true;
  const f = o && o.prevista;
  if (!esIso(f)) return false;
  return (!esIso(periodo.desde) || f >= periodo.desde) && (!esIso(periodo.hasta) || f <= periodo.hasta);
}
/** Las ODT del periodo (todas, sin periodo). */
export function filtrarPeriodo(odts, periodo) {
  const xs = odts || [];
  return hayPeriodo(periodo) ? xs.filter((o) => enPeriodo(o, periodo)) : [...xs];
}
/** Las ODT que cumplen los filtros de siempre (tipo, zona, contratista, AZT, jefe) Y el periodo. */
export function filtrarConPeriodo(odts, filtros, periodo) {
  return filtrarPeriodo(filtrar(odts, filtros || {}), periodo);
}
/** Cuántas de estas ODT no traen fecha prevista (con un periodo puesto, quedan fuera). */
export function contarSinPrevista(odts) {
  return (odts || []).filter((o) => !esIso(o && o.prevista)).length;
}
/** «del 01/10/2026 al 31/10/2026», «desde el 01/10/2026», «hasta el 31/10/2026»; '' sin periodo. */
export function textoPeriodo(p) {
  const d = p && esIso(p.desde) ? p.desde : ''; const h = p && esIso(p.hasta) ? p.hasta : '';
  if (d && h) return 'del ' + fechaDMA(d) + ' al ' + fechaDMA(h);
  if (d) return 'desde el ' + fechaDMA(d);
  if (h) return 'hasta el ' + fechaDMA(h);
  return '';
}

// ── Periodos rápidos ───────────────────────────────────────────────────────────
/** Los grupos del selector «Periodo rápido», en su orden. */
export const GRUPOS_RAPIDOS = Object.freeze(['Atajos', 'Año', 'Meses', 'Trimestres', 'Semestres']);
const ORDINAL = ['1.er', '2.º', '3.er', '4.º'];
/**
 * Los periodos rápidos del año: todo el año, cada mes, cada trimestre y cada semestre; y, si `hoy` ('aaaa-mm-dd', la
 * fecha de Colombia) cae en ese año, «Este mes» y, si también cae, «Mes pasado».
 * @returns {ReadonlyArray<{clave:string, grupo:string, texto:string, desde:string, hasta:string}>}
 */
export function periodosRapidos(hoy = '', anio = PERIODO_ANIO) {
  const out = [];
  const poner = (clave, grupo, texto, r) => out.push(Object.freeze({ clave, grupo, texto, ...r }));
  if (esIso(hoy)) {
    const este = hoy.slice(0, 7);
    const iEste = Number(este.slice(5, 7)) - 1;
    if (este.startsWith(anio + '-')) poner('este-mes', 'Atajos', 'Este mes (' + MESES_LARGO[iEste] + ' de ' + anio + ')', periodoDeMes(este));
    const pasado = mesAnterior(este);
    if (pasado.startsWith(anio + '-')) poner('mes-pasado', 'Atajos', 'Mes pasado (' + MESES_LARGO[Number(pasado.slice(5, 7)) - 1] + ' de ' + anio + ')', periodoDeMes(pasado));
  }
  poner('anio', 'Año', 'Todo ' + anio, tramo(anio, 1, 12));
  MESES_TITULO.forEach((m, i) => poner('mes-' + dos(i + 1), 'Meses', m + ' ' + anio, tramo(anio, i + 1, i + 1)));
  for (let t = 0; t < 4; t++) {
    poner('trim-' + (t + 1), 'Trimestres', ORDINAL[t] + ' trimestre ' + anio + ' (' + MESES_CORTO[t * 3] + '–' + MESES_CORTO[t * 3 + 2] + ')', tramo(anio, t * 3 + 1, t * 3 + 3));
  }
  for (let s = 0; s < 2; s++) {
    poner('sem-' + (s + 1), 'Semestres', ORDINAL[s] + ' semestre ' + anio + ' (' + MESES_CORTO[s * 6] + '–' + MESES_CORTO[s * 6 + 5] + ')', tramo(anio, s * 6 + 1, s * 6 + 6));
  }
  return Object.freeze(out);
}
/** En el selector: «Fechas a la medida» (las de «Desde» y «Hasta», que no son un periodo rápido). */
export const CLAVE_MEDIDA = 'medida';
/**
 * La opción del selector que corresponde a unas fechas: '' sin periodo; la clave del periodo rápido con esas mismas
 * fechas (un mes antes que un atajo: «Este mes» y su mes son iguales); si no hay, CLAVE_MEDIDA.
 */
export function rapidoDe(periodo, rapidos = periodosRapidos()) {
  const d = (periodo && periodo.desde) || ''; const h = (periodo && periodo.hasta) || '';
  if (!d && !h) return '';
  const r = (rapidos || []).find((x) => x.grupo !== 'Atajos' && x.desde === d && x.hasta === h)
    || (rapidos || []).find((x) => x.desde === d && x.hasta === h);
  return r ? r.clave : CLAVE_MEDIDA;
}

// ── Evolución mensual con un periodo ───────────────────────────────────────────
/**
 * Los meses del gráfico con un periodo: de su primer mes a su último, con {generadas:0, cerradas:0} en los vacíos. Un
 * lado abierto llega hasta los datos (sin «Desde»: desde enero de 2026 o el primer mes con datos, si es anterior; sin
 * «Hasta»: hasta el último mes con datos). Sin periodo, los meses tal cual. Las cerradas de meses que quedan fuera (ODT
 * del periodo cerradas antes o después de él) se cuentan en `cerradasFuera`.
 * @param {Array<{mes:string, generadas:number, cerradas:number}>} porMes  el de agregar() sobre las ODT ya filtradas
 * @returns {{meses:Array<{mes:string, generadas:number, cerradas:number}>, cerradasFuera:number}}
 */
export function mesesDelPeriodo(porMes, periodo) {
  const xs = [...(porMes || [])].sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
  if (!hayPeriodo(periodo)) return { meses: xs, cerradasFuera: 0 };
  const conDatos = xs.filter((m) => (m.generadas || 0) + (m.cerradas || 0) > 0);
  const desdeAnio = PERIODO_MIN.slice(0, 7);
  let ini = esIso(periodo.desde) ? periodo.desde.slice(0, 7) : '';
  if (!ini) ini = conDatos.length && conDatos[0].mes < desdeAnio ? conDatos[0].mes : desdeAnio;
  let fin = esIso(periodo.hasta) ? periodo.hasta.slice(0, 7) : (conDatos.length ? conDatos[conDatos.length - 1].mes : ini);
  if (fin < ini) fin = ini;
  const por = new Map(xs.map((m) => [m.mes, m]));
  const meses = [];
  for (let m = ini; m <= fin && meses.length < 240; m = mesSiguiente(m)) {
    const x = por.get(m);
    meses.push({ mes: m, generadas: (x && x.generadas) || 0, cerradas: (x && x.cerradas) || 0 });
  }
  const cerradasFuera = xs.filter((m) => m.mes < ini || m.mes > fin).reduce((s, m) => s + (m.cerradas || 0), 0);
  return { meses, cerradasFuera };
}
