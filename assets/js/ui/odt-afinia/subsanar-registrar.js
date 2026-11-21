// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · «REGISTRAR ODT POR SUBSANAR» (solo admin)
// ──────────────────────────────────────────────────────────────────────────────
// N.º (8 dígitos), subestación, equipo (opcional), fecha prevista (dd/mm/aaaa), el AZT
// asignado (de la LISTA BLANCA de AZT y habilitado: lo que ofrece «Publicar ODT», nunca quien
// registra) y los puntos en un área de texto, UNO POR LÍNEA, con prefijo opcional
// «Contratista:», «AZT:» o «Responsable:» (sin prefijo = Contratista). Formato exacto en
// domain/odt_afinia_obs.js (parsearPuntos).
// Dos pasos: «Vista previa» (valida todo, consulta si el N.º ya tiene una ODT por subsanar
// ABIERTA y muestra los puntos tal como quedarán) → «Guardar» (lote: obs + candado + puntos).
// Cambiar cualquier campo esconde «Guardar» hasta una vista previa nueva. Mientras se consulta el N.º
// o se guarda, los campos quedan bloqueados; y si aun así algo cambia durante la consulta, esa vista
// previa se descarta (nunca se guarda con datos viejos). «Guardar» envía la copia de lo validado.
// Si el lote no responde a tiempo («NO repita»), «Guardar» y el formulario siguen bloqueados y se
// espera su desenlace (seguirPendiente, de subsanar-detalle.js).
// Archivo NUEVO a propósito (L-102): al repositorio de la firma (que pudo quedar viejo en la caché)
// solo le pide `candidatos`, que ya existía, y pregunta antes si está.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe } from './comun.js';
import { ETIQUETA_QUIEN, TOPES_OBS, erroresRegistro, limpiarTexto, parsearPuntos } from '../../domain/odt_afinia_obs.js';
import { seguirPendiente, sigueEn } from './subsanar-detalle.js';

/** El texto de la vista previa sobre los puntos (singular y plural bien escritos). */
export const textoSeRegistran = (n) => (n === 1 ? 'Se registra 1 punto, PENDIENTE:' : 'Se registran ' + n + ' puntos, todos PENDIENTES:');

/** La ayuda del área de puntos (el formato que se acepta, en llano). */
export const AYUDA_PUNTOS = 'Un punto por línea. Puede empezar con «Contratista:», «AZT:» o «Responsable:» para decir a quién le toca; sin prefijo, le toca al Contratista. '
  + 'Las líneas vacías no cuentan y una viñeta o numeración al comienzo («- », «• », «1. ») se quita. De ' + TOPES_OBS.textoMin + ' a ' + TOPES_OBS.textoMax
  + ' caracteres por punto; hasta ' + TOPES_OBS.puntosMax + ' puntos.';

/**
 * @param {HTMLElement} contenedor
 * @param {{repoObs:object, repoOdt?:object, sesion:object, alIr:(ancla:string, mensaje?:string)=>void, alContar?:()=>void}} p
 */
export async function montarRegistrarObs(contenedor, { repoObs, repoOdt, sesion, alIr, alContar }) {
  vaciar(contenedor);
  contenedor.appendChild(h('div', { class: 'odt-acciones' },
    h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: '← Volver a «Por subsanar»', onclick: () => alIr('subsanar') })));
  contenedor.appendChild(h('h2', { class: 'odt-subtitulo', text: 'Registrar ODT por subsanar' }));
  contenedor.appendChild(h('p', { class: 'odt-mini', text: 'Para una ODT de Afinia con inconsistencias que hay que corregir antes de publicarla para firma. El AZT asignado la verá en su sesión, en «Por subsanar», con cada punto.' }));
  if (!sesion.esAdmin || sesion.legacy) {
    contenedor.appendChild(aviso(sesion.legacy ? 'Su cuenta de administrador no tiene perfil en la plataforma: créelo antes de registrar.' : 'Solo un administrador registra ODT por subsanar.', 'aviso'));
    return null;
  }

  // ── AZT que se pueden asignar: lista blanca de AZT × habilitados × perfil activo (sin quien registra) ──
  const zonaAzt = h('div', { class: 'odt-campo-fila' });
  const selAzt = h('select', { id: 'odtObsAzt', class: 'odt-campo' }, h('option', { value: '', text: 'Elija el AZT asignado…' }));
  let candidatos = [];
  zonaAzt.append(h('label', { htmlFor: 'odtObsAzt', text: 'AZT asignado (de la lista blanca, habilitado)' }), selAzt);
  const avisoAzt = h('div', {});
  if (!repoOdt || typeof repoOdt.candidatos !== 'function') {
    avisoAzt.appendChild(aviso('La página tiene partes de una versión anterior (caché del navegador). Recargue con Cmd + Shift + R (o Ctrl + Shift + R) y vuelva a intentarlo.', 'aviso'));
  } else {
    try {
      const c = await repoOdt.candidatos();
      candidatos = (c && Array.isArray(c.azt) ? c.azt : []).filter((x) => x && x.uid && x.uid !== sesion.uid);
      for (const x of candidatos) selAzt.appendChild(h('option', { value: x.uid, text: (x.nombre || x.uid) + (x.correo ? ' · ' + x.correo : '') }));
      if (!candidatos.length) avisoAzt.appendChild(aviso('No hay AZT habilitados en la lista blanca para asignar. Cada AZT se habilita en «Habilitarme y Mi firma»; la lista blanca la llena el Ingeniero.', 'aviso'));
    } catch (e) {
      avisoAzt.appendChild(aviso('No se pudo leer la lista de AZT: ' + mensajeDe(e), 'error'));
    }
  }

  const campo = (id, etiqueta, attrs = {}) => {
    const el = h('input', { id, class: 'odt-campo', type: 'text', ...attrs });
    return { el, fila: h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: id, text: etiqueta }), el) };
  };
  const nro = campo('odtObsNro', 'N.º de la ODT (8 dígitos)', { maxLength: 8, inputmode: 'numeric', autocomplete: 'off' });
  const sub = campo('odtObsSubestacion', 'Subestación', { maxLength: TOPES_OBS.subestacionMax });
  const equipo = campo('odtObsEquipo', 'Equipo (opcional)', { maxLength: TOPES_OBS.equipoMax });
  const fecha = campo('odtObsFecha', 'Fecha prevista (dd/mm/aaaa)', { maxLength: 10, placeholder: 'dd/mm/aaaa' });
  const area = h('textarea', { id: 'odtObsPuntos', class: 'odt-campo', rows: 10 });
  const filaPuntos = h('div', { class: 'odt-campo-fila odt-campo-fila--ancha' },
    h('label', { htmlFor: 'odtObsPuntos', text: 'Puntos por subsanar' }), area,
    h('p', { class: 'odt-mini', text: AYUDA_PUNTOS }));

  const st = h('div', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });
  const previa = h('div', { class: 'odt-obs-previa' });
  const btnPrevia = h('button', { type: 'button', class: 'odt-btn', text: 'Vista previa' });
  const btnGuardar = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Guardar' });
  // Contenedor sin clase (sin `display` propio): `hidden` sí lo esconde en el navegador.
  const pasoGuardar = h('div', { hidden: true }, h('div', { class: 'odt-acciones' }, btnGuardar));

  /** Lo validado en la última vista previa (se borra al cambiar cualquier campo). */
  let listo = null;
  /** Sube con cada cambio de un campo: una vista previa que vio cambiar la versión durante su consulta no vale. */
  let version = 0;
  /** Mientras se consulta el N.º o se guarda, no se empieza otra cosa. */
  let consultando = false;
  let guardando = false;
  const campos = [nro.el, sub.el, equipo.el, fecha.el, area, selAzt];
  const bloquearCampos = (si) => { for (const el of campos) el.disabled = si; };
  // Mientras se guarda, nada del formulario toca lo que se está enviando.
  const ocultar = () => { if (guardando) return; version++; listo = null; pasoGuardar.hidden = true; vaciar(previa); };
  for (const el of campos) { el.addEventListener('input', ocultar); el.addEventListener('change', ocultar); }

  const form = () => ({
    nro: limpiarTexto(nro.el.value), subestacion: limpiarTexto(sub.el.value), equipo: limpiarTexto(equipo.el.value),
    fechaPrevista: limpiarTexto(fecha.el.value), aztUid: selAzt.value
  });

  btnPrevia.addEventListener('click', async () => {
    if (consultando || guardando) return;
    ocultar(); vaciar(st);
    const miVersion = version;
    const f = form();
    const parseo = parsearPuntos(area.value);
    const errores = erroresRegistro(f, parseo, sesion);
    const azt = candidatos.find((x) => x.uid === f.aztUid) || null;
    if (f.aztUid && !azt) errores.push('Ese AZT ya no está entre los que se pueden asignar: recargue la página.');
    if (!errores.length) {
      consultando = true; btnPrevia.disabled = true; bloquearCampos(true);
      try {
        const p = await repoObs.previaDelNro(f.nro);
        if (p && !p.libre) errores.push('Ya hay una ODT por subsanar ABIERTA con el N.º ' + f.nro + ': agregue los puntos en ella.');
      } catch (e) { errores.push('No se pudo consultar si el N.º ya tiene una ODT por subsanar: ' + mensajeDe(e)); }
      consultando = false; btnPrevia.disabled = false; bloquearCampos(false);
    }
    if (version !== miVersion) {
      st.appendChild(aviso('Un dato cambió mientras se consultaba el N.º: pulse «Vista previa» otra vez.', 'aviso'));
      return;
    }
    if (errores.length) {
      st.appendChild(h('ul', { class: 'odt-errores', role: 'alert' }, errores.map((t) => h('li', { text: t }))));
      return;
    }
    listo = { form: f, azt, puntos: parseo.puntos.map((x) => ({ texto: x.texto, quien: x.quien })) };
    previa.append(
      h('h3', { class: 'odt-subtitulo', text: 'Vista previa' }),
      h('p', { class: 'odt-parrafo', text: 'ODT N.º ' + f.nro + ' · ' + f.subestacion + (f.equipo ? ' · ' + f.equipo : '') + ' · prevista ' + f.fechaPrevista
        + ' · AZT asignado: ' + (azt.nombre || '—') + '. ' + textoSeRegistran(listo.puntos.length) }),
      h('ol', { class: 'odt-obs-puntos odt-obs-puntos--previa' }, listo.puntos.map((x) => h('li', { class: 'odt-obs-punto' },
        h('span', { class: 'odt-chip odt-chip--quien', text: ETIQUETA_QUIEN[x.quien] }), ' ', x.texto))),
      h('p', { class: 'odt-mini', text: 'Al guardar, la ODT y sus puntos quedan registrados (no se borran). Después se pueden agregar puntos, no quitarlos.' }));
    pasoGuardar.hidden = false;
  });

  btnGuardar.addEventListener('click', async () => {
    if (guardando || consultando || !listo || pasoGuardar.hidden) return;
    // La copia de lo validado: lo que pase en el formulario mientras se guarda no la cambia.
    const envio = listo;
    const n = envio.puntos.length;
    const hecho = 'ODT N.º ' + envio.form.nro + ' registrada con ' + n + (n === 1 ? ' punto' : ' puntos') + '. El AZT asignado ya la ve en «Por subsanar».';
    const liberar = () => { guardando = false; btnGuardar.disabled = false; btnPrevia.disabled = false; bloquearCampos(false); };
    guardando = true; btnGuardar.disabled = true; btnPrevia.disabled = true; bloquearCampos(true);
    vaciar(st); st.appendChild(h('p', { class: 'odt-cargando', text: 'Guardando la ODT por subsanar…' }));
    try {
      const r = await repoObs.registrar(envio);
      if (typeof alContar === 'function') alContar();
      alIr('subsanar=' + r.id, hecho);
    } catch (e) {
      const pendiente = !!e && e.codigo === 'pendiente';
      vaciar(st); st.appendChild(aviso(mensajeDe(e), pendiente ? 'aviso' : 'error'));
      // «NO repita»: «Guardar» y el formulario siguen bloqueados hasta saber el desenlace del lote; si entró,
      // se va a la lista (solo si esta vista sigue en pantalla).
      if (seguirPendiente(e, () => {
        if (!sigueEn(st, contenedor)) return;
        if (typeof alContar === 'function') alContar();
        alIr('subsanar', hecho);
      }, (x) => { vaciar(st); st.appendChild(aviso(mensajeDe(x), 'error')); liberar(); })) return;
      liberar();
    }
  });

  contenedor.append(
    h('div', { class: 'odt-bloque' }, nro.fila, sub.fila, equipo.fila, fecha.fila, zonaAzt, avisoAzt, filaPuntos),
    h('div', { class: 'odt-acciones' }, btnPrevia),
    st, previa, pasoGuardar);
  return { candidatos };
}
