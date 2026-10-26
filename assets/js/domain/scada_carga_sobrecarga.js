// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · sobrecarga sostenida POR DEVANADO (dominio puro) · 2026-10-26
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero: «ubique los equipos sobrecargados, sea el devanado primario, secundario o terciario; hay equipos
// sobrecargados que no estás catalogando». La lista decía «Sobrecarga sostenida» sin decir el devanado, contaba solo las
// firmes y no evaluaba a los equipos medidos por un circuito sin confirmar. Aquí, por fila de la lista:
//   · tipo: 'firme' (cifra firme) · 'posible' (cifra provisional) · 'circuito' (sin cifra: el punto es un circuito que falta
//     confirmar; si es su única salida, su corriente es la del transformador) · null (sin sobrecarga sostenida);
//   · devanados: cuáles pasan del 100 % durante ≥ 2 h seguidas, con su nivel medido y su máximo sostenido.
// Las compuertas son las MISMAS de `calcularEquipo` (`99 §129`): devanado asignado, cifra del nivel válida, ampacidad, sin
// horas imposibles (> 3 × ampacidad) y el medio paso de redondeo del resumen. Los niveles que la curva del mes decidió
// (`aplicarVerificacion`) llegan en `sobrecargaCurva`. No cambia ninguna cifra ni ninguna marca de antes: solo las nombra.
// Funciones PURAS. Archivo NUEVO a propósito (L-102): solo importa exportaciones ya publicadas.
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO, NIVELES, DEVANADO } from './scada_carga_config.js';

const ORDEN = { P: 0, S: 1, T: 2 };
const SOBRE = () => CALCULO.sobrecargaPct;
const TOPE = () => CALCULO.topeFisicoXAmpacidad * 100;
const tol = (n) => (100 * 0.0005) / n.A;
const nivelValido = (n) => !!(n && n.devanado && n.pct != null && n.A > 0 && (n.picoPct == null || n.picoPct + tol(n) <= TOPE()));
const pasa = (n) => n.sostenidaPct != null && n.sostenidaPct - tol(n) > SOBRE();

/** El equipo no tiene cifra porque su punto es un circuito sin confirmar (la misma rama de `calcularEquipo`). */
export function esCircuitoSinConfirmar(x) {
  return !!(x && x.pct == null && x.esCircuito && x.estado !== 'confirmada' && x.estado !== 'excluida' && x.estado !== 'sin_homologacion');
}

/**
 * La sobrecarga sostenida de UNA fila de un mes (de `filasLista`, ya verificada si hizo falta).
 * @returns {null | {tipo: 'firme'|'posible'|'circuito', devanados: Array<{devanado, nombre, nivel, etiqueta, pct: number|null, curva?: boolean}>}}
 *   pct = máximo sostenido 2 h en % de la ampacidad (null si lo decidió la curva del mes).
 */
export function sobrecargaDeMes(x) {
  if (!x) return null;
  const circuito = esCircuitoSinConfirmar(x);
  const devs = ((x.niveles || []).filter((n) => nivelValido(n) && pasa(n)))
    .map((n) => ({ devanado: n.devanado, nombre: DEVANADO[n.devanado], nivel: n.nivel, etiqueta: (NIVELES[n.nivel] || {}).etiqueta || n.nivel, pct: n.sostenidaPct }));
  for (const c of x.sobrecargaCurva || []) {
    if (!c || !c.devanado || devs.some((d) => d.devanado === c.devanado)) continue;
    devs.push({ devanado: c.devanado, nombre: DEVANADO[c.devanado], nivel: c.nivel, etiqueta: (NIVELES[c.nivel] || {}).etiqueta || c.nivel, pct: null, curva: true });
  }
  let tipo = null;
  if (x.sobrecargaSostenida) tipo = 'firme';
  else if (x.sobrecargaProvisional) tipo = 'posible';
  else if (circuito && devs.length) tipo = 'circuito';
  if (!tipo) return null;
  return { tipo, devanados: devs.sort((a, b) => ORDEN[a.devanado] - ORDEN[b.devanado]) };
}

/**
 * La sobrecarga de un PERIODO, por devanado, con las filas de cada mes del equipo (las de la lista, ya verificadas).
 * El tipo sale de las marcas de la fila del periodo (firme/posible, como hasta hoy); 'circuito' si el equipo no tiene
 * cifra por ser un circuito sin confirmar y algún mes pasó del 100 %.
 * @param {object} filaPeriodo  sobrecargaSostenida / sobrecargaProvisional / pct / esCircuito / estado
 * @param {Array<object|null>} filasMes
 * @returns {null | {tipo, meses: number, devanados: Array<{devanado, nombre, nivel, etiqueta, meses: number, pct: number|null}>}}
 */
export function sobrecargaDelPeriodo(filaPeriodo, filasMes) {
  const por = {}; let meses = 0;
  for (const x of filasMes || []) {
    const s = sobrecargaDeMes(x);
    if (!s || !s.devanados.length) continue;
    meses++;
    for (const d of s.devanados) {
      const g = por[d.devanado] || (por[d.devanado] = { devanado: d.devanado, nombre: d.nombre, nivel: d.nivel, etiqueta: d.etiqueta, meses: 0, pct: null });
      g.meses++;
      if (d.pct != null && (g.pct == null || d.pct > g.pct)) Object.assign(g, { pct: d.pct, nivel: d.nivel, etiqueta: d.etiqueta });
    }
  }
  let tipo = null;
  if (filaPeriodo && filaPeriodo.sobrecargaSostenida) tipo = 'firme';
  else if (filaPeriodo && filaPeriodo.sobrecargaProvisional) tipo = 'posible';
  else if (esCircuitoSinConfirmar(filaPeriodo) && meses) tipo = 'circuito';
  if (!tipo) return null;
  return { tipo, meses, devanados: Object.values(por).sort((a, b) => b.meses - a.meses || ORDEN[a.devanado] - ORDEN[b.devanado]) };
}

/** ¿La fila entra en «con sobrecarga sostenida»? (firme, posible o por un circuito sin confirmar). Con guarda: una fila
 * de un dominio viejo en caché no trae `sobrecarga` y cuenta como antes. */
export function tieneSobrecarga(x) {
  return !!(x && (x.sobrecargaSostenida || x.sobrecargaProvisional || (x.sobrecarga && x.sobrecarga.tipo)));
}

/** Cuántas filas hay de cada tipo. */
export function conteoSobrecarga(filas) {
  const c = { firme: 0, posible: 0, circuito: 0, total: 0 };
  for (const x of filas || []) {
    const t = x && x.sobrecarga && x.sobrecarga.tipo ? x.sobrecarga.tipo
      : (x && x.sobrecargaSostenida ? 'firme' : (x && x.sobrecargaProvisional ? 'posible' : null));
    if (!t) continue;
    c[t]++; c.total++;
  }
  return c;
}

const pctTxt = (v) => (v == null ? null : v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %');
const listaY = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);

/**
 * Dónde está la sobrecarga, en palabras: «en el secundario 13,8 kV (hasta 121,8 %)» · en un periodo, con sus meses:
 * «secundario 13,8 kV en 9 meses (hasta 106,2 %) y primario 34,5 kV en 2 meses (hasta 109,8 %)». Vacío si no hay devanados.
 */
export function textoDevanados(s) {
  if (!s || !s.devanados || !s.devanados.length) return '';
  const periodo = s.meses != null;
  const partes = s.devanados.map((d) => {
    const base = d.nombre.toLowerCase() + ' ' + d.etiqueta;
    const hasta = d.pct != null ? 'hasta ' + pctTxt(d.pct) : (d.curva ? 'confirmada con la curva del mes' : null);
    if (periodo) return base + ' en ' + d.meses + (d.meses === 1 ? ' mes' : ' meses') + (hasta ? ' (' + hasta + ')' : '');
    return base + (hasta ? ' (' + hasta + ')' : '');
  });
  return (periodo ? '' : 'en el ') + listaY(periodo ? partes : partes.map((p, i) => (i === 0 ? p : 'el ' + p)));
}
