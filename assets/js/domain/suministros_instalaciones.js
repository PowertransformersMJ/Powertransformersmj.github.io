// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Dónde se instaló cada accesorio del contrato (99 §238)
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-27): «me gustaría que al seleccionar cualquier
// accesorio en el dashboard me indique dónde y cuántas cantidades han sido
// instalados».
//
// Reglas (lóbulo de Suministros y Órdenes E/S):
//  · «Instalado» = lo entregado a un transformador: los EGRESOS registrados
//    (manuales, de Brigada o de órdenes) + lo que las órdenes de ENTRADA dicen y
//    todavía no está registrado («por registrar», calculado por el nexo).
//  · El transformador, la subestación, la zona y el departamento salen del
//    MOVIMIENTO (que los tomó del parque) y, para lo por registrar, del PARQUE; solo
//    si el parque no lo ubica, del campo «transformador» de la orden (`99 §147`), con el
//    motivo (leyendo el parque, no se pudo leer, repetido o no hallado). Si esa orden no
//    trae subestación y ya hay UNA fila con la matrícula, se suma a ella.
//    Nunca del destino escrito en la orden.
//  · Los INGRESOS no son instalaciones: se informan aparte.
//  · La suma cuadra EXACTO con la columna −Egresos de «Stock por ítem»: mismas
//    reglas que data/movimientos.js (EGRESO del código exacto con cantidad > 0) más
//    lo pendiente del nexo (`porItemPendiente`), sin contar nada dos veces.
//  · No se suman unidades distintas: todo es del mismo ítem, en su unidad.
//
// Módulo PURO (sin DOM ni Firebase). Las pruebas usan datos inventados.
// ══════════════════════════════════════════════════════════════

import { normal, SIN_TRANSFORMADOR } from './ordenes_contrato_nexo.js';
import { resolverTransformador } from './ordenes_movimientos_registro.js';

/** Colombia no cambia de hora: UTC−5 todo el año. */
const DESFASE_COLOMBIA_MS = 5 * 3600 * 1000;
const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Redondeo a milésimas, como `sumarCantidades` (kg y metros pueden traer decimales). */
const r3 = (n) => Number(Number(n).toFixed(3));
const txt = (v) => String(v == null ? '' : v).trim();

/** Cantidad válida de un movimiento (las mismas reglas de `computarStockDesdeMovimientos`): > 0 o nada. */
function cantidadValida(v) {
  const n = Number.isFinite(+v) ? +v : 0;
  return n > 0 ? n : 0;
}

/** Milisegundos de un Timestamp de Firestore, una fecha, un número o un texto ISO; 0 si no se puede. */
export function aMs(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : 0;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  if (typeof v.toMillis === 'function') { const t = Number(v.toMillis()); return Number.isFinite(t) ? t : 0; }
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((Number(v.nanoseconds) || 0) / 1e6);
  return 0;
}

/** Fecha «AAAA-MM-DD» en hora de Colombia de unos milisegundos ('' si no hay). */
export function fechaColombia(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return new Date(ms - DESFASE_COLOMBIA_MS).toISOString().slice(0, 10);
}

/**
 * Fecha de entrega de un movimiento: `fecha_entrega` si la trae; si no (movimientos manuales
 * anteriores), el día en que se registró, marcado como tal.
 * @returns {{ fecha:string, deRegistro:boolean }}
 */
export function fechaDeMovimiento(m) {
  const f = txt(m && m.fecha_entrega);
  if (ISO_FECHA.test(f)) return { fecha: f, deRegistro: false };
  const reg = fechaColombia(aMs(m && m.createdAt));
  return { fecha: reg, deRegistro: !!reg };
}

/** Grupo de lo que no indica transformador (un egreso sin matrícula, o una orden sin transformador), por zona. */
const claveSinTransformador = (zona) => 'sin|' + normal(zona);
const claveDe = (matricula, subestacion) => normal(matricula) + '|' + normal(subestacion);

/**
 * Por qué la ubicación de lo por registrar sale de la orden y no del parque (para decirlo bien en pantalla).
 * @returns {'leyendo'|'fallo'|'duplicado'|'sin_id'|'no_hallado'}
 */
function motivoSinParque(parqueEstado, tr) {
  if (parqueEstado === 'fallo') return 'fallo';
  if (parqueEstado === 'leyendo') return 'leyendo';
  const m = String((tr && tr.motivo) || '');
  if (/más de una vez/.test(m)) return 'duplicado';
  if (/identificación/.test(m)) return 'sin_id';
  return 'no_hallado';
}

/** Orden de las entregas dentro de un transformador: por fecha (las sin fecha al final), luego orden y movimiento. */
function compararEntregas(a, b) {
  return (!a.fecha - !b.fecha) || a.fecha.localeCompare(b.fecha) ||
    ((a.orden && a.orden.numero) || '').localeCompare((b.orden && b.orden.numero) || '', 'es', { numeric: true }) ||
    (a.estado === b.estado ? 0 : (a.estado === 'registrado' ? -1 : 1)) ||
    (a.movimiento || '').localeCompare(b.movimiento || '');
}

function nuevaFila(clave, base) {
  return {
    clave,
    sinTransformador: !!base.sinTransformador,
    matricula: base.matricula || '',
    subestacion: base.subestacion || '',
    zona: base.zona || '',
    departamento: base.departamento || '',
    ubicacion: base.ubicacion,       // 'movimiento' | 'parque' | 'orden'
    motivoUbicacion: base.motivoUbicacion || '',   // solo con ubicacion 'orden' (ver motivoSinParque)
    cantidad: 0, registrado: 0, porRegistrar: 0,
    entregas: [],
    avisos: []
  };
}

/** Completa zona y departamento que falten (el movimiento manda sobre la orden). */
function completar(fila, base) {
  if (!fila.zona && base.zona) fila.zona = base.zona;
  if (!fila.departamento && base.departamento) fila.departamento = base.departamento;
  if (!fila.subestacion && base.subestacion) fila.subestacion = base.subestacion;
  if (fila.ubicacion === 'orden' && base.ubicacion !== 'orden') {
    // Una entrega registrada (o el parque) confirma la ubicación que solo decía la orden.
    fila.ubicacion = base.ubicacion;
    fila.motivoUbicacion = '';
    fila.matricula = base.matricula || fila.matricula;
    fila.subestacion = base.subestacion || fila.subestacion;
  }
}

/**
 * Dónde se instaló un ítem del contrato y cuánto, agrupado por transformador.
 * @param {object}   p
 * @param {string}   p.codigo          código del ítem (Sxx), tal como está en el catálogo
 * @param {object}   [p.item]          fila del catálogo: { codigo, nombre, unidad }
 * @param {object[]} [p.movimientos]   movimientos del contrato (los mismos del tablero)
 * @param {object}   [p.nexo]          resultado de `calcularNexo` (null sin nexo o sin órdenes leídas)
 * @param {object[]} [p.parque]        parque leído por el tablero (null si no se ha leído)
 * @param {string}   [p.parqueEstado]  'leido' | 'leyendo' | 'fallo' (sin él: leído si `parque` es una lista)
 * @param {number}   [p.egresadoTabla] la columna −Egresos de la tabla, para comprobar que cuadra
 */
export function instalacionesDeItem({ codigo, item, movimientos, nexo, parque, parqueEstado, egresadoTabla } = {}) {
  const cod = txt(codigo);
  const hayParque = Array.isArray(parque);
  const estParque = parqueEstado === 'fallo' ? 'fallo' : (hayParque && parqueEstado !== 'leyendo' ? 'leido' : 'leyendo');
  const it = item || {};
  const unidad = txt(it.unidad) || 'Und';
  const filas = new Map();
  const ingresos = { movimientos: 0, cantidad: 0, codigos: [] };
  let egresadoMov = 0;          // igual que `computarStockDesdeMovimientos`: suma directa
  let pendiente = 0;            // igual que `porItemPendiente`: suma a milésimas, en el orden del nexo
  let sinDesglose = 0;          // lo pendiente de un nexo viejo (en caché) que no trae el detalle por línea

  // Avisos del nexo sobre movimientos enlazados: la orden cambió, o ya no los respalda.
  const desfasadas = new Set();
  const huerfanos = new Set();
  const nexoActivo = !!(nexo && nexo.activo);
  if (nexoActivo) {
    for (const l of (Array.isArray(nexo.lineasDetalle) ? nexo.lineasDetalle : [])) {
      if (l && l.estado === 'desfasado') desfasadas.add(txt(l.claveOrden) + '|' + txt(l.codigo).toUpperCase());
    }
    for (const h of (Array.isArray(nexo.huerfanos) ? nexo.huerfanos : [])) {
      for (const id of (h && h.ids) || []) huerfanos.add('id:' + id);
      for (const c of (h && h.codigos) || []) huerfanos.add('mov:' + c);
    }
  }

  // 1. Movimientos registrados.
  for (const m of (Array.isArray(movimientos) ? movimientos : [])) {
    if (!m || m.suministro_id !== cod) continue;
    const q = cantidadValida(m.cantidad);
    if (!q) continue;
    if (m.tipo === 'INGRESO') {
      ingresos.movimientos++;
      ingresos.cantidad = r3(ingresos.cantidad + q);
      if (txt(m.codigo)) ingresos.codigos.push(txt(m.codigo));
      continue;
    }
    if (m.tipo !== 'EGRESO') continue;
    egresadoMov += q;
    const matricula = txt(m.matricula) || txt(m.transformador_id);
    const base = { matricula, subestacion: txt(m.subestacion), zona: txt(m.zona).toUpperCase(),
      departamento: txt(m.departamento).toLowerCase(), ubicacion: 'movimiento', sinTransformador: !matricula };
    const clave = matricula ? claveDe(matricula, base.subestacion) : claveSinTransformador(base.zona);
    const fila = filas.get(clave) || nuevaFila(clave, base);
    completar(fila, base);
    const { fecha, deRegistro } = fechaDeMovimiento(m);
    const oes = m.orden_es && typeof m.orden_es === 'object' && txt(m.orden_es.clave) ? m.orden_es : null;
    let aviso = '';
    if (oes && desfasadas.has(txt(oes.clave) + '|' + cod.toUpperCase())) aviso = 'desfasado';
    if ((m.id && huerfanos.has('id:' + m.id)) || (txt(m.codigo) && huerfanos.has('mov:' + txt(m.codigo)))) aviso = 'huerfano';
    fila.entregas.push({
      estado: 'registrado', cantidad: q, fecha, deRegistro,
      orden: oes ? { tipo: txt(oes.tipo).toUpperCase(), numero: txt(oes.numero), fecha: txt(oes.fechaISO) } : null,
      movimiento: txt(m.codigo), odt: txt(m.odt), aviso
    });
    fila.registrado += q;
    fila.cantidad += q;
    if (aviso && !fila.avisos.includes(aviso)) fila.avisos.push(aviso);
    filas.set(clave, fila);
  }

  // 2. Lo que las órdenes dicen y todavía no está registrado (solo con el nexo activo).
  if (nexoActivo) {
    if (Array.isArray(nexo.lineasDetalle)) {
      for (const l of nexo.lineasDetalle) {
        if (!l || l.codigo !== cod || !(l.pendiente > 0)) continue;
        pendiente = r3(pendiente + l.pendiente);
        const sinTr = !txt(l.matricula) || l.matricula === SIN_TRANSFORMADOR || String(l.claveTrafo || '').startsWith('|#');
        let base;
        if (sinTr) {
          base = { matricula: '', subestacion: '', zona: txt(l.zona).toUpperCase(), departamento: '', ubicacion: 'orden', sinTransformador: true };
        } else {
          const tr = estParque === 'leido' ? resolverTransformador(parque, l.matricula, l.subestacion) : { ok: false };
          base = tr.ok
            ? { matricula: tr.trafo.matricula || txt(l.matricula), subestacion: tr.trafo.subestacion || txt(l.subestacion),
                zona: txt(tr.trafo.zona).toUpperCase(), departamento: txt(tr.trafo.departamento).toLowerCase(), ubicacion: 'parque' }
            : { matricula: txt(l.matricula), subestacion: txt(l.subestacion), zona: txt(l.zona).toUpperCase(), departamento: '',
                ubicacion: 'orden', motivoUbicacion: motivoSinParque(estParque, tr) };
        }
        let clave = sinTr ? claveSinTransformador(base.zona) : claveDe(base.matricula, base.subestacion);
        if (!sinTr && base.ubicacion === 'orden' && !base.subestacion && !filas.has(clave)) {
          // La orden no dice la subestación y el parque no la ubicó: si ya hay UNA fila con esa matrícula, es ese
          // transformador (no se abre otra fila ni se cuenta dos veces).
          const mismas = [...filas.values()].filter((f) => !f.sinTransformador && normal(f.matricula) === normal(base.matricula));
          if (mismas.length === 1) clave = mismas[0].clave;
        }
        const fila = filas.get(clave) || nuevaFila(clave, base);
        completar(fila, base);
        fila.entregas.push({
          estado: 'por_registrar', cantidad: l.pendiente, fecha: txt(l.fechaISO), deRegistro: false,
          orden: { tipo: txt(l.tipo).toUpperCase(), numero: txt(l.numero), fecha: txt(l.fechaISO) },
          movimiento: '', odt: '', aviso: ''
        });
        fila.porRegistrar += l.pendiente;
        fila.cantidad += l.pendiente;
        filas.set(clave, fila);
      }
    } else {
      // Nexo de un módulo viejo en caché: se sabe cuánto falta, no dónde.
      const p = (nexo.porItemPendiente || nexo.porItem || {})[cod];
      sinDesglose = p && p.cantidad > 0 ? r3(p.cantidad) : 0;
      pendiente = sinDesglose;
    }
  }

  // 3. Filas: la más útil primero (más unidades, luego la entrega más reciente); lo que no indica
  //    transformador, al final (no dice dónde). Dentro de cada fila, una línea por entrega (fecha, orden,
  //    movimiento, cantidad y estado juntos), de la más antigua a la más reciente.
  const lista = [...filas.values()].map((f) => {
    const entregas = f.entregas.slice().sort(compararEntregas);
    const fechas = entregas.map((e) => e.fecha).filter(Boolean);
    return {
      ...f,
      entregas,
      cantidad: r3(f.cantidad), registrado: r3(f.registrado), porRegistrar: r3(f.porRegistrar),
      estado: f.registrado > 0 && f.porRegistrar > 0 ? 'mixto' : (f.porRegistrar > 0 ? 'por_registrar' : 'registrado'),
      fechaReciente: fechas.length ? fechas[fechas.length - 1] : ''
    };
  }).sort((a, b) => (a.sinTransformador - b.sinTransformador) || (b.cantidad - a.cantidad) ||
    b.fechaReciente.localeCompare(a.fechaReciente) ||
    a.subestacion.localeCompare(b.subestacion, 'es') || a.matricula.localeCompare(b.matricula, 'es'));

  const conTr = lista.filter((f) => !f.sinTransformador);
  const registrado = r3(egresadoMov);
  const total = r3(egresadoMov + pendiente);      // = existenciaConOrdenes(...).egresado
  const esperado = typeof egresadoTabla === 'number' && Number.isFinite(egresadoTabla) ? r3(egresadoTabla) : null;
  return {
    codigo: cod,
    nombre: txt(it.nombre),
    unidad,
    total,
    registrado,
    porRegistrar: r3(pendiente),
    sinDesglose,
    transformadores: conTr.length,
    subestaciones: new Set(conTr.map((f) => normal(f.subestacion)).filter(Boolean)).size,
    transformadoresSinSubestacion: conTr.filter((f) => !normal(f.subestacion)).length,
    enTransformadores: r3(conTr.reduce((s, f) => s + f.cantidad, 0)),
    sinTransformador: r3(lista.filter((f) => f.sinTransformador).reduce((s, f) => s + f.cantidad, 0)),
    filas: lista,
    ingresos,
    cuadre: esperado == null ? null : { tabla: esperado, detalle: total, cuadra: Math.abs(esperado - total) < 1e-9 }
  };
}
