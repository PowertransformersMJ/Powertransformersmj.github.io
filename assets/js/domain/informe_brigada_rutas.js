// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Informe de Mantenimiento Brigada (F60-ADM) · capa de datos PURA
// ──────────────────────────────────────────────────────────────────────────────
// Aquí vive lo que la capa de datos sabe SIN red ni pantalla, para que lo usen
// igual el repositorio de la nube (data/informes_brigada.js), el local
// (data/informes_brigada_local.js) y el almacén de imágenes
// (data/informes_brigada_almacen.js), y para probarlo con `node --test`:
//   · nombres de colecciones, rutas de Storage y de Firestore, ids;
//   · topes y tipos de archivo (los MISMOS números que firestore.rules y
//     storage.rules: una prueba los amarra leyendo las reglas);
//   · la configuración (editores por uid, contrato, almacén, firmantes, marca);
//   · los cambios de estado del informe (crear, guardar, corregir, emitir,
//     anular) con su control de concurrencia por `rev`. Las reglas vuelven a
//     exigir lo mismo: esto da el mensaje claro ANTES de que la base lo niegue.
//
// Nada de nombres de personas ni datos de cliente: los editores son uid y viven
// en el documento de configuración (decisión 3 del Ingeniero).
// ══════════════════════════════════════════════════════════════════════════════

import { tipoPorBytes } from './fichas_adjunto.js';
import { normalizarNombre } from './firmas.js';
// Archivo NUEVO (L-102): la actividad escrita a mano se normaliza y se valida igual que en las reglas.
import { normalizarActividad, errorActividad } from './informe_brigada_actividad.js';

// ── Identidad del esquema (las reglas las exigen con el texto exacto) ──────────
export const ESQUEMA = 'ibr@1';
export const MODELO_REFRIGERACION = 'F60-REFRIG@1';
/** Texto EXACTO de la lista de motivos (assets/js/ordenes-materiales.js:118). */
export const ACTIVIDAD_REFRIGERACION = 'Actualización y repotenciación del sistema de refrigeración.';
/** Modelos que hoy admite la base, con la actividad para la que se hizo. Solo refrigeración tiene modelo
 *  propio; desde 2026-10-26 cualquier otra actividad (de la lista o escrita a mano) usa también ese modelo. */
export const MODELOS_ADMITIDOS = Object.freeze({ [MODELO_REFRIGERACION]: ACTIVIDAD_REFRIGERACION });

// ── Colecciones de Firestore ───────────────────────────────────────────────────
export const COL = Object.freeze({
  informes: 'informes_brigada',
  versiones: 'versiones',
  archivos: 'archivos',
  config: 'informes_brigada_config',
  configId: 'general',
  fichas: 'informes_brigada_fichas',
  partes: 'partes',
  bin: 'informes_brigada_bin'
});

/** Adaptador de imágenes por defecto: Firestore. Decisión 5 (fotos guardadas con el informe) + su «procede» del 2026-10-14:
 *  en producción Storage niega las descargas al navegador (L-29, `99 §100`) y en esta Mac no hay gcloud/gsutil para su CORS. */
export const ALMACEN_POR_DEFECTO = 'firestore';
/** Los que acepta el documento de configuración (las reglas lo exigen). */
export const ALMACENES = Object.freeze(['storage', 'firestore']);
/** Las 5 piezas de la marca Applus/AFINIA del formato (se suben una vez; nunca al repo). */
export const CLAVES_MARCA = Object.freeze(['applus-encabezado', 'together-encabezado', 'applus-portada', 'together-portada', 'afinia-portada']);
export const ROLES_FIRMA = Object.freeze(['elaborado', 'revisado', 'aprobado']);

// ── Topes (mismos números que las reglas) ──────────────────────────────────────
export const TOPES = Object.freeze({
  archivo: 700 * 1024,          // foto o anexo del informe (Storage y Firestore)
  logo: 1024 * 1024,            // logo en Storage
  firma: 512 * 1024,            // firma de tercero en Storage
  ficha: 2 * 1024 * 1024,       // ficha de fabricante en Storage
  binFirestore: 900 * 1024,     // logo o firma guardados en Firestore
  fichaFirestore: 900 * 1024,   // ficha guardada en Firestore (partes/0)
  lado: 4000,                   // píxeles por lado como máximo
  contenido: 900 * 1024         // el informe en JSON (el documento de Firestore admite 1 MiB)
});

export const LIMITES = Object.freeze({
  editores: 10, firmantes: 20, contrato: 20, personas: 30, nombrePersona: 60, motivoMin: 10, motivoMax: 500,
  listado: 200, recientes: 100, deEquipo: 50, versiones: 50, fichas: 100, acciones: 5,
  matricula: 40, transformadorId: 128, nombreFirmante: 120, tituloFichaMin: 3, tituloFichaMax: 120
});

/** Tipos admitidos por clase de binario. */
export const MIMES = Object.freeze({
  archivo: Object.freeze(['image/jpeg', 'image/png']),
  logo: Object.freeze(['image/png', 'image/jpeg']),
  firma: Object.freeze(['image/png']),
  ficha: Object.freeze(['image/png', 'image/jpeg'])
});

// localStorage (modo local y respaldo ante un choque)
export const CLAVE_LOCAL = 'ssee.informe_brigada.local.v1';
export const CLAVE_RESPALDO = 'ssee.informe_brigada.respaldo.v1';

// ── Expresiones (las mismas de las reglas) ─────────────────────────────────────
const RE_HUELLA = /^[0-9a-f]{64}$/;
const RE_ARCHIVO = /^a[A-Za-z0-9]{20}$/;
const RE_INFORME = /^[A-Za-z0-9_-]{1,64}$/;
const RE_CLAVE_FIRMA = /^[a-z0-9-]{2,40}$/;
const RE_FICHA = /^[a-z0-9_-]{3,80}$/;
const RE_BIN = /^(logo|firma)_[a-z0-9-]{2,40}_[0-9a-f]{16}$/;
const RE_FECHA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export const esHuella = (h) => typeof h === 'string' && RE_HUELLA.test(h);
export const esIdArchivo = (a) => typeof a === 'string' && RE_ARCHIVO.test(a);
export const esIdInforme = (i) => typeof i === 'string' && RE_INFORME.test(i);
export const esIdFicha = (f) => typeof f === 'string' && RE_FICHA.test(f);
export const esIdBin = (b) => typeof b === 'string' && RE_BIN.test(b);
export const esClaveFirmante = (c) => typeof c === 'string' && RE_CLAVE_FIRMA.test(c) && c.startsWith('f-');

// ══════════════════════════════════════════════════════════════════════════════
// Errores con código (los dos repositorios hablan el mismo idioma)
// ══════════════════════════════════════════════════════════════════════════════

export const MENSAJES = Object.freeze({
  conflicto: 'Otra persona cambió este informe. Sus cambios quedan en este navegador: recargue para ver la versión nueva.',
  sin_permiso: 'No tiene permiso para esta acción. Solo los editores del informe lo arman y solo un administrador anula o configura.',
  no_existe: 'El informe no existe o fue retirado.',
  estado: 'El informe no está en un estado que permita esta acción.',
  red: 'Sin conexión con la plataforma. Revise la red e intente de nuevo.',
  validacion: 'Hay datos que no cumplen el formato.',
  desconocido: 'La plataforma respondió con un error que no se reconoce.'
});

export class ErrorIBR extends Error {
  /**
   * @param {'conflicto'|'sin_permiso'|'no_existe'|'estado'|'red'|'validacion'|'desconocido'} codigo
   * @param {string} [mensaje]
   * @param {unknown} [causa]
   */
  constructor(codigo, mensaje, causa) {
    super(mensaje || MENSAJES[codigo] || 'Error del informe.');
    this.name = 'ErrorIBR';
    this.codigo = codigo;
    if (causa !== undefined) this.causa = causa;
  }
}

/**
 * Traduce un error de Firebase (o cualquiera) a ErrorIBR. Un ErrorIBR pasa igual.
 * Solo lo que ES de red se llama «red» (la pantalla dice «Sin conexión» y reintenta sola); una falla
 * que no se reconoce es «desconocido": la pantalla la muestra una vez y no reintenta a ciegas.
 */
export function errorDesdeFirebase(e) {
  if (e instanceof ErrorIBR) return e;
  const c = String((e && e.code) || '').replace(/^(firestore|storage|auth)\//, '');
  if (c === 'permission-denied' || c === 'unauthorized' || c === 'unauthenticated') return new ErrorIBR('sin_permiso', undefined, e);
  if (c === 'not-found' || c === 'object-not-found') return new ErrorIBR('no_existe', undefined, e);
  if (c === 'aborted') return new ErrorIBR('conflicto', undefined, e);
  if (c === 'unavailable' || c === 'deadline-exceeded' || c === 'retry-limit-exceeded' || c === 'network-request-failed' || c === 'canceled' || c === 'cancelled') return new ErrorIBR('red', undefined, e);
  if (c === 'invalid-argument' || c === 'failed-precondition') return new ErrorIBR('validacion', 'La plataforma rechazó los datos: ' + ((e && e.message) || c), e);
  const msg = String((e && e.message) || e || '');
  // Sin código: un fallo de red del navegador (p. ej. el SDK no se pudo descargar) sí es «red».
  if (!c && /failed to fetch|networkerror|network error|load failed|offline|err_internet_disconnected/i.test(msg)) return new ErrorIBR('red', undefined, e);
  return new ErrorIBR('desconocido', 'No se pudo completar la operación: ' + (msg || c || 'error sin detalle'), e);
}

/** ¿El error es «la regla no lo deja» (reglas sin publicar o sin permiso)? */
export const esSinPermiso = (e) => /permission-denied|unauthorized/.test(String((e && e.code) || ''));

// ══════════════════════════════════════════════════════════════════════════════
// Ids y rutas
// ══════════════════════════════════════════════════════════════════════════════

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** n caracteres [A-Za-z0-9] con crypto.getRandomValues (sin sesgo: descarta ≥ 248). */
export function idAleatorio(n = 20) {
  let s = '';
  const buf = new Uint8Array(Math.max(16, n * 2));
  while (s.length < n) {
    globalThis.crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < 248) s += ALFABETO[b % 62];
      if (s.length === n) break;
    }
  }
  return s;
}

/** Id de una foto o anexo del informe: 'a' + 20 [A-Za-z0-9] (la regla lo exige). */
export const nuevoIdArchivo = () => 'a' + idAleatorio(20);
/** Id de un informe en modo local. */
export const nuevoIdLocal = () => 'local-' + idAleatorio(16);

function exigir(cond, mensaje) { if (!cond) throw new ErrorIBR('validacion', mensaje); }

/** Ruta de una foto o anexo (la MISMA en Storage y en Firestore). */
export function rutaArchivo(informeId, archivoId) {
  exigir(esIdInforme(informeId), 'Identificador de informe inválido.');
  exigir(esIdArchivo(archivoId), 'Identificador de archivo inválido.');
  return `${COL.informes}/${informeId}/${COL.archivos}/${archivoId}`;
}

/** Storage: logo de marca, inmutable (reemplazar = huella nueva). */
export function rutaLogo(clave, huella) {
  exigir(CLAVES_MARCA.includes(clave), 'Clave de logo desconocida.');
  exigir(esHuella(huella), 'Huella inválida.');
  return `informes_brigada_marca/logos/${clave}/${huella}`;
}

/** Storage: firma de un tercero (solo la leen los editores). */
export function rutaFirma(clave, huella) {
  exigir(RE_CLAVE_FIRMA.test(String(clave)), 'Clave de firmante inválida.');
  exigir(esHuella(huella), 'Huella inválida.');
  return `informes_brigada_marca/firmas/${clave}/${huella}`;
}

/** Storage: ficha técnica de fabricante (biblioteca compartida). */
export function rutaFicha(fichaId) {
  exigir(esIdFicha(fichaId), 'Identificador de ficha inválido.');
  return `informes_brigada_marca/fichas/${fichaId}`;
}

/** Firestore (contingencia): bytes de una ficha, aparte de su meta para que listar no los baje. */
export function rutaParteFicha(fichaId) {
  exigir(esIdFicha(fichaId), 'Identificador de ficha inválido.');
  return `${COL.fichas}/${fichaId}/${COL.partes}/0`;
}

/** Firestore (contingencia): documento con los bytes de un logo o una firma. */
export function idBin(clase, clave, huella) {
  exigir(clase === 'logo' || clase === 'firma', 'Clase de binario inválida.');
  exigir(esHuella(huella), 'Huella inválida.');
  if (clase === 'logo') exigir(CLAVES_MARCA.includes(clave), 'Clave de logo desconocida.');
  const id = `${clase}_${clave}_${huella.slice(0, 16)}`;
  exigir(esIdBin(id), 'Clave inválida para guardar la imagen.');
  return id;
}
export const rutaBin = (id) => { exigir(esIdBin(id), 'Identificador inválido.'); return `${COL.bin}/${id}`; };

/** Texto → 'a-b-c' sin tildes, en minúscula, solo [a-z0-9-]. */
export function slug(texto, max = 40) {
  const s = String(texto == null ? '' : texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/g, '');
}

/** Id de una ficha de la biblioteca: 'ficha_<marca>_<modelo>_<8 hex>' (≤ 80). */
export function idFicha(marca, modelo, huella) {
  exigir(esHuella(huella), 'Huella inválida.');
  const id = `ficha_${slug(marca, 30) || 'x'}_${slug(modelo, 30) || 'x'}_${huella.slice(0, 8)}`;
  exigir(esIdFicha(id), 'No se pudo formar el identificador de la ficha.');
  return id;
}

/** Clave de un firmante: 'f-' + nombre sin tildes (≤ 40). Nunca se escribe en el código: sale del nombre que da el admin. */
export function claveFirmante(nombre) {
  const s = slug(nombre, 38);
  return 'f-' + (s || 'sin-nombre');
}

/** ¿La ruta es de una firma? (esas NUNCA salen por URL con token: data/firmas.js:13). */
export function esRutaFirma(ruta) {
  const r = String(ruta || '');
  return r.startsWith('informes_brigada_marca/firmas/') || r.startsWith(COL.bin + '/firma_');
}

/**
 * ¿Esa ruta puede servir para ese tipo de recurso? Cierra el atajo de apuntar
 * la «foto» de un borrador a la ruta de una FIRMA (las firmas solo salen de
 * una versión EMITIDA, decisión 4) o a cualquier otra carpeta.
 * @param {string} ref  'archivo:<id>' | 'ficha:<clave>' | 'marca:<clave>' | 'firma:<rol>'
 */
export function rutaAdmitidaPara(ref, ruta) {
  const tipo = String(ref || '').split(':')[0];
  const r = String(ruta || '');
  if (tipo === 'archivo') return /^informes_brigada\/[A-Za-z0-9_-]{1,64}\/archivos\/a[A-Za-z0-9]{20}$/.test(r);
  if (tipo === 'ficha') return /^informes_brigada_marca\/fichas\/[a-z0-9_-]{3,80}$/.test(r) || /^informes_brigada_fichas\/[a-z0-9_-]{3,80}\/partes\/0$/.test(r);
  if (tipo === 'marca') return /^informes_brigada_marca\/logos\/[a-z-]+\/[0-9a-f]{64}$/.test(r) || /^informes_brigada_bin\/logo_[a-z0-9-]{2,40}_[0-9a-f]{16}$/.test(r);
  if (tipo === 'firma') return /^informes_brigada_marca\/firmas\/[a-z0-9-]{2,40}\/[0-9a-f]{64}$/.test(r) || /^informes_brigada_bin\/firma_[a-z0-9-]{2,40}_[0-9a-f]{16}$/.test(r);
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// Binarios: validación (lo mismo que las reglas, con mensaje en español)
// ══════════════════════════════════════════════════════════════════════════════

/** Tope de bytes de una clase según dónde se guarda. */
export function topeDe(clase, almacen = ALMACEN_POR_DEFECTO) {
  if (clase === 'archivo') return TOPES.archivo;
  if (almacen === 'firestore') return clase === 'ficha' ? TOPES.fichaFirestore : TOPES.binFirestore;
  return TOPES[clase] || 0;
}

const kb = (n) => Math.round(n / 1024).toLocaleString('es-CO') + ' KB';

/**
 * Revisa la meta de un binario antes de subirlo.
 * @param {'archivo'|'logo'|'firma'|'ficha'} clase
 * @param {{mime:string, tamano:number, ancho:number, alto:number, huella:string}} meta
 * @param {string} [almacen]
 * @returns {string[]} errores (vacío = sirve)
 */
export function validarBinario(clase, meta, almacen = ALMACEN_POR_DEFECTO) {
  const e = [];
  const m = meta || {};
  if (!MIMES[clase]) return ['Clase de archivo desconocida.'];
  if (!MIMES[clase].includes(m.mime)) {
    e.push(clase === 'firma' ? 'La firma debe ser PNG (conserva el fondo transparente).' : 'Solo se admiten imágenes JPG o PNG.');
  }
  const tope = topeDe(clase, almacen);
  if (!Number.isInteger(m.tamano) || m.tamano < 1) e.push('El archivo está vacío.');
  else if (m.tamano > tope) e.push(`La imagen pesa ${kb(m.tamano)}; el máximo aquí es ${kb(tope)}.`);
  for (const lado of ['ancho', 'alto']) {
    if (!Number.isInteger(m[lado]) || m[lado] < 1 || m[lado] > TOPES.lado) { e.push(`Medida de la imagen inválida (${lado}).`); break; }
  }
  if (!esHuella(m.huella)) e.push('Falta la huella de la imagen.');
  return e;
}

/** MIME real por los primeros bytes (nunca por la extensión). */
export function mimePorBytes(bytes) {
  const t = tipoPorBytes(bytes);
  return t === 'jpeg' ? 'image/jpeg' : t === 'png' ? 'image/png' : null;
}

/**
 * ¿El JPEG trae metadatos de cámara? Recorre los segmentos hasta la imagen
 * (SOS) y busca un APP1 (Exif o XMP: ahí viajan la ubicación GPS y el modelo
 * del teléfono). Al redibujar por lienzo desaparecen; esto lo COMPRUEBA antes
 * de subir (decisión 5). Un JPEG ilegible cuenta como «con metadatos».
 */
export function jpegConMetadatos(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return true;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xFF) return true;                       // estructura rota
    const marca = b[i + 1];
    if (marca === 0xFF) { i += 1; continue; }             // relleno
    if (marca === 0xDA || marca === 0xD9) return false;   // empieza la imagen o termina
    if (marca >= 0xD0 && marca <= 0xD7) { i += 2; continue; }
    const largo = (b[i + 2] << 8) | b[i + 3];
    if (largo < 2) return true;
    if (marca === 0xE1) return true;                      // APP1: Exif o XMP
    i += 2 + largo;
  }
  return true;                                            // nunca llegó a la imagen: ilegible
}

/** ¿El PNG trae metadatos de cámara? (bloque eXIf o XMP en iTXt). */
export function pngConMetadatos(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length < 8) return true;
  let i = 8;
  while (i + 8 <= b.length) {
    const largo = ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (tipo === 'eXIf') return true;
    if (tipo === 'iTXt') {
      const cab = String.fromCharCode(...b.subarray(i + 8, Math.min(i + 8 + 17, b.length)));
      if (cab.startsWith('XML:com.adobe.xmp')) return true;
    }
    if (tipo === 'IEND') return false;
    i += 12 + largo;
  }
  return false;
}

/** ¿La imagen trae metadatos de cámara (GPS, modelo)? Según su tipo real. */
export function imagenConMetadatos(bytes) {
  const mime = mimePorBytes(bytes);
  if (mime === 'image/jpeg') return jpegConMetadatos(bytes);
  if (mime === 'image/png') return pngConMetadatos(bytes);
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// Configuración (informes_brigada_config/general)
// ══════════════════════════════════════════════════════════════════════════════

const str = (v) => (v == null ? '' : String(v));
const entero = (v) => (Number.isInteger(v) ? v : (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0));

/** Meta de un binario guardado: { almacen, ruta, huella, mime, ancho, alto } (+ extras permitidos). */
export function metaBinaria(m, extras = []) {
  if (!m || typeof m !== 'object' || !m.ruta) return null;
  const out = {
    almacen: str(m.almacen) || ALMACEN_POR_DEFECTO,
    ruta: str(m.ruta),
    huella: str(m.huella),
    mime: str(m.mime),
    ancho: entero(m.ancho),
    alto: entero(m.alto)
  };
  for (const k of extras) if (m[k] !== undefined) out[k] = m[k];
  return out;
}

function firmanteNormal(f) {
  if (!f || typeof f !== 'object') return null;
  const nombre = str(f.nombre).trim().toLocaleUpperCase('es-CO');
  const clave = esClaveFirmante(f.clave) ? f.clave : claveFirmante(nombre);
  let firma = null;
  if (f.firma && f.firma.ruta) {
    firma = metaBinaria(f.firma);
    const a = f.firma.autorizacion || {};
    firma.autorizacion = { fecha: str(a.fecha), medio: str(a.medio) };
  }
  // Línea de la portada que ocupa por defecto en cada informe NUEVO (2026-10-16, dictado por el Ingeniero); se puede cambiar.
  const rol = ['elaborado', 'revisado', 'aprobado'].includes(f.rol) ? f.rol : '';
  return { clave, nombre, cargo: str(f.cargo).trim(), rol, firma };
}

/**
 * La configuración tal como la usa la pantalla, con valores por defecto.
 * Nunca trae nombres en el código: los editores son uid escogidos por el admin.
 */
/** Nombres del personal: texto recortado, sin vacíos ni repetidos (la comparación ignora mayúsculas y tildes). */
function listaPersonas(v) {
  const vistos = new Set();
  const out = [];
  for (const x of (Array.isArray(v) ? v : [])) {
    const n = str(x).replace(/\s+/g, ' ').trim();
    const k = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!n || vistos.has(k)) continue;
    vistos.add(k);
    out.push(n);
  }
  return out;
}

export function normalizarConfig(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const editores = [...new Set((Array.isArray(d.editores) ? d.editores : []).map(str).filter(Boolean))];
  const marca = {};
  for (const k of CLAVES_MARCA) marca[k] = metaBinaria(d.marca && d.marca[k]);
  return {
    editores,
    contrato_defecto: str(d.contrato_defecto).trim(),
    almacen: ALMACENES.includes(d.almacen) || d.almacen === 'local' ? d.almacen : ALMACEN_POR_DEFECTO,
    firmantes: (Array.isArray(d.firmantes) ? d.firmantes : []).map(firmanteNormal).filter(Boolean),
    // Personal del informe (2026-10-15, dictado por el Ingeniero): listas desplegables de 2.2. Viven en la base, nunca en el código.
    ingenieros: listaPersonas(d.ingenieros),
    tecnicos: listaPersonas(d.tecnicos),
    marca,
    actualizadoPor: d.actualizadoPor && d.actualizadoPor.uid ? { uid: str(d.actualizadoPor.uid), nombre: str(d.actualizadoPor.nombre) } : null,
    actualizadoEn: aIso(d.actualizadoEn)
  };
}

/** Config base de la vista previa local: quien tiene la sesión es el editor. */
export function configDePrueba(uid) {
  return { ...normalizarConfig({ editores: uid ? [uid] : [] }), almacen: 'local' };
}

/**
 * Lo que se escribe en Firestore (sin sello: el repositorio pone actualizadoPor/En).
 * @returns {{payload: object, errores: string[]}}
 */
export function configParaGuardar(config) {
  const c = normalizarConfig(config);
  const errores = [];
  if (c.editores.length > LIMITES.editores) errores.push(`Máximo ${LIMITES.editores} editores.`);
  if (c.contrato_defecto.length > LIMITES.contrato) errores.push(`El contrato admite máximo ${LIMITES.contrato} caracteres.`);
  if (!ALMACENES.includes(c.almacen)) errores.push('El almacén debe ser Storage o Firestore.');
  if (c.firmantes.length > LIMITES.firmantes) errores.push(`Máximo ${LIMITES.firmantes} firmantes.`);
  for (const [k, nombre] of [['ingenieros', 'ingenieros'], ['tecnicos', 'técnicos']]) {
    if (c[k].length > LIMITES.personas) errores.push(`Máximo ${LIMITES.personas} ${nombre}.`);
    if (c[k].some((n) => n.length > LIMITES.nombrePersona)) errores.push(`Hay un nombre de ${nombre} demasiado largo (máximo ${LIMITES.nombrePersona}).`);
  }
  const claves = new Set();
  for (const f of c.firmantes) {
    if (!f.nombre) errores.push('Hay un firmante sin nombre.');
    if (f.nombre.length > LIMITES.nombreFirmante) errores.push('Nombre de firmante demasiado largo.');
    if (claves.has(f.clave)) errores.push('Dos firmantes con la misma clave: ' + f.clave + '.');
    claves.add(f.clave);
    if (f.firma) {
      if (!esHuella(f.firma.huella)) errores.push('La firma de ' + f.nombre + ' no tiene huella.');
      if (!RE_FECHA.test(f.firma.autorizacion.fecha) || f.firma.autorizacion.medio.trim().length < 3) {
        errores.push('La firma de ' + f.nombre + ' necesita la fecha y el medio de la autorización del titular.');
      }
    }
  }
  const payload = {
    editores: c.editores,
    contrato_defecto: c.contrato_defecto,
    almacen: c.almacen,
    firmantes: c.firmantes,
    ingenieros: c.ingenieros,
    tecnicos: c.tecnicos,
    marca: c.marca
  };
  return { payload, errores };
}

/** ¿Este uid arma informes? (lista de uid de la configuración). */
export function esEditorDe(config, uid) {
  return !!uid && !!config && Array.isArray(config.editores) && config.editores.includes(uid);
}

// ══════════════════════════════════════════════════════════════════════════════
// Documentos: fechas, forma y transformaciones
// ══════════════════════════════════════════════════════════════════════════════

/** Timestamp de Firestore, Date, {seconds} o texto → ISO (o null). */
export function aIso(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') return v;
  try {
    if (v instanceof Date) return isNaN(v) ? null : v.toISOString();
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)).toISOString();
  } catch (_) { /* fecha ilegible */ }
  return null;
}

const autorDe = (p) => (p && p.uid ? { uid: str(p.uid), nombre: str(p.nombre) } : null);

/** Documento de Firestore → InformeDoc (fechas ISO, con id). */
export function documentoAInforme(id, d) {
  const x = d || {};
  const out = {
    id,
    esquema: str(x.esquema),
    modelo: str(x.modelo),
    actividad: str(x.actividad),
    equipo_ref: normalizarEquipoRef(x.equipo_ref).equipo_ref,
    estado: str(x.estado) || 'borrador',
    version: entero(x.version),
    rev: entero(x.rev),
    contenido: x.contenido && typeof x.contenido === 'object' ? x.contenido : {},
    anulacion: x.anulacion ? { motivo: str(x.anulacion.motivo), por: autorDe(x.anulacion.por), en: aIso(x.anulacion.en) } : null,
    creadoPor: autorDe(x.creadoPor),
    creadoEn: aIso(x.creadoEn),
    actualizadoPor: autorDe(x.actualizadoPor),
    actualizadoEn: aIso(x.actualizadoEn)
  };
  if (x.emitidoPor) out.emitidoPor = autorDe(x.emitidoPor);
  if (x.emitidoEn) out.emitidoEn = aIso(x.emitidoEn);
  return out;
}

/** Documento de versiones/{n} → VersionDoc. */
export function documentoAVersion(id, d) {
  const x = d || {};
  return {
    id: String(id),
    version: entero(x.version),
    contenido: x.contenido && typeof x.contenido === 'object' ? x.contenido : {},
    huella: str(x.huella),
    motivo: str(x.motivo),
    firmas: Array.isArray(x.firmas) ? x.firmas : [],
    marca: x.marca && typeof x.marca === 'object' ? x.marca : {},
    emitidoPor: autorDe(x.emitidoPor),
    en: aIso(x.en)
  };
}

/** Ficha de la biblioteca → FichaDoc (los bytes nunca viajan aquí). */
export function documentoAFicha(id, d) {
  const x = d || {};
  return {
    id,
    titulo: str(x.titulo), marca: str(x.marca), modelo: str(x.modelo),
    almacen: str(x.almacen) || ALMACEN_POR_DEFECTO, ruta: str(x.ruta),
    mime: str(x.mime), ancho: entero(x.ancho), alto: entero(x.alto),
    tamano: entero(x.tamano), huella: str(x.huella),
    subidoPor: autorDe(x.subidoPor), en: aIso(x.en)
  };
}

/** La identidad del equipo en el informe (no cambia nunca después de crear). */
export function normalizarEquipoRef(e) {
  const x = e && typeof e === 'object' ? e : {};
  const equipo_ref = {
    transformador_id: str(x.transformador_id).trim(),
    matricula: str(x.matricula).trim(),
    subestacion: str(x.subestacion).trim(),
    serie: str(x.serie).trim()
  };
  const errores = [];
  if (!equipo_ref.matricula) errores.push('Falta la matrícula del transformador.');
  if (equipo_ref.matricula.length > LIMITES.matricula) errores.push('Matrícula demasiado larga.');
  if (equipo_ref.transformador_id.length > LIMITES.transformadorId) errores.push('Identificador del transformador demasiado largo.');
  return { equipo_ref, errores };
}

/** Acción de refrigeración → lo justo para llenar ventiladores (la acción NO se toca). */
export function resumenAccion(a) {
  const x = a || {};
  const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    id: str(x.id),
    fecha_accion: str(x.fecha_accion),
    estado_accion: str(x.estado_accion),
    accion_descripcion: str(x.accion_descripcion),
    kva_onan: num(x.kva_onan),
    kva_onaf: num(x.kva_onaf),
    mix: (Array.isArray(x.mix) ? x.mix : []).map((m) => ({
      marca: str(m && m.marca), modelo: str(m && m.modelo),
      cfm_unitario: num(m && m.cfm_unitario), cantidad: num(m && m.cantidad)
    }))
  };
}

/** Más reciente primero (por actualizadoEn ISO). */
export function ordenarPorActualizado(lista) {
  return [...(lista || [])].sort((a, b) => String(b.actualizadoEn || '').localeCompare(String(a.actualizadoEn || '')));
}

// ── Contenido: que Firestore lo acepte ─────────────────────────────────────────

/** ¿Hay una lista directamente dentro de otra? (Firestore no lo admite, L-30). */
export function hayListaEnLista(v, dentroDeLista = false) {
  if (Array.isArray(v)) {
    if (dentroDeLista) return true;
    return v.some((x) => hayListaEnLista(x, true));
  }
  if (v && typeof v === 'object') return Object.values(v).some((x) => hayListaEnLista(x, false));
  return false;
}

/** Bytes del valor en JSON (UTF-8). */
export const tamanoJson = (v) => new TextEncoder().encode(JSON.stringify(v)).length;

/**
 * Copia limpia del contenido para escribirlo: JSON puro (sin undefined, Date ni
 * funciones), sin listas dentro de listas y por debajo del tope del documento.
 */
export function prepararContenido(contenido) {
  if (!contenido || typeof contenido !== 'object' || Array.isArray(contenido)) {
    throw new ErrorIBR('validacion', 'El contenido del informe está vacío o mal formado.');
  }
  let c;
  try { c = JSON.parse(JSON.stringify(contenido)); } catch (_) {
    throw new ErrorIBR('validacion', 'El contenido del informe no se puede guardar (tiene datos que no son texto ni números).');
  }
  if (hayListaEnLista(c)) throw new ErrorIBR('validacion', 'El contenido tiene una lista dentro de otra; la base no lo admite.');
  const n = tamanoJson(c);
  if (n > TOPES.contenido) throw new ErrorIBR('validacion', `El informe ocupa ${kb(n)} de texto; el máximo es ${kb(TOPES.contenido)}. Las fotos van aparte: revise textos pegados.`);
  return c;
}

/** Motivo de una emisión: libre en la v1; desde la v2, 10 caracteres o más. */
export function errorMotivo(version, motivo) {
  const m = str(motivo).trim();
  if (m.length > LIMITES.motivoMax) return `El motivo admite máximo ${LIMITES.motivoMax} caracteres.`;
  if (version > 1 && m.length < LIMITES.motivoMin) return `Desde la versión 2, escriba el motivo de la nueva versión (${LIMITES.motivoMin} caracteres o más).`;
  return null;
}

/**
 * Las firmas que se ESTAMPAN al emitir (decisión 4): por cada línea
 * (Elaborado / Revisado / Aprobado) cuyo firmante escogido tiene firma
 * registrada en la configuración Y cuyo nombre escrito es el de ese firmante.
 * Si alguien cambió el nombre a mano, esa línea sale sin firma.
 * @returns {{rol, clave, nombre, firma}[]}
 */
export function firmasParaEmitir(contenido, config) {
  const lineas = (contenido && contenido.firmas) || {};
  const firmantes = (config && Array.isArray(config.firmantes)) ? config.firmantes : [];
  const out = [];
  for (const rol of ROLES_FIRMA) {
    const l = lineas[rol];
    if (!l || !l.firmante) continue;
    const f = firmantes.find((x) => x && x.clave === l.firmante);
    if (!f || !f.firma || !esHuella(f.firma.huella)) continue;
    if (normalizarNombre(l.nombre) !== normalizarNombre(f.nombre)) continue;
    out.push({ rol, clave: f.clave, nombre: str(f.nombre), firma: metaBinaria(f.firma) });
  }
  return out;
}

function firmasDeEmision(firmas, contenido) {
  const lista = Array.isArray(firmas) ? firmas : [];
  if (lista.length > ROLES_FIRMA.length) throw new ErrorIBR('validacion', 'Máximo 3 firmas por versión.');
  const lineas = (contenido && contenido.firmas) || {};
  const vistos = new Set();
  return lista.map((f) => {
    const x = f || {};
    if (!ROLES_FIRMA.includes(x.rol)) throw new ErrorIBR('validacion', 'Rol de firma desconocido.');
    if (vistos.has(x.rol)) throw new ErrorIBR('validacion', 'Dos firmas para la misma línea.');
    vistos.add(x.rol);
    const firma = metaBinaria(x.firma);
    if (!firma || !esHuella(firma.huella) || !esRutaFirma(firma.ruta)) throw new ErrorIBR('validacion', 'La firma de «' + str(x.nombre) + '» no tiene imagen registrada.');
    const l = lineas[x.rol] || {};
    if (l.firmante !== x.clave || normalizarNombre(l.nombre) !== normalizarNombre(x.nombre)) {
      throw new ErrorIBR('validacion', 'La firma de «' + str(x.nombre) + '» no corresponde al nombre escrito en la línea «' + x.rol + '».');
    }
    return { rol: x.rol, clave: str(x.clave), nombre: str(x.nombre), firma };
  });
}

function marcaDeEmision(marca) {
  const out = {};
  for (const k of CLAVES_MARCA) out[k] = metaBinaria(marca && marca[k]);
  return out;
}

// ══════════════════════════════════════════════════════════════════════════════
// Cambios de estado (los dos repositorios aplican EXACTAMENTE esto; las reglas
// de firestore.rules lo vuelven a exigir del lado del servidor)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Datos de un informe nuevo (sin sellos de autor ni fechas).
 * La actividad se escoge de la lista de motivos o se escribe a mano (pedido del Ingeniero,
 * 2026-10-26): se guarda normalizada (`informe_brigada_actividad.js`) y con el único modelo
 * que existe. Las reglas (`ibrActividad`) vuelven a exigir lo mismo.
 * @returns {object} esquema, modelo, actividad, equipo_ref, estado, version, rev, contenido, anulacion
 */
export function planCrear({ equipo_ref, actividad, modelo, contenido } = {}) {
  const mod = modelo || MODELO_REFRIGERACION;
  if (!MODELOS_ADMITIDOS[mod]) throw new ErrorIBR('validacion', 'Ese modelo de informe todavía no existe.');
  const errAct = errorActividad(actividad);
  if (errAct) throw new ErrorIBR('validacion', errAct);
  const act = normalizarActividad(actividad);
  const { equipo_ref: er, errores } = normalizarEquipoRef(equipo_ref);
  if (errores.length) throw new ErrorIBR('validacion', errores.join(' '));
  return {
    esquema: ESQUEMA, modelo: mod, actividad: act, equipo_ref: er,
    estado: 'borrador', version: 0, rev: 1,
    contenido: prepararContenido(contenido),
    anulacion: null
  };
}

function exigirVigente(actual, revEsperada) {
  if (!actual) throw new ErrorIBR('no_existe');
  if (actual.estado === 'anulado') throw new ErrorIBR('estado', 'El informe está anulado: ya no se modifica.');
  if (!Number.isInteger(revEsperada) || actual.rev !== revEsperada) throw new ErrorIBR('conflicto');
}

/** Guardar el borrador: mismo estado, rev + 1. */
export function planGuardar(actual, { contenido, revEsperada } = {}) {
  exigirVigente(actual, revEsperada);
  if (actual.estado !== 'borrador') throw new ErrorIBR('estado', 'El informe está emitido: use «Corregir» para volver a borrador.');
  return { contenido: prepararContenido(contenido), rev: actual.rev + 1 };
}

/** Corregir un emitido: vuelve a borrador, MISMO contenido y versión. */
export function planCorregir(actual, { revEsperada } = {}) {
  exigirVigente(actual, revEsperada);
  if (actual.estado !== 'emitido') throw new ErrorIBR('estado', 'Solo se corrige un informe emitido.');
  return { estado: 'borrador', rev: actual.rev + 1 };
}

/**
 * Emitir: versión + 1 y su copia congelada (misma escritura).
 * @returns {{informe: {estado, version, rev, contenido}, version: {version, contenido, huella, motivo, firmas, marca}}}
 */
export function planEmitir(actual, { contenido, revEsperada, motivo = '', firmas = [], marca = {}, huella } = {}) {
  exigirVigente(actual, revEsperada);
  if (actual.estado !== 'borrador') throw new ErrorIBR('estado', 'Solo se emite un borrador.');
  const n = actual.version + 1;
  const err = errorMotivo(n, motivo);
  if (err) throw new ErrorIBR('validacion', err);
  if (!esHuella(huella)) throw new ErrorIBR('validacion', 'Falta la huella del contenido emitido.');
  const c = prepararContenido(contenido);
  return {
    informe: { estado: 'emitido', version: n, rev: actual.rev + 1, contenido: c },
    version: { version: n, contenido: c, huella, motivo: str(motivo).trim(), firmas: firmasDeEmision(firmas, c), marca: marcaDeEmision(marca) }
  };
}

/** Anular (solo administrador): el contenido no cambia; queda congelado. */
export function planAnular(actual, { revEsperada, motivo } = {}) {
  exigirVigente(actual, revEsperada);
  const m = str(motivo).trim();
  if (m.length < LIMITES.motivoMin || m.length > LIMITES.motivoMax) {
    throw new ErrorIBR('validacion', `Escriba el motivo de la anulación (${LIMITES.motivoMin} a ${LIMITES.motivoMax} caracteres).`);
  }
  return { estado: 'anulado', rev: actual.rev + 1, anulacion: { motivo: m } };
}

/** Topes de consulta: nunca más de lo que la regla deja pedir. */
export const topeConsulta = (pedido, porDefecto, maximo) => {
  const n = Number.isInteger(pedido) && pedido > 0 ? pedido : porDefecto;
  return Math.min(n, maximo);
};
