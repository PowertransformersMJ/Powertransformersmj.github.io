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

  /* ─── Topbar ────────────────────────────────────────────── */
  function injectTopbar() {
    if (document.querySelector('header.tb')) return;
    const tb = document.createElement('header');
    tb.className = 'tb';
    tb.innerHTML = `
      <a href="${u('home.html')}" class="tb-brand">
        <span class="logo"><i data-lucide="zap"></i></span>
        SGM · <span class="b">TRANSPOWER</span>
      </a>
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
    sb.innerHTML = `
      <a href="${u('home.html')}" class="sb-brand-head" aria-label="Inicio · SGM TRANSPOWER" style="text-decoration:none">
        <span class="logo"><i data-lucide="zap"></i></span>
        <div>
          <div class="title">SGM · <em>TRANSPOWER</em></div>
          <div class="sub">Liquid Glass</div>
        </div>
      </a>
      <div class="sb-group">
        <div class="sb-group-title">Operación</div>
        <a href="${u('home.html')}" class="sb-item" data-key="home"><span class="i"><i data-lucide="layout-dashboard"></i></span>Inicio</a>
        <a href="${u('pages/activos.html')}" class="sb-item" data-key="activos"><span class="i"><i data-lucide="database"></i></span>Salud de Activos</a>
        <a href="${u('pages/seguimiento-operativo.html')}" class="sb-item" data-key="seguimiento"><span class="i"><i data-lucide="activity"></i></span>Seguimiento Operativo</a>
        <a href="${u('pages/ordenes.html')}" class="sb-item" data-key="ordenes"><span class="i"><i data-lucide="clipboard-list"></i></span>Órdenes</a>
        <a href="${u('pages/mantenimiento-brigada.html')}" class="sb-item" data-key="mantenimiento-brigada"><span class="i"><i data-lucide="hard-hat"></i></span>Mantenimiento Brigada</a>
        <div class="sb-tree" data-tree-key="contratos">
          <a href="${u('pages/contratos.html')}" class="sb-item sb-item-parent" data-key="contratos">
            <span class="i"><i data-lucide="file-text"></i></span>Contratos
            <button type="button" class="sb-caret" aria-label="Expandir Contratos" aria-expanded="true" data-tree-toggle-btn="contratos">
              <i data-lucide="chevron-down"></i>
            </button>
          </a>
          <div class="sb-children" data-tree-children="contratos">
            <div class="sb-tree sb-tree-nested" data-tree-key="cat-sum-tx">
              <button type="button" class="sb-item sb-item-child sb-item-category sb-item-toggle" data-key="cat-sum-tx" data-tree-toggle-btn="cat-sum-tx" aria-expanded="true" title="Suministro de Elementos y Accesorios para Transformadores de Potencia">
                <span class="sb-child-bullet" aria-hidden="true"></span>
                <span class="sb-cat-text">Suministro de Elementos y Accesorios para Transformadores de Potencia</span>
                <span class="sb-caret sb-caret-sm" aria-hidden="true">
                  <i data-lucide="chevron-down"></i>
                </span>
              </button>
              <div class="sb-children" data-tree-children="cat-sum-tx">
                <div class="sb-tree sb-tree-nested" data-tree-key="contrato-4123000081">
                  <button type="button" class="sb-item sb-item-grandchild sb-item-toggle" data-key="contrato-4123000081" data-tree-toggle-btn="contrato-4123000081" aria-expanded="false">
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
                      <button type="button" class="sb-item sb-item-greatgrandchild sb-item-toggle" data-key="seguimiento-4123000081" data-tree-toggle-btn="seguimiento-4123000081" aria-expanded="false">
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
                  <button type="button" class="sb-item sb-item-grandchild sb-item-toggle" data-key="contrato-4125000143" data-tree-toggle-btn="contrato-4125000143" aria-expanded="false">
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
                      <button type="button" class="sb-item sb-item-greatgrandchild sb-item-toggle" data-key="seguimiento-4125000143" data-tree-toggle-btn="seguimiento-4125000143" aria-expanded="false">
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
        <div class="sb-group-title">Análisis</div>
        <a href="${u('pages/analisis.html')}" class="sb-item" data-key="analisis"><span class="i"><i data-lucide="bar-chart-3"></i></span>Análisis e Indicadores</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Salud del activo</div>
        <a href="${u('pages/salud.html')}" class="sb-item" data-key="salud"><span class="i"><i data-lucide="heart-pulse"></i></span>Salud del Activo</a>
      </div>
      <div class="sb-group sb-admin-group" hidden>
        <div class="sb-group-title">Administración</div>
        <a href="${u('admin/administracion.html')}" class="sb-item sb-admin" data-key="administracion"><span class="i"><i data-lucide="settings"></i></span>Administración</a>
        <a href="${u('admin/migrate-contrato-id.html')}" class="sb-item sb-admin" data-key="migrate-contrato-id" title="Acceso temporal · retirar después de ejecutar la migración"><span class="i"><i data-lucide="database-zap"></i></span>Migrar contrato_id</a>
      </div>
      <div class="sb-group">
        <div class="sb-group-title">Recursos</div>
        <a href="${u('pages/recursos.html')}" class="sb-item" data-key="recursos"><span class="i"><i data-lucide="folder-open"></i></span>Recursos</a>
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
