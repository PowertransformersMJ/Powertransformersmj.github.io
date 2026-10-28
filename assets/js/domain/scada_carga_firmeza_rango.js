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
import { resumenFisico, cargabilidad } from './scada_carga_kpis.js';
import { resumirParaGuardar } from './scada_carga_importacion.js';
import { firmezaDeMeses } from './scada_carga_firmeza_periodo.js';
import { faseSinCargaMide } from './scada_carga_fase_sin_carga.js';
import { mesEnReserva } from './scada_carga_reserva.js';
// Mes casi sin medida (2026-10-28): archivo NUEVO.
import { mesCasiSinMedida } from './scada_carga_mes_casi_sin_medida.js';
import { p99DePeriodo } from './scada_carga_periodo.js';

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
 * @param {Array<{nivel, devanado, A?}>} niveles  los de `calcularEquipo` (nivel → devanado y su ampacidad)
 * @param {string[]} mesesCargados  los meses del rango que el parque cargó
 * @param {number} desdeMs
 * @param {Object<string, number>} [noCargadas]  horas que el parque aún no cargó de cada mes (`horasNoCargadas`)
 * @param {{reserva?: boolean}} [opciones]  `reserva`: unidad de reserva marcada (un mes en reserva no cuenta, `scada_carga_reserva.js`)
 * @returns {null | Object<string, {coberturaFirmeza:number|null, mesesMedidos:number, mesesTotal:number}>}
 */
export function firmezaDelRango(recs, niveles, mesesCargados, desdeMs, noCargadas = {}, { reserva = false } = {}) {
  if (!mesesCargados || mesesCargados.length < 2) return null;
  // Primero el resumen de cada nivel en cada mes (como lo guarda el importador); luego se cuenta.
  const porNivel = [];
  for (const [nv, rec] of Object.entries(recs || {})) {
    const i = (niveles || []).find((x) => x.nivel === nv);
    if (!i || !i.devanado || !rec) continue;
    const meses = mesesCargados.map((mes) => {
      const fam = recortarMes(rec, mes, desdeMs);
      return fam ? resumirParaGuardar(resumenFisico(fam, NIVELES[nv].kv), fam) : null;
    });
    porNivel.push({ nv, d: i.devanado, A: i.A, meses });
  }
  // Unidad de reserva: los meses sin carga apreciable no cuentan (los mismos criterios que el mes de la lista).
  const enReserva = mesesCargados.map((mes, k) => reserva && mesEnReserva(porNivel.map((x) => {
    const r = x.meses[k];
    const n = r && r.i ? r.i.n : 0;
    return { devanado: x.d, n, pct: n > 0 && x.A > 0 ? cargabilidad(r, x.A) : null,
      pctMax: n > 0 && x.A > 0 && r.i.max != null ? 100 * r.i.max / x.A : null, horas: r ? r.horas : null, servicio: r ? r.servicio : null };
  }), (noCargadas && noCargadas[mes]) || 0));
  const nReserva = enReserva.filter(Boolean).length;
  const out = {};
  for (const x of porNivel) {
    let mide = false;
    const lista = x.meses.map((r, k) => {
      if (!r || enReserva[k]) return null;
      // Fase sin carga por diseño: el resguardo, mes a mes (solo lo usa `calcularEquipo` si el nivel lleva la marca).
      if (r.i && faseSinCargaMide(r.i.n, r.i.unaFalta)) mide = true;
      return { n: r.i ? r.i.n : 0, cob: r.cob, servicio: r.servicio, horas: r.horas, unaFalta: r.i ? r.i.unaFalta : 0, fuera: (noCargadas && noCargadas[mesesCargados[k]]) || 0 };
    });
    // Mes casi sin medida: el p99 del rango SIN esos meses (todos los meses con horas, como la cifra), para el resguardo.
    let hayCasi = false; const partesSin = [];
    x.meses.forEach((r, k) => {
      if (!r || !r.i || !(r.i.n > 0)) return;
      const fuera = (noCargadas && noCargadas[mesesCargados[k]]) || 0;
      if (mesCasiSinMedida(r.i.n, Math.max(r.i.n, (r.servicio != null ? r.servicio : (r.horas || 0)) - fuera))) hayCasi = true;
      else partesSin.push({ n: r.i.n, top: r.top || null });
    });
    const f = firmezaDeMeses(lista);
    out[x.d] = { coberturaFirmeza: f.coberturaFirmeza, mesesMedidos: f.mesesMedidos, mesesTotal: Math.max(0, mesesCargados.length - f.mesesSinServicio - nReserva),
      ...(mide ? { faseSinCargaMideMes: true } : {}),
      // Mes casi sin medida (2026-10-28): el p99 sin esos meses, para el resguardo de `calcularEquipo`.
      ...(hayCasi ? { p99SinMesesCasi: p99DePeriodo(partesSin).p99 } : {}),
      ...(f.coberturaConCasi != null ? { coberturaConCasi: f.coberturaConCasi } : {}),
      ...(nReserva ? { mesesReserva: nReserva, nFirmeza: f.nMedido, unaFaltaFirmeza: f.unaFaltaMedida } : {}) };
  }
  return out;
}
