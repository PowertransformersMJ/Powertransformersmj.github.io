// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Dominio puro: «Diagnóstico de condición» de la
// ventana de detalle de Cargabilidad
// ──────────────────────────────────────────────────────────────
// Decisión del Ingeniero (2026-10-01, `99 §124`): el panel muestra las
// calificaciones de SALUD DE ACTIVOS del equipo. Son las siete del
// MO.00418 que ya muestra la página de Salud de Activos, con el MISMO
// mapeo del registro (`parque_salud.js`: DGA y ADFQ son las evaluaciones
// compuestas `eval_*`, el resto `calif_*`), en su mismo orden, con la
// escala oficial (Tabla 11: 1 Muy Bueno … 5 Muy Pobre, `schema.js`) y
// «—» cuando no hay dato. Nada se calcula ni se rellena aquí.
//
// Archivo NUEVO a propósito (L-102): una exportación nueva en un módulo
// ya publicado puede chocar con su copia vieja en la caché del navegador.
// ══════════════════════════════════════════════════════════════

import { CONDICIONES } from './schema.js';

/** Las siete variables, en el orden y con los nombres de Salud de Activos. */
export const VARIABLES_SALUD = Object.freeze([
  Object.freeze({ k: 'dga',  nombre: 'DGA' }),
  Object.freeze({ k: 'edad', nombre: 'Edad' }),
  Object.freeze({ k: 'adfq', nombre: 'ADFQ' }),
  Object.freeze({ k: 'fur',  nombre: 'Furanos' }),
  Object.freeze({ k: 'crg',  nombre: 'Cargabilidad' }),
  Object.freeze({ k: 'pyt',  nombre: 'Protec. & TC' }),
  Object.freeze({ k: 'her',  nombre: 'Hermeticidad' }),
]);

// Forma vieja: el grupo `diag` del archivo retirado (la usa la vista previa
// de desarrollo). Sin ADFQ ni P&T.
const DESDE_DIAG = Object.freeze({ dga: 'dga', edad: 'edad', fur: 'fur', crg: 'carg', her: 'herm' });

function calificacion(v) {
  const n = (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) ? Number(v) : NaN;
  // Fuera de la escala 1–5 no es una calificación: no se muestra como tal.
  return (Number.isFinite(n) && n >= 1 && n <= 5) ? n : null;
}

/**
 * Calificaciones de Salud de Activos de una fila del tablero.
 * @param {object} d fila de `filaCargabilidad` (trae `salud`) o de la forma vieja (`diag`)
 * @returns {Array<{k:string, nombre:string, valor:number|null, texto:string, color:string|null}>}
 */
export function calificacionesDe(d) {
  const salud = d && d.salud && typeof d.salud === 'object' ? d.salud : null;
  const diag = !salud && d && d.diag && typeof d.diag === 'object' ? d.diag : null;
  return VARIABLES_SALUD.map(({ k, nombre }) => {
    const bruto = salud ? salud[k] : (diag && DESDE_DIAG[k] ? diag[DESDE_DIAG[k]] : null);
    const valor = calificacion(bruto);
    const c = valor == null ? null : CONDICIONES.find((x) => x.value === Math.round(valor));
    return { k, nombre, valor, texto: c ? c.label : '—', color: c ? c.color : null };
  });
}
