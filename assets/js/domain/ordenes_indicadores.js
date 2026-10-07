// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · indicadores por accesorio, zona, motivo y mes
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-06): «que en el segmento de órdenes de entrada y
// salida exista un apartado de indicadores donde se puedan apreciar por
// accesorios, zona, motivo y meses».
//
// Módulo PURO (sin DOM ni Firebase). Reglas que el panel no puede romper:
//  1. NUNCA se suman cantidades de unidades distintas. Un accesorio es la pareja
//     descripción + unidad: «Silica Gel por Kg» en Kg y en UND son dos filas.
//  2. Sin accesorio escogido, las gráficas cuentan ÓRDENES (no dependen de la
//     unidad). Con un accesorio escogido, muestran su CANTIDAD en su unidad.
//  3. La zona se compara sin tildes ni mayúsculas (claveZona): «Occidente» y
//     «OCCIDENTE» son la misma barra.
//  4. Los motivos «Otro» (texto libre) se agrupan en UNA barra; sus textos se
//     listan aparte para no perderlos.
//  5. Los meses sin órdenes se muestran en cero: no desaparecen de la serie.
// ══════════════════════════════════════════════════════════════

import { claveZona } from './ordenes_consolidado.js';

/** Rótulo de la barra que agrupa los motivos escritos a mano. */
export const MOTIVO_OTRO = 'Otro (texto libre)';
/** Opción del formulario que habilita el motivo escrito a mano. */
export const MOTIVO_OTRO_SEL = 'Otro (especificar)';
/** Rótulo de lo que llega vacío. */
export const SIN_DATO = '(sin dato)';

const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
/** Texto comparable: sin tildes, minúsculas y espacios simples. */
export function normal(v) {
  return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Clave de un accesorio: descripción + unidad, comparables. */
export function claveAccesorio(it) {
  const x = it || {};
  return normal(x.descripcion) + '|' + normal(x.unidad);
}

/**
 * Motivo para agrupar: el de la lista cerrada tal cual, o MOTIVO_OTRO si se
 * escribió a mano (opción «Otro» o un texto que no está en la lista, como las
 * órdenes viejas sin `motivoSel`).
 */
export function grupoMotivo(o, cerrados) {
  const x = o || {};
  if (txt(x.motivoSel) === MOTIVO_OTRO_SEL) return MOTIVO_OTRO;
  const m = txt(x.motivo);
  if (!m) return SIN_DATO;
  const lista = Array.isArray(cerrados) ? cerrados : [];
  const igual = lista.find((c) => normal(c) === normal(m));
  return igual ? txt(igual) : (lista.length ? MOTIVO_OTRO : m);
}

/** Mes 'aaaa-mm' de la orden, o '' si no tiene fecha válida. */
export function mesDe(o) {
  const f = txt(o && o.fechaISO);
  return /^\d{4}-\d{2}/.test(f) ? f.slice(0, 7) : '';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** '2026-08' → 'ago 26'. */
export function etiquetaMes(clave) {
  const [a, m] = String(clave).split('-');
  return (MESES[Number(m) - 1] || '?') + ' ' + String(a).slice(2);
}

/**
 * Filtros del panel. Todos opcionales; se combinan con «y».
 * @param {object[]} ordenes
 * @param {{desde?:string, hasta?:string, zona?:string, tipo?:string, motivo?:string, accesorio?:string}} f
 *   desde/hasta: 'aaaa-mm-dd' o 'aaaa-mm' · zona: texto (se normaliza) · tipo: ENTRADA|SALIDA
 *   motivo: rótulo de grupoMotivo · accesorio: claveAccesorio
 */
export function filtrarOrdenes(ordenes, f, cerrados) {
  const F = f || {};
  const z = claveZona(F.zona);
  const desde = txt(F.desde), hasta = txt(F.hasta);
  // 'aaaa-mm' de «hasta» incluye todo ese mes.
  const tope = /^\d{4}-\d{2}$/.test(hasta) ? hasta + '-31' : hasta;
  return (Array.isArray(ordenes) ? ordenes : []).filter((o) => {
    if (!o) return false;
    if (F.tipo && o.tipo !== F.tipo) return false;
    if (z && claveZona(o.zona) !== z) return false;
    if (desde && (!o.fechaISO || o.fechaISO < desde)) return false;
    if (tope && (!o.fechaISO || o.fechaISO > tope)) return false;
    if (F.motivo && grupoMotivo(o, cerrados) !== F.motivo) return false;
    if (F.accesorio && !(o.items || []).some((it) => claveAccesorio(it) === F.accesorio)) return false;
    return true;
  });
}

/** Cantidad del accesorio en la orden (suma sus renglones si se repitió). */
export function cantidadEnOrden(o, clave) {
  let q = 0;
  ((o && o.items) || []).forEach((it) => { if (claveAccesorio(it) === clave) q += Number(it.cantidad) || 0; });
  return Math.round(q * 1000) / 1000;
}

/**
 * Agrupa por una clave. Con `accesorio`, el valor de cada orden es la cantidad
 * de ese accesorio; sin él, cada orden vale 1.
 * @returns {{clave:string, ENTRADA:number, SALIDA:number, total:number, ordenes:number}[]}
 */
export function agrupar(ordenes, claveDe, accesorio) {
  const m = new Map();
  (ordenes || []).forEach((o) => {
    const v = accesorio ? cantidadEnOrden(o, accesorio) : 1;
    const k = txt(claveDe(o)) || SIN_DATO;
    const a = m.get(k) || { clave: k, ENTRADA: 0, SALIDA: 0, total: 0, ordenes: 0 };
    if (o.tipo === 'ENTRADA') a.ENTRADA += v; else if (o.tipo === 'SALIDA') a.SALIDA += v;
    a.total += v; a.ordenes++;
    m.set(k, a);
  });
  const r3 = (n) => Math.round(n * 1000) / 1000;
  return Array.from(m.values())
    .map((a) => ({ ...a, ENTRADA: r3(a.ENTRADA), SALIDA: r3(a.SALIDA), total: r3(a.total) }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave, 'es'));
}

/**
 * Serie mensual continua (los meses vacíos van en cero). Con `accesorio`,
 * cantidades; sin él, órdenes. `rango.desde`/`rango.hasta` ('aaaa-mm…')
 * estiran la serie hasta los bordes del periodo escogido, aunque no haya
 * órdenes ahí. `rango.mesActual` ('aaaa-mm') marca ese mes como «en curso»:
 * todavía no termina y no debe leerse como una caída. `rango.minimo` (el mes de
 * la orden más antigua leída cuando hubo tope de lectura) corta la serie ahí y
 * marca ese mes como «incompleto».
 */
export function serieMensual(ordenes, accesorio, rango) {
  const R = rango || {};
  const con = (ordenes || []).filter((o) => mesDe(o));
  const sinFecha = (ordenes || []).length - con.length;
  const g = new Map(agrupar(con, mesDe, accesorio).map((x) => [x.clave, x]));
  const claves = Array.from(g.keys());
  const borde = (v) => (/^\d{4}-\d{2}/.test(txt(v)) ? txt(v).slice(0, 7) : '');
  if (borde(R.desde)) claves.push(borde(R.desde));
  if (borde(R.hasta)) claves.push(borde(R.hasta));
  if (!con.length || !claves.length) return { serie: [], sinFecha };
  claves.sort();
  // Con tope de lectura, antes del mes más antiguo leído no se sabe nada: no se pinta en cero.
  const minimo = borde(R.minimo);
  if (minimo && claves[0] < minimo) claves[0] = minimo;
  let [a, m] = claves[0].split('-').map(Number);
  const [aF, mF] = claves[claves.length - 1].split('-').map(Number);
  const serie = [];
  while ((a < aF || (a === aF && m <= mF)) && serie.length <= 120) {
    const k = a + '-' + String(m).padStart(2, '0');
    serie.push({ ...(g.get(k) || { clave: k, ENTRADA: 0, SALIDA: 0, total: 0, ordenes: 0 }),
                 etiqueta: etiquetaMes(k), enCurso: k === txt(R.mesActual), incompleto: !!minimo && k === minimo });
    if (m === 12) { m = 1; a++; } else m++;
  }
  return { serie, sinFecha };
}

/**
 * Ranking de accesorios: en cuántas órdenes aparece cada uno (entradas y
 * salidas), con su cantidad en SU unidad y cuántos transformadores tocó.
 * Ordenado por número de órdenes, que no depende de la unidad.
 */
export function porAccesorio(ordenes, grupoDe) {
  const m = new Map();
  (ordenes || []).forEach((o) => {
    const vistos = new Set();
    (o.items || []).forEach((it) => {
      const k = claveAccesorio(it);
      if (!normal(it && it.descripcion)) return;
      const a = m.get(k) || {
        clave: k, descripcion: txt(it.descripcion), unidad: txt(it.unidad) || SIN_DATO,
        grupo: grupoDe ? grupoDe(it) : '',
        ENTRADA: 0, SALIDA: 0, total: 0, cantE: 0, cantS: 0, _tr: new Set(), _zonas: new Set()
      };
      const q = Number(it.cantidad) || 0;
      if (o.tipo === 'ENTRADA') a.cantE += q; else if (o.tipo === 'SALIDA') a.cantS += q;
      if (!vistos.has(k)) {               // una orden cuenta una vez aunque repita el renglón
        vistos.add(k);
        if (o.tipo === 'ENTRADA') a.ENTRADA++; else if (o.tipo === 'SALIDA') a.SALIDA++;
        a.total++;
        if (txt(o.transformador)) a._tr.add(normal(o.transformador));
        if (claveZona(o.zona)) a._zonas.add(claveZona(o.zona));
      }
      m.set(k, a);
    });
  });
  const r3 = (n) => Math.round(n * 1000) / 1000;
  return Array.from(m.values()).map(({ _tr, _zonas, ...a }) => ({
    ...a, cantE: r3(a.cantE), cantS: r3(a.cantS), transformadores: _tr.size, zonas: _zonas.size
  })).sort((a, b) => b.total - a.total || (b.cantE + b.cantS) - (a.cantE + a.cantS) ||
                     a.descripcion.localeCompare(b.descripcion, 'es'));
}

/** Textos de los motivos «Otro», con cuántas órdenes trae cada uno. */
export function motivosOtros(ordenes, cerrados) {
  const m = new Map();
  (ordenes || []).forEach((o) => {
    if (grupoMotivo(o, cerrados) !== MOTIVO_OTRO) return;
    const t = txt(o.motivo) || SIN_DATO;
    const k = normal(t);
    const a = m.get(k) || { texto: t, ordenes: 0 };
    a.ordenes++; m.set(k, a);
  });
  return Array.from(m.values()).sort((a, b) => b.ordenes - a.ordenes || a.texto.localeCompare(b.texto, 'es'));
}

/** Transformadores distintos que aparecen en las órdenes (campo «Transformador»). */
export function transformadoresDistintos(ordenes) {
  const s = new Set();
  (ordenes || []).forEach((o) => { const t = normal(o && o.transformador); if (t) s.add(t); });
  return s.size;
}
