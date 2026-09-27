// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Beneficios de las ACCIONES del Ingeniero (Mantenimiento)
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE (`99 §105`)
// Pedido del Ingeniero (2026-09-25): «me gustaría que en beneficios mejor
// aparezcan las siguientes acciones […] al escoger alguno de estos debe
// apreciarse una breve descripción en beneficios, los que incluyen listado como
// protecciones mecánicas y accesorios igual, debe permitirme escoger uno o
// varios e integrar sus beneficios; al tener todos los beneficios seleccionados
// hacer un breve resumen […]». Y: «en beneficios solo debe aparecer lo que hemos
// construido, no toques el alcance».
//
// CÓMO SE PRODUJO EL TEXTO (y por qué se puede firmar)
// Cada renglón lo redactaron 3 agentes con enfoques distintos, lo atacaron 3
// revisores (física, texto firmable, fidelidad y no-solape) y lo cerró un editor;
// el Ingeniero lo aprobó uno a uno, con sus ajustes literales. Crudos y síntesis
// en la bóveda (`2026-09-25/27-beneficio-*`). LOS TEXTOS SON LITERALES: no se
// retocan aquí sin su aprobación.
//
// FORMA
//  · Acción simple: «· Nombre — texto».
//  · Acción con elementos (protecciones, accesorios, cambiador bajo carga):
//    «· Nombre — inicio cláusula; cláusula. cierre», con las cláusulas de los
//    elementos escogidos en el orden del catálogo. El cambiador bajo carga tiene
//    PARIDAD de tecnologías (ruptor en aceite / en vacío): sin tecnología
//    escogida salen las dos.
//  · Texto: apertura (la de `beneficios_practicas.js`, con matrícula, potencia y
//    subestación) + un renglón por acción + el resumen (singular con una acción).
//  · Sin acciones escogidas NO sale nada (`99 §96`).
//
// SELECCIÓN: una lista de TEXTOS (el borrador del navegador solo guarda textos
// y listas de textos): «FUGAS» marca la acción; «PROT:rele_buchholz» marca un
// elemento de la acción «PROT».
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ═════════════════════════════════════════════════════════════════════════════

import { APERTURA_BENEFICIOS } from './beneficios_practicas.js';

/** Las 13 acciones del Ingeniero, en SU orden, con sus textos aprobados. */
export const ACCIONES_BENEFICIO = Object.freeze([
  Object.freeze({ id: "FUGAS", nombre: "Corrección integral de fugas",
    texto: "Recupera y comprueba la hermeticidad del transformador sellando las fugas externas de cuba, tapa, asientos de bujes, accesorios y compartimiento del cambiador: detiene la pérdida de nivel y reduce la probabilidad de arco interno. Contiene el ingreso de humedad y, en diseños sellados, de oxígeno, que acelerarían desmedidamente el envejecimiento del aislamiento sólido por hidrólisis y por oxidación prematura del aceite. Aleja mantenimientos mayores en el mediano plazo, sin extraer la humedad ya absorbida." }),
  Object.freeze({ id: "PROT", nombre: "Actualización de protecciones mecánicas",
    inicio: "Reemplaza o normaliza cada dispositivo obsoleto, dañado o inoperante, lo contrasta o prueba y lo deja operativo en alarma y disparo según su diseño:",
    elementos: Object.freeze([
      Object.freeze({ id: "termometro_devanado", nombre: "Termómetro de temperatura de devanado",
        clausula: "el termómetro de temperatura de devanado estima el punto caliente, gobierna el arranque de la refrigeración y alarma o dispara ante sobretemperatura que degrada desmedidamente el papel" }),
      Object.freeze({ id: "termometro_aceite", nombre: "Termómetro de temperatura de aceite",
        clausula: "el termómetro de temperatura de aceite vigila la temperatura del aceite superior, delata refrigeración deficiente o sobrecarga sostenida y da alarma o disparo de respaldo" }),
      Object.freeze({ id: "indicador_nivel", nombre: "Indicador de nivel",
        clausula: "el indicador de nivel recupera una lectura fiel y alarma por nivel bajo antes de que la pérdida de aceite comprometa el aislamiento interno" }),
      Object.freeze({ id: "valvula_alivio", nombre: "Válvula de alivio de presión",
        clausula: "la válvula de alivio de presión descarga la sobrepresión que podría romper la cuba ante fallas de menor energía, da señal de disparo y se recierra" }),
      Object.freeze({ id: "rele_flujo", nombre: "Relé de flujo",
        clausula: "el relé de flujo del cambiador bajo carga, de ruptor en aceite o en vacío, dispara con la oleada de aceite de una falla en su compartimiento" }),
      Object.freeze({ id: "rele_buchholz", nombre: "Relé Buchholz",
        clausula: "el relé Buchholz alarma por la acumulación de gases de una falla incipiente y dispara ante el flujo brusco de aceite que empuja un arco interno" }),
      Object.freeze({ id: "valvula_retencion", nombre: "Válvula de retención automática",
        clausula: "la válvula de retención automática se cierra ante un flujo excesivo hacia una cuba rota y retiene en el conservador el aceite que alimentaría el derrame o incendio" }),
      Object.freeze({ id: "rele_presion_subita", nombre: "Relé de presión súbita",
        clausula: "el relé de presión súbita dispara por la subida brusca de presión de un arco interno, no por variaciones lentas, y acota el escalamiento del arco" })
    ]),
    cierre: "Recompone así las salvaguardas que acotan la severidad de una falla interna, no la condición del activo: no reduce por sí sola su probabilidad, no mejora el aceite ni el aislamiento ni devuelve vida al papel." }),
  Object.freeze({ id: "REFRIG", nombre: "Actualización y repotenciación del sistema de refrigeración",
    texto: "Restituye y comprueba la disipación forzada actualizando ventiladores y, donde existan, bombas de aceite, con sus motores y circuitos de fuerza, a componentes aptos para ambiente salino. A igual carga reduce la temperatura del punto caliente —cuyo exceso envejece desmedidamente el papel— y, con ella, la probabilidad de falla térmica y de burbujas de vapor en sobrecarga con papel húmedo, sin devolver la vida consumida. Al repotenciar, la etapa forzada incorporada habilita, previa verificación, la capacidad adicional que la placa o el fabricante le asignan." }),
  Object.freeze({ id: "TERMOVACIO", nombre: "Recuperación de aislamientos mediante termovacío del aceite",
    texto: "Depura y comprueba el aislamiento líquido: con calor y vacío desgasifica y deshidrata el aceite, minimizando las partes por millón (ppm) de agua en el medio aislante líquido, y por filtración separa las partículas; así recupera la rigidez dieléctrica del aceite, dándole al transformador confiabilidad dieléctrica durante su operación frente a una descarga disruptiva con arco interno, mientras no reingrese humedad ni migre desde el papel. Del aislamiento sólido solo retira, lenta y parcialmente, humedad superficial, sin secarlo en profundidad; no corrige un aceite oxidado ni devuelve la vida consumida del papel." }),
  Object.freeze({ id: "REGENERACION", nombre: "Recuperación de aislamientos mediante regeneración del aceite",
    texto: "Recupera y comprueba el aceite oxidado, sin reemplazarlo: circulándolo en caliente por tierra adsorbente retira los ácidos, lodos y compuestos polares de la oxidación, bajando la acidez y el factor de disipación y restituyendo la tensión interfacial; reinhibido con aditivo antioxidante, recobra su resistencia a la oxidación mientras se conserve el inhibidor. Así contiene la hidrólisis que esos ácidos catalizan en la celulosa y, al redisolver parte de los lodos de devanados y conductos, reduce la probabilidad de falla térmica del aislamiento por punto caliente. No seca el papel ni devuelve su vida consumida." }),
  Object.freeze({ id: "SECADO", nombre: "Recuperación de aislamientos mediante secado de la parte activa",
    texto: "Recupera y comprueba el aislamiento sólido: con calor y vacío sobre la parte activa extrae en profundidad humedad de papel y cartón, donde se aloja la mayor parte del agua del transformador, reduciendo su contenido de humedad y el factor de disipación de devanados. Así contiene la hidrólisis con que el agua envejece desmedidamente la celulosa y eleva la temperatura de formación de burbujas en sobrecarga, dándole al transformador confiabilidad dieléctrica durante su operación frente a una ruptura del aislamiento sólido del devanado, mientras no reingrese humedad. No devuelve la vida consumida del papel." }),
  Object.freeze({ id: "ACCES", nombre: "Actualización de accesorios",
    inicio: "Reemplaza cada accesorio deteriorado u obsoleto por uno nuevo de iguales valores nominales y lo prueba antes de energizar:",
    elementos: Object.freeze([
      Object.freeze({ id: "radiadores", nombre: "Radiadores",
        clausula: "los radiadores, con recubrimiento apto para ambiente salino y hermeticidad comprobada, reducen la probabilidad de perforación con pérdida de aceite y restituyen la superficie de disipación de diseño, que limita la temperatura del punto caliente" }),
      Object.freeze({ id: "bujes", nombre: "Bujes",
        clausula: "los bujes, con factor de potencia y capacitancia verificados y línea de fuga para contaminación salina, disminuyen la probabilidad de ruptura dieléctrica con explosión, incendio y propagación a la cuba, y de flameo externo" })
    ]),
    cierre: "Renueva así componentes cuya falla compromete la unidad, no la condición del activo: no mejora el aceite ni el aislamiento de la parte activa, no devuelve vida al papel ni amplía la capacidad del transformador." }),
  Object.freeze({ id: "TABLERO", nombre: "Actualización y/o retrofit de tablero de control",
    texto: "Renueva o moderniza borneras, cableado, contactores y selectores del gabinete de control, aptos para ambiente salino, y restituye su hermeticidad y calefacción anticondensación. Comprueba continuidad, aislamiento y llegada de cada alarma y disparo a los relés de protección y la supervisión remota, y el arranque automático de la refrigeración. Reduce la probabilidad de que condensación o corrosión impidan un disparo válido o provoquen uno espurio, con salida forzada innecesaria, dándole al transformador confiabilidad en alarma y disparo durante su operación." }),
  Object.freeze({ id: "OLTC", nombre: "Mantenimiento OLTC",
    inicio: "Revisa el acumulador de resorte y las resistencias de transición del cambiador bajo carga, mide la resistencia dinámica y, por toma, resistencia y relación, y comprueba la hermeticidad de su barrera con la cuba principal:",
    elementos: Object.freeze([
      Object.freeze({ id: "aceite", nombre: "Ruptor en aceite",
        clausula: "en el cambiador de ruptor en aceite, intervenido por maniobras acumuladas o tiempo, verifica o repone los contactos de arco y cambia o trata el aceite carbonizado del compartimiento según rigidez dieléctrica y partes por millón (ppm) de agua" }),
      Object.freeze({ id: "vacio", nombre: "Ruptor en vacío",
        clausula: "en el cambiador de ruptor en vacío, intervenido por maniobras acumuladas o por condición, verifica o repone las ampollas según la integridad de su vacío y el desgaste de sus contactos, y cambia o trata el aceite del compartimiento según su estado" })
    ]),
    cierre: "Reduce así la probabilidad de conmutación incompleta o arco sostenido, con sobrepresión, rotura del compartimiento, incendio o contaminación de la cuba principal, dándole al transformador confiabilidad en la regulación de tensión durante su operación." }),
  Object.freeze({ id: "MANDO", nombre: "Mantenimiento mando motor",
    texto: "Revisa motor, freno, engranajes y enclavamiento de manivela del mando, alinea su transmisión con el cambiador bajo carga y restituye la hermeticidad y calefacción anticondensación de su gabinete. Comprueba que cada orden complete una sola maniobra, que finales de carrera y topes limiten el recorrido y que indicador, transmisor de posición y contador concuerden con cada maniobra. Reduce así la probabilidad de maniobras inconclusas o sin control, sobrepaso de tomas extremas o posición errada, con tensión fuera de rango o daño mecánico, dándole al transformador una regulación de tensión disponible y confiable durante su operación." }),
  Object.freeze({ id: "NIVEL", nombre: "Normalización de nivel de aceite",
    texto: "Restablece, según la temperatura del aceite y con el indicador comprobado, el nivel del conservador y, donde exista, del cambiador, con aceite de aporte compatible, desgasificado y verificado en rigidez dieléctrica y partes por millón (ppm) de agua, inyectado sin arrastrar aire y con purga en relé Buchholz, torretas de bujes y radiadores. Recupera el margen de dilatación térmica y reduce la probabilidad de salida forzada, sin falla interna, por actuación del relé Buchholz ante vaciado del conservador o aire atrapado, dándole al transformador una reserva de aceite confiable durante su operación, mientras conserve su hermeticidad." }),
  Object.freeze({ id: "NLTC", nombre: "Mantenimiento NLTC",
    texto: "Con el transformador desenergizado y aislado, ejercita el cambiador sin carga en ciclos completos para limpiar por frotamiento la película que la inmovilidad forma en sus contactos, y mide, por toma, resistencia de devanado y relación. Según la condición de los contactos fijos y móviles, conforme a los resultados de las pruebas eléctricas, procede al reemplazo de la regleta de conmutación y la volanta y repite las mediciones; devuelve el cambiador a la toma de servicio registrada y verifica indicador, bloqueo de posición y candado o enclavamiento que impide operarlo energizado. Reduce así la probabilidad de punto caliente con degradación desmedida del aislamiento vecino, toma mal asentada o equivocada, arco al energizar o tensión errada para los usuarios, dándole al transformador, con contactos limpios o repuestos, una toma firme y confiable durante su operación." }),
  Object.freeze({ id: "MUESTRAS", nombre: "Toma de muestra de aceite para ADFQ/DGA/PCB",
    texto: "Extrae muestras representativas de la cuba y, donde exista, del cambiador bajo carga, en recipiente hermético sin burbujas. El análisis dieléctrico y fisicoquímico (ADFQ) mide rigidez dieléctrica, partes por millón (ppm) de agua, acidez y tensión interfacial, y estima la humedad del papel; el de gases disueltos (DGA), en su tendencia, delata descargas, sobrecalentamientos y degradación de la celulosa; el de bifenilos policlorados (PCB) define el manejo seguro del aceite. Así habilita la decisión antes de que un defecto incipiente escale a arco interno con rotura de cuba, dándole al transformador un seguimiento confiable de su aislamiento durante su operación." })
]);

/** Resumen final (aprobado 2026-09-27). Con una sola acción, en singular. */
export const RESUMEN_BENEFICIOS = "En conjunto, estas prácticas son necesarias para prevenir el riesgo operativo de falla catastrófica del transformador. De no contar con respaldo, una falla así puede significar una interrupción prolongada del suministro de los usuarios asociados a la instalación, con afectación de los indicadores de calidad del servicio SAIDI y SAIFI y riesgo de alteración del orden público. Ejecutarlas a tiempo favorece la confiabilidad del transformador durante su operación.";
export const RESUMEN_BENEFICIOS_UNA = "Esta práctica es necesaria para prevenir el riesgo operativo de falla catastrófica del transformador. De no contar con respaldo, una falla así puede significar una interrupción prolongada del suministro de los usuarios asociados a la instalación, con afectación de los indicadores de calidad del servicio SAIDI y SAIFI y riesgo de alteración del orden público. Ejecutarla a tiempo favorece la confiabilidad del transformador durante su operación.";

const POR_ID = new Map(ACCIONES_BENEFICIO.map((a) => [a.id, a]));

/** Acción del catálogo por su id, o null. */
export function accionBeneficio(id) {
  return POR_ID.get(String(id || '')) || null;
}

/**
 * Normaliza la selección guardada: solo ids conocidos, sin repetidos, en el
 * orden del catálogo. Devuelve [{ accion, elementos: [ids] }].
 * Una acción con elementos marcada sin ninguno cuenta con TODOS (así la marca
 * la pantalla: marcar la acción marca sus elementos).
 */
export function accionesEscogidas(seleccion) {
  const toks = new Set((Array.isArray(seleccion) ? seleccion : []).map((t) => String(t)));
  const out = [];
  for (const a of ACCIONES_BENEFICIO) {
    const els = a.elementos ? a.elementos.filter((e) => toks.has(a.id + ':' + e.id)).map((e) => e.id) : [];
    if (!toks.has(a.id) && !els.length) continue;
    out.push({ accion: a, elementos: a.elementos ? (els.length ? els : a.elementos.map((e) => e.id)) : [] });
  }
  return out;
}

/** Renglón de una acción escogida: «· Nombre — beneficio». */
export function renglonBeneficio(accion, elementos) {
  const a = accion;
  if (!a) return '';
  if (!a.elementos) return '· ' + a.nombre + ' — ' + a.texto;
  const ids = new Set(elementos && elementos.length ? elementos : a.elementos.map((e) => e.id));
  const clausulas = a.elementos.filter((e) => ids.has(e.id)).map((e) => e.clausula);
  return '· ' + a.nombre + ' — ' + a.inicio + ' ' + clausulas.join('; ') + '. ' + a.cierre;
}

function mvaTxt(mva) {
  const r = Math.round(Number(mva) * 100) / 100;
  if (!Number.isFinite(r)) return null;
  return String(r).replace('.', ',');
}

/**
 * Texto de Beneficios del documento de Mantenimiento con las acciones escogidas.
 * Misma firma que las redacciones automáticas: (equipo, _diag, seleccion).
 * @param {object} equipo  usa matrícula/serie, potencia (`mvaProyecto` si viene) y subestación
 * @param {object} _diag   no se usa
 * @param {string[]} seleccion  lista de textos «ACCION» / «ACCION:elemento»
 * @returns {string} '' si no hay acciones escogidas
 */
export function redaccionBeneficiosAcciones(equipo, _diag, seleccion) {
  const escogidas = accionesEscogidas(seleccion);
  if (!escogidas.length) return '';
  const f = equipo || {};
  const mvaN = f.mvaProyecto != null ? f.mvaProyecto
    : (f.mva != null ? f.mva : (f.potencia_kva != null ? Number(f.potencia_kva) / 1000 : null));
  const mva = mvaN != null ? mvaTxt(mvaN) : null;
  const apertura = APERTURA_BENEFICIOS
    .replace(/\{MATRICULA\}/g, () => f.matricula || f.serie || '[PENDIENTE: MATRÍCULA]')
    .replace(/\{MVA\}/g, () => mva || '[PENDIENTE: POTENCIA]')
    .replace(/\{SUB\}/g, () => f.subestacion || '[PENDIENTE: SUBESTACIÓN]');
  const renglones = escogidas.map((x) => renglonBeneficio(x.accion, x.elementos));
  const resumen = escogidas.length === 1 ? RESUMEN_BENEFICIOS_UNA : RESUMEN_BENEFICIOS;
  return [apertura, renglones.join('\n'), resumen].join('\n\n');
}
