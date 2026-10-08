// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Mapa geográfico de Colombia (Etapa 1)
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-07): «construyendo el mapa geográfico de Colombia en un máximo nivel».
// Etapa 1: límites oficiales DANE MGN 2025 (país, 33 departamentos, 138 municipios del área AFINIA y, a
// pedido, los 1.122 del país), zonas AFINIA (aproximadas), el parque resumido por departamento con su salud
// oficial, buscador, filtros y ficha lateral. Etapa 2 (2026-10-08, 99 §153): cada subestación con posición
// validada (/subestaciones/{código de la matrícula}) es un punto del color de su peor salud, y al acercarse
// se ven sus transformadores. Una sola lectura del parque y otra de las subestaciones por visita.
// Lógica pura → domain/mapa_parque.js. Geografía → assets/geo/ (se regenera con scripts/mapa-geo/).
// ══════════════════════════════════════════════════════════════

import { listarV2, isReady } from '../../data/transformadores.js';
import { listar as listarSubestaciones } from '../../data/subestaciones.js';
import { LIMITE_TRANSFORMADORES } from '../../domain/limites_lectura.js';
import { CONDICIONES, ZONAS, DEPARTAMENTOS, TIPOS_ACTIVO } from '../../domain/schema.js';
// municipioDeSubestacionMapa usa la tabla oficial de municipio por subestación (Fichas, 2026-09-10): S/E de cada municipio.
// `?v=157`: el dominio cambió (filtros múltiples y CRG); la versión evita mezclar este archivo con uno viejo en caché (L-102).
import { DPTO_DANE, DANE_DE_DPTO, COLOR_ZONA, resumenParque, buscarEnMapa, municipioDeSubestacionMapa,
  indiceUbicaciones } from '../../domain/mapa_parque.js?v=157';

const $ = (id) => document.getElementById(id);
const GEO = '../assets/geo/';
const COLOMBIA = [[-4.25, -81.9], [13.45, -66.85]];          // incluye San Andrés y Providencia
const ZOOM_MPIOS = 8;                                          // municipios del área AFINIA desde aquí
const ZOOM_NOMBRES_MPIO = 10;                                  // nombres de municipio desde aquí
const ZOOM_NUMERO_SE = 9;                                      // el punto de la S/E muestra cuántos TX tiene
const ZOOM_DETALLE_SE = 12;                                    // nombre de la S/E y sus transformadores
const COLOR_BANDA = Object.fromEntries(CONDICIONES.map((c) => [c.value, c.color]));
const NOMBRE_BANDA = Object.fromEntries(CONDICIONES.map((c) => [c.value, c.label]));
const NOMBRE_DEPTO = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.value, d.label]));
const NOMBRE_ZONA = Object.fromEntries(ZONAS.map((z) => [z.value, z.label]));
const NOMBRE_TIPO = Object.fromEntries(TIPOS_ACTIVO.map((t) => [t.value, t.label]));

const estado = {
  mapa: null, txs: [], parqueError: null, resumen: null,
  capas: {}, rotulos: null, nombresMpio: null, seleccion: null, resaltado: null,
  municipios: [], afiniaBounds: null, filtros: { bandas: [], crgs: [], soloFirmes: false },
  capasDepto: {}, capasMpio: {}, capasMpioPais: {}, subsPorMun: new Map(), munDeSub: new Map(), lienzo: null,
  ubicaciones: new Map(), ubicacionesError: null, marcadores: new Map(), grupoPuntos: null,
  cargas: null, mesScada: null, cargasError: null
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt = (n) => Number(n || 0).toLocaleString('es-CO');

async function leerTopo(nombre) {
  const r = await fetch(GEO + nombre);
  if (!r.ok) throw new Error(`no se pudo leer ${nombre} (${r.status})`);
  return r.json();
}
const capaDeTopo = (topo, objeto) => window.topojson.feature(topo, topo.objects[objeto || Object.keys(topo.objects)[0]]);

/* ─────────────────────────── Mapa y fondos ─────────────────────────── */

function crearMapa() {
  const L = window.L;
  // Zoom ENTERO: con medios niveles el fondo se estira y se ve borroso.
  const mapa = L.map('mcMapa', { zoomSnap: 1, minZoom: 5, maxZoom: 18, zoomControl: true });
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  mapa.attributionControl.addAttribution('Límites: <a href="https://geoportal.dane.gov.co/" target="_blank" rel="noopener">DANE – MGN 2025</a>');
  mapa.fitBounds(COLOMBIA);
  // UN solo lienzo para todas las capas vectoriales: con un lienzo por capa, el de encima se quedaba con todos los
  // clics (los municipios no respondían). En un solo lienzo gana lo último dibujado: municipios sobre departamentos.
  estado.lienzo = L.canvas({ padding: 0.5 });
  // Rótulos y nombres DEBAJO de los puntos de subestación (marcadores, 600) y encima de los límites (400): un rótulo de
  // departamento no tapa ningún punto.
  mapa.createPane('mc-rotulos').style.zIndex = '590';
  mapa.getPane('mc-rotulos').style.pointerEvents = 'none';

  // Fondos gratuitos y sin clave (CARTO pasó a exigir clave y mostraba marcas de agua).
  const fondoMapa = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, className: 'mc-fondo-suave', zIndex: 1,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>'
  });
  const fondoRelieve = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, subdomains: 'abc', zIndex: 2,
    attribution: 'Datos: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>, SRTM | Estilo: © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC-BY-SA</a>)'
  });
  fondoMapa.addTo(mapa);
  vigilarFondo(fondoMapa, fondoRelieve, mapa);
  // Mapa y Relieve se encienden a voluntad (casillas, no opción única: pedido del Ingeniero 2026-10-08). Con los dos, el
  // relieve va encima a media transparencia para ver ambos; solo, a pleno.
  // Solo si el relieve está en el mapa: con él apagado no tiene contenedor y setOpacity falla (se ajusta al encenderlo).
  const mezclar = () => { if (mapa.hasLayer(fondoRelieve)) fondoRelieve.setOpacity(mapa.hasLayer(fondoMapa) ? 0.5 : 1); };
  mapa.on('layeradd layerremove', (e) => { if (e.layer === fondoMapa || e.layer === fondoRelieve) mezclar(); });
  estado.fondos = { 'Mapa (OpenStreetMap)': fondoMapa, 'Relieve (OpenTopoMap)': fondoRelieve };
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(mapa);
  mapa.on('zoomend', clasesZoom);
  return mapa;
}

/** Si el fondo falla DE VERDAD se ofrece el otro: 6 teselas fallidas en 15 s y, 4 s después, ninguna buena en los
 *  últimos 6 s. Los errores sueltos al volar de un sitio a otro no cuentan (antes el aviso parpadeaba con el fondo a la vista). */
function vigilarFondo(fondo, alterno, mapa) {
  let fallas = [];
  let ultimaBuena = 0;
  let revision = null;
  fondo.on('tileerror', () => {
    const t = Date.now();
    fallas = fallas.filter((x) => t - x < 15000).concat(t);
    if (fallas.length < 6 || revision) return;
    revision = setTimeout(() => {
      revision = null;
      if (Date.now() - ultimaBuena > 6000 && mapa.hasLayer(fondo)) $('mcFondoAviso').hidden = false;
    }, 4000);
  });
  fondo.on('tileload', () => { ultimaBuena = Date.now(); $('mcFondoAviso').hidden = true; });
  fondo.on('remove', () => { $('mcFondoAviso').hidden = true; });   // apagado a propósito: no hay nada que avisar
  $('mcCambiarFondo').addEventListener('click', () => {
    mapa.removeLayer(fondo);
    alterno.addTo(mapa);
    $('mcFondoAviso').hidden = true;
  });
}

/* ─────────────────────────── Botones del mapa ─────────────────────────── */

function controlesVista(mapa) {
  const L = window.L;
  const C = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const d = L.DomUtil.create('div', 'leaflet-bar mc-vistas');
      d.innerHTML = '<a href="#" role="button" data-v="col" title="Ver toda Colombia">Colombia</a>' +
        '<a href="#" role="button" data-v="afinia" title="Ver el Caribe de AFINIA">Caribe AFINIA</a>' +
        '<a href="#" role="button" data-v="full" title="Ampliar el mapa (Esc para volver)">⛶ Ampliar</a>';
      L.DomEvent.disableClickPropagation(d);
      d.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        if (a.dataset.v === 'col') mapa.flyToBounds(COLOMBIA, { duration: 0.8 });
        else if (a.dataset.v === 'afinia' && estado.afiniaBounds) mapa.flyToBounds(estado.afiniaBounds, { padding: [20, 20], duration: 0.8 });
        else if (a.dataset.v === 'full') pantallaCompleta();
      });
      return d;
    }
  });
  new C().addTo(mapa);
}

/** «Ampliar»: el mapa y su ficha ocupan la ventana. Con CSS y no con la API de pantalla completa, que dentro del
 *  iframe de la pestaña (sin allowfullscreen) y en iPhone no responde. Esc vuelve. */
function pantallaCompleta(forzar) {
  const on = typeof forzar === 'boolean' ? forzar : !document.body.classList.contains('mc-ampliado');
  document.body.classList.toggle('mc-ampliado', on);
  const a = document.querySelector('.mc-vistas [data-v="full"]');
  if (a) { a.textContent = on ? '✕ Salir' : '⛶ Ampliar'; a.title = on ? 'Volver a la página (Esc)' : 'Ampliar el mapa (Esc para volver)'; }
  setTimeout(() => estado.mapa && estado.mapa.invalidateSize(), 60);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('mc-ampliado')) pantallaCompleta(false); });

/* ─────────────────────────── Geografía ─────────────────────────── */

async function cargarGeografia() {
  const L = window.L;
  const mapa = estado.mapa;
  const [deptos, afinia, rotulos] = await Promise.all([
    leerTopo('colombia-departamentos.topo.json'), leerTopo('afinia-servicio.topo.json'), leerTopo('rotulos.json')]);
  estado.rotulos = rotulos;

  const R = estado.lienzo;
  // Cada capa guarda su estilo BASE: el resaltado y el paso del ratón vuelven siempre a él (no a un estilo ya tocado).
  const conBase = (estilo) => (f, l) => { l._mcBase = estilo(f); };

  // 33 departamentos: trazo fino; los de fuera de AFINIA, un velo suave para que resalte la zona de servicio.
  const estiloDpto = (f) => ({ color: '#5b6b80', weight: 0.9, opacity: 0.85, fill: !DPTO_DANE[f.properties.cod],
    fillColor: '#0d1f38', fillOpacity: 0.035 });
  const capaDptos = L.geoJSON(capaDeTopo(deptos), {
    renderer: R, style: estiloDpto,
    onEachFeature: (f, l) => { conBase(estiloDpto)(f, l); l.bindTooltip(titulo(f.properties.nom), { sticky: true, className: 'mc-tip' }); }
  });

  // Zonas AFINIA (aproximadas): solo color; su nombre va en la ficha y en la leyenda (no roba clics).
  const capaZonas = L.geoJSON(capaDeTopo(afinia, 'zonas'), {
    renderer: R, interactive: false,
    style: (f) => ({ color: COLOR_ZONA[f.properties.zona] || '#64748b', weight: 1.4, dashArray: '6 5',
      fillColor: COLOR_ZONA[f.properties.zona] || '#64748b', fillOpacity: 0.09 })
  });

  // 5 departamentos de AFINIA: borde marcado y clic → ficha.
  const estiloAfinia = () => ({ color: '#0d1f38', weight: 2.2, opacity: 0.9, dashArray: null, fillColor: '#2563EB', fillOpacity: 0.0001 });
  const capaAfinia = L.geoJSON(capaDeTopo(afinia, 'dptos'), {
    renderer: R, style: estiloAfinia,
    onEachFeature: (f, l) => {
      conBase(estiloAfinia)(f, l);
      const dep = DPTO_DANE[f.properties.dpto];
      l.bindTooltip(`${esc(NOMBRE_DEPTO[dep] || dep)} · clic para ver su parque`, { sticky: true, className: 'mc-tip' });
      l.on('click', () => seleccionar({ tipo: 'departamento', dep, capa: l }));
      l.on('mouseover', () => { if (l !== estado.resaltado) l.setStyle({ weight: 3.2 }); });
      l.on('mouseout', () => { if (l !== estado.resaltado) l.setStyle(l._mcBase); });
    }
  });
  estado.afiniaBounds = capaAfinia.getBounds();
  capaAfinia.eachLayer((l) => { estado.capasDepto[DPTO_DANE[l.feature.properties.dpto]] = l; });

  // 138 municipios del área AFINIA (desde el zoom 8).
  const fcM = capaDeTopo(afinia, 'mpios');
  estado.municipios = fcM.features.map((f) => ({ cod: f.properties.cod, nom: titulo(f.properties.nom), dpto: f.properties.dpto, zona: f.properties.zona }));
  const estiloMpio = () => ({ color: '#4d6485', weight: 0.8, dashArray: '2 3', opacity: 0.9, fillColor: '#2563EB', fillOpacity: 0.0001 });
  const capaMpios = L.geoJSON(fcM, {
    renderer: R, style: estiloMpio,
    onEachFeature: (f, l) => {
      conBase(estiloMpio)(f, l);
      l.bindTooltip(`${esc(titulo(f.properties.nom))} · ${esc(f.properties.cod)} · zona ${esc(NOMBRE_ZONA[f.properties.zona] || f.properties.zona)}`, { sticky: true, className: 'mc-tip' });
      l.on('click', () => seleccionar({ tipo: 'municipio', mun: { cod: f.properties.cod, nom: titulo(f.properties.nom), dpto: f.properties.dpto, zona: f.properties.zona }, capa: l }));
    }
  });
  capaMpios.eachLayer((l) => { estado.capasMpio[l.feature.properties.cod] = l; });

  // Nombres de municipio (desde el zoom 10).
  estado.nombresMpio = L.layerGroup(fcM.features.filter((f) => rotulos.mpios[f.properties.cod]).map((f) =>
    L.marker(rotulos.mpios[f.properties.cod], { pane: 'mc-rotulos', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'mc-nombre-mpio', html: esc(titulo(f.properties.nom)), iconSize: null }) })));

  // Municipios de todo el país: solo si se piden (≈186 KB comprimidos).
  const capaPais = L.layerGroup();
  estado.capaPais = capaPais;
  capaPais.on('add', () => { cargarMunicipiosPais().catch(() => {}); });

  // Los interruptores del control prenden un GRUPO; el zoom decide qué se dibuja dentro (así el
  // interruptor no se apaga solo al alejarse).
  estado.grupoMpios = L.layerGroup();
  estado.grupoRotulos = L.layerGroup();
  capaDptos.addTo(mapa); capaZonas.addTo(mapa); capaAfinia.addTo(mapa);
  estado.grupoMpios.addTo(mapa); estado.grupoRotulos.addTo(mapa);
  estado.capas = {
    'Departamentos de Colombia (33)': capaDptos,
    'Zonas AFINIA (aproximadas)': capaZonas,
    'Departamentos de AFINIA (clic: ficha)': capaAfinia,
    'Municipios del área AFINIA (138, desde más cerca)': estado.grupoMpios,
    'Rótulos con el parque por departamento': estado.grupoRotulos,
    'Municipios de todo el país (1.122)': capaPais
  };
  estado.capaMpios = capaMpios;
  mapa.on('overlayadd overlayremove zoomend', porZoom);
  porZoom();
  mapa.flyToBounds(estado.afiniaBounds, { padding: [16, 16], duration: 0.9 });
}

/** Los 1.122 municipios del país (una sola vez): capa y lista para el buscador. */
let promesaPais = null;
function cargarMunicipiosPais() {
  if (promesaPais) return promesaPais;
  const L = window.L;
  promesaPais = (async () => {
    const t = await leerTopo('colombia-municipios.topo.json');
    const fc = capaDeTopo(t);
    const estilo = () => ({ color: '#8093ad', weight: 0.5, opacity: 0.8, fill: true, fillOpacity: 0.0001, fillColor: '#2563EB', dashArray: null });
    // Sin los 138 de AFINIA (ya dibujados encima): así no se pisan ni se roban el clic.
    const capa = L.geoJSON(fc, { renderer: estado.lienzo, style: estilo, filter: (f) => !estado.capasMpio[f.properties.cod],
      onEachFeature: (f, l) => {
        l._mcBase = estilo();
        estado.capasMpioPais[f.properties.cod] = l;
        l.bindTooltip(`${esc(titulo(f.properties.nom))} (${esc(titulo(f.properties.dnom))}) · ${esc(f.properties.cod)}`, { sticky: true, className: 'mc-tip' });
      } });
    estado.capaPais.addLayer(capa);
    estado.municipiosPais = fc.features.filter((f) => !estado.capasMpio[f.properties.cod]).map((f) => ({ cod: f.properties.cod, nom: titulo(f.properties.nom), dpto: f.properties.dpto, dnom: titulo(f.properties.dnom) }));
    return estado.municipiosPais;
  })().catch((err) => { promesaPais = null; aviso('No se pudieron leer los municipios del país: ' + err.message, 'err'); throw err; });
  return promesaPais;
}

/** Dentro de cada grupo encendido, lo que toca a este zoom: municipios desde el 8, sus nombres desde el 10,
 *  rótulos de departamento entre el 6 y el 10. */
function porZoom() {
  const m = estado.mapa;
  if (!m || !estado.grupoMpios) return;
  const z = m.getZoom();
  const poner = (grupo, capa, si) => {
    if (!capa) return;
    if (si && !grupo.hasLayer(capa)) grupo.addLayer(capa);
    if (!si && grupo.hasLayer(capa)) grupo.removeLayer(capa);
  };
  poner(estado.grupoMpios, estado.capaMpios, z >= ZOOM_MPIOS);
  poner(estado.grupoMpios, estado.nombresMpio, z >= ZOOM_NOMBRES_MPIO);
  poner(estado.grupoRotulos, estado.capaRotulos, z >= 6 && z <= 10);
}

/** Los puntos de S/E crecen con el zoom: número de transformadores desde el 9; nombre y transformadores desde el 12.
 *  Registrado al crear el mapa: funciona aunque la geografía no cargue. */
function clasesZoom() {
  const m = estado.mapa;
  if (!m) return;
  const z = m.getZoom();
  const c = m.getContainer();
  c.classList.toggle('mc-z-num', z >= ZOOM_NUMERO_SE);
  c.classList.toggle('mc-z-det', z >= ZOOM_DETALLE_SE);
}

/* ─────────────────────────── Parque ─────────────────────────── */

async function cargarParque() {
  if (!isReady()) { estado.parqueError = 'Firebase no configurado: el mapa muestra solo la geografía.'; return; }
  // Nunca hay más subestaciones que transformadores: el mismo tope de lectura.
  const [parque, subs] = await Promise.allSettled([listarV2({}), listarSubestaciones({ limite: LIMITE_TRANSFORMADORES })]);
  if (parque.status === 'fulfilled') estado.txs = parque.value;
  else {
    console.warn('[mapa] parque:', parque.reason);
    estado.parqueError = 'No se pudo leer el parque (' + ((parque.reason && parque.reason.message) || parque.reason) + '). El mapa muestra solo la geografía.';
  }
  if (subs.status === 'fulfilled') estado.ubicaciones = indiceUbicaciones(subs.value);
  else {
    console.warn('[mapa] subestaciones:', subs.reason);
    estado.ubicacionesError = 'No se pudieron leer las posiciones de las subestaciones: el mapa las resume por departamento y municipio.';
  }
}

function recalcular() {
  estado.resumen = resumenParque(estado.txs, estado.filtros, estado.ubicaciones, estado.cargas);
  // La ficha abierta se re-lee del resumen nuevo (los filtros cambian sus transformadores y su peor salud).
  const sel = estado.seleccion;
  if (sel && sel.tipo === 'subestacion') {
    const nueva = estado.resumen.subestaciones.find((x) => x.clave === sel.sub.clave);
    // Si el filtro la deja fuera, la ficha sigue (su posición no cambia) pero sin transformadores y lo dice.
    sel.sub = nueva || { ...sel.sub, tx: [], fueraDeFiltro: true };
  }
  indexarMunicipios();
  pintarRotulos();
  pintarPuntos();
  pintarPanel();
  pintarConteos();
}

/** ¿Hay algún filtro puesto? (una lista vacía no cuenta) */
const hayFiltros = () => { const f = estado.filtros; return Boolean(f.zona || f.departamento || f.tipo || (f.bandas || []).length || (f.crgs || []).length || f.soloFirmes); };

/* ─────────────────────────── Puntos de subestación ─────────────────────────── */

/** Un punto por S/E con posición validada y algún transformador que pase los filtros: color = su peor salud,
 *  número = cuántos tiene; de cerca, su nombre y una ficha por transformador (clic → la S/E con ese equipo). */
function pintarPuntos() {
  const L = window.L;
  if (!estado.mapa || !L) return;
  if (!estado.grupoPuntos) estado.grupoPuntos = L.layerGroup().addTo(estado.mapa);
  estado.grupoPuntos.clearLayers();
  estado.marcadores = new Map();
  const r = estado.resumen;
  if (!r) return;
  for (const s of r.subestaciones) {
    if (!s.coordenada) continue;
    const color = s.peor == null ? '#94a3b8' : COLOR_BANDA[s.peor];
    const fichas = s.tx.map((t) => `<i data-tx="${esc(t.id)}" style="--c:${t.banda == null ? '#94a3b8' : COLOR_BANDA[t.banda]}" title="${esc(t.matricula || t.codigo)} · ${t.mva == null ? '—' : fmt(t.mva) + ' MVA'} · ${esc(t.banda == null ? 'Sin dato' : NOMBRE_BANDA[t.banda])}${estado.cargas ? ' · carga SCADA ' + esc(textoCarga(t)) : ''}">${esc(t.etiqueta || t.matricula || '?')}</i>`).join('');
    const mk = L.marker(s.coordenada, {
      riseOnHover: true, keyboard: true,
      icon: L.divIcon({ className: 'mc-se', iconSize: null,
        html: `<span class="mc-se-punto" style="--c:${color}"><b>${s.tx.length}</b></span><span class="mc-se-nom">${esc(s.nombre)}</span><span class="mc-se-tx">${fichas}</span>` })
    });
    mk.bindTooltip(`S/E ${esc(s.nombre)} · ${s.tx.length} TX · peor salud: ${esc(s.peor == null ? 'sin dato' : NOMBRE_BANDA[s.peor])}`, { direction: 'top', offset: [0, -10], className: 'mc-tip' });
    mk.on('click', (e) => {
      const t = e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest && e.originalEvent.target.closest('[data-tx]');
      seleccionar({ tipo: 'subestacion', sub: s, tx: t ? t.dataset.tx : null });
    });
    // El resaltado se aplica cada vez que el punto entra al mapa (Leaflet rehace el ícono al prender la capa).
    mk.on('add', () => marcarActivo(s.clave, mk));
    estado.grupoPuntos.addLayer(mk);
    estado.marcadores.set(s.clave, mk);
  }
  // La capa aparece en el control solo cuando hay posiciones (sin documentos, el mapa queda como en §152).
  if (estado.controlCapas && !estado.puntosEnControl && estado.ubicaciones.size) {
    estado.controlCapas.addOverlay(estado.grupoPuntos, 'Subestaciones (posición validada)');
    estado.puntosEnControl = true;
  }
}

/** Marca el punto (y la ficha del transformador) de la selección vigente; desmarca los demás. */
function marcarActivo(clave, mk) {
  const el = mk.getElement();
  if (!el) return;
  const sel = estado.seleccion;
  const activa = Boolean(sel && sel.tipo === 'subestacion' && sel.sub.coordenada && sel.sub.clave === clave);
  el.classList.toggle('mc-se-activa', activa);
  el.querySelectorAll('[data-tx]').forEach((i) => i.classList.toggle('mc-tx-activo', activa && i.dataset.tx === sel.tx));
}

/** Municipio (DIVIPOLA) de cada subestación por la tabla oficial de Fichas, sin adivinar (regla en el dominio). */
function indexarMunicipios() {
  estado.subsPorMun = new Map();
  estado.munDeSub = new Map();
  if (!estado.resumen || !estado.municipios.length) return;
  for (const s of estado.resumen.subestaciones) {
    const cod = municipioDeSubestacionMapa(s, estado.municipios);
    if (!cod) continue;
    estado.munDeSub.set(s.clave, cod);
    if (!estado.subsPorMun.has(cod)) estado.subsPorMun.set(cod, []);
    estado.subsPorMun.get(cod).push(s);
  }
}
const municipioPorCodigo = (cod) => estado.municipios.find((m) => m.cod === cod) ||
  (estado.municipiosPais || []).find((m) => m.cod === cod) || null;

/** Rótulo por departamento AFINIA: «CÓRDOBA · 59 TX · 42 S/E» + barra de salud. Resume el departamento registrado: no es una ubicación. */
function pintarRotulos() {
  const L = window.L;
  if (estado.capaRotulos && estado.grupoRotulos) estado.grupoRotulos.removeLayer(estado.capaRotulos);
  if (!estado.rotulos) return;
  const r = estado.resumen;
  const marcas = Object.entries(DPTO_DANE).map(([cod, dep]) => {
    const x = (r && r.porDepartamento[dep]) || { transformadores: 0, subestaciones: 0, bandas: {} };
    const p = estado.rotulos.dptos[cod];
    if (!p) return null;
    return L.marker(p, { pane: 'mc-rotulos', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'mc-rotulo', iconSize: null,
        html: `<b>${esc((NOMBRE_DEPTO[dep] || dep).toUpperCase())}</b><span>${fmt(x.transformadores)} TX · ${fmt(x.subestaciones)} S/E</span>${barraSalud(x.bandas, x.transformadores)}` }) });
  }).filter(Boolean);
  estado.capaRotulos = L.layerGroup(marcas);
  porZoom();
}

function barraSalud(bandas, total) {
  if (!total) return '<i class="mc-barra-salud vacia"></i>';
  return barra([1, 2, 3, 4, 5, 'sin'].map((k) => [bandas[k], k === 'sin' ? '#cbd5e1' : COLOR_BANDA[k], k === 'sin' ? 'Sin dato' : NOMBRE_BANDA[k]]));
}
/** Barra apilada: [[cantidad, color, nombre], …] (los tramos en cero no se dibujan). */
function barra(tramos) {
  const seg = tramos.filter(([n]) => n).map(([n, c, t]) => `<i style="flex:${n};background:${c}" title="${esc(t)}: ${n}"></i>`).join('');
  return seg ? `<span class="mc-barra-salud">${seg}</span>` : '<i class="mc-barra-salud vacia"></i>';
}

function chipBanda(b) {
  if (b == null) return '<span class="mc-chip" style="--c:#94a3b8">Sin dato</span>';
  return `<span class="mc-chip" style="--c:${COLOR_BANDA[b]}">${esc(NOMBRE_BANDA[b])}</span>`;
}

/* ─────────────────────────── Ficha lateral ─────────────────────────── */

function pintarPanel() {
  const p = $('mcPanel');
  const r = estado.resumen;
  const s = estado.seleccion;
  const municipio = s && s.tipo === 'municipio';
  if (estado.parqueError && !estado.txs.length) {
    p.innerHTML = `<p class="mc-nota err">${esc(estado.parqueError)}</p>` + (municipio ? fichaMunicipio(s.mun) : '');
  } else if (!r) {
    // El parque aún no llega (la geografía carga primero): solo la ficha de municipio puede pintarse ya.
    p.innerHTML = municipio ? fichaMunicipio(s.mun) : '<p class="mc-cargando">Leyendo el parque…</p>';
  } else if (!s) p.innerHTML = panelGeneral(r);
  else if (s.tipo === 'departamento') p.innerHTML = fichaDepartamento(s.dep, r);
  else if (municipio) p.innerHTML = fichaMunicipio(s.mun);
  else if (s.tipo === 'subestacion') p.innerHTML = fichaSubestacion(s.sub);
  const desdePanel = { desdePanel: true };
  p.querySelectorAll('[data-dep]').forEach((b) => b.addEventListener('click', () => seleccionar({ tipo: 'departamento', dep: b.dataset.dep, capa: estado.capasDepto[b.dataset.dep] }, desdePanel)));
  p.querySelectorAll('[data-volver]').forEach((b) => b.addEventListener('click', () => seleccionar(null, desdePanel)));
  p.querySelectorAll('[data-mun]').forEach((b) => b.addEventListener('click', () => {
    const mun = municipioPorCodigo(b.dataset.mun);
    if (mun) seleccionar({ tipo: 'municipio', mun }, desdePanel);
  }));
  p.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => {
    const sub = r && r.subestaciones.find((x) => x.clave === b.dataset.sub);
    if (sub) seleccionar({ tipo: 'subestacion', sub }, desdePanel);
  }));
}

function panelGeneral(r) {
  const filas = (obj, nombres, attr) => Object.entries(obj).sort((a, b) => b[1].transformadores - a[1].transformadores).map(([k, x]) =>
    `<tr ${attr ? `data-dep="${esc(k)}" class="mc-clic"` : ''}><td>${esc(nombres[k] || k)}</td><td class="n">${fmt(x.transformadores)}</td><td class="n">${fmt(x.subestaciones)}</td><td>${barraSalud(x.bandas, x.transformadores)}</td></tr>`).join('');
  const filtrado = hayFiltros();
  return `<h2>Parque en el mapa${filtrado ? ' <small>(filtrado)</small>' : ''}</h2>
    <div class="mc-kpis"><div><b>${fmt(r.total)}</b><span>transformadores</span></div><div><b>${fmt(r.subestaciones.length)}</b><span>subestaciones</span></div>
      <div class="${r.ubicadas ? '' : 'mc-pend'}"><b>${fmt(r.ubicadas)} de ${fmt(r.subestaciones.length)}</b><span>con ubicación validada</span></div></div>
    ${!r.total ? '<p class="mc-nota">Ningún transformador cumple los filtros actuales.</p>' : r.ubicadas ? notaPuntos(r) : estado.ubicacionesError ? `<p class="mc-nota err">${esc(estado.ubicacionesError)}</p>` : `<p class="mc-nota">Las subestaciones aún no tienen coordenadas validadas: el parque se resume por el <b>departamento registrado</b>, y ${fmt(estado.munDeSub.size)} de ${fmt(r.subestaciones.length)} ya se ubican en su <b>municipio</b> por la tabla oficial de Fichas (clic en un municipio para verlas).</p>`}
    <h3>Salud oficial</h3>${barraSalud(r.bandas, r.total)}
    <ul class="mc-leyenda">${CONDICIONES.map((c) => `<li><i style="background:${c.color}"></i>${esc(c.label)} <b>${fmt(r.bandas[c.value])}</b></li>`).join('')}${r.bandas.sin ? `<li><i style="background:#cbd5e1"></i>Sin dato <b>${fmt(r.bandas.sin)}</b></li>` : ''}</ul>
    ${bloqueCargaPanel(r)}
    <h3>Por departamento <small>(clic para ver)</small></h3>
    <table class="mc-tabla"><thead><tr><th>Departamento</th><th class="n">TX</th><th class="n">S/E</th><th>Salud</th></tr></thead><tbody>${filas(r.porDepartamento, NOMBRE_DEPTO, true)}</tbody></table>
    <h3>Por zona</h3>
    <table class="mc-tabla"><thead><tr><th>Zona</th><th class="n">TX</th><th class="n">S/E</th><th>Salud</th></tr></thead><tbody>${filas(r.porZona, NOMBRE_ZONA, false)}</tbody></table>`;
}

/** Leyenda de los puntos y las S/E que aún no tienen posición (se le piden al Ingeniero). */
function notaPuntos(r) {
  const sin = r.subestaciones.filter((s) => !s.coordenada);
  return `<p class="mc-nota">Cada punto es una subestación: su <b>color</b> es la peor salud de sus transformadores y el
      <b>número</b>, cuántos tiene. De cerca se ven su nombre y cada transformador (clic en uno para abrirlo).</p>
    ${sin.length ? `<h3>Sin posición validada <small>(${fmt(sin.length)})</small></h3>${listaSubestaciones(sin)}` : ''}`;
}

function listaSubestaciones(subs) {
  if (!subs.length) return '<p class="mc-nota">Ninguna con los filtros actuales.</p>';
  return `<ul class="mc-subs">${subs.map((s) => `<li><button type="button" class="mc-sub" data-sub="${esc(s.clave)}">
      ${chipBanda(s.peor)}<span class="mc-sub-nom">S/E ${esc(s.nombre)}</span><span class="mc-sub-n">${s.tx.length} TX</span></button></li>`).join('')}</ul>`;
}

function fichaDepartamento(dep, r) {
  const x = r.porDepartamento[dep] || { transformadores: 0, subestaciones: 0, bandas: {}, mva: 0 };
  const subs = r.subestaciones.filter((s) => s.departamento === dep);
  const cod = DANE_DE_DPTO[dep];
  const nMpios = estado.municipios.filter((m) => m.dpto === cod).length;
  return `<button type="button" class="mc-volver" data-volver>← Todo el parque</button>
    <h2>${esc(NOMBRE_DEPTO[dep] || dep)} <small>DANE ${esc(cod || '—')}</small></h2>
    <div class="mc-kpis"><div><b>${fmt(x.transformadores)}</b><span>transformadores</span></div><div><b>${fmt(x.subestaciones)}</b><span>subestaciones</span></div><div><b>${fmt(x.mva)}</b><span>MVA</span></div></div>
    ${barraSalud(x.bandas, x.transformadores)}
    <p class="mc-nota">${nMpios ? `${fmt(nMpios)} municipios del área AFINIA en este departamento. ` : ''}Conteos por <b>departamento registrado</b> en el parque.</p>
    <h3>Subestaciones <small>(la de peor salud primero)</small></h3>${listaSubestaciones(subs)}`;
}

function fichaSubestacion(s) {
  const cod = estado.munDeSub.get(s.clave);
  const mun = cod && municipioPorCodigo(cod);
  return `<button type="button" class="mc-volver" data-volver>← Todo el parque</button>
    <h2>S/E ${esc(s.nombre)}</h2>
    <p class="mc-meta">${esc(NOMBRE_DEPTO[s.departamento] || s.departamento)} · zona ${esc(NOMBRE_ZONA[s.zona] || s.zona || '—')}${mun ? ` · <button type="button" class="mc-enlace" data-mun="${esc(cod)}">${esc(mun.nom)}</button>` : ''}</p>
    ${s.fueraDeFiltro ? '<p class="mc-nota mc-pend">Ninguno de sus transformadores cumple los filtros actuales.</p>' : ''}
    ${s.porRevisar ? `<p class="mc-nota mc-pend">Posición por revisar: ${esc(s.porRevisar)}, no de esta subestación.</p>` : ''}
    ${s.coordenada ? bloquePosicion(s) : `<p class="mc-nota mc-pend">Aún sin posición validada: se resalta ${mun ? 'su <b>municipio</b> según la tabla oficial de Fichas' : 'su <b>departamento registrado</b> (la tabla oficial no trae su municipio)'}.</p>`}
    <table class="mc-tabla"><thead><tr><th>Transformador</th><th class="n">MVA</th><th>Salud</th><th>Carga SCADA${estado.mesScada ? ` <small>${esc(mesCorto(estado.mesScada))}</small>` : ''}</th></tr></thead><tbody>
    ${s.tx.map((t) => `<tr class="${estado.seleccion && estado.seleccion.tx === t.id ? 'mc-fila-activa' : ''}"><td><code>${esc(t.matricula || t.codigo)}</code><small class="mc-tipo">${esc(NOMBRE_TIPO[t.tipo] || t.tipo || '')}</small></td><td class="n">${t.mva == null ? '—' : fmt(t.mva)}</td><td>${chipBanda(t.banda)}</td><td>${celdaCarga(t)}</td></tr>`).join('')}
    </tbody></table>`;
}

/** Posición de la S/E y de dónde sale (documento de /subestaciones y su `ubicacion_fuente`). */
function bloquePosicion(s) {
  const [lat, lng] = s.coordenada;
  const u = s.ubicacion || {};
  const f = u.fuente || {};
  const coord = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const origen = u.editadaAMano ? 'Posición editada a mano después de la carga (sin procedencia registrada).'
    : [f.archivo ? `Archivo «${f.archivo}»${f.fecha_fuente ? ' (' + f.fecha_fuente + ')' : ''}` : '', u.confianza ? `confianza ${u.confianza}` : '', u.verificacion].filter(Boolean).join(' · ');
  return `<div class="mc-posicion">
      <span><b>Posición</b> ${esc(coord)}${u.municipio ? ` · ${esc(u.municipio)}` : ''}</span>
      <a href="https://www.google.com/maps?q=${encodeURIComponent(lat.toFixed(6) + ',' + lng.toFixed(6))}" target="_blank" rel="noopener">Abrir en Google Maps ↗</a>
      ${origen ? `<small>${esc(origen)}</small>` : ''}
    </div>`;
}

function fichaMunicipio(m) {
  const dep = DPTO_DANE[m.dpto];
  const afinia = Boolean(estado.capasMpio[m.cod]);
  const subs = estado.subsPorMun.get(m.cod) || [];
  const ntx = subs.reduce((n, s) => n + s.tx.length, 0);
  const filtrado = hayFiltros();
  let cuerpo;
  if (!afinia) cuerpo = '<p class="mc-nota">Fuera del área de servicio de AFINIA.</p>';
  else if (!estado.resumen) cuerpo = '<p class="mc-cargando">Leyendo el parque…</p>';
  else if (!subs.length) cuerpo = `<p class="mc-nota">${filtrado ? 'Ninguna subestación del parque con los filtros actuales' : 'Ninguna subestación del parque'} en este municipio, según la tabla oficial de Fichas.</p>`;
  else cuerpo = `<div class="mc-kpis"><div><b>${fmt(ntx)}</b><span>transformadores</span></div><div><b>${fmt(subs.length)}</b><span>subestaciones</span></div>
      <div><b>${esc(NOMBRE_ZONA[m.zona] || m.zona || '—')}</b><span>zona</span></div></div>
    <h3>Subestaciones <small>(municipio por la tabla oficial de Fichas)</small></h3>${listaSubestaciones(subs)}`;
  return `<button type="button" class="mc-volver" data-volver>← Todo el parque</button>
    <h2>${esc(m.nom)} <small>DIVIPOLA ${esc(m.cod)}</small></h2>
    <p class="mc-meta">${esc(dep ? NOMBRE_DEPTO[dep] : (m.dnom || m.dpto))}${afinia ? ' · área AFINIA' : ''}</p>
    ${cuerpo}
    ${dep ? `<button type="button" class="btn-secondary" data-dep="${esc(dep)}">Ver ${esc(NOMBRE_DEPTO[dep])}</button>` : ''}`;
}

/* ─────────────────────────── Selección y resaltado ─────────────────────────── */

/** Selecciona (o limpia, con null) y resalta en el mapa. La subestación resalta su municipio de la tabla oficial;
 *  sin él, su departamento registrado. El resaltado anterior vuelve SIEMPRE a su estilo base. */
function seleccionar(sel, { desdePanel = false } = {}) {
  estado.seleccion = sel;
  const m = estado.mapa;
  if (estado.resaltado) { estado.resaltado.setStyle(estado.resaltado._mcBase || {}); estado.resaltado = null; }
  let capa = sel && sel.capa;
  const conPunto = sel && sel.tipo === 'subestacion' && sel.sub.coordenada;
  if (sel && sel.tipo === 'subestacion' && !conPunto) {
    const cod = estado.munDeSub.get(sel.sub.clave);
    capa = (cod && estado.capasMpio[cod]) || estado.capasDepto[sel.sub.departamento];
  }
  if (sel && sel.tipo === 'municipio' && !capa) capa = estado.capasMpio[sel.mun.cod] || estado.capasMpioPais[sel.mun.cod];
  if (capa) {
    // Un municipio resaltado debe verse aunque su capa esté apagada.
    if (estado.capasMpio[capa.feature && capa.feature.properties.cod] === capa && !m.hasLayer(estado.grupoMpios)) estado.grupoMpios.addTo(m);
    if (estado.capasMpioPais[capa.feature && capa.feature.properties.cod] === capa && !m.hasLayer(estado.capaPais)) estado.capaPais.addTo(m);
    capa.setStyle({ weight: 3.5, color: '#2563EB', fillOpacity: 0.12, dashArray: null });
    if (capa.bringToFront) capa.bringToFront();
    estado.resaltado = capa;
    const esDepto = capa === estado.capasDepto[sel.dep || (sel.sub && sel.sub.departamento)];
    if (!esDepto || !m.getBounds().contains(capa.getBounds())) m.flyToBounds(capa.getBounds(), { padding: [24, 24], duration: 0.7, maxZoom: esDepto ? 9 : 11 });
  }
  if (conPunto) {
    if (estado.grupoPuntos && !m.hasLayer(estado.grupoPuntos)) estado.grupoPuntos.addTo(m);
    m.flyTo(sel.sub.coordenada, Math.max(m.getZoom(), 14), { duration: 0.7 });
  }
  // El punto activo (y su transformador) se marcan; los demás vuelven a normal.
  for (const [clave, mk] of estado.marcadores) marcarActivo(clave, mk);
  pintarPanel();
  // En pantallas angostas la ficha queda debajo del mapa: se lleva a la vista (salvo si el clic vino de ella).
  if (sel && !desdePanel && window.matchMedia('(max-width: 1100px)').matches) {
    setTimeout(() => $('mcPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }
}

/* ─────────────────────────── Buscador y filtros ─────────────────────────── */

/** Departamento de un resultado: distingue homónimos (dos «S/E VALENCIA», dos «PUEBLO NUEVO»). */
function lugarDe(x) {
  if (x.tipo === 'municipio') return x.ref.dnom || NOMBRE_DEPTO[DPTO_DANE[x.ref.dpto]] || '';
  const s = x.tipo === 'subestacion' ? x.ref : x.ref.sub;
  return NOMBRE_DEPTO[s.departamento] || s.departamento || '';
}

function buscador() {
  const inp = $('mcBuscar');
  const ul = $('mcResultados');
  let res = [];
  let activo = 0;
  const cerrar = () => { ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); };
  const marcar = () => ul.querySelectorAll('[data-i]').forEach((li) => li.classList.toggle('mc-activo', +li.dataset.i === activo));
  const elegir = (x) => {
    cerrar();
    inp.value = x.etiqueta;
    if (x.tipo === 'municipio') seleccionar({ tipo: 'municipio', mun: x.ref });
    else seleccionar({ tipo: 'subestacion', sub: x.tipo === 'subestacion' ? x.ref : x.ref.sub, tx: x.tipo === 'transformador' ? x.ref.id : null });
  };
  const buscar = () => {
    // Los 138 de AFINIA primero; los del resto del país, si ya se leyeron (ya vienen sin los de AFINIA).
    const mun = estado.municipios.concat(estado.municipiosPais || []);
    res = buscarEnMapa(inp.value, { municipios: mun, subestaciones: estado.resumen ? estado.resumen.subestaciones : [] });
    activo = 0;
    const q = inp.value.trim();
    ul.innerHTML = res.map((x, i) => `<li data-i="${i}" class="mc-res-${x.tipo}">${esc(x.etiqueta)}<small> · ${esc(lugarDe(x))}</small></li>`).join('') ||
      (q.length >= 2 ? `<li class="mc-res-nada">${estado.municipiosPais || q.length < 3 ? 'Sin resultados' : 'Buscando en todo el país…'}</li>` : '');
    ul.hidden = !ul.innerHTML;
    inp.setAttribute('aria-expanded', String(!ul.hidden));
    marcar();
    // Nada en el área AFINIA: se leen (una sola vez) los municipios del país y se repite la búsqueda.
    if (!res.length && q.length >= 3 && !estado.municipiosPais) cargarMunicipiosPais().then(() => { if (inp.value.trim() === q) buscar(); }).catch(() => {});
  };
  inp.addEventListener('input', buscar);
  ul.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); elegir(res[+li.dataset.i]); } });
  inp.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && res.length && !ul.hidden) {
      e.preventDefault();
      activo = (activo + (e.key === 'ArrowDown' ? 1 : res.length - 1)) % res.length;
      marcar();
      const li = ul.querySelector('.mc-activo');
      if (li) li.scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && res.length && !ul.hidden) { e.preventDefault(); elegir(res[activo] || res[0]); }
    if (e.key === 'Escape') cerrar();
  });
  inp.addEventListener('blur', () => setTimeout(cerrar, 150));
}

const NOMBRE_CRG = { 1: 'Baja', 2: 'Moderada', 3: 'Media', 4: 'Alta', 5: 'Crítica' };
// Los mismos tonos de los chips CRG de la página Cargabilidad SCADA (chip--success, --teal, --warn, crg4, --danger).
const COLOR_CRG = { 1: '#1CC870', 2: '#30D1B0', 3: '#FF9500', 4: '#F0645A', 5: '#C91A14' };
const GRIS_PROVISIONAL = '#94a3b8';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesCorto = (m) => { const [a, n] = String(m || '').split('-'); return n ? `${MESES[Number(n) - 1]} ${a}` : String(m || ''); };
const pct1 = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** «95,2 % · CRG 5» (y «provisional» si la cifra no es firme), o el motivo de que no haya cifra. */
function textoCarga(t) {
  if (t.crg == null) return t.cargaMotivo ? `sin medición (${t.cargaMotivo})` : 'sin medición';
  return `${pct1(t.cargaPct)} % · CRG ${t.crg} ${NOMBRE_CRG[t.crg]}${t.cargaClase === 'provisional' ? ' (provisional)' : ''}`;
}
function celdaCarga(t) {
  if (!estado.cargas) return `<small class="mc-sub-n">${estado.cargasError ? 'no disponible' : 'leyendo…'}</small>`;
  if (t.crg == null) return `<small class="mc-sub-n" title="${esc(t.cargaMotivo || '')}">sin medición</small>`;
  // Regla de Cargabilidad SCADA: solo la cifra FIRME lleva color de severidad; la provisional va neutra.
  const firme = t.cargaClase === 'firme';
  return `<span class="mc-chip" style="--c:${firme ? COLOR_CRG[t.crg] : GRIS_PROVISIONAL}" title="${esc(textoCarga(t))}">${pct1(t.cargaPct)} % · ${t.crg}</span>${firme ? '' : '<small class="mc-sub-n"> provisional</small>'}`;
}
function bloqueCargaPanel(r) {
  if (!estado.cargas) return `<h3>Cargabilidad SCADA</h3><p class="mc-nota">${esc(estado.cargasError || 'Leyendo la cargabilidad del último mes completo…')}</p>`;
  const crgs = r.crgs || {}; const firmes = r.crgsFirmes || {};
  const conCifra = [1, 2, 3, 4, 5].reduce((n, k) => n + (crgs[k] || 0), 0);
  const provisionales = conCifra - [1, 2, 3, 4, 5].reduce((n, k) => n + (firmes[k] || 0), 0);
  // Regla de Cargabilidad SCADA: solo la cifra FIRME lleva color de severidad; lo provisional va en gris.
  const tramos = [1, 2, 3, 4, 5].map((k) => [firmes[k] || 0, COLOR_CRG[k], `CRG ${k} ${NOMBRE_CRG[k]} (firmes)`])
    .concat([[provisionales, GRIS_PROVISIONAL, 'Provisionales (cualquier CRG)'], [crgs.sin || 0, '#cbd5e1', 'Sin medición']]);
  return `<h3>Cargabilidad SCADA <small>(${esc(mesCorto(estado.mesScada))}, la de la página Cargabilidad SCADA)</small></h3>${r.total ? barra(tramos) : '<i class="mc-barra-salud vacia"></i>'}
    <ul class="mc-leyenda">${[1, 2, 3, 4, 5].map((k) => `<li><i style="background:${COLOR_CRG[k]}"></i>CRG ${k} ${NOMBRE_CRG[k]} <b>${fmt(crgs[k])}</b>${crgs[k] && crgs[k] !== firmes[k] ? ` <small>(${fmt(firmes[k])} firmes)</small>` : ''}</li>`).join('')}<li><i style="background:#cbd5e1"></i>Sin medición <b>${fmt(crgs.sin)}</b></li></ul>
    <p class="mc-nota">${fmt(conCifra)} de ${fmt(r.total)} con cifra del mes${provisionales ? ` (${fmt(provisionales)} provisionales, en gris en la barra)` : ''}; el color del punto sigue siendo la salud oficial.</p>`;
}

/** Botones marcables (varios a la vez; ninguno = todos) con su conteo sobre TODO el parque. */
function grupoChips(id, opciones, clave) {
  const g = $(id);
  if (!g) return;
  g.insertAdjacentHTML('beforeend', opciones.map(([v, t, c]) =>
    `<button type="button" class="mc-chip-f" aria-pressed="false" data-v="${esc(v)}" style="--c:${c}"><i></i>${esc(t)} <b data-n></b></button>`).join(''));
  g.addEventListener('click', (e) => {
    const b = e.target.closest('.mc-chip-f');
    if (!b || b.disabled) return;
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    estado.filtros[clave] = [...g.querySelectorAll('.mc-chip-f[aria-pressed="true"]')].map((x) => x.dataset.v);
    recalcular();
  });
}

function filtros() {
  const llenar = (id, ops) => { const s = $(id); ops.forEach(([v, t]) => s.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(t)}</option>`)); };
  llenar('mcZona', ZONAS.map((z) => [z.value, z.label]));
  llenar('mcDepto', DEPARTAMENTOS.map((d) => [d.value, d.label]));
  llenar('mcTipo', TIPOS_ACTIVO.map((t) => [t.value, t.label]));
  const salud = $('mcSalud');
  if (salud && salud.tagName === 'SELECT') {
    // Página vieja en caché con este código (L-102): la lista de antes, una banda a la vez.
    llenar('mcSalud', CONDICIONES.map((c) => [String(c.value), c.label]).concat([['sin', 'Sin dato']]));
    salud.addEventListener('change', () => { estado.filtros.bandas = salud.value ? [salud.value] : []; recalcular(); });
  } else {
    grupoChips('mcSalud', CONDICIONES.map((c) => [String(c.value), `${c.value} ${c.label}`, c.color]).concat([['sin', 'Sin dato', '#cbd5e1']]), 'bandas');
  }
  grupoChips('mcCrg', [1, 2, 3, 4, 5].map((k) => [String(k), `${k} ${NOMBRE_CRG[k]}`, COLOR_CRG[k]]).concat([['sin', 'Sin medición', '#cbd5e1']]), 'crgs');
  if ($('mcCrg')) { $('mcCrg').setAttribute('aria-busy', 'true'); $('mcCrg').querySelectorAll('.mc-chip-f').forEach((b) => { b.disabled = true; }); }
  const leer = (repintar = true) => {
    Object.assign(estado.filtros, { zona: $('mcZona').value, departamento: $('mcDepto').value, tipo: $('mcTipo').value });
    if (repintar) recalcular();
  };
  ['mcZona', 'mcDepto', 'mcTipo'].forEach((id) => $(id).addEventListener('change', () => leer()));
  // Al volver con «atrás» el navegador repone las listas: el mapa las toma (antes mostraba un filtro que no aplicaba).
  leer(false);
  window.addEventListener('pageshow', (e) => { if (e.persisted) leer(); });
  if ($('mcSoloFirmes')) $('mcSoloFirmes').addEventListener('change', (e) => { estado.filtros.soloFirmes = e.target.checked; recalcular(); });
}

/** Conteo de cada botón: cuántos quedan con los DEMÁS filtros puestos (sin contar el propio grupo). */
function pintarConteos() {
  if (!estado.txs.length) return;
  const f = estado.filtros;
  const poner = (id, cuenta) => { const g = $(id); if (g && cuenta) g.querySelectorAll('.mc-chip-f').forEach((b) => { b.querySelector('[data-n]').textContent = fmt(cuenta[b.dataset.v]); }); };
  poner('mcSalud', resumenParque(estado.txs, { ...f, bandas: [] }, null, estado.cargas).bandas);
  if (estado.cargas) poner('mcCrg', resumenParque(estado.txs, { ...f, crgs: [] }, null, estado.cargas).crgs);
}

/** Cargabilidad SCADA del último mes completo: la MISMA cifra de la página Cargabilidad SCADA (mismas lecturas y
 *  `filasLista`), leída después de pintar el mapa (3 documentos + umbrales; nada si falla: el filtro queda inactivo). */
async function cargarCargas() {
  const marcar = (txt, ok) => {
    if ($('mcCrgMes')) $('mcCrgMes').textContent = txt;
    if ($('mcCrg')) { $('mcCrg').removeAttribute('aria-busy'); $('mcCrg').querySelectorAll('.mc-chip-f').forEach((b) => { b.disabled = !ok; }); }
    if ($('mcSoloFirmes')) $('mcSoloFirmes').disabled = !ok;
  };
  if (!estado.txs.length) {
    estado.cargasError = 'Sin el parque no se puede cruzar la Cargabilidad SCADA.';
    marcar('· no disponible', false);
    pintarPanel();
    return;
  }
  try {
    const [datos, vista, umb] = await Promise.all([import('../../data/scada_carga.js'), import('../../domain/scada_carga_vista.js'), import('../../data/umbrales_salud.js')]);
    const [h, c, u] = await Promise.all([datos.leerHomologacion(), datos.leerCatalogo(), umb.obtenerUmbralesActivos().catch(() => null)]);
    if (!h || h.estado !== 'ok' || !c || c.estado !== 'ok') throw new Error('sin homologación o catálogo SCADA');
    const mes = vista.mesPorDefecto(c.datos);
    const r = mes ? await datos.leerResumenMes(mes) : null;
    if (!r || r.estado !== 'ok') throw new Error('sin resumen del mes ' + (mes || ''));
    const filas = vista.filasLista({ parque: estado.txs, homologacion: h.datos, catalogo: c.datos, resumenMes: r.datos, umbrales: u });
    estado.cargas = new Map(filas.map((f) => [String(f.id), { pct: f.pct, crg: f.crg, clase: f.clase, motivo: f.motivoNulo || '' }]));
    estado.mesScada = mes;
    marcar('· ' + mesCorto(mes), true);
  } catch (err) {
    console.warn('[mapa] cargabilidad SCADA:', err);
    estado.cargasError = 'No se pudo leer la Cargabilidad SCADA: el filtro queda inactivo (el resto del mapa funciona).';
    marcar('· no disponible', false);
  }
  recalcular();
}

function aviso(msg, tipo) {
  const a = $('mcAviso');
  a.className = 'info-msg ' + (tipo || '');
  a.textContent = msg;
  a.style.display = msg ? 'block' : 'none';
}

function titulo(s) {
  const minus = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);
  return String(s || '').toLowerCase().split(/(\s+|-)/).map((w, i) =>
    (i > 0 && minus.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/* ─────────────────────────── Arranque ─────────────────────────── */

async function arrancar() {
  if (!window.L || !window.topojson) { aviso('No se pudo cargar la librería del mapa (revise la conexión).', 'err'); return; }
  estado.mapa = crearMapa();
  clasesZoom();
  controlesVista(estado.mapa);
  filtros();
  buscador();
  const parque = cargarParque();
  try {
    await cargarGeografia();
    // Sin «capas base» de opción única: los dos fondos son casillas, como el resto de capas.
    estado.controlCapas = window.L.control.layers({}, { ...estado.fondos, ...estado.capas }, { collapsed: true, position: 'topright' }).addTo(estado.mapa);
  } catch (err) {
    console.error(err);
    aviso('No se pudo leer la geografía: ' + (err.message || err), 'err');
  }
  await parque;
  if (estado.parqueError) aviso(estado.parqueError, 'err');
  else if (estado.ubicacionesError) aviso(estado.ubicacionesError, '');
  recalcular();
  cargarCargas();
}

arrancar();
