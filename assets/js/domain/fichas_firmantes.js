// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · QUIÉN FIRMA (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// Los firmantes del cuadro de firmas del PE.02081, DICTADOS por el Ingeniero el
// 2026-09-23 (`99 §89`). Se copian LITERALES —mayúsculas y sin tildes, como los
// escribió—: es texto que se firma y la prueba anti-paráfrasis lo vigila.
//
// Cada casilla del formato tiene UNA persona (Aprobación tiene dos casillas).
// Donde el Ingeniero dio varias personas para una sola casilla (Elaboración:
// tres; Revisión: dos) son las que PUEDEN firmarla: la primera es la que va por
// defecto y las demás se eligen en la ficha. Siempre queda «Otra persona», que
// se escribe a mano (un encargo nuevo no debe exigir tocar el código).
//
// Repo público: los NOMBRES van aquí porque el proyecto ya decidió que son
// públicos (`99 §78.3`, igual que Órdenes de Materiales `§76`). Lo que NUNCA
// va en este repo son cédulas ni firmas escaneadas (`§70`, `§78`).
//
// Funciones PURAS: la pantalla y el exportador del Excel resuelven al firmante
// con la MISMA función, para que no digan cosas distintas.
// ══════════════════════════════════════════════════════════════════════════════

/** Casillas del formato, en el orden de la plantilla. */
export const CASILLAS_FIRMA = Object.freeze(['elab', 'rev', 'apr', 'apr2', 'rec']);

/** Quién puede firmar cada casilla. La primera persona es la que va por defecto. */
export const FIRMANTES = Object.freeze({
  elab: Object.freeze([
    Object.freeze({ nombre: 'MIGUEL A. JIMENEZ', ocupacion: 'PROFESIONAL EN TRANSFORMADORES DE POTENCIA' }),
    Object.freeze({ nombre: 'CARLOS MARTELO', ocupacion: 'ANALISTA DE TRANSFORMADORES AT' }),
    Object.freeze({ nombre: 'JORGE RHENALS', ocupacion: 'ANALISTA DE TRANSFORMADORES AT' })
  ]),
  rev: Object.freeze([
    Object.freeze({ nombre: 'JORGE MIRANDA', ocupacion: 'LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT' }),
    Object.freeze({ nombre: 'MIGUEL JIMENEZ', ocupacion: 'PROFESIONAL EN TRANSFORMADORES DE POTENCIA' })
  ]),
  apr: Object.freeze([
    Object.freeze({ nombre: 'JORGE MIRANDA', ocupacion: 'LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT' }),
    Object.freeze({ nombre: 'ERICK VERGARA', ocupacion: 'JEFE OPERATIVA MANTENIMIENTO RED ALTA TENSION (E)' })
  ]),
  apr2: Object.freeze([
    Object.freeze({ nombre: 'ERICK VERGARA', ocupacion: 'JEFE OPERATIVA MANTENIMIENTO RED ALTA TENSION (E)' }),
    Object.freeze({ nombre: 'JORGE MIRANDA', ocupacion: 'LIDER DE PLANIFICACION Y ASEGURAMIENTO MANTENIMIENTO AT' })
  ]),
  rec: Object.freeze([
    Object.freeze({ nombre: 'ERICK VERGARA', ocupacion: 'SUBGERENTE MANTENIMIENTO RED ALTA TENSION' })
  ])
});

/** Valor del desplegable que significa «escribir otra persona a mano». */
export const OTRA_PERSONA = 'otro';

const lleno = (v) => v != null && String(v).trim() !== '';

/**
 * Índice de la persona por defecto de una casilla. Es la primera de su lista,
 * salvo en el SEGUNDO aprobador: no puede repetir a quien ya ocupa el primero
 * (si en el primero quedó ERICK VERGARA —elegido, o de una ficha vieja—, el
 * segundo pasa a JORGE MIRANDA en vez de repetir a Erick; revisión de `§89`).
 */
export function indicePorDefecto(k, plan = {}) {
  const lista = FIRMANTES[k] || [];
  if (!lista.length) return -1;
  if (k === 'apr2') {
    const primero = firmanteDe('apr', plan).nombre;
    const i = lista.findIndex((p) => p.nombre !== primero);
    return i >= 0 ? i : 0;
  }
  return 0;
}

/** ¿La casilla está en «Otra persona»? Explícito (`sel_`) o por un nombre que no está en la lista. */
function esOtra(k, plan, lista) {
  if (plan['sel_' + k] === OTRA_PERSONA) return true;
  const nom = plan['nom_' + k];
  return lleno(nom) && lista.findIndex((p) => p.nombre === String(nom).trim().toUpperCase()) < 0;
}

/**
 * Firmante que la ficha va a imprimir en una casilla.
 *
 * Lee del plan de la ficha: `nom_<k>` (nombre elegido o tecleado), `occ_<k>`
 * (ocupación de «Otra persona»), `sel_<k>` (`'otro'` si se pidió escribir a
 * mano) y `fec_<k>` (fecha de la firma).
 *   · Sin nada escrito ⇒ la persona por defecto de la casilla (`indicePorDefecto`).
 *   · Un nombre que coincide con alguien de la lista ⇒ esa persona (así las
 *     fichas viejas, donde el nombre se tecleaba, se reconocen solas).
 *   · Un nombre que no está en la lista, o «Otra persona» ⇒ lo escrito tal cual,
 *     con la ocupación escrita tal cual.
 * Una persona de la lista lleva SIEMPRE el cargo dictado: un `occ_` que quedó de
 * una ficha vieja no se le pega (se imprimía «JORGE MIRANDA / Subgerente…»).
 *
 * @param {string} k     casilla ('elab' | 'rev' | 'apr' | 'apr2' | 'rec')
 * @param {object} plan  estado editable de la ficha
 * @returns {{nombre: string, ocupacion: string, fecha: string, otra: boolean, indice: number}}
 *   `indice` es la posición de la persona en la lista, o -1 si es otra persona.
 */
export function firmanteDe(k, plan = {}) {
  const lista = FIRMANTES[k] || [];
  const nom = plan['nom_' + k];
  const fecha = lleno(plan['fec_' + k]) ? String(plan['fec_' + k]).trim() : '';
  if (esOtra(k, plan, lista) || !lista.length) {
    const occ = plan['occ_' + k];
    return { nombre: lleno(nom) ? String(nom).trim() : '', ocupacion: occ != null ? String(occ) : '',
      fecha, otra: true, indice: -1 };
  }
  const indice = lleno(nom)
    ? lista.findIndex((p) => p.nombre === String(nom).trim().toUpperCase())
    : indicePorDefecto(k, plan);
  const persona = lista[indice];
  return { nombre: persona.nombre, ocupacion: persona.ocupacion, fecha, otra: false, indice };
}
