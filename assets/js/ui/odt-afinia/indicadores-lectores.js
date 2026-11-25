// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · «Quién más puede ver los indicadores» (solo administradores)
// ──────────────────────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-11-24): que un AZT también tenga acceso a los indicadores («Todo, solo lectura»).
// Así lo maneja él sin código, dentro de la pestaña «Indicadores»:
//   · una sección plegada «Quién más puede ver los indicadores»; al abrirla lee la lista guardada
//     (odt_afinia_config/indicadores) y los AZT habilitados de la lista blanca de la Firma (los mismos que ofrece
//     «Publicar ODT»: repoOdt.candidatos, que ya existía; se pregunta antes si está, L-102);
//   · una casilla por persona (marcada = puede verlos). Un lector que ya no es AZT habilitado sigue en la lista,
//     marcado y con su nota, para poder quitarlo;
//   · «Guardar» en DOS pasos, como el resto del módulo: «Guardar» → la frase de lo que cambia → «Sí, guardar» (o
//     «Cancelar»). Lo guardado se vuelve a leer del servidor y la frase «Hoy…» lo dice.
// Además: soyLectorIndicadores() y estadoLectorIndicadores(), lo que app.js pregunta (con import()) para mostrar la
// pestaña a quien no es admin. Solo a quien la regla puede dejar leer (perfil activo y no visitante: así un inactivo o un
// visitante que siga en la lista no ve una pestaña que se le niega) y, si no se pudo comprobar por la conexión
// (`sinComprobar`), app.js lo dice en vez de «solo para administradores».
// Todo con textContent (nunca innerHTML). Archivo NUEVO a propósito (L-102): a sus vecinos de antes (comun.js) solo
// les pide nombres que ya existían, y al repositorio de la firma solo `candidatos`, preguntando antes si está.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe } from './comun.js';
import { crearRepositorioLectoresInd } from '../../data/odt_afinia_ind_lectores.js';
import {
  TITULO_SECCION, AYUDA_SECCION, SIN_CANDIDATOS, SIN_CAMBIOS, opcionesLectores, cambiosLectores, textoConfirmacion,
  textoActual, normalizarLectores, sesionPuedeSerLector
} from '../../domain/odt_afinia_ind_lectores.js';

export { crearRepositorioLectoresInd };

/** Si la página tiene partes viejas (caché) y el repositorio de la firma no trae `candidatos`. */
export const MSG_SIN_CANDIDATOS_FN = 'La página tiene partes de una versión anterior (caché del navegador). Recargue con Cmd + Shift + R (o Ctrl + Shift + R) y vuelva a intentarlo.';

const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) { /* sin foco */ } } };
const sigueEn = (nodo, contenedor) => { for (let n = nodo; n; n = n.parentNode) if (n === contenedor) return true; return false; };

/**
 * ¿La sesión (que NO es admin) está en la lista de lectores, y se pudo comprobar? Nunca lanza.
 * Con un repositorio sin `comprobarLector` (un doble o uno viejo), usa `soyLector` (sinComprobar = false).
 * @param {{sesion:object, repoLectores?:object}} p
 * @returns {Promise<{lector:boolean, sinComprobar:boolean}>}
 */
export async function estadoLectorIndicadores({ sesion, repoLectores } = {}) {
  if (!sesionPuedeSerLector(sesion)) return { lector: false, sinComprobar: false };
  try {
    const repo = repoLectores || crearRepositorioLectoresInd();
    if (typeof repo.comprobarLector === 'function') {
      const r = await repo.comprobarLector();
      return { lector: !!r && r.lector === true, sinComprobar: !!r && r.lector !== true && r.sinComprobar === true };
    }
    return { lector: (await repo.soyLector()) === true, sinComprobar: false };
  } catch (_) { return { lector: false, sinComprobar: false }; }
}

/**
 * ¿La sesión (que NO es admin) está en la lista de lectores? Nunca lanza: ante cualquier duda, false.
 * @param {{sesion:object, repoLectores?:object}} p
 * @returns {Promise<boolean>}
 */
export async function soyLectorIndicadores(p = {}) {
  return (await estadoLectorIndicadores(p)).lector === true;
}

/**
 * La sección plegada (solo para un administrador con perfil). Lee al abrirse (o con `cargar()`).
 * @param {HTMLElement} contenedor  donde se agrega la sección
 * @param {{repoLectores?:object, repoOdt?:object, sesion:object}} p
 * @returns {{elemento:HTMLElement, cargar:()=>Promise<void>, estado:()=>object}|null}
 */
export function montarSeccionLectores(contenedor, { repoLectores, repoOdt, sesion } = {}) {
  if (!sesion || !sesion.esAdmin || sesion.legacy) return null;
  const repo = repoLectores || crearRepositorioLectoresInd();
  const actual = h('p', { class: 'odt-mini odt-ind-lectores-actual' });
  const zonaLista = h('div', { class: 'odt-ind-lectores-lista' });
  const st = h('div', { class: 'odt-estado', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const btnGuardar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Guardar' });
  const btnSi = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Sí, guardar' });
  const btnNo = h('button', { type: 'button', class: 'odt-btn', text: 'Cancelar' });
  const lineaConfirmar = h('p', { class: 'odt-parrafo' });
  // Contenedores sin `display` propio (o la caja .odt-confirmar): `hidden` sí los esconde en el navegador.
  const pasoGuardar = h('div', { hidden: true }, h('div', { class: 'odt-acciones' }, btnGuardar));
  const caja = h('div', { class: 'odt-confirmar', role: 'group', 'aria-label': 'Confirmar quién puede ver los indicadores', hidden: true },
    lineaConfirmar, h('div', { class: 'odt-acciones' }, btnSi, btnNo));
  const cuerpo = h('div', { class: 'odt-ind-lectores-cuerpo' },
    h('p', { class: 'odt-mini', text: AYUDA_SECCION }), actual, zonaLista, st, pasoGuardar, caja);
  const det = h('details', { class: 'odt-detalles odt-ind-lectores' }, h('summary', { text: TITULO_SECCION }), cuerpo);
  contenedor.appendChild(det);

  /** Lo guardado en el servidor, las casillas pintadas ({uid, nombre, casilla}) y los nombres conocidos. */
  let guardados = [];
  let casillas = [];
  const nombres = new Map();
  let cargado = false;
  let cargando = null;
  let guardando = false;
  /** Los AZT elegibles de la última lectura y dónde van las casillas (para volver a pintarlas después de guardar). */
  let aztElegibles = [];
  let destinoCasillas = null;
  const nombreDe = (u) => nombres.get(u) || 'Persona sin nombre conocido';
  const marcados = () => casillas.filter((c) => c.casilla.checked).map((c) => c.uid);
  const pintarActual = () => { actual.textContent = textoActual(guardados, nombreDe); };
  const ocultarConfirmar = () => { caja.hidden = true; pasoGuardar.hidden = !casillas.length; };

  /** Una casilla por persona (marcada = puede verlos), en `destino`. */
  function pintarCasillas(destino, opciones) {
    vaciar(destino);
    casillas = [];
    if (!opciones.length) { destino.appendChild(h('p', { class: 'odt-vacio', text: SIN_CANDIDATOS })); return; }
    const filas = opciones.map((o, i) => {
      const id = 'odtIndLector' + i;
      const casilla = h('input', { type: 'checkbox', id, class: 'odt-casilla', checked: o.marcado, 'aria-describedby': o.nota ? id + 'Nota' : null });
      // Cambiar una casilla con la confirmación abierta la cierra: lo que se confirma es siempre lo que está marcado.
      casilla.addEventListener('change', () => { if (!caja.hidden) ocultarConfirmar(); vaciar(st); });
      casillas.push({ uid: o.uid, nombre: o.nombre, casilla });
      return h('li', { class: 'odt-ind-lector' }, casilla,
        h('label', { htmlFor: id, text: o.nombre }),
        o.nota ? h('span', { id: id + 'Nota', class: 'odt-mini odt-ind-lector-nota', text: '(' + o.nota + ')' }) : null);
    });
    destino.appendChild(h('fieldset', { class: 'odt-ind-lectores-grupo' },
      h('legend', { text: 'AZT habilitados' }), h('ul', { class: 'odt-ind-lectores-ul' }, filas)));
  }

  /** Lee la lista guardada y los AZT habilitados, y pinta las casillas. */
  async function cargar() {
    if (cargando) return cargando;
    cargando = (async () => {
      vaciar(st); vaciar(zonaLista); actual.textContent = '';
      caja.hidden = true; pasoGuardar.hidden = true;
      zonaLista.appendChild(h('p', { class: 'odt-cargando', text: 'Consultando quién puede verlos…' }));
      let lista;
      try {
        lista = await repo.leer();
      } catch (e) {
        vaciar(zonaLista);
        zonaLista.appendChild(aviso('No se pudo leer quién puede ver los indicadores: ' + mensajeDe(e), 'error'));
        zonaLista.appendChild(h('div', { class: 'odt-acciones' }, h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Reintentar', onclick: () => cargar() })));
        return;
      }
      let cand = null; let errCand = '';
      if (!repoOdt || typeof repoOdt.candidatos !== 'function') errCand = MSG_SIN_CANDIDATOS_FN;
      else {
        try { cand = await repoOdt.candidatos(); } catch (e) { errCand = 'No se pudo leer la lista de AZT habilitados: ' + mensajeDe(e); }
      }
      guardados = normalizarLectores(lista && lista.lectores);
      for (const x of [...((cand && cand.habilitados) || []), ...((cand && cand.azt) || [])]) {
        if (x && x.uid && typeof x.nombre === 'string' && x.nombre.trim()) nombres.set(x.uid, x.nombre.trim());
      }
      // Sin los candidatos (error), se muestran igual los lectores guardados: así se pueden quitar.
      aztElegibles = (cand && cand.azt) || [];
      const opciones = opcionesLectores({ azt: aztElegibles, lectores: guardados, nombres: Object.fromEntries(nombres) });
      for (const o of opciones) if (!nombres.has(o.uid)) nombres.set(o.uid, o.nombre);
      vaciar(zonaLista);
      pintarActual();
      if (errCand) zonaLista.appendChild(aviso(errCand, 'aviso'));
      const destino = h('div', {});
      zonaLista.appendChild(destino);
      destinoCasillas = destino;
      pintarCasillas(destino, opciones);
      cargado = true;
      ocultarConfirmar();
    })().finally(() => { cargando = null; });
    return cargando;
  }

  det.addEventListener('toggle', () => { if (det.open && !cargado && !cargando) cargar(); });

  btnGuardar.addEventListener('click', () => {
    if (guardando || !cargado || pasoGuardar.hidden) return;
    vaciar(st);
    const c = cambiosLectores(guardados, marcados());
    if (c.igual) { st.appendChild(aviso(SIN_CAMBIOS, 'aviso')); return; }
    lineaConfirmar.textContent = textoConfirmacion(c, nombreDe, marcados().length);
    pasoGuardar.hidden = true; caja.hidden = false;
    enfocar(btnSi);
  });
  btnNo.addEventListener('click', () => {
    if (guardando) return;
    ocultarConfirmar();
    enfocar(btnGuardar);
  });
  btnSi.addEventListener('click', async () => {
    if (guardando || caja.hidden) return;
    const envio = marcados();
    const liberar = () => { guardando = false; btnSi.disabled = false; btnNo.disabled = false; for (const c of casillas) c.casilla.disabled = false; };
    guardando = true; btnSi.disabled = true; btnNo.disabled = true; for (const c of casillas) c.casilla.disabled = true;
    vaciar(st); st.appendChild(h('p', { class: 'odt-cargando', text: 'Guardando…' }));
    try {
      const r = await repo.guardar(envio);
      guardados = normalizarLectores(r && r.lectores);
      liberar();
      // Las casillas, otra vez desde lo guardado: quien ya no era AZT habilitado y se quitó deja de aparecer (y su nota).
      if (destinoCasillas) pintarCasillas(destinoCasillas, opcionesLectores({ azt: aztElegibles, lectores: guardados, nombres: Object.fromEntries(nombres) }));
      else for (const c of casillas) c.casilla.checked = guardados.includes(c.uid);
      ocultarConfirmar();
      pintarActual();
      if (!sigueEn(st, contenedor)) return;
      vaciar(st); st.appendChild(aviso('Guardado. ' + textoActual(guardados, nombreDe), 'ok'));
      enfocar(st);
    } catch (e) {
      liberar();
      if (!sigueEn(st, contenedor)) return;
      vaciar(st); st.appendChild(aviso(mensajeDe(e), 'error'));
      ocultarConfirmar();
      enfocar(st);
    }
  });

  return { elemento: det, cargar, estado: () => ({ guardados: [...guardados], marcados: marcados(), cargado, guardando }) };
}
