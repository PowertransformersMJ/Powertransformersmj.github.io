// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · PLANTILLA F60-ADM V.11
// «INFORME DE MANTENIMIENTO CORRECTIVO · ACTUALIZACIÓN DE SISTEMA DE REFRIGERACIÓN»
// ──────────────────────────────────────────────────────────────────────────────
// Todo lo FIJO del formato: textos, índice, títulos, tablas, medidas, figuras y
// listas por defecto. Es la versión «forma + erratas» que aprobó el Ingeniero
// (decisión 7): la forma corregida y los 19 cambios de texto ya aplicados aquí,
// así que ningún informe vuelve a nacer con una errata.
//
// Convenciones de los textos: variables entre { }, negrita [b]…[/b] y resaltado
// amarillo [m]…[/m]. Las marcas se leen ANTES de poner las variables: un dato
// escrito por un usuario nunca se interpreta como marca (ni como HTML).
//
// Medidas en pt de la hoja carta (612 × 792), tomadas del modelo. Ningún dato de
// cliente vive aquí. Dominio puro, se prueba con `node --test`.
// ══════════════════════════════════════════════════════════════════════════════

/* ── Actividades y modelos ────────────────────────────────────────────────────
   Las 8 actividades son, en el mismo orden y con el mismo texto, la lista cerrada
   de motivos de Órdenes de materiales (`assets/js/ordenes-materiales.js`, campo
   `motivos`). Una prueba de amarre lo vigila. Hoy SOLO la primera tiene modelo
   de informe (decisión 2 del Ingeniero). */
export const ACTIVIDADES = Object.freeze([
  'Actualización y repotenciación del sistema de refrigeración.',
  'Medida de mitigación por capacidad de transformación.',
  'Reposición de unidad de refrigeración fallada.',
  'Actualización de protección mecánica.',
  'Mantenimiento de rutina PSM.',
  'Actualización de accesorios.',
  'Reemplazo de unidad o unidades de disipación de pérdidas naturales del transformador.',
  'Plan de mitigación por estado de salud y/o emergencia.'
]);

export const ACTIVIDAD_REFRIGERACION = ACTIVIDADES[0];
export const MODELO_REFRIGERACION = 'F60-REFRIG@1';

export const MODELOS = Object.freeze({
  [MODELO_REFRIGERACION]: Object.freeze({
    id: MODELO_REFRIGERACION,
    actividad: ACTIVIDAD_REFRIGERACION,
    tipo: Object.freeze({
      clase: 'CORRECTIVO',
      titulo: 'ACTUALIZACIÓN DE SISTEMA DE REFRIGERACIÓN',
      asunto: 'ACTUALIZACIÓN SISTEMA DE REFRIGERACIÓN',
      subtitulo_anexos: 'ACTUALIZACIÓN DE REFRIGERACIÓN'
    }),
    // Applus todavía no ha confirmado la emisión con su formato (NV de la síntesis).
    aprobada: false
  })
});

/** Modelo de informe de una actividad: 'F60-REFRIG@1' para refrigeración; null para las demás (aún sin modelo). */
export function modeloDeActividad(act) {
  const t = String(act == null ? '' : act).trim();
  const m = Object.values(MODELOS).find((x) => x.actividad === t);
  return m ? m.id : null;
}

/* ── Formato y marca ──────────────────────────────────────────────────────── */
export const FORMATO = Object.freeze({
  codigo: 'F60-ADM V. 11 – 16/09/2024',
  cliente: 'AFINIA GRUPO E.P.M.',
  direcciones: Object.freeze([
    Object.freeze({ t: 'Bogotá D.C.', b: true }),
    Object.freeze({ t: 'Calle 71A Bis No. 20 - 69' }),
    Object.freeze({ t: 'PBX: (601) 7441133' }),
    Object.freeze({ t: 'Barranquilla', b: true }),
    Object.freeze({ t: 'Calle 58 No. 59B-09' }),
    Object.freeze({ t: 'PBX: (605) 3851256' })
  ]),
  web: 'www.applus.com',
  // Cuerpo de cada hoja (x 85,0 → 526,9; y 109,0 → 714,0).
  cuerpo: Object.freeze({ x: 85.0, ancho: 441.9, arriba: 109.0, abajo: 714.0 }),
  colores: Object.freeze({
    barraTitulo: '#D9D9D9', tituloPortada: '#E3E3E3', bloquePortada: '#DCDCDC', resaltado: '#FFFF00',
    textoVineta: '#808080', iconoVineta: '#F79646', ovalo: '#EE0000', franja: '#FB6600', numeroPagina: '#ED7D31',
    direccionNegrita: '#7F7F7F', direccion: '#333333', web: '#0000FF'
  }),
  pie: Object.freeze({
    codigo: Object.freeze({ x: 381.6, y: 727.3 }),
    numero: Object.freeze({ x: 505, y: 720, w: 22.2, h: 24.2 }),
    franja: Object.freeze({ x: 0, y: 750.4, w: 612, h: 41.6 })
  }),
  direccionesEn: Object.freeze({ x: 92.1, y: 44.09, renglon: 8.033 })
});

/** Las 5 imágenes de marca. NO viven en el repositorio: las sube un administrador al almacén (decisión 6). */
export const MARCA_CLAVES = Object.freeze(['applus-encabezado', 'together-encabezado', 'applus-portada', 'together-portada', 'afinia-portada']);

/** Dónde va cada logo (pt) y cómo se nombra cuando todavía falta. */
export const MARCA_GEOMETRIA = Object.freeze({
  'applus-encabezado': Object.freeze({ x: 85.1, y: 4.7, w: 118.3, h: 49.5, corto: 'Logo Applus', nombre: 'logo Applus del encabezado' }),
  'together-encabezado': Object.freeze({ x: 439.5, y: 43.9, w: 78, h: 41.3, corto: 'Logo Together', nombre: 'logo «Together beyond standards» del encabezado' }),
  'afinia-portada': Object.freeze({ x: 369.7, y: 113.1, w: 119.2, h: 61.5, corto: 'Logo Afinia', nombre: 'logo Afinia de la portada' }),
  'applus-portada': Object.freeze({ x: 84.7, y: 239.6, w: 154.1, h: 64.5, corto: 'Logo Applus', nombre: 'logo Applus de la portada' }),
  'together-portada': Object.freeze({ x: 179.6, y: 293, w: 130.9, h: 75.2, corto: 'Logo Together', nombre: 'logo «Together beyond standards» de la portada' })
});

/* ── Portada ──────────────────────────────────────────────────────────────── */
export const PORTADA = Object.freeze({
  titulo: Object.freeze(['INFORME DE MANTENIMIENTO {clase}.', '{titulo}', '{matricula}.']),
  anexosTitulo: 'ANEXOS',
  cliente: 'CLIENTE: {cliente}',
  asunto: 'ASUNTO: {asunto}',
  // «MATRICULA» sin tilde se conserva: no está entre las 19 erratas aprobadas.
  datos: Object.freeze([
    '{fabricante} {onan} / {onaf} MVA SERIE: {serie}',
    'ZONA: {zona}',
    'DEPARTAMENTO: {departamento}',
    'MATRICULA: {matricula}',
    'CONTRATO: {contrato}',
    'FECHA DE EJECUCIÓN: {fecha_fin}',
    'ESTADO DE SALUD: {salud_numero} ({salud_texto_mayus})'
  ]),
  escalaAsunto: 0.88,
  escalaDatos: 0.905
});

/** Índice de la portada: coincide con los títulos del cuerpo (erratas 2 y 3). */
export const INDICE = Object.freeze([
  Object.freeze({ nivel: 1, numero: '1.', texto: 'INTRODUCCIÓN' }),
  Object.freeze({ nivel: 1, numero: '2.', texto: 'DESCRIPCIÓN DE TRABAJOS' }),
  Object.freeze({ nivel: 2, numero: '2.1', texto: 'Objetivo' }),
  Object.freeze({ nivel: 2, numero: '2.2', texto: 'Personal' }),
  Object.freeze({ nivel: 2, numero: '2.3', texto: 'Alcance' }),
  Object.freeze({ nivel: 1, numero: '3.', texto: 'INFORMACIÓN CARACTERÍSTICA' }),
  Object.freeze({ nivel: 1, numero: '4.', texto: 'PROCEDIMIENTO' }),
  Object.freeze({ nivel: 1, numero: '5.', texto: 'RECOMENDACIONES Y CONCLUSIONES' })
]);

/** Firmas de la portada (con dos puntos las tres: errata 8). */
export const FIRMAS_PORTADA = Object.freeze([
  Object.freeze({ rol: 'elaborado', rotulo: 'Elaborado por:', casilla: 'Fecha / Firma:' }),
  Object.freeze({ rol: 'revisado', rotulo: 'Revisado por:', casilla: 'Fecha / Firma:' }),
  Object.freeze({ rol: 'aprobado', rotulo: 'Aprobado por:', casilla: 'Fecha / Firma:' })
]);
export const ROLES_FIRMA = Object.freeze(FIRMAS_PORTADA.map((f) => f.rol));

/* ── Títulos del cuerpo (estilo y espacio antes, en pt) ───────────────────── */
const T = (numero, texto, nivel, estilo, antes, extra = {}) => Object.freeze({ numero, texto, nivel, estilo, antes, ...extra });
export const TITULOS = Object.freeze({
  s1: T('1.', 'INTRODUCCIÓN', 1, 'barra', 12.455, { antesEnTope: true }),
  s2: T('2.', 'DESCRIPCIÓN DE TRABAJOS', 1, 'barra', 21.445),
  s2_1: T('2.1', 'OBJETIVO', 2, 'normal', 12.845),
  s2_1_1: T('2.1.1', 'OBJETIVO GENERAL', 3, 'normal', 12.545),
  s2_1_2: T('2.1.2', 'OBJETIVOS ESPECÍFICOS', 3, 'normal', 12.445),
  s2_2: T('2.2', 'PERSONAL', 2, 'normal', 12.445),
  s2_3: T('2.3', 'ALCANCE', 2, 'normal', 12.445),
  s3: T('3.', 'INFORMACIÓN CARACTERÍSTICA', 1, 'barra', 0, { saltoAntes: true }),
  s4: T('4.', 'PROCEDIMIENTO', 1, 'barra', 12.455, { saltoAntes: true, antesEnTope: true }),
  s4_1: T('4.1', 'INGRESO A LA SUBESTACIÓN Y CREACIÓN DE LA ZONA DE TRABAJO', 2, 'normal', 12.845),
  s4_2: T('4.2', 'CONDICIONES INICIALES DE TRANSFORMADOR DE POTENCIA.', 2, 'normal', 12.9),
  s4_3: T('4.3', 'MONTAJE DE VENTILADORES', 2, 'normal', 13.0),
  s4_4: T('4.4', 'PRUEBA DE FUNCIONAMIENTO Y SENTIDO DE GIRO', 2, 'normal', 25.2),
  // «5. » escrito a mano en el modelo: barra gris, sin tabulación.
  s5: T('5.', 'RECOMENDACIONES Y CONCLUSIONES', 1, 'manual', 21.4),
  s5_1: T('5.1', 'RECOMENDACIONES', 2, 'plano', 12.7)
});

/* ── Párrafos ─────────────────────────────────────────────────────────────── */
export const TEXTOS = Object.freeze({
  intro_p1: 'AFINIA – CARIBEMAR, en el marco de su normativa de políticas y criterios para la salud de activos y la gestión del mantenimiento, establece directrices orientadas a asegurar que los equipos operen dentro de rangos normales, preservando su confiabilidad y disponibilidad. En sistemas eléctricos de potencia, una gestión de mantenimiento efectiva es determinante para minimizar indisponibilidades no planificadas, reducir riesgos operativos y evitar impactos económicos asociados a interrupciones del servicio, incluyendo pérdidas por lucro cesante y afectaciones a la actividad productiva del área de influencia.',
  intro_p2: 'Con base en inspecciones realizadas en la Subestación {subestacion}, se identificó {hallazgo_texto} en el transformador {matricula} de {onaf} MVA {hallazgo_causa}. Estos hallazgos fueron incluidos en la metodología de salud de activos donde se origina el plan de mantenimiento del parque de transformadores, el activo actualmente se encuentra clasificado en [m]condición de salud {salud_numero} ({salud_texto})[/m].',
  intro_p3: 'En este contexto, el reemplazo oportuno de ventiladores y la intervención integral del sistema de refrigeración constituyen acciones críticas de mantenimiento preventivo y correctivo, orientadas a asegurar la capacidad de disipación eficiente de pérdidas, reducir el estrés térmico sobre el sistema aislante y mitigar el riesgo de alarmas y fallas por temperatura. Por lo anterior, el presente informe se desarrolla como parte del ejercicio de salud de activos, articulado con el Plan Semestral de Mantenimiento (PSM) de la red de Alta Tensión, con el fin de contribuir a la mejora de la condición operativa y de salud del parque de transformadores de potencia de CARIBEMAR DE LA COSTA.',
  obj_general: 'Establecer y ejecutar actividades correctivas de mantenimiento menor requeridas para la repotenciación del sistema de refrigeración forzada del transformador {matricula} de {onaf} MVA en la Subestación {subestacion}, esto en virtud de prolongar la expectativa de vida útil del equipo a lo largo de su operación y cumpliendo con los estándares regulatorios custodiados por la CREG.',
  obj_esp_1: 'Aumentar el caudal de refrigeración de pérdidas en régimen ONAF del transformador de potencia, mediante la transición de pasar de {n_actual} unidades de refrigeración a {n_nuevo} unidades con mayor flujo de aire, garantizando la correcta instalación, alineación, fijación, sentido de giro y operación continua de acuerdo con las condiciones de diseño del sistema sugeridas por el fabricante ajustándose a las necesidades propias del equipo.',
  obj_esp_2: 'Asegurar la funcionalidad de control y protección del sistema de ventilación, mediante verificación y ajuste de guardamotores, contactores, relés, cableado y señalización, garantizando el disparo ante sobrecorriente y el comando adecuado desde el tablero de control hasta sistema SCADA.',
  obj_esp_3: 'Validar el desempeño operativo del sistema de refrigeración posterior a la intervención, realizando pruebas funcionales y seguimiento de parámetros de corrientes, voltajes, temperatura para constatar la mejora de disipación de pérdidas de origen natural y propia del transformador.',
  personal: 'La ejecución de las actividades fue realizada por las siguientes personas, el ingeniero {ingeniero}{frase_tecnicos}, {rango_fechas}.',
  alcance: 'Se realizaron actividades correctivas de mantenimiento menor para actualizar y/o repotenciar el sistema de refrigeración del siguiente equipo:',
  ingreso: 'Durante la ejecución de las actividades, los trabajos se desarrollaron bajo la consignación establecida {consignacion_tipo} [b]{consignacion_numero}[/b], en cumplimiento de las Órdenes de Trabajo (ODT) [b]{odt}[/b], garantizando el control operativo y la seguridad del sistema. Previo al inicio de las labores, se realiza la reunión técnica y de seguridad con todo el personal involucrado, en la cual se socializa el alcance de las actividades, responsabilidades, riesgos asociados y medidas de control. Asimismo, se ejecuta el control previo en campo, la verificación de condiciones seguras, la gestión de permisos de trabajo y demás documentación requerida conforme a los lineamientos de seguridad y salud en el trabajo. Una vez cumplidos estos requisitos, se procede al descargue, inspección y organización de la logística, herramientas y materiales necesarios, garantizando un alistamiento adecuado para el desarrollo seguro y eficiente de las actividades programadas.',
  cond_iniciales: 'Se realiza el registro de las condiciones iniciales del transformador de potencia con el propósito de establecer el estado base del equipo.',
  montaje: 'Se ejecuta el reemplazo progresivo del sistema de ventilación del transformador mediante una intervención secuencial sobre cada unidad, la cual comprende el desmontaje individual de un ventilador existente tipo {modelos_actual}, seguido de la instalación mecánica y conexión eléctrica de su correspondiente ventilador nuevo tipo {modelos_nuevo} en configuración {conexion}, verificando en cada caso el sentido de giro, la correcta fijación y el ajuste operativo antes de continuar con la siguiente unidad. Este procedimiento se repite sucesivamente hasta completar el cambio de los {n_actual} ventiladores actuales{frase_adicionales}, de acuerdo con la configuración definida para el sistema de refrigeración, garantizando en todo momento la conservación del caudal de aire forzado necesario durante la actividad, evitando elevaciones de temperatura y/o afectación a la capacidad de transformación.',
  pruebas_1: 'Se realizan pruebas de funcionamiento en cada unidad de refrigeración con el fin de constatar la correcta operación de los equipos instalados. Se mide el consumo de corriente para cada unidad, verificando su comportamiento operativo y comparándolo con los parámetros de fábrica, con el propósito de confirmar el correcto desempeño del sistema y garantizar condiciones adecuadas durante la operación normal del equipo.',
  pruebas_2: 'Se comprueba el arranque y parada de cada ventilador, el sentido de giro conforme a la dirección de flujo de aire requerida para el sistema de refrigeración, así como la estabilidad mecánica.'
});

/** Espacio antes de cada párrafo (pt), medido en el modelo. */
export const ANTES_TEXTOS = Object.freeze({
  intro_p1: 21.95, intro_p2: 12.25, intro_p3: 12.545, obj_general: 12.945, obj_esp_1: 12.945, obj_esp_2: 12.545,
  obj_esp_3: 12.545, personal: 12.645, alcance: 12.645, ingreso: 12.645, cond_iniciales: 12.745, montaje: 12.645,
  pruebas_1: 12.945, pruebas_2: 12.9
});
export const IDS_TEXTOS = Object.freeze(Object.keys(TEXTOS));

/* Frases que dependen de los datos (concordancia en número). La de los ventiladores
   adicionales es nueva frente al modelo, que solo traía el caso 3 → 4 («del cuarto
   ventilador adicional»): revisar con el Ingeniero. */
export const FRASES = Object.freeze({
  tecnicosVarios: ' y los técnicos {lista}',
  tecnicoUno: ' y el técnico {lista}',
  adicionalUno: ' y la incorporación del {ordinal} ventilador adicional en disposición lateral',
  adicionalesVarios: ' y la incorporación de {k} ventiladores adicionales en disposición lateral'
});

/* ── Conclusiones y recomendaciones (viñetas ⊞, Arial Narrow 10 gris) ────── */
export const CONCLUSIONES = Object.freeze([
  Object.freeze({ id: 'c1', texto: 'La intervención realizada al transformador de potencia {matricula} permitió mejorar la capacidad de disipación térmica del equipo, lo cual contribuye a mejores condiciones térmicas durante su operación.' }),
  Object.freeze({ id: 'c2', texto: 'Las pruebas de funcionamiento, verificación de sentido de giro y mediciones de consumo confirmaron la correcta operación mecánica y eléctrica de los ventiladores instalados, evidenciando condiciones adecuadas para la operación del sistema de refrigeración.' }),
  Object.freeze({ id: 'c3', texto: 'Las actividades ejecutadas se encuentran alineadas con el ejercicio de salud de activos y los objetivos de CARIBEMAR DE LA COSTA, aportando a la mejora de la condición operativa y confiabilidad del transformador.' })
]);
export const RECOMENDACIONES = Object.freeze([
  Object.freeze({ id: 'r1', texto: 'Se recomienda hacer seguimiento al estado del transformador por medio de las inspecciones detalladas realizada por la Brigada de transformador y/o personal de subestaciones.' }),
  Object.freeze({ id: 'r2', texto: 'Se recomienda solicitar apoyo al área de telecontrol para verificar y asegurar que la señalización del sistema de ventilación sea visible en sala de control y Scada.' }),
  Object.freeze({ id: 'r3', texto: 'Se recomienda verificar periódicamente el estado de los filtros desecadores para garantizar que el transformador realice su proceso de expansión y contracción con la silica gel en buen estado.' }),
  Object.freeze({ id: 'r4', texto: 'Se recomienda realizar una toma de muestra de aceite para análisis ADFQ y DGA dentro del mantenimiento predictivo.' }),
  Object.freeze({ id: 'r5', texto: 'Se recomienda realizar seguimiento a la cargabilidad del equipo teniendo en cuenta los parámetros operativos y perfil de carga actual en la demanda asociada del transformador de potencia.' }),
  Object.freeze({ id: 'r6', texto: 'Se recomienda operar el sistema de refrigeración en modo manual local de manera continua.' }),
  Object.freeze({ id: 'r7', texto: 'Todas las actividades se ejecutaron cumpliendo con los requisitos de seguridad[b], control previo, ODTs, permisos de trabajo y ATS[/b], con uso de EPP en [b]conformidad con los lineamientos de AFINIA CARIBEMAR[/b]. No se registraron incidentes, y se mantuvo la limpieza y el orden del área intervenida.' })
]);
/** Espacio antes de la PRIMERA viñeta de cada lista (las demás, 0). */
export const ANTES_VINETAS = Object.freeze({ conclusiones: 12.5, recomendaciones: 12.645 });

/* ── Tablas ───────────────────────────────────────────────────────────────── */
/** Escala horizontal de las palabras de los rótulos de la Tabla 1 (el modelo las trae comprimidas). */
export const ESCALA_ROTULO = Object.freeze({ fuerte: 0.76471, normal: 0.88235, separacion: 0.2 });
export const PALABRAS_ROTULO_FUERTE = Object.freeze(['POTENCIA', 'MATRICULA', 'FABRICANTE', 'AÑO', 'DE', 'FABRICACIÓN', 'TENSIÓN', 'GRUPO', 'CONEXIÓN']);

export const TABLAS = Object.freeze({
  t1: Object.freeze({
    antes: 24.05, altoFila: 13.09,
    geom: Object.freeze({ x0: 117.1, cols: Object.freeze([162.0, 215.4]), bExt: 0.5, bH: 0.5, bV: 0.5, dy: 0.6, dx: -4.1, fuente: 't10' }),
    filas: Object.freeze([
      Object.freeze(['MATRICULA', '{matricula}']),
      Object.freeze(['FABRICANTE', '{fabricante}']),
      Object.freeze(['POTENCIA MVA', '{onan} / {onaf} MVA']),
      Object.freeze(['AÑO DE FABRICACIÓN', '{anio}']),
      Object.freeze(['SERIAL', '{serie}']),
      Object.freeze(['TENSIÓN PRIMARIA', '{v1} V']),
      Object.freeze(['TENSIÓN SECUNDARIA', '{v2} V']),
      Object.freeze(['GRUPO DE CONEXIÓN', '{grupo}']),
      Object.freeze(['FRECUENCIA', '{hz} Hz'])
    ]),
    pie: 'Tabla 1 Características del activo', pieAntes: 0.9
  }),
  t2: Object.freeze({
    antes: 9.85, altoFila: 15.14,
    geom: Object.freeze({ x0: 85.0, cols: Object.freeze([34.6, 308.3, 57.3, 59.3]), bExt: 1.0, bH: 1.0, bV: 0.5, dy: 2.5, dx: 0.4, fuente: 't10' }),
    pie: 'Tabla 2 Material Utilizado', pieAntes: 1.4
  }),
  t3: Object.freeze({
    antes: 22.55, altoFila: 13.64,
    geom: Object.freeze({ x0: 85.0, cols: Object.freeze([34.3, 304.1, 56.3, 58.5]), bExt: 1.0, bH: 1.0, bV: 0.5, dy: 1.8, dx: -4.1, fuente: 't10' }),
    pie: 'Tabla 3 Herramientas y logística utilizada', pieAntes: 1.4
  }),
  t4: Object.freeze({
    antes: 10.05, altoFila: 13.66,
    geom: Object.freeze({ x0: 85.0, cols: Object.freeze([34.3, 304.1, 56.3, 58.5]), bExt: 1.0, bH: 1.0, bV: 0.5, dy: 1.6, dx: -4.1, fuente: 't10' }),
    pie: 'Tabla 4 Elementos SST', pieAntes: 1.4
  }),
  // «Tabla 5.» (en el modelo decía «Tabla 4.» por segunda vez: errata 15).
  t5: Object.freeze({
    etiqueta: 'Tabla 5.', etiquetaAntes: 38.0, antes: 0.05, altoFila: 13.0,
    geom: Object.freeze({ x0: 74.5, cols: Object.freeze([95.1, 128.0, 127.6, 124.5]), bExt: 0.5, bH: 0.5, bV: 0.5, dy: 0.6, dx: 0.25, fuente: 't11' }),
    titulo: 'CONSUMO DE CORRIENTE EN VENTILADORES',
    encabezados: Object.freeze(['VENTILADOR', 'CORRIENTE FASE R (A)', 'CORRIENTE FASE S (A)', 'CORRIENTE FASE T (A)'])
  }),
  // Anexo «CÁLCULO DE VENTILADORES»: SOLO dos tablas (decisión 9), sin aire requerido ni gráfica.
  calculo: Object.freeze({
    antesPrimera: 2.3, separacion: 24.0, altoFila: 15.14,
    geom: Object.freeze({ x0: 85.0, cols: Object.freeze([170.0, 70.0, 100.9, 101.0]), bExt: 1.0, bH: 1.0, bV: 0.5, dy: 2.5, dx: 0, fuente: 't10' }),
    fondoTitulo: '#D9D9D9',
    actual: Object.freeze({ titulo: 'ACTUAL', encabezados: Object.freeze(['TIPO / MODELO', 'CANTIDAD', 'CFM POR UNIDAD', 'CFM TOTAL']) }),
    proyectado: Object.freeze({ titulo: 'PROYECTADO', encabezados: Object.freeze(['MODELO', 'CANTIDAD', 'CFM POR UNIDAD', 'CFM TOTAL']) }),
    total: 'TOTAL'
  })
});

/* ── Figuras ──────────────────────────────────────────────────────────────── */
/** Secciones del papel que llevan cuadrículas de fotos, en orden de aparición. */
export const SECCIONES_FIGURAS = Object.freeze(['alcance', 'ingreso', 'condiciones_iniciales', 'montaje', 'pruebas_consumo', 'pruebas_giro', 'estado_final']);

/** Geometría de las cuadrículas (pt). Una cuadrícula «unaFigura» lleva un solo pie y cuenta UNA figura.
 *  `altoMax`: tope de alto de una foto (pt) — UNO solo por disposición, el MISMO en el PDF y en el Word
 *  (una foto vertical muy alargada no se come la hoja ni corta distinto en los dos). */
export const DISPOSICIONES = Object.freeze({
  '2x1': Object.freeze({ columnas: 2, unaFigura: false, fotosPorFigura: 1, figuras: 2, ancho: 481.2, modoFoto: 'ancho', altoPie: 16.9, altoMax: 430, aspectoDefecto: 0.75, nombre: 'Dos figuras lado a lado' }),
  '1x1': Object.freeze({ columnas: 1, unaFigura: true, fotosPorFigura: 1, figuras: 1, ancho: 484.9, modoFoto: 'ancho', altoPie: 12.0, extraInferior: 7.0, altoMax: 430, aspectoDefecto: 1.38, nombre: 'Una figura a lo ancho' }),
  // x0 64,3: en el modelo las cuadrículas de tres fotos arrancan ahí (no están centradas); las demás se centran.
  '3f': Object.freeze({ columnas: 3, unaFigura: true, fotosPorFigura: 3, figuras: 1, ancho: 493.7, x0: 64.3, modoFoto: 'alto', altoPie: 15.0, altoMax: 260, aspectoDefecto: 0.86, nombre: 'Una figura con tres fotos' }),
  '2x2f': Object.freeze({ columnas: 2, unaFigura: true, fotosPorFigura: 4, figuras: 1, ancho: 325.6, modoFoto: 'alto', altoPie: 15.0, altoFoto: 175.1, altoMax: 260, aspectoDefecto: 0.86, nombre: 'Una figura con cuatro fotos' })
});

/**
 * Ajustes finos que el modelo F60 trae en algunas cuadrículas (medidos en el modelo, maqueta:229-282).
 * Viajan con la cuadrícula (`ajuste`) y el papel y el Word los leen IGUAL (documento.js · geometriaCuadricula).
 *  · alinearV 'centro'  — la foto más corta del par va centrada en vertical (solo el alcance); si no, arriba.
 *  · sangriaPie (pt)    — el pie arranca más adentro (alcance e ingreso: 35,5 pt).
 *  · dyPie (pt)         — distancia de la línea al pie (por defecto 0,6).
 *  · altoPie, extraInferior, altoFoto, ancho, x0 (pt) y anchosCol (pt por columna).
 * Cualquier otra clave se ignora; los números fuera de rango también.
 */
export const AJUSTES_CUADRICULA = Object.freeze({
  alinearV: Object.freeze(['centro']),
  sangriaPie: Object.freeze([0, 120]),
  dyPie: Object.freeze([0, 12]),
  altoPie: Object.freeze([8, 60]),
  extraInferior: Object.freeze([0, 30]),
  altoFoto: Object.freeze([40, 430]),
  ancho: Object.freeze([150, 500]),
  x0: Object.freeze([50, 200]),
  anchosCol: Object.freeze([30, 500])
});

/** Espacio antes de las cuadrículas: la primera de cada sección según la sección; las siguientes, 13 pt. */
export const ANTES_CUADRICULA = Object.freeze({ alcance: 9.045, ingreso: 12.445, otras: 12.5, siguientes: 13.0 });

/** Figuras por defecto (22). Pies sugeridos y editables: {actual}, {nuevo} y {conexion} salen de los ventiladores
 *  ({Conexion} = con mayúscula inicial, como el pie del modelo «en Delta»). El tercer dato es el ajuste fino
 *  del modelo para ESA cuadrícula (AJUSTES_CUADRICULA): sin él, la geometría uniforme de su disposición. */
const G = (disposicion, pies, ajuste = null) => Object.freeze({ disposicion, pies: Object.freeze(pies), ajuste: ajuste ? Object.freeze(ajuste) : null });
export const FIGURAS_DEFECTO = Object.freeze({
  alcance: Object.freeze([G('2x1', ['Panorámica del equipo', 'Placa característica'], { alinearV: 'centro', sangriaPie: 35.5, altoPie: 16.7, dyPie: 3.1 })]),
  ingreso: Object.freeze([G('2x1', ['Inspección del área', 'Descargue de logística'], { sangriaPie: 35.5, altoPie: 17.0 })]),
  condiciones_iniciales: Object.freeze([
    G('2x1', ['Condición inicial indicadores de temperatura', 'Condición inicial tablero de control']),
    G('2x1', ['Ventiladores {actual} actuales', 'Ventiladores {actual} actuales'])
  ]),
  montaje: Object.freeze([
    G('2x1', ['Montaje de ventiladores y ajuste mecánico.', 'Conexión de guardamotor.'], { extraInferior: 7.0, altoPie: 16.8 }),
    G('2x1', ['Tendido de cableado y conexión en potencia.', 'Reemplazo de breaker de fuerza.'], { extraInferior: 7.0, altoPie: 16.8 }),
    G('2x1', ['Adaptación de gabinete para conexión de ventiladores.', 'Conexión de ventiladores en {Conexion}']),
    G('2x1', ['Actividades en tablero de control', 'Condiciones finales de tablero de control.'], { altoPie: 16.7 }),
    G('2x1', ['Ventiladores {nuevo} instalados', 'Ventiladores {nuevo} instalados'])
  ]),
  pruebas_consumo: Object.freeze([
    G('3f', ['Consumo de ventiladores {nuevo}']),
    G('3f', ['Tensión entre fases'], { ancho: 494.4, altoFoto: 175.1, anchosCol: [166.3, 163.8, 164.3] })
  ]),
  pruebas_giro: Object.freeze([G('2x2f', ['Prueba de sentido de giro'], { x0: 143.1, anchosCol: [161.8, 163.8] })]),
  estado_final: Object.freeze([G('1x1', ['Estado final transformador de potencia'])])
});

/* ── Listas por defecto (Tablas 2, 3 y 4) ─────────────────────────────────── */
/** Fila automática de material por cada ventilador nuevo. */
export const FILA_MATERIAL_VENTILADOR = 'VENTILADOR {marca} {modelo} ({cfm} CFM)';
export const MATERIAL_DEFECTO = Object.freeze([
  Object.freeze({ descripcion: 'GUARDAMOTOR ABB 2,5 - 4 A', unidad: 'UND', cantidad: null }),
  Object.freeze({ descripcion: 'CONTACTO AUXILIAR PARA GUARDAMOTOR ABB NA/NA', unidad: 'UND', cantidad: null }),
  Object.freeze({ descripcion: 'CABLE DE CONTROL 4X16', unidad: 'METROS', cantidad: null }),
  Object.freeze({ descripcion: 'CORAZA MEDIA PULGADA', unidad: 'METROS', cantidad: null }),
  Object.freeze({ descripcion: 'LAMINAS PARA MONTAJE LATERAL DE VENTILADORES', unidad: 'UND', cantidad: null }),
  Object.freeze({ descripcion: 'VARILLAS PARA MONTAJE DE VENTILADORES', unidad: 'UND', cantidad: null })
]);
export const HERRAMIENTAS_DEFECTO = Object.freeze([
  Object.freeze({ descripcion: 'DESTORNILLADORES AISLADOS 1000 V', unidad: 'KIT', cantidad: 1 }),
  Object.freeze({ descripcion: 'TALADRO ALAMBRICO 650 W', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'LLAVES DE BOCA FIJA', unidad: 'KIT', cantidad: 1 }),
  Object.freeze({ descripcion: 'PINZA MULTIVOLTIAMPERIMETRICA', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'JUEGO DE COPAS RACHET', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'ALICATES', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'MARQUILLADORA', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'COPA SIERRA ½”', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'EXTENSIÓN ELECTRICA', unidad: 'UND', cantidad: 1 })
]);
/** `por_persona`: la cantidad es el número de personas (ingeniero + técnicos) mientras nadie la cambie a mano. */
export const SST_DEFECTO = Object.freeze([
  Object.freeze({ descripcion: 'CASCO CON BARBUQUEJO', unidad: 'UND', por_persona: true }),
  Object.freeze({ descripcion: 'GUANTES TIPO INGENIERO', unidad: 'PAR', por_persona: true }),
  Object.freeze({ descripcion: 'GAFAS DE SEGURIDAD', unidad: 'UND', por_persona: true }),
  Object.freeze({ descripcion: 'BOTAS DIELECTRICAS', unidad: 'PAR', por_persona: true }),
  Object.freeze({ descripcion: 'DOTACIÓN IGNIFUGA', unidad: 'KIT', por_persona: true }),
  Object.freeze({ descripcion: 'ESCALERA DE EXTENSIÓN', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'BOTIQUIN', unidad: 'UND', cantidad: 1 }),
  Object.freeze({ descripcion: 'CARPA', unidad: 'UND', cantidad: 1 })
]);
/** Personas por defecto (1 ingeniero + 2 técnicos) mientras no se escriba el personal. */
export const PERSONAS_DEFECTO = 3;

/* ── Opciones de los desplegables (más texto libre) ───────────────────────── */
export const UNIDADES = Object.freeze(['UND', 'METROS', 'KIT', 'PAR']);
export const TIPOS_CONSIGNACION = Object.freeze(['con riesgo de disparo', 'con apertura']);
export const CONEXIONES = Object.freeze(['delta', 'estrella']);
export const HALLAZGO_DEFECTO = Object.freeze({ texto: 'un sistema de refrigeración poco eficiente', causa: 'como consecuencia del perfil de carga' });

/* ── Anexos ───────────────────────────────────────────────────────────────── */
/** Anexos por defecto, en orden. Títulos con tilde (erratas 5–7 y 16–18). */
export const ANEXOS_DEFECTO = Object.freeze([
  Object.freeze({ clave: 'consignacion', tipo: 'imagen' }),
  Object.freeze({ clave: 'ficha_actual', tipo: 'ficha' }),
  Object.freeze({ clave: 'ficha_nuevo', tipo: 'ficha' }),
  Object.freeze({ clave: 'calculo', tipo: 'calculo' })
]);
export const ANEXO_TITULOS = Object.freeze({
  consignacion: Object.freeze({ titulo: 'CONSIGNACIÓN' }),
  ficha_actual: Object.freeze({ titulo: 'FICHA TÉCNICA VENTILADOR {modelos_actual}' }),
  ficha_nuevo: Object.freeze({ titulo: 'FICHA TÉCNICA VENTILADOR {modelos_nuevo}', titulo_portada: 'FICHA TÉCNICA VENTILADOR {marcas_modelos_nuevo}' }),
  calculo: Object.freeze({ titulo: 'CÁLCULO DE VENTILADORES' }),
  ficha_extra: Object.freeze({ titulo: 'FICHA TÉCNICA' })
});

/* ── Salud de activos ─────────────────────────────────────────────────────── */
/** Nombre de cada condición 1–5. Copia de `ui/fichas/ficha-tecnica.js` (amarrada por prueba). */
export const NOMBRE_CONDICION = Object.freeze({ 1: 'Muy bueno', 2: 'Bueno', 3: 'Medio', 4: 'Pobre', 5: 'Muy pobre' });

/* ── Textos → «runs» (trozos de texto con su estilo) ──────────────────────── */
/** Cómo se llama cada variable cuando todavía falta (se ve entre corchetes en el borrador). */
export const ETIQUETAS_VARIABLES = Object.freeze({
  clase: 'clase', titulo: 'título', matricula: 'matrícula', cliente: 'cliente', asunto: 'asunto',
  subestacion: 'subestación', hallazgo_texto: 'hallazgo', hallazgo_causa: 'causa del hallazgo',
  onan: 'potencia ONAN', onaf: 'potencia ONAF', salud_numero: 'condición de salud', salud_texto: 'condición',
  salud_texto_mayus: 'CONDICIÓN', n_actual: 'cantidad actual', n_nuevo: 'cantidad nueva', ingeniero: 'ingeniero',
  frase_tecnicos: 'técnicos', rango_fechas: 'fechas de ejecución', consignacion_tipo: 'tipo de consignación',
  consignacion_numero: 'número de consignación', odt: 'ODT', modelos_actual: 'modelo actual', modelos_nuevo: 'modelo nuevo',
  marcas_modelos_nuevo: 'ventilador nuevo', conexion: 'conexión', frase_adicionales: 'ventiladores adicionales',
  fabricante: 'fabricante', serie: 'serie', zona: 'zona', departamento: 'departamento', contrato: 'contrato',
  fecha_fin: 'fecha de ejecución', anio: 'año', v1: 'tensión primaria', v2: 'tensión secundaria', grupo: 'grupo de conexión',
  hz: 'frecuencia'
});

const MARCA_RE = /\[(\/?)(b|m)\]/g;
const VAR_RE = /\{([a-z0-9_]+)\}/g;

/** Nombres de las variables que usa una plantilla, sin repetir y en orden. */
export function variablesDe(plantilla) {
  const out = [];
  for (const m of String(plantilla == null ? '' : plantilla).matchAll(VAR_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

function mismoEstilo(a, b) {
  return !!a.b === !!b.b && !!a.mark === !!b.mark && !!a.falta === !!b.falta && !!a.i === !!b.i;
}

/**
 * Plantilla → lista de runs `{ t, b?, mark?, falta? }`.
 *  1) se leen las marcas [b] [/b] [m] [/m] del TEXTO FIJO;
 *  2) después se ponen las variables (un valor con «[b]» o «<b>» queda como texto literal).
 * Variable `null`/`undefined` → hueco visible «[etiqueta]» con `falta: true` (el borrador lo muestra);
 * variable '' → no escribe nada (p. ej. «frase_tecnicos» sin técnicos).
 */
export function aRuns(plantilla, vars = {}) {
  const s = String(plantilla == null ? '' : plantilla);
  const trozos = [];
  let b = false; let m = false; let k = 0;
  for (const x of s.matchAll(MARCA_RE)) {
    if (x.index > k) trozos.push({ t: s.slice(k, x.index), b, m });
    const abre = x[1] !== '/';
    if (x[2] === 'b') b = abre; else m = abre;
    k = x.index + x[0].length;
  }
  if (k < s.length) trozos.push({ t: s.slice(k), b, m });

  const runs = [];
  const poner = (t, est, falta) => {
    if (t === '') return;
    const r = { t };
    if (est.b) r.b = true;
    if (est.m) r.mark = true;
    if (falta) r.falta = true;
    const u = runs[runs.length - 1];
    if (u && !falta && !u.falta && mismoEstilo(u, r)) u.t += t; else runs.push(r);
  };
  for (const tr of trozos) {
    let j = 0;
    for (const v of tr.t.matchAll(VAR_RE)) {
      poner(tr.t.slice(j, v.index), tr, false);
      const val = vars ? vars[v[1]] : undefined;
      if (val == null) poner('[' + (ETIQUETAS_VARIABLES[v[1]] || v[1]) + ']', tr, true);
      else poner(String(val), tr, false);
      j = v.index + v[0].length;
    }
    poner(tr.t.slice(j), tr, false);
  }
  return runs;
}

/** Texto plano de una lista de runs. */
export function textoDeRuns(runs) {
  return (Array.isArray(runs) ? runs : []).map((r) => r.t).join('');
}

/** Plantilla → texto plano (sin marcas), con las variables puestas. */
export function rellenar(plantilla, vars = {}) {
  return textoDeRuns(aRuns(plantilla, vars));
}
