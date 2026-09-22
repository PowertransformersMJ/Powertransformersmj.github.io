// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · IDENTIDAD DEL EQUIPO (99 §82/§83)
// ──────────────────────────────────────────────────────────────
// UNA sola implementación de «quién es este equipo», porque dos copias que se
// desincronizan el día que una cambie = una ficha resucitada sobre el equipo
// equivocado en un papel que se FIRMA (es exactamente el defecto de `§82`).
//
// Hay DOS nociones y no son la misma, a propósito:
//
//   · `claveEquipo(equipo)` — clave de ESTADO EN MEMORIA, dentro de una
//     pantalla ya cargada. Vale cualquier identificador estable de esa lista
//     (incluido el id de Firestore o el código+fila del listado). Viene del
//     módulo del unifilar, que la sigue exportando para no romper a nadie.
//
//   · `identidadDeEquipo(equipo)` — identidad PERSISTENTE, la que sobrevive a
//     cerrar la pestaña y a cambiar de fuente de datos. Solo acepta lo que
//     identifica al aparato en sí: MATRÍCULA o SERIE. Ni el id de Firestore
//     (cambia de fuente a fuente), ni la fila (cambia si se reordena el
//     listado), ni la subestación (la comparten los equipos de un mismo
//     patio: es el error de `§82`, que aquí no se repite).
// ══════════════════════════════════════════════════════════════

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

// Clave de respaldo por objeto: si un equipo no trae NINGÚN identificador, dos
// equipos distintos compartirían la clave '' y editar el diagrama de uno pisaría
// el del otro. Se le asigna entonces una clave propia, atada a esa instancia.
const CLAVES_ANONIMAS = new WeakMap();
let contadorAnonimo = 0;

/**
 * Clave de estado del equipo DENTRO de la pantalla cargada.
 * @param {object|string|number} equipo
 * @returns {string} clave estable, '' si no hay nada identificable
 */
export function claveEquipo(equipo) {
  if (equipo == null) return '';
  if (typeof equipo === 'string' || typeof equipo === 'number') return String(equipo);
  // Identificadores PROPIOS del equipo, de más a menos específico. La matrícula
  // y la serie van ANTES que `codigo` porque, cuando los datos entran por
  // listado adjunto, `codigo` es el «CODIGO SUBESTACION» y los dos
  // transformadores de una misma subestación lo COMPARTEN: de ahí salía que el
  // segundo equipo nunca pudiera abrir su propia ficha (`99 §82`).
  const propio = leer(equipo,
    'id', 'matricula', 'identificacion.matricula',
    'serie', 'identificacion.numero_serie',
    // `identificacion.codigo` es el código del EQUIPO en el esquema v2 (único);
    // el `codigo` plano del listado es otra cosa y se trata más abajo.
    'identificacion.codigo');
  if (propio != null) return String(propio);
  // Sin identificador propio queda `codigo`, que puede venir compartido: la
  // fila del listado entra como DESEMPATE. Nunca al revés —una fila suelta
  // cambia de equipo si el listado se reordena—, y nunca sola si hay código.
  const compartido = leer(equipo, 'codigo');
  const fila = leer(equipo, 'fila');
  if (compartido != null) return fila != null ? `${compartido}#${fila}` : String(compartido);
  if (fila != null) return String(fila);
  if (typeof equipo !== 'object') return '';
  if (!CLAVES_ANONIMAS.has(equipo)) {
    CLAVES_ANONIMAS.set(equipo, `sin-id:${++contadorAnonimo}`);
  }
  return CLAVES_ANONIMAS.get(equipo);
}

/** Mayúsculas, sin acentos decorativos, espacios colapsados: «t1‑a / m‑bqe» → «T1-A / M-BQE». */
export function normalizarIdent(v) {
  if (v == null) return '';
  return String(v).trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Identidad PERSISTENTE del equipo.
 * @returns {{clave:string, matricula:string, serie:string, subestacion:string}|null}
 *   `null` cuando el registro no trae matrícula NI serie: un borrador que no se
 *   puede reenganchar con certeza es peor que ninguno, así que no se guarda.
 */
export function identidadDeEquipo(equipo) {
  if (equipo == null || typeof equipo !== 'object') return null;
  const matricula = normalizarIdent(leer(equipo, 'matricula', 'identificacion.matricula'));
  const serie = normalizarIdent(leer(equipo, 'serie', 'identificacion.numero_serie'));
  if (!matricula && !serie) return null;
  // La matrícula manda como clave por ser el identificador operativo del parque;
  // la serie es el respaldo cuando el registro no trae matrícula. La
  // subestación viaja SOLO para poder enseñarla, nunca para decidir.
  const clave = matricula ? 'M:' + matricula : 'S:' + serie;
  return {
    clave,
    matricula,
    serie,
    subestacion: normalizarIdent(leer(equipo, 'subestacion', 'ubicacion.subestacion_nombre'))
  };
}

/**
 * ¿La identidad guardada y la del equipo en pantalla son el MISMO aparato?
 * Exacta sobre la clave; y si ambos declaran serie y no coinciden, es un
 * equipo REPUESTO que heredó la matrícula: no es el mismo y no se restaura.
 */
export function mismaIdentidad(guardada, viva) {
  if (!guardada || !viva) return false;
  if (guardada.clave !== viva.clave) return false;
  if (guardada.serie && viva.serie && guardada.serie !== viva.serie) return false;
  if (guardada.matricula && viva.matricula && guardada.matricula !== viva.matricula) return false;
  return true;
}
