// ═════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Condiciones de deterioro del transformador
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// El alcance nombraba el hallazgo que gobierna la intervención («degradación
// del aceite dieléctrico: …»), pero no DEFINÍA la condición, ni decía qué
// riesgo supone para el equipo, ni cómo puede afectar al cliente. Encargo del
// Ingeniero (2026-09-10) con su propia redacción.
//
// EL TEXTO ES SUYO, LITERAL. No se parafrasea ni se «mejora»: es la definición
// que él sostiene ante el regulador. Si hay que cambiarla, la cambia él.
//
// REGLA QUE LO GOBIERNA (decisión suya, 2026-09-10): en el alcance aparecen
// SOLO las condiciones que el activo PRESENTA según sus valores medidos. Nunca
// las cinco por defecto: afirmar una condición que el equipo no tiene sería
// fabricar el hallazgo, y este documento se firma.
//
// Funciones PURAS: cero DOM, cero Firebase, cero I/O.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Las cinco condiciones, con los modos de degradación del motor que las
 * declaran. `modos: []` significa que HOY no hay señal automática que la
 * detecte: la condición existe en el catálogo, pero el sistema no la afirma
 * sola (ver «sistema de refrigeración deficiente»).
 */
export const CONDICIONES_DETERIORO = Object.freeze({
  fugas: Object.freeze({
    condicion: 'Fugas en transformadores de potencia',
    definicion: 'Pérdida de aceite dieléctrico por fallas en juntas, sellos, radiadores, válvulas o el '
      + 'tanque del transformador.',
    riesgoEquipo: 'Reduce el nivel de aislamiento y la capacidad de refrigeración; puede permitir el '
      + 'ingreso de humedad y provocar descargas internas, sobrecalentamiento o incendio.',
    afectacionClientes: 'Salidas no programadas, interrupciones del suministro, variaciones de tensión '
      + 'y mayores tiempos de reposición del servicio.',
    modos: Object.freeze(['hermeticidad'])
  }),
  refrigeracion: Object.freeze({
    condicion: 'Sistema de refrigeración deficiente',
    definicion: 'Incapacidad del sistema de radiadores, ventiladores, bombas o intercambiadores para '
      + 'disipar adecuadamente el calor generado durante la operación.',
    riesgoEquipo: 'Incremento de la temperatura del aceite y de los devanados, aceleración del '
      + 'envejecimiento del aislamiento, reducción de la capacidad de carga y posible falla térmica.',
    afectacionClientes: 'Limitaciones operativas, desconexiones por protecciones térmicas y cortes de '
      + 'energía, especialmente durante períodos de alta demanda.',
    // SIN DETECTOR: el registro guarda el TIPO de refrigeración y las cantidades
    // (ONAN/ONAF, radiadores, ventiladores, bombas), no su estado. No se cuelga
    // del modo `termico`, que el motor dispara por etileno —falla térmica
    // INTERNA— y es otra cosa. Queda en el catálogo esperando su señal.
    modos: Object.freeze([])
  }),
  aceite: Object.freeze({
    condicion: 'Calidad del aceite desfavorable',
    definicion: 'Deterioro de las propiedades dieléctricas, químicas o físicas del aceite, reflejado en '
      + 'humedad, baja rigidez dieléctrica, acidez, lodos o contaminación.',
    riesgoEquipo: 'Disminuye la capacidad de aislamiento y refrigeración; favorece descargas parciales, '
      + 'corrosión y degradación acelerada del papel aislante.',
    afectacionClientes: 'Mayor probabilidad de fallas intempestivas, interrupciones prolongadas y '
      + 'reducción de la confiabilidad del suministro.',
    modos: Object.freeze(['aceite'])
  }),
  gases: Object.freeze({
    condicion: 'Presencia de gases combustibles',
    definicion: 'Existencia de gases como hidrógeno, metano, etano, etileno, acetileno o monóxido de '
      + 'carbono disueltos en el aceite, normalmente asociados a fallas térmicas o eléctricas internas.',
    riesgoEquipo: 'Es un indicio de descargas parciales, arcos eléctricos, sobrecalentamiento o '
      + 'degradación del aislamiento. Concentraciones elevadas pueden anticipar una falla catastrófica, '
      + 'explosión o incendio.',
    afectacionClientes: 'Riesgo de pérdida súbita del transformador, afectación de la continuidad del '
      + 'servicio, daños a instalaciones cercanas y posibles riesgos para la seguridad de las personas.',
    modos: Object.freeze(['arco', 'descargas', 'termico'])
  }),
  papel: Object.freeze({
    condicion: 'Papel aislante con alto nivel de degradación',
    definicion: 'Envejecimiento avanzado del aislamiento celulósico de los devanados, generalmente '
      + 'causado por temperatura, humedad, oxígeno y esfuerzos eléctricos; suele evidenciarse mediante '
      + 'un bajo grado de polimerización.',
    riesgoEquipo: 'Reduce la resistencia mecánica y dieléctrica del aislamiento. El transformador se '
      + 'vuelve más vulnerable a cortocircuitos, esfuerzos electromecánicos y fallas irreversibles.',
    afectacionClientes: 'Aumenta la probabilidad de indisponibilidad prolongada, reemplazo del '
      + 'transformador y cortes extensos que pueden afectar a un número importante de clientes.',
    modos: Object.freeze(['papel'])
  })
});

/** Cierre del Ingeniero, literal. Solo se escribe si hay alguna condición. */
export const CIERRE_CONDICIONES =
  'En conjunto, estas condiciones representan señales de deterioro del estado operativo del '
  + 'transformador. Su presencia individual o combinada incrementa la probabilidad de una falla parcial '
  + 'o catastrófica, disminuye la confiabilidad del sistema eléctrico y puede generar interrupciones del '
  + 'suministro, restricciones de carga, daños a otros equipos y afectación directa a la continuidad del '
  + 'servicio de los clientes asociados.';

/** Índice inverso: modo del motor → clave de condición. */
const POR_MODO = Object.freeze(Object.entries(CONDICIONES_DETERIORO)
  .reduce((m, [clave, c]) => { c.modos.forEach((k) => { m[k] = clave; }); return m; }, {}));

/**
 * Las condiciones que el activo PRESENTA, en el orden de severidad con que el
 * motor las declaró. Sin duplicados: dos modos distintos pueden apuntar a la
 * misma condición (acetileno y etileno son ambos «gases combustibles»).
 *
 * @param {{todos?:Array<{k:string}>}|null} md salida de `modoDegradacion`
 * @returns {Array<object>} vacío si el motor no declaró ningún modo
 */
export function condicionesPresentes(md) {
  const modos = md && Array.isArray(md.todos) ? md.todos : [];
  const vistas = new Set();
  const out = [];
  for (const m of modos) {
    const clave = POR_MODO[m && m.k];
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(CONDICIONES_DETERIORO[clave]);
  }
  return out;
}
