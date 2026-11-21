// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · rutas, estados, roles y topes (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Lo que la capa de datos y la página saben SIN red ni pantalla (molde:
// informe_brigada_rutas.js). Los MISMOS nombres y números que el bloque
// `odt_afinia` de firestore.rules: una prueba los amarra leyendo las reglas
// cuando el bloque exista (tests/odt_afinia_rutas.test.js).
//
// Diseño: bóveda `research-archive/2026-11-20-odt-firmas/DISENO-FINAL.md` §2-§4.
// Repo PÚBLICO: aquí no hay uids, correos, nombres ni N.º de ODT reales (P5).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

// ── Colecciones de Firestore (§2) ──────────────────────────────────────────────
export const COL = Object.freeze({
  odt: 'odt_afinia',                    // odt_afinia/{odtId}
  partes: 'partes',                     // odt_afinia/{odtId}/partes/{i}
  actos: 'actos',                       // odt_afinia/{odtId}/actos/{rol}
  devoluciones: 'devoluciones',         // odt_afinia/{odtId}/devoluciones/{auto}
  firmantes: 'odt_afinia_firmantes',    // habilitación: odt_afinia_firmantes/{uid}
  nro: 'odt_afinia_nro',                // candado de unicidad: odt_afinia_nro/{nro}
  descargas: 'odt_afinia_descargas',    // registro de descargas
  firmaPropia: 'firmas'                 // firmas/{uid}: la firma PROPIA (nunca firmas_equipo ni delegadas, P1)
});

/**
 * Lista blanca de firmantes por rol: odt_afinia_config/firmantes = {azt:[uid], responsable:[uid]}.
 * Solo la escribe la consola de Firebase (la regla: write false); la lee el admin al publicar.
 * Va APARTE de COL a propósito: COL lo fija otra prueba (tests/odt_afinia_rutas.test.js).
 */
export const CONFIG_FIRMANTES = Object.freeze({ col: 'odt_afinia_config', doc: 'firmantes' });

// ── Estados y roles ────────────────────────────────────────────────────────────
// CERRADA y REEMPLAZADA (decisiones del 2026-11-21) se AGREGAN al final: cambio compatible
// (un consumidor viejo no las nombra). Los consumidores nuevos las leen de
// odt_afinia_cierre.js (archivo nuevo, L-102), por si este archivo quedó viejo en la caché.
export const ESTADOS = Object.freeze({
  PENDIENTE_AZT: 'PENDIENTE_AZT',
  PENDIENTE_RESPONSABLE: 'PENDIENTE_RESPONSABLE',
  LISTA: 'LISTA',
  ANULADA: 'ANULADA',
  CERRADA: 'CERRADA',            // el admin registró el cierre en Afinia (final)
  REEMPLAZADA: 'REEMPLAZADA'     // el admin la reemplazó desde LISTA; su N.º se puede volver a publicar (final)
});
export const LISTA_ESTADOS = Object.freeze(Object.values(ESTADOS));

/** Orden de firma (D2): primero el AZT, luego el Responsable. */
export const ROLES = Object.freeze(['azt', 'responsable']);

/** Lo que dice el papel en cada casilla (etiquetas impresas en la última página). */
export const ETIQUETA_ROL = Object.freeze({ azt: 'AZT EN SITIO', responsable: 'RESPONSABLE O.D.T.' });

// ── Versiones (las reglas comparan estas cadenas EXACTAS) ──────────────────────
export const VERSIONES = Object.freeze({
  acuerdo: 'odt-acuerdo-v1',
  azt: 'odt-azt-v1',
  responsable: 'odt-resp-v1'
});
/**
 * Identidad del compositor de los actos NUEVOS: si cambia cómo se arma el PDF, cambia esta cadena.
 * 'odt-afinia@2' (2026-11-21): además estampa el N.º en «ODT GENERADA N°». Los actos firmados con
 * 'odt-afinia@1' se siguen recomponiendo igual (odt_afinia_cierre.versionDeComposicion).
 * L-102: lo que se ESCRIBE en un acto nuevo sale de odt_afinia_cierre.COMPOSITOR_VIGENTE (archivo nuevo); aquí
 * solo lo compara preparar.js (control de que llegó la misma entrega). Un armador viejo de la caché que lea
 * esta cadena escribe '@2' sin `generada` en el cierre del Responsable, y la regla lo niega.
 */
export const COMPOSITOR = 'odt-afinia@2';
export const PROVEEDOR = 'password';

// ── Topes (mismos números que las reglas) ──────────────────────────────────────
export const TOPES = Object.freeze({
  parte: 900 * 1024,          // bytes por parte (cabe en un documento de 1 MiB)
  partesMax: 5,               // partes como máximo por ODT (lote ≈ 4,5 MB < 10 MiB por petición)
  imagenFirma: 900 * 1024,    // la imagen de firmas/{uid} (la regla de firmas admite 900 KB)
  imagenesPorOdt: 2,          // AZT + Responsable
  motivoMin: 10,
  motivoMax: 500,
  listado: 50,                // list de odt: limit <= 50
  actos: 2,                   // list de actos: limit <= 2
  reautenticacionMs: 300000,  // 5 min entre la contraseña y la HABILITACIÓN (odtReauth; ms enteros, L-129). Firmar y Publicar ya no lo usan (2026-11-21)
  paginas: 2                  // la ODT tiene exactamente 2 páginas («revisé las dos páginas»)
});

// ── pdf-lib vendorizado (fijado por versión y huella; una prueba lo amarra) ────
export const PDF_LIB = Object.freeze({
  version: '1.17.1',
  ruta: 'assets/vendor/pdf-lib-1.17.1.esm.min.js',
  sha256: '72c052d97b4d5d9fa6cdbdcb7ad709f03d4ddb1122390cb3afeba4d88651d969'
});

// ── Expresiones (las mismas de las reglas) ─────────────────────────────────────
const RE_NRO = /^[0-9]{8}$/;
const RE_HUELLA = /^[0-9a-f]{64}$/;
const RE_FECHA_DMA = /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/;

export const esNro = (n) => typeof n === 'string' && RE_NRO.test(n);
export const esHuella = (h) => typeof h === 'string' && RE_HUELLA.test(h);
export const esRol = (r) => typeof r === 'string' && ROLES.includes(r);
export const esEstado = (e) => typeof e === 'string' && LISTA_ESTADOS.includes(e);
/** Forma 'dd/mm/aaaa' (la validez de calendario la mira odt_afinia_textos.esFechaDMA). */
export const tieneFormaFechaDMA = (f) => typeof f === 'string' && RE_FECHA_DMA.test(f);

// ── Rutas de documentos (texto; la capa de datos las pasa a doc()) ─────────────
export const rutaOdt = (odtId) => COL.odt + '/' + odtId;
export const rutaParte = (odtId, i) => COL.odt + '/' + odtId + '/' + COL.partes + '/' + i;
export const rutaActo = (odtId, rol) => COL.odt + '/' + odtId + '/' + COL.actos + '/' + rol;
export const rutaFirmante = (uid) => COL.firmantes + '/' + uid;
export const rutaNro = (nro) => COL.nro + '/' + nro;
export const rutaFirmaPropia = (uid) => COL.firmaPropia + '/' + uid;
export const rutaConfigFirmantes = () => CONFIG_FIRMANTES.col + '/' + CONFIG_FIRMANTES.doc;
/**
 * Id DETERMINISTA de una devolución: «rol_rev» (la regla: dv == d.rol + '_' + string(o.rev)).
 * Una por turno: la segunda sería un update, que la regla niega.
 */
export function idDevolucion(rol, rev) {
  if (!esRol(rol) || !Number.isInteger(rev) || rev < 0) throw new TypeError('Devolución sin rol o sin revisión.');
  return rol + '_' + rev;
}
export const rutaDevolucion = (odtId, rol, rev) => COL.odt + '/' + odtId + '/' + COL.devoluciones + '/' + idDevolucion(rol, rev);
