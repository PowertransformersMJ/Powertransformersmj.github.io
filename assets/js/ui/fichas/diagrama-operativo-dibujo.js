// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas · «DIAGRAMA OPERATIVO» · dibujo de la hoja adjunta (`99 §112`)
// ──────────────────────────────────────────────────────────────────────────────
// Toma el modelo de `diagrama-operativo-lector.js` y lo dibuja «homologado a la
// hoja» (pedido del Ingeniero): dentro del marco oficial del PE.02081, nítido.
//
// HOMOLOGAR un cronograma: una hoja Gantt trae una columna por día (su muestra
// real: 52 días × 73 px = 3.800 px de ancho para 11 actividades). Reducirla
// entera al marco la dejaba en ~2 pt: ilegible. Por eso, cuando la letra
// prevista queda chica y hay una FILA DE FECHAS seguida (≥ 7 columnas), esas
// columnas se ANGOSTAN (las barras son rellenos: no pierden nada) y su fecha
// se escribe en VERTICAL («13/07»). Las demás columnas conservan su ancho.
//
// Seguridad (comité `§112`): todo texto pasa por escXml; los atributos son solo
// números calculados y colores ^#[0-9A-F]{6}$; las imágenes, solo data:image/
// png|jpeg|gif en base64 salidas del propio archivo. El SVG NUNCA entra al DOM:
// se rasteriza por Blob → <img> → canvas, y la pantalla muestra el PNG.
// ══════════════════════════════════════════════════════════════════════════════

const PX_PT = 96 / 72;
/** Escala de impresión de la hoja de diagramas del PE.02081 (pageSetup scale="70"). */
export const ESCALA_IMPRESION = 0.7;
/** Letra mínima que se considera legible en el papel (pt). */
export const LETRA_MINIMA = 6.5;
const ANCHO_MIN_DIA = 16;

const escXml = (s) => String(s == null ? '' : s)
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const colorOk = (c) => (/^#[0-9A-F]{6}$/i.test(String(c || '')) ? String(c).toUpperCase() : null);
const n2 = (v) => Math.round(v * 100) / 100;
const fuenteCss = (nombre) => (/^[A-Za-z0-9 ._-]{1,40}$/.test(String(nombre || '')) ? "'" + nombre + "', " : '') + 'Arial, Helvetica, sans-serif';

/** Medidor de texto: canvas en el navegador; en Node, una aproximación conservadora. */
function medidor() {
  if (typeof document !== 'undefined') {
    const cx = document.createElement('canvas').getContext('2d');
    return (texto, f) => { cx.font = (f.i ? 'italic ' : '') + (f.b ? 'bold ' : '') + n2(f.sz * PX_PT) + 'px ' + fuenteCss(f.nombre); return cx.measureText(texto).width; };
  }
  return (texto, f) => String(texto).length * f.sz * PX_PT * (f.b ? 0.6 : 0.55);
}

/** ¿Esta celda es una marca de calendario? fecha · número de día/semana · «S1», «Sem 2», «Semana 3». */
function marcaCalendario(c) {
  if (c.esFecha) return { tipo: 'fecha' };
  const t = String(c.texto || '').trim();
  if (c.esNumero && /^\d{1,2}$/.test(t)) return { tipo: 'num', n: +t };
  const m = t.match(/^(?:S|Sem\.?|Semana)\s*(\d{1,2})$/i);
  if (m) return { tipo: 'sem', n: +m[1] };
  return null;
}
/** Un tramo de números es de calendario si avanza de a 1 (y puede volver a 1 tras 28-31). */
function secuenciaValida(marcas) {
  if (marcas[0].tipo === 'fecha') return marcas.every((m) => m.tipo === 'fecha');
  for (let i = 1; i < marcas.length; i++) {
    const a = marcas[i - 1]; const b = marcas[i];
    if (b.tipo !== a.tipo) return false;
    if (b.n !== a.n + 1 && !(b.n === 1 && a.n >= 28)) return false;
  }
  return true;
}

/**
 * La fila de CALENDARIO de un cronograma (≥ 7 columnas seguidas de fechas, días
 * numerados o semanas) en el encabezado —antes de la primera fila con barras—, o null.
 * @returns {{fila:number, c0:number, c1:number}|null}
 */
export function calendarioDe(modelo) {
  const filasBarras = modelo.celdas.filter((c) => c.relleno && !c.texto).map((c) => c.r);
  const tope = Math.max(12, Math.min(40, filasBarras.length ? Math.min(...filasBarras) + 1 : 40));
  const porFila = new Map();
  for (const c of modelo.celdas) {
    if (c.r >= tope) continue;
    const m = marcaCalendario(c); if (!m) continue;
    if (!porFila.has(c.r)) porFila.set(c.r, new Map());
    porFila.get(c.r).set(c.c, m);
  }
  let mejor = null;
  for (const [r, cols] of porFila) {
    const orden = [...cols.keys()].sort((a, b) => a - b);
    let i0 = 0;
    for (let i = 1; i <= orden.length; i++) {
      if (i === orden.length || orden[i] !== orden[i - 1] + 1 || !secuenciaValida([cols.get(orden[i - 1]), cols.get(orden[i])])) {
        const tramo = orden.slice(i0, i);
        if (tramo.length >= 7 && secuenciaValida(tramo.map((k) => cols.get(k))) && (!mejor || tramo.length > mejor.c1 - mejor.c0 + 1)) mejor = { fila: r, c0: tramo[0], c1: tramo[tramo.length - 1] };
        i0 = i;
      }
    }
  }
  return mejor;
}

/** Tamaño de letra que más se repite en las celdas con texto (pt). */
export function letraDominante(modelo) {
  const cuenta = new Map();
  for (const c of modelo.celdas) if (c.texto) cuenta.set(c.fuente.sz, (cuenta.get(c.fuente.sz) || 0) + String(c.texto).length);
  let sz = 11; let max = -1;
  for (const [k, v] of cuenta) if (v > max) { max = v; sz = k; }
  return sz;
}

/**
 * Geometría «homologada»: anchos y altos finales y qué celdas van en vertical.
 * @param {object} modelo
 * @param {{w:number,h:number}} caja  tamaño del marco en px
 */
export function planoHomologado(modelo, caja, medir = medidor()) {
  const columnas = modelo.columnas.slice(); const filas = modelo.filas.slice();
  const W0 = columnas.reduce((a, b) => a + b, 0); const H0 = filas.reduce((a, b) => a + b, 0);
  const sz = letraDominante(modelo);
  const escala = (W, H) => Math.min(caja.w / W, caja.h / H, 1.5);
  const cal = calendarioDe(modelo);
  const vertical = new Set();
  let compactado = false;
  if (cal && sz * escala(W0, H0) * ESCALA_IMPRESION < LETRA_MINIMA) {
    let n = 0; for (let c = cal.c0; c <= cal.c1; c++) if (columnas[c] > 0) n++;
    let otras = 0; for (let c = 0; c < columnas.length; c++) if (c < cal.c0 || c > cal.c1) otras += columnas[c];
    // Ancho total que llena el marco a la escala que permite el alto.
    const libre = caja.w / Math.min(1, caja.h / H0) - otras;
    const natural = Math.max(...columnas.slice(cal.c0, cal.c1 + 1));
    const ancho = Math.max(ANCHO_MIN_DIA, Math.min(natural || ANCHO_MIN_DIA, Math.floor(libre / Math.max(1, n))));
    for (let c = cal.c0; c <= cal.c1; c++) if (columnas[c] > 0) columnas[c] = ancho;   // las ocultas siguen ocultas
    // La fecha en vertical: la fila necesita el largo de «00/00» más aire.
    const f = (modelo.celdas.find((q) => q.r === cal.fila && q.c === cal.c0) || {}).fuente || { sz, nombre: 'Arial' };
    filas[cal.fila] = Math.max(filas[cal.fila], Math.ceil(medir('00/00', f) + 12));
    for (let c = cal.c0; c <= cal.c1; c++) vertical.add(cal.fila + ',' + c);
    compactado = true;
  }
  const W = columnas.reduce((a, b) => a + b, 0); const H = filas.reduce((a, b) => a + b, 0);
  const s = escala(W, H);
  return { columnas, filas, W, H, s, vertical, calendario: cal, compactado, letraPrevista: n2(sz * s * ESCALA_IMPRESION) };
}

/** Líneas de un texto que envuelve dentro de `ancho` px. */
function envolver(texto, ancho, f, medir) {
  const out = [];
  for (const parrafo of String(texto).split(/\r?\n/)) {
    let linea = '';
    for (const p of parrafo.split(/(\s+)/)) {
      const prueba = linea + p;
      if (linea && medir(prueba.trimEnd(), f) > ancho) { out.push(linea.trimEnd()); linea = p.trimStart(); } else linea = prueba;
    }
    out.push(linea.trimEnd());
  }
  return out;
}

/**
 * SVG de la hoja homologada (texto; NUNCA se inserta en la página).
 * @returns {{svg:string, w:number, h:number}}
 */
export function svgDeHoja(modelo, plano, medir = medidor()) {
  const { columnas, filas, W, H } = plano;
  const X = [0]; for (const w of columnas) X.push(X[X.length - 1] + w);
  const Y = [0]; for (const h of filas) Y.push(Y[Y.length - 1] + h);
  const partes = []; const recortes = []; let nRec = 0;
  const celdaEn = new Map(modelo.celdas.map((c) => [c.r + ',' + c.c, c]));
  // Combinadas: la esquina manda (texto, relleno); las de adentro no pintan texto.
  const comb = new Map(); const dentro = new Set(); const deCelda = new Map();
  for (const g of modelo.combinadas) {
    comb.set(g.r0 + ',' + g.c0, g);
    for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const k = r + ',' + c; if (!deCelda.has(k)) deCelda.set(k, g); if (r !== g.r0 || c !== g.c0) dentro.add(k); }
  }
  const rect = (r, c) => { const g = comb.get(r + ',' + c); return g ? { x: X[g.c0], y: Y[g.r0], w: X[g.c1 + 1] - X[g.c0], h: Y[g.r1 + 1] - Y[g.r0] } : { x: X[c], y: Y[r], w: columnas[c], h: filas[r] }; };
  const combinadaDe = (r, c) => deCelda.get(r + ',' + c) || null;

  // 1) Rellenos.
  for (const c of modelo.celdas) {
    if (dentro.has(c.r + ',' + c.c)) continue;
    const col = colorOk(c.relleno); if (!col) continue;
    const b = rect(c.r, c.c); if (b.w <= 0 || b.h <= 0) continue;
    partes.push('<rect x="' + n2(b.x) + '" y="' + n2(b.y) + '" width="' + n2(b.w) + '" height="' + n2(b.h) + '" fill="' + col + '"/>');
  }
  // 2) Bordes (en una combinada, solo los de su contorno).
  const linea = (x1, y1, x2, y2, l) => {
    const col = colorOk(l.color) || '#000000'; const g = Math.max(0.5, Math.min(3, +l.grueso || 1));
    const guiones = /dash/i.test(l.estilo || '') ? ' stroke-dasharray="4 2"' : /dot|hair/i.test(l.estilo || '') ? ' stroke-dasharray="1 2"' : '';
    partes.push('<line x1="' + n2(x1) + '" y1="' + n2(y1) + '" x2="' + n2(x2) + '" y2="' + n2(y2) + '" stroke="' + col + '" stroke-width="' + g + '"' + guiones + '/>');
  };
  for (const c of modelo.celdas) {
    const b = c.borde || {}; const x0 = X[c.c]; const x1 = X[c.c + 1]; const y0 = Y[c.r]; const y1 = Y[c.r + 1];
    if (x1 - x0 <= 0 || y1 - y0 <= 0) continue;
    const g = combinadaDe(c.r, c.c);
    if (b.t && (!g || c.r === g.r0)) linea(x0, y0, x1, y0, b.t);
    if (b.b && (!g || c.r === g.r1)) linea(x0, y1, x1, y1, b.b);
    if (b.l && (!g || c.c === g.c0)) linea(x0, y0, x0, y1, b.l);
    if (b.r && (!g || c.c === g.c1)) linea(x1, y0, x1, y1, b.r);
  }
  // 3) Textos (recortados a su celda; el que no envuelve se desborda a vecinas vacías).
  const conTexto = (r, c) => { const q = celdaEn.get(r + ',' + c); return !!(q && q.texto) || dentro.has(r + ',' + c) || comb.has(r + ',' + c); };
  for (const c of modelo.celdas) {
    if (!c.texto || dentro.has(c.r + ',' + c.c)) continue;
    const b = rect(c.r, c.c); if (b.w <= 0 || b.h <= 0) continue;
    const f = c.fuente || { sz: 11, nombre: 'Calibri' }; const tam = f.sz * PX_PT;
    const color = colorOk(f.color) || '#000000';
    const estilo = ' font-family="' + escXml(fuenteCss(f.nombre)) + '" font-size="' + n2(tam) + '"' + (f.b ? ' font-weight="700"' : '') + (f.i ? ' font-style="italic"' : '') + (f.u ? ' text-decoration="underline"' : '') + ' fill="' + color + '"';
    const id = 'r' + (nRec++);
    if (plano.vertical.has(c.r + ',' + c.c)) {
      // Fecha del calendario en vertical («13/07»), de abajo hacia arriba.
      const t = c.fecha ? String(c.fecha.getUTCDate()).padStart(2, '0') + '/' + String(c.fecha.getUTCMonth() + 1).padStart(2, '0') : String(c.texto).trim();
      recortes.push('<clipPath id="' + id + '"><rect x="' + n2(b.x) + '" y="' + n2(b.y) + '" width="' + n2(b.w) + '" height="' + n2(b.h) + '"/></clipPath>');
      const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
      partes.push('<g clip-path="url(#' + id + ')"><text x="' + n2(cx) + '" y="' + n2(cy) + '" transform="rotate(-90 ' + n2(cx) + ' ' + n2(cy) + ')" text-anchor="middle" dominant-baseline="central"' + estilo + '>' + escXml(t) + '</text></g>');
      continue;
    }
    const alH = c.h === 'center' || c.h === 'centerContinuous' ? 'center' : c.h === 'right' ? 'right' : (c.h === 'left' || c.h === 'justify' || c.h === 'fill' || c.h === 'distributed') ? 'left' : (c.esNumero ? 'right' : 'left');
    const alV = c.v === 'top' ? 'top' : (c.v === 'center' || c.v === 'justify' || c.v === 'distributed') ? 'center' : 'bottom';
    const pad = 3 + (c.sangria || 0) * 9;
    const lineas = c.envolver ? envolver(c.texto, Math.max(4, b.w - 6), f, medir) : String(c.texto).split(/\r?\n/).slice(0, 1);
    // Desborde de un texto sin envolver a las vecinas vacías (como Excel).
    let rx0 = b.x; let rx1 = b.x + b.w;
    if (!c.envolver && !c.rot && medir(lineas[0], f) + pad * 2 > b.w && !comb.has(c.r + ',' + c.c)) {
      if (alH !== 'right') for (let k = c.c + 1; k < columnas.length && !conTexto(c.r, k); k++) rx1 = X[k + 1];
      if (alH !== 'left') for (let k = c.c - 1; k >= 0 && !conTexto(c.r, k); k--) rx0 = X[k];
      if (alH === 'center') { const m = b.x + b.w / 2; const med = Math.min(m - rx0, rx1 - m); rx0 = m - med; rx1 = m + med; }
    }
    recortes.push('<clipPath id="' + id + '"><rect x="' + n2(rx0) + '" y="' + n2(b.y) + '" width="' + n2(rx1 - rx0) + '" height="' + n2(b.h) + '"/></clipPath>');
    const alto = tam * 1.2; const total = alto * lineas.length;
    const y0 = alV === 'top' ? b.y + 2 : alV === 'center' ? b.y + (b.h - total) / 2 : b.y + b.h - total - 2;
    const ancla = alH === 'center' ? 'middle' : alH === 'right' ? 'end' : 'start';
    const tx = alH === 'center' ? b.x + b.w / 2 : alH === 'right' ? b.x + b.w - pad : b.x + pad;
    const giro = c.rot && c.rot !== 255 ? (c.rot <= 90 ? -c.rot : c.rot - 90) : (c.rot === 255 ? -90 : 0);
    const tr = giro ? ' transform="rotate(' + giro + ' ' + n2(b.x + b.w / 2) + ' ' + n2(b.y + b.h / 2) + ')"' : '';
    const tsp = lineas.map((l, i) => '<tspan x="' + n2(giro ? b.x + b.w / 2 : tx) + '" y="' + n2(giro ? b.y + b.h / 2 + (i - (lineas.length - 1) / 2) * alto : y0 + alto * (i + 0.8)) + '">' + escXml(l) + '</tspan>').join('');
    partes.push('<g clip-path="url(#' + id + ')"><text text-anchor="' + (giro ? 'middle' : ancla) + '"' + (giro ? ' dominant-baseline="central"' : '') + estilo + tr + '>' + tsp + '</text></g>');
  }
  // 4) Dibujos encima: imágenes pegadas y formas sencillas (en px del modelo ORIGINAL → escalados a la geometría final).
  const mapX = (x) => { let acc = 0; let acc0 = 0; for (let c = 0; c < columnas.length; c++) { const w0 = modelo.columnas[c]; if (x <= acc0 + w0) return acc + (w0 ? (x - acc0) * columnas[c] / w0 : 0); acc0 += w0; acc += columnas[c]; } return acc + (x - acc0); };
  const mapY = (y) => { let acc = 0; let acc0 = 0; for (let r = 0; r < filas.length; r++) { const h0 = modelo.filas[r]; if (y <= acc0 + h0) return acc + (h0 ? (y - acc0) * filas[r] / h0 : 0); acc0 += h0; acc += filas[r]; } return acc + (y - acc0); };
  for (const g of modelo.formas || []) {
    const x0 = mapX(g.x); const y0 = mapY(g.y); const x1 = mapX(g.x + g.w); const y1 = mapY(g.y + g.h);
    const fill = colorOk(g.relleno); const ln = g.linea && colorOk(g.linea.color);
    const st = ' fill="' + (fill || 'none') + '"' + (ln ? ' stroke="' + ln + '" stroke-width="' + n2(Math.max(0.5, Math.min(6, g.linea.grueso || 1))) + '"' : '');
    if (/line|Connector/i.test(g.geom)) partes.push('<line x1="' + n2(x0) + '" y1="' + n2(y0) + '" x2="' + n2(x1) + '" y2="' + n2(y1) + '" stroke="' + (ln || '#000000') + '" stroke-width="' + n2(Math.max(0.5, Math.min(6, (g.linea && g.linea.grueso) || 1))) + '"/>');
    else if (g.geom === 'ellipse') partes.push('<ellipse cx="' + n2((x0 + x1) / 2) + '" cy="' + n2((y0 + y1) / 2) + '" rx="' + n2((x1 - x0) / 2) + '" ry="' + n2((y1 - y0) / 2) + '"' + st + '/>');
    else partes.push('<rect x="' + n2(x0) + '" y="' + n2(y0) + '" width="' + n2(x1 - x0) + '" height="' + n2(y1 - y0) + '"' + (g.geom === 'roundRect' ? ' rx="' + n2(Math.min(x1 - x0, y1 - y0) / 6) + '"' : '') + st + '/>');
    if (g.texto) partes.push('<text x="' + n2((x0 + x1) / 2) + '" y="' + n2((y0 + y1) / 2) + '" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="' + n2(11 * PX_PT) + '" fill="#000000">' + escXml(g.texto) + '</text>');
  }
  for (const g of modelo.imagenes || []) {
    if (!/^image\/(png|jpeg|gif)$/.test(g.mime) || !/^[A-Za-z0-9+/=]+$/.test(g.base64 || '')) continue;
    let x0 = mapX(g.x); let y0 = mapY(g.y); let w = mapX(g.x + g.w) - x0; let h = mapY(g.y + g.h) - y0;
    const prop = g.w / g.h;   // la proporción con que Excel la muestra
    if (w / h > prop + 1e-6) { const nw = h * prop; x0 += (w - nw) / 2; w = nw; } else if (w / h < prop - 1e-6) { const nh = w / prop; y0 += (h - nh) / 2; h = nh; }
    const rc = g.recorte || { l: 0, t: 0, r: 0, b: 0 };
    const vw = Math.max(0.01, 1 - rc.l - rc.r); const vh = Math.max(0.01, 1 - rc.t - rc.b);
    partes.push('<svg x="' + n2(x0) + '" y="' + n2(y0) + '" width="' + n2(w) + '" height="' + n2(h) + '" viewBox="' + n2(rc.l) + ' ' + n2(rc.t) + ' ' + n2(vw) + ' ' + n2(vh) + '" preserveAspectRatio="none">'
      + '<image x="0" y="0" width="1" height="1" preserveAspectRatio="none" href="data:' + g.mime + ';base64,' + g.base64 + '"/></svg>');
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n2(W) + ' ' + n2(H) + '">'
    + '<defs>' + recortes.join('') + '</defs><rect x="0" y="0" width="' + n2(W) + '" height="' + n2(H) + '" fill="#FFFFFF"/>' + partes.join('') + '</svg>';
  return { svg, w: W, h: H };
}

/**
 * Dibuja la hoja homologada como PNG (solo navegador). Resolución 2-4× el tamaño
 * con que va al marco, con techo de 12 Mpx.
 * @param {object} modelo  de leerHojaAdjunta
 * @param {{w:number,h:number}} caja  marco en px
 * @returns {Promise<{png:Uint8Array, ancho:number, alto:number, letraPrevista:number, compactado:boolean, plano:object}>}
 *   ancho/alto: tamaño con que se muestra dentro del marco (px)
 */
export async function dibujarHojaAdjunta(modelo, caja) {
  if (typeof document === 'undefined') throw new Error('El dibujo del Excel adjunto solo se hace en el navegador.');
  const medir = medidor();
  const plano = planoHomologado(modelo, caja, medir);
  const { svg, w, h } = svgDeHoja(modelo, plano, medir);
  const ancho = Math.round(w * plano.s); const alto = Math.round(h * plano.s);
  let k = Math.min(4, Math.max(2, 2 / plano.s));
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
  return { png, ancho, alto, letraPrevista: plano.letraPrevista, compactado: plano.compactado, plano };
}
