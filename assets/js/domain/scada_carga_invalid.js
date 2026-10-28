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
import { BANDERA, CODIGO, FAMILIAS_I } from './scada_carga_config.js';

/** Versión de la marca que el lector de archivos declara (`importar-mes.js` detiene un lector viejo en caché). */
export const VERSION_INVALID = 1;

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
 * Comprueba un punto-mes limpiado CON la marca y deja el rastro en su resumen. Con la marca, ninguna hora con bandera
 * «Invalid» puede quedar como hueco por la bandera: si queda, el limpiador de la pestaña es de una versión anterior (caché
 * del navegador) y se detiene en vez de guardar en silencio lo de siempre. Cada nivel del resumen lleva `invalidAceptadas`
 * (horas con alguna corriente «Invalid» que se tomaron como buenas). Modifica y devuelve `p`.
 * @param {{niveles: Object, resumen: Object}} p  el resultado de `procesarPuntoMes(…, {aceptarInvalid: true})`
 */
export function conMarcaInvalid(p) {
  for (const [nv, x] of Object.entries((p && p.niveles) || {})) {
    const fams = FAMILIAS_I.map((f) => x.fam && x.fam[f]).filter(Boolean);
    const n = fams.length ? fams[0].m.length : 0;
    let aceptadas = 0;
    for (let h = 0; h < n; h++) {
      let invalid = false; let aceptada = false;
      for (const s of fams) {
        if (s.b[h] !== BANDERA.INVALID) continue;
        invalid = true;
        if (s.m[h] === CODIGO.BANDERA) {
          throw new Error('El limpiador de esta pestaña es de una versión anterior y no aplica la bandera «Invalid» no confiable: recargue la página (Cmd+Shift+R) y vuelva a intentarlo.');
        }
        aceptada = true;
      }
      if (invalid && aceptada) aceptadas++;
    }
    if (p.resumen && p.resumen[nv]) p.resumen[nv] = { ...p.resumen[nv], invalidAceptadas: aceptadas };
  }
  return p;
}

/**
 * Vuelve a limpiar un punto-mes YA GUARDADO (desempaquetado) aceptando la bandera «Invalid»: devuelve los niveles con los
 * códigos nuevos (mismos valores y banderas crudos) y su resumen, como los guardaría el importador.
 * @param {{niveles: Object<string, {kv, fam: Object<string, {v, m, b}>}>}} guardado  la serie guardada, desempaquetada
 * @returns {{niveles, resumen, conteos}}
 */
export function reprocesarGuardado(guardado) {
  const p = conMarcaInvalid(procesarPuntoMes({}, guardado, 'completar', { aceptarInvalid: true }));
  return { niveles: p.niveles, resumen: p.resumen, conteos: p.conteos };
}
