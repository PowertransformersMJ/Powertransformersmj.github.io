// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada (F60-ADM) · FORMATO del papel
// ──────────────────────────────────────────────────────────────────────────────
// Cómo se ESCRIBEN los datos en el informe: números con coma, listas «A, B y C»,
// fechas «21/02/2026» o «del 20 al 21 de febrero de 2026», ordinales, mayúsculas
// del español y nombres de subestación en tipo título.
//
// Dominio puro (sin pantalla ni red): lo usan igual el papel (PDF) y el Word, así
// los dos dicen exactamente las mismas palabras. Se prueba con `node --test`.
// Archivo propio a propósito (L-102): se carga con import() y no comparte caché
// con módulos que el navegador ya tenía guardados.
// ══════════════════════════════════════════════════════════════════════════════

import { isoAFecha } from './fichas_fechas.js';
import { DEPARTAMENTOS } from './schema.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Número con coma decimal y sin ceros de relleno, como lo escribe el modelo:
 * 2.03 → «2,03» · 1.9 → «1,9» · 14 → «14» · 34500 → «34500» (sin separador de miles).
 * Un texto se devuelve tal cual; null, undefined o NaN → ''.
 */
export function numES(n) {
  if (n == null) return '';
  if (typeof n === 'string') return n;
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const s = Number.isInteger(n) ? String(n) : String(+n.toPrecision(10));
  return s.replace('.', ',');
}

/** Lista en español: [] → '' · ['A'] → 'A' · ['A','B'] → 'A y B' · ['A','B','C'] → 'A, B y C'. Ignora vacíos. */
export function listaY(arr, conj = 'y') {
  const a = (Array.isArray(arr) ? arr : [])
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter((x) => x !== '');
  if (a.length <= 1) return a[0] || '';
  return a.slice(0, -1).join(', ') + ' ' + conj + ' ' + a[a.length - 1];
}

/** «aaaa-mm-dd» → «dd/mm/aaaa»; '' si viene vacía o no es una fecha real. */
export function fechaDMA(iso) {
  return isoAFecha(iso);
}

function partesISO(iso) {
  const dma = isoAFecha(iso);
  if (!dma) return null;
  const [d, m, a] = dma.split('/').map(Number);
  return { d, m, a };
}

/**
 * Rango de fechas en palabras, como el párrafo «2.2 PERSONAL» del modelo:
 *   mismo día   → «el 20 de febrero de 2026»
 *   mismo mes   → «del 20 al 21 de febrero de 2026»
 *   mismo año   → «del 28 de febrero al 2 de marzo de 2026»
 *   otro año    → «del 30 de diciembre de 2025 al 2 de enero de 2026»
 * Con una sola fecha válida, se escribe esa sola. Sin ninguna, ''.
 */
export function rangoFechas(ini, fin) {
  const a = partesISO(ini);
  const b = partesISO(fin);
  if (!a && !b) return '';
  if (!a || !b) { const f = a || b; return 'el ' + f.d + ' de ' + MESES[f.m - 1] + ' de ' + f.a; }
  if (a.a === b.a && a.m === b.m && a.d === b.d) return 'el ' + a.d + ' de ' + MESES[a.m - 1] + ' de ' + a.a;
  if (a.a === b.a && a.m === b.m) return 'del ' + a.d + ' al ' + b.d + ' de ' + MESES[a.m - 1] + ' de ' + a.a;
  if (a.a === b.a) return 'del ' + a.d + ' de ' + MESES[a.m - 1] + ' al ' + b.d + ' de ' + MESES[b.m - 1] + ' de ' + a.a;
  return 'del ' + a.d + ' de ' + MESES[a.m - 1] + ' de ' + a.a + ' al ' + b.d + ' de ' + MESES[b.m - 1] + ' de ' + b.a;
}

const ORDINALES = ['', 'primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo',
  'noveno', 'décimo', 'undécimo', 'duodécimo'];

/** Ordinal antes de un sustantivo masculino: 1 → «primer», 3 → «tercer», 4 → «cuarto»…; >12 → «13.º». */
export function ordinalEs(n) {
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1) return '';
  return ORDINALES[k] || (k + '.º');
}

/** Mayúsculas del español (respeta tildes y Ñ). */
export function mayusculasEs(s) {
  return String(s == null ? '' : s).toLocaleUpperCase('es-CO');
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en']);
const ROMANOS = /^(II|III|IV|VI|VII|VIII|IX|XI|XII)$/;

/**
 * Tipo título para nombres de subestación: «SAN JUAN DEL CESAR» → «San Juan del Cesar».
 * Las partículas (de, del, la, las, los, el, y, e, en) van en minúscula salvo al comienzo;
 * los números romanos (II, III, IV…) se conservan en mayúscula.
 */
export function tipoTituloEs(s) {
  const t = String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.split(' ').map((p, i) => {
    if (ROMANOS.test(p.toLocaleUpperCase('es-CO'))) return p.toLocaleUpperCase('es-CO');
    const min = p.toLocaleLowerCase('es-CO');
    if (i > 0 && PARTICULAS.has(min)) return min;
    // «Sabanalarga-Norte» → «Sabanalarga-Norte»: cada tramo con guion empieza en mayúscula.
    return min.split('-').map((x) => x.replace(/\p{L}/u, (c) => c.toLocaleUpperCase('es-CO'))).join('-');
  }).join(' ');
}

/** Matrícula apta para nombre de archivo: «T9-Z/Z-PRU» → «T9-Z_Z-PRU» (también \ : * ? " < > |). */
export function matriculaArchivo(m) {
  return String(m == null ? '' : m).trim().replace(/[/\\:*?"<>|]/g, '_');
}

function sinTildes(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** ¿El departamento está en la lista de departamentos cubiertos (`schema.js`)? */
export function departamentoConocido(v) {
  const k = sinTildes(v);
  if (!k) return false;
  return DEPARTAMENTOS.some((d) => d.value === k || sinTildes(d.label) === k);
}

/**
 * Departamento como va en el papel: en MAYÚSCULAS y con su tilde («cordoba» → «CÓRDOBA»),
 * tomando el nombre de la lista oficial (`schema.js`). Si no está en la lista, se escribe en
 * mayúsculas tal como llegó (y el informe lo avisa).
 */
export function departamentoPapel(v) {
  const k = sinTildes(v);
  if (!k) return '';
  const d = DEPARTAMENTOS.find((x) => x.value === k || sinTildes(x.label) === k);
  return mayusculasEs(d ? d.label : String(v).trim());
}
