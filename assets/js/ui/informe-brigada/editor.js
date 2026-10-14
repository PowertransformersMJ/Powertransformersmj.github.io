// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · EDITOR por secciones
// ──────────────────────────────────────────────────────────────
// Dos pestañas: «Armar» (formulario por secciones del F60) y «Ver hojas»
// (el MISMO dibujo que se imprime y se exporta a Word, `vista.js`).
//   · Cada campo dice de dónde llegó (Inventario, Salud de Activos, Acción de
//     refrigeración, Configuración, Plantilla, Fijo, Escrito a mano) y si se
//     cambió lo que llegó lleno («✎ Cambiado · era: X» con «Volver al original»).
//   · La lista de faltantes va arriba (rojo = impide emitir; ámbar = aviso) y
//     cada uno lleva a su sección y a su campo.
//   · Guardado automático 3 s después del último cambio (solo editores y solo
//     en borrador). Si otra persona guardó antes (rev distinto), se detiene, se
//     respalda lo de esta pantalla en el navegador y se avisa: nunca se pisa en
//     silencio.
//   · Emitir congela una versión (huella SHA-256); las firmas de terceros se
//     estampan SOLO al emitir (decisión 4).
// La lógica del contenido es del dominio (`domain/informe_brigada_modelo.js`);
// aquí solo hay pantalla.
// ══════════════════════════════════════════════════════════════

import { crearVentana, pedirTexto, confirmar } from './selector.js';
import { crearEditorFotos } from './editor-fotos.js';
import { montarVista } from './vista.js';

const ESPERA_GUARDADO = 3000;
const ESPERA_REINTENTO = 15000;

/**
 * @param {HTMLElement} cont
 * @param {{ ctx, informe: object, alVolver: () => void }} o
 * @returns {{ destruir: () => void }}
 */
export function montarEditor(contenedor, { ctx, informe, alVolver }) {
  // Raíz PROPIA de este editor: al cerrarlo se va con sus oyentes. (Si los oyentes
  // colgaran del contenedor compartido, el editor anterior seguiría oyendo y pintando
  // encima del siguiente informe que se abra.)
  contenedor.textContent = '';
  const cont = document.createElement('div');
  contenedor.appendChild(cont);
  const dep = ctx.dep;
  const M = dep.modelo;
  const P = dep.plantilla;
  const F = dep.formulario;
  const fmt = dep.formato;
  const L = dep.listado;
  const esc = F.escaparHtml;

  const st = {
    id: informe.id,
    doc: { ...informe },
    contenido: informe.contenido,
    rev: Number(informe.rev) || 1,
    base: informe.contenido,          // lo último que esta pantalla leyó o guardó en la plataforma (para fusionar un respaldo)
    revBase: Number(informe.rev) || 1,
    detenido: false,                  // el guardado automático se detuvo por un error que reintentar no arregla
    escribiendo: false,               // hay texto tecleado que todavía no pasó al informe (se pasa al salir del campo)
    seccion: F.IDS_SECCION[0],
    pestana: 'armar',
    sucio: false,
    guardando: false,
    otraVez: false,
    choque: false,
    sinRed: false,
    ultimo: informe.actualizadoEn || null,
    editandoTexto: new Set(),
    acciones: null,          // acciones de refrigeración del equipo (solo lectura), al pedirlas
    accionesPedidas: false,
    versionVista: null,      // versión emitida que se está viendo en «Ver hojas»
    vivo: true
  };
  let faltantesActuales = [];
  let bloqueantes = new Set();
  let temporizador = null;
  let reloj = null;

  const editable = () => ctx.puedeEditar && st.doc.estado === 'borrador' && !st.choque;
  const matricula = () => (st.contenido && st.contenido.equipo && st.contenido.equipo.matricula) || (st.doc.equipo_ref && st.doc.equipo_ref.matricula) || '';

  /* ── armazón ─────────────────────────────────────────────── */
  cont.innerHTML = ''
    + '<div class="ibr-editor">'
    +   '<div class="ibr-ed-cab">'
    +     '<button type="button" class="ibr-btn" data-e="volver">← Volver al parque</button>'
    +     '<div class="ibr-ed-titulo" data-e="titulo"></div>'
    +     '<div class="ibr-ed-guardado" data-e="guardado" role="status" aria-live="polite"></div>'
    +   '</div>'
    +   '<div class="ibr-ed-acciones" data-e="acciones"></div>'
    +   '<div data-e="bandas"></div>'
    +   '<div class="tab-bar ibr-pestanas" role="tablist" aria-label="Informe">'
    +     '<button type="button" role="tab" id="ibrTabArmar" aria-controls="ibrPanelArmar" aria-selected="true" class="is-active" data-pestana="armar">Armar</button>'
    +     '<button type="button" role="tab" id="ibrTabHojas" aria-controls="ibrPanelHojas" aria-selected="false" data-pestana="hojas">Ver hojas</button>'
    +   '</div>'
    +   '<div role="tabpanel" id="ibrPanelArmar" aria-labelledby="ibrTabArmar" data-e="panel-armar">'
    +     '<div class="ibr-faltantes" data-e="faltantes"></div>'
    +     '<div class="ibr-ed-cuerpo">'
    +       '<nav class="ibr-ed-nav" data-e="nav" aria-label="Secciones del informe"></nav>'
    +       '<div class="ibr-ed-seccion" data-e="seccion"></div>'
    +     '</div>'
    +   '</div>'
    +   '<div role="tabpanel" id="ibrPanelHojas" aria-labelledby="ibrTabHojas" data-e="panel-hojas" hidden></div>'
    + '</div>';
  const $ = (s) => cont.querySelector('[data-e="' + s + '"]');
  const secEl = $('seccion');

  /* ── cambios del contenido ───────────────────────────────── */

  /** Aplica un contenido nuevo (o una función que lo produce desde el actual) y programa el guardado. */
  function cambiar(nuevo, { guardarYa = false, repintar = 'auto' } = {}) {
    if (!editable()) { ctx.avisar('Este informe no se puede modificar ahora.', 'aviso'); return false; }
    const antes = firmaEstructura();
    const c = typeof nuevo === 'function' ? nuevo(st.contenido) : nuevo;
    if (!c || c === st.contenido) return false;
    // El dominio siempre devuelve una copia: si el contenido quedó igual, no hay nada que guardar.
    try { if (M.jsonCanonico(c) === M.jsonCanonico(st.contenido)) { refrescarSeccion(); return false; } } catch (_) { /* se guarda igual */ }
    st.contenido = c;
    st.sucio = true;
    st.detenido = false;
    st.escribiendo = false;
    recalcular();
    if (repintar === 'todo' || (repintar === 'auto' && firmaEstructura() !== antes)) pintarSeccion();
    else refrescarSeccion();
    pintarFaltantes();
    pintarNav();
    pintarAcciones();
    programarGuardado(guardarYa ? 0 : ESPERA_GUARDADO);
    return true;
  }

  function recalcular() {
    // Modo local: las imágenes viven en la memoria de la pestaña. Si se perdieron al recargar, faltan.
    const disp = ctx.modo === 'local' && ctx.almacen && typeof ctx.almacen.tiene === 'function' ? (meta) => ctx.almacen.tiene(meta) : null;
    try { faltantesActuales = M.faltantes(st.contenido, { config: ctx.config, archivoDisponible: disp }) || []; }
    catch (err) { console.error('[informe-brigada] faltantes:', err); faltantesActuales = []; }
    bloqueantes = new Set(faltantesActuales.filter((f) => f.bloquea).map((f) => f.ruta));
  }

  /** Huella de la ESTRUCTURA de la sección abierta (filas, cuadrículas, anexos): si cambia, se redibuja entera. */
  function firmaEstructura() {
    const s = F.SECCIONES.find((x) => x.id === st.seccion);
    if (!s) return '';
    return s.campos.map((c) => {
      const v = F.valorEnRuta(st.contenido, c.ruta);
      if (c.tipo === 'figuras') return (v || []).map((g) => g.disposicion + ':' + (g.figuras || []).map((f) => (f.fotos || []).map((x) => (x.archivo ? 1 : 0) + '.' + ((x.marcas || []).length)).join(',')).join('|')).join(';');
      if (c.tipo === 'anexos') return (v || []).map((a) => a.clave + ':' + (a.archivo || '') + ':' + ((a.ficha && a.ficha.id) || '')).join(';');
      if (c.tipo === 'firmante') return (v && v.firmante) || '';
      if (Array.isArray(v)) return c.tipo + v.length + (c.tipo === 'tabla' ? v.map((r) => (r && r.auto ? 'a' : 'm')).join('') : '');
      return '';
    }).join('#') + '#' + [...st.editandoTexto].join(',');
  }

  /* ── guardado automático, choque y respaldo ──────────────── */

  function programarGuardado(ms) {
    clearTimeout(temporizador);
    if (!st.sucio || !editable() || st.detenido) { pintarGuardado(); return; }
    temporizador = setTimeout(guardar, ms);
    pintarGuardado();
  }

  /** Respaldo en este navegador: lo de esta pantalla + la BASE de la que partió (para no pisar a otra persona al recuperarlo). */
  function respaldar() {
    try { return dep.local.guardarRespaldo(st.id, st.contenido, undefined, { base: st.base, revBase: st.revBase, uid: ctx.usuario && ctx.usuario.uid }); } catch (_) { return false; }
  }
  const claveAviso = () => 'guardar-' + st.id;

  async function guardar() {
    clearTimeout(temporizador);
    if (!st.sucio) return true;
    if (!st.vivo || st.choque || !editable()) return false;
    if (st.guardando) { st.otraVez = true; return false; }
    st.guardando = true;
    const enviado = st.contenido;
    pintarGuardado();
    let ok = false;
    try {
      const r = await ctx.repo.guardar(st.id, enviado, st.rev);
      st.rev = Number(r && r.rev) || st.rev + 1;
      st.ultimo = (r && r.actualizadoEn) || new Date().toISOString();
      if (st.contenido === enviado) st.sucio = false;
      st.base = enviado;
      st.revBase = st.rev;
      st.sinRed = false;
      st.detenido = false;
      if (typeof ctx.quitarAviso === 'function') ctx.quitarAviso(claveAviso());
      try { dep.local.borrarRespaldo(st.id); } catch (_) { /* sin almacenamiento */ }
      ok = true;
    } catch (err) {
      const cod = err && err.codigo;
      if (cod === 'conflicto') {
        st.choque = true;
        respaldar();
        pintarBandas();
        pintarSeccion();
      } else if (cod === 'red') {
        st.sinRed = true;
        respaldar();
        clearTimeout(temporizador);
        temporizador = setTimeout(guardar, ESPERA_REINTENTO);
      } else {
        respaldar();
        // Un error que reintentar no arregla (datos que la plataforma rechaza, informe que ya no existe, falla
        // desconocida): se DETIENE el guardado automático hasta el próximo cambio y queda UN solo aviso.
        st.detenido = true;
        ctx.avisar('No se pudo guardar: ' + ((err && err.message) || err) + ' Sus cambios quedan respaldados en este navegador; el guardado automático sigue cuando haga otro cambio.', 'error', 0, { clave: claveAviso() });
        if (cod === 'estado' || cod === 'sin_permiso') { st.choque = true; pintarBandas(); pintarSeccion(); }
      }
    } finally {
      st.guardando = false;
      pintarGuardado();
      pintarAcciones();
      if (st.vivo && (st.otraVez || (st.sucio && !st.choque && !st.sinRed && !st.detenido))) { st.otraVez = false; programarGuardado(ESPERA_GUARDADO); }
    }
    return ok;
  }

  /** Guarda YA lo pendiente (antes de emitir o salir). true si quedó todo en la plataforma. */
  async function guardarAhora() {
    if (!st.sucio) return true;
    if (st.guardando) {
      await new Promise((res) => { const t = setInterval(() => { if (!st.guardando) { clearInterval(t); res(); } }, 120); });
    }
    if (!st.sucio) return true;
    return guardar();
  }

  function pintarGuardado() {
    const el = $('guardado');
    if (!el) return;
    let t = ''; let cls = '';
    if (st.choque) { t = 'Guardado detenido: hay cambios de otra persona'; cls = 'ibr-guardado--mal'; }
    else if (st.detenido) { t = 'No se pudo guardar: respaldo en este navegador (vea el aviso)'; cls = 'ibr-guardado--mal'; }
    else if (st.escribiendo) { t = 'Escribiendo… (se guarda al salir del campo)'; cls = 'ibr-guardado--aviso'; }
    else if (st.guardando) { t = 'Guardando…'; }
    else if (st.sinRed) { t = 'Sin conexión: respaldo en este navegador (se reintenta solo)'; cls = 'ibr-guardado--aviso'; }
    else if (st.sucio) { t = 'Cambios sin guardar…'; cls = 'ibr-guardado--aviso'; }
    else { t = 'Guardado · rev ' + st.rev + (st.ultimo ? ' · ' + F.haceCuanto(st.ultimo) : ''); cls = 'ibr-guardado--ok'; }
    if (ctx.modo === 'local') t += ' · solo en este navegador';
    el.className = 'ibr-ed-guardado ' + cls;
    el.textContent = t;
  }

  /* ── cabecera, acciones y bandas ─────────────────────────── */

  function chipEstado() {
    const e = st.doc.estado;
    const cls = e === 'emitido' ? 'chip--success' : (e === 'anulado' ? 'chip--danger' : 'chip--warn');
    return '<span class="chip ' + cls + '">' + esc(L.etiquetaEstado(e, st.doc.version)) + '</span>';
  }

  function pintarTitulo() {
    const eq = (st.contenido && st.contenido.equipo) || {};
    $('titulo').innerHTML = '<h2 class="ibr-ed-h">' + esc(matricula() || '—') + ' · ' + esc(eq.subestacion || (st.doc.equipo_ref && st.doc.equipo_ref.subestacion) || '') + '</h2>'
      + '<p class="ibr-ed-sub">' + esc(st.doc.actividad || '') + ' ' + chipEstado()
      + (st.doc.creadoPor && st.doc.creadoPor.nombre ? ' <span class="ibr-tenue">· creó ' + esc(st.doc.creadoPor.nombre) + '</span>' : '') + '</p>';
  }

  function pintarAcciones() {
    const e = st.doc.estado;
    const n = (Number(st.doc.version) || 0) + 1;
    const bloq = faltantesActuales.filter((f) => f.bloquea).length;
    const botones = [];
    if (ctx.puedeEditar && e === 'borrador' && !st.choque) {
      botones.push('<button type="button" class="ibr-btn ibr-btn--primario" data-accion="emitir"'
        + (bloq ? ' disabled title="Faltan ' + bloq + ' datos para emitir"' : '') + '>Emitir versión ' + n + '</button>');
      if (st.sucio) botones.push('<button type="button" class="ibr-btn" data-accion="guardar-ya">Guardar ahora</button>');
    }
    if (ctx.puedeEditar && e === 'emitido') botones.push('<button type="button" class="ibr-btn" data-accion="corregir">Corregir (volver a borrador)</button>');
    if (ctx.esAdmin && e !== 'anulado') botones.push('<button type="button" class="ibr-btn ibr-btn--peligro" data-accion="anular">Anular</button>');
    if (Number(st.doc.version) > 0) botones.push('<button type="button" class="ibr-btn" data-accion="versiones">Versiones</button>');
    botones.push('<button type="button" class="ibr-btn" data-accion="ir-hojas">Ver hojas · PDF y Word</button>');
    const nota = e === 'borrador'
      ? (bloq ? '<span class="ibr-tenue">Para emitir faltan ' + bloq + ' datos (lista abajo).</span>' : '<span class="ibr-tenue">Listo para emitir.</span>')
      : e === 'emitido' ? '<span class="ibr-tenue">Emitido: para cambiar algo, «Corregir» lo vuelve a borrador y se emite una versión nueva.</span>'
        : '<span class="ibr-tenue">Anulado: queda solo para consulta.</span>';
    $('acciones').innerHTML = botones.join('') + nota;
  }

  function pintarBandas() {
    const partes = [];
    if (st.choque) {
      partes.push('<div class="ibr-banda ibr-banda--mal" role="alert"><b>Otra persona cambió este informe.</b> '
        + 'Sus cambios quedan en este navegador. Recargue para ver la versión nueva; al abrirlo podrá recuperar o descartar lo suyo. '
        + '<button type="button" class="ibr-btn" data-accion="recargar">Recargar</button></div>');
    }
    if (st.doc.estado === 'anulado' && st.doc.anulacion) {
      partes.push('<div class="ibr-banda ibr-banda--mal"><b>Anulado.</b> ' + esc(st.doc.anulacion.motivo || '')
        + (st.doc.anulacion.por && st.doc.anulacion.por.nombre ? ' · ' + esc(st.doc.anulacion.por.nombre) : '') + '</div>');
    }
    if (!ctx.puedeEditar) partes.push('<div class="ibr-banda">Solo lectura: lo arman las personas que el administrador habilitó.</div>');
    const resp = leerRespaldoPendiente();
    if (resp && !st.choque) {
      partes.push('<div class="ibr-banda ibr-banda--aviso" role="status"><b>Hay cambios suyos de este informe guardados en este navegador</b> '
        + '(' + esc(F.fechaHora(resp.en)) + ') que no llegaron a la plataforma. '
        + (editable() ? '<button type="button" class="ibr-btn" data-accion="recuperar">Recuperar mis cambios</button> ' : '')
        + '<button type="button" class="ibr-btn" data-accion="descartar-respaldo">Descartar</button></div>');
    }
    $('bandas').innerHTML = partes.join('');
  }

  function leerRespaldoPendiente() {
    let r = null;
    try { r = dep.local.leerRespaldo(st.id); } catch (_) { r = null; }
    if (!r || !r.contenido) return null;
    // Un computador lo puede compartir la brigada: solo se ofrece lo que guardó ESTA persona.
    if (r.uid && ctx.usuario && r.uid !== ctx.usuario.uid) return null;
    try { if (M.jsonCanonico(r.contenido) === M.jsonCanonico(st.contenido)) return null; } catch (_) { /* se ofrece igual */ }
    return r;
  }

  /* ── faltantes y navegación ──────────────────────────────── */

  function pintarFaltantes() {
    const el = $('faltantes');
    const bloq = faltantesActuales.filter((f) => f.bloquea);
    const avisos = faltantesActuales.filter((f) => !f.bloquea);
    if (!bloq.length && !avisos.length) {
      el.innerHTML = '<p class="ibr-faltantes-ok">✓ No falta nada para emitir.</p>';
      return;
    }
    const item = (f) => '<li><button type="button" class="ibr-ed-falta ' + (f.bloquea ? 'ibr-ed-falta--bloquea' : 'ibr-ed-falta--aviso') + '"'
      + ' data-ir-ruta="' + esc(f.ruta) + '" data-ir-seccion="' + esc(F.seccionDeFaltante(f)) + '">'
      + esc(f.etiqueta || f.ruta) + '</button></li>';
    const abierto = el.querySelector('details') ? el.querySelector('details').open : false;
    el.innerHTML = '<details' + (abierto ? ' open' : '') + '><summary>'
      + (bloq.length ? '<span class="ibr-ed-falta-n ibr-ed-falta-n--bloquea">Faltan ' + bloq.length + ' para emitir</span>' : '<span class="ibr-ed-falta-n">Nada impide emitir</span>')
      + (avisos.length ? ' <span class="ibr-ed-falta-n ibr-ed-falta-n--aviso">' + avisos.length + ' aviso' + (avisos.length === 1 ? '' : 's') + '</span>' : '')
      + ' <span class="ibr-tenue">· pulse uno para ir a su campo</span></summary>'
      + '<ul class="ibr-faltas">' + bloq.map(item).join('') + avisos.map(item).join('') + '</ul></details>';
  }

  function pintarNav() {
    const cuenta = F.contarFaltantesPorSeccion(faltantesActuales);
    $('nav').innerHTML = '<ul>' + F.SECCIONES.map((s) => {
      const c = cuenta.get(s.id) || { bloquea: 0, avisos: 0 };
      const marca = c.bloquea ? '<span class="ibr-nav-falta">falta ' + c.bloquea + '</span>'
        : (c.avisos ? '<span class="ibr-nav-aviso">' + c.avisos + ' aviso' + (c.avisos === 1 ? '' : 's') + '</span>' : '<span class="ibr-nav-ok" aria-label="completa">✓</span>');
      return '<li><button type="button" data-ir-seccion="' + s.id + '"' + (s.id === st.seccion ? ' aria-current="true" class="is-activa"' : '') + '>'
        + '<span>' + esc(s.titulo) + '</span>' + marca + '</button></li>';
    }).join('') + '</ul>';
  }

  function irA(seccion, ruta) {
    if (st.pestana !== 'armar') ponerPestana('armar');
    if (seccion && seccion !== st.seccion) { st.seccion = seccion; pintarNav(); pintarSeccion(); }
    if (!ruta) { secEl.scrollIntoView({ block: 'start' }); return; }
    // El control de esa ruta; si no tiene uno propio, el bloque más cercano que la contiene;
    // y si la ruta es de un bloque (p. ej. «tablas.material»), su primer control.
    const nodos = [...secEl.querySelectorAll('[data-ruta],[data-campo],[data-hueco-ruta]')];
    const rutaDe = (n) => n.getAttribute('data-ruta') || n.getAttribute('data-hueco-ruta') || n.getAttribute('data-campo') || '';
    let el = null; let largo = -1;
    for (const n of nodos) {
      const r = rutaDe(n);
      if (r && (ruta === r || ruta.startsWith(r + '.')) && r.length > largo) { el = n; largo = r.length; }
    }
    if (!el) el = nodos.find((n) => rutaDe(n).startsWith(ruta + '.')) || null;
    const destino = el || secEl;
    destino.scrollIntoView({ block: 'center' });
    const foco = destino.matches('input,select,textarea,button') ? destino : destino.querySelector('input,select,textarea,button');
    if (foco) { try { foco.focus({ preventScroll: true }); } catch (_) { foco.focus(); } }
    destino.classList.add('ibr-resalte');
    setTimeout(() => destino.classList.remove('ibr-resalte'), 1600);
  }

  /* ── campos ──────────────────────────────────────────────── */

  const valor = (ruta) => F.valorEnRuta(st.contenido, ruta);
  const idCampo = (ruta) => 'ibr-c-' + String(ruta).replace(/[^A-Za-z0-9_-]/g, '-');

  function chipOrigen(ruta) {
    // La confirmación de la potencia no «llega» de ningún lado: o falta o está hecha.
    if (ruta === 'confirmaciones.potencia') {
      return bloqueantes.has(ruta) ? '<span class="ibr-origen ibr-origen--falta">Por confirmar</span>' : '<span class="ibr-origen ibr-origen--salud">Confirmada</span>';
    }
    let e;
    try { e = M.estadoCampo(st.contenido, ruta); } catch (_) { return ''; }
    if (!e) return '';
    if (e.vacio && bloqueantes.has(ruta)) return '<span class="ibr-origen ibr-origen--falta">Por escribir</span>';
    if (e.cambiado && e.fuente && e.fuente !== 'manual' && e.original != null && !/^textos\./.test(ruta)) {
      const era = typeof e.original === 'number' ? F.numeroEnCasilla(e.original) : String(e.original);
      return '<span class="ibr-origen ibr-origen--cambiado" title="Llegó de: ' + esc(F.ETIQUETA_FUENTE[e.fuente] || e.fuente) + '">✎ Cambiado · era: ' + esc(era.length > 60 ? era.slice(0, 57) + '…' : era) + '</span>'
        + (editable() ? ' <button type="button" class="ibr-enlace" data-accion="original" data-ruta-original="' + esc(ruta) + '">Volver al original</button>' : '');
    }
    // Un pie de figura sin origen anotado puede ser el de la plantilla: no se afirma «a mano».
    if (e.fuente === 'manual' && /\.pie$/.test(ruta)) return '';
    if (e.fuente) {
      let t = F.ETIQUETA_FUENTE[e.fuente] || e.fuente;
      if (e.fuente === 'fijo' && ruta === 'equipo.frecuencia_hz') t = 'Fijo (60 Hz)';
      if (e.fuente === 'salud' && e.vacio) t = 'Salud de Activos: sin calificación';
      return '<span class="ibr-origen ibr-origen--' + esc(e.fuente) + '">' + esc(t) + '</span>';
    }
    return '';
  }

  /** Mensajes de faltantes que no son «está vacío» (p. ej. «la ONAN no puede ser mayor que la ONAF»), y avisos. */
  function mensajes(ruta) {
    let vacio = false;
    try { vacio = M.estadoCampo(st.contenido, ruta).vacio; } catch (_) { /* sin estado */ }
    return faltantesActuales.filter((f) => f.ruta === ruta && (!f.bloquea || !vacio))
      .map((f) => '<p class="' + (f.bloquea ? 'ibr-campo-error' : 'ibr-campo-aviso') + '">' + esc(f.etiqueta) + '</p>').join('');
  }

  function datalist(nombre) {
    if (nombre === 'unidades') return { id: 'ibrDlUnidades', opciones: F.UNIDADES };
    if (nombre === 'departamentos') {
      const deps = ((dep.schema && dep.schema.DEPARTAMENTOS) || []).map((d) => fmt.departamentoPapel(d.value));
      return { id: 'ibrDlDepartamentos', opciones: deps };
    }
    return null;
  }
  function datalistsHtml() {
    const dl = (d) => '<datalist id="' + d.id + '">' + d.opciones.map((o) => '<option value="' + esc(o) + '"></option>').join('') + '</datalist>';
    return dl(datalist('unidades')) + dl(datalist('departamentos'))
      + '<datalist id="ibrDlConsignacion">' + F.TIPOS_CONSIGNACION.map((o) => '<option value="' + esc(o) + '"></option>').join('') + '</datalist>';
  }

  function controlHtml(c) {
    const v = valor(c.ruta);
    const dis = editable() ? '' : ' disabled';
    const id = idCampo(c.ruta);
    const base = ' id="' + id + '" data-ruta="' + esc(c.ruta) + '"' + dis;
    switch (c.tipo) {
      case 'numero':
        return '<input class="ibr-input ibr-input--num" type="text" inputmode="decimal" autocomplete="off" data-num="1"'
          + (c.entero ? ' data-entero="1"' : '') + base + ' value="' + esc(F.numeroEnCasilla(v)) + '">';
      case 'fecha':
        return '<input class="ibr-input" type="date"' + base + ' value="' + esc(v || '') + '">';
      case 'casilla':
        return '<label class="ibr-casilla"><input type="checkbox"' + base + (v === true ? ' checked' : '') + '> ' + esc(c.etiqueta) + '</label>';
      case 'salud': {
        const NOM = P.NOMBRE_CONDICION || {};
        return '<select class="ibr-select"' + base + '><option value="">Sin calificación</option>'
          + [1, 2, 3, 4, 5].map((n) => '<option value="' + n + '"' + (Number(v) === n ? ' selected' : '') + '>' + n + ' · ' + esc(NOM[n] || '') + '</option>').join('')
          + '</select>';
      }
      case 'lista':
        if (c.libre) {
          return '<input class="ibr-input" type="text" list="ibrDlConsignacion"' + base + ' value="' + esc(v == null ? '' : v) + '">';
        }
        return '<select class="ibr-select"' + base + '>'
          + (c.opciones || []).map((o) => '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('')
          + (v && !(c.opciones || []).includes(v) ? '<option value="' + esc(v) + '" selected>' + esc(v) + '</option>' : '')
          + '</select>';
      default: {
        const dl = c.sugerencias ? datalist(c.sugerencias) : null;
        return '<input class="ibr-input" type="text" autocomplete="off"' + (dl ? ' list="' + dl.id + '"' : '')
          + (c.max ? ' maxlength="' + c.max + '"' : '') + base + ' value="' + esc(v == null ? '' : v) + '">';
      }
    }
  }

  function campoSimpleHtml(c) {
    const falta = bloqueantes.has(c.ruta);
    const etiqueta = c.tipo === 'casilla' ? '' : '<label class="ibr-campo-et" for="' + idCampo(c.ruta) + '">' + esc(c.etiqueta) + '</label>';
    return '<div class="ibr-campo ibr-campo--simple' + (c.tipo === 'casilla' ? ' ibr-campo--ancho' : '') + (falta ? ' ibr-campo--falta' : '') + '" data-campo="' + esc(c.ruta) + '">'
      + '<div class="ibr-campo-cab">' + etiqueta + '<span class="ibr-origen-caja" data-chip="' + esc(c.ruta) + '">' + chipOrigen(c.ruta) + '</span></div>'
      + controlHtml(c)
      + '<div data-msgs="' + esc(c.ruta) + '">' + mensajes(c.ruta) + '</div>'
      + (c.ayuda ? '<p class="ibr-ayuda">' + esc(c.ayuda) + '</p>' : '')
      + '</div>';
  }

  /* textos de plantilla */
  function textoMostrado(id) {
    const v = st.contenido.textos ? st.contenido.textos[id] : null;
    if (v != null) return String(v);
    try { return F.sinMarcas(M.textoPlantilla(id, st.contenido)); } catch (_) { return ''; }
  }

  function textoHtml(c) {
    const id = c.plantilla;
    const ruta = 'textos.' + id;
    const manual = st.contenido.textos && st.contenido.textos[id] != null;
    const editando = st.editandoTexto.has(ruta);
    const botones = editable()
      ? (editando
        ? '<button type="button" class="ibr-btn ibr-btn--chico" data-accion="texto-listo" data-texto="' + esc(ruta) + '">Listo</button>'
        : '<button type="button" class="ibr-btn ibr-btn--chico" data-accion="texto-editar" data-texto="' + esc(ruta) + '">Editar</button>')
        + (manual ? ' <button type="button" class="ibr-btn ibr-btn--chico" data-accion="texto-plantilla" data-texto="' + esc(ruta) + '">Volver a la plantilla</button>' : '')
      : '';
    return '<div class="ibr-texto' + (bloqueantes.has(ruta) ? ' ibr-campo--falta' : '') + '" data-campo="' + esc(ruta) + '">'
      + '<div class="ibr-campo-cab"><span class="ibr-campo-et">' + esc(c.etiqueta) + '</span>'
      + '<span class="ibr-origen-caja" data-chip="' + esc(ruta) + '">' + chipTexto(ruta, manual) + '</span></div>'
      + (editando
        ? '<textarea class="ibr-textarea" rows="6" data-texto-edicion="' + esc(ruta) + '" aria-label="' + esc(c.etiqueta) + '">' + esc(textoMostrado(id)) + '</textarea>'
          + '<p class="ibr-ayuda">Se guarda al salir del cuadro. Lo que escriba va tal cual (sin negrillas); si lo deja igual a la plantilla, sigue la plantilla.</p>'
        : '<p class="ibr-texto-vista" data-texto-vista="' + esc(id) + '">' + esc(textoMostrado(id)) + '</p>')
      + '<div class="ibr-texto-botones">' + botones + '</div>'
      + '<div data-msgs="' + esc(ruta) + '">' + mensajes(ruta) + '</div>'
      + '</div>';
  }
  function chipTexto(ruta, manual) {
    if (manual) return '<span class="ibr-origen ibr-origen--manual">Escrito a mano</span>';
    return '<span class="ibr-origen ibr-origen--plantilla">Plantilla</span>';
  }

  /* listas de textos (técnicos, ODT) */
  function listaTextosHtml(c) {
    const arr = Array.isArray(valor(c.ruta)) ? valor(c.ruta) : [];
    const dis = editable() ? '' : ' disabled';
    const filas = arr.map((t, i) => '<li><input class="ibr-input" type="text" aria-label="' + esc(c.etiqueta) + ' ' + (i + 1) + '" data-ruta="' + esc(c.ruta + '.' + i) + '" value="' + esc(t) + '"' + dis + '>'
      + (editable() ? ' <button type="button" class="ibr-btn ibr-btn--chico" data-accion="lista-quitar" data-lista="' + esc(c.ruta) + '" data-i="' + i + '" aria-label="Quitar">✕</button>' : '') + '</li>').join('');
    return '<div class="ibr-campo' + (bloqueantes.has(c.ruta) ? ' ibr-campo--falta' : '') + '" data-campo="' + esc(c.ruta) + '">'
      + '<div class="ibr-campo-cab"><span class="ibr-campo-et">' + esc(c.etiqueta) + '</span>'
      + '<span class="ibr-origen-caja" data-chip="' + esc(c.ruta) + '">' + chipOrigen(c.ruta) + '</span></div>'
      + '<ul class="ibr-lista-textos">' + filas + '</ul>'
      + (editable() ? '<button type="button" class="ibr-btn ibr-btn--chico" data-accion="lista-agregar" data-lista="' + esc(c.ruta) + '">＋ ' + esc(c.agregar || 'Agregar') + '</button>' : '')
      + '<div data-msgs="' + esc(c.ruta) + '">' + mensajes(c.ruta) + '</div>'
      + '</div>';
  }

  /* tablas */
  function totalesHtml(ruta) {
    const t = F.totalesVentiladores(valor(ruta));
    return 'Total: <b>' + F.numeroEnCasilla(t.cantidad) + '</b> ventiladores · <b>' + F.numeroEnCasilla(t.cfm) + '</b> CFM'
      + (t.completas ? '' : ' <span class="ibr-tenue">(faltan cantidades o CFM)</span>');
  }

  function tablaHtml(c) {
    const filas = Array.isArray(valor(c.ruta)) ? valor(c.ruta) : [];
    const ed = editable();
    const dis = ed ? '' : ' disabled';
    const cab = '<tr><th scope="col">#</th>' + c.columnas.map((k) => '<th scope="col">' + esc(k.etiqueta) + '</th>').join('') + (ed ? '<th scope="col"><span class="ibr-sr">Acciones</span></th>' : '') + '</tr>';
    const cuerpo = filas.map((f, i) => '<tr' + (f && f.auto ? ' class="ibr-fila-auto"' : '') + '>'
      + '<td class="ibr-tenue">' + (i + 1) + (f && f.auto ? ' <span class="ibr-auto" title="Fila automática: sale de los ventiladores nuevos">auto</span>' : '') + (f && f.por_persona ? ' <span class="ibr-auto" title="Sigue al número de personas">por persona</span>' : '') + '</td>'
      + c.columnas.map((k) => {
        const r = c.ruta + '.' + i + '.' + k.clave;
        const v = f ? f[k.clave] : null;
        const cls = 'ibr-input ibr-input--celda' + (k.ancho ? ' ibr-input--ancha' : '') + (bloqueantes.has(r) ? ' ibr-celda--falta' : '');
        const dl = k.sugerencias ? datalist(k.sugerencias) : null;
        const attrs = ' data-ruta="' + esc(r) + '" aria-label="' + esc(k.etiqueta + ', fila ' + (i + 1)) + '"' + dis;
        if (k.tipo === 'numero') return '<td><input class="' + cls + ' ibr-input--num" type="text" inputmode="decimal" autocomplete="off" data-num="1"' + (k.entero ? ' data-entero="1"' : '') + attrs + ' value="' + esc(F.numeroEnCasilla(v)) + '"></td>';
        return '<td><input class="' + cls + '" type="text" autocomplete="off"' + (dl ? ' list="' + dl.id + '"' : '') + attrs + ' value="' + esc(v == null ? '' : v) + '"></td>';
      }).join('')
      + (ed ? '<td class="ibr-fila-botones">' + botonesFila(c, filas, i) + '</td>' : '')
      + '</tr>').join('');
    let pie = '';
    if (ed) {
      pie += '<button type="button" class="ibr-btn ibr-btn--chico" data-accion="fila-agregar" data-tabla="' + esc(c.ruta) + '">＋ Agregar fila</button>';
      // «Regenerar» solo cuando de verdad hay algo que regenerar (el contenido se sincroniza solo tras cada cambio).
      if (c.regenerar && hayQueRegenerar()) pie += ' <button type="button" class="ibr-btn ibr-btn--chico" data-accion="regenerar">Regenerar filas de ventiladores</button>';
      if (c.accion) pie += ' <span data-accion-caja="1">' + accionHtml() + '</span>';
    }
    return '<div class="ibr-campo ibr-campo--tabla' + (bloqueantes.has(c.ruta) ? ' ibr-campo--falta' : '') + '" data-campo="' + esc(c.ruta) + '">'
      + '<div class="ibr-campo-cab"><span class="ibr-campo-et">' + esc(c.etiqueta) + '</span>'
      + '<span class="ibr-origen-caja" data-chip="' + esc(c.ruta) + '">' + chipTabla(c.ruta) + '</span></div>'
      + '<div class="ibr-tabla-ed-scroll"><table class="ibr-tabla-ed"><thead>' + cab + '</thead><tbody>'
      + (cuerpo || '<tr><td colspan="' + (c.columnas.length + 2) + '" class="ibr-tenue">Sin filas.</td></tr>') + '</tbody></table></div>'
      + (c.totales ? '<p class="ibr-totales" data-totales="' + esc(c.ruta) + '">' + totalesHtml(c.ruta) + '</p>' : '')
      + '<div class="ibr-tabla-pie">' + pie + '</div>'
      + '<div data-msgs="' + esc(c.ruta) + '">' + mensajes(c.ruta) + '</div>'
      + '</div>';
  }

  /**
   * ↑ ↓ ✕ de una fila. Las filas AUTOMÁTICAS (salen de los ventiladores de 4.3) no se mueven ni se
   * quitan aquí: el dominio las vuelve a poner primero (antes ✕ pedía confirmar y la fila seguía; en la
   * Tabla 5 borraba la medición). Una fila manual tampoco cruza al bloque de las automáticas.
   */
  function botonesFila(c, filas, i) {
    const f = filas[i] || {};
    const auto = !!f.auto;
    const prevAuto = i > 0 && !!(filas[i - 1] && filas[i - 1].auto);
    const tAuto = ' title="Fila automática: sale de los ventiladores de 4.3 (se cambia allá)"';
    const dis = (cond) => (cond ? ' disabled' : '');
    const b = (accion, etiqueta, txt, apagado) => '<button type="button" class="ibr-btn ibr-btn--icono" data-accion="' + accion + '" data-tabla="' + esc(c.ruta) + '" data-i="' + i + '" aria-label="' + etiqueta + ' ' + (i + 1) + '"' + (auto ? tAuto : '') + dis(apagado) + '>' + txt + '</button>';
    return b('fila-subir', 'Subir fila', '↑', auto || i === 0 || prevAuto)
      + b('fila-bajar', 'Bajar fila', '↓', auto || i === filas.length - 1)
      + b('fila-quitar', 'Quitar fila', '✕', auto || (c.minFilas && filas.length <= c.minFilas));
  }
  function hayQueRegenerar() {
    try { return M.jsonCanonico(M.regenerarFilasAuto(st.contenido)) !== M.jsonCanonico(st.contenido); } catch (_) { return false; }
  }

  function chipTabla(ruta) {
    const origenes = (st.contenido.origenes || []).filter((o) => String(o.ruta).startsWith(ruta + '.'));
    if (origenes.some((o) => o.fuente === 'accion')) {
      const f = st.contenido.ventiladores && st.contenido.ventiladores.accion_fecha;
      return '<span class="ibr-origen ibr-origen--accion">Acción de refrigeración' + (f ? ' del ' + esc(fmt.fechaDMA(String(f).slice(0, 10))) : '') + '</span>';
    }
    const filas = valor(ruta);
    if (Array.isArray(filas) && filas.some((r) => r && r.auto)) return '<span class="ibr-origen ibr-origen--plantilla">Con filas automáticas</span>';
    if (/^tablas\./.test(ruta)) return '<span class="ibr-origen ibr-origen--plantilla">Plantilla (editable)</span>';
    return '';
  }

  function accionHtml() {
    if (st.acciones === null) return '<span class="ibr-tenue">Buscando acción de refrigeración…</span>';
    if (st.acciones.error) return '<span class="ibr-tenue">' + esc(st.acciones.error) + '</span>';
    if (!st.acciones.length) return '<span class="ibr-tenue">Sin acción de refrigeración registrada para este equipo.</span>';
    const et = (a) => (fmt.fechaDMA(String(a.fecha_accion || '').slice(0, 10)) || 'sin fecha') + (a.estado_accion ? ' (' + a.estado_accion + ')' : '');
    return (st.acciones.length > 1
      ? '<select class="ibr-select ibr-select--chico" data-accion-cual="1" aria-label="Acción de refrigeración">' + st.acciones.map((a, i) => '<option value="' + i + '">' + esc(et(a)) + '</option>').join('') + '</select> '
      : '')
      + '<button type="button" class="ibr-btn ibr-btn--chico" data-accion="aplicar-accion">Llenar con la acción de refrigeración' + (st.acciones.length === 1 ? ' del ' + esc(et(st.acciones[0])) : '') + '</button>';
  }

  function pedirAcciones() {
    if (st.accionesPedidas) return;
    st.accionesPedidas = true;
    ctx.repo.listarAcciones(matricula()).then((lista) => {
      st.acciones = Array.isArray(lista) ? lista : [];
      if (lista && lista.error) st.acciones.error = lista.error;
    }).catch(() => { st.acciones = []; st.acciones.error = 'No se pudieron leer las acciones de refrigeración.'; })
      .finally(() => { secEl.querySelectorAll('[data-accion-caja]').forEach((x) => { x.innerHTML = accionHtml(); }); });
  }

  /* viñetas (conclusiones y recomendaciones) */
  function vinetasHtml(c) {
    const lista = Array.isArray(valor(c.ruta)) ? valor(c.ruta) : [];
    const ed = editable();
    const base = c.ruta === 'conclusiones' ? (P.CONCLUSIONES || []) : (P.RECOMENDACIONES || []);
    const usadas = new Set(lista.map((x) => x && x.plantilla).filter(Boolean));
    const quitadas = base.filter((x) => !usadas.has(x.id));
    const items = lista.map((it, i) => {
      const r = c.ruta + '.' + i;
      const editando = st.editandoTexto.has(r);
      let texto = it && it.texto != null ? String(it.texto) : '';
      if (it && it.texto == null && it.plantilla) { try { texto = F.sinMarcas(M.textoPlantilla(it.plantilla, st.contenido)); } catch (_) { texto = ''; } }
      const chip = it && it.texto == null ? '<span class="ibr-origen ibr-origen--plantilla">Plantilla</span>'
        : (it && it.plantilla ? '<span class="ibr-origen ibr-origen--cambiado">✎ Cambiada a mano</span>' : '<span class="ibr-origen ibr-origen--manual">Escrita a mano</span>');
      return '<li class="ibr-vineta' + (bloqueantes.has(r + '.texto') ? ' ibr-campo--falta' : '') + '" data-campo="' + esc(r + '.texto') + '">'
        + '<div class="ibr-campo-cab"><span class="ibr-campo-et">' + (c.ruta === 'conclusiones' ? 'Conclusión ' : 'Recomendación ') + (i + 1) + '</span>' + chip + '</div>'
        + (editando
          ? '<textarea class="ibr-textarea" rows="4" data-vineta-edicion="' + esc(r) + '" aria-label="Texto">' + esc(texto) + '</textarea>'
          : '<p class="ibr-texto-vista">' + esc(texto) + '</p>')
        + (ed ? '<div class="ibr-texto-botones">'
          + (editando ? '<button type="button" class="ibr-btn ibr-btn--chico" data-accion="vineta-listo" data-vineta="' + esc(r) + '">Listo</button>'
            : '<button type="button" class="ibr-btn ibr-btn--chico" data-accion="vineta-editar" data-vineta="' + esc(r) + '">Editar</button>')
          + (it && it.plantilla && it.texto != null ? ' <button type="button" class="ibr-btn ibr-btn--chico" data-accion="vineta-plantilla" data-vineta="' + esc(r) + '">Volver a la plantilla</button>' : '')
          + ' <button type="button" class="ibr-btn ibr-btn--icono" data-accion="vineta-subir" data-vineta="' + esc(r) + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>'
          + '<button type="button" class="ibr-btn ibr-btn--icono" data-accion="vineta-bajar" data-vineta="' + esc(r) + '" aria-label="Bajar"' + (i === lista.length - 1 ? ' disabled' : '') + '>↓</button>'
          + '<button type="button" class="ibr-btn ibr-btn--icono" data-accion="vineta-quitar" data-vineta="' + esc(r) + '" aria-label="Quitar">✕</button>'
          + '</div>' : '')
        + '<div data-msgs="' + esc(r + '.texto') + '">' + mensajes(r + '.texto') + '</div>'
        + '</li>';
    }).join('');
    return '<div class="ibr-campo" data-campo="' + esc(c.ruta) + '"><div class="ibr-campo-cab"><span class="ibr-campo-et">' + esc(c.etiqueta) + '</span></div>'
      + '<ol class="ibr-vinetas">' + items + '</ol>'
      + (ed ? '<div class="ibr-tabla-pie"><button type="button" class="ibr-btn ibr-btn--chico" data-accion="vineta-agregar" data-lista="' + esc(c.ruta) + '">＋ Agregar una propia</button>'
        + (quitadas.length ? ' <select class="ibr-select ibr-select--chico" data-vineta-reponer="' + esc(c.ruta) + '" aria-label="Volver a poner una de la plantilla">'
          + '<option value="">Volver a poner una de la plantilla…</option>'
          + quitadas.map((x) => '<option value="' + esc(x.id) + '">' + esc(F.sinMarcas(x.texto).slice(0, 80)) + '…</option>').join('') + '</select>' : '')
        + '</div>' : '')
      + '<div data-msgs="' + esc(c.ruta) + '">' + mensajes(c.ruta) + '</div></div>';
  }

  /* firmas */
  function estadoFirmaHtml(rol) {
    const linea = valor('firmas.' + rol) || { nombre: '', firmante: null };
    const firmantes = (ctx.config && Array.isArray(ctx.config.firmantes)) ? ctx.config.firmantes : [];
    const f = firmantes.find((x) => x && x.clave === linea.firmante);
    if (f && f.firma) return '<span class="ibr-origen ibr-origen--configuracion">Firma registrada · se estampa solo al emitir</span>';
    if (f) return '<span class="ibr-origen">Sin firma registrada: se firma a mano</span>';
    if (linea.nombre) return '<span class="ibr-origen ibr-origen--manual">Escrito a mano · se firma a mano</span>';
    return bloqueantes.has('firmas.' + rol + '.nombre') ? '<span class="ibr-origen ibr-origen--falta">Por escribir</span>' : '';
  }

  function firmanteHtml(c) {
    const rol = c.rol;
    const linea = valor(c.ruta) || { nombre: '', firmante: null };
    const firmantes = (ctx.config && Array.isArray(ctx.config.firmantes)) ? ctx.config.firmantes : [];
    const dis = editable() ? '' : ' disabled';
    const rutaNombre = c.ruta + '.nombre';
    return '<div class="ibr-campo ibr-firma-linea' + (bloqueantes.has(rutaNombre) ? ' ibr-campo--falta' : '') + '" data-campo="' + esc(rutaNombre) + '">'
      + '<div class="ibr-campo-cab"><span class="ibr-campo-et">' + esc(c.etiqueta) + '</span><span class="ibr-origen-caja" data-firma-estado="' + esc(rol) + '">' + estadoFirmaHtml(rol) + '</span></div>'
      + '<div class="ibr-firma-controles">'
      + '<select class="ibr-select" data-firmante="' + esc(rol) + '" aria-label="' + esc(c.etiqueta) + ': firmante"' + dis + '>'
      + '<option value="">— Escribir el nombre a mano —</option>'
      + firmantes.map((x) => '<option value="' + esc(x.clave) + '"' + (x.clave === linea.firmante ? ' selected' : '') + '>'
        + esc(x.nombre) + (x.cargo ? ' · ' + esc(x.cargo) : '') + (x.firma ? ' (con firma)' : ' (sin firma)') + '</option>').join('')
      + '</select>'
      + '<input class="ibr-input" type="text" autocomplete="off" data-ruta="' + esc(rutaNombre) + '" data-mayusculas="1" aria-label="' + esc(c.etiqueta) + ': nombre" placeholder="NOMBRE EN MAYÚSCULAS" value="' + esc(linea.nombre || '') + '"' + dis + '>'
      + '</div>'
      + '<div data-msgs="' + esc(rutaNombre) + '">' + mensajes(rutaNombre) + '</div>'
      + '</div>';
  }

  /* ── sección ─────────────────────────────────────────────── */

  const fotos = crearEditorFotos({
    ctx,
    obtener: () => st.contenido,
    cambiar,
    editable,
    informeId: () => st.id,
    bloqueantes: () => bloqueantes,
    mensajes,
    chipOrigen,
    repintar: () => pintarSeccion()
  });

  function campoHtml(c) {
    switch (c.tipo) {
      case 'texto_plantilla': return textoHtml(c);
      case 'lista_textos': return listaTextosHtml(c);
      case 'tabla': return tablaHtml(c);
      case 'vinetas': return vinetasHtml(c);
      case 'firmante': return firmanteHtml(c);
      case 'figuras': return fotos.figurasHtml(c);
      case 'anexos': return fotos.anexosHtml(c);
      default: return campoSimpleHtml(c);
    }
  }

  function pintarSeccion() {
    const s = F.SECCIONES.find((x) => x.id === st.seccion) || F.SECCIONES[0];
    const activo = document.activeElement;
    const claveFoco = activo && secEl.contains(activo)
      ? (activo.getAttribute('data-ruta') || activo.getAttribute('data-texto-edicion') || activo.getAttribute('data-vineta-edicion') || '') : '';
    let extra = '';
    if (s.id === 'portada') extra = marcaHtml();
    if (s.campos.some((c) => c.tipo === 'tabla' && c.accion)) pedirAcciones();
    secEl.innerHTML = '<h3 class="ibr-sec-t">' + esc(s.titulo) + '</h3>'
      + (s.ayuda ? '<p class="ibr-ayuda ibr-sec-ayuda">' + esc(s.ayuda) + '</p>' : '')
      + datalistsHtml()
      + s.campos.map(campoHtml).join('')
      + extra
      + navegacionPie(s.id);
    fotos.alPintar(secEl);
    if (claveFoco) {
      const el = secEl.querySelector('[data-ruta="' + cssEsc(claveFoco) + '"],[data-texto-edicion="' + cssEsc(claveFoco) + '"],[data-vineta-edicion="' + cssEsc(claveFoco) + '"]');
      if (el) { try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); } }
    }
  }
  const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));

  function navegacionPie(id) {
    const i = F.IDS_SECCION.indexOf(id);
    const ant = i > 0 ? F.SECCIONES[i - 1] : null;
    const sig = i < F.SECCIONES.length - 1 ? F.SECCIONES[i + 1] : null;
    return '<div class="ibr-sec-pie">'
      + (ant ? '<button type="button" class="ibr-btn" data-ir-seccion="' + ant.id + '">← ' + esc(ant.titulo) + '</button>' : '<span></span>')
      + (sig ? '<button type="button" class="ibr-btn" data-ir-seccion="' + sig.id + '">' + esc(sig.titulo) + ' →</button>' : '<button type="button" class="ibr-btn ibr-btn--primario" data-accion="ir-hojas">Ver hojas →</button>')
      + '</div>';
  }

  function marcaHtml() {
    const claves = P.MARCA_CLAVES || [];
    const geo = P.MARCA_GEOMETRIA || {};
    const marca = (ctx.config && ctx.config.marca) || {};
    const faltan = claves.filter((k) => !marca[k]);
    return '<div class="ibr-campo" data-campo="config.marca"><div class="ibr-campo-cab"><span class="ibr-campo-et">Logos de la marca</span>'
      + (faltan.length ? '<span class="ibr-origen ibr-origen--falta">Faltan ' + faltan.length + '</span>' : '<span class="ibr-origen ibr-origen--configuracion">Completos</span>') + '</div>'
      + '<ul class="ibr-marca-lista">' + claves.map((k) => '<li>' + (marca[k] ? '✓ ' : '○ ') + esc((geo[k] && geo[k].nombre) || k) + '</li>').join('') + '</ul>'
      + '<p class="ibr-ayuda">' + (ctx.esAdmin ? 'Se suben una sola vez en «Configuración del informe», arriba de la página.' : 'Los sube un administrador una sola vez; mientras tanto, el papel muestra un recuadro «Logo pendiente».') + '</p></div>';
  }

  /** Actualiza en su sitio lo que depende del contenido, sin reemplazar los controles (no se pierde el foco ni el clic). */
  function refrescarSeccion() {
    secEl.querySelectorAll('[data-ruta]').forEach((el) => {
      if (el === document.activeElement) return;
      const r = el.getAttribute('data-ruta');
      const v = valor(r);
      if (el.type === 'checkbox') el.checked = v === true;
      else if (el.getAttribute('data-num')) { const t = F.numeroEnCasilla(v); if (el.value !== t && !el.classList.contains('ibr-input--malo')) el.value = t; }
      else if (el.tagName === 'SELECT') { const t = v == null ? '' : String(v); if (el.value !== t) el.value = t; }
      else { const t = v == null ? '' : String(v); if (el.value !== t) el.value = t; }
    });
    secEl.querySelectorAll('[data-chip]').forEach((el) => {
      const r = el.getAttribute('data-chip');
      if (/^textos\./.test(r)) return;
      el.innerHTML = /^(tablas|ventiladores|corrientes)\./.test(r) && Array.isArray(valor(r)) ? chipTabla(r) : chipOrigen(r);
    });
    secEl.querySelectorAll('[data-msgs]').forEach((el) => { el.innerHTML = mensajes(el.getAttribute('data-msgs')); });
    secEl.querySelectorAll('[data-firma-estado]').forEach((el) => { el.innerHTML = estadoFirmaHtml(el.getAttribute('data-firma-estado')); });
    secEl.querySelectorAll('[data-firmante]').forEach((el) => {
      if (el === document.activeElement) return;
      const v = (valor('firmas.' + el.getAttribute('data-firmante')) || {}).firmante || '';
      if (el.value !== v) el.value = v;
    });
    secEl.querySelectorAll('[data-texto-vista]').forEach((el) => { el.textContent = textoMostrado(el.getAttribute('data-texto-vista')); });
    secEl.querySelectorAll('[data-totales]').forEach((el) => { el.innerHTML = totalesHtml(el.getAttribute('data-totales')); });
    secEl.querySelectorAll('[data-campo]').forEach((el) => {
      const r = el.getAttribute('data-campo');
      el.classList.toggle('ibr-campo--falta', bloqueantes.has(r));
    });
    secEl.querySelectorAll('input[data-ruta].ibr-input--celda').forEach((el) => {
      el.classList.toggle('ibr-celda--falta', bloqueantes.has(el.getAttribute('data-ruta')));
    });
    fotos.alRefrescar(secEl);
  }

  /* ── eventos del formulario (delegados en la sección) ────── */

  function leerControl(el) {
    if (el.type === 'checkbox') return { ok: true, v: el.checked };
    if (el.getAttribute('data-num')) {
      const n = F.leerNumero(el.value);
      if (Number.isNaN(n)) return { ok: false, msg: 'Eso no es un número. Escriba, por ejemplo, 2,5.' };
      if (n != null && el.getAttribute('data-entero') && !Number.isInteger(n)) return { ok: false, msg: 'Aquí va un número entero.' };
      if (n != null && n < 0) return { ok: false, msg: 'No puede ser negativo.' };
      return { ok: true, v: n };
    }
    let v = String(el.value == null ? '' : el.value).replace(/\s+/g, ' ').trim();
    if (el.getAttribute('data-mayusculas')) v = v.toLocaleUpperCase('es-CO');
    return { ok: true, v };
  }

  function marcarMalo(el, msg) {
    el.classList.add('ibr-input--malo');
    el.setAttribute('aria-invalid', 'true');
    el.title = msg;
    ctx.avisar(msg, 'aviso', 4000);
  }
  function limpiarMalo(el) {
    el.classList.remove('ibr-input--malo');
    el.removeAttribute('aria-invalid');
    el.removeAttribute('title');
  }

  secEl.addEventListener('change', (ev) => {
    const el = ev.target;
    if (fotos.alCambiar(ev)) return;
    if (el.matches('[data-texto-edicion]')) { guardarTexto(el.getAttribute('data-texto-edicion'), el.value); return; }
    if (el.matches('[data-vineta-edicion]')) { guardarVineta(el.getAttribute('data-vineta-edicion'), el.value); return; }
    if (el.matches('[data-firmante]')) {
      const rol = el.getAttribute('data-firmante');
      const clave = el.value;
      const f = clave ? ((ctx.config && ctx.config.firmantes) || []).find((x) => x.clave === clave) : null;
      if (f) cambiar((c) => M.asignarFirmante(c, rol, f), { repintar: 'todo' });
      else cambiar((c) => M.cambiarCampo(c, 'firmas.' + rol + '.firmante', null), { repintar: 'todo' });
      return;
    }
    if (el.matches('[data-vineta-reponer]')) {
      const lista = el.getAttribute('data-vineta-reponer');
      const id = el.value;
      if (!id) return;
      cambiar((c) => M.cambiarCampo(c, lista, (F.valorEnRuta(c, lista) || []).concat([{ plantilla: id, texto: null }])), { repintar: 'todo' });
      return;
    }
    if (el.matches('[data-accion-cual]')) return;
    if (!el.matches('[data-ruta]')) return;
    const ruta = el.getAttribute('data-ruta');
    const r = leerControl(el);
    if (!r.ok) { marcarMalo(el, r.msg); return; }
    limpiarMalo(el);
    if (ruta === 'confirmaciones.potencia') { cambiar((c) => M.confirmarPotencia(c, r.v)); return; }
    if (ruta === 'salud.numero') {
      const n = r.v === '' ? null : Number(r.v);
      const nombre = n ? String((P.NOMBRE_CONDICION || {})[n] || '').toLocaleLowerCase('es-CO') : '';
      cambiar((c) => M.cambiarCampo(M.cambiarCampo(c, 'salud.numero', n), 'salud.texto', nombre));
      return;
    }
    cambiar((c) => M.cambiarCampo(c, ruta, r.v));
  });

  function guardarTexto(ruta, texto) {
    const id = ruta.replace(/^textos\./, '');
    const t = String(texto == null ? '' : texto).trim();
    let plantilla = '';
    try { plantilla = F.sinMarcas(M.textoPlantilla(id, st.contenido)).trim(); } catch (_) { plantilla = ''; }
    cambiar((c) => M.cambiarCampo(c, ruta, t === plantilla ? null : t), { repintar: 'nada' });
    const chip = secEl.querySelector('[data-chip="' + cssEsc(ruta) + '"]');
    if (chip) chip.innerHTML = chipTexto(ruta, t !== plantilla);
  }
  function guardarVineta(r, texto) {
    const t = String(texto == null ? '' : texto).trim();
    const [lista, i] = [r.replace(/\.\d+$/, ''), Number(r.split('.').pop())];
    const it = (F.valorEnRuta(st.contenido, lista) || [])[i];
    let plantilla = '';
    if (it && it.plantilla) { try { plantilla = F.sinMarcas(M.textoPlantilla(it.plantilla, st.contenido)).trim(); } catch (_) { plantilla = ''; } }
    cambiar((c) => M.cambiarCampo(c, r + '.texto', it && it.plantilla && t === plantilla ? null : t), { repintar: 'nada' });
  }

  function moverEn(arr, i, d) {
    const a = arr.slice();
    const j = i + d;
    if (j < 0 || j >= a.length) return a;
    const [x] = a.splice(i, 1);
    a.splice(j, 0, x);
    return a;
  }

  cont.addEventListener('click', async (ev) => {
    if (fotos.alClic(ev)) return;
    const ir = ev.target.closest('[data-ir-seccion]');
    if (ir && cont.contains(ir)) { irA(ir.getAttribute('data-ir-seccion'), ir.getAttribute('data-ir-ruta')); return; }
    const tab = ev.target.closest('[data-pestana]');
    if (tab) { ponerPestana(tab.getAttribute('data-pestana')); return; }
    if (ev.target.closest('[data-e="volver"]')) { await salir(); return; }
    const b = ev.target.closest('[data-accion]');
    if (!b || b.disabled) return;
    const a = b.getAttribute('data-accion');
    const lista = b.getAttribute('data-lista') || b.getAttribute('data-tabla');
    const i = Number(b.getAttribute('data-i'));
    switch (a) {
      case 'original': {
        const r = b.getAttribute('data-ruta-original');
        const e = M.estadoCampo(st.contenido, r);
        if (e && e.original !== undefined) {
          if (r === 'salud.numero') {
            const n = e.original == null ? null : Number(e.original);
            cambiar((c) => M.cambiarCampo(M.cambiarCampo(c, 'salud.numero', n), 'salud.texto', n ? String((P.NOMBRE_CONDICION || {})[n] || '').toLocaleLowerCase('es-CO') : ''), { repintar: 'todo' });
          } else cambiar((c) => M.cambiarCampo(c, r, e.original), { repintar: 'todo' });
        }
        return;
      }
      case 'lista-agregar': cambiar((c) => M.cambiarCampo(c, lista, (F.valorEnRuta(c, lista) || []).concat([''])), { repintar: 'todo' }); return;
      case 'lista-quitar': cambiar((c) => M.cambiarCampo(c, lista, (F.valorEnRuta(c, lista) || []).filter((_, k) => k !== i)), { repintar: 'todo' }); return;
      case 'fila-agregar': {
        const campo = buscarCampo(lista);
        cambiar((c) => M.cambiarCampo(c, lista, (F.valorEnRuta(c, lista) || []).concat([{ ...((campo && campo.nuevaFila) || {}) }])), { repintar: 'todo' });
        return;
      }
      case 'fila-quitar': {
        const fila = (F.valorEnRuta(st.contenido, lista) || [])[i] || {};
        if (fila.auto) return;   // sale de los ventiladores de 4.3: se quita allá
        const conDatos = Object.entries(fila).some(([k, v]) => k !== 'auto' && v != null && v !== '' && k !== 'unidad');
        if (conDatos && !(await confirmar({ titulo: 'Quitar la fila ' + (i + 1), texto: 'La fila tiene datos. ¿Quitarla?', boton: 'Quitar', peligro: true, esc }))) return;
        cambiar((c) => M.cambiarCampo(c, lista, (F.valorEnRuta(c, lista) || []).filter((_, k) => k !== i)), { repintar: 'todo' });
        return;
      }
      case 'fila-subir': case 'fila-bajar': {
        const arr = F.valorEnRuta(st.contenido, lista) || [];
        const j = i + (a === 'fila-subir' ? -1 : 1);
        if (!arr[i] || !arr[j] || arr[i].auto || arr[j].auto) return;   // las automáticas no se mueven
        cambiar((c) => M.cambiarCampo(c, lista, moverEn(F.valorEnRuta(c, lista) || [], i, j - i)), { repintar: 'todo' });
        return;
      }
      case 'regenerar': cambiar((c) => M.regenerarFilasAuto(c), { repintar: 'todo' }); return;
      case 'aplicar-accion': {
        const sel = secEl.querySelector('[data-accion-cual]');
        const ac = (st.acciones || [])[sel ? Number(sel.value) : 0];
        if (!ac) return;
        const ok = await confirmar({
          titulo: 'Llenar con la acción de refrigeración', esc, boton: 'Llenar',
          texto: 'Se copian de la acción los ventiladores nuevos y las potencias ONAN y ONAF (habrá que volver a confirmarlas). La acción NO se modifica.'
        });
        if (ok) cambiar((c) => M.aplicarAccion(c, ac), { repintar: 'todo' });
        return;
      }
      case 'texto-editar': st.editandoTexto.add(b.getAttribute('data-texto')); pintarSeccion(); enfocar('[data-texto-edicion="' + cssEsc(b.getAttribute('data-texto')) + '"]'); return;
      case 'texto-listo': {
        const r = b.getAttribute('data-texto');
        const ta = secEl.querySelector('[data-texto-edicion="' + cssEsc(r) + '"]');
        if (ta) guardarTexto(r, ta.value);
        st.editandoTexto.delete(r); pintarSeccion(); return;
      }
      case 'texto-plantilla': {
        const r = b.getAttribute('data-texto');
        if (!(await confirmar({ titulo: 'Volver a la plantilla', texto: 'Se pierde el texto escrito a mano en este párrafo y vuelve el de la plantilla (con los datos del informe).', boton: 'Volver a la plantilla', esc }))) return;
        st.editandoTexto.delete(r);
        cambiar((c) => M.cambiarCampo(c, r, null), { repintar: 'todo' });
        return;
      }
      case 'vineta-editar': st.editandoTexto.add(b.getAttribute('data-vineta')); pintarSeccion(); enfocar('[data-vineta-edicion="' + cssEsc(b.getAttribute('data-vineta')) + '"]'); return;
      case 'vineta-listo': {
        const r = b.getAttribute('data-vineta');
        const ta = secEl.querySelector('[data-vineta-edicion="' + cssEsc(r) + '"]');
        if (ta) guardarVineta(r, ta.value);
        st.editandoTexto.delete(r); pintarSeccion(); return;
      }
      case 'vineta-plantilla': { const r = b.getAttribute('data-vineta'); st.editandoTexto.delete(r); cambiar((c) => M.cambiarCampo(c, r + '.texto', null), { repintar: 'todo' }); return; }
      case 'vineta-subir': case 'vineta-bajar': case 'vineta-quitar': {
        const r = b.getAttribute('data-vineta');
        const l = r.replace(/\.\d+$/, ''); const k = Number(r.split('.').pop());
        st.editandoTexto.clear();
        if (a === 'vineta-quitar') cambiar((c) => M.cambiarCampo(c, l, (F.valorEnRuta(c, l) || []).filter((_, x) => x !== k)), { repintar: 'todo' });
        else cambiar((c) => M.cambiarCampo(c, l, moverEn(F.valorEnRuta(c, l) || [], k, a === 'vineta-subir' ? -1 : 1)), { repintar: 'todo' });
        return;
      }
      case 'vineta-agregar': {
        const l = b.getAttribute('data-lista');
        const n = (F.valorEnRuta(st.contenido, l) || []).length;
        st.editandoTexto.add(l + '.' + n);
        cambiar((c) => M.cambiarCampo(c, l, (F.valorEnRuta(c, l) || []).concat([{ plantilla: null, texto: '' }])), { repintar: 'todo' });
        enfocar('[data-vineta-edicion="' + cssEsc(l + '.' + n) + '"]');
        return;
      }
      case 'emitir': unaVez(emitir); return;
      case 'guardar-ya': guardarAhora(); return;
      case 'corregir': unaVez(corregir); return;
      case 'anular': unaVez(anular); return;
      case 'versiones': verVersiones(); return;
      case 'ir-hojas': ponerPestana('hojas'); return;
      case 'recargar': location.reload(); return;
      case 'recuperar': recuperarRespaldo(); return;
      case 'descartar-respaldo': {
        if (!(await confirmar({ titulo: 'Descartar sus cambios guardados en este navegador', texto: 'Se borran del navegador. Lo que está en la plataforma no cambia.', boton: 'Descartar', peligro: true, esc }))) return;
        try { dep.local.borrarRespaldo(st.id); } catch (_) { /* nada */ }
        pintarBandas();
        return;
      }
      default:
    }
  });

  /** Emitir, corregir y anular no se disparan dos veces (doble clic o Enter sostenido, L-101). */
  let enCurso = false;
  async function unaVez(fn) {
    if (enCurso) return;
    enCurso = true;
    try { await fn(); } finally { enCurso = false; }
  }

  function enfocar(sel) {
    const el = secEl.querySelector(sel);
    if (el) { try { el.focus({ preventScroll: false }); } catch (_) { el.focus(); } }
  }

  function buscarCampo(ruta) {
    for (const s of F.SECCIONES) for (const c of s.campos) if (c.ruta === ruta) return c;
    return null;
  }

  /* ── respaldo ────────────────────────────────────────────── */
  /**
   * «Recuperar mis cambios»: se aplican sobre el informe ACTUAL solo los datos que esta persona cambió
   * frente a la base de la que partió (fusión de tres vías del dominio). Lo que la otra persona cambió y
   * esta no tocó se respeta; si las dos cambiaron el MISMO dato, se pregunta antes de usar el suyo.
   */
  async function recuperarRespaldo() {
    const r = leerRespaldoPendiente();
    if (!r || !editable()) return;
    let f = M.fusionarRespaldo(r.base, r.contenido, st.contenido, { ganaMio: false });
    if (f.choques.length) {
      const lista = f.choques.slice(0, 8).map((x) => '«' + x + '»').join(', ') + (f.choques.length > 8 ? ' y ' + (f.choques.length - 8) + ' más' : '');
      const ok = await confirmar({
        titulo: 'Sus cambios chocan con los de otra persona', esc, boton: 'Usar los míos en esos datos', peligro: true,
        texto: (r.base ? 'En ' + f.choques.length + ' dato(s) la otra persona también cambió algo: ' + lista + '. '
          : 'Este respaldo es de antes y no se sabe qué cambió usted: se compararía TODO el informe. ')
          + 'Si sigue, en esos datos queda lo SUYO y se pierde lo de la otra persona. Lo demás que ella cambió se conserva.'
      });
      if (!ok) return;
      f = M.fusionarRespaldo(r.base, r.contenido, st.contenido, { ganaMio: true });
    }
    st.contenido = f.contenido;
    st.sucio = true;
    st.detenido = false;
    recalcular();
    pintarTodo();
    programarGuardado(0);
    ctx.avisar('Se recuperaron ' + f.aplicadas.length + ' cambio(s) suyos sobre la versión actual; se están guardando.'
      + (f.omitidas.length ? ' ' + f.omitidas.length + ' no se pudieron aplicar (la otra persona quitó esa parte).' : ''), 'ok');
  }

  /* ── pestañas ────────────────────────────────────────────── */
  let vista = null;
  function ponerPestana(p) {
    st.pestana = p;
    cont.querySelectorAll('[data-pestana]').forEach((t) => {
      const on = t.getAttribute('data-pestana') === p;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('panel-armar').hidden = p !== 'armar';
    $('panel-hojas').hidden = p !== 'hojas';
    if (p === 'hojas') {
      if (!vista) vista = montarVista($('panel-hojas'), { ctx, obtener: estadoParaVista, alVolverAlInforme: () => { st.versionVista = null; vista.pintar(); } });
      vista.pintar();
    }
  }

  /** Lo que se dibuja: el informe actual (borrador/emitido/anulado) o una versión emitida escogida. */
  async function estadoParaVista() {
    if (st.versionVista) {
      const v = st.versionVista;
      return { contenido: v.contenido, estado: 'emitido', version: v.version, versionDoc: v, matricula: matricula(), etiqueta: 'Versión ' + v.version + ' emitida' + (v.en ? ' el ' + F.fechaHora(v.en) : '') };
    }
    let versionDoc = null;
    let errorVersion = '';
    if (st.doc.estado === 'emitido' && Number(st.doc.version) > 0) {
      try { versionDoc = await ctx.repo.obtenerVersion(st.id, st.doc.version); } catch (err) { console.warn('[informe-brigada] versión emitida:', err); }
      // Sin la versión congelada saldría SIN firmas y con los logos de hoy: no se imprime así.
      if (!versionDoc) errorVersion = 'No se pudo leer la versión ' + st.doc.version + ' congelada (firmas y logos de la emisión).';
    }
    return { contenido: st.contenido, estado: st.doc.estado, version: Number(st.doc.version) || 0, versionDoc, matricula: matricula(), etiqueta: '', errorVersion };
  }

  /* ── emitir, corregir, anular, versiones ─────────────────── */

  async function emitir() {
    if (!editable()) return;
    volcarFoco();
    const ok = await guardarAhora();
    if (!ok) { ctx.avisar('No se pudo guardar antes de emitir. Revise la conexión e intente de nuevo.', 'error'); return; }
    // La configuración se RELEE antes de estampar: un firmante retirado (autorización revocada) no se estampa
    // con una lista vieja, y los logos recién cargados por un administrador cuentan.
    try {
      const rc = await ctx.repo.leerConfig();
      if (rc && rc.estado === 'ok' && rc.config && typeof ctx.actualizarConfig === 'function') ctx.actualizarConfig(rc.config);
    } catch (err) { console.warn('[informe-brigada] releer configuración antes de emitir:', err); }
    if (!editable()) { pintarTodo(); ctx.avisar('Usted ya no está entre quienes arman el informe: no se puede emitir.', 'aviso'); return; }
    recalcular();
    const bloq = faltantesActuales.filter((f) => f.bloquea);
    if (bloq.length) { pintarFaltantes(); const d = $('faltantes').querySelector('details'); if (d) d.open = true; ctx.avisar('Faltan ' + bloq.length + ' datos para emitir.', 'aviso'); return; }
    const n = (Number(st.doc.version) || 0) + 1;
    let firmas = [];
    try { firmas = dep.rutas.firmasParaEmitir(st.contenido, ctx.config) || []; } catch (_) { firmas = []; }
    const quien = firmas.length ? 'Se estampan las firmas de: ' + firmas.map((f) => f.nombre).join(', ') + '.' : 'No se estampa ninguna firma: las líneas se firman a mano.';
    let motivo = '';
    if (n >= 2) {
      motivo = await pedirTexto({
        titulo: 'Emitir la versión ' + n, esc, etiqueta: 'Qué cambió frente a la versión ' + (n - 1), minimo: 10, boton: 'Emitir versión ' + n,
        explicacion: 'La versión ' + (n - 1) + ' queda guardada tal cual. ' + quien
      });
      if (motivo == null) return;
    } else if (!(await confirmar({ titulo: 'Emitir la versión 1', boton: 'Emitir', esc, texto: 'El informe queda congelado (con su huella) y sale sin la marca «BORRADOR». ' + quien + ' Para cambiarlo después hay que «Corregir» y emitir otra versión.' }))) return;
    try {
      const huella = await M.huellaContenido(st.contenido);
      const r = await ctx.repo.emitir(st.id, { contenido: st.contenido, revEsperada: st.rev, motivo, firmas, marca: (ctx.config && ctx.config.marca) || {}, huella });
      st.rev = Number(r.rev) || st.rev + 1;
      st.doc.estado = 'emitido';
      st.doc.version = Number(r.version) || n;
      st.sucio = false;
      st.base = st.contenido;
      st.revBase = st.rev;
      st.versionVista = null;
      ctx.avisar('Versión ' + st.doc.version + ' emitida.', 'ok');
      pintarTodo();
      if (vista && st.pestana === 'hojas') vista.pintar();
    } catch (err) {
      // Solo se respalda si hay algo de esta pantalla sin guardar (si no, se ofrecería una copia vieja como «sus cambios»).
      if (err && err.codigo === 'conflicto') { st.choque = true; if (st.sucio) respaldar(); pintarTodo(); return; }
      ctx.avisar('No se pudo emitir: ' + ((err && err.message) || err), 'error', 0);
    }
  }

  async function corregir() {
    const ok = await confirmar({ titulo: 'Corregir el informe', esc, boton: 'Volver a borrador', texto: 'El informe vuelve a borrador con el mismo contenido. La versión ' + st.doc.version + ' emitida queda guardada; al terminar, se emite una versión nueva.' });
    if (!ok) return;
    try {
      const r = await ctx.repo.corregir(st.id, st.rev);
      st.rev = Number(r.rev) || st.rev + 1;
      st.revBase = st.rev;
      st.doc.estado = 'borrador';
      st.versionVista = null;
      pintarTodo();
      if (vista && st.pestana === 'hojas') vista.pintar();
    } catch (err) {
      if (err && err.codigo === 'conflicto') { st.choque = true; pintarTodo(); return; }
      ctx.avisar('No se pudo pasar a borrador: ' + ((err && err.message) || err), 'error', 0);
    }
  }

  async function anular() {
    if (!ctx.esAdmin) return;
    const motivo = await pedirTexto({ titulo: 'Anular el informe', esc, etiqueta: 'Motivo de la anulación', minimo: 10, boton: 'Anular', peligro: true,
      explicacion: 'El informe queda solo para consulta (no se borra). Esto no se deshace.' });
    if (motivo == null) return;
    try {
      await guardarAhora();
      const r = await ctx.repo.anular(st.id, st.rev, motivo);
      st.rev = Number(r.rev) || st.rev + 1;
      st.doc.estado = 'anulado';
      st.doc.anulacion = { motivo, por: ctx.autor() };
      st.versionVista = null;
      pintarTodo();
      if (vista && st.pestana === 'hojas') vista.pintar();
    } catch (err) {
      if (err && err.codigo === 'conflicto') { st.choque = true; pintarTodo(); return; }
      ctx.avisar('No se pudo anular: ' + ((err && err.message) || err), 'error', 0);
    }
  }

  async function verVersiones() {
    const v = crearVentana({ titulo: 'Versiones emitidas', subtitulo: matricula(), ancho: 'media' });
    v.cuerpo.innerHTML = '<p class="ibr-nota">Leyendo…</p>';
    v.pie.innerHTML = '<button type="button" class="ibr-btn" data-v2="cerrar">Cerrar</button>';
    v.pie.querySelector('[data-v2="cerrar"]').addEventListener('click', () => v.cerrar());
    v.atrapar('[data-v2="cerrar"]');
    let lista = [];
    try { lista = await ctx.repo.listarVersiones(st.id); } catch (err) { v.cuerpo.innerHTML = '<p class="ibr-nota ibr-nota--error">' + esc((err && err.message) || err) + '</p>'; return; }
    if (!lista.length) { v.cuerpo.innerHTML = '<p class="ibr-tenue">Todavía no hay versiones emitidas.</p>'; return; }
    v.cuerpo.innerHTML = '<ul class="ibr-sel-informes">' + lista.map((x, i) => '<li><div><b>Versión ' + esc(x.version) + '</b>'
      + '<div class="ibr-mini">' + esc(F.fechaHora(x.en)) + (x.emitidoPor && x.emitidoPor.nombre ? ' · ' + esc(x.emitidoPor.nombre) : '')
      + (x.motivo ? ' · ' + esc(x.motivo) : '') + ' · huella ' + esc(String(x.huella || '').slice(0, 12)) + '…</div></div>'
      + '<button type="button" class="ibr-btn" data-ver-version="' + i + '">Ver hojas</button></li>').join('') + '</ul>';
    v.cuerpo.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ver-version]');
      if (!b) return;
      st.versionVista = lista[Number(b.getAttribute('data-ver-version'))] || null;
      v.cerrar();
      ponerPestana('hojas');
    });
  }

  /* ── salir ───────────────────────────────────────────────── */

  /**
   * Lo tecleado en el campo con el foco pasa al informe YA (el formulario guarda al salir del campo:
   * sin esto, recargar o cerrar con el cursor dentro de «Serie» perdía lo escrito sin aviso).
   */
  function volcarFoco() {
    const a = document.activeElement;
    if (!a || !secEl.contains(a) || !st.escribiendo) return;
    if (a.matches('input[data-ruta]:not([type="checkbox"]), textarea[data-texto-edicion], textarea[data-vineta-edicion], input[data-anexo-titulo]')) {
      try { a.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) { /* navegador viejo: queda como estaba */ }
    }
    st.escribiendo = false;
  }

  async function salir() {
    volcarFoco();
    const n = fotos.pendientes();
    if (n && !(await confirmar({ titulo: n === 1 ? 'Hay una foto subiendo' : 'Hay ' + n + ' fotos subiendo', esc, boton: 'Salir igual', peligro: true,
      texto: 'Si sale ahora, ' + (n === 1 ? 'esa foto no queda' : 'esas fotos no quedan') + ' en el informe. Espere a que termine la barra o salga igual.' }))) return;
    if (st.sucio && editable()) {
      const ok = await guardarAhora();
      if (!ok && !(await confirmar({ titulo: 'Hay cambios sin guardar', esc, boton: 'Salir igual', peligro: true, texto: 'No se pudieron guardar en la plataforma; quedan respaldados en este navegador. ¿Salir igual?' }))) return;
    }
    alVolver();
  }

  function alSalirDePagina(ev) {
    volcarFoco();
    const subiendo = fotos.pendientes() > 0;
    const sinGuardar = st.sucio && editable();
    if (!subiendo && !sinGuardar) return;
    if (sinGuardar) respaldar();
    ev.preventDefault();
    ev.returnValue = '';
  }
  window.addEventListener('beforeunload', alSalirDePagina);
  // En el celular el navegador puede cerrar la pestaña sin «beforeunload»: al irse a segundo plano se respalda y se guarda.
  function alOcultar() {
    if (document.visibilityState !== 'hidden') return;
    volcarFoco();
    if (st.sucio && editable()) { respaldar(); guardar(); }
  }
  document.addEventListener('visibilitychange', alOcultar);
  secEl.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el || !el.matches || !el.matches('input[data-ruta]:not([type="checkbox"]), textarea[data-texto-edicion], textarea[data-vineta-edicion], input[data-anexo-titulo]')) return;
    if (!st.escribiendo) { st.escribiendo = true; pintarGuardado(); }
  });
  // Salió del campo sin cambiar nada: ya no hay nada «escribiéndose».
  secEl.addEventListener('focusout', () => { if (st.escribiendo) { st.escribiendo = false; pintarGuardado(); } });

  /* ── todo ────────────────────────────────────────────────── */
  function pintarTodo() {
    pintarTitulo();
    pintarAcciones();
    pintarBandas();
    pintarFaltantes();
    pintarNav();
    pintarSeccion();
    pintarGuardado();
  }

  recalcular();
  pintarTodo();
  reloj = setInterval(() => { if (!st.guardando && !st.sucio) pintarGuardado(); }, 15000);

  return {
    /** La configuración cambió (logos, firmantes, editores): se recalcula y se redibuja. */
    refrescar() {
      recalcular();
      pintarTodo();
    },
    destruir() {
      volcarFoco();
      st.vivo = false;
      clearTimeout(temporizador);
      clearInterval(reloj);
      window.removeEventListener('beforeunload', alSalirDePagina);
      document.removeEventListener('visibilitychange', alOcultar);
      if (st.sucio && editable()) respaldar();
      fotos.destruir();
      if (vista) vista.destruir();
      cont.remove();
    },
    get estado() { return { id: st.id, rev: st.rev, sucio: st.sucio, estado: st.doc.estado, version: st.doc.version }; }
  };
}
