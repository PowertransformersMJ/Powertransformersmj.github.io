/* AQUA · Shell auto-inject — v3
 * Inyecta topbar + sidebar + escena en cualquier página que tenga
 * <body class="aqua"> y un <main class="app-main">.
 *
 * - Detecta la URL actual y marca .is-active en el sb-item correcto.
 * - Escucha sgm:session-ready / window.__sgmSession para mostrar
 *   chip de rol + iniciales + ocultar links admin a no-admins.
 * - Provee logout via assets/js/admin/admin-auth.js.
 * - ⌘K enfoca la búsqueda; Esc la limpia.
 *
 * Uso en cada página:
 *   <body class="aqua">
 *     <main class="app-main">…contenido…</main>
 *     <script src="assets/js/aqua-shell.js" defer></script>
 *
 * El shell lee <html data-aqua-base="…"> si está presente; de lo
 * contrario calcula la base a partir del pathname (ej. /pages/x.html
 * → base "../"; /home.html → "./").
 */
(function () {
  'use strict';

  if (window.__aquaShellInjected) return;
  window.__aquaShellInjected = true;

  // Si la página está embebida en un iframe (parte del refactor v2.3
  // de tabs), marcamos el body con .is-embedded y NO inyectamos
  // topbar/sidebar — el padre ya tiene su propio shell. Los estilos
  // de tabs.css ocultan los elementos correspondientes.
  let isEmbedded = false;
  try {
    if (window.self !== window.top) {
      isEmbedded = true;
      document.body.classList.add('is-embedded');
      return;
    }
  } catch (_) {
    // Cross-origin guard: si no podemos comparar, asumimos top y
    // continuamos con el shell normal.
  }

  const path = location.pathname;
  // Calcular base relativa: si estamos en /pages/foo.html o /admin/foo.html → "../"
  // Si /home.html o /index.html (raíz) → "./"
  let base = '';
  if (path.includes('/pages/') || path.includes('/admin/')) base = '../';
  else base = './';
  // Permitir override explícito
  const explicit = document.documentElement.getAttribute('data-aqua-base');
  if (explicit !== null) base = explicit;

  // R8 · Redirects de URLs legacy → módulo padre con tab activa.
  // Solo aplica cuando la página NO está embebida (top-level). Preserva
  // bookmarks viejos sin duplicar contenido.
  if (!isEmbedded) {
    const LEGACY_REDIRECTS = {
      // Contratos · v2.4: el módulo Suministros migró a vivir DENTRO
      // del contrato 4123000081 (único contrato actualmente registrado).
      '/pages/suministros.html':             'pages/contrato.html?id=4123000081#tab=dashboard',
      '/pages/suministros-dashboard.html':   'pages/contrato.html?id=4123000081#tab=dashboard',
      '/admin/suministros-catalogo.html':    'pages/contrato.html?id=4123000081#tab=catalogo',
      '/admin/suministros-movimiento.html':  'pages/contrato.html?id=4123000081#tab=movimiento',
      '/admin/suministros-historico.html':   'pages/contrato.html?id=4123000081#tab=historico',
      '/admin/importar-suministros.html':    'pages/contrato.html?id=4123000081#tab=importar',
      // Activos
      '/pages/inventario.html':              'pages/activos.html#tab=inventario',
      '/pages/mapa.html':                    'pages/activos.html#tab=mapa',
      '/admin/subestaciones.html':           'pages/activos.html#tab=subestaciones',
      '/admin/contratos.html':               'pages/activos.html#tab=contratos',
      // Salud
      '/pages/muestras.html':                'pages/salud.html#tab=muestras',
      '/admin/motor-salud.html':             'pages/salud.html#tab=motor',
      '/admin/propuestas-fur.html':          'pages/salud.html#tab=fur',
      '/admin/contramuestras.html':          'pages/salud.html#tab=contramuestras',
      '/admin/fallados.html':                'pages/salud.html#tab=fallados',
      '/pages/matriz-riesgo.html':           'pages/salud.html#tab=matriz',
      // Análisis
      '/pages/dashboard.html':               'pages/analisis.html#tab=dashboard',
      '/pages/kpis.html':                    'pages/analisis.html#tab=kpis',
      '/pages/alertas.html':                 'pages/analisis.html#tab=alertas',
      '/admin/plan-inversion.html':          'pages/analisis.html#tab=plan-inversion',
      '/admin/desempeno-aliados.html':       'pages/analisis.html#tab=desempeno',
      // Administración
      '/admin/index.html':                   'admin/administracion.html#tab=panel',
      '/admin/usuarios.html':                'admin/administracion.html#tab=usuarios',
      '/admin/catalogos.html':               'admin/administracion.html#tab=catalogos',
      '/admin/importar.html':                'admin/administracion.html#tab=importar',
      '/admin/auditoria.html':               'admin/administracion.html#tab=auditoria',
      // Recursos
      '/pages/documentos.html':              'pages/recursos.html#tab=documentos',
      '/pages/normativa.html':               'pages/recursos.html#tab=normativa',
      '/pages/cobertura.html':               'pages/recursos.html#tab=cobertura',
      '/pages/about.html':                   'pages/recursos.html#tab=about'
    };
    // Match contra el suffix del pathname (acepta cualquier prefijo de
    // base path, p.ej. /powertransformersmj.github.io/).
    const cleanPath = location.pathname;
    for (const [legacy, target] of Object.entries(LEGACY_REDIRECTS)) {
      if (cleanPath.endsWith(legacy)) {
        // Si el query/search trae ?legacy=keep, no redirigir (escape hatch).
        if (location.search && /[?&]legacy=keep\b/.test(location.search)) break;
        location.replace(base + target);
        return;
      }
    }
  }

  const u = (p) => base + p.replace(/^\/+/, '');

  /* ─── Escena de fondo (DOMINANTE: torre + cables + transformador) ── */
  function injectScene() {
    if (document.querySelector('.aqua-scene')) return;
    const frag = document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="aqua-scene" aria-hidden="true"></div>
      <div class="aqua-orb aqua-orb--blue" aria-hidden="true"></div>
      <div class="aqua-orb aqua-orb--cyan" aria-hidden="true"></div>
      <div class="aqua-orb aqua-orb--teal" aria-hidden="true"></div>
      <div class="aqua-power-scene" aria-hidden="true" style="background-image:url(${u('assets/img/aqua/substation-photo.webp')})"></div>
      <div class="aqua-particles" id="aquaParticles" aria-hidden="true"></div>`;
    while (wrap.firstChild) frag.appendChild(wrap.firstChild);
    document.body.insertBefore(frag, document.body.firstChild);
  }

  /* ─── Enlace «saltar al contenido» (accesibilidad) ───────
   * Solo `index.html` y `home.html` lo traían escrito a mano; las otras 62
   * páginas obligaban a tabular por toda la barra lateral antes de llegar al
   * contenido. Se inyecta aquí — el mismo sitio que ya pone barra y menú en
   * todas — para arreglarlo de una vez sin editar 62 archivos.
   *
   * Debe ser el PRIMER tabulable: se inserta al principio del <body> DESPUÉS
   * de la escena/topbar/sidebar (que también insertan al principio), de modo
   * que acabe delante de todos ellos.
   * Estilos: `.skip-link` en assets/css/aqua-components.css (oculto salvo
   * cuando tiene el foco). Si la página ya trae uno propio, no se duplica. */
  function injectSkipLink() {
    if (document.querySelector('.skip-link')) return;
    const main = document.querySelector('main.app-main') || document.querySelector('main');
    if (!main) return;
    // El destino necesita id y ser enfocable para que el salto mueva el foco
    // de verdad (no solo el scroll) en Safari/Chrome.
    if (!main.id) main.id = 'main';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    const a = document.createElement('a');
    a.className = 'skip-link';
    a.href = '#' + main.id;
    a.textContent = 'Saltar al contenido principal';
    a.addEventListener('click', () => {
      // Algunos navegadores no enfocan el destino de un ancla interna.
      if (typeof main.focus === 'function') main.focus();
    });
    document.body.insertBefore(a, document.body.firstChild);
  }

  /* ─── Topbar ────────────────────────────────────────────── */
  function injectTopbar() {
    if (document.querySelector('header.tb')) return;
    const tb = document.createElement('header');
    tb.className = 'tb';
    tb.innerHTML = `
      <div class="tb-lead">
        <button class="btn btn--ghost btn--icon tb-menu-btn" type="button" id="tbMenu"
                aria-controls="aquaSidebar" aria-expanded="false"
                title="Menú de navegación" aria-label="Abrir menú de navegación">
          <i data-lucide="menu"></i>
        </button>
        <a href="${u('home.html')}" class="tb-brand">
          <span class="logo"><i data-lucide="zap"></i></span>
          SGM · <span class="b">TRANSPOWER</span>
        </a>
      </div>
      <div class="tb-search">
        <i data-lucide="search"></i>
        <input type="search" id="tbSearch" placeholder="Buscar transformador, OT, subestación…" aria-label="Buscar"/>
        <kbd>⌘K</kbd>
      </div>
      <div class="tb-right">
        <span class="tb-role" id="tbRole" hidden></span>
        <button class="btn btn--ghost btn--icon" type="button" title="Notificaciones" aria-label="Notificaciones"><i data-lucide="bell"></i></button>
        <div class="tb-avatar" id="tbAvatar" title="Perfil">··</div>
        <button class="btn btn--ghost btn--icon" type="button" id="tbLogout" title="Cerrar sesión" aria-label="Cerrar sesión"><i data-lucide="log-out"></i></button>
      </div>`;
    document.body.insertBefore(tb, document.body.firstChild);
  }

  /* ─── Sidebar ───────────────────────────────────────────── */
  function injectSidebar() {
    if (document.querySelector('aside.sb')) return;
    const sb = document.createElement('aside');
    sb.className = 'sb';
    sb.id = 'aquaSidebar';
    // Enfocable por programa (no por tabulación) para poder mover el foco
    // dentro del cajón al abrirlo en tablet.
    sb.setAttribute('tabindex', '-1');
    sb.setAttribute('aria-label', 'Navegación principal');
    sb.innerHTML = `
      <a href="${u('home.html')}" class="sb-brand-head" aria-label="Inicio · SGM TRANSPOWER" style="text-decoration:none">
        <span class="logo"><i data-lucide="zap"></i></span>
        <div>
          <div class="title">SGM · <em>TRANSPOWER</em></div>
          <div class="sub">Liquid Glass</div>
        </div>
      </a>
      <div class="sb-group">
        <div class="sb-group-title">Parque</div>
        <a href="${u('home.html')}" class="sb-item" data-key="home"><span class="i"><i data-lucide="layout-dashboard"></i></span>Inicio</a>
        <a href="${u('pages/activos.html')}#tab=inventario" class="sb-item" data-key="activos" data-default-tab><span class="i"><i data-lucide="database"></i></span>Transformadores</a>
        <a href="${u('pages/activos.html')}#tab=mapa" class="sb-item" data-key="mapa"><span class="i"><i data-lucide="map"></i></span>Mapa</a>
        <a href="${u('pages/activos.html')}#tab=subestaciones" class="sb-item" data-key="subestaciones"><span class="i"><i data-lucide="factory"></i></span>Subestaciones</a>
        <a href="${u('pages/fichas-tecnicas.html')}" class="sb-item" data-key="fichas-tecnicas"><span class="i"><i data-lucide="file-spreadsheet"></i></span>Fichas Técnicas</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Diagnóstico</div>
        <a href="${u('pages/pruebas-electricas.html')}" class="sb-item" data-key="pruebas-electricas"><span class="i"><i data-lucide="gauge"></i></span>Pruebas Eléctricas</a>
        <a href="${u('pages/salud.html')}" class="sb-item" data-key="salud"><span class="i"><i data-lucide="heart-pulse"></i></span>Salud del Activo</a>
        <a href="${u('pages/salud.html')}#tab=muestras" class="sb-item" data-key="muestras"><span class="i"><i data-lucide="flask-conical"></i></span>Muestras</a>
        <a href="${u('pages/salud.html')}#tab=contramuestras" class="sb-item" data-key="contramuestras"><span class="i"><i data-lucide="test-tubes"></i></span>Contramuestras</a>
        <a href="${u('pages/salud.html')}#tab=fallados" class="sb-item" data-key="fallados"><span class="i"><i data-lucide="alert-triangle"></i></span>Fallados y RCA</a>
        <a href="${u('pages/salud.html')}#tab=matriz" class="sb-item" data-key="matriz-riesgo"><span class="i"><i data-lucide="grid-3x3"></i></span>Matriz de Riesgo</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Ejecución</div>
        <a href="${u('pages/ordenes.html')}" class="sb-item" data-key="ordenes"><span class="i"><i data-lucide="clipboard-list"></i></span>Órdenes</a>
        <a href="${u('pages/ordenes-materiales.html')}" class="sb-item" data-key="ordenes-materiales"><span class="i"><i data-lucide="package"></i></span>Órdenes de Materiales</a>
        <a href="${u('pages/mantenimiento-brigada.html')}" class="sb-item" data-key="mantenimiento-brigada"><span class="i"><i data-lucide="hard-hat"></i></span>Mantenimiento Brigada</a>
        <a href="${u('pages/seguimiento-operativo.html')}" class="sb-item" data-key="seguimiento"><span class="i"><i data-lucide="activity"></i></span>Seguimiento Operativo</a>
        <a href="${u('pages/seguimiento-cargabilidad.html')}" class="sb-item" data-key="cargabilidad"><span class="i"><i data-lucide="battery-charging"></i></span>Cargabilidad</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Análisis</div>
        <a href="${u('pages/analisis.html')}#tab=dashboard" class="sb-item" data-key="analisis" data-default-tab><span class="i"><i data-lucide="bar-chart-3"></i></span>Dashboard</a>
        <a href="${u('pages/analisis.html')}#tab=kpis" class="sb-item" data-key="kpis"><span class="i"><i data-lucide="target"></i></span>KPIs</a>
        <a href="${u('pages/analisis.html')}#tab=alertas" class="sb-item" data-key="alertas"><span class="i"><i data-lucide="bell-ring"></i></span>Alertas</a>
        <a href="${u('pages/indicadores-calidad.html')}" class="sb-item" data-key="calidad"><span class="i"><i data-lucide="trending-up"></i></span>Indicadores de Calidad</a>
        <a href="${u('pages/analisis.html')}#tab=desempeno" class="sb-item" data-key="desempeno-aliados"><span class="i"><i data-lucide="users"></i></span>Desempeño de Aliados</a>
        <a href="${u('pages/analisis.html')}#tab=plan-inversion" class="sb-item" data-key="plan-inversion"><span class="i"><i data-lucide="wallet"></i></span>Plan de Inversión</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Contratos</div>
        <div class="sb-tree" data-tree-key="contratos">
          <a href="${u('pages/contratos.html')}" class="sb-item sb-item-parent" data-key="contratos">
            <span class="i"><i data-lucide="file-text"></i></span>Contratos
            <button type="button" class="sb-caret" aria-label="Expandir Contratos" aria-expanded="true" data-tree-toggle-btn="contratos" data-tree-label="Contratos">
              <i data-lucide="chevron-down"></i>
            </button>
          </a>
          <div class="sb-children" data-tree-children="contratos">
            <div class="sb-tree sb-tree-nested" data-tree-key="cat-sum-tx">
              <button type="button" class="sb-item sb-item-child sb-item-category sb-item-toggle" data-key="cat-sum-tx" data-tree-toggle-btn="cat-sum-tx" data-tree-label="Suministro de Elementos y Accesorios para Transformadores de Potencia" aria-expanded="true" title="Suministro de Elementos y Accesorios para Transformadores de Potencia">
                <span class="sb-child-bullet" aria-hidden="true"></span>
                <span class="sb-cat-text">Suministro de Elementos y Accesorios para Transformadores de Potencia</span>
                <span class="sb-caret sb-caret-sm" aria-hidden="true">
                  <i data-lucide="chevron-down"></i>
                </span>
              </button>
              <div class="sb-children" data-tree-children="cat-sum-tx">
                <div class="sb-tree sb-tree-nested" data-tree-key="contrato-4123000081">
                  <button type="button" class="sb-item sb-item-grandchild sb-item-toggle" data-key="contrato-4123000081" data-tree-toggle-btn="contrato-4123000081" data-tree-label="Contrato 4123000081" aria-expanded="false">
                    <span class="sb-child-bullet" aria-hidden="true"></span>
                    <code class="sb-contrato-num">4123000081</code>
                    <span class="sb-caret sb-caret-sm" aria-hidden="true">
                      <i data-lucide="chevron-down"></i>
                    </span>
                  </button>
                  <div class="sb-children" data-tree-children="contrato-4123000081">
                    <a href="${u('pages/contrato.html')}?id=4123000081" class="sb-item sb-item-greatgrandchild" data-key="cgo-4123000081">
                      <span class="sb-child-bullet" aria-hidden="true"></span>
                      <span class="sb-section-text">Control y Gestión Operativa</span>
                    </a>
                    <a href="${u('pages/contrato-info.html')}?id=4123000081" class="sb-item sb-item-greatgrandchild" data-key="info-4123000081">
                      <span class="sb-child-bullet" aria-hidden="true"></span>
                      <span class="sb-section-text">Información Contractual</span>
                    </a>
                    <div class="sb-tree sb-tree-nested" data-tree-key="seguimiento-4123000081">
                      <button type="button" class="sb-item sb-item-greatgrandchild sb-item-toggle" data-key="seguimiento-4123000081" data-tree-toggle-btn="seguimiento-4123000081" data-tree-label="Seguimiento contractual del contrato 4123000081" aria-expanded="false">
                        <span class="sb-child-bullet" aria-hidden="true"></span>
                        <span class="sb-section-text">Seguimiento Contractual</span>
                        <span class="sb-caret sb-caret-sm" aria-hidden="true">
                          <i data-lucide="chevron-down"></i>
                        </span>
                      </button>
                      <div class="sb-children" data-tree-children="seguimiento-4123000081">
                        <a href="${u('pages/contrato-info.html')}?id=4123000081&tipo=remisiones" class="sb-item sb-item-leaf" data-key="rem-4123000081">
                          <span class="sb-leaf-bullet" aria-hidden="true"></span>
                          <span class="sb-section-text">Remisiones</span>
                        </a>
                        <a href="${u('pages/contrato-info.html')}?id=4123000081&tipo=reuniones-seguimiento" class="sb-item sb-item-leaf" data-key="reu-4123000081">
                          <span class="sb-leaf-bullet" aria-hidden="true"></span>
                          <span class="sb-section-text">Reuniones de Seguimiento</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="sb-tree sb-tree-nested" data-tree-key="contrato-4125000143">
                  <button type="button" class="sb-item sb-item-grandchild sb-item-toggle" data-key="contrato-4125000143" data-tree-toggle-btn="contrato-4125000143" data-tree-label="Contrato 4125000143" aria-expanded="false">
                    <span class="sb-child-bullet" aria-hidden="true"></span>
                    <code class="sb-contrato-num">4125000143</code>
                    <span class="sb-caret sb-caret-sm" aria-hidden="true">
                      <i data-lucide="chevron-down"></i>
                    </span>
                  </button>
                  <div class="sb-children" data-tree-children="contrato-4125000143">
                    <a href="${u('pages/contrato.html')}?id=4125000143" class="sb-item sb-item-greatgrandchild" data-key="cgo-4125000143">
                      <span class="sb-child-bullet" aria-hidden="true"></span>
                      <span class="sb-section-text">Control y Gestión Operativa</span>
                    </a>
                    <a href="${u('pages/contrato-info.html')}?id=4125000143" class="sb-item sb-item-greatgrandchild" data-key="info-4125000143">
                      <span class="sb-child-bullet" aria-hidden="true"></span>
                      <span class="sb-section-text">Información Contractual</span>
                    </a>
                    <div class="sb-tree sb-tree-nested" data-tree-key="seguimiento-4125000143">
                      <button type="button" class="sb-item sb-item-greatgrandchild sb-item-toggle" data-key="seguimiento-4125000143" data-tree-toggle-btn="seguimiento-4125000143" data-tree-label="Seguimiento contractual del contrato 4125000143" aria-expanded="false">
                        <span class="sb-child-bullet" aria-hidden="true"></span>
                        <span class="sb-section-text">Seguimiento Contractual</span>
                        <span class="sb-caret sb-caret-sm" aria-hidden="true">
                          <i data-lucide="chevron-down"></i>
                        </span>
                      </button>
                      <div class="sb-children" data-tree-children="seguimiento-4125000143">
                        <a href="${u('pages/contrato-info.html')}?id=4125000143&tipo=remisiones" class="sb-item sb-item-leaf" data-key="rem-4125000143">
                          <span class="sb-leaf-bullet" aria-hidden="true"></span>
                          <span class="sb-section-text">Remisiones</span>
                        </a>
                        <a href="${u('pages/contrato-info.html')}?id=4125000143&tipo=reuniones-seguimiento" class="sb-item sb-item-leaf" data-key="reu-4125000143">
                          <span class="sb-leaf-bullet" aria-hidden="true"></span>
                          <span class="sb-section-text">Reuniones de Seguimiento</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Recursos</div>
        <a href="${u('pages/recursos.html')}#tab=documentos" class="sb-item" data-key="recursos" data-default-tab><span class="i"><i data-lucide="folder-open"></i></span>Documentos</a>
        <a href="${u('pages/recursos.html')}#tab=normativa" class="sb-item" data-key="normativa"><span class="i"><i data-lucide="book-open"></i></span>Normativa</a>
        <a href="${u('pages/recursos.html')}#tab=cobertura" class="sb-item" data-key="cobertura"><span class="i"><i data-lucide="map-pinned"></i></span>Cobertura</a>
        <a href="${u('pages/contacto.html')}" class="sb-item" data-key="contacto"><span class="i"><i data-lucide="mail"></i></span>Contacto</a>
        <a href="${u('pages/recursos.html')}#tab=about" class="sb-item" data-key="about"><span class="i"><i data-lucide="info"></i></span>Acerca de</a>
      </div>
      <div class="sb-group sb-admin-group" hidden>
        <div class="sb-group-title">Administración</div>
        <a href="${u('admin/administracion.html')}#tab=panel" class="sb-item sb-admin" data-key="administracion" data-default-tab><span class="i"><i data-lucide="settings"></i></span>Panel</a>
        <a href="${u('admin/administracion.html')}#tab=usuarios" class="sb-item sb-admin" data-key="usuarios"><span class="i"><i data-lucide="users-round"></i></span>Usuarios</a>
        <a href="${u('admin/administracion.html')}#tab=catalogos" class="sb-item sb-admin" data-key="catalogos"><span class="i"><i data-lucide="list"></i></span>Catálogos</a>
        <a href="${u('admin/administracion.html')}#tab=importar" class="sb-item sb-admin" data-key="importar"><span class="i"><i data-lucide="upload"></i></span>Importar</a>
        <a href="${u('admin/administracion.html')}#tab=auditoria" class="sb-item sb-admin" data-key="auditoria"><span class="i"><i data-lucide="scroll-text"></i></span>Auditoría</a>
        <a href="${u('admin/umbrales-salud.html')}" class="sb-item sb-admin" data-key="umbrales-salud"><span class="i"><i data-lucide="sliders-horizontal"></i></span>Umbrales de Salud</a>
        <a href="${u('admin/migrate-contrato-id.html')}" class="sb-item sb-admin" data-key="migrate-contrato-id" title="Acceso temporal · retirar después de ejecutar la migración"><span class="i"><i data-lucide="database-zap"></i></span>Migrar contrato_id</a>
      </div>`;

    const main = document.querySelector('main.app-main') || document.querySelector('main');
    if (main && main.parentNode) main.parentNode.insertBefore(sb, main);
    else document.body.insertBefore(sb, document.body.firstChild);
  }

  /* ─── Active state según URL ────────────────────────────── */
  function markActive() {
    const fileNow = (path.split('/').pop() || 'home.html').replace(/\?.*$/, '');
    const folderNow = path.includes('/admin/') ? 'admin' : (path.includes('/pages/') ? 'pages' : '');
    const queryNow = location.search || '';
    const qsNow = new URLSearchParams(queryNow);
    const idNow = qsNow.get('id');
    const tipoNow = (qsNow.get('tipo') || '').trim();
    const hashNow = location.hash || '';
    const tabNow = hashNow ? new URLSearchParams(hashNow.replace(/^#/, '')).get('tab') : null;

    // Items candidatos que matchean filename + ?id= (+ ?tipo= si aplica)
    const candidates = [];
    document.querySelectorAll('.sb-item').forEach((a) => {
      const href = a.getAttribute && a.getAttribute('href');
      if (!href) return;
      try {
        const [pathPart, queryAndHash = ''] = href.split('?');
        const [queryPart = '', hashPart = ''] = queryAndHash.split('#');
        const last = pathPart.split('/').pop() || '';
        const folder = pathPart.includes('admin/') ? 'admin' : (pathPart.includes('pages/') ? 'pages' : '');
        if (last !== fileNow || folder !== folderNow) return;
        const qs = queryPart ? new URLSearchParams('?' + queryPart) : new URLSearchParams();
        const idLink = qs.get('id');
        if (idLink && idNow && idLink !== idNow) return;
        if (idLink && !idNow) return;
        const tipoLink = (qs.get('tipo') || '').trim();
        // Si la URL actual tiene tipo=X, solo aceptamos links con mismo tipo.
        // Si la URL actual NO tiene tipo, solo aceptamos links sin tipo.
        if (tipoNow !== tipoLink) return;
        const tabLink = hashPart ? new URLSearchParams(hashPart).get('tab') : null;
        candidates.push({ a, idLink, tabLink, tipoLink });
      } catch (_) {}
    });

    // Política de match: si la URL actual tiene #tab=X, solo el item con
    // tabLink === X gana. Si no hay #tab, gana el item SIN tabLink (el
    // link "raíz" del contrato / página). Esto evita que múltiples
    // items con mismo ?id= se marquen activos a la vez.
    let winner = null;
    if (tabNow) {
      winner = candidates.find((c) => c.tabLink === tabNow);
    } else {
      winner = candidates.find((c) => !c.tabLink);
    }
    // Fallback: si no hubo match exacto, marcar el primero que matchee
    // por id (compatibilidad con páginas sin tabs).
    if (!winner && candidates.length === 1) winner = candidates[0];

    if (!winner) return;
    winner.a.classList.add('is-active');
    // Expandir TODA la cadena de árboles ancestros para que el item
    // activo sea visible (5 niveles posibles: contratos → categoría →
    // número de contrato → sección → leaf).
    let node = winner.a.parentElement;
    while (node) {
      if (node.classList && node.classList.contains('sb-tree')) {
        node.classList.add('is-expanded');
        const btn = node.querySelector(':scope > .sb-item .sb-caret, :scope > .sb-children .sb-caret');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }
      node = node.parentElement;
    }
  }

  /* ─── Tree toggle (sidebar expandible) ──────────────────── */
  function bindTreeToggle() {
    // Estado inicial respeta el aria-expanded del botón caret.
    // Si no hay caret, default a expandido (compat con árboles legacy
    // sin botón de toggle).
    document.querySelectorAll('.sb-tree').forEach((tree) => {
      if (tree.classList.contains('is-expanded')) return; // ya expandido por markActive
      const btn = tree.querySelector(':scope > .sb-item .sb-caret, :scope > [data-tree-toggle-btn]');
      const defaultExpanded = btn ? btn.getAttribute('aria-expanded') !== 'false' : true;
      if (defaultExpanded) tree.classList.add('is-expanded');
    });
    document.querySelectorAll('[data-tree-toggle-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = btn.getAttribute('data-tree-toggle-btn');
        const tree = document.querySelector(`.sb-tree[data-tree-key="${key}"]`);
        if (!tree) return;
        const expanded = tree.classList.toggle('is-expanded');
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.setAttribute('aria-label', (expanded ? 'Colapsar ' : 'Expandir ') + (tree.dataset.treeKey || ''));
      });
    });
  }

  /* ─── Sesión + roles ───────────────────────────────────── */
  function applySession(sess) {
    if (!sess) return;
    const profile = sess.profile || {};
    const role = sess.role || profile.rol || 'tecnico';
    const name = profile.nombre || sess.user?.email || '··';
    const initials = (name || '').split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '··';
    const av = document.getElementById('tbAvatar');
    if (av) { av.textContent = initials; av.title = name; }
    const rch = document.getElementById('tbRole');
    if (rch) {
      rch.hidden = false;
      rch.textContent = role === 'admin' ? 'ADMIN' : role.toUpperCase().slice(0, 8);
    }
    if (role === 'admin') {
      document.querySelectorAll('.sb-admin-group').forEach((el) => el.hidden = false);
    } else {
      document.querySelectorAll('.sb-admin').forEach((el) => el.style.display = 'none');
    }
  }

  /* ─── Logout ───────────────────────────────────────────── */
  async function bindLogout() {
    const btn = document.getElementById('tbLogout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        const mod = await import(u('assets/js/admin/admin-auth.js'));
        if (mod && mod.logoutAdmin) await mod.logoutAdmin();
      } catch (_) {
        try {
          const fb = await import(u('assets/js/firebase-init.js'));
          const { signOut } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
          const auth = fb.getAuthSafe?.();
          if (auth) await signOut(auth);
        } catch (_) {}
      }
      location.replace(u('index.html'));
    });
  }

  /* ─── ⌘K shortcut ──────────────────────────────────────── */
  function bindKeys() {
    const search = document.getElementById('tbSearch');
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === search) {
        search.blur(); search.value = '';
      }
    });
  }

  /* ─── Init ─────────────────────────────────────────────── */
  function init() {
    if (!document.body.classList.contains('aqua')) return;
    injectScene();
    injectTopbar();
    injectSidebar();
    injectSkipLink();   // el ÚLTIMO que inserta al principio del <body> → queda primero
    markActive();
    bindTreeToggle();
    bindLogout();
    bindKeys();

    // Re-render iconos Lucide (puede estar disponible vía CDN cargado en defer)
    const tryIcons = () => {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons(); } catch (_) {}
      } else { setTimeout(tryIcons, 80); }
    };
    tryIcons();

    // Aqua interactions (particles + glint + scroll + reveal)
    if (window.Aqua && typeof window.Aqua.init === 'function') {
      window.Aqua.init();
    }

    // Sesión
    if (window.__sgmSession) applySession(window.__sgmSession);
    window.addEventListener('sgm:session-ready', (ev) => applySession(ev.detail));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
