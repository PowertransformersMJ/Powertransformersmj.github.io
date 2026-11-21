// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · zonas de las casillas (dominio PURO)
// ──────────────────────────────────────────────────────────────────────────────
// Dónde va cada firma en la ÚLTIMA página. No se confía en coordenadas fijas: un
// PDF exportado de Excel corre las filas cuando un texto ocupa más líneas
// (comité W-11, arq). Se buscan las ETIQUETAS impresas («AZT EN SITIO»,
// «RESPONSABLE O.D.T.», «SI», «FECHA CIERRE») entre los ítems de texto que da
// pdf.js (`getTextContent`, ya convertidos a {str,x,y,w,h}); cada zona se mueve
// lo mismo que su etiqueta, y si una etiqueta falta o se sale de ±3 pt de lo
// esperado, se RECHAZA («formato distinto, no se estampa»).
//
// Unidades: puntos PDF, origen abajo-izquierda (el de pdf-lib y el del
// `transform` de pdf.js con MediaBox en (0,0) y sin rotación: el formato lo exige).
// Archivo NUEVO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

import { ETIQUETA_ROL } from './odt_afinia_rutas.js';

/** Tolerancia de cada etiqueta respecto de su posición esperada (pt, por eje). */
export const TOLERANCIA_PT = 3;

/**
 * Zonas MEDIDAS en la ODT de referencia (DISENO-FINAL §4). Son también el
 * respaldo: la zona derivada = esta + el corrimiento de su etiqueta.
 * azt / responsable: rectángulos de la firma. si / fecha: punto donde se
 * escribe la «X» y la FECHA CIERRE (línea base del texto).
 */
export const ZONAS_MEDIDAS = Object.freeze({
  responsable: Object.freeze({ x: 81.20, y: 190.50, w: 121.02, h: 34.50 }),
  azt: Object.freeze({ x: 225.22, y: 190.50, w: 159.45, h: 34.50 }),
  si: Object.freeze({ x: 224.94, y: 156.2 }),
  fecha: Object.freeze({ x: 316.0, y: 156.2 })
});

/** Texto de la etiqueta que ancla cada zona. */
export const ETIQUETAS = Object.freeze({
  azt: ETIQUETA_ROL.azt,
  responsable: ETIQUETA_ROL.responsable,
  si: 'SI',
  fecha: 'FECHA CIERRE'
});
export const CLAVES_ZONA = Object.freeze(['azt', 'responsable', 'si', 'fecha']);

/**
 * Posición ESPERADA de cada etiqueta (esquina izquierda de su línea base).
 * CALIBRADAS el 2026-11-20 con seis ODT reales medidas en local (pdf.js + pdf-lib):
 * las cuatro etiquetas salen con desplazamiento 0 en las seis. En el repo quedan
 * SOLO los números; las ODT, sus huellas y la medición quedan en la bóveda (P5).
 * Si el formato de Afinia cambia, se vuelve a calibrar igual: solo cambian estos
 * números (y ANCLAS_CALIBRADAS vuelve a false mientras tanto).
 */
export const ANCLAS_ESPERADAS = Object.freeze({
  responsable: Object.freeze({ x: 106.20, y: 168.02 }),
  azt: Object.freeze({ x: 280.13, y: 168.02 }),
  si: Object.freeze({ x: 199.22, y: 156.26 }),
  fecha: Object.freeze({ x: 274.73, y: 156.26 })
});
export const ANCLAS_CALIBRADAS = true;

// ── Texto ──────────────────────────────────────────────────────────────────────
/** Mayúsculas, sin tildes, espacios colapsados (para comparar lo que imprime Excel). */
export function normalizarTexto(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ \s]+/g, ' ')
    .trim()
    .toUpperCase();
}
/** Igual que normalizarTexto pero SIN espacios (Excel parte textos en ítems sueltos). */
export const compacto = (s) => normalizarTexto(s).replace(/ /g, '');

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
function itemValido(it) {
  return it && typeof it.str === 'string' && Number.isFinite(num(it.x)) && Number.isFinite(num(it.y));
}

/**
 * Agrupa los ítems en líneas (misma línea base ±tolY) y los ordena de arriba
 * abajo y de izquierda a derecha. Ítems vacíos fuera.
 */
export function lineas(items, tolY = 1.5) {
  const v = (items || []).filter(itemValido).filter((it) => it.str.trim() !== '')
    .slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const out = [];
  for (const it of v) {
    const l = out.find((L) => Math.abs(L.y - it.y) <= tolY);
    if (l) l.items.push(it); else out.push({ y: it.y, items: [it] });
  }
  for (const l of out) l.items.sort((a, b) => a.x - b.x);
  return out;
}

/** Texto de una página (líneas unidas con salto; ítems con espacio). */
export function textoDePagina(items) {
  return lineas(items).map((l) => l.items.map((it) => it.str).join(' ')).join('\n');
}

/**
 * Todas las apariciones de `etiqueta` como ítem o como ítems SEGUIDOS de una
 * misma línea cuyo texto compacto es exactamente el de la etiqueta («SI» no casa
 * con «SITIO»). Devuelve [{x, y, w, h}].
 */
export function buscarEtiqueta(items, etiqueta) {
  const meta = compacto(etiqueta);
  if (!meta) return [];
  const out = [];
  for (const l of lineas(items)) {
    for (let i = 0; i < l.items.length; i++) {
      let acum = '';
      for (let j = i; j < l.items.length; j++) {
        acum += compacto(l.items[j].str);
        if (acum.length > meta.length || !meta.startsWith(acum)) break;
        if (acum === meta) {
          const a = l.items[i]; const b = l.items[j];
          const fin = num(b.x) + (Number.isFinite(num(b.w)) ? b.w : 0);
          const h = Math.max(...l.items.slice(i, j + 1).map((it) => (Number.isFinite(num(it.h)) ? it.h : 0)));
          out.push({ x: a.x, y: a.y, w: Math.max(0, fin - a.x), h });
          break;
        }
      }
    }
  }
  return out;
}

const mover = (z, dx, dy) => (z.w != null ? { x: z.x + dx, y: z.y + dy, w: z.w, h: z.h } : { x: z.x + dx, y: z.y + dy });
const redondear = (n) => Math.round(n * 100) / 100;
const redondearZona = (z) => Object.fromEntries(Object.entries(z).map(([k, v]) => [k, redondear(v)]));

/**
 * Zonas a partir de las etiquetas de la última página.
 * @param {Array<{str:string,x:number,y:number,w?:number,h?:number}>} items
 * @param {{tolerancia?:number, pagina?:{ancho:number, alto:number}}} [op]
 * @returns {{ok:true, zonas:object, desplazamientos:object} | {ok:false, errores:Array<{clave:string, codigo:string, mensaje:string}>}}
 */
export function zonasDesdeEtiquetas(items, { tolerancia = TOLERANCIA_PT, pagina } = {}) {
  const zonas = {}; const desplazamientos = {}; const errores = [];
  for (const clave of CLAVES_ZONA) {
    const esp = ANCLAS_ESPERADAS[clave];
    const cands = buscarEtiqueta(items, ETIQUETAS[clave])
      .map((c) => ({ ...c, dx: c.x - esp.x, dy: c.y - esp.y }))
      .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
    if (!cands.length) {
      errores.push({ clave, codigo: 'falta_etiqueta', mensaje: 'No aparece la etiqueta «' + ETIQUETAS[clave] + '» en la última página: formato distinto, no se estampa.' });
      continue;
    }
    const c = cands[0];
    if (Math.abs(c.dx) > tolerancia || Math.abs(c.dy) > tolerancia) {
      errores.push({ clave, codigo: 'fuera_de_tolerancia', mensaje: 'La etiqueta «' + ETIQUETAS[clave] + '» está corrida ' + redondear(c.dx) + ' / ' + redondear(c.dy) + ' pt (máximo ±' + tolerancia + '): formato distinto, no se estampa.' });
      continue;
    }
    zonas[clave] = redondearZona(mover(ZONAS_MEDIDAS[clave], c.dx, c.dy));
    desplazamientos[clave] = { dx: redondear(c.dx), dy: redondear(c.dy) };
  }
  if (!errores.length && pagina) {
    for (const clave of ['azt', 'responsable']) {
      const z = zonas[clave];
      if (z.x < 0 || z.y < 0 || z.x + z.w > pagina.ancho || z.y + z.h > pagina.alto) {
        errores.push({ clave, codigo: 'fuera_de_pagina', mensaje: 'La casilla «' + ETIQUETAS[clave] + '» queda fuera de la página.' });
      }
    }
  }
  if (errores.length) return { ok: false, errores };
  return { ok: true, zonas, desplazamientos };
}

/**
 * Zonas GUARDADAS en una ODT: ¿son las que habría derivado validarOdt? La regla solo
 * mira su forma (odtZonas), así que quien publica desde otro cliente podría poner la
 * casilla del AZT en cualquier sitio. Antes de componer para mostrar, firmar o
 * descargar se exige: forma correcta, cada zona a ±tolerancia pt (por eje) de
 * ZONAS_MEDIDAS y los rectángulos con el MISMO ancho y alto (solo se corren).
 * @returns {string|null}  el motivo para no seguir, o null
 */
export function errorZonasGuardadas(z, { tolerancia = TOLERANCIA_PT } = {}) {
  if (!esZonas(z)) return 'La ODT no trae bien las posiciones de las casillas: no se compone ni se firma. Avise al administrador.';
  for (const clave of CLAVES_ZONA) {
    const m = ZONAS_MEDIDAS[clave]; const q = z[clave];
    const corrida = Math.abs(q.x - m.x) > tolerancia + 1e-9 || Math.abs(q.y - m.y) > tolerancia + 1e-9;
    const otraMedida = m.w != null && (Math.abs(q.w - m.w) > 0.01 || Math.abs(q.h - m.h) > 0.01);
    if (corrida || otraMedida) {
      return 'La casilla «' + ETIQUETAS[clave] + '» de esta ODT no está donde la pone el formato (más de ±' + tolerancia + ' pt): no se compone ni se firma. Avise al administrador.';
    }
  }
  return null;
}

/** ¿Es un juego de zonas bien formado? (lo que se guarda en la ODT y recibe componer). */
export function esZonas(z) {
  const n = (v) => typeof v === 'number' && Number.isFinite(v);
  const rect = (r) => r && n(r.x) && n(r.y) && n(r.w) && n(r.h) && r.w > 0 && r.h > 0;
  const punto = (p) => p && n(p.x) && n(p.y);
  return !!z && rect(z.azt) && rect(z.responsable) && punto(z.si) && punto(z.fecha);
}
