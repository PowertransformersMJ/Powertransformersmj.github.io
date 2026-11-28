// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — «Dónde se instaló» cada accesorio, en el tablero del contrato (99 §238)
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-27): «me gustaría que al seleccionar cualquier
// accesorio en el dashboard me indique dónde y cuántas cantidades han sido
// instalados».
//
// Cada fila de «Stock por ítem» se puede seleccionar (botón en el código, ratón o
// teclado). Al seleccionarla se abre, justo debajo, el detalle de ESE accesorio:
// resumen (total, transformadores, subestaciones, registrado y por registrar) y una
// tabla por transformador que cuadra con la columna −Egresos. El tablero llama a
// `alPintarTabla()` cada vez que repinta la tabla (datos en vivo, filtros): el
// detalle abierto se repinta con los datos nuevos sin cerrarse.
//
// El tablero carga este módulo perezoso (`30 L-102`): si falta o falla, la tabla
// sigue como antes. La lógica vive en domain/suministros_instalaciones.js.
// ══════════════════════════════════════════════════════════════

import { instalacionesDeItem } from '../domain/suministros_instalaciones.js';
import { NEXO_CONTRATOS } from '../domain/ordenes_contrato_nexo.js';

const ID_PANEL = 'instDetalle';
const ID_TITULO = 'instTitulo';
const ID_ANUNCIO = 'instAnuncio';
const HOJA_ESTILO = 'suministros-instalaciones.css';

const ZONAS = Object.freeze({ BOLIVAR: 'Bolívar', ORIENTE: 'Oriente', OCCIDENTE: 'Occidente' });
const DEPTOS = Object.freeze({ bolivar: 'Bolívar', cordoba: 'Córdoba', sucre: 'Sucre', cesar: 'Cesar', magdalena: 'Magdalena' });

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Cantidad con coma decimal (kg y metros pueden traer decimales). */
export function fmtCant(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('es-CO', { maximumFractionDigits: 3 }) : '—';
}
const fecha = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const nombreZona = (z) => ZONAS[String(z || '').toUpperCase()] || String(z || '');
const nombreDepto = (d) => DEPTOS[String(d || '').toLowerCase()] || String(d || '');
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

/**
 * Estado de la lectura de órdenes para el contrato abierto.
 * @returns {'sin_nexo'|'leyendo'|'error'|'ok'}
 */
export function estadoOrdenes({ contratoId, ordenes, nexo } = {}) {
  if (!contratoId || !NEXO_CONTRATOS[contratoId]) return 'sin_nexo';
  if (ordenes && ordenes.error && !(ordenes.ordenes)) return 'error';
  if (!nexo || !nexo.activo) return 'leyendo';
  return 'ok';
}

/**
 * Cómo se reparte el total instalado: «12 Und: 11 Und en 1 transformador de 1 subestación y 1 Und sin
 * transformador indicado». Cada cifra va con lo suyo; nunca el total junto a los transformadores si una
 * parte no indica transformador.
 * @param {object} det  resultado de `instalacionesDeItem`
 * @param {object} [f]  { num, u } para el HTML (negritas y unidad escapada); sin él, texto plano
 */
function frasesTotal(det, f = {}) {
  const num = f.num || ((s) => s);
  const u = f.u != null ? f.u : det.unidad;
  const sinTr = det.sinTransformador || 0;
  const sinUbicar = det.sinDesglose || 0;
  const enTr = det.enTransformadores != null ? det.enTransformadores : Number((det.total - sinTr - sinUbicar).toFixed(3));
  let dondeTr = '';
  if (det.transformadores) {
    dondeTr = `en ${num(det.transformadores)} ${plural(det.transformadores, 'transformador', 'transformadores')}`;
    if (det.subestaciones) dondeTr += ` de ${num(det.subestaciones)} ${plural(det.subestaciones, 'subestación', 'subestaciones')}`;
    const sinSE = det.transformadoresSinSubestacion || 0;
    if (sinSE) dondeTr += sinSE === det.transformadores ? ' (sin subestación indicada)' : ` (${sinSE} sin subestación indicada)`;
  }
  const partes = [];
  if (dondeTr) partes.push({ q: enTr, texto: dondeTr });
  if (sinTr > 0) partes.push({ q: sinTr, texto: 'sin transformador indicado' });
  if (sinUbicar > 0) partes.push({ q: sinUbicar, texto: 'por registrar sin ubicar todavía' });
  const total = num(`${fmtCant(det.total)} ${u}`);
  if (!partes.length) return total;
  if (partes.length === 1) return dondeTr ? `${total} ${dondeTr}` : `${total}, ${partes[0].texto}`;
  const lista = partes.map((p) => `${num(`${fmtCant(p.q)} ${u}`)} ${p.texto}`);
  return `${total}: ${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

/** Resumen en una frase para el anuncio de los lectores de pantalla (el visible lo pinta `htmlDetalle`). */
export function textoResumen(det, estado) {
  const u = det.unidad;
  if (!(det.total > 0)) return `Todavía no se ha instalado ninguna unidad de ${det.codigo} en este contrato.`;
  let t = `${det.codigo}: total instalado ${frasesTotal(det)}. Registrado en Movimientos: ${fmtCant(det.registrado)} ${u}`;
  if (estado === 'ok' && det.porRegistrar > 0) t += `. Por registrar: ${fmtCant(det.porRegistrar)} ${u}`;
  return t + '.';
}

const chip = (clase, texto) => `<span class="inst-estado inst-estado--${clase}">${texto}</span>`;

function htmlEstado(f, unidad) {
  const linea = (h) => `<div class="inst-linea">${h}</div>`;
  if (f.estado === 'mixto') {
    return linea(chip('reg', `Registrado · ${fmtCant(f.registrado)} ${esc(unidad)}`)) +
      linea(chip('pend', `Por registrar · ${fmtCant(f.porRegistrar)} ${esc(unidad)}`));
  }
  return linea(f.estado === 'por_registrar' ? chip('pend', 'Por registrar') : chip('reg', 'Registrado'));
}

/** Rótulo de una ubicación que solo dice la orden, según por qué el parque no la dio. */
const ROTULO_ORDEN = Object.freeze({
  leyendo: 'ubicación según la orden (leyendo el parque…)',
  fallo: 'ubicación según la orden (no se pudo leer el parque)',
  duplicado: 'ubicación según la orden (aparece más de una vez en el parque)',
  sin_id: 'ubicación según la orden (el parque no lo identifica)',
  no_hallado: 'ubicación según la orden (no se halló en el parque)'
});

/**
 * Una entrega en UNA línea: fecha · orden u ODT · movimiento · cantidad (si hay varias) · estado (si la fila
 * mezcla registrado y por registrar). Así se ve cuál orden falta por registrar.
 */
function htmlEntrega(e, f, unidad) {
  const partes = [];
  if (!e.fecha) partes.push('<span class="inst-sub">sin fecha</span>');
  else if (e.deRegistro) partes.push(`se registró el ${esc(fecha(e.fecha))} <span class="inst-sub">(no trae fecha de entrega)</span>`);
  else partes.push(`<span class="inst-fecha">${esc(fecha(e.fecha))}</span>`);
  if (e.orden && e.orden.numero) partes.push(`${esc(e.orden.tipo || 'ORDEN')} N.º ${esc(e.orden.numero)}`);
  if (e.odt) partes.push(`ODT ${esc(e.odt)}`);
  if (e.movimiento) partes.push(`<code>${esc(e.movimiento)}</code>`);
  else if (e.estado === 'por_registrar') partes.push('<span class="inst-sub">aún sin movimiento</span>');
  if (f.entregas.length > 1) partes.push(`<b>${fmtCant(e.cantidad)}</b>&nbsp;${esc(unidad)}`); // cifra y unidad en el mismo renglón
  if (f.estado === 'mixto') partes.push(e.estado === 'por_registrar' ? chip('pend', 'Por registrar') : chip('reg', 'Registrado'));
  let aviso = '';
  if (e.aviso === 'desfasado') aviso = '<div class="inst-aviso">⚠ La orden cambió después de registrarse; se corrige sola.</div>';
  if (e.aviso === 'huerfano') aviso = '<div class="inst-aviso">⚠ La orden ya no respalda este movimiento; se retira solo.</div>';
  return `<li class="inst-entrega">${partes.join(' · ')}${aviso}</li>`;
}

function htmlFila(f, unidad) {
  let trafo;
  if (f.sinTransformador) {
    trafo = f.ubicacion === 'orden' ? 'La orden no indica transformador' : 'Sin transformador indicado';
  } else {
    trafo = `<code>${esc(f.matricula)}</code>` +
      (f.ubicacion === 'orden' ? `<div class="inst-sub">${ROTULO_ORDEN[f.motivoUbicacion] || ROTULO_ORDEN.no_hallado}</div>` : '');
  }
  const zona = f.zona || f.departamento
    ? `${esc(nombreZona(f.zona) || '—')}${f.departamento ? `<div class="inst-sub">${esc(nombreDepto(f.departamento))}</div>` : ''}`
    : '<span class="inst-sub">—</span>';
  const entregas = f.entregas.length
    ? `<ul class="inst-entregas">${f.entregas.map((e) => htmlEntrega(e, f, unidad)).join('')}</ul>`
    : '<span class="inst-sub">—</span>';
  // Un solo elemento por celda: en celular la celda es una cuadrícula «etiqueta | valor».
  const td = (etiqueta, html, clase = '') => `
          <td role="cell"${clase ? ` class="${clase}"` : ''} data-etiqueta="${etiqueta}"><div class="inst-val">${html}</div></td>`;
  return `
        <tr role="row">${td('Subestación', f.subestacion ? esc(f.subestacion) : '<span class="inst-sub">—</span>')}
          <th role="rowheader" scope="row" data-etiqueta="Transformador"><div class="inst-val">${trafo}</div></th>${
  td('Zona / Depto.', zona)}${td('Cantidad', `<b>${fmtCant(f.cantidad)}</b> ${esc(unidad)}`, 'inst-num')}${
  td('Entregas', entregas, 'inst-col-entregas')}${td('Estado', htmlEstado(f, unidad))}
        </tr>`;
}

/**
 * HTML del detalle de un accesorio (texto escapado; sin DOM).
 * @param {object} det     resultado de `instalacionesDeItem`
 * @param {string} estado  de `estadoOrdenes`
 */
export function htmlDetalle(det, estado) {
  const u = det.unidad;
  const titulo = `Dónde se instaló · <code>${esc(det.codigo)}</code> ${esc(det.nombre)}`;
  const partes = [];
  partes.push(`
    <div class="inst-cabeza">
      <h3 class="inst-titulo" id="${ID_TITULO}">${titulo}</h3>
      <button type="button" class="btn btn-secondary inst-cerrar" data-inst-cerrar>Cerrar</button>
    </div>`);

  if (det.total > 0) {
    let r = `Total instalado: ${frasesTotal(det, { num: (s) => `<b>${s}</b>`, u: esc(u) })}`;
    r += `.<br>Registrado en Movimientos: <b>${fmtCant(det.registrado)} ${esc(u)}</b>`;
    if (estado === 'ok') {
      r += det.porRegistrar > 0
        ? ` · Por registrar (según las órdenes de entrada): <b>${fmtCant(det.porRegistrar)} ${esc(u)}</b>`
        : ' · Nada por registrar';
    }
    partes.push(`<p class="inst-resumen">${r}.</p>`);
  } else {
    partes.push('<p class="inst-resumen inst-vacio">Todavía no se ha instalado ninguna unidad de este accesorio en este contrato.</p>');
  }

  if (estado === 'leyendo') partes.push('<p class="inst-nota">Leyendo las órdenes de entrada y salida: por ahora se cuentan solo los movimientos.</p>');
  if (estado === 'error') partes.push('<p class="inst-nota">No se pudieron leer las órdenes de entrada y salida: se cuentan solo los movimientos, como en la tabla.</p>');
  if (estado === 'sin_nexo' && det.total > 0) partes.push('<p class="inst-nota">Este contrato no se cruza con las órdenes de entrada y salida: todo sale de los movimientos registrados.</p>');
  if (det.sinDesglose > 0) {
    partes.push(`<p class="inst-nota">${fmtCant(det.sinDesglose)} ${esc(u)} de las órdenes están por registrar y esta versión de la página no ` +
      'sabe en qué transformador: recargue la página para verlo.</p>');
  }
  if (det.cuadre && !det.cuadre.cuadra) {
    partes.push(`<p class="inst-alerta">⚠ La suma de este detalle (${fmtCant(det.cuadre.detalle)} ${esc(u)}) no coincide con la columna ` +
      `−Egresos de la tabla (${fmtCant(det.cuadre.tabla)} ${esc(u)}). Recargue la página; si sigue igual, avise para revisarlo.</p>`);
  }

  if (det.filas.length) {
    const igual = det.cuadre && det.cuadre.cuadra ? '<span class="inst-sub">igual a la columna −Egresos</span>' : '';
    partes.push(`
    <div class="inst-caja">
      <table class="inst-tabla" role="table">
        <caption class="inst-sr">Dónde se instaló ${esc(det.codigo)}, por transformador: primero el que más unidades recibió.</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">Subestación</th>
            <th role="columnheader" scope="col">Transformador</th>
            <th role="columnheader" scope="col">Zona / Depto.</th>
            <th role="columnheader" scope="col" class="inst-num">Cantidad</th>
            <th role="columnheader" scope="col">Entregas <span class="inst-th-sub">(fecha · orden · movimiento)</span></th>
            <th role="columnheader" scope="col">Estado</th>
          </tr>
        </thead>
        <tbody role="rowgroup">${det.filas.map((f) => htmlFila(f, u)).join('')}
        </tbody>
        <tfoot role="rowgroup">
          <tr role="row">
            <th role="rowheader" scope="row" colspan="3">Total instalado</th>
            <td role="cell" class="inst-num"><b>${fmtCant(det.total)}</b> ${esc(u)}</td>
            <td role="cell" colspan="2">${igual}</td>
          </tr>
        </tfoot>
      </table>
    </div>`);
  }

  if (det.ingresos && det.ingresos.movimientos > 0) {
    const n = det.ingresos.movimientos;
    partes.push(`<p class="inst-ingresos">Además, este ítem tiene ${n} ${plural(n, 'ingreso', 'ingresos')} al inventario por ` +
      `${fmtCant(det.ingresos.cantidad)} ${esc(u)}` + (det.ingresos.codigos.length ? ` (${det.ingresos.codigos.map(esc).join(', ')})` : '') +
      '. Los ingresos no son instalaciones: no entran en este detalle.</p>');
  }
  if (det.filas.length > 2) {          // con 3 fichas en celular ya hay que subir mucho para cerrar
    partes.push('<div class="inst-pie"><button type="button" class="btn btn-secondary inst-cerrar" data-inst-cerrar>Cerrar el detalle</button></div>');
  }
  return `<div class="inst-panel" id="${ID_PANEL}" role="region" aria-labelledby="${ID_TITULO}">${partes.join('')}
  </div>`;
}

/** Enlaza la hoja de estilo del detalle si la página (HTML viejo en caché) no la trae. */
function asegurarEstilo(doc) {
  if (doc.querySelector(`link[href*="${HOJA_ESTILO}"]`)) return;
  const l = doc.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL(`../../css/${HOJA_ESTILO}`, import.meta.url).href;
  doc.head.appendChild(l);
}

/**
 * Conecta el detalle a la tabla «Stock por ítem».
 * @param {object}   p
 * @param {HTMLElement} p.tbody     cuerpo de la tabla; cada fila de ítem trae `data-codigo`
 * @param {number}   p.columnas     columnas de la tabla (para el colspan del detalle)
 * @param {Function} p.datos        () => { catalogo, movimientos, nexo, parque, parqueEstado, ordenes, contratoId }
 * @param {Document} [p.doc]
 * @returns {{ alPintarTabla:Function, seleccionado:Function, cerrar:Function }}
 */
export function crearDetalleInstalaciones({ tbody, columnas, datos, doc = document } = {}) {
  if (!tbody || typeof datos !== 'function') throw new Error('crearDetalleInstalaciones: falta la tabla o los datos');
  asegurarEstilo(doc);
  let sel = '';
  let ultimoAnuncio = '';
  let ultimoFoco = null;                 // { el, codigo, cerrar } — para devolver el foco si un repintado lo borra
  tbody.classList.add('inst-activo');
  tbody.closest('.table-scroll')?.classList.add('inst-contenedor');
  const cajaTabla = tbody.closest('.table-wrap') || tbody.closest('table');

  // Pista visible: sin ella nadie sabe que la fila se abre (solo aparece si el módulo cargó).
  if (cajaTabla && cajaTabla.parentNode && !doc.getElementById('instPista')) {
    const pista = doc.createElement('p');
    pista.id = 'instPista';
    pista.className = 'inst-pista';
    pista.textContent = 'Seleccione un ítem (su código o su fila) para ver dónde se instaló y cuántas unidades.';
    cajaTabla.parentNode.insertBefore(pista, cajaTabla);
  }

  // Anuncio discreto (fuera del tbody, que se repinta entero).
  let anuncio = doc.getElementById(ID_ANUNCIO);
  if (!anuncio) {
    anuncio = doc.createElement('p');
    anuncio.id = ID_ANUNCIO;
    anuncio.className = 'inst-sr';
    anuncio.setAttribute('aria-live', 'polite');
    anuncio.setAttribute('aria-atomic', 'true');
    (cajaTabla && cajaTabla.parentNode ? cajaTabla.parentNode.insertBefore(anuncio, cajaTabla.nextSibling) : doc.body.appendChild(anuncio));
  }
  const anunciar = (t) => {
    if (!t || t === ultimoAnuncio) return;
    ultimoAnuncio = t;
    anuncio.textContent = t;
  };

  const filasItem = () => [...tbody.querySelectorAll('tr[data-codigo]')];
  const botonDe = (codigo) => filasItem().find((tr) => tr.dataset.codigo === codigo)?.querySelector('[data-inst-codigo]') || null;

  function decorar() {
    for (const tr of filasItem()) {
      const td = tr.cells && tr.cells[0];
      if (!td || td.querySelector('[data-inst-codigo]')) continue;
      const codigo = tr.dataset.codigo;
      // Sin `title`: repetiría el nombre accesible (la pista sobre la tabla ya lo explica).
      td.innerHTML = `<button type="button" class="inst-btn" data-inst-codigo="${esc(codigo)}" aria-expanded="false">` +
        `<span class="inst-sr">Ver dónde se instaló </span><code>${esc(codigo)}</code>` +
        '<span class="inst-chev" aria-hidden="true"></span></button>';
    }
  }

  function pintar(motivo) {
    tbody.querySelectorAll('tr.inst-fila').forEach((x) => x.remove());
    for (const tr of filasItem()) {
      const b = tr.querySelector('[data-inst-codigo]');
      const abierto = !!sel && tr.dataset.codigo === sel;
      tr.classList.toggle('inst-sel', abierto);
      if (b) {
        b.setAttribute('aria-expanded', abierto ? 'true' : 'false');
        if (abierto) b.setAttribute('aria-controls', ID_PANEL); else b.removeAttribute('aria-controls');
      }
    }
    if (!sel) return;
    const tr = filasItem().find((x) => x.dataset.codigo === sel);
    if (!tr) return;                     // un filtro la oculta: vuelve a aparecer al quitarlo
    const d = datos() || {};
    const item = (d.catalogo || []).find((r) => r.codigo === sel) || { codigo: sel };
    const stock = (item._calc && item._calc.stock) || item.stock || {};
    const det = instalacionesDeItem({ codigo: sel, item, movimientos: d.movimientos, nexo: d.nexo, parque: d.parque,
      parqueEstado: d.parqueEstado, egresadoTabla: typeof stock.egresado === 'number' ? stock.egresado : undefined });
    const estado = estadoOrdenes(d);
    const fila = doc.createElement('tr');
    fila.className = 'inst-fila';
    fila.innerHTML = `<td class="inst-celda" colspan="${Number(columnas) || 1}">${htmlDetalle(det, estado)}</td>`;
    tr.after(fila);
    const resumen = textoResumen(det, estado);
    if (motivo === 'abrir') anunciar(`Detalle abierto. ${resumen}`);
    else if (resumen !== ultimoAnuncio.replace(/^Detalle (abierto|actualizado)\. /, '')) anunciar(`Detalle actualizado. ${resumen}`);
  }

  function devolverFoco() {
    // Un repintado de la tabla borra el botón que tenía el foco: se devuelve al nuevo, sin mover la página.
    if (!ultimoFoco || ultimoFoco.el.isConnected) return;
    const activo = doc.activeElement;
    if (activo && activo !== doc.body) return;
    let destino = null;
    if (ultimoFoco.cerrar && sel === ultimoFoco.codigo) {
      // El mismo «Cerrar» que tenía el foco (el de abajo, si sigue habiendo pie; si no, el de arriba).
      if (ultimoFoco.cerrar === 'pie') destino = tbody.querySelector('tr.inst-fila .inst-pie [data-inst-cerrar]');
      if (!destino) destino = tbody.querySelector('tr.inst-fila .inst-cabeza [data-inst-cerrar]');
    }
    if (!destino) destino = botonDe(ultimoFoco.codigo);
    if (destino) { destino.focus({ preventScroll: true }); ultimoFoco = { ...ultimoFoco, el: destino }; }
  }

  function abrir(codigo) { sel = codigo; pintar('abrir'); }
  function cerrar(enfocar) {
    const codigo = sel;
    sel = '';
    ultimoAnuncio = '';
    anuncio.textContent = '';            // al volver a abrir, el mismo texto se anuncia otra vez
    pintar('cerrar');
    if (enfocar && codigo) botonDe(codigo)?.focus({ preventScroll: true });
  }
  function alternar(codigo, enfocarBoton) {
    if (sel === codigo) cerrar(enfocarBoton);
    else {
      abrir(codigo);
      if (enfocarBoton) botonDe(codigo)?.focus({ preventScroll: true });
    }
  }

  tbody.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t && t.closest)) return;
    if (t.closest('[data-inst-cerrar]')) { cerrar(true); return; }
    if (t.closest('tr.inst-fila')) return;                    // dentro del detalle
    const tr = t.closest('tr[data-codigo]');
    if (!tr || !tbody.contains(tr)) return;
    const btn = t.closest('[data-inst-codigo]');
    if (!btn) {
      // Clic en el resto de la fila: también abre, salvo sobre otro control o al seleccionar texto.
      if (t.closest('a, button, input, select, textarea, label')) return;
      const s = doc.defaultView && doc.defaultView.getSelection ? String(doc.defaultView.getSelection() || '') : '';
      if (s.trim()) return;
    }
    alternar(tr.dataset.codigo, !btn);
  });
  tbody.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !sel) return;
    const t = e.target;
    if (t && t.closest && (t.closest('tr.inst-fila') || t.closest(`[data-inst-codigo]`)?.dataset.instCodigo === sel)) {
      e.preventDefault();
      cerrar(true);
    }
  });
  tbody.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!(t && t.closest)) return;
    const b = t.closest('[data-inst-codigo]');
    if (b) { ultimoFoco = { el: b, codigo: b.dataset.instCodigo, cerrar: false }; return; }
    if (t.closest('[data-inst-cerrar]')) { ultimoFoco = { el: t, codigo: sel, cerrar: t.closest('.inst-pie') ? 'pie' : 'arriba' }; return; }
    ultimoFoco = null;
  });
  tbody.addEventListener('focusout', (e) => {
    const t = e.target;
    // Si el foco se fue a otra parte de la página (y no porque el repintado borró el botón), se olvida.
    Promise.resolve().then(() => { if (t && t.isConnected && !tbody.contains(doc.activeElement)) ultimoFoco = null; });
  });

  return {
    /** El tablero acaba de repintar las filas: botones, detalle abierto con los datos nuevos y foco. */
    alPintarTabla() { decorar(); pintar('datos'); devolverFoco(); },
    seleccionado: () => sel,
    cerrar: () => cerrar(false)
  };
}
