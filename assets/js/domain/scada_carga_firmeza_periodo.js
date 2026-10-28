// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · firmeza de VARIOS meses por el devanado que da la cifra (dominio puro) · 2026-10-27
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («Sí, en mes y periodo»): la firmeza la decide el devanado que da la cifra, contado en los meses
// en que midió. Antes, en el periodo, un devanado que solo midió algunos meses (o el de una estación que no vino en el
// exporte de un mes) contaba esos meses como hueco: Chambacú T1 y T2 salían provisionales con sus 9 meses firmes. Aquí se
// junta lo de cada devanado SOLO en los meses en que midió; `firmeza` (scada_carga_kpis.js) lo usa si viene, y además exige
// que haya medido al menos la mitad de los meses del periodo. Funciones PURAS. Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

// Mes casi sin medida (2026-10-28): archivo NUEVO; un mes que midió menos de 72 h cuenta como no medido.
import { mesCasiSinMedida } from './scada_carga_mes_casi_sin_medida.js';

/** El devanado que da la cifra debe haber medido al menos esta fracción de los meses del periodo. */
export const FRACCION_MESES_MIN = 0.5;

/**
 * Lo de UN devanado en los meses en que midió. Cobertura del mes = horas válidas ÷ horas en servicio, con las horas en
 * servicio del resumen (`servicio`; si un módulo viejo no lo trae, n ÷ cobertura) MENOS los días que el parque aún no cargó
 * (`fuera`): no son hueco (`99 §159`, como `resumenPeriodo`). Un mes con horas pero TODAS fuera de servicio (desenergizado
 * todo el mes) no cuenta ni como medido ni como no medido: no había nada que medir (revisión adversarial 2026-10-27). Un
 * mes sin horas (`horas` = 0: el punto no vino en el exporte) SÍ es un mes en que no midió, y también uno que CASI no midió
 * (menos de 72 h teniendo al menos 72 en servicio, `scada_carga_mes_casi_sin_medida.js`, 2026-10-28).
 * @param {Array<{n:number, cob:number|null, servicio?:number|null, horas?:number|null, fuera?:number}|null>} porMes  un registro por mes
 * @returns {{coberturaFirmeza: number|null, mesesMedidos: number, mesesSinServicio: number, nMedido: number, unaFaltaMedida: number}}
 *   `nMedido` / `unaFaltaMedida`: horas válidas y de dos fases de los meses que cuentan (para la unidad de reserva).
 *   Con algún mes casi sin medida, además `coberturaConCasi` y `mesesMedidosConCasi`: contándolos como medidos (la regla de antes).
 */
export function firmezaDeMeses(porMes) {
  let n = 0; let serv = 0; let medidos = 0; let sinServicio = 0; let unaFalta = 0; let nCasi = 0; let servCasi = 0; let casi = 0;
  for (const x of porMes || []) {
    if (!x) continue;
    const nx = x.n > 0 ? x.n : 0;
    const base = x.servicio != null ? x.servicio : (nx > 0 && x.cob > 0 ? nx / x.cob : null);
    if (base == null) continue;
    const s = Math.max(nx, base - (x.fuera > 0 ? x.fuera : 0));
    if (!(s > 0)) { if (x.horas > 0) sinServicio++; continue; }
    if (!nx) continue;
    if (mesCasiSinMedida(nx, s)) { nCasi += nx; servCasi += s; casi++; continue; }
    n += nx; serv += s; medidos++; unaFalta += x.unaFalta > 0 ? x.unaFalta : 0;
  }
  return { coberturaFirmeza: serv > 0 ? n / serv : null, mesesMedidos: medidos, mesesSinServicio: sinServicio, nMedido: n, unaFaltaMedida: unaFalta,
    ...(casi ? { coberturaConCasi: (n + nCasi) / (serv + servCasi), mesesMedidosConCasi: medidos + casi } : {}) };
}

/**
 * Para la lista por periodo: de las filas de cada mes del equipo (las de `filasLista`, con `devanados`) → por devanado.
 * @param {Array<object|null>} filasMes  una por mes del periodo (null si el equipo no tiene fila ese mes)
 * @param {number} mesesTotal  meses del periodo que el parque cargó
 * @param {number[]} [fueraPorMes]  horas que el parque aún no cargó de cada mes (mismo orden que `filasMes`)
 * @returns {Object<string, {coberturaFirmeza:number|null, mesesMedidos:number, mesesTotal:number, faseSinCargaMideMes?:true}>}
 *   `mesesTotal` de cada devanado = los del periodo menos los que estuvo desenergizado todo el mes y los meses en reserva.
 */
export function firmezaPeriodoDeFilas(filasMes, mesesTotal, fueraPorMes = []) {
  const por = {}; const mide = {}; let reserva = 0;
  (filasMes || []).forEach((x, k) => {
    if (!x || !Array.isArray(x.devanados)) return;
    // Unidad de reserva (2026-10-28): un mes en reserva no cuenta, ni como medido ni como no medido.
    if (x.enReserva) { reserva++; return; }
    for (const d of x.devanados) {
      if (d && d.d) (por[d.d] = por[d.d] || []).push({ n: d.n, cob: d.cobertura, servicio: d.servicio, horas: d.horas, unaFalta: d.unaFalta, fuera: (fueraPorMes && fueraPorMes[k]) || 0 });
      // Fase sin carga por diseño (2026-10-28): el resguardo de un mes no se diluye en el año.
      if (d && d.d && d.faseSinCargaMide) mide[d.d] = true;
    }
  });
  return Object.fromEntries(Object.entries(por).map(([d, l]) => {
    const f = firmezaDeMeses(l);
    return [d, { coberturaFirmeza: f.coberturaFirmeza, mesesMedidos: f.mesesMedidos, mesesTotal: Math.max(0, mesesTotal - f.mesesSinServicio - reserva),
      ...(mide[d] ? { faseSinCargaMideMes: true } : {}),
      ...(f.coberturaConCasi != null ? { coberturaConCasi: f.coberturaConCasi, mesesMedidosConCasi: f.mesesMedidosConCasi } : {}),
      // Con meses en reserva, las 72 h y «falta una fase» se miran SOLO en los meses que cuentan (no con el ruido de la reserva).
      ...(reserva ? { mesesReserva: reserva, nFirmeza: f.nMedido, unaFaltaFirmeza: f.unaFaltaMedida } : {}) }];
  }));
}
