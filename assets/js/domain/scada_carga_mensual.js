// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · MES A MES y ACUMULADO a la fecha de UN equipo (dominio puro) · TODO-69
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-23): «un segmento de la variable donde se pueda apreciar el transcurso de mes a mes y
// de forma acumulada (promedio a la fecha) … replicar esto en todos los equipos».
//   · Mes a mes  = la MISMA cifra de la lista en «Un mes» (`filasLista`).
//   · Acumulado  = la MISMA cifra de la lista en «Varios meses» (`filasPeriodo`) desde el primer mes con datos del
//     punto hasta ese mes (máximo 12 meses): p99 de TODAS las horas del tramo, no el promedio de las cifras mensuales
//     (subestima, `99 §159`).
//   · Promedio   = la media simple de las cifras mensuales del mismo tramo, SOLO de referencia para la vista previa
//     (el Ingeniero dijo «promedio a la fecha»; él decide cuál queda).
// Sin cálculo propio: orquesta las funciones de la lista para un equipo, así no puede diferir de ella. Un mes que no se
// pudo LEER deja sin cifra el acumulado de todo tramo que lo contenga (como «Varios meses»: «no se pudo leer <mes>»), y un
// mes que la plataforma no cargó sale como hueco. Única diferencia a propósito: el acumulado de UN solo mes es la cifra de
// «Un mes» (exacta aunque al mes le falten sus horas más altas guardadas, que «Varios meses» pediría preparar).
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { filasLista } from './scada_carga_vista.js';
import { filasPeriodo, MAX_MESES_PERIODO } from './scada_carga_periodo.js';

const resumida = (x) => (x ? {
  pct: x.pct, crg: x.crg ?? null, clase: x.clase, firme: !!x.firme, devMax: x.devMax || null, motivoNulo: x.motivoNulo || null
} : { pct: null, crg: null, clase: 'nulo', firme: false, devMax: null, motivoNulo: 'sin cálculo' });

/**
 * Los meses del tramo: los que el parque cargó, desde el primer mes con datos del punto (o el primero del parque si el
 * punto no tiene) hasta el último cargado.
 * @param {object|null} catalogo  `scada_catalogo/estado` (con `meses`)
 * @param {object|null} punto     el punto SCADA del equipo (con `meses`)
 * @returns {string[]}  'AAAA-MM' en orden
 */
export function mesesDelEquipo(catalogo, punto) {
  const delParque = Object.keys((catalogo && catalogo.meses) || {}).sort();
  const delPunto = [...((punto && punto.meses) || [])].sort();
  if (!delParque.length) return delPunto;
  const desde = delPunto.length ? delPunto[0] : delParque[0];
  return delParque.filter((m) => m >= desde);
}

/** Meses de calendario entre dos 'AAAA-MM' (incluidos). */
function calendario(a, b) {
  const out = []; let [y, m] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number);
  while (y < yb || (y === yb && m <= mb)) { out.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

/**
 * Cargabilidad de un equipo mes a mes y acumulada a la fecha. Los meses que la plataforma no tiene cargados (p. ej.
 * mayo de 2026, que el SCADA exportó vacío) salen como hueco con su motivo: no se esconden ni se inventan.
 * @param {{tx: object, homologacion: object|null, catalogo: object|null, punto: object|null,
 *          resumenes: Object<string, object|null>, umbrales?: object, estadistico?: string, meses?: string[]}} ctx
 *   `resumenes[mes]` = `scada_resumen/<mes>` (con `claves`); null si el mes no se pudo leer.
 * @returns {Array<{mes: string, leido: boolean, cargado: boolean,
 *   mensual: {pct, crg, clase, firme, devMax, motivoNulo},
 *   acumulado: {pct, crg, clase, firme, devMax, motivoNulo, desde: string, nMeses: number},
 *   promedio: {pct: number|null, nMeses: number}}>}
 */
export function serieMensualEquipo({ tx, homologacion, catalogo, punto, resumenes, umbrales, estadistico, meses }) {
  const cargados = meses || mesesDelEquipo(catalogo, punto);
  const noLeidos = new Set(cargados.filter((m) => !(resumenes && resumenes[m])));
  const lista = cargados.length ? calendario(cargados[0], cargados[cargados.length - 1]) : [];
  const enParque = new Set(cargados);
  const leidos = cargados.filter((m) => resumenes && resumenes[m]);
  const mensual = {};
  for (const m of leidos) {
    mensual[m] = resumida(filasLista({ parque: [tx], homologacion, catalogo, resumenMes: resumenes[m], umbrales, estadistico })[0]);
  }
  return lista.map((mes) => {
    if (!enParque.has(mes)) {
      const hueco = { ...resumida(null), motivoNulo: 'este mes no está cargado en la plataforma' };
      return { mes, leido: false, cargado: false, mensual: hueco, acumulado: { ...hueco, desde: mes, nMeses: 0 }, promedio: { pct: null, nMeses: 0 } };
    }
    const leido = !!(resumenes && resumenes[mes]);
    // Tramo acumulado: los meses LEÍDOS dentro de los 12 meses de calendario que terminan en este (como elegir ese rango
    // en «Varios meses»; un mes sin cargar dentro del rango no alarga el tramo).
    const [y, m] = mes.split('-').map(Number); const k0 = y * 12 + (m - 1) - (MAX_MESES_PERIODO - 1);
    const desdeCal = Math.floor(k0 / 12) + '-' + String((k0 % 12) + 1).padStart(2, '0');
    const tramo = leidos.filter((x) => x >= desdeCal && x <= mes);
    const faltan = cargados.filter((x) => noLeidos.has(x) && x >= desdeCal && x <= mes);
    let acumulado = { ...resumida(null), motivoNulo: leido ? 'sin cálculo' : 'no se pudo leer este mes', desde: tramo[0] || mes, nMeses: tramo.length };
    if (leido && faltan.length) acumulado = { ...acumulado, motivoNulo: 'no se pudo leer ' + faltan.join(', ') };
    else if (leido && tramo.length) {
      const filasPorMes = Object.fromEntries(tramo.map((m) => [m, []]));
      const fila = tramo.length === 1 ? mensual[mes]
        : resumida(filasPeriodo({ parque: [tx], homologacion, catalogo, meses: tramo, resumenes, filasPorMes, umbrales, estadistico })[0]);
      acumulado = { ...fila, desde: tramo[0], nMeses: tramo.length };
    }
    const conCifra = tramo.map((m) => mensual[m]).filter((x) => x && x.pct != null);
    const promedio = {
      pct: leido && !faltan.length && conCifra.length ? conCifra.reduce((s, x) => s + x.pct, 0) / conCifra.length : null,
      nMeses: conCifra.length
    };
    return { mes, leido, cargado: true, mensual: leido ? mensual[mes] : { ...resumida(null), motivoNulo: 'no se pudo leer este mes' }, acumulado, promedio };
  });
}
