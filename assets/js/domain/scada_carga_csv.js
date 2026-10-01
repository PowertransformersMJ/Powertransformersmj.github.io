// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · lectura de los CSV del exporte (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Formato medido de los exportes diarios:
//   · encabezado: celda vacía + 24 columnas 'd/mm/aa H:mm' (0:00 … 23:00) de UNA fecha;
//   · fila: clave de ancho fijo '/<estación>/<nivel>/<elemento>/<variable>/<tipo>' + 24 celdas;
//   · celdas numéricas (con notación científica), 'null' antes de que exista un punto, o —en los
//     archivos de calidad— el texto de la bandera ('Actual', 'Invalid', …).
// Reglas que salen de lo medido (no del nombre del archivo):
//   · la FECHA REAL es la del encabezado (carpetas y nombres traen fechas equivocadas);
//   · la VARIABLE REAL es el token dentro de la clave (dos archivos traen otra variable);
//   · los nombres de estación vienen truncados a 8 caracteres y con espacios a la derecha.
// Funciones PURAS: cero DOM, cero Firebase. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { NIVELES, TOKEN_FAMILIA, TEXTO_BANDERA, BANDERA } from './scada_carga_config.js';

/** Texto comparable: NFC, sin espacios a los lados, minúsculas. */
export function normalizarTexto(s) {
  return String(s == null ? '' : s).normalize('NFC').trim().toLowerCase();
}

/** Parte segura para un id de Firestore: ASCII, sin tildes, solo [A-Za-z0-9_-]. */
export function idAscii(s, max = 40) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
}

/**
 * Id estable de un punto (estación + elemento), sin el nivel: abarca todos sus niveles.
 * En minúsculas: la homologación y el exporte pueden escribir la estación con otra capitalización.
 */
export function claveId(est, elem) {
  return idAscii(normalizarTexto(est)) + '__' + idAscii(normalizarTexto(elem));
}

/** Nivel normalizado ('N13_8', 'N34_5', …) desde '13.8kV', '34KV', '110 kV'; null si no se reconoce. */
export function nivelDe(texto) {
  const m = String(texto || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*k\s*v/i);
  if (!m) return null;
  const kv = Number(m[1]);
  if (Math.abs(kv - 13.8) < 0.05) return 'N13_8';
  if (Math.abs(kv - 34.5) < 0.05 || kv === 34) return 'N34_5';
  for (const [id, n] of Object.entries(NIVELES)) if (Math.abs(kv - n.kv) < 0.05) return id;
  return null;
}

/** ¿El elemento es un transformador del SCADA (swTrafoN, swTrfN, swAutoN…)? */
export function esElementoTransformador(elem) {
  return /^sw(tr|auto)/i.test(String(elem || '').trim());
}

/**
 * Analiza la clave de una fila. Devuelve {est, nivelTexto, nivel, elem, token, familia} o null.
 * No exige el último segmento (tipo de medida): basta con la estructura de 6 partes.
 */
export function analizarClaveFila(clave) {
  const p = String(clave || '').split('/');
  if (p.length < 6 || p[0].trim() !== '') return null;
  const est = p[1].trim();
  const nivelTexto = p[2].trim();
  const elem = p[3].trim();
  const token = p[4].replace(/\s+/g, ' ').trim();
  if (!est || !elem || !token) return null;
  return { est, nivelTexto, nivel: nivelDe(nivelTexto), elem, token, familia: TOKEN_FAMILIA[token] || null };
}

/** Estadístico que dice el NOMBRE del archivo (average/current/max/min/quality), o null. */
export function estadisticoDeNombre(nombre) {
  const m = String(nombre || '').toLowerCase().match(/(average|current|max|min|quality)/);
  return m ? m[1] : null;
}

/** Fecha AAAAMMDD que dice el nombre del archivo (solo para el diagnóstico), o null. */
export function fechaDeNombre(nombre) {
  const m = String(nombre || '').match(/(20\d{2})(\d{2})(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

/** Fecha que dice la carpeta de día ('07Agosto', '25julio'), con el año dado, o null. */
export function fechaDeCarpeta(ruta, anio) {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  for (const parte of String(ruta || '').split('/').reverse()) {
    const m = parte.match(/^(\d{1,2})\s*([a-záéíóú]+)$/i);
    if (!m) continue;
    const mes = MESES.indexOf(normalizarTexto(m[2]).normalize('NFD').replace(/[̀-ͯ]/g, '')) + 1;
    if (mes > 0 && anio) return anio + '-' + String(mes).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
  }
  return null;
}

/**
 * Encabezado del exporte → fecha real. Exige 24 columnas de UNA fecha con las horas 0..23.
 * @returns {{ok: true, anio, mes, dia, fecha: 'AAAA-MM-DD'} | {ok: false, motivo}}
 */
export function fechaDeEncabezado(linea) {
  const c = String(linea || '').replace(/^﻿/, '').replace(/\r$/, '').split(',');
  if (c.length !== 25 || c[0].trim() !== '') return { ok: false, motivo: 'encabezado sin 24 horas' };
  let fecha = null;
  for (let h = 0; h < 24; h++) {
    const m = c[h + 1].trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})$/);
    if (!m || +m[4] !== h || +m[5] !== 0) return { ok: false, motivo: 'horas fuera de orden' };
    const anio = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const f = anio + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
    if (fecha && f !== fecha) return { ok: false, motivo: 'más de una fecha' };
    fecha = f;
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > new Date(Date.UTC(anio, mes, 0)).getUTCDate()) return { ok: false, motivo: 'fecha imposible' };
  return { ok: true, anio, mes, dia, fecha };
}

/** Una celda numérica → número (Float32, determinista) o NaN si está vacía, es 'null' o no es número. */
export function valorDeCelda(txt) {
  const t = String(txt == null ? '' : txt).trim();
  if (t === '' || /^null$/i.test(t)) return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? Math.fround(v) : NaN;
}

/** Una celda de calidad → código de bandera (1 Actual … 7 otra). */
export function banderaDeCelda(txt) {
  const t = normalizarTexto(txt);
  if (!t) return BANDERA.OTRA;
  return TEXTO_BANDERA[t] || BANDERA.OTRA;
}

/** ¿El contenido de un archivo es de calidad (textos de bandera) aunque el nombre no lo diga? */
export function pareceCalidad(celdas) {
  const muestra = celdas.slice(0, 6).map(normalizarTexto);
  return muestra.some((t) => TEXTO_BANDERA[t] != null);
}

/**
 * Lee un archivo del exporte y entrega SOLO las filas del objetivo.
 * @param {string} texto  contenido completo
 * @param {{quiere: (est: string, elem: string) => boolean}} objetivo
 *        `est` y `elem` llegan normalizados (normalizarTexto)
 * @param {{estadistico?: string|null}} op  el que dice el nombre (average | quality)
 * @returns {{ok, motivo?, fecha?, tipo: 'average'|'quality', filas: Array<{est, elem, nivel, nivelTexto, familia,
 *           valores?: Float32Array, banderas?: Uint8Array}>, conteo: {filas, objetivo, sinFamilia, sinNivel}}}
 */
export function leerArchivo(texto, objetivo, op = {}) {
  const lineas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/);
  const cab = fechaDeEncabezado(lineas[0] || '');
  const conteo = { filas: 0, objetivo: 0, sinFamilia: 0, sinNivel: 0 };
  if (!cab.ok) return { ok: false, motivo: cab.motivo, filas: [], conteo, tipo: op.estadistico || null };
  let tipo = op.estadistico === 'quality' ? 'quality' : 'average';
  const filas = [];
  for (let i = 1; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l) continue;
    conteo.filas++;
    const coma = l.indexOf(',');
    if (coma < 0) continue;
    // La estación se mira ANTES de partir la fila entera (la mayoría de filas no son del objetivo).
    const clave = l.slice(0, coma);
    const segs = clave.split('/');
    if (segs.length < 6) continue;
    const est = normalizarTexto(segs[1]);
    const elem = normalizarTexto(segs[3]);
    if (!objetivo.quiere(est, elem)) continue;
    const k = analizarClaveFila(clave);
    if (!k) continue;
    conteo.objetivo++;
    if (!k.familia) { conteo.sinFamilia++; continue; }
    if (!k.nivel) { conteo.sinNivel++; continue; }
    const celdas = l.slice(coma + 1).split(',');
    if (celdas.length < 24) continue;
    if (op.estadistico == null && filas.length === 0 && pareceCalidad(celdas)) tipo = 'quality';
    const fila = { est: k.est, elem: k.elem, nivel: k.nivel, nivelTexto: k.nivelTexto, familia: k.familia };
    if (tipo === 'quality') {
      const b = new Uint8Array(24);
      for (let h = 0; h < 24; h++) b[h] = banderaDeCelda(celdas[h]);
      fila.banderas = b;
    } else {
      const v = new Float32Array(24);
      for (let h = 0; h < 24; h++) v[h] = valorDeCelda(celdas[h]);
      fila.valores = v;
    }
    filas.push(fila);
  }
  return { ok: true, fecha: cab.fecha, anio: cab.anio, mes: cab.mes, dia: cab.dia, tipo, filas, conteo };
}
