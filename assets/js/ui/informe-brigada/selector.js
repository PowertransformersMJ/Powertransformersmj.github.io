// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · VENTANA DEL EQUIPO (selector)
// ──────────────────────────────────────────────────────────────
// Al pulsar «Informe» en el listado: los informes que ya tiene ese equipo
// (abrir) y «Nuevo informe» (escoger la actividad de la lista cerrada de
// motivos; hoy solo «Actualización y repotenciación del sistema de
// refrigeración.» tiene modelo, decisión 2).
// La acción de refrigeración registrada es OPCIONAL: si existe se ofrece para
// llenar los ventiladores (desmarcada) y NUNCA se modifica (decisión 12).
// La ventana atrapa el foco y se cierra con Esc (`ui/foco-modal.js`).
// ══════════════════════════════════════════════════════════════

import { atraparFoco } from '../foco-modal.js';

let contador = 0;

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
    if (trampa) { trampa.soltar(); trampa = null; }
    velo.remove();
    if (typeof alCerrar === 'function') alCerrar();
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
    atrapar(autoFoco) { if (trampa) trampa.soltar(); trampa = atraparFoco(ventana, { alCerrar: cerrar, autoFoco, escape }); }
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

  const actividades = Array.isArray(P.ACTIVIDADES) ? P.ACTIVIDADES : [];
  const opciones = actividades.map((a) => {
    const conModelo = !!P.modeloDeActividad(a);
    return '<option value="' + esc(a) + '"' + (conModelo ? '' : ' disabled') + (a === P.ACTIVIDAD_REFRIGERACION ? ' selected' : '') + '>'
      + esc(a) + (conModelo ? '' : ' (sin modelo todavía)') + '</option>';
  }).join('');

  v.cuerpo.innerHTML = ''
    + '<h3 class="ibr-sub">Informes de este equipo</h3>'
    + '<div data-s="lista" class="ibr-sel-lista"><p class="ibr-nota">Leyendo los informes…</p></div>'
    + '<h3 class="ibr-sub">Nuevo informe</h3>'
    + (ctx.puedeEditar
      ? '<label class="ibr-campo"><span class="ibr-campo-et">Actividad</span>'
        + '<select class="ibr-select" data-s="actividad">' + opciones + '</select></label>'
        + '<p class="ibr-ayuda">El modelo F60 aplica a «' + esc(P.ACTIVIDAD_REFRIGERACION || '') + '». Las demás actividades todavía no tienen modelo.</p>'
        + '<div data-s="accion" class="ibr-sel-accion"><p class="ibr-tenue">Buscando acciones de refrigeración de este equipo…</p></div>'
        + '<p class="ibr-ayuda">Llega lleno lo que la plataforma sabe (inventario, salud, 60 Hz, contrato); todo se puede corregir.</p>'
      : '<p class="ibr-nota">' + (ctx.estadoConfig === 'sin_config'
        ? 'Falta que un administrador configure quiénes arman el informe.'
        : 'Solo las personas que el administrador habilitó crean informes. Usted puede abrir los existentes.') + '</p>');
  v.pie.innerHTML = '<button type="button" class="ibr-btn" data-s="cancelar">Cerrar</button>'
    + (ctx.puedeEditar ? '<button type="button" class="ibr-btn ibr-btn--primario" data-s="crear">Crear informe</button>' : '');

  const $ = (s) => v.el.querySelector('[data-s="' + s + '"]');
  $('cancelar').addEventListener('click', () => v.cerrar());
  v.atrapar(ctx.puedeEditar ? '[data-s="actividad"]' : '[data-s="cancelar"]');

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

  /* crear */
  let creando = false;
  $('crear').addEventListener('click', async (ev) => {
    if (creando || ev.detail > 1) return;   // L-101: un doble clic no crea dos informes
    const actividad = $('actividad').value;
    const modelo = P.modeloDeActividad(actividad);
    if (!modelo) { ctx.avisar('Esa actividad todavía no tiene modelo de informe.', 'aviso'); return; }
    const usar = $('usar-accion') && $('usar-accion').checked;
    const idx = $('cual-accion') ? Number($('cual-accion').value) : 0;
    const accion = usar ? (acciones[idx] || null) : null;
    // Un equipo con un borrador abierto de la misma actividad: casi siempre se quiere seguir ese, no crear otro.
    const abierto = (informesDelEquipo || []).find((x) => x && x.estado === 'borrador' && x.actividad === actividad);
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
      boton.disabled = false;
      boton.textContent = 'Crear informe';
      creando = false;
    }
  });
  return v;
}
