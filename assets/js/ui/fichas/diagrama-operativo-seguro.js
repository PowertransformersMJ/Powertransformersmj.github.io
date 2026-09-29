// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «DIAGRAMA OPERATIVO» · lectura con tiempo límite (`99 §112`, CF-40)
// ──────────────────────────────────────────────────────────────────────────────
// Promesa al Ingeniero (2026-09-28): «un tiempo límite a la lectura, para que
// nunca pueda trabar la página». Leer el Excel ajeno y calcular su dibujo corre
// en un TRABAJADOR (`diagrama-operativo-trabajador.js`, otro hilo): si pasa de
// `TIEMPO_LIMITE`, se termina y se avisa. La página solo pinta el SVG ya hecho.
//
// El trabajador mide los textos con OffscreenCanvas y la MISMA fórmula de letra
// que `medidor()` de `diagrama-operativo-dibujo.js` (la prueba `medidorFuera ≡
// medidor` vigila que no se separen); con las fuentes del sistema (Arial,
// Calibri…) las medidas son idénticas a las de la página (verificado en Chrome:
// el cronograma real da el mismo PNG, byte a byte). Con una fuente que la página
// carga de la web (Inter…) el trabajador mide con la fuente con que el SVG de
// verdad se pinta (un <img> no usa fuentes web): mide MEJOR que la página.
// También dentro del tiempo límite se mide el PESO del SVG (`revisarPesoSvg`):
// lo único que queda en la página, pintarlo, está acotado.
// Respaldo: si el trabajador no ARRANCA (navegador sin trabajadores de módulo, o
// sin conexión para cargar JSZip), se lee en la página como antes —eso no
// depende del archivo, que aún no se le dio—; si no tiene OffscreenCanvas, el
// dibujo se calcula en la página (`dibujo: null`). Nunca se cae al respaldo por
// TIEMPO: un archivo que trabó al trabajador trabaría la página.
// ══════════════════════════════════════════════════════════════════════════════

import { leerHojaAdjunta, hojasDelLibro } from './diagrama-operativo-lector.js';
import { planoHomologado, svgDeHoja } from './diagrama-operativo-dibujo.js';

/** Tiempo máximo para leer y dibujar un Excel adjunto (ms). */
export const TIEMPO_LIMITE = 20000;
/** Tiempo máximo para que el trabajador arranque, JSZip incluido (ms); si no, se lee en la página. */
const CARGA_LIMITE = 60000;
/**
 * Peso del SVG que se deja pintar en la página, medido contra el costo real (revisión CF-40): cada
 * elemento ≈ 3 µs y cada carácter de texto ≈ 0,1 µs ⇒ el peor caso admitido pinta en ~1 s. Los datos
 * de las imágenes no cuentan (el navegador decodifica cada una una vez).
 */
export const PESO_SVG = Object.freeze({ elementos: 400000, texto: 2000000, marcas: 40 * 1024 * 1024 });
/** Marca de los mensajes entre la página y el trabajador. */
const MARCA = 'sgm-diagrama-operativo';

export const MENSAJE_TIEMPO = 'El Excel tardó más de ' + (TIEMPO_LIMITE / 1000) + ' segundos en leerse y se detuvo para no trabar la página. '
  + 'Puede estar dañado o ser demasiado complejo: ábralo y vuelva a guardarlo en Excel, defina un área de impresión solo con el cronograma, o adjunte una imagen.';

/* ── medidor de texto del trabajador (misma fórmula que `medidor()` de dibujo.js) ── */
const PX_PT = 96 / 72;
const n2 = (v) => Math.round(v * 100) / 100;
const fuenteCss = (nombre) => (/^[A-Za-z0-9 ._-]{1,40}$/.test(String(nombre || '')) ? "'" + nombre + "', " : '') + 'Arial, Helvetica, sans-serif';
/** Medidor con OffscreenCanvas (hilo del trabajador), o null si no hay. */
export function medidorFuera() {
  if (typeof OffscreenCanvas === 'undefined') return null;
  let cx = null;
  try { cx = new OffscreenCanvas(1, 1).getContext('2d'); } catch (_) { cx = null; }
  if (!cx || typeof cx.measureText !== 'function') return null;
  return (texto, f) => { cx.font = (f.i ? 'italic ' : '') + (f.b ? 'bold ' : '') + n2(f.sz * PX_PT) + 'px ' + fuenteCss(f.nombre); return cx.measureText(texto).width; };
}

/**
 * El SVG no puede ser tan pesado que pintarlo trabe la página: se cuentan sus
 * elementos y su texto (las imágenes no: el navegador decodifica cada una una vez).
 */
export function revisarPesoSvg(svg) {
  const s = String(svg); let datos = 0; let elementos = 0; let texto = 0;
  for (const m of s.matchAll(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]*/g)) datos += m[0].length;
  // Una pasada: cada «<» es un elemento; lo que va de un «>» al siguiente «<» es texto.
  for (let i = s.indexOf('<'); i !== -1;) {
    elementos++;
    const j = s.indexOf('>', i + 1); if (j === -1) break;
    const k = s.indexOf('<', j + 1); texto += (k === -1 ? s.length : k) - j - 1; i = k;
  }
  if (elementos > PESO_SVG.elementos || texto > PESO_SVG.texto || s.length - datos > PESO_SVG.marcas) {
    throw new Error('La hoja es demasiado pesada para dibujarla. Defina un área de impresión solo con el cronograma.');
  }
}

/**
 * El trabajo en sí (lo corre el trabajador; en el respaldo, la página).
 * @param {{tipo:'leer'|'hojas', bytes:Uint8Array, hoja?:string, caja?:{w:number,h:number}}} orden
 * @param {{enPagina?: boolean}} [op]  enPagina: no calcular el dibujo (lo hace la página como antes)
 * @returns {Promise<{hojas:Array}|{modelo:object, dibujo:({svg:string,w:number,h:number,plano:object}|null)}>}
 */
export async function trabajo(orden, op = {}) {
  if (orden.tipo === 'hojas') return { hojas: await hojasDelLibro(orden.bytes) };
  const modelo = await leerHojaAdjunta(orden.bytes, orden.hoja ? { hoja: orden.hoja } : {});
  const medir = op.enPagina ? null : medidorFuera();
  if (!medir) return { modelo, dibujo: null };
  const plano = planoHomologado(modelo, orden.caja, medir);
  const { svg, w, h } = svgDeHoja(modelo, plano, medir);
  revisarPesoSvg(svg);
  return { modelo, dibujo: { svg, w, h, plano } };
}

/**
 * Lee (o lista las hojas de) un Excel adjunto en un trabajador con tiempo límite.
 * @param {object} orden  ver `trabajo`
 * @param {{limite?: number, cargaLimite?: number, senal?: AbortSignal, Worker?: Function}} [op]
 *   senal: cancela (la pestaña se cerró o se eligió otro archivo) · Worker: para las pruebas
 * Rechaza con `tiempo: true` si se agotó el tiempo y con `cancelado: true` si se canceló.
 */
export function leerEnTrabajador(orden, op = {}) {
  const limite = op.limite || TIEMPO_LIMITE;
  const Crear = op.Worker || (typeof Worker !== 'undefined' ? Worker : null);
  const respaldo = () => trabajo(orden, { enPagina: true });
  const cancelado = () => { const x = new Error('Lectura cancelada.'); x.cancelado = true; return x; };
  if (op.senal && op.senal.aborted) return Promise.reject(cancelado());
  let w = null;
  try { if (Crear) w = new Crear(new URL('./diagrama-operativo-trabajador.js', import.meta.url), { type: 'module' }); } catch (_) { w = null; }
  if (!w) return respaldo();
  return new Promise((ok, mal) => {
    let listo = false; let enviada = false; let fin = false; let tTrabajo = null;
    const alCancelar = () => { if (!fin) { cerrar(); mal(cancelado()); } };
    const cerrar = () => {
      fin = true; clearTimeout(tCarga); clearTimeout(tTrabajo);
      if (op.senal) op.senal.removeEventListener('abort', alCancelar);
      try { w.terminate(); } catch (_) { /* ya estaba */ }
    };
    if (op.senal) op.senal.addEventListener('abort', alCancelar);
    // Si ni siquiera arrancó (navegador sin trabajadores de módulo, JSZip sin conexión), se lee en la página.
    const noArranco = () => { cerrar(); if (op.senal && op.senal.aborted) mal(cancelado()); else respaldo().then(ok, mal); };
    const tCarga = setTimeout(() => { if (!listo && !fin) noArranco(); }, op.cargaLimite || CARGA_LIMITE);
    w.onmessage = (e) => {
      if (fin) return;
      const d = (e && e.data) || {};
      if (d.marca !== MARCA) return;   // mensajes ajenos: se ignoran
      if (d.tipo === 'listo') {
        if (listo) return;
        listo = true; clearTimeout(tCarga);
        tTrabajo = setTimeout(() => { if (!fin) { cerrar(); const x = new Error(MENSAJE_TIEMPO); x.tiempo = true; mal(x); } }, limite);
        enviada = true; w.postMessage(orden);
        return;
      }
      if (d.tipo === 'noArranco' && !listo) { noArranco(); return; }
      if (!enviada) return;   // una respuesta sin orden no vale
      cerrar();
      if (d.tipo === 'resultado') ok(d.r); else mal(new Error(d.mensaje || 'No se pudo leer el Excel.'));
    };
    w.onerror = (e) => {
      if (fin) return;
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (!listo) { noArranco(); return; }
      cerrar(); mal(new Error('No se pudo leer el Excel (' + ((e && e.message) || 'error del lector') + ').'));
    };
    w.onmessageerror = () => { if (!fin) { cerrar(); mal(new Error('No se pudo leer el Excel (respuesta ilegible).')); } };
  });
}

/** Los mensajes del trabajador (el trabajador los arma con esto). */
export const mensaje = (tipo, extra = {}) => ({ marca: MARCA, tipo, ...extra });

/**
 * Rasteriza en la página el SVG que calculó el trabajador. Es la MISMA cuenta de
 * `dibujarHojaAdjunta` (resolución 2-4×, techo de 12 Mpx, fondo blanco).
 * @returns {Promise<{png:Uint8Array, ancho:number, alto:number}>}
 */
export async function rasterizarSvg(svg, w, h, s) {
  if (typeof document === 'undefined') throw new Error('El dibujo del Excel adjunto solo se hace en el navegador.');
  const ancho = Math.round(w * s); const alto = Math.round(h * s);
  let k = Math.min(4, Math.max(2, 2 / s));
  while (ancho * k * alto * k > 12e6 && k > 1) k -= 0.25;
  const cw = Math.round(ancho * k); const ch = Math.round(alto * k);
  const png = await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg.replace('<svg ', '<svg width="' + n2(w) + '" height="' + n2(h) + '" ')], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const cx = c.getContext('2d'); cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, cw, ch);
        cx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        c.toBlob((b) => { if (!b) { reject(new Error('No se pudo dibujar la hoja.')); return; } b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)), reject); }, 'image/png');
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo dibujar la hoja (formato no reconocido).')); };
    img.src = url;
  });
  return { png, ancho, alto };
}
