// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · firmeza de VARIOS meses por el devanado que da la cifra (dominio puro) · 2026-10-27
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («Sí, en mes y periodo»): la firmeza la decide el devanado que da la cifra, contado en los meses
// en que midió. Antes, en el periodo, un devanado que solo midió algunos meses (o el de una estación que no vino en el
// exporte de un mes) contaba esos meses como hueco: Chambacú T1 y T2 salían provisionales con sus 9 meses firmes. Aquí se
// junta lo de cada devanado SOLO en los meses en que midió; `firmeza` (scada_carga_kpis.js) lo usa si viene, y además exige
// que haya medido al menos la mitad de los meses del periodo. Funciones PURAS. Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

/** El devanado que da la cifra debe haber medido al menos esta fracción de los meses del periodo. */
export const FRACCION_MESES_MIN = 0.5;

/**
 * Lo de UN devanado en los meses en que midió. Cobertura del mes = horas válidas ÷ horas en servicio: se recompone el
 * total de horas en servicio de cada mes (n ÷ cobertura) para que la cobertura junta pese cada mes por sus horas.
 * @param {Array<{n:number, cob:number}>} porMes  un registro por mes (los meses sin medida se ignoran)
 * @returns {{coberturaFirmeza: number|null, mesesMedidos: number}}
 */
export function firmezaDeMeses(porMes) {
  let n = 0; let serv = 0; let medidos = 0;
  for (const x of porMes || []) {
    if (!x || !(x.n > 0) || !(x.cob > 0)) continue;
    n += x.n; serv += x.n / x.cob; medidos++;
  }
  return { coberturaFirmeza: serv > 0 ? n / serv : null, mesesMedidos: medidos };
}

/**
 * Para la lista por periodo: de las filas de cada mes del equipo (las de `filasLista`, con `devanados`) → por devanado.
 * @param {Array<object|null>} filasMes  una por mes del periodo (null si el equipo no tiene fila ese mes)
 * @param {number} mesesTotal  meses del periodo que el parque cargó
 * @returns {Object<string, {coberturaFirmeza:number|null, mesesMedidos:number, mesesTotal:number}>}
 */
export function firmezaPeriodoDeFilas(filasMes, mesesTotal) {
  const por = {};
  for (const x of filasMes || []) {
    if (!x || !Array.isArray(x.devanados)) continue;
    for (const d of x.devanados) if (d && d.d) (por[d.d] = por[d.d] || []).push({ n: d.n, cob: d.cobertura });
  }
  return Object.fromEntries(Object.entries(por).map(([d, l]) => [d, { ...firmezaDeMeses(l), mesesTotal }]));
}
