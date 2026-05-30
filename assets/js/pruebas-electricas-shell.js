// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Shell / Controlador
// ──────────────────────────────────────────────────────────────
// Entrypoint de la página pages/pruebas-electricas.html. Orquesta:
//   · data layer en vivo (onSnapshot · SEED_LOCAL sin backend)
//   · componentes UI (semáforo, tablas, gráficas)
//   · ficha de identidad y KPIs del parque
//   · modal de carga de informe (serie → PDF → confirmar)
//
// NO contiene reglas de negocio: la calificación normativa vive en
// el dominio (pruebas_electricas_semaforo.js) y la presentación en
// los componentes de assets/js/ui/pruebas/. Aquí solo se conecta el
// flujo de datos con el DOM.
//
// Nota sobre gráficas: el schema del informe persiste el valor
// sintetizado por prueba (no el detalle por fase del PDF), de modo
// que las 6 gráficas usan los datasets de referencia del tablero
// (mountCharts sin serie → DEF) para conservar EXACTAMENTE el
// aspecto original. La matriz, tablas e historial sí se derivan de
// los informes en vivo.
// ══════════════════════════════════════════════════════════════

import {
  SEED_LOCAL, isReady,
  suscribirUnidades, suscribirInformes,
  crearInforme, subirPDF
} from './data/pruebas_electricas.js';
import {
  sanitizarInforme, confirmarSerie
} from './domain/pruebas_electricas_schema.js';
import { renderMatriz, estadoVigente } from './ui/pruebas/semaforo.js';
import { renderInformes, mountTablas } from './ui/pruebas/tabla-pruebas.js';
import { mountCharts } from './ui/pruebas/grafico-svg.js';

/* ─── Estado de la vista ──────────────────────────────────────── */
const state = {
  unidades: [],
  unidadActiva: null,
  informes: [],
  unsubInformes: null
};

const $ = (id) => document.getElementById(id);

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

function renderParqueGrid(unidades) {
  const grid = $('parque-grid');
  if (!grid) return;
  const tile = `<button type="button" class="addtile" onclick="openUpload()">` +
    `<span class="pl">＋</span><span>Cargar informe</span></button>`;
  const cards = unidades.map((u) => {
    const d = [u.fabricante, u.potencia, u.tensiones].filter(Boolean).join(' · ');
    const loc = [u.ubicacion, u.cliente].filter(Boolean).join(' · ');
    return `<div class="ucard">` +
      `<div class="ser">${esc(u.serie || u.id)}</div>` +
      `<div class="d">${esc(d)}${loc ? '<br>' + esc(loc) : ''}</div>` +
      `<a class="det" href="#identidad">Ver identidad →</a></div>`;
  }).join('');
  grid.innerHTML = cards + tile;
}

function refrescarKpisParque() {
  if ($('kpi-unidades')) $('kpi-unidades').textContent = String(state.unidades.length || 0);
  const subs = new Set(state.unidades.map((u) => u.subestacion).filter(Boolean));
  if ($('kpi-subestaciones')) $('kpi-subestaciones').textContent = String(subs.size || 0);
}

/* ─── Render de los informes de la unidad activa ──────────────── */

function renderInformesUI(informes) {
  state.informes = informes || [];
  const u = state.unidadActiva || {};

  // Matriz de calificación (semáforo)
  renderMatriz($('matrix'), state.informes);

  // Tablas de detalle por prueba
  mountTablas(state.informes, document);

  // Gráficas (datasets de referencia del tablero · ver nota de cabecera)
  mountCharts(null, document);

  // Historial + KPI de conteo
  renderInformes($('reportlist'), state.informes, {
    serieUnidad: u.serie,
    kpiEl: $('kpi-informes')
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
    (informes) => renderInformesUI(informes),
    (err) => {
      console.warn('[pruebas-electricas] informes', err);
      renderInformesUI([]);
    }
  );
}

function seleccionarUnidad(u) {
  state.unidadActiva = u;
  renderIdentidad(u);
  escucharInformes(u ? (u.id || u.serie) : null);
}

/* ─── Arranque ────────────────────────────────────────────────── */

function arrancar() {
  suscribirUnidades(
    (unidades) => {
      state.unidades = unidades || [];
      renderParqueGrid(state.unidades);
      refrescarKpisParque();
      // Selecciona la primera unidad (o re-selecciona la activa si sigue presente)
      const actual = state.unidadActiva &&
        state.unidades.find((u) => (u.id || u.serie) === (state.unidadActiva.id || state.unidadActiva.serie));
      seleccionarUnidad(actual || state.unidades[0] || null);
    },
    (err) => {
      console.warn('[pruebas-electricas] unidades', err);
      state.unidades = [{ id: SEED_LOCAL.unidad.serie, ...SEED_LOCAL.unidad }];
      renderParqueGrid(state.unidades);
      refrescarKpisParque();
      seleccionarUnidad(state.unidades[0]);
    }
  );
}

/* ══════════════════════════════════════════════════════════════
   Modal de carga de informe (serie → PDF → confirmar)
   ══════════════════════════════════════════════════════════════ */

const UP = { step: 1, serie: '', ano: null, file: null, textoPdf: '', store: true };

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
  UP.serie = (state.unidadActiva && state.unidadActiva.serie) || '';
  UP.ano = null; UP.file = null; UP.textoPdf = '';
  const ov = $('ov');
  if (ov) ov.classList.add('on');
  renderModal();
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
    if (title) title.textContent = 'Cargar informe · datos';
    body.innerHTML =
      `<div class="flbl">Número de serie de la unidad</div>` +
      `<input class="inp" id="serIn" value="${esc(UP.serie)}" placeholder="173523-15510">` +
      `<div class="flbl" style="margin-top:14px">Año del informe</div>` +
      `<input class="inp" id="anoIn" type="number" min="1950" max="2100" value="${UP.ano || ''}" placeholder="2024">` +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mCancel">Cancelar</button>` +
      `<button class="btn btn-primary" id="mNext1">Continuar</button></div>`;
    $('mCancel').onclick = closeUpload;
    $('mNext1').onclick = () => {
      UP.serie = $('serIn').value.trim();
      UP.ano = parseInt($('anoIn').value, 10) || null;
      if (!UP.serie) return toast('Ingresa el número de serie.', 'warn');
      if (!UP.ano) return toast('Ingresa el año del informe.', 'warn');
      UP.step = 2; renderModal();
    };
  } else if (UP.step === 2) {
    if (title) title.textContent = 'Cargar informe · PDF';
    body.innerHTML =
      `<div class="drop" id="drop">Arrastra el PDF aquí o haz clic para elegirlo</div>` +
      `<input type="file" id="fileIn" accept="application/pdf" style="display:none">` +
      (UP.file ? `<div class="picked">📄 ${esc(UP.file.name)}</div>` : '') +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mBack2">Atrás</button>` +
      `<button class="btn btn-primary" id="mNext2"${UP.file ? '' : ' disabled'}>Continuar</button></div>`;
    const drop = $('drop'); const fileIn = $('fileIn');
    drop.onclick = () => fileIn.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('drag'); };
    drop.ondragleave = () => drop.classList.remove('drag');
    drop.ondrop = (e) => {
      e.preventDefault(); drop.classList.remove('drag');
      if (e.dataTransfer.files[0]) elegirArchivo(e.dataTransfer.files[0]);
    };
    fileIn.onchange = () => { if (fileIn.files[0]) elegirArchivo(fileIn.files[0]); };
    $('mBack2').onclick = () => { UP.step = 1; renderModal(); };
    $('mNext2').onclick = () => { if (UP.file) { UP.step = 3; renderModal(); } };
  } else {
    if (title) title.textContent = 'Cargar informe · confirmar';
    const chk = confirmarSerie(UP.serie, UP.textoPdf);
    const verdict = !UP.textoPdf
      ? `<div class="verdict wn"><span>⚠</span><span>No se pudo leer el texto del PDF; verifica manualmente la serie.</span></div>`
      : chk.coincide
        ? `<div class="verdict gd"><span>✓</span><span>La serie <b>${esc(UP.serie)}</b> coincide con la impresa en el PDF.</span></div>`
        : `<div class="verdict bd"><span>✕</span><span>La serie <b>${esc(UP.serie)}</b> NO se encontró en el PDF. Revisa antes de almacenar.</span></div>`;
    body.innerHTML =
      `<div class="cmp">` +
      `<div class="cbox"><div class="ch">Serie ingresada</div><div class="cv">${esc(UP.serie)}</div></div>` +
      `<div class="cbox"><div class="ch">Año</div><div class="cv">${esc(UP.ano)}</div></div></div>` +
      verdict +
      `<label class="chk"><input type="checkbox" id="store" ${UP.store ? 'checked' : ''}>` +
      `<span>Almacenar el informe y su PDF original (si Firebase está activo).</span></label>` +
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

async function elegirArchivo(file) {
  UP.file = file;
  UP.textoPdf = '';
  renderModal();
  // Extracción de texto con pdf.js (si está disponible) para confirmar serie
  try {
    const pdfjs = window.pdfjsLib;
    if (pdfjs && file.type === 'application/pdf') {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let texto = '';
      const maxPag = Math.min(pdf.numPages, 4);
      for (let i = 1; i <= maxPag; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        texto += ' ' + tc.items.map((it) => it.str).join(' ');
      }
      UP.textoPdf = texto;
    }
  } catch (err) {
    console.warn('[pruebas-electricas] no se pudo extraer texto del PDF', err);
  }
}

async function storeReport() {
  const unidadId = UP.serie;
  const body = $('mBody');
  body.innerHTML = `<div class="proc"><div class="spin"></div>` +
    `<div class="bigp">Procesando…</div>` +
    `<p class="muted small">Guardando informe ${esc(UP.ano)} de ${esc(UP.serie)}.</p></div>`;
  try {
    if (UP.store && isReady()) {
      let pdfMeta = null;
      if (UP.file) pdfMeta = await subirPDF(unidadId, UP.file);
      const informe = sanitizarInforme({
        unidadId, serie: UP.serie, ano: UP.ano,
        pdf: pdfMeta ? { ...pdfMeta, estado: 'pendiente_extraccion' } : undefined
      });
      const uid = (window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid) || null;
      await crearInforme(unidadId, informe, uid);
      body.innerHTML = `<div class="proc"><div class="okc">✓</div>` +
        `<div class="bigp">Informe almacenado</div>` +
        `<p class="muted small">La matriz y las tablas se actualizarán en vivo.</p></div>`;
      setTimeout(closeUpload, 1400);
      toast(`Informe ${UP.ano} almacenado.`);
    } else {
      body.innerHTML = `<div class="proc"><div class="okc">✓</div>` +
        `<div class="bigp">Modo demostración</div>` +
        `<p class="muted small">Firebase no está activo: el informe no se persistió. ` +
        `Conecta el backend para almacenar.</p></div>`;
      setTimeout(closeUpload, 1800);
      toast('Sin backend: informe no persistido.', 'warn');
    }
  } catch (err) {
    console.error('[pruebas-electricas] storeReport', err);
    body.innerHTML = `<div class="proc"><div class="bigp">No se pudo almacenar</div>` +
      `<p class="muted small">${esc(err.message || err)}</p>` +
      `<div class="mfoot"><button class="btn btn-ghost" id="mClose">Cerrar</button></div></div>`;
    const c = $('mClose'); if (c) c.onclick = closeUpload;
    toast('Error al almacenar el informe.', 'warn');
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
