// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad · MODAL DETALLE
// Orquesta open/close · cambia ventana 24h/7d/30d · ESC para cerrar.
// El contenido del modal lo renderea renderers/modal-detalle.js.
// ══════════════════════════════════════════════════════════════

import { store } from './state.js';

let _bound = false;

export function inicializarModal() {
  if (_bound) return;
  _bound = true;

  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target.id === 'overlay') store.closeDetail();
    });
  }
  const close = document.getElementById('modalClose');
  if (close) close.addEventListener('click', () => store.closeDetail());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') store.closeDetail();
  });
}

// Helpers globales para `onclick="openDetail(N)"` en HTML inline
// (mantiene la API expuesta por el archivo legacy). Se llaman desde
// los renderers que generan HTML con event-handlers inline.
export function openDetail(i) { store.setDetail(i); }
export function setWin(w)    { store.setDetailWin(w); }
export function closeDetail(){ store.closeDetail(); }
