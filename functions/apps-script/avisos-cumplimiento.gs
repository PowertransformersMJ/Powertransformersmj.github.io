// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Avisos de cumplimiento del cierre de ODT Afinia: el SCRIPT DE GOOGLE que los envía · 99 §236
// ──────────────────────────────────────────────────────────────
// Vive en la cuenta remitente (una cuenta de Gmail dedicada a SGM), en script.google.com. Cómo instalarlo: README.md
// de esta carpeta. Cada 10 minutos (disparador que crea instalar()) le pide a la plataforma los correos en cola y los
// envía con MailApp desde esta cuenta; después le dice a la plataforma si cada uno salió o no.
//   · Se identifica con su token de identidad de Google (ScriptApp.getIdentityToken()): nadie copia claves ni tokens.
//     La primera vez la plataforma responde «sin aprobar» y un administrador lo aprueba en SGM (Indicadores →
//     «Avisos de cumplimiento por correo» → «Aprobar este script»).
//   · Respeta el cupo diario de envíos de Google (MailApp.getRemainingDailyQuota()): sin cupo no pide nada.
//   · Nunca pierde el resultado de un envío: lo GUARDA en las propiedades del script apenas MailApp termina, ANTES de
//     reportarlo, y lo borra solo cuando la plataforma lo recibió. Si Google corta la ejecución mientras reporta (6
//     minutos por ejecución), el turno siguiente lo reporta primero, ANTES de pedir más: nada se manda dos veces.
//   · Una ejecución a la vez (LockService, sin permiso extra): el disparador y una ejecución a mano no se pisan. No
//     empieza un envío después de 4 minutos de turno, y si la plataforma no recibe un resultado, no envía más en ese
//     turno (lo que no alcanzó, la plataforma lo vuelve a entregar cuando venza su préstamo).
//   · probarConexion() escribe en el registro de ejecución el identificador de este script, para compararlo en SGM
//     antes de aprobarlo (corrector 99 §236).
//   · Sin secretos: la dirección de la función se arma con el id del proyecto de Firebase, que ya es público.
// ══════════════════════════════════════════════════════════════

const URL_FUNCION = 'https://southamerica-east1-lordpowertransformersmj.cloudfunctions.net/avisosCorreoRemitente';
const NOMBRE_REMITENTE = 'SGM · TRANSPOWER';
const FUNCION_DISPARADOR = 'enviarPendientes';
const CADA_MINUTOS = 10;
const CLAVE_SIN_REPORTAR = 'sgm_resultados_sin_reportar';
const INTENTOS_REPORTE = 3;
const ESPERA_CANDADO_MS = 1000;
const TIEMPO_MAX_TURNO_MS = 4 * 60 * 1000;

/** Se corre UNA vez, a mano: borra los disparadores propios de enviarPendientes y crea uno cada 10 minutos. */
function instalar() {
  pedirPermisosQueFalten_();
  const disparadores = ScriptApp.getProjectTriggers();
  let borrados = 0;
  for (let i = 0; i < disparadores.length; i++) {
    if (disparadores[i].getHandlerFunction() === FUNCION_DISPARADOR) { ScriptApp.deleteTrigger(disparadores[i]); borrados++; }
  }
  ScriptApp.newTrigger(FUNCION_DISPARADOR).timeBased().everyMinutes(CADA_MINUTOS).create();
  Logger.log('Listo: se borraron ' + borrados + ' disparadores anteriores y se creó uno que corre ' + FUNCION_DISPARADOR + ' cada ' + CADA_MINUTOS + ' minutos.');
  // Se conecta una vez: así el pedido de permiso aparece enseguida en SGM.
  probarConexion();
}

/** Lo que corre el disparador: reporta lo pendiente, pide los correos en cola, los envía y reporta cada resultado. */
function enviarPendientes() {
  const resumen = { enviados: 0, fallidos: 0, sinReportar: 0 };
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(ESPERA_CANDADO_MS)) { Logger.log('Otra ejecución de este script está trabajando: este turno no hace nada.'); return resumen; }
  const inicio = Date.now();
  try {
    reportarGuardados_();
    const cupo = cupoDiario_();
    if (cupo <= 0) { Logger.log('Sin cupo de envíos de Google por hoy: no se pide nada (Google lo renueva cada 24 horas).'); return resumen; }
    const r = llamar_({ accion: 'pendientes', cupo: cupo });
    if (!r.ok) { Logger.log('La plataforma no entregó correos (' + r.codigo + '): ' + r.mensaje); return resumen; }
    const correos = (r.datos && Array.isArray(r.datos.correos)) ? r.datos.correos : [];
    for (let i = 0; i < correos.length; i++) {
      const c = correos[i];
      // Google corta una ejecución a los 6 minutos: después de 4 no se empieza otro envío (el préstamo vence y vuelve).
      if (Date.now() - inicio > TIEMPO_MAX_TURNO_MS) { Logger.log('Se acaba el tiempo de este turno antes del correo ' + c.id + ': queda para el próximo.'); break; }
      const necesarios = (c.para || []).length + (c.cc || []).length;
      // Sin cupo para este: no se envía ni se reporta; el préstamo vence y la plataforma lo vuelve a entregar.
      if (cupoDiario_() < necesarios) { Logger.log('Se acabó el cupo de envíos antes del correo ' + c.id + ': queda para el próximo turno.'); break; }
      let ok = true;
      let error = '';
      try {
        MailApp.sendEmail(opcionesCorreo_(c));
      } catch (e) {
        ok = false;
        error = String((e && e.message) || e || 'Error desconocido').slice(0, 300);
      }
      if (ok) resumen.enviados++; else resumen.fallidos++;
      if (!registrarResultado_({ accion: 'resultado', id: c.id, prestamo: c.prestamo, ok: ok, error: error })) {
        resumen.sinReportar++;
        Logger.log('La plataforma no recibe los resultados: no se envía nada más en este turno.');
        break;
      }
    }
  } catch (e) {
    Logger.log('Falló el turno (se reintenta en ' + CADA_MINUTOS + ' minutos): ' + String((e && e.message) || e));
  } finally {
    candado.releaseLock();
  }
  Logger.log('Turno: ' + resumen.enviados + ' enviados, ' + resumen.fallidos + ' con error, ' + resumen.sinReportar + ' por reportar.');
  return resumen;
}

/**
 * Llama a la plataforma y escribe en el registro de ejecución qué respondió y el identificador de este script (el que
 * SGM muestra al pedir permiso: deben ser el mismo antes de aprobarlo).
 */
function probarConexion() {
  pedirPermisosQueFalten_();
  const r = llamar_({ accion: 'probar' });
  Logger.log('La plataforma respondió ' + r.codigo + ': ' + r.mensaje);
  const aud = r.datos && typeof r.datos.audiencia === 'string' ? r.datos.audiencia : '';
  if (aud) Logger.log('Identificador de este script: ' + aud + ' (en SGM debe salir el mismo antes de aprobarlo).');
  return r;
}

// ── Lo de adentro ─────────────────────────────────────────────
/**
 * La pantalla de permisos de Google trae una casilla por permiso: la que quede sin marcar no se concede, y el editor
 * ya no vuelve a mostrar la pantalla (lo vivido al instalarlo, 99 §236.9). requireAllScopes corta la ejecución y vuelve
 * a pedir SOLO lo que falte; con todo concedido no hace nada. Solo en las funciones que se corren a mano (instalar y
 * probarConexion): en el disparador no hay nadie que pueda aceptar.
 */
function pedirPermisosQueFalten_() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
}

function opcionesCorreo_(c) {
  const o = { to: (c.para || []).join(','), subject: String(c.asunto || ''), body: String(c.texto || ''), name: NOMBRE_REMITENTE };
  if (c.cc && c.cc.length) o.cc = c.cc.join(',');
  if (c.html) o.htmlBody = String(c.html);
  return o;
}

function cupoDiario_() {
  try { return Number(MailApp.getRemainingDailyQuota()) || 0; } catch (e) { return 0; }
}

/** POST con JSON y el token de identidad. Nunca lanza: {codigo, ok, datos, mensaje}. */
function llamar_(cuerpo) {
  try {
    const resp = UrlFetchApp.fetch(URL_FUNCION, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(cuerpo),
      headers: { Authorization: 'Bearer ' + ScriptApp.getIdentityToken() },
      muteHttpExceptions: true
    });
    const codigo = resp.getResponseCode();
    let datos = null;
    try { datos = JSON.parse(resp.getContentText()); } catch (e) { datos = null; }
    const mensaje = (datos && (datos.mensaje || datos.error)) || ('respuesta ' + codigo);
    return { codigo: codigo, ok: codigo === 200 && !!datos && datos.ok === true, datos: datos, mensaje: String(mensaje) };
  } catch (e) {
    return { codigo: 0, ok: false, datos: null, mensaje: 'Sin conexión con la plataforma: ' + String((e && e.message) || e) };
  }
}

/**
 * ¿La plataforma ya no necesita este resultado? Sí si lo registró (200), o si lo rechazó por su FORMA (400, 405, 415:
 * repetirlo no sirve). Cualquier otra respuesta (sin red, 401, 403, 404, 429, 5xx) se reintenta: si se perdiera, el
 * préstamo vencería y el correo se volvería a mandar.
 */
function quedoReportado_(r) {
  return r.ok || r.codigo === 400 || r.codigo === 405 || r.codigo === 415;
}

/**
 * Registra el resultado de un envío: lo GUARDA primero (si Google corta la ejecución mientras se reporta, el turno
 * siguiente lo reporta y el correo no se vuelve a mandar), lo reporta con reintentos y, si la plataforma lo recibió, lo
 * borra de lo guardado. true si quedó reportado.
 */
function registrarResultado_(cuerpo) {
  try { guardarSinReportar_(cuerpo); } catch (e) { Logger.log('No se pudo guardar el resultado del correo ' + cuerpo.id + ' antes de reportarlo: ' + String((e && e.message) || e)); }
  for (let i = 0; i < INTENTOS_REPORTE; i++) {
    if (quedoReportado_(llamar_(cuerpo))) {
      try { quitarSinReportar_(cuerpo.id); } catch (e) { /* el turno siguiente lo vuelve a reportar: la plataforma dice «repetido» */ }
      return true;
    }
    if (i < INTENTOS_REPORTE - 1) Utilities.sleep(1000 * (i + 1));
  }
  Logger.log('No se pudo reportar el correo ' + cuerpo.id + ': quedó guardado y se reportará en el próximo turno.');
  return false;
}

function leerSinReportar_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(CLAVE_SIN_REPORTAR) || '[]') || []; } catch (e) { return []; }
}
function escribirSinReportar_(xs) {
  const p = PropertiesService.getScriptProperties();
  if (xs.length) p.setProperty(CLAVE_SIN_REPORTAR, JSON.stringify(xs)); else p.deleteProperty(CLAVE_SIN_REPORTAR);
}
function guardarSinReportar_(cuerpo) {
  const xs = leerSinReportar_().filter(function (x) { return x.id !== cuerpo.id; });
  xs.push(cuerpo);
  escribirSinReportar_(xs);
}
function quitarSinReportar_(id) {
  escribirSinReportar_(leerSinReportar_().filter(function (x) { return x.id !== id; }));
}
/** Al comienzo de cada turno: reporta lo que quedó sin reportar (antes de pedir correos nuevos). */
function reportarGuardados_() {
  const xs = leerSinReportar_();
  if (!xs.length) return;
  const quedan = [];
  for (let i = 0; i < xs.length; i++) {
    if (!quedoReportado_(llamar_(xs[i]))) quedan.push(xs[i]);
  }
  escribirSinReportar_(quedan);
  if (quedan.length) throw new Error('quedan ' + quedan.length + ' resultados sin reportar; no se piden correos nuevos');
}
