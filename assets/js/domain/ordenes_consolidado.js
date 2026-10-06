// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · zona y consolidado de entregas
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-06): «un filtro por zona, y adicionalmente
// me permita exportar un consolidado en excel de todos los suministros que
// han sido entregados y sobre que transformador y subestacion».
//
// Módulo PURO (sin DOM ni Firebase). Desde el mismo día (segundo pedido: «permíteme
// escoger primero si es orden de entrada o salida») el consolidado es del TIPO que él
// escoge: ENTRADA, SALIDA o ambos. En su uso real las órdenes de ENTRADA también
// llevan material de la bodega a la subestación (OCCIDENTE: BOSQUE → COROZAL…),
// así que no se presume cuál es «entrega»: se le pregunta. El transformador y su
// subestación salen SOLO del campo «Transformador» de la orden, que el
// formulario escribe como «MATRÍCULA · S/E SUBESTACIÓN». Si la orden no lo
// trae, se dice; NO se deduce del destino (puede ser una bodega).
// ══════════════════════════════════════════════════════════════

/** Rótulo de las órdenes sin transformador en el consolidado. */
export const SIN_TRANSFORMADOR = '(la orden no indica transformador)';

/** Zona comparable: sin tildes, en mayúsculas y sin espacios de más («Bolívar» = «BOLIVAR»). */
export function claveZona(z) {
  return String(z == null ? '' : z)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Zonas presentes en las órdenes, sin repetir y en orden alfabético. */
export function zonasDe(ordenes) {
  const s = new Set();
  (Array.isArray(ordenes) ? ordenes : []).forEach((o) => { const z = claveZona(o && o.zona); if (z) s.add(z); });
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
}

/** ¿La orden es de la zona pedida? Sin zona pedida, todas lo son. */
export function enZona(o, zona) {
  const z = claveZona(zona);
  return !z || claveZona(o && o.zona) === z;
}

/**
 * Separa el texto del campo «Transformador» en matrícula y subestación.
 * «T1-M/M-MAM · S/E MAMONAL» → { matricula: 'T1-M/M-MAM', subestacion: 'MAMONAL' }.
 * Un texto escrito de otra forma queda entero como matrícula, sin subestación.
 */
export function partirTransformador(texto) {
  const t = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim();
  if (!t) return { matricula: '', subestacion: '' };
  const m = t.match(/^(.*?)\s*·\s*S\/E\s*(.*)$/i);
  if (m) return { matricula: m[1].trim(), subestacion: m[2].trim() };
  return { matricula: t, subestacion: '' };
}

const nombre = (p) => String((p && p.nombre) || '').trim();
const txt = (v) => String(v == null ? '' : v).trim();

/** Tipos que se pueden consolidar. */
export const TIPOS_CONSOLIDADO = Object.freeze(['ENTRADA', 'SALIDA', 'AMBAS']);

/** ¿La orden es del tipo pedido? 'AMBAS' acepta entrada y salida. */
export function deTipo(o, tipo) {
  const t = String(tipo || '').toUpperCase();
  return t === 'AMBAS' ? (o.tipo === 'ENTRADA' || o.tipo === 'SALIDA') : o.tipo === t;
}

/**
 * Una fila por material de las órdenes del TIPO pedido (ENTRADA, SALIDA o AMBAS) y de la zona pedida.
 * Orden: zona, subestación (las órdenes sin transformador al final), transformador, tipo, fecha y número.
 */
export function filasConsolidado(ordenes, opciones) {
  const zona = opciones && opciones.zona;
  const tipo = (opciones && opciones.tipo) || 'SALIDA';
  const filas = [];
  (Array.isArray(ordenes) ? ordenes : []).forEach((o) => {
    if (!o || !deTipo(o, tipo) || !enZona(o, zona)) return;
    const tr = partirTransformador(o.transformador);
    (Array.isArray(o.items) ? o.items : []).forEach((it, i) => {
      filas.push({
        tipo: o.tipo, fechaISO: txt(o.fechaISO), fecha: txt(o.fecha), numero: txt(o.numero), zona: claveZona(o.zona),
        subestacion: tr.subestacion, transformador: tr.matricula, conTransformador: !!tr.matricula,
        origen: txt(o.origen), destino: txt(o.destino), item: i + 1,
        codigo: txt(it && it.codigo), descripcion: txt(it && it.descripcion), unidad: txt(it && it.unidad),
        cantidad: Number(it && it.cantidad) || 0, motivo: txt(o.motivo),
        entrego: nombre(o.entregado), recibio: nombre(o.recibido)
      });
    });
  });
  const vacioAlFinal = (a, b) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0) || a.localeCompare(b, 'es');
  filas.sort((a, b) =>
    a.zona.localeCompare(b.zona, 'es') ||
    vacioAlFinal(a.subestacion, b.subestacion) ||
    vacioAlFinal(a.transformador, b.transformador) ||
    a.tipo.localeCompare(b.tipo) ||
    a.fechaISO.localeCompare(b.fechaISO) ||
    a.numero.localeCompare(b.numero, 'es', { numeric: true }) ||
    a.item - b.item);
  return filas;
}

/** Lo publicado primero (solo SALIDA): se conserva con el mismo comportamiento. */
export function filasEntregas(ordenes, opciones) {
  return filasConsolidado(ordenes, { zona: opciones && opciones.zona, tipo: 'SALIDA' });
}

/**
 * Resumen: cuánto de cada material se entregó a cada transformador (zona →
 * subestación → transformador → material), con el número de órdenes y la
 * última fecha. Unidades distintas del mismo material NO se suman.
 */
export function resumenPorTransformador(filas) {
  const m = new Map();
  const n = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  (Array.isArray(filas) ? filas : []).forEach((f) => {
    // Entradas y salidas del mismo material no se mezclan: cada tipo, su fila.
    const k = [f.zona, f.subestacion, f.transformador, f.tipo, n(f.descripcion), n(f.unidad)].join('|');
    const a = m.get(k) || {
      tipo: f.tipo, zona: f.zona, subestacion: f.subestacion, transformador: f.transformador, conTransformador: f.conTransformador,
      codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, cantidad: 0, ordenes: new Set(), ultima: ''
    };
    a.cantidad = Number((a.cantidad + f.cantidad).toFixed(3));
    a.ordenes.add(f.numero);
    if (f.fechaISO > a.ultima) a.ultima = f.fechaISO;
    m.set(k, a);
  });
  return Array.from(m.values()).map((a) => ({ ...a, ordenes: a.ordenes.size }));
}
