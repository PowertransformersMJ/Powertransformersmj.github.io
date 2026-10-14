// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · ARRANQUE de la pantalla
// ──────────────────────────────────────────────────────────────
// `pages/informe-brigada.html` lo carga con import() (L-102). Aquí se decide:
//   · el MODO: «nube» (Firestore + Storage, si las reglas ya lo admiten) o
//     «local» (memoria + localStorage, cero escrituras a la plataforma);
//   · quién ARMA (editores por uid en la configuración, decisión 3) y quién solo mira;
//   · qué se ve: el listado del parque, la ventana del equipo y el editor.
//
// Los módulos de los otros frentes (dominio, Word, datos) se cargan por
// import() y por ESPACIO DE NOMBRES (L-102.5): si a uno le falta una función,
// se avisa en vez de tumbar la página.
// ══════════════════════════════════════════════════════════════

import { montarListado } from './listado.js';
import { abrirSelector } from './selector.js';
import { montarEditor } from './editor.js';
import { montarConfiguracion } from './configuracion.js';

/** Al publicar se cambia a 'publicado' y la franja de vista previa se va. */
export const ESTADO_SEGMENTO = 'publicado';

const LIMITE_PARQUE_POR_DEFECTO = 500;

/* ── Sesión ─────────────────────────────────────────────────────────────── */

function esperarSesion(ms = 30000) {
  if (window.__sgmSession) return Promise.resolve(window.__sgmSession);
  return new Promise((res) => {
    const t = setTimeout(() => res(window.__sgmSession || null), ms);
    window.addEventListener('sgm:session-ready', () => { clearTimeout(t); res(window.__sgmSession || null); }, { once: true });
  });
}

function datosSesion(s) {
  const perfil = (s && s.profile) || {};
  return {
    uid: (s && s.user && s.user.uid) || '',
    nombre: String(perfil.nombre || ''),
    rol: String(perfil.rol || (s && s.role) || ''),
    activo: perfil.activo !== false
  };
}

/* ── Dependencias de los otros frentes ──────────────────────────────────── */

const RUTA = {
  modelo: '../../domain/informe_brigada_modelo.js',
  plantilla: '../../domain/informe_brigada_plantilla.js',
  documento: '../../domain/informe_brigada_documento.js',
  formato: '../../domain/informe_brigada_formato.js',
  rutas: '../../domain/informe_brigada_rutas.js',
  listado: '../../domain/informe_brigada_listado.js',
  formulario: '../../domain/informe_brigada_formulario.js',
  limites: '../../domain/limites_lectura.js',
  schema: '../../domain/schema.js',
  almacen: '../../data/informes_brigada_almacen.js',
  local: '../../data/informes_brigada_local.js'   // sin Firebase: modo local y respaldo ante un choque
};

/** Carga el núcleo (sin él no hay pantalla). Los de imprimir, Word e imágenes se cargan al usarlos. */
async function cargarDependencias() {
  const claves = Object.keys(RUTA);
  const mods = await Promise.all(claves.map((k) => import(RUTA[k])));
  const dep = {};
  claves.forEach((k, i) => { dep[k] = mods[i]; });
  // Perezosos: se piden al usarlos (imprimir, Word, reducir fotos).
  const cache = new Map();
  const PEREZOSOS = {
    papel: './papel.js',
    word: './exportar-word.js',
    imagenes: './imagenes.js'
  };
  dep.cargar = (k) => {
    if (!PEREZOSOS[k]) return Promise.reject(new Error('módulo desconocido: ' + k));
    if (!cache.has(k)) {
      const p = import(PEREZOSOS[k]);
      p.catch(() => cache.delete(k));   // un fallo de red no queda pegado: se reintenta al próximo uso
      cache.set(k, p);
    }
    return cache.get(k);
  };
  const faltan = [];
  const exige = (mod, nombres, etiqueta) => { for (const n of nombres) if (typeof dep[mod][n] === 'undefined') faltan.push(etiqueta + '.' + n); };
  exige('modelo', ['equipoDesdeInventario', 'prellenar', 'cambiarCampo', 'estadoCampo', 'faltantes', 'esEditor'], 'modelo');
  exige('plantilla', ['ACTIVIDADES', 'ACTIVIDAD_REFRIGERACION', 'modeloDeActividad', 'MARCA_CLAVES'], 'plantilla');
  exige('documento', ['construirDocumento', 'refsDelDocumento'], 'documento');
  exige('almacen', ['crearAlmacen', 'resolverUrls'], 'almacen');
  if (faltan.length) throw new Error('Faltan piezas del módulo (' + faltan.join(', ') + '). Recargue con Cmd + Shift + R.');
  return dep;
}

function pedidoLocal() {
  try { return new URLSearchParams(location.search).get('local') === '1'; } catch (_) { return false; }
}

/** Configuración vacía (la que ve el administrador antes de la primera vez). */
function configVacia(claves) {
  const marca = {};
  for (const k of (claves || [])) marca[k] = null;
  return { editores: [], contrato_defecto: '', almacen: 'firestore', firmantes: [], marca };
}

/**
 * Decide el modo. Nube si las reglas ya admiten la colección (`ok` o `sin_config`).
 * Local SOLO si se pidió (`?local=1`) o si la plataforma responde «sin permiso» mientras el
 * segmento está en VISTA PREVIA (reglas aún no publicadas). Un error pasajero (sin señal, la
 * plataforma caída) NO manda a modo local: ahí se armaría un informe que no se guarda y cuyas
 * fotos se pierden al recargar. Se responde `sin_conexion` y la pantalla ofrece «Reintentar».
 */
async function elegirModo(dep, forzarLocal, opcionesRepo, estadoSegmento = ESTADO_SEGMENTO) {
  let motivo = forzarLocal ? 'pedido' : '';
  if (!forzarLocal) {
    let detalle = '';
    try {
      const nube = await import('../../data/informes_brigada.js');
      const repo = nube.crearRepositorio(opcionesRepo);
      const r = await repo.leerConfig();
      if (r && (r.estado === 'ok' || r.estado === 'sin_config')) {
        return { modo: 'nube', repo, config: r.config || null, estadoConfig: r.estado, motivo: '' };
      }
      motivo = r && r.estado === 'sin_permiso' ? 'sin_permiso' : 'error';
      if (r && r.error) { detalle = String(r.error); console.warn('[informe-brigada] configuración:', r.error); }
    } catch (err) {
      motivo = 'error';
      detalle = String((err && err.message) || err);
      console.warn('[informe-brigada] no se pudo usar la plataforma:', err);
    }
    if (!(motivo === 'sin_permiso' && estadoSegmento === 'vista_previa')) {
      return { modo: 'sin_conexion', repo: null, config: null, estadoConfig: 'error', motivo, detalle };
    }
  }
  const repo = dep.local.crearRepositorio(opcionesRepo);
  const r = await repo.leerConfig();
  return { modo: 'local', repo, config: (r && r.config) || null, estadoConfig: (r && r.estado) || 'ok', motivo };
}

/* ── Franja de estado ───────────────────────────────────────────────────── */

function pintarFranja(franja, ctx, escapar) {
  if (!franja) return;
  const partes = [];
  if (ESTADO_SEGMENTO === 'vista_previa') {
    partes.push('<div class="ibr-franja-fila ibr-franja--previa"><b>VISTA PREVIA · sin publicar</b>'
      + '<span>Esta página todavía no está en el menú: sirve para revisar el segmento antes de publicarlo.</span></div>');
  }
  if (ctx.modo === 'local') {
    const porque = ctx.motivo === 'sin_permiso'
      ? 'La plataforma todavía no acepta guardar estos informes (falta publicar sus reglas).'
      : ctx.motivo === 'pedido' ? 'Se pidió trabajar en modo local.'
        : ctx.motivo === 'error' ? 'No se pudo conectar con la plataforma para guardar informes.' : '';
    partes.push('<div class="ibr-franja-fila ibr-franja--local"><b>Modo local</b>'
      + '<span>Lo que arme aquí vive solo en este navegador; no se guarda en la plataforma. '
      + 'Las fotos viven mientras la página esté abierta: al recargar se pierden. ' + escapar(porque)
      + (ctx.repo && ctx.repo.persistente === false ? ' Este navegador no deja guardar: lo armado se pierde al recargar.' : '')
      + '</span></div>');
  } else if (ctx.estadoConfig === 'sin_config') {
    partes.push('<div class="ibr-franja-fila ibr-franja--aviso"><b>Falta la configuración</b>'
      + '<span>' + (ctx.esAdmin
        ? 'Como administrador, defina abajo quiénes arman el informe, el contrato y los logos.'
        : 'Falta que un administrador configure el informe. Mientras tanto, solo lectura.') + '</span></div>');
  } else if (!ctx.puedeEditar) {
    partes.push('<div class="ibr-franja-fila ibr-franja--info"><b>Solo lectura</b>'
      + '<span>Usted puede ver los informes; los arman solo las personas que el administrador habilitó.</span></div>');
  }
  franja.innerHTML = partes.join('');
  franja.hidden = !partes.length;
}

/** Sin plataforma (y fuera de la vista previa sin reglas): NO se arma nada a ciegas; se ofrece reintentar. */
function pintarSinConexion(raiz, franja, elegido, escapar) {
  pintarFranja(franja, { modo: 'nube', estadoConfig: 'ok', puedeEditar: true }, escapar);   // solo la franja de vista previa (si aplica)
  const sinPermiso = elegido.motivo === 'sin_permiso';
  raiz.classList.add('ibr-raiz');
  raiz.innerHTML = '<div class="ibr-banda ibr-banda--mal" role="alert">'
    + (sinPermiso
      ? '<b>Sin permiso para los informes.</b> La plataforma no deja leer la configuración del informe con esta cuenta. Si cree que es un error, avise a un administrador.'
      : '<b>No se pudo conectar con la plataforma.</b> No se arma nada sin conexión: lo armado se perdería. Revise la red y reintente.')
    + ' <button type="button" class="ibr-btn" data-ibr="reintentar">Reintentar</button></div>';
  const b = raiz.querySelector('[data-ibr="reintentar"]');
  if (b) b.addEventListener('click', () => location.reload());
  return { ctx: null, sinConexion: true, motivo: elegido.motivo };
}

/* ── Montaje ────────────────────────────────────────────────────────────── */

/**
 * @param {HTMLElement} raiz
 * @param {{ fuente: () => Promise<object[]>, forzarLocal?: boolean, opcionesRepo?: object }} opciones
 *   `opcionesRepo` se pasa al repositorio (p. ej. un `lectorAcciones` de prueba en el banco).
 */
export async function montarInformeBrigada(raiz, { fuente, forzarLocal = false, opcionesRepo = {} } = {}) {
  if (!raiz) throw new Error('Falta el contenedor del módulo.');
  let franja = document.getElementById('ibrFranja');
  if (!franja) {
    franja = document.createElement('div');
    franja.className = 'ibr-franja';
    franja.setAttribute('role', 'status');
    raiz.before(franja);
  }

  const sesion = await esperarSesion();
  const usuario = datosSesion(sesion);
  const dep = await cargarDependencias();
  const F = dep.formulario;
  const esc = F.escaparHtml;
  const elegido = await elegirModo(dep, forzarLocal || pedidoLocal(), opcionesRepo);
  if (elegido.modo === 'sin_conexion') return pintarSinConexion(raiz, franja, elegido, esc);

  const esAdmin = usuario.rol === 'admin' && usuario.activo;
  const claves = dep.plantilla.MARCA_CLAVES || [];
  const ctx = {
    dep, usuario, esAdmin,
    modo: elegido.modo, motivo: elegido.motivo, estadoConfig: elegido.estadoConfig,
    repo: elegido.repo,
    config: elegido.config || null,
    almacen: null,
    puedeEditar: false,
    autor() { return { uid: usuario.uid, nombre: usuario.nombre }; },
    avisar: () => {},
    resolverUrls: null,
    resolverBytes: null
  };

  // Arma quien está en la lista de editores (decisión 3), también en modo local: el repositorio
  // local exige lo mismo (si no hay configuración guardada, la de prueba pone a quien tiene la sesión).
  ctx.recalcularPermisos = () => {
    ctx.puedeEditar = !!(ctx.config && usuario.activo && dep.modelo.esEditor(ctx.config, usuario.uid));
  };
  ctx.recalcularPermisos();

  const modoAlmacen = ctx.modo === 'local' ? 'local' : ((ctx.config && ctx.config.almacen) || 'firestore');
  ctx.almacen = dep.almacen.crearAlmacen({ modo: modoAlmacen });
  const opcionesResolver = (o = {}) => ({ ...o, config: ctx.config });
  ctx.resolverUrls = (refs, o) => dep.almacen.resolverUrls(refs, opcionesResolver(o));
  ctx.resolverBytes = (refs, o) => (typeof dep.almacen.resolverBytes === 'function'
    ? dep.almacen.resolverBytes(refs, opcionesResolver(o))
    : Promise.reject(new Error('El almacén no sabe leer bytes todavía.')));

  /* armazón */
  raiz.classList.add('ibr-raiz');
  raiz.innerHTML = ''
    + '<div class="ibr-avisos" data-ibr="avisos" role="status" aria-live="polite"></div>'
    + '<div class="ibr-barra-modo" data-ibr="barra"></div>'
    + '<details class="ibr-config" data-ibr="config-caja" hidden>'
    +   '<summary>Configuración del informe · solo administrador</summary>'
    +   '<div data-ibr="config"></div>'
    + '</details>'
    + '<section data-ibr="listado" aria-label="Parque de transformadores"></section>'
    + '<section data-ibr="editor" hidden aria-label="Informe abierto"></section>';
  const $ = (s) => raiz.querySelector('[data-ibr="' + s + '"]');
  const cajaAvisos = $('avisos');

  /** Aviso flotante. `clave`: uno solo por clave (el nuevo reemplaza al anterior). Los que no se van solos llevan ✕. */
  ctx.avisar = (texto, tipo = 'info', ms = 7000, { clave = '' } = {}) => {
    if (clave) cajaAvisos.querySelectorAll('[data-clave-aviso]').forEach((x) => { if (x.getAttribute('data-clave-aviso') === clave) x.remove(); });
    const d = document.createElement('div');
    d.className = 'ibr-aviso ibr-aviso--' + tipo;
    if (clave) d.setAttribute('data-clave-aviso', clave);
    const t = document.createElement('span');
    t.textContent = texto;
    d.appendChild(t);
    if (!(ms > 0)) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'ibr-aviso-cerrar';
      x.setAttribute('aria-label', 'Cerrar aviso');
      x.textContent = '✕';
      x.addEventListener('click', () => d.remove());
      d.appendChild(x);
    }
    cajaAvisos.appendChild(d);
    if (ms > 0) setTimeout(() => d.remove(), ms);
    return d;
  };
  ctx.quitarAviso = (clave) => { cajaAvisos.querySelectorAll('[data-clave-aviso]').forEach((x) => { if (x.getAttribute('data-clave-aviso') === clave) x.remove(); }); };

  const pintarBarra = () => {
    const chipModo = ctx.modo === 'local'
      ? '<span class="chip chip--warn">Modo local · solo este navegador</span>'
      : '<span class="chip chip--brand">Plataforma · ' + esc((ctx.config && ctx.config.almacen) || 'firestore') + '</span>';
    const chipRol = ctx.puedeEditar
      ? '<span class="chip chip--success">Usted arma informes</span>'
      : '<span class="chip">Solo lectura</span>';
    $('barra').innerHTML = chipModo + ' ' + chipRol
      + '<span class="ibr-barra-quien">' + esc(usuario.nombre || 'Sin nombre de perfil') + '</span>';
  };
  pintarFranja(franja, ctx, esc);
  pintarBarra();

  /**
   * La configuración cambió (la guardó el administrador o se releyó antes de emitir): permisos,
   * almacén de las subidas (si el admin pasó a Firestore como contingencia, las fotos siguientes
   * van allá sin recargar), franja, barra, listado y el informe abierto.
   */
  ctx.actualizarConfig = (nueva, { refrescarEditor = false } = {}) => {
    if (!nueva) return;
    ctx.config = nueva;
    ctx.estadoConfig = 'ok';
    ctx.recalcularPermisos();
    const modo = ctx.modo === 'local' ? 'local' : (nueva.almacen || 'firestore');
    if (!ctx.almacen || ctx.almacen.modo !== modo) ctx.almacen = dep.almacen.crearAlmacen({ modo });
    pintarFranja(franja, ctx, esc);
    pintarBarra();
    if (listado) listado.refrescarPermisos();
    // El informe abierto vuelve a mirar logos, firmantes y permisos con la configuración nueva.
    if (refrescarEditor && editorActual && typeof editorActual.refrescar === 'function') editorActual.refrescar();
  };

  /* configuración (solo administrador) */
  let panelConfig = null;
  let listado = null;
  let editorActual = null;
  if (esAdmin) {
    const caja = $('config-caja');
    caja.hidden = false;
    if (ctx.estadoConfig === 'sin_config') caja.open = true;
    panelConfig = montarConfiguracion($('config'), {
      ctx,
      configInicial: ctx.config || configVacia(claves),
      alGuardar(nueva) { ctx.actualizarConfig(nueva, { refrescarEditor: true }); }
    });
    caja.addEventListener('toggle', () => { if (caja.open && panelConfig) panelConfig.alAbrir(); });
  }

  /* listado */
  listado = montarListado($('listado'), {
    ctx,
    alPedirInforme(equipo) { abrirVentanaEquipo(equipo); },
    alAbrirInforme(id) { abrirInforme(id); }
  });

  function mostrarListado() {
    if (editorActual) { editorActual.destruir(); editorActual = null; }
    $('editor').hidden = true;
    $('editor').innerHTML = '';
    $('listado').hidden = false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* sin historial: nada */ }
    listado.refrescarConteo();
  }

  async function abrirInforme(id) {
    let doc = null;
    try { doc = await ctx.repo.obtener(id); }
    catch (err) { ctx.avisar('No se pudo abrir el informe: ' + ((err && err.message) || err), 'error'); return; }
    if (!doc) { ctx.avisar('Ese informe ya no existe (o no está en este navegador).', 'aviso'); mostrarListado(); return; }
    if (editorActual) editorActual.destruir();
    $('listado').hidden = true;
    const cont = $('editor');
    cont.hidden = false;
    try { history.replaceState(null, '', location.pathname + location.search + '#informe=' + encodeURIComponent(id)); } catch (_) { /* nada */ }
    editorActual = montarEditor(cont, { ctx, informe: doc, alVolver: mostrarListado });
    window.scrollTo({ top: 0 });
  }

  function abrirVentanaEquipo(equipo) {
    abrirSelector({
      ctx, equipo,
      alAbrir: (id) => abrirInforme(id),
      alCrear: (doc) => { listado.refrescarConteo(); abrirInforme(doc.id); }
    });
  }

  /* datos del parque */
  const limite = Number(dep.limites.LIMITE_TRANSFORMADORES) || LIMITE_PARQUE_POR_DEFECTO;
  listado.cargando();
  try {
    const docs = typeof fuente === 'function' ? await fuente() : [];
    const equipos = (Array.isArray(docs) ? docs : []).map((tx) => {
      try { return dep.modelo.equipoDesdeInventario(tx); }
      catch (err) { console.warn('[informe-brigada] equipo ilegible:', tx && tx.id, err); return null; }
    }).filter(Boolean);
    listado.fijarEquipos(equipos, { origen: 'Parque vivo', limite, recibidos: (docs || []).length });
  } catch (err) {
    console.error('[informe-brigada] no se pudo leer el parque:', err);
    listado.error('No se pudo leer el parque de transformadores: ' + ((err && err.message) || err)
      + '. No se muestra nada inventado; recargue cuando vuelva la conexión.');
  }
  listado.refrescarConteo();

  /* ¿venía un informe abierto en la dirección? (recargar no lo cierra) */
  const m = /#informe=([^&]+)/.exec(location.hash || '');
  if (m) abrirInforme(decodeURIComponent(m[1]));

  return {
    ctx,
    abrirInforme,
    mostrarListado,
    recargarListado: () => listado.refrescarConteo()
  };
}
