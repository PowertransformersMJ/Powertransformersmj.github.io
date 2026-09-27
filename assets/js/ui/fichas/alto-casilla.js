// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · ALTO DE LA CASILLA DE BENEFICIOS (`99 §105`)
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del Ingeniero (2026-09-27): «Agrandar la casilla». La casilla
// BENEFICIOS de la hoja 1 del PE.02081 (B23:L26, combinada) tiene alto fijo y le
// caben unas 230 palabras; los beneficios de las acciones del Ingeniero son más
// largos y en el papel se cortaban el comienzo y el final.
//
// Excel NO ajusta solo el alto de una casilla combinada, así que aquí se estima
// cuántas líneas ocupa el texto con la letra real de la casilla (Arial 10, texto
// justificado) y el ancho de sus columnas, y se agranda la fila. Solo CRECE: si el
// texto cabe, la hoja sale idéntica (el PI, con textos cortos, no cambia). La
// hoja 1 tiene «ajustar a una página», así que se sigue imprimiendo en UNA página.
//
// La estimación es CONSERVADORA (menos caracteres por línea que los reales): un
// poco de aire al final es aceptable; un texto cortado en un documento firmado no.
// Pura: recibe y devuelve texto XML.
// ══════════════════════════════════════════════════════════════════════════════

/** Tope de Excel para el alto de una fila, en puntos. */
export const ALTO_MAXIMO_FILA = 409;

/**
 * Líneas que ocupa un texto con `porLinea` caracteres por línea (cada salto de
 * línea abre renglón nuevo; un renglón vacío ocupa una línea).
 */
export function lineasTexto(texto, porLinea) {
  const n = Math.max(20, Number(porLinea) || 0);
  return String(texto == null ? '' : texto).split('\n')
    .reduce((t, p) => t + Math.max(1, Math.ceil(p.length / n)), 0);
}

function altoPorDefecto(hojaXml) {
  const m = String(hojaXml).match(/<sheetFormatPr\b[^>]*\sdefaultRowHeight="([\d.]+)"/);
  return m ? +m[1] : 15;
}

/** Alto actual de una fila (su `ht`, o el alto por defecto de la hoja). */
export function altoFila(hojaXml, fila) {
  const m = String(hojaXml).match(new RegExp('<row\\b[^>]*\\sr="' + fila + '"[^>]*>'));
  const ht = m && m[0].match(/\sht="([\d.]+)"/);
  return ht ? +ht[1] : altoPorDefecto(hojaXml);
}

function fijarAlto(hojaXml, fila, alto) {
  const v = String(Math.round(alto * 100) / 100);
  return String(hojaXml).replace(new RegExp('<row\\b[^>]*\\sr="' + fila + '"[^>]*>'), (tag) => {
    let t = /\sht="[^"]*"/.test(tag) ? tag.replace(/\sht="[^"]*"/, ' ht="' + v + '"') : tag.replace(/(\/?>)$/, ' ht="' + v + '"$1');
    if (!/\scustomHeight="/.test(t)) t = t.replace(/(\/?>)$/, ' customHeight="1"$1');
    return t;
  });
}

/**
 * Agranda las filas de una casilla combinada para que quepa el texto.
 * @param {string} hojaXml
 * @param {{ filas: number[], texto: string, porLinea?: number, altoLinea?: number, margen?: number }} o
 *   `porLinea`: caracteres por línea (conservador); `altoLinea`: puntos por línea.
 * @returns {string} la hoja con las filas ajustadas (idéntica si el texto cabe)
 */
export function ajustarAltoCasilla(hojaXml, o) {
  const filas = (o && o.filas) || [];
  if (!filas.length || !o.texto) return hojaXml;
  const altoLinea = o.altoLinea || 12.5;
  const necesario = lineasTexto(o.texto, o.porLinea || 200) * altoLinea + (o.margen != null ? o.margen : 18);
  const actuales = filas.map((f) => altoFila(hojaXml, f));
  let falta = necesario - actuales.reduce((a, b) => a + b, 0);
  if (falta <= 0) return hojaXml;
  let xml = hojaXml;
  // Se agranda la primera fila; si pasa del tope de Excel, se reparte en las siguientes.
  filas.forEach((f, i) => {
    if (falta <= 0) return;
    const sube = Math.min(falta, Math.max(0, ALTO_MAXIMO_FILA - actuales[i]));
    if (sube > 0) { xml = fijarAlto(xml, f, actuales[i] + sube); falta -= sube; }
  });
  return xml;
}
