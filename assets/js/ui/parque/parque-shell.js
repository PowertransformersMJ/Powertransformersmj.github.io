// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Shell del dashboard Parque de Transformadores
// ──────────────────────────────────────────────────────────────
// Orquesta el boot: arranca la suscripción a Firestore (con
// fallback al baseline local), conecta el store a los renderers,
// engancha los listeners de upload Excel y exportación, y monta
// el modal de ficha.
//
// Punto de entrada — se carga desde pages/parque-transformadores.html
// como `<script type="module">`.
// ══════════════════════════════════════════════════════════════

import { store, filasFiltradas } from './state.js';
import { inicializarFiltros } from './filtros.js';
import { bindModalEvents } from './modal-ficha.js';
import { renderKPIs } from './renderers/kpis.js';
import { renderZones } from './renderers/zonas.js';
import { renderDonut } from './renderers/donut.js';
import { renderRadar } from './renderers/radar.js';
import { renderBars } from './renderers/bars.js';
import { renderMatrix, renderMVA } from './renderers/mva.js';
import { renderTabla } from './renderers/tabla.js';
import { renderListado } from './renderers/listado.js';
import { renderCriterios } from './renderers/criterios.js';
import { suscribirParqueSalud } from '../../data/parque_salud.js';
import { leerExcel } from '../../data/parque_salud_excel.js';
import { exportXlsx } from './export.js';

const $ = (sel) => document.querySelector(sel);

// ── Banner de fuente (sin modificar valores) ──────────────────
function mostrarBanner(src, extra) {
  const banner = $('#demoBanner');
  if (!banner) return;
  banner.classList.remove('on');
  banner.removeAttribute('style');

  if (src === 'empty') {
    banner.classList.add('on');
    banner.innerHTML = '<span class="dot"></span> Sin datos disponibles · cargue un Excel o publique transformadores en Firestore.';
  } else if (src === 'upload') {
    banner.classList.add('on');
    banner.style.borderColor = 'rgba(0,122,255,.4)';
    banner.style.background = 'rgba(0,122,255,.08)';
    banner.style.color = 'var(--accent)';
    banner.innerHTML = '<span class="dot" style="background:var(--accent)"></span> Fuente: archivo cargado <span style="color:var(--ink)">' + (extra || 'Excel') + '</span> · ' + store.state.rows.length + ' activos · valores sin modificar.';
  } else if (src === 'baseline') {
    banner.classList.add('on');
    banner.style.borderColor = 'rgba(28,200,112,.4)';
    banner.style.background = 'rgba(28,200,112,.08)';
    banner.style.color = 'var(--h1)';
    banner.innerHTML = '<span class="dot" style="background:var(--h1)"></span> Fuente: extracto fiel de <span style="color:var(--ink)">Salud de Activos 2026.xlsx</span> · ' + store.state.rows.length + ' activos · valores sin modificar.';
  }
  // src === 'firestore' → sin banner (estado normal de producción)
}

// ── Render orquestado (todos los visualizadores) ──────────────
function renderAll() {
  const rows = filasFiltradas();
  renderKPIs(rows);
  renderZones();
  renderDonut(rows);
  renderRadar(rows);
  renderMVA(rows);
  renderBars(rows);
  renderMatrix(rows);
  renderTabla();
  renderListado(rows);
}

// ── Listeners del módulo de carga Excel ──────────────────────
function bindExcelUpload() {
  const drop = $('#upDrop');
  const fileInput = $('#fileXlsx');
  const status = $('#upStatus');
  if (!drop || !fileInput) return;

  async function handle(file) {
    if (!status) return;
    status.className = 'up-status';
    status.textContent = 'Leyendo ' + file.name + '…';
    try {
      const { rows, found, fileName } = await leerExcel(file);
      store.setRows(rows, 'upload', fileName);
      status.className = 'up-status ok';
      status.textContent = '✓ ' + rows.length + ' activos cargados de ' + fileName + ' — ' + found.join(' · ') + '. Dashboard actualizado.';
    } catch (e) {
      console.error(e);
      status.className = 'up-status err';
      status.textContent = 'Error al leer el archivo: ' + e.message;
    }
  }

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) handle(f);
  });
  ['dragenter', 'dragover'].forEach(ev =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); })
  );
  ['dragleave', 'drop'].forEach(ev =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); })
  );
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) handle(f);
  });

  const btnDownload = $('#btnDownload');
  if (btnDownload) btnDownload.addEventListener('click', exportXlsx);
}

// ══════════════════════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════════════════════
function boot() {
  renderCriterios();   // catálogo MO.00418 — no depende del dataset
  inicializarFiltros();
  bindModalEvents();
  bindExcelUpload();

  // Render cada vez que el store cambia
  store.on((state) => {
    mostrarBanner(state.src, state.extra);
    renderAll();
  });

  // Suscripción al dataset (Firestore con fallback baseline)
  let _unsub = null;
  _unsub = suscribirParqueSalud((rows, src) => {
    // Si el upload Excel ya estableció rows, no sobrescribir con
    // baseline. Solo Firestore (que es la fuente "oficial") puede
    // ganarle al upload.
    if (store.state.src === 'upload' && src !== 'firestore') return;
    store.setRows(rows, src);
  }, (err) => {
    console.warn('[parque-shell] error en suscripción:', err);
  });

  window.addEventListener('beforeunload', () => {
    if (_unsub) try { _unsub(); } catch (_) { /* noop */ }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
