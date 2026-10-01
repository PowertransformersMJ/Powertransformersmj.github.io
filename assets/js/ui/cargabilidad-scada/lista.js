// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cargabilidad SCADA · LISTA del parque · `99 §122`
// ──────────────────────────────────────────────────────────────
// Un transformador por fila con su cargabilidad SCADA del mes elegido. Regla visual: solo la
// cifra FIRME lleva el color de su calificación CRG; la provisional va neutra, con su motivo;
// sin cifra, el porqué. La cifra oficial (Excel de Salud de Activos) va al lado con la
// diferencia: una discrepancia se muestra, no se esconde (L-81). Archivo NUEVO (L-102).
// ══════════════════════════════════════════════════════════════

import { el, poner, num, descargarCSV, conservarFoco } from './dom.js';
import { filasLista, filtrarFilas, ordenarFilas, mesPorDefecto } from '../../domain/scada_carga_vista.js';
import { CRG_CHIP, CALCULO } from '../../domain/scada_carga_config.js';
import { nombreMes } from '../../domain/scada_carga_fecha.js';
import { leerResumenMes } from '../../data/scada_carga.js';
import { BASELINE_UMBRALES_SALUD } from '../../domain/umbrales_salud_baseline.js';

const PASO = 100;
const ESTADOS = { automatica: 'Automática', confirmada: 'Confirmada', pendiente: 'Por confirmar', excluida: 'Excluida', sin_homologacion: 'Sin homologación' };
const COLUMNAS = [
  { campo: 'matricula', texto: 'Transformador' },
  { campo: 'pct', texto: 'Cargabilidad SCADA' },
  { campo: null, texto: 'Devanado' },
  { campo: 'oficial', texto: 'Oficial (Excel)' },
  { campo: 'delta', texto: 'Diferencia (mismo devanado)' },
  { campo: null, texto: 'Medida' },
  { campo: null, texto: '' }
];

/** Bandas CRG vigentes como texto ('60 / 65 / 75 / 90 %'). */
export function textoBandas(umbrales) {
  const c = { ...BASELINE_UMBRALES_SALUD.crg, ...((umbrales && umbrales.crg) || {}) };
  return [c.c2_min_excl, c.c3_min_excl, c.c4_min_excl, c.c5_min_excl].map((x) => num(x, 0)).join(' / ') + ' %';
}

/** Chip de la cifra: color CRG solo si es firme. */
export function chipCifra(x) {
  if (x.pct == null) return el('span', { class: 'chip chip--neutro' }, 'Sin cifra');
  if (x.clase === 'firme' && x.crg) {
    const c = CRG_CHIP[x.crg];
    return el('span', { class: 'chip ' + c.clase }, 'CRG ' + x.crg + ' · ' + c.palabra);
  }
  return el('span', { class: 'chip chip--provisional' }, 'Provisional' + (x.crg ? ' · CRG ' + x.crg : ''));
}

export function montarLista(cont, ctx, { alAbrir }) {
  const st = {
    mes: null, resumen: null, filas: null, error: null, cargando: false, visibles: PASO,
    filtro: { texto: '', zona: '', estado: '', crg: '', soloFirmes: false, soloSostenida: false },
    orden: { campo: 'pct', dir: 'desc' }
  };
  let tablaCaja = null; let contador = null;
  let turno = 0;   // descarta la respuesta de un mes que ya no es el elegido

  async function cargarMes(mes) {
    const mio = ++turno;
    st.mes = mes; st.cargando = true; st.error = null; st.filas = null;
    dibujar();
    const r = await leerResumenMes(mes);
    if (mio !== turno) return;
    st.cargando = false;
    if (r.estado === 'fallo') { st.error = 'No se pudo leer el resumen de ' + nombreMes(mes) + ' (revise la conexión).'; dibujar(); return; }
    st.resumen = r.estado === 'ok' ? r.datos : null;
    st.filas = filasLista({ parque: ctx.parque, homologacion: ctx.homologacion, catalogo: ctx.catalogo, resumenMes: st.resumen, umbrales: ctx.umbrales });
    dibujar();
  }

  function mostrar(mesPedido) {
    const meses = Object.keys((ctx.catalogo && ctx.catalogo.meses) || {});
    const mes = mesPedido && meses.includes(mesPedido) ? mesPedido : (st.mes || mesPorDefecto(ctx.catalogo));
    if (!mes) { st.mes = null; dibujar(); return; }
    if (mes !== st.mes || (!st.filas && !st.cargando && !st.error)) cargarMes(mes);
  }

  function cabeceraOrigen() {
    const meses = Object.entries((ctx.catalogo && ctx.catalogo.meses) || {}).sort((a, b) => b[0].localeCompare(a[0]));
    const sel = el('select', { id: 'csMes', 'aria-label': 'Mes' }, meses.map(([m, x]) => el('option', { value: m, selected: m === st.mes },
      nombreMes(m) + (x && !x.completo ? ' (incompleto: ' + x.nDias + ' de ' + x.dias.length + ' días)' : ''))));
    sel.addEventListener('change', () => { st.visibles = PASO; history.replaceState(null, '', '#mes=' + sel.value); cargarMes(sel.value); });
    return el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-filtros' },
        el('label', { for: 'csMes' }, 'Mes', sel),
        el('div', { class: 'cs-origen', style: 'grid-column: 1 / -1' },
          el('span', {}, el('b', {}, 'Fuente: '), 'SCADA, promedio de cada hora'),
          el('span', {}, el('b', {}, 'Cifra: '), 'p99 de la fase más cargada ÷ ampacidad del devanado'),
          el('span', {}, el('b', {}, 'Bandas CRG: '), textoBandas(ctx.umbrales) + ' (MO.00418)'))),
      ctx.avisos.length || ctx.truncado ? el('ul', { class: 'cs-avisos' },
        ctx.avisos.map((t) => el('li', {}, t)),
        ctx.truncado ? el('li', {}, 'El parque se leyó hasta 500 equipos: puede faltar alguno.') : null) : null);
  }

  function resumenKpis(filas) {
    const firmes = filas.filter((x) => x.clase === 'firme');
    const prov = filas.filter((x) => x.clase === 'provisional');
    const altos = firmes.filter((x) => x.crg >= 4).length;
    const sost = filas.filter((x) => x.sobrecargaSostenida).length;
    const kpi = (t, v, n) => el('div', { class: 'cs-kpi' }, el('div', { class: 'cs-kpi-t' }, t), el('div', { class: 'cs-kpi-v' }, v), el('div', { class: 'cs-kpi-n' }, n));
    return el('div', { class: 'cs-panel cs-principal' },
      kpi('Con cifra firme', String(firmes.length), 'de ' + filas.length + ' transformadores del parque'),
      kpi('Provisionales', String(prov.length), 'medida por confirmar o incompleta'),
      kpi('CRG 4 y 5 (firmes)', String(altos), 'por encima de ' + textoBandas(ctx.umbrales).split(' / ')[2] + ' %'),
      kpi('Sobrecarga sostenida', String(sost), 'firmes con ≥ ' + CALCULO.sobrecargaMinH + ' h seguidas sobre el ' + CALCULO.sobrecargaPct + ' %'));
  }

  function barraFiltros(filas) {
    const f = st.filtro;
    const zonas = [...new Set(filas.map((x) => x.zona).filter(Boolean))].sort();
    const q = el('input', { type: 'search', id: 'csTexto', value: f.texto, placeholder: 'Matrícula, subestación, zona…', autocomplete: 'off' });
    let t = null;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f.texto = q.value; st.visibles = PASO; pintarTabla(); }, 200); });
    const sel = (id, valor, opciones, alCambiar) => {
      const s = el('select', { id }, opciones.map(([v, txt]) => el('option', { value: v, selected: String(v) === String(valor) }, txt)));
      s.addEventListener('change', () => { alCambiar(s.value); st.visibles = PASO; pintarTabla(); });
      return s;
    };
    const chk = (id, valor, alCambiar) => {
      const c = el('input', { type: 'checkbox', id, checked: valor });
      c.addEventListener('change', () => { alCambiar(c.checked); st.visibles = PASO; pintarTabla(); });
      return c;
    };
    return el('div', { class: 'cs-panel' },
      el('div', { class: 'cs-filtros', role: 'search' },
        el('label', { for: 'csTexto' }, 'Buscar', q),
        el('label', { for: 'csZona' }, 'Zona', sel('csZona', f.zona, [['', 'Todas'], ...zonas.map((z) => [z, z])], (v) => { f.zona = v; })),
        el('label', { for: 'csEstado' }, 'Medida', sel('csEstado', f.estado, [['', 'Todas'], ...Object.entries(ESTADOS)], (v) => { f.estado = v; })),
        el('label', { for: 'csCrg' }, 'Calificación CRG', sel('csCrg', f.crg, [['', 'Todas'], ...[5, 4, 3, 2, 1].map((n) => [n, n + ' · ' + CRG_CHIP[n].palabra])], (v) => { f.crg = v; })),
        el('label', { class: 'cs-check', for: 'csFirmes' }, chk('csFirmes', f.soloFirmes, (v) => { f.soloFirmes = v; }), ' Solo cifras firmes'),
        el('label', { class: 'cs-check', for: 'csSost' }, chk('csSost', f.soloSostenida, (v) => { f.soloSostenida = v; }), ' Solo sobrecarga sostenida')),
      el('div', { class: 'cs-acciones' },
        contador = el('p', { class: 'cs-contador', role: 'status', 'aria-live': 'polite', style: 'margin:0' }),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: exportar }, 'Descargar lista (CSV)')));
  }

  function celdaCifra(x) {
    const td = el('td', {});
    if (x.pct == null) {
      td.append(el('span', { class: 'cs-num' }, '—'), chipCifra(x), el('span', { class: 'cs-sub' }, x.motivoNulo || ''));
      return td;
    }
    td.append(el('span', { class: 'cs-num' }, num(x.pct, 1) + ' %'), ' ', chipCifra(x));
    if (x.clase !== 'firme' && x.motivos.length) td.append(el('span', { class: 'cs-sub' }, x.motivos.join(' · ')));
    if (x.sobrecargaSostenida) td.append(el('span', { class: 'cs-sub cs-sostenida' }, 'Sobrecarga sostenida (≥ ' + CALCULO.sobrecargaMinH + ' h sobre el ' + CALCULO.sobrecargaPct + ' %)'));
    else if (x.sobrecargaProvisional) td.append(el('span', { class: 'cs-sub' }, 'Posible sobrecarga sostenida (cifra provisional)'));
    else if (x.picoAislado) td.append(el('span', { class: 'cs-sub cs-pico' }, 'Pico aislado sobre el 100 % (no sostenido)'));
    return td;
  }

  function filaTabla(x) {
    const abrir = (ev) => { ev.preventDefault(); alAbrir(x.matricula, st.mes, x.id); };
    const of = x.oficial && x.oficial.pct != null ? num(x.oficial.pct, 1) + ' %' : '—';
    const ofDev = x.delta != null && x.oficial && x.oficial.porDevanado ? x.oficial.porDevanado[x.devMax] : null;
    return el('tr', { class: x.clase === 'provisional' ? 'cs-fila-prov' : (x.clase === 'nulo' ? 'cs-fila-nulo' : null) },
      el('th', { scope: 'row', style: 'position:static;background:none;font-size:13px' },
        el('a', { href: '#mat=' + encodeURIComponent(x.matricula), onclick: abrir }, x.matricula || '(sin matrícula)'),
        el('span', { class: 'cs-sub' }, [x.subestacion, x.zona].filter(Boolean).join(' · '))),
      celdaCifra(x),
      el('td', {}, x.pct != null && x.devMax ? ({ P: 'Primario', S: 'Secundario', T: 'Terciario' })[x.devMax] : '—'),
      el('td', {}, el('span', { class: 'cs-num' }, of), x.oficial && x.oficial.calif ? el('span', { class: 'cs-sub' }, 'CRG ' + x.oficial.calif + ' en Salud de Activos') : null,
        ofDev != null ? el('span', { class: 'cs-sub' }, ({ P: 'Primario', S: 'Secundario', T: 'Terciario' })[x.devMax] + ' ' + num(ofDev, 1) + ' %') : null),
      el('td', {}, x.delta == null ? '—' : el('span', { class: 'cs-num' }, (x.delta > 0 ? '+' : '') + num(x.delta, 1) + ' pts')),
      el('td', {}, ESTADOS[x.estado] || x.estado, x.avisos.length && x.estado === 'pendiente' ? el('span', { class: 'cs-sub' }, x.avisos.length + (x.avisos.length === 1 ? ' aviso' : ' avisos')) : null),
      el('td', {}, x.tienePunto ? el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: abrir, 'aria-label': 'Ver curvas de ' + x.matricula }, 'Ver curvas') : el('span', { class: 'cs-sub' }, 'sin datos SCADA')));
  }

  function filasVisibles() {
    return ordenarFilas(filtrarFilas(st.filas || [], st.filtro), st.orden.campo, st.orden.dir);
  }

  function pintarTabla() { conservarFoco(pintarTablaSinFoco); }
  function pintarTablaSinFoco() {
    if (!tablaCaja) return;
    const todas = filasVisibles();
    const vis = todas.slice(0, st.visibles);
    contador.textContent = todas.length + ' de ' + st.filas.length + ' transformadores';
    if (!todas.length) {
      poner(tablaCaja, el('div', { class: 'cs-estado' }, 'Ningún transformador cumple los filtros.', el('br'),
        el('button', { type: 'button', id: 'csQuitar', class: 'btn btn--glass btn--sm', onclick: () => { st.filtro = { texto: '', zona: '', estado: '', crg: '', soloFirmes: false, soloSostenida: false }; dibujar(); const q = document.getElementById('csTexto'); if (q) q.focus(); } }, 'Quitar filtros')));
      return;
    }
    const th = (c) => {
      if (!c.campo) return el('th', { scope: 'col' }, c.texto);
      const activo = st.orden.campo === c.campo;
      const b = el('button', { type: 'button', id: 'csOrden-' + c.campo }, c.texto + (activo ? (st.orden.dir === 'desc' ? ' ↓' : ' ↑') : ''));
      b.addEventListener('click', () => {
        st.orden = activo ? { campo: c.campo, dir: st.orden.dir === 'desc' ? 'asc' : 'desc' } : { campo: c.campo, dir: c.campo === 'matricula' ? 'asc' : 'desc' };
        pintarTabla();
      });
      return el('th', { scope: 'col', 'aria-sort': activo ? (st.orden.dir === 'desc' ? 'descending' : 'ascending') : 'none' }, b);
    };
    const tabla = el('table', { class: 'cs-tabla' },
      el('caption', {}, 'Cargabilidad SCADA de ' + nombreMes(st.mes) + '. Ordenado por ' + (COLUMNAS.find((c) => c.campo === st.orden.campo) || {}).texto + '.'),
      el('thead', {}, el('tr', {}, COLUMNAS.map(th))),
      el('tbody', {}, vis.map(filaTabla)));
    poner(tablaCaja, tabla,
      todas.length > vis.length ? el('div', { class: 'cs-acciones', style: 'padding:0 12px 12px' },
        el('button', { type: 'button', id: 'csMas', class: 'btn btn--glass btn--sm', onclick: () => { st.visibles += PASO; pintarTabla(); } }, 'Mostrar ' + Math.min(PASO, todas.length - vis.length) + ' más')) : null);
  }

  function exportar() {
    const filas = filasVisibles();
    const dev = { P: 'Primario', S: 'Secundario', T: 'Terciario' };
    descargarCSV('cargabilidad_scada_' + st.mes + '.csv',
      ['Matricula', 'Subestacion', 'Zona', 'Mes', 'Cargabilidad_SCADA_pct', 'Clase', 'CRG', 'Devanado', 'Oficial_Excel_equipo_pct', 'Oficial_Excel_mismo_devanado_pct', 'Diferencia_mismo_devanado_pts', 'Medida', 'Motivos', 'Sobrecarga_sostenida'],
      filas.map((x) => [x.matricula, x.subestacion, x.zona, st.mes, x.pct, x.clase, x.crg, x.pct != null && x.devMax ? dev[x.devMax] : '', x.oficial ? x.oficial.pct : null,
        x.delta != null && x.oficial && x.oficial.porDevanado ? x.oficial.porDevanado[x.devMax] : null,
        x.delta, ESTADOS[x.estado] || x.estado, x.pct == null ? (x.motivoNulo || '') : x.motivos.join(' | '), x.sobrecargaSostenida ? 'si' : 'no']));
  }

  function dibujar() { conservarFoco(dibujarSinFoco); }
  function dibujarSinFoco() {
    tablaCaja = null;
    if (ctx.errorCatalogo) {
      poner(cont, el('div', { class: 'cs-panel cs-estado', role: 'alert' }, 'No se pudo leer qué meses hay cargados (revise la conexión).', el('br'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => location.reload() }, 'Reintentar')));
      return;
    }
    if (!ctx.catalogo || !st.mes) {
      poner(cont, cabeceraVacia(), el('div', { class: 'cs-panel cs-estado' }, 'Todavía no hay mediciones SCADA cargadas.',
        ctx.esAdmin ? el('div', {}, el('a', { class: 'btn btn--primary btn--sm', href: '../admin/scada-datos.html#tab=cargar' }, 'Cargar un mes')) : el('div', { class: 'cs-ayuda' }, 'Un administrador las carga en «Datos SCADA».')));
      return;
    }
    if (st.cargando) { poner(cont, cabeceraOrigen(), el('div', { class: 'cs-panel' }, el('div', { class: 'cs-esqueleto', style: 'width:60%' }), el('div', { class: 'cs-esqueleto', style: 'width:85%;margin-top:10px' }), el('p', { class: 'cs-ayuda', role: 'status' }, 'Calculando ' + nombreMes(st.mes) + '…'))); return; }
    if (st.error) {
      poner(cont, cabeceraOrigen(), el('div', { class: 'cs-panel cs-estado', role: 'alert' }, st.error, el('br'),
        el('button', { type: 'button', class: 'btn btn--glass btn--sm', onclick: () => cargarMes(st.mes) }, 'Reintentar')));
      return;
    }
    if (!st.filas) return;
    tablaCaja = el('div', { class: 'cs-tabla-caja' });
    poner(cont, cabeceraOrigen(), resumenKpis(st.filas), barraFiltros(st.filas), tablaCaja);
    pintarTabla();
  }
  function cabeceraVacia() {
    return ctx.avisos.length ? el('div', { class: 'cs-panel' }, el('ul', { class: 'cs-avisos' }, ctx.avisos.map((t) => el('li', {}, t)))) : null;
  }

  return { mostrar };
}
