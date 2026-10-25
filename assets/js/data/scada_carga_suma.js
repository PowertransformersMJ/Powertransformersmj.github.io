// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · LECTURA de las curvas de un equipo con SUMA DE CIRCUITOS · 2026-10-24
// ──────────────────────────────────────────────────────────────
// Misma forma que `leerSeriesPunto` ({porMes: {AAAA-MM: {estado, serie?}}}) más el derivado de cada mes. Sin suma en la
// decisión de la fila devuelve EXACTAMENTE lo de `leerSeriesPunto` (las mismas lecturas, nada más). Con suma, lee el
// transformador y sus circuitos (con la caché de la sesión que ya existe) y compone cada MES COMPLETO con la misma función
// del importador, antes de cualquier recorte de rango: la cifra del mes sale igual en la lista y en el detalle.
//   · si la lectura de un circuito falla → ese mes queda «no se pudo leer» (el detalle ofrece «Reintentar»);
//   · si el documento de un circuito no existe → el nivel queda como hueco y su derivado en estado 'falta';
//   · el CANDADO de la lista rige también aquí: se lee el resumen GUARDADO del mes (la misma caché de la sesión) y, si su
//     derivado no vale (falta, otra firma, otra versión, medida del transformador distinta), el derivado del mes es ese
//     registro sin cifra aunque las curvas se puedan sumar; si esa lectura falla, el mes queda «no se pudo leer».
// Lo compuesto es una copia: nunca se modifica lo que guarda la caché. Solo getDoc por id (como siempre).
// Archivo NUEVO (L-102): importa solo `leerSeriesPunto` y `leerResumenMes` (ya publicadas) y el dominio nuevo.
// ══════════════════════════════════════════════════════════════

import { leerSeriesPunto, leerResumenMes } from './scada_carga.js';
import { especSuma, componerSerieMes } from '../domain/scada_carga_suma.js';

/**
 * Series de un equipo en varios meses, con sus niveles sumados si la homologación lo pide.
 * @param {string} cid     clave del punto del transformador
 * @param {string[]} meses 'AAAA-MM' que el catálogo tiene para ese punto
 * @param {object|null} fila  la fila de la homologación (con su decisión)
 * @param {{puntos?: object|null}} [op]  el catálogo de puntos (D5: otro transformador de la estación mide esa barra)
 * @returns {Promise<{porMes: Object<string, {estado: 'ok'|'no_existe'|'fallo', serie?: object, derivado?: Object<string, object>}>}>}
 */
export async function leerSeriesEquipo(cid, meses, fila, { puntos = null } = {}) {
  const spec = especSuma(fila);
  if (!spec || spec.cid !== cid) return leerSeriesPunto(cid, meses);
  const circuitos = [...new Set(Object.values(spec.porNivel).flatMap((x) => x.cids))];
  const [base, resumenes, ...otros] = await Promise.all([leerSeriesPunto(cid, meses), Promise.all(meses.map((m) => leerResumenMes(m))),
    ...circuitos.map((c) => leerSeriesPunto(c, meses))]);
  const porMes = {};
  meses.forEach((mes, i) => {
    const t = base.porMes[mes];
    if (!t || t.estado !== 'ok') { porMes[mes] = t; return; }
    const deMes = otros.map((o) => o.porMes[mes]);
    const rg = resumenes[i];
    if (deMes.some((x) => x && x.estado === 'fallo') || !rg || rg.estado === 'fallo') { porMes[mes] = { estado: 'fallo' }; return; }
    const series = Object.fromEntries(circuitos.map((c, k) => [c, deMes[k] && deMes[k].estado === 'ok' ? deMes[k].serie : null]));
    const guardadas = rg.estado === 'ok' && rg.datos && rg.datos.claves ? rg.datos.claves : {};
    const r = componerSerieMes({ mes, trafo: t.serie, circuitos: series, spec, guardadas, puntos });
    porMes[mes] = { estado: 'ok', serie: r.serie, derivado: r.derivado };
  });
  return { porMes };
}
