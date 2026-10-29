// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · EQUIPOS QUE PASARON A OTRO OPERADOR (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Dato del Ingeniero (2026-10-28): «los equipos de zona oriente hasta el 1 de septiembre se tuvo medida, ya esos equipos son
// gerenciados por otra empresa llamada ENERGUA, ENERGIA ATENEA». Verificado con los resúmenes guardados: de los 62 equipos de
// la zona Oriente, 61 midieron en agosto, 8 traen solo el 1–2 de septiembre y ninguno octubre; ningún equipo de otra zona
// dejó de venir. Desde ese mes el exporte de AFINIA ya no los trae: septiembre y octubre NO son meses en que «no midió».
// Para esos equipos el periodo se corta en el último mes antes del traspaso (lista, acumulado, detalle) y un mes desde el
// traspaso queda sin cifra con su motivo. El resto del parque no cambia. Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

/** Traspasos de operación: zona del parque (`ubicacion.zona`), primer mes que ya no opera AFINIA y quién la opera. */
export const TRASPASOS = Object.freeze([
  Object.freeze({ zona: 'ORIENTE', desde: '2026-09', operador: 'ENERGUA (Energía Atenea)' })
]);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const esMes = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const textoMes = (m) => (esMes(m) ? MESES[Number(m.slice(5, 7)) - 1] + '-' + m.slice(0, 4) : String(m || ''));
const mesAnterior = (m) => {
  const y = Number(m.slice(0, 4)); const n = Number(m.slice(5, 7));
  return n === 1 ? (y - 1) + '-12' : y + '-' + String(n - 1).padStart(2, '0');
};
const zonaDe = (tx) => String((tx && tx.ubicacion && tx.ubicacion.zona) || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/** El traspaso que aplica al transformador (por su zona), o null. */
export function traspasoDe(tx) {
  const z = zonaDe(tx);
  return z ? TRASPASOS.find((t) => t.zona === z) || null : null;
}

/** El traspaso si `mes` ('AAAA-MM') ya es de otro operador para ese transformador; si no, null. */
export function mesDeOtroOperador(tx, mes) {
  const t = traspasoDe(tx);
  return t && esMes(mes) && mes >= t.desde ? t : null;
}

/** Los meses de una lista que operó AFINIA (sin traspaso: la misma lista). */
export function mesesAntesDelTraspaso(t, meses) {
  return t ? (meses || []).filter((m) => m < t.desde) : (meses || []);
}

/** El punto del catálogo recortado a los meses antes del traspaso (sin traspaso: el mismo punto). */
export function puntoAntesDelTraspaso(punto, t) {
  if (!punto || !t) return punto;
  return { ...punto, meses: mesesAntesDelTraspaso(t, punto.meses || []) };
}

/** «desde el 1-sep-2026 lo opera ENERGUA (Energía Atenea)» — el motivo de un mes sin cifra por el traspaso. */
export function motivoTraspaso(t) {
  return t ? 'desde el 1-' + textoMes(t.desde) + ' lo opera ' + t.operador : '';
}

/** «Medido hasta ago-2026: desde el 1-sep-2026 lo opera ENERGUA (Energía Atenea)» — la nota de un periodo recortado. */
export function textoTraspaso(t) {
  return t ? 'Medido hasta ' + textoMes(mesAnterior(t.desde)) + ': ' + motivoTraspaso(t) : '';
}
