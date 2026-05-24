// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Seguimiento Operativo · UPLOAD HANDLERS
// ──────────────────────────────────────────────────────────────
// Carga acumulativa de archivos SOE diarios. Soporta:
//   · .xlsb / .xlsx / .xls (SOE original ABB)
//   · .csv  (export del backend)
//   · .jsonl / .json (export del backend)
//
// Deduplicación: si un event_id ya está en SEED o en el extra
// acumulado, se descarta. Persistencia: IndexedDB con fallback
// localStorage (módulo data/seguimiento_scada_storage.js).
// ══════════════════════════════════════════════════════════════

import { parseOneFile } from '../../data/seguimiento_scada_excel.js';
import { persistSave, persistMode } from '../../data/seguimiento_scada_storage.js';
import { store } from './state.js';

const $ = (sel) => document.querySelector(sel);

// ── Log (consola visual de ingesta) ──────────────────────────
export function log(level, msg) {
  const out = $('#upload-log');
  if (!out) return;
  out.classList.add('show');
  const line = document.createElement('div');
  if (level === 'err')  line.className = 'err';
  if (level === 'warn') line.className = 'warn';
  if (level === 'info') line.className = 'info';
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${msg}`;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
export function toast(msg, kind = 'success') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

// ── handleFiles: parsea y acumula ────────────────────────────
export async function handleFiles(fileList) {
  const chk = $('#chk-soe-filter');
  const applyFilter = chk ? chk.checked : true;
  let totalAdded = 0;
  let totalSkipped = 0;

  const { seed, extra } = store.state;
  const existingIds = new Set();
  for (const e of seed.events) existingIds.add(e.id);
  for (const e of extra)       existingIds.add(e.id);

  for (const file of fileList) {
    log('info', `Procesando ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)…`);
    try {
      const parsed = await parseOneFile(file, applyFilter, log);
      if (!parsed.events.length) {
        log('warn', `${file.name}: 0 eventos válidos (filtro ${applyFilter ? 'ON' : 'OFF'})`);
        continue;
      }
      let added = 0, dup = 0;
      const acumulados = [];
      for (const ev of parsed.events) {
        if (existingIds.has(ev.id)) { dup++; continue; }
        acumulados.push(ev);
        existingIds.add(ev.id);
        added++;
      }
      totalAdded   += added;
      totalSkipped += dup;
      const droppedNote = parsed.droppedByA ? ` · descartadas por col.A con marca ${parsed.droppedByA.toLocaleString()}` : '';
      log('info', `  → escaneadas ${parsed.scanned.toLocaleString()} filas · válidas ${parsed.filtered.toLocaleString()} · nuevas ${added.toLocaleString()} · duplicadas ${dup.toLocaleString()}${droppedNote}`);
      store.agregarEventos(acumulados, {
        name: file.name, size: file.size,
        added, dup, scanned: parsed.scanned,
        ts: new Date().toISOString().slice(0, 19),
      });
    } catch (e) {
      log('err', `${file.name}: ${e.message}`);
    }
  }

  if (totalAdded > 0) {
    const { extra: nuevosExtra, loadedFiles } = store.state;
    const ok = await persistSave(nuevosExtra, loadedFiles);
    if (ok) {
      const dest = persistMode() === 'indexeddb' ? 'IndexedDB' : 'localStorage';
      toast(`✓ ${totalAdded.toLocaleString()} eventos guardados en ${dest} · ${totalSkipped.toLocaleString()} duplicados omitidos`, 'success');
    } else {
      toast('⚠ No se pudo guardar la información de forma persistente', 'error');
    }
  } else if (totalSkipped > 0) {
    toast(`Todos los eventos eran duplicados (${totalSkipped.toLocaleString()})`, 'error');
  } else {
    toast('No se encontraron eventos válidos', 'error');
  }
}
