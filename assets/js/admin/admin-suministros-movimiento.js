// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Admin · Movimiento de Suministros (F45 · multi-línea PM6)
// ──────────────────────────────────────────────────────────────
// Formulario INGRESO/EGRESO con autocomplete cascada y validación
// atómica de stock por línea (runTransaction vive en
// data/movimientos.js#crear, implementada en F39).
//
// Multi-línea (2026-04-27 PM6): el director pidió poder registrar
// varios suministros en un mismo formulario. Cada línea se persiste
// como un movimiento individual (mismo modelo Firestore que antes —
// no hay migración). Cabecera (año/tipo/usuario), equipo destinatario
// y datos adicionales (ODT, observaciones) son compartidos entre
// todas las líneas; suministro + cantidad varían por línea.
//
// Botón '+ Agregar más suministros' clona el template de línea y le
// asigna un índice nuevo. Cada línea tiene un botón × para quitar
// (excepto si solo queda una). El submit itera y crea N movimientos
// secuencialmente; reporta cuántos se grabaron y cuál falló si lo hace.
// ══════════════════════════════════════════════════════════════

import {
  crear as crearMovimiento, computarStock, isReady, StockInsuficienteError,
  listar as listarMovimientos
} from '../data/movimientos.js';
// Por espacio de nombres: si el navegador guarda un data/movimientos.js viejo (sin registrarDesdeOrden),
// la pestaña NO se rompe al cargar; el botón pide recargar (L-102).
import * as movimientosApi from '../data/movimientos.js';
import { suscribir as suscribirSuministros } from '../data/suministros.js';
import { suscribir as suscribirTransformadores } from '../data/transformadores.js';
import { getContratoActivo, withContratoFiltro } from '../ui/contrato-context.js';
// Nexo con Órdenes E/S (2026-10-07): la existencia de esta pestaña descuenta lo entregado por las
// órdenes de entrada firmadas, igual que el tablero (L-86: la misma cuenta en todos los caminos).
import { calcularNexo, existenciaConOrdenes, NEXO_CONTRATOS } from '../domain/ordenes_contrato_nexo.js';
import { listar as listarOrdenes } from '../data/ordenes_materiales.js';
import { obtenerConfig } from '../data/suministros_config.js';
// Registro en Movimientos de las entregas de Órdenes E/S (2026-10-07, `99 §147`).
import { planificarRegistro } from '../domain/ordenes_movimientos_registro.js';
import { computarStockDesdeMovimientos } from '../domain/stock_calculo.js';

const $ = (id) => document.getElementById(id);

// ── Elementos top-level (compartidos) ──
const form          = $('form');
const info          = $('infoBox');
const formMsg       = $('formMsg');
const fAnio         = $('fAnio');
const fUsuario      = $('fUsuario');
const fMatricula    = $('fMatricula');
const dlTrafos      = $('dlTrafos');
const dlSums        = $('dlSums');
const fSub          = $('fSub');
const fZona         = $('fZona');
const fDepto        = $('fDepto');
const fPotencia     = $('fPotencia');
const fOdt          = $('fOdt');
const fObs          = $('fObs');
const fTotalMovimiento = $('fTotalMovimiento');
const lineasContainer  = $('lineasContainer');
const lineaTemplate    = $('lineaTemplate');
const btnAddLinea   = $('btnAddLinea');
const btnLimpiar    = $('btnLimpiar');
const btnGuardar    = $('btnGuardar');

// ── Estado ──
let cacheSums   = [];      // suministros del cache realtime
let cacheTrafos = [];      // transformadores del cache realtime
let trafoSel    = null;    // el equipo actualmente seleccionado
let unsubSums, unsubTrafos;
let lineaCounter = 0;      // contador para data-linea-idx único

// ── Helpers ──
function showInfo(msg, kind) {
  info.className = 'info-msg ' + (kind || '');
  info.textContent = msg;
  info.style.display = msg ? 'block' : 'none';
}
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function fmtCOP(v) {
  if (v == null || isNaN(+v) || +v === 0) return '—';
  return '$' + Math.round(+v).toLocaleString('es-CO');
}
function tipoSeleccionado() {
  const r = document.querySelector('input[name="tipo"]:checked');
  return r ? r.value : null;
}

// ── Poblar dropdown de años ──
function fillAnios() {
  const yearActual = new Date().getFullYear();
  const opts = [];
  for (let y = 2023; y <= yearActual + 2; y++) {
    opts.push(`<option value="${y}" ${y === yearActual ? 'selected' : ''}>${y}</option>`);
  }
  fAnio.innerHTML = opts.join('');
}

// ── Datalists ──
function rebuildDatalistSums() {
  dlSums.innerHTML = cacheSums.map((s) =>
    `<option value="${escHtml(s.codigo)}">${escHtml(s.codigo + ' · ' + s.nombre)}</option>`
  ).join('');
}
function rebuildDatalistTrafos() {
  dlTrafos.innerHTML = cacheTrafos.map((t) => {
    const id = t.identificacion || {};
    const ub = t.ubicacion || {};
    const matr = id.matricula || t.matricula || t.codigo || '';
    const sub  = ub.subestacion_nombre || t.subestacion || '';
    return `<option value="${escHtml(matr)}">${escHtml(matr + (sub ? ' · ' + sub : ''))}</option>`;
  }).join('');
}

// ── Nexo con Órdenes E/S: una lectura por visita, solo en contratos con nexo ──
let promesaOrdenesNexo = null;
let promesaMovsNexo = null;
let promesaConfig = null;
/** Órdenes de la vigencia (una lectura por visita) + movimientos del contrato (frescos en cada consulta:
 *  si otra pestaña registró entregas, lo pendiente no se descuenta dos veces junto al stock fresco). */
async function datosNexo(cid, { movsFrescos = true } = {}) {
  if (!promesaOrdenesNexo) promesaOrdenesNexo = listarOrdenes({ desde: NEXO_CONTRATOS[cid].desde, hasta: NEXO_CONTRATOS[cid].hasta });
  if (!promesaMovsNexo || movsFrescos) promesaMovsNexo = listarMovimientos({ contrato_id: cid });
  try {
    const [{ ordenes, truncado }, movimientos] = await Promise.all([promesaOrdenesNexo, promesaMovsNexo]);
    return { ordenes, truncado: !!truncado, movimientos };
  } catch (err) {
    promesaOrdenesNexo = null; promesaMovsNexo = null;   // se reintenta la próxima vez
    throw err;
  }
}
/** Lectura recortada (más de 500 órdenes): la fecha más antigua leída; lo enlazado a órdenes anteriores no es huérfano. */
function corteDe(ordenes, truncado) {
  if (!truncado || !ordenes || !ordenes.length) return '';
  return ordenes.map((o) => String(o.fechaISO || '').slice(0, 10)).filter(Boolean).sort()[0] || '';
}
/** Lo que falta por REGISTRAR de las órdenes (lo registrado ya descuenta como movimiento: no se cuenta dos veces). */
async function entregadoPorOrdenes(codigo) {
  const cid = getContratoActivo();
  if (!cid || !NEXO_CONTRATOS[cid]) return { cantidad: 0, ok: true };
  try {
    const { ordenes, truncado, movimientos } = await datosNexo(cid);
    const n = calcularNexo({ ordenes, catalogo: cacheSums, contratoId: cid, movimientos, corte: corteDe(ordenes, truncado) });
    const pend = n.porItemPendiente || n.porItem || {};      // módulo viejo en caché: todo cuenta como pendiente
    return { cantidad: pend[codigo] ? pend[codigo].cantidad : 0, ok: true, parcial: truncado };
  } catch (err) {
    console.warn('[nexo] no se pudieron leer las órdenes E/S:', err);
    return { cantidad: 0, ok: false };
  }
}
async function permiteNegativo() {
  if (!promesaConfig) promesaConfig = obtenerConfig().catch(() => ({}));
  return !!(await promesaConfig).permitirNegativo;
}

// ── Lookup helpers ──
function buscarSuministro(input) {
  const v = String(input || '').trim().toUpperCase();
  if (!v) return null;
  return cacheSums.find((s) => s.codigo === v) ||
         cacheSums.find((s) => s.nombre.toUpperCase() === v.toUpperCase()) ||
         cacheSums.find((s) => s.nombre.toUpperCase().includes(v)) ||
         null;
}
function buscarTrafo(input) {
  const v = String(input || '').trim().toUpperCase();
  if (!v) return null;
  return cacheTrafos.find((t) => {
    const matr = ((t.identificacion && t.identificacion.matricula) || t.matricula || t.codigo || '').toUpperCase();
    return matr === v;
  }) || null;
}

// ══════════════════════════════════════════════════════════════
// Líneas de suministro (multi)
// ══════════════════════════════════════════════════════════════

/**
 * Helper: obtiene los inputs/elementos de una línea por su data-field.
 */
function lineaFields(lineaEl) {
  return {
    el:           lineaEl,
    sumId:        lineaEl.querySelector('[data-field="sumId"]'),
    marca:        lineaEl.querySelector('[data-field="marca"]'),
    unidad:       lineaEl.querySelector('[data-field="unidad"]'),
    valorUnit:    lineaEl.querySelector('[data-field="valorUnit"]'),
    stockActual:  lineaEl.querySelector('[data-field="stockActual"]'),
    cantidad:     lineaEl.querySelector('[data-field="cantidad"]'),
    valorTotal:   lineaEl.querySelector('[data-field="valorTotal"]'),
    num:          lineaEl.querySelector('.linea-num'),
    btnRemove:    lineaEl.querySelector('[data-action="remove"]')
  };
}

/**
 * Renumera las líneas visualmente (#1, #2, …) y oculta el botón × si
 * solo queda una línea (no permitimos quedar con 0 líneas).
 */
function renumerarLineas() {
  const lineas = lineasContainer.querySelectorAll('.linea-suministro');
  lineas.forEach((el, i) => {
    const f = lineaFields(el);
    if (f.num) f.num.textContent = `#${i + 1}`;
    if (f.btnRemove) f.btnRemove.hidden = (lineas.length === 1);
  });
}

/**
 * Actualiza el total general del movimiento sumando todas las líneas.
 */
function actualizarTotalMovimiento() {
  let total = 0;
  for (const el of lineasContainer.querySelectorAll('.linea-suministro')) {
    const data = lineaState.get(el);
    if (data && data.suministro) {
      const cant = +lineaFields(el).cantidad.value || 0;
      total += cant * (+data.suministro.valor_unitario || 0);
    }
  }
  fTotalMovimiento.value = total > 0 ? fmtCOP(total) : '—';
}

// Map de elemento de línea → datos asociados (suministro, etc.)
const lineaState = new WeakMap();

/**
 * Auto-fill de los campos automáticos de una línea cuando el
 * suministro cambia (consulta cache + computarStock con heurística
 * dual de docId — ver data/movimientos.js).
 */
async function aplicarSuministroLinea(lineaEl) {
  const f = lineaFields(lineaEl);
  const found = buscarSuministro(f.sumId.value);
  const cidLinea = getContratoActivo();
  const conNexo = !!(found && cidLinea && NEXO_CONTRATOS[cidLinea]);
  // Con nexo: mientras se calcula la existencia (con órdenes E/S) un EGRESO queda bloqueado (revisión 10-07).
  lineaState.set(lineaEl, conNexo ? { suministro: found, conNexo: true, cargando: true } : { suministro: found });
  if (conNexo) actualizarBtnGuardar();
  const vigente = () => (lineaState.get(lineaEl) || {}).suministro === found;
  if (!found) {
    f.marca.value = '';
    f.unidad.value = '';
    f.valorUnit.value = '';
    f.stockActual.value = '';
    f.valorTotal.textContent = '—';
    actualizarTotalMovimiento();
    actualizarBtnGuardar();
    return;
  }
  // Marca: si hay 1 marca disponible, la pre-llena; si hay varias,
  // muestra el conteo. El usuario debe elegir manualmente cuál
  // quedó pendiente (UI de selección llega en futuro).
  const marcas = Array.isArray(found.marcas_disponibles) ? found.marcas_disponibles : [];
  f.marca.value = marcas.length === 1 ? marcas[0] : (marcas.length > 1 ? `(${marcas.length} marcas)` : '—');
  f.unidad.value = found.unidad || 'Und';
  f.valorUnit.value = fmtCOP(found.valor_unitario);
  // Stock actual via cómputo on-demand (heurística dual del data layer).
  f.stockActual.value = '⋯';
  try {
    const cid = getContratoActivo() || (found.contrato_id || '');
    const stock = await computarStock(found.codigo, cid);
    if (stock && conNexo) {
      // Con nexo: también descuenta lo entregado por órdenes E/S (la misma cifra del tablero).
      const ent = await entregadoPorOrdenes(found.codigo);
      const s = existenciaConOrdenes(stock, ent.cantidad);
      const neg = await permiteNegativo();
      // Si mientras tanto se escogió otro suministro en la línea, esta respuesta ya no aplica.
      if (vigente()) {
        f.stockActual.value = `${s.actual} (ini ${s.inicial}, +${s.ingresado}, -${s.egresadoMovimientos}` +
          (s.entregadoOrdenes ? `, -${s.entregadoOrdenes} órdenes E/S por registrar` : '') +
          (ent.ok ? '' : ' · sin leer órdenes E/S') + (ent.parcial ? ' · parcial: más de 500 órdenes en la vigencia' : '') + ')';
        lineaState.set(lineaEl, ent.ok
          ? { suministro: found, conNexo: true, disponible: s.actual, permiteNegativo: neg }
          : { suministro: found, conNexo: true, sinExistencia: 'no se pudieron leer las órdenes E/S' });
      }
    } else if (stock) {
      if (vigente()) f.stockActual.value = `${stock.actual} (ini ${stock.inicial}, +${stock.ingresado}, -${stock.egresado})`;
    } else {
      if (vigente()) f.stockActual.value = '—';
      if (conNexo && vigente()) lineaState.set(lineaEl, { suministro: found, conNexo: true, sinExistencia: 'no se pudo calcular la existencia' });
    }
  } catch (err) {
    console.warn('No se pudo computar stock:', err);
    if (vigente()) f.stockActual.value = '—';
    if (conNexo && vigente()) lineaState.set(lineaEl, { suministro: found, conNexo: true, sinExistencia: 'no se pudo calcular la existencia' });
  }
  actualizarValorTotalLinea(lineaEl);
}

function actualizarValorTotalLinea(lineaEl) {
  const f = lineaFields(lineaEl);
  const data = lineaState.get(lineaEl);
  const cant = +f.cantidad.value || 0;
  const valU = (data && data.suministro) ? (+data.suministro.valor_unitario || 0) : 0;
  const total = cant * valU;
  f.valorTotal.textContent = total > 0 ? fmtCOP(total) : '—';
  actualizarTotalMovimiento();
  actualizarBtnGuardar();
}

// ══════════════════════════════════════════════════════════════
// Validación reactiva · btnGuardar disabled hasta que todo OK
// ══════════════════════════════════════════════════════════════

/**
 * Devuelve { ok: bool, motivo: string } indicando si el formulario
 * está listo para guardar. El motivo se usa como tooltip del botón
 * disabled (UX: el director ve qué falta sin tener que adivinar).
 *
 * Lista de campos obligatorios (decisión del director PM7):
 *   · Año seleccionado (siempre tiene default, pero validamos por
 *     consistencia)
 *   · Tipo INGRESO/EGRESO
 *   · Usuario / Responsable
 *   · Matrícula del parque (trafoSel resuelto del datalist)
 *   · ODT (orden de trabajo)
 *   · Observaciones
 *   · Al menos una línea, cada una con suministro + cantidad ≥ 1
 */
function validarFormulario() {
  if (!fAnio.value) {
    return { ok: false, motivo: 'Selecciona un Año' };
  }
  if (!tipoSeleccionado()) {
    return { ok: false, motivo: 'Selecciona INGRESO o EGRESO' };
  }
  if (!fUsuario.value.trim()) {
    return { ok: false, motivo: 'Falta indicar Usuario / Responsable' };
  }
  if (!trafoSel) {
    return { ok: false, motivo: 'Selecciona una Matrícula válida del parque' };
  }
  if (!fOdt.value.trim()) {
    return { ok: false, motivo: 'Falta indicar la ODT (orden de trabajo)' };
  }
  if (!fObs.value.trim()) {
    return { ok: false, motivo: 'Falta indicar las Observaciones del movimiento' };
  }
  const lineas = [...lineasContainer.querySelectorAll('.linea-suministro')];
  if (lineas.length === 0) {
    return { ok: false, motivo: 'Agrega al menos una línea de suministro' };
  }
  const pedidoEgreso = new Map();   // EGRESO acumulado por código (nexo)
  for (let i = 0; i < lineas.length; i++) {
    const f = lineaFields(lineas[i]);
    const data = lineaState.get(lineas[i]) || {};
    if (!data.suministro) {
      return { ok: false, motivo: `Línea #${i + 1}: selecciona un suministro válido del catálogo` };
    }
    const cant = parseInt(f.cantidad.value, 10);
    if (!Number.isInteger(cant) || cant < 1) {
      return { ok: false, motivo: `Línea #${i + 1}: la cantidad debe ser un entero ≥ 1` };
    }
    // Contratos con nexo: un EGRESO no puede pasar de lo que queda contando lo entregado por órdenes E/S
    // (salvo que la configuración permita negativos). Las líneas del MISMO ítem se suman. La transacción
    // del data layer sigue validando solo con movimientos; esta es la barrera que ve las órdenes.
    if (tipoSeleccionado() === 'EGRESO' && data.conNexo) {
      if (data.cargando) return { ok: false, motivo: `Línea #${i + 1}: calculando la existencia con órdenes E/S…` };
      if (data.sinExistencia) return { ok: false, motivo: `Línea #${i + 1}: ${data.sinExistencia}; vuelva a escoger el suministro o recargue` };
      if (!data.permiteNegativo && typeof data.disponible === 'number') {
        const cod = data.suministro.codigo;
        const acum = (pedidoEgreso.get(cod) || 0) + cant;
        pedidoEgreso.set(cod, acum);
        if (acum > data.disponible) {
          return { ok: false, motivo: acum === cant
            ? `Línea #${i + 1}: la cantidad (${cant}) supera lo que queda (${data.disponible}), contando lo entregado por órdenes E/S`
            : `Línea #${i + 1}: las líneas de ${cod} suman ${acum} y solo quedan ${data.disponible}, contando lo entregado por órdenes E/S` };
        }
      }
    }
  }
  return { ok: true, motivo: '' };
}

/**
 * Actualiza el estado visual del botón Guardar según validarFormulario.
 * Se llama desde TODOS los listeners que cambian el estado.
 */
function actualizarBtnGuardar() {
  const v = validarFormulario();
  btnGuardar.disabled = !v.ok;
  btnGuardar.title = v.ok
    ? 'Guardar el movimiento (Enter)'
    : v.motivo;
  // Pequeño hint visual: añade clase para que el botón muestre cursor
  // not-allowed y opacidad reducida (la regla CSS se aplica por
  // [disabled], pero la clase asegura compatibilidad cross-browser).
  btnGuardar.classList.toggle('is-disabled', !v.ok);
  // Mensaje al footer del formulario cuando hay un motivo (sin pisar
  // mensajes de error/éxito que vengan del submit).
  if (formMsg.classList.contains('err') || formMsg.classList.contains('ok')) return;
  if (v.ok) {
    formMsg.className = 'msg';
    formMsg.textContent = '';
  } else {
    formMsg.className = 'msg hint';
    formMsg.textContent = '· ' + v.motivo;
  }
}

/**
 * Crea una línea nueva clonando el template y la añade al container.
 * Engancha los listeners de cada input.
 */
function agregarLinea() {
  lineaCounter += 1;
  const frag = lineaTemplate.content.cloneNode(true);
  const lineaEl = frag.querySelector('.linea-suministro');
  lineaEl.dataset.lineaIdx = String(lineaCounter);
  lineasContainer.appendChild(frag);
  const f = lineaFields(lineaEl);
  // Listeners.
  f.sumId.addEventListener('input',  () => aplicarSuministroLinea(lineaEl));
  f.sumId.addEventListener('change', () => aplicarSuministroLinea(lineaEl));
  f.cantidad.addEventListener('input', () => actualizarValorTotalLinea(lineaEl));
  if (f.btnRemove) {
    f.btnRemove.addEventListener('click', () => {
      lineaEl.remove();
      lineaState.delete(lineaEl);
      renumerarLineas();
      actualizarTotalMovimiento();
      actualizarBtnGuardar();
    });
  }
  // Re-init iconos Lucide del template recién clonado.
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons({ root: lineaEl });
  }
  renumerarLineas();
  actualizarTotalMovimiento();
  return lineaEl;
}

// ══════════════════════════════════════════════════════════════
// Equipo destinatario (compartido entre todas las líneas)
// ══════════════════════════════════════════════════════════════
function aplicarTrafo() {
  const found = buscarTrafo(fMatricula.value);
  trafoSel = found;
  if (!found) {
    fSub.value = ''; fZona.value = ''; fDepto.value = ''; fPotencia.value = '';
    return;
  }
  const ub = found.ubicacion || {};
  const pl = found.placa || {};
  fSub.value      = ub.subestacion_nombre || found.subestacion || '';
  fZona.value     = ub.zona || found.zona || '';
  fDepto.value    = ub.departamento || found.departamento || '';
  fPotencia.value = pl.potencia_kva ?? found.potencia_kva ?? '';
}

// ══════════════════════════════════════════════════════════════
// Suscripciones realtime
// ══════════════════════════════════════════════════════════════
function arrancar() {
  if (!isReady()) {
    showInfo('⚠ Firebase no configurado.', 'err');
    return;
  }
  if (unsubSums)   try { unsubSums(); }   catch (_) {}
  if (unsubTrafos) try { unsubTrafos(); } catch (_) {}
  unsubSums = suscribirSuministros(withContratoFiltro(), (rows) => {
    cacheSums = rows; rebuildDatalistSums();
    // Re-evaluar todas las líneas que ya tengan suministro escrito
    // (por si la subscripción tarda en llegar y el usuario tipeó antes).
    for (const el of lineasContainer.querySelectorAll('.linea-suministro')) {
      const f = lineaFields(el);
      if (f.sumId.value) aplicarSuministroLinea(el);
    }
  }, (err) => console.warn('[sums]', err));
  // Transformadores se mantienen sin filtro de contrato — el parque es
  // único y cada movimiento debe poder asociarse a cualquier trafo.
  unsubTrafos = suscribirTransformadores({}, (rows) => {
    cacheTrafos = rows; rebuildDatalistTrafos();
  }, (err) => console.warn('[trafos]', err));
}

// ══════════════════════════════════════════════════════════════
// Eventos top-level · cada uno re-evalúa btnGuardar
// ══════════════════════════════════════════════════════════════
fMatricula.addEventListener('input',  () => { aplicarTrafo(); actualizarBtnGuardar(); });
fMatricula.addEventListener('change', () => { aplicarTrafo(); actualizarBtnGuardar(); });
fUsuario.addEventListener('input', actualizarBtnGuardar);
fAnio.addEventListener('change', actualizarBtnGuardar);
fOdt.addEventListener('input', actualizarBtnGuardar);
fObs.addEventListener('input', actualizarBtnGuardar);
for (const r of document.querySelectorAll('input[name="tipo"]')) {
  r.addEventListener('change', actualizarBtnGuardar);
}
btnAddLinea.addEventListener('click', () => {
  const lineaEl = agregarLinea();
  // Foco al campo descripción de la línea recién agregada.
  const f = lineaFields(lineaEl);
  setTimeout(() => f.sumId.focus(), 50);
});

btnLimpiar.addEventListener('click', () => {
  // 'Nuevo Movimiento': conserva Año + Tipo + Usuario, vacía el resto
  // y deja UNA sola línea de suministro fresca.
  const anio = fAnio.value;
  const usuario = fUsuario.value;
  const tipo = tipoSeleccionado();
  // Limpia campos compartidos (excepto los conservados).
  fMatricula.value = '';
  fSub.value = ''; fZona.value = ''; fDepto.value = ''; fPotencia.value = '';
  fOdt.value = '';
  fObs.value = '';
  fTotalMovimiento.value = '';
  trafoSel = null;
  formMsg.className = 'msg'; formMsg.textContent = '';
  // Reset líneas: borra todas, regenera una.
  lineasContainer.innerHTML = '';
  agregarLinea();
  // Re-aplica los conservados.
  fAnio.value = anio;
  fUsuario.value = usuario;
  if (tipo) {
    const r = document.querySelector(`input[name="tipo"][value="${tipo}"]`);
    if (r) r.checked = true;
  }
  // Re-evalúa el botón: con todo limpio (matrícula vacía, líneas
  // sin suministro), debería quedar disabled de nuevo.
  actualizarBtnGuardar();
});

// ══════════════════════════════════════════════════════════════
// Submit · crea N movimientos (uno por línea)
// ══════════════════════════════════════════════════════════════
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.className = 'msg'; formMsg.textContent = '';
  // Se revalida al guardar: el botón pudo quedar habilitado mientras se calculaba una existencia.
  const vGuardar = validarFormulario();
  if (!vGuardar.ok) { formMsg.className = 'msg err'; formMsg.textContent = '✗ ' + vGuardar.motivo; actualizarBtnGuardar(); return; }

  // Validaciones top-level.
  if (!trafoSel) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Seleccione una matrícula válida del parque.';
    fMatricula.focus(); return;
  }
  const tipo = tipoSeleccionado();
  if (!tipo) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Seleccione INGRESO o EGRESO.';
    return;
  }

  // Validaciones por línea.
  const lineas = [...lineasContainer.querySelectorAll('.linea-suministro')];
  if (lineas.length === 0) {
    formMsg.className = 'msg err';
    formMsg.textContent = '✗ Agregue al menos una línea de suministro.';
    return;
  }
  const payloads = [];
  for (let i = 0; i < lineas.length; i++) {
    const lineaEl = lineas[i];
    const f = lineaFields(lineaEl);
    const data = lineaState.get(lineaEl) || {};
    const sumSel = data.suministro;
    if (!sumSel) {
      formMsg.className = 'msg err';
      formMsg.textContent = `✗ Línea #${i + 1}: seleccione un suministro válido del catálogo.`;
      f.sumId.focus(); return;
    }
    const cantidad = parseInt(f.cantidad.value, 10);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      formMsg.className = 'msg err';
      formMsg.textContent = `✗ Línea #${i + 1}: cantidad debe ser entero ≥ 1.`;
      f.cantidad.focus(); return;
    }
    payloads.push({ sumSel, cantidad, lineaIdx: i + 1 });
  }

  btnGuardar.disabled = true;
  const orig = btnGuardar.textContent;
  btnGuardar.textContent = 'GUARDANDO…';

  const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
  const id = trafoSel.identificacion || {};
  const ub = trafoSel.ubicacion || {};

  const movimientosCreados = [];
  let errorOcurrido = null;
  let lineaErrFalla = null;

  // Crea cada línea como un movimiento individual (cada uno con su
  // propia tx atómica de stock). Si una falla, paramos pero
  // mantenemos las anteriores (situación de fallo parcial — el
  // mensaje al usuario explica cuántas se crearon).
  for (const p of payloads) {
    try {
      const movId = await crearMovimiento({
        contrato_id: getContratoActivo() || (p.sumSel && p.sumSel.contrato_id) || '',
        anio: parseInt(fAnio.value, 10),
        tipo: tipo,
        suministro_id: p.sumSel.codigo,
        suministro_nombre: p.sumSel.nombre,
        marca: (p.sumSel.marcas_disponibles && p.sumSel.marcas_disponibles.length === 1) ? p.sumSel.marcas_disponibles[0] : '',
        cantidad: p.cantidad,
        valor_unitario: +p.sumSel.valor_unitario || 0,
        valor_total: p.cantidad * (+p.sumSel.valor_unitario || 0),
        transformador_id: trafoSel.id,
        matricula: id.matricula || trafoSel.matricula || trafoSel.codigo || '',
        subestacion: ub.subestacion_nombre || trafoSel.subestacion || '',
        zona: ub.zona || trafoSel.zona || '',
        departamento: ub.departamento || trafoSel.departamento || '',
        odt: fOdt.value.trim(),
        usuario: fUsuario.value.trim(),
        observaciones: fObs.value.trim()
      }, uid);
      movimientosCreados.push({ movId, sumId: p.sumSel.codigo, cantidad: p.cantidad });
    } catch (err) {
      errorOcurrido = err;
      lineaErrFalla = p.lineaIdx;
      break;
    }
  }

  if (errorOcurrido) {
    formMsg.className = 'msg err';
    let detalle = errorOcurrido && errorOcurrido.name === 'StockInsuficienteError'
      ? errorOcurrido.message
      : (errorOcurrido && errorOcurrido.message) || String(errorOcurrido);
    if (movimientosCreados.length > 0) {
      formMsg.textContent = `⚠ Se grabaron ${movimientosCreados.length} de ${payloads.length} líneas. La línea #${lineaErrFalla} falló: ${detalle}. Revisa y reintenta solo lo pendiente.`;
    } else {
      formMsg.textContent = `✗ Línea #${lineaErrFalla}: ${detalle}`;
    }
  } else {
    formMsg.className = 'msg ok';
    formMsg.textContent = `✓ ${movimientosCreados.length} movimiento${movimientosCreados.length === 1 ? '' : 's'} ${tipo} guardado${movimientosCreados.length === 1 ? '' : 's'}. Stock actualizado.`;
    showInfo(`✓ ${tipo} ×${movimientosCreados.length} en ${id.matricula || trafoSel.codigo}`, 'ok');
    btnLimpiar.click();
    setTimeout(() => showInfo(''), 5000);
  }

  btnGuardar.disabled = false;
  btnGuardar.textContent = orig;
});

window.addEventListener('beforeunload', () => {
  if (unsubSums)   try { unsubSums(); }   catch (_) {}
  if (unsubTrafos) try { unsubTrafos(); } catch (_) {}
});

// ══════════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════════
fillAnios();
agregarLinea();    // primera línea siempre presente
arrancar();
actualizarBtnGuardar();   // estado inicial: disabled hasta llenar

// ══════════════════════════════════════════════════════════════
// Entregas de Órdenes E/S por registrar (2026-10-07, `99 §147`)
// Vista previa → casillas → «Registrar seleccionadas». Una transacción por entrega
// (data/movimientos.js#registrarDesdeOrden): repetir no duplica, una orden que cambió
// no se registra y la existencia se valida igual que un egreso manual.
// ══════════════════════════════════════════════════════════════
const regSec = $('regOrdenes');           // ausente con el HTML viejo en caché (`30 L-85`)
let planReg = null;
let confirmandoReg = false;   // confirmación en dos clics dentro de la página (sin diálogo del navegador)
const ddmm = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');

async function revisarEntregas() {
  const cid = getContratoActivo();
  const cuerpo = $('regCuerpo'), btnReg = $('btnRegistrarEntregas');
  btnReg.disabled = true; planReg = null; confirmandoReg = false; btnReg.classList.remove('btn-danger');
  cuerpo.innerHTML = '<p class="msg">Leyendo órdenes, movimientos y parque…</p>';
  try {
    promesaOrdenesNexo = null; promesaMovsNexo = null;          // lectura fresca
    const { ordenes, truncado, movimientos } = await datosNexo(cid);
    if (!cacheTrafos.length) throw new Error('el parque de transformadores todavía no cargó; espere un momento y vuelva a revisar');
    if (!cacheSums.length) throw new Error('el catálogo del contrato todavía no cargó; espere un momento y vuelva a revisar');
    if (typeof movimientosApi.registrarDesdeOrden !== 'function') throw new Error('el navegador tiene una versión anterior del programa: recargue la página (Cmd+Shift+R)');
    const nexo = calcularNexo({ ordenes, catalogo: cacheSums, contratoId: cid, movimientos, corte: corteDe(ordenes, truncado) });
    const existencias = Object.fromEntries(cacheSums.map((s) => [s.codigo,
      computarStockDesdeMovimientos(s.stock_inicial, movimientos.filter((m) => m.suministro_id === s.codigo)).actual]));
    planReg = planificarRegistro({ nexo, parque: cacheTrafos, catalogo: cacheSums, contratoId: cid, existencias });
    const p = planReg;
    const fila = (x, conCasilla, i) => {
      const l = x.linea || x;
      return `<tr>${conCasilla ? `<td><input type="checkbox" class="reg-sel" data-i="${i}" checked aria-label="Registrar esta entrega"></td>` : '<td></td>'}
        <td>${escHtml(ddmm(l.fechaISO))}</td><td>${escHtml(l.tipo)} ${escHtml(l.numero)}</td>
        <td><code>${escHtml(l.codigo)}</code> ${escHtml(l.nombre)}</td><td style="text-align:right">${escHtml(String(l.cantidad))}</td>
        <td>${escHtml(x.payload ? x.payload.matricula + ' · ' + x.payload.subestacion : l.transformador)}</td>
        <td>${escHtml(x.payload ? x.payload.zona + ' / ' + x.payload.departamento : (l.zona || ''))}</td>
        <td style="text-align:right">${x.payload ? fmtCOP(x.payload.valor_total) : fmtCOP(l.valor)}</td>
        <td style="font-size:12px">${escHtml(x.motivo || (l.movimientos && l.movimientos.length ? l.movimientos.join(', ') : ''))}</td></tr>`;
    };
    const tabla = (titulo, filas, conCasilla) => !filas.length ? '' : `<h4 style="margin:14px 0 6px">${titulo} (${filas.length})</h4>
      <div class="table-scroll"><table class="data-table"><thead><tr><th></th><th>Fecha</th><th>Orden</th><th>Ítem</th><th style="text-align:right">Cant.</th>
      <th>Transformador</th><th>Zona / depto.</th><th style="text-align:right">Valor</th><th>${conCasilla ? '' : 'Motivo / MOV'}</th></tr></thead>
      <tbody>${filas.map((x, i) => fila(x, conCasilla, i)).join('')}</tbody></table></div>`;
    cuerpo.innerHTML =
      `<p class="msg">${p.porRegistrar.length} por registrar (${fmtCOP(p.valorPorRegistrar)}) · ${p.registrados.length} ya registradas · ` +
      `${p.noRegistrables.length} no registrables · ${p.desfasados.length} desfasadas.` +
      (truncado ? ' <b>Parcial:</b> hay más de 500 órdenes en la vigencia.' : '') + '</p>' +
      (nexo.avisos.length ? nexo.avisos.map((a) => `<p class="msg err">⚠ ${escHtml(a)}</p>`).join('') : '') +
      tabla('Por registrar', p.porRegistrar, true) +
      tabla('No registrables (no se adivina: corrija la orden o el parque)', p.noRegistrables.map((x) => ({ ...x.linea, motivo: x.motivo })), false) +
      tabla('Desfasadas (la orden cambió después de registrada)', p.desfasados, false);
    btnReg.disabled = !p.porRegistrar.length;
    btnReg.textContent = `Registrar seleccionadas (${p.porRegistrar.length})`;
    cuerpo.querySelectorAll('.reg-sel').forEach((c) => c.addEventListener('change', () => {
      const n = cuerpo.querySelectorAll('.reg-sel:checked').length;
      confirmandoReg = false; btnReg.classList.remove('btn-danger');
      btnReg.disabled = !n; btnReg.textContent = `Registrar seleccionadas (${n})`;
    }));
  } catch (err) {
    console.error(err);
    cuerpo.innerHTML = `<p class="msg err">✗ No se pudo revisar: ${escHtml(err.message || String(err))}</p>`;
  }
}

async function registrarEntregas() {
  if (!planReg) return;
  const cuerpo = $('regCuerpo'), btnReg = $('btnRegistrarEntregas'), msg = $('regMsg');
  const sel = [...cuerpo.querySelectorAll('.reg-sel:checked')].map((c) => planReg.porRegistrar[+c.dataset.i]).filter(Boolean);
  if (!sel.length) return;
  // Primer clic: pide confirmar en el mismo botón. Segundo clic: registra.
  if (!confirmandoReg) {
    confirmandoReg = true;
    btnReg.classList.add('btn-danger');
    btnReg.textContent = `Confirmar: registrar ${sel.length} entrega(s) como EGRESO`;
    msg.className = 'msg'; msg.textContent = 'Revise la tabla. Pulse de nuevo para registrar; cambie una casilla para cancelar.';
    return;
  }
  confirmandoReg = false; btnReg.classList.remove('btn-danger');
  const uid = window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid;
  btnReg.disabled = true;
  const res = { registrado: [], ya_estaba: 0, orden_cambio: [], error: [] };
  for (let i = 0; i < sel.length; i++) {
    msg.className = 'msg'; msg.textContent = `Registrando ${i + 1} de ${sel.length}…`;
    try {
      const r = await movimientosApi.registrarDesdeOrden(sel[i], uid);
      if (r.estado === 'registrado') res.registrado.push(r.codigo);
      else if (r.estado === 'ya_estaba') res.ya_estaba++;
      else res.orden_cambio.push(`${sel[i].linea.numero} ${sel[i].linea.codigo}: ${r.motivo}`);
    } catch (err) {
      res.error.push(`${sel[i].linea.numero} ${sel[i].linea.codigo}: ${err.message || err}`);
    }
  }
  msg.className = 'msg ' + (res.error.length || res.orden_cambio.length ? 'err' : 'ok');
  msg.textContent = `${res.registrado.length ? '✓' : '✗'} ${res.registrado.length} registrada(s)` + (res.registrado.length ? ` (${res.registrado[0]} … ${res.registrado[res.registrado.length - 1]})` : '') +
    (res.ya_estaba ? ` · ${res.ya_estaba} ya estaban` : '') +
    (res.orden_cambio.length ? ` · sin registrar por cambio en la orden: ${res.orden_cambio.join('; ')}` : '') +
    (res.error.length ? ` · con error: ${res.error.join('; ')}` : '');
  await revisarEntregas();
}

if (regSec) {
  const cidReg = getContratoActivo();
  regSec.hidden = !(cidReg && NEXO_CONTRATOS[cidReg]);
  $('btnRevisarEntregas').addEventListener('click', revisarEntregas);
  $('btnRegistrarEntregas').addEventListener('click', registrarEntregas);
}
