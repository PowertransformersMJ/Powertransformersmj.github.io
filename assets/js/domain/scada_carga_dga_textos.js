// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · TEXTOS del panel «Gases disueltos (DGA) y carga» · `99 §127`
// ──────────────────────────────────────────────────────────────────────────────
// Catálogo redactado por el método del Ingeniero (3 redactores → 3 revisores → editor, 2026-10-01) y
// revisado por un comité de 2 (norma y operación). Cada ítem lleva su FUENTE (norma y cláusula o código del
// catálogo MO.00418 §4.3 con su nombre oficial, verificado en catalogos_baseline.js); `inferencia: true` =
// criterio de ingeniería del área, sin norma que lo diga con esas palabras. `filas` (R1–R4) y `columnas`
// (A–E) dicen dónde aplica; `grupo`: '' siempre, 'tdgc' combustibles en 4–5, 'co_co2' CO o CO₂ en 4–5,
// 'c2h2' acetileno en 5. APROBADO = false hasta el «procede» del Ingeniero sobre los textos.
// Archivo NUEVO (L-102). Solo datos.
// ══════════════════════════════════════════════════════════════════════════════

export const APROBADO = false;

export const CATALOGO_DGA = Object.freeze({
  adversidades: [
  {
    "id": "ADV-R1-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Cuanto más cerca de la ampacidad está la carga, más se acerca el punto más caliente del devanado a su temperatura de referencia de envejecimiento. En las horas de mayor carga, y con el ambiente cálido de la costa, puede superarla. Por encima de esa referencia, la velocidad de envejecimiento del papel aislante se duplica por cada 6 a 7 °C adicionales, según el tipo de papel.",
    "cuando": "En las horas de máxima demanda",
    "fuente": "IEC 60076-7:2005 §6.2 (papel no termomejorado: referencia 98 °C, se duplica cada 6 K) · IEEE C57.91-2011 §5.2 (papel termomejorado: referencia 110 °C, cerca de 7 K)",
    "inferencia": true
  },
  {
    "id": "ADV-R1-02",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "La ampacidad de este panel supone los ventiladores en servicio (ONAF). Si una etapa de ventilación no arranca, o si los radiadores están sucios, obstruidos o con depósitos salinos, la capacidad real baja hacia la de enfriamiento natural (ONAN). En ese caso, esta misma carga puede convertirse en sobrecarga.",
    "fuente": "MO.00418 §4.3 SUB-C2-02 «Verificación sistemas de enfriamiento» (sustento técnico)",
    "inferencia": true
  },
  {
    "id": "ADV-R1-03",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Con esta carga queda poco margen, o ninguno, para recibir la carga de una unidad vecina en una contingencia o en una ventana de mantenimiento. La salida de una etapa de ventilación deja además al equipo sin reserva.",
    "fuente": "MO.00418 §4.3 SUB-C4-08 «Plan de mitigación sobrecarga 90-110 %» (sustento: la contingencia queda sin margen de transferencia) · MO.00418 §A3.4",
    "inferencia": true
  },
  {
    "id": "ADV-R2-01",
    "filas": [
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "La cifra se calcula con el promedio de cada hora. El devanado responde a la corriente en pocos minutos y el aceite tarda horas. Por eso, una hora cuyo promedio queda bajo la ampacidad puede contener minutos de sobrecarga, y el punto más caliente sí los acumula.",
    "fuente": "IEC 60076-7:2005 Tabla 5 (constantes de tiempo: devanado de 7 a 10 min; aceite de 150 min con ventiladores y de 210 min con enfriamiento natural)",
    "inferencia": false
  },
  {
    "id": "ADV-R3-01",
    "filas": [
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Con la corriente sostenida sobre la ampacidad ocurren cuatro efectos: el papel de los conductores pierde resistencia mecánica frente a un cortocircuito, las piezas que mantienen el apriete del devanado envejecen más rápido, puede subir la resistencia de contacto del cambiador de tomas (con ruptor en aceite, OILTAP, o en vacío, VACUTAP) y las juntas se endurecen y pierden hermeticidad. Además crece el flujo disperso fuera del núcleo, que calienta herrajes, tapa y paredes del tanque; la parte que llega a la superficie se ve con termografía bajo carga.",
    "fuente": "IEC 60076-7:2005 §5.4 a) a d), §5.2 b) y §7.4.1",
    "inferencia": false
  },
  {
    "id": "ADV-R3-02",
    "filas": [
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Los bujes, sus transformadores de corriente, las conexiones y el cambiador de tomas, con ruptor en aceite (OILTAP) o en vacío (VACUTAP), tienen su propia corriente asignada. Pueden limitar la carga antes que el devanado, que es el que da la ampacidad usada en esta página. Conmutar el cambiador con una corriente muy por encima de la suya es una condición de riesgo.",
    "fuente": "IEC 60076-7:2005 §7.3.2 y §5.3 f) · IEEE C57.91-2011 §9.2.2",
    "inferencia": false
  },
  {
    "id": "ADV-R4-01",
    "filas": [
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "La carga pasó del 130 % de la ampacidad durante dos horas seguidas o más. Ese valor (1,3 veces la corriente asignada) es el tope de corriente de IEC 60076-7 en transformadores grandes (más de 100 MVA), tanto para carga cíclica normal como para emergencia de larga duración. En los medianos el tope de corriente es mayor, pero la temperatura del punto más caliente o la del aceite superior pueden limitar la carga antes de llegar a él; esas temperaturas se estiman en sitio con los indicadores del equipo.",
    "fuente": "IEC 60076-7:2005 Tabla 4 (topes de corriente y de temperatura por régimen y por clase; clase mediana hasta 100 MVA)",
    "inferencia": true
  },
  {
    "id": "ADV-R4-02",
    "filas": [
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Con esta carga sostenida, si el punto más caliente pasa de unos 140 °C y el papel está húmedo (del orden de 2 % de humedad), el agua forma burbujas de gas que reducen la rigidez dieléctrica del aislamiento. A esas temperaturas baja también, de forma temporal, la resistencia mecánica de los materiales del devanado, y con ella su capacidad de soportar un cortocircuito.",
    "fuente": "IEC 60076-7:2005 §5.3 a), §5.3 c) y §7.3.1",
    "inferencia": false
  },
  {
    "id": "ADV-A-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A"
    ],
    "grupo": "",
    "texto": "Este equipo está sin calificación de gases disueltos: falta la línea base para saber con qué condición interna recibe la carga alta. La tendencia de los gases disueltos es el indicador que muestra más temprano un defecto interno en evolución.",
    "fuente": "MO.00418 §4.3 SUB-PSM-01 «Muestreo de aceite (semestral)» (sustento técnico) · MO.00418 §A3.1",
    "inferencia": false
  },
  {
    "id": "ADV-B-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "B"
    ],
    "grupo": "",
    "texto": "Una calificación de gases Muy Bueno o Bueno describe el equipo en la fecha de su muestra. El efecto de las horas de carga alta posteriores a esa toma, si lo hay, aparecerá en la muestra siguiente.",
    "fuente": "MO.00418 §A3.1 · IEC 60599:2022 §3.1.10",
    "inferencia": true
  },
  {
    "id": "ADV-C-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "C"
    ],
    "grupo": "",
    "texto": "La calificación de gases Medio (3) indica que al menos uno de los cuatro grupos (combustibles, CO, CO₂ o acetileno) está por encima de la condición buena; la tarjeta de gases de este panel muestra cuál. Si pesan el CO o el CO₂, la señal viene sobre todo del papel. Si pesan los combustibles, puede haber un calentamiento interno que la carga alta acelera.",
    "fuente": "MO.00418 §A3.1 (calificación global = promedio redondeado de TDGC, CO, CO₂ y C₂H₂) · IEC 60599:2022 §4.2",
    "inferencia": true
  },
  {
    "id": "ADV-D-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "D"
    ],
    "grupo": "",
    "texto": "La calificación de gases Pobre o Muy Pobre señala dos causas posibles: un defecto interno o un papel envejecido o recalentado. Las partes por millón (ppm) de cada gas y su tendencia indican cuál de las dos es. Si el defecto es térmico y está en una conexión o en un contacto por donde pasa la corriente, la carga alta lo agrava.",
    "fuente": "MO.00418 §A3.1 · IEC 60599:2022 §4.2 y §5.3",
    "inferencia": true
  },
  {
    "id": "ADV-E-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "E"
    ],
    "grupo": "c2h2",
    "texto": "El acetileno (C₂H₂) se forma a temperaturas de 800 a 1 200 °C o más, propias de un arco, de una descarga o de un punto muy caliente en el metal. Son temperaturas muy superiores a las que alcanza el devanado en sobrecarga. Su origen se busca en una conexión con mal contacto, en una descarga o en el cambiador de tomas, y con la carga alta ese punto trabaja con más corriente.",
    "fuente": "IEC 60599:2022 §4.1",
    "inferencia": false
  },
  {
    "id": "ADV-G-TDGC",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "tdgc",
    "texto": "La calificación de gases combustibles (hidrógeno, metano, etano y etileno) está en 4 o 5, aunque la calificación global los promedia con el CO, el CO₂ y el acetileno. Estos gases provienen de un defecto en el aceite, térmico o eléctrico. Las partes por millón (ppm) de cada uno indican de cuál se trata.",
    "fuente": "MO.00418 §A3.1 (TDGC = H₂ + CH₄ + C₂H₆ + C₂H₄; calificación global por promedio redondeado) · IEC 60599:2022 §5.3",
    "inferencia": false
  },
  {
    "id": "ADV-G-COCO2",
    "filas": [
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "co_co2",
    "texto": "Los gases del papel, monóxido (CO) o dióxido de carbono (CO₂), califican en Pobre o Muy Pobre (4–5). Su formación se acelera cuando la celulosa pasa de unos 105 °C, y con esta carga el papel trabaja más caliente. La calificación de furanos de Salud de Activos y la tendencia de CO y CO₂ entre muestras indican cuánto ha avanzado su envejecimiento.",
    "fuente": "IEC 60599:2022 §4.2 y §3.1.10 · MO.00418 §A3.1 y §A3.3",
    "inferencia": false
  }
],
  acciones: [
  {
    "id": "ACC-R3-01",
    "filas": [
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Confirmar en esta página que la cifra es firme, que la ampacidad corresponde al devanado medido y que la diferencia con la «Cifra oficial (Excel)» tiene explicación. Luego, preguntar a operación si el episodio fue una maniobra o una contingencia y si la condición continúa.",
    "cuando": "Al abrir este detalle, antes de programar trabajo en campo",
    "fuente": "MO.00418 §A3.4 (calificación de cargabilidad)",
    "inferencia": true
  },
  {
    "id": "ACC-R1-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Acordar con operación la transferencia de carga disponible hacia otra unidad o circuito, lista para una contingencia o una ventana de mantenimiento, y aplicarla en las horas en que la carga pase de la ampacidad. Para operar en paralelo, comprobar grupo vectorial, relación de transformación, posición de tomas e impedancia de cortocircuito.",
    "cuando": "Antes de la temporada de mayor demanda",
    "fuente": "MO.00418 §4.3 SUB-C4-08 «Plan de mitigación sobrecarga 90-110 %» y SUB-C3-M3 «Instalación unidad de transformación adicional» (sustento: condiciones de reparto)",
    "inferencia": true
  },
  {
    "id": "ACC-R2-01",
    "filas": [
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Formular el plan de mitigación de sobrecarga del equipo con límites de carga, criterios para la carga de emergencia, seguimiento de la temperatura con los indicadores del equipo y maniobras de transferencia para la contingencia. Si el equipo tiene ventiladores, el plan incluye arrancarlos antes de la franja de máxima demanda, porque el aceite tarda horas en calentarse.",
    "cuando": "Al pasar la cifra del 90 % o tras un episodio sobre el 100 %",
    "fuente": "MO.00418 §4.3 SUB-C4-08 «Plan de mitigación sobrecarga 90-110 %» · IEC 60076-7:2005 Tabla 5",
    "inferencia": false
  },
  {
    "id": "ACC-R4-01",
    "filas": [
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Tratar como emergencia la carga de dos horas o más sobre el 130 %: planeación, operación y el dueño del activo dejan por escrito, dentro del plan SUB-C4-08, su aceptación, su duración y su retiro. Mientras dure, si el equipo tiene cambiador bajo carga, con ruptor en aceite (OILTAP) o en vacío (VACUTAP), reservar sus maniobras para las indispensables y hacerlas con la menor corriente posible, coordinando con operación la regulación de tensión.",
    "cuando": "Cada vez que ocurra",
    "fuente": "Criterio del área (aceptación por escrito) · IEC 60076-7:2005 §5.3 y §5.3 f) (maniobras del cambiador) · MO.00418 §4.3 SUB-C4-08 «Plan de mitigación sobrecarga 90-110 %»",
    "inferencia": true
  },
  {
    "id": "ACC-DE-01",
    "filas": [
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Mientras la calificación de gases siga en Pobre o Muy Pobre, o el acetileno esté en monitoreo intensivo, programar la operación del equipo dentro de su ampacidad y reservar la carga por encima de ella para una emergencia aceptada por escrito. Si la carga alta es estructural, evaluar con planeación el movimiento estratégico del transformador hacia un emplazamiento de menor exigencia, previa verificación de la compatibilidad eléctrica del destino.",
    "cuando": "Mientras dure la condición de gases",
    "fuente": "MO.00418 §A3.1 y §A9.1 · IEC 60599:2022 §4.1 y §5.3 · MO.00418 §4.3 SUB-C4-M2 «Movimiento estratégico de transformadores»",
    "inferencia": true
  },
  {
    "id": "ACC-R2-02",
    "filas": [
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "En la gráfica «Tensión entre fases» de esta página, revisar las horas de carga más alta. Con la carga sobre la asignada, la norma pide mantener la tensión aplicada en 1,05 veces la de la toma en servicio o menos, para prevenir la sobreexcitación del núcleo. Si la supera, coordinar con operación la regulación; la gráfica usa como referencia la tensión nominal del nivel.",
    "cuando": "Al revisar este detalle",
    "fuente": "IEC 60076-7:2005 §7.3.4",
    "inferencia": false
  },
  {
    "id": "ACC-R2-03",
    "filas": [
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Llevar a planeación las soluciones de capacidad del catálogo: aumento de capacidad del sistema de refrigeración (SUB-C3-M2), instalación de una unidad de transformación adicional (SUB-C3-M3), repotenciación de la unidad (SUB-C4-M1) o aumento de capacidad de transformación (SUB-C5-05). Ampliar la refrigeración aumenta la capacidad de disipación; para asignar más potencia se requiere la validación del fabricante y su ensayo de calentamiento.",
    "cuando": "Si la carga alta se repite mes a mes",
    "fuente": "MO.00418 §4.3: SUB-C3-M2 «Aumento de capacidad sistema refrigeración», SUB-C3-M3 «Instalación unidad de transformación adicional», SUB-C4-M1 «Repotenciación de unidad de transformación», SUB-C5-05 «Aumento de capacidad de transformación»",
    "inferencia": false
  },
  {
    "id": "ACC-R1-02",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Verificar el sistema de enfriamiento: arranque automático y manual de cada etapa de ventiladores, sentido de giro, consumo y limpieza de radiadores. En la misma visita, contrastar contra patrón los indicadores de temperatura del aceite y de imagen térmica, con sus puntos de arranque, alarma y disparo; son la medida de temperatura del equipo. Lo que se encuentre se atiende así: la etapa fuera de servicio o el indicador desviado, con SUB-C4-07; las etapas que no entregan su caudal de diseño, con SUB-C3-M1.",
    "cuando": "En una misma visita, antes de la franja de máxima demanda",
    "fuente": "MO.00418 §4.3: SUB-C2-02 «Verificación sistemas de enfriamiento», SUB-C2-03 «Verificación indicadores de temperatura», SUB-C4-07 «Reemplazo o reparación componentes defectuosos», SUB-C3-M1 «Aumento de caudal de refrigeración»",
    "inferencia": false
  },
  {
    "id": "ACC-R1-03",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Hacer la termografía en la hora de mayor carga y registrar esa carga como condición del ensayo. Cubrir bornes y conexiones de los bujes, radiadores y ventiladores, y la tapa y las paredes del tanque cerca de las salidas de alta corriente, donde el flujo disperso calienta el metal.",
    "cuando": "En la hora de mayor carga",
    "fuente": "MO.00418 §4.3: SUB-C2-01 «Inspección termográfica trimestral», SUB-PSM-04 «Inspección termográfica (semestral)» · IEC 60076-7:2005 §5.2 b)",
    "inferencia": false
  },
  {
    "id": "ACC-R1-04",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Revisar el deshidratante del respirador, el nivel del conservador (que debe dejar margen para la dilatación del aceite), la hermeticidad de bridas y empaquetaduras, y los focos de corrosión y el depósito salino en cuba, radiadores y aisladores. La corrosión que se encuentre se programa como SUB-C4-03 «Pintura parcial».",
    "cuando": "En la próxima inspección",
    "fuente": "MO.00418 §4.3 SUB-PSM-03 «Inspección ocular detallada (mensual)» y SUB-C4-03 «Pintura parcial» · IEC 60076-7:2005 §5.3 e)",
    "inferencia": false
  },
  {
    "id": "ACC-R3-02",
    "filas": [
      "R3",
      "R4"
    ],
    "columnas": [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Comparar la corriente del episodio con la corriente asignada de placa del cambiador de tomas, de los bujes, de sus transformadores de corriente y de las conexiones. Si el equipo tiene cambiador, programar su mantenimiento preventivo según su tipo: con ruptor en aceite (OILTAP), aceite y filtro de su compartimiento; con ruptor en vacío (VACUTAP), ampollas y sincronía del tren mecánico; en el conmutador sin tensión (NLTC), resistencia de contacto.",
    "cuando": "Después del episodio",
    "fuente": "IEC 60076-7:2005 §5.4 c) y §7.3.2 · IEEE C57.91-2011 §9.2.2 · MO.00418 §4.3 SUB-C3-05 «Mantenimiento preventivo OLTC/NLTC»",
    "inferencia": false
  },
  {
    "id": "ACC-A-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "A"
    ],
    "grupo": "",
    "texto": "Tomar una muestra de aceite para gases disueltos y análisis fisicoquímico, que incluya el contenido de agua, y registrar la calificación en Salud de Activos. Esa muestra es la línea base contra la que se leerán las siguientes.",
    "cuando": "Antes de aceptar más carga",
    "fuente": "MO.00418 §4.3 SUB-PSM-01 «Muestreo de aceite (semestral)»",
    "inferencia": true
  },
  {
    "id": "ACC-BC-01",
    "filas": [
      "R1",
      "R2"
    ],
    "columnas": [
      "B",
      "C"
    ],
    "grupo": "",
    "texto": "En la próxima muestra de aceite, pedir al laboratorio las partes por millón (ppm) de cada gas. Anotar también la carga de las horas previas, que muestra esta página, y la temperatura del aceite en la toma, porque los valores típicos de los gases dependen de la carga y del clima. Si la calificación de gases está en Medio, adelantar la muestra respecto del ciclo semestral.",
    "cuando": "En la próxima muestra",
    "fuente": "MO.00418 §4.3 SUB-PSM-01 «Muestreo de aceite (semestral)» · IEC 60599:2022 §3.1.10 · MO.00418 §A9.6 (contexto operativo de la muestra)",
    "inferencia": true
  },
  {
    "id": "ACC-R3-03",
    "filas": [
      "R3",
      "R4"
    ],
    "columnas": [
      "B",
      "C",
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Tomar una muestra de aceite de seguimiento para gases disueltos y fisicoquímico. Pedir las partes por millón (ppm) de cada gas y el contenido de agua referido a la temperatura de la toma, anotar la carga previa y comparar con la muestra anterior. El agua permite estimar la humedad del papel, que pesa en el riesgo de burbujas; si el relé Buchholz acumuló gas, enviar también una muestra de ese gas.",
    "cuando": "Después de cada episodio y antes de repetir una sobrecarga, en el plazo que fije el Profesional de Transformadores",
    "fuente": "MO.00418 §4.3 SUB-PSM-01 «Muestreo de aceite (semestral)» · IEC 60076-7:2005 §5.3 a) y §7.3.1 · IEC 60599:2022 §3.1.10",
    "inferencia": true
  },
  {
    "id": "ACC-DE-02",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "D",
      "E"
    ],
    "grupo": "",
    "texto": "Pedir al laboratorio, de la última muestra, las partes por millón (ppm) de cada gas, el diagnóstico del tipo de defecto según IEC 60599 y la velocidad de generación entre muestras, y tomar una muestra nueva. Si se confirma un defecto interno activo, programar la inspección de la parte activa para localizarlo.",
    "cuando": "Al revisar este detalle",
    "fuente": "IEC 60599:2022 §4.1 y §5.3 · MO.00418 §4.3 SUB-PSM-01 «Muestreo de aceite (semestral)» y SUB-C4-05 «Inspección de parte activa»",
    "inferencia": false
  },
  {
    "id": "ACC-E-01",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "E"
    ],
    "grupo": "c2h2",
    "texto": "Mantener el monitoreo intensivo semanal del acetileno y anotar en cada muestra la carga de las horas previas. Seguir su velocidad de generación (ppm por día) y su concentración (ppm) frente a los criterios de reclasificación del MO.00418. Si el monitoreo ya está activo, confirmar que la última muestra esté al día.",
    "cuando": "Semanal, mientras la calificación de acetileno siga en 5",
    "fuente": "MO.00418 §A9.1 (monitoreo intensivo de C₂H₂; reclasificación por velocidad o por concentración)",
    "inferencia": false
  },
  {
    "id": "ACC-E-02",
    "filas": [
      "R1",
      "R2",
      "R3",
      "R4"
    ],
    "columnas": [
      "E"
    ],
    "grupo": "c2h2",
    "texto": "Para ubicar el origen del acetileno, revisar con el laboratorio la parte activa, sus conexiones y el selector de tomas. Con ruptor en aceite (OILTAP), cada maniobra forma arco en su compartimiento: se verifica la hermeticidad entre ese compartimiento y la cuba y se muestrea también su aceite. Con ruptor en vacío (VACUTAP), el arco queda dentro de las ampollas y la búsqueda se centra en conexiones, núcleo y descargas.",
    "cuando": "Con la próxima muestra",
    "fuente": "IEC 60599:2022 §4.1 · MO.00418 §4.3 SUB-C3-05 «Mantenimiento preventivo OLTC/NLTC» (sustento técnico)",
    "inferencia": true
  }
],
});

/** Sin nivel: la carga del rango no pasa del umbral de CRG 4 ({crg} y {umbral} se rellenan en la página). */
export const TEXTO_CARGA_NORMAL = 'Carga normal en este rango: la cifra de cargabilidad está en el {umbral} % de la ampacidad o menos (CRG {crg}), y el panel no asigna nivel. Las calificaciones de gases disueltos se muestran como dato y se atienden según el plan de Salud de Activos.';

/** La calificación llega sin fecha de toma (el archivo de Salud de Activos no la trae). Dicho por el Ingeniero el 2026-10-01. */
export const TEXTO_FECHA_MUESTRA = 'Calificación de Salud de Activos sobre muestras de 2025, según el área (el archivo no trae la fecha de toma). Es anterior a la carga de este rango: no refleja su efecto.';

/** Acetileno en 5: el monitoreo semanal no depende de la carga, así que se dice siempre. */
export const TEXTO_ACETILENO_5 = 'Acetileno en 5: monitoreo intensivo semanal, sin depender de la carga (MO.00418 §A9.1).';
export const TEXTO_ACETILENO_34 = 'El acetileno no lo produce la sobrecarga: se forma en arcos, descargas o puntos muy calientes del metal (IEC 60599:2022 §4.1).';

export const NO_PUEDE_SABER = Object.freeze([
  "La temperatura del punto más caliente del devanado y la del aceite superior. El SCADA de esta página registra corriente, tensión, potencias y factor de potencia; esas temperaturas se leen en sitio, en los indicadores del equipo.",
  "Los minutos de sobrecarga que admite el equipo y la vida del papel ya consumida. Ambos se calculan con esas temperaturas, con el ambiente de cada hora y con los datos térmicos del fabricante.",
  "Lo que ocurre dentro de cada hora. Cada punto de la curva es un promedio horario. Los máximos de la hora se ven con «Valores a mostrar» → «Máximo de la hora» cuando el rango los trae, y no entran en la cifra.",
  "El tipo de defecto que produce los gases (térmico o eléctrico) y su temperatura. La plataforma guarda calificaciones de 1 a 5; el diagnóstico de IEC 60599 se hace con las partes por millón (ppm) de cada gas que entrega el laboratorio.",
  "La fecha exacta de la muestra de aceite. La calificación de gases llega sin fecha de toma registrada. Según el área, las calificaciones cargadas a octubre de 2026 provienen de muestras de 2025, y el efecto de la carga posterior a cada toma, si lo hay, aparecerá en la muestra siguiente.",
  "Si los ventiladores estaban en marcha en cada hora. La ampacidad supone toda la ventilación en servicio (ONAF); su estado se confirma en sitio con la verificación del sistema de enfriamiento.",
  "Si la carga produjo los gases. Los gases también pueden venir de un defecto interno, del cambiador de tomas o del envejecimiento previo del papel. La relación se confirma con una muestra de seguimiento tomada después de un periodo de carga alta.",
  "La toma en servicio del cambiador en cada hora. La tensión de esta página se compara contra la nominal del nivel, mientras que el límite de 1,05 veces se refiere a la tensión de la toma.",
  "El tipo de papel de cada equipo (convencional o termomejorado), que fija la temperatura de referencia de su envejecimiento. Tampoco su humedad actual, que se estima con el análisis fisicoquímico del aceite.",
  "La causa de la carga alta (demanda propia, contingencia o maniobra) y si sigue vigente. Se confirma con operación."
]);

export const NOTA_PIE = "Criterio de ingeniería del área de Transformadores de Potencia, basado en IEC 60076-7:2005, IEEE C57.91-2011, IEC 60599:2022 y el MO.00418.DE-GAC-AX.01 Ed. 02. El nivel que resulta de cruzar la carga con los gases es un criterio propio del área, apoyado en esas normas, y no una tabla de norma. Este panel apoya la decisión de operación y de mantenimiento; autorizar o restringir cada maniobra corresponde a operación y al dueño del activo.";
