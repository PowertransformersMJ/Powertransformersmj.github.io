// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Tamaño de la firma estampada (dominio puro) · `99 §101`
// ──────────────────────────────────────────────────────────────────────────────
// En un archivo PROPIO a propósito (L-102): una exportación nueva dentro de un
// módulo que el navegador ya tenía guardado puede cruzarse con su copia vieja
// tras publicar y tumbar la página entera. Un archivo nuevo no tiene copia vieja.
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Tamaño de una firma estampada, con el MISMO peso visual para todas (`99 §101`,
 * pedido del Ingeniero: «proporcionales con el espacio para firmar, ni muy
 * grandes ni muy pequeñas, respetando los márgenes»).
 *
 * Antes todas iban a la misma ALTURA: una firma ancha (4,5 : 1) se estiraba a lo
 * ancho y una alta (1,7 : 1) quedaba angosta. Ahora todas buscan la misma
 * SUPERFICIE (`area`): la ancha se achica; la alta crece solo hasta `altoMax`
 * (el renglón de «Firma:», sin tapar el texto de encima) y ahí se queda, así que
 * con proporción menor que area / altoMax² (≈ 2,5 : 1) sale igual que antes.
 * Nunca pasa de `anchoMax` (el espacio de la casilla, con su margen). Unidades
 * libres (pt, EMU o px), las mismas en los tres parámetros.
 *
 * @param {number} rel  ancho / alto de la imagen
 * @param {{area: number, altoMax: number, anchoMax?: number}} lim
 * @returns {{ancho: number, alto: number}}
 */
/** Medidas de la firma en el PAPEL (Excel): superficie ≈ 55 × 22 pt en una firma
 *  de 2,5 : 1 y alto máximo = el renglón de «Firma:». La pantalla usa las mismas,
 *  a su escala (30 px de alto máximo). */
export const FIRMA_PAPEL = Object.freeze({ areaPt2: 1200, altoMaxPt: 22 });

export function tamanoFirma(rel, { area, altoMax, anchoMax } = {}) {
  const r = rel > 0 && Number.isFinite(rel) ? rel : 2.5;
  let alto = Math.min(Math.sqrt(area / r), altoMax);
  let ancho = alto * r;
  if (anchoMax > 0 && ancho > anchoMax) { ancho = anchoMax; alto = ancho / r; }
  return { ancho, alto };
}
