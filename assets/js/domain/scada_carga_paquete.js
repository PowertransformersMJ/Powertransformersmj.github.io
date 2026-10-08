// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · paquete preparado de un mes (dominio puro) · `99 §122`
// ──────────────────────────────────────────────────────────────────────────────
// Un mes del SCADA pesa ~650 MB y la extensión de Chrome solo sube 10 MB por vez. El paquete
// lleva la MISMA carpeta, adelgazada sin cambiar lo que la página calcula:
//   · los archivos que el lector usa —promedio, calidad y, desde la versión 2 (§126), máximo,
//     mínimo e instantáneo— con su encabezado y SOLO las filas de las estaciones de la
//     homologación (el lector descarta las demás);
//   · los demás archivos (.xls, .txt…) como marcas vacías con su tamaño original, para que el
//     informe de la carpeta cuente igual;
//   · un manifiesto con la carpeta, las estaciones del filtro y el tamaño de cada archivo.
// Va comprimido (gzip) y partido en trozos de ≤ 9 MB con la huella SHA-256 en el nombre. La
// página junta los trozos, comprueba la huella, descomprime y entrega los archivos al MISMO
// lector de siempre: veredicto, simulación y guardado no cambian.
// La compresión y la huella dependen del entorno (Node o navegador): aquí solo el formato.
// Funciones PURAS. Archivo NUEVO (L-102). Sin nombres reales (la guardia lo hace cumplir).
// ══════════════════════════════════════════════════════════════════════════════

import { estadisticoDeNombre, normalizarTexto, fechaDeEncabezado } from './scada_carga_csv.js';

export const PAQUETE = Object.freeze({
  firma: 'SGM-SCADA-PAQUETE',
  version: 2,   // 2 (§126): trae también máx, mín e instantáneo. Un paquete 1 se rechaza.
  extension: '.sgmpaq',
  parteMaxBytes: 9 * 1024 * 1024
});

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

/**
 * ¿El lector de la página LEE este archivo? Mismo criterio que el worker: CSV de promedio, calidad o sin
 * estadístico, y —desde `99 §126`, solo para VER— máximo, mínimo e instantáneo.
 */
export function seLee(nombre) {
  if (!/\.csv$/i.test(String(nombre || ''))) return false;
  const est = estadisticoDeNombre(nombre);
  return !est || ['average', 'quality', 'max', 'min', 'current'].includes(est);
}

/**
 * Deja el encabezado y SOLO las filas de las estaciones dadas (normalizadas con normalizarTexto).
 * Las líneas se conservan tal cual (con su '\r' si lo traen); las vacías se descartan (el lector las salta).
 * @param {string} texto
 * @param {Set<string>} estaciones
 */
export function filtrarTexto(texto, estaciones) {
  const lineas = String(texto || '').split('\n');
  const out = [lineas[0]];
  for (let i = 1; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l || l === '\r') continue;
    const coma = l.indexOf(',');
    if (coma < 0) continue;
    const segs = l.slice(0, coma).split('/');
    if (segs.length < 6) continue;
    if (estaciones.has(normalizarTexto(segs[1]))) out.push(l);
  }
  return out.join('\n');
}

/**
 * Relevo de estación (`99 §158`). A veces el SCADA RENOMBRA una estación: la vieja queda congelada («Not Renewed») y la
 * medida sigue con otro nombre. Para que el punto y su historial sigan siendo los MISMOS, desde `desde` (fecha del
 * archivo, inclusive) las filas de `nueva` se escriben con el nombre de `est` y las de `est` se descartan; antes de
 * `desde`, las de `nueva` se descartan (son de la puesta en servicio). Cada relevo lo confirma el Ingeniero y llega por
 * el empaquetador (`--relevo`): los nombres reales nunca entran al repo. Solo el paquete preparado lo aplica (arrastrar
 * la carpeta del mes no). Un archivo sin fecha legible en el encabezado sale tal cual.
 * @param {string} texto  un archivo del exporte (encabezado + filas)
 * @param {Array<{est: string, nueva: string, desde: string}>} relevos  `desde` en AAAA-MM-DD
 * @returns {{texto: string, renombradas: number, descartadas: number}}
 */
export function aplicarRelevos(texto, relevos) {
  const t = String(texto || '');
  const nada = { texto: t, renombradas: 0, descartadas: 0 };
  if (!relevos || !relevos.length) return nada;
  const lineas = t.split('\n');
  const cab = fechaDeEncabezado(String(lineas[0] || '').replace(/^\uFEFF/, ''));
  if (!cab.ok) return nada;
  const R = relevos.map((r) => ({ est: String(r.est).trim(), vieja: normalizarTexto(r.est), nueva: normalizarTexto(r.nueva), activo: cab.fecha >= r.desde }));
  const out = [lineas[0]];
  let renombradas = 0; let descartadas = 0;
  for (let i = 1; i < lineas.length; i++) {
    const l = lineas[i];
    const coma = l.indexOf(',');
    const segs = coma < 0 ? null : l.slice(0, coma).split('/');
    const e = segs && segs.length >= 6 ? normalizarTexto(segs[1]) : null;
    const r = e ? R.find((x) => x.vieja === e || x.nueva === e) : null;
    if (!r) { out.push(l); continue; }
    if (e === r.vieja ? r.activo : !r.activo) { descartadas++; continue; }
    if (e === r.nueva) { segs[1] = r.est; out.push(segs.join('/') + l.slice(coma)); renombradas++; continue; }
    out.push(l);
  }
  return { texto: out.join('\n'), renombradas, descartadas };
}

/**
 * Arma el contenedor (sin comprimir).
 * @param {{carpeta: string, creado: string, estaciones: string[], origen?: object}} meta
 * @param {Array<{ruta: string, nombre: string, tamano: number, contenido: Uint8Array|null}>} archivos
 * @returns {Uint8Array}
 */
export function armarContenedor(meta, archivos) {
  const lista = archivos.map((a) => ({ ruta: a.ruta, nombre: a.nombre, tamano: a.tamano, bytes: a.contenido ? a.contenido.length : 0 }));
  const manifiesto = {
    version: PAQUETE.version, carpeta: meta.carpeta, creado: meta.creado,
    estaciones: [...meta.estaciones].sort(), origen: meta.origen || null, archivos: lista
  };
  // Solo si hubo relevos (§158): así un paquete sin relevos queda byte a byte como antes.
  if (meta.relevos && meta.relevos.length) manifiesto.relevos = meta.relevos.map((r) => ({ est: r.est, nueva: r.nueva, desde: r.desde }));
  const cab = enc.encode(PAQUETE.firma + ' ' + PAQUETE.version + '\n' + JSON.stringify(manifiesto) + '\n');
  const total = cab.length + lista.reduce((s, a) => s + a.bytes, 0);
  const out = new Uint8Array(total);
  out.set(cab, 0);
  let p = cab.length;
  for (const a of archivos) if (a.contenido && a.contenido.length) { out.set(a.contenido, p); p += a.contenido.length; }
  return out;
}

/**
 * Lee un contenedor (ya descomprimido). Lanza un Error con texto llano si no es válido.
 * @param {Uint8Array} bytes
 * @returns {{manifiesto: object, archivos: Array<{ruta, nombre, tamano, contenido: Uint8Array}>}}
 */
export function leerContenedor(bytes) {
  const nl1 = bytes.indexOf(10);
  if (nl1 < 0) throw new Error('El paquete está dañado (sin encabezado).');
  const firma = dec.decode(bytes.subarray(0, nl1));
  if (firma === PAQUETE.firma + ' 1') throw new Error('Este paquete se preparó sin máximos, mínimos ni instantáneos (versión anterior): prepare uno nuevo con el empaquetador actual.');
  if (firma !== PAQUETE.firma + ' ' + PAQUETE.version) throw new Error('No es un paquete de datos SCADA de esta versión.');
  const nl2 = bytes.indexOf(10, nl1 + 1);
  if (nl2 < 0) throw new Error('El paquete está dañado (sin manifiesto).');
  let manifiesto;
  try { manifiesto = JSON.parse(dec.decode(bytes.subarray(nl1 + 1, nl2))); } catch (_) { throw new Error('El paquete está dañado (manifiesto ilegible).'); }
  if (!manifiesto || !Array.isArray(manifiesto.archivos) || !Array.isArray(manifiesto.estaciones) || !manifiesto.carpeta) {
    throw new Error('El paquete está dañado (manifiesto incompleto).');
  }
  let p = nl2 + 1;
  const archivos = [];
  for (const a of manifiesto.archivos) {
    const n = Number(a.bytes) || 0;
    if (n < 0 || p + n > bytes.length) throw new Error('El paquete está incompleto: falta el contenido de ' + a.ruta + '.');
    archivos.push({ ruta: String(a.ruta), nombre: String(a.nombre), tamano: Number(a.tamano) || 0, contenido: bytes.subarray(p, p + n) });
    p += n;
  }
  if (p !== bytes.length) throw new Error('El paquete trae bytes de más: no coincide con su manifiesto.');
  return { manifiesto, archivos };
}

/** Parte segura de un nombre de archivo. */
const segura = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'mes';

/** Nombre de una parte: 'scada-<carpeta>-p01de03-<sha256>.sgmpaq'. */
export function nombreParte(carpeta, i, n, sha) {
  const d = (x) => String(x).padStart(2, '0');
  return 'scada-' + segura(carpeta) + '-p' + d(i) + 'de' + d(n) + '-' + sha + PAQUETE.extension;
}

/** Datos de una parte por su nombre, o null si no es una parte de paquete. */
export function analizarNombreParte(nombre) {
  const m = String(nombre || '').match(/^scada-([A-Za-z0-9_-]+)-p(\d{2})de(\d{2})-([0-9a-f]{64})\.sgmpaq$/);
  if (!m) return null;
  const i = +m[2]; const n = +m[3];
  if (i < 1 || n < 1 || i > n) return null;
  return { carpeta: m[1], i, n, sha: m[4] };
}

/** Parte los bytes comprimidos en trozos de ≤ parteMaxBytes. */
export function partir(bytes, max = PAQUETE.parteMaxBytes) {
  const partes = [];
  for (let p = 0; p < bytes.length; p += max) partes.push(bytes.subarray(p, Math.min(bytes.length, p + max)));
  return partes.length ? partes : [bytes];
}

/**
 * Junta las partes de UN paquete (mismo sha y mismo n). No comprueba la huella: eso lo hace quien
 * tiene SHA-256 a mano (navegador o Node).
 * @param {Array<{i: number, n: number, sha: string, bytes: Uint8Array}>} partes
 * @returns {{completo: boolean, faltan: number[], bytes: Uint8Array|null}}
 */
export function juntarPartes(partes) {
  if (!partes.length) return { completo: false, faltan: [], bytes: null };
  const { n, sha } = partes[0];
  const porI = new Map();
  for (const x of partes) {
    if (x.n !== n || x.sha !== sha) throw new Error('Se mezclaron partes de paquetes distintos.');
    porI.set(x.i, x.bytes);
  }
  const faltan = [];
  for (let i = 1; i <= n; i++) if (!porI.has(i)) faltan.push(i);
  if (faltan.length) return { completo: false, faltan, bytes: null };
  const total = [...porI.values()].reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (let i = 1; i <= n; i++) { const b = porI.get(i); out.set(b, p); p += b.length; }
  return { completo: true, faltan: [], bytes: out };
}

/**
 * Estaciones que la homologación vigente necesita y el paquete NO trae (deben ser cero para cargar).
 * @param {string[]} necesarias  objetivoImportacion(filas).estaciones
 * @param {string[]} delPaquete  manifiesto.estaciones
 */
export function estacionesFaltantes(necesarias, delPaquete) {
  const s = new Set(delPaquete || []);
  return [...new Set(necesarias || [])].filter((e) => !s.has(e)).sort();
}
