// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · «Avisos de cumplimiento por correo» (solo admin) · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-26): avisar por correo a los 10, 15 y 20 días desde la ejecución de las ODT que siguen
// sin cerrar. Así lo maneja él sin código, dentro de la pestaña «Indicadores» (arriba, junto a «Quién más puede ver los
// indicadores»):
//   · una sección plegada; al abrirla lee la configuración guardada (odt_afinia_config/cumplimiento);
//   · si los avisos están activos, el correo remitente (Gmail), el RESPONSABLE O.D.T. de los cortes que generan avisos
//     (por defecto, el nombre del perfil como lo escribe Afinia), hasta 5 destinatarios (correo y el nombre del saludo)
//     y hasta 5 correos en copia: casillas fijas (una fila vacía no cuenta);
//   · la explicación en llano de qué hace y de quién envía los correos: desde el 2026-11-26 (99 §236) un script de
//     Google que vive en la cuenta remitente, sin claves; su estado y su aprobación en dos pasos los pinta
//     indicadores-avisos-script.js (archivo nuevo) dentro de esta sección, después de leer la configuración;
//   · «Guardar» en DOS pasos, como el resto del módulo: «Guardar» → lo que queda configurado → «Sí, guardar» (o
//     «Cancelar»). Lo guardado se vuelve a leer del servidor.
// Todo con textContent (nunca innerHTML). Archivo NUEVO a propósito (L-102): a sus vecinos de antes (comun.js,
// domain/odt_afinia_indicadores.js) solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe } from './comun.js';
import { nombreComoAfinia } from '../../domain/odt_afinia_indicadores.js';
import {
  TITULO_SECCION_AVISOS, AYUDA_SECCION_AVISOS, TOPES_CONFIG, normalizarConfig, errorConfigCumplimiento
} from '../../domain/odt_afinia_cumplimiento.js';
import { crearRepositorioCumplimiento } from '../../data/odt_afinia_cumplimiento.js';
import { crearRepositorioScript } from '../../data/odt_afinia_cumplimiento_script.js';
import { montarEstadoScript } from './indicadores-avisos-script.js';

export { crearRepositorioCumplimiento };
export const SIN_CONFIG = 'Todavía no hay configuración guardada: los avisos NO se envían hasta que la guarde con «Avisos activos» marcado.';
/** Qué pasa al desactivarlos y al reactivarlos (corrector 99 §236). */
export const NOTA_ACTIVO = 'Desactivados: no se envía nada y lo que estaba en cola espera; si mientras tanto se guarda un corte más reciente, lo de los cortes anteriores ya no sale. Al reactivarlos solo sale lo del corte más reciente; los avisos de un corte guardado con los avisos desactivados salen con el siguiente corte (o con «Revisar y enviar los avisos de este corte»).';
const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) { /* sin foco */ } } };
const sigueEn = (nodo, contenedor) => { for (let n = nodo; n; n = n.parentNode) if (n === contenedor) return true; return false; };

/** «Hoy: avisos ACTIVOS · remitente … · para … · copia … · responsable …» de una configuración (o la falta de ella). */
export function textoConfigActual(c) {
  if (!c) return SIN_CONFIG;
  const para = (c.para || []).map((p) => p.nombre + ' <' + p.correo + '>').join(', ');
  return 'Hoy: avisos ' + (c.activo ? 'ACTIVOS' : 'DESACTIVADOS (no se envía nada)') + ' · remitente ' + (c.remitente || '—') + ' · para ' + (para || '—')
    + ' · copia ' + ((c.cc || []).join(', ') || 'ninguna') + ' · responsable de los cortes: ' + (c.responsable || '—') + '.';
}

/**
 * La sección plegada (solo para un administrador con perfil). Lee al abrirse (o con `cargar()`).
 * @param {HTMLElement} contenedor
 * @param {{repoCumplimiento?:object, repoScript?:object, sesion:object}} p  repoScript: el del estado del script de
 *   Google (data/odt_afinia_cumplimiento_script.js, 99 §236)
 * @returns {{elemento:HTMLElement, cargar:()=>Promise<void>, datos:()=>object, estado:()=>object}|null}
 */
export function montarSeccionAvisos(contenedor, { repoCumplimiento, repoScript, sesion } = {}) {
  if (!sesion || !sesion.esAdmin || sesion.legacy) return null;
  let repo = repoCumplimiento || null;
  const repoDe = () => { if (!repo) repo = crearRepositorioCumplimiento(); return repo; };
  let rScript = repoScript || null;
  const repoScriptDe = () => { if (!rScript) rScript = crearRepositorioScript({ repoCumplimiento: repoDe() }); return rScript; };
  /** El bloque del script de Google (99 §236): se monta al leer la configuración por primera vez. */
  const zonaScript = h('div', { class: 'odt-cum-script-zona' });
  let bloqueScript = null;
  const actual = h('p', { class: 'odt-mini odt-cum-config-actual' });
  const zonaForm = h('div', { class: 'odt-cum-config-form' });
  const st = h('div', { class: 'odt-estado', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const btnGuardar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Guardar' });
  const btnSi = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Sí, guardar' });
  const btnNo = h('button', { type: 'button', class: 'odt-btn', text: 'Cancelar' });
  const lineaConfirmar = h('p', { class: 'odt-parrafo' });
  // Contenedores sin `display` propio (o la caja .odt-confirmar): `hidden` sí los esconde en el navegador.
  const pasoGuardar = h('div', { hidden: true }, h('div', { class: 'odt-acciones' }, btnGuardar));
  const caja = h('div', { class: 'odt-confirmar', role: 'group', 'aria-label': 'Confirmar los avisos de cumplimiento', hidden: true },
    lineaConfirmar, h('div', { class: 'odt-acciones' }, btnSi, btnNo));
  const det = h('details', { class: 'odt-detalles odt-ind-lectores odt-cum-config' }, h('summary', { text: TITULO_SECCION_AVISOS }),
    h('div', { class: 'odt-ind-lectores-cuerpo' }, h('p', { class: 'odt-mini', text: AYUDA_SECCION_AVISOS }), zonaScript, actual, zonaForm, st, pasoGuardar, caja));
  contenedor.appendChild(det);

  // ── El formulario (casillas fijas: 5 destinatarios y 5 copias) ──
  const campo = (id, etiqueta, attrs = {}) => {
    const input = h('input', { id, class: 'odt-campo', autocomplete: 'off', ...attrs });
    return { input, fila: h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: id, text: etiqueta }), input) };
  };
  const activo = h('input', { type: 'checkbox', id: 'odtCumActivo', class: 'odt-casilla', 'aria-describedby': 'odtCumActivoNota' });
  const remitente = campo('odtCumRemitente', 'Correo remitente (la cuenta de Gmail donde vive el script que envía)', { type: 'email', maxLength: 254 });
  const responsable = campo('odtCumResponsable', 'RESPONSABLE O.D.T. de los cortes que generan avisos (como sale en los cortes)', { type: 'text', maxLength: TOPES_CONFIG.responsableMax });
  const para = Array.from({ length: TOPES_CONFIG.paraMax }, (_, i) => ({
    correo: campo('odtCumPara' + i, 'Destinatario ' + (i + 1) + ' · correo', { type: 'email', maxLength: 254 }),
    nombre: campo('odtCumParaNombre' + i, 'Destinatario ' + (i + 1) + ' · nombre para el saludo', { type: 'text', maxLength: TOPES_CONFIG.nombreMax })
  }));
  const cc = Array.from({ length: TOPES_CONFIG.ccMax }, (_, i) => campo('odtCumCc' + i, 'Copia ' + (i + 1) + ' · correo', { type: 'email', maxLength: 254 }));
  const todos = () => [activo, remitente.input, responsable.input, ...para.flatMap((p) => [p.correo.input, p.nombre.input]), ...cc.map((x) => x.input)];
  /** Lo que está escrito en el formulario. */
  const datos = () => ({
    activo: activo.checked === true,
    remitente: remitente.input.value,
    para: para.map((p) => ({ correo: p.correo.input.value, nombre: p.nombre.input.value })),
    cc: cc.map((x) => x.input.value),
    responsable: responsable.input.value
  });
  function poner(c) {
    activo.checked = !!(c && c.activo);
    remitente.input.value = (c && c.remitente) || '';
    responsable.input.value = (c && c.responsable) || nombreComoAfinia(sesion.nombre || '');
    para.forEach((p, i) => { const x = (c && c.para && c.para[i]) || {}; p.correo.input.value = x.correo || ''; p.nombre.input.value = x.nombre || ''; });
    cc.forEach((x, i) => { x.input.value = (c && c.cc && c.cc[i]) || ''; });
  }
  function pintarFormulario() {
    vaciar(zonaForm);
    zonaForm.append(
      h('div', { class: 'odt-campo-fila odt-cum-activo' }, activo, h('label', { htmlFor: 'odtCumActivo', text: 'Avisos activos (dejar en cola los correos al guardar un corte; los envía el script de Google)' })),
      h('p', { id: 'odtCumActivoNota', class: 'odt-mini', text: NOTA_ACTIVO }),
      remitente.fila, responsable.fila,
      h('fieldset', { class: 'odt-ind-lectores-grupo odt-cum-grupo' }, h('legend', { text: 'Destinatarios (de 1 a ' + TOPES_CONFIG.paraMax + ')' }),
        para.map((p) => h('div', { class: 'odt-cum-destinatario' }, p.correo.fila, p.nombre.fila))),
      h('fieldset', { class: 'odt-ind-lectores-grupo odt-cum-grupo' }, h('legend', { text: 'Con copia (opcional, hasta ' + TOPES_CONFIG.ccMax + ')' }),
        cc.map((x) => x.fila)));
    // Cambiar algo con la confirmación abierta la cierra: lo que se confirma es siempre lo que está escrito.
    for (const el of todos()) el.addEventListener(el === activo ? 'change' : 'input', () => { if (!caja.hidden) ocultarConfirmar(); });
  }

  let guardada = null; let cargado = false; let cargando = null; let guardando = false;
  const ocultarConfirmar = () => { caja.hidden = true; pasoGuardar.hidden = !cargado; };
  async function cargar() {
    if (cargando) return cargando;
    cargando = (async () => {
      vaciar(st); vaciar(zonaForm); actual.textContent = '';
      caja.hidden = true; pasoGuardar.hidden = true;
      zonaForm.appendChild(h('p', { class: 'odt-cargando', text: 'Consultando la configuración de los avisos…' }));
      try { guardada = await repoDe().leerConfig(); } catch (e) {
        vaciar(zonaForm);
        zonaForm.appendChild(aviso('No se pudo leer la configuración de los avisos: ' + mensajeDe(e), 'error'));
        zonaForm.appendChild(h('div', { class: 'odt-acciones' }, h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Reintentar', onclick: () => cargar() })));
        return;
      }
      actual.textContent = textoConfigActual(guardada);
      poner(guardada);
      pintarFormulario();
      cargado = true;
      ocultarConfirmar();
      // 99 §236: el estado del script de Google y su aprobación (si falla, lo dice dentro de su bloque).
      if (!bloqueScript) {
        bloqueScript = montarEstadoScript(zonaScript, {
          repo: repoScriptDe(), config: () => guardada,
          alAprobar: (g) => { if (g) { guardada = g; actual.textContent = textoConfigActual(guardada); } }
        });
      }
      bloqueScript.cargar();
    })().finally(() => { cargando = null; });
    return cargando;
  }
  det.addEventListener('toggle', () => { if (det.open && !cargado && !cargando) cargar(); });

  btnGuardar.addEventListener('click', () => {
    if (guardando || !cargado || pasoGuardar.hidden) return;
    vaciar(st);
    const c = normalizarConfig(datos());
    const e = errorConfigCumplimiento(c);
    if (e) { st.appendChild(aviso(e, 'error')); enfocar(st); return; }
    lineaConfirmar.textContent = 'Queda así: ' + textoConfigActual(c).replace(/^Hoy: /, '');
    pasoGuardar.hidden = true; caja.hidden = false;
    enfocar(btnSi);
  });
  btnNo.addEventListener('click', () => { if (guardando) return; ocultarConfirmar(); enfocar(btnGuardar); });
  btnSi.addEventListener('click', async () => {
    if (guardando || caja.hidden) return;
    const envio = datos();
    const bloquear = (si) => { guardando = si; btnSi.disabled = si; btnNo.disabled = si; for (const el of todos()) el.disabled = si; };
    bloquear(true);
    vaciar(st); st.appendChild(h('p', { class: 'odt-cargando', text: 'Guardando…' }));
    try {
      guardada = await repoDe().guardarConfig(envio);
      bloquear(false);
      poner(guardada);
      ocultarConfirmar();
      actual.textContent = textoConfigActual(guardada);
      if (!sigueEn(st, contenedor)) return;
      vaciar(st); st.appendChild(aviso('Guardado. ' + textoConfigActual(guardada) + (guardada.activo ? ' Recuerde: los correos salen solo si el script de Google de la cuenta remitente está instalado y aprobado (su estado está al comienzo de esta sección).' : ''), 'ok'));
      enfocar(st);
    } catch (e) {
      bloquear(false);
      if (!sigueEn(st, contenedor)) return;
      vaciar(st); st.appendChild(aviso(mensajeDe(e), 'error'));
      ocultarConfirmar();
      enfocar(st);
    }
  });

  return { elemento: det, cargar, datos, estado: () => ({ guardada, cargado, guardando }) };
}
