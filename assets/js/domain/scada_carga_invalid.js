// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · BANDERA «INVALID» NO CONFIABLE de un punto (dominio puro) · 2026-10-28
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero («procede con La Europa y Ovejas»): en algunos puntos el SCADA marca «Invalid» horas bien medidas
// (los circuitos de La Europa y de Ovejas T2: las horas «Invalid» siguen a la medida independiente igual que las «Actual»,
// con la curva del día y decimales). Con la marca en la decisión de la homologación (`decision.invalid_no_confiable = true`), la
// limpieza de ESE punto acepta la bandera «Invalid» como buena. Nada más cambia: «Not Renewed», sin archivo, congelado,
// cero, tope y escala siguen igual. La marca la aplica el importador al cargar un mes y `reprocesarGuardado` a los meses ya
// guardados (las series conservan valor y bandera crudos: no hay que volver a leer las carpetas). Funciones PURAS.
// Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { analizarClaveHomologada, claveEfectiva } from './scada_carga_homologacion.js';
import { claveId } from './scada_carga_csv.js';
import { procesarPuntoMes } from './scada_carga_importacion.js';

/** ¿La fila marca la bandera «Invalid» de su punto como no confiable? (decisión «usar») */
export function invalidNoConfiable(fila) {
  return !!(fila && fila.decision && fila.decision.tipo === 'usar' && fila.decision.invalid_no_confiable === true);
}

/**
 * Los puntos (claveId) cuya bandera «Invalid» no se cree: los de las filas marcadas, con su clave efectiva de hoy.
 * @param {Object<string, object>} filas  las filas de la homologación
 * @returns {Set<string>}
 */
export function puntosInvalidNoConfiable(filas) {
  const out = new Set();
  for (const f of Object.values(filas || {})) {
    if (!invalidNoConfiable(f) || f.retirada) continue;
    const k = analizarClaveHomologada(claveEfectiva(f));
    if (k) out.add(claveId(k.est, k.elem));
  }
  return out;
}

/**
 * Vuelve a limpiar un punto-mes YA GUARDADO (desempaquetado) aceptando la bandera «Invalid»: devuelve los niveles con los
 * códigos nuevos (mismos valores y banderas crudos) y su resumen, como los guardaría el importador.
 * @param {{niveles: Object<string, {kv, fam: Object<string, {v, m, b}>}>}} guardado  la serie guardada, desempaquetada
 * @returns {{niveles, resumen, conteos}}
 */
export function reprocesarGuardado(guardado) {
  const p = procesarPuntoMes({}, guardado, 'completar', { aceptarInvalid: true });
  return { niveles: p.niveles, resumen: p.resumen, conteos: p.conteos };
}
