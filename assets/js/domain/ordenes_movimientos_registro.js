// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Registro en Movimientos de las entregas de Órdenes E/S
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-07): «registra en movimientos donde se han
// instalado estos accesorios». Decisiones suyas (`99 §147`): cada entrega de una
// orden de ENTRADA con ítems del contrato se escribe como EGRESO enlazado a su
// orden (`orden_es`), con el transformador, la subestación, la zona y el
// departamento tomados del PARQUE; un solo consecutivo MOV por año; manda la
// orden (si cambia después, la línea queda «desfasada» y nunca se adivina).
//
// Módulo PURO: arma el plan a partir del resultado de `calcularNexo` (que ya sabe
// qué está registrado, qué falta y qué cambió). La escritura vive en
// data/movimientos.js#registrarDesdeOrden, una transacción por línea.
// ══════════════════════════════════════════════════════════════

import { normal, SIN_TRANSFORMADOR } from './ordenes_contrato_nexo.js';

/** Usuario con el que quedan los movimientos que vienen de una orden (no es una persona). */
export const USUARIO_ORDENES = 'Órdenes E/S';

/** Id fijo del movimiento de una (orden, ítem): repetir el registro no duplica. */
export function idMovimientoDeOrden(contratoId, claveOrden, codigo) {
  return ['oes', contratoId, claveOrden, codigo].map((x) => String(x || '').replace(/\//g, '~')).join('_');
}

/** Datos de ubicación de un transformador del parque, sea cual sea la forma del documento. */
export function ubicacionParque(t) {
  const x = t || {};
  const id = x.identificacion || {};
  const ub = x.ubicacion || {};
  return {
    id: String(x.id || x.docId || ''),
    matricula: String(id.matricula || x.matricula || x.codigo || ''),
    subestacion: String(ub.subestacion_nombre || x.subestacion || ''),
    zona: String(ub.zona || x.zona || '').toUpperCase(),
    departamento: String(ub.departamento || x.departamento || '').toLowerCase()
  };
}

/**
 * El transformador del parque que corresponde a la orden: matrícula + subestación
 * (sin tildes ni mayúsculas). La matrícula sola no basta: una aparece en dos
 * subestaciones. Sin S/E en la orden, solo vale si la matrícula es única.
 * @returns {{ ok:true, trafo:object } | { ok:false, motivo:string }}
 */
export function resolverTransformador(parque, matricula, subestacion) {
  if (!String(matricula || '').trim() || matricula === SIN_TRANSFORMADOR) return { ok: false, motivo: 'la orden no indica transformador' };
  const lista = (Array.isArray(parque) ? parque : []).map(ubicacionParque);
  const conMat = lista.filter((t) => normal(t.matricula) === normal(matricula));
  const cand = String(subestacion || '').trim() ? conMat.filter((t) => normal(t.subestacion) === normal(subestacion)) : conMat;
  if (!cand.length) return { ok: false, motivo: 'el transformador de la orden no aparece en el parque' };
  if (cand.length > 1) return { ok: false, motivo: 'el transformador de la orden aparece más de una vez en el parque' };
  if (!cand[0].id) return { ok: false, motivo: 'el transformador del parque no tiene identificación' };
  return { ok: true, trafo: cand[0] };
}

const ddmmaaaa = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');

/**
 * Plan de registro (sin escribir nada).
 * @param {object} p
 * @param {object} p.nexo         resultado de calcularNexo({ ..., movimientos }) — trae `lineasDetalle`
 * @param {object[]} p.parque     transformadores del parque
 * @param {object[]} p.catalogo   suministros del contrato (codigo, nombre, marcas_disponibles, valor_unitario)
 * @param {string}   p.contratoId
 * @param {Object<string, number>} [p.existencias] existencia por movimientos de cada Sxx (si se conoce)
 * @returns {{ porRegistrar:object[], noRegistrables:object[], desfasados:object[], registrados:object[], valorPorRegistrar:number }}
 */
export function planificarRegistro({ nexo, parque, catalogo, contratoId, existencias } = {}) {
  const out = { porRegistrar: [], noRegistrables: [], desfasados: [], registrados: [], valorPorRegistrar: 0 };
  if (!nexo || !nexo.activo) return out;
  const cat = new Map((catalogo || []).map((s) => [String(s.codigo || '').toUpperCase(), s]));
  const queda = { ...(existencias || {}) };
  for (const l of nexo.lineasDetalle || []) {
    if (l.estado === 'registrado') { out.registrados.push(l); continue; }
    if (l.estado === 'desfasado') { out.desfasados.push(l); continue; }
    const no = (motivo) => out.noRegistrables.push({ linea: l, motivo });
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1) { no('la cantidad tiene decimales: un movimiento solo admite enteros'); continue; }
    const tr = resolverTransformador(parque, l.matricula, l.subestacion);
    if (!tr.ok) { no(tr.motivo); continue; }
    if (typeof queda[l.codigo] === 'number') {
      if (l.cantidad > queda[l.codigo]) { no(`supera lo que queda del ítem en el contrato (${queda[l.codigo]})`); continue; }
      queda[l.codigo] -= l.cantidad;
    }
    const s = cat.get(l.codigo) || {};
    const marcas = Array.isArray(s.marcas_disponibles) ? s.marcas_disponibles : [];
    const vu = Number.isFinite(+s.valor_unitario) ? +s.valor_unitario : l.valorUnitario;
    const t = tr.trafo;
    out.porRegistrar.push({
      docId: idMovimientoDeOrden(contratoId, l.claveOrden, l.codigo),
      linea: l,
      payload: {
        contrato_id: String(contratoId),
        anio: Number(l.fechaISO.slice(0, 4)),
        tipo: 'EGRESO',
        suministro_id: l.codigo,
        suministro_nombre: s.nombre || l.nombre,
        marca: marcas.length === 1 ? marcas[0] : '',
        cantidad: l.cantidad,
        valor_unitario: vu,
        valor_total: l.cantidad * vu,
        transformador_id: t.id,
        matricula: t.matricula,
        subestacion: t.subestacion,
        zona: t.zona,
        departamento: t.departamento,
        odt: '',
        usuario: USUARIO_ORDENES,
        // Nunca empieza por «Acción »: así el tablero de Brigada no lo toma como suyo.
        observaciones: `Entregado según orden de ${l.tipo} N.º ${l.numero} del ${ddmmaaaa(l.fechaISO)} · S/E ${t.subestacion}`,
        fecha_entrega: l.fechaISO,
        orden_es: { clave: l.claveOrden, tipo: l.tipo, numero: l.numero, fechaISO: l.fechaISO,
          creadoEn: l.creadoEn || 0, cantidad: l.cantidad, transformador: l.transformador }
      }
    });
    out.valorPorRegistrar += l.cantidad * vu;
  }
  return out;
}
