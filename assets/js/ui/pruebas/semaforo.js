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
  calificarTanDelta, calificarExcitacion, calificarRelacion,
  calificarResistencia, calificarAislamiento, calificarCollar,
  estadoGlobal
} from '../../domain/pruebas_electricas_semaforo.js';

/* ─── Definición de filas de la matriz (orden del tablero) ────── */
// `criterio` es el texto de la columna "Criterio" (igual al tablero).
const FILAS = [
  { key: 'tand',        label: 'Tangente δ (devanados)',         criterio: '≤1% (CL)' },
  { key: 'excitacion',  label: 'Corriente de excitación',        criterio: 'Δfases <10%' },
  { key: 'relacion',    label: 'Relación de transformación',     criterio: '±0.5%' },
  { key: 'resistencia', label: 'Resistencia de devanados',       criterio: 'Δfases ≤5%' },
  { key: 'aislamiento', label: 'Resistencia de aislamiento (CC)', criterio: '≥1 GΩ' },
  { key: 'collar',      label: 'Collar caliente / bujes',         criterio: '<100 mW' }
];

/* ─── Calificación de un informe por tipo de prueba ───────────── */
// Devuelve { estado, texto } para una prueba dada de un informe.
function calificarPrueba(key, inf) {
  if (!inf) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
  switch (key) {
    case 'tand': {
      // tan δ: la peor configuración medida define la celda.
      const arr = Array.isArray(inf.tand) ? inf.tand : [];
      const medidas = arr.filter((t) => t.valor_pct != null);
      if (!medidas.length) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
      let peor = ESTADOS.VERDE;
      medidas.forEach((t) => {
        const e = calificarTanDelta(t.valor_pct);
        if (e.nivel > peor.nivel) peor = e;
      });
      // Muestra el valor máximo medido (la configuración más exigente).
      const maxVal = Math.max(...medidas.map((t) => t.valor_pct));
      return { estado: peor, texto: `${maxVal.toFixed(2)}%` };
    }
    case 'excitacion': {
      // excitación es un OBJETO con la Δ ext % del devanado AT.
      const d = inf.excitacion || {};
      if (d.delta_ext_pct == null) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
      return { estado: calificarExcitacion(d.delta_ext_pct), texto: `${d.delta_ext_pct.toFixed(2)}%` };
    }
    case 'relacion': {
      // relación es un ARRAY de pares (AT–MT, AT–Terc.); la peor desviación define la celda.
      const arr = Array.isArray(inf.relacion) ? inf.relacion : [];
      const medidas = arr.filter((r) => r.desviacion_pct != null);
      if (!medidas.length) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
      let peor = ESTADOS.VERDE, maxAbs = 0;
      medidas.forEach((r) => {
        const abs = Math.abs(r.desviacion_pct);
        if (abs > maxAbs) maxAbs = abs;
        const e = calificarRelacion(r.desviacion_pct);
        if (e.nivel > peor.nivel) peor = e;
      });
      return { estado: peor, texto: `${maxAbs.toFixed(2)}%` };
    }
    case 'resistencia': {
      // resistencia es un ARRAY por devanado (AT/MT/BT); peor Δ máx + flags.
      const arr = Array.isArray(inf.resistencia) ? inf.resistencia : [];
      if (!arr.length) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
      const flag = arr.some((r) => r.verificar);
      const medidas = arr.filter((r) => !r.no_medido && r.delta_max_pct != null);
      const maxDelta = medidas.length ? Math.max(...medidas.map((r) => r.delta_max_pct)) : null;
      const e = calificarResistencia(maxDelta, flag);
      if (flag) return { estado: e, texto: 'verificar' };
      if (maxDelta == null) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
      return { estado: e, texto: e === ESTADOS.VERDE ? 'OK' : `${maxDelta.toFixed(2)}%` };
    }
    case 'aislamiento': {
      // aislamiento es un ARRAY por par; el valor mínimo (peor) define la celda.
      const arr = Array.isArray(inf.aislamiento) ? inf.aislamiento : [];
      const medidas = arr.filter((a) => a.gohm != null);
      if (!medidas.length) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
      const min = Math.min(...medidas.map((a) => a.gohm));
      const e = calificarAislamiento(min);
      return { estado: e, texto: e === ESTADOS.VERDE ? 'OK' : `${min.toFixed(2)}GΩ` };
    }
    case 'collar': {
      // collar es un OBJETO con max_mw (pérdidas máximas en bujes).
      const d = inf.collar || {};
      if (d.max_mw == null) return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
      const e = calificarCollar(d.max_mw);
      return { estado: e, texto: e === ESTADOS.VERDE ? 'OK' : `${d.max_mw.toFixed(0)}mW` };
    }
    default:
      return { estado: ESTADOS.NEUTRAL, texto: 'n/d' };
  }
}

function cellHtml(estado, texto) {
  return `<span class="cellbox ${estado.clase}"><span class="dot ${estado.dot}"></span>${texto}</span>`;
}

/**
 * Renderiza la matriz de calificación a partir de los informes.
 * @param {HTMLElement} cont contenedor (.matrix)
 * @param {Array} informes informes ordenados por año asc
 */
export function renderMatriz(cont, informes) {
  if (!cont) return;
  const docs = (informes || []).slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  const anos = docs.map((d) => d.ano);
  const head = `<tr><th>Tipo de prueba</th>${anos.map((a) => `<th>${a}</th>`).join('')}<th>Criterio</th></tr>`;
  const body = FILAS.map((fila) => {
    const celdas = docs.map((inf) => {
      const { estado, texto } = calificarPrueba(fila.key, inf);
      return `<td>${cellHtml(estado, texto)}</td>`;
    }).join('');
    return `<tr><td class="cfg">${fila.label}</td>${celdas}<td class="muted small">${fila.criterio}</td></tr>`;
  }).join('');
  cont.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/**
 * Estado global del informe más reciente (para el chip "vigente").
 * @param {Array} informes
 * @returns {object} estado del dominio (peor prueba del último informe)
 */
export function estadoVigente(informes) {
  const docs = (informes || []).slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  const ult = docs[docs.length - 1];
  if (!ult) return ESTADOS.NEUTRAL;
  const estados = {};
  FILAS.forEach((f) => { estados[f.key] = calificarPrueba(f.key, ult).estado; });
  return estadoGlobal(estados);
}

export { calificarPrueba };
