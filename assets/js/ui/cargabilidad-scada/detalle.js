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
import { dibujarFigura, liberarFigura } from './graficos.js';
import { FAMILIAS, NIVELES, DEVANADO, CALCULO, MOTIVO, CODIGO, UNIDAD, NOMBRE_FAMILIA, TIEMPO } from '../../domain/scada_carga_config.js';
import { EXTRAS, NOMBRE_EXTRA, EXTRA_TOPE_X, extrasVisibles } from '../../domain/scada_carga_extras.js';
import { claveId } from '../../domain/scada_carga_csv.js';
import {
  analizarClaveHomologada, claveEfectiva, conteosHomologacion, normalizarMatricula, placaDe, AVISOS
} from '../../domain/scada_carga_homologacion.js';
import { filaDeTransformador, indicePorMatricula, calcularEquipo, mesPorDefecto } from '../../domain/scada_carga_vista.js';
import { mesesDelRango, recortarRango, ventanaDeMes } from '../../domain/scada_carga_series.js';
import { validos } from '../../domain/scada_carga_limpieza.js';
import { resumenFisico, iFaseMax, serieCargabilidad, serieS, factorPotencia, desbalanceI, desequilibrioU, horasSostenidasSobre, estadisticas } from '../../domain/scada_carga_kpis.js';
import { resumirParaGuardar } from '../../domain/scada_carga_importacion.js';
import {
  parseFechaHoraCO, aInputCO, formatoCO, intervaloCO, nombreMes, validarRango, xPlotly
} from '../../domain/scada_carga_fecha.js';
import { leerSeriesPunto } from '../../data/scada_carga.js';
import { BASELINE_UMBRALES_SALUD } from '../../domain/umbrales_salud_baseline.js';

const H_MS = 3600e3;
const OFF = TIEMPO.offsetColombiaH * H_MS;
const ESTADOS = { automatica: 'Homologación sin observaciones', confirmada: 'Medida confirmada por el Ingeniero', pendiente: 'Medida por confirmar', excluida: 'Medida excluida', sin_homologacion: 'Sin homologación' };
const MOTIVO_LECTURA = { 20: 'mes que no se pudo leer', 21: 'sin datos cargados' };
const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);

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
  const resumen = resumirParaGuardar(fisico, fam);
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

export function montarDetalle(cont, ctx, { alVolver }) {
  let token = 0;
  let figura = null;
  let actual = null;        // {mat, id, tx, fila, punto, cid, placa, desde, hasta, porNivel, calc, nivel}
  const filtro = leerFiltro();
  /** Lo que de verdad se dibuja: un extra que el rango no tiene no cuenta; si no queda nada, el promedio. */
  function verEfectivo(d) {
    const hay = (d && d.ext && d.ext.hay) || {};
    const v = { prom: !!filtro.ver.prom };
    for (const k of EXTRAS) v[k] = !!filtro.ver[k] && !!hay[k];
    if (!Object.values(v).some(Boolean)) v.prom = true;
    return v;
  }

  /** Al salir del detalle: nada de lo que siga cargando o dibujando puede volver a pintar aquí. */
  function cerrar() { token++; liberarFigura(figura); figura = null; poner(cont); }

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
    const tx = a.tx; const p = a.placa;
    const devTxt = ['P', 'S', 'T'].filter((d) => p[d].kv).map((d) => DEVANADO[d] + ' ' + num(p[d].kv, 1) + ' kV' + (p[d].A ? ' · ' + num(p[d].A, 0) + ' A' : ' · sin ampacidad'));
    return el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-volver' }, el('button', { type: 'button', id: 'csVolver', class: 'btn btn--ghost btn--sm', onclick: alVolver }, '← Volver a la lista')),
      el('div', { class: 'cs-cab' },
        el('h2', { tabindex: '-1', id: 'csDetTitulo' }, a.mat),
        el('span', { class: 'cs-dato' }, el('b', {}, 'Subestación: '), leer(tx, 'ubicacion.subestacion_nombre') || (a.fila && a.fila.subestacion) || '—'),
        el('span', { class: 'cs-dato' }, el('b', {}, 'Zona: '), leer(tx, 'ubicacion.zona') || '—'),
        el('span', { class: 'cs-dato' }, el('b', {}, 'Potencia: '), leer(tx, 'placa.potencia_kva') ? num(Number(leer(tx, 'placa.potencia_kva')) / 1000, 1) + ' MVA' : '—')),
      el('p', { class: 'cs-dato', style: 'margin:6px 0 0' }, el('b', {}, 'Placa: '), devTxt.length ? devTxt.join(' · ') : 'sin tensiones de placa'),
      el('p', { class: 'cs-dato', style: 'margin:4px 0 0' }, el('b', {}, 'Punto SCADA: '), a.fila ? (claveEfectiva(a.fila) || 'sin punto') : 'sin homologación',
        a.calc ? ' · ' + (ESTADOS[a.calc.estado] || a.calc.estado) : ''),
      a.calc && a.calc.estado === 'pendiente' && a.calc.avisos.length ? el('ul', { class: 'cs-avisos' },
        a.calc.avisos.filter((k) => AVISOS[k]).map((k) => el('li', {}, AVISOS[k].texto))) : null);
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
    const escala = { ok: 'sin observaciones', ESCALA_PQ: 'P y Q no cuadran con √3·U·I: revise la escala de las potencias', ESCALA_I: 'la corriente parece estar en otra escala', ESCALA_INDETERMINADA: 'corriente y potencias en escalas dudosas', sin_dato: 'sin datos para comparar', sin_devanado: 'nivel sin devanado asignado' }[info.escala] || info.escala;
    return el('table', { class: 'cs-sec' },
      el('caption', { class: 'cs-ayuda', style: 'text-align:left' }, 'Nivel ' + NIVELES[nv].etiqueta + (info.devanado ? ' → ' + DEVANADO[info.devanado] : ' (sin devanado asignado)')),
      el('tbody', {},
        fila('Cargabilidad del devanado', info.pct == null ? '—' : num(info.pct, 1) + ' % (p99) · ampacidad ' + num(info.A, 0) + ' A'),
        fila('Corriente fase más cargada', f.i.n ? 'p50 ' + num(f.i.p50, 0) + ' A · p95 ' + num(f.i.p95, 0) + ' A · p99 ' + num(f.i.p99, 0) + ' A · máx ' + num(f.i.max, 0) + ' A' : '—'),
        fila('Máximo sostenido ' + CALCULO.sobrecargaMinH + ' h', f.sostenida ? num(f.sostenida.valor, 0) + ' A desde ' + formatoCO(d.t[f.sostenida.idx]) : '—'),
        fila('Tensión de línea promedio', f.u.prom != null ? num(f.u.prom, 2) + ' kV (' + num(100 * f.u.prom / kv, 1) + ' % de ' + num(kv, 1) + ' kV)' : '—'),
        fila('Desequilibrio de tensión', d.deseq.n ? 'p95 ' + num(d.deseq.p95, 2) + ' % · máx ' + num(d.deseq.max, 2) + ' %' : '—'),
        fila('Desbalance de corriente', d.desb.n ? 'p95 ' + num(d.desb.p95, 1) + ' % · máx ' + num(d.desb.max, 1) + ' % (con carga ≥ 5 % de la ampacidad)' : '—'),
        fila('Potencia aparente S', f.s.n ? 'p99 ' + num(f.s.p99, 2) + ' MVA · máx ' + num(f.s.max, 2) + ' MVA' : '—'),
        fila('Factor de potencia', d.fp.prom != null ? 'promedio ' + num(d.fp.prom, 3) + (d.fp.min != null ? ' · mínimo ' + num(d.fp.min, 3) + ' (' + intervaloCO(d.t[d.fp.iMin]) + ')' : '') : '—'),
        fila('Flujo de potencia inverso', f.flujoInverso ? f.flujoInverso + ' h con P de signo contrario al habitual' : 'no'),
        fila('Escala de la medida', escala),
        fila('Horas', f.horas + ' en el rango · ' + f.i.n + ' válidas · ' + f.desenergizadas + ' fuera de servicio' + (f.i.unaFalta ? ' · ' + f.i.unaFalta + ' con solo 2 fases' : ''))));
  }

  function tablaCalidad(d) {
    const codigos = new Set();
    const porFam = {};
    for (const f of FAMILIAS) {
      porFam[f] = {};
      for (const m of d.fam[f].m) { porFam[f][m] = (porFam[f][m] || 0) + 1; codigos.add(m); }
    }
    const orden = [...codigos].sort((x, y) => x - y);
    const total = d.t.length || 1;
    const texto = (k) => MOTIVO[k] || MOTIVO_LECTURA[k] || ('código ' + k);
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
    const motivo = (k) => MOTIVO[k] || MOTIVO_LECTURA[k] || ('código ' + k);
    const filas = [];
    for (let k = 0; k < d.t.length; k++) {
      const obs = FAMILIAS.filter((f) => !(d.fam[f].m[k] === CODIGO.VALIDO || d.fam[f].m[k] === CODIGO.RETENIDO)).map((f) => f + ': ' + motivo(d.fam[f].m[k]));
      // Columnas nuevas AL FINAL (§126): máx, mín e instantáneo que se muestran (las de antes no se mueven).
      const extras = FAMILIAS.flatMap((f) => EXTRAS.map((e) => { const x = d.ext.series[f] && d.ext.series[f][e]; return x && Number.isFinite(x[k]) ? x[k] : null; }));
      filas.push([xPlotly(d.t[k]), xPlotly(d.t[k] + H_MS), ...FAMILIAS.map((f) => d.val[f][k]), d.S[k], d.fp.serie[k], d.iF[k], d.carga ? d.carga.serie[k] : null, obs.join(' | '), ...extras]);
    }
    const nombreExtra = { max: 'max', min: 'min', ins: 'inst' };
    descargarCSV('cargabilidad_scada_' + a.mat.replace(/[^a-z0-9]+/gi, '_') + '_' + nv + '_' + aInputCO(a.desde + H_MS).slice(0, 10) + '_' + aInputCO(a.hasta).slice(0, 10) + '.csv',
      ['Inicio_hora_CO', 'Fin_hora_CO', 'IR_A', 'IS_A', 'IT_A', 'URS_kV', 'UST_kV', 'UTR_kV', 'P_MW', 'Q_Mvar', 'S_MVA_calculada', 'FP_calculado', 'I_fase_max_A', 'Cargabilidad_pct', 'Horas_descartadas_por',
        ...FAMILIAS.flatMap((f) => EXTRAS.map((e) => f + '_' + nombreExtra[e] + '_' + UNIDAD[f]))],
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
    return el('div', { class: 'cs-filtros' },
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
    // Botones de alternar (aria-pressed), no pestañas: una sola figura que cambia de nivel.
    const botones = el('div', { class: 'cs-niveles', role: 'group', 'aria-label': 'Nivel de tensión medido' },
      Object.keys(a.porNivel).sort((x, y) => NIVELES[y].kv - NIVELES[x].kv).map((k) => {
        const i = a.calc.niveles.find((x) => x.nivel === k) || {};
        return el('button', { type: 'button', id: 'csNivelBtn-' + k, 'aria-pressed': String(k === nv), onclick: () => { if (k !== nv) pintarNivel(a, k); } },
          NIVELES[k].etiqueta + (i.devanado ? ' · ' + DEVANADO[i.devanado] : ' · sin devanado'));
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
        panelFiltro,
        el('figure', { style: 'margin:0' }, fig,
          el('figcaption', {}, 'Cada punto va en la hora en que lo rotula el SCADA (hora de Colombia): el de las 14:00 es el promedio de 13:00 a 14:00. P y Q son totales trifásicos del SCADA; S y el factor de potencia se calculan de ellas. Línea roja: ampacidad del devanado y 100 %; líneas grises: bandas CRG ' + textoBandas(ctx.umbrales) + '. Los huecos son horas sin dato válido.')),
        el('div', { class: 'cs-acciones' }, el('button', { type: 'button', id: 'csCsvNivel', class: 'btn btn--glass btn--sm', onclick: () => exportarCSV(a, nv) }, 'Descargar CSV del nivel'))),
      el('div', { class: 'cs-dos' }, el('div', { class: 'cs-panel' }, tablaNivel(a, nv)), el('div', { class: 'cs-panel' }, tablaCalidad(d)))));
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
    liberarFigura(figura); figura = null;
    const avisoEl = () => (aviso ? el('div', { class: 'cs-panel', role: 'status' }, aviso) : null);
    conservarFoco(() => poner(cont, encabezado(a), avisoEl(), selectorRango(a), el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-esqueleto', style: 'width:50%' }), el('div', { class: 'cs-esqueleto', style: 'width:80%;margin-top:10px' }),
      el('p', { class: 'cs-ayuda', role: 'status' }, 'Leyendo ' + formatoCO(desde + H_MS) + ' a ' + formatoCO(hasta) + '…'))));
    if (enfocar) focoTitulo();
    try {
      const mesesRango = mesesDelRango(desde, hasta);
      const existentes = mesesRango.filter((m) => (a.punto.meses || []).includes(m));
      let porMes;
      try { porMes = (await leerSeriesPunto(a.cid, existentes)).porMes; }
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
      const filasH = (ctx.homologacion && ctx.homologacion.filas) || {};
      // Primero el mapa nivel → devanado (de la homologación), luego la ampacidad por nivel.
      const previo = calcularEquipo({ tx: a.tx, fila: a.fila, punto: a.punto, resumenPorNivel: null, conteos: conteosHomologacion(filasH), umbrales: ctx.umbrales });
      for (const nv of Object.keys(porNivel)) {
        const i = previo.niveles.find((x) => x.nivel === nv);
        const A = i && i.devanado ? a.placa[i.devanado].A : null;
        porNivel[nv] = calcularNivel(porNivel[nv], NIVELES[nv].kv, A);
        resumenPorNivel[nv] = porNivel[nv].resumen;
      }
      a.porNivel = porNivel;
      a.calc = calcularEquipo({ tx: a.tx, fila: a.fila, punto: a.punto, resumenPorNivel, conteos: conteosHomologacion(filasH), umbrales: ctx.umbrales, mesesFallidos: [...fallidos] });
      const sinNada = Object.values(porNivel).every((d) => !d.resumen.i.n);
      conservarFoco(() => poner(cont, encabezado(a), avisoEl(), selectorRango(a),
        fallidos.size ? el('div', { class: 'cs-panel cs-error', role: 'alert' }, 'No se pudo leer ' + [...fallidos].map(nombreMes).join(', ') + ' (revise la conexión): esas horas quedan como hueco y la cifra no es firme.',
          el('button', { type: 'button', class: 'btn btn--glass btn--sm', style: 'margin-left:8px', onclick: () => cargar(desde, hasta) }, 'Reintentar')) : null,
        sinNada ? el('div', { class: 'cs-panel cs-estado' }, 'No hay horas con dato válido en este rango. Pruebe con otro rango.') : indicadores(a),
        el('div', { id: 'csNivel' })));
      const nv = (a.calc.devMax && (a.calc.niveles.find((x) => x.devanado === a.calc.devMax) || {}).nivel) || Object.keys(porNivel).sort((x, y) => NIVELES[y].kv - NIVELES[x].kv)[0];
      if (nv) await pintarNivel(a, a.nivel && porNivel[a.nivel] ? a.nivel : nv);
    } catch (e) {
      if (mio !== token) return;
      console.warn('[cargabilidad-scada] detalle', e);
      conservarFoco(() => poner(cont, encabezado(a), selectorRango(a), el('div', { class: 'cs-panel cs-estado', role: 'alert' }, 'No se pudo calcular este rango.', el('br'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => cargar(desde, hasta) }, 'Reintentar'))));
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
    const fila = filaDeTransformador(tx, indicePorMatricula(filasH));
    const k = fila ? analizarClaveHomologada(claveEfectiva(fila)) : null;
    const cid = k ? claveId(k.est, k.elem) : null;
    const punto = cid && ctx.catalogo && ctx.catalogo.puntos ? ctx.catalogo.puntos[cid] || null : null;
    const matricula = leer(tx, 'identificacion.matricula') || leer(tx, 'identificacion.codigo') || tx.codigo || mat;
    const cambio = !actual || actual.tx !== tx;
    actual = { mat: matricula, tx, fila, punto, cid, placa: placaDe(tx), porNivel: null, calc: null, nivel: cambio ? null : actual.nivel };
    if (!punto || !(punto.meses || []).length) {
      actual.calc = calcularEquipo({ tx, fila, punto: null, resumenPorNivel: null, conteos: conteosHomologacion(filasH), umbrales: ctx.umbrales });
      poner(cont, encabezado(actual), el('div', { class: 'cs-panel cs-estado' },
        !ctx.catalogo ? 'Todavía no hay mediciones SCADA cargadas.'
          : (!fila ? 'Este transformador no está en la homologación con el SCADA.'
            : (!cid ? 'No hay curvas que mostrar: falta su punto SCADA en la homologación.' : 'Su punto SCADA todavía no tiene datos cargados.'))));
      focoTitulo();
      return;
    }
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

  function focoTitulo() { const t = document.getElementById('csDetTitulo'); if (t) t.focus({ preventScroll: false }); }

  return { abrir, cerrar };
}
