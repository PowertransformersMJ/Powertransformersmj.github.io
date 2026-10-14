// ══════════════════════════════════════════════════════════════
// Informe de Mantenimiento Brigada · LISTADO del parque (pantalla)
// ──────────────────────────────────────────────────────────────
// Igual que el tablero de Fichas (`ui/fichas/panel.js`): buscador, filtros por
// zona, departamento y condición, orden por columna con `aria-sort` y un botón
// por equipo. La lógica (buscar, filtrar, ordenar, contar) vive en el dominio
// (`domain/informe_brigada_listado.js`). Un solo oyente de clic, delegado en la raíz.
// ══════════════════════════════════════════════════════════════

const COLUMNAS = Object.freeze([
  { k: 'subestacion', t: 'Subestación' },
  { k: 'matricula', t: 'Matrícula' },
  { k: 'mva', t: 'MVA' },
  { k: 'zona', t: 'Zona', chica: true },
  { k: 'departamento', t: 'Departamento', chica: true },
  { k: 'condicion', t: 'Condición' },
  { k: 'informes', t: 'Informes' },
  { k: null, t: '' }
]);

/**
 * @param {HTMLElement} cont
 * @param {{ ctx, alPedirInforme: (equipo) => void, alAbrirInforme?: (id) => void }} opciones
 */
export function montarListado(cont, { ctx, alPedirInforme, alAbrirInforme } = {}) {
  const L = ctx.dep.listado;
  const F = ctx.dep.formulario;
  const fmt = ctx.dep.formato;
  const NOMBRE = ctx.dep.plantilla.NOMBRE_CONDICION || {};
  const esc = F.escaparHtml;

  let EQUIPOS = [];
  let CONTEO = new Map();
  let RECIENTES = [];
  const TOPE_RECIENTES = 100;
  let meta = { origen: '', limite: 500, recibidos: 0 };
  let conteoFallo = '';
  const filtros = { texto: '', zona: '', departamento: '', condicion: '' };
  const orden = { clave: 'subestacion', asc: true };

  const depPapel = (v) => {
    try { return typeof fmt.departamentoPapel === 'function' ? fmt.departamentoPapel(v) : String(v || ''); }
    catch (_) { return String(v || ''); }
  };

  const ths = COLUMNAS.map((c) => {
    const cls = c.chica ? ' class="ibr-ocultar-chico"' : '';
    if (!c.k) return '<th' + cls + '><span class="ibr-sr">Acción</span></th>';
    return '<th' + cls + ' scope="col" data-k="' + c.k + '" tabindex="0">' + esc(c.t) + '<span data-flecha></span></th>';
  }).join('');

  cont.innerHTML = ''
    + '<div class="ibr-recientes" data-l="recientes" hidden></div>'
    + '<div class="ibr-tabla-caja">'
    +   '<div class="ibr-tabla-barra">'
    +     '<h2 class="ibr-tabla-titulo">Parque de transformadores</h2>'
    +     '<input class="ibr-input" type="search" data-l="q" aria-label="Buscar en el parque" '
    +       'placeholder="Buscar subestación, matrícula, serie, departamento…">'
    +     '<select class="ibr-select" data-l="zona" aria-label="Filtrar por zona"></select>'
    +     '<select class="ibr-select" data-l="departamento" aria-label="Filtrar por departamento"></select>'
    +     '<select class="ibr-select" data-l="condicion" aria-label="Filtrar por condición de salud"></select>'
    +     '<button type="button" class="ibr-btn" data-l="limpiar">Limpiar</button>'
    +   '</div>'
    +   '<div class="ibr-tabla-scroll">'
    +     '<table class="ibr-parque"><thead><tr>' + ths + '</tr></thead><tbody data-l="tbody"></tbody></table>'
    +   '</div>'
    +   '<div class="ibr-tabla-pie" data-l="pie"></div>'
    + '</div>';

  const $ = (s) => cont.querySelector('[data-l="' + s + '"]');
  const tbody = $('tbody');
  const pie = $('pie');

  function celdaCondicion(e) {
    const v = L.condicionDe(e);
    if (v == null) return '<span class="ibr-cond ibr-cond--na" title="Sin calificación en Salud de Activos">s/d</span>';
    const cls = v <= 2 ? 'ibr-cond--ok' : (v === 3 ? 'ibr-cond--med' : 'ibr-cond--mal');
    return '<span class="ibr-cond ' + cls + '" title="Condición ' + v + '/5 · ' + esc(NOMBRE[v] || '') + '">' + v + '</span>';
  }

  function celdaInformes(e) {
    if (conteoFallo) return '<span class="ibr-tenue" title="' + esc(conteoFallo) + '">—</span>';
    const r = CONTEO.get(String(e.matricula || ''));
    // Se cuentan los 100 informes más recientes: si se llegó a ese tope, un equipo sin informes en
    // ellos puede tener informes más viejos → «sin dato», no «0».
    if (!r) return RECIENTES.length >= TOPE_RECIENTES
      ? '<span class="ibr-tenue" title="Solo se cuentan los ' + TOPE_RECIENTES + ' informes más recientes; ábralo para ver los de este equipo.">—</span>'
      : '<span class="ibr-tenue">0</span>';
    const u = r.ultimo;
    const etiqueta = u ? L.etiquetaEstado(u.estado, u.version) : '';
    const cls = u && u.estado === 'emitido' ? 'chip--success' : (u && u.estado === 'anulado' ? 'chip--danger' : 'chip--warn');
    return '<b>' + r.total + '</b>' + (u ? ' <span class="chip ' + cls + ' ibr-chip-chico">' + esc(etiqueta) + '</span>' : '');
  }

  function mvaTexto(e) {
    const m = L.mvaDe(e);
    if (m == null) return '—';
    return String(Math.round(m * 100) / 100).replace('.', ',');
  }

  function pintarOrden() {
    cont.querySelectorAll('th[data-k]').forEach((th) => {
      const activa = th.getAttribute('data-k') === orden.clave;
      const flecha = th.querySelector('[data-flecha]');
      if (flecha) flecha.textContent = activa ? (orden.asc ? ' ▲' : ' ▼') : '';
      if (activa) th.setAttribute('aria-sort', orden.asc ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  function pintarFiltros() {
    const o = L.opcionesFiltro(EQUIPOS);
    const opc = (sel, valores, todos, etiqueta) => {
      const actual = filtros[sel];
      $(sel).innerHTML = '<option value="">' + esc(todos) + '</option>'
        + valores.map((v) => '<option value="' + esc(v) + '"' + (v === actual ? ' selected' : '') + '>' + esc(etiqueta(v)) + '</option>').join('');
    };
    opc('zona', o.zonas, 'Todas las zonas', (v) => v);
    opc('departamento', o.departamentos, 'Todos los departamentos', depPapel);
    opc('condicion', o.condiciones, 'Toda condición', (v) => (v === 'sd' ? 'Sin calificación' : v + ' · ' + (NOMBRE[v] || '')));
  }

  function pintarTabla() {
    const visibles = L.ordenarEquipos(L.filtrarEquipos(EQUIPOS, filtros), { ...orden, conteo: CONTEO });
    if (!EQUIPOS.length) {
      tbody.innerHTML = '<tr><td colspan="' + COLUMNAS.length + '"><div class="ibr-nota">Sin equipos que mostrar.</div></td></tr>';
    } else if (!visibles.length) {
      tbody.innerHTML = '<tr><td colspan="' + COLUMNAS.length + '"><div class="ibr-nota">Ningún equipo cumple el filtro actual.</div></td></tr>';
    } else {
      tbody.innerHTML = visibles.map((e) => {
        const idx = EQUIPOS.indexOf(e);
        const sub = '<b>' + esc(e.subestacion || '—') + '</b>'
          + '<div class="ibr-mini">' + (e.municipio ? esc(e.municipio) + ' · ' : '') + esc(e.serie || 'sin serie') + '</div>';
        return '<tr>'
          + '<td>' + sub + '</td>'
          + '<td class="ibr-mono">' + esc(e.matricula || '—') + '</td>'
          + '<td>' + mvaTexto(e) + '</td>'
          + '<td class="ibr-ocultar-chico">' + esc(e.zona || '—') + '</td>'
          + '<td class="ibr-ocultar-chico">' + esc(e.departamento ? depPapel(e.departamento) : '—') + '</td>'
          + '<td>' + celdaCondicion(e) + '</td>'
          + '<td>' + celdaInformes(e) + '</td>'
          + '<td><button type="button" class="ibr-btn ibr-btn--primario" data-equipo="' + idx + '"'
          +   (e.matricula ? '' : ' disabled title="Sin matrícula en el inventario: no se puede armar el informe"')
          +   '>Informe</button></td>'
          + '</tr>';
      }).join('');
    }
    let txt = '<b>' + visibles.length + '</b> de ' + EQUIPOS.length + ' · ' + meta.recibidos + ' en el parque · Origen: ' + esc(meta.origen || '—');
    if (L.posibleParqueIncompleto(meta.recibidos, meta.limite)) {
      txt += ' <span class="chip chip--warn">Llegaron ' + meta.limite + ' equipos, el tope de lectura: el parque puede estar incompleto</span>';
    }
    if (conteoFallo) txt += ' <span class="chip chip--warn">No se pudieron contar los informes</span>';
    pie.innerHTML = txt;
    pintarOrden();
  }

  function pintarRecientes() {
    const caja = $('recientes');
    const lista = (RECIENTES || []).slice(0, 5);
    if (!lista.length) { caja.hidden = true; caja.innerHTML = ''; return; }
    caja.hidden = false;
    caja.innerHTML = '<h2 class="ibr-recientes-t">Informes recientes</h2><ul class="ibr-recientes-lista">'
      + lista.map((inf) => {
        const m = L.matriculaDeInforme(inf);
        const sub = (inf.equipo_ref && inf.equipo_ref.subestacion) || '';
        return '<li><span class="ibr-mono">' + esc(m || '—') + '</span>'
          + (sub ? ' <span class="ibr-tenue">· ' + esc(sub) + '</span>' : '')
          + ' <span class="chip ibr-chip-chico">' + esc(L.etiquetaEstado(inf.estado, inf.version)) + '</span>'
          + ' <span class="ibr-tenue">' + esc(F.haceCuanto(inf.actualizadoEn)) + '</span>'
          + ' <button type="button" class="ibr-btn ibr-btn--chico" data-abrir="' + esc(inf.id) + '">Abrir</button></li>';
      }).join('') + '</ul>';
  }

  /* ── eventos (delegados) ── */
  let temporizador = null;
  $('q').addEventListener('input', (ev) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { filtros.texto = ev.target.value; pintarTabla(); }, 120);
  });
  ['zona', 'departamento', 'condicion'].forEach((k) => {
    $(k).addEventListener('change', (ev) => { filtros[k] = ev.target.value; pintarTabla(); });
  });
  const ordenarPor = (k) => {
    if (orden.clave === k) orden.asc = !orden.asc;
    else { orden.clave = k; orden.asc = !(k === 'condicion' || k === 'informes' || k === 'mva'); }
    pintarTabla();
  };
  cont.addEventListener('click', (ev) => {
    const th = ev.target.closest('th[data-k]');
    if (th && cont.contains(th)) { ordenarPor(th.getAttribute('data-k')); return; }
    const b = ev.target.closest('[data-equipo]');
    if (b && !b.disabled) {
      const e = EQUIPOS[Number(b.getAttribute('data-equipo'))];
      if (e && typeof alPedirInforme === 'function') alPedirInforme(e);
      return;
    }
    const a = ev.target.closest('[data-abrir]');
    if (a && typeof alAbrirInforme === 'function') { alAbrirInforme(a.getAttribute('data-abrir')); return; }
    if (ev.target.closest('[data-l="limpiar"]')) {
      filtros.texto = ''; filtros.zona = ''; filtros.departamento = ''; filtros.condicion = '';
      $('q').value = '';
      pintarFiltros();
      pintarTabla();
    }
  });
  cont.addEventListener('keydown', (ev) => {
    const th = ev.target.closest && ev.target.closest('th[data-k]');
    if (th && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); ordenarPor(th.getAttribute('data-k')); }
  });

  return {
    cargando() {
      tbody.innerHTML = '<tr><td colspan="' + COLUMNAS.length + '"><div class="ibr-nota">Leyendo el parque…</div></td></tr>';
    },
    error(texto) {
      EQUIPOS = [];
      tbody.innerHTML = '<tr><td colspan="' + COLUMNAS.length + '"><div class="ibr-nota ibr-nota--error">' + esc(texto) + '</div></td></tr>';
      pie.textContent = '';
    },
    fijarEquipos(equipos, m = {}) {
      EQUIPOS = Array.isArray(equipos) ? equipos : [];
      meta = { origen: m.origen || '', limite: m.limite || 500, recibidos: m.recibidos != null ? m.recibidos : EQUIPOS.length };
      pintarFiltros();
      pintarTabla();
    },
    async refrescarConteo() {
      try {
        const lista = await ctx.repo.listarRecientes({ limite: TOPE_RECIENTES });
        RECIENTES = Array.isArray(lista) ? lista : [];
        CONTEO = L.contarInformesPorMatricula(RECIENTES);
        conteoFallo = '';
      } catch (err) {
        conteoFallo = 'No se pudieron leer los informes: ' + ((err && err.message) || err);
        console.warn('[informe-brigada] conteo de informes:', err);
      }
      pintarRecientes();
      if (EQUIPOS.length) pintarTabla();
    },
    refrescarPermisos() { pintarTabla(); }
  };
}
