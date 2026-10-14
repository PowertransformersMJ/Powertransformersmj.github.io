// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · PAPEL (hojas carta del F60-ADM)
// ──────────────────────────────────────────────────────────────────────────────
// Dibuja el Documento (`domain/informe_brigada_documento.js`) en hojas carta de
// 612 × 792 pt, con el encabezado, el pie y la franja del formato Applus, y lo
// imprime desde la propia página («Imprimir / Guardar PDF»: Carta, márgenes
// Ninguno). La vista previa y la impresión son el MISMO dibujo.
//
// Es el motor de la maqueta aprobada, sin nada de la réplica del modelo:
//  · los bloques se miden en un «escenario» fuera de pantalla y un paginador los
//    reparte (párrafos partidos con al menos 2 renglones a cada lado; un título
//    nunca queda solo al pie de una hoja);
//  · las líneas de tablas y cuadrículas, las barras grises y las viñetas ⊞ van en
//    SVG para conservar sus 0,5 pt exactos;
//  · el difuminado blanco de las fotos se hace con capas de degradado encima de la
//    foto (no con lienzo: una foto del almacén «mancha» el lienzo, y la máscara CSS
//    imprime negro);
//  · logos, firmas y fotos salen de `urlDe(ref)`; si no hay, se ve un recuadro
//    «pendiente» (nunca una imagen inventada);
//  · TODO texto pasa por `escaparHTML`: un dato escrito por un usuario nunca entra
//    como HTML al papel.
// No toca nada al importarse (se puede probar en node).
// ══════════════════════════════════════════════════════════════════════════════

import { FORMATO, MARCA_GEOMETRIA, DISPOSICIONES } from '../../domain/informe_brigada_plantilla.js';
import { geometriaCuadricula, FIRMA_POSICION } from '../../domain/informe_brigada_documento.js';

const PT = (v) => `${+(+v).toFixed(3)}pt`;
const PX_POR_PT = 96 / 72;
const CUERPO = FORMATO.cuerpo;
const ESPERA_IMAGENES_MS = 15000;

/* ── texto seguro ─────────────────────────────────────────────────────────── */
/** Escapa un texto para el HTML del papel. TODO dato pasa por aquí. */
export function escaparHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const esc = escaparHTML;

/** Runs `{ t, b?, i?, mark?, esc?, sep?, falta? }` → HTML (el texto siempre escapado). */
export function htmlDeRuns(runs) {
  return (Array.isArray(runs) ? runs : []).map((r) => {
    if (!r) return '';
    let h = esc(r.t);
    if (!h) return '';
    const s = Number(r.esc);
    if (s > 0 && s < 1) {
      const sep = Number(r.sep);
      h = `<span class="ibr-esc" data-s="${s}"${sep > 0 ? ` style="letter-spacing:${sep}pt"` : ''}>${h}</span>`;
    }
    if (r.i) h = `<i>${h}</i>`;
    if (r.b) h = `<b>${h}</b>`;
    if (r.mark) h = `<mark class="ibr-mark">${h}</mark>`;
    if (r.falta) h = `<span class="ibr-falta">${h}</span>`;
    return h;
  }).join('');
}

/** Solo direcciones de imagen conocidas (https, blob o data de imagen); cualquier otra cosa = sin imagen. */
export function urlSegura(u) {
  const s = String(u == null ? '' : u).trim();
  return /^(https?:|blob:|data:image\/(png|jpe?g|gif|webp);)/i.test(s) ? s : null;
}

/* ── geometría de las cuadrículas de fotos (pura, en pt) ───────────────────── */
/**
 * Dónde va cada foto de una cuadrícula. Es la MISMA función que usa el Word
 * (`domain/informe_brigada_documento.js` · geometriaCuadricula): topes, sangrías del pie
 * y ajustes finos del modelo salen de un solo sitio.
 * @returns {{ x0, ancho, colW: number[], colX: number[], filas: { y, alto, fotos: { x, y, w, h }[] }[], alto, pie }}
 */
export function geometriaFotos(bloque) {
  return geometriaCuadricula(bloque);
}

/* ── piezas de DOM ────────────────────────────────────────────────────────── */
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}

// Convención de Word en el modelo: una regla de grosor t «en» la coordenada c ocupa [c, c+t].
const lineaH = (y, x0, x1, t, c = '#000') => [x0, y, x1 + t, y + t, c];
const lineaV = (x, y0, y1, t, c = '#000') => [x, y0, x + t, y1 + t, c];
const n3 = (v) => +(+v).toFixed(3);

/** Viñeta ⊞ naranja (cuadrado redondeado, interior blanco, cruz), dibujada en SVG: 20 × 21 unidades. */
function vinetaSVG(x, y, w, h) {
  const naranja = FORMATO.colores.iconoVineta;
  return `<g transform="translate(${n3(x)} ${n3(y)}) scale(${n3(w / 20)} ${n3(h / 21)})">`
    + `<rect width="20" height="21" rx="4.5" fill="${naranja}"/>`
    + '<rect x="4" y="4" width="12" height="14" rx="1.5" fill="#FFFFFF"/>'
    + `<rect x="8.5" y="5" width="3" height="11" fill="${naranja}"/>`
    + `<rect x="5" y="8.8" width="10" height="3.4" fill="${naranja}"/></g>`;
}

/** Capa SVG en coordenadas de la hoja (pt): rectángulos [x0, y0, x1, y1, color] y viñetas [x, y, w, h]. */
function capaSVG(rects, w, h, vinetas = []) {
  const r = rects.map(([x0, y0, x1, y1, c]) => `<rect x="${n3(x0)}" y="${n3(y0)}" width="${n3(x1 - x0)}" height="${n3(y1 - y0)}" fill="${c}"/>`).join('');
  const v = vinetas.map(([x, y, vw, vh]) => vinetaSVG(x, y, vw, vh)).join('');
  return `<svg class="ibr-capa" xmlns="http://www.w3.org/2000/svg" width="${PT(w)}" height="${PT(h)}" viewBox="0 0 ${n3(w)} ${n3(h)}" aria-hidden="true">${r}${v}</svg>`;
}

/** Imagen (o recuadro «pendiente») en una caja absoluta. */
function imagenOMarcador(ctx, ref, caja, { clase = '', alt = '', pendiente = 'Imagen pendiente', aviso = '' } = {}) {
  const url = ref ? urlSegura(safeUrlDe(ctx, ref)) : null;
  const pos = `left:${PT(caja.x)};top:${PT(caja.y)};width:${PT(caja.w)};height:${PT(caja.h)}`;
  if (url) return `<img class="${clase}" src="${esc(url)}" alt="${esc(alt)}" data-ref="${esc(ref)}" data-pendiente="${esc(pendiente)}" decoding="async" style="${pos}">`;
  if (aviso) ctx.avisos.add(aviso);
  return `<div class="${clase} ibr-pendiente" style="${pos}"><span>${esc(pendiente)}</span></div>`;
}
function safeUrlDe(ctx, ref) {
  try { return ctx.urlDe ? ctx.urlDe(ref) : null; } catch (_) { return null; }
}

/* ── hoja: encabezado, pie y marca de agua ────────────────────────────────── */
function logoMarca(ctx, ref) {
  const clave = String(ref || '').replace(/^marca:/, '');
  const g = MARCA_GEOMETRIA[clave];
  if (!g) return '';
  return imagenOMarcador(ctx, ref, g, {
    clase: 'ibr-logo',
    alt: g.corto,
    pendiente: g.corto + ' pendiente · lo sube un administrador',
    aviso: 'Falta el ' + g.nombre + ': lo sube un administrador.'
  });
}

function hojaNueva(ctx, nro) {
  const d = ctx.doc;
  const f = d.formato || {};
  const dir = (f.direcciones || []).map((x) => (x.b ? `<b>${esc(x.t)}</b>` : esc(x.t))).join('<br>')
    + `<br><span class="ibr-web">${esc(f.web || '')}</span>`;
  const agua = d.meta && d.meta.marcaAgua ? `<div class="ibr-agua" aria-hidden="true"><span>${esc(d.meta.marcaAgua)}</span></div>` : '';
  return el(`<section class="ibr-hoja" data-hoja="${nro}">
    <div class="ibr-enc-dir">${dir}</div>
    ${logoMarca(ctx, d.encabezado && d.encabezado.logo)}
    ${logoMarca(ctx, d.encabezado && d.encabezado.together)}
    <div class="ibr-pie-codigo">${esc(f.codigo || '')}</div>
    <div class="ibr-pie-num">${nro}</div>
    <div class="ibr-pie-franja"></div>
    ${agua}
  </section>`);
}

/* ── portada ──────────────────────────────────────────────────────────────── */
function portada(ctx, nro) {
  const p = ctx.doc.portada || {};
  const h = hojaNueva(ctx, nro);
  const agua = h.querySelector('.ibr-agua');
  const add = (html) => { const n = el(html); h.insertBefore(n, agua); return n; };
  // `max`: ancho disponible (pt). Un renglón más largo se comprime a lo ancho para no salirse del marco.
  const tx = (x, y, html, extra = '', max = 0) => add(`<div class="ibr-por-tx"${max ? ` data-max="${n3(max)}"` : ''} style="left:${PT(x)};top:${PT(y)};${extra}">${html}</div>`);
  const XL = 71.8; const XM = 321.6; const XR = 540.2;
  const R = [];
  const C = FORMATO.colores;
  R.push([XM + 0.5, 178.3, XR, 248.1, C.tituloPortada], [XM + 0.5, 406.1, XR, 416.9, C.bloquePortada],
    [XM + 0.5, 565.2, XR, 580.9, C.bloquePortada], [XM + 0.5, 581.4, XR, 706.2, C.bloquePortada]);
  [109.0, 564.7, 706.2].forEach((y) => R.push(lineaH(y, XL, XR, 0.5)));
  [177.8, 248.1, 405.6, 416.9, 580.9].forEach((y) => R.push(lineaH(y, XM, XR, 0.5)));
  [XL, XM, XR].forEach((x) => R.push(lineaV(x, 109.0, 706.2, 0.5)));
  add(capaSVG(R, 612, 792));
  const logos = p.logos || {};
  [logos.afinia, logos.applus, logos.together].forEach((ref) => { const html = logoMarca(ctx, ref); if (html) add(html); });

  // Título (centrado en la celda gris)
  const t = p.titulo || ['', '', ''];
  add(`<div class="ibr-por ibr-por-t" style="left:${PT(XM + 3.6)};top:192.6pt;width:${PT(XR - XM - 3.6)}">`
    + `${esc(t[0])}<div style="height:7.8pt"></div>${esc(t[1])}<br>${esc(t[2])}</div>`);
  // Índice (líneas base del modelo: Word alterna 12,0 y 12,25 pt)
  const altos = [0, 12.02, 24.27, 36.27, 48.52, 60.52, 72.77, 84.79];
  add(`<div class="ibr-por-indice">${(p.indice || []).map((r, k) => `<div class="${r.nivel === 2 ? 'ibr-n2' : ''}" style="top:${PT(altos[k] != null ? altos[k] : 12.1 * k)}"><span class="ibr-ni">${esc(r.numero)}</span><span>${esc(r.texto)}</span></div>`).join('')}</div>`);
  // Anexos
  add(`<div class="ibr-por ibr-por-t" style="left:${PT(XM)};top:405.45pt;width:${PT(XR - XM - 0.7)}">${esc(p.anexosTitulo || 'ANEXOS')}</div>`);
  add(`<div class="ibr-por ibr-por-t" style="left:${PT(XM)};top:427.25pt;width:${PT(XR - XM - 2.4)}">${esc(p.anexosSubtitulo || '')}</div>`);
  const VIN = [];
  (p.anexos || []).forEach((a, k) => {
    const y = 442.6 + 10 * k;
    VIN.push([327.5, y + 1.15, 6.75, 7.0]);
    add(`<div class="ibr-por ibr-por-anx" data-max="${n3(XR - 343.6 - 2)}" style="left:343.6pt;top:${PT(y + 1.0)}">${esc(a)}</div>`);
  });
  // Cliente, asunto y datos del equipo
  tx(325.4, 567.1, esc(p.cliente || ''), '', XR - 325.4 - 2);
  const datos = p.datos || [];
  if (datos[0]) tx(325.4, 581.5, htmlDeRuns(datos[0]), 'font-size:10pt;line-height:11.5pt', XR - 325.4 - 2);
  datos.slice(1).forEach((runs, k) => {
    const y = 604.4 + 11.45 * k;
    VIN.push([323.5, y + 1.1, 7.75, 8.0]);
    tx(341.6, y - 0.2, htmlDeRuns(runs), 'font-size:10pt;line-height:11.5pt', XR - 341.6 - 2);
  });
  // Firmas: rótulo, casilla «Fecha / Firma:» y nombre en MAYÚSCULAS. La firma (imagen) SOLO llega en un emitido.
  const filas = [[571.1, 585.4, 75.5], [611.4, 625.9, 74.5], [658.9, 673.4, 74.5]];
  (p.firmas || []).slice(0, 3).forEach((f, k) => {
    const [y1, y2, xn] = filas[k];
    tx(75.5, y1, esc(f.rotulo));
    tx(192.6, y1, esc(f.casilla));
    tx(xn, y2 - 0.4, esc(f.nombre), '', XM - xn - 3);
    if (f.fecha) tx(FIRMA_POSICION.xFecha, y1, esc(f.fecha), 'font-weight:400');
    if (f.firmaRef) {
      const url = urlSegura(safeUrlDe(ctx, f.firmaRef));
      const tam = f.firmaTamPt || { ancho: 60, alto: 22 };
      if (url) {
        add(`<img class="ibr-firma" src="${esc(url)}" alt="Firma" data-ref="${esc(f.firmaRef)}" data-pendiente="Firma no disponible" style="left:${PT(FIRMA_POSICION.xFirma)};top:${PT(y1 + FIRMA_POSICION.dyFirma)};width:${PT(tam.ancho)};height:${PT(tam.alto)}">`);
      } else ctx.avisos.add('No se pudo leer una firma del almacenamiento: la línea «' + f.rotulo + '» sale sin firma.');
    }
  });
  add(capaSVG([], 612, 792, VIN));
  return h;
}

/* ── bloques del cuerpo ───────────────────────────────────────────────────── */
function tablaGeom(ctx, geom, filas) {
  const xs = [geom.x0];
  geom.cols.forEach((w, c) => xs.push(xs[c] + w));
  const n = geom.cols.length;
  const ys = [0]; const celdas = []; const R = []; const F = [];
  const dy = geom.dy || 0; const dx = geom.dx || 0; const fuente = geom.fuente === 't11' ? 'ibr-t11' : 'ibr-t10';
  filas.forEach((f) => {
    const y0 = ys[ys.length - 1];
    let alto = f.alto;
    let c = 0;
    const cs = [];
    (f.celdas || []).forEach((cd) => {
      const span = Math.max(1, Math.min(cd.span || 1, n - c));
      const a = xs[c]; const b = xs[c + span];
      if (a == null || b == null) return;
      const rot = cd.estilo === 'rotulo';
      const cls = ['ibr-tcel', fuente, rot ? 'ibr-rot' : '', cd.estilo === 'negrita' ? 'ibr-neg' : '', cd.envolver ? 'ibr-envolver' : ''].filter(Boolean).join(' ');
      let left = rot ? a + 6.0 : a + dx; let w = rot ? b - a - 7 : b - a;
      if (cd.envolver) { left += 2; w -= 4; }
      const html = htmlDeRuns(cd.runs);
      if (cd.envolver && html) {
        const hm = medirHTML(ctx, `<div class="${cls}" style="position:absolute;width:${PT(w)}">${html}</div>`);
        if (hm > 13) alto = Math.max(alto, hm + dy + 1.5); // solo crece si el texto ocupa más de un renglón
      }
      if (cd.fondo && /^#[0-9A-Fa-f]{6}$/.test(cd.fondo)) F.push({ a, b, color: cd.fondo });
      cs.push({ html, cls, left, w, c, span });
      c += span;
    });
    cs.forEach((x) => celdas.push(`<div class="${x.cls}" style="left:${PT(x.left)};top:${PT(y0 + dy)};width:${PT(x.w)}">${x.html}</div>`));
    F.filter((x) => x.y0 == null).forEach((x) => { x.y0 = y0; x.y1 = y0 + alto; });
    const bordesV = new Set([0, n]);
    cs.forEach((x) => { bordesV.add(x.c); bordesV.add(x.c + x.span); });
    bordesV.forEach((k) => R.push(lineaV(xs[k], y0, y0 + alto, (k === 0 || k === n) ? geom.bExt : geom.bV)));
    ys.push(y0 + alto);
  });
  ys.forEach((y, k) => R.push(lineaH(y, xs[0], xs[n], (k === 0 || k === ys.length - 1) ? geom.bExt : geom.bH)));
  const fondos = F.map((x) => [x.a, x.y0, x.b, x.y1, x.color]);
  const alto = ys[ys.length - 1];
  return { html: `<div class="ibr-blq ibr-tabla" style="left:0;width:612pt;height:${PT(alto)}">${capaSVG(fondos.concat(R), 612, alto)}${celdas.join('')}</div>`, alto };
}

function cuadricula(ctx, b) {
  const d = DISPOSICIONES[b.disposicion];
  const G = geometriaFotos(b);
  const partes = []; const R = [];
  const lnH = (y, a, z) => R.push(lineaH(y, a, z, 0.5));
  const lnV = (x, a, z) => R.push(lineaV(x, a, z, 0.5));
  const cols = G.colW.length;
  const fotos = d.unaFigura ? ((b.figuras[0] && b.figuras[0].fotos) || []) : b.figuras.map((f) => (f.fotos || [])[0]);
  lnH(0, G.colX[0], G.colX[cols]);
  G.filas.forEach((fila, r) => {
    fila.fotos.forEach((caja, c) => {
      const f = fotos[r * cols + c] || {};
      const url = f.ref ? urlSegura(safeUrlDe(ctx, f.ref)) : null;
      const pos = `left:${PT(caja.x)};top:${PT(caja.y)};width:${PT(caja.w)};height:${PT(caja.h)}`;
      if (url) {
        const marcas = (f.marcas || []).map((m) => `<div class="ibr-ovalo" style="left:${PT(m.x * caja.w)};top:${PT(m.y * caja.h)};width:${PT(m.w * caja.w)};height:${PT(m.h * caja.h)}"></div>`).join('');
        partes.push(`<div class="ibr-foto" style="${pos}"><img src="${esc(url)}" alt="" data-ref="${esc(f.ref)}" data-pendiente="No se pudo leer la foto" decoding="async">`
          + '<div class="ibr-dif ibr-dif-l"></div><div class="ibr-dif ibr-dif-r"></div><div class="ibr-dif ibr-dif-t"></div><div class="ibr-dif ibr-dif-b"></div>'
          + `${marcas}</div>`);
      } else {
        ctx.fotosPendientes += 1;
        partes.push(`<div class="ibr-foto ibr-pendiente" style="${pos}"><span>${f.ref ? 'No se pudo leer la foto' : 'Foto pendiente'}</span></div>`);
      }
    });
    for (let c = 0; c <= cols; c++) lnV(G.colX[c], fila.y, fila.y + fila.alto);
    lnH(fila.y + fila.alto, G.colX[0], G.colX[cols]);
  });
  // Fila de pies (alto, distancia y sangría del pie: los del modelo para esta cuadrícula)
  let y = G.alto;
  let hp = G.pie.alto;
  if (d.unaFigura) {
    const f = b.figuras[0] || { runs: [] };
    partes.push(`<div class="ibr-pie-fig ibr-centro" style="left:${PT(G.colX[0])};top:${PT(y + 0.6)};width:${PT(G.ancho)}">${htmlDeRuns(f.runs)}</div>`);
    lnV(G.colX[0], y, y + hp); lnV(G.colX[cols], y, y + hp);
  } else {
    const textos = b.figuras.map((f, c) => {
      const html = htmlDeRuns(f.runs);
      const w = G.colW[c] - 10.4 - G.pie.sangria;
      const m = medirHTML(ctx, `<div class="ibr-pie-fig" style="position:absolute;width:${PT(w)}">${html}</div>`);
      hp = Math.max(hp, m + 0.45); // pie de 2 renglones: 2 × 11,4 + 0,45 = 23,25 pt (medido en el modelo)
      return { html, w, c };
    });
    textos.forEach(({ html, w, c }) => partes.push(`<div class="ibr-pie-fig" style="left:${PT(G.colX[c] + 5.5 + G.pie.sangria)};top:${PT(y + G.pie.dy)};width:${PT(w)}">${html}</div>`));
    for (let c = 0; c <= cols; c++) lnV(G.colX[c], y, y + hp);
  }
  y += hp;
  lnH(y, G.colX[0], G.colX[cols]);
  return { html: `<div class="ibr-blq ibr-cuad" style="height:${PT(y)}">${capaSVG(R, 612, y)}${partes.join('')}</div>`, alto: y };
}

function anexoImagen(ctx, b) {
  const w = b.anchoPt || CUERPO.ancho;
  const h = b.ancho > 0 && b.alto > 0 ? w * b.alto / b.ancho : w * 0.75;
  const x = b.anchoPt ? 85.1 + (CUERPO.ancho - w) / 2 : 85.1;
  const caja = { x: 0, y: 0, w, h };
  const inner = imagenOMarcador(ctx, b.ref, caja, {
    clase: 'ibr-anx-foto',
    pendiente: b.ref ? 'No se pudo leer la imagen del anexo' : 'Imagen del anexo pendiente',
    aviso: b.ref ? '' : 'Falta una imagen de los anexos.'
  });
  return { html: `<div class="ibr-blq ibr-anx-img" style="left:${PT(x)};width:${PT(w)};height:${PT(h)}">${inner}</div>`, alto: h };
}

function bloqueDOM(ctx, b) {
  const base = { antes: Number(b.antes) || 0, antesEnTope: !!b.antesEnTope, saltoAntes: !!b.saltoAntes, conSiguiente: !!b.conSiguiente, tipo: b.tipo };
  if (b.tipo === 'titulo') {
    const cls = b.estilo === 'barra' ? 'ibr-h ibr-barra'
      : b.estilo === 'manual' ? 'ibr-h ibr-barra ibr-manual'
        : b.estilo === 'plano' ? 'ibr-h ibr-plano'
          : b.nivel === 3 ? 'ibr-h ibr-n3' : 'ibr-h';
    const contenido = b.estilo === 'manual' || b.estilo === 'plano'
      ? esc(b.numero + ' ' + b.texto)
      : `<span class="ibr-n">${esc(b.numero)}</span>${esc(b.texto)}`;
    return { ...base, el: el(`<div class="ibr-blq ${cls}">${contenido}</div>`) };
  }
  if (b.tipo === 'parrafo') return { ...base, el: el(`<div class="ibr-blq ibr-p">${htmlDeRuns(b.runs)}</div>`), partir: partirTexto, lh: 12.455 };
  if (b.tipo === 'vineta') return { ...base, el: el(`<div class="ibr-blq ibr-vin ibr-icono">${htmlDeRuns(b.runs)}</div>`), partir: partirTexto, lh: 11.3 };
  if (b.tipo === 'tabla') { const t = tablaGeom(ctx, b.geom, b.filas || []); return { ...base, el: el(t.html), alto: t.alto }; }
  if (b.tipo === 'pieTabla') return { ...base, el: el(`<div class="ibr-blq ibr-pie-tabla">${esc(b.texto)}</div>`), conAnterior: true };
  if (b.tipo === 'etiqueta') return { ...base, el: el(`<div class="ibr-blq ibr-etq">${esc(b.texto)}</div>`) };
  if (b.tipo === 'cuadricula') { const g = cuadricula(ctx, b); return { ...base, el: el(g.html), alto: g.alto }; }
  if (b.tipo === 'anexoTitulo') return { ...base, el: el(`<div class="ibr-blq ibr-anx-tit">${esc(b.texto)}</div>`) };
  if (b.tipo === 'anexoImagen') { const a = anexoImagen(ctx, b); return { ...base, el: el(a.html), alto: a.alto }; }
  return null;
}

/* ── medición y partición de texto ────────────────────────────────────────── */
function medirAlto(ctx, nodo) {
  ctx.medidor.appendChild(nodo);
  const h = nodo.getBoundingClientRect().height / PX_POR_PT;
  ctx.medidor.removeChild(nodo);
  return h;
}
function medirHTML(ctx, html) { return medirAlto(ctx, el(html)); }

/** Parte un párrafo o viñeta en el último renglón que cabe (≥ 2 renglones a cada lado: sin viudas ni huérfanas). */
function partirTexto(ctx, b, disp) {
  const m = ctx.medidor;
  const n = b.el.cloneNode(true);
  m.appendChild(n);
  const lhPx = b.lh * PX_POR_PT;
  const top0 = n.getBoundingClientRect().top;
  const total = Math.round(n.getBoundingClientRect().height / lhPx);
  const caben = Math.floor((disp + 0.4) / b.lh);
  const corte = Math.min(caben, total - 2);
  if (total < 4 || corte < 2) { m.removeChild(n); return null; }
  const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
  const textos = [];
  while (walker.nextNode()) textos.push(walker.currentNode);
  const palabras = [];
  textos.forEach((t) => {
    const frag = document.createDocumentFragment();
    t.nodeValue.split(/(\s+)/).forEach((s) => {
      if (!s) return;
      if (/^\s+$/.test(s)) frag.appendChild(document.createTextNode(s));
      else { const sp = document.createElement('span'); sp.className = 'ibr-w'; sp.textContent = s; frag.appendChild(sp); palabras.push(sp); }
    });
    t.parentNode.replaceChild(frag, t);
  });
  const primera = palabras.find((p) => Math.round((p.getBoundingClientRect().top - top0) / lhPx) >= corte);
  if (!primera) { m.removeChild(n); return null; }
  const r = document.createRange();
  r.setStart(n, 0); r.setEndBefore(primera);
  const a = n.cloneNode(false);
  a.appendChild(r.extractContents());
  const desenvolver = (x) => x.querySelectorAll('span.ibr-w').forEach((s) => s.replaceWith(document.createTextNode(s.textContent)));
  desenvolver(a); desenvolver(n);
  a.normalize(); n.normalize();
  m.removeChild(n);
  a.classList.add('ibr-cont');
  n.classList.remove('ibr-icono');
  return [{ ...b, el: a, partir: null, alto: undefined }, { ...b, el: n, antes: 0, saltoAntes: false, antesEnTope: false, alto: undefined }];
}

/* Último renglón de cada párrafo con el espacio natural (Word solo comprime los renglones justificados).
   Si al ensancharse el renglón se partiera, se deja como estaba (nunca cambia un corte). */
function naturalizarUltimos(raiz) {
  raiz.querySelectorAll('.ibr-hoja .ibr-p:not(.ibr-cont), .ibr-hoja .ibr-vin:not(.ibr-cont)').forEach((n) => {
    const copia = n.cloneNode(true);
    const h0 = n.getBoundingClientRect().height;
    const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    const textos = [];
    while (walker.nextNode()) textos.push(walker.currentNode);
    const palabras = [];
    textos.forEach((t) => {
      const frag = document.createDocumentFragment();
      t.nodeValue.split(/([  ]+)/).forEach((x) => {
        if (!x) return;
        if (/^[  ]+$/.test(x)) frag.appendChild(document.createTextNode(x));
        else { const sp = document.createElement('span'); sp.className = 'ibr-w'; sp.textContent = x; frag.appendChild(sp); palabras.push(sp); }
      });
      t.parentNode.replaceChild(frag, t);
    });
    if (!palabras.length) { n.replaceWith(copia); return; }
    const yUlt = palabras[palabras.length - 1].getBoundingClientRect().top;
    const primera = palabras.find((p) => Math.abs(p.getBoundingClientRect().top - yUlt) < 3);
    const r = document.createRange();
    r.setStartBefore(primera); r.setEnd(n, n.childNodes.length);
    const ult = document.createElement('span');
    ult.className = 'ibr-ult';
    ult.appendChild(r.extractContents());
    n.appendChild(ult);
    n.querySelectorAll('span.ibr-w').forEach((x) => x.replaceWith(document.createTextNode(x.textContent)));
    n.normalize();
    if (Math.abs(n.getBoundingClientRect().height - h0) > 1) n.replaceWith(copia);
  });
}

/** Escala horizontal de texto «comprimido» (portada y Tabla 1), como lo trae el modelo. */
function aplicarEscalas(raiz) {
  raiz.querySelectorAll('.ibr-esc[data-s]').forEach((x) => {
    const s = +x.dataset.s;
    const w = x.getBoundingClientRect().width;
    x.style.transform = `scaleX(${s})`;
    x.style.marginRight = `${-(1 - s) * w}px`;
  });
}

/** Renglones de la portada que no caben en su celda: se comprimen a lo ancho (como hace Word), nunca se salen del marco. */
function ajustarAnchos(raiz) {
  raiz.querySelectorAll('[data-max]').forEach((x) => {
    const max = parseFloat(x.dataset.max) * PX_POR_PT;
    const w = x.getBoundingClientRect().width;
    if (max > 0 && w > max) {
      x.style.transformOrigin = '0 50%';
      x.style.transform = `scaleX(${+(max / w).toFixed(4)})`;
    }
  });
}

/** Capa vectorial de cada hoja: barras grises de título y viñetas ⊞ con sus medidas exactas. */
function capaDeHoja(hoja) {
  const G = FORMATO.colores.barraTitulo;
  const R = []; const V = [];
  const y = (n) => parseFloat(n.style.top);
  hoja.querySelectorAll(':scope > .ibr-h.ibr-barra').forEach((n) => R.push([101.55, y(n), 528.73, y(n) + (n.classList.contains('ibr-manual') ? 12.75 : 12.5), G]));
  hoja.querySelectorAll(':scope > .ibr-vin.ibr-icono').forEach((n) => V.push([85.0, y(n) + 1.1, 7.75, 8.0]));
  if (R.length || V.length) hoja.insertBefore(el(capaSVG(R, 612, 792, V)), hoja.firstChild);
}

/* ── paginador ────────────────────────────────────────────────────────────── */
function paginar(ctx, bloques, nroInicial, hojas) {
  const EPS = 0.6;
  let nro = nroInicial;
  let hoja = hojaNueva(ctx, nro); hojas.push(hoja);
  let y = CUERPO.arriba; let enTope = true;
  const nueva = () => { nro += 1; hoja = hojaNueva(ctx, nro); hojas.push(hoja); y = CUERPO.arriba; enTope = true; };
  const altoDe = (b) => (b.alto != null ? b.alto : (b.alto = medirAlto(ctx, b.el)));
  const colocar = (nodo, top) => {
    nodo.style.top = PT(top);
    const agua = hoja.querySelector(':scope > .ibr-agua');
    hoja.insertBefore(nodo, agua);
  };
  for (let k = 0; k < bloques.length; k++) {
    const b = bloques[k];
    if (b.saltoAntes && !enTope) nueva();
    const h = altoDe(b);
    let gap = (enTope && !b.antesEnTope) ? 0 : b.antes;
    // «mantener con el siguiente»: el bloque solo se queda si también cabe el comienzo del siguiente.
    // Una tabla se queda con su pie (Tabla N …).
    const s = bloques[k + 1];
    const atado = b.conSiguiente || (s && s.conAnterior);
    let extra = 0;
    if (atado && s) { const hs = altoDe(s); extra = s.antes + (s.partir ? Math.min(hs, 2 * s.lh) : hs); }
    if (!enTope && y + gap + h + extra > CUERPO.abajo + EPS) {
      if (b.partir && !atado) {
        const r = b.partir(ctx, b, CUERPO.abajo - (y + gap));
        if (r) { colocar(r[0].el, y + gap); bloques.splice(k + 1, 0, r[1]); nueva(); continue; }
      }
      nueva();
      gap = b.antesEnTope ? b.antes : 0;
    }
    if (enTope && y + gap + h > CUERPO.abajo + EPS) ctx.avisos.add('Un bloque es más alto que una hoja y se corta al imprimir (revise fotos o tablas muy largas).');
    colocar(b.el, y + gap);
    y = y + gap + h; enTope = false;
  }
  return nro;
}

/* ── imágenes ─────────────────────────────────────────────────────────────── */
function marcarFallida(img, alAviso) {
  const pend = img.getAttribute('data-pendiente') || 'Imagen no disponible';
  const caja = document.createElement('div');
  caja.className = (img.className ? img.className + ' ' : '') + 'ibr-pendiente';
  caja.setAttribute('style', img.getAttribute('style') || '');
  if (img.parentElement && img.parentElement.classList.contains('ibr-foto')) {
    caja.className = 'ibr-pendiente ibr-foto-falla';
    caja.setAttribute('style', 'left:0;top:0;width:100%;height:100%');
  }
  const sp = document.createElement('span');
  sp.textContent = pend;
  caja.appendChild(sp);
  img.replaceWith(caja);
  if (alAviso) { try { alAviso(pend); } catch (_) { /* el aviso es opcional */ } }
}
function vigilarImagenes(raiz, alAviso) {
  raiz.querySelectorAll('img[data-ref]').forEach((img) => {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) marcarFallida(img, alAviso);
    else img.addEventListener('error', () => marcarFallida(img, alAviso), { once: true });
  });
}
/** Espera a que carguen (o fallen) todas las imágenes, con tope de tiempo. */
export function esperarImagenes(raiz, ms = ESPERA_IMAGENES_MS) {
  const imgs = [...raiz.querySelectorAll('img')];
  const una = (img) => (img.complete ? Promise.resolve() : new Promise((ok) => {
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', ok, { once: true });
  }));
  return Promise.race([Promise.all(imgs.map(una)), new Promise((ok) => setTimeout(ok, ms))]);
}

/* ── API ──────────────────────────────────────────────────────────────────── */
/**
 * ¿Están las fuentes del formato en este computador? (Arial Narrow, Tahoma, Arial).
 * Compara el ancho de un texto con la fuente pedida contra el de las genéricas.
 */
export function fuentesDisponibles() {
  const out = { arialNarrow: false, tahoma: false, arial: false };
  try {
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    const prueba = 'mmmmmmmmmmlliWWQ@#ÁÑ 0123456789';
    const ancho = (f) => { g.font = '72px ' + f; return g.measureText(prueba).width; };
    const hay = (nombre) => ['monospace', 'serif', 'sans-serif'].some((gen) => ancho(`"${nombre}", ${gen}`) !== ancho(gen));
    out.arialNarrow = hay('Arial Narrow');
    out.tahoma = hay('Tahoma');
    out.arial = hay('Arial');
  } catch (_) { /* sin lienzo: se informa como no disponible */ }
  return out;
}

/**
 * Dibuja el documento en hojas carta dentro de `contenedor` (lo vacía).
 * @param {HTMLElement} contenedor
 * @param {object} documento  salida de `construirDocumento`
 * @param {(ref: string) => string|null} urlDe  dirección de cada imagen (null = recuadro «pendiente»)
 * @param {{ alAviso?: (texto: string) => void }} [opciones]  avisos que llegan después (una imagen que no carga)
 * @returns {Promise<{ hojas: number, avisos: string[] }>}
 */
export async function renderizarPapel(contenedor, documento, urlDe, opciones = {}) {
  if (!contenedor) throw new Error('Falta el contenedor del papel.');
  if (!documento || !Array.isArray(documento.bloques)) throw new Error('El documento del informe no es válido.');
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) { /* sigue con lo que haya */ }
  // Escenario fuera de pantalla: aquí se mide y se reparte (funciona aunque la vista esté oculta).
  const escenario = document.createElement('div');
  escenario.className = 'ibr-papel ibr-escenario';
  escenario.setAttribute('aria-hidden', 'true');
  const medidor = document.createElement('div');
  medidor.className = 'ibr-medidor';
  escenario.appendChild(medidor);
  document.body.appendChild(escenario);
  const ctx = { doc: documento, urlDe, avisos: new Set(), medidor, fotosPendientes: 0 };
  try {
    const hojas = [portada(ctx, 1)];
    hojas.forEach((h) => escenario.appendChild(h));
    const bloques = documento.bloques.map((b) => bloqueDOM(ctx, b)).filter(Boolean);
    const resto = [];
    paginar(ctx, bloques, 2, resto);
    resto.forEach((h) => { escenario.appendChild(h); hojas.push(h); });
    resto.forEach(capaDeHoja);
    aplicarEscalas(escenario);
    ajustarAnchos(escenario);
    naturalizarUltimos(escenario);
    if (ctx.fotosPendientes) ctx.avisos.add(ctx.fotosPendientes === 1 ? 'Falta 1 foto.' : 'Faltan ' + ctx.fotosPendientes + ' fotos.');
    // A su sitio
    contenedor.textContent = '';
    const papel = document.createElement('div');
    papel.className = 'ibr-papel';
    hojas.forEach((h) => papel.appendChild(h));
    contenedor.appendChild(papel);
    vigilarImagenes(papel, opciones && opciones.alAviso);
    return { hojas: hojas.length, avisos: [...ctx.avisos] };
  } finally {
    escenario.remove();
  }
}

let limpiezaActual = null;
function limpiarImpresion() {
  if (limpiezaActual) { const f = limpiezaActual; limpiezaActual = null; f(); }
  const viejo = document.getElementById('ibrImpresion');
  if (viejo) viejo.remove();
}
function entrarEnImpresion(cont, titulo) {
  const raiz = document.documentElement;
  const tituloPrevio = document.title;
  raiz.classList.add('ibr-imprimiendo');
  if (titulo) document.title = titulo;
  let hecho = false;
  const limpiar = () => {
    if (hecho) return;
    hecho = true;
    raiz.classList.remove('ibr-imprimiendo');
    document.title = tituloPrevio;
    cont.remove();
    window.removeEventListener('afterprint', limpiar);
    window.removeEventListener('pointerdown', limpiar);
    if (limpiezaActual === limpiar) limpiezaActual = null;
  };
  window.addEventListener('afterprint', limpiar);
  // Respaldo: si el navegador no avisa al cerrar el diálogo, el primer toque devuelve la página.
  window.addEventListener('pointerdown', limpiar, { once: true });
  limpiezaActual = limpiar;
  return limpiar;
}

/**
 * Imprime el documento desde esta misma página (Guardar como PDF · Carta · Márgenes: Ninguno).
 * El nombre del archivo sale del título: «INFORME <matrícula con _>».
 * @returns {Promise<{ hojas: number, avisos: string[] }>}
 */
export async function imprimirPapel(documento, urlDe, { titulo } = {}) {
  limpiarImpresion();
  const cont = document.createElement('div');
  cont.id = 'ibrImpresion';
  document.body.appendChild(cont);
  let r;
  try {
    r = await renderizarPapel(cont, documento, urlDe);
    await esperarImagenes(cont, ESPERA_IMAGENES_MS);
  } catch (err) {
    cont.remove();
    throw err;
  }
  entrarEnImpresion(cont, titulo || (documento.meta && documento.meta.titulo) || 'INFORME');
  window.print();
  return r;
}

/**
 * Para Cmd + P sin pasar por el botón: copia, de forma sincrónica, las hojas ya dibujadas
 * en la vista y deja la página lista para imprimirlas (se llama en «beforeprint»).
 * Sin hojas dibujadas no hace nada (se imprime la pantalla tal cual).
 * @returns {() => void} función que deshace la preparación
 */
export function prepararImpresionRapida(contenedorVista, titulo) {
  if (document.documentElement.classList.contains('ibr-imprimiendo')) return () => {};
  const hojas = contenedorVista ? contenedorVista.querySelectorAll('.ibr-hoja') : [];
  if (!hojas.length) return () => {};
  limpiarImpresion();
  const cont = document.createElement('div');
  cont.id = 'ibrImpresion';
  const papel = document.createElement('div');
  papel.className = 'ibr-papel';
  hojas.forEach((h) => papel.appendChild(h.cloneNode(true)));
  cont.appendChild(papel);
  document.body.appendChild(cont);
  return entrarEnImpresion(cont, titulo);
}

/**
 * Conecta Cmd + P: en «beforeprint» prepara la impresión con lo que diga `obtener()`
 * (`{ contenedor, titulo }` o null). Devuelve la función que la desconecta.
 */
export function activarImpresionRapida(obtener) {
  const antes = () => {
    try {
      const o = obtener && obtener();
      if (o && o.contenedor) prepararImpresionRapida(o.contenedor, o.titulo);
    } catch (_) { /* si falla, se imprime la pantalla tal cual */ }
  };
  window.addEventListener('beforeprint', antes);
  return () => window.removeEventListener('beforeprint', antes);
}
