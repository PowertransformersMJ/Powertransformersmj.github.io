// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Shell / Controlador
// ──────────────────────────────────────────────────────────────
// Entrypoint de la página pages/pruebas-electricas.html. Orquesta:
//   · data layer en vivo (onSnapshot)
//   · componentes UI (semáforo, tablas, gráficas)
//   · ficha de identidad y KPIs del parque
//   · modal de carga de informe (serie → PDF → confirmar)
//
// NO contiene reglas de negocio: la calificación normativa vive en
// el dominio (pruebas_electricas_semaforo.js) y la presentación en
// los componentes de assets/js/ui/pruebas/. Aquí solo se conecta el
// flujo de datos con el DOM.
//
// Interfaz en tiempo real · solo datos reales: TODO lo que se ve
// (matriz, tablas, historial y las 6 gráficas) se deriva de informes
// reales. La unidad 173523-15510 trae 3 informes BASE históricos
// (curados en pruebas_electricas_seed.js, valores tal cual el tablero
// de referencia) que se inyectan como punto de partida de la
// tendencia; los informes que el usuario suba al MISMO número de serie
// se anexan en vivo encima del seed. Los informes base son de solo
// lectura (PDF descargable, no eliminables). No hay datos inventados.
// ══════════════════════════════════════════════════════════════

import {
  isReady,
  suscribirUnidades, suscribirInformes,
  guardarUnidad, crearInforme, subirPDF, eliminarInforme
} from './data/pruebas_electricas.js';
import { unidadesSeed, informesSeed } from './data/pruebas_electricas_seed.js';
import {
  sanitizarInforme, confirmarSerie, detectarAno
} from './domain/pruebas_electricas_schema.js';
import { extraerMediciones } from './domain/pruebas_electricas_extraccion.js';
import { renderMatriz, estadoVigente } from './ui/pruebas/semaforo.js';
import { renderInformes, mountTablas } from './ui/pruebas/tabla-pruebas.js';
import { mountCharts, derivarSeries } from './ui/pruebas/grafico-svg.js';

/* ─── Estado de la vista ──────────────────────────────────────── */
const state = {
  unidades: [],
  unidadActiva: null,
  informes: [],
  unsubInformes: null,
  filtroBiblioteca: ''
};

const $ = (id) => document.getElementById(id);

// Normaliza texto para búsqueda: minúsculas + sin acentos (NFD).
const norm = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ─── Seed: unidad + 3 informes base (datos reales históricos) ─── */
// La capa de datos emite [] cuando Firebase no está activo ("solo datos
// reales"). Los 3 informes base SON datos reales, así que se inyectan
// como punto de partida de la tendencia tanto offline como con backend.
// El merge respeta lo que venga en vivo: una unidad/informe en Firestore
// con la misma serie/año pisa al seed (el usuario corrigió o reemplazó).

function mergeUnidades(live) {
  const out = unidadesSeed();
  const idx = new Map(out.map((u, i) => [u.id || u.serie, i]));
  (live || []).forEach((u) => {
    const k = u.id || u.serie;
    if (idx.has(k)) out[idx.get(k)] = { ...out[idx.get(k)], ...u };
    else out.push(u);
  });
  return out;
}

// Combina los informes base (marcados _seed → solo lectura) con los que
// llegan en vivo. Un informe en vivo cuyo año coincide con el de un seed
// reemplaza a ese seed; pero DOS informes en vivo NUNCA se colapsan entre
// sí: cada uno es un documento Firestore con id propio y debe conservarse
// (subir 6 PDFs guarda 6 informes, aunque compartan año o no traigan año).
function mergeInformes(unidadId, live) {
  const liveArr = (live || []).slice();
  const orden = (a, b) => (a.ano || 0) - (b.ano || 0);
  const base = informesSeed(unidadId);
  if (!base.length) return liveArr.sort(orden);
  const anosLive = new Set(liveArr.map((i) => i.ano).filter((a) => a != null));
  const seed = base
    .filter((i) => !anosLive.has(i.ano))
    .map((i) => ({ ...i, _seed: true }));
  return seed.concat(liveArr).sort(orden);
}

/* ─── KPIs y ficha de identidad ───────────────────────────────── */

const ID_FILAS = [
  ['Fabricante',   'fabricante'],
  ['N° serie',     'serie'],
  ['Año',          'ano_fabricacion'],
  ['Potencia',     'potencia'],
  ['Tensiones',    'tensiones'],
  ['Grupo',        'grupo_conexion'],
  ['Refrigeración','refrigeracion'],
  ['Frecuencia',   'frecuencia'],
  ['Cliente',      'cliente'],
  ['Ubicación',    'ubicacion']
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderIdentidad(u) {
  const cont = $('idgrid');
  if (!cont) return;
  if (!u) { cont.innerHTML = '<p class="muted small">Sin unidad seleccionada.</p>'; return; }
  cont.innerHTML = ID_FILAS.map(([k, key]) => {
    const v = u[key];
    return `<div class="idcell"><div class="k">${esc(k)}</div>` +
      `<div class="v">${v == null || v === '' ? '—' : esc(v)}</div></div>`;
  }).join('');
}

// Paleta de lomos para los libros de la biblioteca. El color se asigna de
// forma determinista por hash de la serie: misma serie → mismo lomo siempre,
// sin inventar ningún dato (es puramente presentacional).
const SPINES = [
  ['#16365c', '#0f2741'], ['#0f8a99', '#0a5b66'], ['#7a3b2e', '#52271d'],
  ['#3d5a3a', '#273a25'], ['#5a3d6e', '#3a2748'], ['#8a6d1f', '#5c4814'],
  ['#1e4e79', '#143553'], ['#2e6b5e', '#1d453c']
];

function spineFor(serie) {
  const s = String(serie || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SPINES[h % SPINES.length];
}

// Filtra las unidades de la biblioteca por el texto buscado (serie,
// fabricante, ubicación, cliente o subestación · sin acentos).
function filtrarUnidades(unidades) {
  const q = norm(state.filtroBiblioteca).trim();
  if (!q) return unidades || [];
  return (unidades || []).filter((u) => {
    const blob = norm([u.serie, u.id, u.fabricante, u.ubicacion, u.cliente, u.subestacion]
      .filter(Boolean).join(' '));
    return blob.includes(q);
  });
}

// Renderiza la biblioteca: cada unidad es un libro cuyo lomo muestra el
// número de serie. Al abrirlo (clic) se ilustra su histórico de informes.
function renderParqueGrid(unidades) {
  const grid = $('parque-grid');
  if (!grid) return;
  const filtradas = filtrarUnidades(unidades);
  const sinResultados = state.filtroBiblioteca.trim() && filtradas.length === 0;
  const aviso = sinResultados
    ? `<p class="pe-lib-empty">Ningún libro coincide con “${esc(state.filtroBiblioteca.trim())}”.</p>`
    : '';
  const books = filtradas.map((u) => {
    const serie = u.serie || u.id;
    const meta = [u.fabricante, u.potencia].filter(Boolean).join(' · ');
    const [s1, s2] = spineFor(serie);
    return `<button type="button" class="pe-book" data-serie="${esc(serie)}" ` +
      `style="--spine:${s1};--spine2:${s2}" ` +
      `title="Abrir histórico de ${esc(serie)}">` +
      `<span class="pe-book-head" aria-hidden="true"></span>` +
      `<span class="pe-book-label"><span class="pe-book-serie">${esc(serie)}</span>` +
      (meta ? `<span class="pe-book-maker">${esc(meta)}</span>` : '') +
      `</span>` +
      `<span class="pe-book-foot" aria-hidden="true"></span></button>`;
  }).join('');
  const addBook = `<button type="button" class="pe-book pe-book-add" ` +
    `onclick="openUpload()" title="Cargar informe de una unidad">` +
    `<span class="pe-addbook-plus" aria-hidden="true">＋</span>` +
    `<span class="pe-addbook-lbl">Cargar informe</span></button>`;
  grid.innerHTML = aviso + books + addBook;
  marcarLibroActivo();
}

// Resalta el libro de la unidad activa (estado .is-open).
function marcarLibroActivo() {
  const grid = $('parque-grid');
  if (!grid) return;
  const act = state.unidadActiva ? (state.unidadActiva.serie || state.unidadActiva.id) : null;
  grid.querySelectorAll('.pe-book[data-serie]').forEach((b) => {
    b.classList.toggle('is-open', !!act && b.getAttribute('data-serie') === act);
  });
}

// Clic en una tarjeta del parque → selecciona esa serie (refleja la serie
// en el campo de búsqueda y dispara el render completo de la unidad).
function onClickParque(ev) {
  const btn = ev.target.closest('[data-serie]');
  if (!btn) return;
  const v = btn.getAttribute('data-serie');
  const u = state.unidades.find((x) => (x.serie || x.id) === v);
  if (!u) return;
  const inp = $('serieInput');
  if (inp) inp.value = v;
  seleccionarUnidad(u);
  // Abrir un libro lleva al Tablero, donde se ilustra toda la información
  // de la unidad (matriz, identidad, tablas y gráficas de las pruebas).
  irAlTablero();
}

// Cambia a la pestaña Tablero activando su botón (delega en module-shell).
function irAlTablero() {
  const tab = document.querySelector('#pruebasTabs [role="tab"][data-tab="tablero"]');
  if (tab) tab.click();
  const top = document.querySelector('#pruebasTabs');
  if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function refrescarKpisParque() {
  if ($('kpi-unidades')) $('kpi-unidades').textContent = String(state.unidades.length || 0);
  const subs = new Set(state.unidades.map((u) => u.subestacion).filter(Boolean));
  if ($('kpi-subestaciones')) $('kpi-subestaciones').textContent = String(subs.size || 0);
}

/* ─── Render de los informes de la unidad activa ──────────────── */

// Borrar informes es operación admin: las rules exigen isAdmin() y el
// botón solo se muestra con backend activo (los informes del seed son
// de solo lectura y no tienen doc real que eliminar).
function esAdmin() {
  const s = window.__sgmSession;
  return !!(s && (s.role === 'admin' || (s.profile && s.profile.rol === 'admin')));
}

function renderInformesUI(informes) {
  state.informes = informes || [];
  const u = state.unidadActiva || {};

  // Matriz de calificación (semáforo)
  renderMatriz($('matrix'), state.informes);

  // Tablas de detalle por prueba
  mountTablas(state.informes, document);

  // Gráficas derivadas de los informes en vivo (sin datos → estado vacío)
  mountCharts(derivarSeries(state.informes), document);

  // Historial + KPI de conteo
  renderInformes($('reportlist'), state.informes, {
    serieUnidad: u.serie,
    kpiEl: $('kpi-informes'),
    canDelete: isReady() && esAdmin()
  });

  // KPI estado vigente
  const est = estadoVigente(state.informes);
  const docs = state.informes.slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  const ult = docs[docs.length - 1];
  const kpiEstado = $('kpi-estado');
  if (kpiEstado) {
    const txt = ult ? `${est.etiqueta || '—'}` : '—';
    kpiEstado.textContent = txt;
    kpiEstado.title = ult ? `Informe vigente ${ult.ano}` : '';
  }
}

function escucharInformes(unidadId) {
  if (state.unsubInformes) { state.unsubInformes(); state.unsubInformes = null; }
  state.unsubInformes = suscribirInformes(
    unidadId,
    (informes) => renderInformesUI(mergeInformes(unidadId, informes)),
    (err) => {
      console.warn('[pruebas-electricas] informes', err);
      renderInformesUI(mergeInformes(unidadId, []));
    }
  );
}

function seleccionarUnidad(u) {
  state.unidadActiva = u;
  marcarLibroActivo();
  if (!u) { renderVacioSeleccion(); return; }
  renderIdentidad(u);
  escucharInformes(u.id || u.serie);
}

/* ─── Estado vacío: nada se ilustra hasta elegir una serie ────── */
// Todo el interior del módulo (matriz, identidad, tablas, gráficas e
// historial) se deriva de una unidad. Sin serie seleccionada se muestra
// un prompt en cada contenedor y se resetean los KPIs por unidad.
function renderVacioSeleccion() {
  if (state.unsubInformes) { state.unsubInformes(); state.unsubInformes = null; }
  state.informes = [];
  const prompt = '<p class="muted small">Selecciona un número de serie para ilustrar esta sección.</p>';
  // Contenedores que se vacían por completo (tablas y gráficas)
  ['t-tand', 't-exc', 't-rel', 't-res', 't-ins', 't-col',
   'c-tand', 'c-exc', 'c-rel', 'c-res', 'c-ins', 'c-col'].forEach((id) => {
    const el = $(id); if (el) el.innerHTML = '';
  });
  // Contenedores con prompt explícito
  ['matrix', 'idgrid', 'reportlist'].forEach((id) => {
    const el = $(id); if (el) el.innerHTML = prompt;
  });
  if ($('kpi-informes')) $('kpi-informes').textContent = '—';
  if ($('kpi-estado')) {
    $('kpi-estado').textContent = '—';
    $('kpi-estado').title = '';
  }
}

/* ─── Borrado de informes (delegación sobre #reportlist) ──────── */

// Elimina una lista de informes en secuencia y reporta el resultado.
async function borrarVarios(unidadId, ids) {
  let ok = 0;
  for (const id of ids) {
    try { await eliminarInforme(unidadId, id); ok += 1; }
    catch (err) { console.error('[pruebas-electricas] eliminarInforme', id, err); }
  }
  return ok;
}

async function onClickReportlist(ev) {
  const u = state.unidadActiva || {};
  const unidadId = u.id || u.serie;
  if (!unidadId) return;
  const serieTxt = u.serie || unidadId;
  const rl = $('reportlist');

  // ── "Seleccionar todos" ──
  const selAll = ev.target.closest('[data-sel-all]');
  if (selAll) {
    const marcado = selAll.checked;
    rl.querySelectorAll('.pe-chk').forEach((c) => { c.checked = marcado; });
    return;
  }

  // ── "Eliminar todos" ──
  const allBtn = ev.target.closest('[data-del-all]');
  if (allBtn) {
    // Los informes base (_seed) son de solo lectura: no se eliminan.
    const eliminables = (state.informes || []).filter((i) => !i._seed && i.id);
    const total = eliminables.length;
    if (!total) return toast('No hay informes eliminables (los base son de solo lectura).', 'warn');
    if (!window.confirm(`¿Eliminar TODOS los ${total} informes de la serie ${serieTxt}?\n` +
        `Esta acción no se puede deshacer.`)) return;
    allBtn.disabled = true;
    allBtn.textContent = 'Eliminando…';
    const ids = eliminables.map((i) => i.id);
    const ok = await borrarVarios(unidadId, ids);
    toast(`${ok} de ${ids.length} informe(s) eliminado(s).`, ok === ids.length ? undefined : 'warn');
    // onSnapshot refresca la tabla sola.
    return;
  }

  // ── "Eliminar seleccionados" ──
  const selBtn = ev.target.closest('[data-del-sel]');
  if (selBtn) {
    const ids = Array.from(rl.querySelectorAll('.pe-chk:checked'))
      .map((c) => c.getAttribute('data-sel')).filter(Boolean);
    if (!ids.length) return toast('Marca al menos un informe.', 'warn');
    if (!window.confirm(`¿Eliminar ${ids.length} informe(s) seleccionado(s) de la serie ${serieTxt}?\n` +
        `Esta acción no se puede deshacer.`)) return;
    selBtn.disabled = true;
    selBtn.textContent = 'Eliminando…';
    const ok = await borrarVarios(unidadId, ids);
    toast(`${ok} de ${ids.length} informe(s) eliminado(s).`, ok === ids.length ? undefined : 'warn');
    return;
  }

  // ── Borrado uno a uno (botón por fila) ──
  const btn = ev.target.closest('[data-del]');
  if (!btn) return;
  const informeId = btn.getAttribute('data-del');
  const ano = btn.getAttribute('data-ano') || '';
  if (!informeId) return;
  if (!window.confirm(`¿Eliminar el informe ${ano} de la serie ${serieTxt}?\n` +
      `Esta acción no se puede deshacer.`)) return;
  btn.disabled = true;
  btn.textContent = 'Eliminando…';
  try {
    await eliminarInforme(unidadId, informeId);
    toast(`Informe ${ano} eliminado.`);
    // La suscripción onSnapshot refresca la tabla sola.
  } catch (err) {
    console.error('[pruebas-electricas] eliminarInforme', err);
    btn.disabled = false;
    btn.textContent = '🗑 Eliminar';
    toast('No se pudo eliminar el informe.', 'warn');
  }
}

/* ─── Arranque ────────────────────────────────────────────────── */

// Re-sincroniza el render con la serie elegida en el <select>: si la
// serie activa sigue en el parque la mantiene; si no, vuelve al vacío.
// NO auto-selecciona ninguna unidad: nada se ilustra hasta que el
// usuario elige una serie.
function sincronizarSeleccion() {
  if (!state.unidadActiva) { seleccionarUnidad(null); return; }
  const k = state.unidadActiva.id || state.unidadActiva.serie;
  const actual = state.unidades.find((u) => (u.id || u.serie) === k);
  seleccionarUnidad(actual || null);
}

function arrancar() {
  const rl = $('reportlist');
  if (rl) rl.addEventListener('click', onClickReportlist);
  const pg = $('parque-grid');
  if (pg) pg.addEventListener('click', onClickParque);
  // Campo único de "Número de serie": digitable, no seleccionable. Filtra
  // los libros de la biblioteca en vivo y, al coincidir con una unidad,
  // abre su tablero. No usa <select> ni <datalist> (CLAUDE.md §0.1.2.12).
  const inp = $('serieInput');
  if (inp) {
    inp.addEventListener('input', () => {
      state.filtroBiblioteca = inp.value || '';
      renderParqueGrid(state.unidades);
      // Coincidencia exacta con una serie → selecciona esa unidad en vivo.
      const v = norm(inp.value).trim();
      const u = v
        ? state.unidades.find((x) => norm(x.serie || x.id).trim() === v)
        : null;
      seleccionarUnidad(u || null);
    });
    // Enter: si hay una única coincidencia, ábrela directo en el tablero.
    inp.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const hits = filtrarUnidades(state.unidades);
      if (hits.length === 1) {
        const u = hits[0];
        inp.value = u.serie || u.id;
        seleccionarUnidad(u);
        irAlTablero();
      }
    });
  }
  suscribirUnidades(
    (unidades) => {
      state.unidades = mergeUnidades(unidades);
      renderParqueGrid(state.unidades);
      refrescarKpisParque();
      sincronizarSeleccion();
    },
    (err) => {
      console.warn('[pruebas-electricas] unidades', err);
      // Sin backend solo queda el seed: la unidad base con sus 3 informes
      // históricos como punto de partida de la tendencia.
      state.unidades = mergeUnidades([]);
      renderParqueGrid(state.unidades);
      refrescarKpisParque();
      sincronizarSeleccion();
    }
  );
}

/* ══════════════════════════════════════════════════════════════
   Modal de carga de informe (serie → PDFs+año → confirmar)
   ──────────────────────────────────────────────────────────────
   Soporta VARIOS informes en una sola sesión: el paso 1 fija la
   serie (común a todos), el paso 2 adjunta N PDFs y a cada uno se
   le asigna su año (el año discrimina cada informe), y el paso 3
   confirma y almacena todos secuencialmente.
   ══════════════════════════════════════════════════════════════ */

// item: { id, file, ano, textoPdf }
const UP = { step: 1, serie: '', items: [], store: true };
let _itemSeq = 0;

function toast(msg, kind) {
  const t = $('toast');
  if (!t) return;
  t.className = 'pe-toast' + (kind ? ' ' + kind : '');
  t.innerHTML = `<span class="tk">${kind === 'warn' ? '⚠' : '✓'}</span><span>${esc(msg)}</span>`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3600);
}

function setStepbar() {
  ['sb1', 'sb2', 'sb3'].forEach((id, i) => {
    const el = $(id);
    if (!el) return;
    el.className = 'sbi' + (UP.step === i + 1 ? ' act' : (UP.step > i + 1 ? ' done' : ''));
  });
}

function openUpload() {
  UP.step = 1;
  // La carga se asocia a la serie indicada en el campo "Número de serie";
  // si está vacío, cae a la unidad abierta (si la hay).
  const tecleada = ($('serieInput') && $('serieInput').value.trim()) || '';
  UP.serie = tecleada || (state.unidadActiva && state.unidadActiva.serie) || '';
  UP.items = [];
  _itemSeq = 0;
  const ov = $('ov');
  if (ov) ov.classList.add('on');
  renderModal();
}

/* ¿Todos los ítems tienen un año válido? */
function itemsListos() {
  return UP.items.length > 0 &&
    UP.items.every((it) => Number.isInteger(it.ano) && it.ano >= 1950 && it.ano <= 2100);
}

function closeUpload() {
  const ov = $('ov');
  if (ov) ov.classList.remove('on');
}

function renderModal() {
  setStepbar();
  const body = $('mBody');
  const title = $('mTitle');
  if (!body) return;
  if (UP.step === 1) {
    if (title) title.textContent = 'Cargar informes · serie';
    body.innerHTML =
      `<div class="flbl">Número de serie de la unidad</div>` +
      `<input class="inp" id="serIn" value="${esc(UP.serie)}" placeholder="173523-15510">` +
      `<p class="muted small" style="margin-top:10px">La serie es común a todos los informes que adjuntes. ` +
      `En el siguiente paso podrás añadir varios PDF, cada uno con su propio año.</p>` +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mCancel">Cancelar</button>` +
      `<button class="btn btn-primary" id="mNext1">Continuar</button></div>`;
    $('mCancel').onclick = closeUpload;
    $('mNext1').onclick = async () => {
      UP.serie = $('serIn').value.trim();
      if (!UP.serie) return toast('Ingresa el número de serie.', 'warn');
      // Materializa el doc padre de la unidad (docId = serie) en cuanto
      // se confirma la serie. Un padre con solo subcolección es
      // "fantasma" en Firestore y NO aparece en suscribirUnidades; al
      // hacer merge aquí, cualquier informe ya cargado bajo esta serie
      // (p. ej. los previos a este arreglo) emerge en tiempo real.
      if (isReady()) {
        try { await guardarUnidad({ serie: UP.serie }); }
        catch (e) { console.warn('[pruebas] no se pudo materializar la unidad:', e); }
      }
      UP.step = 2; renderModal();
    };
  } else if (UP.step === 2) {
    if (title) title.textContent = 'Cargar informes · PDF y año';
    const faltanAno = UP.items.some((it) => it.ano == null);
    const lista = UP.items.map((it) => {
      const anoVal = it.ano == null ? '' : it.ano;
      const flag = it.ano == null ? ' fi-falta' : '';
      return `<div class="fitem${flag}" data-id="${it.id}">` +
        `<span class="fi-doc">📄</span>` +
        `<span class="fi-name" title="${esc(it.file.name)}">${esc(it.file.name)}</span>` +
        `<input class="fi-ano" type="number" min="1950" max="2100" ` +
        `data-id="${it.id}" value="${anoVal}" placeholder="Año">` +
        `<button class="fi-del" data-id="${it.id}" title="Quitar">✕</button></div>`;
    }).join('');
    const hint = UP.items.length
      ? `<p class="muted small" style="margin:2px 0 10px">El año se detecta automáticamente del informe; ` +
        (faltanAno
          ? `escribe el año de los que aparecen resaltados.</p>`
          : `puedes corregirlo si hace falta.</p>`)
      : '';
    body.innerHTML =
      `<div class="drop" id="drop">Arrastra uno o varios PDF aquí o haz clic para elegirlos</div>` +
      `<input type="file" id="fileIn" accept="application/pdf" multiple style="display:none">` +
      (UP.items.length
        ? hint + `<div class="flist">${lista}</div>`
        : `<p class="muted small" style="margin-top:10px">Aún no has adjuntado informes.</p>`) +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mBack2">Atrás</button>` +
      `<button class="btn btn-primary" id="mNext2"${itemsListos() ? '' : ' disabled'}>Continuar</button></div>`;
    const drop = $('drop'); const fileIn = $('fileIn');
    drop.onclick = () => fileIn.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('drag'); };
    drop.ondragleave = () => drop.classList.remove('drag');
    drop.ondrop = (e) => {
      e.preventDefault(); drop.classList.remove('drag');
      agregarArchivos(e.dataTransfer.files);
    };
    fileIn.onchange = () => { agregarArchivos(fileIn.files); };
    body.querySelectorAll('.fi-ano').forEach((inp) => {
      inp.onchange = inp.oninput = () => {
        const it = UP.items.find((x) => x.id === Number(inp.dataset.id));
        if (it) it.ano = parseInt(inp.value, 10) || null;
        const nx = $('mNext2'); if (nx) nx.disabled = !itemsListos();
      };
    });
    body.querySelectorAll('.fi-del').forEach((btn) => {
      btn.onclick = () => {
        UP.items = UP.items.filter((x) => x.id !== Number(btn.dataset.id));
        renderModal();
      };
    });
    $('mBack2').onclick = () => { UP.step = 1; renderModal(); };
    $('mNext2').onclick = () => { if (itemsListos()) { UP.step = 3; renderModal(); } };
  } else {
    if (title) title.textContent = 'Cargar informes · confirmar';
    const filas = UP.items
      .slice().sort((a, b) => (a.ano || 0) - (b.ano || 0))
      .map((it) => {
        const chk = confirmarSerie(UP.serie, it.textoPdf);
        const verdict = !it.textoPdf
          ? `<span class="verdict wn"><span>⚠</span><span>Serie no verificada</span></span>`
          : chk.coincide
            ? `<span class="verdict gd"><span>✓</span><span>Serie coincide</span></span>`
            : `<span class="verdict bd"><span>✕</span><span>Serie NO hallada</span></span>`;
        return `<div class="crow">` +
          `<span class="cr-ano">${esc(it.ano)}</span>` +
          `<span class="cr-name" title="${esc(it.file.name)}">${esc(it.file.name)}</span>` +
          verdict + `</div>`;
      }).join('');
    body.innerHTML =
      `<div class="cmp" style="grid-template-columns:1fr">` +
      `<div class="cbox"><div class="ch">Serie ingresada</div><div class="cv">${esc(UP.serie)}</div></div></div>` +
      `<div class="flbl" style="margin-top:12px">Informes a almacenar (${UP.items.length})</div>` +
      `<div class="clist">${filas}</div>` +
      `<label class="chk"><input type="checkbox" id="store" ${UP.store ? 'checked' : ''}>` +
      `<span>Almacenar los informes y sus PDF originales (si Firebase está activo).</span></label>` +
      `<label class="chk"><input type="checkbox" id="chk">` +
      `<span>Confirmo que los datos son correctos.</span></label>` +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mBack3">Atrás</button>` +
      `<button class="btn btn-primary" id="mStore" disabled>Almacenar</button></div>`;
    $('store').onchange = (e) => { UP.store = e.target.checked; };
    $('chk').onchange = (e) => { $('mStore').disabled = !e.target.checked; };
    $('mBack3').onclick = () => { UP.step = 2; renderModal(); };
    $('mStore').onclick = storeReport;
  }
}

/* Añade uno o varios archivos a UP.items (descarta no-PDF) y extrae
   el texto de cada uno en segundo plano para confirmar la serie. */
function agregarArchivos(fileList) {
  const archivos = Array.from(fileList || [])
    .filter((f) => f && f.type === 'application/pdf');
  if (!archivos.length) {
    toast('Adjunta archivos PDF.', 'warn');
    return;
  }
  archivos.forEach((file) => {
    // Año deducido del nombre de archivo (determinista) antes de leer el PDF.
    const porNombre = detectarAno({ filename: file.name });
    const item = { id: ++_itemSeq, file, ano: porNombre.ano, textoPdf: '' };
    UP.items.push(item);
    extraerTexto(item);
  });
  renderModal();
}

async function extraerTexto(item) {
  try {
    const pdfjs = window.pdfjsLib;
    if (pdfjs && item.file.type === 'application/pdf') {
      const buf = await item.file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let texto = '';
      // Las mediciones (tan δ, excitación, etc.) viven en páginas
      // intermedias (4–8 típicamente); leer todo el informe acotado.
      const maxPag = Math.min(pdf.numPages, 30);
      for (let i = 1; i <= maxPag; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        texto += ' ' + tc.items.map((it) => it.str).join(' ');
      }
      item.textoPdf = texto;
    }
  } catch (err) {
    console.warn('[pruebas-electricas] no se pudo extraer texto del PDF', err);
  }
  // Si el nombre no dio año, intentar deducirlo del contenido del PDF.
  if (item.ano == null) {
    const det = detectarAno({ texto: item.textoPdf, filename: item.file.name });
    item.ano = det.ano;
  }
  if (UP.step === 2) renderModal();
}

async function storeReport() {
  const unidadId = UP.serie;
  const body = $('mBody');
  const total = UP.items.length;
  const procHtml = (i) => `<div class="proc"><div class="spin"></div>` +
    `<div class="bigp">Procesando…</div>` +
    `<p class="muted small">Guardando informe ${i} de ${total} de ${esc(UP.serie)}.</p></div>`;
  body.innerHTML = procHtml(1);
  try {
    if (UP.store && isReady()) {
      const uid = (window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid) || null;
      // Materializa el doc de la unidad (docId = serie) antes de los
      // informes: un padre con solo subcolección es "fantasma" en
      // Firestore y NO aparece en la query de suscribirUnidades, así
      // que sin esto la unidad nunca se vería en el parque en vivo.
      await guardarUnidad({ serie: unidadId });
      const ordenados = UP.items.slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
      let i = 0;
      for (const item of ordenados) {
        i += 1;
        body.innerHTML = procHtml(i);
        let pdfMeta = null;
        if (item.file) pdfMeta = await subirPDF(unidadId, item.file);
        // Extrae las 6 mediciones del texto del PDF (pdf.js ya lo dejó
        // en item.textoPdf). La traza _diagnostico ayuda a calibrar las
        // expresiones contra PDFs reales sin adivinar a ciegas.
        const med = extraerMediciones(item.textoPdf || '');
        const { _diagnostico, ...mediciones } = med;
        console.info(`[pruebas-electricas] extracción ${esc(UP.serie)} · ${item.ano || 's/a'} →`,
          _diagnostico.campos.length ? _diagnostico.campos.join(', ') : 'sin datos',
          _diagnostico.traza);
        const informe = sanitizarInforme({
          unidadId, serie: UP.serie, ano: item.ano,
          ...mediciones,
          pdf: pdfMeta
            ? { ...pdfMeta, estado: _diagnostico.campos.length ? 'extraido' : 'pendiente_extraccion' }
            : undefined
        });
        await crearInforme(unidadId, informe, uid);
      }
      body.innerHTML = `<div class="proc"><div class="okc">✓</div>` +
        `<div class="bigp">${total === 1 ? 'Informe almacenado' : `${total} informes almacenados`}</div>` +
        `<p class="muted small">La matriz y las tablas se actualizarán en vivo.</p></div>`;
      setTimeout(closeUpload, 1400);
      toast(total === 1 ? 'Informe almacenado.' : `${total} informes almacenados.`);
    } else {
      body.innerHTML = `<div class="proc"><div class="okc">✓</div>` +
        `<div class="bigp">Modo demostración</div>` +
        `<p class="muted small">Firebase no está activo: los informes no se persistieron. ` +
        `Conecta el backend para almacenar.</p></div>`;
      setTimeout(closeUpload, 1800);
      toast('Sin backend: informes no persistidos.', 'warn');
    }
  } catch (err) {
    console.error('[pruebas-electricas] storeReport', err);
    body.innerHTML = `<div class="proc"><div class="bigp">No se pudo almacenar</div>` +
      `<p class="muted small">${esc(err.message || err)}</p>` +
      `<div class="mfoot"><button class="btn btn-ghost" id="mClose">Cerrar</button></div></div>`;
    const c = $('mClose'); if (c) c.onclick = closeUpload;
    toast('Error al almacenar los informes.', 'warn');
  }
}

// El HTML usa onclick="openUpload()"/"closeUpload()" → exponer en window
window.openUpload = openUpload;
window.closeUpload = closeUpload;

// Configura pdf.js worker si la librería cargó
if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar);
} else {
  arrancar();
}
