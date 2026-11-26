// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · «El script de Google que envía los correos» (solo admin) · 99 §236
// ──────────────────────────────────────────────────────────────────────────────
// Decisión del 2026-11-26 (99 §236): sin contraseña de aplicación de Gmail, los avisos los envía un script de Google
// que vive en la cuenta remitente. Dentro de «Avisos de cumplimiento por correo» (indicadores-avisos.js), este bloque:
//   · explica en llano cómo se envían los correos (AYUDA_SCRIPT);
//   · muestra el estado que deja el servidor en odt_afinia_config/cumplimiento_script: la última conexión del script,
//     su último resultado y si hay un script aprobado;
//   · si un script pidió permiso (audienciaVista distinta de la aprobada): «Hay un script de Google pidiendo permiso
//     para enviar los avisos» y «Aprobar este script» en DOS pasos («Sí, aprobar» o «Cancelar»), que guarda
//     audienciaScript = audienciaVista (data/odt_afinia_cumplimiento_script.js) y avisa a la sección (alAprobar);
//   · «Volver a consultar» (una lectura): fijo DEBAJO del estado (no se borra al repintar, así no pierde el foco) y,
//     al terminar, «Estado del script actualizado» en la zona que anuncia el lector de pantalla.
// Corrector 99 §236: el título va como párrafo destacado (arriba no hay h2 ni h3); tras aprobar, el último resultado
// dice que falta su próxima conexión y el aviso depende de si los avisos están activos; el identificador parte la línea.
// Todo con textContent (nunca innerHTML). Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe, fechaHora } from './comun.js';
import { TITULO_SCRIPT, AYUDA_SCRIPT, TEXTO_PIDE_PERMISO, CONFIRMAR_APROBACION, resumenEstadoScript } from '../../domain/odt_afinia_cumplimiento_remitente.js';

const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) { /* sin foco */ } } };
/** Lo que dice «Último resultado» justo después de aprobar (el servidor aún no sabe nada del script). */
export const RESULTADO_RECIEN_APROBADO = 'Aprobado ahora: falta su próxima conexión (como mucho en 10 minutos).';
export const APROBADO_ACTIVO = 'Script aprobado. En su próxima conexión (como mucho en 10 minutos) empezará a enviar los correos en cola.';
export const APROBADO_INACTIVO = 'Script aprobado. Los avisos están desactivados: enviará los correos cuando los active (casilla «Avisos activos», abajo).';

/**
 * @param {HTMLElement} contenedor
 * @param {{repo:object, config:()=>object|null, alAprobar?:(config:object)=>void}} p
 *   repo: {leerEstado(), aprobar(audiencia)} · config: la configuración guardada en este momento (o null)
 * @returns {{cargar:()=>Promise<boolean>, estado:()=>object}}  cargar: true si leyó el estado
 */
export function montarEstadoScript(contenedor, { repo, config, alAprobar } = {}) {
  const leerConfig = typeof config === 'function' ? config : () => null;
  const cuerpo = h('div', { class: 'odt-cum-script-cuerpo' });
  const st = h('div', { class: 'odt-estado odt-cum-script-estado', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const btnConsultar = h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Volver a consultar' });
  const bloque = h('div', { class: 'odt-cum-script' },
    h('p', { class: 'odt-cum-script-titulo' }, h('strong', { text: TITULO_SCRIPT })), h('p', { class: 'odt-mini', text: AYUDA_SCRIPT }),
    cuerpo, h('div', { class: 'odt-acciones' }, btnConsultar), st);
  contenedor.appendChild(bloque);
  let ultimo = null; let leyendo = null; let aprobando = false;
  btnConsultar.addEventListener('click', async () => {
    if (leyendo || aprobando) return;
    const ok = await cargar();
    vaciar(st);
    st.appendChild(h('p', { class: 'odt-mini', text: ok ? 'Estado del script actualizado.' : 'No se pudo consultar el estado del script (el motivo está arriba).' }));
  });

  function pintar(e) {
    vaciar(cuerpo);
    const r = resumenEstadoScript(e, leerConfig(), fechaHora);
    cuerpo.appendChild(h('dl', { class: 'odt-ind-definiciones odt-cum-script-datos' },
      h('dt', { text: 'Última conexión del script' }), h('dd', { text: r.conexion }),
      h('dt', { text: 'Último resultado' }), h('dd', { text: r.resultado }),
      h('dt', { text: 'Script aprobado' }), h('dd', { text: r.aprobado })));
    if (r.pidePermiso) cuerpo.appendChild(pedido(r, e));
  }

  /** El aviso de un script que pide permiso, con la aprobación en dos pasos. */
  function pedido(r, e) {
    const sinConfig = !leerConfig();
    const btnAprobar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Aprobar este script', disabled: sinConfig });
    const btnSi = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Sí, aprobar' });
    const btnNo = h('button', { type: 'button', class: 'odt-btn', text: 'Cancelar' });
    // Contenedores sin `display` propio (o la caja .odt-confirmar): `hidden` sí los esconde en el navegador.
    const pasoGuardar = h('div', {}, h('div', { class: 'odt-acciones' }, btnAprobar));
    const caja = h('div', { class: 'odt-confirmar', role: 'group', 'aria-label': 'Confirmar la aprobación del script', hidden: true },
      h('p', { class: 'odt-parrafo', text: CONFIRMAR_APROBACION }), h('div', { class: 'odt-acciones' }, btnSi, btnNo));
    btnAprobar.addEventListener('click', () => { if (aprobando || btnAprobar.disabled) return; vaciar(st); pasoGuardar.hidden = true; caja.hidden = false; enfocar(btnSi); });
    btnNo.addEventListener('click', () => { if (aprobando) return; caja.hidden = true; pasoGuardar.hidden = false; enfocar(btnAprobar); });
    btnSi.addEventListener('click', async () => {
      if (aprobando || caja.hidden) return;
      aprobando = true; btnSi.disabled = true; btnNo.disabled = true;
      vaciar(st); st.appendChild(h('p', { class: 'odt-cargando', text: 'Aprobando el script…' }));
      try {
        const guardada = await repo.aprobar(r.audiencia);
        aprobando = false;
        if (typeof alAprobar === 'function') alAprobar(guardada);
        // Lo leído antes de aprobar decía «Pidió permiso…»: se repinta con lo que pasa ahora.
        ultimo = { ...(ultimo || {}), ultimoResultado: RESULTADO_RECIEN_APROBADO };
        pintar(ultimo);
        const activo = !!((guardada || leerConfig() || {}).activo);
        vaciar(st); st.appendChild(aviso(activo ? APROBADO_ACTIVO : APROBADO_INACTIVO, 'ok'));
      } catch (err) {
        aprobando = false; btnSi.disabled = false; btnNo.disabled = false;
        caja.hidden = true; pasoGuardar.hidden = false;
        vaciar(st); st.appendChild(aviso(mensajeDe(err), 'error'));
      }
      enfocar(st);
    });
    return h('div', { class: 'odt-cum-script-pedido', role: 'group', 'aria-label': TEXTO_PIDE_PERMISO },
      h('p', { class: 'odt-parrafo odt-cum-script-pide', text: TEXTO_PIDE_PERMISO }),
      h('p', { class: 'odt-mini odt-cum-script-id', text: 'Pidió permiso el ' + fechaHora(e && e.vistaEnMs) + '. Su identificador: ' + r.audiencia }),
      sinConfig ? h('p', { class: 'odt-mini', text: 'Guarde primero la configuración de los avisos (abajo) y luego apruébelo.' }) : null,
      pasoGuardar, caja);
  }

  async function cargar() {
    if (leyendo) return leyendo;
    leyendo = (async () => {
      vaciar(st); vaciar(cuerpo);
      cuerpo.appendChild(h('p', { class: 'odt-cargando', text: 'Consultando el estado del script…' }));
      try { ultimo = await repo.leerEstado(); } catch (e) {
        vaciar(cuerpo);
        cuerpo.appendChild(aviso('No se pudo leer el estado del script: ' + mensajeDe(e) + ' Pulse «Volver a consultar» para reintentar.', 'error'));
        return false;
      }
      pintar(ultimo);
      return true;
    })().finally(() => { leyendo = null; });
    return leyendo;
  }

  return { cargar, estado: () => ({ ultimo, aprobando }) };
}
