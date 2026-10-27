// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · DETALLE de un transformador · `99 §122`
// ──────────────────────────────────────────────────────────────
// Rango de fecha y hora (hora de Colombia) → se leen SOLO los meses del rango que existen para
// el punto (por id) → por nivel: series continuas con huecos, resumen físico, cargabilidad del
// devanado y de equipo con la MISMA función de la lista (calcularEquipo) → indicadores, curvas,
// calidad del dato y CSV. Ninguna cifra sale de otra fuente. Archivo NUEVO (L-102).
// Las horas se muestran COMO LAS ROTULA EL SCADA (la de las 14:00 es el promedio de 13:00 a
// 14:00): «Desde» es la primera hora y «Hasta» la última, incluida. Un mes es la misma ventana
// que resume la lista (ventanaDeMes), así la cifra del mes coincide (revisión adversarial).
// ══════════════════════════════════════════════════════════════

import { el, poner, num, descargarCSV, conservarFoco } from './dom.js';
import { chipCifra, textoBandas } from './lista.js';
import { devanadosDe, TEXTO_AVISO_DEVANADO, kvTexto, ampTexto, mvaTexto, pctTexto } from '../../domain/scada_carga_devanados.js';
import { limitesDePlaca } from '../../domain/placa_etapas.js';
import { leerPlaca } from '../../data/placas_caracteristicas.js';
import { filasDevanadosPlaca } from '../../domain/scada_devanados_placa.js';
import { nivelesExcluidos, notaCorta } from '../../domain/scada_niveles_excluidos.js';
import { dibujarFigura, liberarFigura } from './graficos.js';
import { FAMILIAS, NIVELES, DEVANADO, CALCULO, MOTIVO, CODIGO, UNIDAD, NOMBRE_FAMILIA, TIEMPO } from '../../domain/scada_carga_config.js';
import { EXTRAS, NOMBRE_EXTRA, EXTRA_TOPE_X, extrasVisibles } from '../../domain/scada_carga_extras.js';
import { claveId } from '../../domain/scada_carga_csv.js';
import {
  analizarClaveHomologada, claveEfectiva, conteosHomologacion, normalizarMatricula, placaDe, AVISOS
} from '../../domain/scada_carga_homologacion.js';
import { filaDeTransformador, indicePorMatricula, calcularEquipo, mesPorDefecto } from '../../domain/scada_carga_vista.js';
import { mesesDelRango, recortarRango, ventanaDeMes, msInicio, horasMes } from '../../domain/scada_carga_series.js';
import { validos } from '../../domain/scada_carga_limpieza.js';
import { resumenFisico, iFaseMax, serieCargabilidad, serieS, factorPotencia, desbalanceI, desequilibrioU, horasSostenidasSobre, estadisticas, maxSostenido } from '../../domain/scada_carga_kpis.js';
import { resumirParaGuardar } from '../../domain/scada_carga_importacion.js';
// Por espacio de nombres (no por nombre): con un kpis.js viejo en caché el detalle sigue funcionando (L-102, `99 §158`).
import * as KPIS from '../../domain/scada_carga_kpis.js';
import {
  parseFechaHoraCO, aInputCO, formatoCO, intervaloCO, nombreMes, validarRango, xPlotly
} from '../../domain/scada_carga_fecha.js';
// Suma de circuitos (2026-10-24): archivos NUEVOS. Sin suma en la decisión, `leerSeriesEquipo` lee lo mismo que
// `leerSeriesPunto` y el detalle sale idéntico.
import { leerSeriesEquipo } from '../../data/scada_carga_suma.js';
// Firmeza de varios meses por el devanado que da la cifra (2026-10-27): archivo NUEVO; sin él la firmeza es la del rango.
import { firmezaDeMeses } from '../../domain/scada_carga_firmeza_periodo.js';
// Cambio de medida desde un mes (2026-10-26): archivo NUEVO; el detalle muestra UNA configuración (la del mes pedido).
import { segmentoDelMes, segmentos as segmentosDeFila, puntoDelSegmento, textoVentana, motivoSinCarga, filasDelMes } from '../../domain/scada_carga_cambio_medida.js';
import { SUMA, especSuma, derivadoDeMeses, textoCuadre } from '../../domain/scada_carga_suma.js';
import { BASELINE_UMBRALES_SALUD } from '../../domain/umbrales_salud_baseline.js';

const H_MS = 3600e3;
const OFF = TIEMPO.offsetColombiaH * H_MS;
const ESTADOS = { automatica: 'Homologación sin observaciones', confirmada: 'Medida confirmada por el Ingeniero', pendiente: 'Medida por confirmar', excluida: 'Medida excluida', sin_homologacion: 'Sin homologación' };
const MOTIVO_LECTURA = { 20: 'mes que no se pudo leer', 21: 'sin datos cargados' };
const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const FASE_CORTA = { IR: 'R', IS: 'S', IT: 'T' };

/**
 * «13,8 kV = suma de circuitos A + B (dato derivado; la medida propia del transformador se conserva y no se usa: su fase S
 * lee 2,02 ×)». Los nombres salen de la decisión guardada; la razón, del cuadre de los meses del rango (si ya se leyó).
 */
function textoSumaDetalle(a) {
  const spec = especSuma(a.fila);
  if (!spec || spec.cid !== a.cid) return null;
  return Object.entries(spec.porNivel).map(([nv, sp]) => {
    const der = a.sumaRango && a.sumaRango[nv];
    const rz = (der && der.razones) || {};
    const distintas = ['IR', 'IS', 'IT'].filter((F) => rz[F] && (Math.abs(rz[F].min - 1) > SUMA.tolCuadre || Math.abs(rz[F].max - 1) > SUMA.tolCuadre))
      // Se comparan los textos ya redondeados: dos razones que se leen iguales van una sola vez (nunca «2,02–2,02»).
      .map((F) => 'fase ' + FASE_CORTA[F] + ' lee ' + (num(rz[F].min, 2) === num(rz[F].max, 2) ? num(rz[F].min, 2) : num(rz[F].min, 2) + '–' + num(rz[F].max, 2)) + ' ×');
    return NIVELES[nv].etiqueta + ' = suma de circuitos ' + sp.elems.join(' + ') + ' (dato derivado; la medida propia del transformador se conserva y no se usa'
      + (distintas.length ? ': su ' + distintas.join(', su ') : '') + ')';
  }).join(' · ');
}

// Filtro de la vista (`99 §126`): qué valores de cada hora y qué fases se dibujan. Se recuerda en este
// navegador (comodidad de quien mira; si no se puede leer o guardar, vale el de fábrica).
const FILTRO_CLAVE = 'cscada-filtro-v1';
const FILTRO_FABRICA = { ver: { prom: true, max: false, min: false, ins: false }, fases: { R: true, S: true, T: true } };
function leerFiltro() {
  try {
    const g = JSON.parse(localStorage.getItem(FILTRO_CLAVE) || 'null');
    if (g && g.ver && g.fases) return { ver: { ...FILTRO_FABRICA.ver, ...g.ver }, fases: { ...FILTRO_FABRICA.fases, ...g.fases } };
  } catch (_) { /* vale el de fábrica */ }
  return { ver: { ...FILTRO_FABRICA.ver }, fases: { ...FILTRO_FABRICA.fases } };
}
function guardarFiltro(f) { try { localStorage.setItem(FILTRO_CLAVE, JSON.stringify(f)); } catch (_) { /* nada */ } }
const ETIQUETA_VER = { prom: 'Promedio de la hora', max: NOMBRE_EXTRA.max, min: NOMBRE_EXTRA.min, ins: NOMBRE_EXTRA.ins };

function bandasCRG(umbrales) {
  const c = { ...BASELINE_UMBRALES_SALUD.crg, ...((umbrales && umbrales.crg) || {}) };
  return [c.c2_min_excl, c.c3_min_excl, c.c4_min_excl, c.c5_min_excl];
}

/** Calcula todo lo de un nivel en el rango. */
function calcularNivel(rec, kv, A) {
  const fam = rec.fam;
  const val = {};
  for (const f of FAMILIAS) val[f] = validos(fam[f]);
  const iF = iFaseMax(fam).serie;
  const fisico = resumenFisico(fam, kv);
  // `arch`: horas con algún dato de corriente (el motivo «no vino en el exporte» del rango, `99 §158`).
  const resumen = { ...resumirParaGuardar(fisico, fam), arch: typeof KPIS.horasConCorriente === 'function' ? KPIS.horasConCorriente(fam) : undefined };
  const S = serieS(fam);
  const sRef = fisico.s.max;
  const fp = factorPotencia(fam, sRef);
  const carga = A > 0 ? serieCargabilidad(iF, A) : null;
  const sobre = carga ? horasSostenidasSobre(carga.serie, CALCULO.sobrecargaPct, CALCULO.sobrecargaMinH) : null;
  const desb = estadisticas(desbalanceI(fam, A));
  const deseq = estadisticas(desequilibrioU(fam));
  const ext = extrasVisibles(fam, kv, A);   // máx/mín/instantáneo para VER (no entran en la cifra)
  return { t: rec.t, fam, val, iF, fisico, resumen, S, fp, carga, sobre, desb, deseq, ext, mesesFallidos: rec.mesesFallidos };
}

/** Las horas de UN mes dentro de un rango ya recortado (mismo índice que `recortarRango`); null si el mes no cae en él. */
function recortarMes(rec, mes, desdeMs) {
  const horas = rec.t.length;
  const k0 = Math.max(0, Math.round((msInicio(mes, 0) - desdeMs) / H_MS));
  const k1 = Math.min(horas, Math.round((msInicio(mes, 0) - desdeMs) / H_MS) + horasMes(mes));
  if (k1 <= k0) return null;
  const fam = {};
  for (const [f, x] of Object.entries(rec.fam)) {
    fam[f] = {};
    for (const [k, arr] of Object.entries(x)) fam[f][k] = arr && typeof arr.subarray === 'function' ? arr.subarray(k0, k1) : arr;
  }
  return fam;
}

/**
 * Rango de VARIOS meses: por devanado, su cobertura en los meses en que midió y cuántos midió (la misma regla que la lista
 * por periodo, `firmeza`). Un solo mes cargado en el rango → null (la firmeza de siempre).
 */
function firmezaDelRango(recs, niveles, mesesCargados, desdeMs) {
  if (!mesesCargados || mesesCargados.length < 2) return null;
  const out = {};
  for (const [nv, rec] of Object.entries(recs)) {
    const i = (niveles || []).find((x) => x.nivel === nv);
    if (!i || !i.devanado || !rec) continue;
    const lista = mesesCargados.map((mes) => {
      const fam = recortarMes(rec, mes, desdeMs);
      if (!fam) return null;
      const r = resumirParaGuardar(resumenFisico(fam, NIVELES[nv].kv), fam);
      return { n: r && r.i ? r.i.n : 0, cob: r ? r.cob : null };
    });
    out[i.devanado] = { ...firmezaDeMeses(lista), mesesTotal: mesesCargados.length };
  }
  return out;
}

export function montarDetalle(cont, ctx, { alVolver }) {
  let token = 0;
  let figura = null;
  let actual = null;        // {mat, id, tx, fila, punto, cid, placa, desde, hasta, porNivel, calc, nivel}
  const filtro = leerFiltro();
  // Panel «Gases disueltos (DGA) y carga» (`99 §127`): se carga APARTE con import(); si falla, la ranura sigue
  // oculta y el detalle queda igual que antes. Si llega tarde, pinta el último estado del equipo abierto.
  let panelDga = null;
  import('./panel-dga.js').then((m) => { panelDga = m; if (actual && actual.dga) pintarDga(actual, actual.dga); })
    .catch((e) => console.warn('[cargabilidad-scada] panel DGA', e));
  // «Triángulo de Duval: hoy y con más carga» (`99 §131`): otra ranura y otro import() aislado, con el MISMO estado.
  let panelDuval = null;
  import('./panel-duval.js').then((m) => { panelDuval = m; if (actual && actual.dga) pintarDga(actual, actual.dga); })
    .catch((e) => console.warn('[cargabilidad-scada] triángulo de Duval', e));
  // «Placa característica» (TODO-69): otra ranura con su import() aislado; si falla, queda oculta y el detalle sigue igual.
  let panelPlaca = null;
  import('./panel-placa.js').then((m) => { panelPlaca = m; if (actual) pintarPlacaDe(actual); })
    .catch((e) => { console.warn('[cargabilidad-scada] placa', e); if (actual) placaParaTabla(actual); });
  /** Respaldo: si el panel de placa no le entregó la placa a la tabla (versión anterior en caché, L-102, o falló), se lee aquí. */
  function placaParaTabla(a) {
    if (!a || a.placaLeida || a.leyendoPlacaTabla) return;
    a.leyendoPlacaTabla = true;
    leerPlaca(a.tx && a.tx.id).then((r) => {
      a.leyendoPlacaTabla = false;
      if (actual !== a || a.placaLeida || !r || r.error) return;
      a.limitesPlaca = r.hay ? limitesDePlaca(r.placa, a.tx) : null; a.placaLeida = true; refrescarDevanados(a);
    }).catch(() => { a.leyendoPlacaTabla = false; });
  }
  function pintarPlacaDe(a) {
    if (!a || !a.placaNodo || !panelPlaca || a.placaLista) return;
    a.placaLista = true;
    const nodo = a.placaNodo;
    panelPlaca.pintarPlaca(nodo, { tx: a.tx, titulo: a.mat, vigente: () => !!actual && actual.placaNodo === nodo,
      // La placa leída llena la tabla «Devanados de placa» (tensión, potencia y corriente de la PLACA).
      alLeer: (placa) => { if (!actual || actual.placaNodo !== nodo) return; actual.limitesPlaca = placa ? limitesDePlaca(placa, actual.tx) : null; actual.placaLeida = true; refrescarDevanados(actual); } })
      // Con error, se vuelve a intentar al reabrir el equipo (L-109).
      .then((r) => { if (r && r.error && actual && actual.placaNodo === nodo) actual.placaLista = false; if (actual && actual.placaNodo === nodo) placaParaTabla(actual); })
      .catch((e) => { console.warn('[cargabilidad-scada] placa', e); nodo.hidden = true; if (actual && actual.placaNodo === nodo) { actual.placaLista = false; placaParaTabla(actual); } });
  }
  /** Estado EXPLÍCITO del panel: 'leyendo' | 'ok' (con el cálculo recién hecho) | 'error' | 'sin_scada'. */
  function pintarDga(a, estado) {
    if (!a || !a.dgaNodo) return;
    a.dga = estado;
    const rango = a.desde != null && a.hasta != null ? formatoCO(a.desde + H_MS) + ' a ' + formatoCO(a.hasta) : null;
    if (panelDga) {
      try { panelDga.pintarPanelDga(a.dgaNodo, { tx: a.tx, umbrales: ctx.umbrales, rango, ...estado }); }
      catch (e) { console.warn('[cargabilidad-scada] panel DGA', e); a.dgaNodo.hidden = true; }
    }
    if (panelDuval && a.duvalNodo) {
      try { panelDuval.pintarPanelDuval(a.duvalNodo, { tx: a.tx, umbrales: ctx.umbrales, rango, ...estado }); }
      catch (e) { console.warn('[cargabilidad-scada] triángulo de Duval', e); a.duvalNodo.hidden = true; }
    }
  }
  /** Lo que de verdad se dibuja: un extra que el rango no tiene no cuenta; si no queda nada, el promedio. */
  function verEfectivo(d) {
    const hay = (d && d.ext && d.ext.hay) || {};
    const v = { prom: !!filtro.ver.prom };
    for (const k of EXTRAS) v[k] = !!filtro.ver[k] && !!hay[k];
    if (!Object.values(v).some(Boolean)) v.prom = true;
    return v;
  }

  /** Al salir del detalle: nada de lo que siga cargando o dibujando puede volver a pintar aquí. */
  function cerrar() {
    token++; liberarFigura(figura); figura = null;
    // La gráfica de «mes a mes» también se libera (Plotly deja un oyente de tamaño por gráfica); al reabrir se rehace.
    if (actual && actual.mensualNodo) { liberarFigura(actual.mensualNodo); actual.mensualLista = false; }
    poner(cont);
  }

  function buscarTx(mat, id) {
    if (id) { const t = ctx.parque.find((tx) => tx.id === id); if (t) return t; }
    const m = normalizarMatricula(mat);
    if (!m) return null;
    return ctx.parque.find((tx) => normalizarMatricula(leer(tx, 'identificacion.matricula') || leer(tx, 'identificacion.codigo') || tx.codigo) === m) || null;
  }

  /** Límites del rango (en inicio de intervalo) según los meses cargados del punto. */
  function limites(a) {
    const meses = [...(a.punto.meses || [])].sort();
    return { meses, min: ventanaDeMes(meses[0]).desde, max: ventanaDeMes(meses[meses.length - 1]).hasta };
  }

  /** Valida un rango [desde, hasta) en inicio de intervalo: horas en punto + validarRango. */
  function validar(desde, hasta, lim) {
    const errores = [];
    if (desde != null && desde % H_MS) errores.push({ campo: 'desde', texto: 'Use horas en punto (minutos en 00).' });
    if (hasta != null && hasta % H_MS) errores.push({ campo: 'hasta', texto: 'Use horas en punto (minutos en 00).' });
    if (errores.length) return { ok: false, errores };
    return validarRango({ desde, hasta, min: lim.min, max: lim.max });
  }

  /** Última hora con datos del punto: el último día marcado en el catálogo del último mes. */
  function ultimaHoraConDatos(a, lim) {
    const mes = lim.meses[lim.meses.length - 1];
    const dias = ctx.catalogo && ctx.catalogo.meses && ctx.catalogo.meses[mes] ? ctx.catalogo.meses[mes].dias : null;
    const d = dias ? dias.lastIndexOf('1') + 1 : 0;
    if (!d) return lim.max;
    const [an, m] = mes.split('-').map(Number);
    return Math.min(lim.max, Date.UTC(an, m - 1, d, 23) + OFF);   // rótulo 23:00 del último día con datos
  }

  function hashDe(a, desde, hasta) {
    return '#mat=' + encodeURIComponent(a.mat) + (a.tx && a.tx.id ? '&id=' + encodeURIComponent(a.tx.id) : '')
      + '&desde=' + aInputCO(desde + H_MS) + '&hasta=' + aInputCO(hasta);
  }

  function encabezado(a) {
    const tx = a.tx;
    // El estado de la homologación no depende del rango: mientras se lee, el del mapa sin resúmenes.
    const hom = a.calc || a.previo || null;
    return el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-volver' }, el('button', { type: 'button', id: 'csVolver', class: 'btn btn--ghost btn--sm', onclick: alVolver }, '← Volver a la lista')),
      el('div', { class: 'cs-cab' },
        el('h2', { tabindex: '-1', id: 'csDetTitulo' }, a.mat),
        el('span', { class: 'cs-dato' }, el('b', {}, 'Subestación: '), leer(tx, 'ubicacion.subestacion_nombre') || (a.fila && a.fila.subestacion) || '—'),
        el('span', { class: 'cs-dato' }, el('b', {}, 'Zona: '), leer(tx, 'ubicacion.zona') || '—'),
        el('span', { class: 'cs-dato' }, el('b', {}, 'Potencia: '), leer(tx, 'placa.potencia_kva') ? num(Number(leer(tx, 'placa.potencia_kva')) / 1000, 1) + ' MVA' : '—')),
      tablaDevanados(a),
      el('p', { class: 'cs-dato', style: 'margin:4px 0 0' }, el('b', {}, 'Punto SCADA: '), a.fila ? (claveEfectiva(a.fila) || 'sin punto') : 'sin homologación',
        a.fila && textoSumaDetalle(a) ? ' · ' + textoSumaDetalle(a) : '',
        hom ? ' · ' + (a.segmento && a.segmento.tipo === 'sin_carga' ? 'Sin carga (según el Ingeniero)' : (ESTADOS[hom.estado] || hom.estado)) : '',
        // La nota de la decisión del Ingeniero (por qué se confirmó o excluyó) se lee en el equipo, no solo en la administración.
        hom && (hom.estado === 'confirmada' || hom.estado === 'excluida') && a.fila && a.fila.decision && a.fila.decision.nota
          ? el('span', { class: 'cs-sub' }, ' — ' + a.fila.decision.nota) : null),
      hom && hom.estado === 'pendiente' && hom.avisos.length ? el('ul', { class: 'cs-avisos' },
        hom.avisos.filter((k) => AVISOS[k]).map((k) => el('li', {}, AVISOS[k].texto))) : null,
      avisoCambioMedida(a));
  }

  /** Conteos de la homologación como rigen en la configuración que se ve (sin cambios de medida: los de siempre). */
  function conteosDe(a) {
    const filasH = (ctx.homologacion && ctx.homologacion.filas) || {};
    return conteosHomologacion(a && a.segmento ? filasDelMes(filasH, a.segmento.hasta || a.segmento.desde) : filasH);
  }

  /** Equipo con cambio de medida: qué configuración se ve y un enlace a cada una de las otras (nunca se mezclan). */
  function avisoCambioMedida(a) {
    if (!a.segmentos || !a.segmento) return null;
    const nombre = (s) => (s.tipo === 'sin_carga' ? 'el tramo sin carga' : (s.tipo === 'vigente' ? 'la medida de hoy' : 'la medida anterior')) + ' (' + textoVentana(s) + ')';
    // Sin entrada nueva en el historial: «← Volver a la lista» sigue volviendo a la lista (location.replace sí avisa el cambio).
    const ir = (s) => location.replace('#mat=' + encodeURIComponent(a.mat) + (a.tx && a.tx.id ? '&id=' + encodeURIComponent(a.tx.id) : '') + (s.tipo === 'vigente' ? '' : '&mes=' + s.hasta));
    const otros = a.segmentos.filter((s) => s !== a.segmentoBase);
    return el('p', { class: 'cs-dato cs-cambio-medida', style: 'margin:6px 0 0' }, el('b', {}, 'Cambio de medida: '),
      'se muestra ' + nombre(a.segmento) + (a.segmento.nota && a.segmento.tipo !== 'sin_carga' ? ': ' + a.segmento.nota.replace(/[.\s]+$/, '') : '') + '. Las cifras de una configuración no se mezclan con las de otra. ',
      otros.map((s, i) => el('button', { type: 'button', id: 'csCambioMedida-' + i, class: 'btn btn--glass btn--sm', style: 'margin:2px 6px 0 0', onclick: () => ir(s) }, 'Ver ' + nombre(s))));
  }

  /** La tabla de devanados se rehace cuando llega la placa leída (sin repintar el resto del detalle). */
  function refrescarDevanados(a) {
    const caja = document.getElementById('csDevanadosCaja');
    if (caja && actual === a) caja.replaceWith(tablaDevanados(a));
  }

  /**
   * «Devanados de placa»: por devanado, tensión, potencia y corriente nominal de la PLACA leída (la impresa; si la placa no la
   * graba, la calculada con su potencia y su tensión) y lo que el SCADA mide de cada uno en el rango. Sin placa leída, los
   * valores de la plataforma, rotulados (2026-10-23: «si tomamos los valores de placa, ¿por qué calculas potencia?»).
   */
  function tablaDevanados(a) {
    // Mientras se lee el rango: el mapa nivel → devanado (sin resúmenes) y «…» en las cargas; nunca cifras de otro rango.
    const calc = a.calc || a.previo || null;
    const ds = devanadosDe(a.tx, a.calc || null).map((d) => (a.calc ? d : { ...d, niveles: devanadosDe(a.tx, calc).find((y) => y.d === d.d).niveles }));
    if (!ds.length) return el('p', { class: 'cs-dato', id: 'csDevanadosCaja', style: 'margin:6px 0 0' }, el('b', {}, 'Devanados: '), 'la placa del parque no trae tensiones ni ampacidades');
    const mono = Number(leer(a.tx, 'electrico.fases')) === 1;
    const circuito = !!(calc && calc.esCircuito && calc.estado !== 'confirmada');
    const leyendo = !a.calc && !!a.leyendo;
    const rango = a.calc && a.desde != null && a.hasta != null ? ' · corriente y cargabilidad del rango ' + formatoCO(a.desde + H_MS) + ' a ' + formatoCO(a.hasta)
      + (a.calc.clase === 'provisional' ? ' (provisional)' : '') + (a.calc.pct == null && a.calc.motivoNulo ? ' (sin cifra: ' + a.calc.motivoNulo + ')' : '') : '';
    const vacio = (d) => (leyendo && d.niveles.length ? '…' : '—');
    const filas = filasDevanadosPlaca(ds, a.limitesPlaca || null);
    // Un nivel que el SCADA mide pero que la homologación dejó en «No usar» no es «no se mide» (pedido 2026-10-23).
    const excl = nivelesExcluidos({ tx: a.tx, fila: a.fila, punto: a.punto });
    const loMide = (f) => {
      if (f.niveles.length) return ['en ' + f.niveles.join(', ') + (circuito ? ' (un circuito, sin confirmar)' : '')];
      const ex = excl.porDevanado[f.d];
      if (!ex) return ['no se mide'];
      return [el('span', {}, 'en ' + ex.map((nv) => NIVELES[nv].etiqueta).join(', ') + ', excluida en la homologación'),
        excl.nota ? el('span', { class: 'cs-sub cs-dev-aviso' }, notaCorta(excl.nota)) : null];
    };
    const conPlaca = filas.some((f) => f.tension.origen === 'placa');
    const origenA = { impresa: 'impresa en la placa', calculada: 'calculada de la placa (la placa no la graba)', plataforma: 'de la plataforma' };
    const leyenda = conPlaca
      ? ' · tensión, potencia y corriente nominal de la placa leída (la corriente impresa; si la placa no la graba, calculada con su potencia y su tensión)'
      : (a.placaLeida ? ' · sin placa leída: valores de la plataforma; potencia = ' : ' · leyendo la placa… mientras tanto, valores de la plataforma; potencia = ')
        + (mono ? 'tensión × ampacidad (monofásico)' : '√3 × tensión × ampacidad');
    const potencia = (f, d) => {
      if (f.potencia.compensacion) return [el('span', {}, 'compensación'), el('span', { class: 'cs-sub' }, 'no lleva carga: sin límite')];
      if (!f.potencia.mva.length) return ['—'];
      const txt = f.potencia.mva.map((m) => mvaTexto(m)).join(' / ') + ' MVA';
      return [el('span', { class: 'cs-num' }, txt),
        f.potencia.origen === 'placa' ? el('span', { class: 'cs-sub' }, f.potencia.nombres.join(' / ')) : el('span', { class: 'cs-sub' }, 'calculada (sin placa)'),
        d.conexion === 'fase_neutro' && f.potencia.origen !== 'placa' ? el('span', { class: 'cs-sub' }, 'devanado entre fase y neutro (tensión ÷ √3)') : null];
    };
    const ampacidad = (f, d) => {
      if (f.potencia.compensacion) return ['—'];
      if (!f.ampacidad.A) return ['—', d.aviso ? el('span', { class: 'cs-sub cs-dev-aviso' }, TEXTO_AVISO_DEVANADO[d.aviso]) : null];
      return [ampTexto(f.ampacidad.A) + ' A', el('span', { class: 'cs-sub' }, origenA[f.ampacidad.origen] || ''),
        f.ampacidad.onan ? el('span', { class: 'cs-sub' }, 'ONAN ' + ampTexto(f.ampacidad.onan) + ' A' + (f.ampacidad.onanOrigen === 'impresa' ? ' (impresa)' : ' (calculada)')) : null,
        f.ampacidad.plataforma ? el('span', { class: 'cs-sub' + (f.ampacidad.plataformaEsOnan ? '' : ' cs-dev-aviso') },
          f.ampacidad.plataformaEsOnan ? 'la plataforma usa la ONAN (' + ampTexto(f.ampacidad.plataforma) + ' A)' : 'la plataforma tiene ' + ampTexto(f.ampacidad.plataforma) + ' A: por corregir') : null,
        f.ampacidad.origen === 'plataforma' && d.aviso ? el('span', { class: 'cs-sub cs-dev-aviso' }, TEXTO_AVISO_DEVANADO[d.aviso]) : null];
    };
    return el('div', { class: 'cs-tabla-caja', id: 'csDevanadosCaja', style: 'margin-top:10px' },
      el('table', { class: 'cs-tabla cs-tabla-dev', id: 'csDevanados' },
        el('caption', {}, el('b', {}, 'Devanados de placa'), leyenda + rango),
        el('thead', {}, el('tr', {}, ['Devanado', 'Tensión', 'Potencia', 'Corriente nominal (ampacidad)', 'Lo mide el SCADA', 'Corriente p99', 'Cargabilidad'].map((t) => el('th', { scope: 'col' }, t)))),
        el('tbody', {}, filas.map((f, k) => {
          const d = ds[k];
          return el('tr', { class: f.manda ? 'cs-dev-manda' : null },
            el('th', { scope: 'row' }, f.nombre, f.manda ? el('span', { class: 'cs-sub' }, 'da la cifra del equipo') : null),
            el('td', {}, f.tension.kv ? kvTexto(f.tension.kv) + ' kV' : '—',
              f.tension.origen === 'placa' && f.tension.kvSistema && f.tension.kv && Math.abs(f.tension.kv / f.tension.kvSistema - 1) > 0.005
                ? el('span', { class: 'cs-sub' }, 'sistema ' + kvTexto(f.tension.kvSistema) + ' kV') : null),
            el('td', {}, ...potencia(f, d)),
            el('td', {}, ...ampacidad(f, d)),
            el('td', {}, ...loMide(f)),
            el('td', {}, f.iP99 != null ? ampTexto(f.iP99) + ' A' : vacio(d)),
            el('td', {}, f.pct != null ? pctTexto(f.pct) + ' %' : vacio(d),
              f.pctOficial != null ? el('span', { class: 'cs-sub' }, 'oficial ' + pctTexto(f.pctOficial) + ' % (con la ampacidad de la plataforma)') : null));
        }))));
  }

  function selectorRango(a) {
    const lim = limites(a);
    const iD = el('input', { type: 'datetime-local', id: 'csDesde', step: 3600, value: aInputCO(a.desde + H_MS), min: aInputCO(lim.min + H_MS), max: aInputCO(lim.max) });
    const iH = el('input', { type: 'datetime-local', id: 'csHasta', step: 3600, value: aInputCO(a.hasta), min: aInputCO(lim.min + H_MS), max: aInputCO(lim.max) });
    const eD = el('span', { class: 'cs-error', id: 'csDesdeErr' }); const eH = el('span', { class: 'cs-error', id: 'csHastaErr' });
    const aplicar = (desde, hasta) => {
      eD.textContent = ''; eH.textContent = ''; iD.removeAttribute('aria-invalid'); iH.removeAttribute('aria-invalid');
      const v = validar(desde, hasta, lim);
      if (!v.ok) {
        for (const e of v.errores) {
          const [inp, err] = e.campo === 'desde' ? [iD, eD] : [iH, eH];
          err.textContent = e.texto; inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', err.id);
        }
        return;
      }
      history.replaceState(null, '', hashDe(a, desde, hasta));
      cargar(desde, hasta);
    };
    const rapidos = lim.meses.slice(-6).reverse().map((m) => el('button', { type: 'button', id: 'csRapido-' + m, class: 'btn btn--glass btn--sm', onclick: () => { const r = ventanaDeMes(m); aplicar(r.desde, r.hasta); } }, nombreMes(m)));
    const ultimos7 = el('button', { type: 'button', id: 'csUltimos7', class: 'btn btn--glass btn--sm', onclick: () => { const h = ultimaHoraConDatos(a, lim); aplicar(Math.max(lim.min, h - 7 * 24 * H_MS), h); } }, 'Últimos 7 días con datos');
    const form = el('form', { class: 'cs-panel', novalidate: true },
      el('fieldset', { class: 'cs-rango' }, el('legend', {}, 'Rango (hora de Colombia)'),
        el('label', { class: 'cs-campo', for: 'csDesde' }, 'Desde (primera hora)', iD, eD),
        el('label', { class: 'cs-campo', for: 'csHasta' }, 'Hasta (última hora, incluida)', iH, eH),
        el('button', { type: 'submit', id: 'csAplicar', class: 'btn btn--primary btn--sm' }, 'Aplicar')),
      el('div', { class: 'cs-acciones' }, ultimos7, rapidos),
      el('p', { class: 'cs-ayuda' }, 'Las horas van como las rotula el SCADA: la de las 14:00 es el promedio de 13:00 a 14:00. Un mes va de la 00:00 del día 1 a la 23:00 del último día. Hay datos de ' + lim.meses.map(nombreMes).join(', ') + '. Máximo ' + TIEMPO.maxMesesRango + ' meses por consulta.'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const dl = parseFechaHoraCO(iD.value); const hl = parseFechaHoraCO(iH.value);
      aplicar(dl == null ? null : dl - H_MS, hl);
    });
    return form;
  }

  function kpi(titulo, valor, nota, extra) {
    return el('div', { class: 'cs-kpi' }, el('div', { class: 'cs-kpi-t' }, titulo), el('div', { class: 'cs-kpi-v' }, valor), extra || null, nota ? el('div', { class: 'cs-kpi-n' }, nota) : null);
  }

  /** Nivel de referencia de los indicadores físicos: el del devanado que manda o, si no hay cifra, el de mayor tensión con datos. */
  function nivelReferencia(a) {
    const c = a.calc;
    const porDev = c.devMax ? c.niveles.find((x) => x.devanado === c.devMax) : null;
    if (porDev) return porDev;
    return [...c.niveles].sort((x, y) => NIVELES[y.nivel].kv - NIVELES[x.nivel].kv).find((x) => a.porNivel[x.nivel] && a.porNivel[x.nivel].resumen.i.n) || null;
  }

  function indicadores(a) {
    const c = a.calc;
    const ref = nivelReferencia(a);
    const d = ref ? a.porNivel[ref.nivel] : null;
    const r = d ? d.resumen : null;
    const A = ref ? ref.A : null;
    // Corriente máxima: la de la curva de cargabilidad (sin las horas de escala imposible, > 3 × ampacidad).
    let iMax = null; let iMaxMs = null; let iMaxPct = null;
    if (d && d.carga) {
      const e = estadisticas(d.carga.serie);
      if (e.iMax != null && e.iMax >= 0) { iMax = d.iF[e.iMax]; iMaxMs = d.t[e.iMax]; iMaxPct = e.max; }
    } else if (r && r.i.max != null && r.i.iMax != null && r.i.iMax >= 0) { iMax = r.i.max; iMaxMs = d.t[r.i.iMax]; }
    const deOtroNivel = ref && ref.devanado !== c.devMax ? ' (nivel ' + NIVELES[ref.nivel].etiqueta + ')' : '';
    const cobertura = c.niveles.filter((x) => x.devanado).map((x) => x.cobertura).filter((x) => x != null);
    const cob = cobertura.length ? Math.min(...cobertura) : (ref ? ref.cobertura : null);
    const sobreH = d && d.sobre ? d.sobre.horas : null;
    const kva = Number(leer(a.tx, 'placa.potencia_kva')) || null;
    const sMax = d ? d.fisico.s.max : null;
    const of = c.oficial;
    const ofDev = c.delta != null && of && of.porDevanado ? of.porDevanado[c.devMax] : null;
    const pctTxt = c.pct == null ? '—' : num(c.pct, 1);
    return el('div', { class: 'cs-panel' },
      el('h2', {}, 'Indicadores del rango'),
      el('div', { class: 'cs-principal' },
        kpi('Cargabilidad del equipo', el('span', {}, pctTxt, c.pct == null ? '' : el('small', {}, ' %')),
          c.pct == null ? c.motivoNulo : (c.clase === 'firme' ? 'p99 de la fase más cargada · ' + DEVANADO[c.devMax] : c.motivos.join(' · ')), chipCifra(c)),
        kpi('Corriente máxima' + deOtroNivel, iMax != null ? el('span', {}, num(iMax, 0), el('small', {}, ' A')) : '—',
          iMax != null ? (iMaxPct != null ? num(iMaxPct, 0) + ' % de la ampacidad · ' : '') + intervaloCO(iMaxMs)
            + (d && d.carga && d.carga.excluidas ? ' · ' + d.carga.excluidas + ' h de escala imposible excluidas' : '') : 'sin horas válidas'),
        kpi('Sobre el ' + CALCULO.sobrecargaPct + ' % sostenido', sobreH == null ? '—' : el('span', {}, String(sobreH), el('small', {}, ' h')),
          sobreH ? 'primera ' + intervaloCO(d.t[d.sobre.primera]) + ' · última ' + intervaloCO(d.t[d.sobre.ultima])
            : (sobreH === 0 ? 'ninguna ventana de ' + CALCULO.sobrecargaMinH + ' h seguidas' : (c.motivoNulo || 'sin ampacidad o sin datos'))),
        kpi('Cobertura', cob != null ? el('span', {}, num(100 * cob, 0), el('small', {}, ' %')) : '—',
          r ? r.servicio + ' h en servicio · ' + r.des + ' h fuera de servicio' : 'horas válidas sobre horas en servicio'),
        kpi('Potencia aparente máx.' + deOtroNivel, sMax != null ? el('span', {}, num(sMax, 1), el('small', {}, ' MVA')) : '—',
          sMax != null && kva ? num(100 * sMax / (kva / 1000), 0) + ' % de ' + num(kva / 1000, 1) + ' MVA de placa (S = √(P²+Q²))' : 'S = √(P² + Q²) con P y Q del SCADA'),
        kpi('Cifra oficial (Excel)', of && of.pct != null ? el('span', {}, num(of.pct, 1), el('small', {}, ' %')) : '—',
          ofDev != null ? DEVANADO[c.devMax] + ' ' + num(ofDev, 1) + ' % · diferencia ' + (c.delta > 0 ? '+' : '') + num(c.delta, 1) + ' pts frente a ese devanado' : 'Salud de Activos')));
  }
  function tablaNivel(a, nv) {
    const d = a.porNivel[nv];
    const info = a.calc.niveles.find((x) => x.nivel === nv) || {};
    const f = d.fisico;
    const kv = NIVELES[nv].kv;
    const fila = (t, v) => el('tr', {}, el('th', { scope: 'row' }, t), el('td', {}, v));
    // Máximo sostenido con la serie LIMPIA (sin las horas de más de 3 × ampacidad), la misma del indicador «Sobre el 100 %
    // sostenido» y del panel DGA (`99 §130`); antes salía del resumen en bruto y una hora imposible daba miles de amperios.
    // Sin ampacidad no hay con qué descartar: queda el del resumen.
    const sost = d.carga ? maxSostenido(d.iF.map((v, h) => (Number.isFinite(d.carga.serie[h]) ? v : NaN)), CALCULO.sobrecargaMinH) : f.sostenida;
    const escala = { ok: 'sin observaciones', ESCALA_PQ: 'P y Q no cuadran con √3·U·I: revise la escala de las potencias', ESCALA_I: 'la corriente parece estar en otra escala', ESCALA_INDETERMINADA: 'corriente y potencias en escalas dudosas', sin_dato: 'sin datos para comparar', sin_devanado: 'nivel sin devanado asignado' }[info.escala] || info.escala;
    return el('table', { class: 'cs-sec' },
      el('caption', { class: 'cs-ayuda', style: 'text-align:left' }, 'Nivel ' + NIVELES[nv].etiqueta + (info.devanado ? ' → ' + DEVANADO[info.devanado]
        : nivelesExcluidos({ tx: a.tx, fila: a.fila, punto: a.punto }).porNivel[nv] ? ' (medida excluida en la homologación: no entra en ninguna cifra)' : ' (sin devanado asignado)')),
      el('tbody', {},
        fila('Cargabilidad del devanado', info.pct == null ? '—' : num(info.pct, 1) + ' % (p99) · ampacidad ' + num(info.A, 0) + ' A'),
        fila('Corriente fase más cargada', f.i.n ? 'p50 ' + num(f.i.p50, 0) + ' A · p95 ' + num(f.i.p95, 0) + ' A · p99 ' + num(f.i.p99, 0) + ' A · máx ' + num(f.i.max, 0) + ' A' : '—'),
        fila('Máximo sostenido ' + CALCULO.sobrecargaMinH + ' h', sost ? num(sost.valor, 0) + ' A desde ' + formatoCO(d.t[sost.idx])
          + (d.carga && d.carga.excluidas ? ' · sin ' + d.carga.excluidas + ' h de escala imposible' : '') : '—'),
        fila('Tensión de línea promedio', f.u.prom != null ? num(f.u.prom, 2) + ' kV (' + num(100 * f.u.prom / kv, 1) + ' % de ' + num(kv, 1) + ' kV)' : '—'),
        fila('Desequilibrio de tensión', d.deseq.n ? 'p95 ' + num(d.deseq.p95, 2) + ' % · máx ' + num(d.deseq.max, 2) + ' %' : '—'),
        fila('Desbalance de corriente', d.desb.n ? 'p95 ' + num(d.desb.p95, 1) + ' % · máx ' + num(d.desb.max, 1) + ' % (con carga ≥ 5 % de la ampacidad)' : '—'),
        fila('Potencia aparente S', f.s.n ? 'p99 ' + num(f.s.p99, 2) + ' MVA · máx ' + num(f.s.max, 2) + ' MVA' : '—'),
        fila('Factor de potencia', d.fp.prom != null ? 'promedio ' + num(d.fp.prom, 3) + (d.fp.min != null ? ' · mínimo ' + num(d.fp.min, 3) + ' (' + intervaloCO(d.t[d.fp.iMin]) + ')' : '') : '—'),
        fila('Flujo de potencia inverso', f.flujoInverso ? f.flujoInverso + ' h con P de signo contrario al habitual' : 'no'),
        fila('Escala de la medida', escala),
        fila('Horas', f.horas + ' en el rango · ' + f.i.n + ' válidas · ' + f.desenergizadas + ' fuera de servicio' + (f.i.unaFalta ? ' · ' + f.i.unaFalta + ' con solo 2 fases' : '')),
        info.suma ? fila('Suma de circuitos', textoSumaNivel(a, nv, info)) : null));
  }
  /** Una línea del nivel sumado: de qué circuitos sale, cómo cuadra con el transformador y cuántas horas aportó cada regla. */
  function textoSumaNivel(a, nv, info) {
    const der = a.sumaRango && a.sumaRango[nv];
    const base = info.suma.de.join(' + ') + ' (corrientes sumadas hora por hora; tensión, P y Q del transformador)';
    if (!der || der.estado !== 'ok') return base + ' · ' + (a.calc && a.calc.motivoNulo ? a.calc.motivoNulo : 'falta calcular la suma de este rango');
    const h = der.horas || {};
    const v = { ok: 'cuadra', no_cuadra: 'no cuadra: cifra provisional', sin_contraste: 'sin contraste: cifra provisional' }[der.veredicto] || '';
    return base + ' · transformador ÷ suma: ' + (textoCuadre(der) || '—') + (v ? ' (' + v + ')' : '')
      + (h.bandaMuerta || h.abiertas ? ' · en los meses del rango: ' + [h.bandaMuerta ? h.bandaMuerta + ' h por banda muerta validada con el transformador' : null,
        h.abiertas ? h.abiertas + ' h con un circuito abierto (aporta 0)' : null].filter(Boolean).join(' y ') : '');
  }

  function tablaCalidad(d, esSuma = false) {
    const codigos = new Set();
    const porFam = {};
    for (const f of FAMILIAS) {
      porFam[f] = {};
      for (const m of d.fam[f].m) { porFam[f][m] = (porFam[f][m] || 0) + 1; codigos.add(m); }
    }
    const orden = [...codigos].sort((x, y) => x - y);
    const total = d.t.length || 1;
    // En un nivel sumado, el «retenido» de las corrientes es la banda muerta de los circuitos validada con el transformador.
    const texto = (k) => (esSuma && k === CODIGO.RETENIDO ? MOTIVO[k] + ' · en las corrientes: banda muerta validada con el transformador' : (MOTIVO[k] || MOTIVO_LECTURA[k] || ('código ' + k)));
    return el('details', {}, el('summary', {}, 'Calidad del dato (horas por motivo)'),
      el('div', { class: 'cs-tabla-caja', style: 'margin-top:8px' },
        el('table', { class: 'cs-tabla', style: 'min-width:640px' },
          el('caption', {}, 'Solo cuentan como dato las horas «válido» y «retenido». Lo demás queda como hueco en las curvas.'),
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Motivo'), FAMILIAS.map((f) => el('th', { scope: 'col', title: NOMBRE_FAMILIA[f] }, f + ' (' + UNIDAD[f] + ')')))),
          el('tbody', {}, orden.map((k) => el('tr', {}, el('th', { scope: 'row', style: 'position:static' }, texto(k)),
            FAMILIAS.map((f) => el('td', { class: 'cs-num' }, porFam[f][k] ? porFam[f][k] + ' (' + num(100 * porFam[f][k] / total, 0) + ' %)' : '—'))))))));
  }

  function exportarCSV(a, nv) {
    const d = a.porNivel[nv];
    // Nivel sumado: columna NUEVA al FINAL ('Origen') y el nombre del archivo lo dice; los demás niveles salen como siempre.
    const info = (a.calc && a.calc.niveles.find((x) => x.nivel === nv)) || {};
    const origen = info.suma ? 'IR, IS, IT = suma de circuitos ' + info.suma.de.join(' + ') + ' (derivada); U, P y Q = del transformador' : null;
    const motivo = (k) => MOTIVO[k] || MOTIVO_LECTURA[k] || ('código ' + k);
    const filas = [];
    for (let k = 0; k < d.t.length; k++) {
      const obs = FAMILIAS.filter((f) => !(d.fam[f].m[k] === CODIGO.VALIDO || d.fam[f].m[k] === CODIGO.RETENIDO)).map((f) => f + ': ' + motivo(d.fam[f].m[k]));
      // Columnas nuevas AL FINAL (§126): máx, mín e instantáneo que se muestran (las de antes no se mueven).
      const extras = FAMILIAS.flatMap((f) => EXTRAS.map((e) => { const x = d.ext.series[f] && d.ext.series[f][e]; return x && Number.isFinite(x[k]) ? x[k] : null; }));
      filas.push([xPlotly(d.t[k]), xPlotly(d.t[k] + H_MS), ...FAMILIAS.map((f) => d.val[f][k]), d.S[k], d.fp.serie[k], d.iF[k], d.carga ? d.carga.serie[k] : null, obs.join(' | '), ...extras, ...(origen ? [origen] : [])]);
    }
    const nombreExtra = { max: 'max', min: 'min', ins: 'inst' };
    descargarCSV('cargabilidad_scada_' + a.mat.replace(/[^a-z0-9]+/gi, '_') + '_' + nv + (origen ? '_suma-circuitos' : '') + '_' + aInputCO(a.desde + H_MS).slice(0, 10) + '_' + aInputCO(a.hasta).slice(0, 10) + '.csv',
      ['Inicio_hora_CO', 'Fin_hora_CO', 'IR_A', 'IS_A', 'IT_A', 'URS_kV', 'UST_kV', 'UTR_kV', 'P_MW', 'Q_Mvar', 'S_MVA_calculada', 'FP_calculado', 'I_fase_max_A', 'Cargabilidad_pct', 'Horas_descartadas_por',
        ...FAMILIAS.flatMap((f) => EXTRAS.map((e) => f + '_' + nombreExtra[e] + '_' + UNIDAD[f])), ...(origen ? ['Origen'] : [])],
      filas);
  }

  /**
   * Filtro «Valores a mostrar» y «Fases» (`99 §126`). Cambiarlo solo vuelve a dibujar: no relee la base.
   * Un valor que el rango no trae (meses cargados antes de guardar máximos y mínimos) queda deshabilitado.
   */
  function filtroValores(d, redibujar) {
    const hay = d.ext.hay || {};
    const casilla = (grupo, clave, texto, habil, nota) => {
      const id = 'csVer-' + grupo + '-' + clave;
      // Una casilla deshabilitada se ve desmarcada (lo que se ve es lo que se dibuja); la preferencia se conserva.
      const marcado = (g, k) => (g === 'ver' ? !!verEfectivo(d)[k] : !!filtro[g][k]);   // se ve marcado lo que se dibuja
      const c = el('input', { type: 'checkbox', id, checked: habil && marcado(grupo, clave), disabled: !habil });
      c.addEventListener('change', () => {
        filtro[grupo][clave] = c.checked;
        // Siempre queda algo que ver (contando solo lo que este rango tiene): si no, vuelve el promedio; sin fases, las tres.
        if (grupo === 'ver' && !Object.values(verEfectivo(d)).some(Boolean)) filtro.ver.prom = true;
        if (grupo === 'fases' && !Object.values(filtro.fases).some(Boolean)) filtro.fases = { R: true, S: true, T: true };
        guardarFiltro(filtro);
        redibujar();
        const marcas = document.querySelectorAll('[id^="csVer-"]');
        for (const m of marcas) { const [, g2, k2] = m.id.split('-'); if (filtro[g2]) m.checked = !m.disabled && marcado(g2, k2); }
      });
      return el('label', { class: 'cs-check' + (habil ? '' : ' is-apagado'), for: id, title: habil ? '' : nota(clave) }, c, ' ' + texto);
    };
    const guardados = d.ext.guardados || {};
    const nota = (k) => (guardados[k] ? 'En este rango todos esos valores quedaron ocultos por imposibles.' : 'Este rango no trae ese valor guardado.');
    // Clase PROPIA (cs-ver): «cs-filtros» es la barra de filtros de la lista y no se comparte (regresión de §126).
    return el('div', { class: 'cs-ver' },
      el('fieldset', { class: 'cs-filtro' }, el('legend', {}, 'Valores a mostrar'),
        casilla('ver', 'prom', ETIQUETA_VER.prom, true),
        EXTRAS.map((k) => casilla('ver', k, ETIQUETA_VER[k], !!hay[k], nota))),
      el('fieldset', { class: 'cs-filtro' }, el('legend', {}, 'Fases'),
        ['R', 'S', 'T'].map((k) => casilla('fases', k, 'Fase ' + k, true))),
      el('p', { class: 'cs-ayuda' }, 'El máximo, el mínimo y el instantáneo son de cada hora según el SCADA: sirven para ver, no entran en la cifra de cargabilidad. Con máximo y mínimo a la vez se sombrea la franja entre ellos.'
        + (d.ext.ocultos ? ' Se ocultan ' + d.ext.ocultos.toLocaleString('es-CO') + ' valores imposibles (topes del sistema, tensiones en otra escala o picos de más de ' + EXTRA_TOPE_X + ' veces el mayor promedio o la ampacidad).' : '')
        + (!EXTRAS.some((k) => guardados[k]) ? ' Este rango todavía no tiene máximos, mínimos ni instantáneos guardados.' : '')));
  }

  async function pintarNivel(a, nv) {
    a.nivel = nv;
    const d = a.porNivel[nv];
    const info = a.calc.niveles.find((x) => x.nivel === nv) || {};
    const excl = nivelesExcluidos({ tx: a.tx, fila: a.fila, punto: a.punto });
    // Botones de alternar (aria-pressed), no pestañas: una sola figura que cambia de nivel.
    const botones = el('div', { class: 'cs-niveles', role: 'group', 'aria-label': 'Nivel de tensión medido' },
      Object.keys(a.porNivel).sort((x, y) => NIVELES[y].kv - NIVELES[x].kv).map((k) => {
        const i = a.calc.niveles.find((x) => x.nivel === k) || {};
        const fuera = !i.devanado && excl.porNivel[k];
        return el('button', { type: 'button', id: 'csNivelBtn-' + k, 'aria-pressed': String(k === nv), title: fuera && excl.nota ? excl.nota : null,
          onclick: () => { if (k !== nv) pintarNivel(a, k); } },
          NIVELES[k].etiqueta + (i.devanado ? ' · ' + DEVANADO[i.devanado] + (i.suma ? ' · suma de circuitos' : '') : fuera ? ' · excluida (homologación)' : ' · sin devanado'));
      }));
    liberarFigura(figura);
    // Contenedor de las gráficas (una por magnitud, cada una con su título y su descripción accesible).
    const fig = el('div', { class: 'cs-figura', 'aria-label': 'Curvas horarias del nivel ' + NIVELES[nv].etiqueta });
    figura = fig;
    const panelFiltro = filtroValores(d, () => dibujar());
    const caja = document.getElementById('csNivel');
    if (!caja) return;
    conservarFoco(() => poner(caja,
      el('div', { class: 'cs-panel' },
        el('h2', {}, 'Curvas por fase'),
        botones,
        !info.devanado && excl.porNivel[nv] ? el('p', { class: 'cs-devmes-aviso' }, 'Medida excluida en la homologación'
          + ((n) => (n ? ': ' + (/[.…]$/.test(n) ? n : n + '.') : '.'))(notaCorta(excl.nota, 220)) + ' Se muestra solo para ver: no entra en ninguna cifra.') : null,
        panelFiltro,
        el('figure', { style: 'margin:0' }, fig,
          el('figcaption', {}, 'Cada punto va en la hora en que lo rotula el SCADA (hora de Colombia): el de las 14:00 es el promedio de 13:00 a 14:00. P y Q son totales trifásicos del SCADA; S y el factor de potencia se calculan de ellas. Línea roja: ampacidad del devanado y 100 %; líneas grises: bandas CRG ' + textoBandas(ctx.umbrales) + '. Los huecos son horas sin dato válido.'
            + (info.suma ? ' En este nivel las corrientes son la suma hora por hora de los circuitos ' + info.suma.de.join(' + ') + ' (una hora vale solo si valen todos); la tensión, P y Q son las del transformador; el máximo, el mínimo y el instantáneo no se calculan para una suma.' : ''))),
        el('div', { class: 'cs-acciones' }, el('button', { type: 'button', id: 'csCsvNivel', class: 'btn btn--glass btn--sm', onclick: () => exportarCSV(a, nv) }, 'Descargar CSV del nivel'))),
      el('div', { class: 'cs-dos' }, el('div', { class: 'cs-panel' }, tablaNivel(a, nv)), el('div', { class: 'cs-panel' }, tablaCalidad(d, !!info.suma)))));
    const mio = token;
    const vigente = () => mio === token && figura === fig;
    const dibujar = () => dibujarFigura(fig, {
      t: d.t, fam: d.val, iF: d.iF, pct: d.carga ? d.carga.serie : null, S: d.S, fp: d.fp.serie, A: info.A, bandas: bandasCRG(ctx.umbrales), etiqueta: a.mat + '_' + nv,
      ext: d.ext.series, ver: verEfectivo(d), fases: filtro.fases
    }, vigente);
    try {
      await dibujar();
    } catch (e) {
      if (!vigente()) return;
      // El aviso va FUERA del rol «img» (si no, el lector de pantalla no lo anuncia ni ofrece el botón).
      fig.removeAttribute('role'); fig.removeAttribute('aria-label');
      poner(fig, el('div', { class: 'cs-estado', role: 'alert' }, (e && e.message) || 'No se pudo dibujar la figura.', el('br'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => pintarNivel(a, nv) }, 'Reintentar')));
    }
  }

  /** Lee y calcula el rango [desde, hasta) (inicios de intervalo). */
  async function cargar(desde, hasta, { enfocar = false, aviso = null } = {}) {
    const mio = ++token;
    const a = actual;
    a.desde = desde; a.hasta = hasta;
    // El encabezado no muestra cifras de otro rango mientras se lee este (ni si falla).
    a.calc = null; a.porNivel = null; a.leyendo = true; a.sumaRango = null;
    try {
      a.previo = calcularEquipo({ tx: a.tx, fila: a.fila, punto: a.punto, resumenPorNivel: null, conteos: conteosDe(a), umbrales: ctx.umbrales });
    } catch (e) { a.previo = null; }
    liberarFigura(figura); figura = null;
    const avisoEl = () => (aviso ? el('div', { class: 'cs-panel', role: 'status' }, aviso) : null);
    conservarFoco(() => poner(cont, encabezado(a), a.placaNodo, a.historiaNodo, a.mensualNodo, avisoEl(), selectorRango(a), el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-esqueleto', style: 'width:50%' }), el('div', { class: 'cs-esqueleto', style: 'width:80%;margin-top:10px' }),
      el('p', { class: 'cs-ayuda', role: 'status' }, 'Leyendo ' + formatoCO(desde + H_MS) + ' a ' + formatoCO(hasta) + '…')), a.dgaNodo, a.duvalNodo));
    pintarDga(a, { estado: { estado: 'leyendo' } });
    if (enfocar) focoTitulo();
    try {
      const mesesRango = mesesDelRango(desde, hasta);
      const existentes = mesesRango.filter((m) => (a.punto.meses || []).includes(m));
      let porMes;
      // Con suma de circuitos, cada mes llega con sus niveles sumados (compuestos con el mes completo) y su derivado.
      // Rige el mismo candado de la lista: el derivado GUARDADO de cada mes y, con el catálogo, D5 (barra compartida).
      try { porMes = (await leerSeriesEquipo(a.cid, existentes, a.fila, { puntos: (ctx.catalogo && ctx.catalogo.puntos) || null })).porMes; }
      catch (e) { porMes = Object.fromEntries(existentes.map((m) => [m, { estado: 'fallo' }])); }
      if (mio !== token) return;
      const porNivel = {}; const resumenPorNivel = {}; const fallidos = new Set();
      for (const nv of Object.keys(a.punto.niveles || {})) {
        const pm = {};
        for (const mes of mesesRango) {
          const r = porMes[mes];
          if (!r) pm[mes] = { estado: 'no_existe' };
          else if (r.estado === 'ok') pm[mes] = { estado: 'ok', series: (r.serie.niveles[nv] && r.serie.niveles[nv].fam) || {} };
          else pm[mes] = { estado: r.estado };
        }
        const rec = recortarRango(pm, FAMILIAS, desde, hasta);
        rec.mesesFallidos.forEach((m) => fallidos.add(m));
        porNivel[nv] = { t: rec.t, fam: rec.fam, mesesFallidos: rec.mesesFallidos };
      }
      const recs = Object.fromEntries(Object.entries(porNivel).map(([nv, r]) => [nv, { t: r.t, fam: r.fam }]));
      // Primero el mapa nivel → devanado (de la homologación), luego la ampacidad por nivel.
      const previo = calcularEquipo({ tx: a.tx, fila: a.fila, punto: a.punto, resumenPorNivel: null, conteos: conteosDe(a), umbrales: ctx.umbrales });
      for (const nv of Object.keys(porNivel)) {
        const i = previo.niveles.find((x) => x.nivel === nv);
        const A = i && i.devanado ? a.placa[i.devanado].A : null;
        porNivel[nv] = calcularNivel(porNivel[nv], NIVELES[nv].kv, A);
        resumenPorNivel[nv] = porNivel[nv].resumen;
      }
      // Suma de circuitos: el nivel sumado lleva el derivado del RANGO (válido solo si cada mes leído trae el suyo); sin él,
      // calcularEquipo lo deja sin cifra (nunca la medida propia del transformador).
      const spec = especSuma(a.fila);
      a.sumaRango = {};
      if (spec && spec.cid === a.cid) {
        for (const [nv, sp] of Object.entries(spec.porNivel)) {
          if (!resumenPorNivel[nv]) continue;
          const conDatos = existentes.filter((m) => porMes[m] && porMes[m].estado === 'ok').map((m) => ({ mes: m, derivado: (porMes[m].derivado && porMes[m].derivado[nv]) || null }));
          a.sumaRango[nv] = derivadoDeMeses(conDatos, sp);
          resumenPorNivel[nv] = { ...resumenPorNivel[nv], derivado: a.sumaRango[nv] };
        }
      }
      a.porNivel = porNivel;
      // Varios meses: firmeza por el devanado que da la cifra, contado en los meses (cargados por el parque) en que midió.
      const mesesCargados = mesesRango.filter((m) => !!(ctx.catalogo && ctx.catalogo.meses && ctx.catalogo.meses[m]));
      let firmezaPeriodo = null;
      try { firmezaPeriodo = firmezaDelRango(recs, previo.niveles, mesesCargados, desde); } catch (e) { firmezaPeriodo = null; }
      a.calc = calcularEquipo({ tx: a.tx, fila: a.fila, punto: a.punto, resumenPorNivel, conteos: conteosDe(a), umbrales: ctx.umbrales, mesesFallidos: [...fallidos], firmezaPeriodo });
      a.leyendo = false;
      const sinNada = Object.values(porNivel).every((d) => !d.resumen.i.n);
      conservarFoco(() => poner(cont, encabezado(a), a.placaNodo, a.historiaNodo, a.mensualNodo, avisoEl(), selectorRango(a),
        fallidos.size ? el('div', { class: 'cs-panel cs-error', role: 'alert' }, 'No se pudo leer ' + [...fallidos].map(nombreMes).join(', ') + ' (revise la conexión): esas horas quedan como hueco y la cifra no es firme.',
          el('button', { type: 'button', class: 'btn btn--glass btn--sm', style: 'margin-left:8px', onclick: () => cargar(desde, hasta) }, 'Reintentar')) : null,
        sinNada ? el('div', { class: 'cs-panel cs-estado' }, 'No hay horas con dato válido en este rango. Pruebe con otro rango.') : indicadores(a),
        a.dgaNodo,
        a.duvalNodo,
        el('div', { id: 'csNivel' })));
      pintarDga(a, { estado: { estado: 'ok' }, calc: a.calc, porNivel: a.porNivel });
      const nv = (a.calc.devMax && (a.calc.niveles.find((x) => x.devanado === a.calc.devMax) || {}).nivel) || Object.keys(porNivel).sort((x, y) => NIVELES[y].kv - NIVELES[x].kv)[0];
      if (nv) await pintarNivel(a, a.nivel && porNivel[a.nivel] ? a.nivel : nv);
    } catch (e) {
      if (mio !== token) return;
      a.leyendo = false; a.calc = null; a.porNivel = null;
      console.warn('[cargabilidad-scada] detalle', e);
      conservarFoco(() => poner(cont, encabezado(a), a.placaNodo, a.historiaNodo, a.mensualNodo, selectorRango(a), el('div', { class: 'cs-panel cs-estado', role: 'alert' }, 'No se pudo calcular este rango.', el('br'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => cargar(desde, hasta) }, 'Reintentar')), a.dgaNodo, a.duvalNodo));
      pintarDga(a, { estado: { estado: 'error' } });
    }
  }

  function abrir(mat, { id, mes, desde, hasta } = {}) {
    token++;
    const tx = buscarTx(mat, id);
    if (!tx) {
      actual = null;
      poner(cont, el('div', { class: 'cs-panel' }, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: alVolver }, '← Volver a la lista'),
        el('div', { class: 'cs-estado', role: 'alert' }, 'No se encontró el transformador «' + mat + '» en el parque.')));
      return;
    }
    const filasH = (ctx.homologacion && ctx.homologacion.filas) || {};
    const filaBase = filaDeTransformador(tx, indicePorMatricula(filasH));
    // Cambio de medida: la configuración del mes pedido (o del INICIO del rango del enlace: un rango nunca cruza el cambio);
    // sin mes pedido, la de hoy. Sin cambios de medida: la misma fila de siempre y el mismo punto.
    const mesDe = (t) => (typeof t === 'string' && /^\d{4}-\d{2}/.test(t) ? t.slice(0, 7) : null);
    const segs = filaBase ? segmentosDeFila(filaBase) : [];
    const seg = filaBase ? segmentoDelMes(filaBase, mes || mesDe(desde) || mesDe(hasta)) : null;
    const fila = seg ? seg.fila : filaBase;
    const k = fila ? analizarClaveHomologada(claveEfectiva(fila)) : null;
    const cid = k ? claveId(k.est, k.elem) : null;
    const puntoTodo = cid && ctx.catalogo && ctx.catalogo.puntos ? ctx.catalogo.puntos[cid] || null : null;
    const punto = seg && segs.length > 1 ? puntoDelSegmento(puntoTodo, seg) : puntoTodo;
    const matricula = leer(tx, 'identificacion.matricula') || leer(tx, 'identificacion.codigo') || tx.codigo || mat;
    const cambio = !actual || actual.tx !== tx;
    // Cambio de medida: OTRA configuración del mismo equipo rehace la historia y el mes a mes (no la placa ni DGA, que son del
    // equipo). Sin cambios de medida la llave es siempre '' y todo queda como antes.
    const llaveSeg = seg && segs.length > 1 ? (seg.desde || '') + '_' + (seg.hasta || '') : '';
    const otraConfig = !cambio && (actual.llaveSeg || '') !== llaveSeg;
    // Ranura del panel DGA: UN nodo por equipo (al cambiar el rango se reusa: no parpadea).
    const dgaNodo = !cambio && actual.dgaNodo ? actual.dgaNodo
      : el('section', { class: 'cs-panel cs-dga', id: 'csDga', hidden: true, 'aria-labelledby': 'csDgaTitulo' });
    const duvalNodo = !cambio && actual.duvalNodo ? actual.duvalNodo
      : el('section', { class: 'cs-panel cs-duval', id: 'csDuval', hidden: true, 'aria-labelledby': 'csDuvalTitulo' });
    // Historia del equipo (`99 §159`): UN nodo por equipo, fijo arriba del rango (no se recalcula al cambiar el rango).
    const historiaNodo = !cambio && !otraConfig && actual.historiaNodo ? actual.historiaNodo
      : el('section', { class: 'cs-panel cs-historia', id: 'csHistoria', hidden: true, 'aria-labelledby': 'csHistoriaTitulo' });
    const historiaLista = !cambio && !otraConfig && actual.historiaLista;
    // «Cargabilidad mes a mes y acumulada» (TODO-69): UN nodo por equipo, debajo de la historia, con su import() aislado.
    if ((cambio || otraConfig) && actual && actual.mensualNodo) liberarFigura(actual.mensualNodo);
    const mensualNodo = !cambio && !otraConfig && actual.mensualNodo ? actual.mensualNodo
      : el('section', { class: 'cs-panel cs-mensual', id: 'csMensual', hidden: true, 'aria-labelledby': 'csMensualTitulo' });
    const mensualLista = !cambio && !otraConfig && actual.mensualLista;
    const placaNodo = !cambio && actual.placaNodo ? actual.placaNodo
      : el('section', { class: 'cs-panel cs-placa', id: 'csPlaca', hidden: true, 'aria-labelledby': 'csPlacaTitulo' });
    const placaLista = !cambio && actual.placaLista;
    // La placa leída (para la tabla de devanados) se conserva mientras sea el mismo equipo, como su panel.
    const limitesPlaca = !cambio && actual.limitesPlaca ? actual.limitesPlaca : null;
    const placaLeida = !cambio && !!actual.placaLeida;
    actual = { mat: matricula, tx, fila, punto, cid, placa: placaDe(tx), porNivel: null, calc: null, nivel: cambio ? null : actual.nivel, dgaNodo, duvalNodo, dga: null, historiaNodo, historiaLista, mensualNodo, mensualLista, placaNodo, placaLista, limitesPlaca, placaLeida,
      // Campos NUEVOS (cambio de medida): solo con más de una configuración.
      ...(segs.length > 1 ? { segmentos: segs, segmento: seg, segmentoBase: segs.find((s) => s.desde === seg.desde && s.hasta === seg.hasta) || null, llaveSeg } : {}) };
    if (!punto || !(punto.meses || []).length) {
      actual.calc = calcularEquipo({ tx, fila, punto: null, resumenPorNivel: null, conteos: conteosDe(actual), umbrales: ctx.umbrales });
      const motivoSin = !ctx.catalogo ? 'Todavía no hay mediciones SCADA cargadas.'
        : (seg && seg.tipo === 'sin_carga' ? 'Sin cifra: ' + motivoSinCarga(seg.fila.cambioMedida) + '.'
        : (!fila ? 'Este transformador no está en la homologación con el SCADA.'
          : (!cid ? 'No hay curvas que mostrar: falta su punto SCADA en la homologación.' : 'Su punto SCADA todavía no tiene datos cargados.')));
      poner(cont, encabezado(actual), actual.placaNodo, el('div', { class: 'cs-panel cs-estado' }, motivoSin), actual.dgaNodo, actual.duvalNodo);
      pintarPlacaDe(actual);
      pintarDga(actual, { estado: { estado: 'sin_scada', motivo: motivoSin } });
      focoTitulo();
      return;
    }
    pintarPlacaDe(actual);
    if (!actual.historiaLista) pintarHistoriaDe(actual);
    if (!actual.mensualLista) pintarMensualDe(actual);
    // Rango: el del enlace (rótulos: primera y última hora) si es válido; si no, el mes pedido; si no, el mes por defecto.
    const lim = limites(actual);
    const mesDef = mesPorDefecto(ctx.catalogo);
    const mesInicial = mes && punto.meses.includes(mes) ? mes : (punto.meses.includes(mesDef) ? mesDef : lim.meses[lim.meses.length - 1]);
    let rango = ventanaDeMes(mesInicial);
    // Si el enlace pide un mes que este punto no tiene, se dice (antes saltaba a otro mes en silencio).
    let aviso = mes && !punto.meses.includes(mes) && !(desde || hasta)
      ? 'Este punto no tiene datos de ' + nombreMes(mes) + ': se muestra ' + nombreMes(mesInicial) + '.' : null;
    if (desde || hasta) {
      const dl = parseFechaHoraCO(desde); const hl = parseFechaHoraCO(hasta);
      const cand = { desde: dl == null ? null : dl - H_MS, hasta: hl };
      const v = validar(cand.desde, cand.hasta, lim);
      if (v.ok) rango = cand;
      else aviso = 'El rango del enlace no es válido (' + v.errores.map((e) => e.texto.replace(/\.$/, '')).join('; ') + '): se muestra ' + nombreMes(mesInicial) + '.';
    }
    cargar(rango.desde, rango.hasta, { enfocar: true, aviso });
  }

  /** La historia va en un archivo aparte (L-102): si no carga, el detalle sigue igual y la sección se oculta. */
  async function pintarHistoriaDe(a) {
    // El MISMO equipo reabierto (enlace, atrás) reusa su nodo: la historia sigue siendo «vigente» mientras el nodo lo sea.
    const nodo = a.historiaNodo;
    const vigente = () => !!actual && actual.historiaNodo === nodo;
    a.historiaLista = true;
    try {
      const mod = await import('./historia.js');
      if (!vigente()) return;
      const res = await mod.pintarHistoria(nodo, { a, ctx, vigente, alVerDia: (ms) => verDia(actual, ms), alReintentar: () => pintarHistoriaDe(actual) });
      // Con meses que no se pudieron leer, se rehace al reabrir el equipo (y ofrece «Reintentar»).
      if (vigente() && res && res.completa === false) actual.historiaLista = false;
    } catch (e) {
      console.warn('[cargabilidad-scada] historia', e);
      if (!vigente()) return;
      actual.historiaLista = false;
      poner(nodo, el('p', { class: 'cs-ayuda' }, 'No se pudo armar la historia del equipo (revise la conexión).'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => pintarHistoriaDe(actual) }, 'Reintentar'));
    }
  }

  /** «Cargabilidad mes a mes y acumulada» en archivo aparte (L-102): si no carga, la sección se oculta y el detalle sigue. */
  async function pintarMensualDe(a) {
    const nodo = a.mensualNodo;
    const vigente = () => !!actual && actual.mensualNodo === nodo;
    a.mensualLista = true;
    try {
      const mod = await import('./panel-mensual.js');
      if (!vigente()) return;
      const res = await mod.pintarMensual(nodo, { a, ctx, vigente, alReintentar: () => pintarMensualDe(actual) });
      // Con meses que no se pudieron leer (o si se dejó la página antes de dibujar), se rehace al reabrir el equipo.
      if (vigente() && res && res.completa === false) actual.mensualLista = false;
    } catch (e) {
      console.warn('[cargabilidad-scada] mensual', e);
      if (!vigente()) return;
      actual.mensualLista = false;
      poner(nodo, el('p', { class: 'cs-ayuda' }, 'No se pudo armar la cargabilidad mes a mes (revise la conexión).'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => pintarMensualDe(actual) }, 'Reintentar'));
    }
  }

  /** «Ver ese día»: el rango de las curvas pasa al día de ese rótulo (00:00 a 23:00) sin rehacer la historia. */
  function verDia(a, ms) {
    if (!a || actual !== a || ms == null) return;
    const dia = aInputCO(ms).slice(0, 10);
    const d0 = parseFechaHoraCO(dia + 'T00:00'); const d1 = parseFechaHoraCO(dia + 'T23:00');
    if (d0 == null || d1 == null) return;
    const desde = d0 - H_MS; const hasta = d1;
    history.replaceState(null, '', hashDe(a, desde, hasta));
    cargar(desde, hasta).then(() => { const s = document.getElementById('csDesde'); if (s) s.scrollIntoView({ block: 'center' }); });
  }

  function focoTitulo() { const t = document.getElementById('csDetTitulo'); if (t) t.focus({ preventScroll: false }); }

  return { abrir, cerrar };
}
