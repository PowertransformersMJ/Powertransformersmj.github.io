// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — PNG simple (RGBA sin compresión) · dominio puro
// ──────────────────────────────────────────────────────────────────────────────
// El Word del informe necesita unas pocas imágenes que NO son datos de nadie y
// que se pueden dibujar con código: la franja naranja del pie, el recuadro del
// número de página, la viñeta ⊞ y el marcador de «logo pendiente». Se arman aquí
// como PNG válidos (zlib con bloques «stored» + Adler-32), sin lienzo ni red, para
// que el repositorio no lleve ni una imagen (repo público, guardia de imágenes).
// ══════════════════════════════════════════════════════════════════════════════

import { crc32, aBytes } from './zip_almacenado.js';

const FIRMA_PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

function adler32(b) {
  let a = 1, s = 0;
  const MOD = 65521;
  for (let i = 0; i < b.length; i++) {
    a += b[i]; if (a >= MOD) a -= MOD;
    s += a; s %= MOD;
  }
  return ((s << 16) | a) >>> 0;
}

/** zlib con bloques «stored» (sin compresión, cada bloque ≤ 65 535 bytes). */
function zlibAlmacenado(datos) {
  const BLOQUE = 65535;
  const nBloques = Math.max(1, Math.ceil(datos.length / BLOQUE));
  const salida = new Uint8Array(2 + datos.length + nBloques * 5 + 4);
  let p = 0;
  salida[p++] = 0x78; salida[p++] = 0x01;             // CMF/FLG: deflate, ventana 32 K, sin diccionario
  for (let k = 0; k < nBloques; k++) {
    const ini = k * BLOQUE;
    const trozo = datos.subarray(ini, Math.min(datos.length, ini + BLOQUE));
    salida[p++] = k === nBloques - 1 ? 1 : 0;           // BFINAL + BTYPE 00
    salida[p++] = trozo.length & 0xFF; salida[p++] = trozo.length >>> 8;
    const neg = (~trozo.length) & 0xFFFF;
    salida[p++] = neg & 0xFF; salida[p++] = neg >>> 8;
    salida.set(trozo, p); p += trozo.length;
  }
  const ad = adler32(datos);
  salida[p++] = ad >>> 24; salida[p++] = (ad >>> 16) & 0xFF; salida[p++] = (ad >>> 8) & 0xFF; salida[p++] = ad & 0xFF;
  return salida.subarray(0, p);
}

function bloque(tipo, datos) {
  const t = aBytes(tipo);
  const d = datos || new Uint8Array(0);
  const b = new Uint8Array(12 + d.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, d.length);
  b.set(t, 4);
  b.set(d, 8);
  v.setUint32(8 + d.length, crc32(d, crc32(t)));
  return b;
}

/**
 * PNG RGBA de 8 bits, sin entrelazado.
 * @param {number} ancho  px
 * @param {number} alto   px
 * @param {Uint8Array} rgba  ancho × alto × 4 bytes
 * @returns {Uint8Array}
 */
export function pngRGBA(ancho, alto, rgba) {
  const w = Math.trunc(ancho), h = Math.trunc(alto);
  if (!(w >= 1 && h >= 1 && w <= 8192 && h <= 8192)) throw new RangeError('pngRGBA: medidas fuera de rango.');
  if (!(rgba instanceof Uint8Array) || rgba.length !== w * h * 4) throw new RangeError('pngRGBA: se esperaban ancho × alto × 4 bytes.');
  const fila = w * 4;
  const crudo = new Uint8Array(h * (fila + 1));
  for (let y = 0; y < h; y++) {
    crudo[y * (fila + 1)] = 0;                          // filtro «ninguno»
    crudo.set(rgba.subarray(y * fila, (y + 1) * fila), y * (fila + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const vi = new DataView(ihdr.buffer);
  vi.setUint32(0, w); vi.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 bits, RGBA
  const partes = [Uint8Array.from(FIRMA_PNG), bloque('IHDR', ihdr), bloque('IDAT', zlibAlmacenado(crudo)), bloque('IEND')];
  const total = partes.reduce((s, x) => s + x.length, 0);
  const salida = new Uint8Array(total);
  let p = 0;
  for (const x of partes) { salida.set(x, p); p += x.length; }
  return salida;
}

/** '#FB6600' → [251, 102, 0]. */
export function hexARgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) throw new RangeError(`Color inválido «${hex}».`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];
}

/** PNG de un solo color (la franja #FB6600 del pie, el recuadro #ED7D31 del número). */
export function pngColor(ancho, alto, hex) {
  const [r, g, b] = hexARgb(hex);
  const w = Math.max(1, Math.trunc(ancho)), h = Math.max(1, Math.trunc(alto));
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255; }
  return pngRGBA(w, h, px);
}

/* Dibujo con borde suave por submuestreo 4 × 4. `cobertura(u, v)` recibe la
   posición en fracción 0..1 y devuelve [r, g, b, opacidad] en 0..1 (o null = vacío). */
function pintar(w, h, cobertura) {
  const px = new Uint8Array(w * h * 4);
  const SUB = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const c = cobertura((x + (sx + 0.5) / SUB) / w, (y + (sy + 0.5) / SUB) / h);
          if (c) { r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3]; }
        }
      }
      const n = SUB * SUB;
      const i = (y * w + x) * 4;
      const alfa = a / n;
      // color promedio ponderado por su opacidad (sin «halo» oscuro en el borde)
      px[i] = alfa ? Math.round(r / a * 255) : 0;
      px[i + 1] = alfa ? Math.round(g / a * 255) : 0;
      px[i + 2] = alfa ? Math.round(b / a * 255) : 0;
      px[i + 3] = Math.round(alfa * 255);
    }
  }
  return px;
}

/**
 * Viñeta ⊞ del formato: cuadrado de esquinas redondeadas #F79646, interior blanco
 * y cruz naranja (medida en el modelo: borde ≈ 1/5 del lado, cruz de ≈ 3/20 de grueso y brazos hasta la mitad del interior).
 * @param {number} [px=32]  alto en píxeles (el ancho guarda la proporción 7,75 : 8)
 */
export function pngVineta(px = 32) {
  const h = Math.max(8, Math.trunc(px));
  const w = Math.max(8, Math.round(h * 7.75 / 8));
  const [nr, ng, nb] = hexARgb('#F79646');
  const N = [nr / 255, ng / 255, nb / 255, 1];    // componentes 0..1 y opacidad
  const B = [1, 1, 1, 1];
  const RADIO = 0.25, BORDE = 0.2, BRAZO = 0.255, GROSOR = 0.075;
  const dentro = (u, v, m, r) => {               // ¿(u,v) dentro del cuadrado redondeado con margen m y radio r?
    const x0 = m, x1 = 1 - m, y0 = m, y1 = 1 - m;
    if (u < x0 || u > x1 || v < y0 || v > y1) return false;
    const cx = Math.min(Math.max(u, x0 + r), x1 - r);
    const cy = Math.min(Math.max(v, y0 + r), y1 - r);
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
  };
  const datos = pintar(w, h, (u, v) => {
    if (!dentro(u, v, 0, RADIO)) return null;
    if (!dentro(u, v, BORDE, 0.08)) return N;
    const enCruz = (Math.abs(u - 0.5) <= GROSOR && Math.abs(v - 0.5) <= BRAZO)
      || (Math.abs(v - 0.5) <= GROSOR && Math.abs(u - 0.5) <= BRAZO);
    return enCruz ? N : B;
  });
  return pngRGBA(w, h, datos);
}

/**
 * Marcador de imagen pendiente (logo o firma que aún no está en el almacén):
 * recuadro punteado gris con una equis, fondo transparente. Sin texto: el aviso
 * en palabras va en la lista de avisos de la exportación.
 * @param {number} ancho  px
 * @param {number} alto   px
 */
export function pngMarcador(ancho, alto) {
  const w = Math.max(8, Math.min(1200, Math.trunc(ancho)));
  const h = Math.max(8, Math.min(1200, Math.trunc(alto)));
  const px = new Uint8Array(w * h * 4);
  const poner = (x, y, a) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    px[i] = 150; px[i + 1] = 150; px[i + 2] = 150; px[i + 3] = Math.max(px[i + 3], a);
  };
  const T = 6, H = 4;                               // trazo de 6 px y hueco de 4 px
  for (let x = 0; x < w; x++) {
    if (x % (T + H) < T) { poner(x, 0, 255); poner(x, 1, 255); poner(x, h - 1, 255); poner(x, h - 2, 255); }
  }
  for (let y = 0; y < h; y++) {
    if (y % (T + H) < T) { poner(0, y, 255); poner(1, y, 255); poner(w - 1, y, 255); poner(w - 2, y, 255); }
  }
  const pasos = Math.max(w, h) * 2;
  for (let k = 0; k <= pasos; k++) {
    const t = k / pasos;
    const x = Math.round(t * (w - 1));
    poner(x, Math.round(t * (h - 1)), 110);
    poner(x, Math.round((1 - t) * (h - 1)), 110);
  }
  return pngRGBA(w, h, px);
}
