// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Zip «almacenado» (sin compresión) · dominio puro
// ──────────────────────────────────────────────────────────────────────────────
// Un .docx es un zip. Para armarlo no hace falta una librería: las fotos ya van
// en JPEG (no se comprimen más) y el XML pesa poco, así que basta guardar cada
// parte tal cual (método 0) con su CRC-32.
//
// · Nombres en UTF-8 (bit 11 de la bandera general).
// · Fecha fija 1980-01-01 00:00: la misma entrada da SIEMPRE los mismos bytes
//   (salida determinista: se puede comparar en pruebas).
// · Sin ZIP64: un informe pesa unos pocos MB, muy lejos del tope de 4 GB.
// Sin DOM ni red: corre igual en el navegador y en `node --test`.
// ══════════════════════════════════════════════════════════════════════════════

let TABLA_CRC = null;

function tablaCrc() {
  if (TABLA_CRC) return TABLA_CRC;
  TABLA_CRC = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    TABLA_CRC[n] = c >>> 0;
  }
  return TABLA_CRC;
}

/** Convierte texto o bytes a Uint8Array (el texto en UTF-8). */
export function aBytes(dato) {
  if (dato instanceof Uint8Array) return dato;
  if (typeof dato === 'string') return new TextEncoder().encode(dato);
  if (dato instanceof ArrayBuffer) return new Uint8Array(dato);
  if (ArrayBuffer.isView(dato)) return new Uint8Array(dato.buffer, dato.byteOffset, dato.byteLength);
  throw new TypeError('crearZip: cada entrada necesita texto o bytes.');
}

/**
 * CRC-32 (el de zip y PNG). Se puede encadenar: crc32(b, crc32(a)) = crc32(a+b).
 * @param {Uint8Array|string} bytes
 * @param {number} [previo]
 * @returns {number} entero sin signo
 */
export function crc32(bytes, previo = 0) {
  const b = aBytes(bytes);
  const t = tablaCrc();
  let c = (previo ^ 0xFFFFFFFF) >>> 0;
  for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const FECHA_DOS = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const HORA_DOS = 0;                          // 00:00:00
const BANDERA_UTF8 = 0x0800;

/**
 * Arma un zip sin compresión.
 * @param {{ nombre: string, datos: Uint8Array|string }[]} entradas  en el orden en que se guardan
 * @returns {Uint8Array}
 */
export function crearZip(entradas) {
  if (!Array.isArray(entradas)) throw new TypeError('crearZip: se esperaba una lista de entradas.');
  const vistos = new Set();
  const partes = [];
  const central = [];
  let desplazamiento = 0;

  for (const e of entradas) {
    const nombre = String(e && e.nombre || '');
    if (!nombre || nombre.startsWith('/') || nombre.includes('\\')) throw new Error(`crearZip: nombre de entrada inválido «${nombre}».`);
    if (vistos.has(nombre)) throw new Error(`crearZip: la entrada «${nombre}» está repetida.`);
    vistos.add(nombre);
    const nombreB = aBytes(nombre);
    const datos = aBytes(e.datos);
    const crc = crc32(datos);
    const n = datos.length;

    const local = new Uint8Array(30 + nombreB.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034B50, true);   // firma de cabecera local
    vl.setUint16(4, 20, true);           // versión necesaria (2.0)
    vl.setUint16(6, BANDERA_UTF8, true);
    vl.setUint16(8, 0, true);            // método 0: almacenado
    vl.setUint16(10, HORA_DOS, true);
    vl.setUint16(12, FECHA_DOS, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, n, true);           // tamaño comprimido = tamaño real
    vl.setUint32(22, n, true);
    vl.setUint16(26, nombreB.length, true);
    vl.setUint16(28, 0, true);           // sin campo extra
    local.set(nombreB, 30);

    const cen = new Uint8Array(46 + nombreB.length);
    const vc = new DataView(cen.buffer);
    vc.setUint32(0, 0x02014B50, true);   // firma del directorio central
    vc.setUint16(4, 20, true);           // hecho por (2.0, MS-DOS)
    vc.setUint16(6, 20, true);
    vc.setUint16(8, BANDERA_UTF8, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, HORA_DOS, true);
    vc.setUint16(14, FECHA_DOS, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, n, true);
    vc.setUint32(24, n, true);
    vc.setUint16(28, nombreB.length, true);
    vc.setUint16(30, 0, true);           // extra
    vc.setUint16(32, 0, true);           // comentario
    vc.setUint16(34, 0, true);           // disco
    vc.setUint16(36, 0, true);           // atributos internos
    vc.setUint32(38, 0, true);           // atributos externos
    vc.setUint32(42, desplazamiento, true);
    cen.set(nombreB, 46);

    partes.push(local, datos);
    central.push(cen);
    desplazamiento += local.length + n;
  }

  const inicioCentral = desplazamiento;
  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054B50, true);     // fin del directorio central
  vf.setUint16(4, 0, true);
  vf.setUint16(6, 0, true);
  vf.setUint16(8, central.length, true);
  vf.setUint16(10, central.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, inicioCentral, true);
  vf.setUint16(20, 0, true);

  const total = inicioCentral + tamCentral + fin.length;
  const salida = new Uint8Array(total);
  let p = 0;
  for (const x of partes) { salida.set(x, p); p += x.length; }
  for (const x of central) { salida.set(x, p); p += x.length; }
  salida.set(fin, p);
  return salida;
}
