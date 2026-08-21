// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · SHELL (entrypoint)
// Boot reactivo:
//   1) inicializa filtros + modal + listeners de botones
//   2) hidrata dataset (baseline JSON + Firestore realtime)
//   3) fija _base y recompute para cada trafo
//   4) suscribe el store y dispara renderAll en cada cambio
//   5) tick clock cada segundo para el indicador "actualizado hace…"
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';
import { inicializarFiltros, pintarSelectores, sincronizarUI } from './filtros.js';
import { inicializarModal } from './modal.js';
import { toggleLive, fijarBase } from './live.js';
import { exportarCSV } from './export.js';
import { suscribirCargabilidad } from '../../data/seguimiento_cargabilidad.js';
import { aplicarFiltros } from '../../domain/cargabilidad_filtros.js';
import { recomputeAll } from '../../domain/cargabilidad_severidad.js';

import { renderKPIs }     from './renderers/kpis.js';
import { renderOverview } from './renderers/overview.js';
import { renderHeatmap }  from './renderers/heatmap.js';
import { renderTabla }    from './renderers/tabla.js';
import { renderModal }    from './renderers/modal-detalle.js';

const $ = (s) => document.querySelector(s);

function safeRender(name, fn) {
  try { fn(); } catch (e) {
    console.error(`[cargabilidad/render:${name}]`, e);
  }
}

function renderAll(state) {
  if (!state.rows.length) return;
  const filtradas = aplicarFiltros(state.rows, state.filtros);
  safeRender('selectores', () => pintarSelectores(state.rows));
  safeRender('sync-ui',    () => sincronizarUI());
  safeRender('kpis',       () => renderKPIs(filtradas));
  safeRender('overview',   () => renderOverview(filtradas));
  safeRender('heatmap',    () => renderHeatmap(filtradas));
  safeRender('tabla',      () => renderTabla(filtradas));
  safeRender('modal',      () => renderModal());
}

function bindBotones() {
  const liveBtn = $('#liveBtn');
  if (liveBtn) liveBtn.addEventListener('click', () => {
    const ahora = toggleLive();
    liveBtn.classList.toggle('live', ahora);
    // G020 (ADR-052 Ola 2): no hay telemetría real conectada; la variación es
    // una SIMULACIÓN. Se etiqueta como tal para no presentar datos fabricados como reales.
    liveBtn.innerHTML = ahora ? '⏸ Simulación activa (datos NO reales)' : '▶ Simular variación';
    const dot = $('#liveDot');
    if (dot) dot.style.background = ahora ? 'var(--ok)' : 'var(--ink3)';
  });

  const exportBtn = $('#exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const n = exportarCSV();
    console.info(`[cargabilidad/export] ${n} filas exportadas`);
  });
}

function tickClock() {
  const now = new Date();
  const clock = $('#clock');
  if (clock) clock.textContent = now.toLocaleTimeString('es-CO');
  const ago = $('#ago');
  if (ago) {
    const sec = Math.round((Date.now() - store.state.lastTs) / 1000);
    ago.textContent = store.state.live ? `SIMULACIÓN · +${sec} s (datos no reales)` : 'datos estáticos (snapshot)';
  }
}

async function boot() {
  inicializarFiltros();
  inicializarModal();
  bindBotones();

  // Render reactivo
  store.on(renderAll);

  // Suscripción a datos (baseline + Firestore realtime)
  let _unsub = null;
  try {
    _unsub = suscribirCargabilidad(({ source, rows, demo, resumen }) => {
      if (!Array.isArray(rows)) return;
      // Importante: mutamos in-place para fijar _base y _i.
      const enriquecidas = fijarBase(rows.slice());
      recomputeAll(enriquecidas);
      store.setRows(enriquecidas, source);
      rotularOrigen({ source, demo, resumen, n: rows.length });
    });
  } catch (e) {
    console.warn('[cargabilidad-shell] no se pudo abrir suscripción:', e);
  }

  /**
   * Rotula de dónde salen los números. La pantalla mostraba tres
   * transformadores inventados sin decirlo en ninguna parte: quien la abría
   * creía estar viendo su parque. Ahora el origen se declara siempre, y si
   * son datos de demostración se dice con todas las letras (ADR-067).
   */
  function rotularOrigen({ source, demo, resumen, n }) {
    const el = document.getElementById('ago');
    if (el) {
      el.textContent = demo
        ? 'DATOS DE DEMOSTRACIÓN — no es su parque'
        : (source === 'parque'
            ? 'parque real · ' + n + ' transformadores'
            : (source === 'firestore' ? 'tiempo real' : 'sin datos'));
    }
    const caja = document.getElementById('avisoOrigen');
    if (!caja) return;
    if (demo) {
      caja.innerHTML = '<div class="aviso aviso--warn"><b>Estos NO son sus transformadores.</b> '
        + 'La pantalla está mostrando ' + n + ' equipos de demostración porque no se pudo leer el '
        + 'parque. Las subestaciones «SUB-DEMO-*» y las matrículas «TD-0*» son ficticias: no tome '
        + 'ninguna decisión con estas cifras.</div>';
      return;
    }
    if (source === 'parque' && resumen) {
      const partes = [];
      if (resumen.sinDatos) {
        partes.push(resumen.sinDatos + ' equipo(s) del parque no traen datos de carga y no aparecen aquí');
      }
      if (resumen.desacuerdosFuente) {
        partes.push('<b>' + resumen.desacuerdosFuente + ' equipo(s) con la fuente en desacuerdo</b>: '
          + 'el % de cargabilidad de la hoja no coincide con sus propias columnas de amperios '
          + '(manda el % oficial; conviene revisar la captura)');
      }
      if (resumen.sobrecargasMedidas) {
        partes.push(resumen.sobrecargasMedidas + ' con la corriente medida por encima de su ampacidad');
      }
      caja.innerHTML = partes.length
        ? '<div class="aviso"><b>' + resumen.conDatos + ' transformadores de su parque.</b> '
          + partes.join(' · ') + '.</div>'
        : '<div class="aviso"><b>' + resumen.conDatos + ' transformadores de su parque.</b></div>';
    }
  }

  // Tick clock
  setInterval(tickClock, 1000);
  tickClock();

  window.addEventListener('beforeunload', () => {
    if (_unsub) try { _unsub(); } catch (_) { /* noop */ }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
