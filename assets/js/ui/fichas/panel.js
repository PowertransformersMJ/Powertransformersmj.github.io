// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · PANEL (componente que monta el módulo)
// ──────────────────────────────────────────────────────────────────────────────
// QUÉ ES
// El cuerpo del módulo de Fichas Técnicas dentro de una página nativa AQUA:
//   · Tablero de flota — KPIs (clicables), buscador, filtros y tabla.
//   · Modal de ficha con las SEIS hojas del formato PE.02081:
//     Ficha Técnica · Beneficios · Diagrama Actual · Diagrama Futuro ·
//     Anexo AT · Plan de acciones.
//   · Selector de redacción de ALCANCE y BENEFICIOS (las cuatro versiones del
//     dueño + la automática anclada en datos medidos), editable a mano.
//   · Presupuesto con el desglose a la vista: instalación + (MVA × $/MVA).
//   · Exportación del .xlsx oficial, cargada de forma PEREZOSA.
//
// QUÉ **NO** HACE (a propósito)
//   · No calcula: el veredicto CREG, el presupuesto, el DP/vida y la redacción
//     automática viven en `domain/` y aquí solo se PINTAN. Reimplementarlos
//     sería un defecto (y una segunda verdad que se desincroniza).
//   · No conoce Firestore: recibe los equipos ya listos (`opciones.datos`) o
//     una función de carga (`opciones.fuente`, por defecto `SGM_DATA_SOURCE`).
//     Así la misma pieza sirve a la página real y al preview sin sesión.
//   · No inventa datos: si no hay fuente, muestra un estado vacío honesto.
//
// TODO el marcado que produce este archivo vive bajo el prefijo `.ftm-`
// (hoja `assets/css/fichas-tecnicas.css`). Cero clases del sitio, cero estilos
// globales: el módulo no puede despeinar la página ni al revés.
//
// Sin `onclick=` en el HTML: todo por delegación de eventos sobre la raíz.
// ══════════════════════════════════════════════════════════════════════════════

import { clasificarUC, buscarUC, hayAdvertencia, montoCOP } from '../../domain/fichas_creg_uc.js';
import { desgloseCreg, variacionReal, formatearCOP } from '../../domain/fichas_presupuesto.js';
import {
  dpInfo, modoDegradacion, redaccionAlcance, redaccionBeneficios, numES
} from '../../domain/fichas_diagnostico.js';
import { atraparFoco } from '../foco-modal.js';
import { construirFichaTecnica, colorCondicion, nombreCondicion } from './ficha-tecnica.js';
import {
  parametrosDiagrama, fijarParametro, copiarActualAFuturo, unifilarDeEquipo,
  claveEquipo, TITULO_DIAGRAMA
} from './unifilar.js';
import {
  vistaAnalitica, vistaNorma, vistaAgregar, resumenGerencial
} from './vistas-gerenciales.js';
import {
  CAMPOS_EDITABLES, esNovedad, resumenNovedades, barraCorreccionesHTML,
  cajonHTML, filasActa, decisionesDesdeActa, aplicarDecisiones, COLUMNAS_ACTA
} from './correcciones.js';

/* ═══════════════════════════════════════════════════════════════════════════
   1 · CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Las cuatro vistas del módulo. El original v22 las tenía todas; el port
 * inicial (ADR-061) solo trajo el tablero, pese a que la hoja de estilos ya
 * traía el marcado de las cuatro: 189 de sus 339 clases no las usaba nadie
 * (ADR-064). La barra usa el sistema de pestañas del SITIO (`tabs.css`,
 * role=tab + aria-selected), no el del archivo suelto: el entorno manda.
 */
export const VISTAS = Object.freeze([
  { id: 'tablero',   lbl: 'Tablero' },
  { id: 'analitica', lbl: 'Analítica gerencial' },
  { id: 'norma',     lbl: 'Norma CREG · Tablas 51 y 52' },
  { id: 'agregar',   lbl: 'Agregar transformador' }
]);

/** Las seis hojas del modal, en el orden del formato oficial. */
export const HOJAS_FICHA = Object.freeze([
  { id: 'ficha',   t: 'Ficha Técnica' },
  { id: 'benef',   t: 'Beneficios' },
  { id: 'diagA',   t: 'Diagrama Actual' },
  { id: 'diagF',   t: 'Diagrama Futuro' },
  { id: 'anexoAT', t: 'Anexo AT' },
  { id: 'plan',    t: 'Plan de acciones', anexo: true }
]);

/** Categorías del tablero. `f` decide si un equipo entra en la categoría. */
export const CATEGORIAS = Object.freeze([
  { id: 'ALL',            cls: 'ftm-kpi--total', lbl: 'Total',           f: () => true },
  { id: 'CONCORDANTE',    cls: 'ftm-kpi--ok',    lbl: 'Concordantes',    f: (e) => e.estado === 'CONCORDANTE' },
  { id: 'DISCREPANCIA',   cls: 'ftm-kpi--err',   lbl: 'Discrepancias',   f: (e) => e.estado === 'DISCREPANCIA' },
  { id: 'FALTA REGISTRO', cls: 'ftm-kpi--falta', lbl: 'Falta registro',  f: (e) => e.estado === 'FALTA REGISTRO' },
  { id: 'SIN CALCULO',    cls: 'ftm-kpi--sin',   lbl: 'Sin UC calculada', f: (e) => e.estado === 'SIN CALCULO' },
  { id: 'ADVERTENCIA',    cls: 'ftm-kpi--warn',  lbl: 'Con advertencia', f: (e) => !!e.advertencia }
]);

const ETIQUETA_ESTADO = Object.freeze({
  'CONCORDANTE': 'Concordante',
  'DISCREPANCIA': 'Discrepancia',
  'FALTA REGISTRO': 'Falta registro',
  'SIN CALCULO': 'Sin cálculo'
});

const CLASE_PILL = Object.freeze({
  'CONCORDANTE': 'ftm-pill--ok',
  'DISCREPANCIA': 'ftm-pill--err',
  'FALTA REGISTRO': 'ftm-pill--falta',
  'SIN CALCULO': 'ftm-pill--sin'
});

const CLASE_FILA = Object.freeze({
  'DISCREPANCIA': 'ftm-row--disc',
  'FALTA REGISTRO': 'ftm-row--falta',
  'SIN CALCULO': 'ftm-row--sin'
});

/** Columnas de la tabla de flota (clave de ordenamiento + etiqueta). */
const COLUMNAS = Object.freeze([
  { k: 'subestacion',      t: 'Subestación' },
  { k: 'matricula',        t: 'Matrícula',  chica: true },
  { k: 'potencia_kva',     t: 'kVA',        num: true },
  { k: 'mva',              t: 'MVA',        chica: true, num: true },
  { k: 'kv_prim',          t: 'Vp',         chica: true, num: true },
  { k: 'nivel',            t: 'Nivel' },
  { k: 'uucc_registrada',  t: 'Registrada' },
  { k: 'uucc_calculada',   t: 'Calculada' },
  { k: 'estado',           t: 'Estado' },
  { k: 'cond_int',         t: 'Condición',  num: true },
  { k: null,               t: 'Ficha' }
]);

/**
 * Las CUATRO redacciones del ALCANCE escritas por el dueño. `{MVA}` y `{SUB}`
 * se resuelven con la potencia DEL PROYECTO y la subestación del equipo.
 * La quinta (V5) no es plantilla: la redacta el dominio con los datos medidos.
 */
export const ALCANCE_OPC = Object.freeze([
  { t: 'V1 · Gestión de activos (integral)', v: 'El presente proyecto tiene por alcance la reposición del transformador de potencia de {MVA} MVA actualmente en operación en la subestación {SUB}, cuyo diagnóstico bajo la metodología de gestión de activos (índice de salud del activo) arroja una condición de fin de vida útil y un nivel de riesgo operativo no tolerable. La evaluación técnica —soportada en el historial de operación y mantenimiento y en los ensayos físico-químicos y dieléctricos— evidencia envejecimiento acelerado del sistema de aislamiento como consecuencia de un régimen de sobrecarga sostenido: despolimerización de la celulosa (papel Kraft) reflejada en concentraciones elevadas de compuestos furánicos (2-FAL) y en la consecuente caída del grado de polimerización (DP), oxidación y degradación del aceite dieléctrico, y evidencia de pirólisis por superación reiterada de la temperatura del punto más caliente (hot-spot) en los devanados. Este cuadro compromete de forma irreversible la confiabilidad del equipo a corto plazo. En consecuencia, y en el marco de la gestión de activos, la reposición inmediata por una unidad de igual capacidad ({MVA} MVA) y mejor estado de salud se establece como medida prioritaria de mitigación de riesgo, orientada a garantizar la disponibilidad, la seguridad operacional y la sostenibilidad del suministro en la zona de influencia.' },
  { t: 'V2 · Evidencia de laboratorio', v: 'El alcance del proyecto comprende la adquisición e incorporación de un nuevo transformador de potencia de {MVA} MVA en reemplazo de la unidad instalada en la subestación {SUB}, cuya condición ha sido determinada mediante criterios objetivos de diagnóstico. Los resultados del análisis de gases disueltos (DGA), el contenido de compuestos furánicos (2-FAL) como marcador de degradación del papel aislante, la estimación del grado de polimerización (DP) y los ensayos físico-químicos del aceite (acidez, tensión interfacial, rigidez dieléctrica y factor de disipación) son consistentes entre sí y confirman que el equipo se encuentra al final de su vida útil, con envejecimiento térmico acelerado atribuible a un régimen de sobrecarga permanente y a la superación recurrente de la temperatura de punto caliente. La pérdida de resistencia mecánica del aislamiento sólido eleva de manera significativa la probabilidad de falla dieléctrica ante esfuerzos transitorios. Por lo anterior, la reposición inmediata del activo se define como acción prioritaria de mitigación, dirigida a preservar la disponibilidad, la seguridad operacional y la continuidad del suministro en la zona de influencia.' },
  { t: 'V3 · Riesgo y continuidad del servicio', v: 'El proyecto tiene como alcance la reposición del transformador de potencia de {MVA} MVA de la subestación {SUB}, activo clasificado como crítico dentro del sistema y que, conforme a la metodología de salud de activos, presenta un riesgo operativo significativo derivado de su edad, su historial de mantenimiento y su condición actual de operación. Técnicamente, el equipo evidencia envejecimiento acelerado por régimen de sobrecarga permanente, con degradación del aislamiento sólido (celulosa) confirmada por el nivel de compuestos furánicos (2-FAL), oxidación del aceite dieléctrico y efectos de pirólisis asociados a la superación de la temperatura interna admisible en los devanados; factores que comprometen su desempeño fiable a corto plazo y que, ante una eventual falla, se traducirían en energía no suministrada (ENS), afectación de los indicadores de continuidad y posibles compensaciones regulatorias por calidad del servicio. En este contexto, la incorporación inmediata de una nueva unidad de {MVA} MVA constituye la medida prioritaria de mitigación de riesgo para asegurar la disponibilidad, la seguridad operacional y la sostenibilidad del suministro en la zona de influencia.' },
  { t: 'V4 · Compacta y contundente', v: 'El alcance del proyecto consiste en la adquisición y reposición del transformador de potencia de {MVA} MVA que opera actualmente en la subestación {SUB}, evaluado bajo la metodología de salud de activos con resultado de riesgo operativo significativo por edad, historial de mantenimiento y condición de operación. El equipo presenta envejecimiento acelerado por régimen de sobrecarga permanente, con degradación del aislamiento sólido (celulosa), oxidación del aceite y efectos de pirólisis por superación de la temperatura interna en los devanados; el nivel de compuestos furánicos (2-FAL) confirma que el transformador se encuentra al final de su vida útil, comprometiendo su desempeño fiable a corto plazo. Desde la gestión de activos, la reposición inmediata por una unidad de igual capacidad y mejor estado de salud se considera prioritaria como medida de mitigación de riesgo, para garantizar la disponibilidad, la seguridad operacional y la sostenibilidad del suministro en la zona de influencia.' },
  { t: 'V5 · Automática · anclada en datos medidos', auto: 'alcance' }
]);

/** Las cuatro redacciones de BENEFICIOS del dueño + la automática. */
export const BENEF_OPC = Object.freeze([
  { t: 'V1 · Técnico-operativa', v: '· Mayor confiabilidad operativa: la sustitución por una unidad de igual capacidad ({MVA} MVA) con índice de salud óptimo reduce sustancialmente la probabilidad de falla y de salidas intempestivas de servicio.\n· Aumento de la disponibilidad del suministro: menor frecuencia y duración de interrupciones, con impacto directo en la continuidad del servicio y en los indicadores de calidad (SAIDI/SAIFI) de la zona de influencia.\n· Reducción del riesgo operativo y de seguridad: elimina el riesgo asociado a un activo en fin de vida (confirmado por 2-FAL), disminuyendo la probabilidad de fallas catastróficas, incendios y daños a equipos y personas.\n· Menor costo total de propiedad (TCO): reduce el gasto por mantenimiento correctivo, ensayos de emergencia y compensaciones por indisponibilidad, y optimiza el plan de mantenimiento preventivo.\n· Mejora de la calidad de energía: mayor estabilidad de tensión y menor probabilidad de perturbaciones que afecten cargas sensibles.' },
  { t: 'V2 · Gestión de activos / riesgo', v: '· Mitigación efectiva del riesgo: traslada el activo de una condición de riesgo no tolerable a un nivel controlado, alineado con la política de gestión de activos (ISO 55001).\n· Restablecimiento de la vida útil: el nuevo transformador reinicia la curva de vida del aislamiento, recuperando margen de operación y capacidad de sobrecarga de emergencia.\n· Confiabilidad y disponibilidad: menor tasa de fallas y mayor tiempo medio entre fallas (MTBF), con la consecuente reducción de la energía no suministrada (ENS).\n· Seguridad de personas e instalaciones: elimina el escenario de falla violenta del equipo en fin de vida, protegiendo al personal y a los activos adyacentes de la subestación.\n· Sostenibilidad del suministro: asegura la continuidad del servicio en la zona de influencia y respalda el crecimiento de la demanda.' },
  { t: 'V3 · Continuidad, regulatorio y económico', v: '· Continuidad del servicio: reduce interrupciones y mejora los indicadores de calidad (SAIDI/SAIFI), evitando compensaciones regulatorias por deficiencias en la prestación.\n· Reducción de la energía no suministrada (ENS): disminuye el riesgo de grandes volúmenes de energía no entregada ante una falla del activo actual.\n· Optimización económica: minimiza costos por mantenimiento correctivo y atención de emergencias, mejorando el costo total de propiedad del activo.\n· Eficiencia energética: una unidad en óptimo estado, diseñada bajo la normativa de eficiencia vigente, opera con menores pérdidas y mejor comportamiento térmico, en línea con los objetivos de un SGEn (ISO 50001).\n· Calidad de energía: mayor estabilidad de tensión y menor probabilidad de perturbaciones sobre cargas sensibles.' },
  { t: 'V4 · Compacta y contundente', v: '· Confiabilidad: menor probabilidad de fallas imprevistas y salidas de servicio.\n· Disponibilidad: mayor continuidad del suministro en la zona de influencia.\n· Seguridad: elimina el riesgo de eventos catastróficos asociados al activo en fin de vida.\n· Economía: reduce el costo total de propiedad del activo.\n· Calidad y sostenibilidad: mejor calidad de energía y suministro sostenible a largo plazo.' },
  { t: 'V5 · Automática · anclada en datos medidos', auto: 'beneficios' }
]);

/**
 * Cuadro de firmas del formato oficial. Solo el ROL (que es parte del formato);
 * el nombre y el cargo los escribe quien emite la ficha — este repo es público
 * y no lleva nombres de personas.
 */
const FIRMAS = Object.freeze([
  { k: 'elab', rol: 'Elaboración' },
  { k: 'rev',  rol: 'Revisión' },
  { k: 'apr',  rol: 'Aprobación' },
  { k: 'rec',  rol: 'Recibe' }
]);

/** Campos del formulario de un diagrama: [clave, etiqueta, placeholder, ancho px]. */
const CAMPOS_DIAG = Object.freeze([
  ['matricula', 'Matrícula', '', 120],
  ['potONAN', 'Pot. ONAN', 'MVA', 58],
  ['potONAF', 'Pot. ONAF', 'MVA', 58],
  ['grupo', 'Grupo conexión', 'Dyn11', 78],
  ['imped', 'Impedancia %', '', 52],
  ['kvPrim', 'V primaria', 'kV', 52],
  ['kvSec', 'V secundaria', 'kV', 52],
  ['reg', 'Regulación', 'OLTC / NLTC', 86]
]);

/** Campos del Anexo AT: [clave, etiqueta, placeholder]. */
const CAMPOS_ANEXO_1 = Object.freeze([
  ['transformador', 'Transformador', ''],
  ['onan', 'Pot. ONAN<br>(MVA)', 'MVA'],
  ['onaf', 'Pot. ONAF<br>(MVA)', 'MVA'],
  ['relacion', 'Relación de<br>transformación', '66000/13800'],
  ['grupo', 'Grupo de<br>conexión', 'DYn11'],
  ['impedancia', 'Impedancia<br>%', '%'],
  ['refrig', 'Tipo de<br>refrigeración', 'ACEITE']
]);
const CAMPOS_ANEXO_2 = Object.freeze([
  ['cambiador', 'Cambiador de tomas<br>(OLTC / OCTC)', 'OLTC / OCTC'],
  ['extension', 'Extensión<br>cambiador', ''],
  ['pctpaso', 'Porcentaje<br>de paso %', '%']
]);

/* ═══════════════════════════════════════════════════════════════════════════
   2 · UTILIDADES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Escapa para incrustar en HTML. TODO dato de usuario pasa por aquí. */
function esc(x) {
  return (x == null ? '' : String(x))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Lee la primera ruta con valor útil ('a.b.c' admitido). */
function leer(obj, ...rutas) {
  for (const ruta of rutas) {
    let v = obj;
    for (const paso of String(ruta).split('.')) {
      if (v == null || typeof v !== 'object') { v = undefined; break; }
      v = v[paso];
    }
    if (v != null && v !== '') return v;
  }
  return null;
}

/** Número finito o null (acepta la coma decimal española). */
function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const txt = (v) => (v == null ? '' : String(v));
const lleno = (v) => v != null && String(v).trim() !== '';

/** Potencia legible: 40 → «40» · 31,5 → «31,5». */
function mvaTxt(mva) {
  if (mva == null) return '—';
  const r = Math.round(mva * 100) / 100;
  const dec = Number.isInteger(r) ? 0 : (Number.isInteger(r * 10) ? 1 : 2);
  return numES(r, dec);
}

/** Condición 1–5 entera a partir de cualquier HI (redondeo y tope). */
function condEntera(hi) {
  const n = num(hi);
  if (n == null) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   3 · NORMALIZACIÓN DEL EQUIPO
   ───────────────────────────────────────────────────────────────────────────
   Los registros pueden llegar en dos formas: la fila plana del dashboard de
   Salud de Activos (`listarTransformadoresSalud`) o el documento v2 de
   Firestore. Se aceptan ambas y NADA se inventa: lo que no viene, viaja null
   y la interfaz lo muestra como «—».
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Deja el registro con el contrato que esperan la ficha, el unifilar y el
 * exportador, y le añade el veredicto CREG (calculado por el dominio).
 *
 * @param {object} bruto  registro tal como llega de la fuente
 * @param {number} i      índice en la lista (respaldo de identidad)
 * @returns {object} equipo normalizado (no muta el original)
 */
export function normalizarEquipo(bruto, i) {
  const b = bruto || {};
  const kva = num(leer(b, 'potencia_kva', 'placa.potencia_kva')) != null
    ? num(leer(b, 'potencia_kva', 'placa.potencia_kva'))
    : (num(leer(b, 'mva')) != null ? num(leer(b, 'mva')) * 1000 : null);
  const mva = num(leer(b, 'mva')) != null ? num(leer(b, 'mva')) : (kva != null ? kva / 1000 : null);

  // Rutas verificadas contra Firestore en producción (2026-08-15): en el documento v2
  // la placa va PLANA en la raíz (`tension_primaria_kv`), no anidada bajo `placa.*`.
  // Se conservan las rutas antiguas por compatibilidad con fixtures y listados adjuntos.
  const kvPrim = num(leer(b, 'kv_prim', 'tension_primaria_kv', 'placa.tension_primaria_kv'));
  const kvSec  = num(leer(b, 'kv_sec',  'tension_secundaria_kv', 'placa.tension_secundaria_kv'));
  const kvTerc = num(leer(b, 'kv_terc', 'tension_terciaria_kv', 'placa.tension_terciaria_kv'));
  const regulacion = txt(leer(b, 'regulacion', 'tipo_regulacion', 'placa.regulacion'));

  const cls = clasificarUC(kva, kvPrim, kvTerc, regulacion || null);

  const registrada = txt(leer(b, 'uucc_registrada', 'uucc.registrada',
    'identificacion.uucc', 'uucc')).toUpperCase();
  const calculada = txt(leer(b, 'uucc_calculada') || cls.uucc_calc || '').toUpperCase();

  let estado = leer(b, 'estado_uucc');
  if (!estado) {
    if (!calculada) estado = 'SIN CALCULO';
    else if (!registrada) estado = 'FALTA REGISTRO';
    else estado = (registrada === calculada) ? 'CONCORDANTE' : 'DISCREPANCIA';
  }

  const ci = condEntera(leer(b, 'cond_int', 'condicion', 'salud_actual.hi_final'));

  const e = {
    ...b,
    fila: b.fila != null ? b.fila : (i + 1),
    id: txt(leer(b, 'id', 'codigo', 'identificacion.codigo')),
    codigo: txt(leer(b, 'codigo', 'identificacion.codigo')),
    serie: txt(leer(b, 'serie', 'identificacion.numero_serie')),
    matricula: txt(leer(b, 'matricula', 'identificacion.matricula')),
    subestacion: txt(leer(b, 'subestacion', 'ubicacion.subestacion_nombre')),
    municipio: txt(leer(b, 'municipio', 'ubicacion.municipio')),
    zona: txt(leer(b, 'zona', 'ubicacion.zona')),
    departamento: txt(leer(b, 'departamento', 'ubicacion.departamento')),
    potencia_kva: kva,
    marca: txt(leer(b, 'marca', 'identificacion.marca')),
    modelo: txt(leer(b, 'modelo', 'identificacion.modelo')),
    mva,
    kv_prim: kvPrim,
    kv_sec: kvSec,
    kv_terc: kvTerc,
    regulacion,
    refrigeracion: txt(leer(b, 'refrigeracion', 'det.refrig', 'placa.refrigeracion')),
    nivel: txt(leer(b, 'nivel') || cls.nivel || ''),
    banda: txt(leer(b, 'banda') || cls.banda || ''),
    reg_catalogo: txt(leer(b, 'reg_catalogo') || cls.reg_catalogo || ''),
    devanado: cls.devanado,
    uucc_registrada: registrada,
    uucc_calculada: calculada,
    estado,
    notas_uucc: cls.notas,
    advertencia: hayAdvertencia(cls.notas),
    cond_int: ci,
    cond_lbl: txt(leer(b, 'cond_lbl')) || (ci != null ? nombreCondicion(ci) : ''),
    edad: num(leer(b, 'edad', 'det.edad_anos', 'edad_anos')),
    anio_fab: num(leer(b, 'anio_fab', 'det.anio', 'anio', 'fabricacion.ano_fabricacion')),
    usuarios: num(leer(b, 'usuarios', 'usuarios_aguas_abajo', 'criticidad.usuarios_aguas_abajo'))
  };
  e.diag = diagnosticoDeEquipo(e);
  return e;
}

/**
 * Traduce los ensayos del registro al contrato que espera
 * `domain/fichas_diagnostico.js`. Devuelve null si no hay ni un valor medido:
 * sin ensayos NO hay bloque de diagnóstico (no se rellena con ceros).
 *
 * @param {object} e  equipo (ya normalizado o crudo)
 * @returns {object|null}
 */
export function diagnosticoDeEquipo(e) {
  if (!e) return null;
  if (e.diag && typeof e.diag === 'object') return e.diag;
  const d = e.det || e.ensayos || {};
  const salida = {
    fur:  num(leer(d, 'fur2fal', 'fur') ?? leer(e, 'fur2fal', 'fur')),
    efur: num(leer(e, 'calif_fur', 'salud_actual.calif_fur')),
    h2:   num(d.h2),  ch4: num(d.ch4), c2h4: num(d.c2h4), c2h6: num(d.c2h6),
    c2h2: num(d.c2h2), co: num(d.co),  co2: num(d.co2),
    rig:  num(leer(d, 'rigidez', 'rig')),
    hum:  num(leer(d, 'humedad', 'hum')),
    nn:   num(d.nn),
    tif:  num(leer(d, 'ti', 'tif')),
    ic:   num(d.ic),
    crg:  num(leer(d, 'carga', 'crg')),
    eadfq: num(leer(e, 'calif_adfq', 'salud_actual.eval_adfq')),
    ecrg:  num(leer(e, 'calif_crg', 'salud_actual.calif_crg')),
    eherm: num(leer(e, 'calif_her', 'salud_actual.calif_her')),
    eedad: num(leer(e, 'calif_edad', 'salud_actual.calif_edad')),
    causa: txt(leer(e, 'causante', 'causa'))
  };
  const hayAlgo = Object.keys(salida).some((k) => k !== 'causa' && salida[k] != null);
  return hayAlgo ? salida : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4 · BLOQUE 2b · DIAGNÓSTICO MEDIDO (se INYECTA en la ficha técnica)
   ───────────────────────────────────────────────────────────────────────────
   `ficha-tecnica.js` no lo calcula: pide el HTML ya armado. Aquí se pinta con
   lo que devuelve el dominio (DP y vida por la curva de Chendong, CIGRÉ 445);
   ni una cifra se calcula en este archivo.
   ═══════════════════════════════════════════════════════════════════════════ */

function filaKV(k, v) {
  if (v == null || v === '') return '';
  return '<div class="ftm-kv-row"><span class="ftm-kv-k">' + esc(k) + '</span>'
    + '<span class="ftm-kv-v">' + esc(v) + '</span></div>';
}

/**
 * Bloque «2b · Diagnóstico medido» de la ficha técnica.
 * @param {object} equipo
 * @returns {string} HTML (cadena vacía si el equipo no tiene ensayos)
 */
export function bloqueDiagnosticoHTML(equipo) {
  const d = diagnosticoDeEquipo(equipo);
  if (!d) return '';
  const di = dpInfo(d);
  const md = modoDegradacion(equipo, d);

  const gases = [];
  [['h2', 'H₂'], ['ch4', 'CH₄'], ['c2h4', 'C₂H₄'], ['c2h6', 'C₂H₆'],
    ['c2h2', 'C₂H₂'], ['co', 'CO'], ['co2', 'CO₂']].forEach(([k, lbl]) => {
    if (d[k] != null) gases.push(lbl + ' ' + numES(d[k], Math.abs(d[k]) < 100 ? 1 : 0));
  });

  let h = '<h2 class="ftm-ficha-seccion">2b · Diagnóstico medido (Salud de Activos)</h2><div class="ftm-kv">'
    + filaKV('Furanos 2-FAL', d.fur != null ? (numES(d.fur, 0) + ' ppb' + (d.efur != null ? '  (calif. ' + d.efur + ')' : '')) : null)
    + filaKV('DP estimado', di ? (di.dp + (di.fueraRango ? '  (fuera del rango de la curva)' : '')) : null)
    + filaKV('Vida del aislamiento consumida', di ? (di.vidaTxt + ' %') : null)
    + filaKV('Vida remanente', di ? (di.remanente + ' %') : null)
    + filaKV('Rigidez dieléctrica', d.rig != null ? (numES(d.rig, 0) + ' kV') : null)
    + filaKV('Humedad', d.hum != null ? (numES(d.hum, 0) + ' %') : null)
    + filaKV('Tensión interfacial', d.tif != null ? (numES(d.tif, 1) + ' mN/m') : null)
    + filaKV('Índice de neutralización', d.nn != null ? (numES(d.nn, 2) + ' mgKOH/g') : null)
    + filaKV('Cargabilidad', d.crg != null ? (numES(d.crg, 0) + ' %') : null)
    + filaKV('Índice de calidad del aceite', d.ic != null ? numES(d.ic, 0) : null)
    + '</div>';

  if (gases.length) {
    h += '<div class="ftm-kv ftm-kv--una">' + filaKV('DGA — gases disueltos (ppm)', gases.join('  ·  ')) + '</div>';
  }
  if (md) {
    h += '<div class="ftm-ficha-strip"><span class="ftm-ficha-pill"><b>Modo dominante:</b> ' + esc(md.dominante.t) + '</span>'
      + '<span class="ftm-ficha-pill"><b>Referencia:</b> ' + esc(md.dominante.n) + '</span></div>';
    if (md.todos.length > 1) {
      h += '<div class="ftm-ficha-nota">Hallazgos concurrentes: '
        + esc(md.todos.slice(1).map((m) => m.t).join(' · ')) + '.</div>';
    }
    if (md.alerta) h += '<div class="ftm-aviso">▸ ' + esc(md.alerta) + '</div>';
  }
  h += '<div class="ftm-ficha-nota">El DP y el porcentaje de vida se derivan de los furanos por la curva de '
    + 'Chendong (CIGRÉ 445); son estimaciones normalizadas, no medidas directas.</div>';
  return h;
}

/* ═══════════════════════════════════════════════════════════════════════════
   5 · ESTADO EDITABLE DE UNA FICHA
   ═══════════════════════════════════════════════════════════════════════════ */

/** Estado en blanco de una ficha (lo que el usuario puede editar). */
function estadoVacio() {
  return { plan: {}, anexo: {} };
}

/** Potencia DEL PROYECTO: la fijada a mano manda sobre la de placa. */
function potenciaProyecto(equipo, st) {
  const p = num((st.plan || {}).potenciaMVA);
  if (p != null) return p;
  if (equipo.mva != null) return equipo.mva;
  if (equipo.potencia_kva != null) return equipo.potencia_kva / 1000;
  return null;
}

/** UC de la ficha: la escrita a mano manda; si no, se reclasifica con la potencia del proyecto. */
function ucDeLaFicha(equipo, st) {
  const plan = st.plan || {};
  if (lleno(plan.presu_ucc)) return String(plan.presu_ucc).trim().toUpperCase();
  const mva = potenciaProyecto(equipo, st);
  const r = clasificarUC(mva != null ? mva * 1000 : null, equipo.kv_prim, equipo.kv_terc, equipo.regulacion);
  return r.uucc_calc || equipo.uucc_calculada || equipo.uucc_registrada || '';
}

/** Descripción normalizada de la UC, tal como la imprime la ficha. */
function descripcionUC(equipo, codigo) {
  const r = buscarUC(codigo);
  if (r) {
    return 'TRANSFORMADOR TRIFASICO (' + (r.fila.reg || '') + ') - LADO DE ALTA NIVEL '
      + String(r.fila.nivel || equipo.nivel || '').replace('N', '')
      + ' - DE ' + String(r.fila.cap || '').toUpperCase();
  }
  return 'TRANSFORMADOR TRIFASICO (' + txt(equipo.reg_catalogo) + ') - LADO DE ALTA NIVEL '
    + txt(equipo.nivel).replace('N', '') + ' - DE ' + txt(equipo.banda).toUpperCase();
}

/** Resuelve `{MVA}` y `{SUB}` de una plantilla del dueño. */
function resolverPlantilla(tpl, equipo, st) {
  return String(tpl || '')
    .replace(/\{MVA\}/g, mvaTxt(potenciaProyecto(equipo, st)))
    .replace(/\{SUB\}/g, equipo.subestacion || '');
}

/**
 * Texto de la versión elegida. La V5 no es plantilla: la redacta el dominio con
 * los datos MEDIDOS, y por eso recibe la potencia del proyecto como
 * `mvaProyecto` (el dominio ya sabe darle prioridad).
 */
function textoVersion(campo, indice, equipo, st) {
  const opts = campo === 'alcance' ? ALCANCE_OPC : BENEF_OPC;
  const o = opts[indice];
  if (!o) return '';
  if (o.auto) {
    const eq = { ...equipo, mvaProyecto: potenciaProyecto(equipo, st) };
    const d = diagnosticoDeEquipo(equipo);
    return o.auto === 'alcance' ? redaccionAlcance(eq, d) : redaccionBeneficios(eq, d);
  }
  return resolverPlantilla(o.v, equipo, st);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6 · EL PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Monta el módulo de Fichas Técnicas dentro de un contenedor.
 *
 * @param {HTMLElement} contenedor  nodo donde vive el módulo (se vacía).
 * @param {object} [opciones]
 *   @param {Array<object>} [opciones.datos]   equipos ya cargados (preview/tests).
 *   @param {Function} [opciones.fuente]       async () => Array. Por defecto
 *          `window.SGM_DATA_SOURCE` si existe.
 *   @param {string} [opciones.origen]         rótulo de procedencia del dato.
 *   @param {boolean} [opciones.demostracion]  true ⇒ banda «DATOS DE DEMOSTRACIÓN».
 *   @param {Function} [opciones.exportador]   inyecta el exportador (tests).
 *   @param {Function} [opciones.descargar]    inyecta la descarga (tests).
 * @returns {{recargar:Function, fijarDatos:Function, abrirFicha:Function,
 *            cerrarFicha:Function, estadoDe:Function, equipos:Function,
 *            destruir:Function}}
 */
export function montarPanelFichas(contenedor, opciones = {}) {
  if (!contenedor) throw new Error('montarPanelFichas necesita un contenedor.');

  const cfg = {
    origen: opciones.origen || '',
    demostracion: !!opciones.demostracion,
    exportador: opciones.exportador || null,
    descargar: opciones.descargar || descargaPorDefecto
  };

  // ── estado vivo del panel ──
  let EQUIPOS = [];
  let VISIBLES = [];
  let SEL = 'ALL';
  let condSel = '';           // filtro por condición (banda de salud)
  // ── gestión de novedades (ADR-065) ──
  let BRUTOS = [];             // lista tal como llegó: base para recomputar
  const EDITS = {};            // fila → { campo: valor } correcciones de datos
  const DEC = {};              // fila → { decision, final, resp, fecha, obs }
  let APLICADO = false;        // ¿las decisiones están volcadas al tablero?
  let filaEnCajon = null;      // equipo abierto en el cajón de gestión
  let orden = { k: 'subestacion', asc: true };
  const filtros = { q: '', nivel: '', zona: '', uucc: '' };
  const ESTADOS = new Map();   // clave de equipo → estado editable
  let actual = null;           // equipo abierto en el modal
  let trampaFoco = null;       // trampa de foco del modal (ui/foco-modal.js)
  let hoja = 'ficha';
  let aviso = '';

  contenedor.classList.add('ftm-root');
  contenedor.innerHTML = armazon();

  const $ = (sel) => contenedor.querySelector(sel);
  const kpisBox = $('[data-ftm="kpis"]');
  const tbody = $('[data-ftm="tbody"]');
  const pie = $('[data-ftm="pie"]');
  const titulo = $('[data-ftm="titulo"]');
  const modal = $('[data-ftm="modal"]');
  const modalTit = $('[data-ftm="modal-titulo"]');
  const modalTabs = $('[data-ftm="modal-tabs"]');
  const modalCuerpo = $('[data-ftm="modal-cuerpo"]');
  const modalDiag = $('[data-ftm="modal-diag"]');
  const avisoBox = $('[data-ftm="aviso"]');

  /* ── armazón estático ───────────────────────────────────────────────── */
  function armazon() {
    const cols = COLUMNAS.map((c) => {
      const cls = c.chica ? ' class="ftm-hide-sm"' : '';
      const dk = c.k ? ' data-k="' + c.k + '"' : '';
      return '<th' + cls + dk + '>' + c.t + '</th>';
    }).join('');
    const pestanas = VISTAS.map((v, i) => ''
      + '<button type="button" role="tab" data-vista-btn="' + v.id + '"'
      +   ' id="ftm-tab-' + v.id + '" aria-controls="ftm-panel-' + v.id + '"'
      +   ' aria-selected="' + (i === 0 ? 'true' : 'false') + '"'
      +   (i === 0 ? ' class="is-active"' : '') + '>'
      +   esc(v.lbl)
      + '</button>').join('');

    return ''
      // Cabecera con la procedencia del veredicto: qué regla se aplicó y sobre
      // qué datos. Sin esto el tablero afirma «concordante» sin decir contra qué.
      + '<div class="ftm-meta" data-ftm="meta"></div>'
      // Barra de vistas — sistema de pestañas del sitio (tabs.css), accesible.
      + '<div class="tab-bar" role="tablist" aria-label="Vistas del módulo de fichas técnicas">'
      +   pestanas
      + '</div>'
      + '<div class="ftm-view is-on" data-vista="tablero" role="tabpanel"'
      +   ' id="ftm-panel-tablero" aria-labelledby="ftm-tab-tablero">'
      + '<div class="ftm-kpis" data-ftm="kpis"></div>'
      + '<div data-ftm="salud"></div>'
      + '<div data-ftm="corr"></div>'
      // El aviso y la ayuda van sobre una superficie SÓLIDA: el fondo del sitio
      // es una fotografía y el texto suelto encima queda ilegible.
      + '<div class="ftm-panel"><div class="ftm-panel-body">'
      +   '<div class="ftm-hint">▸ Pulse un indicador para acotar la flota; el botón «Ficha» de cada '
      +   'fila abre el documento de planificación con sus seis hojas.</div>'
      +   '<div data-ftm="aviso"></div>'
      + '</div></div>'
      + '<div class="ftm-tabla-wrap">'
      +   '<div class="ftm-tabla-bar">'
      +     '<h3 class="ftm-tabla-bar-t" data-ftm="titulo">Flota completa</h3>'
      +     '<input class="ftm-input" type="search" data-ftm="q" aria-label="Buscar en la flota" '
      +       'placeholder="Buscar subestación, serie, matrícula, departamento…">'
      +     '<select class="ftm-select" data-ftm="nivel" aria-label="Filtrar por nivel"></select>'
      +     '<select class="ftm-select" data-ftm="zona" aria-label="Filtrar por zona"></select>'
      +     '<select class="ftm-select" data-ftm="uucc" aria-label="Filtrar por UUCC calculada"></select>'
      +     '<button type="button" class="ftm-btn" data-ftm="limpiar">Limpiar</button>'
      +   '</div>'
      +   '<div class="ftm-tabla-scroll">'
      +     '<table class="ftm-flota"><thead><tr>' + cols + '</tr></thead>'
      +     '<tbody data-ftm="tbody"></tbody></table>'
      +   '</div>'
      +   '<div class="ftm-tabla-foot" data-ftm="pie"></div>'
      + '</div>'
      + '</div>'   /* ← cierra la vista «tablero» */
      // Las tres vistas restantes se pintan PEREZOSAMENTE: su HTML solo se
      // genera la primera vez que se abren (la de norma son 61 filas de
      // catálogo y la analítica recorre la flota entera).
      + VISTAS.slice(1).map((v) => ''
        + '<div class="ftm-view" data-vista="' + v.id + '" role="tabpanel"'
        +   ' id="ftm-panel-' + v.id + '" aria-labelledby="ftm-tab-' + v.id + '"></div>'
        ).join('')
      // Cajón de gestión de una novedad. Vive fuera de las vistas porque se
      // abre desde la tabla y se superpone; z-index en línea por el mismo
      // motivo que el modal de la ficha (el shell de AQUA vive en 200).
      + '<div class="ftm-scrim" data-ftm="scrim" style="z-index:290"></div>'
      + '<aside class="ftm-drawer" data-ftm="cajon" style="z-index:300" '
      +   'aria-hidden="true" aria-label="Gestión de la novedad"></aside>'
      // z-index en línea a propósito: la hoja del módulo declara 80 y en el
      // sitio la barra superior de AQUA vive en 200 y la barra lateral en 100.
      // Sin esto, el encabezado del modal (con «Exportar» y «Cerrar») queda
      // TAPADO por el shell. Se corrige aquí y no en el CSS del módulo para no
      // atar esa hoja a los z-index del sitio.
      + '<div class="ftm-modal" data-ftm="modal" role="dialog" aria-modal="true" style="z-index:300" '
      +   'aria-label="Ficha técnica de planificación" aria-hidden="true">'
      +   '<div class="ftm-modal-win">'
      +     '<div class="ftm-modal-bar">'
      +       '<span class="ftm-modal-title" data-ftm="modal-titulo"></span>'
      +       '<span class="ftm-modal-acts">'
      +         '<button type="button" class="ftm-btn" data-ftm="descargar-plan" hidden>Descargar plan</button>'
      +         '<button type="button" class="ftm-btn ftm-btn--primary" data-ftm="exportar">Exportar Excel</button>'
      +         '<button type="button" class="ftm-btn" data-ftm="cerrar">Cerrar</button>'
      +       '</span>'
      +     '</div>'
      +     '<div class="ftm-modal-tipos" data-ftm="modal-tabs" role="tablist" '
      +       'aria-label="Hojas de la ficha"></div>'
      // Resumen del diagnóstico SIEMPRE visible, sea cual sea la hoja abierta.
      // El bloque completo vive en el anexo «Plan de acciones» porque no forma
      // parte del formato oficial PE.02081; pero enterrarlo allí sin señal hacía
      // que nadie lo encontrara. Esta tira es el aviso, no un duplicado.
      +     '<div class="ftm-modal-diag" data-ftm="modal-diag" hidden></div>'
      +     '<div class="ftm-modal-scroll" data-ftm="modal-cuerpo"></div>'
      +   '</div>'
      + '</div>';
  }

  /* ── vistas (pestañas) ──────────────────────────────────────────────── */
  let vistaActual = 'tablero';
  const vistasPintadas = new Set(['tablero']);

  function cambiarVista(id) {
    if (!VISTAS.some((v) => v.id === id)) return;
    vistaActual = id;
    contenedor.querySelectorAll('[data-vista]').forEach((el) => {
      el.classList.toggle('is-on', el.getAttribute('data-vista') === id);
    });
    contenedor.querySelectorAll('[data-vista-btn]').forEach((b) => {
      const on = b.getAttribute('data-vista-btn') === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.classList.toggle('is-active', on);
    });
    pintarVista(id);
  }

  /** Pinta una vista bajo demanda. El tablero se refresca siempre; las demás
   *  solo la primera vez o cuando cambian los datos (ver `invalidarVistas`). */
  function pintarVista(id) {
    if (id === 'tablero' || vistasPintadas.has(id)) return;
    const caja = contenedor.querySelector('[data-vista="' + id + '"]');
    if (!caja) return;
    if (id === 'analitica') caja.innerHTML = vistaAnalitica(EQUIPOS);
    else if (id === 'norma') caja.innerHTML = vistaNorma();
    else if (id === 'agregar') caja.innerHTML = vistaAgregar();
    vistasPintadas.add(id);
  }

  /** Al cambiar el conjunto de equipos, lo ya pintado queda obsoleto.
   *  Se conservan las vistas que NO dependen de la flota: «norma» es el
   *  catálogo normativo, y «agregar» es un formulario — repintarlo borraría
   *  lo que el usuario acaba de escribir y el veredicto que está leyendo. */
  function invalidarVistas() {
    const conservar = ['norma', 'agregar'].filter((id) => {
      const c = contenedor.querySelector('[data-vista="' + id + '"]');
      return c && c.innerHTML;
    });
    vistasPintadas.clear();
    vistasPintadas.add('tablero');
    conservar.forEach((id) => vistasPintadas.add(id));
    if (vistaActual !== 'tablero') pintarVista(vistaActual);
  }

  /* ── cabecera de procedencia ────────────────────────────────────────── */
  // Qué regla se aplicó, sobre qué datos y con qué conformidad global. El
  // anillo repite la cifra clave para que se lea de un vistazo.
  function pintarMeta() {
    const caja = $('[data-ftm="meta"]');
    if (!caja) return;
    const r = resumenGerencial(EQUIPOS);
    const conf = Math.round(r.conformidad * 10) / 10;
    const chip = (k, v) => '<span class="ftm-chip"><small>' + esc(k) + '</small> <b>' + esc(v) + '</b></span>';
    const grados = Math.round((conf / 100) * 360);
    caja.innerHTML = ''
      + chip('Regla', 'CREG 015/2018')
      + chip('Fuente', cfg.origen || 'Parque vivo')
      + chip('Evaluados', r.total + ' equipos')
      + chip('Capacidad', (Math.round(r.mvaTotal * 10) / 10).toString().replace('.', ',') + ' MVA')
      // El anillo se dibuja con dos gradientes: el cónico marca el avance y el
      // radial abre el hueco central. Así es un ARO, no un disco macizo, y el
      // número se lee en tinta normal sobre el hueco blanco.
      + '<span class="ftm-gauge" style="margin-left:auto">'
      +   '<span class="ftm-gauge-ring" style="color:var(--ftm-ink);'
      +     'background:radial-gradient(closest-side,var(--ftm-surface-solid) 66%,transparent 68%),'
      +     'conic-gradient(var(--ftm-ok) ' + grados + 'deg, rgba(0,40,90,.10) 0)">'
      +     r.concordantes + '</span>'
      +   '<span><span class="ftm-gauge-lbl">Conformidad de flota</span>'
      +     '<span class="ftm-gauge-val">' + conf.toString().replace('.', ',') + '%</span></span>'
      + '</span>';
  }

  /* ── banda de estado de salud ───────────────────────────────────────── */
  // Distribución por condición (1 Muy bueno … 5 Muy pobre). Cada tramo filtra
  // la tabla, igual que los KPIs de arriba.
  const COND_COLOR = { 1: '#1B8E3F', 2: '#7CB342', 3: '#F5C518', 4: '#EF7820', 5: '#E53935' };
  const COND_NOM = { 1: '1 Muy bueno', 2: '2 Bueno', 3: '3 Medio', 4: '4 Pobre', 5: '5 Muy pobre' };

  function pintarSalud() {
    const caja = $('[data-ftm="salud"]');
    if (!caja) return;
    const total = EQUIPOS.length;
    if (!total) { caja.innerHTML = ''; return; }
    const cuenta = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, sd: 0 };
    EQUIPOS.forEach((e) => {
      const c = e.cond_int;
      if (c >= 1 && c <= 5) cuenta[c] += 1; else cuenta.sd += 1;
    });
    const segs = [1, 2, 3, 4, 5].filter((c) => cuenta[c] > 0).map((c) => {
      const w = (cuenta[c] / total) * 100;
      const on = condSel === String(c) ? ' is-on' : (condSel ? ' is-dim' : '');
      return '<span class="ftm-salud-seg' + on + '" data-cond="' + c + '" role="button" tabindex="0"'
        + ' title="' + esc(COND_NOM[c]) + ': ' + cuenta[c] + '"'
        + ' style="width:' + w + '%;background:' + COND_COLOR[c] + '">'
        + (w > 6 ? cuenta[c] : '') + '</span>';
    }).join('');
    const chips = [1, 2, 3, 4, 5].map((c) => {
      const on = condSel === String(c) ? ' is-on' : '';
      return '<button type="button" class="ftm-salud-chip' + on + '" data-cond="' + c + '">'
        + '<span class="ftm-salud-chip-cq" style="background:' + COND_COLOR[c] + '"></span>'
        + '<span class="ftm-salud-chip-lb"><b>' + esc(COND_NOM[c]) + '</b> '
        + cuenta[c] + ' <small>(' + (Math.round(cuenta[c] / total * 1000) / 10)
            .toString().replace('.', ',') + '%)</small></span></button>';
    }).join('') + (cuenta.sd
      ? '<span class="ftm-salud-chip"><span class="ftm-salud-chip-cq" style="background:#9aa7b2"></span>'
        + '<span class="ftm-salud-chip-lb"><b>Sin dato</b> ' + cuenta.sd + '</span></span>'
      : '');

    caja.innerHTML = ''
      + '<div class="ftm-salud">'
      +   '<div class="ftm-salud-head"><h4>Estado de salud · Condición</h4>'
      +     '<small>Escala 1 Muy bueno — 5 Muy pobre. Pulse un tramo o una etiqueta para acotar '
      +     'la flota; vuelva a pulsarlo para quitar el filtro.</small></div>'
      +   '<div class="ftm-salud-bar">' + segs + '</div>'
      +   '<div class="ftm-salud-legend">' + chips + '</div>'
      + '</div>';
  }

  /* ── vista «Agregar transformador» ──────────────────────────────────── */
  // Clasifica un equipo contra el catálogo CREG y lo añade SOLO a esta
  // pantalla. No escribe en Firestore a propósito: incorporar un activo al
  // parque es otra operación, con simulación previa (admin/importar.html).
  function altaLeer() {
    const val = (id) => {
      const el = contenedor.querySelector('#' + id);
      return el ? el.value.trim() : '';
    };
    const numero = (id) => {
      const v = val(id);
      if (!v) return null;
      const n = Number(v.replace(',', '.'));
      return isFinite(n) ? n : null;
    };
    return {
      subestacion: val('aSub'), matricula: val('aMat'), serie: val('aSerie'),
      codigo: val('aCod'), zona: val('aZona'), departamento: val('aDepto'),
      marca: val('aMarca'), anio_fab: numero('aAnio'),
      potencia_kva: numero('aPot'),
      kv_prim: numero('aVp'), kv_sec: numero('aVs'), kv_terc: numero('aVt'),
      refrigeracion: val('aRef'), uucc_registrada: val('aUucc').toUpperCase()
    };
  }

  function altaMensaje(html, clase) {
    const caja = contenedor.querySelector('[data-ftm="alta-prev"]');
    if (caja) caja.innerHTML = '<div class="ftm-form-prev ' + (clase || '') + '">' + html + '</div>';
  }

  /** Faltantes obligatorios para poder clasificar. */
  function altaFaltantes(d) {
    const falta = [];
    if (!d.subestacion) falta.push('Subestación');
    if (d.potencia_kva == null) falta.push('Potencia (kVA)');
    if (d.kv_prim == null) falta.push('Tensión primaria (kV)');
    return falta;
  }

  function altaPrevia() {
    const d = altaLeer();
    const falta = altaFaltantes(d);
    if (falta.length) {
      altaMensaje('<b>Faltan datos para clasificar:</b> ' + esc(falta.join(', ')) + '.', 'is-warn');
      return null;
    }
    const e = normalizarEquipo(d, EQUIPOS.length);
    const notas = (e.notas_uucc || []).length
      ? '<div class="ftm-nota">' + e.notas_uucc.map(esc).join(' · ') + '</div>' : '';
    altaMensaje(''
      + '<div class="ftm-veredicto">'
      +   '<span class="ftm-vbox ftm-vbox--calc"><small>UUCC calculada</small>'
      +     '<span class="ftm-vbox-val">' + esc(e.uucc_calculada || '—') + '</span></span>'
      +   (d.uucc_registrada
          ? '<span class="ftm-vbox ftm-vbox--reg' + (e.estado === 'DISCREPANCIA' ? ' is-bad' : '')
            + '"><small>UUCC registrada</small><span class="ftm-vbox-val">'
            + esc(d.uucc_registrada) + '</span></span>'
          : '')
      +   '<span class="ftm-pill ' + (CLASE_PILL[e.estado] || '') + '">' + esc(e.estado) + '</span>'
      + '</div>'
      + '<div class="ftm-kv ftm-kv--una"><span class="ftm-kv-k">Nivel</span>'
      +   '<span class="ftm-kv-v">' + esc(e.nivel || '—') + '</span></div>'
      + notas, 'is-ok');
    return e;
  }

  function altaAgregar() {
    const e = altaPrevia();
    if (!e) return;
    e.alta_manual = true;
    EQUIPOS = EQUIPOS.concat([e]);
    pintarMeta(); pintarKpis(); pintarSalud(); pintarFiltros(); aplicar(); invalidarVistas();
    altaMensaje('<b>' + esc(e.subestacion) + '</b> se añadió a la flota de esta pantalla como '
      + '<b>' + esc(e.uucc_calculada || '—') + '</b>. Está en el tablero, con su ficha. '
      + 'No se guardó en la base de datos.', 'is-ok');
  }

  function altaLimpiar() {
    contenedor.querySelectorAll('.ftm-form-grid input').forEach((el) => { el.value = ''; });
    const caja = contenedor.querySelector('[data-ftm="alta-prev"]');
    if (caja) caja.innerHTML = '';
  }

  /* ── gestión de novedades: recálculo ────────────────────────────────── */
  // Se reconstruye SIEMPRE desde `BRUTOS`, nunca mutando lo ya calculado: así
  // descartar una corrección devuelve exactamente el estado original, sin
  // arrastrar restos. `normalizarEquipo` vuelve a pasar por la regla CREG, de
  // modo que corregir la potencia o una tensión reclasifica el equipo solo.
  function recomputarEquipos() {
    const lista = BRUTOS.map((b, i) => {
      const fila = (b && b.fila != null) ? b.fila : (i + 1);
      const ed = EDITS[fila];
      return normalizarEquipo(ed ? { ...b, ...ed } : b, i);
    });
    if (APLICADO) aplicarDecisiones(lista, DEC);
    return lista;
  }

  /** Vuelve a calcular y repinta todo lo que depende de los equipos. */
  function refrescarTodo() {
    EQUIPOS = recomputarEquipos();
    pintarMeta(); pintarKpis(); pintarSalud(); pintarCorrecciones();
    pintarFiltros(); aplicar(); invalidarVistas();
  }

  function pintarCorrecciones() {
    const caja = $('[data-ftm="corr"]');
    if (!caja) return;
    if (!EQUIPOS.length) { caja.innerHTML = ''; return; }
    const res = resumenNovedades(EQUIPOS, EDITS, DEC);
    caja.innerHTML = res.novedades || Object.keys(DEC).length
      ? barraCorreccionesHTML(res, APLICADO)
      : '';
  }

  /* ── cajón de gestión ───────────────────────────────────────────────── */
  function abrirCajon(fila) {
    const e = EQUIPOS.find((x) => String(x.fila) === String(fila));
    if (!e) return;
    filaEnCajon = e.fila;
    const cajon = $('[data-ftm="cajon"]');
    const scrim = $('[data-ftm="scrim"]');
    cajon.innerHTML = cajonHTML(e, EDITS, DEC);
    cajon.classList.add('is-on');
    scrim.classList.add('is-on');
    cajon.setAttribute('aria-hidden', 'false');
  }

  function cerrarCajon() {
    filaEnCajon = null;
    const cajon = $('[data-ftm="cajon"]');
    const scrim = $('[data-ftm="scrim"]');
    if (cajon) { cajon.classList.remove('is-on'); cajon.setAttribute('aria-hidden', 'true'); }
    if (scrim) scrim.classList.remove('is-on');
  }

  /** Lee el cajón y guarda correcciones + decisión de ese equipo. */
  function guardarCajon() {
    if (filaEnCajon == null) return;
    const fila = filaEnCajon;
    const base = BRUTOS.find((b, i) => ((b && b.fila != null) ? b.fila : i + 1) === fila) || {};
    const original = normalizarEquipo(base, 0);

    // Correcciones de datos: solo se guarda lo que DIFIERE del original.
    const ed = {};
    contenedor.querySelectorAll('[data-edit]').forEach((el) => {
      const k = el.getAttribute('data-edit');
      const campo = CAMPOS_EDITABLES.find((c) => c.k === k);
      let v = el.value.trim();
      if (v === '') v = null;
      else if (campo && campo.tipo === 'number') {
        const n = Number(v.replace(',', '.'));
        v = isFinite(n) ? n : v;
      }
      const ov = original[k] == null ? null : original[k];
      if (String(v) !== String(ov)) ed[k] = v;
    });
    if (Object.keys(ed).length) EDITS[fila] = ed; else delete EDITS[fila];

    // Decisión
    const leer = (n) => {
      const el = contenedor.querySelector('[data-dec="' + n + '"]');
      return el ? el.value.trim() : '';
    };
    const decision = leer('decision');
    if (decision) {
      DEC[fila] = { decision, final: leer('final'), resp: leer('resp'),
        fecha: leer('fecha'), obs: leer('obs') };
    } else {
      delete DEC[fila];
    }

    refrescarTodo();
    cerrarCajon();
    fijarAviso('<div class="ftm-aviso">Gestión guardada para <b>' + esc(original.subestacion || fila)
      + '</b>. Queda en esta pantalla; use <b>Exportar acta</b> para entregarla.</div>');
  }

  function descartarCajon() {
    if (filaEnCajon == null) return;
    delete EDITS[filaEnCajon];
    delete DEC[filaEnCajon];
    refrescarTodo();
    cerrarCajon();
  }

  /* ── aplicar / revertir / acta ──────────────────────────────────────── */
  function aplicarCorrecciones() {
    if (!Object.keys(DEC).length) {
      fijarAviso('<div class="ftm-aviso"><b>No hay decisiones registradas.</b> Abra un equipo con '
        + 'novedad, guarde su decisión y vuelva a intentarlo.</div>');
      return;
    }
    APLICADO = true;
    refrescarTodo();
    const res = contarDecisiones();
    fijarAviso('<div class="ftm-aviso"><b>Correcciones aplicadas.</b> '
      + res.subsanadas + ' subsanada(s) → concordante · '
      + res.aceptadas + ' aceptada(s) como estaban · '
      + res.enGestion + ' aún en gestión. La UUCC calculada por la regla CREG no se tocó: '
      + 'solo la registrada y el estado. Puede revertir cuando quiera.</div>');
  }

  /** Cuenta el efecto de las decisiones sobre los equipos ya recomputados. */
  function contarDecisiones() {
    let subsanadas = 0; let aceptadas = 0; let enGestion = 0;
    for (const e of EQUIPOS) {
      const d = DEC[e.fila];
      if (!d || !d.decision) continue;
      if (d.decision === 'Mantener UUCC registrada') aceptadas += 1;
      else if (e.estado === 'CONCORDANTE') subsanadas += 1;
      else enGestion += 1;
    }
    return { subsanadas, aceptadas, enGestion };
  }

  function revertirCorrecciones() {
    APLICADO = false;
    refrescarTodo();
    fijarAviso('<div class="ftm-aviso">Se volvió al estado inicial. Las decisiones siguen '
      + 'guardadas: puede volver a aplicarlas.</div>');
  }

  async function exportarActa() {
    const filas = filasActa(EQUIPOS, EDITS, DEC);
    if (!filas.length) {
      fijarAviso('<div class="ftm-aviso">No hay novedades ni gestiones que llevar al acta.</div>');
      return;
    }
    const res = resumenNovedades(EQUIPOS, EDITS, DEC);
    const meta = [
      { Campo: 'Documento', Valor: 'Acta de correcciones UUCC' },
      { Campo: 'Regla', Valor: 'CREG 015/2018 · Tablas 51 y 52' },
      { Campo: 'Origen de los datos', Valor: cfg.origen || '—' },
      { Campo: 'Novedades', Valor: res.novedades },
      { Campo: 'Gestionadas', Valor: res.gestionadas },
      { Campo: 'Pendientes', Valor: res.pendientes }
    ];
    const { descargarHojas } = await import('../../exports/xlsx.js');
    await descargarHojas('Acta_correcciones_UUCC', [
      { nombre: 'Correcciones', filas, columnas: COLUMNAS_ACTA },
      { nombre: 'Metadatos', filas: meta, columnas: ['Campo', 'Valor'] }
    ]);
  }

  async function importarActa(archivo) {
    if (!archivo) return;
    try {
      const { leerPrimeraHoja } = await import('../../exports/xlsx.js');
      const matriz = await leerPrimeraHoja(archivo);
      const r = decisionesDesdeActa(matriz);
      const filasVivas = new Set(EQUIPOS.map((e) => String(e.fila)));
      let aplicadas = 0; let huerfanas = 0;
      for (const [fila, d] of Object.entries(r.dec)) {
        if (filasVivas.has(String(fila))) { DEC[fila] = d; aplicadas += 1; }
        else huerfanas += 1;
      }
      refrescarTodo();
      fijarAviso('<div class="ftm-aviso"><b>Acta leída.</b> ' + aplicadas + ' decisión(es) recuperada(s)'
        + (huerfanas ? ' · ' + huerfanas + ' no corresponden a ningún equipo de esta pantalla' : '')
        + (r.ignoradas ? ' · ' + r.ignoradas + ' con una decisión no reconocida, ignorada(s)' : '')
        + '. Revise y pulse «Aplicar correcciones al módulo».</div>');
    } catch (err) {
      fijarAviso('<div class="ftm-aviso"><b>No se pudo leer el acta.</b> '
        + esc(err && err.message ? err.message : String(err)) + '</div>');
    }
  }

  /* ── KPIs ───────────────────────────────────────────────────────────── */
  function pintarKpis() {
    const total = EQUIPOS.length || 1;
    kpisBox.innerHTML = CATEGORIAS.map((c) => {
      const n = EQUIPOS.filter(c.f).length;
      const pct = c.id === 'ALL' ? '100%' : (Math.round(n / total * 1000) / 10).toString().replace('.', ',') + '%';
      return '<button type="button" class="ftm-kpi ' + c.cls + (SEL === c.id ? ' is-sel' : '') + '" '
        + 'data-cat="' + esc(c.id) + '" aria-pressed="' + (SEL === c.id) + '">'
        + '<span class="ftm-kpi-bar"></span>'
        + '<span class="ftm-kpi-pct">' + pct + '</span>'
        + '<span class="ftm-kpi-num">' + n + '</span>'
        + '<span class="ftm-kpi-lbl">' + esc(c.lbl) + '</span>'
        + '</button>';
    }).join('');
  }

  /* ── filtros ────────────────────────────────────────────────────────── */
  function opcionesUnicas(clave) {
    const vistos = new Set();
    EQUIPOS.forEach((e) => { if (lleno(e[clave])) vistos.add(String(e[clave])); });
    return [...vistos].sort();
  }

  function pintarFiltros() {
    const llenar = (sel, etiqueta, clave) => {
      const el = $('[data-ftm="' + sel + '"]');
      const valor = filtros[sel];
      el.innerHTML = '<option value="">' + etiqueta + '</option>'
        + opcionesUnicas(clave).map((v) =>
          '<option value="' + esc(v) + '"' + (valor === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
    };
    llenar('nivel', 'Nivel: todos', 'nivel');
    llenar('zona', 'Zona: todas', 'zona');
    llenar('uucc', 'UUCC: todas', 'uucc_calculada');
  }

  function subconjunto() {
    const c = CATEGORIAS.find((x) => x.id === SEL) || CATEGORIAS[0];
    return EQUIPOS.filter(c.f);
  }

  function aplicar() {
    const q = filtros.q.trim().toLowerCase();
    VISIBLES = subconjunto().filter((e) => {
      if (filtros.nivel && e.nivel !== filtros.nivel) return false;
      if (filtros.zona && e.zona !== filtros.zona) return false;
      if (filtros.uucc && e.uucc_calculada !== filtros.uucc) return false;
      if (condSel && String(e.cond_int) !== condSel) return false;
      if (q) {
        const s = [e.subestacion, e.serie, e.matricula, e.codigo,
          e.uucc_registrada, e.uucc_calculada, e.departamento, e.municipio]
          .join(' ').toLowerCase();
        if (!s.includes(q)) return false;
      }
      return true;
    });
    const k = orden.k;
    VISIBLES.sort((a, b) => {
      let x = a[k]; let y = b[k];
      if (x == null) x = ''; if (y == null) y = '';
      if (typeof x !== 'number' || typeof y !== 'number') { x = String(x).toLowerCase(); y = String(y).toLowerCase(); }
      return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1);
    });
    pintarTabla();
  }

  /* ── tabla ──────────────────────────────────────────────────────────── */
  function celdaCondicion(e) {
    const v = e.cond_int;
    if (v == null) return '<span class="ftm-cond ftm-cond--na" title="Sin condición registrada en el origen">s/d</span>';
    const cls = v <= 2 ? 'ftm-cond--ok' : (v === 3 ? 'ftm-cond--med' : 'ftm-cond--bad');
    return '<span class="ftm-cond ' + cls + '" title="Condición ' + v + '/5 · '
      + esc(nombreCondicion(v)) + '">' + v + '</span>';
  }

  function pintarTabla() {
    if (!EQUIPOS.length) {
      tbody.innerHTML = '<tr><td colspan="' + COLUMNAS.length + '">'
        + '<div class="ftm-nota">Sin equipos que mostrar.</div></td></tr>';
    } else if (!VISIBLES.length) {
      tbody.innerHTML = '<tr><td colspan="' + COLUMNAS.length + '">'
        + '<div class="ftm-nota">Ningún equipo cumple el filtro actual.</div></td></tr>';
    } else {
      tbody.innerHTML = VISIBLES.map((e) => {
        const clsFila = CLASE_FILA[e.estado] || '';
        const regCls = e.estado === 'DISCREPANCIA' ? 'ftm-code ftm-code--reg-bad' : 'ftm-code';
        const sub = '<b>' + esc(e.subestacion || '—') + '</b>'
          + '<div class="ftm-hide-sm ftm-mini-src">'
          + (e.municipio ? esc(e.municipio) + ' · ' : '') + esc(e.serie || '') + '</div>';
        return '<tr' + (clsFila ? ' class="' + clsFila + '"' : '') + '>'
          + '<td>' + sub + '</td>'
          + '<td class="ftm-hide-sm ftm-mono">' + esc(e.matricula || '—') + '</td>'
          + '<td>' + (e.potencia_kva != null ? numES(e.potencia_kva, 0) : '—') + '</td>'
          + '<td class="ftm-hide-sm">' + (e.mva != null ? mvaTxt(e.mva) : '—') + '</td>'
          + '<td class="ftm-hide-sm">' + (e.kv_prim != null ? mvaTxt(e.kv_prim) : '—') + '</td>'
          + '<td>' + esc(e.nivel || '—') + '</td>'
          + '<td><span class="' + regCls + '">' + esc(e.uucc_registrada || '—') + '</span></td>'
          + '<td><span class="ftm-code ftm-code--calc">' + esc(e.uucc_calculada || '—') + '</span></td>'
          + '<td><span class="ftm-pill ' + (CLASE_PILL[e.estado] || 'ftm-pill--sin') + '">'
          + esc(ETIQUETA_ESTADO[e.estado] || e.estado) + '</span>'
          + (e.advertencia ? '<span class="ftm-warnflag" title="Con advertencia de consistencia">⚠</span>' : '')
          + '</td>'
          + '<td>' + celdaCondicion(e) + '</td>'
          + '<td><div class="ftm-acts-fila">'
          + '<button type="button" class="ftm-btn" data-ficha="' + esc(claveEquipo(e)) + '">Ficha</button>'
          // Gestionar solo aparece donde hay algo que gestionar: una novedad,
          // o un equipo que ya se tocó (para poder revisarlo o descartarlo).
          + (esNovedad(e) || EDITS[e.fila] || DEC[e.fila]
              ? ' <button type="button" class="ftm-btn ftm-btn--accent" data-gestionar="' + esc(e.fila) + '">'
                + (DEC[e.fila] ? 'Gestionada ✓' : 'Gestionar') + '</button>'
              : '')
          + '</div></td>'
          + '</tr>';
      }).join('');
    }

    const cat = CATEGORIAS.find((x) => x.id === SEL) || CATEGORIAS[0];
    titulo.textContent = SEL === 'ALL' ? 'Flota completa' : cat.lbl + ' — detalle';

    const cc = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, na: 0 };
    VISIBLES.forEach((e) => { const v = e.cond_int; if (v == null) cc.na++; else cc[v]++; });
    const chips = [1, 2, 3, 4, 5].map((k) =>
      '<span class="ftm-cond-dist-chip" title="Condición ' + k + ' · ' + esc(nombreCondicion(k)) + '">'
      + '<span class="ftm-cond-dot" style="background:' + colorCondicion(k) + '"></span>'
      + k + ': <b>' + cc[k] + '</b></span>').join('')
      + (cc.na ? '<span class="ftm-cond-dist-chip" title="Sin dato">'
        + '<span class="ftm-cond-dot" style="background:' + colorCondicion(null) + '"></span>'
        + 's/d: <b>' + cc.na + '</b></span>' : '');

    pie.innerHTML = '<span class="ftm-count">' + VISIBLES.length + '</span> de ' + subconjunto().length
      + ' en la selección · ' + EQUIPOS.length + ' en la flota · '
      + '<span class="ftm-cond-dist"><b>Condición</b> ' + chips + '</span>'
      + (cfg.origen ? ' · ' + esc(cfg.origen) : '');
  }

  /* ── avisos (fuente, demo, errores) ─────────────────────────────────── */
  function pintarAviso() {
    avisoBox.innerHTML = aviso;
  }

  function fijarAviso(html) { aviso = html; pintarAviso(); }

  /* ═════════════════════════════════════════════════════════════════════
     7 · MODAL — las seis hojas
     ═════════════════════════════════════════════════════════════════════ */

  function estadoDe(equipo) {
    const k = claveEquipo(equipo);
    if (!ESTADOS.has(k)) ESTADOS.set(k, estadoVacio());
    return ESTADOS.get(k);
  }

  function abrirFicha(clave) {
    const e = EQUIPOS.find((x) => claveEquipo(x) === clave);
    if (!e) return false;
    actual = e;
    hoja = 'ficha';
    modalTit.textContent = 'Ficha técnica · ' + (e.subestacion || e.matricula || e.codigo || '—');
    modal.classList.add('is-on');
    modal.setAttribute('aria-hidden', 'false');
    pintarModal();
    // El diálogo ya declaraba `aria-modal="true"` pero el foco se escapaba con
    // el tabulador a la página de detrás — la promesa de «el resto está
    // inerte» quedaba incumplida. La trampa se arma DESPUÉS de pintar (si no,
    // aún no hay controles a los que saltar) y enfoca la primera pestaña.
    // Caso piloto de la utilidad compartida `ui/foco-modal.js`.
    trampaFoco = atraparFoco(modal, {
      alCerrar: cerrarFicha,
      autoFoco: '[data-ftm="modal-tabs"] button'
    });
    return true;
  }

  function cerrarFicha() {
    // Primero soltar: devuelve el foco a la fila/botón que abrió la ficha.
    if (trampaFoco) { trampaFoco.soltar(); trampaFoco = null; }
    modal.classList.remove('is-on');
    modal.setAttribute('aria-hidden', 'true');
    actual = null;
  }


  /**
   * Tira-resumen del diagnóstico, visible en cualquier hoja de la ficha.
   * Solo aparece si el equipo TIENE ensayos: sin datos no se pinta una tira
   * vacía que sugiera que se midió algo.
   */
  function pintarTiraDiagnostico(e) {
    if (!modalDiag) return false;
    const d = diagnosticoDeEquipo(e);
    if (!d) { modalDiag.hidden = true; modalDiag.innerHTML = ''; return false; }

    const info = dpInfo(d);
    const md = modoDegradacion(e, d);
    const chips = [];

    if (e.cond_int != null) {
      chips.push('<span class="ftm-modal-diag-chip" style="border-color:' + colorCondicion(e.cond_int)
        + ';color:' + colorCondicion(e.cond_int) + '"><b>Condición ' + esc(e.cond_int) + '</b> · '
        + esc(nombreCondicion(e.cond_int)) + '</span>');
    }
    if (info) {
      chips.push('<span class="ftm-modal-diag-chip">2-FAL <b>' + esc(numES(info.ppb)) + '</b> ppb</span>');
      chips.push('<span class="ftm-modal-diag-chip">DP ≈ <b>' + esc(info.dp) + '</b></span>');
      chips.push('<span class="ftm-modal-diag-chip">Vida consumida <b>' + esc(info.vidaTxt) + ' %</b></span>');
    }
    if (d.crg != null) {
      chips.push('<span class="ftm-modal-diag-chip">Cargabilidad <b>' + esc(numES(d.crg)) + ' %</b></span>');
    }
    if (md && md.dominante) {
      chips.push('<span class="ftm-modal-diag-chip is-modo">' + esc(md.dominante.t) + '</span>');
    }
    if (!chips.length) { modalDiag.hidden = true; modalDiag.innerHTML = ''; return false; }

    modalDiag.innerHTML = '<span class="ftm-modal-diag-lbl">Diagnóstico medido</span>'
      + chips.join('')
      + '<button type="button" class="ftm-modal-diag-ver" data-ftm="ver-diag">Ver detalle</button>'
      + (md && md.alerta
          ? '<span class="ftm-modal-diag-alerta">▸ ' + esc(md.alerta) + '</span>'
          : '');
    modalDiag.hidden = false;
    return true;
  }

  function pintarModal() {
    if (!actual) return;
    modalTabs.innerHTML = HOJAS_FICHA.map((h) =>
      '<button type="button" role="tab" class="ftm-modal-tipo-btn' + (hoja === h.id ? ' is-on' : '')
      + '" data-hoja="' + h.id + '" aria-selected="' + (hoja === h.id) + '">' + esc(h.t) + '</button>').join('');
    const hayDiag = pintarTiraDiagnostico(actual);
    if (hayDiag) {
      // Punto en la pestaña que contiene el bloque completo, para que se vea
      // dónde está el detalle sin tener que recorrer las seis hojas.
      const bp = modalTabs.querySelector('[data-hoja="plan"]');
      if (bp) bp.classList.add('has-diag');
    }
    modalCuerpo.innerHTML = cuerpoHoja(actual, hoja);
    modalCuerpo.scrollTop = 0;
    const btnPlan = $('[data-ftm="descargar-plan"]');
    if (btnPlan) btnPlan.hidden = (hoja !== 'plan');
    if (hoja === 'diagA' || hoja === 'diagF') pintarUnifilar();
  }

  function cuerpoHoja(e, cual) {
    if (cual === 'ficha') return hojaFicha(e);
    if (cual === 'benef') return hojaBeneficios(e);
    if (cual === 'diagA') return hojaDiagrama(e, 'actual');
    if (cual === 'diagF') return hojaDiagrama(e, 'futuro');
    if (cual === 'anexoAT') return hojaAnexo(e);
    if (cual === 'plan') return hojaPlan(e);
    return '';
  }

  // ── piezas comunes de las hojas de papel ──
  const cabeceraHoja = (t) =>
    '<div class="ftm-hoja-head"><div class="ftm-hoja-head-t">' + esc(t) + '</div>'
    + '<div class="ftm-hoja-logo"><span class="ftm-hoja-logo-g">afinia</span>'
    + '<span class="ftm-hoja-logo-s">Grupo·epm</span></div></div>';

  const pieHoja = (pag, ref) =>
    '<div class="ftm-hoja-foot"><span>' + esc(pag) + '</span><span>' + esc(ref) + '</span></div>';

  const banda = (t) => '<div class="ftm-hoja-banda">' + esc(t) + '</div>';

  const campoTexto = (lbl, valor) =>
    '<div class="ftm-campo"><span class="ftm-campo-lbl">' + esc(lbl) + '</span>'
    + '<span class="ftm-campo-val">' + esc(valor || '—') + '</span></div>';

  const campoInput = (lbl, clave, valor, ph, extra) =>
    '<div class="ftm-campo"><span class="ftm-campo-lbl">' + esc(lbl) + '</span>'
    + '<input class="ftm-campo-input" data-plan="' + esc(clave) + '" value="' + esc(valor) + '" '
    + 'placeholder="' + esc(ph || '') + '" aria-label="' + esc(lbl) + '"'
    + (extra || '') + '></div>';

  /** Selector de redacción + área de texto (alcance / beneficios). */
  function selectorRedaccion(e, campo) {
    const st = estadoDe(e);
    const opts = campo === 'alcance' ? ALCANCE_OPC : BENEF_OPC;
    const cur = st.plan[campo + '_ver'];
    const options = '<option value="">— Personalizado / en blanco —</option>'
      + opts.map((o, i) =>
        '<option value="' + i + '"' + (String(cur) === String(i) ? ' selected' : '') + '>'
        + esc(o.t) + '</option>').join('');
    return '<div class="ftm-alcance">'
      + '<label for="ftm-sel-' + campo + '">Redacción</label>'
      + '<select id="ftm-sel-' + campo + '" class="ftm-alcance-sel" data-redaccion="' + campo + '">' + options + '</select>'
      + '<span class="ftm-alcance-hint">Elija una versión y edítela libremente; la cifra de potencia '
      + 'se toma de «Potencia del proyecto».</span></div>'
      + '<textarea class="ftm-campo-area ftm-campo-area--alcance" data-texto="' + campo + '" '
      + 'aria-label="Texto de ' + campo + '" placeholder="(texto del ' + campo
      + ' — elija una redacción arriba o escriba la suya)">' + esc(st.plan[campo] || '') + '</textarea>';
  }

  /** Presupuesto: el desglose lo calcula el dominio; aquí solo se pinta. */
  function bloquePresupuesto(e) {
    const st = estadoDe(e);
    const P = st.plan;
    const U = ucDeLaFicha(e, st);
    const mva = potenciaProyecto(e, st);
    const dg = desgloseCreg({
      uc: U, mva,
      costoInstalacion: lleno(P.presu_unit) ? P.presu_unit : undefined,
      cantidad: P.presu_cant
    });
    const varr = variacionReal({ totalCreg: dg.total, valorReal: P.presu_real });
    const desc = lleno(P.presu_desc) ? P.presu_desc : descripcionUC(e, U);
    const nI = (k, v) => '<input class="ftm-campo-input" data-plan="' + k + '" data-recalcula="1" '
      + 'inputmode="decimal" value="' + esc(v == null ? '' : v) + '" aria-label="' + k + '">';
    const tI = (k, v, ph) => '<input class="ftm-campo-input" data-plan="' + k + '" '
      + 'value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '" aria-label="' + k + '">';

    return '<div class="ftm-hoja-presu"><span>Unidades Constructivas:</span><span>Unidades MCOL $</span></div>'
      + '<div class="ftm-hoja-inv">INVERSIÓN:</div>'
      + '<table class="ftm-tabla"><tbody>'
      + '<tr><th>Subestación,<br>Línea o Circuito</th><th>UUCC</th><th>Descripción</th>'
      +   '<th>Valor CREG<br>Unitario</th><th>Cantidad</th><th>Valor CREG<br>Total</th>'
      +   '<th>Valor Real<br>Total</th><th>Sistema</th></tr>'
      + '<tr><td class="ftm-izq">' + esc(e.subestacion || '') + '</td>'
      +   '<td>' + tI('presu_ucc', lleno(P.presu_ucc) ? P.presu_ucc : U, 'UC') + '</td>'
      +   '<td class="ftm-izq">' + tI('presu_desc', desc, '') + '</td>'
      +   '<td>' + nI('presu_unit', dg.costoInstalacion != null ? formatearCOP(dg.costoInstalacion) : '') + '</td>'
      +   '<td>' + nI('presu_cant', dg.cantidad) + '</td>'
      +   '<td class="ftm-num" data-calc="total">' + (dg.total != null ? formatearCOP(dg.total) : '—') + '</td>'
      +   '<td>' + nI('presu_real', P.presu_real) + '</td>'
      +   '<td>' + tI('presu_sistema', P.presu_sistema, '') + '</td></tr>'
      + '<tr class="ftm-total"><td colspan="5" class="ftm-izq">TOTAL DEL PROYECTO</td>'
      +   '<td class="ftm-num" data-calc="proyecto">' + (dg.total != null ? formatearCOP(dg.total) : '—') + '</td>'
      // OJO: el dinero se lee con `montoCOP` (los puntos son miles), NUNCA con
      // `num` — "2.100.000.000" con parseFloat sería 2,1.
      +   '<td class="ftm-num" data-calc="real">' + (montoCOP(P.presu_real) != null ? formatearCOP(montoCOP(P.presu_real)) : '—') + '</td>'
      +   '<td></td></tr>'
      + '</tbody></table>'
      + '<div class="ftm-nota" data-calc="formula"><b>Desglose:</b> ' + esc(dg.formula) + '</div>'
      + '<div class="ftm-nota" data-calc="variacion"><b>Variación Valor Real − CREG:</b> ' + esc(varr.texto) + '</div>';
  }

  /** Cuadro de firmas del formato (roles fijos; nombre y cargo los pone quien firma). */
  function bloqueFirmas(e) {
    const st = estadoDe(e);
    return '<div class="ftm-firmas">' + FIRMAS.map((f) =>
      '<div class="ftm-firma"><div class="ftm-firma-rol">' + esc(f.rol) + '</div>'
      + '<div class="ftm-firma-sign"><div class="ftm-firma-linea"></div></div>'
      + '<input class="ftm-firma-nombre" data-plan="nom_' + f.k + '" placeholder="(nombre)" '
      + 'aria-label="Nombre de quien firma en ' + esc(f.rol) + '" value="' + esc(st.plan['nom_' + f.k] || '') + '">'
      + '<input class="ftm-firma-nombre" data-plan="occ_' + f.k + '" placeholder="(cargo)" '
      + 'aria-label="Cargo de quien firma en ' + esc(f.rol) + '" value="' + esc(st.plan['occ_' + f.k] || '') + '">'
      + '</div>').join('') + '</div>';
  }

  // ── HOJA 1 · Ficha Técnica ──
  function hojaFicha(e) {
    const st = estadoDe(e);
    const P = st.plan;
    const U = ucDeLaFicha(e, st);
    const r = buscarUC(U);
    const potVal = lleno(P.potenciaMVA) ? P.potenciaMVA : (e.mva != null ? e.mva : '');
    return '<div class="ftm-hoja">'
      + cabeceraHoja('FICHA TÉCNICA PLANIFICACIÓN SISTEMA DISTRIBUCIÓN')
      + '<div class="ftm-hoja-grid2">'
      +   campoInput('Proyecto', 'proyecto', P.proyecto || '', '(nombre del proyecto)')
      +   campoInput('Consecutivo', 'consecutivo', P.consecutivo || '', '')
      +   campoInput('Cod estudio/tarea', 'codestudio', P.codestudio || '', '')
      +   campoTexto('Ámbito', 'Media Tensión / Alta Tensión')
      + '</div>'
      + banda('Emplazamiento físico del proyecto')
      + '<div class="ftm-hoja-grid2">'
      +   campoTexto('Zona', e.departamento)
      +   campoTexto('Subestación', e.subestacion)
      +   campoInput('Municipio', 'municipio', lleno(P.municipio) ? P.municipio : (e.municipio || ''), '(municipio)')
      +   '<div class="ftm-campo"><span class="ftm-campo-lbl"></span><span class="ftm-campo-val"></span></div>'
      + '</div>'
      + banda('Datos del proyecto')
      + '<div class="ftm-hoja-grid2">'
      +   campoInput('Potencia del proyecto (MVA)', 'potenciaMVA', potVal, 'MVA', ' data-recalcula="1" inputmode="decimal"')
      +   '<div class="ftm-campo"><span class="ftm-campo-lbl">UUCC según potencia</span>'
      +     '<span class="ftm-campo-val" data-calc="uucc">' + esc(textoUC(U, r)) + '</span></div>'
      + '</div>'
      + banda('Alcance')
      + selectorRedaccion(e, 'alcance')
      + banda('Presupuesto')
      + bloquePresupuesto(e)
      + banda('Histórico de revisiones')
      + '<table class="ftm-tabla"><tbody><tr><th>Fecha</th><th>Versión</th><th>Motivo del cambio</th></tr>'
      +   '<tr><td></td><td></td><td></td></tr></tbody></table>'
      + banda('Período de ejecución')
      + '<div class="ftm-hoja-grid2">'
      +   campoInput('Fecha de entrega', 'fechaentrega', P.fechaentrega || '', 'dd/mm/aaaa')
      +   campoInput('Año de entrada', 'anioentrada', P.anioentrada || '', 'aaaa')
      + '</div>'
      + bloqueFirmas(e)
      + pieHoja('Pág. 1 de 5', 'PE.02081.PE-FO.03 Ed.01')
      + '</div>';
  }

  function textoUC(U, r) {
    if (!U) return '—';
    return U + (r && r.fila.reg ? ' · ' + r.fila.reg : '') + (r && r.fila.cap ? ' · ' + r.fila.cap : '');
  }

  // ── HOJA 2 · Beneficios ──
  function hojaBeneficios(e) {
    return '<div class="ftm-nota-anexo">Texto de los <b>beneficios</b> del proyecto. Se escribe en la '
      + 'hoja 1 del formato oficial (celda B23) al exportar. La hoja «Beneficios» del libro conserva '
      + 'su estudio económico y sus fórmulas: este módulo no la reescribe.</div>'
      + selectorRedaccion(e, 'beneficios')
      + '<div class="ftm-hoja">'
      + cabeceraHoja('BENEFICIOS DEL PROYECTO')
      + banda('Vista previa del texto')
      + '<div class="ftm-campo-val" data-vista="beneficios">'
      + (lleno(estadoDe(e).plan.beneficios)
        ? esc(estadoDe(e).plan.beneficios).replace(/\n/g, '<br>')
        : '<i>Sin texto todavía.</i>')
      + '</div>'
      + pieHoja('Pág. 2 de 5', 'PE.02081.PE-FO.03 Ed.01')
      + '</div>';
  }

  // ── HOJAS 3 y 4 · Diagramas unifilares (independientes) ──
  function hojaDiagrama(e, cual) {
    const D = parametrosDiagrama(e, cual);
    const pag = cual === 'actual' ? 'Pág. 3 de 5' : 'Pág. 4 de 5';
    const otro = cual === 'actual' ? 'Diagrama Futuro' : 'Diagrama Actual';
    const campos = CAMPOS_DIAG.map(([k, lbl, ph, w]) =>
      '<label>' + esc(lbl) + ' <input class="ftm-diag-input" data-diag="' + k + '" '
      + 'style="width:' + w + 'px" value="' + esc(D[k] || '') + '" placeholder="' + esc(ph) + '" '
      + 'aria-label="' + esc(lbl) + '"></label>').join('');
    const copiar = cual === 'futuro'
      ? ' <button type="button" class="ftm-btn" data-ftm="copiar-diag">Copiar los datos del Diagrama Actual</button>'
      : '';
    return '<div class="ftm-hoja">'
      + '<div class="ftm-diag-head"><div class="ftm-diag-head-t">' + esc(TITULO_DIAGRAMA[cual]) + '</div>'
      +   '<div class="ftm-hoja-logo"><span class="ftm-hoja-logo-g">afinia</span>'
      +   '<span class="ftm-hoja-logo-s">Grupo·epm</span></div></div>'
      + '<div class="ftm-diag-form">' + campos + '</div>'
      + '<div class="ftm-diag-share">Este diagrama es <b>independiente</b> del otro: sus parámetros, su '
      +   'unifilar y sus notas no afectan al ' + esc(otro) + '.' + copiar + '</div>'
      + '<div class="ftm-diag-box" data-ftm="svg"></div>'
      + '<div class="ftm-diag-notas"><span>Notas:</span>'
      +   '<textarea class="ftm-diag-notas-txt" data-diag="notas" aria-label="Notas del diagrama">'
      +   esc(D.notas || '') + '</textarea></div>'
      + pieHoja(pag, 'PE.02081.PE-FO.03 Ed.01 · Ficha Técnica Planificación Red')
      + '</div>';
  }

  function pintarUnifilar() {
    const caja = modalCuerpo.querySelector('[data-ftm="svg"]');
    if (!caja || !actual) return;
    caja.innerHTML = unifilarDeEquipo(actual, hoja === 'diagA' ? 'actual' : 'futuro');
  }

  // ── HOJA 5 · Anexo AT ──
  function valoresAnexo(e) {
    const st = estadoDe(e);
    const A = st.anexo;
    const D = parametrosDiagrama(e, 'actual');
    const g = (k, d) => (lleno(A[k]) ? A[k] : d);
    const relacion = () => {
      if (lleno(A.relacion)) return A.relacion;
      const vp = e.kv_prim != null ? Math.round(e.kv_prim * 1000) : null;
      const vs = e.kv_sec != null ? Math.round(e.kv_sec * 1000) : null;
      return (vp && vs) ? (vp + '/' + vs) : '';
    };
    return {
      transformador: g('transformador', e.subestacion || ''),
      onan: g('onan', D.potONAN || ''),
      onaf: g('onaf', D.potONAF || (e.mva != null ? String(e.mva) : '')),
      relacion: relacion(),
      grupo: g('grupo', D.grupo || ''),
      impedancia: g('impedancia', D.imped || ''),
      refrig: g('refrig', e.refrigeracion || ''),
      cambiador: g('cambiador', e.regulacion || ''),
      extension: g('extension', ''),
      pctpaso: g('pctpaso', ''),
      paralelo: g('paralelo', 'NO'),
      observacion: g('observacion', '')
    };
  }

  function hojaAnexo(e) {
    const v = valoresAnexo(e);
    const inA = (k, val, ph) => '<input class="ftm-campo-input" data-anexo="' + k + '" '
      + 'value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '" aria-label="' + k + '">';
    const fila1 = CAMPOS_ANEXO_1.map(([k, , ph]) => '<td>' + inA(k, v[k], ph) + '</td>').join('');
    const fila2 = CAMPOS_ANEXO_2.map(([k, , ph]) => '<td>' + inA(k, v[k], ph) + '</td>').join('');
    const paralelo = '<select class="ftm-campo-input" data-anexo="paralelo" aria-label="Operación en paralelo">'
      + '<option' + (v.paralelo === 'SI' ? ' selected' : '') + '>SI</option>'
      + '<option' + (v.paralelo !== 'SI' ? ' selected' : '') + '>NO</option></select>';
    return '<div class="ftm-hoja">'
      + '<div class="ftm-diag-head"><div class="ftm-diag-head-t">ANEXOS · ESPECIFICACIONES EQUIPOS</div>'
      +   '<div class="ftm-hoja-logo"><span class="ftm-hoja-logo-g">afinia</span>'
      +   '<span class="ftm-hoja-logo-s">Grupo·epm</span></div></div>'
      + '<div class="ftm-nota-tabla">Datos de placa del equipo seleccionado. Se autocompletan desde el '
      +   'registro y desde el Diagrama Actual; complete lo que falte. Estos valores se escriben en la '
      +   'hoja «Anexo AT» del Excel exportado.</div>'
      + '<table class="ftm-tabla ftm-tabla--anexo"><tbody><tr>'
      +   CAMPOS_ANEXO_1.map(([, lbl]) => '<th>' + lbl + '</th>').join('')
      + '</tr><tr>' + fila1 + '</tr></tbody></table>'
      + '<table class="ftm-tabla ftm-tabla--anexo"><tbody><tr>'
      +   CAMPOS_ANEXO_2.map(([, lbl]) => '<th>' + lbl + '</th>').join('')
      +   '<th>Operación<br>en paralelo</th><th>Observación</th>'
      + '</tr><tr>' + fila2 + '<td>' + paralelo + '</td>'
      +   '<td>' + inA('observacion', v.observacion, '') + '</td></tr></tbody></table>'
      + '<div class="ftm-mini-src">La <b>relación de transformación</b> se arma con Vp/Vs en voltios ('
      +   esc(v.relacion || '—') + '). El <b>cambiador</b> toma la regulación del equipo (OLTC/NLTC); '
      +   'en el Excel se marca la casilla correspondiente con «*».</div>'
      + pieHoja('Pág. 5 de 5', 'PE.02081.CO-PE-FO.03 Ed.2 · Ficha Técnica Alta Tensión')
      + '</div>';
  }

  // ── HOJA 6 · Plan de acciones (anexo interno) ──
  function hojaPlan(e) {
    return '<div class="ftm-nota-anexo">Anexo interno de trabajo — plan de acciones derivado del estado '
      + 'de salud y de la macroactividad registrada. No forma parte de las cinco hojas oficiales; puede '
      + 'descargarlo aparte con el botón «Descargar plan».</div>'
      + construirFichaTecnica(e, { diagnostico: bloqueDiagnosticoHTML, origen: cfg.origen });
  }

  /* ── recálculos en vivo (sin re-render: no se pierde el foco) ───────── */
  function recalcular() {
    if (!actual) return;
    const e = actual;
    const st = estadoDe(e);
    const U = ucDeLaFicha(e, st);
    const mva = potenciaProyecto(e, st);

    const elU = modalCuerpo.querySelector('[data-calc="uucc"]');
    if (elU) elU.textContent = textoUC(U, buscarUC(U));

    const dg = desgloseCreg({
      uc: U, mva,
      costoInstalacion: lleno(st.plan.presu_unit) ? st.plan.presu_unit : undefined,
      cantidad: st.plan.presu_cant
    });
    const totTxt = dg.total != null ? formatearCOP(dg.total) : '—';
    ['total', 'proyecto'].forEach((c) => {
      const el = modalCuerpo.querySelector('[data-calc="' + c + '"]');
      if (el) el.textContent = totTxt;
    });
    const elReal = modalCuerpo.querySelector('[data-calc="real"]');
    if (elReal) {
      const r = montoCOP(st.plan.presu_real);
      elReal.textContent = r != null ? formatearCOP(r) : '—';
    }
    const elF = modalCuerpo.querySelector('[data-calc="formula"]');
    if (elF) elF.innerHTML = '<b>Desglose:</b> ' + esc(dg.formula);
    const elV = modalCuerpo.querySelector('[data-calc="variacion"]');
    if (elV) {
      const varr = variacionReal({ totalCreg: dg.total, valorReal: st.plan.presu_real });
      elV.innerHTML = '<b>Variación Valor Real − CREG:</b> ' + esc(varr.texto);
    }
  }

  /** Al cambiar la potencia, las redacciones NO personalizadas se rehacen. */
  function reescribirRedacciones() {
    if (!actual) return;
    const st = estadoDe(actual);
    ['alcance', 'beneficios'].forEach((campo) => {
      const ver = st.plan[campo + '_ver'];
      if (ver == null || ver === 'custom') return;
      st.plan[campo] = textoVersion(campo, +ver, actual, st);
      const ta = modalCuerpo.querySelector('[data-texto="' + campo + '"]');
      if (ta) ta.value = st.plan[campo];
      const vista = modalCuerpo.querySelector('[data-vista="' + campo + '"]');
      if (vista) vista.innerHTML = esc(st.plan[campo]).replace(/\n/g, '<br>');
    });
  }

  /* ═════════════════════════════════════════════════════════════════════
     8 · ACCIONES · exportar y descargar
     ═════════════════════════════════════════════════════════════════════ */

  /** Estado con la forma que espera `exportar-planificacion.js`. */
  function estadoParaExportar(e) {
    const st = estadoDe(e);
    const dA = parametrosDiagrama(e, 'actual');
    const dF = parametrosDiagrama(e, 'futuro');
    return {
      plan: { ...st.plan },
      anexo: valoresAnexo(e),
      diagramas: {
        actual: { ...dA, svg: unifilarDeEquipo(e, 'actual') },
        futuro: { ...dF, svg: unifilarDeEquipo(e, 'futuro') }
      },
      municipio: e.municipio || '',
      uuccDecidida: e.uucc_calculada || ''
    };
  }

  async function exportarExcel() {
    if (!actual) return;
    const btn = $('[data-ftm="exportar"]');
    const antes = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
    try {
      // Carga PEREZOSA: el exportador (y su JSZip) solo pesan si se usa.
      const mod = cfg.exportador
        ? { exportarFichaPlanificacion: cfg.exportador, nombreArchivoFicha: null }
        : await import('./exportar-planificacion.js');
      const blob = await mod.exportarFichaPlanificacion(actual, estadoParaExportar(actual));
      const nombre = mod.nombreArchivoFicha
        ? mod.nombreArchivoFicha(actual)
        : 'Ficha_Planificacion.xlsx';
      cfg.descargar(blob, nombre);
    } catch (err) {
      console.warn('[fichas/panel] la exportación falló:', err);
      alert('No se pudo generar la ficha en Excel.\n\n' + (err && err.message ? err.message : err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = antes; }
    }
  }

  /**
   * Plan de acciones como documento suelto para imprimir. Se descarga con la
   * hoja del módulo incrustada — así el documento se ve igual fuera del sitio
   * y NO se duplica el CSS dentro del JavaScript.
   */
  async function descargarPlan() {
    if (!actual) return;
    let css = '';
    try {
      const res = await fetch(new URL('../../../css/fichas-tecnicas.css', import.meta.url));
      if (res.ok) css = await res.text();
    } catch (err) {
      console.info('[fichas/panel] plan sin hoja de estilos incrustada:', err);
    }
    const cuerpo = construirFichaTecnica(actual, { diagnostico: bloqueDiagnosticoHTML, origen: cfg.origen });
    const html = '<!doctype html><html lang="es"><head><meta charset="utf-8">'
      + '<title>Plan de acciones · ' + esc(actual.subestacion || actual.matricula || '') + '</title>'
      + '<style>' + css + '</style></head><body class="ftm-root">' + cuerpo + '</body></html>';
    const nombre = ('Plan_acciones_' + (actual.subestacion || actual.matricula || 'equipo') + '_' + (actual.serie || ''))
      .replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/_$/, '') + '.html';
    cfg.descargar(new Blob([html], { type: 'text/html;charset=utf-8' }), nombre);
  }

  /* ═════════════════════════════════════════════════════════════════════
     9 · EVENTOS (delegación · un solo juego de listeners)
     ═════════════════════════════════════════════════════════════════════ */

  function alHacerClic(ev) {
    // Gestión de novedades
    const gest = ev.target.closest('[data-gestionar]');
    if (gest && contenedor.contains(gest)) { abrirCajon(gest.getAttribute('data-gestionar')); return; }
    if (ev.target.closest('[data-ftm="scrim"]')) { cerrarCajon(); return; }

    // Pestañas de vista (Tablero / Analítica / Norma / Agregar)
    const tabBtn = ev.target.closest('[data-vista-btn]');
    if (tabBtn && contenedor.contains(tabBtn)) {
      cambiarVista(tabBtn.getAttribute('data-vista-btn'));
      return;
    }
    // Banda de salud: tramo o etiqueta acotan la flota por condición
    const cond = ev.target.closest('[data-cond]');
    if (cond && contenedor.contains(cond)) {
      const v = cond.getAttribute('data-cond');
      condSel = (condSel === v) ? '' : v;
      pintarSalud(); aplicar(); return;
    }
    const kpi = ev.target.closest('[data-cat]');
    if (kpi && contenedor.contains(kpi)) {
      const id = kpi.getAttribute('data-cat');
      SEL = (SEL === id && id !== 'ALL') ? 'ALL' : id;
      pintarKpis(); aplicar(); return;
    }
    const th = ev.target.closest('th[data-k]');
    if (th) {
      const k = th.getAttribute('data-k');
      orden = { k, asc: orden.k === k ? !orden.asc : true };
      aplicar(); return;
    }
    const btnFicha = ev.target.closest('[data-ficha]');
    if (btnFicha) { abrirFicha(btnFicha.getAttribute('data-ficha')); return; }

    const hojaBtn = ev.target.closest('[data-hoja]');
    if (hojaBtn) { hoja = hojaBtn.getAttribute('data-hoja'); pintarModal(); return; }

    const accion = ev.target.closest('[data-ftm]');
    if (!accion) return;
    switch (accion.getAttribute('data-ftm')) {
      case 'corr-aplicar':  aplicarCorrecciones(); return;
      case 'corr-revertir': revertirCorrecciones(); return;
      case 'corr-exportar': exportarActa();         return;
      case 'corr-cerrar':   cerrarCajon();          return;
      case 'corr-guardar':  guardarCajon();         return;
      case 'corr-descartar': descartarCajon();      return;
      case 'alta-previa':   altaPrevia();   return;
      case 'alta-agregar':  altaAgregar();  return;
      case 'alta-limpiar':  altaLimpiar();  return;
      case 'limpiar':
        filtros.q = ''; filtros.nivel = ''; filtros.zona = ''; filtros.uucc = '';
        $('[data-ftm="q"]').value = '';
        pintarFiltros(); aplicar();
        break;
      case 'cerrar': cerrarFicha(); break;
      case 'ver-diag':
        // Lleva al anexo, que es donde vive el bloque completo.
        hoja = 'plan'; pintarModal();
        break;
      case 'exportar': exportarExcel(); break;
      case 'descargar-plan': descargarPlan(); break;
      case 'copiar-diag':
        if (actual) { copiarActualAFuturo(actual); pintarModal(); }
        break;
      case 'modal':
        if (ev.target === modal) cerrarFicha();   // clic en el velo
        break;
      default: break;
    }
  }

  function alEscribir(ev) {
    const t = ev.target;

    if (t.matches('[data-ftm="q"]')) { filtros.q = t.value; aplicar(); return; }

    if (!actual) return;
    const st = estadoDe(actual);

    const plan = t.getAttribute('data-plan');
    if (plan) {
      st.plan[plan] = t.value;
      if (t.getAttribute('data-recalcula')) {
        if (plan === 'potenciaMVA') reescribirRedacciones();
        recalcular();
      }
      return;
    }
    const anexo = t.getAttribute('data-anexo');
    if (anexo) { st.anexo[anexo] = t.value; return; }

    const diag = t.getAttribute('data-diag');
    if (diag) {
      fijarParametro(actual, hoja === 'diagA' ? 'actual' : 'futuro', diag, t.value);
      if (diag !== 'notas') pintarUnifilar();
      return;
    }
    const campo = t.getAttribute('data-texto');
    if (campo) {
      st.plan[campo] = t.value;
      st.plan[campo + '_ver'] = 'custom';
      const vista = modalCuerpo.querySelector('[data-vista="' + campo + '"]');
      if (vista) vista.innerHTML = esc(t.value).replace(/\n/g, '<br>');
    }
  }

  function alCambiar(ev) {
    const t = ev.target;

    // Acta: recuperar decisiones de un archivo
    if (t.matches && t.matches('[data-ftm="corr-importar"]')) {
      const f = t.files && t.files[0];
      t.value = '';                       // permite reimportar el mismo archivo
      importarActa(f);
      return;
    }
    // «UUCC final» solo tiene sentido si se decide corregir a otra unidad
    if (t.matches && t.matches('[data-dec="decision"]')) {
      const wrap = contenedor.querySelector('[data-dec-final]');
      if (wrap) wrap.hidden = (t.value !== 'Corregir a otra UUCC');
      return;
    }

    ['nivel', 'zona', 'uucc'].forEach((k) => {
      if (t.matches('[data-ftm="' + k + '"]')) { filtros[k] = t.value; aplicar(); }
    });
    if (t.matches('[data-ftm="q"]')) { filtros.q = t.value; aplicar(); }

    const campo = t.getAttribute && t.getAttribute('data-redaccion');
    if (campo && actual) {
      const st = estadoDe(actual);
      if (t.value === '') { st.plan[campo + '_ver'] = 'custom'; return; }
      st.plan[campo + '_ver'] = +t.value;
      st.plan[campo] = textoVersion(campo, +t.value, actual, st);
      const ta = modalCuerpo.querySelector('[data-texto="' + campo + '"]');
      if (ta) ta.value = st.plan[campo];
      const vista = modalCuerpo.querySelector('[data-vista="' + campo + '"]');
      if (vista) vista.innerHTML = esc(st.plan[campo]).replace(/\n/g, '<br>');
    }
    if (t.getAttribute && t.getAttribute('data-anexo') && actual) {
      estadoDe(actual).anexo[t.getAttribute('data-anexo')] = t.value;
    }
  }

  // Escape: mientras el modal está abierto lo gestiona la trampa de foco
  // (`ui/foco-modal.js`, en fase de captura). Esto queda como red de
  // seguridad para el caso raro de que la trampa no se haya podido armar;
  // `cerrarFicha` es idempotente, así que un cierre doble no rompe nada.
  function alTeclear(ev) {
    if (trampaFoco) return;
    if (ev.key === 'Escape' && modal.classList.contains('is-on')) cerrarFicha();
  }

  contenedor.addEventListener('click', alHacerClic);
  contenedor.addEventListener('input', alEscribir);
  contenedor.addEventListener('change', alCambiar);
  document.addEventListener('keydown', alTeclear);

  /* ═════════════════════════════════════════════════════════════════════
     10 · CARGA DE DATOS
     ═════════════════════════════════════════════════════════════════════ */

  function fijarDatos(lista, meta = {}) {
    BRUTOS = Array.isArray(lista) ? lista : [];
    // Un conjunto de datos nuevo invalida las correcciones del anterior: las
    // filas ya no son las mismas y aplicar decisiones viejas sería inventar.
    Object.keys(EDITS).forEach((k) => delete EDITS[k]);
    Object.keys(DEC).forEach((k) => delete DEC[k]);
    APLICADO = false;
    EQUIPOS = recomputarEquipos();
    ESTADOS.clear();
    if (meta.origen != null) cfg.origen = meta.origen;
    pintarMeta();
    pintarKpis();
    pintarSalud();
    pintarCorrecciones();
    pintarFiltros();
    aplicar();
    invalidarVistas();
    return EQUIPOS;
  }

  async function recargar() {
    const fuente = opciones.fuente
      || (typeof globalThis.SGM_DATA_SOURCE === 'function' ? globalThis.SGM_DATA_SOURCE : null);

    if (Array.isArray(opciones.datos) && opciones.datos.length) {
      fijarDatos(opciones.datos);
      if (cfg.demostracion) {
        fijarAviso('<div class="ftm-aviso"><b>DATOS DE DEMOSTRACIÓN</b> — equipos ficticios para revisar '
          + 'la interfaz. Ningún dato de esta pantalla corresponde a un activo real.</div>');
      }
      return EQUIPOS;
    }
    if (!fuente) {
      fijarDatos([]);
      fijarAviso('<div class="ftm-aviso"><b>Sin fuente de datos.</b> Esta página lee el parque desde '
        + 'Firestore a través de <code>window.SGM_DATA_SOURCE</code>. Mientras no exista, no se muestra '
        + 'ningún equipo: el módulo no fabrica datos.</div>');
      return EQUIPOS;
    }
    fijarAviso('<div class="ftm-nota">Cargando el parque…</div>');
    try {
      const filas = await fuente();
      fijarDatos(filas || []);
      fijarAviso(EQUIPOS.length ? '' : '<div class="ftm-aviso">La fuente respondió sin equipos.</div>');
    } catch (err) {
      console.warn('[fichas/panel] la fuente de datos falló:', err);
      fijarDatos([]);
      fijarAviso('<div class="ftm-aviso"><b>No se pudo leer el parque.</b> ' + esc(err && err.message ? err.message : err)
        + '</div>');
    }
    return EQUIPOS;
  }

  function destruir() {
    contenedor.removeEventListener('click', alHacerClic);
    contenedor.removeEventListener('input', alEscribir);
    contenedor.removeEventListener('change', alCambiar);
    document.removeEventListener('keydown', alTeclear);
    contenedor.innerHTML = '';
    contenedor.classList.remove('ftm-root');
  }

  // arranque
  pintarKpis();
  pintarFiltros();
  aplicar();
  recargar();

  return {
    recargar,
    fijarDatos,
    abrirFicha,
    cerrarFicha,
    estadoDe,
    equipos: () => EQUIPOS.slice(),
    destruir
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   11 · DESCARGA POR DEFECTO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Entrega un Blob al navegador. Se puede sustituir por `opciones.descargar`. */
function descargaPorDefecto(blob, nombre) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default montarPanelFichas;
