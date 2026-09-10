// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Sustento técnico de cada actividad de mantenimiento
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// El alcance del documento de Mantenimiento Especializado ENUMERABA las
// actividades escogidas —«comprende regeneración de aceite, pintura parcial y
// reemplazo de componentes defectuosos»— sin argumentar ninguna. El Ingeniero
// lo pidió en contexto técnico: por qué se le hace cada cosa al activo.
//
// El módulo ya sabía argumentar por MODO DE DEGRADACIÓN (`TRABAJO_POR_MODO` en
// `fichas_diagnostico.js`), pero no sabía nada de cada ACTIVIDAD: el catálogo
// `MO.00418 §4.3` solo trae el nombre. Esto es lo que faltaba.
//
// CÓMO SE PRODUJO (y por qué se puede firmar)
// Redactado por macroactividad y sometido a un revisor de rigor normativo, que
// devolvió 48 correcciones sobre 36 actividades: una norma INVENTADA, dos que
// no aplicaban, una promesa de revertir lo irreversible, tres afirmaciones de
// dato y el resto imprecisiones técnicas. Todas aplicadas. Crudo en la bóveda.
//
// LAS TRES REGLAS QUE LO GOBIERNAN
//  1. Ninguna norma fuera del cuerpo que el proyecto ya usa. Ante la duda, la
//     referencia va VACÍA: una norma inventada invalida el documento.
//  2. Nada promete devolver lo que no vuelve. Lo que toca la celulosa CONTIENE
//     el avance; no restituye el grado de polimerización consumido.
//  3. Ningún texto afirma un valor medido: nombra la VARIABLE que motiva la
//     actividad. El valor lo pone el equipo, no la plantilla.
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ═════════════════════════════════════════════════════════════════════════════

/** Sustento técnico por código de subactividad del `MO.00418 §4.3`. */
export const SUSTENTO_ACCION = Object.freeze({
  'SUB-C2-01': {
    nombre: 'Inspección termográfica trimestral',
    subsistema: 'conexiones externas, bujes y radiadores',
    motiva: 'el estrechamiento del margen térmico propio de la condición 2, que convierte cualquier punto caliente en conexiones, bujes o radiadores en pérdida directa de capacidad de disipación',
    resultado: 'el mapa térmico del activo bajo carga, con los puntos calientes localizados por diferencia de temperatura contra la fase homóloga, el componente de referencia y la temperatura ambiente, y jerarquizados para orden de trabajo',
    noRevierte: 'no corrige el defecto que localiza ni recupera la vida de aislamiento ya consumida por el sobrecalentamiento previo',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.152 · IEC 60076-7'
  },
  'SUB-C2-02': {
    nombre: 'Verificación sistemas de enfriamiento',
    subsistema: 'ventiladores, bombas y radiadores',
    motiva: 'la dependencia del punto más caliente del devanado respecto de la capacidad real de disipación, que se pierde por etapas que no arrancan, bombas sin caudal y radiadores obstruidos sin que la operación normal lo evidencie',
    resultado: 'cada etapa de refrigeración probada en arranque automático y manual, con sentido de giro, consumo, caudal y limpieza de radiadores contrastados contra la condición de diseño, y las desviaciones que restan capacidad de disipación cuantificadas y escaladas a corrección',
    noRevierte: 'no recupera la vida de aislamiento consumida durante la operación con la refrigeración degradada',
    reiniciaLineaBase: false,
    referencia: 'IEC 60076-7 · IEEE C57.91'
  },
  'SUB-C2-03': {
    nombre: 'Verificación indicadores de temperatura',
    subsistema: 'instrumentación térmica y cadena de disparo',
    motiva: 'la deriva de calibración de los termómetros de aceite y de imagen térmica, de los que dependen el arranque escalonado de la refrigeración, la alarma y el disparo por sobretemperatura',
    resultado: 'los indicadores de aceite y de imagen térmica contrastados contra patrón, con los puntos de ajuste de arranque, alarma y disparo verificados y la señal remota concordante con la lectura local',
    noRevierte: 'no recupera el envejecimiento acumulado mientras la instrumentación desviada ocultó la sobretemperatura real',
    reiniciaLineaBase: false,
    referencia: 'IEC 60076-7'
  },
  'SUB-C2-04': {
    nombre: 'Inspección ocular detallada (quincenal)',
    subsistema: 'cuba, sistema de preservación y accesorios',
    motiva: 'la aparición de fugas, la caída de nivel de aceite, la saturación del deshidratante y la contaminación superficial de bujes, que evolucionan entre visitas y no esperan al ensayo del período',
    resultado: 'la hermeticidad, el nivel de aceite, el estado del deshidratante, de los aisladores y de las protecciones mecánicas registrados con periodicidad quincenal, y los hallazgos escalados a orden de trabajo antes de que degraden la condición',
    noRevierte: 'no corrige lo que encuentra ni deshace el deterioro que la fuga, la pérdida de nivel de aceite o el deshidratante saturado ya produjeron sobre el sistema aislante',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
  'SUB-C2-05': {
    nombre: 'Pruebas eléctricas',
    subsistema: 'aislamiento de devanados y bujes',
    motiva: 'la evolución del estado dieléctrico de devanados y bujes y de la integridad de los circuitos y las conexiones internas, que no se observa desde la inspección visual ni desde la termografía',
    resultado: 'el estado dieléctrico y de continuidad medido y calificado contra la norma prueba por prueba, con veredicto independiente por ensayo y la línea base eléctrica del activo actualizada',
    noRevierte: 'no modifica la condición del activo — mide y califica; la degradación del aislamiento sólido que revele no se corrige con ensayo alguno',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.152'
  },
  'SUB-C2-06': {
    nombre: 'Evaluación de DPS',
    subsistema: 'descargadores de sobretensión y su tierra',
    motiva: 'la exposición del aislamiento del transformador a sobretensiones atmosféricas y de maniobra, que un descargador degradado o con conexión a tierra deficiente deja de limitar sin manifestarlo en operación',
    resultado: 'el descargador verificado en corriente de fuga, aislamiento externo, lectura del contador de descargas y continuidad de la conexión a tierra, con su capacidad de limitar las sobretensiones calificada y el reemplazo escalado cuando la evaluación lo condena',
    noRevierte: 'no repara el aislamiento del transformador ya degradado por las sobretensiones soportadas antes de la verificación',
    reiniciaLineaBase: false,
    referencia: ''
  },
  'SUB-C3-01': {
    nombre: 'Corrección de fugas por accesorios',
    subsistema: 'sistema de preservación y cuba',
    motiva: 'la pérdida de hermeticidad en empaquetaduras, bridas, válvulas y radiadores, que sostiene el descenso de nivel y habilita el ingreso de humedad y oxígeno al aceite',
    resultado: 'hermeticidad restituida y comprobada con prueba de estanqueidad, con el nivel de aceite repuesto y el sistema de preservación verificado',
    noRevierte: 'el sellado detiene el ingreso, pero no extrae la humedad ya absorbida por el aislamiento sólido ni recupera la vida consumida durante el periodo de fuga',
    reiniciaLineaBase: false,
    referencia: 'IEC 60076-1'
  },
  'SUB-C3-02': {
    nombre: 'Actualización de accesorios',
    subsistema: 'accesorios de cuba e instrumentación',
    motiva: 'la obsolescencia o salida de servicio de accesorios de protección y medida —respirador, indicadores de nivel y temperatura, válvulas, relé Buchholz y dispositivo de alivio de presión— que deja al activo sin defensa ni señal frente al modo de falla identificado',
    resultado: 'accesorios normalizados, operativos y contrastados, con la instrumentación de vigilancia del activo devuelta a servicio',
    noRevierte: 'la renovación de accesorios recompone la defensa y la señal del activo, no la condición del aislamiento ya degradado',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
  'SUB-C3-03': {
    nombre: 'Actualización de tablero',
    subsistema: 'tablero de control y protecciones',
    motiva: 'el deterioro de cableado, borneras y dispositivos del tablero, que compromete el disparo de las protecciones propias del transformador, el arranque del enfriamiento forzado y la señal de temperatura enviada al centro de control',
    resultado: 'lógica de control y protección probada punto a punto, con enfriamiento forzado, alarmas y disparos verificados en campo y señalizados al telecontrol',
    noRevierte: 'el tablero restituye la vigilancia y la actuación, no la condición del aislamiento que vigila',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
  'SUB-C3-04': {
    nombre: 'Secado de aceite',
    subsistema: 'aceite dieléctrico de la cuba',
    motiva: 'el contenido de agua y la caída de la rigidez dieléctrica del aceite, agravados por el ingreso de humedad y por la migración desde el aislamiento sólido a temperatura de operación',
    resultado: 'aceite deshidratado y desgasificado por termovacío, con humedad y rigidez dieléctrica devueltas a criterio de aceite en servicio y verificadas por ensayo posterior',
    noRevierte: 'la extracción del agua del aceite no restituye el grado de polimerización del papel; además la mayor parte del agua reside en el aislamiento sólido y migra de nuevo al aceite hasta reequilibrarse a temperatura de operación, de modo que el resultado se sostiene solo si se corrige la fuente de ingreso y se interviene también el aislamiento sólido',
    reiniciaLineaBase: true,
    referencia: 'IEC 60422 · ASTM D1816'
  },
  'SUB-C3-05': {
    nombre: 'Mantenimiento preventivo OLTC/NLTC',
    subsistema: 'conmutador de tomas OLTC/NLTC',
    motiva: 'las maniobras acumuladas y el desgaste de los contactos del conmutador; en los conmutadores bajo carga con ruptura en aceite (OILTAP), además el estado del aceite y del filtro de su compartimiento; en los de ruptura en vacío (VACUTAP), el estado de las ampollas y la sincronía del tren mecánico y del accionamiento motorizado; y en el conmutador sin tensión (NLTC), la resistencia de contacto y la película de óxido que deja la permanencia prolongada en una misma posición',
    resultado: 'conmutador verificado en secuencia de maniobra y resistencia dinámica de contactos; en las unidades OILTAP, aceite y filtro del compartimiento atendidos; en las VACUTAP, ampollas de vacío comprobadas; y en el NLTC, ciclado completo de posiciones con verificación de la resistencia de contacto y del bloqueo mecánico. En los conmutadores bajo carga la posición queda concordante entre accionamiento local, tablero y telecontrol.',
    noRevierte: 'la intervención preventiva ajusta, limpia y verifica; el desgaste acumulado de los contactos de servicio y del ruptor, o el agotamiento de las ampollas de vacío, solo se corrige con despiece, alcance propio del correctivo mayor',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
  'SUB-C3-06': {
    nombre: 'Regeneración aceite (frío)',
    subsistema: 'aceite dieléctrico de la cuba',
    motiva: 'la acidez, la tensión interfacial y el color del aceite fuera de criterio, con productos de oxidación y lodos que obstruyen la disipación térmica y realimentan la degradación del aislamiento sólido',
    resultado: 'aceite regenerado e inhibido, con acidez, tensión interfacial, humedad y rigidez dieléctrica devueltas a criterio de aceite en servicio y verificadas por ensayo posterior',
    noRevierte: 'la regeneración restituye las propiedades físico-químicas del aceite, no el grado de polimerización del papel: al retirar los productos de oxidación frena la hidrólisis de la celulosa y contiene el avance del envejecimiento, pero no devuelve la vida de aislamiento ya consumida',
    reiniciaLineaBase: true,
    referencia: 'IEC 60422 · ASTM D974 · ASTM D971'
  },
  'SUB-C3-07': {
    nombre: 'Recuperación aislamientos',
    subsistema: 'aislamiento sólido de la parte activa',
    motiva: 'la humedad retenida en el aislamiento sólido y el factor de potencia de aislamientos fuera de criterio, que sostienen la hidrólisis de la celulosa y reducen el margen dieléctrico del devanado',
    resultado: 'aislamiento sólido deshumidificado por circulación de aceite caliente y tratamiento del aceite en ciclos sucesivos, con factor de potencia y resistencia de aislamiento medidos antes y después de la intervención, y el contenido de agua del papel estimado por equilibrio con el agua en aceite a temperatura de operación',
    noRevierte: 'la extracción de humedad frena la hidrólisis de la celulosa pero no restituye el grado de polimerización ni la vida de aislamiento ya consumida: contiene el avance, no lo devuelve',
    reiniciaLineaBase: true,
    referencia: 'IEC 60422 · CIGRÉ 445'
  },
  'SUB-C3-M1': {
    nombre: 'Aumento de caudal de refrigeración',
    subsistema: 'sistema de refrigeración forzada',
    motiva: 'la cargabilidad sostenida y el gradiente térmico entre el punto más caliente y el aceite superior, con etapas de refrigeración instaladas que no entran en servicio o entregan menos caudal del previsto en diseño',
    resultado: 'el caudal de aire —y el de aceite en unidades de circulación forzada— queda por encima del punto en que la unidad venia operando: etapas de refrigeración restituidas al servicio, radiadores despejados y consignas de arranque ajustadas, con lo que el aceite superior y el punto más caliente descienden para la misma carga. La verificación cubre ventiladores, bombas donde existan, estado de radiadores, indicadores de temperatura de aceite y de devanado por imagen térmica, y termografia bajo carga',
    noRevierte: 'la vida ya consumida del aislamiento sólido: el grado de polimerización perdido no se recupera, y los compuestos furanicos solo informan de ese consumo —su concentración en el aceite baja con un tratamiento sin que el papel mejore—. El mayor caudal contiene el ritmo de envejecimiento térmico, no restituye vida al papel',
    reiniciaLineaBase: false,
    referencia: 'IEC 60076-7 · IEEE C57.91 · MO.00418 §4.1.3'
  },
  'SUB-C3-M2': {
    nombre: 'Aumento de capacidad sistema refrigeración',
    subsistema: 'banco de radiadores e intercambiadores',
    motiva: 'el crecimiento de la demanda atendida por la unidad frente a un sistema de refrigeración que ya opera en su etapa máxima, donde el punto más caliente gobierna el límite de carga admisible',
    resultado: 'la unidad queda con mayor superficie de disipación y con una etapa adicional de refrigeración en servicio, de modo que el aceite superior y el punto más caliente descienden para la misma carga y se amplia el margen de cargabilidad. El aumento es de capacidad de disipación y no de potencia nominal: asignar una potencia a la nueva etapa de refrigeración exige la validación del fabricante y su comprobación por ensayo de calentamiento. La verificación en sitio cubre el comportamiento térmico bajo carga y la secuencia de arranque escalonado de ventiladores y de bombas donde existan',
    noRevierte: 'el envejecimiento acumulado de la celulosa ni los defectos internos preexistentes: la mayor disipación amplia el margen térmico y reduce el ritmo de envejecimiento, no restituye vida al aislamiento sólido ni corrige un defecto interno, que conserva su propio seguimiento por gases disueltos',
    reiniciaLineaBase: true,
    referencia: 'IEC 60076-1 · IEC 60076-7 · IEEE C57.91 · MO.00418 §4.1.3'
  },
  'SUB-C3-M3': {
    nombre: 'Instalación unidad de transformación adicional',
    subsistema: 'capacidad de transformación de la subestación',
    motiva: 'la cargabilidad sostenida por encima del margen admisible cuando la refrigeración instalada ya no ofrece recorrido y la demanda atendida no admite reducción por maniobra de red',
    resultado: 'la carga queda repartida entre las dos unidades en proporción a su potencia nominal e inversamente a su impedancia de cortocircuito porcentual —reparto valido solo con grupo vectorial, relación de transformación y posición de tomas compatibles— y el transformador existente opera por debajo de su potencia nominal. El margen para ventanas de mantenimiento sin interrupción del suministro queda sujeto a que la unidad restante admita la demanda total en la condición de análisis',
    noRevierte: 'la degradación ya ocurrida dentro de la cuba: el alivio de carga reduce el esfuerzo térmico y la aceleración del envejecimiento, pero los defectos internos y la pérdida de vida del papel conservan su propio seguimiento',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.91 · IEC 60076-7 · MO.00418 §4.1.3'
  },
  'SUB-C4-01': {
    nombre: 'Regeneración de aceite',
    subsistema: 'aceite dieléctrico y sistema de preservación',
    motiva: 'el ensayo físico-químico ubica el aceite en condición degradada por acidez, tensión interfacial y rigidez dieléctrica fuera de criterio, con productos de oxidación que atacan la celulosa y obstruyen los canales de refrigeración',
    resultado: 'aceite con acidez, tensión interfacial, rigidez dieléctrica y contenido de humedad restituidos a valores de aceite en servicio, con los productos de oxidación retirados del fluido, arrastre de los lodos depositados sobre la parte activa y renovación del deshidratante del respirador',
    noRevierte: 'no restituye el grado de polimerización de la celulosa ya consumido: retira el agente que acelera el envejecimiento, no el envejecimiento acumulado',
    reiniciaLineaBase: true,
    referencia: 'IEC 60422 · ASTM D974 · ASTM D971 · NTC 3284 · MO.00418 §4.1.2'
  },
  'SUB-C4-02': {
    nombre: 'Secado de parte activa',
    subsistema: 'aislamiento sólido de la parte activa',
    motiva: 'el contenido de humedad del aislamiento sólido, estimado por el reparto de agua entre papel y aceite y respaldado por la respuesta dieléctrica, deprime la rigidez del conjunto y reduce el margen de sobrecarga admisible',
    resultado: 'humedad del aislamiento sólido llevada al rango de operación y rigidez dieléctrica del conjunto recuperada, verificadas con los ensayos eléctricos y físico-químicos posteriores a la intervención',
    noRevierte: 'el secado retira agua, no despolimerización: el grado de polimerización y la resistencia mecánica que el papel ya perdió no se recuperan',
    reiniciaLineaBase: true,
    referencia: 'IEC 60422 · CIGRÉ 445'
  },
  'SUB-C4-03': {
    nombre: 'Pintura parcial',
    subsistema: 'cuba, radiadores y superficies externas',
    motiva: 'la degradación del recubrimiento en cuba, tapas, radiadores y bases deja el acero base expuesto a corrosión en ambiente salino, que evoluciona hacia perforación, fuga de aceite y degradación de la transferencia de calor en los radiadores',
    resultado: 'recubrimiento restituido en las zonas intervenidas sobre superficie preparada, sin focos de corrosión activa que comprometan la hermeticidad ni la disipación térmica',
    noRevierte: 'no repone el espesor de pared perdido por corrosión ni sustituye la reparación estructural de un punto ya perforado',
    reiniciaLineaBase: false,
    referencia: ''
  },
  'SUB-C4-04': {
    nombre: 'Mantenimiento OLTC con despiece',
    subsistema: 'conmutador bajo carga (OLTC)',
    motiva: 'las operaciones acumuladas desde la última intervención, los tiempos de transición medidos y la firma de gases del compartimiento del ruptor evidencian desgaste de contactos y agotamiento del medio de conmutación',
    resultado: 'conmutador con contactos principales y de arco, resistencias de transición, mando mecánico y aceite del compartimiento del ruptor verificados o repuestos, y tiempos de transición dentro del rango indicado por el fabricante del conmutador. La renovación del aceite del compartimiento reinicia la línea base de gases disueltos de ese compartimiento; la del tanque principal no se altera.',
    noRevierte: 'no interviene el devanado de regulación ni el aislamiento de la parte activa, que quedan fuera del alcance del despiece del conmutador',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.152 · IEC 60599 · CIGRÉ 445'
  },
  'SUB-C4-05': {
    nombre: 'Inspección de parte activa',
    subsistema: 'núcleo, devanados y estructura de sujeción',
    motiva: 'la firma de gases disueltos o la medición de descargas parciales acreditan un defecto interno que los ensayos desde bornes no permiten localizar ni caracterizar',
    resultado: 'nucleo, devanados, aislamientos y estructura de sujeción inspeccionados con el defecto localizado o acotado a un subsistema, y el estado del apriete, de las conexiones internas y de los canales de refrigeración documentado como soporte de la reparación',
    noRevierte: 'no restituye condición por sí misma: es un acto de diagnóstico que define el trabajo correctivo posterior, el cual se ejecuta y se costea aparte',
    reiniciaLineaBase: true,
    referencia: 'IEC 60599 · IEEE C57.104 · IEC 60270'
  },
  'SUB-C4-06': {
    nombre: 'Reemplazo de bushings',
    subsistema: 'bujes de alta y baja',
    motiva: 'el factor de potencia y la capacitancia del buje se apartan de su valor de placa y de su propio histórico, o el buje presenta fuga, contaminación o daño de porcelana que no admiten corrección en campo',
    resultado: 'bujes sustituidos por unidades de igual clase de aislamiento, corriente nominal y línea de fuga, con factor de potencia, capacitancia, estanqueidad y torque de conexión verificados antes de la puesta en servicio',
    noRevierte: 'no modifica la condición del devanado ni del aislamiento principal, que se califican por prueba independiente',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.152'
  },
  'SUB-C4-07': {
    nombre: 'Reemplazo o reparación componentes defectuosos',
    subsistema: 'accesorios, protecciones e instrumentación',
    motiva: 'la inspección y la prueba funcional identifican accesorios defectuosos —fugas en válvulas y empaquetaduras, indicadores fuera de calibración, protecciones mecánicas que no operan y etapas de refrigeración fuera de servicio— que dejan al activo sin sus salvaguardas',
    resultado: 'componentes defectuosos repuestos o reparados, con protecciones mecánicas probadas en sus puntos de alarma y disparo, instrumentación calibrada, etapas de refrigeración operando y hermeticidad restituida',
    noRevierte: 'no modifica la condición del aceite ni del aislamiento: restituye las salvaguardas y la instrumentación, no la salud del núcleo activo',
    reiniciaLineaBase: false,
    referencia: 'IEC 60076-1'
  },
  'SUB-C4-08': {
    nombre: 'Plan de mitigación sobrecarga 90-110 %',
    subsistema: 'régimen de carga y perfil térmico',
    motiva: 'el activo sostiene su carga en la franja de 90 % a 110 % de la capacidad nominal, donde el punto más caliente gobierna la tasa de envejecimiento térmico del aislamiento y puede llevarla por encima del ritmo nominal, y la contingencia queda sin margen de transferencia',
    resultado: 'plan de operación documentado con límites de carga, criterios de sobrecarga de emergencia, seguimiento del punto más caliente y maniobras de transferencia definidas para la contingencia',
    noRevierte: 'no aumenta la capacidad de transformación instalada ni recupera la vida de aislamiento ya consumida por el esfuerzo térmico acumulado',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.91 · IEC 60076-7 · MO.00418 §4.1.3'
  },
  'SUB-C4-M1': {
    nombre: 'Repotenciación de unidad de transformación',
    subsistema: 'capacidad de transformación de la subestación',
    motiva: 'la cargabilidad sostenida desde el 90 % de la capacidad nominal y la ausencia de margen de reserva en la subestación, que mantienen el punto más caliente del devanado en el rango donde el envejecimiento térmico del aislamiento se acelera',
    resultado: 'capacidad de transformación acorde con la demanda y con el criterio de contingencia de la subestación, con el activo operando por debajo de su límite térmico y con la tasa de envejecimiento térmico del aislamiento en el orden que corresponde a la operación nominal mientras se sostenga esa condición de carga',
    noRevierte: 'no recupera el grado de polimerización del papel ni el estado del aislamiento sólido ya alcanzado: retira el esfuerzo que lo degrada, no la degradación acumulada',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.91 · IEC 60076-7'
  },
  'SUB-C4-M2': {
    nombre: 'Movimiento estratégico de transformadores',
    subsistema: 'ubicación del activo en la red',
    motiva: 'el desajuste entre capacidad instalada y demanda por emplazamiento, que mantiene a un activo ya degradado atendiendo la exigencia de carga y la criticidad de servicio de un nodo que requiere una unidad con margen, mientras existen en el sistema emplazamientos de menor exigencia térmica y menor criticidad donde ese mismo activo presta servicio sin condicionarlo',
    resultado: 'el activo degradado operando en un emplazamiento de menor exigencia térmica y menor criticidad, previa verificación de la compatibilidad eléctrica del destino —relación de transformación, grupo de conexión, impedancia de cortocircuito para operación en paralelo, nivel de cortocircuito del nodo y rango del conmutador—, y la demanda crítica atendida por una unidad con margen. La condición del activo trasladado se verifica con pruebas eléctricas y de aceite antes de energizar; el drenaje, llenado y tratamiento del aceite que exige el traslado dejan la evaluación de gases disueltos y de compuestos furánicos referida a un nuevo cero.',
    noRevierte: 'no mejora la condición interna del activo trasladado —cambia la exigencia a la que se somete, no el grado de envejecimiento ya alcanzado por su aislamiento— y el tratamiento del aceite retira el trazador del envejecimiento del papel, no el envejecimiento',
    reiniciaLineaBase: true,
    referencia: 'IEEE C57.91 · IEEE C57.152 · IEC 60422'
  },
  'SUB-C5-01': {
    nombre: 'Pintura total',
    subsistema: 'protección superficial de cuba y radiadores',
    motiva: 'el deterioro del recubrimiento externo y los focos de corrosión sobre cuba, radiadores, tuberías y gabinetes, agravados por la salinidad y la humedad del ambiente costero',
    resultado: 'superficie externa con preparación mecánica, tratamiento de los focos de óxido y sistema de recubrimiento restituido en su totalidad, que detiene la progresión de la corrosión y preserva el espesor de pared remanente mientras el activo permanece en servicio',
    noRevierte: 'no interviene el aislamiento interno ni la condición de salud del activo, y no recupera el espesor de acero ya perdido por corrosión',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
  'SUB-C5-02': {
    nombre: 'Retrofit de protecciones mecánicas y tableros',
    subsistema: 'protecciones mecánicas, tablero y señalización',
    motiva: 'la obsolescencia y el desempeño incierto de la cadena de protección mecánica —relé Buchholz, dispositivo de alivio de presión, imagen térmica e indicadores de nivel y temperatura— junto con el envejecimiento del cableado y las borneras del tablero de control',
    resultado: 'cadena de protección y señalización repuesta con dispositivos vigentes y verificada punto a punto mediante prueba funcional de alarma y disparo, con las señales de alarma y disparo cableadas a bornera para su integración al sistema de control de la subestación',
    noRevierte: 'no modifica el estado del aislamiento ni la probabilidad de falla interna del activo: acota la consecuencia de esa falla, no su ocurrencia',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
  'SUB-C5-03': {
    nombre: 'Regeneración de aislamientos',
    subsistema: 'aceite dieléctrico y aislamiento sólido',
    motiva: 'la acidez, la tensión interfacial y el contenido de humedad del aceite fuera de criterio de servicio, con productos de oxidación depositados sobre el aislamiento sólido y rigidez dieléctrica deprimida',
    resultado: 'aceite regenerado, con acidez, tensión interfacial, humedad y rigidez dieléctrica restituidas a criterio de servicio y verificadas por ensayo de laboratorio posterior, y humedad del aislamiento sólido reducida por migración al aceite en pasadas sucesivas, verificada tras el reequilibrio mediante los ensayos eléctricos posteriores a la intervención. El tratamiento reinicia la línea base de gases disueltos y de compuestos furánicos, de modo que la evaluación siguiente se hace contra un nuevo cero.',
    noRevierte: 'no restituye el grado de polimerización de la celulosa ya degradada: la vida de aislamiento consumida no se recupera y el proceso únicamente contiene el avance de la hidrólisis y la oxidación que la consumen',
    reiniciaLineaBase: true,
    referencia: 'IEC 60422 · ASTM D1816 · ASTM D971 · ASTM D974 · ASTM D5837'
  },
  'SUB-C5-04': {
    nombre: 'Propuesta a Plan de Inversión (PI)',
    subsistema: 'unidad completa, ciclo de reposición',
    motiva: 'la clasificación del activo en condición 5 por índice de salud, el agotamiento de las alternativas de intervención frente al modo de degradación dominante y la criticidad que le imponen los usuarios aguas abajo',
    resultado: 'expediente técnico-económico que sustenta la reposición ante el Plan de Inversión, con la evidencia de ensayos, la condición vigente, la criticidad del punto y la trazabilidad de las alternativas de intervención evaluadas, y que propone la ventana de reposición y las condiciones de operación del activo hasta ejecutarla',
    noRevierte: 'no altera la condición del activo ni detiene su degradación: la unidad continúa en servicio bajo vigilancia reforzada hasta que la reposición se ejecute',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.2 · MO.00418 §4.3'
  },
  'SUB-C5-05': {
    nombre: 'Aumento de capacidad de transformación',
    subsistema: 'punto de transformación de la subestación',
    motiva: 'la cargabilidad sostenida del activo frente a su capacidad nominal y el crecimiento de la demanda, que dejan el punto de transformación sin margen de contingencia y mantienen el aislamiento bajo exigencia térmica',
    resultado: 'capacidad instalada ampliada en el punto de transformación, con margen de reserva y de maniobra en contingencia restituido y la carga redistribuida, de modo que la unidad en condición 5 opere por debajo de su capacidad nominal y con menor exigencia térmica sobre el aislamiento',
    noRevierte: 'no recupera la vida de aislamiento ya consumida por la sobrecarga acumulada ni mejora la condición de salud de la unidad existente: reduce la exigencia futura, no el daño acumulado',
    reiniciaLineaBase: false,
    referencia: 'IEC 60076-7 · IEEE C57.91 · MO.00418 §4.1.3'
  },
  'SUB-PSM-01': {
    nombre: 'Muestreo de aceite (semestral)',
    subsistema: 'aceite dieléctrico y aislamiento sólido',
    motiva: 'la vigencia de la tendencia de gases disueltos y de las propiedades fisicoquímicas del aceite, el indicador que expone más temprano un defecto interno en evolución sin retirar el activo de servicio',
    resultado: 'deja actualizada la tendencia de gases disueltos —incluidos CO y CO₂, que delatan la degradación de la celulosa— y la de rigidez dieléctrica, acidez, tensión interfacial y contenido de humedad, con veredicto por norma sobre cada parámetro. La tendencia se lee contra la línea base vigente: todo tratamiento del aceite la deja en cero y la comparación siguiente parte de ahí.',
    noRevierte: 'el muestreo diagnostica y no interviene: no corrige por sí mismo ninguna propiedad del aceite ni el estado del aislamiento sólido',
    reiniciaLineaBase: false,
    referencia: 'IEC 60599 · IEEE C57.104 · IEC 60422 · ASTM D1816 · ASTM D971 · ASTM D974'
  },
  'SUB-PSM-02': {
    nombre: 'Pruebas eléctricas (anual)',
    subsistema: 'devanados, bujes y núcleo',
    motiva: 'el estado dieléctrico y geométrico del conjunto devanados-bujes-núcleo, que el ensayo de aceite no mide de forma directa y que solo queda declarado contrastando el valor medido contra el criterio de norma',
    resultado: 'deja calificados de forma independiente por prueba la resistencia de aislamiento, el factor de potencia de devanados y de bujes, la relación de transformación, la resistencia óhmica, la corriente de excitación y la reactancia de dispersión, con la línea base anual del activo actualizada',
    noRevierte: 'el ensayo declara la condición y no la modifica: ninguna propiedad dieléctrica se restituye por medirla',
    reiniciaLineaBase: false,
    referencia: 'IEEE C57.152 · IEC 60076-1'
  },
  'SUB-PSM-03': {
    nombre: 'Inspección ocular detallada (mensual)',
    subsistema: 'cuba, sistema de preservación y accesorios',
    motiva: 'la aparición de fugas, corrosión, saturación del deshidratante y pérdida de hermeticidad, que evolucionan entre ensayos de laboratorio y que la medición eléctrica y el ensayo de aceite solo delatan cuando la consecuencia ya está dentro del activo',
    resultado: 'deja verificados el nivel de aceite, el estado del respirador y su deshidratante, la hermeticidad de bridas y empaquetaduras, la integridad de la pintura y la limpieza de los aisladores, con registro fechado de cada hallazgo',
    noRevierte: 'la inspección detecta y documenta; la corrección de los hallazgos que exceden el ajuste menor se programa como actividad propia y no se da por ejecutada aquí',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
  'SUB-PSM-04': {
    nombre: 'Inspección termográfica (semestral)',
    subsistema: 'bornes, conexiones y sistema de refrigeración',
    motiva: 'el gradiente térmico en bornes y conexiones, originado en resistencia de contacto elevada, y el patrón térmico irregular de radiadores, ventiladores y bombas, que delata pérdida de capacidad de disipación; ambos elevan la temperatura del punto más caliente del devanado y aceleran el consumo de vida del aislamiento sólido',
    resultado: 'deja localizado y jerarquizado el punto caliente accesible a la inspección en bornes, conexiones, radiadores, ventiladores y bombas, con la carga del momento registrada como condición del ensayo',
    noRevierte: 'la termografía localiza el punto caliente y no lo corrige; tampoco devuelve la vida de aislamiento que el sobrecalentamiento ya consumió',
    reiniciaLineaBase: false,
    referencia: 'IEC 60076-7 · IEEE C57.91'
  },
  'SUB-PSM-05': {
    nombre: 'Diagnóstico sistema puesta a tierra (anual)',
    subsistema: 'sistema de puesta a tierra',
    motiva: 'la resistencia del sistema de puesta a tierra y la continuidad de las derivaciones de cuba, neutro y descargadores, de las que dependen la evacuación de la corriente de falla y de la corriente de descarga, las tensiones de paso y contacto durante la falla y la efectividad de la protección contra sobretensiones',
    resultado: 'deja medida la resistencia de puesta a tierra contra el valor admisible y verificada la continuidad de las derivaciones de cuba, neutro, descargadores y tablero de control',
    noRevierte: 'el diagnóstico mide y verifica; la reposición de conductores, soldaduras o electrodos deficientes se ejecuta como trabajo aparte',
    reiniciaLineaBase: false,
    referencia: 'MO.00418 §4.3'
  },
});

/** Normaliza un nombre de actividad para buscarlo sin depender de tildes. */
function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

const POR_NOMBRE = Object.freeze(Object.entries(SUSTENTO_ACCION)
  .reduce((m, [cod, v]) => { m[norm(v.nombre)] = cod; return m; }, {}));

/**
 * Sustento técnico de una acción escogida.
 *
 * Busca por CÓDIGO —que es lo exacto— y, si la acción no lo trae (viene del
 * plan registrado del equipo, que es texto libre de Salud de Activos), por
 * nombre normalizado. Devuelve `null` si no hay ficha: una acción sin sustento
 * se enumera, pero NO se le inventa un argumento.
 *
 * @param {{codigo?:string, txt?:string, nombre?:string}} accion
 * @returns {object|null}
 */
export function sustentoDeAccion(accion) {
  const a = accion || {};
  if (a.codigo && SUSTENTO_ACCION[a.codigo]) return SUSTENTO_ACCION[a.codigo];
  const cod = POR_NOMBRE[norm(a.txt || a.nombre)];
  return cod ? SUSTENTO_ACCION[cod] : null;
}
