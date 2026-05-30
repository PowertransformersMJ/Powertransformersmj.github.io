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
  guardarUnidad, crearInforme, subirPDF
} from './data/pruebas_electricas.js';
import {
  sanitizarInforme, confirmarSerie, detectarAno
} from './domain/pruebas_electricas_schema.js';
import { extraerMediciones } from './domain/pruebas_electricas_extraccion.js';
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
  UP.serie = (state.unidadActiva && state.unidadActiva.serie) || '';
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
      const maxPag = Math.min(pdf.numPages, 4);
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
