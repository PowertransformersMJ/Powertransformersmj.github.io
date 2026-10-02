// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · panel «Gases disueltos (DGA) y carga» del detalle · `99 §127`
// ──────────────────────────────────────────────────────────────
// Se carga con import() desde detalle.js: si este archivo o sus textos fallan, el detalle queda igual que
// antes (la ranura del panel sigue oculta). Pinta SIEMPRE dentro del mismo nodo, así no parpadea al cambiar
// el rango y los desplegables abiertos siguen abiertos. Todo texto va con textContent (dom.js).
// Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, num } from './dom.js';
import { chipCifra } from './lista.js';
import { DEVANADO, CALCULO } from '../../domain/scada_carga_config.js';
import { intervaloCO } from '../../domain/scada_carga_fecha.js';
import { BASELINE_UMBRALES_SALUD } from '../../domain/umbrales_salud_baseline.js';
import {
  MATRIZ_ATENCION, NIVELES_ATENCION, COLUMNAS_GASES, GRUPOS_DGA, SEVERA_PCT,
  filasCarga, cruceDgaCarga, entradaCarga, leerGases, columnaGases, origenGases, palabraCondicion
} from '../../domain/scada_carga_dga.js';
import {
  APROBADO, CATALOGO_DGA, TEXTO_CARGA_NORMAL, NO_PUEDE_SABER, NOTA_PIE, TEXTO_FECHA_MUESTRA,
  TEXTO_ACETILENO_5, TEXTO_ACETILENO_34
} from '../../domain/scada_carga_dga_textos.js';

const VISIBLES = { adversidades: 3, acciones: 4 };
const NOMBRE_CORTO = { tdgc: 'combustibles', co: 'CO', co2: 'CO₂', c2h2: 'acetileno' };
const FAMILIA_TXT = { papel: 'gases del papel', combustibles: 'gases combustibles', acetileno: 'acetileno' };

function barra(n, provisional) {
  return el('span', { class: 'cs-dga-barra' + (provisional ? ' is-provisional' : ''), 'aria-hidden': 'true' },
    [1, 2, 3, 4, 5].map((k) => el('span', { class: k <= n ? 'is-on cs-dga-n' + n : '' })));
}

function cabecera(estado, r, entrada, filas, umbrales) {
  const caja = (clase, ...hijos) => el('div', { class: 'cs-dga-nivel ' + clase, role: 'status' }, ...hijos);
  if (estado.estado === 'leyendo') return caja('is-gris', el('b', {}, 'Calculando la carga del rango…'));
  if (estado.estado === 'error') return caja('is-gris', el('b', {}, 'Sin nivel: '), 'no se pudo leer este rango.');
  if (estado.estado === 'sin_scada') return caja('is-gris', el('b', {}, 'Sin nivel: '), estado.motivo || 'sin medición SCADA.',
    el('span', { class: 'cs-dga-sub' }, 'La cifra del Excel no reemplaza a la medida. Los gases se muestran como dato.'));
  if (!r.franja.fila) return caja('is-gris', el('b', {}, 'Sin nivel: '), r.franja.motivo + '.',
    el('span', { class: 'cs-dga-sub' }, 'Los gases se muestran como dato.'));
  if (r.franja.fila === 'R0') {
    const c = { ...BASELINE_UMBRALES_SALUD.crg, ...((umbrales && umbrales.crg) || {}) };
    const of = entrada.crgOficial != null && entrada.crgOficial >= 4 ? ' La calificación oficial (Excel) del equipo es CRG ' + entrada.crgOficial + '.' : '';
    return caja('is-normal', el('b', {}, 'Carga normal'),
      el('span', { class: 'cs-dga-sub' }, TEXTO_CARGA_NORMAL.replace('{umbral}', String(c.c4_min_excl)).replace('{crg}', entrada.crg != null ? String(entrada.crg) : '1 a 3') + of));
  }
  const nv = r.nivel;
  return caja('cs-dga-n' + nv.n + (nv.provisional ? ' is-provisional' : ''),
    barra(nv.n, nv.provisional),
    el('b', {}, nv.palabra + ' · nivel ' + nv.n + ' de 5' + (nv.provisional ? ' · provisional' : '')),
    el('span', { class: 'cs-dga-sub' }, filas[r.franja.fila] + ' × ' + COLUMNAS_GASES[r.columna.col] + '.'),
    nv.provisional ? el('span', { class: 'cs-dga-sub cs-dga-aviso' }, 'Cifra provisional: confirme primero la medida u homologación'
      + (entrada.motivos && entrada.motivos.length ? ' (' + entrada.motivos.join(' · ') + ')' : '') + '.') : null,
    r.franja.severaSinConfirmar ? el('span', { class: 'cs-dga-sub cs-dga-aviso' }, 'Posible sobrecarga severa (más del ' + SEVERA_PCT + ' % durante ' + CALCULO.sobrecargaMinH + ' h): no cuenta como tal hasta confirmar la medida.') : null);
}

function tarjetaCarga(estado, entrada) {
  if (estado.estado !== 'ok' || !entrada || entrada.pct == null) {
    return el('div', { class: 'cs-dga-tarjeta' }, el('h4', {}, 'Carga · SCADA'),
      el('p', {}, estado.estado === 'leyendo' ? 'Leyendo el rango…' : 'Sin cifra de carga medida en este rango.'));
  }
  const f = [];
  f.push(el('p', {}, el('b', {}, num(entrada.pct, 1) + ' %'), ' ', chipCifra(entrada),
    entrada.devMax ? el('span', { class: 'cs-dga-sub' }, 'Cifra del equipo: p99 de la fase más cargada · ' + DEVANADO[entrada.devMax]) : null));
  f.push(el('p', {}, 'Horas sobre el ' + CALCULO.sobrecargaPct + ' % en ventanas de ' + CALCULO.sobrecargaMinH + ' h o más: ', el('b', {}, String(entrada.horasSobre100 || 0) + ' h'),
    entrada.horasSobre100 && entrada.devSobre ? ' (' + DEVANADO[entrada.devSobre] + ')' : ''));
  if (entrada.horasSobre100 && entrada.desde != null) {
    f.push(el('p', { class: 'cs-dga-sub' }, 'Primera ' + intervaloCO(entrada.desde) + ' · última ' + intervaloCO(entrada.hasta) + '.'));
  }
  if (entrada.max2h != null) f.push(el('p', {}, 'Máximo sostenido ' + CALCULO.sobrecargaMinH + ' h: ', el('b', {}, num(entrada.max2h, 1) + ' %'),
    entrada.devMax2h ? ' (' + DEVANADO[entrada.devMax2h] + ')' : ''));
  if (entrada.picoMax != null && entrada.picoMax > CALCULO.sobrecargaPct && !(entrada.horasSobre100 > 0)) {
    f.push(el('p', { class: 'cs-dga-sub' }, 'Hubo horas sueltas sobre el ' + CALCULO.sobrecargaPct + ' % (máximo ' + num(entrada.picoMax, 1) + ' %) sin llegar a ' + CALCULO.sobrecargaMinH + ' h seguidas. El promedio de cada hora no muestra picos de minutos: véalos con «Máximo de la hora» en las curvas.'));
  }
  if (entrada.excluidas) f.push(el('p', { class: 'cs-dga-sub' }, 'Se descartaron ' + entrada.excluidas + ' h con valores imposibles (más de 3 veces la ampacidad): no cuentan como sobrecarga.'));
  return el('div', { class: 'cs-dga-tarjeta' }, el('h4', {}, 'Carga · SCADA'), f);
}

function tarjetaGases(g, cg) {
  const o = origenGases(g);
  const resaltar = new Set(o.grupos);
  const deDonde = g.dga == null ? null
    : (o.grupos.length ? 'Pesan: ' + o.grupos.map((k) => NOMBRE_CORTO[k] + ' ' + g[k]).join(', ') + ' (' + [...o.familias].map((x) => FAMILIA_TXT[x]).join(' y ') + ').'
      : 'Ningún grupo pasa de Bueno.');
  return el('div', { class: 'cs-dga-tarjeta' }, el('h4', {}, 'Gases · Salud de Activos'),
    el('p', {}, 'DGA oficial: ', el('b', {}, g.dga == null ? 'sin calificación' : Math.round(g.dga) + ' · ' + palabraCondicion(g.dga)),
      el('span', { class: 'cs-dga-sub' }, g.dga == null ? 'Salud de Activos no tiene calificación de gases para este equipo: no se supone ningún valor.'
        : (g.dgaCalculada ? 'Calculada aquí con la regla oficial: ' : '') + 'promedio redondeado de los cuatro grupos (MO.00418 §A3.1).')),
    el('ul', { class: 'cs-dga-grupos' }, GRUPOS_DGA.map(({ k, nombre }) => el('li', { class: resaltar.has(k) ? 'is-alto' : '' },
      el('span', {}, nombre), el('b', {}, g[k] == null ? '—' : g[k] + ' · ' + palabraCondicion(g[k]))))),
    deDonde ? el('p', { class: 'cs-dga-sub' }, deDonde) : null,
    g.grupos && g.grupos < 4 ? el('p', { class: 'cs-dga-sub' }, 'Calificado con ' + g.grupos + ' de 4 grupos.') : null,
    cg.subio ? el('p', { class: 'cs-dga-sub' }, 'Los gases combustibles están en ' + g.tdgc + ': el nivel se toma una columna más arriba que la DGA oficial.') : null,
    g.c2h2 === 5 ? el('p', { class: 'cs-dga-sub cs-dga-aviso' }, TEXTO_ACETILENO_5) : null,
    g.c2h2 === 3 || g.c2h2 === 4 ? el('p', { class: 'cs-dga-sub' }, TEXTO_ACETILENO_34) : null,
    g.grupos ? el('p', { class: 'cs-dga-sub' }, TEXTO_FECHA_MUESTRA) : null);
}

function item(it) {
  return el('li', {}, it.texto,
    it.cuando ? el('span', { class: 'cs-dga-cuando' }, ' Cuándo: ' + it.cuando + '.') : null,
    el('span', { class: 'cs-dga-fuente' }, ' [' + it.fuente + (it.inferencia ? ' · criterio de ingeniería' : '') + ']'));
}

function lista(titulo, items, n, ordenada, id) {
  if (!items.length) return null;
  const tag = ordenada ? 'ol' : 'ul';
  const resto = items.slice(n);
  return el('div', { class: 'cs-dga-bloque' }, el('h3', { id }, titulo + ' (' + items.length + ')'),
    el(tag, { class: 'cs-dga-lista' }, items.slice(0, n).map(item)),
    resto.length ? el('details', { class: 'cs-dga-mas', 'data-k': id }, el('summary', {}, 'Ver ' + (resto.length === 1 ? 'la otra' : 'las otras ' + resto.length)),
      el(tag, { class: 'cs-dga-lista', start: ordenada ? String(n + 1) : null }, resto.map(item))) : null);
}

function tablaDecision(r, filas) {
  const fil = Object.keys(MATRIZ_ATENCION);
  const cols = Object.keys(COLUMNAS_GASES);
  return el('details', { class: 'cs-dga-mas', 'data-k': 'tabla' }, el('summary', {}, 'Cómo se decide el nivel'),
    el('div', { class: 'cs-tabla-caja', style: 'margin-top:8px' },
      el('table', { class: 'cs-tabla cs-dga-tabla' },
        el('caption', {}, 'Carga (filas) × gases (columnas); manda la fila más alta que se cumpla. Sin carga cerca de la capacidad el panel no da nivel. La columna sale de la DGA oficial (promedio de los cuatro grupos); los gases combustibles en 4–5 suben una columna y el acetileno en 5 se trata como los gases 4–5 (MO.00418 §A9.1). La fila severa usa 1,3 p.u., el menor tope de corriente de IEC 60076-7:2005 Tabla 4, como criterio conservador: sin temperatura no se sabe si se superó el de punto caliente.'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Carga'), cols.map((c) => el('th', { scope: 'col' }, c + ' · ' + COLUMNAS_GASES[c])))),
        el('tbody', {}, fil.map((f) => el('tr', {}, el('th', { scope: 'row' }, filas[f]),
          cols.map((c) => {
            const n = MATRIZ_ATENCION[f][c];
            const aqui = r && r.nivel && r.franja.fila === f && r.columna.col === c;
            return el('td', { class: 'cs-dga-celda cs-dga-n' + n + (aqui ? ' is-aqui' : ''), 'aria-current': aqui ? 'true' : null },
              NIVELES_ATENCION[n - 1].palabra + ' (' + n + ')' + (aqui ? ' ◄ este equipo' : ''));
          })))))));
}

/**
 * Pinta el panel en `nodo` (siempre el mismo nodo del equipo).
 * @param {HTMLElement} nodo
 * @param {{tx:object, estado:{estado:'leyendo'|'ok'|'error'|'sin_scada', motivo?:string}, calc?:object, porNivel?:object,
 *          umbrales?:object, rango?:string}} p
 *   calc y porNivel llegan SOLO con 'ok' (el cálculo recién hecho del rango): nunca el de un rango anterior.
 */
export function pintarPanelDga(nodo, { tx, estado, calc, porNivel, umbrales, rango }) {
  const ok = estado.estado === 'ok';
  const entrada = ok ? entradaCarga(calc, porNivel) : null;
  const r = ok ? cruceDgaCarga(tx, entrada, CATALOGO_DGA) : null;
  const g = r ? r.gases : leerGases(tx);
  const cg = r ? r.columna : columnaGases(g);
  const filas = filasCarga(umbrales);
  // Los desplegables que la persona dejó abiertos siguen abiertos al cambiar el rango.
  const abiertos = new Set([...nodo.querySelectorAll('details[data-k][open]')].map((d) => d.dataset.k));
  poner(nodo,
    el('div', { class: 'cs-dga-titulo' }, el('h2', { id: 'csDgaTitulo' }, 'Gases disueltos (DGA) y carga'),
      APROBADO ? null : el('span', { class: 'cs-dga-borrador' }, 'Borrador · pendiente del Ingeniero')),
    rango ? el('p', { class: 'cs-ayuda', style: 'margin:0 0 6px' }, 'Nivel para el rango ' + rango + '.') : null,
    cabecera(estado, r || { franja: { fila: null, motivo: '' } }, entrada, filas, umbrales),
    el('div', { class: 'cs-dga-medido' }, tarjetaCarga(estado, entrada), tarjetaGases(g, cg)),
    r && r.nivel ? lista('Posibles adversidades', r.adversidades, VISIBLES.adversidades, false, 'csDgaAdv') : null,
    r && r.nivel ? lista('Acciones preventivas', r.acciones, VISIBLES.acciones, true, 'csDgaAcc') : null,
    tablaDecision(r, filas),
    el('details', { class: 'cs-dga-mas', 'data-k': 'limites' }, el('summary', {}, 'Lo que este panel no puede saber'),
      el('ul', { class: 'cs-dga-lista' }, NO_PUEDE_SABER.map((t) => el('li', {}, t)))),
    el('p', { class: 'cs-ayuda' }, NOTA_PIE));
  for (const d of nodo.querySelectorAll('details[data-k]')) if (abiertos.has(d.dataset.k)) d.open = true;
  nodo.hidden = false;
}
