// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Mapper del parque para el dashboard de Salud
// de Activos (TODO-09 · ADR-052 Ola 0 follow-up)
// ──────────────────────────────────────────────────────────────
// Función PURA: doc v2 de `/transformadores` → fila con el contrato
// de `pages/parque-transformadores.html` (mismo shape que el DEMO
// sintético). SIN fabricar datos: lo que el doc no trae viaja como
// null y el normalizador del dashboard lo muestra como "—".
// El HI oficial ya viene calculado por el motor (salud_actual.hi_final,
// G010): se entrega como `condicion` — el dashboard NO lo re-inventa.
// ══════════════════════════════════════════════════════════════

const TIPO_MAP = Object.freeze({
  POTENCIA: 'TX_Potencia',
  TPT:      'TPT_Servicio',
  RESPALDO: 'TX_Respaldo'
});

const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {object} tx  doc v2 (con `.id` si viene del data layer)
 * @returns {object|null} fila del dashboard, o null si la entrada es nula
 */
export function filaParqueDesdeTx(tx) {
  if (!tx || typeof tx !== 'object') return null;
  const id = tx.identificacion || {};
  const ub = tx.ubicacion || {};
  const sa = tx.salud_actual || {};
  const kva = toNum(tx.placa && tx.placa.potencia_kva);
  return {
    codigo:       id.codigo || tx.codigo || tx.id || '',
    serie:        id.numero_serie || id.serie || tx.serie || '',
    matricula:    id.matricula || '',
    subestacion:  ub.subestacion_nombre || '',
    municipio:    ub.municipio || '',
    zona:         ub.zona || '',
    departamento: ub.departamento || '',
    tipo_activo:  TIPO_MAP[id.tipo_activo] || 'TX_Potencia',
    mva:          kva != null ? kva / 1000 : null,
    calif_dga:    toNum(sa.eval_dga),
    calif_adfq:   toNum(sa.eval_adfq),
    calif_fur:    toNum(sa.calif_fur),
    calif_crg:    toNum(sa.calif_crg),
    calif_pyt:    toNum(sa.calif_pyt),
    calif_edad:   toNum(sa.calif_edad),
    calif_her:    toNum(sa.calif_her),
    condicion:    toNum(sa.hi_final),
    usuarios_aguas_abajo: toNum(tx.criticidad && tx.criticidad.usuarios_aguas_abajo),
    aliado: null,
    causante: null,
    macroactividad: null
  };
}

/** Mapea el listado completo, descartando entradas nulas. */
export function filasParque(txs) {
  return (Array.isArray(txs) ? txs : []).map(filaParqueDesdeTx).filter(Boolean);
}
