// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Componente Semáforo
// ──────────────────────────────────────────────────────────────
// Renderiza la "Calificación global por prueba y año" (matriz del
// tablero) calculando CADA celda con el dominio puro
// (pruebas_electricas_semaforo.js). NO contiene reglas de negocio:
// solo presentación. Cambia de "datos hard-codeados" a "calificación
// derivada de los informes Firestore en vivo".
//
// Cada celda usa las clases del tablero original:
//   <span class="cellbox b-X"><span class="dot x"></span>texto</span>
// donde b-X / dot x vienen de ESTADOS (clase + dot) del dominio.
// ══════════════════════════════════════════════════════════════

import {
  ESTADOS,
  calificarDrm,
  estadoGlobal
} from '../../domain/pruebas_electricas_semaforo.js';
import { evaluarMultiNorma, metricaPrueba, corrienteExcitacionMax } from '../../domain/pruebas_electricas_multinorma.js';
import { minNetaGohm, kvAT } from '../../domain/pruebas_electricas_schema.js';

// Mínimo NETA de aislamiento por CLASE para un informe: prioriza la placa
// CONGELADA del propio informe (config móvil — cada despliegue su tensión), y
// cae a `opts.minNeta` (kv de la unidad) si el informe no trae identidad.
function minNetaDe(inf, opts) {
  if (inf && inf.identidad && inf.identidad.tensiones) {
    const m = minNetaGohm(kvAT(inf.identidad.tensiones));
    if (m != null) return m;
  }
  return (opts && typeof opts.minNeta === 'number') ? opts.minNeta : null;
}

/* ─── Definición de filas de la matriz (orden del tablero) ────── */
// `criterio` es el texto de la columna "Criterio" (igual al tablero).
const FILAS = [
  { key: 'tand',        label: 'Tangente δ (devanados)',         criterio: '≤1% (CL)' },
  { key: 'bushing',     label: 'Factor de potencia de bujes (C1)', criterio: 'tan δ ≤1%' },
  { key: 'excitacion',  label: 'Corriente de excitación',        criterio: 'Δfases <10%' },
  { key: 'relacion',    label: 'Relación de transformación',     criterio: '±0.5%' },
  { key: 'resistencia', label: 'Resistencia de devanados',       criterio: 'Δfases ≤2%' },
  { key: 'aislamiento', label: 'Resistencia de aislamiento (CC)', criterio: '≥1 GΩ' },
  { key: 'collar',      label: 'Collar caliente / bujes',         criterio: '<100 mW' },
  { key: 'drm',         label: 'DRM · conmutador (OLTC)',         criterio: '40–70 ms' }
];

/* ─── Calificación de un informe por tipo de prueba ───────────── */
// Devuelve { estado, texto }. El veredicto es el CONSOLIDADO multi-norma (el más
// conservador entre todas las normas aplicables) sobre la métrica peor-caso —
// NUNCA la calificación textual del laboratorio/IA (L-36 / ADR-012). El detalle
// por norma se obtiene aparte con `evaluarMultiNorma` (panel del bloque).
// `opts.minNeta` (GΩ): mínimo de aislamiento por clase de tensión (óptica "por clase").
function textoMetrica(key, m, estado) {
  if (estado === ESTADOS.VERDE) return 'OK';
  if (key === 'aislamiento') return `${m.toFixed(2)}GΩ`;
  if (key === 'collar') return `${m.toFixed(0)}mW`;
  return `${m.toFixed(2)}%`;
}

function calificarPrueba(key, inf, opts = {}) {
  if (!inf) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
  // DRM conserva su lógica de ventana de tiempos (no es un umbral multi-norma simple).
  if (key === 'drm') {
    const d = inf.drm || {};
    if (d.tiempo_min_ms == null && d.tiempo_max_ms == null) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
    const e = calificarDrm(d.tiempo_min_ms, d.tiempo_max_ms);
    const lo = d.tiempo_min_ms, hi = d.tiempo_max_ms;
    const texto = (lo != null && hi != null && lo !== hi)
      ? `${lo.toFixed(0)}–${hi.toFixed(0)}ms`
      : `${(hi ?? lo).toFixed(0)}ms`;
    return { estado: e, texto };
  }
  // Resistencia con lectura marcada `verificar` por el informe/IA: dato a
  // confirmar → ámbar (señal de calidad de dato), se preserva sobre el valor.
  if (key === 'resistencia' && Array.isArray(inf.resistencia) && inf.resistencia.some((r) => r && r.verificar)) {
    return { estado: ESTADOS.AMBAR, texto: 'verificar' };
  }
  const m = metricaPrueba(key, inf);
  if (m == null) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
  // Aislamiento: clase de tensión del PROPIO informe (placa congelada) → cada
  // ensayo de un trafo móvil se evalúa contra SU clase (63.5 kV vs 110 kV).
  // Excitación: la óptica IEEE necesita la corriente (mA) para elegir el margen
  // (Δ<10% si I<50 mA · Δ<5% si I≥50 mA). Sin corriente cae al 10% (sin regresión).
  const ctx = { minClase: minNetaDe(inf, opts) };
  if (key === 'excitacion') ctx.corrienteMA = corrienteExcitacionMax(inf);
  // TODO-15a: la óptica ΔC1 del buje lee la capacitancia vs placa del canónico.
  if (key === 'bushing') ctx.dc1MaxPct = inf.bushing && inf.bushing.dc1_max_pct;
  const mn = evaluarMultiNorma(key, m, ctx);
  const estado = (mn && mn.consolidado) ? mn.consolidado : ESTADOS.NEUTRAL;
  return { estado, texto: textoMetrica(key, m, estado) };
}

function cellHtml(estado, texto) {
  return `<span class="cellbox ${estado.clase}"><span class="dot ${estado.dot}"></span>${texto}</span>`;
}

/**
 * Renderiza la matriz de calificación a partir de los informes.
 * @param {HTMLElement} cont contenedor (.matrix)
 * @param {Array} informes informes ordenados por año asc
 */
export function renderMatriz(cont, informes, opts = {}) {
  if (!cont) return;
  const docs = (informes || []).slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  const anos = docs.map((d) => d.ano);
  const head = `<tr><th>Tipo de prueba</th>${anos.map((a) => `<th>${a}</th>`).join('')}<th>Criterio</th></tr>`;
  const minNeta = (opts && typeof opts.minNeta === 'number') ? opts.minNeta : null;
  const body = FILAS.map((fila) => {
    const celdas = docs.map((inf) => {
      const { estado, texto } = calificarPrueba(fila.key, inf, opts);
      return `<td>${cellHtml(estado, texto)}</td>`;
    }).join('');
    // Criterio de aislamiento dinámico: mínimo NETA por clase de tensión.
    const crit = (fila.key === 'aislamiento' && minNeta != null) ? `≥ ${minNeta} GΩ` : fila.criterio;
    return `<tr><td class="cfg">${fila.label}</td>${celdas}<td class="muted small">${crit}</td></tr>`;
  }).join('');
  cont.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/**
 * Estado global de UN informe (peor prueba). Mismo criterio que la matriz:
 * califica cada FILA con `calificarPrueba` y reduce con `estadoGlobal`.
 * @param {object} inf un informe con sus campos canónicos
 * @returns {object} estado del dominio (clase/dot/nivel/etiqueta)
 */
export function estadoInforme(inf, opts = {}) {
  if (!inf) return ESTADOS.NEUTRAL;
  const estados = {};
  FILAS.forEach((f) => { estados[f.key] = calificarPrueba(f.key, inf, opts).estado; });
  return estadoGlobal(estados);
}

/**
 * Estado global del informe más reciente (para el chip "vigente").
 * @param {Array} informes
 * @param {object} [opts] {minNeta} mínimo NETA de aislamiento por clase
 * @returns {object} estado del dominio (peor prueba del último informe)
 */
export function estadoVigente(informes, opts = {}) {
  const docs = (informes || []).slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  return estadoInforme(docs[docs.length - 1], opts);
}

/**
 * Cronología de informes para la franja-timeline de la pestaña Tendencia.
 * Cada nodo lleva su estado global (peor prueba) y un marcador de vigente.
 * Función pura (sin DOM): ordena por año ascendente.
 * @param {Array} informes
 * @returns {Array<{ano:(number|null), fecha:(string|null), estado:object, vigente:boolean}>}
 */
export function lineaTiempoInformes(informes, opts = {}) {
  const docs = (informes || []).filter(Boolean)
    .slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  const ultimo = docs.length - 1;
  return docs.map((inf, i) => ({
    ano: (inf.ano != null) ? inf.ano : null,
    fecha: inf.fecha ? String(inf.fecha) : null,
    estado: estadoInforme(inf, opts),
    vigente: i === ultimo
  }));
}

export { calificarPrueba };
