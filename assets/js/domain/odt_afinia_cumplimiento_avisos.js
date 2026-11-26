// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · CUMPLIMIENTO DEL CIERRE · AVISOS POR CORREO (lógica PURA) · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): a los 10 días de la ejecución, avisar por correo que el contratista debe ejecutar
// a conformidad las ODT; a los 15, que hay que apresurarse a cerrarlas porque se acerca el día 20; a los 20, que deben
// cerrarse de forma inmediata. Decisiones (99 §236):
//   · Los avisos se calculan SOLO cuando se GUARDA un corte (la Cloud Function onDocumentCreated de odt_afinia_cortes,
//     en functions/index.js) o a pedido de un administrador (reprocesarAvisosCumplimiento). Solo cortes de la versión 3
//     (traen la fecha de ejecución) y solo si su responsable es el de la configuración (comparado NORMALIZADO, como en
//     todo el módulo: sin tildes, mayúsculas y espacios simples). Un corte con datos MÁS VIEJOS que otro ya guardado del
//     mismo responsable no avisa: sus ODT abiertas pudieron cerrarse después.
//   · Solo ODT abiertas (EJECUTADA). Umbral 10 si días ≥ 10, 15 si ≥ 15, 20 si ≥ 20. Cada ODT recibe cada umbral COMO
//     MUCHO UNA VEZ: odt_afinia_avisos/{nro}_{umbral} se RESERVA con create() (si ya existe, no se repite). Cuando una
//     ODT se avisa por primera vez y ya pasó varios umbrales, solo se manda el MÁS ALTO y los menores quedan «omitido»
//     (nunca se mandan después). Un aviso en «error» (falló el envío) lo toma el siguiente proceso que lo necesite.
//   · Hasta 3 correos por corte, uno por umbral con ODT: odt_afinia_correos/{corteId}_{umbral} {corteId, umbral,
//     responsable, para, cc, asunto, texto, html, nros, estado, error, creadoEn, encoladoEnMs, enviadoEn, intentos,
//     prestamo, prestamoHastaMs, prestadoEn, reemplazadoPor?}. Desde el pedido del 2026-11-26 («cuándo y cuántas veces
//     notificas», 99 §236) cada correo nuevo suma paraNombres (los nombres de config.para), datosDel (la fecha de los
//     datos del corte, en llano) y responsableNorm (el responsable normalizado: la cola se consulta por él).
//   · CAMBIO del 2026-11-26 (99 §236: sin contraseña de aplicación de Gmail): las Cloud Functions YA NO ENVÍAN correo.
//     Este proceso arma cada correo y lo deja EN COLA («pendiente»); lo envía un script de Google que vive en la cuenta
//     remitente (functions/apps-script/), que cada 10 minutos le pide los pendientes a la función avisosCorreoRemitente
//     y le informa el resultado (domain/odt_afinia_cumplimiento_remitente.js). Estados de un correo: 'pendiente' (en
//     cola) → 'en_envio' (prestado al script, con su préstamo) → 'enviado' | 'error' (el error, en llano). Un correo en
//     «error» vuelve a «pendiente» cuando se REPROCESA su corte (re-armado con las ODT que todavía le tocan: lo ya
//     enviado no se repite); sus avisos quedan en «error» para que el reproceso o el corte siguiente los retomen.
//   · Lo que OTRO corte del mismo responsable dejó en cola y todavía no salió ya no se envía cuando se procesa uno más
//     reciente (sus ODT pudieron cerrarse): queda «error» con reemplazadoPor y sus avisos vuelven a «error», para que
//     este corte los revise con datos frescos (deps.listarCola + reemplazarCorreo + marcarAvisosDeCorreo).
//     Corrector ronda 1: lo mismo con los correos de cortes anteriores que ya estaban en «error» (el corte viejo ya no
//     se puede reprocesar): quedan con reemplazadoPor y conservan su motivo (deps.listarErroresVigentes +
//     marcarErrorReemplazado). Si no, la tarjeta «Con error» los contaría para siempre.
//   · creadoEn de un correo es cuándo quedó en cola por ÚLTIMA vez: al reabrirse un correo en «error» se renueva
//     (corrector ronda 1: la tabla de notificaciones ordena por él).
//   · Un proceso que se CORTA a mitad (un error de la base, la instancia que se cae o se queda sin tiempo) no deja una
//     ODT sin su aviso para siempre: si falla la base, lo que este proceso reservó vuelve a «error»; y un aviso que otro
//     correo dejó «reservado» (cada aviso guarda intentoEnMs) se da por ABANDONADO —y lo toma el proceso siguiente—
//     cuando su correo no existe pasado el candado (LEASE_ENVIO_MS) o está en «error» (avisosAbandonados). Uno cuyo
//     correo sigue en cola o en manos del script NO está abandonado: sale con ese correo. Si su correo SÍ salió con esa
//     ODT, el aviso se marca «enviado» (no se repite).
//   · Solo genera avisos un corte cuya fecha de datos salió de la hora de descarga del nombre del archivo: sin ella, la
//     fecha del corte sería la prevista más reciente (puede ser futura) y los días saldrían inflados ('sin_hora_de_descarga').
//   · Sin configuración, o con activo == false: no se envía nada (se deja el motivo en el registro de la función). Con
//     activo == false, un corte válido y más reciente igual retira de la cola lo de cortes anteriores (corrector):
//     al reactivarlos solo sale lo del corte más reciente.
// Todo lo que toca la red o la base llega INYECTADO en `deps` (las pruebas de functions/tests/ usan dobles):
//   leerConfig() · leerCorte(id) · leerPartes(id) → [{id, data}] · hayCorteMasReciente(corte) · leerAvisos(ids) → Map ·
//   leerCorreos(ids) → Map · crearAviso(id, datos) → true | false (ya existía) · cambiarAvisoSi(id, esperado, cambios)
//   → true | false (esperado: el estado, o {estado, correoId}) · actualizarAvisos(ids, cambios) · encolarCorreo(id,
//   datos, {ahoraMs}) → {estado:'nuevo'|'actualizado'|'reabierto'|'ocupado'|'enviado', nros?} · listarCola(limite,
//   estados, {responsableNorm}) → [{id, …}] (los más viejos primero; los de ese responsable y los viejos sin
//   responsableNorm) · reemplazarCorreo(id, {porCorte, error}) → {ok, nros, umbral} · marcarAvisosDeCorreo(correoId,
//   {ids, estado}) · listarErroresVigentes(limite, {responsableNorm}) → [{id, …}] · marcarErrorReemplazado(id,
//   {porCorte}) → true | false (las cinco, opcionales) · marca() (hora del servidor) · ahora() → Date · log(nivel,
//   mensaje, datos) · esperar(ms) (opcional: la pausa entre reintentos).
// Sin Firebase, sin DOM, sin red (copiado a functions/domain por functions/prepare-deploy.mjs).
// Archivo NUEVO a propósito (L-102): a su vecino de antes (odt_afinia_indicadores.js) solo le pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { normalizarNombre, fechaDMA, textoFechaDatos, limpiar } from './odt_afinia_indicadores.js';
import {
  UMBRALES_AVISO, PLAZO_CIERRE_DIAS, corteTraeEjecucion, corteConHoraDeDescarga, fechaDelCorte, evaluarCumplimiento, errorConfigCumplimiento,
  normalizarConfig
} from './odt_afinia_cumplimiento.js';

export const ESTADOS_AVISO = Object.freeze(['reservado', 'enviado', 'omitido', 'error']);
/** pendiente: en cola · en_envio: prestado al script de Google · enviado · error (99 §236). */
export const ESTADOS_CORREO = Object.freeze(['pendiente', 'en_envio', 'enviado', 'error']);
/** Una reserva de avisos SIN su correo (el proceso se cortó antes de dejarlo en cola) se respeta este tiempo. */
export const LEASE_ENVIO_MS = 15 * 60 * 1000;
/**
 * Tope del cuerpo de un correo (texto + HTML, en caracteres): el envío de Google (MailApp) acepta unos 200 KB por
 * mensaje en una cuenta de Gmail. Si el HTML no cabe, el correo va solo con el texto (la misma tabla, en líneas).
 */
export const TOPE_CUERPO_CORREO = 180000;
/** Cuántos correos de la cola se leen de una vez (la cola casi nunca pasa de 3 por corte). */
export const COLA_MAX = 50;
/** Lo que queda en un correo en cola que un corte más reciente reemplazó (99 §236). */
export const TEXTO_REEMPLAZADO = 'No se envió: lo reemplazó un corte con datos más recientes (sus ODT se revisan con ese corte).';
/** Partes que lee la función (las mismas que la regla deja listar). */
export const PARTES_MAX = 60;
const RE_ID_CORTE = /^[A-Za-z0-9]{20}$/;
export const esIdCorte = (v) => typeof v === 'string' && RE_ID_CORTE.test(v);
/** El id de un aviso: el N.º (solo letras, números, «_» y «-») y el umbral. */
export const idAviso = (nro, umbral) => String(nro).replace(/[^A-Za-z0-9_-]/g, '_') + '_' + umbral;
export const idCorreo = (corteId, umbral) => corteId + '_' + umbral;

/**
 * Las ODT de un corte desde sus partes (la función no puede importar data/: este es su lector). Completo = las partes
 * 0..nPartes-1, todas con ODT que traen N.º y estado, y tantas ODT como dice el corte.
 * @returns {{odts:object[], completo:boolean}}
 */
export function unirPartesCumplimiento(corte, partes) {
  const n = corte && Number.isInteger(corte.nPartes) ? corte.nPartes : 0;
  const porK = new Map();
  for (const p of partes || []) {
    const k = Number(p && p.id);
    if (Number.isInteger(k) && k >= 0 && k < n && p.data && Array.isArray(p.data.odts)) porK.set(k, p.data.odts);
  }
  const odts = [];
  let bien = n >= 1;
  for (let k = 0; k < n; k++) {
    const xs = porK.get(k);
    if (!xs) { bien = false; continue; }
    for (const o of xs) {
      if (o && typeof o === 'object' && typeof o.nro === 'string' && o.nro && typeof o.estado === 'string') odts.push(o);
      else bien = false;
    }
  }
  return { odts, completo: bien && odts.length === corte.odts };
}

// ── El plan de avisos (puro) ───────────────────────────────────────────────────
/**
 * Los avisos «reservado» por OTRO correo cuyo proceso se cortó (99 §236): 'libre' (se puede tomar u omitir) si su
 * correo no existe y la reserva tiene más de `leaseMs`, si su correo está en «error» (o salió SIN esa ODT); 'enviado'
 * si su correo salió CON esa ODT (el aviso solo no se marcó). Un correo en cola («pendiente») o en manos del script de
 * Google («en_envio») NO abandona sus avisos: salen con él. Los reservados por el correo de ESTE corte no entran (los
 * retoma planAvisos con 'reintentar').
 * @param {Map<string, object>} existentes  idAviso → aviso
 * @param {Map<string, object>} correos  idCorreo → correo (los que nombran esos avisos)
 * @param {{corteId:string, ahoraMs:number, leaseMs?:number}} p
 * @returns {Map<string, 'libre'|'enviado'>}
 */
export function avisosAbandonados(existentes, correos, { corteId, ahoraMs, leaseMs = LEASE_ENVIO_MS }) {
  const out = new Map();
  const cs = correos instanceof Map ? correos : new Map();
  const vencido = (ms) => ahoraMs - (Number(ms) || 0) >= leaseMs;
  for (const [id, d] of existentes instanceof Map ? existentes : []) {
    if (!d || d.estado !== 'reservado' || !d.correoId || d.correoId === idCorreo(corteId, d.umbral)) continue;
    const c = cs.get(d.correoId) || null;
    if (!c) { if (vencido(d.intentoEnMs)) out.set(id, 'libre'); continue; }
    if (c.estado === 'enviado') out.set(id, Array.isArray(c.nros) && c.nros.includes(d.nro) ? 'enviado' : 'libre');
    else if (c.estado === 'error') out.set(id, 'libre');
  }
  return out;
}
/** Lo que se exige al cambiar un aviso: su estado y, si estaba reservado, que siga siendo de ESE correo. */
const esperadoDe = (d) => (d.estado === 'reservado' ? { estado: 'reservado', correoId: d.correoId } : d.estado);
/**
 * Qué hacer con cada ODT abierta que llegó a un umbral, según los avisos que ya existen.
 * @param {object[]} candidatas  evaluaciones de ODT abiertas con umbral ≥ 10 (evaluarCumplimiento)
 * @param {Map<string, object>} existentes  idAviso → documento
 * @param {string} corteId
 * @param {Map<string, 'libre'|'enviado'>} [abandonados]  avisosAbandonados
 * @returns {Array<{e, umbral, id, accion:'reservar'|'tomar'|'reintentar'|'omitirMio'|'nada', menores:Array<{id, umbral,
 *          accion:'crearOmitido'|'omitirError', esperado?}>, estadoActual?:string, esperado?}>}
 *   reservar: crear el aviso (create); tomar: un aviso en «error» (o abandonado por otro correo) pasa a este correo;
 *   reintentar: ya estaba reservado para este mismo correo (un proceso que se cortó); omitirMio: estaba reservado/en
 *   error para este correo, pero ya salió o va a salir uno MAYOR (no se manda uno menor después de uno mayor).
 *   esperado: lo que debe seguir siendo el aviso para cambiarlo (cambiarAvisoSi).
 */
export function planAvisos(candidatas, existentes, corteId, abandonados = new Map()) {
  const ex = existentes instanceof Map ? existentes : new Map();
  const ab = abandonados instanceof Map ? abandonados : new Map();
  const out = [];
  for (const e of candidatas || []) {
    const U = e.umbral;
    if (!UMBRALES_AVISO.includes(U)) continue;
    const nro = e.o.nro;
    const doc = (u) => ex.get(idAviso(nro, u)) || null;
    /** En «error», o reservado por otro correo que lo abandonó: se puede tomar (u omitir). */
    const libre = (u) => { const d = doc(u); return !!d && (d.estado === 'error' || (d.estado === 'reservado' && ab.get(idAviso(nro, u)) === 'libre')); };
    /** Ya salió, o va a salir (una reserva abandonada no cuenta). */
    const activo = (u) => { const d = doc(u); return !!d && (d.estado === 'enviado' || (d.estado === 'reservado' && ab.get(idAviso(nro, u)) !== 'libre')); };
    const id = idAviso(nro, U);
    const exU = doc(U);
    const mio = !!exU && exU.correoId === idCorreo(corteId, U);
    const mayor = UMBRALES_AVISO.some((h) => h > U && activo(h));
    const menores = [];
    const conMenores = () => {
      for (const l of UMBRALES_AVISO.filter((x) => x < U)) {
        const d = doc(l);
        if (!d) menores.push({ id: idAviso(nro, l), umbral: l, accion: 'crearOmitido' });
        else if (libre(l)) menores.push({ id: idAviso(nro, l), umbral: l, accion: 'omitirError', esperado: esperadoDe(d) });
      }
    };
    let accion = 'nada';
    if (mayor) {
      if (mio && (exU.estado === 'reservado' || exU.estado === 'error')) accion = 'omitirMio';
    } else if (!exU) accion = 'reservar';
    else if (exU.estado === 'reservado' && mio) accion = 'reintentar';
    else if (libre(U)) accion = 'tomar';
    if (accion === 'reservar' || accion === 'tomar' || accion === 'reintentar') conMenores();
    out.push({ e, umbral: U, id, accion, menores, estadoActual: exU ? exU.estado : '', esperado: exU ? esperadoDe(exU) : '' });
  }
  return out;
}

// ── El correo de un umbral ─────────────────────────────────────────────────────
const pl = (n, uno, varios) => (n === 1 ? uno : varios);
const num = (n) => Number(n || 0).toLocaleString('es-CO');
const escapar = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** «Ana», «Ana y Luis», «Ana, Luis y Eva». */
export function listaNombres(nombres) {
  const xs = (nombres || []).map((x) => limpiar(x)).filter(Boolean);
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
}
/** Asunto de cada umbral (N = cuántas ODT lleva el correo). */
export function asuntoCorreo(umbral, n) {
  const cuantas = ' (' + num(n) + ' ODT)';
  if (umbral === 10) return 'SGM · ODT con 10 días desde su ejecución: el contratista debe ejecutarlas a conformidad' + cuantas;
  if (umbral === 15) return 'SGM · ODT con 15 días desde su ejecución: apresurar el cierre' + cuantas;
  return 'SGM · INCUMPLIMIENTO: ODT con 20 días o más desde su ejecución, cerrar de inmediato' + cuantas;
}
/** Los párrafos del cuerpo de cada umbral (singular con 1 ODT). */
export function parrafosCorreo(umbral, n) {
  const una = n === 1;
  const plazo = 'El plazo máximo de cierre es de ' + PLAZO_CIERRE_DIAS + ' días calendario desde la ejecución.';
  if (umbral === 10) {
    return [
      (una ? 'La siguiente ODT cumple' : 'Las siguientes ' + num(n) + ' ODT cumplen') + ' 10 días o más desde su ejecución y ' + pl(n, 'sigue', 'siguen') + ' sin cerrar.',
      'El contratista debe ' + pl(n, 'ejecutarla', 'ejecutarlas') + ' a conformidad: con los soportes completos y conformes (control previo, registro fotográfico y la ODT firmada por el jefe de trabajo).',
      plazo
    ];
  }
  if (umbral === 15) {
    return [
      (una ? 'La siguiente ODT cumple' : 'Las siguientes ' + num(n) + ' ODT cumplen') + ' 15 días o más desde su ejecución y ' + pl(n, 'sigue', 'siguen') + ' sin cerrar.',
      'Hay que apresurarse a ' + pl(n, 'cerrarla', 'cerrarlas') + ': se acerca el día 20. ' + plazo
    ];
  }
  return [
    (una ? 'La siguiente ODT alcanzó o superó' : 'Las siguientes ' + num(n) + ' ODT alcanzaron o superaron') + ' el plazo de ' + PLAZO_CIERRE_DIAS + ' días calendario desde su ejecución y ' + pl(n, 'sigue', 'siguen') + ' sin cerrar.',
    pl(n, 'Debe cerrarse', 'Deben cerrarse') + ' de forma inmediata, con el debido proceso. Pasar los ' + PLAZO_CIERRE_DIAS + ' días es un incumplimiento del contratista.'
  ];
}
/** «Vence hoy» (20 días) o «Incumplimiento» (más de 20); solo en el correo de 20. */
export const situacion = (dias) => (dias === PLAZO_CIERRE_DIAS ? 'Vence hoy' : dias > PLAZO_CIERRE_DIAS ? 'Incumplimiento' : '');
/** El pie de todos los correos. */
export function pieCorreo(corte) {
  return 'Según el informe de Afinia con datos del ' + textoFechaDatos(corte) + ' · Responsable O.D.T.: ' + (limpiar(corte && corte.responsable) || '—') + ' · Mensaje generado por SGM · TRANSPOWER';
}
/** Las ODT de un correo agrupadas por contratista (por nombre; dentro, más días primero y luego N.º). */
export function porContratista(evaluadas) {
  const m = new Map();
  for (const e of evaluadas || []) {
    const k = limpiar(e.o.empresa) || '(sin contratista)';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([contratista, xs]) => ({ contratista, odts: xs.sort((a, b) => b.dias - a.dias || String(a.o.nro).localeCompare(String(b.o.nro))) }));
}
/** Las columnas de la tabla de cada contratista (la de 20 suma «Situación»). */
export function columnasCorreo(umbral) {
  return ['N.º ODT', 'Subestación', 'Equipo', 'Contratista', 'Fecha de ejecución', 'Días transcurridos', 'Fecha límite (ejecución + 20 días)', ...(umbral === 20 ? ['Situación'] : [])];
}
const filaCorreo = (umbral, e) => [e.o.nro, limpiar(e.o.subestacion) || '—', limpiar(e.o.equipo) || '—', limpiar(e.o.empresa) || '(sin contratista)', fechaDMA(e.o.ejecucion),
  String(e.dias), fechaDMA(e.limite), ...(umbral === 20 ? [situacion(e.dias)] : [])];

/**
 * El correo de un umbral: {asunto, texto, html}. El saludo usa los nombres de la configuración (nunca del código).
 * @param {{umbral:number, evaluadas:object[], config:object, corte:object}} p
 */
export function armarCorreo({ umbral, evaluadas, config, corte }) {
  const n = (evaluadas || []).length;
  const asunto = asuntoCorreo(umbral, n);
  const saludo = 'Buen día, ' + (listaNombres(((config && config.para) || []).map((p) => p.nombre)) || 'equipo') + ':';
  const parrafos = parrafosCorreo(umbral, n);
  const grupos = porContratista(evaluadas);
  const cols = columnasCorreo(umbral);
  const pie = pieCorreo(corte);
  const texto = [saludo, '', ...parrafos.flatMap((p) => [p, '']),
    ...grupos.flatMap((g) => [g.contratista + ' (' + num(g.odts.length) + ' ODT)',
      ...g.odts.map((e) => '  • ' + filaCorreo(umbral, e).map((v, i) => cols[i] + ': ' + v).join(' · ')), '']),
    pie].join('\n');
  const celda = (tag, v, extra = '') => '<' + tag + extra + ' style="padding:6px 8px;border:1px solid #c9d3e3;text-align:left;vertical-align:top">' + escapar(v) + '</' + tag + '>';
  const tabla = (g) => '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:0 0 16px">'
    + '<caption style="text-align:left;font-weight:bold;padding:0 0 6px">' + escapar(g.contratista + ' (' + num(g.odts.length) + ' ODT)') + '</caption>'
    + '<thead><tr style="background:#eaf2ff">' + cols.map((c) => celda('th', c, ' scope="col"')).join('') + '</tr></thead>'
    + '<tbody>' + g.odts.map((e) => '<tr>' + filaCorreo(umbral, e).map((v, i) => celda(i === 0 ? 'th' : 'td', v, i === 0 ? ' scope="row"' : '')).join('') + '</tr>').join('') + '</tbody></table>';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#0d1f38">'
    + '<p>' + escapar(saludo) + '</p>' + parrafos.map((p) => '<p>' + escapar(p) + '</p>').join('')
    + grupos.map(tabla).join('')
    + '<p style="font-size:12px;color:#4d6485;margin-top:18px">' + escapar(pie) + '</p></div>';
  return { asunto, texto, html };
}

// ── Lo que la pantalla dice de los correos y del reproceso ─────────────────────
export const ETIQUETA_UMBRAL = Object.freeze({ 10: '10 días (ejecutar a conformidad)', 15: '15 días (apresurar el cierre)', 20: '20 días o más (cerrar de inmediato)' });
export const ETIQUETA_ESTADO_CORREO = Object.freeze({
  pendiente: 'En cola: lo enviará el script de Google en los próximos minutos',
  en_envio: 'Enviándose: el script de Google lo tomó y falta que confirme el envío',
  enviado: 'Enviado',
  error: 'No se pudo enviar'
});
/** Un correo «en_envio» cuyo préstamo venció: el script lo tomó y no confirmó (corrector 99 §236). */
export const TEXTO_PRESTAMO_VENCIDO = 'El script de Google lo tomó y no confirmó el envío: lo volverá a intentar en su próxima conexión (si sigue así, revise que el script siga instalado en la cuenta remitente)';
/**
 * El estado de un correo en llano, para el historial (99 §236). `fecha(ms)` da formato a la hora de envío; con
 * `ahoraMs`, un «en_envio» cuyo préstamo ya venció lo dice (no se queda en «Enviándose» para siempre).
 * @param {{estado?:string, error?:string, enviadoEnMs?:number, reemplazadoPor?:string, prestamoHastaMs?:number}} c
 */
export function textoEstadoCorreo(c, fecha = (ms) => String(ms), ahoraMs = NaN) {
  const x = c || {};
  // Corrector ronda 1 (99 §236): un correo que FALLÓ y después lo reemplazó un corte más reciente conserva su motivo.
  if (x.estado === 'error' && x.reemplazadoPor && x.error && x.error !== TEXTO_REEMPLAZADO) return ETIQUETA_ESTADO_CORREO.error + ': ' + x.error + ' (sus ODT se revisaron con un corte con datos más recientes)';
  if (x.estado === 'error' && x.reemplazadoPor) return 'No se envió: lo reemplazó un corte con datos más recientes';
  if (x.estado === 'en_envio' && Number.isFinite(ahoraMs) && Number(x.prestamoHastaMs) > 0 && Number(x.prestamoHastaMs) <= ahoraMs) return TEXTO_PRESTAMO_VENCIDO;
  const base = ETIQUETA_ESTADO_CORREO[x.estado] || x.estado || '—';
  if (x.estado === 'enviado' && x.enviadoEnMs) return base + ' el ' + fecha(x.enviadoEnMs);
  if (x.estado === 'error' && x.error) return base + ': ' + x.error;
  return base;
}
/** Por qué un proceso no envió nada, en llano. */
export const TEXTO_MOTIVO = Object.freeze({
  id_invalido: 'El corte no es válido.',
  sin_corte: 'Ese corte no existe en la plataforma.',
  sin_config: 'Todavía no hay configuración de los avisos: guárdela en «Avisos de cumplimiento por correo». No se envió nada.',
  config_invalida: 'La configuración de los avisos no es válida: revísela en «Avisos de cumplimiento por correo». No se envió nada.',
  inactivo: 'Los avisos están desactivados en la configuración. No se envió nada.',
  version: 'Este corte se guardó sin la fecha de ejecución de las ODT: no genera avisos. Guarde un corte nuevo.',
  otro_responsable: 'Este corte es de un responsable distinto al de la configuración de los avisos: no genera avisos.',
  sin_hora_de_descarga: 'El nombre del archivo de este corte no trae la hora de descarga de Afinia (INFORME_ODT_aaaammddhhmmss…): sin ella no se sabe hasta qué fecha contar los días, así que no genera avisos. Guarde el corte con el archivo tal como lo descarga Afinia, sin cambiarle el nombre.',
  hay_corte_mas_reciente: 'Hay un corte de este responsable con datos más recientes: los avisos se revisan con ese (este podría avisar de ODT que ya se cerraron).',
  corte_incompleto: 'Este corte está incompleto: no genera avisos.',
  sin_avisos: 'Ninguna ODT abierta de este corte llega todavía a 10 días desde su ejecución: no hay avisos que enviar.'
});
/** El resultado de un reproceso en llano: qué quedó en cola, qué falló y qué ya estaba (99 §236). */
export function textoResultadoReproceso(r) {
  if (!r || typeof r !== 'object') return 'La plataforma no devolvió el resultado. Mire el historial de correos.';
  if (r.motivo && r.motivo !== 'procesado') return TEXTO_MOTIVO[r.motivo] || ('No se envió nada (' + r.motivo + ').');
  const partes = [];
  const encolados = Array.isArray(r.encolados) ? r.encolados : [];
  const errores = Array.isArray(r.errores) ? r.errores : [];
  const reabiertos = Array.isArray(r.reabiertos) ? r.reabiertos : [];
  if (encolados.length) {
    partes.push('Quedaron en cola ' + encolados.length + pl(encolados.length, ' correo', ' correos') + ': ' + encolados.map((x) => 'el de ' + x.umbral + ' días (' + num(x.n) + ' ODT)').join(', ') + '. Los enviará el script de Google de la cuenta remitente en los próximos minutos (mire el historial).');
  }
  if (reabiertos.length) partes.push('El de ' + reabiertos.join(' y ') + ' días había fallado: vuelve a intentarse.');
  for (const x of errores) partes.push('No se pudo dejar en cola el de ' + x.umbral + ' días (' + num(x.n) + ' ODT): ' + String(x.error || '').replace(/[.…\s]+$/, '') + '. Quedó para reintentar.');
  if (Array.isArray(r.ocupados) && r.ocupados.length) partes.push('El correo de ' + r.ocupados.join(' y ') + ' días ya lo tomó el script de Google para enviarlo: mire el historial en unos minutos (si no cambia, revise que el script siga instalado en la cuenta remitente).');
  if (!partes.length) partes.push('No había avisos pendientes: lo que ya se envió no se repite.');
  return partes.join(' ');
}

/** El texto técnico de un error (para el registro de la función), recortado. */
export function textoTecnico(e) {
  const t = limpiar((e && (e.message || e.code)) || String(e || 'Error desconocido'));
  return t.length > 300 ? t.slice(0, 300) + '…' : t;
}
/** Un correo listo para la cola: si texto + HTML no caben en un mensaje (TOPE_CUERPO_CORREO), va solo con el texto. */
export function correoParaCola(c) {
  return (c.texto.length + c.html.length) > TOPE_CUERPO_CORREO ? { ...c, html: '' } : c;
}
/** Hace `fn` hasta 3 veces (con una pausa entre intentos); true si salió bien. Nunca lanza. */
async function conReintentos(fn, esperar, pausas = [300, 1500]) {
  for (let i = 0; ; i++) {
    try { await fn(); return true; } catch (_) {
      if (i >= pausas.length) return false;
      await esperar(pausas[i]);
    }
  }
}

// ── El proceso de un corte (con dependencias inyectadas) ───────────────────────
/**
 * Revisa un corte guardado y deja EN COLA los avisos que falten (99 §236: los envía el script de Google).
 * @param {string} corteId
 * @param {object} deps  (ver la cabecera)
 * @param {{origen?:string}} [op]
 * @returns {Promise<{corteId:string, motivo:string, encolados:Array<{umbral:number, n:number}>, reabiertos:number[],
 *          errores:Array<{umbral:number, n:number, error:string}>, ocupados:number[], omitidos:number, reservados:number,
 *          reemplazados:number}>}
 *   motivo: 'procesado' o por qué no se hizo nada ('id_invalido', 'sin_config', 'config_invalida', 'inactivo',
 *   'sin_corte', 'version', 'otro_responsable', 'sin_hora_de_descarga', 'hay_corte_mas_reciente', 'corte_incompleto',
 *   'sin_avisos'). reabiertos: umbrales cuyo correo estaba en «error» y vuelve a la cola. ocupados: umbrales cuyo
 *   correo tiene ahora el script (sale con las ODT que ya llevaba). reemplazados: correos en cola de otros cortes del
 *   responsable que ya no se envían (este es más reciente).
 *   Si la base falla al reservar los avisos, lo reservado vuelve a «error» y el error se lanza (lo registra la función).
 */
export async function procesarCorteCumplimiento(corteId, deps, { origen = '' } = {}) {
  const log = typeof deps.log === 'function' ? deps.log : () => {};
  const esperar = typeof deps.esperar === 'function' ? deps.esperar : (ms) => new Promise((r) => setTimeout(r, ms));
  const resumen = { corteId, motivo: 'procesado', encolados: [], reabiertos: [], errores: [], ocupados: [], omitidos: 0, reservados: 0, reemplazados: 0 };
  const fin = (motivo, extra = {}) => {
    const r = { ...resumen, motivo, ...extra };
    log(motivo === 'procesado' ? 'info' : 'aviso', 'Avisos de cumplimiento (' + (origen || 'proceso') + '): ' + motivo, { corteId, ...extra });
    return r;
  };
  if (!esIdCorte(corteId)) return fin('id_invalido');
  const crudo = await deps.leerConfig();
  if (!crudo) return fin('sin_config');
  const config = normalizarConfig(crudo);
  const errCfg = errorConfigCumplimiento(config);
  if (errCfg) return fin('config_invalida', { detalle: errCfg });
  // Corrector 99 §236: con los avisos DESACTIVADOS no se encola nada, pero un corte válido y más reciente igual retira
  // de la cola lo que dejaron los cortes anteriores (abajo). Si no, al reactivarlos el script mandaría «cerrar de
  // inmediato» por ODT que los datos nuevos ya muestran cerradas. Desactivados, el motivo siempre es 'inactivo'.
  const activo = config.activo === true;
  const no = (motivo) => fin(activo ? motivo : 'inactivo');
  const corte = await deps.leerCorte(corteId);
  if (!corte) return no('sin_corte');
  if (!corteTraeEjecucion(corte)) return no('version');
  if (normalizarNombre(corte.responsable) !== normalizarNombre(config.responsable)) return no('otro_responsable');
  if (!corteConHoraDeDescarga(corte)) return no('sin_hora_de_descarga');
  if (await deps.hayCorteMasReciente(corte)) return no('hay_corte_mas_reciente');
  const { odts, completo } = unirPartesCumplimiento(corte, await deps.leerPartes(corteId));
  if (!completo) return no('corte_incompleto');
  // 99 §236: lo que OTRO corte del responsable dejó en cola y no salió ya no se envía (este es más reciente); sus avisos
  // vuelven a «error» y este corte los revisa con datos frescos. Si la base falla aquí, se sigue (queda en el registro).
  if (typeof deps.listarCola === 'function' && typeof deps.reemplazarCorreo === 'function') {
    try {
      for (const c of await deps.listarCola(COLA_MAX, ['pendiente'], { responsableNorm: normalizarNombre(corte.responsable) })) {
        if (!c || c.corteId === corteId || normalizarNombre(c.responsable) !== normalizarNombre(corte.responsable)) continue;
        const x = await deps.reemplazarCorreo(c.id, { porCorte: corteId, error: TEXTO_REEMPLAZADO });
        if (!x || !x.ok) continue;
        resumen.reemplazados++;
        if (typeof deps.marcarAvisosDeCorreo === 'function') await deps.marcarAvisosDeCorreo(c.id, { ids: (Array.isArray(x.nros) ? x.nros : []).map((n) => idAviso(n, x.umbral)), estado: 'error' });
      }
      // Corrector ronda 1 (99 §236): los correos en «error» de cortes anteriores del responsable también quedan
      // reemplazados (conservan su motivo). Sus avisos ya están en «error» y este corte los toma si todavía hacen falta.
      if (typeof deps.listarErroresVigentes === 'function' && typeof deps.marcarErrorReemplazado === 'function') {
        for (const c of await deps.listarErroresVigentes(COLA_MAX, { responsableNorm: normalizarNombre(corte.responsable) })) {
          if (!c || c.corteId === corteId || normalizarNombre(c.responsable) !== normalizarNombre(corte.responsable)) continue;
          await deps.marcarErrorReemplazado(c.id, { porCorte: corteId });
        }
      }
    } catch (e) {
      log('error', 'Avisos de cumplimiento: no se pudo retirar de la cola lo de cortes anteriores', { corteId, error: textoTecnico(e) });
    }
  }
  if (!activo) return fin('inactivo');
  const ev = evaluarCumplimiento(odts, fechaDelCorte(corte));
  const candidatas = ev.abiertas.filter((e) => e.umbral >= UMBRALES_AVISO[0]);
  if (!candidatas.length) return fin('sin_avisos');

  const ids = candidatas.flatMap((e) => UMBRALES_AVISO.map((u) => idAviso(e.o.nro, u)));
  const existentes = await deps.leerAvisos([...new Set(ids)]);
  const ahoraMs = deps.ahora().getTime();
  // Los avisos que OTRO correo dejó «reservado»: ¿su proceso se cortó? (se mira su correo)
  const ajenos = [...existentes.values()].filter((d) => d && d.estado === 'reservado' && d.correoId && d.correoId !== idCorreo(corteId, d.umbral));
  const correosAjenos = ajenos.length && typeof deps.leerCorreos === 'function' ? await deps.leerCorreos([...new Set(ajenos.map((d) => d.correoId))]) : new Map();
  const abandonados = typeof deps.leerCorreos === 'function' ? avisosAbandonados(existentes, correosAjenos, { corteId, ahoraMs }) : new Map();
  const plan = planAvisos(candidatas, existentes, corteId, abandonados);
  const marca = () => (typeof deps.marca === 'function' ? deps.marca() : deps.ahora());
  /** Por umbral: las evaluaciones que van en su correo (sus avisos los reservó ESTE proceso). */
  const grupos = new Map(UMBRALES_AVISO.map((u) => [u, []]));
  /** Lo que este proceso reservó y no alcanzó a enviar vuelve a «error» (lo toma el próximo proceso). Nunca lanza. */
  const soltar = async (umbrales) => {
    for (const u of umbrales) {
      for (const e of grupos.get(u)) {
        try { await deps.cambiarAvisoSi(idAviso(e.o.nro, u), { estado: 'reservado', correoId: idCorreo(corteId, u) }, { estado: 'error', en: marca() }); } catch (_) { /* lo toma el próximo proceso cuando venza el candado */ }
      }
    }
  };
  try {
    // Un aviso que quedó «reservado» pero cuyo correo SÍ salió con esa ODT: se marca «enviado» (no se repite).
    for (const [id, que] of abandonados) {
      const d = existentes.get(id);
      if (que === 'enviado' && d) await deps.cambiarAvisoSi(id, esperadoDe(d), { estado: 'enviado', en: marca() });
    }
    for (const p of plan) {
      const nro = p.e.o.nro;
      const correoId = idCorreo(corteId, p.umbral);
      const base = { nro, umbral: p.umbral, corteId, correoId, dias: p.e.dias, en: marca(), intentoEnMs: ahoraMs };
      let va = false;
      if (p.accion === 'reservar') va = await deps.crearAviso(p.id, { ...base, estado: 'reservado' });
      else if (p.accion === 'tomar') va = await deps.cambiarAvisoSi(p.id, p.esperado, { estado: 'reservado', corteId, correoId, dias: p.e.dias, en: marca(), intentoEnMs: ahoraMs });
      else if (p.accion === 'reintentar') va = true;
      else if (p.accion === 'omitirMio') {
        if (await deps.cambiarAvisoSi(p.id, p.estadoActual, { estado: 'omitido', en: marca() })) resumen.omitidos++;
      }
      if (!va) continue;
      resumen.reservados++;
      grupos.get(p.umbral).push(p.e);
      // Los umbrales menores que nunca se mandaron quedan «omitido» (nunca se mandan después de uno mayor).
      for (const m of p.menores) {
        const datos = { nro, umbral: m.umbral, corteId, correoId: '', dias: p.e.dias, en: marca(), estado: 'omitido' };
        const ok = m.accion === 'crearOmitido' ? await deps.crearAviso(m.id, datos) : await deps.cambiarAvisoSi(m.id, m.esperado, { estado: 'omitido', corteId, correoId: '', en: marca() });
        if (ok) resumen.omitidos++;
      }
    }
  } catch (e) {
    log('error', 'Avisos de cumplimiento: falló la base al reservar los avisos; lo reservado vuelve a «error» para el próximo proceso', { corteId, error: textoTecnico(e) });
    await soltar(UMBRALES_AVISO);
    throw e;
  }

  const para = config.para.map((p) => p.correo);
  for (const [umbral, evs] of grupos) {
    if (!evs.length) continue;
    const id = idCorreo(corteId, umbral);
    const avisos = evs.map((e) => idAviso(e.o.nro, umbral));
    let r;
    try {
      const correo = correoParaCola(armarCorreo({ umbral, evaluadas: evs, config, corte }));
      r = await deps.encolarCorreo(id, {
        corteId, umbral, responsable: corte.responsable, para, cc: [...config.cc], asunto: correo.asunto, texto: correo.texto, html: correo.html,
        nros: evs.map((e) => e.o.nro).sort(),
        // 99 §236 («cuándo y cuántas veces notificas»): a quién (los nombres, para la pantalla de los lectores, que no
        // leen la configuración), con qué datos y el responsable normalizado (la cola del script filtra por él).
        paraNombres: config.para.map((p) => p.nombre), datosDel: textoFechaDatos(corte), responsableNorm: normalizarNombre(corte.responsable)
      }, { ahoraMs: deps.ahora().getTime() });
    } catch (e) {
      // No se pudo dejar en cola: sus avisos vuelven a «error» y se sigue con los demás umbrales.
      log('error', 'Avisos de cumplimiento: no se pudo dejar en cola el correo de ' + umbral + ' días', { corteId, error: textoTecnico(e) });
      await soltar([umbral]);
      resumen.errores.push({ umbral, n: evs.length, error: 'No se pudo registrar el correo en la plataforma' });
      continue;
    }
    if (r && r.estado === 'enviado') {
      // Ya salió (un proceso anterior se cortó antes de marcar los avisos): los que iban en él quedan «enviado»; los
      // demás vuelven a «error» para que los tome el próximo proceso (este correo ya no se puede volver a mandar).
      const salieron = new Set(r.nros || []);
      const si = avisos.filter((_, i) => salieron.has(evs[i].o.nro));
      const no = avisos.filter((_, i) => !salieron.has(evs[i].o.nro));
      if (si.length && !(await conReintentos(() => deps.actualizarAvisos(si, { estado: 'enviado', en: marca() }), esperar))) {
        log('error', 'Avisos de cumplimiento: no se pudieron marcar «enviado» los avisos de ' + umbral + ' días que ya salieron', { corteId });
      }
      if (no.length && !(await conReintentos(() => deps.actualizarAvisos(no, { estado: 'error', en: marca() }), esperar))) {
        log('error', 'Avisos de cumplimiento: no se pudieron devolver a «error» los avisos de ' + umbral + ' días que no salieron', { corteId });
      }
      continue;
    }
    if (r && r.estado === 'ocupado') {
      // El script de Google lo tiene en sus manos: sale con las ODT que ya llevaba; las que este proceso le sumó
      // vuelven a «error» (las toma el próximo proceso).
      const lleva = new Set(r.nros || []);
      for (const e of evs) {
        if (lleva.has(e.o.nro)) continue;
        try { await deps.cambiarAvisoSi(idAviso(e.o.nro, umbral), { estado: 'reservado', correoId: id }, { estado: 'error', en: marca() }); } catch (_) { /* lo libera avisosAbandonados */ }
      }
      resumen.ocupados.push(umbral);
      continue;
    }
    resumen.encolados.push({ umbral, n: evs.length });
    if (r && r.estado === 'reabierto') resumen.reabiertos.push(umbral);
  }
  return fin('procesado', {
    encolados: resumen.encolados, reabiertos: resumen.reabiertos, errores: resumen.errores, ocupados: resumen.ocupados,
    omitidos: resumen.omitidos, reservados: resumen.reservados, reemplazados: resumen.reemplazados
  });
}
