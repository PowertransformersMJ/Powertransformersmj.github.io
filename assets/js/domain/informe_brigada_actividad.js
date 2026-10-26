// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada · ACTIVIDAD escrita a mano
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-26): en «Nuevo informe» la actividad se escoge de
// la lista de motivos de Órdenes de materiales (sugerencias) O SE ESCRIBE a mano.
// Toda actividad válida arma el informe con el único modelo que existe (F60 de
// refrigeración); sus textos se ajustan en el editor. La actividad no se imprime
// en el papel: se ve en la lista de informes del equipo y en el encabezado del
// editor. Después de crear no cambia (firestore.rules · ibrFijos).
//
// La MISMA regla en tres sitios: la ventana «Nuevo informe»
// (ui/informe-brigada/selector.js), `planCrear` (informe_brigada_rutas.js, que
// aplican los dos repositorios) y firestore.rules (`ibrActividad`). Una prueba
// amarra el patrón y los topes con las reglas.
//   · sin espacios sobrantes a los lados; los espacios internos repetidos se
//     reducen a uno (también el espacio duro y el tabulador);
//   · sin marcas invisibles de copiar y pegar (espacio de ancho cero, guion
//     blando, marcas de dirección…): se QUITAN, porque no se ven y harían que dos
//     actividades iguales a la vista fueran distintas (revisión 2026-10-26);
//   · de 3 a 200 caracteres, contados como los cuentan las reglas (`size()` de
//     Firestore = `.length` de JavaScript: una letra con tilde es 1, un emoji 2);
//   · en una sola línea: sin saltos ni caracteres de control;
//   · con al menos una letra (latina, con o sin tilde) o un número: una actividad
//     que se ve en blanco, o hecha solo de puntos o emojis, no sirve.
//
// Archivo NUEVO a propósito (L-102): los módulos publicados se quedan ~10 min en
// la caché del navegador y una exportación nueva en un archivo viejo tumbaría la
// página. Este archivo no importa nada. Dominio puro: se prueba con `node --test`.
// ══════════════════════════════════════════════════════════════════════════════

export const ACTIVIDAD_MIN = 3;
export const ACTIVIDAD_MAX = 200;

// Marcas invisibles que llegan al copiar y pegar (Word, Teams, Outlook, páginas web): guion blando
// U+00AD, rellenos coreanos U+115F/U+1160/U+3164/U+FFA0, separador mongol U+180E, espacio de ancho
// cero U+200B, marcas y aislamientos de dirección U+200E/U+200F/U+202A–U+202E/U+2066–U+2069, unión
// de palabras y operadores invisibles U+2060–U+2064 y U+FEFF. No se ven: se QUITAN al normalizar y
// las reglas las rechazan. (U+180E: el JavaScript del navegador lo cuenta como formato y el motor de
// las reglas, con tablas Unicode viejas, como espacio; nombrarlo aquí deja a los dos de acuerdo.)
// Las uniones U+200C/U+200D se quedan: los emojis compuestos las usan.
const INVISIBLES_RE2 = '\\x{00AD}\\x{115F}\\x{1160}\\x{180E}\\x{200B}\\x{200E}\\x{200F}\\x{202A}-\\x{202E}'
  + '\\x{2060}-\\x{2064}\\x{2066}-\\x{2069}\\x{3164}\\x{FEFF}\\x{FFA0}';

/**
 * Patrón de firestore.rules (sintaxis RE2), igual letra por letra que en la función
 * `ibrActividad` de las reglas: palabras separadas por UN espacio, sin espacios a los
 * lados, sin caracteres de control (\p{Cc}: saltos de línea, tabulador…), sin otros
 * separadores (\p{Z}: espacio duro, separador de línea…) y sin marcas invisibles.
 */
export const PATRON_ACTIVIDAD = '^[^\\p{Cc}\\p{Z}' + INVISIBLES_RE2 + ']+( [^\\p{Cc}\\p{Z}' + INVISIBLES_RE2 + ']+)*$';
/**
 * Segundo patrón de `ibrActividad`: al menos una letra o un número, para que una actividad que se ve
 * en blanco (o solo puntos o emojis) no sirva. Las letras van NOMBRADAS por su código (0-9, A-Z, a-z
 * y las latinas con tilde, ñ, ü… de U+00C0 a U+024F) y no como «cualquier letra» (\p{L}): el motor de
 * las reglas trae tablas Unicode más viejas que el navegador y no reconoce como letra las agregadas
 * después (comprobado en el emulador con U+A7C0 y U+0870). Un rango por código no depende de tablas.
 * `matches()` de las reglas exige el texto COMPLETO: por eso el `.*` a los lados.
 */
export const PATRON_CONTENIDO = '.*[0-9A-Za-z\\x{00C0}-\\x{00D6}\\x{00D8}-\\x{00F6}\\x{00F8}-\\x{024F}].*';

// Los mismos patrones para JavaScript: RE2 escribe `\x{FEFF}`, JavaScript (con la bandera u) `\u{FEFF}`;
// y `matches()` de las reglas compara el texto entero, por eso van con ^…$.
const aJs = (p) => new RegExp('^(?:' + p.replace(/\\x\{/g, '\\u{') + ')$', 'u');
const RE_ACTIVIDAD = aJs(PATRON_ACTIVIDAD);
const RE_CONTENIDO = aJs(PATRON_CONTENIDO);
const INVISIBLES = new RegExp('[' + INVISIBLES_RE2.replace(/\\x\{/g, '\\u{') + ']', 'gu');
// Espacios que se reducen a uno: el espacio, el espacio duro y demás separadores de la
// línea (\p{Zs}) y el tabulador. Los saltos de línea NO: se rechazan.
const BLANCOS = /[\t\p{Zs}]+/gu;

/**
 * Actividad tal como se guarda: sin marcas invisibles, sin espacios a los lados, con un
 * solo espacio entre palabras y en la forma normal de Unicode (NFC: «é» siempre como una
 * sola letra). Las marcas se quitan ANTES de la NFC (una marca entre una letra y su tilde
 * dejaría la tilde suelta). Lo que no es texto queda vacío.
 * @param {unknown} v
 * @returns {string}
 */
export function normalizarActividad(v) {
  if (typeof v !== 'string') return '';
  return v.replace(INVISIBLES, '').normalize('NFC').replace(BLANCOS, ' ').trim();
}

/**
 * Qué impide usar esta actividad (en español llano), o null si sirve. Revisa el texto
 * YA normalizado: es lo que se guarda y lo que vuelven a revisar las reglas.
 * @param {unknown} v
 * @returns {string|null}
 */
export function errorActividad(v) {
  const s = normalizarActividad(v);
  const n = s.length;
  if (!n) return 'Escriba la actividad del informe (de ' + ACTIVIDAD_MIN + ' a ' + ACTIVIDAD_MAX + ' caracteres).';
  if (!RE_ACTIVIDAD.test(s)) return 'La actividad va en una sola línea, sin saltos de línea ni caracteres de control.';
  if (n < ACTIVIDAD_MIN) return 'La actividad es muy corta: escriba al menos ' + ACTIVIDAD_MIN + ' caracteres.';
  if (n > ACTIVIDAD_MAX) return 'La actividad es muy larga: máximo ' + ACTIVIDAD_MAX + ' caracteres (tiene ' + n + ').';
  if (!RE_CONTENIDO.test(s)) return 'La actividad necesita al menos una letra o un número.';
  return null;
}

/**
 * Lo que dice la ventana «Nuevo informe» debajo del campo. Vacío mientras se escribe
 * (`estricto` falso) NO es un error todavía: la ayuda pide borrar el texto para ver toda
 * la lista, así que sale un aviso neutro; en rojo solo al salir del campo o al crear.
 * «Crear informe» sirve solo con `sirve`.
 * @param {unknown} v
 * @param {{ lista?: string[], estricto?: boolean }} [o]  lista = las actividades de la lista de motivos
 * @returns {{ sirve: boolean, error: boolean, texto: string }}
 */
export function avisoActividad(v, { lista = [], estricto = false } = {}) {
  const err = errorActividad(v);
  const act = normalizarActividad(v);
  if (!err) {
    return { sirve: true, error: false, texto: (Array.isArray(lista) && lista.includes(act)) ? 'Actividad de la lista de motivos.' : 'Actividad escrita a mano.' };
  }
  if (!act && !estricto) return { sirve: false, error: false, texto: 'Escriba la actividad o escoja una de la lista.' };
  return { sirve: false, error: true, texto: err };
}
