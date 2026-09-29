// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · HOJA «SALUD Y RIESGO» EN EL EXCEL (`99 §107`)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-27): «al exportar el documento en excel, no se
// exporta la matriz de riesgo, necesito que se exporte, no necesito que salga la
// hoja de anexo AT en fichas técnicas por mantenimiento especializado». Decidió:
// quitar el Anexo AT de la pantalla y del Excel de Mantenimiento, y llevar al
// Excel la hoja «Salud y riesgo» COMPLETA, en el lugar del Anexo AT.
//
// Cómo: la hoja nueva CLONA el marco oficial de «Diagrama Actual» (franja con
// título y logo, marco, «Notas:», pie) y dentro del marco lleva una IMAGEN con lo
// mismo que la pantalla: las cuatro cifras, la definición de la condición, la
// matriz 5×5 con los colores de la MO.00418 Tabla 11 y la casilla del equipo
// encerrada y la leyenda (la lectura por potencia y la nota de la norma salieron
// en `99 §111`; de la pantalla, en `§115`). Los datos llegan ya calculados
// por el panel con el MISMO dominio que pinta la pantalla (`matriz_riesgo.js`):
// aquí solo se dibujan; no hay una segunda matriz que pueda contradecirla.
//
// Piezas:
//   · svgSaludRiesgo(modelo)           PURA → { svg, w, h }
//   · cajaSaludRiesgo(hojaDiagramaXml) PURA → tamaño en píxeles del marco
//   · svgAPng(svg, w, h, ancho, alto)  navegador (canvas); null sin DOM
//   · montarHojaSaludRiesgo(zip, png, caja)  reemplaza la hoja «Anexo AT»
// ══════════════════════════════════════════════════════════════════════════════

import { anchoArial } from './anchos-arial.js';

const EMU_PX = 9525;
/** Marco de la hoja de diagramas (filas 9 a 45, columnas B a R; base 0 en el dibujo), con margen: la imagen no toca el borde en ningún programa. */
const MARCO = Object.freeze({ col0: 1, col1: 17, fila0: 8, fila1: 44, margenPx: 10 });
const HOJA_DIAGRAMA = 'xl/worksheets/sheet3.xml';
const DIBUJO_DIAGRAMA = 'xl/drawings/drawing3.xml';
const HOJA_DESTINO = 'xl/worksheets/sheet6.xml';      // la del «Anexo AT»
const DIBUJO_DESTINO = 'xl/drawings/drawing6.xml';
const RELS_DIBUJO_DESTINO = 'xl/drawings/_rels/drawing6.xml.rels';
const IMAGEN = 'xl/media/image8.png';
export const NOMBRE_HOJA = 'Salud y riesgo';

const esc = (s) => String(s == null ? '' : s)
  // Caracteres de control que XML 1.0 no admite (llegan pegados de otro sistema):
  // uno solo en la subestación dejaba el dibujo sin imagen (revisión §107, igual que §89).
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Lo que SIEMPRE reposa en «Notas:» de la hoja (`99 §111`), dictado por el Ingeniero
 * (solo ortografía: tildes, «con las que», «si no»). Las 7 variables son las del
 * índice de salud MO.00418 (`calcularHIBruto`: DGA, edad, ADFQ, furanos, cargabilidad,
 * PYT, hermeticidad). En dos renglones (B49 y B50, Arial 10): en uno solo ocupa
 * ~1.218 de 1.246 px y en otro programa se cortaría.
 */
export const NOTA_SALUD_RIESGO = Object.freeze([
  'Cualquier alteración de las 7 variables con las que se califica cada uno de los activos puede comprometer su estado de salud y/o su operación',
  'si no se atiende a tiempo, aun teniendo un estado de salud bueno.'
]);

/** Lo que dice la hoja cuando la matriz no se pudo dibujar: el Anexo AT no vuelve (`99 §107`). */
export const AVISO_SIN_IMAGEN = 'No se pudo dibujar la matriz de riesgo de este equipo. Consulte la hoja «Salud y riesgo» de la ficha en pantalla y vuelva a exportar.';

/**
 * Dibuja la hoja como SVG. `m` es el modelo que arma el panel:
 * { titulo, kpis:[{valor, sub, etiqueta, tinta, rol}], definicion, avisoSinDato,
 *   columnas:[{etiqueta, rango}], filas:[{nombre, celdas:[{hex, tinta, aqui}]}],
 *   marca:{mva, usuarios, punto}, leyenda:[{hex, texto}], hayMarca, puntos:[1..5],
 *   potenciaLeyenda, avisoDato, lectura, nota }
 */
export function svgSaludRiesgo(m) {
  // Proporciones del MARCO (1226 × 611 px, casi 2:1): el dibujo antes medía 1600 × ~706 y
  // quedaba limitado por el ancho, con la letra en ~6 pt en papel. Más angosto y más compacto
  // en alto, llena el marco y la MISMA letra sale ~25 % más grande (el Ingeniero, 2026-09-28:
  // «procede» a agrandar el texto pequeño). Mismo contenido y mismo orden que antes.
  const W = 1240; const P = 20; const FUENTE = 'Arial, Helvetica, sans-serif';
  const partes = []; let y = P;
  const texto = (x, yy, t, o = {}) => partes.push('<text x="' + x + '" y="' + yy + '" font-family="' + FUENTE + '" font-size="'
    + (o.tam || 16) + '"' + (o.peso ? ' font-weight="' + o.peso + '"' : '') + ' fill="' + (o.color || '#10202c') + '"'
    + (o.ancla ? ' text-anchor="' + o.ancla + '"' : '') + (o.cursiva ? ' font-style="italic"' : '') + '>' + esc(t) + '</text>');
  // Ancho REAL de un texto en Arial, letra por letra (`anchos-arial.js`; un promedio por
  // letra achicaba de más «Riesgo tolerable», revisión 2026-09-28).
  const ancho = (t, tam, peso) => anchoArial(t, tam, !!peso);
  // Párrafo partido en renglones por su ancho real (antes, por número de letras).
  const parrafo = (t, o = {}) => {
    const tam = o.tam || 16; const out = []; let linea = '';
    for (const p of String(t || '').split(/\s+/).filter(Boolean)) {
      const prueba = linea ? linea + ' ' + p : p;
      if (linea && ancho(prueba, tam, o.peso) > W - 2 * P) { out.push(linea); linea = p; } else linea = prueba;
    }
    if (linea) out.push(linea);
    out.forEach((r) => { y += tam * 1.35; texto(P, y, r, o); });
  };
  // Un texto que no cabe en su espacio baja de tamaño hasta caber (nunca de `min`).
  const tamQueCabe = (t, tam, peso, disponible, min) => Math.max(min, Math.min(tam, Math.floor(disponible / Math.max(1, ancho(t, 1, peso)))));

  // Título de contexto.
  if (m.titulo) { y += 22; texto(P, y, m.titulo, { tam: tamQueCabe(m.titulo, 22, 700, W - 2 * P, 16), peso: 700 }); y += 12; }

  // Cuatro cifras, como las tarjetas de la pantalla, SIN sus anotaciones en
  // cursiva («fila 3 de la matriz», «columna Menor», «se muestra: no mueve la
  // casilla», «resultado de fila × columna»): el Ingeniero pidió que no salgan
  // en el Excel (`99 §110`). En pantalla siguen.
  const kpis = m.kpis || [];
  const gap = 14; const kw = (W - 2 * P - gap * 3) / 4; const kh = 100; const util = kw - 32;
  kpis.slice(0, 4).forEach((k, i) => {
    const x = P + i * (kw + gap);
    partes.push('<rect x="' + x + '" y="' + y + '" width="' + kw + '" height="' + kh + '" rx="12" fill="#f4f7fa" stroke="#d5dee8" stroke-width="1.5"/>');
    texto(x + 16, y + 44, k.valor, { tam: tamQueCabe(k.valor, 36, 800, util, 24), peso: 800, color: k.tinta || '#10202c' });
    texto(x + 16, y + 68, k.sub, { tam: tamQueCabe(k.sub, 16, 0, util, 13), color: '#26394d' });
    texto(x + 16, y + 90, k.etiqueta, { tam: tamQueCabe(k.etiqueta, 15, 700, util, 13), peso: 700, color: '#5b6b7c' });
  });
  y += kh + 6;

  if (m.definicion) parrafo(m.definicion, { tam: 16 });
  if (m.avisoSinDato) { y += 6; parrafo(m.avisoSinDato, { tam: 16, color: '#b3261e', peso: 700 }); }
  y += 14;

  // Matriz 5×5.
  // rotW: «Consecuencia (usuarios aguas abajo) →» en 14 px mide ~270 px; con menos, la columna 1 tapa la flecha.
  const rotW = 290; const cw = (W - 2 * P - rotW) / 5; const hh = 56; const rh = 58;
  const x0 = P; const y0 = y;
  partes.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + rotW + '" height="' + hh + '" fill="#e9eef4" stroke="#ffffff" stroke-width="2"/>');
  texto(x0 + 10, y0 + 23, 'Probabilidad de falla (condición) ↓', { tam: 14, peso: 700, color: '#26394d' });
  texto(x0 + 10, y0 + 44, 'Consecuencia (usuarios aguas abajo) →', { tam: 14, peso: 700, color: '#26394d' });
  (m.columnas || []).forEach((c, i) => {
    const x = x0 + rotW + i * cw;
    partes.push('<rect x="' + x + '" y="' + y0 + '" width="' + cw + '" height="' + hh + '" fill="#e9eef4" stroke="#ffffff" stroke-width="2"/>');
    texto(x + cw / 2, y0 + 24, c.etiqueta, { tam: tamQueCabe(c.etiqueta, 17, 700, cw - 10, 13), peso: 700, ancla: 'middle' });
    texto(x + cw / 2, y0 + 45, c.rango, { tam: tamQueCabe(c.rango, 15, 0, cw - 10, 12), color: '#5b6b7c', ancla: 'middle' });
  });
  (m.filas || []).forEach((f, j) => {
    const yy = y0 + hh + j * rh;
    partes.push('<rect x="' + x0 + '" y="' + yy + '" width="' + rotW + '" height="' + rh + '" fill="#f4f7fa" stroke="#ffffff" stroke-width="2"/>');
    texto(x0 + 14, yy + rh / 2 + 6, f.nombre, { tam: 17, peso: 700 });
    f.celdas.forEach((c, i) => {
      const x = x0 + rotW + i * cw;
      partes.push('<rect x="' + x + '" y="' + yy + '" width="' + cw + '" height="' + rh + '" fill="' + c.hex + '" stroke="#ffffff" stroke-width="2"/>');
      if (c.aqui && m.marca) {
        partes.push('<rect x="' + (x + 4) + '" y="' + (yy + 4) + '" width="' + (cw - 8) + '" height="' + (rh - 8) + '" fill="none" stroke="#10202c" stroke-width="6"/>');
        // Sin MVA no hay punto, como en la pantalla: el papel no sugiere una potencia que no está registrada.
        if (m.marca.punto) {
          const r = 3 + 2.4 * m.marca.punto;
          partes.push('<circle cx="' + (x + 26) + '" cy="' + (yy + rh / 2) + '" r="' + r + '" fill="' + c.tinta + '"/>');
        }
        const libre = cw - 54;
        texto(x + 46, yy + rh / 2 - 3, m.marca.mva, { tam: tamQueCabe(m.marca.mva, 19, 800, libre, 13), peso: 800, color: c.tinta });
        texto(x + 46, yy + rh / 2 + 17, m.marca.usuarios, { tam: tamQueCabe(m.marca.usuarios, 15, 0, libre, 12), color: c.tinta });
      }
    });
  });
  y = y0 + hh + 5 * rh + 14;

  // Leyenda: color = veredicto; el recuadro; el tamaño del punto. En el ancho del marco no
  // cabe en un renglón: pasa al siguiente lo que no quepa.
  let lx = P;
  const lugar = (w) => { if (lx > P && lx + w > W - P) { lx = P; y += 30; } };
  (m.leyenda || []).forEach((l) => {
    const w = 30 + ancho(l.texto, 16) + 22; lugar(w);
    partes.push('<rect x="' + lx + '" y="' + (y + 4) + '" width="22" height="22" rx="4" fill="' + l.hex + '"/>');
    texto(lx + 30, y + 21, l.texto, { tam: 16 }); lx += w;
  });
  if (m.hayMarca) {
    const t = 'Recuadro: posición de este equipo'; const w = 30 + ancho(t, 16) + 22; lugar(w);
    partes.push('<rect x="' + lx + '" y="' + (y + 4) + '" width="22" height="22" fill="#ffffff" stroke="#10202c" stroke-width="4"/>');
    texto(lx + 30, y + 21, t, { tam: 16 }); lx += w;
  }
  const pts = m.puntos || [];
  if (pts.length || m.potenciaLeyenda) {
    const wPts = pts.reduce((a, p) => a + 2 * (3 + 2.4 * p) + 6, 0);
    lugar(wPts + 6 + ancho(m.potenciaLeyenda || '', 16));
    pts.forEach((p) => { const r = 3 + 2.4 * p; partes.push('<circle cx="' + (lx + r) + '" cy="' + (y + 15) + '" r="' + r + '" fill="#26394d"/>'); lx += 2 * r + 6; });
    if (m.potenciaLeyenda) texto(lx + 6, y + 21, m.potenciaLeyenda, { tam: 16 });
  }
  y += 34;

  if (m.avisoDato) { y += 4; parrafo(m.avisoDato, { tam: 15, color: '#8a4b00', peso: 700 }); }
  // Sin la «Lectura por potencia» ni la nota «La casilla sale de la norma…» (`99 §111`,
  // el Ingeniero: «eliminemos esta parte de la matriz de riesgo, no genera valor»).
  // El modelo las sigue trayendo (m.lectura, m.nota); tampoco salen ya en pantalla.
  const H = Math.ceil(y + P);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">'
    + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' + partes.join('') + '</svg>';
  return { svg, w: W, h: H };
}

/* ── geometría del marco en la hoja de diagramas ─────────────────────────── */

function anchoColPx(w) { return Math.trunc(((256 * w + Math.trunc(128 / 7)) / 256) * 7); }

function geometria(hojaXml) {
  const x = String(hojaXml);
  const fmt = x.match(/<sheetFormatPr\b[^>]*>/);
  const defAlto = fmt && /defaultRowHeight="([\d.]+)"/.test(fmt[0]) ? +fmt[0].match(/defaultRowHeight="([\d.]+)"/)[1] : 15;
  const defAncho = fmt && /defaultColWidth="([\d.]+)"/.test(fmt[0]) ? +fmt[0].match(/defaultColWidth="([\d.]+)"/)[1] : 8.43;
  const cols = [...x.matchAll(/<col\b[^>]*\/>/g)].map((c) => ({ min: +c[0].match(/min="(\d+)"/)[1], max: +c[0].match(/max="(\d+)"/)[1], w: +c[0].match(/width="([\d.]+)"/)[1] }));
  const anchoCol = (i) => { const c = cols.find((q) => i + 1 >= q.min && i + 1 <= q.max); return anchoColPx(c ? c.w : defAncho); };
  const altoFila = (i) => { const m = x.match(new RegExp('<row\\b[^>]*\\sr="' + (i + 1) + '"[^>]*>')); const h = m && m[0].match(/\sht="([\d.]+)"/); return Math.round((h ? +h[1] : defAlto) * 96 / 72); };
  return { anchoCol, altoFila };
}

/** Tamaño en píxeles del marco donde va la imagen (sin los márgenes). */
export function cajaSaludRiesgo(hojaDiagramaXml) {
  const g = geometria(hojaDiagramaXml);
  let w = 0; for (let i = MARCO.col0; i <= MARCO.col1; i++) w += g.anchoCol(i);
  let h = 0; for (let i = MARCO.fila0; i <= MARCO.fila1; i++) h += g.altoFila(i);
  return { w: w - 2 * MARCO.margenPx, h: h - 2 * MARCO.margenPx, anchoUltimaCol: g.anchoCol(MARCO.col1), altoUltimaFila: g.altoFila(MARCO.fila1) };
}

/** SVG → PNG sin rotar, encajado (sin deformar) sobre fondo blanco. Solo en el navegador. */
export function svgAPng(svg, vbW, vbH, ancho, alto) {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined' || typeof Image === 'undefined' || !svg) { resolve(null); return; }
      const img = new Image();
      const url = URL.createObjectURL(new Blob([String(svg).replace('<svg ', '<svg width="' + vbW + '" height="' + vbH + '" ')], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = function () {
        try {
          const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
          const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, ancho, alto);
          const s = Math.min(ancho / vbW, alto / vbH);
          ctx.drawImage(img, (ancho - vbW * s) / 2, (alto - vbH * s) / 2, vbW * s, vbH * s);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) {
            if (!b) { resolve(null); return; }
            const fr = new FileReader();
            fr.onload = function () { resolve(new Uint8Array(fr.result)); };
            fr.onerror = function () { resolve(null); };
            fr.readAsArrayBuffer(b);
          }, 'image/png');
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch (e) { resolve(null); }
  });
}

function celdaTexto(xml, ref, texto) {
  return String(xml).replace(new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)'), (_m, at) => {
    const a = String(at).replace(/\st="[^"]*"/, '');
    return '<c r="' + ref + '"' + a + ' t="inlineStr"><is><t>' + esc(texto) + '</t></is></c>';
  });
}

/**
 * Reemplaza la hoja «Anexo AT» por «Salud y riesgo»: clona el marco de
 * «Diagrama Actual», le pone título y pie, y dibuja la imagen dentro del marco.
 * Sin imagen (`png` null) la hoja se monta igual, con AVISO_SIN_IMAGEN en el
 * marco. Devuelve true si llevó la imagen. Lee y arma todo antes de escribir;
 * si algo falla lanza y el zip queda igual.
 */
export async function montarHojaSaludRiesgo(zip, png, caja) {
  const leer = async (r) => { const f = zip.file(r); if (!f) throw new Error('falta ' + r); return f.async('string'); };
  const [hojaDiag, dibujoDiag, libro] = await Promise.all([leer(HOJA_DIAGRAMA), leer(DIBUJO_DIAGRAMA), leer('xl/workbook.xml')]);

  let hoja = celdaTexto(hojaDiag, 'B3', 'SALUD Y RIESGO');
  hoja = celdaTexto(hoja, 'B56', 'Pág. 5 de 5');
  // «Notas:» (B48) lleva siempre la advertencia del Ingeniero en sus dos primeros renglones.
  hoja = celdaTexto(hoja, 'B49', NOTA_SALUD_RIESGO[0]);
  hoja = celdaTexto(hoja, 'B50', NOTA_SALUD_RIESGO[1]);
  // Sin imagen, la hoja igual reemplaza al Anexo AT y lo dice dentro del marco.
  const conImagen = !!(png && png.length);
  if (!conImagen) hoja = celdaTexto(hoja, 'B10', AVISO_SIN_IMAGEN);
  // La copia NO repite el identificador interno de «Diagrama Actual»: toma el que
  // tenía la hoja que reemplaza (o ninguno), para que Excel no la tome por duplicada.
  const original = zip.file(HOJA_DESTINO) ? await zip.file(HOJA_DESTINO).async('string') : '';
  const uid = (original.match(/<worksheet\b[^>]*\sxr:uid="([^"]+)"/) || [])[1];
  hoja = hoja.replace(/(<worksheet\b[^>]*?)\sxr:uid="[^"]*"/, (_m, a) => (uid ? a + ' xr:uid="' + uid + '"' : a));

  // Dibujo: el logo del diagrama tal cual (rId1) + la imagen de la matriz (rId2) en el marco.
  const anclas = [...dibujoDiag.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/g)].map((m) => m[0]);
  const logo = anclas.find((a) => /r:embed="rId1"/.test(a));
  if (!logo) throw new Error('sin logo en la hoja de diagramas');
  const mg = MARCO.margenPx * EMU_PX;
  const imagen = '<xdr:twoCellAnchor editAs="oneCell">'
    + '<xdr:from><xdr:col>' + MARCO.col0 + '</xdr:col><xdr:colOff>' + mg + '</xdr:colOff><xdr:row>' + MARCO.fila0 + '</xdr:row><xdr:rowOff>' + mg + '</xdr:rowOff></xdr:from>'
    + '<xdr:to><xdr:col>' + MARCO.col1 + '</xdr:col><xdr:colOff>' + Math.max(0, (caja.anchoUltimaCol - MARCO.margenPx) * EMU_PX) + '</xdr:colOff><xdr:row>' + MARCO.fila1 + '</xdr:row><xdr:rowOff>' + Math.max(0, (caja.altoUltimaFila - MARCO.margenPx) * EMU_PX) + '</xdr:rowOff></xdr:to>'
    + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="3" name="Salud y riesgo" descr="Matriz de riesgo del activo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'
    + '<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
    + '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + caja.w * EMU_PX + '" cy="' + caja.h * EMU_PX + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>'
    + '</xdr:pic><xdr:clientData/></xdr:twoCellAnchor>';
  const cuerpo = dibujoDiag.replace(/(<xdr:wsDr\b[^>]*>)[\s\S]*(<\/xdr:wsDr>)/, (_m, a, b) => a + logo + (conImagen ? imagen : '') + b);
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.emf"/>'
    + (conImagen ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image8.png"/>' : '')
    + '</Relationships>';

  // Libro: el nombre de la hoja y su área de impresión (la del marco de diagramas).
  let wb = libro.replace(/<sheet\b([^>]*)\sname="Anexo AT"/, '<sheet$1 name="' + NOMBRE_HOJA + '"');
  if (wb === libro) throw new Error('el libro no tiene hoja «Anexo AT»');
  // Reemplazo con FUNCIÓN: en una cadena, «$B$2» metería el grupo 2 en medio.
  wb = wb.replace(/(<definedName name="_xlnm\.Print_Area" localSheetId="\d+">)'Anexo AT'![^<]*(<\/definedName>)/,
    (_m, a, b) => a + "'" + NOMBRE_HOJA + "'!$B$2:$R$56" + b);

  zip.file(HOJA_DESTINO, hoja);
  zip.file(DIBUJO_DESTINO, cuerpo);
  zip.file(RELS_DIBUJO_DESTINO, rels);
  if (conImagen) zip.file(IMAGEN, png);
  zip.file('xl/workbook.xml', wb);
  return conImagen;
}
