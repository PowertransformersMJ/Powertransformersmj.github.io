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
//   · Hoja 1 «Ficha Técnica» → 17 celdas (proyecto, ubicación, alcance,
//     beneficios y la línea de inversión: presupuesto CREG, Valor Real y
//     Sistema) y, solo cuando su línea está pendiente, los dos totales del
//     proyecto (I78/J78), que entonces dicen [PENDIENTE] en vez de «0».
//   · Hoja 5 «Anexo AT»       → la fila 11 con los datos de placa del equipo.
//   · Hoja 3 «Diagrama Actual» y hoja 4 «Diagrama Futuro» → sus dos unifilares,
//     que son INDEPENDIENTES: cada hoja recibe el suyo (image5 = Actual,
//     image6 = Futuro; verificado en drawing3/drawing4 de la plantilla).
//   · Cuadros de texto del dibujo de la hoja 1: fecha de entrega, año de
//     entrada en operación y, en el cuadro de firmas, Nombre · Ocupación ·
//     Fecha de cada firmante (`99 §89`; la Firma queda a mano).
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
import { desgloseCreg, leerMonto, TEXTO_PENDIENTE } from '../../domain/fichas_presupuesto.js';
import { firmanteDe } from '../../domain/fichas_firmantes.js';
import { tamanoFirma, FIRMA_PAPEL } from '../../domain/firmas_tamano.js';
import { fechaParaPapel } from '../../domain/fichas_fechas.js';
import { limpiarOcultos } from './limpiar-ocultos.js';

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
    // Caracteres de control que XML 1.0 NO admite (llegan pegados de un PDF u
    // otro sistema): uno solo dejaba el dibujo mal formado y LibreOffice perdía
    // el cuadro Recibe y el logo (revisión §89). Se conservan \t, \n y \r.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  // OJO: TODOS los reemplazos van con FUNCIÓN, no con texto. En el texto de
  // reemplazo de `String.replace`, «$&», «$`», «$'» y «$$» son órdenes: un «$»
  // tecleado delante de « " < > & ' » (que escXml vuelve «&quot;», «&lt;»…) se
  // convertía en «$&» y metía la celda de la plantilla dentro del texto, y
  // «$`» metía todo el XML anterior y dejaba el archivo ilegible (`99 §87`).
  const celdaRe = new RegExp('<c r="' + ref + '"[^>]*?(?:/>|>[\\s\\S]*?</c>)');
  const m = xml.match(celdaRe);
  if (m) {
    const sM = m[0].match(/\ss="(\d+)"/);
    const nueva = construir(sM ? (' s="' + sM[1] + '"') : '');
    return xml.replace(celdaRe, () => nueva);
  }

  const celda = construir(estiloPlantilla ? (' s="' + estiloPlantilla + '"') : '');
  const filaRe = new RegExp('(<row r="' + row + '"[^>]*>)([\\s\\S]*?)(</row>)');
  const fm = xml.match(filaRe);
  if (!fm) {
    return xml.replace('</sheetData>', () => '<row r="' + row + '">' + celda + '</row></sheetData>');
  }
  const interior = fm[2];
  const objetivo = numeroDeColumna(col);
  let pos = interior.length;
  const celdas = [...interior.matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)];
  for (const cm of celdas) {
    if (numeroDeColumna(cm[1]) > objetivo) { pos = cm.index; break; }
  }
  return xml.replace(filaRe, () => fm[1] + interior.slice(0, pos) + celda + interior.slice(pos) + fm[3]);
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
  return xml.replace(celdaRe, () => celda);
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
  const r = clasificarUC(kva, equipo.kv_prim, equipo.kv_terc, equipo.regulacion, equipo.fases);
  return r.uucc_calc || estado.uuccDecidida || equipo.uucc_calculada || equipo.uucc_registrada || '';
}

/** Descripción normalizada de la UC, tal como la imprime la ficha. */
export function descripcionUC(equipo = {}, codigo) {
  // El catálogo CREG trae la descripción LITERAL de la resolución en `fila.desc`
  // —«AutoTransformador monofásico (OLTC)…», «Transformador tridevanado
  // trifásico (OLTC)…»—. Armarla a mano pegando «TRANSFORMADOR TRIFASICO»
  // delante describía un autotransformador monofásico como trifásico y un
  // tridevanado como bidevanado: familias distintas, con precios distintos, en
  // la celda D36 del PE.02081. Sin catálogo no se sabe la familia, así que no
  // se afirma.
  const r = buscarUC(codigo);
  if (r) {
    if (r.fila.desc) return String(r.fila.desc).toUpperCase();
    return 'TRANSFORMADOR (' + (r.fila.reg || '') + ') - LADO DE ALTA NIVEL ' +
      String(r.fila.nivel || equipo.nivel || '').replace('N', '') +
      ' - DE ' + String(r.fila.cap || '').toUpperCase();
  }
  return 'TRANSFORMADOR (' + txt(equipo.reg_catalogo) + ') - LADO DE ALTA NIVEL ' +
    txt(equipo.nivel).replace('N', '') + ' - DE ' + txt(equipo.banda).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAPA DE CELDAS · HOJA 1 «Ficha Técnica»
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * TOTAL DEL PROYECTO real cuando no hay Valor Real: en blanco mientras la
 * columna esté vacía (no «0»), y la suma del formato en cuanto haya una cifra.
 */
const FORMULA_TOTAL_REAL_EN_BLANCO = 'IF(COUNT(J34:J66)=0,"",SUM(J34:J66))';

/**
 * Celdas de la primera hoja que se rellenan, con el valor y su explicación.
 * Es una función PURA: el mismo mapa alimenta el exportador y la vista previa
 * que se le muestra al usuario antes de descargar.
 *
 * Cada entrada: { cell, campo, val, numeric?, formula?, clear?, pend?, motivo?,
 *                 plantilla?, derivada?, vista? }
 *   · `clear`   ⇒ la celda se deja en blanco (el dato no existe todavía).
 *   · `pend`    ⇒ falta un dato que nadie puede deducir; se marca [PENDIENTE]
 *                 y `motivo` dice qué falta (lo lee {@link pendientesFichaPlan}).
 *   · `formula` ⇒ se escribe una fórmula de Excel, no un valor.
 *   · `plantilla` ⇒ la celda NO se toca: manda la fórmula del formato oficial.
 *   · `derivada`  ⇒ total que hereda el pendiente de su línea (no se lista aparte).
 *
 * Dinero (CF-06): una casilla de plata sin dato NO sale en blanco ni en 0 —
 * dice [PENDIENTE], como ya lo decía la pantalla. Y su total tampoco: la
 * plantilla suma con SUM(), que trata el texto como cero y firmaría «0» en el
 * TOTAL DEL PROYECTO; por eso, solo mientras la línea esté pendiente, el total
 * se reemplaza por [PENDIENTE] (con dato, vuelve a mandar la fórmula oficial).
 * EXCEPCIÓN (§93): el Valor Real vacío NO es pendiente — va en blanco, y su
 * total también (nunca «0»); solo lo tecleado ilegible se marca [PENDIENTE].
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
  // El Valor Real lo teclea el Ingeniero con puntos de miles y coma decimal.
  // Se lee con `leerMonto`, la MISMA función con que la pantalla pinta su total:
  // acepta solo la forma colombiana y NO adivina. Con `parseFloat`
  // «2.100.000.000» se firmaría como 2,1 pesos; con la lectura tolerante,
  // «2.100 millones» se firmaba como 2.100 (`99 §87`).
  //
  // Sin Valor Real, la casilla va EN BLANCO, sin [PENDIENTE] y sin aviso: es un
  // dato que se llena cuando se conoce, no un faltante (orden del Ingeniero,
  // 2026-09-24, `99 §93`). Lo que SÍ avisa es lo tecleado que no es cifra: eso
  // ya es un error, no un valor que falta.
  const leidoReal = leerMonto(plan.presu_real);
  const real = leidoReal.valor;
  const realIlegible = leidoReal.estado === 'ilegible';
  const motivoReal = 'El Valor Real Total tecleado («' + recortar(plan.presu_real) + '») no se puede leer como cifra: '
    + 'escríbalo solo con números, p. ej. 2.100.000.000.';

  const sinInstalacion = presu.costoInstalacion == null;

  return [
    // `lleno` también decide el valor, no solo la marca: un campo con puros
    // espacios se escribía en blanco y a la vez se contaba como pendiente.
    { cell: 'D8',  campo: 'Proyecto',   val: (lleno(plan.proyecto) ? plan.proyecto : '[PENDIENTE: NOMBRE DEL PROYECTO]'), pend: !lleno(plan.proyecto),
      motivo: 'Falta el nombre del proyecto.' },
    { cell: 'H8',  campo: 'Consecutivo', val: txt(plan.consecutivo), clear: !lleno(plan.consecutivo), pend: false },
    { cell: 'D9',  campo: 'Cód estudio/tarea', val: txt(plan.codestudio), clear: !lleno(plan.codestudio), pend: false },
    { cell: 'H9',  campo: 'Ámbito', val: 'Media Tensión / Alta Tensión', pend: false },
    { cell: 'D13', campo: 'Zona', val: txt(equipo.departamento), pend: false },
    { cell: 'H13', campo: 'Subestación', val: txt(equipo.subestacion), pend: false },
    { cell: 'D14', campo: 'Municipio', val: (lleno(municipio) ? municipio : '[PENDIENTE: MUNICIPIO]'), pend: !lleno(municipio),
      motivo: 'Falta el municipio.' },
    { cell: 'B17', campo: 'Alcance', val: (lleno(plan.alcance) ? plan.alcance : '[PENDIENTE: ALCANCE — texto del proyecto]'), pend: !lleno(plan.alcance),
      motivo: 'Falta el texto del alcance.' },
    { cell: 'B23', campo: 'Beneficios', val: (lleno(plan.beneficios) ? plan.beneficios : '[PENDIENTE: BENEFICIOS — texto del proyecto]'), pend: !lleno(plan.beneficios),
      motivo: 'Falta el texto de los beneficios.' },
    { cell: 'B36', campo: 'Inversión · Subestación', val: txt(equipo.subestacion), pend: false },
    { cell: 'C36', campo: 'Inversión · UUCC', val: txt(U), pend: false },
    { cell: 'D36', campo: 'Inversión · Descripción', val: desc, pend: false },
    // OJO: «Valor CREG Unitario» (F36) NO es el $/MVA — es el COSTO DE
    // INSTALACIÓN de la UC. El $/MVA es el que multiplica a la potencia.
    { cell: 'F36', campo: 'Valor CREG Unitario', numeric: !sinInstalacion,
      val: (sinInstalacion ? TEXTO_PENDIENTE : presu.costoInstalacion), pend: sinInstalacion,
      motivo: (sinInstalacion ? presu.motivoTexto : null),
      vista: presu.costoInstalacion },
    { cell: 'H36', campo: 'Cantidad', val: presu.cantidad, numeric: true, pend: false },
    // I36 se escribe como FÓRMULA viva para que el revisor vea de dónde sale.
    { cell: 'I36', campo: 'Valor CREG Total',
      formula: (okTotal ? ('F36+(' + presu.mva + '*' + presu.valorUnitarioMVA + ')') : null),
      pend: !okTotal, motivo: (okTotal ? null : presu.motivoTexto),
      val: (okTotal ? presu.total : TEXTO_PENDIENTE),
      vista: presu.formula },
    // J36 y K36 los teclea el Ingeniero en la ficha. La plantilla ya trae J36
    // con formato de pesos y J78 = SUM(J34:J66): al escribir J36 el «TOTAL DEL
    // PROYECTO» real se llena solo (CF-05). Sin Valor Real ⇒ en blanco (§93);
    // tecleado ilegible ⇒ [PENDIENTE] con su motivo (CF-06).
    // «Sistema» no es dinero: vacío ⇒ en blanco, como en la pantalla.
    { cell: 'J36', campo: 'Valor Real Total', numeric: real != null,
      val: (real != null ? real : (realIlegible ? TEXTO_PENDIENTE : '')),
      clear: (real == null && !realIlegible), pend: realIlegible,
      motivo: (realIlegible ? motivoReal : null), vista: real },
    { cell: 'K36', campo: 'Sistema', val: txt(plan.presu_sistema).trim(),
      clear: !lleno(plan.presu_sistema), pend: false },
    // TOTAL DEL PROYECTO: con dato manda la fórmula SUM de la plantilla; con la
    // línea pendiente, [PENDIENTE] — nunca el «0» que SUM daría sobre el texto.
    { cell: 'I78', campo: 'TOTAL DEL PROYECTO (CREG)', derivada: true,
      plantilla: okTotal, pend: !okTotal, val: TEXTO_PENDIENTE },
    // Sin Valor Real, el total real tampoco firma «0» (lo que SUM da sobre
    // casillas vacías): se deja una suma que se ve EN BLANCO mientras la columna
    // esté vacía y que suma sola si luego se teclea la cifra en el Excel (§93).
    { cell: 'J78', campo: 'TOTAL DEL PROYECTO (real)', derivada: true,
      plantilla: real != null, pend: realIlegible,
      formula: ((real == null && !realIlegible) ? FORMULA_TOTAL_REAL_EN_BLANCO : null),
      val: TEXTO_PENDIENTE }
  ];
}

/** Texto tecleado, acortado para citarlo en un aviso. */
function recortar(v) {
  const s = txt(v).trim();
  return s.length > 40 ? s.slice(0, 39) + '…' : s;
}

/** Motivo común de los totales: heredan el pendiente de su línea. */
const MOTIVO_TOTAL = 'Queda [PENDIENTE] mientras su línea no tenga cifra.';

/**
 * Lo que el Excel va a llevar marcado [PENDIENTE], para decírselo al usuario
 * ANTES de descargar (CF-06). Una línea por motivo: si el Valor CREG Unitario
 * y el Total faltan por la misma causa, se dice una sola vez. Los totales van
 * al final, en su propia línea, para que la cuenta de casillas del aviso sea
 * la MISMA que la del papel (lo destapó la revisión de `99 §87`).
 *
 * @returns {Array<{campos: string[], motivo: string}>}  vacío si no falta nada
 */
export function pendientesFichaPlan(equipo = {}, estado = {}) {
  const porMotivo = new Map();
  const celdas = celdasFichaPlan(equipo, estado).filter((m) => m.pend);
  [...celdas.filter((m) => !m.derivada), ...celdas.filter((m) => m.derivada)]
    .forEach((m) => {
      const motivo = m.derivada ? MOTIVO_TOTAL : (m.motivo || ('Falta ' + m.campo + '.'));
      if (!porMotivo.has(motivo)) porMotivo.set(motivo, []);
      porMotivo.get(motivo).push(m.campo);
    });
  return [...porMotivo].map(([motivo, campos]) => ({ campos, motivo }));
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
   CUADRO DE FIRMAS (dibujo de la hoja 1)
   ── Cada firmante es un cuadro de texto de `drawing1.xml`. Se reconoce por su
      TÍTULO («Elaboración», «Revisión», «Aprobación», «Recibe»), no por su
      posición ni por su nombre interno (hay dos «Grupo 41» en la plantilla).
      El segundo aprobador es el único cuadro con «Nombre:» y SIN título: está
      dentro del de Aprobación. Solo se reescriben los renglones Nombre,
      Ocupación y Fecha; la Firma queda en blanco, para firmar a mano.
   ═══════════════════════════════════════════════════════════════════════════ */

const TITULO_CASILLA = Object.freeze({ 'Elaboración': 'elab', 'Revisión': 'rev', 'Aprobación': 'apr', 'Recibe': 'rec' });
const RENGLONES_FIRMA = Object.freeze(['Nombre:', 'Ocupación:', 'Fecha:']);
/** Tamaño (centésimas de punto) de los renglones del firmante. La plantilla trae
 *  11 pt pensando en «Nombre:» vacío; con los cargos dictados —largos y en
 *  mayúscula— a 11 pt la «Firma» y la «Fecha» se salían del cuadro en Aprobación
 *  (render de LibreOffice, `99 §89`). El título del cuadro no se toca. */
const SZ_FIRMANTE = '900';

/** Texto de un párrafo del dibujo, uniendo sus corridas (un renglón puede venir partido). */
function textoParrafo(p) {
  return [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('');
}

/** Cambia el tamaño de letra de un `<a:rPr>`/`<a:endParaRPr>` (lo añade si falta). */
function conTamano(etiqueta, sz) {
  return /\ssz="\d+"/.test(etiqueta)
    ? etiqueta.replace(/\ssz="\d+"/, ' sz="' + sz + '"')
    : etiqueta.replace(/^<(a:rPr|a:endParaRPr)\b/, '<$1 sz="' + sz + '"');
}

/** Pone el tamaño del firmante a TODAS las corridas y al fin de párrafo. */
function tamanoParrafo(p, sz) {
  return p.replace(/<a:(?:rPr|endParaRPr)\b[^>]*?\/?>/g, (m) => conTamano(m, sz));
}

/** Reescribe un párrafo con UNA sola corrida, conservando el formato de la primera. */
function reescribirParrafo(p, texto) {
  const corridas = [...p.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)];
  if (!corridas.length) return p;
  const primera = corridas[0];
  const ultima = corridas[corridas.length - 1];
  const rPr = (primera[0].match(/<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/) || ['<a:rPr/>'])[0];
  return p.slice(0, primera.index)
    + '<a:r>' + rPr + '<a:t>' + escXml(texto) + '</a:t></a:r>'
    + p.slice(ultima.index + ultima[0].length);
}

/**
 * Escribe en el cuadro de firmas del dibujo quién firma cada casilla.
 * Función pura sobre el XML: devuelve el dibujo con los renglones reescritos.
 *
 * @param {string} xml   `xl/drawings/drawing1.xml`
 * @param {object} plan  estado de la ficha (lo lee `firmanteDe`)
 * @returns {string}
 */
export function escribirFirmantes(xml, plan = {}) {
  return xml.replace(/<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/g, (ancla) => {
    const parrafos = [...ancla.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map((m) => m[0]);
    const textos = parrafos.map((p) => textoParrafo(p).trim());
    if (!textos.some((t) => t.startsWith('Nombre:'))) return ancla;
    const titulo = textos.find((t) => TITULO_CASILLA[t]);
    const k = titulo ? TITULO_CASILLA[titulo] : 'apr2';
    const f = firmanteDe(k, plan);
    // La fecha sale siempre «dd/mm/aaaa», como la escribe el calendario (`99 §91`).
    const valor = { 'Nombre:': f.nombre, 'Ocupación:': f.ocupacion, 'Fecha:': fechaParaPapel(f.fecha) };
    // «Firma:» y «Fecha:» AL PIE de cada cuadro, alineadas en los cinco (como en
    // la pantalla, `§89`): el cuadro de texto del firmante pasa a alinearse
    // abajo. Así la línea de firma no se mueve con los renglones del nombre y
    // del cargo, ni con la letra que cada programa use en lugar de la DIN de la
    // plantilla (`99 §98`), y la firma estampada cae siempre en su línea.
    ancla = ancla.replace(/<xdr:sp\b[\s\S]*?<\/xdr:sp>/g, (sp) => (/Nombre:/.test(sp)
      ? sp.replace(/(<a:bodyPr\b[^>]*?)\sanchor="t"/, (m, a) => a + ' anchor="b"')
      : sp));
    // Reemplazo con FUNCIÓN: un «$» del nombre no debe leerse como orden (`§87`).
    return ancla.replace(/<a:p>[\s\S]*?<\/a:p>/g, (p) => {
      const t = textoParrafo(p).trim();
      if (TITULO_CASILLA[t]) return p;                    // el título se queda como está
      const renglon = RENGLONES_FIRMA.find((r) => t.startsWith(r));
      const nuevo = renglon
        ? reescribirParrafo(p, (renglon + ' ' + (valor[renglon] || '')).trimEnd() + (valor[renglon] ? '' : ' '))
        : p;
      return tamanoParrafo(nuevo, SZ_FIRMANTE);           // Firma y separadores, al mismo tamaño
    });
  });
}

/**
 * Las dos imágenes que la plantilla tiene en la zona de firma (filas ≥ 90 de la
 * hoja 1) son RECTÁNGULOS BLANCOS: ahí iban las firmas escaneadas que se
 * retiraron por privacidad (`§70`). Están dibujadas ENCIMA de los cuadros de
 * texto y tapaban lo escrito (la fecha de Elaboración perdía su último dígito,
 * `99 §89`). No se borran: se llevan al FONDO del dibujo, detrás de los cuadros.
 *
 * @param {string} xml  `xl/drawings/drawing1.xml`
 * @returns {string}
 */
export function imagenesDeFirmaAlFondo(xml) {
  const reAncla = /<xdr:(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:\1>/g;
  const alFondo = [];
  const resto = xml.replace(reAncla, (ancla) => {
    const fila = ancla.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    if (/<xdr:pic>/.test(ancla) && fila && +fila[1] >= 90) { alFondo.push(ancla); return ''; }
    return ancla;
  });
  if (!alFondo.length) return xml;
  return resto.replace(/(<xdr:wsDr\b[^>]*>)/, (m) => m + alFondo.join(''));
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIRMA ESTAMPADA (`99 §98`)
   ── La firma de QUIEN TIENE LA SESIÓN, solo en su casilla (`§71`). El módulo
      de la ficha decide de quién es cada casilla (`casillaEsDeLaSesion`) y
      entrega aquí únicamente esas; este exportador no sabe de sesiones ni
      puede pedir la firma de nadie. Se dibuja sobre la línea «Firma:», a la
      derecha del rótulo, como iban las firmas escaneadas que la plantilla
      tuvo en su día (sus huecos blancos siguen al fondo, `§89`).
   ═══════════════════════════════════════════════════════════════════════════ */

const EMU_PX = 9525;
const EMU_PT = 12700;
/** Ancho de columna de Excel (en caracteres) → píxeles, con dígito máximo de 7 px. */
const anchoColumnaPx = (w) => Math.trunc(((256 * w + Math.trunc(128 / 7)) / 256) * 7);
const attrNum = (tag, nombre) => {
  const m = tag.match(new RegExp('\\s' + nombre + '="([\\d.]+)"'));
  return m ? +m[1] : null;
};

/**
 * Geometría de la hoja (en EMU): dónde empieza cada columna y cada fila, y la
 * conversión inversa de un punto absoluto a celda + desplazamiento.
 * @param {string} hojaXml  `xl/worksheets/sheet1.xml`
 */
export function geometriaHoja(hojaXml) {
  const fmt = (hojaXml.match(/<sheetFormatPr\b[^>]*>/) || [''])[0];
  const anchoDef = attrNum(fmt, 'defaultColWidth') || 8.43;
  const altoDef = attrNum(fmt, 'defaultRowHeight') || 15;
  const cols = [...hojaXml.matchAll(/<col\b[^>]*>/g)]
    .map((m) => ({ min: attrNum(m[0], 'min'), max: attrNum(m[0], 'max'), w: attrNum(m[0], 'width') }));
  const altos = {};
  for (const m of hojaXml.matchAll(/<row r="(\d+)"([^>]*)>/g)) {
    const ht = attrNum(m[2], 'ht');
    if (ht != null) altos[+m[1] - 1] = ht;
  }
  const anchoCol = (c) => {
    const k = cols.find((x) => c + 1 >= x.min && c + 1 <= x.max);
    return anchoColumnaPx(k && k.w ? k.w : anchoDef) * EMU_PX;
  };
  const altoFila = (r) => Math.round((altos[r] != null ? altos[r] : altoDef) * EMU_PT);
  const x = (col, off) => { let t = 0; for (let c = 0; c < col; c++) t += anchoCol(c); return t + off; };
  const y = (row, off) => { let t = 0; for (let r = 0; r < row; r++) t += altoFila(r); return t + off; };
  const aCelda = (valor, medida) => {
    let i = 0; let resto = Math.max(0, Math.round(valor));
    while (i < 20000 && resto >= medida(i)) { resto -= medida(i); i++; }
    return { i, off: resto };
  };
  return {
    x, y,
    celda(X, Y) {
      const c = aCelda(X, anchoCol); const r = aCelda(Y, altoFila);
      return { col: c.i, colOff: c.off, row: r.i, rowOff: r.off };
    }
  };
}

/**
 * Caja (en EMU absolutos) de cada casilla de firma del dibujo de la hoja 1,
 * identificada igual que al escribir los firmantes (por su título; la segunda
 * de Aprobación no lo lleva).
 */
export function cajasDeFirma(dibujoXml, geo) {
  const cajas = {};
  const pos = (ancla, t) => {
    const m = ancla.match(new RegExp('<xdr:' + t + '><xdr:col>(\\d+)</xdr:col><xdr:colOff>(-?\\d+)</xdr:colOff>'
      + '<xdr:row>(\\d+)</xdr:row><xdr:rowOff>(-?\\d+)</xdr:rowOff></xdr:' + t + '>'));
    return m ? { x: geo.x(+m[1], +m[2]), y: geo.y(+m[3], +m[4]) } : null;
  };
  for (const m of dibujoXml.matchAll(/<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g)) {
    const ancla = m[0];
    const textos = [...ancla.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map((p) => textoParrafo(p[0]).trim());
    if (!textos.some((t) => t.startsWith('Nombre:'))) continue;
    const titulo = textos.find((t) => TITULO_CASILLA[t]);
    const k = titulo ? TITULO_CASILLA[titulo] : 'apr2';
    const a = pos(ancla, 'from'); const b = pos(ancla, 'to');
    if (!a || !b || cajas[k]) continue;
    // Cuadro de TEXTO del firmante: en un grupo, su lugar dentro del grupo se
    // lleva al rectángulo del ancla (coordenadas hijas → ancla).
    const sps = [...ancla.matchAll(/<xdr:sp\b[\s\S]*?<\/xdr:sp>/g)].map((x) => x[0]);
    const spTexto = sps.find((x) => /Nombre:/.test(x)) || '';
    const body = (spTexto.match(/<a:bodyPr\b[^>]*>/) || [''])[0];
    const lIns = attrNum(body, 'lIns');
    const ch = ancla.match(/<a:chOff x="(-?\d+)" y="(-?\d+)"\/><a:chExt cx="(\d+)" cy="(\d+)"\/>/);
    const xf = spTexto.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/);
    let pieTexto = b.y;
    if (ch && xf && +ch[4] > 0) {
      pieTexto = a.y + ((+xf[2] + +xf[4]) - +ch[2]) / +ch[4] * (b.y - a.y);
    }
    cajas[k] = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, lIns: lIns != null ? lIns : 91440, pieTexto };
  }
  // El cuadro de Aprobación abarca también la segunda casilla: la primera firma
  // va en su mitad izquierda, sin montarse sobre la del segundo aprobador.
  if (cajas.apr && cajas.apr2) cajas.apr.x1 = Math.min(cajas.apr.x1, cajas.apr2.x0);
  return cajas;
}

/**
 * Del pie del cuadro de texto al pie de la firma. Con el texto alineado abajo,
 * «Fecha:» es el último renglón y «Firma:» el de encima, a la misma altura en
 * los cinco cuadros (render de LibreOffice de la plantilla oficial): la firma
 * apoya su trazo en esa línea y no baja hasta tapar la fecha. Una prueba vigila
 * que cada firma caiga dentro de su casilla.
 */
const PIE_SOBRE_TEXTO = Math.round(11.5 * EMU_PT);
/** Ancho del rótulo «Firma:» más un respiro: la firma empieza a su derecha. */
const TRAS_ROTULO = Math.round(31 * EMU_PT);
/** Alto MÁXIMO de la firma estampada (≈ 0,31 pulgadas): el renglón de «Firma:»
 *  sin tapar el texto de encima. */
const ALTO_FIRMA = Math.round(FIRMA_PAPEL.altoMaxPt * EMU_PT);
/** Superficie de cada firma (`99 §101`): todas pesan lo mismo a la vista. */
const AREA_FIRMA = FIRMA_PAPEL.areaPt2 * EMU_PT * EMU_PT;
/** Margen derecho dentro de la casilla. */
const MARGEN_DERECHO = Math.round(4 * EMU_PT);

/**
 * Dónde va la firma dentro de su casilla: su trazo apoyado en la línea
 * «Firma:», a la derecha del rótulo y sin salirse del cuadro. `rel` = ancho / alto.
 */
export function ubicacionFirma(caja, rel) {
  const x = caja.x0 + (caja.lIns || 0) + TRAS_ROTULO;
  const anchoMax = Math.max(0, caja.x1 - x - MARGEN_DERECHO);
  const t = tamanoFirma(rel, { area: AREA_FIRMA, altoMax: ALTO_FIRMA, anchoMax });
  const ancho = Math.round(t.ancho);
  const alto = Math.round(t.alto);
  const pie = (caja.pieTexto != null ? caja.pieTexto : caja.y1) - PIE_SOBRE_TEXTO;
  return { x, y: Math.max(caja.y0, pie - alto), cx: ancho, cy: alto };
}

/** dataURL PNG → bytes. */
export function bytesDePng(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const bin = atob(m[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Estampa las firmas entregadas en el dibujo de la hoja 1. PURA: devuelve el
 * dibujo y sus relaciones nuevos, y los archivos de imagen que hay que añadir.
 *
 * @param {string} dibujoXml   `xl/drawings/drawing1.xml`
 * @param {string} relsXml     `xl/drawings/_rels/drawing1.xml.rels`
 * @param {string} hojaXml     `xl/worksheets/sheet1.xml` (geometría)
 * @param {Object<string,{dataUrl:string, rel:number}>} firmas  solo las casillas de la sesión
 * @returns {{dibujo:string, rels:string, medios:Array<{ruta:string, bytes:Uint8Array}>}}
 */
export function estamparFirmas(dibujoXml, relsXml, hojaXml, firmas) {
  const medios = [];
  const claves = Object.keys(firmas || {}).filter((k) => CASILLAS_ESTAMPABLES.includes(k));
  if (!claves.length) return { dibujo: dibujoXml, rels: relsXml, medios };
  const geo = geometriaHoja(hojaXml);
  const cajas = cajasDeFirma(dibujoXml, geo);
  let idMax = Math.max(0, ...[...dibujoXml.matchAll(/<xdr:cNvPr id="(\d+)"/g)].map((m) => +m[1]));
  let dibujo = dibujoXml;
  let rels = relsXml;
  const anclas = [];
  for (const k of claves) {
    const caja = cajas[k];
    const bytes = bytesDePng(firmas[k] && firmas[k].dataUrl);
    if (!caja || !bytes) continue;
    const u = ubicacionFirma(caja, firmas[k].rel);
    const c = geo.celda(u.x, u.y);
    const rid = 'rIdFirma' + k;
    const ruta = 'xl/media/firma-' + k + '.png';
    medios.push({ ruta, bytes });
    rels = rels.replace('</Relationships>', () => '<Relationship Id="' + rid + '" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
      + 'Target="../media/firma-' + k + '.png"/></Relationships>');
    idMax += 1;
    anclas.push('<xdr:oneCellAnchor>'
      + '<xdr:from><xdr:col>' + c.col + '</xdr:col><xdr:colOff>' + c.colOff + '</xdr:colOff>'
      + '<xdr:row>' + c.row + '</xdr:row><xdr:rowOff>' + c.rowOff + '</xdr:rowOff></xdr:from>'
      + '<xdr:ext cx="' + u.cx + '" cy="' + u.cy + '"/>'
      + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + idMax + '" name="Firma ' + k + '" descr="Firma"/>'
      + '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      + 'r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
      + '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + u.cx + '" cy="' + u.cy + '"/></a:xfrm>'
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>'
      + '<xdr:clientData/></xdr:oneCellAnchor>');
  }
  // Al FINAL del dibujo: encima de los cuadros de texto, como una firma real.
  if (anclas.length) dibujo = dibujo.replace('</xdr:wsDr>', () => anclas.join('') + '</xdr:wsDr>');
  return { dibujo, rels, medios };
}

/** Casillas donde se puede estampar una firma. */
const CASILLAS_ESTAMPABLES = Object.freeze(['elab', 'rev', 'apr', 'apr2', 'rec']);

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
// Sus relaciones (imágenes): ahí se da de alta la firma estampada (`99 §98`).
const RELS_DIBUJO_HOJA1 = 'xl/drawings/_rels/drawing1.xml.rels';
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
    if (m.plantilla) return;                      // manda la fórmula del formato
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
      // Reemplazo con función: un «$» tecleado no debe leerse como orden.
      xml = xml.replace(ANCLA_FECHA, () => '<a:t>' + escXml(fechaParaPapel(plan.fechaentrega)) + '</a:t>');
      xml = xml.replace(ANCLA_ANIO,  () => '<a:t>' + escXml(plan.anioentrada  || '') + '</a:t>');
      // Quién firma: Nombre · Ocupación · Fecha de cada casilla (`99 §89`).
      xml = escribirFirmantes(xml, plan);
      xml = imagenesDeFirmaAlFondo(xml);
      // La firma de la sesión, SOLO en sus casillas (`99 §98`). Si algo falla,
      // la ficha sale igual, para firmar a mano: nunca se deja de emitir.
      if (estado.firmas && Object.keys(estado.firmas).length) {
        try {
          const relsF = zip.file(RELS_DIBUJO_HOJA1);
          const hojaF = zip.file(HOJA_FICHA);
          if (relsF && hojaF) {
            const r = estamparFirmas(xml, await relsF.async('string'), await hojaF.async('string'), estado.firmas);
            if (r.medios.length) {
              r.medios.forEach((m) => zip.file(m.ruta, m.bytes));
              zip.file(RELS_DIBUJO_HOJA1, r.rels);
              xml = r.dibujo;
            }
          }
        } catch (e) { /* sin firma estampada: se firma a mano */ }
      }
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

  // 8) Sin datos ocultos (`99 §104`): vínculo a otro archivo, propiedades y
  //    etiquetas heredadas, impresora, nombres rotos y lo dibujado fuera del área
  //    de impresión. Lo visible no cambia. Si la limpieza falla, sale como antes.
  try {
    await limpiarOcultos(zip);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[fichas] no se pudieron quitar los datos ocultos:', e && e.message);
  }

  // 9) Recomprimir. Nada más del libro se tocó: estilos, temas, dibujos dentro
  //    del área, encabezados, pies y cuadro de firmas salen idénticos.
  const tipo = opts.tipoSalida || (typeof Blob !== 'undefined' ? 'blob' : 'uint8array');
  return await zip.generateAsync({
    type: tipo,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
