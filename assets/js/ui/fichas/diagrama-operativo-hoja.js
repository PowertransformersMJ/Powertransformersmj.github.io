// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «DIAGRAMA OPERATIVO» · la hoja en el Excel (`99 §112`)
// ──────────────────────────────────────────────────────────────────────────────
// Añade AL FINAL del libro PE.02081 de Mantenimiento una hoja NUEVA «Diagrama
// Operativo» (pedido del Ingeniero: «esta hoja debe llamarse (Diagrama
// Operativo)»), con el marco oficial clonado de «Diagrama Actual» (franja con el
// título DIAGRAMA OPERATIVO, logo, marco, «Notas:», pie) y, dentro del marco, la
// imagen YA APROBADA del adjunto (el cronograma dibujado u la imagen original),
// centrada y sin deformar (oneCellAnchor con su tamaño: igual en Mac, Windows,
// LibreOffice y la vista previa, lección de `§110`).
//
// Una hoja nueva exige (revisión del comité): nombres libres (sheetN, drawingN,
// imageN, rId, sheetId) calculados sobre el zip; su Override y el Default de la
// imagen; sin r:id colgando (el pageSetup del clon apuntaba a una impresora) ni
// xr:uid repetido; área de impresión con su localSheetId; pies «Pág. N de T»
// renumerados en TODAS las hojas. Todo se calcula antes de escribir: si algo
// falla, lanza y el zip queda como estaba (el Excel sale sin la hoja y se avisa).
// ══════════════════════════════════════════════════════════════════════════════

export const NOMBRE_HOJA_OPERATIVO = 'Diagrama Operativo';
const TITULO = 'DIAGRAMA OPERATIVO';
const EMU_PX = 9525;
const HOJA_MARCO = 'xl/worksheets/sheet3.xml';        // «Diagrama Actual» de la plantilla
const DIBUJO_MARCO = 'xl/drawings/drawing3.xml';
// Marco de la hoja de diagramas: columnas B..R (1..17) y filas 9..45 (8..44), base 0.
const MARCO = Object.freeze({ col0: 1, col1: 17, fila0: 8, fila1: 44, margenPx: 10 });
const T_HOJA = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const T_DIBUJO = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const T_IMAGEN = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

const attr = (tag, n) => { const m = String(tag || '').match(new RegExp('\\s' + n.replace(':', '\\:') + '="([^"]*)"')); return m ? m[1] : null; };
const escXml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const maxNum = (nombres, re) => nombres.reduce((m, n) => { const k = n.match(re); return k ? Math.max(m, +k[1]) : m; }, 0);

function celdaTexto(xml, ref, texto) {
  return String(xml).replace(new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)'), (_m, at) =>
    '<c r="' + ref + '"' + String(at).replace(/\st="[^"]*"/, '') + ' t="inlineStr"><is><t>' + escXml(texto) + '</t></is></c>');
}

function geometria(hojaXml) {
  const x = String(hojaXml);
  const fmt = (x.match(/<sheetFormatPr\b[^>]*>/) || [''])[0];
  const defAlto = +(attr(fmt, 'defaultRowHeight') || 15); const defAncho = +(attr(fmt, 'defaultColWidth') || 8.43);
  const cols = [...x.matchAll(/<col\b[^>]*\/>/g)].map((m) => ({ min: +attr(m[0], 'min'), max: +attr(m[0], 'max'), w: +attr(m[0], 'width') }));
  const pxCol = (w) => Math.trunc(((256 * w + Math.trunc(128 / 7)) / 256) * 7);
  const anchoCol = (i) => { const c = cols.find((q) => i + 1 >= q.min && i + 1 <= q.max); return pxCol(c ? c.w : defAncho); };
  const altoFila = (i) => { const m = x.match(new RegExp('<row\\b[^>]*\\sr="' + (i + 1) + '"[^>]*>')); const h = m && m[0].match(/\sht="([\d.]+)"/); return Math.round((h ? +h[1] : defAlto) * 96 / 72); };
  return { anchoCol, altoFila };
}

/** Marco interior (px) donde cabe la imagen: {w, h}. */
export function cajaOperativo(hojaMarcoXml) {
  const g = geometria(hojaMarcoXml);
  let w = 0; for (let i = MARCO.col0; i <= MARCO.col1; i++) w += g.anchoCol(i);
  let h = 0; for (let i = MARCO.fila0; i <= MARCO.fila1; i++) h += g.altoFila(i);
  return { w: w - 2 * MARCO.margenPx, h: h - 2 * MARCO.margenPx };
}

/** Pies «Pág. N de T» de todas las hojas, en su orden (texto compartido o en línea). */
function renumerar(wb, relsWb, hojasXml, compartidos) {
  const quedan = [...wb.matchAll(/<sheet\b[^>]*\/?>/g)].map((m) => m[0]);
  const cambios = new Map();
  quedan.forEach((s, i) => {
    const rel = [...relsWb.matchAll(/<Relationship\b[^>]*\/?>/g)].map((m) => m[0]).find((r) => attr(r, 'Id') === attr(s, 'r:id'));
    if (!rel) return;
    const ruta = 'xl/' + String(attr(rel, 'Target')).replace(/^\/?xl\//, '').replace(/^\.\//, '');
    const xml = hojasXml.get(ruta); if (xml == null) return;
    let hecho = false;
    const nuevo = xml.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (c, at, dentro) => {
      if (hecho || !dentro) return c;
      const t = attr('<c' + at + '>', 't');
      let texto = null;
      if (t === 's') { const v = dentro.match(/<v>(\d+)<\/v>/); texto = v ? compartidos[+v[1]] : null; }
      else if (t === 'inlineStr') texto = [...dentro.matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
      const m = texto != null && String(texto).trim().match(/^(Pág\.?)\s*\d+\s+de\s+\d+$/);
      if (!m) return c;
      hecho = true;
      return '<c' + String(at).replace(/\st="[^"]*"/, '') + ' t="inlineStr"><is><t>' + escXml(m[1] + ' ' + (i + 1) + ' de ' + quedan.length) + '</t></is></c>';
    });
    if (nuevo !== xml) cambios.set(ruta, nuevo);
  });
  return cambios;
}

/**
 * Monta la hoja «Diagrama Operativo» al final del libro.
 * @param {object} zip  JSZip del PE.02081 ya armado
 * @param {{bytes: Uint8Array, mime: 'image/png'|'image/jpeg', ancho: number, alto: number}} img
 *   ancho/alto: tamaño (px) con que se muestra dentro del marco (ya encajado)
 * @returns {Promise<boolean>}
 */
export async function montarHojaDiagramaOperativo(zip, img) {
  if (!img || !img.bytes || !img.bytes.length) throw new Error('sin imagen');
  const esJpeg = img.mime === 'image/jpeg';
  if (!esJpeg && img.mime !== 'image/png') throw new Error('formato de imagen no admitido');
  const leer = async (r) => { const f = zip.file(r); if (!f) throw new Error('falta ' + r); return f.async('string'); };
  const [hojaMarco, dibujoMarco, wb, relsWb, ct] = await Promise.all([leer(HOJA_MARCO), leer(DIBUJO_MARCO), leer('xl/workbook.xml'), leer('xl/_rels/workbook.xml.rels'), leer('[Content_Types].xml')]);
  if (/<sheet\b[^>]*\sname="Diagrama Operativo"/.test(wb)) throw new Error('el libro ya tiene la hoja');
  const nombres = Object.keys(zip.files);
  const nHoja = maxNum(nombres, /^xl\/worksheets\/sheet(\d+)\.xml$/) + 1;
  const nDib = maxNum(nombres, /^xl\/drawings\/drawing(\d+)\.xml$/) + 1;
  const nImg = maxNum(nombres, /^xl\/media\/image(\d+)\.\w+$/) + 1;
  const rIdWb = 'rId' + (maxNum([...relsWb.matchAll(/\sId="(rId\d+)"/g)].map((m) => m[1]), /^rId(\d+)$/) + 1);
  const sheetId = Math.max(0, ...[...wb.matchAll(/<sheet\b[^>]*\ssheetId="(\d+)"/g)].map((m) => +m[1])) + 1;
  const rutaHoja = 'xl/worksheets/sheet' + nHoja + '.xml';
  const rutaDib = 'xl/drawings/drawing' + nDib + '.xml';
  const rutaImg = 'xl/media/image' + nImg + (esJpeg ? '.jpeg' : '.png');

  // Hoja: el marco de «Diagrama Actual» con su título; sin impresora ni uid repetido.
  let hoja = celdaTexto(hojaMarco, 'B3', TITULO);
  hoja = hoja.replace(/(<worksheet\b[^>]*?)\sxr:uid="[^"]*"/, '$1');
  hoja = hoja.replace(/(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/, '$1');
  hoja = hoja.replace(/<drawing r:id="[^"]*"\/>/, '<drawing r:id="rId1"/>');
  if (!/<drawing r:id="rId1"\/>/.test(hoja)) throw new Error('la hoja de diagramas no tiene dibujo');
  const relsHoja = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="' + T_DIBUJO + '" Target="../drawings/drawing' + nDib + '.xml"/></Relationships>';

  // Dibujo: el logo (rId1 del marco) + la imagen centrada en el marco (rId2).
  const anclas = [...dibujoMarco.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/g)].map((m) => m[0]);
  const logo = anclas.find((a) => /r:embed="rId1"/.test(a));
  if (!logo) throw new Error('sin logo en la hoja de diagramas');
  const relsMarco = await leer(DIBUJO_MARCO.replace(/drawings\/(drawing\d+\.xml)$/, 'drawings/_rels/$1.rels'));
  const relLogo = [...relsMarco.matchAll(/<Relationship\b[^>]*\/?>/g)].map((m) => m[0]).find((r) => attr(r, 'Id') === 'rId1');
  if (!relLogo) throw new Error('sin relación del logo');
  const g = geometria(hojaMarco); const caja = cajaOperativo(hojaMarco);
  const ancho = Math.max(1, Math.min(caja.w, Math.round(img.ancho || caja.w))); const alto = Math.max(1, Math.min(caja.h, Math.round(img.alto || caja.h)));
  // Esquina: origen del marco + margen + lo que sobra repartido a los dos lados.
  let dx = MARCO.margenPx + (caja.w - ancho) / 2; let col = MARCO.col0;
  while (dx >= g.anchoCol(col) && col < MARCO.col1) { dx -= g.anchoCol(col); col++; }
  let dy = MARCO.margenPx + (caja.h - alto) / 2; let fila = MARCO.fila0;
  while (dy >= g.altoFila(fila) && fila < MARCO.fila1) { dy -= g.altoFila(fila); fila++; }
  const imagen = '<xdr:oneCellAnchor><xdr:from><xdr:col>' + col + '</xdr:col><xdr:colOff>' + Math.round(dx * EMU_PX) + '</xdr:colOff><xdr:row>' + fila + '</xdr:row><xdr:rowOff>' + Math.round(dy * EMU_PX) + '</xdr:rowOff></xdr:from>'
    + '<xdr:ext cx="' + ancho * EMU_PX + '" cy="' + alto * EMU_PX + '"/>'
    + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1001" name="Diagrama Operativo" descr="Diagrama Operativo adjunto"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'
    + '<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
    + '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + ancho * EMU_PX + '" cy="' + alto * EMU_PX + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>'
    + '</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';
  const dibujo = dibujoMarco.replace(/(<xdr:wsDr\b[^>]*>)[\s\S]*(<\/xdr:wsDr>)/, (_m, a, b) => a + logo + imagen + b);
  const relsDib = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="' + T_IMAGEN + '" Target="' + escXml(attr(relLogo, 'Target')) + '"/>'
    + '<Relationship Id="rId2" Type="' + T_IMAGEN + '" Target="../media/image' + nImg + (esJpeg ? '.jpeg' : '.png') + '"/></Relationships>';

  // Libro: la hoja al final, su relación y su área de impresión.
  const indice = [...wb.matchAll(/<sheet\b[^>]*\/?>/g)].length;
  let wb2 = wb.replace(/<\/sheets>/, '<sheet name="' + NOMBRE_HOJA_OPERATIVO + '" sheetId="' + sheetId + '" r:id="' + rIdWb + '"/></sheets>');
  const area = '<definedName name="_xlnm.Print_Area" localSheetId="' + indice + '">\'' + NOMBRE_HOJA_OPERATIVO + '\'!$B$2:$R$56</definedName>';
  wb2 = /<definedNames>/.test(wb2) ? wb2.replace(/<\/definedNames>/, () => area + '</definedNames>') : wb2.replace(/<\/sheets>/, () => '</sheets><definedNames>' + area + '</definedNames>');
  const relsWb2 = relsWb.replace(/<\/Relationships>/, '<Relationship Id="' + rIdWb + '" Type="' + T_HOJA + '" Target="worksheets/sheet' + nHoja + '.xml"/></Relationships>');
  let ct2 = ct.replace(/<\/Types>/, '<Override PartName="/' + rutaHoja + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/' + rutaDib + '" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
  if (esJpeg && !/<Default Extension="jpeg"/i.test(ct2)) ct2 = ct2.replace(/<Types\b[^>]*>/, (t) => t + '<Default Extension="jpeg" ContentType="image/jpeg"/>');
  if (!esJpeg && !/<Default Extension="png"/i.test(ct2)) ct2 = ct2.replace(/<Types\b[^>]*>/, (t) => t + '<Default Extension="png" ContentType="image/png"/>');

  // Pies de TODAS las hojas (con la nueva ya en el libro).
  const hojasXml = new Map();
  for (const n of Object.keys(zip.files).filter((q) => /^xl\/worksheets\/sheet\d+\.xml$/.test(q))) hojasXml.set(n, await zip.file(n).async('string'));
  hojasXml.set(rutaHoja, hoja);
  const ss = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : '';
  const compartidos = [...ss.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => [...String(m[1] || '').matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((q) => q[1]).join(''));
  const pies = renumerar(wb2, relsWb2, hojasXml, compartidos);

  // Escribir (todo ya calculado).
  zip.file(rutaHoja, pies.get(rutaHoja) || hoja);
  zip.file(rutaHoja.replace(/worksheets\/(sheet\d+\.xml)$/, 'worksheets/_rels/$1.rels'), relsHoja);
  zip.file(rutaDib, dibujo);
  zip.file(rutaDib.replace(/drawings\/(drawing\d+\.xml)$/, 'drawings/_rels/$1.rels'), relsDib);
  zip.file(rutaImg, img.bytes);
  zip.file('xl/workbook.xml', wb2);
  zip.file('xl/_rels/workbook.xml.rels', relsWb2);
  zip.file('[Content_Types].xml', ct2);
  for (const [ruta, xml] of pies) if (ruta !== rutaHoja) zip.file(ruta, xml);
  return true;
}
