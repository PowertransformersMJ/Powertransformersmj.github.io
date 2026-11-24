// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · gráficos en SVG propio
// ──────────────────────────────────────────────────────────────────────────────
// Sin librerías nuevas ni CDN: SVG armado con createElementNS y textContent (nunca innerHTML). Sin viewBox: lo
// horizontal va en % del ancho y lo vertical en píxeles, para que el texto no se encoja en un celular.
//   · graficoPorContratista: barras horizontales apiladas, una por contratista, con un tramo por estado
//     (Cerradas · Ejecutadas sin cerrar · Por ejecutar · No ejecutadas · Inactivas · Otro), largo proporcional
//     al total; el total va en la punta. Pulsar un tramo abre la lista de esas ODT.
//   · graficoMensual: columnas por mes, Generadas (mes de la fecha prevista) junto a Cerradas (mes de la
//     FECHA ODT CERRADA), con un solo eje y SIN HUECOS: los meses sin datos van en 0 (rellenarMeses del dominio),
//     también en «Ver los datos del gráfico»; así un filtro no junta meses que no son seguidos. Con un PERIODO
//     (2026-11-24) la vista le pasa ya sus meses (`rellenar: false`) y `alElegirMes`: pulsar una columna, o el mes en
//     «Ver los datos del gráfico» (un botón, para el teclado), pone ese mes como periodo.
// Colores: la paleta categórica validada (orden fijo, el color sigue al estado y no a su puesto; separación
// para daltonismo comprobada); como tres tonos quedan por debajo de 3:1 sobre blanco, los datos también van en
// tablas (la tabla por contratista y «Ver los datos del gráfico»). Cada tramo y cada columna lleva su <title>
// (el aviso al pasar el puntero) y el gráfico entero su título y descripción para lectores de pantalla.
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { h } from './comun.js';
import { ETIQUETA_CLAVE, nombreMes, rellenarMeses } from '../../domain/odt_afinia_indicadores.js';

const NS = 'http://www.w3.org/2000/svg';
/** El orden de los tramos (y de la leyenda). */
export const ORDEN_PILA = Object.freeze(['cerrada', 'ejecutada', 'generada', 'noEjecutada', 'inactiva', 'otro']);
/** Color de cada estado (el mismo en todos los gráficos de la página). */
export const COLOR_ESTADO = Object.freeze({
  cerrada: '#2a78d6', ejecutada: '#eb6834', generada: '#1baf7a', noEjecutada: '#eda100', inactiva: '#e87ba4', otro: '#008300'
});
export const COLOR_MES = Object.freeze({ generadas: '#e34948', cerradas: '#2a78d6' });

const num = (n) => Number(n || 0).toLocaleString('es-CO');
let _n = 0;
const idNuevo = (p) => p + '-' + (++_n);

/** Crea un elemento SVG: atributos con setAttribute (también `class`), `text` → textContent. */
export function s(tag, attrs = {}, ...hijos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of hijos.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

/** La leyenda (HTML): una muestra de color (por clase, sin estilos en línea) y su nombre por serie. */
export function leyenda(series) {
  return h('ul', { class: 'odt-ind-leyenda', 'aria-label': 'Leyenda' },
    series.map((x) => h('li', { class: 'odt-ind-leyenda-item' },
      h('span', { class: 'odt-ind-muestra odt-ind-muestra--' + x.clave, 'aria-hidden': 'true' }), x.texto)));
}

/** Un paso «redondo» para el eje (1, 2 o 5 por una potencia de 10). */
export function pasoEje(max, marcas = 4) {
  if (!(max > 0)) return 1;
  const bruto = max / marcas;
  const p = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 5, 10]) if (m * p >= bruto) return Math.max(1, m * p);
  return Math.max(1, 10 * p);
}
const pct = (x) => (Math.round(x * 100) / 100) + '%';

/**
 * Barras apiladas por contratista. Lo horizontal va en % del ancho y lo vertical en píxeles (sin viewBox): así el
 * texto conserva su tamaño en un celular.
 * @param {Array<{clave:string, total:number}>} filas  en el orden en que se muestran
 * @param {{alElegir?:(sel:{empresa:string, clave:string})=>void}} [op]
 * @returns {HTMLElement} figure (leyenda + svg)
 */
export function graficoPorContratista(filas, { alElegir } = {}) {
  const claves = ORDEN_PILA.filter((k) => filas.some((f) => (f[k] || 0) > 0));
  const FILA = 46; const BARRA = 18; const UTIL = 86;   // % del ancho para la barra más larga (el resto, su total)
  const max = Math.max(1, ...filas.map((f) => f.total || 0));
  const alto = Math.max(1, filas.length) * FILA + 4;
  const idT = idNuevo('odt-ind-t'); const idD = idNuevo('odt-ind-d');
  const svg = s('svg', { width: '100%', height: alto, class: 'odt-ind-svg', role: 'img', 'aria-labelledby': idT + ' ' + idD },
    s('title', { id: idT, text: 'ODT por contratista y estado' }),
    s('desc', { id: idD, text: filas.map((f) => f.clave + ': ' + num(f.total) + ' ODT, ' + claves.map((k) => ETIQUETA_CLAVE[k].toLowerCase() + ' ' + num(f[k])).join(', ')).join('. ') }));
  filas.forEach((f, i) => {
    const y = i * FILA;
    const g = s('g', { class: 'odt-ind-svg-fila' });
    g.appendChild(s('text', { x: 0, y: y + 13, class: 'odt-ind-svg-etq', text: f.clave }));
    let x = 0;
    for (const k of claves) {
      const v = f[k] || 0;
      if (!v) continue;
      const w = (v / max) * UTIL;
      // El borde del color de la superficie hace de separación de 2 px entre tramos (no es tinta de dato).
      const rect = s('rect', {
        x: pct(x), y: y + 20, width: pct(w), height: BARRA, fill: COLOR_ESTADO[k], stroke: '#ffffff', 'stroke-width': 2,
        class: 'odt-ind-svg-tramo'
      }, s('title', { text: f.clave + ' · ' + ETIQUETA_CLAVE[k] + ': ' + num(v) + ' de ' + num(f.total) }));
      if (typeof alElegir === 'function') rect.addEventListener('click', () => alElegir({ empresa: f.clave, clave: k }));
      g.appendChild(rect);
      x += w;
    }
    g.appendChild(s('text', { x: pct(x), dx: 6, y: y + 20 + 13, class: 'odt-ind-svg-valor', text: num(f.total) }));
    svg.appendChild(g);
  });
  return h('figure', { class: 'odt-ind-figura' },
    h('figcaption', { class: 'odt-ind-figura-titulo', text: 'ODT por contratista y estado' }),
    leyenda(claves.map((k) => ({ clave: k, texto: ETIQUETA_CLAVE[k] }))),
    h('div', { class: 'odt-ind-svg-caja' }, svg),
    h('p', { class: 'odt-mini', text: 'El largo de cada barra es el total de ODT del contratista; cada color, un estado. Pulse un tramo (o un número de la tabla) para ver esas ODT.' }));
}

/**
 * Evolución mensual: Generadas (por mes de la fecha prevista) y Cerradas (por mes de la fecha de cierre), un solo eje.
 * Lo horizontal en % del ancho, lo vertical en píxeles (sin viewBox: el texto no se encoge en un celular).
 * @param {Array<{mes:string, generadas:number, cerradas:number}>} porMes  (se ordena y se rellenan los meses vacíos)
 * @param {{rellenar?:boolean, alElegirMes?:(mes:string)=>void, elegible?:(mes:string)=>boolean}} [op]
 *   rellenar: false = los meses ya vienen sin huecos (los de un periodo); alElegirMes: pulsar un mes (si es elegible).
 * @returns {HTMLElement} figure (leyenda + svg + tabla de datos)
 */
export function graficoMensual(porMes, { rellenar = true, alElegirMes = null, elegible = () => true } = {}) {
  const meses = rellenar ? rellenarMeses(porMes) : [...(porMes || [])].sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
  const sePuede = (m) => typeof alElegirMes === 'function' && elegible(m.mes) === true;
  const algunoElegible = meses.some(sePuede);
  const ALTO = 250; const ABAJO = 40; const ARRIBA = 16; const IZQ = 9;   // IZQ en % (las cifras del eje van encima de su línea)
  const n = Math.max(1, meses.length);
  const banda = (100 - IZQ) / n;
  const col = Math.max(0.6, Math.min(banda * 0.36, 4.5));                    // % del ancho por columna
  const max = Math.max(1, ...meses.map((m) => Math.max(m.generadas || 0, m.cerradas || 0)));
  const paso = pasoEje(max);
  const tope = Math.ceil(max / paso) * paso;
  const altoUtil = ALTO - ARRIBA - ABAJO;
  const yDe = (v) => ARRIBA + altoUtil - (v / tope) * altoUtil;
  const idT = idNuevo('odt-ind-t'); const idD = idNuevo('odt-ind-d');
  const svg = s('svg', { width: '100%', height: ALTO, class: 'odt-ind-svg', role: 'img', 'aria-labelledby': idT + ' ' + idD },
    s('title', { id: idT, text: 'Generadas y cerradas por mes' }),
    s('desc', { id: idD, text: meses.map((m) => nombreMes(m.mes, true) + ': ' + num(m.generadas) + ' generadas y ' + num(m.cerradas) + ' cerradas').join('. ') }));
  for (let v = 0; v <= tope; v += paso) {
    const y = yDe(v).toFixed(1);
    svg.appendChild(s('line', { x1: '0%', x2: '100%', y1: y, y2: y, class: 'odt-ind-svg-rejilla' }));
    svg.appendChild(s('text', { x: 0, y: (Number(y) - 3).toFixed(1), class: 'odt-ind-svg-eje', text: num(v) }));
  }
  const saltar = n > 12 ? Math.ceil(n / 12) : 1;
  meses.forEach((m, i) => {
    const centro = IZQ + i * banda + banda / 2;
    for (const [serie, x] of [['generadas', centro - col - 0.15], ['cerradas', centro + 0.15]]) {
      const v = m[serie] || 0;
      const y = yDe(v);
      const elegir = sePuede(m);
      svg.appendChild(s('rect', {
        x: pct(x), y: y.toFixed(1), width: pct(col), height: Math.max(0, ARRIBA + altoUtil - y).toFixed(1),
        fill: COLOR_MES[serie], class: 'odt-ind-svg-col' + (elegir ? ' odt-ind-svg-col--elegible' : ''),
        onclick: elegir ? () => alElegirMes(m.mes) : null
      }, s('title', { text: nombreMes(m.mes, true) + ': ' + num(v) + ' ' + serie + (elegir ? ' (pulse para ver solo este mes)' : '') })));
    }
    if (i % saltar === 0) {
      // Solo el mes («mar»): con el año al lado se montaban en un celular. El año va debajo, en el primero y en cada enero.
      const [mesCorto, anio] = nombreMes(m.mes).split(' ');
      svg.appendChild(s('text', { x: pct(centro), y: ALTO - 22, class: 'odt-ind-svg-eje', 'text-anchor': 'middle', text: mesCorto }));
      if (i === 0 || /-01$/.test(m.mes)) svg.appendChild(s('text', { x: pct(centro), y: ALTO - 6, class: 'odt-ind-svg-eje odt-ind-svg-anio', 'text-anchor': 'middle', text: anio || '' }));
    }
  });
  const tabla = h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla' },
    h('caption', { class: 'odt-oculto', text: 'Generadas y cerradas por mes' }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Mes' }), h('th', { scope: 'col', class: 'odt-ind-n', text: 'Generadas' }), h('th', { scope: 'col', class: 'odt-ind-n', text: 'Cerradas' }))),
    h('tbody', {}, meses.map((m) => h('tr', {},
      sePuede(m)
        ? h('th', { scope: 'row' }, h('button', {
          type: 'button', class: 'odt-ind-mes-btn', text: nombreMes(m.mes, true),
          'aria-label': 'Ver solo ' + nombreMes(m.mes, true) + ' (lo pone como periodo)', onclick: () => alElegirMes(m.mes)
        }))
        : h('th', { scope: 'row', text: nombreMes(m.mes, true) }),
      h('td', { class: 'odt-ind-n', text: num(m.generadas) }), h('td', { class: 'odt-ind-n', text: num(m.cerradas) }))))));
  return h('figure', { class: 'odt-ind-figura' },
    h('figcaption', { class: 'odt-ind-figura-titulo', text: 'Evolución mensual: generadas y cerradas' }),
    leyenda([{ clave: 'generadas', texto: 'Generadas (mes de la fecha prevista)' }, { clave: 'cerradasMes', texto: 'Cerradas (mes de la fecha de cierre)' }]),
    h('div', { class: 'odt-ind-svg-caja' }, svg),
    algunoElegible ? h('p', { class: 'odt-mini', text: 'Pulse una columna (o un mes en «Ver los datos del gráfico») para ver solo ese mes.' }) : null,
    h('details', { class: 'odt-detalles' }, h('summary', { text: 'Ver los datos del gráfico' }), tabla));
}
