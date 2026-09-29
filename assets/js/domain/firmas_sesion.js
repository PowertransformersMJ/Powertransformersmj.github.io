// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — ¿Esta línea de firma es de quien tiene la sesión? (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// Órdenes de Entrada/Salida (IT.05801) comparaba el nombre de la línea con el del
// perfil EXACTO (`firmaAplicaA`, `99 §71`). En producción el perfil del Ingeniero
// se llama «ING. MIGUEL JIMENEZ» (`§99.12`) y la línea «AUTORIZADO POR» dice
// «MIGUEL JIMENEZ»: nunca coincidían y su firma no salía en el PDF (2026-09-28).
// Fichas ya lo había resuelto con una lista CERRADA de nombres de la misma
// persona; aquí se usa esa misma lista (`PERSONAS_EQUIPO`, `firmas_equipo.js`).
// No se afloja la comparación para nadie más (quitar títulos o iniciales sería
// equivocarse hacia el lado permisivo, que en una firma no se permite, `§71.4`).
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ══════════════════════════════════════════════════════════════════════════════

import { normalizarNombre } from './firmas.js';
import { PERSONAS_EQUIPO } from './firmas_equipo.js';

/**
 * ¿La línea con `nombreDeLaLinea` es de quien tiene la sesión (`nombreEnSesion`)?
 * Sí si los nombres son iguales (sin tildes, mayúsculas, espacios), o si los dos
 * son nombres dictados de la MISMA persona de la lista cerrada.
 */
export function lineaDeLaSesion(nombreDeLaLinea, nombreEnSesion) {
  const linea = normalizarNombre(nombreDeLaLinea);
  const sesion = normalizarNombre(nombreEnSesion);
  if (!linea || !sesion) return false;
  if (linea === sesion) return true;
  return PERSONAS_EQUIPO.some((p) => {
    const nombres = p.nombres.map(normalizarNombre);
    return nombres.includes(linea) && nombres.includes(sesion);
  });
}
