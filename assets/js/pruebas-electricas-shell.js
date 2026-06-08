// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Pruebas Eléctricas · Shell / Controlador
// ──────────────────────────────────────────────────────────────
// Entrypoint de la página pages/pruebas-electricas.html. Orquesta:
//   · data layer en vivo (onSnapshot)
//   · componentes UI (semáforo, tablas, gráficas)
//   · ficha de identidad y KPIs del parque
//   · modal de carga de informe (serie → PDF → confirmar)
//
// NO contiene reglas de negocio: la calificación normativa vive en
// el dominio (pruebas_electricas_semaforo.js) y la presentación en
// los componentes de assets/js/ui/pruebas/. Aquí solo se conecta el
// flujo de datos con el DOM.
//
// Interfaz en tiempo real · solo datos reales: TODO lo que se ve
// (matriz, tablas, historial y las 6 gráficas) se deriva de informes
// reales. La unidad 173523-15510 trae 3 informes BASE históricos
// (curados en pruebas_electricas_seed.js, valores tal cual el tablero
// de referencia) que se inyectan como punto de partida de la
// tendencia; los informes que el usuario suba al MISMO número de serie
// se anexan en vivo encima del seed. Los informes base son de solo
// lectura (PDF descargable, no eliminables). No hay datos inventados.
// ══════════════════════════════════════════════════════════════

import {
  isReady,
  suscribirUnidades, suscribirInformes,
  guardarUnidad, crearInforme, subirPDF, eliminarInforme, eliminarUnidad, actualizarInforme,
  extraerConIA, guardarBloques, cargarBloques, narrarTendencia,
  listarInformes, eliminarPDF
} from './data/pruebas_electricas.js';
import {
  sanitizarInforme, validarInforme, confirmarSerie, detectarAno, CRITERIOS_NORMA, UMBRAL_DESBALANCE,
  minNetaGohm, kvAT, normalizarSerie
} from './domain/pruebas_electricas_schema.js';
import { extraerMediciones } from './domain/pruebas_electricas_extraccion.js';
import { renderMatriz, estadoVigente, lineaTiempoInformes, calificarPrueba } from './ui/pruebas/semaforo.js';
import { ESTADOS, calificarTanDelta } from './domain/pruebas_electricas_semaforo.js';
import { renderInformes } from './ui/pruebas/tabla-pruebas.js';
import { mountBloques } from './ui/pruebas/grafico-generico.js';
import { bloquesTendencia, resumenTendenciaParaIA, analisisTendencia } from './domain/pruebas_electricas_tendencia.js';

/* ─── Estado de la vista ──────────────────────────────────────── */
const state = {
  unidades: [],
  unidadActiva: null,
  informes: [],
  unsubInformes: null,
  filtroBiblioteca: '',
  // Cache de bloques por informeId (carga perezosa desde Storage, ADR-006):
  // onSnapshot re-renderiza en cada cambio; el cache evita refetch del JSON.
  bloquesCache: new Map(),
  // Cache de narrativa de tendencia (F3) por clave unidad+nº de informes:
  // on-demand, no se re-pide a la IA mientras la unidad no cambie de informes.
  narrativaCache: new Map()
};

const $ = (id) => document.getElementById(id);

// Normaliza texto para búsqueda: minúsculas + sin acentos (NFD).
const norm = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Resuelve el criterio normativo (fórmula+umbral+norma) de un bloque a partir
// de su clave de familia (tolerante a sinónimos de la IA: tan_delta, bushing_*,
// oltc…). Autoritativo desde el dominio, NO del texto de la IA.
function criterioDe(prueba) {
  const p = norm(prueba);
  if (!p) return null;
  if (CRITERIOS_NORMA[p]) return CRITERIOS_NORMA[p];
  if (p.includes('tan')) return CRITERIOS_NORMA.tand;
  if (p.includes('excit')) return CRITERIOS_NORMA.excitacion;
  if (p.includes('relac')) return CRITERIOS_NORMA.relacion;
  if (p.includes('aisl')) return CRITERIOS_NORMA.aislamiento;
  if (p.includes('resist')) return CRITERIOS_NORMA.resistencia;
  if (p.includes('bush') || p.includes('buje')) return CRITERIOS_NORMA.bushing;
  if (p.includes('collar')) return CRITERIOS_NORMA.collar;
  if (p.includes('drm') || p.includes('oltc') || p.includes('conmutad')) return CRITERIOS_NORMA.drm;
  return null;
}
// Resuelve el umbral de desbalance normativo (%) de un bloque por su familia.
function desbalanceDe(prueba) {
  const p = norm(prueba);
  if (!p) return null;
  if (p in UMBRAL_DESBALANCE) return UMBRAL_DESBALANCE[p];
  if (p.includes('excit')) return UMBRAL_DESBALANCE.excitacion;
  if (p.includes('relac')) return UMBRAL_DESBALANCE.relacion;
  if (p.includes('aisl')) return null;
  if (p.includes('resist')) return UMBRAL_DESBALANCE.resistencia;
  return null;
}
// Enriquece cada bloque (copia superficial; no muta el cache): adjunta el
// `criterio` verificable, el `limite_desbalance` normativo del dominio (si la IA
// no lo dio) y, para aislamiento, el mínimo NETA por CLASE DE TENSIÓN (no el
// genérico ≥1 GΩ): a 110 kV el mínimo son decenas de GΩ → recalifica "pobre".
function conCriterios(data, kv) {
  const bloques = (data && data.bloques) || [];
  const minNeta = minNetaGohm(kv);
  return {
    ...data,
    bloques: bloques.map((b) => {
      if (!b) return b;
      const out = { ...b };
      const c = criterioDe(b.prueba);
      if (c) out.criterio = c;
      // El criterio de desbalance es de DOMINIO (normativo), NO el que emita la
      // IA: si el dominio tiene umbral para esta prueba, SOBRESCRIBE el de la IA
      // (p.ej. resistencia: NETA 2%, aunque la IA haya puesto 5%). L-36.
      if (b.grafica !== 'barra' && (b.series || []).length >= 2) {
        const u = desbalanceDe(b.prueba);
        if (u != null) out.limite_desbalance = u;
      }
      // Aislamiento (bloque en GΩ): límite = mínimo NETA de la clase de tensión.
      if (minNeta != null && norm(b.prueba).includes('aisl') && /g\s*Ω|gohm/i.test(b.unidad || '')) {
        out.limite = minNeta;
        out.invertir = true; // el límite es un MÍNIMO (mayor es mejor)
        const ys = (b.series || []).flatMap((s) => (s.puntos || []).map((p) => p.y)).filter((v) => v != null);
        const peor = ys.length ? Math.min(...ys) : null;
        if (peor != null && peor < minNeta) out.calif = 'investigar'; // por debajo de NETA → pobre
      }
      return out;
    })
  };
}
// Tensión AT (kV) de la unidad activa, para el mínimo NETA de aislamiento.
function kvUnidadActiva() {
  const u = state.unidadActiva || {};
  return kvAT(u.tensiones || (u.identidad && u.identidad.tensiones));
}

/* ─── Seed: unidad + 3 informes base (datos reales históricos) ─── */
// La capa de datos emite [] cuando Firebase no está activo ("solo datos
// reales"). Los 3 informes base SON datos reales, así que se inyectan
// como punto de partida de la tendencia tanto offline como con backend.
// El merge respeta lo que venga en vivo: una unidad/informe en Firestore
// con la misma serie/año pisa al seed (el usuario corrigió o reemplazó).

// El libro demo (seed 173523-15510) se RETIRÓ del parque (2026-06-06, a pedido
// del director): el tablero muestra SOLO unidades reales cargadas. Los exports
// del seed se conservan como fixtures de tests; aquí ya no se inyectan.
function mergeUnidades(live) {
  return (live || []).slice();
}

// Cada informe en vivo es un documento Firestore con id propio y se conserva
// (subir 6 PDFs guarda 6 informes, aunque compartan año o no traigan año).
function mergeInformes(unidadId, live) {
  void unidadId;
  return (live || []).slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
}

// Ya no hay libros base de solo lectura → todos los libros reales son borrables.
const SERIES_SEED = new Set();
function esSeedSerie(serie) { return SERIES_SEED.has(String(serie)); }

/* ─── KPIs y ficha de identidad ───────────────────────────────── */

const ID_FILAS = [
  ['Fabricante',   'fabricante'],
  ['N° serie',     'serie'],
  ['Año',          'ano_fabricacion'],
  ['Potencia',     'potencia'],
  ['Tensiones',    'tensiones'],
  ['Grupo',        'grupo_conexion'],
  ['Refrigeración','refrigeracion'],
  ['Frecuencia',   'frecuencia'],
  ['Cliente',      'cliente'],
  ['Ubicación',    'ubicacion']
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderIdentidad(u) {
  const cont = $('idgrid');
  if (!cont) return;
  if (!u) { cont.innerHTML = '<p class="muted small">Sin unidad seleccionada.</p>'; return; }
  cont.innerHTML = ID_FILAS.map(([k, key]) => {
    const v = u[key];
    return `<div class="idcell"><div class="k">${esc(k)}</div>` +
      `<div class="v">${v == null || v === '' ? '—' : esc(v)}</div></div>`;
  }).join('');
}

// Separa un grupo vectorial ("YNyn0yn0" → ["YN","yn0","yn0"]) en la conexión
// de cada devanado: AT (mayúsculas iniciales) + los devanados de BT (grupos
// minúscula+dígito). Best-effort: si no parsea, deja el string completo.
function parseGrupo(g) {
  const s = String(g || '').trim();
  if (!s) return [];
  const m = s.match(/^([A-Z]+\d*)(.*)$/);
  if (!m) return [s];
  return [m[1], ...((m[2].match(/[a-z]+\d*/g)) || [])];
}

// Tabla de nomenclatura derivada de la unidad (tensiones + grupo de conexión),
// en vez de valores fijos que no siempre matchean el transformador.
function renderNomenclatura(u) {
  const tb = $('nomencl-body');
  if (!tb) return;
  const tens = String((u && u.tensiones) || '').split('/').map((x) => x.replace(/kv/i, '').trim()).filter(Boolean);
  const grupos = parseGrupo(u && u.grupo_conexion);
  const DEV = [['AT', 'H'], ['MT', 'X'], ['BT', 'Y']];
  tb.innerHTML = DEV.map(([dev, t], i) => {
    const tension = tens[i] ? `${tens[i]} kV` : '—';
    const conx = grupos[i] || '—';
    const tieneN = /n/i.test(conx);
    const ph = (n) => `<span class="ph ${n === 0 ? 'pn' : ['pa', 'pb', 'pc'][n - 1]}">${t}${n}</span>`;
    return `<tr><td>${esc(dev)}</td><td>${esc(tension)}</td><td>${esc(conx)}</td>` +
      `<td>${ph(1)}</td><td>${ph(2)}</td><td>${ph(3)}</td>` +
      `<td>${tieneN ? ph(0) : '<span class="muted2">—</span>'}</td></tr>`;
  }).join('');
}

// Paleta de lomos para los libros de la biblioteca. El color se asigna de
// forma determinista por hash de la serie: misma serie → mismo lomo siempre,
// sin inventar ningún dato (es puramente presentacional).
const SPINES = [
  ['#16365c', '#0f2741'], ['#0f8a99', '#0a5b66'], ['#7a3b2e', '#52271d'],
  ['#3d5a3a', '#273a25'], ['#5a3d6e', '#3a2748'], ['#8a6d1f', '#5c4814'],
  ['#1e4e79', '#143553'], ['#2e6b5e', '#1d453c']
];

function spineFor(serie) {
  const s = String(serie || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SPINES[h % SPINES.length];
}

// Filtra las unidades de la biblioteca por el texto buscado (serie,
// fabricante, ubicación, cliente o subestación · sin acentos).
function filtrarUnidades(unidades) {
  const q = norm(state.filtroBiblioteca).trim();
  if (!q) return unidades || [];
  return (unidades || []).filter((u) => {
    const blob = norm([u.serie, u.id, u.fabricante, u.ubicacion, u.cliente, u.subestacion]
      .filter(Boolean).join(' '));
    return blob.includes(q);
  });
}

// Renderiza la biblioteca: cada unidad es un libro cuyo lomo muestra el
// número de serie. Al abrirlo (clic) se ilustra su histórico de informes.
function renderParqueGrid(unidades) {
  const grid = $('parque-grid');
  if (!grid) return;
  const filtradas = filtrarUnidades(unidades);
  const sinResultados = state.filtroBiblioteca.trim() && filtradas.length === 0;
  const aviso = sinResultados
    ? `<p class="pe-lib-empty">Ningún libro coincide con “${esc(state.filtroBiblioteca.trim())}”.</p>`
    : '';
  // Un libro es eliminable si NO es base (seed), hay backend y el usuario
  // es admin (las rules de Firestore/Storage también lo exigen).
  const puedeBorrar = isReady() && esAdmin();
  const books = filtradas.map((u) => {
    const serie = u.serie || u.id;
    const meta = [u.fabricante, u.potencia].filter(Boolean).join(' · ');
    const [s1, s2] = spineFor(serie);
    const book = `<button type="button" class="pe-book" data-serie="${esc(serie)}" ` +
      `style="--spine:${s1};--spine2:${s2}" ` +
      `title="Abrir histórico de ${esc(serie)}">` +
      `<span class="pe-book-head" aria-hidden="true"></span>` +
      `<span class="pe-book-label"><span class="pe-book-serie">${esc(serie)}</span>` +
      (meta ? `<span class="pe-book-maker">${esc(meta)}</span>` : '') +
      `</span>` +
      `<span class="pe-book-foot" aria-hidden="true"></span></button>`;
    const del = (puedeBorrar && !esSeedSerie(serie))
      ? `<button type="button" class="pe-book-del" data-del="${esc(serie)}" ` +
        `title="Eliminar libro ${esc(serie)}" aria-label="Eliminar libro ${esc(serie)}">×</button>`
      : '';
    return `<div class="pe-book-wrap">${book}${del}</div>`;
  }).join('');
  const addBook = `<button type="button" class="pe-book pe-book-add" ` +
    `onclick="openUpload()" title="Cargar informe de una unidad">` +
    `<span class="pe-addbook-plus" aria-hidden="true">＋</span>` +
    `<span class="pe-addbook-lbl">Cargar informe</span></button>`;
  grid.innerHTML = aviso + books + addBook;
  marcarLibroActivo();
}

// Resalta el libro de la unidad activa (estado .is-open).
function marcarLibroActivo() {
  const grid = $('parque-grid');
  if (!grid) return;
  const act = state.unidadActiva ? (state.unidadActiva.serie || state.unidadActiva.id) : null;
  grid.querySelectorAll('.pe-book[data-serie]').forEach((b) => {
    b.classList.toggle('is-open', !!act && b.getAttribute('data-serie') === act);
  });
}

// Clic en una tarjeta del parque → selecciona esa serie (refleja la serie
// en el campo de búsqueda y dispara el render completo de la unidad).
function onClickParque(ev) {
  // ── Eliminar libro (botón rojo sobre el lomo) ──
  const del = ev.target.closest('[data-del]');
  if (del) {
    ev.preventDefault();
    ev.stopPropagation();
    onEliminarLibro(del.getAttribute('data-del'));
    return;
  }
  const btn = ev.target.closest('[data-serie]');
  if (!btn) return;
  const v = btn.getAttribute('data-serie');
  const u = state.unidades.find((x) => (x.serie || x.id) === v);
  if (!u) return;
  const inp = $('serieInput');
  if (inp) inp.value = v;
  seleccionarUnidad(u);
  // Abrir un libro NO salta al tablero: despliega el hub "Libro abierto" con sus
  // opciones (Ver tablero / Ver tendencia + informes/PDF) para que el usuario
  // decida qué hacer. Se hace visible y se trae a la vista.
  const libro = $('biblioteca-libro');
  if (libro && libro.scrollIntoView) libro.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Elimina un libro completo (unidad + informes + PDF). Admin + backend.
async function onEliminarLibro(serie) {
  if (!serie) return;
  if (esSeedSerie(serie)) return toast('Los libros base son de solo lectura.', 'warn');
  if (!isReady()) return toast('Sin backend: no se puede eliminar.', 'warn');
  if (!esAdmin()) return toast('Solo un administrador puede eliminar libros.', 'warn');
  if (!window.confirm(
    `¿Eliminar el libro ${serie} con TODOS sus informes y PDF?\n` +
    `Esta acción no se puede deshacer.`)) return;
  try {
    await eliminarUnidad(serie);
    toast(`Libro ${serie} eliminado.`);
    // Si era la unidad abierta, limpia la selección (las suscripciones en
    // vivo refrescan la repisa y vacían el tablero).
    const act = state.unidadActiva && (state.unidadActiva.serie || state.unidadActiva.id);
    if (act === serie) {
      state.unidadActiva = null;
      const inp = $('serieInput'); if (inp) inp.value = '';
    }
  } catch (err) {
    console.error('[pruebas-electricas] eliminarUnidad', err);
    toast('No se pudo eliminar el libro.', 'warn');
  }
}

// Cambia de pestaña activando su botón (el motor de tabs delega en module-shell).
function irATab(name) {
  const tab = document.querySelector(`#pruebasTabs [role="tab"][data-tab="${name}"]`);
  if (tab) tab.click();
  const top = document.querySelector('#pruebasTabs');
  if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function irAlTablero() { irATab('tablero'); }

function refrescarKpisParque() {
  if ($('kpi-unidades')) $('kpi-unidades').textContent = String(state.unidades.length || 0);
  const subs = new Set(state.unidades.map((u) => u.subestacion).filter(Boolean));
  if ($('kpi-subestaciones')) $('kpi-subestaciones').textContent = String(subs.size || 0);
}

/* ─── Render de los informes de la unidad activa ──────────────── */

// Borrar informes es operación admin: las rules exigen isAdmin() y el
// botón solo se muestra con backend activo (los informes del seed son
// de solo lectura y no tienen doc real que eliminar).
function esAdmin() {
  const s = window.__sgmSession;
  return !!(s && (s.role === 'admin' || (s.profile && s.profile.rol === 'admin')));
}

// Franja-timeline (F2): cronología de informes de la unidad, cada nodo con su
// estado global (peor prueba) y el más reciente marcado "vigente". Determinista
// (misma calificación que la matriz, vía lineaTiempoInformes). De un vistazo
// muestra la historia de la unidad y si va degradando.
function timelineHtml(informes) {
  const linea = lineaTiempoInformes(informes, { minNeta: minNetaGohm(kvUnidadActiva()) });
  if (linea.length < 2) return ''; // con un solo punto no hay cronología que mostrar
  const nodos = linea.map((p) => {
    const et = p.ano != null ? String(p.ano) : (p.fecha || '—');
    const sub = p.vigente ? 'vigente' : '';
    const titulo = `${et} · ${p.estado.etiqueta || ''}`;
    return `<li class="pe-tl-nodo${p.vigente ? ' is-vigente' : ''}" title="${esc(titulo)}">`
      + `<span class="pe-tl-dot dot ${p.estado.dot}"></span>`
      + `<span class="pe-tl-ano">${esc(et)}</span>`
      + (sub ? `<span class="pe-tl-sub">${sub}</span>` : '')
      + '</li>';
  }).join('');
  return `<ol class="pe-timeline" aria-label="Cronología de informes de la unidad">${nodos}</ol>`;
}

// Tendencia temporal (pestaña "Tendencia"): franja-timeline de informes (F2) +
// una gráfica por métrica clave, su evolución a lo largo de los informes del
// transformador vs su umbral. Reusa el render genérico de bloques. Determinista
// (campos canónicos, no IA).
function renderTendenciaUI(informes) {
  const cont = $('tendencia-cont');
  if (!cont) return;
  const docs = (informes || []).filter(Boolean);
  if (!docs.length) {
    cont.innerHTML = '<p class="muted small">Selecciona un libro para ver su tendencia.</p>';
    return;
  }
  const bloques = bloquesTendencia(docs);
  if (!bloques.length) {
    cont.innerHTML = '<p class="muted small">Sin métricas tendenciables en los informes de esta unidad.</p>';
    return;
  }
  const n = docs.length;
  const aviso = n < 2
    ? `<p class="muted small">Solo hay ${n} informe cargado para esta unidad: cada gráfica muestra un punto. Carga informes de otras fechas para trazar la tendencia y revelar degradación.</p>`
    : `<p class="muted small">${n} informes en el tiempo · una línea por ensayo contra su umbral normativo.</p>`;
  cont.innerHTML = aviso
    + diagnosticoUnidadHtml(docs)
    + timelineHtml(docs)
    + narrativaSectionHtml(docs)
    + '<div id="tendencia-bloques"></div>';
  mountBloques($('tendencia-bloques'), conCriterios({ bloques }, kvUnidadActiva()));
  pintarNarrativaCache(docs); // restaura la narrativa ya generada para esta unidad
}

/* ─── Diagnóstico de la unidad (cabecera de Tendencia) ───────────
 * Síntesis de ALTO NIVEL: por métrica, el veredicto vigente multi-norma + la
 * dirección de la tendencia (empeora/mejora/estable + Δ) + la recomendación
 * (plegable). Da el "estado de la unidad de un vistazo" + qué vigilar. */
function trendMarker(m) {
  if (m.tendencia == null) return '<span class="pe-diag-trend b-n">— sin histórico</span>';
  const arrow = m.tendencia === 'empeora' ? '▲' : (m.tendencia === 'mejora' ? '▼' : '→');
  const cls = m.tendencia === 'empeora' ? 'b-r' : (m.tendencia === 'mejora' ? 'b-g' : 'b-n');
  const d = (m.delta != null && m.delta !== 0) ? ` ${m.delta > 0 ? '+' : ''}${m.delta}${esc(m.unidad)}` : '';
  return `<span class="pe-diag-trend ${cls}">${arrow} ${m.tendencia}${d}</span>`;
}
function diagnosticoUnidadHtml(docs) {
  const analisis = analisisTendencia(docs, { minClase: minNetaGohm(kvUnidadActiva()) });
  if (!analisis.length) return '';
  const cuenta = analisis.reduce((a, m) => {
    const c = m.estado ? m.estado.clase : 'b-n'; a[c] = (a[c] || 0) + 1; return a;
  }, {});
  const chip = (clase, lbl) => cuenta[clase] ? `<span class="pe-diag-chip ${clase}">${cuenta[clase]} ${lbl}</span>` : '';
  const chips = chip('b-g', 'dentro de norma') + chip('b-a', 'vigilar') + chip('b-o', 'investigar') + chip('b-r', 'fuera de norma') + chip('b-n', 'sin dato');
  const filas = analisis.map((m) => {
    const badge = m.estado ? `<span class="badge ${m.estado.clase}">${esc(m.estado.etiqueta)}</span>` : '<span class="badge b-n">s/d</span>';
    const div = m.divergen ? '<span class="pe-diag-div" title="Las normas divergen">⊳</span>' : '';
    return `<details class="pe-diag-row"><summary><span class="pe-diag-m">${esc(m.titulo)}</span> ${badge} ${trendMarker(m)} ${div}</summary>`
      + `<p class="pe-diag-rec"><b>Recomendación</b> ${esc(m.recomendacion)}</p></details>`;
  }).join('');
  const empeoran = analisis.filter((m) => m.tendencia === 'empeora').map((m) => m.titulo);
  const aviso = empeoran.length
    ? `<p class="pe-diag-watch">⚠ Empeorando vs informe previo: ${esc(empeoran.join(' · '))}. La tendencia pesa tanto como el valor (IEEE C57.152).</p>`
    : '';
  return '<section class="pe-diagnostico">'
    + '<div class="pe-diag-head">Diagnóstico de la unidad <span class="norm">veredicto vigente multi-norma + tendencia</span></div>'
    + `<div class="pe-diag-chips">${chips}</div>${aviso}<div class="pe-diag-list">${filas}</div></section>`;
}

/* ─── Narrativa de tendencia por IA (F3, on-demand) ───────────── */
// Clave de cache: unidad + nº de informes → si entra un informe nuevo, la
// narrativa cacheada se invalida (la clave cambia) y se vuelve a ofrecer.
function narrativaKey(informes) {
  const u = state.unidadActiva || {};
  return `${u.id || u.serie || '-'}#${(informes || []).length}`;
}

// Convierte la narrativa (markdown breve de la IA) a HTML SEGURO: escapa todo,
// luego reaplica negritas **x**, viñetas "- " y saltos de línea. Nada de innerHTML
// con texto crudo del modelo (anti-XSS).
function narrativaToHtml(texto) {
  const lineas = String(texto || '').split('\n');
  let html = '';
  let enLista = false;
  for (const raw of lineas) {
    const l = raw.trim();
    const conNegrita = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^[-*]\s+/.test(l)) {
      if (!enLista) { html += '<ul>'; enLista = true; }
      html += `<li>${conNegrita(l.replace(/^[-*]\s+/, ''))}</li>`;
    } else {
      if (enLista) { html += '</ul>'; enLista = false; }
      if (l) html += `<p>${conNegrita(l)}</p>`;
    }
  }
  if (enLista) html += '</ul>';
  return html;
}

// Sección de la narrativa: botón on-demand + contenedor. Solo se ofrece si hay
// tendencia real (>=2 puntos en alguna métrica); con un solo informe no aplica.
function narrativaSectionHtml(informes) {
  if (!resumenTendenciaParaIA(informes).length) return '';
  return '<section class="pe-narrativa" id="narrativa-sec">'
    + '<div class="pe-narrativa-head">'
    + '<h4>Narrativa de tendencia <span class="norm">lectura por IA</span></h4>'
    + '<button type="button" class="btn-sm" id="btn-narrar">'
    + '<span class="i"><i data-lucide="sparkles"></i></span> Generar narrativa</button>'
    + '</div>'
    + '<div id="narrativa-cont"><p class="muted small">Genera una lectura en prosa de la evolución: qué métrica degrada, a qué ritmo y qué vigilar.</p></div>'
    + '</section>';
}

// Repinta la narrativa cacheada (si existe) al re-renderizar la unidad.
function pintarNarrativaCache(informes) {
  const cont = $('narrativa-cont');
  if (!cont) return;
  const cache = state.narrativaCache.get(narrativaKey(informes));
  if (cache) cont.innerHTML = narrativaToHtml(cache);
}

async function onGenerarNarrativa() {
  const btn = $('btn-narrar');
  const cont = $('narrativa-cont');
  if (!btn || !cont) return;
  const informes = state.informes || [];
  const key = narrativaKey(informes);
  const cacheado = state.narrativaCache.get(key);
  if (cacheado) { cont.innerHTML = narrativaToHtml(cacheado); return; }
  const metricas = resumenTendenciaParaIA(informes);
  if (!metricas.length) {
    cont.innerHTML = '<p class="muted small">No hay tendencia suficiente para narrar (se requieren 2+ informes).</p>';
    return;
  }
  btn.disabled = true;
  cont.innerHTML = '<p class="muted small">Generando narrativa con IA…</p>';
  try {
    const u = state.unidadActiva || {};
    const res = await narrarTendencia({ serie: u.serie || u.id, metricas });
    state.narrativaCache.set(key, res.narrativa);
    cont.innerHTML = narrativaToHtml(res.narrativa);
  } catch (err) {
    console.warn('[pruebas-electricas] narrarTendencia', err);
    cont.innerHTML = `<p class="muted small">No se pudo generar la narrativa: ${esc(err && err.message || 'error')}.</p>`;
  } finally {
    btn.disabled = false;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }
}

function renderInformesUI(informes) {
  state.informes = informes || [];
  const u = state.unidadActiva || {};

  // Scorecard: arranca con la matriz canónica (multi-año) como base/fallback;
  // si el informe vigente trae bloques de la IA, montarBloques la SOBREESCRIBE
  // con el scorecard derivado de la lectura IA (fuente de verdad, sin los
  // errores de mapeo rígido — ADR-007 / rediseño). Las secciones de detalle
  // rígidas se retiraron: el cuerpo del informe son los bloques.
  renderMatriz($('matrix'), state.informes, { minNeta: minNetaGohm(kvUnidadActiva()) });

  // Tendencia temporal (multi-informe): evolución de la métrica clave de cada
  // prueba vs su umbral. Determinista desde los campos canónicos (no IA).
  renderTendenciaUI(state.informes);

  // Historial + KPI de conteo
  renderInformes($('reportlist'), state.informes, {
    serieUnidad: u.serie,
    kpiEl: $('kpi-informes'),
    canDelete: isReady() && esAdmin()
  });

  // KPI estado vigente (NETA-aware: aislamiento por clase de tensión)
  const est = estadoVigente(state.informes, { minNeta: minNetaGohm(kvUnidadActiva()) });
  const docs = state.informes.slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  const ult = docs[docs.length - 1];
  const kpiEstado = $('kpi-estado');
  if (kpiEstado) {
    const txt = ult ? `${est.etiqueta || '—'}` : '—';
    kpiEstado.textContent = txt;
    kpiEstado.title = ult ? `Informe vigente ${ult.ano}` : '';
  }

  // Análisis detallado (bloques flexibles, ADR-006): carga perezosa async,
  // no bloquea el render normativo de arriba.
  montarBloques(u.id || u.serie, state.informes);
}

/**
 * Monta el "Análisis detallado": carga perezosa el diagnóstico de extracción
 * (bloques + interpretación cruda, Firestore ADR-007) de cada informe REAL de
 * la unidad y lo pinta agrupado por año (más reciente primero), reusando el
 * render genérico de Fase 1. Para admin añade el panel de interpretación cruda
 * (ADR-007). Los informes seed no tienen diagnóstico. Cache por informeId:
 * onSnapshot re-renderiza seguido y no debe refetchear. Falla suave.
 */
async function montarBloques(unidadId, informes) {
  const cont = $('bloques-cont');
  if (!cont) return;
  const reales = (informes || []).filter((i) => i && i.id && !i._seed);
  if (!isReady() || !unidadId || !reales.length) {
    cont.innerHTML = '<p class="muted small">Sin análisis detallado para esta unidad.</p>';
    return;
  }
  await Promise.all(reales.map(async (inf) => {
    if (state.bloquesCache.has(inf.id)) return;
    try { state.bloquesCache.set(inf.id, await cargarBloques(unidadId, inf.id)); }
    catch { state.bloquesCache.set(inf.id, null); }
  }));
  // La unidad pudo cambiar mientras cargaba: aborta si ya no es la activa.
  const act = state.unidadActiva && (state.unidadActiva.id || state.unidadActiva.serie);
  if (act !== unidadId) return;
  const admin = esAdmin();
  const ordenados = reales.slice().sort((a, b) => (b.ano || 0) - (a.ano || 0));
  cont.innerHTML = '';
  let alguno = false;
  for (const inf of ordenados) {
    const data = state.bloquesCache.get(inf.id);
    if (!data) continue;                       // sin diagnóstico: nada que mostrar
    const tieneBloques = !!(data.bloques && data.bloques.length);
    // Admin ve el grupo aunque no haya gráficas (para inspeccionar el crudo);
    // el resto solo si hay bloques que pintar.
    if (!tieneBloques && !admin) continue;
    alguno = true;
    const grupo = document.createElement('div');
    grupo.className = 'pe-bloque-grupo';
    const h = document.createElement('h3');
    h.textContent = `Informe ${inf.ano || 's/a'}`;
    grupo.appendChild(h);
    if (tieneBloques) {
      const box = document.createElement('div');
      mountBloques(box, conCriterios(data, kvUnidadActiva()));
      grupo.appendChild(box);
    } else {
      const vacio = document.createElement('p');
      vacio.className = 'muted small';
      vacio.textContent = 'La IA no produjo gráficas para este informe.';
      grupo.appendChild(vacio);
    }
    if (admin) grupo.appendChild(panelDiagnostico(data, inf));
    cont.appendChild(grupo);
  }
  if (!alguno) cont.innerHTML = '<p class="muted small">Esta unidad aún no tiene análisis detallado extraído por IA.</p>';

  // Encabezado del informe vigente (quién ejecutó, con qué instrumento, cuándo)
  // — metadata que la IA ya extrae y antes se desperdiciaba.
  if (alguno) {
    const enc = encabezadoInforme(ordenados[0]);
    if (enc) cont.insertBefore(enc, cont.firstChild);
  }

  // Scorecard. Con UN solo informe → derivado de la lectura IA (fiel, sin los
  // errores del mapeo rígido). Con VARIOS → se conserva la matriz canónica
  // multi-año (columnas por año = evolución, Etapa 3) ya renderizada en
  // renderInformesUI; no se sobreescribe.
  const vigente = ordenados.find((inf) => {
    const d = state.bloquesCache.get(inf.id);
    return d && d.bloques && d.bloques.length;
  });
  if (vigente) {
    // Scorecard del informe VIGENTE SIEMPRE arriba (aunque haya varios informes):
    // discrimina cada prueba — incluido el FP de bujes (C1) aparte del FP del
    // transformador. La evolución multi-año vive en la pestaña Tendencia.
    // Enriquecido (no crudo) → refleja la recalificación normativa (NETA por clase).
    renderScorecard($('matrix'), conCriterios(state.bloquesCache.get(vigente.id), kvUnidadActiva()), vigente);
  }
}

// Tira de metadata del informe (ensayo, ejecutante, instrumento, fecha).
const TIPOS_PRUEBA_LBL = {
  predictivo_completo: 'Mantenimiento predictivo (completo)',
  tan_delta: 'Tangente δ', drm_oltc: 'DRM · conmutador (OLTC)',
  resistencia_devanados: 'Resistencia de devanados', ttr: 'Relación de transformación',
  mixto: 'Ensayos mixtos'
};
function encabezadoInforme(inf) {
  if (!inf) return null;
  const campos = [
    ['Ensayo', TIPOS_PRUEBA_LBL[inf.tipo_prueba] || inf.tipo_prueba],
    ['Ejecutó', inf.ejecutante],
    ['Instrumento', inf.equipo],
    ['Fecha', inf.fecha || (inf.ano ? String(inf.ano) : '')]
  ].filter(([, v]) => v);
  if (!campos.length) return null;
  const el = document.createElement('div');
  el.className = 'pe-informe-meta';
  el.innerHTML = campos.map(([k, v]) =>
    `<span class="pe-meta-item"><span class="pe-meta-k">${esc(k)}</span>${esc(v)}</span>`).join('');
  return el;
}

/* ─── Scorecard NORMATIVO (veredicto derivado de valores vs norma) ─── */
// El veredicto SIEMPRE sale de los valores medidos contra el criterio normativo
// (dominio), NUNCA de la calificación textual del laboratorio/IA. Solo se
// muestran las pruebas REALMENTE presentes (sin "OK" fantasma).
//   · canónicas (tand/excitacion/relacion/resistencia/aislamiento/drm): vía
//     `calificarPrueba` sobre las mediciones (aislamiento = NETA por clase).
//   · bujes (C1): derivado del peor tan δ medido del bloque vs el límite norma.
const FAMILIAS_SCORE = [
  { key: 'tand',        blockKeys: ['tand', 'tan_delta'],               label: 'Tan δ / FP · aislamiento del transformador', criterio: 'FP ≤ 1% (IEEE 62)' },
  { key: 'bushing',     blockKeys: ['bushing', 'bushing_capacitancia'], label: 'Factor de potencia de bujes (C1)',           criterio: 'tan δ ≤ 1% (IEEE 62 / C57.19.100)' },
  { key: 'excitacion',  blockKeys: ['excitacion'],                      label: 'Corriente de excitación',        criterio: 'Δ fases ≤ 10% (IEEE C57.152)' },
  { key: 'relacion',    blockKeys: ['relacion'],                        label: 'Relación de transformación',     criterio: '±0.5% vs placa (IEEE C57.152 §7.2.10 / NETA 7.2.2)' },
  { key: 'resistencia', blockKeys: ['resistencia'],                     label: 'Resistencia de devanados',       criterio: 'Δ fases ≤ 2% (NETA ATS §7.2.2.D.8)' },
  { key: 'aislamiento', blockKeys: ['aislamiento'],                     label: 'Resistencia de aislamiento (CC)', criterio: '≥ mínimo NETA por clase' },
  { key: 'drm',         blockKeys: ['drm', 'oltc'],                     label: 'DRM · conmutador (OLTC)',        criterio: '40–70 ms' }
];

// Veredicto NORMATIVO del bloque de bujes: peor tan δ medido vs el límite (mismo
// criterio que tan δ del transformador, IEEE 62). No usa el texto de la IA.
function estadoBushing(bloques) {
  const ys = bloques.filter((b) => b && /bushing/.test(b.prueba || ''))
    .flatMap((b) => (b.series || []).flatMap((s) => (s.puntos || []).map((p) => p.y)))
    .filter((v) => typeof v === 'number');
  if (!ys.length) return null;
  const max = Math.max(...ys);
  return { estado: calificarTanDelta(max), texto: `${max.toFixed(2)}%` };
}

function renderScorecard(cont, data, inf) {
  if (!cont) return;
  const bloques = (data && data.bloques) || [];
  if (!bloques.length) return; // sin bloques: conserva el fallback canónico
  const kv = kvUnidadActiva();
  const minNeta = minNetaGohm(kv);
  const filas = FAMILIAS_SCORE.map((fam) => {
    const r = (fam.key === 'bushing')
      ? estadoBushing(bloques)
      : calificarPrueba(fam.key, inf, { minNeta });
    if (!r || r.estado === ESTADOS.NEUTRAL) return null; // sin dato medido → no se muestra
    const criterio = (fam.key === 'aislamiento' && minNeta != null)
      ? `≥ ${minNeta} GΩ · NETA 100.5 (clase ${kv} kV)`
      : fam.criterio;
    return { label: fam.label, criterio, estado: r.estado, texto: r.texto };
  }).filter(Boolean);
  if (!filas.length) return;
  const cap = inf
    ? `Informe ${inf.ano || 's/a'} · calificación DERIVADA de los valores medidos contra los criterios normativos — independiente de la calificación del laboratorio.`
    : 'Calificación derivada de las normas.';
  const body = filas.map((f) => {
    const detalle = (f.texto && f.texto !== 'OK') ? ` · ${esc(f.texto)}` : '';
    return `<tr><td class="cfg">${esc(f.label)}</td>` +
      `<td><span class="cellbox ${f.estado.clase}"><span class="dot ${f.estado.dot}"></span>${esc(f.estado.etiqueta)}${detalle}</span></td>` +
      `<td class="muted small">${esc(f.criterio)}</td></tr>`;
  }).join('');
  cont.innerHTML = `<table><thead><tr><th>Prueba</th><th>Calificación normativa</th><th>Criterio · norma</th></tr></thead><tbody>${body}</tbody></table>` +
    `<p class="muted small" style="margin-top:8px">${esc(cap)}</p>`;
}

/**
 * Panel admin "Interpretación de la IA" (ADR-007): resumen de conteos + modelo
 * + tokens + el JSON crudo (mediciones + bloques) colapsable, con botón para
 * copiarlo. Es el ojo del diagnóstico: deja VER qué interpretó Claude vs lo
 * que se graficó, y exportarlo para compartir.
 */
function panelDiagnostico(data, inf) {
  const r = data.resumen || {};
  const u = data.usage || {};
  const chips = [
    ['tan δ', r.n_tand], ['exc. fases', r.n_excitacion_fases], ['relación', r.n_relacion],
    ['resist.', r.n_resistencia], ['aislam.', r.n_aislamiento], ['bujes', r.n_bujes],
    ['DRM', r.drm ? '✓' : 0], ['bloques', r.n_bloques], ['series', r.n_series], ['puntos', r.n_puntos]
  ].map(([k, v]) => `<span class="pe-diag-chip${(v === 0 || v == null) ? ' is-zero' : ''}">${k}: ${v == null ? '—' : v}</span>`).join('');
  const crudo = { resumen: data.resumen, modelo: data.modelo, usage: data.usage, mediciones: data.mediciones_raw, bloques: data.bloques };
  const json = JSON.stringify(crudo, null, 2);
  const det = document.createElement('details');
  det.className = 'pe-diag';
  det.innerHTML =
    `<summary>Interpretación de la IA (cruda) · ${esc(data.modelo || 's/modelo')} · ` +
    `in ${u.input || 0} / out ${u.output || 0} tok</summary>` +
    `<div class="pe-diag-chips">${chips}</div>` +
    `<div class="pe-diag-bar"><button type="button" class="btn btn-ghost btn-sm" data-diag-copy>Copiar JSON</button></div>` +
    `<pre class="pe-diag-json">${esc(json)}</pre>`;
  const btn = det.querySelector('[data-diag-copy]');
  if (btn) btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(json); toast('Interpretación copiada al portapapeles.'); }
    catch { toast('No se pudo copiar (revisa permisos del navegador).', 'warn'); }
  });
  return det;
}

function escucharInformes(unidadId) {
  if (state.unsubInformes) { state.unsubInformes(); state.unsubInformes = null; }
  state.unsubInformes = suscribirInformes(
    unidadId,
    (informes) => renderInformesUI(mergeInformes(unidadId, informes)),
    (err) => {
      console.warn('[pruebas-electricas] informes', err);
      renderInformesUI(mergeInformes(unidadId, []));
    }
  );
}

function seleccionarUnidad(u) {
  state.unidadActiva = u;
  state.bloquesCache.clear(); // cache de bloques es por unidad: invalida al cambiar
  marcarLibroActivo();
  // Sin libro seleccionado el tablero no muestra datos (solo el estado vacío).
  const scope = $('tablero-scope');
  if (scope) scope.classList.toggle('is-empty', !u);
  if (!u) { renderVacioSeleccion(); return; }
  // Hub del libro abierto en la Biblioteca (acceso a tablero/tendencia + informes/PDF).
  const libro = $('biblioteca-libro');
  if (libro) libro.hidden = false;
  const blSerie = $('bl-serie');
  if (blSerie) blSerie.textContent = u.serie || u.id || '—';
  renderIdentidad(u);
  renderNomenclatura(u);
  escucharInformes(u.id || u.serie);
}

/* ─── Estado vacío: nada se ilustra hasta elegir una serie ────── */
// Todo el interior del módulo (matriz, identidad, tablas, gráficas e
// historial) se deriva de una unidad. Sin serie seleccionada se muestra
// un prompt en cada contenedor y se resetean los KPIs por unidad.
function renderVacioSeleccion() {
  if (state.unsubInformes) { state.unsubInformes(); state.unsubInformes = null; }
  state.informes = [];
  const prompt = '<p class="muted small">Selecciona un número de serie para ilustrar esta sección.</p>';
  // Contenedores con prompt explícito (las secciones de detalle rígidas se
  // retiraron; el cuerpo del informe son los bloques).
  ['matrix', 'idgrid', 'reportlist'].forEach((id) => {
    const el = $(id); if (el) el.innerHTML = prompt;
  });
  if ($('bloques-cont')) {
    $('bloques-cont').innerHTML = '<p class="muted small">Selecciona una serie para ver su análisis detallado.</p>';
  }
  if ($('kpi-informes')) $('kpi-informes').textContent = '—';
  if ($('kpi-estado')) {
    $('kpi-estado').textContent = '—';
    $('kpi-estado').title = '';
  }
  // Oculta el hub del libro abierto (no hay unidad seleccionada).
  const libro = $('biblioteca-libro');
  if (libro) libro.hidden = true;
  if ($('tendencia-cont')) $('tendencia-cont').innerHTML = '<p class="muted small">Selecciona un libro para ver su tendencia.</p>';
}

/* ─── Borrado de informes (delegación sobre #reportlist) ──────── */

// Elimina una lista de informes en secuencia y reporta el resultado.
async function borrarVarios(unidadId, ids) {
  let ok = 0;
  for (const id of ids) {
    try { await eliminarInforme(unidadId, id); ok += 1; }
    catch (err) { console.error('[pruebas-electricas] eliminarInforme', id, err); }
  }
  return ok;
}

async function onClickReportlist(ev) {
  const u = state.unidadActiva || {};
  const unidadId = u.id || u.serie;
  if (!unidadId) return;
  const serieTxt = u.serie || unidadId;
  const rl = $('reportlist');

  // ── "Seleccionar todos" ──
  const selAll = ev.target.closest('[data-sel-all]');
  if (selAll) {
    const marcado = selAll.checked;
    rl.querySelectorAll('.pe-chk').forEach((c) => { c.checked = marcado; });
    return;
  }

  // ── "Eliminar todos" ──
  const allBtn = ev.target.closest('[data-del-all]');
  if (allBtn) {
    // Los informes base (_seed) son de solo lectura: no se eliminan.
    const eliminables = (state.informes || []).filter((i) => !i._seed && i.id);
    const total = eliminables.length;
    if (!total) return toast('No hay informes eliminables (los base son de solo lectura).', 'warn');
    if (!window.confirm(`¿Eliminar TODOS los ${total} informes de la serie ${serieTxt}?\n` +
        `Esta acción no se puede deshacer.`)) return;
    allBtn.disabled = true;
    allBtn.textContent = 'Eliminando…';
    const ids = eliminables.map((i) => i.id);
    const ok = await borrarVarios(unidadId, ids);
    toast(`${ok} de ${ids.length} informe(s) eliminado(s).`, ok === ids.length ? undefined : 'warn');
    // onSnapshot refresca la tabla sola.
    return;
  }

  // ── "Eliminar seleccionados" ──
  const selBtn = ev.target.closest('[data-del-sel]');
  if (selBtn) {
    const ids = Array.from(rl.querySelectorAll('.pe-chk:checked'))
      .map((c) => c.getAttribute('data-sel')).filter(Boolean);
    if (!ids.length) return toast('Marca al menos un informe.', 'warn');
    if (!window.confirm(`¿Eliminar ${ids.length} informe(s) seleccionado(s) de la serie ${serieTxt}?\n` +
        `Esta acción no se puede deshacer.`)) return;
    selBtn.disabled = true;
    selBtn.textContent = 'Eliminando…';
    const ok = await borrarVarios(unidadId, ids);
    toast(`${ok} de ${ids.length} informe(s) eliminado(s).`, ok === ids.length ? undefined : 'warn');
    return;
  }

  // ── Reprocesar (re-leer el PDF/imagen ya almacenado, sin re-subir) ──
  const rep = ev.target.closest('[data-reproc]');
  if (rep) {
    const informeId = rep.getAttribute('data-reproc');
    const inf = (state.informes || []).find((i) => i.id === informeId);
    if (!inf || !inf.pdf || !inf.pdf.storagePath) {
      return toast('Este informe no tiene archivo para reprocesar.', 'warn');
    }
    const etiqOrig = rep.textContent;
    rep.disabled = true;
    rep.textContent = '↻ Reprocesando…';
    try {
      // Re-extracción con IA SERVER-SIDE: la Cloud Function lee el PDF desde
      // Storage en el servidor (NO se descarga al navegador → sin CORS, L-29) y
      // re-extrae con la misma calidad que la carga. Re-deriva el FP de bujes
      // canónico, así reprocesar puebla bujes sin necesidad de re-subir.
      const r = await conTiempoLimite(
        extraerConIA({
          unidadId, serie: inf.serie || serieTxt,
          storagePath: inf.pdf.storagePath, filename: inf.pdf.filename || ''
        }),
        540000,
        'La IA no respondió en 9 min. Intenta de nuevo.'
      );
      const mediciones = r.mediciones || {};
      const bloquesIA = Array.isArray(r.bloques) ? r.bloques : [];
      if (mediciones.unidad) {
        try { await guardarUnidad({ serie: unidadId, ...mediciones.unidad }); } catch (e) { console.warn('[pruebas-electricas] identidad', e); }
      }
      const parche = sanitizarInforme({
        ...mediciones,
        unidadId, serie: inf.serie || serieTxt,
        ano: mediciones.ano != null ? mediciones.ano : inf.ano,
        fecha: mediciones.fecha || inf.fecha,
        bushing: derivarBushing(bloquesIA),
        pdf: { ...inf.pdf, estado: 'extraido_ia' }
      });
      await actualizarInforme(unidadId, informeId, parche);
      try {
        await guardarBloques(unidadId, informeId, bloquesIA, { ...(r.diagnostico || {}), mediciones_raw: mediciones });
      } catch (e) { console.warn('[pruebas-electricas] guardarBloques (reproceso)', e); }
      state.bloquesCache.delete(informeId); // fuerza recarga del análisis con lo nuevo
      console.info(`[pruebas-electricas] reproceso IA ${esc(serieTxt)} · ${inf.ano || 's/a'} · tokens`, r.usage);
      toast(`Informe ${inf.ano || ''} reprocesado con IA.`);
      // onSnapshot refresca la tabla sola.
    } catch (err) {
      console.error('[pruebas-electricas] reprocesar', err);
      rep.disabled = false;
      rep.textContent = etiqOrig;
      const detalle = (err && (err.code || err.message)) ? ` (${err.code || err.message})` : '';
      toast(`No se pudo reprocesar el informe${detalle}.`, 'warn');
    }
    return;
  }

  // ── Editar datos (captura manual de valores leídos del PDF) ──
  const ed = ev.target.closest('[data-edit]');
  if (ed) {
    const informeId = ed.getAttribute('data-edit');
    const inf = (state.informes || []).find((i) => i.id === informeId);
    if (!inf) return toast('No se encontró el informe a editar.', 'warn');
    if (inf._seed) return toast('Los informes base son de solo lectura.', 'warn');
    openEditor(unidadId, inf);
    return;
  }

  // ── Borrado uno a uno (botón por fila) ──
  const btn = ev.target.closest('[data-del]');
  if (!btn) return;
  const informeId = btn.getAttribute('data-del');
  const ano = btn.getAttribute('data-ano') || '';
  if (!informeId) return;
  if (!window.confirm(`¿Eliminar el informe ${ano} de la serie ${serieTxt}?\n` +
      `Esta acción no se puede deshacer.`)) return;
  btn.disabled = true;
  btn.textContent = 'Eliminando…';
  try {
    await eliminarInforme(unidadId, informeId);
    toast(`Informe ${ano} eliminado.`);
    // La suscripción onSnapshot refresca la tabla sola.
  } catch (err) {
    console.error('[pruebas-electricas] eliminarInforme', err);
    btn.disabled = false;
    btn.textContent = '🗑 Eliminar';
    toast('No se pudo eliminar el informe.', 'warn');
  }
}

/* ─── Arranque ────────────────────────────────────────────────── */

// Re-sincroniza el render con la serie elegida en el <select>: si la
// serie activa sigue en el parque la mantiene; si no, vuelve al vacío.
// NO auto-selecciona ninguna unidad: nada se ilustra hasta que el
// usuario elige una serie.
function sincronizarSeleccion() {
  if (!state.unidadActiva) { seleccionarUnidad(null); return; }
  const k = state.unidadActiva.id || state.unidadActiva.serie;
  const actual = state.unidades.find((u) => (u.id || u.serie) === k);
  seleccionarUnidad(actual || null);
}

// Llena la tabla "Criterios de calificación" (Ensayo|Fórmula|Criterio|Norma)
// desde el dominio normativo (CRITERIOS_NORMA) — fuente única, no HTML estático.
function renderCriteriosNorma() {
  const tb = $('criterios-norma-tbody');
  if (!tb) return;
  const LABELS = {
    tand: 'Tangente δ / FP', bushing: 'Factor de potencia de bujes (C1)',
    excitacion: 'Corriente de excitación', relacion: 'Relación de transformación',
    resistencia: 'Resistencia de devanados', aislamiento: 'Resistencia de aislamiento',
    collar: 'Collar caliente', drm: 'DRM · conmutador (OLTC)'
  };
  const orden = ['tand', 'bushing', 'excitacion', 'relacion', 'resistencia', 'aislamiento', 'collar', 'drm'];
  const filas = orden.filter((k) => CRITERIOS_NORMA[k]).map((k) => {
    const c = CRITERIOS_NORMA[k];
    return `<tr><td>${esc(LABELS[k] || k)}</td><td class="muted small">${esc(c.formula || '—')}</td>`
      + `<td>${esc(c.umbral || '—')}</td><td class="muted small">${esc(c.norma || '—')}</td></tr>`;
  }).join('');
  tb.innerHTML = filas || '<tr><td colspan="4" class="muted small">Sin criterios.</td></tr>';
}

function arrancar() {
  renderCriteriosNorma();
  const rl = $('reportlist');
  if (rl) rl.addEventListener('click', onClickReportlist);
  // Narrativa de tendencia (F3): botón on-demand, delegado en el contenedor
  // (se re-crea en cada render de la pestaña Tendencia).
  const tc = $('tendencia-cont');
  if (tc) tc.addEventListener('click', (e) => {
    if (e.target.closest('#btn-narrar')) onGenerarNarrativa();
  });
  // Hub del libro abierto: botones "Ver tablero / Ver tendencia".
  const libro = $('biblioteca-libro');
  if (libro) libro.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn) irATab(btn.getAttribute('data-goto'));
  });
  const pg = $('parque-grid');
  if (pg) pg.addEventListener('click', onClickParque);
  // La "X" de eliminar libros (y los borrados por informe) dependen de
  // esAdmin() → window.__sgmSession, que el session-guard resuelve de forma
  // ASÍNCRONA (auth + fetch del perfil). Si el snapshot de unidades renderiza
  // ANTES de que el rol esté listo, la X no aparece (intermitencia por
  // carrera). Al resolverse la sesión, re-render para que esAdmin() ya sea
  // verdadero. Si la sesión ya estaba lista, el primer render ya mostró la X.
  window.addEventListener('sgm:session-ready', () => {
    renderParqueGrid(state.unidades);
    if (state.unidadActiva) renderInformesUI(state.informes);
  });
  // Campo único de "Número de serie": digitable, no seleccionable. Filtra
  // los libros de la biblioteca en vivo y, al coincidir con una unidad,
  // abre su tablero. No usa <select> ni <datalist> (CLAUDE.md §0.1.2.12).
  const inp = $('serieInput');
  if (inp) {
    inp.addEventListener('input', () => {
      state.filtroBiblioteca = inp.value || '';
      renderParqueGrid(state.unidades);
      // Coincidencia exacta con una serie → selecciona esa unidad en vivo.
      const v = norm(inp.value).trim();
      const u = v
        ? state.unidades.find((x) => norm(x.serie || x.id).trim() === v)
        : null;
      seleccionarUnidad(u || null);
    });
    // Enter: si hay una única coincidencia, ábrela directo en el tablero.
    inp.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const hits = filtrarUnidades(state.unidades);
      if (hits.length === 1) {
        const u = hits[0];
        inp.value = u.serie || u.id;
        seleccionarUnidad(u);
        irAlTablero();
      }
    });
  }
  suscribirUnidades(
    (unidades) => {
      state.unidades = mergeUnidades(unidades);
      renderParqueGrid(state.unidades);
      refrescarKpisParque();
      sincronizarSeleccion();
    },
    (err) => {
      console.warn('[pruebas-electricas] unidades', err);
      // Sin backend solo queda el seed: la unidad base con sus 3 informes
      // históricos como punto de partida de la tendencia.
      state.unidades = mergeUnidades([]);
      renderParqueGrid(state.unidades);
      refrescarKpisParque();
      sincronizarSeleccion();
    }
  );
}

/* ══════════════════════════════════════════════════════════════
   Modal de carga de informe (serie → PDFs+año → confirmar)
   ──────────────────────────────────────────────────────────────
   Soporta VARIOS informes en una sola sesión: el paso 1 fija la
   serie (común a todos), el paso 2 adjunta N PDFs y a cada uno se
   le asigna su año (el año discrimina cada informe), y el paso 3
   confirma y almacena todos secuencialmente.
   ══════════════════════════════════════════════════════════════ */

// item: { id, file, ano, textoPdf }
// Modelos de IA disponibles para la extracción (cascada). El valor debe
// coincidir con la allowlist de la Cloud Function extraerPruebasElectricasIA.
const MODELOS_IA = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · equilibrado (recomendado)' },
  { id: 'claude-opus-4-7',   label: 'Opus 4.7 · máxima precisión (PDFs difíciles)' },
  { id: 'claude-haiku-4-5',  label: 'Haiku 4.5 · rápido y económico' }
];
const UP = { step: 1, serie: '', items: [], store: true, usarIA: true, modelId: 'claude-sonnet-4-6' };
let _itemSeq = 0;

function toast(msg, kind) {
  const t = $('toast');
  if (!t) return;
  t.className = 'pe-toast' + (kind ? ' ' + kind : '');
  t.innerHTML = `<span class="tk">${kind === 'warn' ? '⚠' : '✓'}</span><span>${esc(msg)}</span>`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3600);
}

function setStepbar() {
  ['sb1', 'sb2', 'sb3'].forEach((id, i) => {
    const el = $(id);
    if (!el) return;
    el.className = 'sbi' + (UP.step === i + 1 ? ' act' : (UP.step > i + 1 ? ' done' : ''));
  });
}

function openUpload() {
  UP.step = 1;
  // La carga se asocia a la serie indicada en el campo "Número de serie";
  // si está vacío, cae a la unidad abierta (si la hay).
  const tecleada = ($('serieInput') && $('serieInput').value.trim()) || '';
  UP.serie = tecleada || (state.unidadActiva && state.unidadActiva.serie) || '';
  UP.items = [];
  _itemSeq = 0;
  const ov = $('ov');
  if (ov) ov.classList.add('on');
  renderModal();
}

/* ¿Todos los ítems tienen un año válido y terminaron de leerse? */
function itemsListos() {
  return UP.items.length > 0 &&
    UP.items.every((it) => !it.leyendo &&
      Number.isInteger(it.ano) && it.ano >= 1950 && it.ano <= 2100);
}

function closeUpload() {
  const ov = $('ov');
  if (ov) ov.classList.remove('on');
  liberarOCR();
}

function renderModal() {
  setStepbar();
  const body = $('mBody');
  const title = $('mTitle');
  if (!body) return;
  if (UP.step === 1) {
    if (title) title.textContent = 'Cargar informes · serie';
    body.innerHTML =
      `<div class="flbl">Número de serie de la unidad</div>` +
      `<input class="inp" id="serIn" value="${esc(UP.serie)}" placeholder="173523-15510">` +
      `<p class="muted small" style="margin-top:10px">La serie es común a todos los informes que adjuntes. ` +
      `En el siguiente paso podrás añadir varios PDF, cada uno con su propio año.</p>` +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mCancel">Cancelar</button>` +
      `<button class="btn btn-primary" id="mNext1">Continuar</button></div>`;
    $('mCancel').onclick = closeUpload;
    $('mNext1').onclick = async () => {
      UP.serie = $('serIn').value.trim();
      if (!UP.serie) return toast('Ingresa el número de serie.', 'warn');
      // Materializa el doc padre de la unidad (docId = serie) en cuanto
      // se confirma la serie. Un padre con solo subcolección es
      // "fantasma" en Firestore y NO aparece en suscribirUnidades; al
      // hacer merge aquí, cualquier informe ya cargado bajo esta serie
      // (p. ej. los previos a este arreglo) emerge en tiempo real.
      if (isReady()) {
        try { await guardarUnidad({ serie: UP.serie }); }
        catch (e) { console.warn('[pruebas] no se pudo materializar la unidad:', e); }
      }
      UP.step = 2; renderModal();
    };
  } else if (UP.step === 2) {
    if (title) title.textContent = 'Cargar informes · PDF y año';
    const faltanAno = UP.items.some((it) => it.ano == null);
    const lista = UP.items.map((it) => {
      const anoVal = it.ano == null ? '' : it.ano;
      const flag = it.ano == null ? ' fi-falta' : '';
      const icono = esImagen(it.file) ? '🖼️' : '📄';
      return `<div class="fitem${flag}" data-id="${it.id}">` +
        `<span class="fi-doc">${icono}</span>` +
        `<span class="fi-name" title="${esc(it.file.name)}">${esc(it.file.name)}` +
        `<span class="fi-status" data-status="${it.id}">${esc(it.estado || '')}</span></span>` +
        `<input class="fi-ano" type="number" min="1950" max="2100" ` +
        `data-id="${it.id}" value="${anoVal}" placeholder="Año">` +
        `<button class="fi-del" data-id="${it.id}" title="Quitar">✕</button></div>`;
    }).join('');
    const hint = UP.items.length
      ? `<p class="muted small" style="margin:2px 0 10px">El año se detecta automáticamente del informe; ` +
        (faltanAno
          ? `escribe el año de los que aparecen resaltados.</p>`
          : `puedes corregirlo si hace falta.</p>`)
      : '';
    body.innerHTML =
      `<div class="drop" id="drop">Arrastra uno o varios informes (PDF o imagen) aquí o haz clic para elegirlos</div>` +
      `<input type="file" id="fileIn" accept="application/pdf,image/*" multiple style="display:none">` +
      (UP.items.length
        ? hint + `<div class="flist">${lista}</div>`
        : `<p class="muted small" style="margin-top:10px">Aún no has adjuntado informes.</p>`) +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mBack2">Atrás</button>` +
      `<button class="btn btn-primary" id="mNext2"${itemsListos() ? '' : ' disabled'}>Continuar</button></div>`;
    const drop = $('drop'); const fileIn = $('fileIn');
    drop.onclick = () => fileIn.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('drag'); };
    drop.ondragleave = () => drop.classList.remove('drag');
    drop.ondrop = (e) => {
      e.preventDefault(); drop.classList.remove('drag');
      agregarArchivos(e.dataTransfer.files);
    };
    fileIn.onchange = () => { agregarArchivos(fileIn.files); };
    body.querySelectorAll('.fi-ano').forEach((inp) => {
      inp.onchange = inp.oninput = () => {
        const it = UP.items.find((x) => x.id === Number(inp.dataset.id));
        if (it) it.ano = parseInt(inp.value, 10) || null;
        const nx = $('mNext2'); if (nx) nx.disabled = !itemsListos();
      };
    });
    body.querySelectorAll('.fi-del').forEach((btn) => {
      btn.onclick = () => {
        UP.items = UP.items.filter((x) => x.id !== Number(btn.dataset.id));
        renderModal();
      };
    });
    $('mBack2').onclick = () => { UP.step = 1; renderModal(); };
    $('mNext2').onclick = () => { if (itemsListos()) { UP.step = 3; renderModal(); } };
  } else {
    if (title) title.textContent = 'Cargar informes · confirmar';
    const filas = UP.items
      .slice().sort((a, b) => (a.ano || 0) - (b.ano || 0))
      .map((it) => {
        const chk = confirmarSerie(UP.serie, it.textoPdf);
        const verdict = !it.textoPdf
          ? `<span class="verdict wn"><span>⚠</span><span>Serie no verificada</span></span>`
          : chk.coincide
            ? `<span class="verdict gd"><span>✓</span><span>Serie coincide</span></span>`
            : `<span class="verdict bd"><span>✕</span><span>Serie NO hallada</span></span>`;
        return `<div class="crow">` +
          `<span class="cr-ano">${esc(it.ano)}</span>` +
          `<span class="cr-name" title="${esc(it.file.name)}">${esc(it.file.name)}</span>` +
          verdict + `</div>`;
      }).join('');
    body.innerHTML =
      `<div class="cmp" style="grid-template-columns:1fr">` +
      `<div class="cbox"><div class="ch">Serie ingresada</div><div class="cv">${esc(UP.serie)}</div></div></div>` +
      `<div class="flbl" style="margin-top:12px">Informes a almacenar (${UP.items.length})</div>` +
      `<div class="clist">${filas}</div>` +
      `<label class="chk"><input type="checkbox" id="store" ${UP.store ? 'checked' : ''}>` +
      `<span>Almacenar los informes y sus PDF originales (si Firebase está activo).</span></label>` +
      `<label class="chk"><input type="checkbox" id="usarIA" ${UP.usarIA ? 'checked' : ''}>` +
      `<span>Extraer las mediciones con IA (lee el PDF completo). Si falla o no hay saldo, se usa el lector local.</span></label>` +
      `<div class="flbl" id="iaModeloWrap" style="margin-top:10px${UP.usarIA ? '' : ';display:none'}">Modelo de IA` +
      `<select class="inp" id="iaModelo" style="margin-top:6px">` +
      MODELOS_IA.map((m) => `<option value="${m.id}"${m.id === UP.modelId ? ' selected' : ''}>${esc(m.label)}</option>`).join('') +
      `</select></div>` +
      `<label class="chk"><input type="checkbox" id="chk">` +
      `<span>Confirmo que los datos son correctos.</span></label>` +
      `<div class="mfoot">` +
      `<button class="btn btn-ghost" id="mBack3">Atrás</button>` +
      `<button class="btn btn-primary" id="mStore" disabled>Almacenar</button></div>`;
    $('store').onchange = (e) => { UP.store = e.target.checked; };
    $('usarIA').onchange = (e) => {
      UP.usarIA = e.target.checked;
      const w = $('iaModeloWrap'); if (w) w.style.display = UP.usarIA ? '' : 'none';
    };
    $('iaModelo').onchange = (e) => { UP.modelId = e.target.value; };
    $('chk').onchange = (e) => { $('mStore').disabled = !e.target.checked; };
    $('mBack3').onclick = () => { UP.step = 2; renderModal(); };
    $('mStore').onclick = storeReport;
  }
}

const RE_IMG = /^image\//;
function esImagen(file) { return !!file && RE_IMG.test(file.type || ''); }
function esPdf(file) { return !!file && file.type === 'application/pdf'; }

// Deduce el MIME por la extensión del nombre. Los informes subidos
// antes del fix de contentType quedaron como application/octet-stream
// en Storage, así que el blob descargado no se puede enrutar por su
// .type: la extensión del archivo manda para reprocesar.
function mimePorNombre(nombre) {
  const ext = String(nombre || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  switch (ext && ext[1]) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'tif': case 'tiff': return 'image/tiff';
    default: return '';
  }
}

/* Añade uno o varios archivos a UP.items (PDF o imagen) y extrae el
   texto de cada uno en segundo plano (capa de texto o, si el documento
   es un escaneo, OCR) para confirmar la serie y deducir el año. */
function agregarArchivos(fileList) {
  const archivos = Array.from(fileList || [])
    .filter((f) => esPdf(f) || esImagen(f));
  if (!archivos.length) {
    toast('Adjunta informes en PDF o imagen.', 'warn');
    return;
  }
  archivos.forEach((file) => {
    // Año deducido del nombre de archivo (determinista) antes de leer.
    const porNombre = detectarAno({ filename: file.name });
    const item = {
      id: ++_itemSeq, file, ano: porNombre.ano,
      textoPdf: '', leyendo: true, ocr: false, estado: 'En cola…'
    };
    UP.items.push(item);
    extraerTexto(item);
  });
  renderModal();
}

/* Un informe escaneado (imagen sin capa de texto) deja una capa de
   texto vacía o casi vacía. Si pdf.js devuelve menos de ~60 caracteres
   alfanuméricos en todo el documento, lo tratamos como escaneo y
   pasamos a OCR. */
function textoEsPobre(texto) {
  const alfa = String(texto || '').replace(/[^0-9a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g, '');
  return alfa.length < 60;
}

/* Refresca el rótulo de estado de un item sin re-renderizar todo el
   modal (el re-render perdería el foco de los inputs de año). */
function setItemEstado(item, txt) {
  item.estado = txt;
  if (UP.step !== 2) return;
  const node = document.querySelector(`[data-status="${item.id}"]`);
  if (node) node.textContent = txt;
}

/* ─── OCR (Tesseract.js) · carga perezosa desde CDN ───────────────
   Solo se descarga la primera vez que un informe lo necesita (un
   escaneo o una imagen). El worker se reutiliza entre informes y se
   libera al cerrar el modal. */
let _tessPromise = null;
let _ocrWorker = null;

function cargarTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (_tessPromise) return _tessPromise;
  _tessPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('No se pudo cargar el motor OCR.'));
    document.head.appendChild(s);
  });
  return _tessPromise;
}

async function obtenerWorkerOCR() {
  if (_ocrWorker) return _ocrWorker;
  const Tesseract = await cargarTesseract();
  // 'spa' = español (los informes son en español); incluye números.
  _ocrWorker = await Tesseract.createWorker('spa');
  return _ocrWorker;
}

function liberarOCR() {
  if (_ocrWorker) {
    try { _ocrWorker.terminate(); } catch (_) { /* noop */ }
    _ocrWorker = null;
  }
}

/* Acota una lectura a un tope de tiempo. Un escaneo pesado (descarga
   del motor OCR ~15 MB + reconocimiento de hasta 30 páginas) puede
   tardar muchos minutos; sin este tope el botón "Reprocesando…" se
   queda colgado para siempre. Al vencer libera el worker y rechaza
   con un mensaje accionable que el catch del handler muestra. */
function conTiempoLimite(promesa, ms, mensaje) {
  let id;
  const limite = new Promise((_, reject) => {
    id = setTimeout(() => {
      liberarOCR();
      reject(new Error(mensaje || `lectura agotada (${Math.round(ms / 1000)} s)`));
    }, ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(id));
}

/* Renderiza una página pdf.js a un canvas para alimentar el OCR. La
   escala ~2.2 sube la resolución efectiva: el texto pequeño de las
   tablas de medición se reconoce mucho mejor que a escala 1. */
async function paginaACanvas(page, escala = 2.2) {
  const viewport = page.getViewport({ scale: escala });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function ocrPaginasPdf(pdf, setEstado) {
  const worker = await obtenerWorkerOCR();
  let texto = '';
  const maxPag = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxPag; i++) {
    setEstado(`Leyendo escaneo (OCR) · página ${i} de ${maxPag}…`);
    const page = await pdf.getPage(i);
    const canvas = await paginaACanvas(page);
    const { data } = await worker.recognize(canvas);
    texto += ' ' + (data.text || '');
    // Liberar el canvas grande lo antes posible.
    canvas.width = canvas.height = 0;
  }
  return texto;
}

async function ocrImagenBlob(file, setEstado) {
  const worker = await obtenerWorkerOCR();
  setEstado('Leyendo imagen (OCR)…');
  const url = URL.createObjectURL(file);
  try {
    const { data } = await worker.recognize(url);
    return data.text || '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* Lee el texto de un archivo (File o Blob descargado de Storage) para
   confirmar la serie, deducir el año y alimentar al extractor de
   mediciones. Estrategia común a la carga y al reprocesado:
   1. PDF con capa de texto → pdf.js (rápido, exacto).
   2. PDF escaneado (capa de texto pobre) → OCR de cada página.
   3. Imagen (jpg/png/…) → OCR directo.
   El extractor de mediciones es conservador (rótulo + rango + ancla
   "%"): aun con ruido de OCR, prefiere dejar un valor vacío antes que
   asignar uno equivocado, así cada prueba mantiene su dato correcto.
   Devuelve { texto, ocr }. */
async function leerTextoArchivo(file, setEstado) {
  const aviso = setEstado || (() => {});
  let texto = '';
  let ocr = false;
  const pdfjs = window.pdfjsLib;
  const tipo = (file && file.type) || '';
  if (tipo === 'application/pdf' && pdfjs) {
    aviso('Leyendo PDF…');
    const buf = await file.arrayBuffer();
    // cMaps + standard fonts del MISMO CDN/versión del worker (3.11.174): sin
    // esto pdf.js emite "fetchStandardFontData failed (FoxitSymbol.pfb)" y puede
    // perder glifos de fuentes embebidas al extraer texto.
    const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
    const pdf = await pdfjs.getDocument({
      data: buf,
      cMapUrl: `${PDFJS_CDN}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_CDN}/standard_fonts/`
    }).promise;
    // Las mediciones (tan δ, excitación, etc.) viven en páginas
    // intermedias (4–8 típicamente); leer todo el informe acotado.
    const maxPag = Math.min(pdf.numPages, 30);
    for (let i = 1; i <= maxPag; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      texto += ' ' + tc.items.map((it) => it.str).join(' ');
    }
    if (textoEsPobre(texto)) {
      ocr = true;
      texto = await ocrPaginasPdf(pdf, aviso);
    }
  } else if (RE_IMG.test(tipo)) {
    ocr = true;
    texto = await ocrImagenBlob(file, aviso);
  }
  return { texto, ocr };
}

async function extraerTexto(item) {
  try {
    const { texto, ocr } = await conTiempoLimite(
      leerTextoArchivo(item.file, (t) => setItemEstado(item, t)),
      120000,
      'lectura agotada (2 min)'
    );
    item.textoPdf = texto;
    item.ocr = ocr;
  } catch (err) {
    console.warn('[pruebas-electricas] no se pudo extraer texto del informe', err);
  }
  // Si el nombre no dio año, intentar deducirlo del contenido leído.
  if (item.ano == null) {
    const det = detectarAno({ texto: item.textoPdf, filename: item.file.name });
    item.ano = det.ano;
  }
  item.leyendo = false;
  if (item.textoPdf && !textoEsPobre(item.textoPdf)) {
    setItemEstado(item, item.ocr ? 'Leído por OCR ✓' : 'Texto extraído ✓');
  } else {
    setItemEstado(item, 'Sin texto legible · se asignará la serie indicada');
  }
  if (UP.step === 2) renderModal();
}

// Deriva la métrica canónica de bujes desde los bloques de la IA (el FP de bujes
// vive en el bloque "bushing", no en las mediciones canónicas): peor tan δ
// medido + peor ΔC1 vs placa (capacitancia). Devuelve null si no hay bloque.
function derivarBushing(bloques) {
  const bs = (Array.isArray(bloques) ? bloques : []).filter((b) => b && /bushing|buje/i.test(b.prueba || ''));
  if (!bs.length) return null;
  let fpMax = null, dc1Max = null;
  for (const b of bs) {
    for (const s of (b.series || [])) {
      for (const p of (s.puntos || [])) {
        if (typeof p.y === 'number') fpMax = (fpMax == null) ? p.y : Math.max(fpMax, p.y);
        const ex = p.extra || {};
        const placa = Number(ex['Cap. placa (pF)'] ?? ex['Cap placa (pF)']);
        const med = Number(ex['Cap. medida (pF)'] ?? ex['Cap medida (pF)']);
        if (Number.isFinite(placa) && placa && Number.isFinite(med)) {
          const d = Math.abs((med - placa) / placa) * 100;
          dc1Max = (dc1Max == null) ? d : Math.max(dc1Max, d);
        }
      }
    }
  }
  if (fpMax == null && dc1Max == null) return null;
  return {
    fp_max_pct: fpMax != null ? +fpMax.toFixed(4) : null,
    dc1_max_pct: dc1Max != null ? +dc1Max.toFixed(3) : null
  };
}

// Busca un informe YA existente de la unidad que sea "el mismo": por FECHA exacta
// (dd/mm/aaaa, ignorando espacios) y, si el nuevo no trae fecha, por AÑO. Devuelve
// el informe existente o null. Dos ensayos de fechas distintas del mismo año NO
// colapsan (sólo se igualan por fecha exacta).
function fechaKey(s) { return String(s == null ? '' : s).replace(/\s/g, ''); }
function buscarInformeExistente(lista, fecha, ano) {
  const fk = fechaKey(fecha);
  if (fk) return (lista || []).find((e) => fechaKey(e.fecha) === fk) || null;
  if (ano != null) return (lista || []).find((e) => e.ano === ano) || null;
  return null;
}

async function storeReport() {
  // Dedupe de serie: si ya existe un libro cuya serie NORMALIZADA coincide con
  // la tecleada (mismo transformador escrito con otro formato de guiones/espacios),
  // se reutiliza su docId existente → los informes se agrupan en el MISMO libro y
  // la tendencia no se parte en dos. Si no hay match, se usa la serie tal cual.
  const claveSerie = normalizarSerie(UP.serie);
  const existente = (state.unidades || []).find(
    (u) => normalizarSerie(u.serie || u.id) === claveSerie
  );
  const unidadId = (existente && (existente.serie || existente.id)) || UP.serie;
  const body = $('mBody');
  const total = UP.items.length;
  const procHtml = (i) => `<div class="proc"><div class="spin"></div>` +
    `<div class="bigp">Procesando…</div>` +
    `<p class="muted small">Guardando informe ${i} de ${total} de ${esc(UP.serie)}.</p></div>`;
  body.innerHTML = procHtml(1);
  try {
    if (UP.store && isReady()) {
      const uid = (window.__sgmSession && window.__sgmSession.user && window.__sgmSession.user.uid) || null;
      // Materializa el doc de la unidad (docId = serie) antes de los
      // informes: un padre con solo subcolección es "fantasma" en
      // Firestore y NO aparece en la query de suscribirUnidades, así
      // que sin esto la unidad nunca se vería en el parque en vivo.
      await guardarUnidad({ serie: unidadId });
      // Informes ya existentes de la unidad → para detectar re-carga del MISMO
      // (por fecha exacta / año) y ofrecer reemplazar en vez de duplicar.
      const existentesUnidad = await listarInformes(unidadId).catch(() => []);
      const ordenados = UP.items.slice().sort((a, b) => (a.ano || 0) - (b.ano || 0));
      let i = 0;
      let identidadGuardada = false; // la placa se guarda una sola vez (primer informe que la traiga)
      for (const item of ordenados) {
        i += 1;
        body.innerHTML = procHtml(i);
        let pdfMeta = null;
        if (item.file) pdfMeta = await subirPDF(unidadId, item.file);
        // Extrae las 6 mediciones del texto del informe (capa de texto
        // del PDF u OCR del escaneo/imagen, ya dejado en item.textoPdf).
        // La traza _diagnostico ayuda a calibrar las expresiones contra
        // informes reales sin adivinar a ciegas.
        // Extracción de mediciones. Preferencia: IA (Claude lee el PDF
        // nativo, agnóstica al formato) → si falla/sin saldo, fallback al
        // lector local regex/OCR. El editor manual queda como última red.
        let mediciones = null;
        let estado = 'pendiente_extraccion';
        let anoIA = null;
        let bloquesIA = null;
        let diagIA = null;
        if (UP.usarIA && pdfMeta && pdfMeta.storagePath && esPdf(item.file)) {
          try {
            setItemEstado(item, 'Analizando con IA…');
            const r = await extraerConIA({
              unidadId, serie: UP.serie,
              storagePath: pdfMeta.storagePath, filename: pdfMeta.filename,
              modelId: UP.modelId
            });
            mediciones = r.mediciones || {};
            bloquesIA = Array.isArray(r.bloques) ? r.bloques : [];
            // Diagnóstico de extracción (ADR-007): resumen+usage del server +
            // la interpretación cruda (mediciones) para persistir e inspeccionar.
            diagIA = { ...(r.diagnostico || {}), mediciones_raw: mediciones };
            anoIA = mediciones.ano != null ? mediciones.ano : null;
            // La IA también leyó la placa de características: enriquece el
            // doc de la unidad (fabricante, potencia, tensiones, etc.) una
            // sola vez. guardarUnidad usa merge + deepClean → no pisa lo ya
            // guardado con vacíos. Falla suave: no aborta el informe.
            if (mediciones.unidad && !identidadGuardada) {
              try {
                await guardarUnidad({ serie: unidadId, ...mediciones.unidad });
                identidadGuardada = true;
              } catch (e) {
                console.warn('[pruebas-electricas] no se pudo guardar la identidad de la unidad', e);
              }
            }
            estado = 'extraido_ia';
            console.info(`[pruebas-electricas] IA ${r.modelUsed} ${esc(UP.serie)} · ${anoIA || item.ano || 's/a'} · tokens`, r.usage);
          } catch (err) {
            console.warn('[pruebas-electricas] IA falló, fallback al lector local', err);
            toast('IA no disponible: se usó el lector local.', 'warn');
          }
        }
        if (!mediciones) {
          // Extrae las 6 mediciones del texto del informe (capa de texto
          // del PDF u OCR del escaneo/imagen, ya dejado en item.textoPdf).
          const med = extraerMediciones(item.textoPdf || '');
          const { _diagnostico, ...rest } = med;
          mediciones = rest;
          estado = _diagnostico.campos.length ? 'extraido' : 'pendiente_extraccion';
          console.info(`[pruebas-electricas] extracción ${esc(UP.serie)} · ${item.ano || 's/a'} →`,
            _diagnostico.campos.length ? _diagnostico.campos.join(', ') : 'sin datos',
            _diagnostico.traza);
        }
        const informe = sanitizarInforme({
          ...mediciones,
          unidadId, serie: UP.serie,
          ano: anoIA != null ? anoIA : item.ano,
          // FP de bujes canónico (la IA solo lo trae en el bloque): se deriva el
          // peor tan δ y la peor ΔC1 vs placa → discrimina bujes del transformador.
          bushing: derivarBushing(bloquesIA),
          pdf: pdfMeta ? { ...pdfMeta, estado } : undefined
        });
        // Upsert por fecha/año: si ya existe el MISMO informe, preguntar si
        // REEMPLAZAR (borra el anterior + su PDF) o crear uno nuevo. Evita
        // duplicados al re-cargar; el director tiene el control.
        const prev = buscarInformeExistente(existentesUnidad, informe.fecha, informe.ano);
        if (prev) {
          const etq = informe.fecha || (informe.ano != null ? String(informe.ano) : 's/f');
          const reemplazar = window.confirm(
            `Ya existe un informe de ${etq} para la serie ${UP.serie}.\n\n` +
            `Aceptar = REEMPLAZAR (se borra el anterior y su PDF).\n` +
            `Cancelar = crear uno NUEVO (quedarán ambos).`
          );
          if (reemplazar) {
            if (prev.pdf && prev.pdf.storagePath) await eliminarPDF(prev.pdf.storagePath).catch(() => {});
            await eliminarInforme(unidadId, prev.id).catch((e) => console.warn('[pruebas-electricas] no se pudo borrar el informe a reemplazar', e));
            const idx = existentesUnidad.findIndex((e) => e.id === prev.id);
            if (idx >= 0) existentesUnidad.splice(idx, 1);
          }
        }
        const nuevoId = await crearInforme(unidadId, informe, uid);
        // Registra el nuevo en la lista local para detectar duplicados de los
        // SIGUIENTES items del mismo lote.
        existentesUnidad.push({ id: nuevoId, fecha: informe.fecha, ano: informe.ano, pdf: informe.pdf });
        // Diagnóstico de extracción (ADR-007) → Firestore subcol perezosa.
        // Se persiste SIEMPRE que la IA corrió (aunque bloques esté vacío): el
        // diagnóstico vacío también es señal. Falla suave: el informe queda
        // almacenado aunque el diagnóstico no se persista.
        if (diagIA) {
          try {
            await guardarBloques(unidadId, nuevoId, bloquesIA || [], diagIA);
          } catch (e) {
            console.warn('[pruebas-electricas] no se pudo guardar el diagnóstico de extracción', e);
          }
        }
      }
      body.innerHTML = `<div class="proc"><div class="okc">✓</div>` +
        `<div class="bigp">${total === 1 ? 'Informe almacenado' : `${total} informes almacenados`}</div>` +
        `<p class="muted small">La matriz y las tablas se actualizarán en vivo.</p></div>`;
      setTimeout(closeUpload, 1400);
      toast(total === 1 ? 'Informe almacenado.' : `${total} informes almacenados.`);
    } else {
      body.innerHTML = `<div class="proc"><div class="okc">✓</div>` +
        `<div class="bigp">Modo demostración</div>` +
        `<p class="muted small">Firebase no está activo: los informes no se persistieron. ` +
        `Conecta el backend para almacenar.</p></div>`;
      setTimeout(closeUpload, 1800);
      toast('Sin backend: informes no persistidos.', 'warn');
    }
  } catch (err) {
    console.error('[pruebas-electricas] storeReport', err);
    body.innerHTML = `<div class="proc"><div class="bigp">No se pudo almacenar</div>` +
      `<p class="muted small">${esc(err.message || err)}</p>` +
      `<div class="mfoot"><button class="btn btn-ghost" id="mClose">Cerrar</button></div></div>`;
    const c = $('mClose'); if (c) c.onclick = closeUpload;
    toast('Error al almacenar los informes.', 'warn');
  }
}

/* ══════════════════════════════════════════════════════════════
   Editor de datos · captura manual de un informe
   ──────────────────────────────────────────────────────────────
   Los informes subidos son escaneos: el OCR del navegador no extrae
   sus valores de forma fiable, así que el tablero queda vacío. En vez
   de inventar números, este editor permite transcribir a mano lo que
   el ingeniero lee en el PDF. Reusa el overlay #ov/#mBody/#mTitle (no
   el flujo de carga). Al guardar persiste con actualizarInforme y el
   onSnapshot refresca matriz, tablas y gráficas en vivo.
   ══════════════════════════════════════════════════════════════ */

const CONFIGS_TAND = ['CH', 'CHL', 'CL', 'CLT', 'CT', 'CHT'];
const DEVANADOS_RES = ['AT', 'MT', 'BT'];
const ED = { unidadId: '', informeId: '', inf: null, model: null };

// número editable → string para el input (null/undefined → '')
function nstr(v) { return v == null ? '' : String(v); }
// string del input → número o null (admite coma decimal)
function nparse(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Construye el modelo editable desde un informe existente.
function modeloDesdeInforme(inf) {
  const tand = {};
  CONFIGS_TAND.forEach((c) => { tand[c] = ''; });
  (inf.tand || []).forEach((t) => {
    if (t && t.code && Object.prototype.hasOwnProperty.call(tand, t.code)) {
      tand[t.code] = nstr(t.valor_pct);
    }
  });
  const res = DEVANADOS_RES.map((dev) => {
    const r = (inf.resistencia || []).find((x) => (x.devanado || '').toUpperCase() === dev) || {};
    return {
      devanado: dev,
      delta_max_pct: nstr(r.delta_max_pct),
      verificar: !!r.verificar,
      no_medido: !!r.no_medido
    };
  });
  const rel = (inf.relacion || []).map((r) => ({
    devanado: r.devanado || 'AT',
    asociado: r.asociado || '',
    desviacion_pct: nstr(r.desviacion_pct)
  }));
  if (!rel.length) rel.push({ devanado: 'AT', asociado: 'MT', desviacion_pct: '' });
  const ais = (inf.aislamiento || []).map((a) => ({
    devanado: a.devanado || '',
    asociado: a.asociado || '',
    gohm: nstr(a.gohm)
  }));
  const drm = inf.drm || {};
  const drmOn = drm.tiempo_min_ms != null || drm.tiempo_max_ms != null;
  return {
    ano: nstr(inf.ano),
    fecha: inf.fecha || '',
    ejecutante: inf.ejecutante || '',
    equipo: inf.equipo || '',
    tand,
    excitacion_delta: nstr(inf.excitacion && inf.excitacion.delta_ext_pct),
    relacion: rel,
    resistencia: res,
    aislamiento: ais,
    collar_mw: nstr(inf.collar && inf.collar.max_mw),
    drmOn,
    drm_min: nstr(drm.tiempo_min_ms),
    drm_max: nstr(drm.tiempo_max_ms)
  };
}

function openEditor(unidadId, inf) {
  ED.unidadId = unidadId;
  ED.informeId = inf.id;
  ED.inf = inf;
  ED.model = modeloDesdeInforme(inf);
  const ov = $('ov');
  if (ov) {
    ov.classList.add('on');
    const sb = ov.querySelector('.stepbar');
    if (sb) sb.style.display = 'none'; // el editor no es multipaso
  }
  renderEditor();
}

// Vuelca lo escrito en el DOM al modelo antes de un re-render
// (añadir/quitar fila) para no perder lo ya tecleado.
function cosecharEditor() {
  const m = ED.model;
  if (!m) return;
  const g = (id) => { const e = $(id); return e ? e.value : ''; };
  m.ano = g('ed_ano');
  m.fecha = g('ed_fecha');
  m.ejecutante = g('ed_ejec');
  m.equipo = g('ed_equipo');
  CONFIGS_TAND.forEach((c) => { m.tand[c] = g('ed_tand_' + c); });
  m.excitacion_delta = g('ed_exc');
  m.collar_mw = g('ed_collar');
  m.resistencia.forEach((r, i) => {
    r.delta_max_pct = g('ed_res_d_' + i);
    const v = $('ed_res_v_' + i); if (v) r.verificar = v.checked;
    const n = $('ed_res_n_' + i); if (n) r.no_medido = n.checked;
  });
  m.relacion.forEach((r, i) => {
    r.devanado = g('ed_rel_dev_' + i);
    r.asociado = g('ed_rel_aso_' + i);
    r.desviacion_pct = g('ed_rel_d_' + i);
  });
  m.aislamiento.forEach((a, i) => {
    a.devanado = g('ed_ais_dev_' + i);
    a.asociado = g('ed_ais_aso_' + i);
    a.gohm = g('ed_ais_g_' + i);
  });
  const on = $('ed_drm_on'); if (on) m.drmOn = on.checked;
  m.drm_min = g('ed_drm_min');
  m.drm_max = g('ed_drm_max');
}

function renderEditor() {
  const m = ED.model;
  const body = $('mBody');
  const title = $('mTitle');
  if (!body || !m) return;
  if (title) title.textContent = `Editar datos · ${esc(ED.inf.ano || ED.inf.id)}`;

  const tandInputs = CONFIGS_TAND.map((c) =>
    `<label class="ed-cell"><span>${c}</span>` +
    `<input class="inp" id="ed_tand_${c}" type="text" inputmode="decimal" ` +
    `value="${esc(m.tand[c])}" placeholder="%"></label>`
  ).join('');

  const resRows = m.resistencia.map((r, i) =>
    `<div class="ed-row" style="grid-template-columns:48px 1fr auto auto">` +
    `<span class="ed-dev">${r.devanado}</span>` +
    `<input class="inp" id="ed_res_d_${i}" type="text" inputmode="decimal" ` +
    `value="${esc(r.delta_max_pct)}" placeholder="desbalance %">` +
    `<label class="ed-flag"><input type="checkbox" id="ed_res_v_${i}" ${r.verificar ? 'checked' : ''}> verificar</label>` +
    `<label class="ed-flag"><input type="checkbox" id="ed_res_n_${i}" ${r.no_medido ? 'checked' : ''}> no medido</label>` +
    `</div>`
  ).join('');

  const relRows = m.relacion.map((r, i) =>
    `<div class="ed-row" style="grid-template-columns:1fr 1fr 1fr auto" data-rel="${i}">` +
    `<input class="inp" id="ed_rel_dev_${i}" type="text" value="${esc(r.devanado)}" placeholder="Devanado (AT)">` +
    `<input class="inp" id="ed_rel_aso_${i}" type="text" value="${esc(r.asociado)}" placeholder="Asociado (MT / Terc.)">` +
    `<input class="inp" id="ed_rel_d_${i}" type="text" inputmode="decimal" value="${esc(r.desviacion_pct)}" placeholder="desv. %">` +
    `<button type="button" class="fi-del" data-rel-del="${i}" title="Quitar">✕</button>` +
    `</div>`
  ).join('');

  const aisRows = m.aislamiento.length
    ? m.aislamiento.map((a, i) =>
        `<div class="ed-row" style="grid-template-columns:1fr 1fr 1fr auto" data-ais="${i}">` +
        `<input class="inp" id="ed_ais_dev_${i}" type="text" value="${esc(a.devanado)}" placeholder="Devanado (P)">` +
        `<input class="inp" id="ed_ais_aso_${i}" type="text" value="${esc(a.asociado)}" placeholder="Asociado (Tierra)">` +
        `<input class="inp" id="ed_ais_g_${i}" type="text" inputmode="decimal" value="${esc(a.gohm)}" placeholder="GΩ">` +
        `<button type="button" class="fi-del" data-ais-del="${i}" title="Quitar">✕</button>` +
        `</div>`
      ).join('')
    : `<p class="muted small" style="margin:0 0 8px">Sin medidas de aislamiento. Agrega una si el informe las trae.</p>`;

  body.innerHTML =
    `<p class="muted small" style="margin:0 0 14px">Transcribe los valores tal como aparecen en el PDF. ` +
    `Deja en blanco lo que el informe no mida (mejor vacío que inventado). La calificación se recalcula sola.</p>` +

    `<div class="ed-grid2">` +
    `<label class="ed-cell"><span>Año</span><input class="inp" id="ed_ano" type="text" inputmode="numeric" value="${esc(m.ano)}" placeholder="2025"></label>` +
    `<label class="ed-cell"><span>Fecha</span><input class="inp" id="ed_fecha" type="text" value="${esc(m.fecha)}" placeholder="09/08/2025"></label>` +
    `</div>` +
    `<div class="ed-grid2">` +
    `<label class="ed-cell"><span>Ejecutante</span><input class="inp" id="ed_ejec" type="text" value="${esc(m.ejecutante)}" placeholder="Applus"></label>` +
    `<label class="ed-cell"><span>Equipo</span><input class="inp" id="ed_equipo" type="text" value="${esc(m.equipo)}" placeholder="DOBLE M4100"></label>` +
    `</div>` +

    `<div class="flbl" style="margin-top:14px">tan δ por sección (%)</div>` +
    `<div class="ed-tand">${tandInputs}</div>` +

    `<div class="ed-grid2" style="margin-top:14px">` +
    `<label class="ed-cell"><span>Excitación · Δ corr. máx (%)</span><input class="inp" id="ed_exc" type="text" inputmode="decimal" value="${esc(m.excitacion_delta)}" placeholder="4.41"></label>` +
    `<label class="ed-cell"><span>Collar caliente · máx (mW)</span><input class="inp" id="ed_collar" type="text" inputmode="decimal" value="${esc(m.collar_mw)}" placeholder="49"></label>` +
    `</div>` +

    `<div class="flbl" style="margin-top:14px">Relación de transformación · desviación (%)</div>` +
    `<div id="ed_rel">${relRows}</div>` +
    `<button type="button" class="btn btn-ghost btn-sm" id="ed_rel_add" style="margin-top:6px">+ Añadir relación</button>` +

    `<div class="flbl" style="margin-top:14px">Resistencia de devanados · desbalance (%)</div>` +
    `<div id="ed_res">${resRows}</div>` +

    `<div class="flbl" style="margin-top:14px">Resistencia de aislamiento (GΩ)</div>` +
    `<div id="ed_ais">${aisRows}</div>` +
    `<button type="button" class="btn btn-ghost btn-sm" id="ed_ais_add" style="margin-top:6px">+ Añadir aislamiento</button>` +

    `<label class="chk" style="margin-top:16px"><input type="checkbox" id="ed_drm_on" ${m.drmOn ? 'checked' : ''}>` +
    `<span>Este informe incluye prueba DRM del conmutador (OLTC).</span></label>` +
    `<div class="ed-grid2" id="ed_drm_box" style="${m.drmOn ? '' : 'display:none'}">` +
    `<label class="ed-cell"><span>Tiempo transición mín (ms)</span><input class="inp" id="ed_drm_min" type="text" inputmode="decimal" value="${esc(m.drm_min)}" placeholder="56"></label>` +
    `<label class="ed-cell"><span>Tiempo transición máx (ms)</span><input class="inp" id="ed_drm_max" type="text" inputmode="decimal" value="${esc(m.drm_max)}" placeholder="66"></label>` +
    `</div>` +

    `<div class="mfoot">` +
    `<button class="btn btn-ghost" id="ed_cancel">Cancelar</button>` +
    `<button class="btn btn-primary" id="ed_save">Guardar datos</button></div>`;

  $('ed_cancel').onclick = closeUpload;
  $('ed_save').onclick = saveEditor;
  $('ed_rel_add').onclick = () => {
    cosecharEditor();
    m.relacion.push({ devanado: 'AT', asociado: '', desviacion_pct: '' });
    renderEditor();
  };
  $('ed_ais_add').onclick = () => {
    cosecharEditor();
    m.aislamiento.push({ devanado: '', asociado: '', gohm: '' });
    renderEditor();
  };
  const drmOn = $('ed_drm_on');
  if (drmOn) drmOn.onchange = () => {
    const box = $('ed_drm_box');
    if (box) box.style.display = drmOn.checked ? '' : 'none';
  };
  body.querySelectorAll('[data-rel-del]').forEach((b) => {
    b.onclick = () => {
      cosecharEditor();
      m.relacion.splice(Number(b.dataset.relDel), 1);
      if (!m.relacion.length) m.relacion.push({ devanado: 'AT', asociado: 'MT', desviacion_pct: '' });
      renderEditor();
    };
  });
  body.querySelectorAll('[data-ais-del]').forEach((b) => {
    b.onclick = () => {
      cosecharEditor();
      m.aislamiento.splice(Number(b.dataset.aisDel), 1);
      renderEditor();
    };
  });
}

// Arma el parche normativo desde el modelo editado, lo valida y lo persiste.
async function saveEditor() {
  cosecharEditor();
  const m = ED.model;
  const inf = ED.inf;
  const tand = CONFIGS_TAND.map((c) => ({ code: c, valor_pct: nparse(m.tand[c]) }));
  const relacion = m.relacion
    .filter((r) => (r.asociado || '').trim() !== '' || nparse(r.desviacion_pct) != null)
    .map((r) => ({
      devanado: (r.devanado || 'AT').trim() || 'AT',
      asociado: (r.asociado || '').trim(),
      desviacion_pct: nparse(r.desviacion_pct)
    }));
  const resistencia = m.resistencia
    .filter((r) => nparse(r.delta_max_pct) != null || r.verificar || r.no_medido)
    .map((r) => {
      const o = { devanado: r.devanado };
      if (r.no_medido) o.no_medido = true;
      else o.delta_max_pct = nparse(r.delta_max_pct);
      if (r.verificar) o.verificar = true;
      return o;
    });
  const aislamiento = m.aislamiento
    .filter((a) => (a.devanado || '').trim() !== '' && nparse(a.gohm) != null)
    .map((a) => ({
      devanado: (a.devanado || '').trim(),
      asociado: (a.asociado || '').trim(),
      gohm: nparse(a.gohm)
    }));
  const excDelta = nparse(m.excitacion_delta);
  const collarMw = nparse(m.collar_mw);
  const entrada = {
    unidadId: ED.unidadId,
    serie: inf.serie || ED.unidadId,
    serie_en_pdf: inf.serie_en_pdf || '',
    tipo: inf.tipo,
    tipo_prueba: inf.tipo_prueba,
    ano: nparse(m.ano),
    fecha: (m.fecha || '').trim(),
    ejecutante: (m.ejecutante || '').trim(),
    equipo: (m.equipo || '').trim(),
    tand,
    excitacion: excDelta == null ? {} : { devanado: 'AT', delta_ext_pct: excDelta },
    relacion,
    resistencia,
    aislamiento,
    collar: collarMw == null ? {} : { max_mw: collarMw },
    pdf: inf.pdf ? { ...inf.pdf, estado: 'procesado' } : undefined
  };
  if (m.drmOn) {
    const lo = nparse(m.drm_min);
    const hi = nparse(m.drm_max);
    entrada.drm = {
      conmutador: (inf.drm && inf.drm.conmutador) || {},
      tiempo_min_ms: lo,
      tiempo_max_ms: hi,
      transiciones: (inf.drm && inf.drm.transiciones) || []
    };
  }

  const limpio = sanitizarInforme(entrada);
  const errs = validarInforme(limpio);
  if (errs.length) return toast(errs[0], 'warn');

  const btn = $('ed_save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  try {
    await actualizarInforme(ED.unidadId, ED.informeId, limpio);
    toast(`Datos del informe ${limpio.ano || ''} guardados.`);
    closeUpload(); // onSnapshot refresca matriz, tablas y gráficas
  } catch (err) {
    console.error('[pruebas-electricas] saveEditor', err);
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar datos'; }
    const detalle = (err && (err.code || err.message)) ? ` (${err.code || err.message})` : '';
    toast(`No se pudieron guardar los datos${detalle}.`, 'warn');
  }
}

// El HTML usa onclick="openUpload()"/"closeUpload()" → exponer en window
window.openUpload = openUpload;
window.closeUpload = closeUpload;

// Configura pdf.js worker si la librería cargó
if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar);
} else {
  arrancar();
}
