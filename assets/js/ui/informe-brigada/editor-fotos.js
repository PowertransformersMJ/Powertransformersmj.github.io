// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · FOTOS, FIGURAS y ANEXOS del editor
// ──────────────────────────────────────────────────────────────
//   · Cuadrículas por sección (2 × 1, 1 × 1, tres fotos, cuatro fotos): se
//     agregan, quitan, mueven y cambian de disposición; el pie se escribe y la
//     numeración de figuras es automática (la misma regla que el papel).
//   · Una foto por hueco: se REDUCE en el navegador (≈ 140–160 KB, sin datos
//     de cámara ni GPS, bien orientada; decisión 5) y se sube al almacén con
//     su huella. Barra por foto; si una falla, se reintenta solo esa.
//   · Óvalos rojos: en modo «Marcar», arrastrar sobre la foto dibuja el óvalo.
//     `pointermove` vive SOLO mientras se arrastra (CLAUDE.md §3.5).
//   · Anexos: pantallazo de la consignación, fichas técnicas desde la
//     biblioteca (o una nueva que queda en la biblioteca) y el cálculo de
//     ventiladores, que sale solo de las dos tablas de 4.3 (decisión 9).
// ══════════════════════════════════════════════════════════════

import { crearVentana, confirmar } from './selector.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const MINIMO_OVALO = 0.02;   // fracción de la foto: un clic suelto no deja un óvalo

/**
 * @param {{ ctx, obtener: () => object, cambiar: Function, editable: () => boolean, informeId: () => string,
 *           bloqueantes: () => Set<string>, mensajes: (ruta) => string, chipOrigen: (ruta) => string, repintar: () => void }} api
 */
export function crearEditorFotos(api) {
  const { ctx } = api;
  const dep = ctx.dep;
  const M = dep.modelo;
  const P = dep.plantilla;
  const F = dep.formulario;
  const esc = F.escaparHtml;

  const estados = new Map();     // clave de destino → { fase, pct, msg, archivo, destino }
  const marcando = new Set();    // 'figId:k' en modo «Marcar»
  const urls = new Map();        // archivoId → Promise<string|null>
  const locales = new Map();     // archivoId → objectURL de la foto recién reducida (no hace falta leerla de vuelta)
  let raizConPuntero = null;
  let vivo = true;

  /* ── utilidades ── */
  const ruta = (clave, g, f, k) => 'figuras.' + clave + '.' + g + '.figuras.' + f + '.fotos.' + k;
  const claveDe = (d) => (d.tipo === 'anexo' ? 'anexo:' + d.clave : d.figId + ':' + d.k);

  function buscarHueco(c, clave, figId, k) {
    const lista = (c.figuras && c.figuras[clave]) || [];
    for (let g = 0; g < lista.length; g++) {
      const figs = lista[g].figuras || [];
      for (let f = 0; f < figs.length; f++) if (figs[f].id === figId) return { seccion: clave, g, f, k };
    }
    return null;
  }

  function urlArchivo(id) {
    if (locales.has(id)) return Promise.resolve(locales.get(id));
    if (!urls.has(id)) {
      const ref = 'archivo:' + id;
      const p = ctx.resolverUrls([ref], { contenido: api.obtener() }).then((m) => (m && m.get(ref)) || null).catch(() => null);
      urls.set(id, p);
    }
    return urls.get(id);
  }

  function urlRef(ref) {
    return ctx.resolverUrls([ref], { contenido: api.obtener() }).then((m) => (m && m.get(ref)) || null).catch(() => null);
  }

  function textoNoDisponible() {
    return ctx.modo === 'local' ? 'La foto del modo local se perdió al recargar: vuelva a cargarla.' : 'No se pudo leer la foto del almacenamiento.';
  }

  /* ── figuras ── */

  function progresoHtml(key) {
    const e = estados.get(key);
    if (!e) return '';
    if (e.fase === 'reduciendo') return '<div class="ibr-progreso"><span class="ibr-prog-barra"><span class="ibr-prog-ind"></span></span> Reduciendo la foto…</div>';
    if (e.fase === 'subiendo') {
      const pct = Math.round((e.pct || 0) * 100);
      return '<div class="ibr-progreso"><span class="ibr-prog-barra"><span class="ibr-prog-val" style="transform:scaleX(' + (pct / 100) + ')"></span></span> Subiendo… ' + pct + ' %</div>';
    }
    return '<div class="ibr-progreso ibr-progreso--mal">' + esc(e.msg || 'No se pudo cargar.')
      + (api.editable() ? ' <button type="button" class="ibr-btn ibr-btn--chico" data-foto-accion="reintentar" data-estado="' + esc(key) + '">Reintentar</button>' : '') + '</div>';
  }

  function ovalosSvg(marcas) {
    return '<svg class="ibr-ovalos" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
      + (marcas || []).map((m) => '<ellipse cx="' + ((m.x + m.w / 2) * 100) + '" cy="' + ((m.y + m.h / 2) * 100) + '" rx="' + (m.w * 50) + '" ry="' + (m.h * 50) + '"></ellipse>').join('')
      + '</svg>';
  }

  function huecoHtml(clave, g, f, k, figura, nro) {
    const foto = (figura.fotos || [])[k] || { archivo: null, marcas: [] };
    const r = ruta(clave, g, f, k);
    const key = figura.id + ':' + k;
    const ed = api.editable();
    const falta = api.bloqueantes().has(r + '.archivo');
    const destino = esc(clave + '|' + figura.id + '|' + k);
    const etiqueta = 'Figura ' + nro + (figura.fotos && figura.fotos.length > 1 ? ', foto ' + (k + 1) : '');
    let cuerpo;
    if (foto.archivo) {
      const marcas = Array.isArray(foto.marcas) ? foto.marcas : [];
      const enMarca = marcando.has(key);
      cuerpo = '<div class="ibr-ed-foto' + (enMarca ? ' ibr-ed-foto--marcando' : '') + '" data-foto="' + esc(key) + '" data-marcas-ruta="' + esc(r + '.marcas') + '">'
        + '<img data-archivo="' + esc(foto.archivo) + '" alt="' + esc(etiqueta) + '" decoding="async">'
        + ovalosSvg(marcas) + '</div>'
        + (ed ? '<div class="ibr-hueco-botones">'
          + '<label class="ibr-btn ibr-btn--chico">Cambiar<input class="ibr-sr" type="file" accept="image/*" data-subir-foto="' + destino + '" aria-label="Cambiar la foto: ' + esc(etiqueta) + '"></label>'
          + '<button type="button" class="ibr-btn ibr-btn--chico" data-foto-accion="quitar" data-destino="' + destino + '">Quitar</button>'
          + '<button type="button" class="ibr-btn ibr-btn--chico' + (enMarca ? ' is-activo' : '') + '" data-foto-accion="marcar" data-destino="' + destino + '" aria-pressed="' + (enMarca ? 'true' : 'false') + '">⭕ Marcar</button>'
          + '</div>' : '')
        + (enMarca ? '<p class="ibr-ayuda">Arrastre sobre la foto para dibujar un óvalo rojo.</p>' : '')
        + (marcas.length ? '<ul class="ibr-marcas">' + marcas.map((_, i) => '<li>Óvalo ' + (i + 1)
          + (ed ? ' <button type="button" class="ibr-enlace" data-foto-accion="quitar-marca" data-destino="' + destino + '" data-m="' + i + '">Quitar</button>' : '') + '</li>').join('') + '</ul>' : '');
    } else {
      cuerpo = ed
        ? '<label class="ibr-subir">＋ Foto<input class="ibr-sr" type="file" accept="image/*" data-subir-foto="' + destino + '" aria-label="Cargar foto: ' + esc(etiqueta) + '"></label>'
        : '<div class="ibr-subir ibr-subir--vacio">Sin foto</div>';
    }
    return '<div class="ibr-hueco' + (falta ? ' ibr-hueco--falta' : '') + '" data-hueco-ruta="' + esc(r + '.archivo') + '">'
      + cuerpo + '<div data-progreso="' + esc(key) + '">' + progresoHtml(key) + '</div></div>';
  }

  function figurasHtml(c) {
    const clave = c.clave;
    const contenido = api.obtener();
    const lista = (contenido.figuras && contenido.figuras[clave]) || [];
    const numeros = F.numeracionFiguras(contenido);
    const ed = api.editable();
    const opcionesDisp = (sel) => Object.entries(F.FORMA_DISPOSICION).map(([k, d]) => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(d.nombre) + '</option>').join('');
    const cuadros = lista.map((g, gi) => {
      const figs = g.figuras || [];
      const nros = figs.map((f) => numeros.get(f.id)).filter((n) => n != null);
      const rango = nros.length ? (nros.length > 1 ? 'Figuras ' + nros[0] + ' y ' + nros[nros.length - 1] : 'Figura ' + nros[0]) : 'Figura';
      const cab = '<div class="ibr-ed-cuad-cab"><b>' + esc(rango) + '</b>'
        + (ed ? '<select class="ibr-select ibr-select--chico" data-disp="' + esc(clave + '|' + gi) + '" aria-label="Disposición de ' + esc(rango) + '">' + opcionesDisp(g.disposicion) + '</select>'
          + '<button type="button" class="ibr-btn ibr-btn--icono" data-fig-accion="subir" data-clave="' + esc(clave) + '" data-g="' + gi + '" aria-label="Subir"' + (gi === 0 ? ' disabled' : '') + '>↑</button>'
          + '<button type="button" class="ibr-btn ibr-btn--icono" data-fig-accion="bajar" data-clave="' + esc(clave) + '" data-g="' + gi + '" aria-label="Bajar"' + (gi === lista.length - 1 ? ' disabled' : '') + '>↓</button>'
          + '<button type="button" class="ibr-btn ibr-btn--chico" data-fig-accion="quitar" data-clave="' + esc(clave) + '" data-g="' + gi + '">Quitar</button>'
          : '<span class="ibr-tenue">' + esc((F.FORMA_DISPOSICION[g.disposicion] || {}).nombre || g.disposicion) + '</span>')
        + '</div>';
      const cuerpo = figs.map((fig, fi) => {
        const nro = numeros.get(fig.id);
        const rPie = 'figuras.' + clave + '.' + gi + '.figuras.' + fi + '.pie';
        const huecos = (fig.fotos || []).map((_, k) => huecoHtml(clave, gi, fi, k, fig, nro)).join('');
        return '<div class="ibr-fig">'
          + '<div class="ibr-fig-fotos ibr-fig-fotos--' + (fig.fotos || []).length + '">' + huecos + '</div>'
          + '<div class="ibr-campo' + (api.bloqueantes().has(rPie) ? ' ibr-campo--falta' : '') + '" data-campo="' + esc(rPie) + '">'
          + '<div class="ibr-campo-cab"><label class="ibr-campo-et" for="ibr-pie-' + esc(fig.id) + '">Figura ' + esc(nro) + ' · pie</label>'
          + '<span class="ibr-origen-caja" data-chip="' + esc(rPie) + '">' + api.chipOrigen(rPie) + '</span></div>'
          + '<input class="ibr-input" type="text" autocomplete="off" id="ibr-pie-' + esc(fig.id) + '" data-ruta="' + esc(rPie) + '" value="' + esc(fig.pie || '') + '"' + (ed ? '' : ' disabled') + '>'
          + '<div data-msgs="' + esc(rPie) + '">' + api.mensajes(rPie) + '</div></div>'
          + '</div>';
      }).join('');
      return '<div class="ibr-ed-cuad" data-campo="' + esc('figuras.' + clave + '.' + gi) + '">' + cab
        + '<div class="ibr-ed-cuad-figs ibr-ed-cuad--' + esc(g.disposicion) + '">' + cuerpo + '</div></div>';
    }).join('');
    return '<div class="ibr-campo ibr-figs" data-campo="' + esc(c.ruta) + '">'
      + '<div class="ibr-campo-cab"><span class="ibr-campo-et">' + esc(c.etiqueta) + '</span></div>'
      + (cuadros || '<p class="ibr-tenue">Sin figuras en esta sección.</p>')
      + (ed ? '<div class="ibr-tabla-pie"><select class="ibr-select ibr-select--chico" data-nueva-disp="' + esc(clave) + '" aria-label="Disposición de la cuadrícula nueva">' + opcionesDisp('2x1') + '</select> '
        + '<button type="button" class="ibr-btn ibr-btn--chico" data-fig-accion="agregar" data-clave="' + esc(clave) + '">＋ Agregar cuadrícula</button></div>' : '')
      + '</div>';
  }

  /* ── anexos ── */

  function tituloAnexo(a, vars) {
    if (a.titulo) return String(a.titulo);
    const t = (P.ANEXO_TITULOS || {})[a.clave] || (P.ANEXO_TITULOS || {}).ficha_extra || { titulo: '' };
    try { return P.rellenar(t.titulo, vars); } catch (_) { return t.titulo || ''; }
  }

  function calculoHtml(contenido) {
    const ve = contenido.ventiladores || {};
    const tabla = (titulo, filas, conMarca) => {
      const lista = Array.isArray(filas) ? filas : [];
      const t = F.totalesVentiladores(lista);
      return '<table class="ibr-tabla-ed ibr-tabla-calc"><caption>' + esc(titulo) + '</caption><thead><tr>'
        + '<th scope="col">' + (conMarca ? 'MODELO' : 'TIPO / MODELO') + '</th><th scope="col">CANTIDAD</th><th scope="col">CFM POR UNIDAD</th><th scope="col">CFM TOTAL</th></tr></thead><tbody>'
        + lista.map((f) => {
          const n = f.cantidad; const u = f.cfm_unitario;
          const tot = n != null && u != null ? F.numeroEnCasilla(Number(n) * Number(u)) : '—';
          const nombre = conMarca ? [f.marca, f.modelo].filter(Boolean).join(' ') : f.modelo;
          return '<tr><td>' + esc(nombre || '—') + '</td><td>' + esc(F.numeroEnCasilla(n) || '—') + '</td><td>' + esc(F.numeroEnCasilla(u) || '—') + '</td><td>' + esc(tot) + '</td></tr>';
        }).join('')
        + (lista.length > 1 ? '<tr class="ibr-fila-total"><td>TOTAL</td><td>' + esc(F.numeroEnCasilla(t.cantidad)) + '</td><td></td><td>' + esc(F.numeroEnCasilla(t.cfm)) + '</td></tr>' : '')
        + '</tbody></table>';
    };
    return '<p class="ibr-ayuda">Sale solo de las tablas de ventiladores de «4.3 Montaje»: aquí no se escribe nada (sin cálculo de aire requerido ni gráfica).</p>'
      + tabla('ACTUAL', ve.actual, false) + tabla('PROYECTADO', ve.nuevo, true)
      + '<button type="button" class="ibr-btn ibr-btn--chico" data-ir-seccion="s4_3" data-ir-ruta="ventiladores">Ir a las tablas de ventiladores</button>';
  }

  function anexosHtml(c) {
    const contenido = api.obtener();
    const anexos = Array.isArray(contenido.anexos) ? contenido.anexos : [];
    const ed = api.editable();
    let vars = {};
    try { vars = M.variablesDelInforme(contenido) || {}; } catch (_) { vars = {}; }
    const bloques = anexos.map((a, i) => {
      const base = 'anexos.' + i;
      const titulo = tituloAnexo(a, vars);
      const extra = /^ficha_\d+$/.test(a.clave);
      let cuerpo = '';
      if (a.tipo === 'imagen') {
        const key = 'anexo:' + a.clave;
        cuerpo = '<div class="ibr-hueco ibr-hueco--anexo' + (api.bloqueantes().has(base + '.archivo') ? ' ibr-hueco--falta' : '') + '" data-hueco-ruta="' + esc(base + '.archivo') + '">'
          + (a.archivo
            ? '<div class="ibr-ed-foto ibr-ed-foto--anexo"><img data-archivo="' + esc(a.archivo) + '" alt="' + esc(titulo) + '" decoding="async"></div>'
              + (ed ? '<div class="ibr-hueco-botones"><label class="ibr-btn ibr-btn--chico">Cambiar<input class="ibr-sr" type="file" accept="image/*" data-subir-anexo="' + esc(a.clave) + '" aria-label="Cambiar la imagen del anexo"></label>'
                + '<button type="button" class="ibr-btn ibr-btn--chico" data-anexo-accion="quitar-archivo" data-i="' + i + '">Quitar</button></div>' : '')
            : (ed ? '<label class="ibr-subir">＋ Pantallazo de la consignación<input class="ibr-sr" type="file" accept="image/*" data-subir-anexo="' + esc(a.clave) + '" aria-label="Cargar el pantallazo de la consignación"></label>' : '<div class="ibr-subir ibr-subir--vacio">Sin imagen</div>'))
          + '<div data-progreso="' + esc(key) + '">' + progresoHtml(key) + '</div></div>';
      } else if (a.tipo === 'ficha') {
        cuerpo = '<div class="ibr-hueco ibr-hueco--anexo' + (api.bloqueantes().has(base + '.ficha') ? ' ibr-hueco--falta' : '') + '" data-hueco-ruta="' + esc(base + '.ficha') + '">'
          + (a.ficha
            ? '<div class="ibr-ed-foto ibr-ed-foto--anexo"><img data-ficha-clave="' + esc(a.clave) + '" alt="' + esc(a.ficha.titulo || titulo) + '" decoding="async"></div>'
              + '<p class="ibr-mini">De la biblioteca: <b>' + esc(a.ficha.titulo || '') + '</b></p>'
            : '<p class="ibr-tenue">Sin ficha escogida.</p>')
          + (ed ? '<div class="ibr-hueco-botones"><button type="button" class="ibr-btn ibr-btn--chico" data-anexo-accion="biblioteca" data-i="' + i + '">' + (a.ficha ? 'Cambiar ficha' : 'Escoger de la biblioteca') + '</button>'
            + (a.ficha ? '<button type="button" class="ibr-btn ibr-btn--chico" data-anexo-accion="quitar-ficha" data-i="' + i + '">Quitar</button>' : '')
            + (extra ? '<button type="button" class="ibr-btn ibr-btn--chico ibr-btn--peligro" data-anexo-accion="quitar-anexo" data-i="' + i + '">Quitar este anexo</button>' : '')
            + '</div>' : '')
          + '</div>';
      } else if (a.tipo === 'calculo') {
        cuerpo = calculoHtml(contenido);
      }
      const tituloEditable = a.tipo !== 'calculo' && ed
        ? '<label class="ibr-campo-et ibr-anexo-titulo">Título <input class="ibr-input" type="text" data-anexo-titulo="' + i + '" placeholder="' + esc(titulo) + '" value="' + esc(a.titulo || '') + '"></label>'
        : '';
      return '<div class="ibr-anexo" data-campo="' + esc(base) + '">'
        + '<div class="ibr-campo-cab"><span class="ibr-campo-et">Anexo ' + (i + 1) + ' · ' + esc(titulo) + '</span>'
        + (a.titulo ? '<span class="ibr-origen ibr-origen--manual">Título escrito a mano</span>' : '<span class="ibr-origen ibr-origen--plantilla">Título de la plantilla</span>') + '</div>'
        + tituloEditable + cuerpo
        + '<div data-msgs="' + esc(base) + '">' + api.mensajes(base + '.archivo') + api.mensajes(base + '.ficha') + '</div>'
        + '</div>';
    }).join('');
    return '<div class="ibr-campo" data-campo="anexos">' + bloques
      + (ed ? '<div class="ibr-tabla-pie"><button type="button" class="ibr-btn ibr-btn--chico" data-anexo-accion="agregar-ficha">＋ Agregar otra ficha técnica (mezcla de modelos)</button></div>' : '')
      + '</div>';
  }

  /* ── subida ── */

  async function subir(destino, archivo) {
    const key = claveDe(destino);
    if (!archivo) return;
    estados.set(key, { fase: 'reduciendo', archivo, destino });
    pintarProgreso(key);
    try {
      const IM = await dep.cargar('imagenes');
      const prep = destino.tipo === 'anexo' ? await IM.prepararImagenAnexo(archivo) : await IM.prepararFoto(archivo);
      if (!vivo) return;
      estados.set(key, { fase: 'subiendo', pct: 0, archivo, destino });
      pintarProgreso(key);
      const archivoId = dep.rutas.nuevoIdArchivo();
      const meta = await ctx.almacen.subirArchivo(api.informeId(), archivoId, prep.blob,
        { mime: prep.mime, ancho: prep.ancho, alto: prep.alto, tamano: prep.tamano, huella: prep.huella }, ctx.autor(),
        { alProgreso: (p) => { const e = estados.get(key); if (e && e.fase === 'subiendo') { e.pct = p; pintarProgreso(key); } } });
      try { locales.set(archivoId, URL.createObjectURL(prep.blob)); } catch (_) { /* sin miniatura local: se lee del almacén */ }
      estados.delete(key);
      if (!vivo) return;
      api.cambiar((c) => {
        const c2 = M.registrarArchivo(c, archivoId, meta);
        if (destino.tipo === 'anexo') {
          const i = (c2.anexos || []).findIndex((a) => a.clave === destino.clave);
          return i < 0 ? c2 : M.cambiarCampo(c2, 'anexos.' + i + '.archivo', archivoId);
        }
        const pos = buscarHueco(c2, destino.clave, destino.figId, destino.k);
        return pos ? M.ponerFoto(c2, pos, archivoId) : c2;
      }, { guardarYa: true, repintar: 'todo' });
      const avisos = (prep.avisos || []).filter(Boolean);
      if (avisos.length) ctx.avisar(avisos.join(' '), 'aviso');
    } catch (err) {
      console.warn('[informe-brigada] foto:', err);
      if (!vivo) return;
      estados.set(key, { fase: 'error', msg: 'No se pudo cargar: ' + ((err && err.message) || err), archivo, destino });
      pintarProgreso(key);
    }
  }

  function pintarProgreso(key) {
    const el = document.querySelector('[data-progreso="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
    if (el) el.innerHTML = progresoHtml(key);
  }

  /* ── biblioteca de fichas ── */

  async function abrirBiblioteca(i) {
    const contenido = api.obtener();
    const anexo = (contenido.anexos || [])[i];
    if (!anexo) return;
    const v = crearVentana({ titulo: 'Biblioteca de fichas técnicas', subtitulo: 'Para el anexo ' + (i + 1) + '. Las fichas se suben una vez y sirven para todos los informes.', ancho: 'ancha' });
    v.cuerpo.innerHTML = '<div data-b="lista"><p class="ibr-nota">Leyendo la biblioteca…</p></div>'
      + '<details class="ibr-ficha-nueva"><summary>Subir una ficha nueva a la biblioteca</summary>'
      + '<div class="ibr-ficha-form">'
      + '<label class="ibr-campo"><span class="ibr-campo-et">Marca</span><input class="ibr-input" type="text" data-b="marca" autocomplete="off"></label>'
      + '<label class="ibr-campo"><span class="ibr-campo-et">Modelo</span><input class="ibr-input" type="text" data-b="modelo" autocomplete="off"></label>'
      + '<label class="ibr-campo"><span class="ibr-campo-et">Título</span><input class="ibr-input" type="text" data-b="titulo" maxlength="120" placeholder="FICHA TÉCNICA VENTILADOR …"></label>'
      + '<label class="ibr-campo"><span class="ibr-campo-et">Imagen de la ficha (JPG o PNG)</span><input class="ibr-input" type="file" accept="image/*" data-b="archivo"></label>'
      + '<p class="ibr-ayuda">Si la ficha está en PDF, tómele un pantallazo de la página.</p>'
      + '<button type="button" class="ibr-btn ibr-btn--primario" data-b="subir">Subir y usar en este anexo</button>'
      + '<p data-b="estado" class="ibr-ayuda" role="status"></p>'
      + '</div></details>';
    v.pie.innerHTML = '<button type="button" class="ibr-btn" data-b="cerrar">Cerrar</button>';
    const $ = (s) => v.el.querySelector('[data-b="' + s + '"]');
    $('cerrar').addEventListener('click', () => v.cerrar());
    v.atrapar('[data-b="cerrar"]');

    let fichas = [];
    const usar = (f) => {
      const meta = { id: f.id, titulo: f.titulo, almacen: f.almacen, ruta: f.ruta, mime: f.mime, ancho: Number(f.ancho) || 0, alto: Number(f.alto) || 0, huella: f.huella };
      const idx = (api.obtener().anexos || []).findIndex((a) => a.clave === anexo.clave);
      if (idx < 0) return;
      api.cambiar((c) => M.cambiarCampo(c, 'anexos.' + idx + '.ficha', meta), { repintar: 'todo' });
      v.cerrar();
    };
    try {
      fichas = await ctx.repo.listarFichas({ limite: 100 });
      const lista = $('lista');
      if (!fichas.length) lista.innerHTML = '<p class="ibr-tenue">La biblioteca está vacía: suba la primera ficha abajo.</p>';
      else {
        lista.innerHTML = '<ul class="ibr-biblioteca">' + fichas.map((f, k) => '<li><img data-b-img="' + k + '" alt="" decoding="async">'
          + '<div><b>' + esc(f.titulo) + '</b><div class="ibr-mini">' + esc([f.marca, f.modelo].filter(Boolean).join(' · ')) + '</div></div>'
          + '<button type="button" class="ibr-btn ibr-btn--chico" data-b-usar="' + k + '">Usar</button></li>').join('') + '</ul>';
        lista.querySelectorAll('img[data-b-img]').forEach((img) => {
          const f = fichas[Number(img.getAttribute('data-b-img'))];
          try {
            dep.almacen.crearAlmacen({ modo: f.almacen }).url(f).then((u) => { if (u) img.src = u; }).catch(() => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'ibr-tenue', textContent: 'sin vista' })); });
          } catch (_) { /* almacén desconocido: sin vista */ }
        });
      }
    } catch (err) {
      $('lista').innerHTML = '<p class="ibr-nota ibr-nota--error">No se pudo leer la biblioteca: ' + esc((err && err.message) || err) + '</p>';
    }
    v.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-b-usar]');
      if (b) usar(fichas[Number(b.getAttribute('data-b-usar'))]);
    });

    let subiendo = false;
    $('subir').addEventListener('click', async (ev) => {
      if (subiendo || ev.detail > 1) return;
      const marca = $('marca').value.trim();
      const modelo = $('modelo').value.trim();
      const titulo = ($('titulo').value.trim() || ('FICHA TÉCNICA VENTILADOR ' + [marca, modelo].filter(Boolean).join(' ')).trim()).toLocaleUpperCase('es-CO');
      const archivo = $('archivo').files && $('archivo').files[0];
      const estado = $('estado');
      if (!modelo) { estado.textContent = 'Escriba al menos el modelo.'; return; }
      if (!archivo) { estado.textContent = 'Escoja la imagen de la ficha.'; return; }
      subiendo = true;
      $('subir').disabled = true;
      try {
        estado.textContent = 'Preparando la imagen…';
        const IM = await dep.cargar('imagenes');
        const prep = await IM.prepararFicha(archivo);
        const fichaId = dep.rutas.idFicha(marca, modelo, prep.huella);
        estado.textContent = 'Subiendo…';
        const meta = await ctx.almacen.subirFicha(fichaId, prep.blob, { mime: prep.mime, ancho: prep.ancho, alto: prep.alto, tamano: prep.tamano, huella: prep.huella }, ctx.autor());
        await ctx.repo.registrarFicha({ id: fichaId, titulo, marca, modelo, ...meta });
        usar({ id: fichaId, titulo, ...meta });
      } catch (err) {
        estado.textContent = 'No se pudo subir: ' + ((err && err.message) || err);
        $('subir').disabled = false;
        subiendo = false;
      }
    });
  }

  /* ── óvalos (arrastre) ── */

  function alApuntar(ev) {
    const zona = ev.target.closest && ev.target.closest('.ibr-ed-foto--marcando');
    if (!zona || !api.editable() || ev.button > 0) return;
    ev.preventDefault();
    const rect = zona.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const fx = (x) => Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    const fy = (y) => Math.min(1, Math.max(0, (y - rect.top) / rect.height));
    const x0 = fx(ev.clientX); const y0 = fy(ev.clientY);
    const svg = zona.querySelector('svg');
    const temp = document.createElementNS(SVGNS, 'ellipse');
    temp.setAttribute('class', 'ibr-ovalo-temp');
    if (svg) svg.appendChild(temp);
    let caja = { x: x0, y: y0, w: 0, h: 0 };
    const mover = (e) => {
      const x1 = fx(e.clientX); const y1 = fy(e.clientY);
      caja = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      temp.setAttribute('cx', String((caja.x + caja.w / 2) * 100));
      temp.setAttribute('cy', String((caja.y + caja.h / 2) * 100));
      temp.setAttribute('rx', String(caja.w * 50));
      temp.setAttribute('ry', String(caja.h * 50));
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      temp.remove();
      if (caja.w < MINIMO_OVALO || caja.h < MINIMO_OVALO) return;
      const r4 = (n) => Math.round(n * 10000) / 10000;
      const marca = { x: r4(caja.x), y: r4(caja.y), w: r4(caja.w), h: r4(caja.h) };
      const rutaMarcas = zona.getAttribute('data-marcas-ruta');
      api.cambiar((c) => M.cambiarCampo(c, rutaMarcas, (F.valorEnRuta(c, rutaMarcas) || []).concat([marca])), { repintar: 'todo' });
    };
    // Solo mientras se arrastra (CLAUDE.md §3.5): se quitan al soltar.
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  }

  /* ── API para el editor ── */
  return {
    figurasHtml,
    anexosHtml,

    /** Fotos que se están reduciendo o subiendo (si se sale ahora, no quedan en el informe). */
    pendientes() {
      let n = 0;
      for (const e of estados.values()) if (e && (e.fase === 'reduciendo' || e.fase === 'subiendo')) n += 1;
      return n;
    },

    alPintar(raiz) {
      if (raizConPuntero !== raiz) {
        raiz.addEventListener('pointerdown', alApuntar);
        raizConPuntero = raiz;
      }
      raiz.querySelectorAll('img[data-archivo]').forEach((img) => {
        const id = img.getAttribute('data-archivo');
        urlArchivo(id).then((u) => {
          if (u) { img.src = u; return; }
          const s = document.createElement('span');
          s.className = 'ibr-ed-foto-falla';
          s.textContent = textoNoDisponible();
          img.replaceWith(s);
        });
      });
      raiz.querySelectorAll('img[data-ficha-clave]').forEach((img) => {
        urlRef('ficha:' + img.getAttribute('data-ficha-clave')).then((u) => {
          if (u) img.src = u;
          else img.replaceWith(Object.assign(document.createElement('span'), { className: 'ibr-ed-foto-falla', textContent: 'No se pudo leer la ficha del almacenamiento.' }));
        });
      });
    },

    alRefrescar() { /* las fotos y los óvalos se redibujan con la sección (cambios de estructura) */ },

    alCambiar(ev) {
      const el = ev.target;
      if (el.matches('[data-subir-foto]')) {
        const [clave, figId, k] = el.getAttribute('data-subir-foto').split('|');
        const archivo = el.files && el.files[0];
        el.value = '';
        if (archivo) subir({ tipo: 'foto', clave, figId, k: Number(k) }, archivo);
        return true;
      }
      if (el.matches('[data-subir-anexo]')) {
        const archivo = el.files && el.files[0];
        el.value = '';
        if (archivo) subir({ tipo: 'anexo', clave: el.getAttribute('data-subir-anexo') }, archivo);
        return true;
      }
      if (el.matches('[data-disp]')) {
        const [clave, g] = el.getAttribute('data-disp').split('|');
        const disp = el.value;
        const c = api.obtener();
        const cuad = ((c.figuras && c.figuras[clave]) || [])[Number(g)];
        if (!cuad || cuad.disposicion === disp) return true;
        const { cuadricula, sobrantes } = F.reestructurarCuadricula(cuad, disp, F.idsUsados(c));
        const aplicar = () => api.cambiar((x) => M.cambiarCampo(x, 'figuras.' + clave + '.' + g, cuadricula), { repintar: 'todo' });
        if (!sobrantes.length) { aplicar(); return true; }
        confirmar({ titulo: 'Cambiar la disposición', esc, boton: 'Cambiar', peligro: true,
          texto: 'Con esa disposición no caben ' + sobrantes.length + (sobrantes.length === 1 ? ' foto: sale' : ' fotos: salen') + ' de la cuadrícula (siguen guardadas con el informe).' })
          .then((ok) => { if (ok) aplicar(); else el.value = cuad.disposicion; });
        return true;
      }
      if (el.matches('[data-anexo-titulo]')) {
        const i = Number(el.getAttribute('data-anexo-titulo'));
        const t = el.value.replace(/\s+/g, ' ').trim();
        api.cambiar((c) => M.cambiarCampo(c, 'anexos.' + i + '.titulo', t ? t.toLocaleUpperCase('es-CO') : null), { repintar: 'todo' });
        return true;
      }
      if (el.matches('[data-nueva-disp]')) return true;
      return false;
    },

    alClic(ev) {
      const fa = ev.target.closest('[data-foto-accion]');
      if (fa && !fa.disabled) {
        const a = fa.getAttribute('data-foto-accion');
        if (a === 'reintentar') {
          const e = estados.get(fa.getAttribute('data-estado'));
          if (e && e.archivo && e.destino) subir(e.destino, e.archivo);
          return true;
        }
        const [clave, figId, k] = (fa.getAttribute('data-destino') || '').split('|');
        const pos = buscarHueco(api.obtener(), clave, figId, Number(k));
        if (!pos) return true;
        const key = figId + ':' + k;
        if (a === 'quitar') { marcando.delete(key); api.cambiar((c) => M.ponerFoto(c, pos, null), { repintar: 'todo' }); }
        else if (a === 'marcar') { if (marcando.has(key)) marcando.delete(key); else marcando.add(key); api.repintar(); }
        else if (a === 'quitar-marca') {
          const m = Number(fa.getAttribute('data-m'));
          const r = ruta(pos.seccion, pos.g, pos.f, pos.k) + '.marcas';
          api.cambiar((c) => M.cambiarCampo(c, r, (F.valorEnRuta(c, r) || []).filter((_, j) => j !== m)), { repintar: 'todo' });
        }
        return true;
      }
      const fg = ev.target.closest('[data-fig-accion]');
      if (fg && !fg.disabled) {
        const a = fg.getAttribute('data-fig-accion');
        const clave = fg.getAttribute('data-clave');
        const g = Number(fg.getAttribute('data-g'));
        if (a === 'agregar') {
          const sel = fg.parentElement && fg.parentElement.querySelector('[data-nueva-disp]');
          api.cambiar((c) => M.agregarCuadricula(c, clave, sel ? sel.value : '2x1'), { repintar: 'todo' });
        } else if (a === 'quitar') {
          const cuad = ((api.obtener().figuras || {})[clave] || [])[g];
          const conFotos = cuad && (cuad.figuras || []).some((f) => (f.fotos || []).some((x) => x && x.archivo));
          const quitar = () => api.cambiar((c) => M.quitarCuadricula(c, clave, g), { repintar: 'todo' });
          if (!conFotos) { quitar(); return true; }
          confirmar({ titulo: 'Quitar la cuadrícula', esc, boton: 'Quitar', peligro: true, texto: 'La cuadrícula tiene fotos. Al quitarla salen del papel (siguen guardadas con el informe).' })
            .then((ok) => { if (ok) quitar(); });
        } else if (a === 'subir' || a === 'bajar') {
          api.cambiar((c) => M.moverCuadricula(c, clave, g, a === 'subir' ? -1 : 1), { repintar: 'todo' });
        }
        return true;
      }
      const an = ev.target.closest('[data-anexo-accion]');
      if (an && !an.disabled) {
        const a = an.getAttribute('data-anexo-accion');
        const i = Number(an.getAttribute('data-i'));
        if (a === 'agregar-ficha') api.cambiar((c) => M.agregarAnexoFicha(c), { repintar: 'todo' });
        else if (a === 'biblioteca') abrirBiblioteca(i);
        else if (a === 'quitar-archivo') api.cambiar((c) => M.cambiarCampo(c, 'anexos.' + i + '.archivo', null), { repintar: 'todo' });
        else if (a === 'quitar-ficha') api.cambiar((c) => M.cambiarCampo(c, 'anexos.' + i + '.ficha', null), { repintar: 'todo' });
        else if (a === 'quitar-anexo') {
          confirmar({ titulo: 'Quitar el anexo ' + (i + 1), esc, boton: 'Quitar', peligro: true, texto: '¿Quitar este anexo de ficha técnica?' })
            .then((ok) => { if (ok) api.cambiar((c) => M.cambiarCampo(c, 'anexos', (c.anexos || []).filter((_, j) => j !== i)), { repintar: 'todo' }); });
        }
        return true;
      }
      return false;
    },

    destruir() {
      vivo = false;
      if (raizConPuntero) raizConPuntero.removeEventListener('pointerdown', alApuntar);
      for (const u of locales.values()) { try { URL.revokeObjectURL(u); } catch (_) { /* ya liberada */ } }
      locales.clear();
      urls.clear();
    }
  };
}
