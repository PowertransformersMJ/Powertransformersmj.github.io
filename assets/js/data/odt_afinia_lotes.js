// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · ARMADO de los documentos y lotes (PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Lo que la capa de datos ESCRIBE, armado sin red: cada función devuelve el
// documento EXACTO que la regla del bloque `odt_afinia` de firestore.rules
// espera (allí la forma se valida con `size() == N` y la lectura de cada campo,
// así que aquí van exactamente esos campos, ni uno más).
//   · documentoHabilitacion → odt_afinia_firmantes/{uid}            (9 campos)
//   · planPublicacion       → odt_afinia/{id} (16; 17 con `reemplaza` al volver a publicar un
//                             N.º cuya vigente está ANULADA o REEMPLAZADA) + partes/{i} + odt_afinia_nro/{nro}
//   · planFirma             → odt_afinia/{id}/actos/{rol}           (16; Responsable 17), con el
//                             compositor de la copia congelada (el vigente: 'odt-afinia@2', que se
//                             lee de odt_afinia_cierre.js y no de rutas, por la caché, L-102) y, el
//                             Responsable, su pie completo: cierre {si, fecha (la prevista), generada (el N.º)}
//   · cambiosAnulacion      → update {estado, rev, anulacion}
//   (Reemplazar y registrar el cierre en Afinia los arma odt_afinia_cierre.js del dominio, L-102.)
//   · documentoDevolucion   → odt_afinia/{id}/devoluciones/{rol_rev} (4; id determinista: una por turno)
//   · documentoDescarga     → odt_afinia_descargas/{auto}           (4)
// La marca de hora del servidor (`serverTimestamp()`) y el envoltorio de bytes
// (`Bytes.fromUint8Array`) llegan INYECTADOS (`ts`, `aBytes`): así las pruebas
// arman los lotes en Node sin Firebase.
//
// Diseño: bóveda `research-archive/2026-11-20-odt-firmas/DISENO-FINAL.md` §2-§5.
// Sin Firebase, sin DOM. Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import {
  COL, ESTADOS, VERSIONES, PROVEEDOR, TOPES, esNro, esHuella, esRol
} from '../domain/odt_afinia_rutas.js';
import { cambioFirma, cambioAnular, errorFirmantes } from '../domain/odt_afinia_estados.js';
import { textoAcuerdo, esFechaDMA } from '../domain/odt_afinia_textos.js';
import { esZonas } from '../domain/odt_afinia_zonas.js';
// Archivo NUEVO (L-102): el compositor vigente sale de aquí, no de un odt_afinia_rutas.js que pudo quedar viejo.
import { COMPOSITOR_VIGENTE } from '../domain/odt_afinia_cierre.js';

// ── Errores con código (la pantalla decide el mensaje por el código) ───────────
export class ErrorOdt extends Error {
  /**
   * @param {'sin_permiso'|'no_existe'|'validacion'|'estado'|'conflicto'|'duplicado'|'red'|'tiempo'
   *   |'indice'|'contrasena'|'demasiados'|'cuenta'|'huella'|'no_entro'|'sin_red'|'pendiente'|'devuelta'|'desconocido'} codigo
   * @param {string} [mensaje]
   */
  constructor(codigo, mensaje) {
    super(mensaje || MENSAJES[codigo] || MENSAJES.desconocido);
    this.name = 'ErrorOdt';
    this.codigo = codigo;
  }
}

export const MENSAJES = Object.freeze({
  sin_permiso: 'La plataforma no aceptó la operación con su cuenta.',
  no_existe: 'La ODT no existe o ya no está disponible para usted.',
  validacion: 'Hay datos que no cumplen el formato.',
  estado: 'La ODT ya no está en el paso que se esperaba. Recargue para ver su estado actual.',
  conflicto: 'La ODT cambió mientras usted trabajaba. Recargue y vuelva a empezar.',
  duplicado: 'Ya hay una ODT vigente con ese N.º. Para volver a publicarla, primero anule la vigente (si le falta una firma) o reemplácela (si ya está lista).',
  red: 'No hay conexión con la plataforma. Revise su red e inténtelo de nuevo.',
  tiempo: 'La plataforma no respondió a tiempo.',
  indice: 'La bandeja se está preparando en la plataforma (índice en construcción). Inténtelo en unos minutos.',
  contrasena: 'La contraseña no es correcta.',
  demasiados: 'Demasiados intentos seguidos. Espere unos minutos antes de volver a intentarlo.',
  cuenta: 'La sesión cambió de cuenta. Recargue la página y entre con su propia cuenta.',
  huella: 'Lo leído de la plataforma no coincide con su huella: no se muestra ni se firma.',
  no_entro: 'La operación NO quedó registrada.',
  sin_red: 'No se pudo comprobar en la plataforma si la operación quedó registrada (sin conexión).',
  pendiente: 'Aún no consta en el servidor. NO repita: espere y recargue para ver el estado.',
  devuelta: 'Ya devolvió esta ODT en este turno: queda una sola devolución por turno.',
  desconocido: 'No se pudo completar la operación.'
});

/** Código de un error de Firebase (Firestore o Auth) → ErrorOdt. Un ErrorOdt pasa tal cual. */
export function errorDesdeFirebase(e) {
  if (e instanceof ErrorOdt) return e;
  const c = String((e && e.code) || '');
  const m = String((e && e.message) || '');
  if (c === 'permission-denied' || c === 'firestore/permission-denied') return new ErrorOdt('sin_permiso');
  if (c === 'not-found') return new ErrorOdt('no_existe');
  if (c === 'failed-precondition' && /index/i.test(m)) return new ErrorOdt('indice');
  if (c === 'failed-precondition' || c === 'aborted') return new ErrorOdt('conflicto');
  if (c === 'unavailable' || c === 'deadline-exceeded' || c === 'auth/network-request-failed') return new ErrorOdt('red');
  if (c === 'auth/wrong-password' || c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials'
    || c === 'auth/missing-password') return new ErrorOdt('contrasena');
  if (c === 'auth/too-many-requests') return new ErrorOdt('demasiados');
  if (c === 'auth/user-mismatch' || c === 'auth/user-token-expired' || c === 'auth/user-disabled'
    || c === 'auth/requires-recent-login') return new ErrorOdt('cuenta');
  return new ErrorOdt('desconocido', MENSAJES.desconocido + (c ? ' (' + c + ')' : ''));
}

export const esSinPermiso = (e) => !!e && (e.codigo === 'sin_permiso' || e.code === 'permission-denied');

// ── Sesión publicada por el guard (assets/js/auth/session-guard.js) ────────────
/** {uid, nombre, correoPerfil, rol, activo, esAdmin, legacy} o null. */
export function sesionGlobal() {
  const s = globalThis.__sgmSession;
  if (!s || !s.user || !s.user.uid) return null;
  const p = s.profile || {};
  const rol = String(s.role || p.rol || '');
  return {
    uid: s.user.uid,
    nombre: typeof p.nombre === 'string' ? p.nombre : '',
    correoPerfil: typeof p.email === 'string' ? p.email : '',
    rol,
    activo: p.activo !== false,
    esAdmin: rol === 'admin',
    legacy: p.legacy === true      // admin de arranque SIN perfil: la regla le niega publicar (hasProfile)
  };
}

// ── Utilidades ─────────────────────────────────────────────────────────────────
const exige = (cond, mensaje) => { if (!cond) throw new ErrorOdt('validacion', mensaje); };
const texto = (v) => (typeof v === 'string' ? v : '');
const RE_ID = /^[A-Za-z0-9]{20}$/;
export const esIdOdt = (id) => typeof id === 'string' && RE_ID.test(id);

/** Zonas con EXACTAMENTE la forma que pide la regla (odtZonas): ni una clave de más. */
export function zonasParaGuardar(z) {
  exige(esZonas(z), 'Faltan las zonas de las casillas de la ODT.');
  const r = (q) => ({ x: q.x, y: q.y, w: q.w, h: q.h });
  const p = (q) => ({ x: q.x, y: q.y });
  return { azt: r(z.azt), responsable: r(z.responsable), si: p(z.si), fecha: p(z.fecha) };
}

/** {uid, nombre, correo} de una habilitación (la regla compara nombre y correo con ella). */
export function firmanteDesdeHabilitacion(h) {
  exige(h && typeof h.uid === 'string' && h.uid, 'Firmante sin cuenta.');
  exige(typeof h.nombre === 'string' && h.nombre.trim(), 'El firmante no tiene nombre en su habilitación.');
  exige(typeof h.correo === 'string' && h.correo, 'El firmante no tiene correo en su habilitación.');
  return { uid: h.uid, nombre: h.nombre, correo: h.correo };
}

// ── Habilitación ───────────────────────────────────────────────────────────────
/**
 * odt_afinia_firmantes/{uid}: la crea el propio uid, recién autenticado.
 * @param {{uid:string, nombre:string, token:{email:string, auth_time:number, email_verified:boolean, sign_in_provider:string}, ts:any}} p
 */
export function documentoHabilitacion({ uid, nombre, token, ts } = {}) {
  exige(uid, 'Falta la cuenta.');
  const n = texto(nombre);
  exige(n.trim().length >= 3 && n.length <= 120, 'Su perfil no tiene un nombre válido (3 a 120 caracteres). Pida al administrador que lo complete.');
  exige(token && typeof token.email === 'string' && token.email, 'Su cuenta no tiene correo.');
  exige(token.email_verified === true, 'Primero verifique su correo (paso 1).');
  exige(token.sign_in_provider === PROVEEDOR, 'Debe entrar con correo y contraseña.');
  exige(Number.isInteger(token.auth_time), 'No se pudo leer la hora de su autenticación.');
  return {
    uid,
    correo: token.email,
    correoVerificado: true,
    proveedor: PROVEEDOR,
    authTime: token.auth_time,
    acuerdoVersion: VERSIONES.acuerdo,
    acuerdo: textoAcuerdo({ nombre: n, correo: token.email }),
    nombre: n,
    en: ts
  };
}

// ── Publicación ────────────────────────────────────────────────────────────────
/**
 * Lote de publicación: la ODT, sus partes 0..n-1 y el candado del N.º.
 * `reemplaza` (opcional, 2026-11-21): el id de la ODT anterior con ese N.º, cuando el candado ya
 * existía y su vigente está ANULADA o REEMPLAZADA. La regla del candado exige que coincida con el
 * candado anterior (y que no venga si el candado es nuevo): queda la traza «reemplaza a…».
 * @param {{id:string, form:{nro,consignacion,subestacion,equipo,fechaTrabajo}, preparado:{partes:Uint8Array[], huellasPartes:string[], huella:string, bytes:number},
 *          zonas:object, firmantes:{azt:object, responsable:object}, quien:{uid:string, nombre:string}, ts:any, aBytes:(u:Uint8Array)=>any,
 *          reemplaza?:string|null}} p
 * @returns {{id:string, odt:object, operaciones:Array<{ruta:string[], datos:object}>}}
 */
export function planPublicacion({ id, form = {}, preparado = {}, zonas, firmantes = {}, quien = {}, ts, aBytes, reemplaza = null } = {}) {
  exige(esIdOdt(id), 'Identificador de ODT inválido.');
  exige(typeof aBytes === 'function', 'Falta el envoltorio de bytes.');
  const nro = texto(form.nro).trim();
  exige(esNro(nro), 'El N.º de ODT debe tener 8 dígitos.');
  const consignacion = texto(form.consignacion).trim();
  const subestacion = texto(form.subestacion).trim();
  const equipo = texto(form.equipo).trim();
  const fechaTrabajo = texto(form.fechaTrabajo).trim();
  exige(consignacion.length <= 60, 'La consignación admite hasta 60 caracteres.');
  exige(subestacion.length >= 1 && subestacion.length <= 120, 'Escriba la subestación (hasta 120 caracteres).');
  exige(equipo.length >= 1 && equipo.length <= 120, 'Escriba el equipo (hasta 120 caracteres).');
  exige(esFechaDMA(fechaTrabajo), 'La fecha prevista de la orden debe ser una fecha real dd/mm/aaaa.');
  exige(reemplaza == null || (esIdOdt(reemplaza) && reemplaza !== id), 'La ODT que se reemplaza no tiene un identificador válido.');

  const azt = firmanteDesdeHabilitacion(firmantes.azt);
  const responsable = firmanteDesdeHabilitacion(firmantes.responsable);
  const errF = errorFirmantes({ azt, responsable }, quien.uid);
  exige(!errF, errF);
  exige(quien && quien.uid, 'Falta quién publica.');

  const partes = preparado.partes || [];
  exige(partes.length >= 1 && partes.length <= TOPES.partesMax, 'El PDF debe ocupar de 1 a ' + TOPES.partesMax + ' partes.');
  exige(Array.isArray(preparado.huellasPartes) && preparado.huellasPartes.length === partes.length, 'Faltan las huellas de las partes.');
  exige(preparado.huellasPartes.every(esHuella) && esHuella(preparado.huella), 'Huellas mal formadas.');
  exige(Number.isInteger(preparado.bytes) && preparado.bytes >= 1 && preparado.bytes <= partes.length * TOPES.parte, 'Tamaño del PDF inválido.');
  for (const p of partes) exige(p instanceof Uint8Array && p.length >= 1 && p.length <= TOPES.parte, 'Una parte del PDF no cabe.');
  if (partes.length === 1) exige(preparado.huella === preparado.huellasPartes[0], 'La huella de la parte única no coincide.');

  const odt = {
    nro,
    consignacion,
    subestacion,
    equipo,
    fechaTrabajo,
    firmantes: { azt, responsable },
    lectores: [azt.uid, responsable.uid],
    estado: ESTADOS.PENDIENTE_AZT,
    rev: 0,
    huella: preparado.huella,
    bytes: preparado.bytes,
    partes: partes.length,
    huellasPartes: preparado.huellasPartes.slice(),
    zonas: zonasParaGuardar(zonas),
    publicadoPor: { uid: quien.uid, nombre: texto(quien.nombre) },
    publicadoEn: ts
  };
  if (reemplaza != null) odt.reemplaza = reemplaza;
  const operaciones = [{ ruta: [COL.odt, id], datos: odt }];
  partes.forEach((p, i) => operaciones.push({ ruta: [COL.odt, id, COL.partes, String(i)], datos: { datos: aBytes(p) } }));
  operaciones.push({ ruta: [COL.nro, nro], datos: { odtId: id } });
  return { id, odt, operaciones };
}

// ── Firma (acto) ───────────────────────────────────────────────────────────────
/**
 * Lote de firma: crear actos/{rol} y avanzar la ODT {estado, rev}, atados.
 * Todo sale de la COPIA congelada al pulsar «Preparar» (L-112) y del token de la
 * sesión abierta con correo y contraseña (desde el 2026-11-21 la firma no vuelve a
 * pedir la contraseña; authTime es el inicio de esa sesión, solo registro).
 * @param {object} congelado  lo que devuelve prepararFirma (ui/odt-afinia/preparar.js)
 * @param {{email:string, auth_time:number, email_verified:boolean, sign_in_provider:string}} token
 * @param {{ts:any, aBytes:(u:Uint8Array)=>any}} dep
 * @returns {{acto:{ruta:string[], datos:object}, odt:{ruta:string[], cambios:{estado:string, rev:number}}}}
 */
export function planFirma(congelado, token, { ts, aBytes } = {}) {
  const c = congelado || {};
  exige(esIdOdt(c.odtId) && esRol(c.rol), 'Firma sin preparar.');
  exige(typeof aBytes === 'function', 'Falta el envoltorio de bytes.');
  exige(token && token.email === c.correo, 'El correo de la cuenta autenticada no es el de la firma preparada.');
  exige(token.email_verified === true && token.sign_in_provider === PROVEEDOR && Number.isInteger(token.auth_time), 'La autenticación no es con contraseña y correo verificado.');
  exige(c.imagen instanceof Uint8Array && c.imagen.length >= 1, 'Falta la imagen de su firma.');
  exige(esHuella(c.huellaImagen) && esHuella(c.huellaBase) && esHuella(c.huellaVista), 'Faltan huellas de la firma preparada.');
  const t = cambioFirma({ estado: c.estadoPrevio, rev: c.revPrevio, firmantes: c.firmantes }, c.rol, c.uid);
  exige(t.ok, t.mensaje);
  // El compositor es el de la COPIA congelada (con el que se armó lo que vio): debe ser el vigente.
  // Una copia de una página vieja en la caché (sin compositor) no se firma: se recarga y se prepara de nuevo.
  exige(c.compositor === COMPOSITOR_VIGENTE, 'La firma se preparó con una versión anterior de la página. Recargue con Cmd + Shift + R (o Ctrl + Shift + R) y prepare de nuevo.');
  const datos = {
    rol: c.rol,
    uid: c.uid,
    correo: token.email,
    correoVerificado: true,
    proveedor: PROVEEDOR,
    authTime: token.auth_time,
    nombre: c.nombre,
    nro: c.nro,
    imagen: aBytes(c.imagen),
    huellaImagen: c.huellaImagen,
    huellaBase: c.huellaBase,
    huellaVista: c.huellaVista,
    compositor: c.compositor,
    declaracionVersion: c.declaracion.version,
    declaracion: c.declaracion.texto,
    en: ts
  };
  if (c.rol === 'responsable') {
    exige(c.cierre && c.cierre.si === true && esFechaDMA(c.cierre.fecha), 'Falta la fecha de cierre.');
    // El pie completo: el N.º de «ODT GENERADA N°» va escrito (la regla exige generada == N.º; L-102).
    exige(c.cierre.generada === c.nro && esNro(c.nro), 'La firma se preparó con una versión anterior de la página (falta el N.º de «ODT GENERADA»). Recargue con Cmd + Shift + R (o Ctrl + Shift + R) y prepare de nuevo.');
    datos.cierre = { si: true, fecha: c.cierre.fecha, generada: c.cierre.generada };
  }
  return {
    acto: { ruta: [COL.odt, c.odtId, COL.actos, c.rol], datos },
    odt: { ruta: [COL.odt, c.odtId], cambios: { estado: t.cambios.estado, rev: t.cambios.rev } }
  };
}

// ── Anulación, devolución y descarga ───────────────────────────────────────────
/** update de la ODT al anular: {estado:'ANULADA', rev, anulacion:{motivo, por, en}}. */
export function cambiosAnulacion(odt, { motivo, quien, ts } = {}) {
  const r = cambioAnular(odt, { motivo, por: quien && { uid: quien.uid, nombre: texto(quien.nombre) || '—' } });
  if (!r.ok) throw new ErrorOdt(r.codigo === 'estado' ? 'estado' : 'validacion', r.mensaje);
  // La regla compara `por` con {uid, nombre: profile().nombre}: va el nombre TAL CUAL (también vacío).
  return { estado: r.cambios.estado, rev: r.cambios.rev, anulacion: { motivo: r.cambios.anulacion.motivo, por: { uid: quien.uid, nombre: texto(quien.nombre) }, en: ts } };
}

/** odt_afinia/{id}/devoluciones/{rol_rev}: «no firmo», con motivo, en su turno (el id lo da idDevolucion). */
export function documentoDevolucion({ uid, rol, motivo, ts } = {}) {
  exige(uid && esRol(rol), 'Falta quién devuelve.');
  const m = texto(motivo).trim();
  exige(m.length >= TOPES.motivoMin && m.length <= TOPES.motivoMax, 'El motivo debe tener entre ' + TOPES.motivoMin + ' y ' + TOPES.motivoMax + ' caracteres.');
  return { uid, rol, motivo: m, en: ts };
}

/** odt_afinia_descargas/{auto}: quién bajó qué bytes (la huella de lo entregado, L-107). */
export function documentoDescarga({ odtId, uid, huella, ts } = {}) {
  exige(esIdOdt(odtId) && uid && esHuella(huella), 'Datos de descarga incompletos.');
  return { odtId, uid, huella, en: ts };
}
