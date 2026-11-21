// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · «POR SUBSANAR»: una ODT y sus puntos
// ──────────────────────────────────────────────────────────────────────────────
// Se lee SIEMPRE del servidor. Los puntos van en orden, cada uno con su estado (chip), a
// quién le toca y su RASTRO (quién, cuándo, de qué estado a cuál y la nota; nada se borra).
// Acciones, en DOS pasos (el botón abre la nota y «Confirmar…» escribe):
//   · AZT asignado, punto PENDIENTE: «Marcar subsanado» → nota (3-500) → «Confirmar».
//   · Administrador, punto SUBSANADO: «Verificar» (nota opcional) o «Devolver» (motivo obligatorio);
//     quien lo marcó subsanado no lo verifica ni lo devuelve (la regla también lo niega).
//   · Administrador, ODT ABIERTA: «Agregar punto» y «Dar por resuelta» (con nota y confirmación).
// Con todos los puntos verificados: «Lista para publicar» (se publica en «Publicar ODT»: aquí no).
// «Agregar punto» recibe UN punto a la vez, con el formato de una línea del registro (varias líneas: se pide una).
// Un cambio que no responde a tiempo («NO repita»): el botón sigue bloqueado y se espera su desenlace
// (seguirPendiente); si entró, la vista se vuelve a leer, solo si sigue en pantalla.
// Lo que se esconde y se muestra es un contenedor SIN `display` propio (div sin clase, o la caja
// .odt-confirmar): así `hidden` lo esconde de verdad en el navegador (99 §232.9).
// Archivo NUEVO a propósito (L-102): a comun.js solo le pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe, fechaHora } from './comun.js';
import {
  ESTADOS_PUNTO, ETIQUETA_OBS, ETIQUETA_PUNTO, ETIQUETA_QUIEN, LISTA_PARA_PUBLICAR, TOPES_OBS,
  accionesPara, contar, errorNota, errorResolver, errorTextoPunto, esAztDe, estaAbierta, leerLinea, listaParaPublicar,
  motivoNoPuede, rastroOrdenado, revisarIntegridad, siguienteIdPunto, textoConteo, textoCambio
} from '../../domain/odt_afinia_obs.js';

/** Etiqueta y clase del chip de una obs: «Lista para publicar», «Abierta» o «Resuelta». */
export function chipObs(o) {
  if (listaParaPublicar(o)) return { texto: LISTA_PARA_PUBLICAR, clase: 'odt-chip odt-chip--publicar' };
  const e = String((o && o.estado) || '');
  return { texto: ETIQUETA_OBS[e] || e || '—', clase: 'odt-chip odt-chip--' + e.toLowerCase() };
}

/** Qué dice cada acción en sus dos pasos. */
export const TEXTOS_ACCION = Object.freeze({
  subsanar: Object.freeze({
    boton: 'Marcar subsanado', confirmar: 'Confirmar',
    etiqueta: 'Nota: qué se hizo para subsanarlo (de ' + TOPES_OBS.notaMin + ' a ' + TOPES_OBS.notaMax + ' caracteres)',
    linea: 'Al confirmar, el punto queda «Subsanado · por verificar» con su nota. El administrador lo verifica.',
    hecho: (n) => 'Punto ' + n + ' marcado como subsanado. El administrador lo verificará.'
  }),
  verificar: Object.freeze({
    boton: 'Verificar', confirmar: 'Confirmar verificación',
    etiqueta: 'Nota (opcional, hasta ' + TOPES_OBS.notaMax + ' caracteres)',
    linea: 'Al confirmar, el punto queda «Verificado».',
    hecho: (n) => 'Punto ' + n + ' verificado.'
  }),
  devolver: Object.freeze({
    boton: 'Devolver', confirmar: 'Confirmar devolución',
    etiqueta: 'Motivo de la devolución (obligatorio, de ' + TOPES_OBS.notaMin + ' a ' + TOPES_OBS.notaMax + ' caracteres)',
    linea: 'Al confirmar, el punto vuelve a «Pendiente» y el AZT ve el motivo en el rastro.',
    hecho: (n) => 'Punto ' + n + ' devuelto al AZT con el motivo.'
  })
});

/** Número del punto para personas (el id '0' es el punto 1). */
const numero = (p) => Number(p && p.id) + 1;

/**
 * Un lote que no respondió a tiempo (ErrorOdt 'pendiente': «NO repita»): quien llama NO vuelve a habilitar nada.
 * Si el error trae su desenlace (`final`), se espera: entró → `alEntrar()`; falló o la base lo negó → `alFallar(error)`.
 * @returns {boolean} true si era «pendiente» (y ya quedó atendido).
 */
export function seguirPendiente(e, alEntrar, alFallar) {
  if (!e || e.codigo !== 'pendiente') return false;
  if (e.final && typeof e.final.then === 'function') {
    e.final.then(() => alEntrar(), (x) => alFallar(x)).catch(() => {});
  }
  return true;
}

/** ¿`nodo` sigue colgado de `contenedor`? (si el usuario se fue a otra vista, un desenlace tardío no la pinta encima) */
export function sigueEn(nodo, contenedor) {
  for (let n = nodo; n; n = n.parentNode) if (n === contenedor) return true;
  return false;
}

/**
 * @param {HTMLElement} contenedor
 * @param {{repoObs:object, sesion:object, obsId:string, mensaje?:string, alIr:(ancla:string, mensaje?:string)=>void,
 *          alContar?:()=>void}} p
 */
export async function montarDetalleObs(contenedor, p) {
  const { repoObs, sesion, obsId, mensaje, alIr, alContar } = p;
  vaciar(contenedor);
  contenedor.appendChild(h('div', { class: 'odt-acciones' },
    h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: '← Volver a «Por subsanar»', onclick: () => alIr('subsanar') })));
  if (mensaje) contenedor.appendChild(aviso(mensaje, 'ok'));
  const cargando = h('p', { class: 'odt-cargando', text: 'Leyendo la ODT y sus puntos del servidor…' });
  contenedor.appendChild(cargando);
  let obs; let puntos;
  try {
    ({ obs, puntos } = await repoObs.leer(obsId));
  } catch (e) {
    cargando.remove();
    contenedor.appendChild(aviso(mensajeDe(e), 'error'));
    return null;
  }
  cargando.remove();

  /** Después de un cambio: se vuelve a leer del servidor y se muestra el mensaje; la pestaña recuenta. */
  const recargar = (msg) => {
    if (typeof alContar === 'function') alContar();
    return montarDetalleObs(contenedor, { ...p, mensaje: msg });
  };

  const chip = chipObs(obs);
  const c = contar(obs);
  contenedor.appendChild(h('header', { class: 'odt-cabecera' },
    h('h2', { class: 'odt-titulo', text: 'ODT N.º ' + obs.nro + ' · por subsanar' }),
    h('span', { class: chip.clase, text: chip.texto }),
    h('dl', { class: 'odt-datos odt-datos--fila' },
      dato('Subestación', obs.subestacion), dato('Equipo', obs.equipo), dato('Fecha prevista', obs.fechaPrevista),
      dato('AZT asignado', obs.azt && obs.azt.nombre),
      dato('Registrada por', [obs.creadoPor && obs.creadoPor.nombre, Number.isFinite(obs.creadoEnMs) ? fechaHora(obs.creadoEnMs) : ''].filter(Boolean).join(' · ')),
      esAztDe(obs, sesion.uid) ? dato('Usted es', 'el AZT asignado') : null),
    h('p', { class: 'odt-mini odt-obs-conteo', text: textoConteo(obs) + ' (de ' + c.total + ')' })));

  if (obs.estado === 'RESUELTA') {
    const r = obs.resolucion || {};
    contenedor.appendChild(h('p', { class: 'odt-cerrada', role: 'status',
      text: 'Resuelta' + (Number.isFinite(r.enMs) ? ' el ' + fechaHora(r.enMs) : '') + (r.por && r.por.nombre ? ' por ' + r.por.nombre : '')
        + (r.nota ? ' · «' + r.nota + '»' : '') + '. Sus puntos ya no cambian; se conservan tal cual.' }));
  }
  if (listaParaPublicar(obs)) {
    contenedor.appendChild(h('p', { class: 'odt-aviso odt-aviso--ok', role: 'status' },
      LISTA_PARA_PUBLICAR + ': todos los puntos están verificados. ',
      sesion.esAdmin ? h('a', { class: 'odt-enlace', href: '#publicar', text: 'Ir a «Publicar ODT»' }) : 'El administrador la publicará para firma.'));
  }
  for (const a of revisarIntegridad(obs, puntos)) contenedor.appendChild(aviso(a, 'aviso'));

  contenedor.appendChild(h('h3', { class: 'odt-subtitulo', text: 'Puntos' }));
  if (!puntos.length) contenedor.appendChild(h('p', { class: 'odt-vacio', text: 'No se encontraron puntos de esta ODT.' }));
  else contenedor.appendChild(h('ol', { class: 'odt-obs-puntos' }, puntos.map(filaPunto)));

  if (sesion.esAdmin && !sesion.legacy && estaAbierta(obs)) {
    contenedor.appendChild(bloqueAgregar());
    contenedor.appendChild(bloqueResolver());
  }

  function dato(etq, valor) {
    return h('div', { class: 'odt-dato' }, h('dt', { text: etq }), h('dd', { text: valor == null || valor === '' ? '—' : String(valor) }));
  }

  function filaPunto(pt) {
    const estado = String(pt.estado || '');
    const rastro = rastroOrdenado(pt);
    const li = h('li', { class: 'odt-obs-punto', dataset: { punto: String(pt.id) } },
      h('p', { class: 'odt-obs-texto' }, h('b', { text: numero(pt) + '. ' }), pt.texto || '—'),
      h('div', { class: 'odt-obs-linea' },
        h('span', { class: 'odt-chip odt-chip--' + estado.toLowerCase(), text: ETIQUETA_PUNTO[estado] || estado || '—' }),
        h('span', { class: 'odt-mini', text: 'Le toca: ' + (ETIQUETA_QUIEN[pt.quien] || '—') })));
    li.appendChild(rastro.length
      ? h('details', { class: 'odt-detalles odt-obs-rastro' },
        h('summary', { text: 'Rastro (' + rastro.length + (rastro.length === 1 ? ' cambio)' : ' cambios)') }),
        h('ol', { class: 'odt-obs-rastro-lista' }, rastro.map((e) => h('li', {
          text: [Number.isFinite(e.enMs) ? fechaHora(e.enMs) : '—', (e.por && e.por.nombre) || '—', textoCambio(e)].join(' · ')
            + (e.nota ? ' · «' + e.nota + '»' : '')
        }))))
      : h('p', { class: 'odt-mini', text: 'Sin cambios todavía.' }));
    const acciones = accionesPara(obs, pt, sesion);
    if (acciones.length) li.appendChild(bloqueAcciones(pt, acciones));
    else if (sesion.esAdmin && estaAbierta(obs) && estado === ESTADOS_PUNTO.SUBSANADO) {
      const no = motivoNoPuede(obs, pt, 'verificar', sesion);
      if (no) li.appendChild(h('p', { class: 'odt-mini', text: no }));
    }
    return li;
  }

  /** Los botones del primer paso (en un contenedor sin clase) y una caja de nota por acción. */
  function bloqueAcciones(pt, acciones) {
    const st = h('p', { class: 'odt-estado', role: 'status', 'aria-live': 'polite' });
    const filaBotones = h('div', { class: 'odt-acciones' });
    const cajas = [];
    // Contenedor sin clase (sin `display` propio): `hidden` sí lo esconde en el navegador.
    const pasoUno = h('div', {}, filaBotones);
    const volverAlPasoUno = () => { for (const x of cajas) x.caja.hidden = true; pasoUno.hidden = false; };
    for (const accion of acciones) {
      const t = TEXTOS_ACCION[accion];
      const id = 'odtObsNota' + pt.id + accion;
      const ta = h('textarea', { id, class: 'odt-campo', rows: 3, maxLength: TOPES_OBS.notaMax });
      const confirmar = h('button', { type: 'button', class: 'odt-btn ' + (accion === 'devolver' ? 'odt-btn--peligro' : 'odt-btn--primario'), text: t.confirmar });
      const cancelar = h('button', { type: 'button', class: 'odt-btn', text: 'Cancelar' });
      const caja = h('div', { class: 'odt-confirmar', role: 'group', 'aria-label': t.boton + ' el punto ' + numero(pt), hidden: true },
        h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: id, text: t.etiqueta }), ta),
        h('p', { class: 'odt-parrafo', text: t.linea }),
        h('div', { class: 'odt-acciones' }, confirmar, cancelar));
      cajas.push({ caja, accion });
      const boton = h('button', {
        type: 'button', class: 'odt-btn ' + (accion === 'devolver' ? 'odt-btn--peligro' : 'odt-btn--primario'), text: t.boton,
        dataset: { accion }
      });
      boton.addEventListener('click', () => { st.textContent = ''; pasoUno.hidden = true; caja.hidden = false; });
      cancelar.addEventListener('click', () => { st.textContent = ''; volverAlPasoUno(); });
      let ocupado = false;
      const liberar = () => { ocupado = false; confirmar.disabled = false; cancelar.disabled = false; };
      confirmar.addEventListener('click', async () => {
        if (ocupado || caja.hidden) return;
        const err = errorNota(accion, ta.value);
        if (err) { st.textContent = err; return; }
        ocupado = true; confirmar.disabled = true; cancelar.disabled = true;
        try {
          await repoObs.cambiarPunto(obs.id, String(pt.id), accion, ta.value);
          await recargar(t.hecho(numero(pt)));
        } catch (e) {
          st.textContent = mensajeDe(e);
          // «NO repita»: «Confirmar» y «Cancelar» siguen bloqueados hasta saber el desenlace del lote.
          if (seguirPendiente(e, () => { if (sigueEn(st, contenedor)) recargar(t.hecho(numero(pt))); },
            (x) => { st.textContent = mensajeDe(x); liberar(); })) return;
          liberar();
        }
      });
      filaBotones.appendChild(boton);
    }
    return h('div', { class: 'odt-obs-accion' }, pasoUno, cajas.map((x) => x.caja), st);
  }

  function bloqueAgregar() {
    const resumen = h('summary', { text: 'Agregar punto (administrador)' });
    const k = siguienteIdPunto(obs);
    if (k == null) return h('details', { class: 'odt-bloque odt-detalles' }, resumen, aviso('La ODT ya tiene ' + TOPES_OBS.puntosMax + ' puntos: no caben más.', 'info'));
    const ta = h('textarea', { id: 'odtObsPuntoNuevo', class: 'odt-campo', rows: 2, maxLength: TOPES_OBS.textoMax + 20 });
    const st = h('p', { class: 'odt-estado', role: 'status' });
    const btn = h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Agregar punto' });
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      // UN punto a la vez: cada línea con texto sería un punto (como al registrar); nunca se juntan en uno.
      const lineas = String(ta.value || '').split(/\r\n|\r|\n/).map(leerLinea).filter(Boolean);
      if (lineas.length > 1) { st.textContent = 'Agregue un punto a la vez (escribió ' + lineas.length + ' líneas con texto).'; return; }
      const l = lineas[0] || null;
      const err = !l ? 'Escriba el punto.' : (l.texto ? errorTextoPunto(l.texto) : 'Después de los dos puntos falta el punto.');
      if (err) { st.textContent = err; return; }
      btn.disabled = true;
      const hecho = (kk) => (kk == null ? 'Punto nuevo agregado' : 'Punto ' + (Number(kk) + 1) + ' agregado')
        + ' (Pendiente, le toca: ' + ETIQUETA_QUIEN[l.quien] + ').';
      try {
        const r = await repoObs.agregarPunto(obs.id, { texto: l.texto, quien: l.quien });
        await recargar(hecho(r.k));
      } catch (e) {
        st.textContent = mensajeDe(e);
        // «NO repita»: «Agregar punto» sigue bloqueado hasta saber el desenlace del lote.
        if (seguirPendiente(e, () => { if (sigueEn(st, contenedor)) recargar(hecho(null)); },
          (x) => { st.textContent = mensajeDe(x); btn.disabled = false; })) return;
        btn.disabled = false;
      }
    });
    return h('details', { class: 'odt-bloque odt-detalles' }, resumen,
      h('p', { class: 'odt-mini', text: 'Queda PENDIENTE para el AZT asignado y no se puede borrar después. Un punto a la vez, con el formato de una línea del registro: puede empezar con «Contratista:», «AZT:» o «Responsable:» (sin prefijo, le toca al Contratista).' }),
      h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtObsPuntoNuevo', text: 'Punto nuevo (de ' + TOPES_OBS.textoMin + ' a ' + TOPES_OBS.textoMax + ' caracteres)' }), ta),
      h('div', { class: 'odt-acciones' }, btn), st);
  }

  function bloqueResolver() {
    const ta = h('textarea', { id: 'odtObsResolver', class: 'odt-campo', rows: 2, maxLength: TOPES_OBS.notaMax });
    const st = h('p', { class: 'odt-estado', role: 'status' });
    const btn = h('button', { type: 'button', class: 'odt-btn odt-btn--peligro', text: 'Dar por resuelta' });
    const confirmar = h('button', { type: 'button', class: 'odt-btn odt-btn--peligro', text: 'Sí, darla por resuelta (no se puede deshacer)' });
    const pasoUno = h('div', {}, h('div', { class: 'odt-acciones' }, btn));
    const pasoDos = h('div', { hidden: true }, h('div', { class: 'odt-acciones' }, confirmar));
    const faltan = c.total - c.verificados;
    ta.addEventListener('input', () => { pasoDos.hidden = true; pasoUno.hidden = false; });
    btn.addEventListener('click', () => {
      const err = errorResolver(obs, ta.value);
      if (err) { st.textContent = err; return; }
      st.textContent = 'La ODT queda RESUELTA para siempre: ningún punto vuelve a cambiar (se conservan y se siguen viendo) y su N.º queda libre para registrar otra si hiciera falta.'
        + (faltan > 0 ? ' Ojo: ' + faltan + (faltan === 1 ? ' punto no está verificado.' : ' puntos no están verificados.') : '');
      pasoUno.hidden = true; pasoDos.hidden = false;
    });
    confirmar.addEventListener('click', async () => {
      if (pasoDos.hidden || confirmar.disabled) return;
      confirmar.disabled = true;
      const hecho = 'ODT N.º ' + obs.nro + ' dada por resuelta.';
      try {
        await repoObs.resolver(obs.id, ta.value);
        await recargar(hecho);
      } catch (e) {
        st.textContent = mensajeDe(e);
        // «NO repita»: el «Sí» sigue bloqueado hasta saber el desenlace del lote.
        if (seguirPendiente(e, () => { if (sigueEn(st, contenedor)) recargar(hecho); },
          (x) => { st.textContent = mensajeDe(x); confirmar.disabled = false; })) return;
        confirmar.disabled = false;
      }
    });
    return h('details', { class: 'odt-bloque odt-detalles' },
      h('summary', { text: 'Dar por resuelta (administrador)' }),
      h('p', { class: 'odt-mini', text: 'Solo si quiere cerrarla del todo (por ejemplo, la ODT ya no va). Para publicarla NO hace falta: basta con que todos los puntos estén verificados.' }),
      h('div', { class: 'odt-campo-fila' }, h('label', { htmlFor: 'odtObsResolver', text: 'Por qué se da por resuelta (de ' + TOPES_OBS.notaMin + ' a ' + TOPES_OBS.notaMax + ' caracteres)' }), ta),
      pasoUno, pasoDos, st);
  }

  return { obs, puntos };
}

