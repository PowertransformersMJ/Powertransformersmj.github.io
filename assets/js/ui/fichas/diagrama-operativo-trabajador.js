// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «DIAGRAMA OPERATIVO» · trabajador (`99 §112`, CF-40)
// ──────────────────────────────────────────────────────────────────────────────
// Hilo aparte (Worker de módulo) que lee el Excel adjunto y calcula su dibujo.
// La página lo termina si pasa del tiempo límite (`diagrama-operativo-seguro.js`):
// un archivo hostil puede ocuparlo, nunca trabar la página. Avisa `listo` al
// arrancar —con JSZip YA descargado, para que el tiempo límite mida solo la
// lectura y una red lenta no se culpe al archivo (revisión CF-40)— y así la
// página distingue «no arrancó» (respaldo) de «se demoró».
// ══════════════════════════════════════════════════════════════════════════════

import { trabajo, mensaje } from './diagrama-operativo-seguro.js';
import { cargarJSZip } from './vista-previa-excel.js';

self.onmessage = async (e) => {
  try {
    self.postMessage(mensaje('resultado', { r: await trabajo(e.data) }));
  } catch (err) {
    self.postMessage(mensaje('error', { mensaje: (err && err.message) || String(err) }));
  }
};
cargarJSZip().then(() => self.postMessage(mensaje('listo')), () => self.postMessage(mensaje('noArranco')));
