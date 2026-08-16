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

/* ═══════════════════════════════════════════════════════════════════════════
   1 · CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

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
    return ''
      + '<div class="ftm-kpis" data-ftm="kpis"></div>'
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
          + '<td><button type="button" class="ftm-btn" data-ficha="' + esc(claveEquipo(e)) + '">Ficha</button></td>'
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
    EQUIPOS = (Array.isArray(lista) ? lista : []).map((b, i) => normalizarEquipo(b, i));
    ESTADOS.clear();
    if (meta.origen != null) cfg.origen = meta.origen;
    pintarKpis();
    pintarFiltros();
    aplicar();
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
