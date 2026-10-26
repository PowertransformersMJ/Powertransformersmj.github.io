// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · VENTANA DEL EQUIPO (selector)
// ──────────────────────────────────────────────────────────────
// Al pulsar «Informe» en el listado: los informes que ya tiene ese equipo
// (abrir) y «Nuevo informe». La ACTIVIDAD se escribe a mano o se escoge de las
// sugerencias (la lista de motivos de Órdenes de materiales); viene escrita la
// de refrigeración (pedido del Ingeniero, 2026-10-26). Toda actividad válida
// arma el informe con el único modelo que existe, el F60 de refrigeración
// (decisión 2); sus textos se ajustan en el editor. La regla de la actividad
// (una línea, de 3 a 200 caracteres, sin espacios sobrantes) vive en
// `domain/informe_brigada_actividad.js`, la misma que aplican planCrear y las reglas.
// La acción de refrigeración registrada es OPCIONAL: si existe se ofrece para
// llenar los ventiladores (desmarcada) y NUNCA se modifica (decisión 12).
// La ventana atrapa el foco y se cierra con Esc (`ui/foco-modal.js`); con una
// ventana encima de otra (la confirmación de «borrador abierto»), Esc cierra
// SOLO la de arriba.
// ══════════════════════════════════════════════════════════════

import { atraparFoco } from '../foco-modal.js';
// Archivo NUEVO (L-102): nunca está viejo en la caché del navegador.
import { normalizarActividad, avisoActividad } from '../../domain/informe_brigada_actividad.js';

let contador = 0;
// Ventanas abiertas de este módulo, la de arriba al final. Cada trampa de foco escucha Esc en
// `document` y la de abajo se registró primero: sin esta pila, un Esc en la confirmación cerraba
// también «Nuevo informe» y se perdía la actividad escrita (revisión 2026-10-26).
const abiertas = [];
/** La ventana de arriba que sigue en la página (una que alguien quitó sin cerrarla no tapa a las demás). */
const ventanaDeArriba = () => {
  for (let i = abiertas.length - 1; i >= 0; i--) if (abiertas[i].isConnected) return abiertas[i];
  return null;
};

/**
 * Ventana modal mínima con el sistema AQUA (`.ibr-velo` + `.ibr-ventana`).
 * @returns {{ el: HTMLElement, cuerpo: HTMLElement, pie: HTMLElement, cerrar: () => void }}
 */
export function crearVentana({ titulo = '', subtitulo = '', ancho = '', alCerrar = null, escape = true } = {}) {
  contador += 1;
  const idT = 'ibrVentanaT' + contador;
  const velo = document.createElement('div');
  velo.className = 'ibr-velo';
  velo.innerHTML = '<div class="ibr-ventana' + (ancho ? ' ibr-ventana--' + ancho : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + idT + '">'
    + '<div class="ibr-ventana-cab"><div><h2 class="ibr-ventana-t" id="' + idT + '"></h2>'
    + '<p class="ibr-ventana-sub" data-v="sub"></p></div>'
    + '<button type="button" class="ibr-cerrar" data-v="cerrar" aria-label="Cerrar">×</button></div>'
    + '<div class="ibr-ventana-cuerpo" data-v="cuerpo"></div>'
    + '<div class="ibr-ventana-pie" data-v="pie"></div>'
    + '</div>';
  velo.querySelector('#' + idT).textContent = titulo;
  const sub = velo.querySelector('[data-v="sub"]');
  sub.textContent = subtitulo;
  sub.hidden = !subtitulo;
  document.body.appendChild(velo);
  const ventana = velo.querySelector('.ibr-ventana');
  let trampa = null;
  let vivo = true;
  const cerrar = () => {
    if (!vivo) return;
    vivo = false;
    const i = abiertas.indexOf(velo);
    if (i >= 0) abiertas.splice(i, 1);
    if (trampa) { trampa.soltar(); trampa = null; }
    velo.remove();
    if (typeof alCerrar === 'function') alCerrar();
  };
  abiertas.push(velo);
  // Esc: lo atiende una sola ventana, la de arriba (las trampas de abajo también lo oyen).
  const alEsc = (ev) => {
    if ((ev && ev.__ibrEscAtendido) || ventanaDeArriba() !== velo) return;
    if (ev) ev.__ibrEscAtendido = true;
    cerrar();
  };
  velo.querySelector('[data-v="cerrar"]').addEventListener('click', cerrar);
  // Clic en el fondo: cierra solo si el clic EMPEZÓ y TERMINÓ en el fondo (L-101: un arrastre desde un campo no cierra).
  let abajoEnVelo = false;
  velo.addEventListener('pointerdown', (ev) => { abajoEnVelo = ev.target === velo; });
  velo.addEventListener('click', (ev) => { if (ev.target === velo && abajoEnVelo && escape) cerrar(); });
  const api = {
    el: ventana,
    cuerpo: velo.querySelector('[data-v="cuerpo"]'),
    pie: velo.querySelector('[data-v="pie"]'),
    cerrar,
    atrapar(autoFoco) { if (trampa) trampa.soltar(); trampa = atraparFoco(ventana, { alCerrar: alEsc, autoFoco, escape }); }
  };
  return api;
}

/**
 * Pide un texto (motivo) en una ventana. Resuelve con el texto o null si se cancela.
 */
export function pedirTexto({ titulo, explicacion = '', etiqueta = 'Motivo', minimo = 0, maximo = 500, boton = 'Aceptar', peligro = false, esc }) {
  return new Promise((res) => {
    let hecho = false;
    const v = crearVentana({ titulo, alCerrar: () => { if (!hecho) res(null); } });
    v.cuerpo.innerHTML = (explicacion ? '<p class="ibr-parrafo">' + esc(explicacion) + '</p>' : '')
      + '<label class="ibr-campo"><span class="ibr-campo-et">' + esc(etiqueta) + '</span>'
      + '<textarea class="ibr-textarea" rows="3" maxlength="' + maximo + '" data-v="texto"></textarea></label>'
      + '<p class="ibr-ayuda" data-v="cuenta"></p>';
    v.pie.innerHTML = '<button type="button" class="ibr-btn" data-v="no">Cancelar</button>'
      + '<button type="button" class="ibr-btn ' + (peligro ? 'ibr-btn--peligro' : 'ibr-btn--primario') + '" data-v="si" disabled>' + esc(boton) + '</button>';
    const ta = v.cuerpo.querySelector('[data-v="texto"]');
    const si = v.pie.querySelector('[data-v="si"]');
    const cuenta = v.cuerpo.querySelector('[data-v="cuenta"]');
    const revisar = () => {
      const n = ta.value.trim().length;
      si.disabled = n < minimo;
      cuenta.textContent = minimo ? (n < minimo ? 'Faltan ' + (minimo - n) + ' caracteres (mínimo ' + minimo + ').' : 'Listo.') : '';
    };
    ta.addEventListener('input', revisar);
    revisar();
    v.pie.querySelector('[data-v="no"]').addEventListener('click', () => v.cerrar());
    si.addEventListener('click', () => { if (si.disabled) return; hecho = true; const t = ta.value.trim(); v.cerrar(); res(t); });
    v.atrapar(ta);
  });
}

/** Confirmación sí/no. Resuelve true/false. */
export function confirmar({ titulo, texto, boton = 'Sí', peligro = false, esc }) {
  return new Promise((res) => {
    let hecho = false;
    const v = crearVentana({ titulo, alCerrar: () => { if (!hecho) res(false); } });
    v.cuerpo.innerHTML = '<p class="ibr-parrafo">' + esc(texto) + '</p>';
    v.pie.innerHTML = '<button type="button" class="ibr-btn" data-v="no">Cancelar</button>'
      + '<button type="button" class="ibr-btn ' + (peligro ? 'ibr-btn--peligro' : 'ibr-btn--primario') + '" data-v="si">' + esc(boton) + '</button>';
    v.pie.querySelector('[data-v="no"]').addEventListener('click', () => v.cerrar());
    v.pie.querySelector('[data-v="si"]').addEventListener('click', () => { hecho = true; v.cerrar(); res(true); });
    v.atrapar('[data-v="no"]');
  });
}

/**
 * Ventana del equipo: sus informes y «Nuevo informe».
 * @param {{ ctx, equipo, alAbrir: (id) => void, alCrear: (doc) => void }} o
 */
export function abrirSelector({ ctx, equipo, alAbrir, alCrear }) {
  const F = ctx.dep.formulario;
  const L = ctx.dep.listado;
  const P = ctx.dep.plantilla;
  const fmt = ctx.dep.formato;
  const esc = F.escaparHtml;
  const cond = L.condicionDe(equipo);
  const mva = L.mvaDe(equipo);
  const sub = [
    mva != null ? String(Math.round(mva * 100) / 100).replace('.', ',') + ' MVA (inventario)' : 'sin potencia en el inventario',
    equipo.zona || '', equipo.departamento ? fmt.departamentoPapel(equipo.departamento) : '',
    cond != null ? 'condición ' + cond + ' (' + ((P.NOMBRE_CONDICION || {})[cond] || '') + ')' : 'sin calificación de salud'
  ].filter(Boolean).join(' · ');

  const v = crearVentana({ titulo: (equipo.matricula || '—') + ' · ' + (equipo.subestacion || 'Subestación sin nombre'), subtitulo: sub, ancho: 'media' });

  // Sugerencias: la lista de motivos (las 8). La actividad también se escribe a mano.
  const actividades = Array.isArray(P.ACTIVIDADES) ? P.ACTIVIDADES : [];
  contador += 1;
  const idSugerencias = 'ibrSelActividades' + contador;
  const sugerencias = actividades.map((a) => '<option value="' + esc(a) + '"></option>').join('');

  v.cuerpo.innerHTML = ''
    + '<h3 class="ibr-sub">Informes de este equipo</h3>'
    + '<div data-s="lista" class="ibr-sel-lista"><p class="ibr-nota">Leyendo los informes…</p></div>'
    + '<h3 class="ibr-sub">Nuevo informe</h3>'
    + (ctx.puedeEditar
      ? '<div class="ibr-campo"><label class="ibr-campo-et" for="' + idSugerencias + 'Campo">Actividad</label>'
        + '<input type="text" class="ibr-input" id="' + idSugerencias + 'Campo" data-s="actividad" list="' + idSugerencias + '"'
        + ' autocomplete="off" aria-describedby="' + idSugerencias + 'Aviso ' + idSugerencias + 'Ayuda ' + idSugerencias + 'Modelo"'
        + ' value="' + esc(P.ACTIVIDAD_REFRIGERACION || '') + '">'
        + '<datalist id="' + idSugerencias + '">' + sugerencias + '</datalist>'
        + '<span class="ibr-ayuda" id="' + idSugerencias + 'Aviso" data-s="actividad-aviso" aria-live="polite"></span></div>'
        + '<p class="ibr-ayuda" id="' + idSugerencias + 'Ayuda">Escoja una de la lista (borre el texto para verlas todas) o escriba la suya, en una sola línea.</p>'
        + '<p class="ibr-ayuda" id="' + idSugerencias + 'Modelo">El informe se arma con el modelo F60 de refrigeración; sus textos se ajustan en el editor.</p>'
        + '<div data-s="accion" class="ibr-sel-accion"><p class="ibr-tenue">Buscando acciones de refrigeración de este equipo…</p></div>'
        + '<p class="ibr-ayuda">Llega lleno lo que la plataforma sabe (inventario, salud, 60 Hz, contrato); todo se puede corregir.</p>'
      : '<p class="ibr-nota">' + (ctx.estadoConfig === 'sin_config'
        ? 'Falta que un administrador configure quiénes arman el informe.'
        : 'Solo las personas que el administrador habilitó crean informes. Usted puede abrir los existentes.') + '</p>');
  v.pie.innerHTML = '<button type="button" class="ibr-btn" data-s="cancelar">Cerrar</button>'
    + (ctx.puedeEditar ? '<button type="button" class="ibr-btn ibr-btn--primario" data-s="crear">Crear informe</button>' : '');

  const $ = (s) => v.el.querySelector('[data-s="' + s + '"]');
  $('cancelar').addEventListener('click', () => v.cerrar());
  // En pantalla táctil el foco inicial NO va al campo de texto: sacaría el teclado y taparía
  // «Informes de este equipo» (antes era una lista desplegable, que no lo saca).
  let tactil = false;
  try { tactil = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches; } catch (_) { /* sin matchMedia: escritorio */ }
  v.atrapar(ctx.puedeEditar && !tactil ? '[data-s="actividad"]' : '[data-s="cancelar"]');

  /* informes del equipo */
  let informesDelEquipo = null;   // null = todavía no se sabe
  ctx.repo.listarDeEquipo(equipo.matricula, { limite: 50 }).then((lista) => {
    informesDelEquipo = Array.isArray(lista) ? lista : [];
    const caja = $('lista');
    if (!caja) return;
    if (!lista || !lista.length) { caja.innerHTML = '<p class="ibr-tenue">Este equipo todavía no tiene informes.</p>'; return; }
    caja.innerHTML = '<ul class="ibr-sel-informes">' + lista.map((inf) => {
      const t = (inf.contenido && inf.contenido.trabajo) || {};
      const fechas = t.fecha_inicio || t.fecha_fin
        ? 'ejecución ' + [fmt.fechaDMA(t.fecha_inicio), fmt.fechaDMA(t.fecha_fin)].filter(Boolean).join(' – ')
        : 'sin fechas de ejecución';
      const cls = inf.estado === 'emitido' ? 'chip--success' : (inf.estado === 'anulado' ? 'chip--danger' : 'chip--warn');
      return '<li><div><span class="chip ' + cls + ' ibr-chip-chico">' + esc(L.etiquetaEstado(inf.estado, inf.version)) + '</span> '
        + '<b>' + esc(inf.actividad === P.ACTIVIDAD_REFRIGERACION ? 'Refrigeración' : (inf.actividad || '')) + '</b>'
        + '<div class="ibr-mini">' + esc(fechas) + ' · actualizado ' + esc(F.haceCuanto(inf.actualizadoEn))
        + (inf.creadoPor && inf.creadoPor.nombre ? ' · creó ' + esc(inf.creadoPor.nombre) : '') + '</div></div>'
        + '<button type="button" class="ibr-btn" data-abrir="' + esc(inf.id) + '">Abrir</button></li>';
    }).join('') + '</ul>';
  }).catch((err) => {
    const caja = $('lista');
    if (caja) caja.innerHTML = '<p class="ibr-nota ibr-nota--error">No se pudieron leer los informes: ' + esc((err && err.message) || err) + '</p>';
  });
  v.el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-abrir]');
    if (!b) return;
    const id = b.getAttribute('data-abrir');
    v.cerrar();
    alAbrir(id);
  });

  if (!ctx.puedeEditar) return v;

  /* acciones de refrigeración (solo lectura, opcional) */
  let acciones = [];
  ctx.repo.listarAcciones(equipo.matricula).then((lista) => {
    acciones = Array.isArray(lista) ? lista : [];
    const caja = $('accion');
    if (!caja) return;
    if (lista && lista.error) { caja.innerHTML = '<p class="ibr-tenue">' + esc(lista.error) + ' El informe se arma igual.</p>'; return; }
    if (!acciones.length) { caja.innerHTML = '<p class="ibr-tenue">Este equipo no tiene acción de refrigeración registrada: los ventiladores se escriben en el informe.</p>'; return; }
    const etiqueta = (a) => 'del ' + (fmt.fechaDMA(String(a.fecha_accion || '').slice(0, 10)) || 'día sin fecha') + (a.estado_accion ? ' (' + a.estado_accion + ')' : '');
    caja.innerHTML = '<label class="ibr-casilla"><input type="checkbox" data-s="usar-accion"> '
      + 'Llenar los ventiladores con la acción de refrigeración '
      + (acciones.length === 1 ? esc(etiqueta(acciones[0])) : '') + '</label>'
      + (acciones.length > 1
        ? '<select class="ibr-select" data-s="cual-accion" aria-label="Acción de refrigeración">'
          + acciones.map((a, i) => '<option value="' + i + '">' + esc(etiqueta(a)) + '</option>').join('') + '</select>'
        : '')
      + '<p class="ibr-ayuda">Solo se COPIAN los ventiladores y las potencias de la acción; la acción no se modifica.</p>';
  }).catch(() => {
    const caja = $('accion');
    if (caja) caja.innerHTML = '<p class="ibr-tenue">No se pudieron leer las acciones de refrigeración. El informe se arma igual.</p>';
  });

  /* actividad: escrita a mano o de las sugerencias; se revisa mientras se escribe */
  let creando = false;
  const campoAct = $('actividad');
  const avisoAct = $('actividad-aviso');
  /** Revisa la actividad; devuelve el error (o null). `estricto`: vacío también va en rojo (al salir o al crear). */
  const revisarActividad = (estricto = false) => {
    const a = avisoActividad(campoAct.value, { lista: actividades, estricto });
    campoAct.classList.toggle('ibr-input--malo', a.error);
    campoAct.setAttribute('aria-invalid', a.error ? 'true' : 'false');
    const clase = a.error ? 'ibr-campo-error' : 'ibr-ayuda';
    if (avisoAct.className !== clase) avisoAct.className = clase;
    // Solo si cambia: reescribir el mismo texto en cada tecla hace que el lector de pantalla lo repita.
    if (avisoAct.textContent !== a.texto) avisoAct.textContent = a.texto;
    if (!creando) $('crear').disabled = !a.sirve;
    return a.sirve ? null : a.texto;
  };
  campoAct.addEventListener('input', () => revisarActividad(false));
  // Al salir del campo se ve tal como se guardará (sin espacios sobrantes ni marcas invisibles).
  campoAct.addEventListener('blur', () => {
    const act = normalizarActividad(campoAct.value);
    if (act !== campoAct.value) campoAct.value = act;
    revisarActividad(true);
  });
  revisarActividad(false);
  // Viene escrita la de refrigeración: queda SELECCIONADA para que lo que se escriba la reemplace
  // (con el cursor al inicio, lo escrito quedaba pegado delante y la actividad no se cambia después de crear).
  if (document.activeElement === campoAct) { try { campoAct.select(); } catch (_) { /* nada */ } }

  /* crear */
  $('crear').addEventListener('click', async (ev) => {
    if (creando || ev.detail > 1) return;   // L-101: un doble clic no crea dos informes
    const err = revisarActividad(true);
    if (err) { ctx.avisar(err, 'aviso'); campoAct.focus(); return; }
    const actividad = normalizarActividad(campoAct.value);
    const usar = $('usar-accion') && $('usar-accion').checked;
    const idx = $('cual-accion') ? Number($('cual-accion').value) : 0;
    const accion = usar ? (acciones[idx] || null) : null;
    // Un equipo con un borrador abierto de la misma actividad: casi siempre se quiere seguir ese, no crear otro.
    const abierto = (informesDelEquipo || []).find((x) => x && x.estado === 'borrador' && normalizarActividad(x.actividad) === actividad);
    if (abierto) {
      creando = true;
      const seguir = await confirmar({
        titulo: 'Este equipo ya tiene un borrador abierto', esc, boton: 'Crear otro de todas formas',
        texto: 'Hay un borrador de esta actividad (actualizado ' + F.haceCuanto(abierto.actualizadoEn) + (abierto.creadoPor && abierto.creadoPor.nombre ? ', lo creó ' + abierto.creadoPor.nombre : '') + '). '
          + 'Para seguirlo, cierre esta ventana y use «Abrir». ¿Crear un informe NUEVO de todas formas?'
      });
      creando = false;
      if (!seguir) return;
    }
    creando = true;
    const boton = $('crear');
    boton.disabled = true;
    boton.textContent = 'Creando…';
    try {
      const r = ctx.dep.modelo.prellenar({ equipo, config: ctx.config, accion, actividad });
      const contenido = r && r.esquema ? r : (r && r.contenido) || r;
      // El modelo lo decide el dominio: el de la actividad o, si no tiene, el único que existe (F60).
      const modelo = (contenido && contenido.modelo) || P.modeloDeActividad(P.ACTIVIDAD_REFRIGERACION);
      const eq = (contenido && contenido.equipo) || {};
      const doc = await ctx.repo.crear({
        equipo_ref: {
          transformador_id: String(equipo.transformador_id || eq.transformador_id || ''),
          matricula: String(equipo.matricula || eq.matricula || ''),
          subestacion: String(eq.subestacion || equipo.subestacion || ''),
          serie: String(eq.serie || equipo.serie || '')
        },
        actividad, modelo, contenido
      });
      v.cerrar();
      alCrear(doc);
    } catch (err) {
      console.error('[informe-brigada] crear:', err);
      ctx.avisar('No se pudo crear el informe: ' + ((err && err.message) || err), 'error', 0);
      boton.textContent = 'Crear informe';
      creando = false;
      revisarActividad();   // vuelve a habilitar «Crear informe» si la actividad sirve
    }
  });
  return v;
}
