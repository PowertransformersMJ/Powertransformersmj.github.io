// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · HABILITARME (paso a paso, una vez)
// ──────────────────────────────────────────────────────────────────────────────
//   1. Verificar el correo (enlace al buzón del titular: sendEmailVerification).
//   2. Cambiar la contraseña (enlace a su buzón: sendPasswordResetEmail). D1: quien
//      la haya compartido alguna vez la cambia y no la vuelve a compartir.
//   3. Aceptar el acuerdo, escribiendo la contraseña (crea odt_afinia_firmantes/{uid}).
//   4. Subir «Mi firma» DESPUÉS de habilitarse: la regla exige que la imagen sea
//      posterior a la habilitación (así, tras el cambio de contraseña, la firma la
//      sube el titular desde su cuenta).
// El estado de cada paso sale de `estadoPasos` (puro: se prueba en Node).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { textoAcuerdo } from '../../domain/odt_afinia_textos.js';
import { VERSIONES } from '../../domain/odt_afinia_rutas.js';
import { h, vaciar, aviso, fechaHora, mensajeDe } from './comun.js';
import { armarDeclaracion } from './declaracion.js';

export const TEXTO_MI_FIRMA = 'En la ODT solo se estampa su firma, desde su cuenta.';

/**
 * Estado de los cuatro pasos (puro).
 * @param {{cuenta:{correo:string, verificado:boolean, proveedor:string}|null, perfil:{nombre:string, correoPerfil:string, legacy?:boolean}|null,
 *          hab:{enMs:number}|null, miFirma:{hay:boolean, enMs?:number}|null, contrasenaCambiada?:boolean}} p
 */
export function estadoPasos({ cuenta, perfil, hab, miFirma, contrasenaCambiada = false } = {}) {
  const problemas = [];
  if (!perfil || perfil.legacy) problemas.push('Su cuenta no tiene perfil en la plataforma. Pida al administrador que lo cree.');
  if (perfil && !perfil.legacy && (!perfil.nombre || perfil.nombre.trim().length < 3)) problemas.push('Su perfil no tiene nombre. Pida al administrador que lo complete.');
  if (cuenta && perfil && perfil.correoPerfil && cuenta.correo && perfil.correoPerfil.toLowerCase() !== cuenta.correo.toLowerCase()) {
    problemas.push('El correo de su perfil no es el de su cuenta. Pida al administrador que lo corrija.');
  }
  if (cuenta && cuenta.proveedor && cuenta.proveedor !== 'password') problemas.push('Su cuenta no entra con correo y contraseña: no puede firmar ODT.');
  const correo = !!(cuenta && cuenta.verificado);
  const habilitado = !!hab;
  const firmaLista = habilitado && !!(miFirma && miFirma.hay && Number(miFirma.enMs) > Number(hab.enMs));
  return {
    problemas,
    pasos: {
      correo,
      contrasena: habilitado || !!contrasenaCambiada,
      acuerdo: habilitado,
      firma: firmaLista
    },
    listo: problemas.length === 0 && correo && habilitado && firmaLista
  };
}

/**
 * @param {HTMLElement} contenedor
 * @param {{repo:object, cuenta:object, sesion:object, miFirmaOdt:()=>Promise<object>, alCambiar?:()=>void}} p
 */
export async function montarHabilitarme(contenedor, { repo, cuenta, sesion, miFirmaOdt, alCambiar = () => {} }) {
  let contrasenaCambiada = false;

  async function pintar() {
    vaciar(contenedor);
    contenedor.appendChild(h('p', { class: 'odt-cargando', text: 'Revisando su cuenta…' }));
    let cta = null; let hab = null; let firma = null; const fallas = [];
    try { cta = await cuenta.estadoCuenta(); } catch (e) { fallas.push('Cuenta: ' + mensajeDe(e)); }
    try { hab = await repo.leerHabilitacion(); } catch (e) { fallas.push('Habilitación: ' + mensajeDe(e)); }
    try { firma = await miFirmaOdt(); } catch (e) { fallas.push('Mi firma: ' + mensajeDe(e)); }
    const est = estadoPasos({ cuenta: cta, perfil: sesion, hab, miFirma: firma, contrasenaCambiada });
    vaciar(contenedor);

    contenedor.appendChild(h('p', { class: 'odt-parrafo', text: 'Para firmar ODT de Afinia en SGM se habilita una sola vez, desde su propia cuenta. Son cuatro pasos.' }));
    for (const f of fallas) contenedor.appendChild(aviso(f + ' (no se pudo comprobar; reintente).', 'error'));
    for (const p of est.problemas) contenedor.appendChild(aviso(p, 'error'));
    if (est.listo) contenedor.appendChild(aviso('Está habilitado y su firma está lista. Las ODT que le asignen aparecerán en «Mi turno».', 'ok'));

    const ol = h('ol', { class: 'odt-pasos' });
    contenedor.appendChild(ol);

    // Paso 1 · correo verificado
    const p1 = paso(ol, 1, 'Verificar su correo', est.pasos.correo);
    if (cta) p1.appendChild(h('p', { text: 'Su cuenta: ' + cta.correo }));
    if (!est.pasos.correo) {
      const st = h('p', { class: 'odt-estado', role: 'status' });
      p1.appendChild(h('p', { text: 'Le enviaremos un enlace a ese correo. Ábralo desde su buzón y después pulse «Ya lo verifiqué».' }));
      p1.appendChild(h('div', { class: 'odt-acciones' },
        h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Enviarme el enlace', onclick: async (ev) => {
          const b = ev.currentTarget; b.disabled = true;
          try { const r = await cuenta.enviarVerificacion(); st.textContent = 'Enlace enviado a ' + r.correo + '.'; } catch (e) { st.textContent = mensajeDe(e); b.disabled = false; }
        } }),
        h('button', { type: 'button', class: 'odt-btn', text: 'Ya lo verifiqué', onclick: pintar })), st);
    }

    // Paso 2 · cambiar la contraseña
    const p2 = paso(ol, 2, 'Cambiar su contraseña (si alguna vez la compartió, es obligatorio)', est.pasos.contrasena);
    if (!est.pasos.acuerdo) {
      const st = h('p', { class: 'odt-estado', role: 'status' });
      p2.appendChild(h('p', { text: 'La firma de una ODT vale como su firma manuscrita: su contraseña debe conocerla solo usted. Le enviamos un enlace a su correo para cambiarla. Después de cambiarla, la plataforma le pedirá entrar de nuevo con la nueva.' }));
      p2.appendChild(h('div', { class: 'odt-acciones' },
        h('button', { type: 'button', class: 'odt-btn', text: 'Enviarme el enlace para cambiarla', onclick: async (ev) => {
          const b = ev.currentTarget; b.disabled = true;
          try { const r = await cuenta.enviarCambioContrasena(); st.textContent = 'Enlace enviado a ' + r.correo + '.'; } catch (e) { st.textContent = mensajeDe(e); b.disabled = false; }
        } }),
        h('button', { type: 'button', class: 'odt-btn', text: 'Ya la cambié (o nunca la compartí): continuar', onclick: () => { contrasenaCambiada = true; pintar(); } })), st);
    }

    // Paso 3 · aceptar el acuerdo con la contraseña
    const p3 = paso(ol, 3, 'Aceptar el acuerdo de firma', est.pasos.acuerdo);
    if (hab) {
      p3.appendChild(h('p', { text: 'Habilitado el ' + fechaHora(hab.enMs) + ' con la cuenta ' + hab.correo + '.' }));
    } else if (!est.pasos.correo || !est.pasos.contrasena || est.problemas.length || !cta) {
      p3.appendChild(h('p', { class: 'odt-mini', text: 'Disponible cuando termine los pasos 1 y 2.' }));
    } else {
      let decl;
      decl = armarDeclaracion({
        texto: textoAcuerdo({ nombre: sesion.nombre, correo: cta.correo }),
        version: VERSIONES.acuerdo,
        etiquetaCasilla: 'Leí el acuerdo y lo acepto.',
        etiquetaBoton: 'Aceptar y habilitarme',
        alConfirmar: async (clave) => {
          decl.estado.textContent = 'Comprobando su contraseña…';
          try {
            const token = await cuenta.reautenticar(clave, { uidEsperado: sesion.uid });
            if (token.email !== cta.correo) throw new Error('El correo autenticado no es el del acuerdo. Recargue la página.');
            decl.estado.textContent = 'Guardando su habilitación…';
            await repo.habilitarme(token);
            alCambiar();
            await pintar();
          } catch (e) { decl.estado.textContent = mensajeDe(e); }
        }
      });
      p3.appendChild(decl.raiz);
    }

    // Paso 4 · subir «Mi firma» DESPUÉS de habilitarse
    const p4 = paso(ol, 4, 'Subir «Mi firma» (después de habilitarse)', est.pasos.firma);
    p4.appendChild(h('p', { class: 'odt-destacado', text: TEXTO_MI_FIRMA }));
    if (!hab) {
      p4.appendChild(h('p', { class: 'odt-mini', text: 'Disponible cuando acepte el acuerdo (paso 3).' }));
    } else {
      if (firma && firma.hay && !est.pasos.firma) p4.appendChild(aviso('Su firma actual es anterior a su habilitación: vuelva a subirla (puede ser el mismo archivo).', 'aviso'));
      if (firma && !firma.hay) p4.appendChild(aviso('Aún no ha subido su firma.', 'aviso'));
      if (est.pasos.firma) p4.appendChild(aviso('Su firma está lista para estamparse en las ODT.', 'ok'));
      const panel = h('div', { class: 'odt-panel-firma' });
      p4.appendChild(panel);
      try {
        const { montarFirmaPersonal } = await import('../firma-personal.js');
        montarFirmaPersonal(panel, { onCambio: () => { alCambiar(); pintar(); } });
      } catch (e) {
        panel.appendChild(aviso('No se pudo cargar el panel «Mi firma». Recargue la página.', 'error'));
      }
    }
  }

  function paso(ol, n, titulo, hecho) {
    const li = h('li', { class: 'odt-paso' + (hecho ? ' odt-paso--hecho' : '') },
      h('h3', { class: 'odt-paso-titulo' }, h('span', { class: 'odt-paso-n', text: hecho ? '✓' : String(n) }), ' ' + titulo));
    ol.appendChild(li);
    return li;
  }

  await pintar();
  return { refrescar: pintar };
}
