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

import { firmaAplicaA } from './firmas.js';

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

// ── FIRMA ESTAMPADA · `99 §98` ──────────────────────────────────────────────
// Pedido del Ingeniero (2026-09-25): su firma «para que aparezca en el
// entregable y mientras se gestiona la ficha técnica». Se usa el mecanismo de
// `§71`: la firma vive en la cuenta de cada quien (Storage `firmas/{uid}`),
// solo se lee con la sesión, y SOLO se estampa en la casilla que lleva el
// nombre de quien tiene la sesión (`firmaAplicaA`, comparación exacta). Nunca
// se puede estampar la de otro.

/**
 * Nombres de la lista dictada que son LA MISMA persona: el Ingeniero se dictó
 * «MIGUEL A. JIMENEZ» en Elaboración y «MIGUEL JIMENEZ» en Revisión (`§89`).
 * Es una lista CERRADA y explícita, no una comparación aproximada: aflojar la
 * regla para todos (quitar iniciales, etc.) sería equivocarse hacia el lado
 * permisivo, que en una firma no se permite (`§71.4`).
 * «ING. MIGUEL JIMENEZ» es el nombre REAL de su perfil en producción (leído en
 * vivo el 2026-09-25, `§99.12`): sin él, su casilla no se reconocía como suya.
 */
const MISMA_PERSONA = Object.freeze([
  Object.freeze(['MIGUEL A. JIMENEZ', 'MIGUEL JIMENEZ', 'ING. MIGUEL JIMENEZ'])
]);

/** Nombres con que puede figurar en su perfil la persona de la lista (ella misma incluida). */
function nombresDePersona(nombre) {
  const grupo = MISMA_PERSONA.find((g) => g.includes(nombre));
  return grupo ? [...grupo] : [nombre];
}

/**
 * ¿La casilla `k` es de quien tiene la sesión? Solo entonces se estampa su
 * firma. Una persona de la lista se reconoce también por sus otros nombres
 * dictados (`MISMA_PERSONA`); «Otra persona» solo por lo escrito, tal cual.
 *
 * @param {string} k             casilla ('elab' | 'rev' | 'apr' | 'apr2' | 'rec')
 * @param {object} plan          estado editable de la ficha
 * @param {string} nombreSesion  nombre del perfil de la sesión
 */
export function casillaEsDeLaSesion(k, plan, nombreSesion) {
  const f = firmanteDe(k, plan || {});
  if (!f.nombre) return false;
  const nombres = f.otra ? [f.nombre] : nombresDePersona(f.nombre);
  return nombres.some((n) => firmaAplicaA(n, nombreSesion));
}

/** Las casillas de la ficha que son de quien tiene la sesión, en el orden del formato. */
export function casillasDeLaSesion(plan, nombreSesion) {
  return CASILLAS_FIRMA.filter((k) => casillaEsDeLaSesion(k, plan, nombreSesion));
}

/**
 * Tamaño de una firma estampada, con el MISMO peso visual para todas (`99 §101`,
 * pedido del Ingeniero: «proporcionales con el espacio para firmar, ni muy
 * grandes ni muy pequeñas, respetando los márgenes»).
 *
 * Antes todas iban a la misma ALTURA: una firma ancha (4,5 : 1) se estiraba a lo
 * ancho y una alta (1,7 : 1) quedaba angosta. Ahora todas buscan la misma
 * SUPERFICIE (`area`): la ancha se achica; la alta crece solo hasta `altoMax`
 * (el renglón de «Firma:», sin tapar el texto de encima) y ahí se queda, así que
 * con proporción menor que area / altoMax² (≈ 2,5 : 1) sale igual que antes.
 * Nunca pasa de `anchoMax` (el espacio de la casilla, con su margen). Unidades
 * libres (pt, EMU o px), las mismas en los tres parámetros.
 *
 * @param {number} rel  ancho / alto de la imagen
 * @param {{area: number, altoMax: number, anchoMax?: number}} lim
 * @returns {{ancho: number, alto: number}}
 */
/** Medidas de la firma en el PAPEL (Excel): superficie ≈ 55 × 22 pt en una firma
 *  de 2,5 : 1 y alto máximo = el renglón de «Firma:». La pantalla usa las mismas,
 *  a su escala (30 px de alto máximo). */
export const FIRMA_PAPEL = Object.freeze({ areaPt2: 1200, altoMaxPt: 22 });

export function tamanoFirma(rel, { area, altoMax, anchoMax } = {}) {
  const r = rel > 0 && Number.isFinite(rel) ? rel : 2.5;
  let alto = Math.min(Math.sqrt(area / r), altoMax);
  let ancho = alto * r;
  if (anchoMax > 0 && ancho > anchoMax) { ancho = anchoMax; alto = ancho / r; }
  return { ancho, alto };
}
