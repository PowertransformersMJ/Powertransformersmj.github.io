// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · sobrecarga sostenida POR DEVANADO (dominio puro) · 2026-10-26
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero: «ubique los equipos sobrecargados, sea el devanado primario, secundario o terciario; hay equipos
// sobrecargados que no estás catalogando». La lista decía «Sobrecarga sostenida» sin decir el devanado, contaba solo las
// firmes y no evaluaba a los equipos medidos por un circuito sin confirmar. Aquí, por fila de la lista:
//   · tipo: 'firme' (cifra firme) · 'posible' (cifra provisional) · 'circuito' (sin cifra: el punto es un circuito que falta
//     confirmar; si es su única salida, su corriente es la del transformador) · 'sin_cifra' (solo en un PERIODO sin cifra
//     —escala sospechosa, falta preparar un mes…— cuyos meses sí marcaron sobrecarga; no se le llama «provisional» porque
//     sus meses pudieron ser firmes) · null (sin sobrecarga sostenida);
//   · devanados: cuáles pasan del 100 % durante ≥ 2 h seguidas, con su nivel medido y su máximo sostenido (uno por devanado).
// Las compuertas son las MISMAS de `calcularEquipo` (`99 §129`): devanado asignado, cifra del nivel válida, ampacidad, sin
// horas imposibles (> 3 × ampacidad) y el medio paso de redondeo del resumen. Los niveles que la curva del mes decidió
// (`aplicarVerificacion`) llegan en `sobrecargaCurva`. No cambia ninguna cifra ni ninguna marca de antes: solo las nombra.
// Revisión adversarial (2026-10-26): periodo sin cifra ≠ provisional, un devanado una vez por mes, la curva se dice.
// Funciones PURAS. Archivo NUEVO a propósito (L-102): solo importa exportaciones ya publicadas.
// ══════════════════════════════════════════════════════════════════════════════

import { CALCULO, NIVELES, DEVANADO } from './scada_carga_config.js';

const ORDEN = { P: 0, S: 1, T: 2 };
const SOBRE = () => CALCULO.sobrecargaPct;
const TOPE = () => CALCULO.topeFisicoXAmpacidad * 100;
const tol = (n) => (100 * 0.0005) / n.A;
const nivelValido = (n) => !!(n && n.devanado && n.pct != null && n.A > 0 && (n.picoPct == null || n.picoPct + tol(n) <= TOPE()));
const pasa = (n) => n.sostenidaPct != null && n.sostenidaPct - tol(n) > SOBRE();
const etiquetaNivel = (nv) => (NIVELES[nv] || {}).etiqueta || nv;

/** El equipo no tiene cifra porque su punto es un circuito sin confirmar (la misma rama de `calcularEquipo`). */
export function esCircuitoSinConfirmar(x) {
  return !!(x && x.pct == null && x.esCircuito && x.estado !== 'confirmada' && x.estado !== 'excluida' && x.estado !== 'sin_homologacion');
}

/**
 * La sobrecarga sostenida de UNA fila de un mes (de `filasLista`, ya verificada si hizo falta).
 * @returns {null | {tipo: 'firme'|'posible'|'circuito', devanados: Array<{devanado, nombre, nivel, etiqueta, pct: number|null, curva?: boolean}>}}
 *   pct = máximo sostenido 2 h en % de la ampacidad (null si lo decidió la curva del mes). Un devanado aparece UNA vez
 *   (si dos niveles van al mismo devanado, manda el de mayor máximo sostenido).
 */
export function sobrecargaDeMes(x) {
  if (!x) return null;
  const circuito = esCircuitoSinConfirmar(x);
  const por = {};
  for (const n of (x.niveles || []).filter((y) => nivelValido(y) && pasa(y))) {
    const g = por[n.devanado];
    if (g && g.pct >= n.sostenidaPct) continue;
    por[n.devanado] = { devanado: n.devanado, nombre: DEVANADO[n.devanado], nivel: n.nivel, etiqueta: etiquetaNivel(n.nivel), pct: n.sostenidaPct };
  }
  for (const c of x.sobrecargaCurva || []) {
    if (!c || !c.devanado || por[c.devanado]) continue;
    por[c.devanado] = { devanado: c.devanado, nombre: DEVANADO[c.devanado], nivel: c.nivel, etiqueta: etiquetaNivel(c.nivel), pct: null, curva: true };
  }
  const devs = Object.values(por).sort((a, b) => ORDEN[a.devanado] - ORDEN[b.devanado]);
  let tipo = null;
  if (x.sobrecargaSostenida) tipo = 'firme';
  else if (x.sobrecargaProvisional) tipo = 'posible';
  else if (circuito && devs.length) tipo = 'circuito';
  if (!tipo) return null;
  return { tipo, devanados: devs };
}

/**
 * La sobrecarga de un PERIODO, por devanado, con las filas de cada mes del equipo (las de la lista, ya verificadas).
 * El tipo sale de las marcas de la fila del periodo (firme/posible, como hasta hoy); 'sin_cifra' si el periodo no tiene
 * cifra y sus meses sí marcaron sobrecarga; 'circuito' si no la tiene por ser un circuito sin confirmar y algún mes pasó
 * del 100 %. Cuenta también de qué clase fue cada mes con sobrecarga (firme · posible · circuito).
 * @param {object} filaPeriodo  sobrecargaSostenida / sobrecargaProvisional / pct / esCircuito / estado
 * @param {Array<object|null>} filasMes
 * @returns {null | {tipo, meses: number, porClase: {firme, posible, circuito}, devanados: Array<{devanado, nombre, nivel,
 *   etiqueta, meses: number, pct: number|null, mesesCurva: number}>}}
 */
export function sobrecargaDelPeriodo(filaPeriodo, filasMes) {
  const por = {}; let meses = 0; const porClase = { firme: 0, posible: 0, circuito: 0 };
  for (const x of filasMes || []) {
    const s = sobrecargaDeMes(x);
    if (!s) continue;
    meses++; porClase[s.tipo]++;
    for (const d of s.devanados) {   // uno por devanado en el mes (sobrecargaDeMes ya los junta)
      const g = por[d.devanado] || (por[d.devanado] = { devanado: d.devanado, nombre: d.nombre, nivel: d.nivel, etiqueta: d.etiqueta, meses: 0, pct: null, mesesCurva: 0 });
      g.meses++;
      if (d.curva) g.mesesCurva++;
      if (d.pct != null && (g.pct == null || d.pct > g.pct)) Object.assign(g, { pct: d.pct, nivel: d.nivel, etiqueta: d.etiqueta });
    }
  }
  const f = filaPeriodo || {};
  let tipo = null;
  if (esCircuitoSinConfirmar(f)) tipo = meses ? 'circuito' : null;
  else if (f.pct == null) tipo = f.sobrecargaSostenida || f.sobrecargaProvisional ? 'sin_cifra' : null;
  else if (f.sobrecargaSostenida) tipo = 'firme';
  else if (f.sobrecargaProvisional) tipo = 'posible';
  if (!tipo) return null;
  return { tipo, meses, porClase, devanados: Object.values(por).sort((a, b) => b.meses - a.meses || ORDEN[a.devanado] - ORDEN[b.devanado]) };
}

/** El tipo de la fila; una fila de un dominio viejo en caché (sin `sobrecarga`) se clasifica por sus marcas de siempre. */
function tipoDe(x) {
  if (!x) return null;
  if (x.sobrecarga && x.sobrecarga.tipo) return x.sobrecarga.tipo;
  if (x.sobrecarga === null) return null;
  if (x.sobrecargaSostenida) return 'firme';
  if (x.sobrecargaProvisional) return x.pct == null ? 'sin_cifra' : 'posible';
  return null;
}

/** ¿La fila entra en «con sobrecarga sostenida»? (firme, posible, periodo sin cifra o circuito sin confirmar). */
export function tieneSobrecarga(x) {
  return !!(x && (x.sobrecargaSostenida || x.sobrecargaProvisional || (x.sobrecarga && x.sobrecarga.tipo)));
}

/** Cuántas filas hay de cada tipo. */
export function conteoSobrecarga(filas) {
  const c = { firme: 0, posible: 0, sin_cifra: 0, circuito: 0, total: 0 };
  for (const x of filas || []) {
    const t = tipoDe(x) || (tieneSobrecarga(x) ? 'firme' : null);
    if (!t) continue;
    c[t]++; c.total++;
  }
  return c;
}

const pctTxt = (v) => (v == null ? null : v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %');
const listaY = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);
const nMeses = (n) => n + (n === 1 ? ' mes' : ' meses');

/**
 * Dónde está la sobrecarga, en palabras: «en el secundario 13,8 kV (hasta 121,8 %)» · en un periodo, con sus meses:
 * «secundario 13,8 kV en 9 meses (hasta 106,2 %) y primario 34,5 kV en 2 meses (hasta 109,8 %)». Vacío si no hay devanados.
 * Con `{ csv: true }`: sin artículos, separados por «; » (una celda de hoja de cálculo).
 */
export function textoDevanados(s, { csv = false } = {}) {
  if (!s || !s.devanados || !s.devanados.length) return '';
  const periodo = s.meses != null;
  const partes = s.devanados.map((d) => {
    const base = d.nombre.toLowerCase() + ' ' + d.etiqueta;
    const det = [];
    if (d.pct != null) det.push('hasta ' + pctTxt(d.pct));
    if (periodo && d.mesesCurva) det.push(d.pct == null ? 'confirmada con la curva' : d.mesesCurva + (d.mesesCurva === 1 ? ' mes confirmado' : ' meses confirmados') + ' con la curva');
    else if (!periodo && d.curva) det.push('confirmada con la curva del mes');
    return base + (periodo ? ' en ' + nMeses(d.meses) : '') + (det.length ? ' (' + det.join('; ') + ')' : '');
  });
  if (csv) return partes.join('; ');
  return (periodo ? '' : 'en el ') + listaY(periodo ? partes : partes.map((p, i) => (i === 0 ? p : 'el ' + p)));
}

/** De qué clase fueron los meses con sobrecarga: «2 con cifra provisional» · «3 con cifra firme y 1 con cifra provisional». */
function textoClases(pc) {
  if (!pc) return '';
  const t = [];
  if (pc.firme) t.push(pc.firme + ' con cifra firme');
  if (pc.posible) t.push(pc.posible + ' con cifra provisional');
  if (pc.circuito) t.push(pc.circuito + ' medido' + (pc.circuito === 1 ? '' : 's') + ' por un circuito');
  return listaY(t);
}

/**
 * El rótulo de la lista para la sobrecarga de una fila (mes o periodo), o null si no tiene.
 * @returns {null | {tipo, texto: string, nota: string|null, severo: boolean}}  severo = va con color (solo lo FIRME)
 */
export function rotuloSobrecarga(x) {
  const tipo = tipoDe(x);
  if (!tipo) return null;
  const s = x.sobrecarga || null;
  const regla = '(≥ ' + CALCULO.sobrecargaMinH + ' h sobre el ' + CALCULO.sobrecargaPct + ' %)';
  const t = textoDevanados(s);
  const donde = t ? (s.meses != null ? ': ' + t : ' ' + t) : '';
  const n = x.periodo ? (s && s.meses != null && tipo !== 'firme' && tipo !== 'posible' ? s.meses : x.periodo.mesesSostenida) : null;
  const enMeses = n != null ? ' en ' + nMeses(n) : '';
  const pc = s && s.porClase;
  if (tipo === 'firme') return { tipo, texto: 'Sobrecarga sostenida ' + regla + enMeses + donde, nota: null, severo: true };
  if (tipo === 'posible') {
    // El periodo es provisional; si en algún mes la cifra fue firme, se dice (sus meses son lo que se puede abrir).
    const firmes = pc && pc.firme ? ' (' + textoClases(pc) + ')' : '';
    return { tipo, texto: 'Posible sobrecarga sostenida (cifra provisional)' + enMeses + firmes + donde, nota: null, severo: false };
  }
  if (tipo === 'sin_cifra') {
    return { tipo, texto: 'Sobrecarga sostenida ' + regla + enMeses + (pc ? ' (' + textoClases(pc) + ')' : '') + donde,
      nota: 'El periodo no tiene cifra; la sobrecarga sale de sus meses (véalos en «Ver curvas»).', severo: false };
  }
  return { tipo, texto: 'Posible sobrecarga sostenida ' + regla + donde,
    nota: 'Por confirmar: se mide un circuito; vale si es la única salida del transformador.', severo: false };
}

/** Las dos columnas del CSV: tipo y devanados (vacías si la fila no tiene sobrecarga). */
export const CSV_SOBRECARGA_CAB = ['Sobrecarga_sostenida_tipo', 'Sobrecarga_sostenida_devanados'];
const TIPO_CSV = { firme: 'firme', posible: 'posible (cifra provisional)', sin_cifra: 'periodo sin cifra (meses con sobrecarga)', circuito: 'por confirmar (se mide un circuito)' };
export function csvSobrecarga(x) {
  const tipo = tipoDe(x);
  return tipo ? [TIPO_CSV[tipo], textoDevanados(x.sobrecarga, { csv: true })] : ['', ''];
}
