// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Beneficios de las PRÁCTICAS de mantenimiento escogidas
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// Pedido del Ingeniero (2026-09-23, `99 §92`): en la hoja de Beneficios del
// documento de Mantenimiento Especializado se escogen las macroactividades y
// acciones de mantenimiento y, con base en ellas, el módulo PROPONE los
// beneficios que gana el activo, «en un contexto técnico y enfocado en el riesgo
// operativo de falla catastrófica de los equipos que no son fáciles de adquirir
// por su construcción especializada». Y luego (2026-09-24, `99 §95`): «que los
// beneficios vayan saliendo conforme a las acciones de mantenimiento que yo
// escoja; la redacción debe ser breve» → un renglón breve por práctica marcada.
//
// CÓMO SE PRODUJO EL TEXTO (y por qué se puede firmar)
// Cada beneficio lo redactó un agente a partir del SUSTENTO técnico de la
// práctica (`acciones_tecnicas.js`, ya revisado con 48 correcciones) y lo
// corrigió un revisor técnico adversarial; un editor escribió la apertura y el
// cierre y unificó el tono. Crudo en la bóveda (`2026-09-23-beneficios-practicas`).
//
// LAS REGLAS (las mismas del sustento, más una)
//  1. Nada se promete que no se cumple: «reduce la probabilidad», «contiene»,
//     «anticipa»; nunca «elimina el riesgo» ni «garantiza».
//  2. Lo irreversible no se devuelve (grado de polimerización, edad).
//  3. Ningún número ni valor medido; ninguna norma dentro del texto.
//  4. Las prácticas de diagnóstico DETECTAN a tiempo: no reducen el riesgo solas.
//  5. Una acción sin beneficio catalogado NO se inventa: sale [PENDIENTE].
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ═════════════════════════════════════════════════════════════════════════════

import { macroactividadesCatalogo, normalizarAccion } from './fichas_acciones.js';

/**
 * Apertura BREVE y técnica del texto (`99 §95`, `§97`). Huecos: {MATRICULA}, {MVA}, {SUB}.
 */
export const APERTURA_BENEFICIOS = "El transformador de potencia {MATRICULA}, de {MVA} MVA, en la subestación {SUB}, es un equipo de construcción especializada y reposición no inmediata. Los beneficios siguientes, uno por práctica, se expresan frente al riesgo operativo de falla catastrófica del activo.";

/** Apertura amplia de `§92`: se conserva como sustento; ya no sale en el texto. */
export const APERTURA_BENEFICIOS_AMPLIA = "El transformador de potencia {MATRICULA}, de {MVA} MVA, instalado en la subestación {SUB}, es un equipo de construcción especializada, diseñado y fabricado a la medida de su punto de conexión y de reposición no inmediata. En él, una falla catastrófica no se resuelve cambiando de unidad: la parte activa comprometida exige reparación en fábrica o un reemplazo que coincida con la relación de transformación, el grupo de conexión, la impedancia de cortocircuito y la disposición física del punto. Las prácticas escogidas actúan sobre los mecanismos que conducen a esa falla: las de diagnóstico los detectan a tiempo para intervenir; las de intervención reducen su probabilidad o acotan su severidad.";

/** Cierre BREVE y técnico del texto (`99 §95`, `§97`). */
export const CIERRE_BENEFICIOS = "El mantenimiento actúa sobre la probabilidad de falla y, al recomponer las protecciones, sobre su severidad. La vida consumida del aislamiento sólido no se recupera: su despolimerización solo se contiene.";

/** Cierre amplio de `§92`: se conserva como sustento; ya no sale en el texto. */
export const CIERRE_BENEFICIOS_AMPLIO = "El mantenimiento actúa sobre la probabilidad de falla y, cuando recompone las protecciones, sobre la severidad con que una falla interna escala; la consecuencia sobre el servicio la fija la criticidad por usuarios aguas abajo. Lo consumido del aislamiento sólido, en grado de polimerización y resistencia mecánica del papel, no se recupera: las prácticas que actúan sobre la celulosa contienen el avance de su degradación. El beneficio se sostiene con la continuidad del seguimiento y la ejecución oportuna de lo que el diagnóstico identifique.";

/**
 * Beneficio técnico de cada práctica, por código del `MO.00418 §4.3`.
 * `falla`: el modo de falla catastrófica que la práctica ayuda a prevenir.
 * `beneficio`: el renglón que sale en el texto, breve y con TÉRMINOS TÉCNICOS
 *   (15-32 palabras, `99 §95` y `§97`): 3 redactores → 3 revisores técnicos → 1 editor.
 * `beneficioAmplio`: el de `§92`, que sustenta al breve; no sale en el texto.
 * Las prácticas de INVERSIÓN no están: no van en el documento de mantenimiento
 * (`99 §74.20`).
 */
export const BENEFICIO_PRACTICA = Object.freeze({
  'SUB-PSM-01': Object.freeze({
    falla: "Arco interno con rotura de cuba; falla dieléctrica o térmica del aislamiento",
    beneficio: "Detecta en servicio, mediante gases disueltos y propiedades fisicoquímicas, descargas parciales, sobrecalentamientos, degradación de la celulosa y pérdida de rigidez dieléctrica antes de que deriven en arco interno con rotura de cuba.",
    beneficioAmplio: "El seguimiento de gases disueltos y de propiedades fisicoquímicas del aceite permite identificar en servicio, en etapa temprana, descargas parciales, sobrecalentamientos internos, degradación de la celulosa y pérdida de rigidez dieléctrica, y anticipar la intervención antes de que el defecto evolucione a falla dieléctrica o a arco interno con sobrepresión y rotura de cuba. Por sí mismo no reduce el riesgo: habilita la decisión a tiempo."
  }),
  'SUB-PSM-02': Object.freeze({
    falla: "Explosión de buje, falla interna de devanados y colapso mecánico por cortocircuito",
    beneficio: "Detecta deterioro del aislamiento capacitivo de bujes y, en devanados, aumento de pérdidas dieléctricas, espiras en cortocircuito y desplazamiento geométrico: anticipa explosión de buje, falla interna o colapso mecánico ante cortocircuito.",
    beneficioAmplio: "Los ensayos, calificados de forma independiente, exponen lo que el análisis del aceite no mide de forma directa: el deterioro del aislamiento capacitivo de los bujes, el aumento de pérdidas dieléctricas en los devanados, las espiras en cortocircuito, las conexiones internas de alta resistencia y el desplazamiento geométrico de los devanados. Con esa evidencia, la intervención puede decidirse antes de que el defecto derive en explosión de buje, falla interna o colapso mecánico ante el siguiente cortocircuito. El ensayo declara la condición; no la modifica."
  }),
  'SUB-PSM-03': Object.freeze({
    falla: "Falla dieléctrica por humedad o bajo nivel de aceite; flameo externo de aisladores",
    beneficio: "Detecta entre ensayos pérdida de hermeticidad, deshidratante saturado y aisladores contaminados antes de que deriven en ruptura dieléctrica interna por humedad o bajo nivel de aceite, o en flameo externo.",
    beneficioAmplio: "La inspección detallada, con registro fechado de hallazgos, detecta entre ensayos fugas, corrosión, saturación del deshidratante, pérdida de hermeticidad y contaminación de aisladores, y da tiempo para corregirlas antes de que el ingreso de humedad o la pérdida de nivel de aceite comprometan la rigidez dieléctrica interna, o de que la contaminación derive en flameo externo. La inspección documenta; la corrección se ejecuta como actividad propia."
  }),
  'SUB-PSM-04': Object.freeze({
    falla: "Falla de buje por conexión sobrecalentada; falla térmica del aislamiento",
    beneficio: "Localiza sobrecalentamientos en bornes por resistencia de contacto elevada y pérdida de disipación en la refrigeración: anticipa falla de buje o falla térmica del aislamiento por mayor temperatura del punto caliente.",
    beneficioAmplio: "La termografía localiza, en la parte accesible del activo, los puntos calientes de bornes y conexiones originados en resistencia de contacto elevada y el patrón térmico irregular con que la refrigeración delata pérdida de disipación, y señala dónde intervenir antes de que el calor degrade el buje hasta su falla o de que la menor disipación eleve la temperatura del punto más caliente del devanado y acelere el envejecimiento del papel. No corrige lo que localiza ni devuelve la vida consumida."
  }),
  'SUB-PSM-05': Object.freeze({
    falla: "Falla dieléctrica por sobretensión no limitada al degradarse la trayectoria a tierra",
    beneficio: "Califica la resistencia de puesta a tierra y la continuidad de derivaciones de cuba, neutro y descargadores antes de que una sobretensión atmosférica no limitada provoque ruptura dieléctrica en devanados o bujes.",
    beneficioAmplio: "Con la resistencia de puesta a tierra medida y la continuidad de las derivaciones de cuba, neutro y descargadores verificada, el diagnóstico expone la degradación de la trayectoria de la que dependen la limitación de sobretensiones, la evacuación de la corriente de falla y las tensiones de paso y contacto. Su reposición, que se ejecuta como trabajo aparte, puede entonces programarse antes de que una descarga atmosférica encuentre deficiente esa trayectoria y la sobretensión no limitada alcance el aislamiento de devanados y bujes."
  }),
  'SUB-C2-01': Object.freeze({
    falla: "Falla térmica del aislamiento y falla de buje por punto caliente",
    beneficio: "Localiza y jerarquiza bajo carga puntos calientes en conexiones y bujes, contrastados con la fase homóloga, y pérdida de disipación en radiadores: anticipa falla de buje o falla térmica del aislamiento.",
    beneficioAmplio: "Con el margen térmico estrechado propio de su condición, la termografía más frecuente bajo carga localiza y jerarquiza con antelación los puntos calientes en conexiones, bujes y radiadores, y permite anticipar su corrección antes de que el sobrecalentamiento degrade un buje hasta su falla o la pérdida de disipación acelere el envejecimiento del papel hacia su falla térmica. No corrige lo que localiza ni recupera la vida de aislamiento consumida."
  }),
  'SUB-C2-02': Object.freeze({
    falla: "Falla térmica del aislamiento por pérdida oculta de capacidad de disipación",
    beneficio: "Detecta etapas de refrigeración que no arrancan, bombas sin caudal y radiadores obstruidos antes de que la pérdida de disipación eleve la temperatura del punto caliente hasta la falla térmica del aislamiento.",
    beneficioAmplio: "La prueba de cada etapa de refrigeración en arranque automático y manual expone la pérdida de disipación oculta en operación normal, como etapas que no arrancan, bombas sin caudal o radiadores obstruidos, y permite escalar su corrección antes de que el punto más caliente del devanado supere su límite admisible y acelere la degradación del papel hacia la falla térmica del aislamiento. No devuelve la vida que el aislamiento consumió mientras la refrigeración operó degradada."
  }),
  'SUB-C2-03': Object.freeze({
    falla: "Falla térmica del aislamiento por sobretemperatura sin alarma ni disparo",
    beneficio: "Detecta la deriva de calibración de termómetros de aceite e imagen térmica, que gobiernan refrigeración, alarma y disparo, antes de que una sobretemperatura inadvertida lleve el aislamiento a falla térmica.",
    beneficioAmplio: "El contraste de los termómetros de aceite y de imagen térmica contra patrón, con los ajustes de arranque, alarma y disparo y la señal remota verificados, comprueba si la refrigeración escalonada y la protección por sobretemperatura responden a la temperatura real, y permite corregir la deriva antes de que una sobretemperatura no detectada lleve el aislamiento a falla térmica sin actuación de la protección. No revierte el envejecimiento acumulado mientras la instrumentación desviada ocultaba la sobretemperatura."
  }),
  'SUB-C2-04': Object.freeze({
    falla: "Falla dieléctrica por humedad o bajo nivel de aceite; flameo externo de bujes",
    beneficio: "Detecta con periodicidad reforzada fugas, caída de nivel de aceite, deshidratante saturado y bujes contaminados antes de que deriven en ruptura dieléctrica interna por humedad o bajo nivel, o en flameo externo.",
    beneficioAmplio: "Con periodicidad reforzada, la inspección visual acorta el tiempo entre la aparición y la detección de fugas, caída de nivel de aceite, deshidratante saturado y contaminación de bujes, y escala el hallazgo a corrección antes de que la humedad o la pérdida de nivel comprometan la rigidez dieléctrica interna, o la contaminación derive en flameo externo. No corrige lo que encuentra ni deshace el deterioro producido."
  }),
  'SUB-C2-05': Object.freeze({
    falla: "Falla interna de devanados y bujes; explosión de buje",
    beneficio: "Califica prueba por prueba, sobre un activo en deterioro, la evolución del aislamiento de devanados y bujes y la integridad de conexiones internas: anticipa falla interna de devanados o explosión de buje.",
    beneficioAmplio: "Sobre un activo en deterioro, la medición del estado dieléctrico de devanados y bujes y de la integridad de circuitos y conexiones internas, calificada prueba por prueba, sigue la evolución que la inspección y la termografía no ven y sustenta la intervención antes de que el defecto progrese a falla interna o a explosión de buje. El ensayo mide; no restituye el aislamiento sólido degradado."
  }),
  'SUB-C2-06': Object.freeze({
    falla: "Falla dieléctrica de devanados o bujes por sobretensión no limitada",
    beneficio: "Califica, por corriente de fuga y continuidad a tierra, la capacidad del descargador de limitar sobretensiones atmosféricas y de maniobra antes de que su degradación exponga devanados y bujes a ruptura dieléctrica.",
    beneficioAmplio: "La verificación de la corriente de fuga, el aislamiento externo, el contador de descargas y la conexión a tierra del descargador califica su condición para limitar las sobretensiones atmosféricas y de maniobra, y escala su reemplazo cuando la evaluación lo condena, antes de que un descargador degradado deje el aislamiento de devanados y bujes expuesto a falla dieléctrica. No repara el aislamiento ya afectado por sobretensiones previas."
  }),
  'SUB-C3-01': Object.freeze({
    falla: "Falla dieléctrica interna por humedad o bajo nivel; incendio agravado por aceite derramado",
    beneficio: "Restituye hermeticidad y nivel de aceite: reduce la probabilidad de ruptura dieléctrica interna por humedad o bajo nivel y contiene el derrame que agravaría un incendio, sin deshidratar el aislamiento sólido.",
    beneficioAmplio: "Al restituir la hermeticidad y reponer el nivel, sella la vía de ingreso de humedad y oxígeno, que merman la rigidez dieléctrica del aceite y aceleran el envejecimiento del papel, y corrige el bajo nivel que dejaría descubierta la parte activa. Reduce así la probabilidad de falla dieléctrica interna y detiene la acumulación de aceite derramado que agravaría un incendio, sin extraer la humedad ya absorbida por el papel."
  }),
  'SUB-C3-02': Object.freeze({
    falla: "Arco interno con sobrepresión y rotura de cuba; defecto en evolución sin señal",
    beneficio: "Rehabilita el relé Buchholz, con alarma por gases y disparo, y el dispositivo de alivio de presión: acota el escalamiento de fallas incipientes a arco interno con sobrepresión y rotura de cuba.",
    beneficioAmplio: "Recompone la defensa del activo: el relé Buchholz recupera la alarma por gases de falla incipiente, que permite retirar la unidad antes de que el defecto escale a arco con rotura de cuba, y el disparo que acorta ese arco; el dispositivo de alivio descarga la sobrepresión de fallas de menor energía. Los indicadores devuelven la vigilancia de nivel y temperatura, y el respirador, la barrera contra la humedad."
  }),
  'SUB-C3-03': Object.freeze({
    falla: "Defecto interno no despejado hasta rotura de cuba; falla térmica por enfriamiento inactivo",
    beneficio: "Recompone la cadena de disparo de protecciones propias y el arranque del enfriamiento forzado: acota el escalamiento de un defecto interno a rotura de cuba y reduce la probabilidad de falla térmica.",
    beneficioAmplio: "Con la cadena de disparo de las protecciones propias del transformador probada punto a punto, disminuye la probabilidad de que un defecto interno se prolongue sin despeje hasta derivar en rotura de cuba o incendio. El arranque verificado del enfriamiento forzado y la señal de temperatura al telecontrol reducen, además, la exposición del aislamiento a sobrecalentamiento bajo carga, sin modificar la condición que ya tiene."
  }),
  'SUB-C3-04': Object.freeze({
    falla: "Descarga disruptiva en el aceite con arco interno por humedad",
    beneficio: "Extrae por termovacío el agua disuelta y restituye la rigidez dieléctrica del aceite: reduce la probabilidad de descarga disruptiva con arco interno mientras no reingrese humedad ni migre desde el aislamiento sólido.",
    beneficioAmplio: "Devueltos el contenido de agua y la rigidez dieléctrica del aceite a criterio de servicio, el medio que aísla devanados y conexiones recupera su margen dieléctrico y se reduce la probabilidad de descarga disruptiva con arco interno. El beneficio se sostiene solo si se corrige el ingreso de humedad y se atiende el agua retenida en el papel, que migra de nuevo al aceite."
  }),
  'SUB-C3-05': Object.freeze({
    falla: "Falla del cambiador de tomas: conmutación incompleta, arco con sobrepresión y contactos sobrecalentados",
    beneficio: "Anticipa conmutación incompleta, recalentamiento de resistencias de transición y arco con sobrepresión; en OILTAP retira carbón del aceite, en VACUTAP detecta pérdida de vacío y en NLTC reduce la resistencia de contacto.",
    beneficioAmplio: "La verificación de la secuencia de maniobra y de la resistencia dinámica de contactos anticipa el desgaste y la desincronización que conducen a conmutación incompleta, recalentamiento de las resistencias de transición y arco con sobrepresión en el compartimiento del conmutador bajo carga. En los OILTAP, la atención del aceite y del filtro retira el carbón que merma su rigidez dieléctrica; en los VACUTAP, la comprobación de las ampollas anticipa la pérdida de vacío; en el NLTC, el ciclado de posiciones desprende la película de óxido que eleva la resistencia de contacto y calienta los contactos. El desgaste acumulado de contactos y ampollas solo se corrige con despiece."
  }),
  'SUB-C3-06': Object.freeze({
    falla: "Falla térmica del aislamiento por lodos y envejecimiento acelerado del papel",
    beneficio: "Retira ácidos y productos de oxidación, precursores de lodos que elevan el punto caliente: reduce la probabilidad de falla térmica y contiene la hidrólisis del papel, sin restituir su grado de polimerización.",
    beneficioAmplio: "Al retirar del aceite los ácidos y productos de oxidación e inhibirlo de nuevo, limita la formación de lodos que obstruyen los canales de refrigeración y elevan el punto más caliente, y frena la hidrólisis de la celulosa que esos compuestos catalizan. Reduce así la probabilidad de falla térmica del aislamiento y contiene su envejecimiento, sin devolver el grado de polimerización ya consumido."
  }),
  'SUB-C3-07': Object.freeze({
    falla: "Falla dieléctrica del devanado por humedad y formación de burbujas",
    beneficio: "Deshumidifica el aislamiento sólido: reduce la probabilidad de falla dieléctrica del devanado, incluida la originada por burbujas de vapor en sobrecarga, y contiene la hidrólisis sin restituir el grado de polimerización.",
    beneficioAmplio: "La extracción de la humedad retenida en el aislamiento sólido recupera margen dieléctrico del devanado y reduce la probabilidad de falla dieléctrica, incluida la originada por las burbujas de vapor que desprende el papel húmedo cuando el punto más caliente se eleva en sobrecarga. Con menos agua que sostenga la hidrólisis, el envejecimiento de la celulosa se contiene; el grado de polimerización ya consumido no se recupera."
  }),
  'SUB-C3-M1': Object.freeze({
    falla: "Falla térmica del aislamiento por sobretemperatura del punto más caliente",
    beneficio: "Reactiva etapas de refrigeración, despeja radiadores y ajusta consignas de arranque: a igual carga reduce la temperatura del punto caliente y la probabilidad de falla térmica, sin restituir vida al papel.",
    beneficioAmplio: "Al restituir las etapas de refrigeración, despejar los radiadores y ajustar las consignas de arranque, hace descender la temperatura del aceite superior y del punto más caliente para la misma carga, lo que reduce la probabilidad de falla térmica del aislamiento y de formación de burbujas en sobrecarga. Contiene el ritmo de envejecimiento térmico del papel, sin restituir la vida ya consumida."
  }),
  'SUB-C3-M2': Object.freeze({
    falla: "Falla térmica del aislamiento por demanda que excede la disipación instalada",
    beneficio: "Añade superficie de disipación y una etapa de refrigeración: amplía el margen térmico del punto caliente y reduce la probabilidad de falla térmica ante demanda creciente, sin elevar la potencia nominal.",
    beneficioAmplio: "La mayor superficie de disipación y la etapa adicional de refrigeración amplían el margen térmico ante la demanda creciente: para la misma carga descienden la temperatura del aceite superior y la del punto más caliente, y se reduce la probabilidad de falla térmica del aislamiento cuando la unidad opera cerca de su límite de carga. Aumenta la disipación, no la potencia nominal; no corrige defectos internos ni restituye vida al papel."
  }),
  'SUB-C4-01': Object.freeze({
    falla: "Falla dieléctrica por aceite degradado y falla térmica por lodos en los canales",
    beneficio: "Retira ácidos que aceleran la hidrólisis del papel y arrastra lodos de los canales de refrigeración: restituye la rigidez dieléctrica del aceite y reduce la probabilidad de arco interno y falla térmica.",
    beneficioAmplio: "La regeneración retira del aceite los ácidos y demás productos de oxidación, que aceleran la hidrólisis del papel, y arrastra los lodos depositados sobre la parte activa; restituye así la rigidez dieléctrica del fluido y alivia la obstrucción de los canales de refrigeración. Reduce con ello la probabilidad de una falla dieléctrica que derive en arco interno y la de una falla térmica por sobrecalentamiento localizado, y contiene el avance del envejecimiento sin restituir el grado de polimerización perdido."
  }),
  'SUB-C4-02': Object.freeze({
    falla: "Falla dieléctrica del devanado por humedad, precipitada en sobrecarga por formación de burbujas",
    beneficio: "Extrae humedad del aislamiento sólido: recupera rigidez dieléctrica y margen de sobrecarga, contiene la hidrólisis de la celulosa y reduce la probabilidad de ruptura dieléctrica del devanado, incluso por burbujas de vapor.",
    beneficioAmplio: "Al llevar la humedad del aislamiento sólido al rango de operación, el secado recupera la rigidez dieléctrica del conjunto y el margen de sobrecarga que la humedad había restado; reduce así la probabilidad de falla dieléctrica del devanado y de la formación de burbujas que, en sobrecarga, puede desencadenarla, y frena la hidrólisis de la celulosa sin recuperar el grado de polimerización ni la resistencia mecánica perdidos."
  }),
  'SUB-C4-03': Object.freeze({
    falla: "Perforación de cuba o radiador por corrosión, con fuga de aceite e ingreso de humedad",
    beneficio: "Restituye el recubrimiento en las zonas intervenidas: contiene la corrosión salina y reduce la probabilidad de perforación de cuba o radiador, con fuga de aceite e ingreso de humedad al sistema aislante.",
    beneficioAmplio: "La pintura parcial, aplicada sobre superficie preparada, contiene la corrosión propia del ambiente costero salino en las zonas intervenidas y reduce la probabilidad de que evolucione a perforación de cuba o radiador, con fuga de aceite, ingreso de humedad al sistema aislante y pérdida de capacidad de disipación. No repone el espesor de pared ya perdido ni sustituye la reparación de un punto ya perforado."
  }),
  'SUB-C4-04': Object.freeze({
    falla: "Falla del cambiador de tomas: arco sostenido en el ruptor con rotura del compartimiento",
    beneficio: "Verifica o repone contactos y aceite del ruptor en OILTAP, ampollas de vacío en VACUTAP y, en ambos, resistencias de transición: reduce la probabilidad de arco sostenido, sobrepresión y rotura del compartimiento.",
    beneficioAmplio: "El despiece corrige el desgaste acumulado que degrada la conmutación: verifica o repone, en los OILTAP, los contactos principales y de arco, las resistencias de transición y el aceite del compartimiento del ruptor, y en los VACUTAP, las ampollas de vacío y las resistencias de transición, con el mando mecánico en ambos casos. Reduce de este modo la probabilidad de una transición incompleta o de un arco sostenido capaz de sobrepresionar el compartimiento del conmutador hasta su rotura e incendio; no interviene el devanado de regulación ni el aislamiento de la parte activa."
  }),
  'SUB-C4-05': Object.freeze({
    falla: "Defecto interno no localizado que evoluciona a arco con rotura de cuba",
    beneficio: "Localiza en núcleo, devanados o estructura de sujeción el defecto que acreditan gases disueltos o descargas parciales y orienta su corrección antes de que evolucione a arco interno con rotura de cuba.",
    beneficioAmplio: "Por sí sola, la inspección no reduce el riesgo: localiza o acota el defecto interno que los gases disueltos o las descargas parciales acreditan y documenta el apriete, las conexiones internas y los canales de refrigeración, de modo que el correctivo se dirija al origen antes de que el defecto evolucione a arco interno con rotura de cuba o a colapso mecánico del devanado ante un cortocircuito."
  }),
  'SUB-C4-06': Object.freeze({
    falla: "Ruptura dieléctrica del buje con explosión, incendio y propagación a la cuba",
    beneficio: "Sustituye el buje con factor de potencia y capacitancia desviados de placa e histórico, fuga o porcelana dañada: reduce la probabilidad de ruptura dieléctrica con explosión, incendio y propagación a la cuba.",
    beneficioAmplio: "El reemplazo del buje cuyo factor de potencia y capacitancia se apartan de su valor de placa y de su histórico, o que presenta fuga, contaminación o daño de porcelana no corregibles en campo, retira de servicio un aislamiento degradado y reduce la probabilidad de ruptura dieléctrica en esa posición, que puede terminar en explosión del buje, incendio y propagación a la cuba. No modifica el devanado ni el aislamiento principal."
  }),
  'SUB-C4-07': Object.freeze({
    falla: "Escalamiento de falla interna sin disparo oportuno y falla térmica por refrigeración inoperante",
    beneficio: "Restituye protecciones mecánicas, etapas de refrigeración y hermeticidad: acota con disparo oportuno la severidad de una falla interna, reduce la probabilidad de falla térmica y contiene el ingreso de humedad.",
    beneficioAmplio: "Al devolver a servicio protecciones mecánicas probadas en alarma y disparo, instrumentación calibrada, etapas de refrigeración operando y hermeticidad restituida, la intervención recompone las salvaguardas del activo: acota la severidad de una falla interna al restituir la alarma y el disparo oportunos, reduce la probabilidad de falla térmica por refrigeración insuficiente y detiene el ingreso de humedad por los puntos reparados; no modifica la condición del aceite ni del aislamiento."
  }),
  'SUB-C4-08': Object.freeze({
    falla: "Falla térmica y dieléctrica del devanado por punto caliente sostenido en sobrecarga",
    beneficio: "Fija límites de carga y vigila la temperatura del punto caliente: mientras se cumplan, contiene la tasa de envejecimiento térmico y reduce la probabilidad de falla térmica o dieléctrica del devanado.",
    beneficioAmplio: "Aplicado en la operación, el plan somete la exigencia térmica a límites de carga, criterios de sobrecarga de emergencia, seguimiento del punto más caliente y maniobras de transferencia definidas para la contingencia; reduce así la probabilidad de que una sobrecarga no controlada lleve el devanado a falla térmica o dieléctrica y contiene el ritmo de envejecimiento mientras se cumpla, sin aumentar la capacidad instalada ni recuperar la vida consumida."
  }),
  'SUB-C4-M2': Object.freeze({
    falla: "Falla de un activo degradado bajo exigencia térmica elevada en nodo crítico",
    beneficio: "Reubica el activo degradado, verificada su compatibilidad eléctrica, en un nodo de menor exigencia térmica y criticidad: reduce la probabilidad de falla térmica y acota su consecuencia, sin mejorar su condición interna.",
    beneficioAmplio: "Al trasladar el activo degradado a un nodo de menor exigencia térmica y criticidad, previa verificación, antes de energizar, de su condición y de su compatibilidad eléctrica con el destino, incluido el nivel de cortocircuito del nodo, el movimiento reduce el esfuerzo térmico que acelera su deterioro y la probabilidad de falla térmica, y acota la consecuencia de una eventual falla al confiar la demanda crítica a una unidad con margen; no mejora su condición interna."
  }),
  'SUB-C5-01': Object.freeze({
    falla: "Perforación por corrosión de cuba, radiadores o tuberías con fuga de aceite",
    beneficio: "Restituye el recubrimiento: contiene la corrosión salina, preserva el espesor de pared remanente y reduce la probabilidad de perforación de cuba, radiadores o tuberías, con fuga de aceite e ingreso de humedad.",
    beneficioAmplio: "La pintura total trata los focos de óxido y restituye el recubrimiento completo sobre superficie preparada: contiene la corrosión propia del ambiente costero salino y preserva el espesor de pared remanente, con lo que reduce la probabilidad de perforación de cuba, radiadores o tuberías y de la consiguiente fuga de aceite e ingreso de humedad al sistema aislante. No interviene el aislamiento interno ni recupera el acero ya perdido."
  }),
  'SUB-C5-02': Object.freeze({
    falla: "Rotura de cuba e incendio por falla interna sin disparo ni alivio oportunos",
    beneficio: "Repone relé Buchholz, dispositivo de alivio de presión e imagen térmica con disparo verificado: sin reducir la probabilidad de arco interno, acorta su duración y acota su escalamiento a rotura de cuba.",
    beneficioAmplio: "Con relé Buchholz, dispositivo de alivio de presión, imagen térmica e indicadores repuestos por dispositivos vigentes y la cadena de protección del tablero probada punto a punto en alarma y disparo, el retrofit no reduce la probabilidad de una falla interna, pero acota su consecuencia: restituye la desconexión oportuna, que acorta la duración del arco, y el alivio de la sobrepresión de las fallas de menor energía, con lo que limita la posibilidad de que el arco escale a rotura de cuba e incendio."
  }),
  'SUB-C5-03': Object.freeze({
    falla: "Falla dieléctrica y térmica del aislamiento por aceite oxidado y papel húmedo",
    beneficio: "Retira ácidos del aceite y humedad del papel: devuelve margen dieléctrico, reduce la probabilidad de arco interno y contiene la hidrólisis y oxidación de la celulosa, sin recuperar el grado de polimerización.",
    beneficioAmplio: "Al regenerar el aceite y reducir en pasadas sucesivas la humedad del aislamiento sólido, el tratamiento retira del fluido los productos de oxidación, restituye su rigidez dieléctrica y devuelve margen dieléctrico al papel, con lo que reduce la probabilidad de una falla dieléctrica o térmica que derive en arco interno y contiene el avance de la hidrólisis y la oxidación de la celulosa, sin restituir el grado de polimerización consumido."
  })
});

/** Catálogo: código → macroactividad y nombre, en el orden del MO.00418. */
const CATALOGO = (() => {
  const m = {};
  let orden = 0;
  for (const g of macroactividadesCatalogo()) {
    for (const s of g.subs || []) {
      m[s.codigo] = { macro: g.nombre, condicion: g.condicion, nombre: s.nombre, orden: orden++ };
    }
  }
  return Object.freeze(m);
})();

/**
 * Código del catálogo de una acción escogida. La acción viene del selector con
 * su nombre (no siempre con código). Un nombre que existe en dos condiciones
 * («Pruebas eléctricas» en C1 y en C2) se resuelve por la condición del equipo.
 */
export function codigoDePractica(accion, condicion) {
  const a = accion || {};
  if (a.codigo && CATALOGO[a.codigo]) return a.codigo;
  const n = normalizarAccion(a.txt || a.nombre);
  if (!n) return null;
  const cands = Object.keys(CATALOGO).filter((c) => normalizarAccion(CATALOGO[c].nombre) === n);
  if (!cands.length) return null;
  return cands.find((c) => CATALOGO[c].condicion === condicion) || cands[0];
}

function mvaTxt(mva) {
  const r = Math.round(Number(mva) * 100) / 100;
  if (!Number.isFinite(r)) return null;
  return String(r).replace('.', ',');
}

/**
 * Texto de beneficios a partir de las prácticas escogidas.
 *
 * @param {object} equipo     equipo normalizado (usa matrícula/serie, potencia —
 *                            `mvaProyecto` si viene—, subestación y condición)
 * @param {object} _diag      (no se usa; firma común de las redacciones automáticas)
 * @param {Array<{txt:string, codigo?:string}>} escogidas  prácticas marcadas
 * @returns {string}
 */
export function redaccionBeneficiosPracticas(equipo, _diag, escogidas) {
  const f = equipo || {};
  const mvaN = f.mvaProyecto != null ? f.mvaProyecto
    : (f.mva != null ? f.mva : (f.potencia_kva != null ? Number(f.potencia_kva) / 1000 : null));
  const mva = mvaN != null ? mvaTxt(mvaN) : null;
  const apertura = APERTURA_BENEFICIOS
    .replace(/\{MATRICULA\}/g, () => f.matricula || f.serie || '[PENDIENTE: MATRÍCULA]')
    .replace(/\{MVA\}/g, () => mva || '[PENDIENTE: POTENCIA]')
    .replace(/\{SUB\}/g, () => f.subestacion || '[PENDIENTE: SUBESTACIÓN]');

  // Sin prácticas escogidas NO sale nada —ni apertura, ni cierre, ni aviso—:
  // «aquí no debe reposar nada hasta que yo seleccione las acciones de
  // mantenimiento» (orden del Ingeniero, 2026-09-25, `99 §96`).
  const lista = Array.isArray(escogidas) ? escogidas : [];
  if (!lista.length) return '';

  // Un renglón por práctica, en el orden del MO.00418 y SIN subtítulos de
  // macroactividad: «no es necesario los subtítulos, simplemente me interesa
  // que se aprecien los beneficios teniendo en cuenta cada acción» (orden del
  // Ingeniero, 2026-09-25, `99 §97`).
  const renglones = [];
  const sinBeneficio = [];
  const yaSalio = new Set();
  for (const a of lista) {
    const cod = codigoDePractica(a, f.cond_int);
    const b = cod ? BENEFICIO_PRACTICA[cod] : null;
    const nombre = String(a.txt || a.nombre || (cod && CATALOGO[cod].nombre) || '').trim();
    if (!b) { if (nombre) sinBeneficio.push(nombre); continue; }
    if (yaSalio.has(cod)) continue;
    yaSalio.add(cod);
    // El nombre de la práctica se separa con raya: muchos beneficios ya llevan
    // su propio «acción: efecto», y dos «:» en un renglón se leían mal (`§95`).
    renglones.push({ orden: CATALOGO[cod].orden, t: '· ' + nombre + ' — ' + b.beneficio });
  }
  const lineas = renglones.sort((x, y) => x.orden - y.orden).map((r) => r.t)
    // Una acción sin beneficio catalogado NO se inventa: va al final, [PENDIENTE].
    .concat(sinBeneficio.map((n) => '· ' + n
      + ' — [PENDIENTE: beneficio de esta acción; no está en el catálogo, redáctelo a mano.]'));
  return [apertura, lineas.join('\n'), CIERRE_BENEFICIOS].join('\n\n');
}
