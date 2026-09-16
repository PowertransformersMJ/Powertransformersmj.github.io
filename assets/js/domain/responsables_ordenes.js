// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · cédulas de los responsables (99 §78)
// ──────────────────────────────────────────────────────────────
// El repositorio es PÚBLICO: las cédulas nunca van en el código (`99 §70`).
// Viven en `responsables_ordenes/{NOMBRE_CON_GUIONES}` (Firestore, solo el
// equipo con sesión) y se resuelven AL GENERAR el documento, solo para las
// personas de esa orden. La orden guardada (borrador, pendientes, registro,
// copias) nunca lleva cédula.
//
// Módulo PURO (sin Firebase ni DOM). `firestore.rules` repite RE_NOMBRE,
// RE_CEDULA y la forma del id: si cambian aquí, cambian allá.
// ══════════════════════════════════════════════════════════════

export const COLECCION_RESPONSABLES = 'responsables_ordenes';

/** Nombre tal como está en CONFIG: mayúsculas (Ñ incluida) separadas por un espacio. */
export const RE_NOMBRE = /^[A-ZÑ]+( [A-ZÑ]+)*$/;
export const MAX_NOMBRE = 80;

/** Solo dígitos. 5 a 12 cubre la cédula de ciudadanía y la de extranjería numérica. */
export const RE_CEDULA = /^[0-9]{5,12}$/;

/** Los tres bloques de firma del formato IT.05801. */
export const CAMPOS_PERSONA = Object.freeze(['autorizado', 'entregado', 'recibido']);

const str = (v) => (v == null ? '' : String(v));

/**
 * Id del documento. Se reemplazan TODOS los espacios (`split/join`, no
 * `replace(' ', '_')`, que en JavaScript solo cambia el primero y en las reglas
 * los cambia todos) y NO se quitan tildes ni la Ñ: el id tiene que ser
 * exactamente el que calculan las reglas. '' si el nombre no es válido.
 */
export function idDeResponsable(nombre) {
  const n = str(nombre);
  if (n.length > MAX_NOMBRE || !RE_NOMBRE.test(n)) return '';
  return n.split(' ').join('_');
}

/** Quita puntos, espacios y todo lo que no sea dígito («99.999.999» → «99999999»). */
export function normalizarCedula(txt) {
  return str(txt).replace(/\D/g, '');
}

/** Por qué una cédula (ya normalizada) no sirve; '' si sirve. */
export function problemaCedula(cedula) {
  const c = str(cedula);
  if (!c) return 'Escriba la cédula.';
  if (!/^[0-9]+$/.test(c)) return 'La cédula solo lleva dígitos.';
  if (c.length < 5 || c.length > 12) return `La cédula tiene ${c.length} dígitos; se esperan entre 5 y 12.`;
  return '';
}

/** Cómo se imprime. Un solo lugar, para que PDF, vista previa y Excel no diverjan. */
export function formatoImpresion(cedula) {
  return normalizarCedula(cedula);
}

/** Pista para la pantalla: nunca la cédula completa. */
export function enmascarar(cedula) {
  const c = normalizarCedula(cedula);
  return c ? '•••' + c.slice(-3) : '';
}

/** Nombres (válidos y sin repetir) de las personas que firman una orden. */
export function nombresDeOrden(orden) {
  const o = orden || {};
  const vistos = new Set();
  const salida = [];
  CAMPOS_PERSONA.forEach((k) => {
    const n = str(o[k] && o[k].nombre).trim();
    if (n && !vistos.has(n)) { vistos.add(n); salida.push(n); }
  });
  return salida;
}

/**
 * Copia de la orden con la cédula de cada persona tomada del directorio.
 * El directorio es la ÚNICA fuente: lo que la orden traiga en `cedula` se
 * ignora (una copia vieja podría traer un número ya corregido o retirado).
 * @param {object} orden
 * @param {Map<string, string>} cedulas  nombre → cédula
 */
export function aplicarCedulas(orden, cedulas) {
  const mapa = cedulas instanceof Map ? cedulas : new Map();
  const copia = JSON.parse(JSON.stringify(orden || {}));
  CAMPOS_PERSONA.forEach((k) => {
    const p = copia[k] && typeof copia[k] === 'object' ? copia[k] : { nombre: '' };
    p.cedula = formatoImpresion(mapa.get(str(p.nombre).trim()) || '');
    copia[k] = p;
  });
  return copia;
}

/** Nombres de la orden que quedarían sin cédula con ese directorio. */
export function faltantes(orden, cedulas) {
  const mapa = cedulas instanceof Map ? cedulas : new Map();
  return nombresDeOrden(orden).filter((n) => !mapa.get(n));
}

/** Copia sin cédulas: para todo lo que se guarda en el navegador o en un archivo. */
export function sinCedulas(orden) {
  if (!orden || typeof orden !== 'object') return orden;
  const copia = JSON.parse(JSON.stringify(orden));
  CAMPOS_PERSONA.forEach((k) => {
    if (copia[k] && typeof copia[k] === 'object' && 'cedula' in copia[k]) copia[k].cedula = '';
  });
  return copia;
}

/** ¿La orden trae alguna cédula con dígitos? */
export function traeCedulas(orden) {
  const o = orden || {};
  return CAMPOS_PERSONA.some((k) => normalizarCedula(o[k] && o[k].cedula) !== '');
}

/**
 * Pares nombre/cédula de un archivo local elegido por el administrador: el
 * módulo suelto (`nombre: '…', cedula: '…'`), un JSON con esa forma o un CSV
 * «NOMBRE;CEDULA». Se leen en el navegador y no se suben a ningún lado.
 * @param {string} texto
 * @param {string[]} nombresConocidos  los de CONFIG
 * @returns {{nombre, cedula, enLista:boolean, problema:string}[]}
 */
export function paresDeArchivo(texto, nombresConocidos) {
  const conocidos = new Set((nombresConocidos || []).map(str));
  const t = str(texto);
  const pares = [];
  const re = /["']?nombre["']?\s*:\s*["']([^"'\n]{1,120})["']\s*,\s*["']?cedula["']?\s*:\s*["']([^"'\n]{0,30})["']/gi;
  let m;
  while ((m = re.exec(t)) !== null) pares.push([m[1], m[2]]);
  if (!pares.length) {
    t.split(/\r?\n/).forEach((linea) => {
      const partes = linea.split(/[;,\t]/);
      if (partes.length >= 2 && /\d/.test(partes[1])) pares.push([partes[0], partes[1]]);
    });
  }
  const vistos = new Map();
  pares.forEach(([n, c]) => {
    const nombre = str(n).trim().replace(/\s+/g, ' ').toUpperCase();
    const cedula = normalizarCedula(c);
    if (!nombre || !cedula) return;
    vistos.set(nombre, cedula);              // si un nombre aparece dos veces, gana el último
  });
  const salida = Array.from(vistos, ([nombre, cedula]) => ({
    nombre, cedula,
    enLista: conocidos.has(nombre),
    problema: !idDeResponsable(nombre) ? 'Nombre con caracteres no admitidos.'
      : (problemaCedula(cedula) || '')
  }));
  const repetidas = cedulasRepetidas(salida);
  salida.forEach((p) => {
    if (!p.problema && repetidas.has(p.cedula)) p.problema = 'La misma cédula aparece en otra persona.';
  });
  return salida;
}

/** Cédulas que aparecen en más de una persona. */
export function cedulasRepetidas(lista) {
  const cuenta = new Map();
  (lista || []).forEach((p) => {
    const c = normalizarCedula(p && p.cedula);
    if (c) cuenta.set(c, (cuenta.get(c) || 0) + 1);
  });
  return new Set(Array.from(cuenta).filter(([, n]) => n > 1).map(([c]) => c));
}

/**
 * ¿Parece un rótulo del bloque de firmas o un dato de identificación? Sirve
 * para que importar listas desde el Excel de una ORDEN (que ahora trae la
 * cédula en la hoja del formato) no meta «CÉDULA:  …» como material.
 */
export function pareceDatoPersonal(texto) {
  const t = str(texto).trim();
  if (!t) return false;
  if (/^(C[ÉE]DULA|NOMBRE|AUTORIZADO POR|ENTREGADO POR|RECIBIDO POR)\b/i.test(t)) return true;
  return /\b(C[ÉE]DULA|C\.\s?C\.?)\s*[:#]?\s*\d/i.test(t);
}

/** Hojas que genera el propio módulo al exportar una orden: no son listas. */
export function esHojaDeOrdenExportada(nombreHoja) {
  return /^Orden( \d+)?$/i.test(str(nombreHoja).trim());
}
