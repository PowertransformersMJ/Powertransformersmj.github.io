// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Firma de ODT Afinia · INDICADORES · la vista de UN corte
// ──────────────────────────────────────────────────────────────────────────────
// Lo que el Ingeniero ve de un corte guardado (#indicadores = el último suyo; #indicadores=<id> = uno del historial):
//   · datos del corte (responsable, fecha de los datos y de guardado, archivo y su huella, rango de fechas previstas);
//   · filtros por tipo de trabajo, zona, contratista, AZT en sitio y jefe de trabajo (estos dos, con cuántas ODT tiene
//     cada persona en el corte; pedido del 2026-11-24): se combinan y TODO lo de abajo se recalcula sobre las ODT del
//     corte. Un corte de la versión 1 no guardó el AZT ni el jefe: esos dos filtros salen deshabilitados, con la nota
//     NOTA_SIN_AZT_JEFE;
//   · tarjetas con los totales (Generadas, Por ejecutar, Ejecutadas sin cerrar, Cerradas, No ejecutadas /
//     inactivas, % de cierre) y, justo debajo, qué es cada una;
//   · tabla por contratista, ordenable, con fila de total; cada número abre la lista de esas ODT;
//   · gráfico de barras apiladas por contratista y evolución mensual (generadas vs cerradas, meses sin huecos);
//   · por tipo de trabajo y por zona (sus columnas suman el total; cada número abre su lista);
//   · la lista de ODT de un número (N.º, contratista si la lista los mezcla, subestación, tipo, AZT y jefe de trabajo
//     si el corte los trae, fecha prevista, estado en Afinia, fecha de cierre y su estado en SGM, consultado POR N.º y
//     de solo lectura: Por subsanar / Publicada en firma / Lista / Cerrada en SGM / No está en SGM);
//   · comparación con el corte ANTERIOR del mismo responsable (buscado con su propia consulta, no en el historial):
//     ± por estado y por contratista (también el % de cierre) y las ODT que cambiaron de estado o aparecieron. Si el
//     anterior es de la versión 1 y hay un filtro por AZT o por jefe, no se compara (NOTA_COMPARAR_SIN_AZT_JEFE):
//     sus ODT no traen con qué filtrar y los números engañarían; entre dos de la versión 2, con ese filtro, una línea
//     avisa que una ODT que cambió de AZT o de jefe sale como nueva o como que ya no aparece (NOTA_COMPARAR_PERSONA);
//   · si ninguna ODT cumple los filtros, el resumen lo dice (NOTA_SIN_RESULTADOS) y el gráfico por contratista deja una
//     frase (SIN_GRAFICO_CONTRATISTA); con un filtro por AZT o por jefe junto con otro (o sin resultados), el resumen
//     aclara que el número de cada persona es de todo el corte (NOTA_CONTEO_PERSONA). El título de la lista de ODT
//     nombra los filtros activos;
//   · historial de cortes con enlace a cada uno y «Ver cortes más antiguos» (de 50 en 50).
// Todo con textContent (nunca innerHTML). Archivo NUEVO a propósito (L-102): a sus vecinos de antes (comun.js)
// solo les pide nombres que ya existían.
// ══════════════════════════════════════════════════════════════════════════════

import { h, vaciar, aviso, mensajeDe, fechaHora } from './comun.js';
import {
  INDICADORES, DEFINICION_OTRO, ETIQUETA_CLAVE, ESTADO_DE_CLAVE, agregar, filtrar, opcionesFiltro, seleccionar, ordenarFilas,
  textoCierre, deltaCierre, valorIndicador, compararCortes, textoDelta, corteAnterior, fechaDMA, textoFechaDatos,
  SGM_NO_ESTA, SGM_SIN_CONSULTAR, SIN_DATO, corteTraeAztJefe
} from '../../domain/odt_afinia_indicadores.js';
import { graficoPorContratista, graficoMensual } from './indicadores-graficos.js';

/** Cuántas ODT se pintan de entrada en una lista (el resto con «Mostrar todas»). */
export const TOPE_LISTA = 200;
/** Junto a los filtros del AZT y del jefe, deshabilitados, en un corte de la versión 1 (no los guardó). */
export const NOTA_SIN_AZT_JEFE = 'Este corte se guardó antes de que se guardaran el AZT y el jefe de trabajo. Para filtrar por ellos, cargue un corte nuevo.';
/** En la comparación, si el corte anterior es de la versión 1 y hay un filtro por AZT o por jefe de trabajo. */
export const NOTA_COMPARAR_SIN_AZT_JEFE = 'El corte anterior se guardó sin el AZT y el jefe de trabajo: con el filtro por AZT en sitio o por jefe de trabajo no se puede comparar. Quite esos dos filtros para ver la comparación.';
/** En la comparación entre dos cortes que sí traen el AZT y el jefe, con un filtro por uno de ellos. */
export const NOTA_COMPARAR_PERSONA = 'Con el filtro por AZT en sitio o por jefe de trabajo: si una ODT cambió de AZT o de jefe entre los dos cortes, aquí sale como nueva o como que ya no aparece.';
/** Bajo los filtros, cuando ninguna ODT los cumple todos a la vez (y, si hay filtro por persona, de dónde sale su número). */
export const NOTA_SIN_RESULTADOS = 'Ninguna ODT cumple todos estos filtros a la vez: cambie alguno o pulse «Quitar filtros».';
export const NOTA_CONTEO_PERSONA = 'El número junto a cada AZT o jefe cuenta sus ODT en todo el corte, sin los demás filtros.';
/** En lugar del gráfico por contratista cuando ninguna ODT cumple los filtros (nunca un hueco ni un resto en pantalla). */
export const SIN_GRAFICO_CONTRATISTA = 'Sin ODT para el gráfico por contratista con estos filtros.';
/** Los filtros, en el orden de la pantalla: [clave, nombre en el resumen]. */
const FILTROS = Object.freeze([['tipo', 'Tipo'], ['zona', 'Zona'], ['empresa', 'Contratista'], ['azt', 'AZT en sitio'], ['jefe', 'Jefe de trabajo']]);
const num = (n) => Number(n || 0).toLocaleString('es-CO');
/** Las columnas de la tabla por contratista (Otro estado solo si hay). */
const COLUMNAS = Object.freeze(['total', 'generada', 'ejecutada', 'noEjecutada', 'cerrada', 'inactiva']);
/** Las de las tablas por tipo y por zona (más angostas): suman el total, con No ejecutadas e Inactivas juntas. */
const COLUMNAS_GRUPO = Object.freeze(['total', 'generada', 'ejecutada', 'cerrada', 'noEjecutadaInactiva']);
const huellaCorta = (hx) => (typeof hx === 'string' && hx.length > 16 ? hx.slice(0, 10) + '…' + hx.slice(-6) : (hx || '—'));
/** ¿`nodo` sigue colgado de `contenedor`? (si la persona se fue a otra vista, un desenlace tardío no pinta encima) */
const sigueEn = (nodo, contenedor) => { for (let n = nodo; n; n = n.parentNode) if (n === contenedor) return true; return false; };
const enfocar = (el) => { if (el && typeof el.focus === 'function') { try { el.focus(); } catch (_) { /* sin foco */ } } };
/**
 * Alto de la barra superior FIJA de la página (la del menú, 64 px, más un margen): lo que tenga su borde de arriba
 * por encima de esta línea queda tapado aunque esté dentro de la ventana. El CSS (scroll-margin-top: 80px en cada
 * destino) hace que un desplazamiento lo deje debajo de la barra.
 */
export const BARRA_FIJA_PX = 72;
/** Desplaza hasta `el` (respetando la barra fija, por su scroll-margin-top). `block`: 'start' o 'center'. */
const llevarA = (el, block = 'start') => { if (el && typeof el.scrollIntoView === 'function') { try { el.scrollIntoView({ block }); } catch (_) { /* sin desplazamiento */ } } };
/** Diferencia entre dos % de cierre (fracciones), en puntos: «+1,2 puntos», «−0,5 puntos», «0 puntos»; '—' si falta uno. */
export function deltaPuntos(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return '—';
  const d = Math.round(Number(((b - a) * 1000).toPrecision(12)));
  if (d === 0) return '0 puntos';
  return (d > 0 ? '+' : '−') + (Math.abs(d) / 10).toFixed(1).replace('.', ',') + ' puntos';
}
const dato = (t, v, attrs = {}) => h('div', { class: 'odt-dato' }, h('dt', { text: t }), h('dd', { ...attrs, text: v }));
/** Lo que dice el título de una lista según de dónde salió (contratista, tipo o zona). */
const deDonde = (sel) => [sel.empresa, sel.tipo, sel.zona].filter(Boolean).map((x) => ' · ' + x).join('');

/**
 * @param {HTMLElement} contenedor
 * @param {{corte:object, odts:object[], completo?:boolean, descartadas?:number, historial?:object[],
 *          historialTope?:boolean, masHistorial?:(antesDe:object)=>Promise<{cortes:object[], tope:boolean}>,
 *          repoCortes?:object, cargarSgm?:(nros:string[])=>Promise<{mapa:Map, consultados?:string[], tope?:boolean}>,
 *          alIr:(ancla:string, mensaje?:string)=>void, mensaje?:string, nota?:string}} p
 */
export function montarVistaCorte(contenedor, {
  corte, odts = [], completo = true, descartadas = 0, historial = [], historialTope = false, masHistorial,
  repoCortes, cargarSgm, alIr, mensaje, nota
}) {
  vaciar(contenedor);
  const estado = {
    filtros: { tipo: '', zona: '', empresa: '', azt: '', jefe: '' }, orden: { col: 'total', dir: 'desc' }, sel: null, abridor: null, verTodas: false,
    sgm: new Map(), sgmPendientes: new Set(), sgmError: '', sgmTope: false,
    anterior: null, anteriorBuscando: true, anteriorTope: false, odtsAnterior: null, anteriorCargando: false, anteriorError: '',
    historial: [...historial], historialTope: !!historialTope, historialCargando: false, historialError: ''
  };
  const rango = corte.rango || {};

  // ── Encabezado y datos del corte ──
  const zonaHistorial = h('section', { class: 'odt-ind-seccion', 'aria-label': 'Historial de cortes' });
  contenedor.append(
    h('div', { class: 'odt-acciones' },
      h('button', { type: 'button', class: 'odt-btn odt-btn--primario', text: 'Cargar un corte nuevo', onclick: () => alIr('indicadores-cargar') }),
      h('button', { type: 'button', class: 'odt-btn', text: 'Ver el historial de cortes', onclick: () => { llevarA(zonaHistorial); enfocar(zonaHistorial.firstChild); } })),
    h('h2', { class: 'odt-subtitulo odt-ind-titulo', tabindex: '-1', text: 'Indicadores de ODT · ' + (corte.responsable || '—') }),
    h('p', { class: 'odt-mini', text: 'Responsable O.D.T. en Afinia. Datos del ' + textoFechaDatos(corte) + '; corte guardado el ' + fechaHora(corte.creadoEnMs) + (corte.creadoPor && corte.creadoPor.nombre ? ' por ' + corte.creadoPor.nombre : '') + '. Un corte no cambia: es la foto del archivo de Afinia de ese día.' }),
    h('dl', { class: 'odt-datos odt-datos--fila' },
      dato('Archivo', (corte.archivo && corte.archivo.nombre) || '—', { class: 'odt-romper' }),
      dato('Huella SHA-256 (identifica este archivo exacto)', huellaCorta(corte.archivo && corte.archivo.sha256), { class: 'odt-mono', title: (corte.archivo && corte.archivo.sha256) || '' }),
      dato('Fechas previstas', 'del ' + fechaDMA(rango.desde) + ' al ' + fechaDMA(rango.hasta)),
      dato('ODT del responsable', num(corte.odts) + ' (en ' + num(corte.filasResponsable) + ' filas)'),
      dato('El archivo completo', num(corte.odtsArchivo) + ' ODT en ' + num(corte.filasArchivo) + ' filas')));
  if (mensaje) {
    const av = aviso(mensaje, 'ok');
    av.className += ' odt-ind-aviso-inicial';
    contenedor.appendChild(av);
  }
  if (nota) contenedor.appendChild(aviso(nota, 'aviso'));
  if (!completo) {
    contenedor.appendChild(aviso('Este corte está INCOMPLETO: le faltan datos guardados en la plataforma' + (descartadas ? ' (o traen otra forma)' : '') + ', así que las listas y los números recalculados pueden no cuadrar con los totales guardados (' + num(corte.totales && corte.totales.total) + ' ODT). Un corte no se puede corregir: cargue uno nuevo con el mismo archivo.', 'error'));
  }

  // ── Filtros ──
  const opciones = opcionesFiltro(odts);
  /** ¿El corte guardó el AZT y el jefe de cada ODT? (versión 2; en uno de la versión 1 sus filtros se deshabilitan) */
  const conAztJefe = corteTraeAztJefe(corte);
  const selectores = {};
  /** Un filtro: `valores` son textos o, con su conteo, [{valor, n}] («NOMBRE · 12 ODT»). */
  const selector = (id, etiqueta, valores, clave, { deshabilitado = false, describe = null, clase = '' } = {}) => {
    const opcion = (v) => (typeof v === 'string' ? h('option', { value: v, text: v }) : h('option', { value: v.valor, text: v.valor + ' · ' + num(v.n) + ' ODT' }));
    const el = h('select', { id, class: 'odt-campo', disabled: deshabilitado, 'aria-describedby': describe },
      h('option', { value: '', text: 'Todos' }), deshabilitado ? [] : valores.map(opcion));
    el.addEventListener('change', () => { estado.filtros[clave] = el.value; estado.sel = null; pintar(); });
    selectores[clave] = el;
    return h('div', { class: 'odt-campo-fila' + (clase ? ' ' + clase : '') }, h('label', { htmlFor: id, text: etiqueta }), el);
  };
  const quitar = h('button', {
    type: 'button', class: 'odt-btn odt-btn--chico', text: 'Quitar filtros',
    onclick: () => { for (const k of Object.keys(estado.filtros)) { estado.filtros[k] = ''; selectores[k].value = ''; } estado.sel = null; pintar(); }
  });
  const resumenFiltro = h('p', { class: 'odt-mini odt-ind-resumen-filtro', role: 'status' });
  const idNota = 'odtIndNotaAztJefe';
  const persona = { deshabilitado: !conAztJefe, describe: conAztJefe ? null : idNota, clase: 'odt-ind-filtro-persona' };
  contenedor.appendChild(h('section', { class: 'odt-ind-filtros', 'aria-label': 'Filtros' },
    selector('odtIndTipo', 'Tipo de trabajo', opciones.tipos, 'tipo'),
    selector('odtIndZona', 'Zona', opciones.zonas, 'zona'),
    selector('odtIndEmpresa', 'Contratista', opciones.empresas, 'empresa'),
    selector('odtIndAzt', 'AZT en sitio', opciones.azts, 'azt', persona),
    selector('odtIndJefe', 'Jefe de trabajo', opciones.jefes, 'jefe', persona),
    conAztJefe ? null : h('p', { id: idNota, class: 'odt-mini odt-ind-nota-filtros', text: NOTA_SIN_AZT_JEFE }),
    h('div', { class: 'odt-acciones odt-ind-filtros-acciones' }, quitar)));
  contenedor.appendChild(resumenFiltro);

  const zonaTarjetas = h('div', { class: 'odt-ind-tarjetas-caja' });
  const zonaDatos = h('div', { class: 'odt-ind-datos' });
  const zonaLista = h('section', { class: 'odt-ind-seccion odt-ind-lista', 'aria-label': 'Lista de ODT' });
  const zonaComparar = h('section', { class: 'odt-ind-seccion', 'aria-label': 'Comparación con el corte anterior' });
  contenedor.append(zonaTarjetas, definiciones(), zonaDatos, zonaLista, zonaComparar, zonaHistorial);

  // ── Elegir un número: la lista de esas ODT (y su estado en SGM, por N.º) ──
  function elegir(sel, abridor) {
    estado.sel = sel; estado.verTodas = false;
    estado.abridor = abridor && abridor.tagName === 'BUTTON' ? abridor : null;
    pintarLista();
    llevarA(zonaLista);
    enfocar(zonaLista.querySelectorAll('.odt-ind-lista-titulo')[0]);
  }
  function cerrarLista() {
    const volver = estado.abridor;
    estado.sel = null; estado.abridor = null;
    pintarLista();
    // El botón que abrió la lista vuelve a la vista en el centro (con su tabla alrededor, lejos de la barra fija).
    if (volver && sigueEn(volver, contenedor)) { llevarA(volver, 'center'); enfocar(volver); } else enfocar(zonaDatos.querySelectorAll('.odt-ind-h3-datos')[0]);
  }
  /** Consulta en SGM los N.º que aún no se conocen (una vez por N.º; con un error, solo con «Reintentar»). */
  function consultarSgm(xs, forzar = false) {
    if (typeof cargarSgm !== 'function' || (estado.sgmError && !forzar)) return;
    const faltanNros = [...new Set(xs.map((o) => o.nro))].filter((n) => !estado.sgm.has(n) && !estado.sgmPendientes.has(n));
    if (!faltanNros.length) return;
    for (const n of faltanNros) estado.sgmPendientes.add(n);
    estado.sgmError = '';
    Promise.resolve().then(() => cargarSgm(faltanNros))
      .then((r) => {
        const mapa = (r && r.mapa) || new Map();
        if (r && r.tope) estado.sgmTope = true;
        const consultados = new Set(r && Array.isArray(r.consultados) ? r.consultados : faltanNros);
        // null = consultado y no está; 'tope' = solo se miraron las publicaciones más recientes (no se puede afirmar).
        for (const n of faltanNros) if (consultados.has(n)) estado.sgm.set(n, mapa.get(n) || (r && r.tope ? 'tope' : null));
      }, (e) => { estado.sgmError = mensajeDe(e); })
      .finally(() => { for (const n of faltanNros) estado.sgmPendientes.delete(n); if (sigueEn(zonaLista, contenedor)) pintarLista(); });
  }

  // ── Tarjetas ──
  function tarjetas(t) {
    const items = INDICADORES.map((ind) => {
      const v = valorIndicador(t, ind.clave);
      const esPct = ind.clave === 'pctCierre';
      const cuerpo = [
        h('span', { class: 'odt-ind-tarjeta-valor', text: esPct ? textoCierre(t) : num(v) }),
        h('span', { class: 'odt-ind-tarjeta-titulo', text: ind.titulo }),
        esPct ? h('span', { class: 'odt-ind-tarjeta-nota', text: num(t.cerrada) + ' de ' + num(t.total - t.noEjecutada - t.inactiva) }) : null
      ];
      const caja = !esPct && v > 0
        ? h('button', { type: 'button', class: 'odt-ind-tarjeta-btn', 'aria-label': 'Ver las ' + num(v) + ' ODT: ' + ind.titulo, onclick: (e) => elegir({ clave: ind.clave }, e && e.currentTarget) }, ...cuerpo)
        : h('div', { class: 'odt-ind-tarjeta-btn odt-ind-tarjeta-fija' }, ...cuerpo);
      return h('li', { class: 'odt-ind-tarjeta odt-ind-tarjeta--' + ind.clave }, caja);
    });
    if (t.otro > 0) {
      items.push(h('li', { class: 'odt-ind-tarjeta odt-ind-tarjeta--otro' },
        h('button', { type: 'button', class: 'odt-ind-tarjeta-btn', 'aria-label': 'Ver las ' + num(t.otro) + ' ODT: Otro estado', onclick: (e) => elegir({ clave: 'otro' }, e && e.currentTarget) },
          h('span', { class: 'odt-ind-tarjeta-valor', text: num(t.otro) }), h('span', { class: 'odt-ind-tarjeta-titulo', text: 'Otro estado' }))));
    }
    return h('ul', { class: 'odt-ind-tarjetas', 'aria-label': 'Totales del corte' }, items);
  }

  // ── Tablas por contratista, por tipo y por zona ──
  /**
   * Una celda con su número: si es > 0, un botón que abre la lista de esas ODT (`filtro`: contratista, tipo o zona).
   * `data-etq` lleva el nombre de la columna: en un celular, la tabla por contratista se ve como fichas y lo muestra.
   */
  function celda(filtro, clave, v, nombreFila) {
    return h('td', { class: 'odt-ind-n', 'data-etq': ETIQUETA_CLAVE[clave] }, v > 0
      ? h('button', {
        type: 'button', class: 'odt-ind-num', text: num(v),
        'aria-label': 'Ver ' + num(v) + ' ODT ' + ETIQUETA_CLAVE[clave].toLowerCase() + ' · ' + nombreFila,
        onclick: (e) => elegir({ ...filtro, clave }, e && e.currentTarget)
      })
      : num(v));
  }
  /** El encabezado de una columna: su nombre y, debajo y en chico, el estado de Afinia que cuenta. */
  const titulo2 = (k) => [ETIQUETA_CLAVE[k], k !== 'total' && k !== 'otro' && ESTADO_DE_CLAVE[k] ? h('small', { class: 'odt-ind-sub', text: ESTADO_DE_CLAVE[k] }) : null];
  function encabezado(col, contenido, numerica = true) {
    const activo = estado.orden.col === col;
    const dir = activo ? estado.orden.dir : null;
    const nombre = Array.isArray(contenido) ? contenido[0] : contenido;
    return h('th', { scope: 'col', class: numerica ? 'odt-ind-n' : 'odt-ind-col1', 'aria-sort': activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none' },
      h('button', {
        type: 'button', class: 'odt-ind-orden', title: 'Ordenar por ' + nombre.toLowerCase(), dataset: { col },
        onclick: () => {
          estado.orden = activo ? { col, dir: dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'clave' ? 'asc' : 'desc' };
          pintar();
          // El foco vuelve al mismo encabezado (pintar() lo cambió por uno nuevo).
          enfocar(Array.from(zonaDatos.querySelectorAll('.odt-ind-orden')).find((b) => b.dataset && b.dataset.col === col));
        }
      }, contenido, activo ? h('span', { class: 'odt-ind-flecha', 'aria-hidden': 'true', text: dir === 'asc' ? ' ▲' : ' ▼' }) : null));
  }
  function tablaContratistas(ag) {
    const cols = ag.totales.otro > 0 ? [...COLUMNAS, 'otro'] : COLUMNAS;
    const filas = ordenarFilas(ag.porEmpresa, estado.orden.col, estado.orden.dir);
    return h('div', {},
      h('p', { class: 'odt-mini', text: 'Pulse un encabezado para ordenar y un número para ver esas ODT.' }),
      h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-fichas odt-ind-tabla-contratistas' },
        h('caption', { class: 'odt-oculto', text: 'ODT por contratista' + (estado.filtros.empresa ? ' (filtrado)' : '') }),
        h('thead', {}, h('tr', {},
          encabezado('clave', 'Contratista', false),
          cols.map((k) => encabezado(k, titulo2(k))),
          encabezado('pct', '% de cierre'))),
        h('tbody', {}, filas.map((f) => h('tr', {},
          h('th', { scope: 'row', text: f.clave }),
          cols.map((k) => celda({ empresa: f.clave }, k, f[k] || 0, f.clave)),
          h('td', { class: 'odt-ind-n', 'data-etq': '% de cierre', text: textoCierre(f) })))),
        h('tfoot', {}, h('tr', { class: 'odt-ind-total' },
          h('th', { scope: 'row', text: 'Total' }),
          cols.map((k) => celda({}, k, ag.totales[k] || 0, 'todos los contratistas')),
          h('td', { class: 'odt-ind-n', 'data-etq': '% de cierre', text: textoCierre(ag.totales) }))))));
  }
  /** Por tipo de trabajo o por zona: las columnas suman el total y cada número abre su lista. */
  function tablaGrupo(titulo, campo, filas, totales) {
    const cols = totales.otro > 0 ? [...COLUMNAS_GRUPO, 'otro'] : COLUMNAS_GRUPO;
    const nombreCol = titulo.replace(/^Por /, '').replace(/^\w/, (c) => c.toUpperCase());
    return h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-fichas' },
      h('caption', { class: 'odt-ind-caption', text: titulo }),
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col', class: 'odt-ind-col1', text: nombreCol }),
        cols.map((k) => h('th', { scope: 'col', class: 'odt-ind-n' }, ...titulo2(k))),
        h('th', { scope: 'col', class: 'odt-ind-n', text: '% de cierre' }))),
      h('tbody', {}, filas.map((f) => h('tr', {},
        h('th', { scope: 'row', text: f.clave }),
        cols.map((k) => celda({ [campo]: f.clave }, k, valorIndicador(f, k), f.clave)),
        h('td', { class: 'odt-ind-n', 'data-etq': '% de cierre', text: textoCierre(f) }))))));
  }

  // ── Lista de ODT de un número ──
  // Cada celda lleva el nombre de su columna (data-etq): si la caja de la lista mide menos de 1000 px (un portátil de
  // 1280 o de 1100 px con el menú, o un celular), el CSS la muestra como fichas y lo pinta encima de cada dato.
  const ETQ_SGM = 'Estado en SGM';
  function celdaSgm(o) {
    if (estado.sgm.has(o.nro)) {
      const x = estado.sgm.get(o.nro);
      if (x === 'tope') return h('td', { 'data-etq': ETQ_SGM, title: 'Solo se consultaron las publicaciones más recientes de «Firma» y de «Por subsanar».', text: SGM_SIN_CONSULTAR });
      return h('td', { 'data-etq': ETQ_SGM }, x ? h('span', { class: 'odt-chip odt-ind-sgm odt-ind-sgm--' + x.clave, text: x.etiqueta }) : SGM_NO_ESTA);
    }
    if (estado.sgmPendientes.has(o.nro)) return h('td', { 'data-etq': ETQ_SGM, 'aria-label': 'Consultando', text: '…' });
    return h('td', { 'data-etq': ETQ_SGM, text: SGM_SIN_CONSULTAR });
  }
  function pintarLista() {
    // Si el foco estaba en la lista (su título o un botón), vuelve a su título al repintar (p. ej., al llegar el estado en SGM).
    const activo = globalThis.document && document.activeElement;
    const teniaFoco = !!activo && activo !== zonaLista && sigueEn(activo, zonaLista);
    vaciar(zonaLista);
    if (!estado.sel) return;
    const sel = estado.sel;
    const xs = seleccionar(filtrar(odts, estado.filtros), sel);
    const visibles = estado.verTodas ? xs : xs.slice(0, TOPE_LISTA);
    consultarSgm(visibles);
    const conContratista = !sel.empresa && !estado.filtros.empresa;
    // El título nombra también los filtros activos (p. ej. « · AZT en sitio: NOMBRE»), salvo el que ya dice el número pulsado.
    const conFiltros = FILTROS.filter(([k]) => estado.filtros[k] && sel[k] !== estado.filtros[k]).map(([k, nombre]) => ' · ' + nombre + ': ' + estado.filtros[k]).join('');
    zonaLista.appendChild(h('h3', { class: 'odt-subtitulo odt-ind-lista-titulo', tabindex: '-1', text: 'ODT · ' + (ETIQUETA_CLAVE[sel.clave] || sel.clave) + deDonde(sel) + conFiltros + ' (' + num(xs.length) + ')' }));
    zonaLista.appendChild(h('div', { class: 'odt-acciones' },
      h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Cerrar la lista', onclick: cerrarLista })));
    if (estado.sgmPendientes.size) zonaLista.appendChild(h('p', { class: 'odt-cargando', text: 'Consultando el estado de estas ODT en SGM…' }));
    if (estado.sgmError) {
      zonaLista.appendChild(aviso('No se pudo consultar el estado en SGM: ' + estado.sgmError, 'aviso'));
      zonaLista.appendChild(h('div', { class: 'odt-acciones' },
        h('button', { type: 'button', class: 'odt-btn odt-btn--chico', text: 'Reintentar la consulta en SGM', onclick: () => { estado.sgmError = ''; consultarSgm(visibles, true); pintarLista(); } })));
    }
    if (estado.sgmTope) zonaLista.appendChild(h('p', { class: 'odt-mini', text: '«' + SGM_SIN_CONSULTAR + '»: solo se pudieron consultar las publicaciones más recientes de «Firma» y de «Por subsanar» (hasta 50 de cada una).' }));
    // El AZT y el jefe de trabajo, solo si el corte los guardó (versión 2): en uno de la versión 1 serían columnas vacías.
    const columnas = ['N.º', ...(conContratista ? ['Contratista'] : []), 'Subestación', 'Tipo de trabajo', ...(conAztJefe ? ['AZT', 'Jefe de trabajo'] : []),
      'Fecha prevista', 'Estado en Afinia', 'Fecha de cierre', 'Estado en SGM'];
    zonaLista.appendChild(h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-tabla-odt' },
      h('caption', { class: 'odt-oculto', text: 'Lista de ODT' }),
      h('thead', {}, h('tr', {}, columnas.map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, visibles.map((o) => h('tr', {},
        h('th', { scope: 'row', class: 'odt-mono', text: o.nro }),
        conContratista ? h('td', { 'data-etq': 'Contratista', text: o.empresa || '—' }) : null,
        h('td', { 'data-etq': 'Subestación', text: o.subestacion || '—' }),
        h('td', { 'data-etq': 'Tipo de trabajo', text: o.tipo || '—' }),
        conAztJefe ? h('td', { 'data-etq': 'AZT', text: o.azt || SIN_DATO }) : null,
        conAztJefe ? h('td', { 'data-etq': 'Jefe de trabajo', text: o.jefe || SIN_DATO }) : null,
        h('td', { 'data-etq': 'Fecha prevista', text: fechaDMA(o.prevista) }),
        h('td', { 'data-etq': 'Estado en Afinia', text: o.estado || '(sin estado)' }),
        h('td', { 'data-etq': 'Fecha de cierre', text: fechaDMA(o.cerrada) }),
        celdaSgm(o)))))));
    if (xs.length > visibles.length) {
      zonaLista.appendChild(h('div', { class: 'odt-acciones' },
        h('button', { type: 'button', class: 'odt-btn', text: 'Mostrar todas (' + num(xs.length) + ')', onclick: () => { estado.verTodas = true; pintarLista(); } })));
    }
    if (!xs.length) zonaLista.appendChild(h('p', { class: 'odt-vacio', text: 'No hay ODT con ese número y estos filtros.' }));
    if (teniaFoco) enfocar(zonaLista.querySelectorAll('.odt-ind-lista-titulo')[0]);
  }

  // ── Comparación con el corte anterior (buscado con su propia consulta; si no se puede, en el historial) ──
  function pintarComparacion() {
    vaciar(zonaComparar);
    zonaComparar.appendChild(h('h3', { class: 'odt-subtitulo', text: 'Comparación con el corte anterior' }));
    if (estado.anteriorBuscando) { zonaComparar.appendChild(h('p', { class: 'odt-cargando', text: 'Buscando el corte anterior…' })); return; }
    const anterior = estado.anterior;
    if (!anterior) {
      zonaComparar.appendChild(h('p', { class: 'odt-vacio', text: estado.anteriorTope
        ? 'No se encontró el corte anterior entre los cortes consultados. Puede haber uno más antiguo: búsquelo en el historial («Ver cortes más antiguos»).'
        : 'Es el primer corte de este responsable: todavía no hay con qué compararlo.' }));
      return;
    }
    zonaComparar.appendChild(h('p', { class: 'odt-mini' },
      'Corte anterior: datos del ' + textoFechaDatos(anterior) + ' (guardado el ' + fechaHora(anterior.creadoEnMs) + ') · ' + ((anterior.archivo && anterior.archivo.nombre) || '—') + ' · ',
      h('a', { class: 'odt-enlace', href: '#indicadores=' + anterior.id, text: 'ver ese corte' })));
    // Un anterior de la versión 1 no guardó el AZT ni el jefe: con esos filtros, sus números engañarían (todo «sin dato»).
    if ((estado.filtros.azt || estado.filtros.jefe) && !corteTraeAztJefe(anterior)) {
      zonaComparar.appendChild(h('p', { class: 'odt-vacio odt-ind-comparar-no-aplica', text: NOTA_COMPARAR_SIN_AZT_JEFE }));
      return;
    }
    if (estado.anteriorCargando) { zonaComparar.appendChild(h('p', { class: 'odt-cargando', text: 'Leyendo el corte anterior…' })); return; }
    if (estado.anteriorError) { zonaComparar.appendChild(aviso('No se pudo leer el corte anterior: ' + estado.anteriorError, 'aviso')); return; }
    if (!estado.odtsAnterior) return;
    const c = compararCortes(filtrar(estado.odtsAnterior, estado.filtros), filtrar(odts, estado.filtros));
    // Entre dos cortes de la versión 2, se compara lo filtrado en cada uno: una ODT que cambió de persona queda en uno solo.
    if (estado.filtros.azt || estado.filtros.jefe) zonaComparar.appendChild(h('p', { class: 'odt-mini odt-ind-comparar-persona', text: NOTA_COMPARAR_PERSONA }));
    const fila = (titulo, a, b, d) => h('tr', {}, h('th', { scope: 'row', text: titulo }),
      h('td', { class: 'odt-ind-n', text: a }), h('td', { class: 'odt-ind-n', text: b }),
      h('td', { class: 'odt-ind-n odt-ind-delta', text: d }));
    zonaComparar.appendChild(h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla' },
      h('caption', { class: 'odt-ind-caption', text: 'Por estado' }),
      h('thead', {}, h('tr', {}, ['Indicador', 'Antes', 'Ahora', 'Diferencia'].map((t, i) => h('th', { scope: 'col', class: i ? 'odt-ind-n' : null, text: t })))),
      h('tbody', {},
        c.totales.filter((x) => x.clave !== 'otro' || x.antes || x.ahora).map((x) => fila(ETIQUETA_CLAVE[x.clave], num(x.antes), num(x.ahora), textoDelta(x.delta))),
        fila('% de cierre', textoCierre(c.cuentas.antes), textoCierre(c.cuentas.ahora), deltaCierre(c.cuentas.antes, c.cuentas.ahora))))));
    const ks = ['total', 'generada', 'ejecutada', 'cerrada'];
    zonaComparar.appendChild(h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-fichas odt-ind-tabla-comparar' },
      h('caption', { class: 'odt-ind-caption', text: 'Por contratista (antes → ahora, y la diferencia)' }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', class: 'odt-ind-col1', text: 'Contratista' }),
        ks.map((k) => h('th', { scope: 'col', class: 'odt-ind-n', text: ETIQUETA_CLAVE[k] })), h('th', { scope: 'col', class: 'odt-ind-n', text: '% de cierre' }))),
      h('tbody', {}, c.porEmpresa.map((x) => h('tr', {},
        h('th', { scope: 'row', text: x.clave }),
        ks.map((k) => h('td', { class: 'odt-ind-n', 'data-etq': ETIQUETA_CLAVE[k], text: num(x.antes[k]) + ' → ' + num(x.ahora[k]) + ' (' + textoDelta(x.delta[k]) + ')' })),
        h('td', { class: 'odt-ind-n', 'data-etq': '% de cierre', text: textoCierre(x.antes) + ' → ' + textoCierre(x.ahora) + ' (' + deltaCierre(x.antes, x.ahora) + ')' })))))));
    // Las listas van plegadas, con su conteo a la vista: así la página no se alarga y el historial queda a mano.
    const listaOdt = (titulo, xs, columnas) => {
      const cuerpo = !xs.length ? h('p', { class: 'odt-mini', text: 'Ninguna.' }) : h('div', {},
        h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla' },
          h('caption', { class: 'odt-oculto', text: titulo }),
          h('thead', {}, h('tr', {}, columnas.map(([t]) => h('th', { scope: 'col', text: t })))),
          h('tbody', {}, xs.slice(0, TOPE_LISTA).map((o) => h('tr', {}, columnas.map(([, f], i) => (i === 0 ? h('th', { scope: 'row', class: 'odt-mono', text: f(o) }) : h('td', { text: f(o) })))))))),
        xs.length > TOPE_LISTA ? h('p', { class: 'odt-mini', text: 'Se muestran las primeras ' + TOPE_LISTA + '.' }) : null);
      zonaComparar.appendChild(h('details', { class: 'odt-detalles odt-ind-plegable' }, h('summary', { text: titulo + ' (' + num(xs.length) + ')' }), cuerpo));
    };
    listaOdt('ODT que cambiaron de estado', c.cambios, [['N.º', (o) => o.nro], ['Contratista', (o) => o.empresa || '—'], ['Subestación', (o) => o.subestacion || '—'], ['Antes', (o) => o.de || '(sin estado)'], ['Ahora', (o) => o.a || '(sin estado)']]);
    listaOdt('ODT nuevas en este corte', c.nuevas, [['N.º', (o) => o.nro], ['Contratista', (o) => o.empresa || '—'], ['Subestación', (o) => o.subestacion || '—'], ['Fecha prevista', (o) => fechaDMA(o.prevista)], ['Estado', (o) => o.estado || '(sin estado)']]);
    if (c.salieron.length) listaOdt('ODT que estaban en el corte anterior y ya no aparecen', c.salieron, [['N.º', (o) => o.nro], ['Contratista', (o) => o.empresa || '—'], ['Estado antes', (o) => o.estado || '(sin estado)']]);
  }
  async function buscarAnterior() {
    let r = null;
    if (repoCortes && typeof repoCortes.anterior === 'function') {
      try { r = await repoCortes.anterior(corte); } catch (_) { r = null; }   // sin red o sin índice: lo que diga el historial
    }
    if (!r) {
      const a = corteAnterior(estado.historial, corte);
      r = { anterior: a, tope: !a && estado.historialTope };
    }
    estado.anterior = r.anterior || null; estado.anteriorTope = !!r.tope; estado.anteriorBuscando = false;
    if (estado.anterior && repoCortes && typeof repoCortes.leer === 'function') {
      estado.anteriorCargando = true;
      if (sigueEn(zonaComparar, contenedor)) pintarComparacion();
      try { estado.odtsAnterior = (await repoCortes.leer(estado.anterior.id)).odts || []; } catch (e) { estado.anteriorError = mensajeDe(e); }
      estado.anteriorCargando = false;
    }
    if (sigueEn(zonaComparar, contenedor)) pintarComparacion();
  }

  // ── Qué es cada indicador (justo debajo de las tarjetas; no cambia con los filtros) ──
  function definiciones() {
    return h('details', { class: 'odt-detalles odt-ind-definiciones-caja', open: '' },
      h('summary', { text: 'Qué es cada indicador' }),
      h('dl', { class: 'odt-ind-definiciones' },
        INDICADORES.flatMap((i) => [h('dt', { text: i.titulo }), h('dd', { text: i.definicion })]),
        h('dt', { text: 'Otro estado' }), h('dd', { text: DEFINICION_OTRO })),
      h('p', { class: 'odt-mini', text: 'Fuente: el «Informe Seguimiento de Órdenes de Trabajo» de Afinia (fechas previstas desde el 01/01/2026), solo las ODT donde la persona del corte es RESPONSABLE O.D.T. Cada N.º de ODT cuenta una vez: con el estado de su primera fila y su fecha prevista más temprana. Las generadas por mes usan la fecha prevista de inicio; las cerradas por mes, la FECHA ODT CERRADA.' }));
  }

  // ── Historial (de 50 en 50) ──
  // En un celular va como fichas (una por corte, cada dato con su nombre, de data-etq): nada se sale de lado.
  const COLS_HISTORIAL = ['Datos del', 'Guardado el', 'Archivo', 'Responsable', 'ODT', 'Cerradas', '% de cierre', 'Abrir'];
  function pintarHistorial() {
    vaciar(zonaHistorial);
    zonaHistorial.appendChild(h('h3', { class: 'odt-subtitulo odt-ind-historial-titulo', tabindex: '-1', text: 'Historial de cortes' }));
    const hs = estado.historial;
    if (!hs.length) { zonaHistorial.appendChild(h('p', { class: 'odt-vacio', text: 'Aún no hay cortes guardados.' })); return; }
    const [cDatos, cGuardado, cArchivo, cResp, cOdt, cCerr, cPct, cAbrir] = COLS_HISTORIAL;
    zonaHistorial.appendChild(h('div', { class: 'odt-tabla-caja' }, h('table', { class: 'odt-tabla odt-ind-tabla odt-ind-fichas odt-ind-tabla-historial' },
      h('caption', { class: 'odt-ind-caption', text: 'Cada corte guardado, el último guardado primero. Ninguno se modifica ni se borra.' }),
      h('thead', {}, h('tr', {}, COLS_HISTORIAL.map((t, i) => h('th', { scope: 'col', class: i >= 4 && i <= 6 ? 'odt-ind-n' : null, text: t })))),
      h('tbody', {}, hs.map((x) => h('tr', { class: x.id === corte.id ? 'odt-ind-actual' : null },
        h('th', { scope: 'row', 'data-etq': cDatos, text: textoFechaDatos(x) }),
        h('td', { class: 'odt-ind-guardado', 'data-etq': cGuardado, text: fechaHora(x.creadoEnMs) }),
        h('td', { class: 'odt-romper odt-ind-archivo', 'data-etq': cArchivo, text: (x.archivo && x.archivo.nombre) || '—' }),
        h('td', { class: 'odt-ind-resp', 'data-etq': cResp, text: x.responsable || '—' }),
        h('td', { class: 'odt-ind-n', 'data-etq': cOdt, text: num(x.odts) }),
        h('td', { class: 'odt-ind-n', 'data-etq': cCerr, text: num(x.totales && x.totales.cerrada) }),
        h('td', { class: 'odt-ind-n', 'data-etq': cPct, text: textoCierre(x.totales) }),
        h('td', { 'data-etq': cAbrir }, x.id === corte.id ? h('strong', { text: 'Este corte' }) : h('a', { class: 'odt-enlace', href: '#indicadores=' + x.id, text: 'Ver' }))))))));
    if (estado.historialError) zonaHistorial.appendChild(aviso('No se pudieron leer más cortes: ' + estado.historialError, 'aviso'));
    if (estado.historialTope) {
      zonaHistorial.appendChild(h('p', { class: 'odt-mini', text: 'Se muestran los ' + num(hs.length) + ' cortes guardados más recientes; hay más.' }));
      if (typeof masHistorial === 'function') {
        // Mientras lee, el botón NO se repinta ni se deshabilita (así no pierde el foco): cambia su texto y avisa
        // que está ocupado; al terminar, el foco pasa al primer corte nuevo (o vuelve al botón, o al título).
        zonaHistorial.appendChild(h('div', { class: 'odt-acciones' }, h('button', {
          type: 'button', class: 'odt-btn odt-ind-mas-historial', text: 'Ver cortes más antiguos',
          onclick: async (e) => {
            if (estado.historialCargando) return;
            const btn = e && e.currentTarget;
            const ultimo = hs[hs.length - 1];
            const antes = estado.historial.length;
            estado.historialCargando = true; estado.historialError = '';
            if (btn) { btn.textContent = 'Leyendo…'; btn.setAttribute('aria-disabled', 'true'); }
            try {
              const r = await masHistorial(ultimo);
              const ya = new Set(estado.historial.map((x) => x.id));
              estado.historial.push(...((r && r.cortes) || []).filter((x) => !ya.has(x.id)));
              estado.historialTope = !!(r && r.tope);
            } catch (err) { estado.historialError = mensajeDe(err); }
            estado.historialCargando = false;
            if (!sigueEn(zonaHistorial, contenedor)) return;
            pintarHistorial();
            enfocar(primerEnlaceDesde(antes) || zonaHistorial.querySelectorAll('.odt-ind-mas-historial')[0] || zonaHistorial.querySelectorAll('.odt-ind-historial-titulo')[0]);
          }
        })));
      }
    }
  }
  /** El enlace «Ver» del primer corte desde la fila `desde` del historial (los que acaban de llegar), o null. */
  function primerEnlaceDesde(desde) {
    const enlaces = zonaHistorial.querySelectorAll('.odt-enlace');
    const actualAntes = estado.historial.slice(0, desde).some((x) => x.id === corte.id) ? 1 : 0;
    return enlaces[desde - actualAntes] || null;
  }

  // ── Pintar lo que depende de los filtros ──
  function pintar() {
    const lista = filtrar(odts, estado.filtros);
    const ag = agregar(lista);
    const activos = FILTROS.map(([k, nombre]) => [nombre, estado.filtros[k]]).filter(([, v]) => v);
    // El número junto a cada AZT o jefe es de todo el corte: se aclara si hay un filtro por persona junto con otro
    // (ahí ese número y el de las tarjetas ya no coinciden) o si ninguna ODT cumple los filtros.
    const conPersona = !!(estado.filtros.azt || estado.filtros.jefe);
    resumenFiltro.textContent = activos.length
      ? 'Con filtros (' + activos.map(([k, v]) => k + ': ' + v).join(' · ') + '): ' + num(lista.length) + ' de ' + num(odts.length) + ' ODT.'
        + (lista.length ? '' : ' ' + NOTA_SIN_RESULTADOS)
        + (conPersona && (!lista.length || activos.length > 1) ? ' ' + NOTA_CONTEO_PERSONA : '')
      : 'Sin filtros: las ' + num(odts.length) + ' ODT del corte.';
    vaciar(zonaTarjetas);
    zonaTarjetas.appendChild(tarjetas(ag.totales));
    vaciar(zonaDatos);
    zonaDatos.append(
      h('h3', { class: 'odt-subtitulo odt-ind-h3-datos', tabindex: '-1', text: 'Por contratista' }),
      tablaContratistas(ag),
      // append() del navegador pinta un null como la palabra «null»: sin ODT va una frase, nunca un null.
      ag.porEmpresa.length ? graficoPorContratista(ordenarFilas(ag.porEmpresa, 'total', 'desc'), { alElegir: (sel) => elegir(sel, null) }) : h('p', { class: 'odt-vacio', text: SIN_GRAFICO_CONTRATISTA }),
      h('h3', { class: 'odt-subtitulo', text: 'Evolución mensual' }),
      ag.porMes.length ? graficoMensual(ag.porMes) : h('p', { class: 'odt-vacio', text: 'Sin fechas para la evolución mensual.' }),
      h('h3', { class: 'odt-subtitulo', text: 'Por tipo de trabajo y por zona' }),
      h('div', { class: 'odt-ind-dos' }, tablaGrupo('Por tipo de trabajo', 'tipo', ag.porTipo, ag.totales), tablaGrupo('Por zona', 'zona', ag.porZona, ag.totales)));
    pintarLista();
    pintarComparacion();
  }
  pintar();
  pintarHistorial();
  const listo = buscarAnterior();
  return { estado, elegir, pintar, anterior: listo.then(() => estado.anterior) };
}
