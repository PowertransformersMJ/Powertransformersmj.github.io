// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE · EL SCRIPT DE GOOGLE QUE ENVÍA (lógica PURA) · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del 2026-11-26 (99 §236): el Ingeniero no quiere activar la verificación en dos pasos en la cuenta
// remitente, así que NO hay contraseña de aplicación de Gmail. Los correos los envía un script de Google Apps Script
// que vive en esa cuenta (una cuenta de Gmail dedicada a SGM; functions/apps-script/avisos-cumplimiento.gs) con MailApp.
// Nadie copia claves ni tokens a mano:
//   · el script se identifica con su token de identidad OpenID de Google (ScriptApp.getIdentityToken()) en la cabecera
//     «Authorization: Bearer …». La función HTTPS avisosCorreoRemitente (functions/index.js) verifica la FIRMA, el
//     vencimiento y el emisor con google-auth-library; aquí se exige además: emisor de Google, no vencido, correo
//     verificado e IGUAL al remitente de la configuración (sin mayúsculas), y su «aud» (el id del cliente de OAuth del
//     proyecto del script) IGUAL a config.audienciaScript;
//   · si audienciaScript está vacío o no coincide: 403, y el «aud» visto queda en odt_afinia_config/cumplimiento_script
//     {audienciaVista, vistaEn, ultimaConexionEn, ultimoResultado} (lo escribe SOLO el servidor) para que un
//     administrador lo APRUEBE desde la pantalla, en dos pasos (audienciaScript = audienciaVista). Un token de OTRA
//     cuenta no escribe nada;
//   · acciones (POST con JSON):
//       'pendientes' {cupo?} → hasta 10 correos en «pendiente» (o en «en_envio» con el préstamo vencido) de los cortes
//         cuyo responsable es el de la configuración, que quepan en el cupo diario de envíos del script; cada uno pasa
//         a «en_envio» con un préstamo de 10 minutos y un id de préstamo: [{id, para, cc, asunto, texto, html,
//         prestamo}]. Con activo == false, la lista va vacía;
//       'resultado' {id, prestamo, ok, error?} → si el préstamo coincide: ok → «enviado» (enviadoEn) y sus avisos
//         «enviado»; si no → «error» con el mensaje (recortado y en llano) y sus avisos «error» (los retoman el
//         reproceso o el corte siguiente). Repetir el resultado no cambia nada: nada se manda dos veces;
//       'probar' → solo dice si el script está aprobado (lo usa probarConexion() del script); la respuesta (y la 403
//         «sin aprobar») trae el aud del propio token, que el script escribe en su registro para compararlo en SGM;
//   · tope de 5 préstamos por correo: si el script lo recibe 5 veces sin confirmar, el sexto pedido lo deja en
//     «error» (no se manda en bucle);
//   · cada llamada AUTENTICADA (token válido de la cuenta remitente) deja ultimaConexionEn y ultimoResultado en el
//     estado (en llano: la pantalla lo muestra tal cual); corrector 99 §236: también si la configuración guardada no
//     es válida (TEXTO_ESTADO.sinConfig, y la respuesta sigue siendo 403 'sin_config');
//   · corrector 99 §236: la cola se pide con listarCola(limite, estados, {responsableNorm}): los más viejos primero y
//     solo los del responsable configurado (los de otro responsable nunca salen y no deben taparla).
// Todo lo que toca la red o la base llega INYECTADO en `deps` (functions/cumplimiento_remitente.mjs; las pruebas de
// functions/tests/ usan dobles): verificarToken(token) → payload (lanza si no vale) · leerConfig() ·
// guardarEstado(cambios) · listarCola(limite, estados) → [{id, …}] · prestar(id, {ahoraMs, prestamo, responsable}) →
// {estado:'prestado', correo} | {estado:'tope', nros, umbral} | {estado:'no'} · cerrar(id, {prestamo, ok, error}) →
// {estado, nros, umbral} · marcarAvisosDeCorreo(correoId, {ids, estado}) · nuevoPrestamo() · marca() (hora del
// servidor) · ahora() → Date · log(nivel, mensaje, datos).
// Sin la base, sin DOM, sin red (copiado a functions/domain por functions/prepare-deploy.mjs).
// Archivo NUEVO a propósito (L-102): a sus vecinos de antes solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { normalizarNombre, limpiar } from './odt_afinia_indicadores.js';
import { normalizarConfig, errorConfigCumplimiento, esAudiencia } from './odt_afinia_cumplimiento.js';
import { textoTecnico, idAviso } from './odt_afinia_cumplimiento_avisos.js';

/** El documento de estado del script: lo escribe SOLO el servidor; lo lee solo un administrador (firestore.rules). */
export const COL_ESTADO_SCRIPT = Object.freeze({ col: 'odt_afinia_config', doc: 'cumplimiento_script' });
/** Cuánto dura un préstamo de un correo al script (después, otro pedido lo puede volver a prestar). */
export const PRESTAMO_MS = 10 * 60 * 1000;
/** Cuántos correos se prestan en una llamada. */
export const MAX_PRESTAMOS_POR_LLAMADA = 10;
/** Préstamos de un mismo correo sin que el script confirme: al llegar aquí, el siguiente pedido lo deja en «error». */
export const TOPE_INTENTOS = 5;
/** Cuántos correos de la cola se leen para elegir los que se prestan. */
export const CANDIDATOS_MAX = 50;
/** Largo máximo de un error guardado (en llano) y del último resultado. */
export const ERROR_MAX = 300;
/** Los emisores de los tokens de identidad de Google. */
export const EMISORES_GOOGLE = Object.freeze(['accounts.google.com', 'https://accounts.google.com']);
const RE_ID_CORREO = /^[A-Za-z0-9]{20}_(10|15|20)$/;
const RE_PRESTAMO = /^[A-Za-z0-9_-]{16,64}$/;
const RE_BEARER = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/i;
export const esIdCorreo = (v) => typeof v === 'string' && RE_ID_CORREO.test(v);
export const esPrestamo = (v) => typeof v === 'string' && RE_PRESTAMO.test(v);

const recortar = (t, max = ERROR_MAX) => { const x = limpiar(t); return x.length > max ? x.slice(0, max - 1) + '…' : x; };

/** El token de «Authorization: Bearer <token>»; '' si no viene así. */
export function tokenDeCabecera(v) {
  const m = RE_BEARER.exec(typeof v === 'string' ? v.trim() : '');
  return m ? m[1] : '';
}

/**
 * ¿El token (ya verificado: firma, vencimiento y emisor) es del script aprobado de la cuenta remitente?
 * @param {object} p  el payload del token
 * @param {object} config  la configuración normalizada
 * @param {number} ahoraMs
 * @returns {{ok:boolean, motivo?:string, aud?:string, remitente?:boolean}}  remitente: el token SÍ es de la cuenta
 *   remitente (aunque su script no esté aprobado): solo entonces se escribe el estado.
 */
export function revisarIdentidad(p, config, ahoraMs) {
  if (!p || typeof p !== 'object') return { ok: false, motivo: 'token_invalido' };
  if (!EMISORES_GOOGLE.includes(p.iss)) return { ok: false, motivo: 'emisor' };
  const exp = Number(p.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= ahoraMs) return { ok: false, motivo: 'vencido' };
  if (p.email_verified !== true && p.email_verified !== 'true') return { ok: false, motivo: 'correo_sin_verificar' };
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  const remitente = String((config && config.remitente) || '').trim().toLowerCase();
  if (!email || !remitente || email !== remitente) return { ok: false, motivo: 'otro_correo' };
  const aud = typeof p.aud === 'string' ? p.aud : '';
  if (!aud || !esAudiencia(aud)) return { ok: false, motivo: 'audiencia_invalida', remitente: true };
  if (!config.audienciaScript || aud !== config.audienciaScript) return { ok: false, motivo: 'sin_aprobar', aud, remitente: true };
  return { ok: true, aud };
}

// ── El préstamo y el resultado (decisiones puras; el adaptador las aplica en una transacción) ─────────────
/** Cuántos destinatarios (para + copia) gasta un correo del cupo diario del script. */
export const destinatarios = (c) => (Array.isArray(c && c.para) ? c.para.length : 0) + (Array.isArray(c && c.cc) ? c.cc.length : 0);
/**
 * ¿Se presta este correo? 'prestar', 'tope' (ya se prestó TOPE_INTENTOS veces sin confirmar: pasa a «error») o 'no'.
 * Solo los del responsable de la configuración; en «pendiente», o en «en_envio» con el préstamo vencido.
 */
export function decidirPrestamo(c, { ahoraMs, responsable }) {
  if (!c || typeof c !== 'object') return 'no';
  if (normalizarNombre(c.responsable) !== normalizarNombre(responsable)) return 'no';
  const libre = c.estado === 'pendiente' || (c.estado === 'en_envio' && (Number(c.prestamoHastaMs) || 0) <= ahoraMs);
  if (!libre) return 'no';
  return (Number(c.intentos) || 0) >= TOPE_INTENTOS ? 'tope' : 'prestar';
}
/** Los cambios de un préstamo (el correo queda «en_envio» por PRESTAMO_MS). */
export function cambiosPrestamo(c, { ahoraMs, prestamo, marca }) {
  return { estado: 'en_envio', prestamo, prestamoHastaMs: ahoraMs + PRESTAMO_MS, prestadoEn: marca, intentos: (Number(c && c.intentos) || 0) + 1 };
}
export const TEXTO_TOPE = 'El script de Google recibió este correo ' + TOPE_INTENTOS + ' veces sin confirmar que lo envió. Revise sus ejecuciones en script.google.com (con la cuenta remitente) y luego use «Revisar y enviar los avisos de este corte».';
/**
 * Los cambios de un correo que llegó al tope de préstamos (se conserva el préstamo: un «enviado» tardío aún vale).
 * errorPor 'tope' (corrector 99 §236): SOLO este error acepta después un «sí salió» del mismo préstamo.
 */
export const cambiosTope = () => ({ estado: 'error', error: TEXTO_TOPE, errorPor: 'tope' });
/**
 * Qué hacer con el resultado que informa el script: 'enviado', 'error', 'repetido' (ya estaba registrado: no cambia
 * nada), 'prestamo_distinto' (no es el préstamo vigente: no cambia nada) o 'no_existe'.
 */
export function decidirResultado(c, { prestamo, ok }) {
  if (!c || typeof c !== 'object') return 'no_existe';
  if (c.estado === 'enviado') return 'repetido';
  if (!prestamo || c.prestamo !== prestamo) return 'prestamo_distinto';
  if (c.estado === 'en_envio') return ok ? 'enviado' : 'error';
  // En «error» con ESE préstamo: si lo dejó así el TOPE (el script no confirmó a tiempo) y el script dice que sí salió,
  // se le cree (así un reproceso no lo vuelve a mandar). Si el error lo informó el propio script, un «sí salió»
  // posterior con el mismo préstamo se contradice: no cambia nada (corrector 99 §236).
  if (c.estado === 'error') return ok && c.errorPor === 'tope' ? 'enviado' : 'repetido';
  return 'prestamo_distinto';
}
/** Los cambios del correo según la decisión ({} si no cambia). */
export function cambiosResultado(decision, { error, marca }) {
  if (decision === 'enviado') return { estado: 'enviado', error: '', enviadoEn: marca };
  if (decision === 'error') return { estado: 'error', error: textoErrorScript(error), errorPor: 'script' };
  return {};
}
/** El error que informa el script (lo que dijo MailApp), en llano y recortado. */
export function textoErrorScript(m) {
  const tec = recortar(typeof m === 'string' ? m : '', 180);
  if (!tec) return 'El script de Google no pudo enviarlo (no dijo por qué).';
  if (/too many times|quota|limit|cuota|cupo/i.test(tec)) return recortar('Se acabó el cupo diario de correos de la cuenta remitente (Google lo renueva cada 24 horas): ' + tec);
  if (/invalid email|recipient|destinatario|address/i.test(tec)) return recortar('Google rechazó alguna dirección: revise los destinatarios y las copias de la configuración (' + tec + ')');
  return recortar('El script de Google no pudo enviarlo: ' + tec);
}

// ── Lo que queda en el estado (en llano) ─────────────────────────────────────
const umbralDeId = (id) => String(id || '').split('_')[1] || '?';
/** Los avisos de un correo (sus N.º en su umbral). */
const idsAvisos = (x) => (Array.isArray(x && x.nros) ? x.nros : []).map((n) => idAviso(n, x.umbral));
export const TEXTO_ESTADO = Object.freeze({
  sinAprobar: 'Pidió permiso: este script todavía no está aprobado en SGM.',
  audienciaInvalida: 'Se conectó con un identificador de script que no se puede aprobar (revise que sea un script de Google normal).',
  probar: 'Probó la conexión: el script está aprobado.',
  inactivo: 'Pidió los correos en cola: los avisos están desactivados en SGM, no se le entregó ninguno.',
  accion: 'Pidió algo que la plataforma no entiende.',
  // Corrector 99 §236: la cuenta remitente se conectó, pero la configuración guardada no es válida (sin_config).
  sinConfig: 'Se conectó, pero la configuración de los avisos no es válida: no se le entregó nada. Revísela y guárdela de nuevo en esta sección.',
  resultadoInvalido: 'Informó un resultado incompleto (no cambia nada).'
});
export function textoPendientes(n, topes) {
  const base = n ? 'Pidió los correos en cola: se le entregaron ' + n + '.' : 'Pidió los correos en cola: no había ninguno para enviar.';
  return base + (topes ? ' ' + topes + (topes === 1 ? ' correo quedó' : ' correos quedaron') + ' en «No se pudo enviar» (el script los recibió ' + TOPE_INTENTOS + ' veces sin confirmar).' : '');
}
export function textoResultado(id, decision, error) {
  const de = 'el correo de ' + umbralDeId(id) + ' días';
  if (decision === 'enviado') return 'Informó que envió ' + de + '.';
  if (decision === 'error') return recortar('Informó que no pudo enviar ' + de + ': ' + textoErrorScript(error));
  if (decision === 'repetido') return 'Repitió el resultado de ' + de + ' (ya estaba registrado; no cambia nada).';
  if (decision === 'prestamo_distinto') return 'Informó sobre ' + de + ' con un préstamo que ya no vale (no cambia nada).';
  return 'Informó sobre un correo que no existe (no cambia nada).';
}
export const MENSAJE_SIN_APROBAR = 'Este script todavía no está aprobado en SGM: un administrador debe pulsar «Aprobar este script» en Indicadores → «Avisos de cumplimiento por correo».';

// ── La atención de una llamada del script ─────────────────────────────────────
/**
 * @param {{metodo:string, tipo:string, autorizacion:string, cuerpo:any}} sol  la llamada (método, Content-Type,
 *   cabecera Authorization y el cuerpo ya leído como JSON)
 * @param {object} deps  (ver la cabecera)
 * @returns {Promise<{status:number, cuerpo:object}>}  siempre un JSON {ok, …}; nunca lanza
 */
export async function atenderRemitente(sol, deps) {
  const log = typeof deps.log === 'function' ? deps.log : () => {};
  const r = (status, cuerpo) => ({ status, cuerpo });
  try {
    if (!sol || sol.metodo !== 'POST') return r(405, { ok: false, error: 'metodo', mensaje: 'Solo se aceptan llamadas POST.' });
    if (!/^application\/json(\s*;|$)/i.test(String(sol.tipo || '').trim())) return r(415, { ok: false, error: 'tipo', mensaje: 'El cuerpo debe ser JSON (Content-Type: application/json).' });
    const token = tokenDeCabecera(sol.autorizacion);
    if (!token) return r(401, { ok: false, error: 'sin_token', mensaje: 'Falta el token de identidad de Google (Authorization: Bearer …).' });
    let payload;
    try { payload = await deps.verificarToken(token); } catch (_) {
      // Nunca se registra el token ni el error de la librería (lo trae completo).
      log('aviso', 'Script remitente: un token de identidad que no se pudo verificar', {});
      return r(401, { ok: false, error: 'token_invalido', mensaje: 'El token de identidad no es válido o ya venció.' });
    }
    const crudo = await deps.leerConfig();
    const config = crudo ? normalizarConfig(crudo) : null;
    const ahoraMs = deps.ahora().getTime();
    // Corrector 99 §236: primero QUIÉN llama. A un token de otra cuenta (o sin configuración que lo reconozca) se le
    // responde siempre lo mismo: no se le dice si los avisos están configurados.
    const ident = revisarIdentidad(payload, config || {}, ahoraMs);
    if (!ident.ok && !ident.remitente) {
      log('aviso', 'Script remitente: identidad rechazada', { motivo: ident.motivo });
      return r(403, { ok: false, error: 'identidad', mensaje: 'El token no es de la cuenta remitente configurada en SGM (o su correo no está verificado).' });
    }
    if (!config || errorConfigCumplimiento(config)) {
      // Corrector 99 §236: el token SÍ es de la cuenta remitente (si no, ya salió arriba), así que su conexión queda en
      // el estado: el administrador ve que el script se conectó y que lo que falla es la configuración.
      if (config) await deps.guardarEstado({ ultimaConexionEn: deps.marca(), ultimoResultado: TEXTO_ESTADO.sinConfig });
      return r(403, { ok: false, error: 'sin_config', mensaje: 'Todavía no hay una configuración válida de los avisos en SGM.' });
    }
    // Desde aquí la llamada es de la cuenta remitente: cada una deja su rastro en el estado.
    const estado = (texto, extra = {}) => deps.guardarEstado({ ultimaConexionEn: deps.marca(), ultimoResultado: recortar(texto), ...extra });
    if (!ident.ok) {
      if (ident.motivo === 'sin_aprobar') {
        await estado(TEXTO_ESTADO.sinAprobar, { audienciaVista: ident.aud, vistaEn: deps.marca() });
        // Su propio aud (corrector 99 §236): el script lo escribe en su registro de ejecución para que el administrador
        // compare antes de aprobar (no filtra nada: viene en el token de quien llama).
        return r(403, { ok: false, error: 'sin_aprobar', mensaje: MENSAJE_SIN_APROBAR, audiencia: ident.aud });
      }
      await estado(TEXTO_ESTADO.audienciaInvalida);
      return r(403, { ok: false, error: 'audiencia_invalida', mensaje: TEXTO_ESTADO.audienciaInvalida });
    }
    const c = sol.cuerpo && typeof sol.cuerpo === 'object' && !Array.isArray(sol.cuerpo) ? sol.cuerpo : {};
    if (c.accion === 'probar') {
      await estado(TEXTO_ESTADO.probar);
      return r(200, { ok: true, activo: config.activo, audiencia: ident.aud, mensaje: 'Conexión aprobada: el script puede enviar los avisos' + (config.activo ? '.' : ' (hoy están desactivados en SGM).') });
    }
    if (c.accion === 'pendientes') return r(200, await pendientes(c, config, ahoraMs, deps, estado));
    if (c.accion === 'resultado') return await resultado(c, deps, estado, r, log);
    await estado(TEXTO_ESTADO.accion);
    return r(400, { ok: false, error: 'accion', mensaje: 'Acción desconocida.' });
  } catch (e) {
    log('error', 'Script remitente: falló la atención de la llamada', { error: textoTecnico(e) });
    return r(500, { ok: false, error: 'interno', mensaje: 'La plataforma falló; el script lo reintentará en su próximo turno.' });
  }
}

async function pendientes(c, config, ahoraMs, deps, estado) {
  if (config.activo !== true) {
    await estado(TEXTO_ESTADO.inactivo);
    return { ok: true, activo: false, correos: [] };
  }
  const n = Number(c.cupo);
  const cupo = c.cupo === undefined || c.cupo === null || !Number.isFinite(n) ? Infinity : Math.max(0, Math.floor(n));
  // Corrector 99 §236: los más viejos primero y solo los del responsable configurado (así los de otro no la tapan).
  const cola = await deps.listarCola(CANDIDATOS_MAX, ['pendiente', 'en_envio'], { responsableNorm: normalizarNombre(config.responsable) });
  const elegibles = (cola || []).map((x) => ({ x, d: decidirPrestamo(x, { ahoraMs, responsable: config.responsable }) })).filter((y) => y.d !== 'no')
    .sort((a, b) => (Number(a.x.encoladoEnMs) || 0) - (Number(b.x.encoladoEnMs) || 0) || (Number(a.x.umbral) || 0) - (Number(b.x.umbral) || 0) || String(a.x.id).localeCompare(String(b.x.id)));
  const correos = [];
  let usados = 0; let topes = 0;
  for (const { x, d } of elegibles) {
    if (d === 'prestar' && (correos.length >= MAX_PRESTAMOS_POR_LLAMADA || usados + destinatarios(x) > cupo)) continue;   // al próximo turno
    const p = await deps.prestar(x.id, { ahoraMs, prestamo: deps.nuevoPrestamo(), responsable: config.responsable });
    if (p && p.estado === 'prestado') { correos.push(p.correo); usados += destinatarios(p.correo); }
    else if (p && p.estado === 'tope') {
      topes++;
      try { await deps.marcarAvisosDeCorreo(x.id, { ids: idsAvisos(p), estado: 'error' }); } catch (_) { /* los libera avisosAbandonados */ }
    }
  }
  await estado(textoPendientes(correos.length, topes));
  return { ok: true, activo: true, correos };
}

async function resultado(c, deps, estado, r, log) {
  if (!esIdCorreo(c.id) || !esPrestamo(c.prestamo) || typeof c.ok !== 'boolean') {
    await estado(TEXTO_ESTADO.resultadoInvalido);
    return r(400, { ok: false, error: 'resultado_invalido', mensaje: 'Falta el id del correo, el préstamo o el resultado (ok).' });
  }
  const error = typeof c.error === 'string' ? c.error : '';
  const x = await deps.cerrar(c.id, { prestamo: c.prestamo, ok: c.ok, error, marca: deps.marca() });
  const decision = (x && x.estado) || 'no_existe';
  if (decision === 'enviado' || decision === 'error') {
    try { await deps.marcarAvisosDeCorreo(c.id, { ids: idsAvisos(x), estado: decision }); } catch (e) {
      // El correo ya quedó registrado; sus avisos los arregla el próximo proceso (avisosAbandonados).
      log('error', 'Script remitente: no se pudieron marcar los avisos del correo', { correoId: c.id, error: textoTecnico(e) });
    }
  }
  await estado(textoResultado(c.id, decision, error));
  return r(200, { ok: true, registrado: decision === 'enviado' || decision === 'error', estado: decision });
}

// ── Lo que dice la pantalla del script (bloque del administrador) ────────────
export const TITULO_SCRIPT = 'El script de Google que envía los correos';
export const AYUDA_SCRIPT = 'El envío lo hace un script de Google que vive en la cuenta remitente (una cuenta de Gmail dedicada a SGM): cada 10 minutos le pide a la plataforma los correos en cola y los envía desde esa cuenta. No hay que copiar claves: la primera vez que el script se conecta pide permiso, y usted lo aprueba aquí. Los pasos para instalarlo están en la guía del script (pídasela a quien mantiene SGM).';
export const TEXTO_PIDE_PERMISO = 'Hay un script de Google pidiendo permiso para enviar los avisos';
export const CONFIRMAR_APROBACION = 'Apruébelo solo si usted (o alguien de su confianza) acaba de instalarlo en la cuenta remitente y su identificador es el mismo que el script escribió en su registro de ejecución (en script.google.com, «Identificador de este script»); si no coincide, no lo apruebe. Desde ese momento podrá pedir los correos en cola y enviarlos desde esa cuenta; si después se instala otro script, tendrá que aprobarlo de nuevo.';
/**
 * Lo que la pantalla muestra del estado del script.
 * @param {{audienciaVista?:string, vistaEnMs?:number|null, ultimaConexionEnMs?:number|null, ultimoResultado?:string}|null} e
 * @param {{audienciaScript?:string}|null} config
 * @param {(ms:number)=>string} fecha
 * @returns {{conexion:string, resultado:string, aprobado:string, pidePermiso:boolean, audiencia:string}}
 */
export function resumenEstadoScript(e, config, fecha = (ms) => String(ms)) {
  const x = e || {};
  const aprobada = (config && config.audienciaScript) || '';
  const vista = typeof x.audienciaVista === 'string' ? x.audienciaVista : '';
  return {
    conexion: x.ultimaConexionEnMs ? fecha(x.ultimaConexionEnMs) : 'Nunca se ha conectado',
    resultado: limpiar(x.ultimoResultado) || '—',
    aprobado: aprobada ? 'Sí (hay un script aprobado)' : 'Ninguno todavía',
    pidePermiso: !!vista && esAudiencia(vista) && vista !== aprobada,
    audiencia: vista
  };
}
