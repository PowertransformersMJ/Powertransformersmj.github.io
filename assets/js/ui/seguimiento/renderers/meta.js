// ══════════════════════════════════════════════════════════════
// Renderer · Meta del SEED + storage pill + status badge
// ══════════════════════════════════════════════════════════════

import { aggKPIs } from '../../../domain/scada_violaciones.js';
import { scopedEvents, store } from '../state.js';

const $ = (sel) => document.querySelector(sel);

export function renderMeta() {
  const { seed, extra, allEvents } = store.state;
  const m = seed.meta;
  const extraCount = extra.length;

  const subtitle = $('#subtitle');
  if (subtitle) {
    if (m) {
      subtitle.textContent =
        `Dataset base · ${m.report_date_min} → ${m.report_date_max} · ${seed.events.length.toLocaleString()} eventos`
        + (extraCount ? ` · +${extraCount.toLocaleString()} acumulados` : '');
    } else {
      subtitle.textContent =
        `${seed.events.length.toLocaleString()} eventos · `
        + (extraCount ? `+${extraCount.toLocaleString()} acumulados` : 'sin acumulado');
    }
  }

  const k = aggKPIs(scopedEvents());
  const info = $('#meta-info');
  if (info) info.innerHTML = `Activos en dashboard: ${k.total.toLocaleString()} eventos · ${k.viol.toLocaleString()} violaciones`;

  const dates = new Set(allEvents.map(e => e.date));
  const range = dates.size === 1
    ? [...dates][0]
    : `${[...dates].sort()[0]} → ${[...dates].sort().slice(-1)[0]} (${dates.size} días)`;
  const p1 = $('#top10-period-pill'); if (p1) p1.textContent = range;
  const p2 = $('#trend-pill');         if (p2) p2.textContent = range;
}

export function renderStoragePill() {
  const pill = $('#storage-pill');
  if (!pill) return;
  const mode = store.state.persistMode;
  if (mode === 'indexeddb') {
    pill.textContent = 'guardado: IndexedDB';
    pill.className = 'pill green';
  } else if (mode === 'localstorage') {
    pill.textContent = 'guardado: localStorage (límite 5MB)';
    pill.className = 'pill';
  } else if (mode === 'none') {
    pill.textContent = 'SIN guardado persistente';
    pill.className = 'pill red';
  } else {
    pill.textContent = 'detectando almacenamiento…';
    pill.className = 'pill';
  }
}
