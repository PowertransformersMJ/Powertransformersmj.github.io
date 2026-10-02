// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · sobrecarga sostenida cuando el resumen del mes no alcanza · `99 §129`
// ──────────────────────────────────────────────────────────────────────────────
// La lista decide «Sobrecarga sostenida» y «Pico aislado» con el resumen guardado del mes, que es de la corriente EN
// BRUTO. Eso es exacto salvo en un nivel cuyo mes trae horas imposibles (> 3 × ampacidad): ahí `calcularEquipo` deja el
// nivel en `sobrecargaPorVerificar` y la lista lee la curva del mes de ESE punto para decidir con la serie LIMPIA, la misma
// del detalle (indicador «Sobre el 100 % sostenido» y panel DGA). Ocurre poco (1 fila en 8 meses reales).
// Archivo NUEVO a propósito (L-102): la lista lo carga con import() solo cuando hace falta. Funciones PURAS.
// ══════════════════════════════════════════════════════════════════════════════

import { FAMILIAS, CALCULO } from './scada_carga_config.js';
import { recortarRango, ventanaDeMes } from './scada_carga_series.js';
import { iFaseMax, serieCargabilidad, horasSostenidasSobre, estadisticas } from './scada_carga_kpis.js';

/**
 * Sobrecarga de UN nivel en el mes, con la serie limpia (sin las horas de más de 3 × ampacidad).
 * @param {{estado:string, serie?:{niveles:Object}}} docMes  `leerSeriesPunto(cid, [mes]).porMes[mes]`
 * @returns {null | {horas:number, max:number|null, excluidas:number}}  null = no se pudo leer la curva
 */
export function sobrecargaDeCurva(docMes, mes, nivel, A) {
  if (!docMes || docMes.estado !== 'ok' || !docMes.serie || !(A > 0)) return null;
  const nv = docMes.serie.niveles && docMes.serie.niveles[nivel];
  // Una curva que no trae el nivel (o sin una sola hora válida) no puede contradecir al resumen: no decide.
  if (!nv || !nv.fam) return null;
  const v = ventanaDeMes(mes);
  const rec = recortarRango({ [mes]: { estado: 'ok', series: nv.fam } }, FAMILIAS, v.desde, v.hasta);
  const carga = serieCargabilidad(iFaseMax(rec.fam).serie, A);
  const e = estadisticas(carga.serie);
  if (!e.n && !carga.excluidas) return null;
  const sobre = horasSostenidasSobre(carga.serie, CALCULO.sobrecargaPct, CALCULO.sobrecargaMinH);
  return { horas: sobre.horas, max: e.max, excluidas: carga.excluidas };
}

/** Tope de curvas que la lista lee por mes (cada una es un documento de 35 a 320 KB): las que pasen quedan «por confirmar». */
export const MAX_VERIFICAR_MES = 10;

/**
 * Fila de la lista con la verificación aplicada (devuelve una fila NUEVA).
 * @param {object} fila  fila de `filasLista` con `sobrecargaPorVerificar` no vacío
 * @param {Array<null|{horas, max}>} resultados  uno por nivel por verificar; null = no se pudo leer
 *   Si alguno falla: no se afirma ni se niega → `verificacion: 'fallo'` («por confirmar» en la página).
 */
export function aplicarVerificacion(fila, resultados) {
  const lista = resultados || [];
  if (!lista.length || lista.some((r) => r == null)) {
    return { ...fila, sobrecargaPorVerificar: [], verificacion: 'fallo' };
  }
  const sost = lista.some((r) => r.horas > 0);
  const pico = !sost && (!!fila.picoAislado || lista.some((r) => r.max != null && r.max > CALCULO.sobrecargaPct));
  return {
    ...fila,
    sobrecargaSostenida: fila.clase === 'firme' && sost,
    sobrecargaProvisional: fila.clase !== 'firme' && sost,
    picoAislado: pico,
    sobrecargaPorVerificar: [],
    verificacion: 'ok',
  };
}
