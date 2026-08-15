// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · EXPORTADOR DE LA FICHA DE PLANIFICACIÓN
//                    (formato PE.02081.CO-PE-FO.03 Ed. 2)
// ──────────────────────────────────────────────────────────────────────────────
// Qué hace: toma la plantilla oficial .xlsx, escribe SOLO unas celdas concretas
// y devuelve el archivo listo. La maquetación, los logos, los encabezados, los
// pies y el cuadro de firmas de la plantilla NO se tocan nunca: se abre el .xlsx
// como zip y se parchea el XML de las hojas, exactamente como ya hace
// `assets/js/exports/xlsm_suministros.js` con el libro de suministros.
//
// Qué se escribe (y nada más):
//   · Hoja 1 «Ficha Técnica» → 15 celdas (proyecto, ubicación, alcance,
//     beneficios y la línea de inversión con el presupuesto CREG).
//   · Hoja 5 «Anexo AT»       → la fila 11 con los datos de placa del equipo.
//   · Hoja 3 «Diagrama Actual» y hoja 4 «Diagrama Futuro» → sus dos unifilares,
//     que son INDEPENDIENTES: cada hoja recibe el suyo (image5 = Actual,
//     image6 = Futuro; verificado en drawing3/drawing4 de la plantilla).
//   · Cuadros de texto del dibujo de la hoja 1: fecha de entrega y año de
//     entrada en operación.
//
// Qué NO vive aquí (por diseño):
//   · La FÓRMULA del presupuesto → `domain/fichas_presupuesto.js`.
//   · El catálogo CREG y el clasificador de UC → `domain/fichas_creg_uc.js`.
//   · El dibujo del unifilar → lo entrega el llamador ya rasterizable (SVG).
//   · La DESCARGA del archivo → responsabilidad de quien llama; aquí solo se
//     devuelve el Blob.
//
// Repo público: este archivo no contiene ningún dato de cliente. Todo lo que se
// escribe llega por parámetro en tiempo de ejecución.
// ══════════════════════════════════════════════════════════════════════════════

import { buscarUC, clasificarUC } from '../../domain/fichas_creg_uc.js';
import { desgloseCreg } from '../../domain/fichas_presupuesto.js';

/* ═══════════════════════════════════════════════════════════════════════════
   DEPENDENCIAS EXTERNAS (plantilla y JSZip)
   ═══════════════════════════════════════════════════════════════════════════ */

/** CDN de JSZip — el mismo que ya usa el exportador de suministros. */
const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

/**
 * Ruta de la plantilla oficial, resuelta contra la ubicación de ESTE módulo,
 * de modo que funciona igual desde `/pages/*` que desde la raíz del sitio.
 */
export function rutaPlantilla() {
  return new URL('../../../plantillas/PE-02081-planificacion.xlsx', import.meta.url).href;
}

/**
 * Carga JSZip de forma PEREZOSA: solo se pide el CDN cuando alguien exporta.
 * Abrir la página no descarga nada.
 *
 * Escape hatch para pruebas en Node: si `globalThis.__sgmJSZip` está definido
 * se usa esa instancia y no se toca la red (mismo convenio que
 * `exports/xlsm_suministros.js`).
 */
async function cargarJSZip() {
  if (typeof globalThis !== 'undefined' && globalThis.__sgmJSZip) {
    return globalThis.__sgmJSZip;
  }
  try {
    const mod = await import(/* @vite-ignore */ JSZIP_CDN);
    const JSZip = mod.default || mod;
    if (!JSZip || typeof JSZip.loadAsync !== 'function') throw new Error('respuesta inesperada');
    return JSZip;
  } catch (e) {
    throw new Error(
      'No se pudo cargar la librería de compresión (JSZip) necesaria para armar el Excel. ' +
      'Revise la conexión a internet e intente de nuevo.'
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESCRITURA DE CELDAS EN EL XML DE UNA HOJA
   ── Portado literal del módulo v22 (`_setCell` / `_setCellF`). Preserva el
      ESTILO de la celda de la plantilla: por eso se parchea el XML en lugar de
      reconstruir la hoja.
   ═══════════════════════════════════════════════════════════════════════════ */

function numeroDeColumna(letras) {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escribe un valor en una celda del XML de la hoja, conservando su estilo.
 * Si la celda no existe se inserta en su posición correcta dentro de la fila
 * (y si la fila tampoco existe, se crea al final de `sheetData`).
 *
 * @param {string} xml            XML completo de la hoja
 * @param {string} ref            referencia de celda, p. ej. "D14"
 * @param {*} valor               valor a escribir ('' deja la celda en blanco)
 * @param {boolean} [numerico]    true ⇒ se escribe como número (<v>), no texto
 * @param {string|number} [estiloPlantilla] estilo `s` a usar SOLO si hay que crear la celda
 * @returns {string} XML con la celda escrita
 */
export function escribirCelda(xml, ref, valor, numerico, estiloPlantilla) {
  const col = ref.match(/[A-Z]+/)[0];
  const row = ref.match(/\d+/)[0];
  const esNum = numerico && valor != null && valor !== '' &&
    !isNaN(parseFloat(String(valor).replace(',', '.')));

  const construir = (s) => esNum
    ? '<c r="' + ref + '"' + s + '><v>' + parseFloat(String(valor).replace(',', '.')) + '</v></c>'
    : '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
      escXml(valor) + '</t></is></c>';

  const celdaRe = new RegExp('<c r="' + ref + '"[^>]*?(?:/>|>[\\s\\S]*?</c>)');
  const m = xml.match(celdaRe);
  if (m) {
    const sM = m[0].match(/\ss="(\d+)"/);
    return xml.replace(celdaRe, construir(sM ? (' s="' + sM[1] + '"') : ''));
  }

  const celda = construir(estiloPlantilla ? (' s="' + estiloPlantilla + '"') : '');
  const filaRe = new RegExp('(<row r="' + row + '"[^>]*>)([\\s\\S]*?)(</row>)');
  const fm = xml.match(filaRe);
  if (!fm) {
    return xml.replace('</sheetData>', '<row r="' + row + '">' + celda + '</row></sheetData>');
  }
  const interior = fm[2];
  const objetivo = numeroDeColumna(col);
  let pos = interior.length;
  const celdas = [...interior.matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)];
  for (const cm of celdas) {
    if (numeroDeColumna(cm[1]) > objetivo) { pos = cm.index; break; }
  }
  return xml.replace(filaRe, fm[1] + interior.slice(0, pos) + celda + interior.slice(pos) + fm[3]);
}

/**
 * Escribe una FÓRMULA en una celda, sin valor en caché, para que Excel/Calc la
 * recalculen al abrir. Conserva el estilo de la plantilla.
 * Si la celda no existe en la plantilla, el XML queda igual (no se inventa).
 */
export function escribirFormula(xml, ref, formula) {
  const celdaRe = new RegExp('<c r="' + ref + '"[^>]*?(?:/>|>[\\s\\S]*?</c>)');
  const m = xml.match(celdaRe);
  if (!m) return xml;
  const s = (m[0].match(/\ss="(\d+)"/) || [])[1];
  const celda = '<c r="' + ref + '"' + (s ? (' s="' + s + '"') : '') + '><f>' + escXml(formula) + '</f></c>';
  return xml.replace(celdaRe, celda);
}

/** Borra el valor en caché de una celda con fórmula, para forzar recálculo. */
export function limpiarCacheFormula(xml, ref) {
  return xml.replace(
    new RegExp('(<c r="' + ref + '"[^>]*><f>[\\s\\S]*?</f>)<v>[\\s\\S]*?</v>(</c>)'),
    '$1$2'
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LECTURA DEL ESTADO DE LA FICHA (lo que el usuario editó en pantalla)
   ═══════════════════════════════════════════════════════════════════════════ */

const txt = (v) => (v == null ? '' : String(v));
const lleno = (v) => v != null && String(v).trim() !== '';

/** Potencia del PROYECTO en MVA: la que el usuario fijó, o la de placa. */
export function potenciaProyecto(equipo = {}, estado = {}) {
  const p = (estado.plan || {}).potenciaMVA;
  if (lleno(p)) {
    const n = parseFloat(String(p).replace(',', '.'));
    if (!isNaN(n)) return n;
  }
  if (equipo.mva != null) return equipo.mva;
  if (equipo.potencia_kva != null) {
    const n = parseFloat(String(equipo.potencia_kva).replace(',', '.'));
    if (!isNaN(n)) return n / 1000;
  }
  return null;
}

/**
 * Unidad constructiva CREG de la ficha: se reclasifica con la potencia DEL
 * PROYECTO (que puede diferir de la de placa) y, si eso no arroja código, se
 * cae a la UC decidida en la auditoría y a la registrada.
 */
export function uccDeLaFicha(equipo = {}, estado = {}) {
  const plan = estado.plan || {};
  if (lleno(plan.presu_ucc)) return String(plan.presu_ucc).trim().toUpperCase();
  const mva = potenciaProyecto(equipo, estado);
  const kva = mva != null ? mva * 1000 : null;
  const r = clasificarUC(kva, equipo.kv_prim, equipo.kv_terc, equipo.regulacion);
  return r.uucc_calc || estado.uuccDecidida || equipo.uucc_calculada || equipo.uucc_registrada || '';
}

/** Descripción normalizada de la UC, tal como la imprime la ficha. */
export function descripcionUC(equipo = {}, codigo) {
  const r = buscarUC(codigo);
  if (r) {
    return 'TRANSFORMADOR TRIFASICO (' + (r.fila.reg || '') + ') - LADO DE ALTA NIVEL ' +
      String(r.fila.nivel || equipo.nivel || '').replace('N', '') +
      ' - DE ' + String(r.fila.cap || '').toUpperCase();
  }
  return 'TRANSFORMADOR TRIFASICO (' + txt(equipo.reg_catalogo) + ') - LADO DE ALTA NIVEL ' +
    txt(equipo.nivel).replace('N', '') + ' - DE ' + txt(equipo.banda).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAPA DE CELDAS · HOJA 1 «Ficha Técnica»
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Celdas de la primera hoja que se rellenan, con el valor y su explicación.
 * Es una función PURA: el mismo mapa alimenta el exportador y la vista previa
 * que se le muestra al usuario antes de descargar.
 *
 * Cada entrada: { cell, campo, val, numeric?, formula?, clear?, pend?, vista? }
 *   · `clear`   ⇒ la celda se deja en blanco (el dato no existe todavía).
 *   · `pend`    ⇒ falta un dato que nadie puede deducir; se marca [PENDIENTE].
 *   · `formula` ⇒ se escribe una fórmula de Excel, no un valor.
 *
 * @param {object} equipo  registro del transformador
 * @param {object} estado  { plan, municipio, uuccDecidida }
 */
export function celdasFichaPlan(equipo = {}, estado = {}) {
  const plan = estado.plan || {};
  const U = uccDeLaFicha(equipo, estado);
  const mva = potenciaProyecto(equipo, estado);

  // El presupuesto NO se calcula aquí: lo resuelve el dominio.
  const presu = desgloseCreg({
    uc: U,
    mva,
    costoInstalacion: lleno(plan.presu_unit) ? plan.presu_unit : undefined,
    cantidad: plan.presu_cant
  });

  const municipio = lleno(plan.municipio) ? plan.municipio : txt(estado.municipio);
  const desc = lleno(plan.presu_desc) ? plan.presu_desc : descripcionUC(equipo, U);
  const okTotal = !presu.pendiente;

  return [
    { cell: 'D8',  campo: 'Proyecto',   val: (plan.proyecto || '[PENDIENTE: NOMBRE DEL PROYECTO]'), pend: !lleno(plan.proyecto) },
    { cell: 'H8',  campo: 'Consecutivo', val: txt(plan.consecutivo), clear: !lleno(plan.consecutivo), pend: false },
    { cell: 'D9',  campo: 'Cód estudio/tarea', val: txt(plan.codestudio), clear: !lleno(plan.codestudio), pend: false },
    { cell: 'H9',  campo: 'Ámbito', val: 'Media Tensión / Alta Tensión', pend: false },
    { cell: 'D13', campo: 'Zona', val: txt(equipo.departamento), pend: false },
    { cell: 'H13', campo: 'Subestación', val: txt(equipo.subestacion), pend: false },
    { cell: 'D14', campo: 'Municipio', val: (lleno(municipio) ? municipio : '[PENDIENTE: MUNICIPIO]'), pend: !lleno(municipio) },
    { cell: 'B17', campo: 'Alcance', val: (plan.alcance || '[PENDIENTE: ALCANCE — texto del proyecto]'), pend: !lleno(plan.alcance) },
    { cell: 'B23', campo: 'Beneficios', val: (plan.beneficios || '[PENDIENTE: BENEFICIOS — texto del proyecto]'), pend: !lleno(plan.beneficios) },
    { cell: 'B36', campo: 'Inversión · Subestación', val: txt(equipo.subestacion), pend: false },
    { cell: 'C36', campo: 'Inversión · UUCC', val: txt(U), pend: false },
    { cell: 'D36', campo: 'Inversión · Descripción', val: desc, pend: false },
    // OJO: «Valor CREG Unitario» (F36) NO es el $/MVA — es el COSTO DE
    // INSTALACIÓN de la UC. El $/MVA es el que multiplica a la potencia.
    { cell: 'F36', campo: 'Valor CREG Unitario', numeric: true,
      val: presu.costoInstalacion, clear: presu.costoInstalacion == null, pend: false,
      vista: presu.costoInstalacion },
    { cell: 'H36', campo: 'Cantidad', val: presu.cantidad, numeric: true, pend: false },
    // I36 se escribe como FÓRMULA viva para que el revisor vea de dónde sale.
    { cell: 'I36', campo: 'Valor CREG Total',
      formula: (okTotal ? ('F36+(' + presu.mva + '*' + presu.valorUnitarioMVA + ')') : null),
      clear: !okTotal, pend: !okTotal,
      val: presu.total,
      vista: presu.formula }
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAPA DE CELDAS · HOJA 5 «Anexo AT» (datos de placa, fila 11)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Valores del Anexo AT: lo que el usuario escribió manda; si no escribió nada
 * se autocompleta con el equipo y con el diagrama ACTUAL.
 *
 * @param {object} equipo
 * @param {object} estado  { anexo, diagramas:{ actual } }
 */
export function valoresAnexoAT(equipo = {}, estado = {}) {
  const A = estado.anexo || {};
  const D = (estado.diagramas && estado.diagramas.actual) || {};
  const g = (k, d) => (A[k] != null && A[k] !== '' ? A[k] : d);

  const relacion = () => {
    if (lleno(A.relacion)) return A.relacion;
    const vp = equipo.kv_prim != null ? Math.round(parseFloat(String(equipo.kv_prim).replace(',', '.')) * 1000) : null;
    const vs = equipo.kv_sec  != null ? Math.round(parseFloat(String(equipo.kv_sec ).replace(',', '.')) * 1000) : null;
    return (vp && vs) ? (vp + '/' + vs) : '';
  };

  return {
    transformador: g('transformador', txt(equipo.subestacion)),
    onan:      g('onan', txt(D.potONAN)),
    onaf:      g('onaf', txt(D.potONAF) || (equipo.mva != null ? String(equipo.mva) : '')),
    relacion:  relacion(),
    grupo:     g('grupo', txt(D.grupo)),
    impedancia: g('impedancia', txt(D.imped)),
    refrig:    g('refrig', txt(equipo.refrigeracion)),
    cambiador: g('cambiador', txt(equipo.regulacion)),
    extension: g('extension', ''),
    pctpaso:   g('pctpaso', ''),
    paralelo:  g('paralelo', 'NO'),
    observacion: g('observacion', '')
  };
}

/**
 * Celdas de la hoja «Anexo AT». Las casillas de verificación del formato
 * (OLTC / OCTC y operación en paralelo SI / NO) se marcan con «*», que es la
 * convención de la plantilla oficial.
 */
export function celdasAnexoAT(equipo = {}, estado = {}) {
  const v = valoresAnexoAT(equipo, estado);
  const oltc = /OLTC/i.test(v.cambiador || '');
  const octc = /OCTC|NLTC/i.test(v.cambiador || '');
  const par  = (v.paralelo === 'SI');
  const num = (x) => {
    if (x == null || x === '') return '';
    const n = parseFloat(String(x).replace(',', '.'));
    return isNaN(n) ? '' : n;
  };
  return [
    { cell: 'B11', val: v.transformador },
    { cell: 'C11', val: num(v.onan), numeric: true },
    { cell: 'D11', val: num(v.onaf), numeric: true },
    { cell: 'E11', val: v.relacion },
    { cell: 'F11', val: v.grupo },
    { cell: 'G11', val: num(v.impedancia), numeric: true },
    { cell: 'H11', val: v.refrig },
    { cell: 'I11', val: (oltc ? '*' : '') },
    { cell: 'J11', val: (octc ? '*' : '') },
    { cell: 'K11', val: num(v.extension), numeric: true },
    { cell: 'L11', val: num(v.pctpaso), numeric: true },
    { cell: 'M11', val: (par ? '*' : '') },
    { cell: 'N11', val: (!par ? '*' : '') },
    { cell: 'O11', val: v.observacion }
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   UNIFILAR: SVG → PNG rotado 90°
   ── El recuadro de las hojas 3 y 4 es VERTICAL y el unifilar se dibuja
      horizontal: se rota al rasterizar. Solo funciona en el navegador
      (usa Image + canvas); si no hay DOM devuelve null y el exportador
      conserva la imagen de la plantilla.
   ═══════════════════════════════════════════════════════════════════════════ */

export function svgAPngRotado(svg, anchoDestino, altoDestino, vbAncho, vbAlto) {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined' || typeof Image === 'undefined' || !svg) {
        resolve(null);
        return;
      }
      const marcado = String(svg).replace('<svg ', '<svg width="' + vbAncho + '" height="' + vbAlto + '" ');
      const img = new Image();
      const blob = new Blob([marcado], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = function () {
        try {
          const c = document.createElement('canvas');
          c.width = anchoDestino; c.height = altoDestino;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, anchoDestino, altoDestino);
          const s = Math.min(anchoDestino / vbAlto, altoDestino / vbAncho) * 0.96;
          ctx.translate(anchoDestino / 2, altoDestino / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -vbAncho * s / 2, -vbAlto * s / 2, vbAncho * s, vbAlto * s);
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

/* ═══════════════════════════════════════════════════════════════════════════
   PARTES DEL LIBRO QUE SE TOCAN (y sus tamaños de imagen)
   ═══════════════════════════════════════════════════════════════════════════ */

const HOJA_FICHA  = 'xl/worksheets/sheet1.xml';   // «Ficha Técnica»
const HOJA_ANEXO  = 'xl/worksheets/sheet6.xml';   // «Anexo AT»
const DIBUJO_HOJA1 = 'xl/drawings/drawing1.xml';
// Verificado en drawing3/_rels y drawing4/_rels de la plantilla:
const IMG_DIAG_ACTUAL = 'xl/media/image5.png';    // hoja 3 «Diagrama Actual»
const IMG_DIAG_FUTURO = 'xl/media/image6.png';    // hoja 4 «Diagrama Futuro»
// Tamaño en píxeles del recuadro de cada hoja (así lo trae la plantilla).
const CAJA_ACTUAL = { w: 778, h: 948 };
const CAJA_FUTURO = { w: 790, h: 842 };
// Caja de dibujo del unifilar (viewBox del SVG que entrega el módulo de diagramas).
const VB = { w: 640, h: 470 };
// Totales con SUM cuyo valor en caché se limpia para forzar recálculo.
const TOTALES_SUM = ['I78', 'J78'];
// Textos ancla de los cuadros de texto del dibujo de la hoja 1.
const ANCLA_FECHA = '<a:t>21/04/2026</a:t>';
const ANCLA_ANIO  = '<a:t>2027</a:t>';

/** Nombre de archivo sugerido. El llamador decide si lo usa. */
export function nombreArchivoFicha(equipo = {}) {
  const base = 'Ficha_Planificacion_' +
    (txt(equipo.subestacion) || ('fila_' + txt(equipo.fila))) + '_' + txt(equipo.serie);
  return base.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/_$/, '') + '.xlsx';
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTADOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Arma la Ficha Técnica de Planificación del equipo y devuelve el archivo.
 * NO descarga nada: eso lo decide quien llama.
 *
 * @param {object} equipo  registro del transformador. Se usan:
 *        fila · subestacion · serie · departamento · matricula · refrigeracion
 *        regulacion · potencia_kva · mva · kv_prim · kv_sec · kv_terc · nivel
 *        uucc_calculada · uucc_registrada
 * @param {object} [estado] lo que el usuario editó en la ficha:
 *        {
 *          plan: { proyecto, consecutivo, codestudio, municipio, alcance,
 *                  beneficios, potenciaMVA, presu_ucc, presu_unit, presu_cant,
 *                  presu_desc, fechaentrega, anioentrada },
 *          anexo: { transformador, onan, onaf, relacion, grupo, impedancia,
 *                   refrig, cambiador, extension, pctpaso, paralelo, observacion },
 *          diagramas: { actual: { svg, potONAN, potONAF, grupo, imped },
 *                       futuro: { svg } },      // dos unifilares INDEPENDIENTES
 *          municipio: '',        // respaldo si no se editó en `plan`
 *          uuccDecidida: ''      // UC decidida en la auditoría, si la hay
 *        }
 * @param {object} [opts]
 *        { plantillaBuffer?: ArrayBuffer,  // para pruebas: evita el fetch
 *          tipoSalida?: 'blob'|'uint8array' }
 * @returns {Promise<Blob|Uint8Array>} el .xlsx armado (Blob en el navegador)
 * @throws {Error} con mensaje en español si falta la plantilla o JSZip
 */
export async function exportarFichaPlanificacion(equipo, estado = {}, opts = {}) {
  if (!equipo) throw new Error('No hay transformador seleccionado para armar la ficha.');

  // 1) Plantilla oficial (ya no va incrustada en el código: se descarga del sitio).
  let buffer = opts.plantillaBuffer;
  if (!buffer) {
    let res;
    try {
      res = await fetch(rutaPlantilla());
    } catch (e) {
      throw new Error('No se pudo descargar la plantilla de la ficha (PE.02081). Revise la conexión e intente de nuevo.');
    }
    if (!res.ok) {
      throw new Error('No se pudo descargar la plantilla de la ficha (PE.02081): ' + res.status + ' ' + res.statusText + '.');
    }
    buffer = await res.arrayBuffer();
  }

  // 2) JSZip perezoso.
  const JSZip = await cargarJSZip();
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new Error('La plantilla de la ficha (PE.02081) no se pudo abrir: el archivo parece dañado.');
  }
  if (!zip.file(HOJA_FICHA)) {
    throw new Error('La plantilla de la ficha (PE.02081) no tiene la hoja esperada; no se generó nada.');
  }

  // 3) Hoja 1 «Ficha Técnica» — solo las celdas del mapa.
  let s1 = await zip.file(HOJA_FICHA).async('string');
  celdasFichaPlan(equipo, estado).forEach((m) => {
    if (m.formula) s1 = escribirFormula(s1, m.cell, m.formula);
    else s1 = escribirCelda(s1, m.cell, (m.clear ? '' : m.val), !!m.numeric, null);
  });
  TOTALES_SUM.forEach((ref) => { s1 = limpiarCacheFormula(s1, ref); });
  zip.file(HOJA_FICHA, s1);

  // 4) Forzar recálculo de fórmulas al abrir en Excel/Calc.
  try {
    let wbx = await zip.file('xl/workbook.xml').async('string');
    if (/<calcPr[^>]*\/>/.test(wbx) && !/fullCalcOnLoad/.test(wbx)) {
      wbx = wbx.replace(/<calcPr([^>]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
      zip.file('xl/workbook.xml', wbx);
    }
  } catch (e) { /* si no se puede, Excel recalcula al editar; no es motivo para abortar */ }

  // 5) Fecha de entrega y año de entrada: viven en cuadros de texto del dibujo
  //    de la hoja 1, no en celdas. Se sobrescriben por ficha para que no
  //    arrastren los valores del formato.
  try {
    const plan = estado.plan || {};
    const dr = zip.file(DIBUJO_HOJA1);
    if (dr) {
      let xml = await dr.async('string');
      xml = xml.replace(ANCLA_FECHA, '<a:t>' + escXml(plan.fechaentrega || '') + '</a:t>');
      xml = xml.replace(ANCLA_ANIO,  '<a:t>' + escXml(plan.anioentrada  || '') + '</a:t>');
      zip.file(DIBUJO_HOJA1, xml);
    }
  } catch (e) { /* el dibujo se conserva tal cual */ }

  // 6) Hoja «Anexo AT» con los datos de placa del equipo seleccionado.
  try {
    const anexo = zip.file(HOJA_ANEXO);
    if (anexo) {
      let s6 = await anexo.async('string');
      celdasAnexoAT(equipo, estado).forEach((m) => {
        s6 = escribirCelda(s6, m.cell, m.val, !!m.numeric, null);
      });
      zip.file(HOJA_ANEXO, s6);
    }
  } catch (e) { /* la hoja queda como en la plantilla */ }

  // 7) Los DOS unifilares — independientes: hoja 3 = Actual, hoja 4 = Futuro.
  //    Si el llamador no entrega SVG (o no hay canvas), se respeta la imagen
  //    de la plantilla en lugar de dejar la hoja vacía.
  try {
    const dg = estado.diagramas || {};
    const svgA = (dg.actual && dg.actual.svg) || null;
    const svgF = (dg.futuro && dg.futuro.svg) || null;
    if (svgA) {
      const png = await svgAPngRotado(svgA, CAJA_ACTUAL.w, CAJA_ACTUAL.h, VB.w, VB.h);
      if (png) zip.file(IMG_DIAG_ACTUAL, png);
    }
    if (svgF) {
      const png = await svgAPngRotado(svgF, CAJA_FUTURO.w, CAJA_FUTURO.h, VB.w, VB.h);
      if (png) zip.file(IMG_DIAG_FUTURO, png);
    }
  } catch (e) { /* los diagramas quedan como en la plantilla */ }

  // 8) Recomprimir. Nada más del libro se tocó: estilos, sharedStrings, temas,
  //    dibujos, encabezados, pies y cuadro de firmas salen idénticos.
  const tipo = opts.tipoSalida || (typeof Blob !== 'undefined' ? 'blob' : 'uint8array');
  return await zip.generateAsync({
    type: tipo,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
