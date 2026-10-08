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
//     → Actualizado (2026-10-07, `99 §147`): por decisión suya, cada entrega se REGISTRA además
//       como movimiento enlazado a su orden (`orden_es`). Lo registrado descuenta como movimiento;
//       lo que falta por registrar sigue calculándose aquí. Nunca se cuenta dos veces.
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
 * @param {string}   [p.corte]  si la lectura de órdenes salió recortada (más de 500): la fecha más antigua
 *                   leída. Lo enlazado a órdenes de esa fecha o anteriores NO se toma por huérfano: su orden
 *                   puede existir y simplemente no vino en la lectura.
 * @returns {{ activo:boolean, porItem:object, transformadores:object[], zonas:object[],
 *            totalValor:number, lineas:number, ordenesQueCuentan:number,
 *            noCuentan:{ ordenes:{fueraDeVigencia:number, otroTipo:number, sinItems:number}, materiales:object[] },
 *            avisos:string[] }}
 */
export function calcularNexo({ ordenes, catalogo, contratoId, movimientos, corte } = {}) {
  const cfg = NEXO_CONTRATOS[String(contratoId || '')];
  const vacio = { activo: false, porItem: {}, transformadores: [], zonas: [], totalValor: 0, lineas: 0, ordenesQueCuentan: 0,
    noCuentan: { ordenes: { fueraDeVigencia: 0, otroTipo: 0, sinItems: 0 }, materiales: [] }, avisos: [],
    porItemPendiente: {}, totalPendiente: 0, totalRegistrado: 0, lineasDetalle: [], resumenEstados: { registrado: 0, por_registrar: 0, desfasado: 0 },
    huerfanos: [] };
  if (!cfg) return vacio;
  const cat = new Map((catalogo || []).map((s) => [String(s.codigo || '').toUpperCase(), s]));
  const r = { ...vacio, activo: true, noCuentan: { ordenes: { fueraDeVigencia: 0, otroTipo: 0, sinItems: 0 }, materiales: [] }, avisos: [],
    porItemPendiente: {}, lineasDetalle: [], resumenEstados: { registrado: 0, por_registrar: 0, desfasado: 0 }, huerfanos: [] };
  const trafos = new Map();
  const pares = new Map();        // (orden, Sxx): dos renglones del mismo ítem en una orden suman uno solo
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
      t.ordenes.set(o.tipo + '|' + o.numero, { numero: String(o.numero || ''), fecha: f.slice(0, 10), clave: String(o.clave || '') });
      trafos.set(kt, t);
      const kp = String(o.clave || (o.tipo + '_' + o.numero)) + '|' + codigo;
      const par = pares.get(kp) || { claveOrden: String(o.clave || (o.tipo + '_' + o.numero)), tipo: o.tipo, numero: String(o.numero || ''),
        fechaISO: f.slice(0, 10), creadoEn: Number(o.creadoEn) || 0, version: Number.isInteger(o.version) ? o.version : 0, codigo, nombre: s.nombre || codigo, unidad: s.unidad || '',
        cantidad: 0, valorUnitario: vu, transformador: String(o.transformador || '').trim(), matricula, subestacion,
        zona: claveZona(o.zona), claveTrafo: kt };
      par.cantidad = sumarCantidades(par.cantidad, q);
      pares.set(kp, par);
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

  // Movimientos enlazados a su orden (`orden_es`): lo registrado descuenta como movimiento; aquí solo
  // queda lo PENDIENTE. Un movimiento enlazado nunca dispara el aviso de doble registro.
  const enlazados = new Map();
  for (const m of (Array.isArray(movimientos) ? movimientos : [])) {
    if (!m || m.tipo !== 'EGRESO' || !m.orden_es || !m.orden_es.clave) continue;
    if (m.contrato_id && String(m.contrato_id) !== String(contratoId)) continue;
    const k = String(m.orden_es.clave) + '|' + String(m.suministro_id || '').toUpperCase();
    const e = enlazados.get(k) || { cantidad: 0, codigos: [], ids: [], enlace: m.orden_es, valor: 0,
      claveOrden: String(m.orden_es.clave), codigo: String(m.suministro_id || '').toUpperCase() };
    e.cantidad = sumarCantidades(e.cantidad, Number(m.cantidad) || 0);
    e.valor += Number(m.valor_total) || 0;
    if (m.codigo) e.codigos.push(String(m.codigo));
    if (m.id) e.ids.push(String(m.id));
    enlazados.set(k, e);
  }
  const usados = new Set();
  let totalPend = 0, totalReg = 0;
  for (const [k, par] of [...pares.entries()].sort((a, b) => a[1].fechaISO.localeCompare(b[1].fechaISO) ||
       a[1].numero.localeCompare(b[1].numero) || a[1].codigo.localeCompare(b[1].codigo))) {
    const e = enlazados.get(k);
    if (e) usados.add(k);
    const registrado = e ? e.cantidad : 0;
    const pendiente = Math.max(0, Number((par.cantidad - registrado).toFixed(3)));
    let estado = 'por_registrar';
    if (registrado > 0) {
      const cambio = registrado !== par.cantidad ||
        normal(e.enlace.transformador) !== normal(par.transformador) ||
        String(e.enlace.fechaISO || '') !== par.fechaISO ||
        (Number(e.enlace.creadoEn) > 0 && par.creadoEn > 0 && Math.floor(Number(e.enlace.creadoEn)) !== Math.floor(par.creadoEn));
      estado = cambio ? 'desfasado' : 'registrado';
    }
    r.resumenEstados[estado]++;
    if (pendiente > 0) {
      const pi = r.porItemPendiente[par.codigo] || { codigo: par.codigo, cantidad: 0, valor: 0 };
      pi.cantidad = sumarCantidades(pi.cantidad, pendiente); pi.valor += pendiente * par.valorUnitario;
      r.porItemPendiente[par.codigo] = pi;
      totalPend += pendiente * par.valorUnitario;
    }
    if (e) totalReg += e.valor;
    r.lineasDetalle.push({ ...par, valor: r3(par.cantidad * par.valorUnitario), estado, registrado, pendiente,
      movimientos: e ? e.codigos.slice().sort() : [], movimientoIds: e ? e.ids.slice() : [] });
  }
  r.totalPendiente = r3(totalPend);
  r.totalRegistrado = r3(totalReg);
  // Estado por orden dentro de cada transformador (para la sección del tablero).
  const estadoDe = new Map(r.lineasDetalle.map((l) => [l.claveOrden + '|' + l.claveTrafo, []]));
  for (const l of r.lineasDetalle) estadoDe.get(l.claveOrden + '|' + l.claveTrafo).push(l);
  for (const t of r.transformadores) {
    t.ordenes = t.ordenes.map((o) => {
      const ls = estadoDe.get(o.clave + '|' + t.clave) || [];
      const est = new Set(ls.map((l) => l.estado));
      return { ...o, estado: est.size === 1 ? [...est][0] : (est.has('desfasado') ? 'desfasado' : 'mixto'),
        movimientos: ls.flatMap((l) => l.movimientos) };
    });
  }
  const corteF = /^\d{4}-\d{2}-\d{2}$/.test(String(corte || '')) ? String(corte) : '';
  const huerfanos = [...enlazados.entries()].filter(([k, e]) => !usados.has(k) &&
    !(corteF && String((e.enlace && e.enlace.fechaISO) || '') <= corteF));
  // Para el registro automático (`99 §148`): cada huérfano con sus ids, para retirarlo si la orden ya no lo respalda.
  r.huerfanos = huerfanos.map(([, e]) => ({ claveOrden: e.claveOrden, codigo: e.codigo, ids: e.ids.slice(),
    codigos: e.codigos.slice().sort(), cantidad: e.cantidad, valor: r3(e.valor), enlace: e.enlace }));
  if (huerfanos.length) {
    const valorH = huerfanos.reduce((s, [, e]) => s + e.valor, 0);
    r.avisos.push(`${huerfanos.length} movimiento(s) enlazado(s) a una orden que ya no existe, ya no trae ese ítem o quedó fuera ` +
      `de la vigencia (${huerfanos.flatMap(([, e]) => e.codigos).join(', ')}; ${Math.round(valorH).toLocaleString('es-CO')} pesos). ` +
      'Se retiran solos cuando la orden ya no los respalda (al guardarla o al abrir el contrato); mientras tanto siguen contando como ' +
      'movimiento: si la orden se rehízo con otro número, esa entrega se está descontando dos veces hasta que se retire.');
  }
  if (r.resumenEstados.desfasado) {
    r.avisos.push(`${r.resumenEstados.desfasado} entrega(s) cambiaron en la orden después de registradas. Manda la orden: ` +
      'se corrigen solas (se elimina el movimiento viejo con su justificación y se registra el de la orden); mientras tanto se descuenta solo lo que falte.');
  }

  // Aviso de doble registro: un EGRESO NO enlazado (manual o de Brigada) del mismo ítem al mismo transformador
  // que una entrega por orden (registrada o no).
  const conOrden = new Set();
  for (const t of r.transformadores) for (const i of t.items) conOrden.add(i.codigo + '#' + t.clave);
  const dobles = new Set();
  for (const m of (Array.isArray(movimientos) ? movimientos : [])) {
    if (!m || m.tipo !== 'EGRESO') continue;
    // Un enlazado que SÍ casó con su orden no es doble registro; un huérfano (orden rehecha con otro
    // número, ítem cambiado) sí entra al chequeo contra las entregas por orden.
    if (m.orden_es && m.orden_es.clave &&
        usados.has(String(m.orden_es.clave) + '|' + String(m.suministro_id || '').toUpperCase())) continue;
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
