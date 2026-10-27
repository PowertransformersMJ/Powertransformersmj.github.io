// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · CAMBIO DE MEDIDA de un transformador desde un mes (dominio puro) · 2026-10-26
// ──────────────────────────────────────────────────────────────────────────────
// Una S/E cambia de configuración (p. ej. dos barras que se separan) y la medida que representa a un transformador deja de
// ser la misma: hasta un mes se medía por su interruptor; desde el siguiente, por su circuito; o hasta ese mes estuvo sin
// carga. Decisión del Ingeniero (2026-10-26, W-11; diseño + comité en la bóveda): la decisión de la homologación sigue
// siendo la medida de HOY y guarda sus MEDIDAS ANTERIORES en `decision.previas`, un mapa (L-30) cuya llave es el ÚLTIMO
// mes ('AAAA-MM') en que rigió cada una:
//   · { tipo: 'medida', clave_excel, decision, nota }  → la fila como estaba (su clave del Excel y su decisión, tal cual);
//   · { tipo: 'sin_carga', nota }                        → el transformador no llevó carga (sin cifra, nunca 0 %).
// Para un mes, la fila «del mes» es la de la previa con la llave más baja ≥ mes, o la de hoy. Esa fila es una fila normal
// (otra clave, otra decisión), así que calcularEquipo, avisosFila, estadoEfectivo, componerResumen… no cambian. Sin previas
// todo devuelve EXACTAMENTE lo de siempre (la misma fila, `===`). Lo que junta meses (periodo, detalle, mes a mes) mira UNA
// configuración: la del último mes pedido; lo anterior va aparte, rotulado (decisión del Ingeniero: «vigente + lo anterior»).
// v1: sin cambios a mitad de mes, sin suma de circuitos en una fila con cambios, claves de la MISMA estación.
// Funciones PURAS. Archivo NUEVO a propósito (L-102): solo importa exportaciones ya publicadas.
// ══════════════════════════════════════════════════════════════════════════════

import { analizarClaveHomologada } from './scada_carga_homologacion.js';
import { normalizarTexto, esElementoTransformador } from './scada_carga_csv.js';
import { sobrecargaDelPeriodo } from './scada_carga_sobrecarga.js';

const RX_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const esMes = (m) => typeof m === 'string' && RX_MES.test(m);
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «abr-2026» (para los rótulos). */
export function textoMes(mes) {
  return esMes(mes) ? MESES_CORTOS[Number(mes.slice(5, 7)) - 1] + '-' + mes.slice(0, 4) : String(mes || '');
}
/** El mes siguiente ('2026-12' → '2027-01'). */
export function mesSiguiente(mes) {
  const y = Number(mes.slice(0, 4)); const m = Number(mes.slice(5, 7));
  return m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0');
}

/** ¿La decisión trae medidas anteriores? (un objeto, no un arreglo, con alguna llave de mes válida). `{}` = no. */
export function tieneCambiosDeMedida(decision) {
  const p = decision && decision.previas;
  return !!(p && typeof p === 'object' && !Array.isArray(p) && Object.keys(p).some(esMes));
}
/** Las llaves de mes de las medidas anteriores, en orden. */
export function llavesPrevias(decision) {
  return tieneCambiosDeMedida(decision) ? Object.keys(decision.previas).filter(esMes).sort() : [];
}

/** La fila tal como se medía en una medida anterior (nunca se escribe; la homologación guarda la fila base). */
function filaDePrevia(fila, p, desde, hasta) {
  const sinCarga = !!(p && p.tipo === 'sin_carga');
  const cambioMedida = { tipo: sinCarga ? 'sin_carga' : 'medida', desde, hasta, nota: (p && p.nota) || '', vigenteDesde: mesSiguiente(hasta) };
  // «Sin carga»: sin clave (nunca cae a la del Excel) y excluida para el cálculo: sin cifra, con su propio motivo.
  if (sinCarga) return { ...fila, clave_excel: null, decision: { tipo: 'no_usar', clave: null, nota: cambioMedida.nota }, cambioMedida };
  return { ...fila, clave_excel: p && p.clave_excel !== undefined ? p.clave_excel : fila.clave_excel, decision: (p && p.decision) || null, cambioMedida };
}

/**
 * Las configuraciones del equipo en el tiempo, en orden: [{desde, hasta, tipo: 'medida'|'sin_carga'|'vigente', nota, fila}]
 * (desde/hasta = 'AAAA-MM' o null = abierto). Sin cambios: UNA, la vigente, con la MISMA fila.
 */
export function segmentos(fila) {
  if (!fila || !tieneCambiosDeMedida(fila.decision)) return [{ desde: null, hasta: null, tipo: 'vigente', nota: '', fila }];
  const out = []; let desde = null;
  for (const k of llavesPrevias(fila.decision)) {
    const p = fila.decision.previas[k];
    const f = filaDePrevia(fila, p, desde, k);
    out.push({ desde, hasta: k, tipo: f.cambioMedida.tipo, nota: f.cambioMedida.nota, fila: f });
    desde = mesSiguiente(k);
  }
  const anterior = out[out.length - 1];
  out.push({ desde, hasta: null, tipo: 'vigente', nota: (fila.decision && fila.decision.nota) || '',
    fila: { ...fila, cambioMedida: { tipo: 'vigente', desde, hasta: null, nota: (fila.decision && fila.decision.nota) || '', anterior: { tipo: anterior.tipo, hasta: anterior.hasta } } } });
  return out;
}

/** La configuración que rige en un mes (sin mes válido: la vigente). */
export function segmentoDelMes(fila, mes) {
  const segs = segmentos(fila);
  if (segs.length === 1 || !esMes(mes)) return segs[segs.length - 1];
  return segs.find((s) => s.hasta == null || mes <= s.hasta);
}

/** La fila con la que se calcula un mes. Sin cambios de medida devuelve la MISMA fila (`===`). */
export function filaDelMes(fila, mes) {
  if (!fila || !tieneCambiosDeMedida(fila.decision)) return fila;
  return segmentoDelMes(fila, mes).fila;
}

/** Las filas de la homologación tal como rigen en un mes (para los conteos). Sin ningún cambio: el MISMO objeto. */
export function filasDelMes(filas, mes) {
  const lista = Object.entries(filas || {});
  if (!lista.some(([, f]) => f && tieneCambiosDeMedida(f.decision))) return filas;
  return Object.fromEntries(lista.map(([id, f]) => [id, filaDelMes(f, mes)]));
}

/** Los meses de una lista que caen en una configuración. */
export function mesesDelSegmento(seg, meses) {
  return (meses || []).filter((m) => (seg.desde == null || m >= seg.desde) && (seg.hasta == null || m <= seg.hasta));
}
/** El punto del catálogo recortado a los meses de una configuración (sin recorte: el mismo punto). */
export function puntoDelSegmento(punto, seg) {
  if (!punto || !seg || (seg.desde == null && seg.hasta == null)) return punto;
  return { ...punto, meses: mesesDelSegmento(seg, punto.meses || []) };
}

/** «hasta abr-2026» · «desde may-2026» · «de may-2026 a ago-2026». */
export function textoVentana(seg) {
  if (!seg) return '';
  if (seg.desde && seg.hasta) return 'de ' + textoMes(seg.desde) + ' a ' + textoMes(seg.hasta);
  if (seg.hasta) return 'hasta ' + textoMes(seg.hasta);
  if (seg.desde) return 'desde ' + textoMes(seg.desde);
  return '';
}

/** Motivo de un mes «sin carga» (declarado por el Ingeniero: no hay medida, no se fabrica un 0 %). */
export function motivoSinCarga(cambio) {
  return 'sin carga ' + textoVentana(cambio) + ' (según el Ingeniero' + (cambio && cambio.nota ? ': ' + cambio.nota : '') + ')';
}

/**
 * La sobrecarga sostenida de los meses ANTERIORES al cambio (los que no son de la configuración vigente), para el rótulo
 * «antes del cambio de medida» del periodo. null si no hubo.
 * @param {Array<object|null>} filasMes  filas de la lista de esos meses (ya verificadas)
 */
export function sobrecargaAntesDelCambio(filasMes) {
  const xs = (filasMes || []).filter(Boolean);
  const firme = xs.some((x) => x.sobrecargaSostenida);
  const posible = !firme && xs.some((x) => x.sobrecargaProvisional);
  if (!firme && !posible) return null;
  const s = sobrecargaDelPeriodo({ pct: 1, sobrecargaSostenida: firme, sobrecargaProvisional: posible }, xs);
  return s ? { ...s, tipo: firme ? 'firme' : 'posible' } : null;
}

// ── Escritura (la arma Claude o, después, un formulario; siempre con decidirFila) ─────────────────────────────────

const quitarPrevias = (d) => {
  if (!d) return null;
  const { previas, ...resto } = d;   // eslint-disable-line no-unused-vars
  return resto;
};

/**
 * La decisión a guardar con un cambio de medida NUEVO: la medida de hoy pasa a ser «anterior» hasta `hasta` (o «sin carga»)
 * y `nueva` (una decisión completa, sin previas) rige desde el mes siguiente. No muta nada.
 * @param {object} fila  la fila BASE de la homologación (con su decisión de hoy, o null si es automática)
 * @param {{hasta: string, antes: 'actual'|'sin_carga', nota: string, nueva: object}} cambio
 */
export function decisionConCambio(fila, { hasta, antes, nota, nueva }) {
  const previas = tieneCambiosDeMedida(fila && fila.decision) ? { ...fila.decision.previas } : {};
  const previa = antes === 'sin_carga'
    ? { tipo: 'sin_carga', nota }
    : { tipo: 'medida', clave_excel: (fila && fila.clave_excel) || null, decision: quitarPrevias(fila && fila.decision), nota };
  return { ...quitarPrevias(nueva), previas: { ...previas, [hasta]: previa } };
}

/**
 * Lo que impide guardar una decisión con cambios de medida (v1). Lista vacía = se puede.
 * @param {object} fila  la fila base (para su clave del Excel y su estación)
 * @param {object} decision  la decisión que se va a guardar
 */
export function erroresCambioMedida(fila, decision) {
  if (!decision || !decision.previas) return [];
  const e = [];
  const p = decision.previas;
  if (typeof p !== 'object' || Array.isArray(p)) return ['Las medidas anteriores deben ser un mapa por mes.'];
  const llaves = Object.keys(p);
  if (llaves.some((k) => !esMes(k))) e.push('Cada medida anterior va con el último mes en que rigió, como AAAA-MM.');
  if (decision.tipo !== 'usar') e.push('Con medidas anteriores, la medida de hoy debe ser «usar» (una medida, no una exclusión).');
  if (decision.suma) e.push('La primera versión no combina un cambio de medida con una suma de circuitos.');
  const estDe = (clave) => { const k = analizarClaveHomologada(clave); return k ? normalizarTexto(k.est) : null; };
  const est = estDe(decision.clave || (fila && fila.clave_excel));
  for (const k of llaves.filter(esMes)) {
    const x = p[k];
    const nota = String((x && x.nota) || '').trim();
    if (nota.length < 10 || nota.length > 300) e.push('La medida anterior hasta ' + textoMes(k) + ' necesita una nota de 10 a 300 caracteres.');
    if (!x || !['medida', 'sin_carga'].includes(x.tipo)) { e.push('La medida anterior hasta ' + textoMes(k) + ' debe ser «medida» o «sin carga».'); continue; }
    if (x.tipo !== 'medida') continue;
    if (x.decision && (x.decision.suma || x.decision.previas)) e.push('La medida anterior hasta ' + textoMes(k) + ' no puede traer suma de circuitos ni otras medidas anteriores.');
    const clave = (x.decision && x.decision.clave) || x.clave_excel;
    const k2 = analizarClaveHomologada(clave);
    if (!k2) { e.push('La medida anterior hasta ' + textoMes(k) + ' no tiene punto SCADA.'); continue; }
    if (est && normalizarTexto(k2.est) !== est) e.push('La medida anterior hasta ' + textoMes(k) + ' es de otra estación SCADA (la primera versión solo admite la misma).');
    // v1: la medida anterior es la del Excel de la fila o un interruptor de la estación (así el importador ya la trae).
    const delExcel = fila && fila.clave_excel && normalizarTexto(fila.clave_excel) === normalizarTexto(clave);
    if (!delExcel && !esElementoTransformador(k2.elem)) e.push('La medida anterior hasta ' + textoMes(k) + ' debe ser la del Excel de la fila o un interruptor del transformador.');
  }
  return e;
}
