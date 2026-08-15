#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SANEAMIENTO DE LA PLANTILLA INSTITUCIONAL PE.02081.PE-FO.03
// (Ficha Técnica de Planificación · Sistema de Distribución)
// ───────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE SCRIPT
//   El módulo de Fichas Técnicas lleva la plantilla oficial incrustada como
//   base64 (constante `FT_TPL_B64`, ~493 KB). Ese binario venía diligenciado
//   con un proyecto REAL: nombre de proyecto, zona, municipio, subestación,
//   alcance, beneficios, presupuesto, anexo de alta tensión, los dos
//   unifilares de esa subestación y las FIRMAS ESCANEADAS de tres personas.
//   Este repositorio es PÚBLICO, así que la plantilla no puede publicarse tal
//   cual: hay que dejar el formato (maquetación, logos, estilos, encabezados,
//   pies, fórmulas) y vaciar todo lo que identifique a un cliente o a una
//   persona.
//
//   Nada se pierde: el exportador del módulo reescribe SIEMPRE esas celdas y
//   esas dos imágenes en cada ficha que genera. La plantilla saneada es el
//   mismo formato, en blanco.
//
// USO
//   node scripts/sanear-plantilla-pe02081.mjs [ruta/al/Modulo_Fichas_Tecnicas_vNN.html]
//   (sin argumento usa MODULO_POR_DEFECTO, fuera del repo)
//
//   Salida:      assets/plantillas/PE-02081-planificacion.xlsx
//   Verificación: al final descomprime el resultado y falla (exit 1) si queda
//   una sola aparición de los términos prohibidos en cualquier parte del .xlsx.
//
// DEPENDENCIAS: jszip (devDependency ya declarada) + zlib/crypto de Node.
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');

/** Módulo origen (vive FUERA del repo: contiene datos reales de cliente). */
const MODULO_POR_DEFECTO = path.resolve(
  RAIZ, '..', 'Fichas Tecnicas', 'Modulo_Fichas_Tecnicas_v22.html'
);

/** Destino dentro del repo (binario público, ya saneado). */
const SALIDA = path.join(RAIZ, 'assets', 'plantillas', 'PE-02081-planificacion.xlsx');

/* ═══════════════════════════════════════════════════════════════════════════
   1) QUÉ SE VACÍA · declarado como datos, no escondido en el código
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Hoja 1 «Ficha Técnica». Celdas que el exportador reescribe en CADA ficha
 * (ver `ftPlanMap()` en el módulo). Se envían vacías en la plantilla.
 */
const CELDAS_HOJA1 = [
  ['D8',  'Proyecto'],
  ['H8',  'Consecutivo'],
  ['D9',  'Código de estudio/tarea'],
  ['H9',  'Ámbito'],
  ['D13', 'Zona (departamento)'],
  ['H13', 'Subestación'],
  ['D14', 'Municipio'],
  ['B17', 'Alcance (texto del proyecto)'],
  ['B23', 'Beneficios (texto del proyecto)'],
  ['B36', 'Inversión · Subestación'],
  ['C36', 'Inversión · UUCC'],
  ['D36', 'Inversión · Descripción de la UC'],
  ['F36', 'Valor CREG unitario'],
  ['H36', 'Cantidad'],
  ['I36', 'Valor CREG total (fórmula)']
];

/** Hoja 1: totales SUM — se les quita el valor en caché, la fórmula se queda. */
const CACHES_HOJA1 = ['I78', 'J78'];

/**
 * Hoja 2 «Beneficios». El exportador NO la reescribe, pero contenía el estudio
 * económico del proyecto real (año, MW no servidos, horas de indisponibilidad).
 * Se vacían SOLO los supuestos del proyecto; se conservan las referencias
 * públicas de la UPME (E11 = fecha de los pesos, F11 = CRO $/kWh) y todas las
 * fórmulas, para que el modelo de cálculo siga intacto.
 */
const CELDAS_HOJA2 = [
  ['B20', 'Año del análisis'],
  ['C20', 'ENS · potencia no servida (MW)'],
  ['D20', 'ENS · indisponibilidad (h)']
];
const CACHES_HOJA2 = ['K11', 'K12', 'K14', 'E20', 'F20'];

/**
 * Hoja 6 «Anexo AT». Fila 11 completa = datos de placa del transformador real.
 * El exportador la reescribe entera (ver `anexoCellMap()`).
 */
const CELDAS_HOJA6 = 'BCDEFGHIJKLMNO'.split('').map(
  (c) => [`${c}11`, `Anexo AT · columna ${c}`]
);

/**
 * Textos del dibujo de la hoja 1 (cuadro de firmas) y términos prohibidos.
 *
 * ⚠️ NO VIVEN AQUÍ. Son nombres de personas reales, fechas de firma, nombres de
 *    subestación y usuarios de dominio. Este repositorio es PÚBLICO, así que
 *    escribirlos en el código sería filtrar exactamente lo que este script borra.
 *    Viven en la bóveda privada, fuera del repo:
 *      ../brain-private/sgm-transpower/saneamiento-pe02081.json
 *    Si el archivo no está, el saneamiento se detiene: es preferible fallar a
 *    publicar una plantilla a medio sanear.
 *
 * ⚠️ El JSON NO debe tocar «21/04/2026» ni «2027»: el exportador los usa como
 *    anclas literales para escribir la fecha de entrega y el año de entrada.
 */
const CONFIG_SENSIBLE = new URL(
  '../../brain-private/sgm-transpower/saneamiento-pe02081.json',
  import.meta.url
);

function cargarConfigSensible() {
  if (!fs.existsSync(CONFIG_SENSIBLE)) {
    console.error([
      '',
      '✖ Falta la configuración sensible del saneamiento.',
      '  Se esperaba en: ../brain-private/sgm-transpower/saneamiento-pe02081.json',
      '  Esa lista contiene nombres de personas y de subestaciones reales, y por eso',
      '  vive en la bóveda privada y no en este repositorio público.',
      ''
    ].join('\n'));
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_SENSIBLE, 'utf8'));
  return {
    textosDibujo1: (cfg.textosDibujo1 || []).map((t) => [t.buscar, t.reemplazar]),
    prohibidos: cfg.prohibidos || []
  };
}

const { textosDibujo1: TEXTOS_DIBUJO1, prohibidos: PROHIBIDOS } = cargarConfigSensible();

/** Anclas del exportador que DEBEN sobrevivir al saneamiento. */
const ANCLAS_EXPORTADOR = [
  ['xl/drawings/drawing1.xml', '<a:t>21/04/2026</a:t>'],
  ['xl/drawings/drawing1.xml', '<a:t>2027</a:t>']
];

/**
 * Imágenes sustituidas por un PNG liso del MISMO tamaño en píxeles.
 *   image2/image3 → firmas manuscritas escaneadas (personas reales).
 *   image5/image6 → unifilares de la subestación real; el exportador los
 *                   reemplaza en cada ficha con el diagrama que dibuja.
 */
const IMAGENES = [
  ['xl/media/image2.png', 264, 110, 'Firma manuscrita escaneada'],
  ['xl/media/image3.png', 196, 150, 'Firma manuscrita escaneada'],
  ['xl/media/image5.png', 778, 948, 'Unifilar · Diagrama Actual'],
  ['xl/media/image6.png', 790, 842, 'Unifilar · Diagrama Futuro']
];


/* ═══════════════════════════════════════════════════════════════════════════
   2) UTILIDADES PURAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** CRC-32 (PNG). Tabla precalculada al vuelo. */
const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Genera un PNG liso (RGB de 8 bits, sin transparencia) del tamaño pedido.
 * Sirve de marcador de posición: mismo lienzo, cero información.
 */
function pngLiso(ancho, alto, rgb = [255, 255, 255]) {
  const crudo = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    const off = y * (ancho * 3 + 1);
    crudo[off] = 0;                                   // filtro None
    for (let x = 0; x < ancho; x++) {
      crudo[off + 1 + x * 3] = rgb[0];
      crudo[off + 2 + x * 3] = rgb[1];
      crudo[off + 3 + x * 3] = rgb[2];
    }
  }
  const trozo = (tipo, datos) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(datos.length, 0);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(cuerpo), 0);
    return Buffer.concat([len, cuerpo, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;   // bits por canal
  ihdr[9] = 2;   // color type 2 = RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

/**
 * Deja la celda `ref` vacía conservando su estilo (`s=`), igual que hace el
 * exportador cuando el campo va en blanco. Devuelve el índice de cadena
 * compartida que ocupaba, si la celda era de tipo `t="s"`.
 */
function vaciarCelda(xml, ref) {
  const re = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) return { xml, encontrada: false, si: null };
  const estilo = (m[0].match(/\ss="(\d+)"/) || [])[1];
  const tipo = (m[0].match(/\st="([^"]+)"/) || [])[1];
  const valor = (m[0].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
  const si = tipo === 's' && valor != null ? Number(valor) : null;
  const nueva = `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}/>`;
  return { xml: xml.replace(re, nueva), encontrada: true, si };
}

/** Quita el valor en caché de una celda con fórmula (fuerza recálculo). */
function vaciarCache(xml, ref) {
  const re = new RegExp(`(<c r="${ref}"[^>]*>[\\s\\S]*?</f>)<v>[\\s\\S]*?</v>(</c>)`);
  return xml.replace(re, '$1$2');
}

/** Deja en blanco las entradas indicadas de la tabla de cadenas compartidas. */
function vaciarCadenas(xml, indices) {
  let i = -1;
  return xml.replace(/<si>[\s\S]*?<\/si>/g, (m) => {
    i += 1;
    return indices.has(i) ? '<si><t xml:space="preserve"></t></si>' : m;
  });
}

/**
 * Índices de cadena compartida que TODAVÍA usa alguna celda del libro.
 * ⚠️ Sin este filtro se rompe el formato: varias celdas de dato compartían su
 *    texto con una celda de ENCABEZADO («NO», «*», «ACEITE»…). Vaciar la
 *    cadena por el dato borraría también el encabezado. Solo se vacían las
 *    cadenas que quedaron huérfanas después de limpiar las celdas.
 */
function cadenasEnUso(hojas) {
  const usadas = new Set();
  for (const xml of hojas) {
    for (const m of xml.matchAll(/<c r="[A-Z]+\d+"[^>]*\st="s"[^>]*>\s*<v>(\d+)<\/v>/g)) {
      usadas.add(Number(m[1]));
    }
  }
  return usadas;
}

/** Extrae el base64 de `FT_TPL_B64` sin cargar el HTML de 1,8 MB en memoria. */
function leerPlantillaIncrustada(rutaHtml) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: fs.createReadStream(rutaHtml) });
    let hallada = null;
    rl.on('line', (linea) => {
      if (hallada) return;
      const m = linea.match(/^const FT_TPL_B64="([A-Za-z0-9+/=]+)";?\s*$/);
      if (m) { hallada = m[1]; rl.close(); }
    });
    rl.on('close', () => {
      if (!hallada) reject(new Error(`No se encontró la constante FT_TPL_B64 en ${rutaHtml}`));
      else resolve(Buffer.from(hallada, 'base64'));
    });
    rl.on('error', reject);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   3) SANEAMIENTO
   ═══════════════════════════════════════════════════════════════════════════ */

async function main() {
  const rutaHtml = process.argv[2] ? path.resolve(process.argv[2]) : MODULO_POR_DEFECTO;
  if (!fs.existsSync(rutaHtml)) {
    console.error(`✖ No existe el módulo origen: ${rutaHtml}`);
    process.exit(1);
  }

  console.log('── Saneamiento de la plantilla PE.02081.PE-FO.03 ──');
  console.log(`   Origen : ${rutaHtml}`);
  console.log(`   Destino: ${path.relative(RAIZ, SALIDA)}`);

  const original = await leerPlantillaIncrustada(rutaHtml);
  console.log(`   Plantilla incrustada: ${original.length.toLocaleString('es-CO')} bytes`);

  const zip = await JSZip.loadAsync(original);
  const bitacora = [];
  const cadenasAVaciar = new Set();

  // ── Hoja 1 · «Ficha Técnica» ────────────────────────────────────────────
  let h1 = await zip.file('xl/worksheets/sheet1.xml').async('string');
  for (const [ref, campo] of CELDAS_HOJA1) {
    const r = vaciarCelda(h1, ref);
    h1 = r.xml;
    if (r.si != null) cadenasAVaciar.add(r.si);
    bitacora.push(['sheet1', ref, campo, r.encontrada ? 'vaciada' : 'no existía']);
  }
  for (const ref of CACHES_HOJA1) {
    h1 = vaciarCache(h1, ref);
    bitacora.push(['sheet1', ref, 'total del proyecto (SUM)', 'caché borrado']);
  }
  zip.file('xl/worksheets/sheet1.xml', h1);

  // ── Hoja 2 · «Beneficios» ───────────────────────────────────────────────
  let h2 = await zip.file('xl/worksheets/sheet2.xml').async('string');
  for (const [ref, campo] of CELDAS_HOJA2) {
    const r = vaciarCelda(h2, ref);
    h2 = r.xml;
    if (r.si != null) cadenasAVaciar.add(r.si);
    bitacora.push(['sheet2', ref, campo, r.encontrada ? 'vaciada' : 'no existía']);
  }
  for (const ref of CACHES_HOJA2) {
    h2 = vaciarCache(h2, ref);
    bitacora.push(['sheet2', ref, 'resultado económico', 'caché borrado']);
  }
  zip.file('xl/worksheets/sheet2.xml', h2);

  // ── Hoja 6 · «Anexo AT» ─────────────────────────────────────────────────
  let h6 = await zip.file('xl/worksheets/sheet6.xml').async('string');
  for (const [ref, campo] of CELDAS_HOJA6) {
    const r = vaciarCelda(h6, ref);
    h6 = r.xml;
    if (r.si != null) cadenasAVaciar.add(r.si);
    bitacora.push(['sheet6', ref, campo, r.encontrada ? 'vaciada' : 'no existía']);
  }
  zip.file('xl/worksheets/sheet6.xml', h6);

  // ── Enlace externo · ruta local + valor en caché del proyecto real ──────
  const RELS_EXT = 'xl/externalLinks/_rels/externalLink1.xml.rels';
  let rels = await zip.file(RELS_EXT).async('string');
  rels = rels.replace(/Target="file:[^"]*"/,
    'Target="file:///PE.02081.PE-FO.03%20Ficha%20tecnica.xlsx"');
  zip.file(RELS_EXT, rels);
  bitacora.push([RELS_EXT, '—', 'ruta local del libro enlazado', 'neutralizada']);

  let ext = await zip.file('xl/externalLinks/externalLink1.xml').async('string');
  ext = ext.replace(/(<cell r="J37"><v>)[^<]*(<\/v>)/, '$10$2');
  zip.file('xl/externalLinks/externalLink1.xml', ext);
  bitacora.push(['externalLink1.xml', 'J37', 'costo del proyecto en caché', 'puesto a 0']);

  // ── Cadenas compartidas ─────────────────────────────────────────────────
  // Solo se vacían las que quedaron SIN ninguna celda que las use: las que
  // aún referencia un encabezado del formato se conservan intactas.
  const hojas = await Promise.all(
    ['sheet1', 'sheet2', 'sheet3', 'sheet4', 'sheet6']
      .map((h) => zip.file(`xl/worksheets/${h}.xml`))
      .filter(Boolean)
      .map((f) => f.async('string'))
  );
  const enUso = cadenasEnUso(hojas);
  const huerfanas = new Set([...cadenasAVaciar].filter((i) => !enUso.has(i)));
  const conservadas = [...cadenasAVaciar].filter((i) => enUso.has(i));

  let ss = await zip.file('xl/sharedStrings.xml').async('string');
  ss = vaciarCadenas(ss, huerfanas);
  zip.file('xl/sharedStrings.xml', ss);
  bitacora.push(['sharedStrings.xml',
    [...huerfanas].sort((a, b) => a - b).join(','),
    'cadenas huérfanas tras vaciar las celdas', 'puestas en blanco']);
  if (conservadas.length) {
    bitacora.push(['sharedStrings.xml',
      conservadas.sort((a, b) => a - b).join(','),
      'cadenas que aún usa un encabezado', 'CONSERVADAS']);
  }

  // ── Dibujo de la hoja 1 · cuadro de firmas ──────────────────────────────
  let d1 = await zip.file('xl/drawings/drawing1.xml').async('string');
  for (const [de, a] of TEXTOS_DIBUJO1) {
    if (d1.includes(de)) {
      d1 = d1.split(de).join(a);
      bitacora.push(['drawing1.xml', '—', de.replace(/<\/?a:t>/g, ''), 'texto vaciado']);
    }
  }
  // La firma escaneada tenía una copia alterna en HD Photo (hdphoto1.wdp)
  // referenciada como capa de imagen: se elimina la referencia y la parte.
  d1 = d1.replace(
    /<a:ext uri="\{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B\}">[\s\S]*?<\/a:ext>/,
    ''
  );
  zip.file('xl/drawings/drawing1.xml', d1);

  let relsD1 = await zip.file('xl/drawings/_rels/drawing1.xml.rels').async('string');
  relsD1 = relsD1.replace(/<Relationship [^>]*hdphoto[^>]*\/>/, '');
  zip.file('xl/drawings/_rels/drawing1.xml.rels', relsD1);
  zip.remove('xl/media/hdphoto1.wdp');
  bitacora.push(['xl/media/hdphoto1.wdp', '—', 'copia HD Photo de la firma', 'eliminada']);

  // ── Imágenes ────────────────────────────────────────────────────────────
  for (const [ruta, ancho, alto, que] of IMAGENES) {
    zip.file(ruta, pngLiso(ancho, alto));
    bitacora.push([ruta, `${ancho}×${alto}`, que, 'sustituida por PNG liso']);
  }

  // ── Propiedades del documento ───────────────────────────────────────────
  let core = await zip.file('docProps/core.xml').async('string');
  core = core.replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, '<dc:creator></dc:creator>')
             .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/,
                      '<cp:lastModifiedBy></cp:lastModifiedBy>');
  zip.file('docProps/core.xml', core);
  bitacora.push(['docProps/core.xml', '—', 'autor y último modificador', 'vaciados']);

  let wb = await zip.file('xl/workbook.xml').async('string');
  wb = wb.replace(/(<x15ac:absPath url=")[^"]*(")/, '$1$2');
  zip.file('xl/workbook.xml', wb);
  bitacora.push(['xl/workbook.xml', '—', 'ruta absoluta local del libro', 'vaciada']);

  // Etiquetas de confidencialidad de Microsoft: llevan el identificador de
  // arrendatario (SiteId) de la organización del cliente.
  const GUID_CERO = '00000000-0000-0000-0000-000000000000';
  for (const parte of ['docProps/custom.xml', 'docMetadata/LabelInfo.xml']) {
    const f = zip.file(parte);
    if (!f) continue;
    let xml = await f.async('string');
    xml = xml.replace(/666bb131-2344-48ed-84db-fe1e84a9fae2/g, GUID_CERO)
             .replace(/bf1ce8b5-5d39-4bc5-ad6e-07b3e4d7d67a/g, GUID_CERO);
    zip.file(parte, xml);
  }
  bitacora.push(['docProps/custom.xml + LabelInfo.xml', '—',
                 'identificadores de arrendatario M365', 'neutralizados']);

  // ── Escritura ───────────────────────────────────────────────────────────
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  const salida = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  fs.writeFileSync(SALIDA, salida);

  console.log('\n── Operaciones ──');
  for (const [parte, ref, campo, accion] of bitacora) {
    console.log(`   ${parte.padEnd(34)} ${String(ref).padEnd(8)} ${campo.slice(0, 42).padEnd(44)} ${accion}`);
  }
  console.log(`\n   Escrito: ${salida.length.toLocaleString('es-CO')} bytes`);

  await verificar(salida);
}

/* ═══════════════════════════════════════════════════════════════════════════
   4) VERIFICACIÓN · descomprime el resultado y busca lo prohibido
   ═══════════════════════════════════════════════════════════════════════════ */

async function verificar(buffer) {
  console.log('\n── Verificación ──');
  const zip = await JSZip.loadAsync(buffer);
  const hallazgos = [];

  for (const nombre of Object.keys(zip.files)) {
    if (zip.files[nombre].dir) continue;
    const bin = await zip.file(nombre).async('nodebuffer');
    // Se busca en UTF-8 y en Latin-1 para no depender de la codificación.
    const textos = [bin.toString('utf8'), bin.toString('latin1')];
    for (const termino of PROHIBIDOS) {
      const t = termino.toUpperCase();
      if (textos.some((s) => s.toUpperCase().includes(t))) {
        hallazgos.push(`${nombre} :: «${termino}»`);
      }
    }
  }

  // Las anclas del exportador tienen que seguir ahí.
  const anclasRotas = [];
  for (const [parte, ancla] of ANCLAS_EXPORTADOR) {
    const f = zip.file(parte);
    const xml = f ? await f.async('string') : '';
    if (!xml.includes(ancla)) anclasRotas.push(`${parte} :: ${ancla}`);
  }

  // Las celdas objetivo tienen que quedar sin valor.
  const conValor = [];
  const revisar = async (parte, celdas) => {
    const xml = await zip.file(parte).async('string');
    for (const [ref] of celdas) {
      const m = xml.match(new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`));
      if (m && /<v>|<is>/.test(m[0])) conValor.push(`${parte} :: ${ref}`);
    }
  };
  await revisar('xl/worksheets/sheet1.xml', CELDAS_HOJA1);
  await revisar('xl/worksheets/sheet2.xml', CELDAS_HOJA2);
  await revisar('xl/worksheets/sheet6.xml', CELDAS_HOJA6);

  const ok = !hallazgos.length && !anclasRotas.length && !conValor.length;
  console.log(`   Partes revisadas ............. ${Object.keys(zip.files).length}`);
  console.log(`   Términos prohibidos hallados . ${hallazgos.length}`);
  hallazgos.forEach((h) => console.log(`      ✖ ${h}`));
  console.log(`   Celdas que siguen con valor .. ${conValor.length}`);
  conValor.forEach((c) => console.log(`      ✖ ${c}`));
  console.log(`   Anclas del exportador rotas .. ${anclasRotas.length}`);
  anclasRotas.forEach((a) => console.log(`      ✖ ${a}`));
  console.log(ok ? '\n✔ Plantilla saneada y verificada.' : '\n✖ VERIFICACIÓN FALLIDA.');
  if (!ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
