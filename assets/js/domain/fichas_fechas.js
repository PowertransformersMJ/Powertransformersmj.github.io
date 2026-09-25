// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas · FECHAS (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// Las fechas de la ficha (Fecha de Entrega y la fecha de cada firmante) se
// escogen en un CALENDARIO (orden del Ingeniero, 2026-09-23, `99 §91`). El
// calendario del navegador trabaja en ISO («2026-12-15»); el papel PE.02081
// escribe «15/12/2026», como la plantilla. Aquí vive la conversión, para que la
// pantalla y el Excel digan lo mismo.
//
// Lo que se guarda en la ficha es «dd/mm/aaaa» (lo que va al papel). Una fecha
// escrita a mano antes del calendario («15-12-2026», «2026-12-15», «1/2/2027»)
// se reconoce; lo que no es una fecha real se deja tal cual y NO se inventa
// otra.
// ══════════════════════════════════════════════════════════════════════════════

const dos = (n) => String(n).padStart(2, '0');

/** ¿Existe ese día en el calendario? (29/02 solo en bisiesto, 31/04 no). */
function esDiaReal(a, m, d) {
  if (!(a >= 1900 && a <= 2200) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return false;
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/**
 * Lee una fecha escrita como «dd/mm/aaaa», «d/m/aaaa», «dd-mm-aaaa» o ISO
 * «aaaa-mm-dd».
 * @returns {{a: number, m: number, d: number}|null}  null si no es una fecha real
 */
function leerFecha(v) {
  const s = String(v == null ? '' : v).trim();
  let a; let m; let d;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) { a = +r[1]; m = +r[2]; d = +r[3]; } else {
    r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!r) return null;
    d = +r[1]; m = +r[2]; a = +r[3];
  }
  return esDiaReal(a, m, d) ? { a, m, d } : null;
}

/** «dd/mm/aaaa» (o cualquier forma que `leerFecha` entienda) → «aaaa-mm-dd» para el calendario; '' si no es fecha. */
export function fechaAISO(v) {
  const f = leerFecha(v);
  return f ? f.a + '-' + dos(f.m) + '-' + dos(f.d) : '';
}

/** «aaaa-mm-dd» del calendario → «dd/mm/aaaa» para la ficha y el papel; '' si viene vacía o no es fecha. */
export function isoAFecha(iso) {
  const s = String(iso == null ? '' : iso).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const f = leerFecha(s);
  return f ? dos(f.d) + '/' + dos(f.m) + '/' + f.a : '';
}

/**
 * Cómo se imprime una fecha guardada: si es una fecha real, siempre
 * «dd/mm/aaaa»; si es un texto viejo que no lo es, tal cual (no se inventa).
 */
export function fechaParaPapel(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  const iso = fechaAISO(s);
  return iso ? isoAFecha(iso) : s;
}

// ── AÑO DE ENTRADA · calendario de años ─────────────────────────────────────
// Orden del Ingeniero (2026-09-24, `99 §94`): «que aquí también aparezca un
// calendario, pero solo años, desde 2020». Se guarda el año como texto
// «aaaa», igual que antes; el papel lo imprime tal cual.

/** Primer año que ofrece el calendario (orden del Ingeniero). */
export const ANIO_MIN = 2020;
/** Años hacia adelante que se ofrecen desde el año en curso. */
const ANIOS_ADELANTE = 10;
/** Columnas de la rejilla: la última fila se completa para que no quede coja. */
export const COLUMNAS_ANIOS = 4;

/**
 * Lee un año guardado («2027», « 2027 »). Solo cuenta un año de cuatro
 * cifras desde {@link ANIO_MIN}: lo demás (un año viejo, «2027-2028», «27»)
 * NO se convierte en otro — se sigue viendo como se escribió.
 * @returns {number|null}
 */
export function leerAnio(v) {
  const s = String(v == null ? '' : v).trim();
  if (!/^\d{4}$/.test(s)) return null;
  const n = +s;
  return n >= ANIO_MIN && n <= 2200 ? n : null;
}

/**
 * Años del calendario: desde {@link ANIO_MIN} hasta el año en curso +
 * {@link ANIOS_ADELANTE} (o hasta el año ya guardado, si es posterior: nunca se
 * esconde lo elegido), completando la última fila de la rejilla.
 * @param {number} anioActual  año en curso (la pantalla pasa el del reloj)
 * @param {*} [guardado]       lo que ya tiene la ficha
 * @returns {number[]}
 */
export function aniosDelCalendario(anioActual, guardado) {
  const hoy = Number.isInteger(anioActual) ? anioActual : ANIO_MIN;
  const elegido = leerAnio(guardado);
  let fin = Math.max(hoy + ANIOS_ADELANTE, elegido || 0, ANIO_MIN);
  const n = fin - ANIO_MIN + 1;
  fin += (COLUMNAS_ANIOS - (n % COLUMNAS_ANIOS)) % COLUMNAS_ANIOS;
  const out = [];
  for (let a = ANIO_MIN; a <= fin; a++) out.push(a);
  return out;
}
