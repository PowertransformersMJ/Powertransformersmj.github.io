// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Motor de Propuestas de Mantenimiento
// ──────────────────────────────────────────────────────────────
// Flujograma de diagnóstico derivado de la condición de las 7
// variables del activo. Devuelve un descriptor estructurado:
//   {
//     nodes: [{id, label, sev, match[], insumos[], acc[]}],
//     flagged: {dga, adfq, fur, crg, pyt, edad, her},   // solo c>=3
//     criticas: [string],  // variables con calif >= 4
//     atencion: [string],  // variables con calif == 3
//     acciones: [{texto, n}],   // acciones priorizadas (más reforzadas primero)
//   }
//
// Función PURA · sin DOM · sin I/O. La UI (modal-ficha.js) la
// renderiza con el HTML del flujograma.
//
// Referencia: flujograma del Anexo (MO.00418 §A6) + Triángulo de
// Duval (IEC 60599) para escalamiento DGA.
// ══════════════════════════════════════════════════════════════

import { VAR_NOMBRE } from './parque_salud_config.js';
import { condIC, condRigidez, duvalDashboard } from './parque_salud_calc.js';

// ── Catálogo de nodos del flujograma ──────────────────────────
export const FLUJO = Object.freeze({
  dga_co: Object.freeze({
    label: 'DGA · CO / CO₂',
    match: Object.freeze(['crg']),
    acc: Object.freeze([
      'Aumento de capacidad de transformación',
      'Aumento de capacidad de refrigeración',
      'Reemplazo de ventilación',
      'Inspección termográfica',
      'Inspección interna superficial',
    ]),
  }),
  dga_comb: Object.freeze({
    label: 'DGA · gases combustibles (CH₄/C₂H₄/C₂H₂/C₂H₆)',
    match: Object.freeze(['crg', 'pyt', 'edad', 'fur']),
    acc: Object.freeze([
      'Reemplazo de unidad de transformación',
      'Aumento de capacidad de refrigeración',
      'Reemplazo de ventilación',
      'Inspección interna',
      'Mantenimiento OLTC-NLTC',
      'Inspección termográfica',
      'Aumento de capacidad de transformación',
    ]),
  }),
  toa: Object.freeze({
    label: 'TOA · diagnóstico profundo',
    match: Object.freeze([]),
    acc: Object.freeze([
      'Toma de contramuestra de aceite',
      'Mantenimiento mayor',
      'Inspección de parte activa',
      'Diagnóstico SPT',
    ]),
  }),
  adfq_ic: Object.freeze({
    label: 'ADFQ · calidad del aceite (IC)',
    match: Object.freeze(['crg', 'her', 'pyt']),
    acc: Object.freeze([
      'Aumento de capacidad de transformación',
      'Aumento de capacidad de refrigeración',
      'Parametrización de protecciones',
      'Regeneración de aceite',
    ]),
  }),
  adfq_rig: Object.freeze({
    label: 'ADFQ · rigidez / humedad',
    match: Object.freeze(['her', 'pyt', 'crg']),
    acc: Object.freeze([
      'Secado del aceite',
      'Secado de la parte activa',
      'Parametrización de protecciones',
      'Corrección de fugas',
      'Plan de mitigación',
    ]),
  }),
  fur: Object.freeze({
    label: 'Furanos (2-FAL)',
    match: Object.freeze(['pyt', 'crg', 'edad']),
    acc: Object.freeze([
      'Propuesta a Plan de Inversión (PI)',
      'Plan de mitigación',
    ]),
  }),
  edad: Object.freeze({
    label: 'Edad',
    match: Object.freeze(['crg', 'fur', 'adfq', 'dga', 'pyt', 'her']),
    acc: Object.freeze([
      'Escalar a TOA',
      'Aumento de capacidad de refrigeración',
      'Parametrización de protecciones',
      'Regeneración de aceite',
      'Plan de mitigación',
      'Inspección termográfica',
      'Aumento de capacidad de transformación',
      'Secado del aceite',
      'Secado de la parte activa',
      'Pintura total',
      'Propuesta a Plan de Inversión (PI)',
    ]),
  }),
  crg: Object.freeze({
    label: 'Cargabilidad',
    match: Object.freeze(['dga', 'pyt', 'edad', 'fur', 'adfq']),
    acc: Object.freeze([
      'Aumento de capacidad de transformación',
      'Propuesta a Plan de Inversión (PI)',
      'Aumento de capacidad de refrigeración',
      'Parametrización de límite SCADA',
      'Parametrización de protecciones',
    ]),
  }),
  pyt: Object.freeze({
    label: 'Estudios P&T',
    match: Object.freeze(['crg', 'edad', 'dga', 'fur']),
    insumos: Object.freeze([
      'Diferencial de trafo (ANSI 87T)',
      'Nivel de corto de la subestación',
      'Cargabilidad',
      'Límite SCADA',
      'Capacidad de transformación nominal',
    ]),
    acc: Object.freeze([
      'Parametrización de protecciones',
      'Plan de mitigación',
      'Aumento de capacidad de transformación',
      'Parametrización de límite SCADA',
    ]),
  }),
  her: Object.freeze({
    label: 'Hermeticidad',
    match: Object.freeze(['adfq']),
    acc: Object.freeze([
      'Secado del aceite',
      'Corrección de fugas',
      'Regeneración de aceite',
    ]),
  }),
});

const KEYS = ['dga', 'adfq', 'fur', 'crg', 'pyt', 'edad', 'her'];

// ── Motor de diagnóstico ──────────────────────────────────────
// Devuelve un descriptor que la UI puede pintar. Si todas las
// variables están en condición ≤ 2 retorna `{ vacio: true }`.
export function buildPropuesta(activo) {
  const cond = (k) => {
    const v = activo['calif_' + k];
    return v == null || Number.isNaN(v) ? null : Math.round(v);
  };
  const flagged = {};
  KEYS.forEach(k => {
    const c = cond(k);
    if (c != null && c >= 3) flagged[k] = c;
  });

  const d = activo.det || {};
  const nodes = [];
  const push = (id, sev) => {
    const def = FLUJO[id];
    if (!def) return;
    nodes.push({
      id, sev,
      label: def.label,
      match: def.match || [],
      insumos: def.insumos || null,
      acc: def.acc || [],
    });
  };

  // ── DGA ─────────────────────────────────────────────────────
  if (flagged.dga) {
    const evco = Math.max(d.ev_co || 0, d.ev_co2 || 0);
    const dv = (d.ch4 != null && d.c2h4 != null && d.c2h2 != null && (d.ch4 + d.c2h4 + d.c2h2) >= 1)
      ? duvalDashboard(d.ch4, d.c2h4, d.c2h2)
      : null;
    const dvZone = dv?.zone || null;
    const comb = (d.ev_tdgc || 0) >= 3
              || (d.ev_c2h2 || 0) >= 2
              || (dvZone && ['D1', 'D2', 'T2', 'T3', 'DT'].includes(dvZone));
    if (evco >= 3) push('dga_co', flagged.dga);
    if (comb || evco < 3) push('dga_comb', flagged.dga);
    if (flagged.dga >= 4 || (dvZone && ['D2', 'T3', 'DT'].includes(dvZone))) {
      push('toa', flagged.dga);
    }
  }

  // ── ADFQ ────────────────────────────────────────────────────
  if (flagged.adfq) {
    const ic = d.ic != null ? condIC(d.ic) : null;
    const rg = d.rigidez != null ? condRigidez(d.rigidez) : null;
    if (ic != null && ic >= 3) push('adfq_ic', flagged.adfq);
    if (rg != null && rg >= 3) push('adfq_rig', flagged.adfq);
    if (!nodes.some(n => n.id.indexOf('adfq') === 0)) push('adfq_ic', flagged.adfq);
  }

  // ── Resto en orden fijo ────────────────────────────────────
  ['fur', 'edad', 'crg', 'pyt', 'her'].forEach(k => {
    if (flagged[k]) push(k, flagged[k]);
  });

  if (!nodes.length) {
    return { vacio: true, flagged, criticas: [], atencion: [], nodes: [], acciones: [] };
  }

  // ── Acciones priorizadas (cuenta de refuerzos) ─────────────
  const cnt = {};
  nodes.forEach(n => n.acc.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; }));
  const acciones = Object.entries(cnt)
    .sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]))
    .map(([texto, n]) => ({ texto, n }));

  const criticas = Object.keys(flagged).filter(k => flagged[k] >= 4).map(k => VAR_NOMBRE[k]);
  const atencion = Object.keys(flagged).filter(k => flagged[k] === 3).map(k => VAR_NOMBRE[k]);

  return { vacio: false, flagged, criticas, atencion, nodes, acciones };
}
