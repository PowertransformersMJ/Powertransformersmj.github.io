// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · series mensuales (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Una serie mensual guarda, por hora ROTULADA del mes (idx = (día−1)·24 + hora del rótulo):
//   v = valor crudo (Float32, little-endian en Bytes) · m = código de limpieza · b = bandera SCADA.
// Convención horaria MEDIDA: el promedio rotulado H es la hora que TERMINA en H, o sea el
// intervalo [H−1, H) en hora de Colombia (UTC−5 fijo, sin horario de verano). Se guarda por el
// rótulo y se interpreta al mostrar: si la convención cambiara, no hay que volver a cargar.
// Funciones PURAS. Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { CODIGO, TIEMPO } from './scada_carga_config.js';
import { esCentinela } from './scada_carga_limpieza.js';

const H_MS = 3600 * 1000;

/** 'AAAA-MM' → {anio, mes}. */
export function partesMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return { anio: a, mes: m };
}
/** Días del mes. */
export function diasMes(mes) {
  const { anio, mes: m } = partesMes(mes);
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
}
/** Horas rotuladas del mes. */
export function horasMes(mes) { return diasMes(mes) * 24; }
/** Instante (ms) del rótulo 00:00 del día 1 en hora de Colombia. */
export function t0Mes(mes) {
  const { anio, mes: m } = partesMes(mes);
  return Date.UTC(anio, m - 1, 1, TIEMPO.offsetColombiaH);
}
/** Índice de la hora rotulada dentro del mes. */
export function idxDe(dia, hora) { return (dia - 1) * 24 + hora; }
/** Instante (ms) del rótulo idx. */
export function msRotulo(mes, idx) { return t0Mes(mes) + idx * H_MS; }
/** Inicio (ms) del intervalo que representa el rótulo idx, según la convención. */
export function msInicio(mes, idx, convencion = TIEMPO.convencion) {
  return msRotulo(mes, idx) - (convencion === 'fin' ? H_MS : 0);
}
/** Mes 'AAAA-MM' de una fecha 'AAAA-MM-DD'. */
export function mesDeFecha(fecha) { return String(fecha).slice(0, 7); }

/** Serie vacía de n horas: todo «sin archivo». */
export function serieVacia(n) {
  return { v: new Float32Array(n).fill(NaN), b: new Uint8Array(n), presente: new Uint8Array(n) };
}

/** Float32Array → bytes little-endian (Uint8Array). */
export function aBytesF32(arr) {
  const out = new Uint8Array(arr.length * 4);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < arr.length; i++) dv.setFloat32(i * 4, arr[i], true);
  return out;
}
/** bytes little-endian → Float32Array. */
export function deBytesF32(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const n = Math.floor(u8.length / 4);
  const out = new Float32Array(n);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  for (let i = 0; i < n; i++) out[i] = dv.getFloat32(i * 4, true);
  return out;
}

/** Empaqueta una familia limpia ({v, b, m}) para guardarla. */
export function empaquetar(s) {
  return { v: aBytesF32(s.v), m: new Uint8Array(s.m), b: new Uint8Array(s.b) };
}
/** Desempaqueta lo guardado ({v, m, b} en bytes) → {v: Float32Array, m, b}. */
export function desempaquetar(g) {
  const v = deBytesF32(g.v);
  return { v, m: new Uint8Array(g.m), b: new Uint8Array(g.b) };
}

/** ¿Dos empaques son iguales byte a byte? (para no reescribir lo que no cambió) */
export function igualBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Funde lo guardado con lo nuevo a nivel CRUDO (valor, bandera, presencia) para volver a limpiar.
 *   · 'completar' (por defecto): lo nuevo solo entra donde lo guardado no tenía archivo.
 *   · 'reemplazar': lo nuevo sustituye las horas que trae CON VALOR (una celda vacía, «null» o un
 *     valor tope del sistema no es un dato: no pisa lo guardado). Nada se borra.
 * La bandera de calidad nunca se pierde: si una de las dos fuentes no trae archivo de calidad
 * (bandera 0), vale la de la otra (revisión adversarial de §122: una re-exportación sin calidad
 * volvía «válidas» horas que el SCADA había marcado inválidas).
 * @returns {{v, b, presente, conflictos, nuevas}}
 */
export function fusionarCrudo(guardado, nuevo, modo = 'completar') {
  const n = nuevo.v.length;
  const v = new Float32Array(n).fill(NaN);
  const b = new Uint8Array(n);
  const presente = new Uint8Array(n);
  let conflictos = 0; let nuevas = 0;
  for (let h = 0; h < n; h++) {
    const g = guardado && guardado.m && guardado.m[h] !== CODIGO.SIN_ARCHIVO;
    const t = !!nuevo.presente[h];
    if (g) { v[h] = guardado.v[h]; b[h] = guardado.b[h]; presente[h] = 1; }
    if (!t) { if (g && !b[h] && nuevo.b[h]) b[h] = nuevo.b[h]; continue; }   // solo llegó la calidad
    if (!g) { v[h] = nuevo.v[h]; b[h] = nuevo.b[h]; presente[h] = 1; nuevas++; continue; }
    const iguales = (Number.isNaN(v[h]) && Number.isNaN(nuevo.v[h])) || v[h] === nuevo.v[h];
    if (!iguales) conflictos++;
    const conValor = Number.isFinite(nuevo.v[h]) && !esCentinela(nuevo.v[h]);
    if (modo === 'reemplazar' && conValor) { v[h] = nuevo.v[h]; b[h] = nuevo.b[h] || guardado.b[h]; }
    else if (!b[h] && nuevo.b[h] && iguales) b[h] = nuevo.b[h];   // la calidad que llegó después
  }
  return { v, b, presente, conflictos, nuevas };
}

/**
 * Ventana de un mes TAL COMO SE GUARDA (y como la resume el importador): las horas que el SCADA
 * ROTULA en ese mes, de la 00:00 del día 1 a la 23:00 del último día. En inicio de intervalo:
 * [último día del mes anterior 23:00, último día 23:00). La lista y el detalle usan ESTA ventana,
 * así un mismo mes da la misma cifra en los dos (revisión adversarial de §122).
 */
export function ventanaDeMes(mes) {
  return { desde: msInicio(mes, 0), hasta: msInicio(mes, horasMes(mes)) };
}

/**
 * Meses 'AAAA-MM' cuyos documentos guardan alguna hora del rango [desde, hasta) (inicios de
 * intervalo, hora de Colombia). Cada hora vive en el mes de su RÓTULO (= su fin): la primera del
 * rango se rotula en desde + 1 h y la última en hasta. Ni un mes de más (cada uno es una lectura).
 */
export function mesesDelRango(desdeMs, hastaMs) {
  const out = [];
  if (!(hastaMs > desdeMs)) return out;
  const off = TIEMPO.offsetColombiaH * H_MS;
  const d = new Date(desdeMs + H_MS - off);
  let a = d.getUTCFullYear(); let m = d.getUTCMonth() + 1;
  const fin = new Date(hastaMs - off);
  const af = fin.getUTCFullYear(); const mf = fin.getUTCMonth() + 1;
  while (a < af || (a === af && m <= mf)) {
    out.push(a + '-' + String(m).padStart(2, '0'));
    m++; if (m > 12) { m = 1; a++; }
    if (out.length > 240) break;
  }
  return out;
}

/**
 * Une los meses de un rango en series continuas por hora.
 * @param {Object<string, {estado: 'ok'|'no_existe'|'fallo', series?: Object<string, {v, m, b}>}>} porMes
 *        series de UN nivel por familia, ya desempaquetadas
 * @param {number} desdeMs  inicio del rango (inclusive), en ms
 * @param {number} hastaMs  fin del rango (exclusivo)
 * @returns {{t: Float64Array (inicio de cada intervalo), fam: Object<string, {v, m, b}>, mesesFallidos: string[]}}
 *   Horas de un mes que no se pudo leer → código 20; de un mes sin datos → 21 (solo en lectura).
 */
export function recortarRango(porMes, familias, desdeMs, hastaMs) {
  const horas = Math.max(0, Math.round((hastaMs - desdeMs) / H_MS));
  const t = new Float64Array(horas);
  const fam = {};
  for (const f of familias) fam[f] = { v: new Float32Array(horas).fill(NaN), m: new Uint8Array(horas).fill(21), b: new Uint8Array(horas) };
  const mesesFallidos = [];
  for (let k = 0; k < horas; k++) t[k] = desdeMs + k * H_MS;
  for (const [mes, reg] of Object.entries(porMes || {})) {
    const n = horasMes(mes);
    let toca = false;   // un mes que no se pudo leer solo cuenta si alguna de sus horas cae en el rango
    for (let idx = 0; idx < n; idx++) {
      const ini = msInicio(mes, idx);
      const k = Math.round((ini - desdeMs) / H_MS);
      if (k < 0 || k >= horas) continue;
      toca = true;
      for (const f of familias) {
        if (reg && reg.estado === 'fallo') { fam[f].m[k] = 20; continue; }
        const s = reg && reg.estado === 'ok' && reg.series && reg.series[f];
        if (!s) continue;
        fam[f].v[k] = s.v[idx]; fam[f].m[k] = s.m[idx]; fam[f].b[k] = s.b[idx];
      }
    }
    if (toca && reg && reg.estado === 'fallo') mesesFallidos.push(mes);
  }
  return { t, fam, mesesFallidos };
}
