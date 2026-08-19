// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Fichas Técnicas: vistas gerenciales
// ──────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE MÓDULO
// El port del módulo v22 (ADR-061) trajo la hoja de estilos COMPLETA
// pero solo implementó el tablero y la ficha: 189 de las 339 clases
// `.ftm-` de `assets/css/fichas-tecnicas.css` no las usaba ningún JS.
// Faltaban tres de las cuatro vistas del módulo original. Aquí están,
// con el marcado que esa hoja ya espera y con la estética del sitio
// (AQUA LIGHT), no el tema oscuro del archivo suelto (ADR-064).
//
// Todo el CÁLCULO se delega al dominio ya probado: no se reimplementa
// ni el clasificador CREG ni la matriz de riesgo.
//   · domain/fichas_creg_uc.js  → catálogo, clasificador, costos
//   · domain/matriz_riesgo.js   → matriz 5×5 (MO.00418 Tabla 11)
// ══════════════════════════════════════════════════════════════

import { GRUPOS_UC, costoUC } from '../../domain/fichas_creg_uc.js';
import {
  NIVELES_ORDEN, LABELS_NIVEL, COLORES_CELDA,
  calcularRangosCriticidad, nivelPorUsuarios, colorCelda
} from '../../domain/matriz_riesgo.js';

/* ─── helpers locales ─────────────────────────────────────────── */

function esc(x) {
  return String(x == null ? '' : x)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function pct(n, total) {
  if (!total) return '0%';
  return (Math.round((n / total) * 1000) / 10).toString().replace('.', ',') + '%';
}
function miles(n) {
  if (n == null || !isFinite(n)) return '—';
  return new Intl.NumberFormat('es-CO').format(Math.round(n));
}
function mva1(n) {
  if (n == null || !isFinite(n)) return '—';
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}
/** Cifra grande en pesos, abreviada a millones/miles de millones. */
function copCorto(n) {
  if (n == null || !isFinite(n) || n <= 0) return '—';
  if (n >= 1e12) return '$ ' + (Math.round(n / 1e11) / 10).toString().replace('.', ',') + ' B';
  if (n >= 1e9)  return '$ ' + (Math.round(n / 1e8) / 10).toString().replace('.', ',') + ' MM';
  if (n >= 1e6)  return '$ ' + (Math.round(n / 1e5) / 10).toString().replace('.', ',') + ' M';
  return '$ ' + miles(n);
}

/**
 * Valor de reposición de un equipo según su UC calculada.
 * Es el mismo criterio del presupuesto de la ficha: costo de
 * instalación de la UC + (MVA × valor unitario por MVA).
 * Devuelve null si el equipo no tiene UC o no está en el catálogo.
 */
export function valorReposicion(equipo) {
  const uc = equipo && equipo.uucc_calculada;
  if (!uc) return null;
  const c = costoUC(uc);
  if (!c) return null;
  const mva = Number(equipo.mva);
  return c.inst + (isFinite(mva) && mva > 0 ? mva * c.porMVA : 0);
}

/**
 * Resumen gerencial de la flota. Cálculo puro sobre los equipos ya
 * normalizados por `panel.js`.
 */
export function resumenGerencial(equipos) {
  const eq = equipos || [];
  const total = eq.length;
  const concordantes = eq.filter((e) => e.estado === 'CONCORDANTE').length;
  const novedades = eq.filter((e) => e.estado !== 'CONCORDANTE').length;
  const gestionadas = eq.filter((e) => e.estado !== 'CONCORDANTE' && e.novedad_gestionada).length;

  let mvaTotal = 0;
  for (const e of eq) if (isFinite(Number(e.mva))) mvaTotal += Number(e.mva);

  // "Riesgo alto o crítico" = condición 4 o 5 (pobre / muy pobre).
  const enRiesgo = eq.filter((e) => e.cond_int === 4 || e.cond_int === 5);
  let mvaRiesgo = 0;
  for (const e of enRiesgo) if (isFinite(Number(e.mva))) mvaRiesgo += Number(e.mva);

  // Valor de reposición de la flota en mala salud.
  let valorRiesgo = 0;
  for (const e of enRiesgo) {
    const v = valorReposicion(e);
    if (v) valorRiesgo += v;
  }

  return {
    total, concordantes, novedades, gestionadas,
    conformidad: total ? (concordantes / total) * 100 : 0,
    mvaTotal, enRiesgo: enRiesgo.length, mvaRiesgo, valorRiesgo,
    avanceNovedades: novedades ? (gestionadas / novedades) * 100 : 0
  };
}

/* ─── VISTA 1 · Panorama + matriz + priorización + novedades ───── */

function panoramaHTML(r) {
  const tarjeta = (mod, num, sub, lbl) => ''
    + '<div class="ftm-gkpi ftm-gkpi--' + mod + '">'
    +   '<div class="ftm-gkpi-bar"></div>'
    +   '<div class="ftm-gkpi-num">' + num + '</div>'
    +   '<div class="ftm-gkpi-lbl">' + lbl + '</div>'
    +   '<div class="ftm-gkpi-sub">' + sub + '</div>'
    + '</div>';
  return ''
    + '<div class="ftm-panel">'
    +   '<div class="ftm-panel-head">'
    +     '<span class="ftm-panel-tt">Panorama gerencial de la flota</span>'
    +   '</div>'
    +   '<div class="ftm-panel-body">'
    +     '<div class="ftm-hint ftm-hint--p">Indicadores de decisión sobre ' + r.total + ' transformadores de '
    +     'potencia, evaluados contra el catálogo de Unidades Constructivas del CREG 015/2018 y '
    +     'cruzados con el estado de salud (Health Index).</div>'
    +     '<div class="ftm-gkpis">'
    +       tarjeta('ok', pct(r.concordantes, r.total),
              r.concordantes + ' de ' + r.total + ' equipos', 'Conformidad UUCC de la flota')
    +       tarjeta('cap', mva1(r.mvaTotal) + ' <small>MVA</small>',
              r.total + ' transformadores', 'Capacidad instalada evaluada')
    +       tarjeta('risk', String(r.enRiesgo),
              mva1(r.mvaRiesgo) + ' MVA expuestos', 'Equipos en riesgo alto o crítico')
    +       tarjeta('val', copCorto(r.valorRiesgo),
              r.enRiesgo + ' equipos en salud pobre/muy pobre', 'Valor de reposición · flota en mala salud')
    +       tarjeta('nov', pct(r.gestionadas, r.novedades),
              r.gestionadas + ' de ' + r.novedades + ' gestionadas', 'Avance de gestión de novedades')
    +     '</div>'
    +   '</div>'
    + '</div>';
}

function matrizRiesgoHTML(equipos) {
  const eq = equipos || [];
  let maxU = 1;
  for (const e of eq) if (isFinite(Number(e.usuarios)) && Number(e.usuarios) > maxU) maxU = Number(e.usuarios);
  const rangos = calcularRangosCriticidad(maxU);

  // Agregación 5×5 propia: los equipos del panel son planos
  // (cond_int / usuarios), no documentos de Firestore.
  const celdas = {};
  for (const hi of [5, 4, 3, 2, 1]) {
    celdas[hi] = {};
    for (const n of NIVELES_ORDEN) celdas[hi][n] = { n: 0, mva: 0 };
  }
  let sinDato = 0;
  for (const e of eq) {
    const hi = e.cond_int;
    if (hi == null || !celdas[hi]) { sinDato++; continue; }
    const nivel = nivelPorUsuarios(e.usuarios, rangos);
    if (!nivel || !celdas[hi][nivel]) { sinDato++; continue; }
    celdas[hi][nivel].n += 1;
    if (isFinite(Number(e.mva))) celdas[hi][nivel].mva += Number(e.mva);
  }

  const cabecera = '<tr><th class="ftm-rmx-corner">Prob. falla (Condición) ↓ / Consecuencia (Criticidad) →</th>'
    + NIVELES_ORDEN.map((n, i) => '<th>' + (i + 1) + ' · ' + esc(LABELS_NIVEL[n]) + '</th>').join('')
    + '</tr>';

  const NOMBRE_HI = { 5: '5 · Muy pobre', 4: '4 · Pobre', 3: '3 · Medio', 2: '2 · Bueno', 1: '1 · Muy bueno' };
  const filas = [5, 4, 3, 2, 1].map((hi) => {
    const tds = NIVELES_ORDEN.map((n) => {
      const c = celdas[hi][n];
      const cod = colorCelda(hi, n);
      const hex = (COLORES_CELDA[cod] || {}).hex || '#999';
      const cero = c.n === 0 ? ' is-zero' : '';
      return '<td class="ftm-rmx-cell' + cero + '" style="background:' + hex + '" '
        + 'data-hi="' + hi + '" data-nivel="' + esc(n) + '" '
        + 'title="Condición ' + hi + ' · Criticidad ' + esc(LABELS_NIVEL[n]) + '">'
        + '<div class="ftm-rmx-cn">' + c.n + '</div>'
        + (c.mva > 0 ? '<div class="ftm-rmx-cm">' + mva1(c.mva) + ' MVA</div>' : '')
        + '</td>';
    }).join('');
    return '<tr><th class="ftm-rmx-rylbl">' + NOMBRE_HI[hi] + '</th>' + tds + '</tr>';
  }).join('');

  const escala = Object.entries(COLORES_CELDA).map(([, v]) =>
    '<span class="ftm-rmx-sc"><i style="background:' + v.hex + '"></i>' + esc(v.label) + '</span>'
  ).join('');

  return ''
    + '<div class="ftm-panel ftm-sect">'
    +   '<div class="ftm-panel-head"><span class="ftm-panel-tt">'
    +     'Matriz de riesgo de activos · Probabilidad × Consecuencia</span></div>'
    +   '<div class="ftm-panel-body">'
    +     '<div class="ftm-hint ftm-hint--p">Riesgo = Probabilidad de falla (Condición / Health Index, 1 Muy bueno '
    +     '→ 5 Muy pobre) × Consecuencia (Criticidad por usuarios aguas abajo). Matriz oficial '
    +     'MO.00418 Tabla 11. Cada celda muestra el número de equipos y su capacidad.</div>'
    +     '<div class="ftm-rmx-wrap"><table class="ftm-rmx">'
    +       '<thead>' + cabecera + '</thead><tbody>' + filas + '</tbody></table></div>'
    +     '<div class="ftm-rmx-scale">' + escala
    +       + (sinDato ? '<span class="ftm-rmx-sc">' + sinDato + ' equipo(s) sin condición o sin usuarios: fuera de la matriz</span>' : '')
    +     '</div>'
    +   '</div>'
    + '</div>';
}

function priorizacionHTML(equipos) {
  const eq = (equipos || []).filter((e) => e.cond_int != null);
  let maxU = 1;
  for (const e of eq) if (isFinite(Number(e.usuarios)) && Number(e.usuarios) > maxU) maxU = Number(e.usuarios);
  const rangos = calcularRangosCriticidad(maxU);

  const conRiesgo = eq.map((e) => {
    const nivel = nivelPorUsuarios(e.usuarios, rangos);
    const idxNivel = nivel ? NIVELES_ORDEN.indexOf(nivel) + 1 : 1;
    // Puntaje 1..25 igual que la matriz: condición × criticidad.
    return { e, nivel, score: e.cond_int * idxNivel, color: nivel ? colorCelda(e.cond_int, nivel) : 'VRD' };
  }).sort((a, b) => b.score - a.score).slice(0, 20);

  if (!conRiesgo.length) {
    return '<div class="ftm-panel ftm-sect"><div class="ftm-panel-body">'
      + '<div class="ftm-hint ftm-hint--p">Sin datos de condición: no se puede priorizar.</div></div></div>';
  }

  const filas = conRiesgo.map((r, i) => {
    const e = r.e;
    const hex = (COLORES_CELDA[r.color] || {}).hex || '#999';
    const anchoBarra = Math.round((r.score / 25) * 100);
    return '<tr>'
      + '<td class="ftm-rank-rk">' + (i + 1) + '</td>'
      + '<td><b>' + esc(e.subestacion || '—') + '</b><br><small class="ftm-mono">'
        + esc(e.matricula || e.serie || e.codigo || '') + '</small></td>'
      + '<td>' + esc(e.zona || '—') + '</td>'
      + '<td class="ftm-mono">' + mva1(e.mva) + '</td>'
      + '<td>' + esc(e.cond_lbl || ('Condición ' + e.cond_int)) + '</td>'
      + '<td>' + esc(r.nivel ? LABELS_NIVEL[r.nivel] : '—') + '</td>'
      + '<td><div class="ftm-rscore"><div class="ftm-rscore-bar" style="width:' + anchoBarra
        + '%;background:' + hex + '"></div><span class="ftm-rscore-val">' + r.score + '</span></div></td>'
      + '</tr>';
  }).join('');

  return ''
    + '<div class="ftm-panel ftm-sect">'
    +   '<div class="ftm-panel-head"><span class="ftm-panel-tt">'
    +     'Priorización de intervención — ' + conRiesgo.length + ' equipos de mayor riesgo</span></div>'
    +   '<div class="ftm-panel-body">'
    +     '<div class="ftm-hint ftm-hint--p">Ordenados por puntaje de riesgo (condición × criticidad, de 1 a 25). '
    +     'Es el orden sugerido para programar intervención.</div>'
    +     '<div class="ftm-tabla-scroll"><table class="ftm-tabla ftm-rank"><thead><tr>'
    +       '<th>#</th><th>Subestación</th><th>Zona</th><th>MVA</th>'
    +       '<th>Condición</th><th>Criticidad</th><th>Riesgo</th>'
    +     '</tr></thead><tbody>' + filas + '</tbody></table></div>'
    +   '</div>'
    + '</div>';
}

function novedadesHTML(equipos, r) {
  const nov = (equipos || []).filter((e) => e.estado !== 'CONCORDANTE');
  const porTipo = {
    DISCREPANCIA: nov.filter((e) => e.estado === 'DISCREPANCIA'),
    'FALTA REGISTRO': nov.filter((e) => e.estado === 'FALTA REGISTRO'),
    'SIN CALCULO': nov.filter((e) => e.estado === 'SIN CALCULO')
  };
  const MOD = { DISCREPANCIA: 'disc', 'FALTA REGISTRO': 'falta', 'SIN CALCULO': 'sin' };

  const tarjetas = Object.entries(porTipo).map(([tipo, lista]) => {
    if (!lista.length) return '';
    const ejemplos = lista.slice(0, 6).map((e) => ''
      + '<div class="ftm-nov-card-flujo">'
      +   '<span class="ftm-nov-card-code ftm-nov-card-code--bad">' + esc(e.uucc_registrada || '—') + '</span>'
      +   '<span class="ftm-arrow">→</span>'
      +   '<span class="ftm-nov-card-code ftm-nov-card-code--good">' + esc(e.uucc_calculada || '—') + '</span>'
      +   '<span class="ftm-nov-card-meta">' + esc(e.subestacion || '') + '</span>'
      + '</div>').join('');
    return ''
      + '<div class="ftm-nov-card ftm-nov-card--' + MOD[tipo] + '">'
      +   '<div class="ftm-nov-card-t">' + esc(tipo) + ' · ' + lista.length + '</div>'
      +   ejemplos
      +   (lista.length > 6 ? '<div class="ftm-nov-card-meta">y ' + (lista.length - 6) + ' más…</div>' : '')
      + '</div>';
  }).join('');

  const avance = Math.round(r.avanceNovedades);
  return ''
    + '<div class="ftm-panel ftm-sect">'
    +   '<div class="ftm-panel-head"><span class="ftm-panel-tt">'
    +     'Centro de novedades — trazabilidad CREG</span></div>'
    +   '<div class="ftm-panel-body">'
    +     '<div class="ftm-nov-head">'
    +       '<span class="ftm-nov-lbl">Novedades: <b>' + r.novedades + '</b></span>'
    +       '<span class="ftm-nov-lbl">Gestionadas: <b>' + r.gestionadas + '</b></span>'
    +       '<span class="ftm-nov-lbl">Pendientes: <b>' + (r.novedades - r.gestionadas) + '</b></span>'
    +     '</div>'
    +     '<div class="ftm-nov-track"><div class="ftm-nov-fill" style="width:' + avance + '%"></div></div>'
    +     (nov.length
            ? '<div class="ftm-nov-grid">' + tarjetas + '</div>'
            : '<div class="ftm-hint ftm-hint--p">Sin novedades: toda la flota concuerda con el catálogo.</div>')
    +   '</div>'
    + '</div>';
}

function crucesHTML(equipos) {
  const eq = equipos || [];
  // Salud y riesgo por zona
  const zonas = {};
  for (const e of eq) {
    const z = e.zona || '—';
    const o = zonas[z] || (zonas[z] = { n: 0, mva: 0, malos: 0 });
    o.n += 1;
    if (isFinite(Number(e.mva))) o.mva += Number(e.mva);
    if (e.cond_int === 4 || e.cond_int === 5) o.malos += 1;
  }
  const maxZ = Math.max(1, ...Object.values(zonas).map((o) => o.n));
  const filasZona = Object.entries(zonas).sort((a, b) => b[1].n - a[1].n).map(([z, o]) => ''
    + '<div class="ftm-dist-row">'
    +   '<div class="ftm-dist-lbl">' + esc(z) + '</div>'
    +   '<div class="ftm-dist-track"><div class="ftm-dist-fill" style="width:'
    +     Math.round((o.n / maxZ) * 100) + '%"></div></div>'
    +   '<div class="ftm-dist-val">' + o.n + (o.malos ? ' <small>· ' + o.malos + ' en mala salud</small>' : '') + '</div>'
    + '</div>').join('');

  // Capacidad instalada por nivel de tensión
  const niveles = {};
  for (const e of eq) {
    const n = e.nivel || '—';
    const o = niveles[n] || (niveles[n] = { n: 0, mva: 0 });
    o.n += 1;
    if (isFinite(Number(e.mva))) o.mva += Number(e.mva);
  }
  const maxN = Math.max(1, ...Object.values(niveles).map((o) => o.mva));
  const filasNivel = Object.entries(niveles).sort((a, b) => b[1].mva - a[1].mva).map(([n, o]) => ''
    + '<div class="ftm-dist-row">'
    +   '<div class="ftm-dist-lbl">' + esc(n) + '</div>'
    +   '<div class="ftm-dist-track"><div class="ftm-dist-fill" style="width:'
    +     Math.round((o.mva / maxN) * 100) + '%"></div></div>'
    +   '<div class="ftm-dist-val">' + mva1(o.mva) + ' <small>MVA</small></div>'
    + '</div>').join('');

  return ''
    + '<div class="ftm-sect"><div class="ftm-sect-t">Cruces de análisis</div>'
    + '<div class="ftm-grid2">'
    +   '<div class="ftm-panel"><div class="ftm-panel-head"><span class="ftm-panel-tt">'
    +     'Salud y riesgo por zona</span></div><div class="ftm-panel-body">'
    +     '<div class="ftm-dist">' + (filasZona || '<div class="ftm-hint ftm-hint--p">Sin datos.</div>') + '</div>'
    +   '</div></div>'
    +   '<div class="ftm-panel"><div class="ftm-panel-head"><span class="ftm-panel-tt">'
    +     'Capacidad instalada por nivel de tensión</span></div><div class="ftm-panel-body">'
    +     '<div class="ftm-dist">' + (filasNivel || '<div class="ftm-hint ftm-hint--p">Sin datos.</div>') + '</div>'
    +   '</div></div>'
    + '</div></div>';
}

/** Vista completa de Analítica gerencial. */
export function vistaAnalitica(equipos) {
  const r = resumenGerencial(equipos);
  return panoramaHTML(r)
    + matrizRiesgoHTML(equipos)
    + priorizacionHTML(equipos)
    + novedadesHTML(equipos, r)
    + crucesHTML(equipos);
}

/* ─── VISTA 2 · Catálogo normativo CREG ────────────────────────── */

/**
 * Catálogo de Unidades Constructivas (Tablas 51 y 52 de la CREG
 * 015/2018). Se pinta desde `domain/fichas_creg_uc.js`, que es la
 * misma fuente que usa el clasificador: catálogo y veredicto NO
 * pueden divergir.
 */
export function vistaNorma() {
  const tablas = GRUPOS_UC.map((g) => {
    const filas = g.rows.map((f) => ''
      + '<tr>'
      +   '<td class="ftm-mono"><b>' + esc(f.uc) + '</b></td>'
      +   '<td>' + esc(f.cap) + '</td>'
      +   '<td>' + esc(f.reg || '—') + '</td>'
      +   '<td class="ftm-num ftm-mono">' + esc(f.costo) + '</td>'
      +   '<td class="ftm-num ftm-mono">' + esc(f.unit) + '</td>'
      + '</tr>').join('');
    return ''
      + '<div class="ftm-sect">'
      +   '<div class="ftm-sect-t">' + esc(g.sub) + ' <span class="ftm-chip">' + esc(g.tabla) + '</span></div>'
      +   '<div class="ftm-tabla-scroll"><table class="ftm-tabla ftm-norma-tabla"><thead><tr>'
      +     '<th>UC</th><th>Capacidad</th><th>Regulación</th>'
      +     '<th class="ftm-num">Costo de instalación ($)</th>'
      +     '<th class="ftm-num">Valor unitario ($/MVA)</th>'
      +   '</tr></thead><tbody>' + filas + '</tbody></table></div>'
      + '</div>';
  }).join('');

  return ''
    + '<div class="ftm-panel ftm-norma">'
    +   '<div class="ftm-panel-head"><span class="ftm-panel-tt">'
    +     'Catálogo normativo de Unidades Constructivas — Transformadores</span></div>'
    +   '<div class="ftm-panel-body">'
    +     '<div class="ftm-hint ftm-hint--p">Es la regla contra la que se contrasta toda la flota. '
    +     'Las cifras están en <b>pesos de diciembre de 2007</b> (Tablas 51 y 52), que es la '
    +     'vigencia que usa la ficha de planificación PE.02081. La misma norma trae un segundo '
    +     'juego en pesos de 2017 (Tablas 15 y 16): confundirlos cambia el presupuesto.</div>'
    +     tablas
    +     '<div class="ftm-norma-src">Fuente: CREG 015 de 2018 · Tablas 51 y 52. '
    +     'Catálogo servido por <span class="ftm-mono">domain/fichas_creg_uc.js</span>, '
    +     'la misma fuente que usa el clasificador del tablero.</div>'
    +   '</div>'
    + '</div>';
}

/* ─── VISTA 3 · Agregar transformador ──────────────────────────── */

const CAMPOS_ALTA = Object.freeze([
  { id: 'aSub',   lbl: 'Subestación',            tipo: 'text',   req: true },
  { id: 'aMat',   lbl: 'Matrícula AFINIA',       tipo: 'text' },
  { id: 'aSerie', lbl: 'Número de serie',        tipo: 'text' },
  { id: 'aCod',   lbl: 'Código',                 tipo: 'text' },
  { id: 'aZona',  lbl: 'Zona',                   tipo: 'text' },
  { id: 'aDepto', lbl: 'Departamento',           tipo: 'text' },
  { id: 'aMarca', lbl: 'Marca',                  tipo: 'text' },
  { id: 'aAnio',  lbl: 'Año de fabricación',     tipo: 'number' },
  { id: 'aPot',   lbl: 'Potencia (kVA)',         tipo: 'number', req: true },
  { id: 'aVp',    lbl: 'Tensión primaria (kV)',  tipo: 'number', req: true },
  { id: 'aVs',    lbl: 'Tensión secundaria (kV)', tipo: 'number' },
  { id: 'aVt',    lbl: 'Tensión terciaria (kV)', tipo: 'number' },
  { id: 'aRef',   lbl: 'Refrigeración',          tipo: 'text' },
  { id: 'aUucc',  lbl: 'UUCC registrada (si la tiene)', tipo: 'text' }
]);

/**
 * Formulario de alta. NO escribe en Firestore: añade el equipo a la
 * vista en memoria para clasificarlo y verlo en el tablero. Persistir
 * el parque tiene su propia ruta (`admin/importar.html`), con
 * simulación previa — no se duplica aquí.
 */
export function vistaAgregar() {
  const campos = CAMPOS_ALTA.map((c) => ''
    + '<label class="ftm-campo">'
    +   '<span class="ftm-campo-lbl">' + esc(c.lbl) + (c.req ? ' *' : '') + '</span>'
    +   '<input class="ftm-campo-input" id="' + c.id + '" type="' + c.tipo + '"'
          + (c.tipo === 'number' ? ' step="any" min="0"' : '') + '>'
    + '</label>').join('');

  return ''
    + '<div class="ftm-panel">'
    +   '<div class="ftm-panel-head"><span class="ftm-panel-tt">'
    +     'Anexar transformador a la flota</span></div>'
    +   '<div class="ftm-panel-body">'
    +     '<div class="ftm-hint ftm-hint--p">Clasifica un equipo contra el catálogo CREG sin tocar la base de '
    +     'datos: se añade <b>solo a esta pantalla</b> para ver su UC y su ficha. Para incorporarlo '
    +     'al parque de verdad está <span class="ftm-mono">admin/importar.html</span>, que simula '
    +     'antes de escribir.</div>'
    +     '<div class="ftm-form"><div class="ftm-form-grid">' + campos + '</div>'
    +       '<div class="ftm-form-row">'
    +         '<button type="button" class="ftm-btn" data-ftm="alta-previa">Vista previa de UUCC</button>'
    +         '<button type="button" class="ftm-btn ftm-btn--primary" data-ftm="alta-agregar">'
    +           'Clasificar y agregar a la flota</button>'
    +         '<button type="button" class="ftm-btn" data-ftm="alta-limpiar">Limpiar</button>'
    +       '</div>'
    +       '<div class="ftm-form-prev" data-ftm="alta-prev"></div>'
    +     '</div>'
    +   '</div>'
    + '</div>';
}

export default { vistaAnalitica, vistaNorma, vistaAgregar, resumenGerencial, valorReposicion };
