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
//
// Registro AUTOMÁTICO (2026-10-07, `99 §148`). Pedido: «al yo generar alguna orden de
// entrada y este involucre los items del contrato 4125000143 automaticamente se refleje
// en indicadores, movimiento, historico». Decisiones suyas: al guardar la orden y al
// abrir el contrato; las correcciones se hacen solas; el equipo (no solo el admin)
// puede registrar. `planificarSincronizacion` suma al plan lo que hay que CORREGIR
// (la orden cambió) y RETIRAR (la orden ya no lo respalda); `diferenciaConOrden` es la
// prueba que se repite dentro de cada transacción con la orden leída en ese instante.
// ══════════════════════════════════════════════════════════════

import { normal, SIN_TRANSFORMADOR, codigoDelItem, unidadComparable } from './ordenes_contrato_nexo.js';

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

/** Milisegundos de un Timestamp de Firestore, un número o nada (0). */
function aMs(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return 0;
}

/**
 * Cantidad de un ítem del contrato en los renglones de una orden, con las MISMAS reglas del nexo:
 * nombre exacto de la lista «Accesorios», unidad del contrato y cantidad mayor que cero.
 */
export function cantidadDelItemEnOrden(items, codigo, unidadCatalogo) {
  const u = unidadComparable(unidadCatalogo);
  const total = (Array.isArray(items) ? items : []).filter((it) => it && codigoDelItem(it.descripcion) === codigo &&
      unidadComparable(it.unidad) === u && Number.isFinite(Number(it.cantidad)) && Number(it.cantidad) > 0)
    .reduce((s, it) => s + Number(it.cantidad), 0);
  return Number(total.toFixed(3));
}

/**
 * ¿La orden, tal como está AHORA, sigue respaldando este movimiento enlazado?
 * Se usa dentro de la transacción que retira un movimiento: nunca se borra con una foto vieja.
 * @param {object} p
 * @param {object|null} p.orden   documento de la orden (o null si ya no existe)
 * @param {object} p.enlace       `orden_es` del movimiento
 * @param {string} p.codigo       Sxx del movimiento
 * @param {number} p.cantidad     cantidad del movimiento
 * @param {string|null} p.unidadCatalogo  unidad del ítem en el contrato (null si no se pudo leer)
 * @param {object} [p.cfg]        NEXO_CONTRATOS[contrato]
 * @returns {string|null} '' = la respalda (no se toca) · texto = por qué ya no · null = no se puede saber (no se toca)
 */
export function diferenciaConOrden({ orden, enlace, codigo, cantidad, unidadCatalogo, cfg } = {}) {
  const oe = enlace || {};
  if (!orden) return 'la orden fue eliminada';
  if (cfg && !cfg.tipos.includes(orden.tipo)) return 'la orden ya no es de un tipo que descuenta del contrato';
  const f = String(orden.fechaISO || '').slice(0, 10);
  if (cfg && (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f < cfg.desde || f > cfg.hasta)) {
    return 'la fecha de la orden quedó fuera de la vigencia del contrato';
  }
  const creado = aMs(orden.creadoEn);
  if (creado > 0 && Number(oe.creadoEn) > 0 && creado !== Number(oe.creadoEn)) return 'la orden se eliminó y se volvió a crear';
  if (f !== String(oe.fechaISO || '')) return `cambió la fecha de la orden (${ddmmaaaa(oe.fechaISO)} → ${ddmmaaaa(f)})`;
  if (normal(orden.transformador) !== normal(oe.transformador)) return 'cambió el transformador de la orden';
  if (unidadCatalogo == null) return null;
  const q = cantidadDelItemEnOrden(orden.items, codigo, unidadCatalogo);
  if (!q) return 'la orden ya no trae este ítem';
  if (q !== Number(cantidad)) return `cambió la cantidad en la orden (${cantidad} → ${q})`;
  return '';
}

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
    const a = armarRegistro(l, { parque, cat, contratoId });
    if (!a.item) { no(a.motivo); continue; }
    if (typeof queda[l.codigo] === 'number') {
      if (l.cantidad > queda[l.codigo]) { no(`supera lo que queda del ítem en el contrato (${queda[l.codigo]})`); continue; }
      queda[l.codigo] -= l.cantidad;
    }
    out.porRegistrar.push(a.item);
    out.valorPorRegistrar += a.item.payload.valor_total;
  }
  return out;
}

/** El movimiento de una línea del nexo (o por qué no se puede registrar). Sin validar existencia. */
function armarRegistro(l, { parque, cat, contratoId }) {
  if (!Number.isInteger(l.cantidad) || l.cantidad < 1) return { motivo: 'la cantidad tiene decimales: un movimiento solo admite enteros' };
  const tr = resolverTransformador(parque, l.matricula, l.subestacion);
  if (!tr.ok) return { motivo: tr.motivo };
  const s = cat.get(l.codigo) || {};
  const marcas = Array.isArray(s.marcas_disponibles) ? s.marcas_disponibles : [];
  const vu = Number.isFinite(+s.valor_unitario) ? +s.valor_unitario : l.valorUnitario;
  const t = tr.trafo;
  return { item: {
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
        creadoEn: l.creadoEn || 0, version: l.version || 0, cantidad: l.cantidad, transformador: l.transformador }
    }
  } };
}

/**
 * Plan del registro AUTOMÁTICO: el de `planificarRegistro` más
 *  · `corregir`: entregas desfasadas (la orden cambió) → se retira el movimiento viejo y se registra
 *    el de la orden (o queda pendiente con su motivo si ya no se puede registrar);
 *  · `retirar`: movimientos enlazados que ninguna orden de la vigencia respalda (orden eliminada,
 *    sin ese ítem, fuera de la vigencia). Cada retiro se vuelve a comprobar en su transacción.
 */
export function planificarSincronizacion({ nexo, parque, catalogo, contratoId, existencias } = {}) {
  const base = planificarRegistro({ nexo, parque, catalogo, contratoId, existencias });
  const plan = { ...base, corregir: [], retirar: [] };
  if (!nexo || !nexo.activo) return plan;
  const cat = new Map((catalogo || []).map((s) => [String(s.codigo || '').toUpperCase(), s]));
  for (const l of base.desfasados) {
    const a = armarRegistro(l, { parque, cat, contratoId });
    plan.corregir.push({ linea: l, ids: (l.movimientoIds || []).slice(), registro: a.item || null, motivo: a.motivo || '' });
  }
  for (const h of nexo.huerfanos || []) if (h.ids && h.ids.length) plan.retirar.push({ ...h, ids: h.ids.slice() });
  return plan;
}

/** ¿Hay algo que hacer? (para no leer el parque ni escribir cuando todo está al día) */
export function hayQueSincronizar(nexo) {
  if (!nexo || !nexo.activo) return false;
  const e = nexo.resumenEstados || {};
  return !!(e.por_registrar || e.desfasado || (nexo.huerfanos && nexo.huerfanos.length));
}

/** Resultado vacío del registro automático. */
export function resultadoVacio() {
  return { registrados: [], corregidos: [], retirados: [], pendientes: [], errores: [], sinPermiso: 0 };
}

/** ¿El registro automático hizo o dejó algo que valga la pena contar? */
export function hayNovedad(r) {
  return !!(r && (r.registrados.length || r.corregidos.length || r.retirados.length || r.pendientes.length || r.errores.length));
}

/**
 * Texto corto, sin jerga, de lo que hizo el registro automático (aviso en Órdenes y en el tablero).
 * @returns {{ texto:string, tipo:'ok'|'warn'|'err' }}
 */
export function textoSincronizacion(r, contratoId) {
  if (!hayNovedad(r)) return { texto: '', tipo: 'ok' };
  const lista = (xs) => xs.length <= 3 ? xs.join(', ') : `${xs[0]} … ${xs[xs.length - 1]}`;
  const partes = [];
  if (r.registrados.length) partes.push(`${r.registrados.length} entrega(s) registrada(s) en Movimientos (${lista(r.registrados.map((x) => x.codigo))})`);
  if (r.corregidos.length) {
    partes.push(`${r.corregidos.length} corregida(s) porque la orden cambió (` +
      r.corregidos.slice(0, 3).map((x) => `${(x.anteriores || []).join(', ') || '—'} → ${x.codigo}`).join('; ') + (r.corregidos.length > 3 ? '; …' : '') + ')');
  }
  if (r.retirados.length) partes.push(`${r.retirados.length} movimiento(s) retirado(s) porque la orden ya no los respalda (${lista(r.retirados.map((x) => x.codigo))})`);
  if (r.pendientes.length) {
    partes.push(`${r.pendientes.length} queda(n) por registrar: ` + r.pendientes.slice(0, 3).map((p) =>
      `${p.linea.codigo} de ${p.linea.tipo} ${p.linea.numero} — ${p.motivo}`).join('; ') + (r.pendientes.length > 3 ? '; …' : ''));
  }
  if (r.errores.length) {
    partes.push(r.sinPermiso
      ? `${r.errores.length} cambio(s) necesitan a un administrador: se harán solos cuando un administrador abra el contrato`
      : `${r.errores.length} no se pudieron hacer ahora (${r.errores[0]}); se reintentan al abrir el contrato`);
  }
  const tipo = r.errores.length ? 'err' : (r.pendientes.length ? 'warn' : 'ok');
  return { texto: `Contrato ${contratoId}: ` + partes.join(' · ') + '.', tipo };
}
