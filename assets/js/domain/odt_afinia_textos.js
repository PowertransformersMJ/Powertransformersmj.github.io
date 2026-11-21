// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · textos del acuerdo y de las declaraciones (PURO)
// ──────────────────────────────────────────────────────────────────────────────
// La regla del acto arma la MISMA cadena con `'Yo, ' + nombre + …` y la compara
// carácter a carácter con lo que guarda el cliente (DISENO-FINAL §2). Por eso
// cada plantilla se publica también como lista de FRAGMENTOS literales, cortados
// justo en los huecos: la prueba de reglas busca cada fragmento en firestore.rules.
// Una coma o una tilde distinta aquí o allá = firma rechazada (bien).
//
// Fechas: 'dd/mm/aaaa' en la hora de Colombia (Intl, timeZone America/Bogota),
// no la del equipo de quien firma.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { VERSIONES, esNro, tieneFormaFechaDMA } from './odt_afinia_rutas.js';

/**
 * ¿El Ingeniero ya aprobó («procede») el acuerdo y las dos declaraciones v1?
 * SÍ: el 2026-11-20 los aprobó TAL CUAL («Sí, los apruebo», 99 §231.10). Con false la
 * pantalla los mostraba con el rótulo ROTULO_BORRADOR, y una prueba estática impide poner
 * la página en 'publicado' sin esta marca (tests/odt_afinia_ui_estatico.test.js).
 * Lo aprobado es el texto v1 EXACTO (prueba que lo fija en tests/odt_afinia_ui_pantalla.test.js):
 * si el texto cambia, se sube la versión (odt-*-v2) A LA VEZ en las reglas, aquí y en las
 * pruebas de amarre, y vuelve a necesitar su aprobación.
 */
export const TEXTOS_APROBADOS = true;
export const ROTULO_BORRADOR = 'Borrador · pendiente del Ingeniero';

/** Marcadores de los huecos dentro de PLANTILLAS (no son texto: se reemplazan). */
export const HUECO = Object.freeze({ nombre: '{nombre}', correo: '{correo}', nro: '{nro}', fecha: '{fecha}' });

/**
 * Plantillas v1 como fragmentos: literales y huecos alternados. Unidas con los
 * datos dan el texto exacto; sus literales son lo que la regla debe contener.
 */
export const PLANTILLAS = Object.freeze({
  [VERSIONES.acuerdo]: Object.freeze([
    'Yo, ', HUECO.nombre, ', con mi cuenta personal ', HUECO.correo,
    ', acepto firmar electrónicamente las ODT de Afinia en SGM. Mi firma solo se estampa desde mi propia cuenta y con mi contraseña personal, que no comparto.'
  ]),
  [VERSIONES.azt]: Object.freeze([
    'Yo, ', HUECO.nombre, ', con mi cuenta personal ', HUECO.correo,
    ', declaro que revisé las dos páginas de la ODT N.º ', HUECO.nro,
    ' y, como AZT EN SITIO, la firmo. Esta firma equivale a mi firma manuscrita.'
  ]),
  [VERSIONES.responsable]: Object.freeze([
    'Yo, ', HUECO.nombre, ', con mi cuenta personal ', HUECO.correo,
    ', declaro que revisé las dos páginas de la ODT N.º ', HUECO.nro,
    ', verifiqué la firma del AZT y, como RESPONSABLE O.D.T., la firmo y la cierro con fecha ', HUECO.fecha,
    '. Esta firma equivale a mi firma manuscrita.'
  ])
});

const HUECOS = new Set(Object.values(HUECO));

/** Los fragmentos LITERALES de una plantilla (sin huecos). */
export function literales(version) {
  const p = PLANTILLAS[version];
  if (!p) throw new Error('Plantilla desconocida: ' + version);
  return p.filter((f) => !HUECOS.has(f));
}

function texto(valor, campo) {
  const s = typeof valor === 'string' ? valor : '';
  if (!s.trim()) throw new TypeError('Falta ' + campo + ' para armar el texto.');
  return s;
}

function rellenar(version, datos) {
  return PLANTILLAS[version].map((f) => {
    if (f === HUECO.nombre) return texto(datos.nombre, 'el nombre');
    if (f === HUECO.correo) return texto(datos.correo, 'el correo');
    if (f === HUECO.nro) {
      if (!esNro(datos.nro)) throw new TypeError('El N.º de ODT debe tener 8 dígitos.');
      return datos.nro;
    }
    if (f === HUECO.fecha) {
      if (!esFechaDMA(datos.fecha)) throw new TypeError('La fecha de cierre debe ser dd/mm/aaaa.');
      return datos.fecha;
    }
    return f;
  }).join('');
}

/** Acuerdo de habilitación (una vez por persona). */
export function textoAcuerdo({ nombre, correo } = {}) {
  return rellenar(VERSIONES.acuerdo, { nombre, correo });
}

/** Declaración del AZT EN SITIO. */
export function declaracionAzt({ nombre, correo, nro } = {}) {
  return rellenar(VERSIONES.azt, { nombre, correo, nro });
}

/** Declaración del RESPONSABLE O.D.T. (con la fecha de cierre). */
export function declaracionResponsable({ nombre, correo, nro, fecha } = {}) {
  return rellenar(VERSIONES.responsable, { nombre, correo, nro, fecha });
}

/** Declaración por rol: {version, texto}. */
export function declaracion(rol, datos = {}) {
  if (rol === 'azt') return { version: VERSIONES.azt, texto: declaracionAzt(datos) };
  if (rol === 'responsable') return { version: VERSIONES.responsable, texto: declaracionResponsable(datos) };
  throw new TypeError('Rol desconocido: ' + rol);
}

// ── Fechas (hora de Colombia) ──────────────────────────────────────────────────
export const ZONA_HORARIA = 'America/Bogota';
const FORMATO_BOGOTA = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'dd/mm/aaaa' del instante dado, en la hora de Bogotá. */
export function fechaBogota(instante = new Date()) {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) throw new TypeError('Fecha inválida.');
  const p = Object.fromEntries(FORMATO_BOGOTA.formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
  return p.day + '/' + p.month + '/' + p.year;
}

/** ¿'dd/mm/aaaa' y un día que existe en el calendario? */
export function esFechaDMA(f) {
  if (!tieneFormaFechaDMA(f)) return false;
  const [d, m, a] = f.split('/').map(Number);
  if (a < 2000 || m < 1 || m > 12 || d < 1) return false;
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return d <= dias;
}

/** 'dd/mm/aaaa' → aaaammdd (número comparable); NaN si no es fecha. */
export function ordenDMA(f) {
  if (!esFechaDMA(f)) return NaN;
  const [d, m, a] = f.split('/').map(Number);
  return a * 10000 + m * 100 + d;
}

/**
 * Error de la fecha de cierre, o null si sirve: fecha real, no posterior a hoy
 * (Bogotá) y no anterior a la fecha del trabajo.
 */
export function errorFechaCierre(fecha, { fechaTrabajo, ahora = new Date() } = {}) {
  if (!esFechaDMA(fecha)) return 'La fecha de cierre debe ser una fecha real en formato dd/mm/aaaa.';
  if (ordenDMA(fecha) > ordenDMA(fechaBogota(ahora))) return 'La fecha de cierre no puede ser posterior a hoy.';
  if (fechaTrabajo != null && !esFechaDMA(fechaTrabajo)) return 'La fecha del trabajo de la ODT no es una fecha válida.';
  if (fechaTrabajo != null && ordenDMA(fecha) < ordenDMA(fechaTrabajo)) {
    return 'La fecha de cierre no puede ser anterior a la fecha del trabajo (' + fechaTrabajo + ').';
  }
  return null;
}

/** Nombre del archivo que se descarga. */
export function nombreArchivo(nro) {
  if (!esNro(nro)) throw new TypeError('El N.º de ODT debe tener 8 dígitos.');
  return 'ODT_' + nro + '_firmada.pdf';
}
