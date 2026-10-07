// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Nexo Contrato ↔ Órdenes de entrada y salida
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-07): «hagas un nexo con el segmento del
// contrato y el segmento de ordenes de entrada y salida y actualices conforme
// a los items cantidades y dinero direccionado para cada transformador».
//
// Decisiones suyas (preview con datos reales, todas las recomendadas):
//  1. Cuentan las órdenes de ENTRADA (bodega Bosque → subestación) fechadas
//     dentro de la vigencia del pedido del contrato. Las SALIDA no tocan el
//     contrato y se informan aparte.
//  2. Solo los 25 nombres EXACTOS de la lista «Accesorios» de Órdenes, que son
//     los ítems S01–S25 del contrato. Bodega Membrillal y los Krenz quedan fuera
//     (se informan en cantidades, sin pesos): no se empareja por parecido.
//  3. Manda la orden firmada: si además hay un egreso manual del mismo ítem al
//     mismo transformador, se AVISA de posible doble registro (no se suma dos veces
//     en silencio, ni se esconde ninguno de los dos).
//  4. El contrato lo CALCULA al abrirse leyendo las órdenes: no se escriben copias.
//
// Módulo PURO (sin DOM ni Firebase): las pruebas usan datos sintéticos (el
// repositorio es público; el caso real vive en la bóveda).
// ══════════════════════════════════════════════════════════════

import { partirTransformador, claveZona } from './ordenes_consolidado.js';
import { sumarCantidades } from './ordenes_items.js';

/** Contratos con nexo: vigencia del pedido y tipos de orden que descuentan. */
export const NEXO_CONTRATOS = Object.freeze({
  '4125000143': Object.freeze({ desde: '2025-12-23', hasta: '2026-12-22', tipos: Object.freeze(['ENTRADA']) })
});

/**
 * Lista «Accesorios» del formulario de Órdenes (assets/js/ordenes-materiales.js)
 * → ítem del contrato. Nombre EXACTO (comparado sin tildes ni mayúsculas).
 * Una prueba de amarre falla si un nombre de esa lista no está aquí ni en EXCLUIDOS.
 */
export const TABLA_ACCESORIOS = Object.freeze({
  'Suministro de coraza': 'S01',
  'Suministro de radiadores': 'S02',
  'Motoventiladores Tipo 1 FN-063': 'S03',
  'Motoventiladores Tipo 2 FN-050': 'S04',
  'Motoventiladores Tipo 3': 'S05',
  'Motoventiladores Tipo 4': 'S06',
  'Bombas de aceite': 'S07',
  'Membrana tanque de expansión': 'S08',
  'Cable protecciones mecánicas': 'S09',
  'Transformador de corriente 5A- Imagen térmica': 'S10',
  'Silica Gel por Kg': 'S11',
  'Recipiente Silica Gel': 'S12',
  'Desecador silica autoregenerable': 'S13',
  'Relé de ruptura de membrana': 'S14',
  'Relé de flujo': 'S15',
  'Indicador de temperatura de aceite': 'S16',
  'Indicador de temperatura devanados': 'S17',
  'Indicador de nivel': 'S18',
  'Gabinete de control': 'S19',
  'Relé Buchholz': 'S20',
  'Válvula de sobrepresión': 'S21',
  'Junction block': 'S22',
  'Buje 13,8 KV': 'S23',
  'Buje 34,5 KV': 'S24',
  'Buje 66/110 KV': 'S25'
});

/** De la lista «Accesorios» pero NO del contrato (motoventiladores de la URE). */
export const EXCLUIDOS = Object.freeze([
  'Motoventilador Trifasico F20 marca Krenz (URE)',
  'Motoventilador Trifasico F26 marca Krenz (URE)'
]);

/** Texto comparable: sin tildes, minúsculas y espacios simples. */
export function normal(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

const POR_NOMBRE = new Map(Object.entries(TABLA_ACCESORIOS).map(([n, c]) => [normal(n), c]));
const EXCLUIDOS_N = new Set(EXCLUIDOS.map(normal));

/** Unidad comparable entre Órdenes (UND, Mts, Kg, GL) y el contrato (Und, Mt, Kg, Gal). */
export function unidadComparable(u) {
  const x = normal(u).replace(/\./g, '');
  if (['und', 'un', 'u', 'unidad', 'unidades'].includes(x)) return 'und';
  if (['m', 'mt', 'mts', 'metro', 'metros'].includes(x)) return 'mt';
  if (['kg', 'k', 'kilo', 'kilos'].includes(x)) return 'kg';
  if (['gl', 'gal', 'galon', 'galones'].includes(x)) return 'gal';
  if (['l', 'lt', 'litro', 'litros'].includes(x)) return 'lt';
  return x;
}

/** Código Sxx del ítem de una orden, o '' si no es un ítem del contrato. */
export function codigoDelItem(descripcion) {
  return POR_NOMBRE.get(normal(descripcion)) || '';
}

/** Clave del transformador sin tildes ni mayúsculas («CURUMANÍ» = «CURUMANI»). */
export function claveTransformador(texto) {
  const { matricula, subestacion } = partirTransformador(texto);
  return normal(matricula) + '|' + normal(subestacion);
}

const MOTIVOS = Object.freeze({
  noContrato: 'no es un ítem del contrato (Bodega Membrillal u otra lista)',
  excluido: 'no es un ítem del contrato (motoventilador de la URE)',
  unidad: 'la unidad de la orden no es la del contrato',
  cantidad: 'cantidad vacía, cero o negativa',
  sinCatalogo: 'el ítem no está en el catálogo cargado del contrato'
});
export const SIN_TRANSFORMADOR = '(la orden no indica transformador)';

/**
 * Lo entregado al contrato por las órdenes E/S.
 * @param {object} p
 * @param {object[]} p.ordenes      órdenes del registro (ordenDesdeRegistro)
 * @param {object[]} p.catalogo     suministros del contrato: { codigo, nombre, unidad, valor_unitario }
 * @param {string}   p.contratoId
 * @param {object[]} [p.movimientos] movimientos del contrato (para el aviso de doble registro)
 * @returns {{ activo:boolean, porItem:object, transformadores:object[], zonas:object[],
 *            totalValor:number, lineas:number, ordenesQueCuentan:number,
 *            noCuentan:{ ordenes:{fueraDeVigencia:number, otroTipo:number, sinItems:number}, materiales:object[] },
 *            avisos:string[] }}
 */
export function calcularNexo({ ordenes, catalogo, contratoId, movimientos } = {}) {
  const cfg = NEXO_CONTRATOS[String(contratoId || '')];
  const vacio = { activo: false, porItem: {}, transformadores: [], zonas: [], totalValor: 0, lineas: 0, ordenesQueCuentan: 0,
    noCuentan: { ordenes: { fueraDeVigencia: 0, otroTipo: 0, sinItems: 0 }, materiales: [] }, avisos: [] };
  if (!cfg) return vacio;
  const cat = new Map((catalogo || []).map((s) => [String(s.codigo || '').toUpperCase(), s]));
  const r = { ...vacio, activo: true, noCuentan: { ordenes: { fueraDeVigencia: 0, otroTipo: 0, sinItems: 0 }, materiales: [] }, avisos: [] };
  const trafos = new Map();
  const fuera = new Map();
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const anotarFuera = (it, motivo) => {
    const k = normal(it.descripcion) + '|' + unidadComparable(it.unidad) + '|' + motivo;
    const x = fuera.get(k) || { descripcion: String(it.descripcion || ''), unidad: String(it.unidad || ''), cantidad: 0, motivo };
    const q = Number(it.cantidad);
    if (Number.isFinite(q) && q > 0) x.cantidad = sumarCantidades(x.cantidad, q);
    fuera.set(k, x);
  };

  for (const o of (Array.isArray(ordenes) ? ordenes : [])) {
    if (!o) continue;
    if (!cfg.tipos.includes(o.tipo)) { r.noCuentan.ordenes.otroTipo++; continue; }
    const f = String(o.fechaISO || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(f) || f < cfg.desde || f > cfg.hasta) { r.noCuentan.ordenes.fueraDeVigencia++; continue; }
    let cuenta = false;
    for (const it of (o.items || [])) {
      const nombreN = normal(it && it.descripcion);
      if (EXCLUIDOS_N.has(nombreN)) { anotarFuera(it, MOTIVOS.excluido); continue; }
      const codigo = codigoDelItem(it && it.descripcion);
      if (!codigo) { anotarFuera(it, MOTIVOS.noContrato); continue; }
      const s = cat.get(codigo);
      if (!s) { anotarFuera(it, MOTIVOS.sinCatalogo); continue; }
      if (unidadComparable(it.unidad) !== unidadComparable(s.unidad)) { anotarFuera(it, MOTIVOS.unidad); continue; }
      const q = Number(it.cantidad);
      if (!Number.isFinite(q) || q <= 0) { anotarFuera(it, MOTIVOS.cantidad); continue; }
      cuenta = true;
      const vu = Number.isFinite(+s.valor_unitario) ? +s.valor_unitario : 0;
      const valor = q * vu;
      // Por ítem del contrato.
      const pi = r.porItem[codigo] || { codigo, nombre: s.nombre || codigo, unidad: s.unidad || '', cantidad: 0, valor: 0, ordenes: 0 };
      pi.cantidad = sumarCantidades(pi.cantidad, q); pi.valor += valor; pi.ordenes++;
      r.porItem[codigo] = pi;
      // Por transformador.
      const { matricula, subestacion } = partirTransformador(o.transformador);
      // Sin transformador: un grupo por zona (no se mezcla con otra zona ni choca con un egreso sin matrícula).
      const kt = String(o.transformador || '').trim() ? claveTransformador(o.transformador) : '|#' + claveZona(o.zona);
      const t = trafos.get(kt) || { clave: kt, matricula: matricula || SIN_TRANSFORMADOR, subestacion, zona: claveZona(o.zona),
        valor: 0, items: new Map(), ordenes: new Map() };
      t.valor += valor;
      const ti = t.items.get(codigo) || { codigo, nombre: s.nombre || codigo, unidad: s.unidad || '', cantidad: 0, valorUnitario: vu, valor: 0 };
      ti.cantidad = sumarCantidades(ti.cantidad, q); ti.valor += valor;
      t.items.set(codigo, ti);
      t.ordenes.set(o.tipo + '|' + o.numero, { numero: String(o.numero || ''), fecha: f.slice(0, 10) });
      trafos.set(kt, t);
      r.totalValor += valor; r.lineas++;
    }
    if (cuenta) r.ordenesQueCuentan++; else r.noCuentan.ordenes.sinItems++;
  }

  r.transformadores = [...trafos.values()].map((t) => ({
    clave: t.clave, matricula: t.matricula, subestacion: t.subestacion, zona: t.zona, valor: r3(t.valor),
    items: [...t.items.values()].map((i) => ({ ...i, valor: r3(i.valor) })).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    ordenes: [...t.ordenes.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
  })).sort((a, b) => b.valor - a.valor || a.matricula.localeCompare(b.matricula, 'es'));
  const zonas = new Map();
  for (const t of r.transformadores) {
    const z = zonas.get(t.zona || '') || { zona: t.zona || '', transformadores: 0, valor: 0 };
    z.valor += t.valor;
    if (t.matricula !== SIN_TRANSFORMADOR) z.transformadores++;
    zonas.set(t.zona || '', z);
  }
  r.zonas = [...zonas.values()].map((z) => ({ ...z, valor: r3(z.valor) })).sort((a, b) => b.valor - a.valor);
  for (const k of Object.keys(r.porItem)) r.porItem[k].valor = r3(r.porItem[k].valor);
  r.totalValor = r3(r.totalValor);
  r.noCuentan.materiales = [...fuera.values()].sort((a, b) => a.motivo.localeCompare(b.motivo) || a.descripcion.localeCompare(b.descripcion, 'es'));

  // Aviso de doble registro: un EGRESO del mismo ítem al mismo transformador también por movimiento.
  const conOrden = new Set();
  for (const t of r.transformadores) for (const i of t.items) conOrden.add(i.codigo + '#' + t.clave);
  const dobles = new Set();
  for (const m of (Array.isArray(movimientos) ? movimientos : [])) {
    if (!m || m.tipo !== 'EGRESO') continue;
    const kt = normal(m.matricula || m.transformador_id) + '|' + normal(m.subestacion);
    const k = String(m.suministro_id || '').toUpperCase() + '#' + kt;
    if (conOrden.has(k)) dobles.add(k);
  }
  if (dobles.size) {
    r.avisos.push(`Posible doble registro: ${dobles.size} ítem(s) entregados a un transformador por orden E/S Y ` +
      'también por un egreso registrado en el contrato (pestaña «Movimiento» o Brigada). Manda la orden: si es la misma ' +
      'entrega, revise ese egreso.');
  }
  return r;
}

/**
 * Existencia de un ítem descontando lo entregado por órdenes (además de los movimientos).
 * @param {{inicial:number, ingresado:number, egresado:number, actual:number}} stock  de movimientos
 * @param {number} entregadoPorOrdenes
 */
export function existenciaConOrdenes(stock, entregadoPorOrdenes) {
  const s = stock || {};
  const ord = Number.isFinite(+entregadoPorOrdenes) && +entregadoPorOrdenes > 0 ? +entregadoPorOrdenes : 0;
  const ini = +s.inicial || 0, ing = +s.ingresado || 0, egr = +s.egresado || 0;
  return {
    inicial: ini, ingresado: ing, egresadoMovimientos: egr, entregadoOrdenes: ord,
    egresado: sumarCantidades(egr, ord),
    actual: Number((ini + ing - egr - ord).toFixed(3))
  };
}
