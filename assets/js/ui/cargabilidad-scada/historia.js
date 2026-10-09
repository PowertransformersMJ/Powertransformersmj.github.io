// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · HISTORIA del equipo (todo lo cargado) · `99 §159`
// ──────────────────────────────────────────────────────────────
// Lo que el Ingeniero pidió al abrir un equipo: desde cuándo supera su capacidad (2 h seguidas sobre el 100 %, con la
// primera hora suelta como nota) y el día de su mayor corriente en CADA devanado, sobre TODO lo cargado (no solo el
// rango de las curvas). Sale de los resúmenes mensuales (los mismos de la lista, leídos una vez por sesión) y de la curva
// de los pocos meses que hacen falta para la hora exacta (tope `MAX_CURVAS`). Los meses provisionales cuentan igual que
// los firmes (decisión del Ingeniero) y se rotulan. Archivo NUEVO (L-102): el detalle lo carga con import().
// ══════════════════════════════════════════════════════════════

import { el, poner, num } from './dom.js';
import { leerResumenMes, leerSeriesPunto } from '../../data/scada_carga.js';
import { calcularEquipo } from '../../domain/scada_carga_vista.js';
import { conteosHomologacion } from '../../domain/scada_carga_homologacion.js';
import { nombreMes, formatoCO } from '../../domain/scada_carga_fecha.js';
import { DEVANADO, CALCULO } from '../../domain/scada_carga_config.js';
import { agregadosDeMeses, hitosDeCurva, nivelCuenta } from '../../domain/scada_carga_periodo.js';
import { sobrecargaDeCurva, aplicarVerificacion } from '../../domain/scada_carga_sostenida.js';

const MAX_CURVAS = 6;   // curvas de mes que la historia puede leer por equipo (cada una de 70 a 260 KB)
const SOBRE = CALCULO.sobrecargaPct;
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corto = (mes) => MESES_CORTOS[Number(String(mes).slice(5, 7)) - 1] || mes;

/** Meses de calendario entre dos 'AAAA-MM' (incluidos). */
function mesesEntre(a, b) {
  const out = []; let [y, m] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number);
  while (y < yb || (y === yb && m <= mb)) { out.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

/**
 * Pinta la historia en `nodo` (una sección fija del detalle: no parpadea al cambiar el rango).
 * @param {HTMLElement} nodo
 * @param {{a: object, ctx: object, alVerDia: (ms:number) => void, vigente: () => boolean, alReintentar?: () => void}} opts
 * @returns {Promise<{completa: boolean}|undefined>}  completa = false si algún mes no se pudo leer (se rehace al reabrir)
 */
export async function pintarHistoria(nodo, { a, ctx, alVerDia, vigente, alReintentar }) {
  const titulo = el('h3', { id: 'csHistoriaTitulo' }, 'Historia del equipo · todo lo cargado');
  poner(nodo, titulo, el('div', { class: 'cs-esqueleto', style: 'width:60%' }), el('p', { class: 'cs-ayuda', role: 'status' }, 'Leyendo la historia del equipo…'));
  nodo.hidden = false;
  const meses = [...((a.punto && a.punto.meses) || [])].sort();
  if (!meses.length) { poner(nodo, titulo, el('p', { class: 'cs-ayuda' }, 'Este punto no tiene meses cargados.')); return; }
  const filasH = (ctx.homologacion && ctx.homologacion.filas) || {};
  const conteos = conteosHomologacion(filasH);
  const leidas = await Promise.all(meses.map((m) => leerResumenMes(m)));
  if (!vigente()) return;
  const fallidos = meses.filter((m, k) => leidas[k].estado === 'fallo');
  const rDe = (k) => (leidas[k].estado === 'ok' && leidas[k].datos && leidas[k].datos.claves ? leidas[k].datos.claves[a.cid] || null : null);
  // Curvas: UNA lectura por mes como mucho, con tope; lo que no alcance queda dicho como «por confirmar».
  const curvas = new Map(); let leidasCurvas = 0;
  async function curva(mes) {
    if (curvas.has(mes)) return curvas.get(mes);
    if (leidasCurvas >= MAX_CURVAS) return null;
    leidasCurvas++;
    let doc = null;
    try { doc = (await leerSeriesPunto(a.cid, [mes])).porMes[mes]; } catch (e) { console.warn('[cargabilidad-scada] historia', e); }
    curvas.set(mes, doc);
    return doc;
  }
  // Mes a mes, con la MISMA función de la lista (y su verificación con la curva cuando el mes trae horas imposibles).
  const porMes = [];
  for (let k = 0; k < meses.length; k++) {
    const r = rDe(k);
    let x = r ? calcularEquipo({ tx: a.tx, fila: a.fila, punto: a.punto, resumenPorNivel: r, conteos, umbrales: ctx.umbrales, mes: meses[k] }) : null;
    if (x && x.sobrecargaPorVerificar && x.sobrecargaPorVerificar.length) {
      const doc = await curva(meses[k]);
      x = aplicarVerificacion(x, x.sobrecargaPorVerificar.map((n) => (doc ? sobrecargaDeCurva(doc, meses[k], n.nivel, n.A) : null)));
    }
    porMes.push({ mes: meses[k], fila: x, r });
  }
  if (!vigente()) return;
  const ag = agregadosDeMeses(porMes);

  // Hora exacta: la primera ventana de 2 h y la primera hora suelta, en el mes y los niveles que las tienen. Solo los
  // niveles que dan cifra ese mes (los de escala sospechosa o de un circuito sin confirmar no afirman nada).
  const nivelesSobre = (x, campo) => ((x && x.niveles) || []).filter((n) => nivelCuenta(x, n) && n[campo] != null && n[campo] > SOBRE);
  async function primeraEn(mes, campo, hito) {
    const k = meses.indexOf(mes); const x = porMes[k] && porMes[k].fila;
    let mejor = null;
    for (const n of nivelesSobre(x, campo)) {
      const doc = await curva(mes);
      const h = doc ? hitosDeCurva(doc, mes, n.nivel, n.A) : null;
      const ms = h ? h[hito] : null;
      if (ms != null && (mejor == null || ms < mejor.ms)) mejor = { ms, devanado: n.devanado, nivel: n.nivel };
    }
    return mejor;
  }
  const sost = ag.primeraSostenida ? await primeraEn(ag.primeraSostenida.mes, 'sostenidaPct', 'primeraSostenida') : null;
  const hora = ag.primeraHora ? await primeraEn(ag.primeraHora.mes, 'picoPct', 'primeraHora') : null;
  // Por devanado (de `agregadosDeMeses`, con la compuerta de la lista): su mayor corriente confiable, desde qué mes supera
  // y en cuántos. Los meses con horas imposibles se deciden con la curva LIMPIA de ese mes (máximo y sobrecarga); los que
  // no alcanzan el tope de lecturas quedan «por confirmar».
  const devs = [];
  for (const g0 of ag.devanados) {
    const g = { ...g0, primeraSost: g0.primeraSost ? { ...g0.primeraSost } : null, pendientes: [] };
    for (const im of g0.imposibles) {
      const doc = await curva(im.mes);
      const h = doc ? hitosDeCurva(doc, im.mes, im.nivel, im.A) : null;
      if (!h) { g.pendientes.push(im.mes); continue; }
      if (h.max && (g.pct == null || h.max.pct > g.pct)) Object.assign(g, { max: h.max.A, pct: h.max.pct, ms: h.max.ms, mes: im.mes, clase: im.clase, nivel: im.nivel, limpio: true });
      if (h.horasSostenidas > 0) {
        g.mesesSost++;
        if (!g.primeraSost || im.mes < g.primeraSost.mes) g.primeraSost = { mes: im.mes, nivel: im.nivel, A: im.A, clase: im.clase, ms: h.primeraSostenida };
      }
    }
    if (g.primeraSost && g.primeraSost.ms === undefined) {
      const doc = await curva(g.primeraSost.mes);
      const h = doc ? hitosDeCurva(doc, g.primeraSost.mes, g.primeraSost.nivel, g.primeraSost.A) : null;
      g.primeraSost.ms = h ? h.primeraSostenida : null;
    }
    devs.push(g);
  }
  const mayorDev = devs.filter((g) => g.pct != null).reduce((p, q) => (p == null || q.pct > p.pct ? q : p), null);
  if (!vigente()) return;

  // ── Pintar ───────────────────────────────────────────────────────────────────
  const prov = (clase) => (clase && clase !== 'firme' ? el('span', { class: 'cs-hist-prov' }, ' (mes provisional)') : null);
  // Con id: al cambiar el rango, el foco vuelve al mismo botón (conservarFoco).
  const verDia = (ms, d) => (ms != null ? el('button', { type: 'button', id: 'csHistDia-' + d, class: 'btn btn--ghost btn--sm cs-hist-dia', onclick: () => alVerDia(ms) }, 'Ver ese día') : null);
  const mesesCat = Object.keys((ctx.catalogo && ctx.catalogo.meses) || {}).sort();
  const calendario = mesesEntre(meses[0], meses[meses.length - 1]);
  const huecos = calendario.filter((m) => !meses.includes(m));
  const incompletos = meses.filter((m) => ctx.catalogo && ctx.catalogo.meses && ctx.catalogo.meses[m] && !ctx.catalogo.meses[m].completo);
  const sub = [nombreMes(meses[0]) + ' a ' + nombreMes(meses[meses.length - 1])]
    .concat(huecos.length ? [huecos.map(nombreMes).join(', ') + ' sin datos de este punto' + (huecos.some((m) => !mesesCat.includes(m)) ? ' (no cargado)' : '')] : [])
    .concat(incompletos.map((m) => nombreMes(m) + ' incompleto (' + ctx.catalogo.meses[m].nDias + ' de ' + ctx.catalogo.meses[m].dias.length + ' días)'));

  let desde;
  if (ag.primeraSostenida) {
    const inicio = ag.primeraSostenida.inicioDatos;
    const cuando = sost && sost.ms != null ? formatoCO(sost.ms) : nombreMes(ag.primeraSostenida.mes);
    desde = el('div', {},
      el('b', {}, inicio ? 'Desde el inicio de los datos (' + nombreMes(ag.primeraSostenida.mes) + '); antes no se sabe' : cuando),
      sost && sost.devanado ? ' · ' + DEVANADO[sost.devanado] : '', ' · ' + CALCULO.sobrecargaMinH + ' h seguidas sobre el ' + SOBRE + ' %', prov(ag.primeraSostenida.clase),
      inicio && sost && sost.ms != null ? el('span', { class: 'cs-sub' }, 'Primera ventana: ' + formatoCO(sost.ms)) : null,
      hora && hora.ms != null && (!sost || sost.ms == null || hora.ms < sost.ms) ? el('span', { class: 'cs-sub' }, 'Una hora suelta sobre el ' + SOBRE + ' % ya el ' + formatoCO(hora.ms) + (hora.devanado ? ' (' + DEVANADO[hora.devanado].toLowerCase() + ')' : '')) : null,
      (() => {
        const k = meses.indexOf(ag.primeraSostenida.mes);
        const antes = k > 0 ? porMes[k - 1] : null;
        return antes && antes.fila && antes.fila.pct != null && !antes.fila.sobrecargaSostenida && !antes.fila.sobrecargaProvisional
          ? el('span', { class: 'cs-sub' }, 'Antes: ' + nombreMes(antes.mes) + ' sin sobrecarga sostenida (' + num(antes.fila.pct, 1) + ' %).') : null;
      })(),
      ag.primeraSostenida && !sost ? el('span', { class: 'cs-sub' }, 'La hora exacta se ve en las curvas de ' + nombreMes(ag.primeraSostenida.mes) + '.') : null);
  } else if (ag.primeraHora) {
    desde = el('div', {}, el('b', {}, 'Nunca 2 h seguidas sobre el ' + SOBRE + ' %'), el('span', { class: 'cs-sub' },
      'Solo horas sueltas: la primera ' + (hora && hora.ms != null ? 'el ' + formatoCO(hora.ms) : 'en ' + nombreMes(ag.primeraHora.mes)) + '.'));
  } else if (!ag.mesesConCifra) {
    // Sin cifra en ningún mes (p. ej. se mide un circuito sin confirmar): no se afirma que no haya superado nada.
    const ult = [...porMes].reverse().find((m) => m.fila && m.fila.motivoNulo);
    desde = el('div', {}, el('b', {}, 'Sin cifra en lo cargado'), ult ? el('span', { class: 'cs-sub' }, ult.fila.motivoNulo + '.') : null);
  } else {
    desde = el('div', {}, el('b', {}, 'No ha superado su capacidad en lo cargado'),
      mayorDev ? el('span', { class: 'cs-sub' }, 'Su mayor corriente fue el ' + num(mayorDev.pct, 1) + ' % (' + mayorDev.nombre.toLowerCase() + ').') : null,
      ag.porConfirmar ? el('span', { class: 'cs-sub' }, ag.porConfirmar + (ag.porConfirmar === 1 ? ' mes trae' : ' meses traen') + ' horas con valores imposibles y no se pudo leer su curva: por confirmar en las curvas.') : null);
  }

  // Un devanado sin número: se dice por qué (la misma causa que da la lista), no «no se mide».
  const motivoDev = (d) => {
    let ultimo = null;
    for (const { fila: x } of porMes) {
      const n = ((x && x.niveles) || []).find((y) => y.devanado === d);
      if (n) ultimo = { x, n };
    }
    if (!ultimo) return 'no se mide en el SCADA';
    const { x, n } = ultimo;
    if (x.pct == null && x.motivoNulo) return 'sin cifra: ' + x.motivoNulo;
    if (n.escala === 'ESCALA_I' || n.escala === 'ESCALA_INDETERMINADA') return 'sin cifra: escala de la corriente sospechosa';
    if (!(n.A > 0)) return 'sin cifra: sin ampacidad del devanado';
    return 'sin horas medidas en lo cargado';
  };
  const placa = a.placa || {};
  const filasDev = ['P', 'S', 'T'].filter((d) => placa[d] && placa[d].kv).map((d) => {
    const g = devs.find((x) => x.devanado === d);
    const kv = num(placa[d].kv, 1) + ' kV';
    if (!g) return el('div', { class: 'cs-hist-dev' }, el('b', {}, DEVANADO[d] + ' ' + kv), ' · ', el('span', { class: 'cs-sub', style: 'display:inline' }, motivoDev(d)));
    const pend = g.pendientes.length ? g.pendientes.map(nombreMes).join(', ') : null;
    const cabeza = g.pct != null
      ? [num(g.max, 1) + ' A · ', el('b', {}, num(g.pct, 0) + ' %'), ' de ' + num(g.A, 0) + ' A · ', el('b', {}, g.ms != null ? formatoCO(g.ms) : nombreMes(g.mes)), prov(g.clase), ' ', verDia(g.ms, d)]
      : [el('span', { class: 'cs-sub', style: 'display:inline' }, 'por confirmar')];
    return el('div', { class: 'cs-hist-dev' },
      el('b', {}, DEVANADO[d] + ' ' + kv), ' · ', ...cabeza,
      g.limpio ? el('span', { class: 'cs-sub' }, 'Sin las horas imposibles de ' + nombreMes(g.mes) + '.') : null,
      pend ? el('span', { class: 'cs-sub' }, (g.pct != null ? 'Sin contar ' : '') + pend + ': valores imposibles del SCADA (más de 3 veces la ampacidad), por confirmar en las curvas de ese mes.') : null,
      el('span', { class: 'cs-sub' }, g.primeraSost
        ? 'Supera su capacidad desde ' + (g.primeraSost.ms != null ? formatoCO(g.primeraSost.ms) : nombreMes(g.primeraSost.mes)) + (g.primeraSost.clase !== 'firme' ? ' (mes provisional)' : '') + ' · ' + g.mesesSost + ' de ' + g.mesesConDato + ' meses con sobrecarga sostenida'
        : (pend ? 'Sin sobrecarga sostenida en los meses que se pudieron revisar.' : 'No ha superado su capacidad (2 h seguidas sobre el ' + SOBRE + ' %).')));
  });

  const chips = calendario.map((mes) => {
    const k = meses.indexOf(mes); const x = k >= 0 ? porMes[k].fila : null;
    if (!x) return el('span', { class: 'cs-hist-mes cs-hist-mes--vacio', title: nombreMes(mes) + ': sin datos' }, corto(mes) + ' sin datos');
    if (x.pct == null) return el('span', { class: 'cs-hist-mes cs-hist-mes--vacio', title: nombreMes(mes) + ': ' + (x.motivoNulo || 'sin cifra') }, corto(mes) + ' —');
    const sostM = x.sobrecargaSostenida || x.sobrecargaProvisional;
    return el('span', { class: 'cs-hist-mes' + (x.clase === 'firme' ? ' cs-hist-mes--crg' + (x.crg || 0) : ' cs-hist-mes--prov') + (sostM ? ' cs-hist-mes--sost' : ''),
      title: nombreMes(mes) + ': ' + num(x.pct, 1) + ' %' + (x.crg ? ' · CRG ' + x.crg : '') + (x.clase === 'firme' ? ' firme' : ' provisional') + (sostM ? ' · sobrecarga sostenida' : '') },
    corto(mes) + ' ' + num(x.pct, 1) + ' %' + (sostM ? ' ▲' : ''));
  });

  poner(nodo, titulo,
    el('p', { class: 'cs-ayuda', style: 'margin-top:0' }, sub.join(' · ')),
    fallidos.length ? el('p', { class: 'cs-error', role: 'alert' }, 'No se pudo leer ' + fallidos.map(nombreMes).join(', ') + ': la historia no los incluye. ',
      alReintentar ? el('button', { type: 'button', id: 'csHistReintentar', class: 'btn btn--glass btn--sm', onclick: alReintentar }, 'Reintentar') : null) : null,
    el('dl', { class: 'cs-hist' },
      el('dt', {}, 'Supera su capacidad desde'), el('dd', {}, desde),
      el('dt', {}, 'Mayor corriente por devanado'), el('dd', {}, filasDev.length ? filasDev : el('span', { class: 'cs-sub' }, 'La placa no trae tensiones.')),
      el('dt', {}, 'Mes a mes (la cifra de la lista)'), el('dd', {}, el('div', { class: 'cs-hist-meses' }, chips),
        el('span', { class: 'cs-sub' }, '▲ = sobrecarga sostenida en el mes · en gris, los meses provisionales (cuentan igual).'))),
    el('p', { class: 'cs-ayuda' }, 'Las horas van como las rotula el SCADA (la de las 14:00 es el promedio de 13:00 a 14:00). La mayor corriente es el promedio de la hora de la fase más cargada, no el pico instantáneo.'
      + (leidasCurvas >= MAX_CURVAS ? ' Algunas horas exactas no se calcularon (tope de lecturas): véalas en las curvas del mes.' : '')));
  return { completa: !fallidos.length };
}

