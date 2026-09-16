// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Órdenes de Materiales · registro del equipo (99 §77)
// ──────────────────────────────────────────────────────────────
// Las órdenes de ENTRADA y SALIDA dejan de vivir solo en el navegador de
// quien las hizo: van a `ordenes_materiales/{clave}` en Firestore y todo el
// equipo las ve. Este módulo es PURO (sin Firebase ni DOM) y decide:
//   · la CLAVE de cada orden — TIPO + número, que el servidor exige derivada
//     de esos dos campos, así que dos personas no pueden guardar la misma;
//   · qué se guarda — lista blanca, personas SOLO con nombre (sin cédulas);
//   · qué órdenes del navegador pueden subirse y cómo se clasifican frente a
//     lo que ya hay en el registro.
// `firestore.rules` repite los límites de `LIMITES` y `RE_NUMERO`: si cambian
// aquí, cambian allá (y en `tests-rules/`).
// ══════════════════════════════════════════════════════════════

export const COLECCION = 'ordenes_materiales';
export const COLECCION_BORRADAS = 'ordenes_materiales_borradas';

/** Órdenes que se leen al abrir. Se pide una más para saber si hay más. */
export const TOPE_LECTURA = 500;

export const TIPOS = Object.freeze(['ENTRADA', 'SALIDA']);

export const LIMITES = Object.freeze({
  numero: 30, zona: 60, fecha: 60, hora: 20, origen: 160, destino: 160,
  transformador: 200, motivo: 500, motivoSel: 500, nota: 500, empresaVig: 100,
  nombre: 120, items: 200, codigo: 60, descripcion: 400, unidad: 40, elaboradaEn: 40
});

/**
 * Número de orden ya normalizado: empieza por letra o dígito y sigue con
 * letras, dígitos, espacio, punto, guion bajo, barra o guion. El formato
 * modelo propone `DDMMAAAA-01`. La barra no puede ir en un id de Firestore:
 * en la clave se escribe `~`, que no está permitido en el número, así que
 * dos números distintos nunca dan la misma clave.
 */
export const RE_NUMERO = /^[A-Z0-9][A-Z0-9 ._/-]{0,29}$/;

const TEXTOS = ['zona', 'fecha', 'hora', 'origen', 'destino', 'transformador',
                'motivo', 'motivoSel', 'nota', 'empresaVig'];
const PERSONAS = ['autorizado', 'entregado', 'recibido'];

const str = (v) => (v == null ? '' : String(v));

/** Mayúsculas, sin tildes y con los espacios colapsados. No recorta el largo. */
export function normalizarNumero(txt) {
  return str(txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Por qué un número (ya normalizado) no sirve; '' si sirve. */
export function problemaNumero(numero) {
  const n = str(numero);
  if (!n) return 'El número de orden no puede estar vacío.';
  if (n.length > LIMITES.numero) return `El número de orden admite hasta ${LIMITES.numero} caracteres.`;
  if (!RE_NUMERO.test(n)) {
    return 'El número de orden solo admite letras, dígitos, espacio y los signos . _ / - (debe empezar por letra o dígito).';
  }
  return '';
}

/** Clave del documento; '' si el tipo o el número no son válidos. */
export function claveDe(tipo, numero) {
  if (!TIPOS.includes(tipo) || problemaNumero(numero)) return '';
  return tipo + '_' + numero.replace(/\//g, '~');
}

/**
 * Lo que se guarda de una orden, sin metadatos de autoría. Nunca lleva
 * cédulas, firmas ni campos desconocidos. Devuelve también la lista de
 * ajustes hechos (texto recortado, cédula quitada, campo descartado), para
 * informarlos en la subida en vez de fallar a ciegas contra las reglas.
 */
export function aDocumento(orden) {
  const o = orden || {};
  const ajustes = [];
  const recortar = (campo, valor, max) => {
    const s = str(valor);
    if (s.length > max) { ajustes.push(`«${campo}» se recortó a ${max} caracteres`); return s.slice(0, max); }
    return s;
  };

  const numero = normalizarNumero(o.numero);
  if (numero !== str(o.numero)) ajustes.push(`el número quedó como «${numero}»`);

  const datos = { clave: claveDe(o.tipo, numero), tipo: str(o.tipo), numero };
  datos.fechaISO = str(o.fechaISO);
  TEXTOS.forEach((k) => { datos[k] = recortar(k, o[k], LIMITES[k]); });

  const items = Array.isArray(o.items) ? o.items : [];
  datos.items = items.map((it, i) => {
    const x = it || {};
    const cantidad = Number(x.cantidad);
    if (!Number.isFinite(cantidad)) ajustes.push(`el ítem ${i + 1} no tenía una cantidad numérica`);
    return {
      codigo: recortar(`ítem ${i + 1} · código`, x.codigo, LIMITES.codigo),
      descripcion: recortar(`ítem ${i + 1} · descripción`, x.descripcion, LIMITES.descripcion),
      unidad: recortar(`ítem ${i + 1} · unidad`, x.unidad, LIMITES.unidad),
      cantidad: Number.isFinite(cantidad) ? cantidad : 0
    };
  });

  PERSONAS.forEach((k) => {
    const p = o[k] || {};
    if (str(p.cedula).trim()) ajustes.push(`se quitó la cédula de «${k}»`);
    datos[k] = { nombre: recortar(`${k} · nombre`, p.nombre, LIMITES.nombre) };
  });

  datos.conFirmas = o.conFirmas !== false;
  return { datos, ajustes };
}

/**
 * Lo que impide guardar una orden en el registro (espejo de la regla).
 * Los textos largos no están aquí: `aDocumento` los recorta y lo informa.
 */
export function problemasParaRegistro(orden) {
  const o = orden || {};
  const errores = [];
  if (!TIPOS.includes(o.tipo)) errores.push('Falta el tipo de orden (entrada o salida).');
  const pn = problemaNumero(normalizarNumero(o.numero));
  if (pn) errores.push(pn);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(o.fechaISO))) errores.push('Falta la fecha de la orden.');
  const n = Array.isArray(o.items) ? o.items.length : 0;
  if (!n) errores.push('La orden no tiene materiales.');
  if (n > LIMITES.items) errores.push(`La orden tiene ${n} materiales; el registro admite hasta ${LIMITES.items}.`);
  return errores;
}

/** FNV-1a de 32 bits en hexadecimal: suficiente para saber si dos contenidos son iguales. */
function fnv1a(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Huella del CONTENIDO guardable (no de la autoría ni de las fechas de guardado). */
export function huella(orden) {
  return fnv1a(JSON.stringify(aDocumento(orden).datos));
}

/** Timestamp de Firestore, milisegundos o ISO → milisegundos (o null). */
export function aMilisegundos(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

const autorDe = (a) => ({ uid: str(a && a.uid), nombre: str(a && a.nombre) });

/**
 * Documento del registro → orden que entiende el módulo. Solo campos
 * conocidos y todo como texto: lo escribió OTRA persona, así que nada de
 * `undefined` en el PDF ni claves inesperadas. Las cédulas vuelven vacías.
 */
export function ordenDesdeRegistro(id, data) {
  const d = data || {};
  const o = {
    tipo: TIPOS.includes(d.tipo) ? d.tipo : '',
    numero: str(d.numero),
    fechaISO: str(d.fechaISO)
  };
  TEXTOS.forEach((k) => { o[k] = str(d[k]); });
  o.items = (Array.isArray(d.items) ? d.items : []).map((it) => {
    const x = it || {};
    const n = Number(x.cantidad);
    return { codigo: str(x.codigo), descripcion: str(x.descripcion), unidad: str(x.unidad),
             cantidad: Number.isFinite(n) ? n : 0 };
  });
  PERSONAS.forEach((k) => { o[k] = { nombre: str(d[k] && d[k].nombre), cedula: '' }; });
  o.conFirmas = d.conFirmas !== false;

  o.clave = str(id || d.clave);
  o.version = Number.isInteger(d.version) ? d.version : 0;
  o.creadoPor = autorDe(d.creadoPor);
  o.actualizadoPor = autorDe(d.actualizadoPor);
  o.creadoEn = aMilisegundos(d.creadoEn);
  o.actualizadoEn = aMilisegundos(d.actualizadoEn);
  o.migradaDe = str(d.migradaDe);
  o.elaboradaEn = str(d.elaboradaEn);
  o.guardadaEn = o.actualizadoEn ? new Date(o.actualizadoEn).toISOString() : '';
  return o;
}

/** ¿Viene del registro (tiene autoría y versión) o nació en un navegador? */
export function esDelRegistro(orden) {
  return !!(orden && orden.creadoPor && orden.creadoPor.uid && orden.version);
}

/** Llave con la que se marca una orden subida o descartada. Una orden sin
 *  clave válida (número vacío, sin tipo) se marca por su huella, para poder
 *  pedir que no se ofrezca más. */
export function llaveDeMarca(clave, h) {
  return clave || ('~' + h);
}

/**
 * Órdenes del navegador que PUEDEN ofrecerse para subir. Lo que ya estuvo en
 * el registro (trae autoría) nunca se ofrece: así una orden borrada no
 * resucita desde una copia. Tampoco lo ya subido o descartado con el MISMO
 * contenido. Si dos órdenes dan la misma clave gana la guardada más tarde y
 * las demás quedan como repetidas.
 *
 * @param {object[]} ordenes      legado + pendientes + archivo/copia
 * @param {object}   marcadas     { llave: huella } subidas o descartadas (ver `llaveDeMarca`)
 * @returns {{orden, clave, huella, problema}[]}
 */
export function candidatasDeSubida(ordenes, marcadas) {
  const marcas = marcadas || {};
  const porClave = new Map();
  const salida = [];
  const t = (o) => Date.parse((o && o.guardadaEn) || 0) || 0;

  (Array.isArray(ordenes) ? ordenes : []).forEach((orden) => {
    if (!orden || esDelRegistro(orden)) return;
    const problemas = problemasParaRegistro(orden);
    const clave = claveDe(orden.tipo, normalizarNumero(orden.numero));
    const h = huella(orden);
    if (marcas[llaveDeMarca(clave, h)] === h) return;
    const c = { orden, clave, huella: h, problema: problemas[0] || '' };
    if (!clave || problemas.length) { salida.push(c); return; }
    const ya = porClave.get(clave);
    if (!ya) { porClave.set(clave, c); return; }
    if (ya.huella === h) { if (t(orden) > t(ya.orden)) ya.orden = orden; return; }
    const [gana, pierde] = t(orden) > t(ya.orden) ? [c, ya] : [ya, c];
    pierde.problema = 'Hay otra orden con el mismo tipo y número en este navegador, guardada más tarde.';
    porClave.set(clave, gana);
    salida.push(pierde);
  });
  return Array.from(porClave.values()).concat(salida)
    .sort((a, b) => t(b.orden) - t(a.orden));
}

/**
 * Situación de una candidata frente al registro.
 * @param {{huella, problema}} c
 * @param {{existe:boolean, huella?:string, lapida?:object}} servidor
 * @returns {'invalida'|'nueva'|'igual'|'distinta'|'borrada'}
 */
export function situacionDeSubida(c, servidor) {
  if (!c || c.problema) return 'invalida';
  const s = servidor || {};
  if (s.existe) return s.huella === c.huella ? 'igual' : 'distinta';
  if (s.lapida) return 'borrada';
  return 'nueva';
}

/** Solo lo NUEVO se marca por defecto; lo que choca se decide a conciencia. */
export function seleccionadaPorDefecto(situacion) {
  return situacion === 'nueva';
}

/**
 * Siguiente número libre a partir de uno propuesto (`DDMMAAAA-01` →
 * `DDMMAAAA-02`…), sin importar el tipo: así no hay dos órdenes del mismo
 * día con el mismo número aunque una sea entrada y la otra salida.
 * @param {string} numero
 * @param {Iterable<string>} ocupados números ya normalizados
 */
export function siguienteNumeroLibre(numero, ocupados) {
  const usados = new Set(Array.from(ocupados || [], normalizarNumero));
  const base = normalizarNumero(numero);
  if (!usados.has(base)) return base;
  const m = base.match(/^(.*?)(\d+)$/);
  const prefijo = m ? m[1] : base + '-';
  const ancho = m ? m[2].length : 2;
  let n = m ? Number(m[2]) : 1;
  for (let i = 0; i < 10000; i++) {
    n += 1;
    const cand = prefijo + String(n).padStart(ancho, '0');
    if (cand.length > LIMITES.numero) break;
    if (!usados.has(cand)) return cand;
  }
  return '';
}
