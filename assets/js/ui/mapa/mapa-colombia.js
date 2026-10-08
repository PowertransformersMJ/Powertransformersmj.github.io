// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Mapa geográfico de Colombia (Etapa 1)
// ──────────────────────────────────────────────────────────────
// Pedido del Ingeniero (2026-10-07): «construyendo el mapa geográfico de Colombia en un máximo nivel».
// Etapa 1 (no necesita coordenadas): límites oficiales DANE MGN 2025 (país, 33 departamentos, 138
// municipios del área AFINIA y, a pedido, los 1.122 del país), zonas AFINIA (aproximadas), el parque
// resumido por departamento con su salud oficial, buscador, filtros y ficha lateral.
// Una sola lectura del parque por visita (listarV2); filtros y búsqueda en el navegador.
// Lógica pura → domain/mapa_parque.js. Geografía → assets/geo/ (se regenera con scripts/mapa-geo/).
// ══════════════════════════════════════════════════════════════

import { listarV2, isReady } from '../../data/transformadores.js';
import { CONDICIONES, ZONAS, DEPARTAMENTOS, TIPOS_ACTIVO } from '../../domain/schema.js';
// municipioDeSubestacionMapa usa la tabla oficial de municipio por subestación (Fichas, 2026-09-10): S/E de cada municipio.
import { DPTO_DANE, DANE_DE_DPTO, COLOR_ZONA, resumenParque, buscarEnMapa, municipioDeSubestacionMapa } from '../../domain/mapa_parque.js';

const $ = (id) => document.getElementById(id);
const GEO = '../assets/geo/';
const COLOMBIA = [[-4.25, -81.9], [13.45, -66.85]];          // incluye San Andrés y Providencia
const ZOOM_MPIOS = 8;                                          // municipios del área AFINIA desde aquí
const ZOOM_NOMBRES_MPIO = 10;                                  // nombres de municipio desde aquí
const COLOR_BANDA = Object.fromEntries(CONDICIONES.map((c) => [c.value, c.color]));
const NOMBRE_BANDA = Object.fromEntries(CONDICIONES.map((c) => [c.value, c.label]));
const NOMBRE_DEPTO = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.value, d.label]));
const NOMBRE_ZONA = Object.fromEntries(ZONAS.map((z) => [z.value, z.label]));
const NOMBRE_TIPO = Object.fromEntries(TIPOS_ACTIVO.map((t) => [t.value, t.label]));

const estado = {
  mapa: null, txs: [], parqueError: null, resumen: null,
  capas: {}, rotulos: null, nombresMpio: null, seleccion: null, resaltado: null,
  municipios: [], afiniaBounds: null, filtros: {},
  capasDepto: {}, capasMpio: {}, capasMpioPais: {}, subsPorMun: new Map(), munDeSub: new Map(), lienzo: null
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
  mapa.createPane('mc-rotulos').style.zIndex = '650';
  mapa.getPane('mc-rotulos').style.pointerEvents = 'none';

  // Fondos gratuitos y sin clave (CARTO pasó a exigir clave y mostraba marcas de agua).
  const fondoMapa = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, className: 'mc-fondo-suave',
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>'
  });
  const fondoRelieve = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, subdomains: 'abc',
    attribution: 'Datos: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>, SRTM | Estilo: © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC-BY-SA</a>)'
  });
  fondoMapa.addTo(mapa);
  vigilarFondo(fondoMapa, fondoRelieve, mapa);
  estado.fondos = { 'Mapa (OpenStreetMap)': fondoMapa, 'Relieve (OpenTopoMap)': fondoRelieve };
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(mapa);
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

/* ─────────────────────────── Parque ─────────────────────────── */

async function cargarParque() {
  if (!isReady()) { estado.parqueError = 'Firebase no configurado: el mapa muestra solo la geografía.'; return; }
  try {
    estado.txs = await listarV2({});
  } catch (err) {
    console.warn('[mapa] parque:', err);
    estado.parqueError = 'No se pudo leer el parque (' + (err.message || err) + '). El mapa muestra solo la geografía.';
  }
}

function recalcular() {
  estado.resumen = resumenParque(estado.txs, estado.filtros);
  indexarMunicipios();
  pintarRotulos();
  pintarPanel();
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
  const seg = [1, 2, 3, 4, 5, 'sin'].filter((k) => bandas[k]).map((k) =>
    `<i style="flex:${bandas[k]};background:${k === 'sin' ? '#cbd5e1' : COLOR_BANDA[k]}" title="${esc(k === 'sin' ? 'Sin dato' : NOMBRE_BANDA[k])}: ${bandas[k]}"></i>`).join('');
  return `<span class="mc-barra-salud">${seg}</span>`;
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
  const filtrado = Object.values(estado.filtros).some(Boolean);
  return `<h2>Parque en el mapa${filtrado ? ' <small>(filtrado)</small>' : ''}</h2>
    <div class="mc-kpis"><div><b>${fmt(r.total)}</b><span>transformadores</span></div><div><b>${fmt(r.subestaciones.length)}</b><span>subestaciones</span></div>
      <div class="${r.ubicadas ? '' : 'mc-pend'}"><b>${fmt(r.ubicadas)} de ${fmt(r.subestaciones.length)}</b><span>con ubicación validada</span></div></div>
    ${!r.total ? '<p class="mc-nota">Ningún transformador cumple los filtros actuales.</p>' : r.ubicadas ? '' : `<p class="mc-nota">Las subestaciones aún no tienen coordenadas validadas: el parque se resume por el <b>departamento registrado</b>, y ${fmt(estado.munDeSub.size)} de ${fmt(r.subestaciones.length)} ya se ubican en su <b>municipio</b> por la tabla oficial de Fichas (clic en un municipio para verlas).</p>`}
    <h3>Salud oficial</h3>${barraSalud(r.bandas, r.total)}
    <ul class="mc-leyenda">${CONDICIONES.map((c) => `<li><i style="background:${c.color}"></i>${esc(c.label)} <b>${fmt(r.bandas[c.value])}</b></li>`).join('')}${r.bandas.sin ? `<li><i style="background:#cbd5e1"></i>Sin dato <b>${fmt(r.bandas.sin)}</b></li>` : ''}</ul>
    <h3>Por departamento <small>(clic para ver)</small></h3>
    <table class="mc-tabla"><thead><tr><th>Departamento</th><th class="n">TX</th><th class="n">S/E</th><th>Salud</th></tr></thead><tbody>${filas(r.porDepartamento, NOMBRE_DEPTO, true)}</tbody></table>
    <h3>Por zona</h3>
    <table class="mc-tabla"><thead><tr><th>Zona</th><th class="n">TX</th><th class="n">S/E</th><th>Salud</th></tr></thead><tbody>${filas(r.porZona, NOMBRE_ZONA, false)}</tbody></table>`;
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
    ${s.coordenada ? '' : `<p class="mc-nota mc-pend">Aún sin punto en el mapa: se resalta ${mun ? 'su <b>municipio</b> según la tabla oficial de Fichas' : 'su <b>departamento registrado</b> (la tabla oficial no trae su municipio)'}.</p>`}
    <table class="mc-tabla"><thead><tr><th>Transformador</th><th>Tipo</th><th class="n">MVA</th><th>Salud</th></tr></thead><tbody>
    ${s.tx.map((t) => `<tr><td><code>${esc(t.matricula || t.codigo)}</code></td><td>${esc(NOMBRE_TIPO[t.tipo] || t.tipo || '—')}</td><td class="n">${t.mva == null ? '—' : fmt(t.mva)}</td><td>${chipBanda(t.banda)}</td></tr>`).join('')}
    </tbody></table>`;
}

function fichaMunicipio(m) {
  const dep = DPTO_DANE[m.dpto];
  const afinia = Boolean(estado.capasMpio[m.cod]);
  const subs = estado.subsPorMun.get(m.cod) || [];
  const ntx = subs.reduce((n, s) => n + s.tx.length, 0);
  const filtrado = Object.values(estado.filtros).some(Boolean);
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
  if (sel && sel.tipo === 'subestacion') {
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
    else seleccionar({ tipo: 'subestacion', sub: x.tipo === 'subestacion' ? x.ref : x.ref.sub });
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

function filtros() {
  const llenar = (id, ops) => { const s = $(id); ops.forEach(([v, t]) => s.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(t)}</option>`)); };
  llenar('mcZona', ZONAS.map((z) => [z.value, z.label]));
  llenar('mcDepto', DEPARTAMENTOS.map((d) => [d.value, d.label]));
  llenar('mcSalud', CONDICIONES.map((c) => [String(c.value), c.label]).concat([['sin', 'Sin dato']]));
  llenar('mcTipo', TIPOS_ACTIVO.map((t) => [t.value, t.label]));
  const leer = () => {
    estado.filtros = { zona: $('mcZona').value, departamento: $('mcDepto').value, banda: $('mcSalud').value, tipo: $('mcTipo').value };
    recalcular();
  };
  ['mcZona', 'mcDepto', 'mcSalud', 'mcTipo'].forEach((id) => $(id).addEventListener('change', leer));
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
  controlesVista(estado.mapa);
  filtros();
  buscador();
  const parque = cargarParque();
  try {
    await cargarGeografia();
    window.L.control.layers(estado.fondos, estado.capas, { collapsed: true, position: 'topright' }).addTo(estado.mapa);
  } catch (err) {
    console.error(err);
    aviso('No se pudo leer la geografía: ' + (err.message || err), 'err');
  }
  await parque;
  if (estado.parqueError) aviso(estado.parqueError, 'err');
  recalcular();
}

arrancar();
