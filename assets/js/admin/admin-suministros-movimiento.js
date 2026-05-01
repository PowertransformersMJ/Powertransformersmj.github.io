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
  crear as crearMovimiento, computarStock, isReady, StockInsuficienteError
} from '../data/movimientos.js';
import { suscribir as suscribirSuministros } from '../data/suministros.js';
import { suscribir as suscribirTransformadores } from '../data/transformadores.js';
import { getContratoActivo, withContratoFiltro } from '../ui/contrato-context.js';

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
  lineaState.set(lineaEl, { suministro: found });
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
    if (stock) f.stockActual.value = `${stock.actual} (ini ${stock.inicial}, +${stock.ingresado}, -${stock.egresado})`;
    else f.stockActual.value = '—';
  } catch (err) {
    console.warn('No se pudo computar stock:', err);
    f.stockActual.value = '—';
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
