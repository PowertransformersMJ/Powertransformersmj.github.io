// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · Presupuesto CREG (dominio puro)
// ─────────────────────────────────────────────────────────────────────────────
// Calcula el "Valor CREG Total" que va en la Ficha Técnica de Planificación
// (formato EPM PE.02081.PE-FO.03, celda I36) a partir de la Unidad Constructiva
// del catálogo CREG 015 de 2018 (Tablas 51 y 52 → `fichas_creg_uc.js`).
//
// ── REGLA DEL DUEÑO (verificada el 2026-08-15) ───────────────────────────────
//
//   Valor CREG Total = COSTO DE INSTALACIÓN [$ Dic 2007]
//                      + ( POTENCIA DEL PROYECTO [MVA] × VALOR UNITARIO [$/MVA Dic 2007] )
//
// ⚠️ OJO con los nombres, que se prestan a confusión:
//   · La columna "Valor CREG Unitario" de la ficha institucional (celda F36) NO
//     es el $/MVA: lleva el COSTO DE INSTALACIÓN de la UC.
//   · El VALOR UNITARIO [$/MVA] es el que se multiplica por la potencia.
//   · El costo de instalación se suma UNA sola vez — NUNCA × cantidad.
//   · Si la UC no está en el catálogo NO se inventa costo: el total es `null` y
//     el presupuesto queda [PENDIENTE], en lugar de arrastrar cifras de otro
//     equipo a un documento que se firma.
//
// Ambos valores salen de la MISMA fila de la UC: en `fichas_creg_uc.js`,
// `costoUC(codigo)` devuelve `{ inst, porMVA, vig }` — `inst` es el costo de
// instalación y `porMVA` el valor unitario por MVA (pesos de diciembre de 2007,
// que son los VIGENTES para la ficha).
//
// Funciones PURAS: cero Firebase, cero DOM, cero I/O. Importable desde Node
// (tests), desde el navegador (UI) y desde Cloud Functions.
// ═════════════════════════════════════════════════════════════════════════════

import { buscarUC, costoUC, montoCOP } from './fichas_creg_uc.js';

/** Marcador que la ficha imprime cuando falta un dato del presupuesto. */
export const TEXTO_PENDIENTE = '[PENDIENTE]';

/** Motivos por los que un presupuesto queda sin cifra (códigos estables). */
export const MOTIVOS_PENDIENTE = Object.freeze({
  SIN_UC: 'sin_uc',                 // no se indicó ninguna UC
  UC_FUERA_CATALOGO: 'uc_fuera_catalogo', // la UC no existe en Tablas 51/52
  UC_SIN_COSTO: 'uc_sin_costo',     // la UC existe pero su fila no trae cifras
  SIN_POTENCIA: 'sin_potencia'      // falta la potencia del proyecto en MVA
});

const MENSAJE_PENDIENTE = Object.freeze({
  sin_uc: 'No se indicó la Unidad Constructiva del proyecto.',
  uc_fuera_catalogo: 'La UC no está en el catálogo CREG 015/2018 (Tablas 51 y 52).',
  uc_sin_costo: 'La UC está en el catálogo pero su fila no trae costo de instalación y/o valor unitario.',
  sin_potencia: 'Falta la potencia del proyecto en MVA.'
});

// ── Utilidades internas ──────────────────────────────────────────────────────

/**
 * Acepta un número o un monto escrito como en el catálogo ("152.592.000")
 * y devuelve un entero. Cualquier otra cosa ⇒ null.
 */
function aMonto(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return montoCOP(v);
}

/** Potencia en MVA: número finito y estrictamente positivo, o null. */
function aMva(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Formatea un entero en pesos colombianos (1.234.567). Sin símbolo. */
export function formatearCOP(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const e = Math.round(Math.abs(Number(n))).toString();
  const conPuntos = e.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (Number(n) < 0 ? '-' : '') + conPuntos;
}

// ── Cálculo ──────────────────────────────────────────────────────────────────

/**
 * Desglose completo del presupuesto CREG de una línea de inversión.
 *
 * @param {object} entrada
 * @param {string} entrada.uc      código de la Unidad Constructiva (p. ej. "N4T5").
 * @param {number|string} entrada.mva  potencia DEL PROYECTO en MVA.
 * @param {number|string} [entrada.costoInstalacion]  override manual del costo de
 *        instalación (celda F36). Si se omite, sale de la UC.
 * @param {number|string} [entrada.valorUnitarioMVA]  override manual del $/MVA.
 *        Si se omite, sale de la UC.
 * @param {number|string} [entrada.cantidad=1]  cantidad de unidades. Se reporta,
 *        pero NO multiplica el costo de instalación (regla del dueño).
 *
 * @returns {{
 *   uc: string|null, enCatalogo: boolean, descripcion: string|null,
 *   mva: number|null, cantidad: number,
 *   costoInstalacion: number|null, valorUnitarioMVA: number|null,
 *   vigencia: string|null, componentePotencia: number|null,
 *   total: number|null, pendiente: boolean,
 *   motivo: string|null, motivoTexto: string|null, formula: string
 * }}
 */
export function desgloseCreg(entrada = {}) {
  const uc = entrada.uc == null || entrada.uc === '' ? null : String(entrada.uc).trim().toUpperCase();
  const mva = aMva(entrada.mva);
  const cantidad = (() => {
    const c = entrada.cantidad;
    if (c == null || c === '') return 1;
    const n = typeof c === 'number' ? c : parseFloat(String(c).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();

  const hallada = uc ? buscarUC(uc) : null;
  const catalogo = uc ? costoUC(uc) : null;

  const instOverride = aMonto(entrada.costoInstalacion);
  const porMvaOverride = aMonto(entrada.valorUnitarioMVA);

  const costoInstalacion = instOverride != null ? instOverride : (catalogo ? catalogo.inst : null);
  const valorUnitarioMVA = porMvaOverride != null ? porMvaOverride : (catalogo ? catalogo.porMVA : null);
  const vigencia = catalogo ? catalogo.vig : null;

  // ¿Por qué queda pendiente? Se reporta la PRIMERA causa, de la más de fondo
  // a la más superficial, para que el usuario sepa qué corregir.
  let motivo = null;
  if (costoInstalacion == null || valorUnitarioMVA == null) {
    if (!uc) motivo = MOTIVOS_PENDIENTE.SIN_UC;
    else if (!hallada) motivo = MOTIVOS_PENDIENTE.UC_FUERA_CATALOGO;
    else motivo = MOTIVOS_PENDIENTE.UC_SIN_COSTO;
  } else if (mva == null) {
    motivo = MOTIVOS_PENDIENTE.SIN_POTENCIA;
  }

  const ok = motivo === null;
  const componentePotencia = ok ? Math.round(mva * valorUnitarioMVA) : null;
  const total = ok ? Math.round(costoInstalacion + mva * valorUnitarioMVA) : null;

  const formula = ok
    ? `${formatearCOP(costoInstalacion)} + (${mva} MVA × ${formatearCOP(valorUnitarioMVA)} $/MVA) = ${formatearCOP(total)}`
    : `${TEXTO_PENDIENTE} — ${MENSAJE_PENDIENTE[motivo]}`;

  return {
    uc,
    enCatalogo: !!hallada,
    descripcion: hallada ? (hallada.fila.desc || null) : null,
    mva,
    cantidad,
    costoInstalacion,
    valorUnitarioMVA,
    vigencia,
    componentePotencia,
    total,
    pendiente: !ok,
    motivo,
    motivoTexto: ok ? null : MENSAJE_PENDIENTE[motivo],
    formula
  };
}

/**
 * Valor CREG Total de una línea de inversión (celda I36 de la ficha).
 * Devuelve `null` — nunca una cifra inventada — cuando falta la UC en el
 * catálogo o falta la potencia del proyecto.
 *
 * @param {object} entrada — mismos campos que {@link desgloseCreg}.
 * @returns {number|null} pesos de diciembre de 2007, redondeados.
 */
export function valorCregTotal(entrada = {}) {
  return desgloseCreg(entrada).total;
}

/**
 * Total del proyecto = suma de los Valores CREG Total de todas sus líneas.
 * `total` suma SOLO las líneas resueltas; `completo` avisa si alguna quedó
 * [PENDIENTE], para no firmar un presupuesto parcial haciéndolo pasar por
 * completo. Quien lo muestre debe atender esa bandera.
 *
 * @param {Array<object>} lineas — cada una como {@link desgloseCreg}.
 * @returns {{total: number, lineas: object[], completo: boolean, pendientes: number}}
 */
export function totalProyectoCreg(lineas = []) {
  const det = (Array.isArray(lineas) ? lineas : []).map((l) => desgloseCreg(l));
  const pendientes = det.filter((d) => d.pendiente).length;
  return {
    total: det.reduce((s, d) => s + (d.total || 0), 0),
    lineas: det,
    completo: det.length > 0 && pendientes === 0,
    pendientes
  };
}

/**
 * Variación del Valor Real Total contra el Valor CREG Total.
 * Positivo = sobrecosto sobre el reconocimiento CREG; negativo = ahorro.
 *
 * @param {{totalCreg: number|null, valorReal: number|string|null}} datos
 * @returns {{abs: number|null, pct: number|null, sentido: 'sobrecosto'|'ahorro'|'igual'|null, texto: string}}
 */
export function variacionReal({ totalCreg, valorReal } = {}) {
  const creg = aMonto(totalCreg);
  const real = aMonto(valorReal);
  if (real == null) {
    return { abs: null, pct: null, sentido: null, texto: 'Ingrese el Valor Real Total para ver la variación.' };
  }
  if (creg == null || creg === 0) {
    return { abs: null, pct: null, sentido: null, texto: `Falta el Valor CREG Total ${TEXTO_PENDIENTE}.` };
  }
  const abs = real - creg;
  const pct = (abs / creg) * 100;
  const sentido = abs > 0 ? 'sobrecosto' : (abs < 0 ? 'ahorro' : 'igual');
  const etiqueta = abs > 0
    ? 'por encima del valor CREG (sobrecosto)'
    : (abs < 0 ? 'por debajo del valor CREG (ahorro)' : 'igual al valor CREG');
  const signo = abs > 0 ? '+' : '';
  const pctTxt = `${signo}${(Math.round(pct * 10) / 10).toString().replace('.', ',')}%`;
  return { abs, pct, sentido, texto: `${signo}${formatearCOP(abs)} (${pctTxt}) — ${etiqueta}` };
}
