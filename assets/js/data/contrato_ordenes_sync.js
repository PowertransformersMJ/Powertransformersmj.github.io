// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Registro AUTOMÁTICO de las entregas de Órdenes E/S en el contrato
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-07): «al yo generar alguna orden de entrada y este
// involucre los items del contrato 4125000143 automaticamente se refleje en
// indicadores, movimiento, historico todo lo referente en control y gestion operativa».
// Decisiones suyas (`99 §148`): se hace AL GUARDAR la orden (y al eliminarla) y AL ABRIR
// el contrato; las correcciones se hacen solas; el equipo puede registrar.
//
// Un solo motor para los dos caminos:
//  · `sincronizarOrden(clave)`: Órdenes E/S, justo después de guardar/editar/eliminar/subir.
//    Lee solo esa orden, sus movimientos enlazados y el catálogo del contrato.
//  · `sincronizarContrato({...})`: tablero del contrato, con los datos que ya leyó.
// Cada escritura es una transacción idempotente con id fijo (data/movimientos.js): dos
// personas a la vez no duplican, y un retiro se vuelve a comprobar contra la orden del
// instante. Si algo falla, la entrega sigue contando como «por registrar» (vista calculada)
// y se reintenta en la próxima apertura: el fallo nunca bloquea guardar la orden.
// ══════════════════════════════════════════════════════════════

// Por espacio de nombres: con un data/movimientos.js viejo en caché faltan las funciones nuevas (`30 L-85`).
import * as movimientosApi from './movimientos.js';
import { obtener as obtenerOrden } from './ordenes_materiales.js';
import { listar as listarSuministros } from './suministros.js';
import { calcularNexo, NEXO_CONTRATOS, codigoDelItem } from '../domain/ordenes_contrato_nexo.js';
// También por espacio de nombres: un ordenes_movimientos_registro.js viejo en caché no impide cargar.
import * as REGM from '../domain/ordenes_movimientos_registro.js';

/** Una sola sincronización a la vez en esta pestaña (guardar dos órdenes seguidas no se pisa). */
let cola = Promise.resolve();
function enCola(fn) {
  const p = cola.then(fn, fn);
  cola = p.catch(() => {});
  return p;
}

function mensaje(e) {
  if (e && e.name === 'StockInsuficienteError') return `no alcanza la existencia del ítem (faltan ${e.faltante})`;
  if (String(e && e.code) === 'permission-denied') return 'su usuario no tiene permiso para este cambio';
  return (e && e.message) || String(e);
}

function apiLista() {
  return typeof REGM.planificarSincronizacion === 'function' && typeof REGM.resultadoVacio === 'function' &&
    typeof movimientosApi.registrarDesdeOrden === 'function' &&
    typeof movimientosApi.retirarMovimientoDeOrden === 'function' &&
    typeof movimientosApi.listarEnlazadosDeOrden === 'function';
}

/**
 * Ejecuta un plan de `planificarSincronizacion`: primero retira lo que ninguna orden respalda,
 * luego corrige lo desfasado (retira el viejo y registra el de la orden), y al final registra lo pendiente.
 */
export async function ejecutarPlan(plan, uid) {
  const r = REGM.resultadoVacio();
  if (!plan) return r;
  const nombre = (l) => `${l.codigo} de ${l.tipo} ${l.numero}`;
  const fallo = (que, e) => {
    if (String(e && e.code) === 'permission-denied') r.sinPermiso++;
    r.errores.push(`${que}: ${mensaje(e)}`);
  };
  const registrar = async (item, anteriores) => {
    try {
      const x = await movimientosApi.registrarDesdeOrden(item, uid);
      if (x.estado === 'registrado') {
        const hecho = { codigo: x.codigo, linea: item.linea, valor: item.payload.valor_total };
        if (anteriores) r.corregidos.push({ ...hecho, anteriores: anteriores.map((v) => v.codigo) });
        else r.registrados.push(hecho);
      } else if (x.estado === 'orden_cambio') {
        r.pendientes.push({ linea: item.linea, motivo: x.motivo });
      }
    } catch (e) {
      if (e && e.name === 'StockInsuficienteError') r.pendientes.push({ linea: item.linea, motivo: mensaje(e) });
      else fallo(nombre(item.linea), e);
    }
  };
  for (const h of plan.retirar || []) {
    for (const id of h.ids) {
      try {
        const x = await movimientosApi.retirarMovimientoDeOrden(id, uid);
        if (x.estado === 'retirado') r.retirados.push({ codigo: x.codigo, motivo: x.motivo });
      } catch (e) { fallo((h.codigos && h.codigos.join(', ')) || id, e); }
    }
  }
  for (const c of plan.corregir || []) {
    let libre = true;
    const viejos = [];
    for (const id of c.ids) {
      try {
        const x = await movimientosApi.retirarMovimientoDeOrden(id, uid);
        if (x.estado === 'retirado') viejos.push({ codigo: x.codigo, motivo: x.motivo });
        else if (x.estado === 'vigente') libre = false;          // otra persona ya lo corrigió
      } catch (e) { libre = false; fallo(nombre(c.linea), e); }
    }
    const antes = r.corregidos.length;
    if (libre && c.registro) await registrar(c.registro, viejos);
    else if (libre) r.pendientes.push({ linea: c.linea, motivo: c.motivo });
    if (r.corregidos.length === antes) r.retirados.push(...viejos);   // retirado sin reemplazo (queda pendiente)
  }
  for (const it of plan.porRegistrar || []) await registrar(it, null);
  for (const x of plan.noRegistrables || []) r.pendientes.push({ linea: x.linea, motivo: x.motivo });
  return r;
}

/**
 * Tablero del contrato: con los datos que ya leyó, registra lo pendiente, corrige lo desfasado y
 * retira lo huérfano. No hace nada (ni escribe) si todo está al día.
 * `corte`: si la lectura de órdenes salió recortada (más de 500), la fecha más antigua leída; lo enlazado
 * a órdenes de esa fecha o anteriores no se toma por huérfano (no se pudo comprobar).
 * @returns {Promise<object|null>} resultado (ver resultadoVacio) o null si no había nada que hacer
 */
export function sincronizarContrato({ contratoId, ordenes, catalogo, movimientos, parque, existencias, uid, corte }) {
  return enCola(async () => {
    if (!NEXO_CONTRATOS[contratoId] || !apiLista() || !Array.isArray(parque)) return null;
    const nexo = calcularNexo({ ordenes, catalogo, contratoId, movimientos, corte });
    if (!REGM.hayQueSincronizar(nexo)) return null;
    const plan = REGM.planificarSincronizacion({ nexo, parque, catalogo, contratoId, existencias });
    return ejecutarPlan(plan, uid);
  });
}

/**
 * Órdenes E/S: refleja UNA orden en los contratos con nexo, justo después de guardarla, editarla,
 * subirla o eliminarla. Lee la orden FRESCA del registro (su creación y versión exactas).
 * @returns {Promise<Array<{contratoId:string, resultado:object}>>} solo los contratos donde hubo algo
 */
export function sincronizarOrden({ clave, parque, uid }) {
  return enCola(async () => {
    const tipo = String(clave || '').split('_')[0];
    const cids = Object.keys(NEXO_CONTRATOS).filter((cid) => NEXO_CONTRATOS[cid].tipos.includes(tipo));
    if (!cids.length || !apiLista()) return [];
    const [{ orden }, enlazados] = await Promise.all([obtenerOrden(clave), movimientosApi.listarEnlazadosDeOrden(clave)]);
    const traeItems = !!orden && (orden.items || []).some((it) => codigoDelItem(it && it.descripcion));
    if (!traeItems && !enlazados.length) return [];
    const out = [];
    for (const cid of cids) {
      const movs = enlazados.filter((m) => String(m.contrato_id || '') === cid);
      if (!traeItems && !movs.length) continue;
      const catalogo = await listarSuministros({ contrato_id: cid });
      const nexo = calcularNexo({ ordenes: orden ? [orden] : [], catalogo, contratoId: cid, movimientos: movs });
      if (!REGM.hayQueSincronizar(nexo)) continue;
      const plan = REGM.planificarSincronizacion({ nexo, parque: parque || [], catalogo, contratoId: cid });
      // Sin el parque (no cargó en la página) no se ubica el transformador: solo se hacen los retiros, que no lo
      // necesitan. Las correcciones y registros quedan para la apertura del contrato (como en el tablero): así una
      // corrección nunca retira el movimiento viejo sin poder registrar el nuevo.
      let diferidas = 0;
      if (!Array.isArray(parque)) {
        diferidas = plan.corregir.length + plan.porRegistrar.length + plan.noRegistrables.length;
        plan.corregir = []; plan.porRegistrar = []; plan.noRegistrables = [];
      }
      if (!plan.retirar.length && !plan.corregir.length && !plan.porRegistrar.length && !plan.noRegistrables.length && !diferidas) continue;
      const resultado = await ejecutarPlan(plan, uid);
      resultado.diferidas = diferidas;
      out.push({ contratoId: cid, resultado });
    }
    return out;
  });
}
