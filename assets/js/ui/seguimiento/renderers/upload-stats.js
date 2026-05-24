// ══════════════════════════════════════════════════════════════
// Renderer · Estadísticas del módulo de carga + historial
// ══════════════════════════════════════════════════════════════

import { store } from '../state.js';

const $ = (sel) => document.querySelector(sel);

export function renderUploadStats() {
  const { seed, extra, allEvents, loadedFiles } = store.state;
  const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
  set('stat-seed',  seed.events.length.toLocaleString());
  set('stat-added', extra.length.toLocaleString());
  set('stat-total', allEvents.length.toLocaleString());
  set('stat-files', loadedFiles.length);
}

export function renderHistory() {
  const c = $('#history-list');
  if (!c) return;
  const { loadedFiles } = store.state;
  if (loadedFiles.length === 0) {
    c.innerHTML = '';
    return;
  }
  c.innerHTML = `<div class="small" style="margin:8px 0 4px;color:var(--slate-600);font-weight:600">Historial de cargas (${loadedFiles.length})</div>`
    + loadedFiles.slice().reverse().slice(0, 8).map(f => `
      <div class="history-item">
        <div>
          <div class="name">📄 ${f.name}</div>
          <div class="info">${f.ts} · ${(f.size / 1024 / 1024).toFixed(2)} MB · agregados ${f.added.toLocaleString()} · duplicados ${f.dup.toLocaleString()}</div>
        </div>
      </div>`).join('');
}
