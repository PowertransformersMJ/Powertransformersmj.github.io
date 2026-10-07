// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Domain: movimientos (Fase 38)
// ──────────────────────────────────────────────────────────────
// Bitácora INGRESO/EGRESO de suministros. Append + delete con
// audit obligatorio. Cada movimiento snapshotea (a) el valor
// unitario del catálogo y (b) los datos del trafo en el momento
// de la transacción — si después cambia el catálogo o se mueve
// el trafo, el histórico no se distorsiona.
//
// Funciones PURAS. I/O vive en assets/js/data/movimientos.js.
// La generación del correlativo (`generarCodigoMov`) es pura y
// está en schema.js; quien lo invoca en data layer (F39) lo hace
// dentro de runTransaction para evitar race condition.
// ══════════════════════════════════════════════════════════════

import {
  TIPOS_MOVIMIENTO, MOVIMIENTO_CODIGO_PATTERN,
  SUMINISTRO_CODIGO_PATTERN, CONTRATO_ID_PATTERN,
  ZONAS, DEPARTAMENTOS, enValores
} from './schema.js';

const str = (v) => (v == null) ? '' : String(v).trim();
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
};
const intPos = (v) => {
  const n = num(v);
  if (n == null) return null;
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function sanitizarMovimiento(input) {
  const src = input || {};
  const tipo = str(src.tipo).toUpperCase();
  const zona = str(src.zona).toUpperCase();
  const depto = str(src.departamento).toLowerCase();
  const cantidad = intPos(src.cantidad);
  const valU = num(src.valor_unitario);
  const valTotalSrc = num(src.valor_total);
  // Si el caller no pasó valor_total, lo derivamos de cantidad × valor_unitario.
  const valTotal = (valTotalSrc != null)
    ? valTotalSrc
    : ((cantidad != null && valU != null) ? cantidad * valU : null);
  const out = {
    contrato_id:         str(src.contrato_id),
    codigo:              str(src.codigo).toUpperCase(),
    anio:                num(src.anio),
    tipo:                enValores(TIPOS_MOVIMIENTO, tipo) ? tipo : '',
    suministro_id:       str(src.suministro_id).toUpperCase(),
    suministro_nombre:   str(src.suministro_nombre),
    marca:               str(src.marca).toUpperCase(),
    cantidad:            cantidad,
    valor_unitario:      (valU == null || valU < 0) ? 0 : valU,
    valor_total:         (valTotal == null || valTotal < 0) ? 0 : valTotal,
    transformador_id:    str(src.transformador_id),
    matricula:           str(src.matricula),
    subestacion:         str(src.subestacion),
    zona:                enValores(ZONAS, zona) ? zona : '',
    departamento:        enValores(DEPARTAMENTOS, depto) ? depto : '',
    odt:                 str(src.odt),
    usuario:             str(src.usuario),
    observaciones:       str(src.observaciones)
  };
  // Campos ADITIVOS (2026-10-07, nexo con Órdenes E/S): solo se escriben cuando vienen, así un
  // movimiento manual queda idéntico. El enlace con la orden NO puede perderse en el saneo: sin él,
  // la orden y su movimiento se contarían dos veces (`99 §147`).
  const fechaEntrega = str(src.fecha_entrega);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaEntrega)) out.fecha_entrega = fechaEntrega;
  const oes = sanitizarEnlaceOrden(src.orden_es);
  if (oes) out.orden_es = oes;
  return out;
}

/** Enlace con la orden E/S de origen, o null si no viene o está incompleto. */
export function sanitizarEnlaceOrden(v) {
  if (!v || typeof v !== 'object') return null;
  const clave = str(v.clave);
  if (!clave) return null;
  const cant = num(v.cantidad);
  const out = {
    clave,
    tipo:          str(v.tipo).toUpperCase(),
    numero:        str(v.numero),
    fechaISO:      str(v.fechaISO),
    creadoEn:      num(v.creadoEn) || 0,
    cantidad:      cant == null ? 0 : cant,
    transformador: str(v.transformador)
  };
  // Versión de la orden al registrar (`99 §148`): la regla deja al equipo retirar el movimiento solo si
  // la orden cambió desde entonces. Aditivo: los enlaces anteriores no la traen.
  const ver = num(v.version);
  if (Number.isInteger(ver) && ver > 0) out.version = ver;
  return out;
}

export function validarMovimiento(doc) {
  const errs = [];
  if (!doc) { errs.push('Documento vacío.'); return errs; }
  if (doc.contrato_id && !CONTRATO_ID_PATTERN.test(doc.contrato_id)) {
    errs.push(`contrato_id inválido: "${doc.contrato_id}". Esperado 8-14 dígitos.`);
  }
  if (!doc.codigo) {
    errs.push('codigo es obligatorio.');
  } else if (!MOVIMIENTO_CODIGO_PATTERN.test(doc.codigo)) {
    errs.push(`codigo inválido: "${doc.codigo}". Esperado patrón MOV-YYYY-NNNN.`);
  }
  if (!Number.isInteger(doc.anio) || doc.anio < 2000 || doc.anio > 2100) {
    errs.push('anio inválido.');
  }
  if (!doc.tipo) {
    errs.push('tipo es obligatorio.');
  } else if (!enValores(TIPOS_MOVIMIENTO, doc.tipo)) {
    errs.push(`tipo inválido: "${doc.tipo}".`);
  }
  if (!doc.suministro_id) {
    errs.push('suministro_id es obligatorio.');
  } else if (!SUMINISTRO_CODIGO_PATTERN.test(doc.suministro_id)) {
    errs.push(`suministro_id inválido: "${doc.suministro_id}".`);
  }
  if (!Number.isInteger(doc.cantidad) || doc.cantidad < 1) {
    errs.push('cantidad debe ser entero >= 1.');
  }
  if (!doc.transformador_id) errs.push('transformador_id es obligatorio.');
  if (!doc.matricula) errs.push('matricula es obligatoria.');
  if (typeof doc.valor_total !== 'number' || doc.valor_total < 0) {
    errs.push('valor_total debe ser número >= 0.');
  }
  return errs;
}
