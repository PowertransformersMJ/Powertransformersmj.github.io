// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · firmeza de un RANGO de varios meses en el detalle (dominio puro) · 2026-10-27
// ──────────────────────────────────────────────────────────────────────────────
// La misma regla que la lista por periodo (decisión del Ingeniero, «Sí, en mes y periodo»): la firmeza la decide el
// devanado que da la cifra, contado en los meses en que midió. El detalle trae las curvas del rango; aquí se corta cada mes,
// se resume como lo guarda el importador y se cuenta igual que `firmezaPeriodoDeFilas`. Solo en rangos de meses COMPLETOS
// (como los abre la lista o un botón de mes): con un rango libre, un mes que apenas toca el borde contaría como mes entero
// (revisión adversarial 2026-10-27), y ahí rige la cobertura del rango. Funciones PURAS. Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { msInicio, horasMes, ventanaDeMes } from './scada_carga_series.js';
import { NIVELES } from './scada_carga_config.js';
import { resumenFisico } from './scada_carga_kpis.js';
import { resumirParaGuardar } from './scada_carga_importacion.js';
import { firmezaDeMeses } from './scada_carga_firmeza_periodo.js';

const H_MS = 3600e3;

/**
 * ¿El rango [desde, hasta] es exactamente de meses completos? (`meses` = los que toca, de `mesesDelRango`.)
 * @param {number} desdeMs  @param {number} hastaMs  @param {string[]} meses
 */
export function esDeMesesCompletos(desdeMs, hastaMs, meses) {
  if (!meses || !meses.length) return false;
  return desdeMs === ventanaDeMes(meses[0]).desde && hastaMs === ventanaDeMes(meses[meses.length - 1]).hasta;
}

/**
 * Las horas de UN mes dentro de un rango ya recortado (mismo índice que `recortarRango`); null si el mes no cae en él.
 * @param {{t: ArrayLike<number>, fam: Object<string, Object<string, ArrayLike>>}} rec  @param {string} mes  @param {number} desdeMs
 */
export function recortarMes(rec, mes, desdeMs) {
  const horas = rec.t.length;
  const k = Math.round((msInicio(mes, 0) - desdeMs) / H_MS);
  const k0 = Math.max(0, k);
  const k1 = Math.min(horas, k + horasMes(mes));
  if (k1 <= k0) return null;
  const fam = {};
  for (const [f, x] of Object.entries(rec.fam)) {
    fam[f] = {};
    for (const [c, arr] of Object.entries(x)) fam[f][c] = arr && typeof arr.subarray === 'function' ? arr.subarray(k0, k1) : arr;
  }
  return fam;
}

/**
 * Por devanado, su cobertura en los meses en que midió y cuántos midió (lo que `firmeza` lee). Menos de 2 meses → null.
 * @param {Object<string, {t, fam}>} recs  por nivel, las curvas recortadas al rango
 * @param {Array<{nivel, devanado}>} niveles  los de `calcularEquipo` (nivel → devanado)
 * @param {string[]} mesesCargados  los meses del rango que el parque cargó
 * @param {number} desdeMs
 * @param {Object<string, number>} [noCargadas]  horas que el parque aún no cargó de cada mes (`horasNoCargadas`)
 * @returns {null | Object<string, {coberturaFirmeza:number|null, mesesMedidos:number, mesesTotal:number}>}
 */
export function firmezaDelRango(recs, niveles, mesesCargados, desdeMs, noCargadas = {}) {
  if (!mesesCargados || mesesCargados.length < 2) return null;
  const out = {};
  for (const [nv, rec] of Object.entries(recs || {})) {
    const i = (niveles || []).find((x) => x.nivel === nv);
    if (!i || !i.devanado || !rec) continue;
    const lista = mesesCargados.map((mes) => {
      const fam = recortarMes(rec, mes, desdeMs);
      if (!fam) return null;
      const r = resumirParaGuardar(resumenFisico(fam, NIVELES[nv].kv), fam);
      return r ? { n: r.i ? r.i.n : 0, cob: r.cob, servicio: r.servicio, fuera: (noCargadas && noCargadas[mes]) || 0 } : null;
    });
    const f = firmezaDeMeses(lista);
    out[i.devanado] = { coberturaFirmeza: f.coberturaFirmeza, mesesMedidos: f.mesesMedidos, mesesTotal: Math.max(0, mesesCargados.length - f.mesesSinServicio) };
  }
  return out;
}
