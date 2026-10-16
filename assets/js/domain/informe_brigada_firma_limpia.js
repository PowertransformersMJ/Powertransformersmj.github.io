// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · FIRMA LIMPIA (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// La firma de un tercero llega como foto o JPG con fondo blanco. Subida tal cual,
// la hoja emitida muestra un recuadro gris (L-145, `99 §163.12`). Aquí va la MISMA
// matemática con que Fichas normaliza las firmas del equipo
// (`ui/fichas/firmas-equipo.js`, normalizarImagen): el fondo claro se vuelve
// transparente, se recorta al trazo con un margen y NUNCA se amplía (§99.11:
// firmas limpias). Fichas no se toca; este archivo replica sus números y una
// prueba los compara.
// En un archivo PROPIO a propósito (L-102): una exportación nueva dentro de un
// módulo que el navegador ya tenía guardado puede cruzarse con su copia vieja.
// ══════════════════════════════════════════════════════════════════════════════

import { tamanoFirma } from './firmas_tamano.js';

/** Números de Fichas (firmas-equipo.js:14-17 y 37-61). */
export const FIRMA_LIMPIA = Object.freeze({
  claro: 235,          // luminancia desde la que el píxel es fondo (alfa 0)
  oscuro: 120,         // luminancia hasta la que el píxel es trazo pleno (alfa 255)
  alfaTrazo: 40,       // alfa desde el que un píxel cuenta para el recorte
  margen: 0.03,        // margen del recorte: 3 % del lado mayor del trazo…
  margenPx: 2,         // …más 2 px
  anchoTrabajo: 2400,  // la imagen se trabaja a lo sumo a este ancho
  anchoMax: 1200,      // y sale a lo sumo de 1200 × 400 (nunca más grande que la original)
  altoMax: 400,
  tope: 512 * 1024     // peso máximo del PNG de salida
});

/** Alfa de un píxel: el fondo claro se vuelve transparente; el trazo conserva su color (fórmula de Fichas). */
export function alfaDeFirma(r, g, b, a = 255) {
  const lum = (r * 299 + g * 587 + b * 114) / 1000;
  const L = FIRMA_LIMPIA;
  return Math.min(a, lum >= L.claro ? 0 : (lum <= L.oscuro ? 255 : Math.round(255 * (L.claro - lum) / (L.claro - L.oscuro))));
}

/**
 * Vuelve transparente el fondo claro de `data` (RGBA, se MODIFICA en su sitio) y devuelve la caja del trazo
 * (píxeles con alfa > 40), o null si no hay trazo.
 * @returns {{minX:number, minY:number, maxX:number, maxY:number}|null}
 */
export function limpiarFondo(data, W, H) {
  let minX = W; let minY = H; let maxX = -1; let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = alfaDeFirma(data[i], data[i + 1], data[i + 2], data[i + 3]);
      data[i + 3] = a;
      if (a > FIRMA_LIMPIA.alfaTrazo) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * Recorte al trazo con su margen (dentro de la imagen) y medidas de salida acotadas, sin ampliar.
 * @returns {{x:number, y:number, w:number, h:number, ancho:number, alto:number}}  recorte en la imagen de trabajo + salida
 */
export function recorteDeFirma(caja, W, H) {
  const L = FIRMA_LIMPIA;
  const m = Math.round(Math.max(caja.maxX - caja.minX, caja.maxY - caja.minY) * L.margen) + L.margenPx;
  const x = Math.max(0, caja.minX - m); const y = Math.max(0, caja.minY - m);
  const w = Math.min(W, caja.maxX + m + 1) - x; const h = Math.min(H, caja.maxY + m + 1) - y;
  const esc = Math.min(1, L.anchoMax / w, L.altoMax / h);
  return { x, y, w, h, ancho: Math.max(1, Math.round(w * esc)), alto: Math.max(1, Math.round(h * esc)) };
}

/**
 * Segundo intento, SOLO si el PNG pasa del tope: el papel gris de una foto de celular deja un velo casi invisible
 * (alfa 1–40) lleno de grano que no comprime. Se lleva a 0 lo que no cuenta como trazo (alfa ≤ 40, el mismo umbral del
 * recorte). Lo que hoy sale bien no pasa por aquí: queda idéntico a Fichas. Modifica `data` en su sitio.
 */
export function quitarVelo(data) {
  for (let i = 3; i < data.length; i += 4) if (data[i] <= FIRMA_LIMPIA.alfaTrazo) data[i] = 0;
}

/** Medidas de trabajo (a lo sumo 2400 de ancho, sin ampliar). */
export function medidasDeTrabajo(ancho, alto) {
  const esc0 = Math.min(1, FIRMA_LIMPIA.anchoTrabajo / ancho);
  return { ancho: Math.max(1, Math.round(ancho * esc0)), alto: Math.max(1, Math.round(alto * esc0)) };
}

/**
 * Puntos por pulgada con que se imprimirá la firma en la portada (su tamaño sale de `tamanoFirma` con los
 * límites de la portada que se le pasen). Por debajo de 200 ppp puede verse pixelada.
 */
export function pppImpresa(anchoPx, altoPx, limites) {
  if (!(anchoPx > 0 && altoPx > 0)) return 0;
  const t = tamanoFirma(anchoPx / altoPx, limites);
  return Math.min(anchoPx / (t.ancho / 72), altoPx / (t.alto / 72));
}
